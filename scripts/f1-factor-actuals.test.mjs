import { describe, expect, it } from "vitest";
import { extractFactorActualFields } from "./f1-factor-actuals.mjs";

describe("extractFactorActualFields", () => {
  it("extracts E:T actual values without display text", () => {
    const sheet = {
      E14: { t: "s", v: "factor", w: "FACTOR DISPLAY" },
      F14: { t: "s", v: "part", w: "PART DISPLAY" },
      G14: { t: "s", v: "DWG-1" },
      H14: { t: "s", v: "DIM-1" },
      I14: { t: "s", v: "CNC" },
      J14: { t: "n", v: 1.25, w: "1.250" },
      K14: { t: "n", v: 0.1, w: "0.100" },
      L14: { t: "n", v: -0.1, w: "-0.100" },
      M14: { t: "n", v: 1, w: "1.0" },
      N14: { t: "n", v: 4, w: "4.0" },
      O14: { t: "s", v: "Normal" },
      P14: { t: "n", f: "=SUM(A1:A2)", v: 1.2, w: "1.200" },
      Q14: { t: "n", v: 0.1, w: "0.100" },
      R14: { t: "n", v: 0.025, w: "0.025" },
      S14: { t: "n", v: 0.52710843373494, w: "52.7%" },
      T14: { t: "s", v: "review" },
    };

    expect(extractFactorActualFields(sheet, 14)).toEqual({
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

  it("returns null for missing, error, blank, and non-finite values", () => {
    expect(extractFactorActualFields({
      E2: { t: "e", v: 15, w: "#VALUE!" },
      F2: { t: "s", v: "   " },
      J2: { t: "n", v: Number.POSITIVE_INFINITY },
    }, 2)).toEqual({
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

  it("normalizes numeric actual values to Excel precision", () => {
    expect(extractFactorActualFields({ J3: { t: "n", v: 1.6500000000000001, w: "1.650" } }, 3).nominalValue)
      .toBe(1.65);
  });
});
