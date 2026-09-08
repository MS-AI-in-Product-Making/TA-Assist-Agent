import { createTypedError } from "@ai-assist/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as workbench from "./index.js";

const SESSION_ID = "session-task-4";
const PREVIOUS_WORKBOOK_HASH = "b".repeat(64);
const HISTORICAL_WORKBOOK_HASH = "c".repeat(64);
const ENGLISH_LOCK = {
  languageTag: "en-US",
  uiCatalogLanguage: "en",
  lockedAtTurnId: "turn-start-en",
  source: "workflow_start",
  fallbackUsed: false,
} as const;

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
    | "set_interaction_language"
    | "confirm_initial_scope"
    | "confirm_downstream_scope"
    | "confirm_ado_decision"
    | "confirm_image_decision"
    | "confirm_analysis_context"
    | "confirm_optimization_targets"
    | "retry"
    | "cancel"
    | "complete_review"
    | "save_what_if_draft"
    | "confirm_what_if_tolerance_promotion";
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

    expect(() => api.acceptAttemptResult(
      runningSnapshot("f5_running"),
      completedAttemptResult(),
    )).toThrow(/multimodal/i);

    const multimodalReference = {
      artifactId: "f5-multimodal:2",
      kind: "f5_multimodal" as const,
      revision: 2,
      validated: true,
      reviewContextId: "c".repeat(64),
      relativePath: "runtime/workbench/multimodal/session-task-4/5/artifact.json",
      contentHash: "d".repeat(64),
    };
    expect(() => api.acceptAttemptResult(
      runningSnapshot("f5_running", [multimodalReference]),
      completedAttemptResult({ artifactReferences: [{ ...multimodalReference, contentHash: "e".repeat(64) }] }),
    )).toThrow(/multimodal/i);

    expect(api.acceptAttemptResult(
      runningSnapshot("f5_running", [multimodalReference]),
      completedAttemptResult({ artifactReferences: [multimodalReference] }),
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

  it("records two distinct worksheet confirmations with user provenance", () => {
    const api = requireApi();
    const initial = api.reduceSessionCommand(
      baseSnapshot({
        state: "initial_scope_required",
        artifactRefs: [{ artifactId: "f2-report-0", kind: "f2_report", revision: 0, validated: true }],
      }),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "confirm-initial-user",
        expectedRevision: 0,
        command: "confirm_initial_scope",
        payload: { workbookHash: "a".repeat(64), worksheetNames: ["Analysis-A"] },
      },
    );
    const ready = api.acceptAttemptResult(initial, {
      attemptId: initial.activeAttempt!.attemptId,
      status: "completed",
      result: {},
      endedAt: "2026-08-24T00:05:00.000Z",
    });
    const downstream = api.reduceSessionCommand(
      ready,
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "confirm-downstream-user",
        expectedRevision: ready.revision,
        command: "confirm_downstream_scope",
        payload: downstreamPayload({ inputRevision: ready.inputRevision }),
      },
    );

    expect(initial.initialScopeSelection).toMatchObject({
      workbookContentHash: "a".repeat(64),
      selectedWorksheetNames: ["Analysis-A"],
      confirmed: true,
      provenance: "user",
    });
    expect(downstream.downstreamScopeSelection).toMatchObject({
      workbookContentHash: "a".repeat(64),
      selectedWorksheetNames: ["Analysis-A"],
      confirmed: true,
      provenance: "user",
      decision: "continue_ready",
      inputRevision: ready.inputRevision,
      f2ReportArtifactId: "f2-report-0",
      f2ReportContentHash: "b".repeat(64),
      findingDigest: "c".repeat(64),
    });
  });

  it("rejects downstream confirmation bound to a different input revision", () => {
    const api = requireApi();
    const snapshot = baseSnapshot({
      state: "downstream_scope_required",
      revision: 2,
      inputRevision: 4,
      initialScopeSelection: {
        workbookContentHash: "a".repeat(64),
        selectedWorksheetNames: ["Analysis-A"],
        confirmed: true,
        provenance: "user",
      },
      artifactRefs: [{ artifactId: "f2-report-4", kind: "f2_report", revision: 4, validated: true }],
    });

    expect(() => api.reduceSessionCommand(snapshot, {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: "confirm-downstream-stale-input",
      expectedRevision: 2,
      command: "confirm_downstream_scope",
      payload: downstreamPayload({ inputRevision: 3, f2ReportArtifactId: "f2-report-4" }),
    })).toThrow(/input revision/i);
  });

  it("records fixture provenance for auto initial confirmation", () => {
    const api = requireApi();
    const auto = api.reduceSessionCommand(
      baseSnapshot({ state: "initial_scope_required" }),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "auto-initial",
        expectedRevision: 0,
        command: "auto_confirm_initial_scope",
        payload: { workbookHash: "a".repeat(64), worksheetNames: ["Analysis-A"] },
      } as SessionCommand,
    );

    expect(auto.initialScopeSelection).toMatchObject({
      workbookContentHash: "a".repeat(64),
      selectedWorksheetNames: ["Analysis-A"],
      confirmed: true,
      provenance: "internal_fixture",
    });
  });

  it("rejects downstream confirmation when workbook hash drifts from initial scope", () => {
    const api = requireApi();
    const snapshot = baseSnapshot({
      state: "downstream_scope_required",
      revision: 2,
      initialScopeSelection: {
        workbookContentHash: "a".repeat(64),
        selectedWorksheetNames: ["Analysis-A"],
        confirmed: true,
        provenance: "user",
      },
    });

    expect(() => api.reduceSessionCommand(snapshot, {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: "confirm-downstream-hash-drift",
      expectedRevision: 2,
      command: "confirm_downstream_scope",
      payload: downstreamPayload({ workbookHash: "b".repeat(64) }),
    })).toThrow(/workbook hash/i);
  });

  it("rejects downstream confirmation that contains worksheets outside initial scope", () => {
    const api = requireApi();
    const snapshot = baseSnapshot({
      state: "downstream_scope_required",
      revision: 2,
      initialScopeSelection: {
        workbookContentHash: "a".repeat(64),
        selectedWorksheetNames: ["Analysis-A"],
        confirmed: true,
        provenance: "user",
      },
    });

    expect(() => api.reduceSessionCommand(snapshot, {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: "confirm-downstream-out-of-scope",
      expectedRevision: 2,
      command: "confirm_downstream_scope",
      payload: downstreamPayload({ worksheetNames: ["Analysis-B"] }),
    })).toThrow(/outside the confirmed initial scope/i);
  });

  it("rejects downstream confirmation that differs from the materialized exact ready set", () => {
    const api = requireApi();
    const snapshot = baseSnapshot({
      state: "downstream_scope_required",
      revision: 2,
      initialScopeSelection: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A", "Analysis-B"], confirmed: true, provenance: "user" },
    });

    expect(() => api.reduceSessionCommand(snapshot, {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: "confirm-downstream-forged-subset",
      expectedRevision: 2,
      command: "confirm_downstream_scope",
      payload: downstreamPayload({ worksheetNames: ["Analysis-A"], downstreamReadyWorksheetNames: ["Analysis-A", "Analysis-B"] }),
    })).toThrow(/exact downstream-ready set/i);
    expect(() => api.reduceSessionCommand(snapshot, {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: "confirm-downstream-reordered",
      expectedRevision: 2,
      command: "confirm_downstream_scope",
      payload: downstreamPayload({ worksheetNames: ["Analysis-B", "Analysis-A"], downstreamReadyWorksheetNames: ["Analysis-A", "Analysis-B"] }),
    })).toThrow(/exact downstream-ready set/i);
  });

  it("saves one What-if draft and requires a separate promotion confirmation", () => {
    const api = requireApi();
    const draft = {
      contractVersion: "f8-scenario-draft-v1" as const,
      draftId: "draft-a",
      sessionId: SESSION_ID,
      worksheetName: "Analysis-A",
      inputRevision: 1,
      status: "saved" as const,
      mode: "WHAT_IF" as const,
      baselineWorkbookHash: "a".repeat(64),
      baselineRunReference: "f4-run-a",
      calculationReference: "what-if:draft-a",
      change: { upperTolerance: 0.8 },
    };
    const saved = api.reduceSessionCommand(baseSnapshot({ state: "review_required", inputRevision: 1 }), {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: "save-draft",
      expectedRevision: 0,
      command: "save_what_if_draft",
      payload: { draft },
    });
    expect(saved).toMatchObject({ state: "review_required", revision: 1, scenarioDrafts: [draft] });

    const promotionPreview = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      targetVersion: "f6-optimization-targets-v1" as const,
      workbookContentHash: "a".repeat(64),
      worksheets: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        baselineIdentity: { calculationVersion: "excel-ta-v1" as const, projectReference: "project-a", runReference: "f4-run-a", workbookContentHash: "a".repeat(64), worksheetName: "Analysis-A", tableId: "table-a" },
        targets: [{ targetId: "Analysis-A:table-a:2:tolerance", targetType: "factor_tolerance" as const, factor: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, factorName: "factor-a", unit: "mm" }, upperTolerance: 0.8, lowerTolerance: -1, unit: "mm" }],
      }],
    };
    const promoted = api.reduceSessionCommand(saved, {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: "confirm-promotion",
      expectedRevision: 1,
      command: "confirm_what_if_tolerance_promotion",
      payload: { draftId: "draft-a", confirmed: true, promotionPreview },
    });
    expect(promoted).toMatchObject({
      state: "review_required",
      revision: 2,
      scenarioDrafts: [{ draftId: "draft-a", status: "promoted_to_f6_targets", promotionPreview }],
    });
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

  it("records local-only governance as not requested and proceeds directly to F4", () => {
    const api = requireApi();
    const result = api.reduceSessionCommand(
      baseSnapshot({ state: "ado_decision_required", revision: 4 }),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "ado-local-only",
        expectedRevision: 4,
        command: "confirm_ado_decision",
        payload: { decision: "local_only" },
      },
    );

    expect(result.state).toBe("f4_running");
    expect(result.activeAttempt).toMatchObject({ stage: "f4_running", status: "running" });
    expect(result.priorRunReferences).toEqual([
      expect.objectContaining({ featureId: "F3", referenceId: "ado-not-requested" }),
    ]);
  });

  it("keeps ADO host validation pending until an independent confirmed write", () => {
    const api = requireApi();
    const pending = api.reduceSessionCommand(
      baseSnapshot({ state: "ado_decision_required", revision: 4 }),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "ado-create-new",
        expectedRevision: 4,
        command: "confirm_ado_decision",
        payload: { decision: "create_new" },
      },
    );

    expect(pending.state).toBe("ado_action_pending");
    expect(pending.activeAttempt).toBeNull();
    expect(api.acceptAttemptResult(pending, completedAttemptResult()).state).toBe("ado_action_pending");
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
    expect(replaced.interactionLanguage).toEqual(ENGLISH_LOCK);
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

  it("changes interaction language only through the dedicated revision-bound command", () => {
    const api = requireApi();
    const changed = api.reduceSessionCommand(
      baseSnapshot({ state: "review_required", revision: 9 }),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "set-language-zh",
        expectedRevision: 9,
        command: "set_interaction_language",
        payload: {
          turnId: "turn-language-zh",
          explicitLanguageTag: "zh-CN",
        },
      },
    );

    expect(changed.interactionLanguage).toEqual({
      languageTag: "zh-CN",
      uiCatalogLanguage: "zh",
      lockedAtTurnId: "turn-language-zh",
      source: "explicit_user_change",
      fallbackUsed: false,
    });
    expect(changed.state).toBe("review_required");
    expect(changed.activeAttempt).toBeNull();
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

  it("completes the review with an immutable F7 placeholder outcome and no F7 attempt", () => {
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
    expect(completed.priorRunReferences).toEqual([
      expect.objectContaining({
        featureId: "F7",
        referenceId: "f7-placeholder-input-0",
        contractVersion: "f7-workbench-placeholder-v1",
        runReference: `f7-placeholder:${SESSION_ID}:0`,
      }),
    ]);
  });

  it("cannot enter F7 even when governance reports F7 as available", async () => {
    const api = await importStateMachineWithGovernanceStatus("available");

    const completed = api.reduceSessionCommand(
      baseSnapshot({ state: "review_required", revision: 9 }),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "complete-review-available-001",
        expectedRevision: 9,
        command: "complete_review",
        payload: { confirmed: true },
      },
    );

    expect(completed.state).toBe("completed");
    expect(completed.activeAttempt).toBeNull();
    expect(completed.priorRunReferences).toEqual([
      expect.objectContaining({
        featureId: "F7",
        referenceId: "f7-placeholder-input-0",
        contractVersion: "f7-workbench-placeholder-v1",
        runReference: `f7-placeholder:${SESSION_ID}:0`,
      }),
    ]);
  });

  it("requires server-owned draft identity for confirm F6 decisions", () => {
    const api = requireApi();

    expect(() => api.reduceSessionCommand(
      baseSnapshot({ state: "analysis_context_decision_required", inputRevision: 2 }),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "analysis-context-missing-draft",
        expectedRevision: 0,
        command: "confirm_analysis_context",
        payload: { decision: "confirm", draftId: "", draftHash: "abc" },
      },
    )).toThrow();

    expect(() => api.reduceSessionCommand(
      baseSnapshot({ state: "analysis_context_decision_required", inputRevision: 2 }),
      {
        contractVersion: "f8-session-command-v1",
        sessionId: SESSION_ID,
        commandId: "analysis-context-confirm",
        expectedRevision: 0,
        command: "confirm_analysis_context",
        payload: {
          decision: "confirm",
          draftId: "draft-analysis-context-1",
          draftHash: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
        },
      },
    )).not.toThrow();
  });

  it("keeps not_provided/decline decisions independent across the two F6 gates", () => {
    const api = requireApi();

    const afterContextNotProvided = api.reduceSessionCommand(
      baseSnapshot({
        state: "analysis_context_decision_required",
        inputRevision: 2,
        pendingAnalysisContextDraft: {
          draftId: "draft-analysis-context-pending",
          kind: "analysis_context",
          inputRevision: 2,
          reviewContextId: "a".repeat(64),
          artifactId: "f6-input-draft:analysis_context:draft-analysis-context-pending",
          contentHash: "b".repeat(64),
          status: "preview_required",
        },
        pendingOptimizationTargetsDraft: {
          draftId: "draft-targets-pending",
          kind: "optimization_targets",
          inputRevision: 2,
          reviewContextId: "a".repeat(64),
          artifactId: "f6-input-draft:optimization_targets:draft-targets-pending",
          contentHash: "c".repeat(64),
          status: "preview_required",
        },
      }),
      analysisContextCommand(0, "not_provided"),
    );

    expect(afterContextNotProvided.state).toBe("optimization_targets_decision_required");
    expect(afterContextNotProvided.pendingAnalysisContextDraft).toBeUndefined();
    expect(afterContextNotProvided.pendingOptimizationTargetsDraft).toMatchObject({
      draftId: "draft-targets-pending",
    });
    const contextRef = afterContextNotProvided.priorRunReferences.findLast((reference) =>
      reference.featureId === "F6" && reference.referenceId.startsWith("f6-analysis-context:"));
    expect(contextRef).toMatchObject({ referenceId: "f6-analysis-context:not_provided" });
    expect(contextRef?.runReference).toBeUndefined();

    const afterTargetsDecline = api.reduceSessionCommand(
      afterContextNotProvided,
      optimizationTargetsCommand(afterContextNotProvided.revision, "decline"),
    );
    expect(afterTargetsDecline.state).toBe("f6_running");
    expect(afterTargetsDecline.pendingOptimizationTargetsDraft).toBeUndefined();
    const targetsRef = afterTargetsDecline.priorRunReferences.findLast((reference) =>
      reference.featureId === "F6" && reference.referenceId.startsWith("f6-optimization-targets:"));
    expect(targetsRef).toMatchObject({ referenceId: "f6-optimization-targets:decline" });
    expect(targetsRef?.runReference).toBeUndefined();
  });
});

