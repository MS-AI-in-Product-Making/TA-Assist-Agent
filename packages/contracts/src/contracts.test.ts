import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import * as contractExports from "./index.js";
import {
  calculationCriticalitySchema,
  calculationMethodSchema,
  capabilityEntrySchema,
  capabilityValidationRequestSchema,
  capabilityValidationResultSchema,
  capabilityTierSchema,
  calculationRequestSchema,
  calculationUnavailableRequestSchema,
  calculationResultSchema,
  cpkRequestSchema,
  cpkResultSchema,
  comparisonRequestSchema,
  comparisonResultSchema,
  createTypedError,
  drawingGovernanceRequestSchema,
  drawingGovernanceResultSchema,
  exceptionResolutionRequestSchema,
  exceptionResolutionResultSchema,
  f4ExcelComparisonResultSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationRequestSchema,
  f5DataInterpretationResultSchema,
  f6ApportionmentResultSchema,
  f6AnalysisContextSchema,
  f6AnalysisContextProposalSchema,
  f6AnalysisContextV1Schema,
  f6AnalysisContextV2Schema,
  f6CapabilityBoundSchema,
  f6ControlledScenarioSchema,
  f6CostEvidenceSchema,
  f6DatumEvidenceSchema,
  f6FeasibilityAssessmentSchema,
  f6InputClarificationSchema,
  f6InputFindingSchema,
  f6InputProposalSchema,
  f6LegacyOptimizationResultSchema,
  f6MaterializationResultSchema,
  f6MaterializedDraftSchema,
  f6ModelInterpretationArtifactSchema,
  f6ModelInterpretationV2ArtifactSchema,
  f6OptimizationRequestSchema,
  f6OptimizationResultV2Schema,
  f6OptimizationResultV3Schema,
  f6ReadableOptimizationResultSchema,
  f6OptimizationResultSchema as f6NewOptimizationResultSchema,
  f6OptimizationTargetsProposalSchema,
  f6OptimizationTargetsSchema,
  f6OptimizationTargetsV1Schema,
  f6OptimizationTargetsV2Schema,
  f6ReverseSolveResultSchema,
  f6SupplierCapabilityEvidenceSchema,
  f6ToleranceChangeSchema,
  f5ImageObservationArtifactSchema,
  f5ImageObservationArtifactV2Schema,
  f5ObjectiveInterpretationCompletedResultSchema,
  f2InitialWorkflowRequestSchema,
  f2InitialWorkflowResultSchema,
  f2ArtifactInputSchema,
  f2FindingsDecisionProjectionSchema,
  f2WorksheetFindingProjectionSchema,
  f4HandoffReadySchema,
  f2UserReportSchema,
  f8AdoProjectionSchema,
  f8AdoWriteConfirmationSchema,
  f8PublicSessionCommandSchema,
  identifierQualityCheckRequestSchema,
  identifierQualityCheckResultSchema,
  interpretationRequestSchema,
  interpretationResultSchema,
  unifiedExceptionResolutionV2RequestSchema,
  unifiedExceptionResolutionV2ResultSchema,
  engineeringRuleEntrySchema,
  engineeringRuleQuerySchema,
  internalToleranceGuidanceEntrySchema,
  internalToleranceGuidanceManifestSchema,
  internalToleranceGuidanceRequestSchema,
  internalToleranceGuidanceResultSchema,
  internalToleranceGuidanceSourceMetadataSchema,
  interpretationEntryTypeSchema,
  interpretationKnowledgeEntrySchema,
  interpretationKnowledgeManifestSchema,
  interpretationKnowledgeSeedPackageSchema,
  interpretationKnowledgeSourceMetadataSchema,
  interpretationProvenanceSchema,
  interpretationRuleEvaluationRequestSchema,
  interpretationRuleEvaluationSchema,
  interpretationRuleLoadRequestSchema,
  interpretationRuleVersionSchema,
  knowledgeBaseQueryResultSchema,
  knowledgeBaseManifestSchema,
  knowledgeBaseQueryRequestSchema,
  workbookCatalogRequestSchema,
  workbookCatalogResultSchema,
  dataClassificationSchema,
  errorCodeSchema,
  runRequestSchema,
  requiredFieldCheckRequestSchema,
  requiredFieldCheckResultSchema,
  semanticTableDetectionRequestSchema,
  semanticTableDetectionResultSchema,
  skillResultSchema,
  terminologyEntrySchema,
  typedErrorSchema,
  worksheetAnalysisAssetsRequestSchema,
  worksheetAnalysisAssetsResultSchema,
  worksheetImageReadRequestSchema,
  worksheetImageReadResultSchema,
  worksheetSelectionConfirmationResultSchema,
  worksheetSelectionConfirmationSchema,
  worksheetSelectionPromptSchema,
  worksheetSelectionViewRequestSchema,
  worksheetSelectionViewResultSchema,
  workflowRequestSchema,
  workflowResultSchema,
} from "./index.js";
import type {
  CalculationCapabilityResult,
  CalculationCompletedPayload,
  CalculationCriticality,
  CalculationFactorResult,
  CalculationMethod,
} from "./index.js";

describe("F7 report narrative contracts", () => {
  it("accepts available report analysis with governed narrative and rejects extra fields", () => {
    const analysis = {
      status: "available" as const,
      provenance: {
        knowledgeBaseVersion: "interpretation-rules-v2" as const,
        ruleId: "performance-cpk-below-target" as const,
        threshold: 1.33,
        applicability: "one-dimensional interpretation applied to the resolved Monte Carlo capability result",
      },
      comparison: {
        setup: { mean: 0, standardDeviation: 0.1, cp: 1.1, cpk: 0.95 },
        monteCarlo: { mean: 0.08, standardDeviation: 0.12, cp: 1.18, cpk: 0.92 },
      },
      targetAssessment: "Monte Carlo Cpk 0.920 is below the resolved target of 1.33.",
      interpretations: ["Mean changed from Setup 0.0000 to Monte Carlo 0.0800 (+0.0800)."],
      optimizationDirections: ["Reduce total variation only after representative variation evidence confirms the modeled shortfall."],
      rootCauseSignals: [{
        ruleId: "root-cause-excessive-variation",
        title: "Excessive variation",
        sourceAlias: "interpretation-rules",
        sourceFileHash: "a".repeat(64),
      }],
      controlledOptions: [{
        ruleId: "improvement-reduce-variation",
        title: "Reduce variation",
        sourceAlias: "interpretation-rules",
        sourceFileHash: "b".repeat(64),
      }],
      validationRequirements: ["Confirm representative measured variation before changing tolerance or process controls."],
      narrative: {
        resultJudgment: {
          status: "below-target",
          headline: "Capability is below target",
          judgment: "Cpk 0.92 is 0.41 below the resolved target of 1.33.",
          cpk: 0.92,
          targetCpk: 1.33,
          margin: -0.41,
          display: {
            cpk: "0.92",
            targetCpk: "1.33",
            margin: "-0.41",
          },
          nearerSpecificationSide: "USL",
        },
        engineeringSummary: "Capability is below target by 0.41 and requires validation before any corrective change.",
        rootCauseAnalysis: [{
          ruleId: "root-cause-mean-shift",
          title: "Mean shift",
          hypothesisStatus: "hypothesis",
          narrative: "Cp exceeds Cpk and indicates a centering-loss hypothesis that requires validation.",
          completeEvidence: true,
          quantitativeEvidence: {
            cpCpkGap: 0.26,
            specificationMidpoint: 0,
            meanOffset: 0.08,
            direction: "USL",
          },
          quantitativeEvidenceLabels: {
            cpCpkGap: "Cp-Cpk gap",
            specificationMidpoint: "Specification midpoint",
            meanOffset: "Mean offset",
            direction: "Direction",
          },
        }],
        engineeringRisk: "The capability shortfall indicates below-target performance and requires validation.",
        suggestedActionSequence: [{
          optionId: "improvement-center-mean",
          title: "Center the mean",
          narrative: "Confirm mean-centering feasibility before changing the process centerline.",
          validationSteps: ["Validate mean-centering feasibility with representative evidence."],
        }],
        validationRequirements: ["Validate mean-centering feasibility with representative evidence."],
        evidenceDisclosure: "Measured Monte Carlo evidence was supplied for this narrative projection. Provenance: interpretation-rules-v2. Matched rule IDs: root-cause-mean-shift. This output does not replace ME review or F6 optimization.",
      },
    };

    const parsed = contractExports.f7ReportAnalysisSchema.parse(analysis);
    expect(parsed).toEqual(analysis);
    expect(contractExports.f7ReportAnalysisSchema.safeParse({
      ...analysis,
      narrative: { ...analysis.narrative, extra: true },
    }).success).toBe(false);
  });

  it("keeps unavailable report analysis unchanged without narrative", () => {
    const unavailable = {
      status: "unavailable" as const,
      reason: "TA comparison is unavailable because Monte Carlo capability is not evaluable.",
      optimizationDirections: ["Resolve zero or invalid variation evidence, then rerun Monte Carlo capability."],
    };

    expect(contractExports.f7ReportAnalysisSchema.parse(unavailable)).toEqual(unavailable);
    expect(contractExports.f7ReportAnalysisSchema.safeParse({
      ...unavailable,
      narrative: {},
    }).success).toBe(false);
  });
});

describe("F8 Web ADO contracts", () => {
  const confirmation = {
    status: "confirmation_required" as const,
    workItemReference: "WI-42",
    ownerReference: "owner@example.com",
    commentReference: "C0",
    expectedVersion: "7",
    beforeContentHash: "a".repeat(64),
    nextContent: "# Governed preview",
    factorCount: 2,
    confirmationHash: "b".repeat(64),
    diff: [{ before: "old", after: "new", changed: true }],
  };

  describe("F8 Scenario public command contracts", () => {
    it("accepts a public saved worksheet Scenario with system specification overrides", () => {
      const command = {
        contractVersion: "f8-session-command-v1",
        sessionId: "session-a",
        commandId: "save-system-spec-draft",
        expectedRevision: 4,
        command: "save_what_if_draft",
        payload: {
          draftId: "draft-system-spec",
          worksheetName: "Analysis-A",
          inputRevision: 2,
          factorOverrides: [],
          systemSpecification: { lowerSpecLimit: 1.35, upperSpecLimit: 1.62 },
        },
      };

      expect(f8PublicSessionCommandSchema.parse(command)).toEqual(command);
    });
  });

  it("accepts a sanitized validation preview and rejects host lease data", () => {
    const preview = {
      contractVersion: "f8-ado-projection-v1",
      sessionId: "session-a",
      state: "preview_ready",
      actionId: "ado-validation:session-a:2",
      expectedRevision: 2,
      target: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx" },
      markdown: confirmation.nextContent,
      contentHash: "c".repeat(64),
      confirmation,
    };
    expect(f8AdoProjectionSchema.parse(preview)).toEqual(preview);
    expect(f8AdoProjectionSchema.safeParse({ ...preview, leaseId: "secret" }).success).toBe(false);
  });

  it("binds Web write confirmation to revision, action, and confirmation hash", () => {
    const request = {
      contractVersion: "f8-ado-write-confirmation-v1",
      validationActionId: "ado-validation:session-a:2",
      expectedRevision: 2,
      target: { mode: "create", title: "TA Drawing Governance - Anonymous.xlsx" },
      contentHash: "c".repeat(64),
      confirmationHash: "b".repeat(64),
      confirmed: true,
    };
    expect(f8AdoWriteConfirmationSchema.parse(request)).toEqual(request);
  });
});

describe("F2 findings decision projection contracts", () => {
  const workbookHash = "a".repeat(64);
  const reportContentHash = "b".repeat(64);
  const findingDigest = "c".repeat(64);

  it("accepts Drawing Number and DIM ID warnings without blocking", () => {
    const finding = {
      contractVersion: "f2-worksheet-finding-projection-v1",
      worksheetName: "Gap",
      readiness: "downstream_ready",
      identifierWarnings: ["drawing_number_missing", "dim_id_missing"],
      blockers: [],
      sourceRows: [12],
    } as const;

    expect(f2WorksheetFindingProjectionSchema.parse(finding)).toEqual(finding);
  });

  it.each(["drawing_number_missing", "dim_id_missing"])("rejects warning-only identifier code %s as a blocker", (blocker) => {
    expect(f2WorksheetFindingProjectionSchema.safeParse({
      contractVersion: "f2-worksheet-finding-projection-v1",
      worksheetName: "Gap",
      readiness: "blocked",
      identifierWarnings: [],
      blockers: [blocker],
      sourceRows: [12],
    }).success).toBe(false);
  });

  it("uses current identifier semantics for new projections while the historical report reader accepts partNumber", () => {
    const legacyWarning = {
      contractVersion: "f2-worksheet-finding-projection-v1",
      worksheetName: "Gap",
      readiness: "downstream_ready",
      identifierWarnings: ["part_number_missing"],
      blockers: [],
      sourceRows: [12],
    };

    expect(f2WorksheetFindingProjectionSchema.safeParse(legacyWarning).success).toBe(false);
  });

  it("binds the exact downstream-ready worksheet set to report order and evidence", () => {
    const projection = {
      contractVersion: "f2-findings-decision-projection-v1",
      workbookHash,
      inputRevision: 3,
      f2ReportArtifactId: "f2-report-3",
      f2ReportContentHash: reportContentHash,
      findingDigest,
      worksheetFindings: [
        {
          contractVersion: "f2-worksheet-finding-projection-v1",
          worksheetName: "Gap-B",
          readiness: "downstream_ready",
          identifierWarnings: ["drawing_number_missing"],
          blockers: [],
          sourceRows: [22],
        },
        {
          contractVersion: "f2-worksheet-finding-projection-v1",
          worksheetName: "Gap-A",
          readiness: "blocked",
          identifierWarnings: [],
          blockers: ["tolerance_path_image_missing"],
          sourceRows: [],
        },
      ],
      downstreamReadyWorksheetNames: ["Gap-B"],
    } as const;

    expect(f2FindingsDecisionProjectionSchema.parse(projection)).toEqual(projection);
    expect(() => f2FindingsDecisionProjectionSchema.parse({
      ...projection,
      downstreamReadyWorksheetNames: [],
    })).toThrow(/exact downstream-ready worksheet set/i);
  });
});

describe("F2 artifact user report contracts", () => {
  const contentHash = "a".repeat(64);
  const systemSpecification = {
    status: "available" as const,
    designNominal: { status: "available" as const, actualValue: 1.627, displayValue: "1.627", sourceLabel: "Design Nominal:", sourceCell: "Analysis-A!P27", valueOrigin: "numeric_literal" as const },
    lowerSpecLimit: { status: "available" as const, actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54", valueOrigin: "numeric_literal" as const },
    upperSpecLimit: { status: "available" as const, actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55", valueOrigin: "numeric_literal" as const },
    targetSigmaLevel: { status: "available" as const, actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal" as const },
    additionalMeanShift: { status: "available" as const, actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" as const },
  };
  const actualFields = {
    factorName: "Bracket arm",
    partName: "Bracket",
    drawingNumber: null,
    dimCharacteristicId: null,
    partCategory: "CNC",
    nominalValue: 3.145,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
    mean: 3.145,
    tolerance: 0.1,
    oneSigma: 0.025,
    percentContributionToSigma: 0.043,
    notes: null,
  };
  const displayFields = {
    factorName: "Bracket arm",
    partName: "Bracket",
    drawingNumber: null,
    dimCharacteristicId: null,
    partCategory: "CNC",
    nominalValue: "3.145",
    upperTolerance: "0.100",
    lowerTolerance: "-0.100",
    longTermSafetyFactor: "1",
    sigmaLevel: "4",
    distribution: "Normal",
    mean: "3.145",
    tolerance: "0.100",
    oneSigma: "0.0250",
    percentContributionToSigma: "4.3%",
    notes: null,
  };
  const artifactInput = {
    contractVersion: "v1",
    inputClassification: "confidential",
    artifactRoot: "test/demo-output/feature1-output/Demo",
    workbook: { fileName: "Demo.xlsx", contentHash, f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
    worksheets: [{
      worksheetName: "Analysis-A",
      systemSpecification,
      worksheetJsonPath: "sheets/Demo.xlsx/json/Analysis-A.json",
      worksheetMdPath: "sheets/Demo.xlsx/md/Analysis-A.md",
      tolerancePathImage: { status: "available", imagePath: "sheets/Demo.xlsx/images/a.png", contentHash: "b".repeat(64), mediaType: "image/png" },
      factorTables: [{
        tableId: "table-a",
        headerRow: 1,
        dataRange: { startRow: 2, endRow: 2 },
        columns: [],
        rows: [{ sourceRow: 2, factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!A2" }, fields: {}, actualFields }],
      }],
    }],
  };
  const row = {
    worksheetName: "Analysis-A",
    tableId: "table-a",
    sourceRow: 2,
    actualFields,
    displayFields,
    sourceCells: { factorName: "Analysis-A!A2" },
    imageReference: { artifact: "f1", relativePath: "sheets/Demo.xlsx/images/a.png", contentHash: "b".repeat(64), worksheetName: "Analysis-A" },
    missingRequiredFields: [],
    missingIdentifiers: ["dimCharacteristicId", "partNumber"],
    capabilityStatus: "internal_within_guidance",
    f0KnowledgeBaseVersion: "internal-v1",
    recommendation: {
      kind: "internal-guidance",
      assessedTotalBand: 0.2,
      maximumRecommendedTotalBand: 0.2,
      unit: "mm",
      matchedEntryId: "cnc-linear-6",
      fallbackApplied: false,
      evidence: { sourceFileHash: "c".repeat(64), sheetName: "ISO 2768-1 Class m", sourceRange: "A6:F6" },
    },
    adoReminderRequested: true,
  };
  const handoff = {
    contractVersion: "v1",
    handoffVersion: "f4-handoff-v1",
    inputClassification: "confidential",
    status: "ready",
    workbookContentHash: contentHash,
    worksheetName: "Analysis-A",
    systemSpecification: {
      designNominal: 1.627,
      lowerSpecLimit: systemSpecification.lowerSpecLimit,
      upperSpecLimit: systemSpecification.upperSpecLimit,
      targetSigmaLevel: systemSpecification.targetSigmaLevel,
      targetCpk: 1,
      additionalMeanShift: systemSpecification.additionalMeanShift,
    },
    factors: [{ tableId: row.tableId, sourceRow: row.sourceRow, unit: "mm", actualFields: row.actualFields, sourceCells: row.sourceCells }],
  };
  const completedReport = {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: { fileName: "Demo.xlsx", contentHash, f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: artifactInput.artifactRoot,
    worksheets: [{ worksheetName: "Analysis-A", status: "ready", tolerancePathImageStatus: "available", systemSpecification, systemSpecificationIssues: [], rows: [row], missingFieldSummary: [] }],
    f4Handoffs: [handoff],
    adoEvents: [{ eventType: "adoReminderRequested", category: "CNC", worksheetName: "Analysis-A", missingFields: ["dimCharacteristicId", "partNumber"], factorRows: [2], workbookContentHash: contentHash }],
    summary: { worksheetsChecked: 1, blockedWorksheetCount: 0, readyWorksheetCount: 1, factorRowCount: 1, rowsWithRequiredMissing: 0, requiredMissingFieldCount: 0, missingImageWorksheetCount: 0, internalWithinGuidanceCount: 1, internalGuidanceExceededCount: 0, f0InformationInsufficientCount: 0, publicLibraryMatchCount: 0, nonF0ProcessCategoryCount: 0, unableToCheckCount: 0, publicToleranceDifferenceCount: 0, publicDistributionDifferenceCount: 0, missingDimIdCount: 1, missingPartNumberCount: 1 },
  };

  it("accepts artifact-only inputs and non-blocking capability differences", () => {
    expect(f2ArtifactInputSchema.parse(artifactInput)).toEqual(artifactInput);
    expect(f2UserReportSchema.parse(completedReport)).toEqual({
      ...completedReport,
      worksheets: completedReport.worksheets.map((worksheet) => ({ ...worksheet, f4CalculabilityIssues: [] })),
    });
    expect(f2ArtifactInputSchema.safeParse({ ...artifactInput, workbookPath: "Demo.xlsx" }).success).toBe(false);
    expect(f2ArtifactInputSchema.safeParse({ ...artifactInput, workbookBytes: new Uint8Array([1]) }).success).toBe(false);
    const incompleteActualFields = { ...actualFields } as Partial<typeof actualFields>;
    delete incompleteActualFields.notes;
    expect(f2ArtifactInputSchema.safeParse({
      ...artifactInput,
      worksheets: [{
        ...artifactInput.worksheets[0],
        factorTables: [{ ...artifactInput.worksheets[0].factorTables[0], rows: [{ sourceRow: 2, fields: {}, actualFields: incompleteActualFields }] }],
      }],
    }).success).toBe(false);
    expect(f2UserReportSchema.safeParse({
      ...completedReport,
      worksheets: [{ ...completedReport.worksheets[0], rows: [{ ...row, displayedFields: { factorName: "display" } }] }],
    }).success).toBe(false);
  });

  it("normalizes historical partNumber field keys at the F2 report reader boundary", () => {
    const legacyActualFields = { ...actualFields, partNumber: actualFields.drawingNumber } as Record<string, unknown>;
    const legacyDisplayFields = { ...displayFields, partNumber: displayFields.drawingNumber } as Record<string, unknown>;
    delete legacyActualFields.drawingNumber;
    delete legacyDisplayFields.drawingNumber;
    const legacyReport = structuredClone(completedReport);
    legacyReport.worksheets[0]!.rows[0]!.actualFields = legacyActualFields as typeof actualFields;
    legacyReport.worksheets[0]!.rows[0]!.displayFields = legacyDisplayFields as typeof displayFields;
    legacyReport.f4Handoffs[0]!.factors[0]!.actualFields = legacyActualFields as typeof actualFields;

    const parsed = f2UserReportSchema.parse(legacyReport);

    if (parsed.status === "inputRejected") throw new Error("expected accepted F2 report");
    expect(parsed.worksheets[0]?.rows[0]?.actualFields).toHaveProperty("drawingNumber", null);
    expect(parsed.worksheets[0]?.rows[0]?.actualFields).not.toHaveProperty("partNumber");
    expect(parsed.worksheets[0]?.rows[0]?.displayFields).toHaveProperty("drawingNumber", null);
    expect(parsed.f4Handoffs[0]?.factors[0]?.actualFields).toHaveProperty("drawingNumber", null);
  });

  it("accepts an optional tolerance loop description during F2 migration", () => {
    const withDescription = {
      ...artifactInput,
      worksheets: [{
        ...artifactInput.worksheets[0],
        toleranceLoopDescription: "Anonymous device gap",
      }],
    };

    expect(f2ArtifactInputSchema.parse(withDescription)).toEqual(withDescription);
    expect(() => f2ArtifactInputSchema.parse(artifactInput)).not.toThrow();
  });

  it("accepts input rejection but rejects inconsistent business and ADO states", () => {
    expect(f2UserReportSchema.safeParse({
      contractVersion: "v1",
      inputClassification: "confidential",
      status: "inputRejected",
      artifactRoot: artifactInput.artifactRoot,
      artifactIssues: [{ reasonCode: "root_md_missing", artifactPath: "Feature1-Report.md" }],
    }).success).toBe(true);
    expect(f2UserReportSchema.safeParse({ ...completedReport, status: "blocked" }).success).toBe(false);
    expect(f2UserReportSchema.safeParse({ ...completedReport, adoEvents: [{ ...completedReport.adoEvents[0], missingFields: [] }] }).success).toBe(false);
    expect(f2UserReportSchema.safeParse({ ...completedReport, knowledgeBaseVersions: ["v1"] }).success).toBe(false);
    expect(f2UserReportSchema.safeParse({ ...completedReport, worksheets: [{ ...completedReport.worksheets[0], rows: [{ ...row, f0KnowledgeBaseVersion: "v1" }] }] }).success).toBe(false);
    expect(f2UserReportSchema.safeParse({ ...completedReport, worksheets: [{ ...completedReport.worksheets[0], rows: [{ ...row, recommendation: undefined }] }] }).success).toBe(false);
    expect(f2ArtifactInputSchema.safeParse({ ...artifactInput, worksheets: [{ ...artifactInput.worksheets[0], worksheetJsonPath: "../outside.json" }] }).success).toBe(false);
  });

  it("enforces ready and blocked worksheet F4 handoff invariants", () => {
    expect(f4HandoffReadySchema.parse(handoff)).toEqual(handoff);
    expect(f2UserReportSchema.safeParse({ ...completedReport, f4Handoffs: [] }).success).toBe(false);
    expect(f2UserReportSchema.safeParse({
      ...completedReport,
      status: "blocked",
      worksheets: [{
        ...completedReport.worksheets[0],
        status: "blocked",
        systemSpecificationIssues: [{ field: "targetSigmaLevel", reasonCode: "response_summary_value_missing" }],
      }],
    }).success).toBe(false);
    expect(f4HandoffReadySchema.safeParse({
      ...handoff,
      systemSpecification: { ...handoff.systemSpecification, targetCpk: 2 },
    }).success).toBe(false);
  });
});

describe("F2 Initial workflow contracts", () => {
  const workbookContentHash = "f".repeat(64);
  const worksheetAnalysisAssets = {
    contractVersion: "v1",
    workbook: { classification: "confidential", contentHash: workbookContentHash, catalogContractVersion: "v1" },
    worksheets: [{
      worksheetName: "Analysis",
      toleranceLoopDescription: "public demo loop",
      factorTables: [],
      formulaCells: [],
      imageAssets: [],
    }],
  };
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    knowledgeBaseVersion: "v1",
    mappingRuleVersion: "v1",
    toleranceUnitAssumption: "mm",
    worksheetAnalysisAssets,
  };
  const readyWorksheet = {
    worksheetName: "Analysis",
    status: "readyForNextFeature",
    blockingIssues: [],
    mappingRecords: [],
    capabilityChecks: [],
    governanceSignals: [],
  };
  const result = {
    contractVersion: "v1",
    inputClassification: "confidential",
    knowledgeBaseVersion: "v1",
    mappingRuleVersion: "v1",
    workbookContentHash,
    toleranceUnitAssumption: "mm",
    status: "completed",
    worksheets: [readyWorksheet],
    summary: {
      worksheetsChecked: 1,
      readyForNextFeatureCount: 1,
      blockedWorksheetCount: 0,
      blockingIssueCount: 0,
      mappingRecordCount: 0,
      capabilityCheckCount: 0,
      governanceSignalCount: 0,
    },
  };
  const rowSource = { worksheetName: "Blocked", tableId: "factor-table-1", sourceRow: 2 };
  const capabilityEvidence = {
    ...rowSource,
    knowledgeBaseVersion: "v1",
    mappingRuleVersion: "v1",
    itemId: "item-demo-bracket-arm",
    capabilityEntryId: "cap-demo-bracket",
    totalTolerance: 0.4,
    unit: "mm",
    actualDistribution: "uniform",
    recommendedDistribution: "normal",
    hitKeywords: ["bracket arm"],
    sourceCells: { upperTolerance: "Blocked!D2", lowerTolerance: "Blocked!E2", distribution: "Blocked!F2" },
  };
  const mappingSource = {
    ...rowSource,
    knowledgeBaseVersion: "v1",
    mappingRuleVersion: "v1",
    partCategory: "demo-bracket",
    factorName: "bracket arm length",
    partName: "mount",
    sourceCells: { partCategory: "Blocked!C2", factorName: "Blocked!A2", partName: "Blocked!B2" },
  };
  const candidate = {
    itemId: "item-demo-bracket-arm",
    itemName: "demo bracket arm",
    capabilityEntryId: "cap-demo-bracket",
    hitKeywords: ["bracket arm"],
    hitSources: ["factorName"],
  };
  const blockedWorksheet = {
    worksheetName: "Blocked",
    status: "blocked",
    blockingIssues: [
      { ...rowSource, issueCode: "required_field_unavailable", field: "partName", reasonCode: "missing" },
      { worksheetName: "Blocked", tableId: "empty-table", issueCode: "factor_table_has_no_rows" },
      { worksheetName: "Blocked", issueCode: "cross_section_image_unavailable", reasonCode: "image_missing" },
      { ...capabilityEvidence, issueCode: "tolerance_out_of_range" },
      { ...capabilityEvidence, issueCode: "distribution_mismatch" },
    ],
    mappingRecords: [
      { ...mappingSource, status: "category_not_defined" },
      { ...mappingSource, status: "item_unmatched", canonicalPartCategory: "demo-bracket" },
      { ...mappingSource, status: "item_ambiguous", canonicalPartCategory: "demo-bracket", candidates: [candidate, { ...candidate, itemId: "item-demo-bracket-mount" }] },
    ],
    capabilityChecks: [
      { ...capabilityEvidence, status: "tolerance_and_distribution_match" },
      { ...capabilityEvidence, status: "tolerance_out_of_range" },
      { ...capabilityEvidence, status: "distribution_mismatch" },
      { ...capabilityEvidence, status: "tolerance_and_distribution_mismatch" },
    ],
    governanceSignals: [
      { ...rowSource, field: "drawingNumber", signalKind: "identifier_missing" },
      { ...rowSource, field: "drawingNumber", signalKind: "identifier_evidence_unavailable", reasonCode: "missing_cached_value" },
      { ...rowSource, field: "drawingNumber", signalKind: "identifier_text_invalid" },
      { ...rowSource, field: "dimCharacteristicId", signalKind: "dim_id_duplicate", normalizedDimId: "dim-1" },
    ],
  };
  const blockedResult = {
    ...result,
    status: "blocked",
    worksheets: [blockedWorksheet],
    summary: {
      worksheetsChecked: 1,
      readyForNextFeatureCount: 0,
      blockedWorksheetCount: 1,
      blockingIssueCount: 5,
      mappingRecordCount: 3,
      capabilityCheckCount: 4,
      governanceSignalCount: 4,
    },
  };

  it("accepts strict trusted F1 requests and derived completed results", () => {
    expect(f2InitialWorkflowRequestSchema.parse(request)).toEqual(request);
    expect(f2InitialWorkflowResultSchema.parse(result)).toEqual(result);
    expect(f2InitialWorkflowRequestSchema.safeParse({ ...request, workbookPath: "not-allowed" }).success).toBe(false);
  });

  it("rejects duplicate worksheets and mismatched statuses or summaries", () => {
    expect(f2InitialWorkflowRequestSchema.safeParse({
      ...request,
      worksheetAnalysisAssets: { ...worksheetAnalysisAssets, worksheets: [worksheetAnalysisAssets.worksheets[0], worksheetAnalysisAssets.worksheets[0]] },
    }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({ ...result, worksheets: [readyWorksheet, readyWorksheet] }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({ ...result, status: "blocked" }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({ ...result, summary: { ...result.summary, blockingIssueCount: 1 } }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({ ...result, worksheets: [{ ...readyWorksheet, status: "blocked" }] }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({ ...blockedResult, worksheets: [{ ...blockedWorksheet, status: "readyForNextFeature" }] }).success).toBe(false);
  });

  it("accepts every controlled record branch and all overall statuses", () => {
    expect(f2InitialWorkflowResultSchema.safeParse(blockedResult).success).toBe(true);
    expect(f2InitialWorkflowResultSchema.safeParse({
      ...blockedResult,
      status: "partiallyBlocked",
      worksheets: [blockedWorksheet, readyWorksheet],
      summary: { ...blockedResult.summary, worksheetsChecked: 2, readyForNextFeatureCount: 1 },
    }).success).toBe(true);
  });

  it("rejects unknown nested record keys and incomplete row provenance", () => {
    expect(f2InitialWorkflowResultSchema.safeParse({
      ...blockedResult,
      worksheets: [{ ...blockedWorksheet, mappingRecords: [{ ...blockedWorksheet.mappingRecords[0], unexpected: true }] }],
    }).success).toBe(false);
    const incompleteMapping = structuredClone(blockedWorksheet.mappingRecords[0]);
    Reflect.deleteProperty(incompleteMapping, "sourceRow");
    expect(f2InitialWorkflowResultSchema.safeParse({
      ...blockedResult,
      worksheets: [{ ...blockedWorksheet, mappingRecords: [incompleteMapping] }],
      summary: { ...blockedResult.summary, mappingRecordCount: 1 },
    }).success).toBe(false);
    expect(f2InitialWorkflowResultSchema.safeParse({
      ...blockedResult,
      knowledgeBaseVersion: "v2",
    }).success).toBe(false);
  });
});

describe("Phase 0 contracts", () => {
  it("accepts a classified run request", () => {
    expect(
      runRequestSchema.parse({
        contractVersion: "v1",
        projectId: "demo-project",
        userId: "demo-user",
        sessionId: "demo-session",
        inputClassification: "public",
        retainConfidentialArtifacts: false,
      }).projectId,
    ).toBe("demo-project");
  });

  it("rejects an error without run_id", () => {
    expect(() => typedErrorSchema.parse({ code: "policy_denied" })).toThrow();
  });

  it("deeply freezes typed errors and caller-provided nested details", () => {
    const nested = { entries: [{ value: "safe" }] };
    const error = createTypedError({
      code: "validation_error",
      summary: "Safe error.",
      suggestedAction: "Use valid input.",
      affectedInputReferences: ["safe-reference"],
      details: { nested },
    }) as Error & { readonly nested: { readonly entries: readonly { readonly value: string }[] } };

    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(error.affectedInputReferences)).toBe(true);
    expect(Object.isFrozen(error.nested)).toBe(true);
    expect(Object.isFrozen(error.nested.entries)).toBe(true);
    expect(Object.isFrozen(error.nested.entries[0]!)).toBe(true);
    expect(() => { (error.affectedInputReferences as string[]).push("changed"); }).toThrow();
    expect(() => { (error.nested.entries[0] as { value: string }).value = "changed"; }).toThrow();
  });

  it("allows only the supported data classifications", () => {
    expect(dataClassificationSchema.parse("confidential")).toBe("confidential");
    expect(() => dataClassificationSchema.parse("restricted")).toThrow();
  });

  it("allows only the supported error codes", () => {
    expect(errorCodeSchema.parse("transient_error")).toBe("transient_error");
    expect(errorCodeSchema.parse("evidence_mismatch")).toBe("evidence_mismatch");
    expect(errorCodeSchema.parse("prerequisite_not_ready")).toBe("prerequisite_not_ready");
    expect(errorCodeSchema.parse("calculation_not_possible")).toBe("calculation_not_possible");
    expect(() => errorCodeSchema.parse("unknown_error")).toThrow();
  });

  it("accepts a skill result with evidence and structured output", () => {
    expect(
      skillResultSchema.parse({
        contractVersion: "v1",
        skillId: "smoke",
        outputClassification: "internal",
        evidenceReferences: ["fixture://public/smoke"],
        output: { passed: true },
      }).output,
    ).toEqual({ passed: true });
  });

  it("exposes runRequestSchema through the Node ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        "import { runRequestSchema } from '@ai-assist/contracts'; console.log(runRequestSchema ? 'loaded' : 'missing');",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("loaded");
  });
});

describe("internal tolerance guidance contracts", () => {
  it("accepts a unilateral request with exactly representable values", () => {
    expect(
      internalToleranceGuidanceRequestSchema.safeParse({
        processFamily: "cnc-machining",
        featureType: "diameter",
        nominalValue: 10,
        nominalUnit: "mm",
        tolerance: {
          representation: "unilateral",
          upperValue: 0.25,
          lowerValue: 0.125,
          value: 0.125,
          unit: "mm",
        },
      }).success,
    ).toBe(true);
  });
});

describe("F4 calculation contracts", () => {
  const contentHash = "a".repeat(64);
  const baseWorksheetAnalysisAssets = {
    contractVersion: "v1" as const,
    workbook: {
      classification: "confidential" as const,
      contentHash,
      catalogContractVersion: "v1" as const,
    },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Anonymous analysis",
      factorTables: [{
        tableId: "table-a",
        headerRow: 1,
        dataRange: { startRow: 2, endRow: 2 },
        columns: [{ semanticField: "factorName" as const, headerText: "Factor", sourceColumn: "A" }],
        rows: [{
          sourceRow: 2,
          factorOrdinal: { value: "", rawText: "" },
          fields: {
            factorName: { status: "available" as const, rawText: "Feature-A", sourceCell: "Analysis-A!A2" },
          },
        }],
      }],
      formulaCells: [],
      imageAssets: [],
    }],
  };

  const baseRequiredFieldCheck = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    workbookContentHash: contentHash,
    status: "readyForNextCheck" as const,
    blockingIssues: [],
    advisoryIssues: [],
    summary: {
      worksheetsChecked: 1,
      factorTablesChecked: 1,
      factorRowsChecked: 1,
      blockingIssueCount: 0,
      advisoryIssueCount: 0,
    },
  };

  const baseExceptionResolution = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    workbookContentHash: contentHash,
    knowledgeBaseVersion: "v1" as const,
    status: "readyToContinue" as const,
    readyToContinue: true as const,
    acceptedExceptions: [],
    pendingExceptions: [],
    summary: {
      actionableSignalCount: 0,
      acceptedExceptionCount: 0,
      pendingExceptionCount: 0,
      invalidCandidateCount: 0,
    },
  };

  const request = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetAnalysisAssets: baseWorksheetAnalysisAssets,
    requiredFieldCheck: baseRequiredFieldCheck,
    exceptionResolution: baseExceptionResolution,
    worksheetSelection: {
      worksheetName: "Analysis-A",
      tableId: "table-a",
    },
    systemSpecification: {
      designNominal: 12.5,
      lowerSpecLimit: 12.1,
      upperSpecLimit: 12.9,
      targetSigmaLevel: 4,
      targetCpk: 1.33,
      additionalMeanShift: 0,
    },
    criticality: "none" as const,
    scenarioOverrides: [{
      scenarioId: "scenario-1",
      factorOverrides: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 2,
        nominalValue: 12.45,
      }],
      systemSpecification: {
        additionalMeanShift: 0.02,
      },
    }],
  };

  const legacyUnavailableRequest = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
  };

  const completedResult = {
    contractVersion: "v1" as const,
    outputClassification: "confidential" as const,
    featureId: "F4" as const,
    status: "completed" as const,
    calculationVersion: "excel-ta-v1" as const,
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    workbookContentHash: contentHash,
    worksheetSelection: {
      worksheetName: "Analysis-A",
      tableId: "table-a",
    },
    factorCount: 1,
    recommendation: {
      method: "worst_case" as const,
      reason: "factor_count_1_to_3",
      refer3d: false,
      criticality: "none" as const,
      criticalityRisk: false,
    },
    factors: [{
      factorName: "Feature-A",
      unit: "mm",
      source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
      input: {
        nominalValue: 12.45,
        upperTolerance: 0.2,
        lowerTolerance: -0.2,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "normal" as const,
      },
      mean: 12.46,
      halfTolerance: 0.2,
      sigma: 0.05,
      contribution: 1,
      trace: {
        formulaIds: ["factor-mean-v1", "factor-sigma-v1"],
        sourceCells: ["Analysis-A!A2", "Analysis-A!B2"],
      },
    }],
    system: {
      designNominal: 12.5,
      mean: 12.46,
      additionalMeanShift: 0,
      worstCaseUpper: 0.2,
      worstCaseLower: -0.2,
      rssSigma: 0.05,
    },
    capability: {
      lowerSpecLimit: 12.1,
      upperSpecLimit: 12.9,
      targetSigmaLevel: 4,
      targetCpk: 1.33,
      cp: 2.6666666666666665,
      lowerCpk: 2.4,
      upperCpk: 2.933333333333333,
      cpk: 2.4,
      lowerZ: 7.2,
      upperZ: 8.8,
      lowerDpm: 0.1,
      upperDpm: 0.2,
      totalDpm: 0.30000000000000004,
      outOfSpecRatio: 3.0000000000000004e-7,
      yield: 0.9999997,
      status: "PASS" as const,
    },
    traceRecords: [{
      outputField: "capability.cpk",
      formulaVersion: "excel-ta-v1" as const,
      formulaId: "cpk-v1" as const,
      sourceCells: ["capability.lowerCpk", "capability.upperCpk"],
    }],
    scenarios: [{
      scenarioId: "scenario-1",
      baselineRunReference: "controlled-run-reference",
      calculation: {
        factorCount: 1,
        recommendation: {
          method: "worst_case" as const,
          reason: "factor_count_1_to_3",
          refer3d: false,
          criticality: "none" as const,
          criticalityRisk: false,
        },
        factors: [{
          factorName: "Feature-A",
          unit: "mm",
          source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
          input: {
            nominalValue: 12.45,
            upperTolerance: 0.2,
            lowerTolerance: -0.2,
            longTermSafetyFactor: 1,
            sigmaLevel: 4,
            distribution: "normal" as const,
          },
          mean: 12.48,
          halfTolerance: 0.2,
          sigma: 0.05,
          contribution: 1,
          trace: {
            formulaIds: ["factor-mean-v1", "factor-sigma-v1"],
            sourceCells: ["Analysis-A!A2", "Analysis-A!B2"],
          },
        }],
        system: {
          designNominal: 12.5,
          mean: 12.48,
          additionalMeanShift: 0.02,
          worstCaseUpper: 0.22,
          worstCaseLower: -0.2,
          rssSigma: 0.05,
        },
        capability: {
          lowerSpecLimit: 12.1,
          upperSpecLimit: 12.9,
          targetSigmaLevel: 4,
          targetCpk: 1.33,
          cp: 2.6666666666666665,
          lowerCpk: 2.3,
          upperCpk: 2.8,
          cpk: 2.3,
          lowerZ: 6.9,
          upperZ: 8.4,
          lowerDpm: 0.2,
          upperDpm: 0.2,
          totalDpm: 0.4,
          outOfSpecRatio: 4e-7,
          yield: 0.9999996,
          status: "PASS" as const,
        },
        traceRecords: [{
          outputField: "capability.cpk",
          formulaVersion: "excel-ta-v1" as const,
          formulaId: "cpk-v1" as const,
          sourceCells: ["capability.lowerCpk", "capability.upperCpk"],
        }],
      },
      deltas: {
        mean: 0.02,
        rssSigma: 0,
        worstCaseUpper: 0.02,
        worstCaseLower: 0,
        cpk: -0.1,
        totalDpm: 0.09999999999999998,
        yield: -1.0000000000287557e-7,
      },
      overrides: {
        factors: [{
          source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
          fields: ["nominalValue"],
        }],
        systemSpecification: {
          additionalMeanShift: 0.02,
        },
      },
    }],
  };

  const legacyUnavailableResult = {
    contractVersion: "v1" as const,
    outputClassification: "confidential" as const,
    featureId: "F4" as const,
    status: "feature_not_available" as const,
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
    requiredPrerequisites: ["approved-template-regression", "approved-windows-excel-worker"] as const,
  };

  it("accepts a valid completed request and a completed result", () => {
    expect(calculationRequestSchema.parse(request)).toEqual(request);
    expect(calculationResultSchema.parse(completedResult)).toEqual(completedResult);
  });

  it("accepts legacy unavailable requests only via dedicated schema", () => {
    expect(calculationUnavailableRequestSchema.parse(legacyUnavailableRequest)).toEqual(legacyUnavailableRequest);
    expect(calculationRequestSchema.safeParse(legacyUnavailableRequest).success).toBe(false);
  });

  it("rejects workbook hash mismatch across evidence", () => {
    expect(calculationRequestSchema.safeParse({
      ...request,
      requiredFieldCheck: {
        ...request.requiredFieldCheck,
        workbookContentHash: "b".repeat(64),
      },
    }).success).toBe(false);
  });

  it("rejects F2.3 workbook hash mismatch", () => {
    expect(calculationRequestSchema.safeParse({
      ...request,
      exceptionResolution: {
        ...request.exceptionResolution,
        workbookContentHash: "b".repeat(64),
      },
    }).success).toBe(false);
  });

  it("rejects blocked F2.1 and pending F2.3 statuses", () => {
    expect(calculationRequestSchema.safeParse({
      ...request,
      requiredFieldCheck: {
        ...request.requiredFieldCheck,
        status: "blocked",
        blockingIssues: [{
          issueCode: "factor_table_has_no_rows",
          worksheetName: "Analysis-A",
          tableId: "table-a",
        }],
        summary: {
          ...request.requiredFieldCheck.summary,
          blockingIssueCount: 1,
        },
      },
    }).success).toBe(false);

    expect(calculationRequestSchema.safeParse({
      ...request,
      exceptionResolution: {
        ...request.exceptionResolution,
        status: "pendingExceptions",
        readyToContinue: false,
        pendingExceptions: [{
          signalRef: "signal-1",
          reasonCode: "missing_candidate",
          snapshot: {
            signalKind: "distribution_mismatch",
            worksheetName: "Analysis-A",
            tableId: "table-a",
            sourceRow: 2,
            factorName: "Feature-A",
            signal: {
              status: "distribution_mismatch",
              actual: "normal",
              recommended: "uniform",
            },
          },
        }],
        summary: {
          actionableSignalCount: 1,
          acceptedExceptionCount: 0,
          pendingExceptionCount: 1,
          invalidCandidateCount: 0,
        },
      },
    }).success).toBe(false);
  });

  it("rejects upper spec less than or equal to lower spec", () => {
    expect(calculationRequestSchema.safeParse({
      ...request,
      systemSpecification: {
        ...request.systemSpecification,
        lowerSpecLimit: 12.5,
        upperSpecLimit: 12.5,
      },
    }).success).toBe(false);
  });

  it("rejects unknown fields and public classification", () => {
    expect(calculationRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(calculationRequestSchema.safeParse({ ...request, unexpectedField: true }).success).toBe(false);
  });

  it("rejects duplicate scenario ids and duplicate factor override keys", () => {
    expect(calculationRequestSchema.safeParse({
      ...request,
      scenarioOverrides: [
        request.scenarioOverrides[0],
        {
          ...request.scenarioOverrides[0],
          factorOverrides: [{
            worksheetName: "Analysis-A",
            tableId: "table-a",
            sourceRow: 2,
            upperTolerance: 0.3,
          }],
        },
      ],
    }).success).toBe(false);

    expect(calculationRequestSchema.safeParse({
      ...request,
      scenarioOverrides: [{
        ...request.scenarioOverrides[0],
        factorOverrides: [
          request.scenarioOverrides[0].factorOverrides[0],
          {
            worksheetName: "Analysis-A",
            tableId: "table-a",
            sourceRow: 2,
            lowerTolerance: -0.3,
          },
        ],
      }],
    }).success).toBe(false);

    expect(calculationRequestSchema.safeParse({
      ...request,
      scenarioOverrides: [{
        ...request.scenarioOverrides[0],
        factorOverrides: [
          {
            worksheetName: "Sheet::A",
            tableId: "Table",
            sourceRow: 2,
            nominalValue: 12.45,
          },
          {
            worksheetName: "Sheet",
            tableId: "A::Table",
            sourceRow: 2,
            upperTolerance: 0.3,
          },
        ],
      }],
    }).success).toBe(true);
  });

  it("rejects no-op scenarios and no-op scenario system specifications", () => {
    expect(calculationRequestSchema.safeParse({
      ...request,
      scenarioOverrides: [{
        scenarioId: "scenario-empty",
        factorOverrides: [],
      }],
    }).success).toBe(false);

    expect(calculationRequestSchema.safeParse({
      ...request,
      scenarioOverrides: [{
        scenarioId: "scenario-empty-system-spec",
        factorOverrides: [],
        systemSpecification: {},
      }],
    }).success).toBe(false);

    expect(calculationRequestSchema.safeParse({
      ...request,
      scenarioOverrides: [{
        scenarioId: "scenario-system-spec-only",
        factorOverrides: [],
        systemSpecification: {
          additionalMeanShift: 0.01,
        },
      }],
    }).success).toBe(true);
  });

  it("rejects non-positive request and override sigma/cpk/safety values", () => {
    expect(calculationRequestSchema.safeParse({
      ...request,
      systemSpecification: {
        ...request.systemSpecification,
        targetSigmaLevel: 0,
      },
    }).success).toBe(false);
    expect(calculationRequestSchema.safeParse({
      ...request,
      systemSpecification: {
        ...request.systemSpecification,
        targetCpk: -1,
      },
    }).success).toBe(false);
    expect(calculationRequestSchema.safeParse({
      ...request,
      scenarioOverrides: [{
        ...request.scenarioOverrides[0],
        factorOverrides: [{
          ...request.scenarioOverrides[0].factorOverrides[0],
          longTermSafetyFactor: 0,
        }],
      }],
    }).success).toBe(false);
    expect(calculationRequestSchema.safeParse({
      ...request,
      scenarioOverrides: [{
        ...request.scenarioOverrides[0],
        factorOverrides: [{
          ...request.scenarioOverrides[0].factorOverrides[0],
          sigmaLevel: -3,
        }],
      }],
    }).success).toBe(false);
  });

  it("rejects more than 100 scenarios", () => {
    const scenarioOverrides = Array.from({ length: 101 }, (_, index) => ({
      scenarioId: `scenario-${index + 1}`,
      factorOverrides: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 2,
        nominalValue: 12.45 + index * 0.001,
      }],
      systemSpecification: {
        additionalMeanShift: 0,
      },
    }));
    expect(calculationRequestSchema.safeParse({ ...request, scenarioOverrides }).success).toBe(false);
  });

  it("rejects merged scenario system specification when effective bounds are invalid", () => {
    expect(calculationRequestSchema.safeParse({
      ...request,
      scenarioOverrides: [{
        ...request.scenarioOverrides[0],
        systemSpecification: {
          lowerSpecLimit: 13,
        },
      }],
    }).success).toBe(false);
  });

  it("rejects non-positive completed factor input values", () => {
    expect(calculationResultSchema.safeParse({
      ...completedResult,
      factors: [{
        ...completedResult.factors[0],
        input: {
          ...completedResult.factors[0].input,
          longTermSafetyFactor: 0,
        },
      }],
    }).success).toBe(false);
    expect(calculationResultSchema.safeParse({
      ...completedResult,
      factors: [{
        ...completedResult.factors[0],
        input: {
          ...completedResult.factors[0].input,
          sigmaLevel: -2,
        },
      }],
    }).success).toBe(false);
  });

  it("requires factorName and unit in completed factor outputs", () => {
    expect(calculationResultSchema.safeParse({
      ...completedResult,
      factors: [{
        ...completedResult.factors[0],
        factorName: "",
      }],
    }).success).toBe(false);
    expect(calculationResultSchema.safeParse({
      ...completedResult,
      factors: [{
        ...completedResult.factors[0],
        unit: "",
      }],
    }).success).toBe(false);
  });

  it("requires boolean criticalityRisk while preserving criticality enum", () => {
    expect(calculationResultSchema.safeParse({
      ...completedResult,
      recommendation: {
        ...completedResult.recommendation,
        criticalityRisk: "CTS",
      },
    }).success).toBe(false);

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      recommendation: {
        ...completedResult.recommendation,
        criticality: "none",
        criticalityRisk: true,
      },
    }).success).toBe(false);

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      recommendation: {
        ...completedResult.recommendation,
        criticality: "CTS",
        criticalityRisk: true,
      },
    }).success).toBe(true);

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      recommendation: {
        ...completedResult.recommendation,
        criticality: "none",
        criticalityRisk: false,
      },
    }).success).toBe(true);
  });

  it("enforces nearly-equal boundaries for completed derived invariants", () => {
    expect(calculationResultSchema.safeParse({
      ...completedResult,
      capability: {
        ...completedResult.capability,
        lowerCpk: 1_000_000_000_000,
        upperCpk: 1_000_000_000_001,
        cpk: 1_000_000_000_000 + 0.9,
      },
    }).success).toBe(true);

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      capability: {
        ...completedResult.capability,
        lowerCpk: 1_000_000_000_000,
        upperCpk: 1_000_000_000_001,
        cpk: 1_000_000_000_000 + 1.1,
      },
    }).success).toBe(false);

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      capability: {
        ...completedResult.capability,
        lowerCpk: 2e-13,
        upperCpk: 1,
        cpk: 7e-13,
      },
    }).success).toBe(true);

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      capability: {
        ...completedResult.capability,
        lowerCpk: 2e-13,
        upperCpk: 1,
        cpk: 2.3e-12,
      },
    }).success).toBe(false);
  });

  it("rejects completed payload arrays above bounds", () => {
    const factor = completedResult.factors[0];
    const factors = Array.from({ length: 101 }, (_, index) => ({
      ...factor,
      factorName: `Feature-${index + 1}`,
      source: {
        ...factor.source,
        sourceRow: index + 1,
      },
      trace: {
        ...factor.trace,
        sourceCells: [`Analysis-A!A${index + 1}`],
      },
    }));

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      factorCount: 101,
      recommendation: {
        ...completedResult.recommendation,
        method: "refer_3d_variation_analysis",
        reason: "factor_count_over_10",
        refer3d: true,
      },
      factors,
    }).success).toBe(false);

    const trace = completedResult.traceRecords[0];
    const traceRecords = Array.from({ length: 501 }, (_, index) => ({
      ...trace,
      outputField: `trace-${index + 1}`,
    }));
    expect(calculationResultSchema.safeParse({
      ...completedResult,
      traceRecords,
    }).success).toBe(false);

    const scenario = completedResult.scenarios[0];
    const scenarios = Array.from({ length: 101 }, (_, index) => ({
      ...scenario,
      scenarioId: `scenario-${index + 1}`,
    }));
    expect(calculationResultSchema.safeParse({
      ...completedResult,
      scenarios,
    }).success).toBe(false);
  });

  it("exports calculation method and criticality schemas and reusable types", () => {
    expect(calculationMethodSchema.parse("worst_case")).toBe("worst_case");
    expect(calculationCriticalitySchema.parse("CTS")).toBe("CTS");

    const method: CalculationMethod = calculationMethodSchema.parse("rss_1d");
    const criticality: CalculationCriticality = calculationCriticalitySchema.parse("CTF");
    const factor: CalculationFactorResult = completedResult.factors[0];
    const capability: CalculationCapabilityResult = completedResult.capability;
    const payload: CalculationCompletedPayload = {
      factorCount: completedResult.factorCount,
      recommendation: completedResult.recommendation,
      factors: completedResult.factors,
      system: completedResult.system,
      capability: completedResult.capability,
      traceRecords: completedResult.traceRecords,
    };

    expect(method).toBe("rss_1d");
    expect(criticality).toBe("CTF");
    expect(factor.factorName).toBe("Feature-A");
    expect(capability.status).toBe("PASS");
    expect(payload.factorCount).toBe(1);
  });

  it("enforces formulaVersion and formulaId enums in trace records", () => {
    expect(calculationResultSchema.safeParse({
      ...completedResult,
      traceRecords: [{
        ...completedResult.traceRecords[0],
        formulaVersion: "excel-ta-v2",
      }],
    }).success).toBe(false);

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      traceRecords: [{
        ...completedResult.traceRecords[0],
        formulaId: "cpk-min-v1",
      }],
    }).success).toBe(false);
  });

  it("accepts complete scenario payload with override details", () => {
    expect(calculationResultSchema.safeParse(completedResult).success).toBe(true);
  });

  it("rejects completed scenario no-op overrides", () => {
    expect(calculationResultSchema.safeParse({
      ...completedResult,
      scenarios: [{
        ...completedResult.scenarios[0],
        overrides: {
          factors: [],
        },
      }],
    }).success).toBe(false);
  });

  it("rejects completed derived invariant violations", () => {
    expect(calculationResultSchema.safeParse({
      ...completedResult,
      factorCount: 2,
    }).success).toBe(false);

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      recommendation: {
        ...completedResult.recommendation,
        method: "rss_1d",
      },
    }).success).toBe(false);

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      capability: {
        ...completedResult.capability,
        cpk: 1.5,
      },
    }).success).toBe(false);

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      capability: {
        ...completedResult.capability,
        totalDpm: completedResult.capability.totalDpm + 1,
      },
    }).success).toBe(false);

    expect(calculationResultSchema.safeParse({
      ...completedResult,
      capability: {
        ...completedResult.capability,
        yield: 0.5,
      },
    }).success).toBe(false);
  });

  it("accepts legacy unavailable results for backward compatibility", () => {
    expect(calculationResultSchema.parse(legacyUnavailableResult)).toEqual(legacyUnavailableResult);
  });
});

describe("F4 excel comparison contracts", () => {
  const metric = {
    metric: "cpk",
    f4Value: 1.33,
    excelValue: 1.33,
    excelDisplayText: "1.33",
    absoluteDifference: 0,
    relativeDifference: 0,
    tolerance: 1e-12,
    passed: true,
    sourceCell: "Analysis-A!P10",
    excelFormula: "=P8/P9",
    f4FormulaId: "cpk-v1",
  };

  const passedResult = {
    contractVersion: "v1" as const,
    comparisonVersion: "f4-excel-comparison-v1" as const,
    outputClassification: "confidential" as const,
    featureId: "F4" as const,
    status: "passed" as const,
    runId: "run-f4-1",
    generatedAt: "2026-08-07T00:00:00.000Z",
    source: {
      workbookContentHash: "a".repeat(64),
    },
    worksheets: [{
      worksheetName: "Analysis-A",
      metrics: [metric],
    }],
    summary: {
      worksheetCount: 1,
      metricCount: 1,
      passedMetricCount: 1,
      mismatchMetricCount: 0,
    },
  };

  it("rejects duplicate worksheet names in passed comparison payloads", () => {
    const duplicateWorksheetPayload = {
      ...passedResult,
      worksheets: [
        passedResult.worksheets[0],
        {
          worksheetName: "Analysis-A",
          metrics: [{ ...metric, metric: "cp", sourceCell: "Analysis-A!P11" }],
        },
      ],
      summary: {
        worksheetCount: 2,
        metricCount: 2,
        passedMetricCount: 2,
        mismatchMetricCount: 0,
      },
    };

    expect(f4ExcelComparisonResultSchema.safeParse(duplicateWorksheetPayload).success).toBe(false);
  });

  it("rejects duplicate metric identity per worksheet in mismatch comparison payloads", () => {
    const duplicateMetricIdentityPayload = {
      ...passedResult,
      status: "mismatch" as const,
      worksheets: [{
        worksheetName: "Analysis-A",
        metrics: [
          { ...metric, passed: false, absoluteDifference: 0.01, relativeDifference: 0.01 },
          { ...metric, excelValue: 1.31, excelDisplayText: "1.31", passed: false, absoluteDifference: 0.02, relativeDifference: 0.02 },
        ],
      }],
      summary: {
        worksheetCount: 1,
        metricCount: 2,
        passedMetricCount: 0,
        mismatchMetricCount: 2,
      },
    };

    expect(f4ExcelComparisonResultSchema.safeParse(duplicateMetricIdentityPayload).success).toBe(false);
  });
});

describe("F3 drawing governance placeholder contracts", () => {
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
  };

  const result = {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F3",
    status: "feature_not_available",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
    requiredPrerequisites: ["approved-ado-access", "canonical-dim-id-policy"],
  };

  it("accepts only confidential controlled references and a fixed unavailable result", () => {
    expect(drawingGovernanceRequestSchema.parse(request)).toEqual(request);
    expect(drawingGovernanceResultSchema.parse(result)).toEqual(result);
  });

  it("rejects public classification, unknown fields, and altered prerequisites", () => {
    expect(drawingGovernanceRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(drawingGovernanceRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(drawingGovernanceResultSchema.safeParse({
      ...result,
      requiredPrerequisites: ["canonical-dim-id-policy", "approved-ado-access"],
    }).success).toBe(false);
  });
});

describe("F3 drawing governance v2 contracts", () => {
  const contentHash = "d".repeat(64);
  const factorInstanceId = "e".repeat(64);
  const drawingDimensionKey = "f".repeat(64);
  const actualFields = {
    factorName: "Anonymous bracket offset",
    partName: "Anonymous bracket",
    drawingNumber: "DRAW-100",
    dimCharacteristicId: "307",
    partCategory: "CNC",
    nominalValue: 3.145,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
    mean: 3.145,
    tolerance: 0.1,
    oneSigma: 0.025,
    percentContributionToSigma: 1,
    notes: null,
  };
  const sourceCells = {
    factorName: "Analysis-A!E14",
    partName: "Analysis-A!F14",
    drawingNumber: "Analysis-A!G14",
    dimCharacteristicId: "Analysis-A!H14",
    partCategory: "Analysis-A!I14",
    nominalValue: "Analysis-A!J14",
    upperTolerance: "Analysis-A!K14",
    lowerTolerance: "Analysis-A!L14",
    standardDeviation: "Analysis-A!N14",
  };
  const imageReference = {
    artifact: "f1",
    relativePath: "worksheets/Analysis-A/tolerance-path.png",
    contentHash: "a".repeat(64),
    worksheetName: "Analysis-A",
  };
  const enhancedRow = {
    worksheetName: "Analysis-A",
    tableId: "factor-table-1",
    sourceRow: 14,
    factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!D14" },
    actualFields,
    sourceCells,
    imageReference,
    missingRequiredFields: [],
    missingIdentifiers: [],
    capabilityStatus: "non_f0_process_category",
    adoReminderRequested: false,
  };
  const request = {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    inputClassification: "confidential",
    artifactRoot: "controlled/f1",
    workbook: { fileName: "Anonymous.xlsx", contentHash },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Anonymous device gap",
      f2Status: "ready",
      rows: [enhancedRow],
    }],
  };
  const governanceRow = {
    factorInstanceId,
    factorOrdinal: enhancedRow.factorOrdinal,
    drawingDimensionKey,
    deviceLevelDim: "Analysis-A",
    dimensionDescription: "Anonymous device gap",
    partCategory: "CNC",
    partSubsystem: "Anonymous bracket",
    drawingNumber: "DRAW-100",
    dimId: "307",
    factorDescription: "Anonymous bracket offset",
    nominal: 3.145,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    sigmaLevel: 4,
    dimIdStatus: "valid",
    qualitySignals: [],
    governanceStatus: "complete",
    imageReference,
    source: {
      worksheetName: "Analysis-A",
      tableId: "factor-table-1",
      sourceRow: 14,
      sourceCells,
    },
  };
  const result = {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "completed",
    artifactRoot: "controlled/f1",
    workbook: { fileName: "Anonymous.xlsx", contentHash },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Anonymous device gap",
      rows: [governanceRow],
    }],
    ado: { status: "not_requested" },
    summary: {
      worksheetCount: 1,
      factorCount: 1,
      completeCount: 1,
      governanceRequiredCount: 0,
      duplicateConflictCount: 0,
    },
  };

  function schemas() {
    const requestSchema = Reflect.get(contractExports, "drawingGovernanceRequestV2Schema") as { parse(value: unknown): unknown; safeParse(value: unknown): { success: boolean } } | undefined;
    const resultSchema = Reflect.get(contractExports, "drawingGovernanceResultV2Schema") as { parse(value: unknown): unknown; safeParse(value: unknown): { success: boolean } } | undefined;
    expect(requestSchema).toBeDefined();
    expect(resultSchema).toBeDefined();
    return { requestSchema: requestSchema!, resultSchema: resultSchema! };
  }

  it("parses strict confidential F3 v2 request and result contracts", () => {
    const { requestSchema, resultSchema } = schemas();
    expect(requestSchema.parse(request)).toEqual(request);
    expect(resultSchema.parse(result)).toEqual(result);
    expect(requestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(requestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
  });

  it("accepts a structured input rejection result", () => {
    const { resultSchema } = schemas();
    expect(resultSchema.safeParse({
      contractVersion: "v1",
      modelVersion: "drawing-governance-v2",
      outputClassification: "confidential",
      featureId: "F3",
      status: "input_rejected",
      artifactIssues: [{ reasonCode: "description_missing", artifactReference: "worksheet:Analysis-A" }],
    }).success).toBe(true);
  });

  it("rejects formal keys for unresolved identifiers and inconsistent summaries", () => {
    const { resultSchema } = schemas();
    expect(resultSchema.safeParse({
      ...result,
      worksheets: [{
        ...result.worksheets[0],
        rows: [{ ...governanceRow, dimIdStatus: "suspected_invalid" }],
      }],
    }).success).toBe(false);
    expect(resultSchema.safeParse({
      ...result,
      worksheets: [{
        ...result.worksheets[0],
        rows: [{ ...governanceRow, drawingNumber: null }],
      }],
    }).success).toBe(false);
    expect(resultSchema.safeParse({
      ...result,
      summary: { ...result.summary, factorCount: 2 },
    }).success).toBe(false);
    expect(resultSchema.safeParse({ ...result, status: "governance_required" }).success).toBe(false);
  });

  it("requires F1 image provenance that matches the containing worksheet", () => {
    const { requestSchema, resultSchema } = schemas();
    const { imageReference: _requestImage, ...requestRowWithoutImage } = enhancedRow;
    const { imageReference: _resultImage, ...resultRowWithoutImage } = governanceRow;
    void _requestImage;
    void _resultImage;

    expect(requestSchema.safeParse({
      ...request,
      worksheets: [{ ...request.worksheets[0], rows: [requestRowWithoutImage] }],
    }).success).toBe(false);
    expect(resultSchema.safeParse({
      ...result,
      worksheets: [{ ...result.worksheets[0], rows: [resultRowWithoutImage] }],
    }).success).toBe(false);
    expect(resultSchema.safeParse({
      ...result,
      worksheets: [{
        ...result.worksheets[0],
        rows: [{ ...governanceRow, imageReference: { ...imageReference, artifact: "f2" } }],
      }],
    }).success).toBe(false);
    expect(resultSchema.safeParse({
      ...result,
      worksheets: [{
        ...result.worksheets[0],
        rows: [{ ...governanceRow, imageReference: { ...imageReference, worksheetName: "Analysis-B" } }],
      }],
    }).success).toBe(false);
  });

  it("requires request row worksheet identity to match its container", () => {
    const { requestSchema } = schemas();

    expect(requestSchema.safeParse({
      ...request,
      worksheets: [{
        ...request.worksheets[0],
        rows: [{
          ...enhancedRow,
          worksheetName: "Analysis-B",
          imageReference,
        }],
      }],
    }).success).toBe(false);
  });
});

describe("F5.1 objective interpretation contracts", () => {
  const contentHash = "c".repeat(64);
  const ruleEvidence = (sourceAlias: string, sheetName: string, sourceRange: string) => ({
    classification: "internal" as const,
    sourceAlias,
    sourceVersion: "2026-Q3",
    sheetName,
    sourceRange,
    sourceFileHash: contentHash,
    owner: "knowledge-steward",
    confidence: 0.9,
    effectiveVersion: "interpretation-rules-v1" as const,
    changeSummary: "Initial reviewed interpretation rules.",
  });

  const calculationCompletedResult = {
    contractVersion: "v1" as const,
    outputClassification: "confidential" as const,
    featureId: "F4" as const,
    status: "completed" as const,
    calculationVersion: "excel-ta-v1" as const,
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference-1",
    workbookContentHash: contentHash,
    worksheetSelection: {
      worksheetName: "Analysis-A",
      tableId: "table-a",
    },
    factorCount: 1,
    recommendation: {
      method: "worst_case" as const,
      reason: "factor_count_1_to_3" as const,
      refer3d: false,
      criticality: "none" as const,
      criticalityRisk: false,
    },
    factors: [{
      factorName: "Feature-A",
      unit: "mm",
      source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
      input: {
        nominalValue: 12.45,
        upperTolerance: 0.2,
        lowerTolerance: -0.2,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "normal" as const,
      },
      mean: 12.46,
      halfTolerance: 0.2,
      sigma: 0.05,
      contribution: 1,
      trace: {
        formulaIds: ["factor-mean-v1", "factor-sigma-v1"],
        sourceCells: ["Analysis-A!A2", "Analysis-A!B2"],
      },
    }],
    system: {
      designNominal: 12.5,
      mean: 12.46,
      additionalMeanShift: 0,
      worstCaseUpper: 0.2,
      worstCaseLower: -0.2,
      rssSigma: 0.05,
    },
    capability: {
      lowerSpecLimit: 12.1,
      upperSpecLimit: 12.9,
      targetSigmaLevel: 4,
      targetCpk: 1.33,
      cp: 2.6666666666666665,
      lowerCpk: 2.4,
      upperCpk: 2.933333333333333,
      cpk: 2.4,
      lowerZ: 7.2,
      upperZ: 8.8,
      lowerDpm: 0.1,
      upperDpm: 0.2,
      totalDpm: 0.30000000000000004,
      outOfSpecRatio: 3.0000000000000004e-7,
      yield: 0.9999997,
      status: "PASS" as const,
    },
    traceRecords: [{
      outputField: "capability.cpk",
      formulaVersion: "excel-ta-v1" as const,
      formulaId: "cpk-v1" as const,
      sourceCells: ["capability.lowerCpk", "capability.upperCpk"],
    }],
    scenarios: [],
  };

  const request = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    calculationResult: calculationCompletedResult,
  };

  const completedResult = {
    contractVersion: "v1" as const,
    outputClassification: "confidential" as const,
    featureId: "F5.1" as const,
    status: "completed" as const,
    interpretationVersion: "objective-interpretation-v1" as const,
    projectReference: calculationCompletedResult.projectReference,
    runReference: calculationCompletedResult.runReference,
    workbookContentHash: calculationCompletedResult.workbookContentHash,
    worksheetSelection: calculationCompletedResult.worksheetSelection,
    calculationVersion: calculationCompletedResult.calculationVersion,
    knowledgeBaseVersion: "interpretation-rules-v1" as const,
    ruleEvaluationStatus: "matched" as const,
    statements: [
      {
        statementId: "fact-cpk",
        type: "FACT" as const,
        section: "capability-vs-specification" as const,
        content: {
          metric: "cpk" as const,
          value: 2.4,
          unit: "ratio",
          provenanceKind: "formula_output" as const,
          outputField: "capability.cpk",
          traceRecords: [{
            outputField: "capability.cpk",
            formulaVersion: "excel-ta-v1" as const,
            formulaId: "cpk-v1" as const,
            sourceCells: ["capability.lowerCpk", "capability.upperCpk"],
          }],
        },
      },
      {
        statementId: "fact-cp",
        type: "FACT" as const,
        section: "calculation-summary" as const,
        content: {
          metric: "cp" as const,
          value: 2.6666666666666665,
          unit: "ratio",
          provenanceKind: "formula_output" as const,
          outputField: "capability.cp",
          traceRecords: [{
            outputField: "capability.cp",
            formulaVersion: "excel-ta-v1" as const,
            formulaId: "cp-v1" as const,
            sourceCells: ["capability.upperSpecLimit", "capability.lowerSpecLimit", "system.rssSigma"],
          }],
        },
      },
      {
        statementId: "fact-rss-sigma",
        type: "FACT" as const,
        section: "calculation-summary" as const,
        content: {
          metric: "rss_sigma" as const,
          value: 0.05,
          unit: "mm",
          provenanceKind: "formula_output" as const,
          outputField: "system.rssSigma",
          traceRecords: [{
            outputField: "system.rssSigma",
            formulaVersion: "excel-ta-v1" as const,
            formulaId: "rss-v1" as const,
            sourceCells: ["factors[0].sigma"],
          }],
        },
      },
      {
        statementId: "fact-total-dpm",
        type: "FACT" as const,
        section: "calculation-summary" as const,
        content: {
          metric: "total_dpm" as const,
          value: 0.30000000000000004,
          unit: "dpm",
          provenanceKind: "formula_output" as const,
          outputField: "capability.totalDpm",
          traceRecords: [{
            outputField: "capability.totalDpm",
            formulaVersion: "excel-ta-v1" as const,
            formulaId: "dpm-total-v1" as const,
            sourceCells: ["capability.lowerDpm", "capability.upperDpm"],
          }],
        },
      },
      {
        statementId: "fact-yield",
        type: "FACT" as const,
        section: "calculation-summary" as const,
        content: {
          metric: "yield" as const,
          value: 0.9999997,
          unit: "ratio",
          provenanceKind: "formula_output" as const,
          outputField: "capability.yield",
          traceRecords: [{
            outputField: "capability.yield",
            formulaVersion: "excel-ta-v1" as const,
            formulaId: "yield-v1" as const,
            sourceCells: ["capability.outOfSpecRatio"],
          }],
        },
      },
      {
        statementId: "fact-lsl",
        type: "FACT" as const,
        section: "capability-vs-specification" as const,
        content: {
          metric: "lower_spec_limit" as const,
          value: 12.1,
          unit: "mm",
          provenanceKind: "calculation_input" as const,
          inputField: "capability.lowerSpecLimit" as const,
        },
      },
      {
        statementId: "fact-usl",
        type: "FACT" as const,
        section: "capability-vs-specification" as const,
        content: {
          metric: "upper_spec_limit" as const,
          value: 12.9,
          unit: "mm",
          provenanceKind: "calculation_input" as const,
          inputField: "capability.upperSpecLimit" as const,
        },
      },
      {
        statementId: "fact-recommended-method",
        type: "FACT" as const,
        section: "calculation-summary" as const,
        content: {
          metric: "recommended_method" as const,
          method: "worst_case" as const,
          reason: "factor_count_1_to_3" as const,
          refer3d: false,
          criticality: "none" as const,
          criticalityRisk: false,
          provenanceKind: "calculation_input" as const,
          inputField: "recommendation.method" as const,
        },
      },
      {
        statementId: "fact-factor-contribution",
        type: "FACT" as const,
        section: "major-contributors" as const,
        content: {
          metric: "factor_contribution" as const,
          factorReference: "Analysis-A/table-a/2",
          contributionPercent: 100,
          unit: "%",
          provenanceKind: "formula_output" as const,
          outputField: "factors[0].contribution",
          traceRecords: [{
            outputField: "factors[0].contribution",
            formulaVersion: "excel-ta-v1" as const,
            formulaId: "contribution-v1" as const,
            sourceCells: ["factors[0].sigma", "system.rssSigma"],
          }],
        },
      },
      {
        statementId: "fact-target-cpk",
        type: "FACT" as const,
        section: "capability-vs-specification" as const,
        content: {
          metric: "target_cpk" as const,
          value: 1.33,
          unit: "ratio",
          provenanceKind: "calculation_input" as const,
          inputField: "capability.targetCpk" as const,
        },
      },
      {
        statementId: "fact-target-sigma",
        type: "FACT" as const,
        section: "calculation-summary" as const,
        content: {
          metric: "target_sigma" as const,
          value: 4,
          unit: "sigma",
          provenanceKind: "calculation_input" as const,
          inputField: "capability.targetSigmaLevel" as const,
        },
      },
      {
        statementId: "fact-achieved-sigma",
        type: "FACT" as const,
        section: "calculation-summary" as const,
        content: {
          metric: "achieved_sigma" as const,
          value: 7.2,
          unit: "sigma",
          provenanceKind: "derived_from_formula_outputs" as const,
          sourceOutputFields: ["capability.lowerZ", "capability.upperZ"] as const,
          traceRecords: [{
            outputField: "capability.lowerZ",
            formulaVersion: "excel-ta-v1" as const,
            formulaId: "z-lower-v1" as const,
            sourceCells: ["system.mean", "capability.lowerSpecLimit", "system.rssSigma"],
          }, {
            outputField: "capability.upperZ",
            formulaVersion: "excel-ta-v1" as const,
            formulaId: "z-upper-v1" as const,
            sourceCells: ["capability.upperSpecLimit", "system.mean", "system.rssSigma"],
          }],
        },
      },
      {
        statementId: "rule-performance",
        type: "RULE" as const,
        section: "capability-vs-specification" as const,
        content: {
          entryId: "rule-cpk-target",
          effectiveVersion: "interpretation-rules-v1" as const,
          applicability: { analysisDimension: "one-dimensional" as const, method: "rss" as const },
          relatedFactReferences: ["cpk", "targetCpk"],
          evidence: ruleEvidence("kb-performance", "Rules", "A2:B2"),
        },
      },
      {
        statementId: "signal-contribution",
        type: "SIGNAL" as const,
        section: "major-contributors" as const,
        content: {
          entryId: "signal-major-contribution",
          effectiveVersion: "interpretation-rules-v1" as const,
          applicability: { analysisDimension: "one-dimensional" as const, method: "rss" as const },
          relatedFactReferences: ["contributors"],
          evidence: ruleEvidence("kb-signal", "Rules", "C3:D3"),
          requiresEngineeringReview: true,
        },
      },
      {
        statementId: "option-follow-up",
        type: "OPTION" as const,
        section: "parallel-options" as const,
        content: {
          entryId: "option-tighten-process",
          effectiveVersion: "interpretation-rules-v1" as const,
          applicability: { analysisDimension: "one-dimensional" as const, method: "rss" as const },
          relatedFactReferences: ["cpk", "contributors"],
          evidence: ruleEvidence("kb-option", "Rules", "E4:F4"),
          rank: null,
        },
      },
    ],
    clarifications: [
      {
        clarificationId: "clarify-drawing-evidence",
        reasonCode: "drawing_evidence_not_evaluated",
        message: "Drawing chain evidence is outside F5.1 scope.",
        scopes: [
          "tolerance_loop_closure",
          "datum_chain",
          "assembly_datum_face",
          "stack_start",
          "direction",
          "cross_subsystem",
        ],
      },
    ],
  };

  const legacyUnavailableResult = {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F5",
    status: "feature_not_available",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
    requiredPrerequisites: ["approved-knowledge-base"],
  };

  it("accepts strict confidential request with completed F4 result and completed F5.1 result", () => {
    expect(interpretationRequestSchema.parse(request)).toEqual(request);
    expect(f5ObjectiveInterpretationCompletedResultSchema.parse(completedResult)).toEqual(completedResult);
    expect(interpretationResultSchema.parse(completedResult)).toEqual(completedResult);
  });

  it("keeps backward compatibility for legacy unavailable interpretation result", () => {
    expect(interpretationResultSchema.parse(legacyUnavailableResult)).toEqual(legacyUnavailableResult);
  });

  it("rejects public input, unknown fields, and legacy unavailable calculation input", () => {
    expect(interpretationRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(interpretationRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(interpretationRequestSchema.safeParse({
      ...request,
      calculationResult: {
        contractVersion: "v1",
        outputClassification: "confidential",
        featureId: "F4",
        status: "feature_not_available",
        projectReference: "controlled-project-reference",
        runReference: "controlled-run-reference",
        worksheetReferences: ["controlled-worksheet-reference"],
        requiredPrerequisites: ["approved-template-regression", "approved-windows-excel-worker"],
      },
    }).success).toBe(false);
  });

  it("rejects RULE without evidence, SIGNAL with invalid review flag, and OPTION with numeric rank", () => {
    const ruleWithoutEvidence = structuredClone(completedResult);
    const rule = ruleWithoutEvidence.statements.find((statement) => statement.type === "RULE")!;
    (rule as { content: Record<string, unknown> }).content = {
      entryId: "rule-cpk-target",
      relatedFactReferences: ["cpk", "targetCpk"],
    };
    expect(interpretationResultSchema.safeParse(ruleWithoutEvidence).success).toBe(false);

    const signalWithWrongFlag = structuredClone(completedResult);
    const signal = signalWithWrongFlag.statements.find((statement) => statement.type === "SIGNAL")!;
    (signal as { content: Record<string, unknown> }).content = {
      ...(signal as { content: Record<string, unknown> }).content,
      requiresEngineeringReview: false,
    };
    expect(interpretationResultSchema.safeParse(signalWithWrongFlag).success).toBe(false);

    const optionWithNumericRank = structuredClone(completedResult);
    const option = optionWithNumericRank.statements.find((statement) => statement.type === "OPTION")!;
    (option as { content: Record<string, unknown> }).content = {
      ...(option as { content: Record<string, unknown> }).content,
      rank: 1,
    };
    expect(interpretationResultSchema.safeParse(optionWithNumericRank).success).toBe(false);
  });

  it("rejects rule-derived statements when rule evaluation is not applicable or lacks facts", () => {
    for (const ruleEvaluationStatus of ["not-applicable", "insufficient-facts"] as const) {
      const result = structuredClone(completedResult);
      (result as { ruleEvaluationStatus: string }).ruleEvaluationStatus = ruleEvaluationStatus;
      result.statements = [result.statements.find((statement) => statement.type === "RULE")!];
      result.clarifications = [{
        clarificationId: `clarify-${ruleEvaluationStatus}`,
        reasonCode: ruleEvaluationStatus === "not-applicable"
          ? "rule_method_not_applicable"
          : "rule_facts_insufficient",
        message: "Rule evaluation did not produce derived statements.",
      }];

      expect(interpretationResultSchema.safeParse(result).success).toBe(false);
    }
  });

  it("requires the status-specific clarification when rule evaluation does not produce statements", () => {
    for (const ruleEvaluationStatus of ["not-applicable", "insufficient-facts"] as const) {
      const result = structuredClone(completedResult);
      (result as { ruleEvaluationStatus: string }).ruleEvaluationStatus = ruleEvaluationStatus;
      result.statements = [];
      result.clarifications = [];

      expect(interpretationResultSchema.safeParse(result).success).toBe(false);
    }
  });

  it("requires drawing evidence scopes as the complete stable enum sequence", () => {
    const scopes = [
      "tolerance_loop_closure",
      "datum_chain",
      "assembly_datum_face",
      "stack_start",
      "direction",
      "cross_subsystem",
    ] as const;
    const drawingClarification = completedResult.clarifications[0]!;
    expect(drawingClarification.scopes).toEqual(scopes);

    for (const invalidScopes of [
      scopes.slice(1),
      [...scopes].reverse(),
      [...scopes.slice(0, -1), "unsupported_scope"],
    ]) {
      const result = structuredClone(completedResult);
      (result.clarifications[0] as { scopes: unknown }).scopes = invalidScopes;
      expect(interpretationResultSchema.safeParse(result).success).toBe(false);
    }

    const resultWithoutScopes = structuredClone(completedResult);
    delete (resultWithoutScopes.clarifications[0] as { scopes?: unknown }).scopes;
    expect(interpretationResultSchema.safeParse(resultWithoutScopes).success).toBe(false);
  });

  it("requires exactly one drawing evidence clarification", () => {
    const missing = structuredClone(completedResult);
    missing.clarifications = [];
    expect(interpretationResultSchema.safeParse(missing).success).toBe(false);

    const duplicate = structuredClone(completedResult);
    duplicate.clarifications.push(structuredClone(duplicate.clarifications[0]!));
    duplicate.clarifications[1]!.clarificationId = "clarify-drawing-evidence-duplicate";
    expect(interpretationResultSchema.safeParse(duplicate).success).toBe(false);

    const repeatedScope = structuredClone(completedResult);
    repeatedScope.clarifications[0]!.scopes = [
      "tolerance_loop_closure",
      "datum_chain",
      "assembly_datum_face",
      "stack_start",
      "direction",
      "direction",
    ];
    expect(interpretationResultSchema.safeParse(repeatedScope).success).toBe(false);
  });

  it("requires insufficient-facts clarifications to carry the missing rule facts", () => {
    const result = structuredClone(completedResult);
    result.ruleEvaluationStatus = "insufficient-facts";
    result.statements = result.statements.filter((statement) => statement.type === "FACT");
    result.clarifications.push({
      clarificationId: "clarify-insufficient-facts",
      reasonCode: "rule_facts_insufficient",
      message: "Rule evaluation requires additional facts.",
      missingFacts: ["targetCpk", "targetSigma"],
    });

    expect(interpretationResultSchema.parse(result)).toEqual(result);

    const withoutMissingFacts = structuredClone(result);
    delete (withoutMissingFacts.clarifications[1] as { missingFacts?: unknown }).missingFacts;
    expect(interpretationResultSchema.safeParse(withoutMissingFacts).success).toBe(false);
  });

  it("rejects legacy FACT trace placement outside content", () => {
    const result = structuredClone(completedResult);
    const statement = result.statements[0] as unknown as {
      content: Record<string, unknown>;
      outputField?: unknown;
      trace?: unknown;
    };
    statement.outputField = statement.content.outputField;
    const legacyTrace = {
      ...((statement.content.traceRecords as Record<string, unknown>[])[0]!),
    };
    delete legacyTrace.outputField;
    statement.trace = legacyTrace;
    delete statement.content.outputField;
    delete statement.content.traceRecords;
    result.statements = [result.statements[0]!];

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects duplicate statementId values", () => {
    const result = structuredClone(completedResult);
    const statement = result.statements.find((candidate) => candidate.type === "RULE")!;
    result.statements = [statement, structuredClone(statement)];

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it("requires matched rule evaluation to produce a rule-derived statement", () => {
    const result = structuredClone(completedResult);
    result.statements = result.statements.filter((statement) => statement.type === "FACT");

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it.each(["SIGNAL", "OPTION"] as const)(
    "rejects matched rule evaluation with only a %s statement",
    (statementType) => {
      const result = structuredClone(completedResult);
      result.statements = result.statements.filter((statement) => (
        statement.type === "FACT" || statement.type === statementType
      ));

      expect(interpretationResultSchema.safeParse(result).success).toBe(false);
    },
  );

  it("requires every FACT trace outputField to match its FACT outputField", () => {
    const result = structuredClone(completedResult);
    const fact = result.statements[0] as {
      content: { traceRecords: Array<{ outputField: string }> };
    };
    fact.content.traceRecords[0]!.outputField = "capability.cp";

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it.each([
    ["cpk", "yield-v1"],
    ["cp", "yield-v1"],
    ["rss_sigma", "yield-v1"],
    ["total_dpm", "yield-v1"],
    ["yield", "cpk-v1"],
    ["factor_contribution", "yield-v1"],
  ] as const)("rejects %s FACT trace with formulaId %s", (metric, formulaId) => {
    const result = structuredClone(completedResult);
    const fact = result.statements.find(
      (statement) => statement.type === "FACT" && statement.content.metric === metric,
    ) as { content: { traceRecords: Array<{ formulaId: string }> } };
    fact.content.traceRecords[0]!.formulaId = formulaId;

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it.each([
    ["capability.lowerZ", "z-upper-v1"],
    ["capability.upperZ", "z-lower-v1"],
  ] as const)("rejects achieved_sigma trace %s with formulaId %s", (outputField, formulaId) => {
    const result = structuredClone(completedResult);
    const achievedSigma = result.statements.find(
      (statement) => statement.type === "FACT" && statement.content.metric === "achieved_sigma",
    ) as { content: { traceRecords: Array<{ outputField: string; formulaId: string }> } };
    const trace = achievedSigma.content.traceRecords.find((candidate) => candidate.outputField === outputField)!;
    trace.formulaId = formulaId;

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it("accepts worksheet, request, and F4 output source references", () => {
    const result = structuredClone(completedResult);
    const cpk = result.statements.find(
      (statement) => statement.type === "FACT" && statement.content.metric === "cpk",
    ) as { content: { traceRecords: Array<{ sourceCells: string[] }> } };
    cpk.content.traceRecords[0]!.sourceCells = [
      "Analysis Sheet!A1",
      "request:systemSpecification.targetCpk",
      "factors[0].sigma",
      "system.designNominal",
      "system.additionalMeanShift",
      "system.rssSigma",
      "capability.lowerCpk",
    ];

    expect(interpretationResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects arbitrary sensitive raw text as a FACT trace source", () => {
    const result = structuredClone(completedResult);
    const cpk = result.statements.find(
      (statement) => statement.type === "FACT" && statement.content.metric === "cpk",
    ) as { content: { traceRecords: Array<{ sourceCells: string[] }> } };
    cpk.content.traceRecords[0]!.sourceCells = ["sensitive raw text"];

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it.each([
    ["cpk", "calculation-summary"],
    ["cp", "capability-vs-specification"],
    ["rss_sigma", "capability-vs-specification"],
    ["total_dpm", "capability-vs-specification"],
    ["yield", "capability-vs-specification"],
    ["recommended_method", "capability-vs-specification"],
    ["achieved_sigma", "capability-vs-specification"],
    ["target_sigma", "capability-vs-specification"],
    ["target_cpk", "calculation-summary"],
    ["lower_spec_limit", "calculation-summary"],
    ["upper_spec_limit", "calculation-summary"],
    ["factor_contribution", "calculation-summary"],
  ] as const)("rejects FACT metric %s in section %s", (metric, section) => {
    const result = structuredClone(completedResult);
    const fact = result.statements.find(
      (statement) => statement.type === "FACT" && statement.content.metric === metric,
    )!;
    fact.section = section;

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it.each([
    ["RULE", "calculation-summary"],
    ["SIGNAL", "structural-evidence"],
    ["OPTION", "major-contributors"],
  ] as const)("rejects %s in section %s", (type, section) => {
    const result = structuredClone(completedResult);
    const statement = result.statements.find((candidate) => candidate.type === type)!;
    statement.section = section;

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it.each([
    ["cpk", "capability.cp"],
    ["cp", "capability.cpk"],
    ["rss_sigma", "capability.cpk"],
    ["total_dpm", "capability.yield"],
    ["yield", "capability.totalDpm"],
    ["factor_contribution", "factors[-1].contribution"],
  ] as const)("rejects formula output metric %s with outputField %s", (metric, outputField) => {
    const result = structuredClone(completedResult);
    const fact = result.statements.find(
      (statement) => statement.type === "FACT" && statement.content.metric === metric,
    ) as {
      content: {
        factorReference?: string;
        outputField: string;
        traceRecords: Array<{ outputField: string }>;
      };
    };
    expect(fact).toBeDefined();
    if (metric === "factor_contribution") expect(fact.content.factorReference).toBeTruthy();
    fact.content.outputField = outputField;
    fact.content.traceRecords.forEach((traceRecord) => {
      traceRecord.outputField = outputField;
    });

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it("requires FACT metric and provenance fields to agree", () => {
    const result = structuredClone(completedResult);
    const targetCpk = result.statements.find(
      (statement) => statement.type === "FACT" && statement.content.metric === "target_cpk",
    ) as { content: Record<string, unknown> };
    targetCpk.content.inputField = "capability.targetSigmaLevel";

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects achieved_sigma with formula output provenance and a fabricated trace", () => {
    const result = structuredClone(completedResult);
    const achievedSigma = result.statements.find(
      (statement) => statement.type === "FACT" && statement.content.metric === "achieved_sigma",
    ) as unknown as { content: Record<string, unknown> };
    achievedSigma.content = {
      metric: "achieved_sigma",
      value: 7.2,
      unit: "sigma",
      provenanceKind: "formula_output",
      outputField: "capability.achievedSigma",
      traceRecords: [{
        outputField: "capability.achievedSigma",
        formulaVersion: "excel-ta-v1",
        formulaId: "cpk-v1",
        sourceCells: ["capability.lowerZ", "capability.upperZ"],
      }],
    };

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it("requires derived FACT traces to cover exactly their source output fields", () => {
    const result = structuredClone(completedResult);
    const achievedSigma = result.statements.find(
      (statement) => statement.type === "FACT" && statement.content.metric === "achieved_sigma",
    ) as { content: { traceRecords: Array<{ outputField: string }> } };
    achievedSigma.content.traceRecords[1]!.outputField = "capability.lowerZ";

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects duplicate scalar FACT metrics", () => {
    const result = structuredClone(completedResult);
    const cpk = structuredClone(result.statements[0]!);
    cpk.statementId = "fact-cpk-duplicate";
    result.statements.push(cpk);

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects duplicate factor contribution references", () => {
    const result = structuredClone(completedResult);
    const contribution = structuredClone(result.statements.find(
      (statement) => statement.type === "FACT" && statement.content.metric === "factor_contribution",
    )!);
    contribution.statementId = "fact-factor-contribution-duplicate";
    result.statements.push(contribution);

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects a targetCpk reference without a target_cpk FACT", () => {
    const result = structuredClone(completedResult);
    result.statements = result.statements.filter(
      (statement) => statement.type !== "FACT" || statement.content.metric !== "target_cpk",
    );
    const rule = result.statements.find((statement) => statement.type === "RULE") as {
      content: { relatedFactReferences: string[] };
    };
    rule.content.relatedFactReferences = ["targetCpk"];

    expect(interpretationResultSchema.safeParse(result).success).toBe(false);
  });

  describe("root F5 data interpretation contracts", () => {
    const imageReference = {
      artifact: "f1" as const,
      relativePath: "worksheets/Analysis-A/tolerance-path.png",
      contentHash: "d".repeat(64),
      worksheetName: "Analysis-A",
    };
    const imageObservation = {
      scope: "stack_start" as const,
      observedValue: "visible" as const,
      confidence: "medium" as const,
      visibleBasis: "A labeled start marker is visible in the worksheet image.",
      reviewStatus: "unreviewed" as const,
    };
    const observationArtifact = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      observationVersion: "f5-image-observation-v1" as const,
      workbookContentHash: contentHash,
      worksheets: [{
        worksheetName: "Analysis-A",
        imageReference,
        observations: [imageObservation],
      }],
    };
    const coreScopes = [
      "tolerance_loop_closure",
      "datum_chain",
      "assembly_datum_face",
      "stack_start",
      "direction",
    ] as const;
    const validV2 = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      observationVersion: "f5-image-observation-v2" as const,
      workbookContentHash: contentHash,
      worksheets: [{
        worksheetName: "Analysis-A",
        imageReference,
        contextSnapshot: {
          dimensionDescription: "Device gap",
          rows: [{
            tableId: "table-a",
            sourceRow: 14,
            factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!F14" },
            partName: "Bracket",
            partSubsystem: "Bracket",
            partCategory: "CNC",
            factorName: "Bracket height",
            factorDescription: "Bracket height",
            nominal: 1,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            sigmaLevel: 4,
            sourceCells: { factorName: "Analysis-A!G14", partName: "Analysis-A!H14" },
          }],
        },
        observations: coreScopes.map((scope) => ({
          scope,
          visualObservation: {
            observedValue: "ambiguous" as const,
            confidence: "medium" as const,
            visibleBasis: `Visible basis for ${scope}.`,
            visibleLabels: scope === "direction" ? ["Bracket height"] : [],
            reviewStatus: "unreviewed" as const,
          },
          contextualSignal: {
            signalValue: "insufficient_evidence" as const,
            textBasis: `Context basis for ${scope}.`,
            linkedSourceRows: [],
            linkedVisualLabels: [],
            requiresEngineeringReview: true as const,
          },
        })),
      }],
    };
    const governanceRow = {
      factorInstanceId: "e".repeat(64),
      factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!F2" },
      drawingDimensionKey: "f".repeat(64),
      deviceLevelDim: "Analysis-A",
      dimensionDescription: "Anonymous device gap",
      partCategory: "CNC",
      partSubsystem: "Anonymous bracket",
      drawingNumber: "DRAW-100",
      dimId: "307",
      factorDescription: "Feature-A",
      nominal: 12.45,
      upperTolerance: 0.2,
      lowerTolerance: -0.2,
      sigmaLevel: 4,
      dimIdStatus: "valid" as const,
      qualitySignals: [],
      governanceStatus: "complete" as const,
      imageReference,
      source: {
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 2,
        sourceCells: {},
      },
    };
    const rootCalculationResult = structuredClone(calculationCompletedResult);
    rootCalculationResult.traceRecords = completedResult.statements.flatMap((statement) => {
      if (statement.type !== "FACT" || statement.content.provenanceKind === "calculation_input") return [];
      return structuredClone(statement.content.traceRecords);
    });
    const rootRequest = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      workbook: { fileName: "Anonymous.xlsx", contentHash },
      knowledgeBaseVersion: "interpretation-rules-v1" as const,
      worksheets: [{
        worksheetName: "Analysis-A",
        imageReference,
        governanceRows: [governanceRow],
        calculationResult: rootCalculationResult,
        imageObservations: [imageObservation],
      }],
    };

    it("accepts a clean enhanced-observation fallback with no image observations", () => {
      const fallbackRequest = structuredClone(rootRequest);
      fallbackRequest.worksheets[0]!.imageObservations = [];

      expect(f5DataInterpretationRequestSchema.safeParse({
        ...fallbackRequest,
        observationFallback: { reasonCode: "enhanced_observation_rejected" },
      }).success).toBe(true);
      expect(f5DataInterpretationRequestSchema.safeParse({
        ...fallbackRequest,
        observationFallback: { reasonCode: "unvalidated_reason" },
      }).success).toBe(false);
    });

    it("rejects fallback combined with v1 image observations", () => {
      const parsed = f5DataInterpretationRequestSchema.safeParse({
        ...rootRequest,
        observationFallback: { reasonCode: "enhanced_observation_rejected" },
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "imageObservations",
        ]);
      }
    });

    const contextualRootRequest = () => {
      const request = structuredClone(rootRequest) as unknown as Record<string, unknown>;
      const worksheet = (request.worksheets as Array<Record<string, unknown>>)[0]!;
      const snapshot = structuredClone(validV2.worksheets[0]!.contextSnapshot);
      const snapshotRow = snapshot.rows[0]!;
      const row = rootRequest.worksheets[0]!.governanceRows[0]!;
      Object.assign(snapshotRow, {
        tableId: row.source.tableId,
        sourceRow: row.source.sourceRow,
        factorOrdinal: structuredClone(row.factorOrdinal),
        partName: row.partSubsystem,
        partSubsystem: row.partSubsystem,
        partCategory: row.partCategory,
        factorName: row.factorDescription,
        factorDescription: row.factorDescription,
        nominal: row.nominal,
        upperTolerance: row.upperTolerance,
        lowerTolerance: row.lowerTolerance,
        sigmaLevel: row.sigmaLevel,
        sourceCells: structuredClone(row.source.sourceCells),
      });
      snapshot.dimensionDescription = row.dimensionDescription;
      worksheet.observationVersion = validV2.observationVersion;
      worksheet.contextSnapshot = snapshot;
      worksheet.imageObservations = structuredClone(validV2.worksheets[0]!.observations);
      return request;
    };

    it("rejects fallback combined with v2 worksheet fields and observations", () => {
      const request = contextualRootRequest();
      request.observationFallback = { reasonCode: "enhanced_observation_rejected" };

      const parsed = f5DataInterpretationRequestSchema.safeParse(request);

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const paths = parsed.error.issues.map(({ path }) => path);
        expect(paths).toContainEqual(["worksheets", 0, "observationVersion"]);
        expect(paths).toContainEqual(["worksheets", 0, "contextSnapshot"]);
        expect(paths).toContainEqual(["worksheets", 0, "imageObservations"]);
      }
    });
    const rootRule = {
      statementId: "root-rule-performance",
      type: "RULE" as const,
      section: "capability-vs-specification" as const,
      content: {
        entryId: "rule-cpk-target",
        effectiveVersion: "interpretation-rules-v1" as const,
        applicability: { analysisDimension: "one-dimensional" as const, method: "rss" as const },
        relatedFactReferences: ["cpk", "targetCpk"] as const,
        evidence: ruleEvidence("kb-performance", "Rules", "A2:B2"),
      },
    };
    const rootOption = {
      statementId: "root-option-follow-up",
      type: "OPTION" as const,
      section: "parallel-options" as const,
      content: {
        entryId: "option-tighten-process",
        effectiveVersion: "interpretation-rules-v1" as const,
        applicability: { analysisDimension: "one-dimensional" as const, method: "rss" as const },
        relatedFactReferences: ["cpk"] as const,
        evidence: ruleEvidence("kb-option", "Rules", "E4:F4"),
        rank: null,
      },
    };
    const rootFacts = completedResult.statements.filter((statement) => statement.type === "FACT");
    const contributorFact = rootFacts.find((statement) => statement.content.metric === "factor_contribution")!;
    const contributorItem = {
      factorReference: "Analysis-A/table-a/2",
      factorName: "Feature-A",
      factorIndex: 0,
      contributionPercent: 100,
      halfTolerance: calculationCompletedResult.factors[0]!.halfTolerance,
      sigma: calculationCompletedResult.factors[0]!.sigma,
      unit: calculationCompletedResult.factors[0]!.unit,
      source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
      drawingNumber: "DRAW-100",
      dimId: "307",
      governanceStatus: "complete" as const,
      reasonCodes: [],
      relatedStatementIds: [contributorFact.statementId],
    };
    const structuralScopes = [
      "tolerance_loop_closure",
      "datum_chain",
      "assembly_datum_face",
      "stack_start",
      "direction",
      "cross_subsystem",
      "non_geometric_variable",
      "long_dimension_chain",
    ] as const;
    const toleranceItems = structuralScopes.map((scope) => ({
      scope,
      status: "not_evaluated" as const,
      relatedStatementIds: [],
      clarificationIds: [`clarify-image-${scope}`],
    }));
    const rootClarifications = structuralScopes.map((scope) => ({
      clarificationId: `clarify-image-${scope}`,
      reasonCode: "image_not_available",
      section: "toleranceChainValidity" as const,
      structuralScope: scope,
      missingEvidence: [`confirmed ${scope} image observation`],
      affectedConclusionIds: [],
      blockingScope: "conclusion" as const,
      questionForReviewer: `Can the ${scope} evidence be reviewed?`,
    }));
    const rootImageFact = {
      statementId: "root-fact-image-stack-start",
      type: "FACT" as const,
      section: "tolerance-chain-validity" as const,
      content: {
        provenanceKind: "image_observation" as const,
        scope: "stack_start" as const,
        observedValue: "visible" as const,
        imageReference,
        confidence: "high" as const,
        visibleBasis: "The controlled worksheet image visibly identifies the stack start.",
        visibleLabels: [] as string[],
        reviewStatus: "unreviewed" as const,
      },
    };
    const rootStructuralSignal = {
      statementId: "root-signal-structural-review",
      type: "SIGNAL" as const,
      section: "tolerance-chain-validity" as const,
      content: {
        signalKind: "structural_evidence_review" as const,
        requiresEngineeringReview: true as const,
        triggerFactReferences: [rootImageFact.statementId],
      },
    };
    const rootGovernanceFact = {
      statementId: "root-fact-governance-1",
      type: "FACT" as const,
      section: "major-contributors" as const,
      content: {
        provenanceKind: "f3_governance" as const,
        source: structuredClone(governanceRow.source),
        drawingNumber: governanceRow.drawingNumber,
        dimId: governanceRow.dimId,
        dimIdStatus: governanceRow.dimIdStatus,
        governanceStatus: governanceRow.governanceStatus,
        qualitySignals: structuredClone(governanceRow.qualitySignals),
      },
    };
    const rootGovernanceSignal = {
      statementId: "root-signal-identifier-gap",
      type: "SIGNAL" as const,
      section: "major-contributors" as const,
      content: {
        signalKind: "identifier_governance_gap" as const,
        requiresEngineeringReview: true as const,
        triggerFactReferences: [rootGovernanceFact.statementId],
      },
    };
    const completedWorksheet = {
      worksheetName: "Analysis-A",
      imageReference,
      governanceRows: [governanceRow],
      calculationResult: rootCalculationResult,
      status: "completed" as const,
      sections: {
        toleranceChainValidity: { status: "not_evaluated" as const, items: toleranceItems },
        capabilityVsSpecification: {
          status: "supported" as const,
          statementIds: [
            ...rootFacts.filter((statement) => statement.content.metric !== "factor_contribution")
              .map(({ statementId }) => statementId),
            rootRule.statementId,
          ],
        },
        majorContributors: { status: "supported" as const, items: [contributorItem] },
        reasonableToleranceRange: { status: "delegated_to_f6" as const },
        designOptimizationAndParallelOptions: { status: "delegated_to_f6" as const },
      },
      statements: [
        ...rootFacts,
        rootRule,
        rootOption,
        rootImageFact,
        rootStructuralSignal,
        rootGovernanceFact,
        rootGovernanceSignal,
      ],
      clarifications: rootClarifications,
      assumptions: [{
        assumptionId: "assumption-1",
        source: "F4 calculation input",
        affectedSections: ["capabilityVsSpecification"],
        statement: "The selected calculation is the intended baseline.",
        status: "proposed" as const,
      }],
    };
    const rootResult = {
      contractVersion: "v1" as const,
      outputClassification: "confidential" as const,
      featureId: "F5" as const,
      status: "completed" as const,
      interpretationVersion: "f5-data-interpretation-v1" as const,
      knowledgeBaseVersion: "interpretation-rules-v1" as const,
      workbook: { fileName: "Anonymous.xlsx", contentHash },
      worksheets: [completedWorksheet],
      summary: {
        worksheetCount: 1,
        completedWorksheetCount: 1,
        inputRejectedWorksheetCount: 0,
        statementCount: completedWorksheet.statements.length,
        clarificationCount: completedWorksheet.clarifications.length,
        assumptionCount: 1,
      },
    };

    const completeCapabilityResult = () => {
      const result = structuredClone(rootResult);
      const objectiveFacts = structuredClone(completedResult.statements.filter((statement) => (
        statement.type === "FACT"
      )));
      const capabilityFacts = objectiveFacts.filter((statement) => (
        statement.type === "FACT" && statement.content.metric !== "factor_contribution"
      ));
      result.worksheets[0]!.statements = [
        ...objectiveFacts,
        structuredClone(rootImageFact),
        structuredClone(rootStructuralSignal),
        structuredClone(rootGovernanceFact),
        structuredClone(rootGovernanceSignal),
      ];
      result.worksheets[0]!.sections.capabilityVsSpecification.statementIds = capabilityFacts.map(
        ({ statementId }) => statementId,
      );
      result.summary.statementCount = result.worksheets[0]!.statements.length;
      return result;
    };

    it("accepts strict image observations and enforces confirmation metadata", () => {
      expect(f5ImageObservationArtifactSchema.parse(observationArtifact)).toEqual(observationArtifact);

      const confirmed = structuredClone(observationArtifact);
      confirmed.worksheets[0]!.observations[0] = {
        ...confirmed.worksheets[0]!.observations[0]!,
        reviewStatus: "confirmed",
        confirmedBy: "controlled-reviewer",
        confirmedAt: "2026-08-11T08:00:00.000Z",
      } as typeof confirmed.worksheets[0]["observations"][number];
      expect(f5ImageObservationArtifactSchema.safeParse(confirmed).success).toBe(true);

      const missingConfirmation = structuredClone(confirmed);
      delete (missingConfirmation.worksheets[0]!.observations[0] as { confirmedAt?: string }).confirmedAt;
      const missingConfirmationResult = f5ImageObservationArtifactSchema.safeParse(missingConfirmation);
      expect(missingConfirmationResult.success).toBe(false);
      if (!missingConfirmationResult.success) {
        expect(missingConfirmationResult.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "observations", 0, "confirmedAt",
        ]);
      }

      const missingBoth = structuredClone(confirmed);
      delete (missingBoth.worksheets[0]!.observations[0] as { confirmedBy?: string }).confirmedBy;
      delete (missingBoth.worksheets[0]!.observations[0] as { confirmedAt?: string }).confirmedAt;
      const missingBothResult = f5ImageObservationArtifactSchema.safeParse(missingBoth);
      expect(missingBothResult.success).toBe(false);
      if (!missingBothResult.success) {
        const paths = missingBothResult.error.issues.map(({ path }) => path);
        expect(paths).toContainEqual(["worksheets", 0, "observations", 0, "confirmedBy"]);
        expect(paths).toContainEqual(["worksheets", 0, "observations", 0, "confirmedAt"]);
      }

      const unreviewedWithConfirmation = structuredClone(confirmed);
      unreviewedWithConfirmation.worksheets[0]!.observations[0]!.reviewStatus = "unreviewed";
      const unreviewedResult = f5ImageObservationArtifactSchema.safeParse(unreviewedWithConfirmation);
      expect(unreviewedResult.success).toBe(false);
      if (!unreviewedResult.success) {
        const paths = unreviewedResult.error.issues.map(({ path }) => path);
        expect(paths).toContainEqual(["worksheets", 0, "observations", 0, "confirmedBy"]);
        expect(paths).toContainEqual(["worksheets", 0, "observations", 0, "confirmedAt"]);
      }
    });

    it("preserves historical v1 and accepts valid v2 through its schema and the version union", () => {
      expect(f5ImageObservationArtifactSchema.parse(observationArtifact)).toEqual(observationArtifact);
      expect(f5ImageObservationArtifactV2Schema.parse(validV2)).toEqual(validV2);
      expect(f5ImageObservationArtifactSchema.parse(validV2)).toEqual(validV2);
      expect(f5ImageObservationArtifactSchema.safeParse({
        ...validV2,
        observationVersion: "f5-image-observation-v3",
      }).success).toBe(false);
    });

    it("requires exactly one of every core scope in each v2 worksheet", () => {
      const worksheet = validV2.worksheets[0]!;
      expect(f5ImageObservationArtifactV2Schema.safeParse({
        ...validV2,
        worksheets: [{ ...worksheet, observations: worksheet.observations.slice(1) }],
      }).success).toBe(false);
      expect(f5ImageObservationArtifactV2Schema.safeParse({
        ...validV2,
        worksheets: [{
          ...worksheet,
          observations: [...worksheet.observations.slice(0, -1), worksheet.observations[0]],
        }],
      }).success).toBe(false);
    });

    it("rejects duplicate v2 worksheets and duplicate snapshot row keys", () => {
      const worksheet = validV2.worksheets[0]!;
      expect(f5ImageObservationArtifactV2Schema.safeParse({
        ...validV2,
        worksheets: [worksheet, worksheet],
      }).success).toBe(false);
      expect(f5ImageObservationArtifactV2Schema.safeParse({
        ...validV2,
        worksheets: [{
          ...worksheet,
          contextSnapshot: {
            ...worksheet.contextSnapshot,
            rows: [worksheet.contextSnapshot.rows[0], worksheet.contextSnapshot.rows[0]],
          },
        }],
      }).success).toBe(false);
    });

    it("requires sourceCells and keeps contextual links within the snapshot", () => {
      const missingSourceCells = structuredClone(validV2);
      delete (missingSourceCells.worksheets[0]!.contextSnapshot.rows[0] as { sourceCells?: unknown }).sourceCells;
      expect(f5ImageObservationArtifactV2Schema.safeParse(missingSourceCells).success).toBe(false);

      const outsideSnapshot = structuredClone(validV2);
      outsideSnapshot.worksheets[0]!.observations[0]!.contextualSignal.linkedSourceRows = [{
        tableId: "table-a",
        sourceRow: 99,
      }];
      expect(f5ImageObservationArtifactV2Schema.safeParse(outsideSnapshot).success).toBe(false);
    });

    it.each([
      "tolerance_loop_closure",
      "datum_chain",
      "assembly_datum_face",
      "stack_start",
    ] as const)("accepts %s linked rows without visual labels", (scope) => {
      const artifact = structuredClone(validV2);
      const worksheet = artifact.worksheets[0]!;
      const snapshotRow = worksheet.contextSnapshot.rows[0]!;
      const observation = worksheet.observations.find((candidate) => candidate.scope === scope)!;
      observation.visualObservation.observedValue = "visible";
      observation.contextualSignal.signalValue = "indicated_consistent";
      observation.contextualSignal.linkedSourceRows = [{
        tableId: snapshotRow.tableId,
        sourceRow: snapshotRow.sourceRow,
      }];

      expect(observation.contextualSignal.linkedVisualLabels).toEqual([]);
      expect(f5ImageObservationArtifactV2Schema.safeParse(artifact).success).toBe(true);
    });

    it("rejects duplicate and outside-snapshot non-direction linked rows", () => {
      const createLinkedDatumChain = () => {
        const artifact = structuredClone(validV2);
        const worksheet = artifact.worksheets[0]!;
        const snapshotRow = worksheet.contextSnapshot.rows[0]!;
        const observation = worksheet.observations.find(({ scope }) => scope === "datum_chain")!;
        observation.visualObservation.observedValue = "visible";
        observation.contextualSignal.signalValue = "indicated_consistent";
        observation.contextualSignal.linkedSourceRows = [{
          tableId: snapshotRow.tableId,
          sourceRow: snapshotRow.sourceRow,
        }];
        return { artifact, observation };
      };

      const duplicate = createLinkedDatumChain();
      duplicate.observation.contextualSignal.linkedSourceRows.push(
        structuredClone(duplicate.observation.contextualSignal.linkedSourceRows[0]!),
      );
      expect(f5ImageObservationArtifactV2Schema.safeParse(duplicate.artifact).success).toBe(false);

      const outsideSnapshot = createLinkedDatumChain();
      outsideSnapshot.observation.contextualSignal.linkedSourceRows[0]!.sourceRow = 99;
      expect(f5ImageObservationArtifactV2Schema.safeParse(outsideSnapshot.artifact).success).toBe(false);
    });

    it("restricts unlinked contextual signals and always requires engineering review", () => {
      const unlinkedConclusion = structuredClone(validV2);
      unlinkedConclusion.worksheets[0]!.observations[0]!.contextualSignal.signalValue = "indicated_consistent" as "insufficient_evidence";
      expect(f5ImageObservationArtifactV2Schema.safeParse(unlinkedConclusion).success).toBe(false);

      const reviewDisabled = structuredClone(validV2);
      reviewDisabled.worksheets[0]!.observations[0]!.contextualSignal.requiresEngineeringReview = false as true;
      expect(f5ImageObservationArtifactV2Schema.safeParse(reviewDisabled).success).toBe(false);
    });

    it("requires visible core markers before consistency or source-row linkage", () => {
      const worksheet = validV2.worksheets[0]!;
      const snapshotRow = worksheet.contextSnapshot.rows[0]!;

      for (const scope of ["stack_start", "assembly_datum_face"] as const) {
        const artifact = structuredClone(validV2);
        const observation = artifact.worksheets[0]!.observations.find((candidate) => candidate.scope === scope)!;
        observation.visualObservation.observedValue = "not_visible";
        observation.contextualSignal.signalValue = "indicated_consistent";
        observation.contextualSignal.linkedSourceRows = [{ tableId: snapshotRow.tableId, sourceRow: snapshotRow.sourceRow }];
        expect(f5ImageObservationArtifactV2Schema.safeParse(artifact).success).toBe(false);
      }

      const directionWithoutVisibleLabel = structuredClone(validV2);
      const direction = directionWithoutVisibleLabel.worksheets[0]!.observations.find(
        (observation) => observation.scope === "direction",
      )!;
      direction.visualObservation.observedValue = "ambiguous";
      direction.contextualSignal.signalValue = "ambiguous";
      direction.contextualSignal.linkedSourceRows = [{ tableId: snapshotRow.tableId, sourceRow: snapshotRow.sourceRow }];
      expect(f5ImageObservationArtifactV2Schema.safeParse(directionWithoutVisibleLabel).success).toBe(false);
    });

    it("requires structured visible label evidence for direction links and conclusions", () => {
      const artifact = structuredClone(validV2);
      const worksheet = artifact.worksheets[0]!;
      const snapshotRow = worksheet.contextSnapshot.rows[0]!;
      const direction = worksheet.observations.find((observation) => observation.scope === "direction")!;
      direction.visualObservation.observedValue = "visible";
      direction.visualObservation.visibleLabels = ["Bracket height"];
      direction.contextualSignal.signalValue = "indicated_consistent";
      direction.contextualSignal.linkedSourceRows = [{
        tableId: snapshotRow.tableId,
        sourceRow: snapshotRow.sourceRow,
      }];

      expect(f5ImageObservationArtifactV2Schema.safeParse(artifact).success).toBe(false);

      direction.contextualSignal.linkedVisualLabels = [{
        label: "Bracket height",
        tableId: snapshotRow.tableId,
        sourceRow: snapshotRow.sourceRow,
      }];
      expect(f5ImageObservationArtifactV2Schema.safeParse(artifact).success).toBe(true);
    });

    it("rejects mismatched, duplicate, and outside-snapshot direction label references", () => {
      const createLinkedDirection = () => {
        const artifact = structuredClone(validV2);
        const worksheet = artifact.worksheets[0]!;
        const snapshotRow = worksheet.contextSnapshot.rows[0]!;
        const direction = worksheet.observations.find((observation) => observation.scope === "direction")!;
        direction.visualObservation.observedValue = "visible";
        direction.visualObservation.visibleLabels = ["Bracket height"];
        direction.contextualSignal.signalValue = "indicated_consistent";
        direction.contextualSignal.linkedSourceRows = [{
          tableId: snapshotRow.tableId,
          sourceRow: snapshotRow.sourceRow,
        }];
        direction.contextualSignal.linkedVisualLabels = [{
          label: "Bracket height",
          tableId: snapshotRow.tableId,
          sourceRow: snapshotRow.sourceRow,
        }];
        return { artifact, direction };
      };

      const mismatched = createLinkedDirection();
      mismatched.direction.contextualSignal.linkedVisualLabels[0]!.sourceRow = 99;
      expect(f5ImageObservationArtifactV2Schema.safeParse(mismatched.artifact).success).toBe(false);

      const duplicate = createLinkedDirection();
      duplicate.direction.contextualSignal.linkedVisualLabels.push(
        structuredClone(duplicate.direction.contextualSignal.linkedVisualLabels[0]!),
      );
      expect(f5ImageObservationArtifactV2Schema.safeParse(duplicate.artifact).success).toBe(false);

      const outsideSnapshot = createLinkedDirection();
      outsideSnapshot.direction.contextualSignal.linkedSourceRows[0]!.sourceRow = 99;
      outsideSnapshot.direction.contextualSignal.linkedVisualLabels[0]!.sourceRow = 99;
      expect(f5ImageObservationArtifactV2Schema.safeParse(outsideSnapshot.artifact).success).toBe(false);
    });

    it("rejects invented or duplicate structured direction labels", () => {
      const artifact = structuredClone(validV2);
      const worksheet = artifact.worksheets[0]!;
      const snapshotRow = worksheet.contextSnapshot.rows[0]!;
      const direction = worksheet.observations.find(({ scope }) => scope === "direction")!;
      direction.visualObservation.observedValue = "visible";
      direction.visualObservation.visibleLabels = ["Bracket height"];
      direction.contextualSignal.signalValue = "indicated_consistent";
      direction.contextualSignal.linkedSourceRows = [{
        tableId: snapshotRow.tableId,
        sourceRow: snapshotRow.sourceRow,
      }];
      direction.contextualSignal.linkedVisualLabels = [{
        label: "Invented label",
        tableId: snapshotRow.tableId,
        sourceRow: snapshotRow.sourceRow,
      }];
      expect(f5ImageObservationArtifactV2Schema.safeParse(artifact).success).toBe(false);

      direction.contextualSignal.linkedVisualLabels[0]!.label = "Bracket height";
      direction.visualObservation.visibleLabels.push("Bracket height");
      expect(f5ImageObservationArtifactV2Schema.safeParse(artifact).success).toBe(false);
    });

    it("rejects visual label evidence for non-direction scopes", () => {
      const artifact = structuredClone(validV2);
      const worksheet = artifact.worksheets[0]!;
      const snapshotRow = worksheet.contextSnapshot.rows[0]!;
      const stackStart = worksheet.observations.find((observation) => observation.scope === "stack_start")!;
      stackStart.contextualSignal.linkedVisualLabels = [{
        label: "Stack start",
        tableId: snapshotRow.tableId,
        sourceRow: snapshotRow.sourceRow,
      }];

      expect(f5ImageObservationArtifactV2Schema.safeParse(artifact).success).toBe(false);
    });

    it("requires both v2 confirmation fields and forbids them for other review statuses", () => {
      const confirmed = structuredClone(validV2);
      confirmed.worksheets[0]!.observations[0]!.visualObservation = {
        ...confirmed.worksheets[0]!.observations[0]!.visualObservation,
        reviewStatus: "confirmed",
        confirmedBy: "controlled-reviewer",
        confirmedAt: "2026-08-11T08:00:00.000Z",
      } as typeof confirmed.worksheets[0]["observations"][number]["visualObservation"];
      expect(f5ImageObservationArtifactV2Schema.safeParse(confirmed).success).toBe(true);

      for (const field of ["confirmedBy", "confirmedAt"] as const) {
        const missingField = structuredClone(confirmed);
        delete (missingField.worksheets[0]!.observations[0]!.visualObservation as Record<string, unknown>)[field];
        expect(f5ImageObservationArtifactV2Schema.safeParse(missingField).success).toBe(false);
      }

      const unreviewed = structuredClone(confirmed);
      unreviewed.worksheets[0]!.observations[0]!.visualObservation.reviewStatus = "unreviewed";
      expect(f5ImageObservationArtifactV2Schema.safeParse(unreviewed).success).toBe(false);
    });

    it("rejects v2 image identity mismatches and strict unknown fields", () => {
      const worksheet = validV2.worksheets[0]!;
      expect(f5ImageObservationArtifactV2Schema.safeParse({
        ...validV2,
        worksheets: [{
          ...worksheet,
          imageReference: { ...worksheet.imageReference, worksheetName: "Analysis-B" },
        }],
      }).success).toBe(false);
      expect(f5ImageObservationArtifactV2Schema.safeParse({
        ...validV2,
        worksheets: [{
          ...worksheet,
          contextSnapshot: {
            ...worksheet.contextSnapshot,
            rows: [{ ...worksheet.contextSnapshot.rows[0], unexpected: true }],
          },
        }],
      }).success).toBe(false);
    });

    it("rejects duplicate or mismatched observation worksheets, scopes, and paths", () => {
      expect(f5ImageObservationArtifactSchema.safeParse({
        ...observationArtifact,
        worksheets: [{
          ...observationArtifact.worksheets[0],
          imageReference: { ...imageReference, worksheetName: "Analysis-B" },
        }],
      }).success).toBe(false);
      expect(f5ImageObservationArtifactSchema.safeParse({
        ...observationArtifact,
        worksheets: [observationArtifact.worksheets[0], observationArtifact.worksheets[0]],
      }).success).toBe(false);
      expect(f5ImageObservationArtifactSchema.safeParse({
        ...observationArtifact,
        worksheets: [{
          ...observationArtifact.worksheets[0],
          observations: [imageObservation, imageObservation],
        }],
      }).success).toBe(false);
      expect(f5ImageObservationArtifactSchema.safeParse({
        ...observationArtifact,
        worksheets: [{
          ...observationArtifact.worksheets[0],
          imageReference: { ...imageReference, relativePath: "C:\\controlled\\image.png" },
        }],
      }).success).toBe(false);
    });

    it("accepts a structured root request and rejects worksheet, hash, table, source, and image mismatches", () => {
      expect(f5DataInterpretationRequestSchema.parse(rootRequest)).toEqual(rootRequest);
      expect(f5DataInterpretationRequestSchema.safeParse({ ...rootRequest, inputClassification: "public" }).success).toBe(false);
      expect(f5DataInterpretationRequestSchema.safeParse({ ...rootRequest, unexpected: true }).success).toBe(false);

      const mutations = [
        { workbook: { ...rootRequest.workbook, contentHash: "0".repeat(64) } },
        { worksheets: [{ ...rootRequest.worksheets[0], worksheetName: "Analysis-B" }] },
        { worksheets: [{ ...rootRequest.worksheets[0], imageReference: { ...imageReference, contentHash: "0".repeat(64) } }] },
        { worksheets: [{ ...rootRequest.worksheets[0], calculationResult: { ...calculationCompletedResult, worksheetSelection: { worksheetName: "Analysis-A", tableId: "table-b" } } }] },
        { worksheets: [{ ...rootRequest.worksheets[0], governanceRows: [{ ...governanceRow, source: { ...governanceRow.source, sourceRow: 3 } }] }] },
      ];
      for (const mutation of mutations) {
        expect(f5DataInterpretationRequestSchema.safeParse({ ...rootRequest, ...mutation }).success).toBe(false);
      }
    });

    it("accepts the loader v2 request shape while preserving the v1 request shape", () => {
      const v2Request = contextualRootRequest();

      expect(f5DataInterpretationRequestSchema.parse(rootRequest)).toEqual(rootRequest);
      expect(f5DataInterpretationRequestSchema.parse(v2Request)).toEqual(v2Request);

      const incompleteV2 = structuredClone(v2Request) as Record<string, unknown>;
      delete ((incompleteV2.worksheets as Array<Record<string, unknown>>)[0]!).contextSnapshot;
      expect(f5DataInterpretationRequestSchema.safeParse(incompleteV2).success).toBe(false);
    });

    it("requires the v2 request snapshot and governance rows to have the same row keys", () => {
      const missingRow = contextualRootRequest();
      const missingSnapshot = ((missingRow.worksheets as Array<Record<string, unknown>>)[0]!
        .contextSnapshot as { rows: unknown[] });
      missingSnapshot.rows = [];
      expect(f5DataInterpretationRequestSchema.safeParse(missingRow).success).toBe(false);

      const extraRow = contextualRootRequest();
      const extraSnapshot = ((extraRow.worksheets as Array<Record<string, unknown>>)[0]!
        .contextSnapshot as { rows: Array<Record<string, unknown>> });
      extraSnapshot.rows.push({ ...structuredClone(extraSnapshot.rows[0]!), sourceRow: 99 });
      expect(f5DataInterpretationRequestSchema.safeParse(extraRow).success).toBe(false);
    });

    it.each([
      ["partName", "changed original part"],
      ["partSubsystem", "changed subsystem"],
      ["partCategory", "changed category"],
      ["factorName", "changed original factor"],
      ["factorDescription", "changed factor"],
      ["nominal", 999],
      ["upperTolerance", 999],
      ["lowerTolerance", -999],
      ["sigmaLevel", 999],
      ["sourceCells", { factorName: "Analysis-A!Z99" }],
    ] as const)("rejects v2 request snapshot %s changes", (field, value) => {
      const request = contextualRootRequest();
      const snapshot = ((request.worksheets as Array<Record<string, unknown>>)[0]!
        .contextSnapshot as { rows: Array<Record<string, unknown>> });
      snapshot.rows[0]![field] = value;

      expect(f5DataInterpretationRequestSchema.safeParse(request).success).toBe(false);
    });

    it("rejects v2 request snapshot dimension provenance changes", () => {
      const request = contextualRootRequest();
      const snapshot = ((request.worksheets as Array<Record<string, unknown>>)[0]!
        .contextSnapshot as { dimensionDescription: string });
      snapshot.dimensionDescription = "Changed dimension";

      expect(f5DataInterpretationRequestSchema.safeParse(request).success).toBe(false);
    });

    it("accepts strict image-text context review root signals", () => {
      const result = completedResultWithContextSignals(coreScopes);
      const worksheet = result.worksheets[0]!;
      const contextSignal = worksheet.statements.find((statement) => (
        statement.type === "SIGNAL"
        && "signalKind" in statement.content
        && statement.content.signalKind === "image_text_context_review"
        && statement.content.scope === "direction"
      ))!;

      expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(true);

      const reviewDisabled = structuredClone(result);
      const parsedSignal = reviewDisabled.worksheets[0]!.statements.find(
        ({ statementId }) => statementId === contextSignal.statementId,
      )! as typeof contextSignal;
      parsedSignal.content.requiresEngineeringReview = false as true;
      expect(f5DataInterpretationResultSchema.safeParse(reviewDisabled).success).toBe(false);
    });

    it.each([
      {
        name: "mismatched linked row-key sets",
        mutate: (signal: {
          content: {
            linkedSourceRows: Array<{ tableId: string; sourceRow: number }>;
            linkedVisualLabels: Array<{ label: string; tableId: string; sourceRow: number }>;
          };
        }) => {
          signal.content.linkedVisualLabels[0]!.sourceRow = 3;
        },
      },
      {
        name: "duplicate linked visual label row keys",
        mutate: (signal: {
          content: { linkedVisualLabels: Array<{ label: string; tableId: string; sourceRow: number }> };
        }) => {
          signal.content.linkedVisualLabels.push({ label: "duplicate", tableId: "table-a", sourceRow: 2 });
        },
      },
      {
        name: "duplicate linked source row keys",
        mutate: (signal: {
          content: { linkedSourceRows: Array<{ tableId: string; sourceRow: number }> };
        }) => {
          signal.content.linkedSourceRows.push({ tableId: "table-a", sourceRow: 2 });
        },
      },
      {
        name: "linked visual labels on a non-direction scope",
        mutate: (signal: { content: { scope: string; signalValue: string } }) => {
          signal.content.scope = "datum_chain";
          signal.content.signalValue = "ambiguous";
        },
      },
      {
        name: "an indicated direction without linked evidence",
        mutate: (signal: {
          content: {
            linkedSourceRows: Array<{ tableId: string; sourceRow: number }>;
            linkedVisualLabels: Array<{ label: string; tableId: string; sourceRow: number }>;
          };
        }) => {
          signal.content.linkedSourceRows = [];
          signal.content.linkedVisualLabels = [];
        },
      },
    ])("rejects $name in public image-text context review results", ({ mutate }) => {
      const result = structuredClone(rootResult);
      const worksheet = result.worksheets[0]!;
      const contextSignal = {
        statementId: "f5-context-signal-direction",
        type: "SIGNAL" as const,
        section: "tolerance-chain-validity" as const,
        content: {
          signalKind: "image_text_context_review" as const,
          scope: "direction" as string,
          signalValue: "indicated_consistent" as string,
          textBasis: "The visible direction label aligns with the factor description.",
          linkedSourceRows: [{ tableId: "table-a", sourceRow: 2 }],
          linkedVisualLabels: [{ label: "Bracket height", tableId: "table-a", sourceRow: 2 }],
          requiresEngineeringReview: true as const,
        },
      };
      worksheet.statements.push(contextSignal as typeof worksheet.statements[number]);
      result.summary.statementCount += 1;
      mutate(contextSignal);

      expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
    });

    it("requires unique and exactly matching F4/F3 source key sets at precise paths", () => {
      const expectIssuePath = (request: unknown, expectedPath: Array<string | number>) => {
        const parsed = f5DataInterpretationRequestSchema.safeParse(request);
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.issues.map(({ path }) => path)).toContainEqual(expectedPath);
        }
      };
      const factor = calculationCompletedResult.factors[0]!;
      const duplicateFactorRequest = structuredClone(rootRequest);
      duplicateFactorRequest.worksheets[0]!.calculationResult.factorCount = 2;
      duplicateFactorRequest.worksheets[0]!.calculationResult.factors.push(structuredClone(factor));
      expectIssuePath(duplicateFactorRequest, [
        "worksheets", 0, "calculationResult", "factors", 1, "source",
      ]);

      const duplicateGovernanceRequest = structuredClone(rootRequest);
      duplicateGovernanceRequest.worksheets[0]!.governanceRows.push({
        ...structuredClone(governanceRow),
        factorInstanceId: "a".repeat(64),
      });
      expectIssuePath(duplicateGovernanceRequest, ["worksheets", 0, "governanceRows", 1, "source"]);

      const missingGovernanceRequest = structuredClone(rootRequest);
      missingGovernanceRequest.worksheets[0]!.governanceRows = [];
      expectIssuePath(missingGovernanceRequest, [
        "worksheets", 0, "calculationResult", "factors", 0, "source",
      ]);

      const extraGovernanceRequest = structuredClone(rootRequest);
      extraGovernanceRequest.worksheets[0]!.governanceRows.push({
        ...structuredClone(governanceRow),
        factorInstanceId: "b".repeat(64),
        source: { ...governanceRow.source, sourceRow: 3 },
      });
      expectIssuePath(extraGovernanceRequest, ["worksheets", 0, "governanceRows", 1, "source"]);
    });

    it("accepts a completed root result with all five fixed sections", () => {
      const parsed = f5DataInterpretationResultSchema.parse(rootResult);
      expect(parsed.worksheets[0]).toMatchObject({
        sections: {
          toleranceChainValidity: { status: "not_evaluated" },
          capabilityVsSpecification: {
            status: "supported",
            statementIds: completedWorksheet.sections.capabilityVsSpecification.statementIds,
          },
          majorContributors: { status: "supported", items: [contributorItem] },
          reasonableToleranceRange: { status: "delegated_to_f6" },
          designOptimizationAndParallelOptions: { status: "delegated_to_f6" },
        },
      });
      expect(f5DataInterpretationResultSchema.safeParse({ ...rootResult, outputClassification: "public" }).success).toBe(false);
      expect(f5DataInterpretationResultSchema.safeParse({ ...rootResult, unexpected: true }).success).toBe(false);
    });

    function completedResultWithContextSignals(
      scopes: ReadonlyArray<(typeof coreScopes)[number]>,
      contextual = true,
    ) {
      const result = structuredClone(rootResult);
      const worksheet = result.worksheets[0]!;
      if (contextual) {
        worksheet.observationVersion = "f5-image-observation-v2";
        worksheet.contextSnapshot = {
          dimensionDescription: worksheet.governanceRows[0]!.dimensionDescription,
          rows: worksheet.governanceRows.map((row) => ({
            tableId: row.source.tableId,
            sourceRow: row.source.sourceRow,
            factorOrdinal: structuredClone(row.factorOrdinal!),
            partName: row.partSubsystem,
            partSubsystem: row.partSubsystem,
            partCategory: row.partCategory,
            factorName: row.factorDescription,
            factorDescription: row.factorDescription,
            nominal: row.nominal,
            upperTolerance: row.upperTolerance,
            lowerTolerance: row.lowerTolerance,
            sigmaLevel: row.sigmaLevel,
            sourceCells: structuredClone(row.source.sourceCells),
          })),
        };
      }
      const contextSignals = scopes.map((scope, index) => ({
        statementId: `f5-context-signal-${scope}-${index}`,
        type: "SIGNAL" as const,
        section: "tolerance-chain-validity" as const,
        content: {
          signalKind: "image_text_context_review" as const,
          scope,
          signalValue: "ambiguous" as const,
          textBasis: `Image and worksheet context require review for ${scope}.`,
          linkedSourceRows: [],
          linkedVisualLabels: [],
          visualEvidence: {
            observedValue: "ambiguous" as const,
            confidence: "medium" as const,
            visibleBasis: `Visible evidence requires review for ${scope}.`,
            visibleLabels: [],
            reviewStatus: "unreviewed" as const,
            imageReference: structuredClone(imageReference),
          },
          requiresEngineeringReview: true as const,
        },
      }));
      worksheet.statements.push(...contextSignals);
      result.summary.statementCount += contextSignals.length;
      return result;
    }

    it("requires observationVersion and contextSnapshot together on completed v2 worksheet results", () => {
      const v2Result = completedResultWithContextSignals(coreScopes);

      expect(f5DataInterpretationResultSchema.safeParse(v2Result).success).toBe(true);

      const withoutSnapshot = structuredClone(v2Result) as Record<string, unknown>;
      delete ((withoutSnapshot.worksheets as Array<Record<string, unknown>>)[0]!).contextSnapshot;
      expect(f5DataInterpretationResultSchema.safeParse(withoutSnapshot).success).toBe(false);

      const withoutVersion = structuredClone(v2Result) as Record<string, unknown>;
      delete ((withoutVersion.worksheets as Array<Record<string, unknown>>)[0]!).observationVersion;
      expect(f5DataInterpretationResultSchema.safeParse(withoutVersion).success).toBe(false);
    });

    it("rejects completed v2 worksheet results with zero or incomplete context signals", () => {
      expect(f5DataInterpretationResultSchema.safeParse(
        completedResultWithContextSignals([]),
      ).success).toBe(false);
      expect(f5DataInterpretationResultSchema.safeParse(
        completedResultWithContextSignals(coreScopes.slice(0, -1)),
      ).success).toBe(false);
    });

    it("rejects completed v2 worksheet results with duplicate or extra context signals", () => {
      expect(f5DataInterpretationResultSchema.safeParse(
        completedResultWithContextSignals([
          ...coreScopes.slice(0, -1),
          "stack_start",
        ]),
      ).success).toBe(false);
      expect(f5DataInterpretationResultSchema.safeParse(
        completedResultWithContextSignals([...coreScopes, "direction"]),
      ).success).toBe(false);
    });

    it("accepts exactly five completed v2 context signals with the exact core scopes", () => {
      expect(f5DataInterpretationResultSchema.safeParse(
        completedResultWithContextSignals(coreScopes),
      ).success).toBe(true);
    });

    it("binds completed v2 snapshot provenance to governance rows while preserving original text provenance", () => {
      const validResult = completedResultWithContextSignals(coreScopes);
      const snapshot = validResult.worksheets[0]!.contextSnapshot!;

      expect(snapshot.dimensionDescription).toBe(governanceRow.dimensionDescription);
      expect(snapshot.rows[0]!.partName).toBe(governanceRow.partSubsystem);
      expect(snapshot.rows[0]!.factorName).toBe(governanceRow.factorDescription);
      expect(f5DataInterpretationResultSchema.safeParse(validResult).success).toBe(true);

      const missingRow = structuredClone(validResult);
      missingRow.worksheets[0]!.contextSnapshot!.rows = [];
      expect(f5DataInterpretationResultSchema.safeParse(missingRow).success).toBe(false);

      const extraRow = structuredClone(validResult);
      extraRow.worksheets[0]!.contextSnapshot!.rows.push({
        ...structuredClone(extraRow.worksheets[0]!.contextSnapshot!.rows[0]!),
        sourceRow: 99,
      });
      expect(f5DataInterpretationResultSchema.safeParse(extraRow).success).toBe(false);
    });

    it.each([
      ["partName", (result: ReturnType<typeof completedResultWithContextSignals>) => {
        result.worksheets[0]!.contextSnapshot!.rows[0]!.partName = "changed original part";
      }],
      ["partSubsystem", (result: ReturnType<typeof completedResultWithContextSignals>) => {
        result.worksheets[0]!.contextSnapshot!.rows[0]!.partSubsystem = "changed subsystem";
      }],
      ["partCategory", (result: ReturnType<typeof completedResultWithContextSignals>) => {
        result.worksheets[0]!.contextSnapshot!.rows[0]!.partCategory = "changed category";
      }],
      ["factorName", (result: ReturnType<typeof completedResultWithContextSignals>) => {
        result.worksheets[0]!.contextSnapshot!.rows[0]!.factorName = "changed original factor";
      }],
      ["factorDescription", (result: ReturnType<typeof completedResultWithContextSignals>) => {
        result.worksheets[0]!.contextSnapshot!.rows[0]!.factorDescription = "changed factor";
      }],
      ["nominal", (result: ReturnType<typeof completedResultWithContextSignals>) => {
        result.worksheets[0]!.contextSnapshot!.rows[0]!.nominal = 999;
      }],
      ["upperTolerance", (result: ReturnType<typeof completedResultWithContextSignals>) => {
        result.worksheets[0]!.contextSnapshot!.rows[0]!.upperTolerance = 999;
      }],
      ["lowerTolerance", (result: ReturnType<typeof completedResultWithContextSignals>) => {
        result.worksheets[0]!.contextSnapshot!.rows[0]!.lowerTolerance = -999;
      }],
      ["sigmaLevel", (result: ReturnType<typeof completedResultWithContextSignals>) => {
        result.worksheets[0]!.contextSnapshot!.rows[0]!.sigmaLevel = 999;
      }],
      ["sourceCells", (result: ReturnType<typeof completedResultWithContextSignals>) => {
        result.worksheets[0]!.contextSnapshot!.rows[0]!.sourceCells = { factorName: "Analysis-A!Z99" };
      }],
    ] as const)("rejects completed v2 snapshot %s changes", (_field, mutate) => {
      const result = completedResultWithContextSignals(coreScopes);
      mutate(result);

      expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
    });

    it("rejects completed v2 snapshot dimension provenance changes", () => {
      const result = completedResultWithContextSignals(coreScopes);
      result.worksheets[0]!.contextSnapshot!.dimensionDescription = "Changed dimension";

      expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
    });

    it("rejects completed v2 context SIGNAL links outside the bound snapshot", () => {
      const result = completedResultWithContextSignals(coreScopes);
      const direction = result.worksheets[0]!.statements.find((statement) => (
        statement.type === "SIGNAL"
        && "signalKind" in statement.content
        && statement.content.signalKind === "image_text_context_review"
        && statement.content.scope === "direction"
      ))!;
      if (direction.type !== "SIGNAL" || !("linkedSourceRows" in direction.content)) {
        throw new Error("Expected direction context SIGNAL fixture.");
      }
      direction.content.linkedSourceRows = [{ tableId: "table-a", sourceRow: 99 }];
      direction.content.linkedVisualLabels = [{ label: "outside", tableId: "table-a", sourceRow: 99 }];

      expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
    });

    it("binds completed v2 direction context labels to the same SIGNAL visual evidence", () => {
      const createLinkedResult = () => {
        const result = completedResultWithContextSignals(coreScopes);
        const worksheet = result.worksheets[0]!;
        const directionSignal = worksheet.statements.find((statement) => (
          statement.type === "SIGNAL"
          && "signalKind" in statement.content
          && statement.content.signalKind === "image_text_context_review"
          && statement.content.scope === "direction"
        ))!;
        if (directionSignal.type !== "SIGNAL" || !("linkedSourceRows" in directionSignal.content)) {
          throw new Error("Expected direction context SIGNAL fixture.");
        }
        directionSignal.content.signalValue = "indicated_consistent";
        directionSignal.content.linkedSourceRows = [{ tableId: "table-a", sourceRow: 2 }];
        directionSignal.content.linkedVisualLabels = [{
          label: "factor-1",
          tableId: "table-a",
          sourceRow: 2,
        }];
        Object.assign(directionSignal.content, {
          visualEvidence: {
            observedValue: "visible",
            confidence: "medium",
            visibleBasis: "The direction label is visible in the controlled worksheet image.",
            visibleLabels: ["factor-1"],
            reviewStatus: "unreviewed",
            imageReference: structuredClone(imageReference),
          },
        });
        return { result, directionSignal };
      };

      const valid = createLinkedResult();
      expect(f5DataInterpretationResultSchema.safeParse(valid.result).success).toBe(true);

      const invented = createLinkedResult();
      invented.directionSignal.content.linkedVisualLabels[0]!.label = "invented";
      expect(f5DataInterpretationResultSchema.safeParse(invented.result).success).toBe(false);

      const imageMismatch = createLinkedResult();
      const mismatchedEvidence = imageMismatch.directionSignal.content as unknown as {
        visualEvidence: { imageReference: { contentHash: string } };
      };
      mismatchedEvidence.visualEvidence.imageReference.contentHash = "0".repeat(64);
      expect(f5DataInterpretationResultSchema.safeParse(imageMismatch.result).success).toBe(false);

      const malformedConfirmation = createLinkedResult();
      const malformedEvidence = malformedConfirmation.directionSignal.content as unknown as {
        visualEvidence: { reviewStatus: string };
      };
      malformedEvidence.visualEvidence.reviewStatus = "confirmed";
      expect(f5DataInterpretationResultSchema.safeParse(malformedConfirmation.result).success).toBe(false);

      const nonvisibleDirection = createLinkedResult();
      const nonvisibleEvidence = nonvisibleDirection.directionSignal.content as unknown as {
        visualEvidence: { observedValue: string };
      };
      nonvisibleEvidence.visualEvidence.observedValue = "ambiguous";
      expect(f5DataInterpretationResultSchema.safeParse(nonvisibleDirection.result).success).toBe(false);
    });

    it("forbids orphan image-text context signals on completed non-v2 worksheet results", () => {
      expect(f5DataInterpretationResultSchema.safeParse(
        completedResultWithContextSignals(["direction"], false),
      ).success).toBe(false);
    });

    it.each(toleranceItems.map(({ scope }) => scope))(
      "rejects %s tolerance evidence from a different structural scope",
      (scope) => {
        const result = structuredClone(rootResult);
        const worksheet = result.worksheets[0]!;
        worksheet.sections.toleranceChainValidity.status = "needs_review";
        const item = worksheet.sections.toleranceChainValidity.items.find((candidate) => candidate.scope === scope)!;
        item.status = "needs_review";
        item.relatedStatementIds = [rootStructuralSignal.statementId];
        item.clarificationIds = [];
        const imageFact = worksheet.statements.find(
          ({ statementId }) => statementId === rootImageFact.statementId,
        ) as typeof rootImageFact;
        imageFact.content.scope = scope === "stack_start" ? "direction" : "stack_start";

        expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
      },
    );

    it("requires tolerance clarifications to identify their structural scope", () => {
      const result = structuredClone(rootResult);
      delete (result.worksheets[0]!.clarifications[0] as { structuralScope?: string }).structuralScope;

      expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
    });

    it.each([
      "cp",
      "cpk",
      "rss_sigma",
      "total_dpm",
      "yield",
      "lower_spec_limit",
      "upper_spec_limit",
      "target_cpk",
      "target_sigma",
      "recommended_method",
      "achieved_sigma",
    ] as const)("rejects a capability section missing %s", (metric) => {
      const result = completeCapabilityResult();
      const worksheet = result.worksheets[0]!;
      const removed = worksheet.statements.find(
        (statement) => statement.type === "FACT" && statement.content.metric === metric,
      )!;
      worksheet.statements = worksheet.statements.filter(({ statementId }) => statementId !== removed.statementId);
      worksheet.sections.capabilityVsSpecification.statementIds = worksheet.sections.capabilityVsSpecification.statementIds.filter(
        (statementId) => statementId !== removed.statementId,
      );
      result.summary.statementCount -= 1;

      expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
    });

    it.each([
      ["cpk value", "cpk", (content: Record<string, unknown>) => { content.value = -123; }],
      ["cpk outputField", "cpk", (content: Record<string, unknown>) => { content.outputField = "capability.cp"; }],
      ["cpk formulaId", "cpk", (content: Record<string, unknown>) => {
        (content.traceRecords as Array<Record<string, unknown>>)[0]!.formulaId = "cp-v1";
      }],
      ["target inputField", "target_cpk", (content: Record<string, unknown>) => { content.inputField = "capability.targetSigmaLevel"; }],
      ["recommended method", "recommended_method", (content: Record<string, unknown>) => { content.method = "rss_1d"; }],
      ["achieved sourceOutputFields", "achieved_sigma", (content: Record<string, unknown>) => {
        content.sourceOutputFields = ["capability.lowerZ", "capability.lowerZ"];
      }],
    ] as const)("rejects capability %s tampering", (_label, metric, mutate) => {
      const result = completeCapabilityResult();
      const fact = result.worksheets[0]!.statements.find(
        (statement) => statement.type === "FACT" && statement.content.metric === metric,
      )!;
      mutate(fact.content as unknown as Record<string, unknown>);

      expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
    });

    it.each(["large_tolerance", "mid_chain_amplification"])(
      "rejects unimplemented contributor reason code %s",
      (reasonCode) => {
        const result = structuredClone(rootResult);
        result.worksheets[0]!.sections.majorContributors.items[0]!.reasonCodes = [reasonCode];

        const parsed = f5DataInterpretationResultSchema.safeParse(result);
        expect(parsed.success).toBe(false);
      },
    );

    it.each([
      ["confidence", "medium"],
      ["confidence", "low"],
      ["reviewStatus", "rejected"],
    ] as const)("rejects root image FACT %s %s at the precise path", (field, value) => {
      const result = structuredClone(rootResult);
      const imageFactIndex = result.worksheets[0]!.statements.findIndex(
        ({ statementId }) => statementId === rootImageFact.statementId,
      );
      const imageFact = result.worksheets[0]!.statements[imageFactIndex] as typeof rootImageFact;
      (imageFact.content as Record<string, string>)[field] = value;

      const parsed = f5DataInterpretationResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "statements", imageFactIndex, "content", field,
        ]);
      }
    });

    it("allows medium confidence only as SIGNAL observation evidence", () => {
      const result = structuredClone(rootResult);
      (result.worksheets[0]!.sections.toleranceChainValidity as { status: string }).status = "needs_review";
      result.worksheets[0]!.sections.toleranceChainValidity.items = result.worksheets[0]!.sections.toleranceChainValidity.items.map((item) => (
        item.scope === "stack_start"
          ? { ...item, status: "needs_review", relatedStatementIds: [rootStructuralSignal.statementId], clarificationIds: [] }
          : item
      ));
      const signal = result.worksheets[0]!.statements.find(
        ({ statementId }) => statementId === rootStructuralSignal.statementId,
      ) as typeof rootStructuralSignal & { content: { observationEvidence?: unknown[] } };
      delete (signal.content as { triggerFactReferences?: string[] }).triggerFactReferences;
      signal.content.observationEvidence = [{
        ...imageObservation,
        imageReference,
      }];

      expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(true);
    });

    it("allows not_evaluated without image FACT only with a structural clarification", () => {
      const withoutObservation = structuredClone(rootResult);
      withoutObservation.worksheets[0]!.statements = withoutObservation.worksheets[0]!.statements.filter(
        ({ statementId }) => ![rootImageFact.statementId, rootStructuralSignal.statementId].includes(statementId),
      );
      withoutObservation.summary.statementCount -= 2;
      expect(f5DataInterpretationResultSchema.safeParse(withoutObservation).success).toBe(true);

      withoutObservation.worksheets[0]!.clarifications = [];
      withoutObservation.summary.clarificationCount = 0;
      const parsed = f5DataInterpretationResultSchema.safeParse(withoutObservation);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "sections", "toleranceChainValidity", "status",
        ]);
      }
    });

    it("requires image FACT evidence for supported and needs_review tolerance status", () => {
      for (const status of ["supported", "needs_review"] as const) {
        const result = structuredClone(rootResult);
        result.worksheets[0]!.sections.toleranceChainValidity.status = status;
        result.worksheets[0]!.sections.toleranceChainValidity.items = result.worksheets[0]!.sections.toleranceChainValidity.items.map((item) => ({
          ...item,
          status,
          relatedStatementIds: [],
          clarificationIds: [],
        }));
        result.worksheets[0]!.statements = result.worksheets[0]!.statements.filter(
          ({ statementId }) => ![rootImageFact.statementId, rootStructuralSignal.statementId].includes(statementId),
        );
        result.summary.statementCount -= 2;
        const parsed = f5DataInterpretationResultSchema.safeParse(result);
        expect(parsed.success, status).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
            "worksheets", 0, "sections", "toleranceChainValidity", "status",
          ]);
        }
      }

      const supported = structuredClone(rootResult);
      supported.worksheets[0]!.sections.toleranceChainValidity.status = "supported";
      const supportedFacts = structuralScopes.map((scope) => ({
        ...structuredClone(rootImageFact),
        statementId: scope === "stack_start" ? rootImageFact.statementId : `root-fact-image-${scope}`,
        content: { ...structuredClone(rootImageFact.content), scope },
      }));
      supported.worksheets[0]!.statements.push(...supportedFacts.filter(({ content }) => content.scope !== "stack_start"));
      supported.summary.statementCount = supported.worksheets[0]!.statements.length;
      supported.worksheets[0]!.sections.toleranceChainValidity.items = supported.worksheets[0]!.sections.toleranceChainValidity.items.map((item) => {
        const fact = supportedFacts.find(({ content }) => content.scope === item.scope)!;
        return {
          ...item,
          status: "supported",
          relatedStatementIds: [fact.statementId],
          clarificationIds: [],
        };
      });
      expect(f5DataInterpretationResultSchema.parse(supported)).toEqual(supported);

      const needsReview = structuredClone(rootResult);
      needsReview.worksheets[0]!.sections.toleranceChainValidity.status = "needs_review";
      needsReview.worksheets[0]!.sections.toleranceChainValidity.items = needsReview.worksheets[0]!.sections.toleranceChainValidity.items.map((item) => (
        item.scope === "stack_start"
          ? { ...item, status: "needs_review", relatedStatementIds: [rootImageFact.statementId, rootStructuralSignal.statementId], clarificationIds: [] }
          : item
      ));
      expect(f5DataInterpretationResultSchema.safeParse(needsReview).success).toBe(true);

      const unrelatedFact = structuredClone(needsReview);
      const signalIndex = unrelatedFact.worksheets[0]!.statements.findIndex(
        ({ statementId }) => statementId === rootStructuralSignal.statementId,
      );
      const signal = unrelatedFact.worksheets[0]!.statements[signalIndex] as typeof rootStructuralSignal;
      signal.content.triggerFactReferences = [contributorFact.statementId];
      const parsed = f5DataInterpretationResultSchema.safeParse(unrelatedFact);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "statements", signalIndex, "content", "triggerFactReferences", 0,
        ]);
      }
    });

    it("does not count rejected image FACT evidence for supported or needs_review tolerance status", () => {
      for (const status of ["supported", "needs_review"] as const) {
        const result = structuredClone(rootResult);
        result.worksheets[0]!.sections.toleranceChainValidity.status = status;
        const imageFact = result.worksheets[0]!.statements.find(
          ({ statementId }) => statementId === rootImageFact.statementId,
        ) as typeof rootImageFact;
        imageFact.content.reviewStatus = "rejected";

        const parsed = f5DataInterpretationResultSchema.safeParse(result);
        expect(parsed.success, status).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
            "worksheets", 0, "sections", "toleranceChainValidity", "status",
          ]);
        }
      }

    });

    it("does not allow any SIGNAL to reference a rejected image FACT", () => {
      for (const signalId of [rootStructuralSignal.statementId, rootGovernanceSignal.statementId]) {
        const result = structuredClone(rootResult);
        const imageFact = result.worksheets[0]!.statements.find(
          ({ statementId }) => statementId === rootImageFact.statementId,
        ) as typeof rootImageFact;
        imageFact.content.reviewStatus = "rejected";
        const signalIndex = result.worksheets[0]!.statements.findIndex(
          ({ statementId }) => statementId === signalId,
        );
        const signal = result.worksheets[0]!.statements[signalIndex] as typeof rootStructuralSignal;
        signal.content.triggerFactReferences = [rootImageFact.statementId];

        const parsed = f5DataInterpretationResultSchema.safeParse(result);
        expect(parsed.success, signalId).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
            "worksheets", 0, "statements", signalIndex, "content", "triggerFactReferences", 0,
          ]);
        }
      }
    });

    it("requires a unique governance snapshot with the same source set as F4 factors", () => {
      const duplicateFactor = structuredClone(rootResult);
      duplicateFactor.worksheets[0]!.calculationResult.factorCount = 2;
      duplicateFactor.worksheets[0]!.calculationResult.factors.push(
        structuredClone(duplicateFactor.worksheets[0]!.calculationResult.factors[0]!),
      );
      const duplicateFactorParsed = f5DataInterpretationResultSchema.safeParse(duplicateFactor);
      expect(duplicateFactorParsed.success).toBe(false);
      if (!duplicateFactorParsed.success) {
        expect(duplicateFactorParsed.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "calculationResult", "factors", 1, "source",
        ]);
      }

      const duplicate = structuredClone(rootResult);
      duplicate.worksheets[0]!.governanceRows.push({
        ...structuredClone(governanceRow),
        factorInstanceId: "a".repeat(64),
      });
      const duplicateParsed = f5DataInterpretationResultSchema.safeParse(duplicate);
      expect(duplicateParsed.success).toBe(false);
      if (!duplicateParsed.success) {
        expect(duplicateParsed.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "governanceRows", 1, "source",
        ]);
      }

      const missing = structuredClone(rootResult);
      missing.worksheets[0]!.governanceRows = [];
      const missingParsed = f5DataInterpretationResultSchema.safeParse(missing);
      expect(missingParsed.success).toBe(false);
      if (!missingParsed.success) {
        expect(missingParsed.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "calculationResult", "factors", 0, "source",
        ]);
      }

      const wrongWorksheet = structuredClone(rootResult);
      wrongWorksheet.worksheets[0]!.governanceRows[0]!.source.worksheetName = "Analysis-B";
      const wrongWorksheetParsed = f5DataInterpretationResultSchema.safeParse(wrongWorksheet);
      expect(wrongWorksheetParsed.success).toBe(false);
      if (!wrongWorksheetParsed.success) {
        expect(wrongWorksheetParsed.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "governanceRows", 0, "source",
        ]);
      }
    });

    it("rejects every completed governance image identity tamper at its exact path", () => {
      const mutations = [
        { field: "worksheetName", value: "Analysis-B" },
        { field: "relativePath", value: "worksheets/Analysis-A/other.png" },
        { field: "contentHash", value: "0".repeat(64) },
      ] as const;
      for (const { field, value } of mutations) {
        const result = structuredClone(rootResult);
        result.worksheets[0]!.governanceRows[0]!.imageReference = {
          ...result.worksheets[0]!.governanceRows[0]!.imageReference,
          [field]: value,
        };
        const parsed = f5DataInterpretationResultSchema.safeParse(result);
        expect(parsed.success, field).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
            "worksheets", 0, "governanceRows", 0, "imageReference", field,
          ]);
        }
      }
    });

    it("rejects every contributor governance provenance field tamper at its exact path", () => {
      const mutations = [
        { field: "drawingNumber", value: "DRAW-FAKE" },
        { field: "dimId", value: "999" },
        { field: "governanceStatus", value: "needs_governance" },
      ] as const;
      for (const { field, value } of mutations) {
        const result = structuredClone(rootResult);
        result.worksheets[0]!.sections.majorContributors.items[0]![field] = value;
        const parsed = f5DataInterpretationResultSchema.safeParse(result);
        expect(parsed.success, field).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
            "worksheets", 0, "sections", "majorContributors", "items", 0, field,
          ]);
        }
      }

      const result = structuredClone(rootResult) as unknown as {
        worksheets: Array<{ sections: { majorContributors: { items: Array<Record<string, unknown>> } } }>;
      };
      result.worksheets[0]!.sections.majorContributors.items[0]!.partNumber = "PART-FAKE";
      const parsed = f5DataInterpretationResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "sections", "majorContributors", "items", 0, "partNumber",
        ]);
      }
    });

    it("requires strict contributor coverage and matching FACT/source evidence", () => {
      const invalidItems = [
        [],
        [{ ...contributorItem, factorReference: "Analysis-A/table-a/3" }],
        [{ ...contributorItem, source: { ...contributorItem.source, sourceRow: 3 } }],
        [{ ...contributorItem, relatedStatementIds: [rootFacts[0]!.statementId] }],
        [{ ...contributorItem, factorIndex: 1 }],
      ];
      for (const items of invalidItems) {
        const result = structuredClone(rootResult);
        result.worksheets[0]!.sections.majorContributors.items = items;
        expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
      }
    });

    it("matches every contributor directly to its F4 factor", () => {
      const mutations = [
        {
          mutate: (result: typeof rootResult) => { result.worksheets[0]!.sections.majorContributors.items[0]!.factorName = "Feature-B"; },
          path: ["worksheets", 0, "sections", "majorContributors", "items", 0, "factorName"],
        },
        {
          mutate: (result: typeof rootResult) => { result.worksheets[0]!.sections.majorContributors.items[0]!.source.sourceRow = 3; },
          path: ["worksheets", 0, "sections", "majorContributors", "items", 0, "source"],
        },
        {
          mutate: (result: typeof rootResult) => { result.worksheets[0]!.sections.majorContributors.items[0]!.factorReference = "Analysis-A/table-a/3"; },
          path: ["worksheets", 0, "sections", "majorContributors", "items", 0, "factorReference"],
        },
        {
          mutate: (result: typeof rootResult) => { result.worksheets[0]!.sections.majorContributors.items[0]!.contributionPercent = 99; },
          path: ["worksheets", 0, "sections", "majorContributors", "items", 0, "contributionPercent"],
        },
        {
          mutate: (result: typeof rootResult) => { result.worksheets[0]!.calculationResult.worksheetSelection.worksheetName = "Analysis-B"; },
          path: ["worksheets", 0, "calculationResult", "worksheetSelection", "worksheetName"],
        },
        {
          mutate: (result: typeof rootResult) => { result.worksheets[0]!.calculationResult.workbookContentHash = "0".repeat(64); },
          path: ["worksheets", 0, "calculationResult", "workbookContentHash"],
        },
      ] as const;
      for (const { mutate, path } of mutations) {
        const result = structuredClone(rootResult);
        mutate(result);
        const parsed = f5DataInterpretationResultSchema.safeParse(result);
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.issues.map((issue) => issue.path)).toContainEqual(path);
        }
      }
    });

    it("requires contributor order by percentage and factorIndex for ties", () => {
      const secondFact = structuredClone(contributorFact);
      secondFact.statementId = "fact-factor-contribution-second";
      secondFact.content.factorReference = "Analysis-A/table-a/3";
      secondFact.content.contributionPercent = 40;
      secondFact.content.outputField = "factors[1].contribution";
      secondFact.content.traceRecords[0]!.outputField = "factors[1].contribution";
      const secondItem = {
        ...contributorItem,
        factorReference: "Analysis-A/table-a/3",
        factorName: "Feature-B",
        factorIndex: 1,
        contributionPercent: 40,
        source: { ...contributorItem.source, sourceRow: 3 },
        relatedStatementIds: [secondFact.statementId],
      };

      for (const [factContribution, items] of [
        [40, [secondItem, contributorItem]],
        [100, [{ ...secondItem, contributionPercent: 100 }, contributorItem]],
      ] as const) {
        const result = structuredClone(rootResult);
        const fact = structuredClone(secondFact);
        fact.content.contributionPercent = factContribution;
        result.worksheets[0]!.statements.push(fact);
        result.worksheets[0]!.sections.majorContributors.items = structuredClone(items);
        result.summary.statementCount += 1;
        expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
      }
    });

    it("requires supported capability to list existing capability FACT or RULE statements", () => {
      for (const statementIds of [[], [rootOption.statementId], ["missing-statement"]]) {
        const result = structuredClone(rootResult);
        result.worksheets[0]!.sections.capabilityVsSpecification.statementIds = statementIds;
        expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
      }
    });

    it("rejects duplicate valid capability statement IDs at the statementIds path", () => {
      const result = completeCapabilityResult();
      const statementIds = result.worksheets[0]!.sections.capabilityVsSpecification.statementIds;
      statementIds[0] = statementIds[1]!;

      const parsed = f5DataInterpretationResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "sections", "capabilityVsSpecification", "statementIds",
        ]);
      }
    });

    it("reports assumption confirmation issues at each missing or illegal field", () => {
      const confirmedAssumption = {
        ...completedWorksheet.assumptions[0],
        status: "confirmed" as const,
        confirmedBy: "controlled-reviewer",
        confirmedAt: "2026-08-11T08:00:00.000Z",
      };
      for (const field of ["confirmedBy", "confirmedAt"] as const) {
        const result = structuredClone(rootResult);
        result.worksheets[0]!.assumptions[0] = structuredClone(confirmedAssumption);
        delete result.worksheets[0]!.assumptions[0]![field];
        const parsed = f5DataInterpretationResultSchema.safeParse(result);
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
            "worksheets", 0, "assumptions", 0, field,
          ]);
        }
      }

      const result = structuredClone(rootResult);
      result.worksheets[0]!.assumptions[0] = { ...confirmedAssumption, status: "proposed" };
      const parsed = f5DataInterpretationResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const paths = parsed.error.issues.map(({ path }) => path);
        expect(paths).toContainEqual(["worksheets", 0, "assumptions", 0, "confirmedBy"]);
        expect(paths).toContainEqual(["worksheets", 0, "assumptions", 0, "confirmedAt"]);
      }
    });

    it("accepts root image FACT and structural/governance SIGNAL statements", () => {
      expect(f5DataInterpretationResultSchema.parse(rootResult)).toEqual(rootResult);

      const mutations = [
        { statementId: rootImageFact.statementId, field: "section", value: "major-contributors" },
        { statementId: rootStructuralSignal.statementId, field: "section", value: "major-contributors" },
        { statementId: rootGovernanceSignal.statementId, field: "section", value: "tolerance-chain-validity" },
      ] as const;
      for (const mutation of mutations) {
        const result = structuredClone(rootResult);
        const statement = result.worksheets[0]!.statements.find(({ statementId }) => statementId === mutation.statementId)!;
        statement[mutation.field] = mutation.value as never;
        expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
      }
    });

    it("rejects governance FACT tampering and identifier SIGNAL references to contribution FACTs", () => {
      for (const field of ["source", "drawingNumber", "dimId", "dimIdStatus", "governanceStatus", "qualitySignals"] as const) {
        const result = structuredClone(rootResult);
        const governanceFactIndex = result.worksheets[0]!.statements.findIndex(
          ({ statementId }) => statementId === rootGovernanceFact.statementId,
        );
        const governanceFact = result.worksheets[0]!.statements[governanceFactIndex] as typeof rootGovernanceFact;
        if (field === "source") governanceFact.content.source.sourceRow = 3;
        else if (field === "qualitySignals") governanceFact.content.qualitySignals = ["duplicate_conflict"];
        else if (field === "dimIdStatus") governanceFact.content.dimIdStatus = "needs_confirmation";
        else if (field === "governanceStatus") governanceFact.content.governanceStatus = "needs_governance";
        else governanceFact.content[field] = `tampered-${field}` as never;
        const parsed = f5DataInterpretationResultSchema.safeParse(result);
        expect(parsed.success, field).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
            "worksheets", 0, "statements", governanceFactIndex, "content", field,
          ]);
        }
      }

      const result = structuredClone(rootResult);
      const signalIndex = result.worksheets[0]!.statements.findIndex(
        ({ statementId }) => statementId === rootGovernanceSignal.statementId,
      );
      const signal = result.worksheets[0]!.statements[signalIndex] as typeof rootGovernanceSignal;
      signal.content.triggerFactReferences = [contributorFact.statementId];
      const parsed = f5DataInterpretationResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "statements", signalIndex, "content", "triggerFactReferences", 0,
        ]);
      }
    });

    it("rejects root statement image identity and trigger FACT reference violations", () => {
      const wrongImage = structuredClone(rootResult);
      const imageFact = wrongImage.worksheets[0]!.statements.find(({ statementId }) => statementId === rootImageFact.statementId) as typeof rootImageFact;
      imageFact.content.imageReference = {
        ...imageFact.content.imageReference,
        relativePath: "worksheets/Analysis-A/other.png",
      };
      const wrongImageResult = f5DataInterpretationResultSchema.safeParse(wrongImage);
      expect(wrongImageResult.success).toBe(false);
      if (!wrongImageResult.success) {
        const imageFactIndex = rootResult.worksheets[0].statements.findIndex(({ statementId }) => statementId === rootImageFact.statementId);
        expect(wrongImageResult.error.issues.map(({ path }) => path)).toContainEqual([
          "worksheets", 0, "statements", imageFactIndex, "content", "imageReference",
        ]);
      }

      for (const [label, triggerFactReferences] of [
        ["empty", []],
        ["missing", ["missing-fact"]],
        ["non-FACT", [rootStructuralSignal.statementId]],
      ] as const) {
        const result = structuredClone(rootResult);
        const signal = result.worksheets[0]!.statements.find(({ statementId }) => statementId === rootStructuralSignal.statementId) as typeof rootStructuralSignal;
        signal.content.triggerFactReferences = [...triggerFactReferences];
        const parsed = f5DataInterpretationResultSchema.safeParse(result);
        expect(parsed.success, label).toBe(false);
      }
    });

    it("preserves RULE knowledge evidence and OPTION rank constraints", () => {
      for (const field of ["entryId", "effectiveVersion", "applicability", "evidence"] as const) {
        const result = structuredClone(rootResult);
        const rule = result.worksheets[0]!.statements.find((statement) => statement.type === "RULE") as { content: Record<string, unknown> };
        delete rule.content[field];
        expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
      }

      const rankedOption = structuredClone(rootResult);
      const option = rankedOption.worksheets[0]!.statements.find((statement) => statement.type === "OPTION") as { content: { rank: unknown } };
      option.content.rank = 1;
      expect(f5DataInterpretationResultSchema.safeParse(rankedOption).success).toBe(false);
    });

    it("does not loosen existing FACT evidence constraints", () => {
      const result = structuredClone(rootResult);
      const cpk = result.worksheets[0]!.statements.find(
        (statement) => statement.type === "FACT" && statement.content.metric === "cpk",
      )!;
      cpk.section = "calculation-summary";
      expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
    });

    it("rejects F6 sections that are not delegated", () => {
      for (const section of ["reasonableToleranceRange", "designOptimizationAndParallelOptions"] as const) {
        const result = structuredClone(rootResult);
        result.worksheets[0]!.sections[section] = { status: "supported" } as never;
        expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(false);
      }
    });

    it("rejects summary and overall status inconsistencies", () => {
      expect(f5DataInterpretationResultSchema.safeParse({
        ...rootResult,
        summary: { ...rootResult.summary, statementCount: 5 },
      }).success).toBe(false);
      expect(f5DataInterpretationResultSchema.safeParse({
        ...rootResult,
        status: "partially_completed",
      }).success).toBe(false);

      const rejectedWorksheet = {
        worksheetName: "Analysis-B",
        status: "input_rejected" as const,
        reasonCode: "interpretation_failed" as const,
        artifactReference: "worksheet:Analysis-B",
      };
      expect(f5DataInterpretationResultSchema.safeParse({
        ...rootResult,
        status: "partially_completed",
        worksheets: [completedWorksheet, rejectedWorksheet],
        summary: {
          worksheetCount: 2,
          completedWorksheetCount: 1,
          inputRejectedWorksheetCount: 1,
          statementCount: completedWorksheet.statements.length,
          clarificationCount: completedWorksheet.clarifications.length,
          assumptionCount: 1,
        },
      }).success).toBe(true);

      expect(f5DataInterpretationResultSchema.safeParse({
        ...rootResult,
        status: "input_rejected",
        worksheets: [rejectedWorksheet],
        summary: {
          worksheetCount: 1,
          completedWorksheetCount: 0,
          inputRejectedWorksheetCount: 1,
          statementCount: 0,
          clarificationCount: 0,
          assumptionCount: 0,
        },
      }).success).toBe(true);
      expect(f5DataInterpretationResultSchema.safeParse({
        ...rootResult,
        status: "input_rejected",
        worksheets: [{ ...rejectedWorksheet, artifactReference: "C:\\private\\Analysis-B.xlsx" }],
        summary: {
          worksheetCount: 1,
          completedWorksheetCount: 0,
          inputRejectedWorksheetCount: 1,
          statementCount: 0,
          clarificationCount: 0,
          assumptionCount: 0,
        },
      }).success).toBe(false);
    });

    describe("F6 V2 input contracts", () => {
      const factorIdentity = {
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 14,
        factorName: "Bracket height",
        unit: "mm",
      };
      const baselineIdentity = {
        calculationVersion: "excel-ta-v1" as const,
        projectReference: "project-a",
        runReference: "run-a",
        workbookContentHash: "a".repeat(64),
        worksheetName: "Analysis-A",
        tableId: "table-a",
      };
      const evidence = {
        artifactReference: { artifact: "Feature4-Calculation.json", contentHash: "b".repeat(64) },
        worksheetName: "Analysis-A",
        sourceRows: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 14 }],
      };
      const targets = {
        contractVersion: "v1" as const,
        inputClassification: "confidential" as const,
        targetVersion: "f6-optimization-targets-v1" as const,
        workbookContentHash: "a".repeat(64),
        worksheets: [{
          worksheetName: "Analysis-A",
          tableId: "table-a",
          baselineIdentity,
          targets: [{
            targetId: "target-factor-a",
            targetType: "improvement_ratio" as const,
            factor: factorIdentity,
            ratio: 0.2,
            appliesTo: "tolerance_band" as const,
          }],
        }],
      };
      const analysisContext = {
        contractVersion: "v1" as const,
        inputClassification: "confidential" as const,
        contextVersion: "f6-analysis-context-v1" as const,
        workbookContentHash: "a".repeat(64),
        projectName: "Project A",
        worksheets: [{
          worksheetName: "Analysis-A",
          tableId: "table-a",
          baselineIdentity,
          analysisObject: {
            kind: "GAP" as const,
            name: "Bracket gap",
            physicalMeaning: "Clearance between bracket and cover.",
            measurementDirection: "Z",
            positiveDirectionDefinition: "Increasing clearance.",
            negativeDirectionDefinition: "Increasing interference.",
            evidence,
          },
          functionalRequirements: {
            requirementIds: ["REQ-1"],
            functionalBoundary: "No interference.",
            passFailCriteria: "LSL and USL must be met.",
            evidence: [evidence],
          },
          operatingConditions: [{
            conditionId: "condition-assembly",
            category: "ASSEMBLY" as const,
            description: "Nominal static assembly.",
            evidence,
          }],
          correlationRequirement: { mode: "INDEPENDENT" as const, evidence },
          loopDefinition: {
            start: "Bracket datum",
            end: "Cover surface",
            responseDirection: "Z",
            factors: [{ factor: factorIdentity, sign: 1 as const }],
            evidence: [evidence],
          },
        }],
      };
      const analysisContextV2 = {
        contractVersion: "v1" as const,
        inputClassification: "confidential" as const,
        contextVersion: "f6-analysis-context-v2" as const,
        workbookContentHash: "a".repeat(64),
        projectName: "Project A",
        worksheets: [
          {
            ...analysisContext.worksheets[0],
            engineeringNarrative: "Assembly preload and cosmetic flushness must both be protected.",
          },
        ],
      };
      const optimizationTargetsV2 = {
        contractVersion: "v1" as const,
        inputClassification: "confidential" as const,
        targetVersion: "f6-optimization-targets-v2" as const,
        workbookContentHash: "a".repeat(64),
        worksheets: [
          {
            worksheetName: "Analysis-A",
            tableId: "table-a",
            baselineIdentity,
            targets: [
              {
                targetId: "target-factor-nominal",
                targetType: "factor_nominal" as const,
                factor: factorIdentity,
                nominalValue: 1.25,
                unit: "mm",
              },
              {
                targetId: "target-system-mean",
                targetType: "system_mean_shift" as const,
                systemIdentity: {
                  baselineIdentity,
                  designNominal: 0,
                  mean: 0,
                  rssSigma: 0.05,
                  lowerSpecLimit: -0.1,
                  upperSpecLimit: 0.2,
                  targetCpk: 1,
                  traceReferences: [],
                },
                target: {
                  targetMean: 0.02,
                  unit: "mm",
                },
              },
              {
                targetId: "target-system-spec",
                targetType: "system_specification" as const,
                systemIdentity: {
                  baselineIdentity,
                  designNominal: 0,
                  mean: 0,
                  rssSigma: 0.05,
                  lowerSpecLimit: -0.1,
                  upperSpecLimit: 0.2,
                  targetCpk: 1,
                  traceReferences: [],
                },
                lowerSpecLimit: -0.1,
                upperSpecLimit: 0.2,
                unit: "mm",
              },
            ],
          },
        ],
      };
      const artifactReference = (artifact: string) => ({ artifact, contentHash: "b".repeat(64) });
      const modelInterpretation = {
        contractVersion: "v1" as const,
        inputClassification: "confidential" as const,
        interpretationVersion: "f6-model-interpretation-v1" as const,
        workbookContentHash: "a".repeat(64),
        generatedAt: "2026-09-04T12:00:00.000Z",
        worksheets: [{
          worksheetName: "Analysis-A",
          tableId: "table-a",
          baselineIdentity,
          sourceReferences: {
            f2: artifactReference("Feature2-Report.json"),
            f4: {
              ...artifactReference("Feature4-Calculation.json"),
              runId: "f4-run-a",
              calculationVersion: "excel-ta-v1" as const,
            },
            f5: {
              ...artifactReference("Feature5-Report.json"),
              interpretationVersion: "f5-data-interpretation-v1" as const,
            },
            image: {
              ...artifactReference("Analysis-A.png"),
              worksheetName: "Analysis-A",
            },
          },
          narrativeMarkdown: "主要风险由 {{calc:top-contribution}} 主导。",
          calculationClaims: [{
            claimId: "top-contribution",
            outputField: "factors[0].contribution",
            rawValue: 0.72,
            displayFormat: "percent" as const,
            unit: null,
          }],
          reviewStatus: "ME_REVIEW_REQUIRED" as const,
        }],
      };
      const f4Reference = {
        ...artifactReference("Feature4-Calculation.json"),
        runId: "f4-run-a",
        calculationVersion: "excel-ta-v1" as const,
      };
      const f5Reference = {
        ...artifactReference("Feature5-Report.json"),
        interpretationVersion: "f5-data-interpretation-v1" as const,
      };
      const modelInterpretationV2 = {
        contractVersion: "v1" as const,
        inputClassification: "confidential" as const,
        interpretationVersion: "f6-model-interpretation-v2" as const,
        workbookContentHash: "a".repeat(64),
        generatedAt: "2026-09-04T12:00:00.000Z",
        worksheets: [
          {
            worksheetName: "Analysis-A",
            tableId: "table-a",
            baselineIdentity,
            sourceReferences: {
              f2: artifactReference("Feature2-Report.json"),
              f4: f4Reference,
              f5: f5Reference,
              image: {
                ...artifactReference("Analysis-A.png"),
                worksheetName: "Analysis-A",
              },
            },
            narrativeMarkdown: "优先通过 {{calc:top-contribution}} 解决主要风险。",
            calculationClaims: [
              {
                claimId: "top-contribution",
                outputField: "factors[0].contribution",
                rawValue: 0.72,
                displayFormat: "percent" as const,
                unit: null,
              },
            ],
            optimizationAssessment: [
              {
                adjustmentClass: "factor_nominal" as const,
                disposition: "RECOMMENDED" as const,
                priority: 1,
                rationale: "Center the stack through the controlled locating factor.",
                factor: factorIdentity,
                evidenceReferences: [f4Reference],
              },
              {
                adjustmentClass: "system_mean_shift" as const,
                disposition: "CONSIDER" as const,
                priority: 2,
                rationale: "The governed mean is off center.",
                evidenceReferences: [f4Reference],
              },
              {
                adjustmentClass: "system_specification" as const,
                disposition: "INSUFFICIENT_EVIDENCE" as const,
                priority: 3,
                rationale: "Requirement authority is absent.",
                evidenceReferences: [f5Reference],
              },
              {
                adjustmentClass: "factor_tolerance" as const,
                disposition: "RECOMMENDED" as const,
                priority: 4,
                rationale: "Variance is concentrated.",
                factor: factorIdentity,
                evidenceReferences: [f4Reference],
              },
            ],
            reviewStatus: "ME_REVIEW_REQUIRED" as const,
          },
        ],
      };

      it("accepts strict identity-bound Optimization Targets and Analysis Context", () => {
        expect(f6OptimizationTargetsSchema.parse(targets)).toEqual(targets);
        expect(f6AnalysisContextSchema.parse(analysisContext)).toEqual(analysisContext);
        expect(f6OptimizationTargetsV1Schema.parse(targets)).toEqual(targets);
        expect(f6AnalysisContextV1Schema.parse(analysisContext)).toEqual(analysisContext);
      });

      it("accepts v2 analysis context and optimization targets through versioned and compatible schemas", () => {
        expect(f6AnalysisContextV2Schema.parse(analysisContextV2)).toEqual(analysisContextV2);
        expect(f6OptimizationTargetsV2Schema.parse(optimizationTargetsV2)).toEqual(optimizationTargetsV2);
        expect(f6AnalysisContextSchema.parse(analysisContextV2)).toEqual(analysisContextV2);
        expect(f6OptimizationTargetsSchema.parse(optimizationTargetsV2)).toEqual(optimizationTargetsV2);
      });

      it("accepts retained v1 target kinds in a v2 optimization targets artifact", () => {
        const optimizationTargetsV2WithRetainedKinds = {
          ...optimizationTargetsV2,
          worksheets: [
            {
              ...optimizationTargetsV2.worksheets[0],
              targets: [
                {
                  targetId: "target-factor-tolerance",
                  targetType: "factor_tolerance" as const,
                  factor: factorIdentity,
                  upperTolerance: 0.08,
                  lowerTolerance: -0.08,
                  unit: "mm",
                },
                {
                  targetId: "target-factor-sigma",
                  targetType: "factor_sigma" as const,
                  factor: factorIdentity,
                  sigma: 0.018,
                  unit: "mm",
                },
                {
                  targetId: "target-improvement-ratio",
                  targetType: "improvement_ratio" as const,
                  factor: factorIdentity,
                  ratio: 0.2,
                  appliesTo: "tolerance_band" as const,
                },
                {
                  targetId: "target-system-capability",
                  targetType: "system_target" as const,
                  systemIdentity: {
                    baselineIdentity,
                    designNominal: 0,
                    mean: 0,
                    rssSigma: 0.05,
                    lowerSpecLimit: -0.1,
                    upperSpecLimit: 0.2,
                    targetCpk: 1,
                    traceReferences: [],
                  },
                  target: {
                    targetCpk: 1.33,
                  },
                  apportionment: {
                    policy: "PROPORTIONAL" as const,
                    selectedFactors: [factorIdentity],
                  },
                },
              ],
            },
          ],
        };

        expect(f6OptimizationTargetsV2Schema.parse(optimizationTargetsV2WithRetainedKinds)).toEqual(optimizationTargetsV2WithRetainedKinds);
        expect(f6OptimizationTargetsSchema.parse(optimizationTargetsV2WithRetainedKinds)).toEqual(optimizationTargetsV2WithRetainedKinds);
      });

      it("rejects v2 mean/system target invariants and identity drift", () => {
        const worksheet = optimizationTargetsV2.worksheets[0];
        const meanTarget = worksheet.targets[1];
        const specificationTarget = worksheet.targets[2];
        expect(f6OptimizationTargetsV2Schema.safeParse({
          ...optimizationTargetsV2,
          worksheets: [{
            ...worksheet,
            targets: [
              worksheet.targets[0],
              {
                ...meanTarget,
                target: {
                  targetMean: 0.02,
                  resultingAdditionalMeanShift: -0.01,
                  unit: "mm",
                },
              },
              specificationTarget,
            ],
          }],
        }).success).toBe(false);
        expect(f6OptimizationTargetsV2Schema.safeParse({
          ...optimizationTargetsV2,
          worksheets: [{
            ...worksheet,
            targets: [
              worksheet.targets[0],
              meanTarget,
              {
                ...specificationTarget,
                lowerSpecLimit: undefined,
                upperSpecLimit: undefined,
              },
            ],
          }],
        }).success).toBe(false);
        expect(f6OptimizationTargetsV2Schema.safeParse({
          ...optimizationTargetsV2,
          worksheets: [{
            ...worksheet,
            targets: [
              {
                ...worksheet.targets[0],
                factor: { ...worksheet.targets[0].factor, tableId: "table-b" },
              },
              meanTarget,
              specificationTarget,
            ],
          }],
        }).success).toBe(false);
        expect(f6OptimizationTargetsV2Schema.safeParse({
          ...optimizationTargetsV2,
          worksheets: [{
            ...worksheet,
            baselineIdentity: { ...worksheet.baselineIdentity, worksheetName: "Analysis-B" },
          }],
        }).success).toBe(false);
      });

      it("rejects v2 system specification bounds that violate lower-less-than-upper after baseline composition", () => {
        const worksheet = optimizationTargetsV2.worksheets[0];
        const meanTarget = worksheet.targets[1];
        const specificationTarget = worksheet.targets[2];
        expect(f6OptimizationTargetsV2Schema.safeParse({
          ...optimizationTargetsV2,
          worksheets: [{
            ...worksheet,
            targets: [
              worksheet.targets[0],
              meanTarget,
              {
                ...specificationTarget,
                lowerSpecLimit: 0.3,
                upperSpecLimit: undefined,
              },
            ],
          }],
        }).success).toBe(false);
      });

      it("accepts a strict identity-bound freeform model interpretation", () => {
        expect(f6ModelInterpretationArtifactSchema.parse(modelInterpretation)).toEqual(modelInterpretation);
      });

      it("accepts v2 interpretation assessments with four governed adjustment classes", () => {
        expect(f6ModelInterpretationV2ArtifactSchema.parse(modelInterpretationV2)).toEqual(modelInterpretationV2);
      });

      it("rejects missing or duplicate assessment classes and duplicate priorities", () => {
        const worksheet = modelInterpretationV2.worksheets[0];
        expect(f6ModelInterpretationV2ArtifactSchema.safeParse({
          ...modelInterpretationV2,
          worksheets: [{
            ...worksheet,
            optimizationAssessment: worksheet.optimizationAssessment.slice(0, 3),
          }],
        }).success).toBe(false);
        expect(f6ModelInterpretationV2ArtifactSchema.safeParse({
          ...modelInterpretationV2,
          worksheets: [{
            ...worksheet,
            optimizationAssessment: [
              worksheet.optimizationAssessment[0],
              worksheet.optimizationAssessment[1],
              worksheet.optimizationAssessment[2],
              { ...worksheet.optimizationAssessment[3], adjustmentClass: "factor_nominal" },
            ],
          }],
        }).success).toBe(false);
        expect(f6ModelInterpretationV2ArtifactSchema.safeParse({
          ...modelInterpretationV2,
          worksheets: [{
            ...worksheet,
            optimizationAssessment: [
              worksheet.optimizationAssessment[0],
              worksheet.optimizationAssessment[1],
              worksheet.optimizationAssessment[2],
              { ...worksheet.optimizationAssessment[3], priority: 1 },
            ],
          }],
        }).success).toBe(false);
      });

      it("rejects invalid v2 assessment factor identity, rationale, unknown keys, and numeric override fields", () => {
        const worksheet = modelInterpretationV2.worksheets[0];
        const assessment = worksheet.optimizationAssessment[0];
        expect(f6ModelInterpretationV2ArtifactSchema.safeParse({
          ...modelInterpretationV2,
          worksheets: [{
            ...worksheet,
            optimizationAssessment: [
              {
                ...assessment,
                factor: { ...assessment.factor!, tableId: "table-b" },
              },
              ...worksheet.optimizationAssessment.slice(1),
            ],
          }],
        }).success).toBe(false);
        expect(f6ModelInterpretationV2ArtifactSchema.safeParse({
          ...modelInterpretationV2,
          worksheets: [{
            ...worksheet,
            optimizationAssessment: [
              { ...assessment, rationale: "" },
              ...worksheet.optimizationAssessment.slice(1),
            ],
          }],
        }).success).toBe(false);
        expect(f6ModelInterpretationV2ArtifactSchema.safeParse({
          ...modelInterpretationV2,
          worksheets: [{
            ...worksheet,
            optimizationAssessment: [
              { ...assessment, unexpected: true },
              ...worksheet.optimizationAssessment.slice(1),
            ],
          }],
        }).success).toBe(false);
        expect(f6ModelInterpretationV2ArtifactSchema.safeParse({
          ...modelInterpretationV2,
          worksheets: [{
            ...worksheet,
            optimizationAssessment: [
              { ...assessment, nominalValue: 1.25 },
              ...worksheet.optimizationAssessment.slice(1),
            ],
          }],
        }).success).toBe(false);
      });

      it("rejects invalid model interpretation identity, claims, placeholders, and unknown fields", () => {
        const worksheet = modelInterpretation.worksheets[0];
        expect(f6ModelInterpretationArtifactSchema.safeParse({ ...modelInterpretation, unknown: true }).success).toBe(false);
        expect(f6ModelInterpretationArtifactSchema.safeParse({ ...modelInterpretation, generatedAt: "not-a-date" }).success).toBe(false);
        expect(f6ModelInterpretationArtifactSchema.safeParse({
          ...modelInterpretation,
          worksheets: [{ ...worksheet, reviewStatus: "APPROVED" }],
        }).success).toBe(false);
        expect(f6ModelInterpretationArtifactSchema.safeParse({
          ...modelInterpretation,
          worksheets: [{
            ...worksheet,
            baselineIdentity: { ...worksheet.baselineIdentity, tableId: "table-b" },
          }],
        }).success).toBe(false);
        expect(f6ModelInterpretationArtifactSchema.safeParse({
          ...modelInterpretation,
          worksheets: [{
            ...worksheet,
            sourceReferences: {
              ...worksheet.sourceReferences,
              image: { ...worksheet.sourceReferences.image, worksheetName: "Analysis-B" },
            },
          }],
        }).success).toBe(false);
        expect(f6ModelInterpretationArtifactSchema.safeParse({
          ...modelInterpretation,
          worksheets: [worksheet, { ...worksheet }],
        }).success).toBe(false);
        expect(f6ModelInterpretationArtifactSchema.safeParse({
          ...modelInterpretation,
          worksheets: [{
            ...worksheet,
            narrativeMarkdown: "主要风险由 {{calc:unknown-claim}} 主导。",
          }],
        }).success).toBe(false);
        expect(f6ModelInterpretationArtifactSchema.safeParse({
          ...modelInterpretation,
          worksheets: [{
            ...worksheet,
            narrativeMarkdown: "非法标记 {{calc:Invalid_Id}}。",
            calculationClaims: [],
          }],
        }).success).toBe(false);
        expect(f6ModelInterpretationArtifactSchema.safeParse({
          ...modelInterpretation,
          worksheets: [{
            ...worksheet,
            narrativeMarkdown: `${worksheet.narrativeMarkdown} 再次引用 {{calc:top-contribution}}。`,
          }],
        }).success).toBe(false);
        expect(f6ModelInterpretationArtifactSchema.safeParse({
          ...modelInterpretation,
          worksheets: [{
            ...worksheet,
            calculationClaims: [{
              ...worksheet.calculationClaims[0],
              outputField: "system.unknown",
            }],
          }],
        }).success).toBe(false);
      });

      it("rejects invalid target ratios, duplicate IDs, and factor identity drift", () => {
        const worksheet = targets.worksheets[0];
        const target = worksheet.targets[0];
        expect(f6OptimizationTargetsSchema.safeParse({
          ...targets,
          worksheets: [{ ...worksheet, targets: [{ ...target, ratio: 1 }] }],
        }).success).toBe(false);
        expect(f6OptimizationTargetsSchema.safeParse({
          ...targets,
          worksheets: [{ ...worksheet, targets: [target, { ...target }] }],
        }).success).toBe(false);
        expect(f6OptimizationTargetsSchema.safeParse({
          ...targets,
          worksheets: [{
            ...worksheet,
            targets: [{ ...target, factor: { ...target.factor, worksheetName: "Analysis-B" } }],
          }],
        }).success).toBe(false);
      });

      it("rejects empty system targets, unbound context evidence, public data, and unknown keys", () => {
        const worksheet = targets.worksheets[0];
        expect(f6OptimizationTargetsSchema.safeParse({
          ...targets,
          worksheets: [{
            ...worksheet,
            targets: [{
              targetId: "system-target",
              targetType: "system_target",
              systemIdentity: {
                baselineIdentity,
                designNominal: 0,
                mean: 0,
                rssSigma: 0.05,
                lowerSpecLimit: -0.1,
                upperSpecLimit: 0.1,
                targetCpk: 1,
                traceReferences: [],
              },
              target: {},
              apportionment: { policy: "PROPORTIONAL", selectedFactors: [factorIdentity] },
            }],
          }],
        }).success).toBe(false);
        expect(f6AnalysisContextSchema.safeParse({
          ...analysisContext,
          worksheets: [{
            ...analysisContext.worksheets[0],
            analysisObject: {
              ...analysisContext.worksheets[0].analysisObject,
              evidence: { ...evidence, worksheetName: "Analysis-B" },
            },
          }],
        }).success).toBe(false);
        expect(f6OptimizationTargetsSchema.safeParse({ ...targets, inputClassification: "public" }).success).toBe(false);
        expect(f6AnalysisContextSchema.safeParse({ ...analysisContext, unknown: true }).success).toBe(false);
      });
    });

    describe("F6 optimization result v2", () => {
      const f6OptimizationResultSchema = f6OptimizationResultV2Schema;
      const artifactReference = (artifact: string) => ({ artifact, contentHash: "a".repeat(64) });
      const baselineIdentity = {
        calculationVersion: "excel-ta-v1" as const,
        projectReference: "project-a",
        runReference: "run-a",
        workbookContentHash: "b".repeat(64),
        worksheetName: "Analysis-A",
        tableId: "table-a",
      };
      const metrics = {
        mean: 0,
        rssSigma: 0.05,
        worstCaseLower: -0.2,
        worstCaseUpper: 0.2,
        cp: 1,
        cpk: 0.9,
        yield: 0.99,
        dpm: 10000,
      };
      const factor = {
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 14,
        factorName: "Factor A",
        unit: "mm",
      };
      const candidate = {
        optionId: "Analysis-A:candidate",
        status: "candidate" as const,
        reasonCode: "target_not_provided" as const,
        candidateFactors: [factor],
        requiredInputs: ["optimization_target"],
        calculationMethod: "Provide a governed target and rerun through F4.",
        baselineMetrics: metrics,
        impactRank: null,
      };
      const notProvided = { outcome: "NOT_PROVIDED" as const };
      const resultV2 = {
        contractVersion: "v1" as const,
        outputClassification: "confidential" as const,
        featureId: "F6" as const,
        optimizationVersion: "f6-optimization-v2" as const,
        runStatus: "COMPLETED" as const,
        workbook: { fileName: "Demo.xlsx", contentHash: "b".repeat(64) },
        provenance: {
          f2Reference: artifactReference("Feature2-Report.json"),
          f3Reference: artifactReference("Feature3-Report.json"),
          f4Reference: artifactReference("Feature4-Calculation.json"),
          f5Reference: artifactReference("Feature5-Report.json"),
          reportScope: { worksheetNames: ["Analysis-A"], blockedWorksheetNames: [] },
          supplierCapabilityDecision: notProvided,
          datumStrategyDecision: notProvided,
          costDecision: notProvided,
          analysisContextDecision: notProvided,
          optimizationTargetsDecision: notProvided,
        },
        worksheets: [{
          worksheetName: "Analysis-A",
          tableId: "table-a",
          runStatus: "COMPLETED" as const,
          baselineIdentity,
          baselineMetrics: metrics,
          targetCapability: { targetCpk: 1, targetSigmaLevel: 3, source: "WORKSHEET" as const },
          options: [candidate],
          highestImpactAction: null,
          findings: [],
          risks: [],
          recommendations: [],
          clarifications: [],
        }],
        summary: {
          worksheetCount: 1,
          completedWorksheetCount: 1,
          partiallyCompletedWorksheetCount: 0,
          inputRejectedWorksheetCount: 0,
          candidateOptionCount: 1,
          completedOptionCount: 0,
          insufficientEvidenceOptionCount: 0,
          calculationFailedOptionCount: 0,
        },
      };

      it("accepts a candidate-only completed V2 result and rejects V1", () => {
        expect(f6OptimizationResultSchema.parse(resultV2)).toEqual(resultV2);
        expect(f6OptimizationResultSchema.safeParse({ ...resultV2, optimizationVersion: "f6-optimization-v1" }).success).toBe(false);
      });

      it("keeps V2 readable while accepting strict sequential V3 without legacy options", () => {
        const resultV3 = {
          contractVersion: "v1" as const,
          outputClassification: "confidential" as const,
          featureId: "F6" as const,
          optimizationVersion: "f6-optimization-v3" as const,
          sequentialPolicyId: "f6-sequential-optimization-policy-v1" as const,
          interactionLanguage: { languageTag: "en-US", uiCatalogLanguage: "en" as const, lockedAtTurnId: "turn-1", source: "workflow_start" as const, fallbackUsed: false },
          runStatus: "COMPLETED" as const,
          workbook: { fileName: "Demo.xlsx", contentHash: "b".repeat(64) },
          worksheets: [{
            worksheetName: "Analysis-A",
            tableId: "table-a",
            runStatus: "COMPLETED" as const,
            baselineIdentity,
            steps: [
              { step: "centerAssessment" as const, status: "aligned" as const, adjustedMean: 0, specificationMidpoint: 0, offset: 0 },
              { step: "contributorPriorities" as const, priorities: [{ rank: 1, factor, contribution: 0.7, guidance: "tighten_tolerance" as const }] },
              { step: "specificationChanges" as const, proposals: [], clarifications: [] },
            ],
          }],
          summary: { worksheetCount: 1, completedWorksheetCount: 1, clarificationRequiredWorksheetCount: 0 },
          provenance: {
            f2Reference: artifactReference("Feature2-Report.json"),
            f3Reference: artifactReference("Feature3-Report.json"),
            f4Reference: artifactReference("Feature4-Calculation.json"),
            f5Reference: artifactReference("Feature5-Report.json"),
            multimodalReference: artifactReference("Feature5-Multimodal.json"),
            reportScope: { worksheetNames: ["Analysis-A"], blockedWorksheetNames: [] },
          },
        };

        expect(f6OptimizationResultV2Schema.parse(resultV2)).toEqual(resultV2);
        expect(f6ReadableOptimizationResultSchema.parse(resultV2)).toEqual(resultV2);
        expect(f6OptimizationResultV3Schema.parse(resultV3)).toEqual(resultV3);
        expect(f6NewOptimizationResultSchema.parse(resultV3)).toEqual(resultV3);
        expect(f6NewOptimizationResultSchema.safeParse(resultV2).success).toBe(false);
        expect(f6ReadableOptimizationResultSchema.parse(resultV3)).toEqual(resultV3);
        expect(f6OptimizationResultV3Schema.safeParse(resultV2).success).toBe(false);
        for (const legacy of [
          { optionCode: "OP1" },
          { optionSource: "BUILT_IN_POLICY" },
          { policyContext: { reductionRatio: 0.25 } },
          { ratio: 0.25 },
          { ratios: [0.25, 0.1, 0.1] },
          { optionName: "OP2" },
        ]) {
          expect(f6OptimizationResultV3Schema.safeParse({ ...resultV3, ...legacy }).success).toBe(false);
        }
        expect(f6OptimizationResultV3Schema.safeParse({
          ...resultV3,
          worksheets: [{ ...resultV3.worksheets[0], steps: [{ ...resultV3.worksheets[0].steps[0], adjustedMean: 1 }, resultV3.worksheets[0].steps[1], resultV3.worksheets[0].steps[2]] }],
        }).success).toBe(false);
        const lowerRankedFactor = { ...factor, sourceRow: factor.sourceRow + 1, factorName: "Factor B" };
        expect(f6OptimizationResultV3Schema.safeParse({
          ...resultV3,
          worksheets: [{ ...resultV3.worksheets[0], steps: [resultV3.worksheets[0].steps[0], { step: "contributorPriorities", priorities: [{ rank: 1, factor, contribution: 0.1, guidance: "tighten_tolerance" }, { rank: 2, factor: lowerRankedFactor, contribution: 0.9, guidance: "tighten_tolerance" }] }, resultV3.worksheets[0].steps[2]] }],
        }).success).toBe(false);
        expect(f6OptimizationResultV3Schema.safeParse({
          ...resultV3,
          worksheets: [{ ...resultV3.worksheets[0], steps: [resultV3.worksheets[0].steps[0], { step: "contributorPriorities", priorities: [{ rank: 1, factor, contribution: 0.7, guidance: "tighten_tolerance" }, { rank: 2, factor, contribution: 0.6, guidance: "tighten_tolerance" }] }, resultV3.worksheets[0].steps[2]] }],
        }).success).toBe(false);
        const invalidProposal = { side: "lower" as const, currentLimit: -1, proposedLimit: 0, targetCpk: 1.33, currentSideCpk: 0.8, verifiedSideCpk: 1.33, verificationStatus: "target_met" as const, approvalRequired: true as const, capabilityImprovementClaim: false as const, calculationReference: artifactReference("F4-Proposal.json") };
        expect(f6OptimizationResultV3Schema.safeParse({
          ...resultV3,
          worksheets: [{ ...resultV3.worksheets[0], steps: [resultV3.worksheets[0].steps[0], resultV3.worksheets[0].steps[1], { step: "specificationChanges", proposals: [invalidProposal], clarifications: [] }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultV3Schema.safeParse({
          ...resultV3,
          worksheets: [{ ...resultV3.worksheets[0], steps: [resultV3.worksheets[0].steps[0], { ...resultV3.worksheets[0].steps[1], priorities: [{ ...resultV3.worksheets[0].steps[1].priorities[0], rationale: "Use OP1" }] }, resultV3.worksheets[0].steps[2]] }],
        }).success).toBe(false);
      });

      it("accepts governed observation and model-ledger rejected reason codes in provenance decisions", () => {
        const decisionTemplate = {
          outcome: "REJECTED" as const,
          artifactReference: artifactReference("Feature5-Image-Observations.json"),
          inputReferenceHash: "f".repeat(64),
        };
        const candidate = {
          ...resultV2,
          provenance: {
            ...resultV2.provenance,
            modelInterpretationDecision: {
              ...decisionTemplate,
              reasonCode: "model_interpretation_evidence_mismatch" as const,
            },
            analysisContextDecision: {
              ...decisionTemplate,
              reasonCode: "observation_hash_mismatch" as const,
            },
            optimizationTargetsDecision: {
              ...decisionTemplate,
              reasonCode: "observation_identity_mismatch" as const,
            },
          },
        };

        expect(f6OptimizationResultSchema.parse(candidate)).toEqual(candidate);
      });

      it("accepts truthful caller-target scenario evidence and rejects empty evidence", () => {
        const completedOption = {
          optionId: "Analysis-A:caller-target",
          status: "completed" as const,
          optionSource: "CALLER_TARGET" as const,
          targetId: "caller-factor-nominal",
          baselineMetrics: metrics,
          resultMetrics: { ...metrics, cpk: 1.1 },
          scenarioEvidence: {
            targetId: "caller-factor-nominal",
            baselineIdentity,
            factorOverrides: [{
              factor,
              nominalValue: 0.25,
            }],
            calculationReference: artifactReference("Feature4-Calculation.json"),
            formulaReferences: [],
          },
          feasibility: { status: "supported" as const, reasonCodes: ["caller_provided_target"], evidenceReferences: [] },
          evidenceReferences: [],
          impactRank: 1,
        };
        const completedResult = {
          ...resultV2,
          worksheets: [{
            ...resultV2.worksheets[0],
            options: [completedOption],
            highestImpactAction: { optionId: completedOption.optionId, impactRank: 1 },
            recommendations: [{
              recommendationId: "recommend-caller-target",
              optionId: completedOption.optionId,
              text: "Review governed target.",
              evidenceReferences: [artifactReference("Feature4-Calculation.json")],
            }],
          }],
          summary: { ...resultV2.summary, candidateOptionCount: 0, completedOptionCount: 1 },
        };

        expect(f6OptimizationResultSchema.safeParse(completedResult).success).toBe(true);

        const systemOnly = {
          ...completedOption,
          optionId: "Analysis-A:caller-system-shift",
          targetId: "caller-system-shift",
          scenarioEvidence: {
            ...completedOption.scenarioEvidence,
            targetId: "caller-system-shift",
            factorOverrides: [],
            systemSpecification: { additionalMeanShift: 0.4 },
          },
        };
        const systemOnlyResult = {
          ...completedResult,
          worksheets: [{
            ...completedResult.worksheets[0],
            options: [systemOnly],
            highestImpactAction: { optionId: systemOnly.optionId, impactRank: 1 },
            recommendations: [{
              recommendationId: "recommend-system-shift",
              optionId: systemOnly.optionId,
              text: "Review governed target.",
              evidenceReferences: [artifactReference("Feature4-Calculation.json")],
            }],
          }],
        };
        expect(f6OptimizationResultSchema.safeParse(systemOnlyResult).success).toBe(true);

        const emptyEvidence = {
          ...completedOption,
          optionId: "Analysis-A:caller-empty",
          targetId: "caller-empty",
          scenarioEvidence: {
            ...completedOption.scenarioEvidence,
            targetId: "caller-empty",
            factorOverrides: [],
          },
        };
        const emptyEvidenceResult = {
          ...completedResult,
          worksheets: [{
            ...completedResult.worksheets[0],
            options: [emptyEvidence],
            highestImpactAction: { optionId: emptyEvidence.optionId, impactRank: 1 },
            recommendations: [{
              recommendationId: "recommend-empty",
              optionId: emptyEvidence.optionId,
              text: "Review governed target.",
              evidenceReferences: [artifactReference("Feature4-Calculation.json")],
            }],
          }],
        };
        expect(f6OptimizationResultSchema.safeParse(emptyEvidenceResult).success).toBe(false);
      });

      it("requires unique V2 report scope names and blocked names as a subset", () => {
        expect(f6OptimizationResultSchema.safeParse({
          ...resultV2,
          provenance: { ...resultV2.provenance, reportScope: { worksheetNames: ["Analysis-A", "Analysis-A"], blockedWorksheetNames: [] } },
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...resultV2,
          provenance: { ...resultV2.provenance, reportScope: { worksheetNames: ["Analysis-A"], blockedWorksheetNames: ["Blocked-A"] } },
        }).success).toBe(false);
      });

      it("enforces option branch fields, unique IDs, and summary counts", () => {
        expect(f6OptimizationResultSchema.safeParse({
          ...resultV2,
          worksheets: [{
            ...resultV2.worksheets[0],
            options: [{ ...candidate, resultMetrics: metrics }],
          }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...resultV2,
          worksheets: [{ ...resultV2.worksheets[0], options: [candidate, { ...candidate }] }],
          summary: { ...resultV2.summary, candidateOptionCount: 2 },
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...resultV2,
          summary: { ...resultV2.summary, candidateOptionCount: 0 },
        }).success).toBe(false);
      });

      it("accepts a governed built-in OP1 option and rejects a changed reduction matrix", () => {
        const factors = [factor, { ...factor, sourceRow: 15, factorName: "Factor B" }, { ...factor, sourceRow: 16, factorName: "Factor C" }];
        const policyContext = {
          policyId: "f6-top3-tolerance-policy-v1" as const,
          optionCode: "OP1" as const,
          trigger: { lowerCpk: 0.9, upperCpk: 1.8, targetCpk: 1, failedSides: ["lowerCpk" as const] },
          selectedFactorCount: 3,
          reductions: factors.map((policyFactor, index) => ({
            factor: policyFactor,
            rank: index + 1,
            reductionRatio: index === 0 ? 0.25 : 0.1,
            scale: index === 0 ? 0.75 : 0.9,
          })),
        };
        const option = {
          optionId: "Analysis-A:builtin-top3:OP1",
          status: "completed" as const,
          optionSource: "BUILT_IN_POLICY" as const,
          targetId: "f6-top3-tolerance-policy-v1:OP1",
          policyContext,
          baselineMetrics: { ...metrics, lowerCpk: 0.9, upperCpk: 1.8, capabilityStatus: "FAIL" as const },
          resultMetrics: { ...metrics, cpk: 1.1, lowerCpk: 1.1, upperCpk: 2, capabilityStatus: "PASS" as const },
          scenarioEvidence: {
            targetId: "f6-top3-tolerance-policy-v1:OP1",
            baselineIdentity,
            factorOverrides: factors.map((policyFactor) => ({ factor: policyFactor, upperTolerance: 0.1, lowerTolerance: -0.1 })),
            calculationReference: artifactReference("Feature4-Calculation.json"),
            formulaReferences: [],
          },
          feasibility: { status: "supported" as const, reasonCodes: ["built_in_policy"], evidenceReferences: [] },
          evidenceReferences: [],
          impactRank: 1,
        };
        const builtInResult = {
          ...resultV2,
          worksheets: [{
            ...resultV2.worksheets[0],
            baselineMetrics: option.baselineMetrics,
            options: [option],
            highestImpactAction: { optionId: option.optionId, impactRank: 1 },
          }],
          summary: { ...resultV2.summary, candidateOptionCount: 0, completedOptionCount: 1 },
        };

        expect(f6OptimizationResultSchema.safeParse(builtInResult).success).toBe(true);
        expect(f6OptimizationResultSchema.safeParse({
          ...builtInResult,
          worksheets: [{
            ...builtInResult.worksheets[0],
            options: [{
              ...option,
              policyContext: {
                ...policyContext,
                reductions: [{ ...policyContext.reductions[0], reductionRatio: 0.2 }, ...policyContext.reductions.slice(1)],
              },
            }],
          }],
        }).success).toBe(false);
      });

      it("allows highest impact and recommendations only for supported completed options", () => {
        expect(f6OptimizationResultSchema.safeParse({
          ...resultV2,
          worksheets: [{
            ...resultV2.worksheets[0],
            highestImpactAction: { optionId: candidate.optionId, impactRank: 1 },
          }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...resultV2,
          worksheets: [{
            ...resultV2.worksheets[0],
            recommendations: [{ recommendationId: "recommend-candidate", optionId: candidate.optionId, text: "Apply candidate.", evidenceReferences: [] }],
          }],
        }).success).toBe(false);
      });
    });

    describe("F6 optimization contracts", () => {
      const f6OptimizationResultSchema = f6LegacyOptimizationResultSchema;
      const reference = (artifact: string) => ({ artifact, contentHash: "a".repeat(64) });
      const baselineCalculationRequest = {
        contractVersion: "v1" as const,
        inputClassification: "confidential" as const,
        projectReference: calculationCompletedResult.projectReference,
        runReference: calculationCompletedResult.runReference,
        worksheetAnalysisAssets: {
          contractVersion: "v1" as const,
          workbook: { classification: "confidential" as const, contentHash: calculationCompletedResult.workbookContentHash, catalogContractVersion: "v1" },
          worksheets: [{
            worksheetName: "Analysis-A", toleranceLoopDescription: "controlled",
            factorTables: [{
              tableId: "table-a", headerRow: 1, dataRange: { startRow: 2, endRow: 2 },
              columns: [
                { semanticField: "factorName" as const, headerText: "Factor", sourceColumn: "J" },
                { semanticField: "nominalValue" as const, headerText: "Nominal", sourceColumn: "K" },
                { semanticField: "upperTolerance" as const, headerText: "Upper", sourceColumn: "L" },
                { semanticField: "lowerTolerance" as const, headerText: "Lower", sourceColumn: "M" },
                { semanticField: "longTermSafetyFactor" as const, headerText: "LTSF", sourceColumn: "N" },
                { semanticField: "standardDeviation" as const, headerText: "Sigma", sourceColumn: "O" },
                { semanticField: "distribution" as const, headerText: "Distribution", sourceColumn: "P" },
                { semanticField: "unit" as const, headerText: "Unit", sourceColumn: "Q" },
              ],
              rows: [{ sourceRow: 2, factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!I2" }, fields: {
                factorName: { status: "available" as const, rawText: "Feature-A", sourceCell: "Analysis-A!J2" },
                nominalValue: { status: "available" as const, rawText: "12.45", sourceCell: "Analysis-A!K2", numericValue: 12.45, unit: "mm" },
                upperTolerance: { status: "available" as const, rawText: "0.2", sourceCell: "Analysis-A!L2", numericValue: 0.2, unit: "mm" },
                lowerTolerance: { status: "available" as const, rawText: "-0.2", sourceCell: "Analysis-A!M2", numericValue: -0.2, unit: "mm" },
                longTermSafetyFactor: { status: "available" as const, rawText: "1", sourceCell: "Analysis-A!N2", numericValue: 1, unit: "mm" },
                standardDeviation: { status: "available" as const, rawText: "4", sourceCell: "Analysis-A!O2", numericValue: 4, unit: "mm" },
                distribution: { status: "available" as const, rawText: "normal", sourceCell: "Analysis-A!P2" },
                unit: { status: "available" as const, rawText: "mm", sourceCell: "Analysis-A!Q2" },
              } }],
            }],
            formulaCells: [], imageAssets: [],
          }],
        },
        requiredFieldCheck: {
          contractVersion: "v1" as const, inputClassification: "confidential" as const,
          workbookContentHash: calculationCompletedResult.workbookContentHash, status: "readyForNextCheck" as const,
          blockingIssues: [], advisoryIssues: [],
          summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 1, blockingIssueCount: 0, advisoryIssueCount: 0 },
        },
        exceptionResolution: {
          contractVersion: "v1" as const, inputClassification: "confidential" as const,
          workbookContentHash: calculationCompletedResult.workbookContentHash, knowledgeBaseVersion: "v1" as const,
          status: "readyToContinue" as const, readyToContinue: true, acceptedExceptions: [], pendingExceptions: [],
          summary: { actionableSignalCount: 0, acceptedExceptionCount: 0, pendingExceptionCount: 0, invalidCandidateCount: 0 },
        },
        worksheetSelection: calculationCompletedResult.worksheetSelection,
        systemSpecification: {
          designNominal: calculationCompletedResult.system.designNominal,
          lowerSpecLimit: calculationCompletedResult.capability.lowerSpecLimit,
          upperSpecLimit: calculationCompletedResult.capability.upperSpecLimit,
          targetSigmaLevel: calculationCompletedResult.capability.targetSigmaLevel,
          targetCpk: calculationCompletedResult.capability.targetCpk,
          additionalMeanShift: calculationCompletedResult.system.additionalMeanShift,
        },
        criticality: calculationCompletedResult.recommendation.criticality,
        scenarioOverrides: [],
      };
      const validF6WorksheetInput = {
        worksheetName: "Analysis-A",
        f4CalculationIndex: 1,
        baselineCalculationRequest,
        baselineCalculation: calculationCompletedResult,
        f5Worksheet: rootResult.worksheets[0],
        f3GovernanceRows: [governanceRow],
        f2Findings: [],
        supplierBindings: [],
      };
      const f6Request = {
        contractVersion: "v1",
        inputClassification: "confidential",
        workbook: { fileName: "Demo.xlsx", contentHash: calculationCompletedResult.workbookContentHash },
        selectedWorksheetNames: ["Analysis-A"],
        reportScope: { worksheetNames: ["Analysis-A"], blockedWorksheetNames: [] },
        f2Reference: reference("Feature2-Report.json"),
        f3Reference: reference("Feature3-Report.json"),
        f4Reference: { ...reference("Feature4-Calculation.json"), runId: "controlled-run-reference", calculationVersion: "excel-ta-v1" },
        f5Reference: { ...reference("Feature5-Report.json"), interpretationVersion: "f5-data-interpretation-v1" },
        f0Versions: {
          knowledgeBaseVersion: "v1",
          capabilityVersion: "internal-v1",
          interpretationVersion: "interpretation-rules-v1",
        },
        scenarioPolicyVersion: "f6-scenario-policy-v1",
        worksheets: [validF6WorksheetInput],
      };
      const metrics = {
        mean: calculationCompletedResult.system.mean,
        rssSigma: calculationCompletedResult.system.rssSigma,
        cp: calculationCompletedResult.capability.cp,
        cpk: calculationCompletedResult.capability.cpk,
        yield: calculationCompletedResult.capability.yield,
        dpm: calculationCompletedResult.capability.totalDpm,
      };
      const baselineIdentity = {
        projectReference: calculationCompletedResult.projectReference,
        runReference: calculationCompletedResult.runReference,
        calculationVersion: calculationCompletedResult.calculationVersion,
        workbookContentHash: calculationCompletedResult.workbookContentHash,
        worksheetName: calculationCompletedResult.worksheetSelection.worksheetName,
        tableId: calculationCompletedResult.worksheetSelection.tableId,
        factorCount: calculationCompletedResult.factorCount,
        factors: calculationCompletedResult.factors.map((factor) => {
          const identity: Partial<typeof factor> = structuredClone(factor);
          delete identity.trace;
          return identity;
        }),
        system: calculationCompletedResult.system,
        capability: calculationCompletedResult.capability,
      };
      const feasibility = { status: "supported", reasonCodes: ["within_capability_bound"], evidenceReferences: ["supplier-capability.json"] };
      const roiCalculationReference = reference("calculations/roi-policy-v2.json");
      const costEvidence = {
        evidenceVersion: "cost-model-v1", model: "relative-cost", unit: "USD",
        optionCosts: [
          { optionKind: "reduce_top_contributor_20", cost: 100 },
          { optionKind: "reduce_top_3_contributors_30", cost: 200 },
        ],
        roiPolicyVersion: "f6-delta-cpk-per-cost-v1", roiCalculationReference,
        source: "cost-model.json", effectiveVersion: "FY26", contentHash: "a".repeat(64),
      };
      const supplierEvidence = {
        evidenceVersion: "supplier-capability-v1", supplierReference: "supplier-a", processFamily: "cnc", partCategory: "CNC",
        capabilityTier: "T1", achievableToleranceBand: 0.3, distribution: "normal",
        source: "supplier-capability.json", effectiveVersion: "2026-Q3", contentHash: "b".repeat(64),
      };
      const datumEvidence = {
        evidenceVersion: "datum-strategy-v1", worksheetName: "Analysis-A", datumFace: "A", stackStart: "A",
        factorDirections: [{ tableId: "table-a", sourceRow: 2, direction: 1 }],
        datumChainEdges: [{ from: "A", to: "B" }], crossSubsystemRelations: ["bracket-to-frame"],
        drawingEvidence: ["drawing-a.pdf"], reviewStatus: "confirmed",
        source: "datum-review.json", effectiveVersion: "v1", contentHash: "c".repeat(64),
      };
      const completedOption = {
        status: "completed",
        optionId: "top-contributor-20",
        optionKind: "reduce_top_contributor_20",
        baselineMetrics: metrics,
        resultMetrics: metrics,
        deltaCpk: 0,
        deltaCp: 0,
        deltaRssSigma: 0,
        deltaDpm: 0,
        deltaYield: 0,
        factorOverrides: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, upperTolerance: 0.16, lowerTolerance: -0.16 }],
        toleranceChanges: [{
          worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2,
          originalLowerTolerance: -0.2, originalUpperTolerance: 0.2,
          resultingLowerTolerance: -0.16, resultingUpperTolerance: 0.16,
          originalBand: 0.4, resultingBand: 0.32, bandCenter: 0,
        }],
        feasibility,
        evidenceReferences: [reference("Feature4-Calculation.json")],
        relativeCost: "insufficient_evidence",
        roiScore: "not_computed",
        impactRank: 1,
        scenarioEvidence: {
          scenarioId: "top-contributor-20",
          calculation: {
            ...calculationCompletedResult,
            scenarios: [{
              scenarioId: "top-contributor-20",
              baselineRunReference: calculationCompletedResult.runReference,
              calculation: {
                factorCount: calculationCompletedResult.factorCount,
                recommendation: calculationCompletedResult.recommendation,
                factors: calculationCompletedResult.factors,
                system: calculationCompletedResult.system,
                capability: calculationCompletedResult.capability,
                traceRecords: calculationCompletedResult.traceRecords,
              },
              overrides: {
                factors: [{
                  source: calculationCompletedResult.factors[0]!.source,
                  fields: ["upperTolerance" as const, "lowerTolerance" as const],
                }],
              },
              deltas: { mean: 0, rssSigma: 0, worstCaseUpper: 0, worstCaseLower: 0, cpk: 0, totalDpm: 0, yield: 0 },
            }],
          },
        },
        closedRiskIds: [],
      };
      const scenarioEvidenceFor = (scenarioId: string) => ({
        ...completedOption.scenarioEvidence,
        scenarioId,
        calculation: {
          ...completedOption.scenarioEvidence.calculation,
          scenarios: completedOption.scenarioEvidence.calculation.scenarios.map((scenario) => ({ ...scenario, scenarioId })),
        },
      });
      const topThreeOption = {
        ...completedOption,
        optionId: "top-three-30",
        optionKind: "reduce_top_3_contributors_30",
        impactRank: null,
        scenarioEvidence: scenarioEvidenceFor("top-three-30"),
      };
      const supplierInsufficientOption = {
        status: "insufficient_evidence",
        optionId: "supplier-evidence-gap",
        optionKind: "improve_supplier_capability",
        predictedImprovement: "insufficient_evidence",
        requiredInputs: ["confirmed_supplier_capability_evidence"],
        evidenceReferences: [],
        relativeCost: "insufficient_evidence",
        roiScore: "not_computed",
        impactRank: null,
      };
      const datumInsufficientOption = {
        ...supplierInsufficientOption,
        optionId: "datum-evidence-gap",
        optionKind: "tighten_datum_strategy",
        requiredInputs: ["confirmed_datum_chain_evidence", "engineering_review"],
      };
      const fixedReportOptions = [completedOption, topThreeOption, supplierInsufficientOption, datumInsufficientOption];
      const fixedOptionsWith = (...replacements: object[]) => fixedReportOptions.map((option) =>
        replacements.find((replacement) => (replacement as { optionKind?: string }).optionKind === option.optionKind) ?? option);
      const f6Result = {
        contractVersion: "v1",
        outputClassification: "confidential",
        featureId: "F6",
        status: "completed",
        optimizationVersion: "f6-optimization-v1",
        workbook: f6Request.workbook,
        worksheets: [{
          worksheetName: "Analysis-A",
          f4CalculationIndex: 1,
          baselineIdentity,
          status: "completed",
          baselineMetrics: metrics,
          targetCapability: { targetCpk: 1.33, targetSigmaLevel: 4, source: "worksheet" },
          inputFindings: [],
          options: fixedReportOptions,
          risks: [],
          recommendations: [{ recommendationId: "recommend-top", optionId: completedOption.optionId, text: "Apply the verified top contributor tolerance change.", evidenceReferences: [reference("scenarios/top-contributor-20.json")] }],
          highestImpactAction: { optionId: completedOption.optionId, rationale: "Largest verified capability improvement." },
          roiStatus: "not_computed",
          clarifications: [],
        }],
        summary: { worksheetCount: 1, completedWorksheetCount: 1, partiallyCompletedWorksheetCount: 0, calculationFailedWorksheetCount: 0, inputRejectedWorksheetCount: 0, completedOptionCount: 2, calculationFailedOptionCount: 0, insufficientEvidenceOptionCount: 2 },
        provenance: {
          f2Reference: f6Request.f2Reference, f3Reference: f6Request.f3Reference,
          f4Reference: f6Request.f4Reference, f5Reference: f6Request.f5Reference,
          reportScope: f6Request.reportScope,
          f0Versions: f6Request.f0Versions, scenarioPolicyVersion: f6Request.scenarioPolicyVersion,
        },
      };

      it("accepts strict F6 requests and binds workbook and worksheet identities", () => {
        expect(f6OptimizationRequestSchema.parse(f6Request)).toEqual(f6Request);
        expect(f6OptimizationRequestSchema.safeParse({ ...f6Request, inputClassification: "public" }).success).toBe(false);
        expect(f6OptimizationRequestSchema.safeParse({ ...f6Request, f2Reference: reference("C:\\absolute\\Feature2-Report.json") }).success).toBe(false);
        expect(f6OptimizationRequestSchema.safeParse({ ...f6Request, selectedWorksheetNames: ["Analysis-A", "Analysis-A"] }).success).toBe(false);
        expect(f6OptimizationRequestSchema.safeParse({ ...f6Request, reportScope: { worksheetNames: ["Analysis-A", "Analysis-A"], blockedWorksheetNames: [] } }).success).toBe(false);
        expect(f6OptimizationRequestSchema.safeParse({ ...f6Request, reportScope: { worksheetNames: ["Analysis-A"], blockedWorksheetNames: ["Blocked-A"] } }).success).toBe(false);
        expect(f6OptimizationRequestSchema.safeParse({ ...f6Request, workbook: { ...f6Request.workbook, contentHash: "0".repeat(64) } }).success).toBe(false);
        expect(f6OptimizationRequestSchema.safeParse({
          ...f6Request,
          worksheets: [{ ...validF6WorksheetInput, baselineCalculationRequest: { ...baselineCalculationRequest, runReference: "tampered-run" } }],
        }).success).toBe(false);
        expect(f6OptimizationRequestSchema.safeParse({
          ...f6Request,
          worksheets: [{ ...validF6WorksheetInput, f4CalculationIndex: 2 }],
        }).success).toBe(false);
      });

      it("binds every F6 input finding kind to capability impact semantics", () => {
        const finding = {
          findingCode: "arbitrary-code",
          severity: "Major",
          message: "A governed identifier is unavailable.",
          evidenceReferences: [],
        };

        for (const candidate of [
          { ...finding, findingKind: "validation_abnormality", affectsCapabilityData: false },
          { ...finding, findingKind: "validation_abnormality", affectsCapabilityData: true },
          { ...finding, findingKind: "governance_gap", affectsCapabilityData: false },
          { ...finding, findingKind: "optimization_failure", affectsCapabilityData: false },
          { ...finding, findingKind: "confirmed_requirement_violation", affectsCapabilityData: true },
        ] as const) {
          expect(f6InputFindingSchema.parse(candidate)).toEqual(candidate);
        }
        for (const candidate of [
          { ...finding, findingKind: "governance_gap", affectsCapabilityData: true },
          { ...finding, findingKind: "optimization_failure", affectsCapabilityData: true },
          { ...finding, findingKind: "confirmed_requirement_violation", affectsCapabilityData: false },
        ] as const) {
          expect(f6InputFindingSchema.safeParse(candidate).success).toBe(false);
        }
        expect(f6InputFindingSchema.safeParse({ ...finding, findingKind: undefined, affectsCapabilityData: false }).success).toBe(false);
        expect(f6InputFindingSchema.safeParse({ ...finding, findingKind: "requirement_violation", affectsCapabilityData: false }).success).toBe(false);
      });

      it("rejects duplicate governed evidence identities in requests at the second record", () => {
        for (const [field, evidence] of [
          ["supplierCapabilityEvidence", supplierEvidence],
          ["datumEvidence", datumEvidence],
        ] as const) {
          const parsed = f6OptimizationRequestSchema.safeParse({ ...f6Request, [field]: [evidence, { ...evidence }] });
          expect(parsed.success, field).toBe(false);
          if (!parsed.success) expect(parsed.error.issues.map(({ path }) => path)).toContainEqual([field, 1]);
        }
      });

      it("requires unique supplier bindings that resolve to one governed evidence record", () => {
        const evidenceReference = { artifact: supplierEvidence.source, contentHash: supplierEvidence.contentHash };
        const binding = { tableId: "table-a", sourceRow: 2, evidenceReference };
        const boundRequest = {
          ...f6Request,
          supplierCapabilityEvidence: [supplierEvidence],
          worksheets: [{ ...validF6WorksheetInput, supplierBindings: [binding] }],
        };

        expect(f6OptimizationRequestSchema.parse(boundRequest)).toEqual(boundRequest);
        expect(f6OptimizationRequestSchema.safeParse({
          ...f6Request,
          worksheets: [{ ...validF6WorksheetInput, supplierBindings: undefined }],
        }).success).toBe(false);

        for (const supplierBindings of [
          [binding, binding],
          [{ ...binding, sourceRow: 99 }],
          [{ ...binding, evidenceReference: { ...evidenceReference, contentHash: "f".repeat(64) } }],
        ]) {
          expect(f6OptimizationRequestSchema.safeParse({
            ...boundRequest,
            worksheets: [{ ...validF6WorksheetInput, supplierBindings }],
          }).success).toBe(false);
        }
        expect(f6OptimizationRequestSchema.safeParse({
          ...boundRequest,
          supplierCapabilityEvidence: [{ ...supplierEvidence, partCategory: "mismatched-category" }],
        }).success).toBe(false);
      });

      it("accepts strict solver DTOs and versioned supplier, datum, and cost evidence", () => {
        expect(f6ToleranceChangeSchema.parse(completedOption.toleranceChanges[0])).toEqual(completedOption.toleranceChanges[0]);
        expect(f6ControlledScenarioSchema.safeParse({ scenarioId: "scenario-1", optionKind: "reduce_top_contributor_20", factorOverrides: completedOption.factorOverrides }).success).toBe(true);
        expect(f6ReverseSolveResultSchema.safeParse({ targetCpk: 1.33, targetRssSigma: 0.04, strategy: "single-factor", toleranceChanges: completedOption.toleranceChanges, residualError: 0 }).success).toBe(true);
        expect(f6CapabilityBoundSchema.safeParse({ tableId: "table-a", sourceRow: 2, minimumToleranceBand: 0.1, maximumToleranceBand: 0.4, evidenceReference: "supplier-capability.json" }).success).toBe(true);
        expect(f6FeasibilityAssessmentSchema.parse(feasibility)).toEqual(feasibility);
        expect(f6ApportionmentResultSchema.safeParse({ policy: "bounded-by-capability", targetRssSigma: 0.04, allocations: [{ tableId: "table-a", sourceRow: 2, targetSigma: 0.04, targetTolerance: 0.16 }], residualError: 0, feasibility }).success).toBe(true);
        expect(f6SupplierCapabilityEvidenceSchema.safeParse(supplierEvidence).success).toBe(true);
        expect(f6DatumEvidenceSchema.safeParse(datumEvidence).success).toBe(true);
        expect(f6CostEvidenceSchema.safeParse(costEvidence).success).toBe(true);
        expect(f6DatumEvidenceSchema.safeParse({ ...datumEvidence, worksheetName: "" }).success).toBe(false);
        expect(f6CostEvidenceSchema.safeParse({ ...costEvidence, roiPolicyVersion: "legacy-roi-policy" }).success).toBe(false);
      });

      it("rejects duplicate solver and governed evidence source identities at precise paths", () => {
        const duplicateAllocation = f6ApportionmentResultSchema.safeParse({
          policy: "bounded-by-capability", targetRssSigma: 0.04,
          allocations: [
            { tableId: "table-a", sourceRow: 2, targetSigma: 0.04, targetTolerance: 0.16 },
            { tableId: "table-a", sourceRow: 2, targetSigma: 0.03, targetTolerance: 0.12 },
          ],
          residualError: 0, feasibility,
        });
        expect(duplicateAllocation.success).toBe(false);
        if (!duplicateAllocation.success) expect(duplicateAllocation.error.issues.map(({ path }) => path)).toContainEqual(["allocations", 1]);

        const duplicateDirection = f6DatumEvidenceSchema.safeParse({ evidenceVersion: "datum-strategy-v1", worksheetName: "Analysis-A", datumFace: "A", stackStart: "A", factorDirections: [{ tableId: "table-a", sourceRow: 2, direction: 1 }, { tableId: "table-a", sourceRow: 2, direction: -1 }], datumChainEdges: [{ from: "A", to: "B" }], crossSubsystemRelations: [], drawingEvidence: ["drawing-a.pdf"], reviewStatus: "confirmed", source: "datum-review.json", effectiveVersion: "v1", contentHash: "a".repeat(64) });
        expect(duplicateDirection.success).toBe(false);
        if (!duplicateDirection.success) expect(duplicateDirection.error.issues.map(({ path }) => path)).toContainEqual(["factorDirections", 1]);

        const duplicateCost = f6CostEvidenceSchema.safeParse({ ...costEvidence, optionCosts: [{ optionKind: "reduce_top_contributor_20", cost: 100 }, { optionKind: "reduce_top_contributor_20", cost: 120 }] });
        expect(duplicateCost.success).toBe(false);
        if (!duplicateCost.success) expect(duplicateCost.error.issues.map(({ path }) => path)).toContainEqual(["optionCosts", 1, "optionKind"]);
      });

      it("enforces strict option branches and result status summaries", () => {
        expect(f6OptimizationResultSchema.parse(f6Result)).toEqual(f6Result);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], baselineIdentity: { ...baselineIdentity, projectReference: "other-project" } }],
        }).success).toBe(true);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], baselineIdentity: { ...baselineIdentity, worksheetName: "Other" } }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], baselineIdentity: { ...baselineIdentity, workbookContentHash: "f".repeat(64) } }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], baselineIdentity: { ...baselineIdentity, runReference: "other-run" } }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({ ...f6Result, summary: { ...f6Result.summary, completedOptionCount: 0 } }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({ ...f6Result, worksheets: [{ ...f6Result.worksheets[0], options: [{ ...completedOption, deltaCpk: 0.7 }] }] }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({ ...f6Result, worksheets: [{ ...f6Result.worksheets[0], status: "input_rejected", options: [completedOption] }] }).success).toBe(false);
        const failedOption = { status: "calculation_failed", optionId: "failed", optionKind: "reduce_top_3_contributors_30", reasonCode: "f4_calculation_failed", evidenceReferences: [], impactRank: null };
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          status: "partially_completed",
          worksheets: [{ ...f6Result.worksheets[0], status: "partially_completed", options: fixedOptionsWith(failedOption) }],
          summary: { ...f6Result.summary, partiallyCompletedWorksheetCount: 1, completedWorksheetCount: 0, completedOptionCount: 1, calculationFailedOptionCount: 1 },
        }).success).toBe(true);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [{ ...failedOption, resultMetrics: metrics }] }],
        }).success).toBe(false);
        const insufficientOption = { status: "insufficient_evidence", optionId: "supplier", optionKind: "improve_supplier_capability", predictedImprovement: "insufficient_evidence", requiredInputs: ["supplier capability study"], evidenceReferences: [], relativeCost: "insufficient_evidence", roiScore: "not_computed", impactRank: null };
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: fixedOptionsWith(insufficientOption) }],
        }).success).toBe(true);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [{ ...completedOption, relativeCost: 0, roiScore: 0 }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [{ ...completedOption, scenarioEvidence: { ...completedOption.scenarioEvidence, scenarioId: "other" } }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [{ ...completedOption, resultMetrics: { ...completedOption.resultMetrics, cpk: completedOption.resultMetrics.cpk + 1 }, deltaCpk: 1 }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [{ ...completedOption, closedRiskIds: ["missing-risk"] }] }],
        }).success).toBe(false);
        const lowRisk = {
          riskId: "low-risk", category: "Product", rating: "Low", status: "open",
          reason: "Low governed risk.", evidenceReferences: [f6Request.f5Reference],
        } as const;
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], risks: [lowRisk], options: [{ ...completedOption, closedRiskIds: [lowRisk.riskId] }] }],
        }).success).toBe(false);
        const structuralRisk = {
          riskId: "structural-risk", category: "Manufacturing", rating: "High", status: "open",
          reason: "Structural governance remains open.", evidenceReferences: [f6Request.f3Reference],
        } as const;
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], risks: [structuralRisk], options: [{ ...completedOption, closedRiskIds: [structuralRisk.riskId] }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{
            ...f6Result.worksheets[0],
            risks: [{ ...structuralRisk, status: "closed" }],
            options: fixedOptionsWith({ ...completedOption, closedRiskIds: [structuralRisk.riskId] }),
          }],
        }).success).toBe(true);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [{
            ...completedOption,
            scenarioEvidence: {
              ...completedOption.scenarioEvidence,
              calculation: {
                ...completedOption.scenarioEvidence.calculation,
                scenarios: [
                  ...completedOption.scenarioEvidence.calculation.scenarios,
                  { ...completedOption.scenarioEvidence.calculation.scenarios[0], scenarioId: "extra-scenario" },
                ],
              },
            },
          }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [{
            ...completedOption,
            scenarioEvidence: {
              ...completedOption.scenarioEvidence,
              calculation: { ...completedOption.scenarioEvidence.calculation, runReference: "other-run" },
            },
          }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [{
            ...completedOption,
            scenarioEvidence: {
              ...completedOption.scenarioEvidence,
              calculation: {
                ...completedOption.scenarioEvidence.calculation,
                worksheetSelection: { ...completedOption.scenarioEvidence.calculation.worksheetSelection, worksheetName: "Other" },
              },
            },
          }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [{
            ...completedOption,
            scenarioEvidence: {
              ...completedOption.scenarioEvidence,
              calculation: {
                ...completedOption.scenarioEvidence.calculation,
                scenarios: completedOption.scenarioEvidence.calculation.scenarios.map((scenario) => ({
                  ...scenario,
                  overrides: { ...scenario.overrides, factors: [] },
                })),
              },
            },
          }] }],
        }).success).toBe(false);
      });

      it("requires exactly one option for each fixed report What-If kind", () => {
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: fixedReportOptions.slice(0, 3) }],
          summary: { ...f6Result.summary, insufficientEvidenceOptionCount: 1 },
        }).success).toBe(false);

        const duplicateFixedKind = {
          ...completedOption,
          optionId: "top-contributor-20-duplicate",
          impactRank: 2,
          scenarioEvidence: scenarioEvidenceFor("top-contributor-20-duplicate"),
        };
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [...fixedReportOptions, duplicateFixedKind] }],
          summary: { ...f6Result.summary, completedOptionCount: 3 },
        }).success).toBe(false);
      });

      it("allows recommendation references only to completed supported options", () => {
        const reviewOnlyOption = {
          ...completedOption,
          feasibility: {
            status: "requires_engineering_review",
            reasonCodes: ["mean_shift_physical_constraint_unverified"],
            evidenceReferences: [f6Request.f4Reference.artifact, f6Request.f5Reference.artifact],
          },
        };

        expect(f6OptimizationResultSchema.safeParse(f6Result).success).toBe(true);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [reviewOnlyOption], highestImpactAction: undefined }],
        }).success).toBe(false);
      });

      it("allows highest impact references only to completed supported options", () => {
        const reviewOnlyOption = {
          ...completedOption,
          feasibility: {
            status: "requires_engineering_review",
            reasonCodes: ["mean_shift_physical_constraint_unverified"],
            evidenceReferences: [f6Request.f4Reference.artifact, f6Request.f5Reference.artifact],
          },
        };

        expect(f6OptimizationResultSchema.safeParse(f6Result).success).toBe(true);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [reviewOnlyOption], recommendations: [] }],
        }).success).toBe(false);
      });

      it("binds every completed option baseline and worksheet identity to its parent worksheet", () => {
        const tamperedOptions = [
          { ...completedOption, baselineMetrics: { ...completedOption.baselineMetrics, mean: completedOption.baselineMetrics.mean + 1 } },
          { ...completedOption, factorOverrides: [{ ...completedOption.factorOverrides[0], worksheetName: "Analysis-B" }] },
          { ...completedOption, toleranceChanges: [{ ...completedOption.toleranceChanges[0], worksheetName: "Analysis-B" }] },
          {
            ...completedOption,
            reverseSolve: {
              targetCpk: 1.33,
              targetRssSigma: 0.04,
              strategy: "single-factor",
              toleranceChanges: [{ ...completedOption.toleranceChanges[0], worksheetName: "Analysis-B" }],
              residualError: 0,
            },
          },
        ];
        for (const option of tamperedOptions) {
          expect(f6OptimizationResultSchema.safeParse({
            ...f6Result,
            worksheets: [{ ...f6Result.worksheets[0], options: [option] }],
          }).success).toBe(false);
        }
      });

      it("rejects duplicate governed evidence identities in input-rejected results at the second record", () => {
        const rejectedResult = {
          ...f6Result,
          status: "input_rejected",
          worksheets: [{
            worksheetName: "Analysis-A",
            f4CalculationIndex: 1,
            baselineIdentity,
            status: "input_rejected",
            inputFindings: [{ findingCode: "missing", findingKind: "validation_abnormality", severity: "Critical", message: "Input is missing.", affectsCapabilityData: true, evidenceReferences: [] }],
            options: [], risks: [], clarifications: [],
          }],
          summary: { worksheetCount: 1, completedWorksheetCount: 0, partiallyCompletedWorksheetCount: 0, calculationFailedWorksheetCount: 0, inputRejectedWorksheetCount: 1, completedOptionCount: 0, calculationFailedOptionCount: 0, insufficientEvidenceOptionCount: 0 },
        };
        for (const [field, evidence] of [
          ["supplierCapabilityEvidence", supplierEvidence],
          ["datumEvidence", datumEvidence],
        ] as const) {
          const parsed = f6OptimizationResultSchema.safeParse({
            ...rejectedResult,
            provenance: { ...rejectedResult.provenance, [field]: [evidence, { ...evidence }] },
          });
          expect(parsed.success, field).toBe(false);
          if (!parsed.success) expect(parsed.error.issues.map(({ path }) => path)).toContainEqual(["provenance", field, 1]);
        }
      });

      it("requires partially completed worksheets to contain both completed and failed options", () => {
        const failedOption = { status: "calculation_failed", optionId: "failed", optionKind: "reduce_top_3_contributors_30", reasonCode: "f4_calculation_failed", evidenceReferences: [], impactRank: null };
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          status: "partially_completed",
          worksheets: [{ ...f6Result.worksheets[0], status: "partially_completed", options: [failedOption] }],
          summary: { ...f6Result.summary, completedWorksheetCount: 0, partiallyCompletedWorksheetCount: 1, completedOptionCount: 0, calculationFailedOptionCount: 1 },
        }).success).toBe(false);
      });

      it("accepts calculation-failed worksheets only when all retained numeric options failed", () => {
        const failedOption = { status: "calculation_failed", optionId: "failed", optionKind: "reduce_top_3_contributors_30", reasonCode: "f4_calculation_failed", evidenceReferences: [], impactRank: null };
        const insufficientOption = { status: "insufficient_evidence", optionId: "supplier", optionKind: "improve_supplier_capability", predictedImprovement: "insufficient_evidence", requiredInputs: ["supplier capability study"], evidenceReferences: [], relativeCost: "insufficient_evidence", roiScore: "not_computed", impactRank: null };
        const failedTopContributor = { ...failedOption, optionId: "failed-top", optionKind: "reduce_top_contributor_20" };
        const failedWorksheet = {
          ...f6Result.worksheets[0],
          status: "calculation_failed",
          options: fixedOptionsWith(failedTopContributor, failedOption, insufficientOption),
          recommendations: [],
          highestImpactAction: undefined,
          roiStatus: "not_computed",
        };
        const failedResult = {
          ...f6Result,
          status: "calculation_failed",
          worksheets: [failedWorksheet],
          summary: {
            worksheetCount: 1,
            completedWorksheetCount: 0,
            partiallyCompletedWorksheetCount: 0,
            calculationFailedWorksheetCount: 1,
            inputRejectedWorksheetCount: 0,
            completedOptionCount: 0,
            calculationFailedOptionCount: 2,
            insufficientEvidenceOptionCount: 2,
          },
        };

        expect(f6OptimizationResultSchema.safeParse(failedResult).success).toBe(true);
        expect(f6OptimizationResultSchema.safeParse({
          ...failedResult,
          worksheets: [{ ...failedWorksheet, options: [completedOption, failedOption] }],
          summary: { ...failedResult.summary, completedOptionCount: 1 },
        }).success).toBe(false);
      });

      it("rejects duplicate per-worksheet identities and ranks at precise paths", () => {
        const duplicateCases = [
          { field: "options", value: [completedOption, { ...completedOption, optionKind: "reduce_top_3_contributors_30", impactRank: 2 }] },
          { field: "risks", value: [{ riskId: "risk-1", category: "Manufacturing", rating: "Low", status: "open", reason: "One", evidenceReferences: [reference("risk.json")] }, { riskId: "risk-1", category: "Supplier", rating: "Medium", status: "open", reason: "Two", evidenceReferences: [reference("risk.json")] }] },
          { field: "recommendations", value: [f6Result.worksheets[0].recommendations[0], { ...f6Result.worksheets[0].recommendations[0], text: "Duplicate." }] },
          { field: "clarifications", value: [{ clarificationId: "clarify-1", reasonCode: "missing", requiredInputs: ["input"], questionForReviewer: "Question?", evidenceReferences: [] }, { clarificationId: "clarify-1", reasonCode: "missing-2", requiredInputs: ["input"], questionForReviewer: "Another?", evidenceReferences: [] }] },
        ] as const;
        for (const { field, value } of duplicateCases) {
          const parsed = f6OptimizationResultSchema.safeParse({
            ...f6Result,
            worksheets: [{ ...f6Result.worksheets[0], [field]: value }],
            summary: field === "options" ? { ...f6Result.summary, completedOptionCount: 2 } : f6Result.summary,
          });
          expect(parsed.success, field).toBe(false);
          if (!parsed.success) expect(parsed.error.issues.some(({ path }) => path[0] === "worksheets" && path[2] === field)).toBe(true);
        }

        const duplicateRank = f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [completedOption, { ...completedOption, optionId: "top-three-30", optionKind: "reduce_top_3_contributors_30" }] }],
          summary: { ...f6Result.summary, completedOptionCount: 2 },
        });
        expect(duplicateRank.success).toBe(false);
        if (!duplicateRank.success) expect(duplicateRank.error.issues.map(({ path }) => path)).toContainEqual(["worksheets", 0, "options", 1, "impactRank"]);
      });

      it("enforces duplicate risk and clarification identities for input-rejected worksheets", () => {
        const risk = { riskId: "risk-1", category: "Manufacturing", rating: "High", status: "open", reason: "Input is incomplete.", evidenceReferences: [reference("finding.json")] };
        const clarification = { clarificationId: "clarify-1", reasonCode: "missing", requiredInputs: ["input"], questionForReviewer: "Provide input?", evidenceReferences: [] };
        const rejectedWorksheet = {
          worksheetName: "Analysis-A", f4CalculationIndex: 1, baselineIdentity, status: "input_rejected",
          inputFindings: [{ findingCode: "missing", findingKind: "validation_abnormality", severity: "Critical", message: "Input is missing.", affectsCapabilityData: true, evidenceReferences: [] }],
          options: [], risks: [risk], clarifications: [clarification],
        };
        const rejectedResult = {
          ...f6Result, status: "input_rejected", worksheets: [rejectedWorksheet],
          summary: { worksheetCount: 1, completedWorksheetCount: 0, partiallyCompletedWorksheetCount: 0, calculationFailedWorksheetCount: 0, inputRejectedWorksheetCount: 1, completedOptionCount: 0, calculationFailedOptionCount: 0, insufficientEvidenceOptionCount: 0 },
        };
        expect(f6OptimizationResultSchema.safeParse({ ...rejectedResult, worksheets: [{ ...rejectedWorksheet, risks: [risk, { ...risk }] }] }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({ ...rejectedResult, worksheets: [{ ...rejectedWorksheet, clarifications: [clarification, { ...clarification }] }] }).success).toBe(false);
      });

      it("binds computed ROI values to governed cost and calculation provenance", () => {
        const costReferences = [reference(costEvidence.source), costEvidence.roiCalculationReference];
        const costedTopThreeOption = {
          ...topThreeOption,
          evidenceReferences: [...topThreeOption.evidenceReferences, ...costReferences],
          relativeCost: 200,
          roiScore: 0,
        };
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], roiStatus: "computed" }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, costEvidence },
          worksheets: [{ ...f6Result.worksheets[0], roiStatus: "computed", options: fixedOptionsWith({ ...completedOption, evidenceReferences: [...completedOption.evidenceReferences, ...costReferences], relativeCost: 100, roiScore: 0 }, costedTopThreeOption) }],
        }).success).toBe(true);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, costEvidence },
          worksheets: [{ ...f6Result.worksheets[0], roiStatus: "computed", options: [{ ...completedOption, relativeCost: 101, roiScore: 0.006 }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, costEvidence },
          worksheets: [{ ...f6Result.worksheets[0], roiStatus: "computed" }],
        }).success).toBe(false);
        const withoutPolicy = Object.fromEntries(Object.entries(costEvidence).filter(([key]) => key !== "roiPolicyVersion"));
        const withoutReference = Object.fromEntries(Object.entries(costEvidence).filter(([key]) => key !== "roiCalculationReference"));
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, costEvidence: withoutPolicy },
          worksheets: [{ ...f6Result.worksheets[0], roiStatus: "computed", options: [{ ...completedOption, relativeCost: 100, roiScore: 0.006 }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, costEvidence: withoutReference },
          worksheets: [{ ...f6Result.worksheets[0], roiStatus: "computed", options: [{ ...completedOption, relativeCost: 100, roiScore: 0.006 }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, costEvidence },
          worksheets: [{ ...f6Result.worksheets[0], roiStatus: "computed", options: [{ ...completedOption, relativeCost: 100, roiScore: 0 }] }],
        }).success).toBe(false);
      });

      it("enforces ROI status and governed costs for every completed option", () => {
        const costReferences = [reference(costEvidence.source), costEvidence.roiCalculationReference];
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, costEvidence },
          worksheets: [{ ...f6Result.worksheets[0], options: fixedOptionsWith({ ...completedOption, evidenceReferences: [...completedOption.evidenceReferences, ...costReferences], relativeCost: 100, roiScore: "not_computed" }) }],
        }).success).toBe(true);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, costEvidence },
          worksheets: [{ ...f6Result.worksheets[0], options: [{ ...completedOption, relativeCost: 100, roiScore: 0.006 }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, costEvidence },
          worksheets: [{ ...f6Result.worksheets[0], options: [{ ...completedOption, relativeCost: 101, roiScore: "not_computed" }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [{ ...completedOption, relativeCost: 100, roiScore: "not_computed" }] }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, costEvidence },
          worksheets: [{ ...f6Result.worksheets[0], options: fixedOptionsWith({ ...completedOption, relativeCost: "insufficient_evidence", roiScore: "not_computed" }) }],
        }).success).toBe(true);
      });

      it("binds completed supplier and datum options to exact governed evidence scopes", () => {
        const supplierScope = {
          kind: "supplier", supplierReference: supplierEvidence.supplierReference,
          processFamily: supplierEvidence.processFamily, partCategory: supplierEvidence.partCategory,
          evidenceReference: { artifact: supplierEvidence.source, contentHash: supplierEvidence.contentHash },
        };
        const supplierOption = {
          ...completedOption,
          optionId: "supplier",
          optionKind: "improve_supplier_capability",
          impactRank: null,
          evidenceScope: supplierScope,
          scenarioEvidence: scenarioEvidenceFor("supplier"),
        };
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result, provenance: { ...f6Result.provenance, supplierCapabilityEvidence: [supplierEvidence] },
          worksheets: [{ ...f6Result.worksheets[0], options: fixedOptionsWith(supplierOption), recommendations: [], highestImpactAction: undefined }],
          summary: { ...f6Result.summary, completedOptionCount: 3, insufficientEvidenceOptionCount: 1 },
        }).success).toBe(true);
        for (const supplierCapabilityEvidence of [[], [{ ...supplierEvidence, supplierReference: "supplier-b" }], [supplierEvidence, { ...supplierEvidence }]]) {
          expect(f6OptimizationResultSchema.safeParse({
            ...f6Result, provenance: { ...f6Result.provenance, supplierCapabilityEvidence },
            worksheets: [{ ...f6Result.worksheets[0], options: [supplierOption], recommendations: [], highestImpactAction: undefined }],
          }).success).toBe(false);
        }
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result, provenance: { ...f6Result.provenance, supplierCapabilityEvidence: [supplierEvidence] },
          worksheets: [{ ...f6Result.worksheets[0], options: [{ ...supplierOption, evidenceScope: { ...supplierScope, evidenceReference: reference("unrelated.json") } }], recommendations: [], highestImpactAction: undefined }],
        }).success).toBe(false);

        const exactDatumEvidence = {
          ...datumEvidence,
          factorDirections: [
            { tableId: "table-a", sourceRow: 2, direction: 1 },
            { tableId: "table-b", sourceRow: 3, direction: -1 },
          ],
        };
        const datumScope = {
          kind: "datum",
          worksheetName: exactDatumEvidence.worksheetName,
          factorSources: exactDatumEvidence.factorDirections,
          evidenceReference: { artifact: exactDatumEvidence.source, contentHash: exactDatumEvidence.contentHash },
        };
        const datumOption = {
          ...completedOption,
          optionId: "datum",
          optionKind: "tighten_datum_strategy",
          impactRank: null,
          evidenceScope: datumScope,
          scenarioEvidence: scenarioEvidenceFor("datum"),
        };
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result, provenance: { ...f6Result.provenance, datumEvidence: [exactDatumEvidence] },
          worksheets: [{ ...f6Result.worksheets[0], options: fixedOptionsWith(datumOption), recommendations: [], highestImpactAction: undefined }],
          summary: { ...f6Result.summary, completedOptionCount: 3, insufficientEvidenceOptionCount: 1 },
        }).success).toBe(true);
        for (const evidenceScope of [
          { ...datumScope, factorSources: [{ tableId: "table-a", sourceRow: 2, direction: -1 }, datumScope.factorSources[1]] },
          { ...datumScope, factorSources: [datumScope.factorSources[0]] },
          { ...datumScope, factorSources: [...datumScope.factorSources, { tableId: "table-c", sourceRow: 4, direction: 1 }] },
          { ...datumScope, factorSources: [datumScope.factorSources[0], { ...datumScope.factorSources[0] }] },
          { ...datumScope, evidenceReference: reference("unrelated.json") },
        ]) {
          expect(f6OptimizationResultSchema.safeParse({
            ...f6Result, provenance: { ...f6Result.provenance, datumEvidence: [exactDatumEvidence] },
            worksheets: [{ ...f6Result.worksheets[0], options: [{ ...datumOption, evidenceScope }], recommendations: [], highestImpactAction: undefined }],
          }).success).toBe(false);
        }
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, datumEvidence: [{ ...exactDatumEvidence, factorDirections: [...exactDatumEvidence.factorDirections, { tableId: "table-c", sourceRow: 4, direction: 1 }] }] },
          worksheets: [{ ...f6Result.worksheets[0], options: [datumOption], recommendations: [], highestImpactAction: undefined }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result, provenance: { ...f6Result.provenance, datumEvidence: [] },
          worksheets: [{ ...f6Result.worksheets[0], options: [datumOption], recommendations: [], highestImpactAction: undefined }],
        }).success).toBe(false);
        expect(f6OptimizationResultSchema.safeParse({
          ...f6Result,
          worksheets: [{ ...f6Result.worksheets[0], options: [{ ...completedOption, evidenceScope: supplierScope }] }],
        }).success).toBe(false);
      });

      it("requires exact governed scopes when insufficient options reference evidence", () => {
        const insufficientOption = {
          status: "insufficient_evidence",
          optionId: "supplier-insufficient",
          optionKind: "improve_supplier_capability",
          predictedImprovement: "insufficient_evidence",
          requiredInputs: ["supplier capability study"],
          evidenceReferences: [],
          relativeCost: "insufficient_evidence",
          roiScore: "not_computed",
          impactRank: null,
        } as const;
        const supplierScope = {
          kind: "supplier" as const,
          supplierReference: supplierEvidence.supplierReference,
          processFamily: supplierEvidence.processFamily,
          partCategory: supplierEvidence.partCategory,
          evidenceReference: { artifact: supplierEvidence.source, contentHash: supplierEvidence.contentHash },
        };
        const datumScope = {
          kind: "datum" as const,
          worksheetName: datumEvidence.worksheetName,
          factorSources: datumEvidence.factorDirections,
          evidenceReference: { artifact: datumEvidence.source, contentHash: datumEvidence.contentHash },
        };
        const supplierReference = supplierScope.evidenceReference;
        const datumReference = datumScope.evidenceReference;
        const parseInsufficient = (option: object, provenance: object = {}) => f6OptimizationResultSchema.safeParse({
          ...f6Result,
          provenance: { ...f6Result.provenance, ...provenance },
          worksheets: [{ ...f6Result.worksheets[0], options: fixedOptionsWith(option) }],
        });

        expect(parseInsufficient(insufficientOption).success).toBe(true);
        expect(parseInsufficient(
          { ...insufficientOption, evidenceReferences: [supplierReference], evidenceScope: supplierScope },
          { supplierCapabilityEvidence: [supplierEvidence] },
        ).success).toBe(true);
        expect(parseInsufficient(
          { ...insufficientOption, optionId: "datum-insufficient", optionKind: "tighten_datum_strategy", evidenceReferences: [datumReference], evidenceScope: datumScope },
          { datumEvidence: [datumEvidence] },
        ).success).toBe(true);

        expect(parseInsufficient(
          { ...insufficientOption, evidenceReferences: [supplierReference] },
          { supplierCapabilityEvidence: [supplierEvidence] },
        ).success).toBe(false);
        expect(parseInsufficient(
          { ...insufficientOption, evidenceReferences: [reference("other.json")], evidenceScope: supplierScope },
          { supplierCapabilityEvidence: [supplierEvidence] },
        ).success).toBe(false);
        expect(parseInsufficient(
          { ...insufficientOption, evidenceScope: supplierScope },
          { supplierCapabilityEvidence: [supplierEvidence] },
        ).success).toBe(false);

        expect(parseInsufficient(
          { ...insufficientOption, evidenceReferences: [datumReference], evidenceScope: datumScope },
          { datumEvidence: [datumEvidence] },
        ).success).toBe(false);
        expect(parseInsufficient(
          { ...insufficientOption, optionId: "datum-insufficient", optionKind: "tighten_datum_strategy", evidenceReferences: [supplierReference], evidenceScope: supplierScope },
          { supplierCapabilityEvidence: [supplierEvidence] },
        ).success).toBe(false);
        expect(parseInsufficient(
          { ...insufficientOption, evidenceReferences: [supplierReference], evidenceScope: { ...supplierScope, evidenceReference: reference("unrelated.json") } },
          { supplierCapabilityEvidence: [supplierEvidence] },
        ).success).toBe(false);
        expect(parseInsufficient(
          { ...insufficientOption, evidenceReferences: [supplierReference], evidenceScope: { ...supplierScope, supplierReference: "unrelated-supplier" } },
          { supplierCapabilityEvidence: [supplierEvidence] },
        ).success).toBe(false);
        expect(parseInsufficient(
          { ...insufficientOption, optionId: "datum-insufficient", optionKind: "tighten_datum_strategy", evidenceReferences: [datumReference], evidenceScope: { ...datumScope, factorSources: [{ ...datumScope.factorSources[0], direction: -1 }] } },
          { datumEvidence: [datumEvidence] },
        ).success).toBe(false);
      });

      it("accepts strict chat proposals while rejecting governed authority leakage", () => {
        const contextProposal = {
          proposalVersion: "f6-analysis-context-proposal-v1",
          userText: "橡胶压缩会影响装配间隙，500g load 是关键工况。",
          worksheetSelectors: ["gap w rubber_TPoverload500g"],
          analysisObjectKind: "GAP",
          functionalBoundary: "TP bracket to battery gap",
          operatingConditions: ["500g load"],
          clarifications: [],
        } as const;

        const targetsProposal = {
          proposalVersion: "f6-optimization-targets-proposal-v1",
          userText: "优先评估 mean shift，再看 battery flatness tolerance。",
          directions: [
            { adjustmentClass: "system_mean_shift", worksheetSelector: "gap w rubber_TPoverload500g" },
            { adjustmentClass: "factor_tolerance", worksheetSelector: "gap w rubber_TPoverload500g", factorSelector: "battery flatness" },
          ],
          clarifications: [],
        } as const;

        expect(f6AnalysisContextProposalSchema.parse(contextProposal)).toEqual(contextProposal);
        expect(f6OptimizationTargetsProposalSchema.parse(targetsProposal)).toEqual(targetsProposal);
        expect(f6InputProposalSchema.parse(contextProposal)).toEqual(contextProposal);
        expect(f6InputProposalSchema.parse(targetsProposal)).toEqual(targetsProposal);

        expect(f6AnalysisContextProposalSchema.safeParse({ ...contextProposal, workbookContentHash: "a".repeat(64) }).success).toBe(false);
        expect(f6OptimizationTargetsProposalSchema.safeParse({ ...targetsProposal, contentHash: "b".repeat(64) }).success).toBe(false);
        expect(f6OptimizationTargetsProposalSchema.safeParse({ ...targetsProposal, cpk: 1.33 }).success).toBe(false);
        expect(f6OptimizationTargetsProposalSchema.safeParse({ ...targetsProposal, deltaCpk: 0.12 }).success).toBe(false);
        expect(f6AnalysisContextProposalSchema.safeParse({ ...contextProposal, baselineIdentity: { workbookContentHash: "a".repeat(64) } }).success).toBe(false);
        expect(f6AnalysisContextProposalSchema.safeParse({ ...contextProposal, unknownField: true }).success).toBe(false);
      });

      it("allows explicit numeric targets but blocks model-authored calculation outputs", () => {
        const targetsProposal = {
          proposalVersion: "f6-optimization-targets-proposal-v1",
          userText: "请把均值拉到目标值并收紧平坦度公差。",
          directions: [
            {
              adjustmentClass: "system_mean_shift",
              worksheetSelector: "gap w rubber_TPoverload500g",
              numericTarget: { field: "target_mean", value: 0.13, unit: "mm" },
            },
            {
              adjustmentClass: "factor_tolerance",
              worksheetSelector: "gap w rubber_TPoverload500g",
              factorSelector: "battery flatness",
              numericTarget: { field: "upper_tolerance", value: 0.05, unit: "mm" },
            },
          ],
          clarifications: [],
        } as const;

        expect(f6OptimizationTargetsProposalSchema.parse(targetsProposal)).toEqual(targetsProposal);
        expect(f6OptimizationTargetsProposalSchema.safeParse({
          ...targetsProposal,
          directions: [{ ...targetsProposal.directions[0], numericTarget: { field: "cpk", value: 1.67, unit: "" } }],
        }).success).toBe(false);
        expect(f6OptimizationTargetsProposalSchema.safeParse({
          ...targetsProposal,
          directions: [{ ...targetsProposal.directions[0], calculationResult: { cpk: 1.67 } }],
        }).success).toBe(false);
      });

      it("materializes proposal drafts without workbook/table/source-row authority", () => {
        const clarification = {
          clarificationId: "clarify-analysis-object",
          question: "请确认分析对象边界与方向。",
          requiredFields: ["analysisObjectKind", "functionalBoundary"],
        } as const;
        expect(f6InputClarificationSchema.parse(clarification)).toEqual(clarification);

        const draft = {
          draftVersion: "f6-materialized-draft-v1",
          draftId: "f6-context-draft-1",
          draftHash: "a".repeat(64),
          kind: "analysis_context",
          proposal: {
            proposalVersion: "f6-analysis-context-proposal-v1",
            userText: "请按 500g load 定义 GAP 分析上下文。",
            worksheetSelectors: ["gap w rubber_TPoverload500g"],
            analysisObjectKind: "GAP",
            clarifications: [clarification],
          },
        } as const;

        expect(f6MaterializedDraftSchema.parse(draft)).toEqual(draft);
        expect(f6MaterializedDraftSchema.safeParse({
          ...draft,
          proposal: {
            ...draft.proposal,
            tableId: "table-a",
          },
        }).success).toBe(false);
        expect(f6MaterializedDraftSchema.safeParse({
          ...draft,
          proposal: {
            ...draft.proposal,
            sourceRow: 2,
          },
        }).success).toBe(false);
        expect(f6MaterializedDraftSchema.safeParse({
          ...draft,
          proposal: {
            ...draft.proposal,
            artifactPath: "artifacts/f6.json",
          },
        }).success).toBe(false);

        const contextArtifact = {
          contractVersion: "v1",
          inputClassification: "confidential",
          contextVersion: "f6-analysis-context-v2",
          workbookContentHash: "a".repeat(64),
          worksheets: [{
            worksheetName: "gap w rubber_TPoverload500g",
            tableId: "table-gap-1",
            baselineIdentity: {
              calculationVersion: "excel-ta-v1",
              projectReference: "project-a",
              runReference: "f4-run-a",
              workbookContentHash: "a".repeat(64),
              worksheetName: "gap w rubber_TPoverload500g",
              tableId: "table-gap-1",
            },
            engineeringNarrative: "请按 500g load 定义 GAP 分析上下文。",
            operatingConditions: [],
            correlationRequirement: { mode: "NOT_PROVIDED" },
          }],
        } as const;

        const contextResult = {
          status: "draft_ready",
          artifact: contextArtifact,
          preview: {
            reviewContextId: "review-context-2",
            worksheetBindings: [{
              selector: "gap w rubber_TPoverload500g",
              worksheetName: "gap w rubber_TPoverload500g",
              tableId: "table-gap-1",
            }],
            artifact: contextArtifact,
          },
        } as const;
        expect(f6MaterializationResultSchema.parse(contextResult)).toEqual(contextResult);

        const qualitativeOnlyResult = {
          status: "draft_ready",
          preview: {
            reviewContextId: "review-context-2",
            qualitativeDirections: [{
              adjustmentClass: "factor_sigma",
              worksheetName: "gap w rubber_TPoverload500g",
              factor: {
                worksheetName: "gap w rubber_TPoverload500g",
                tableId: "table-gap-1",
                sourceRow: 14,
                factorName: "battery flatness",
                unit: "mm",
              },
            }],
          },
        } as const;
        expect(f6MaterializationResultSchema.parse(qualitativeOnlyResult)).toEqual(qualitativeOnlyResult);

        const materializationResultWithDraft = {
          status: "draft_ready",
          draft,
        } as const;
        expect(f6MaterializationResultSchema.safeParse(materializationResultWithDraft).success).toBe(false);
      });

      it("preserves the legacy feature_not_available comparison contracts", () => {
        const legacyRequest = { contractVersion: "v1", inputClassification: "confidential", projectReference: "project", runReference: "run", worksheetReferences: ["Analysis-A"] };
        const legacyResult = { contractVersion: "v1", outputClassification: "confidential", featureId: "F6", status: "feature_not_available", projectReference: "project", runReference: "run", worksheetReferences: ["Analysis-A"], requiredPrerequisites: ["approved-knowledge-base"] };
        expect(comparisonRequestSchema.parse(legacyRequest)).toEqual(legacyRequest);
        expect(comparisonResultSchema.parse(legacyResult)).toEqual(legacyResult);
      });
    });
  });
});

describe("F6 comparison placeholder contracts", () => {
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
  };

  const result = {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F6",
    status: "feature_not_available",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
    requiredPrerequisites: ["approved-knowledge-base"],
  };

  it("accepts only confidential controlled references and a fixed unavailable result", () => {
    expect(comparisonRequestSchema.parse(request)).toEqual(request);
    expect(comparisonResultSchema.parse(result)).toEqual(result);
  });

  it("rejects public classification, unknown fields, and altered prerequisites", () => {
    expect(comparisonRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(comparisonRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(comparisonResultSchema.safeParse({ ...result, requiredPrerequisites: [] }).success).toBe(false);
  });
});

describe("F4 workflow and excel comparison contracts", () => {
  const contentHash = "d".repeat(64);

  const calculationTemplate = {
    contractVersion: "v1" as const,
    outputClassification: "confidential" as const,
    featureId: "F4" as const,
    status: "completed" as const,
    calculationVersion: "excel-ta-v1" as const,
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    workbookContentHash: contentHash,
    worksheetSelection: {
      worksheetName: "Analysis-A",
      tableId: "table-a",
    },
    factorCount: 1,
    recommendation: {
      method: "worst_case" as const,
      reason: "factor_count_1_to_3" as const,
      refer3d: false,
      criticality: "none" as const,
      criticalityRisk: false,
    },
    factors: [{
      factorName: "Feature-A",
      unit: "mm",
      source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
      input: {
        nominalValue: 12.45,
        upperTolerance: 0.2,
        lowerTolerance: -0.2,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "normal" as const,
      },
      mean: 12.46,
      halfTolerance: 0.2,
      sigma: 0.05,
      contribution: 1,
      trace: {
        formulaIds: ["factor-mean-v1", "factor-sigma-v1"],
        sourceCells: ["Analysis-A!A2", "Analysis-A!B2"],
      },
    }],
    system: {
      designNominal: 12.5,
      mean: 12.46,
      additionalMeanShift: 0,
      worstCaseUpper: 0.2,
      worstCaseLower: -0.2,
      rssSigma: 0.05,
    },
    capability: {
      lowerSpecLimit: 12.1,
      upperSpecLimit: 12.9,
      targetSigmaLevel: 4,
      targetCpk: 1.33,
      cp: 2.6666666666666665,
      lowerCpk: 2.4,
      upperCpk: 2.933333333333333,
      cpk: 2.4,
      lowerZ: 7.2,
      upperZ: 8.8,
      lowerDpm: 0.1,
      upperDpm: 0.2,
      totalDpm: 0.30000000000000004,
      outOfSpecRatio: 3.0000000000000004e-7,
      yield: 0.9999997,
      status: "PASS" as const,
    },
    traceRecords: [{
      outputField: "capability.cpk",
      formulaVersion: "excel-ta-v1" as const,
      formulaId: "cpk-v1" as const,
      sourceCells: ["capability.lowerCpk", "capability.upperCpk"],
    }],
    scenarios: [],
  };

  it("accepts a strict F4 workflow output based on F2 report source", () => {
    const valid = {
      contractVersion: "v1",
      workflowVersion: "f4-f2-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "completed",
      runId: "controlled-run-reference",
      generatedAt: "2026-08-07T00:00:00.000Z",
      source: {
        artifactReference: "Feature2-Report.json",
        workbookFileName: "Anonymous.xlsx",
        workbookContentHash: contentHash,
      },
      calculations: [
        calculationTemplate,
        {
          ...structuredClone(calculationTemplate),
          worksheetSelection: { worksheetName: "Analysis-B", tableId: "table-b" },
          factors: [{
            ...calculationTemplate.factors[0],
            source: { worksheetName: "Analysis-B", tableId: "table-b", sourceRow: 2 },
          }],
        },
      ],
      summary: {
        selectedWorksheetCount: 2,
        completedWorksheetCount: 2,
      },
    };

    expect(f4WorkflowCalculationResultSchema.parse(valid)).toEqual(valid);
  });

  it("rejects duplicate worksheet names, workbook hash mismatch, and summary mismatch", () => {
    const valid = {
      contractVersion: "v1",
      workflowVersion: "f4-f2-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "completed",
      runId: "controlled-run-reference",
      generatedAt: "2026-08-07T00:00:00.000Z",
      source: {
        artifactReference: "Feature2-Report.json",
        workbookFileName: "Anonymous.xlsx",
        workbookContentHash: contentHash,
      },
      calculations: [
        calculationTemplate,
        {
          ...structuredClone(calculationTemplate),
          worksheetSelection: { worksheetName: "Analysis-B", tableId: "table-b" },
          factors: [{
            ...calculationTemplate.factors[0],
            source: { worksheetName: "Analysis-B", tableId: "table-b", sourceRow: 2 },
          }],
        },
      ],
      summary: {
        selectedWorksheetCount: 2,
        completedWorksheetCount: 2,
      },
    };

    expect(f4WorkflowCalculationResultSchema.safeParse({
      ...valid,
      calculations: [
        valid.calculations[0],
        { ...valid.calculations[1], worksheetSelection: { worksheetName: "Analysis-A", tableId: "table-b" } },
      ],
    }).success).toBe(false);

    expect(f4WorkflowCalculationResultSchema.safeParse({
      ...valid,
      calculations: [
        valid.calculations[0],
        { ...valid.calculations[1], workbookContentHash: "e".repeat(64) },
      ],
    }).success).toBe(false);

    expect(f4WorkflowCalculationResultSchema.safeParse({ ...valid, summary: { ...valid.summary, selectedWorksheetCount: 3 } }).success).toBe(false);
    expect(f4WorkflowCalculationResultSchema.safeParse({ ...valid, summary: { ...valid.summary, completedWorksheetCount: 1 } }).success).toBe(false);
    expect(f4WorkflowCalculationResultSchema.safeParse({ ...valid, unexpected: true }).success).toBe(false);
    expect(f4WorkflowCalculationResultSchema.safeParse({ ...valid, summary: { ...valid.summary, unexpected: 1 } }).success).toBe(false);
    expect(f4WorkflowCalculationResultSchema.safeParse({
      ...valid,
      summary: {
        ...valid.summary,
        calculationCount: 2,
        worksheetCount: 2,
        factorCount: 2,
      },
    }).success).toBe(false);
  });

  it("rejects unsafe workbook filenames in workflow source", () => {
    const valid = {
      contractVersion: "v1",
      workflowVersion: "f4-f2-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "completed",
      runId: "controlled-run-reference",
      generatedAt: "2026-08-07T00:00:00.000Z",
      source: {
        artifactReference: "Feature2-Report.json",
        workbookFileName: "Anonymous.xlsx",
        workbookContentHash: contentHash,
      },
      calculations: [calculationTemplate],
      summary: {
        selectedWorksheetCount: 1,
        completedWorksheetCount: 1,
      },
    };

    const rejectedFileNames = [
      "C:\\temp\\Anonymous.xlsx",
      "\\\\server\\share\\Anonymous.xlsx",
      "..\\Anonymous.xlsx",
      "Anonymous\u0001.xlsx",
      "Anonymous.xls",
      "C:Anonymous.xlsx",
      "Anonymous.xlsx:payload.xlsx",
      "CON.xlsx",
      "com1.xlsx",
      "name?.xlsx",
      "Anonymous.xlsx ",
      "Anonymous.xlsx.",
      "Anonymous .xlsx",
      "Anonymous..xlsx",
      "CON.backup.xlsx",
      "nul.anything.xlsx",
      "COM1.log.xlsx",
    ];

    for (const workbookFileName of rejectedFileNames) {
      expect(f4WorkflowCalculationResultSchema.safeParse({
        ...valid,
        source: { ...valid.source, workbookFileName },
      }).success).toBe(false);
    }
  });

  it("accepts passed and mismatch excel comparison results", () => {
    const absoluteDifference = Math.abs(2.4 - 2.399);
    const denominator = Math.max(1, Math.abs(2.4), Math.abs(2.399));
    const relativeDifference = absoluteDifference / denominator;

    const passed = {
      contractVersion: "v1",
      comparisonVersion: "f4-excel-comparison-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "passed",
      runId: "controlled-run-reference",
      generatedAt: "2026-08-07T00:00:00.000Z",
      source: {
        workbookContentHash: contentHash,
      },
      worksheets: [{
        worksheetName: "Analysis-A",
        metrics: [{
          metric: "cpk",
          f4Value: 2.4,
          excelValue: 2.4,
          excelDisplayText: "2.4",
          absoluteDifference: 0,
          relativeDifference: 0,
          tolerance: 1e-12,
          passed: true,
          sourceCell: "Analysis-A!P10",
          excelFormula: "=P8/P9",
          f4FormulaId: "cpk-v1",
        }],
      }],
      summary: {
        worksheetCount: 1,
        metricCount: 1,
        passedMetricCount: 1,
        mismatchMetricCount: 0,
      },
    };

    const mismatch = {
      ...passed,
      status: "mismatch",
      worksheets: [{
        worksheetName: "Analysis-A",
        metrics: [{
          ...passed.worksheets[0].metrics[0],
          excelValue: 2.399,
          excelDisplayText: "2.399",
          absoluteDifference,
          relativeDifference,
          passed: false,
        }],
      }],
      summary: {
        worksheetCount: 1,
        metricCount: 1,
        passedMetricCount: 0,
        mismatchMetricCount: 1,
      },
    };

    expect(f4ExcelComparisonResultSchema.parse(passed)).toEqual(passed);
    expect(f4ExcelComparisonResultSchema.parse(mismatch)).toEqual(mismatch);
  });

  it("rejects inconsistent comparison metric invariants", () => {
    const absoluteDifference = Math.abs(2.4 - 2.399);
    const denominator = Math.max(1, Math.abs(2.4), Math.abs(2.399));
    const relativeDifference = absoluteDifference / denominator;
    const base = {
      contractVersion: "v1",
      comparisonVersion: "f4-excel-comparison-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "mismatch",
      runId: "controlled-run-reference",
      generatedAt: "2026-08-07T00:00:00.000Z",
      source: {
        workbookContentHash: contentHash,
      },
      worksheets: [{
        worksheetName: "Analysis-A",
        metrics: [{
          metric: "cpk",
          f4Value: 2.4,
          excelValue: 2.399,
          excelDisplayText: "2.399",
          absoluteDifference,
          relativeDifference,
          tolerance: 1e-12,
          passed: false,
          sourceCell: "Analysis-A!P10",
          excelFormula: "=P8/P9",
          f4FormulaId: "cpk-v1",
        }],
      }],
      summary: {
        worksheetCount: 1,
        metricCount: 1,
        passedMetricCount: 0,
        mismatchMetricCount: 1,
      },
    };

    expect(f4ExcelComparisonResultSchema.parse(base)).toEqual(base);

    expect(f4ExcelComparisonResultSchema.safeParse({
      ...base,
      worksheets: [{
        ...base.worksheets[0],
        metrics: [{ ...base.worksheets[0].metrics[0], absoluteDifference: -absoluteDifference }],
      }],
    }).success).toBe(false);

    expect(f4ExcelComparisonResultSchema.safeParse({
      ...base,
      worksheets: [{
        ...base.worksheets[0],
        metrics: [{ ...base.worksheets[0].metrics[0], absoluteDifference: absoluteDifference + 1e-4 }],
      }],
    }).success).toBe(false);

    expect(f4ExcelComparisonResultSchema.safeParse({
      ...base,
      worksheets: [{
        ...base.worksheets[0],
        metrics: [{ ...base.worksheets[0].metrics[0], relativeDifference: relativeDifference + 1e-4 }],
      }],
    }).success).toBe(false);

    expect(f4ExcelComparisonResultSchema.safeParse({
      ...base,
      worksheets: [{
        ...base.worksheets[0],
        metrics: [{ ...base.worksheets[0].metrics[0], relativeDifference: -relativeDifference }],
      }],
    }).success).toBe(false);

    expect(f4ExcelComparisonResultSchema.safeParse({
      ...base,
      worksheets: [{
        ...base.worksheets[0],
        metrics: [{ ...base.worksheets[0].metrics[0], passed: true }],
      }],
      summary: {
        worksheetCount: 1,
        metricCount: 1,
        passedMetricCount: 1,
        mismatchMetricCount: 0,
      },
      status: "passed",
    }).success).toBe(false);
  });
  
  it("rejects metrics whose derived differences overflow even when claimed differences are finite", () => {
    const overflowPayload = {
      contractVersion: "v1",
      comparisonVersion: "f4-excel-comparison-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "mismatch",
      runId: "controlled-run-reference",
      generatedAt: "2026-08-07T00:00:00.000Z",
      source: {
        workbookContentHash: contentHash,
      },
      worksheets: [{
        worksheetName: "Analysis-A",
        metrics: [{
          metric: "cpk",
          f4Value: Number.MAX_VALUE,
          excelValue: -Number.MAX_VALUE,
          excelDisplayText: "overflow",
          absoluteDifference: 0,
          relativeDifference: 0,
          tolerance: 1e-12,
          passed: false,
          sourceCell: "Analysis-A!P10",
          excelFormula: "=P8/P9",
          f4FormulaId: "cpk-v1",
        }],
      }],
      summary: {
        worksheetCount: 1,
        metricCount: 1,
        passedMetricCount: 0,
        mismatchMetricCount: 1,
      },
    };

    expect(f4ExcelComparisonResultSchema.safeParse(overflowPayload).success).toBe(false);
  });

  it("rejects unknown fields, missing formula evidence, non-finite differences, and invalid summary", () => {
    const passed = {
      contractVersion: "v1",
      comparisonVersion: "f4-excel-comparison-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "passed",
      runId: "controlled-run-reference",
      generatedAt: "2026-08-07T00:00:00.000Z",
      source: {
        workbookContentHash: contentHash,
      },
      worksheets: [{
        worksheetName: "Analysis-A",
        metrics: [{
          metric: "cpk",
          f4Value: 2.4,
          excelValue: 2.4,
          excelDisplayText: "2.4",
          absoluteDifference: 0,
          relativeDifference: 0,
          tolerance: 1e-12,
          passed: true,
          sourceCell: "Analysis-A!P10",
          excelFormula: "=P8/P9",
          f4FormulaId: "cpk-v1",
        }],
      }],
      summary: {
        worksheetCount: 1,
        metricCount: 1,
        passedMetricCount: 1,
        mismatchMetricCount: 0,
      },
    };

    expect(f4ExcelComparisonResultSchema.safeParse({
      contractVersion: "v1",
      comparisonVersion: "f4-excel-comparison-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "excel_unavailable",
      runId: "controlled-run-reference",
      generatedAt: "2026-08-07T00:00:00.000Z",
      reasonCode: "excel_runtime_unavailable",
      rawError: "must-not-leak",
    }).success).toBe(false);

    expect(f4ExcelComparisonResultSchema.safeParse({
      ...passed,
      worksheets: [{
        ...passed.worksheets[0],
        metrics: [{ ...passed.worksheets[0].metrics[0], excelFormula: " " }],
      }],
    }).success).toBe(false);

    expect(f4ExcelComparisonResultSchema.safeParse({
      ...passed,
      worksheets: [{
        ...passed.worksheets[0],
        metrics: [{ ...passed.worksheets[0].metrics[0], f4FormulaId: "   " }],
      }],
    }).success).toBe(false);

    expect(f4ExcelComparisonResultSchema.safeParse({
      ...passed,
      worksheets: [{
        ...passed.worksheets[0],
        metrics: [{ ...passed.worksheets[0].metrics[0], absoluteDifference: Number.POSITIVE_INFINITY }],
      }],
    }).success).toBe(false);

    expect(f4ExcelComparisonResultSchema.safeParse({
      ...passed,
      status: "mismatch",
      summary: {
        worksheetCount: 1,
        metricCount: 1,
        passedMetricCount: 1,
        mismatchMetricCount: 0,
      },
    }).success).toBe(false);
  });
});

describe("F7 Cpk placeholder contracts", () => {
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
  };

  const result = {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F7",
    status: "feature_not_available",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
    requiredPrerequisites: ["approved-measurement-store"],
  };

  it("accepts only confidential controlled references and a fixed unavailable result", () => {
    expect(cpkRequestSchema.parse(request)).toEqual(request);
    expect(cpkResultSchema.parse(result)).toEqual(result);
  });

  it("rejects public classification, unknown fields, and altered prerequisites", () => {
    expect(cpkRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(cpkRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(cpkResultSchema.safeParse({ ...result, requiredPrerequisites: [] }).success).toBe(false);
  });
});

describe("F8 public workflow contracts", () => {
  const request = {
    contractVersion: "v1",
    workflowId: "public-smoke",
    inputClassification: "public",
    message: "anonymous smoke message",
  };

  const result = {
    contractVersion: "v1",
    workflowId: "public-smoke",
    outputClassification: "public",
    runId: "00000000-0000-4000-8000-000000000001",
    manifestValid: true,
    executedSkillIds: ["public-echo", "classification-check"],
  };

  it("accepts the fixed public smoke request and result", () => {
    expect(workflowRequestSchema.parse(request)).toEqual(request);
    expect(workflowResultSchema.parse(result)).toEqual(result);
  });

  it("rejects non-public input, unknown fields, invalid messages, and altered skill order", () => {
    expect(workflowRequestSchema.safeParse({ ...request, inputClassification: "confidential" }).success).toBe(false);
    expect(workflowRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(workflowRequestSchema.safeParse({ ...request, message: " " }).success).toBe(false);
    expect(workflowResultSchema.safeParse({ ...result, executedSkillIds: ["classification-check", "public-echo"] }).success).toBe(false);
  });
});

describe("knowledge-base contracts", () => {
  const publicManifest = {
    contractVersion: "v1",
    knowledgeBaseVersion: "v1",
    classification: "public",
    releasedAt: "2026-07-22",
    changeSummary: "Public knowledge-base manifest for capability discovery.",
    libraries: [
      {
        libraryId: "capability-library",
        contractId: "capability-library-v1",
        entryCount: 1,
        coverage: ["demo-bracket"],
        contentHash: "a".repeat(64),
      },
      {
        libraryId: "capability-item-mapping",
        contractId: "capability-item-mapping-v1",
        entryCount: 2,
        coverage: ["public demo coverage"],
        contentHash: "d".repeat(64),
      },
      {
        libraryId: "engineering-rules",
        contractId: "engineering-rules-v1",
        entryCount: 3,
        coverage: ["sigma", "cpk"],
        contentHash: "b".repeat(64),
      },
      {
        libraryId: "terminology-ontology",
        contractId: "terminology-ontology-v1",
        entryCount: 2,
        coverage: ["part-category", "datum"],
        contentHash: "c".repeat(64),
      },
    ],
  };

  it("accepts a public v1 knowledge-base manifest", () => {
    expect(knowledgeBaseManifestSchema.parse(publicManifest).classification).toBe("public");
  });

  it("rejects a manifest with a duplicate library ID", () => {
    expect(() =>
      knowledgeBaseManifestSchema.parse({
        ...publicManifest,
        libraries: [
          publicManifest.libraries[0],
          publicManifest.libraries[0],
          publicManifest.libraries[2],
          publicManifest.libraries[3],
        ],
      }),
    ).toThrow();
  });

  it("rejects a manifest whose library has a mismatched contract ID", () => {
    expect(() =>
      knowledgeBaseManifestSchema.parse({
        ...publicManifest,
        libraries: [
          { ...publicManifest.libraries[0], contractId: "engineering-rules-v1" },
          publicManifest.libraries[1],
          publicManifest.libraries[2],
          publicManifest.libraries[3],
        ],
      }),
    ).toThrow();
  });

  it("rejects unsupported tiers and non-public manifests", () => {
    expect(() => capabilityTierSchema.parse("T4")).toThrow();
    expect(() =>
      knowledgeBaseManifestSchema.parse({
        ...publicManifest,
        classification: "confidential",
      }),
    ).toThrow();
  });

  it("parses a capability entry with public field names", () => {
    expect(
      capabilityEntrySchema.parse({
        entryId: "demo-bracket-capability",
        partCategory: "demo-bracket",
        toleranceMin: 0.1,
        toleranceMax: 0.2,
        unit: "mm",
        recommendedDistribution: "normal",
        capabilityTier: "T1",
        provenance: {
          source: "fixture",
          confidence: 1,
          owner: "contracts-test",
          coverage: ["demo-bracket"],
          effectiveVersion: "v1",
          changeSummary: "Initial fixture.",
        },
      }),
    ).toMatchObject({ partCategory: "demo-bracket", capabilityTier: "T1" });
  });

  it("rejects infinite values in knowledge-base numeric fields", () => {
    const capabilityEntry = {
      entryId: "demo-bracket-capability",
      partCategory: "demo-bracket",
      toleranceMin: 0.1,
      toleranceMax: 0.2,
      unit: "mm" as const,
      recommendedDistribution: "normal" as const,
      capabilityTier: "T1" as const,
      provenance: {
        source: "fixture",
        confidence: 1,
        owner: "contracts-test",
        coverage: ["demo-bracket"],
        effectiveVersion: "v1" as const,
        changeSummary: "Initial fixture.",
      },
    };

    for (const infiniteValue of [Infinity, -Infinity]) {
      expect(
        capabilityEntrySchema.safeParse({
          ...capabilityEntry,
          provenance: { ...capabilityEntry.provenance, confidence: infiniteValue },
        }).success,
      ).toBe(false);
      expect(
        capabilityEntrySchema.safeParse({ ...capabilityEntry, toleranceMin: infiniteValue }).success,
      ).toBe(false);
      expect(
        capabilityEntrySchema.safeParse({ ...capabilityEntry, toleranceMax: infiniteValue }).success,
      ).toBe(false);
      expect(
        engineeringRuleEntrySchema.safeParse({
          ruleId: "cts-sigma",
          ruleType: "sigma",
          threshold: infiniteValue,
          unit: "sigma",
          applicability: "all capability studies",
          provenance: capabilityEntry.provenance,
        }).success,
      ).toBe(false);
      expect(
        knowledgeBaseQueryRequestSchema.safeParse({
          partCategory: "demo-bracket",
          tolerance: infiniteValue,
          unit: "mm",
        }).success,
      ).toBe(false);
    }
  });

  it("defaults omitted terminology aliases to an empty array", () => {
    expect(
      terminologyEntrySchema.parse({
        entryId: "demo-bracket",
        termType: "part-category",
        canonicalName: "Demo Bracket",
        definition: "A bracket used by contract fixtures.",
        provenance: {
          source: "fixture",
          confidence: 1,
          owner: "contracts-test",
          coverage: ["demo-bracket"],
          effectiveVersion: "v1",
          changeSummary: "Initial fixture.",
        },
      }).aliases,
    ).toEqual([]);
  });

  it("accepts empty terminology aliases", () => {
    expect(
      terminologyEntrySchema.parse({
        entryId: "demo-bracket",
        termType: "part-category",
        canonicalName: "Demo Bracket",
        aliases: [],
        definition: "A bracket used by contract fixtures.",
        provenance: {
          source: "fixture",
          confidence: 1,
          owner: "contracts-test",
          coverage: ["demo-bracket"],
          effectiveVersion: "v1",
          changeSummary: "Initial fixture.",
        },
      }).aliases,
    ).toEqual([]);
  });

  it("validates capability queries", () => {
    expect(
      knowledgeBaseQueryRequestSchema.parse({
        partCategory: "demo-bracket",
        tolerance: 0.2,
        unit: "mm",
      }),
    ).toMatchObject({ partCategory: "demo-bracket", tolerance: 0.2, unit: "mm" });
    expect(() =>
      knowledgeBaseQueryRequestSchema.parse({
        partCategory: "",
        tolerance: 0.2,
        unit: "mm",
      }),
    ).toThrow();
    expect(() =>
      knowledgeBaseQueryRequestSchema.parse({
        partCategory: "demo-bracket",
        tolerance: -0.1,
        unit: "mm",
      }),
    ).toThrow();
  });

  it("accepts unknown nonempty engineering rule IDs while rejecting malformed queries", () => {
    expect(engineeringRuleQuerySchema.parse({ ruleId: "not-a-rule" })).toEqual({
      ruleId: "not-a-rule",
    });
    expect(() => engineeringRuleQuerySchema.parse({ ruleId: "" })).toThrow();
    expect(() => engineeringRuleQuerySchema.parse({})).toThrow();
    expect(() => engineeringRuleQuerySchema.parse({ ruleId: "cts-sigma", extra: true })).toThrow();
  });

  it("rejects an engineering rule entry with an unknown stored rule ID", () => {
    expect(
      engineeringRuleEntrySchema.safeParse({
        ruleId: "unknown-stored-rule",
        ruleType: "sigma",
        threshold: 3,
        unit: "sigma",
        applicability: "all capability studies",
        provenance: {
          source: "fixture",
          confidence: 1,
          owner: "contracts-test",
          coverage: ["sigma"],
          effectiveVersion: "v1",
          changeSummary: "Initial fixture.",
        },
      }).success,
    ).toBe(false);
  });

  it("validates strict versioned knowledge-base query results", () => {
    const matchedCapability = knowledgeBaseQueryResultSchema.parse({
      queryType: "capability",
      status: "matched",
      contractVersion: "v1",
      knowledgeBaseVersion: "v1",
      entry: {
        entryId: "demo-bracket-capability",
        partCategory: "demo-bracket",
        toleranceMin: 0.1,
        toleranceMax: 0.2,
        unit: "mm",
        recommendedDistribution: "normal",
        capabilityTier: "T1",
        provenance: {
          source: "fixture",
          confidence: 1,
          owner: "contracts-test",
          coverage: ["demo-bracket"],
          effectiveVersion: "v1",
          changeSummary: "Initial fixture.",
        },
      },
    });
    const unknownCapability = {
      queryType: "capability" as const,
      status: "unknown" as const,
      contractVersion: "v1" as const,
      knowledgeBaseVersion: "v1" as const,
      capabilityTier: "T0" as const,
      message: "制程能力未知，请与供应商确认" as const,
    };

    expect(matchedCapability.queryType).toBe("capability");
    expect(knowledgeBaseQueryResultSchema.parse(unknownCapability)).toEqual(unknownCapability);
    expect(() => knowledgeBaseQueryResultSchema.parse({ ...unknownCapability, feasible: true })).toThrow();
  });
});

describe("internal tolerance guidance contracts", () => {
  const sourceMetadata = {
    sourceId: "cnc-capability-matrix-2026-q3",
    sourceFile: "cnc-capability-matrix.xlsx",
    sourceFileHash: "a".repeat(64),
    sourceVersion: "2026-Q3",
    sheetName: "CNC",
    sourceRange: "A1:B2",
    classification: "internal" as const,
  };

  const manifest = {
    contractVersion: "v1" as const,
    knowledgeBaseVersion: "internal-v1" as const,
    classification: "internal" as const,
    releasedAt: "2026-07-28",
    changeSummary: "Initial internal tolerance guidance snapshot.",
    sourceCount: 1,
    entryCount: 6,
    sourcesContentHash: "b".repeat(64),
    entriesContentHash: "c".repeat(64),
  };

  const evidence = {
    sourceFile: "cnc-capability-matrix.xlsx",
    sourceFileHash: "a".repeat(64),
    sheetName: "CNC",
    sourceRange: "A2:H2",
  };

  const entry = {
    entryId: "cnc-hole-diameter",
    processFamily: "cnc-machining",
    featureType: "hole-diameter",
    material: "aluminum",
    nominalRange: { min: 1, max: 25, unit: "mm" },
    maximumRecommendedTotalBand: { value: 0.1, unit: "mm" },
    fallbackPriority: 10,
    capabilityTier: "T1",
    provenance: {
      classification: "internal",
      sourceId: "cnc-capability-matrix-2026-q3",
      ...evidence,
      sourceVersion: "2026-Q3",
      owner: "knowledge-steward",
      confidence: 1,
      effectiveVersion: "internal-v1",
      changeSummary: "Reviewed CNC hole-diameter guidance.",
    },
  };

  const request = {
    processFamily: "cnc-machining",
    featureType: "hole-diameter",
    nominalValue: 12,
    nominalUnit: "mm",
    material: "aluminum",
    tolerance: { representation: "bilateral", value: 0.08, unit: "mm" },
  };

  const exceededResult = {
    status: "guidance-exceeded",
    knowledgeBaseVersion: "internal-v1",
    matchedEntryId: entry.entryId,
    assessedTotalBand: { value: 0.16, unit: "mm" },
    maximumRecommendedTotalBand: entry.maximumRecommendedTotalBand,
    fallbackApplied: false,
    evidence,
  };

  it("accepts a CNC bilateral request and guidance-exceeded DTO", () => {
    expect(internalToleranceGuidanceRequestSchema.parse(request)).toEqual(request);
    expect(internalToleranceGuidanceEntrySchema.parse(entry)).toEqual(entry);
    expect(internalToleranceGuidanceResultSchema.parse(exceededResult)).toEqual(exceededResult);
  });

  it("accepts strict nested entry and request conditions", () => {
    const conditions = {
      processMethod: "formed",
      materialFamily: "steel",
      thicknessMm: { min: 0.8, max: 1.2 },
      toleranceGrade: "TG6",
      dimensionType: "W" as const,
    };

    expect(internalToleranceGuidanceEntrySchema.parse({ ...entry, conditions }).conditions).toEqual(conditions);
    expect(internalToleranceGuidanceRequestSchema.parse({
      ...request,
      conditions: {
        processMethod: "formed",
        materialFamily: "steel",
        thicknessMm: 1,
        toleranceGrade: "TG6",
        dimensionType: "W",
      },
    }).conditions).toEqual({
      processMethod: "formed",
      materialFamily: "steel",
      thicknessMm: 1,
      toleranceGrade: "TG6",
      dimensionType: "W",
    });

    expect(internalToleranceGuidanceEntrySchema.safeParse({
      ...entry,
      conditions: { dimensionType: "X" },
    }).success).toBe(false);
    expect(internalToleranceGuidanceRequestSchema.safeParse({
      ...request,
      conditions: { thicknessMm: Number.NaN },
    }).success).toBe(false);
    expect(internalToleranceGuidanceEntrySchema.safeParse({
      ...entry,
      conditions: { thicknessMm: { min: 0.8, max: Infinity } },
    }).success).toBe(false);
    expect(internalToleranceGuidanceRequestSchema.safeParse({
      ...request,
      conditions: { dimensionType: "NW", unexpected: true },
    }).success).toBe(false);
  });

  it("accepts explicit range endpoint inclusion flags and rejects empty ranges", () => {
    expect(internalToleranceGuidanceEntrySchema.parse({
      ...entry,
      nominalRange: { min: 3, minInclusive: false, max: 6, maxInclusive: true, unit: "mm" },
      conditions: { thicknessMm: { min: 1, minInclusive: false, max: 3, maxInclusive: true } },
    })).toMatchObject({
      nominalRange: { min: 3, minInclusive: false, max: 6, maxInclusive: true, unit: "mm" },
      conditions: { thicknessMm: { min: 1, minInclusive: false, max: 3, maxInclusive: true } },
    });
    expect(internalToleranceGuidanceEntrySchema.safeParse({
      ...entry,
      nominalRange: { min: 6, minInclusive: false, max: 6, maxInclusive: true, unit: "mm" },
    }).success).toBe(false);
    expect(internalToleranceGuidanceEntrySchema.safeParse({
      ...entry,
      conditions: { thicknessMm: { min: 3, minInclusive: false, max: 3, maxInclusive: true } },
    }).success).toBe(false);
    expect(internalToleranceGuidanceEntrySchema.safeParse({
      ...entry,
      nominalRange: { min: 3, minInclusive: "false", max: 6, unit: "mm" },
    }).success).toBe(false);
  });

  it("accepts strict internal-v1 source metadata and manifest", () => {
    expect(internalToleranceGuidanceSourceMetadataSchema.parse(sourceMetadata)).toEqual(sourceMetadata);
    expect(internalToleranceGuidanceManifestSchema.parse(manifest)).toEqual(manifest);
  });

  it.each([
    ["source metadata", internalToleranceGuidanceSourceMetadataSchema, sourceMetadata],
    ["manifest", internalToleranceGuidanceManifestSchema, manifest],
  ])("rejects an extra field in internal-v1 %s", (_description, schema, value) => {
    expect(schema.safeParse({ ...value, unexpected: true }).success).toBe(false);
  });

  it.each([
    ["source metadata", internalToleranceGuidanceSourceMetadataSchema, sourceMetadata],
    ["manifest", internalToleranceGuidanceManifestSchema, manifest],
  ])("rejects public classification in internal-v1 %s", (_description, schema, value) => {
    expect(schema.safeParse({ ...value, classification: "public" }).success).toBe(false);
  });

  it.each([
    ["source metadata hash", internalToleranceGuidanceSourceMetadataSchema, { ...sourceMetadata, sourceFileHash: "A".repeat(64) }],
    ["source metadata range", internalToleranceGuidanceSourceMetadataSchema, { ...sourceMetadata, sourceRange: "A0:B2" }],
    ["manifest sources count", internalToleranceGuidanceManifestSchema, { ...manifest, sourceCount: -1 }],
    ["manifest entries count", internalToleranceGuidanceManifestSchema, { ...manifest, entryCount: 1.5 }],
    ["manifest sources hash", internalToleranceGuidanceManifestSchema, { ...manifest, sourcesContentHash: "B".repeat(64) }],
    ["manifest entries hash", internalToleranceGuidanceManifestSchema, { ...manifest, entriesContentHash: "C".repeat(64) }],
  ])("rejects invalid internal-v1 %s", (_description, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["public provenance", { ...entry, provenance: { ...entry.provenance, classification: "public" } }],
    ["an unsupported process", { ...entry, processFamily: "laser-cutting" }],
    ["a zero maximum threshold", { ...entry, maximumRecommendedTotalBand: { value: 0, unit: "mm" } }],
    ["absent evidence range", { ...entry, provenance: { ...entry.provenance, sourceRange: undefined } }],
    ["a malformed evidence range", { ...entry, provenance: { ...entry.provenance, sourceRange: "A0:B2" } }],
    ["an extra field", { ...entry, unexpected: true }],
  ])("rejects an entry with %s", (_description, invalidEntry) => {
    expect(internalToleranceGuidanceEntrySchema.safeParse(invalidEntry).success).toBe(false);
  });

  it("requires upper and lower values for unilateral tolerance", () => {
    expect(
      internalToleranceGuidanceRequestSchema.safeParse({
        ...request,
        tolerance: { representation: "unilateral", value: 0.1, unit: "mm", upperValue: 0.1 },
      }).success,
    ).toBe(false);
  });

  it.each([
    ["equal", 0.1, 0.1],
    ["reversed", 0.05, 0.1],
  ])("rejects %s unilateral tolerance values", (_description, upperValue, lowerValue) => {
    expect(
      internalToleranceGuidanceRequestSchema.safeParse({
        ...request,
        tolerance: { representation: "unilateral", value: 0.1, unit: "mm", upperValue, lowerValue },
      }).success,
    ).toBe(false);
  });

  it("rejects a unilateral tolerance whose value does not equal the total band", () => {
    expect(
      internalToleranceGuidanceRequestSchema.safeParse({
        ...request,
        tolerance: { representation: "unilateral", value: 0.1, unit: "mm", upperValue: 0.2, lowerValue: 0.05 },
      }).success,
    ).toBe(false);
  });

  it.each(["pass", "fail", "feasible", "tooTight"])("rejects unsupported output field %s", (field) => {
    expect(
      internalToleranceGuidanceResultSchema.safeParse({ ...exceededResult, [field]: true }).success,
    ).toBe(false);
  });
});

describe("workbook catalog contracts", () => {
  const confidentialRequest = {
    contractVersion: "v1",
    fileName: "anonymous-ta.xlsx",
    inputClassification: "confidential",
    workbookBytes: new Uint8Array([0x50, 0x4b, 3, 4]),
  };

  const confidentialResult = {
    contractVersion: "v1",
    workbook: {
      fileName: "anonymous-ta.xlsx",
      classification: "confidential",
      contentHash: "a".repeat(64),
      metadata: {
        documentNo: "TA-001",
        revision: "A",
        date: {
          value: "2026-07-23",
          formula: "=TODAY()",
          sourceCell: "Title Page!B6",
        },
      },
      worksheetInventory: [
        { worksheetName: "Auto Summary", worksheetIndex: 0, visibility: "visible", worksheetKind: "analysis", isTaAnalysis: true, sourcePart: "xl/worksheets/sheet1.xml" },
      ],
    },
    analyses: [
      {
        worksheetName: "Auto Summary",
        toleranceLoopDescription: "Cataloged tolerance analysis.",
        source: {
          summarySheet: "Auto Summary",
          summaryRow: 1,
          worksheetAnchor: "Auto Summary!A1",
        },
      },
    ],
  };

  it("accepts a confidential workbook catalog request", () => {
    expect(workbookCatalogRequestSchema.parse(confidentialRequest)).toEqual(confidentialRequest);
  });

  it("accepts an approved confidential workbook catalog result", () => {
    expect(workbookCatalogResultSchema.parse(confidentialResult)).toEqual(confidentialResult);
  });

  it.each([
    ["a non-contiguous worksheet index", [{ ...confidentialResult.workbook.worksheetInventory[0], worksheetIndex: 1 }]],
    ["a duplicate worksheet name", [...confidentialResult.workbook.worksheetInventory, { ...confidentialResult.workbook.worksheetInventory[0], worksheetIndex: 1, sourcePart: "xl/worksheets/sheet2.xml" }]],
    ["a duplicate source part", [...confidentialResult.workbook.worksheetInventory, { ...confidentialResult.workbook.worksheetInventory[0], worksheetName: "Analysis-B", worksheetIndex: 1 }]],
    ["an inconsistent TA marker", [{ ...confidentialResult.workbook.worksheetInventory[0], isTaAnalysis: false }]],
  ])("rejects a result with %s", (_description, worksheetInventory) => {
    expect(workbookCatalogResultSchema.safeParse({
      ...confidentialResult,
      workbook: { ...confidentialResult.workbook, worksheetInventory },
    }).success).toBe(false);
  });

  it.each([
    ["a Windows path", { ...confidentialRequest, fileName: "C:\\private\\anonymous-ta.xlsx" }],
    ["a drive-relative path", { ...confidentialRequest, fileName: "C:Anonymous.xlsx" }],
    ["an ADS path", { ...confidentialRequest, fileName: "Anonymous.xlsx:payload.xlsx" }],
    ["a reserved device basename", { ...confidentialRequest, fileName: "CON.xlsx" }],
    ["a reserved device basename in lowercase", { ...confidentialRequest, fileName: "com1.xlsx" }],
    ["a filename with reserved wildcard punctuation", { ...confidentialRequest, fileName: "name?.xlsx" }],
    ["a filename with trailing whitespace", { ...confidentialRequest, fileName: "anonymous-ta.xlsx " }],
    ["a filename with a trailing dot", { ...confidentialRequest, fileName: "anonymous-ta.xlsx." }],
    ["a filename whose root ends with whitespace", { ...confidentialRequest, fileName: "anonymous-ta .xlsx" }],
    ["a filename whose root ends with dot", { ...confidentialRequest, fileName: "anonymous-ta..xlsx" }],
    ["a traversal path", { ...confidentialRequest, fileName: "../anonymous-ta.xlsx" }],
    ...["safe\u0000.xlsx", "safe\u000b.xlsx", "safe\u007f.xlsx", "safe\u2028.xlsx", "safe\u2029.xlsx"].map(
      (fileName) => ["a filename with a control character", { ...confidentialRequest, fileName }] as const,
    ),
    ["a public classification", { ...confidentialRequest, inputClassification: "public" }],
    ["empty workbook bytes", { ...confidentialRequest, workbookBytes: new Uint8Array() }],
    ["an extra field", { ...confidentialRequest, unexpected: true }],
  ])("rejects a request with %s", (_description, request) => {
    expect(workbookCatalogRequestSchema.safeParse(request).success).toBe(false);
  });

  it.each(["Auto Summary!A12", "Auto Summary!A1-extra"])(
    "rejects a result with a malformed worksheet anchor: %s",
    (worksheetAnchor) => {
      expect(
        workbookCatalogResultSchema.safeParse({
          ...confidentialResult,
          analyses: [
            {
              ...confidentialResult.analyses[0],
              source: { ...confidentialResult.analyses[0].source, worksheetAnchor },
            },
          ],
        }).success,
      ).toBe(false);
    },
  );

  it("rejects a result with unknown raw fields", () => {
    expect(
      workbookCatalogResultSchema.safeParse({
        ...confidentialResult,
        workbook: { ...confidentialResult.workbook, rawWorkbookXml: "<workbook />" },
      }).success,
    ).toBe(false);
  });

  it("rejects a result with a non-confidential classification", () => {
    expect(
      workbookCatalogResultSchema.safeParse({
        ...confidentialResult,
        workbook: { ...confidentialResult.workbook, classification: "internal" },
      }).success,
    ).toBe(false);
  });

  it.each([
    ["legacy worksheet", { worksheet: "Auto Summary" }],
    ["legacy description", { description: "Cataloged tolerance analysis." }],
    [
      "an analysis-level date",
      {
        date: {
          value: "2026-07-23",
          sourceCell: "Title Page!B6",
        },
      },
    ],
  ])("rejects a result with %s", (_description, legacyFields) => {
    expect(
      workbookCatalogResultSchema.safeParse({
        ...confidentialResult,
        analyses: [{ ...confidentialResult.analyses[0], ...legacyFields }],
      }).success,
    ).toBe(false);
  });
});

describe("worksheet analysis asset contracts", () => {
  const contentHash = "a".repeat(64);
  const workbookCatalog = {
    contractVersion: "v1",
    workbook: {
      fileName: "anonymous-ta.xlsx",
      classification: "confidential",
      contentHash,
      metadata: {
        documentNo: "TA-001",
        revision: "A",
        date: { value: "2026-07-24", sourceCell: "Title Page!B6" },
      },
      worksheetInventory: [
        { worksheetName: "Analysis", worksheetIndex: 0, visibility: "visible", worksheetKind: "analysis", isTaAnalysis: true, sourcePart: "xl/worksheets/sheet1.xml" },
      ],
    },
    analyses: [
      {
        worksheetName: "Analysis",
        toleranceLoopDescription: "Anonymous analysis.",
        source: { summarySheet: "Auto Summary", summaryRow: 1, worksheetAnchor: "Analysis!A1" },
      },
    ],
  };

  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookBytes: new Uint8Array([0x50, 0x4b, 3, 4]),
    workbookCatalog,
  };

  const result = {
    contractVersion: "v1",
    workbook: { classification: "confidential", contentHash, catalogContractVersion: "v1" },
    worksheets: [
      {
        worksheetName: "Analysis",
        toleranceLoopDescription: "Anonymous analysis.",
        factorTables: [
          {
            tableId: "table-a",
            headerRow: 12,
            dataRange: { startRow: 13, endRow: 13 },
            columns: [{ semanticField: "factorName", headerText: "Factor", sourceColumn: "B" }],
            rows: [
              {
                sourceRow: 13,
                factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis!A13" },
                fields: {
                  factorName: {
                    status: "available",
                    rawText: "Anonymous factor",
                    sourceCell: "Analysis!B13",
                    numericValue: 1.25,
                    unit: "mm",
                    formula: "=B12",
                    cachedValue: "1.25",
                  },
                  nominalValue: { status: "unavailable", reasonCode: "missing", sourceCell: "Analysis!C13" },
                },
              },
            ],
          },
        ],
        formulaCells: [
          {
            sourceCell: "Analysis!K13",
            formula: "=B13",
            cachedValue: { status: "available", rawText: "1.25" },
          },
        ],
        imageAssets: [
          {
            contentHash,
            mediaType: "image/png",
            byteLength: 12,
            sourcePart: "xl/media/image1.png",
            drawingSourcePart: "xl/drawings/drawing1.xml",
            anchor: { status: "available", from: "C3", to: "K20" },
          },
        ],
      },
    ],
  };

  it("accepts confidential v1 worksheet analysis asset contracts", () => {
    expect(worksheetAnalysisAssetsRequestSchema.parse(request)).toEqual(request);
    expect(worksheetAnalysisAssetsRequestSchema.parse({ ...request, worksheetSelection: { mode: "all" } }).worksheetSelection).toEqual({ mode: "all" });
    expect(worksheetAnalysisAssetsRequestSchema.parse({ ...request, worksheetSelection: { mode: "selected", worksheetNames: ["Analysis"] } }).worksheetSelection).toEqual({ mode: "selected", worksheetNames: ["Analysis"] });
    expect(worksheetAnalysisAssetsResultSchema.parse(result)).toEqual(result);
    const rowWithoutOrdinal = { ...result.worksheets[0].factorTables[0].rows[0] };
    delete (rowWithoutOrdinal as { factorOrdinal?: unknown }).factorOrdinal;
    expect(worksheetAnalysisAssetsResultSchema.safeParse({
      ...result,
      worksheets: [{ ...result.worksheets[0], factorTables: [{ ...result.worksheets[0].factorTables[0], rows: [rowWithoutOrdinal] }] }],
    }).success).toBe(false);
    expect(
      worksheetImageReadRequestSchema.parse({
        contractVersion: "v1",
        inputClassification: "confidential",
        workbookBytes: new Uint8Array([0x50, 0x4b, 3, 4]),
        workbookContentHash: contentHash,
        imageContentHash: "b".repeat(64),
      }),
    ).toMatchObject({ workbookContentHash: contentHash });
    expect(
      worksheetImageReadResultSchema.parse({
        contractVersion: "v1",
        classification: "confidential",
        workbookContentHash: contentHash,
        imageContentHash: "b".repeat(64),
        mediaType: "image/png",
        bytes: new Uint8Array([1, 2, 3]),
      }).bytes,
    ).toEqual(new Uint8Array([1, 2, 3]));
  });

  it.each([
    ["a public input", { ...request, inputClassification: "public" }],
    ["an uppercase hash", { ...result, workbook: { ...result.workbook, contentHash: "A".repeat(64) } }],
    ["an invalid hash", { ...result, workbook: { ...result.workbook, contentHash: "not-a-hash" } }],
    ["an extra field", { ...request, unexpected: true }],
    ["an empty selected worksheet list", { ...request, worksheetSelection: { mode: "selected", worksheetNames: [] } }],
    ["duplicate selected worksheet names", { ...request, worksheetSelection: { mode: "selected", worksheetNames: ["Analysis", "Analysis"] } }],
  ])("rejects worksheet assets with %s", (_description, value) => {
    const schema = "workbook" in value ? worksheetAnalysisAssetsResultSchema : worksheetAnalysisAssetsRequestSchema;
    expect(schema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["workbookContentHash", { imageContentHash: contentHash }],
    ["imageContentHash", { workbookContentHash: contentHash }],
  ])("rejects an image read request missing %s", (_missingField, hashes) => {
    expect(
      worksheetImageReadRequestSchema.safeParse({
        contractVersion: "v1",
        inputClassification: "confidential",
        workbookBytes: new Uint8Array([0x50]),
        ...hashes,
      }).success,
    ).toBe(false);
  });

  it("rejects raw text leaked through an unavailable field", () => {
    expect(
      worksheetAnalysisAssetsResultSchema.safeParse({
        ...result,
        worksheets: [
          {
            ...result.worksheets[0],
            factorTables: [
              {
                ...result.worksheets[0].factorTables[0],
                rows: [
                  {
                    ...result.worksheets[0].factorTables[0].rows[0],
                    fields: {
                      factorName: {
                        status: "unavailable",
                        reasonCode: "invalid_format",
                        rawText: "must not leak",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires a cached value for an available formula field", () => {
    expect(
      worksheetAnalysisAssetsResultSchema.safeParse({
        ...result,
        worksheets: [{
          ...result.worksheets[0],
          factorTables: [{
            ...result.worksheets[0].factorTables[0],
            rows: [{
              ...result.worksheets[0].factorTables[0].rows[0],
              fields: {
                factorName: {
                  status: "available",
                  rawText: "Anonymous factor",
                  sourceCell: "Analysis!B13",
                  formula: "=A1",
                },
              },
            }],
          }],
        }],
      }).success,
    ).toBe(false);
  });

  it("retains an independent formula cell when its cached value is unavailable", () => {
    expect(
      worksheetAnalysisAssetsResultSchema.safeParse({
        ...result,
        worksheets: [{
          ...result.worksheets[0],
          formulaCells: [{
            sourceCell: "Analysis!K13",
            formula: "=B13",
            cachedValue: { status: "unavailable", reasonCode: "missing_cached_value" },
          }],
        }],
      }).success,
    ).toBe(true);
  });

  it("accepts an unavailable image anchor without guessing coordinates", () => {
    expect(
      worksheetAnalysisAssetsResultSchema.safeParse({
        ...result,
        worksheets: [{
          ...result.worksheets[0],
          imageAssets: [{
            ...result.worksheets[0].imageAssets[0],
            anchor: { status: "unavailable", reasonCode: "unparsed_anchor" },
          }],
        }],
      }).success,
    ).toBe(true);
  });

  it("accepts the controlled application/octet-stream image fallback", () => {
    expect(
      worksheetImageReadResultSchema.safeParse({
        contractVersion: "v1",
        classification: "confidential",
        workbookContentHash: "a".repeat(64),
        imageContentHash: "b".repeat(64),
        mediaType: "application/octet-stream",
        bytes: new Uint8Array([1]),
      }).success,
    ).toBe(true);
  });

  it("accepts the F2.1 semantic fields and strict required-field check contracts", () => {
    const assets = {
      ...result,
      worksheets: [{
        ...result.worksheets[0],
        factorTables: [{
          ...result.worksheets[0]!.factorTables[0],
          columns: [
            { semanticField: "partName", headerText: "Part Name", sourceColumn: "C" },
            { semanticField: "partCategory", headerText: "Part Category", sourceColumn: "D" },
            { semanticField: "longTermSafetyFactor", headerText: "Safety Factor", sourceColumn: "E" },
            { semanticField: "drawingNumber", headerText: "Drawing Number", sourceColumn: "F" },
            { semanticField: "dimCharacteristicId", headerText: "DIM ID", sourceColumn: "G" },
          ],
          rows: [],
          dataRange: { startRow: 13, endRow: 13 },
        }],
      }],
    };

    expect(requiredFieldCheckRequestSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      worksheetAnalysisAssets: assets,
    }).worksheetAnalysisAssets).toEqual(assets);
    expect(requiredFieldCheckResultSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: contentHash,
      status: "blocked",
      blockingIssues: [{
        issueCode: "required_field_unavailable",
        worksheetName: "Analysis",
        tableId: "table-a",
        sourceRow: 13,
        field: "longTermSafetyFactor",
        reasonCode: "missing",
      }],
      advisoryIssues: [{
        issueCode: "optional_identifier_unavailable",
        worksheetName: "Analysis",
        tableId: "table-a",
        sourceRow: 13,
        field: "dimCharacteristicId",
        reasonCode: "missing",
      }],
      summary: {
        worksheetsChecked: 1,
        factorTablesChecked: 1,
        factorRowsChecked: 1,
        blockingIssueCount: 1,
        advisoryIssueCount: 1,
      },
    }).status).toBe("blocked");
  });

  it("rejects F2.1 state and count inconsistencies", () => {
    const result = {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: contentHash,
      status: "readyForNextCheck",
      blockingIssues: [{ issueCode: "factor_table_has_no_rows", worksheetName: "Analysis", tableId: "table-a" }],
      advisoryIssues: [],
      summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 0, blockingIssueCount: 1, advisoryIssueCount: 0 },
    };

    expect(requiredFieldCheckResultSchema.safeParse(result).success).toBe(false);
    expect(requiredFieldCheckResultSchema.safeParse({
      ...result,
      status: "blocked",
      summary: { ...result.summary, blockingIssueCount: 0 },
    }).success).toBe(false);
    expect(requiredFieldCheckResultSchema.safeParse({ ...result, unexpected: true }).success).toBe(false);
  });

  it("accepts strict F2.2 gates while rejecting gate rows", () => {
    const requiredFieldCheck = requiredFieldCheckResultSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: contentHash,
      status: "readyForNextCheck",
      blockingIssues: [],
      advisoryIssues: [],
      summary: {
        worksheetsChecked: 1,
        factorTablesChecked: 1,
        factorRowsChecked: 1,
        blockingIssueCount: 0,
        advisoryIssueCount: 0,
      },
    });

    expect(capabilityValidationRequestSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      knowledgeBaseVersion: "v1",
      worksheetAnalysisAssets: result,
      requiredFieldCheck,
    }).knowledgeBaseVersion).toBe("v1");

    const gateResult = {
      contractVersion: "v1",
      inputClassification: "confidential",
      knowledgeBaseVersion: "v1",
      workbookContentHash: contentHash,
      status: "required_fields_not_ready",
      rows: [],
      summary: {
        factorRowsChecked: 0,
        inLibraryCount: 0,
        outOfLibraryCount: 0,
        toleranceUnableToValidateCount: 0,
        distributionMatchCount: 0,
        distributionMismatchCount: 0,
        distributionUnableToValidateCount: 0,
        distributionNotApplicableCount: 0,
      },
    };

    expect(capabilityValidationResultSchema.parse(gateResult).status).toBe("required_fields_not_ready");
    expect(capabilityValidationResultSchema.safeParse({
      ...gateResult,
      rows: [{ worksheetName: "Analysis" }],
    }).success).toBe(false);
  });

  it("permits the canonical zero-row table range but rejects an inverted range", () => {
    const zeroRowTable = {
      ...result.worksheets[0]!.factorTables[0],
      dataRange: { startRow: 13, endRow: 13 },
      rows: [],
    };
    const zeroRowAssets = {
      ...result,
      worksheets: [{ ...result.worksheets[0], factorTables: [zeroRowTable] }],
    };

    expect(worksheetAnalysisAssetsResultSchema.safeParse(zeroRowAssets).success).toBe(true);
    expect(worksheetAnalysisAssetsResultSchema.safeParse({
      ...zeroRowAssets,
      worksheets: [{
        ...zeroRowAssets.worksheets[0],
        factorTables: [{ ...zeroRowTable, dataRange: { startRow: 13, endRow: 12 } }],
      }],
    }).success).toBe(false);
  });

  it("accepts completed F2.2 evidence for F2.3 while enforcing resolution status invariants", () => {
    const completedCapabilityValidation = {
      contractVersion: "v1",
      inputClassification: "confidential",
      knowledgeBaseVersion: "v1",
      workbookContentHash: contentHash,
      status: "completed",
      rows: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 2,
        factorName: "anonymous-factor",
        tolerance: { status: "out_of_library", totalTolerance: 0.2, unit: "mm" },
        distribution: { status: "not_applicable" },
      }],
      summary: {
        factorRowsChecked: 1,
        inLibraryCount: 0,
        outOfLibraryCount: 1,
        toleranceUnableToValidateCount: 0,
        distributionMatchCount: 0,
        distributionMismatchCount: 0,
        distributionUnableToValidateCount: 0,
        distributionNotApplicableCount: 1,
      },
    };
    const signalRef = `${contentHash}|Analysis-A|table-a|2|tolerance_out_of_library`;

    expect(exceptionResolutionRequestSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      capabilityValidation: completedCapabilityValidation,
      candidates: [{
        signalRef,
        recordedBy: "anonymous-engineer",
        recordedAt: "2026-07-27T10:15:30.000Z",
        rationale: "Anonymous evidence reviewed.",
      }],
    }).candidates).toHaveLength(1);

    expect(exceptionResolutionRequestSchema.safeParse({
      contractVersion: "v1",
      inputClassification: "confidential",
      capabilityValidation: { ...completedCapabilityValidation, status: "required_fields_not_ready", rows: [], summary: {
        ...completedCapabilityValidation.summary,
        factorRowsChecked: 0,
        outOfLibraryCount: 0,
        distributionNotApplicableCount: 0,
      } },
      candidates: [],
    }).success).toBe(false);

    const result = {
      contractVersion: "v1",
      inputClassification: "confidential",
      status: "readyToContinue",
      readyToContinue: true,
      workbookContentHash: contentHash,
      knowledgeBaseVersion: "v1",
      acceptedExceptions: [{
        signalRef,
        recordedBy: "anonymous-engineer",
        recordedAt: "2026-07-27T10:15:30.000Z",
        rationale: "Anonymous evidence reviewed.",
        snapshot: {
          signalKind: "tolerance_out_of_library",
          worksheetName: "Analysis-A",
          tableId: "table-a",
          sourceRow: 2,
          factorName: "anonymous-factor",
          signal: { status: "out_of_library", totalTolerance: 0.2, unit: "mm" },
        },
      }],
      pendingExceptions: [],
      summary: {
        actionableSignalCount: 1,
        acceptedExceptionCount: 1,
        pendingExceptionCount: 0,
        invalidCandidateCount: 0,
      },
    };

    expect(exceptionResolutionResultSchema.parse(result).status).toBe("readyToContinue");
    expect(exceptionResolutionResultSchema.safeParse({ ...result, readyToContinue: false }).success).toBe(false);
  });

  it("accepts strict F1.7 semantic table detection contracts", () => {
    const detectionRequest = {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookBytes: new Uint8Array([0x50, 0x4b, 3, 4]),
      workbookCatalog,
      worksheetSelection: { mode: "selected", worksheetNames: ["Analysis"] },
      manualConfirmations: [{
        worksheetName: "Analysis",
        candidateId: "cand-a",
        action: "confirm_as_is",
      }],
    };

    expect(semanticTableDetectionRequestSchema.parse(detectionRequest)).toEqual(detectionRequest);

    const pendingResult = {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbook: { contentHash, catalogContractVersion: "v1" },
      worksheets: [{
        worksheetName: "Analysis",
        recognitionStatus: "pending_confirmation",
        confidenceScore: 71,
        confidenceBreakdown: {
          headerScore: 36,
          typeScore: 20,
          completenessScore: 15,
          penalty: 0,
        },
        uncertaintyReasons: ["ambiguous_mapping"],
        requiresUserConfirmation: true,
        confirmationPayload: {
          candidateId: "cand-a",
          headerRow: 12,
          dataRange: { startRow: 13, endRow: 26 },
          mappedFields: [{
            field: "factorName",
            sourceColumn: "B",
            headerText: "Factor",
            status: "mapped",
          }],
          recommendedAction: "confirm_as_is",
          reasonCodes: ["ambiguous_mapping"],
        },
      }],
      summary: {
        worksheetCount: 1,
        autoConfirmedCount: 0,
        manualConfirmedCount: 0,
        pendingConfirmationCount: 1,
        blockedCount: 0,
      },
    };

    expect(semanticTableDetectionResultSchema.parse(pendingResult)).toEqual(pendingResult);
    expect(semanticTableDetectionResultSchema.safeParse({
      ...pendingResult,
      worksheets: [{
        ...pendingResult.worksheets[0],
        recognitionStatus: "auto_confirmed",
        requiresUserConfirmation: false,
        confirmationPayload: undefined,
      }],
      summary: {
        worksheetCount: 1,
        autoConfirmedCount: 1,
        manualConfirmedCount: 0,
        pendingConfirmationCount: 0,
        blockedCount: 0,
      },
    }).success).toBe(true);
    expect(semanticTableDetectionResultSchema.safeParse({
      ...pendingResult,
      worksheets: [{
        ...pendingResult.worksheets[0],
        requiresUserConfirmation: false,
      }],
    }).success).toBe(false);
    expect(semanticTableDetectionResultSchema.safeParse({
      ...pendingResult,
      summary: {
        ...pendingResult.summary,
        pendingConfirmationCount: 0,
      },
    }).success).toBe(false);
  });
});

describe("F2.4 identifier quality contracts", () => {
  const contentHash = "a".repeat(64);
  const worksheetAnalysisAssets = {
    contractVersion: "v1" as const,
    workbook: { classification: "confidential" as const, contentHash, catalogContractVersion: "v1" as const },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Anonymous analysis.",
      factorTables: [{
        tableId: "table-a",
        headerRow: 1,
        dataRange: { startRow: 2, endRow: 3 },
        columns: [{ semanticField: "factorName" as const, headerText: "Factor", sourceColumn: "A" }],
        rows: [],
      }],
      formulaCells: [],
      imageAssets: [],
    }],
  };
  const requiredFieldCheck = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    workbookContentHash: contentHash,
    status: "readyForNextCheck" as const,
    blockingIssues: [],
    advisoryIssues: [],
    summary: {
      worksheetsChecked: 1,
      factorTablesChecked: 1,
      factorRowsChecked: 2,
      blockingIssueCount: 0,
      advisoryIssueCount: 0,
    },
  };

  it("accepts strict confidential F2.4 evidence and aggregated unavailable signals", () => {
    expect(identifierQualityCheckRequestSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      worksheetAnalysisAssets,
      requiredFieldCheck,
    }).requiredFieldCheck.status).toBe("readyForNextCheck");

    expect(identifierQualityCheckResultSchema.parse({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: contentHash,
      status: "completed",
      signals: [{
        signalKind: "identifier_evidence_unavailable",
        worksheetName: "Analysis-A",
        tableId: "table-a",
        field: "dimCharacteristicId",
        reasonCode: "missing",
        sourceRows: [2, 3],
      }],
      summary: {
        factorRowsChecked: 2,
        actionableSignalCount: 1,
        identifierMissingCount: 0,
        identifierEvidenceUnavailableCount: 1,
        identifierTextInvalidCount: 0,
        dimIdDuplicateCount: 0,
      },
    }).status).toBe("completed");
  });

  it("rejects incompatible evidence, invalid signal shapes, and nonempty gate summaries", () => {
    const request = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      worksheetAnalysisAssets,
      requiredFieldCheck,
    };
    const gateResult = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      workbookContentHash: contentHash,
      status: "required_fields_not_ready" as const,
      signals: [],
      summary: {
        factorRowsChecked: 0,
        actionableSignalCount: 0,
        identifierMissingCount: 0,
        identifierEvidenceUnavailableCount: 0,
        identifierTextInvalidCount: 0,
        dimIdDuplicateCount: 0,
      },
    };

    expect(identifierQualityCheckRequestSchema.safeParse({
      ...request,
      requiredFieldCheck: { ...requiredFieldCheck, workbookContentHash: "b".repeat(64) },
    }).success).toBe(false);
    expect(identifierQualityCheckRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(identifierQualityCheckResultSchema.safeParse({
      ...gateResult,
      summary: { ...gateResult.summary, factorRowsChecked: 1 },
    }).success).toBe(false);
    expect(identifierQualityCheckResultSchema.safeParse({
      ...gateResult,
      status: "completed",
      signals: [{
        signalKind: "identifier_evidence_unavailable",
        worksheetName: "Analysis-A",
        tableId: "table-a",
        field: "drawingNumber",
        sourceRows: [3, 2, 2],
      }],
      summary: {
        factorRowsChecked: 2,
        actionableSignalCount: 1,
        identifierMissingCount: 0,
        identifierEvidenceUnavailableCount: 1,
        identifierTextInvalidCount: 0,
        dimIdDuplicateCount: 0,
      },
    }).success).toBe(false);
  });
});

describe("F2.3 v2 unified exception resolution contracts", () => {
  const contentHash = "a".repeat(64);
  const capabilityValidation = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    knowledgeBaseVersion: "v1" as const,
    workbookContentHash: contentHash,
    status: "completed" as const,
    rows: [{
      worksheetName: "Analysis-A",
      tableId: "table-a",
      sourceRow: 2,
      factorName: "anonymous-factor",
      tolerance: { status: "out_of_library" as const, totalTolerance: 0.2, unit: "mm" as const },
      distribution: { status: "not_applicable" as const },
    }],
    summary: {
      factorRowsChecked: 1,
      inLibraryCount: 0,
      outOfLibraryCount: 1,
      toleranceUnableToValidateCount: 0,
      distributionMatchCount: 0,
      distributionMismatchCount: 0,
      distributionUnableToValidateCount: 0,
      distributionNotApplicableCount: 1,
    },
  };
  const identifierQualityCheck = {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    workbookContentHash: contentHash,
    status: "completed" as const,
    signals: [{
      signalKind: "identifier_missing" as const,
      worksheetName: "Analysis-A",
      tableId: "table-a",
      field: "drawingNumber" as const,
      sourceRows: [2],
    }],
    summary: {
      factorRowsChecked: 1,
      actionableSignalCount: 1,
      identifierMissingCount: 1,
      identifierEvidenceUnavailableCount: 0,
      identifierTextInvalidCount: 0,
      dimIdDuplicateCount: 0,
    },
  };
  const capabilitySignalRef = `${contentHash}|capability_validation|Analysis-A|table-a|2|tolerance_out_of_library`;
  const identifierSignalRef = `${contentHash}|identifier_quality|Analysis-A|table-a|drawingNumber|identifier_missing|`;

  it("accepts complete F2.2 and F2.4 evidence and source-attributed unified results", () => {
    expect(unifiedExceptionResolutionV2RequestSchema.parse({
      contractVersion: "v2",
      inputClassification: "confidential",
      capabilityValidation,
      identifierQualityCheck,
      candidates: [{
        signalRef: capabilitySignalRef,
        recordedBy: "anonymous-engineer",
        recordedAt: "2026-07-27T10:15:30.000Z",
        rationale: "Anonymous evidence reviewed.",
      }],
    }).contractVersion).toBe("v2");

    expect(unifiedExceptionResolutionV2ResultSchema.parse({
      contractVersion: "v2",
      inputClassification: "confidential",
      status: "readyToContinue",
      readyToContinue: true,
      workbookContentHash: contentHash,
      knowledgeBaseVersion: "v1",
      acceptedExceptions: [
        {
          signalRef: capabilitySignalRef,
          recordedBy: "anonymous-engineer",
          recordedAt: "2026-07-27T10:15:30.000Z",
          rationale: "Anonymous evidence reviewed.",
          snapshot: {
            source: "capability_validation",
            signalKind: "tolerance_out_of_library",
            worksheetName: "Analysis-A",
            tableId: "table-a",
            sourceRow: 2,
            factorName: "anonymous-factor",
            signal: { status: "out_of_library", totalTolerance: 0.2, unit: "mm" },
          },
        },
        {
          signalRef: identifierSignalRef,
          recordedBy: "anonymous-engineer",
          recordedAt: "2026-07-27T10:15:30.000Z",
          rationale: "Anonymous evidence reviewed.",
          snapshot: {
            source: "identifier_quality",
            signalKind: "identifier_missing",
            worksheetName: "Analysis-A",
            tableId: "table-a",
            field: "drawingNumber",
            sourceRows: [2],
          },
        },
      ],
      pendingExceptions: [],
      summary: {
        actionableSignalCount: 2,
        capabilitySignalCount: 1,
        identifierSignalCount: 1,
        acceptedExceptionCount: 2,
        acceptedCapabilityExceptionCount: 1,
        acceptedIdentifierExceptionCount: 1,
        pendingExceptionCount: 0,
        pendingCapabilityExceptionCount: 0,
        pendingIdentifierExceptionCount: 0,
        invalidCandidateCount: 0,
      },
    }).status).toBe("readyToContinue");
  });
});

describe("worksheet selection view contracts", () => {
  const workbookCatalog = {
    contractVersion: "v1",
    workbook: {
      fileName: "anonymous-ta.xlsx",
      classification: "confidential",
      contentHash: "a".repeat(64),
      metadata: {
        documentNo: "TA-001",
        revision: "A",
        date: { value: "2026-07-24", sourceCell: "Title Page!B6" },
      },
      worksheetInventory: [
        { worksheetName: "Analysis-A", worksheetIndex: 0, visibility: "visible", worksheetKind: "analysis", isTaAnalysis: true, sourcePart: "xl/worksheets/sheet1.xml" },
      ],
    },
    analyses: [
      {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "First tolerance loop",
        source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
      },
    ],
  };

  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookCatalog,
  };

  const result = {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: {
      fileName: "anonymous-ta.xlsx",
      classification: "confidential",
      contentHash: "a".repeat(64),
      revision: "A",
      date: { value: "2026-07-24", sourceCell: "Title Page!B6" },
    },
    worksheets: [
      {
        selectionIndex: 1,
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "First tolerance loop",
        source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
      },
    ],
  };

  it("accepts confidential worksheet selection view request/result", () => {
    expect(worksheetSelectionViewRequestSchema.parse(request)).toEqual(request);
    expect(worksheetSelectionViewResultSchema.parse(result)).toEqual(result);
  });

  it("accepts worksheet selection prompt and confirmation contracts", () => {
    const prompt = {
      contractVersion: "v1",
      inputClassification: "confidential",
      status: "selectionRequired",
      workbook: { fileName: "anonymous-ta.xlsx", contentHash: "a".repeat(64) },
      options: [{
        selectionIndex: 1,
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "First tolerance loop",
        worksheetKind: "analysis",
        source: { summarySheet: "Auto Summary", summaryRow: 10, worksheetAnchor: "Analysis-A!A1" },
      }],
    };
    const confirmation = {
      workbookContentHash: "a".repeat(64),
      selectedWorksheetNames: ["Analysis-A"],
      confirmed: true,
    };

    expect(worksheetSelectionPromptSchema.parse(prompt)).toEqual(prompt);
    expect(worksheetSelectionConfirmationSchema.parse(confirmation)).toEqual(confirmation);
    expect(worksheetSelectionConfirmationResultSchema.parse({
      status: "confirmed",
      workbookContentHash: "a".repeat(64),
      selectedWorksheetNames: ["Analysis-A"],
    }).status).toBe("confirmed");
    expect(worksheetSelectionConfirmationResultSchema.parse({
      status: "cancelled",
      reasonCode: "worksheet_selection_empty",
    }).status).toBe("cancelled");
  });

  it("rejects duplicate worksheet names in a confirmation", () => {
    expect(worksheetSelectionConfirmationSchema.safeParse({
      workbookContentHash: "a".repeat(64),
      selectedWorksheetNames: ["Analysis-A", "Analysis-A"],
      confirmed: true,
    }).success).toBe(false);
  });

  it.each([
    ["public input", { ...request, inputClassification: "public" }],
    ["extra request field", { ...request, unexpected: true }],
    ["zero selection index", { ...result, worksheets: [{ ...result.worksheets[0], selectionIndex: 0 }] }],
    ["extra result field", { ...result, workbook: { ...result.workbook, metadata: {} } }],
  ])("rejects worksheet selection view contract with %s", (_description, value) => {
    const schema = "workbookCatalog" in value ? worksheetSelectionViewRequestSchema : worksheetSelectionViewResultSchema;
    expect(schema.safeParse(value).success).toBe(false);
  });
});

describe("interpretation rules contracts", () => {
  const provenance = {
    classification: "internal" as const,
    sourceAlias: "capability-handbook",
    sourceFileHash: "a".repeat(64),
    sourceVersion: "2026-Q3",
    sheetName: "Rules",
    sourceRange: "A2:H20",
    owner: "knowledge-steward",
    confidence: 0.9,
    effectiveVersion: "interpretation-rules-v1" as const,
    changeSummary: "Initial reviewed interpretation rules.",
  };

  const commonEntry = {
    entryId: "entry-1",
    title: "Capability interpretation",
    description: "Interprets one-dimensional capability facts.",
    applicability: { analysisDimension: "one-dimensional" as const, method: "rss" as const },
    relatedEntryIds: [],
    provenance,
  };

  const entries = [
    {
      ...commonEntry,
      entryId: "metric-cpk",
      entryType: "metric-definition" as const,
      metric: "cpk",
      unit: "ratio",
    },
    {
      ...commonEntry,
      entryId: "performance-cpk",
      entryType: "performance-rule" as const,
      metric: "cpk",
      comparison: "greater-than-or-equal" as const,
      targetSource: "resolved-target" as const,
      requiredFacts: ["cpk", "targetCpk"],
      outcomeWhenMatched: "meets-target",
    },
    {
      ...commonEntry,
      entryId: "root-cause-contributor",
      entryType: "root-cause-signal" as const,
      signalStatus: "hypothesis" as const,
      requiredFacts: ["contributors"],
      validationFacts: ["contributor-evidence"],
      activationCondition: {
        kind: "maximum-contribution-at-least" as const,
        thresholdPercent: 30,
      },
    },
    {
      ...commonEntry,
      entryId: "improvement-review",
      entryType: "improvement-option" as const,
      expectedImpact: "Reduce the largest contributor.",
      tradeoffs: ["May increase manufacturing cost."],
      validationSteps: ["Recalculate the tolerance stack."],
    },
    {
      ...commonEntry,
      entryId: "decision-escalate",
      entryType: "decision-policy" as const,
      policyKind: "engineering-review" as const,
    },
  ];

  const source = {
    sourceAlias: "capability-handbook",
    sourceFileHash: "a".repeat(64),
    sourceVersion: "2026-Q3",
    classification: "internal" as const,
    owner: "knowledge-steward",
  };

  const manifest = {
    version: "interpretation-rules-v1" as const,
    classification: "internal" as const,
    sourceCount: 1,
    entryCount: 5,
    entryTypeCounts: {
      "metric-definition": 1,
      "performance-rule": 1,
      "root-cause-signal": 1,
      "improvement-option": 1,
      "decision-policy": 1,
    },
    sourcesHash: "b".repeat(64),
    entriesHash: "c".repeat(64),
    contentHash: "d".repeat(64),
  };

  const seedPackage = { manifest, sources: [source], entries };

  const evaluation = {
    knowledgeBaseVersion: "interpretation-rules-v1" as const,
    status: "matched" as const,
    resolvedTargets: {
      cpk: { value: 1.33, source: "project" as const },
      sigma: { value: 4.5, source: "template" as const },
    },
    factsUsed: ["cpk", "targetCpk"],
    matchedRules: [{
      entryId: "performance-cpk",
      entryType: "performance-rule" as const,
      title: "Cpk meets target",
      effectiveVersion: "interpretation-rules-v1" as const,
      applicability: { analysisDimension: "one-dimensional" as const, method: "rss" as const },
      relatedFactReferences: ["cpk", "targetCpk"],
      evidence: provenance,
    }],
    missingFacts: [],
  };

  it("accepts the version, every entry discriminant, a strict seed package, and a version-only load request", () => {
    expect(interpretationRuleVersionSchema.parse("interpretation-rules-v1")).toBe("interpretation-rules-v1");
    expect(interpretationRuleVersionSchema.parse("interpretation-rules-v2")).toBe("interpretation-rules-v2");
    expect(entries.map((entry) => interpretationEntryTypeSchema.parse(entry.entryType))).toEqual(
      entries.map((entry) => entry.entryType),
    );
    expect(entries.map((entry) => interpretationKnowledgeEntrySchema.parse(entry).entryType)).toEqual(
      entries.map((entry) => entry.entryType),
    );
    expect(interpretationKnowledgeSourceMetadataSchema.parse(source)).toEqual(source);
    expect(interpretationKnowledgeManifestSchema.parse(manifest)).toEqual(manifest);
    expect(interpretationKnowledgeSeedPackageSchema.parse(seedPackage)).toEqual(seedPackage);
    expect(interpretationRuleLoadRequestSchema.parse({ version: "interpretation-rules-v1" })).toEqual({
      version: "interpretation-rules-v1",
    });
    expect(interpretationRuleLoadRequestSchema.parse({ version: "interpretation-rules-v2" })).toEqual({
      version: "interpretation-rules-v2",
    });
    expect(interpretationRuleLoadRequestSchema.safeParse({
      version: "interpretation-rules-v1",
      seedPackage,
    }).success).toBe(false);
  });

  it.each([
    ["sourceCount", { ...manifest, sourceCount: 0 }, ["manifest", "sourceCount"]],
    ["entryCount", { ...manifest, entryCount: 4 }, ["manifest", "entryCount"]],
    [
      "entryTypeCounts",
      { ...manifest, entryTypeCounts: { ...manifest.entryTypeCounts, "performance-rule": 0 } },
      ["manifest", "entryTypeCounts", "performance-rule"],
    ],
  ])("rejects an inconsistent manifest %s at the manifest field", (_field, inconsistentManifest, expectedPath) => {
    const result = interpretationKnowledgeSeedPackageSchema.safeParse({
      ...seedPackage,
      manifest: inconsistentManifest,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        JSON.stringify(issue.path) === JSON.stringify(expectedPath))).toBe(true);
    }
  });

  it("accepts cpk, sigma, contributor facts, and preserves resolved target sources", () => {
    const request = {
      analysisDimension: "one-dimensional" as const,
      method: "worst-case" as const,
      facts: {
        cpk: 1.33,
        targetCpk: { value: 1.33, source: "project" as const },
        achievedSigma: 4,
        targetSigma: { value: 4.5, source: "template" as const },
        contributors: [{ reference: "dimension-A", contributionPercent: 62.5 }],
      },
    };
    expect(interpretationRuleEvaluationRequestSchema.parse(request)).toEqual(request);
    expect(interpretationRuleEvaluationSchema.parse(evaluation)).toEqual(evaluation);
    expect(interpretationRuleEvaluationSchema.parse({
      ...evaluation,
      resolvedTargets: { cpk: { value: 1.33, source: "project" } },
    }).resolvedTargets).toEqual({
      cpk: { value: 1.33, source: "project" },
    });
    expect(interpretationRuleEvaluationSchema.parse({
      ...evaluation,
      resolvedTargets: { sigma: { value: 4.5, source: "controlled-default" } },
    }).resolvedTargets).toEqual({
      sigma: { value: 4.5, source: "controlled-default" },
    });
    expect(interpretationRuleEvaluationRequestSchema.safeParse({
      ...request,
      facts: { ...request.facts, targetCpk: { value: 1.33, source: "controlled-default" } },
    }).success).toBe(false);
    expect(interpretationRuleEvaluationRequestSchema.safeParse({
      ...request,
      facts: { ...request.facts, targetSigma: { value: 4.5, source: "controlled-default" } },
    }).success).toBe(false);
    expect(interpretationRuleEvaluationSchema.safeParse({
      ...evaluation,
      resolvedTargets: { cpk: 1.33 },
    }).success).toBe(false);
    expect(interpretationRuleEvaluationSchema.safeParse({
      ...evaluation,
      resolvedTargets: { sigma: 4.5 },
    }).success).toBe(false);
    expect(interpretationRuleEvaluationSchema.safeParse({
      ...evaluation,
      resolvedTargets: { cpk: { value: 1.33, source: "project", unexpected: true } },
    }).success).toBe(false);
    expect(interpretationRuleEvaluationSchema.safeParse({
      ...evaluation,
      resolvedTargets: { ...evaluation.resolvedTargets, unexpected: true },
    }).success).toBe(false);
  });

  it("accepts V2 capability and centering facts and rejects inverted specification limits", () => {
    const request = {
      analysisDimension: "one-dimensional" as const,
      method: "rss" as const,
      facts: {
        cp: 1.1,
        cpk: 0.9,
        targetCpk: { value: 1.33, source: "project" as const },
        mean: 0.2,
        lowerSpecLimit: -0.5,
        upperSpecLimit: 0.5,
      },
    };

    expect(interpretationRuleEvaluationRequestSchema.parse(request)).toEqual(request);
    expect(interpretationRuleEvaluationRequestSchema.safeParse({
      ...request,
      facts: { ...request.facts, lowerSpecLimit: 0.5, upperSpecLimit: -0.5 },
    }).success).toBe(false);
  });

  it("accepts V2 variation and mean-shift root-cause conditions", () => {
    const rootSignal = entries.find(({ entryType }) => entryType === "root-cause-signal")!;

    expect(interpretationKnowledgeEntrySchema.safeParse({
      ...rootSignal,
      requiredFacts: ["cp", "targetCpk"],
      activationCondition: { kind: "cp-below-target" },
    }).success).toBe(true);
    expect(interpretationKnowledgeEntrySchema.safeParse({
      ...rootSignal,
      requiredFacts: ["cp", "cpk", "mean", "lowerSpecLimit", "upperSpecLimit"],
      activationCondition: {
        kind: "mean-off-center",
        minimumCpCpkGap: 1e-12,
        minimumMeanOffset: 1e-12,
      },
    }).success).toBe(true);
  });

  it.each([
    ["matched", evaluation],
    ["insufficient-facts", {
      ...evaluation,
      status: "insufficient-facts",
      resolvedTargets: { cpk: evaluation.resolvedTargets.cpk },
      matchedRules: [],
      missingFacts: ["achievedSigma"],
    }],
    ["not-applicable", {
      ...evaluation,
      status: "not-applicable",
      resolvedTargets: {},
      matchedRules: [],
      missingFacts: [],
    }],
  ])("accepts a consistent %s evaluation", (_status, value) => {
    expect(interpretationRuleEvaluationSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ["RULE", "performance-rule"],
    ["SIGNAL", "root-cause-signal"],
    ["OPTION", "improvement-option"],
  ] as const)("rejects arbitrary %s related fact references", (_statementType, entryType) => {
    expect(interpretationRuleEvaluationSchema.safeParse({
      ...evaluation,
      matchedRules: [{
        ...evaluation.matchedRules[0],
        entryType,
        relatedFactReferences: ["fact-cpk"],
      }],
    }).success).toBe(false);
  });

  it.each([
    ["matched without a matched rule", { ...evaluation, matchedRules: [] }, ["matchedRules"]],
    ["matched with missing facts", { ...evaluation, missingFacts: ["cpk"] }, ["missingFacts"]],
    ["insufficient-facts with a matched rule", {
      ...evaluation, status: "insufficient-facts", missingFacts: ["cpk"],
    }, ["matchedRules"]],
    ["insufficient-facts without missing facts", {
      ...evaluation, status: "insufficient-facts", matchedRules: [],
    }, ["missingFacts"]],
    ["not-applicable with a matched rule", {
      ...evaluation, status: "not-applicable", resolvedTargets: {},
    }, ["matchedRules"]],
    ["not-applicable with missing facts", {
      ...evaluation, status: "not-applicable", resolvedTargets: {}, matchedRules: [], missingFacts: ["cpk"],
    }, ["missingFacts"]],
    ["not-applicable with a resolved target", {
      ...evaluation, status: "not-applicable", matchedRules: [],
    }, ["resolvedTargets"]],
    ["not-applicable without resolvedTargets", {
      knowledgeBaseVersion: evaluation.knowledgeBaseVersion,
      status: "not-applicable",
      factsUsed: evaluation.factsUsed,
      matchedRules: [],
      missingFacts: [],
    }, ["resolvedTargets"]],
  ])("rejects %s at the conflicting field", (_description, value, expectedPath) => {
    const result = interpretationRuleEvaluationSchema.safeParse(value);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) =>
        JSON.stringify(issue.path) === JSON.stringify(expectedPath))).toBe(true);
    }
  });

  it("rejects confidential provenance and non-hypothesis root-cause signals", () => {
    expect(interpretationProvenanceSchema.safeParse({ ...provenance, classification: "confidential" }).success).toBe(false);
    expect(interpretationKnowledgeEntrySchema.safeParse({ ...entries[2], signalStatus: "confirmed" }).success).toBe(false);
  });

  const rootCauseSignalWithoutActivationCondition = {
    entryId: entries[2].entryId,
    entryType: entries[2].entryType,
    title: entries[2].title,
    description: entries[2].description,
    applicability: entries[2].applicability,
    relatedEntryIds: entries[2].relatedEntryIds,
    provenance: entries[2].provenance,
    signalStatus: entries[2].signalStatus,
    requiredFacts: entries[2].requiredFacts,
    validationFacts: entries[2].validationFacts,
  };

  it.each([
    ["missing activation condition", rootCauseSignalWithoutActivationCondition],
    ["unknown activation kind", {
      ...entries[2], activationCondition: { kind: "average-contribution-at-least", thresholdPercent: 30 },
    }],
    ["negative threshold", {
      ...entries[2], activationCondition: { kind: "maximum-contribution-at-least", thresholdPercent: -0.01 },
    }],
    ["threshold above 100", {
      ...entries[2], activationCondition: { kind: "maximum-contribution-at-least", thresholdPercent: 100.01 },
    }],
    ["non-finite threshold", {
      ...entries[2], activationCondition: { kind: "maximum-contribution-at-least", thresholdPercent: Number.NaN },
    }],
    ["activation condition unknown field", {
      ...entries[2], activationCondition: {
        kind: "maximum-contribution-at-least", thresholdPercent: 30, unexpected: true,
      },
    }],
  ])("rejects a root-cause signal with %s", (_description, entry) => {
    expect(interpretationKnowledgeEntrySchema.safeParse(entry).success).toBe(false);
  });

  it("does not permit an inline global Cpk target or ranked improvement advice", () => {
    expect(interpretationKnowledgeEntrySchema.safeParse({ ...entries[1], target: 1 }).success).toBe(false);
    expect(interpretationKnowledgeEntrySchema.safeParse({ ...entries[3], rank: 1 }).success).toBe(false);
    expect(interpretationKnowledgeEntrySchema.safeParse({ ...entries[3], recommendation: "Do this first." }).success).toBe(false);
  });

  it("accepts only the controlled performance outcomes", () => {
    expect(interpretationKnowledgeEntrySchema.safeParse({
      ...entries[1], outcomeWhenMatched: "unexpected-outcome",
    }).success).toBe(false);
    expect(interpretationKnowledgeEntrySchema.safeParse({
      ...entries[1], outcomeWhenMatched: "below-target",
    }).success).toBe(true);
  });

  it.each([
    ["entry unknown field", interpretationKnowledgeEntrySchema, { ...entries[0], unexpected: true }],
    ["nested applicability unknown field", interpretationKnowledgeEntrySchema, {
      ...entries[0], applicability: { ...entries[0].applicability, unexpected: true },
    }],
    ["source unknown field", interpretationKnowledgeSourceMetadataSchema, { ...source, unexpected: true }],
    ["manifest unknown field", interpretationKnowledgeManifestSchema, { ...manifest, unexpected: true }],
    ["seed package unknown field", interpretationKnowledgeSeedPackageSchema, { ...seedPackage, unexpected: true }],
    ["load request unknown field", interpretationRuleLoadRequestSchema, {
      version: "interpretation-rules-v1", unexpected: true,
    }],
    ["evaluation request unknown field", interpretationRuleEvaluationRequestSchema, {
      analysisDimension: "one-dimensional", method: "rss", facts: {}, unexpected: true,
    }],
    ["facts unknown field", interpretationRuleEvaluationRequestSchema, {
      analysisDimension: "one-dimensional", method: "rss", facts: { unexpected: true },
    }],
    ["evaluation unknown field", interpretationRuleEvaluationSchema, {
      knowledgeBaseVersion: "interpretation-rules-v1", status: "not-applicable",
      factsUsed: [], matchedRules: [], missingFacts: [], unexpected: true,
    }],
  ])("rejects %s", (_description, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it.each([
    ["non-finite cpk", { cpk: Number.POSITIVE_INFINITY }],
    ["non-finite target Cpk", { targetCpk: { value: Number.NaN, source: "project" } }],
    ["non-finite sigma", { achievedSigma: Number.NEGATIVE_INFINITY }],
    ["negative contribution", { contributors: [{ reference: "A", contributionPercent: -0.1 }] }],
    ["contribution over 100", { contributors: [{ reference: "A", contributionPercent: 100.1 }] }],
  ])("rejects %s", (_description, facts) => {
    expect(interpretationRuleEvaluationRequestSchema.safeParse({
      analysisDimension: "one-dimensional",
      method: "rss",
      facts,
    }).success).toBe(false);
  });
});