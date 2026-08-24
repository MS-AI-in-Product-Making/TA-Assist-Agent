import { createTypedError, type TypedError } from "@ai-assist/contracts";

import { isRunningState, type F8SessionSnapshot, type F8SessionState } from "./commands.js";

export interface SessionAttemptResult {
  readonly attemptId: string;
  readonly status?: "completed" | "failed" | "cancelled";
  readonly result: unknown;
  readonly endedAt?: string;
}

interface SnapshotMeta {
  readonly retryable?: boolean;
}

const snapshotMeta = new WeakMap<F8SessionSnapshot, SnapshotMeta>();


export function createRunningAttempt(stage: F8SessionState, commandId: string) {
  if (!isRunningState(stage)) {
    throw createTypedError({
      code: "validation_error",
      summary: `Cannot create an attempt for non-running state ${stage}.`,
      suggestedAction: "Start attempts only for running session states.",
      affectedInputReferences: [stage, commandId],
    });
  }

  return {
    attemptId: `${commandId}:${stage}`,
    stage,
    status: "running" as const,
    commandId,
    startedAt: new Date().toISOString(),
  };
}

export function attemptMatchesActiveAttempt(snapshot: F8SessionSnapshot, attemptId: string): boolean {
  return snapshot.activeAttempt?.attemptId === attemptId;
}

export function canRetryAttempt(snapshot: F8SessionSnapshot): boolean {
  if (snapshot.state === "cancelled") {
    return snapshot.activeAttempt !== null;
  }

  if (snapshot.state === "failed") {
    return snapshotMeta.get(snapshot)?.retryable === true;
  }

  return false;
}

export function annotateSnapshot<TSnapshot extends F8SessionSnapshot>(
  snapshot: TSnapshot,
  meta: SnapshotMeta | undefined,
): TSnapshot {
  if (meta !== undefined) {
    snapshotMeta.set(snapshot, meta);
  }

  return snapshot;
}

export function deriveRetryable(result: unknown): boolean {
  const typedError = extractTypedError(result);
  return typedError?.retryable === true;
}

export function extractTypedError(result: unknown): TypedError | undefined {
  if (typeof result !== "object" || result === null) {
    return undefined;
  }

  const candidate = (result as { error?: unknown }).error;
  if (typeof candidate !== "object" || candidate === null) {
    return undefined;
  }

  if (
    typeof (candidate as { code?: unknown }).code === "string"
    && typeof (candidate as { runId?: unknown }).runId === "string"
    && typeof (candidate as { summary?: unknown }).summary === "string"
    && typeof (candidate as { retryable?: unknown }).retryable === "boolean"
    && typeof (candidate as { suggestedAction?: unknown }).suggestedAction === "string"
    && Array.isArray((candidate as { affectedInputReferences?: unknown }).affectedInputReferences)
  ) {
    return candidate as TypedError;
  }

  return undefined;
}

export function resolveRetryStage(snapshot: F8SessionSnapshot, requestedStage: F8SessionState | undefined): F8SessionState {
  const resolvedStage = requestedStage ?? snapshot.activeAttempt?.stage;
  if (resolvedStage === undefined || !isRunningState(resolvedStage)) {
    throw createTypedError({
      code: "validation_error",
      summary: "Retry requires a previously running stage.",
      suggestedAction: "Retry the most recent running attempt or restart from a valid decision point.",
      affectedInputReferences: [snapshot.sessionId],
    });
  }

  return resolvedStage;
}

export function terminalAttempt(
  snapshot: F8SessionSnapshot,
  status: "failed" | "cancelled",
  endedAt: string | undefined,
) {
  const activeAttempt = snapshot.activeAttempt;
  if (activeAttempt === null) {
    throw createTypedError({
      code: "validation_error",
      summary: `Cannot mark session ${snapshot.sessionId} as ${status} without an active attempt.`,
      suggestedAction: "Only cancel or fail sessions that still own an active attempt.",
      affectedInputReferences: [snapshot.sessionId, status],
    });
  }

  return {
    ...activeAttempt,
    status,
    endedAt: endedAt ?? new Date().toISOString(),
  };
}

export function clearAttemptMeta(snapshot: F8SessionSnapshot): F8SessionSnapshot {
  return annotateSnapshot(snapshot, undefined);
}

export function assertRetryableState(state: F8SessionState): void {
  switch (state) {
    case "failed":
    case "cancelled":
      return;
    default:
      throw new Error(`Unhandled state: ${state}`);
  }
}