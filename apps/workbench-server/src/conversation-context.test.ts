import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { taModelContextEnvelopeSchema } from "@ai-assist/contracts";
import type { F8SessionSnapshot, SessionArtifactReference } from "@ai-assist/workbench";

import { buildConversationContext, type ConversationContextArtifactReader } from "./conversation-context.js";

const SESSION_ID = "67676767-6767-4767-8767-676767676767";
const REVIEW_CONTEXT_ID = "c".repeat(64);
const WORKBOOK_HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);

describe("buildConversationContext", () => {
  it("builds a validated TA model context envelope from current governed artifacts and the saved Scenario", async () => {
    const reader = artifacts({
      "f2-current": { reference: artifactReference("f2-current", "f2_report"), json: f2Report() },
      "f4-current": { reference: reviewArtifactReference("f4-current", "f4_calculation"), json: f4Result() },
      "f1-current-image": { reference: reviewArtifactReference("f1-current-image", "f1_image", IMAGE_HASH, { mediaType: "image/png", description: "Tolerance loop image for Analysis-A" }) },
    });

    const envelope = await buildConversationContext(snapshot(), {
      worksheetName: "Analysis-A",
      tableId: "factor-table-1",
      sourceRow: 14,
      factorName: "Gap X",
      calculationReference: "what-if:current",
    }, reader);

    expect(taModelContextEnvelopeSchema.parse(envelope)).toEqual({
      contractVersion: "ta-model-context-envelope-v1",
      session: { sessionId: SESSION_ID, revision: 7 },
      inputRevision: 3,
      worksheet: {
        worksheetName: "Analysis-A",
        tableId: "factor-table-1",
        sourceRow: 14,
        factorName: "Gap X",
        calculationReference: "what-if:current",
      },
      f0Knowledge: [{
        inputRevision: 3,
        worksheetName: "Analysis-A",
        tableId: "factor-table-1",
        sourceRow: 14,
        factorName: "Gap X",
        capabilityStatus: "in_library_recommended",
        f0KnowledgeBaseVersion: "v1",
        summary: "Knowledge Library guidance in_library_recommended for Gap X.",
        recommendation: { kind: "public", capabilityEntryId: "cap-gap-x", toleranceMin: 0.1, toleranceMax: 0.4, unit: "mm", distribution: "normal" },
      }],
      toleranceLoopImage: {
        artifactId: "f1-current-image",
        kind: "f1_image",
        inputRevision: 3,
        worksheetName: "Analysis-A",
        contentHash: IMAGE_HASH,
        mediaType: "image/png",
        description: "Tolerance loop image for Analysis-A",
      },
      factorTable: [{
        inputRevision: 3,
        worksheetName: "Analysis-A",
        tableId: "factor-table-1",
        sourceRow: 14,
        factorName: "Gap X",
        partName: "Display cover",
        unit: "mm",
        nominalValue: 1.2,
        upperTolerance: 0.2,
        lowerTolerance: -0.2,
        distribution: "normal",
        mean: 1.2,
        tolerance: 0.4,
        oneSigma: 0.05,
        contribution: 0.42,
        notes: "critical display stack",
      }],
      baselineMetrics: {
        inputRevision: 3,
        calculationReference: "f4-run-current",
        mean: 1.2,
        rssSigma: 0.08,
        cp: 1.4,
        cpkL: 1.2,
        cpkU: 1.5,
        cpk: 1.2,
        statisticalMargin: 0.3,
        worstCaseMargin: 0.2,
        lowerSpecLimit: 0.6,
        upperSpecLimit: 1.8,
        yield: 0.999,
        dpm: 1000,
        statisticalLower: 0.96,
        statisticalUpper: 1.44,
        worstCaseLower: 1,
        worstCaseUpper: 1.4,
      },
      scenarioMetrics: {
        inputRevision: 3,
        calculationReference: "what-if:current",
        mean: 1.25,
        rssSigma: 0.07,
        cp: 1.5,
        cpkL: 1.3,
        cpkU: 1.6,
        cpk: 1.3,
        statisticalMargin: 0.35,
        worstCaseMargin: 0.25,
      },
      relatedArtifactIds: ["f2-current", "f4-current", "f1-current-image"],
    });
  });

  it("rejects artifact references that do not belong to the selected session", async () => {
    const reader = artifacts({
      "f2-current": { reference: { ...artifactReference("f2-current", "f2_report"), sessionId: "different-session" }, json: f2Report() },
      "f4-current": { reference: reviewArtifactReference("f4-current", "f4_calculation"), json: f4Result() },
    });

    await expect(buildConversationContext(snapshot(), { worksheetName: "Analysis-A" }, reader)).rejects.toMatchObject({
      code: "evidence_mismatch",
      affectedInputReferences: ["f2-current"],
    });
  });

  it("rejects artifact references that do not match the current input revision", async () => {
    const reader = artifacts({
      "f2-current": { reference: { ...artifactReference("f2-current", "f2_report"), inputRevision: 2 }, json: f2Report() },
      "f4-current": { reference: reviewArtifactReference("f4-current", "f4_calculation"), json: f4Result() },
    });

    await expect(buildConversationContext(snapshot(), { worksheetName: "Analysis-A" }, reader)).rejects.toMatchObject({
      code: "evidence_mismatch",
      affectedInputReferences: ["f2-current"],
    });
  });

  it("rejects a saved Scenario whose baseline lineage no longer matches the current workbook or baseline run", async () => {
    const reader = artifacts({
      "f2-current": { reference: artifactReference("f2-current", "f2_report"), json: f2Report() },
      "f4-current": { reference: reviewArtifactReference("f4-current", "f4_calculation"), json: f4Result() },
      "f1-current-image": { reference: reviewArtifactReference("f1-current-image", "f1_image", IMAGE_HASH, { mediaType: "image/png", description: "Tolerance loop image for Analysis-A" }) },
    });
    const staleScenario = {
      ...snapshot().scenarioDrafts![0]!,
      baselineWorkbookHash: "c".repeat(64),
      baselineRunReference: "f4-run-stale",
    };

    await expect(buildConversationContext({ ...snapshot(), scenarioDrafts: [staleScenario] }, { worksheetName: "Analysis-A" }, reader)).rejects.toMatchObject({
      code: "evidence_mismatch",
      affectedInputReferences: ["what-if:current"],
    });
  });

  it("rejects an explicit Scenario selection when the matching draft is not saved", async () => {
    const reader = artifacts({
      "f2-current": { reference: artifactReference("f2-current", "f2_report"), json: f2Report() },
      "f4-current": { reference: reviewArtifactReference("f4-current", "f4_calculation"), json: f4Result() },
      "f1-current-image": { reference: reviewArtifactReference("f1-current-image", "f1_image", IMAGE_HASH, { mediaType: "image/png", description: "Tolerance loop image for Analysis-A" }) },
    });
    const calculatedScenario = {
      ...snapshot().scenarioDrafts![0]!,
      status: "calculated" as const,
    };

    await expect(buildConversationContext(
      { ...snapshot(), scenarioDrafts: [calculatedScenario] },
      { worksheetName: "Analysis-A", calculationReference: "what-if:current" },
      reader,
    )).rejects.toMatchObject({
      code: "evidence_mismatch",
      affectedInputReferences: ["what-if:current"],
    });
  });

  it("rejects a missing selected worksheet", async () => {
    const reader = artifacts({
      "f2-current": { reference: artifactReference("f2-current", "f2_report"), json: f2Report() },
      "f4-current": { reference: reviewArtifactReference("f4-current", "f4_calculation"), json: f4Result() },
    });

    await expect(buildConversationContext(snapshot(), {}, reader)).rejects.toMatchObject({ code: "validation_error" });
  });

  it("drops unsupported or credential-bearing F1 image metadata from the governed envelope", async () => {
    const reader = artifacts({
      "f2-current": { reference: artifactReference("f2-current", "f2_report"), json: f2Report() },
      "f4-current": { reference: reviewArtifactReference("f4-current", "f4_calculation"), json: f4Result() },
      "f1-current-image": { reference: reviewArtifactReference("f1-current-image", "f1_image", IMAGE_HASH, { mediaType: "application/octet-stream", description: "token=abc123" }) },
    });

    const envelope = await buildConversationContext(snapshot(), { worksheetName: "Analysis-A" }, reader);

    expect(envelope.toleranceLoopImage).toBeUndefined();
    expect(envelope.relatedArtifactIds).toEqual(["f2-current", "f4-current"]);
  });
});

