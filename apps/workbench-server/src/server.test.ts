import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it, vi } from "vitest";
import { get } from "node:http";
import { DatabaseSync } from "node:sqlite";

import { buildWorkbenchServer } from "./server.js";
import { createConversationStore } from "@ai-assist/conversation";
import { createTypedError } from "@ai-assist/contracts";
import { createHostActionStore, createReviewContextId, createSessionStore, openSessionStore, projectWorksheetReview, reduceSessionCommand, selectCompleteReviewContext } from "@ai-assist/workbench";
import { renderF3AdoMarkdown } from "@ai-assist/workflow-runners";
import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.js";
import type { PersistentWorkerQueueOptions, StageJob } from "./sqlite-worker-queue.js";
import type { TaWorkbookOrchestrator } from "@ai-assist/workbench";

function testRoot(name: string): string {
  return join(".tmp", `${name}-${randomUUID()}`);
}

const REVIEW_CONTEXT = {
  workbookHash: "a".repeat(64),
  downstreamSelectionHash: createHash("sha256").update(JSON.stringify(["Analysis-A"])).digest("hex"),
  baselineRunReference: "f2-run-2026-08-25",
};
const REVIEW_CONTEXT_ID = createReviewContextId(REVIEW_CONTEXT);

function structuredReviewResult(featureId: "F4" | "F5" | "F6", includeContext = true) {
  const artifacts = featureId === "F4"
    ? [{ artifactId: "f4-calculation", kind: "f4_calculation", relativePath: "f4/Feature4-Calculation.json", contentHash: "1".repeat(64) }]
    : featureId === "F5"
      ? [{ artifactId: "f5-report", kind: "f5_report", relativePath: "f5/Feature5-Report.json", contentHash: "2".repeat(64) }]
      : [
          { artifactId: "f6-optimization", kind: "f6_optimization", relativePath: "f6/Feature6-Optimization.json", contentHash: "3".repeat(64) },
          { artifactId: "f6-report", kind: "f6_report", relativePath: "f6/Feature6-Report.json", contentHash: "4".repeat(64) },
        ];
  return { featureId, status: "completed", ...(includeContext ? { reviewContext: REVIEW_CONTEXT } : {}), artifactReferences: artifacts };
}

function f3Report(factorDescription: string, overrides: Record<string, unknown> = {}) {
  const row = {
    factorInstanceId: "1".repeat(64),
    drawingDimensionKey: "2".repeat(64),
    deviceLevelDim: "TP_Gap_X",
    dimensionDescription: "Gap X",
    partCategory: "Display",
    partSubsystem: "Panel",
    drawingNumber: "DWG-1",
    dimId: "307",
    factorDescription,
    nominal: 3.145,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    sigmaLevel: 4,
    dimIdStatus: "valid",
    qualitySignals: [],
    governanceStatus: "complete",
    imageReference: { artifact: "f1", relativePath: "worksheets/Analysis-A/tolerance-path.png", contentHash: "3".repeat(64), worksheetName: "Analysis-A" },
    source: { worksheetName: "Analysis-A", tableId: "factor-table-1", sourceRow: 14, sourceCells: { factorName: "Analysis-A!E14" } },
    ...overrides,
  };
  const governanceStatus = row.governanceStatus === "complete" ? "complete" : "needs_governance";
  const completeCount = governanceStatus === "complete" ? 1 : 0;
  const governanceRequiredCount = governanceStatus === "complete" ? 0 : 1;
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: governanceStatus === "complete" ? "completed" : "governance_required",
    artifactRoot: "controlled/f1",
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "Anonymous gap", rows: [row] }],
    ado: { status: "not_requested" },
    summary: { worksheetCount: 1, factorCount: 1, completeCount, governanceRequiredCount, duplicateConflictCount: Array.isArray(row.qualitySignals) && row.qualitySignals.includes("duplicate_conflict") ? 1 : 0 },
  } as const;
}

async function writeJsonArtifact(rootDir: string, relativePath: string, data: unknown): Promise<string> {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await mkdir(dirname(join(rootDir, relativePath)), { recursive: true });
  await writeFile(join(rootDir, relativePath), text);
  return createHash("sha256").update(text).digest("hex");
}

