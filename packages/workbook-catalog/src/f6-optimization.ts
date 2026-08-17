import {
  calculationRequestSchema,
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
  type F6SupplierCapabilityEvidence,
  type F6ToleranceChange,
} from "@ai-assist/contracts";
import { createCalculation } from "./calculation.js";
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
type ReadyWorksheet = Extract<F6OptimizationResult["worksheets"][number], { status: "completed" | "partially_completed" | "calculation_failed" }>;

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

function equivalent(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
  }
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return left === right;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => equivalent(value, right[index]));
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.hasOwn(rightRecord, key) && equivalent(leftRecord[key], rightRecord[key]));
}

function verifiedBaselineRequest(
  request: CalculationRequest,
  expected: CalculationCompletedResult,
): CalculationRequest {
  const parsed = calculationRequestSchema.parse(request);
  const actual = createCalculation(parsed);
  if (actual.status !== "completed" || !equivalent(actual, expected)) {
    throw new Error("F6 baseline calculation request does not reproduce the governed baseline result.");
  }
  return parsed;
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
  evidenceReferences: CompletedOption["evidenceReferences"] = [],
): CompletedOption {
  const scenarioCalculation = scenarioResult.scenarios.at(-1)?.calculation;
  if (scenarioCalculation === undefined || scenarioResult.scenarios.at(-1)?.scenarioId !== scenario.scenarioId) {
    throw new Error("controlled scenario result missing");
  }
  const baselineMetrics = metrics(baseline);
  const resultMetrics = metrics(scenarioCalculation);
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
    evidenceReferences: [f4ArtifactReference(request), ...structuredClone(evidenceReferences)],
    relativeCost: "insufficient_evidence",
    roiScore: "not_computed",
    impactRank: null,
    scenarioEvidence: { scenarioId: scenario.scenarioId, calculation: structuredClone(scenarioResult) },
    closedRiskIds: [],
  };
}

