import {
  f6OptimizationRequestSchema,
  f6OptimizationResultSchema,
  type CalculationCompletedResult,
  type CalculationFactorResult,
  type CalculationRequest,
  type F6ControlledScenario,
  type F6OptimizationRequest,
  type F6OptimizationResult,
  type F6Option,
  type F6OptionKind,
  type F6ToleranceChange,
} from "@ai-assist/contracts";
import { apportionRssTolerance } from "./f6-apportionment.js";
import {
  assessCost,
  assessDatumScenario,
  assessSupplierScenario,
  assessToleranceFeasibility,
} from "./f6-feasibility.js";
import { calculateF6Scenario } from "./f6-scenario-adapter.js";
import {
  createReverseSolveResult,
  scaleToleranceBandAroundCenter,
  selectTopContributors,
  solveCenteringShift,
  solveSingleFactorTolerance,
  solveTargetRssSigma,
  solveTopNCombinedTolerance,
} from "./f6-solver.js";

type CompletedOption = Extract<F6Option, { status: "completed" }>;
type FailedOption = Extract<F6Option, { status: "calculation_failed" }>;
type ReadyWorksheet = Extract<F6OptimizationResult["worksheets"][number], { status: "completed" | "partially_completed" }>;

interface OptimizationDependencies {
  readonly calculateScenario?: typeof calculateF6Scenario;
}

const NUMERIC_OPTION_KINDS = [
  "reduce_top_contributor_20",
  "reduce_top_3_contributors_30",
  "mean_shift_centering",
  "reverse_solve_single_factor",
  "reverse_solve_top_3",
  "rss_apportionment",
  "centering_plus_tighten",
] as const;

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function immutable<Value>(value: Value): Value {
  return deepFreeze(structuredClone(value));
}

function availableText(rawText: string, sourceCell: string) {
  return { status: "available" as const, rawText, sourceCell };
}

function availableNumber(value: number, sourceCell: string, unit: string) {
  return { status: "available" as const, rawText: String(value), sourceCell, numericValue: value, unit };
}

function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function reconstructBaselineRequest(baseline: CalculationCompletedResult): CalculationRequest {
  const worksheetName = baseline.worksheetSelection.worksheetName;
  const tableId = baseline.worksheetSelection.tableId;
  const rows = baseline.factors.map((factor, index) => {
    const row = factor.source.sourceRow;
    const cell = (column: number) => `${worksheetName}!${columnName(column)}${row}`;
    return {
      sourceRow: row,
      fields: {
        factorName: availableText(factor.factorName, cell(0)),
        nominalValue: availableNumber(factor.input.nominalValue, cell(1), factor.unit),
        upperTolerance: availableNumber(factor.input.upperTolerance, cell(2), factor.unit),
        lowerTolerance: availableNumber(factor.input.lowerTolerance, cell(3), factor.unit),
        longTermSafetyFactor: availableNumber(factor.input.longTermSafetyFactor, cell(4), factor.unit),
        standardDeviation: availableNumber(factor.sigma, cell(5), factor.unit),
        distribution: availableText(factor.input.distribution, cell(6)),
        unit: availableText(factor.unit, cell(7)),
      },
    };
  });
  const sourceRows = rows.map(({ sourceRow }) => sourceRow);
  return {
    contractVersion: baseline.contractVersion,
    inputClassification: "confidential",
    projectReference: baseline.projectReference,
    runReference: baseline.runReference,
    worksheetAnalysisAssets: {
      contractVersion: baseline.contractVersion,
      workbook: { classification: "confidential", contentHash: baseline.workbookContentHash, catalogContractVersion: "v1" },
      worksheets: [{
        worksheetName,
        toleranceLoopDescription: "controlled-f6-baseline",
        factorTables: [{
          tableId,
          headerRow: Math.max(1, Math.min(...sourceRows) - 1),
          dataRange: { startRow: Math.min(...sourceRows), endRow: Math.max(...sourceRows) },
          columns: [
            { semanticField: "factorName", headerText: "Factor", sourceColumn: "A" },
            { semanticField: "nominalValue", headerText: "Nominal", sourceColumn: "B" },
            { semanticField: "upperTolerance", headerText: "Upper", sourceColumn: "C" },
            { semanticField: "lowerTolerance", headerText: "Lower", sourceColumn: "D" },
            { semanticField: "longTermSafetyFactor", headerText: "LTSF", sourceColumn: "E" },
            { semanticField: "standardDeviation", headerText: "Sigma", sourceColumn: "F" },
            { semanticField: "distribution", headerText: "Distribution", sourceColumn: "G" },
            { semanticField: "unit", headerText: "Unit", sourceColumn: "H" },
          ],
          rows,
        }],
        formulaCells: [],
        imageAssets: [],
      }],
    },
    requiredFieldCheck: {
      contractVersion: baseline.contractVersion,
      inputClassification: "confidential",
      workbookContentHash: baseline.workbookContentHash,
      status: "readyForNextCheck",
      blockingIssues: [],
      advisoryIssues: [],
      summary: {
        worksheetsChecked: 1,
        factorTablesChecked: 1,
        factorRowsChecked: rows.length,
        blockingIssueCount: 0,
        advisoryIssueCount: 0,
      },
    },
    exceptionResolution: {
      contractVersion: baseline.contractVersion,
      inputClassification: "confidential",
      workbookContentHash: baseline.workbookContentHash,
      knowledgeBaseVersion: "v1",
      status: "readyToContinue",
      readyToContinue: true,
      acceptedExceptions: [],
      pendingExceptions: [],
      summary: { actionableSignalCount: 0, acceptedExceptionCount: 0, pendingExceptionCount: 0, invalidCandidateCount: 0 },
    },
    worksheetSelection: structuredClone(baseline.worksheetSelection),
    systemSpecification: {
      designNominal: baseline.system.designNominal,
      lowerSpecLimit: baseline.capability.lowerSpecLimit,
      upperSpecLimit: baseline.capability.upperSpecLimit,
      targetSigmaLevel: baseline.capability.targetSigmaLevel,
      targetCpk: baseline.capability.targetCpk,
      additionalMeanShift: baseline.system.additionalMeanShift,
    },
    criticality: baseline.recommendation.criticality,
    scenarioOverrides: [],
  };
}

