import { describe, expect, it } from "vitest";
import * as simulationModule from "./simulation.js";
import { runF7MonteCarlo } from "./simulation.js";

const FACTOR_A = "a".repeat(64);
const FACTOR_B = "b".repeat(64);
const RUN_SEED = "c".repeat(64);

const request = {
  lowerSpecLimit: -0.5,
  upperSpecLimit: 0.5,
  targetSigmaLevel: 6,
  iterations: 10_000 as const,
  runSeed: RUN_SEED,
  correlationMode: "INDEPENDENT" as const,
  factors: [
    {
      factorId: FACTOR_A,
      coefficient: -1 as const,
      sourceMode: "MEASURED" as const,
      family: "normal" as const,
      parameters: { mean: 0.2, standardDeviation: 0.04 },
    },
    {
      factorId: FACTOR_B,
      coefficient: 1 as const,
      sourceMode: "BASELINE_ASSUMPTION" as const,
      family: "normal" as const,
      parameters: { mean: 0.15, standardDeviation: 0.03 },
    },
  ],
};

const empiricalFields = (result: ReturnType<typeof runF7MonteCarlo>) => ({
  mean: result.mean,
  standardDeviation: result.standardDeviation,
  quantiles: result.quantiles,
  inSpecCount: result.inSpecCount,
  outOfSpecCount: result.outOfSpecCount,
  yield: result.yield,
  outOfSpecProbability: result.outOfSpecProbability,
  ppm: result.ppm,
});

interface SimulationTestInternals {
  readonly createHistogramBins: (sorted: readonly number[]) => readonly {
    readonly minimum: number;
    readonly maximum: number;
    readonly observedCount: number;
  }[];
  readonly expectedNormalBinCounts: (
    bins: readonly { readonly minimum: number; readonly maximum: number; readonly observedCount: number }[],
    sampleSize: number,
    mean: number,
    standardDeviation: number,
  ) => readonly number[];
}

function simulationTestInternals(): SimulationTestInternals {
  const internals = (simulationModule as typeof simulationModule & {
    readonly __simulationInternals?: SimulationTestInternals;
  }).__simulationInternals;
  expect(internals).toBeDefined();
  return internals!;
}

function referenceStandardNormalCdf(value: number): number {
  if (value === 0) return 0.5;
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * absolute);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-absolute * absolute);
  return 0.5 * (1 + sign * erf);
}

