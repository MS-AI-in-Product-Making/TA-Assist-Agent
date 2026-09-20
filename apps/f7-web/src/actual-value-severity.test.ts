import { describe, expect, it } from "vitest";
import {
  classifyActualValueSeverity,
  classifyDistributionSeverity,
} from "./actual-value-severity";

describe("classifyActualValueSeverity", () => {
  it("keeps the 5% boundary normal and the 15% boundary at attention", () => {
    expect(classifyActualValueSeverity({ metric: "oneSigma", setup: 100, actual: 105 })).toEqual({
      severity: "normal",
      adversePercentage: 5,
    });
    expect(classifyActualValueSeverity({ metric: "oneSigma", setup: 100, actual: 105.01 })?.severity).toBe("attention");
    expect(classifyActualValueSeverity({ metric: "oneSigma", setup: 100, actual: 115 })).toEqual({
      severity: "attention",
      adversePercentage: 15,
    });
    expect(classifyActualValueSeverity({ metric: "oneSigma", setup: 100, actual: 115.01 })?.severity).toBe("critical");
  });

  it("uses risk direction for spread, Cp, Cpk, and contribution metrics", () => {
    expect(classifyActualValueSeverity({ metric: "tolerance", setup: 1, actual: 0.7 })?.severity).toBe("normal");
    expect(classifyActualValueSeverity({ metric: "oneSigma", setup: 1, actual: 1.1 })?.severity).toBe("attention");
    expect(classifyActualValueSeverity({ metric: "cp", setup: 1.33, actual: 1.5 })?.severity).toBe("normal");
    expect(classifyActualValueSeverity({ metric: "cp", setup: 1.33, actual: 1 })?.severity).toBe("critical");
    expect(classifyActualValueSeverity({ metric: "cpk", setup: 1.33, actual: 1.5 })?.severity).toBe("normal");
    expect(classifyActualValueSeverity({ metric: "cpk", setup: 1.33, actual: 1 })?.severity).toBe("critical");
    expect(classifyActualValueSeverity({ metric: "contribution", setup: 0.25, actual: 0.2 })?.severity).toBe("normal");
    expect(classifyActualValueSeverity({ metric: "contribution", setup: 0.25, actual: 0.275 })?.severity).toBe("attention");
  });

  it("compares Mean by absolute magnitude and falls back to Setup tolerance for a zero Mean", () => {
    expect(classifyActualValueSeverity({ metric: "mean", setup: -0.57, actual: 0.5767 })?.severity).toBe("normal");
    expect(classifyActualValueSeverity({ metric: "mean", setup: 0, actual: 0.01, normalizationFallback: 0.1 })).toEqual({
      severity: "attention",
      adversePercentage: 10,
    });
  });

  it("fails closed for a nonzero difference without a usable normalization baseline", () => {
    expect(classifyActualValueSeverity({ metric: "mean", setup: 0, actual: 0 })).toEqual({
      severity: "normal",
      adversePercentage: 0,
    });
    expect(classifyActualValueSeverity({ metric: "mean", setup: 0, actual: 0.01 })).toEqual({
      severity: "critical",
      adversePercentage: undefined,
    });
  });

  it("returns no severity when the Actual value is unavailable", () => {
    expect(classifyActualValueSeverity({ metric: "cpk", setup: 1.33, actual: undefined })).toBeUndefined();
  });
});

describe("classifyDistributionSeverity", () => {
  it("treats matching families as normal and mismatches as critical", () => {
    expect(classifyDistributionSeverity("Normal", "normal")).toEqual({
      severity: "normal",
      adversePercentage: 0,
    });
    expect(classifyDistributionSeverity("Normal", "gamma")).toEqual({
      severity: "critical",
      adversePercentage: undefined,
    });
    expect(classifyDistributionSeverity("Normal", undefined)).toBeUndefined();
  });
});
