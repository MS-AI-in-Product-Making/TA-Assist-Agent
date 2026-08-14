import {
  f6ReverseSolveResultSchema,
  f6ToleranceChangeSchema,
  type F6ReverseSolveResult,
  CalculationFactorResult,
  type Distribution,
  type F6ToleranceChange,
} from "@ai-assist/contracts";

type FactorSource = CalculationFactorResult["source"];

const DISTRIBUTION_MULTIPLIER: Readonly<Record<Distribution, number>> = {
  normal: 1,
  uniform: 1.732,
  triangular: 1.225,
  trapezoidal: 1.369,
  elliptical: 1.5,
  beta: 2.023,
};

export type F6SolverErrorCode =
  | "invalid_solver_input"
  | "missing_selected_source"
  | "duplicate_selected_source"
  | "target_unreachable";

export class F6SolverError extends Error {
  readonly code: F6SolverErrorCode;
  readonly summary: string;

  constructor(code: F6SolverErrorCode, summary: string) {
    super(`${code}: ${summary}`);
    this.name = "F6SolverError";
    this.code = code;
    this.summary = summary;
  }
}

export interface ScaleToleranceBandInput {
  readonly lowerTolerance: number;
  readonly upperTolerance: number;
  readonly scale: number;
}

export interface ScaleToleranceBandResult {
  readonly lowerTolerance: number;
  readonly upperTolerance: number;
  readonly center: number;
  readonly originalBand: number;
  readonly resultingBand: number;
}

type SpecificationBounds =
  | {
      readonly lowerSpecLimit: number;
      readonly upperSpecLimit: number;
      readonly LSL?: never;
      readonly USL?: never;
    }
  | {
      readonly LSL: number;
      readonly USL: number;
      readonly lowerSpecLimit?: never;
      readonly upperSpecLimit?: never;
    };

export type CenteringInput = SpecificationBounds & {
  readonly factorMeans: readonly number[];
};

export interface CenteringResult {
  readonly targetMean: number;
  readonly additionalMeanShift: number;
}

export type TargetRssSigmaInput = SpecificationBounds & {
  readonly mean: number;
  readonly targetCpk: number;
};

export interface SingleFactorSolveInput {
  readonly factors: readonly CalculationFactorResult[];
  readonly selectedSource: FactorSource;
  readonly targetRssSigma: number;
}

export type TopNAllocation =
  | "proportional-to-contribution"
  | "equal-allocation-among-top-N";

export interface TopNSolveInput {
  readonly factors: readonly CalculationFactorResult[];
  readonly selectedSources: readonly FactorSource[];
  readonly targetRssSigma: number;
  readonly allocation: TopNAllocation;
}

export type CreateReverseSolveResultInput = F6ReverseSolveResult;

function fail(code: F6SolverErrorCode, summary: string): never {
  throw new F6SolverError(code, summary);
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    fail("invalid_solver_input", `${label} must be finite`);
  }
}

function safePositiveProductQuotient(
  numeratorValues: readonly number[],
  denominatorValues: readonly number[],
  label: string,
): number {
  const values = [...numeratorValues, ...denominatorValues];
  if (values.some((value) => !(value > 0) || !Number.isFinite(value))) {
    fail("invalid_solver_input", `${label} factors must be finite and greater than zero`);
  }

  const numeratorProduct = numeratorValues.reduce((product, value) => product * value, 1);
  const denominatorProduct = denominatorValues.reduce((product, value) => product * value, 1);
  const directResult = numeratorProduct / denominatorProduct;
  if (directResult > 0 && Number.isFinite(directResult)) {
    return directResult;
  }

  let coefficient = 1;
  let decimalExponent = 0;
  const accumulate = (value: number, divide: boolean): void => {
    const [coefficientText, exponentText] = value.toExponential(17).split("e");
    const valueCoefficient = Number(coefficientText);
    const valueExponent = Number(exponentText);
    coefficient = divide ? coefficient / valueCoefficient : coefficient * valueCoefficient;
    decimalExponent += divide ? -valueExponent : valueExponent;
    if (coefficient >= 10) {
      coefficient /= 10;
      decimalExponent += 1;
    } else if (coefficient < 1) {
      coefficient *= 10;
      decimalExponent -= 1;
    }
  };

  for (const numerator of numeratorValues) {
    accumulate(numerator, false);
  }
  for (const denominator of denominatorValues) {
    accumulate(denominator, true);
  }

  if (decimalExponent > 308 || decimalExponent < -324) {
    fail("invalid_solver_input", `${label} must be finite and representable`);
  }
  let result = coefficient;
  while (decimalExponent !== 0) {
    const exponentStep = Math.max(-308, Math.min(308, decimalExponent));
    result *= 10 ** exponentStep;
    decimalExponent -= exponentStep;
  }
  if (!(result > 0) || !Number.isFinite(result)) {
    fail("invalid_solver_input", `${label} must be finite and representable`);
  }
  return result;
}

