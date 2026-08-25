import { createTypedError, f8SessionSnapshotSchema } from "@ai-assist/contracts";

import {
  annotateSnapshot,
  attemptMatchesActiveAttempt,
  createRunningAttempt,
  deriveRetryable,
  resolveRetryStage,
  terminalAttempt,
  type SessionAttemptResult,
} from "./attempts.js";
import {
  assertCommandAllowed,
  isRunningState,
  parseCommand,
  parseSnapshot,
  type F8SessionCommand,
  type F8SessionSnapshot,
  type F8SessionState,
} from "./commands.js";

export { canRetryAttempt } from "./attempts.js";
export type { SessionAttemptResult } from "./attempts.js";

export function reduceSessionCommand(snapshotInput: F8SessionSnapshot, commandInput: F8SessionCommand): F8SessionSnapshot {
  const snapshot = parseSnapshot(snapshotInput);
  const command = parseCommand(commandInput);
  assertCommandAllowed(snapshot, command);

  if (command.sessionId !== snapshot.sessionId) {
    throw createTypedError({
      code: "validation_error",
      summary: `Command ${command.commandId} targets session ${command.sessionId}, expected ${snapshot.sessionId}.`,
      suggestedAction: "Re-run the command against the active session.",
      affectedInputReferences: [command.commandId, command.sessionId],
    });
  }

  if (command.expectedRevision !== snapshot.revision) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: `Expected revision ${command.expectedRevision}, found ${snapshot.revision}.`,
      suggestedAction: "Refresh the session snapshot before sending another command.",
      affectedInputReferences: [command.commandId, snapshot.sessionId],
    });
  }

  switch (command.command) {
    case "upload_workbook":
      return startWorkbookValidation(snapshot, command, false);
    case "replace_workbook":
      return startWorkbookValidation(snapshot, command, true);
    case "confirm_initial_scope":
      return reduceConfirmInitialScope(snapshot, command);
    case "confirm_downstream_scope":
      return reduceConfirmDownstreamScope(snapshot, command);
    case "confirm_ado_decision":
      return reduceConfirmAdoDecision(snapshot, command);
    case "confirm_image_decision":
      return transitionWithAttempt(snapshot, command, "f5_running");
    case "confirm_analysis_context":
      return nextSnapshot(snapshot, {
        state: "optimization_targets_decision_required",
        activeAttempt: null,
      });
    case "confirm_optimization_targets":
      return transitionWithAttempt(snapshot, command, "f6_running");
    case "retry": {
      const retryStage = resolveRetryStage(snapshot, (command.payload as { stage?: F8SessionState }).stage);
      return transitionWithAttempt(snapshot, command, retryStage);
    }
    case "cancel":
      return nextSnapshot(snapshot, {
        state: "cancelled",
        activeAttempt: terminalAttempt(snapshot, "cancelled", undefined),
      });
    case "complete_review":
      return nextSnapshot(snapshot, {
        state: "completed",
        activeAttempt: null,
        priorRunReferences: withF7PlaceholderOutcome(snapshot),
      });
    default:
      throw new Error(`Unhandled command: ${(command as F8SessionCommand).command}`);
  }
}

function reduceConfirmInitialScope(
  snapshot: F8SessionSnapshot,
  command: F8SessionCommand,
): F8SessionSnapshot {
  const payload = command.payload as { workbookHash: string; worksheetNames: string[] };
  return transitionWithAttempt(snapshot, command, "f1_f2_running", {
    initialScopeSelection: {
      workbookContentHash: payload.workbookHash,
      selectedWorksheetNames: payload.worksheetNames,
      confirmed: true,
    },
  });
}

function reduceConfirmDownstreamScope(
  snapshot: F8SessionSnapshot,
  command: F8SessionCommand,
): F8SessionSnapshot {
  const payload = command.payload as { workbookHash: string; worksheetNames: string[] };
  return transitionWithAttempt(snapshot, command, "f3_running", {
    downstreamScopeSelection: {
      workbookContentHash: payload.workbookHash,
      selectedWorksheetNames: payload.worksheetNames,
      confirmed: true,
    },
  });
}

export function acceptAttemptResult(snapshotInput: F8SessionSnapshot, result: SessionAttemptResult): F8SessionSnapshot {
  const snapshot = parseSnapshot(snapshotInput);
  if (!attemptMatchesActiveAttempt(snapshot, result.attemptId)) {
    return snapshot;
  }

  const activeAttempt = snapshot.activeAttempt;
  if (activeAttempt === null) {
    return snapshot;
  }

  const terminalStatus = result.status ?? "completed";
  switch (terminalStatus) {
    case "completed": {
      const nextState = resolveCompletionState(activeAttempt.stage, result.result);
      const transitioned = transitionAfterCompletion(snapshot, activeAttempt.stage, nextState, activeAttempt.commandId ?? result.attemptId);
      return annotateSnapshot(transitioned, undefined);
    }
    case "failed": {
      const failedSnapshot = nextSnapshot(snapshot, {
        state: "failed",
        activeAttempt: terminalAttempt(snapshot, "failed", result.endedAt),
      });
      return annotateSnapshot(failedSnapshot, { retryable: deriveRetryable(result.result) });
    }
    case "cancelled":
      return nextSnapshot(snapshot, {
        state: "cancelled",
        activeAttempt: terminalAttempt(snapshot, "cancelled", result.endedAt),
      });
    default:
      throw new Error(`Unhandled terminal status: ${terminalStatus}`);
  }
}

