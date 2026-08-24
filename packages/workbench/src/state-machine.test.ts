import { createTypedError } from "@ai-assist/contracts";
import { describe, expect, it } from "vitest";

import * as workbench from "./index.js";

const SESSION_ID = "session-task-4";
const WORKBOOK_HASH = "a".repeat(64);
const PREVIOUS_WORKBOOK_HASH = "b".repeat(64);
const HISTORICAL_WORKBOOK_HASH = "c".repeat(64);

type WorkbenchExports = typeof import("./index.js") & {
  reduceSessionCommand?: (snapshot: SessionSnapshot, command: SessionCommand) => SessionSnapshot;
  acceptAttemptResult?: (snapshot: SessionSnapshot, result: AttemptResult) => SessionSnapshot;
  canRetryAttempt?: (snapshot: SessionSnapshot) => boolean;
};

type SessionSnapshot = ReturnType<typeof baseSnapshot>;

type SessionCommand = {
  contractVersion: "f8-session-command-v1";
  sessionId: string;
  commandId: string;
  expectedRevision: number;
  command:
    | "upload_workbook"
    | "replace_workbook"
    | "confirm_initial_scope"
    | "confirm_downstream_scope"
    | "confirm_ado_decision"
    | "confirm_image_decision"
    | "confirm_analysis_context"
    | "confirm_optimization_targets"
    | "retry"
    | "cancel"
    | "complete_review";
  payload: Record<string, unknown>;
};

type AttemptResult = {
  attemptId: string;
  status?: "completed" | "failed" | "cancelled";
  result: unknown;
  endedAt?: string;
};

