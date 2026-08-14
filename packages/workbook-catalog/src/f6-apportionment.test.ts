import {
  f6ApportionmentResultSchema,
  type CalculationFactorResult,
  type F6Option,
} from "@ai-assist/contracts";
import { describe, expect, it } from "vitest";
import { apportionRssTolerance } from "./f6-apportionment.js";

type CompletedOption = Extract<F6Option, { status: "completed" }>;

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

function expectSuccessfulRss(
  factors: readonly CalculationFactorResult[],
  selectedRows: readonly number[],
  targetRssSigma: number,
  targetSigmas: readonly number[],
): void {
  const result = apportionRssTolerance({
    factors,
    targetRssSigma,
    policy: "equal-allocation-among-top-N",
    selectedSources: selectedRows.map((row) => factors.find((item) => item.source.sourceRow === row)!.source),
  });

  expect(result.allocations.map(({ sourceRow }) => sourceRow)).toEqual([...selectedRows].sort((left, right) => left - right));
  result.allocations.forEach((allocation, index) => {
    expect(allocation.targetSigma / targetSigmas[index]!).toBeCloseTo(1, 12);
    expect(Number.isFinite(allocation.targetTolerance)).toBe(true);
  });
  expect(result.residualError / targetRssSigma).toBeLessThanOrEqual(1e-12);
  expect(result.feasibility.status).toBe("supported");
  expect(f6ApportionmentResultSchema.parse(result)).toEqual(result);
}

