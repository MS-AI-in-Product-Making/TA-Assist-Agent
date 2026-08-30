import { describe, expect, it } from "vitest";
import {
  buildMeasurementRowMetadata,
  calculateRationalSubgroupStandardDeviation,
  rationalSubgroupConstant,
} from "./measurement-structure";

describe("rational subgroup measurement structure", () => {
  it("looks up standard d2 and c4 constants by subgroup size", () => {
    expect(rationalSubgroupConstant(5, "RANGE_D2")).toBe(2.326);
    expect(rationalSubgroupConstant(5, "S_C4")).toBe(0.94);
    expect(() => rationalSubgroupConstant(1, "RANGE_D2")).toThrowError("between 2 and 25");
  });

  it("maps rows into fixed-size subgroups and ordered sequences", () => {
    expect(buildMeasurementRowMetadata(0, "RATIONAL_SUBGROUP", 3)).toEqual({
      subgroup: "1",
      position: 1,
    });
    expect(buildMeasurementRowMetadata(4, "RATIONAL_SUBGROUP", 3)).toEqual({
      subgroup: "2",
      position: 2,
    });
    expect(buildMeasurementRowMetadata(4, "ORDERED_INDIVIDUALS", 3)).toEqual({ sequence: 5 });
    expect(buildMeasurementRowMetadata(4, "UNORDERED_SAMPLE", 3)).toEqual({});
  });

  it("estimates within-subgroup sigma using average range divided by d2", () => {
    const values = [10, 12, 14, 20, 24, 28];
    expect(calculateRationalSubgroupStandardDeviation(values, 3, "RANGE_D2"))
      .toBeCloseTo(6 / 1.693, 12);
  });

  it("estimates within-subgroup sigma using average sample s divided by c4", () => {
    const values = [10, 12, 14, 20, 24, 28];
    expect(calculateRationalSubgroupStandardDeviation(values, 3, "S_C4"))
      .toBeCloseTo(3 / 0.8862, 12);
  });

  it("rejects an incomplete final subgroup", () => {
    expect(() => calculateRationalSubgroupStandardDeviation([1, 2, 3, 4, 5], 3, "RANGE_D2"))
      .toThrowError("complete subgroups");
  });
});