afterEach(() => {
  vi.doUnmock("@ai-assist/governance");
  vi.resetModules();
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
    interactionLanguage: ENGLISH_LOCK,
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

function runningSnapshot(state: "f3_running" | "f4_running" | "f5_running" | "f6_running", artifactRefs?: unknown[]) {
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
    ...(artifactRefs === undefined ? {} : { artifactRefs }),
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
  return analysisContextCommand(expectedRevision, "confirm");
}

function analysisContextCommand(expectedRevision: number, decision: "confirm" | "not_provided" | "decline"): SessionCommand {
  return {
    contractVersion: "f8-session-command-v1",
    sessionId: SESSION_ID,
    commandId: `analysis-context-${decision}`,
    expectedRevision,
    command: "confirm_analysis_context",
    payload: decision === "confirm"
      ? {
          decision,
          draftId: "draft-analysis-context-1",
          draftHash: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
        }
      : { decision },
  };
}

function optimizationTargetsCommand(expectedRevision: number, decision: "confirm" | "not_provided" | "decline" = "confirm"): SessionCommand {
  return {
    contractVersion: "f8-session-command-v1",
    sessionId: SESSION_ID,
    commandId: `optimization-targets-${decision}`,
    expectedRevision,
    command: "confirm_optimization_targets",
    payload: decision === "confirm"
      ? {
          decision,
          draftId: "draft-optimization-targets-1",
          draftHash: "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
        }
      : { decision },
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

async function importStateMachineWithGovernanceStatus(status: string): Promise<Required<WorkbenchExports>> {
  vi.resetModules();
  vi.doMock("@ai-assist/governance", () => ({
    getFeatureStatus: (featureId: string) => featureId === "F7"
      ? { featureId, status }
      : { featureId, status: "available" },
  }));
  const api = await import("./index.js") as WorkbenchExports;

  if (
    typeof api.reduceSessionCommand !== "function"
    || typeof api.acceptAttemptResult !== "function"
    || typeof api.canRetryAttempt !== "function"
  ) {
    throw new Error("Expected workbench state-machine exports to be defined.");
  }

  return api as Required<WorkbenchExports>;
}

function downstreamPayload(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    decision: "continue_ready",
    workbookHash: "a".repeat(64),
    inputRevision: 0,
    worksheetNames: ["Analysis-A"],
    downstreamReadyWorksheetNames: ["Analysis-A"],
    f2ReportArtifactId: "f2-report-0",
    f2ReportContentHash: "b".repeat(64),
    findingDigest: "c".repeat(64),
    ...overrides,
  };
}