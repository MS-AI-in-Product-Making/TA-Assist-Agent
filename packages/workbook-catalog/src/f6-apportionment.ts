import {
  f6ApportionmentResultSchema,
  f6CapabilityBoundSchema,
  type CalculationCompletedResult,
  type CalculationFactorResult,
  type F6ApportionmentResult,
  type F6CapabilityBound,
  type F6FeasibilityAssessment,
} from "@ai-assist/contracts";
import {
  factorSigmaToHalfTolerance,
  factorToleranceBandToSigma,
  F6NumericError,
  stableL2Norm as sharedStableL2Norm,
} from "./f6-numerics.js";
import { F6SolverError, solveTopNCombinedTolerance } from "./f6-solver.js";

type FactorSource = CalculationFactorResult["source"];
type ApportionmentPolicy = F6ApportionmentResult["policy"];

export interface ApportionRssToleranceInput {
  readonly factors: readonly CalculationCompletedResult["factors"][number][];
  readonly targetRssSigma: number;
  readonly policy: ApportionmentPolicy;
  readonly selectedSources: readonly FactorSource[];
  readonly capabilityBounds?: readonly F6CapabilityBound[];
}

interface AllocationValue {
  readonly factor: CalculationFactorResult;
  readonly targetSigma: number;
  readonly targetTolerance: number;
}

const MAX_SELECTED_SOURCES = 100;

function fail(
  code: "invalid_solver_input" | "missing_selected_source" | "duplicate_selected_source" | "target_unreachable",
  summary: string,
): never {
  throw new F6SolverError(code, summary);
}

function mapNumericError<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof F6NumericError) {
      fail(error.code, error.summary);
    }
    throw error;
  }
}

function stableL2Norm(values: readonly number[]): number {
  return mapNumericError(() => sharedStableL2Norm(values));
}

function sourceKey(source: FactorSource): string {
  return `${source.worksheetName}\u0000${source.tableId}\u0000${source.sourceRow}`;
}

