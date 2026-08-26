import normalCdf from "@stdlib/stats-base-dists-normal-cdf";
import type { CalculationMethod, Distribution } from "@ai-assist/contracts";

export const CALCULATION_VERSION = "excel-ta-v1" as const;

const STATUS_PASS = "PASS" as const;
const STATUS_FAIL = "FAIL" as const;

export class CalculationKernelError extends Error {
  readonly code = "calculation_not_possible" as const;
  readonly summary: string;

  constructor(summary: string) {
    super(`calculation_not_possible: ${summary}`);
    this.name = "CalculationKernelError";
    this.summary = summary;
  }
}

export function isCalculationKernelError(error: unknown): error is CalculationKernelError {
  return error instanceof CalculationKernelError
    || (
      typeof error === "object"
      && error !== null
      && (error as { code?: unknown }).code === "calculation_not_possible"
      && typeof (error as { summary?: unknown }).summary === "string"
    );
}

const DISTRIBUTION_MULTIPLIER: Readonly<Record<Distribution, number>> = {
  normal: 1,
  uniform: 1.732,
  triangular: 1.225,
  trapezoidal: 1.369,
  elliptical: 1.5,
  beta: 2.023,
};

export interface NormalizedFactor {
  readonly source: {
    readonly worksheetName: string;
    readonly tableId: string;
    readonly sourceRow: number;
  };
  readonly name: string;
  readonly unit: string;
  readonly input: {
    readonly nominalValue: number;
    readonly upperTolerance: number;
    readonly lowerTolerance: number;
    readonly longTermSafetyFactor: number;
    readonly sigmaLevel: number;
    readonly distribution: Distribution;
  };
}

export interface NormalizedCalculationInput {
  readonly factors: readonly NormalizedFactor[];
  readonly system: {
    readonly designNominal: number;
    readonly lowerSpecLimit: number;
    readonly upperSpecLimit: number;
    readonly targetSigmaLevel: number;
    readonly targetCpk: number;
    readonly shift: number;
  };
}

export interface KernelCalculationResult {
  readonly calculationVersion: typeof CALCULATION_VERSION;
  readonly factorCount: number;
  readonly recommendation: {
    readonly method: CalculationMethod;
    readonly reason: "factor_count_1_to_3" | "factor_count_4_to_10" | "factor_count_over_10";
    readonly refer3d: boolean;
  };
  readonly factors: ReadonlyArray<{
    readonly source: NormalizedFactor["source"];
    readonly name: string;
    readonly unit: string;
    readonly input: NormalizedFactor["input"];
    readonly mean: number;
    readonly halfTolerance: number;
    readonly sigma: number;
    readonly contribution: number;
  }>;
  readonly system: {
    readonly designNominal: number;
    readonly mean: number;
    readonly shift: number;
    readonly worstCaseUpper: number;
    readonly worstCaseLower: number;
    readonly responseUpperTolerance: number;
    readonly responseLowerTolerance: number;
    readonly worstCaseTolerance: number;
    readonly worstCaseUpperBound: number;
    readonly worstCaseLowerBound: number;
    readonly rssSigma: number;
  };
  readonly capability: {
    readonly lowerSpecLimit: number;
    readonly upperSpecLimit: number;
    readonly targetSigmaLevel: number;
    readonly targetCpk: number;
    readonly cp: number;
    readonly cpStatus: "PASS" | "FAIL";
    readonly lowerCpk: number;
    readonly lowerCpkStatus: "PASS" | "FAIL";
    readonly upperCpk: number;
    readonly upperCpkStatus: "PASS" | "FAIL";
    readonly cpk: number;
    readonly status: "PASS" | "FAIL";
    readonly lowerZ: number;
    readonly upperZ: number;
    readonly z: number;
    readonly lowerDpm: number;
    readonly upperDpm: number;
    readonly totalDpm: number;
    readonly outOfSpecRatio: number;
    readonly yield: number;
  };
}

function throwCalculationNotPossible(summary: string): never {
  throw new CalculationKernelError(summary);
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throwCalculationNotPossible(`${label} must be finite`);
  }
}

