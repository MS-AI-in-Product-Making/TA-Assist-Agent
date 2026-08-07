import { describe, expect, it } from "vitest";
import { withSystemSpecificationDisplayValues } from "./f1-system-specification-display.mjs";

describe("Feature 1 system specification display values", () => {
  it("uses Excel display text without changing actual evidence", () => {
    const specification = {
      status: "available",
      lowerSpecLimit: { status: "available", actualValue: 0.178, displayValue: "0.17799999999999999", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Shim_TA_3-Sigma!P54", valueOrigin: "numeric_literal" },
      upperSpecLimit: { status: "available", actualValue: 1.1, displayValue: "1.1000000000000001", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Shim_TA_3-Sigma!P55", valueOrigin: "numeric_literal" },
      targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3", sourceLabel: "*Target σ Level ►", sourceCell: "Shim_TA_3-Sigma!P56", valueOrigin: "formula_cached" },
      additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
    };
    const worksheetSheet = {
      P54: { t: "n", v: 0.178, w: "0.178" },
      P55: { t: "n", v: 1.1, w: "1.1" },
      P56: { t: "n", v: 3, w: "3.0σ" },
    };

    const result = withSystemSpecificationDisplayValues(specification, worksheetSheet);

    expect(result.lowerSpecLimit).toEqual({ ...specification.lowerSpecLimit, displayValue: "0.178" });
    expect(result.upperSpecLimit).toEqual({ ...specification.upperSpecLimit, displayValue: "1.1" });
    expect(result.targetSigmaLevel).toEqual({ ...specification.targetSigmaLevel, displayValue: "3.0σ" });
    expect(result.additionalMeanShift).toBe(specification.additionalMeanShift);
    expect(specification.lowerSpecLimit.displayValue).toBe("0.17799999999999999");
  });

  it("preserves unavailable evidence and missing worksheet cells", () => {
    const specification = {
      status: "unavailable",
      reasonCode: "system_specification_range_invalid",
      lowerSpecLimit: { status: "unavailable", reasonCode: "response_summary_value_missing", sourceCell: "Study (2)!P54" },
      upperSpecLimit: { status: "available", actualValue: 1.1, displayValue: "1.1000000000000001", sourceLabel: "USL", sourceCell: "Study (2)!P55", valueOrigin: "numeric_literal" },
    };

    const result = withSystemSpecificationDisplayValues(specification, {});

    expect(result).toEqual(specification);
    expect(result.lowerSpecLimit).toBe(specification.lowerSpecLimit);
    expect(result.upperSpecLimit).toBe(specification.upperSpecLimit);
  });
});