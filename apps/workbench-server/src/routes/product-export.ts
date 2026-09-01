import type { FastifyPluginAsync } from "fastify";

import { errorStatusCode, safeErrorResponse } from "../security.js";
import type { WorkbenchServerContext } from "../server.js";
import { taProductExportCommandSchema } from "@ai-assist/contracts";

import { exportTaAnalysisForSession } from "../ta-product-exporter.js";

export const productExportRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.post("/api/sessions/:sessionId/product-export", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) return reply;

    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) return reply.code(403).send({ error: "session_scope_rejected" });

    try {
      const parsed = taProductExportCommandSchema.safeParse(request.body);
      if (!parsed.success || parsed.data.sessionId !== sessionId) {
        return reply.code(400).send({ error: "product_export_schema_rejected" });
      }
      const exported = await exportTaAnalysisForSession(parsed.data, { rootDir: context.rootDir });
      return reply.code(200).send(exported);
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
  });
};
