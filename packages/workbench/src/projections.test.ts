import { afterEach, describe, expect, it, vi } from "vitest";

import * as workbench from "./index.js";

const SESSION_ID = "session-task-4-projections";

type WorkbenchExports = typeof import("./index.js") & {
  projectActionQueue?: (snapshot: SessionSnapshot) => ActionQueueItem[];
  projectFeatureLedger?: (snapshot: SessionSnapshot) => FeatureLedgerEntry[];
  projectTaProductStages?: (
    snapshot: SessionSnapshot,
    progress?: { readonly kind: "stage_started" | "stage_completed" | "stage_failed" | "artifact_written"; readonly featureId: string },
  ) => ProductStageEntry[];
  acceptAttemptResult?: (snapshot: SessionSnapshot, result: AttemptResult) => SessionSnapshot;
  projectF2FindingsDecision?: (report: F2Report, evidence: F2Evidence) => F2Decision;
};

type F2Report = Parameters<NonNullable<WorkbenchExports["projectF2FindingsDecision"]>>[0];
type F2Evidence = {
  readonly inputRevision: number;
  readonly f2ReportArtifactId: string;
  readonly f2ReportContentHash: string;
};
type F2Decision = {
  readonly findingDigest: string;
  readonly worksheetFindings: readonly {
    readonly worksheetName: string;
    readonly readiness: "downstream_ready" | "blocked";
    readonly identifierWarnings: readonly string[];
    readonly blockers: readonly string[];
    readonly sourceRows: readonly number[];
  }[];
  readonly downstreamReadyWorksheetNames: readonly string[];
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

type ProductStageEntry = {
  stageId: string;
  label: string;
  status: string;
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
    expect(typeof api.projectTaProductStages).toBe("function");
    expect(typeof api.projectF2FindingsDecision).toBe("function");
  });

  it("keeps identifier-only worksheets downstream-ready using current warning codes", () => {
    const decision = requireApi().projectF2FindingsDecision(f2Report([
      worksheet("Identifier Only", {
        missingIdentifiers: ["partNumber", "dimCharacteristicId"],
        sourceRow: 12,
      }),
    ]), f2Evidence());

    expect(decision.worksheetFindings).toEqual([expect.objectContaining({
      worksheetName: "Identifier Only",
      readiness: "downstream_ready",
      identifierWarnings: ["dim_id_missing", "drawing_number_missing"],
      blockers: [],
      sourceRows: [12],
    })]);
    expect(decision.downstreamReadyWorksheetNames).toEqual(["Identifier Only"]);
  });

  it("maps a missing tolerance stack image to a worksheet blocker", () => {
    const decision = requireApi().projectF2FindingsDecision(f2Report([
      worksheet("Missing Image", { imageAvailable: false }),
    ]), f2Evidence());

    expect(decision.worksheetFindings[0]).toMatchObject({
      readiness: "blocked",
      blockers: ["tolerance_path_image_missing"],
      sourceRows: [],
    });
    expect(decision.downstreamReadyWorksheetNames).toEqual([]);
  });

  it("projects multiple calculation-required fields as stable machine blockers", () => {
    const decision = requireApi().projectF2FindingsDecision(f2Report([
      worksheet("Missing Fields", {
        missingRequiredFields: ["partName", "nominalValue", "upperTolerance"],
        sourceRow: 9,
      }),
    ]), f2Evidence());

    expect(decision.worksheetFindings[0]).toMatchObject({
      readiness: "blocked",
      blockers: [
        "required_field_missing:nominalValue",
        "required_field_missing:partName",
        "required_field_missing:upperTolerance",
      ],
      sourceRows: [9],
    });
  });

  it("preserves report order for the exact downstream-ready set in a mixed report", () => {
    const decision = requireApi().projectF2FindingsDecision(f2Report([
      worksheet("Zulu Ready"),
      worksheet("Blocked Middle", { imageAvailable: false }),
      worksheet("Alpha Ready"),
    ]), f2Evidence());

    expect(decision.worksheetFindings.map((finding) => finding.readiness)).toEqual([
      "downstream_ready",
      "blocked",
      "downstream_ready",
    ]);
    expect(decision.downstreamReadyWorksheetNames).toEqual(["Zulu Ready", "Alpha Ready"]);
  });

  it("returns an empty downstream-ready set when every worksheet is blocked", () => {
    const decision = requireApi().projectF2FindingsDecision(f2Report([
      worksheet("First", { imageAvailable: false }),
      worksheet("Second", { missingRequiredFields: ["factorName"], sourceRow: 4 }),
    ]), f2Evidence());

    expect(decision.worksheetFindings.every((finding) => finding.readiness === "blocked")).toBe(true);
    expect(decision.downstreamReadyWorksheetNames).toEqual([]);
  });

  it("computes the same digest when localized display labels change", () => {
    const report = f2Report([worksheet("Stable", { missingRequiredFields: ["factorName"], sourceRow: 4 })]);
    const relabeled = structuredClone(report) as F2Report & { localizedLabels?: Record<string, string> };
    relabeled.localizedLabels = { factorName: "因子描述", blocked: "已阻止" };

    const first = requireApi().projectF2FindingsDecision(report, f2Evidence());
    const second = requireApi().projectF2FindingsDecision(relabeled, f2Evidence());

    expect(first.findingDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(second.findingDigest).toBe(first.findingDigest);
  });

  it("derives required-field blockers from rows instead of the summary cache", () => {
    const report = f2Report([worksheet("Row Authority", { missingRequiredFields: ["nominalValue"], sourceRow: 7 })]);
    report.worksheets[0]!.missingFieldSummary = [];

    const decision = requireApi().projectF2FindingsDecision(report, f2Evidence());

    expect(decision.worksheetFindings[0]).toMatchObject({
      readiness: "blocked",
      blockers: ["required_field_missing:nominalValue"],
      sourceRows: [7],
    });
  });

  it("keeps the digest stable when unordered machine findings are permuted", () => {
    const firstReport = f2Report([worksheet("Stable", {
      missingRequiredFields: ["upperTolerance", "nominalValue"],
      missingIdentifiers: ["dimCharacteristicId", "drawingNumber"],
      sourceRow: 8,
    })]);
    firstReport.worksheets[0]!.rows.push({
      ...structuredClone(firstReport.worksheets[0]!.rows[0]!),
      sourceRow: 3,
      missingRequiredFields: ["partName"],
      missingIdentifiers: [],
    });
    const secondReport = structuredClone(firstReport);
    secondReport.worksheets[0]!.rows.reverse();
    secondReport.worksheets[0]!.rows[1]!.missingRequiredFields.reverse();
    secondReport.worksheets[0]!.rows[1]!.missingIdentifiers.reverse();

    const first = requireApi().projectF2FindingsDecision(firstReport, f2Evidence());
    const second = requireApi().projectF2FindingsDecision(secondReport, f2Evidence());

    expect(second.findingDigest).toBe(first.findingDigest);
  });

  it("projects internal workflow into five product stages", () => {
    const api = requireApi();

    const stages = api.projectTaProductStages(baseSnapshot({ state: "f4_running" }));
    expect(stages).toHaveLength(5);
    expect(stages).toEqual([
      expect.objectContaining({ label: "Prepare workbook", status: "completed" }),
      expect.objectContaining({ label: "Validate analysis inputs", status: "completed" }),
      expect.objectContaining({ label: "Review dimension traceability", status: "completed" }),
      expect.objectContaining({ label: "Calculate and interpret tolerance performance", status: "running" }),
      expect.objectContaining({ label: "Evaluate improvement options and publish report", status: "pending" }),
    ]);
  });

  it("keeps F7 placeholder out of TA main product-stage progress", () => {
    const api = requireApi();

    const stages = api.projectTaProductStages(baseSnapshot({ state: "f7_preview_required" }));
    expect(stages).toHaveLength(5);
    expect(stages.some((stage) => /\bF7\b/.test(stage.label))).toBe(false);
  });

  it("anchors failed terminal stage to persisted activeAttempt stage when progress is absent", () => {
    const api = requireApi();
    const snapshot = baseSnapshot({
      state: "failed",
      activeAttempt: {
        attemptId: "attempt-f4",
        stage: "f4_running",
        status: "failed",
        startedAt: "2026-09-01T00:00:00.000Z",
        endedAt: "2026-09-01T00:03:00.000Z",
      },
    });

    const stages = api.projectTaProductStages(snapshot);
    expect(stages[3]).toMatchObject({
      stageId: "calculate_and_interpret",
      status: "failed",
    });
    expect(stages[4]).toMatchObject({
      stageId: "evaluate_and_publish",
      status: "pending",
    });
  });

  it("anchors cancelled terminal stage to persisted activeAttempt stage when progress is absent", () => {
    const api = requireApi();
    const snapshot = baseSnapshot({
      state: "cancelled",
      activeAttempt: {
        attemptId: "attempt-f3",
        stage: "f3_running",
        status: "cancelled",
        startedAt: "2026-09-01T00:00:00.000Z",
        endedAt: "2026-09-01T00:02:00.000Z",
      },
    });

    const stages = api.projectTaProductStages(snapshot);
    expect(stages[2]).toMatchObject({
      stageId: "review_dimension_traceability",
      status: "cancelled",
    });
    expect(stages[4]).toMatchObject({
      stageId: "evaluate_and_publish",
      status: "pending",
    });
  });

  it("keeps failed terminal state as workflow attention when no stage evidence exists", () => {
    const api = requireApi();
    const stages = api.projectTaProductStages(baseSnapshot({ state: "failed", activeAttempt: null }));

    expect(stages[0]).toMatchObject({
      stageId: "prepare_workbook",
      status: "action_required",
    });
    expect(stages.every((stage) => stage.status !== "failed")).toBe(true);
    expect(stages.every((stage) => stage.status !== "cancelled")).toBe(true);
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
    || typeof api.projectTaProductStages !== "function"
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
    interactionLanguage: {
      languageTag: "en",
      uiCatalogLanguage: "en" as const,
      lockedAtTurnId: "turn-1",
      source: "workflow_start" as const,
      fallbackUsed: false,
    },
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

function f2Evidence(): F2Evidence {
  return {
    inputRevision: 3,
    f2ReportArtifactId: "f2-report-3",
    f2ReportContentHash: "b".repeat(64),
  };
}

function f2Report(worksheets: readonly ReturnType<typeof worksheet>[]) {
  return {
    status: worksheets.every((item) => item.status === "ready")
      ? "completed"
      : worksheets.every((item) => item.status === "blocked") ? "blocked" : "partiallyBlocked",
    workbook: { contentHash: "a".repeat(64) },
    worksheets,
  } as unknown as F2Report;
}

function worksheet(
  worksheetName: string,
  options: {
    readonly imageAvailable?: boolean;
    readonly missingRequiredFields?: readonly string[];
    readonly missingIdentifiers?: readonly ("partNumber" | "drawingNumber" | "dimCharacteristicId")[];
    readonly sourceRow?: number;
  } = {},
) {
  const imageAvailable = options.imageAvailable ?? true;
  const missingRequiredFields = options.missingRequiredFields ?? [];
  const missingIdentifiers = options.missingIdentifiers ?? [];
  const blocked = !imageAvailable || missingRequiredFields.length > 0;
  return {
    worksheetName,
    status: blocked ? "blocked" as const : "ready" as const,
    tolerancePathImageStatus: imageAvailable ? "available" as const : "unavailable" as const,
    systemSpecificationIssues: [],
    f4CalculabilityIssues: [],
    missingFieldSummary: [
      ...missingRequiredFields.map((field) => ({ field, factorCount: 1, sourceRows: [options.sourceRow ?? 2] })),
      ...(imageAvailable ? [] : [{ field: "tolerancePathImage", factorCount: 0, sourceRows: [] }]),
    ],
    rows: missingRequiredFields.length > 0 || missingIdentifiers.length > 0
      ? [{ sourceRow: options.sourceRow ?? 2, missingRequiredFields, missingIdentifiers }]
      : [],
  };
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