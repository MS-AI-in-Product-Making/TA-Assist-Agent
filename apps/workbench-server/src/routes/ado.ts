import { f8AdoProjectionSchema, f8AdoWriteConfirmationSchema } from "@ai-assist/contracts";
import type { F8SessionCommand } from "@ai-assist/workbench";
import { createHash, randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

import type { WorkbenchServerContext } from "../server.js";
import { hasScope } from "../auth.js";
import { sanitizePromptVisibleText } from "../prompt-sanitizer.js";
import { errorStatusCode, safeErrorResponse } from "../security.js";

const DEFAULT_LEASE_MS = 15 * 60_000;
let adoRouteClock: () => number = () => Date.now();

export function setAdoRouteClockForTest(clock: (() => number) | undefined): void {
  adoRouteClock = clock ?? (() => Date.now());
}

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
    const reconcileActionId = `ado-reconcile:${sessionId}:${revision}`;
    const reconcile = await context.hostActions.readRecord(sessionId, reconcileActionId);
    if (reconcile?.status === "pending") return reply.send({ actionId: reconcileActionId, kind: "surface_reconcile" });
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
    const reconcileActionId = `ado-reconcile:${sessionId}:${snapshot.revision}`;
    const [validation, write, reconcile] = await Promise.all([
      context.hostActions.readRecord(sessionId, validationActionId),
      context.hostActions.readRecord(sessionId, writeActionId),
      context.hostActions.readRecord(sessionId, reconcileActionId),
    ]);
    if (write !== undefined) {
      const confirmation = write.request.kind === "surface_write" ? write.request.confirmation : undefined;
      const previewIdentity = confirmation === undefined ? undefined : previewIdentityFromConfirmation(confirmation);
      const receipt = write.result?.payload.status === "completed" && write.result.payload.outcome?.kind === "surface_write"
        ? write.result.payload.outcome.receipt
        : undefined;
      if (confirmation !== undefined && receipt !== undefined) {
        return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "completed", actionId: writeActionId, validationActionId, expectedRevision: snapshot.revision, executionPhase: "reconcile", confirmation, receipt }));
      }
      if (confirmation !== undefined && reconcile !== undefined) {
        const reconcileOutcome = reconcile.result?.payload.status === "completed" && reconcile.result.payload.outcome?.kind === "surface_reconcile"
          ? reconcile.result.payload.outcome
          : undefined;
        if (reconcileOutcome?.state === "matching") {
          return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "completed", actionId: writeActionId, validationActionId, expectedRevision: snapshot.revision, executionPhase: "reconcile", confirmation, receipt: reconcileOutcome.receipt }));
        }
        if (reconcileOutcome?.state === "absent" && previewIdentity !== undefined) {
          return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "reconciled_absent", actionId: reconcileActionId, writeActionId, validationActionId, expectedRevision: snapshot.revision, executionPhase: "reconcile", previewIdentity, confirmation }));
        }
        const reconcileTerminal = terminalProjection(reconcile.result?.payload, "reconcile");
        if (reconcileTerminal !== undefined) {
          return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: reconcileTerminal.state, actionId: reconcileActionId, expectedRevision: snapshot.revision, reason: reconcileTerminal.reason }));
        }
      }
      const writeTerminal = terminalProjection(write.result?.payload, "write");
      if (confirmation !== undefined && writeTerminal !== undefined) {
        return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: writeTerminal.state, actionId: writeActionId, expectedRevision: snapshot.revision, reason: writeTerminal.reason }));
      }
      if (confirmation !== undefined && write.status === "claimed") {
        if (hasActiveLease(write.leaseExpiresAt, adoRouteClock())) {
          return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "write_pending", actionId: writeActionId, validationActionId, expectedRevision: snapshot.revision, executionPhase: "execute_write", ...pendingTiming(write.leaseExpiresAt), confirmation }));
        }
        if (write.dispatchedAt === undefined) {
          return reply.send(f8AdoProjectionSchema.parse({
            contractVersion: "f8-ado-projection-v1",
            sessionId,
            state: "blocked",
            actionId: writeActionId,
            expectedRevision: snapshot.revision,
            reason: "Surface write dispatch timestamp is unavailable for reconciliation.",
          }));
        }
        return reply.send(f8AdoProjectionSchema.parse({
          contractVersion: "f8-ado-projection-v1",
          sessionId,
          state: "write_outcome_unknown",
          actionId: writeActionId,
          validationActionId,
          expectedRevision: snapshot.revision,
          executionPhase: "readback",
          previewIdentity: previewIdentity ?? previewIdentityFromConfirmation(confirmation),
          writeDispatchedAt: write.dispatchedAt,
          confirmation,
        }));
      }
      if (confirmation !== undefined && write.status === "pending") {
        return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "write_pending", actionId: writeActionId, validationActionId, expectedRevision: snapshot.revision, executionPhase: "execute_write", ...pendingTiming(write.expiresAt), confirmation }));
      }
    }

    if (validation === undefined) {
      return reply.send(f8AdoProjectionSchema.parse({
        contractVersion: "f8-ado-projection-v1",
        sessionId,
        state: "blocked",
        actionId: validationActionId,
        expectedRevision: snapshot.revision,
        reason: "Surface validation action is unavailable.",
      }));
    }

    const validationOutcome = validation?.result?.payload.status === "completed" && validation.result.payload.outcome?.kind === "surface_validation"
      ? validation.result.payload.outcome
      : undefined;
    if (validationOutcome !== undefined) {
      if (validation?.request.kind !== "surface_validate" || validation.expectedRevision !== snapshot.revision) return reply.code(409).send({ error: "ado_preview_stale" });
      const preview = await context.createAdoPreview(sessionId, validation.request.prepareRequest);
      if (!preview.matchesPrepareRequest || validationOutcome.confirmation.nextContent !== preview.markdown || validationOutcome.confirmation.factorCount !== preview.factorCount) return reply.code(409).send({ error: "ado_preview_stale" });
      return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "preview_ready", actionId: validationActionId, expectedRevision: snapshot.revision, executionPhase: "prepare_preview", target: preview.target, markdown: preview.markdown, contentHash: preview.contentHash, confirmation: validationOutcome.confirmation }));
    }
    const validationTerminal = terminalProjection(validation.result?.payload, "validation");
    if (validationTerminal !== undefined) {
      return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: validationTerminal.state, actionId: validationActionId, expectedRevision: snapshot.revision, reason: validationTerminal.reason }));
    }
    return reply.send(f8AdoProjectionSchema.parse({ contractVersion: "f8-ado-projection-v1", sessionId, state: "validation_pending", actionId: validationActionId, expectedRevision: snapshot.revision, executionPhase: "validate_target", ...pendingTiming(validation.expiresAt) }));
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
      expiresAt: new Date(adoRouteClock() + DEFAULT_LEASE_MS).toISOString(),
    });
    return created === undefined ? reply.code(409).send({ error: "host_action_id_conflict" }) : reply.code(201).send({ actionId });
  });

  app.post("/api/sessions/:sessionId/ado/reconcile", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) return reply;
    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) return reply.code(403).send({ error: "session_scope_rejected" });

    const snapshot = await context.sessions.read(sessionId);
    if (snapshot?.state !== "ado_action_pending") return reply.code(409).send({ error: "ado_reconcile_stale" });

    const writeActionId = `ado-write:${sessionId}:${snapshot.revision}`;
    const validationActionId = `ado-validation:${sessionId}:${snapshot.revision}`;
    const reconcileActionId = `ado-reconcile:${sessionId}:${snapshot.revision}`;
    const write = await context.hostActions.readRecord(sessionId, writeActionId);
    if (write?.request.kind !== "surface_write" || write.status !== "claimed" || write.result !== undefined || hasActiveLease(write.leaseExpiresAt, adoRouteClock())) {
      return reply.code(409).send({ error: "ado_reconcile_unavailable" });
    }

    const confirmation = write.request.confirmation;
    const previewIdentity = previewIdentityFromConfirmation(confirmation);
    const reconcileRequest = {
      contractVersion: "f8-host-action-request-v1",
      actionId: reconcileActionId,
      sessionId,
      expectedRevision: snapshot.revision,
      kind: "surface_reconcile",
      writeActionId,
      validationActionId,
      confirmationHash: write.request.confirmationHash,
      expectedTargetVersion: write.request.expectedTargetVersion,
      previewIdentity,
      confirmation,
      expiresAt: new Date(adoRouteClock() + DEFAULT_LEASE_MS).toISOString(),
    } as const;

    const existing = await context.hostActions.readRecord(sessionId, reconcileActionId);
    if (existing !== undefined) {
      if (!isSameReconcileIdentity(existing, reconcileRequest)) {
        return reply.code(409).send({ error: "ado_reconcile_identity_mismatch" });
      }
      return reply.code(existing.status === "pending" || existing.status === "claimed" ? 202 : 200).send({ actionId: reconcileActionId, status: existing.status });
    }

    const created = await context.hostActions.create(reconcileRequest);

    if (created === undefined) {
      const reloaded = await context.hostActions.readRecord(sessionId, reconcileActionId);
      if (reloaded !== undefined) {
        if (!isSameReconcileIdentity(reloaded, reconcileRequest)) {
          return reply.code(409).send({ error: "ado_reconcile_identity_mismatch" });
        }
        return reply.code(reloaded.status === "pending" || reloaded.status === "claimed" ? 202 : 200).send({ actionId: reconcileActionId, status: reloaded.status });
      }
      return reply.code(409).send({ error: "host_action_id_conflict" });
    }

    return reply.code(202).send({ actionId: reconcileActionId, status: "pending" });
  });

  app.post("/api/sessions/:sessionId/ado/start-new-write-generation", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) return reply;
    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) return reply.code(403).send({ error: "session_scope_rejected" });

    const snapshot = await context.sessions.read(sessionId);
    if (snapshot?.state !== "ado_action_pending") return reply.code(409).send({ error: "ado_generation_stale" });

    const revision = snapshot.revision;
    const writeActionId = `ado-write:${sessionId}:${revision}`;
    const validationActionId = `ado-validation:${sessionId}:${revision}`;
    const reconcileActionId = `ado-reconcile:${sessionId}:${revision}`;
    const [write, validation, reconcile] = await Promise.all([
      context.hostActions.readRecord(sessionId, writeActionId),
      context.hostActions.readRecord(sessionId, validationActionId),
      context.hostActions.readRecord(sessionId, reconcileActionId),
    ]);
    const reconcileOutcome = reconcile?.result?.payload.status === "completed" && reconcile.result.payload.outcome?.kind === "surface_reconcile"
      ? reconcile.result.payload.outcome
      : undefined;
    if (
      write?.request.kind !== "surface_write"
      || write.status !== "claimed"
      || write.result !== undefined
      || hasActiveLease(write.leaseExpiresAt, adoRouteClock())
      || validation?.request.kind !== "surface_validate"
      || reconcileOutcome?.state !== "absent"
    ) {
      return reply.code(409).send({ error: "ado_new_generation_unavailable" });
    }

    try {
      const decisionPayload = validation.request.prepareRequest.mode === "existing"
        ? { decision: "use_existing" as const, workItemReference: validation.request.prepareRequest.workItemReference }
        : { decision: "create_new" as const, title: validation.request.prepareRequest.title, sponsorEmail: validation.request.prepareRequest.sponsorEmail };

      const resetCommand: F8SessionCommand = {
        contractVersion: "f8-session-command-v1",
        sessionId,
        commandId: `start-new-generation-reset-${randomUUID()}`,
        expectedRevision: revision,
        command: "reset_ado_decision",
        payload: {},
      };
      const resetSnapshot = await context.sessions.applyCommand(resetCommand);
      const regenerateCommand: F8SessionCommand = {
        contractVersion: "f8-session-command-v1",
        sessionId,
        commandId: `start-new-generation-confirm-${randomUUID()}`,
        expectedRevision: resetSnapshot.revision,
        command: "confirm_ado_decision",
        payload: decisionPayload,
      };
      const nextSnapshot = await context.sessions.applyCommand(regenerateCommand);
      const nextValidationActionId = `ado-validation:${sessionId}:${nextSnapshot.revision}`;
      const regeneratedPrepareRequest = validation.request.prepareRequest.mode === "create"
        ? { ...validation.request.prepareRequest, workItemReference: write.request.confirmation.workItemReference }
        : validation.request.prepareRequest;
      const confirmationHash = createHash("sha256").update(JSON.stringify(regeneratedPrepareRequest)).digest("hex");
      const created = await context.hostActions.create({
        contractVersion: "f8-host-action-request-v1",
        actionId: nextValidationActionId,
        sessionId,
        expectedRevision: nextSnapshot.revision,
        kind: "surface_validate",
        confirmationHash,
        expectedTargetVersion: validation.request.expectedTargetVersion,
        prepareRequest: regeneratedPrepareRequest,
        expiresAt: new Date(adoRouteClock() + DEFAULT_LEASE_MS).toISOString(),
      });
      if (created === undefined) {
        return reply.code(409).send({ error: "host_action_id_conflict" });
      }
      await context.syncSessionRecord(sessionId);
      return reply.code(202).send((await context.sessions.read(sessionId)) ?? nextSnapshot);
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
  });
};

