import {
  calculationRequestSchema,
  f5MultimodalArtifactV3Schema,
  completedF5MultimodalProjection,
  f6AnalysisContextSchema,
  f6LegacyOptimizationResultSchema,
  f6ModelInterpretationArtifactSchema,
  f6OptimizationRequestSchema,
  f6OptimizationResultV2Schema,
  f6OptimizationResultV3Schema,
  f6OptimizationResultV4Schema,
  f6OptimizationTargetsSchema,
  type CalculationCompletedResult,
  type CalculationFactorResult,
  type CalculationRequest,
  type F5MultimodalArtifactV3,
  type F5MultimodalArtifactV4,
  type F6ControlledScenario,
  type F6AnalysisContext,
  type F6FactorIdentity,
  type F6InputDecision,
  type F6ModelInterpretationArtifact,
  type F6OptimizationRequest,
  type F6LegacyOptimizationResult,
  type F6OptimizationResultV2,
  type F6OptimizationResultV3,
  type F6OptimizationResultV4,
  type F6OptimizationTargets,
  type F6Option,
  type F6OptionV2,
  type F6OptionKind,
  type F6OptimizationAssessment,
  type F6OptimizationTargetV2,
  type F6SupplierCapabilityEvidence,
  type F6ToleranceChange,
} from "@ai-assist/contracts";
import type { InteractionLanguage } from "@ai-assist/product-language";
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
  F6SolverError,
  scaleToleranceBandAroundCenter,
  selectTopContributors,
  solveCenteringShift,
  solveSingleFactorTolerance,
  solveOneSidedSpecificationLimits,
  solveGuardedTargetRssSigma,
  solveTargetRssSigma,
  solveTopNCombinedTolerance,
} from "./f6-solver.js";

type CompletedOption = Extract<F6Option, { status: "completed" }>;
type FailedOption = Extract<F6Option, { status: "calculation_failed" }>;
type ReadyWorksheet = Extract<F6LegacyOptimizationResult["worksheets"][number], { status: "completed" | "partially_completed" | "calculation_failed" }>;

interface OptimizationDependencies {
  readonly calculateScenario?: typeof calculateF6Scenario;
}

export interface F6OptimizationV3Inputs {
  readonly interactionLanguage: InteractionLanguage;
  readonly multimodalInterpretation: F5MultimodalArtifactV3 | F5MultimodalArtifactV4;
  readonly multimodalReference: { readonly artifact: string; readonly contentHash: string };
  readonly optimizationTargets?: F6OptimizationTargets;
  readonly optimizationTargetsDecision?: F6InputDecision;
}

export interface F6OptimizationV4Inputs {
  readonly interactionLanguage: InteractionLanguage;
  readonly multimodalInterpretation: F5MultimodalArtifactV3 | F5MultimodalArtifactV4;
  readonly multimodalReference: { readonly artifact: string; readonly contentHash: string };
  readonly imageObservationReference?: { readonly artifact: string; readonly contentHash: string };
  readonly supplierCapabilityReference?: { readonly artifact: string; readonly contentHash: string };
  readonly datumStrategyReference?: { readonly artifact: string; readonly contentHash: string };
  readonly costReference?: { readonly artifact: string; readonly contentHash: string };
  readonly analysisContextReference?: { readonly artifact: string; readonly contentHash: string };
  readonly optimizationTargetsReference?: { readonly artifact: string; readonly contentHash: string };
  readonly optimizationTargets?: F6OptimizationTargets;
  readonly optimizationTargetsDecision?: F6InputDecision;
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

function baselineIdentity(calculation: CalculationCompletedResult) {
  return {
    projectReference: calculation.projectReference,
    runReference: calculation.runReference,
    calculationVersion: calculation.calculationVersion,
    workbookContentHash: calculation.workbookContentHash,
    worksheetName: calculation.worksheetSelection.worksheetName,
    tableId: calculation.worksheetSelection.tableId,
    factorCount: calculation.factorCount,
    factors: calculation.factors.map((factor) => {
      const identity: Partial<CalculationFactorResult> = structuredClone(factor);
      delete identity.trace;
      return identity as Omit<CalculationFactorResult, "trace">;
    }),
    system: structuredClone(calculation.system),
    capability: structuredClone(calculation.capability),
  };
}

function f4ArtifactReference(request: F6OptimizationRequest) {
  return { artifact: request.f4Reference.artifact, contentHash: request.f4Reference.contentHash };
}

function inputFindings(request: F6OptimizationRequest, worksheet: F6OptimizationRequest["worksheets"][number], options: readonly F6Option[]) {
  const findings = structuredClone(worksheet.f2Findings);
  if (!options.some(({ status }) => status === "calculation_failed")
    || findings.some(({ findingKind }) => findingKind === "optimization_failure")) {
    return findings;
  }
  return [...findings, {
    findingCode: "f6_option_calculation_failed",
    findingKind: "optimization_failure" as const,
    severity: "Major" as const,
    message: "One or more controlled optimization options could not be calculated.",
    affectsCapabilityData: false,
    evidenceReferences: [
      f4ArtifactReference(request),
      { artifact: request.f5Reference.artifact, contentHash: request.f5Reference.contentHash },
    ],
  }];
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
): F6LegacyOptimizationResult["worksheets"][number] {
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
    baselineIdentity: baselineIdentity(baseline),
    status: completedCount === 0
      ? "calculation_failed"
      : ranked.some(({ status }) => status === "calculation_failed")
        ? "partially_completed"
        : "completed",
    baselineMetrics: metrics(baseline),
    targetCapability,
    inputFindings: inputFindings(request, worksheet, roi.options),
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

export function createLegacyF6Optimization(input: unknown, dependencies: OptimizationDependencies = {}): F6LegacyOptimizationResult {
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
  return immutable(f6LegacyOptimizationResultSchema.parse({
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
      reportScope: request.reportScope,
      f0Versions: request.f0Versions,
      scenarioPolicyVersion: request.scenarioPolicyVersion,
      ...(request.imageObservationReference === undefined ? {} : { imageObservationReference: request.imageObservationReference }),
      ...(request.supplierCapabilityEvidence === undefined ? {} : { supplierCapabilityEvidence: request.supplierCapabilityEvidence }),
      ...(request.datumEvidence === undefined ? {} : { datumEvidence: request.datumEvidence }),
      ...(request.costEvidence === undefined ? {} : { costEvidence: request.costEvidence }),
    },
  }));
}

interface F6OptimizationV2Inputs {
  readonly analysisContext?: F6AnalysisContext;
  readonly optimizationTargets?: F6OptimizationTargets;
  readonly modelInterpretation?: F6ModelInterpretationArtifact | F5MultimodalArtifactV3;
  readonly inputDecisions: {
    readonly analysisContext: F6InputDecision;
    readonly optimizationTargets: F6InputDecision;
    readonly modelInterpretation?: F6InputDecision;
  };
}

function artifactReference(reference: { readonly artifact: string; readonly contentHash: string }) {
  return { artifact: reference.artifact, contentHash: reference.contentHash };
}

function metricsV2(calculation: Pick<CalculationCompletedResult, "system" | "capability">) {
  return {
    mean: calculation.system.mean,
    rssSigma: calculation.system.rssSigma,
    worstCaseLower: calculation.system.worstCaseLower,
    worstCaseUpper: calculation.system.worstCaseUpper,
    cp: calculation.capability.cp,
    cpk: calculation.capability.cpk,
    lowerCpk: calculation.capability.lowerCpk,
    upperCpk: calculation.capability.upperCpk,
    capabilityStatus: calculation.capability.status,
    yield: calculation.capability.yield,
    dpm: calculation.capability.totalDpm,
  };
}

const BUILT_IN_TOP3_POLICY_ID = "f6-top3-tolerance-policy-v1" as const;
const BUILT_IN_TOP3_OPTIONS = [
  { optionCode: "OP1" as const, ratios: [0.25, 0.1, 0.1] as const },
  { optionCode: "OP2" as const, ratios: [0.2, 0.15, 0.15] as const },
  { optionCode: "OP3" as const, ratios: [0.4, 0.05, 0.05] as const },
] as const;

function inputBaselineIdentity(calculation: CalculationCompletedResult) {
  return {
    calculationVersion: calculation.calculationVersion,
    projectReference: calculation.projectReference,
    runReference: calculation.runReference,
    workbookContentHash: calculation.workbookContentHash,
    worksheetName: calculation.worksheetSelection.worksheetName,
    tableId: calculation.worksheetSelection.tableId,
  };
}

function factorIdentity(factor: CalculationFactorResult): F6FactorIdentity {
  return {
    worksheetName: factor.source.worksheetName,
    tableId: factor.source.tableId,
    sourceRow: factor.source.sourceRow,
    factorName: factor.factorName,
    unit: factor.unit,
  };
}

function authorizedDecision(decision: F6InputDecision): boolean {
  return decision.outcome === "CONFIRMED" || decision.outcome === "CALLER_AUTHORIZED";
}

function evidenceFromDecision(decision: F6InputDecision) {
  return "artifactReference" in decision && decision.artifactReference !== undefined
    ? [structuredClone(decision.artifactReference)]
    : [];
}

function requestEvidenceDecision(evidence: { readonly source: string; readonly contentHash: string } | undefined): F6InputDecision {
  return evidence === undefined
    ? { outcome: "NOT_PROVIDED" }
    : { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: evidence.source, contentHash: evidence.contentHash } };
}

function exactFactor(
  calculation: CalculationCompletedResult,
  identity: F6FactorIdentity,
): CalculationFactorResult {
  const matches = calculation.factors.filter((factor) => equivalent(factorIdentity(factor), identity));
  if (matches.length !== 1) throw new Error("Optimization target factor identity does not match the governed baseline.");
  return matches[0]!;
}

