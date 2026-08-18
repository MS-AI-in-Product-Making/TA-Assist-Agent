import {
  f6ReverseSolveResultSchema,
  f6ToleranceChangeSchema,
  type F6ReverseSolveResult,
  CalculationFactorResult,
  type F6ToleranceChange,
} from "@ai-assist/contracts";
import {
  factorSigmaToHalfTolerance,
  F6NumericError,
  getDistributionMultiplier,
  positiveProductQuotient,
  stableL2Norm as sharedStableL2Norm,
} from "./f6-numerics.js";

type FactorSource = CalculationFactorResult["source"];

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

function safePositiveProductQuotient(
  numeratorValues: readonly number[],
  denominatorValues: readonly number[],
  label: string,
  unrepresentableCode: F6SolverErrorCode = "invalid_solver_input",
): number {
  return mapNumericError(() => positiveProductQuotient(
    numeratorValues,
    denominatorValues,
    label,
    unrepresentableCode === "target_unreachable" ? "target_unreachable" : "invalid_solver_input",
  ));
}

function stableL2Norm(values: readonly number[]): number {
  return mapNumericError(() => sharedStableL2Norm(values));
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    fail("invalid_solver_input", `${label} must be finite`);
  }
}

function stableFiniteSum(values: readonly number[], label: string): number {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  let accumulator = 0n;

  values.forEach((value, index) => {
    assertFinite(value, `${label}[${index}]`);
    if (value === 0) {
      return;
    }

    view.setFloat64(0, value, false);
    const bits = view.getBigUint64(0, false);
    const negative = (bits >> 63n) !== 0n;
    const exponentBits = Number((bits >> 52n) & 0x7ffn);
    const fraction = bits & 0xfffffffffffffn;
    const significand = exponentBits === 0 ? fraction : (1n << 52n) | fraction;
    const scaledSignificand = significand << BigInt(Math.max(0, exponentBits - 1));
    accumulator += negative ? -scaledSignificand : scaledSignificand;
  });

  if (accumulator === 0n) {
    return 0;
  }

  const negative = accumulator < 0n;
  let magnitude = negative ? -accumulator : accumulator;
  let bitLength = magnitude.toString(2).length;
  let unitExponent = -1074;
  if (bitLength > 53) {
    let shift = bitLength - 53;
    let significand = magnitude >> BigInt(shift);
    const remainder = magnitude - (significand << BigInt(shift));
    const halfway = 1n << BigInt(shift - 1);
    if (remainder > halfway || (remainder === halfway && (significand & 1n) !== 0n)) {
      significand += 1n;
      if (significand === (1n << 53n)) {
        significand >>= 1n;
        shift += 1;
      }
    }
    magnitude = significand;
    unitExponent += shift;
    bitLength = magnitude.toString(2).length;
  }

  const resultMagnitude = bitLength <= 53
    ? Number(magnitude) * (2 ** unitExponent)
    : Number.POSITIVE_INFINITY;
  const result = negative ? -resultMagnitude : resultMagnitude;
  if (!Number.isFinite(result)) {
    fail("target_unreachable", `${label} sum must be finite and representable`);
  }
  return result;
}

function scalePositiveByPowerOfTwo(value: number, power: number, label: string): number {
  if (!(value > 0) || !Number.isFinite(value) || !Number.isFinite(power)) {
    fail("target_unreachable", `${label} must be finite and representable`);
  }
  if (power === 0) {
    return value;
  }

  let valueExponent = Math.floor(Math.log2(value));
  if (valueExponent === 1024) {
    valueExponent = 1023;
  }
  const mantissa = value / (2 ** valueExponent);
  const combinedExponent = valueExponent + power;
  const integerExponent = Math.floor(combinedExponent);
  let coefficient = mantissa * (2 ** (combinedExponent - integerExponent));
  let result: number;
  if (integerExponent < -1074) {
    coefficient *= 2 ** (integerExponent + 1074);
    result = coefficient * Number.MIN_VALUE;
  } else if (integerExponent > 1023) {
    result = Number.POSITIVE_INFINITY;
  } else {
    result = coefficient * (2 ** integerExponent);
  }

  if (!(result > 0) || !Number.isFinite(result)) {
    fail("target_unreachable", `${label} must be finite and representable`);
  }
  return result;
}

function log2PositiveRatio(numerator: number, denominator: number): number {
  const ratio = numerator / denominator;
  if (ratio > 0) {
    return Math.log2(ratio);
  }

  let numeratorExponent = Math.floor(Math.log2(numerator));
  let denominatorExponent = Math.floor(Math.log2(denominator));
  if (numeratorExponent === 1024) {
    numeratorExponent = 1023;
  }
  if (denominatorExponent === 1024) {
    denominatorExponent = 1023;
  }
  const numeratorMantissa = numerator / (2 ** numeratorExponent);
  const denominatorMantissa = denominator / (2 ** denominatorExponent);
  return (numeratorExponent - denominatorExponent) + Math.log2(numeratorMantissa / denominatorMantissa);
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

function equalWithinMachinePrecision(left: number, right: number): boolean {
  if (left === right) {
    return true;
  }
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }
  const magnitude = Math.max(Math.abs(left), Math.abs(right));
  const tolerance = 8 * Number.EPSILON * magnitude;
  return Math.abs(left - right) <= tolerance;
}