function artifacts(entries: Record<string, { readonly reference: SessionArtifactReference; readonly json?: unknown }>): ConversationContextArtifactReader {
  return {
    async readReference(artifactId) {
      return entries[artifactId]?.reference;
    },
    async readJson(artifactId) {
      return entries[artifactId]?.json;
    },
  };
}

function snapshot(): F8SessionSnapshot {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: SESSION_ID,
    revision: 7,
    inputRevision: 3,
    state: "review_required",
    activeAttempt: null,
    priorRunReferences: [],
    downstreamScopeSelection: { workbookContentHash: WORKBOOK_HASH, selectedWorksheetNames: ["Analysis-A"], confirmed: true },
    artifactRefs: [
      { artifactId: "f2-current", kind: "f2_report", revision: 3, validated: true },
      { artifactId: "f4-current", kind: "f4_calculation", revision: 3, validated: true, reviewContextId: REVIEW_CONTEXT_ID },
      { artifactId: "f1-current-image", kind: "f1_image", revision: 3, validated: true, reviewContextId: REVIEW_CONTEXT_ID },
    ],
    scenarioDrafts: [{
      contractVersion: "f8-scenario-draft-v1",
      draftId: "draft-current",
      sessionId: SESSION_ID,
      worksheetName: "Analysis-A",
      inputRevision: 3,
      status: "saved",
      mode: "WHAT_IF",
      baselineWorkbookHash: WORKBOOK_HASH,
      baselineRunReference: "f4-run-current",
      calculationReference: "what-if:current",
      calculationMetrics: { mean: 1.25, rssSigma: 0.07, cp: 1.5, cpkL: 1.3, cpkU: 1.6, cpk: 1.3, statisticalMargin: 0.35, worstCaseMargin: 0.25 },
      factorOverrides: [{ worksheetName: "Analysis-A", tableId: "factor-table-1", sourceRow: 14, upperTolerance: 0.25 }],
    }],
  };
}