function overrideForTolerance(
  factor: CalculationFactorResult,
  lowerTolerance: number,
  upperTolerance: number,
) {
  return {
    worksheetName: factor.source.worksheetName,
    tableId: factor.source.tableId,
    sourceRow: factor.source.sourceRow,
    lowerTolerance,
    upperTolerance,
  };
}

function scaledOverride(factor: CalculationFactorResult, scale: number) {
  if (!(scale > 0) || !Number.isFinite(scale)) throw new Error("Optimization target scale must be finite and positive.");
  const scaled = scaleToleranceBandAroundCenter({
    lowerTolerance: factor.input.lowerTolerance,
    upperTolerance: factor.input.upperTolerance,
    scale,
  });
  return overrideForTolerance(factor, scaled.lowerTolerance, scaled.upperTolerance);
}

type F6ToleranceOverride = {
  readonly worksheetName: string;
  readonly tableId: string;
  readonly sourceRow: number;
  readonly lowerTolerance: number;
  readonly upperTolerance: number;
};

type F6ModelOptimizationAssessment = F6OptimizationAssessment & {
  readonly disposition: "RECOMMENDED" | "CONSIDER";
};

function isModelDirectedAssessment(assessment: F6OptimizationAssessment): assessment is F6ModelOptimizationAssessment {
  return assessment.disposition === "RECOMMENDED" || assessment.disposition === "CONSIDER";
}

function scenarioForTarget(
  worksheet: F6OptimizationRequest["worksheets"][number],
  target: F6OptimizationTargetV2,
): { readonly scenario?: F6ControlledScenario; readonly v2Overrides?: Array<{ factor: F6FactorIdentity; nominalValue?: number; lowerTolerance?: number; upperTolerance?: number; sigma?: number }>; readonly insufficientInputs?: readonly string[] } {
  const calculation = worksheet.baselineCalculation;
  let overrides: F6ToleranceOverride[];
  if (target.targetType === "factor_tolerance") {
    const factor = exactFactor(calculation, target.factor);
    overrides = [overrideForTolerance(factor, target.lowerTolerance, target.upperTolerance)];
  } else if (target.targetType === "factor_sigma") {
    const factor = exactFactor(calculation, target.factor);
    overrides = [scaledOverride(factor, target.sigma / factor.sigma)];
  } else if (target.targetType === "improvement_ratio") {
    const factor = exactFactor(calculation, target.factor);
    overrides = [scaledOverride(factor, 1 - target.ratio)];
  } else if (target.targetType === "factor_nominal") {
    const factor = exactFactor(calculation, target.factor);
    const scenarioId = `${worksheet.worksheetName}:${target.targetId}`;
    return {
      scenario: {
        scenarioId,
        optionKind: "requirement_change",
        factorOverrides: [{
          worksheetName: factor.source.worksheetName,
          tableId: factor.source.tableId,
          sourceRow: factor.source.sourceRow,
          nominalValue: target.nominalValue,
        }],
      },
      v2Overrides: [{
        factor: factorIdentity(factor),
        nominalValue: target.nominalValue,
      }],
    };
  } else if (target.targetType === "system_mean_shift") {
    const resultingAdditionalMeanShift = "targetMean" in target.target
      ? calculation.system.additionalMeanShift + target.target.targetMean - calculation.system.mean
      : target.target.resultingAdditionalMeanShift;
    const scenarioId = `${worksheet.worksheetName}:${target.targetId}`;
    return {
      scenario: {
        scenarioId,
        optionKind: "requirement_change",
        factorOverrides: [],
        systemSpecification: { additionalMeanShift: resultingAdditionalMeanShift },
      },
      v2Overrides: [],
    };
  } else if (target.targetType === "system_specification") {
    const scenarioId = `${worksheet.worksheetName}:${target.targetId}`;
    return {
      scenario: {
        scenarioId,
        optionKind: "requirement_change",
        factorOverrides: [],
        systemSpecification: {
          ...(target.lowerSpecLimit === undefined ? {} : { lowerSpecLimit: target.lowerSpecLimit }),
          ...(target.upperSpecLimit === undefined ? {} : { upperSpecLimit: target.upperSpecLimit }),
        },
      },
      v2Overrides: [],
    };
  } else {
    if (target.apportionment.policy === "CAPABILITY_BOUNDED") {
      return { insufficientInputs: ["supplier_capability_bounds"] };
    }
    const targetRssSigma = "targetCpk" in target.target
      ? solveTargetRssSigma({
        mean: calculation.system.mean,
        lowerSpecLimit: calculation.capability.lowerSpecLimit,
        upperSpecLimit: calculation.capability.upperSpecLimit,
        targetCpk: target.target.targetCpk,
      })
      : target.target.targetRssSigma;
    const selectedFactors = target.apportionment.selectedFactors.map((identity) => exactFactor(calculation, identity));
    const allocation = apportionRssTolerance({
      factors: calculation.factors,
      targetRssSigma,
      policy: target.apportionment.policy === "PROPORTIONAL"
        ? "proportional-to-contribution"
        : "equal-allocation-among-top-N",
      selectedSources: selectedFactors.map(({ source }) => source),
    });
    if (allocation.feasibility.status !== "supported") {
      return { insufficientInputs: allocation.feasibility.reasonCodes };
    }
    overrides = allocation.allocations.map((entry) => {
      const factor = calculation.factors.find(({ source }) => source.tableId === entry.tableId && source.sourceRow === entry.sourceRow);
      if (factor === undefined || !(factor.halfTolerance > 0)) throw new Error("RSS allocation factor is unavailable.");
      return scaledOverride(factor, entry.targetTolerance / factor.halfTolerance);
    });
  }
  const scenarioId = `${worksheet.worksheetName}:${target.targetId}`;
  return {
    scenario: { scenarioId, optionKind: "requirement_change", factorOverrides: overrides },
    v2Overrides: overrides.map((override) => {
      const factor = calculation.factors.find(({ source }) => source.worksheetName === override.worksheetName
        && source.tableId === override.tableId && source.sourceRow === override.sourceRow)!;
      return {
        factor: factorIdentity(factor),
        lowerTolerance: override.lowerTolerance,
        upperTolerance: override.upperTolerance,
      };
    }),
  };
}

function builtInTop3Options(
  request: F6OptimizationRequest,
  worksheet: F6OptimizationRequest["worksheets"][number],
  baselineRequest: CalculationRequest,
  calculateScenario: typeof calculateF6Scenario,
): F6OptionV2[] {
  const baseline = worksheet.baselineCalculation;
  const failedSides = [
    ...(baseline.capability.lowerCpk < baseline.capability.targetCpk ? ["lowerCpk" as const] : []),
    ...(baseline.capability.upperCpk < baseline.capability.targetCpk ? ["upperCpk" as const] : []),
  ];
  if (failedSides.length === 0 || baseline.factors.length === 0) return [];
  const selectedFactors = selectTopContributors(baseline.factors, Math.min(3, baseline.factors.length));
  const baselineMetrics = metricsV2(baseline);
  const evidenceReferences = [artifactReference(request.f4Reference)];
  return BUILT_IN_TOP3_OPTIONS.map(({ optionCode, ratios }) => {
    const targetId = `${BUILT_IN_TOP3_POLICY_ID}:${optionCode}`;
    const optionId = `${worksheet.worksheetName}:builtin-top3:${optionCode}`;
    const reductions = selectedFactors.map((factor, index) => ({
      factor: factorIdentity(factor),
      rank: index + 1,
      reductionRatio: ratios[index]!,
      scale: 1 - ratios[index]!,
    }));
    const policyContext = {
      policyId: BUILT_IN_TOP3_POLICY_ID,
      optionCode,
      trigger: {
        lowerCpk: baseline.capability.lowerCpk,
        upperCpk: baseline.capability.upperCpk,
        targetCpk: baseline.capability.targetCpk,
        failedSides,
      },
      selectedFactorCount: selectedFactors.length,
      reductions,
    };
    try {
      const overrides = selectedFactors.map((factor, index) => scaledOverride(factor, 1 - ratios[index]!));
      const scenario: F6ControlledScenario = { scenarioId: optionId, optionKind: "requirement_change", factorOverrides: overrides };
      const calculation = calculateScenario({ baselineRequest, scenario });
      const scenarioResult = calculation.scenarios.find(({ scenarioId }) => scenarioId === optionId);
      if (scenarioResult === undefined) throw new Error("built_in_scenario_unavailable");
      return {
        optionId,
        status: "completed" as const,
        optionSource: "BUILT_IN_POLICY" as const,
        targetId,
        policyContext,
        baselineMetrics,
        resultMetrics: metricsV2(scenarioResult.calculation),
        scenarioEvidence: {
          targetId,
          baselineIdentity: inputBaselineIdentity(baseline),
          factorOverrides: overrides.map((override, index) => ({
            factor: factorIdentity(selectedFactors[index]!),
            lowerTolerance: override.lowerTolerance,
            upperTolerance: override.upperTolerance,
          })),
          calculationReference: artifactReference(request.f4Reference),
          formulaReferences: scenarioResult.calculation.traceRecords.map(({ outputField, formulaId, formulaVersion }) => ({ outputField, formulaId, formulaVersion })),
        },
        feasibility: { status: "supported" as const, reasonCodes: ["built_in_policy"], evidenceReferences: [request.f4Reference.artifact] },
        evidenceReferences,
        impactRank: null,
      };
    } catch {
      return {
        optionId,
        status: "calculation_failed" as const,
        optionSource: "BUILT_IN_POLICY" as const,
        targetId,
        policyContext,
        reasonCode: "built_in_calculation_failed",
        baselineMetrics,
        evidenceReferences,
        impactRank: null,
      };
    }
  });
}

