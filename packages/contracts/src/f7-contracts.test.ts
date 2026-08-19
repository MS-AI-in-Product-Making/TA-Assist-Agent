import { describe, expect, it } from "vitest";
import {
  cpkRequestSchema,
  cpkResultSchema,
  f7CandidateEligibilitySchema,
  f7AnalysisRequestSchema,
  f7AnalysisResultSchema,
  f7FactorCandidateSchema,
  f7FactorConfirmRouteRequestSchema,
  f7FactorEvidenceSchema,
  f7FactorInputSchema,
  f7DatasetValidationIssueSchema,
  f7DatasetValidationReasonSchema,
  f7DatasetValidationResultSchema,
  f7FactorModeRouteRequestSchema,
  f7FactorSetupConfirmationSchema,
  f7LoopCoefficientSchema,
  f7MeasurementDispositionRequestSchema,
  f7MeasurementDispositionRouteRequestSchema,
  f7MeasurementPasteRequestSchema,
  f7MeasurementPasteRouteRequestSchema,
  f7MeasurementStructureSchema,
  f7SessionRouteParamsSchema,
  f7SessionSnapshotSchema,
  f7WorkbookImportRequestSchema,
  f7WorkbookImportRouteRequestSchema,
  f7WorksheetConfirmRouteRequestSchema,
} from "./index.js";

const SHA256 = "a".repeat(64);
const SHA256_2 = "b".repeat(64);

describe("F7 phase 1 factor contracts", () => {
  it("requires confidential snapshot classification and rejects public", () => {
    const baseSnapshot = {
      contractId: "f7-analysis-result-v1",
      outputClassification: "confidential",
      sessionId: "session-1",
      status: "worksheet_selection",
      workbook: {
        fileName: "Demo.xlsx",
        workbookContentHash: SHA256,
      },
      selectedWorksheetNames: ["Analysis-A"],
      factors: [],
    } as const;

    expect(f7SessionSnapshotSchema.safeParse(baseSnapshot).success).toBe(true);
    expect(
      f7SessionSnapshotSchema.safeParse({
        ...baseSnapshot,
        outputClassification: "public",
      }).success,
    ).toBe(false);
  });

  it("enforces signedContributionMean = loopCoefficient * physicalMean within tolerance", () => {
    const valid = {
      workbookContentHash: SHA256,
      worksheetName: "Analysis-A",
      tableId: "table-1",
      sourceRow: 2,
      sourceCells: { mean: "Analysis-A!D2" },
      factorCandidateId: SHA256_2,
      factorId: SHA256,
      factorName: "Gap",
      unit: "mm",
      unitSource: "user_confirmed",
      loopCoefficient: -1,
      physicalMean: 0.123456,
      signedContributionMean: -0.123456,
      baselineSampler: {
        samplerId: "NORMAL_LOCATION_SCALE_V1",
        physicalMean: 0.123456,
        standardDeviation: 0.02,
        support: "REAL",
      },
      lowerSpecLimit: -0.5,
      upperSpecLimit: 0.5,
    } as const;

    expect(f7FactorEvidenceSchema.parse(valid)).toEqual(valid);
    expect(
      f7FactorEvidenceSchema.safeParse({
        ...valid,
        signedContributionMean: -0.123455999998,
      }).success,
    ).toBe(false);
    expect(
      f7FactorEvidenceSchema.safeParse({
        ...valid,
        baselineSampler: {
          ...valid.baselineSampler,
          physicalMean: 0.123,
        },
      }).success,
    ).toBe(false);
    expect(
      f7FactorEvidenceSchema.safeParse({
        ...valid,
        factorId: SHA256.toUpperCase(),
      }).success,
    ).toBe(false);
    const missingFactorId = { ...valid };
    delete (missingFactorId as { factorId?: string }).factorId;
    expect(f7FactorEvidenceSchema.safeParse(missingFactorId).success).toBe(false);
  });

  it("limits coefficient to -1|+1 and rejects unknown fields", () => {
    expect(f7LoopCoefficientSchema.safeParse(-1).success).toBe(true);
    expect(f7LoopCoefficientSchema.safeParse(1).success).toBe(true);
    expect(f7LoopCoefficientSchema.safeParse(0).success).toBe(false);

    const candidate = {
      workbookContentHash: SHA256,
      worksheetName: "Analysis-A",
      tableId: "table-1",
      sourceRow: 3,
      sourceCells: {
        factorName: "Analysis-A!A3",
        mean: "Analysis-A!D3",
      },
      factorCandidateId: SHA256_2,
      factorName: "Thickness",
      excelSignedMean: -0.2,
      standardDeviation: 0.1,
      distribution: "Normal",
      lowerSpecLimit: -1,
      upperSpecLimit: 1,
    };
    expect(f7FactorCandidateSchema.parse(candidate)).toEqual(candidate);
    expect(f7FactorCandidateSchema.safeParse({ ...candidate, extra: true }).success).toBe(false);
  });

  it("reports sourceCells non-empty issue at sourceCells path", () => {
    const invalidCandidate = {
      workbookContentHash: SHA256,
      worksheetName: "Analysis-A",
      tableId: "table-1",
      sourceRow: 3,
      sourceCells: {},
      factorCandidateId: SHA256_2,
      factorName: "Thickness",
      excelSignedMean: -0.2,
      standardDeviation: 0.1,
      distribution: "Normal",
      lowerSpecLimit: -1,
      upperSpecLimit: 1,
    };

    const result = f7FactorCandidateSchema.safeParse(invalidCandidate);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "sourceCells")).toBe(true);
    }
  });

  it("accepts MEASURED mode without dataset and requires baseline sampler for BASELINE_ASSUMPTION", () => {
    expect(f7FactorInputSchema.safeParse({ mode: "MEASURED" }).success).toBe(true);
    expect(f7FactorInputSchema.safeParse({ mode: "BASELINE_ASSUMPTION" }).success).toBe(false);
    expect(
      f7FactorInputSchema.safeParse({
        mode: "BASELINE_ASSUMPTION",
        baselineSampler: {
          samplerId: "NORMAL_LOCATION_SCALE_V1",
          physicalMean: 0.2,
          standardDeviation: 0.05,
          support: "REAL",
        },
      }).success,
    ).toBe(true);
    expect(
      f7FactorInputSchema.safeParse({
        mode: "BASELINE_ASSUMPTION",
        baselineSampler: {
          samplerId: "UNKNOWN",
          physicalMean: 0.2,
          standardDeviation: 0.05,
          support: "REAL",
        },
      }).success,
    ).toBe(false);
  });
});

