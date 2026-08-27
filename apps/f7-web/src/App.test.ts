import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import App from "./App.vue";
import DimensionChainPanel from "./components/DimensionChainPanel.vue";
import type {
  F7Client,
  F7DistributionFitCandidate,
  F7FactorState,
  F7MeasurementDataset,
  F7ReportProjection,
  F7SessionSnapshot,
} from "./api/f7-client";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function wilsonScoreInterval(successes: number): { lower: number; upper: number } {
  const trials = 10000;
  const z = 1.959963984540054;
  const zSquared = z * z;
  const proportion = successes / trials;
  const denominator = 1 + zSquared / trials;
  const center = (proportion + zSquared / (2 * trials)) / denominator;
  const margin = (z / denominator)
    * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * trials)) / trials);
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}

function fitCandidate(options: {
  family: F7DistributionFitCandidate["family"];
  modelSpecification: F7DistributionFitCandidate["modelSpecification"];
  parameters: Readonly<Record<string, number>>;
  logLikelihood: number;
  ad: number;
  extremeReplicateCount: number;
  warnings?: readonly string[];
}): F7DistributionFitCandidate {
  const parameterCount = 2;
  const sampleSize = 32;
  const aic = 2 * parameterCount - 2 * options.logLikelihood;
  const aicc = aic + (2 * parameterCount * (parameterCount + 1)) / (sampleSize - parameterCount - 1);
  const bic = parameterCount * Math.log(sampleSize) - 2 * options.logLikelihood;
  const bestLogLikelihood = 82.4;
  const delta = 2 * (bestLogLikelihood - options.logLikelihood);
  const pValue = (options.extremeReplicateCount + 1) / 10001;
  return {
    family: options.family,
    modelSpecification: options.modelSpecification,
    parameterCount,
    parameters: options.parameters,
    logLikelihood: options.logLikelihood,
    aic,
    aicc,
    bic,
    deltaAicc: delta,
    deltaBic: delta,
    ks: 0.071,
    ad: options.ad,
    qqPoints: Array.from({ length: 32 }, (_, index) => ({
      observed: 0.52 + index * (0.07 / 31),
      theoretical: 0.518 + index * (0.074 / 31),
    })),
    bootstrap: {
      statisticId: "anderson_darling",
      observedStatistic: options.ad,
      comparisonDirection: "greater_than_or_equal",
      refitEachReplicate: true,
      extremeReplicateCount: options.extremeReplicateCount,
      confidenceInterval: {
        level: 0.95,
        method: "wilson_score",
        ...wilsonScoreInterval(options.extremeReplicateCount),
      },
      pValue,
      replicates: 10000,
      seed: HASH_B,
      methodId: "F7_BOOTSTRAP_V2",
      candidateMethodId: "F7_DISTRIBUTION_FIT_V1",
      streamDigest: options.family === "normal" ? HASH_A : HASH_B,
      status: pValue < 0.05 ? "rejected" : pValue < 0.1 ? "weak" : "acceptable",
    },
    warnings: options.warnings ? [...options.warnings] : [],
  };
}

function createSnapshot(overrides: Partial<F7SessionSnapshot>): F7SessionSnapshot {
  return {
    contractId: "f7-analysis-result-v1",
    outputClassification: "confidential",
    sessionId: "session-01",
    status: "worksheet_selection",
    workbook: {
      fileName: "demo.xlsx",
      workbookContentHash: HASH_A,
    },
    selectedWorksheetNames: [],
    worksheetOptions: [
      {
        selectionIndex: 1,
        worksheetName: "Anonymous_TA",
        toleranceLoopDescription: "Loop A",
        worksheetKind: "analysis",
        source: {
          summarySheet: "Auto Summary",
          summaryRow: 10,
          worksheetAnchor: "Anonymous_TA!A1",
        },
      },
      {
        selectionIndex: 2,
        worksheetName: "Loop_B",
        toleranceLoopDescription: "Loop B",
        worksheetKind: "analysis",
        source: {
          summarySheet: "Auto Summary",
          summaryRow: 11,
          worksheetAnchor: "Loop_B!A1",
        },
      },
    ],
    factors: [],
    ...overrides,
  };
}

function fullFactorCandidate(sourceCells: Readonly<Record<string, string>>): F7FactorState["factorCandidate"] {
  return {
    workbookContentHash: HASH_A,
    worksheetName: "Anonymous_TA",
    tableId: "table-1",
    sourceRow: 15,
    sourceCells,
    factorCandidateId: HASH_B,
    factorName: "C-cover height",
    workbookUnitEvidence: "mm",
    excelSignedMean: -1.94,
    designNominal: -0.57,
    upperTolerance: 0.05,
    lowerTolerance: -0.05,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    standardDeviation: 0.025,
    distribution: "Normal",
    lowerSpecLimit: 0.52,
    upperSpecLimit: 0.62,
  };
}

function fullFactorEvidence(
  sourceCells: Readonly<Record<string, string>>,
  lowerSpecLimit: number,
  upperSpecLimit: number,
): NonNullable<F7FactorState["evidence"]> {
  return {
    workbookContentHash: HASH_A,
    worksheetName: "Anonymous_TA",
    tableId: "table-1",
    sourceRow: 15,
    sourceCells,
    factorCandidateId: HASH_B,
    factorId: HASH_C,
    factorName: "C-cover height",
    unit: "mm",
    unitSource: "workbook",
    designNominal: -0.57,
    upperTolerance: 0.05,
    lowerTolerance: -0.05,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
    calculatedMean: -0.57,
    tolerance: 0.05,
    oneSigma: 0.0125,
    percentContributionToSigma: 1,
    loopCoefficient: -1,
    physicalMean: 0.57,
    signedContributionMean: -0.57,
    baselineSampler: {
      samplerId: "NORMAL_LOCATION_SCALE_V1",
      physicalMean: 0.57,
      standardDeviation: 0.025,
      support: "REAL",
    },
    lowerSpecLimit,
    upperSpecLimit,
  };
}

function measurementDataset(): F7MeasurementDataset {
  return {
    factorId: HASH_C,
    unit: "mm",
    structure: "UNORDERED_SAMPLE",
    sourceReference: "paste-01",
    importedAt: "2026-08-25T08:00:00.000Z",
    msaStatus: "unknown",
    observations: [
      { originalRow: 1, value: -0.01, disposition: "included" },
      { originalRow: 2, value: 0.01, disposition: "included" },
    ],
    missingRowCount: 0,
    rejectionSummaries: [],
    originalRowCount: 2,
    analyzedCount: 2,
    contentHash: HASH_B,
  };
}