function targetOption(
  request: F6OptimizationRequest,
  worksheet: F6OptimizationRequest["worksheets"][number],
  baselineRequest: CalculationRequest,
  target: F6OptimizationTargetV2,
  evidenceReferences: ReadonlyArray<{ artifact: string; contentHash: string }>,
  feasibilityReasonCode: string,
  calculateScenario: typeof calculateF6Scenario,
): F6OptionV2 {
  const baselineMetrics = metricsV2(worksheet.baselineCalculation);
  const optionId = `${worksheet.worksheetName}:${target.targetId}`;
  try {
    const built = scenarioForTarget(worksheet, target);
    if (built.insufficientInputs !== undefined) {
      return {
        optionId,
        status: "insufficient_evidence",
        targetId: target.targetId,
        targetContext: structuredClone(target),
        requiredInputs: [...built.insufficientInputs],
        baselineMetrics,
        evidenceReferences: structuredClone([...evidenceReferences]),
        impactRank: null,
      };
    }
    if (built.scenario === undefined || built.v2Overrides === undefined) throw new Error("Optimization scenario was not generated.");
    const calculation = calculateScenario({ baselineRequest, scenario: built.scenario });
    const scenario = calculation.scenarios.find(({ scenarioId }) => scenarioId === built.scenario!.scenarioId);
    if (scenario === undefined) throw new Error("Optimization scenario result is unavailable.");
    return {
      optionId,
      status: "completed",
      targetId: target.targetId,
      optionSource: "CALLER_TARGET",
      baselineMetrics,
      resultMetrics: metricsV2(scenario.calculation),
      scenarioEvidence: {
        targetId: target.targetId,
        baselineIdentity: inputBaselineIdentity(worksheet.baselineCalculation),
        factorOverrides: built.v2Overrides,
        ...(built.scenario.systemSpecification === undefined
          ? {}
          : { systemSpecification: structuredClone(built.scenario.systemSpecification) }),
        calculationReference: artifactReference(request.f4Reference),
        formulaReferences: scenario.calculation.traceRecords.map(({ outputField, formulaId, formulaVersion }) => ({ outputField, formulaId, formulaVersion })),
      },
      targetContext: structuredClone(target),
      feasibility: { status: "supported", reasonCodes: [feasibilityReasonCode], evidenceReferences: evidenceReferences.map(({ artifact }) => artifact) },
      evidenceReferences: structuredClone([...evidenceReferences]),
      impactRank: null,
    };
  } catch (error) {
    return {
      optionId,
      status: "calculation_failed",
      targetId: target.targetId,
      optionSource: "CALLER_TARGET",
      targetContext: structuredClone(target),
      reasonCode: error instanceof Error ? error.message : "calculation_failed",
      baselineMetrics,
      evidenceReferences: structuredClone([...evidenceReferences]),
      impactRank: null,
    };
  }
}

const MODEL_CLASS_ORDER = [
  "factor_nominal",
  "system_mean_shift",
  "system_specification",
  "factor_tolerance",
] as const;

type ModelAdjustmentClass = (typeof MODEL_CLASS_ORDER)[number];

function targetClass(target: F6OptimizationTargetV2): ModelAdjustmentClass {
  switch (target.targetType) {
    case "factor_nominal":
      return "factor_nominal";
    case "system_mean_shift":
      return "system_mean_shift";
    case "system_specification":
      return "system_specification";
    default:
      return "factor_tolerance";
  }
}

function modelAssessmentWorksheet(
  modelInterpretation: F6ModelInterpretationArtifact | F5MultimodalArtifactV3 | undefined,
  worksheet: F6OptimizationRequest["worksheets"][number],
) {
  if (modelInterpretation === undefined
    || !("interpretationVersion" in modelInterpretation)
    || modelInterpretation.interpretationVersion !== "f6-model-interpretation-v2") {
    return undefined;
  }
  return modelInterpretation.worksheets.find((candidate) =>
    candidate.worksheetName === worksheet.worksheetName
    && candidate.tableId === worksheet.baselineCalculation.worksheetSelection.tableId,
  );
}

function systemIdentityForWorksheet(worksheet: F6OptimizationRequest["worksheets"][number]) {
  const baseline = worksheet.baselineCalculation;
  return {
    baselineIdentity: inputBaselineIdentity(baseline),
    designNominal: baseline.system.designNominal,
    mean: baseline.system.mean,
    rssSigma: baseline.system.rssSigma,
    lowerSpecLimit: baseline.capability.lowerSpecLimit,
    upperSpecLimit: baseline.capability.upperSpecLimit,
    targetCpk: baseline.capability.targetCpk,
    traceReferences: baseline.traceRecords.map(({ outputField, formulaId, formulaVersion }) => ({ outputField, formulaId, formulaVersion })),
  };
}

function modelDirectedTarget(
  worksheet: F6OptimizationRequest["worksheets"][number],
  assessment: F6ModelOptimizationAssessment,
) {
  const baseline = worksheet.baselineCalculation;
  const targetId = `model-${assessment.adjustmentClass}-p${assessment.priority}`;
  if (assessment.adjustmentClass === "factor_nominal") {
    const factor = exactFactor(baseline, assessment.factor);
    const targetMean = (baseline.capability.lowerSpecLimit + baseline.capability.upperSpecLimit) / 2;
    const nominalValue = factor.input.nominalValue + (targetMean - baseline.system.mean);
    return {
      targetId,
      targetType: "factor_nominal" as const,
      factor: factorIdentity(factor),
      nominalValue,
      unit: factor.unit,
    };
  }
  if (assessment.adjustmentClass === "system_mean_shift") {
    const targetMean = (baseline.capability.lowerSpecLimit + baseline.capability.upperSpecLimit) / 2;
    return {
      targetId,
      targetType: "system_mean_shift" as const,
      systemIdentity: systemIdentityForWorksheet(worksheet),
      target: { targetMean, unit: baseline.factors[0]!.unit },
    };
  }
  return undefined;
}

function rankV2Options(options: readonly F6OptionV2[]): F6OptionV2[] {
  const rankedIds = options
    .filter((option): option is Extract<F6OptionV2, { status: "completed" }> => option.status === "completed" && option.feasibility.status === "supported")
    .sort((left, right) => (right.resultMetrics.cpk - right.baselineMetrics.cpk) - (left.resultMetrics.cpk - left.baselineMetrics.cpk)
      || left.optionId.localeCompare(right.optionId))
    .map(({ optionId }) => optionId);
  const rankById = new Map(rankedIds.map((optionId, index) => [optionId, index + 1]));
  return options.map((option) => option.status === "completed" ? { ...option, impactRank: rankById.get(option.optionId) ?? null } : option);
}

