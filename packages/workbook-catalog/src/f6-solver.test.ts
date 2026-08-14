import { f6ToleranceChangeSchema, type CalculationFactorResult } from "@ai-assist/contracts";
import { describe, expect, it } from "vitest";
import {
  F6SolverError,
  scaleToleranceBandAroundCenter,
  selectTopContributors,
  solveCenteringShift,
  solveSingleFactorTolerance,
  solveTargetRssSigma,
  solveTopNCombinedTolerance,
} from "./f6-solver.js";

function factor(
  sourceRow: number,
  sigma: number,
  contribution: number,
  overrides: Partial<CalculationFactorResult> = {},
): CalculationFactorResult {
  return {
    factorName: `factor-${sourceRow}`,
    unit: "mm",
    source: { worksheetName: "Sheet1", tableId: "table-1", sourceRow },
    input: {
      nominalValue: 0,
      lowerTolerance: -sigma,
      upperTolerance: sigma,
      longTermSafetyFactor: 1,
      sigmaLevel: 1,
      distribution: "normal",
    },
    mean: 0,
    halfTolerance: sigma,
    sigma,
    contribution,
    trace: { formulaIds: ["factor-sigma-v1"], sourceCells: [`Sheet1!A${sourceRow}`] },
    ...overrides,
  };
}

