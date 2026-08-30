import { describe, expect, it } from "vitest";
import {
  buildMonteCarloSetupComparison,
  deriveMonteCarloSetupSummary,
  type MonteCarloSetupSummaryInput,
} from "./monte-carlo-setup-comparison";

function setupInput(overrides: Partial<MonteCarloSetupSummaryInput> = {}): MonteCarloSetupSummaryInput {
  return {
    factors: [
      { setup: { confirmed: true }, evidence: { calculatedMean: -0.6, oneSigma: 0.03 } },
      { setup: { confirmed: true }, evidence: { calculatedMean: 0.2, oneSigma: 0.04 } },
    ],
    systemSpecification: {
      additionalMeanShift: {
        status: "available",
        actualValue: 0.1,
        valueOrigin: "numeric_literal",
      },
    },
    ...overrides,
  };
}

describe("Monte Carlo Factor Setup comparison", () => {
  it("derives setup mean from confirmed evidence and governed shift, and sigma by RSS", () => {
    const summary = deriveMonteCarloSetupSummary(setupInput());

    expect(summary.available).toBe(true);
    if (!summary.available) return;
    expect(summary.mean).toBeCloseTo(-0.3, 12);
    expect(summary.standardDeviation).toBeCloseTo(0.05, 12);
  });

  it("uses zero only for a governed defaulted Additional Mean Shift", () => {
    const summary = deriveMonteCarloSetupSummary(setupInput({
      systemSpecification: {
        additionalMeanShift: {
          status: "available",
          actualValue: 25,
          valueOrigin: "defaulted",
        },
      },
    }));

    expect(summary.available).toBe(true);
    if (!summary.available) return;
    expect(summary.mean).toBeCloseTo(-0.4, 12);
    expect(summary.standardDeviation).toBeCloseTo(0.05, 12);
  });

  it("keeps a finite RSS sigma when squaring finite factor sigmas would overflow", () => {
    const oneSigma = Number.MAX_VALUE / 4;
    const summary = deriveMonteCarloSetupSummary(setupInput({
      factors: [
        { setup: { confirmed: true }, evidence: { calculatedMean: 0, oneSigma } },
        { setup: { confirmed: true }, evidence: { calculatedMean: 0, oneSigma } },
      ],
    }));

    expect(summary.available).toBe(true);
    if (!summary.available) return;
    expect(summary.standardDeviation).toBeCloseTo(Math.hypot(oneSigma, oneSigma), 12);
  });

  it.each([
    ["missing factor evidence", setupInput({ factors: [{ setup: { confirmed: true } }] })],
    ["unconfirmed factor", setupInput({ factors: [{ evidence: { calculatedMean: 1, oneSigma: 0.1 } }] })],
    ["non-finite mean", setupInput({ factors: [{ setup: { confirmed: true }, evidence: { calculatedMean: Number.NaN, oneSigma: 0.1 } }] })],
    ["non-finite sigma", setupInput({ factors: [{ setup: { confirmed: true }, evidence: { calculatedMean: 1, oneSigma: Number.POSITIVE_INFINITY } }] })],
    ["negative sigma", setupInput({ factors: [{ setup: { confirmed: true }, evidence: { calculatedMean: 1, oneSigma: -0.1 } }] })],
    ["non-positive RSS sigma", setupInput({ factors: [{ setup: { confirmed: true }, evidence: { calculatedMean: 1, oneSigma: 0 } }] })],
    ["missing shift evidence", setupInput({ systemSpecification: {} })],
    ["unavailable non-defaulted shift", setupInput({
      systemSpecification: {
        additionalMeanShift: { status: "unavailable" },
      },
    })],
    ["non-finite shift", setupInput({
      systemSpecification: {
        additionalMeanShift: {
          status: "available",
          actualValue: Number.NaN,
          valueOrigin: "numeric_literal",
        },
      },
    })],
  ])("is unavailable for %s", (_label, input) => {
    expect(deriveMonteCarloSetupSummary(input)).toEqual({ available: false });
  });

  it.each([
    [0.2, 0.06, "right", "wider"],
    [-0.4, 0.04, "left", "narrower"],
    [-0.3, 0.05, "same", "same"],
  ] as const)(
    "formats factual mean and spread comparison for Monte Carlo mean %s and sigma %s",
    (mean, standardDeviation, meanDirection, spreadDirection) => {
      const comparison = buildMonteCarloSetupComparison({
        setup: { available: true, mean: -0.3, standardDeviation: 0.05 },
        monteCarlo: { mean, standardDeviation },
      });

      expect(comparison.available).toBe(true);
      if (!comparison.available) return;
      expect(comparison.mean.setup).toBe(-0.3);
      expect(comparison.mean.monteCarlo).toBe(mean);
      expect(comparison.mean.delta).toBeCloseTo(mean + 0.3, 12);
      expect(comparison.mean.direction).toBe(meanDirection);
      expect(comparison.standardDeviation.setup).toBe(0.05);
      expect(comparison.standardDeviation.monteCarlo).toBe(standardDeviation);
      expect(comparison.standardDeviation.relativeChange).toBeCloseTo(
        (standardDeviation - 0.05) / 0.05,
        12,
      );
      expect(comparison.standardDeviation.direction).toBe(spreadDirection);
    },
  );

  it.each([
    [-0.3 + 0.000_049, 0.05 * (1 + 0.000_49)],
    [-0.3 - 0.000_049, 0.05 * (1 - 0.000_49)],
  ])("reports no displayed change below the comparison precision", (mean, standardDeviation) => {
    const comparison = buildMonteCarloSetupComparison({
      setup: { available: true, mean: -0.3, standardDeviation: 0.05 },
      monteCarlo: { mean, standardDeviation },
    });

    expect(comparison.available).toBe(true);
    if (!comparison.available) return;
    expect(comparison.mean.direction).toBe("same");
    expect(comparison.standardDeviation.direction).toBe("same");
  });
});