export function createF6Optimization(
  input: unknown,
  inputs: F6OptimizationV2Inputs,
  dependencies: OptimizationDependencies = {},
): F6OptimizationResultV2 {
  const request = f6OptimizationRequestSchema.parse(input);
  const analysisContext = inputs.analysisContext === undefined ? undefined : f6AnalysisContextSchema.parse(inputs.analysisContext);
  const optimizationTargets = inputs.optimizationTargets === undefined ? undefined : f6OptimizationTargetsSchema.parse(inputs.optimizationTargets);
  const modelInterpretation = inputs.modelInterpretation === undefined
    ? undefined
    : "contractVersion" in inputs.modelInterpretation && inputs.modelInterpretation.contractVersion === "f5-multimodal-artifact-v3"
      ? f5MultimodalArtifactV3Schema.parse(inputs.modelInterpretation)
      : f6ModelInterpretationArtifactSchema.parse(inputs.modelInterpretation);
  if ((analysisContext !== undefined) !== authorizedDecision(inputs.inputDecisions.analysisContext)) {
    throw new Error("Analysis Context decision does not match the provided artifact.");
  }
  if ((optimizationTargets !== undefined) !== authorizedDecision(inputs.inputDecisions.optimizationTargets)) {
    throw new Error("Optimization Targets decision does not match the provided artifact.");
  }
  if ((modelInterpretation !== undefined) !== authorizedDecision(inputs.inputDecisions.modelInterpretation ?? { outcome: "NOT_PROVIDED" })) {
    throw new Error("Model Interpretation decision does not match the provided artifact.");
  }
  if (analysisContext !== undefined && analysisContext.workbookContentHash !== request.workbook.contentHash) {
    throw new Error("Analysis Context workbook identity does not match the F6 request.");
  }
  if (optimizationTargets !== undefined && optimizationTargets.workbookContentHash !== request.workbook.contentHash) {
    throw new Error("Optimization Targets workbook identity does not match the F6 request.");
  }
  if (modelInterpretation !== undefined && modelInterpretation.workbookContentHash !== request.workbook.contentHash) {
    throw new Error("Model Interpretation workbook identity does not match the F6 request.");
  }
  const calculateScenario = dependencies.calculateScenario ?? calculateF6Scenario;
  const baselineRequests = request.worksheets.map((worksheet) => verifiedBaselineRequest(worksheet.baselineCalculationRequest, worksheet.baselineCalculation));
  const worksheets = request.worksheets.map((worksheet, index) => {
    const baseline = worksheet.baselineCalculation;
    const targetWorksheet = optimizationTargets?.worksheets.find((candidate) => candidate.worksheetName === worksheet.worksheetName
      && candidate.tableId === baseline.worksheetSelection.tableId);
    const builtInOptions = builtInTop3Options(request, worksheet, baselineRequests[index]!, calculateScenario);
    let callerOptions: F6OptionV2[] = [];
    if (targetWorksheet !== undefined) {
      if (!equivalent(targetWorksheet.baselineIdentity, inputBaselineIdentity(baseline))) {
        throw new Error("Optimization Targets baseline identity does not match the governed F4 baseline.");
      }
    }
    const callerTargets = targetWorksheet?.targets ?? [];
    const callerEvidence = evidenceFromDecision(inputs.inputDecisions.optimizationTargets);
    const callerByClass = new Map<ModelAdjustmentClass, F6OptimizationTargetV2[]>([
      ["factor_nominal", []],
      ["system_mean_shift", []],
      ["system_specification", []],
      ["factor_tolerance", []],
    ]);
    for (const target of callerTargets) callerByClass.get(targetClass(target))!.push(target);

    const modelWorksheet = modelAssessmentWorksheet(modelInterpretation, worksheet);
    if (modelWorksheet !== undefined && !equivalent(modelWorksheet.baselineIdentity, inputBaselineIdentity(baseline))) {
      throw new Error("Model Interpretation baseline identity does not match the governed F4 baseline.");
    }

    const modelDecision = inputs.inputDecisions.modelInterpretation ?? { outcome: "NOT_PROVIDED" };
    const modelEvidence = evidenceFromDecision(modelDecision);
    const modelClarifications: NonNullable<F6OptimizationResultV2["worksheets"][number]["clarifications"]> = [];
    let options: F6OptionV2[];
    if (modelWorksheet === undefined) {
      callerOptions = callerTargets.map((target) => targetOption(
        request,
        worksheet,
        baselineRequests[index]!,
        target,
        callerEvidence,
        "caller_provided_target",
        calculateScenario,
      ));
      options = [...builtInOptions, ...callerOptions];
    } else {
      const assessmentByClass = new Map(modelWorksheet.optimizationAssessment.map((assessment) => [assessment.adjustmentClass, assessment]));
      const classOrderedOptions: F6OptionV2[] = [];
      for (const adjustmentClass of MODEL_CLASS_ORDER) {
        const explicitTargets = callerByClass.get(adjustmentClass)!;
        if (explicitTargets.length > 0) {
          classOrderedOptions.push(...explicitTargets.map((target) => targetOption(
            request,
            worksheet,
            baselineRequests[index]!,
            target,
            callerEvidence,
            "caller_provided_target",
            calculateScenario,
          )));
          continue;
        }

        const assessment = assessmentByClass.get(adjustmentClass);
        if (assessment === undefined) continue;
        const assessmentEvidence = assessment.evidenceReferences.map(({ artifact, contentHash }) => ({ artifact, contentHash }));
        const mergedEvidence = [...new Map(
          [...modelEvidence, ...assessmentEvidence].map((reference) => [`${reference.artifact}\u0000${reference.contentHash}`, reference]),
        ).values()];

        if (assessment.disposition === "INSUFFICIENT_EVIDENCE") {
          modelClarifications.push({
            clarificationId: `${worksheet.worksheetName}:assessment:${adjustmentClass}`,
            reasonCode: `model_${adjustmentClass}_insufficient_evidence`,
            requiredInputs: ["governed_numeric_target"],
            questionForReviewer: `Provide governed numeric inputs for ${adjustmentClass}.`,
            evidenceReferences: mergedEvidence,
          });
          continue;
        }
        if (assessment.disposition === "NOT_RECOMMENDED") continue;
        if (adjustmentClass === "system_specification") {
          modelClarifications.push({
            clarificationId: `${worksheet.worksheetName}:assessment:system-specification-authority`,
            reasonCode: "system_specification_target_required",
            requiredInputs: ["system_specification_target"],
            questionForReviewer: "Provide caller-authorized system specification limits before running this scenario.",
            evidenceReferences: mergedEvidence,
          });
          continue;
        }
        if (adjustmentClass === "factor_tolerance") {
          classOrderedOptions.push(...builtInOptions);
          continue;
        }
        if (!isModelDirectedAssessment(assessment)) continue;
        const generatedTarget = modelDirectedTarget(worksheet, assessment);
        if (generatedTarget === undefined) {
          modelClarifications.push({
            clarificationId: `${worksheet.worksheetName}:assessment:${adjustmentClass}-target-missing`,
            reasonCode: `model_${adjustmentClass}_deterministic_target_unavailable`,
            requiredInputs: ["governed_numeric_target"],
            questionForReviewer: `Provide deterministic inputs for ${adjustmentClass}.`,
            evidenceReferences: mergedEvidence,
          });
          continue;
        }
        classOrderedOptions.push(targetOption(
          request,
          worksheet,
          baselineRequests[index]!,
          generatedTarget,
          mergedEvidence,
          "model_assessment_directed",
          calculateScenario,
        ));
      }
      options = classOrderedOptions;
    }

    if (options.length === 0) {
      options = [{
        optionId: `${worksheet.worksheetName}:candidate`,
        status: "candidate",
        reasonCode: "target_not_provided",
        candidateFactors: baseline.factors.map(factorIdentity),
        requiredInputs: ["optimization_target"],
        calculationMethod: "Provide a governed target and rerun through F4.",
        baselineMetrics: metricsV2(baseline),
        impactRank: null,
      }];
    }
    const ranked = rankV2Options(options);
    const highest = ranked.find((option) => option.status === "completed" && option.impactRank === 1);
    const failed = ranked.filter(({ status }) => status === "calculation_failed").length;
    return {
      worksheetName: worksheet.worksheetName,
      tableId: baseline.worksheetSelection.tableId,
      runStatus: failed > 0 ? "PARTIALLY_COMPLETED" as const : "COMPLETED" as const,
      baselineIdentity: inputBaselineIdentity(baseline),
      baselineMetrics: metricsV2(baseline),
      targetCapability: { targetCpk: baseline.capability.targetCpk, targetSigmaLevel: baseline.capability.targetSigmaLevel, source: "WORKSHEET" as const },
      options: ranked,
      highestImpactAction: highest?.status === "completed" && highest.impactRank !== null
        ? { optionId: highest.optionId, impactRank: highest.impactRank }
        : null,
      findings: structuredClone(worksheet.f2Findings),
      risks: [],
      recommendations: ranked
        .filter((option): option is Extract<F6OptionV2, { status: "completed" }> => option.status === "completed" && option.feasibility.status === "supported")
        .map((option) => ({ recommendationId: `recommend:${option.optionId}`, optionId: option.optionId, text: `Review governed target ${option.targetId}.`, evidenceReferences: structuredClone(option.evidenceReferences) })),
      clarifications: [
        ...(ranked.some(({ status }) => status === "candidate")
          ? [{ clarificationId: `${worksheet.worksheetName}:optimization-target`, reasonCode: "optimization_target_required", requiredInputs: ["optimization_target"], questionForReviewer: "Provide a governed optimization target.", evidenceReferences: [] }]
          : []),
        ...modelClarifications,
      ],
    };
  });
  const options = worksheets.flatMap(({ options }) => options);
  const summary = {
    worksheetCount: worksheets.length,
    completedWorksheetCount: worksheets.filter(({ runStatus }) => runStatus === "COMPLETED").length,
    partiallyCompletedWorksheetCount: worksheets.filter(({ runStatus }) => runStatus === "PARTIALLY_COMPLETED").length,
    inputRejectedWorksheetCount: 0,
    candidateOptionCount: options.filter(({ status }) => status === "candidate").length,
    completedOptionCount: options.filter(({ status }) => status === "completed").length,
    insufficientEvidenceOptionCount: options.filter(({ status }) => status === "insufficient_evidence").length,
    calculationFailedOptionCount: options.filter(({ status }) => status === "calculation_failed").length,
  };
  return immutable(f6OptimizationResultV2Schema.parse({
    contractVersion: request.contractVersion,
    outputClassification: "confidential",
    featureId: "F6",
    optimizationVersion: "f6-optimization-v2",
    runStatus: summary.partiallyCompletedWorksheetCount > 0 ? "PARTIALLY_COMPLETED" : "COMPLETED",
    workbook: request.workbook,
    provenance: {
      f2Reference: artifactReference(request.f2Reference),
      f3Reference: artifactReference(request.f3Reference),
      f4Reference: artifactReference(request.f4Reference),
      f5Reference: artifactReference(request.f5Reference),
      reportScope: structuredClone(request.reportScope),
      ...(request.imageObservationReference === undefined ? {} : { imageObservationReference: artifactReference(request.imageObservationReference) }),
      ...(request.supplierCapabilityReference === undefined ? {} : { supplierCapabilityReference: artifactReference(request.supplierCapabilityReference) }),
      ...(request.datumStrategyReference === undefined ? {} : { datumStrategyReference: artifactReference(request.datumStrategyReference) }),
      ...(request.costReference === undefined ? {} : { costReference: artifactReference(request.costReference) }),
      supplierCapabilityDecision: requestEvidenceDecision(request.supplierCapabilityEvidence?.[0]),
      datumStrategyDecision: requestEvidenceDecision(request.datumEvidence?.[0]),
      costDecision: requestEvidenceDecision(request.costEvidence),
      analysisContextDecision: inputs.inputDecisions.analysisContext,
      optimizationTargetsDecision: inputs.inputDecisions.optimizationTargets,
      modelInterpretationDecision: inputs.inputDecisions.modelInterpretation ?? { outcome: "NOT_PROVIDED" },
    },
    worksheets,
    summary,
  }));
}

