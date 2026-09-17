import { describe, expect, it } from "vitest";
import {
  F7_MEASUREMENT_IMPORT_MAX_DIAGNOSTICS,
  F7_MEASUREMENT_IMPORT_MAX_FACTORS,
  F7_MEASUREMENT_IMPORT_TEMPLATE_CONTRACT_ID,
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
  f7DistributionCandidateFamilySchema,
  f7DistributionFitCandidateSchema,
  f7DistributionFitResultSchema,
  f7DistributionFitRouteRequestSchema,
  f7FactorModeRouteRequestSchema,
  f7FactorSetupConfirmationSchema,
  f7LoopCoefficientSchema,
  f7MeasurementDispositionRequestSchema,
  f7MeasurementDispositionRouteRequestSchema,
  f7MeasurementImportAuthoritySchema,
  f7MeasurementImportCommitRequestSchema,
  f7MeasurementImportCommitRouteRequestSchema,
  f7MeasurementImportDiagnosticSchema,
  f7MeasurementImportFactorManifestSchema,
  f7MeasurementImportFactorPreviewSchema,
  f7MeasurementImportManifestSchema,
  f7MeasurementImportPreviewRequestSchema,
  f7MeasurementImportPreviewResponseSchema,
  f7MeasurementImportStoredBatchSchema,
  f7MeasurementPasteRequestSchema,
  f7MeasurementPasteRouteRequestSchema,
  f7MeasurementStructureSchema,
  f7ReportAssessmentSchema,
  f7ReportGenerateRouteRequestSchema,
  f7ReportProjectionSchema,
  f7SessionRouteParamsSchema,
  f7SessionSnapshotSchema,
  f7WorkbookImportRequestSchema,
  f7WorkbookImportRouteRequestSchema,
  f7WorksheetConfirmRouteRequestSchema,
} from "./index.js";
import { f7MeasurementImportFactorCoordinatesSchema } from "./index.js";

const SHA256 = "a".repeat(64);
const SHA256_2 = "b".repeat(64);
const BOOTSTRAP_REPLICATES = 10_000;
const BOOTSTRAP_EXTREME_COUNT = 4200;
const BOOTSTRAP_GRID_P_VALUE = (BOOTSTRAP_EXTREME_COUNT + 1) / (BOOTSTRAP_REPLICATES + 1);
const BOOTSTRAP_Z_95 = 1.959963984540054;
const UNIFORM_BOUNDARY_WARNING = "Uniform MLE bounds equal the sample minimum and maximum; boundary estimates are sensitive to additional observations.";

function wilsonScoreInterval(successes: number, trials: number): { lower: number; upper: number } {
  const zSquared = BOOTSTRAP_Z_95 * BOOTSTRAP_Z_95;
  const proportion = successes / trials;
  const denominator = 1 + zSquared / trials;
  const center = (proportion + zSquared / (2 * trials)) / denominator;
  const margin = (BOOTSTRAP_Z_95 / denominator)
    * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * trials)) / trials);
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

const DISTRIBUTION_FIT_RESULT = {
  factorId: SHA256,
  sampleSize: 32,
  characteristicKind: "other",
  candidates: [
    {
      family: "normal",
      modelSpecification: "normal_location_scale",
      parameterCount: 2,
      parameters: { mean: 1.25, standardDeviation: 0.08 },
      logLikelihood: 35.2,
      aic: -66.4,
      aicc: -65.98620689655172,
      bic: -63.46852819440055,
      deltaAicc: 0,
      deltaBic: 0,
      ks: 0.08,
      ad: 0.31,
      qqPoints: [
        { observed: 1.1, theoretical: 1.08 },
        { observed: 1.4, theoretical: 1.42 },
      ],
      bootstrap: {
        statisticId: "anderson_darling",
        observedStatistic: 0.31,
        comparisonDirection: "greater_than_or_equal",
        refitEachReplicate: true,
        extremeReplicateCount: BOOTSTRAP_EXTREME_COUNT,
        confidenceInterval: {
          level: 0.95,
          method: "wilson_score",
          ...wilsonScoreInterval(BOOTSTRAP_EXTREME_COUNT, BOOTSTRAP_REPLICATES),
        },
        pValue: BOOTSTRAP_GRID_P_VALUE,
        replicates: 10000,
        seed: SHA256_2,
        methodId: "F7_BOOTSTRAP_V2",
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1",
        streamDigest: SHA256,
        status: "acceptable",
      },
      warnings: [],
    },
  ],
  failedCandidates: [],
  sampleDiagnostics: {
    mean: 1.25,
    median: 1.24,
    skewness: 0.02,
    coefficientOfVariation: 0.064,
    meanMedianRelativeDifference: 0.008,
    normalQqCurvature: 0.03,
  },
  selectionDecision: {
    methodId: "F7_MODEL_SELECTION_V1",
    status: "unique_preference",
    numericBestFamily: "normal",
    competitiveFamilies: ["normal"],
    proposedFinalFamily: "normal",
    confidence: "moderate",
    reasonCodes: ["SINGLE_ACCEPTABLE_COMPETITOR", "SMALL_SAMPLE_UNCERTAINTY"],
  },
} as const;

function withFitCriteria<TCandidate extends typeof DISTRIBUTION_FIT_RESULT.candidates[number]>(
  candidate: TCandidate,
  sampleSize: number,
): TCandidate {
  const aic = 2 * candidate.parameterCount - 2 * candidate.logLikelihood;
  const aicc = aic + (2 * candidate.parameterCount * (candidate.parameterCount + 1))
    / (sampleSize - candidate.parameterCount - 1);
  const bic = candidate.parameterCount * Math.log(sampleSize) - 2 * candidate.logLikelihood;
  return {
    ...candidate,
    aic,
    aicc,
    bic,
  };
}

const WORKSHEET_OPTIONS = [
  {
    selectionIndex: 1,
    worksheetName: "Analysis-A",
    toleranceLoopDescription: "Loop A",
    worksheetKind: "analysis" as const,
    source: {
      summarySheet: "Auto Summary" as const,
      summaryRow: 10,
      worksheetAnchor: "Analysis-A!A1",
    },
  },
] as const;

function createReportFixture(
  assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE" = "MEETS_TARGET",
) {
  const notEvaluable = assessment === "NOT_EVALUABLE";
  const targetSigmaLevel = assessment === "MEETS_TARGET" ? 3 : 6;
  const standardDeviation = notEvaluable ? 0 : 0.1;
  const targetCpk = targetSigmaLevel / 3;
  const cp = notEvaluable ? undefined : 5 / 3;
  const cpk = notEvaluable ? undefined : 5 / 3;
  const inSpecCount = notEvaluable ? 10_000 : 9_997;
  const outOfSpecCount = 10_000 - inSpecCount;
  const yieldValue = inSpecCount / 10_000;
  const ppm = (outOfSpecCount / 10_000) * 1_000_000;
  const histogramBins = Array.from({ length: 20 }, (_, index) => ({
    minimum: index,
    maximum: index + 1,
    observedCount: index === 0 ? inSpecCount : index === 1 ? outOfSpecCount : 0,
  }));
  const factorManifest = [{
    factorId: SHA256,
    family: "normal" as const,
    sourceMode: "MEASURED" as const,
  }];

  const simulation = {
    methodId: "F7_MONTE_CARLO_V1" as const,
    status: "complete" as const,
    lowerSpecLimit: -0.5,
    upperSpecLimit: 0.5,
    targetSigmaLevel,
    iterations: 10_000 as const,
    runSeed: SHA256_2,
    correlationMode: "INDEPENDENT" as const,
    mean: 0,
    standardDeviation,
    quantiles: notEvaluable
      ? { p00135: 0, p01: 0, p05: 0, p50: 0, p95: 0, p99: 0, p99865: 0 }
      : { p00135: -0.3, p01: -0.23, p05: -0.16, p50: 0, p95: 0.16, p99: 0.23, p99865: 0.3 },
    inSpecCount,
    outOfSpecCount,
    yield: yieldValue,
    outOfSpecProbability: outOfSpecCount / 10_000,
    ppm,
    histogram: {
      methodId: "F7_HISTOGRAM_FD_V1" as const,
      bins: histogramBins,
    },
    normalFit: {
      methodId: "F7_NORMAL_MOMENT_FIT_V1" as const,
      mean: 0,
      standardDeviation,
      expectedBinCounts: histogramBins.map((bin) => bin.observedCount),
    },
    capability: notEvaluable
      ? { status: "not_available" as const, reason: "zero_variance" as const, targetCpk }
      : {
          status: "available" as const,
          cp: cp!,
          lowerCpk: cpk!,
          upperCpk: cpk!,
          cpk: cpk!,
          targetCpk,
          targetStatus: assessment === "MEETS_TARGET" ? "meets_target" as const : "below_target" as const,
        },
    normalModel: notEvaluable
      ? { status: "not_available" as const, reason: "zero_variance" as const }
      : {
          status: "available" as const,
          lowerTailDpm: 100,
          upperTailDpm: 200,
          totalDpm: 300,
          expectedYield: 0.9997,
        },
    factorManifest,
  };

  return {
    contractId: "f7-report-v1" as const,
    outputClassification: "confidential" as const,
    sessionId: "session-1",
    generatedAt: "2026-08-25T08:00:00.000Z",
    assessment,
    workbook: {
      fileName: "Demo.xlsx",
      workbookContentHash: SHA256,
      worksheetName: "Analysis-A",
    },
    summary: {
      mean: simulation.mean,
      standardDeviation: simulation.standardDeviation,
      yield: simulation.yield,
      ppm: simulation.ppm,
      lowerSpecLimit: simulation.lowerSpecLimit,
      upperSpecLimit: simulation.upperSpecLimit,
      targetSigmaLevel: simulation.targetSigmaLevel,
      ...(cp === undefined ? {} : { cp }),
      ...(cpk === undefined ? {} : { cpk }),
      targetCpk,
    },
    simulation,
    factors: [{
      factorId: SHA256,
      factorName: "Gap",
      loopCoefficient: 1 as const,
      sourceMode: "MEASURED" as const,
      designNominal: 10,
      upperTolerance: 0.2,
      lowerTolerance: -0.1,
      longTermSafetyFactor: 1.5,
      sigmaLevel: 3,
      setupDistribution: "Normal" as const,
      approvedDistribution: "normal" as const,
      sourceReferences: ["Analysis-A!A2", "clipboard"],
    }],
    evidence: {
      workbookContentHash: SHA256,
      worksheetName: "Analysis-A",
      specificationSourceCells: {
        lowerSpecLimit: "Analysis-A!B2",
        upperSpecLimit: "Analysis-A!B3",
        targetSigmaLevel: "Analysis-A!B4",
      },
      specificationInputOrigins: {
        lowerSpecLimit: "excel_source" as const,
        upperSpecLimit: "excel_source" as const,
        targetSigmaLevel: "excel_source" as const,
      },
      methodIds: {
        simulation: "F7_MONTE_CARLO_V1" as const,
        histogram: "F7_HISTOGRAM_FD_V1" as const,
        normalFit: "F7_NORMAL_MOMENT_FIT_V1" as const,
      },
      seed: SHA256_2,
      iterations: 10_000 as const,
      factorManifest,
    },
    markdown: "# F7 Report\n",
  };
}