function metrics(calculation: Pick<CalculationCompletedResult, "system" | "capability">) {
  return {
    mean: calculation.system.mean,
    rssSigma: calculation.system.rssSigma,
    cp: calculation.capability.cp,
    cpk: calculation.capability.cpk,
    yield: calculation.capability.yield,
    dpm: calculation.capability.totalDpm,
  };
}

function f4ArtifactReference(request: F6OptimizationRequest) {
  return { artifact: request.f4Reference.artifact, contentHash: request.f4Reference.contentHash };
}

function factorOverride(change: F6ToleranceChange) {
  return {
    worksheetName: change.worksheetName,
    tableId: change.tableId,
    sourceRow: change.sourceRow,
    lowerTolerance: change.resultingLowerTolerance,
    upperTolerance: change.resultingUpperTolerance,
  };
}

function scaledChange(factor: CalculationFactorResult, scale: number): F6ToleranceChange {
  const scaled = scaleToleranceBandAroundCenter({
    lowerTolerance: factor.input.lowerTolerance,
    upperTolerance: factor.input.upperTolerance,
    scale,
  });
  return {
    worksheetName: factor.source.worksheetName,
    tableId: factor.source.tableId,
    sourceRow: factor.source.sourceRow,
    originalLowerTolerance: factor.input.lowerTolerance,
    originalUpperTolerance: factor.input.upperTolerance,
    resultingLowerTolerance: scaled.lowerTolerance,
    resultingUpperTolerance: scaled.upperTolerance,
    originalBand: scaled.originalBand,
    resultingBand: scaled.resultingBand,
    bandCenter: scaled.center,
  };
}

