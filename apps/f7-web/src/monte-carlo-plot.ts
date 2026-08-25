export type MonteCarloReferenceId =
  | "lower-spec-limit"
  | "upper-spec-limit"
  | "mean"
  | "minus-target-sigma"
  | "plus-target-sigma";

export interface MonteCarloPlotInput {
  readonly bins: readonly {
    readonly minimum: number;
    readonly maximum: number;
    readonly observedCount: number;
  }[];
  readonly expectedBinCounts: readonly number[];
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
  readonly mean: number;
  readonly standardDeviation: number;
  readonly targetSigmaLevel: number;
}

export interface MonteCarloPlotModel {
  readonly domainMinimum: number;
  readonly domainMaximum: number;
  readonly maximumCount: number;
  readonly xTicks: readonly number[];
  readonly yTicks: readonly number[];
  readonly bars: readonly { x: number; y: number; width: number; height: number }[];
  readonly curvePath: string;
  readonly references: readonly { id: MonteCarloReferenceId; value: number; x: number; labelRow: number }[];
}

const width = 800;
const height = 320;
const margin = { top: 72, right: 20, bottom: 42, left: 56 } as const;

function finiteProduct(left: number, right: number): number {
  const product = left * right;
  if (Number.isFinite(product)) return product;
  return Math.sign(left) * Math.sign(right) * Number.MAX_VALUE;
}

function finiteSum(left: number, right: number): number {
  const sum = left + right;
  if (Number.isFinite(sum)) return sum;
  return Math.sign(left) === Math.sign(right) ? Math.sign(left) * Number.MAX_VALUE : left / 2 + right / 2;
}

export function buildMonteCarloPlot(input: MonteCarloPlotInput): MonteCarloPlotModel {
  const targetDistance = finiteProduct(input.targetSigmaLevel, input.standardDeviation);
  const references = [
    { id: "lower-spec-limit" as const, value: input.lowerSpecLimit },
    { id: "upper-spec-limit" as const, value: input.upperSpecLimit },
    { id: "mean" as const, value: input.mean },
    { id: "minus-target-sigma" as const, value: finiteSum(input.mean, -targetDistance) },
    { id: "plus-target-sigma" as const, value: finiteSum(input.mean, targetDistance) },
  ];
  const domainValues = [
    ...input.bins.flatMap((bin) => [bin.minimum, bin.maximum]),
    ...references.map((reference) => reference.value),
  ];
  const rawMinimum = Math.min(...domainValues);
  const rawMaximum = Math.max(...domainValues);
  const expandedMinimum = rawMinimum - 0.5;
  const expandedMaximum = rawMaximum + 0.5;
  const domainMinimum = rawMinimum === rawMaximum && expandedMinimum !== rawMinimum ? expandedMinimum : rawMinimum;
  const domainMaximum = rawMinimum === rawMaximum && expandedMaximum !== rawMaximum ? expandedMaximum : rawMaximum;
  const maximumCount = Math.max(1, ...input.bins.map((bin) => bin.observedCount), ...input.expectedBinCounts);
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const scaledRange = domainMaximum / 2 - domainMinimum / 2;
  const x = (value: number): number => scaledRange > 0
    ? margin.left + ((value / 2 - domainMinimum / 2) / scaledRange) * plotWidth
    : margin.left + plotWidth / 2;
  const y = (count: number): number => margin.top + (1 - count / maximumCount) * plotHeight;

  const bars = input.bins.map((bin) => ({
    x: x(bin.minimum),
    y: y(bin.observedCount),
    width: Math.max(1, x(bin.maximum) - x(bin.minimum) - 1),
    height: height - margin.bottom - y(bin.observedCount),
  }));
  const curvePath = input.bins.map((bin, index) => {
    const midpoint = bin.minimum / 2 + bin.maximum / 2;
    return `${index === 0 ? "M" : "L"}${x(midpoint).toFixed(2)},${y(input.expectedBinCounts[index] ?? 0).toFixed(2)}`;
  }).join(" ");
  const positionedReferences = references
    .map((reference) => ({ ...reference, x: x(reference.value) }))
    .sort((left, right) => left.x - right.x);
  const rowLastX: number[] = [];
  const labelRows = new Map<MonteCarloReferenceId, number>();
  for (const reference of positionedReferences) {
    let row = rowLastX.findIndex((lastX) => reference.x - lastX >= 52);
    if (row < 0) row = rowLastX.length;
    rowLastX[row] = reference.x;
    labelRows.set(reference.id, row);
  }
  const interpolateDomain = (fraction: number): number => domainMinimum * (1 - fraction) + domainMaximum * fraction;

  return {
    domainMinimum,
    domainMaximum,
    maximumCount,
    xTicks: Array.from({ length: 5 }, (_, index) => interpolateDomain(index / 4)),
    yTicks: Array.from({ length: 5 }, (_, index) => maximumCount * (index / 4)),
    bars,
    curvePath,
    references: references.map((reference) => ({
      ...reference,
      x: x(reference.value),
      labelRow: labelRows.get(reference.id) ?? 0,
    })),
  };
}