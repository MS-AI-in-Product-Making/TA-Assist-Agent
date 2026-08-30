import type { F7DistributionFitCandidate, F7SetupDistribution } from "./api/f7-client";

export interface FactorSetupAssumption {
  readonly mean: number;
  readonly standardDeviation: number;
  readonly distribution: F7SetupDistribution;
  readonly longTermSafetyFactor: number;
  readonly sigmaLevel: number;
}

export interface FactorSetupAssumptionInput {
  readonly signedMean: number;
  readonly oneSigma: number;
  readonly distribution: F7SetupDistribution;
  readonly longTermSafetyFactor: number;
  readonly sigmaLevel: number;
}

export function buildFactorSetupAssumption(input: FactorSetupAssumptionInput): FactorSetupAssumption {
  return {
    mean: Math.abs(input.signedMean),
    standardDeviation: input.oneSigma,
    distribution: input.distribution,
    longTermSafetyFactor: input.longTermSafetyFactor,
    sigmaLevel: input.sigmaLevel,
  };
}

export interface DistributionFitPlotCandidate {
  readonly family: F7DistributionFitCandidate["family"];
  readonly parameters: Readonly<Record<string, number>>;
  readonly qqPoints: readonly {
    readonly observed: number;
    readonly theoretical: number;
  }[];
}

export interface DistributionFitHistogramBin {
  readonly minimum: number;
  readonly maximum: number;
  readonly frequency: number;
}

export interface DistributionFitCurvePoint {
  readonly x: number;
  readonly expectedFrequency: number;
}

export interface DistributionFitPlotModel {
  readonly domainMinimum: number;
  readonly domainMaximum: number;
  readonly maximumFrequency: number;
  readonly bins: readonly DistributionFitHistogramBin[];
  readonly curve: readonly DistributionFitCurvePoint[];
  readonly assumptionCurve: readonly DistributionFitCurvePoint[];
  readonly ticks: readonly number[];
  readonly frequencyTicks: readonly number[];
}

export interface DistributionFitObservedDomain {
  readonly minimum: number;
  readonly maximum: number;
  readonly binCount: number;
}

export type DistributionFitReferenceLineId =
  | "lower-spec-limit"
  | "upper-spec-limit"
  | "target"
  | "mean"
  | "minus-3-sigma"
  | "plus-3-sigma"
  | "minus-4-sigma"
  | "plus-4-sigma";

export interface DistributionFitReferenceLine {
  readonly id: DistributionFitReferenceLineId;
  readonly value: number;
}

export interface DistributionFitReferences {
  readonly lowerSpecificationLimit: number;
  readonly upperSpecificationLimit: number;
  readonly target: number;
  readonly mean: number;
  readonly sampleStandardDeviation: number;
  readonly specificationDecimalPlaces: number;
  readonly lines: readonly DistributionFitReferenceLine[];
}

export type DistributionFitReferenceLabelRows = Partial<Record<DistributionFitReferenceLineId, number>>;

const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);
const LANCZOS_COEFFICIENTS = [
  676.5203681218851,
  -1259.1392167224028,
  771.3234287776531,
  -176.6150291621406,
  12.507343278686905,
  -0.13857109526572012,
  9.984369578019572e-6,
  1.5056327351493116e-7,
] as const;

function logGamma(value: number): number {
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const shifted = value - 1;
  let series = 0.9999999999998099;
  for (let index = 0; index < LANCZOS_COEFFICIENTS.length; index += 1) {
    series += LANCZOS_COEFFICIENTS[index]! / (shifted + index + 1);
  }
  const total = shifted + LANCZOS_COEFFICIENTS.length - 0.5;
  return Math.log(SQRT_TWO_PI) + (shifted + 0.5) * Math.log(total) - total + Math.log(series);
}