describe("workbench state machine", () => {
  it("exports the state-machine entry points", () => {
    const api = workbench as WorkbenchExports;

    expect(typeof api.reduceSessionCommand).toBe("function");
    expect(typeof api.acceptAttemptResult).toBe("function");
    expect(typeof api.canRetryAttempt).toBe("function");
  });

  it("enforces the governed F4-F6 ordering and state allowlists", () => {
    const api = requireApi();

    expect(() => api.reduceSessionCommand(
      baseSnapshot({ state: "f4_running" }),
      confirmAnalysisContextCommand(0),
    )).toThrow(/not allowed/i);

    expect(api.acceptAttemptResult(
      runningSnapshot("f4_running"),
      completedAttemptResult(),
    ).state).toBe("image_decision_required");

    expect(api.acceptAttemptResult(
      runningSnapshot("f5_running"),
      completedAttemptResult(),
    ).state).toBe("analysis_context_decision_required");

    expect(api.reduceSessionCommand(
      baseSnapshot({ state: "analysis_context_decision_required" }),
      analysisContextCommand(0, "decline"),
    ).state).toBe("optimization_targets_decision_required");

    expect(api.reduceSessionCommand(
      baseSnapshot({ state: "optimization_targets_decision_required" }),
      optimizationTargetsCommand(0),
    ).state).toBe("f6_running");
  });

  it("enters the ADO branch only for governance_required outcomes", () => {
    const api = requireApi();

    expect(api.acceptAttemptResult(
      runningSnapshot("f3_running"),
      completedAttemptResult({ governance: { status: "completed" } }),
    ).state).toBe("f4_running");

    expect(api.acceptAttemptResult(
      runningSnapshot("f3_running"),
      completedAttemptResult({ governance: { status: "governance_required" } }),
    ).state).toBe("ado_decision_required");
  });

  it("invalidates only the active input revision on replace_workbook while preserving immutable history", () => {
    const api = requireApi();

    const replaced = api.reduceSessionCommand(
      snapshotWithSelectionsAndHistory(),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "replace-001",
        expectedRevision: 12,
        command: "replace_workbook",
        payload: {
          fileName: "new-workbook.xlsx",
          workbookBytes: new Uint8Array([1, 2, 3]),
          inputClassification: "confidential",
          previousWorkbookHash: PREVIOUS_WORKBOOK_HASH,
        },
      },
    );

    expect(replaced.inputRevision).toBe(3);
    expect(replaced.state).toBe("f0_validating");
    expect(replaced.initialScopeSelection).toBeUndefined();
    expect(replaced.downstreamScopeSelection).toBeUndefined();
    expect(replaced.activeAttempt).toMatchObject({
      stage: "f0_validating",
      status: "running",
      commandId: "replace-001",
    });
    expect(replaced.priorRunReferences).toEqual([
      expect.objectContaining({ featureId: "F4", referenceId: "f4-old" }),
      expect.objectContaining({ featureId: "F5", referenceId: "f5-current" }),
    ]);
  });

  it("preserves immutable prior run references even when a historical workbook shares the same hash", () => {
    const api = requireApi();

    const replaced = api.reduceSessionCommand(
      snapshotWithSameHashHistoricalReference(),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "replace-same-hash-001",
        expectedRevision: 14,
        command: "replace_workbook",
        payload: {
          fileName: "replacement.xlsx",
          workbookBytes: new Uint8Array([4, 5, 6]),
          inputClassification: "confidential",
          previousWorkbookHash: PREVIOUS_WORKBOOK_HASH,
        },
      },
    );

    expect(replaced.priorRunReferences).toEqual([
      expect.objectContaining({ featureId: "F3", referenceId: "f3-historical-same-hash", workbookHash: PREVIOUS_WORKBOOK_HASH }),
      expect.objectContaining({ featureId: "F4", referenceId: "f4-old", workbookHash: HISTORICAL_WORKBOOK_HASH }),
      expect.objectContaining({ featureId: "F5", referenceId: "f5-current", workbookHash: PREVIOUS_WORKBOOK_HASH }),
    ]);
  });

  it("keeps failed attempts retryable only when the typed error allows retry", () => {
    const api = requireApi();

    const retryableFailure = api.acceptAttemptResult(
      runningSnapshot("f5_running"),
      failedAttemptResult(true),
    );
    expect(retryableFailure.state).toBe("failed");
    expect(api.canRetryAttempt(retryableFailure)).toBe(true);

    const fatalFailure = api.acceptAttemptResult(
      runningSnapshot("f5_running"),
      failedAttemptResult(false),
    );
    expect(fatalFailure.state).toBe("failed");
    expect(api.canRetryAttempt(fatalFailure)).toBe(false);
  });

  it("cancels a running stage and resumes the same stage on retry", () => {
    const api = requireApi();

    const cancelled = api.reduceSessionCommand(
      runningSnapshot("f6_running"),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "cancel-001",
        expectedRevision: 5,
        command: "cancel",
        payload: { reason: "User aborted run" },
      },
    );
    expect(cancelled.state).toBe("cancelled");

    const retried = api.reduceSessionCommand(
      cancelled,
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "retry-001",
        expectedRevision: cancelled.revision,
        command: "retry",
        payload: { stage: "f6_running", attemptId: "attempt-running", reason: "Resume" },
      },
    );
    expect(retried.state).toBe("f6_running");
    expect(retried.activeAttempt).toMatchObject({ status: "running", stage: "f6_running" });
  });

  it.each([
    ["f3_running"],
    ["f5_running"],
    ["f6_running"],
  ] as const)("preserves failed stage identity for %s", (stage) => {
    const api = requireApi();

    const failed = api.acceptAttemptResult(
      runningSnapshot(stage),
      failedAttemptResult(true),
    );

    expect(failed.state).toBe("failed");
    expect(failed.activeAttempt).toMatchObject({
      stage,
      status: "failed",
    });
  });

  it.each([
    ["f3_running"],
    ["f5_running"],
    ["f6_running"],
  ] as const)("preserves cancelled stage identity for %s", (stage) => {
    const api = requireApi();

    const cancelled = api.acceptAttemptResult(
      runningSnapshot(stage),
      cancelledAttemptResult(),
    );

    expect(cancelled.state).toBe("cancelled");
    expect(cancelled.activeAttempt).toMatchObject({
      stage,
      status: "cancelled",
    });
  });

  it("completes the review when F7 is unavailable without creating an F7 attempt", () => {
    const api = requireApi();

    const completed = api.reduceSessionCommand(
      baseSnapshot({ state: "review_required", revision: 9 }),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "complete-review-001",
        expectedRevision: 9,
        command: "complete_review",
        payload: { confirmed: true },
      },
    );

    expect(completed.state).toBe("completed");
    expect(completed.activeAttempt).toBeNull();
    expect(completed.priorRunReferences).toEqual([]);
  });
});

function requireApi(): Required<WorkbenchExports> {
  const api = workbench as WorkbenchExports;

  if (typeof api.reduceSessionCommand !== "function"
    || typeof api.acceptAttemptResult !== "function"
    || typeof api.canRetryAttempt !== "function") {
    throw new Error("Expected workbench state-machine exports to be defined.");
  }

  return api as Required<WorkbenchExports>;
}

function baseSnapshot(overrides: Partial<ReturnType<typeof baseSnapshotShape>> = {}) {
  return {
    ...baseSnapshotShape(),
    ...overrides,
  };
}

function baseSnapshotShape() {
  return {
    contractVersion: "f8-session-snapshot-v1" as const,
    sessionId: SESSION_ID,
    revision: 0,
    inputRevision: 0,
    state: "created",
    activeAttempt: null,
    priorRunReferences: [] as Array<{
      featureId: "F0" | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7";
      referenceId: string;
      contractVersion: string;
      workbookHash?: string;
      artifactId?: string;
      runReference?: string;
    }>,
  };
}