function factorSetupSnapshot(options?: { includeVolume?: boolean }) {
  return createSnapshot({
    status: "factor_setup",
    selectedWorksheetNames: ["Anonymous_TA"],
    systemSpecification: {
      status: "available",
      lowerSpecLimit: { status: "available", actualValue: -0.62, displayValue: "-0.62", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Anonymous_TA!P54", valueOrigin: "numeric_literal" },
      upperSpecLimit: { status: "available", actualValue: -0.52, displayValue: "-0.52", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Anonymous_TA!P55", valueOrigin: "numeric_literal" },
      targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3", sourceLabel: "*Target σ Level ►", sourceCell: "Anonymous_TA!P56", valueOrigin: "numeric_literal" },
      additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
      ...(options?.includeVolume === false ? {} : {
        volume: { status: "available" as const, actualValue: 1_000_000, displayValue: "1,000,000", sourceLabel: "Volume ►", sourceCell: "Anonymous_TA!X56", valueOrigin: "numeric_literal" as const },
      }),
    },
    factors: [
      {
        factorCandidate: fullFactorCandidate({
            mean: "Anonymous_TA!R15",
            nominalValue: "Anonymous_TA!L15",
            lowerSpecLimit: "Anonymous_TA!M15",
            upperSpecLimit: "Anonymous_TA!N15",
        }),
      },
    ],
  });
}

function measurementEntrySnapshot() {
  return createSnapshot({
    status: "measurement_entry",
    selectedWorksheetNames: ["Anonymous_TA"],
    factors: [
      {
        factorCandidate: fullFactorCandidate({
            mean: "Anonymous_TA!R15",
            lowerSpecLimit: "Anonymous_TA!P54",
            upperSpecLimit: "Anonymous_TA!P55",
        }),
        setup: {
          factorCandidateId: HASH_B,
          designNominal: -0.57,
          upperTolerance: 0.05,
          lowerTolerance: -0.05,
          confirmed: true,
        },
        evidence: fullFactorEvidence({
            mean: "Anonymous_TA!R15",
            lowerSpecLimit: "Anonymous_TA!P54",
            upperSpecLimit: "Anonymous_TA!P55",
        }, 0.52, 0.62),
        sourceMode: "MEASURED",
        input: { mode: "MEASURED" },
      },
    ],
  });
}

function phaseReadySnapshot() {
  const dataset = measurementDataset();
  return createSnapshot({
    status: "phase_1_ready",
    selectedWorksheetNames: ["Anonymous_TA"],
    factors: [
      {
        factorCandidate: fullFactorCandidate({ mean: "Anonymous_TA!R15" }),
        setup: {
          factorCandidateId: HASH_B,
          designNominal: -0.57,
          upperTolerance: 0.05,
          lowerTolerance: -0.05,
          confirmed: true,
        },
        evidence: fullFactorEvidence({
            mean: "Anonymous_TA!R15",
            nominalValue: "Anonymous_TA!L15",
            upperTolerance: "Anonymous_TA!M15",
            lowerTolerance: "Anonymous_TA!N15",
            lowerSpecLimit: "Anonymous_TA!N15",
            upperSpecLimit: "Anonymous_TA!M15",
        }, 0.5199999999999999, 0.6199999999999999),
        sourceMode: "MEASURED",
        input: {
          mode: "MEASURED",
          dataset,
        },
        measurementPasteResult: {
          status: "ready",
          factorId: HASH_C,
          dataset,
          validation: {
            status: "ready",
            blockingIssues: [],
            advisoryIssues: [{ reason: "fit_uncertainty", factorId: HASH_C }],
            candidateEligibility: {
              normal: "eligible",
              lognormal: "ineligible_nonpositive",
              weibull: "ineligible_nonpositive",
              gamma: "ineligible_nonpositive",
              uniform: "eligible_with_boundary_warning",
            },
          },
        },
        datasetValidation: {
          status: "ready",
          blockingIssues: [],
          advisoryIssues: [{ reason: "fit_uncertainty", factorId: HASH_C }],
          candidateEligibility: {
            normal: "eligible",
            lognormal: "ineligible_nonpositive",
            weibull: "ineligible_nonpositive",
            gamma: "ineligible_nonpositive",
            uniform: "eligible_with_boundary_warning",
          },
        },
      },
    ],
  });
}

function distributionFitSnapshot() {
  const ready = phaseReadySnapshot();
  return createSnapshot({
    ...ready,
    factors: ready.factors.map((factor) => ({
      ...factor,
      distributionFitResult: {
        factorId: HASH_C,
        sampleSize: 32,
        characteristicKind: "dimensional",
        candidates: [
          fitCandidate({
            family: "normal",
            modelSpecification: "normal_location_scale",
            parameters: { mean: 0.55, standardDeviation: 0.018 },
            logLikelihood: 82.4,
            ad: 0.284,
            extremeReplicateCount: 5000,
          }),
          fitCandidate({
            family: "lognormal",
            modelSpecification: "lognormal_location_zero",
            parameters: { logMean: -0.598, logStandardDeviation: 0.033 },
            logLikelihood: 82.1,
            ad: 0.31,
            extremeReplicateCount: 4800,
          }),
          fitCandidate({
            family: "gamma",
            modelSpecification: "gamma_location_zero",
            parameters: { shape: 930, scale: 0.000591 },
            logLikelihood: 81.7,
            ad: 0.36,
            extremeReplicateCount: 4500,
          }),
        ],
        failedCandidates: [],
        sampleDiagnostics: {
          mean: 0.55,
          median: 0.549,
          skewness: 0.08,
          coefficientOfVariation: 0.033,
          meanMedianRelativeDifference: 0.00182,
          normalQqCurvature: 0.02,
        },
        selectionDecision: {
          methodId: "F7_MODEL_SELECTION_V1",
          status: "no_unique_preference",
          numericBestFamily: "normal",
          competitiveFamilies: ["normal", "lognormal", "gamma"],
          engineeringDefaultFamily: "normal",
          proposedFinalFamily: "normal",
          confidence: "low",
          reasonCodes: [
            "MULTIPLE_COMPETITIVE_MODELS",
            "SMALL_SAMPLE_UNCERTAINTY",
            "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT",
          ],
        },
      },
    })),
  });
}

function distributionFitFailureSnapshot() {
  const fitted = distributionFitSnapshot();
  return createSnapshot({
    ...fitted,
    factors: fitted.factors.map((factor) => {
      if (!factor.distributionFitResult) return factor;
      return {
        ...factor,
        distributionFitResult: {
          ...factor.distributionFitResult,
          failedCandidates: [{ family: "weibull" as const, reasonCode: "numerical_fit_failed" as const }],
          selectionDecision: {
            ...factor.distributionFitResult.selectionDecision,
            status: "withheld_candidate_failures" as const,
            engineeringDefaultFamily: undefined,
            proposedFinalFamily: undefined,
            reasonCodes: [
              "MULTIPLE_COMPETITIVE_MODELS" as const,
              "CANDIDATE_FIT_FAILURES" as const,
              "SMALL_SAMPLE_UNCERTAINTY" as const,
            ],
          },
        },
      };
    }),
  });
}

function approvedDistributionSnapshot(): F7SessionSnapshot {
  const fitted = distributionFitSnapshot();
  return createSnapshot({
    ...fitted,
    systemSpecification: {
      status: "available",
      lowerSpecLimit: {
        status: "available",
        actualValue: -0.15,
        displayValue: "-0.15",
        sourceLabel: "*Lower Spec Limit ►",
        sourceCell: "Anonymous_TA!P54",
        valueOrigin: "numeric_literal",
      },
      upperSpecLimit: {
        status: "available",
        actualValue: 0.05,
        displayValue: "0.05",
        sourceLabel: "*Upper Spec Limit ►",
        sourceCell: "Anonymous_TA!P55",
        valueOrigin: "numeric_literal",
      },
      targetSigmaLevel: {
        status: "available",
        actualValue: 3,
        displayValue: "3.0σ",
        sourceLabel: "*Target σ Level ►",
        sourceCell: "Anonymous_TA!P56",
        valueOrigin: "numeric_literal",
      },
      additionalMeanShift: {
        status: "available",
        actualValue: 0,
        displayValue: "0",
        sourceLabel: "Additional Mean Shift",
        valueOrigin: "defaulted",
      },
    },
    factors: fitted.factors.map((factor) => factor.distributionFitResult ? {
      ...factor,
      distributionApproval: {
        factorId: factor.distributionFitResult.factorId,
        family: factor.distributionFitResult.selectionDecision.proposedFinalFamily!,
        confirmed: true,
        approvedAt: "2026-08-19T08:00:00.000Z",
      },
    } : factor),
  });
}

function completedMonteCarloSnapshot(): F7SessionSnapshot {
  const approved = approvedDistributionSnapshot();
  const bins = Array.from({ length: 20 }, (_, index) => ({
    minimum: -0.2 + index * 0.02,
    maximum: -0.2 + (index + 1) * 0.02,
    observedCount: 500,
  }));
  return createSnapshot({
    ...approved,
    monteCarloResult: {
      methodId: "F7_MONTE_CARLO_V1",
      status: "complete",
      lowerSpecLimit: -0.15,
      upperSpecLimit: 0.05,
      targetSigmaLevel: 4,
      iterations: 10_000,
      runSeed: HASH_A,
      correlationMode: "INDEPENDENT",
      mean: -0.02,
      standardDeviation: 0.04,
      quantiles: { p00135: -0.14, p01: -0.11, p05: -0.08, p50: -0.02, p95: 0.04, p99: 0.07, p99865: 0.1 },
      inSpecCount: 9_500,
      outOfSpecCount: 500,
      yield: 0.95,
      outOfSpecProbability: 0.05,
      ppm: 50_000,
      histogram: { methodId: "F7_HISTOGRAM_FD_V1", bins },
      normalFit: {
        methodId: "F7_NORMAL_MOMENT_FIT_V1",
        mean: -0.02,
        standardDeviation: 0.04,
        expectedBinCounts: bins.map(() => 500),
      },
      capability: {
        status: "available",
        cp: 0.8333333333,
        lowerCpk: 1.0833333333,
        upperCpk: 0.5833333333,
        cpk: 0.5833333333,
        targetCpk: 1.3333333333,
        targetStatus: "below_target",
      },
      normalModel: {
        status: "available",
        lowerTailDpm: 577.025,
        upperTailDpm: 40_059.157,
        totalDpm: 40_636.182,
        expectedYield: 0.959363818,
      },
      factorManifest: approved.factors.map((factor) => ({
        factorId: factor.distributionApproval!.factorId,
        family: factor.distributionApproval!.family,
        sourceMode: factor.sourceMode!,
      })),
    },
  });
}

function reportProjection(snapshot = completedMonteCarloSnapshot()): F7ReportProjection {
  const simulation = snapshot.monteCarloResult!;
  const capability = simulation.capability;
  return {
    contractId: "f7-report-v1",
    outputClassification: snapshot.outputClassification,
    sessionId: snapshot.sessionId,
    generatedAt: "2026-08-26T08:00:00.000Z",
    assessment: capability.status === "available" && capability.cpk >= capability.targetCpk
      ? "MEETS_TARGET"
      : "BELOW_TARGET",
    workbook: {
      fileName: snapshot.workbook.fileName,
      workbookContentHash: snapshot.workbook.workbookContentHash,
      worksheetName: snapshot.selectedWorksheetNames[0]!,
    },
    summary: {
      mean: simulation.mean,
      standardDeviation: simulation.standardDeviation,
      yield: simulation.yield,
      ppm: simulation.ppm,
      lowerSpecLimit: simulation.lowerSpecLimit,
      upperSpecLimit: simulation.upperSpecLimit,
      targetSigmaLevel: simulation.targetSigmaLevel,
      ...(capability.status === "available" ? { cp: capability.cp, cpk: capability.cpk } : {}),
      targetCpk: capability.targetCpk,
    },
    simulation,
    factors: snapshot.factors.map((factor) => ({
      factorId: factor.distributionApproval!.factorId,
      factorName: factor.factorCandidate.factorName,
      loopCoefficient: factor.evidence!.loopCoefficient,
      sourceMode: factor.sourceMode!,
      approvedDistribution: factor.distributionApproval!.family,
      sourceReferences: Object.values(factor.evidence!.sourceCells),
    })),
    evidence: {
      workbookContentHash: snapshot.workbook.workbookContentHash,
      worksheetName: snapshot.selectedWorksheetNames[0]!,
      specificationSourceCells: {
        lowerSpecLimit: snapshot.systemSpecification?.status === "available"
          ? snapshot.systemSpecification.lowerSpecLimit.sourceCell
          : undefined,
        upperSpecLimit: snapshot.systemSpecification?.status === "available"
          ? snapshot.systemSpecification.upperSpecLimit.sourceCell
          : undefined,
        targetSigmaLevel: snapshot.systemSpecification?.status === "available"
          ? snapshot.systemSpecification.targetSigmaLevel.sourceCell
          : undefined,
      },
      specificationInputOrigins: {
        lowerSpecLimit: "excel_source",
        upperSpecLimit: "excel_source",
        targetSigmaLevel: "excel_source",
      },
      methodIds: {
        simulation: simulation.methodId,
        histogram: simulation.histogram.methodId,
        normalFit: simulation.normalFit.methodId,
      },
      seed: simulation.runSeed,
      iterations: simulation.iterations,
      factorManifest: simulation.factorManifest,
    },
    markdown: "# F7 analysis report\n",
  };
}

function createMockClient(
  initial: F7SessionSnapshot,
  nextByAction: Partial<Record<string, F7SessionSnapshot>> = {},
  generateReport: F7Client["generateReport"] = vi.fn(async () => {
    throw new Error("Report generation is not used by this App test.");
  }),
): F7Client {
  let session = initial;
  return {
    importWorkbook: vi.fn(async () => {
      session = nextByAction.importWorkbook ?? session;
      return session;
    }),
    confirmWorksheet: vi.fn(async () => {
      session = nextByAction.confirmWorksheet ?? session;
      return session;
    }),
    confirmFactors: vi.fn(async () => {
      session = nextByAction.confirmFactors ?? session;
      return session;
    }),
    setFactorMode: vi.fn(async () => {
      session = nextByAction.setFactorMode ?? session;
      return session;
    }),
    pasteMeasurements: vi.fn(async () => {
      session = nextByAction.pasteMeasurements ?? session;
      return session;
    }),
    applyMeasurementDisposition: vi.fn(async () => {
      session = nextByAction.applyMeasurementDisposition ?? session;
      return session;
    }),
    fitDistribution: vi.fn(async () => {
      session = nextByAction.fitDistribution ?? session;
      return session;
    }),
    approveDistribution: vi.fn(async () => {
      session = nextByAction.approveDistribution ?? session;
      return session;
    }),
    runMonteCarlo: vi.fn(async () => {
      session = nextByAction.runMonteCarlo ?? session;
      return session;
    }),
    generateReport,
    getSession: vi.fn(async () => session),
  };
}

function twoFactorReadySnapshot(): F7SessionSnapshot {
  const fitted = distributionFitSnapshot();
  const first = fitted.factors[0]!;
  const { distributionFitResult: _distributionFitResult, ...unfittedFirst } = first;
  const secondDataset = {
    ...first.measurementPasteResult!.dataset!,
    factorId: HASH_A,
    observations: [
      { originalRow: 1, value: 2.1, disposition: "included" as const },
      { originalRow: 2, value: 2.2, disposition: "included" as const },
    ],
  };
  return createSnapshot({
    ...fitted,
    factors: [
      first,
      {
        ...unfittedFirst,
        factorCandidate: {
          ...first.factorCandidate,
          factorCandidateId: HASH_A,
          factorName: "Second factor",
        },
        setup: { ...first.setup!, factorCandidateId: HASH_A },
        evidence: {
          ...first.evidence!,
          factorCandidateId: HASH_A,
          factorId: HASH_A,
          factorName: "Second factor",
        },
        input: { mode: "MEASURED", dataset: secondDataset },
        measurementPasteResult: {
          ...first.measurementPasteResult!,
          factorId: HASH_A,
          dataset: secondDataset,
        },
      },
    ],
  });
}

async function uploadWorkbook(wrapper: ReturnType<typeof mount>, file = new File([new Uint8Array([1, 2, 3])], "demo.xlsx")): Promise<void> {
  const input = wrapper.get("#workbook-file").element as HTMLInputElement;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });
  await wrapper.get("#workbook-file").trigger("change");
}

async function openMeasurementWorkspace(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.get(`[data-open-measurement='${HASH_C}']`).trigger("click");
}