function startWorkbookValidation(
  snapshot: F8SessionSnapshot,
  command: F8SessionCommand,
  replacingWorkbook: boolean,
): F8SessionSnapshot {
  const nextInputRevision = snapshot.inputRevision + 1;
  const preservedDrafts = snapshot.scenarioDrafts?.filter((draft) => draft.inputRevision !== snapshot.inputRevision);

  return transitionWithAttempt(snapshot, command, "f0_validating", {
    inputRevision: nextInputRevision,
    initialScopeSelection: undefined,
    downstreamScopeSelection: undefined,
    priorRunReferences: snapshot.priorRunReferences,
    scenarioDrafts: preservedDrafts?.length ? preservedDrafts : undefined,
    ...(replacingWorkbook ? {} : {}),
  });
}

function transitionAfterCompletion(
  snapshot: F8SessionSnapshot,
  completedStage: F8SessionState,
  nextState: F8SessionState,
  transitionKey: string,
): F8SessionSnapshot {
  if (isRunningState(nextState)) {
    return nextSnapshot(snapshot, {
      state: nextState,
      activeAttempt: createRunningAttempt(nextState, `${transitionKey}:next`),
    });
  }

  return nextSnapshot(snapshot, {
    state: nextState,
    activeAttempt: null,
  });
}

function resolveCompletionState(stage: F8SessionState, result: unknown): F8SessionState {
  switch (stage) {
    case "workbook_validating":
      return "f0_validating";
    case "f0_validating":
      return "initial_scope_required";
    case "f1_f2_running":
      return "downstream_scope_required";
    case "f3_running":
      return governanceRequired(result) ? "ado_decision_required" : "f4_running";
    case "ado_action_pending":
      return "ado_action_pending";
    case "f4_running":
      return "image_decision_required";
    case "f5_running":
      return "analysis_context_decision_required";
    case "f6_running":
      return "review_required";
    case "f7_running":
      return "feedback_review_required";
    case "created":
    case "workbook_required":
    case "f0_validated":
    case "initial_scope_required":
    case "downstream_scope_required":
    case "ado_decision_required":
    case "image_decision_required":
    case "analysis_context_decision_required":
    case "optimization_targets_decision_required":
    case "review_required":
    case "f7_import_required":
    case "f7_preview_required":
    case "feedback_review_required":
    case "completed":
    case "failed":
    case "cancelled":
      throw createTypedError({
        code: "validation_error",
        summary: `Stage ${stage} does not accept worker completion results.`,
        suggestedAction: "Submit completion results only for actively running states.",
        affectedInputReferences: [stage],
      });
    default:
      throw new Error(`Unhandled stage: ${stage}`);
  }
}

function governanceRequired(result: unknown): boolean {
  if (typeof result !== "object" || result === null) {
    return false;
  }

  const governance = (result as { governance?: { status?: unknown } }).governance;
  return governance?.status === "governance_required";
}

function nextSnapshot(
  snapshot: F8SessionSnapshot,
  updates: Partial<Omit<F8SessionSnapshot, "contractVersion" | "sessionId" | "revision">>,
): F8SessionSnapshot {
  return f8SessionSnapshotSchema.parse({
    ...snapshot,
    ...updates,
    revision: snapshot.revision + 1,
  });
}

function transitionWithAttempt(
  snapshot: F8SessionSnapshot,
  command: F8SessionCommand,
  state: F8SessionState,
  updates: Partial<Omit<F8SessionSnapshot, "contractVersion" | "sessionId" | "revision" | "state" | "activeAttempt">> = {},
): F8SessionSnapshot {
  if (!isRunningState(state)) {
    throw createTypedError({
      code: "validation_error",
      summary: `State ${state} cannot be entered with an automatic attempt.`,
      suggestedAction: "Use a decision-state transition instead of starting an attempt.",
      affectedInputReferences: [state, command.commandId],
    });
  }

  return annotateSnapshot(nextSnapshot(snapshot, {
    ...updates,
    state,
    activeAttempt: createRunningAttempt(state, command.commandId),
  }), undefined);
}

function withF7PlaceholderOutcome(snapshot: F8SessionSnapshot): F8SessionSnapshot["priorRunReferences"] {
  const placeholderReferenceId = `f7-placeholder-input-${snapshot.inputRevision}`;
  const placeholderRunReference = `f7-placeholder:${snapshot.sessionId}:${snapshot.inputRevision}`;

  if (snapshot.priorRunReferences.some((reference) => reference.featureId === "F7" && reference.referenceId === placeholderReferenceId)) {
    return snapshot.priorRunReferences;
  }

  return [
    ...snapshot.priorRunReferences,
    {
      featureId: "F7",
      referenceId: placeholderReferenceId,
      contractVersion: "f7-workbench-placeholder-v1",
      runReference: placeholderRunReference,
    },
  ];
}

function reduceConfirmAdoDecision(snapshot: F8SessionSnapshot, command: F8SessionCommand): F8SessionSnapshot {
  const payload = command.payload as { readonly decision: "create_new" | "use_existing" | "local_only" };
  if (payload.decision !== "local_only") {
    return nextSnapshot(snapshot, {
      state: "ado_action_pending",
      activeAttempt: null,
    });
  }

  return transitionWithAttempt(snapshot, command, "f4_running", {
    priorRunReferences: [
      ...snapshot.priorRunReferences,
      {
        featureId: "F3",
        referenceId: "ado-not-requested",
        contractVersion: "f3-ado-reminder-v1",
        runReference: `f3-ado:not-requested:${snapshot.sessionId}:${snapshot.inputRevision}`,
      },
    ],
  });
}