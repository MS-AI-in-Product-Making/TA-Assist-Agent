import { describe, expect, it } from "vitest";
import { calculateF7Capability } from "./capability";

describe("calculateF7Capability", () => {
  it("uses a governed within-subgroup standard deviation when provided", () => {
    const result = calculateF7Capability([9, 10, 11, 12], 5, 15, 0.5);

    expect(result).toEqual({
      status: "ready",
      sampleSize: 4,
      mean: 10.5,
      sampleStandardDeviation: 0.5,
      cp: 10 / 3,
      cpk: 3,
    });
  });
});