describe("F7 report contracts", () => {
  it("accepts all governed assessment outcomes when they match simulation capability", () => {
    for (const assessment of ["MEETS_TARGET", "BELOW_TARGET", "NOT_EVALUABLE"] as const) {
      expect(f7ReportAssessmentSchema.parse(assessment)).toBe(assessment);
      expect(f7ReportProjectionSchema.parse(createReportFixture(assessment)).assessment).toBe(assessment);
    }
    expect(f7ReportAssessmentSchema.safeParse("RELEASE").success).toBe(false);
  });

  it("rejects unknown report fields and non-finite summary metrics", () => {
    const report = createReportFixture();
    expect(f7ReportProjectionSchema.safeParse({ ...report, extra: true }).success).toBe(false);
    expect(f7ReportProjectionSchema.safeParse({
      ...report,
      factors: [{ ...report.factors[0], extra: true }],
    }).success).toBe(false);
    expect(f7ReportProjectionSchema.safeParse({
      ...report,
      summary: { ...report.summary, mean: Number.POSITIVE_INFINITY },
    }).success).toBe(false);
  });

  it("requires strict confirmed Factor Setup inputs for every report factor", () => {
    const report = createReportFixture();
    const requiredSetupFields = [
      "designNominal",
      "upperTolerance",
      "lowerTolerance",
      "longTermSafetyFactor",
      "sigmaLevel",
      "setupDistribution",
    ] as const;

    for (const field of requiredSetupFields) {
      const factor: Partial<(typeof report.factors)[number]> = { ...report.factors[0] };
      delete factor[field];
      expect(f7ReportProjectionSchema.safeParse({
        ...report,
        factors: [factor],
      }).success).toBe(false);
    }

    const invalidNumericSetupFields = [
      ["designNominal", Number.POSITIVE_INFINITY],
      ["upperTolerance", Number.POSITIVE_INFINITY],
      ["lowerTolerance", Number.NEGATIVE_INFINITY],
      ["longTermSafetyFactor", Number.POSITIVE_INFINITY],
      ["sigmaLevel", Number.POSITIVE_INFINITY],
    ] as const;

    for (const [field, invalidValue] of invalidNumericSetupFields) {
      expect(f7ReportProjectionSchema.safeParse({
        ...report,
        factors: [{ ...report.factors[0], [field]: invalidValue }],
      }).success).toBe(false);
    }

    expect(f7ReportProjectionSchema.safeParse({
      ...report,
      factors: [{ ...report.factors[0], setupDistribution: "normal" }],
    }).success).toBe(false);
  });

  it("rejects report factors with zero-width tolerance ranges", () => {
    const report = createReportFixture();

    expect(f7ReportProjectionSchema.safeParse({
      ...report,
      factors: [{ ...report.factors[0], upperTolerance: 0, lowerTolerance: 0 }],
    }).success).toBe(false);
  });

  describe("F7 measurement import factor coordinates", () => {
    it("rejects missing mandatory coordinate cells and accepts the complete coordinate map", () => {
      expect(f7MeasurementImportFactorCoordinatesSchema.safeParse({
        factorNameCell: "Measurements!B2",
        unitCell: "Measurements!B3",
        designNominalCell: "Measurements!B4",
        upperToleranceCell: "Measurements!B5",
        lowerToleranceCell: "Measurements!B6",
        lowerSpecLimitCell: "Measurements!B7",
        upperSpecLimitCell: "Measurements!B8",
        measurementColumn: "B",
        firstMeasurementCell: "Measurements!B15",
      }).success).toBe(false);

      expect(f7MeasurementImportFactorCoordinatesSchema.parse({
        factorNameCell: "Measurements!B2",
        partNumberCell: "Measurements!B3",
        dimIdCell: "Measurements!B4",
        designNominalCell: "Measurements!B5",
        upperToleranceCell: "Measurements!B6",
        lowerToleranceCell: "Measurements!B7",
        lowerSpecLimitCell: "Measurements!B8",
        upperSpecLimitCell: "Measurements!B9",
        specificationSourceCell: "Measurements!B10",
        limitStatusCell: "Measurements!B11",
        measurementStructureCell: "Measurements!B12",
        subgroupSizeCell: "Measurements!B13",
        estimatorCell: "Measurements!B14",
        measurementColumn: "B",
        firstMeasurementCell: "Measurements!B15",
      })).toEqual({
        factorNameCell: "Measurements!B2",
        partNumberCell: "Measurements!B3",
        dimIdCell: "Measurements!B4",
        designNominalCell: "Measurements!B5",
        upperToleranceCell: "Measurements!B6",
        lowerToleranceCell: "Measurements!B7",
        lowerSpecLimitCell: "Measurements!B8",
        upperSpecLimitCell: "Measurements!B9",
        specificationSourceCell: "Measurements!B10",
        limitStatusCell: "Measurements!B11",
        measurementStructureCell: "Measurements!B12",
        subgroupSizeCell: "Measurements!B13",
        estimatorCell: "Measurements!B14",
        measurementColumn: "B",
        firstMeasurementCell: "Measurements!B15",
      });
    });
  });

  it("rejects available analysis when narrative judgment cpk and target drift from simulation capability", () => {
    const report = createReportFixture("BELOW_TARGET");
    report.analysis = {
      status: "available",
      provenance: {
        knowledgeBaseVersion: "interpretation-rules-v2",
        ruleId: "performance-cpk-below-target",
        threshold: report.simulation.capability.status === "available" ? report.simulation.capability.targetCpk : 2,
        applicability: "one-dimensional interpretation applied to the resolved Monte Carlo capability result",
      },
      comparison: {
        setup: { mean: 0, standardDeviation: 0.1, cp: 1.2, cpk: 1.1 },
        monteCarlo: { mean: report.simulation.mean, standardDeviation: report.simulation.standardDeviation, cp: 1.2, cpk: 1.1 },
      },
      targetAssessment: "Monte Carlo Cpk 1.100 is below the resolved target of 2.",
      interpretations: ["Interpretation"],
      optimizationDirections: ["Direction"],
      rootCauseSignals: [],
      controlledOptions: [],
      validationRequirements: [],
      narrative: {
        resultJudgment: {
          status: "below-target",
          headline: "Capability is below target",
          judgment: "Cpk 1.100 is below target 2.000.",
          cpk: 1.1,
          targetCpk: 2,
          margin: -0.9,
          display: { cpk: "1.100", targetCpk: "2.000", margin: "-0.900" },
          nearerSpecificationSide: "balanced",
        },
        engineeringSummary: "Summary",
        rootCauseAnalysis: [],
        engineeringRisk: "Risk",
        suggestedActionSequence: [],
        validationRequirements: [],
        evidenceDisclosure: "Disclosure",
      },
    };

    const mismatched = structuredClone(report);
    mismatched.analysis!.narrative.resultJudgment.cpk += 0.01;
    expect(f7ReportProjectionSchema.safeParse(mismatched).success).toBe(false);

    const mismatchedTarget = structuredClone(report);
    mismatchedTarget.analysis!.narrative.resultJudgment.targetCpk += 0.01;
    expect(f7ReportProjectionSchema.safeParse(mismatchedTarget).success).toBe(false);
  });

  it("rejects available analysis when narrative margin, status, or headline do not agree with simulation capability", () => {
    const report = createReportFixture("BELOW_TARGET");
    report.analysis = {
      status: "available",
      provenance: {
        knowledgeBaseVersion: "interpretation-rules-v2",
        ruleId: "performance-cpk-below-target",
        threshold: report.simulation.capability.status === "available" ? report.simulation.capability.targetCpk : 2,
        applicability: "one-dimensional interpretation applied to the resolved Monte Carlo capability result",
      },
      comparison: {
        setup: { mean: 0, standardDeviation: 0.1, cp: 1.2, cpk: 1.1 },
        monteCarlo: {
          mean: report.simulation.mean,
          standardDeviation: report.simulation.standardDeviation,
          cp: report.simulation.capability.status === "available" ? report.simulation.capability.cp : 1.2,
          cpk: report.simulation.capability.status === "available" ? report.simulation.capability.cpk : 1.1,
        },
      },
      targetAssessment: "Monte Carlo Cpk 1.667 is below the resolved target of 2.",
      interpretations: ["Interpretation"],
      optimizationDirections: ["Direction"],
      rootCauseSignals: [],
      controlledOptions: [],
      validationRequirements: [],
      narrative: {
        resultJudgment: {
          status: "below-target",
          headline: "Capability is below target",
          judgment: "Cpk 1.667 is 0.333 below the resolved target of 2.",
          cpk: report.simulation.capability.status === "available" ? report.simulation.capability.cpk : 1.667,
          targetCpk: report.simulation.capability.status === "available" ? report.simulation.capability.targetCpk : 2,
          margin: report.simulation.capability.status === "available"
            ? report.simulation.capability.cpk - report.simulation.capability.targetCpk
            : -0.333,
          display: { cpk: "1.667", targetCpk: "2.000", margin: "-0.333" },
          nearerSpecificationSide: "balanced",
        },
        engineeringSummary: "Summary",
        rootCauseAnalysis: [],
        engineeringRisk: "Risk",
        suggestedActionSequence: [],
        validationRequirements: [],
        evidenceDisclosure: "Disclosure",
      },
    };

    const mismatchedMargin = structuredClone(report);
    mismatchedMargin.analysis!.narrative.resultJudgment.margin = -0.5;
    expect(f7ReportProjectionSchema.safeParse(mismatchedMargin).success).toBe(false);

    const mismatchedStatus = structuredClone(report);
    mismatchedStatus.analysis!.narrative.resultJudgment.status = "meets-target";
    expect(f7ReportProjectionSchema.safeParse(mismatchedStatus).success).toBe(false);

    const mismatchedHeadline = structuredClone(report);
    mismatchedHeadline.analysis!.narrative.resultJudgment.headline = "Capability meets target";
    expect(f7ReportProjectionSchema.safeParse(mismatchedHeadline).success).toBe(false);
  });

  it("rejects available analysis when provenance threshold or Monte Carlo comparison metrics drift from simulation", () => {
    const report = createReportFixture("BELOW_TARGET");
    report.analysis = {
      status: "available",
      provenance: {
        knowledgeBaseVersion: "interpretation-rules-v2",
        ruleId: "performance-cpk-below-target",
        threshold: report.simulation.capability.status === "available" ? report.simulation.capability.targetCpk : 2,
        applicability: "one-dimensional interpretation applied to the resolved Monte Carlo capability result",
      },
      comparison: {
        setup: { mean: 0, standardDeviation: 0.1, cp: 1.2, cpk: 1.1 },
        monteCarlo: {
          mean: report.simulation.mean,
          standardDeviation: report.simulation.standardDeviation,
          cp: report.simulation.capability.status === "available" ? report.simulation.capability.cp : 1.2,
          cpk: report.simulation.capability.status === "available" ? report.simulation.capability.cpk : 1.1,
        },
      },
      targetAssessment: "Monte Carlo Cpk 1.667 is below the resolved target of 2.",
      interpretations: ["Interpretation"],
      optimizationDirections: ["Direction"],
      rootCauseSignals: [],
      controlledOptions: [],
      validationRequirements: [],
      narrative: {
        resultJudgment: {
          status: "below-target",
          headline: "Capability is below target",
          judgment: "Cpk 1.667 is 0.333 below the resolved target of 2.",
          cpk: report.simulation.capability.status === "available" ? report.simulation.capability.cpk : 1.667,
          targetCpk: report.simulation.capability.status === "available" ? report.simulation.capability.targetCpk : 2,
          margin: report.simulation.capability.status === "available"
            ? report.simulation.capability.cpk - report.simulation.capability.targetCpk
            : -0.333,
          display: { cpk: "1.667", targetCpk: "2.000", margin: "-0.333" },
          nearerSpecificationSide: "balanced",
        },
        engineeringSummary: "Summary",
        rootCauseAnalysis: [],
        engineeringRisk: "Risk",
        suggestedActionSequence: [],
        validationRequirements: [],
        evidenceDisclosure: "Disclosure",
      },
    };

    const mismatchedThreshold = structuredClone(report);
    mismatchedThreshold.analysis!.provenance.threshold += 0.01;
    expect(f7ReportProjectionSchema.safeParse(mismatchedThreshold).success).toBe(false);

    const mismatchedMean = structuredClone(report);
    mismatchedMean.analysis!.comparison.monteCarlo.mean += 0.01;
    expect(f7ReportProjectionSchema.safeParse(mismatchedMean).success).toBe(false);

    const mismatchedStdDev = structuredClone(report);
    mismatchedStdDev.analysis!.comparison.monteCarlo.standardDeviation += 0.01;
    expect(f7ReportProjectionSchema.safeParse(mismatchedStdDev).success).toBe(false);

    const mismatchedCp = structuredClone(report);
    mismatchedCp.analysis!.comparison.monteCarlo.cp += 0.01;
    expect(f7ReportProjectionSchema.safeParse(mismatchedCp).success).toBe(false);

    const mismatchedCpk = structuredClone(report);
    mismatchedCpk.analysis!.comparison.monteCarlo.cpk += 0.01;
    expect(f7ReportProjectionSchema.safeParse(mismatchedCpk).success).toBe(false);
  });

  it("rejects available analysis when provenance ruleId is inconsistent with the narrative status", () => {
    const meetsTargetReport = createReportFixture();
    meetsTargetReport.analysis = {
      status: "available",
      provenance: {
        knowledgeBaseVersion: "interpretation-rules-v2",
        ruleId: "performance-cpk",
        threshold: meetsTargetReport.simulation.capability.status === "available" ? meetsTargetReport.simulation.capability.targetCpk : 1,
        applicability: "one-dimensional interpretation applied to the resolved Monte Carlo capability result",
      },
      comparison: {
        setup: { mean: 0, standardDeviation: 0.1, cp: 1.2, cpk: 1.1 },
        monteCarlo: {
          mean: meetsTargetReport.simulation.mean,
          standardDeviation: meetsTargetReport.simulation.standardDeviation,
          cp: meetsTargetReport.simulation.capability.status === "available" ? meetsTargetReport.simulation.capability.cp : 1.2,
          cpk: meetsTargetReport.simulation.capability.status === "available" ? meetsTargetReport.simulation.capability.cpk : 1.1,
        },
      },
      targetAssessment: "Monte Carlo Cpk 1.667 meets the resolved target of 1.",
      interpretations: ["Interpretation"],
      optimizationDirections: ["Direction"],
      rootCauseSignals: [],
      controlledOptions: [],
      validationRequirements: [],
      narrative: {
        resultJudgment: {
          status: "meets-target",
          headline: "Capability meets target",
          judgment: "Cpk 1.667 meets target 1.000.",
          cpk: meetsTargetReport.simulation.capability.status === "available" ? meetsTargetReport.simulation.capability.cpk : 1.667,
          targetCpk: meetsTargetReport.simulation.capability.status === "available" ? meetsTargetReport.simulation.capability.targetCpk : 1,
          margin: meetsTargetReport.simulation.capability.status === "available"
            ? meetsTargetReport.simulation.capability.cpk - meetsTargetReport.simulation.capability.targetCpk
            : 0.667,
          display: { cpk: "1.667", targetCpk: "1.000", margin: "+0.667" },
          nearerSpecificationSide: "balanced",
        },
        engineeringSummary: "Summary",
        rootCauseAnalysis: [],
        engineeringRisk: "Risk",
        suggestedActionSequence: [],
        validationRequirements: [],
        evidenceDisclosure: "Disclosure",
      },
    };

    const mismatchedMeetsTarget = structuredClone(meetsTargetReport);
    mismatchedMeetsTarget.analysis!.provenance.ruleId = "performance-cpk-below-target";
    expect(f7ReportProjectionSchema.safeParse(mismatchedMeetsTarget).success).toBe(false);

    const belowTargetReport = createReportFixture("BELOW_TARGET");
    belowTargetReport.analysis = {
      status: "available",
      provenance: {
        knowledgeBaseVersion: "interpretation-rules-v2",
        ruleId: "performance-cpk-below-target",
        threshold: belowTargetReport.simulation.capability.status === "available" ? belowTargetReport.simulation.capability.targetCpk : 2,
        applicability: "one-dimensional interpretation applied to the resolved Monte Carlo capability result",
      },
      comparison: {
        setup: { mean: 0, standardDeviation: 0.1, cp: 1.2, cpk: 1.1 },
        monteCarlo: {
          mean: belowTargetReport.simulation.mean,
          standardDeviation: belowTargetReport.simulation.standardDeviation,
          cp: belowTargetReport.simulation.capability.status === "available" ? belowTargetReport.simulation.capability.cp : 1.2,
          cpk: belowTargetReport.simulation.capability.status === "available" ? belowTargetReport.simulation.capability.cpk : 1.1,
        },
      },
      targetAssessment: "Monte Carlo Cpk 1.667 is below the resolved target of 2.",
      interpretations: ["Interpretation"],
      optimizationDirections: ["Direction"],
      rootCauseSignals: [],
      controlledOptions: [],
      validationRequirements: [],
      narrative: {
        resultJudgment: {
          status: "below-target",
          headline: "Capability is below target",
          judgment: "Cpk 1.667 is 0.333 below the resolved target of 2.",
          cpk: belowTargetReport.simulation.capability.status === "available" ? belowTargetReport.simulation.capability.cpk : 1.667,
          targetCpk: belowTargetReport.simulation.capability.status === "available" ? belowTargetReport.simulation.capability.targetCpk : 2,
          margin: belowTargetReport.simulation.capability.status === "available"
            ? belowTargetReport.simulation.capability.cpk - belowTargetReport.simulation.capability.targetCpk
            : -0.333,
          display: { cpk: "1.667", targetCpk: "2.000", margin: "-0.333" },
          nearerSpecificationSide: "balanced",
        },
        engineeringSummary: "Summary",
        rootCauseAnalysis: [],
        engineeringRisk: "Risk",
        suggestedActionSequence: [],
        validationRequirements: [],
        evidenceDisclosure: "Disclosure",
      },
    };

    const mismatchedBelowTarget = structuredClone(belowTargetReport);
    mismatchedBelowTarget.analysis!.provenance.ruleId = "performance-cpk";
    expect(f7ReportProjectionSchema.safeParse(mismatchedBelowTarget).success).toBe(false);
  });

  it("rejects available analysis when legacy rootCauseSignals or controlledOptions drift from the ordered narrative projection", () => {
    const report = createReportFixture();
    report.analysis = {
      status: "available",
      provenance: {
        knowledgeBaseVersion: "interpretation-rules-v2",
        ruleId: "performance-cpk",
        threshold: report.simulation.capability.status === "available" ? report.simulation.capability.targetCpk : 1,
        applicability: "one-dimensional interpretation applied to the resolved Monte Carlo capability result",
      },
      comparison: {
        setup: { mean: 0, standardDeviation: 0.1, cp: 1.2, cpk: 1.1 },
        monteCarlo: {
          mean: report.simulation.mean,
          standardDeviation: report.simulation.standardDeviation,
          cp: report.simulation.capability.status === "available" ? report.simulation.capability.cp : 1.2,
          cpk: report.simulation.capability.status === "available" ? report.simulation.capability.cpk : 1.1,
        },
      },
      targetAssessment: "Monte Carlo Cpk 1.667 meets the resolved target of 1.",
      interpretations: ["Interpretation"],
      optimizationDirections: ["Direction"],
      rootCauseSignals: [
        {
          ruleId: "root-cause-1",
          title: "Root cause 1",
          sourceAlias: "kb://root-cause-1",
          sourceFileHash: SHA256,
        },
        {
          ruleId: "root-cause-2",
          title: "Root cause 2",
          sourceAlias: "kb://root-cause-2",
          sourceFileHash: SHA256_2,
        },
      ],
      controlledOptions: [
        {
          ruleId: "action-1",
          title: "Action 1",
          sourceAlias: "kb://action-1",
          sourceFileHash: SHA256,
        },
        {
          ruleId: "action-2",
          title: "Action 2",
          sourceAlias: "kb://action-2",
          sourceFileHash: SHA256_2,
        },
      ],
      validationRequirements: [],
      narrative: {
        resultJudgment: {
          status: "meets-target",
          headline: "Capability meets target",
          judgment: "Cpk 1.667 meets target 1.000.",
          cpk: report.simulation.capability.status === "available" ? report.simulation.capability.cpk : 1.667,
          targetCpk: report.simulation.capability.status === "available" ? report.simulation.capability.targetCpk : 1,
          margin: report.simulation.capability.status === "available"
            ? report.simulation.capability.cpk - report.simulation.capability.targetCpk
            : 0.667,
          display: { cpk: "1.667", targetCpk: "1.000", margin: "+0.667" },
          nearerSpecificationSide: "balanced",
        },
        engineeringSummary: "Summary",
        rootCauseAnalysis: [
          {
            ruleId: "root-cause-1",
            title: "Root cause 1",
            sourceAlias: "kb://root-cause-1",
            sourceFileHash: SHA256,
            hypothesis: true,
            explanation: "Explanation 1",
            completeEvidence: true,
          },
          {
            ruleId: "root-cause-2",
            title: "Root cause 2",
            sourceAlias: "kb://root-cause-2",
            sourceFileHash: SHA256_2,
            hypothesis: true,
            explanation: "Explanation 2",
            completeEvidence: false,
          },
        ],
        engineeringRisk: "Risk",
        suggestedActionSequence: [
          {
            optionId: "action-1",
            title: "Action 1",
            sourceAlias: "kb://action-1",
            sourceFileHash: SHA256,
            narrative: "Action narrative 1",
            validationSteps: ["Validate 1"],
          },
          {
            optionId: "action-2",
            title: "Action 2",
            sourceAlias: "kb://action-2",
            sourceFileHash: SHA256_2,
            narrative: "Action narrative 2",
            validationSteps: ["Validate 2"],
          },
        ],
        validationRequirements: [],
        evidenceDisclosure: "Disclosure",
      },
    };

    expect(f7ReportProjectionSchema.safeParse(report).success).toBe(true);

    const reorderedRootCauses = structuredClone(report);
    reorderedRootCauses.analysis!.rootCauseSignals.reverse();
    expect(f7ReportProjectionSchema.safeParse(reorderedRootCauses).success).toBe(false);

    const retitledRootCause = structuredClone(report);
    retitledRootCause.analysis!.rootCauseSignals[0]!.title = "Different root cause title";
    expect(f7ReportProjectionSchema.safeParse(retitledRootCause).success).toBe(false);

    const changedRootCauseSourceAlias = structuredClone(report);
    changedRootCauseSourceAlias.analysis!.rootCauseSignals[0]!.sourceAlias = "kb://different-root-cause-1";
    expect(f7ReportProjectionSchema.safeParse(changedRootCauseSourceAlias).success).toBe(false);

    const changedRootCauseSourceHash = structuredClone(report);
    changedRootCauseSourceHash.analysis!.rootCauseSignals[0]!.sourceFileHash = "c".repeat(64);
    expect(f7ReportProjectionSchema.safeParse(changedRootCauseSourceHash).success).toBe(false);

    const reorderedControlledOptions = structuredClone(report);
    reorderedControlledOptions.analysis!.controlledOptions.reverse();
    expect(f7ReportProjectionSchema.safeParse(reorderedControlledOptions).success).toBe(false);

    const retitledControlledOption = structuredClone(report);
    retitledControlledOption.analysis!.controlledOptions[0]!.title = "Different action title";
    expect(f7ReportProjectionSchema.safeParse(retitledControlledOption).success).toBe(false);

    const changedControlledOptionSourceAlias = structuredClone(report);
    changedControlledOptionSourceAlias.analysis!.controlledOptions[0]!.sourceAlias = "kb://different-action-1";
    expect(f7ReportProjectionSchema.safeParse(changedControlledOptionSourceAlias).success).toBe(false);

    const changedControlledOptionSourceHash = structuredClone(report);
    changedControlledOptionSourceHash.analysis!.controlledOptions[0]!.sourceFileHash = "d".repeat(64);
    expect(f7ReportProjectionSchema.safeParse(changedControlledOptionSourceHash).success).toBe(false);

    const missingNarrativeRootCauseSourceAlias = structuredClone(report);
    delete missingNarrativeRootCauseSourceAlias.analysis!.narrative.rootCauseAnalysis[0]!.sourceAlias;
    expect(f7ReportProjectionSchema.safeParse(missingNarrativeRootCauseSourceAlias).success).toBe(false);

    const missingNarrativeRootCauseSourceHash = structuredClone(report);
    delete missingNarrativeRootCauseSourceHash.analysis!.narrative.rootCauseAnalysis[0]!.sourceFileHash;
    expect(f7ReportProjectionSchema.safeParse(missingNarrativeRootCauseSourceHash).success).toBe(false);

    const missingNarrativeActionSourceAlias = structuredClone(report);
    delete missingNarrativeActionSourceAlias.analysis!.narrative.suggestedActionSequence[0]!.sourceAlias;
    expect(f7ReportProjectionSchema.safeParse(missingNarrativeActionSourceAlias).success).toBe(false);

    const missingNarrativeActionSourceHash = structuredClone(report);
    delete missingNarrativeActionSourceHash.analysis!.narrative.suggestedActionSequence[0]!.sourceFileHash;
    expect(f7ReportProjectionSchema.safeParse(missingNarrativeActionSourceHash).success).toBe(false);

    const driftedValidationRequirements = structuredClone(report);
    driftedValidationRequirements.analysis!.validationRequirements = ["Different validation step"];
    expect(f7ReportProjectionSchema.safeParse(driftedValidationRequirements).success).toBe(false);
  });

  it("requires strict specification input origins for every Monte Carlo specification field", () => {
    const report = createReportFixture();
    const { specificationInputOrigins: _missing, ...evidenceWithoutOrigins } = report.evidence;

    expect(f7ReportProjectionSchema.safeParse({
      ...report,
      evidence: evidenceWithoutOrigins,
    }).success).toBe(false);
    expect(f7ReportProjectionSchema.safeParse({
      ...report,
      evidence: {
        ...report.evidence,
        specificationInputOrigins: {
          ...report.evidence.specificationInputOrigins,
          lowerSpecLimit: "unknown",
        },
      },
    }).success).toBe(false);
    expect(f7ReportProjectionSchema.safeParse({
      ...report,
      evidence: {
        ...report.evidence,
        specificationInputOrigins: {
          ...report.evidence.specificationInputOrigins,
          extra: "manual_entry",
        },
      },
    }).success).toBe(false);
  });

  it.each([
    ["excel_source without its source cell", "excel_source", false],
    ["manual_override with a source cell", "manual_override", true],
  ] as const)("rejects %s at the specific source-cell path", (_case, origin, includeSourceCell) => {
    const report = createReportFixture();
    const specificationSourceCells = { ...report.evidence.specificationSourceCells };
    if (!includeSourceCell) delete specificationSourceCells.lowerSpecLimit;

    const result = f7ReportProjectionSchema.safeParse({
      ...report,
      evidence: {
        ...report.evidence,
        specificationSourceCells,
        specificationInputOrigins: {
          ...report.evidence.specificationInputOrigins,
          lowerSpecLimit: origin,
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(({ path }) => path)).toContainEqual([
        "evidence",
        "specificationSourceCells",
        "lowerSpecLimit",
      ]);
    }
  });

  it("requires a strict report generation route body", () => {
    const request = { body: { sessionId: "session-1" } };
    expect(f7ReportGenerateRouteRequestSchema.parse(request)).toEqual(request);
    expect(f7ReportGenerateRouteRequestSchema.safeParse({
      body: { sessionId: "session-1", extra: true },
    }).success).toBe(false);
    expect(f7ReportGenerateRouteRequestSchema.safeParse({
      body: { sessionId: "" },
    }).success).toBe(false);
    expect(f7ReportGenerateRouteRequestSchema.safeParse({ ...request, extra: true }).success).toBe(false);
  });

  it("rejects report projections that disagree with the simulation or evidence manifest", () => {
    const report = createReportFixture("BELOW_TARGET");
    expect(f7ReportProjectionSchema.safeParse({ ...report, assessment: "MEETS_TARGET" }).success).toBe(false);
    expect(f7ReportProjectionSchema.safeParse({
      ...report,
      summary: { ...report.summary, mean: 0.01 },
    }).success).toBe(false);
    expect(f7ReportProjectionSchema.safeParse({
      ...report,
      factors: [{ ...report.factors[0], sourceMode: "BASELINE_ASSUMPTION" }],
    }).success).toBe(false);
    expect(f7ReportProjectionSchema.safeParse({
      ...report,
      evidence: {
        ...report.evidence,
        factorManifest: [{ ...report.evidence.factorManifest[0], family: "gamma" }],
      },
    }).success).toBe(false);
    expect(f7ReportProjectionSchema.safeParse({
      ...report,
      evidence: { ...report.evidence, iterations: 100_000 },
    }).success).toBe(false);
  });
});

describe("F7 phase 1 factor contracts", () => {
  it("accepts governed optional Factor traceability overrides", () => {
    const confirmation = {
      factorCandidateId: SHA256,
      designNominal: 1,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      confirmed: true,
    } as const;

    expect(f7FactorSetupConfirmationSchema.parse(confirmation)).toEqual(confirmation);
    expect(f7FactorSetupConfirmationSchema.parse({
      ...confirmation,
      partNumber: "PN-OVERRIDE",
      dimId: "DIM-OVERRIDE",
    })).toMatchObject({
      partNumber: "PN-OVERRIDE",
      dimId: "DIM-OVERRIDE",
    });
    expect(f7FactorSetupConfirmationSchema.parse({
      ...confirmation,
      partNumber: null,
      dimId: null,
    })).toMatchObject({ partNumber: null, dimId: null });

    for (const field of ["partNumber", "dimId"] as const) {
      expect(f7FactorSetupConfirmationSchema.safeParse({
        ...confirmation,
        [field]: "   ",
      }).success).toBe(false);
      expect(f7FactorSetupConfirmationSchema.safeParse({
        ...confirmation,
        [field]: "x".repeat(301),
      }).success).toBe(false);
    }
  });

  it("governs editable signed nominal and bilateral tolerances", () => {
    const subtractive = {
      factorCandidateId: SHA256,
      designNominal: -0.57,
      upperTolerance: 0.05,
      lowerTolerance: -0.05,
      confirmed: true,
    } as const;

    expect(f7FactorSetupConfirmationSchema.parse(subtractive)).toEqual(subtractive);
    expect(f7FactorSetupConfirmationSchema.safeParse({ ...subtractive, designNominal: 0 }).success).toBe(true);
    expect(f7FactorSetupConfirmationSchema.safeParse({ ...subtractive, upperTolerance: -0.01 }).success).toBe(false);
    expect(f7FactorSetupConfirmationSchema.safeParse({ ...subtractive, lowerTolerance: 0.01 }).success).toBe(false);
    expect(f7FactorSetupConfirmationSchema.safeParse({
      ...subtractive,
      designNominal: -0.02,
      upperTolerance: 0.03,
    }).success).toBe(true);
    expect(f7FactorSetupConfirmationSchema.safeParse({ ...subtractive, loopCoefficient: -1 }).success).toBe(false);

    const userAdded = {
      ...subtractive,
      factorCandidateId: SHA256_2,
      factorName: "User stack gap",
      userAdded: true,
    } as const;
    expect(f7FactorSetupConfirmationSchema.parse(userAdded)).toEqual(userAdded);
    expect(f7FactorSetupConfirmationSchema.safeParse({ ...userAdded, factorName: "" }).success).toBe(false);
    expect(f7FactorSetupConfirmationSchema.safeParse({ ...subtractive, factorName: "Unexpected" }).success).toBe(false);
  });

  it("accepts all F4 tolerance distribution choices", () => {
    const base = {
      factorCandidateId: SHA256,
      designNominal: 1,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      confirmed: true,
    } as const;

    for (const distribution of ["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"] as const) {
      expect(f7FactorSetupConfirmationSchema.parse({ ...base, distribution }).distribution).toBe(distribution);
    }
  });

  it("accepts only controlled optional component categories in factor confirmations", () => {
    const confirmation = {
      factorCandidateId: SHA256,
      designNominal: 1,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      confirmed: true,
    } as const;

    expect(f7FactorSetupConfirmationSchema.parse(confirmation)).toEqual(confirmation);
    expect(f7FactorSetupConfirmationSchema.parse({
      ...confirmation,
      componentCategory: "battery-cts",
    }).componentCategory).toBe("battery-cts");
    expect(f7FactorSetupConfirmationSchema.safeParse({
      ...confirmation,
      componentCategory: "custom battery category",
    }).success).toBe(false);
  });

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
      worksheetOptions: WORKSHEET_OPTIONS,
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

  it("optionally preserves the governed worksheet system specification", () => {
    const systemSpecification = {
      status: "available",
      designNominal: {
        status: "available",
        actualValue: -0.57,
        displayValue: "-0.57",
        sourceLabel: "Design nominal",
        valueOrigin: "numeric_literal",
      },
      lowerSpecLimit: {
        status: "available",
        actualValue: -0.5,
        displayValue: "-0.5",
        sourceLabel: "Lower specification limit",
        valueOrigin: "numeric_literal",
      },
      upperSpecLimit: {
        status: "available",
        actualValue: 0.5,
        displayValue: "0.5",
        sourceLabel: "Upper specification limit",
        valueOrigin: "numeric_literal",
      },
      targetSigmaLevel: {
        status: "available",
        actualValue: 6,
        displayValue: "6",
        sourceLabel: "Target sigma level",
        valueOrigin: "numeric_literal",
      },
      additionalMeanShift: {
        status: "available",
        actualValue: 0,
        displayValue: "0",
        sourceLabel: "Additional mean shift",
        valueOrigin: "numeric_literal",
      },
    } as const;
    const snapshot = {
      contractId: "f7-analysis-result-v1",
      outputClassification: "confidential",
      sessionId: "session-1",
      status: "worksheet_selection",
      workbook: {
        fileName: "Demo.xlsx",
        workbookContentHash: SHA256,
      },
      selectedWorksheetNames: ["Analysis-A"],
      worksheetOptions: WORKSHEET_OPTIONS,
      factors: [],
    } as const;

    expect(f7SessionSnapshotSchema.parse({ ...snapshot, systemSpecification })).toEqual({
      ...snapshot,
      systemSpecification,
    });
    expect(f7SessionSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(f7SessionSnapshotSchema.safeParse({
      ...snapshot,
      systemSpecification: { ...systemSpecification, extra: true },
    }).success).toBe(false);
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
      designNominal: -0.123456,
      upperTolerance: 0.05,
      lowerTolerance: -0.05,
      longTermSafetyFactor: 1,
      sigmaLevel: 2.5,
      distribution: "Normal",
      calculatedMean: -0.123456,
      tolerance: 0.05,
      oneSigma: 0.02,
      percentContributionToSigma: 1,
      loopCoefficient: -1,
      physicalMean: 0.123456,
      signedContributionMean: -0.123456,
      baselineSampler: {
        samplerId: "NORMAL_LOCATION_SCALE_V1",
        physicalMean: 0.123456,
        standardDeviation: 0.02,
        support: "REAL",
      },
      lowerSpecLimit: 0.073456,
      upperSpecLimit: 0.173456,
    } as const;

    expect(f7FactorEvidenceSchema.parse(valid)).toEqual(valid);
    expect(f7FactorEvidenceSchema.parse({
      ...valid,
      componentCategory: "cover-fit-and-function",
    }).componentCategory).toBe("cover-fit-and-function");
    expect(f7FactorEvidenceSchema.safeParse({
      ...valid,
      componentCategory: "custom cover category",
    }).success).toBe(false);
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
        distribution: "Uniform",
      }).success,
    ).toBe(false);
    expect(
      f7FactorEvidenceSchema.safeParse({
        ...valid,
        distribution: "Triangular",
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

  it("preserves optional Factor traceability and governed specification provenance", () => {
    const candidate = {
      workbookContentHash: SHA256,
      worksheetName: "Analysis-A",
      tableId: "table-1",
      sourceRow: 2,
      sourceCells: {
        factorName: "Analysis-A!A2",
        partNumber: "Analysis-A!B2",
        dimId: "Analysis-A!C2",
        factorLowerSpecLimit: "Analysis-A!D2",
        factorUpperSpecLimit: "Analysis-A!E2",
        lowerSpecLimit: "Analysis-A!D2",
        upperSpecLimit: "Analysis-A!E2",
      },
      factorCandidateId: SHA256_2,
      factorName: "Gap",
      partNumber: "PN-007",
      dimId: "DIM-42",
      excelSignedMean: -0.2,
      designNominal: -0.2,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      standardDeviation: 0.01,
      distribution: "Normal",
      specificationSource: "Worksheet",
      lowerSpecLimit: 0.01,
      upperSpecLimit: 0.5,
    } as const;
    expect(f7FactorCandidateSchema.parse(candidate)).toEqual(candidate);
    expect(f7FactorCandidateSchema.safeParse({
      ...candidate,
      lowerSpecLimit: -0.01,
    }).success).toBe(false);
    const worksheetCandidateWithoutLowerSource = structuredClone(candidate);
    delete (worksheetCandidateWithoutLowerSource.sourceCells as { factorLowerSpecLimit?: string }).factorLowerSpecLimit;
    expect(f7FactorCandidateSchema.safeParse(worksheetCandidateWithoutLowerSource).success).toBe(false);

    const legacyCandidate = {
      ...candidate,
      specificationSource: undefined,
      sourceCells: {
        factorName: candidate.sourceCells.factorName,
        lowerSpecLimit: candidate.sourceCells.lowerSpecLimit,
        upperSpecLimit: candidate.sourceCells.upperSpecLimit,
      },
      lowerSpecLimit: 0.1,
      upperSpecLimit: 0.3,
    };
    delete (legacyCandidate as { specificationSource?: string }).specificationSource;
    expect(f7FactorCandidateSchema.safeParse(legacyCandidate).success).toBe(true);
    expect(f7FactorCandidateSchema.safeParse({
      ...legacyCandidate,
      specificationSource: "Derived",
    }).success).toBe(true);

    const { excelSignedMean: _excelSignedMean, standardDeviation: _standardDeviation, ...candidateEvidenceFields } = candidate;
    const worksheetEvidence = {
      ...candidateEvidenceFields,
      factorId: SHA256,
      unit: "mm",
      unitSource: "workbook",
      longTermSafetyFactor: 1,
      sigmaLevel: 5,
      calculatedMean: -0.2,
      tolerance: 0.1,
      oneSigma: 0.02,
      percentContributionToSigma: 1,
      loopCoefficient: -1,
      physicalMean: 0.2,
      signedContributionMean: -0.2,
      baselineSampler: {
        samplerId: "NORMAL_LOCATION_SCALE_V1",
        physicalMean: 0.2,
        standardDeviation: 0.02,
        support: "REAL",
      },
    } as const;
    expect(f7FactorEvidenceSchema.parse(worksheetEvidence)).toEqual(worksheetEvidence);
    const worksheetEvidenceWithoutLowerSource = structuredClone(worksheetEvidence);
    delete (worksheetEvidenceWithoutLowerSource.sourceCells as { factorLowerSpecLimit?: string }).factorLowerSpecLimit;
    expect(f7FactorEvidenceSchema.safeParse(worksheetEvidenceWithoutLowerSource).success).toBe(false);
    const worksheetEvidenceWithoutUpperSource = structuredClone(worksheetEvidence);
    delete (worksheetEvidenceWithoutUpperSource.sourceCells as { factorUpperSpecLimit?: string }).factorUpperSpecLimit;
    expect(f7FactorEvidenceSchema.safeParse(worksheetEvidenceWithoutUpperSource).success).toBe(false);

    const legacyDerived = {
      ...worksheetEvidence,
      specificationSource: undefined,
      lowerSpecLimit: 0.1,
      upperSpecLimit: 0.3,
    };
    delete (legacyDerived as { specificationSource?: string }).specificationSource;
    expect(f7FactorEvidenceSchema.safeParse(legacyDerived).success).toBe(true);
    expect(f7FactorEvidenceSchema.safeParse({ ...legacyDerived, lowerSpecLimit: 0.01 }).success).toBe(false);
    expect(f7FactorCandidateSchema.safeParse({ ...candidate, partNumber: " ".repeat(2) }).success).toBe(false);
    expect(f7FactorCandidateSchema.safeParse({ ...candidate, dimId: "x".repeat(301) }).success).toBe(false);
  });

  it("uses coefficient zero for neutral Assembly Shift factors and rejects unknown fields", () => {
    expect(f7LoopCoefficientSchema.safeParse(-1).success).toBe(true);
    expect(f7LoopCoefficientSchema.safeParse(0).success).toBe(true);
    expect(f7LoopCoefficientSchema.safeParse(1).success).toBe(true);
    expect(f7FactorEvidenceSchema.safeParse({
      workbookContentHash: SHA256,
      worksheetName: "Analysis-A",
      tableId: "table-1",
      sourceRow: 2,
      sourceCells: { mean: "Analysis-A!D2" },
      factorCandidateId: SHA256_2,
      factorId: SHA256,
      factorName: "Assembly shift",
      unit: "mm",
      unitSource: "user_confirmed",
      designNominal: 0,
      upperTolerance: 0.05,
      lowerTolerance: -0.05,
      longTermSafetyFactor: 1,
      sigmaLevel: 2.5,
      distribution: "Normal",
      calculatedMean: 0,
      tolerance: 0.05,
      oneSigma: 0.02,
      percentContributionToSigma: 1,
      loopCoefficient: 0,
      physicalMean: 0,
      signedContributionMean: 0,
      baselineSampler: {
        samplerId: "NORMAL_LOCATION_SCALE_V1",
        physicalMean: 0,
        standardDeviation: 0.02,
        support: "REAL",
      },
      lowerSpecLimit: 0,
      upperSpecLimit: 0.05,
    }).success).toBe(true);

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
      designNominal: -0.2,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
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
      designNominal: -0.2,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
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
          samplerId: "UNIFORM_BOUNDED_V1",
          physicalMean: 1_000_000,
          standardDeviation: 1,
          minimum: 1_000_000 - Math.sqrt(3),
          maximum: 1_000_000 + Math.sqrt(3),
          support: "BOUNDED_REAL",
        },
      }).success,
    ).toBe(true);
    expect(
      f7FactorInputSchema.safeParse({
        mode: "BASELINE_ASSUMPTION",
        baselineSampler: {
          samplerId: "UNIFORM_BOUNDED_V1",
          physicalMean: 0.2,
          standardDeviation: 0.05,
          minimum: 0.2 - Math.sqrt(3) * 0.05,
          maximum: 0.2 + Math.sqrt(3) * 0.05,
          support: "BOUNDED_REAL",
        },
      }).success,
    ).toBe(true);
    expect(
      f7FactorInputSchema.safeParse({
        mode: "BASELINE_ASSUMPTION",
        baselineSampler: {
          samplerId: "UNIFORM_BOUNDED_V1",
          physicalMean: 0.2,
          standardDeviation: 0.05,
          minimum: 0.1,
          maximum: 0.3,
          support: "BOUNDED_REAL",
        },
      }).success,
    ).toBe(false);
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
  it("accepts governed rational subgroup configuration on paste requests", () => {
    const request = {
      factorId: SHA256,
      unit: "mm",
      structure: "RATIONAL_SUBGROUP",
      rationalSubgroupConfig: { subgroupSize: 5, estimator: "RANGE_D2" },
      sourceReference: "local-workbench-entry",
      msaStatus: "unknown",
      text: "value\tsubgroup\n1\t1\n2\t1",
    };

    expect(f7MeasurementPasteRequestSchema.safeParse(request).success).toBe(true);
    expect(f7MeasurementPasteRequestSchema.safeParse({
      ...request,
      rationalSubgroupConfig: { subgroupSize: 1, estimator: "RANGE_D2" },
    }).success).toBe(false);
    expect(f7MeasurementPasteRouteRequestSchema.safeParse({
      params: { factorId: SHA256 },
      body: { sessionId: "session-01", ...request, factorId: undefined, unit: undefined },
    }).success).toBe(false);
    expect(f7MeasurementPasteRouteRequestSchema.safeParse({
      params: { factorId: SHA256 },
      body: {
        sessionId: "session-01",
        structure: request.structure,
        rationalSubgroupConfig: request.rationalSubgroupConfig,
        sourceReference: request.sourceReference,
        msaStatus: request.msaStatus,
        text: request.text,
      },
    }).success).toBe(true);
  });

  it("caps measurement observations at the governed distribution-fit resource bound", () => {
    const observations = Array.from({ length: 501 }, (_, index) => ({
      value: index,
      originalRow: index + 1,
      disposition: "included" as const,
    }));
    const dataset = {
      factorId: SHA256,
      unit: "mm",
      structure: "ORDERED_INDIVIDUALS",
      sourceReference: "Paste",
      importedAt: "2026-08-19T08:00:00.000Z",
      msaStatus: "available",
      observations,
      missingRowCount: 0,
      rejectionSummaries: [],
      originalRowCount: observations.length,
      analyzedCount: observations.length,
      contentHash: SHA256_2,
    };

    expect(f7FactorInputSchema.safeParse({
      mode: "MEASURED",
      dataset: { ...dataset, observations: observations.slice(0, 500), originalRowCount: 500, analyzedCount: 500 },
    }).success).toBe(true);
    expect(f7FactorInputSchema.safeParse({ mode: "MEASURED", dataset }).success).toBe(false);
  });

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

describe("F7 distribution fit contracts", () => {
  it("accepts only governed candidate families and strict finite fit diagnostics", () => {
    for (const family of ["normal", "lognormal", "weibull", "gamma", "uniform"] as const) {
      expect(f7DistributionCandidateFamilySchema.safeParse(family).success).toBe(true);
    }
    expect(f7DistributionCandidateFamilySchema.safeParse("beta").success).toBe(false);

    expect(f7DistributionFitCandidateSchema.parse(DISTRIBUTION_FIT_RESULT.candidates[0])).toEqual(
      DISTRIBUTION_FIT_RESULT.candidates[0],
    );
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      bootstrap: { ...DISTRIBUTION_FIT_RESULT.candidates[0].bootstrap, pValue: 1.01 },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      ks: Number.NaN,
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      parameters: {},
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      bootstrap: { ...DISTRIBUTION_FIT_RESULT.candidates[0].bootstrap, seed: 1729 },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      extra: true,
    }).success).toBe(false);
  });

  it("requires explicit model specification, parameter count, and delta diagnostics", () => {
    const candidate = DISTRIBUTION_FIT_RESULT.candidates[0];
    expect(f7DistributionFitCandidateSchema.parse(candidate)).toEqual(candidate);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      parameterCount: 3,
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      modelSpecification: "gamma_location_scale",
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      deltaAicc: Number.POSITIVE_INFINITY,
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      deltaBic: Number.NaN,
    }).success).toBe(false);
  });

  it("rejects future free-location specifications in governed fit candidates", () => {
    const candidate = DISTRIBUTION_FIT_RESULT.candidates[0];
    const freeLocationCandidates = [
      ["lognormal", "lognormal_location_free", { logMean: 0, logStandardDeviation: 1 }],
      ["weibull", "weibull_location_free", { shape: 2, scale: 1 }],
      ["gamma", "gamma_location_free", { shape: 2, scale: 1 }],
    ] as const;
    for (const [family, modelSpecification, parameters] of freeLocationCandidates) {
      expect(f7DistributionFitCandidateSchema.safeParse({
        ...candidate,
        family,
        modelSpecification,
        parameterCount: 3,
        parameters,
      }).success).toBe(false);
    }
  });

  it("requires governed bootstrap framing and threshold-consistent status", () => {
    const bootstrap = DISTRIBUTION_FIT_RESULT.candidates[0].bootstrap;
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      bootstrap: { ...bootstrap, replicates: 1999 },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      bootstrap: { ...bootstrap, methodId: "F7_BOOTSTRAP_V1" },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      bootstrap: { ...bootstrap, candidateMethodId: "F7_DISTRIBUTION_FIT_V2" },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      bootstrap: { ...bootstrap, streamDigest: "A".repeat(64) },
    }).success).toBe(false);

    for (const [pValue, status] of [
      [499 / 10001, "rejected"],
      [501 / 10001, "weak"],
      [999 / 10001, "weak"],
      [1001 / 10001, "acceptable"],
    ] as const) {
      const extremeReplicateCount = Math.round(pValue * (BOOTSTRAP_REPLICATES + 1)) - 1;
      expect(f7DistributionFitCandidateSchema.safeParse({
        ...DISTRIBUTION_FIT_RESULT.candidates[0],
        bootstrap: {
          ...bootstrap,
          pValue,
          status,
          extremeReplicateCount,
          confidenceInterval: {
            level: 0.95,
            method: "wilson_score",
            ...wilsonScoreInterval(extremeReplicateCount, BOOTSTRAP_REPLICATES),
          },
        },
      }).success).toBe(true);
    }
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      bootstrap: {
        ...bootstrap,
        pValue: 501 / 10001,
        status: "rejected",
        extremeReplicateCount: 500,
        confidenceInterval: {
          level: 0.95,
          method: "wilson_score",
          ...wilsonScoreInterval(500, BOOTSTRAP_REPLICATES),
        },
      },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      bootstrap: {
        ...bootstrap,
        pValue: 1001 / 10001,
        status: "weak",
        extremeReplicateCount: 1000,
        confidenceInterval: {
          level: 0.95,
          method: "wilson_score",
          ...wilsonScoreInterval(1000, BOOTSTRAP_REPLICATES),
        },
      },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      bootstrap: { ...bootstrap, pValue: 0 },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      bootstrap: { ...bootstrap, pValue: 0.42 },
    }).success).toBe(false);
  });

  it("requires governed Anderson-Darling bootstrap metadata and Wilson interval consistency", () => {
    const candidate = DISTRIBUTION_FIT_RESULT.candidates[0];
    expect(f7DistributionFitCandidateSchema.safeParse(candidate).success).toBe(true);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      bootstrap: { ...candidate.bootstrap, statisticId: "kolmogorov_smirnov" },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      bootstrap: { ...candidate.bootstrap, observedStatistic: candidate.ad + 0.01 },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      bootstrap: { ...candidate.bootstrap, comparisonDirection: "greater_than" },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      bootstrap: { ...candidate.bootstrap, refitEachReplicate: false },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      bootstrap: { ...candidate.bootstrap, extremeReplicateCount: 10000.5 },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      bootstrap: {
        ...candidate.bootstrap,
        confidenceInterval: {
          ...candidate.bootstrap.confidenceInterval,
          lower: candidate.bootstrap.confidenceInterval.lower + 0.01,
        },
      },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      bootstrap: {
        ...candidate.bootstrap,
        pValue: BOOTSTRAP_EXTREME_COUNT / BOOTSTRAP_REPLICATES,
      },
    }).success).toBe(false);
  });

  it("requires finite ordered Q-Q evidence with at least two points", () => {
    const candidate = DISTRIBUTION_FIT_RESULT.candidates[0];
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      qqPoints: candidate.qqPoints.slice(0, 1),
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      qqPoints: [candidate.qqPoints[1], candidate.qqPoints[0]],
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      qqPoints: [candidate.qqPoints[0], { observed: Number.POSITIVE_INFINITY, theoretical: 2 }],
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...candidate,
      qqPoints: [{ ...candidate.qqPoints[0], extra: true }, candidate.qqPoints[1]],
    }).success).toBe(false);
  });

  it("requires exactly the governed parameter keys and valid parameter domains", () => {
    const normal = DISTRIBUTION_FIT_RESULT.candidates[0];
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...normal,
      parameters: { mean: 1.25, standardDeviation: 0.08, scale: 1 },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...normal,
      parameters: { mean: 1.25, standardDeviation: 0 },
    }).success).toBe(false);

    for (const [family, parameters] of [
      ["lognormal", { logMean: 0.1, logStandardDeviation: 0.2 }],
      ["weibull", { shape: 1.5, scale: 2 }],
      ["gamma", { shape: 2, scale: 0.5 }],
      ["uniform", { minimum: 1, maximum: 2 }],
    ] as const) {
      const warnings = family === "uniform" ? [UNIFORM_BOUNDARY_WARNING] : [];
      const modelSpecification = family === "lognormal"
        ? "lognormal_location_zero"
        : family === "weibull"
          ? "weibull_location_zero"
          : family === "gamma"
            ? "gamma_location_zero"
            : "uniform_boundary_mle";
      expect(
        f7DistributionFitCandidateSchema.safeParse({
          ...normal,
          family,
          modelSpecification,
          parameterCount: 2,
          parameters,
          warnings,
        }).success,
      ).toBe(true);
    }
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...normal,
      family: "gamma",
      parameters: { shape: -1, scale: 0.5 },
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...normal,
      family: "uniform",
      parameters: { minimum: 2, maximum: 2 },
      warnings: [UNIFORM_BOUNDARY_WARNING],
    }).success).toBe(false);
    expect(f7DistributionFitCandidateSchema.safeParse({
      ...normal,
      family: "uniform",
      parameters: { minimum: 1, maximum: 2 },
      warnings: ["Boundary warning"],
    }).success).toBe(false);
  });

  it("validates failed candidates and withholds selection after any numerical failure", () => {
    const failedGamma = { family: "gamma", reasonCode: "numerical_fit_failed" } as const;
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      failedCandidates: [failedGamma],
      selectionDecision: {
        ...DISTRIBUTION_FIT_RESULT.selectionDecision,
        status: "withheld_candidate_failures",
        proposedFinalFamily: undefined,
        confidence: "low",
        reasonCodes: [
          "SINGLE_ACCEPTABLE_COMPETITOR",
          "SMALL_SAMPLE_UNCERTAINTY",
          "CANDIDATE_FIT_FAILURES",
        ],
      },
    }).success).toBe(true);
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      failedCandidates: [failedGamma, failedGamma],
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      failedCandidates: [{ family: "normal", reasonCode: "numerical_fit_failed" }],
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      failedCandidates: [failedGamma],
      selectionDecision: {
        ...DISTRIBUTION_FIT_RESULT.selectionDecision,
        status: "unique_preference",
      },
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      failedCandidates: [{ family: "gamma", reasonCode: "unknown" }],
    }).success).toBe(false);
  });

  it("requires the governed numeric best, competitive set, and no-acceptable logic", () => {
    expect(f7DistributionFitResultSchema.parse(DISTRIBUTION_FIT_RESULT)).toEqual(DISTRIBUTION_FIT_RESULT);
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      selectionDecision: {
        ...DISTRIBUTION_FIT_RESULT.selectionDecision,
        numericBestFamily: "gamma",
      },
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      selectionDecision: {
        ...DISTRIBUTION_FIT_RESULT.selectionDecision,
        numericBestFamily: undefined,
      },
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      candidates: [
        DISTRIBUTION_FIT_RESULT.candidates[0],
        {
          ...DISTRIBUTION_FIT_RESULT.candidates[0],
          family: "gamma",
          modelSpecification: "gamma_location_zero",
          parameters: { shape: 2, scale: 0.5 },
          aicc: DISTRIBUTION_FIT_RESULT.candidates[0].aicc - 1,
        },
      ],
      selectionDecision: {
        ...DISTRIBUTION_FIT_RESULT.selectionDecision,
        numericBestFamily: "normal",
      },
    }).success).toBe(false);
    const tiedGamma = {
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      family: "gamma" as const,
      modelSpecification: "gamma_location_zero" as const,
      parameters: { shape: 2, scale: 0.5 },
    };
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      candidates: [DISTRIBUTION_FIT_RESULT.candidates[0], tiedGamma],
      selectionDecision: {
        ...DISTRIBUTION_FIT_RESULT.selectionDecision,
        status: "no_unique_preference",
        competitiveFamilies: ["normal", "gamma"],
        confidence: "low",
        reasonCodes: ["MULTIPLE_COMPETITIVE_MODELS", "SMALL_SAMPLE_UNCERTAINTY"],
      },
    }).success).toBe(true);
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      candidates: [DISTRIBUTION_FIT_RESULT.candidates[0], tiedGamma],
      selectionDecision: {
        ...DISTRIBUTION_FIT_RESULT.selectionDecision,
        status: "no_unique_preference",
        competitiveFamilies: ["gamma"],
        confidence: "low",
        reasonCodes: ["MULTIPLE_COMPETITIVE_MODELS", "SMALL_SAMPLE_UNCERTAINTY"],
      },
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      candidates: [{
        ...DISTRIBUTION_FIT_RESULT.candidates[0],
        bootstrap: {
          ...DISTRIBUTION_FIT_RESULT.candidates[0].bootstrap,
          pValue: 801 / 10001,
          extremeReplicateCount: 800,
          confidenceInterval: {
            level: 0.95,
            method: "wilson_score",
            ...wilsonScoreInterval(800, BOOTSTRAP_REPLICATES),
          },
          status: "weak",
        },
      }],
      selectionDecision: {
        ...DISTRIBUTION_FIT_RESULT.selectionDecision,
        status: "no_acceptable_model",
        numericBestFamily: undefined,
        competitiveFamilies: [],
        proposedFinalFamily: undefined,
        confidence: "low",
        reasonCodes: ["SMALL_SAMPLE_UNCERTAINTY", "NO_ACCEPTABLE_MODEL"],
      },
    }).success).toBe(true);
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      candidates: [{
        ...DISTRIBUTION_FIT_RESULT.candidates[0],
        bootstrap: {
          ...DISTRIBUTION_FIT_RESULT.candidates[0].bootstrap,
          pValue: 801 / 10001,
          extremeReplicateCount: 800,
          confidenceInterval: {
            level: 0.95,
            method: "wilson_score",
            ...wilsonScoreInterval(800, BOOTSTRAP_REPLICATES),
          },
          status: "weak",
        },
      }],
      selectionDecision: {
        ...DISTRIBUTION_FIT_RESULT.selectionDecision,
        status: "no_acceptable_model",
        numericBestFamily: undefined,
        competitiveFamilies: [],
        proposedFinalFamily: undefined,
        confidence: "moderate",
        reasonCodes: ["SMALL_SAMPLE_UNCERTAINTY", "NO_ACCEPTABLE_MODEL"],
      },
    }).success).toBe(false);
  });

  it("requires structured diagnostics and selection decision while rejecting legacy recommendedFamily", () => {
    const nextShape = {
      ...DISTRIBUTION_FIT_RESULT,
      sampleDiagnostics: {
        mean: 1.25,
        median: 1.24,
        skewness: 0.02,
        coefficientOfVariation: 0.064,
        meanMedianRelativeDifference: 0.008,
        normalQqCurvature: 0.03,
      },
      selectionDecision: {
        methodId: "F7_MODEL_SELECTION_V1",
        status: "unique_preference",
        numericBestFamily: "normal",
        competitiveFamilies: ["normal"],
        proposedFinalFamily: "normal",
        confidence: "moderate",
        reasonCodes: ["SINGLE_ACCEPTABLE_COMPETITOR", "SMALL_SAMPLE_UNCERTAINTY"],
      },
    };
    delete (nextShape as { recommendedFamily?: string }).recommendedFamily;

    expect(f7DistributionFitResultSchema.safeParse(nextShape).success).toBe(true);
    expect(f7DistributionFitResultSchema.safeParse({
      ...nextShape,
      recommendedFamily: "normal",
    }).success).toBe(false);
  });

  it("validates competitive-set, small-sample, and engineering-default invariants in selectionDecision", () => {
    const base = {
      ...DISTRIBUTION_FIT_RESULT,
      characteristicKind: "dimensional" as const,
      candidates: [
        DISTRIBUTION_FIT_RESULT.candidates[0],
        {
          ...DISTRIBUTION_FIT_RESULT.candidates[0],
          family: "gamma" as const,
          modelSpecification: "gamma_location_zero" as const,
          parameters: { shape: 2, scale: 0.5 },
        },
      ],
      sampleDiagnostics: {
        mean: 1.25,
        median: 1.24,
        skewness: 0.1,
        coefficientOfVariation: 0.064,
        meanMedianRelativeDifference: 0.008,
        normalQqCurvature: 0.03,
      },
      selectionDecision: {
        methodId: "F7_MODEL_SELECTION_V1",
        status: "no_unique_preference",
        numericBestFamily: "normal",
        competitiveFamilies: ["normal", "gamma"],
        engineeringDefaultFamily: "normal",
        proposedFinalFamily: "normal",
        confidence: "low",
        reasonCodes: [
          "MULTIPLE_COMPETITIVE_MODELS",
          "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT",
          "SMALL_SAMPLE_UNCERTAINTY",
        ],
      },
    };
    delete (base as { recommendedFamily?: string }).recommendedFamily;

    expect(f7DistributionFitResultSchema.safeParse(base).success).toBe(true);
    expect(f7DistributionFitResultSchema.safeParse({
      ...base,
      selectionDecision: {
        ...base.selectionDecision,
        competitiveFamilies: ["normal"],
      },
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...base,
      selectionDecision: {
        ...base.selectionDecision,
        confidence: "moderate",
      },
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...base,
      selectionDecision: {
        ...base.selectionDecision,
        engineeringDefaultFamily: "gamma",
      },
    }).success).toBe(false);
  });

  it("requires characteristicKind and rejects engineering defaults unless the exact dimensional algorithm conditions hold", () => {
    const normal64 = withFitCriteria(DISTRIBUTION_FIT_RESULT.candidates[0], 64);
    const gamma64 = withFitCriteria({
      ...normal64,
      family: "gamma" as const,
      modelSpecification: "gamma_location_zero" as const,
      parameters: { shape: 2, scale: 0.5 },
      logLikelihood: normal64.logLikelihood - 0.75,
      deltaAicc: 1.5,
      deltaBic: 1.5,
    }, 64);
    const base = {
      ...DISTRIBUTION_FIT_RESULT,
      sampleSize: 64,
      characteristicKind: "dimensional" as const,
      candidates: [normal64, gamma64],
      selectionDecision: {
        methodId: "F7_MODEL_SELECTION_V1",
        status: "no_unique_preference" as const,
        numericBestFamily: "normal" as const,
        competitiveFamilies: ["normal", "gamma"] as const,
        engineeringDefaultFamily: "normal" as const,
        proposedFinalFamily: "normal" as const,
        confidence: "moderate" as const,
        reasonCodes: [
          "MULTIPLE_COMPETITIVE_MODELS",
          "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT",
        ] as const,
      },
    };

    const missingCharacteristicKind = { ...base } as { characteristicKind?: "dimensional" | "other" };
    delete missingCharacteristicKind.characteristicKind;
    expect(f7DistributionFitResultSchema.safeParse(missingCharacteristicKind).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse(base).success).toBe(true);
    expect(f7DistributionFitResultSchema.safeParse({
      ...base,
      characteristicKind: "other",
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...base,
      sampleDiagnostics: {
        ...base.sampleDiagnostics,
        skewness: 0.51,
      },
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...base,
      selectionDecision: {
        ...base.selectionDecision,
        engineeringDefaultFamily: undefined,
        reasonCodes: ["MULTIPLE_COMPETITIVE_MODELS"],
      },
    }).success).toBe(false);
  });

  it("rejects reason codes that are extra, missing, or incompatible with the derived outcome", () => {
    const normal64 = withFitCriteria(DISTRIBUTION_FIT_RESULT.candidates[0], 64);
    const gamma64 = withFitCriteria({
      ...normal64,
      family: "gamma" as const,
      modelSpecification: "gamma_location_zero" as const,
      parameters: { shape: 2, scale: 0.5 },
      logLikelihood: normal64.logLikelihood - 0.75,
      deltaAicc: 1.5,
      deltaBic: 1.5,
    }, 64);
    const competitiveBase = {
      ...DISTRIBUTION_FIT_RESULT,
      sampleSize: 64,
      characteristicKind: "dimensional" as const,
      candidates: [normal64, gamma64],
      selectionDecision: {
        methodId: "F7_MODEL_SELECTION_V1",
        status: "no_unique_preference" as const,
        numericBestFamily: "normal" as const,
        competitiveFamilies: ["normal", "gamma"] as const,
        engineeringDefaultFamily: "normal" as const,
        proposedFinalFamily: "normal" as const,
        confidence: "moderate" as const,
        reasonCodes: [
          "MULTIPLE_COMPETITIVE_MODELS",
          "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT",
        ] as const,
      },
    };

    expect(f7DistributionFitResultSchema.safeParse({
      ...competitiveBase,
      selectionDecision: {
        ...competitiveBase.selectionDecision,
        status: "unique_preference",
        reasonCodes: [
          "SINGLE_ACCEPTABLE_COMPETITOR",
          "NO_ACCEPTABLE_MODEL",
          "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT",
        ],
      },
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...competitiveBase,
      failedCandidates: [{ family: "weibull", reasonCode: "numerical_fit_failed" }],
      selectionDecision: {
        ...competitiveBase.selectionDecision,
        status: "withheld_candidate_failures",
        confidence: "low",
        engineeringDefaultFamily: undefined,
        reasonCodes: ["MULTIPLE_COMPETITIVE_MODELS"],
      },
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...competitiveBase,
      selectionDecision: {
        ...competitiveBase.selectionDecision,
        reasonCodes: [
          "MULTIPLE_COMPETITIVE_MODELS",
          "SMALL_SAMPLE_UNCERTAINTY",
          "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT",
        ],
      },
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...DISTRIBUTION_FIT_RESULT,
      selectionDecision: {
        ...DISTRIBUTION_FIT_RESULT.selectionDecision,
        reasonCodes: [
          "SINGLE_ACCEPTABLE_COMPETITOR",
          "SMALL_SAMPLE_UNCERTAINTY",
          "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT",
        ],
      },
    }).success).toBe(false);
  });

  it("accepts candidates at delta AICc 2 and rejects every positive exceedance", () => {
    const normal64 = withFitCriteria(DISTRIBUTION_FIT_RESULT.candidates[0], 64);
    const withinTolerance = {
      ...DISTRIBUTION_FIT_RESULT,
      sampleSize: 64,
      candidates: [
        normal64,
        withFitCriteria({
          ...normal64,
          family: "gamma" as const,
          modelSpecification: "gamma_location_zero" as const,
          parameters: { shape: 2, scale: 0.5 },
          logLikelihood: normal64.logLikelihood - 1,
          deltaAicc: 2,
          deltaBic: 2,
        }, 64),
      ],
      selectionDecision: {
        methodId: "F7_MODEL_SELECTION_V1",
        status: "no_unique_preference" as const,
        numericBestFamily: "normal" as const,
        competitiveFamilies: ["normal", "gamma"] as const,
        proposedFinalFamily: "normal" as const,
        confidence: "moderate" as const,
        reasonCodes: ["MULTIPLE_COMPETITIVE_MODELS"] as const,
      },
    };

    expect(f7DistributionFitResultSchema.safeParse(withinTolerance).success).toBe(true);
    expect(f7DistributionFitResultSchema.safeParse({
      ...withinTolerance,
      selectionDecision: {
        ...withinTolerance.selectionDecision,
        proposedFinalFamily: "gamma",
      },
    }).success).toBe(false);
    expect(f7DistributionFitResultSchema.safeParse({
      ...withinTolerance,
      candidates: [
        withinTolerance.candidates[0],
        withFitCriteria({
          ...withinTolerance.candidates[1],
          logLikelihood: normal64.logLikelihood - 1.00000000025,
          deltaAicc: 2.0000000005,
          deltaBic: 2.0000000005,
        }, 64),
      ],
      selectionDecision: {
        ...withinTolerance.selectionDecision,
        status: "unique_preference",
        competitiveFamilies: ["normal"],
        reasonCodes: ["SINGLE_ACCEPTABLE_COMPETITOR"],
      },
    }).success).toBe(true);
    expect(f7DistributionFitResultSchema.safeParse({
      ...withinTolerance,
      candidates: [
        withinTolerance.candidates[0],
        withFitCriteria({
          ...withinTolerance.candidates[1],
          logLikelihood: normal64.logLikelihood - 1.00000000025,
          deltaAicc: 2.0000000005,
          deltaBic: 2.0000000005,
        }, 64),
      ],
      selectionDecision: withinTolerance.selectionDecision,
    }).success).toBe(false);
  });

  it("enforces governed family precedence for exact AICc ties independent of candidate order", () => {
    const gamma = withFitCriteria({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      family: "gamma" as const,
      modelSpecification: "gamma_location_zero" as const,
      parameters: { shape: 2, scale: 0.5 },
    }, 64);
    const lognormal = withFitCriteria({
      ...DISTRIBUTION_FIT_RESULT.candidates[0],
      family: "lognormal" as const,
      modelSpecification: "lognormal_location_zero" as const,
      parameters: { logMean: 0, logStandardDeviation: 0.2 },
    }, 64);
    const tiedResult = {
      ...DISTRIBUTION_FIT_RESULT,
      sampleSize: 64,
      candidates: [gamma, lognormal],
      selectionDecision: {
        methodId: "F7_MODEL_SELECTION_V1" as const,
        status: "no_unique_preference" as const,
        numericBestFamily: "lognormal" as const,
        competitiveFamilies: ["gamma", "lognormal"] as const,
        proposedFinalFamily: "lognormal" as const,
        confidence: "moderate" as const,
        reasonCodes: ["MULTIPLE_COMPETITIVE_MODELS"] as const,
      },
    };

    expect(f7DistributionFitResultSchema.safeParse(tiedResult).success).toBe(true);
    expect(f7DistributionFitResultSchema.safeParse({
      ...tiedResult,
      candidates: [lognormal, gamma],
      selectionDecision: {
        ...tiedResult.selectionDecision,
        competitiveFamilies: ["lognormal", "gamma"],
      },
    }).success).toBe(true);
    expect(f7DistributionFitResultSchema.safeParse({
      ...tiedResult,
      selectionDecision: {
        ...tiedResult.selectionDecision,
        numericBestFamily: "gamma",
        proposedFinalFamily: "gamma",
      },
    }).success).toBe(false);
  });

  it("requires factor-scoped route params and strict session body", () => {
    const request = { params: { factorId: SHA256 }, body: { sessionId: "session-1" } };
    expect(f7DistributionFitRouteRequestSchema.parse(request)).toEqual(request);
    expect(f7DistributionFitRouteRequestSchema.safeParse({
      ...request,
      body: { ...request.body, factorId: SHA256 },
    }).success).toBe(false);
    expect(f7DistributionFitRouteRequestSchema.safeParse({
      ...request,
      params: { factorId: SHA256, extra: true },
    }).success).toBe(false);
  });
});