function allocationKey(source: Pick<FactorSource, "tableId" | "sourceRow">): string {
  return `${source.tableId}\u0000${source.sourceRow}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareSources(left: FactorSource, right: FactorSource): number {
  return compareText(left.worksheetName, right.worksheetName)
    || compareText(left.tableId, right.tableId)
    || left.sourceRow - right.sourceRow;
}

function validateSource(source: FactorSource, label: string): void {
  if (source.worksheetName.length === 0 || source.tableId.length === 0) {
    fail("invalid_solver_input", `${label} worksheetName and tableId must be non-empty`);
  }
  if (!Number.isInteger(source.sourceRow) || source.sourceRow <= 0) {
    fail("invalid_solver_input", `${label}.sourceRow must be a positive integer`);
  }
}

function resolveFactors(input: ApportionRssToleranceInput): {
  readonly selectedFactors: readonly CalculationFactorResult[];
  readonly unselectedFactors: readonly CalculationFactorResult[];
} {
  if (input.selectedSources.length > MAX_SELECTED_SOURCES) {
    fail("invalid_solver_input", `selectedSources must contain at most ${MAX_SELECTED_SOURCES} entries`);
  }
  if (input.factors.length === 0) {
    fail("invalid_solver_input", "factors must not be empty");
  }
  if (input.selectedSources.length === 0) {
    fail("invalid_solver_input", "selectedSources must not be empty");
  }
  const factorMap = new Map<string, CalculationFactorResult>();
  input.factors.forEach((factor, index) => {
    validateSource(factor.source, `factors[${index}].source`);
    if (!(factor.sigma > 0) || !Number.isFinite(factor.sigma)) {
      fail("invalid_solver_input", `factors[${index}].sigma must be finite and greater than zero`);
    }
    const key = sourceKey(factor.source);
    if (factorMap.has(key)) {
      fail("invalid_solver_input", `factor source must be unique: ${key}`);
    }
    factorMap.set(key, factor);
  });

  const selectedKeys = new Set<string>();
  const allocationKeys = new Set<string>();
  const selectedFactors = input.selectedSources.map((source, index) => {
    validateSource(source, `selectedSources[${index}]`);
    const key = sourceKey(source);
    if (selectedKeys.has(key)) {
      fail("duplicate_selected_source", `selected source must be unique: ${key}`);
    }
    selectedKeys.add(key);
    const factor = factorMap.get(key);
    if (factor === undefined) {
      fail("missing_selected_source", `selected source was not found: ${key}`);
    }
    const outputKey = allocationKey(source);
    if (allocationKeys.has(outputKey)) {
      fail("invalid_solver_input", `selected sources must have unique output identities: ${outputKey}`);
    }
    allocationKeys.add(outputKey);
    return factor;
  });

  return {
    selectedFactors,
    unselectedFactors: input.factors.filter((factor) => !selectedKeys.has(sourceKey(factor.source))),
  };
}

function selectedTargetSigma(targetRssSigma: number, fixedSigma: number): number | undefined {
  const comparisonTolerance = 32 * Number.EPSILON * Math.max(targetRssSigma, fixedSigma);
  if (fixedSigma - targetRssSigma > comparisonTolerance) return undefined;
  if (Math.abs(fixedSigma - targetRssSigma) <= comparisonTolerance) return 0;
  if (fixedSigma === 0) return targetRssSigma;
  const ratio = fixedSigma / targetRssSigma;
  const result = targetRssSigma * Math.sqrt((1 - ratio) * (1 + ratio));
  return result > 0 && Number.isFinite(result) ? result : undefined;
}

function sigmaForTolerance(factor: CalculationFactorResult, targetTolerance: number): number {
  return mapNumericError(() => factorToleranceBandToSigma(factor, targetTolerance * 2));
}

function toleranceForSigma(factor: CalculationFactorResult, targetSigma: number): number {
  return mapNumericError(() => factorSigmaToHalfTolerance(factor, targetSigma));
}

function residualError(
  targetRssSigma: number,
  unselectedFactors: readonly CalculationFactorResult[],
  allocations: readonly AllocationValue[],
): number {
  const achieved = stableL2Norm([
    ...unselectedFactors.map((factor) => factor.sigma),
    ...allocations.map(({ targetSigma }) => targetSigma),
  ]);
  const residual = Math.abs(achieved - targetRssSigma);
  return residual <= 32 * Number.EPSILON * targetRssSigma ? 0 : residual;
}

function result(
  policy: ApportionmentPolicy,
  targetRssSigma: number,
  allocations: readonly AllocationValue[],
  residual: number,
  feasibility: F6FeasibilityAssessment,
): F6ApportionmentResult {
  return f6ApportionmentResultSchema.parse({
    policy,
    targetRssSigma,
    allocations: [...allocations]
      .sort((left, right) => compareSources(left.factor.source, right.factor.source))
      .map(({ factor, targetSigma, targetTolerance }) => ({
        tableId: factor.source.tableId,
        sourceRow: factor.source.sourceRow,
        targetSigma,
        targetTolerance,
      })),
    residualError: residual,
    feasibility,
  });
}

function evidenceReferences(bounds: readonly F6CapabilityBound[]): string[] {
  return [...new Set(bounds.map(({ evidenceReference }) => evidenceReference))].sort(compareText);
}

function validateBounds(bounds: readonly F6CapabilityBound[]): {
  readonly boundMap: ReadonlyMap<string, F6CapabilityBound>;
  readonly hasDuplicate: boolean;
} {
  const boundMap = new Map<string, F6CapabilityBound>();
  let hasDuplicate = false;
  bounds.forEach((bound, index) => {
    const parsed = f6CapabilityBoundSchema.safeParse(bound);
    if (!parsed.success) {
      fail("invalid_solver_input", `capabilityBounds[${index}] is invalid`);
    }
    const key = allocationKey(parsed.data);
    if (boundMap.has(key)) {
      hasDuplicate = true;
    }
    boundMap.set(key, parsed.data);
  });
  return { boundMap, hasDuplicate };
}

function boundedAllocations(
  selectedFactors: readonly CalculationFactorResult[],
  selectedSigma: number,
  selectedBounds: readonly F6CapabilityBound[],
): readonly AllocationValue[] {
  const limits = selectedFactors
    .map((factor, index) => {
      const bound = selectedBounds[index]!;
      const minimumTolerance = bound.minimumToleranceBand / 2;
      const maximumTolerance = bound.maximumToleranceBand / 2;
      return {
        factor,
        minimumTolerance,
        maximumTolerance,
        minimumSigma: minimumTolerance === 0 ? 0 : sigmaForTolerance(factor, minimumTolerance),
        maximumSigma: maximumTolerance === 0 ? 0 : sigmaForTolerance(factor, maximumTolerance),
      };
    })
    .sort((left, right) => compareSources(left.factor.source, right.factor.source));
  const minimumNorm = stableL2Norm(limits.map(({ minimumSigma }) => minimumSigma));
  const maximumNorm = stableL2Norm(limits.map(({ maximumSigma }) => maximumSigma));
  if (selectedSigma === 0) {
    return limits.map(({ factor, minimumSigma, minimumTolerance }) => ({
      factor,
      targetSigma: minimumSigma,
      targetTolerance: minimumTolerance,
    }));
  }
  if (selectedSigma < minimumNorm) {
    return limits.map(({ factor, minimumSigma, minimumTolerance }) => ({
      factor,
      targetSigma: minimumSigma,
      targetTolerance: minimumTolerance,
    }));
  }
  if (selectedSigma > maximumNorm) {
    return limits.map(({ factor, maximumSigma, maximumTolerance }) => ({
      factor,
      targetSigma: maximumSigma,
      targetTolerance: maximumTolerance,
    }));
  }

  const normalized = limits.map((limit, index) => ({
    ...limit,
    index,
    assignedVariance: (limit.minimumSigma / selectedSigma) ** 2,
    capacity: Math.max(0,
      (limit.maximumSigma / selectedSigma - limit.minimumSigma / selectedSigma)
      * (limit.maximumSigma / selectedSigma + limit.minimumSigma / selectedSigma)),
  }));
  let remainingVariance = Math.max(0, 1 - normalized.reduce(
    (sum, limit) => sum + limit.assignedVariance,
    0,
  ));
  let active = normalized.map(({ index }) => index);
  const varianceTolerance = 32 * Number.EPSILON;
  while (remainingVariance > varianceTolerance && active.length > 0) {
    const varianceShare = remainingVariance / active.length;
    let distributedVariance = 0;
    const nextActive: number[] = [];
    active.forEach((index) => {
      const limit = normalized[index]!;
      const allocation = Math.min(varianceShare, limit.capacity);
      limit.assignedVariance += allocation;
      limit.capacity -= allocation;
      distributedVariance += allocation;
      if (limit.capacity > varianceTolerance) nextActive.push(index);
    });
    if (distributedVariance <= varianceTolerance) break;
    remainingVariance = Math.max(0, remainingVariance - distributedVariance);
    active = nextActive;
  }

  return normalized.map(({ factor, assignedVariance }) => {
    const targetSigma = selectedSigma * Math.sqrt(assignedVariance);
    return { factor, targetSigma, targetTolerance: toleranceForSigma(factor, targetSigma) };
  });
}

export function apportionRssTolerance(input: ApportionRssToleranceInput): F6ApportionmentResult {
  if (!(input.targetRssSigma > 0) || !Number.isFinite(input.targetRssSigma)) {
    fail("invalid_solver_input", "targetRssSigma must be finite and greater than zero");
  }
  const { selectedFactors, unselectedFactors } = resolveFactors(input);
  const fixedSigma = stableL2Norm(unselectedFactors.map((factor) => factor.sigma));

  let selectedBounds: readonly F6CapabilityBound[] | undefined;
  if (input.policy === "bounded-by-capability") {
    const bounds = input.capabilityBounds ?? [];
    const { boundMap, hasDuplicate } = validateBounds(bounds);
    const resolvedBounds = selectedFactors.map((factor) => boundMap.get(allocationKey(factor.source)));
    const hasCompleteBounds = !hasDuplicate
      && bounds.length === selectedFactors.length
      && resolvedBounds.every((bound) => bound !== undefined);
    if (!hasCompleteBounds) {
      return result(input.policy, input.targetRssSigma, [], residualError(input.targetRssSigma, unselectedFactors, []), {
        status: "insufficient_evidence",
        reasonCodes: ["missing_capability_bounds"],
        evidenceReferences: evidenceReferences(bounds),
      });
    }
    selectedBounds = resolvedBounds as readonly F6CapabilityBound[];
  }

  const availableSelectedSigma = selectedTargetSigma(input.targetRssSigma, fixedSigma);
  if (availableSelectedSigma === undefined) {
    return result(input.policy, input.targetRssSigma, [], residualError(input.targetRssSigma, unselectedFactors, []), {
      status: "not_supported",
      reasonCodes: ["fixed_variance_exceeds_rss_target"],
      evidenceReferences: [],
    });
  }

  if (input.policy !== "bounded-by-capability") {
    if (availableSelectedSigma === 0) {
      const allocations = selectedFactors.map((factor) => ({ factor, targetSigma: 0, targetTolerance: 0 }));
      return result(input.policy, input.targetRssSigma, allocations, residualError(input.targetRssSigma, unselectedFactors, allocations), {
        status: "supported",
        reasonCodes: ["rss_target_met"],
        evidenceReferences: [],
      });
    }
    const allocation = input.policy === "equal-allocation-among-top-N"
      ? "equal-allocation-among-top-N"
      : "proportional-to-contribution";
    const changes = solveTopNCombinedTolerance({
      factors: input.factors,
      selectedSources: input.selectedSources,
      targetRssSigma: input.targetRssSigma,
      allocation,
    });
    const factorByKey = new Map(selectedFactors.map((factor) => [sourceKey(factor.source), factor]));
    const allocations = changes.map((change) => {
      const factor = factorByKey.get(sourceKey({
        worksheetName: change.worksheetName,
        tableId: change.tableId,
        sourceRow: change.sourceRow,
      }))!;
      const targetTolerance = change.resultingBand / 2;
      return { factor, targetTolerance, targetSigma: sigmaForTolerance(factor, targetTolerance) };
    });
    const residual = residualError(input.targetRssSigma, unselectedFactors, allocations);
    return result(input.policy, input.targetRssSigma, allocations, residual, {
      status: residual <= 1e-12 * input.targetRssSigma ? "supported" : "not_supported",
      reasonCodes: [residual <= 1e-12 * input.targetRssSigma ? "rss_target_met" : "rss_target_not_met"],
      evidenceReferences: [],
    });
  }

  const allocations = boundedAllocations(
    selectedFactors,
    availableSelectedSigma,
    selectedBounds!,
  );
  const residual = residualError(input.targetRssSigma, unselectedFactors, allocations);
  const supported = residual <= 1e-12 * input.targetRssSigma;
  return result(input.policy, input.targetRssSigma, allocations, residual, {
    status: supported ? "requires_engineering_review" : "not_supported",
    reasonCodes: [supported ? "rss_target_met_with_capability_bounds" : "capability_bounds_exclude_rss_target"],
    evidenceReferences: evidenceReferences(selectedBounds!),
  });
}