function verifiedMultimodalWorksheets(
  request: F6OptimizationRequest,
  value: F5MultimodalArtifactV3 | F5MultimodalArtifactV4,
): F5MultimodalArtifactV3["worksheets"] {
  let artifact: F5MultimodalArtifactV3;
  try {
    artifact = completedF5MultimodalProjection(value);
  } catch {
    throw new Error("Multimodal interpretation must be a valid governed v3 artifact.");
  }
  if (artifact.workbookContentHash !== request.workbook.contentHash
    || !equivalent(artifact.selectedWorksheetNames, request.selectedWorksheetNames)
    || artifact.worksheets.length !== request.worksheets.length) {
    throw new Error("Multimodal interpretation scope does not match the governed F6 request.");
  }
  request.worksheets.forEach((worksheet, index) => {
    const pair = artifact.worksheets[index];
    const baseline = worksheet.baselineCalculation;
    if (pair === undefined
      || pair.request.worksheetName !== worksheet.worksheetName
      || pair.request.tableId !== baseline.worksheetSelection.tableId
      || pair.request.factorRows.length !== baseline.factors.length) {
      throw new Error("Multimodal interpretation worksheet scope does not match the governed F4 baseline.");
    }
    pair.request.factorRows.forEach((row, factorIndex) => {
      const factor = baseline.factors[factorIndex];
      if (factor === undefined
        || row.worksheetName !== factor.source.worksheetName
        || row.tableId !== factor.source.tableId
        || row.sourceRow !== factor.source.sourceRow
        || row.factorName !== factor.factorName
        || !equivalent(row.nominal, factor.input.nominalValue)
        || !equivalent(row.lowerTolerance, factor.input.lowerTolerance)
        || !equivalent(row.upperTolerance, factor.input.upperTolerance)) {
        throw new Error("Multimodal interpretation Factor set does not match the governed F4 baseline.");
      }
    });
  });
  return artifact.worksheets;
}

function verifyV3OptimizationTargets(request: F6OptimizationRequest, inputs: F6OptimizationV3Inputs): void {
  const decision = inputs.optimizationTargetsDecision ?? { outcome: "NOT_PROVIDED" };
  if ((inputs.optimizationTargets !== undefined) !== authorizedDecision(decision)) {
    throw new Error("Optimization Targets decision does not match the provided artifact.");
  }
  if (inputs.optimizationTargets === undefined) return;
  const targets = f6OptimizationTargetsSchema.parse(inputs.optimizationTargets);
  if (targets.workbookContentHash !== request.workbook.contentHash) {
    throw new Error("Optimization Targets workbook identity does not match the F6 request.");
  }
  targets.worksheets.forEach((targetWorksheet) => {
    const worksheet = request.worksheets.find((candidate) => candidate.worksheetName === targetWorksheet.worksheetName
      && candidate.baselineCalculation.worksheetSelection.tableId === targetWorksheet.tableId);
    if (worksheet === undefined || !equivalent(targetWorksheet.baselineIdentity, inputBaselineIdentity(worksheet.baselineCalculation))) {
      throw new Error("Optimization Targets baseline identity does not match the governed F4 baseline.");
    }
  });
  if (targets.worksheets.some((worksheet) => worksheet.targets.length > 0)) {
    throw new Error("F6 v3 concrete Optimization Targets require a separately versioned F4-backed target scenario output.");
  }
}

function centerAssessmentV3(
  baseline: CalculationCompletedResult,
  interpretation: string,
): F6OptimizationResultV3["worksheets"][number]["steps"][0] {
  try {
    const centering = solveCenteringShift({
      lowerSpecLimit: baseline.capability.lowerSpecLimit,
      upperSpecLimit: baseline.capability.upperSpecLimit,
      factorMeans: [baseline.system.mean],
    });
    const offset = baseline.system.mean - centering.targetMean;
    return equivalent(baseline.system.mean, centering.targetMean)
      ? { step: "centerAssessment", status: "aligned", adjustedMean: baseline.system.mean, specificationMidpoint: centering.targetMean, offset: 0 }
      : {
          step: "centerAssessment",
          status: "offset",
          adjustedMean: baseline.system.mean,
          specificationMidpoint: centering.targetMean,
          offset,
          interpretation,
        };
  } catch {
    return {
      step: "centerAssessment",
      status: "clarification_required",
      reasonCode: "center_assessment_unavailable",
      requiredInputs: ["valid_f4_center_inputs"],
    };
  }
}

function specificationChangesV3(
  request: F6OptimizationRequest,
  worksheet: F6OptimizationRequest["worksheets"][number],
  baselineRequest: CalculationRequest,
  calculateScenario: typeof calculateF6Scenario,
): F6OptimizationResultV3["worksheets"][number]["steps"][2] {
  const baseline = worksheet.baselineCalculation;
  const failedSides = [
    ...(baseline.capability.lowerCpk < baseline.capability.targetCpk ? ["lower" as const] : []),
    ...(baseline.capability.upperCpk < baseline.capability.targetCpk ? ["upper" as const] : []),
  ];
  const proposals: F6OptimizationResultV3["worksheets"][number]["steps"][2]["proposals"] = [];
  const clarifications: F6OptimizationResultV3["worksheets"][number]["steps"][2]["clarifications"] = [];
  for (const side of failedSides) {
    const solved = solveOneSidedSpecificationLimits({
      mean: baseline.system.mean,
      rssSigma: baseline.system.rssSigma,
      targetCpk: baseline.capability.targetCpk,
      lowerSpecLimit: baseline.capability.lowerSpecLimit,
      upperSpecLimit: baseline.capability.upperSpecLimit,
      failedSides: [side],
    });
    if (solved.status === "clarification_required") {
      clarifications.push({ reasonCode: solved.reasonCode, requiredInputs: ["valid_specification_solver_inputs"] });
      continue;
    }
    const proposedLimit = side === "lower" ? solved.lowerSpecLimit : solved.upperSpecLimit;
    const specificationOverride = side === "lower"
      ? { lowerSpecLimit: proposedLimit }
      : { upperSpecLimit: proposedLimit };
    try {
      const scenarioId = `${worksheet.worksheetName}:specification-${side}`;
      const calculation = calculateScenario({
        baselineRequest,
        scenario: { scenarioId, optionKind: "requirement_change", factorOverrides: [], systemSpecification: specificationOverride },
      });
      const scenarioResult = calculation.scenarios.find((scenario) => scenario.scenarioId === scenarioId)?.calculation;
      const verifiedSideCpk = side === "lower" ? scenarioResult?.capability.lowerCpk : scenarioResult?.capability.upperCpk;
      if (scenarioResult === undefined || verifiedSideCpk === undefined
        || (verifiedSideCpk < baseline.capability.targetCpk && !equivalent(verifiedSideCpk, baseline.capability.targetCpk))) {
        throw new Error("F4 target verification failed.");
      }
      proposals.push({
        side,
        currentLimit: side === "lower" ? baseline.capability.lowerSpecLimit : baseline.capability.upperSpecLimit,
        proposedLimit,
        targetCpk: baseline.capability.targetCpk,
        currentSideCpk: side === "lower" ? baseline.capability.lowerCpk : baseline.capability.upperCpk,
        approvalRequired: true,
        capabilityImprovementClaim: false,
        scenarioEvidence: {
          featureId: "F4",
          calculationVersion: calculation.calculationVersion,
          baselineIdentity: inputBaselineIdentity(baseline),
          specificationOverride,
          result: { lowerCpk: scenarioResult.capability.lowerCpk, upperCpk: scenarioResult.capability.upperCpk },
          calculationReference: artifactReference(request.f4Reference),
        },
      });
    } catch {
      clarifications.push({ reasonCode: "f4_specification_verification_failed", requiredInputs: ["valid_f4_scenario_calculation"] });
    }
  }
  return { step: "specificationChanges", proposals, clarifications };
}

function toleranceOptimizationV3(
  request: F6OptimizationRequest,
  worksheet: F6OptimizationRequest["worksheets"][number],
  baselineRequest: CalculationRequest,
  calculateScenario: typeof calculateF6Scenario,
): F6OptimizationResultV3["worksheets"][number]["steps"][3] {
  const baseline = worksheet.baselineCalculation;
  const failedSides = [
    ...(baseline.capability.lowerCpk < baseline.capability.targetCpk ? ["lowerCpk" as const] : []),
    ...(baseline.capability.upperCpk < baseline.capability.targetCpk ? ["upperCpk" as const] : []),
  ];
  const options = builtInTop3Options(request, worksheet, baselineRequest, calculateScenario).map((option) => {
    if (option.status !== "completed" && option.status !== "calculation_failed") {
      throw new Error("Built-in Top 3 policy produced an unsupported option status.");
    }
    const policy = option.policyContext;
    if (policy === undefined) throw new Error("Built-in Top 3 policy context is required.");
    const reductionRatios = policy.reductions.map(({ reductionRatio }) => reductionRatio);
    const reductions = policy.reductions.map((reduction) => {
      const factor = exactFactor(baseline, reduction.factor);
      return {
        ...reduction,
        baselineLowerTolerance: factor.input.lowerTolerance,
        baselineUpperTolerance: factor.input.upperTolerance,
      };
    });
    if (option.status === "completed") {
      const factorOverrides = option.scenarioEvidence.factorOverrides.map((override) => {
        if (override.lowerTolerance === undefined || override.upperTolerance === undefined) {
          throw new Error("Built-in Top 3 policy requires both tolerance bounds.");
        }
        return {
          factor: override.factor,
          lowerTolerance: override.lowerTolerance,
          upperTolerance: override.upperTolerance,
        };
      });
      return {
        optionCode: policy.optionCode,
        status: option.status,
        reductionRatios,
        reductions,
        baselineMetrics: option.baselineMetrics,
        resultMetrics: option.resultMetrics,
        scenarioEvidence: {
          targetId: option.scenarioEvidence.targetId,
          baselineIdentity: option.scenarioEvidence.baselineIdentity,
          factorOverrides,
          calculationReference: option.scenarioEvidence.calculationReference,
          formulaReferences: option.scenarioEvidence.formulaReferences,
        },
      };
    }
    return {
      optionCode: policy.optionCode,
      status: option.status,
      reductionRatios,
      reductions,
      reasonCode: option.reasonCode,
      baselineMetrics: option.baselineMetrics,
      calculationReference: artifactReference(request.f4Reference),
    };
  });
  return {
    step: "toleranceOptimization",
    policyId: BUILT_IN_TOP3_POLICY_ID,
    trigger: {
      lowerCpk: baseline.capability.lowerCpk,
      upperCpk: baseline.capability.upperCpk,
      targetCpk: baseline.capability.targetCpk,
      failedSides,
    },
    options,
  };
}