function completedOption(
  request: F6OptimizationRequest,
  baseline: CalculationCompletedResult,
  scenarioResult: CalculationCompletedResult,
  scenario: F6ControlledScenario,
  toleranceChanges: readonly F6ToleranceChange[],
  extra: Pick<CompletedOption, "feasibility"> & Partial<Pick<CompletedOption, "reverseSolve" | "apportionment">>,
): CompletedOption {
  const scenarioCalculation = scenarioResult.scenarios.at(-1)?.calculation;
  if (scenarioCalculation === undefined || scenarioResult.scenarios.at(-1)?.scenarioId !== scenario.scenarioId) {
    throw new Error("controlled scenario result missing");
  }
  const baselineMetrics = metrics(baseline);
  const resultMetrics = metrics(scenarioCalculation);
  const cost = assessCost({ evidence: request.costEvidence, optionKind: scenario.optionKind });
  return {
    status: "completed",
    optionId: scenario.scenarioId,
    optionKind: scenario.optionKind,
    baselineMetrics,
    resultMetrics,
    deltaCpk: resultMetrics.cpk - baselineMetrics.cpk,
    deltaCp: resultMetrics.cp - baselineMetrics.cp,
    deltaRssSigma: resultMetrics.rssSigma - baselineMetrics.rssSigma,
    deltaDpm: resultMetrics.dpm - baselineMetrics.dpm,
    deltaYield: resultMetrics.yield - baselineMetrics.yield,
    factorOverrides: structuredClone(scenario.factorOverrides),
    toleranceChanges: structuredClone([...toleranceChanges]),
    ...extra,
    evidenceReferences: [f4ArtifactReference(request)],
    relativeCost: cost.relativeCost,
    roiScore: "not_computed",
    impactRank: null,
    calculationTrace: { artifact: request.f4Reference.artifact, contentHash: request.f4Reference.contentHash },
  };
}

