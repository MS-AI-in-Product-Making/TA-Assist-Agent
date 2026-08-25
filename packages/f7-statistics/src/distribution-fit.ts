import { createHash } from "node:crypto";
import {
  F7_DISTRIBUTION_CANDIDATE_ORDER,
  F7_SELECTION_NORMAL_COEFFICIENT_OF_VARIATION_MAX,
  F7_SELECTION_NORMAL_MEAN_MEDIAN_RELATIVE_DIFFERENCE_MAX,
  F7_SELECTION_NORMAL_QQ_CURVATURE_MAX,
  F7_SELECTION_NORMAL_SKEWNESS_MAX,
  type F7DistributionCharacteristicKind,
} from "@ai-assist/contracts";
import type {
  F7DatasetValidationResult,
  F7DistributionCandidateFamily,
  F7DistributionFitCandidate,
  F7DistributionFitResult,
  F7DistributionFitStatus,
  F7DistributionModelSpecification,
  F7SampleDiagnostics,
  F7SelectionDecision,
  F7SelectionDecisionReasonCode,
} from "@ai-assist/contracts";

const BOOTSTRAP_REPLICATES = 10_000;
const BOOTSTRAP_Z_95 = 1.959963984540054;
const UINT32_RANGE = 0x1_0000_0000;
const UINT64_MASK = (1n << 64n) - 1n;
const PCG_MULTIPLIER = 6364136223846793005n;
const PROBABILITY_EPSILON = 1e-12;

const UNIFORM_BOUNDARY_WARNING = "Uniform MLE bounds equal the sample minimum and maximum; boundary estimates are sensitive to additional observations.";

const MODEL_SPECIFICATION_BY_FAMILY: Record<F7DistributionCandidateFamily, F7DistributionModelSpecification> = {
  normal: "normal_location_scale",
  lognormal: "lognormal_location_zero",
  weibull: "weibull_location_zero",
  gamma: "gamma_location_zero",
  uniform: "uniform_boundary_mle",
};

const MODEL_SPECIFICATION_PARAMETER_COUNT: Record<F7DistributionModelSpecification, number> = {
  normal_location_scale: 2,
  lognormal_location_zero: 2,
  lognormal_location_free: 3,
  weibull_location_zero: 2,
  weibull_location_free: 3,
  gamma_location_zero: 2,
  gamma_location_free: 3,
  uniform_boundary_mle: 2,
};

export const F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS = 500;
export const F7_MODEL_SELECTION_METHOD_ID = "F7_MODEL_SELECTION_V1";

type CandidateEligibility = F7DatasetValidationResult["candidateEligibility"];

type CandidateWithPendingDeltas = Omit<F7DistributionFitCandidate, "deltaAicc" | "deltaBic"> & {
  readonly deltaAicc: number;
  readonly deltaBic: number;
};

export function parameterCountForModelSpecification(specification: F7DistributionModelSpecification): number {
  return MODEL_SPECIFICATION_PARAMETER_COUNT[specification];
}

export interface FitDistributionRequest {
  readonly factorId: string;
  readonly observations: readonly number[];
  readonly candidateEligibility: CandidateEligibility;
  readonly bootstrapSeed: string;
  readonly characteristicKind?: F7DistributionCharacteristicKind;
}

interface RandomSource {
  next(): number;
}

interface FittedModel {
  readonly parameters: Readonly<Record<string, number>>;
  readonly logLikelihood: number;
  cdf(value: number): number;
  quantile(probability: number): number;
  sample(random: RandomSource): number;
}

class Pcg32 implements RandomSource {
  private state = 0n;
  private readonly increment: bigint;

  constructor(initialState: bigint, initialSequence: bigint) {
    this.increment = ((initialSequence << 1n) | 1n) & UINT64_MASK;
    this.nextUint32();
    this.state = (this.state + initialState) & UINT64_MASK;
    this.nextUint32();
  }

  next(): number {
    return (this.nextUint32() + 0.5) / UINT32_RANGE;
  }

  nextUint32(): number {
    const previous = this.state;
    this.state = (previous * PCG_MULTIPLIER + this.increment) & UINT64_MASK;
    const shifted = Number((((previous >> 18n) ^ previous) >> 27n) & 0xffff_ffffn) >>> 0;
    const rotation = Number(previous >> 59n);
    return ((shifted >>> rotation) | (shifted << ((-rotation) & 31))) >>> 0;
  }
}

export function generatePcg32Sequence(
  initialState: bigint,
  initialSequence: bigint,
  count: number,
): number[] {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("count must be a nonnegative safe integer.");
  const random = new Pcg32(initialState, initialSequence);
  return Array.from({ length: count }, () => random.nextUint32());
}

const UINT63_MASK = (1n << 63n) - 1n;

export const F7_BOOTSTRAP_METHOD_ID = "F7_BOOTSTRAP_V2";
export const DISTRIBUTION_FIT_METHOD_ID = "F7_DISTRIBUTION_FIT_V1";