export function createF6OptimizationV3(
  input: unknown,
  inputs: F6OptimizationV3Inputs,
  dependencies: OptimizationDependencies = {},
): F6OptimizationResultV3 {
  const request = f6OptimizationRequestSchema.parse(input);
  const multimodalWorksheets = verifiedMultimodalWorksheets(request, inputs.multimodalInterpretation);
  verifyV3OptimizationTargets(request, inputs);
  const calculateScenario = dependencies.calculateScenario ?? calculateF6Scenario;
  const baselineRequests = request.worksheets.map((worksheet) => verifiedBaselineRequest(worksheet.baselineCalculationRequest, worksheet.baselineCalculation));
  const worksheets = request.worksheets.map((worksheet, index) => {
    const baseline = worksheet.baselineCalculation;
    const multimodal = multimodalWorksheets[index]!;
    const centerAssessment = centerAssessmentV3(baseline, multimodal.result.imageTableInterpretation);
    const priorities = selectTopContributors(baseline.factors, baseline.factors.length).map((factor, priorityIndex) => ({
      rank: priorityIndex + 1,
      factor: factorIdentity(factor),
      contribution: factor.contribution,
      guidance: "tighten_tolerance" as const,
    }));
    const specificationChanges = specificationChangesV3(request, worksheet, baselineRequests[index]!, calculateScenario);
    const toleranceOptimization = toleranceOptimizationV3(request, worksheet, baselineRequests[index]!, calculateScenario);
    const runStatus = centerAssessment.status === "clarification_required"
      || specificationChanges.clarifications.length > 0
      || toleranceOptimization.options.some(({ status }) => status === "calculation_failed")
      ? "CLARIFICATION_REQUIRED" as const
      : "COMPLETED" as const;
    return {
      worksheetName: worksheet.worksheetName,
      tableId: baseline.worksheetSelection.tableId,
      runStatus,
      baselineIdentity: inputBaselineIdentity(baseline),
      baselineCapability: {
        lowerCpk: baseline.capability.lowerCpk,
        upperCpk: baseline.capability.upperCpk,
        targetCpk: baseline.capability.targetCpk,
      },
      steps: [centerAssessment, { step: "contributorPriorities" as const, priorities }, specificationChanges, toleranceOptimization] as const,
    };
  });
  const completedWorksheetCount = worksheets.filter(({ runStatus }) => runStatus === "COMPLETED").length;
  const summary = {
    worksheetCount: worksheets.length,
    completedWorksheetCount,
    clarificationRequiredWorksheetCount: worksheets.length - completedWorksheetCount,
    candidateOptionCount: 0 as const,
    completedOptionCount: worksheets.flatMap(({ steps }) => steps[3].options).filter(({ status }) => status === "completed").length,
    calculationFailedOptionCount: worksheets.flatMap(({ steps }) => steps[3].options).filter(({ status }) => status === "calculation_failed").length,
  };
  return immutable(f6OptimizationResultV3Schema.parse({
    contractVersion: request.contractVersion,
    outputClassification: "confidential",
    featureId: "F6",
    optimizationVersion: "f6-optimization-v3",
    sequentialPolicyId: "f6-sequential-optimization-policy-v1",
    interactionLanguage: inputs.interactionLanguage,
    runStatus: summary.clarificationRequiredWorksheetCount > 0 ? "CLARIFICATION_REQUIRED" : "COMPLETED",
    workbook: request.workbook,
    worksheets,
    summary,
    provenance: {
      f2Reference: artifactReference(request.f2Reference),
      f3Reference: artifactReference(request.f3Reference),
      f4Reference: artifactReference(request.f4Reference),
      f5Reference: artifactReference(request.f5Reference),
      multimodalReference: artifactReference(inputs.multimodalReference),
      reportScope: structuredClone(request.reportScope),
    },
  }));
}

type V4Worksheet = F6OptimizationResultV4["worksheets"][number];
type V4Snapshot = V4Worksheet["baselineResult"];
type V4Step1 = V4Worksheet["steps"][0];
type V4Step2 = V4Worksheet["steps"][1];
type V4Step3 = V4Worksheet["steps"][2];
type V4Sensitivity = V4Worksheet["sensitivityScenarios"][number];

function snapshotV4(
  request: F6OptimizationRequest,
  baseline: CalculationCompletedResult,
  calculation: Pick<CalculationCompletedResult, "system" | "capability" | "factors" | "traceRecords">,
  scenarioId: string,
  sourceStep: V4Snapshot["sourceStep"],
  inputScenarioId: string | null,
  factorOverrides: V4Snapshot["factorOverrides"],
  systemSpecificationOverride?: V4Snapshot["systemSpecificationOverride"],
): V4Snapshot {
  const specificationMidpoint = calculation.capability.lowerSpecLimit / 2 + calculation.capability.upperSpecLimit / 2;
  return {
    scenarioId,
    sourceStep,
    inputScenarioId,
    calculationVersion: "excel-ta-v1",
    calculationReference: artifactReference(request.f4Reference),
    baselineIdentity: inputBaselineIdentity(baseline),
    system: {
      designNominal: calculation.system.designNominal,
      mean: calculation.system.mean,
      specificationMidpoint,
      meanOffset: calculation.system.mean - specificationMidpoint,
      additionalMeanShift: calculation.system.additionalMeanShift,
      rssSigma: calculation.system.rssSigma,
      worstCaseLower: calculation.system.worstCaseLower,
      worstCaseUpper: calculation.system.worstCaseUpper,
    },
    capability: {
      lowerSpecLimit: calculation.capability.lowerSpecLimit,
      upperSpecLimit: calculation.capability.upperSpecLimit,
      targetCpk: calculation.capability.targetCpk,
      lowerCpk: calculation.capability.lowerCpk,
      upperCpk: calculation.capability.upperCpk,
      cpk: calculation.capability.cpk,
      yield: calculation.capability.yield,
      totalDpm: calculation.capability.totalDpm,
      status: calculation.capability.status,
    },
    factors: calculation.factors.map((factor) => ({
      factor: factorIdentity(factor),
      nominalValue: factor.input.nominalValue,
      lowerTolerance: factor.input.lowerTolerance,
      upperTolerance: factor.input.upperTolerance,
      mean: factor.mean,
      sigma: factor.sigma,
      contribution: factor.contribution,
    })),
    factorOverrides,
    ...(systemSpecificationOverride === undefined ? {} : { systemSpecificationOverride }),
    formulaReferences: calculation.traceRecords.map(({ outputField, formulaId, formulaVersion }) => ({ outputField, formulaId, formulaVersion })),
  };
}

function factorSnapshotKey(factor: { readonly factor: F6FactorIdentity }): string {
  return `${factor.factor.worksheetName}\u0000${factor.factor.tableId}\u0000${factor.factor.sourceRow}`;
}

function requestFromSnapshot(
  baselineRequest: CalculationRequest,
  snapshot: V4Snapshot,
): CalculationRequest {
  const request = structuredClone(baselineRequest);
  request.scenarioOverrides = [];
  request.systemSpecification.designNominal = snapshot.system.designNominal;
  request.systemSpecification.lowerSpecLimit = snapshot.capability.lowerSpecLimit;
  request.systemSpecification.upperSpecLimit = snapshot.capability.upperSpecLimit;
  request.systemSpecification.targetCpk = snapshot.capability.targetCpk;
  request.systemSpecification.additionalMeanShift = snapshot.system.additionalMeanShift;

  const factorBySource = new Map(snapshot.factors.map((factor) => [factorSnapshotKey(factor), factor]));
  request.worksheetAnalysisAssets.worksheets.forEach((worksheet) => {
    worksheet.factorTables.forEach((table) => {
      table.rows.forEach((row) => {
        const factor = factorBySource.get(`${worksheet.worksheetName}\u0000${table.tableId}\u0000${row.sourceRow}`);
        if (factor === undefined) {
          return;
        }
        const nominalValue = row.fields.nominalValue;
        const lowerTolerance = row.fields.lowerTolerance;
        const upperTolerance = row.fields.upperTolerance;
        if (nominalValue?.status !== "available"
          || lowerTolerance?.status !== "available"
          || upperTolerance?.status !== "available") {
          throw new Error("V4 scenario replay requires available Factor nominal and tolerance fields.");
        }
        nominalValue.numericValue = factor.nominalValue;
        nominalValue.rawText = String(factor.nominalValue);
        lowerTolerance.numericValue = factor.lowerTolerance;
        lowerTolerance.rawText = String(factor.lowerTolerance);
        upperTolerance.numericValue = factor.upperTolerance;
        upperTolerance.rawText = String(factor.upperTolerance);
      });
    });
  });
  return request;
}

