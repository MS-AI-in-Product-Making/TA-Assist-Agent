import { createHash } from "node:crypto";
import {
  f7MonteCarloResultSchema,
  type F7DistributionCandidateFamily,
  type F7FactorSourceMode,
  type F7LoopCoefficient,
  type F7MonteCarloIterations,
  type F7MonteCarloResult,
} from "@ai-assist/contracts";

interface SimulationFactor {
  readonly factorId: string;
  readonly coefficient: F7LoopCoefficient;
  readonly sourceMode: F7FactorSourceMode;
  readonly family: F7DistributionCandidateFamily;
  readonly parameters: Readonly<Record<string, number>>;
}

export interface F7MonteCarloRequest {
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
  readonly targetSigmaLevel: number;
  readonly iterations: F7MonteCarloIterations;
  readonly runSeed: string;
  readonly correlationMode: "INDEPENDENT";
  readonly additionalMeanShift?: number;
  readonly factors: readonly SimulationFactor[];
}

class DeterministicRandom {
  private state: bigint;

  constructor(seed: string) {
    const digest = createHash("sha256").update("F7_SIMULATION_V1\0").update(seed).digest("hex");
    this.state = BigInt(`0x${digest.slice(0, 16)}`) || 1n;
  }

  next(): number {
    this.state ^= this.state >> 12n;
    this.state ^= this.state << 25n;
    this.state ^= this.state >> 27n;
    this.state = BigInt.asUintN(64, this.state);
    const output = BigInt.asUintN(64, this.state * 2685821657736338717n);
    return (Number(output >> 11n) + 0.5) / 9_007_199_254_740_992;
  }
}

