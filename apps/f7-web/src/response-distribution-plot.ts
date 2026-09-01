export type ResponseDistributionReferenceId =
  | "lower-spec-limit"
  | "upper-spec-limit"
  | "target"
  | "mean"
  | "minus-3-sigma"
  | "plus-3-sigma"
  | "minus-4-sigma"
  | "plus-4-sigma"
  | "minus-4-5-sigma"
  | "plus-4-5-sigma"
  | "minus-6-sigma"
  | "plus-6-sigma";

export interface ResponseDistributionPlotInput {
  readonly mean: number;
  readonly standardDeviation: number;
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
}

export interface ResponseDistributionPlotModel {
  readonly width: 760;
  readonly height: 300;
  readonly plotBounds: {
    readonly left: 52;
    readonly right: 744;
    readonly top: 48;
    readonly bottom: 252;
  };
  readonly domain: {
    readonly minimum: number;
    readonly maximum: number;
  };
  readonly target: number;
  readonly xTicks: readonly number[];
  readonly curvePath: string;
  readonly references: readonly {
    readonly id: ResponseDistributionReferenceId;
    readonly value: number;
    readonly x: number;
    readonly labelRow: number;
  }[];
}

const width = 760;
const height = 300;
const plotBounds = { left: 52, right: 744, top: 48, bottom: 252 } as const;
const maximumFinite = Number.MAX_VALUE;

function saturatingProduct(left: number, right: number): number {
  const product = left * right;
  if (Number.isFinite(product)) return product;
  return Math.sign(left) * Math.sign(right) * maximumFinite;
}

function saturatingSum(left: number, right: number): number {
  const sum = left + right;
  if (Number.isFinite(sum)) return sum;
  return Math.sign(left) === Math.sign(right)
    ? Math.sign(left) * maximumFinite
    : left / 2 + right / 2;
}

function midpoint(left: number, right: number): number {
  return left / 2 + right / 2;
}

function relativePosition(value: number, minimum: number, maximum: number): number {
  const range = maximum - minimum;
  if (range > 0 && Number.isFinite(range)) return (value - minimum) / range;
  const scaledRange = maximum / 2 - minimum / 2;
  return scaledRange > 0 ? (value / 2 - minimum / 2) / scaledRange : 0.5;
}

function paddedDomain(minimum: number, maximum: number): readonly [number, number] {
  const scaledRange = maximum / 2 - minimum / 2;
  const padding = saturatingProduct(scaledRange, 0.1);
  const paddedMinimum = saturatingSum(minimum, -padding);
  const paddedMaximum = saturatingSum(maximum, padding);
  return [
    paddedMinimum < minimum ? paddedMinimum : minimum,
    paddedMaximum > maximum ? paddedMaximum : maximum,
  ];
}

function niceAxis(minimum: number, maximum: number): {
  readonly minimum: number;
  readonly maximum: number;
  readonly ticks: readonly number[];
} {
  const scaledRange = maximum / 2 - minimum / 2;
  const rawStep = scaledRange / 6;
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const normalizedStep = rawStep / magnitude;
  const multiplier = normalizedStep <= 1
    ? 1
    : normalizedStep <= 2
      ? 2
      : normalizedStep <= 2.5
        ? 2.5
        : normalizedStep <= 5
          ? 5
          : 10;
  const step = multiplier * magnitude;
  const startIndex = Math.floor(minimum / step);
  const endIndex = Math.ceil(maximum / step);
  const tickCount = endIndex - startIndex + 1;

  if (
    !Number.isFinite(step)
    || step <= 0
    || !Number.isFinite(startIndex)
    || !Number.isFinite(endIndex)
    || tickCount < 2
    || tickCount > 100
  ) {
    return {
      minimum,
      maximum,
      ticks: Array.from({ length: 7 }, (_, index) => (
        minimum * (1 - index / 6) + maximum * (index / 6)
      )),
    };
  }

  const ticks = Array.from({ length: tickCount }, (_, index) => (
    Number(((startIndex + index) * step).toPrecision(15))
  ));
  const axisMinimum = ticks[0]!;
  const axisMaximum = ticks.at(-1)!;
  if (
    !ticks.every(Number.isFinite)
    || axisMinimum > minimum
    || axisMaximum < maximum
    || !(axisMaximum > axisMinimum)
  ) {
    return {
      minimum,
      maximum,
      ticks: Array.from({ length: 7 }, (_, index) => (
        minimum * (1 - index / 6) + maximum * (index / 6)
      )),
    };
  }

  return { minimum: axisMinimum, maximum: axisMaximum, ticks };
}

