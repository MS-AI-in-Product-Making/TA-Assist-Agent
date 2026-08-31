import { describe, expect, it } from "vitest";
import { buildCapabilityComparison } from "./capability-comparison";

describe("buildCapabilityComparison", () => {
  it("compares measured capability with the physical Factor Setup assumption", () => {
    const comparison = buildCapabilityComparison({
      measured: {
        mean: 10.2,
        standardDeviation: 0.5,
        cp: 2,
        cpk: 1.8,
      },
      setup: {
        signedMean: -10,
        standardDeviation: 0.4,
      },
      lowerSpecLimit: 7,
      upperSpecLimit: 13,
    });

    expect(comparison.mean).toEqual({ setup: 10, measured: 10.2, delta: 0.2, relativeChange: 0.02 });
    expect(comparison.standardDeviation).toEqual({
      setup: 0.4,
      measured: 0.5,
      delta: 0.1,
      ratio: 1.25,
      relativeChange: 0.25,
      assessment: "worse",
    });
    expect(comparison.cp.setup).toBeCloseTo(2.5, 12);
    expect(comparison.cp.delta).toBeCloseTo(-0.5, 12);
    expect(comparison.cp.assessment).toBe("worse");
    expect(comparison.cpk.setup).toBeCloseTo(2.5, 12);
    expect(comparison.cpk.delta).toBeCloseTo(-0.7, 12);
    expect(comparison.cpk.assessment).toBe("worse");
  });
});