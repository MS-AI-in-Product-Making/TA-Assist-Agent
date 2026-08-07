import { describe, expect, it } from "vitest";
import { resolveFeature4OutputLayout } from "./f4-output-layout.mjs";

describe("resolveFeature4OutputLayout", () => {
  const fixedNow = () => new Date("2026-08-07T12:34:56.789Z");

  it("parses required --f2-report and builds deterministic default layout", () => {
    expect(resolveFeature4OutputLayout([
      "--f2-report",
      "test/demo-output/f2-runs/Demo/Feature2-Report.json",
    ], undefined, fixedNow)).toEqual({
      runId: "2026-08-07T12-34-56-789Z",
      f2ReportPath: "test/demo-output/f2-runs/Demo/Feature2-Report.json",
      workbookPath: undefined,
      runRoot: "test/demo-output/f4-runs/Feature2-Report/2026-08-07T12-34-56-789Z",
      calculationJsonName: "Feature4-Calculation.json",
      reportMdName: "Feature4-Report.md",
      comparisonJsonName: "Feature4-Comparison.json",
      manifestName: "manifest.json",
      validationDirName: "validation",
    });
  });

  it("uses workbook stem when optional --workbook exists", () => {
    const layout = resolveFeature4OutputLayout([
      "--f2-report",
      "outputs/Feature2-Report.json",
      "--workbook",
      "input/Demo Workbook.xlsx",
    ], undefined, fixedNow);

    expect(layout.workbookPath).toBe("input/Demo Workbook.xlsx");
    expect(layout.runRoot).toBe("test/demo-output/f4-runs/Demo-Workbook/2026-08-07T12-34-56-789Z");
  });

  it("accepts a safe explicit output root override", () => {
    const layout = resolveFeature4OutputLayout([
      "--f2-report",
      "outputs/Feature2-Report.json",
    ], "runs/demo/f4", fixedNow);

    expect(layout.runRoot).toBe("runs/demo/f4/2026-08-07T12-34-56-789Z");
  });

  it.each(["", "runs/../shared", "../outside"])('rejects unsafe output root override "%s"', (outputRoot) => {
    expect(() => resolveFeature4OutputLayout([
      "--f2-report",
      "outputs/Feature2-Report.json",
    ], outputRoot, fixedNow)).toThrow(/output root/i);
  });

  it.each([
    [[]],
    [["--workbook", "Demo.xlsx"]],
    [["Feature2-Report.json"]],
    [["--f2-report"]],
    [["--f2-report", "--workbook", "Demo.xlsx"]],
  ])("rejects missing or partial required arguments: %j", (args) => {
    const assertion = args[0] === "Feature2-Report.json" ? undefined : /f2-report/i;
    expect(() => resolveFeature4OutputLayout(args, undefined, fixedNow)).toThrow(assertion);
  });

  it.each([
    [["--f2-report", "a/Feature2-Report.json", "--worksheet", "Analysis-A"]],
    [["--f2-report", "a/Feature2-Report.json", "--unknown", "x"]],
    [["--f2-report", "a/Feature2-Report.json", "--f2-report", "b/Feature2-Report.json"]],
    [["--f2-report", "a/Feature2-Report.json", "--workbook", "a.xlsx", "--workbook", "b.xlsx"]],
    [["--f2-report", "a/Feature2-Report.json", "--workbook"]],
    [["--f2-report", "a/Feature2-Report.json", "--workbook", "--f2-report"]],
    [["--f2-report", "a/Feature2-Report.json", "extra"]],
  ])("rejects invalid option combinations: %j", (args) => {
    expect(() => resolveFeature4OutputLayout(args, undefined, fixedNow)).toThrow();
  });

  it.each([
    [["--f2-report", "a/report.json"]],
    [["--f2-report", "a/Feature2-Report.md"]],
    [["--f2-report", "a/Feature2-Report.JSON"]],
  ])("rejects nonmatching --f2-report extensions or filename: %j", (args) => {
    expect(() => resolveFeature4OutputLayout(args, undefined, fixedNow)).toThrow(/Feature2-Report\.json/);
  });

  it.each([
    [["--f2-report", "a/Feature2-Report.json", "--workbook", "a.xlsm"]],
    [["--f2-report", "a/Feature2-Report.json", "--workbook", "a.csv"]],
    [["--f2-report", "a/Feature2-Report.json", "--workbook", "a"]],
  ])("rejects nonmatching --workbook extension: %j", (args) => {
    expect(() => resolveFeature4OutputLayout(args, undefined, fixedNow)).toThrow(/\.xlsx/);
  });
});