function pendingTiming(expiresAt: string | undefined): { readonly startedAt: string; readonly expiresAt: string } {
  const effectiveExpiresAt = expiresAt ?? new Date(adoRouteClock() + DEFAULT_LEASE_MS).toISOString();
  return {
    startedAt: new Date(Date.parse(effectiveExpiresAt) - DEFAULT_LEASE_MS).toISOString(),
    expiresAt: effectiveExpiresAt,
  };
}

function terminalProjection(
  payload: { readonly status: "completed" | "blocked" | "failed"; readonly reason?: string | undefined; readonly error?: { readonly summary?: string | undefined } | undefined } | undefined,
  stage: "validation" | "write" | "reconcile",
): { readonly state: "blocked" | "failed"; readonly reason: string } | undefined {
  if (payload?.status === "blocked") {
    const fallback = stage === "write" ? "Surface write was blocked." : stage === "reconcile" ? "Surface readback reconciliation was blocked." : "Surface validation was blocked.";
    return { state: "blocked", reason: sanitizeReason(payload.reason, fallback) };
  }
  if (payload?.status === "failed") {
    const fallback = stage === "write" ? "Surface write failed." : stage === "reconcile" ? "Surface readback reconciliation failed." : "Surface validation failed.";
    return { state: "failed", reason: sanitizeReason(payload.error?.summary, fallback) };
  }
  return undefined;
}