function artifactReference(artifactId: string, kind: string, contentHash = hashJson(kind), metadata?: Record<string, unknown>): SessionArtifactReference {
  return { artifactId, sessionId: SESSION_ID, inputRevision: 3, kind, relativePath: `managed/${artifactId}.json`, contentHash, ...(metadata === undefined ? {} : { metadata }) };
}

function reviewArtifactReference(artifactId: string, kind: string, contentHash = hashJson(kind), metadata?: Record<string, unknown>): SessionArtifactReference {
  return { ...artifactReference(artifactId, kind, contentHash, metadata), metadata: { reviewContextId: REVIEW_CONTEXT_ID, reviewContext: { workbookHash: WORKBOOK_HASH, downstreamSelectionHash: "scope-hash", baselineRunReference: "f2-run-current" }, ...metadata } };
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(`${JSON.stringify(value)}\n`).digest("hex");
}

function f2Report() {
  const row = {
    worksheetName: "Analysis-A",
    tableId: "factor-table-1",
    sourceRow: 14,
    actualFields: actualFields(),
    sourceCells: {},
    imageReference: { artifact: "f1", relativePath: "images/analysis-a.png", contentHash: IMAGE_HASH, worksheetName: "Analysis-A" },
    missingRequiredFields: [],
    missingIdentifiers: [],
    capabilityStatus: "in_library_recommended",
    f0KnowledgeBaseVersion: "v1",
    recommendation: { kind: "public", toleranceMin: 0.1, toleranceMax: 0.4, unit: "mm", distribution: "normal", capabilityEntryId: "cap-gap-x" },
    adoReminderRequested: false,
  };
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: { fileName: "anonymous.xlsx", contentHash: WORKBOOK_HASH, f1GeneratedAt: "2026-08-31T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "managed/f2",
    worksheets: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "Display gap", tolerancePathImageStatus: "available", systemSpecification: { status: "available", ...worksheetSystemSpecification() }, systemSpecificationIssues: [], f4CalculabilityIssues: [], rows: [row], missingFieldSummary: [], status: "ready" }],
    f4Handoffs: [{ contractVersion: "v1", handoffVersion: "f4-handoff-v1", inputClassification: "confidential", status: "ready", workbookContentHash: WORKBOOK_HASH, worksheetName: "Analysis-A", toleranceLoopDescription: "Display gap", systemSpecification: { designNominal: 1.2, lowerSpecLimit: worksheetSystemSpecification().lowerSpecLimit, upperSpecLimit: worksheetSystemSpecification().upperSpecLimit, targetSigmaLevel: worksheetSystemSpecification().targetSigmaLevel, targetCpk: 1.4, additionalMeanShift: worksheetSystemSpecification().additionalMeanShift }, factors: [{ tableId: "factor-table-1", sourceRow: 14, unit: "mm", actualFields: actualFields(), sourceCells: {} }] }],
    adoEvents: [],
    summary: { worksheetsChecked: 1, blockedWorksheetCount: 0, readyWorksheetCount: 1, factorRowCount: 1, rowsWithRequiredMissing: 0, requiredMissingFieldCount: 0, missingImageWorksheetCount: 0, internalWithinGuidanceCount: 0, internalGuidanceExceededCount: 0, f0InformationInsufficientCount: 0, publicLibraryMatchCount: 1, nonF0ProcessCategoryCount: 0, unableToCheckCount: 0, publicToleranceDifferenceCount: 0, publicDistributionDifferenceCount: 0, missingDimIdCount: 0, missingPartNumberCount: 0 },
  };
}

