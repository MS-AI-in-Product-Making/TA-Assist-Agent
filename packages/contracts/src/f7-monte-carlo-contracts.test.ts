import { describe, expect, it } from "vitest";
import {
  f7DistributionApprovalSchema,
  f7MonteCarloResultSchema,
  f7MonteCarloRunRouteRequestSchema,
} from "./f7-contracts.js";

const FACTOR_ID = "a".repeat(64);
const RUN_SEED = "b".repeat(64);

const createHistogramBins = (count: number) => Array.from({ length: count }, (_, index) => ({
  minimum: index,
  maximum: index + 1,
  observedCount: index === 0 ? 10_000 : 0,
}));

const createAvailableCapability = (values: {
  mean: number;
  standardDeviation: number;
  lowerSpecLimit: number;
  upperSpecLimit: number;
  targetSigmaLevel: number;
}) => {
  const cp = (values.upperSpecLimit - values.lowerSpecLimit) / (6 * values.standardDeviation);
  const lowerCpk = (values.mean - values.lowerSpecLimit) / (3 * values.standardDeviation);
  const upperCpk = (values.upperSpecLimit - values.mean) / (3 * values.standardDeviation);
  const cpk = Math.min(lowerCpk, upperCpk);
  const targetCpk = values.targetSigmaLevel / 3;
  return {
    status: "available" as const,
    cp,
    lowerCpk,
    upperCpk,
    cpk,
    targetCpk,
    targetStatus: cpk >= targetCpk ? "meets_target" as const : "below_target" as const,
  };
};