function factorLabel(index: number): string {
  return `factor[${index}]`;
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

export function recommendCalculationMethod(factorCount: number): CalculationMethod {
  if (!Number.isInteger(factorCount) || factorCount <= 0) {
    throwCalculationNotPossible("factorCount must be a positive integer");
  }

  if (factorCount <= 3) return "worst_case";
  if (factorCount <= 10) return "rss_1d";
  return "refer_3d_variation_analysis";
}

export function calculateToleranceAnalysis(input: NormalizedCalculationInput): KernelCalculationResult {
  const factors = [...input.factors];
  const factorCount = factors.length;
  const method = recommendCalculationMethod(factorCount);

  const reason = method === "worst_case"
    ? "factor_count_1_to_3"
    : method === "rss_1d"
      ? "factor_count_4_to_10"
      : "factor_count_over_10";

  const refer3d = method === "refer_3d_variation_analysis";

  assertFinite(input.system.designNominal, "system.designNominal");
  assertFinite(input.system.lowerSpecLimit, "system.lowerSpecLimit");
  assertFinite(input.system.upperSpecLimit, "system.upperSpecLimit");
  assertFinite(input.system.targetSigmaLevel, "system.targetSigmaLevel");
  assertFinite(input.system.targetCpk, "system.targetCpk");
  assertFinite(input.system.shift, "system.shift");

  if (input.system.upperSpecLimit <= input.system.lowerSpecLimit) {
    throwCalculationNotPossible("upperSpecLimit must be greater than lowerSpecLimit");
  }

  const computedFactors = factors.map((factor, index) => {
    const label = factorLabel(index);

    assertFinite(factor.input.nominalValue, `${label}.nominalValue`);
    assertFinite(factor.input.upperTolerance, `${label}.upperTolerance`);
    assertFinite(factor.input.lowerTolerance, `${label}.lowerTolerance`);
    assertFinite(factor.input.longTermSafetyFactor, `${label}.longTermSafetyFactor`);
    assertFinite(factor.input.sigmaLevel, `${label}.sigmaLevel`);

    const upperTolerance = factor.input.upperTolerance;
    const lowerTolerance = factor.input.lowerTolerance;

    if (!(upperTolerance > lowerTolerance)) {
      throwCalculationNotPossible(`${label}.upperTolerance must be greater than ${label}.lowerTolerance`);
    }

    if (!(factor.input.longTermSafetyFactor > 0)) {
      throwCalculationNotPossible(`${label}.longTermSafetyFactor must be greater than zero`);
    }

    if (!(factor.input.sigmaLevel > 0)) {
      throwCalculationNotPossible(`${label}.sigmaLevel must be greater than zero`);
    }

    const distributionMultiplier = DISTRIBUTION_MULTIPLIER[factor.input.distribution];
    if (distributionMultiplier === undefined) {
      throwCalculationNotPossible(`${label}.distribution is unsupported`);
    }

    const halfTolerance = (upperTolerance - lowerTolerance) / 2;
    const mean = factor.input.nominalValue < 0
      ? factor.input.nominalValue - (upperTolerance + lowerTolerance) / 2
      : factor.input.nominalValue + (upperTolerance + lowerTolerance) / 2;

    const sigma = halfTolerance
      * (factor.input.longTermSafetyFactor / factor.input.sigmaLevel)
      * distributionMultiplier;

    assertFinite(halfTolerance, `${label}.halfTolerance`);
    assertFinite(mean, `${label}.mean`);
    assertFinite(sigma, `${label}.sigma`);

    if (sigma < 0) {
      throwCalculationNotPossible(`${label}.sigma must be non-negative`);
    }

    return {
      source: {
        worksheetName: factor.source.worksheetName,
        tableId: factor.source.tableId,
        sourceRow: factor.source.sourceRow,
      },
      name: factor.name,
      unit: factor.unit,
      input: {
        nominalValue: factor.input.nominalValue,
        upperTolerance: factor.input.upperTolerance,
        lowerTolerance: factor.input.lowerTolerance,
        longTermSafetyFactor: factor.input.longTermSafetyFactor,
        sigmaLevel: factor.input.sigmaLevel,
        distribution: factor.input.distribution,
      },
      mean,
      halfTolerance,
      sigma,
      contribution: 0,
    };
  });

  const worstCaseUpper = computedFactors.reduce((sum, factor) => sum + factor.input.upperTolerance, 0);
  const worstCaseLower = computedFactors.reduce((sum, factor) => sum + factor.input.lowerTolerance, 0);
  const unshiftedMean = computedFactors.reduce((sum, factor) => sum + factor.mean, 0);
  const mean = unshiftedMean + input.system.shift;
  const worstCaseTolerance = computedFactors.reduce((sum, factor) => sum + factor.halfTolerance, 0);
  const responseUpperTolerance = unshiftedMean + worstCaseTolerance - input.system.designNominal;
  const responseLowerTolerance = unshiftedMean - worstCaseTolerance - input.system.designNominal;
  const worstCaseUpperBound = mean + worstCaseTolerance;
  const worstCaseLowerBound = mean - worstCaseTolerance;
  const rssSigma = stableL2Norm(computedFactors.map((factor) => factor.sigma));

  assertFinite(worstCaseUpper, "system.worstCaseUpper");
  assertFinite(worstCaseLower, "system.worstCaseLower");
  assertFinite(responseUpperTolerance, "system.responseUpperTolerance");
  assertFinite(responseLowerTolerance, "system.responseLowerTolerance");
  assertFinite(worstCaseTolerance, "system.worstCaseTolerance");
  assertFinite(worstCaseUpperBound, "system.worstCaseUpperBound");
  assertFinite(worstCaseLowerBound, "system.worstCaseLowerBound");
  assertFinite(mean, "system.mean");
  assertFinite(rssSigma, "system.rssSigma");

  if (!(rssSigma > 0)) {
    throwCalculationNotPossible("rssSigma must be greater than zero");
  }

  const completedFactors = computedFactors.map((factor, index) => {
    const contribution = (factor.sigma / rssSigma) ** 2;
    assertFinite(contribution, `${factorLabel(index)}.contribution`);

    return {
      source: factor.source,
      name: factor.name,
      unit: factor.unit,
      input: factor.input,
      mean: factor.mean,
      halfTolerance: factor.halfTolerance,
      sigma: factor.sigma,
      contribution,
    };
  });

  const contributionSum = completedFactors.reduce((sum, factor) => sum + factor.contribution, 0);
  assertFinite(contributionSum, "system.contributionSum");
  if (Math.abs(contributionSum - 1) > 1e-12) {
    throwCalculationNotPossible("system.contributionSum must be approximately one");
  }

  const cp = (input.system.upperSpecLimit - input.system.lowerSpecLimit) / (6 * rssSigma);
  const lowerCpk = (mean - input.system.lowerSpecLimit) / (3 * rssSigma);
  const upperCpk = (input.system.upperSpecLimit - mean) / (3 * rssSigma);
  const cpk = Math.min(lowerCpk, upperCpk);
  const lowerZ = lowerCpk * 3;
  const upperZ = upperCpk * 3;
  const z = Math.min(lowerZ, upperZ);
  const lowerDpm = (1 - normalCdf(lowerZ, 0, 1)) * 1_000_000;
  const upperDpm = (1 - normalCdf(upperZ, 0, 1)) * 1_000_000;
  const totalDpm = lowerDpm + upperDpm;
  const outOfSpecRatio = totalDpm / 1_000_000;
  const yieldValue = 1 - outOfSpecRatio;

  for (const [name, value] of [
    ["capability.cp", cp],
    ["capability.lowerCpk", lowerCpk],
    ["capability.upperCpk", upperCpk],
    ["capability.cpk", cpk],
    ["capability.lowerZ", lowerZ],
    ["capability.upperZ", upperZ],
    ["capability.z", z],
    ["capability.lowerDpm", lowerDpm],
    ["capability.upperDpm", upperDpm],
    ["capability.totalDpm", totalDpm],
    ["capability.outOfSpecRatio", outOfSpecRatio],
    ["capability.yield", yieldValue],
  ] as const) {
    assertFinite(value, name);
  }

  const cpStatus = cp <= input.system.targetCpk ? STATUS_FAIL : STATUS_PASS;
  const lowerCpkStatus = lowerCpk <= input.system.targetCpk ? STATUS_FAIL : STATUS_PASS;
  const upperCpkStatus = upperCpk < input.system.targetCpk ? STATUS_FAIL : STATUS_PASS;
  const status = cpk <= input.system.targetCpk ? STATUS_FAIL : STATUS_PASS;

  return {
    calculationVersion: CALCULATION_VERSION,
    factorCount,
    recommendation: {
      method,
      reason,
      refer3d,
    },
    factors: completedFactors,
    system: {
      designNominal: input.system.designNominal,
      mean,
      shift: input.system.shift,
      worstCaseUpper,
      worstCaseLower,
      responseUpperTolerance,
      responseLowerTolerance,
      worstCaseTolerance,
      worstCaseUpperBound,
      worstCaseLowerBound,
      rssSigma,
    },
    capability: {
      lowerSpecLimit: input.system.lowerSpecLimit,
      upperSpecLimit: input.system.upperSpecLimit,
      targetSigmaLevel: input.system.targetSigmaLevel,
      targetCpk: input.system.targetCpk,
      cp,
      cpStatus,
      lowerCpk,
      lowerCpkStatus,
      upperCpk,
      upperCpkStatus,
      cpk,
      status,
      lowerZ,
      upperZ,
      z,
      lowerDpm,
      upperDpm,
      totalDpm,
      outOfSpecRatio,
      yield: yieldValue,
    },
  };
}
