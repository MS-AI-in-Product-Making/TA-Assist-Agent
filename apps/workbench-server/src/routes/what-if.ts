import { f8ScenarioDraftSchema, f8WhatIfCalculationRequestSchema, f8WorksheetWhatIfCalculationRequestSchema } from "@ai-assist/contracts";
import type { FastifyPluginAsync } from "fastify";

import { errorStatusCode, safeErrorResponse } from "../security.js";
import type { WorkbenchServerContext } from "../server.js";

export const whatIfRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.post("/api/sessions/:sessionId/what-if/calculate-worksheet", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) return reply;
    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) return reply.code(403).send({ error: "session_scope_rejected" });
    const input = f8WorksheetWhatIfCalculationRequestSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: "what_if_schema_rejected" });
    try { return reply.send(f8ScenarioDraftSchema.parse(await context.calculateWorksheetWhatIf(sessionId, input.data))); }
    catch (error) { return reply.code(errorStatusCode(error)).send(safeErrorResponse(error)); }
  });

  app.post("/api/sessions/:sessionId/what-if/calculate", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) return reply;
    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) return reply.code(403).send({ error: "session_scope_rejected" });
    const input = f8WhatIfCalculationRequestSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: "what_if_schema_rejected" });
    try {
      return reply.code(200).send(f8ScenarioDraftSchema.parse(await context.calculateWhatIf(sessionId, {
        draftId: input.data.draftId,
        worksheetName: input.data.worksheetName,
        tableId: input.data.tableId,
        sourceRow: input.data.sourceRow,
        inputRevision: input.data.inputRevision,
        patch: input.data.patch,
        ...(input.data.signedDirectionEvidence === true ? { signedDirectionEvidence: true } : {}),
      })));
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
  });
};
