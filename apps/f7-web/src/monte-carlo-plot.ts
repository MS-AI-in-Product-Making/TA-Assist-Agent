export type MonteCarloReferenceId =
  | "lower-spec-limit"
  | "upper-spec-limit"
  | "target"
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
  readonly setup?: {
    readonly mean: number;
    readonly std: number;
    readonly iterations: number;
  };
}

export interface MonteCarloPlotModel {
  readonly domainMinimum: number;
  readonly domainMaximum: number;
  readonly maximumCount: number;
  readonly xTicks: readonly number[];
  readonly yTicks: readonly number[];
  readonly bars: readonly {
    x: number;
    y: number;
    width: number;
    height: number;
    specificationStatus: "in-spec" | "out-of-spec" | "mixed";
  }[];
  readonly curvePath: string;
  readonly setupExpectedBinCounts: readonly number[];
  readonly setupCurvePath: string;
  readonly setupMeanReference?: { readonly value: number; readonly x: number; readonly labelRow: number };
  readonly references: readonly { id: MonteCarloReferenceId; value: number; x: number; labelRow: number }[];
}

const width = 800;
const height = 320;
const margin = { top: 82, right: 20, bottom: 42, left: 56 } as const;
type SetupInput = NonNullable<MonteCarloPlotInput["setup"]>;

function isValidSetup(setup: MonteCarloPlotInput["setup"]): setup is SetupInput {
  return setup !== undefined
    && Number.isFinite(setup.mean)
    && Number.isFinite(setup.std)
    && setup.std > 0
    && Number.isFinite(setup.iterations)
    && setup.iterations >= 0;
}

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