export interface BootstrapStreamDerivationRequest {
  readonly seed: string;
  readonly factorIdentity: string;
  readonly methodId: string;
  readonly candidateId?: string;
  readonly replicateIndex: bigint;
}

export interface BootstrapStreamDerivation {
  readonly streamDigest: string;
  readonly initialState: bigint;
  readonly initialSequence: bigint;
}

function encodePresentText(value: string): Buffer {
  const bytes = Buffer.from(value.normalize("NFC"), "utf8");
  const encoded = Buffer.allocUnsafe(5 + bytes.length);
  encoded[0] = 1;
  encoded.writeUInt32BE(bytes.length, 1);
  bytes.copy(encoded, 5);
  return encoded;
}

export function deriveBootstrapStream(request: BootstrapStreamDerivationRequest): BootstrapStreamDerivation {
  if (!/^[a-f0-9]{64}$/.test(request.seed)) {
    throw new Error("bootstrap seed must be exactly 64 lowercase hexadecimal characters.");
  }
  if (request.replicateIndex < 0n || request.replicateIndex > UINT64_MASK) {
    throw new Error("replicateIndex must be an unsigned 64-bit integer.");
  }
  const candidate = request.candidateId === undefined
    ? Buffer.from([0])
    : encodePresentText(request.candidateId);
  const replicate = Buffer.allocUnsafe(8);
  replicate.writeBigUInt64BE(request.replicateIndex);
  const digest = createHash("sha256")
    .update(`${F7_BOOTSTRAP_METHOD_ID}\0`, "utf8")
    .update(Buffer.from(request.seed, "hex"))
    .update(encodePresentText(request.factorIdentity))
    .update(encodePresentText(request.methodId))
    .update(candidate)
    .update(replicate)
    .digest();
  return {
    streamDigest: digest.toString("hex"),
    initialState: digest.readBigUInt64LE(0),
    initialSequence: digest.readBigUInt64LE(8) & UINT63_MASK,
  };
}

function deriveCandidateRandom(
  seed: string,
  factorId: string,
  candidateId: string,
  candidateMethodId: string,
  replicateIndex: number,
): RandomSource {
  const stream = deriveBootstrapStream({
    seed,
    factorIdentity: factorId,
    methodId: candidateMethodId,
    candidateId,
    replicateIndex: BigInt(replicateIndex),
  });
  return new Pcg32(stream.initialState, stream.initialSequence);
}

function wilsonScoreInterval(successes: number, trials: number): { lower: number; upper: number } {
  const zSquared = BOOTSTRAP_Z_95 * BOOTSTRAP_Z_95;
  const proportion = successes / trials;
  const denominator = 1 + zSquared / trials;
  const center = (proportion + zSquared / (2 * trials)) / denominator;
  const margin = (BOOTSTRAP_Z_95 / denominator)
    * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * trials)) / trials);
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

export interface AndersonDarlingParametricBootstrapRequest<
  TModel,
  TReplicates extends number = number,
  TCandidateMethodId extends string = string,
> {
  readonly observedStatistic: number;
  readonly replicateCount: TReplicates;
  readonly seed: string;
  readonly factorId: string;
  readonly candidateId: string;
  readonly candidateMethodId: TCandidateMethodId;
  readonly observedModel: TModel;
  readonly sampleSize: number;
  readonly sampleFromModel: (model: TModel, random: RandomSource, index: number) => number;
  readonly refitModel: (sample: readonly number[], replicateIndex: number) => TModel;
  readonly computeAndersonDarling: (sample: readonly number[], model: TModel) => number;
}

export interface AndersonDarlingParametricBootstrapResult<
  TReplicates extends number = number,
  TCandidateMethodId extends string = string,
> {
  readonly statisticId: "anderson_darling";
  readonly observedStatistic: number;
  readonly comparisonDirection: "greater_than_or_equal";
  readonly refitEachReplicate: true;
  readonly extremeReplicateCount: number;
  readonly confidenceInterval: {
    readonly level: 0.95;
    readonly method: "wilson_score";
    readonly lower: number;
    readonly upper: number;
  };
  readonly pValue: number;
  readonly replicates: TReplicates;
  readonly seed: string;
  readonly methodId: typeof F7_BOOTSTRAP_METHOD_ID;
  readonly candidateMethodId: TCandidateMethodId;
  readonly streamDigest: string;
  readonly status: F7DistributionFitStatus;
}

export function runAndersonDarlingParametricBootstrap<
  TModel,
  TReplicates extends number,
  TCandidateMethodId extends string,