describe("F6 RSS tolerance apportionment", () => {
  it("allocates selected variance proportionally while holding unselected variance fixed", () => {
    const factors = [factor(1, 3, 0.6), factor(2, 2, 0.3), factor(3, 1, 0.1)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: Math.sqrt(6),
      policy: "proportional-to-contribution",
      selectedSources: [factors[1]!.source, factors[0]!.source],
    });

    expect(result.policy).toBe("proportional-to-contribution");
    expect(result.allocations.map(({ sourceRow }) => sourceRow)).toEqual([1, 2]);
    expect(result.allocations[0]!.targetSigma).toBeCloseTo(Math.sqrt(10 / 3), 12);
    expect(result.allocations[1]!.targetSigma).toBeCloseTo(Math.sqrt(5 / 3), 12);
    expect(result.allocations[0]!.targetTolerance).toBeCloseTo(Math.sqrt(10 / 3), 12);
    expect(result.allocations[1]!.targetTolerance).toBeCloseTo(Math.sqrt(5 / 3), 12);
    expect(result.residualError).toBeLessThanOrEqual(1e-12);
    expect(result.feasibility).toEqual({
      status: "supported",
      reasonCodes: ["rss_target_met"],
      evidenceReferences: [],
    });
  });

  it("allocates selected variance equally and reverses the F4 distribution formula", () => {
    const uniform = factor(1, 3, 0.6, {
      input: {
        nominalValue: 0,
        lowerTolerance: -3,
        upperTolerance: 3,
        longTermSafetyFactor: 2,
        sigmaLevel: 4,
        distribution: "uniform",
      },
    });
    const factors = [uniform, factor(2, 2, 0.3), factor(3, 1, 0.1)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: Math.sqrt(6),
      policy: "equal-allocation-among-top-N",
      selectedSources: [uniform.source, factors[1]!.source],
    });

    expect(result.allocations[0]!.targetSigma).toBeCloseTo(Math.sqrt(2.5), 12);
    expect(result.allocations[1]!.targetSigma).toBeCloseTo(Math.sqrt(2.5), 12);
    expect(result.allocations[0]!.targetTolerance).toBeCloseTo(Math.sqrt(2.5) * 4 / (2 * 1.732), 12);
    expect(result.allocations[1]!.targetTolerance).toBeCloseTo(Math.sqrt(2.5), 12);
  });

  it("uses proportional numeric allocation after centering without inventing mean changes", () => {
    const factors = [factor(1, 3, 0.6), factor(2, 2, 0.3), factor(3, 1, 0.1)];
    const selectedSources = [factors[0]!.source, factors[1]!.source];
    const proportional = apportionRssTolerance({
      factors,
      targetRssSigma: Math.sqrt(6),
      policy: "proportional-to-contribution",
      selectedSources,
    });
    const centered = apportionRssTolerance({
      factors,
      targetRssSigma: Math.sqrt(6),
      policy: "residual-after-centering",
      selectedSources,
    });

    expect(centered.policy).toBe("residual-after-centering");
    expect(centered.allocations).toEqual(proportional.allocations);
    expect(centered.residualError).toBe(proportional.residualError);
    expect(centered.feasibility).toEqual(proportional.feasibility);
  });

  it("clamps a bounded factor and deterministically redistributes variance to an unsaturated factor", () => {
    const factors = [factor(1, 3, 0.6), factor(2, 2, 0.3), factor(3, 1, 0.1)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: Math.sqrt(6),
      policy: "bounded-by-capability",
      selectedSources: [factors[1]!.source, factors[0]!.source],
      capabilityBounds: [
        { tableId: "table-1", sourceRow: 2, minimumToleranceBand: 2, maximumToleranceBand: 6, evidenceReference: "capability/row-2.json" },
        { tableId: "table-1", sourceRow: 1, minimumToleranceBand: 1, maximumToleranceBand: 2, evidenceReference: "capability/row-1.json" },
      ],
    });

    expect(result.allocations.map(({ tableId, sourceRow }) => ({ tableId, sourceRow }))).toEqual([
      { tableId: "table-1", sourceRow: 1 },
      { tableId: "table-1", sourceRow: 2 },
    ]);
    expect(result.allocations[0]!.targetSigma).toBeCloseTo(1, 12);
    expect(result.allocations[0]!.targetTolerance).toBeCloseTo(1, 12);
    expect(result.allocations[1]!.targetSigma).toBeCloseTo(2, 12);
    expect(result.allocations[1]!.targetTolerance).toBeCloseTo(2, 12);
    expect(result.residualError).toBeLessThanOrEqual(1e-12);
    expect(result.feasibility).toEqual({
      status: "requires_engineering_review",
      reasonCodes: ["rss_target_met_with_capability_bounds"],
      evidenceReferences: ["capability/row-1.json", "capability/row-2.json"],
    });
  });

  it("allocates the remaining variance when minimum and maximum bounds cross the unconstrained candidate", () => {
    const factors = [
      factor(1, 1, 0.5, { input: { nominalValue: 0, lowerTolerance: -1, upperTolerance: 1, longTermSafetyFactor: 3, sigmaLevel: 3, distribution: "normal" } }),
      factor(2, 1, 0.5, { input: { nominalValue: 0, lowerTolerance: -1, upperTolerance: 1, longTermSafetyFactor: 2, sigmaLevel: 2, distribution: "normal" } }),
    ];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 0.95,
      policy: "bounded-by-capability",
      selectedSources: factors.map((item) => item.source),
      capabilityBounds: [
        { tableId: "table-1", sourceRow: 1, minimumToleranceBand: 1.8, maximumToleranceBand: 2, evidenceReference: "capability/row-1.json" },
        { tableId: "table-1", sourceRow: 2, minimumToleranceBand: 0, maximumToleranceBand: 0.2, evidenceReference: "capability/row-2.json" },
      ],
    });

    expect(result.allocations.map(({ targetSigma }) => targetSigma)).toEqual([
      expect.closeTo(0.9447221814, 10),
      expect.closeTo(0.1, 12),
    ]);
    expect(result.residualError).toBeLessThanOrEqual(1e-12);
    expect(result.feasibility.status).toBe("requires_engineering_review");
  });

  it("redistributes multiple crossed min and max capacities independently of selected source order", () => {
    const factors = [factor(1, 1, 0.25), factor(2, 1, 0.25), factor(3, 1, 0.25), factor(4, 1, 0.25)];
    const capabilityBounds = [
      { tableId: "table-1", sourceRow: 1, minimumToleranceBand: 1.6, maximumToleranceBand: 2, evidenceReference: "capability/row-1.json" },
      { tableId: "table-1", sourceRow: 2, minimumToleranceBand: 1, maximumToleranceBand: 1.4, evidenceReference: "capability/row-2.json" },
      { tableId: "table-1", sourceRow: 3, minimumToleranceBand: 0, maximumToleranceBand: 0.2, evidenceReference: "capability/row-3.json" },
      { tableId: "table-1", sourceRow: 4, minimumToleranceBand: 0, maximumToleranceBand: 0.4, evidenceReference: "capability/row-4.json" },
    ];
    const forward = apportionRssTolerance({
      factors,
      targetRssSigma: 1,
      policy: "bounded-by-capability",
      selectedSources: factors.map((item) => item.source),
      capabilityBounds,
    });
    const reversed = apportionRssTolerance({
      factors,
      targetRssSigma: 1,
      policy: "bounded-by-capability",
      selectedSources: [...factors].reverse().map((item) => item.source),
      capabilityBounds: [...capabilityBounds].reverse(),
    });

    expect(reversed.allocations).toEqual(forward.allocations);
    expect(forward.allocations.map(({ targetSigma }) => targetSigma)).toEqual([
      expect.closeTo(Math.sqrt(101 / 150), 12),
      expect.closeTo(Math.sqrt(17 / 60), 12),
      expect.closeTo(0.1, 12),
      expect.closeTo(Math.sqrt(1 / 30), 12),
    ]);
    expect(forward.residualError).toBeLessThanOrEqual(1e-12);
    expect(forward.feasibility.status).toBe("requires_engineering_review");
  });

  it("returns maximum allocations when capability capacity cannot fill the selected variance budget", () => {
    const factors = [factor(1, 1, 0.5), factor(2, 1, 0.5)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 1,
      policy: "bounded-by-capability",
      selectedSources: factors.map((item) => item.source),
      capabilityBounds: [
        { tableId: "table-1", sourceRow: 1, minimumToleranceBand: 0, maximumToleranceBand: 1.2, evidenceReference: "capability/row-1.json" },
        { tableId: "table-1", sourceRow: 2, minimumToleranceBand: 0, maximumToleranceBand: 1.2, evidenceReference: "capability/row-2.json" },
      ],
    });

    expect(result.allocations.map(({ targetSigma }) => targetSigma)).toEqual([
      expect.closeTo(0.6, 12),
      expect.closeTo(0.6, 12),
    ]);
    expect(result.residualError).toBeCloseTo(1 - Math.sqrt(0.72), 12);
    expect(result.feasibility).toEqual({
      status: "not_supported",
      reasonCodes: ["capability_bounds_exclude_rss_target"],
      evidenceReferences: ["capability/row-1.json", "capability/row-2.json"],
    });
  });

  it("returns not_supported with residual when capability minimums make the target impossible", () => {
    const factors = [factor(1, 3, 0.6), factor(2, 2, 0.3), factor(3, 1, 0.1)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: Math.sqrt(6),
      policy: "bounded-by-capability",
      selectedSources: [factors[0]!.source, factors[1]!.source],
      capabilityBounds: [
        { tableId: "table-1", sourceRow: 1, minimumToleranceBand: 4, maximumToleranceBand: 6, evidenceReference: "capability/row-1.json" },
        { tableId: "table-1", sourceRow: 2, minimumToleranceBand: 4, maximumToleranceBand: 6, evidenceReference: "capability/row-2.json" },
      ],
    });

    expect(result.allocations.map(({ targetSigma }) => targetSigma)).toEqual([2, 2]);
    expect(result.residualError).toBeCloseTo(3 - Math.sqrt(6), 12);
    expect(result.feasibility.status).toBe("not_supported");
    expect(result.feasibility.reasonCodes).toEqual(["capability_bounds_exclude_rss_target"]);
    expect(f6ApportionmentResultSchema.parse(result)).toEqual(result);
  });

  it("returns insufficient evidence when any selected capability bound is missing", () => {
    const factors = [factor(1, 2, 0.8), factor(2, 1, 0.2)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 2,
      policy: "bounded-by-capability",
      selectedSources: factors.map((item) => item.source),
      capabilityBounds: [
        { tableId: "table-1", sourceRow: 1, minimumToleranceBand: 1, maximumToleranceBand: 4, evidenceReference: "capability/row-1.json" },
      ],
    });

    expect(result.allocations).toEqual([]);
    expect(result.residualError).toBe(2);
    expect(result.feasibility).toEqual({
      status: "insufficient_evidence",
      reasonCodes: ["missing_capability_bounds"],
      evidenceReferences: ["capability/row-1.json"],
    });
  });

  it("returns insufficient evidence for missing bounds before fixed variance feasibility", () => {
    const factors = [factor(1, 1, 0.2), factor(2, 3, 0.8)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 2,
      policy: "bounded-by-capability",
      selectedSources: [factors[0]!.source],
      capabilityBounds: [],
    });

    expect(result.allocations).toEqual([]);
    expect(result.residualError).toBe(1);
    expect(result.feasibility).toEqual({
      status: "insufficient_evidence",
      reasonCodes: ["missing_capability_bounds"],
      evidenceReferences: [],
    });
  });

  it("uses fixed variance in the residual when selected capability bounds are missing", () => {
    const factors = [factor(1, 1, 0.5), factor(2, 1, 0.5)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 2,
      policy: "bounded-by-capability",
      selectedSources: [factors[0]!.source],
      capabilityBounds: [],
    });

    expect(result.allocations).toEqual([]);
    expect(result.residualError).toBe(1);
    expect(result.feasibility.status).toBe("insufficient_evidence");
  });

  it("returns insufficient evidence when a capability bound identifies an unselected factor", () => {
    const factors = [factor(1, 1, 0.5), factor(2, 1, 0.5)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 2,
      policy: "bounded-by-capability",
      selectedSources: [factors[0]!.source],
      capabilityBounds: [
        { tableId: "table-1", sourceRow: 2, minimumToleranceBand: 0, maximumToleranceBand: 4, evidenceReference: "capability/row-2.json" },
      ],
    });

    expect(result.allocations).toEqual([]);
    expect(result.residualError).toBe(1);
    expect(result.feasibility.status).toBe("insufficient_evidence");
  });

  it.each([
    "equal-allocation-among-top-N",
    "proportional-to-contribution",
    "residual-after-centering",
  ] as const)("returns supported zero allocations when fixed variance equals the target for %s", (policy) => {
    const factors = [factor(1, 2, 0.5), factor(2, 2, 0.5)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 2,
      policy,
      selectedSources: [factors[0]!.source],
    });

    expect(result.allocations).toEqual([{
      tableId: "table-1",
      sourceRow: 1,
      targetSigma: 0,
      targetTolerance: 0,
    }]);
    expect(result.residualError).toBe(0);
    expect(result.feasibility).toEqual({
      status: "supported",
      reasonCodes: ["rss_target_met"],
      evidenceReferences: [],
    });
  });

  it("treats numeric noise as equality but rejects fixed variance materially above the target", () => {
    const selected = factor(1, 1, 0.5);
    const nearEqual = apportionRssTolerance({
      factors: [selected, factor(2, 1 + 4 * Number.EPSILON, 0.5)],
      targetRssSigma: 1,
      policy: "equal-allocation-among-top-N",
      selectedSources: [selected.source],
    });
    const aboveTarget = apportionRssTolerance({
      factors: [selected, factor(2, 1 + 64 * Number.EPSILON, 0.5)],
      targetRssSigma: 1,
      policy: "equal-allocation-among-top-N",
      selectedSources: [selected.source],
    });

    expect(nearEqual.allocations[0]!.targetSigma).toBe(0);
    expect(nearEqual.residualError).toBe(0);
    expect(nearEqual.feasibility.status).toBe("supported");
    expect(aboveTarget.allocations).toEqual([]);
    expect(aboveTarget.residualError).toBeGreaterThan(0);
    expect(aboveTarget.feasibility).toEqual({
      status: "not_supported",
      reasonCodes: ["fixed_variance_exceeds_rss_target"],
      evidenceReferences: [],
    });
  });

  it("supports zero bounded allocations when fixed variance equals the target and all minimums are zero", () => {
    const factors = [factor(1, 2, 0.5), factor(2, 2, 0.5)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 2,
      policy: "bounded-by-capability",
      selectedSources: [factors[0]!.source],
      capabilityBounds: [
        { tableId: "table-1", sourceRow: 1, minimumToleranceBand: 0, maximumToleranceBand: 4, evidenceReference: "capability/row-1.json" },
      ],
    });

    expect(result.allocations.map(({ targetSigma, targetTolerance }) => ({ targetSigma, targetTolerance }))).toEqual([
      { targetSigma: 0, targetTolerance: 0 },
    ]);
    expect(result.residualError).toBe(0);
    expect(result.feasibility).toEqual({
      status: "requires_engineering_review",
      reasonCodes: ["rss_target_met_with_capability_bounds"],
      evidenceReferences: ["capability/row-1.json"],
    });
  });

  it("rejects zero bounded allocations when fixed variance equals the target and any minimum is positive", () => {
    const factors = [factor(1, 2, 0.5), factor(2, 2, 0.5)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 2,
      policy: "bounded-by-capability",
      selectedSources: [factors[0]!.source],
      capabilityBounds: [
        { tableId: "table-1", sourceRow: 1, minimumToleranceBand: 2, maximumToleranceBand: 4, evidenceReference: "capability/row-1.json" },
      ],
    });

    expect(result.allocations.map(({ targetSigma, targetTolerance }) => ({ targetSigma, targetTolerance }))).toEqual([
      { targetSigma: 1, targetTolerance: 1 },
    ]);
    expect(result.residualError).toBeCloseTo(Math.sqrt(5) - 2, 12);
    expect(result.feasibility).toEqual({
      status: "not_supported",
      reasonCodes: ["capability_bounds_exclude_rss_target"],
      evidenceReferences: ["capability/row-1.json"],
    });
  });

  it("rejects duplicate or missing selected sources", () => {
    const factors = [factor(1, 2, 0.8), factor(2, 1, 0.2)];
    const base = {
      factors,
      targetRssSigma: 2,
      policy: "equal-allocation-among-top-N" as const,
    };

    expect(() => apportionRssTolerance({
      ...base,
      selectedSources: [],
    })).toThrowError(/selectedSources must not be empty/);
    expect(() => apportionRssTolerance({
      ...base,
      targetRssSigma: 0,
      selectedSources: [factors[0]!.source],
    })).toThrowError(/targetRssSigma must be finite and greater than zero/);
    expect(() => apportionRssTolerance({
      ...base,
      selectedSources: [factors[0]!.source, factors[0]!.source],
    })).toThrowError(/duplicate_selected_source/);
    expect(() => apportionRssTolerance({
      ...base,
      selectedSources: [{ worksheetName: "Sheet1", tableId: "table-1", sourceRow: 99 }],
    })).toThrowError(/missing_selected_source/);
  });

  it("accepts the contract maximum of 100 selected sources", () => {
    const factors = Array.from({ length: 100 }, (_, index) => factor(index + 1, 1, 0.01));
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 10,
      policy: "equal-allocation-among-top-N",
      selectedSources: factors.map((item) => item.source),
    });

    expect(result.allocations).toHaveLength(100);
    expect(result.feasibility.status).toBe("supported");
  });

  it("rejects more than 100 selected sources before resolving factors", () => {
    const selectedSources = Array.from({ length: 101 }, (_, index) => ({
      worksheetName: "Sheet1",
      tableId: "table-1",
      sourceRow: index + 1,
    }));

    expect(() => apportionRssTolerance({
      factors: [],
      targetRssSigma: 1,
      policy: "equal-allocation-among-top-N",
      selectedSources,
    })).toThrowError(/invalid_solver_input: selectedSources must contain at most 100 entries/);
  });

  it("returns insufficient evidence for duplicate capability bounds", () => {
    const factors = [factor(1, 2, 0.8), factor(2, 1, 0.2)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 2,
      policy: "bounded-by-capability",
      selectedSources: [factors[0]!.source],
      capabilityBounds: [
        { tableId: "table-1", sourceRow: 1, minimumToleranceBand: 1, maximumToleranceBand: 4, evidenceReference: "capability/a.json" },
        { tableId: "table-1", sourceRow: 1, minimumToleranceBand: 1, maximumToleranceBand: 4, evidenceReference: "capability/b.json" },
      ],
    });

    expect(result.allocations).toEqual([]);
    expect(result.feasibility).toEqual({
      status: "insufficient_evidence",
      reasonCodes: ["missing_capability_bounds"],
      evidenceReferences: ["capability/a.json", "capability/b.json"],
    });
  });

  it.each([
    { magnitude: 1e200, target: 1e200, fixed: 6e199, expected: 8e199 / Math.sqrt(2) },
    { magnitude: 1e-200, target: 1e-200, fixed: 6e-201, expected: 8e-201 / Math.sqrt(2) },
  ])("keeps finite allocations and controlled residual near $magnitude", ({ magnitude, target, fixed, expected }) => {
    const factors = [factor(1, magnitude, 0.4), factor(2, magnitude / 2, 0.4), factor(3, fixed, 0.2)];
    expectSuccessfulRss(factors, [1, 2], target, [expected, expected]);
  });

  it.each([1e200, 1e-200])("keeps bounded variance redistribution stable near %s", (magnitude) => {
    const factors = [factor(1, magnitude, 0.5), factor(2, magnitude, 0.5)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 0.95 * magnitude,
      policy: "bounded-by-capability",
      selectedSources: factors.map((item) => item.source),
      capabilityBounds: [
        { tableId: "table-1", sourceRow: 1, minimumToleranceBand: 1.8 * magnitude, maximumToleranceBand: 2 * magnitude, evidenceReference: "capability/row-1.json" },
        { tableId: "table-1", sourceRow: 2, minimumToleranceBand: 0, maximumToleranceBand: 0.2 * magnitude, evidenceReference: "capability/row-2.json" },
      ],
    });

    expect(result.allocations[0]!.targetSigma / magnitude).toBeCloseTo(0.9447221814, 10);
    expect(result.allocations[1]!.targetSigma / magnitude).toBeCloseTo(0.1, 12);
    expect(result.residualError / magnitude).toBeLessThanOrEqual(1e-12);
    expect(result.feasibility.status).toBe("requires_engineering_review");
  });

  it("does not mutate inputs and returns allocations sorted by source identity", () => {
    const factors = [factor(2, 2, 0.4), factor(1, 3, 0.6), factor(3, 1, 0.1)];
    const selectedSources = [factors[0]!.source, factors[1]!.source];
    const snapshot = structuredClone({ factors, selectedSources });

    const result = apportionRssTolerance({
      factors,
      targetRssSigma: Math.sqrt(6),
      policy: "equal-allocation-among-top-N",
      selectedSources,
    });

    expect({ factors, selectedSources }).toEqual(snapshot);
    expect(result.allocations.map(({ sourceRow }) => sourceRow)).toEqual([1, 2]);
  });

  it("returns an exact schema-valid DTO assignable unchanged to completed option apportionment", () => {
    const factors = [factor(1, 2, 0.8), factor(2, 1, 0.2)];
    const result = apportionRssTolerance({
      factors,
      targetRssSigma: 2,
      policy: "proportional-to-contribution",
      selectedSources: factors.map((item) => item.source),
    });
    const parsed = f6ApportionmentResultSchema.parse(result);
    const optionApportionment: CompletedOption["apportionment"] = result;

    expect(parsed).toEqual(result);
    expect(optionApportionment).toBe(result);
  });
});