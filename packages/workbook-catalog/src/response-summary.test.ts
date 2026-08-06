import { describe, expect, it } from "vitest";
import { extractResponseSummarySystemSpecification } from "./response-summary.js";
import type { OoxmlCell } from "./ooxml-reader.js";

function cell(reference: string, value: string, formula?: string): OoxmlCell {
  return { reference, value, ...(formula ? { formula, cachedValue: value } : {}) };
}

describe("extractResponseSummarySystemSpecification", () => {
  it("extracts only values inside Response Summary and defaults absent mean shift", () => {
    const result = extractResponseSummarySystemSpecification("TP_C_Step_TA", [
      cell("N50", "Response Summary Table"),
      cell("N54", "Lower Spec Limit"), cell("P54", "-0.15"),
      cell("N55", "Upper Spec Limit"), cell("P55", "0.05"),
      cell("N56", "Target σ Level"), cell("P56", "3", "3"),
      cell("N60", "Suggested Spec"),
      cell("N61", "Lower Spec Limit"), cell("P61", "-0.25"),
      cell("N62", "Upper Spec Limit"), cell("P62", "0.15"),
    ]);

    expect(result).toMatchObject({
      status: "available",
      lowerSpecLimit: { status: "available", actualValue: -0.15, sourceCell: "TP_C_Step_TA!P54" },
      upperSpecLimit: { status: "available", actualValue: 0.05, sourceCell: "TP_C_Step_TA!P55" },
      targetSigmaLevel: { status: "available", actualValue: 3, sourceCell: "TP_C_Step_TA!P56", valueOrigin: "formula_cached" },
      additionalMeanShift: { status: "available", actualValue: 0, valueOrigin: "defaulted" },
    });
  });

  it("supports AA columns and rows beyond 300", () => {
    const result = extractResponseSummarySystemSpecification("Analysis-A", [
      cell("AA301", "Additional Mean Shift:"), cell("AC301", "0.02"),
      cell("AA320", "Response Summary ►"),
      cell("AA321", "Lower Spec Limit*"), cell("AC321", "-1"),
      cell("AA322", "Upper Spec Limit*"), cell("AC322", "2"),
      cell("AA323", "Target Sigma Level"), cell("AC323", "4"),
    ]);

    expect(result).toMatchObject({
      status: "available",
      lowerSpecLimit: { actualValue: -1, sourceCell: "Analysis-A!AC321" },
      upperSpecLimit: { actualValue: 2, sourceCell: "Analysis-A!AC322" },
      targetSigmaLevel: { actualValue: 4, sourceCell: "Analysis-A!AC323" },
      additionalMeanShift: { actualValue: 0.02, sourceCell: "Analysis-A!AC301" },
    });
  });

  it("fails closed for ambiguous anchors, invalid values, and inverted limits", () => {
    expect(extractResponseSummarySystemSpecification("A", [cell("A1", "Response Summary"), cell("A9", "Response Summary")]))
      .toEqual({ status: "unavailable", reasonCode: "response_summary_label_ambiguous" });
    expect(extractResponseSummarySystemSpecification("A", [
      cell("A1", "Response Summary"),
      cell("A2", "Lower Spec Limit"), cell("B2", "5"),
      cell("A3", "Upper Spec Limit"), cell("B3", "1"),
      cell("A4", "Target σ Level"), cell("B4", "not-a-number"),
    ])).toMatchObject({
      status: "unavailable",
      reasonCode: "system_specification_range_invalid",
      targetSigmaLevel: { status: "unavailable", reasonCode: "response_summary_value_invalid" },
    });
  });
});