>(
  request: AndersonDarlingParametricBootstrapRequest<TModel, TReplicates, TCandidateMethodId>,
): AndersonDarlingParametricBootstrapResult<TReplicates, TCandidateMethodId> {
  if (!Number.isFinite(request.observedStatistic) || request.observedStatistic < 0) {
    throw new Error("observedStatistic must be a finite nonnegative number.");
  }
  if (!Number.isSafeInteger(request.replicateCount) || request.replicateCount <= 0) {
    throw new Error("replicateCount must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(request.sampleSize) || request.sampleSize <= 0) {
    throw new Error("sampleSize must be a positive safe integer.");
  }

  const referenceStream = deriveBootstrapStream({
    seed: request.seed,
    factorIdentity: request.factorId,
    methodId: request.candidateMethodId,
    candidateId: request.candidateId,
    replicateIndex: 0n,
  });

  let extremeReplicateCount = 0;
  for (let replicateIndex = 0; replicateIndex < request.replicateCount; replicateIndex += 1) {
    const random = deriveCandidateRandom(
      request.seed,
      request.factorId,
      request.candidateId,
      request.candidateMethodId,
      replicateIndex,
    );
    const sample = Array.from(
      { length: request.sampleSize },
      (_, index) => request.sampleFromModel(request.observedModel, random, index),
    );
    const refittedModel = request.refitModel(sample, replicateIndex);
    const replicateStatistic = request.computeAndersonDarling(sample, refittedModel);
    if (!Number.isFinite(replicateStatistic) || replicateStatistic < 0) {
      throw new Error("Bootstrap replicate statistics must be finite nonnegative numbers.");
    }
    if (replicateStatistic >= request.observedStatistic) extremeReplicateCount += 1;
  }

  const confidenceInterval = wilsonScoreInterval(extremeReplicateCount, request.replicateCount);
  const pValue = (extremeReplicateCount + 1) / (request.replicateCount + 1);
  return {
    statisticId: "anderson_darling",
    observedStatistic: request.observedStatistic,
    comparisonDirection: "greater_than_or_equal",
    refitEachReplicate: true,
    extremeReplicateCount,
    confidenceInterval: {
      level: 0.95,
      method: "wilson_score",
      lower: confidenceInterval.lower,
      upper: confidenceInterval.upper,
    },
    pValue,
    replicates: request.replicateCount,
    seed: request.seed,
    methodId: F7_BOOTSTRAP_METHOD_ID,
    candidateMethodId: request.candidateMethodId,
    streamDigest: referenceStream.streamDigest,
    status: bootstrapStatus(pValue),
  };
}

function mean(values: readonly number[]): number {
  const scale = values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  if (scale === 0) return 0;
  let sum = 0;
  let compensation = 0;
  for (const value of values) {
    const adjusted = value / scale - compensation;
    const next = sum + adjusted;
    compensation = (next - sum) - adjusted;
    sum = next;
  }
  const normalizedMean = sum / values.length;
  const scaledMean = scale * normalizedMean;
  return Number.isFinite(scaledMean) ? scaledMean : Math.sign(normalizedMean) * Number.MAX_VALUE;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return sorted[middle - 1]! / 2 + sorted[middle]! / 2;
}

function standardDeviation(values: readonly number[], location: number): number {
  const scale = values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  if (scale === 0) return 0;
  const normalizedLocation = location / scale;
  let sum = 0;
  let compensation = 0;
  for (const value of values) {
    const normalized = value / scale - normalizedLocation;
    const term = normalized * normalized;
    const adjusted = term - compensation;
    const next = sum + adjusted;
    compensation = (next - sum) - adjusted;
    sum = next;
  }
  const normalizedDeviation = Math.sqrt(sum / values.length);
  const scaledDeviation = scale * normalizedDeviation;
  return Number.isFinite(scaledDeviation) ? scaledDeviation : Number.MAX_VALUE;
}

function correctedSampleSkewness(values: readonly number[], location: number): number {
  if (values.length < 3) return 0;
  const scale = values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  if (scale === 0) return 0;
  const normalizedLocation = location / scale;
  let sumSquares = 0;
  let squareCompensation = 0;
  for (const value of values) {
    const centered = value / scale - normalizedLocation;
    const term = centered * centered;
    const adjusted = term - squareCompensation;
    const next = sumSquares + adjusted;
    squareCompensation = (next - sumSquares) - adjusted;
    sumSquares = next;
  }
  if (sumSquares === 0) return 0;
  const sampleVariance = sumSquares / (values.length - 1);
  if (sampleVariance === 0) return 0;
  const sampleStandardDeviation = Math.sqrt(sampleVariance);
  let standardizedCubeSum = 0;
  let cubeCompensation = 0;
  for (const value of values) {
    const standardized = (value / scale - normalizedLocation) / sampleStandardDeviation;
    const term = standardized ** 3;
    const adjusted = term - cubeCompensation;
    const next = standardizedCubeSum + adjusted;
    cubeCompensation = (next - standardizedCubeSum) - adjusted;
    standardizedCubeSum = next;
  }
  return (values.length / ((values.length - 1) * (values.length - 2))) * standardizedCubeSum;
}

function normalQqCurvature(values: readonly number[], location: number, spread: number): number {
  if (values.length < 3 || spread === 0) return 0;
  const scale = values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  if (scale === 0) return 0;
  const normalizedLocation = location / scale;
  const normalizedSpread = spread / scale;
  const sorted = values.map((value) => value / scale).sort((left, right) => left - right);
  const theoretical = sorted.map((_, index) => standardNormalQuantile((index + 0.5) / sorted.length));
  const observed = sorted.map((value) => (value - normalizedLocation) / normalizedSpread);
  const theoreticalMean = theoretical.reduce((sum, value) => sum + value, 0) / theoretical.length;
  const observedMean = observed.reduce((sum, value) => sum + value, 0) / observed.length;
  const theoreticalVariance = theoretical.reduce(
    (sum, value) => sum + (value - theoreticalMean) ** 2,
    0,
  );
  if (theoreticalVariance === 0) return 0;
  const slope = theoretical.reduce(
    (sum, value, index) => sum + (value - theoreticalMean) * (observed[index]! - observedMean),
    0,
  ) / theoreticalVariance;
  const intercept = observedMean - slope * theoreticalMean;
  const residualMeanSquare = observed.reduce((sum, value, index) => {
    const residual = value - (intercept + slope * theoretical[index]!);
    return sum + residual * residual;
  }, 0) / observed.length;
  // Standardized observations make this best-line residual RMS dimensionless and scale-invariant.
  return Math.sqrt(residualMeanSquare);
}

export function computeSampleDiagnostics(values: readonly number[]): F7SampleDiagnostics {
  if (values.length === 0) throw new Error("At least one observation is required.");
  if (values.some((value) => !Number.isFinite(value))) throw new Error("Observations must be finite.");
  const sampleMean = mean(values);
  const sampleMedian = median(values);
  const spread = standardDeviation(values, sampleMean);
  return {
    mean: sampleMean,
    median: sampleMedian,
    skewness: correctedSampleSkewness(values, sampleMean),
    coefficientOfVariation: sampleMean === 0
      ? Number.MAX_VALUE
      : Math.abs(sampleMean) <= Math.abs(spread) / Number.MAX_VALUE
        ? Number.MAX_VALUE
        : Math.abs(spread / sampleMean),
    meanMedianRelativeDifference: Math.max(Math.abs(sampleMean), Math.abs(sampleMedian)) === 0
      ? 0
      : Math.abs(
        sampleMean / Math.max(Math.abs(sampleMean), Math.abs(sampleMedian))
        - sampleMedian / Math.max(Math.abs(sampleMean), Math.abs(sampleMedian)),
      ),
    normalQqCurvature: normalQqCurvature(values, sampleMean, spread),
  };
}

function standardNormalCdf(value: number): number {
  const absolute = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * absolute);
  const density = Math.exp(-0.5 * absolute * absolute) / Math.sqrt(2 * Math.PI);
  const tail = density * t * (
    0.319381530
    + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))
  );
  return value >= 0 ? 1 - tail : tail;
}