function failure(optionKind: F6OptionKind, worksheetName: string, error: unknown): FailedOption {
  const reasonCode = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "controlled_option_calculation_failed";
  return {
    status: "calculation_failed",
    optionId: `${worksheetName}:${optionKind}`,
    optionKind,
    reasonCode,
    evidenceReferences: [],
    impactRank: null,
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function feasibilityRank(option: CompletedOption): number {
  return { supported: 4, requires_engineering_review: 3, insufficient_evidence: 2, not_supported: 1 }[option.feasibility.status];
}

function rankOptions(options: F6Option[], targetCpk: number): F6Option[] {
  const completed = options.filter((option): option is CompletedOption => option.status === "completed");
  const ordered = [...completed].sort((left, right) =>
    Number(right.resultMetrics.cpk >= targetCpk) - Number(left.resultMetrics.cpk >= targetCpk)
    || right.deltaCpk - left.deltaCpk
    || (-right.deltaDpm) - (-left.deltaDpm)
    || right.deltaYield - left.deltaYield
    || feasibilityRank(right) - feasibilityRank(left)
    || compareText(left.optionId, right.optionId));
  const ranks = new Map(ordered.map((option, index) => [option.optionId, index + 1]));
  return options.map((option) => option.status === "completed"
    ? { ...option, impactRank: ranks.get(option.optionId)! }
    : option);
}

function buildNumericOption(
  kind: (typeof NUMERIC_OPTION_KINDS)[number],
  request: F6OptimizationRequest,
  baselineRequest: CalculationRequest,
  baseline: CalculationCompletedResult,
  top: readonly CalculationFactorResult[],
  targetCpk: number,
  calculateScenario: typeof calculateF6Scenario,
): CompletedOption {
  const optionId = `${baseline.worksheetSelection.worksheetName}:${kind}`;
  let changes: readonly F6ToleranceChange[] = [];
  let systemSpecification: F6ControlledScenario["systemSpecification"];
  let reverseSolve: CompletedOption["reverseSolve"];
  let apportionment: CompletedOption["apportionment"];

  if (kind === "reduce_top_contributor_20") changes = [scaledChange(top[0]!, 0.8)];
  if (kind === "reduce_top_3_contributors_30") changes = top.map((factor) => scaledChange(factor, 0.7));
  if (kind === "mean_shift_centering" || kind === "centering_plus_tighten") {
    const centering = solveCenteringShift({
      lowerSpecLimit: baseline.capability.lowerSpecLimit,
      upperSpecLimit: baseline.capability.upperSpecLimit,
      factorMeans: baseline.factors.map(({ mean }) => mean),
    });
    systemSpecification = { additionalMeanShift: centering.additionalMeanShift };
  }
  if (kind.startsWith("reverse_solve") || kind === "rss_apportionment" || kind === "centering_plus_tighten") {
    const targetMean = systemSpecification === undefined
      ? baseline.system.mean
      : (baseline.capability.lowerSpecLimit + baseline.capability.upperSpecLimit) / 2;
    const targetRssSigma = solveTargetRssSigma({
      lowerSpecLimit: baseline.capability.lowerSpecLimit,
      upperSpecLimit: baseline.capability.upperSpecLimit,
      mean: targetMean,
      targetCpk,
    });
    if (kind === "reverse_solve_single_factor") {
      changes = [solveSingleFactorTolerance({ factors: baseline.factors, selectedSource: top[0]!.source, targetRssSigma })];
    } else {
      changes = solveTopNCombinedTolerance({
        factors: baseline.factors,
        selectedSources: top.map(({ source }) => source),
        targetRssSigma,
        allocation: kind === "reverse_solve_top_3" ? "equal-allocation-among-top-N" : "proportional-to-contribution",
      });
    }
    const strategy = kind === "reverse_solve_single_factor"
      ? "single-factor"
      : kind === "reverse_solve_top_3"
        ? "top-3"
        : kind === "rss_apportionment"
          ? "rss-apportionment"
          : "centering-plus-tighten";
    reverseSolve = createReverseSolveResult({ targetCpk, targetRssSigma, strategy, toleranceChanges: [...changes], residualError: 0 });
    if (kind === "rss_apportionment") {
      apportionment = apportionRssTolerance({
        factors: baseline.factors,
        targetRssSigma,
        policy: "proportional-to-contribution",
        selectedSources: top.map(({ source }) => source),
      });
    }
  }

  const scenario: F6ControlledScenario = {
    scenarioId: optionId,
    optionKind: kind,
    factorOverrides: changes.map(factorOverride),
    ...(systemSpecification === undefined ? {} : { systemSpecification }),
  };
  const scenarioResult = calculateScenario({ baselineRequest, scenario });
  const requestedBand = changes.length === 0 ? Number.NaN : Math.min(...changes.map(({ resultingBand }) => resultingBand));
  const supplierEvidence = request.supplierCapabilityEvidence?.[0];
  const feasibility = changes.length === 0
    ? { status: "supported" as const, reasonCodes: ["controlled_centering_calculation_completed"], evidenceReferences: [] }
    : assessToleranceFeasibility({ evidence: supplierEvidence, requestedToleranceBand: requestedBand });
  return completedOption(request, baseline, scenarioResult, scenario, changes, {
    feasibility,
    ...(reverseSolve === undefined ? {} : { reverseSolve }),
    ...(apportionment === undefined ? {} : { apportionment }),
  });
}

function optimizeWorksheet(
  request: F6OptimizationRequest,
  worksheet: F6OptimizationRequest["worksheets"][number],
  calculateScenario: typeof calculateF6Scenario,
): F6OptimizationResult["worksheets"][number] {
  const baseline = worksheet.baselineCalculation;
  const baselineRequest = reconstructBaselineRequest(baseline);
  const top = selectTopContributors(baseline.factors, Math.min(3, baseline.factors.length));
  const targetCapability = baseline.capability.targetCpk > 0 && baseline.capability.targetSigmaLevel > 0
    ? { targetCpk: baseline.capability.targetCpk, targetSigmaLevel: baseline.capability.targetSigmaLevel, source: "worksheet" as const }
    : { targetCpk: 1.33, targetSigmaLevel: 4, source: "controlled_default" as const };
  const options: F6Option[] = NUMERIC_OPTION_KINDS.map((kind) => {
    try {
      return buildNumericOption(kind, request, baselineRequest, baseline, top, targetCapability.targetCpk, calculateScenario);
    } catch (error) {
      return failure(kind, worksheet.worksheetName, error);
    }
  });
  options.push(
    assessSupplierScenario({ evidence: request.supplierCapabilityEvidence?.[0] }).option,
    assessDatumScenario({ evidence: request.datumEvidence?.[0] }).option,
  );
  const completedCount = options.filter(({ status }) => status === "completed").length;
  if (completedCount === 0) {
    return {
      worksheetName: worksheet.worksheetName,
      status: "input_rejected",
      inputFindings: [{
        findingCode: "all_controlled_options_failed",
        severity: "Critical",
        message: "Controlled optimization calculations could not be completed.",
        evidenceReferences: [f4ArtifactReference(request)],
      }],
      options: [],
      risks: [],
      clarifications: [],
    };
  }
  const ranked = rankOptions(options, targetCapability.targetCpk);
  const highest = ranked.find((option) => option.status === "completed" && option.impactRank === 1) as CompletedOption | undefined;
  const recommendations = ranked
    .filter((option): option is CompletedOption => option.status === "completed")
    .map((option) => ({
      recommendationId: `recommend:${option.optionId}`,
      optionId: option.optionId,
      text: `Review controlled option ${option.optionKind}.`,
      evidenceReferences: [f4ArtifactReference(request)],
    }));
  const result: ReadyWorksheet = {
    worksheetName: worksheet.worksheetName,
    status: ranked.some(({ status }) => status === "calculation_failed") ? "partially_completed" : "completed",
    baselineMetrics: metrics(baseline),
    targetCapability,
    inputFindings: structuredClone(worksheet.f2Findings),
    options: ranked,
    risks: [],
    recommendations,
    ...(highest === undefined ? {} : {
      highestImpactAction: { optionId: highest.optionId, rationale: "Highest deterministic impact rank among completed options." },
    }),
    roiStatus: "not_computed",
    clarifications: [
      {
        clarificationId: `${worksheet.worksheetName}:supplier-evidence`,
        reasonCode: "supplier_scenario_evidence_closure_required",
        requiredInputs: ["confirmed_supplier_capability_evidence", "controlled_scenario_inputs"],
        questionForReviewer: "Provide governed supplier capability evidence and controlled scenario inputs.",
        evidenceReferences: [],
      },
      {
        clarificationId: `${worksheet.worksheetName}:datum-evidence`,
        reasonCode: "datum_scenario_evidence_closure_required",
        requiredInputs: ["confirmed_datum_chain_evidence", "controlled_scenario_inputs"],
        questionForReviewer: "Provide confirmed datum-chain evidence and controlled scenario inputs.",
        evidenceReferences: [],
      },
    ],
  };
  return result;
}

export function createF6Optimization(input: unknown, dependencies: OptimizationDependencies = {}): F6OptimizationResult {
  const request = f6OptimizationRequestSchema.parse(input);
  const calculateScenario = dependencies.calculateScenario ?? calculateF6Scenario;
  const worksheets = request.worksheets.map((worksheet) => optimizeWorksheet(request, worksheet, calculateScenario));
  const options = worksheets.flatMap((worksheet) => worksheet.options);
  const summary = {
    worksheetCount: worksheets.length,
    completedWorksheetCount: worksheets.filter(({ status }) => status === "completed").length,
    partiallyCompletedWorksheetCount: worksheets.filter(({ status }) => status === "partially_completed").length,
    inputRejectedWorksheetCount: worksheets.filter(({ status }) => status === "input_rejected").length,
    completedOptionCount: options.filter(({ status }) => status === "completed").length,
    calculationFailedOptionCount: options.filter(({ status }) => status === "calculation_failed").length,
    insufficientEvidenceOptionCount: options.filter(({ status }) => status === "insufficient_evidence").length,
  };
  const status = summary.inputRejectedWorksheetCount === worksheets.length
    ? "input_rejected"
    : summary.partiallyCompletedWorksheetCount > 0 || summary.inputRejectedWorksheetCount > 0
      ? "partially_completed"
      : "completed";
  return immutable(f6OptimizationResultSchema.parse({
    contractVersion: request.contractVersion,
    outputClassification: "confidential",
    featureId: "F6",
    status,
    optimizationVersion: "f6-optimization-v1",
    workbook: request.workbook,
    worksheets,
    summary,
    provenance: {
      f2Reference: request.f2Reference,
      f3Reference: request.f3Reference,
      f4Reference: request.f4Reference,
      f5Reference: request.f5Reference,
      f0Versions: request.f0Versions,
      scenarioPolicyVersion: request.scenarioPolicyVersion,
      ...(request.imageObservationReference === undefined ? {} : { imageObservationReference: request.imageObservationReference }),
      ...(request.supplierCapabilityEvidence === undefined ? {} : { supplierCapabilityEvidence: request.supplierCapabilityEvidence }),
      ...(request.datumEvidence === undefined ? {} : { datumEvidence: request.datumEvidence }),
      ...(request.costEvidence === undefined ? {} : { costEvidence: request.costEvidence }),
    },
  }));
}