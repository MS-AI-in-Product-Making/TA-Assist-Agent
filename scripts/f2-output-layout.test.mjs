import { describe, expect, it } from "vitest";
import { resolveFeature2OutputLayout } from "./f2-output-layout.mjs";

describe("resolveFeature2OutputLayout", () => {
  it("isolates one sanitized workbook in fixed Feature 2 output", () => {
    expect(resolveFeature2OutputLayout(["test/Demo Workbook.xlsx"])).toEqual({
      outRoot: "test/demo-output/feature2-output/Demo-Workbook",
      reportJsonName: "Feature2-Report.json",
      reportMdName: "Feature2-Report.md",
    });
    expect(resolveFeature2OutputLayout(["test/A:B.xlsx"]).outRoot).toContain("A-B");
  });

  it("requires exactly one nonempty workbook name", () => {
    expect(() => resolveFeature2OutputLayout([])).toThrow("exactly one workbook path");
    expect(() => resolveFeature2OutputLayout(["a.xlsx", "b.xlsx"])).toThrow("exactly one workbook path");
    expect(() => resolveFeature2OutputLayout([".xlsx"])).toThrow("output name is empty");
  });
});