function standardNormalQuantile(probability: number): number {
  if (!(probability > 0 && probability < 1)) {
    throw new Error("Normal quantile probability must be between zero and one.");
  }
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const lowerTail = 0.02425;
  if (probability < lowerTail) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!)
      / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (probability > 1 - lowerTail) {
    const q = Math.sqrt(-2 * Math.log1p(-probability));
    return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!)
      / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  const q = probability - 0.5;
  const r = q * q;
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q
    / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

function sampleStandardNormal(random: RandomSource): number {
  return Math.sqrt(-2 * Math.log(random.next())) * Math.cos(2 * Math.PI * random.next());
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

function digamma(value: number): number {
  let x = value;
  let result = 0;
  while (x < 8) {
    result -= 1 / x;
    x += 1;
  }
  const inverse = 1 / x;
  const inverseSquared = inverse * inverse;
  return result + Math.log(x) - 0.5 * inverse
    - inverseSquared * (1 / 12 - inverseSquared * (1 / 120 - inverseSquared * (1 / 252)));
}

function trigamma(value: number): number {
  let x = value;
  let result = 0;
  while (x < 8) {
    result += 1 / (x * x);
    x += 1;
  }
  const inverse = 1 / x;
  const inverseSquared = inverse * inverse;
  return result + inverse + inverseSquared / 2 + inverseSquared * inverse / 6
    - inverseSquared * inverseSquared * inverse / 30
    + inverseSquared * inverseSquared * inverseSquared * inverse / 42;
}

function regularizedGammaP(shape: number, value: number): number {
  if (value <= 0) return 0;
  const logScale = shape * Math.log(value) - value - logGamma(shape);
  if (value < shape + 1) {
    let term = 1 / shape;
    let sum = term;
    let denominator = shape;
    for (let iteration = 1; iteration <= 200; iteration += 1) {
      denominator += 1;
      term *= value / denominator;
      sum += term;
      if (Math.abs(term) <= Math.abs(sum) * 1e-14) break;
    }
    return Math.min(1, Math.max(0, sum * Math.exp(logScale)));
  }

  let b = value + 1 - shape;
  let c = 1 / Number.MIN_VALUE;
  let d = 1 / b;
  let fraction = d;
  for (let iteration = 1; iteration <= 200; iteration += 1) {
    const coefficient = -iteration * (iteration - shape);
    b += 2;
    d = coefficient * d + b;
    if (Math.abs(d) < Number.MIN_VALUE) d = Number.MIN_VALUE;
    c = b + coefficient / c;
    if (Math.abs(c) < Number.MIN_VALUE) c = Number.MIN_VALUE;
    d = 1 / d;
    const delta = d * c;
    fraction *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return Math.min(1, Math.max(0, 1 - Math.exp(logScale) * fraction));
}

function sampleGamma(shape: number, scale: number, random: RandomSource): number {
  if (shape < 1) {
    return sampleGamma(shape + 1, scale, random) * random.next() ** (1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const normal = sampleStandardNormal(random);
    const base = 1 + c * normal;
    if (base <= 0) continue;
    const cube = base ** 3;
    const uniform = random.next();
    if (uniform < 1 - 0.0331 * normal ** 4) return scale * d * cube;
    if (Math.log(uniform) < 0.5 * normal * normal + d * (1 - cube + Math.log(cube))) {
      return scale * d * cube;
    }
  }
}

function gammaQuantile(probability: number, shape: number, scale: number): number {
  if (!(probability > 0 && probability < 1)) {
    throw new Error("Gamma quantile probability must be between zero and one.");
  }
  let lower = 0;
  let upper = Math.max(scale, shape * scale);
  while (regularizedGammaP(shape, upper / scale) < probability) {
    upper *= 2;
    if (!Number.isFinite(upper)) throw new Error("Gamma quantile could not establish a finite upper bound.");
  }
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const midpoint = lower + (upper - lower) / 2;
    if (regularizedGammaP(shape, midpoint / scale) < probability) lower = midpoint;
    else upper = midpoint;
  }
  return lower + (upper - lower) / 2;
}

function fitNormal(values: readonly number[]): FittedModel {
  const location = mean(values);
  const scale = standardDeviation(values, location);
  if (!(scale > 0)) throw new Error("Distribution fitting requires observations with nonzero variance.");
  const logLikelihood = -values.length * Math.log(scale * Math.sqrt(2 * Math.PI))
    - values.reduce((sum, value) => sum + ((value - location) / scale) ** 2, 0) / 2;
  return {
    parameters: { mean: location, standardDeviation: scale },
    logLikelihood,
    cdf: (value) => standardNormalCdf((value - location) / scale),
    quantile: (probability) => location + scale * standardNormalQuantile(probability),
    sample: (random) => location + scale * sampleStandardNormal(random),
  };
}

function fitLognormal(values: readonly number[]): FittedModel {
  const logs = values.map(Math.log);
  const logMean = mean(logs);
  const logStandardDeviation = standardDeviation(logs, logMean);
  if (!(logStandardDeviation > 0)) throw new Error("Lognormal fitting requires positive observations with nonzero log variance.");
  const logLikelihood = -values.length * Math.log(logStandardDeviation * Math.sqrt(2 * Math.PI))
    - logs.reduce((sum, value) => sum + ((value - logMean) / logStandardDeviation) ** 2, 0) / 2
    - logs.reduce((sum, value) => sum + value, 0);
  return {
    parameters: { logMean, logStandardDeviation },
    logLikelihood,
    cdf: (value) => value <= 0 ? 0 : standardNormalCdf((Math.log(value) - logMean) / logStandardDeviation),
    quantile: (probability) => Math.exp(logMean + logStandardDeviation * standardNormalQuantile(probability)),
    sample: (random) => Math.exp(logMean + logStandardDeviation * sampleStandardNormal(random)),
  };
}

function fitGamma(values: readonly number[]): FittedModel {
  const location = mean(values);
  let scoreTarget = 0;
  let sumLogRatio = 0;
  for (const value of values) {
    const delta = value / location - 1;
    const logRatio = Math.log1p(delta);
    scoreTarget += delta - logRatio;
    sumLogRatio += logRatio;
  }
  scoreTarget /= values.length;
  if (!(scoreTarget > 0)) throw new Error("Gamma fitting requires positive observations with variation.");
  let shape = (3 - scoreTarget + Math.sqrt((scoreTarget - 3) ** 2 + 24 * scoreTarget)) / (12 * scoreTarget);
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const score = Math.log(shape) - digamma(shape) - scoreTarget;
    const derivative = 1 / shape - trigamma(shape);
    const next = shape - score / derivative;
    const bounded = Number.isFinite(next) && next > 0 ? next : shape / 2;
    if (Math.abs(bounded - shape) <= 1e-12 * Math.max(1, shape)) {
      shape = bounded;
      break;
    }
    shape = bounded;
  }
  const scale = location / shape;
  if (!(scale > 0) || !Number.isFinite(scale)) throw new Error("Gamma fitting produced an invalid scale.");
  const logLikelihood = values.length * (
    shape * Math.log(shape) - logGamma(shape) - Math.log(location) - shape
  ) + (shape - 1) * sumLogRatio;
  return {
    parameters: { shape, scale },
    logLikelihood,
    cdf: (value) => value <= 0 ? 0 : regularizedGammaP(shape, value / scale),
    quantile: (probability) => gammaQuantile(probability, shape, scale),
    sample: (random) => sampleGamma(shape, scale, random),
  };
}

function weibullWeightedMoments(logs: readonly number[], shape: number): { mean: number; variance: number; logMeanPower: number } {
  const maximum = Math.max(...logs.map((value) => shape * value));
  let totalWeight = 0;
  let weightedLog = 0;
  let sumScaledPower = 0;
  for (const logValue of logs) {
    const weight = Math.exp(shape * logValue - maximum);
    totalWeight += weight;
    weightedLog += weight * logValue;
    sumScaledPower += weight;
  }
  const weightedMean = weightedLog / totalWeight;
  let weightedSquaredDeviation = 0;
  for (const logValue of logs) {
    const weight = Math.exp(shape * logValue - maximum);
    weightedSquaredDeviation += weight * (logValue - weightedMean) ** 2;
  }
  return {
    mean: weightedMean,
    variance: weightedSquaredDeviation / totalWeight,
    logMeanPower: maximum + Math.log(sumScaledPower / logs.length),
  };
}

function fitWeibull(values: readonly number[]): FittedModel {
  const logs = values.map(Math.log);
  const meanLog = mean(logs);
  const logStandardDeviation = standardDeviation(logs, meanLog);
  if (!(logStandardDeviation > 0)) throw new Error("Weibull fitting requires positive observations with nonzero log variance.");
  let shape = Math.max(0.1, 1.2 / logStandardDeviation);
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const weighted = weibullWeightedMoments(logs, shape);
    const score = 1 / shape + meanLog - weighted.mean;
    const derivative = -1 / (shape * shape) - weighted.variance;
    const next = shape - score / derivative;
    const bounded = Number.isFinite(next) && next > 0 ? next : shape / 2;
    if (Math.abs(bounded - shape) <= 1e-12 * Math.max(1, shape)) {
      shape = bounded;
      break;
    }
    shape = bounded;
  }
  const weighted = weibullWeightedMoments(logs, shape);
  const scale = Math.exp(weighted.logMeanPower / shape);
  const poweredSum = values.reduce((sum, value) => sum + (value / scale) ** shape, 0);
  const logLikelihood = values.length * Math.log(shape) - values.length * shape * Math.log(scale)
    + (shape - 1) * logs.reduce((sum, value) => sum + value, 0) - poweredSum;
  return {
    parameters: { shape, scale },
    logLikelihood,
    cdf: (value) => value <= 0 ? 0 : -Math.expm1(-((value / scale) ** shape)),
    quantile: (probability) => scale * (-Math.log1p(-probability)) ** (1 / shape),
    sample: (random) => scale * (-Math.log1p(-random.next())) ** (1 / shape),
  };
}