function runningSnapshot(state: "f3_running" | "f4_running" | "f5_running" | "f6_running") {
  return baseSnapshot({
    revision: 5,
    inputRevision: 2,
    state,
    activeAttempt: {
      attemptId: "attempt-running",
      stage: state,
      status: "running" as const,
      commandId: "command-running",
      startedAt: "2026-08-24T00:00:00.000Z",
    },
  });
}

function completedAttemptResult(result: Record<string, unknown> = {}) {
  return {
    attemptId: "attempt-running",
    status: "completed" as const,
    result,
    endedAt: "2026-08-24T00:05:00.000Z",
  };
}

function failedAttemptResult(retryable: boolean) {
  return {
    attemptId: "attempt-running",
    status: "failed" as const,
    result: {
      error: createTypedError({
        code: retryable ? "transient_error" : "internal_error",
        retryable,
        summary: retryable ? "Temporary failure" : "Fatal failure",
        suggestedAction: retryable ? "Retry the stage." : "Inspect the worker failure.",
        affectedInputReferences: ["attempt-running"],
      }),
    },
    endedAt: "2026-08-24T00:05:00.000Z",
  };
}

function cancelledAttemptResult() {
  return {
    attemptId: "attempt-running",
    status: "cancelled" as const,
    result: { reason: "user_cancelled" },
    endedAt: "2026-08-24T00:05:00.000Z",
  };
}

function confirmAnalysisContextCommand(expectedRevision: number): SessionCommand {
  return analysisContextCommand(expectedRevision, "approve");
}

function analysisContextCommand(expectedRevision: number, decision: "approve" | "decline"): SessionCommand {
  return {
    contractVersion: "f8-session-command-v1",
    sessionId: SESSION_ID,
    commandId: `analysis-context-${decision}`,
    expectedRevision,
    command: "confirm_analysis_context",
    payload: { decision },
  };
}

function optimizationTargetsCommand(expectedRevision: number): SessionCommand {
  return {
    contractVersion: "f8-session-command-v1",
    sessionId: SESSION_ID,
    commandId: "optimization-targets-approve",
    expectedRevision,
    command: "confirm_optimization_targets",
    payload: { decision: "approve" },
  };
}

function snapshotWithSelectionsAndHistory() {
  return baseSnapshot({
    revision: 12,
    inputRevision: 2,
    state: "review_required",
    activeAttempt: {
      attemptId: "attempt-old",
      stage: "f6_running",
      status: "running" as const,
      commandId: "command-old",
      startedAt: "2026-08-24T00:00:00.000Z",
    },
    initialScopeSelection: {
      workbookContentHash: PREVIOUS_WORKBOOK_HASH,
      selectedWorksheetNames: ["Initial-A"],
      confirmed: true,
    },
    downstreamScopeSelection: {
      workbookContentHash: PREVIOUS_WORKBOOK_HASH,
      selectedWorksheetNames: ["Downstream-A"],
      confirmed: true,
    },
    priorRunReferences: [
      {
        featureId: "F4" as const,
        referenceId: "f4-old",
        contractVersion: "f4-run-v1",
        workbookHash: HISTORICAL_WORKBOOK_HASH,
        runReference: "run-f4-old",
      },
      {
        featureId: "F5" as const,
        referenceId: "f5-current",
        contractVersion: "f5-run-v1",
        workbookHash: PREVIOUS_WORKBOOK_HASH,
        runReference: "run-f5-current",
      },
    ],
  });
}

function snapshotWithSameHashHistoricalReference() {
  return baseSnapshot({
    revision: 14,
    inputRevision: 4,
    state: "review_required",
    activeAttempt: {
      attemptId: "attempt-same-hash",
      stage: "f6_running",
      status: "running" as const,
      commandId: "command-same-hash",
      startedAt: "2026-08-24T00:00:00.000Z",
    },
    initialScopeSelection: {
      workbookContentHash: PREVIOUS_WORKBOOK_HASH,
      selectedWorksheetNames: ["Initial-B"],
      confirmed: true,
    },
    downstreamScopeSelection: {
      workbookContentHash: PREVIOUS_WORKBOOK_HASH,
      selectedWorksheetNames: ["Downstream-B"],
      confirmed: true,
    },
    priorRunReferences: [
      {
        featureId: "F3" as const,
        referenceId: "f3-historical-same-hash",
        contractVersion: "f3-run-v1",
        workbookHash: PREVIOUS_WORKBOOK_HASH,
        runReference: "run-f3-historical-same-hash",
      },
      {
        featureId: "F4" as const,
        referenceId: "f4-old",
        contractVersion: "f4-run-v1",
        workbookHash: HISTORICAL_WORKBOOK_HASH,
        runReference: "run-f4-old",
      },
      {
        featureId: "F5" as const,
        referenceId: "f5-current",
        contractVersion: "f5-run-v1",
        workbookHash: PREVIOUS_WORKBOOK_HASH,
        runReference: "run-f5-current",
      },
    ],
  });
}