async function writeImageArtifactFixture(rootDir: string, relativePath: string, bytes: Uint8Array): Promise<void> {
  const target = join(rootDir, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

function f2ImageBindingReportForArtifactTest(contentHash: string, entries: Array<{ worksheetName: string; relativePath: string }>) {
  const worksheets = entries.map((entry, index) => ({
    worksheetName: entry.worksheetName,
    toleranceLoopDescription: `${entry.worksheetName} loop`,
    tolerancePathImageStatus: "available",
    systemSpecification: { status: "available", ...imageBindingSystemSpec() },
    systemSpecificationIssues: [],
    f4CalculabilityIssues: [],
    missingFieldSummary: [],
    status: "ready",
    rows: [{
      worksheetName: entry.worksheetName,
      tableId: `factor-table-${index + 1}`,
      sourceRow: 14,
      actualFields: imageBindingActualFields(),
      displayFields: {
        factorName: "Gap X",
        partName: "Display cover",
        drawingNumber: "DWG-1",
        dimCharacteristicId: "307",
        partCategory: "Display",
        nominalValue: "1.2",
        upperTolerance: "0.2",
        lowerTolerance: "-0.2",
        longTermSafetyFactor: "1",
        sigmaLevel: "4",
        distribution: "normal",
        mean: "1.2",
        tolerance: "0.4",
        oneSigma: "0.05",
        percentContributionToSigma: "0.42",
        notes: "critical display stack",
      },
      sourceCells: {},
      imageReference: { artifact: "f1", relativePath: entry.relativePath, contentHash, worksheetName: entry.worksheetName },
      missingRequiredFields: [],
      missingIdentifiers: [],
      capabilityStatus: "in_library_recommended",
      f0KnowledgeBaseVersion: "v1",
      recommendation: { kind: "public", capabilityEntryId: "cap-gap-x", toleranceMin: 0.1, toleranceMax: 0.4, unit: "mm", distribution: "normal" },
      adoReminderRequested: false,
    }],
  }));

  const f4Handoffs = entries.map((entry, index) => ({
    contractVersion: "v1",
    handoffVersion: "f4-handoff-v1",
    inputClassification: "confidential",
    status: "ready",
    workbookContentHash: "a".repeat(64),
    worksheetName: entry.worksheetName,
    toleranceLoopDescription: `${entry.worksheetName} loop`,
    systemSpecification: {
      designNominal: 1.2,
      lowerSpecLimit: { status: "available", sourceLabel: "LSL", sourceCell: "Analysis-A!B2", displayValue: "0.6", actualValue: 0.6, valueOrigin: "numeric_literal" },
      upperSpecLimit: { status: "available", sourceLabel: "USL", sourceCell: "Analysis-A!B3", displayValue: "1.8", actualValue: 1.8, valueOrigin: "numeric_literal" },
      targetSigmaLevel: { status: "available", sourceLabel: "Sigma", sourceCell: "Analysis-A!B4", displayValue: "4.2", actualValue: 4.2, valueOrigin: "numeric_literal" },
      targetCpk: 1.4,
      additionalMeanShift: { status: "available", sourceLabel: "Mean shift", sourceCell: "Analysis-A!B5", displayValue: "0", actualValue: 0, valueOrigin: "numeric_literal" },
    },
    factors: [{
      tableId: `factor-table-${index + 1}`,
      sourceRow: 14,
      unit: "mm",
      actualFields: imageBindingActualFields(),
      sourceCells: {},
    }],
  }));

  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: { fileName: "anonymous.xlsx", contentHash: "a".repeat(64), f1GeneratedAt: "2026-08-31T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "managed/f2",
    worksheets,
    f4Handoffs,
    adoEvents: [],
    summary: {
      worksheetsChecked: worksheets.length,
      blockedWorksheetCount: 0,
      readyWorksheetCount: worksheets.length,
      factorRowCount: worksheets.length,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: 0,
      internalWithinGuidanceCount: 0,
      internalGuidanceExceededCount: 0,
      f0InformationInsufficientCount: 0,
      publicLibraryMatchCount: worksheets.length,
      nonF0ProcessCategoryCount: 0,
      unableToCheckCount: 0,
      publicToleranceDifferenceCount: 0,
      publicDistributionDifferenceCount: 0,
      missingDimIdCount: 0,
      missingPartNumberCount: 0,
    },
  };
}

function imageBindingActualFields() {
  return { factorName: "Gap X", partName: "Display cover", drawingNumber: "DWG-1", dimCharacteristicId: "307", partCategory: "Display", nominalValue: 1.2, upperTolerance: 0.2, lowerTolerance: -0.2, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal", mean: 1.2, tolerance: 0.4, oneSigma: 0.05, percentContributionToSigma: 0.42, notes: "critical display stack" };
}

function imageBindingSystemSpec() {
  return {
    designNominal: { status: "available", sourceLabel: "Nominal", sourceCell: "Analysis-A!B1", displayValue: "1.2", actualValue: 1.2, valueOrigin: "numeric_literal" },
    lowerSpecLimit: { status: "available", sourceLabel: "LSL", sourceCell: "Analysis-A!B2", displayValue: "0.6", actualValue: 0.6, valueOrigin: "numeric_literal" },
    upperSpecLimit: { status: "available", sourceLabel: "USL", sourceCell: "Analysis-A!B3", displayValue: "1.8", actualValue: 1.8, valueOrigin: "numeric_literal" },
    targetSigmaLevel: { status: "available", sourceLabel: "Sigma", sourceCell: "Analysis-A!B4", displayValue: "4.2", actualValue: 4.2, valueOrigin: "numeric_literal" },
    additionalMeanShift: { status: "available", sourceLabel: "Mean shift", sourceCell: "Analysis-A!B5", displayValue: "0", actualValue: 0, valueOrigin: "numeric_literal" },
  };
}

async function immediateQueue(options: PersistentWorkerQueueOptions) {
  return {
    async enqueue(job: StageJob) {
      await options.sessionStore.persistAttempt({ attemptId: job.attemptId, status: "running", jobId: job.jobId, stage: job.stage });
      if (options.worker === undefined) {
        await options.sessionStore.markDependencyFailure(job.attemptId, "No worker executor is configured; retry is required.", job);
        return { jobId: job.jobId, attemptId: job.attemptId, status: "failed" as const };
      }
      try {
        const result = await options.worker(job);
        const accepted = await options.sessionStore.markAttemptResult(job.attemptId, result, "running", job);
        if (!accepted) {
          await options.sessionStore.markDependencyFailure(job.attemptId, "Attempt result was rejected by the session store.", job);
          return { jobId: job.jobId, attemptId: job.attemptId, status: "failed" as const };
        }
        return { jobId: job.jobId, attemptId: job.attemptId, status: "completed" as const };
      } catch {
        await options.sessionStore.markDependencyFailure(job.attemptId, "Worker failed.", job);
        return { jobId: job.jobId, attemptId: job.attemptId, status: "failed" as const };
      }
    },
    async cancel() { return false; },
    async reconcile() {},
  };
}

describe("workbench server routes", () => {
  it("rejects client-composed Web context before writing conversation turns", async () => {
    const rootDir = testRoot("workbench-server-shared-conversation");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "34343434-3434-4343-8343-343434343434";
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    let closed = false;
    try {
      const browser = await server.testAuthenticate(sessionId);
      const turn = { contractVersion: "ta-conversation-turn-v1", turnId: "web-turn-1", sessionId, sequence: 1, source: "web", role: "user", content: [{ kind: "text", text: "继续分析" }], createdAt: "2026-08-25T00:00:00.000Z", relatedArtifactIds: [] };
      const response = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/conversation`, headers: browser.headers, payload: { turn, context: { relatedArtifactIds: [] } } });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "conversation_schema_rejected" });
      await server.close();
      closed = true;
      const conversation = await createConversationStore({ rootDir: join(rootDir, "runtime", "workbench") });
      try {
        const turns = await conversation.readTurns(sessionId);
        expect(turns).toHaveLength(0);
      } finally {
        await conversation.close();
      }
    } finally {
      if (!closed) await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("calculates without persistence, then saves and independently promotes one What-if draft", async () => {
    const rootDir = testRoot("workbench-server-what-if");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "33333333-3333-4333-8333-333333333333";
    const promotionPreview = {
      contractVersion: "v1" as const, inputClassification: "confidential" as const, targetVersion: "f6-optimization-targets-v1" as const, workbookContentHash: "a".repeat(64),
      worksheets: [{ worksheetName: "Analysis-A", tableId: "table-a", baselineIdentity: { calculationVersion: "excel-ta-v1" as const, projectReference: "project-a", runReference: "f4-run-a", workbookContentHash: "a".repeat(64), worksheetName: "Analysis-A", tableId: "table-a" }, targets: [{ targetId: "Analysis-A:table-a:2:tolerance", targetType: "factor_tolerance" as const, factor: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, factorName: "factor-a", unit: "mm" }, upperTolerance: 0.8, lowerTolerance: -1, unit: "mm" }] }],
    };
    const calculatedDraft = {
      contractVersion: "f8-scenario-draft-v1" as const, draftId: "draft-a", sessionId, worksheetName: "Analysis-A", inputRevision: 1, status: "calculated" as const, mode: "WHAT_IF" as const,
      baselineWorkbookHash: "a".repeat(64), baselineRunReference: "f4-run-a", calculationReference: "what-if:draft-a", change: { upperTolerance: 0.8 },
      calculationMetrics: { mean: 0, rssSigma: 0.8, cp: 1.2, cpkL: 1.1, cpkU: 1.3, cpk: 1.1, statisticalMargin: 2, worstCaseMargin: 1 },
    };
    const whatIfService = { calculate: vi.fn(async () => calculatedDraft), createPromotionPreview: vi.fn(async () => promotionPreview) };
    const server = await buildWorkbenchServer({ rootDir, whatIfService, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({ contractVersion: "f8-session-command-v1", sessionId, commandId: "seed-review", expectedRevision: 0, command: "upload_workbook", payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" } }, async (snapshot) => ({ snapshot: { ...snapshot, revision: 1, inputRevision: 1, state: "review_required", activeAttempt: null } }));
      } finally { await store.close(); }
      const requestBody = { draftId: "draft-a", worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, inputRevision: 1, patch: { upperTolerance: 0.8 } };
      const calculated = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/what-if/calculate`, headers: browser.headers, payload: requestBody });
      expect(calculated.statusCode).toBe(200);
      expect(calculated.json()).toMatchObject({ status: "calculated", calculationMetrics: { cpk: 1.1 } });
      const calculatedStore = await openSessionStore({ rootDir, sessionId });
      try {
        expect((await calculatedStore.readSnapshot()).revision).toBe(1);
      } finally {
        await calculatedStore.close();
      }

      const saved = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/commands`, headers: browser.headers, payload: { contractVersion: "f8-session-command-v1", sessionId, commandId: "save-draft", expectedRevision: 1, command: "save_what_if_draft", payload: requestBody } });
      expect(saved.statusCode).toBe(202);
      expect(saved.json()).toMatchObject({ revision: 2, scenarioDrafts: [{ draftId: "draft-a", status: "saved" }] });
      const promotionCommand = { contractVersion: "f8-session-command-v1", sessionId, commandId: "promote-draft", expectedRevision: 2, command: "confirm_what_if_tolerance_promotion", payload: { draftId: "draft-a", confirmed: true } };
      const promoted = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/commands`, headers: browser.headers, payload: promotionCommand });
      expect(promoted.statusCode).toBe(202);
      expect(promoted.json()).toMatchObject({ revision: 3, scenarioDrafts: [{ status: "promoted_to_f6_targets", promotionPreview }] });
      const replayed = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/commands`, headers: browser.headers, payload: promotionCommand });
      expect(replayed.statusCode).toBe(202);
      expect(replayed.json()).toEqual(promoted.json());
      expect(whatIfService.calculate).toHaveBeenCalledTimes(2);
      expect(whatIfService.calculate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tableId: "table-a", sourceRow: 2 }));
      expect(whatIfService.createPromotionPreview).toHaveBeenCalledOnce();
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("reloads with the governed baseline after transient worksheet preview and exposes a saved scenario only after explicit save", async () => {
    const rootDir = testRoot("workbench-server-worksheet-preview-reload");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "35353535-3535-4353-8353-353535353535";
    const worksheetDraft = {
      contractVersion: "f8-scenario-draft-v1" as const,
      draftId: "draft-worksheet",
      sessionId,
      worksheetName: "Analysis-A",
      inputRevision: 1,
      status: "calculated" as const,
      mode: "WHAT_IF" as const,
      baselineWorkbookHash: "a".repeat(64),
      baselineRunReference: "f4-run-a",
      calculationReference: "what-if:worksheet-draft",
      calculationMetrics: { mean: 0, rssSigma: 0.8, cp: 1.2, cpkL: 1.1, cpkU: 1.3, cpk: 1.1, statisticalMargin: 2, worstCaseMargin: 1 },
      factorOverrides: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, upperTolerance: 0.8 }],
      factorResults: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, mean: 0, tolerance: 1.8, oneSigma: 0.8, contribution: 0.7 }],
    };
    const whatIfService = {
      calculate: vi.fn(async () => ({ ...worksheetDraft, change: { upperTolerance: 0.8 } })),
      calculateWorksheet: vi.fn(async () => worksheetDraft),
      createPromotionPreview: vi.fn(async () => ({
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
      })),
    };
    const server = await buildWorkbenchServer({ rootDir, whatIfService, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({ contractVersion: "f8-session-command-v1", sessionId, commandId: "seed-review", expectedRevision: 0, command: "upload_workbook", payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" } }, async (snapshot) => ({ snapshot: { ...snapshot, revision: 1, inputRevision: 1, state: "review_required", activeAttempt: null } }));
      } finally {
        await store.close();
      }

      const previewPayload = {
        draftId: "draft-worksheet",
        worksheetName: "Analysis-A",
        inputRevision: 1,
        factorOverrides: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, upperTolerance: 0.8 }],
      };
      const preview = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/what-if/calculate-worksheet`, headers: browser.headers, payload: previewPayload });
      expect(preview.statusCode).toBe(200);
      expect(preview.json()).toMatchObject({ status: "calculated", calculationReference: "what-if:worksheet-draft" });

      const afterPreviewStore = await openSessionStore({ rootDir, sessionId });
      try {
        const reloaded = await afterPreviewStore.readSnapshot();
        expect(reloaded.revision).toBe(1);
        expect(reloaded.scenarioDrafts).toBeUndefined();
      } finally {
        await afterPreviewStore.close();
      }

      const saved = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "save-worksheet-draft",
          expectedRevision: 1,
          command: "save_what_if_draft",
          payload: { draftId: "draft-worksheet", worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, inputRevision: 1, patch: { upperTolerance: 0.8 } },
        },
      });
      expect(saved.statusCode).toBe(202);
      expect(saved.json()).toMatchObject({ revision: 2, scenarioDrafts: [{ draftId: "draft-worksheet", status: "saved" }] });

      const afterSaveStore = await openSessionStore({ rootDir, sessionId });
      try {
        const reloaded = await afterSaveStore.readSnapshot();
        expect(reloaded.revision).toBe(2);
        expect(reloaded.scenarioDrafts).toMatchObject([{ draftId: "draft-worksheet", status: "saved", factorOverrides: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, upperTolerance: 0.8 }] }]);
      } finally {
        await afterSaveStore.close();
      }

      expect(whatIfService.calculateWorksheet).toHaveBeenCalledOnce();
      expect(whatIfService.calculate).toHaveBeenCalledOnce();
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("saves a worksheet system-specification Scenario through the public command and reloads it from the session store", async () => {
    const rootDir = testRoot("workbench-server-system-spec-save-reload");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "36363636-3636-4363-8363-363636363636";
    const worksheetDraft = {
      contractVersion: "f8-scenario-draft-v1" as const,
      draftId: "draft-system-spec",
      sessionId,
      worksheetName: "Analysis-A",
      inputRevision: 1,
      status: "calculated" as const,
      mode: "WHAT_IF" as const,
      baselineWorkbookHash: "a".repeat(64),
      baselineRunReference: "f4-run-a",
      calculationReference: "what-if:system-spec",
      calculationMetrics: { mean: 0.1, rssSigma: 0.8, cp: 1.4, cpkL: 1.2, cpkU: 1.6, cpk: 1.2, statisticalMargin: 1.25, worstCaseMargin: 0.95, lowerSpecLimit: 1.35, upperSpecLimit: 1.62 },
      factorOverrides: [],
      systemSpecification: { lowerSpecLimit: 1.35, upperSpecLimit: 1.62 },
      factorResults: [],
    };
    const whatIfService = {
      calculate: vi.fn(async () => { throw new Error("factor save should not be used"); }),
      calculateWorksheet: vi.fn(async () => worksheetDraft),
      createPromotionPreview: vi.fn(),
    };
    const server = await buildWorkbenchServer({ rootDir, whatIfService, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({ contractVersion: "f8-session-command-v1", sessionId, commandId: "seed-review", expectedRevision: 0, command: "upload_workbook", payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" } }, async (snapshot) => ({ snapshot: { ...snapshot, revision: 1, inputRevision: 1, state: "review_required", activeAttempt: null } }));
      } finally {
        await store.close();
      }

      const saved = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "save-system-spec-draft",
          expectedRevision: 1,
          command: "save_what_if_draft",
          payload: {
            draftId: "draft-system-spec",
            worksheetName: "Analysis-A",
            inputRevision: 1,
            factorOverrides: [],
            systemSpecification: { lowerSpecLimit: 1.35, upperSpecLimit: 1.62 },
          },
        },
      });

      expect(saved.statusCode).toBe(202);
      expect(saved.json()).toMatchObject({ revision: 2, scenarioDrafts: [{ draftId: "draft-system-spec", status: "saved", systemSpecification: { lowerSpecLimit: 1.35, upperSpecLimit: 1.62 } }] });
      const reloadedStore = await openSessionStore({ rootDir, sessionId });
      try {
        expect(await reloadedStore.readSnapshot()).toMatchObject({
          revision: 2,
          scenarioDrafts: [{ draftId: "draft-system-spec", status: "saved", factorOverrides: [], systemSpecification: { lowerSpecLimit: 1.35, upperSpecLimit: 1.62 } }],
        });
      } finally {
        await reloadedStore.close();
      }
      expect(whatIfService.calculateWorksheet).toHaveBeenCalledWith(expect.objectContaining({ sessionId }), expect.objectContaining({ worksheetName: "Analysis-A", factorOverrides: [], systemSpecification: { lowerSpecLimit: 1.35, upperSpecLimit: 1.62 } }));
      expect(whatIfService.calculate).not.toHaveBeenCalled();
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("registers structured F4/F5/F6 results under one durable review context", async () => {
    const rootDir = testRoot("workbench-server-review-context-registration");
    await rm(rootDir, { recursive: true, force: true });
    const runner = vi.fn(async (job: { readonly stage: string }) => {
      const result = job.stage === "f4_running"
        ? structuredReviewResult("F4", false)
        : job.stage === "f5_running"
          ? structuredReviewResult("F5")
          : job.stage === "f6_running"
            ? structuredReviewResult("F6")
            : { status: "completed", artifactReferences: [] };
      await Promise.all((result.artifactReferences ?? []).map(async (artifact) => {
        const target = join(rootDir, artifact.relativePath);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, JSON.stringify({ artifactId: artifact.artifactId }));
      }));
      if (job.stage === "f4_running") return structuredReviewResult("F4", false);
      if (job.stage === "f5_running") return structuredReviewResult("F5");
      if (job.stage === "f6_running") return structuredReviewResult("F6");
      return { status: "completed" };
    });
    const server = await buildWorkbenchServer({ rootDir, runner, queueFactory: immediateQueue, skipWebAssets: true });
    const sessionId = "30303030-3030-4303-8303-303030303030";
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-f4",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: snapshot.revision + 1,
            inputRevision: 1,
            state: "failed",
            downstreamScopeSelection: {
              workbookContentHash: REVIEW_CONTEXT.workbookHash,
              selectedWorksheetNames: ["Analysis-A"],
              confirmed: true,
              provenance: "user",
            },
            priorRunReferences: [{ featureId: "F2", referenceId: "f2-run-2026-08-25", contractVersion: "v1", workbookHash: REVIEW_CONTEXT.workbookHash, runReference: REVIEW_CONTEXT.baselineRunReference }],
            activeAttempt: { attemptId: "seed-f4:f4_running", stage: "f4_running", status: "failed", startedAt: "2026-08-25T00:00:00.000Z", endedAt: "2026-08-25T00:00:01.000Z" },
          },
        }));
      } finally {
        await store.close();
      }

      let expectedRevision = 1;
      const submit = async (commandId: string, command: string, payload: Record<string, unknown>) => {
        const response = await server.inject({
          method: "POST",
          url: `/api/sessions/${sessionId}/commands`,
          headers: browser.headers,
          payload: { contractVersion: "f8-session-command-v1", sessionId, commandId, expectedRevision, command, payload },
        });
        if (response.statusCode === 202) expectedRevision = response.json<{ revision: number }>().revision;
        return response;
      };

      expect((await submit("run-f4", "retry", { stage: "f4_running" })).statusCode).toBe(202);

      const reopened = await openSessionStore({ rootDir, sessionId });
      try {
        const snapshot = await reopened.readSnapshot();
        const f4Reference = await reopened.readArtifactReference("f4-calculation");
        expect(snapshot.state).toBe("review_required");
        expect(snapshot.artifactRefs?.map((artifact) => artifact.revision)).toEqual([1, 1, 1, 1]);
        expect(f4Reference?.metadata?.reviewContext).toEqual(REVIEW_CONTEXT);
        expect(selectCompleteReviewContext(snapshot)?.reviewContextId).toMatch(/^[a-f0-9]{64}$/);
        expect(projectWorksheetReview({ sessionId, snapshot, f4Report: { calculations: [] }, f5Report: { worksheets: [] }, f6Report: { worksheets: [] } }, "Analysis-A").worksheets).toHaveLength(1);
      } finally {
        await reopened.close();
      }
      expect(runner.mock.calls.map(([job]) => job.stage)).toEqual(["f4_running", "f5_running", "f6_running"]);
      expect(runner.mock.calls.map(([job]) => job.payload)).toEqual([
        { sessionId, baselineRunReference: REVIEW_CONTEXT.baselineRunReference },
        { sessionId, reviewContext: REVIEW_CONTEXT },
        { sessionId, reviewContext: REVIEW_CONTEXT },
      ]);
      const artifactResponse = await server.inject({
        method: "GET",
        url: `/api/sessions/${sessionId}/artifacts/f4-calculation`,
        headers: browser.headers,
      });
      expect({ statusCode: artifactResponse.statusCode, payload: artifactResponse.payload }).toEqual({
        statusCode: 200,
        payload: JSON.stringify({ artifactId: "f4-calculation" }),
      });
      expect(artifactResponse.json()).toEqual({ artifactId: "f4-calculation" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("imports a host workbook through existing upload validation and queues one upload command", async () => {
    const rootDir = testRoot("workbench-server-host-import");
    await rm(rootDir, { recursive: true, force: true });
    const enqueued: StageJob[] = [];
    const server = await buildWorkbenchServer({
      rootDir,
      runner: async () => ({ status: "ok" }),
      queueFactory: async (options) => ({
        async enqueue(job) {
          enqueued.push(job);
          await options.sessionStore.persistAttempt({ attemptId: job.attemptId, status: "running", jobId: job.jobId, stage: job.stage });
          return { jobId: job.jobId, attemptId: job.attemptId, status: "queued" as const };
        },
        async cancel() { return false; },
        async reconcile() {},
      }),
      skipWebAssets: true,
    });
    try {
      const auth = await server.testAuthenticate("31313131-3131-4313-8313-313131313131");
      const bytes = createAnonymousWorkbookZip();

      const receipt = await server.importHostWorkbook({ requestId: "request-1", sessionId: auth.sessionId, fileName: "host.xlsx", bytes });
      const duplicate = await server.importHostWorkbook({ requestId: "request-1", sessionId: auth.sessionId, fileName: "host.xlsx", bytes: new Uint8Array([80, 75, 3, 4]) });

      expect(receipt).toMatchObject({ artifactId: expect.any(String), contentHash: createHash("sha256").update(bytes).digest("hex"), snapshotRevision: 1, state: "f0_validating" });
      expect(duplicate).toEqual(receipt);
      expect(enqueued).toHaveLength(1);
      expect(JSON.stringify(receipt)).not.toContain("host-import");
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects host workbook import for a missing session with a sanitized error", async () => {
    const rootDir = testRoot("workbench-server-host-import-missing-session");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      await expect(server.importHostWorkbook({ requestId: "request-1", sessionId: "missing-session", fileName: "host.xlsx", bytes: createAnonymousWorkbookZip() })).rejects.toSatisfy((error: unknown) => {
        const text = JSON.stringify(error);
        return text.includes("validation_error") && !text.includes(":\\");
      });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects malformed host workbook bytes through the same OOXML validation", async () => {
    const rootDir = testRoot("workbench-server-host-import-ooxml");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const auth = await server.testAuthenticate("32323232-3232-4323-8323-323232323232");
      await expect(server.importHostWorkbook({ requestId: "request-1", sessionId: auth.sessionId, fileName: "host.xlsx", bytes: Buffer.from("not a workbook") })).rejects.toMatchObject({ code: "validation_error" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects host workbook imports whose filename is not xlsx", async () => {
    const rootDir = testRoot("workbench-server-host-import-extension");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const auth = await server.testAuthenticate("33323232-3232-4323-8323-323232323232");
      await expect(server.importHostWorkbook({ requestId: "request-1", sessionId: auth.sessionId, fileName: "host.xlsm", bytes: createAnonymousWorkbookZip() })).rejects.toMatchObject({ code: "validation_error" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects host workbook imports whose filename looks like a filesystem path", async () => {
    const rootDir = testRoot("workbench-server-host-import-pathlike-name");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const auth = await server.testAuthenticate("43434343-4343-4434-8434-434343434343");
      await expect(server.importHostWorkbook({ requestId: "request-1", sessionId: auth.sessionId, fileName: "C:\\secret\\host.xlsx", bytes: createAnonymousWorkbookZip() })).rejects.toSatisfy((error: unknown) => {
        const text = JSON.stringify(error);
        return text.includes("validation_error") && !text.includes("C:\\secret");
      });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("single-flights concurrent duplicate host workbook imports by request id", async () => {
    const rootDir = testRoot("workbench-server-host-import-concurrent-duplicate");
    await rm(rootDir, { recursive: true, force: true });
    const enqueued: StageJob[] = [];
    let releaseUpload: (() => void) | undefined;
    const uploadGate = new Promise<void>((resolve) => { releaseUpload = resolve; });
    const server = await buildWorkbenchServer({
      rootDir,
      runner: async () => ({ status: "ok" }),
      queueFactory: async (options) => ({
        async enqueue(job) {
          enqueued.push(job);
          await options.sessionStore.persistAttempt({ attemptId: job.attemptId, status: "running", jobId: job.jobId, stage: job.stage });
          return { jobId: job.jobId, attemptId: job.attemptId, status: "queued" as const };
        },
        async cancel() { return false; },
        async reconcile() {},
      }),
      skipWebAssets: true,
    });
    try {
      const auth = await server.testAuthenticate("45454545-4545-4454-8454-454545454545");
      const bytes = createAnonymousWorkbookZip();
      const first = server.importHostWorkbook({ requestId: "request-1", sessionId: auth.sessionId, fileName: "host.xlsx", bytes: new Uint8Array(bytes) });
      const second = server.importHostWorkbook({ requestId: "request-1", sessionId: auth.sessionId, fileName: "host.xlsx", bytes: new Uint8Array(bytes) });

      releaseUpload?.();
      const [receiptA, receiptB] = await Promise.all([first, second]);

      expect(receiptA).toEqual(receiptB);
      expect(enqueued).toHaveLength(1);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed when current F4 artifacts contain ambiguous review contexts", async () => {
    const rootDir = testRoot("workbench-server-ambiguous-f4-context");
    await rm(rootDir, { recursive: true, force: true });
    const runner = vi.fn(async () => structuredReviewResult("F5"));
    const server = await buildWorkbenchServer({ rootDir, runner, queueFactory: immediateQueue, skipWebAssets: true });
    const sessionId = "32323232-3232-4323-8323-323232323232";
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-ambiguous-f4",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: 1,
            inputRevision: 1,
            state: "image_decision_required",
            downstreamScopeSelection: { workbookContentHash: REVIEW_CONTEXT.workbookHash, selectedWorksheetNames: ["Analysis-A"], confirmed: true },
            priorRunReferences: [{ featureId: "F2", referenceId: "f2-run-2026-08-25", contractVersion: "v1", workbookHash: REVIEW_CONTEXT.workbookHash, runReference: REVIEW_CONTEXT.baselineRunReference }],
            activeAttempt: null,
          },
          artifactReferenceOps: {
            upsert: [
              { artifactId: "f4-current", sessionId, inputRevision: 1, kind: "f4_calculation", relativePath: "f4/current.json", reviewContext: REVIEW_CONTEXT },
              { artifactId: "f4-conflict", sessionId, inputRevision: 1, kind: "f4_calculation", relativePath: "f4/conflict.json", reviewContext: { ...REVIEW_CONTEXT, baselineRunReference: "f2-run-other" } },
            ],
          },
        }));
      } finally {
        await store.close();
      }

      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: { contractVersion: "f8-session-command-v1", sessionId, commandId: "run-f5-ambiguous", expectedRevision: 1, command: "confirm_image_decision", payload: { decision: "not_evaluated" } },
      });
      expect(response.statusCode).toBe(409);
      const reopened = await openSessionStore({ rootDir, sessionId });
      try {
        expect(await reopened.readArtifactReference("f5-report")).toBeUndefined();
      } finally {
        await reopened.close();
      }
      expect(runner).not.toHaveBeenCalled();
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it.each([
    ["missing F2 lineage", { featureId: "F4", status: "completed", artifactReferences: structuredReviewResult("F4").artifactReferences }, false],
    ["missing artifact references", { featureId: "F4", status: "completed", reviewContext: REVIEW_CONTEXT }, true],
    ["mismatched workbook", { ...structuredReviewResult("F4"), reviewContext: { ...REVIEW_CONTEXT, workbookHash: "b".repeat(64) } }, true],
    ["mismatched worksheet selection", { ...structuredReviewResult("F4"), reviewContext: { ...REVIEW_CONTEXT, downstreamSelectionHash: "b".repeat(64) } }, true],
    ["mismatched baseline run", { ...structuredReviewResult("F4"), reviewContext: { ...REVIEW_CONTEXT, baselineRunReference: "f2-run-other" } }, true],
  ])("fails %s producer results with evidence_mismatch and registers no artifacts", async (_name, runnerResult, seedF2Lineage) => {
    const rootDir = testRoot("workbench-server-invalid-review-producer");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "31313131-3131-4313-8313-313131313131";
    const server = await buildWorkbenchServer({ rootDir, runner: async () => runnerResult, queueFactory: immediateQueue, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-invalid-producer",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: snapshot.revision + 1,
            inputRevision: 1,
            state: "failed",
            downstreamScopeSelection: {
              workbookContentHash: REVIEW_CONTEXT.workbookHash,
              selectedWorksheetNames: ["Analysis-A"],
              confirmed: true,
            },
            priorRunReferences: seedF2Lineage
              ? [{ featureId: "F2", referenceId: "f2-run-2026-08-25", contractVersion: "v1", workbookHash: REVIEW_CONTEXT.workbookHash, runReference: REVIEW_CONTEXT.baselineRunReference }]
              : [],
            activeAttempt: { attemptId: "seed-invalid-producer:f4_running", stage: "f4_running", status: "failed", startedAt: "2026-08-25T00:00:00.000Z", endedAt: "2026-08-25T00:00:01.000Z" },
          },
        }));
      } finally {
        await store.close();
      }
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: { contractVersion: "f8-session-command-v1", sessionId, commandId: "run-invalid-producer", expectedRevision: 1, command: "retry", payload: { stage: "f4_running" } },
      });
      if (seedF2Lineage) {
        expect(response.statusCode).toBe(202);
        expect(response.json()).toMatchObject({ state: "failed", activeAttempt: { status: "failed" } });
      } else {
        expect(response.statusCode).toBe(409);
      }
      const reopened = await openSessionStore({ rootDir, sessionId });
      try {
        const snapshot = await reopened.readSnapshot();
        expect(snapshot.artifactRefs).toBeUndefined();
      } finally {
        await reopened.close();
      }
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("exchanges a one-time bootstrap nonce for a browser cookie and CSRF-protected session", async () => {
    const rootDir = testRoot("workbench-server-bootstrap-session");
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const nonce = await server.bootstrap.issueBrowserBootstrap();
      const bootstrap = await server.inject({ method: "POST", url: "/api/bootstrap", payload: { nonce } });
      const cookie = bootstrap.headers["set-cookie"];

      expect(bootstrap.statusCode).toBe(204);
      expect(cookie).toContain("HttpOnly");
      expect((await server.inject({ method: "POST", url: "/api/bootstrap", payload: { nonce } })).statusCode).toBe(401);
      const csrf = await server.inject({ method: "GET", url: "/api/csrf", headers: { host: "127.0.0.1:0", cookie } });
      expect(csrf.statusCode).toBe(200);
      const created = await server.inject({
        method: "POST",
        url: "/api/sessions",
        headers: { host: "127.0.0.1:0", cookie, "x-csrf-token": csrf.json<{ csrfToken: string }>().csrfToken },
      });
      expect(created.statusCode).toBe(201);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("serves only the configured built workbench assets after bootstrap", async () => {
    const rootDir = testRoot("workbench-server-web-assets");
    const webAssetsRoot = join(rootDir, "web-assets");
    await rm(rootDir, { recursive: true, force: true });
    await mkdir(webAssetsRoot, { recursive: true });
    await Promise.all([
      writeFile(join(webAssetsRoot, "workbench.js"), "export {}\n"),
      writeFile(join(webAssetsRoot, "workbench.css"), "body {}\n"),
    ]);
    const server = await buildWorkbenchServer({ rootDir, webAssetsRoot });
    try {
      expect((await server.inject({ method: "GET", url: "/" })).body).toContain('id="app"');
      expect((await server.inject({ method: "GET", url: "/" })).body).toContain('src="/bootstrap.js"');
      expect((await server.inject({ method: "GET", url: "/workbench.js" })).body).toBe("export {}\n");
      expect((await server.inject({ method: "GET", url: "/workbench.css" })).body).toBe("body {}\n");
      await rm(join(webAssetsRoot, "workbench.css"));
      const missingAsset = await server.inject({ method: "GET", url: "/workbench.css" });
      expect(missingAsset.statusCode, missingAsset.body).toBe(503);
      expect((await server.inject({ method: "GET", url: "/assets/unknown.js" })).statusCode).toBe(404);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("serves the package-local bundle from a built server fixture with stable content types and hashes", async () => {
    const rootDir = testRoot("workbench-server-package-assets");
    const fixturePackageRoot = join(rootDir, "package");
    const fixtureDistRoot = join(fixturePackageRoot, "dist");
    const fixtureAssetsRoot = join(fixturePackageRoot, "assets", "workbench");
    const sourcePackageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    await mkdir(fixtureDistRoot, { recursive: true });
    await Promise.all([
      cp(join(sourcePackageRoot, "dist"), fixtureDistRoot, { recursive: true }),
      cp(join(sourcePackageRoot, "src"), join(fixturePackageRoot, "src"), { recursive: true }),
    ]);
    await mkdir(fixtureAssetsRoot, { recursive: true });
    await Promise.all([
      writeFile(join(fixtureAssetsRoot, "workbench.js"), "export const fixture = true;\n"),
      writeFile(join(fixtureAssetsRoot, "workbench.css"), ":root { color: #111; }\n"),
    ]);
    const { buildWorkbenchServer: buildFixtureServer } = await import(`${pathToFileURL(join(fixtureDistRoot, "server.js")).href}?fixture=${randomUUID()}`);
    const server = await buildFixtureServer({ rootDir });
    try {
      const script = await server.inject({ method: "GET", url: "/workbench.js" });
      const stylesheet = await server.inject({ method: "GET", url: "/workbench.css" });

      expect(script.statusCode).toBe(200);
      expect(script.headers["content-type"]).toContain("application/javascript");
      expect(createHash("sha256").update(script.body).digest("hex")).toBe(createHash("sha256").update(await readFile(join(fixtureAssetsRoot, "workbench.js"))).digest("hex"));
      expect(stylesheet.statusCode).toBe(200);
      expect(stylesheet.headers["content-type"]).toContain("text/css");
      expect(createHash("sha256").update(stylesheet.body).digest("hex")).toBe(createHash("sha256").update(await readFile(join(fixtureAssetsRoot, "workbench.css"))).digest("hex"));
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns CSRF only to the authenticated browser session", async () => {
    const rootDir = testRoot("workbench-server-csrf");
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const auth = await server.testAuthenticate();

      const response = await server.inject({ method: "GET", url: "/api/csrf", headers: { host: "127.0.0.1:0", cookie: auth.headers.cookie } });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ csrfToken: auth.csrfToken });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("serves worksheet-bound F1 images when two worksheets share one content hash", async () => {
    const rootDir = testRoot("workbench-server-f1-image-worksheet-bound");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "56565656-5656-4565-8565-565656565656";
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+KDv6VwAAAABJRU5ErkJggg==", "base64");
      const imageHash = createHash("sha256").update(pngBytes).digest("hex");
      const report = f2ImageBindingReportForArtifactTest(imageHash, [
        { worksheetName: "rubber overload 1", relativePath: "worksheets/rubber-overload-1/tolerance-path.png" },
        { worksheetName: "rubber overload 2", relativePath: "worksheets/rubber-overload-2/tolerance-path.png" },
      ]);
      const reportRelativePath = "f2/current-image-binding.json";
      const reportHash = await writeJsonArtifact(rootDir, reportRelativePath, report);
      await writeImageArtifactFixture(rootDir, "f1/worksheets/rubber-overload-1/tolerance-path.png", pngBytes);
      await writeImageArtifactFixture(rootDir, "f1/worksheets/rubber-overload-2/tolerance-path.png", pngBytes);

      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-f1-image-binding",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: 1,
            inputRevision: 1,
            state: "review_required",
            activeAttempt: null,
            artifactRefs: [{ artifactId: "f2-current", kind: "f2_report", revision: 1, validated: true }],
          },
          artifactReferenceOps: {
            upsert: [{ artifactId: "f2-current", sessionId, inputRevision: 1, kind: "f2_report", relativePath: reportRelativePath, contentHash: reportHash }],
          },
        }));
      } finally {
        await store.close();
      }

      const artifactId = `f1-image:${imageHash}`;
      const urlA = `/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactId)}?disposition=inline&worksheet=${encodeURIComponent("rubber overload 1")}&path=${encodeURIComponent("worksheets/rubber-overload-1/tolerance-path.png")}`;
      const urlB = `/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactId)}?disposition=inline&worksheet=${encodeURIComponent("rubber overload 2")}&path=${encodeURIComponent("worksheets/rubber-overload-2/tolerance-path.png")}`;
      const responseA = await server.inject({ method: "GET", url: urlA, headers: browser.headers });
      const responseB = await server.inject({ method: "GET", url: urlB, headers: browser.headers });

      expect(responseA.statusCode, responseA.payload).toBe(200);
      expect(responseB.statusCode, responseB.payload).toBe(200);
      expect(Buffer.from(responseA.rawPayload)).toEqual(pngBytes);
      expect(Buffer.from(responseB.rawPayload)).toEqual(pngBytes);
      expect(responseA.headers["content-disposition"]).toContain("inline");
      expect(responseB.headers["content-disposition"]).toContain("inline");
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects worksheet/path/hash mismatches for worksheet-bound F1 image requests", async () => {
    const rootDir = testRoot("workbench-server-f1-image-mismatch");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "57575757-5757-4575-8575-575757575757";
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+KDv6VwAAAABJRU5ErkJggg==", "base64");
      const imageHash = createHash("sha256").update(pngBytes).digest("hex");
      const report = f2ImageBindingReportForArtifactTest(imageHash, [{ worksheetName: "rubber overload 1", relativePath: "worksheets/rubber-overload-1/tolerance-path.png" }]);
      const reportRelativePath = "f2/current-image-binding-mismatch.json";
      const reportHash = await writeJsonArtifact(rootDir, reportRelativePath, report);
      await writeImageArtifactFixture(rootDir, "f1/worksheets/rubber-overload-1/tolerance-path.png", pngBytes);

      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-f1-image-mismatch",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: 1,
            inputRevision: 1,
            state: "review_required",
            activeAttempt: null,
            artifactRefs: [{ artifactId: "f2-current", kind: "f2_report", revision: 1, validated: true }],
          },
          artifactReferenceOps: {
            upsert: [{ artifactId: "f2-current", sessionId, inputRevision: 1, kind: "f2_report", relativePath: reportRelativePath, contentHash: reportHash }],
          },
        }));
      } finally {
        await store.close();
      }

      const artifactId = `f1-image:${imageHash}`;
      const badWorksheet = await server.inject({ method: "GET", url: `/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactId)}?disposition=inline&worksheet=${encodeURIComponent("rubber overload 2")}&path=${encodeURIComponent("worksheets/rubber-overload-1/tolerance-path.png")}`, headers: browser.headers });
      const badPath = await server.inject({ method: "GET", url: `/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactId)}?disposition=inline&worksheet=${encodeURIComponent("rubber overload 1")}&path=${encodeURIComponent("worksheets/rubber-overload-2/tolerance-path.png")}`, headers: browser.headers });
      const badHash = await server.inject({ method: "GET", url: `/api/sessions/${sessionId}/artifacts/${encodeURIComponent(`f1-image:${"f".repeat(64)}`)}?disposition=inline&worksheet=${encodeURIComponent("rubber overload 1")}&path=${encodeURIComponent("worksheets/rubber-overload-1/tolerance-path.png")}`, headers: browser.headers });

      expect(badWorksheet.statusCode, badWorksheet.payload).toBe(404);
      expect(badPath.statusCode, badPath.payload).toBe(404);
      expect(badHash.statusCode, badHash.payload).toBe(404);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("restores browser authentication after a Server restart", async () => {
    const rootDir = testRoot("workbench-server-persistent-auth");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "15151515-1515-4515-8515-151515151515";
    const first = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    const auth = await first.testAuthenticate(sessionId);
    await first.close();
    const second = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const response = await second.inject({ method: "GET", url: `/api/sessions/${sessionId}`, headers: { host: "127.0.0.1:0", cookie: auth.headers.cookie } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ sessionId });
    } finally {
      await second.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("runs governed F0 and discovers worksheet capabilities with the default runner", async () => {
    const rootDir = testRoot("workbench-server-default-queue");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const auth = await server.testAuthenticate("12121212-1212-4212-8212-121212121212");
      const artifactId = "managed-workbook";
      server.registerArtifactForTest(auth.sessionId, artifactId, `uploads/${auth.sessionId}/workbook/${artifactId}-book.xlsx`, "book.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const workbookPath = join(rootDir, `uploads/${auth.sessionId}/workbook/${artifactId}-book.xlsx`);
      await mkdir(dirname(workbookPath), { recursive: true });
      await writeFile(workbookPath, createAnonymousWorkbookZip());
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "default-runner-upload",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { artifactId, inputClassification: "confidential" },
        },
      });

      expect(response.statusCode).toBe(202);
      const runnerError = await readFile(join(rootDir, "runtime", "workbench", "registries", "runner-errors", `${auth.sessionId}.json`), "utf8").catch(() => undefined);
      expect(response.json(), runnerError).toMatchObject({
        state: "initial_scope_required",
        activeAttempt: null,
        worksheetCapabilities: expect.arrayContaining([
          { worksheetName: "Analysis-A", whatIfAvailable: false },
          { worksheetName: "Analysis-B", whatIfAvailable: false },
        ]),
      });
      const database = new DatabaseSync(join(rootDir, "runtime", "workbench", "workbench.sqlite"), { readOnly: true });
      try {
        const progress = database.prepare("SELECT payload_json FROM session_sse_events WHERE session_id = ? AND event_name = 'runner_progress' ORDER BY event_id").all(auth.sessionId) as Array<{ payload_json: string }>;
        expect(progress.map(({ payload_json }) => JSON.parse(payload_json))).toEqual(expect.arrayContaining([
          expect.objectContaining({ kind: "stage_started", featureId: "F0", stage: "validate_capabilities" }),
          expect.objectContaining({ kind: "stage_completed", featureId: "F0", stage: "validate_capabilities" }),
        ]));
      } finally {
        database.close();
      }
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("keeps F0 success and returns structured warning when F1 discovery is unavailable", async () => {
    const rootDir = testRoot("workbench-server-f1-discovery-warning");
    await rm(rootDir, { recursive: true, force: true });
    const orchestrator: TaWorkbookOrchestrator = {
      async runStage(stage) {
        if (stage !== "f0_validating") {
          throw new Error(`unexpected stage: ${stage}`);
        }
        return {
          status: "completed",
          skillId: "knowledge-and-rules-validation-v1",
          inputRevision: 1,
          idempotencyKey: "attempt:f0",
          output: { featureId: "F0", status: "completed", versions: ["v1", "internal-v1", "interpretation-rules-v1"] },
        };
      },
      async runWorkbookScopeDiscovery() {
        return {
          status: "failed",
          skillId: "workbook-scope-discovery-v1",
          inputRevision: 1,
          idempotencyKey: "attempt:f1",
          reasonCode: "scope_runner_unavailable",
          summary: "scope runner unavailable",
        };
      },
      async runAnalysisInputValidation() {
        return {
          status: "blocked",
          skillId: "analysis-input-validation-v1",
          inputRevision: 1,
          idempotencyKey: "attempt:f2",
          reasonCode: "delegated",
          summary: "delegated",
        };
      },
    };

    const server = await buildWorkbenchServer({ rootDir, orchestrator });
    try {
      const auth = await server.testAuthenticate("14141414-1414-4414-8414-141414141414");
      const artifactId = "managed-workbook";
      const relativePath = `uploads/${auth.sessionId}/workbook/${artifactId}-book.xlsx`;
      server.registerArtifactForTest(auth.sessionId, artifactId, relativePath, "book.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await mkdir(dirname(join(rootDir, relativePath)), { recursive: true });
      await writeFile(join(rootDir, relativePath), createAnonymousWorkbookZip());

      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "f1-warning-upload",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { artifactId, inputClassification: "confidential" },
        },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({
        state: "initial_scope_required",
        worksheetCapabilities: expect.arrayContaining([{ worksheetName: "Analysis-A", whatIfAvailable: false }]),
      });
      expect(response.json()).not.toHaveProperty("selectionPrompt");
      const selectionRegistry = await readFile(join(rootDir, "runtime", "workbench", "registries", "f1-f2-selection", `${auth.sessionId}.json`), "utf8").catch(() => undefined);
      expect(selectionRegistry).toBeUndefined();
      const database = new DatabaseSync(join(rootDir, "runtime", "workbench", "workbench.sqlite"), { readOnly: true });
      try {
        const progress = database.prepare("SELECT payload_json FROM session_sse_events WHERE session_id = ? AND event_name = 'runner_progress' ORDER BY event_id").all(auth.sessionId) as Array<{ payload_json: string }>;
        expect(progress.map(({ payload_json }) => JSON.parse(payload_json))).toEqual(expect.arrayContaining([
          expect.objectContaining({
            kind: "stage_warning",
            featureId: "F1",
            stage: "scope_discovery",
            status: "failed",
            code: "scope_discovery_unavailable",
            summary: expect.stringContaining("workbook-scope-discovery-v1 failed:"),
          }),
        ]));
      } finally {
        database.close();
      }
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("keeps production sessions at initial scope until user confirmation", async () => {
    const rootDir = testRoot("workbench-server-auto-entry");
    await rm(rootDir, { recursive: true, force: true });
    const stages: string[] = [];
    const runner = vi.fn(async (job: StageJob) => {
      stages.push(job.stage);
      if (job.stage === "f0_validating") {
        return {
          featureId: "F0",
          status: "completed",
          versions: ["v1", "internal-v1", "interpretation-rules-v1"],
          worksheetCapabilities: [{ worksheetName: "Analysis-A", whatIfAvailable: false }],
          selectionPrompt: {
            contractVersion: "v1",
            inputClassification: "confidential",
            status: "selectionRequired",
            workbook: { fileName: "book.xlsx", contentHash: "a".repeat(64) },
            options: [{ selectionIndex: 1, worksheetName: "Analysis-A", toleranceLoopDescription: "Analysis loop", worksheetKind: "analysis", source: { discoveryMethod: "worksheet_scan", descriptionCell: "Analysis-A!F11", worksheetAnchor: "Analysis-A!A1" } }],
          },
        };
      }
      return { status: "completed" };
    });
    const server = await buildWorkbenchServer({ rootDir, runner, queueFactory: immediateQueue, skipWebAssets: true });
    try {
      const auth = await server.testAuthenticate("13131313-1313-4313-8313-131313131313");
      const artifactId = "managed-workbook";
      const relativePath = `uploads/${auth.sessionId}/workbook/${artifactId}-book.xlsx`;
      server.registerArtifactForTest(auth.sessionId, artifactId, relativePath, "book.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await mkdir(dirname(join(rootDir, relativePath)), { recursive: true });
      await writeFile(join(rootDir, relativePath), createAnonymousWorkbookZip());

      const response = await server.inject({ method: "POST", url: `/api/sessions/${auth.sessionId}/commands`, headers: auth.headers, payload: { contractVersion: "f8-session-command-v1", sessionId: auth.sessionId, commandId: "auto-upload", expectedRevision: 0, command: "upload_workbook", payload: { artifactId, inputClassification: "confidential" } } });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({ state: "initial_scope_required" });
      expect(response.json()).not.toHaveProperty("initialScopeSelection");
      expect(stages).toEqual(["f0_validating"]);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("keeps production sessions at downstream scope after user initial confirmation until explicit downstream confirmation", async () => {
    const rootDir = testRoot("workbench-server-second-stop");
    await rm(rootDir, { recursive: true, force: true });
    const workbookHash = "a".repeat(64);
    const runner = vi.fn(async (job: StageJob) => {
      if (job.stage === "f0_validating") {
        return {
          featureId: "F0",
          status: "completed",
          versions: ["v1", "internal-v1", "interpretation-rules-v1"],
          worksheetCapabilities: [{ worksheetName: "Analysis-A", whatIfAvailable: false }],
          selectionPrompt: {
            contractVersion: "v1",
            inputClassification: "confidential",
            status: "selectionRequired",
            workbook: { fileName: "book.xlsx", contentHash: workbookHash },
            options: [{ selectionIndex: 1, worksheetName: "Analysis-A", toleranceLoopDescription: "Analysis loop", worksheetKind: "analysis", source: { discoveryMethod: "worksheet_scan", descriptionCell: "Analysis-A!F11", worksheetAnchor: "Analysis-A!A1" } }],
          },
        };
      }
      if (job.stage === "f1_f2_running") {
        const report = f2ImageBindingReportForArtifactTest("1".repeat(64), [{ worksheetName: "Analysis-A", relativePath: "worksheets/analysis-a/tolerance-path.png" }]);
        const f2Root = join(rootDir, "runtime", "workbench", "runner-output", "second-stop", "f2");
        await mkdir(f2Root, { recursive: true });
        await writeFile(join(f2Root, "Feature2-Report.json"), `${JSON.stringify(report, null, 2)}\n`);
        return {
          featureId: "F2",
          status: "completed",
          runId: "f2-run-second-stop",
          f2Root,
          workbookContentHash: workbookHash,
          report,
        };
      }
      return { status: "completed" };
    });
    const server = await buildWorkbenchServer({ rootDir, runner, queueFactory: immediateQueue, skipWebAssets: true });
    try {
      const auth = await server.testAuthenticate("88888888-8888-4888-8888-888888888888");
      const artifactId = "managed-workbook";
      const relativePath = `uploads/${auth.sessionId}/workbook/${artifactId}-book.xlsx`;
      server.registerArtifactForTest(auth.sessionId, artifactId, relativePath, "book.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await mkdir(dirname(join(rootDir, relativePath)), { recursive: true });
      await writeFile(join(rootDir, relativePath), createAnonymousWorkbookZip());

      const uploaded = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "second-stop-upload",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { artifactId, inputClassification: "confidential" },
        },
      });
      expect(uploaded.statusCode).toBe(202);
      expect(uploaded.json()).toMatchObject({ state: "initial_scope_required" });

      const afterInitial = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "second-stop-initial-confirm",
          expectedRevision: uploaded.json<{ revision: number }>().revision,
          command: "confirm_initial_scope",
          payload: { workbookHash, worksheetNames: ["Analysis-A"] },
        },
      });

      expect(afterInitial.statusCode).toBe(202);
      expect(afterInitial.json()).toMatchObject({
        state: "downstream_scope_required",
        initialScopeSelection: { workbookContentHash: workbookHash, selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "user" },
      });
      expect(afterInitial.json()).not.toHaveProperty("downstreamScopeSelection");
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("rejects blocked worksheets during downstream confirmation using current F2 readiness evidence", async () => {
    const rootDir = testRoot("workbench-server-downstream-blocked");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "89898989-8989-4898-8989-898989898989";
    const workbookHash = "a".repeat(64);
    const report = f2ImageBindingReportForArtifactTest("1".repeat(64), [
      { worksheetName: "Analysis-A", relativePath: "worksheets/analysis-a/tolerance-path.png" },
      { worksheetName: "Analysis-B", relativePath: "worksheets/analysis-b/tolerance-path.png" },
    ]);
    report.status = "partiallyBlocked";
    report.worksheets = report.worksheets.map((worksheet) => worksheet.worksheetName === "Analysis-B"
      ? { ...worksheet, status: "blocked", tolerancePathImageStatus: "unavailable" }
      : worksheet);
    report.f4Handoffs = report.f4Handoffs.filter((handoff) => handoff.worksheetName !== "Analysis-B");
    report.summary = { ...report.summary, blockedWorksheetCount: 1, readyWorksheetCount: 1, missingImageWorksheetCount: 1 };
    const reportRelativePath = "f2/downstream-blocked.json";
    const reportHash = await writeJsonArtifact(rootDir, reportRelativePath, report);

    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-downstream-blocked",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: 1,
            inputRevision: 1,
            state: "downstream_scope_required",
            activeAttempt: null,
            initialScopeSelection: {
              workbookContentHash: workbookHash,
              selectedWorksheetNames: ["Analysis-A", "Analysis-B"],
              confirmed: true,
              provenance: "user",
            },
            artifactRefs: [{ artifactId: "f2-current", kind: "f2_report", revision: 1, validated: true }],
          },
          artifactReferenceOps: {
            upsert: [{ artifactId: "f2-current", sessionId, inputRevision: 1, kind: "f2_report", relativePath: reportRelativePath, contentHash: reportHash }],
          },
        }));
      } finally {
        await store.close();
      }

      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "confirm-downstream-blocked",
          expectedRevision: 1,
          command: "confirm_downstream_scope",
          payload: { workbookHash, worksheetNames: ["Analysis-B"] },
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: { code: "validation_error" } });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects downstream scope drift when worksheet is absent from the current F2 report", async () => {
    const rootDir = testRoot("workbench-server-downstream-scope-drift");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "90909090-9090-4909-9090-909090909090";
    const workbookHash = "a".repeat(64);
    const report = f2ImageBindingReportForArtifactTest("1".repeat(64), [
      { worksheetName: "Analysis-A", relativePath: "worksheets/analysis-a/tolerance-path.png" },
    ]);
    const reportRelativePath = "f2/downstream-scope-drift.json";
    const reportHash = await writeJsonArtifact(rootDir, reportRelativePath, report);

    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-downstream-drift",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: 1,
            inputRevision: 1,
            state: "downstream_scope_required",
            activeAttempt: null,
            initialScopeSelection: {
              workbookContentHash: workbookHash,
              selectedWorksheetNames: ["Analysis-A", "Analysis-C"],
              confirmed: true,
              provenance: "user",
            },
            artifactRefs: [{ artifactId: "f2-current", kind: "f2_report", revision: 1, validated: true }],
          },
          artifactReferenceOps: {
            upsert: [{ artifactId: "f2-current", sessionId, inputRevision: 1, kind: "f2_report", relativePath: reportRelativePath, contentHash: reportHash }],
          },
        }));
      } finally {
        await store.close();
      }

      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "confirm-downstream-drift",
          expectedRevision: 1,
          command: "confirm_downstream_scope",
          payload: { workbookHash, worksheetNames: ["Analysis-C"] },
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: { code: "evidence_mismatch" } });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed when no current validated F2 report evidence is available for downstream confirmation", async () => {
    const rootDir = testRoot("workbench-server-downstream-no-current-f2");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "91919191-9191-4919-9191-919191919191";
    const workbookHash = "a".repeat(64);

    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-downstream-no-current-f2",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: 1,
            inputRevision: 1,
            state: "downstream_scope_required",
            activeAttempt: null,
            initialScopeSelection: {
              workbookContentHash: workbookHash,
              selectedWorksheetNames: ["Analysis-A"],
              confirmed: true,
              provenance: "user",
            },
            artifactRefs: [],
          },
        }));
      } finally {
        await store.close();
      }

      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "confirm-downstream-no-current-f2",
          expectedRevision: 1,
          command: "confirm_downstream_scope",
          payload: { workbookHash, worksheetNames: ["Analysis-A"] },
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: { code: "evidence_mismatch" } });

      const after = await server.inject({ method: "GET", url: `/api/sessions/${sessionId}`, headers: browser.headers });
      expect(after.statusCode).toBe(200);
      expect(after.json()).toMatchObject({ revision: 1, state: "downstream_scope_required" });
      expect(after.json()).not.toHaveProperty("downstreamScopeSelection");
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed when multiple current validated F2 report references are present", async () => {
    const rootDir = testRoot("workbench-server-downstream-multi-current-f2");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "92929292-9292-4929-9292-929292929292";
    const workbookHash = "a".repeat(64);

    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-downstream-multi-current-f2",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: 1,
            inputRevision: 1,
            state: "downstream_scope_required",
            activeAttempt: null,
            initialScopeSelection: {
              workbookContentHash: workbookHash,
              selectedWorksheetNames: ["Analysis-A"],
              confirmed: true,
              provenance: "user",
            },
            artifactRefs: [
              { artifactId: "f2-current-a", kind: "f2_report", revision: 1, validated: true },
              { artifactId: "f2-current-b", kind: "f2_report", revision: 1, validated: true },
            ],
          },
        }));
      } finally {
        await store.close();
      }

      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "confirm-downstream-multi-current-f2",
          expectedRevision: 1,
          command: "confirm_downstream_scope",
          payload: { workbookHash, worksheetNames: ["Analysis-A"] },
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: { code: "evidence_mismatch" } });

      const after = await server.inject({ method: "GET", url: `/api/sessions/${sessionId}`, headers: browser.headers });
      expect(after.statusCode).toBe(200);
      expect(after.json()).toMatchObject({ revision: 1, state: "downstream_scope_required" });
      expect(after.json()).not.toHaveProperty("downstreamScopeSelection");
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("allows fixture-only auto confirmations through explicit injected policy", async () => {
    const rootDir = testRoot("workbench-server-auto-entry-fixture");
    await rm(rootDir, { recursive: true, force: true });
    const stages: string[] = [];
    const runner = vi.fn(async (job: StageJob) => {
      stages.push(job.stage);
      if (job.stage === "f0_validating") {
        return {
          featureId: "F0",
          status: "completed",
          versions: ["v1", "internal-v1", "interpretation-rules-v1"],
          worksheetCapabilities: [{ worksheetName: "Analysis-A", whatIfAvailable: false }],
          selectionPrompt: {
            contractVersion: "v1",
            inputClassification: "confidential",
            status: "selectionRequired",
            workbook: { fileName: "book.xlsx", contentHash: "a".repeat(64) },
            options: [{ selectionIndex: 1, worksheetName: "Analysis-A", toleranceLoopDescription: "Analysis loop", worksheetKind: "analysis", source: { discoveryMethod: "worksheet_scan", descriptionCell: "Analysis-A!F11", worksheetAnchor: "Analysis-A!A1" } }],
          },
        };
      }
      return { status: "completed" };
    });
    const server = await buildWorkbenchServer({ rootDir, runner, queueFactory: immediateQueue, skipWebAssets: true, allowInternalFixtureAutoConfirmation: true });
    try {
      const auth = await server.testAuthenticate("13131313-1313-4313-8313-131313131314");
      const artifactId = "managed-workbook";
      const relativePath = `uploads/${auth.sessionId}/workbook/${artifactId}-book.xlsx`;
      server.registerArtifactForTest(auth.sessionId, artifactId, relativePath, "book.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await mkdir(dirname(join(rootDir, relativePath)), { recursive: true });
      await writeFile(join(rootDir, relativePath), createAnonymousWorkbookZip());

      const response = await server.inject({ method: "POST", url: `/api/sessions/${auth.sessionId}/commands`, headers: auth.headers, payload: { contractVersion: "f8-session-command-v1", sessionId: auth.sessionId, commandId: "auto-upload-fixture", expectedRevision: 0, command: "upload_workbook", payload: { artifactId, inputClassification: "confidential" } } });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({
        state: "downstream_scope_required",
        initialScopeSelection: { selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "internal_fixture" },
      });
      expect(stages).toEqual(["f0_validating", "f1_f2_running"]);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("recovers a committed active attempt on restart without an upload registry", async () => {
    const rootDir = testRoot("workbench-server-session-recovery");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "14141414-1414-4414-8414-141414141414";
    const store = await createSessionStore({ rootDir, sessionId });
    try {
      await store.applyCommand({ contractVersion: "f8-session-command-v1", sessionId, commandId: "crash-window-upload", expectedRevision: 0, command: "upload_workbook", payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential", managedArtifactId: "uploaded-book" } }, async (snapshot, command) => ({ snapshot: reduceSessionCommand(snapshot, command) }));
    } finally {
      await store.close();
    }
    const artifactRegistry = join(rootDir, "runtime", "workbench", "registries", "artifacts");
    await mkdir(artifactRegistry, { recursive: true });
    await writeFile(join(artifactRegistry, `${sessionId}.json`), JSON.stringify({ "uploaded-book": { sessionId, relativePath: `uploads/${sessionId}/workbook/uploaded-book-book.xlsx`, fileName: "book.xlsx", classification: "confidential", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }));
    const recovered: StageJob[] = [];
    const queueFactory = async () => ({
      async enqueue(job: StageJob) { return { jobId: job.jobId, attemptId: job.attemptId, status: "queued" as const }; },
      async recover(job: StageJob) { recovered.push(job); return { jobId: job.jobId, attemptId: job.attemptId, status: "queued" as const }; },
      async cancel() { return false; },
      async reconcile() {},
    });

    const server = await buildWorkbenchServer({ rootDir, queueFactory, skipWebAssets: true });
    try {
      expect(recovered).toEqual([expect.objectContaining({ attemptId: "crash-window-upload:f0_validating", stage: "f0_validating", payload: { sessionId } })]);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("keeps create/use ADO decisions pending for Task 13 Surface validation and independent Confirm write", async () => {
    const rootDir = testRoot("workbench-server-ado-host-action");
    await rm(rootDir, { recursive: true, force: true });
    const report = f3Report("Host action canonical factor");
    const reportHash = await writeJsonArtifact(rootDir, "f3/current-host-action.json", report);
    const rendered = renderF3AdoMarkdown(report);
    const prepareRequest = { mode: "create" as const, title: "TA Drawing Governance - Anonymous.xlsx", nextContent: rendered.markdown, factorCount: 1 };
    const runner = vi.fn(async () => ({ status: "worker-ran" }));
    const server = await buildWorkbenchServer({ rootDir, runner, surfacePrepareService: { create: async () => prepareRequest } });
    try {
      const browser = await server.testAuthenticate("28282828-2828-4282-8282-282828282828");
      const session = await (await import("@ai-assist/workbench")).openSessionStore({ rootDir, sessionId: browser.sessionId });
      try {
        await session.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId: browser.sessionId,
          commandId: "seed-ado-decision",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({ snapshot: {
          ...snapshot,
          state: "ado_decision_required",
          revision: snapshot.revision + 1,
          inputRevision: 1,
          activeAttempt: null,
          downstreamScopeSelection: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "user" },
          priorRunReferences: [{ featureId: "F2", referenceId: "f2-run-a", contractVersion: "v1", workbookHash: "a".repeat(64), runReference: "f2-baseline-a" }],
          artifactRefs: [{ artifactId: "f3-current-host-action", kind: "f3_report", revision: 1, validated: true, reviewContextId: REVIEW_CONTEXT_ID }],
        }, artifactReferenceOps: { upsert: [{ artifactId: "f3-current-host-action", sessionId: browser.sessionId, inputRevision: 1, kind: "f3_report", relativePath: "f3/current-host-action.json", contentHash: reportHash, reviewContext: REVIEW_CONTEXT }] } }));
      } finally {
        await session.close();
      }
      const snapshot = (await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}`, headers: browser.headers })).json<{ revision: number }>();
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: browser.sessionId,
          commandId: "request-ado-validation",
          expectedRevision: snapshot.revision,
          command: "confirm_ado_decision",
          payload: { decision: "create_new" },
        },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({ state: "ado_action_pending", activeAttempt: null });
      // Task 10 only projects the action; Task 13 owns Surface validation and the separate Confirm write.
      expect(response.json()).not.toMatchObject({ state: "f4_running" });
      const actionId = `ado-validation:${browser.sessionId}:${response.json<{ revision: number }>().revision}`;
      const pendingProjection = (await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers })).json<{ state: string; startedAt: string; expiresAt: string }>();
      expect(pendingProjection).toMatchObject({ state: "validation_pending" });
      expect(Date.parse(pendingProjection.expiresAt) - Date.parse(pendingProjection.startedAt)).toBe(15 * 60_000);
      const token = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId, hostInstanceId: "host-a" });
      const claimResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/${actionId}/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${token}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);
      expect(claimResponse.json()).toMatchObject({ request: { kind: "surface_validate", prepareRequest } });
      const validationClaim = claimResponse.json<{ leaseId: string }>();
      const missingOutcomePayload = { status: "completed" as const };
      const validationResultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId, hostInstanceId: "host-a" });
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${actionId}/result`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${validationResultToken}` }, payload: { contractVersion: "f8-host-action-result-v1", actionId, hostInstanceId: "host-a", leaseId: validationClaim.leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(missingOutcomePayload)).digest("hex"), payload: missingOutcomePayload } })).statusCode).toBe(400);
      const confirmationHash = createHash("sha256").update(JSON.stringify(["WI-1", "C0", "1", prepareRequest.nextContent])).digest("hex");
      const confirmation = {
        status: "confirmation_required", workItemReference: "WI-1", ownerReference: "owner-1", commentReference: "C0", expectedVersion: "1",
        beforeContentHash: "b".repeat(64), nextContent: prepareRequest.nextContent, factorCount: prepareRequest.factorCount,
        confirmationHash, diff: [{ before: "before", after: prepareRequest.nextContent, changed: true }],
      } as const;
      const validationPayload = { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation } };
      expect((await server.inject({
        method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${actionId}/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${validationResultToken}` },
        payload: { contractVersion: "f8-host-action-result-v1", actionId, hostInstanceId: "host-a", leaseId: validationClaim.leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(validationPayload)).digest("hex"), payload: validationPayload },
      })).statusCode).toBe(204);
      expect((await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}`, headers: browser.headers })).json()).toMatchObject({ state: "ado_action_pending" });

      const previewResponse = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(previewResponse.statusCode, previewResponse.payload).toBe(200);
      expect(previewResponse.json()).toMatchObject({ state: "preview_ready", actionId, target: { mode: "create", title: prepareRequest.title }, markdown: rendered.markdown, contentHash: rendered.contentHash, confirmation });
      expect(previewResponse.json()).not.toHaveProperty("leaseId");

      const writeActionId = `ado-write:${browser.sessionId}:${response.json<{ revision: number }>().revision}`;
      const writeClaimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: writeActionId, hostInstanceId: "host-a" });
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/claim`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeClaimToken}` }, payload: { hostInstanceId: "host-a" } })).statusCode).toBe(409);
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/ado/confirm`, headers: browser.headers, payload: { contractVersion: "f8-ado-write-confirmation-v1", validationActionId: actionId, expectedRevision: response.json<{ revision: number }>().revision, target: { mode: "create", title: prepareRequest.title }, contentHash: rendered.contentHash, confirmationHash, confirmed: true } })).statusCode).toBe(201);
      const writeClaimResponse = await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/claim`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeClaimToken}` }, payload: { hostInstanceId: "host-a" } });
      expect(writeClaimResponse.statusCode).toBe(200);
      expect(writeClaimResponse.json()).toMatchObject({ request: { kind: "surface_write", validationActionId: actionId, confirmation } });
      const writePayload = { status: "completed" as const, outcome: { kind: "surface_write" as const, receipt: { status: "updated" as const, workItemReference: "WI-1", commentReference: "C0", version: "2", contentHash: createHash("sha256").update(prepareRequest.nextContent).digest("hex") } } };
      const writeResultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId: writeActionId, hostInstanceId: "host-a" });
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/result`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeResultToken}` }, payload: { contractVersion: "f8-host-action-result-v1", actionId: writeActionId, hostInstanceId: "host-a", leaseId: writeClaimResponse.json<{ leaseId: string }>().leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(writePayload)).digest("hex"), payload: writePayload } })).statusCode).toBe(204);
      expect((await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}`, headers: browser.headers })).json()).not.toMatchObject({ state: "image_decision_required" });
      expect(runner).toHaveBeenCalled();
      expect(runner).toHaveBeenCalledWith(expect.objectContaining({ stage: "f4_running" }));
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("derives ADO preview from the current validated F3 artifact and rejects stale confirmation identity without a write", async () => {
    const rootDir = testRoot("workbench-server-ado-preview-identity");
    await rm(rootDir, { recursive: true, force: true });
    const runner = vi.fn(async () => ({ status: "worker-ran" }));
    const server = await buildWorkbenchServer({ rootDir, runner, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("29292929-2929-4292-8292-292929292929");
      const oldReport = f3Report("Old stale factor");
      const currentReport = f3Report("Current canonical factor", { drawingDimensionKey: undefined, drawingNumber: null, qualitySignals: ["drawing_number_missing"], governanceStatus: "needs_governance" });
      const oldHash = await writeJsonArtifact(rootDir, "f3/old.json", oldReport);
      const currentHash = await writeJsonArtifact(rootDir, "f3/current.json", currentReport);
      const rendered = renderF3AdoMarkdown(currentReport);
      const session = await openSessionStore({ rootDir, sessionId: browser.sessionId });
      try {
        await session.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId: browser.sessionId,
          commandId: "seed-current-f3",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({ snapshot: {
          ...snapshot,
          revision: 2,
          inputRevision: 2,
          state: "ado_decision_required",
          activeAttempt: null,
          downstreamScopeSelection: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "user" },
          priorRunReferences: [{ featureId: "F2", referenceId: "f2-run-a", contractVersion: "v1", workbookHash: "a".repeat(64), runReference: "f2-baseline-a" }],
          artifactRefs: [
            { artifactId: "f3-old", kind: "f3_report", revision: 1, validated: true, reviewContextId: REVIEW_CONTEXT_ID },
            { artifactId: "f3-current", kind: "f3_report", revision: 2, validated: true, reviewContextId: REVIEW_CONTEXT_ID },
          ],
        }, artifactReferenceOps: { upsert: [
          { artifactId: "f3-old", sessionId: browser.sessionId, inputRevision: 1, kind: "f3_report", relativePath: "f3/old.json", contentHash: oldHash, reviewContext: REVIEW_CONTEXT },
          { artifactId: "f3-current", sessionId: browser.sessionId, inputRevision: 2, kind: "f3_report", relativePath: "f3/current.json", contentHash: currentHash, reviewContext: REVIEW_CONTEXT },
        ] } }));
      } finally {
        await session.close();
      }

      const decided = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/commands`,
        headers: browser.headers,
        payload: { contractVersion: "f8-session-command-v1", sessionId: browser.sessionId, commandId: "request-existing-ado-validation", expectedRevision: 1, command: "confirm_ado_decision", payload: { decision: "use_existing", workItemReference: "https://dev.azure.com/org/project/_workitems/edit/42" } },
      });
      expect(decided.statusCode, decided.payload).toBe(202);
      const expectedRevision = decided.json<{ revision: number }>().revision;
      const actionId = `ado-validation:${browser.sessionId}:${expectedRevision}`;
      const validationToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId, hostInstanceId: "host-a" });
      const validationClaim = await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${actionId}/claim`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${validationToken}` }, payload: { hostInstanceId: "host-a" } });
      expect(validationClaim.statusCode).toBe(200);
      expect(validationClaim.json()).toMatchObject({ request: { kind: "surface_validate", prepareRequest: { mode: "existing", workItemReference: "https://dev.azure.com/org/project/_workitems/edit/42", nextContent: rendered.markdown, factorCount: 1 } } });
      expect(validationClaim.json()).not.toMatchObject({ request: { prepareRequest: { nextContent: expect.stringContaining("Old stale factor") } } });
      const confirmationHash = createHash("sha256").update(JSON.stringify(["WI-42", "C0", "7", rendered.markdown])).digest("hex");
      const confirmation = { status: "confirmation_required" as const, workItemReference: "WI-42", ownerReference: "owner-1", commentReference: "C0", expectedVersion: "7", beforeContentHash: "b".repeat(64), nextContent: rendered.markdown, factorCount: 1, confirmationHash, diff: [{ before: "old", after: rendered.markdown, changed: true }] };
      const validationPayload = { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation } };
      const validationResultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId, hostInstanceId: "host-a" });
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${actionId}/result`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${validationResultToken}` }, payload: { contractVersion: "f8-host-action-result-v1", actionId, hostInstanceId: "host-a", leaseId: validationClaim.json<{ leaseId: string }>().leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(validationPayload)).digest("hex"), payload: validationPayload } })).statusCode).toBe(204);

      const preview = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(preview.statusCode).toBe(200);
      expect(preview.json()).toMatchObject({
        state: "preview_ready",
        expectedRevision,
        target: { mode: "existing", workItemReference: "https://dev.azure.com/org/project/_workitems/edit/42" },
        markdown: rendered.markdown,
        contentHash: rendered.contentHash,
      });
      expect(preview.json().markdown).toContain("Current canonical factor");
      expect(preview.json().markdown).not.toContain("Old stale factor");

      for (const payload of [
        { target: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx" }, contentHash: rendered.contentHash, expectedRevision },
        { target: { mode: "existing", workItemReference: "https://dev.azure.com/org/project/_workitems/edit/42" }, contentHash: "9".repeat(64), expectedRevision },
        { target: { mode: "existing", workItemReference: "https://dev.azure.com/org/project/_workitems/edit/42" }, contentHash: rendered.contentHash, expectedRevision: expectedRevision - 1 },
      ]) {
        const rejected = await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/ado/confirm`, headers: browser.headers, payload: { contractVersion: "f8-ado-write-confirmation-v1", validationActionId: actionId, confirmationHash, confirmed: true, ...payload } });
        expect(rejected.statusCode).toBe(409);
      }
      const writeActionId = `ado-write:${browser.sessionId}:${expectedRevision}`;
      const writeClaimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: writeActionId, hostInstanceId: "host-a" });
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/claim`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeClaimToken}` }, payload: { hostInstanceId: "host-a" } })).statusCode).toBe(409);

      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/ado/confirm`, headers: browser.headers, payload: { contractVersion: "f8-ado-write-confirmation-v1", validationActionId: actionId, expectedRevision, target: { mode: "existing", workItemReference: "https://dev.azure.com/org/project/_workitems/edit/42" }, contentHash: rendered.contentHash, confirmationHash, confirmed: true } })).statusCode).toBe(201);
      const writeClaim = await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/claim`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeClaimToken}` }, payload: { hostInstanceId: "host-a" } });
      expect(writeClaim.statusCode).toBe(200);
      expect(writeClaim.json()).toMatchObject({ request: { kind: "surface_write", validationActionId: actionId, confirmation: { nextContent: rendered.markdown } } });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("projects blocked when the write action reaches a terminal blocked result", async () => {
    const rootDir = testRoot("workbench-server-ado-write-blocked");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("67676767-6767-4676-8676-676767676767");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId });
      try {
        const confirmation = testSurfaceConfirmation();
        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: validationActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_validate",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          confirmationHash: confirmation.confirmationHash,
          expectedTargetVersion: "comment-v1",
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
        });
        const validationClaim = await hostActions.claimHostAction(validationActionId, "host-a");
        const validationPayload = { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation } };
        await hostActions.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: validationActionId,
          hostInstanceId: "host-a",
          leaseId: validationClaim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(validationPayload)).digest("hex"),
          payload: validationPayload,
        });

        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: writeActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_write",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          validationActionId,
          confirmationHash: confirmation.confirmationHash,
          expectedTargetVersion: "comment-v1",
          confirmation,
        });
        const writeClaim = await hostActions.claimHostAction(writeActionId, "host-a");
        const blockedPayload = { status: "blocked" as const, reason: "Authorization: Bearer test-token blocked" };
        await hostActions.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: writeActionId,
          hostInstanceId: "host-a",
          leaseId: writeClaim.leaseId,
          status: "blocked",
          resultHash: createHash("sha256").update(JSON.stringify(blockedPayload)).digest("hex"),
          payload: blockedPayload,
        });
      } finally {
        await hostActions.close();
      }

      const response = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        state: "blocked",
        actionId: writeActionId,
        expectedRevision: revision,
        reason: "[redacted credential] blocked",
      });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("uses write-stage blocked fallback text when blocked reason is empty", async () => {
    const rootDir = testRoot("workbench-server-ado-write-blocked-empty-reason");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("76767676-7676-4676-8676-767676767676");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId });
      try {
        const confirmation = testSurfaceConfirmation();
        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: validationActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_validate",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          confirmationHash: confirmation.confirmationHash,
          expectedTargetVersion: "comment-v1",
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
        });
        const validationClaim = await hostActions.claimHostAction(validationActionId, "host-a");
        const validationPayload = { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation } };
        await hostActions.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: validationActionId,
          hostInstanceId: "host-a",
          leaseId: validationClaim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(validationPayload)).digest("hex"),
          payload: validationPayload,
        });

        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: writeActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_write",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          validationActionId,
          confirmationHash: confirmation.confirmationHash,
          expectedTargetVersion: "comment-v1",
          confirmation,
        });
        const writeClaim = await hostActions.claimHostAction(writeActionId, "host-a");
        const blockedPayload = { status: "blocked" as const, reason: " \n\n " };
        await hostActions.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: writeActionId,
          hostInstanceId: "host-a",
          leaseId: writeClaim.leaseId,
          status: "blocked",
          resultHash: createHash("sha256").update(JSON.stringify(blockedPayload)).digest("hex"),
          payload: blockedPayload,
        });
      } finally {
        await hostActions.close();
      }

      const response = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        state: "blocked",
        actionId: writeActionId,
        expectedRevision: revision,
        reason: "Surface write was blocked.",
      });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("projects failed when the write action reaches a terminal failed result", async () => {
    const rootDir = testRoot("workbench-server-ado-write-failed");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("68686868-6868-4686-8686-686868686868");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId });
      try {
        const confirmation = testSurfaceConfirmation();
        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: validationActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_validate",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          confirmationHash: confirmation.confirmationHash,
          expectedTargetVersion: "comment-v1",
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
        });
        const validationClaim = await hostActions.claimHostAction(validationActionId, "host-a");
        const validationPayload = { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation } };
        await hostActions.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: validationActionId,
          hostInstanceId: "host-a",
          leaseId: validationClaim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(validationPayload)).digest("hex"),
          payload: validationPayload,
        });

        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: writeActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_write",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          validationActionId,
          confirmationHash: confirmation.confirmationHash,
          expectedTargetVersion: "comment-v1",
          confirmation,
        });
        const writeClaim = await hostActions.claimHostAction(writeActionId, "host-a");
        const failedPayload = {
          status: "failed" as const,
          error: createTypedError({
            code: "dependency_error",
            summary: "Authorization: Bearer test-token failed",
            suggestedAction: "Retry the ADO write.",
            affectedInputReferences: [writeActionId],
          }),
        };
        await hostActions.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: writeActionId,
          hostInstanceId: "host-a",
          leaseId: writeClaim.leaseId,
          status: "failed",
          resultHash: createHash("sha256").update(JSON.stringify(failedPayload)).digest("hex"),
          payload: failedPayload,
        });
      } finally {
        await hostActions.close();
      }

      const response = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        state: "failed",
        actionId: writeActionId,
        expectedRevision: revision,
        reason: "[redacted credential] failed",
      });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("uses write-stage failed fallback text when failed summary is empty", async () => {
    const rootDir = testRoot("workbench-server-ado-write-failed-empty-summary");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("78787878-7878-4787-8787-787878787878");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId });
      try {
        const confirmation = testSurfaceConfirmation();
        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: validationActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_validate",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          confirmationHash: confirmation.confirmationHash,
          expectedTargetVersion: "comment-v1",
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
        });
        const validationClaim = await hostActions.claimHostAction(validationActionId, "host-a");
        const validationPayload = { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation } };
        await hostActions.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: validationActionId,
          hostInstanceId: "host-a",
          leaseId: validationClaim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(validationPayload)).digest("hex"),
          payload: validationPayload,
        });

        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: writeActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_write",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          validationActionId,
          confirmationHash: confirmation.confirmationHash,
          expectedTargetVersion: "comment-v1",
          confirmation,
        });
        const writeClaim = await hostActions.claimHostAction(writeActionId, "host-a");
        const failedPayload = {
          status: "failed" as const,
          error: createTypedError({
            code: "dependency_error",
            summary: " \n\n ",
            suggestedAction: "Retry the ADO write.",
            affectedInputReferences: [writeActionId],
          }),
        };
        await hostActions.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: writeActionId,
          hostInstanceId: "host-a",
          leaseId: writeClaim.leaseId,
          status: "failed",
          resultHash: createHash("sha256").update(JSON.stringify(failedPayload)).digest("hex"),
          payload: failedPayload,
        });
      } finally {
        await hostActions.close();
      }

      const response = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        state: "failed",
        actionId: writeActionId,
        expectedRevision: revision,
        reason: "Surface write failed.",
      });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns a stable blocked projection when validation action is unavailable", async () => {
    const rootDir = testRoot("workbench-server-ado-missing-validation-action");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("69696969-6969-4696-8696-696969696969");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;

      const response = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        state: "blocked",
        actionId: validationActionId,
        expectedRevision: revision,
        reason: "Surface validation action is unavailable.",
      });
      expect(response.json()).not.toHaveProperty("startedAt");
      expect(response.json()).not.toHaveProperty("expiresAt");
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("requires scoped host bearer credentials for host action claim and result", async () => {
    const rootDir = testRoot("workbench-server-host-actions");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const browser = await server.testAuthenticate("11111111-1111-4111-8111-111111111111");
      const request = {
        contractVersion: "f8-host-action-request-v1",
        actionId: "action-1",
        sessionId: browser.sessionId,
        expectedRevision: 0,
        kind: "model_request",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions`, headers: browser.headers, payload: request })).statusCode).toBe(201);

      const wrongToken = server.issueHostBearer(browser.sessionId, ["host-actions:read"]);
      expect((await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-1/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${wrongToken}` },
        payload: { hostInstanceId: "host-a" },
      })).statusCode).toBe(403);

      const claimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: "action-1", hostInstanceId: "host-a" });
      const claimResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-1/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);
      const claim = claimResponse.json<{ leaseId: string }>();

      const resultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId: "action-1", hostInstanceId: "host-a" });
      const payload = { status: "completed" };
      const resultResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-1/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: {
          contractVersion: "f8-host-action-result-v1",
          actionId: "action-1",
          hostInstanceId: "host-a",
          leaseId: claim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
          payload,
        },
      });

      expect(resultResponse.statusCode).toBe(204);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects host action results whose hash does not match the result payload", async () => {
    const rootDir = testRoot("workbench-server-host-action-hash");
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const browser = await server.testAuthenticate("22222222-2222-4222-8222-222222222222");
      await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-host-action-request-v1",
          actionId: "action-2",
          sessionId: browser.sessionId,
          expectedRevision: 0,
          kind: "model_request",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      });
      const claimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: "action-2", hostInstanceId: "host-a" });
      const claim = (await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-2/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      })).json<{ leaseId: string }>();

      const resultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId: "action-2", hostInstanceId: "host-a" });
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-2/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: {
          contractVersion: "f8-host-action-result-v1",
          actionId: "action-2",
          hostInstanceId: "host-a",
          leaseId: claim.leaseId,
          status: "completed",
          resultHash: "0".repeat(64),
          payload: { status: "completed" },
        },
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects duplicate host action IDs in the same or another session without replacing terminal state", async () => {
    const rootDir = testRoot("workbench-server-durable-host-actions");
    await rm(rootDir, { recursive: true, force: true });
    const first = await buildWorkbenchServer({ rootDir });
    const firstSessionId = "23232323-2323-4232-8232-232323232323";
    const secondSessionId = "24242424-2424-4242-8242-242424242424";
    try {
      const firstBrowser = await first.testAuthenticate(firstSessionId);
      const secondBrowser = await first.testAuthenticate(secondSessionId);
      const create = async (browser: typeof firstBrowser) => first.inject({
          method: "POST",
          url: `/api/sessions/${browser.sessionId}/host-actions`,
          headers: browser.headers,
          payload: {
            contractVersion: "f8-host-action-request-v1",
            actionId: "shared-action",
            sessionId: browser.sessionId,
            expectedRevision: 0,
            kind: "model_request",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        });
      expect((await create(firstBrowser)).statusCode).toBe(201);
      expect((await create(firstBrowser)).statusCode).toBe(409);
      expect((await create(secondBrowser)).statusCode).toBe(409);

      const claimToken = first.issueHostBearer(firstSessionId, ["host-actions:claim"], { actionId: "shared-action", hostInstanceId: "host-a" });
      const claimResponse = await first.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);
      const claim = claimResponse.json<{ leaseId: string }>();
      const resultToken = first.issueHostBearer(firstSessionId, ["host-actions:result"], { actionId: "shared-action", hostInstanceId: "host-a" });
      const payload = { status: "completed" };
      expect((await first.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: {
          contractVersion: "f8-host-action-result-v1",
          actionId: "shared-action",
          hostInstanceId: "host-a",
          leaseId: claim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
          payload,
        },
      })).statusCode).toBe(204);
      expect((await create(firstBrowser)).statusCode).toBe(409);
    } finally {
      await first.close();
    }

    const second = await buildWorkbenchServer({ rootDir });
    try {
      const replayToken = second.issueHostBearer(firstSessionId, ["host-actions:claim"], { actionId: "shared-action", hostInstanceId: "host-a" });
      expect((await second.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${replayToken}` },
        payload: { hostInstanceId: "host-a" },
      })).statusCode).toBe(409);

      const replayResultToken = second.issueHostBearer(firstSessionId, ["host-actions:result"], { actionId: "shared-action", hostInstanceId: "host-a" });
      expect((await second.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${replayResultToken}` },
        payload: {},
      })).statusCode).toBe(400);
    } finally {
      await second.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps event IDs monotonic after retention rollover and marks an expired replay cursor", async () => {
    const rootDir = testRoot("workbench-server-event-rollover");
    await rm(rootDir, { recursive: true, force: true });
    const started = await (await import("./server.js")).startWorkbenchServer({ rootDir });
    try {
      const auth = await started.server.testAuthenticate("25252525-2525-4252-8252-252525252525");
      for (let index = 1; index <= 301; index += 1) {
        started.server.publishEventForTest(auth.sessionId, "progress", { index });
      }

      const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
        const request = get(`${started.url.replace(/\/#.*$/, "")}/api/sessions/${auth.sessionId}/events`, {
          headers: { cookie: auth.headers.cookie, "last-event-id": "1" },
        }, resolve);
        request.once("error", reject);
      });
      let stream = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { stream += chunk; });
      await vi.waitFor(() => {
        expect(stream).toContain("event: replay_truncated");
        expect(stream).toContain("id: 301");
      });

      started.server.publishEventForTest(auth.sessionId, "progress", { index: 302 });
      await vi.waitFor(() => expect(stream).toContain("id: 302"));
      response.destroy();
    } finally {
      started.server.server.closeAllConnections();
      await started.server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("replays persisted session events after a new server instance starts", async () => {
    const rootDir = testRoot("workbench-server-event-restart");
    const sessionId = "26262626-2626-4262-8262-262626262626";
    await rm(rootDir, { recursive: true, force: true });
    const first = await (await import("./server.js")).startWorkbenchServer({ rootDir });
    try {
      const auth = await first.server.testAuthenticate(sessionId);
      first.server.publishEventForTest(auth.sessionId, "progress", { sequence: 1 });
      first.server.publishEventForTest(auth.sessionId, "progress", { sequence: 2 });
    } finally {
      first.server.server.closeAllConnections();
      await first.server.close();
    }

    const second = await (await import("./server.js")).startWorkbenchServer({ rootDir });
    try {
      const auth = await second.server.testAuthenticate(sessionId);
      const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
        const request = get(`${second.url.replace(/\/#.*$/, "")}/api/sessions/${sessionId}/events`, {
          headers: { cookie: auth.headers.cookie, "last-event-id": "1" },
        }, resolve);
        request.once("error", reject);
      });
      let stream = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { stream += chunk; });
      await vi.waitFor(() => expect(stream).toContain("id: 2"));
      expect(stream).toContain('data: {"sequence":2}');
      response.destroy();
    } finally {
      second.server.server.closeAllConnections();
      await second.server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("projects external SessionStore revisions to an open Web event stream", async () => {
    const rootDir = testRoot("workbench-server-external-session-progress");
    const sessionId = "27272727-2727-4272-8272-272727272727";
    await rm(rootDir, { recursive: true, force: true });
    const started = await (await import("./server.js")).startWorkbenchServer({ rootDir });
    try {
      const auth = await started.server.testAuthenticate(sessionId);
      const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
        const request = get(`${started.url.replace(/\/#.*$/, "")}/api/sessions/${sessionId}/events`, { headers: { cookie: auth.headers.cookie } }, resolve);
        request.once("error", reject);
      });
      let stream = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { stream += chunk; });
      await vi.waitFor(() => expect(stream).toContain('"revision":0'));

      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({ contractVersion: "f8-session-command-v1", sessionId, commandId: "chat-upload", expectedRevision: 0, command: "upload_workbook", payload: { fileName: "chat.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" } }, async (snapshot, command) => ({ snapshot: reduceSessionCommand(snapshot, command) }));
      } finally {
        await store.close();
      }

      await vi.waitFor(() => expect(stream).toContain('"revision":1'), { timeout: 3_000 });
      response.destroy();
    } finally {
      started.server.server.closeAllConnections();
      await started.server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

async function seedAdoActionPendingSnapshot(rootDir: string, sessionId: string): Promise<number> {
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    await store.applyCommand({
      contractVersion: "f8-session-command-v1",
      sessionId,
      commandId: "seed-ado-pending",
      expectedRevision: 0,
      command: "upload_workbook",
      payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
    }, async (snapshot) => ({
      snapshot: {
        ...snapshot,
        revision: snapshot.revision + 1,
        inputRevision: 1,
        state: "ado_action_pending",
        activeAttempt: null,
      },
    }));
    const snapshot = await store.readSnapshot();
    return snapshot.revision;
  } finally {
    await store.close();
  }
}

function testSurfaceConfirmation() {
  const nextContent = "governed markdown";
  return {
    status: "confirmation_required" as const,
    workItemReference: "WI-1",
    ownerReference: "owner-1",
    commentReference: "C0",
    expectedVersion: "1",
    beforeContentHash: "b".repeat(64),
    nextContent,
    factorCount: 1,
    confirmationHash: createHash("sha256").update(JSON.stringify(["WI-1", "C0", "1", nextContent])).digest("hex"),
    diff: [{ before: "before", after: nextContent, changed: true }],
  };
}