function fitUniform(values: readonly number[]): FittedModel {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum;
  if (!(range > 0)) throw new Error("Uniform fitting requires observations with nonzero range.");
  return {
    parameters: { minimum, maximum },
    logLikelihood: -values.length * Math.log(range),
    cdf: (value) => value <= minimum ? 0 : value >= maximum ? 1 : (value - minimum) / range,
    quantile: (probability) => minimum + range * probability,
    sample: (random) => minimum + range * random.next(),
  };
}

function fitFamily(family: F7DistributionCandidateFamily, values: readonly number[]): FittedModel {
  switch (family) {
    case "normal": return fitNormal(values);
    case "lognormal": return fitLognormal(values);
    case "weibull": return fitWeibull(values);
    case "gamma": return fitGamma(values);
    case "uniform": return fitUniform(values);
  }
}

function goodnessOfFit(values: readonly number[], model: FittedModel): { ks: number; ad: number } {
  const sorted = [...values].sort((left, right) => left - right);
  const sampleSize = sorted.length;
  let ks = 0;
  let adSum = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    const lowerCdf = Math.min(1 - PROBABILITY_EPSILON, Math.max(PROBABILITY_EPSILON, model.cdf(sorted[index]!)));
    const upperCdf = Math.min(1 - PROBABILITY_EPSILON, Math.max(PROBABILITY_EPSILON, model.cdf(sorted[sampleSize - index - 1]!)));
    ks = Math.max(ks, (index + 1) / sampleSize - lowerCdf, lowerCdf - index / sampleSize);
    adSum += (2 * (index + 1) - 1) * (Math.log(lowerCdf) + Math.log1p(-upperCdf));
  }
  return { ks, ad: Math.max(0, -sampleSize - adSum / sampleSize) };
}

