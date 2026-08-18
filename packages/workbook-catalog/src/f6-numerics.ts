import type { CalculationFactorResult, Distribution } from "@ai-assist/contracts";

export type F6NumericErrorCode = "invalid_solver_input" | "target_unreachable";

export class F6NumericError extends Error {
  readonly code: F6NumericErrorCode;
  readonly summary: string;

  constructor(code: F6NumericErrorCode, summary: string) {
    super(`${code}: ${summary}`);
    this.name = "F6NumericError";
    this.code = code;
    this.summary = summary;
  }
}

type FactorToleranceControls = Pick<CalculationFactorResult, "input">;

const DISTRIBUTION_MULTIPLIER: Readonly<Record<Distribution, number>> = {
  normal: 1,
  uniform: 1.732,
  triangular: 1.225,
  trapezoidal: 1.369,
  elliptical: 1.5,
  beta: 2.023,
};

function fail(code: F6NumericErrorCode, summary: string): never {
  throw new F6NumericError(code, summary);
}

export function getDistributionMultiplier(distribution: Distribution): number {
  const multiplier = DISTRIBUTION_MULTIPLIER[distribution];
  if (!(multiplier > 0) || !Number.isFinite(multiplier)) {
    fail("invalid_solver_input", "distribution is unsupported");
  }
  return multiplier;
}

export function stableL2Norm(values: readonly number[]): number {
  let scale = 0;
  let sumSquares = 1;

  for (const value of values) {
    if (value < 0 || !Number.isFinite(value)) {
      fail("invalid_solver_input", "sigma values must be finite and non-negative");
    }
    if (value === 0) {
      continue;
    }
    if (scale < value) {
      const ratio = scale / value;
      sumSquares = 1 + sumSquares * ratio * ratio;
      scale = value;
      continue;
    }
    const ratio = value / scale;
    sumSquares += ratio * ratio;
  }

  const result = scale === 0 ? 0 : scale * Math.sqrt(sumSquares);
  if (!Number.isFinite(result)) {
    fail("target_unreachable", "L2 norm must be finite and representable");
  }
  return result;
}

export function positiveProductQuotient(
  numeratorValues: readonly number[],
  denominatorValues: readonly number[],
  label: string,
  unrepresentableCode: F6NumericErrorCode = "target_unreachable",
): number {
  const values = [...numeratorValues, ...denominatorValues];
  if (values.some((value) => !(value > 0) || !Number.isFinite(value))) {
    fail("invalid_solver_input", `${label} factors must be finite and greater than zero`);
  }

  if (numeratorValues.length === 1) {
    const sequentialResult = [...denominatorValues]
      .sort((left, right) => right - left)
      .reduce((result, denominator) => result / denominator, numeratorValues[0]!);
    if (sequentialResult > 0 && Number.isFinite(sequentialResult)) {
      return sequentialResult;
    }
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

  numeratorValues.forEach((value) => accumulate(value, false));
  denominatorValues.forEach((value) => accumulate(value, true));

  if (decimalExponent > 308 || decimalExponent < -324) {
    fail(unrepresentableCode, `${label} must be finite and representable`);
  }
  let result = coefficient;
  while (decimalExponent !== 0) {
    const exponentStep = Math.max(-308, Math.min(308, decimalExponent));
    result *= 10 ** exponentStep;
    decimalExponent -= exponentStep;
  }
  if (!(result > 0) || !Number.isFinite(result)) {
    fail(unrepresentableCode, `${label} must be finite and representable`);
  }
  return result;
}

function toleranceControls(factor: FactorToleranceControls): {
  readonly sigmaLevel: number;
  readonly longTermSafetyFactor: number;
  readonly distributionMultiplier: number;
} {
  const { sigmaLevel, longTermSafetyFactor, distribution } = factor.input;
  if (!(sigmaLevel > 0) || !Number.isFinite(sigmaLevel)) {
    fail("invalid_solver_input", "sigmaLevel must be finite and greater than zero");
  }
  if (!(longTermSafetyFactor > 0) || !Number.isFinite(longTermSafetyFactor)) {
    fail("invalid_solver_input", "longTermSafetyFactor must be finite and greater than zero");
  }
  return {
    sigmaLevel,
    longTermSafetyFactor,
    distributionMultiplier: getDistributionMultiplier(distribution),
  };
}

export function factorSigmaToHalfTolerance(
  factor: FactorToleranceControls,
  targetSigma: number,
): number {
  if (targetSigma < 0 || !Number.isFinite(targetSigma)) {
    fail("invalid_solver_input", "targetSigma must be finite and non-negative");
  }
  const controls = toleranceControls(factor);
  if (targetSigma === 0) {
    return 0;
  }
  return positiveProductQuotient(
    [targetSigma, controls.sigmaLevel],
    [controls.longTermSafetyFactor, controls.distributionMultiplier],
    "targetHalfTolerance",
  );
}

export function factorToleranceBandToSigma(
  factor: FactorToleranceControls,
  toleranceBand: number,
): number {
  if (toleranceBand < 0 || !Number.isFinite(toleranceBand)) {
    fail("invalid_solver_input", "toleranceBand must be finite and non-negative");
  }
  const controls = toleranceControls(factor);
  if (toleranceBand === 0) {
    return 0;
  }
  return positiveProductQuotient(
    [toleranceBand, controls.longTermSafetyFactor, controls.distributionMultiplier],
    [2, controls.sigmaLevel],
    "targetSigma",
  );
}
