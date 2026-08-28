import { describe, expect, it } from "vitest";
import {
  f7ReportProjectionSchema,
  f7SessionSnapshotSchema,
  type F7SessionSnapshot,
} from "@ai-assist/contracts";
import { createF7ReportProjection } from "./f7-report.js";

const WORKBOOK_HASH = "a".repeat(64);
const BASELINE_FACTOR_ID = "b".repeat(64);
const MEASURED_FACTOR_ID = "c".repeat(64);
const BASELINE_CANDIDATE_ID = "d".repeat(64);
const MEASURED_CANDIDATE_ID = "e".repeat(64);
const DATASET_HASH = "f".repeat(64);
const RUN_SEED = "1".repeat(64);
const BOOTSTRAP_SEED = "2".repeat(64);
const BOOTSTRAP_STREAM_DIGEST = "3".repeat(64);
const GENERATED_AT = "2026-08-25T08:00:00.000Z";
const UNSAFE_MARKDOWN_PAYLOAD = "<script>alert(1)</script> | line\n[link](url) ![image](url) **bold** `code` # heading _em_ ~~strike~~";
const WORKBOOK_FILE_NAME = `report ${UNSAFE_MARKDOWN_PAYLOAD}.xlsx`;
const WORKSHEET_NAME = `Analysis ${UNSAFE_MARKDOWN_PAYLOAD}`;
const MEASURED_FACTOR_NAME = `Measured ${UNSAFE_MARKDOWN_PAYLOAD}`;
const MEASUREMENT_SOURCE = `clipboard ${UNSAFE_MARKDOWN_PAYLOAD}`;

function wilsonScoreInterval(successes: number, trials: number): { lower: number; upper: number } {
  const z = 1.959963984540054;
  const zSquared = z * z;
  const proportion = successes / trials;
  const denominator = 1 + zSquared / trials;
  const center = (proportion + zSquared / (2 * trials)) / denominator;
  const margin = (z / denominator)
    * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * trials)) / trials);
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

function createCandidate(options: {
  factorCandidateId: string;
  factorName: string;
  sourceRow: number;
  designNominal: number;
  standardDeviation: number;
}) {
  const lowerTolerance = -0.2;
  const upperTolerance = 0.2;
  const lowerEndpoint = options.designNominal + lowerTolerance;
  const upperEndpoint = options.designNominal + upperTolerance;
  return {
    workbookContentHash: WORKBOOK_HASH,
    worksheetName: WORKSHEET_NAME,
    tableId: "factor-table",
    sourceRow: options.sourceRow,
    sourceCells: {
      factorName: `Analysis-A!G${options.sourceRow}`,
      mean: `Analysis-A!R${options.sourceRow}`,
    },
    factorCandidateId: options.factorCandidateId,
    factorName: options.factorName,
    workbookUnitEvidence: "mm",
    excelSignedMean: options.designNominal,
    designNominal: options.designNominal,
    upperTolerance,
    lowerTolerance,
    standardDeviation: options.standardDeviation,
    distribution: "Normal" as const,
    lowerSpecLimit: Math.min(lowerEndpoint, upperEndpoint),
    upperSpecLimit: Math.max(lowerEndpoint, upperEndpoint),
  };
}

function createEvidence(options: {
  factorCandidateId: string;
  factorId: string;
  factorName: string;
  sourceRow: number;
  designNominal: number;
  standardDeviation: number;
}) {
  const lowerTolerance = -0.2;
  const upperTolerance = 0.2;
  const physicalEndpoints = [
    Math.abs(options.designNominal + lowerTolerance),
    Math.abs(options.designNominal + upperTolerance),
  ];
  const physicalMean = Math.abs(options.designNominal);
  return {
    workbookContentHash: WORKBOOK_HASH,
    worksheetName: WORKSHEET_NAME,
    tableId: "factor-table",
    sourceRow: options.sourceRow,
    sourceCells: {
      factorName: `Analysis-A!G${options.sourceRow}`,
      mean: `Analysis-A!R${options.sourceRow}`,
    },
    factorCandidateId: options.factorCandidateId,
    factorId: options.factorId,
    factorName: options.factorName,
    unit: "mm",
    unitSource: "workbook" as const,
    designNominal: options.designNominal,
    upperTolerance,
    lowerTolerance,
    longTermSafetyFactor: 1,
    sigmaLevel: 3,
    distribution: "Normal" as const,
    calculatedMean: options.designNominal,
    tolerance: upperTolerance - lowerTolerance,
    oneSigma: options.standardDeviation,
    percentContributionToSigma: 1,
    loopCoefficient: Math.sign(options.designNominal) as -1 | 1,
    physicalMean,
    signedContributionMean: options.designNominal,
    baselineSampler: {
      samplerId: "NORMAL_LOCATION_SCALE_V1" as const,
      physicalMean,
      standardDeviation: options.standardDeviation,
      support: "REAL" as const,
    },
    lowerSpecLimit: Math.min(...physicalEndpoints),
    upperSpecLimit: Math.max(...physicalEndpoints),
  };
}

