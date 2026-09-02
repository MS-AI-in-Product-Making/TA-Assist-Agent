import { describe, expect, it } from "vitest";

import { projectTaProductStages } from "./workbench-session.js";

describe("workbench-session product stages", () => {
  it.each([
    ["failed", "f4_running", "calculate_and_interpret", 3],
    ["cancelled", "f3_running", "review_dimension_traceability", 2],
  ] as const)(
    "maps %s reload snapshots by persisted activeAttempt.stage",
    (terminalState, activeAttemptStage, expectedStageId, expectedIndex) => {
      const stages = projectTaProductStages({
        contractVersion: "f8-session-snapshot-v1",
        sessionId: "session-reload",
        revision: 12,
        inputRevision: 8,
        state: terminalState,
        activeAttempt: {
          attemptId: `attempt-${terminalState}`,
          stage: activeAttemptStage,
          status: terminalState,
          startedAt: "2026-09-01T00:00:00.000Z",
          endedAt: "2026-09-01T00:05:00.000Z",
        },
        priorRunReferences: [],
      });

      expect(stages[expectedIndex]).toMatchObject({
        stageId: expectedStageId,
        status: terminalState,
      });
      expect(stages[4]).toMatchObject({
        stageId: "evaluate_and_publish",
        status: "pending",
      });
    },
  );

  it("uses workflow-level attention when terminal reload has no stage evidence", () => {
    const stages = projectTaProductStages({
      contractVersion: "f8-session-snapshot-v1",
      sessionId: "session-reload-no-stage",
      revision: 3,
      inputRevision: 2,
      state: "failed",
      activeAttempt: null,
      priorRunReferences: [],
    });

    expect(stages[0]).toMatchObject({
      stageId: "prepare_workbook",
      status: "action_required",
    });
    expect(stages[4]).toMatchObject({
      stageId: "evaluate_and_publish",
      status: "pending",
    });
  });
});
