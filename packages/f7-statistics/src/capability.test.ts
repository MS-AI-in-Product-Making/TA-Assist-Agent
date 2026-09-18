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

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects an invalid governed standard deviation of %s",
    (governedStandardDeviation) => {
      expect(() => calculateF7Capability(
        [9, 10, 11, 12],
        5,
        15,
        governedStandardDeviation,
      )).toThrowError(new RangeError("Governed standard deviation must be finite and greater than zero."));
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects a non-finite specification limit of %s",
    (limit) => {
      expect(() => calculateF7Capability([9, 10, 11, 12], limit, 15))
        .toThrowError(new RangeError("Specification limits must be finite."));
      expect(() => calculateF7Capability([9, 10, 11, 12], 5, limit))
        .toThrowError(new RangeError("Specification limits must be finite."));
    },
  );

  it("never returns ready when extreme finite inputs overflow capability calculations", () => {
    const result = calculateF7Capability(
      [-Number.MAX_VALUE, Number.MAX_VALUE],
      -Number.MAX_VALUE,
      Number.MAX_VALUE,
    );

    expect(result.status).not.toBe("ready");
  });
});