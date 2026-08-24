import { describe, expect, it } from "vitest";

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