import { describe, expect, it } from "vitest";
import { buildSpecificationFallbackDisplay } from "./specification-fallback-display";

describe("buildSpecificationFallbackDisplay", () => {
  it("rounds recommended limits outward without overstating the target result", () => {
    expect(buildSpecificationFallbackDisplay({
      currentLowerSpecLimit: -0.1,
      currentUpperSpecLimit: 0.1,
      calculatedLowerSpecLimit: -0.3340004,
      calculatedUpperSpecLimit: 0.3940004,
    })).toEqual({
      lower: {
        current: "-0.1",
        recommended: "-0.334001",
        adjustment: "-0.234001",
      },
      upper: {
        current: "0.1",
        recommended: "0.394001",
        adjustment: "+0.294001",
      },
    });
  });

  it("keeps exact concise values concise", () => {
    expect(buildSpecificationFallbackDisplay({
      currentLowerSpecLimit: -0.15,
      currentUpperSpecLimit: 0.05,
      calculatedLowerSpecLimit: -0.26,
      calculatedUpperSpecLimit: 0.06,
    })).toEqual({
      lower: { current: "-0.15", recommended: "-0.26", adjustment: "-0.11" },
      upper: { current: "0.05", recommended: "0.06", adjustment: "+0.01" },
    });
  });

  it("calculates adjustments from the values shown to the user", () => {
    expect(buildSpecificationFallbackDisplay({
      currentLowerSpecLimit: -0.123456789,
      currentUpperSpecLimit: 0.123456789,
      calculatedLowerSpecLimit: -0.2345671,
      calculatedUpperSpecLimit: 0.2345671,
    })).toEqual({
      lower: { current: "-0.123457", recommended: "-0.234568", adjustment: "-0.111111" },
      upper: { current: "0.123457", recommended: "0.234568", adjustment: "+0.111111" },
    });
  });

  it("preserves exponent magnitude for very large finite limits", () => {
    expect(buildSpecificationFallbackDisplay({
      currentLowerSpecLimit: -1e300,
      currentUpperSpecLimit: 1e300,
      calculatedLowerSpecLimit: -1e300,
      calculatedUpperSpecLimit: 1e300,
    })).toEqual({
      lower: { current: "-1e300", recommended: "-1e300", adjustment: "0" },
      upper: { current: "1e300", recommended: "1e300", adjustment: "0" },
    });
  });

  it("preserves exponent-scale recommendations and reports their visible difference", () => {
    expect(buildSpecificationFallbackDisplay({
      currentLowerSpecLimit: -1.2345674e300,
      currentUpperSpecLimit: 1.2345674e300,
      calculatedLowerSpecLimit: -1.3345674e300,
      calculatedUpperSpecLimit: 1.3345674e300,
    })).toEqual({
      lower: { current: "-1.2345674e300", recommended: "-1.3345674e300", adjustment: "-1e299" },
      upper: { current: "1.2345674e300", recommended: "1.3345674e300", adjustment: "+1e299" },
    });
  });

  it("keeps maximum finite boundaries finite", () => {
    expect(buildSpecificationFallbackDisplay({
      currentLowerSpecLimit: -Number.MAX_VALUE,
      currentUpperSpecLimit: Number.MAX_VALUE,
      calculatedLowerSpecLimit: -Number.MAX_VALUE,
      calculatedUpperSpecLimit: Number.MAX_VALUE,
    })).toEqual({
      lower: {
        current: "-1.7976931348623157e308",
        recommended: "-1.7976931348623157e308",
        adjustment: "0",
      },
      upper: {
        current: "1.7976931348623157e308",
        recommended: "1.7976931348623157e308",
        adjustment: "0",
      },
    });
  });

  it("preserves near-maximum recommended limits without inward rounding", () => {
    const nearMaximum = Number.MAX_VALUE * 0.9999999;
    const result = buildSpecificationFallbackDisplay({
      currentLowerSpecLimit: -1e307,
      currentUpperSpecLimit: 1e307,
      calculatedLowerSpecLimit: -nearMaximum,
      calculatedUpperSpecLimit: nearMaximum,
    });

    expect(Number(result.lower.recommended)).toBeLessThanOrEqual(-nearMaximum);
    expect(Number(result.upper.recommended)).toBeGreaterThanOrEqual(nearMaximum);
    expect(result.lower.adjustment).not.toContain("Infinity");
    expect(result.upper.adjustment).not.toContain("Infinity");
  });

  it("preserves near-maximum values whose seventh significant digit would round inward", () => {
    const nearMaximum = 1.7976931e308;
    const result = buildSpecificationFallbackDisplay({
      currentLowerSpecLimit: -1e307,
      currentUpperSpecLimit: 1e307,
      calculatedLowerSpecLimit: -nearMaximum,
      calculatedUpperSpecLimit: nearMaximum,
    });

    expect(result.lower.recommended).toBe("-1.7976931e308");
    expect(result.upper.recommended).toBe("1.7976931e308");
  });

  it("formats an adjustment beyond the finite number range without Infinity", () => {
    const result = buildSpecificationFallbackDisplay({
      currentLowerSpecLimit: Number.MAX_VALUE,
      currentUpperSpecLimit: -Number.MAX_VALUE,
      calculatedLowerSpecLimit: -Number.MAX_VALUE,
      calculatedUpperSpecLimit: Number.MAX_VALUE,
    });

    expect(result.lower.adjustment).toBe("-3.595386e308");
    expect(result.upper.adjustment).toBe("+3.595386e308");
  });

  it("removes floating-point noise from small displayed adjustments", () => {
    const result = buildSpecificationFallbackDisplay({
      currentLowerSpecLimit: -1e-8,
      currentUpperSpecLimit: 1e-8,
      calculatedLowerSpecLimit: -3e-8,
      calculatedUpperSpecLimit: 3e-8,
    });

    expect(result.lower.adjustment).toBe("-2e-8");
    expect(result.upper.adjustment).toBe("+2e-8");
  });

  it("preserves exact large safe-integer adjustments", () => {
    const result = buildSpecificationFallbackDisplay({
      currentLowerSpecLimit: 0,
      currentUpperSpecLimit: 0,
      calculatedLowerSpecLimit: 0,
      calculatedUpperSpecLimit: 1234567890123456,
    });

    expect(result.upper.adjustment).toBe("+1234567890123456");
  });
});