function finiteDifference(left: number, right: number): number {
  const difference = left - right;
  if (Number.isFinite(difference)) return difference;
  return left / 2 - right / 2;
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

function standardNormalIntervalProbability(lower: number, upper: number): number {
  const probability = lower > 0
    ? standardNormalCdf(-lower) - standardNormalCdf(-upper)
    : standardNormalCdf(upper) - standardNormalCdf(lower);
  return Math.min(1, Math.max(0, probability));
}

function setupExpectedBinCounts(input: MonteCarloPlotInput): number[] {
  const setup = input.setup;
  if (!isValidSetup(setup)) return [];
  return input.bins.map((bin) => {
    const lower = finiteDifference(bin.minimum, setup.mean) / setup.std;
    const upper = finiteDifference(bin.maximum, setup.mean) / setup.std;
    return finiteProduct(standardNormalIntervalProbability(lower, upper), setup.iterations);
  });
}

function representativeBinWidth(input: MonteCarloPlotInput): number {
  const widths = input.bins
    .map((bin) => finiteDifference(bin.maximum, bin.minimum))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  return widths[Math.floor(widths.length / 2)] ?? 1;
}

function setupCurveSamples(
  input: MonteCarloPlotInput,
  domainMinimum: number,
  domainMaximum: number,
): readonly { readonly value: number; readonly expectedCount: number }[] {
  const setup = input.setup;
  if (!isValidSetup(setup)) return [];
  const binWidth = representativeBinWidth(input);
  const domainRange = finiteDifference(domainMaximum, domainMinimum);
  const rawIntervalCount = Math.ceil(domainRange / binWidth);
  const intervalCount = Number.isFinite(rawIntervalCount)
    ? Math.min(240, Math.max(12, rawIntervalCount))
    : 240;
  const values = Array.from({ length: intervalCount + 1 }, (_, index) => (
    domainMinimum * (1 - index / intervalCount) + domainMaximum * (index / intervalCount)
  ));
  if (!values.includes(setup.mean)) {
    const nearestInteriorIndex = values
      .slice(1, -1)
      .reduce((nearestIndex, value, index) => (
        Math.abs(value - setup.mean) < Math.abs(values[nearestIndex]! - setup.mean)
          ? index + 1
          : nearestIndex
      ), 1);
    values[nearestInteriorIndex] = setup.mean;
  }
  const uniqueValues = [...new Set(values)].sort((left, right) => left - right);
  return uniqueValues.map((value) => {
    const halfWidth = binWidth / 2;
    const lower = finiteDifference(value, halfWidth);
    const upper = finiteSum(value, halfWidth);
    const lowerZ = finiteDifference(lower, setup.mean) / setup.std;
    const upperZ = finiteDifference(upper, setup.mean) / setup.std;
    return {
      value,
      expectedCount: finiteProduct(
        standardNormalIntervalProbability(lowerZ, upperZ),
        setup.iterations,
      ),
    };
  });
}

export function buildMonteCarloPlot(input: MonteCarloPlotInput): MonteCarloPlotModel {
  const setup = isValidSetup(input.setup) ? input.setup : undefined;
  const targetDistance = finiteProduct(input.targetSigmaLevel, input.standardDeviation);
  const target = input.lowerSpecLimit / 2 + input.upperSpecLimit / 2;
  const references = [
    { id: "lower-spec-limit" as const, value: input.lowerSpecLimit },
    { id: "upper-spec-limit" as const, value: input.upperSpecLimit },
    { id: "target" as const, value: target },
    { id: "mean" as const, value: input.mean },
    { id: "minus-target-sigma" as const, value: finiteSum(input.mean, -targetDistance) },
    { id: "plus-target-sigma" as const, value: finiteSum(input.mean, targetDistance) },
  ];
  const setupCounts = setupExpectedBinCounts(input);
  const setupDistance = setup === undefined ? undefined : finiteProduct(6, setup.std);
  const domainValues = [
    ...input.bins.flatMap((bin) => [bin.minimum, bin.maximum]),
    ...references.map((reference) => reference.value),
    ...(setup === undefined || setupDistance === undefined
      ? []
      : [finiteSum(setup.mean, -setupDistance), finiteSum(setup.mean, setupDistance)]),
  ];
  const rawMinimum = Math.min(...domainValues);
  const rawMaximum = Math.max(...domainValues);
  const expandedMinimum = rawMinimum - 0.5;
  const expandedMaximum = rawMaximum + 0.5;
  const domainMinimum = rawMinimum === rawMaximum && expandedMinimum !== rawMinimum ? expandedMinimum : rawMinimum;
  const domainMaximum = rawMinimum === rawMaximum && expandedMaximum !== rawMaximum ? expandedMaximum : rawMaximum;
  const setupSamples = setupCurveSamples(input, domainMinimum, domainMaximum);
  const maximumCount = Math.max(
    1,
    ...input.bins.map((bin) => bin.observedCount),
    ...input.expectedBinCounts,
    ...setupCounts,
    ...setupSamples.map(({ expectedCount }) => expectedCount),
  );
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const scaledRange = domainMaximum / 2 - domainMinimum / 2;
  const x = (value: number): number => scaledRange > 0
    ? margin.left + ((value / 2 - domainMinimum / 2) / scaledRange) * plotWidth
    : margin.left + plotWidth / 2;
  const y = (count: number): number => margin.top + finiteDifference(maximumCount, count) / maximumCount * plotHeight;

  const bars = input.bins.map((bin) => {
    const specificationStatus = bin.maximum < input.lowerSpecLimit || bin.minimum > input.upperSpecLimit
      ? "out-of-spec" as const
      : bin.minimum >= input.lowerSpecLimit && bin.maximum <= input.upperSpecLimit
        ? "in-spec" as const
        : "mixed" as const;
    return {
      x: x(bin.minimum),
      y: y(bin.observedCount),
      width: Math.max(1, x(bin.maximum) - x(bin.minimum) - 1),
      height: height - margin.bottom - y(bin.observedCount),
      specificationStatus,
    };
  });
  const curvePath = input.bins.map((bin, index) => {
    const midpoint = bin.minimum / 2 + bin.maximum / 2;
    return `${index === 0 ? "M" : "L"}${x(midpoint).toFixed(2)},${y(input.expectedBinCounts[index] ?? 0).toFixed(2)}`;
  }).join(" ");
  const setupCurvePath = setupSamples.map((sample, index) => {
    return `${index === 0 ? "M" : "L"}${x(sample.value).toFixed(2)},${y(sample.expectedCount).toFixed(2)}`;
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
  const setupMeanX = setup === undefined ? undefined : x(setup.mean);
  const setupMeanLabelRow = setupMeanX === undefined
    ? -1
    : rowLastX.findIndex((lastX) => setupMeanX - lastX >= 52);
  const interpolateDomain = (fraction: number): number => domainMinimum * (1 - fraction) + domainMaximum * fraction;

  return {
    domainMinimum,
    domainMaximum,
    maximumCount,
    xTicks: Array.from({ length: 5 }, (_, index) => interpolateDomain(index / 4)),
    yTicks: Array.from({ length: 5 }, (_, index) => maximumCount * (index / 4)),
    bars,
    curvePath,
    setupExpectedBinCounts: setupCounts,
    setupCurvePath: setup === undefined ? "" : setupCurvePath,
    ...(setup === undefined || setupMeanX === undefined ? {} : {
      setupMeanReference: {
        value: setup.mean,
        x: setupMeanX,
        labelRow: setupMeanLabelRow < 0 ? rowLastX.length : setupMeanLabelRow,
      },
    }),
    references: references.map((reference) => ({
      ...reference,
      x: x(reference.value),
      labelRow: labelRows.get(reference.id) ?? 0,
    })),
  };
}