function quantileQuantilePoints(
  values: readonly number[],
  model: FittedModel,
): F7DistributionFitCandidate["qqPoints"] {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted.map((observed, index) => ({
    observed,
    theoretical: model.quantile((index + 0.5) / sorted.length),
  }));
}

export function bootstrapStatus(pValue: number): F7DistributionFitStatus {
  if (pValue < 0.05) return "rejected";
  if (pValue < 0.1) return "weak";
  return "acceptable";
}

function pushReasonCode(reasonCodes: F7SelectionDecisionReasonCode[], reasonCode: F7SelectionDecisionReasonCode): void {
  if (!reasonCodes.includes(reasonCode)) reasonCodes.push(reasonCode);
}

export function selectDistributionModels(
  candidates: readonly F7DistributionFitCandidate[],
  sampleDiagnostics: F7SampleDiagnostics,
  options: {
    readonly sampleSize: number;
    readonly characteristicKind: F7DistributionCharacteristicKind;
    readonly failedCandidates: F7DistributionFitResult["failedCandidates"];
  },
): F7SelectionDecision {
  const acceptable = candidates.filter((candidate) => candidate.bootstrap.status === "acceptable");
  const reasonCodes: F7SelectionDecisionReasonCode[] = [];
  const familyPrecedence = new Map(F7_DISTRIBUTION_CANDIDATE_ORDER.map((family, index) => [family, index]));
  const bestAcceptable = acceptable.reduce<F7DistributionFitCandidate | undefined>((best, candidate) => {
    if (best === undefined || candidate.aicc < best.aicc) return candidate;
    if (candidate.aicc > best.aicc) return best;
    return familyPrecedence.get(candidate.family)! < familyPrecedence.get(best.family)! ? candidate : best;
  }, undefined);
  const competitiveFamilies = bestAcceptable === undefined
    ? []
    : acceptable
      .filter((candidate) => candidate.aicc - bestAcceptable.aicc <= 2)
      .map((candidate) => candidate.family);

  if (bestAcceptable === undefined) {
    pushReasonCode(reasonCodes, "NO_ACCEPTABLE_MODEL");
  } else if (competitiveFamilies.length === 1) {
    pushReasonCode(reasonCodes, "SINGLE_ACCEPTABLE_COMPETITOR");
  } else {
    pushReasonCode(reasonCodes, "MULTIPLE_COMPETITIVE_MODELS");
  }

  if (options.failedCandidates.length > 0) {
    pushReasonCode(reasonCodes, "CANDIDATE_FIT_FAILURES");
  }
  if (options.sampleSize < 50) {
    pushReasonCode(reasonCodes, "SMALL_SAMPLE_UNCERTAINTY");
  }

  const canUseEngineeringDefault = options.failedCandidates.length === 0
    && options.characteristicKind === "dimensional"
    && competitiveFamilies.length > 1
    && competitiveFamilies.includes("normal")
    && Math.abs(sampleDiagnostics.skewness) <= F7_SELECTION_NORMAL_SKEWNESS_MAX
    && sampleDiagnostics.coefficientOfVariation <= F7_SELECTION_NORMAL_COEFFICIENT_OF_VARIATION_MAX
    && sampleDiagnostics.meanMedianRelativeDifference <= F7_SELECTION_NORMAL_MEAN_MEDIAN_RELATIVE_DIFFERENCE_MAX
    && sampleDiagnostics.normalQqCurvature <= F7_SELECTION_NORMAL_QQ_CURVATURE_MAX;
  if (canUseEngineeringDefault) {
    pushReasonCode(reasonCodes, "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT");
  }

  const status = options.failedCandidates.length > 0
    ? "withheld_candidate_failures"
    : bestAcceptable === undefined
      ? "no_acceptable_model"
      : competitiveFamilies.length === 1
        ? "unique_preference"
        : "no_unique_preference";
  const confidence = options.failedCandidates.length > 0
    || bestAcceptable === undefined
    || (options.sampleSize < 50 && competitiveFamilies.length > 1)
    ? "low"
    : "moderate";
  const proposedFinalFamily = options.failedCandidates.length > 0 || bestAcceptable === undefined
    ? undefined
    : competitiveFamilies.includes("normal")
      ? "normal" as const
      : bestAcceptable.family;

  return {
    methodId: F7_MODEL_SELECTION_METHOD_ID,
    status,
    ...(bestAcceptable ? { numericBestFamily: bestAcceptable.family } : {}),
    competitiveFamilies,
    ...(canUseEngineeringDefault ? { engineeringDefaultFamily: "normal" as const } : {}),
    ...(proposedFinalFamily ? { proposedFinalFamily } : {}),
    confidence,
    reasonCodes,
  };
}