function createDistributionFitResult() {
  const replicates = 10_000;
  const extremeReplicateCount = 4_200;
  const confidenceInterval = wilsonScoreInterval(extremeReplicateCount, replicates);
  const parameterCount = 2;
  const sampleSize = 32;
  const logLikelihood = 35.2;
  const aic = parameterCount * 2 - logLikelihood * 2;
  const aicc = aic + (2 * parameterCount * (parameterCount + 1))
    / (sampleSize - parameterCount - 1);
  const bic = parameterCount * Math.log(sampleSize) - logLikelihood * 2;
  return {
    factorId: MEASURED_FACTOR_ID,
    sampleSize,
    characteristicKind: "other" as const,
    candidates: [{
      family: "normal" as const,
      modelSpecification: "normal_location_scale" as const,
      parameterCount,
      parameters: { mean: 1.25, standardDeviation: 0.08 },
      logLikelihood,
      aic,
      aicc,
      bic,
      deltaAicc: 0,
      deltaBic: 0,
      ks: 0.08,
      ad: 0.31,
      qqPoints: [
        { observed: 1.1, theoretical: 1.08 },
        { observed: 1.4, theoretical: 1.42 },
      ],
      bootstrap: {
        statisticId: "anderson_darling" as const,
        observedStatistic: 0.31,
        comparisonDirection: "greater_than_or_equal" as const,
        refitEachReplicate: true as const,
        extremeReplicateCount,
        confidenceInterval: {
          level: 0.95 as const,
          method: "wilson_score" as const,
          ...confidenceInterval,
        },
        pValue: (extremeReplicateCount + 1) / (replicates + 1),
        replicates: 10_000 as const,
        seed: BOOTSTRAP_SEED,
        methodId: "F7_BOOTSTRAP_V2" as const,
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1" as const,
        streamDigest: BOOTSTRAP_STREAM_DIGEST,
        status: "acceptable" as const,
      },
      warnings: [],
    }],
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
      methodId: "F7_MODEL_SELECTION_V1" as const,
      status: "unique_preference" as const,
      numericBestFamily: "normal" as const,
      competitiveFamilies: ["normal" as const],
      proposedFinalFamily: "normal" as const,
      confidence: "moderate" as const,
      reasonCodes: ["SINGLE_ACCEPTABLE_COMPETITOR" as const, "SMALL_SAMPLE_UNCERTAINTY" as const],
    },
  };
}

