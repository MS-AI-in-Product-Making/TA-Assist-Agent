import type { CalculationFactorResult, Distribution } from "@ai-assist/contracts";
import { describe, expect, it } from "vitest";
import { apportionRssTolerance } from "./f6-apportionment.js";
import {
  factorSigmaToHalfTolerance,
  factorToleranceBandToSigma,
  F6NumericError,
  getDistributionMultiplier,
  stableL2Norm,
} from "./f6-numerics.js";
import { F6SolverError, solveSingleFactorTolerance } from "./f6-solver.js";

const DISTRIBUTIONS = [
  ["normal", 1],
  ["uniform", 1.732],
  ["triangular", 1.225],
  ["trapezoidal", 1.369],
  ["elliptical", 1.5],
  ["beta", 2.023],
] as const satisfies readonly (readonly [Distribution, number])[];

function factor(distribution: Distribution): CalculationFactorResult {
  const multiplier = getDistributionMultiplier(distribution);
  return {
    factorName: distribution,
    unit: "mm",
    source: { worksheetName: "Sheet1", tableId: "table-1", sourceRow: 1 },
    input: {
      nominalValue: 0,
      lowerTolerance: -1,
      upperTolerance: 1,
      longTermSafetyFactor: 2,
      sigmaLevel: 4,
      distribution,
    },
    mean: 0,
    halfTolerance: 1,
    sigma: multiplier / 2,
    contribution: 1,
    trace: { formulaIds: ["factor-sigma-v1"], sourceCells: ["Sheet1!A1"] },
  };
}

function expectNumericCode(run: () => unknown, code: F6NumericError["code"]): void {
  try {
    run();
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(F6NumericError);
    expect((error as F6NumericError).code).toBe(code);
  }
}

describe("F6 shared numerical tolerance primitives", () => {
  it.each(DISTRIBUTIONS)("matches the F4 %s distribution multiplier", (distribution, multiplier) => {
    expect(getDistributionMultiplier(distribution)).toBe(multiplier);
  });

  it.each(DISTRIBUTIONS)("round-trips %s sigma through half tolerance and tolerance band", (distribution) => {
    const selected = factor(distribution);
    const halfTolerance = factorSigmaToHalfTolerance(selected, selected.sigma);

    expect(halfTolerance).toBeCloseTo(1, 14);
    expect(factorToleranceBandToSigma(selected, halfTolerance * 2)).toBeCloseTo(selected.sigma, 14);
  });

  it("computes a stable L2 norm for nonnegative finite sigma values", () => {
    expect(stableL2Norm([3e200, 4e200]) / 5e200).toBeCloseTo(1, 14);
    expect(stableL2Norm([3e-200, 4e-200]) / 5e-200).toBeCloseTo(1, 14);
  });

  it("classifies invalid inputs separately from valid but unrepresentable results", () => {
    const selected = factor("normal");
    expectNumericCode(() => stableL2Norm([1, Number.NaN]), "invalid_solver_input");
    expectNumericCode(() => stableL2Norm([1, -1]), "invalid_solver_input");
    expectNumericCode(() => factorToleranceBandToSigma(selected, -1), "invalid_solver_input");
    expectNumericCode(
      () => factorSigmaToHalfTolerance(selected, Number.MAX_VALUE),
      "target_unreachable",
    );
  });

  it.each(DISTRIBUTIONS)("keeps solver and apportionment conversion parity for %s", (distribution) => {
    const selected = factor(distribution);
    const targetSigma = selected.sigma / 2;
    const expectedHalfTolerance = factorSigmaToHalfTolerance(selected, targetSigma);
    const solver = solveSingleFactorTolerance({
      factors: [selected],
      selectedSource: selected.source,
      targetRssSigma: targetSigma,
    });
    const apportionment = apportionRssTolerance({
      factors: [selected],
      selectedSources: [selected.source],
      targetRssSigma: targetSigma,
      policy: "equal-allocation-among-top-N",
    });

    expect(solver.resultingBand / 2).toBeCloseTo(expectedHalfTolerance, 14);
    expect(apportionment.allocations[0]!.targetTolerance).toBeCloseTo(expectedHalfTolerance, 14);
    expect(apportionment.allocations[0]!.targetSigma).toBeCloseTo(targetSigma, 14);
  });

  it("maps an unrepresentable conversion to target_unreachable across solver and apportionment", () => {
    const selected = factor("normal");
    const solve = () => solveSingleFactorTolerance({
      factors: [selected],
      selectedSource: selected.source,
      targetRssSigma: Number.MAX_VALUE,
    });
    const apportion = () => apportionRssTolerance({
      factors: [selected],
      selectedSources: [selected.source],
      targetRssSigma: Number.MAX_VALUE,
      policy: "equal-allocation-among-top-N",
    });

    for (const operation of [solve, apportion]) {
      try {
        operation();
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(F6SolverError);
        expect((error as F6SolverError).code).toBe("target_unreachable");
      }
    }
  });
});