function positiveDifference(upperValue: number, lowerValue: number, label: string): number {
  const difference = upperValue - lowerValue;
  if (!(difference > 0) || !Number.isFinite(difference)) {
    fail("invalid_solver_input", `${label} must be finite and representable`);
  }
  return difference;
}

function midpoint(lowerValue: number, upperValue: number): number {
  const sum = lowerValue + upperValue;
  const result = Number.isFinite(sum) ? sum / 2 : lowerValue / 2 + upperValue / 2;
  assertFinite(result, "bandCenter");
  return result;
}

function buildToleranceChange(change: F6ToleranceChange): F6ToleranceChange {
  if (!(change.resultingLowerTolerance < change.resultingUpperTolerance)) {
    fail("target_unreachable", "target tolerance endpoints are not separately representable");
  }
  const representedBand = change.resultingUpperTolerance - change.resultingLowerTolerance;
  const schemaTolerance = 1e-12 * Math.max(1, Math.abs(change.resultingBand), Math.abs(representedBand));
  if (!Number.isFinite(representedBand) || Math.abs(change.resultingBand - representedBand) > schemaTolerance) {
    fail("target_unreachable", "represented target tolerance band does not match the requested band");
  }
  const parsed = f6ToleranceChangeSchema.safeParse(change);
  if (!parsed.success) {
    fail("target_unreachable", "target tolerance change is not representable by the solver contract");
  }
  return parsed.data;
}

function assertValidSpecBounds(lowerSpecLimit: number, upperSpecLimit: number): void {
  assertFinite(lowerSpecLimit, "lowerSpecLimit");
  assertFinite(upperSpecLimit, "upperSpecLimit");
  if (!(upperSpecLimit > lowerSpecLimit)) {
    fail("invalid_solver_input", "upperSpecLimit must be greater than lowerSpecLimit");
  }
}