function assertRepresentableToleranceBand(
  lowerTolerance: number,
  upperTolerance: number,
  requestedBand: number,
  requestedCenter: number,
): void {
  if (!(lowerTolerance < upperTolerance)) {
    fail("target_unreachable", "target tolerance endpoints are not separately representable");
  }
  const representedBand = upperTolerance - lowerTolerance;
  if (!equalWithinMachinePrecision(representedBand, requestedBand)) {
    fail("target_unreachable", "represented target tolerance band does not match the requested band");
  }
  const representedCenter = midpoint(lowerTolerance, upperTolerance);
  if (!equalWithinMachinePrecision(representedCenter, requestedCenter)) {
    fail("target_unreachable", "represented target tolerance center does not match the requested center");
  }
}

function buildToleranceChange(change: F6ToleranceChange): F6ToleranceChange {
  assertRepresentableToleranceBand(
    change.resultingLowerTolerance,
    change.resultingUpperTolerance,
    change.resultingBand,
    change.bandCenter,
  );
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
  mapNumericError(() => getDistributionMultiplier(factor.input.distribution));
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

function remainingSigma(targetSigma: number, fixedSigma: number): number {
  if (fixedSigma === 0) {
    return targetSigma;
  }
  if (fixedSigma >= targetSigma) {
    fail("target_unreachable", "fixed factors consume the target RSS variance");
  }
  const ratio = fixedSigma / targetSigma;
  if (!Number.isFinite(ratio) || ratio >= 1) {
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
  const targetHalfTolerance = mapNumericError(() => factorSigmaToHalfTolerance(factor, targetSigma));
  const originalLowerTolerance = factor.input.lowerTolerance;
  const originalUpperTolerance = factor.input.upperTolerance;
  const originalBand = positiveDifference(originalUpperTolerance, originalLowerTolerance, "originalBand");
  const bandCenter = midpoint(originalLowerTolerance, originalUpperTolerance);
  const resultingBand = safePositiveProductQuotient(
    [targetHalfTolerance, 2],
    [1],
    "resultingBand",
    "target_unreachable",
  );
  const resultingLowerTolerance = bandCenter - targetHalfTolerance;
  const resultingUpperTolerance = bandCenter + targetHalfTolerance;
  if (!Number.isFinite(resultingLowerTolerance) || !Number.isFinite(resultingUpperTolerance)) {
    fail("target_unreachable", "target tolerance endpoints must be finite and representable");
  }

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
  const resultingBand = safePositiveProductQuotient(
    [input.scale, originalBand],
    [1],
    "resultingBand",
    "target_unreachable",
  );
  const lowerTolerance = center - resultingBand / 2;
  const upperTolerance = center + resultingBand / 2;
  assertFinite(lowerTolerance, "resultingLowerTolerance");
  assertFinite(upperTolerance, "resultingUpperTolerance");
  assertRepresentableToleranceBand(lowerTolerance, upperTolerance, resultingBand, center);
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
  const currentMean = stableFiniteSum(input.factorMeans, "factorMeans");
  const targetMean = midpoint(lowerSpecLimit, upperSpecLimit);
  const additionalMeanShift = targetMean - currentMean;
  if (!Number.isFinite(additionalMeanShift)) {
    fail("target_unreachable", "additionalMeanShift must be finite and representable");
  }
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
  const limitingDistance = Math.min(
    input.mean - lowerSpecLimit,
    upperSpecLimit - input.mean,
  );
  return safePositiveProductQuotient(
    [limitingDistance],
    [3, input.targetCpk],
    "targetRssSigma",
    "target_unreachable",
  );
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

  let targetSigmas: readonly number[];
  if (input.allocation === "equal-allocation-among-top-N") {
    const targetSigma = selectedTargetSigma * Math.sqrt(1 / selectedFactors.length);
    targetSigmas = selectedFactors.map(() => targetSigma);
  } else if (input.allocation === "proportional-to-contribution") {
    const maximumContribution = Math.max(...selectedFactors.map((factor) => factor.contribution));
    if (!(maximumContribution > 0) || !Number.isFinite(maximumContribution)) {
      fail("target_unreachable", "selected factors must have positive total contribution");
    }
    const relativeLog2Contributions = selectedFactors.map((factor) => factor.contribution === 0
      ? Number.NEGATIVE_INFINITY
      : log2PositiveRatio(factor.contribution, maximumContribution));
    const scaledContributionSum = relativeLog2Contributions.reduce(
      (sum, contribution) => sum + (contribution === Number.NEGATIVE_INFINITY
        ? 0
        : 2 ** contribution),
      0,
    );
    if (!(scaledContributionSum > 0) || !Number.isFinite(scaledContributionSum)) {
      fail("target_unreachable", "selected factors must have positive total contribution");
    }
    const relativeLog2ContributionSum = Math.log2(scaledContributionSum);
    targetSigmas = relativeLog2Contributions.map((contribution) => scalePositiveByPowerOfTwo(
      selectedTargetSigma,
      0.5 * (contribution - relativeLog2ContributionSum),
      "target factor sigma",
    ));
  } else {
    fail("invalid_solver_input", "allocation is unsupported");
  }

  return selectedFactors.map((factor, index) => {
    return toleranceChangeForSigma(factor, targetSigmas[index]!);
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