function f4Result() {
  return {
    contractVersion: "v1",
    workflowVersion: "f4-f2-v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    runId: "f4-run-current",
    generatedAt: "2026-08-31T00:00:00.000Z",
    source: { artifactReference: "Feature2-Report.json", workbookFileName: "anonymous.xlsx", workbookContentHash: WORKBOOK_HASH },
    calculations: [{ contractVersion: "v1", outputClassification: "confidential", featureId: "F4", status: "completed", calculationVersion: "excel-ta-v1", projectReference: "project-current", runReference: "f4-run-current", workbookContentHash: WORKBOOK_HASH, worksheetSelection: { worksheetName: "Analysis-A", tableId: "factor-table-1" }, factorCount: 1, recommendation: { method: "worst_case", reason: "factor_count_1_to_3", refer3d: false, criticality: "none", criticalityRisk: false }, factors: [{ factorName: "Gap X", unit: "mm", source: { worksheetName: "Analysis-A", tableId: "factor-table-1", sourceRow: 14 }, input: { nominalValue: 1.2, upperTolerance: 0.2, lowerTolerance: -0.2, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal" }, mean: 1.2, halfTolerance: 0.2, sigma: 0.05, contribution: 0.42, trace: { formulaIds: ["factor-mean-v1"], sourceCells: ["E14"] } }], system: { designNominal: 1.2, mean: 1.2, additionalMeanShift: 0, worstCaseUpper: 1.4, worstCaseLower: 1, rssSigma: 0.08 }, capability: { lowerSpecLimit: 0.6, upperSpecLimit: 1.8, targetSigmaLevel: 4.2, targetCpk: 1.4, cp: 1.4, lowerCpk: 1.2, upperCpk: 1.5, cpk: 1.2, lowerZ: 3.6, upperZ: 4.5, lowerDpm: 600, upperDpm: 400, totalDpm: 1000, outOfSpecRatio: 0.001, yield: 0.999, status: "PASS" }, traceRecords: [{ outputField: "capability.cpk", formulaVersion: "excel-ta-v1", formulaId: "cpk-v1", sourceCells: ["capability.lowerCpk", "capability.upperCpk"] }], scenarios: [] }],
    summary: { selectedWorksheetCount: 1, completedWorksheetCount: 1 },
  };
}

function actualFields() {
  return { factorName: "Gap X", partName: "Display cover", drawingNumber: "DWG-1", dimCharacteristicId: "307", partCategory: "Display", nominalValue: 1.2, upperTolerance: 0.2, lowerTolerance: -0.2, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal", mean: 1.2, tolerance: 0.4, oneSigma: 0.05, percentContributionToSigma: 0.42, notes: "critical display stack" };
}

function worksheetSystemSpecification() {
  return {
    designNominal: { status: "available", sourceLabel: "Design nominal", sourceCell: "Analysis-A!B1", displayValue: "1.2", actualValue: 1.2, valueOrigin: "numeric_literal" },
    lowerSpecLimit: { status: "available", sourceLabel: "LSL", sourceCell: "Analysis-A!B2", displayValue: "0.6", actualValue: 0.6, valueOrigin: "numeric_literal" },
    upperSpecLimit: { status: "available", sourceLabel: "USL", sourceCell: "Analysis-A!B3", displayValue: "1.8", actualValue: 1.8, valueOrigin: "numeric_literal" },
    targetSigmaLevel: { status: "available", sourceLabel: "Sigma", sourceCell: "Analysis-A!B4", displayValue: "4.2", actualValue: 4.2, valueOrigin: "numeric_literal" },
    additionalMeanShift: { status: "available", sourceLabel: "Mean shift", sourceCell: "Analysis-A!B5", displayValue: "0", actualValue: 0, valueOrigin: "numeric_literal" },
  };
}