function createMonteCarloResult(
  assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE",
  specificationOverrides: Partial<{
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
  }> = {},
) {
  const standardDeviation = assessment === "NOT_EVALUABLE" ? 0 : 0.1;
  const lowerSpecLimit = specificationOverrides.lowerSpecLimit ?? -0.5;
  const upperSpecLimit = specificationOverrides.upperSpecLimit ?? 0.5;
  const targetSigmaLevel = specificationOverrides.targetSigmaLevel
    ?? (assessment === "MEETS_TARGET" ? 3 : 6);
  const targetCpk = targetSigmaLevel / 3;
  const histogramBins = Array.from({ length: 20 }, (_, index) => ({
    minimum: index - 10,
    maximum: index - 9,
    observedCount: index === 10 ? 10_000 : 0,
  }));
  const cp = standardDeviation === 0
    ? undefined
    : (upperSpecLimit - lowerSpecLimit) / (6 * standardDeviation);
  const lowerCpk = standardDeviation === 0 ? undefined : (0 - lowerSpecLimit) / (3 * standardDeviation);
  const upperCpk = standardDeviation === 0 ? undefined : (upperSpecLimit - 0) / (3 * standardDeviation);
  const cpk = lowerCpk === undefined || upperCpk === undefined
    ? undefined
    : Math.min(lowerCpk, upperCpk);
  return {
    methodId: "F7_MONTE_CARLO_V1" as const,
    status: "complete" as const,
    lowerSpecLimit,
    upperSpecLimit,
    targetSigmaLevel,
    iterations: 10_000 as const,
    runSeed: RUN_SEED,
    correlationMode: "INDEPENDENT" as const,
    mean: 0,
    standardDeviation,
    quantiles: standardDeviation === 0
      ? { p00135: 0, p01: 0, p05: 0, p50: 0, p95: 0, p99: 0, p99865: 0 }
      : { p00135: -0.3, p01: -0.23, p05: -0.16, p50: 0, p95: 0.16, p99: 0.23, p99865: 0.3 },
    inSpecCount: 10_000,
    outOfSpecCount: 0,
    yield: 1,
    outOfSpecProbability: 0,
    ppm: 0,
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
    capability: standardDeviation === 0
      ? { status: "not_available" as const, reason: "zero_variance" as const, targetCpk }
      : {
          status: "available" as const,
          cp: cp!,
          lowerCpk: lowerCpk!,
          upperCpk: upperCpk!,
          cpk: cpk!,
          targetCpk,
          targetStatus: cpk! >= targetCpk ? "meets_target" as const : "below_target" as const,
        },
    normalModel: standardDeviation === 0
      ? { status: "not_available" as const, reason: "zero_variance" as const }
      : {
          status: "available" as const,
          lowerTailDpm: 0,
          upperTailDpm: 0,
          totalDpm: 0,
          expectedYield: 1,
        },
    factorManifest: [
      { factorId: BASELINE_FACTOR_ID, family: "normal" as const, sourceMode: "BASELINE_ASSUMPTION" as const },
      { factorId: MEASURED_FACTOR_ID, family: "normal" as const, sourceMode: "MEASURED" as const },
    ],
  };
}