function verifyV4OptimizationTargets(
  request: F6OptimizationRequest,
  inputs: F6OptimizationV4Inputs,
): ReadonlyMap<string, F6OptimizationTargets["worksheets"][number]["targets"]> {
  const decision = inputs.optimizationTargetsDecision ?? { outcome: "NOT_PROVIDED" };
  if ((inputs.optimizationTargets !== undefined) !== authorizedDecision(decision)) {
    throw new Error("Optimization Targets decision does not match the provided artifact.");
  }
  if (inputs.optimizationTargets === undefined) {
    return new Map<string, F6OptimizationTargets["worksheets"][number]["targets"]>();
  }
  const targets = f6OptimizationTargetsSchema.parse(inputs.optimizationTargets);
  if (targets.workbookContentHash !== request.workbook.contentHash) {
    throw new Error("Optimization Targets workbook identity does not match the F6 request.");
  }
  const worksheetMap = new Map<string, F6OptimizationTargets["worksheets"][number]["targets"]>();
  targets.worksheets.forEach((targetWorksheet) => {
    const worksheet = request.worksheets.find((candidate) => candidate.worksheetName === targetWorksheet.worksheetName
      && candidate.baselineCalculation.worksheetSelection.tableId === targetWorksheet.tableId);
    if (worksheet === undefined || !equivalent(targetWorksheet.baselineIdentity, inputBaselineIdentity(worksheet.baselineCalculation))) {
      throw new Error("Optimization Targets baseline identity does not match the governed F4 baseline.");
    }
    worksheetMap.set(`${targetWorksheet.worksheetName}\u0000${targetWorksheet.tableId}`, targetWorksheet.targets);
  });
  return worksheetMap;
}

function completedScenarioCalculation(
  calculation: CalculationCompletedResult,
  scenarioId: string,
): CalculationCompletedResult["scenarios"][number]["calculation"] {
  const scenario = calculation.scenarios.find((entry) => entry.scenarioId === scenarioId);
  if (scenario === undefined) {
    throw new Error("controlled scenario result missing");
  }
  return scenario.calculation;
}

function buildV4SensitivityScenarios(
  request: F6OptimizationRequest,
  worksheet: F6OptimizationRequest["worksheets"][number],
  baselineRequest: CalculationRequest,
  calculateScenario: typeof calculateF6Scenario,
): V4Worksheet["sensitivityScenarios"] {
  const baseline = worksheet.baselineCalculation;
  const selectedFactors = selectTopContributors(baseline.factors, Math.min(3, baseline.factors.length));
  const failedSides = [
    ...(baseline.capability.lowerCpk < baseline.capability.targetCpk ? ["lowerCpk" as const] : []),
    ...(baseline.capability.upperCpk < baseline.capability.targetCpk ? ["upperCpk" as const] : []),
  ];
  const baselineMetrics = metricsV2(baseline);

  const scenarios = BUILT_IN_TOP3_OPTIONS.map(({ optionCode, ratios }) => {
    const reductions = selectedFactors.map((factor, index) => ({
      factor: factorIdentity(factor),
      rank: index + 1,
      reductionRatio: ratios[index]!,
      scale: 1 - ratios[index]!,
      baselineLowerTolerance: factor.input.lowerTolerance,
      baselineUpperTolerance: factor.input.upperTolerance,
    }));
    const reductionRatios = reductions.map(({ reductionRatio }) => reductionRatio);
    const optionScenarioId = `${worksheet.worksheetName}:v4-sensitivity:${optionCode}`;
    try {
      const overrides = selectedFactors.map((factor, index) => scaledOverride(factor, 1 - ratios[index]!));
      const calculation = calculateScenario({
        baselineRequest,
        scenario: { scenarioId: optionScenarioId, optionKind: "requirement_change", factorOverrides: overrides },
      });
      const scenarioResult = completedScenarioCalculation(calculation, optionScenarioId);
      const factorOverrides = overrides.map((override, index) => ({
        factor: factorIdentity(selectedFactors[index]!),
        lowerTolerance: override.lowerTolerance,
        upperTolerance: override.upperTolerance,
      }));
      const completed: V4Sensitivity = {
        optionCode,
        status: "completed",
        reductionRatios,
        reductions,
        baselineMetrics,
        resultMetrics: metricsV2(scenarioResult),
        scenarioEvidence: {
          targetId: `f6-top3-tolerance-policy-v1:${optionCode}`,
          baselineIdentity: inputBaselineIdentity(baseline),
          factorOverrides,
          calculationReference: artifactReference(request.f4Reference),
          formulaReferences: scenarioResult.traceRecords.map(({ outputField, formulaId, formulaVersion }) => ({ outputField, formulaId, formulaVersion })),
        },
      };
      return completed;
    } catch {
      const failed: V4Sensitivity = {
        optionCode,
        status: "calculation_failed",
        reductionRatios,
        reductions,
        reasonCode: "built_in_calculation_failed",
        baselineMetrics,
        calculationReference: artifactReference(request.f4Reference),
      };
      return failed;
    }
  }) as [V4Sensitivity, V4Sensitivity, V4Sensitivity];

  if (failedSides.length === 0 && scenarios.length !== 3) {
    throw new Error("V4 sensitivity scenarios must contain OP1, OP2, and OP3.");
  }
  return scenarios;
}