function fitCandidate(
  family: F7DistributionCandidateFamily,
  values: readonly number[],
  seed: string,
  factorId: string,
): CandidateWithPendingDeltas {
  const model = fitFamily(family, values);
  const modelSpecification = MODEL_SPECIFICATION_BY_FAMILY[family];
  const parameterCount = parameterCountForModelSpecification(modelSpecification);
  const diagnostics = goodnessOfFit(values, model);
  const bootstrap = runAndersonDarlingParametricBootstrap({
    observedStatistic: diagnostics.ad,
    replicateCount: BOOTSTRAP_REPLICATES,
    seed,
    factorId,
    candidateId: family,
    candidateMethodId: DISTRIBUTION_FIT_METHOD_ID,
    observedModel: model,
    sampleSize: values.length,
    sampleFromModel: (sourceModel, random) => sourceModel.sample(random),
    refitModel: (sample) => fitFamily(family, sample),
    computeAndersonDarling: (sample, refittedModel) => goodnessOfFit(sample, refittedModel).ad,
  });
  const aic = 2 * parameterCount - 2 * model.logLikelihood;
  const aicc = aic + (2 * parameterCount * (parameterCount + 1))
    / (values.length - parameterCount - 1);
  return {
    family,
    modelSpecification,
    parameterCount,
    parameters: model.parameters,
    logLikelihood: model.logLikelihood,
    aic,
    aicc,
    bic: parameterCount * Math.log(values.length) - 2 * model.logLikelihood,
    deltaAicc: 0,
    deltaBic: 0,
    ks: diagnostics.ks,
    ad: diagnostics.ad,
    qqPoints: quantileQuantilePoints(values, model),
    bootstrap,
    warnings: family === "uniform" ? [UNIFORM_BOUNDARY_WARNING] : [],
  };
}

