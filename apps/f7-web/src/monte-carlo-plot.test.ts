import { describe, expect, it } from "vitest";
import { buildMonteCarloPlot } from "./monte-carlo-plot";

describe("Monte Carlo plot", () => {
  it("builds finite bars, a fitted path, and governed reference lines", () => {
    const model = buildMonteCarloPlot({
      bins: [
        { minimum: -0.2, maximum: -0.1, observedCount: 10 },
        { minimum: -0.1, maximum: 0, observedCount: 25 },
        { minimum: 0, maximum: 0.1, observedCount: 15 },
        { minimum: 0.1, maximum: 0.2, observedCount: 5 },
      ],
      expectedBinCounts: [8, 27, 15, 4],
      lowerSpecLimit: -0.15,
      upperSpecLimit: 0.05,
      mean: -0.02,
      standardDeviation: 0.04,
      targetSigmaLevel: 3,
    });

    expect(model.domainMinimum).toBeLessThanOrEqual(-0.2);
    expect(model.domainMaximum).toBeGreaterThanOrEqual(0.2);
    expect(model.bars).toHaveLength(4);
    expect(model.bars.flatMap((bar) => [bar.x, bar.y, bar.width, bar.height]).every(Number.isFinite)).toBe(true);
    expect(model.xTicks).toHaveLength(5);
    expect(model.yTicks).toHaveLength(5);
    expect(model.curvePath.startsWith("M")).toBe(true);
    expect(model.references.map(({ id }) => id)).toEqual([
      "lower-spec-limit",
      "upper-spec-limit",
      "target",
      "mean",
      "minus-target-sigma",
      "plus-target-sigma",
    ]);
    expect(model.references.find(({ id }) => id === "target")?.value).toBeCloseTo(-0.05, 12);
    expect(model.bars.map(({ specificationStatus }) => specificationStatus)).toEqual([
      "mixed",
      "in-spec",
      "mixed",
      "out-of-spec",
    ]);
    const nearbyRows = model.references
      .filter((reference) => Math.abs(reference.x - model.references[3]!.x) < 52)
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

  it("converts a setup Normal distribution to expected bin counts and plot geometry", () => {
    const model = buildMonteCarloPlot({
      bins: [
        { minimum: -1, maximum: 0, observedCount: 5 },
        { minimum: 0, maximum: 1, observedCount: 7 },
      ],
      expectedBinCounts: [4, 6],
      lowerSpecLimit: -1,
      upperSpecLimit: 1,
      mean: 0,
      standardDeviation: 0.2,
      targetSigmaLevel: 3,
      setup: { mean: 0, std: 1, iterations: 1_000 },
    });

    expect(model.setupExpectedBinCounts).toHaveLength(2);
    expect(model.setupExpectedBinCounts[0]).toBeCloseTo(341.3447, 3);
    expect(model.setupExpectedBinCounts[1]).toBeCloseTo(341.3447, 3);
    expect(model.setupCurvePath.startsWith("M")).toBe(true);
    expect(model.maximumCount).toBeCloseTo(382.9249, 3);
    expect(model.setupMeanReference).toEqual(expect.objectContaining({
      value: 0,
    }));
  });

  it("expands the shared domain through setup mean plus and minus six sigma", () => {
    const model = buildMonteCarloPlot({
      bins: [{ minimum: -1, maximum: 1, observedCount: 10 }],
      expectedBinCounts: [10],
      lowerSpecLimit: -1,
      upperSpecLimit: 1,
      mean: 0,
      standardDeviation: 0.2,
      targetSigmaLevel: 3,
      setup: { mean: 10, std: 2, iterations: 100 },
    });

    expect(model.domainMinimum).toBeLessThanOrEqual(-2);
    expect(model.domainMaximum).toBeGreaterThanOrEqual(22);
    expect(model.setupCurvePath.split("L")).toHaveLength(13);
    expect(model.maximumCount).toBeGreaterThan(10);
    expect(model.setupCurvePath).toContain(`${model.setupMeanReference!.x.toFixed(2)},72.00`);
  });

  it("keeps setup expected counts and geometry finite for extreme finite setup inputs", () => {
    const model = buildMonteCarloPlot({
      bins: [
        { minimum: -Number.MAX_VALUE, maximum: 0, observedCount: 1 },
        { minimum: 0, maximum: Number.MAX_VALUE, observedCount: 1 },
      ],
      expectedBinCounts: [1, 1],
      lowerSpecLimit: -Number.MAX_VALUE,
      upperSpecLimit: Number.MAX_VALUE,
      mean: 0,
      standardDeviation: 1,
      targetSigmaLevel: 3,
      setup: {
        mean: Number.MAX_VALUE / 2,
        std: Number.MAX_VALUE,
        iterations: Number.MAX_VALUE,
      },
    });

    const geometry = [
      model.domainMinimum,
      model.domainMaximum,
      model.maximumCount,
      ...model.setupExpectedBinCounts,
      ...model.xTicks,
      ...model.yTicks,
      ...model.bars.flatMap((bar) => [bar.x, bar.y, bar.width, bar.height]),
      ...model.references.flatMap((reference) => [reference.value, reference.x, reference.labelRow]),
      ...Object.values(model.setupMeanReference ?? {}),
    ];
    expect(geometry.every(Number.isFinite)).toBe(true);
    expect(model.setupCurvePath).not.toContain("NaN");
    expect(model.setupCurvePath).not.toContain("Infinity");
  });

  it("caps setup curve sampling at 240 intervals after including the setup mean", () => {
    const model = buildMonteCarloPlot({
      bins: [{ minimum: 0, maximum: 0.001, observedCount: 1 }],
      expectedBinCounts: [1],
      lowerSpecLimit: 0,
      upperSpecLimit: 1,
      mean: 0,
      standardDeviation: 0.1,
      targetSigmaLevel: 3,
      setup: { mean: 0.123_456, std: 1, iterations: 100 },
    });

    expect(model.setupCurvePath.split("L")).toHaveLength(241);
    expect(model.setupCurvePath).toContain(`${model.setupMeanReference!.x.toFixed(2)},`);
  });

  it("ignores an invalid zero-deviation setup overlay without corrupting base geometry", () => {
    const model = buildMonteCarloPlot({
      bins: [{ minimum: -1, maximum: 1, observedCount: 10 }],
      expectedBinCounts: [10],
      lowerSpecLimit: -1,
      upperSpecLimit: 1,
      mean: 0,
      standardDeviation: 0.2,
      targetSigmaLevel: 3,
      setup: { mean: 0, std: 0, iterations: 100 },
    });

    expect(model.setupExpectedBinCounts).toEqual([]);
    expect(model.setupCurvePath).toBe("");
    expect(model.setupMeanReference).toBeUndefined();
    expect([
      model.maximumCount,
      ...model.xTicks,
      ...model.yTicks,
      ...model.bars.flatMap((bar) => [bar.x, bar.y, bar.width, bar.height]),
    ].every(Number.isFinite)).toBe(true);
  });
});