function sanitizeReason(reason: string | undefined, fallback: string): string {
  const sanitized = sanitizePromptVisibleText(reason)?.replace(/[\r\n]+/g, " ").trim();
  return sanitized === undefined || sanitized.length === 0 ? fallback : sanitized;
}

function previewIdentityFromConfirmation(confirmation: {
  readonly workItemReference: string;
  readonly nextContent: string;
}): {
  readonly targetIdentity: { readonly organization: string; readonly project: string; readonly workItemId: number };
  readonly previewHash: string;
  readonly previewMarker: string;
} {
  let organization = "unknown-organization";
  let project = "unknown-project";
  let workItemId = 1;
  try {
    const url = new URL(confirmation.workItemReference);
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const markerIndex = segments.findIndex((segment, index) => segment.toLowerCase() === "_workitems" && segments[index + 1]?.toLowerCase() === "edit");
    const parsedId = markerIndex < 0 ? Number.NaN : Number(segments[markerIndex + 2]);
    const parsedOrganization = url.hostname.toLowerCase() === "dev.azure.com" ? segments[0] : url.hostname.split(".")[0];
    const parsedProject = url.hostname.toLowerCase() === "dev.azure.com" ? segments[1] : segments[0];
    organization = typeof parsedOrganization === "string" && parsedOrganization.length > 0 ? parsedOrganization : organization;
    project = typeof parsedProject === "string" && parsedProject.length > 0 ? parsedProject : project;
    workItemId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : workItemId;
  } catch {
    // Non-URL references are allowed in some fixtures; keep deterministic fallback identity.
  }
  const markerMatch = /<!--\s*([^>]+)\s*-->/.exec(confirmation.nextContent);
  const previewMarker = markerMatch?.[1]?.trim() ?? "preview-marker:unknown";
  return {
    targetIdentity: {
      organization,
      project,
      workItemId,
    },
    previewHash: createHash("sha256").update(confirmation.nextContent).digest("hex"),
    previewMarker,
  };
}