describe("F7 measurement dataset contracts", () => {
  it("enforces exact dataset validation reason enums, issue shape, and candidate eligibility statuses", () => {
    const exactReasons = [
      "subgroup_too_small",
      "ordered_sequence_invalid",
      "sample_count_below_minimum",
      "exploratory_only",
      "fit_uncertainty",
      "unit_mismatch",
      "specification_missing",
      "non_finite_measurement",
      "duplicate_measurement",
      "msa_evidence_missing",
      "mixed_batch_conditions",
      "outlier_candidate",
      "invalid_rows_rejected",
    ] as const;

    for (const reason of exactReasons) {
      expect(f7DatasetValidationReasonSchema.safeParse(reason).success).toBe(true);
    }

    expect(f7DatasetValidationReasonSchema.safeParse("invalid_row").success).toBe(false);
    expect(f7DatasetValidationReasonSchema.safeParse("distribution_unsupported").success).toBe(false);

    expect(
      f7DatasetValidationIssueSchema.safeParse({
        reason: "invalid_rows_rejected",
        factorId: SHA256,
        rowNumbers: [3, 7, 9],
      }).success,
    ).toBe(true);
    expect(
      f7DatasetValidationIssueSchema.safeParse({
        reason: "invalid_rows_rejected",
        factorId: SHA256,
        rowNumber: 3,
      }).success,
    ).toBe(false);
    expect(
      f7DatasetValidationIssueSchema.safeParse({
        reason: "invalid_rows_rejected",
        factorId: SHA256,
        rowNumbers: [7, 3],
      }).success,
    ).toBe(false);

    expect(
      f7CandidateEligibilitySchema.safeParse({
        normal: "eligible",
        lognormal: "eligible",
        weibull: "ineligible_nonpositive",
        gamma: "eligible",
        uniform: "eligible_with_boundary_warning",
      }).success,
    ).toBe(true);
    expect(
      f7CandidateEligibilitySchema.safeParse({
        normal: "unknown",
        lognormal: "eligible",
        weibull: "eligible",
        gamma: "eligible",
        uniform: "eligible",
      }).success,
    ).toBe(false);

    expect(
      f7DatasetValidationResultSchema.safeParse({
        status: "ready",
        blockingIssues: [],
        advisoryIssues: [
          {
            reason: "fit_uncertainty",
            factorId: SHA256,
          },
        ],
        candidateEligibility: {
          normal: "eligible",
          lognormal: "eligible",
          weibull: "eligible",
          gamma: "eligible",
          uniform: "eligible_with_boundary_warning",
        },
      }).success,
    ).toBe(true);
  });

  it("enforces ordered dataset structure, lowercase hash, count reconciliation and disposition rules", () => {
    const dataset = {
      factorId: SHA256,
      unit: "mm",
      structure: "ORDERED_INDIVIDUALS",
      sourceReference: "Paste: 2026-08-19",
      importedAt: "2026-08-19T08:00:00.000Z",
      msaStatus: "available",
      observations: [
        {
          value: 1.2,
          originalRow: 1,
          disposition: "included",
          sequence: "S-1",
        },
        {
          value: 1.25,
          originalRow: 2,
          disposition: "excluded",
          reason: "OUTLIER",
          operatorReference: "op-001",
          confirmed: true,
          subgroup: "A",
        },
      ],
      missingRowCount: 1,
      rejectionSummaries: [{ rowNumber: 4, reason: "missing_value" }],
      originalRowCount: 4,
      analyzedCount: 1,
      contentHash: SHA256_2,
    };

    expect(f7FactorInputSchema.parse({ mode: "MEASURED", dataset }).mode).toBe("MEASURED");
    expect(f7MeasurementStructureSchema.safeParse("ORDERED_INDIVIDUALS").success).toBe(true);

    expect(
      f7FactorInputSchema.safeParse({
        mode: "MEASURED",
        dataset: {
          ...dataset,
          contentHash: SHA256_2.toUpperCase(),
        },
      }).success,
    ).toBe(false);
    expect(
      f7FactorInputSchema.safeParse({
        mode: "MEASURED",
        dataset: {
          ...dataset,
          originalRowCount: 3,
        },
      }).success,
    ).toBe(false);
    expect(
      f7FactorInputSchema.safeParse({
        mode: "MEASURED",
        dataset: {
          ...dataset,
          analyzedCount: 2,
        },
      }).success,
    ).toBe(false);
    expect(
      f7FactorInputSchema.safeParse({
        mode: "MEASURED",
        dataset: {
          ...dataset,
          observations: [{
            value: 1.2,
            originalRow: 1,
            disposition: "included",
            reason: "OUTLIER",
          }],
          missingRowCount: 0,
          rejectionSummaries: [],
          originalRowCount: 1,
          analyzedCount: 1,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate observation original rows", () => {
    const duplicateObservations = {
      factorId: SHA256,
      unit: "mm",
      structure: "ORDERED_INDIVIDUALS",
      sourceReference: "Paste",
      importedAt: "2026-08-19T08:00:00.000Z",
      msaStatus: "available",
      observations: [
        {
          value: 1.2,
          originalRow: 1,
          disposition: "included",
        },
        {
          value: 1.25,
          originalRow: 1,
          disposition: "included",
        },
      ],
      missingRowCount: 0,
      rejectionSummaries: [],
      originalRowCount: 2,
      analyzedCount: 2,
      contentHash: SHA256_2,
    };
    expect(f7FactorInputSchema.safeParse({ mode: "MEASURED", dataset: duplicateObservations }).success).toBe(false);
  });

  it("rejects duplicate rejection row numbers", () => {
    const duplicateRejections = {
      factorId: SHA256,
      unit: "mm",
      structure: "ORDERED_INDIVIDUALS",
      sourceReference: "Paste",
      importedAt: "2026-08-19T08:00:00.000Z",
      msaStatus: "available",
      observations: [
        {
          value: 1.2,
          originalRow: 1,
          disposition: "included",
        },
      ],
      missingRowCount: 0,
      rejectionSummaries: [
        { rowNumber: 3, reason: "missing_value" },
        { rowNumber: 3, reason: "invalid_row" },
      ],
      originalRowCount: 3,
      analyzedCount: 1,
      contentHash: SHA256_2,
    };
    expect(f7FactorInputSchema.safeParse({ mode: "MEASURED", dataset: duplicateRejections }).success).toBe(false);
  });

  it("rejects overlap between observation rows and rejection rows", () => {
    const overlapRows = {
      factorId: SHA256,
      unit: "mm",
      structure: "ORDERED_INDIVIDUALS",
      sourceReference: "Paste",
      importedAt: "2026-08-19T08:00:00.000Z",
      msaStatus: "available",
      observations: [
        {
          value: 1.2,
          originalRow: 2,
          disposition: "included",
        },
      ],
      missingRowCount: 0,
      rejectionSummaries: [{ rowNumber: 2, reason: "missing_value" }],
      originalRowCount: 2,
      analyzedCount: 1,
      contentHash: SHA256_2,
    };
    expect(f7FactorInputSchema.safeParse({ mode: "MEASURED", dataset: overlapRows }).success).toBe(false);
  });
});

describe("F7 request/result strict wrappers", () => {
  const factorConfirmation = {
    factorCandidateId: SHA256,
    loopCoefficient: 1,
    unit: "mm",
    confirmed: true,
  } as const;

  const sessionSnapshot = {
    contractId: "f7-analysis-result-v1",
    outputClassification: "confidential",
    sessionId: "session-1",
    status: "worksheet_selection",
    workbook: {
      fileName: "Demo.xlsx",
      workbookContentHash: SHA256,
    },
    selectedWorksheetNames: ["Analysis-A"],
    factors: [],
  } as const;

  it("keeps all new input/output schemas strict", () => {
    expect(
      f7WorkbookImportRequestSchema.safeParse({
        contractId: "f7-analysis-request-v1",
        inputClassification: "confidential",
        fileName: "Demo.xlsx",
        workbookBytes: new Uint8Array([1]),
      }).success,
    ).toBe(true);
    expect(
      f7WorkbookImportRequestSchema.safeParse({
        contractId: "f7-analysis-request-v1",
        inputClassification: "confidential",
        fileName: "Demo.xlsx",
        workbookBytes: new Uint8Array([1]),
        extra: 1,
      }).success,
    ).toBe(false);

    expect(f7FactorSetupConfirmationSchema.parse(factorConfirmation)).toEqual(factorConfirmation);
    expect(f7FactorSetupConfirmationSchema.safeParse({ ...factorConfirmation, extra: true }).success).toBe(false);

    expect(
      f7MeasurementPasteRequestSchema.safeParse({
        factorId: SHA256,
        unit: "mm",
        structure: "ORDERED_INDIVIDUALS",
        sourceReference: "paste",
        msaStatus: "unknown",
        text: "1.1\n1.2",
      }).success,
    ).toBe(true);
    expect(
      f7MeasurementPasteRequestSchema.safeParse({
        factorId: SHA256,
        unit: "mm",
        structure: "ORDERED_INDIVIDUALS",
        sourceReference: "paste",
        msaStatus: "unknown",
        text: "1.1\n1.2",
        extra: "x",
      }).success,
    ).toBe(false);

    expect(
      f7MeasurementDispositionRequestSchema.safeParse({
        factorId: SHA256,
        rowNumbers: [1, 2],
        action: "EXCLUDE",
        reason: "OUTLIER",
        operatorReference: "op-1",
        confirmed: true,
      }).success,
    ).toBe(true);
    expect(
      f7MeasurementDispositionRequestSchema.safeParse({
        factorId: SHA256,
        rowNumbers: [1, 2],
        action: "EXCLUDE",
        reason: "OUTLIER",
        operatorReference: "op-1",
        confirmed: true,
        extra: "x",
      }).success,
    ).toBe(false);

    expect(f7SessionSnapshotSchema.parse(sessionSnapshot)).toEqual(sessionSnapshot);
    expect(f7SessionSnapshotSchema.safeParse({ ...sessionSnapshot, workbookBytes: new Uint8Array([1]) }).success).toBe(false);

    expect(
      f7AnalysisRequestSchema.safeParse({
        contractId: "f7-analysis-request-v1",
        inputClassification: "confidential",
        sessionId: "session-1",
      }).success,
    ).toBe(true);
    expect(
      f7AnalysisRequestSchema.safeParse({
        contractId: "f7-analysis-request-v1",
        inputClassification: "confidential",
        sessionId: "session-1",
        extra: "x",
      }).success,
    ).toBe(false);

    expect(
      f7AnalysisResultSchema.safeParse({
        contractId: "f7-analysis-result-v1",
        outputClassification: "confidential",
        snapshot: sessionSnapshot,
      }).success,
    ).toBe(true);
    expect(
      f7AnalysisResultSchema.safeParse({
        contractId: "f7-analysis-result-v1",
        outputClassification: "confidential",
        snapshot: sessionSnapshot,
        extra: "x",
      }).success,
    ).toBe(false);
  });

  it("keeps existing CPK placeholder schemas unchanged", () => {
    expect(
      cpkRequestSchema.safeParse({
        contractVersion: "v1",
        inputClassification: "confidential",
        projectReference: "p1",
        runReference: "r1",
        worksheetReferences: ["w1"],
      }).success,
    ).toBe(true);
    expect(
      cpkRequestSchema.safeParse({
        contractVersion: "v1",
        inputClassification: "confidential",
        projectReference: "p1",
        runReference: "r1",
        worksheetReferences: ["w1"],
        featureId: "F7",
      }).success,
    ).toBe(false);

    expect(
      cpkResultSchema.safeParse({
        contractVersion: "v1",
        outputClassification: "confidential",
        featureId: "F7",
        status: "feature_not_available",
        projectReference: "p1",
        runReference: "r1",
        worksheetReferences: ["w1"],
        requiredPrerequisites: ["approved-measurement-store"],
      }).success,
    ).toBe(true);
    expect(
      cpkResultSchema.safeParse({
        contractVersion: "v1",
        outputClassification: "confidential",
        featureId: "F7",
        status: "feature_not_available",
        projectReference: "p1",
        runReference: "r1",
        worksheetReferences: ["w1"],
        requiredPrerequisites: ["approved-measurement-store"],
        snapshot: {},
      }).success,
    ).toBe(false);
  });

  it("rejects unknown fields for all HTTP wrappers and nested worksheet confirmation fields", () => {
    const worksheetConfirm = {
      sessionId: "session-1",
      confirmation: {
        workbookContentHash: SHA256,
        selectedWorksheetNames: ["Analysis-A"],
        confirmed: true,
      },
    };
    expect(f7WorksheetConfirmRouteRequestSchema.safeParse(worksheetConfirm).success).toBe(true);
    expect(f7WorksheetConfirmRouteRequestSchema.safeParse({ ...worksheetConfirm, extra: true }).success).toBe(false);
    expect(
      f7WorksheetConfirmRouteRequestSchema.safeParse({
        ...worksheetConfirm,
        confirmation: {
          ...worksheetConfirm.confirmation,
          notAllowed: true,
        },
      }).success,
    ).toBe(false);

    const workbookImport = {
      fileName: "Demo.xlsx",
      workbookBase64: "ZGVtby1kYXRh",
    };
    expect(f7WorkbookImportRouteRequestSchema.safeParse(workbookImport).success).toBe(true);
    expect(f7WorkbookImportRouteRequestSchema.safeParse({ ...workbookImport, extra: true }).success).toBe(false);

    const factorConfirm = {
      sessionId: "session-1",
      confirmations: [factorConfirmation],
    };
    expect(f7FactorConfirmRouteRequestSchema.safeParse(factorConfirm).success).toBe(true);
    expect(f7FactorConfirmRouteRequestSchema.safeParse({ ...factorConfirm, extra: true }).success).toBe(false);

    const factorMode = {
      params: { factorId: SHA256 },
      body: { sessionId: "session-1", mode: "MEASURED" },
    };
    expect(f7FactorModeRouteRequestSchema.safeParse(factorMode).success).toBe(true);
    expect(f7FactorModeRouteRequestSchema.safeParse({ ...factorMode, extra: true }).success).toBe(false);
    expect(
      f7FactorModeRouteRequestSchema.safeParse({
        ...factorMode,
        body: { ...factorMode.body, factorId: SHA256 },
      }).success,
    ).toBe(false);

    const paste = {
      params: { factorId: SHA256 },
      body: {
        sessionId: "session-1",
        structure: "ORDERED_INDIVIDUALS",
        sourceReference: "clipboard",
        msaStatus: "available",
        text: "1.1\n1.2",
      },
    };
    expect(f7MeasurementPasteRouteRequestSchema.safeParse(paste).success).toBe(true);
    expect(f7MeasurementPasteRouteRequestSchema.safeParse({ ...paste, extra: true }).success).toBe(false);
    expect(
      f7MeasurementPasteRouteRequestSchema.safeParse({
        ...paste,
        body: { ...paste.body, factorId: SHA256 },
      }).success,
    ).toBe(false);

    const disposition = {
      params: { factorId: SHA256 },
      body: {
        sessionId: "session-1",
        rowNumbers: [1],
        action: "EXCLUDE",
        reason: "OUTLIER",
        operatorReference: "op-1",
        confirmed: true,
      },
    };
    expect(f7MeasurementDispositionRouteRequestSchema.safeParse(disposition).success).toBe(true);
    expect(f7MeasurementDispositionRouteRequestSchema.safeParse({ ...disposition, extra: true }).success).toBe(false);
    expect(
      f7MeasurementDispositionRouteRequestSchema.safeParse({
        ...disposition,
        body: {
          ...disposition.body,
          rowNumbers: [1, 1],
        },
      }).success,
    ).toBe(false);
    expect(
      f7MeasurementDispositionRouteRequestSchema.safeParse({
        ...disposition,
        body: { ...disposition.body, factorId: SHA256 },
      }).success,
    ).toBe(false);

    expect(f7SessionRouteParamsSchema.safeParse({ sessionId: "session-1" }).success).toBe(true);
    expect(f7SessionRouteParamsSchema.safeParse({ sessionId: "session-1", extra: true }).success).toBe(false);
  });

  it("requires measured dataset factorId to match known final evidence factorId when both exist", () => {
    const consistentSnapshot = {
      contractId: "f7-analysis-result-v1",
      outputClassification: "confidential",
      sessionId: "session-1",
      status: "measurement_entry",
      workbook: {
        fileName: "Demo.xlsx",
        workbookContentHash: SHA256,
      },
      selectedWorksheetNames: ["Analysis-A"],
      factors: [
        {
          factorCandidate: {
            workbookContentHash: SHA256,
            worksheetName: "Analysis-A",
            tableId: "table-1",
            sourceRow: 2,
            sourceCells: { factorName: "Analysis-A!A2" },
            factorCandidateId: SHA256_2,
            factorName: "Gap",
            excelSignedMean: -0.2,
            standardDeviation: 0.1,
            distribution: "Normal",
            lowerSpecLimit: -1,
            upperSpecLimit: 1,
          },
          evidence: {
            workbookContentHash: SHA256,
            worksheetName: "Analysis-A",
            tableId: "table-1",
            sourceRow: 2,
            sourceCells: { mean: "Analysis-A!D2" },
            factorCandidateId: SHA256_2,
            factorId: SHA256,
            factorName: "Gap",
            unit: "mm",
            unitSource: "user_confirmed",
            loopCoefficient: 1,
            physicalMean: 0.2,
            signedContributionMean: 0.2,
            baselineSampler: {
              samplerId: "NORMAL_LOCATION_SCALE_V1",
              physicalMean: 0.2,
              standardDeviation: 0.1,
              support: "REAL",
            },
            lowerSpecLimit: -1,
            upperSpecLimit: 1,
          },
          input: {
            mode: "MEASURED",
            dataset: {
              factorId: SHA256,
              unit: "mm",
              structure: "ORDERED_INDIVIDUALS",
              sourceReference: "Paste",
              importedAt: "2026-08-19T08:00:00.000Z",
              msaStatus: "available",
              observations: [{ value: 1.1, originalRow: 1, disposition: "included" }],
              missingRowCount: 0,
              rejectionSummaries: [],
              originalRowCount: 1,
              analyzedCount: 1,
              contentHash: SHA256_2,
            },
          },
        },
      ],
    };

    expect(f7SessionSnapshotSchema.safeParse(consistentSnapshot).success).toBe(true);
    expect(
      f7SessionSnapshotSchema.safeParse({
        ...consistentSnapshot,
        factors: [
          {
            ...consistentSnapshot.factors[0],
            input: {
              mode: "MEASURED",
              dataset: {
                ...consistentSnapshot.factors[0].input.dataset,
                factorId: SHA256_2,
              },
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires evidence.factorCandidateId to match factorCandidate.factorCandidateId", () => {
    const baseState = {
      factorCandidate: {
        workbookContentHash: SHA256,
        worksheetName: "Analysis-A",
        tableId: "table-1",
        sourceRow: 2,
        sourceCells: { factorName: "Analysis-A!A2" },
        factorCandidateId: SHA256_2,
        factorName: "Gap",
        excelSignedMean: -0.2,
        standardDeviation: 0.1,
        distribution: "Normal",
        lowerSpecLimit: -1,
        upperSpecLimit: 1,
      },
      evidence: {
        workbookContentHash: SHA256,
        worksheetName: "Analysis-A",
        tableId: "table-1",
        sourceRow: 2,
        sourceCells: { mean: "Analysis-A!D2" },
        factorCandidateId: SHA256_2,
        factorId: SHA256,
        factorName: "Gap",
        unit: "mm",
        unitSource: "user_confirmed",
        loopCoefficient: 1,
        physicalMean: 0.2,
        signedContributionMean: 0.2,
        baselineSampler: {
          samplerId: "NORMAL_LOCATION_SCALE_V1",
          physicalMean: 0.2,
          standardDeviation: 0.1,
          support: "REAL",
        },
        lowerSpecLimit: -1,
        upperSpecLimit: 1,
      },
      input: {
        mode: "MEASURED",
        dataset: {
          factorId: SHA256,
          unit: "mm",
          structure: "ORDERED_INDIVIDUALS",
          sourceReference: "Paste",
          importedAt: "2026-08-19T08:00:00.000Z",
          msaStatus: "available",
          observations: [{ value: 1.1, originalRow: 1, disposition: "included" }],
          missingRowCount: 0,
          rejectionSummaries: [],
          originalRowCount: 1,
          analyzedCount: 1,
          contentHash: SHA256_2,
        },
      },
    };

    const snapshot = {
      contractId: "f7-analysis-result-v1",
      outputClassification: "confidential",
      sessionId: "session-1",
      status: "measurement_entry",
      workbook: {
        fileName: "Demo.xlsx",
        workbookContentHash: SHA256,
      },
      selectedWorksheetNames: ["Analysis-A"],
      factors: [baseState],
    };

    expect(f7SessionSnapshotSchema.safeParse(snapshot).success).toBe(true);
    const mismatchResult = f7SessionSnapshotSchema.safeParse({
      ...snapshot,
      factors: [
        {
          ...baseState,
          evidence: {
            ...baseState.evidence,
            factorCandidateId: SHA256,
          },
        },
      ],
    });
    expect(mismatchResult.success).toBe(false);
    if (!mismatchResult.success) {
      expect(
        mismatchResult.error.issues.some((issue) => issue.path.join(".") === "factors.0.evidence.factorCandidateId"),
      ).toBe(true);
    }
  });
});