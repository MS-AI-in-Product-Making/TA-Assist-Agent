import { conversationTurnSchema } from "@ai-assist/contracts";
import type { FastifyPluginAsync } from "fastify";

import { formatSseEvent, sanitizeSsePayload } from "../sse.js";
import type { WorkbenchServerContext } from "../server.js";

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

    return { turns: context.conversation.read(sessionId) };
  });

  app.post("/api/sessions/:sessionId/conversation", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    const parsed = conversationTurnSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.sessionId !== sessionId || auth.sessionId !== sessionId) {
      return reply.code(400).send({ error: "conversation_schema_rejected" });
    }

    return reply.code(201).send(context.conversation.append(parsed.data));
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
    const events = context.events.replay(sessionId, lastEventId).slice(-256);
    let heartbeat: NodeJS.Timeout | undefined;
    let closed = false;
    let unsubscribe = (): void => undefined;
    const pendingWrites = new Set<() => void>();
    const cleanup = (): void => {
      if (closed) return;
      closed = true;
      if (heartbeat !== undefined) clearInterval(heartbeat);
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
    unsubscribe = context.events.subscribe(sessionId, (event) => {
      void write(formatSseEvent(event.eventName, sanitizeSsePayload(event.payload), event.id)).catch(() => cleanup());
    });
    if (closed || request.raw.destroyed || reply.raw.destroyed) {
      cleanup();
      return reply;
    }
    await write(": heartbeat\n\n");
    if (events.length === 0) {
      await write(formatSseEvent("snapshot", sanitizeSsePayload(await context.sessions.read(sessionId) ?? { sessionId }), "snapshot"));
    } else {
      for (const event of events) {
        await write(formatSseEvent(event.eventName, sanitizeSsePayload(event.payload), event.id));
      }
    }
    if (!closed) {
      heartbeat = setInterval(() => {
        void write(": heartbeat\n\n").catch(() => cleanup());
      }, 15_000);
    }
    return reply;
  });
};