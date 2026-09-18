import { describe, expect, it } from "vitest";
import type { F7MeasurementDataset } from "./api/f7-client";
import { buildFactorMeasuredComparison } from "./factor-measured-comparison";

const HASH = "a".repeat(64);

function dataset(
  observations: readonly F7MeasurementDataset["observations"][number][],
  options: Pick<F7MeasurementDataset, "structure" | "rationalSubgroupConfig"> = {
    structure: "UNORDERED_SAMPLE",
    rationalSubgroupConfig: undefined,
  },
): F7MeasurementDataset {
  return {
    factorId: HASH,
    unit: "mm",
    structure: options.structure,
    rationalSubgroupConfig: options.rationalSubgroupConfig,
    sourceReference: "comparison-test",
    importedAt: "2026-09-17T08:00:00.000Z",
    msaStatus: "unknown",
    observations: [...observations],
    missingRowCount: 0,
    rejectionSummaries: [],
    originalRowCount: observations.length,
    analyzedCount: observations.filter(({ disposition }) => disposition === "included").length,
    contentHash: HASH,
  };
}

const setup = {
  mean: -2,
  tolerance: 1,
  oneSigma: 0.25,
  sigmaLevel: 6,
  lowerSpecLimit: 0,
  upperSpecLimit: 3,
} as const;

