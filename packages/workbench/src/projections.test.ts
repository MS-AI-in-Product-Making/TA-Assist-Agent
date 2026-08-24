import { afterEach, describe, expect, it, vi } from "vitest";

import * as workbench from "./index.js";

const SESSION_ID = "session-task-4-projections";

type WorkbenchExports = typeof import("./index.js") & {
  projectActionQueue?: (snapshot: SessionSnapshot) => ActionQueueItem[];
  projectFeatureLedger?: (snapshot: SessionSnapshot) => FeatureLedgerEntry[];
  acceptAttemptResult?: (snapshot: SessionSnapshot, result: AttemptResult) => SessionSnapshot;
};

type SessionSnapshot = ReturnType<typeof baseSnapshot>;

type ActionQueueItem = {
  featureId: string;
  action: string;
  blocking: boolean;
};

type FeatureLedgerEntry = {
  featureId: string;
  status: string;
  lifecycle?: string;
  actions: readonly string[];
};

type AttemptResult = {
  attemptId: string;
  status?: "completed" | "failed" | "cancelled";
  result: unknown;
  endedAt?: string;
};

describe("workbench projections", () => {
  it("exports the queue and ledger projection entry points", () => {
    const api = workbench as WorkbenchExports;

    expect(typeof api.projectActionQueue).toBe("function");
    expect(typeof api.projectFeatureLedger).toBe("function");
  });

  it("projects F7 as a non-executable placeholder", () => {
    const api = requireApi();

    expect(api.projectFeatureLedger(baseSnapshot({ state: "review_required" })).find((entry) => entry.featureId === "F7")).toMatchObject({
      featureId: "F7",
      status: "feature_not_available",
      lifecycle: "in_development",
      actions: [],
    });
  });

  it("shows Context before Targets after F5 and keeps F7 out of the action queue when unavailable", () => {
    const api = requireApi();

    const queue = api.projectActionQueue(baseSnapshot({ state: "analysis_context_decision_required" }));

    expect(queue.map((item) => item.action)).toEqual([
      "confirm_analysis_context",
    ]);

    const targetsQueue = api.projectActionQueue(baseSnapshot({ state: "optimization_targets_decision_required" }));
    expect(targetsQueue.map((item) => item.action)).toEqual([
      "confirm_optimization_targets",
    ]);

    expect(api.projectActionQueue(baseSnapshot({ state: "review_required" })).find((item) => item.featureId === "F7")).toBeUndefined();
  });

  it("keeps retry and cancel actions scoped to failed and running states", () => {
    const api = requireApi();

    const retryableFailure = api.acceptAttemptResult(
      baseSnapshot({
        state: "f5_running",
        activeAttempt: {
          attemptId: "attempt-running",
          stage: "f5_running",
          status: "running",
          startedAt: "2026-08-24T00:00:00.000Z",
        },
      }),
      {
        attemptId: "attempt-running",
        status: "failed",
        result: {
          error: {
            code: "transient_error",
            runId: "00000000-0000-4000-8000-000000000001",
            summary: "Temporary failure",
            retryable: true,
            suggestedAction: "Retry the stage.",
            affectedInputReferences: ["attempt-running"],
          },
        },
      },
    );

    expect(api.projectActionQueue(baseSnapshot({
      state: "f5_running",
      activeAttempt: {
        attemptId: "attempt-running",
        stage: "f5_running",
        status: "running",
        startedAt: "2026-08-24T00:00:00.000Z",
      },
    })).map((item) => item.action)).toContain("cancel");

    expect(api.projectActionQueue(retryableFailure).map((item) => item.action)).toContain("retry");
    expect(api.projectActionQueue(baseSnapshot({ state: "completed" }))).toEqual([]);
  });

  it.each([
    ["f3_running", "F3", ["F0", "F1", "F2"]],
    ["f5_running", "F5", ["F0", "F1", "F2", "F3", "F4"]],
    ["f6_running", "F6", ["F0", "F1", "F2", "F3", "F4", "F5"]],
  ] as const)("keeps failed stage projection anchored to %s", (stage, featureId, completedFeatures) => {
    const api = requireApi();
    const failed = api.acceptAttemptResult(runningSnapshot(stage), failedAttemptResult(true));

    expect(api.projectActionQueue(failed)).toEqual([{ featureId, action: "retry", blocking: true }]);

    const ledger = api.projectFeatureLedger(failed);
    expect(completedStatuses(ledger)).toEqual(completedFeatures);
    expect(ledger.find((entry) => entry.featureId === featureId)).toMatchObject({
      featureId,
      status: "failed",
      actions: ["retry"],
    });
    expect(ledger.filter((entry) => !completedFeatures.includes(entry.featureId) && entry.featureId !== featureId && entry.featureId !== "F7").every((entry) => entry.status === "pending")).toBe(true);
  });

  it.each([
    ["f3_running", "F3", ["F0", "F1", "F2"]],
    ["f5_running", "F5", ["F0", "F1", "F2", "F3", "F4"]],
    ["f6_running", "F6", ["F0", "F1", "F2", "F3", "F4", "F5"]],
  ] as const)("keeps cancelled stage projection anchored to %s", (stage, featureId, completedFeatures) => {
    const api = requireApi();
    const cancelled = api.acceptAttemptResult(runningSnapshot(stage), cancelledAttemptResult());

    expect(api.projectActionQueue(cancelled)).toEqual([{ featureId, action: "retry", blocking: true }]);

    const ledger = api.projectFeatureLedger(cancelled);
    expect(completedStatuses(ledger)).toEqual(completedFeatures);
    expect(ledger.find((entry) => entry.featureId === featureId)).toMatchObject({
      featureId,
      status: "cancelled",
      actions: ["retry"],
    });
  });

  it("keeps F7 non-executable even when governance reports it as available", async () => {
    const api = await importWorkbenchWithGovernanceStatus("available");

    const reviewLedger = api.projectFeatureLedger(baseSnapshot({ state: "review_required" }));
    expect(reviewLedger.find((entry) => entry.featureId === "F7")).toMatchObject({
      featureId: "F7",
      status: "feature_not_available",
      lifecycle: "in_development",
      actions: [],
    });
    expect(api.projectActionQueue(baseSnapshot({ state: "review_required" }))).toContainEqual({
      featureId: "F6",
      action: "complete_review",
      blocking: false,
    });

    const importRequiredLedger = api.projectFeatureLedger(baseSnapshot({ state: "f7_import_required" }));
    expect(importRequiredLedger.find((entry) => entry.featureId === "F7")).toMatchObject({
      featureId: "F7",
      status: "feature_not_available",
      lifecycle: "in_development",
      actions: [],
    });
    expect(api.projectActionQueue(baseSnapshot({ state: "f7_import_required" }))).toEqual([]);

    expect(api.projectActionQueue(baseSnapshot({ state: "f7_preview_required" }))).toEqual([]);

    const feedbackLedger = api.projectFeatureLedger(baseSnapshot({ state: "feedback_review_required" }));
    expect(feedbackLedger.find((entry) => entry.featureId === "F7")).toMatchObject({
      featureId: "F7",
      status: "feature_not_available",
      lifecycle: "in_development",
      actions: [],
    });
    expect(api.projectActionQueue(baseSnapshot({ state: "feedback_review_required" }))).toEqual([]);

    const runningLedger = api.projectFeatureLedger(runningSnapshot("f7_running"));
    expect(runningLedger.find((entry) => entry.featureId === "F7")).toMatchObject({
      featureId: "F7",
      status: "feature_not_available",
      lifecycle: "in_development",
      actions: [],
    });
    expect(api.projectActionQueue(baseSnapshot({ state: "f7_running" }))).toEqual([]);
  });
});