describe("F7 Monte Carlo contracts", () => {
  it("requires explicit distribution approval", () => {
    const approval = {
      factorId: FACTOR_ID,
      family: "normal",
      confirmed: true,
      approvedAt: "2026-08-25T08:00:00.000Z",
    } as const;

    expect(f7DistributionApprovalSchema.parse(approval)).toEqual(approval);
    expect(f7DistributionApprovalSchema.safeParse({ ...approval, confirmed: false }).success).toBe(false);
    expect(f7DistributionApprovalSchema.safeParse({ ...approval, extra: true }).success).toBe(false);
  });

  it("governs system specifications and reproducible run settings", () => {
    const request = {
      body: {
        sessionId: "session-1",
        lowerSpecLimit: -0.5,
        upperSpecLimit: 0.5,
        targetSigmaLevel: 6,
        iterations: 100_000,
        runSeed: RUN_SEED,
        correlationMode: "INDEPENDENT",
      },
    } as const;

    expect(f7MonteCarloRunRouteRequestSchema.parse(request)).toEqual(request);
    expect(f7MonteCarloRunRouteRequestSchema.safeParse({
      body: { ...request.body, lowerSpecLimit: 0.5, upperSpecLimit: -0.5 },
    }).success).toBe(false);
    expect(f7MonteCarloRunRouteRequestSchema.safeParse({
      body: { ...request.body, targetSigmaLevel: 0 },
    }).success).toBe(false);
    const missingTargetSigmaLevel = { ...request.body };
    delete (missingTargetSigmaLevel as { targetSigmaLevel?: number }).targetSigmaLevel;
    expect(f7MonteCarloRunRouteRequestSchema.safeParse({ body: missingTargetSigmaLevel }).success).toBe(false);
  });

  const resultMean = 0;
  const resultStandardDeviation = 0.1;
  const resultLowerSpecLimit = -0.5;
  const resultUpperSpecLimit = 0.5;
  const resultTargetSigmaLevel = 6;
  const resultHistogramBins = createHistogramBins(20);
  const result = {
    methodId: "F7_MONTE_CARLO_V1",
    status: "complete",
    lowerSpecLimit: resultLowerSpecLimit,
    upperSpecLimit: resultUpperSpecLimit,
    targetSigmaLevel: resultTargetSigmaLevel,
    iterations: 10_000,
    runSeed: RUN_SEED,
    correlationMode: "INDEPENDENT",
    mean: resultMean,
    standardDeviation: resultStandardDeviation,
    quantiles: {
      p00135: -0.3,
      p01: -0.23,
      p05: -0.16,
      p50: 0,
      p95: 0.16,
      p99: 0.23,
      p99865: 0.3,
    },
    inSpecCount: 9_997,
    outOfSpecCount: 3,
    yield: 0.9997,
    outOfSpecProbability: 0.0003,
    ppm: 300,
    histogram: {
      methodId: "F7_HISTOGRAM_FD_V1",
      bins: resultHistogramBins,
    },
    normalFit: {
      methodId: "F7_NORMAL_MOMENT_FIT_V1",
      mean: resultMean,
      standardDeviation: resultStandardDeviation,
      expectedBinCounts: resultHistogramBins.map((bin) => bin.observedCount),
    },
    capability: createAvailableCapability({
      mean: resultMean,
      standardDeviation: resultStandardDeviation,
      lowerSpecLimit: resultLowerSpecLimit,
      upperSpecLimit: resultUpperSpecLimit,
      targetSigmaLevel: resultTargetSigmaLevel,
    }),
    normalModel: {
      status: "available",
      lowerTailDpm: 100,
      upperTailDpm: 200,
      totalDpm: 300,
      expectedYield: 0.9997,
    },
    factorManifest: [{ factorId: FACTOR_ID, family: "normal", sourceMode: "MEASURED" }],
  } as const;

  const withHistogramBinCount = (count: number) => {
    const bins = createHistogramBins(count);
    return {
      ...result,
      histogram: { ...result.histogram, bins },
      normalFit: { ...result.normalFit, expectedBinCounts: bins.map((bin) => bin.observedCount) },
    };
  };

  const zeroVarianceResult = {
    ...result,
    standardDeviation: 0,
    normalFit: { ...result.normalFit, standardDeviation: 0 },
    capability: { status: "not_available", reason: "zero_variance", targetCpk: 2 },
    normalModel: { status: "not_available", reason: "zero_variance" },
  } as const;

  it("requires governed Monte Carlo outputs, analysis summaries, and manifest", () => {

    expect(f7MonteCarloResultSchema.parse(result)).toEqual(result);
    expect(f7MonteCarloResultSchema.safeParse({ ...result, inSpecCount: 9_999 }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({ ...result, yield: 0.99 }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({ ...result, targetSigmaLevel: -1 }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({ ...result, extra: true }).success).toBe(false);
  });

  it("enforces strict finite, ordered, contiguous histogram bins that reconcile to iterations", () => {
    expect(f7MonteCarloResultSchema.safeParse(withHistogramBinCount(19)).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse(withHistogramBinCount(20)).success).toBe(true);
    expect(f7MonteCarloResultSchema.safeParse(withHistogramBinCount(60)).success).toBe(true);
    expect(f7MonteCarloResultSchema.safeParse(withHistogramBinCount(61)).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      histogram: {
        ...result.histogram,
        bins: result.histogram.bins.map((bin, index) => (
          index === 0 ? { ...bin, minimum: Number.NaN } : bin
        )),
      },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      histogram: {
        ...result.histogram,
        bins: result.histogram.bins.map((bin, index) => (
          index === 0 ? { ...bin, maximum: bin.minimum } : bin
        )),
      },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      histogram: {
        ...result.histogram,
        bins: result.histogram.bins.map((bin, index) => (
          index === 1 ? { ...bin, minimum: bin.minimum + 0.01 } : bin
        )),
      },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      histogram: {
        ...result.histogram,
        bins: result.histogram.bins.map((bin, index) => (
          index === 0 ? { ...bin, observedCount: -1 } : bin
        )),
      },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      histogram: {
        ...result.histogram,
        bins: result.histogram.bins.map((bin, index) => (
          index === 0 ? { ...bin, observedCount: 9_999.5 } : bin
        )),
      },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      histogram: {
        ...result.histogram,
        bins: result.histogram.bins.map((bin, index) => (
          index === 0 ? { ...bin, observedCount: 9_999 } : bin
        )),
      },
    }).success).toBe(false);
  });

  it("rejects unknown fields on the histogram", () => {
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      histogram: { ...result.histogram, extra: true },
    }).success).toBe(false);
  });

  it("rejects unknown fields on histogram bins", () => {
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      histogram: {
        ...result.histogram,
        bins: result.histogram.bins.map((bin, index) => (
          index === 0 ? { ...bin, extra: true } : bin
        )),
      },
    }).success).toBe(false);
  });

  it("enforces the normal moment fit shape and one expected count per bin", () => {
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalFit: { ...result.normalFit, methodId: "OTHER" },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalFit: { ...result.normalFit, mean: Number.POSITIVE_INFINITY },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalFit: { ...result.normalFit, standardDeviation: -0.1 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalFit: { ...result.normalFit, expectedBinCounts: result.normalFit.expectedBinCounts.slice(1) },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalFit: {
        ...result.normalFit,
        expectedBinCounts: result.normalFit.expectedBinCounts.map((count, index) => index === 0 ? -1 : count),
      },
    }).success).toBe(false);
  });

  it("requires normal fit moments to match the top-level result within scale tolerance", () => {
    const scaledMean = 1;
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      mean: scaledMean,
      normalFit: { ...result.normalFit, mean: scaledMean + Number.EPSILON * 16 },
      capability: createAvailableCapability({
        mean: scaledMean,
        standardDeviation: result.standardDeviation,
        lowerSpecLimit: result.lowerSpecLimit,
        upperSpecLimit: result.upperSpecLimit,
        targetSigmaLevel: result.targetSigmaLevel,
      }),
    }).success).toBe(true);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalFit: {
        ...result.normalFit,
        standardDeviation: result.standardDeviation
          + Number.EPSILON * result.standardDeviation * 16,
      },
    }).success).toBe(true);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalFit: { ...result.normalFit, mean: 99 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalFit: { ...result.normalFit, standardDeviation: 9 },
    }).success).toBe(false);
  });

  it("rejects unknown fields on the normal fit", () => {
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalFit: { ...result.normalFit, extra: true },
    }).success).toBe(false);
  });

  it("enforces capability variants and available capability invariants", () => {
    expect(f7MonteCarloResultSchema.safeParse(zeroVarianceResult).success).toBe(true);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: { status: "not_available", reason: "unknown", targetCpk: 2 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: { status: "not_available", reason: "zero_variance", targetCpk: 0 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: { ...result.capability, cp: Number.NaN },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: { ...result.capability, cp: -1 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: { ...result.capability, cpk: result.capability.cpk + 0.1 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: { ...result.capability, targetCpk: 1.9 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: { ...result.capability, extra: true },
    }).success).toBe(false);
  });

  it("requires available capability values to be derived from the top-level result", () => {
    for (const field of ["cp", "lowerCpk", "upperCpk", "cpk"] as const) {
      expect(f7MonteCarloResultSchema.safeParse({
        ...result,
        capability: { ...result.capability, [field]: result.capability[field] + 0.1 },
      }).success).toBe(false);
    }

    const mean = -1;
    const capability = createAvailableCapability({
      mean,
      standardDeviation: result.standardDeviation,
      lowerSpecLimit: result.lowerSpecLimit,
      upperSpecLimit: result.upperSpecLimit,
      targetSigmaLevel: result.targetSigmaLevel,
    });
    expect(capability.lowerCpk).toBeLessThan(0);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      mean,
      normalFit: { ...result.normalFit, mean },
      capability,
    }).success).toBe(true);
  });

  it("requires zero variance iff capability and normal model are unavailable", () => {
    expect(f7MonteCarloResultSchema.safeParse(zeroVarianceResult).success).toBe(true);
    expect(f7MonteCarloResultSchema.safeParse({
      ...zeroVarianceResult,
      capability: result.capability,
      normalModel: result.normalModel,
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: zeroVarianceResult.capability,
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalModel: zeroVarianceResult.normalModel,
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: zeroVarianceResult.capability,
      normalModel: zeroVarianceResult.normalModel,
    }).success).toBe(false);
  });

  it("requires unavailable capability targetCpk to match targetSigmaLevel divided by three", () => {
    expect(f7MonteCarloResultSchema.safeParse({
      ...zeroVarianceResult,
      capability: { status: "not_available", reason: "zero_variance", targetCpk: 1.9 },
    }).success).toBe(false);
  });

  it("uses scale tolerance for all directly derived numeric relationships", () => {
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: { ...result.capability, targetCpk: result.capability.targetCpk + 1e-13 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: { ...result.capability, cp: result.capability.cp + 1e-13 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      capability: { ...result.capability, cpk: result.capability.cpk + 1e-13 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalModel: { ...result.normalModel, totalDpm: result.normalModel.totalDpm + 1e-10 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalModel: { ...result.normalModel, expectedYield: result.normalModel.expectedYield + 1e-13 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      yield: result.yield + 1e-13,
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      ppm: result.ppm + 1e-7,
    }).success).toBe(false);
  });

  it("does not let a fixed absolute tolerance hide a wrong tiny target Cpk", () => {
    const targetSigmaLevel = 3e-15;
    const capability = createAvailableCapability({
      mean: result.mean,
      standardDeviation: result.standardDeviation,
      lowerSpecLimit: result.lowerSpecLimit,
      upperSpecLimit: result.upperSpecLimit,
      targetSigmaLevel,
    });
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      targetSigmaLevel,
      capability,
    }).success).toBe(true);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      targetSigmaLevel,
      capability: { ...capability, targetCpk: 9e-13 },
    }).success).toBe(false);
  });

  it("rejects a wrong target Cpk below the previous absolute tolerance floor", () => {
    const targetSigmaLevel = 3e-16;
    const capability = createAvailableCapability({
      mean: result.mean,
      standardDeviation: result.standardDeviation,
      lowerSpecLimit: result.lowerSpecLimit,
      upperSpecLimit: result.upperSpecLimit,
      targetSigmaLevel,
    });
    expect(capability.targetCpk).toBe(1e-16);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      targetSigmaLevel,
      capability: { ...capability, targetCpk: 5e-15 },
    }).success).toBe(false);
  });

  it("derives target status from the payload Cpk values inside the numeric tolerance", () => {
    const targetSigmaLevel = 3;
    const targetCpk = 1 + Number.EPSILON * 16;
    const capability = {
      status: "available" as const,
      cp: 1,
      lowerCpk: 1,
      upperCpk: 1,
      cpk: 1,
      targetCpk,
    };
    const boundaryResult = {
      ...result,
      lowerSpecLimit: -3,
      upperSpecLimit: 3,
      targetSigmaLevel,
      standardDeviation: 1,
      normalFit: { ...result.normalFit, standardDeviation: 1 },
    };

    expect(f7MonteCarloResultSchema.safeParse({
      ...boundaryResult,
      capability: { ...capability, targetStatus: "meets_target" },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...boundaryResult,
      capability: { ...capability, targetStatus: "below_target" },
    }).success).toBe(true);
  });

  it("rejects finite capability values when finite inputs derive non-finite expectations", () => {
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      lowerSpecLimit: -Number.MAX_VALUE,
      upperSpecLimit: Number.MAX_VALUE,
      standardDeviation: Number.MIN_VALUE,
      normalFit: { ...result.normalFit, standardDeviation: Number.MIN_VALUE },
      capability: {
        status: "available",
        cp: 1,
        lowerCpk: 1,
        upperCpk: 1,
        cpk: 1,
        targetCpk: result.targetSigmaLevel / 3,
        targetStatus: "meets_target",
      },
    }).success).toBe(false);
  });

  it("enforces normal model variants, bounds, and rate reconciliation", () => {
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalModel: { status: "not_available", reason: "zero_variance" },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalModel: { status: "not_available", reason: "unknown" },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalModel: { ...result.normalModel, lowerTailDpm: -1 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalModel: { ...result.normalModel, upperTailDpm: 1_000_001 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalModel: { ...result.normalModel, totalDpm: 300.01 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalModel: { ...result.normalModel, expectedYield: 0.99 },
    }).success).toBe(false);
    expect(f7MonteCarloResultSchema.safeParse({
      ...result,
      normalModel: { ...result.normalModel, extra: true },
    }).success).toBe(false);
  });
});