describe("F7 request/result strict wrappers", () => {
  const factorConfirmation = {
    factorCandidateId: SHA256,
    designNominal: 0.2,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
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
    worksheetOptions: WORKSHEET_OPTIONS,
    factors: [],
  } as const;

  it("requires strict worksheetOptions with controlled fields and unique names/indexes", () => {
    const withWorksheetOptions = {
      ...sessionSnapshot,
      worksheetOptions: [
        {
          selectionIndex: 1,
          worksheetName: "Analysis-A",
          toleranceLoopDescription: "Loop A",
          worksheetKind: "analysis",
          source: {
            summarySheet: "Auto Summary",
            summaryRow: 10,
            worksheetAnchor: "Analysis-A!A1",
          },
        },
      ],
    };

    expect(f7SessionSnapshotSchema.safeParse(withWorksheetOptions).success).toBe(true);
    expect(
      f7SessionSnapshotSchema.safeParse({
        ...sessionSnapshot,
        worksheetOptions: undefined,
      }).success,
    ).toBe(false);
    expect(
      f7SessionSnapshotSchema.safeParse({
        ...withWorksheetOptions,
        worksheetOptions: [],
      }).success,
    ).toBe(false);
    expect(
      f7SessionSnapshotSchema.safeParse({
        ...withWorksheetOptions,
        worksheetOptions: [
          withWorksheetOptions.worksheetOptions[0],
          {
            ...withWorksheetOptions.worksheetOptions[0],
            selectionIndex: 2,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      f7SessionSnapshotSchema.safeParse({
        ...withWorksheetOptions,
        worksheetOptions: [
          withWorksheetOptions.worksheetOptions[0],
          {
            ...withWorksheetOptions.worksheetOptions[0],
            worksheetName: "Analysis-B",
          },
        ],
      }).success,
    ).toBe(false);
  });

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
    expect(f7FactorSetupConfirmationSchema.safeParse({ ...factorConfirmation, unit: "mm" }).success).toBe(false);

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
      systemSpecification: {
        lowerSpecLimit: -0.15,
        upperSpecLimit: 0.05,
        targetSigmaLevel: 3,
      },
    };
    expect(f7FactorConfirmRouteRequestSchema.safeParse(factorConfirm).success).toBe(true);
    expect(f7FactorConfirmRouteRequestSchema.safeParse({
      ...factorConfirm,
      systemSpecification: { ...factorConfirm.systemSpecification, upperSpecLimit: -0.2 },
    }).success).toBe(false);
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
      worksheetOptions: WORKSHEET_OPTIONS,
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
            designNominal: 0.2,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
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
            designNominal: 0.2,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            longTermSafetyFactor: 1,
            sigmaLevel: 1,
            distribution: "Normal",
            calculatedMean: 0.2,
            tolerance: 0.1,
            oneSigma: 0.1,
            percentContributionToSigma: 1,
            loopCoefficient: 1,
            physicalMean: 0.2,
            signedContributionMean: 0.2,
            baselineSampler: {
              samplerId: "NORMAL_LOCATION_SCALE_V1",
              physicalMean: 0.2,
              standardDeviation: 0.1,
              support: "REAL",
            },
            lowerSpecLimit: 0.1,
            upperSpecLimit: 0.3,
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

    const withDistributionFit = {
      ...consistentSnapshot,
      factors: [{
        ...consistentSnapshot.factors[0],
        distributionFitResult: DISTRIBUTION_FIT_RESULT,
      }],
    };

    expect(f7SessionSnapshotSchema.safeParse(withDistributionFit).success).toBe(true);
    expect(f7SessionSnapshotSchema.safeParse({
      ...withDistributionFit,
      factors: [{
        ...withDistributionFit.factors[0],
        distributionFitResult: {
          ...DISTRIBUTION_FIT_RESULT,
          factorId: SHA256_2,
        },
      }],
    }).success).toBe(false);
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
        designNominal: 0.2,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
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
        designNominal: 0.2,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        longTermSafetyFactor: 1,
        sigmaLevel: 1,
        distribution: "Normal",
        calculatedMean: 0.2,
        tolerance: 0.1,
        oneSigma: 0.1,
        percentContributionToSigma: 1,
        loopCoefficient: 1,
        physicalMean: 0.2,
        signedContributionMean: 0.2,
        baselineSampler: {
          samplerId: "NORMAL_LOCATION_SCALE_V1",
          physicalMean: 0.2,
          standardDeviation: 0.1,
          support: "REAL",
        },
        lowerSpecLimit: 0.1,
        upperSpecLimit: 0.3,
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
      worksheetOptions: WORKSHEET_OPTIONS,
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

function createMeasurementImportManifestFactor(overrides: Record<string, unknown> = {}) {
  return {
    factorId: SHA256,
    factorName: "Gap A",
    partNumber: "PN-001",
    dimId: "DIM-001",
    unit: "mm",
    designNominal: 12.5,
    upperTolerance: 0.2,
    lowerTolerance: -0.1,
    lowerSpecLimit: 12.4,
    upperSpecLimit: 12.7,
    specificationSource: "Worksheet",
    limitStatus: "VALID",
    coordinates: {
      factorNameCell: "Analysis-A!B12",
      partNumberCell: "Analysis-A!C12",
      dimIdCell: "Analysis-A!D12",
      designNominalCell: "Analysis-A!E12",
      upperToleranceCell: "Analysis-A!F12",
      lowerToleranceCell: "Analysis-A!G12",
      lowerSpecLimitCell: "Analysis-A!H12",
      upperSpecLimitCell: "Analysis-A!I12",
      specificationSourceCell: "Analysis-A!J12",
      limitStatusCell: "Analysis-A!K12",
      measurementStructureCell: "Analysis-A!L12",
      subgroupSizeCell: "Analysis-A!M12",
      estimatorCell: "Analysis-A!N12",
      measurementColumn: "J",
      firstMeasurementCell: "Analysis-A!J20",
    },
    immutableValueDigest: SHA256_2,
    immutableCoordinateDigest: "c".repeat(64),
    ...overrides,
  };
}

function createMeasurementImportManifest(overrides: Record<string, unknown> = {}) {
  const factorA = createMeasurementImportManifestFactor();
  const factorB = createMeasurementImportManifestFactor({
    factorId: SHA256_2,
    factorName: "Gap B",
    partNumber: "PN-002",
    dimId: "DIM-002",
    unit: "mm",
    designNominal: 5.2,
    upperTolerance: 0.2,
    lowerTolerance: -0.1,
    lowerSpecLimit: 5.1,
    upperSpecLimit: 5.4,
    specificationSource: "Derived",
    limitStatus: "CROSSES_ZERO",
    coordinates: {
      factorNameCell: "Analysis-A!B13",
      partNumberCell: "Analysis-A!C13",
      dimIdCell: "Analysis-A!D13",
      designNominalCell: "Analysis-A!E13",
      upperToleranceCell: "Analysis-A!F13",
      lowerToleranceCell: "Analysis-A!G13",
      lowerSpecLimitCell: "Analysis-A!H13",
      upperSpecLimitCell: "Analysis-A!I13",
      specificationSourceCell: "Analysis-A!J13",
      limitStatusCell: "Analysis-A!K13",
      measurementStructureCell: "Analysis-A!L13",
      subgroupSizeCell: "Analysis-A!M13",
      estimatorCell: "Analysis-A!N13",
      measurementColumn: "K",
      firstMeasurementCell: "Analysis-A!K20",
    },
    immutableValueDigest: "d".repeat(64),
    immutableCoordinateDigest: "e".repeat(64),
  });

  return {
    contractId: F7_MEASUREMENT_IMPORT_TEMPLATE_CONTRACT_ID,
    contractVersion: 1,
    templateId: "template-opaque-001",
    workbookContentHash: SHA256,
    worksheetName: "Analysis-A",
    worksheetStableId: "worksheet-stable-001",
    factorSetDigest: "f".repeat(64),
    factorsDigest: "1".repeat(64),
    lockedValueDigest: "2".repeat(64),
    lockedCoordinateDigest: "3".repeat(64),
    factors: [factorA, factorB],
    ...overrides,
  };
}

function createMeasurementImportAuthority(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "session-1",
    sessionStateDigest: "4".repeat(64),
    authorityDigest: "5".repeat(64),
    manifest: createMeasurementImportManifest(),
    ...overrides,
  };
}

function createObservation(row: number, value: number) {
  return {
    disposition: "included" as const,
    value,
    originalRow: row,
  };
}

function createMeasurementDataset(
  factorId: string,
  unit = "mm",
  structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE" = "ORDERED_INDIVIDUALS",
  rationalSubgroupConfig?: { subgroupSize: number; estimator: "RANGE_D2" | "S_C4" },
) {
  const observations = [createObservation(20, 12.51), createObservation(21, 12.49), createObservation(22, 12.5)];
  return {
    factorId,
    unit,
    structure,
    ...(rationalSubgroupConfig === undefined ? {} : { rationalSubgroupConfig }),
    sourceReference: "bulk-import-template",
    importedAt: "2026-09-15T08:00:00.000Z",
    msaStatus: "available",
    observations,
    missingRowCount: 0,
    rejectionSummaries: [],
    originalRowCount: observations.length,
    analyzedCount: observations.length,
    contentHash: "6".repeat(64),
  };
}

function createValidationResult(status: "ready" | "blocked", factorId?: string) {
  return {
    status,
    blockingIssues: status === "blocked"
      ? [{ reason: "sample_count_below_minimum", factorId, rowNumbers: [20, 21] }]
      : [],
    advisoryIssues: status === "ready"
      ? [{ reason: "fit_uncertainty", factorId, rowNumbers: [22] }]
      : [],
    candidateEligibility: {
      normal: "eligible",
      lognormal: "eligible",
      weibull: "eligible",
      gamma: "eligible",
      uniform: "eligible_with_boundary_warning",
    },
  };
}

function createMeasurementImportDiagnostic(overrides: Record<string, unknown> = {}) {
  return {
    reason: "sample_validation_failure",
    factorId: SHA256,
    factorName: "Gap A",
    sheetCell: "Analysis-A!J20",
    rowNumber: 20,
    value: 12.51,
    requiredMinimum: 30,
    displayMessage: "Gap A requires at least 30 valid observations.",
    ...overrides,
  };
}

function createReadyFactorPreview(overrides: Record<string, unknown> = {}) {
  const dataset = createMeasurementDataset(SHA256);
  return {
    factorId: SHA256,
    factorName: "Gap A",
    unit: "mm",
    structure: "ORDERED_INDIVIDUALS",
    sampleCount: dataset.observations.length,
    status: "ready",
    replacesExistingFactor: true,
    diagnostics: [],
    warnings: [createMeasurementImportDiagnostic({ reason: "sample_validation_failure", requiredMinimum: undefined })],
    dataset,
    validation: createValidationResult("ready", SHA256),
    ...overrides,
  };
}

function createBlockedFactorPreview(overrides: Record<string, unknown> = {}) {
  return {
    factorId: SHA256_2,
    factorName: "Gap B",
    unit: "mm",
    structure: "RATIONAL_SUBGROUP",
    rationalSubgroupConfig: { subgroupSize: 3, estimator: "RANGE_D2" },
    sampleCount: 2,
    status: "blocked",
    replacesExistingFactor: false,
    diagnostics: [createMeasurementImportDiagnostic({
      reason: "missing_structure_configuration",
      factorId: SHA256_2,
      factorName: "Gap B",
      sheetCell: "Analysis-A!K20",
      rowNumber: 20,
      value: undefined,
      requiredMinimum: undefined,
      displayMessage: "Gap B subgroup configuration is incomplete.",
    })],
    warnings: [],
    validation: createValidationResult("blocked", SHA256_2),
    ...overrides,
  };
}

describe("F7 bulk measurement import contracts", () => {
  it("accepts a valid two-factor manifest, authority, ready preview, blocked preview, response, stored batch, and commit envelope", () => {
    const manifest = createMeasurementImportManifest();
    expect(f7MeasurementImportFactorManifestSchema.parse(manifest.factors[0])).toEqual(manifest.factors[0]);
    expect(f7MeasurementImportManifestSchema.parse(manifest)).toEqual(manifest);

    const authority = createMeasurementImportAuthority({ manifest });
    expect(f7MeasurementImportAuthoritySchema.parse(authority)).toEqual(authority);

    const ready = createReadyFactorPreview();
    const blocked = createBlockedFactorPreview();
    expect(f7MeasurementImportFactorPreviewSchema.parse(ready)).toEqual(ready);
    expect(f7MeasurementImportFactorPreviewSchema.parse(blocked)).toEqual(blocked);

    const previewRequest = {
      sessionId: "session-1",
      fileName: "BulkImport.xlsx",
      workbookBase64: "QUJDRA==",
    };
    expect(f7MeasurementImportPreviewRequestSchema.parse(previewRequest)).toEqual(previewRequest);

    const response = {
      previewId: "preview-1",
      expiresAt: "2026-09-15T08:15:00.000Z",
      sessionStateDigest: authority.sessionStateDigest,
      factorSetDigest: manifest.factorSetDigest,
      status: "blocked",
      factorCount: 2,
      replacementFactorIds: [SHA256],
      factors: [ready, blocked],
      diagnostics: [
        createMeasurementImportDiagnostic({ reason: "stale_template", factorId: undefined, factorName: undefined, requiredMinimum: undefined }),
        createMeasurementImportDiagnostic({
          reason: "sample_validation_failure",
          factorId: SHA256_2,
          factorName: "Gap B",
          sheetCell: undefined,
          rowNumber: undefined,
          value: undefined,
          requiredMinimum: 30,
          displayMessage: "Gap B is blocked until the minimum sample count is met.",
        }),
      ],
      readyFactorCount: 1,
      blockedFactorCount: 1,
      replacementCount: 1,
      totalSampleCount: 5,
      diagnosticCount: 2,
    };
    const publicResponse = {
      ...response,
      factors: response.factors.map(({ dataset: _dataset, ...factor }) => factor),
    };
    expect(f7MeasurementImportPreviewResponseSchema.parse(publicResponse)).toEqual(publicResponse);
    expect(f7MeasurementImportPreviewResponseSchema.safeParse(response).success).toBe(false);

    const storedBatch = {
      previewId: response.previewId,
      sessionId: authority.sessionId,
      expiresAt: response.expiresAt,
      sessionStateDigest: response.sessionStateDigest,
      factorSetDigest: response.factorSetDigest,
      authority,
      replacementFactorIds: [SHA256],
      factors: [{
        factorId: ready.factorId,
        factorName: ready.factorName,
        unit: ready.unit,
        replacesExistingFactor: true,
        dataset: ready.dataset,
        validation: ready.validation,
      }],
    };
    expect(f7MeasurementImportStoredBatchSchema.parse(storedBatch)).toEqual(storedBatch);

    const commitRequest = {
      sessionId: "session-1",
      previewId: "preview-1",
      replacementFactorIds: [SHA256],
      confirmed: true,
    };
    expect(f7MeasurementImportCommitRequestSchema.parse(commitRequest)).toEqual(commitRequest);
    expect(f7MeasurementImportCommitRouteRequestSchema.parse({ body: commitRequest })).toEqual({ body: commitRequest });
  });

  it("rejects duplicate factors, too many factors, too many observations, and mismatched replacement sets", () => {
    const factor = createMeasurementImportManifestFactor();
    expect(f7MeasurementImportManifestSchema.safeParse(createMeasurementImportManifest({
      factors: [factor, { ...factor, coordinates: { ...factor.coordinates, factorNameCell: "Analysis-A!B13" } }],
    })).success).toBe(false);

    const hundredOneFactors = Array.from({ length: F7_MEASUREMENT_IMPORT_MAX_FACTORS + 1 }, (_, index) =>
      createMeasurementImportManifestFactor({
        factorId: index.toString(16).padStart(64, "0"),
        factorName: `Gap ${index}`,
        dimId: `DIM-${index}`,
        coordinates: {
          factorNameCell: `Analysis-A!B${20 + index}`,
          unitCell: `Analysis-A!C${20 + index}`,
          designNominalCell: `Analysis-A!D${20 + index}`,
          upperToleranceCell: `Analysis-A!E${20 + index}`,
          lowerToleranceCell: `Analysis-A!F${20 + index}`,
          lowerSpecLimitCell: `Analysis-A!G${20 + index}`,
          upperSpecLimitCell: `Analysis-A!H${20 + index}`,
          measurementColumn: "J",
          firstMeasurementCell: `Analysis-A!J${40 + index}`,
        },
        immutableValueDigest: (index + 1).toString(16).padStart(64, "1"),
        immutableCoordinateDigest: (index + 2).toString(16).padStart(64, "2"),
      }),
    );
    expect(f7MeasurementImportManifestSchema.safeParse(createMeasurementImportManifest({
      factors: hundredOneFactors,
    })).success).toBe(false);

    const tooManyObservations = createMeasurementDataset(SHA256);
    tooManyObservations.observations = Array.from({ length: 501 }, (_, index) => createObservation(index + 1, 1 + index));
    tooManyObservations.originalRowCount = 501;
    tooManyObservations.analyzedCount = 501;
    expect(f7MeasurementImportFactorPreviewSchema.safeParse(createReadyFactorPreview({
      sampleCount: 501,
      dataset: tooManyObservations,
    })).success).toBe(false);

    const ready = createReadyFactorPreview();
    const blocked = createBlockedFactorPreview();
    expect(f7MeasurementImportPreviewResponseSchema.safeParse({
      previewId: "preview-1",
      expiresAt: "2026-09-15T08:15:00.000Z",
      sessionStateDigest: "4".repeat(64),
      factorSetDigest: "f".repeat(64),
      status: "blocked",
      factorCount: 2,
      replacementFactorIds: [SHA256_2],
      factors: [ready, blocked],
      diagnostics: [],
      readyFactorCount: 1,
      blockedFactorCount: 1,
      replacementCount: 1,
      totalSampleCount: 5,
      diagnosticCount: 0,
    }).success).toBe(false);

    expect(f7MeasurementImportStoredBatchSchema.safeParse({
      previewId: "preview-1",
      sessionId: "session-1",
      expiresAt: "2026-09-15T08:15:00.000Z",
      sessionStateDigest: "4".repeat(64),
      factorSetDigest: "f".repeat(64),
      authority: createMeasurementImportAuthority(),
      replacementFactorIds: [SHA256_2],
      factors: [{
        factorId: SHA256,
        factorName: "Gap A",
        unit: "mm",
        replacesExistingFactor: true,
        dataset: createMeasurementDataset(SHA256),
        validation: createValidationResult("ready", SHA256),
      }],
    }).success).toBe(false);
  });

  it("rejects unknown fields, non-finite values, invalid structure configuration combinations, and non-literal confirmation", () => {
    expect(f7MeasurementImportDiagnosticSchema.safeParse({
      ...createMeasurementImportDiagnostic(),
      extra: true,
    }).success).toBe(false);
    expect(f7MeasurementImportDiagnosticSchema.safeParse({
      ...createMeasurementImportDiagnostic(),
      value: Number.POSITIVE_INFINITY,
    }).success).toBe(false);
    expect(f7MeasurementImportFactorPreviewSchema.safeParse(createReadyFactorPreview({
      structure: "RATIONAL_SUBGROUP",
      rationalSubgroupConfig: undefined,
    })).success).toBe(false);
    expect(f7MeasurementImportFactorPreviewSchema.safeParse(createReadyFactorPreview({
      structure: "ORDERED_INDIVIDUALS",
      rationalSubgroupConfig: { subgroupSize: 3, estimator: "RANGE_D2" },
    })).success).toBe(false);
    expect(f7MeasurementImportFactorPreviewSchema.safeParse(createReadyFactorPreview({
      dataset: createMeasurementDataset(SHA256, "mm", "RATIONAL_SUBGROUP", { subgroupSize: 4, estimator: "S_C4" }),
      structure: "ORDERED_INDIVIDUALS",
      sampleCount: 3,
    })).success).toBe(false);
    expect(f7MeasurementImportCommitRequestSchema.safeParse({
      sessionId: "session-1",
      previewId: "preview-1",
      replacementFactorIds: [SHA256],
      confirmed: false,
    }).success).toBe(false);
  });

  it("requires import-specific ready blocked validation consistency and factor-scoped issue identities", () => {
    const readyWithBlocking = f7MeasurementImportFactorPreviewSchema.safeParse(createReadyFactorPreview({
      validation: {
        ...createValidationResult("ready", SHA256),
        blockingIssues: [{ reason: "sample_count_below_minimum", factorId: SHA256, rowNumbers: [20, 21] }],
      },
    }));
    expect(readyWithBlocking.success).toBe(false);
    if (!readyWithBlocking.success) {
      expect(readyWithBlocking.error.issues.some((issue) => issue.path.join(".") === "validation.blockingIssues")).toBe(true);
    }

    const blockedWithoutBlocking = f7MeasurementImportFactorPreviewSchema.safeParse(createBlockedFactorPreview({
      validation: {
        ...createValidationResult("blocked", SHA256_2),
        blockingIssues: [],
      },
    }));
    expect(blockedWithoutBlocking.success).toBe(false);
    if (!blockedWithoutBlocking.success) {
      expect(blockedWithoutBlocking.error.issues.some((issue) => issue.path.join(".") === "validation.blockingIssues")).toBe(true);
    }

    const previewIssueFactorMismatch = f7MeasurementImportFactorPreviewSchema.safeParse(createReadyFactorPreview({
      validation: {
        ...createValidationResult("ready", SHA256),
        advisoryIssues: [{ reason: "fit_uncertainty", factorId: SHA256_2, rowNumbers: [22] }],
      },
    }));
    expect(previewIssueFactorMismatch.success).toBe(false);
    if (!previewIssueFactorMismatch.success) {
      expect(previewIssueFactorMismatch.error.issues.some((issue) => issue.path.join(".") === "validation.advisoryIssues.0.factorId")).toBe(true);
    }

    const storedReadyWithBlocking = f7MeasurementImportStoredBatchSchema.safeParse({
      previewId: "preview-1",
      sessionId: "session-1",
      expiresAt: "2026-09-15T08:15:00.000Z",
      sessionStateDigest: "4".repeat(64),
      factorSetDigest: "f".repeat(64),
      authority: createMeasurementImportAuthority(),
      replacementFactorIds: [SHA256],
      factors: [{
        factorId: SHA256,
        factorName: "Gap A",
        unit: "mm",
        replacesExistingFactor: true,
        dataset: createMeasurementDataset(SHA256),
        validation: {
          ...createValidationResult("ready", SHA256),
          blockingIssues: [{ reason: "sample_count_below_minimum", factorId: SHA256, rowNumbers: [20, 21] }],
        },
      }],
    });
    expect(storedReadyWithBlocking.success).toBe(false);
    if (!storedReadyWithBlocking.success) {
      expect(storedReadyWithBlocking.error.issues.some((issue) => issue.path.join(".") === "factors.0.validation.blockingIssues")).toBe(true);
    }

    const storedIssueFactorMismatch = f7MeasurementImportStoredBatchSchema.safeParse({
      previewId: "preview-1",
      sessionId: "session-1",
      expiresAt: "2026-09-15T08:15:00.000Z",
      sessionStateDigest: "4".repeat(64),
      factorSetDigest: "f".repeat(64),
      authority: createMeasurementImportAuthority(),
      replacementFactorIds: [SHA256],
      factors: [{
        factorId: SHA256,
        factorName: "Gap A",
        unit: "mm",
        replacesExistingFactor: true,
        dataset: createMeasurementDataset(SHA256),
        validation: {
          ...createValidationResult("ready", SHA256),
          advisoryIssues: [{ reason: "fit_uncertainty", factorId: SHA256_2, rowNumbers: [22] }],
        },
      }],
    });
    expect(storedIssueFactorMismatch.success).toBe(false);
    if (!storedIssueFactorMismatch.success) {
      expect(storedIssueFactorMismatch.error.issues.some((issue) => issue.path.join(".") === "factors.0.validation.advisoryIssues.0.factorId")).toBe(true);
    }
  });

  it("requires stored batch factors to match manifest membership and identity fields", () => {
    const absentManifestFactor = f7MeasurementImportStoredBatchSchema.safeParse({
      previewId: "preview-1",
      sessionId: "session-1",
      expiresAt: "2026-09-15T08:15:00.000Z",
      sessionStateDigest: "4".repeat(64),
      factorSetDigest: "f".repeat(64),
      authority: createMeasurementImportAuthority(),
      replacementFactorIds: [SHA256],
      factors: [{
        factorId: "c".repeat(64),
        factorName: "Gap C",
        unit: "mm",
        replacesExistingFactor: true,
        dataset: createMeasurementDataset("c".repeat(64)),
        validation: createValidationResult("ready", "c".repeat(64)),
      }],
    });
    expect(absentManifestFactor.success).toBe(false);
    if (!absentManifestFactor.success) {
      expect(absentManifestFactor.error.issues.some((issue) => issue.path.join(".") === "factors.0.factorId")).toBe(true);
    }

    const mismatchedFactorName = f7MeasurementImportStoredBatchSchema.safeParse({
      previewId: "preview-1",
      sessionId: "session-1",
      expiresAt: "2026-09-15T08:15:00.000Z",
      sessionStateDigest: "4".repeat(64),
      factorSetDigest: "f".repeat(64),
      authority: createMeasurementImportAuthority(),
      replacementFactorIds: [SHA256],
      factors: [{
        factorId: SHA256,
        factorName: "Wrong Gap A",
        unit: "mm",
        replacesExistingFactor: true,
        dataset: createMeasurementDataset(SHA256),
        validation: createValidationResult("ready", SHA256),
      }],
    });
    expect(mismatchedFactorName.success).toBe(false);
    if (!mismatchedFactorName.success) {
      expect(mismatchedFactorName.error.issues.some((issue) => issue.path.join(".") === "factors.0.factorName")).toBe(true);
    }

    const mismatchedUnit = f7MeasurementImportStoredBatchSchema.safeParse({
      previewId: "preview-1",
      sessionId: "session-1",
      expiresAt: "2026-09-15T08:15:00.000Z",
      sessionStateDigest: "4".repeat(64),
      factorSetDigest: "f".repeat(64),
      authority: createMeasurementImportAuthority(),
      replacementFactorIds: [SHA256],
      factors: [{
        factorId: SHA256,
        factorName: "Gap A",
        unit: "inch",
        replacesExistingFactor: true,
        dataset: createMeasurementDataset(SHA256, "inch"),
        validation: createValidationResult("ready", SHA256),
      }],
    });
    expect(mismatchedUnit.success).toBe(false);
    if (!mismatchedUnit.success) {
      expect(mismatchedUnit.error.issues.some((issue) => issue.path.join(".") === "factors.0.unit")).toBe(true);
    }
  });

  it("requires canonical base64, hardened xlsx filenames, and unique commit replacement ids", () => {
    expect(f7MeasurementImportPreviewRequestSchema.safeParse({
      sessionId: "session-1",
      fileName: "正常導入.xlsx",
      workbookBase64: "AA==",
    }).success).toBe(true);
    expect(f7MeasurementImportPreviewRequestSchema.safeParse({
      sessionId: "session-1",
      fileName: "normal report.xlsx",
      workbookBase64: "AAA=",
    }).success).toBe(true);

    for (const workbookBase64 of ["AB==", "AC==", "AAB=", "AAC="]) {
      expect(f7MeasurementImportPreviewRequestSchema.safeParse({
        sessionId: "session-1",
        fileName: "BulkImport.xlsx",
        workbookBase64,
      }).success).toBe(false);
    }

    for (const fileName of ["folder/report.xlsx", "folder\\report.xlsx", ".xlsx", "bad\u0000name.xlsx"]) {
      expect(f7MeasurementImportPreviewRequestSchema.safeParse({
        sessionId: "session-1",
        fileName,
        workbookBase64: "QUJDRA==",
      }).success).toBe(false);
    }

    const duplicateReplacementIds = f7MeasurementImportCommitRequestSchema.safeParse({
      sessionId: "session-1",
      previewId: "preview-1",
      replacementFactorIds: [SHA256, SHA256],
      confirmed: true,
    });
    expect(duplicateReplacementIds.success).toBe(false);
    if (!duplicateReplacementIds.success) {
      expect(duplicateReplacementIds.error.issues.some((issue) => issue.path.join(".") === "replacementFactorIds")).toBe(true);
    }
  });

  it("bounds diagnostics and enforces exact aggregate counts", () => {
    const ready = createReadyFactorPreview();
    const diagnostics = Array.from({ length: F7_MEASUREMENT_IMPORT_MAX_DIAGNOSTICS + 1 }, (_, index) =>
      createMeasurementImportDiagnostic({
        factorId: index % 2 === 0 ? SHA256 : SHA256_2,
        factorName: index % 2 === 0 ? "Gap A" : "Gap B",
        rowNumber: index + 1,
        sheetCell: `Analysis-A!J${index + 1}`,
        displayMessage: `Diagnostic ${index + 1}`,
      }),
    );
    expect(f7MeasurementImportPreviewResponseSchema.safeParse({
      previewId: "preview-1",
      expiresAt: "2026-09-15T08:15:00.000Z",
      sessionStateDigest: "4".repeat(64),
      factorSetDigest: "f".repeat(64),
      status: "ready",
      factorCount: 1,
      replacementFactorIds: [SHA256],
      factors: [ready],
      diagnostics,
      readyFactorCount: 1,
      blockedFactorCount: 0,
      replacementCount: 1,
      totalSampleCount: ready.sampleCount,
      diagnosticCount: diagnostics.length,
    }).success).toBe(false);

    expect(f7MeasurementImportPreviewResponseSchema.safeParse({
      previewId: "preview-1",
      expiresAt: "2026-09-15T08:15:00.000Z",
      sessionStateDigest: "4".repeat(64),
      factorSetDigest: "f".repeat(64),
      status: "ready",
      factorCount: 2,
      replacementFactorIds: [SHA256],
      factors: [ready],
      diagnostics: [],
      readyFactorCount: 1,
      blockedFactorCount: 0,
      replacementCount: 1,
      totalSampleCount: ready.sampleCount,
      diagnosticCount: 0,
    }).success).toBe(false);
    expect(f7MeasurementImportPreviewResponseSchema.safeParse({
      previewId: "preview-1",
      expiresAt: "2026-09-15T08:15:00.000Z",
      sessionStateDigest: "4".repeat(64),
      factorSetDigest: "f".repeat(64),
      status: "blocked",
      factorCount: 1,
      replacementFactorIds: [SHA256],
      factors: [ready],
      diagnostics: [],
      readyFactorCount: 1,
      blockedFactorCount: 0,
      replacementCount: 1,
      totalSampleCount: ready.sampleCount,
      diagnosticCount: 0,
    }).success).toBe(false);
  });
});