function finiteDensity(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function factorSetupDensity(assumption: FactorSetupAssumption, value: number): number {
  const sigma = assumption.standardDeviation;
  if (!(sigma > 0) || !Number.isFinite(sigma)) return 0;
  const distance = Math.abs(value - assumption.mean);
  let radius: number;
  switch (assumption.distribution) {
    case "Normal": {
      const z = distance / sigma;
      return finiteDensity(Math.exp(-(z ** 2) / 2) / (sigma * SQRT_TWO_PI));
    }
    case "Uniform":
      radius = sigma * Math.sqrt(3);
      return distance <= radius ? 1 / (2 * radius) : 0;
    case "Triangular":
      radius = sigma * Math.sqrt(6);
      return distance <= radius ? (radius - distance) / radius ** 2 : 0;
    case "Trapezoidal": {
      const plateauRatio = 0.5;
      radius = sigma * Math.sqrt(6 / (1 + plateauRatio ** 2));
      const plateauRadius = radius * plateauRatio;
      const height = 1 / (radius + plateauRadius);
      if (distance <= plateauRadius) return height;
      return distance <= radius ? height * (radius - distance) / (radius - plateauRadius) : 0;
    }
    case "Elliptical":
      radius = 2 * sigma;
      return distance <= radius
        ? 2 * Math.sqrt(Math.max(0, 1 - (distance / radius) ** 2)) / (Math.PI * radius)
        : 0;
    case "Beta":
      radius = sigma * Math.sqrt(5);
      return distance <= radius ? 3 * (1 - (distance / radius) ** 2) / (4 * radius) : 0;
  }
}

function factorSetupSupport(assumption: FactorSetupAssumption): readonly [number, number] {
  const sigma = assumption.standardDeviation;
  const radius = assumption.distribution === "Normal"
    ? 4 * sigma
    : assumption.distribution === "Uniform"
      ? Math.sqrt(3) * sigma
      : assumption.distribution === "Triangular"
        ? Math.sqrt(6) * sigma
        : assumption.distribution === "Trapezoidal"
          ? Math.sqrt(6 / 1.25) * sigma
          : assumption.distribution === "Elliptical"
            ? 2 * sigma
            : Math.sqrt(5) * sigma;
  return [assumption.mean - radius, assumption.mean + radius];
}

export function probabilityDensity(
  family: F7DistributionFitCandidate["family"],
  parameters: Readonly<Record<string, number>>,
  value: number,
): number {
  let density = 0;
  switch (family) {
    case "normal": {
      const mean = parameters.mean!;
      const standardDeviation = parameters.standardDeviation!;
      const z = (value - mean) / standardDeviation;
      density = Math.exp(-(z ** 2) / 2) / (standardDeviation * SQRT_TWO_PI);
      break;
    }
    case "lognormal": {
      if (value <= 0) return 0;
      const logMean = parameters.logMean!;
      const logStandardDeviation = parameters.logStandardDeviation!;
      const z = (Math.log(value) - logMean) / logStandardDeviation;
      density = Math.exp(-(z ** 2) / 2) / (value * logStandardDeviation * SQRT_TWO_PI);
      break;
    }
    case "weibull": {
      if (value < 0) return 0;
      const shape = parameters.shape!;
      const scale = parameters.scale!;
      const ratio = value / scale;
      density = (shape / scale) * ratio ** (shape - 1) * Math.exp(-(ratio ** shape));
      break;
    }
    case "gamma": {
      const shape = parameters.shape!;
      const scale = parameters.scale!;
      if (value < 0) return 0;
      if (value === 0) return shape === 1 ? finiteDensity(1 / scale) : 0;
      const logDensity = (shape - 1) * Math.log(value) - value / scale - logGamma(shape) - shape * Math.log(scale);
      density = Math.exp(logDensity);
      break;
    }
    case "uniform": {
      const minimum = parameters.minimum!;
      const maximum = parameters.maximum!;
      density = value >= minimum && value <= maximum ? 1 / (maximum - minimum) : 0;
      break;
    }
  }
  return finiteDensity(density);
}

function histogramBinCount(sorted: readonly number[]): number {
  if (!(sorted.at(-1)! - sorted[0]! > 0)) return 1;
  return Math.max(1, Math.min(64, sorted.length, Math.ceil(Math.log2(sorted.length) + 1)));
}

function interpolate(minimum: number, maximum: number, fraction: number): number {
  return minimum * (1 - fraction) + maximum * fraction;
}

function relativePosition(value: number, minimum: number, maximum: number): number {
  const range = maximum - minimum;
  if (Number.isFinite(range) && range > 0) return (value - minimum) / range;
  const scaledRange = maximum / 2 - minimum / 2;
  return scaledRange > 0 ? (value / 2 - minimum / 2) / scaledRange : 0.5;
}

function constantDomain(value: number): readonly [number, number] {
  const radius = Math.max(Math.abs(value) * 0.08, 1);
  const lower = value - radius;
  const upper = value + radius;
  if (Number.isFinite(lower) && Number.isFinite(upper)) return [lower, upper];
  return value >= 0 ? [value * 0.92, value] : [value, value * 0.92];
}

function decimalPlaces(value: number): number {
  const tolerance = Math.max(1, Math.abs(value)) * 1e-12;
  for (let places = 0; places <= 12; places += 1) {
    const scale = 10 ** places;
    if (Math.abs(value - Math.round(value * scale) / scale) <= tolerance) return places;
  }
  return 12;
}

export function buildReferenceLabelRows(
  lines: readonly DistributionFitReferenceLine[],
  domainMinimum: number,
  domainMaximum: number,
  plotWidth: number,
  minimumGap = 48,
): DistributionFitReferenceLabelRows {
  const domainRange = domainMaximum - domainMinimum;
  const positioned = lines
    .map((line) => ({
      line,
      x: domainRange > 0 && Number.isFinite(domainRange)
        ? (line.value - domainMinimum) / domainRange * plotWidth
        : plotWidth / 2,
    }))
    .sort((left, right) => left.x - right.x);
  const rowLastPositions: number[] = [];
  const rows: DistributionFitReferenceLabelRows = {};
  for (const entry of positioned) {
    const reusableRow = rowLastPositions.findIndex((lastPosition) => entry.x - lastPosition >= minimumGap);
    const row = reusableRow >= 0 ? reusableRow : rowLastPositions.length;
    rowLastPositions[row] = entry.x;
    rows[entry.line.id] = row;
  }
  return rows;
}

export function buildDistributionFitReferences(
  candidates: readonly DistributionFitPlotCandidate[],
  lowerSpecificationLimit: number,
  upperSpecificationLimit: number,
): DistributionFitReferences {
  const observed = candidates[0]!.qqPoints.map((point) => point.observed);
  const mean = observed.reduce((sum, value) => sum + value, 0) / observed.length;
  const squaredDeviationSum = observed.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const sampleStandardDeviation = observed.length > 1
    ? Math.sqrt(squaredDeviationSum / (observed.length - 1))
    : 0;
  const target = (lowerSpecificationLimit + upperSpecificationLimit) / 2;
  const specificationDecimalPlaces = Math.max(
    decimalPlaces(lowerSpecificationLimit),
    decimalPlaces(upperSpecificationLimit),
  );
  const lines: readonly DistributionFitReferenceLine[] = [
    { id: "lower-spec-limit", value: lowerSpecificationLimit },
    { id: "upper-spec-limit", value: upperSpecificationLimit },
    { id: "target", value: target },
    { id: "mean", value: mean },
    { id: "minus-3-sigma", value: mean - 3 * sampleStandardDeviation },
    { id: "plus-3-sigma", value: mean + 3 * sampleStandardDeviation },
    { id: "minus-4-sigma", value: mean - 4 * sampleStandardDeviation },
    { id: "plus-4-sigma", value: mean + 4 * sampleStandardDeviation },
  ];
  return {
    lowerSpecificationLimit,
    upperSpecificationLimit,
    target,
    mean,
    sampleStandardDeviation,
    specificationDecimalPlaces,
    lines,
  };
}

export function distributionFitObservedDomain(
  candidates: readonly DistributionFitPlotCandidate[],
  references?: DistributionFitReferences,
  assumption?: FactorSetupAssumption,
): DistributionFitObservedDomain {
  const canonicalObserved = candidates[0]!.qqPoints
    .map((point) => point.observed)
    .sort((left, right) => left - right);
  const allObserved = candidates.flatMap((candidate) => candidate.qqPoints.map((point) => point.observed));
  const domainValues = references
    ? [...allObserved, ...references.lines.map((line) => line.value).filter(Number.isFinite)]
    : allObserved;
  if (assumption) domainValues.push(...factorSetupSupport(assumption));
  return {
    minimum: Math.min(...domainValues),
    maximum: Math.max(...domainValues),
    binCount: histogramBinCount(canonicalObserved),
  };
}

export function buildDistributionFitPlot(
  candidate: DistributionFitPlotCandidate,
  observedDomain: DistributionFitObservedDomain = distributionFitObservedDomain([candidate]),
  assumption?: FactorSetupAssumption,
): DistributionFitPlotModel {
  const observed = candidate.qqPoints.map((point) => point.observed);
  const observedRange = observedDomain.maximum - observedDomain.minimum;
  const constantBounds = observedRange === 0 ? constantDomain(observedDomain.minimum) : undefined;
  const overflowBounds = !Number.isFinite(observedRange)
    ? [observedDomain.minimum / 2, observedDomain.maximum / 2] as const
    : undefined;
  const padding = observedRange > 0 && Number.isFinite(observedRange) ? observedRange * 0.08 : 0;
  const paddedMinimum = observedDomain.minimum - padding;
  const paddedMaximum = observedDomain.maximum + padding;
  const domainMinimum = constantBounds?.[0] ?? overflowBounds?.[0] ?? (Number.isFinite(paddedMinimum) ? paddedMinimum : observedDomain.minimum);
  const domainMaximum = constantBounds?.[1] ?? overflowBounds?.[1] ?? (Number.isFinite(paddedMaximum) ? paddedMaximum : observedDomain.maximum);
  const binCount = observedDomain.binCount;
  const observedMinimum = Math.min(...observed);
  const observedMaximum = Math.max(...observed);
  const candidateObservedRange = observedMaximum - observedMinimum;
  const histogramConstantBounds = candidateObservedRange === 0 ? constantDomain(observedMinimum) : undefined;
  const histogramOverflowBounds = !Number.isFinite(candidateObservedRange)
    ? [observedMinimum / 2, observedMaximum / 2] as const
    : undefined;
  const histogramMinimum = histogramConstantBounds?.[0] ?? histogramOverflowBounds?.[0] ?? observedMinimum;
  const histogramMaximum = histogramConstantBounds?.[1] ?? histogramOverflowBounds?.[1] ?? observedMaximum;
  const counts = Array.from({ length: binCount }, () => 0);
  for (const value of observed) {
    const index = Math.min(binCount - 1, Math.max(0, Math.floor(relativePosition(value, histogramMinimum, histogramMaximum) * binCount)));
    counts[index] = counts[index]! + 1;
  }
  const bins = counts.map((count, index) => {
    const minimum = interpolate(histogramMinimum, histogramMaximum, index / binCount);
    const maximum = interpolate(histogramMinimum, histogramMaximum, (index + 1) / binCount);
    return {
      minimum,
      maximum,
      frequency: count,
    };
  });
  const binWidth = (histogramMaximum - histogramMinimum) / binCount;
  const curve = Array.from({ length: 96 }, (_, index) => {
    const x = interpolate(domainMinimum, domainMaximum, index / 95);
    const expectedFrequency = probabilityDensity(candidate.family, candidate.parameters, x) * observed.length * binWidth;
    return { x, expectedFrequency: Number.isFinite(expectedFrequency) && expectedFrequency >= 0 ? expectedFrequency : 0 };
  });
  const assumptionCurve = assumption
    ? Array.from({ length: 96 }, (_, index) => {
        const x = interpolate(domainMinimum, domainMaximum, index / 95);
        const expectedFrequency = factorSetupDensity(assumption, x) * observed.length * binWidth;
        return { x, expectedFrequency: finiteDensity(expectedFrequency) };
      })
    : [];
  const rawMaximumFrequency = Math.max(
    ...bins.map((bin) => bin.frequency),
    ...curve.map((point) => point.expectedFrequency),
    ...assumptionCurve.map((point) => point.expectedFrequency),
    1,
  );
  const frequencyStep = Math.max(1, Math.ceil(rawMaximumFrequency / 4));
  const maximumFrequency = frequencyStep * 4;
  const ticks = Array.from({ length: 5 }, (_, index) => interpolate(domainMinimum, domainMaximum, index / 4));
  const frequencyTicks = Array.from({ length: 5 }, (_, index) => frequencyStep * index);
  return { domainMinimum, domainMaximum, maximumFrequency, bins, curve, assumptionCurve, ticks, frequencyTicks };
}