describe("runF7MonteCarlo", () => {
  it("is reproducible and reports governed aggregate outputs", () => {
    const first = runF7MonteCarlo(request);
    const second = runF7MonteCarlo(request);

    expect(second).toEqual(first);
    expect(first.inSpecCount + first.outOfSpecCount).toBe(10_000);
    expect(first.yield).toBe(first.inSpecCount / 10_000);
    expect(first.ppm).toBeCloseTo(first.outOfSpecProbability * 1_000_000, 8);
    expect(Object.values(first.quantiles)).toEqual([...Object.values(first.quantiles)].sort((a, b) => a - b));
    expect(first.factorManifest).toEqual([
      { factorId: FACTOR_A, family: "normal", sourceMode: "MEASURED" },
      { factorId: FACTOR_B, family: "normal", sourceMode: "BASELINE_ASSUMPTION" },
    ]);
    expect(empiricalFields(first)).toEqual({
      mean: -0.05068562276677794,
      standardDeviation: 0.050251750462061776,
      quantiles: {
        p00135: -0.20082371616658679,
        p01: -0.1688520734343414,
        p05: -0.13295875301692153,
        p50: -0.05072554220268516,
        p95: 0.0322069112835995,
        p99: 0.06428972231248985,
        p99865: 0.10163306061962658,
      },
      inSpecCount: 10_000,
      outOfSpecCount: 0,
      yield: 1,
      outOfSpecProbability: 0,
      ppm: 0,
    });
  });

  it("changes the simulated stream when the seed changes", () => {
    const first = runF7MonteCarlo(request);
    const second = runF7MonteCarlo({ ...request, runSeed: "d".repeat(64) });

    expect(second.quantiles).not.toEqual(first.quantiles);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "fails fast when target sigma level is not positive and finite: %s",
    (targetSigmaLevel) => {
      expect(() => runF7MonteCarlo({ ...request, targetSigmaLevel })).toThrow("Monte Carlo request is invalid.");
    },
  );

  it("rejects extreme finite specification limits before simulation", () => {
    expect(() => runF7MonteCarlo({
      ...request,
      lowerSpecLimit: -Number.MAX_VALUE,
      upperSpecLimit: Number.MAX_VALUE,
    })).toThrowError(new Error("Monte Carlo request is invalid."));
  });

  it("throws a governed error when simulated statistics become non-finite", () => {
    expect(() => runF7MonteCarlo({
      ...request,
      factors: [{
        factorId: FACTOR_A,
        coefficient: 1,
        sourceMode: "MEASURED",
        family: "normal",
        parameters: { mean: 0, standardDeviation: Number.MAX_VALUE },
      }],
    })).toThrowError(new Error("Monte Carlo derived statistics are not finite."));
  });

  it("builds a clamped Freedman-Diaconis histogram covering every observation", () => {
    const result = runF7MonteCarlo(request);
    const bins = result.histogram.bins;

    expect(result.histogram.methodId).toBe("F7_HISTOGRAM_FD_V1");
    expect(bins).toHaveLength(60);
    expect(bins[0]!.minimum).toBe(-0.2583321002282455);
    expect(bins.at(-1)!.maximum).toBe(0.1650369384920729);
    expect(bins.reduce((sum, bin) => sum + bin.observedCount, 0)).toBe(request.iterations);
    for (let index = 0; index < bins.length; index += 1) {
      const bin = bins[index]!;
      expect(Number.isFinite(bin.minimum)).toBe(true);
      expect(Number.isFinite(bin.maximum)).toBe(true);
      expect(bin.minimum).toBeLessThan(bin.maximum);
      if (index > 0) expect(bin.minimum).toBe(bins[index - 1]!.maximum);
    }
  });

  it("builds finite twenty-bin boundaries for finite samples spanning the numeric range", () => {
    const bins = simulationTestInternals().createHistogramBins([
      -Number.MAX_VALUE,
      0,
      Number.MAX_VALUE,
    ]);

    expect(bins).toHaveLength(20);
    expect(bins.reduce((sum, bin) => sum + bin.observedCount, 0)).toBe(3);
    bins.forEach((bin, index) => {
      expect(Number.isFinite(bin.minimum)).toBe(true);
      expect(Number.isFinite(bin.maximum)).toBe(true);
      expect(bin.minimum).toBeLessThan(bin.maximum);
      if (index > 0) expect(bin.minimum).toBe(bins[index - 1]!.maximum);
    });
    expect(bins[0]!.minimum).toBe(-Number.MAX_VALUE);
    expect(bins.at(-1)!.maximum).toBe(Number.MAX_VALUE);
  });

  it("uses the twenty-bin fallback when a non-constant sample has zero IQR", () => {
    const sample = Array.from({ length: 100 }, (_, index) => index === 99 ? 1 : 0);
    const bins = simulationTestInternals().createHistogramBins(sample);

    expect(bins).toHaveLength(20);
    expect(bins.reduce((sum, bin) => sum + bin.observedCount, 0)).toBe(sample.length);
  });

  it("derives normal-fit expected counts from each histogram interval", () => {
    const result = runF7MonteCarlo(request);

    expect(result.normalFit).toMatchObject({
      methodId: "F7_NORMAL_MOMENT_FIT_V1",
      mean: result.mean,
      standardDeviation: result.standardDeviation,
    });
    expect(result.normalFit.expectedBinCounts).toHaveLength(result.histogram.bins.length);
    result.histogram.bins.forEach((bin, index) => {
      const expected = request.iterations * (
        referenceStandardNormalCdf((bin.maximum - result.mean) / result.standardDeviation)
        - referenceStandardNormalCdf((bin.minimum - result.mean) / result.standardDeviation)
      );
      expect(result.normalFit.expectedBinCounts[index]).toBeCloseTo(expected, 2);
      expect(Number.isFinite(result.normalFit.expectedBinCounts[index]!)).toBe(true);
      expect(result.normalFit.expectedBinCounts[index]).toBeGreaterThanOrEqual(0);
    });
  });

  it("keeps a far-right normal interval expected count positive", () => {
    const expectedCounts = simulationTestInternals().expectedNormalBinCounts(
      [{ minimum: 10, maximum: 10.25, observedCount: 0 }],
      1_000_000,
      0,
      1,
    );

    expect(expectedCounts[0]).toBeGreaterThan(0);
    expect(Number.isFinite(expectedCounts[0]!)).toBe(true);
  });

  it("reports capability and known normal-model tail probabilities", () => {
    const moments = runF7MonteCarlo(request);
    const result = runF7MonteCarlo({
      ...request,
      lowerSpecLimit: moments.mean - moments.standardDeviation,
      upperSpecLimit: moments.mean + 2 * moments.standardDeviation,
    });
    const standardDeviation = result.standardDeviation;
    const lowerCpk = (result.mean - result.lowerSpecLimit) / (3 * standardDeviation);
    const upperCpk = (result.upperSpecLimit - result.mean) / (3 * standardDeviation);

    expect(result.capability).toEqual({
      status: "available",
      cp: (result.upperSpecLimit - result.lowerSpecLimit) / (6 * standardDeviation),
      lowerCpk,
      upperCpk,
      cpk: Math.min(lowerCpk, upperCpk),
      targetCpk: 2,
      targetStatus: "below_target",
    });
    expect(result.normalModel.status).toBe("available");
    if (result.normalModel.status === "available") {
      expect(result.normalModel.lowerTailDpm).toBeCloseTo(158_655.253931457, 0);
      expect(result.normalModel.upperTailDpm).toBeCloseTo(22_750.1319481792, 0);
      expect(result.normalModel.totalDpm).toBe(
        result.normalModel.lowerTailDpm + result.normalModel.upperTailDpm,
      );
      expect(result.normalModel.expectedYield).toBe(1 - result.normalModel.totalDpm / 1_000_000);
    }
  });

  it("keeps symmetric ten-sigma normal-model tails positive and relatively close", () => {
    const moments = runF7MonteCarlo(request);
    const result = runF7MonteCarlo({
      ...request,
      lowerSpecLimit: moments.mean - 10 * moments.standardDeviation,
      upperSpecLimit: moments.mean + 10 * moments.standardDeviation,
    });

    expect(result.normalModel.status).toBe("available");
    if (result.normalModel.status === "available") {
      expect(result.normalModel.lowerTailDpm).toBeGreaterThan(0);
      expect(result.normalModel.upperTailDpm).toBeGreaterThan(0);
      const relativeDifference = Math.abs(
        result.normalModel.lowerTailDpm - result.normalModel.upperTailDpm,
      ) / Math.max(result.normalModel.lowerTailDpm, result.normalModel.upperTailDpm);
      expect(relativeDifference).toBeLessThan(1e-10);
    }
  });

  it("uses deterministic finite bins and unavailable analysis for zero variance", () => {
    const constantValue = 2;
    const result = runF7MonteCarlo({
      ...request,
      factors: [{
        factorId: FACTOR_A,
        coefficient: 1,
        sourceMode: "MEASURED",
        family: "normal",
        parameters: { mean: constantValue, standardDeviation: 0 },
      }],
    });
    const populatedBins = result.histogram.bins.filter((bin) => bin.observedCount > 0);

    expect(result.standardDeviation).toBe(0);
    expect(result.histogram.bins).toHaveLength(60);
    expect(result.histogram.bins.reduce((sum, bin) => sum + bin.observedCount, 0)).toBe(
      request.iterations,
    );
    result.histogram.bins.forEach((bin, index) => {
      expect(Number.isFinite(bin.minimum)).toBe(true);
      expect(Number.isFinite(bin.maximum)).toBe(true);
      expect(bin.minimum).toBeLessThan(bin.maximum);
      if (index > 0) expect(bin.minimum).toBe(result.histogram.bins[index - 1]!.maximum);
    });
    expect(result.histogram.bins.some(
      (bin) => bin.minimum <= result.mean && result.mean <= bin.maximum,
    )).toBe(true);
    expect(populatedBins).toHaveLength(1);
    expect(populatedBins[0]!.observedCount).toBe(request.iterations);
    expect(populatedBins[0]!.minimum).toBeLessThanOrEqual(constantValue);
    expect(populatedBins[0]!.maximum).toBeGreaterThan(constantValue);
    expect(result.normalFit.standardDeviation).toBe(0);
    expect(result.normalFit.expectedBinCounts).toEqual(
      result.histogram.bins.map((bin) => bin === populatedBins[0] ? request.iterations : 0),
    );
    expect(result.capability).toEqual({
      status: "not_available",
      reason: "zero_variance",
      targetCpk: 2,
    });
    expect(result.normalModel).toEqual({ status: "not_available", reason: "zero_variance" });
  });

  it("changes only target capability fields when target sigma changes", () => {
    const baseline = runF7MonteCarlo(request);
    const raisedTarget = runF7MonteCarlo({ ...request, targetSigmaLevel: 12 });

    expect(empiricalFields(raisedTarget)).toEqual(empiricalFields(baseline));
    expect(raisedTarget.histogram).toEqual(baseline.histogram);
    expect(raisedTarget.normalFit).toEqual(baseline.normalFit);
    expect(raisedTarget.normalModel).toEqual(baseline.normalModel);
    expect(baseline.capability).toMatchObject({ targetCpk: 2, targetStatus: "meets_target" });
    expect(raisedTarget.capability).toMatchObject({ targetCpk: 4, targetStatus: "below_target" });
  });
});