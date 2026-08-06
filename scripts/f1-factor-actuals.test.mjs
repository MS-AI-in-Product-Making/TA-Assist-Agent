import { describe, expect, it } from "vitest";
import { projectFactorActualFields } from "./f1-factor-actuals.mjs";

describe("projectFactorActualFields", () => {
  it("projects actual values by semantic field regardless of source columns", () => {
    const values = {
      factorName: "factor", partName: "part", drawingNumber: "DWG-1", dimCharacteristicId: "DIM-1",
      partCategory: "CNC", nominalValue: 1.25, upperTolerance: 0.1, lowerTolerance: -0.1,
      longTermSafetyFactor: 1, standardDeviation: 4, distribution: "Normal", mean: 1.2,
      tolerance: 0.1, oneSigma: 0.025, percentContributionToSigma: 0.52710843373494, notes: "review",
    };
    const fields = Object.fromEntries(Object.entries(values).map(([name, actualValue], offset) => [name, {
      status: "available",
      sourceCell: `Analysis-A!${String.fromCharCode(71 + offset)}14`,
      displayValue: String(actualValue),
      actualValue,
      valueOrigin: "numeric_literal",
    }]));

    expect(projectFactorActualFields(fields)).toEqual({
      factorName: "factor",
      partName: "part",
      drawingNumber: "DWG-1",
      dimCharacteristicId: "DIM-1",
      partCategory: "CNC",
      nominalValue: 1.25,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      longTermSafetyFactor: 1,
      sigmaLevel: 4,
      distribution: "Normal",
      mean: 1.2,
      tolerance: 0.1,
      oneSigma: 0.025,
      percentContributionToSigma: 0.52710843373494,
      notes: "review",
    });
  });

  it("returns null for unavailable or absent semantic fields", () => {
    expect(projectFactorActualFields({ factorName: { status: "unavailable", reasonCode: "missing" } })).toEqual({
      factorName: null,
      partName: null,
      drawingNumber: null,
      dimCharacteristicId: null,
      partCategory: null,
      nominalValue: null,
      upperTolerance: null,
      lowerTolerance: null,
      longTermSafetyFactor: null,
      sigmaLevel: null,
      distribution: null,
      mean: null,
      tolerance: null,
      oneSigma: null,
      percentContributionToSigma: null,
      notes: null,
    });
  });

});
