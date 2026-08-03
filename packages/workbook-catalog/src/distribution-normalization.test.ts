import { describe, expect, it } from "vitest";
import { normalizeDistribution } from "./distribution-normalization.js";

describe("distribution normalization", () => {
  it.each([
    ["Normal", "normal"],
    [" gaussian ", "normal"],
    ["正态分布", "normal"],
    ["均匀分布", "uniform"],
    ["三角分布", "triangular"],
    ["梯形分布", "trapezoidal"],
    ["椭圆分布", "elliptical"],
    ["贝塔分布", "beta"],
  ] as const)("normalizes %s", (input, expected) => {
    expect(normalizeDistribution(input)).toBe(expected);
  });

  it("returns undefined for absent or uncontrolled values", () => {
    expect(normalizeDistribution(undefined)).toBeUndefined();
    expect(normalizeDistribution("unknown distribution")).toBeUndefined();
  });
});