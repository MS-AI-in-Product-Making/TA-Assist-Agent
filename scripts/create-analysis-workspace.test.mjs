import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { afterEach, describe, expect, it } from "vitest";
import {
  allocateAnalysisWorkspace, createInitialAnalysisWorkspaceSummary,
  recordAnalysisStageCompleted, recordAnalysisStageStarted, writeAnalysisWorkspaceSummary,
} from "../packages/workflow-runners/dist/index.js";
import { runF4FullValidation } from "./run-f4-full-validation.mjs";
import { runAnalysisStage } from "./analysis-stage-lifecycle.mjs";
import { createWorkbookCatalog, createWorksheetSelectionPrompt } from "../packages/workbook-catalog/dist/index.js";

const scratch = path.resolve("test", ".task8-lifecycle");
let counter = 0;
afterEach(() => rmSync(scratch, { recursive: true, force: true }));

function fixture() {
  const root = path.join(scratch, String(counter++));
  mkdirSync(root, { recursive: true });
  const workbook = path.join(root, "Anonymous.xlsx");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Document No.", "ANON"], ["Revision:", "R1"], ["Date:", "2026-09-21"]]), "Title Page");
  const summarySheet = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_aoa(summarySheet, [["Device Level Dim", "", "Tolerance Loop Description"], ["Analysis-A", "", "Anonymous loop"]], { origin: "A9" });
  XLSX.utils.book_append_sheet(book, summarySheet, "Auto Summary");
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Factor Description", "Part Name", "Part Category", "Design Nominal", "+ Tolerence", "- Tolerence", "Long Term/Safety Factor", "Sigma Level", "Distribution", "Drawing Number", "DIM/Characteristic ID"],
    ["A", "Component", "CNC", 0, 0.1, -0.1, 1, 4, "normal", "DRAW-A", "DIM-A"],
  ]);
  XLSX.utils.sheet_add_aoa(sheet, [["Design Nominal", 0], ["Lower Spec Limit", -1], ["Upper Spec Limit", 1], ["Target Sigma Level", 4]], { origin: "O53" });
  XLSX.utils.book_append_sheet(book, sheet, "Analysis-A");
  XLSX.writeFile(book, workbook);
  const layout = allocateAnalysisWorkspace({
    testRoot: path.join(root, "runs"), workbookFileName: path.basename(workbook),
    workbookContentHash: createHash("sha256").update(readFileSync(workbook)).digest("hex"), now: new Date(),
  });
  writeAnalysisWorkspaceSummary(layout, createInitialAnalysisWorkspaceSummary(layout));
  return { root, workbook, layout };
}

function readSummary(layout) { return JSON.parse(readFileSync(layout.summaryPath, "utf8")); }
function seedCompleted(layout, workbook, count) {
  let summary = readSummary(layout);
  for (const stage of Object.keys(layout.stagePaths).slice(0, count)) {
    const evidence = path.join(layout.stagePaths[stage], "evidence.json");
    writeFileSync(evidence, "{}");
    summary = recordAnalysisStageCompleted(recordAnalysisStageStarted(summary, stage), stage,
      { evidence: path.relative(layout.analysisRoot, evidence).split(path.sep).join("/") });
  }
  if (count > 0) {
    writeFileSync(path.join(layout.stagePaths.f1, "Feature1-Report.json"), JSON.stringify({
      workbooks: [{ workbookPath: workbook, workbook: summary.workbook }],
    }));
  }
  writeAnalysisWorkspaceSummary(layout, summary);
}