afterEach(() => {
  vi.doUnmock("@ai-assist/governance");
  vi.resetModules();
});

function requireApi(): Required<WorkbenchExports> {
  const api = workbench as WorkbenchExports;

  if (
    typeof api.projectActionQueue !== "function"
    || typeof api.projectFeatureLedger !== "function"
    || typeof api.acceptAttemptResult !== "function"
  ) {
    throw new Error("Expected workbench projection exports to be defined.");
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
    activeAttempt: null as {
      attemptId: string;
      stage: string;
      status: string;
      commandId?: string;
      startedAt: string;
      endedAt?: string;
    } | null,
    priorRunReferences: [] as Array<unknown>,
  };
}

function runningSnapshot(state: "f3_running" | "f5_running" | "f6_running" | "f7_running") {
  return baseSnapshot({
    state,
    revision: 4,
    inputRevision: 2,
    activeAttempt: {
      attemptId: "attempt-running",
      stage: state,
      status: "running",
      commandId: "command-running",
      startedAt: "2026-08-24T00:00:00.000Z",
    },
  });
}

function failedAttemptResult(retryable: boolean): AttemptResult {
  return {
    attemptId: "attempt-running",
    status: "failed",
    result: {
      error: {
        code: retryable ? "transient_error" : "internal_error",
        runId: "00000000-0000-4000-8000-000000000001",
        summary: retryable ? "Temporary failure" : "Fatal failure",
        retryable,
        suggestedAction: retryable ? "Retry the stage." : "Inspect the worker failure.",
        affectedInputReferences: ["attempt-running"],
      },
    },
    endedAt: "2026-08-24T00:05:00.000Z",
  };
}

function cancelledAttemptResult(): AttemptResult {
  return {
    attemptId: "attempt-running",
    status: "cancelled",
    result: { reason: "user_cancelled" },
    endedAt: "2026-08-24T00:05:00.000Z",
  };
}

function completedStatuses(ledger: FeatureLedgerEntry[]): string[] {
  return ledger.filter((entry) => entry.status === "completed").map((entry) => entry.featureId);
}

async function importWorkbenchWithGovernanceStatus(status: string): Promise<Required<WorkbenchExports>> {
  vi.resetModules();
  vi.doMock("@ai-assist/governance", () => ({
    getFeatureStatus: (featureId: string) => featureId === "F7"
      ? { featureId, status }
      : { featureId, status: "available" },
  }));
  const api = await import("./index.js") as WorkbenchExports;

  if (
    typeof api.projectActionQueue !== "function"
    || typeof api.projectFeatureLedger !== "function"
    || typeof api.acceptAttemptResult !== "function"
  ) {
    throw new Error("Expected workbench projection exports to be defined.");
  }

  return api as Required<WorkbenchExports>;
}