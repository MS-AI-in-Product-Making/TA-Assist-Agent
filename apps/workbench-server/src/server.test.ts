import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it, vi } from "vitest";
import { get } from "node:http";
import { DatabaseSync } from "node:sqlite";

import { buildWorkbenchServer as buildWorkbenchServerBase } from "./server.js";
import type { StartWorkbenchServerOptions } from "./server.js";
import { setAdoRouteClockForTest } from "./routes/ado.js";
import { createConversationStore } from "@ai-assist/conversation";
import { createTypedError } from "@ai-assist/contracts";
import { createHostActionStore, createReviewContextId, createSessionStore, openSessionStore, reduceSessionCommand } from "@ai-assist/workbench";
import { renderF3AdoMarkdown } from "@ai-assist/workflow-runners";
import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.js";
import type { PersistentWorkerQueueOptions, StageJob } from "./sqlite-worker-queue.js";
import type { TaWorkbookOrchestrator } from "@ai-assist/workbench";
import { buildSelectedWorksheetInterpretationContexts } from "./worksheet-interpretation-context.js";

const TEST_ADO_WORK_ITEM_URL = "https://dev.azure.com/MSFTDEVICES/Project%20A/_workitems/edit/42";

function testRoot(name: string): string {
  return join(".tmp", `${name}-${randomUUID()}`);
}

const REVIEW_CONTEXT = {
  workbookHash: "a".repeat(64),
  downstreamSelectionHash: createHash("sha256").update(JSON.stringify(["Analysis-A"])).digest("hex"),
  baselineRunReference: "f2-run-2026-08-25",
};
const REVIEW_CONTEXT_ID = createReviewContextId(REVIEW_CONTEXT);
const ENGLISH_LOCK = { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "turn-en", source: "workflow_start", fallbackUsed: false } as const;
const REQUEST_CONTEXT = { requestedAt: "2026-09-16T15:30:12.000Z", utcOffsetMinutes: -420, source: "web" } as const;
const MULTIMODAL_IMAGE_BYTES = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
const MULTIMODAL_IMAGE_HASH = createHash("sha256").update(MULTIMODAL_IMAGE_BYTES).digest("hex");

function buildWorkbenchServer(options: StartWorkbenchServerOptions) {
  return buildWorkbenchServerBase({ interactionLanguage: ENGLISH_LOCK, ...options });
}

