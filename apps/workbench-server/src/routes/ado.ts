import { f8AdoProjectionSchema, f8AdoWriteConfirmationSchema } from "@ai-assist/contracts";
import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

import type { WorkbenchServerContext } from "../server.js";
import { hasScope } from "../auth.js";

export const adoRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.get("/api/sessions/:sessionId/ado/pending", async (request, reply) => {
    const auth = context.requireAuthenticated(request, reply);
    if (auth === undefined || auth.kind !== "host" || !hasScope(auth, "sessions:read")) return reply.code(403).send({ error: "host_scope_rejected" });
    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) return reply.code(403).send({ error: "session_scope_rejected" });
    const turns = await context.conversation.read(sessionId);
    for (const turn of [...turns].reverse()) {
      if (turn.role !== "user") continue;
      const modelAction = await context.hostActions.readRecord(sessionId, `model:${turn.turnId}`);
      if (modelAction?.status === "pending") return reply.send({ actionId: modelAction.actionId, kind: "vscode_model_request" });
    }
    const snapshot = await context.sessions.read(sessionId);
    if (snapshot?.state !== "ado_action_pending") return reply.code(204).send();
    const revision = snapshot.revision;
    const writeActionId = `ado-write:${sessionId}:${revision}`;
    const validationActionId = `ado-validation:${sessionId}:${revision}`;
    const write = await context.hostActions.readRecord(sessionId, writeActionId);
    if (write?.status === "pending") return reply.send({ actionId: writeActionId, kind: "surface_write" });
    const validation = await context.hostActions.readRecord(sessionId, validationActionId);
    return validation?.status === "pending" ? reply.send({ actionId: validationActionId, kind: "surface_validate" }) : reply.code(204).send();
  });

  app.get("/api/sessions/:sessionId/ado", async (request, reply) => {
    const auth = context.requireBrowserSession(request, reply);
    if (auth === undefined) return reply;
    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) return reply.code(403).send({ error: "session_scope_rejected" });
    const snapshot = await context.sessions.read(sessionId);
    if (snapshot === undefined) return reply.code(404).send({ error: "session_not_found" });
    if (snapshot.state !== "ado_action_pending") {
      return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "not_required" }));
    }

    const validationActionId = `ado-validation:${sessionId}:${snapshot.revision}`;
    const writeActionId = `ado-write:${sessionId}:${snapshot.revision}`;
    const [validation, write] = await Promise.all([
      context.hostActions.readRecord(sessionId, validationActionId),
      context.hostActions.readRecord(sessionId, writeActionId),
    ]);
    if (write !== undefined) {
      const confirmation = write.request.kind === "surface_write" ? write.request.confirmation : undefined;
      const receipt = write.result?.payload.status === "completed" && write.result.payload.outcome?.kind === "surface_write"
        ? write.result.payload.outcome.receipt
        : undefined;
      if (confirmation !== undefined && receipt !== undefined) {
        return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "completed", actionId: writeActionId, validationActionId, expectedRevision: snapshot.revision, confirmation, receipt }));
      }
      if (confirmation !== undefined) {
        return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "write_pending", actionId: writeActionId, validationActionId, expectedRevision: snapshot.revision, confirmation }));
      }
    }

    const validationOutcome = validation?.result?.payload.status === "completed" && validation.result.payload.outcome?.kind === "surface_validation"
      ? validation.result.payload.outcome
      : undefined;
    if (validationOutcome !== undefined) {
      if (validation?.request.kind !== "surface_validate" || validation.expectedRevision !== snapshot.revision) return reply.code(409).send({ error: "ado_preview_stale" });
      const preview = await context.createAdoPreview(sessionId, validation.request.prepareRequest);
      if (!preview.matchesPrepareRequest || validationOutcome.confirmation.nextContent !== preview.markdown || validationOutcome.confirmation.factorCount !== preview.factorCount) return reply.code(409).send({ error: "ado_preview_stale" });
      return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "preview_ready", actionId: validationActionId, expectedRevision: snapshot.revision, target: preview.target, markdown: preview.markdown, contentHash: preview.contentHash, confirmation: validationOutcome.confirmation }));
    }
    const terminalReason = validation?.result?.payload.status === "blocked"
      ? validation.result.payload.reason ?? "Surface validation was blocked."
      : validation?.result?.payload.status === "failed"
        ? validation.result.payload.error.summary
        : undefined;
    if (terminalReason !== undefined) {
      return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: validation?.result?.payload.status === "blocked" ? "blocked" : "failed", actionId: validationActionId, expectedRevision: snapshot.revision, reason: terminalReason }));
    }
    return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "validation_pending", actionId: validationActionId, expectedRevision: snapshot.revision }));
  });

  app.post("/api/sessions/:sessionId/ado/confirm", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) return reply;
    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) return reply.code(403).send({ error: "session_scope_rejected" });
    const parsed = f8AdoWriteConfirmationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "ado_confirmation_schema_rejected" });
    const snapshot = await context.sessions.read(sessionId);
    if (snapshot?.state !== "ado_action_pending" || snapshot.revision !== parsed.data.expectedRevision) {
      return reply.code(409).send({ error: "ado_confirmation_stale" });
    }
    const validation = await context.hostActions.readRecord(sessionId, parsed.data.validationActionId);
    const outcome = validation?.result?.payload.status === "completed" && validation.result.payload.outcome?.kind === "surface_validation"
      ? validation.result.payload.outcome
      : undefined;
    if (validation?.request.kind !== "surface_validate" || validation.expectedRevision !== snapshot.revision || outcome === undefined || outcome.confirmation.confirmationHash !== parsed.data.confirmationHash) {
      return reply.code(409).send({ error: "ado_confirmation_mismatch" });
    }
    const preview = await context.createAdoPreview(sessionId, validation.request.prepareRequest);
    if (!preview.matchesPrepareRequest
      || JSON.stringify(preview.target) !== JSON.stringify(parsed.data.target)
      || preview.contentHash !== parsed.data.contentHash
      || outcome.confirmation.nextContent !== preview.markdown
      || createHash("sha256").update(outcome.confirmation.nextContent).digest("hex") !== parsed.data.contentHash) {
      return reply.code(409).send({ error: "ado_confirmation_mismatch" });
    }
    const actionId = `ado-write:${sessionId}:${snapshot.revision}`;
    const created = await context.hostActions.create({
      contractVersion: "f8-host-action-request-v1",
      actionId,
      sessionId,
      expectedRevision: snapshot.revision,
      kind: "surface_write",
      validationActionId: parsed.data.validationActionId,
      confirmationHash: outcome.confirmation.confirmationHash,
      expectedTargetVersion: validation.request.expectedTargetVersion,
      confirmation: outcome.confirmation,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    return created === undefined ? reply.code(409).send({ error: "host_action_id_conflict" }) : reply.code(201).send({ actionId });
  });
};
