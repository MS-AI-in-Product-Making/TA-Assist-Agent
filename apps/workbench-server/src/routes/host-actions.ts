import { conversationTurnSchema, hostActionClaimSchema, hostActionRequestSchema, hostActionResultSchema } from "@ai-assist/contracts";
import { detectUserLanguage, projectProductCapabilityReferences } from "@ai-assist/product-language";
import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

import { hasScope, hostBearerMatches } from "../auth.js";
import type { WorkbenchServerContext } from "../server.js";

export const hostActionsRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.post("/api/sessions/:sessionId/host-actions", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    const parsed = hostActionRequestSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.sessionId !== sessionId || auth.sessionId !== sessionId) {
      return reply.code(400).send({ error: "host_action_schema_rejected" });
    }

    const created = await context.hostActions.create(parsed.data);
    return created === undefined
      ? reply.code(409).send({ error: "host_action_id_conflict" })
      : reply.code(201).send(created);
  });

  app.post("/api/sessions/:sessionId/host-actions/:actionId/claim", async (request, reply) => {
    const auth = context.requireAuthenticated(request, reply);
    if (auth === undefined && request.headers.authorization !== undefined) {
      return reply.code(403).send({ error: "host_scope_rejected" });
    }

    if (auth === undefined || !hasScope(auth, "host-actions:claim")) {
      return reply.code(403).send({ error: "host_scope_rejected" });
    }

    const { sessionId, actionId } = request.params as { readonly sessionId: string; readonly actionId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    const hostInstanceId = readHostInstanceId(request.body);
    if (!hostBearerMatches(auth, actionId, hostInstanceId)) {
      return reply.code(403).send({ error: "host_scope_rejected" });
    }

    const claim = await context.hostActions.claim(sessionId, actionId, hostInstanceId);
    const parsed = hostActionClaimSchema.safeParse(claim);
    return parsed.success ? reply.send(parsed.data) : reply.code(409).send({ error: "host_action_not_claimable" });
  });

  app.post("/api/sessions/:sessionId/host-actions/:actionId/result", async (request, reply) => {
    const auth = context.requireAuthenticated(request, reply);
    if (auth === undefined || !hasScope(auth, "host-actions:result")) {
      return reply.code(403).send({ error: "host_scope_rejected" });
    }

    const { sessionId, actionId } = request.params as { readonly sessionId: string; readonly actionId: string };
    const parsed = hostActionResultSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.actionId !== actionId || auth.sessionId !== sessionId) {
      return reply.code(400).send({ error: "host_action_result_rejected" });
    }

    if (!hostBearerMatches(auth, actionId, parsed.data.hostInstanceId)) {
      return reply.code(400).send({ error: "host_action_result_rejected" });
    }

    if (parsed.data.resultHash !== createHash("sha256").update(JSON.stringify(parsed.data.payload)).digest("hex")) {
      return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
    }

    const action = await context.hostActions.read(sessionId, actionId);
    const submittedOutcome = parsed.data.payload.status === "completed" ? parsed.data.payload.outcome : undefined;
    if (parsed.data.status === "completed" && action?.kind === "surface_validate" && submittedOutcome?.kind !== "surface_validation") {
      return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
    }
    if (parsed.data.status === "completed" && action?.kind === "surface_write" && submittedOutcome?.kind !== "surface_write") {
      return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
    }
    if (parsed.data.status === "completed" && action?.kind === "vscode_model_request" && submittedOutcome?.kind !== "model_response") return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
    if (action?.kind === "surface_validate" && submittedOutcome?.kind === "surface_validation") {
      const confirmation = submittedOutcome.confirmation;
      const expectedConfirmationHash = createHash("sha256").update(JSON.stringify([
        confirmation.workItemReference,
        confirmation.commentReference,
        confirmation.expectedVersion,
        confirmation.nextContent,
      ])).digest("hex");
      if (confirmation.confirmationHash !== expectedConfirmationHash
        || confirmation.nextContent !== action.prepareRequest.nextContent
        || confirmation.factorCount !== action.prepareRequest.factorCount) {
        return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
      }
    }
    if (action?.kind === "surface_write" && submittedOutcome?.kind === "surface_write") {
      const expectedContentHash = createHash("sha256").update(action.confirmation.nextContent).digest("hex");
      if (submittedOutcome.receipt.contentHash !== expectedContentHash
        || submittedOutcome.receipt.workItemReference !== action.confirmation.workItemReference
        || submittedOutcome.receipt.commentReference !== action.confirmation.commentReference) {
        return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
      }
    }
    const completion = await context.hostActions.complete(sessionId, parsed.data);
    if (completion === "accepted") {
      const outcome = parsed.data.payload.status === "completed" ? parsed.data.payload.outcome : undefined;
      if (action?.kind === "surface_write" && outcome?.kind === "surface_write") {
        const snapshot = await context.sessions.read(sessionId);
        if (snapshot?.state !== "ado_action_pending" || snapshot.revision !== action.expectedRevision) {
          return reply.code(409).send({ error: "host_action_session_stale" });
        }
        const next = await context.sessions.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: `host-result:${actionId}`,
          expectedRevision: snapshot.revision,
          command: "accept_surface_write",
          payload: { actionId },
        });
        await context.enqueueActiveAttempt(next);
      }
      if (action?.kind === "vscode_model_request" && outcome?.kind === "model_response") {
        if (outcome.turnId !== action.turnId) return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
        const turns = await context.conversation.read(sessionId);
        const responseText = projectProductCapabilityReferences(outcome.responseText, detectUserLanguage(outcome.responseText));
        const turn = await context.conversation.append(conversationTurnSchema.parse({ contractVersion: "ta-conversation-turn-v1", turnId: `${action.turnId}:model`, sessionId, sequence: nextConversationSequence(turns), source: "vscode", role: "assistant", content: [{ kind: "text", text: responseText }], createdAt: new Date().toISOString(), relatedArtifactIds: [] }));
        context.events.publish(sessionId, "conversation_turn_appended", turn);
        await context.syncSessionRecord(sessionId);
      }
      return reply.code(204).send();
    }
    if (completion === "duplicate") return reply.code(409).send({ error: "host_action_result_replayed" });
    return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
  });
};

function readHostInstanceId(body: unknown): string {
  const candidate = (body as { readonly hostInstanceId?: unknown } | undefined)?.hostInstanceId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : "host";
}

function nextConversationSequence(turns: readonly { readonly sequence: number }[]): number {
  return Math.max(0, ...turns.map((turn) => turn.sequence)) + 1;
}