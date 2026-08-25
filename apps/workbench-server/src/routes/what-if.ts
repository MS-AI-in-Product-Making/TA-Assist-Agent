import { f8ScenarioDraftSchema, f8WhatIfCalculationRequestSchema } from "@ai-assist/contracts";
import type { FastifyPluginAsync } from "fastify";

import { errorStatusCode, safeErrorResponse } from "../security.js";
import type { WorkbenchServerContext } from "../server.js";

export const whatIfRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.post("/api/sessions/:sessionId/what-if/calculate", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) return reply;
    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) return reply.code(403).send({ error: "session_scope_rejected" });
    const input = f8WhatIfCalculationRequestSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: "what_if_schema_rejected" });
    try {
      return reply.code(200).send(f8ScenarioDraftSchema.parse(await context.calculateWhatIf(sessionId, input.data)));
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
  });
};
