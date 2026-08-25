import { conversationTurnSchema } from "@ai-assist/contracts";
import type { FastifyPluginAsync } from "fastify";

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

    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      connection: "keep-alive",
    });
    reply.raw.end(formatSseEvent("snapshot", sanitizeSsePayload(context.sessions.read(sessionId) ?? { sessionId })));
    return reply;
  });
};