function structuredReviewResult(featureId: "F4" | "F5" | "F6", includeContext = true) {
  const artifacts = featureId === "F4"
    ? [{ artifactId: "f4-calculation", kind: "f4_calculation", relativePath: "f4/Feature4-Calculation.json", contentHash: "1".repeat(64) }]
    : featureId === "F5"
      ? [
          { artifactId: "f5-report", kind: "f5_report", relativePath: "f5/Feature5-Report.json", contentHash: "2".repeat(64) },
          { artifactId: "f5-multimodal", kind: "f5_multimodal", relativePath: "f5/Feature5-Multimodal.json", contentHash: "5".repeat(64) },
        ]
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

function governedDownstreamSelection(workbookContentHash: string, inputRevision: number) {
  return {
    workbookContentHash,
    selectedWorksheetNames: ["Analysis-A"],
    confirmed: true as const,
    provenance: "user" as const,
    decision: "continue_ready" as const,
    inputRevision,
    f2ReportArtifactId: `f2-report-${inputRevision}`,
    f2ReportContentHash: "b".repeat(64),
    findingDigest: "c".repeat(64),
  };
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

function f2ImageBindingReportForArtifactTest(contentHash: string, entries: Array<{ worksheetName: string; relativePath: string }>, workbookHash = "a".repeat(64)) {
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
    workbookContentHash: workbookHash,
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
    workbook: { fileName: "anonymous.xlsx", contentHash: workbookHash, f1GeneratedAt: "2026-08-31T00:00:00.000Z" },
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

function workflowOwnedMultimodalF2Row(worksheetName: string, tableId: string, sourceRow: number, ordinal: string, imagePath: string) {
  return {
    worksheetName,
    tableId,
    sourceRow,
    factorOrdinal: { value: ordinal, rawText: ordinal === "C" ? " C " : ordinal, sourceCell: `${worksheetName}!Z${sourceRow}` },
    actualFields: {
      factorName: `Factor ${worksheetName.at(-1)}${ordinal === "C" ? "1" : ordinal === "A" ? "1" : "2"}`,
      partName: `Part ${worksheetName.at(-1)}`,
      drawingNumber: `DWG-${worksheetName.at(-1)}`,
      dimCharacteristicId: String(sourceRow),
      partCategory: "CNC",
      nominalValue: sourceRow,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      longTermSafetyFactor: 1,
      sigmaLevel: 4,
      distribution: "normal",
      mean: sourceRow,
      tolerance: 0.2,
      oneSigma: 0.025,
      percentContributionToSigma: 0.5,
      notes: null,
    },
    sourceCells: { factorName: `${worksheetName}!A${sourceRow}`, nominalValue: `${worksheetName}!B${sourceRow}` },
    imageReference: { artifact: "f1", relativePath: imagePath, contentHash: MULTIMODAL_IMAGE_HASH, worksheetName },
    missingRequiredFields: [],
    missingIdentifiers: [],
    capabilityStatus: "non_f0_process_category",
    adoReminderRequested: false,
  };
}

function workflowOwnedMultimodalAvailable(sourceCell: string, actualValue: number) {
  return { status: "available", sourceLabel: "label", sourceCell, displayValue: String(actualValue), actualValue, valueOrigin: "numeric_literal" };
}

function workflowOwnedMultimodalF2Report(workbookHash = REVIEW_CONTEXT.workbookHash) {
  const worksheetA = [
    workflowOwnedMultimodalF2Row("Analysis-A", "table-a", 11, "A", "images/analysis-a.png"),
    workflowOwnedMultimodalF2Row("Analysis-A", "table-a", 12, "B", "images/analysis-a.png"),
  ];
  const worksheetB = [workflowOwnedMultimodalF2Row("Analysis-B", "table-b", 21, "C", "images/analysis-b.png")];
  const worksheet = (worksheetName: string, rows: typeof worksheetA | typeof worksheetB) => ({
    worksheetName,
    toleranceLoopDescription: worksheetName,
    tolerancePathImageStatus: "available",
    systemSpecification: {
      status: "available",
      designNominal: workflowOwnedMultimodalAvailable(`${worksheetName}!B1`, 0),
      lowerSpecLimit: workflowOwnedMultimodalAvailable(`${worksheetName}!B2`, -1),
      upperSpecLimit: workflowOwnedMultimodalAvailable(`${worksheetName}!B3`, 1),
      targetSigmaLevel: workflowOwnedMultimodalAvailable(`${worksheetName}!B4`, 4),
      additionalMeanShift: workflowOwnedMultimodalAvailable(`${worksheetName}!B5`, 0),
    },
    systemSpecificationIssues: [],
    f4CalculabilityIssues: [],
    rows,
    missingFieldSummary: [],
    status: "ready",
  });
  const handoff = (worksheetName: string, tableId: string, rows: typeof worksheetA | typeof worksheetB) => ({
    contractVersion: "v1",
    handoffVersion: "f4-handoff-v1",
    inputClassification: "confidential",
    status: "ready",
    workbookContentHash: workbookHash,
    worksheetName,
    toleranceLoopDescription: worksheetName,
    systemSpecification: {
      designNominal: 0,
      lowerSpecLimit: workflowOwnedMultimodalAvailable(`${worksheetName}!B2`, -1),
      upperSpecLimit: workflowOwnedMultimodalAvailable(`${worksheetName}!B3`, 1),
      targetSigmaLevel: workflowOwnedMultimodalAvailable(`${worksheetName}!B4`, 4),
      targetCpk: 4 / 3,
      additionalMeanShift: workflowOwnedMultimodalAvailable(`${worksheetName}!B5`, 0),
    },
    factors: rows.map((row) => ({ tableId, sourceRow: row.sourceRow, factorOrdinal: row.factorOrdinal, unit: "mm", actualFields: row.actualFields, sourceCells: row.sourceCells })),
  });
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: { fileName: "anonymous.xlsx", contentHash: workbookHash, f1GeneratedAt: "2026-09-07T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "managed/f2",
    worksheets: [worksheet("Analysis-A", worksheetA), worksheet("Analysis-B", worksheetB)],
    f4Handoffs: [handoff("Analysis-A", "table-a", worksheetA), handoff("Analysis-B", "table-b", worksheetB)],
    adoEvents: [],
    summary: {
      worksheetsChecked: 2,
      blockedWorksheetCount: 0,
      readyWorksheetCount: 2,
      factorRowCount: 3,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: 0,
      internalWithinGuidanceCount: 0,
      internalGuidanceExceededCount: 0,
      f0InformationInsufficientCount: 0,
      publicLibraryMatchCount: 0,
      nonF0ProcessCategoryCount: 3,
      unableToCheckCount: 0,
      publicToleranceDifferenceCount: 0,
      publicDistributionDifferenceCount: 0,
      missingDimIdCount: 0,
      missingPartNumberCount: 0,
    },
  };
}

function workflowOwnedMultimodalF4Result(workbookHash = REVIEW_CONTEXT.workbookHash) {
  const factor = (worksheetName: string, tableId: string, sourceRow: number, factorName: string) => ({
    factorName,
    unit: "mm",
    source: { worksheetName, tableId, sourceRow },
    input: { nominalValue: sourceRow, upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal" },
    mean: sourceRow,
    halfTolerance: 0.1,
    sigma: 0.025,
    contribution: 0.5,
    trace: { formulaIds: ["factor-mean-v1"], sourceCells: [`${worksheetName}!B${sourceRow}`] },
  });
  const calculation = (worksheetName: string, tableId: string, factors: ReturnType<typeof factor>[]) => ({
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    calculationVersion: "excel-ta-v1",
    projectReference: "project",
    runReference: `run-${worksheetName}`,
    workbookContentHash: workbookHash,
    worksheetSelection: { worksheetName, tableId },
    factorCount: factors.length,
    recommendation: { method: "worst_case", reason: "factor_count_1_to_3", refer3d: false, criticality: "none", criticalityRisk: false },
    factors,
    system: { designNominal: 0, mean: 0, additionalMeanShift: 0, worstCaseUpper: 1, worstCaseLower: -1, rssSigma: 0.1 },
    capability: { lowerSpecLimit: -1, upperSpecLimit: 1, targetSigmaLevel: 4, targetCpk: 1.33, cp: 2, lowerCpk: 2, upperCpk: 2, cpk: 2, lowerZ: 6, upperZ: 6, lowerDpm: 0, upperDpm: 0, totalDpm: 0, outOfSpecRatio: 0, yield: 1, status: "PASS" },
    traceRecords: [{ outputField: "capability.cpk", formulaVersion: "excel-ta-v1", formulaId: "cpk-v1", sourceCells: ["capability.lowerCpk", "capability.upperCpk"] }],
    scenarios: [],
  });
  return {
    contractVersion: "v1",
    workflowVersion: "f4-f2-v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    runId: "f4-run",
    generatedAt: "2026-09-07T00:00:00.000Z",
    source: { artifactReference: "Feature2-Report.json", workbookFileName: "anonymous.xlsx", workbookContentHash: workbookHash },
    calculations: [
      calculation("Analysis-A", "table-a", [factor("Analysis-A", "table-a", 11, "Factor A1"), factor("Analysis-A", "table-a", 12, "Factor A2")]),
      calculation("Analysis-B", "table-b", [factor("Analysis-B", "table-b", 21, "Factor B1")]),
    ],
    summary: { selectedWorksheetCount: 2, completedWorksheetCount: 2 },
  };
}

async function writeWorkflowOwnedMultimodalImages(rootDir: string) {
  await writeImageArtifactFixture(rootDir, "managed/f1/images/analysis-a.png", MULTIMODAL_IMAGE_BYTES);
  await writeImageArtifactFixture(rootDir, "managed/f1/images/analysis-b.png", MULTIMODAL_IMAGE_BYTES);
}

function workflowOwnedMultimodalArtifactReader(sessionId: string, f2Report: ReturnType<typeof workflowOwnedMultimodalF2Report>, f2ReportHash: string, f4Result: ReturnType<typeof workflowOwnedMultimodalF4Result>, f4ResultHash: string) {
  return {
    async readReference(artifactId: string) {
      if (artifactId === "f2-current") return { artifactId, sessionId, inputRevision: 1, kind: "f2_report", relativePath: "managed/f2/Feature2-Report.json", contentHash: f2ReportHash };
      if (artifactId === "f4-current") return { artifactId, sessionId, inputRevision: 1, kind: "f4_calculation", relativePath: "managed/f4/Feature4-Calculation.json", contentHash: f4ResultHash };
      return undefined;
    },
    async readJson(artifactId: string) {
      if (artifactId === "f2-current") return f2Report;
      if (artifactId === "f4-current") return f4Result;
      return undefined;
    },
    async inspectWorksheetImage(input: { worksheetName: string; artifactPath: string; expectedContentHash: string }) {
      return { mediaType: "image/png" as const, contentHash: input.expectedContentHash, byteLength: MULTIMODAL_IMAGE_BYTES.byteLength, artifactPath: input.artifactPath };
    },
  };
}

function completedMultimodalPayload(request: Awaited<ReturnType<typeof buildSelectedWorksheetInterpretationContexts>>[number]) {
  const result = {
    contractVersion: "f5-multimodal-result-v3" as const,
    outputClassification: "confidential" as const,
    requestHash: request.requestHash,
    sessionId: request.sessionId,
    revision: request.revision,
    inputRevision: request.inputRevision,
    workbookContentHash: request.workbook.contentHash,
    worksheetName: request.worksheetName,
    tableId: request.tableId,
    imageContentHash: request.image.contentHash,
    model: { modelId: "test-vision-model", supportsImage: true as const },
    imageTableInterpretation: `Interpreted ${request.worksheetName} with the complete Factor table.`,
    rowMappings: request.factorRows.map((row) => ({ worksheetName: row.worksheetName, tableId: row.tableId, sourceRow: row.sourceRow, factorOrdinal: row.factorOrdinal, mappingStatus: "matched" as const, visibleStatus: "visible" as const, interpretation: `${row.factorOrdinal.value}:${row.factorName}` })),
  };
  return { status: "completed" as const, outcome: { kind: "worksheet_multimodal_response" as const, result, scopeEvaluations: requiredScopeEvaluations() } };
}

function requiredScopeEvaluations() {
  return ["tolerance_loop_closure", "datum_chain", "assembly_datum_face", "stack_start", "direction"].map((scope) => ({
    scope, status: "insufficient_evidence" as const, observedValue: "ambiguous" as const, confidence: "low" as const,
    visibleBasis: "The supplied image does not establish this geometry.",
  }));
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
    async discardForExternalGate() { return false; },
    async assertNoUnreconciledExternalGateJobs() {},
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

  it("creates workflow-owned multimodal host actions without confirm_image_decision and waits for every worksheet outcome", async () => {
    const rootDir = testRoot("workbench-server-review-context-registration");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "30303030-3030-4303-8303-303030303030";
    const f2Report = workflowOwnedMultimodalF2Report();
    const f4Result = workflowOwnedMultimodalF4Result();
    const f2ReportHash = await writeJsonArtifact(rootDir, "managed/f2/Feature2-Report.json", f2Report);
    await writeWorkflowOwnedMultimodalImages(rootDir);
    const reviewContext = {
      workbookHash: REVIEW_CONTEXT.workbookHash,
      downstreamSelectionHash: createHash("sha256").update(JSON.stringify(["Analysis-A", "Analysis-B"])).digest("hex"),
      baselineRunReference: REVIEW_CONTEXT.baselineRunReference,
    };
    const runner = vi.fn(async (job: { readonly stage: string }) => {
      if (job.stage === "f4_running") {
        const f4Hash = await writeJsonArtifact(rootDir, "managed/f4/Feature4-Calculation.json", f4Result);
        return {
          featureId: "F4",
          status: "completed",
          reviewContext,
          artifactReferences: [{ artifactId: "f4-current", kind: "f4_calculation", relativePath: "managed/f4/Feature4-Calculation.json", contentHash: f4Hash }],
        };
      }
      if (job.stage === "f5_running") {
        const registry = JSON.parse(await readFile(join(rootDir, "runtime", "workbench", "registries", "multimodal-artifacts", `${sessionId}.json`), "utf8")) as { path: string; contentHash: string };
        const f5ReportHash = await writeJsonArtifact(rootDir, "managed/f5/Feature5-Report.json", { artifactId: "f5-report" });
        return {
          featureId: "F5",
          status: "completed",
          reviewContext,
          artifactReferences: [
            { artifactId: "f5-multimodal:1", kind: "f5_multimodal", relativePath: relative(rootDir, registry.path), contentHash: registry.contentHash },
            { artifactId: "f5-report", kind: "f5_report", relativePath: "managed/f5/Feature5-Report.json", contentHash: f5ReportHash },
          ],
        };
      }
      if (job.stage === "f6_running") {
        const f6OptimizationHash = await writeJsonArtifact(rootDir, "managed/f6/Feature6-Optimization.json", { artifactId: "f6-optimization" });
        const f6ReportHash = await writeJsonArtifact(rootDir, "managed/f6/Feature6-Report.json", { artifactId: "f6-report" });
        return {
          featureId: "F6",
          status: "completed",
          reviewContext,
          artifactReferences: [
            { artifactId: "f6-optimization", kind: "f6_optimization", relativePath: "managed/f6/Feature6-Optimization.json", contentHash: f6OptimizationHash },
            { artifactId: "f6-report", kind: "f6_report", relativePath: "managed/f6/Feature6-Report.json", contentHash: f6ReportHash },
          ],
        };
      }
      return { status: "completed", artifactReferences: [] };
    });
    const server = await buildWorkbenchServer({
      rootDir,
      runner,
      queueFactory: immediateQueue,
      skipWebAssets: true,
    });
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
              ...governedDownstreamSelection(REVIEW_CONTEXT.workbookHash, 1),
              selectedWorksheetNames: ["Analysis-A", "Analysis-B"],
              f2ReportArtifactId: "f2-current",
              f2ReportContentHash: f2ReportHash,
            },
            priorRunReferences: [{ featureId: "F2", referenceId: "f2-run-2026-08-25", contractVersion: "v1", workbookHash: REVIEW_CONTEXT.workbookHash, runReference: REVIEW_CONTEXT.baselineRunReference }],
            artifactRefs: [{ artifactId: "f2-current", kind: "f2_report", revision: 1, validated: true }],
            activeAttempt: {
              attemptId: "seed-f4:f4_running",
              stage: "f4_running",
              status: "failed",
              startedAt: "2026-08-25T00:00:00.000Z",
              endedAt: "2026-08-25T00:00:01.000Z",
            },
          },
          artifactReferenceOps: {
            upsert: [{ artifactId: "f2-current", sessionId, inputRevision: 1, kind: "f2_report", relativePath: "managed/f2/Feature2-Report.json", contentHash: f2ReportHash }],
          },
        }));
      } finally {
        await store.close();
      }

      const standardRun = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: { contractVersion: "f8-session-command-v1", sessionId, commandId: "retry-f4", expectedRevision: 1, command: "retry", payload: { stage: "f4_running" } },
      });
      expect(standardRun.statusCode).toBe(202);

      const reopened = await openSessionStore({ rootDir, sessionId });
      let requests: Awaited<ReturnType<typeof buildSelectedWorksheetInterpretationContexts>>;
      try {
        const snapshot = await reopened.readSnapshot();
        const runnerError = await readFile(join(rootDir, "runtime", "workbench", "registries", "runner-errors", `${sessionId}.json`), "utf8").catch(() => undefined);
        expect(snapshot.state, runnerError).toBe("f5_running");
        expect(snapshot.state).not.toBe("image_decision_required");
        expect(await reopened.readCommandReceipt("retry-f4:f4_running:image-default")).toBeNull();
        expect(await reopened.readCommandReceipt("confirm-analysis-context")).toBeNull();
        expect(await reopened.readCommandReceipt("confirm-optimization-targets")).toBeNull();

        const f4Reference = await reopened.readArtifactReference("f4-current");
        requests = await buildSelectedWorksheetInterpretationContexts(snapshot, workflowOwnedMultimodalArtifactReader(sessionId, f2Report, f2ReportHash, f4Result, f4Reference!.contentHash!));
        expect(requests.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A", "Analysis-B"]);
      } finally {
        await reopened.close();
      }

      const hostActionStore = await createHostActionStore({ rootDir, sessionId });
      try {
        for (const request of requests) {
          const record = await hostActionStore.getHostAction(`multimodal:${request.requestHash}`);
          expect(record?.request.kind).toBe("vscode_worksheet_multimodal_request");
          expect(record?.request.request.worksheetName).toBe(request.worksheetName);
        }
      } finally {
        await hostActionStore.close();
      }
      expect(runner.mock.calls.map(([job]) => job.stage)).toEqual(["f4_running"]);

      const firstRequest = requests[0]!;
      const firstActionId = `multimodal:${firstRequest.requestHash}`;
      const firstClaimToken = server.issueHostBearer(sessionId, ["host-actions:claim"], { actionId: firstActionId, hostInstanceId: "host-a" });
      const firstClaim = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/host-actions/${encodeURIComponent(firstActionId)}/claim`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${firstClaimToken}` }, payload: { hostInstanceId: "host-a" } });
      expect(firstClaim.statusCode).toBe(200);
      const firstPayload = completedMultimodalPayload(firstRequest);
      const firstResultToken = server.issueHostBearer(sessionId, ["host-actions:result"], { actionId: firstActionId, hostInstanceId: "host-a" });
      const firstResult = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/host-actions/${encodeURIComponent(firstActionId)}/result`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${firstResultToken}` }, payload: { contractVersion: "f8-host-action-result-v1", actionId: firstActionId, hostInstanceId: "host-a", leaseId: firstClaim.json<{ leaseId: string }>().leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(firstPayload)).digest("hex"), payload: firstPayload } });
      expect(firstResult.statusCode).toBe(204);
      expect(runner.mock.calls.map(([job]) => job.stage)).toEqual(["f4_running"]);

      const secondRequest = requests[1]!;
      const secondActionId = `multimodal:${secondRequest.requestHash}`;
      const secondClaimToken = server.issueHostBearer(sessionId, ["host-actions:claim"], { actionId: secondActionId, hostInstanceId: "host-a" });
      const secondClaim = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/host-actions/${encodeURIComponent(secondActionId)}/claim`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${secondClaimToken}` }, payload: { hostInstanceId: "host-a" } });
      expect(secondClaim.statusCode).toBe(200);
      const secondPayload = completedMultimodalPayload(secondRequest);
      const secondResultToken = server.issueHostBearer(sessionId, ["host-actions:result"], { actionId: secondActionId, hostInstanceId: "host-a" });
      const secondResult = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/host-actions/${encodeURIComponent(secondActionId)}/result`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${secondResultToken}` }, payload: { contractVersion: "f8-host-action-result-v1", actionId: secondActionId, hostInstanceId: "host-a", leaseId: secondClaim.json<{ leaseId: string }>().leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(secondPayload)).digest("hex"), payload: secondPayload } });
      expect(secondResult.statusCode).toBe(204);

      const completed = await openSessionStore({ rootDir, sessionId });
      try {
        const snapshot = await completed.readSnapshot();
        const runnerError = await readFile(join(rootDir, "runtime", "workbench", "registries", "runner-errors", `${sessionId}.json`), "utf8").catch(() => undefined);
        expect(snapshot.state, runnerError).toBe("ado_decision_required");
        expect(snapshot.priorRunReferences).toEqual(expect.arrayContaining([
          expect.objectContaining({ featureId: "F6", contractVersion: "f6-input-decision-v1", referenceId: "f6-analysis-context:not_provided" }),
          expect.objectContaining({ featureId: "F6", contractVersion: "f6-input-decision-v1", referenceId: "f6-optimization-targets:not_provided" }),
        ]));
      } finally {
        await completed.close();
      }
      expect(runner.mock.calls.map(([job]) => job.stage)).toEqual(["f4_running", "f5_running", "f6_running"]);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects F6 decision-bound optimization targets that escape managed root via a junction", async ({ skip }) => {
    const rootDir = testRoot("workbench-server-f6-bound-junction-escape");
    const outsideRoot = testRoot("workbench-server-f6-bound-junction-outside");
    await rm(rootDir, { recursive: true, force: true });
    await rm(outsideRoot, { recursive: true, force: true });
    const sessionId = "64646464-6464-4646-8646-646464646464";
    const workbookHash = REVIEW_CONTEXT.workbookHash;
    const optimizationTargets = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      targetVersion: "f6-optimization-targets-v1" as const,
      workbookContentHash: workbookHash,
      worksheets: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        baselineIdentity: {
          calculationVersion: "excel-ta-v1" as const,
          projectReference: "project-a",
          runReference: REVIEW_CONTEXT.baselineRunReference,
          workbookContentHash: workbookHash,
          worksheetName: "Analysis-A",
          tableId: "table-a",
        },
        targets: [{
          targetId: "target-factor-a",
          targetType: "factor_tolerance" as const,
          factor: {
            worksheetName: "Analysis-A",
            tableId: "table-a",
            sourceRow: 14,
            factorName: "Bracket height",
            unit: "mm",
          },
          upperTolerance: 0.08,
          lowerTolerance: -0.08,
          unit: "mm",
        }],
      }],
    };

    await mkdir(outsideRoot, { recursive: true });
    const externalRelativePath = "external/f6-optimization-targets.json";
    const contentHash = await writeJsonArtifact(outsideRoot, externalRelativePath, optimizationTargets);
    const externalAbsolute = join(outsideRoot, externalRelativePath);
    const linkedParent = join(rootDir, "links");
    const linkedRoot = join(linkedParent, "escape");
    await mkdir(linkedParent, { recursive: true });
    try {
      await symlink(dirname(externalAbsolute), linkedRoot, "junction");
    } catch {
      skip("Junction creation unavailable in this environment.");
      return;
    }

    await mkdir(join(rootDir, "runtime", "workbench", "registries", "production-roots"), { recursive: true });
    await writeFile(
      join(rootDir, "runtime", "workbench", "registries", "production-roots", `${sessionId}.json`),
      JSON.stringify({ f1Root: "managed/f1", f2Root: "managed/f2" }),
    );

    const orchestrator = {
      runStage: vi.fn(async () => ({ status: "completed" })),
    } as unknown as TaWorkbookOrchestrator;
    let stageWorker: PersistentWorkerQueueOptions["worker"];
    const server = await buildWorkbenchServer({
      rootDir,
      orchestrator,
      skipWebAssets: true,
      queueFactory: async (options) => {
        stageWorker = options.worker;
        return {
        async enqueue(job) { return { jobId: job.jobId, attemptId: job.attemptId, status: "queued" as const }; },
        async cancel() { return false; },
        async discardForExternalGate() { return false; },
        async assertNoUnreconciledExternalGateJobs() {},
        async reconcile() {},
      };
      },
    });
    try {
      await server.testAuthenticate(sessionId);
      expect(stageWorker).toBeDefined();
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-f6-retry",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: 1,
            inputRevision: 1,
            state: "f6_running",
            initialScopeSelection: {
              workbookContentHash: workbookHash,
              selectedWorksheetNames: ["Analysis-A"],
              confirmed: true,
              provenance: "user",
            },
            downstreamScopeSelection: governedDownstreamSelection(workbookHash, 1),
            priorRunReferences: [
              {
                featureId: "F2",
                referenceId: "f2-run-2026-09-05",
                contractVersion: "v1",
                workbookHash,
                runReference: REVIEW_CONTEXT.baselineRunReference,
              },
              {
                featureId: "F6",
                referenceId: "f6-analysis-context:not_provided",
                contractVersion: "f6-input-decision-v1",
                workbookHash,
              },
              {
                featureId: "F6",
                referenceId: "f6-optimization-targets:provided",
                contractVersion: "f6-input-decision-v1",
                workbookHash,
                runReference: `links/escape/f6-optimization-targets.json#sha256:${contentHash}`,
              },
            ],
            activeAttempt: {
              attemptId: "seed-f6-retry:f6_running",
              stage: "f6_running",
              status: "running",
              startedAt: "2026-09-05T00:00:00.000Z",
            },
          },
        }));
      } finally {
        await store.close();
      }

      await expect(stageWorker!({
        jobId: "job-f6-security",
        attemptId: "attempt-f6-security",
        kind: "calculation",
        stage: "f6_running",
        payload: { sessionId },
      } as StageJob)).rejects.toMatchObject({ code: "policy_denied" });
      expect(orchestrator.runStage).not.toHaveBeenCalled();
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it("rejects changed caller-authorized analysis context content before running F6 optimization", async () => {
    const rootDir = testRoot("workbench-server-f6-analysis-context-hash-mismatch");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "65656565-6565-4656-8656-656565656565";
    const workbookHash = REVIEW_CONTEXT.workbookHash;
    const analysisContext = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      contextVersion: "f6-analysis-context-v2" as const,
      workbookContentHash: workbookHash,
      worksheetCount: 1,
      defaultSupplierConfidence: "unknown",
      defaultDatumMaturity: "legacy_unknown",
      defaultCostBand: "unknown",
      worksheets: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        baselineIdentity: {
          calculationVersion: "excel-ta-v1" as const,
          projectReference: "project-a",
          runReference: REVIEW_CONTEXT.baselineRunReference,
          workbookContentHash: workbookHash,
          worksheetName: "Analysis-A",
          tableId: "table-a",
        },
        factors: [],
      }],
    };
    const relativePath = "uploads/session/f6-analysis-context.json";
    await writeJsonArtifact(rootDir, relativePath, analysisContext);

    await mkdir(join(rootDir, "runtime", "workbench", "registries", "production-roots"), { recursive: true });
    await writeFile(
      join(rootDir, "runtime", "workbench", "registries", "production-roots", `${sessionId}.json`),
      JSON.stringify({ f1Root: "managed/f1", f2Root: "managed/f2" }),
    );

    const orchestrator = {
      runStage: vi.fn(async () => ({ status: "completed" })),
    } as unknown as TaWorkbookOrchestrator;
    let stageWorker: PersistentWorkerQueueOptions["worker"];
    const server = await buildWorkbenchServer({
      rootDir,
      orchestrator,
      skipWebAssets: true,
      queueFactory: async (options) => {
        stageWorker = options.worker;
        return {
          async enqueue(job) { return { jobId: job.jobId, attemptId: job.attemptId, status: "queued" as const }; },
          async cancel() { return false; },
          async discardForExternalGate() { return false; },
          async assertNoUnreconciledExternalGateJobs() {},
          async reconcile() {},
        };
      },
    });
    try {
      await server.testAuthenticate(sessionId);
      expect(stageWorker).toBeDefined();
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-f6-retry",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: 1,
            inputRevision: 1,
            state: "f6_running",
            initialScopeSelection: {
              workbookContentHash: workbookHash,
              selectedWorksheetNames: ["Analysis-A"],
              confirmed: true,
              provenance: "user",
            },
            downstreamScopeSelection: governedDownstreamSelection(workbookHash, 1),
            priorRunReferences: [
              {
                featureId: "F2",
                referenceId: "f2-run-2026-09-05",
                contractVersion: "v1",
                workbookHash,
                runReference: REVIEW_CONTEXT.baselineRunReference,
              },
              {
                featureId: "F6",
                referenceId: "f6-analysis-context:provided",
                contractVersion: "f6-input-decision-v1",
                workbookHash,
                runReference: `${relativePath}#sha256:${"f".repeat(64)}`,
              },
              {
                featureId: "F6",
                referenceId: "f6-optimization-targets:not_provided",
                contractVersion: "f6-input-decision-v1",
                workbookHash,
              },
            ],
            activeAttempt: {
              attemptId: "seed-f6-retry:f6_running",
              stage: "f6_running",
              status: "running",
              startedAt: "2026-09-05T00:00:00.000Z",
            },
          },
        }));
      } finally {
        await store.close();
      }

      await expect(stageWorker!({
        jobId: "job-f6-hash-mismatch",
        attemptId: "attempt-f6-hash-mismatch",
        kind: "calculation",
        stage: "f6_running",
        payload: { sessionId },
      } as StageJob)).rejects.toMatchObject({ code: "evidence_mismatch" });
      expect(orchestrator.runStage).not.toHaveBeenCalled();
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
        async discardForExternalGate() { return false; },
        async assertNoUnreconciledExternalGateJobs() {},
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
          await uploadGate;
          enqueued.push(job);
          await options.sessionStore.persistAttempt({ attemptId: job.attemptId, status: "running", jobId: job.jobId, stage: job.stage });
          return { jobId: job.jobId, attemptId: job.attemptId, status: "queued" as const };
        },
        async cancel() { return false; },
        async discardForExternalGate() { return false; },
        async assertNoUnreconciledExternalGateJobs() {},
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
            downstreamScopeSelection: governedDownstreamSelection(REVIEW_CONTEXT.workbookHash, 1),
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
            downstreamScopeSelection: governedDownstreamSelection(REVIEW_CONTEXT.workbookHash, 1),
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
    const server = await buildWorkbenchServer({ rootDir, interactionLanguage: ENGLISH_LOCK });
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
        payload: { utcOffsetMinutes: -420, source: "web" },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ interactionLanguage: ENGLISH_LOCK });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("server stamps the request instant and rejects a client instant", async () => {
    const rootDir = testRoot("workbench-server-request-context");
    const requestInstant = new Date("2026-09-16T15:30:12.000Z");
    const server = await buildWorkbenchServer({
      rootDir,
      interactionLanguage: ENGLISH_LOCK,
      now: () => requestInstant,
    });
    try {
      const nonce = await server.bootstrap.issueBrowserBootstrap();
      const bootstrap = await server.inject({ method: "POST", url: "/api/bootstrap", payload: { nonce } });
      const cookie = bootstrap.headers["set-cookie"];
      const csrf = await server.inject({ method: "GET", url: "/api/csrf", headers: { host: "127.0.0.1:0", cookie } });

      const created = await server.inject({
        method: "POST",
        url: "/api/sessions",
        headers: { host: "127.0.0.1:0", cookie, "x-csrf-token": csrf.json<{ csrfToken: string }>().csrfToken },
        payload: { utcOffsetMinutes: -420, source: "web" },
      });
      expect(created.statusCode, created.body).toBe(201);
      expect(created.json()).toMatchObject({
        analysisRequestContext: {
          requestedAt: "2026-09-16T15:30:12.000Z",
          utcOffsetMinutes: -420,
          source: "web",
        },
      });

      const rejected = await server.inject({
        method: "POST",
        url: "/api/sessions",
        headers: { host: "127.0.0.1:0", cookie, "x-csrf-token": csrf.json<{ csrfToken: string }>().csrfToken },
        payload: {
          requestedAt: "2020-01-01T00:00:00.000Z",
          utcOffsetMinutes: 0,
          source: "web",
        },
      });
      expect(rejected.statusCode, rejected.body).toBe(400);
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
          output: { featureId: "F0", status: "completed", versions: ["v1", "internal-v1", "interpretation-rules-v2"] },
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

  it("treats blocked F1 discovery output as warning and does not persist selection", async () => {
    const rootDir = testRoot("workbench-server-f1-discovery-blocked-output");
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
          output: { featureId: "F0", status: "completed", versions: ["v1", "internal-v1", "interpretation-rules-v2"] },
        };
      },
      async runWorkbookScopeDiscovery() {
        return {
          status: "blocked",
          skillId: "workbook-scope-discovery-v1",
          inputRevision: 1,
          idempotencyKey: "attempt:f1",
          reasonCode: "scope_runner_blocked",
          summary: "scope runner blocked",
          output: {
            selectionReference: { selectionId: "should-not-persist" },
            prompt: {
              contractVersion: "v1",
              inputClassification: "confidential",
              status: "selectionRequired",
              workbook: { fileName: "book.xlsx", contentHash: "a".repeat(64) },
              options: [{ selectionIndex: 1, worksheetName: "Analysis-A", toleranceLoopDescription: "Analysis loop", worksheetKind: "analysis", source: { discoveryMethod: "worksheet_scan", descriptionCell: "Analysis-A!F11", worksheetAnchor: "Analysis-A!A1" } }],
            },
          },
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
      const auth = await server.testAuthenticate("15151515-1515-4515-8515-151515151515");
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
          commandId: "f1-blocked-warning-upload",
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
            status: "blocked",
            code: "scope_discovery_unavailable",
            summary: expect.stringContaining("workbook-scope-discovery-v1 blocked:"),
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

  it("rejects blocked F1/F2 output and does not persist production roots", async () => {
    const rootDir = testRoot("workbench-server-f1f2-blocked-output");
    await rm(rootDir, { recursive: true, force: true });
    const workbookHash = "a".repeat(64);
    const orchestrator: TaWorkbookOrchestrator = {
      async runStage(stage) {
        if (stage === "f0_validating") {
          return {
            status: "completed",
            skillId: "knowledge-and-rules-validation-v1",
            inputRevision: 1,
            idempotencyKey: "attempt:f0",
            output: { featureId: "F0", status: "completed", versions: ["v1", "internal-v1", "interpretation-rules-v2"] },
          };
        }
        if (stage === "f1_f2_running") {
          return {
            status: "blocked",
            skillId: "workbook-analysis-assets-v1",
            inputRevision: 1,
            idempotencyKey: "attempt:f1f2",
            reasonCode: "f2_blocked",
            summary: "f1-f2 blocked",
            output: { f1Root: "managed/f1", f2Root: "managed/f2" },
          };
        }
        throw new Error(`unexpected stage: ${stage}`);
      },
      async runWorkbookScopeDiscovery() {
        return {
          status: "completed",
          skillId: "workbook-scope-discovery-v1",
          inputRevision: 1,
          idempotencyKey: "attempt:f1",
          output: {
            selectionReference: { selectionId: "selection-ok" },
            prompt: {
              contractVersion: "v1",
              inputClassification: "confidential",
              status: "selectionRequired",
              workbook: { fileName: "book.xlsx", contentHash: workbookHash },
              options: [{ selectionIndex: 1, worksheetName: "Analysis-A", toleranceLoopDescription: "Analysis loop", worksheetKind: "analysis", source: { discoveryMethod: "worksheet_scan", descriptionCell: "Analysis-A!F11", worksheetAnchor: "Analysis-A!A1" } }],
            },
          },
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

    const server = await buildWorkbenchServer({ rootDir, orchestrator, queueFactory: immediateQueue, skipWebAssets: true });
    try {
      const auth = await server.testAuthenticate("16161616-1616-4616-8616-161616161616");
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
          commandId: "f1f2-blocked-upload",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { artifactId, inputClassification: "confidential" },
        },
      });
      expect(uploaded.statusCode).toBe(202);
      expect(uploaded.json()).toMatchObject({ state: "initial_scope_required" });

      const confirmed = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "f1f2-blocked-confirm-initial",
          expectedRevision: uploaded.json<{ revision: number }>().revision,
          command: "confirm_initial_scope",
          payload: { workbookHash, worksheetNames: ["Analysis-A"] },
        },
      });

      expect(confirmed.statusCode).toBe(202);
      const rootsRegistry = await readFile(join(rootDir, "runtime", "workbench", "registries", "production-roots", `${auth.sessionId}.json`), "utf8").catch(() => undefined);
      expect(rootsRegistry).toBeUndefined();
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
          versions: ["v1", "internal-v1", "interpretation-rules-v2"],
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
          versions: ["v1", "internal-v1", "interpretation-rules-v2"],
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

      const uploadReplayArtifactId = "managed-upload-replay-mismatch";
      const uploadReplayRelativePath = `uploads/${auth.sessionId}/workbook/${uploadReplayArtifactId}-upload-replay.xlsx`;
      server.registerArtifactForTest(auth.sessionId, uploadReplayArtifactId, uploadReplayRelativePath, "upload-replay.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await writeFile(join(rootDir, uploadReplayRelativePath), createAnonymousWorkbookZip());
      const mismatchedUploadReplay = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "second-stop-upload",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { artifactId: uploadReplayArtifactId, inputClassification: "confidential" },
        },
      });
      expect(mismatchedUploadReplay.statusCode).toBe(409);
      await expect(readFile(join(rootDir, uploadReplayRelativePath))).rejects.toThrow();

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

      const invalidArtifactId = "managed-invalid-replacement";
      const invalidRelativePath = `uploads/${auth.sessionId}/workbook/${invalidArtifactId}-invalid.xlsx`;
      server.registerArtifactForTest(auth.sessionId, invalidArtifactId, invalidRelativePath, "invalid.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await writeFile(join(rootDir, invalidRelativePath), createAnonymousWorkbookZip());
      const invalidReplacement = await server.inject({ method: "POST", url: `/api/sessions/${auth.sessionId}/commands`, headers: auth.headers, payload: {
        contractVersion: "f8-session-command-v1", sessionId: auth.sessionId, commandId: "second-stop-invalid-replace", expectedRevision: afterInitial.json<{ revision: number }>().revision, command: "replace_workbook",
        payload: { artifactId: invalidArtifactId, previousWorkbookHash: "invalid", inputClassification: "confidential" },
      } });
      expect(invalidReplacement.statusCode).toBe(400);
      await expect(readFile(join(rootDir, invalidRelativePath))).rejects.toThrow();

      const staleArtifactId = "managed-stale-replacement";
      const staleRelativePath = `uploads/${auth.sessionId}/workbook/${staleArtifactId}-stale.xlsx`;
      server.registerArtifactForTest(auth.sessionId, staleArtifactId, staleRelativePath, "stale.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await writeFile(join(rootDir, staleRelativePath), createAnonymousWorkbookZip());
      const staleReplacement = await server.inject({ method: "POST", url: `/api/sessions/${auth.sessionId}/commands`, headers: auth.headers, payload: {
        contractVersion: "f8-session-command-v1", sessionId: auth.sessionId, commandId: "second-stop-stale-replace", expectedRevision: 0, command: "replace_workbook",
        payload: { artifactId: staleArtifactId, previousWorkbookHash: workbookHash, inputClassification: "confidential" },
      } });
      expect(staleReplacement.statusCode).toBe(409);
      await expect(readFile(join(rootDir, staleRelativePath))).rejects.toThrow();

      const replacementArtifactId = "managed-replacement";
      const replacementRelativePath = `uploads/${auth.sessionId}/workbook/${replacementArtifactId}-replacement.xlsx`;
      server.registerArtifactForTest(auth.sessionId, replacementArtifactId, replacementRelativePath, "replacement.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await writeFile(join(rootDir, replacementRelativePath), createAnonymousWorkbookZip());
      const replaceCommand = {
        contractVersion: "f8-session-command-v1" as const,
        sessionId: auth.sessionId,
        commandId: "second-stop-replace",
        expectedRevision: afterInitial.json<{ revision: number }>().revision,
        command: "replace_workbook" as const,
        payload: { artifactId: replacementArtifactId, previousWorkbookHash: workbookHash, inputClassification: "confidential" as const },
      };
      const replaced = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: replaceCommand,
      });
      expect(replaced.statusCode, JSON.stringify(replaced.json())).toBe(202);
      expect(replaced.json()).toMatchObject({ inputRevision: 2, state: "initial_scope_required" });
      expect(replaced.json()).not.toHaveProperty("initialScopeSelection");

      const replayArtifactId = "managed-replacement-replay-mismatch";
      const replayRelativePath = `uploads/${auth.sessionId}/workbook/${replayArtifactId}-replay.xlsx`;
      server.registerArtifactForTest(auth.sessionId, replayArtifactId, replayRelativePath, "replay.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await writeFile(join(rootDir, replayRelativePath), createAnonymousWorkbookZip());
      const mismatchedReplay = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: { ...replaceCommand, payload: { ...replaceCommand.payload, artifactId: replayArtifactId } },
      });
      expect(mismatchedReplay.statusCode).toBe(409);
      await expect(readFile(join(rootDir, replayRelativePath))).rejects.toThrow();
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("materializes the exact downstream-ready set with revision-bound F2 evidence", async () => {
    const rootDir = testRoot("workbench-server-downstream-exact-set");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "88888888-8888-4888-8888-888888888888";
    const workbookHash = "a".repeat(64);
    const report = f2ImageBindingReportForArtifactTest("1".repeat(64), [
      { worksheetName: "Analysis-A", relativePath: "worksheets/analysis-a/tolerance-path.png" },
      { worksheetName: "Analysis-B", relativePath: "worksheets/analysis-b/tolerance-path.png" },
    ]);
    const reportRelativePath = "f2/downstream-exact-set.json";
    const reportHash = await writeJsonArtifact(rootDir, reportRelativePath, report);

    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-downstream-exact-set",
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

      const findings = await server.inject({
        method: "GET",
        url: `/api/sessions/${sessionId}/findings/f2`,
        headers: browser.headers,
      });
      expect(findings.statusCode).toBe(200);
      expect(findings.json()).toMatchObject({
        contractVersion: "f2-findings-decision-projection-v1",
        inputRevision: 1,
        f2ReportArtifactId: "f2-current",
        f2ReportContentHash: reportHash,
        downstreamReadyWorksheetNames: ["Analysis-A", "Analysis-B"],
      });

      const omitted = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "confirm-downstream-omitted",
          expectedRevision: 1,
          command: "confirm_downstream_scope",
          payload: { workbookHash, worksheetNames: ["Analysis-A"] },
        },
      });
      expect(omitted.statusCode).toBe(409);
      expect(omitted.json()).toMatchObject({ error: { code: "evidence_mismatch" } });

      await writeFile(join(rootDir, reportRelativePath), "{}", "utf8");
      const tamperedFindings = await server.inject({
        method: "GET",
        url: `/api/sessions/${sessionId}/findings/f2`,
        headers: browser.headers,
      });
      expect(tamperedFindings.statusCode).toBe(409);
      expect(tamperedFindings.json()).toMatchObject({ error: { code: "evidence_mismatch" } });
      const tampered = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "confirm-downstream-tampered",
          expectedRevision: 1,
          command: "confirm_downstream_scope",
          payload: { workbookHash, worksheetNames: ["Analysis-A", "Analysis-B"] },
        },
      });
      expect(tampered.statusCode).toBe(409);
      expect(tampered.json()).toMatchObject({ error: { code: "evidence_mismatch" } });
      expect(await writeJsonArtifact(rootDir, reportRelativePath, report)).toBe(reportHash);

      const exact = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "confirm-downstream-exact",
          expectedRevision: 1,
          command: "confirm_downstream_scope",
          payload: { workbookHash, worksheetNames: ["Analysis-A", "Analysis-B"] },
        },
      });
      expect(exact.statusCode).toBe(202);
      expect(exact.json()).toMatchObject({
        downstreamScopeSelection: {
          decision: "continue_ready",
          workbookContentHash: workbookHash,
          selectedWorksheetNames: ["Analysis-A", "Analysis-B"],
          inputRevision: 1,
          f2ReportArtifactId: "f2-current",
          f2ReportContentHash: reportHash,
          findingDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      });

      const mismatchedReplay = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "confirm-downstream-exact",
          expectedRevision: 1,
          command: "confirm_downstream_scope",
          payload: { workbookHash, worksheetNames: ["Analysis-A"] },
        },
      });
      expect(mismatchedReplay.statusCode).toBe(409);
      expect(mismatchedReplay.json()).toEqual({ error: "command_receipt_mismatch" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects current-revision F2 findings whose workbook identity differs from the confirmed scope", async () => {
    const rootDir = testRoot("workbench-server-downstream-workbook-mismatch");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "87878787-8787-4787-8787-878787878787";
    const confirmedWorkbookHash = "a".repeat(64);
    const report = f2ImageBindingReportForArtifactTest("1".repeat(64), [{ worksheetName: "Analysis-A", relativePath: "worksheets/analysis-a/tolerance-path.png" }], "e".repeat(64));
    const reportRelativePath = "f2/downstream-workbook-mismatch.json";
    const reportHash = await writeJsonArtifact(rootDir, reportRelativePath, report);
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1", sessionId, commandId: "seed-downstream-workbook-mismatch", expectedRevision: 0,
          command: "upload_workbook", payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: { ...snapshot, revision: 1, inputRevision: 1, state: "downstream_scope_required", activeAttempt: null, initialScopeSelection: { workbookContentHash: confirmedWorkbookHash, selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "user" }, artifactRefs: [{ artifactId: "f2-wrong-workbook", kind: "f2_report", revision: 1, validated: true }] },
          artifactReferenceOps: { upsert: [{ artifactId: "f2-wrong-workbook", sessionId, inputRevision: 1, kind: "f2_report", relativePath: reportRelativePath, contentHash: reportHash }] },
        }));
      } finally { await store.close(); }

      const findings = await server.inject({ method: "GET", url: `/api/sessions/${sessionId}/findings/f2`, headers: browser.headers });
      expect(findings.statusCode).toBe(409);
      expect(findings.json()).toMatchObject({ error: { code: "evidence_mismatch" } });
      const confirmation = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/commands`, headers: browser.headers, payload: {
        contractVersion: "f8-session-command-v1", sessionId, commandId: "confirm-wrong-workbook", expectedRevision: 1, command: "confirm_downstream_scope", payload: { workbookHash: confirmedWorkbookHash, worksheetNames: ["Analysis-A"] },
      } });
      expect(confirmation.statusCode).toBe(409);
      expect(confirmation.json()).toMatchObject({ error: { code: "evidence_mismatch" } });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

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
          versions: ["v1", "internal-v1", "interpretation-rules-v2"],
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
      if (job.stage === "f1_f2_running") {
        const report = f2ImageBindingReportForArtifactTest("1".repeat(64), [
          { worksheetName: "Analysis-A", relativePath: "worksheets/analysis-a/tolerance-path.png" },
        ]);
        const f2Root = join(rootDir, "fixture-f2");
        await writeJsonArtifact(rootDir, "fixture-f2/Feature2-Report.json", report);
        return { featureId: "F2", status: "completed", runId: "fixture-f2", f2Root, workbookContentHash: "a".repeat(64), report };
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
      expect(stages).toEqual(expect.arrayContaining(["f0_validating", "f1_f2_running", "f3_running"]));
      expect(response.json()).toMatchObject({
        initialScopeSelection: { selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "internal_fixture" },
        downstreamScopeSelection: {
          selectedWorksheetNames: ["Analysis-A"],
          confirmed: true,
          provenance: "internal_fixture",
          decision: "continue_ready",
          inputRevision: 1,
          f2ReportContentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          findingDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("recovers a committed active attempt on restart without an upload registry", async () => {
    const rootDir = testRoot("workbench-server-session-recovery");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "14141414-1414-4414-8414-141414141414";
    const store = await createSessionStore({ rootDir, sessionId, interactionLanguage: ENGLISH_LOCK, analysisRequestContext: REQUEST_CONTEXT });
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
      async discardForExternalGate() { return false; },
      async assertNoUnreconciledExternalGateJobs() {},
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

  it("aborts startup before queue reconciliation when persisted session recovery fails", async () => {
    const rootDir = testRoot("workbench-server-corrupt-recovery");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "16161616-1616-4616-8616-161616161616";
    const store = await createSessionStore({ rootDir, sessionId, interactionLanguage: ENGLISH_LOCK, analysisRequestContext: REQUEST_CONTEXT });
    await store.close();
    const database = new DatabaseSync(join(rootDir, "runtime", "workbench", "workbench.sqlite"));
    try {
      database.prepare("UPDATE sessions SET snapshot_json = ? WHERE session_id = ?").run("{}", sessionId);
    } finally {
      database.close();
    }
    const reconcile = vi.fn(async () => undefined);
    const queueFactory = async () => ({
      async enqueue(job: StageJob) { return { jobId: job.jobId, attemptId: job.attemptId, status: "queued" as const }; },
      async recover(job: StageJob) { return { jobId: job.jobId, attemptId: job.attemptId, status: "queued" as const }; },
      async cancel() { return false; },
      async discardForExternalGate() { return false; },
      async assertNoUnreconciledExternalGateJobs() {},
      reconcile,
    });

    await expect(buildWorkbenchServer({ rootDir, queueFactory, skipWebAssets: true })).rejects.toThrow();
    expect(reconcile).not.toHaveBeenCalled();
    await rm(rootDir, { recursive: true, force: true });
  });

  it("restores the managed workbook binding for a committed replacement after restart", async () => {
    const rootDir = testRoot("workbench-server-replacement-recovery");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "15151515-1515-4515-8515-151515151515";
    const artifactId = "replacement-book";
    const relativePath = `uploads/${sessionId}/workbook/${artifactId}-book.xlsx`;
    const store = await createSessionStore({ rootDir, sessionId, interactionLanguage: ENGLISH_LOCK, analysisRequestContext: REQUEST_CONTEXT });
    try {
      const committed = await store.applyCommand({
        contractVersion: "f8-session-command-v1", sessionId, commandId: "crash-window-replace", expectedRevision: 0, command: "replace_workbook",
        payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential", managedArtifactId: artifactId, previousWorkbookHash: "a".repeat(64) },
      }, async (snapshot, command) => ({ snapshot: reduceSessionCommand({ ...snapshot, state: "completed" }, command) }));
      expect(committed.activeAttempt?.commandId).toBe("crash-window-replace");
      expect((await store.readCommittedCommand("crash-window-replace"))?.command).toBe("replace_workbook");
    } finally { await store.close(); }
    await mkdir(dirname(join(rootDir, relativePath)), { recursive: true });
    await writeFile(join(rootDir, relativePath), createAnonymousWorkbookZip());
    const artifactRegistry = join(rootDir, "runtime", "workbench", "registries", "artifacts");
    await mkdir(artifactRegistry, { recursive: true });
    await writeFile(join(artifactRegistry, `${sessionId}.json`), JSON.stringify({ [artifactId]: { sessionId, relativePath, fileName: "book.xlsx", classification: "confidential", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }));
    const recovered: StageJob[] = [];
    const queueFactory = async () => ({
      async enqueue(job: StageJob) { return { jobId: job.jobId, attemptId: job.attemptId, status: "queued" as const }; },
      async recover(job: StageJob) { recovered.push(job); return { jobId: job.jobId, attemptId: job.attemptId, status: "queued" as const }; },
      async cancel() { return false; },
      async discardForExternalGate() { return false; },
      async assertNoUnreconciledExternalGateJobs() {},
      async reconcile() {},
    });

    const server = await buildWorkbenchServer({ rootDir, queueFactory, skipWebAssets: true });
    try {
      const active = JSON.parse(await readFile(join(rootDir, "runtime", "workbench", "registries", "active-workbooks", `${sessionId}.json`), "utf8"));
      expect(active).toEqual({ artifactId });
      expect(recovered).toEqual([expect.objectContaining({ attemptId: "crash-window-replace:f0_validating", stage: "f0_validating", payload: { sessionId } })]);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps create/use ADO decisions pending for Task 13 Surface validation and independent Confirm write", async () => {
    const rootDir = testRoot("workbench-server-ado-host-action");
    await rm(rootDir, { recursive: true, force: true });
    const report = f3Report("Host action canonical factor");
    const reportHash = await writeJsonArtifact(rootDir, "f3/current-host-action.json", report);
    const rendered = renderF3AdoMarkdown(report);
    const prepareRequest = { mode: "create" as const, title: "[TA Requirement][Project][Phase] Update Drawing Requirements for Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: rendered.markdown, factorCount: 1 };
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
          downstreamScopeSelection: governedDownstreamSelection("a".repeat(64), 1),
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
          payload: { decision: "create_new", title: prepareRequest.title, sponsorEmail: prepareRequest.sponsorEmail },
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
      const confirmationHash = createHash("sha256").update(JSON.stringify([TEST_ADO_WORK_ITEM_URL, "C0", "1", prepareRequest.nextContent])).digest("hex");
      const confirmation = {
        status: "confirmation_required", workItemReference: TEST_ADO_WORK_ITEM_URL, ownerReference: prepareRequest.sponsorEmail, commentReference: "C0", expectedVersion: "1",
        beforeContentHash: "b".repeat(64), nextContent: prepareRequest.nextContent, factorCount: prepareRequest.factorCount,
        confirmationHash, diff: [{ before: "before", after: prepareRequest.nextContent, changed: true }],
      } as const;
      const mismatchedOwnerPayload = { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation: { ...confirmation, ownerReference: "other@example.com" } } };
      expect((await server.inject({
        method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${actionId}/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${validationResultToken}` },
        payload: { contractVersion: "f8-host-action-result-v1", actionId, hostInstanceId: "host-a", leaseId: validationClaim.leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(mismatchedOwnerPayload)).digest("hex"), payload: mismatchedOwnerPayload },
      })).statusCode).toBe(400);
      const validationPayload = { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation } };
      expect((await server.inject({
        method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${actionId}/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${validationResultToken}` },
        payload: { contractVersion: "f8-host-action-result-v1", actionId, hostInstanceId: "host-a", leaseId: validationClaim.leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(validationPayload)).digest("hex"), payload: validationPayload },
      })).statusCode).toBe(204);
      expect((await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}`, headers: browser.headers })).json()).toMatchObject({ state: "ado_action_pending" });

      const previewResponse = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(previewResponse.statusCode, previewResponse.payload).toBe(200);
      expect(previewResponse.json()).toMatchObject({ state: "preview_ready", actionId, target: { mode: "create", title: prepareRequest.title, sponsorEmail: prepareRequest.sponsorEmail }, markdown: rendered.markdown, contentHash: rendered.contentHash, confirmation });
      expect(previewResponse.json()).not.toHaveProperty("leaseId");

      const writeActionId = `ado-write:${browser.sessionId}:${response.json<{ revision: number }>().revision}`;
      const writeClaimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: writeActionId, hostInstanceId: "host-a" });
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/claim`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeClaimToken}` }, payload: { hostInstanceId: "host-a" } })).statusCode).toBe(409);
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/ado/confirm`, headers: browser.headers, payload: { contractVersion: "f8-ado-write-confirmation-v1", validationActionId: actionId, expectedRevision: response.json<{ revision: number }>().revision, target: { mode: "create", title: prepareRequest.title, sponsorEmail: prepareRequest.sponsorEmail }, contentHash: rendered.contentHash, confirmationHash, confirmed: true } })).statusCode).toBe(201);
      const writeClaimResponse = await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/claim`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeClaimToken}` }, payload: { hostInstanceId: "host-a" } });
      expect(writeClaimResponse.statusCode).toBe(200);
      expect(writeClaimResponse.json()).toMatchObject({ request: { kind: "surface_write", validationActionId: actionId, confirmation } });
        const writePayload = {
          status: "completed" as const,
          outcome: {
            kind: "surface_write" as const,
            receipt: {
              operation: "created" as const,
              targetIdentity: { organization: "MSFTDEVICES", project: "Project A", workItemId: 42 },
              verifiedAt: "2026-09-01T00:00:00.000Z",
            },
          },
        };
      const writeResultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId: writeActionId, hostInstanceId: "host-a" });
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/result`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeResultToken}` }, payload: { contractVersion: "f8-host-action-result-v1", actionId: writeActionId, hostInstanceId: "host-a", leaseId: writeClaimResponse.json<{ leaseId: string }>().leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(writePayload)).digest("hex"), payload: writePayload } })).statusCode).toBe(204);
      expect((await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}`, headers: browser.headers })).json()).toMatchObject({ state: "review_required" });
      expect(runner).not.toHaveBeenCalled();
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
          downstreamScopeSelection: governedDownstreamSelection("a".repeat(64), 2),
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
      const confirmationHash = createHash("sha256").update(JSON.stringify(["https://dev.azure.com/org/project/_workitems/edit/42", "C0", "7", rendered.markdown])).digest("hex");
      const confirmation = { status: "confirmation_required" as const, workItemReference: "https://dev.azure.com/org/project/_workitems/edit/42", ownerReference: "owner-1", commentReference: "C0", expectedVersion: "7", beforeContentHash: "b".repeat(64), nextContent: rendered.markdown, factorCount: 1, confirmationHash, diff: [{ before: "old", after: rendered.markdown, changed: true }] };
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
        { target: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com" }, contentHash: rendered.contentHash, expectedRevision },
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
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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

  it("projects write_outcome_unknown when write dispatch happened without receipt persistence", async () => {
    const rootDir = testRoot("workbench-server-ado-write-outcome-unknown");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("79797979-7979-4797-8797-797979797979");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      let now = new Date("2026-09-01T00:00:00.000Z");
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId, now: () => now });
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
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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
        now = new Date("2026-09-01T00:00:05.000Z");
        await hostActions.claimHostAction(writeActionId, "host-a");
      } finally {
        await hostActions.close();
      }

      const response = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        state: "write_outcome_unknown",
        actionId: writeActionId,
        validationActionId,
        expectedRevision: revision,
        writeDispatchedAt: "2026-09-01T00:00:05.000Z",
      });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("creates a typed reconcile host action from write_outcome_unknown and exposes it to host pending", async () => {
    const routeNowMs = Date.now();
    setAdoRouteClockForTest(() => routeNowMs);
    const rootDir = testRoot("workbench-server-ado-reconcile-route");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("67676767-6767-4676-8676-676767676767");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId, now: () => new Date(routeNowMs - 120_000) });
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
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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
        await hostActions.claimHostAction(writeActionId, "host-a");
      } finally {
        await hostActions.close();
      }

      const reconcileResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/ado/reconcile`,
        headers: browser.headers,
      });
      expect(reconcileResponse.statusCode).toBe(202);

      const hostToken = server.issueHostBearer(browser.sessionId, ["sessions:read"]);
      const pending = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado/pending`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${hostToken}` } });
      expect(pending.statusCode).toBe(200);
      expect(pending.json()).toMatchObject({
        actionId: `ado-reconcile:${browser.sessionId}:${revision}`,
        kind: "surface_reconcile",
      });
    } finally {
      setAdoRouteClockForTest(undefined);
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects reconcile while the original write lease is still active", async () => {
    const routeNowMs = Date.now();
    setAdoRouteClockForTest(() => routeNowMs);
    const rootDir = testRoot("workbench-server-ado-reconcile-active-lease");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("65656565-6565-4656-8656-656565656565");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId, now: () => new Date(routeNowMs - 20_000) });
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
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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
        await hostActions.claimHostAction(writeActionId, "host-a");
      } finally {
        await hostActions.close();
      }

      const reconcileResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/ado/reconcile`,
        headers: browser.headers,
      });
      expect(reconcileResponse.statusCode).toBe(409);
      expect(reconcileResponse.json()).toMatchObject({ error: "ado_reconcile_unavailable" });
    } finally {
      setAdoRouteClockForTest(undefined);
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns the same reconcile action for repeated reconcile requests while pending", async () => {
    const routeNowMs = Date.now();
    setAdoRouteClockForTest(() => routeNowMs);
    const rootDir = testRoot("workbench-server-ado-reconcile-idempotent-pending");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("61616161-6161-4616-8616-616161616161");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      const reconcileActionId = `ado-reconcile:${browser.sessionId}:${revision}`;
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId, now: () => new Date(routeNowMs - 120_000) });
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
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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
        await hostActions.claimHostAction(writeActionId, "host-a");
      } finally {
        await hostActions.close();
      }

      const first = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/ado/reconcile`,
        headers: browser.headers,
      });
      expect(first.statusCode).toBe(202);
      expect(first.json()).toMatchObject({ actionId: reconcileActionId, status: "pending" });

      const second = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/ado/reconcile`,
        headers: browser.headers,
      });
      expect(second.statusCode).toBe(202);
      expect(second.json()).toMatchObject({ actionId: reconcileActionId, status: "pending" });

      const verifyStore = await createHostActionStore({ rootDir, sessionId: browser.sessionId });
      try {
        const reconcileRecord = await verifyStore.getHostAction(reconcileActionId);
        const writeRecord = await verifyStore.getHostAction(writeActionId);
        expect(reconcileRecord.request.kind).toBe("surface_reconcile");
        expect(reconcileRecord.result).toBeUndefined();
        expect(writeRecord.request.kind).toBe("surface_write");
        expect(writeRecord.result).toBeUndefined();
      } finally {
        await verifyStore.close();
      }
    } finally {
      setAdoRouteClockForTest(undefined);
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns the same reconcile action for repeated reconcile requests after terminal completion", async () => {
    const routeNowMs = Date.now();
    setAdoRouteClockForTest(() => routeNowMs);
    const rootDir = testRoot("workbench-server-ado-reconcile-idempotent-terminal");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("60606060-6060-4606-8606-606060606060");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      const reconcileActionId = `ado-reconcile:${browser.sessionId}:${revision}`;
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId, now: () => new Date(routeNowMs - 120_000) });
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
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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
        await hostActions.claimHostAction(writeActionId, "host-a");
      } finally {
        await hostActions.close();
      }

      const first = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/ado/reconcile`,
        headers: browser.headers,
      });
      expect(first.statusCode).toBe(202);
      expect(first.json()).toMatchObject({ actionId: reconcileActionId, status: "pending" });

      const store = await createHostActionStore({ rootDir, sessionId: browser.sessionId });
      try {
        const claim = await store.claimHostAction(reconcileActionId, "host-a");
        const payload = {
          status: "completed" as const,
          outcome: {
            kind: "surface_reconcile" as const,
            state: "absent" as const,
          },
        };
        await store.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: reconcileActionId,
          hostInstanceId: "host-a",
          leaseId: claim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
          payload,
        });
      } finally {
        await store.close();
      }

      const second = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/ado/reconcile`,
        headers: browser.headers,
      });
      expect(second.statusCode).toBe(200);
      expect(second.json()).toMatchObject({ actionId: reconcileActionId, status: "completed" });
    } finally {
      setAdoRouteClockForTest(undefined);
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed when an existing reconcile action identity differs from the current write identity", async () => {
    const routeNowMs = Date.now();
    setAdoRouteClockForTest(() => routeNowMs);
    const rootDir = testRoot("workbench-server-ado-reconcile-identity-mismatch");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("51515151-5151-4515-8515-515151515151");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      const reconcileActionId = `ado-reconcile:${browser.sessionId}:${revision}`;
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId, now: () => new Date(routeNowMs - 120_000) });
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
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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
        await hostActions.claimHostAction(writeActionId, "host-a");

        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: reconcileActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_reconcile",
          expiresAt: new Date(routeNowMs + 15 * 60_000).toISOString(),
          writeActionId,
          validationActionId,
          confirmationHash: "f".repeat(64),
          expectedTargetVersion: "comment-v1",
          previewIdentity: {
            targetIdentity: { organization: "MSFTDEVICES", project: "Project A", workItemId: 404 },
            previewHash: "0".repeat(64),
            previewMarker: "preview-marker:ado:session:mismatch",
          },
          confirmation,
        });
      } finally {
        await hostActions.close();
      }

      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/ado/reconcile`,
        headers: browser.headers,
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: "ado_reconcile_identity_mismatch" });
    } finally {
      setAdoRouteClockForTest(undefined);
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps original completed write projection even if a late reconcile result is absent", async () => {
    const rootDir = testRoot("workbench-server-ado-reconcile-late-absent");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("64646464-6464-4646-8646-646464646464");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      const reconcileActionId = `ado-reconcile:${browser.sessionId}:${revision}`;
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId, now: () => new Date("2026-09-01T00:00:00.000Z") });
      try {
        const confirmation = testSurfaceConfirmation();
        const expectedContentHash = createHash("sha256").update(confirmation.nextContent).digest("hex");
        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: validationActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_validate",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          confirmationHash: confirmation.confirmationHash,
          expectedTargetVersion: "comment-v1",
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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
        const writePayload = {
          status: "completed" as const,
          outcome: {
            kind: "surface_write" as const,
            receipt: {
              operation: "updated" as const,
              targetIdentity: { organization: "MSFTDEVICES", project: "Project A", workItemId: 42 },
              verifiedAt: "2026-09-01T00:00:00.000Z",
            },
          },
        };
        await hostActions.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: writeActionId,
          hostInstanceId: "host-a",
          leaseId: writeClaim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(writePayload)).digest("hex"),
          payload: writePayload,
        });

        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: reconcileActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_reconcile",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          writeActionId,
          validationActionId,
          confirmationHash: confirmation.confirmationHash,
          expectedTargetVersion: "comment-v1",
          previewIdentity: {
            targetIdentity: { organization: "MSFTDEVICES", project: "Project A", workItemId: 42 },
            previewHash: expectedContentHash,
            previewMarker: "preview-marker:ado:session:late",
          },
          confirmation,
        });
        const reconcileClaim = await hostActions.claimHostAction(reconcileActionId, "host-a");
        const reconcilePayload = {
          status: "completed" as const,
          outcome: {
            kind: "surface_reconcile" as const,
            state: "absent" as const,
          },
        };
        await hostActions.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: reconcileActionId,
          hostInstanceId: "host-a",
          leaseId: reconcileClaim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(reconcilePayload)).digest("hex"),
          payload: reconcilePayload,
        });
      } finally {
        await hostActions.close();
      }

      const projection = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(projection.statusCode).toBe(200);
      expect(projection.json()).toMatchObject({
        state: "completed",
        actionId: writeActionId,
        validationActionId,
        expectedRevision: revision,
        receipt: {
          operation: "updated",
          targetIdentity: { organization: "MSFTDEVICES", project: "Project A", workItemId: 42 },
          verifiedAt: "2026-09-01T00:00:00.000Z",
        },
      });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed for surface write results when confirmation work-item identity is not a strict ADO URL", async () => {
    const rootDir = testRoot("workbench-server-ado-write-identity-fail-closed");
    await rm(rootDir, { recursive: true, force: true });
    const report = f3Report("Host action canonical factor");
    const reportHash = await writeJsonArtifact(rootDir, "f3/current-host-action.json", report);
    const rendered = renderF3AdoMarkdown(report);
    const prepareRequest = { mode: "create" as const, title: "[TA Requirement][Project][Phase] Update Drawing Requirements for Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: rendered.markdown, factorCount: 1 };
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true, surfacePrepareService: { create: async () => prepareRequest } });
    try {
      const browser = await server.testAuthenticate("65656565-6565-4656-8656-656565656565");
      const invalidWorkItemReference = "WI-1";
      const session = await openSessionStore({ rootDir, sessionId: browser.sessionId });
      try {
        await session.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId: browser.sessionId,
          commandId: "seed-ado-decision-invalid-write-identity",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({ snapshot: {
          ...snapshot,
          state: "ado_decision_required",
          revision: snapshot.revision + 1,
          inputRevision: 1,
          activeAttempt: null,
          downstreamScopeSelection: governedDownstreamSelection("a".repeat(64), 1),
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
          commandId: "request-ado-validation-invalid-write-identity",
          expectedRevision: snapshot.revision,
          command: "confirm_ado_decision",
          payload: { decision: "create_new", title: prepareRequest.title, sponsorEmail: prepareRequest.sponsorEmail },
        },
      });
      expect(response.statusCode).toBe(202);

      const validationActionId = `ado-validation:${browser.sessionId}:${response.json<{ revision: number }>().revision}`;
      const token = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: validationActionId, hostInstanceId: "host-a" });
      const claimResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/${validationActionId}/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${token}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);

      const nextContent = prepareRequest.nextContent;
      const validationClaim = claimResponse.json<{ leaseId: string }>();
      const validationResultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId: validationActionId, hostInstanceId: "host-a" });
      const confirmationHash = createHash("sha256").update(JSON.stringify([invalidWorkItemReference, "C0", "1", nextContent])).digest("hex");
      const confirmation = {
        status: "confirmation_required" as const,
        workItemReference: invalidWorkItemReference,
        ownerReference: prepareRequest.sponsorEmail,
        commentReference: "C0",
        expectedVersion: "1",
        beforeContentHash: "b".repeat(64),
        nextContent,
        factorCount: 1,
        confirmationHash,
        diff: [{ before: "before", after: nextContent, changed: true }],
      } as const;
      const validationPayload = { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation } };
      expect((await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/${validationActionId}/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${validationResultToken}` },
        payload: { contractVersion: "f8-host-action-result-v1", actionId: validationActionId, hostInstanceId: "host-a", leaseId: validationClaim.leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(validationPayload)).digest("hex"), payload: validationPayload },
      })).statusCode).toBe(204);

      const writeActionId = `ado-write:${browser.sessionId}:${response.json<{ revision: number }>().revision}`;
      const writeClaimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: writeActionId, hostInstanceId: "host-a" });
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/ado/confirm`, headers: browser.headers, payload: { contractVersion: "f8-ado-write-confirmation-v1", validationActionId, expectedRevision: response.json<{ revision: number }>().revision, target: { mode: "create", title: prepareRequest.title, sponsorEmail: prepareRequest.sponsorEmail }, contentHash: rendered.contentHash, confirmationHash, confirmed: true } })).statusCode).toBe(201);
      const writeClaimResponse = await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/claim`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeClaimToken}` }, payload: { hostInstanceId: "host-a" } });
      expect(writeClaimResponse.statusCode).toBe(200);

      const writePayload = {
        status: "completed" as const,
        outcome: {
          kind: "surface_write" as const,
          receipt: {
            operation: "created" as const,
            targetIdentity: { organization: "unknown-organization", project: "unknown-project", workItemId: 1 },
            verifiedAt: "2026-09-01T00:00:00.000Z",
          },
        },
      };
      const writeResultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId: writeActionId, hostInstanceId: "host-a" });
      const writeResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeResultToken}` },
        payload: { contractVersion: "f8-host-action-result-v1", actionId: writeActionId, hostInstanceId: "host-a", leaseId: writeClaimResponse.json<{ leaseId: string }>().leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(writePayload)).digest("hex"), payload: writePayload },
      });
      expect(writeResponse.statusCode).toBe(400);
      expect(writeResponse.json()).toMatchObject({ error: "host_action_result_integrity_rejected" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("allows a new validation generation only after reconciled_absent and still blocks generation when reconcile is blocked", async () => {
    const routeNowMs = Date.now();
    setAdoRouteClockForTest(() => routeNowMs);
    const rootDir = testRoot("workbench-server-ado-reconcile-new-generation");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate("63636363-6363-4636-8636-636363636363");
      const revision = await seedAdoActionPendingSnapshot(rootDir, browser.sessionId);
      const validationActionId = `ado-validation:${browser.sessionId}:${revision}`;
      const writeActionId = `ado-write:${browser.sessionId}:${revision}`;
      const reconcileActionId = `ado-reconcile:${browser.sessionId}:${revision}`;
      const hostActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId, now: () => new Date(routeNowMs - 120_000) });
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
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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
        await hostActions.claimHostAction(writeActionId, "host-a");

        await hostActions.createHostAction({
          contractVersion: "f8-host-action-request-v1",
          actionId: reconcileActionId,
          sessionId: browser.sessionId,
          expectedRevision: revision,
          kind: "surface_reconcile",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          writeActionId,
          validationActionId,
          confirmationHash: confirmation.confirmationHash,
          expectedTargetVersion: "comment-v1",
          previewIdentity: {
            targetIdentity: { organization: "MSFTDEVICES", project: "Project A", workItemId: 42 },
            previewHash: createHash("sha256").update(confirmation.nextContent).digest("hex"),
            previewMarker: "preview-marker:ado:session:absent",
          },
          confirmation,
        });
        const reconcileClaim = await hostActions.claimHostAction(reconcileActionId, "host-a");
        const absentPayload = {
          status: "completed" as const,
          outcome: {
            kind: "surface_reconcile" as const,
            state: "absent" as const,
          },
        };
        await hostActions.completeHostAction({
          contractVersion: "f8-host-action-result-v1",
          actionId: reconcileActionId,
          hostInstanceId: "host-a",
          leaseId: reconcileClaim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(absentPayload)).digest("hex"),
          payload: absentPayload,
        });
      } finally {
        await hostActions.close();
      }

      const beforeReset = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(beforeReset.statusCode).toBe(200);
      expect(beforeReset.json()).toMatchObject({ state: "reconciled_absent", actionId: reconcileActionId, writeActionId });

      const regenerate = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/ado/start-new-write-generation`,
        headers: browser.headers,
      });
      expect(regenerate.statusCode).toBe(202);
      const nextRevision = regenerate.json<{ revision: number }>().revision;
      const projection = await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}/ado`, headers: browser.headers });
      expect(projection.statusCode).toBe(200);
      expect(projection.json()).toMatchObject({
        state: "validation_pending",
        actionId: `ado-validation:${browser.sessionId}:${nextRevision}`,
        expectedRevision: nextRevision,
      });
      const regeneratedActions = await createHostActionStore({ rootDir, sessionId: browser.sessionId });
      try {
        expect(await regeneratedActions.getHostAction(`ado-validation:${browser.sessionId}:${nextRevision}`)).toMatchObject({
          request: {
            prepareRequest: {
              mode: "create",
              workItemReference: testSurfaceConfirmation().workItemReference,
              title: "TA Drawing Governance - Anonymous.xlsx",
              sponsorEmail: "sponsor@example.com",
            },
          },
        });
      } finally {
        await regeneratedActions.close();
      }

      const blockedRootDir = testRoot("workbench-server-ado-reconcile-blocked-generation");
      await rm(blockedRootDir, { recursive: true, force: true });
      const blockedServer = await buildWorkbenchServer({ rootDir: blockedRootDir, skipWebAssets: true });
      try {
        const blockedBrowser = await blockedServer.testAuthenticate("62626262-6262-4626-8626-626262626262");
        const blockedRevision = await seedAdoActionPendingSnapshot(blockedRootDir, blockedBrowser.sessionId);
        const blockedValidationActionId = `ado-validation:${blockedBrowser.sessionId}:${blockedRevision}`;
        const blockedWriteActionId = `ado-write:${blockedBrowser.sessionId}:${blockedRevision}`;
        const blockedReconcileActionId = `ado-reconcile:${blockedBrowser.sessionId}:${blockedRevision}`;
        const blockedActions = await createHostActionStore({ rootDir: blockedRootDir, sessionId: blockedBrowser.sessionId, now: () => new Date(routeNowMs - 120_000) });
        try {
          const confirmation = testSurfaceConfirmation();
          await blockedActions.createHostAction({
            contractVersion: "f8-host-action-request-v1",
            actionId: blockedValidationActionId,
            sessionId: blockedBrowser.sessionId,
            expectedRevision: blockedRevision,
            kind: "surface_validate",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            confirmationHash: confirmation.confirmationHash,
            expectedTargetVersion: "comment-v1",
            prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
          });
          const validationClaim = await blockedActions.claimHostAction(blockedValidationActionId, "host-a");
          const validationPayload = { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation } };
          await blockedActions.completeHostAction({
            contractVersion: "f8-host-action-result-v1",
            actionId: blockedValidationActionId,
            hostInstanceId: "host-a",
            leaseId: validationClaim.leaseId,
            status: "completed",
            resultHash: createHash("sha256").update(JSON.stringify(validationPayload)).digest("hex"),
            payload: validationPayload,
          });
          await blockedActions.createHostAction({
            contractVersion: "f8-host-action-request-v1",
            actionId: blockedWriteActionId,
            sessionId: blockedBrowser.sessionId,
            expectedRevision: blockedRevision,
            kind: "surface_write",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            validationActionId: blockedValidationActionId,
            confirmationHash: confirmation.confirmationHash,
            expectedTargetVersion: "comment-v1",
            confirmation,
          });
          await blockedActions.claimHostAction(blockedWriteActionId, "host-a");
          await blockedActions.createHostAction({
            contractVersion: "f8-host-action-request-v1",
            actionId: blockedReconcileActionId,
            sessionId: blockedBrowser.sessionId,
            expectedRevision: blockedRevision,
            kind: "surface_reconcile",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            writeActionId: blockedWriteActionId,
            validationActionId: blockedValidationActionId,
            confirmationHash: confirmation.confirmationHash,
            expectedTargetVersion: "comment-v1",
            previewIdentity: {
              targetIdentity: { organization: "MSFTDEVICES", project: "Project A", workItemId: 42 },
              previewHash: createHash("sha256").update(confirmation.nextContent).digest("hex"),
              previewMarker: "preview-marker:ado:session:blocked",
            },
            confirmation,
          });
          const blockedClaim = await blockedActions.claimHostAction(blockedReconcileActionId, "host-a");
          const blockedPayload = {
            status: "blocked" as const,
            reason: "Readback reconciliation was inconclusive.",
          };
          await blockedActions.completeHostAction({
            contractVersion: "f8-host-action-result-v1",
            actionId: blockedReconcileActionId,
            hostInstanceId: "host-a",
            leaseId: blockedClaim.leaseId,
            status: "blocked",
            resultHash: createHash("sha256").update(JSON.stringify(blockedPayload)).digest("hex"),
            payload: blockedPayload,
          });
        } finally {
          await blockedActions.close();
        }

        const blockedRegenerate = await blockedServer.inject({
          method: "POST",
          url: `/api/sessions/${blockedBrowser.sessionId}/ado/start-new-write-generation`,
          headers: blockedBrowser.headers,
        });
        expect(blockedRegenerate.statusCode).toBe(409);
        expect(blockedRegenerate.json()).toMatchObject({ error: "ado_new_generation_unavailable" });
      } finally {
        await blockedServer.close();
        await rm(blockedRootDir, { recursive: true, force: true });
      }
    } finally {
      setAdoRouteClockForTest(undefined);
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
          prepareRequest: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx", sponsorEmail: "sponsor@example.com", nextContent: confirmation.nextContent, factorCount: confirmation.factorCount },
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
    const started = await (await import("./server.js")).startWorkbenchServer({ rootDir, interactionLanguage: ENGLISH_LOCK });
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
    const first = await (await import("./server.js")).startWorkbenchServer({ rootDir, interactionLanguage: ENGLISH_LOCK });
    try {
      const auth = await first.server.testAuthenticate(sessionId);
      first.server.publishEventForTest(auth.sessionId, "progress", { sequence: 1 });
      first.server.publishEventForTest(auth.sessionId, "progress", { sequence: 2 });
    } finally {
      first.server.server.closeAllConnections();
      await first.server.close();
    }

    const second = await (await import("./server.js")).startWorkbenchServer({ rootDir, interactionLanguage: ENGLISH_LOCK });
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
    const started = await (await import("./server.js")).startWorkbenchServer({ rootDir, interactionLanguage: ENGLISH_LOCK });
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
    workItemReference: TEST_ADO_WORK_ITEM_URL,
    ownerReference: "owner-1",
    commentReference: "C0",
    expectedVersion: "1",
    beforeContentHash: "b".repeat(64),
    nextContent,
    factorCount: 1,
    confirmationHash: createHash("sha256").update(JSON.stringify([TEST_ADO_WORK_ITEM_URL, "C0", "1", nextContent])).digest("hex"),
    diff: [{ before: "before", after: nextContent, changed: true }],
  };
}
