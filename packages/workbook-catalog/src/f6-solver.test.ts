import {
  f6ReverseSolveResultSchema,
  f6ToleranceChangeSchema,
  type CalculationFactorResult,
} from "@ai-assist/contracts";
import { describe, expect, it } from "vitest";
import {
  createReverseSolveResult,
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

function expectFiniteNumericFields(value: unknown): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(expectFiniteNumericFields);
    return;
  }
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(expectFiniteNumericFields);
  }
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

  it("preserves representable subnormal bounds exactly at scale one", () => {
    const lowerTolerance = Number.MIN_VALUE;
    const upperTolerance = 2 * Number.MIN_VALUE;
    const result = scaleToleranceBandAroundCenter({ lowerTolerance, upperTolerance, scale: 1 });

    expect(result).toEqual({
      lowerTolerance,
      upperTolerance,
      center: (lowerTolerance + upperTolerance) / 2,
      originalBand: upperTolerance - lowerTolerance,
      resultingBand: upperTolerance - lowerTolerance,
    });
    expect(f6ToleranceChangeSchema.safeParse({
      worksheetName: "Sheet1",
      tableId: "table-1",
      sourceRow: 1,
      originalLowerTolerance: lowerTolerance,
      originalUpperTolerance: upperTolerance,
      resultingLowerTolerance: result.lowerTolerance,
      resultingUpperTolerance: result.upperTolerance,
      originalBand: result.originalBand,
      resultingBand: result.resultingBand,
      bandCenter: result.center,
    }).success).toBe(true);
  });

  it("rejects a subnormal shrink whose endpoints are not separately representable", () => {
    expect(() => scaleToleranceBandAroundCenter({
      lowerTolerance: Number.MIN_VALUE,
      upperTolerance: 2 * Number.MIN_VALUE,
      scale: 0.75,
    })).toThrowError(/target_unreachable/);
  });

  it("rejects a tiny scaled band when its represented endpoints materially distort its width", () => {
    expect(() => scaleToleranceBandAroundCenter({
      lowerTolerance: 0,
      upperTolerance: 2e-10,
      scale: 1e-16,
    })).toThrowError(/target_unreachable: represented target tolerance band does not match the requested band/);
  });

  it.each([
    { lowerTolerance: -(2 ** -900), upperTolerance: 2 ** -900, scale: 0.5 },
    { lowerTolerance: -1e-300, upperTolerance: 1e-300, scale: 0.5 },
  ])("accepts a small scaled band when its endpoint width is representable", (input) => {
    const result = scaleToleranceBandAroundCenter(input);
    const representedBand = result.upperTolerance - result.lowerTolerance;

    expect(Math.abs(representedBand - result.resultingBand)).toBeLessThanOrEqual(
      8 * Number.EPSILON * Math.max(Math.abs(representedBand), Math.abs(result.resultingBand)),
    );
    expect((result.lowerTolerance + result.upperTolerance) / 2).toBe(result.center);
  });

  it.each([
    { lowerTolerance: 0, upperTolerance: 1, scale: 0 },
    { lowerTolerance: 0, upperTolerance: 1, scale: 1.1 },
    { lowerTolerance: 1, upperTolerance: 1, scale: 0.5 },
    { lowerTolerance: 0, upperTolerance: Number.POSITIVE_INFINITY, scale: 0.5 },
  ])("rejects an invalid tolerance scaling input", (input) => {
    expect(() => scaleToleranceBandAroundCenter(input)).toThrow(F6SolverError);
  });

  it("rejects a finite tolerance band whose width is not representable", () => {
    expect(() => scaleToleranceBandAroundCenter({
      lowerTolerance: -1e308,
      upperTolerance: 1e308,
      scale: 0.5,
    })).toThrowError(/invalid_solver_input/);
  });

  it("scales large same-sign finite tolerance endpoints without overflowing the center", () => {
    const result = scaleToleranceBandAroundCenter({
      lowerTolerance: 1e308,
      upperTolerance: 1.6e308,
      scale: 0.5,
    });

    expect(result.center).toBe(1.3e308);
    expect(result.originalBand).toBe(6e307);
    expect(result.resultingBand).toBe(3e307);
    expectFiniteNumericFields(result);
  });

  it("computes a stable midpoint for huge same-sign bounds", () => {
    const lowerTolerance = 1e308;
    const upperTolerance = 1.6e308;
    const expectedCenter = lowerTolerance / 2 + upperTolerance / 2;
    const result = scaleToleranceBandAroundCenter({ lowerTolerance, upperTolerance, scale: 1 });

    expect(result.center).toBe(expectedCenter);
    expect(result.lowerTolerance).toBe(lowerTolerance);
    expect(result.upperTolerance).toBe(upperTolerance);
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

  it.each([
    [1e16, 1, -1e16],
    [1e16, -1e16, 1],
    [1, 1e16, -1e16],
    [-1e16, 1, 1e16],
    [-1e16, 1e16, 1],
    [1, -1e16, 1e16],
  ])("stably sums cancelling factor means in permutation %#", (...factorMeans) => {
    const result = solveCenteringShift({ factorMeans, LSL: -1, USL: 1 });

    expect(result.additionalMeanShift).toBeCloseTo(-1, 14);
  });

  it("avoids intermediate overflow when summing extreme factor means", () => {
    expect(solveCenteringShift({
      factorMeans: [Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE],
      LSL: -1,
      USL: 1,
    })).toEqual({ targetMean: 0, additionalMeanShift: -Number.MAX_VALUE });
  });

  it("classifies an unrepresentable factor-mean sum as an unreachable target", () => {
    try {
      solveCenteringShift({
        factorMeans: [Number.MAX_VALUE, Number.MAX_VALUE],
        LSL: -1,
        USL: 1,
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(F6SolverError);
      expect((error as F6SolverError).code).toBe("target_unreachable");
    }
  });

  it("centers symmetric extreme specification bounds without computing their width", () => {
    expect(solveCenteringShift({
      factorMeans: [0],
      LSL: -1e308,
      USL: 1e308,
    })).toEqual({ targetMean: 0, additionalMeanShift: 0 });
  });

  it.each([
    {
      lowerSpecLimit: Number.MIN_VALUE,
      upperSpecLimit: 2 * Number.MIN_VALUE,
      expectedTarget: (Number.MIN_VALUE + 2 * Number.MIN_VALUE) / 2,
    },
    {
      lowerSpecLimit: -1.6e308,
      upperSpecLimit: 1e308,
      expectedTarget: (-1.6e308 + 1e308) / 2,
    },
    {
      lowerSpecLimit: 1e308,
      upperSpecLimit: 1.6e308,
      expectedTarget: 1e308 / 2 + 1.6e308 / 2,
    },
  ])("uses the stable midpoint when solving a centering shift", ({
    lowerSpecLimit,
    upperSpecLimit,
    expectedTarget,
  }) => {
    expect(solveCenteringShift({
      factorMeans: [expectedTarget],
      lowerSpecLimit,
      upperSpecLimit,
    })).toEqual({ targetMean: expectedTarget, additionalMeanShift: 0 });
  });

  it("solves target RSS sigma from the limiting specification distance", () => {
    expect(solveTargetRssSigma({
      mean: 1,
      lowerSpecLimit: 0,
      upperSpecLimit: 2,
      targetCpk: 1.33333333333333,
    })).toBeCloseTo(0.25, 12);
  });

  it("avoids target Cpk denominator overflow for representable extreme ratios", () => {
    expect(solveTargetRssSigma({
      mean: 0,
      LSL: -1e308,
      USL: 1e308,
      targetCpk: 1e308,
    })).toBeCloseTo(1 / 3, 12);
  });

  it("avoids intermediate overflow when a small target Cpk produces a large finite sigma", () => {
    expect(solveTargetRssSigma({
      mean: 0,
      LSL: -1e308,
      USL: 1e308,
      targetCpk: 0.2,
    })).toBe(1.6666666666666666e308);
  });

  it("stably solves a small specification distance and target Cpk", () => {
    expect(solveTargetRssSigma({
      mean: 0,
      LSL: -1e-300,
      USL: 1e-300,
      targetCpk: 2e-300,
    })).toBeCloseTo(1 / 6, 12);
  });

  it("normalizes a valid but unrepresentable target sigma as unreachable", () => {
    try {
      solveTargetRssSigma({
        mean: 0,
        LSL: -Number.MAX_VALUE,
        USL: Number.MAX_VALUE,
        targetCpk: Number.MIN_VALUE,
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(F6SolverError);
      expect((error as F6SolverError).code).toBe("target_unreachable");
    }
  });

  it.each([
    () => solveCenteringShift({ factorMeans: [Number.NaN], LSL: -1, USL: 1 }),
    () => solveTargetRssSigma({ mean: 0, LSL: -1, USL: 1, targetCpk: 0 }),
  ])("preserves invalid_solver_input for invalid solver input %#", (solve) => {
    try {
      solve();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(F6SolverError);
      expect((error as F6SolverError).code).toBe("invalid_solver_input");
    }
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

  it("avoids intermediate overflow when computing a representable target tolerance", () => {
    const selected = factor(1, 1e308, 1, {
      input: {
        nominalValue: 0,
        lowerTolerance: -1e307,
        upperTolerance: 1e307,
        longTermSafetyFactor: 4,
        sigmaLevel: 2,
        distribution: "normal",
      },
    });

    const change = solveSingleFactorTolerance({
      factors: [selected],
      selectedSource: selected.source,
      targetRssSigma: 1e308,
    });

    expect(change.resultingLowerTolerance).toBe(-5e307);
    expect(change.resultingUpperTolerance).toBe(5e307);
    expect(change.resultingBand).toBe(1e308);
    expect(f6ToleranceChangeSchema.parse(change)).toEqual(change);
    expectFiniteNumericFields(change);
  });

  it("avoids intermediate underflow for a representable extreme product quotient", () => {
    const selected = factor(1, 1, 1, {
      input: {
        nominalValue: 0,
        lowerTolerance: -1,
        upperTolerance: 1,
        longTermSafetyFactor: 1e300,
        sigmaLevel: 1e300,
        distribution: "normal",
      },
    });

    const change = solveSingleFactorTolerance({
      factors: [selected],
      selectedSource: selected.source,
      targetRssSigma: 1e-300,
    });

    expect(change.resultingUpperTolerance).toBe(1e-300);
    expect(change.resultingLowerTolerance).toBe(-1e-300);
    expect(change.resultingBand).toBe(2e-300);
    expectFiniteNumericFields(change);
  });

  it("rejects a tiny reverse band when its represented endpoints materially distort its width", () => {
    const selected = factor(1, 1e-10, 1, {
      input: {
        nominalValue: 0,
        lowerTolerance: 0,
        upperTolerance: 2e-10,
        longTermSafetyFactor: 1,
        sigmaLevel: 1,
        distribution: "normal",
      },
    });

    expect(() => solveSingleFactorTolerance({
      factors: [selected],
      selectedSource: selected.source,
      targetRssSigma: 1e-26,
    })).toThrowError(/target_unreachable: represented target tolerance band does not match the requested band/);
  });

  it("rejects a target tolerance below endpoint resolution at a huge band center", () => {
    const selected = factor(1, 1, 1, {
      input: {
        nominalValue: 0,
        lowerTolerance: 1e308,
        upperTolerance: 1.6e308,
        longTermSafetyFactor: 1,
        sigmaLevel: 1,
        distribution: "normal",
      },
    });

    expect(() => solveSingleFactorTolerance({
      factors: [selected],
      selectedSource: selected.source,
      targetRssSigma: 1,
    })).toThrowError(/target_unreachable|invalid_solver_input/);
  });

  it("accepts a finite target half tolerance before rejecting its unrepresentable result band", () => {
    const selected = factor(1, 1e308, 1, {
      input: {
        nominalValue: 0,
        lowerTolerance: -1e307,
        upperTolerance: 1e307,
        longTermSafetyFactor: 2,
        sigmaLevel: 2,
        distribution: "normal",
      },
    });

    try {
      solveSingleFactorTolerance({
        factors: [selected],
        selectedSource: selected.source,
        targetRssSigma: 1e308,
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(F6SolverError);
      expect((error as F6SolverError).code).toBe("target_unreachable");
    }
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

  it("normalizes extreme proportional contributions without sum overflow", () => {
    const factors = [factor(1, 1, 1e308), factor(2, 1, 1e308)];

    const changes = solveTopNCombinedTolerance({
      factors,
      selectedSources: factors.map((item) => item.source),
      targetRssSigma: 1,
      allocation: "proportional-to-contribution",
    });

    expect(changes[0].resultingUpperTolerance).toBeCloseTo(Math.sqrt(0.5), 12);
    expect(changes[1].resultingUpperTolerance).toBeCloseTo(Math.sqrt(0.5), 12);
    expectFiniteNumericFields(changes);
  });

  it("keeps proportional allocation invariant when all contributions share a finite scale", () => {
    const solve = (scale: number) => {
      const factors = [factor(1, 1, 2 * scale), factor(2, 1, scale)];
      return solveTopNCombinedTolerance({
        factors,
        selectedSources: factors.map((item) => item.source),
        targetRssSigma: 1,
        allocation: "proportional-to-contribution",
      });
    };

    const baseline = solve(1);
    const scaled = solve(5e307);

    expect(scaled.map((change) => change.resultingUpperTolerance)).toEqual(
      baseline.map((change) => change.resultingUpperTolerance),
    );
  });

  it.each([
    [0, 0],
    [Number.POSITIVE_INFINITY, 1],
    [-1, 1],
  ])("rejects invalid proportional contributions %s and %s", (firstContribution, secondContribution) => {
    const factors = [factor(1, 1, firstContribution), factor(2, 1, secondContribution)];

    expect(() => solveTopNCombinedTolerance({
      factors,
      selectedSources: factors.map((item) => item.source),
      targetRssSigma: 1,
      allocation: "proportional-to-contribution",
    })).toThrow(F6SolverError);
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

  it.each([
    { magnitude: 1e200, target: 1e200, fixed: 6e199, expectedSelected: 8e199 },
    { magnitude: 1e-200, target: 1e-200, fixed: 6e-201, expectedSelected: 8e-201 },
  ])("stably solves reachable single-factor magnitudes near $magnitude", ({ magnitude, target, fixed, expectedSelected }) => {
    const factors = [factor(1, magnitude, 0.8), factor(2, fixed, 0.2)];

    const change = solveSingleFactorTolerance({
      factors,
      selectedSource: factors[0].source,
      targetRssSigma: target,
    });

    expect(Number.isFinite(change.resultingLowerTolerance)).toBe(true);
    expect(Number.isFinite(change.resultingUpperTolerance)).toBe(true);
    expect(change.resultingUpperTolerance / expectedSelected).toBeCloseTo(1, 12);
    expect(f6ToleranceChangeSchema.safeParse(change).success).toBe(true);
  });

  it.each([
    { magnitude: 1e200, target: 1e200, fixed: 6e199 },
    { magnitude: 1e-200, target: 1e-200, fixed: 6e-201 },
  ])("stably allocates reachable Top-N magnitudes near $magnitude", ({ magnitude, target, fixed }) => {
    const factors = [
      factor(1, magnitude, 0.4),
      factor(2, magnitude / 2, 0.4),
      factor(3, fixed, 0.2),
    ];

    const changes = solveTopNCombinedTolerance({
      factors,
      selectedSources: [factors[0].source, factors[1].source],
      targetRssSigma: target,
      allocation: "equal-allocation-among-top-N",
    });

    const expectedSigma = target * 0.8 / Math.sqrt(2);
    expect(changes).toHaveLength(2);
    expect(changes.every((change) => Number.isFinite(change.resultingBand))).toBe(true);
    expect(changes[0].resultingUpperTolerance / expectedSigma).toBeCloseTo(1, 12);
    expect(changes[1].resultingUpperTolerance / expectedSigma).toBeCloseTo(1, 12);
    expect(changes.every((change) => f6ToleranceChangeSchema.safeParse(change).success)).toBe(true);
  });

  it("solves a positive remaining sigma when fixed sigma is strictly below target", () => {
    const fixedSigma = 1 - 1e-15;
    const factors = [factor(1, 1, 0.5), factor(2, fixedSigma, 0.5)];

    const change = solveSingleFactorTolerance({
      factors,
      selectedSource: factors[0].source,
      targetRssSigma: 1,
    });

    expect(change.resultingUpperTolerance).toBeCloseTo(Math.sqrt(1 - fixedSigma ** 2), 14);
    expect(change.resultingUpperTolerance).toBeGreaterThan(0);
  });

  it("allows a representable subnormal remaining sigma to proceed", () => {
    const factors = [
      factor(1, Number.MIN_VALUE, 0.5),
      factor(2, Number.MIN_VALUE, 0.5),
    ];

    const change = solveSingleFactorTolerance({
      factors,
      selectedSource: factors[0].source,
      targetRssSigma: 2 * Number.MIN_VALUE,
    });

    expect(change.resultingUpperTolerance).toBeGreaterThan(0);
    expect(change.resultingUpperTolerance).toBeLessThanOrEqual(Number.MIN_VALUE * 2);
    expectFiniteNumericFields(change);
  });

  it.each([1, 1 + Number.EPSILON])("rejects fixed sigma at or above target (%s)", (fixedSigma) => {
    const factors = [factor(1, 1, 0.5), factor(2, fixedSigma, 0.5)];

    expect(() => solveSingleFactorTolerance({
      factors,
      selectedSource: factors[0].source,
      targetRssSigma: 1,
    })).toThrowError(/target_unreachable/);
  });

  it("builds a complete reverse solve DTO through the contract schema", () => {
    const toleranceChanges = [solveSingleFactorTolerance({
      factors: [factor(1, 2, 1)],
      selectedSource: factor(1, 2, 1).source,
      targetRssSigma: 1,
    })];

    const result = createReverseSolveResult({
      strategy: "single-factor",
      targetCpk: 1.67,
      targetRssSigma: 1,
      toleranceChanges,
      residualError: 0,
    });

    expect(result).toEqual({
      strategy: "single-factor",
      targetCpk: 1.67,
      targetRssSigma: 1,
      toleranceChanges,
      residualError: 0,
    });
    expect(f6ReverseSolveResultSchema.parse(result)).toEqual(result);
    expectFiniteNumericFields(result);
  });

  it("all successful public solver DTO outputs parse their schemas and contain only finite numbers", () => {
    const factors = [factor(1, 3, 0.6), factor(2, 2, 0.4)];
    const single = solveSingleFactorTolerance({
      factors,
      selectedSource: factors[0].source,
      targetRssSigma: Math.sqrt(5),
    });
    const topN = solveTopNCombinedTolerance({
      factors,
      selectedSources: factors.map((item) => item.source),
      targetRssSigma: 2,
      allocation: "equal-allocation-among-top-N",
    });

    expect(f6ToleranceChangeSchema.parse(single)).toEqual(single);
    topN.forEach((change) => expect(f6ToleranceChangeSchema.parse(change)).toEqual(change));
    expectFiniteNumericFields(single);
    expectFiniteNumericFields(topN);
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