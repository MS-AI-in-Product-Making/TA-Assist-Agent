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
      readonly status: "insufficient_data" | "zero_variation";
      readonly sampleSize: number;
    };

export function calculateF7Capability(
  values: readonly number[],
  lowerSpecLimit: number,
  upperSpecLimit: number,
): F7CapabilityResult {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length < 2) {
    return { status: "insufficient_data", sampleSize: finiteValues.length };
  }

  const mean = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
  const squaredDeviationSum = finiteValues.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const sampleStandardDeviation = Math.sqrt(squaredDeviationSum / (finiteValues.length - 1));
  if (sampleStandardDeviation === 0) {
    return { status: "zero_variation", sampleSize: finiteValues.length };
  }

  const cp = (upperSpecLimit - lowerSpecLimit) / (6 * sampleStandardDeviation);
  const cpu = (upperSpecLimit - mean) / (3 * sampleStandardDeviation);
  const cpl = (mean - lowerSpecLimit) / (3 * sampleStandardDeviation);

  return {
    status: "ready",
    sampleSize: finiteValues.length,
    mean,
    sampleStandardDeviation,
    cp,
    cpk: Math.min(cpu, cpl),
  };
}