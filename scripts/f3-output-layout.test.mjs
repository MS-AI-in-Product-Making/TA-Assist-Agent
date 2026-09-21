import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveFeature3OutputLayout } from "./f3-output-layout.mjs";

const cleanupRoots = [];

function createAnalysisWorkspaceRoot() {
  const analysisRoot = mkdtempSync(path.join(tmpdir(), "f3-layout-workspace-"));
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

describe("resolveFeature3OutputLayout", () => {
  it("routes the canonical workspace F2 stage directly into the fixed F3 stage", () => {
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot();

    expect(resolveFeature3OutputLayout([stagePaths.f2], undefined, analysisRoot)).toEqual({
      outRoot: stagePaths.f3,
      reportJsonName: "Feature3-Report.json",
      reportMdName: "Feature3-Report.md",
      workspaceMode: true,
    });
  });

  it("does not treat lookalike stage names as a validated workspace", () => {
    const { analysisRoot } = createAnalysisWorkspaceRoot();
    const lookalikeRoot = mkdtempSync(path.join(tmpdir(), "f3-layout-lookalike-"));
    cleanupRoots.push(lookalikeRoot);
    const lookalikeF2 = path.join(lookalikeRoot, "02 - F2 Data Cleaning");
    mkdirSync(lookalikeF2, { recursive: true });

    expect(resolveFeature3OutputLayout([lookalikeF2]).outRoot).toBe("test/demo-output/feature3-output/02---F2-Data-Cleaning");
    expect(() => resolveFeature3OutputLayout([lookalikeF2], undefined, analysisRoot)).toThrow(/exact validated F2 stage path/i);
  });

  it("isolates one sanitized F2 artifact directory in fixed Feature 3 output", () => {
    expect(resolveFeature3OutputLayout(["runs/demo/f2"])).toEqual({
      outRoot: "test/demo-output/feature3-output/f2",
      reportJsonName: "Feature3-Report.json",
      reportMdName: "Feature3-Report.md",
      workspaceMode: false,
    });
    expect(resolveFeature3OutputLayout(["runs/A:B/f2 output"]).outRoot).toContain("f2-output");
  });

  it("requires one F2 artifact directory and rejects Excel", () => {
    expect(() => resolveFeature3OutputLayout([])).toThrow("exactly one Feature 2 artifact directory");
    expect(() => resolveFeature3OutputLayout(["a", "b"])).toThrow("exactly one Feature 2 artifact directory");
    expect(() => resolveFeature3OutputLayout(["Demo.xlsx"])).toThrow("requires a Feature 2 artifact directory");
  });

  it("accepts a safe explicit output root", () => {
    expect(resolveFeature3OutputLayout(["artifact"], "runs/demo/f3").outRoot).toBe("runs/demo/f3");
  });

  it.each(["", "runs/../shared"])('rejects unsafe output override "%s"', (outputRoot) => {
    expect(() => resolveFeature3OutputLayout(["artifact"], outputRoot)).toThrow(/output root/i);
  });
});