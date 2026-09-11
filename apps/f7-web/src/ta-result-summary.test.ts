import { describe, expect, it } from "vitest";
import { buildTaOverallAssessment, buildTaResultSummary } from "./ta-result-summary";

describe("buildTaResultSummary", () => {
  it("builds a fact-first Fail assessment and identifies the insufficient upper side", () => {
    const assessment = buildTaOverallAssessment({
      designNominal: 0,
      mean: 0.03,
      standardDeviation: 0.05,
      lowerSpecLimit: -0.1,
      upperSpecLimit: 0.1,
      cp: 0.62,
      cpk: 0.16,
      lowerCpk: 1.09,
      upperCpk: 0.16,
      targetCpk: 1,
      governedCpkDisplay: {
        result: "0.16",
        target: "1",
        difference: "-0.84",
        status: "below-target",
      },
    });

    expect(assessment).toBe("Fail. Mean shifted high. Standard deviation is too high. Cpk 0.16 is below target 1. Upper-side capability is insufficient (Upper Cpk 0.16).");
  });

  it("builds a concise Pass assessment when all comparisons meet target", () => {
    const assessment = buildTaOverallAssessment({
      designNominal: 0,
      mean: 0,
      standardDeviation: 0.02,
      lowerSpecLimit: -0.1,
      upperSpecLimit: 0.1,
      cp: 1.5,
      cpk: 1.5,
      lowerCpk: 1.5,
      upperCpk: 1.5,
      targetCpk: 1.33,
      governedCpkDisplay: {
        result: "1.5",
        target: "1.33",
        difference: "+0.17",
        status: "meets-target",
      },
    });

    expect(assessment).toBe("Pass. Mean is centered. Standard deviation is within target. Cpk 1.5 meets target 1.33. Lower- and upper-side capability meet target.");
  });

  it("identifies lower-only and both-side capability shortfalls", () => {
    const input = {
      designNominal: 0,
      mean: -0.03,
      standardDeviation: 0.05,
      lowerSpecLimit: -0.1,
      upperSpecLimit: 0.1,
      cp: 0.62,
      cpk: 0.16,
      lowerCpk: 0.16,
      upperCpk: 1.09,
      targetCpk: 1,
      governedCpkDisplay: {
        result: "0.16",
        target: "1",
        difference: "-0.84",
        status: "below-target" as const,
      },
    };

    expect(buildTaOverallAssessment(input)).toContain("Lower-side capability is insufficient (Lower Cpk 0.16).");
    expect(buildTaOverallAssessment({
      ...input,
      lowerCpk: 0.16,
      upperCpk: 0.62,
    })).toContain("Lower- and upper-side capabilities are insufficient (Lower Cpk 0.16; Upper Cpk 0.62).");
  });

  it("builds the governed engineering comparison rows in display order", () => {
    const rows = buildTaResultSummary({
      designNominal: 0,
      mean: 0.03,
      standardDeviation: 0.05,
      lowerSpecLimit: -0.1,
      upperSpecLimit: 0.1,
      cp: 0.6666666667,
      cpk: 0.4666666667,
      lowerCpk: 0.8666666667,
      upperCpk: 0.4666666667,
      targetCpk: 1.33,
      governedCpkDisplay: {
        result: "0.4666666667",
        target: "1.3300000000",
        difference: "-0.8633333333",
        status: "below-target",
      },
    });

    expect(rows.map((row) => row.key)).toEqual([
      "mean",
      "standard-deviation",
      "cp",
      "cpk",
      "lower-cpk",
      "upper-cpk",
    ]);
    expect(rows[0]).toMatchObject({
      metric: "Mean",
      reference: "Nominal 0",
      referenceDetail: "System Design Nominal",
      difference: "+0.03",
      assessment: "Shifted high",
      performanceContext: "15% of specification span · shifted high",
      tone: "warning",
    });
    expect(rows[1]).toMatchObject({
      metric: "Standard Deviation",
      result: "0.05",
      reference: "Max 0.02 at target",
      referenceDetail: "Derived from nearest specification limit and target Cpk",
      difference: "+0.03",
      assessment: "Too high",
      performanceContext: "285% of maximum · 185% over",
      tone: "fail",
    });
    expect(rows[2]).toMatchObject({
      metric: "Cp",
      assessment: "Below target",
      performanceContext: "50.13% of target · 49.87% shortfall",
    });
    expect(rows[2]?.reference).toContain("Target 1.33");
    expect(rows[2]?.difference).toMatch(/^-/);
    expect(rows[3]).toMatchObject({
      metric: "Cpk",
      result: "0.4666666667",
      reference: "Target 1.3300000000",
      difference: "-0.8633333333",
      assessment: "Below target",
      performanceContext: "35.09% of target · 64.91% shortfall",
      tone: "fail",
    });
    expect(rows[4]).toMatchObject({
      kind: "comparison",
      metric: "Lower Cpk",
      result: "0.87",
      reference: "Target 1.33",
      difference: "-0.46",
      assessment: "Below target",
      performanceContext: "65.16% of target · 34.84% shortfall",
      tone: "fail",
    });
    expect(rows[5]).toMatchObject({
      kind: "comparison",
      metric: "Upper Cpk",
      result: "0.47",
      reference: "Target 1.33",
      difference: "-0.86",
      assessment: "Below target",
      performanceContext: "35.09% of target · 64.91% shortfall",
      tone: "fail",
    });
    expect(rows.slice(0, 6).every((row) => row.kind === "comparison")).toBe(true);
    expect(rows).toHaveLength(6);
  });

  it("identifies a centered mean and keeps signed near-zero capability margins", () => {
    const rows = buildTaResultSummary({
      designNominal: 0,
      mean: 0,
      standardDeviation: 0.02,
      lowerSpecLimit: -0.1,
      upperSpecLimit: 0.1,
      cp: 1.3300001,
      cpk: 1.3299999,
      lowerCpk: 1.3299999,
      upperCpk: 1.3300001,
      targetCpk: 1.33,
      governedCpkDisplay: {
        result: "1.3299999",
        target: "1.3300000",
        difference: "-0.0000001",
        status: "below-target",
      },
    });

    expect(rows[0]).toMatchObject({
      difference: "0",
      assessment: "Centered",
      performanceContext: "Centered on nominal",
    });
    expect(rows[2]?.difference).toMatch(/^\+/);
    expect(rows[3]?.difference).toMatch(/^-/);
    expect(rows[3]).toMatchObject({
      result: "1.3299999",
      reference: "Target 1.3300000",
      difference: "-0.0000001",
    });
    expect(rows[4]?.difference).toMatch(/^-/);
    expect(rows[5]?.difference).toMatch(/^\+/);
    expect(rows[4]?.performanceContext).toContain("shortfall");
    expect(rows[5]?.performanceContext).toContain("surplus");
  });

  it("derives the standard deviation limit from the nearest specification side and target Cpk", () => {
    const rows = buildTaResultSummary({
      designNominal: 0,
      mean: 0.03,
      standardDeviation: 0.03,
      lowerSpecLimit: -0.03,
      upperSpecLimit: 0.12,
      cp: 1,
      cpk: 0.8,
      lowerCpk: 0.8,
      upperCpk: 1.2,
      targetCpk: 2,
      governedCpkDisplay: {
        result: "0.8",
        target: "2",
        difference: "-1.2",
        status: "below-target",
      },
    });

    expect(rows[1]).toMatchObject({
      reference: "Max 0.01 at target",
      difference: "+0.02",
      assessment: "Too high",
    });
  });

  it("describes remaining sigma margin and exact capability target without extra grading", () => {
    const rows = buildTaResultSummary({
      designNominal: 0,
      mean: 0,
      standardDeviation: 0.02,
      lowerSpecLimit: -0.12,
      upperSpecLimit: 0.12,
      cp: 1,
      cpk: 1,
      lowerCpk: 1,
      upperCpk: 1,
      targetCpk: 1,
      governedCpkDisplay: {
        result: "1",
        target: "1",
        difference: "0",
        status: "meets-target",
      },
    });

    expect(rows[1]?.performanceContext).toBe("50% of maximum · 50% margin");
    for (const row of rows.slice(2, 6)) {
      expect(row.performanceContext).toBe("100% of target");
    }
  });

  it("uses the governed Cpk status for assessment instead of recomputing it", () => {
    const rows = buildTaResultSummary({
      designNominal: 0,
      mean: 0,
      standardDeviation: 0.02,
      lowerSpecLimit: -0.1,
      upperSpecLimit: 0.1,
      cp: 1.5,
      cpk: 1.34,
      lowerCpk: 1.34,
      upperCpk: 1.5,
      targetCpk: 1.33,
      governedCpkDisplay: {
        result: "1.34",
        target: "1.33",
        difference: "+0.01",
        status: "below-target",
      },
    });

    expect(rows[3]).toMatchObject({ assessment: "Below target", tone: "fail" });
  });

  it("does not calculate a sigma percentage when the target allowance is not positive", () => {
    const rows = buildTaResultSummary({
      designNominal: 0,
      mean: 0.2,
      standardDeviation: 0.02,
      lowerSpecLimit: -0.1,
      upperSpecLimit: 0.1,
      cp: 1,
      cpk: -1,
      lowerCpk: 1,
      upperCpk: -1,
      targetCpk: 1,
      governedCpkDisplay: {
        result: "-1",
        target: "1",
        difference: "-2",
        status: "below-target",
      },
    });

    expect(rows[1]?.performanceContext).toBe("No positive allowance at target");
  });
});