describe("F6 deterministic solver primitives", () => {
  it("scales an asymmetric tolerance band around its center", () => {
    const result = scaleToleranceBandAroundCenter({
      lowerTolerance: -0.1,
      upperTolerance: 0.3,
      scale: 0.8,
    });

    expect(result.lowerTolerance).toBeCloseTo(-0.06, 12);
    expect(result.upperTolerance).toBeCloseTo(0.26, 12);
    expect(result.center).toBeCloseTo(0.1, 12);
    expect(result.originalBand).toBeCloseTo(0.4, 12);
    expect(result.resultingBand).toBeCloseTo(0.32, 12);
  });

  it.each([
    { lowerTolerance: 0, upperTolerance: 1, scale: 0 },
    { lowerTolerance: 0, upperTolerance: 1, scale: 1.1 },
    { lowerTolerance: 1, upperTolerance: 1, scale: 0.5 },
    { lowerTolerance: 0, upperTolerance: Number.POSITIVE_INFINITY, scale: 0.5 },
  ])("rejects an invalid tolerance scaling input", (input) => {
    expect(() => scaleToleranceBandAroundCenter(input)).toThrow(F6SolverError);
  });

  it("selects contributors by descending contribution with stable source tie breaks without mutation", () => {
    const factors = [
      factor(4, 1, 0.2, { source: { worksheetName: "B", tableId: "t", sourceRow: 4 } }),
      factor(3, 1, 0.4, { source: { worksheetName: "A", tableId: "z", sourceRow: 3 } }),
      factor(2, 1, 0.4, { source: { worksheetName: "A", tableId: "a", sourceRow: 2 } }),
      factor(1, 1, 0.4, { source: { worksheetName: "A", tableId: "a", sourceRow: 1 } }),
    ] as const;
    const originalOrder = factors.map((item) => item.source.sourceRow);

    const selected = selectTopContributors(factors, 3);

    expect(selected.map((item) => item.source)).toEqual([
      { worksheetName: "A", tableId: "a", sourceRow: 1 },
      { worksheetName: "A", tableId: "a", sourceRow: 2 },
      { worksheetName: "A", tableId: "z", sourceRow: 3 },
    ]);
    expect(factors.map((item) => item.source.sourceRow)).toEqual(originalOrder);
  });

  it.each([0, -1, 1.5, 5, Number.NaN])("rejects invalid contributor count %s", (count) => {
    expect(() => selectTopContributors([factor(1, 1, 1)], count)).toThrow(F6SolverError);
  });

  it("solves the additional mean shift needed to center the stack", () => {
    expect(solveCenteringShift({
      factorMeans: [0.2, 0.3],
      LSL: 0,
      USL: 2,
    })).toEqual({ targetMean: 1, additionalMeanShift: 0.5 });
  });

  it("solves target RSS sigma from the limiting specification distance", () => {
    expect(solveTargetRssSigma({
      mean: 1,
      lowerSpecLimit: 0,
      upperSpecLimit: 2,
      targetCpk: 1.33333333333333,
    })).toBeCloseTo(0.25, 12);
  });

  it.each([
    { mean: 0, lowerSpecLimit: 0, upperSpecLimit: 2, targetCpk: 1 },
    { mean: 3, lowerSpecLimit: 0, upperSpecLimit: 2, targetCpk: 1 },
    { mean: 1, lowerSpecLimit: 2, upperSpecLimit: 0, targetCpk: 1 },
    { mean: 1, lowerSpecLimit: 0, upperSpecLimit: 2, targetCpk: 0 },
    { mean: Number.NaN, lowerSpecLimit: 0, upperSpecLimit: 2, targetCpk: 1 },
  ])("rejects invalid centering or target-sigma bounds", (input) => {
    expect(() => solveTargetRssSigma(input)).toThrow(F6SolverError);
  });

  it("solves a single factor tolerance after holding all other variance fixed", () => {
    const factors = [factor(1, 3, 0.9), factor(2, 1, 0.1)];
    const change = solveSingleFactorTolerance({
      factors,
      selectedSource: factors[0].source,
      targetRssSigma: Math.sqrt(5),
    });

    expect(change).toEqual({
      worksheetName: "Sheet1",
      tableId: "table-1",
      sourceRow: 1,
      originalLowerTolerance: -3,
      originalUpperTolerance: 3,
      resultingLowerTolerance: -2,
      resultingUpperTolerance: 2,
      originalBand: 6,
      resultingBand: 4,
      bandCenter: 0,
    });
    expect(f6ToleranceChangeSchema.safeParse(change).success).toBe(true);
  });

  it.each([
    ["normal", 1],
    ["uniform", 1.732],
    ["triangular", 1.225],
    ["trapezoidal", 1.369],
    ["elliptical", 1.5],
    ["beta", 2.023],
  ] as const)("reverses the controlled %s distribution multiplier", (distribution, multiplier) => {
    const selected = factor(1, multiplier, 1, {
      input: {
        nominalValue: 0,
        lowerTolerance: -1,
        upperTolerance: 1,
        longTermSafetyFactor: 1,
        sigmaLevel: 1,
        distribution,
      },
    });

    const change = solveSingleFactorTolerance({
      factors: [selected],
      selectedSource: selected.source,
      targetRssSigma: multiplier / 2,
    });

    expect(change.resultingLowerTolerance).toBeCloseTo(-0.5, 12);
    expect(change.resultingUpperTolerance).toBeCloseTo(0.5, 12);
    expect(f6ToleranceChangeSchema.safeParse(change).success).toBe(true);
  });

  it("solves selected Top-N tolerances with proportional variance allocation in selected order", () => {
    const factors = [factor(1, 3, 0.6), factor(2, 2, 0.3), factor(3, 1, 0.1)];
    const changes = solveTopNCombinedTolerance({
      factors,
      selectedSources: [factors[1].source, factors[0].source],
      targetRssSigma: Math.sqrt(6),
      allocation: "proportional-to-contribution",
    });

    expect(changes.map((change) => change.sourceRow)).toEqual([2, 1]);
    expect(changes[0].resultingUpperTolerance).toBeCloseTo(Math.sqrt(5 / 3), 12);
    expect(changes[1].resultingUpperTolerance).toBeCloseTo(Math.sqrt(10 / 3), 12);
    expect(changes.every((change) => f6ToleranceChangeSchema.safeParse(change).success)).toBe(true);
  });

  it("solves selected Top-N tolerances with equal variance allocation", () => {
    const factors = [factor(1, 3, 0.6), factor(2, 2, 0.3), factor(3, 1, 0.1)];
    const changes = solveTopNCombinedTolerance({
      factors,
      selectedSources: [factors[0].source, factors[1].source],
      targetRssSigma: Math.sqrt(5),
      allocation: "equal-allocation-among-top-N",
    });

    expect(changes[0].resultingUpperTolerance).toBeCloseTo(Math.sqrt(2), 12);
    expect(changes[1].resultingUpperTolerance).toBeCloseTo(Math.sqrt(2), 12);
  });

  it("rejects unreachable targets, invalid factor controls, and invalid source selections", () => {
    const factors = [factor(1, 3, 0.9), factor(2, 2, 0.1)];
    const invalidSafety = factor(3, 1, 0.1, {
      input: { ...factor(3, 1, 0.1).input, longTermSafetyFactor: 0 },
    });
    const invalidSigma = factor(3, 1, 0.1, {
      input: { ...factor(3, 1, 0.1).input, sigmaLevel: 0 },
    });
    const invalidDistribution = factor(3, 1, 0.1, {
      input: { ...factor(3, 1, 0.1).input, distribution: "unknown" as "normal" },
    });

    expect(() => solveSingleFactorTolerance({
      factors,
      selectedSource: factors[0].source,
      targetRssSigma: 1,
    })).toThrowError(/target_unreachable/);
    expect(() => solveSingleFactorTolerance({ factors: [invalidSafety], selectedSource: invalidSafety.source, targetRssSigma: 1 })).toThrow(F6SolverError);
    expect(() => solveSingleFactorTolerance({ factors: [invalidSigma], selectedSource: invalidSigma.source, targetRssSigma: 1 })).toThrow(F6SolverError);
    expect(() => solveSingleFactorTolerance({ factors: [invalidDistribution], selectedSource: invalidDistribution.source, targetRssSigma: 1 })).toThrow(F6SolverError);
    expect(() => solveSingleFactorTolerance({ factors, selectedSource: { ...factors[0].source, sourceRow: 99 }, targetRssSigma: 3 })).toThrowError(/missing_selected_source/);
    expect(() => solveTopNCombinedTolerance({
      factors,
      selectedSources: [factors[0].source, factors[0].source],
      targetRssSigma: 3,
      allocation: "equal-allocation-among-top-N",
    })).toThrowError(/duplicate_selected_source/);
    expect(() => solveTopNCombinedTolerance({
      factors,
      selectedSources: [{ ...factors[0].source, sourceRow: 99 }],
      targetRssSigma: 3,
      allocation: "equal-allocation-among-top-N",
    })).toThrowError(/missing_selected_source/);
    expect(() => solveTopNCombinedTolerance({
      factors,
      selectedSources: [factors[0].source],
      targetRssSigma: Number.NaN,
      allocation: "equal-allocation-among-top-N",
    })).toThrow(F6SolverError);
  });
});