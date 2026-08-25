import { describe, expect, it } from "vitest";
import { buildMonteCarloPlot } from "./monte-carlo-plot";

describe("Monte Carlo plot", () => {
  it("builds finite bars, a fitted path, and governed reference lines", () => {
    const model = buildMonteCarloPlot({
      bins: [
        { minimum: -0.2, maximum: -0.1, observedCount: 10 },
        { minimum: -0.1, maximum: 0, observedCount: 25 },
        { minimum: 0, maximum: 0.1, observedCount: 15 },
      ],
      expectedBinCounts: [8, 27, 15],
      lowerSpecLimit: -0.15,
      upperSpecLimit: 0.05,
      mean: -0.02,
      standardDeviation: 0.04,
      targetSigmaLevel: 3,
    });

    expect(model.domainMinimum).toBeLessThanOrEqual(-0.2);
    expect(model.domainMaximum).toBeGreaterThanOrEqual(0.1);
    expect(model.bars).toHaveLength(3);
    expect(model.bars.flatMap((bar) => [bar.x, bar.y, bar.width, bar.height]).every(Number.isFinite)).toBe(true);
    expect(model.xTicks).toHaveLength(5);
    expect(model.yTicks).toHaveLength(5);
    expect(model.curvePath.startsWith("M")).toBe(true);
    expect(model.references.map(({ id }) => id)).toEqual([
      "lower-spec-limit",
      "upper-spec-limit",
      "mean",
      "minus-target-sigma",
      "plus-target-sigma",
    ]);
    const nearbyRows = model.references
      .filter((reference) => Math.abs(reference.x - model.references[2]!.x) < 52)
      .map((reference) => reference.labelRow);
    expect(new Set(nearbyRows).size).toBe(nearbyRows.length);
  });

  it("keeps geometry finite when finite input arithmetic would overflow", () => {
    const model = buildMonteCarloPlot({
      bins: [
        { minimum: -Number.MAX_VALUE, maximum: 0, observedCount: 1 },
        { minimum: 0, maximum: Number.MAX_VALUE, observedCount: 1 },
      ],
      expectedBinCounts: [1, 1],
      lowerSpecLimit: -Number.MAX_VALUE,
      upperSpecLimit: Number.MAX_VALUE,
      mean: Number.MAX_VALUE / 2,
      standardDeviation: Number.MAX_VALUE,
      targetSigmaLevel: 4,
    });

    const geometry = [
      model.domainMinimum,
      model.domainMaximum,
      model.maximumCount,
      ...model.xTicks,
      ...model.yTicks,
      ...model.bars.flatMap((bar) => [bar.x, bar.y, bar.width, bar.height]),
      ...model.references.flatMap((reference) => [reference.value, reference.x, reference.labelRow]),
    ];
    expect(geometry.every(Number.isFinite)).toBe(true);
    expect(model.curvePath).not.toContain("NaN");
    expect(model.curvePath).not.toContain("Infinity");
  });

  it("keeps geometry finite for an equal maximum-value domain and maximum counts", () => {
    const model = buildMonteCarloPlot({
      bins: [{ minimum: Number.MAX_VALUE, maximum: Number.MAX_VALUE, observedCount: Number.MAX_VALUE }],
      expectedBinCounts: [Number.MAX_VALUE],
      lowerSpecLimit: Number.MAX_VALUE,
      upperSpecLimit: Number.MAX_VALUE,
      mean: Number.MAX_VALUE,
      standardDeviation: 0,
      targetSigmaLevel: 4,
    });

    const geometry = [
      model.domainMinimum,
      model.domainMaximum,
      ...model.xTicks,
      ...model.yTicks,
      ...model.bars.flatMap((bar) => [bar.x, bar.y, bar.width, bar.height]),
      ...model.references.flatMap((reference) => [reference.value, reference.x, reference.labelRow]),
    ];
    expect(geometry.every(Number.isFinite)).toBe(true);
    expect(model.curvePath).not.toContain("NaN");
    expect(model.curvePath).not.toContain("Infinity");
  });
});