export function createF6OptimizationV4(
  input: unknown,
  inputs: F6OptimizationV4Inputs,
  dependencies: OptimizationDependencies = {},
): F6OptimizationResultV4 {
  const request = f6OptimizationRequestSchema.parse(input);
  verifiedMultimodalWorksheets(request, inputs.multimodalInterpretation);
  const targetsByWorksheet = verifyV4OptimizationTargets(request, inputs);
  const calculateScenario = dependencies.calculateScenario ?? calculateF6Scenario;
  const baselineRequests = request.worksheets.map((worksheet) =>
    verifiedBaselineRequest(worksheet.baselineCalculationRequest, worksheet.baselineCalculation));

  const worksheets: V4Worksheet[] = request.worksheets.map((worksheet, index) => {
    const baseline = worksheet.baselineCalculation;
    const baselineRequest = baselineRequests[index]!;
    const baselineSnapshot = snapshotV4(
      request,
      baseline,
      baseline,
      `${worksheet.worksheetName}:baseline`,
      "baseline",
      null,
      [],
    );
    const trigger = {
      lowerCpk: baseline.capability.lowerCpk,
      upperCpk: baseline.capability.upperCpk,
      targetCpk: baseline.capability.targetCpk,
      failedSides: [
        ...(baseline.capability.lowerCpk < baseline.capability.targetCpk ? ["lowerCpk" as const] : []),
        ...(baseline.capability.upperCpk < baseline.capability.targetCpk ? ["upperCpk" as const] : []),
      ],
    };

    let step1: V4Step1;
    let step2: V4Step2;
    let step3: V4Step3;
    let selectedResult: V4Worksheet["selectedResult"];
    let lastValidSnapshot: V4Snapshot = baselineSnapshot;

    const worksheetTargets = targetsByWorksheet.get(`${worksheet.worksheetName}\u0000${worksheet.baselineCalculation.worksheetSelection.tableId}`) ?? [];

    if (baseline.capability.status === "PASS") {
      step1 = { step: "meanResponseCentering", status: "NOT_NEEDED" };
      step2 = { step: "toleranceReverseSolve", status: "NOT_NEEDED" };
      step3 = { step: "specificationRelaxation", status: "NOT_NEEDED" };
      selectedResult = { status: "baseline_meets_target", snapshot: baselineSnapshot };
    } else {
      const systemMeanShiftTarget = worksheetTargets
        .filter((target) => target.targetType === "system_mean_shift")
        .sort((left, right) => left.targetId.localeCompare(right.targetId))[0];
      const hasFactorNominalTarget = worksheetTargets.some((target) => target.targetType === "factor_nominal");
      if (systemMeanShiftTarget !== undefined) {
        try {
          const additionalMeanShift = "targetMean" in systemMeanShiftTarget.target
            ? baseline.system.additionalMeanShift + systemMeanShiftTarget.target.targetMean - baseline.system.mean
            : systemMeanShiftTarget.target.resultingAdditionalMeanShift;
          const scenarioId = `${worksheet.worksheetName}:step1:system_mean_shift_centering`;
          const calculation = calculateScenario({
            baselineRequest,
            scenario: {
              scenarioId,
              optionKind: "mean_shift_centering",
              factorOverrides: [],
              systemSpecification: { additionalMeanShift },
            },
          });
          const scenarioCalculation = completedScenarioCalculation(calculation, scenarioId);
          const snapshot = snapshotV4(
            request,
            baseline,
            scenarioCalculation,
            scenarioId,
            "meanResponseCentering",
            baselineSnapshot.scenarioId,
            [],
            { additionalMeanShift },
          );
          step1 = {
            step: "meanResponseCentering",
            status: snapshot.capability.status === "PASS" ? "COMPLETED_TARGET_MET" : "COMPLETED_TARGET_NOT_MET",
            result: snapshot,
          };
          lastValidSnapshot = snapshot;
        } catch {
          step1 = {
            step: "meanResponseCentering",
            status: "CALCULATION_FAILED",
            reasonCode: "f4_centering_verification_failed",
          };
        }
      } else if (hasFactorNominalTarget) {
        step1 = {
          step: "meanResponseCentering",
          status: "ENGINEERING_CONFIRMATION_REQUIRED",
          reasonCode: "signed_direction_evidence_required_for_factor_nominal_centering",
        };
      } else {
        step1 = { step: "meanResponseCentering", status: "NOT_NEEDED" };
      }

      if (step1.status === "COMPLETED_TARGET_MET") {
        step2 = { step: "toleranceReverseSolve", status: "NOT_RUN_EARLIER_STEP_MET_TARGET" };
        step3 = { step: "specificationRelaxation", status: "NOT_RUN_EARLIER_STEP_MET_TARGET" };
        selectedResult = { status: "step1_centered", snapshot: step1.result };
      } else {
        let step2Snapshot: V4Snapshot | undefined;
        try {
          const step2BaseRequest = requestFromSnapshot(baselineRequest, lastValidSnapshot);
          const step2Base = createCalculation(step2BaseRequest);
          if (step2Base.status !== "completed") {
            throw new Error("step2_base_unavailable");
          }
          const topFactors = selectTopContributors(step2Base.factors, Math.min(3, step2Base.factors.length));
          const guardedTargetRssSigma = solveGuardedTargetRssSigma({
            mean: step2Base.system.mean,
            lowerSpecLimit: step2Base.capability.lowerSpecLimit,
            upperSpecLimit: step2Base.capability.upperSpecLimit,
            targetCpk: step2Base.capability.targetCpk,
          });
          const toleranceChanges = solveTopNCombinedTolerance({
            factors: step2Base.factors,
            selectedSources: topFactors.map(({ source }) => source),
            targetRssSigma: guardedTargetRssSigma,
            allocation: "proportional-to-contribution",
          });
          const scenarioId = `${worksheet.worksheetName}:step2:tolerance_reverse_solve`;
          const calculation = calculateScenario({
            baselineRequest: step2BaseRequest,
            scenario: {
              scenarioId,
              optionKind: "reverse_solve_top_3",
              factorOverrides: toleranceChanges.map((change) => ({
                worksheetName: change.worksheetName,
                tableId: change.tableId,
                sourceRow: change.sourceRow,
                lowerTolerance: change.resultingLowerTolerance,
                upperTolerance: change.resultingUpperTolerance,
              })),
            },
          });
          const scenarioCalculation = completedScenarioCalculation(calculation, scenarioId);
          const factorOverrides = toleranceChanges.map((change) => {
            const factor = step2Base.factors.find((candidate) =>
              candidate.source.worksheetName === change.worksheetName
              && candidate.source.tableId === change.tableId
              && candidate.source.sourceRow === change.sourceRow);
            if (factor === undefined) {
              throw new Error("step2_factor_identity_mismatch");
            }
            return {
              factor: factorIdentity(factor),
              lowerTolerance: change.resultingLowerTolerance,
              upperTolerance: change.resultingUpperTolerance,
            };
          });
          step2Snapshot = snapshotV4(
            request,
            baseline,
            scenarioCalculation,
            scenarioId,
            "toleranceReverseSolve",
            lastValidSnapshot.scenarioId,
            factorOverrides,
          );
          step2 = {
            step: "toleranceReverseSolve",
            status: step2Snapshot.capability.status === "PASS" ? "COMPLETED_TARGET_MET" : "COMPLETED_TARGET_NOT_MET",
            result: step2Snapshot,
          };
          lastValidSnapshot = step2Snapshot;
        } catch (error) {
          const reasonCode = error instanceof F6SolverError
            ? error.code
            : "f4_tolerance_verification_failed";
          step2 = {
            step: "toleranceReverseSolve",
            status: error instanceof F6SolverError ? "NOT_FEASIBLE" : "CALCULATION_FAILED",
            reasonCode,
          };
        }

        if (step2.status === "COMPLETED_TARGET_MET") {
          step3 = { step: "specificationRelaxation", status: "NOT_RUN_EARLIER_STEP_MET_TARGET" };
          selectedResult = { status: "step2_tolerance_optimized", snapshot: step2.result };
        } else {
          try {
            const step3BaseRequest = requestFromSnapshot(baselineRequest, lastValidSnapshot);
            const step3Base = createCalculation(step3BaseRequest);
            if (step3Base.status !== "completed") {
              throw new Error("step3_base_unavailable");
            }
            const failedSides = [
              ...(step3Base.capability.lowerCpk < step3Base.capability.targetCpk ? ["lower" as const] : []),
              ...(step3Base.capability.upperCpk < step3Base.capability.targetCpk ? ["upper" as const] : []),
            ];
            if (failedSides.length === 0) {
              step3 = { step: "specificationRelaxation", status: "NOT_FEASIBLE", reasonCode: "no_failed_sides" };
              selectedResult = { status: "no_validated_optimized_result", snapshot: lastValidSnapshot };
            } else {
              const solved = solveOneSidedSpecificationLimits({
                mean: step3Base.system.mean,
                rssSigma: step3Base.system.rssSigma,
                targetCpk: step3Base.capability.targetCpk,
                lowerSpecLimit: step3Base.capability.lowerSpecLimit,
                upperSpecLimit: step3Base.capability.upperSpecLimit,
                failedSides,
              });
              if (solved.status === "clarification_required") {
                step3 = { step: "specificationRelaxation", status: "NOT_FEASIBLE", reasonCode: solved.reasonCode };
                selectedResult = { status: "no_validated_optimized_result", snapshot: lastValidSnapshot };
              } else {
                const scenarioId = `${worksheet.worksheetName}:step3:specification_relaxation`;
                const systemSpecification = {
                  ...(failedSides.includes("lower") ? { lowerSpecLimit: solved.lowerSpecLimit } : {}),
                  ...(failedSides.includes("upper") ? { upperSpecLimit: solved.upperSpecLimit } : {}),
                };
                const calculation = calculateScenario({
                  baselineRequest: step3BaseRequest,
                  scenario: {
                    scenarioId,
                    optionKind: "requirement_change",
                    factorOverrides: [],
                    systemSpecification,
                  },
                });
                const scenarioCalculation = completedScenarioCalculation(calculation, scenarioId);
                const snapshot = snapshotV4(
                  request,
                  baseline,
                  scenarioCalculation,
                  scenarioId,
                  "specificationRelaxation",
                  lastValidSnapshot.scenarioId,
                  [],
                  systemSpecification,
                );
                step3 = {
                  step: "specificationRelaxation",
                  status: snapshot.capability.status === "PASS" ? "COMPLETED_TARGET_MET" : "COMPLETED_TARGET_NOT_MET",
                  changeClass: "requirement_change",
                  approvalRequired: true,
                  capabilityImprovementClaim: false,
                  result: snapshot,
                };
                lastValidSnapshot = snapshot;
                selectedResult = snapshot.capability.status === "PASS"
                  ? {
                    status: "step3_specification_relaxed_pending_approval",
                    snapshot,
                  }
                  : {
                    status: "no_validated_optimized_result",
                    snapshot,
                  };
              }
            }
          } catch {
            step3 = {
              step: "specificationRelaxation",
              status: "CALCULATION_FAILED",
              reasonCode: "f4_specification_verification_failed",
            };
            selectedResult = { status: "no_validated_optimized_result", snapshot: lastValidSnapshot };
          }
        }
      }
    }

    const runStatus = [step1.status, step2.status, step3.status].some((status) =>
      status === "ENGINEERING_CONFIRMATION_REQUIRED"
      || status === "ENGINEERING_REVIEW_REQUIRED"
      || status === "CALCULATION_FAILED")
      ? "CLARIFICATION_REQUIRED"
      : "COMPLETED";

    return {
      worksheetName: worksheet.worksheetName,
      tableId: baseline.worksheetSelection.tableId,
      baselineIdentity: inputBaselineIdentity(baseline),
      baselineResult: baselineSnapshot,
      trigger,
      steps: [step1, step2, step3],
      selectedResult,
      sensitivityScenarios: buildV4SensitivityScenarios(request, worksheet, baselineRequest, calculateScenario),
      runStatus,
    };
  });

  const selectedStatuses = worksheets.map((worksheet) => worksheet.selectedResult.status);
  const summary = {
    worksheetCount: worksheets.length,
    baselineMeetsTargetWorksheetCount: selectedStatuses.filter((status) => status === "baseline_meets_target").length,
    optimizedWorksheetCount: selectedStatuses.filter((status) =>
      status === "step1_centered"
      || status === "step2_tolerance_optimized"
      || status === "step3_specification_relaxed_pending_approval").length,
    noValidatedResultWorksheetCount: selectedStatuses.filter((status) => status === "no_validated_optimized_result").length,
    clarificationRequiredWorksheetCount: worksheets.filter(({ runStatus }) => runStatus === "CLARIFICATION_REQUIRED").length,
  };

  return immutable(f6OptimizationResultV4Schema.parse({
    contractVersion: request.contractVersion,
    outputClassification: "confidential",
    featureId: "F6",
    optimizationVersion: "f6-optimization-v4",
    sequentialPolicyId: "f6-sequential-optimization-policy-v2",
    interactionLanguage: inputs.interactionLanguage,
    runStatus: summary.clarificationRequiredWorksheetCount > 0 ? "CLARIFICATION_REQUIRED" : "COMPLETED",
    workbook: request.workbook,
    worksheets,
    summary,
    provenance: {
      f2Reference: artifactReference(request.f2Reference),
      f3Reference: artifactReference(request.f3Reference),
      f4Reference: artifactReference(request.f4Reference),
      f5Reference: artifactReference(request.f5Reference),
      multimodalReference: artifactReference(inputs.multimodalReference),
      ...(inputs.imageObservationReference === undefined
        ? {}
        : { imageObservationReference: artifactReference(inputs.imageObservationReference) }),
      ...(inputs.supplierCapabilityReference === undefined
        ? {}
        : { supplierCapabilityReference: artifactReference(inputs.supplierCapabilityReference) }),
      ...(inputs.datumStrategyReference === undefined
        ? {}
        : { datumStrategyReference: artifactReference(inputs.datumStrategyReference) }),
      ...(inputs.costReference === undefined
        ? {}
        : { costReference: artifactReference(inputs.costReference) }),
      ...(inputs.analysisContextReference === undefined
        ? {}
        : { analysisContextReference: artifactReference(inputs.analysisContextReference) }),
      ...(inputs.optimizationTargetsReference === undefined
        ? {}
        : { optimizationTargetsReference: artifactReference(inputs.optimizationTargetsReference) }),
      reportScope: structuredClone(request.reportScope),
    },
  }));
}