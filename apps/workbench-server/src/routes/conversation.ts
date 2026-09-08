import { conversationTurnSchema } from "@ai-assist/contracts";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

import { errorStatusCode, safeErrorResponse } from "../security.js";
import { formatSseEvent, sanitizeSsePayload } from "../sse.js";
import { buildEvidenceLabeledModelPrompt } from "../model-prompt.js";
import type { WorkbenchServerContext } from "../server.js";

const conversationSelectionSchema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1).optional(),
  sourceRow: z.number().int().positive().optional(),
  factorName: z.string().min(1).optional(),
  calculationReference: z.string().min(1).optional(),
}).strict();

type ConversationSelectionInput = z.infer<typeof conversationSelectionSchema>;

function compactSelection(selection: ConversationSelectionInput) {
  return {
    worksheetName: selection.worksheetName,
    ...(selection.tableId === undefined ? {} : { tableId: selection.tableId }),
    ...(selection.sourceRow === undefined ? {} : { sourceRow: selection.sourceRow }),
    ...(selection.factorName === undefined ? {} : { factorName: selection.factorName }),
    ...(selection.calculationReference === undefined ? {} : { calculationReference: selection.calculationReference }),
  };
}

export const conversationRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.get("/api/sessions/:sessionId/conversation", async (request, reply) => {
    const auth = context.requireBrowserSession(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    return { turns: await context.conversation.read(sessionId) };
  });

  app.post("/api/sessions/:sessionId/conversation", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) return reply.code(403).send({ error: "session_scope_rejected" });
    const envelope = z.object({ turn: conversationTurnSchema, selection: conversationSelectionSchema }).strict().safeParse(request.body);
    if (!envelope.success || envelope.data.turn.sessionId !== sessionId) {
      return reply.code(400).send({ error: "conversation_schema_rejected" });
    }
    const text = envelope.data.turn.content.filter((part): part is Extract<(typeof envelope.data.turn.content)[number], { kind: "text" }> => part.kind === "text").map((part) => part.text).join("\n").trim();
    if (text.length === 0) return reply.code(400).send({ error: "conversation_text_required" });
    const snapshot = await context.sessions.read(sessionId);
    if (snapshot === undefined) return reply.code(404).send({ error: "session_not_found" });
    let taContext;
    try {
      taContext = await context.buildConversationContext(sessionId, compactSelection(envelope.data.selection));
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
    const turnsBeforeUser = await context.conversation.read(sessionId);
    let userTurn;
    try {
      userTurn = await context.conversation.append(conversationTurnSchema.parse({
        contractVersion: "ta-conversation-turn-v1",
        turnId: envelope.data.turn.turnId,
        sessionId,
        sequence: nextConversationSequence(turnsBeforeUser),
        source: "web",
        role: "user",
        content: [{ kind: "text", text }],
        createdAt: new Date().toISOString(),
        relatedArtifactIds: taContext.relatedArtifactIds,
      }));
    } catch {
      return reply.code(409).send({ error: "conversation_turn_conflict" });
    }
    const prompt = buildEvidenceLabeledModelPrompt(text, taContext, snapshot.interactionLanguage);
    const actionId = `model:${userTurn.turnId}`;
    const created = await context.hostActions.create({ contractVersion: "f8-host-action-request-v1", actionId, sessionId, expectedRevision: snapshot.revision, kind: "vscode_model_request", confirmationHash: createHash("sha256").update(prompt).digest("hex"), expectedTargetVersion: "vscode-model-v1", turnId: userTurn.turnId, prompt, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
    if (created === undefined) return reply.code(409).send({ error: "model_action_conflict" });
    const turns = await context.conversation.read(sessionId);
    let appended;
    try {
      appended = await context.conversation.append(conversationTurnSchema.parse({ contractVersion: "ta-conversation-turn-v1", turnId: `${userTurn.turnId}:assistant`, sessionId, sequence: nextConversationSequence(turns), source: "system", role: "assistant", content: [{ kind: "text", text: snapshot.interactionLanguage.uiCatalogLanguage === "zh" ? "等待 VS Code 模型回答…" : "Waiting for the VS Code model response..." }], createdAt: new Date().toISOString(), relatedArtifactIds: taContext.relatedArtifactIds }));
    } catch {
      return reply.code(409).send({ error: "conversation_turn_conflict" });
    }
    await context.syncSessionRecord(sessionId);
    return reply.code(201).send(appended);
  });

  app.get("/api/sessions/:sessionId/events", async (request, reply) => {
    const auth = context.requireBrowserSession(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      connection: "keep-alive",
    });
    reply.raw.flushHeaders();
    const lastEventId = typeof request.headers["last-event-id"] === "string" ? request.headers["last-event-id"] : undefined;
    const events = context.events.replay(sessionId, lastEventId);
    const initialSnapshot = await context.sessions.read(sessionId);
    let heartbeat: NodeJS.Timeout | undefined;
    let snapshotPoll: NodeJS.Timeout | undefined;
    let lastSnapshotRevision = initialSnapshot?.revision;
    let readingSnapshot = false;
    let closed = false;
    let unsubscribe = (): void => undefined;
    const pendingWrites = new Set<() => void>();
    const cleanup = (): void => {
      if (closed) return;
      closed = true;
      if (heartbeat !== undefined) clearInterval(heartbeat);
      if (snapshotPoll !== undefined) clearInterval(snapshotPoll);
      unsubscribe();
      for (const resolveWrite of pendingWrites) resolveWrite();
      pendingWrites.clear();
      request.raw.off("close", cleanup);
      request.raw.off("aborted", cleanup);
      reply.raw.off("close", cleanup);
    };
    request.raw.once("close", cleanup);
    request.raw.once("aborted", cleanup);
    reply.raw.once("close", cleanup);
    const write = async (message: string): Promise<void> => {
      if (closed || reply.raw.destroyed || reply.raw.writableEnded) return;
      if (reply.raw.write(message)) return;
      await new Promise<void>((resolve) => {
        const finish = (): void => {
          reply.raw.off("drain", finish);
          pendingWrites.delete(finish);
          resolve();
        };
        pendingWrites.add(finish);
        reply.raw.once("drain", finish);
        if (closed || reply.raw.destroyed || reply.raw.writableEnded) finish();
      });
    };
    if (closed || request.raw.destroyed || reply.raw.destroyed) {
      cleanup();
      return reply;
    }
    await write(": heartbeat\n\n");
    await write(formatSseEvent("snapshot", sanitizeSsePayload(initialSnapshot ?? { sessionId })));
    if (events.length > 0) {
      for (const event of events) {
        await write(formatSseEvent(event.eventName, sanitizeSsePayload(event.payload), event.id));
      }
    }
    unsubscribe = context.events.subscribe(sessionId, (event) => {
      void write(formatSseEvent(event.eventName, sanitizeSsePayload(event.payload), event.id)).catch(() => cleanup());
    }, events.at(-1)?.id ?? lastEventId);
    if (!closed) {
      heartbeat = setInterval(() => {
        void write(": heartbeat\n\n").catch(() => cleanup());
      }, 15_000);
      snapshotPoll = setInterval(() => {
        if (readingSnapshot) return;
        readingSnapshot = true;
        void context.sessions.read(sessionId).then(async (snapshot) => {
          if (snapshot !== undefined && snapshot.revision !== lastSnapshotRevision) {
            lastSnapshotRevision = snapshot.revision;
            await write(formatSseEvent("snapshot", sanitizeSsePayload(snapshot)));
          }
        }).catch(() => cleanup()).finally(() => { readingSnapshot = false; });
      }, 500);
    }
    return reply;
  });
};

function nextConversationSequence(turns: readonly { readonly sequence: number }[]): number {
  return Math.max(0, ...turns.map((turn) => turn.sequence)) + 1;
}