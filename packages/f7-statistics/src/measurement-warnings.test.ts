import { describe, expect, expectTypeOf, it } from "vitest";
import type { FactorMeasurementWarningObservation } from "./measurement-warnings";
import {
  evaluateFactorMeasurementWarnings,
  hasFactorMeasurementWarning,
} from "./measurement-warnings";

describe("factor measurement warning evidence", () => {
  it("uses the shared observation disposition contract", () => {
    expectTypeOf<FactorMeasurementWarningObservation["disposition"]>()
      .toEqualTypeOf<"included" | "excluded">();
  });

  it("reports cross-zero specifications and included out-of-spec values", () => {
    const evidence = evaluateFactorMeasurementWarnings({
      lowerSpecLimit: -0.2,
      upperSpecLimit: 0.8,
      observations: [
        { value: -0.3, disposition: "included" },
        { value: 0.4, disposition: "included" },
        { value: 1.2, disposition: "excluded" },
      ],
    });

    expect(evidence).toEqual({
      crossesZero: true,
      outOfSpecCount: 1,
      candidateOutlierCount: 0,
    });
    expect(hasFactorMeasurementWarning(evidence)).toBe(true);
  });

  it("reports candidate outliers from included observations", () => {
    const values = [...Array.from({ length: 30 }, (_, index) => 10 + (index % 5) * 0.1), 100];
    const evidence = evaluateFactorMeasurementWarnings({
      lowerSpecLimit: 1,
      upperSpecLimit: 200,
      observations: values.map((value) => ({ value, disposition: "included" })),
    });

    expect(evidence).toEqual({
      crossesZero: false,
      outOfSpecCount: 0,
      candidateOutlierCount: 1,
    });
    expect(hasFactorMeasurementWarning(evidence)).toBe(true);
  });

  it("does not warn when no criterion is present", () => {
    const evidence = evaluateFactorMeasurementWarnings({
      lowerSpecLimit: 0.1,
      upperSpecLimit: 0.8,
      observations: [
        { value: 0.1, disposition: "included" },
        { value: 0.8, disposition: "included" },
      ],
    });

    expect(evidence).toEqual({
      crossesZero: false,
      outOfSpecCount: 0,
      candidateOutlierCount: 0,
    });
    expect(hasFactorMeasurementWarning(evidence)).toBe(false);
  });
});