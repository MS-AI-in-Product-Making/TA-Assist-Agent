export type MeasurementShape =
  | "insufficient_data"
  | "approximately_symmetric"
  | "right_skewed"
  | "left_skewed"
  | "possibly_multimodal";

export interface MeasurementHistogramBin {
  readonly minimum: number;
  readonly maximum: number;
  readonly count: number;
}

export interface MeasurementDiagnostics {
  readonly sampleSize: number;
  readonly sampleSizeStatus: "acceptable" | "limited";
  readonly minimum: number | undefined;
  readonly maximum: number | undefined;
  readonly range: number | undefined;
  readonly missingCount: number;
  readonly mean: number | undefined;
  readonly sampleStandardDeviation: number | undefined;
  readonly threeSigmaOutlierIndexes: readonly number[];
  readonly iqrOutlierIndexes: readonly number[];
  readonly outlierIndexes: readonly number[];
  readonly skewness: number | undefined;
  readonly shape: MeasurementShape;
  readonly histogram: { readonly bins: readonly MeasurementHistogramBin[] };
}

function quantile(sorted: readonly number[], probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const fraction = position - lowerIndex;
  const lower = sorted[lowerIndex]!;
  const upper = sorted[Math.min(lowerIndex + 1, sorted.length - 1)]!;
  return lower + (upper - lower) * fraction;
}

function nearestRankQuantile(sorted: readonly number[], probability: number): number {
  const rank = Math.max(1, Math.ceil(sorted.length * probability));
  return sorted[rank - 1]!;
}

function histogram(sorted: readonly number[]): readonly MeasurementHistogramBin[] {
  if (sorted.length === 0) return [];
  const minimum = sorted[0]!;
  const maximum = sorted.at(-1)!;
  const binCount = Math.max(1, Math.min(12, Math.ceil(Math.log2(sorted.length) + 1)));
  if (minimum === maximum) return [{ minimum: minimum - 0.5, maximum: maximum + 0.5, count: sorted.length }];
  const width = (maximum - minimum) / binCount;
  const counts = Array.from({ length: binCount }, () => 0);
  for (const value of sorted) {
    const index = Math.min(binCount - 1, Math.floor((value - minimum) / width));
    counts[index] = counts[index]! + 1;
  }
  return counts.map((count, index) => ({
    minimum: minimum + index * width,
    maximum: index === binCount - 1 ? maximum : minimum + (index + 1) * width,
    count,
  }));
}

function possiblyMultimodal(sorted: readonly number[]): boolean {
  if (sorted.length < 8) return false;
  const gaps = sorted.slice(1).map((value, index) => value - sorted[index]!);
  const sortedGaps = [...gaps].sort((left, right) => left - right);
  const typicalGap = quantile(sortedGaps, 0.5);
  const largestGap = Math.max(...gaps);
  const splitIndex = gaps.indexOf(largestGap) + 1;
  return splitIndex >= 3
    && sorted.length - splitIndex >= 3
    && largestGap > Math.max(typicalGap * 4, (sorted.at(-1)! - sorted[0]!) * 0.2);
}

export function buildMeasurementDiagnostics(
  values: readonly number[],
  missingCount: number,
): MeasurementDiagnostics {
  const indexedValues = values
    .map((value, index) => ({ value, index }))
    .filter((entry) => Number.isFinite(entry.value));
  const finiteValues = indexedValues.map((entry) => entry.value);
  const sorted = [...finiteValues].sort((left, right) => left - right);
  const sampleSize = finiteValues.length;
  const minimum = sorted[0];
  const maximum = sorted.at(-1);
  const mean = sampleSize > 0 ? finiteValues.reduce((sum, value) => sum + value, 0) / sampleSize : undefined;
  const squaredDeviationSum = mean === undefined
    ? 0
    : finiteValues.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const sampleStandardDeviation = sampleSize > 1 ? Math.sqrt(squaredDeviationSum / (sampleSize - 1)) : undefined;
  const threeSigmaOutlierIndexes = mean === undefined || !sampleStandardDeviation || sampleStandardDeviation === 0
    ? []
    : indexedValues
        .filter((entry) => Math.abs(entry.value - mean) > 3 * sampleStandardDeviation)
        .map((entry) => entry.index);

  let iqrOutlierIndexes: number[] = [];
  if (sampleSize >= 4) {
    const q1 = nearestRankQuantile(sorted, 0.25);
    const q3 = nearestRankQuantile(sorted, 0.75);
    const iqr = q3 - q1;
    if (Number.isFinite(iqr)) {
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;
      iqrOutlierIndexes = indexedValues
        .filter((entry) => entry.value < lowerFence || entry.value > upperFence)
        .map((entry) => entry.index);
    }
  }

  const skewness = sampleSize > 2 && mean !== undefined && sampleStandardDeviation && sampleStandardDeviation > 0
    ? sampleSize / ((sampleSize - 1) * (sampleSize - 2))
      * finiteValues.reduce((sum, value) => sum + ((value - mean) / sampleStandardDeviation) ** 3, 0)
    : undefined;
  const shape: MeasurementShape = sampleSize < 8
    ? "insufficient_data"
    : possiblyMultimodal(sorted)
      ? "possibly_multimodal"
      : skewness !== undefined && skewness > 0.75
        ? "right_skewed"
        : skewness !== undefined && skewness < -0.75
          ? "left_skewed"
          : "approximately_symmetric";

  return {
    sampleSize,
    sampleSizeStatus: sampleSize >= 30 ? "acceptable" : "limited",
    minimum,
    maximum,
    range: minimum === undefined || maximum === undefined ? undefined : maximum - minimum,
    missingCount: Math.max(0, missingCount),
    mean,
    sampleStandardDeviation,
    threeSigmaOutlierIndexes,
    iqrOutlierIndexes,
    outlierIndexes: [...new Set([...threeSigmaOutlierIndexes, ...iqrOutlierIndexes])].sort((left, right) => left - right),
    skewness,
    shape,
    histogram: { bins: histogram(sorted) },
  };
}