function applyCandidateCriterionDeltas(
  candidates: readonly CandidateWithPendingDeltas[],
): F7DistributionFitCandidate[] {
  const minimumAicc = candidates.reduce((best, candidate) => Math.min(best, candidate.aicc), Number.POSITIVE_INFINITY);
  const minimumBic = candidates.reduce((best, candidate) => Math.min(best, candidate.bic), Number.POSITIVE_INFINITY);
  return candidates.map((candidate) => ({
    ...candidate,
    deltaAicc: candidate.aicc - minimumAicc,
    deltaBic: candidate.bic - minimumBic,
  }));
}

function isEligible(family: F7DistributionCandidateFamily, eligibility: CandidateEligibility): boolean {
  return eligibility[family] !== "ineligible_nonpositive";
}

export function collectCandidateFitResults(
  families: readonly F7DistributionCandidateFamily[],
  fitter: (family: F7DistributionCandidateFamily) => CandidateWithPendingDeltas,
): Pick<F7DistributionFitResult, "candidates" | "failedCandidates"> {
  const candidates: CandidateWithPendingDeltas[] = [];
  const failedCandidates: F7DistributionFitResult["failedCandidates"][number][] = [];
  for (const family of families) {
    try {
      const candidate = fitter(family);
      const diagnostics = [
        candidate.parameterCount,
        candidate.logLikelihood,
        candidate.aic,
        candidate.aicc,
        candidate.bic,
        candidate.ks,
        candidate.ad,
      ];
      const qqValues = candidate.qqPoints.flatMap((point) => [point.observed, point.theoretical]);
      if (!Object.values(candidate.parameters).every(Number.isFinite)
        || !diagnostics.every(Number.isFinite)
        || !qqValues.every(Number.isFinite)) {
        throw new Error("Candidate fitting produced non-finite output.");
      }
      candidates.push(candidate);
    } catch {
      failedCandidates.push({ family, reasonCode: "numerical_fit_failed" });
    }
  }
  const candidatesWithDeltas = applyCandidateCriterionDeltas(candidates);
  const finiteCandidates = candidatesWithDeltas.filter((candidate) => {
    if (Number.isFinite(candidate.deltaAicc) && Number.isFinite(candidate.deltaBic)) return true;
    failedCandidates.push({ family: candidate.family, reasonCode: "numerical_fit_failed" });
    return false;
  });
  return { candidates: applyCandidateCriterionDeltas(finiteCandidates), failedCandidates };
}

export function fitDistribution(request: FitDistributionRequest): F7DistributionFitResult {
  if (!/^[a-f0-9]{64}$/.test(request.factorId)) throw new Error("factorId must be a lowercase SHA-256 value.");
  if (!/^[a-f0-9]{64}$/.test(request.bootstrapSeed)) throw new Error("bootstrapSeed must be a lowercase 32-byte hexadecimal value.");
  const eligibleFamilies = F7_DISTRIBUTION_CANDIDATE_ORDER.filter((candidate) => isEligible(candidate, request.candidateEligibility));
  const maximumParameterCount = eligibleFamilies.reduce(
    (maximum, family) => Math.max(maximum, parameterCountForModelSpecification(MODEL_SPECIFICATION_BY_FAMILY[family])),
    0,
  );
  if (request.observations.length <= maximumParameterCount + 1) throw new Error("At least four observations are required for AICc.");
  if (request.observations.length > F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS) {
    throw new Error(`Distribution fitting accepts at most ${F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS} observations.`);
  }
  if (request.observations.some((value) => !Number.isFinite(value))) throw new Error("Observations must be finite.");

  const { candidates, failedCandidates } = collectCandidateFitResults(
    eligibleFamilies,
    (family) => fitCandidate(family, request.observations, request.bootstrapSeed, request.factorId),
  );
  if (candidates.length === 0) {
    throw new Error("No eligible distribution candidate could be fitted with finite diagnostics.");
  }
  const sampleDiagnostics = computeSampleDiagnostics(request.observations);
  const selectionDecision = selectDistributionModels(candidates, sampleDiagnostics, {
    sampleSize: request.observations.length,
    characteristicKind: request.characteristicKind ?? "other",
    failedCandidates,
  });

  return {
    factorId: request.factorId,
    sampleSize: request.observations.length,
    characteristicKind: request.characteristicKind ?? "other",
    candidates,
    failedCandidates,
    sampleDiagnostics,
    selectionDecision,
  };
}