import { randomUUID } from "node:crypto";

import type { FastifyPluginAsync } from "fastify";

import type { WorkbenchServerContext } from "../server.js";

export const sessionsRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.post("/api/sessions", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const sessionId = randomUUID();
    const snapshot = context.sessions.create(sessionId);
    return reply.code(201).send(snapshot);
  });

  app.get("/api/sessions/:sessionId", async (request, reply) => {
    const auth = context.requireAuthenticated(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    return context.sessions.read(sessionId) ?? reply.code(404).send({ error: "session_not_found" });
  });
};