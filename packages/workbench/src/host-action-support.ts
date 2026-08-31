import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  createTypedError,
  hostActionClaimSchema,
  hostActionRequestSchema,
  hostActionResultSchema,
} from "@ai-assist/contracts";

export type HostActionRequest = ReturnType<typeof hostActionRequestSchema.parse>;
export type HostActionClaim = ReturnType<typeof hostActionClaimSchema.parse>;
export type HostActionResult = ReturnType<typeof hostActionResultSchema.parse>;

export type HostActionStatus = "pending" | "claimed" | "completed" | "blocked" | "failed";

export interface HostActionRow {
  readonly session_id: string;
  readonly status: HostActionStatus;
  readonly request_json: string | null;
  readonly claim_json: string | null;
  readonly result_json: string | null;
  readonly expires_at: string | null;
  readonly lease_id: string | null;
  readonly lease_expires_at: string | null;
  readonly expected_revision: number | null;
  readonly confirmation_hash: string | null;
  readonly expected_target_version: string | null;
}

export function validateCreateRequest(request: HostActionRequest, now: Date): void {
  if (Date.parse(request.expiresAt) <= now.getTime()) {
    throw createTypedError({
      code: "validation_error",
      summary: `Host action ${request.actionId} expires in the past.`,
      suggestedAction: "Provide a future expiresAt for the host action request.",
      affectedInputReferences: [request.actionId],
    });
  }
}

export function enforceClaimable(row: HostActionRow, request: HostActionRequest, now: Date): void {
  if (isTerminalStatus(row.status)) {
    throw createTypedError({
      code: "policy_denied",
      summary: `Host action ${request.actionId} already reached terminal status ${row.status}.`,
      suggestedAction: "Create a new host action instead of reusing a finished one.",
      affectedInputReferences: [request.actionId],
    });
  }

  if (row.status === "claimed") {
    throw createTypedError({
      code: "prerequisite_not_ready",
      summary: `Host action ${request.actionId} is already owned by another host lease.`,
      suggestedAction: isExpired(row.lease_expires_at, now)
        ? "Expire the claimed host action before attempting any new write or validation action."
        : "Wait for the current host lease to complete or expire.",
      affectedInputReferences: [request.actionId],
    });
  }

  if (isExpired(row.expires_at, now)) {
    throw createTypedError({
      code: "prerequisite_not_ready",
      summary: `Host action ${request.actionId} request expired before a host claimed it.`,
      suggestedAction: "Create a fresh host action request with a new actionId and future expiry.",
      affectedInputReferences: [request.actionId],
    });
  }
}

export function ensureWriteValidationMatches(
  row: HostActionRow | undefined,
  request: Extract<HostActionRequest, { kind: "surface_write" }>,
  actionId: string,
): void {
  if (row === undefined || row.request_json === null || row.result_json === null) {
    throw createMissingValidationError(actionId, request.validationActionId);
  }

  const validationRequest = hostActionRequestSchema.parse(parseJson(row.request_json));
  const validationResult = hostActionResultSchema.parse(parseJson(row.result_json));

  if (validationRequest.kind !== "surface_validate" || validationResult.status !== "completed") {
    throw createMissingValidationError(actionId, request.validationActionId);
  }

  const outcome = validationResult.payload.status === "completed" ? validationResult.payload.outcome : undefined;
  if (outcome?.kind !== "surface_validation") {
    throw createMissingValidationError(actionId, request.validationActionId);
  }

  if (validationRequest.expectedTargetVersion !== request.expectedTargetVersion
    || stableStringify(outcome.confirmation) !== stableStringify(request.confirmation)
    || outcome.confirmation.confirmationHash !== request.confirmationHash) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: `Surface write action ${actionId} does not match validation action ${request.validationActionId}.`,
      suggestedAction: "Create a fresh validation action and bind the write request to the exact returned confirmation hash and target version.",
      affectedInputReferences: [actionId, request.validationActionId],
    });
  }
}

