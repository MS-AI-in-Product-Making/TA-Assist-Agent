export type F7CapabilityResult =
  | {
      readonly status: "ready";
      readonly sampleSize: number;
      readonly mean: number;
      readonly sampleStandardDeviation: number;
      readonly cp: number;
      readonly cpk: number;
    }
  | {
      readonly status: "insufficient_data" | "zero_variation" | "invalid_calculation";
      readonly sampleSize: number;
    };

export function calculateF7Capability(
  values: readonly number[],
  lowerSpecLimit: number,
  upperSpecLimit: number,
  governedStandardDeviation?: number,
): F7CapabilityResult {
  if (!Number.isFinite(lowerSpecLimit) || !Number.isFinite(upperSpecLimit)) {
    throw new RangeError("Specification limits must be finite.");
  }
  if (
    governedStandardDeviation !== undefined
    && (!Number.isFinite(governedStandardDeviation) || governedStandardDeviation <= 0)
  ) {
    throw new RangeError("Governed standard deviation must be finite and greater than zero.");
  }

  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length < 2) {
    return { status: "insufficient_data", sampleSize: finiteValues.length };
  }

  const mean = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
  const squaredDeviationSum = finiteValues.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const sampleStandardDeviation = governedStandardDeviation
    ?? Math.sqrt(squaredDeviationSum / (finiteValues.length - 1));
  if (sampleStandardDeviation === 0) {
    return { status: "zero_variation", sampleSize: finiteValues.length };
  }
  if (!Number.isFinite(mean) || !Number.isFinite(sampleStandardDeviation)) {
    return { status: "invalid_calculation", sampleSize: finiteValues.length };
  }

  const cp = (upperSpecLimit - lowerSpecLimit) / (6 * sampleStandardDeviation);
  const cpu = (upperSpecLimit - mean) / (3 * sampleStandardDeviation);
  const cpl = (mean - lowerSpecLimit) / (3 * sampleStandardDeviation);
  const cpk = Math.min(cpu, cpl);
  if (![cp, cpk].every(Number.isFinite)) {
    return { status: "invalid_calculation", sampleSize: finiteValues.length };
  }

  return {
    status: "ready",
    sampleSize: finiteValues.length,
    mean,
    sampleStandardDeviation,
    cp,
    cpk,
  };
}