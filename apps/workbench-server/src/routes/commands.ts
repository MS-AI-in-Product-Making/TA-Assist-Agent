import { f8SessionCommandSchema } from "@ai-assist/contracts";
import type { FastifyPluginAsync } from "fastify";

import type { WorkbenchServerContext } from "../server.js";

export const commandsRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.post("/api/sessions/:sessionId/commands", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    const parsed = f8SessionCommandSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.sessionId !== sessionId) {
      return reply.code(400).send({ error: "command_schema_rejected" });
    }

    const snapshot = context.sessions.applyCommand(parsed.data);
    return reply.code(202).send(snapshot);
  });
};