function sourceKey(source: FactorSource): string {
  return `${source.worksheetName}\u0000${source.tableId}\u0000${source.sourceRow}`;
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

function validateFactor(factor: CalculationFactorResult, index: number): void {
  const label = `factor[${index}]`;
  validateSource(factor.source, `${label}.source`);
  for (const [field, value] of [
    ["sigma", factor.sigma],
    ["contribution", factor.contribution],
    ["lowerTolerance", factor.input.lowerTolerance],
    ["upperTolerance", factor.input.upperTolerance],
    ["longTermSafetyFactor", factor.input.longTermSafetyFactor],
    ["sigmaLevel", factor.input.sigmaLevel],
  ] as const) {
    assertFinite(value, `${label}.${field}`);
  }
  if (!(factor.sigma > 0)) {
    fail("invalid_solver_input", `${label}.sigma must be greater than zero`);
  }
  if (factor.contribution < 0) {
    fail("invalid_solver_input", `${label}.contribution must be non-negative`);
  }
  if (!(factor.input.upperTolerance > factor.input.lowerTolerance)) {
    fail("invalid_solver_input", `${label} tolerance bounds must define a positive band`);
  }
  positiveDifference(factor.input.upperTolerance, factor.input.lowerTolerance, `${label}.originalBand`);
  if (!(factor.input.longTermSafetyFactor > 0)) {
    fail("invalid_solver_input", `${label}.longTermSafetyFactor must be greater than zero`);
  }
  if (!(factor.input.sigmaLevel > 0)) {
    fail("invalid_solver_input", `${label}.sigmaLevel must be greater than zero`);
  }
  if (DISTRIBUTION_MULTIPLIER[factor.input.distribution] === undefined) {
    fail("invalid_solver_input", `${label}.distribution is unsupported`);
  }
}

function buildFactorMap(factors: readonly CalculationFactorResult[]): ReadonlyMap<string, CalculationFactorResult> {
  if (factors.length === 0) {
    fail("invalid_solver_input", "factors must not be empty");
  }
  const factorMap = new Map<string, CalculationFactorResult>();
  factors.forEach((factor, index) => {
    validateFactor(factor, index);
    const key = sourceKey(factor.source);
    if (factorMap.has(key)) {
      fail("invalid_solver_input", `factor source must be unique: ${key}`);
    }
    factorMap.set(key, factor);
  });
  return factorMap;
}

function resolveSelectedFactors(
  factorMap: ReadonlyMap<string, CalculationFactorResult>,
  selectedSources: readonly FactorSource[],
): readonly CalculationFactorResult[] {
  if (selectedSources.length === 0) {
    fail("invalid_solver_input", "selectedSources must not be empty");
  }
  const seen = new Set<string>();
  return selectedSources.map((source, index) => {
    validateSource(source, `selectedSources[${index}]`);
    const key = sourceKey(source);
    if (seen.has(key)) {
      fail("duplicate_selected_source", `selected source must be unique: ${key}`);
    }
    seen.add(key);
    const factor = factorMap.get(key);
    if (factor === undefined) {
      fail("missing_selected_source", `selected source was not found: ${key}`);
    }
    return factor;
  });
}

function assertTargetRssSigma(targetRssSigma: number): void {
  assertFinite(targetRssSigma, "targetRssSigma");
  if (!(targetRssSigma > 0)) {
    fail("invalid_solver_input", "targetRssSigma must be greater than zero");
  }
}

function stableL2Norm(values: readonly number[]): number {
  let scale = 0;
  let sumSquares = 1;

  for (const value of values) {
    const absValue = Math.abs(value);
    if (absValue === 0) {
      continue;
    }
    if (scale < absValue) {
      const ratio = scale / absValue;
      sumSquares = 1 + sumSquares * ratio * ratio;
      scale = absValue;
      continue;
    }
    const ratio = absValue / scale;
    sumSquares += ratio * ratio;
  }

  return scale === 0 ? 0 : scale * Math.sqrt(sumSquares);
}

function remainingSigma(targetSigma: number, fixedSigma: number): number {
  if (fixedSigma === 0) {
    return targetSigma;
  }
  const ratio = fixedSigma / targetSigma;
  const equalityTolerance = 16 * Number.EPSILON;
  if (!Number.isFinite(ratio) || ratio >= 1 - equalityTolerance) {
    fail("target_unreachable", "fixed factors consume the target RSS variance");
  }
  const result = targetSigma * Math.sqrt((1 - ratio) * (1 + ratio));
  if (!(result > 0) || !Number.isFinite(result)) {
    fail("target_unreachable", "fixed factors consume the target RSS variance");
  }
  return result;
}

function toleranceChangeForSigma(
  factor: CalculationFactorResult,
  targetSigma: number,
): F6ToleranceChange {
  assertFinite(targetSigma, "targetSigma");
  if (!(targetSigma > 0)) {
    fail("target_unreachable", "target factor sigma must be greater than zero");
  }
  const distributionMultiplier = DISTRIBUTION_MULTIPLIER[factor.input.distribution];
  if (!(distributionMultiplier > 0) || !Number.isFinite(distributionMultiplier)) {
    fail("invalid_solver_input", "distribution multiplier must be finite and greater than zero");
  }
  const targetHalfTolerance = safePositiveProductQuotient(
    [targetSigma, factor.input.sigmaLevel],
    [factor.input.longTermSafetyFactor, distributionMultiplier],
    "targetHalfTolerance",
  );
  const originalLowerTolerance = factor.input.lowerTolerance;
  const originalUpperTolerance = factor.input.upperTolerance;
  const originalBand = positiveDifference(originalUpperTolerance, originalLowerTolerance, "originalBand");
  const bandCenter = midpoint(originalLowerTolerance, originalUpperTolerance);
  const resultingBand = safePositiveProductQuotient([targetHalfTolerance, 2], [1], "resultingBand");
  const resultingLowerTolerance = bandCenter - targetHalfTolerance;
  const resultingUpperTolerance = bandCenter + targetHalfTolerance;
  assertFinite(resultingLowerTolerance, "resultingLowerTolerance");
  assertFinite(resultingUpperTolerance, "resultingUpperTolerance");

  return buildToleranceChange({
    worksheetName: factor.source.worksheetName,
    tableId: factor.source.tableId,
    sourceRow: factor.source.sourceRow,
    originalLowerTolerance,
    originalUpperTolerance,
    resultingLowerTolerance,
    resultingUpperTolerance,
    originalBand,
    resultingBand,
    bandCenter,
  });
}

export function scaleToleranceBandAroundCenter(input: ScaleToleranceBandInput): ScaleToleranceBandResult {
  assertFinite(input.lowerTolerance, "lowerTolerance");
  assertFinite(input.upperTolerance, "upperTolerance");
  assertFinite(input.scale, "scale");
  if (!(input.upperTolerance > input.lowerTolerance)) {
    fail("invalid_solver_input", "upperTolerance must be greater than lowerTolerance");
  }
  if (!(input.scale > 0 && input.scale <= 1)) {
    fail("invalid_solver_input", "scale must be in the interval (0, 1]");
  }
  const originalBand = positiveDifference(input.upperTolerance, input.lowerTolerance, "originalBand");
  const center = midpoint(input.lowerTolerance, input.upperTolerance);
  if (input.scale === 1) {
    return {
      lowerTolerance: input.lowerTolerance,
      upperTolerance: input.upperTolerance,
      center,
      originalBand,
      resultingBand: originalBand,
    };
  }
  const resultingBand = safePositiveProductQuotient([input.scale, originalBand], [1], "resultingBand");
  const lowerTolerance = center - resultingBand / 2;
  const upperTolerance = center + resultingBand / 2;
  assertFinite(lowerTolerance, "resultingLowerTolerance");
  assertFinite(upperTolerance, "resultingUpperTolerance");
  if (!(lowerTolerance < upperTolerance)) {
    fail("target_unreachable", "target tolerance endpoints are not separately representable");
  }
  const representedBand = upperTolerance - lowerTolerance;
  const representationTolerance = 8 * Number.EPSILON * Math.max(resultingBand, representedBand);
  if (Math.abs(representedBand - resultingBand) > representationTolerance) {
    fail("target_unreachable", "represented target tolerance band does not match the requested band");
  }
  return {
    lowerTolerance,
    upperTolerance,
    center,
    originalBand,
    resultingBand,
  };
}

export function selectTopContributors(
  factors: readonly CalculationFactorResult[],
  count: number,
): readonly CalculationFactorResult[] {
  if (!Number.isInteger(count) || count <= 0 || count > factors.length) {
    fail("invalid_solver_input", "count must be a positive integer no greater than factors.length");
  }
  factors.forEach((factor, index) => {
    assertFinite(factor.contribution, `factor[${index}].contribution`);
    if (factor.contribution < 0) {
      fail("invalid_solver_input", `factor[${index}].contribution must be non-negative`);
    }
    validateSource(factor.source, `factor[${index}].source`);
  });
  return [...factors]
    .sort((left, right) => right.contribution - left.contribution || compareSources(left.source, right.source))
    .slice(0, count);
}

export function solveCenteringShift(input: CenteringInput): CenteringResult {
  const [lowerSpecLimit, upperSpecLimit] = resolveSpecBounds(input);
  if (input.factorMeans.length === 0) {
    fail("invalid_solver_input", "factorMeans must not be empty");
  }
  const currentMean = input.factorMeans.reduce((sum, factorMean, index) => {
    assertFinite(factorMean, `factorMeans[${index}]`);
    return sum + factorMean;
  }, 0);
  assertFinite(currentMean, "currentMean");
  const targetMean = midpoint(lowerSpecLimit, upperSpecLimit);
  const additionalMeanShift = targetMean - currentMean;
  assertFinite(additionalMeanShift, "additionalMeanShift");
  return { targetMean, additionalMeanShift };
}

export function solveTargetRssSigma(input: TargetRssSigmaInput): number {
  const [lowerSpecLimit, upperSpecLimit] = resolveSpecBounds(input);
  assertFinite(input.mean, "mean");
  assertFinite(input.targetCpk, "targetCpk");
  if (!(input.mean > lowerSpecLimit && input.mean < upperSpecLimit)) {
    fail("invalid_solver_input", "mean must be strictly inside the specification bounds");
  }
  if (!(input.targetCpk > 0)) {
    fail("invalid_solver_input", "targetCpk must be greater than zero");
  }
  const lowerTargetSigma = (input.mean - lowerSpecLimit) / input.targetCpk / 3;
  const upperTargetSigma = (upperSpecLimit - input.mean) / input.targetCpk / 3;
  const targetRssSigma = Math.min(lowerTargetSigma, upperTargetSigma);
  if (!(targetRssSigma > 0) || !Number.isFinite(targetRssSigma)) {
    fail("invalid_solver_input", "targetRssSigma must be finite and representable");
  }
  return targetRssSigma;
}

export function solveSingleFactorTolerance(input: SingleFactorSolveInput): F6ToleranceChange {
  assertTargetRssSigma(input.targetRssSigma);
  const factorMap = buildFactorMap(input.factors);
  const selectedFactor = resolveSelectedFactors(factorMap, [input.selectedSource])[0]!;
  const fixedSigma = stableL2Norm(
    input.factors.map((factor) => factor === selectedFactor ? 0 : factor.sigma),
  );
  return toleranceChangeForSigma(selectedFactor, remainingSigma(input.targetRssSigma, fixedSigma));
}

export function solveTopNCombinedTolerance(input: TopNSolveInput): readonly F6ToleranceChange[] {
  assertTargetRssSigma(input.targetRssSigma);
  const factorMap = buildFactorMap(input.factors);
  const selectedFactors = resolveSelectedFactors(factorMap, input.selectedSources);
  const selectedKeys = new Set(input.selectedSources.map(sourceKey));
  const fixedSigma = stableL2Norm(
    input.factors.map((factor) => selectedKeys.has(sourceKey(factor.source)) ? 0 : factor.sigma),
  );
  const selectedTargetSigma = remainingSigma(input.targetRssSigma, fixedSigma);

  let weights: readonly number[];
  if (input.allocation === "equal-allocation-among-top-N") {
    weights = selectedFactors.map(() => 1 / selectedFactors.length);
  } else if (input.allocation === "proportional-to-contribution") {
    const maximumContribution = Math.max(...selectedFactors.map((factor) => factor.contribution));
    if (!(maximumContribution > 0) || !Number.isFinite(maximumContribution)) {
      fail("target_unreachable", "selected factors must have positive total contribution");
    }
    const scaledContributions = selectedFactors.map((factor) => factor.contribution / maximumContribution);
    const scaledContributionSum = scaledContributions.reduce((sum, contribution) => sum + contribution, 0);
    if (!(scaledContributionSum > 0) || !Number.isFinite(scaledContributionSum)) {
      fail("target_unreachable", "selected factors must have positive total contribution");
    }
    weights = scaledContributions.map((contribution) => contribution / scaledContributionSum);
  } else {
    fail("invalid_solver_input", "allocation is unsupported");
  }

  return selectedFactors.map((factor, index) => {
    const targetSigma = selectedTargetSigma * Math.sqrt(weights[index]!);
    return toleranceChangeForSigma(factor, targetSigma);
  });
}

export function createReverseSolveResult(input: CreateReverseSolveResultInput): F6ReverseSolveResult {
  return f6ReverseSolveResultSchema.parse(input);
}

function resolveSpecBounds(input: SpecificationBounds): readonly [number, number] {
  const lowerSpecLimit = "LSL" in input ? input.LSL : input.lowerSpecLimit;
  const upperSpecLimit = "USL" in input ? input.USL : input.upperSpecLimit;
  assertValidSpecBounds(lowerSpecLimit, upperSpecLimit);
  return [lowerSpecLimit, upperSpecLimit];
}