export function buildResponseDistributionPlot(
  input: ResponseDistributionPlotInput,
): ResponseDistributionPlotModel | undefined {
  if (![input.mean, input.standardDeviation, input.lowerSpecLimit, input.upperSpecLimit].every(Number.isFinite)
    || input.standardDeviation <= 0
    || input.lowerSpecLimit > input.upperSpecLimit) {
    return undefined;
  }

  const sigmaDistance = (multiple: number): number => saturatingProduct(input.standardDeviation, multiple);
  const referenceValue = (multiple: number): number => saturatingSum(input.mean, sigmaDistance(multiple));
  const target = midpoint(input.lowerSpecLimit, input.upperSpecLimit);
  const referenceValues: readonly { id: ResponseDistributionReferenceId; value: number }[] = [
    { id: "lower-spec-limit", value: input.lowerSpecLimit },
    { id: "upper-spec-limit", value: input.upperSpecLimit },
    { id: "target", value: target },
    { id: "mean", value: input.mean },
    { id: "minus-3-sigma", value: referenceValue(-3) },
    { id: "plus-3-sigma", value: referenceValue(3) },
    { id: "minus-4-sigma", value: referenceValue(-4) },
    { id: "plus-4-sigma", value: referenceValue(4) },
    { id: "minus-4-5-sigma", value: referenceValue(-4.5) },
    { id: "plus-4-5-sigma", value: referenceValue(4.5) },
    { id: "minus-6-sigma", value: referenceValue(-6) },
    { id: "plus-6-sigma", value: referenceValue(6) },
  ];
  const rawMinimum = Math.min(...referenceValues.map(({ value }) => value));
  const rawMaximum = Math.max(...referenceValues.map(({ value }) => value));
  const [paddedMinimum, paddedMaximum] = paddedDomain(rawMinimum, rawMaximum);
  if (!(paddedMaximum > paddedMinimum)) return undefined;
  const axis = niceAxis(paddedMinimum, paddedMaximum);
  const domainMinimum = axis.minimum;
  const domainMaximum = axis.maximum;

  const plotWidth = plotBounds.right - plotBounds.left;
  const plotHeight = plotBounds.bottom - plotBounds.top;
  const x = (value: number): number => plotBounds.left
    + relativePosition(value, domainMinimum, domainMaximum) * plotWidth;

  const positionedReferences = referenceValues
    .map((reference) => ({ ...reference, x: x(reference.value) }))
    .sort((left, right) => left.x - right.x);
  const rowLastX: number[] = [];
  const labelRows = new Map<ResponseDistributionReferenceId, number>();
  for (const reference of positionedReferences) {
    let row = rowLastX.findIndex((lastX) => reference.x - lastX >= 52);
    if (row < 0) row = rowLastX.length;
    rowLastX[row] = reference.x;
    labelRows.set(reference.id, row);
  }

  const curvePoints = Array.from({ length: 121 }, (_, index) => {
    const z = -6 + index / 10;
    const value = saturatingSum(input.mean, sigmaDistance(z));
    const normalizedDensity = Math.exp(-(z ** 2) / 2);
    return {
      z,
      x: x(value),
      y: plotBounds.bottom - normalizedDensity * plotHeight,
    };
  }).sort((left, right) => left.x - right.x || left.z - right.z);
  const curvePath = curvePoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");

  return {
    width,
    height,
    plotBounds,
    domain: { minimum: domainMinimum, maximum: domainMaximum },
    target,
    xTicks: axis.ticks,
    curvePath,
    references: referenceValues.map((reference) => ({
      ...reference,
      x: x(reference.value),
      labelRow: labelRows.get(reference.id) ?? 0,
    })),
  };
}