function createSnapshot(
  assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE" = "MEETS_TARGET",
  options: {
    specificationOverrides?: Partial<{
      lowerSpecLimit: number;
      upperSpecLimit: number;
      targetSigmaLevel: number;
    }>;
    withoutSystemSpecification?: boolean;
  } = {},
): F7SessionSnapshot {
  const baselineCandidate = createCandidate({
    factorCandidateId: BASELINE_CANDIDATE_ID,
    factorName: "Baseline frame",
    sourceRow: 14,
    designNominal: -1,
    standardDeviation: 0.1,
  });
  const measuredCandidate = createCandidate({
    factorCandidateId: MEASURED_CANDIDATE_ID,
    factorName: MEASURED_FACTOR_NAME,
    sourceRow: 15,
    designNominal: 1.25,
    standardDeviation: 0.08,
  });
  const baselineEvidence = createEvidence({
    factorCandidateId: BASELINE_CANDIDATE_ID,
    factorId: BASELINE_FACTOR_ID,
    factorName: "Baseline frame",
    sourceRow: 14,
    designNominal: -1,
    standardDeviation: 0.1,
  });
  const measuredEvidence = createEvidence({
    factorCandidateId: MEASURED_CANDIDATE_ID,
    factorId: MEASURED_FACTOR_ID,
    factorName: MEASURED_FACTOR_NAME,
    sourceRow: 15,
    designNominal: 1.25,
    standardDeviation: 0.08,
  });
  const snapshot = {
    contractId: "f7-analysis-result-v1" as const,
    outputClassification: "confidential" as const,
    sessionId: "session-report-1",
    status: "phase_1_ready" as const,
    workbook: {
      fileName: WORKBOOK_FILE_NAME,
      workbookContentHash: WORKBOOK_HASH,
    },
    selectedWorksheetNames: [WORKSHEET_NAME],
    worksheetOptions: [{
      selectionIndex: 1,
      worksheetName: WORKSHEET_NAME,
      toleranceLoopDescription: "Main loop",
      worksheetKind: "analysis" as const,
      source: {
        summarySheet: "Auto Summary" as const,
        summaryRow: 10,
        worksheetAnchor: "Analysis-A!A1",
      },
    }],
    ...(!options.withoutSystemSpecification ? { systemSpecification: {
      status: "available" as const,
      lowerSpecLimit: {
        status: "available" as const,
        actualValue: -0.5,
        displayValue: "-0.5",
        sourceLabel: "Lower specification limit",
        sourceCell: "Analysis-A!B2",
        valueOrigin: "numeric_literal" as const,
      },
      upperSpecLimit: {
        status: "available" as const,
        actualValue: 0.5,
        displayValue: "0.5",
        sourceLabel: "Upper specification limit",
        sourceCell: "Analysis-A!B3",
        valueOrigin: "numeric_literal" as const,
      },
      targetSigmaLevel: {
        status: "available" as const,
        actualValue: assessment === "MEETS_TARGET" ? 3 : 6,
        displayValue: assessment === "MEETS_TARGET" ? "3" : "6",
        sourceLabel: "Target sigma level",
        sourceCell: "Analysis-A!B4",
        valueOrigin: "numeric_literal" as const,
      },
      additionalMeanShift: {
        status: "available" as const,
        actualValue: 0,
        displayValue: "0",
        sourceLabel: "Additional mean shift",
        sourceCell: "Analysis-A!B5",
        valueOrigin: "numeric_literal" as const,
      },
    } } : {}),
    factors: [
      {
        factorCandidate: baselineCandidate,
        setup: {
          factorCandidateId: BASELINE_CANDIDATE_ID,
          designNominal: -1,
          upperTolerance: 0.2,
          lowerTolerance: -0.2,
          confirmed: true as const,
        },
        sourceMode: "BASELINE_ASSUMPTION" as const,
        input: {
          mode: "BASELINE_ASSUMPTION" as const,
          baselineSampler: baselineEvidence.baselineSampler,
        },
        evidence: baselineEvidence,
      },
      {
        factorCandidate: measuredCandidate,
        setup: {
          factorCandidateId: MEASURED_CANDIDATE_ID,
          designNominal: 1.25,
          upperTolerance: 0.2,
          lowerTolerance: -0.2,
          confirmed: true as const,
        },
        sourceMode: "MEASURED" as const,
        input: {
          mode: "MEASURED" as const,
          dataset: {
            factorId: MEASURED_FACTOR_ID,
            unit: "mm",
            structure: "UNORDERED_SAMPLE" as const,
            sourceReference: MEASUREMENT_SOURCE,
            importedAt: "2026-08-24T08:00:00.000Z",
            msaStatus: "available" as const,
            observations: [
              { value: 1.2, originalRow: 1, disposition: "included" as const },
              { value: 1.3, originalRow: 2, disposition: "included" as const },
            ],
            missingRowCount: 0,
            rejectionSummaries: [],
            originalRowCount: 2,
            analyzedCount: 2,
            contentHash: DATASET_HASH,
          },
        },
        evidence: measuredEvidence,
        distributionFitResult: createDistributionFitResult(),
        distributionApproval: {
          factorId: MEASURED_FACTOR_ID,
          family: "normal" as const,
          confirmed: true as const,
          approvedAt: "2026-08-24T09:00:00.000Z",
        },
      },
    ],
    monteCarloResult: createMonteCarloResult(assessment, options.specificationOverrides),
  };
  return f7SessionSnapshotSchema.parse(snapshot);
}

