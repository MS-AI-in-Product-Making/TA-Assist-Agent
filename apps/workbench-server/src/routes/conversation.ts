import { conversationTurnSchema } from "@ai-assist/contracts";
import type { FastifyPluginAsync } from "fastify";
import { once } from "node:events";

import { formatSseEvent, sanitizeSsePayload } from "../sse.js";
import type { WorkbenchServerContext } from "../server.js";

export const conversationRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.get("/api/sessions/:sessionId/conversation", async (request, reply) => {
    const auth = context.requireAuthenticated(request, reply);
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
    const auth = context.requireAuthenticated(request, reply);
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
    const write = async (message: string): Promise<void> => {
      if (!reply.raw.write(message)) await once(reply.raw, "drain");
    };
    let cleanup: () => void;
    const unsubscribe = context.events.subscribe(sessionId, (event) => {
      void write(formatSseEvent(event.eventName, sanitizeSsePayload(event.payload), event.id)).catch(() => cleanup());
    });
    await write(": heartbeat\n\n");
    if (events.length === 0) {
      await write(formatSseEvent("snapshot", sanitizeSsePayload(await context.sessions.read(sessionId) ?? { sessionId }), "snapshot"));
    } else {
      for (const event of events) {
        await write(formatSseEvent(event.eventName, sanitizeSsePayload(event.payload), event.id));
      }
    }
    const heartbeat = setInterval(() => {
      void write(": heartbeat\n\n").catch(() => cleanup());
    }, 15_000);
    cleanup = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
      request.raw.off("close", cleanup);
      request.raw.off("aborted", cleanup);
      reply.raw.off("close", cleanup);
    };
    request.raw.once("close", cleanup);
    request.raw.once("aborted", cleanup);
    reply.raw.once("close", cleanup);
    return reply;
  });
};