export function ensureExpectedRevisionCurrent(expectedRevision: number, liveRevision: number, actionId: string): void {
  if (liveRevision !== expectedRevision) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: `Host action ${actionId} expected revision ${expectedRevision}, found ${liveRevision}.`,
      suggestedAction: "Refresh the session snapshot and create a new host action at the latest revision.",
      affectedInputReferences: [actionId],
    });
  }
}

export function parseStoredRequest(row: HostActionRow, actionId: string): HostActionRequest {
  if (row.request_json === null) {
    throw createTypedError({
      code: "internal_error",
      summary: `Host action ${actionId} is missing its request payload.`,
      suggestedAction: "Recreate the host action because its stored request is incomplete.",
      affectedInputReferences: [actionId],
    });
  }
  return hostActionRequestSchema.parse(parseJson(row.request_json));
}

export function parseStoredClaim(row: HostActionRow, actionId: string): HostActionClaim {
  if (row.claim_json === null) {
    throw createTypedError({
      code: "internal_error",
      summary: `Host action ${actionId} is missing its claim payload.`,
      suggestedAction: "Reclaim the host action with a fresh lease before continuing.",
      affectedInputReferences: [actionId],
    });
  }
  return hostActionClaimSchema.parse(parseJson(row.claim_json));
}

export function parseStoredResult(row: HostActionRow, actionId: string): HostActionResult {
  if (row.result_json === null) {
    throw createTypedError({
      code: "internal_error",
      summary: `Host action ${actionId} is missing its terminal result payload.`,
      suggestedAction: "Recreate the host action because its stored terminal result is incomplete.",
      affectedInputReferences: [actionId],
    });
  }
  return hostActionResultSchema.parse(parseJson(row.result_json));
}

export function createExpiredResult(request: HostActionRequest, claim: HostActionClaim, now: Date): HostActionResult {
  const reason = request.kind === "surface_write"
    ? "Write lease expired; manual reconciliation is required before any new Surface write action."
    : "Host action lease expired before completion.";

  return hostActionResultSchema.parse({
    contractVersion: "f8-host-action-result-v1",
    actionId: request.actionId,
    hostInstanceId: claim.hostInstanceId,
    leaseId: claim.leaseId,
    status: "blocked",
    resultHash: sha256(stableStringify({
      actionId: request.actionId,
      hostInstanceId: claim.hostInstanceId,
      leaseId: claim.leaseId,
      reason,
      expiredAt: toIso(now),
    })),
    payload: {
      status: "blocked",
      reason,
    },
  });
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

export function isTerminalStatus(status: HostActionStatus): status is "completed" | "blocked" | "failed" {
  return status === "completed" || status === "blocked" || status === "failed";
}

export function isExpired(timestamp: string | null, now: Date): boolean {
  return timestamp !== null && Date.parse(timestamp) <= now.getTime();
}

export function ensureSessionId(actual: string, expected: string, actionId: string): void {
  if (actual !== expected) {
    throw createTypedError({
      code: "validation_error",
      summary: `Host action ${actionId} targets ${actual}, expected ${expected}.`,
      suggestedAction: "Submit the host action against the matching session.",
      affectedInputReferences: [actionId, expected],
    });
  }
}

export function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw createTypedError({
      code: "validation_error",
      summary: `${label} must not be empty.`,
      suggestedAction: `Provide a non-empty ${label}.`,
      affectedInputReferences: [label],
    });
  }
}

export function toIso(date: Date): string {
  return new Date(date.getTime()).toISOString();
}

export function rollbackQuietly(database: DatabaseSync): void {
  try {
    database.exec("ROLLBACK");
  } catch {
    // Ignore rollback failures after the primary error.
  }
}

function createMissingValidationError(actionId: string, validationActionId: string) {
  return createTypedError({
    code: "prerequisite_not_ready",
    summary: `Surface write action ${actionId} is missing completed validation action ${validationActionId}.`,
    suggestedAction: "Complete the exact same-session Surface validation action first, then claim the write action.",
    affectedInputReferences: [actionId, validationActionId],
  });
}

function parseJson(json: string): unknown {
  return JSON.parse(json) as unknown;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}