function hasActiveLease(leaseExpiresAt: string | undefined, nowMs: number): boolean {
  if (leaseExpiresAt === undefined) return true;
  const expiresAt = Date.parse(leaseExpiresAt);
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt > nowMs;
}

function isSameReconcileIdentity(
  existing: { readonly request: unknown },
  expected: {
    readonly writeActionId: string;
    readonly validationActionId: string;
    readonly confirmationHash: string;
    readonly expectedTargetVersion: string;
    readonly previewIdentity: {
      readonly targetIdentity: { readonly organization: string; readonly project: string; readonly workItemId: number };
      readonly previewHash: string;
      readonly previewMarker: string;
    };
  },
): boolean {
  const request = existing.request;
  if (typeof request !== "object" || request === null || (request as { kind?: unknown }).kind !== "surface_reconcile") {
    return false;
  }
  const reconcileRequest = request as {
    writeActionId?: unknown;
    validationActionId?: unknown;
    confirmationHash?: unknown;
    expectedTargetVersion?: unknown;
    previewIdentity?: {
      targetIdentity?: { organization?: unknown; project?: unknown; workItemId?: unknown };
      previewHash?: unknown;
      previewMarker?: unknown;
    };
  };
  const targetIdentity = reconcileRequest.previewIdentity?.targetIdentity;
  return reconcileRequest.writeActionId === expected.writeActionId
    && reconcileRequest.validationActionId === expected.validationActionId
    && reconcileRequest.confirmationHash === expected.confirmationHash
    && reconcileRequest.expectedTargetVersion === expected.expectedTargetVersion
    && targetIdentity?.organization === expected.previewIdentity.targetIdentity.organization
    && targetIdentity?.project === expected.previewIdentity.targetIdentity.project
    && targetIdentity?.workItemId === expected.previewIdentity.targetIdentity.workItemId
    && reconcileRequest.previewIdentity?.previewHash === expected.previewIdentity.previewHash
    && reconcileRequest.previewIdentity?.previewMarker === expected.previewIdentity.previewMarker;
}