describe("createF7ReportProjection", () => {
  it.each([
    ["MEETS_TARGET", "meets_target"],
    ["BELOW_TARGET", "below_target"],
    ["NOT_EVALUABLE", "not_available"],
  ] as const)("maps capability to %s without trusting report input", (assessment, capabilityState) => {
    const report = createF7ReportProjection(createSnapshot(assessment), GENERATED_AT);

    expect(report.assessment).toBe(assessment);
    expect(report.simulation.capability.status === "available"
      ? report.simulation.capability.targetStatus
      : report.simulation.capability.status).toBe(capabilityState);
    expect(f7ReportProjectionSchema.parse(report)).toEqual(report);
  });

  it("projects governed workbook, metrics, factor provenance, and evidence fields", () => {
    const snapshot = createSnapshot();
    const report = createF7ReportProjection(snapshot, GENERATED_AT);

    expect(report).toMatchObject({
      contractId: "f7-report-v1",
      outputClassification: "confidential",
      sessionId: snapshot.sessionId,
      generatedAt: GENERATED_AT,
      workbook: {
        fileName: WORKBOOK_FILE_NAME,
        workbookContentHash: WORKBOOK_HASH,
        worksheetName: WORKSHEET_NAME,
      },
      summary: {
        mean: snapshot.monteCarloResult?.mean,
        standardDeviation: snapshot.monteCarloResult?.standardDeviation,
        yield: snapshot.monteCarloResult?.yield,
        ppm: snapshot.monteCarloResult?.ppm,
        lowerSpecLimit: -0.5,
        upperSpecLimit: 0.5,
        targetSigmaLevel: 3,
        targetCpk: 1,
      },
      evidence: {
        workbookContentHash: WORKBOOK_HASH,
        worksheetName: WORKSHEET_NAME,
        specificationSourceCells: {
          lowerSpecLimit: "Analysis-A!B2",
          upperSpecLimit: "Analysis-A!B3",
          targetSigmaLevel: "Analysis-A!B4",
        },
        specificationInputOrigins: {
          lowerSpecLimit: "excel_source",
          upperSpecLimit: "excel_source",
          targetSigmaLevel: "excel_source",
        },
        methodIds: {
          simulation: "F7_MONTE_CARLO_V1",
          histogram: "F7_HISTOGRAM_FD_V1",
          normalFit: "F7_NORMAL_MOMENT_FIT_V1",
        },
        seed: RUN_SEED,
        iterations: 10_000,
        factorManifest: snapshot.monteCarloResult?.factorManifest,
      },
    });
    expect(report.factors).toEqual([
      {
        factorId: BASELINE_FACTOR_ID,
        factorName: "Baseline frame",
        loopCoefficient: -1,
        sourceMode: "BASELINE_ASSUMPTION",
        approvedDistribution: "normal",
        sourceReferences: ["Analysis-A!G14", "Analysis-A!R14"],
      },
      {
        factorId: MEASURED_FACTOR_ID,
        factorName: MEASURED_FACTOR_NAME,
        loopCoefficient: 1,
        sourceMode: "MEASURED",
        approvedDistribution: "normal",
        sourceReferences: ["Analysis-A!G15", "Analysis-A!R15", MEASUREMENT_SOURCE],
      },
    ]);
  });

  it("deduplicates repeated factor source references while preserving source order", () => {
    const snapshot = createSnapshot();
    const sourceCells = snapshot.factors[0]?.evidence?.sourceCells as Record<string, string>;
    sourceCells.designNominal = sourceCells.mean!;

    const report = createF7ReportProjection(snapshot, GENERATED_AT);

    expect(report.factors[0]?.sourceReferences).toEqual([
      "Analysis-A!G14",
      "Analysis-A!R14",
    ]);
  });

  it.each([
    ["lowerSpecLimit", -0.6],
    ["upperSpecLimit", 0.6],
    ["targetSigmaLevel", 4],
  ] as const)("records a manual override for %s without claiming its Excel source cell", (field, value) => {
    const report = createF7ReportProjection(createSnapshot("MEETS_TARGET", {
      specificationOverrides: { [field]: value },
    }), GENERATED_AT);

    expect(report.evidence.specificationInputOrigins[field]).toBe("manual_override");
    expect(report.evidence.specificationSourceCells[field]).toBeUndefined();
    expect(report.markdown).toContain(`| ${field} | manual_override | Not applicable |`);
  });

  it("records a same-value available specification without a source cell as manual entry", () => {
    const snapshot = createSnapshot();
    delete snapshot.systemSpecification?.lowerSpecLimit.sourceCell;

    const report = createF7ReportProjection(snapshot, GENERATED_AT);

    expect(report.evidence.specificationInputOrigins.lowerSpecLimit).toBe("manual_entry");
    expect(report.evidence.specificationSourceCells.lowerSpecLimit).toBeUndefined();
    expect(report.markdown).toContain("| lowerSpecLimit | manual_entry | Not applicable |");
  });

  it("records manual entry for every simulation specification when workbook specifications are unavailable", () => {
    const report = createF7ReportProjection(createSnapshot("MEETS_TARGET", {
      withoutSystemSpecification: true,
    }), GENERATED_AT);

    expect(report.evidence.specificationInputOrigins).toEqual({
      lowerSpecLimit: "manual_entry",
      upperSpecLimit: "manual_entry",
      targetSigmaLevel: "manual_entry",
    });
    expect(report.evidence.specificationSourceCells).toEqual({});
    expect(report.markdown).toContain("| lowerSpecLimit | manual_entry | Not applicable |");
    expect(report.markdown).toContain("| upperSpecLimit | manual_entry | Not applicable |");
    expect(report.markdown).toContain("| targetSigmaLevel | manual_entry | Not applicable |");
  });

  it("renders one ordered Markdown view with the disclaimer and reproducibility evidence", () => {
    const report = createF7ReportProjection(createSnapshot(), GENERATED_AT);
    const headings = [
      "## Assessment",
      "## Key Metrics",
      "## Monte Carlo Distribution",
      "## Monte Carlo Summary",
      "## Factor Models",
      "## Evidence Chain",
    ];
    const offsets = headings.map((heading) => report.markdown.indexOf(heading));

    expect(offsets.every((offset) => offset >= 0)).toBe(true);
    for (let index = 1; index < offsets.length; index += 1) {
      expect(offsets[index]).toBeGreaterThan(offsets[index - 1]!);
    }
    expect(report.markdown).toContain("not a design or production release decision");
    expect(report.markdown).toContain(WORKBOOK_HASH);
    expect(report.markdown).toContain(RUN_SEED);
    expect(report.markdown).toContain("F7_MONTE_CARLO_V1");
    expect(report.markdown).toContain("| Histogram method | F7_HISTOGRAM_FD_V1 |");
    expect(report.markdown).toContain("| Histogram bin count | 20 |");
    expect(report.markdown).toContain("| Normal fit method | F7_NORMAL_MOMENT_FIT_V1 |");
  });

  it("escapes HTML and Markdown structures from worksheet, factor, and source text", () => {
    const markdown = createF7ReportProjection(createSnapshot(), GENERATED_AT).markdown;

    expect(markdown).not.toContain(WORKSHEET_NAME);
    expect(markdown).not.toContain("<script>");
    expect(markdown).not.toContain(MEASURED_FACTOR_NAME);
    expect(markdown).not.toContain(MEASUREMENT_SOURCE);
    expect(markdown).not.toContain(UNSAFE_MARKDOWN_PAYLOAD);
    expect(markdown).not.toContain("[link](url)");
    expect(markdown).not.toContain("![image](url)");
    expect(markdown).not.toContain("**bold**");
    expect(markdown).not.toContain("`code`");
    expect(markdown).not.toContain("_em_");
    expect(markdown).not.toContain("~~strike~~");
    expect(markdown).toContain("&lt;script&gt;");
    expect(markdown).toContain("\\|");
    expect(markdown).toContain("<br>");
    expect(markdown).toContain("\\[link\\]\\(url\\)");
    expect(markdown).toContain("\\!\\[image\\]\\(url\\)");
    expect(markdown).toContain("\\*\\*bold\\*\\*");
    expect(markdown).toContain("\\`code\\`");
    expect(markdown).toContain("\\# heading");
    expect(markdown).toContain("\\_em\\_");
    expect(markdown).toContain("\\~\\~strike\\~\\~");
  });

  it("is deeply deterministic for the same snapshot and generatedAt", () => {
    const snapshot = createSnapshot();

    expect(createF7ReportProjection(snapshot, GENERATED_AT)).toEqual(
      createF7ReportProjection(snapshot, GENERATED_AT),
    );
  });

  it.each([
    ["factorId", { factorId: "9".repeat(64) }],
    ["sourceMode", { sourceMode: "MEASURED" as const }],
    ["family", { family: "gamma" as const }],
  ] as const)("rejects a stale simulation manifest with mismatched %s", (_field, replacement) => {
    const snapshot = createSnapshot();
    const monteCarloResult = snapshot.monteCarloResult!;
    const staleSnapshot = {
      ...snapshot,
      monteCarloResult: {
        ...monteCarloResult,
        factorManifest: [
          { ...monteCarloResult.factorManifest[0]!, ...replacement },
          monteCarloResult.factorManifest[1]!,
        ],
      },
    } as F7SessionSnapshot;

    expect(() => createF7ReportProjection(staleSnapshot, GENERATED_AT)).toThrow(
      expect.objectContaining({
        name: "F7ReportPrerequisiteError",
        code: "F7_REPORT_PREREQUISITE_MISMATCH",
        message: expect.stringMatching(/manifest/i),
      }),
    );
  });

  it("rejects a snapshot without a Monte Carlo result", () => {
    const snapshot = createSnapshot();
    const withoutSimulation = { ...snapshot, monteCarloResult: undefined };

    expect(() => createF7ReportProjection(withoutSimulation, GENERATED_AT)).toThrow(
      expect.objectContaining({
        name: "F7ReportPrerequisiteError",
        code: "F7_REPORT_PREREQUISITE_MISMATCH",
        message: expect.stringMatching(/monte carlo/i),
      }),
    );
  });
});