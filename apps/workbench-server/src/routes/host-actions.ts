import { hostActionClaimSchema, hostActionRequestSchema, hostActionResultSchema } from "@ai-assist/contracts";
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

    return reply.code(201).send(context.hostActions.create(parsed.data));
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

    const claim = context.hostActions.claim(sessionId, actionId, hostInstanceId);
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

    const completion = context.hostActions.complete(sessionId, parsed.data);
    if (completion === "accepted") return reply.code(204).send();
    if (completion === "duplicate") return reply.code(409).send({ error: "host_action_result_replayed" });
    return reply.code(400).send({ error: "host_action_result_integrity_rejected" });
  });
};

function readHostInstanceId(body: unknown): string {
  const candidate = (body as { readonly hostInstanceId?: unknown } | undefined)?.hostInstanceId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : "host";
}