function applyCostAssessment(request: F6OptimizationRequest, option: F6Option): F6Option {
  const cost = assessCost({ evidence: request.costEvidence, optionKind: option.optionKind });
  const referencesByIdentity = new Map(
    [...option.evidenceReferences, ...cost.evidenceReferences].map((reference) => [
      `${reference.artifact}\u0000${reference.contentHash}`,
      reference,
    ]),
  );
  const evidenceReferences = [...referencesByIdentity.values()];
  return option.status === "completed"
    ? { ...option, relativeCost: cost.relativeCost, evidenceReferences }
    : { ...option, evidenceReferences };
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

function verifiedRiskClosure(option: CompletedOption, risk: ReadyWorksheet["risks"][number], targetCpk: number): boolean {
  return risk.status === "closed"
    || (risk.riskId.endsWith(":f5:capability-below-target") && option.resultMetrics.cpk >= targetCpk);
}

export function rankCompletedOptions(
  options: F6Option[],
  targetCpk: number,
  risks: ReadyWorksheet["risks"],
): F6Option[] {
  const completed = options.filter((option): option is CompletedOption => option.status === "completed");
  const riskById = new Map(risks.map((risk) => [risk.riskId, risk]));
  const closureScore = (option: CompletedOption) => option.closedRiskIds.reduce((score, riskId) => {
    const risk = riskById.get(riskId);
    if (risk === undefined || !verifiedRiskClosure(option, risk, targetCpk)) return score;
    return score + ({ Critical: 2, High: 1, Medium: 0, Low: 0 }[risk.rating]);
  }, 0);
  const ordered = [...completed].sort((left, right) =>
    Number(right.resultMetrics.cpk >= targetCpk) - Number(left.resultMetrics.cpk >= targetCpk)
    || right.deltaCpk - left.deltaCpk
    || left.deltaDpm - right.deltaDpm
    || right.deltaYield - left.deltaYield
    || closureScore(right) - closureScore(left)
    || feasibilityRank(right) - feasibilityRank(left)
    || compareText(left.optionId, right.optionId));
  const ranks = new Map(ordered.map((option, index) => [option.optionId, index + 1]));
  return options.map((option) => option.status === "completed"
    ? { ...option, impactRank: ranks.get(option.optionId)! }
    : option);
}

export function selectHighestSupportedCompletedOption(options: readonly F6Option[]): CompletedOption | undefined {
  return options.reduce<CompletedOption | undefined>((highest, option) => {
    if (option.status !== "completed" || option.feasibility.status !== "supported" || option.impactRank === null) {
      return highest;
    }
    return highest === undefined || highest.impactRank === null || option.impactRank < highest.impactRank
      ? option
      : highest;
  }, undefined);
}

function sourceKey(source: { readonly tableId: string; readonly sourceRow: number }): string {
  return `${source.tableId}\u0000${source.sourceRow}`;
}

function combineFeasibility(assessments: CompletedOption["feasibility"][]): CompletedOption["feasibility"] {
  const statusRank = { supported: 4, requires_engineering_review: 3, insufficient_evidence: 2, not_supported: 1 } as const;
  const status = assessments.reduce((worst, assessment) =>
    statusRank[assessment.status] < statusRank[worst] ? assessment.status : worst,
  "supported" as CompletedOption["feasibility"]["status"]);
  return {
    status,
    reasonCodes: [...new Set(assessments.flatMap(({ reasonCodes }) => reasonCodes))],
    evidenceReferences: [...new Set(assessments.flatMap(({ evidenceReferences }) => evidenceReferences))],
  };
}

function applyGovernedRoi(options: F6Option[]): Pick<ReadyWorksheet, "options" | "roiStatus"> {
  const rankedSupported = options.filter((option): option is CompletedOption => option.status === "completed"
    && option.feasibility.status === "supported" && option.impactRank !== null);
  const canCompute = rankedSupported.length > 0 && rankedSupported.every(({ relativeCost }) =>
    typeof relativeCost === "number" && relativeCost > 0);
  const rankedSupportedIds = new Set(rankedSupported.map(({ optionId }) => optionId));
  return {
    options: options.map((option): F6Option => {
      if (option.status !== "completed" || !canCompute || !rankedSupportedIds.has(option.optionId)) {
        return option.status === "completed" ? { ...option, roiScore: "not_computed" } : option;
      }
      const relativeCost = option.relativeCost;
      if (typeof relativeCost !== "number" || relativeCost <= 0) return { ...option, roiScore: "not_computed" };
      return { ...option, roiScore: Math.max(option.deltaCpk, 0) / relativeCost };
    }),
    roiStatus: canCompute ? "computed" : "not_computed",
  };
}

function buildNumericOption(
  kind: (typeof NUMERIC_OPTION_KINDS)[number],
  request: F6OptimizationRequest,
  baselineRequest: CalculationRequest,
  baseline: CalculationCompletedResult,
  top: readonly CalculationFactorResult[],
  targetCpk: number,
  calculateScenario: typeof calculateF6Scenario,
  supplierEvidenceBySource: ReadonlyMap<string, F6SupplierCapabilityEvidence>,
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
  const altersMeanShift = kind === "mean_shift_centering" || kind === "centering_plus_tighten";
  const meanShiftFeasibility: CompletedOption["feasibility"] = {
    status: "requires_engineering_review",
    reasonCodes: ["mean_shift_physical_constraint_unverified"],
    evidenceReferences: [request.f4Reference.artifact, request.f5Reference.artifact],
  };
  const toleranceFeasibility = changes.map((change) => assessToleranceFeasibility({
      requestedToleranceBand: change.resultingBand,
      evidence: supplierEvidenceBySource.get(sourceKey(change)),
    }));
  const feasibility = kind === "mean_shift_centering"
    ? meanShiftFeasibility
    : kind === "centering_plus_tighten"
      ? combineFeasibility([meanShiftFeasibility, ...toleranceFeasibility])
      : combineFeasibility(toleranceFeasibility);
  const supplierReferences = changes.flatMap((change) => {
    const evidence = supplierEvidenceBySource.get(sourceKey(change));
    return evidence === undefined ? [] : [{ artifact: evidence.source, contentHash: evidence.contentHash }];
  });
  return completedOption(request, baseline, scenarioResult, scenario, changes, {
    feasibility,
    ...(reverseSolve === undefined ? {} : { reverseSolve }),
    ...(apportionment === undefined ? {} : { apportionment }),
  }, [
    ...(altersMeanShift
      ? [{ artifact: request.f5Reference.artifact, contentHash: request.f5Reference.contentHash }]
      : []),
    ...supplierReferences,
  ]);
}

function optimizeWorksheet(
  request: F6OptimizationRequest,
  worksheet: F6OptimizationRequest["worksheets"][number],
  baselineRequest: CalculationRequest,
  calculateScenario: typeof calculateF6Scenario,
): F6OptimizationResult["worksheets"][number] {
  const baseline = worksheet.baselineCalculation;
  const top = selectTopContributors(baseline.factors, Math.min(3, baseline.factors.length));
  const targetCapability = baseline.capability.targetCpk > 0 && baseline.capability.targetSigmaLevel > 0
    ? { targetCpk: baseline.capability.targetCpk, targetSigmaLevel: baseline.capability.targetSigmaLevel, source: "worksheet" as const }
    : { targetCpk: 1.33, targetSigmaLevel: 4, source: "controlled_default" as const };
  const supplierEvidenceByIdentity = new Map((request.supplierCapabilityEvidence ?? []).map((evidence) => [
    `${evidence.source}\u0000${evidence.contentHash}`,
    evidence,
  ]));
  const supplierEvidenceBySource = new Map(worksheet.supplierBindings.map((binding) => [
    sourceKey(binding),
    supplierEvidenceByIdentity.get(`${binding.evidenceReference.artifact}\u0000${binding.evidenceReference.contentHash}`)!,
  ]));
  const options: F6Option[] = NUMERIC_OPTION_KINDS.map((kind) => {
    try {
      return buildNumericOption(
        kind,
        request,
        baselineRequest,
        baseline,
        top,
        targetCapability.targetCpk,
        calculateScenario,
        supplierEvidenceBySource,
      );
    } catch (error) {
      return failure(kind, worksheet.worksheetName, error);
    }
  });
  const baselineSourceKeys = new Set(baseline.factors.map(({ source }) => `${source.tableId}\u0000${source.sourceRow}`));
  const matchingDatumEvidence = (request.datumEvidence ?? []).filter((evidence) => {
    if (evidence.worksheetName !== worksheet.worksheetName) return false;
    const evidenceKeys = new Set(evidence.factorDirections.map(({ tableId, sourceRow }) => `${tableId}\u0000${sourceRow}`));
    return evidenceKeys.size === baselineSourceKeys.size && [...baselineSourceKeys].every((key) => evidenceKeys.has(key));
  });
  const supplierEvidence = supplierEvidenceBySource.get(sourceKey(top[0]!.source));
  const datumEvidence = matchingDatumEvidence.length === 1 ? matchingDatumEvidence[0] : undefined;
  const supplierOption: F6Option = supplierEvidence === undefined
    ? (() => {
        const assessment = assessSupplierScenario({
          requestedToleranceBand: scaledChange(top[0]!, 0.8).resultingBand,
        });
        return { ...assessment.option, feasibility: assessment.feasibility };
      })()
    : {
        status: "insufficient_evidence",
        optionId: "improve_supplier_capability-evidence-gate",
        optionKind: "improve_supplier_capability",
        predictedImprovement: "insufficient_evidence",
        requiredInputs: ["controlled_supplier_scenario_calculation"],
        evidenceReferences: [{ artifact: supplierEvidence.source, contentHash: supplierEvidence.contentHash }],
        feasibility: assessToleranceFeasibility({
          evidence: supplierEvidence,
          requestedToleranceBand: scaledChange(top[0]!, 0.8).resultingBand,
        }),
        evidenceScope: {
          kind: "supplier",
          supplierReference: supplierEvidence.supplierReference,
          processFamily: supplierEvidence.processFamily,
          partCategory: supplierEvidence.partCategory,
          evidenceReference: { artifact: supplierEvidence.source, contentHash: supplierEvidence.contentHash },
        },
        relativeCost: "insufficient_evidence",
        roiScore: "not_computed",
        impactRank: null,
      };
  const datumOption: F6Option = datumEvidence === undefined
    ? assessDatumScenario({}).option
    : {
        status: "insufficient_evidence",
        optionId: "tighten_datum_strategy-evidence-gate",
        optionKind: "tighten_datum_strategy",
        predictedImprovement: "insufficient_evidence",
        requiredInputs: ["controlled_datum_scenario_calculation", "engineering_review"],
        evidenceReferences: [{ artifact: datumEvidence.source, contentHash: datumEvidence.contentHash }],
        feasibility: {
          status: "requires_engineering_review",
          reasonCodes: ["confirmed_datum_evidence_requires_engineering_review"],
          evidenceReferences: [datumEvidence.source],
        },
        evidenceScope: {
          kind: "datum",
          worksheetName: datumEvidence.worksheetName,
          factorSources: datumEvidence.factorDirections,
          evidenceReference: { artifact: datumEvidence.source, contentHash: datumEvidence.contentHash },
        },
        relativeCost: "insufficient_evidence",
        roiScore: "not_computed",
        impactRank: null,
      };
  options.push(
    supplierOption,
    datumOption,
  );
  const costedOptions = options.map((option) => applyCostAssessment(request, option));
  const completedCount = costedOptions.filter(({ status }) => status === "completed").length;
  const capabilityRisk = baseline.capability.cpk < targetCapability.targetCpk
    ? [{
      riskId: `${worksheet.worksheetName}:f5:capability-below-target`,
      category: "Product" as const,
      rating: baseline.capability.cpk < 1 ? "Critical" as const : "High" as const,
      status: "open" as const,
      reason: `F5 governed baseline Cpk ${baseline.capability.cpk} is below target ${targetCapability.targetCpk}.`,
      evidenceReferences: [{ artifact: request.f5Reference.artifact, contentHash: request.f5Reference.contentHash }],
    }]
    : [];
  const risks: ReadyWorksheet["risks"] = [
    ...capabilityRisk,
    ...worksheet.f3GovernanceRows
      .filter((row) => row.governanceStatus !== "complete" || row.qualitySignals.length > 0)
      .map((row) => ({
        riskId: `${worksheet.worksheetName}:f3:${row.source.tableId}:${row.source.sourceRow}`,
        category: "Manufacturing" as const,
        rating: row.governanceStatus !== "complete" ? "Critical" as const : "High" as const,
        status: "open" as const,
        reason: row.governanceStatus !== "complete"
          ? "Factor governance is incomplete."
          : `Factor governance signals remain open: ${row.qualitySignals.join(", ")}.`,
        evidenceReferences: [{ artifact: request.f3Reference.artifact, contentHash: request.f3Reference.contentHash }],
      })),
    ...worksheet.f5Worksheet.clarifications.map((clarification) => ({
      riskId: `${worksheet.worksheetName}:f5:${clarification.clarificationId}`,
      category: "Product" as const,
      rating: "High" as const,
      status: "open" as const,
      reason: clarification.questionForReviewer,
      evidenceReferences: [{ artifact: request.f5Reference.artifact, contentHash: request.f5Reference.contentHash }],
    })),
  ];
  const optionsWithRiskClosure = costedOptions.map((option): F6Option => {
    if (option.status !== "completed") return option;
    return {
      ...option,
      closedRiskIds: capabilityRisk.length > 0 && option.resultMetrics.cpk >= targetCapability.targetCpk
        ? [capabilityRisk[0]!.riskId]
        : [],
    };
  });
  const ranked = rankCompletedOptions(optionsWithRiskClosure, targetCapability.targetCpk, risks);
  const roi = applyGovernedRoi(ranked);
  const highest = selectHighestSupportedCompletedOption(roi.options);
  const recommendations = roi.options
    .filter((option): option is CompletedOption => option.status === "completed" && option.feasibility.status === "supported")
    .map((option) => ({
      recommendationId: `recommend:${option.optionId}`,
      optionId: option.optionId,
      text: `Review controlled option ${option.optionKind}.`,
      evidenceReferences: [f4ArtifactReference(request)],
    }));
  const result: ReadyWorksheet = {
    worksheetName: worksheet.worksheetName,
    f4CalculationIndex: worksheet.f4CalculationIndex,
    status: completedCount === 0
      ? "calculation_failed"
      : ranked.some(({ status }) => status === "calculation_failed")
        ? "partially_completed"
        : "completed",
    baselineMetrics: metrics(baseline),
    targetCapability,
    inputFindings: structuredClone(worksheet.f2Findings),
    options: roi.options,
    risks,
    recommendations,
    ...(highest === undefined ? {} : {
      highestImpactAction: { optionId: highest.optionId, rationale: "Highest deterministic impact rank among completed options." },
    }),
    roiStatus: roi.roiStatus,
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
  const baselineRequests = request.worksheets.map((worksheet) =>
    verifiedBaselineRequest(worksheet.baselineCalculationRequest, worksheet.baselineCalculation));
  const worksheets = request.worksheets.map((worksheet, index) =>
    optimizeWorksheet(request, worksheet, baselineRequests[index]!, calculateScenario));
  const options = worksheets.flatMap((worksheet) => worksheet.options);
  const summary = {
    worksheetCount: worksheets.length,
    completedWorksheetCount: worksheets.filter(({ status }) => status === "completed").length,
    partiallyCompletedWorksheetCount: worksheets.filter(({ status }) => status === "partially_completed").length,
    calculationFailedWorksheetCount: worksheets.filter(({ status }) => status === "calculation_failed").length,
    inputRejectedWorksheetCount: worksheets.filter(({ status }) => status === "input_rejected").length,
    completedOptionCount: options.filter(({ status }) => status === "completed").length,
    calculationFailedOptionCount: options.filter(({ status }) => status === "calculation_failed").length,
    insufficientEvidenceOptionCount: options.filter(({ status }) => status === "insufficient_evidence").length,
  };
  const status = summary.inputRejectedWorksheetCount === worksheets.length
    ? "input_rejected"
    : summary.calculationFailedWorksheetCount === worksheets.length
      ? "calculation_failed"
      : summary.partiallyCompletedWorksheetCount > 0
        || summary.calculationFailedWorksheetCount > 0
        || summary.inputRejectedWorksheetCount > 0
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