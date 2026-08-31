import { describe, expect, it } from "vitest";
import { buildResponseDistributionPlot } from "./response-distribution-plot";

function parseCurvePath(curvePath: string): readonly { x: number; y: number }[] {
  return Array.from(
    curvePath.matchAll(/[ML](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g),
    ([, x, y]) => ({ x: Number(x), y: Number(y) }),
  );
}

function referenceX(
  model: NonNullable<ReturnType<typeof buildResponseDistributionPlot>>,
  id: "mean" | "minus-3-sigma" | "plus-3-sigma",
): number {
  return model.references.find((reference) => reference.id === id)!.x;
}

describe("response distribution plot", () => {
  it("builds the normalized curve, ticks, and governed references", () => {
    const model = buildResponseDistributionPlot({
      mean: -0.05,
      standardDeviation: 0.045,
      lowerSpecLimit: -0.15,
      upperSpecLimit: 0.05,
    });

    expect(model).toBeDefined();
    expect(model!.target).toBeCloseTo(-0.05, 12);
    expect(model!.references.map(({ id }) => id)).toEqual([
      "lower-spec-limit",
      "upper-spec-limit",
      "target",
      "mean",
      "minus-3-sigma",
      "plus-3-sigma",
      "minus-4-sigma",
      "plus-4-sigma",
      "minus-4-5-sigma",
      "plus-4-5-sigma",
      "minus-6-sigma",
      "plus-6-sigma",
    ]);
    expect(model!.references.find(({ id }) => id === "minus-4-sigma")?.value).toBeCloseTo(-0.23, 12);
    expect(model!.references.find(({ id }) => id === "plus-6-sigma")?.value).toBeCloseTo(0.22, 12);
    expect(model!.curvePath.startsWith("M")).toBe(true);
    expect(model!.curvePath.match(/[ML]/g)).toHaveLength(121);
    expect(model!.xTicks).toEqual([
      -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05,
      0, 0.05, 0.1, 0.15, 0.2, 0.25,
    ]);
    expect(model!.domain).toEqual({ minimum: -0.35, maximum: 0.25 });
  });

  it("keeps a visible peak when a specification makes the domain extremely wide", () => {
    const model = buildResponseDistributionPlot({
      mean: 0,
      standardDeviation: 1,
      lowerSpecLimit: -1_000_000,
      upperSpecLimit: 1,
    });

    expect(model).toBeDefined();
    const points = parseCurvePath(model!.curvePath);
    const peak = points.reduce((highest, point) => point.y < highest.y ? point : highest);
    expect(points).toHaveLength(121);
    expect(peak.y).toBeCloseTo(model!.plotBounds.top, 1);
    expect(peak.x).toBeCloseTo(referenceX(model!, "mean"), 1);
    expect(points.some((point) => point.y < model!.plotBounds.bottom - 1)).toBe(true);
  });

  it("aligns the sampled peak with the mean reference for large finite values", () => {
    const model = buildResponseDistributionPlot({
      mean: 1e308,
      standardDeviation: 1e292,
      lowerSpecLimit: 9.999999999999996e307,
      upperSpecLimit: 1.0000000000000004e308,
    });

    expect(model).toBeDefined();
    const peak = parseCurvePath(model!.curvePath)
      .reduce((highest, point) => point.y < highest.y ? point : highest);
    expect(peak.x).toBeCloseTo(referenceX(model!, "mean"), 1);
    expect(peak.y).toBeCloseTo(model!.plotBounds.top, 1);
  });

  it("returns only strictly increasing domains", () => {
    const model = buildResponseDistributionPlot({
      mean: 10,
      standardDeviation: 2,
      lowerSpecLimit: 5,
      upperSpecLimit: 12,
    });

    expect(model).toBeDefined();
    expect(model!.domain.maximum).toBeGreaterThan(model!.domain.minimum);
  });

  it("rejects inputs whose finite values cannot form an increasing domain", () => {
    expect(buildResponseDistributionPlot({
      mean: Number.MAX_VALUE,
      standardDeviation: Number.MIN_VALUE,
      lowerSpecLimit: Number.MAX_VALUE,
      upperSpecLimit: Number.MAX_VALUE,
    })).toBeUndefined();
  });

  it("rejects inverted specification limits", () => {
    expect(buildResponseDistributionPlot({
      mean: 0,
      standardDeviation: 1,
      lowerSpecLimit: 2,
      upperSpecLimit: -2,
    })).toBeUndefined();
  });

  it("samples a regular curve at its mean with symmetric lower tails", () => {
    const model = buildResponseDistributionPlot({
      mean: 10,
      standardDeviation: 2,
      lowerSpecLimit: 4,
      upperSpecLimit: 16,
    });

    expect(model).toBeDefined();
    const points = parseCurvePath(model!.curvePath);
    const peak = points.reduce((highest, point) => point.y < highest.y ? point : highest);
    expect(peak.x).toBeCloseTo(referenceX(model!, "mean"), 1);
    expect(peak.y).toBeCloseTo(model!.plotBounds.top, 1);
    expect(points[0]!.y).toBeCloseTo(points.at(-1)!.y, 1);
    expect(points[0]!.y).toBeGreaterThan(peak.y + 100);
    expect(referenceX(model!, "mean") - referenceX(model!, "minus-3-sigma"))
      .toBeCloseTo(referenceX(model!, "plus-3-sigma") - referenceX(model!, "mean"), 8);
  });

  it.each([
    { mean: Number.NaN, standardDeviation: 1, lowerSpecLimit: 0, upperSpecLimit: 1 },
    { mean: 0, standardDeviation: Number.POSITIVE_INFINITY, lowerSpecLimit: 0, upperSpecLimit: 1 },
    { mean: 0, standardDeviation: 1, lowerSpecLimit: Number.NEGATIVE_INFINITY, upperSpecLimit: 1 },
    { mean: 0, standardDeviation: 1, lowerSpecLimit: 0, upperSpecLimit: Number.NaN },
    { mean: 0, standardDeviation: 0, lowerSpecLimit: 0, upperSpecLimit: 1 },
    { mean: 0, standardDeviation: -1, lowerSpecLimit: 0, upperSpecLimit: 1 },
  ])("rejects invalid input %#", (input) => {
    expect(buildResponseDistributionPlot(input)).toBeUndefined();
  });

  it("keeps all geometry finite when finite input arithmetic would overflow", () => {
    const model = buildResponseDistributionPlot({
      mean: Number.MAX_VALUE / 2,
      standardDeviation: Number.MAX_VALUE,
      lowerSpecLimit: -Number.MAX_VALUE,
      upperSpecLimit: Number.MAX_VALUE,
    });

    expect(model).toBeDefined();
    const geometry = [
      model!.domain.minimum,
      model!.domain.maximum,
      model!.target,
      ...model!.xTicks,
      ...model!.references.flatMap((reference) => [reference.value, reference.x, reference.labelRow]),
      ...(model!.curvePath.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number) ?? []),
    ];
    expect(geometry.every(Number.isFinite)).toBe(true);
    expect(model!.curvePath).not.toContain("NaN");
    expect(model!.curvePath).not.toContain("Infinity");
  });
});