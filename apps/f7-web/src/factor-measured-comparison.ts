import type { F7MeasurementDataset } from "./api/f7-client";
import { calculateF7Capability } from "./f7-capability";
import { calculateRationalSubgroupStandardDeviation } from "./measurement-structure";

export interface FactorMeasuredComparisonInput {
  readonly mean: number;
  readonly tolerance: number;
  readonly oneSigma: number;
  readonly sigmaLevel: number;
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
  readonly dataset: {
    readonly structure: F7MeasurementDataset["structure"];
    readonly rationalSubgroupConfig?: F7MeasurementDataset["rationalSubgroupConfig"];
    readonly observations: readonly F7MeasurementDataset["observations"][number][];
  };
}

interface ComparisonMetric {
  readonly setup: number;
  readonly actual: number | undefined;
  readonly delta: number | undefined;
}

export interface FactorMeasuredComparison {
  readonly mean: {
    readonly setup: number;
    readonly actual: number;
    readonly delta: number;
  };
  readonly tolerance: ComparisonMetric;
  readonly oneSigma: ComparisonMetric;
  readonly cpk: ComparisonMetric;
}

function calculateFiniteMean(values: readonly number[]): number | undefined {
  const maxAbs = values.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  if (maxAbs === 0) return 0;

  const normalizedMean = values.reduce((sum, value) => sum + value / maxAbs, 0) / values.length;
  const mean = Math.max(-1, Math.min(1, normalizedMean)) * maxAbs;
  return Number.isFinite(mean) ? mean : undefined;
}

export function buildFactorMeasuredComparison(
  input: FactorMeasuredComparisonInput,
): FactorMeasuredComparison | undefined {
  const values = input.dataset.observations
    .filter((observation) => observation.disposition === "included" && Number.isFinite(observation.value))
    .toSorted((left, right) => left.originalRow - right.originalRow)
    .map((observation) => observation.value);
  if (values.length === 0) return undefined;

  const actualMean = calculateFiniteMean(values);
  if (actualMean === undefined) return undefined;

  const meanDelta = Math.abs(actualMean) - Math.abs(input.mean);
  if (!Number.isFinite(meanDelta)) return undefined;

  const setupCpk = input.sigmaLevel / 3;
  const unavailableComparison: FactorMeasuredComparison = {
    mean: {
      setup: input.mean,
      actual: actualMean,
      delta: meanDelta,
    },
    tolerance: { setup: input.tolerance, actual: undefined, delta: undefined },
    oneSigma: { setup: input.oneSigma, actual: undefined, delta: undefined },
    cpk: { setup: setupCpk, actual: undefined, delta: undefined },
  };

  let governedStandardDeviation: number | undefined;
  if (input.dataset.structure === "RATIONAL_SUBGROUP") {
    const config = input.dataset.rationalSubgroupConfig;
    if (!config) return unavailableComparison;
    try {
      governedStandardDeviation = calculateRationalSubgroupStandardDeviation(
        values,
        config.subgroupSize,
        config.estimator,
      );
    } catch (error) {
      if (error instanceof RangeError) return unavailableComparison;
      throw error;
    }
  }

  const capability = calculateF7Capability(
    values,
    input.lowerSpecLimit,
    input.upperSpecLimit,
    governedStandardDeviation,
  );
  if (capability.status !== "ready") return unavailableComparison;

  const actualStandardDeviation = capability.sampleStandardDeviation;
  const actualTolerance = 3 * actualStandardDeviation;
  const toleranceDelta = actualTolerance - input.tolerance;
  const oneSigmaDelta = actualStandardDeviation - input.oneSigma;
  const cpkDelta = capability.cpk - setupCpk;
  if (
    !Number.isFinite(actualStandardDeviation) ||
    !Number.isFinite(actualTolerance) ||
    !Number.isFinite(capability.cpk) ||
    !Number.isFinite(toleranceDelta) ||
    !Number.isFinite(oneSigmaDelta) ||
    !Number.isFinite(cpkDelta)
  ) {
    return unavailableComparison;
  }

  return {
    mean: unavailableComparison.mean,
    tolerance: {
      setup: input.tolerance,
      actual: actualTolerance,
      delta: toleranceDelta,
    },
    oneSigma: {
      setup: input.oneSigma,
      actual: actualStandardDeviation,
      delta: oneSigmaDelta,
    },
    cpk: {
      setup: setupCpk,
      actual: capability.cpk,
      delta: cpkDelta,
    },
  };
}