function cli(stage, args) {
  return spawnSync(process.execPath, [path.join("scripts", `run-${stage}-full-validation.mjs`), ...args], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, F1_COMPOSED_MODE: "never" },
  });
}
function argsFor(stage, layout, workbook) {
  const args = {
    f1: [workbook, "--confirm", "--workbook-hash", layout.workbookContentHash, "--worksheets", "Analysis-A"],
    f2: [layout.stagePaths.f1],
    f3: [layout.stagePaths.f2],
    f4: ["--f2-report", path.join(layout.stagePaths.f2, "Feature2-Report.json"), "--workbook", workbook],
    f5: [layout.stagePaths.f1, layout.stagePaths.f3, layout.stagePaths.f4],
    f6: [layout.stagePaths.f2, layout.stagePaths.f3, layout.stagePaths.f4, layout.stagePaths.f5],
  }[stage];
  return [...args, "--analysis-root", layout.analysisRoot];
}

describe("one canonical analysis workspace lifecycle", () => {
  it("allocates once, creates all six folders and an initial summary", () => {
    const { workbook, root } = fixture();
    const result = spawnSync(process.execPath, ["scripts/create-analysis-workspace.mjs", "--workbook", workbook, "--test-root", path.join(root, "allocated")], { encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const layout = JSON.parse(result.stdout);
    expect(path.isAbsolute(layout.analysisRoot)).toBe(true);
    expect(readSummary(layout).overallStatus).toBe("in_progress");
    expect(Object.values(layout.stagePaths)).toHaveLength(6);
    expect(Object.values(layout.stagePaths).every(existsSync)).toBe(true);
    expect(readdirSync(path.join(root, "allocated"))).toHaveLength(1);
  });

  it("emits no success or allocated root for invalid workbook input", () => {
    mkdirSync(scratch, { recursive: true });
    const workbook = path.join(scratch, "invalid.xlsx");
    writeFileSync(workbook, "not an xlsx");
    const result = spawnSync(process.execPath, ["scripts/create-analysis-workspace.mjs", "--workbook", workbook, "--test-root", path.join(scratch, "runs")], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toMatch(/analysisRoot|completed/);
    expect(existsSync(path.join(scratch, "runs"))).toBe(false);
  });

  it.each(["f1", "f2", "f3", "f4", "f5", "f6"])("rejects %s out of order without mutating the root", (stage) => {
    const { layout, workbook } = fixture();
    if (stage === "f1") seedCompleted(layout, workbook, 1);
    const before = readFileSync(layout.summaryPath, "utf8");
    const result = cli(stage, argsFor(stage, layout, workbook));
    expect(result.status).toBe(1);
    expect(readFileSync(layout.summaryPath, "utf8")).toBe(before);
    expect(readdirSync(path.dirname(layout.analysisRoot))).toHaveLength(1);
  });

  it("records a controlled F4 failure, preserving F1-F3 evidence and blocking F5/F6", () => {
    const { layout, workbook } = fixture();
    seedCompleted(layout, workbook, 3);
    const before = readSummary(layout);
    let injected = false;
    const result = runF4FullValidation({ args: argsFor("f4", layout, workbook) }, {
      loadHandoffs() {
        injected = true;
        expect(readSummary(layout).stages.f4.status).toBe("running");
        throw new Error("controlled F4 failure");
      },
    });
    expect(injected).toBe(true);
    expect(result.status).toBe("failed");
    const summary = readSummary(layout);
    expect(summary).toMatchObject({
      overallStatus: "failed", failedStage: "f4",
      stages: { f4: { status: "failed", artifacts: {} }, f5: { status: "blocked" }, f6: { status: "blocked" } },
    });
    for (const stage of ["f1", "f2", "f3"]) expect(summary.stages[stage]).toEqual(before.stages[stage]);
    const failedBytes = readFileSync(layout.summaryPath, "utf8");
    expect(() => runF4FullValidation({ args: argsFor("f4", layout, workbook) })).toThrow();
    expect(readFileSync(layout.summaryPath, "utf8")).toBe(failedBytes);
  });

  it.each(["f1", "f2", "f3", "f4", "f5", "f6"])("keeps completed roots immutable when %s is requested", (stage) => {
    const { layout, workbook } = fixture();
    seedCompleted(layout, workbook, 6);
    const before = readFileSync(layout.summaryPath, "utf8");
    expect(cli(stage, argsFor(stage, layout, workbook)).status).toBe(1);
    expect(readFileSync(layout.summaryPath, "utf8")).toBe(before);
  });

  it("does not resume a running stage left by a process crash", () => {
    const { layout, workbook } = fixture();
    writeAnalysisWorkspaceSummary(layout, recordAnalysisStageStarted(readSummary(layout), "f1"));
    const before = readFileSync(layout.summaryPath, "utf8");
    expect(cli("f1", argsFor("f1", layout, workbook)).status).toBe(1);
    expect(readFileSync(layout.summaryPath, "utf8")).toBe(before);
  });

  it("preserves selection evidence and advances real F1/F2 outputs in the same root", () => {
    const { layout, workbook } = fixture();
    const workbookCatalog = createWorkbookCatalog({ contractVersion: "v1", fileName: path.basename(workbook), inputClassification: "confidential", workbookBytes: new Uint8Array(readFileSync(workbook)) });
    expect(createWorksheetSelectionPrompt({ contractVersion: "v1", inputClassification: "confidential", workbookCatalog }).status).toBe("selectionRequired");
    const selection = cli("f1", [workbook, "--selection-only", "--analysis-root", layout.analysisRoot]);
    expect(selection.status, selection.stderr).toBe(0);
    expect(readSummary(layout).stages.f1.status).toBe("pending");
    const prompt = readFileSync(path.join(layout.stagePaths.f1, "Feature1-Selection.json"), "utf8");
    for (const stage of ["f1", "f2"]) {
      const result = cli(stage, argsFor(stage, layout, workbook));
      expect(result.status, result.stderr).toBe(0);
      const state = readSummary(layout).stages[stage];
      expect(state.status).toBe("completed");
      expect(Object.values(state.artifacts).every((file) => !path.isAbsolute(file) && existsSync(path.join(layout.analysisRoot, file)))).toBe(true);
    }
    expect(readFileSync(path.join(layout.stagePaths.f1, "Feature1-Selection.json"), "utf8")).toBe(prompt);
    expect(readSummary(layout).currentStage).toBe("f3");
    expect(readdirSync(path.dirname(layout.analysisRoot))).toHaveLength(1);
  });

  it.each(["f1", "f2", "f3", "f4", "f5", "f6"])("does not accept success-shaped %s results without validated artifacts", (stage) => {
    const { layout, workbook } = fixture();
    seedCompleted(layout, workbook, Object.keys(layout.stagePaths).indexOf(stage));
    expect(() => runAnalysisStage({ stage, args: argsFor(stage, layout, workbook) }, () => {
      expect(readSummary(layout).stages[stage].status).toBe("running");
      return { status: "completed", finalReportPdfPath: "unvalidated.pdf" };
    })).toThrow();
    expect(readSummary(layout)).toMatchObject({ overallStatus: "failed", failedStage: stage });
    expect(readSummary(layout).stages[stage].artifacts).toEqual({});
  });

  it("records workbook mutation as failure before any stage execution", () => {
    const { layout, workbook } = fixture();
    seedCompleted(layout, workbook, 3);
    writeFileSync(workbook, "changed");
    let executed = false;
    expect(() => runAnalysisStage({ stage: "f4", args: argsFor("f4", layout, workbook) }, () => { executed = true; })).toThrow();
    expect(executed).toBe(false);
    expect(readSummary(layout)).toMatchObject({ overallStatus: "failed", failedStage: "f4" });
  });

  it("returns a nonzero CLI exit for a rejected F2 input and blocks all downstream stages", () => {
    const { layout, workbook } = fixture();
    seedCompleted(layout, workbook, 1);
    const result = cli("f2", argsFor("f2", layout, workbook));
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout || result.stderr).status).toBe("failed");
    expect(readSummary(layout)).toMatchObject({ overallStatus: "failed", failedStage: "f2", stages: { f3: { status: "blocked" }, f6: { status: "blocked" } } });
  });
});