function requiredParameter(parameters: Readonly<Record<string, number>>, name: string): number {
  const value = parameters[name];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${name} parameter.`);
  return value;
}

function assertFiniteDerived(...values: readonly number[]): void {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Monte Carlo derived statistics are not finite.");
  }
}

function standardNormal(random: DeterministicRandom): number {
  const first = Math.max(Number.MIN_VALUE, random.next());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * random.next());
}

function gammaSample(shape: number, scale: number, random: DeterministicRandom): number {
  if (!(shape > 0) || !(scale > 0)) throw new Error("Gamma shape and scale must be positive.");
  if (shape < 1) return gammaSample(shape + 1, scale, random) * random.next() ** (1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    const normal = standardNormal(random);
    const transformed = 1 + c * normal;
    if (transformed <= 0) continue;
    const cube = transformed ** 3;
    const uniform = random.next();
    if (uniform < 1 - 0.0331 * normal ** 4
      || Math.log(uniform) < 0.5 * normal ** 2 + d * (1 - cube + Math.log(cube))) {
      return d * cube * scale;
    }
  }
}

function sampleFactor(factor: SimulationFactor, random: DeterministicRandom): number {
  const parameters = factor.parameters;
  const location = parameters.location ?? 0;
  switch (factor.family) {
    case "normal":
      return requiredParameter(parameters, "mean")
        + requiredParameter(parameters, "standardDeviation") * standardNormal(random);
    case "lognormal":
      return location + Math.exp(
        requiredParameter(parameters, "logMean")
        + requiredParameter(parameters, "logStandardDeviation") * standardNormal(random),
      );
    case "weibull":
      return location + requiredParameter(parameters, "scale")
        * (-Math.log(Math.max(Number.MIN_VALUE, 1 - random.next()))) ** (1 / requiredParameter(parameters, "shape"));
    case "gamma":
      return location + gammaSample(
        requiredParameter(parameters, "shape"),
        requiredParameter(parameters, "scale"),
        random,
      );
    case "uniform": {
      const minimum = requiredParameter(parameters, "minimum");
      const maximum = requiredParameter(parameters, "maximum");
      if (!(minimum < maximum)) throw new Error("Uniform minimum must be less than maximum.");
      return minimum + (maximum - minimum) * random.next();
    }
  }
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const shifted = value - 1;
  let series = 0.9999999999998099;
  for (let index = 0; index < coefficients.length; index += 1) {
    series += coefficients[index]! / (shifted + index + 1);
  }
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
}

function factorStandardDeviation(factor: SimulationFactor): number {
  switch (factor.family) {
    case "normal":
      return requiredParameter(factor.parameters, "standardDeviation");
    case "uniform": {
      const minimum = requiredParameter(factor.parameters, "minimum");
      const maximum = requiredParameter(factor.parameters, "maximum");
      if (!(minimum < maximum)) throw new Error("Uniform minimum must be less than maximum.");
      return (maximum - minimum) / Math.sqrt(12);
    }
    case "lognormal": {
      const logMean = requiredParameter(factor.parameters, "logMean");
      const logStandardDeviation = requiredParameter(factor.parameters, "logStandardDeviation");
      const logVariance = logStandardDeviation ** 2;
      return Math.sqrt(Math.expm1(logVariance) * Math.exp(2 * logMean + logVariance));
    }
    case "gamma": {
      const shape = requiredParameter(factor.parameters, "shape");
      const scale = requiredParameter(factor.parameters, "scale");
      if (!(shape > 0) || !(scale > 0)) throw new Error("Gamma shape and scale must be positive.");
      return Math.sqrt(shape) * scale;
    }
    case "weibull": {
      const shape = requiredParameter(factor.parameters, "shape");
      const scale = requiredParameter(factor.parameters, "scale");
      if (!(shape > 0) || !(scale > 0)) throw new Error("Weibull shape and scale must be positive.");
      const firstMoment = Math.exp(logGamma(1 + 1 / shape));
      const secondMoment = Math.exp(logGamma(1 + 2 / shape));
      return scale * Math.sqrt(Math.max(0, secondMoment - firstMoment ** 2));
    }
  }
}

function createFactorContributions(factors: readonly SimulationFactor[]) {
  const values = factors.map((factor) => {
    const standardDeviation = factorStandardDeviation(factor);
    const effectiveCoefficient = factor.coefficient === 0 ? 1 : factor.coefficient;
    const weightedVariance = (effectiveCoefficient * standardDeviation) ** 2;
    assertFiniteDerived(standardDeviation, weightedVariance);
    return { factor, standardDeviation, weightedVariance };
  });
  const totalWeightedVariance = values.reduce((sum, value) => sum + value.weightedVariance, 0);
  assertFiniteDerived(totalWeightedVariance);
  return values.map(({ factor, standardDeviation, weightedVariance }) => ({
    methodId: "F7_INDEPENDENT_VARIANCE_CONTRIBUTION_V1" as const,
    factorId: factor.factorId,
    family: factor.family,
    sourceMode: factor.sourceMode,
    coefficient: factor.coefficient,
    standardDeviation,
    weightedVariance,
    contribution: totalWeightedVariance === 0 ? 0 : weightedVariance / totalWeightedVariance,
  }));
}

function quantile(sorted: readonly number[], probability: number): number {
  const position = probability * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex]!;
  const upper = sorted[upperIndex]!;
  return lower + (upper - lower) * (position - lowerIndex);
}

interface HistogramBin {
  readonly minimum: number;
  readonly maximum: number;
  observedCount: number;
}

function expandedHistogramBounds(value: number, binCount: number): { minimum: number; maximum: number } {
  const scale = Math.max(1, Math.abs(value));
  const span = scale * Number.EPSILON * binCount * 4;
  let minimum = value - span;
  let maximum = value + span;
  if (!Number.isFinite(minimum)) {
    minimum = value;
    maximum = value + 2 * span;
  } else if (!Number.isFinite(maximum)) {
    minimum = value - 2 * span;
    maximum = value;
  }
  return { minimum, maximum };
}

function createHistogramBins(sorted: readonly number[]): HistogramBin[] {
  const sampleSize = sorted.length;
  const sampleMinimum = sorted[0]!;
  const sampleMaximum = sorted[sampleSize - 1]!;
  const sampleRange = sampleMaximum - sampleMinimum;
  const allValuesEqual = sampleMinimum === sampleMaximum;
  const interquartileRange = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const width = 2 * interquartileRange / Math.cbrt(sampleSize);
  const calculatedBinCount = Math.ceil(sampleRange / width);
  const fallbackBinCount = Math.ceil(Math.sqrt(sampleSize));
  const requestedBinCount = allValuesEqual
    ? fallbackBinCount
    : Number.isFinite(sampleRange) && sampleRange > 0
      && Number.isFinite(width) && width > 0
      && Number.isFinite(calculatedBinCount) && calculatedBinCount > 0
      ? calculatedBinCount
      : fallbackBinCount;
  const binCount = Math.min(60, Math.max(20, requestedBinCount));
  const bounds = allValuesEqual
    ? expandedHistogramBounds(sampleMinimum, binCount)
    : { minimum: sampleMinimum, maximum: sampleMaximum };
  const boundaries = Array.from({ length: binCount + 1 }, (_, index) => {
    const fraction = index / binCount;
    return bounds.minimum * (1 - fraction) + bounds.maximum * fraction;
  });
  const bins = Array.from({ length: binCount }, (_, index): HistogramBin => ({
    minimum: boundaries[index]!,
    maximum: boundaries[index + 1]!,
    observedCount: 0,
  }));

  for (const value of sorted) {
    let lowerIndex = 0;
    let upperIndex = bins.length - 1;
    while (lowerIndex < upperIndex) {
      const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
      if (value < bins[middleIndex]!.maximum) upperIndex = middleIndex;
      else lowerIndex = middleIndex + 1;
    }
    bins[lowerIndex]!.observedCount += 1;
  }
  return bins;
}

function standardNormalCdf(value: number): number {
  const absolute = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * absolute);
  const density = Math.exp(-0.5 * absolute * absolute) / Math.sqrt(2 * Math.PI);
  const tail = density * t * (
    0.319381530
    + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))
  );
  return Math.min(1, Math.max(0, value >= 0 ? 1 - tail : tail));
}

function standardNormalSurvival(value: number): number {
  return standardNormalCdf(-value);
}

function standardNormalIntervalProbability(lower: number, upper: number): number {
  const probability = lower > 0
    ? standardNormalSurvival(lower) - standardNormalSurvival(upper)
    : standardNormalCdf(upper) - standardNormalCdf(lower);
  return Math.min(1, Math.max(0, probability));
}

function expectedNormalBinCounts(
  bins: readonly HistogramBin[],
  sampleSize: number,
  mean: number,
  standardDeviation: number,
): number[] {
  if (standardDeviation === 0) {
    const containingIndex = bins.findIndex((bin, index) => (
      mean >= bin.minimum && (mean < bin.maximum || (index === bins.length - 1 && mean <= bin.maximum))
    ));
    return bins.map((_, index) => index === containingIndex ? sampleSize : 0);
  }
  return bins.map((bin) => {
    const lower = (bin.minimum - mean) / standardDeviation;
    const upper = (bin.maximum - mean) / standardDeviation;
    assertFiniteDerived(lower, upper);
    return sampleSize * standardNormalIntervalProbability(lower, upper);
  });
}

export const __simulationInternals = Object.freeze({
  createHistogramBins,
  expectedNormalBinCounts,
});

function createCapability(
  request: F7MonteCarloRequest,
  mean: number,
  standardDeviation: number,
) {
  const targetCpk = request.targetSigmaLevel / 3;
  if (standardDeviation === 0) {
    return { status: "not_available" as const, reason: "zero_variance" as const, targetCpk };
  }
  const cp = (request.upperSpecLimit - request.lowerSpecLimit) / (6 * standardDeviation);
  const lowerCpk = (mean - request.lowerSpecLimit) / (3 * standardDeviation);
  const upperCpk = (request.upperSpecLimit - mean) / (3 * standardDeviation);
  const cpk = Math.min(lowerCpk, upperCpk);
  assertFiniteDerived(cp, lowerCpk, upperCpk, cpk, targetCpk);
  return {
    status: "available" as const,
    cp,
    lowerCpk,
    upperCpk,
    cpk,
    targetCpk,
    targetStatus: cpk >= targetCpk ? "meets_target" as const : "below_target" as const,
  };
}

function createNormalModel(request: F7MonteCarloRequest, mean: number, standardDeviation: number) {
  if (standardDeviation === 0) {
    return { status: "not_available" as const, reason: "zero_variance" as const };
  }
  const lowerZ = (request.lowerSpecLimit - mean) / standardDeviation;
  const upperZ = (request.upperSpecLimit - mean) / standardDeviation;
  assertFiniteDerived(lowerZ, upperZ);
  const lowerTailDpm = 1_000_000 * standardNormalCdf(lowerZ);
  let upperTailDpm = 1_000_000 * standardNormalSurvival(upperZ);
  if (lowerTailDpm + upperTailDpm > 1_000_000) {
    upperTailDpm = Math.max(0, 1_000_000 - lowerTailDpm);
  }
  const totalDpm = lowerTailDpm + upperTailDpm;
  const expectedYield = 1 - totalDpm / 1_000_000;
  assertFiniteDerived(lowerTailDpm, upperTailDpm, totalDpm, expectedYield);
  return {
    status: "available" as const,
    lowerTailDpm,
    upperTailDpm,
    totalDpm,
    expectedYield,
  };
}

export function runF7MonteCarlo(request: F7MonteCarloRequest): F7MonteCarloResult {
  const specificationWidth = request.upperSpecLimit - request.lowerSpecLimit;
  if (!Number.isFinite(request.lowerSpecLimit)
    || !Number.isFinite(request.upperSpecLimit)
    || !(specificationWidth > 0)
    || !Number.isFinite(specificationWidth)
    || !(request.targetSigmaLevel > 0)
    || !Number.isFinite(request.targetSigmaLevel)
    || (request.additionalMeanShift !== undefined && !Number.isFinite(request.additionalMeanShift))
    || request.factors.length === 0) {
    throw new Error("Monte Carlo request is invalid.");
  }
  const random = new DeterministicRandom(request.runSeed);
  const values = new Array<number>(request.iterations);
  let mean = 0;
  let sumSquaredDifference = 0;
  let inSpecCount = 0;

  for (let iteration = 0; iteration < request.iterations; iteration += 1) {
    let response = request.additionalMeanShift ?? 0;
    for (const factor of request.factors) {
      const statisticalCoefficient = factor.coefficient === 0 ? 1 : factor.coefficient;
      response += statisticalCoefficient * sampleFactor(factor, random);
    }
    assertFiniteDerived(response);
    values[iteration] = response;
    const delta = response - mean;
    assertFiniteDerived(delta);
    mean += delta / (iteration + 1);
    sumSquaredDifference += delta * (response - mean);
    assertFiniteDerived(mean, sumSquaredDifference);
    if (response >= request.lowerSpecLimit && response <= request.upperSpecLimit) inSpecCount += 1;
  }

  values.sort((left, right) => left - right);
  const outOfSpecCount = request.iterations - inSpecCount;
  const yieldRate = inSpecCount / request.iterations;
  const outOfSpecProbability = outOfSpecCount / request.iterations;
  const standardDeviation = Math.sqrt(sumSquaredDifference / (request.iterations - 1));
  assertFiniteDerived(mean, standardDeviation, yieldRate);
  const histogramBins = createHistogramBins(values);
  const quantiles = {
    p00135: quantile(values, 0.00135),
    p01: quantile(values, 0.01),
    p05: quantile(values, 0.05),
    p50: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
    p99865: quantile(values, 0.99865),
  };
  const expectedBinCounts = expectedNormalBinCounts(
    histogramBins,
    request.iterations,
    mean,
    standardDeviation,
  );
  const capability = createCapability(request, mean, standardDeviation);
  const normalModel = createNormalModel(request, mean, standardDeviation);
  assertFiniteDerived(
    ...Object.values(quantiles),
    ...expectedBinCounts,
    ...histogramBins.flatMap((bin) => [bin.minimum, bin.maximum, bin.observedCount]),
  );
  return f7MonteCarloResultSchema.parse({
    methodId: "F7_MONTE_CARLO_V1",
    status: "complete",
    lowerSpecLimit: request.lowerSpecLimit,
    upperSpecLimit: request.upperSpecLimit,
    targetSigmaLevel: request.targetSigmaLevel,
    iterations: request.iterations,
    runSeed: request.runSeed,
    correlationMode: request.correlationMode,
    mean,
    standardDeviation,
    quantiles,
    inSpecCount,
    outOfSpecCount,
    yield: yieldRate,
    outOfSpecProbability,
    ppm: outOfSpecProbability * 1_000_000,
    histogram: {
      methodId: "F7_HISTOGRAM_FD_V1",
      bins: histogramBins,
    },
    normalFit: {
      methodId: "F7_NORMAL_MOMENT_FIT_V1",
      mean,
      standardDeviation,
      expectedBinCounts,
    },
    capability,
    normalModel,
    factorManifest: request.factors.map(({ factorId, family, sourceMode }) => ({ factorId, family, sourceMode })),
    factorContributions: createFactorContributions(request.factors),
  });
}