describe("buildFactorMeasuredComparison", () => {
  it("compares Mean by absolute magnitude", () => {
    const result = buildFactorMeasuredComparison({
      ...setup,
      dataset: dataset([
        { originalRow: 1, value: 1, disposition: "included" },
        { originalRow: 2, value: 2, disposition: "included" },
      ]),
    });

    expect(result?.mean).toEqual({ setup: -2, actual: 1.5, delta: -0.5 });
  });

  it("projects actual ±3σ, Setup Cpk, Actual Cpk, and their deltas", () => {
    const result = buildFactorMeasuredComparison({
      ...setup,
      dataset: dataset([
        { originalRow: 1, value: 1, disposition: "included" },
        { originalRow: 2, value: 2, disposition: "included" },
      ]),
    });
    const actualSigma = Math.sqrt(0.5);
    const actualCpk = 1.5 / (3 * actualSigma);

    expect(result?.tolerance).toEqual({
      setup: 1,
      actual: 3 * actualSigma,
      delta: 3 * actualSigma - 1,
    });
    expect(result?.oneSigma).toEqual({
      setup: 0.25,
      actual: actualSigma,
      delta: actualSigma - 0.25,
    });
    expect(result?.cpk).toEqual({
      setup: 2,
      actual: actualCpk,
      delta: actualCpk - 2,
    });
  });

  it("uses included finite observations only", () => {
    const result = buildFactorMeasuredComparison({
      ...setup,
      dataset: dataset([
        { originalRow: 5, value: 3, disposition: "included" },
        {
          originalRow: 2,
          value: 100,
          disposition: "excluded",
          reason: "OUTLIER",
          operatorReference: "operator",
          confirmed: true,
        },
        { originalRow: 4, value: Number.NaN, disposition: "included" },
        { originalRow: 3, value: Number.POSITIVE_INFINITY, disposition: "included" },
        { originalRow: 1, value: 1, disposition: "included" },
      ]),
    });

    expect(result?.mean.actual).toBe(2);
    expect(result?.oneSigma.actual).toBeCloseTo(Math.sqrt(2), 12);
  });

  it("uses governed rational-subgroup sigma after ordering by originalRow", () => {
    const result = buildFactorMeasuredComparison({
      mean: 18,
      tolerance: 20,
      oneSigma: 1,
      sigmaLevel: 3,
      lowerSpecLimit: 0,
      upperSpecLimit: 40,
      dataset: dataset(
        [
          { originalRow: 4, value: 20, disposition: "included" },
          { originalRow: 1, value: 10, disposition: "included" },
          { originalRow: 6, value: 28, disposition: "included" },
          { originalRow: 3, value: 14, disposition: "included" },
          { originalRow: 5, value: 24, disposition: "included" },
          { originalRow: 2, value: 12, disposition: "included" },
        ],
        {
          structure: "RATIONAL_SUBGROUP",
          rationalSubgroupConfig: { subgroupSize: 3, estimator: "RANGE_D2" },
        },
      ),
    });
    const governedSigma = 6 / 1.693;

    expect(result?.oneSigma.actual).toBeCloseTo(governedSigma, 12);
    expect(result?.tolerance.actual).toBeCloseTo(3 * governedSigma, 12);
    expect(result?.cpk.actual).toBeCloseTo(18 / (3 * governedSigma), 12);
  });

  it("keeps Mean and Setup Cpk for one observation", () => {
    const result = buildFactorMeasuredComparison({
      ...setup,
      dataset: dataset([{ originalRow: 1, value: 1.25, disposition: "included" }]),
    });

    expect(result).toEqual({
      mean: { setup: -2, actual: 1.25, delta: -0.75 },
      tolerance: { setup: 1, actual: undefined, delta: undefined },
      oneSigma: { setup: 0.25, actual: undefined, delta: undefined },
      cpk: { setup: 2, actual: undefined, delta: undefined },
    });
  });

  it("keeps Mean and Setup Cpk for zero variation", () => {
    const result = buildFactorMeasuredComparison({
      ...setup,
      dataset: dataset([
        { originalRow: 1, value: 1.25, disposition: "included" },
        { originalRow: 2, value: 1.25, disposition: "included" },
      ]),
    });

    expect(result?.mean.actual).toBe(1.25);
    expect(result?.tolerance.actual).toBeUndefined();
    expect(result?.oneSigma.actual).toBeUndefined();
    expect(result?.cpk).toEqual({ setup: 2, actual: undefined, delta: undefined });
  });

  it("keeps only finite Mean outputs when extreme observations overflow capability metrics", () => {
    const observations = Object.freeze([
      Object.freeze({ originalRow: 1, value: Number.MAX_VALUE, disposition: "included" as const }),
      Object.freeze({ originalRow: 2, value: Number.MAX_VALUE, disposition: "included" as const }),
    ]);
    const inputDataset = Object.freeze(dataset(observations));

    const result = buildFactorMeasuredComparison({
      ...setup,
      dataset: inputDataset,
    });

    expect(result).toBeDefined();
    expect(Number.isFinite(result?.mean.actual)).toBe(true);
    expect(result?.mean.actual).toBe(Number.MAX_VALUE);
    expect(Number.isFinite(result?.mean.delta)).toBe(true);
    expect(result?.tolerance).toEqual({ setup: 1, actual: undefined, delta: undefined });
    expect(result?.oneSigma).toEqual({ setup: 0.25, actual: undefined, delta: undefined });
    expect(result?.cpk).toEqual({ setup: 2, actual: undefined, delta: undefined });
  });

  it("degrades an incomplete rational subgroup to Mean-only", () => {
    const result = buildFactorMeasuredComparison({
      ...setup,
      dataset: dataset(
        [
          { originalRow: 1, value: 1, disposition: "included" },
          { originalRow: 2, value: 2, disposition: "included" },
          { originalRow: 3, value: 3, disposition: "included" },
        ],
        {
          structure: "RATIONAL_SUBGROUP",
          rationalSubgroupConfig: { subgroupSize: 2, estimator: "S_C4" },
        },
      ),
    });

    expect(result?.mean.actual).toBe(2);
    expect(result?.oneSigma.actual).toBeUndefined();
    expect(result?.cpk.actual).toBeUndefined();
  });

  it("returns undefined with no included finite observations", () => {
    const result = buildFactorMeasuredComparison({
      ...setup,
      dataset: dataset([
        { originalRow: 1, value: Number.NaN, disposition: "included" },
        {
          originalRow: 2,
          value: 2,
          disposition: "excluded",
          reason: "OTHER",
          operatorReference: "operator",
          confirmed: true,
        },
      ]),
    });

    expect(result).toBeUndefined();
  });
});