describe("F7 workbench shell", () => {
  it("1) initial import UI has file label and no marketing landing", () => {
    const client = createMockClient(createSnapshot({ status: "worksheet_selection" }));
    const wrapper = mount(App, { props: { client } });
    expect(wrapper.text()).toContain("Import Workbook");
    expect(wrapper.find("label[for='workbook-file']").text()).toContain("Workbook file");
    expect(wrapper.text().toLowerCase()).not.toContain("hero");
    expect(wrapper.text().toLowerCase()).not.toContain("welcome");
  });

  it("2) import->worksheet_selection allows explicit pick and confirm with exact DTO", async () => {
    const client = createMockClient(createSnapshot({ status: "worksheet_selection" }), {
      importWorkbook: createSnapshot({ status: "worksheet_selection" }),
      confirmWorksheet: factorSetupSnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    expect(client.importWorkbook).toHaveBeenCalledTimes(1);
    const workflowRail = wrapper.get(".workflow-rail");
    expect(workflowRail.text()).not.toContain("Session");
    expect(workflowRail.get("[data-workbook-name]").text()).toBe("demo.xlsx");
    expect(workflowRail.get("[data-worksheet-selection]").text()).toBe("Not selected");
    expect(wrapper.get("[aria-label='Worksheet confirmation']").text()).not.toContain("Workbook hash");

    await wrapper.get("input[type='radio'][name='worksheet-option'][value='Loop_B']").setValue(true);
    await wrapper.get("button").trigger("click");
    expect(client.confirmWorksheet).toHaveBeenCalledWith({
      sessionId: "session-01",
      workbookContentHash: HASH_A,
      selectedWorksheetName: "Loop_B",
      confirmed: true,
    });
    expect(wrapper.get("[data-worksheet-selection]").text()).toBe("Anonymous_TA");
  });

  it("2b) worksheet confirmation disables and does not call client when worksheet options are empty", async () => {
    const client = createMockClient(createSnapshot({ status: "worksheet_selection", worksheetOptions: [] }));
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.text()).toContain("No worksheet options available");
    const confirmButton = wrapper.get("button.action-button");
    expect(confirmButton.attributes("disabled")).toBeDefined();
    await confirmButton.trigger("click");
    expect(client.confirmWorksheet).not.toHaveBeenCalled();
  });

  it("3) factor_setup exposes editable specifications and confirms their values", async () => {
    const client = createMockClient(factorSetupSnapshot(), {
      importWorkbook: factorSetupSnapshot(),
      confirmFactors: measurementEntrySnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    const saveSetupButton = wrapper.get("#confirm-factor-setup");
    expect(saveSetupButton.text()).toBe("Save setup");
    expect(saveSetupButton.element.parentElement?.classList).toContain("factor-setup-actions");

    const headers = wrapper.findAll("th").map((header) => header.text());
    expect(headers[0]).toBe("Item");
    expect(headers).toContain("Distribution");
    expect(headers).toContain("Mean");
    expect(headers).toContain("Tolerance");
    expect(headers).toContain("1σ");
    expect(headers).toContain("% Cont. to σ");
    const expectHeaderLines = (key: string, lines: readonly string[]) => {
      const header = wrapper.get(`th[data-column-key='${key}']`);
      expect(header.findAll(".factor-header-line").map((line) => line.text())).toEqual(lines);
      expect(header.classes()).toContain("factor-header-multiline");
    };
    expectHeaderLines("designNominal", ["Design", "Norminal"]);
    expectHeaderLines("upperTolerance", ["+", "Tol"]);
    expectHeaderLines("lowerTolerance", ["-", "Tol"]);
    expectHeaderLines("longTermSafetyFactor", ["Long Term/", "Safety Factor"]);
    expectHeaderLines("sigmaLevel", ["σ", "Level"]);
    expect(headers).not.toContain("Source Cells");
    expect(headers).not.toContain("Signed Mean");
    expect(headers).not.toContain("Coefficient");
    expect(headers).not.toContain("Physical Mean");
    expect(wrapper.text()).not.toContain("Anonymous_TA!R15");
    expect(wrapper.text()).not.toContain(HASH_B.slice(0, 12));
    expect(wrapper.get("tbody tr > td .factor-item-controls > span").text()).toBe("1");
    expect(wrapper.find("input[id^='unit-']").exists()).toBe(false);

    const specificationInputs = wrapper.findAll("input.factor-spec-input");
    expect(specificationInputs).toHaveLength(5);
    const numericInputs = wrapper.findAll(".factor-table input[type='number']");
    expect(numericInputs).toHaveLength(6);
    expect(numericInputs.every((input) => input.classes().includes("factor-number-input"))).toBe(true);
    await specificationInputs[0]!.setValue("-2.05");
    await specificationInputs[1]!.setValue("0.1");
    await specificationInputs[2]!.setValue("-0.08");
    await specificationInputs[3]!.setValue("2");
    await specificationInputs[4]!.setValue("4");
    const distribution = wrapper.get("select[aria-label='C-cover height Distribution']");
    expect(distribution.findAll("option").map((option) => option.text())).toEqual([
      "Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta",
    ]);
    expect((distribution.element as HTMLSelectElement).value).toBe("Normal");
    expect(wrapper.get("output[aria-label='C-cover height Mean']").text()).toBe("-2.06");
    expect(wrapper.get("output[aria-label='C-cover height Tolerance']").text()).toBe("0.09");
    expect(wrapper.get("output[aria-label='C-cover height 1 Sigma']").text()).toBe("0.045");
    expect(wrapper.get("output[aria-label='C-cover height Percent Contribution']").text()).toBe("100%");
    await distribution.setValue("Uniform");
    expect(wrapper.get("output[aria-label='C-cover height 1 Sigma']").text()).toBe("0.0779");
    await distribution.setValue("Normal");

    const outputLayout = wrapper.get("[data-factor-output-layout]");
    expect(outputLayout.element.firstElementChild?.hasAttribute("data-dimension-chain-panel")).toBe(true);
    expect(outputLayout.element.lastElementChild?.hasAttribute("data-f4-response-summary")).toBe(true);
    expect(outputLayout.classes()).not.toContain("is-dimension-chain-expanded");
    expect(wrapper.find("[aria-label='Expand Dimension Chain']").exists()).toBe(false);
    expect(wrapper.find("[data-dimension-chain-svg]").exists()).toBe(false);
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    expect(wrapper.findAll("[data-dimension-segment]")).toHaveLength(1);
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-direction")).toBe("subtractive");
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("-2.05");

    await distribution.setValue("Uniform");
    expect(wrapper.get("[data-dimension-chain-stale]").text()).toContain("Update");
    expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("-2.05");
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(false);
    await distribution.setValue("Normal");
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    const responseSummary = wrapper.get("[data-factor-response-summary]");
    expect(responseSummary.get("[data-summary-design-nominal]").text()).toBe("-2.05");
    expect(responseSummary.get("[data-summary-upper-tolerance]").text()).toBe("+0.08");
    expect(responseSummary.get("[data-summary-lower-tolerance]").text()).toBe("-0.1");
    expect(responseSummary.get("[data-summary-mean-response]").text()).toBe("-2.06");
    expect(responseSummary.get("[data-summary-tolerance]").text()).toBe("± 0.09");
    expect(responseSummary.get("[data-summary-rss-sigma]").text()).toBe("0.045");
    expect(responseSummary.get("[data-summary-contribution]").text()).toBe("100%");

    const capabilitySummary = wrapper.get("[data-f4-response-summary]");
    expect(capabilitySummary.text()).toContain("Response Summary Table");
    expect(capabilitySummary.text()).toContain("Calculated RSS and Worst Case");
    expect(capabilitySummary.text()).toContain("Calculated Sigma Level");
    expect(capabilitySummary.text()).toContain("Calculated Cpk");
    expect(capabilitySummary.text()).toContain("Defects Per Million");
    expect(capabilitySummary.get("[data-f4-lsl]").text()).toBe("-0.62");
    expect(capabilitySummary.get("[data-f4-usl]").text()).toBe("-0.52");
    expect(capabilitySummary.get("[data-f4-target-sigma]").text()).toBe("3σ");
    expect(capabilitySummary.get("[data-f4-volume]").text()).toBe("1,000,000");
    for (const selector of ["[data-f4-lsl]", "[data-f4-usl]", "[data-f4-target-sigma]", "[data-f4-volume]"]) {
      const outputClasses = capabilitySummary.get(selector).get("output").classes();
      expect(outputClasses).toContain("f4-readonly-field");
      expect(outputClasses).toContain("f4-compact-value");
    }
    expect(capabilitySummary.get("[data-f4-rss-sigma]").text()).toBe("0.0450");
    expect(capabilitySummary.get("[data-f4-worst-case-tolerance]").text()).toBe("± 0.0900");
    expect(capabilitySummary.get("[data-f4-worst-case-upper]").text()).toBe("-1.9700");
    expect(capabilitySummary.get("[data-f4-worst-case-lower]").text()).toBe("-2.1500");
    expect(capabilitySummary.get("[data-f4-cpk]").text()).toBe("-10.67");
    expect(capabilitySummary.get("[data-f4-total-dpm]").text()).toBe("1,000,000");
    expect(capabilitySummary.get("[data-f4-yield]").text()).toBe("0.00%");

    const meanShift = responseSummary.get("input[aria-label='Additional Mean Shift']");
    expect((meanShift.element as HTMLInputElement).value).toBe("0");
    await meanShift.setValue("0.25");
    expect(responseSummary.get("[data-summary-adjusted-mean]").text()).toBe("-1.81");
    expect(capabilitySummary.get("[data-f4-cpk]").text()).toBe("-8.81");
    expect(responseSummary.findAll("input")).toHaveLength(1);

    expect(wrapper.find("[data-factor-arithmetic-total]").exists()).toBe(false);
    expect(wrapper.find("[data-factor-rss-total]").exists()).toBe(false);

    expect(responseSummary.get("[data-summary-design-nominal]").element.parentElement?.dataset.factorColumn).toBe("design-nominal");
    expect(responseSummary.get("[data-summary-upper-tolerance]").element.parentElement?.dataset.factorColumn).toBe("upper-tolerance");
    expect(responseSummary.get("[data-summary-lower-tolerance]").element.parentElement?.dataset.factorColumn).toBe("lower-tolerance");
    expect(responseSummary.get("[data-summary-mean-response]").element.parentElement?.dataset.factorColumn).toBe("mean");
    expect(responseSummary.get("[data-summary-tolerance]").element.parentElement?.dataset.factorColumn).toBe("tolerance");
    expect(responseSummary.get("[data-summary-rss-sigma]").element.parentElement?.dataset.factorColumn).toBe("one-sigma");
    expect(responseSummary.get("[data-summary-contribution]").element.parentElement?.dataset.factorColumn).toBe("contribution");

    await distribution.setValue("Uniform");
    await wrapper.get("#confirm-factor-setup").trigger("click");
    expect(client.confirmFactors).toHaveBeenCalledWith({
      sessionId: "session-01",
      confirmations: [{
        factorCandidateId: HASH_B,
        designNominal: -2.05,
        upperTolerance: 0.1,
        lowerTolerance: -0.08,
        longTermSafetyFactor: 2,
        sigmaLevel: 4,
        distribution: "Uniform",
        confirmed: true,
      }],
    });
  });

  it("3) factor_setup reverses all factor signs as one undoable edit and accepts partial chain sign changes", async () => {
    const base = factorSetupSnapshot();
    const first = base.factors[0]!;
    const snapshot = createSnapshot({
      ...base,
      factors: [
        first,
        {
          factorCandidate: {
            ...first.factorCandidate,
            factorCandidateId: HASH_C,
            factorName: "Second factor",
            sourceRow: first.factorCandidate.sourceRow + 1,
            excelSignedMean: 0.4,
            designNominal: 0.4,
          },
        },
      ],
    });
    const client = createMockClient(snapshot, { importWorkbook: snapshot });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    const reverse = wrapper.get("button[aria-label='Reverse all factors']");
    expect(reverse.attributes("title")).toBe("Reverse all factors");
    expect(reverse.text()).toContain("Reverse signs");
    expect(reverse.find("svg").exists()).toBe(true);
    expect(reverse.attributes("disabled")).toBeUndefined();
    expect(wrapper.getComponent(DimensionChainPanel).props("editable")).toBe(true);

    const nominalValues = () => wrapper.findAll("input[data-factor-design-nominal]")
      .map((input) => (input.element as HTMLInputElement).value);
    expect(nominalValues()).toEqual(["-0.57", "0.4"]);
    expect(wrapper.get("[data-summary-design-nominal]").text()).toBe("-0.17");

    await reverse.trigger("click");
    expect(nominalValues()).toEqual(["0.57", "-0.4"]);
    expect(wrapper.get("[data-summary-design-nominal]").text()).toBe("0.17");

    await wrapper.get("[data-factor-undo]").trigger("click");
    expect(nominalValues()).toEqual(["-0.57", "0.4"]);
    expect(wrapper.get("[data-summary-design-nominal]").text()).toBe("-0.17");

    await wrapper.get("[data-factor-redo]").trigger("click");
    expect(nominalValues()).toEqual(["0.57", "-0.4"]);
    expect(wrapper.get("[data-summary-design-nominal]").text()).toBe("0.17");

    wrapper.getComponent(DimensionChainPanel).vm.$emit("factor-sign-change", [
      { factorId: HASH_C, sign: 1 },
    ]);
    await wrapper.vm.$nextTick();
    expect(nominalValues()).toEqual(["0.57", "0.4"]);
    await wrapper.get("[data-factor-undo]").trigger("click");
    expect(nominalValues()).toEqual(["0.57", "-0.4"]);

    wrapper.getComponent(DimensionChainPanel).vm.$emit("reverse-all");
    await wrapper.vm.$nextTick();
    expect(nominalValues()).toEqual(["-0.57", "0.4"]);

    const nominalInputs = wrapper.findAll("input[data-factor-design-nominal]");
    await nominalInputs[0]!.setValue("");
    await nominalInputs[1]!.setValue("0");
    expect(reverse.attributes("disabled")).toBeDefined();
  });

  it("3) factor_setup hides reverse signs when read-only and disables it while busy", async () => {
    const readOnlySnapshot = measurementEntrySnapshot();
    const readOnlyClient = createMockClient(readOnlySnapshot, { importWorkbook: readOnlySnapshot });
    const readOnlyWrapper = mount(App, { props: { client: readOnlyClient } });
    await uploadWorkbook(readOnlyWrapper);

    expect(readOnlyWrapper.find("[data-factor-reverse-all]").exists()).toBe(false);
    const readOnlyChain = readOnlyWrapper.getComponent(DimensionChainPanel);
    expect(readOnlyChain.props("editable")).toBe(false);
    expect(readOnlyChain.get("button[aria-label='Reverse all factors']").attributes("disabled")).toBeDefined();

    const setupSnapshot = factorSetupSnapshot();
    const busyClient = createMockClient(setupSnapshot, { importWorkbook: setupSnapshot });
    let resolveConfirmation!: (snapshot: F7SessionSnapshot) => void;
    vi.mocked(busyClient.confirmFactors).mockImplementation(() => new Promise((resolve) => {
      resolveConfirmation = resolve;
    }));
    const busyWrapper = mount(App, { props: { client: busyClient } });
    await uploadWorkbook(busyWrapper);

    const submission = busyWrapper.get("#confirm-factor-setup").trigger("click");
    await busyWrapper.vm.$nextTick();
    expect(busyWrapper.attributes("aria-busy")).toBe("true");
    expect(busyWrapper.get("button[aria-label='Reverse all factors']").attributes("disabled")).toBeDefined();
    expect(busyWrapper.getComponent(DimensionChainPanel).props("editable")).toBe(false);

    resolveConfirmation(measurementEntrySnapshot());
    await submission;
    await vi.waitFor(() => expect(busyWrapper.attributes("aria-busy")).toBe("false"));
  });

  it("3a) returns from measurement entry to editable factor setup and reconfirms updated values", async () => {
    const measurementEntry = measurementEntrySnapshot();
    const client = createMockClient(measurementEntry, {
      importWorkbook: measurementEntry,
      confirmFactors: measurementEntry,
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.find("input.factor-spec-input").exists()).toBe(false);
    const editSetupButton = wrapper.get("[data-edit-factor-setup]");
    expect(editSetupButton.text()).toBe("Edit setup");
    expect(editSetupButton.element.parentElement?.classList).toContain("factor-setup-actions");
    await editSetupButton.trigger("click");

    const designNominal = wrapper.get("input[aria-label='C-cover height Design Nominal']");
    expect((designNominal.element as HTMLInputElement).value).toBe("-0.57");
    expect(wrapper.get("#confirm-factor-setup").text()).toBe("Save setup");
    expect(wrapper.get("#confirm-factor-setup").element.parentElement?.classList).toContain("factor-setup-actions");
    expect(wrapper.find("fieldset.source-mode-options").exists()).toBe(false);
    expect(wrapper.find("[aria-label='Validation summary']").exists()).toBe(false);

    await designNominal.setValue("-0.6");
    await wrapper.get("#confirm-factor-setup").trigger("click");
    expect(client.confirmFactors).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "session-01",
      confirmations: [expect.objectContaining({ designNominal: -0.6, confirmed: true })],
    }));
  });

  it("3b) factor setup supports row insertion, deletion, and reordering", async () => {
    const client = createMockClient(factorSetupSnapshot(), {
      importWorkbook: factorSetupSnapshot(),
      confirmFactors: measurementEntrySnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.get("th[data-column-key='index']").text()).toBe("Item");
    expect(wrapper.get("button[aria-label='Move C-cover height up']").attributes("disabled")).toBeDefined();
    expect(wrapper.get("button[aria-label='Move C-cover height down']").attributes("disabled")).toBeDefined();

    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.get("button[aria-label='Add factor after C-cover height']").trigger("click");
    expect(wrapper.get("[data-dimension-chain-stale]").text()).toContain("Update");
    let rows = wrapper.findAll(".factor-table tbody tr");
    await rows[1]!.get("button[aria-label='Delete new factor']").trigger("click");
    expect(wrapper.findAll(".factor-table tbody tr")).toHaveLength(1);
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(false);

    await wrapper.get("button[aria-label='Add factor after C-cover height']").trigger("click");
    expect(wrapper.findAll(".factor-table tbody tr")).toHaveLength(2);
    rows = wrapper.findAll(".factor-table tbody tr");
    const addedRow = rows[1]!;
    expect(addedRow.get(".factor-item-number").text()).toBe("2");
    expect(addedRow.findAll(".factor-item-actions .factor-row-control").map((button) => button.text())).toEqual(["−", "+"]);
    expect((addedRow.get("input[aria-label='New factor name']").element as HTMLInputElement).value).toBe("");
    const initialSpecifications = addedRow.findAll("input.factor-spec-input");
    expect(initialSpecifications.map((input) => (input.element as HTMLInputElement).value)).toEqual(["", "", "", "1", "4"]);
    expect((addedRow.get("select.factor-distribution-select").element as HTMLSelectElement).value).toBe("Normal");
    expect(addedRow.findAll("output").map((output) => output.text())).toEqual(["", "", "", ""]);
    expect(addedRow.find("[role='alert']").exists()).toBe(false);

    expect(initialSpecifications[1]!.attributes("min")).toBeUndefined();
    expect(initialSpecifications[2]!.attributes("max")).toBeUndefined();
    await initialSpecifications[0]!.setValue("0");
    await initialSpecifications[1]!.setValue("-0.1");
    await initialSpecifications[2]!.setValue("-0.3");
    expect(addedRow.get("[data-factor-field='upperTolerance']").text()).toContain("+Tolerance must be non-negative.");
    expect(addedRow.get("[data-factor-field='lowerTolerance']").find("[role='alert']").exists()).toBe(false);
    await initialSpecifications[1]!.setValue("0.3");
    await initialSpecifications[2]!.setValue("0.1");
    expect(addedRow.get("[data-factor-field='upperTolerance']").find("[role='alert']").exists()).toBe(false);
    expect(addedRow.get("[data-factor-field='lowerTolerance']").text()).toContain("-Tolerance must be non-positive.");
    await initialSpecifications[1]!.setValue("0.1");
    expect(addedRow.get("[data-factor-field='lowerTolerance']").text()).toContain("-Tolerance must be less than +Tolerance.");
    await initialSpecifications[0]!.setValue("");
    await initialSpecifications[1]!.setValue("");
    await initialSpecifications[2]!.setValue("");
    expect(addedRow.find("[role='alert']").exists()).toBe(false);

    expect(wrapper.get("[data-summary-design-nominal]").text()).toBe("-0.57");
    expect(wrapper.get("[data-summary-mean-response]").text()).toBe("-0.57");
    expect(wrapper.get("[data-summary-tolerance]").text()).toBe("± 0.05");
    expect(wrapper.get("[data-summary-rss-sigma]").text()).toBe("0.0125");
    expect(wrapper.get("[data-f4-rss-sigma]").text()).toBe("0.0125");
    expect(wrapper.get("[data-f4-cpk]").text()).toBe("1.33");
    expect(wrapper.get("#confirm-factor-setup").attributes("disabled")).toBeDefined();

    await addedRow.get("button[aria-label='Move new factor up']").trigger("click");
    rows = wrapper.findAll(".factor-table tbody tr");
    expect(rows[0]!.find("input[aria-label='New factor name']").exists()).toBe(true);
    expect(rows[0]!.get("button[aria-label='Move new factor up']").attributes("disabled")).toBeDefined();
    expect(rows[1]!.get("button[aria-label='Move C-cover height down']").attributes("disabled")).toBeDefined();

    await addedRow.get("input[aria-label='New factor name']").setValue("User stack gap");
    const addedSpecifications = addedRow.findAll("input.factor-spec-input");
    await addedSpecifications[0]!.setValue("0.4");
    await addedSpecifications[1]!.setValue("0.08");
    await addedSpecifications[2]!.setValue("-0.04");
    await addedSpecifications[3]!.setValue("1");
    await addedSpecifications[4]!.setValue("4");
    await addedRow.get("select.factor-distribution-select").setValue("Normal");

    await wrapper.get("[data-generate-dimension-chain]").trigger("click");
    expect(wrapper.find("[data-dimension-chain-stale]").exists()).toBe(false);
    await addedRow.get("button[aria-label='Move User stack gap down']").trigger("click");
    expect(wrapper.get("[data-dimension-chain-stale]").text()).toContain("Update");
    await addedRow.get("button[aria-label='Move User stack gap up']").trigger("click");
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    expect(wrapper.get("[data-summary-design-nominal]").text()).toBe("-0.17");
    expect(wrapper.get("[data-summary-mean-response]").text()).toBe("-0.15");
    await wrapper.get("#confirm-factor-setup").trigger("click");

    expect(client.confirmFactors).toHaveBeenCalledWith({
      sessionId: "session-01",
      confirmations: [
        expect.objectContaining({
          factorCandidateId: expect.stringMatching(/^[a-f0-9]{64}$/),
          factorName: "User stack gap",
          userAdded: true,
          designNominal: 0.4,
          upperTolerance: 0.08,
          lowerTolerance: -0.04,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
          confirmed: true,
        }),
        expect.objectContaining({ factorCandidateId: HASH_B }),
      ],
    });
    expect(wrapper.findAll(".factor-table tbody tr")).toHaveLength(1);
    expect(wrapper.find("button[data-add-factor]").exists()).toBe(false);
    expect(wrapper.find(".factor-row-control").exists()).toBe(false);
  });

  it("3b.0) supports undo, redo, reset to imported factors, and confirmed clear all", async () => {
    const client = createMockClient(factorSetupSnapshot(), { importWorkbook: factorSetupSnapshot() });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    const undo = wrapper.get("[data-factor-undo]");
    const redo = wrapper.get("[data-factor-redo]");
    const reset = wrapper.get("[data-factor-reset]");
    const clearAll = wrapper.get("[data-factor-clear-all]");
    expect(undo.attributes("disabled")).toBeDefined();
    expect(redo.attributes("disabled")).toBeDefined();

    const nominal = wrapper.get("input[aria-label='C-cover height Design Nominal']");
    await nominal.setValue("-0.8");
    expect(undo.attributes("disabled")).toBeUndefined();
    await undo.trigger("click");
    expect((nominal.element as HTMLInputElement).value).toBe("-0.57");
    expect(redo.attributes("disabled")).toBeUndefined();
    await redo.trigger("click");
    expect((nominal.element as HTMLInputElement).value).toBe("-0.8");

    await reset.trigger("click");
    expect((nominal.element as HTMLInputElement).value).toBe("-0.57");
    await undo.trigger("click");
    expect((nominal.element as HTMLInputElement).value).toBe("-0.8");

    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await clearAll.trigger("click");
    expect(wrapper.findAll(".factor-table tbody tr")).toHaveLength(1);
    await clearAll.trigger("click");
    expect(confirm).toHaveBeenCalledWith("Clear all Factor rows and start with a blank row? You can undo this action.");
    expect(wrapper.findAll(".factor-table tbody tr")).toHaveLength(1);
    const blankRow = wrapper.get(".factor-table tbody tr");
    expect(blankRow.get(".factor-item-number").text()).toBe("1");
    expect((blankRow.get("input[aria-label='New factor name']").element as HTMLInputElement).value).toBe("");
    expect(blankRow.findAll("input.factor-spec-input").map((input) => (input.element as HTMLInputElement).value)).toEqual([
      "", "", "", "1", "4",
    ]);
    expect(wrapper.find("[data-empty-factor-setup]").exists()).toBe(false);
    expect(wrapper.get("#confirm-factor-setup").attributes("disabled")).toBeDefined();

    await undo.trigger("click");
    expect(wrapper.findAll(".factor-table tbody tr")).toHaveLength(1);
    expect((wrapper.get("input[aria-label='C-cover height Design Nominal']").element as HTMLInputElement).value).toBe("-0.8");
    confirm.mockRestore();
  });

  it("3b.1) deleting an existing factor marks a generated dimension chain stale", async () => {
    const base = factorSetupSnapshot();
    const first = base.factors[0]!;
    const snapshot = createSnapshot({
      ...base,
      factors: [
        first,
        {
          factorCandidate: {
            ...first.factorCandidate,
            factorCandidateId: HASH_C,
            factorName: "Second factor",
            sourceRow: first.factorCandidate.sourceRow + 1,
          },
        },
      ],
    });
    const client = createMockClient(snapshot, { importWorkbook: snapshot });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await wrapper.get("[data-generate-dimension-chain]").trigger("click");

    await wrapper.get("button[aria-label='Delete Second factor']").trigger("click");

    expect(wrapper.get("[data-dimension-chain-stale]").text()).toContain("Update");
    expect(wrapper.findAll("[data-dimension-segment]")).toHaveLength(2);
  });

  it("3c) factor capability remains available when Excel volume is missing", async () => {
    const snapshot = factorSetupSnapshot({ includeVolume: false });
    const client = createMockClient(snapshot, { importWorkbook: snapshot });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    const capabilitySummary = wrapper.get("[data-f4-response-summary]");
    expect(capabilitySummary.get("[data-f4-volume]").text()).toBe("—");
    expect(capabilitySummary.get("[data-f4-cpk]").text()).toBe("1.33");
    expect(capabilitySummary.get("[data-f4-total-dpm]").text()).toBe("63");
  });

  it("3d) factor table limits displayed decimals to four places and resizes columns by dragging", async () => {
    const client = createMockClient(factorSetupSnapshot(), { importWorkbook: factorSetupSnapshot() });
    const wrapper = mount(App, { props: { client }, attachTo: document.body });
    await uploadWorkbook(wrapper);

    expect(wrapper.get(".factor-table").classes()).toContain("factor-table-centered");
    expect(wrapper.findAll("col[data-factor-column-index]").map((column) => column.attributes("style"))).toEqual([
      "width: 96px;",
      "width: 168px;",
      "width: 104px;",
      "width: 92px;",
      "width: 92px;",
      "width: 126px;",
      "width: 76px;",
      "width: 102px;",
      "width: 76px;",
      "width: 80px;",
      "width: 72px;",
      "width: 96px;",
      "width: 376px;",
      "width: 88px;",
      "width: 96px;",
    ]);

    const specificationInputs = wrapper.findAll("input.factor-spec-input");
    await specificationInputs[1]!.setValue("0.123456");
    await specificationInputs[2]!.setValue("-0.1");
    await specificationInputs[3]!.setValue("1");
    await specificationInputs[4]!.setValue("3");

    expect(wrapper.get("output[aria-label='C-cover height Mean']").text()).toBe("-0.5817");
    expect(wrapper.get("output[aria-label='C-cover height Tolerance']").text()).toBe("0.1117");
    expect(wrapper.get("output[aria-label='C-cover height 1 Sigma']").text()).toBe("0.0372");
    expect(wrapper.get("output[aria-label='C-cover height Percent Contribution']").text()).toBe("100%");

    const designColumn = wrapper.get("col[data-factor-column-index='2']");
    expect(designColumn.attributes("style")).toContain("width: 104px");
    const resizeHandle = wrapper.get("[aria-label='Resize Design Nominal column']");
    await resizeHandle.trigger("pointerdown", { clientX: 200, pointerId: 1 });
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 248 }));
    window.dispatchEvent(new MouseEvent("pointerup", { clientX: 248 }));
    await wrapper.vm.$nextTick();
    expect(designColumn.attributes("style")).toContain("width: 152px");

    await resizeHandle.trigger("dblclick");
    expect(designColumn.attributes("style")).toContain("width: 104px");
    wrapper.unmount();
  });

  it("4) confirmed factor row shows specifications/source mode/sample/readiness", async () => {
    const client = createMockClient(phaseReadySnapshot(), { importWorkbook: phaseReadySnapshot() });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.text()).toContain("-0.57");
    expect(wrapper.text()).toContain("0.05");
    expect(wrapper.text()).toContain("MEASURED");
    expect(wrapper.text()).toContain("2");
    expect(wrapper.text().toLowerCase()).toContain("ready");
  });

  it("4a) baseline-assumption factors are ready without measurement data", async () => {
    const measured = measurementEntrySnapshot();
    const baselineReady = createSnapshot({
      ...measured,
      status: "phase_1_ready",
      factors: measured.factors.map((factor) => ({
        ...factor,
        sourceMode: "BASELINE_ASSUMPTION" as const,
        input: {
          mode: "BASELINE_ASSUMPTION" as const,
          baselineSampler: factor.evidence!.baselineSampler,
        },
      })),
    });
    const client = createMockClient(baselineReady, { importWorkbook: baselineReady });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.get("tbody .status-chip").text()).toBe("ready");
    expect(wrapper.get("tbody .status-chip").classes()).toContain("chip-ready");
  });

  it("5) only a measured factor can open its dedicated measurement workspace", async () => {
    const measured = measurementEntrySnapshot();
    const baseline = createSnapshot({
      ...measured,
      factors: measured.factors.map((factor) => ({
        ...factor,
        sourceMode: "BASELINE_ASSUMPTION" as const,
        input: {
          mode: "BASELINE_ASSUMPTION" as const,
          baselineSampler: {
            samplerId: "NORMAL_LOCATION_SCALE_V1" as const,
            physicalMean: 1.94,
            standardDeviation: 0.025,
            support: "REAL" as const,
          },
        },
      })),
    });
    const client = createMockClient(measured, { importWorkbook: measured, setFactorMode: baseline });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    expect(wrapper.find("fieldset legend").text()).toContain("Source mode");
    const sourceModeOptions = wrapper.get("fieldset.source-mode-options");
    const sourceModeColumn = wrapper.get("col[data-column-key='sourceMode']");
    const workspaceButton = wrapper.get(`[data-open-measurement='${HASH_C}']`);
    expect(sourceModeColumn.attributes("style")).toContain("width: 376px");
    expect(sourceModeOptions.element.parentElement?.classList).toContain("source-mode-control");
    expect(workspaceButton.element.parentElement?.classList).toContain("measured-workspace-row");
    expect(workspaceButton.element.previousElementSibling?.classList).toContain("source-mode-option");
    expect(sourceModeOptions.findAll("label.source-mode-option")).toHaveLength(2);
    expect(sourceModeOptions.findAll<HTMLInputElement>("label.source-mode-option > input[type='radio']")
      .map((input) => input.element.value)).toEqual(["BASELINE_ASSUMPTION", "MEASURED"]);
    expect(workspaceButton.attributes("disabled")).toBeUndefined();
    await openMeasurementWorkspace(wrapper);
    const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    expect(workspace.text()).toContain("C-cover height");
    expect(workspace.text()).toContain("Measurement Data");
    expect(workspace.text()).toContain("Capability Analysis");
    expect(workspace.text()).toContain("Distribution Fit");
    expect(workspace.text()).toContain("Locked");
    const selectedFactorSetup = workspace.get("table[aria-label='Selected factor setup']");
    expect(selectedFactorSetup.findAll("thead th").map((header) => header.text())).toEqual([
      "Item",
      "Factor",
      "Design Nominal",
      "+ Tol",
      "- Tol",
      "Long Term/Safety Factor",
      "σ Level",
      "Distribution",
      "Mean",
      "Tolerance",
      "1σ",
      "% Cont. to σ",
      "Source Mode",
    ]);
    expect(selectedFactorSetup.text()).toContain("C-cover height");
    expect(selectedFactorSetup.text()).toContain("-0.57");
    expect(selectedFactorSetup.text()).toContain("MEASURED");
    expect(selectedFactorSetup.find("[data-open-measurement]").exists()).toBe(false);
    expect(wrapper.find("[aria-label='Factor setup and source mode']").exists()).toBe(false);
    expect(wrapper.find("[aria-label='Validation summary']").exists()).toBe(false);
    const backButton = workspace.get("button[data-close-measurement]");
    expect(backButton.text()).toBe("Back to factor setup");
    await backButton.trigger("click");
    expect(wrapper.find("[aria-label='Factor setup and source mode']").exists()).toBe(true);
    expect(wrapper.find("[aria-label='Factor measurement workspace']").exists()).toBe(false);
    await wrapper.get("input[value='BASELINE_ASSUMPTION']").trigger("change");
    expect(client.setFactorMode).toHaveBeenCalledWith({ sessionId: "session-01", factorId: HASH_C, mode: "BASELINE_ASSUMPTION" });
    expect(wrapper.get(`[data-open-measurement='${HASH_C}']`).attributes("disabled")).toBeDefined();
  });

  it("5b) nominal sign controls its subtractive/additive color and zero is rejected", async () => {
    const client = createMockClient(factorSetupSnapshot(), {
      importWorkbook: factorSetupSnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    const nominal = wrapper.get("input[aria-label='C-cover height Design Nominal']");
    expect(nominal.classes()).toContain("nominal-negative");
    await nominal.setValue("0.57");
    expect(nominal.classes()).toContain("nominal-positive");
    await nominal.setValue("0");
    expect(wrapper.get("button#confirm-factor-setup").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Design Nominal must be non-zero.");
    await wrapper.get("button#confirm-factor-setup").trigger("click");
    expect(client.confirmFactors).not.toHaveBeenCalled();
  });

  it("5bb) rejects tolerance signs that the factor contract cannot accept", async () => {
    const client = createMockClient(factorSetupSnapshot(), { importWorkbook: factorSetupSnapshot() });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    const factorInputs = wrapper.get(".factor-table tbody tr").findAll("input.factor-spec-input");
    const upperTolerance = factorInputs[1]!;
    const lowerTolerance = factorInputs[2]!;
    await upperTolerance.setValue("-0.1");
    expect(wrapper.get("button#confirm-factor-setup").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("+Tolerance must be non-negative.");

    await upperTolerance.setValue("0.2");
    await lowerTolerance.setValue("0.1");
    expect(wrapper.get("button#confirm-factor-setup").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("-Tolerance must be non-positive.");
    expect(client.confirmFactors).not.toHaveBeenCalled();
  });

  it("5c) factor setup does not expose a measurement workspace before confirmation", async () => {
    const client = createMockClient(factorSetupSnapshot(), { importWorkbook: factorSetupSnapshot() });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.find("[aria-label='Factor measurement workspace']").exists()).toBe(false);
    expect(wrapper.find("[data-open-measurement]").exists()).toBe(false);
  });

  it("5d) selecting measured mode activates the factor workspace button", async () => {
    const measured = measurementEntrySnapshot();
    const pendingMode = createSnapshot({
      ...measured,
      factors: measured.factors.map((factor) => ({
        factorCandidate: factor.factorCandidate,
        setup: factor.setup!,
        evidence: factor.evidence!,
      })),
    });
    const client = createMockClient(pendingMode, { importWorkbook: pendingMode, setFactorMode: measured });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.get(`[data-open-measurement='${HASH_C}']`).attributes("disabled")).toBeDefined();
    await wrapper.get("input[value='MEASURED']").trigger("change");
    expect(client.setFactorMode).toHaveBeenCalledWith({ sessionId: "session-01", factorId: HASH_C, mode: "MEASURED" });
    expect(wrapper.find(`[data-open-measurement='${HASH_C}']`).exists()).toBe(true);
  });

  it("6) uses an indexed measurement table with automatic audit defaults and no MSA or outlier controls", async () => {
    const client = createMockClient(measurementEntrySnapshot(), {
      importWorkbook: measurementEntrySnapshot(),
      pasteMeasurements: phaseReadySnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);

    const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    const specification = workspace.get("[aria-label='Excel specification limits']");
    const measurementBody = workspace.get(".measurement-workspace-body");
    expect(specification.text()).toContain("Factor Specification Limits (Excel)");
    expect(specification.element.nextElementSibling).toBe(measurementBody.element);
    expect(workspace.text()).not.toContain("Source reference");
    expect(workspace.text()).not.toContain("MSA status");
    expect(workspace.text()).not.toContain("Outlier disposition");
    expect(workspace.findAll(".measurement-grid th").map((header) => header.text())).toEqual(["No.", "Measured Value", "Row actions"]);

    const firstRow = workspace.get("input[data-measurement-row='1']");
    await firstRow.setValue("0.494");
    await workspace.get("input[data-measurement-row='2']").setValue("0.503");
    expect(workspace.text()).toContain("2 values");

    await workspace.get("button[data-confirm-measurements]").trigger("click");
    expect(client.pasteMeasurements).toHaveBeenCalledWith({
      sessionId: "session-01",
      factorId: HASH_C,
      structure: "UNORDERED_SAMPLE",
      sourceReference: "local-workbench-entry",
      msaStatus: "unknown",
      text: "0.494\n0.503",
    });
  });

  it("serializes ordered measurements with generated sequence metadata", async () => {
    const client = createMockClient(measurementEntrySnapshot(), {
      importWorkbook: measurementEntrySnapshot(),
      pasteMeasurements: phaseReadySnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);

    const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    await workspace.get("select").setValue("ORDERED_INDIVIDUALS");
    await workspace.get("input[data-measurement-row='1']").setValue("0.494");
    await workspace.get("input[data-measurement-row='2']").setValue("0.503");
    await workspace.get("button[data-confirm-measurements]").trigger("click");

    expect(client.pasteMeasurements).toHaveBeenCalledWith({
      sessionId: "session-01",
      factorId: HASH_C,
      structure: "ORDERED_INDIVIDUALS",
      sourceReference: "local-workbench-entry",
      msaStatus: "unknown",
      text: "value\tsequence\n0.494\t1\n0.503\t2",
    });
  });

  it("clears all measurement rows for a fresh entry", async () => {
    const client = createMockClient(measurementEntrySnapshot(), {
      importWorkbook: measurementEntrySnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);

    const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    const clearButton = workspace.get("button[data-clear-measurements]");
    expect(clearButton.attributes("disabled")).toBeDefined();

    await workspace.get("input[data-measurement-row='1']").setValue("not a measurement");
    await workspace.get("input[data-measurement-row='2']").setValue("0.503");
    expect(clearButton.attributes("disabled")).toBeUndefined();

    await clearButton.trigger("click");
    expect(workspace.text()).toContain("0 values");
    expect(workspace.findAll("input[data-measurement-row]")).toHaveLength(1);
    expect((workspace.get("input[data-measurement-row='1']").element as HTMLInputElement).value).toBe("");
    expect(workspace.get("button[data-confirm-measurements]").attributes("disabled")).toBeDefined();
    expect(clearButton.attributes("disabled")).toBeDefined();
  });

  it("7) calculates capability after confirmed data is ready without considering MSA", async () => {
    const client = createMockClient(measurementEntrySnapshot(), {
      importWorkbook: measurementEntrySnapshot(),
      pasteMeasurements: phaseReadySnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);

    const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    await workspace.get("input[data-measurement-row='1']").setValue("0.494");
    await workspace.get("button[data-confirm-measurements]").trigger("click");
    await vi.waitFor(() => {
      expect(workspace.text()).toContain("Measurement data confirmed");
    });
    expect(workspace.get("button[data-stage='capability']").attributes("disabled")).toBeUndefined();
    expect(workspace.text()).toContain("Sample Size");
    expect(workspace.text()).toContain("2");
    expect(workspace.text()).toContain("Mean");
    expect(workspace.text()).toContain("0.0000");
    expect(workspace.text()).toContain("Sample Std Dev");
    expect(workspace.text()).toContain("0.0141");
    expect(workspace.text()).toContain("Cp");
    expect(workspace.text()).toContain("1.179");
    const specification = workspace.get("[aria-label='Excel specification limits']");
    expect(specification.text()).toContain("Factor Specification Limits (Excel)");
    expect(specification.findAll("dt").map((node) => node.text())).toEqual(["LSL", "USL"]);
    expect(specification.findAll("dd").map((node) => node.text())).toEqual(["0.52 mm", "0.62 mm"]);
    expect(specification.findAll("small").map((node) => node.text())).toEqual([
      "ABS(Anonymous_TA!L15) + Anonymous_TA!N15",
      "ABS(Anonymous_TA!L15) + Anonymous_TA!M15",
    ]);
    expect(workspace.text()).not.toContain("unspecified");
    expect(workspace.text()).toContain("Cpk");
    expect(workspace.text()).not.toContain("MSA");
    expect(workspace.text()).not.toContain("not enabled in Phase 1");
    expect(wrapper.findAll(".workflow-steps li")[2]?.text()).toContain("Current");
  });

  it("8) phase_1_ready banner states readiness without contradicting the available factor capability analysis", async () => {
    const client = createMockClient(phaseReadySnapshot(), { importWorkbook: phaseReadySnapshot() });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.text()).toContain("Phase 1 setup ready");
    expect(wrapper.text()).not.toContain("Capability analysis and Monte Carlo are not executed in this phase");
    expect(wrapper.text()).toContain("Approve the proposed distribution for each measured factor to unlock Monte Carlo.");
    const buttonLabels = wrapper.findAll("button").map((button) => button.text().toLowerCase());
    expect(buttonLabels.some((text) => text.includes("capability") || text.includes("fit") || text.includes("simulation") || text.includes("recommend"))).toBe(false);
  });

  it("8b) unlocks factor step 3, fits on entry, and renders governed comparison results", async () => {
    const client = createMockClient(phaseReadySnapshot(), {
      importWorkbook: phaseReadySnapshot(),
      fitDistribution: distributionFitSnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);

    const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    const fitButton = workspace.get("button[data-stage='distribution']");
    expect(fitButton.attributes("disabled")).toBeUndefined();
    expect(fitButton.element.closest("li")?.textContent).toContain("Available");
    await fitButton.trigger("click");

    expect(client.fitDistribution).toHaveBeenCalledWith({ sessionId: "session-01", factorId: HASH_C });
    await vi.waitFor(() => expect(workspace.find("table.distribution-fit-table").exists()).toBe(true));
    expect(workspace.findAll("table.distribution-fit-table > thead > tr > th").map((header) => header.text())).toEqual([
      "Distribution", "Model / location", "k", "Parameters", "AIC", "AICc", "ΔAICc", "BIC", "ΔBIC", "AD Bootstrap GOF", "Status", "Plot", "Q-Q evidence",
    ]);
    expect(workspace.text()).toContain("Normal");
    expect(workspace.text()).toContain("mean=0.55");
    expect(workspace.text()).not.toContain("Recommended");
    expect(workspace.text()).toContain("Proposed final selection");
    expect(workspace.text()).toContain("Numerically lowest AICc");
    expect(workspace.text()).toContain("Engineering default");
    expect(workspace.text()).toContain("Plausible alternative");
    expect(workspace.text()).toContain("Location fitted");
    expect(workspace.text()).toContain("Location fixed at 0");
    expect(workspace.text()).toContain("B=10000");
    expect(workspace.text()).toContain("95% CI");
    expect(workspace.text()).toContain("F7_BOOTSTRAP_V2");
    expect(workspace.text()).toContain("Refit each replicate");
    expect(workspace.text()).toContain("extreme=5000");
    expect(workspace.text()).toContain("acceptable");
    expect(workspace.text()).toContain("32 points");
    const normalQqTable = workspace.get("[data-qq-family='normal'] table");
    expect(normalQqTable.findAll(":scope > thead > tr > th").map((header) => header.text())).toEqual([
      "Point", "Observed", "Theoretical", "Difference",
    ]);
    const normalQqRows = normalQqTable.findAll(":scope > tbody > tr");
    expect(normalQqRows).toHaveLength(32);
    expect(normalQqRows[0]?.text()).toContain("0.52");
    expect(normalQqRows[0]?.text()).toContain("0.518");
    const normalPlot = workspace.get("[data-distribution-plot='normal']");
    expect(workspace.get("button[data-fit-plot-family='normal']").text()).toBe("Hide plot");
    expect(workspace.find("[data-distribution-plot='lognormal']").exists()).toBe(false);
    expect(workspace.find("[data-distribution-plot='gamma']").exists()).toBe(false);
    expect(normalPlot.attributes("aria-label")).toContain("Normal frequency histogram and fitted expected frequency curve");
    expect(normalPlot.findAll("[data-histogram-bin]")).toHaveLength(6);
    expect(normalPlot.get("[data-fitted-density-curve]").attributes("d")).toContain("L");
    const xAxisTicks = normalPlot.findAll("[data-axis-tick]");
    expect(xAxisTicks).toHaveLength(5);
    expect(xAxisTicks.map((tick) => tick.text())).toEqual(["0.46", "0.51", "0.56", "0.60", "0.65"]);
    const frequencyTicks = normalPlot.findAll("[data-frequency-axis-tick]");
    expect(frequencyTicks).toHaveLength(5);
    expect(frequencyTicks.every((tick) => Number.isInteger(Number(tick.text())))).toBe(true);
    expect(normalPlot.text()).toContain("Frequency (pcs)");
    expect(normalPlot.findAll("[data-reference-line]")).toHaveLength(8);
    const referenceLabels = normalPlot.findAll("[data-reference-label]");
    expect(referenceLabels).toHaveLength(8);
    expect(normalPlot.findAll("[data-reference-label-background]")).toHaveLength(8);
    for (let leftIndex = 0; leftIndex < referenceLabels.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < referenceLabels.length; rightIndex += 1) {
        const left = referenceLabels[leftIndex]!;
        const right = referenceLabels[rightIndex]!;
        if (Math.abs(Number(left.attributes("x")) - Number(right.attributes("x"))) < 48) {
          expect(left.attributes("y")).not.toBe(right.attributes("y"));
        }
      }
    }
    expect(normalPlot.get("[data-distribution-plot-graphic]").find("svg").exists()).toBe(true);
    const explanation = normalPlot.get("[data-distribution-plot-explanation]");
    expect(explanation.element.tagName).toBe("FIGCAPTION");
    expect(explanation.get("[data-plot-legend]").text()).toContain("Observed frequency");
    expect(explanation.get("[data-plot-legend]").text()).toContain("Fitted normal expected frequency");
    expect(explanation.get("[data-plot-legend]").text()).toContain("n = 32");
    expect(explanation.get("[data-plot-references]").findAll("dt").map((node) => node.text())).toEqual([
      "LSL", "USL", "Target", "Mean", "±3σ (sample)", "±4σ (sample)",
    ]);
    expect(explanation.get("[data-plot-references]").findAll("dd").map((node) => node.text())).toEqual([
      "0.52", "0.62", "0.57 (midpoint-derived)", "0.555", "0.0635476", "0.0847301",
    ]);
    await workspace.get("button[data-fit-plot-family='lognormal']").trigger("click");
    expect(workspace.find("[data-distribution-plot='normal']").exists()).toBe(false);
    expect(workspace.find("[data-distribution-plot='lognormal']").exists()).toBe(true);
    expect(workspace.findAll("[data-distribution-plot]")).toHaveLength(1);
    await workspace.get("button[data-fit-plot-family='lognormal']").trigger("click");
    expect(workspace.findAll("[data-distribution-plot]")).toHaveLength(0);
    const conclusion = workspace.get("[data-fit-conclusion]");
    expect(conclusion.text()).toContain("No unique distribution preference");
    expect(conclusion.text()).toContain("Normal, Lognormal, and Gamma are statistically competitive");
    expect(conclusion.text()).toContain("Normal has the numerically lowest AICc");
    expect(conclusion.text()).toContain("Normal is the engineering default");
    expect(conclusion.text()).toContain("Lognormal and Gamma are plausible alternatives");
    expect(conclusion.text()).toContain("Proposed final distribution: Normal");
    expect(conclusion.text()).toContain("engineer confirmation before Monte Carlo");
    expect(conclusion.text()).toContain("LOW confidence");
    expect(conclusion.text()).toContain("Small sample");
    expect(workspace.get("[aria-label='Excel specification limits']").text()).toContain("0.52 mm");

    const workflow = wrapper.findAll("ol.workflow-steps > li");
    expect(workflow[3]?.attributes("aria-current")).toBe("step");
    expect(workflow[4]?.attributes("aria-disabled")).toBe("true");
    expect(workflow[5]?.attributes("aria-disabled")).toBe("true");
  });

  it("8e) approves the proposed model, unlocks Step 5, and submits governed run settings", async () => {
    const fitted = distributionFitSnapshot();
    const approved = approvedDistributionSnapshot();
    const completed = completedMonteCarloSnapshot();
    const client = createMockClient(fitted, {
      importWorkbook: fitted,
      approveDistribution: approved,
      runMonteCarlo: completed,
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);
    await wrapper.get("button[data-stage='distribution']").trigger("click");

    await wrapper.get("button[data-fit-plot-family='normal']").trigger("click");
    expect(wrapper.find("[data-distribution-plot]").exists()).toBe(false);
    await wrapper.get("[data-approve-distribution]").trigger("click");
    expect(client.approveDistribution).toHaveBeenCalledWith({
      sessionId: "session-01",
      factorId: HASH_C,
      family: "normal",
      confirmed: true,
    });
    await wrapper.get("button[data-close-measurement]").trigger("click");
    await vi.waitFor(() => expect(wrapper.find("[data-open-monte-carlo]").exists()).toBe(true));
    expect(wrapper.find("[data-distribution-plot]").exists()).toBe(false);
    expect(wrapper.findAll(".workflow-steps li")[4]?.text()).toContain("Available");

    await wrapper.get("[data-open-monte-carlo]").trigger("click");
    expect(wrapper.get("#monte-carlo-title").text()).toBe("Monte Carlo simulation");
    expect(wrapper.get<HTMLInputElement>("[data-monte-carlo-lsl]").element.value).toBe("-0.15");
    expect(wrapper.get<HTMLInputElement>("[data-monte-carlo-usl]").element.value).toBe("0.05");
    expect(wrapper.get<HTMLInputElement>("[data-monte-carlo-target-sigma]").element.value).toBe("3");
    expect(wrapper.get("[data-monte-carlo-lsl-source]").text()).toContain("P54");
    expect(wrapper.get("[data-monte-carlo-usl-source]").text()).toContain("P55");
    expect(wrapper.get("[data-monte-carlo-target-sigma-source]").text()).toContain("P56");
    expect(wrapper.get("[data-monte-carlo-target-sigma-status]").text()).toBe("Excel default");
    await wrapper.get("[data-monte-carlo-target-sigma]").setValue("0");
    expect(wrapper.get("[data-run-monte-carlo]").attributes("disabled")).toBeDefined();
    await wrapper.get("[data-monte-carlo-target-sigma]").setValue("4");
    expect(wrapper.get("[data-monte-carlo-target-sigma-status]").text()).toBe("Override");
    await wrapper.get("[data-monte-carlo-iterations]").setValue("10000");
    await wrapper.get("[data-monte-carlo-seed]").setValue(HASH_A);
    await wrapper.get("[data-run-monte-carlo]").trigger("submit");

    expect(client.runMonteCarlo).toHaveBeenCalledWith({
      sessionId: "session-01",
      lowerSpecLimit: -0.15,
      upperSpecLimit: 0.05,
      targetSigmaLevel: 4,
      iterations: 10_000,
      runSeed: HASH_A,
      correlationMode: "INDEPENDENT",
    });
    await vi.waitFor(() => expect(wrapper.find("[data-monte-carlo-results]").exists()).toBe(true));
    expect(wrapper.findAll("[data-monte-carlo-bin]")).toHaveLength(20);
    expect(wrapper.findAll("[data-monte-carlo-bin][data-specification-status='in-spec']").length).toBeGreaterThan(0);
    expect(wrapper.findAll("[data-monte-carlo-bin][data-specification-status='out-of-spec']").length).toBeGreaterThan(0);
    expect(wrapper.find("[data-monte-carlo-fit]").exists()).toBe(true);
    expect(wrapper.findAll("[data-monte-carlo-reference]")).toHaveLength(6);
    expect(wrapper.get("[data-reference-id='target']").text()).toContain("Target");
    expect(wrapper.get("[data-normal-model-statistics]").text()).toContain("Expected DPM");
    expect(wrapper.get("[data-observed-defect-statistics]").text()).toContain("Observed PPM");
  });

  it("8f) locks Step 6 without a Monte Carlo result and marks it Available when a result exists", async () => {
    const approved = approvedDistributionSnapshot();
    const withoutResult = mount(App, {
      props: { client: createMockClient(approved, { importWorkbook: approved }) },
    });
    await uploadWorkbook(withoutResult);
    expect(withoutResult.findAll(".workflow-steps li")[5]?.attributes("aria-disabled")).toBe("true");
    expect(withoutResult.findAll(".workflow-steps li")[5]?.text()).toContain("Locked");

    const completed = completedMonteCarloSnapshot();
    const withResult = mount(App, {
      props: { client: createMockClient(completed, { importWorkbook: completed }) },
    });
    await uploadWorkbook(withResult);
    await withResult.get("[data-open-monte-carlo]").trigger("click");
    expect(withResult.findAll(".workflow-steps li")[5]?.attributes("aria-disabled")).toBeUndefined();
    expect(withResult.findAll(".workflow-steps li")[5]?.text()).toContain("Available");
    expect(withResult.findAll(".workflow-steps li")[5]?.text()).not.toContain("Phase 1");
  });

  it("8g) generates the report once on entry and returns to Step 5 without rerunning Monte Carlo", async () => {
    const completed = completedMonteCarloSnapshot();
    const report = reportProjection(completed);
    const generateReport = vi.fn(async ({ sessionId }: { readonly sessionId: string }) => {
      expect(sessionId).toBe("session-01");
      return report;
    });
    const client = createMockClient(completed, { importWorkbook: completed }, generateReport);
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await wrapper.get("[data-open-monte-carlo]").trigger("click");

    expect(wrapper.find("[data-open-report]").exists()).toBe(true);
    expect(wrapper.find("[aria-label='Factor setup and source mode']").exists()).toBe(false);
    (wrapper.vm as unknown as { activeMeasurementFactorId: string }).activeMeasurementFactorId = HASH_C;
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[aria-label='Factor measurement workspace']").exists()).toBe(false);
    expect(wrapper.find("[aria-label='Validation summary']").exists()).toBe(false);
    expect(wrapper.find(".ready-panel").exists()).toBe(false);
    await wrapper.get("[data-open-report]").trigger("click");

    await vi.waitFor(() => expect(wrapper.find("#report-title").exists()).toBe(true));
    expect(wrapper.find("[aria-label='Factor setup and source mode']").exists()).toBe(false);
    (wrapper.vm as unknown as { activeMeasurementFactorId: string }).activeMeasurementFactorId = HASH_C;
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[aria-label='Factor measurement workspace']").exists()).toBe(false);
    expect(generateReport).toHaveBeenCalledTimes(1);
    expect(generateReport).toHaveBeenCalledWith({ sessionId: "session-01" });
    expect(wrapper.findAll(".workflow-steps li")[3]?.text()).toContain("Complete");
    expect(wrapper.findAll(".workflow-steps li")[4]?.text()).toContain("Complete");
    expect(wrapper.findAll(".workflow-steps li")[5]?.attributes("aria-current")).toBe("step");
    expect(wrapper.find("[aria-label='Validation summary']").exists()).toBe(false);
    expect(wrapper.find(".ready-panel").exists()).toBe(false);

    await wrapper.get("[data-report-back]").trigger("click");
    expect(wrapper.find("#report-title").exists()).toBe(false);
    expect(wrapper.find("#monte-carlo-title").exists()).toBe(true);
    expect(client.runMonteCarlo).not.toHaveBeenCalled();

    await wrapper.get("[data-open-report]").trigger("click");
    await vi.waitFor(() => expect(generateReport).toHaveBeenCalledTimes(2));
  });

  it("8h) keeps Step 5 active after report failure and allows a controlled retry", async () => {
    const completed = completedMonteCarloSnapshot();
    const report = reportProjection(completed);
    const generateReport = vi.fn<F7Client["generateReport"]>()
      .mockRejectedValueOnce({
        code: "report_generation_failed",
        summary: "Unable to generate the F7 report.",
        suggestedAction: "Retry report generation.",
        affectedInputReferences: ["session-01"],
      })
      .mockResolvedValueOnce(report);
    const client = createMockClient(completed, { importWorkbook: completed }, generateReport);
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await wrapper.get("[data-open-monte-carlo]").trigger("click");

    await wrapper.get("[data-open-report]").trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("Unable to generate the F7 report."));
    expect(wrapper.find("#monte-carlo-title").exists()).toBe(true);
    expect(wrapper.find("#report-title").exists()).toBe(false);

    await wrapper.get("[data-open-report]").trigger("click");
    await vi.waitFor(() => expect(wrapper.find("#report-title").exists()).toBe(true));
    expect(generateReport).toHaveBeenCalledTimes(2);
  });

  it("8i) disables report entry while generation is busy and ignores a second click", async () => {
    const completed = completedMonteCarloSnapshot();
    const report = reportProjection(completed);
    let resolveReport!: (value: F7ReportProjection) => void;
    const generateReport = vi.fn(() => new Promise<F7ReportProjection>((resolve) => {
      resolveReport = resolve;
    }));
    const client = createMockClient(completed, { importWorkbook: completed }, generateReport);
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await wrapper.get("[data-open-monte-carlo]").trigger("click");

    await wrapper.get("[data-open-report]").trigger("click");
    expect(wrapper.get("[data-open-report]").attributes("disabled")).toBeDefined();
    await wrapper.get("[data-open-report]").trigger("click");
    expect(generateReport).toHaveBeenCalledTimes(1);

    resolveReport(report);
    await vi.waitFor(() => expect(wrapper.find("#report-title").exists()).toBe(true));
  });

  it("8j) does not reopen a deferred report after returning to factors and requests a fresh report next time", async () => {
    const completed = completedMonteCarloSnapshot();
    const report = reportProjection(completed);
    let resolveFirstReport!: (value: F7ReportProjection) => void;
    const generateReport = vi.fn<F7Client["generateReport"]>()
      .mockImplementationOnce(() => new Promise<F7ReportProjection>((resolve) => {
        resolveFirstReport = resolve;
      }))
      .mockResolvedValueOnce(report);
    const client = createMockClient(completed, { importWorkbook: completed }, generateReport);
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await wrapper.get("[data-open-monte-carlo]").trigger("click");

    await wrapper.get("[data-open-report]").trigger("click");
    await wrapper.get(".workspace-close-button").trigger("click");
    resolveFirstReport(report);

    await vi.waitFor(() => expect(wrapper.attributes("aria-busy")).toBe("false"));
    expect(wrapper.find("#report-title").exists()).toBe(false);
    expect(wrapper.findAll(".workflow-steps li")[1]?.attributes("aria-current")).toBe("step");

    await wrapper.get("[data-open-monte-carlo]").trigger("click");
    await wrapper.get("[data-open-report]").trigger("click");
    await vi.waitFor(() => expect(wrapper.find("#report-title").exists()).toBe(true));
    expect(generateReport).toHaveBeenCalledTimes(2);
  });

  it("8k) resets report workflow state only after a new workbook imports successfully", async () => {
    const completed = completedMonteCarloSnapshot();
    const report = reportProjection(completed);
    const imported = createSnapshot({
      status: "worksheet_selection",
      sessionId: "session-02",
      workbook: {
        fileName: "replacement.xlsx",
        workbookContentHash: HASH_B,
      },
    });
    const client = createMockClient(completed, {}, vi.fn(async () => report));
    vi.mocked(client.importWorkbook)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(imported);
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await wrapper.get("[data-open-monte-carlo]").trigger("click");
    await wrapper.get("[data-open-report]").trigger("click");
    await vi.waitFor(() => expect(wrapper.find("#report-title").exists()).toBe(true));
    (wrapper.vm as unknown as { activeMeasurementFactorId: string }).activeMeasurementFactorId = HASH_C;

    await uploadWorkbook(wrapper, new File([new Uint8Array([4, 5, 6])], "replacement.xlsx"));

    await vi.waitFor(() => expect(wrapper.find("[aria-label='Worksheet confirmation']").exists()).toBe(true));
    expect(wrapper.find("#report-title").exists()).toBe(false);
    expect(wrapper.findAll(".workflow-steps li")[0]?.attributes("aria-current")).toBe("step");
    expect((wrapper.vm as unknown as { activeMeasurementFactorId: string }).activeMeasurementFactorId).toBe("");
  });

  it("8ea) keeps Monte Carlo specifications empty when Excel evidence is unavailable", async () => {
    const fitted = distributionFitSnapshot();
    const approved = approvedDistributionSnapshot();
    const unavailable = createSnapshot({
      ...approved,
      systemSpecification: {
        status: "unavailable",
        reasonCode: "legacy_artifact_missing_system_specification",
      },
    });
    const client = createMockClient(fitted, {
      importWorkbook: fitted,
      approveDistribution: unavailable,
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);
    await wrapper.get("button[data-stage='distribution']").trigger("click");
    await wrapper.get("[data-approve-distribution]").trigger("click");
    await wrapper.get("button[data-close-measurement]").trigger("click");
    await vi.waitFor(() => expect(wrapper.find("[data-open-monte-carlo]").exists()).toBe(true));
    await wrapper.get("[data-open-monte-carlo]").trigger("click");

    expect(wrapper.get<HTMLInputElement>("[data-monte-carlo-lsl]").element.value).toBe("");
    expect(wrapper.get<HTMLInputElement>("[data-monte-carlo-usl]").element.value).toBe("");
    expect(wrapper.get<HTMLInputElement>("[data-monte-carlo-target-sigma]").element.value).toBe("");
    expect(wrapper.get("[data-run-monte-carlo]").attributes("disabled")).toBeDefined();
  });

  it("8bb) sorts and highlights proposed final selection independently of API candidate order", async () => {
    const fitted = distributionFitSnapshot();
    const reordered = createSnapshot({
      ...fitted,
      factors: fitted.factors.map((factor) => factor.distributionFitResult ? {
        ...factor,
        distributionFitResult: {
          ...factor.distributionFitResult,
          candidates: [...factor.distributionFitResult.candidates].reverse(),
          selectionDecision: {
            ...factor.distributionFitResult.selectionDecision,
            competitiveFamilies: [...factor.distributionFitResult.selectionDecision.competitiveFamilies].reverse(),
          },
        },
      } : factor),
    });
    const client = createMockClient(reordered, { importWorkbook: reordered });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);
    const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    await workspace.get("button[data-stage='distribution']").trigger("click");

    const candidateRows = workspace.findAll("table.distribution-fit-table > tbody > tr:not(.distribution-plot-row)");
    expect(candidateRows[0]?.text()).toContain("Normal");
    expect(candidateRows[0]?.classes()).toContain("fit-proposed-final");
    expect(candidateRows[0]?.text()).toContain("Proposed final selection");
    expect(candidateRows[1]?.text()).toContain("Gamma");
    expect(candidateRows[2]?.text()).toContain("Lognormal");
    const normalRow = candidateRows.find((row) => row.text().includes("Normal"));
    expect(normalRow?.text()).toContain("Numerically lowest AICc");
    expect(normalRow?.text()).toContain("Engineering default");
  });

  it("collapses distribution plots when the factor workspace is reopened", async () => {
    const fitted = distributionFitSnapshot();
    const client = createMockClient(fitted, { importWorkbook: fitted });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);

    const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    await workspace.get("button[data-stage='distribution']").trigger("click");
    expect(workspace.find("[data-distribution-plot='normal']").exists()).toBe(true);

    await workspace.get("button[data-close-measurement]").trigger("click");
    await openMeasurementWorkspace(wrapper);
    const reopenedWorkspace = wrapper.get("[aria-label='Factor measurement workspace']");
    expect(reopenedWorkspace.find("[data-distribution-plot]").exists()).toBe(false);
    await reopenedWorkspace.get("button[data-stage='distribution']").trigger("click");
    expect(reopenedWorkspace.find("[data-distribution-plot='normal']").exists()).toBe(true);
  });

  it("8e) displays failed candidates and explains why recommendation is withheld", async () => {
    const failed = distributionFitFailureSnapshot();
    const client = createMockClient(failed, { importWorkbook: failed });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);

    const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    await workspace.get("button[data-stage='distribution']").trigger("click");
    expect(workspace.get("[data-failed-candidates]").text()).toContain("Weibull");
    expect(workspace.get("[data-failed-candidates]").text()).toContain("numerical fit failed");
    expect(workspace.get("[data-recommendation-withheld]").text()).toContain("Conclusion withheld");
    expect(workspace.text()).not.toContain("Recommended");
    expect(workspace.text()).not.toContain("Proposed final selection");
  });

  it("8f) explains when no candidate meets the acceptable recommendation threshold", async () => {
    const fitted = distributionFitSnapshot();
    const noRecommendation = createSnapshot({
      ...fitted,
      factors: fitted.factors.map((factor) => factor.distributionFitResult ? {
        ...factor,
        distributionFitResult: {
          ...factor.distributionFitResult,
          candidates: factor.distributionFitResult.candidates.map((candidate) => ({
            ...candidate,
            bootstrap: {
              ...candidate.bootstrap,
              extremeReplicateCount: 100,
              confidenceInterval: {
                level: 0.95 as const,
                method: "wilson_score" as const,
                ...wilsonScoreInterval(100),
              },
              pValue: 101 / 10001,
              status: "rejected" as const,
            },
          })),
          selectionDecision: {
            methodId: "F7_MODEL_SELECTION_V1" as const,
            status: "no_acceptable_model" as const,
            numericBestFamily: undefined,
            competitiveFamilies: [],
            engineeringDefaultFamily: undefined,
            proposedFinalFamily: undefined,
            confidence: "low" as const,
            reasonCodes: ["NO_ACCEPTABLE_MODEL" as const, "SMALL_SAMPLE_UNCERTAINTY" as const],
          },
        },
      } : factor),
    });
    const client = createMockClient(noRecommendation, { importWorkbook: noRecommendation });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);

    const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    await workspace.get("button[data-stage='distribution']").trigger("click");
    expect(workspace.get("[data-no-fit-recommendation]").text()).toContain(
      "No candidate met the acceptable Bootstrap threshold",
    );
    expect(workspace.findAll("[data-distribution-plot]")).toHaveLength(0);
  });

  it("8c) shows factor-scoped distribution fit loading and controlled error states", async () => {
    let rejectFit: ((reason: unknown) => void) | undefined;
    const client = createMockClient(phaseReadySnapshot(), { importWorkbook: phaseReadySnapshot() });
    client.fitDistribution = vi.fn(async () => await new Promise<F7SessionSnapshot>((_resolve, reject) => {
      rejectFit = reject;
    }));
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);
    const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    await workspace.get("button[data-stage='distribution']").trigger("click");
    expect(workspace.get("[data-distribution-fit-loading]").text()).toContain("Fitting candidate distributions");

    rejectFit?.({
      code: "calculation_not_possible",
      summary: "F7 distribution fitting could not be calculated.",
      suggestedAction: "Review measurements.",
      affectedInputReferences: ["f7-session-service"],
    });
    await vi.waitFor(() => {
      expect(workspace.get("[data-distribution-fit-error]").text()).toContain("could not be calculated");
    });
  });

  it("8d) resets rows, stage, fit result, and pending confirmation when switching factors", async () => {
    const snapshot = twoFactorReadySnapshot();
    let resolvePaste: ((value: F7SessionSnapshot) => void) | undefined;
    const client = createMockClient(snapshot, { importWorkbook: snapshot });
    client.pasteMeasurements = vi.fn(async () => await new Promise<F7SessionSnapshot>((resolve) => {
      resolvePaste = resolve;
    }));
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await openMeasurementWorkspace(wrapper);

    let workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    await workspace.get("button[data-stage='distribution']").trigger("click");
    expect(workspace.find("table.distribution-fit-table").exists()).toBe(true);

    await workspace.get("button[data-close-measurement]").trigger("click");
    await wrapper.get(`[data-open-measurement='${HASH_A}']`).trigger("click");
    workspace = wrapper.get("[aria-label='Factor measurement workspace']");
    expect(workspace.text()).toContain("Second factor");
    expect(workspace.find("table.distribution-fit-table").exists()).toBe(false);
    expect(workspace.find(".measurement-grid").exists()).toBe(true);
    expect((workspace.get("input[data-measurement-row='1']").element as HTMLInputElement).value).toBe("2.1");

    await workspace.get("button[data-confirm-measurements]").trigger("click");
    (wrapper.vm as unknown as { onOpenMeasurement: (factorId: string) => void }).onOpenMeasurement(HASH_C);
    await wrapper.vm.$nextTick();
    expect(workspace.text()).toContain("C-cover height");
    expect((workspace.get("input[data-measurement-row='1']").element as HTMLInputElement).value).toBe("-0.01");

    resolvePaste?.(snapshot);
    await vi.waitFor(() => expect(wrapper.attributes("aria-busy")).toBe("false"));
    expect(workspace.find(".measurement-grid").exists()).toBe(true);
    expect(workspace.find(".capability-analysis").exists()).toBe(false);
    expect(workspace.find("table.distribution-fit-table").exists()).toBe(false);
  });

  it("9) workflow rail renders six exact steps, locks 3-6 as non-interactive, and marks step1 current initially", async () => {
    const client = createMockClient(createSnapshot({ status: "worksheet_selection" }), { importWorkbook: createSnapshot({ status: "worksheet_selection" }) });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    const stepLabels = wrapper.findAll("ol.workflow-steps > li .step-label").map((node) => node.text().trim());
    expect(stepLabels).toEqual([
      "Select worksheet",
      "Measurement data",
      "Capability analysis",
      "Distribution fit",
      "Monte Carlo",
      "Report",
    ]);

    const listItems = wrapper.findAll("ol.workflow-steps > li");
    expect(listItems).toHaveLength(6);
    expect(listItems[0]?.attributes("aria-current")).toBe("step");

    for (const index of [2, 3, 4, 5]) {
      const item = listItems[index];
      expect(item?.attributes("aria-disabled")).toBe("true");
      expect(item?.findAll("button, a, input, select, textarea")).toHaveLength(0);
      expect(item?.text().toLowerCase()).toContain("locked");
    }

    const buttonLabels = wrapper.findAll("button").map((button) => button.text());
    expect(buttonLabels.some((text) => /capability|distribution|monte carlo|report/i.test(text))).toBe(false);
  });

  it("9b) workflow rail marks step2 as current during measurement stage", async () => {
    const client = createMockClient(measurementEntrySnapshot(), { importWorkbook: measurementEntrySnapshot() });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    const listItems = wrapper.findAll("ol.workflow-steps > li");
    expect(listItems).toHaveLength(6);
    expect(listItems[0]?.attributes("aria-current")).toBeUndefined();
    expect(listItems[1]?.attributes("aria-current")).toBe("step");
  });

  it("10) aria-live polite validation region and aria-busy with duplicate submission disabled", async () => {
    let resolveImport: ((value: F7SessionSnapshot) => void) | undefined;
    const client: F7Client = {
      importWorkbook: vi.fn(async () => await new Promise<F7SessionSnapshot>((resolve) => { resolveImport = resolve; })),
      confirmWorksheet: vi.fn(async () => factorSetupSnapshot()),
      confirmFactors: vi.fn(async () => measurementEntrySnapshot()),
      setFactorMode: vi.fn(async () => measurementEntrySnapshot()),
      pasteMeasurements: vi.fn(async () => measurementEntrySnapshot()),
      applyMeasurementDisposition: vi.fn(async () => measurementEntrySnapshot()),
      fitDistribution: vi.fn(async () => measurementEntrySnapshot()),
      approveDistribution: vi.fn(async () => measurementEntrySnapshot()),
      runMonteCarlo: vi.fn(async () => measurementEntrySnapshot()),
      generateReport: vi.fn(async () => { throw new Error("Report generation is not used by App tests."); }),
      getSession: vi.fn(async () => createSnapshot({ status: "worksheet_selection" })),
    };
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.attributes("aria-busy")).toBe("true");
    expect(wrapper.get("#workbook-file").attributes("disabled")).toBeDefined();
    const resumeImport = resolveImport;
    if (!resumeImport) {
      throw new Error("import promise resolver is unavailable");
    }
    resumeImport(measurementEntrySnapshot());
    await vi.waitFor(() => {
      expect(wrapper.attributes("aria-busy")).toBe("false");
    });
    const live = wrapper.find("[aria-live='polite']");
    expect(live.exists()).toBe(true);
  });

  it("11) controlled error message visible and retry removes raw message leak", async () => {
    const client: F7Client = {
      importWorkbook: vi.fn()
        .mockRejectedValueOnce({
          code: "validation_error",
          summary: "F7 request is invalid.",
          suggestedAction: "Use the documented DTO.",
          affectedInputReferences: ["f7-local-api"],
          rawMessage: "secret stack trace",
        })
        .mockResolvedValueOnce(createSnapshot({ status: "worksheet_selection" })),
      confirmWorksheet: vi.fn(async () => factorSetupSnapshot()),
      confirmFactors: vi.fn(async () => measurementEntrySnapshot()),
      setFactorMode: vi.fn(async () => measurementEntrySnapshot()),
      pasteMeasurements: vi.fn(async () => measurementEntrySnapshot()),
      applyMeasurementDisposition: vi.fn(async () => measurementEntrySnapshot()),
      fitDistribution: vi.fn(async () => measurementEntrySnapshot()),
      approveDistribution: vi.fn(async () => measurementEntrySnapshot()),
      runMonteCarlo: vi.fn(async () => measurementEntrySnapshot()),
      generateReport: vi.fn(async () => { throw new Error("Report generation is not used by App tests."); }),
      getSession: vi.fn(async () => createSnapshot({ status: "worksheet_selection" })),
    };
    const wrapper = mount(App, { props: { client } });
    const file = new File([new Uint8Array([1, 2, 3])], "demo.xlsx");
    await uploadWorkbook(wrapper, file);

    expect(wrapper.text()).toContain("F7 request is invalid.");
    expect(wrapper.text()).not.toContain("secret stack trace");

    await uploadWorkbook(wrapper, file);
    await vi.waitFor(() => {
      expect(wrapper.text()).not.toContain("F7 request is invalid.");
    });
  });

  it("12) missing session actions surface controlled prerequisite error without native text", async () => {
    const client = createMockClient(createSnapshot({ status: "worksheet_selection" }));
    const wrapper = mount(App, { props: { client } });

    await (wrapper.vm as unknown as { onConfirmWorksheet: (name: string) => Promise<void> }).onConfirmWorksheet("Anonymous_TA");

    expect(wrapper.text()).toContain("Import a workbook before continuing.");
    expect(wrapper.text()).not.toContain("Session is not available");
    expect(wrapper.text()).not.toContain("missing session");
  });
});