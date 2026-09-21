import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveFeature4OutputLayout } from "./f4-output-layout.mjs";

const cleanupRoots = [];

function createAnalysisWorkspaceRoot() {
  const analysisRoot = mkdtempSync(path.join(tmpdir(), "f4-layout-workspace-"));
  cleanupRoots.push(analysisRoot);
  const stagePaths = {
    f1: path.join(analysisRoot, "01 - F1 Data Parsing"),
    f2: path.join(analysisRoot, "02 - F2 Data Cleaning"),
    f3: path.join(analysisRoot, "03 - F3 Drawing Governance"),
    f4: path.join(analysisRoot, "04 - F4 Calculation Engine"),
    f5: path.join(analysisRoot, "05 - F5 Result Interpretation"),
    f6: path.join(analysisRoot, "06 - F6 Design Optimization"),
  };
  for (const stagePath of Object.values(stagePaths)) mkdirSync(stagePath, { recursive: true });
  writeFileSync(path.join(analysisRoot, "analysis-run-summary.json"), JSON.stringify({
    contractVersion: "analysis-workspace-v1",
    analysisRoot,
    summaryPath: path.join(analysisRoot, "analysis-run-summary.json"),
    workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64) },
    allocationDate: "20260921",
    currentStage: "f1",
    stageDirectories: {
      f1: "01 - F1 Data Parsing",
      f2: "02 - F2 Data Cleaning",
      f3: "03 - F3 Drawing Governance",
      f4: "04 - F4 Calculation Engine",
      f5: "05 - F5 Result Interpretation",
      f6: "06 - F6 Design Optimization",
    },
    stages: {
      f1: { status: "pending", artifacts: {} },
      f2: { status: "pending", artifacts: {} },
      f3: { status: "pending", artifacts: {} },
      f4: { status: "pending", artifacts: {} },
      f5: { status: "pending", artifacts: {} },
      f6: { status: "pending", artifacts: {} },
    },
    overallStatus: "in_progress",
  }, null, 2));
  return { analysisRoot, stagePaths };
}

afterEach(() => {
  for (const root of cleanupRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("resolveFeature4OutputLayout", () => {
  const fixedNow = () => new Date("2026-08-07T12:34:56.789Z");

  it("routes the canonical workspace F2 report directly into the fixed F4 stage", () => {
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot();
    expect(resolveFeature4OutputLayout([
      "--f2-report",
      path.join(stagePaths.f2, "Feature2-Report.json"),
      "--analysis-root",
      analysisRoot,
    ], undefined, fixedNow)).toEqual({
      runId: "2026-08-07T12-34-56-789Z",
      f2ReportPath: path.join(stagePaths.f2, "Feature2-Report.json"),
      workbookPath: undefined,
      runRoot: stagePaths.f4,
      calculationJsonName: "Feature4-Calculation.json",
      reportMdName: "Feature4-Report.md",
      comparisonJsonName: "Feature4-Comparison.json",
      manifestName: "manifest.json",
      validationDirName: "validation",
      allowExistingRunRoot: true,
    });
  });

  it("does not treat lookalike stage names as a validated workspace", () => {
    const { analysisRoot } = createAnalysisWorkspaceRoot();
    const lookalikeRoot = mkdtempSync(path.join(tmpdir(), "f4-layout-lookalike-"));
    cleanupRoots.push(lookalikeRoot);
    const lookalikeReport = path.join(lookalikeRoot, "02 - F2 Data Cleaning", "Feature2-Report.json");
    mkdirSync(path.dirname(lookalikeReport), { recursive: true });
    writeFileSync(lookalikeReport, "{}");

    expect(resolveFeature4OutputLayout(["--f2-report", lookalikeReport], undefined, fixedNow).runRoot)
      .toContain("test/demo-output/f4-runs");
    expect(() => resolveFeature4OutputLayout([
      "--f2-report", lookalikeReport,
      "--analysis-root", analysisRoot,
    ], undefined, fixedNow)).toThrow(/exact validated F2 report path/i);
  });

  it("parses required --f2-report and builds deterministic default layout", () => {
    expect(resolveFeature4OutputLayout([
      "--f2-report",
      "test/demo-output/f2-runs/Demo/Feature2-Report.json",
    ], undefined, fixedNow)).toEqual({
      runId: "2026-08-07T12-34-56-789Z",
      f2ReportPath: "test/demo-output/f2-runs/Demo/Feature2-Report.json",
      workbookPath: undefined,
      runRoot: "test/demo-output/f4-runs/Demo/2026-08-07T12-34-56-789Z",
      calculationJsonName: "Feature4-Calculation.json",
      reportMdName: "Feature4-Report.md",
      comparisonJsonName: "Feature4-Comparison.json",
      manifestName: "manifest.json",
      validationDirName: "validation",
      allowExistingRunRoot: false,
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
    expect(layout.allowExistingRunRoot).toBe(false);
  });

  it.each([
    [["--f2-report", "a/Feature2-Report.json", "--analysis-root"]],
    [["--f2-report", "a/Feature2-Report.json", "--analysis-root", ""]],
    [["--f2-report", "a/Feature2-Report.json", "--analysis-root", "--workbook"]],
    [["--f2-report", "a/Feature2-Report.json", "--analysis-root", "root-a", "--analysis-root", "root-b"]],
  ])("rejects invalid --analysis-root forms: %j", (args) => {
    expect(() => resolveFeature4OutputLayout(args, undefined, fixedNow)).toThrow(/analysis workspace root|duplicated|missing/i);
  });

  it("derives deterministic run stem from f2 report parent for absolute paths", () => {
    const layout = resolveFeature4OutputLayout([
      "--f2-report",
      "C:/runs/F2 Demo/Feature2-Report.json",
    ], undefined, fixedNow);

    expect(layout.runRoot).toBe("test/demo-output/f4-runs/F2-Demo/2026-08-07T12-34-56-789Z");
  });

  it("derives deterministic run stem from f2 report parent for UNC-like paths", () => {
    const layout = resolveFeature4OutputLayout([
      "--f2-report",
      "//server/share/F2 Run/Feature2-Report.json",
    ], undefined, fixedNow);

    expect(layout.runRoot).toBe("test/demo-output/f4-runs/F2-Run/2026-08-07T12-34-56-789Z");
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
    "Feature2-Report.json",
    "../Feature2-Report.json",
    "./Feature2-Report.json",
    "a/../Feature2-Report.json",
  ])('rejects f2 report paths that yield unsafe default run stem: "%s"', (f2ReportPath) => {
    expect(() => resolveFeature4OutputLayout([
      "--f2-report",
      f2ReportPath,
    ], undefined, fixedNow)).toThrow(/output name|unsafe/i);
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
