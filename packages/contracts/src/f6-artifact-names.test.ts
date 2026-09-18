import { describe, expect, it } from "vitest";

import { createF6ReportFileNames } from "./f6-artifact-names.js";

describe("createF6ReportFileNames", () => {
  it("preserves the validated workbook basename in report names", () => {
    expect(createF6ReportFileNames("Meara TP TA_20241030-v0 - test0918.xlsx")).toEqual({
      finalReportMdName: "Meara TP TA_20241030-v0 - test0918 - TA ENGINEERING ANALYSIS REPORT.md",
      finalReportPdfName: "Meara TP TA_20241030-v0 - test0918 - TA ENGINEERING ANALYSIS REPORT.pdf",
    });
  });

  it("accepts an uppercase xlsx extension", () => {
    expect(createF6ReportFileNames("Analysis.XLSX")).toEqual({
      finalReportMdName: "Analysis - TA ENGINEERING ANALYSIS REPORT.md",
      finalReportPdfName: "Analysis - TA ENGINEERING ANALYSIS REPORT.pdf",
    });
  });

  it.each(["../escape.xlsx", "CON.xlsx", "name.txt", "name.xlsx "])(
    "rejects unsafe workbook identity %s",
    (fileName) => expect(() => createF6ReportFileNames(fileName)).toThrow(),
  );

  it("rejects report names that exceed the Windows filename limit", () => {
    expect(() => createF6ReportFileNames(`${"a".repeat(220)}.xlsx`)).toThrow(/too long/i);
  });
});
