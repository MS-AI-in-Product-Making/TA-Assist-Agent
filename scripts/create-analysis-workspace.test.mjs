import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { strToU8, strFromU8, unzipSync, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";
import {
  allocateAnalysisWorkspace, createInitialAnalysisWorkspaceSummary,
  recordAnalysisStageCompleted, recordAnalysisStageStarted, writeAnalysisWorkspaceSummary,
} from "../packages/workflow-runners/dist/index.js";
import { runF4FullValidation } from "./run-f4-full-validation.mjs";
import { runAnalysisStage } from "./analysis-stage-lifecycle.mjs";
import { createWorkbookCatalog, createWorksheetSelectionPrompt } from "../packages/workbook-catalog/dist/index.js";
import { runF6FullValidation } from "./run-f6-full-validation.mjs";
import { materializeF6ModelInterpretation } from "./f6-model-interpretation-materializer.mjs";

const scratch = path.resolve("test", ".task8-lifecycle");
let counter = 0;
afterEach(() => rmSync(scratch, { recursive: true, force: true }));

function fixture({ ready = true } = {}) {
  const root = path.join(scratch, String(counter++));
  mkdirSync(root, { recursive: true });
  const workbook = path.join(root, "Anonymous.xlsx");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Document No.", "ANON"], ["Revision:", "R1"], ["Date:", "2026-09-21"]]), "Title Page");
  const summarySheet = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_aoa(summarySheet, [["Device Level Dim", "", "Tolerance Loop Description"], ["Analysis-A", "", "Anonymous loop"]], { origin: "A9" });
  XLSX.utils.book_append_sheet(book, summarySheet, "Auto Summary");
  const sheet = XLSX.utils.aoa_to_sheet([
    ["", "Factor Description", "Part Name", "Part Category", "Design Nominal", "+ Tolerence", "- Tolerence", "Long Term/Safety Factor", "Sigma Level", "Distribution", "Drawing Number", "DIM/Characteristic ID"],
    ["A", "Offset", "Component", "Display", 0, 0.1, -0.1, 1, 4, "normal", "DRAW-A", "DIM-A"],
  ]);
  if (ready) XLSX.utils.sheet_add_aoa(sheet, [["Response Summary"]], { origin: "O50" });
  XLSX.utils.sheet_add_aoa(sheet, [["Design Nominal", 0], ["Lower Spec Limit", -1], ["Upper Spec Limit", 1], ["Target Sigma Level", 4]], { origin: "O53" });
  XLSX.utils.sheet_add_aoa(sheet, [["Include the tolerance path (screen shot) below:"]], { origin: "M59" });
  XLSX.utils.book_append_sheet(book, sheet, "Analysis-A");
  XLSX.writeFile(book, workbook);
  const archive = unzipSync(readFileSync(workbook));
  const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const pkg = "http://schemas.openxmlformats.org/package/2006/relationships";
  archive["xl/worksheets/sheet3.xml"] = strToU8(strFromU8(archive["xl/worksheets/sheet3.xml"]).replace("</worksheet>", `<drawing xmlns:r="${rel}" r:id="rIdDrawing"/></worksheet>`));
  archive["xl/worksheets/_rels/sheet3.xml.rels"] = strToU8(`<Relationships xmlns="${pkg}"><Relationship Id="rIdDrawing" Type="${rel}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
  archive["xl/drawings/drawing1.xml"] = strToU8(`<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${rel}"><xdr:twoCellAnchor><xdr:from><xdr:col>12</xdr:col><xdr:row>59</xdr:row></xdr:from><xdr:to><xdr:col>15</xdr:col><xdr:row>75</xdr:row></xdr:to><xdr:pic><xdr:blipFill><a:blip r:embed="rIdImage"/></xdr:blipFill></xdr:pic><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`);
  archive["xl/drawings/_rels/drawing1.xml.rels"] = strToU8(`<Relationships xmlns="${pkg}"><Relationship Id="rIdImage" Type="${rel}/image" Target="../media/image1.png"/></Relationships>`);
  archive["xl/media/image1.png"] = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  writeFileSync(workbook, zipSync(archive));
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
  it("runs one-root F1-F6 orchestration with a validated candidate before the ADO decision and one final publication", () => {
    const { layout, workbook } = fixture();
    const invokeExcel = (extra) => spawnSync(process.execPath, [
      "scripts/f2-excel-runner.mjs", workbook, "--analysis-root", layout.analysisRoot, ...extra,
    ], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, F1_COMPOSED_MODE: "never" } });
    expect(invokeExcel([]).status).toBe(0);
    const confirmed = invokeExcel(["--confirm", "--workbook-hash", layout.workbookContentHash, "--worksheets", "Analysis-A",
      "--selection-manifest", path.join(layout.analysisRoot, "manifest.json")]);
    expect(confirmed.status, confirmed.stderr).toBe(0);
    for (const stage of ["f3", "f4", "f5"]) {
      const args = stage === "f4"
        ? ["--f2-report", path.join(layout.stagePaths.f2, "Feature2-Report.json"), "--analysis-root", layout.analysisRoot]
        : argsFor(stage, layout, workbook);
      const result = cli(stage, args);
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }
    const responsePath = path.join(layout.stagePaths.f6, "evidence", "model-response", "Feature6-Model-Response.json");
    mkdirSync(path.dirname(responsePath), { recursive: true });
    writeFileSync(responsePath, JSON.stringify({
      contractVersion: "f6-model-interpretation-response-v1",
      model: { modelId: "controlled-test-model", supportsImage: true },
      worksheets: [{
        worksheetName: "Analysis-A",
        imageTableInterpretation: "The image and Factor table were reviewed independently. Model interpretation may contain hallucinations, label mismatches, or omissions and must be reviewed by ME.",
        rows: [{ sourceRow: 2, visibleStatus: "visible", interpretation: "Factor A is the controlled offset in the fixture." }],
      }],
    }));
    materializeF6ModelInterpretation({
      analysisRoot: layout.analysisRoot, outputRoot: layout.analysisRoot,
      f2ArtifactRoot: layout.stagePaths.f2, f3ArtifactRoot: layout.stagePaths.f3,
      f4ArtifactRoot: layout.stagePaths.f4, f5ArtifactRoot: layout.stagePaths.f5,
      selectedWorksheetNames: ["Analysis-A"], responsePath,
    });
    const args = [...argsFor("f6", layout, workbook), "--worksheet", "Analysis-A", "--language", "en-US",
      "--analysis-request-context", JSON.stringify({ requestedAt: "2026-09-21T08:00:00Z", utcOffsetMinutes: 0, source: "cli" })];
    const dependencies = { renderFinalReportPdf: () => Buffer.from("%PDF-1.7\ncontrolled PDF renderer\n") };
    let adoDecisions = 0;
    const candidate = runF6FullValidation({ args: [...args, "--candidate"] }, dependencies);
    expect(candidate.status).toBe("candidate_validated");
    expect(adoDecisions).toBe(0);
    expect(readSummary(layout).overallStatus).toBe("in_progress");
    expect(candidate).not.toHaveProperty("finalReportPdfPath");
    const f3Path = path.join(layout.stagePaths.f3, "Feature3-Report.json");
    const f3 = JSON.parse(readFileSync(f3Path, "utf8"));
    adoDecisions += 1;
    writeFileSync(f3Path, JSON.stringify({ ...f3, modelVersion: "drawing-governance-v3", ado: { status: "not_requested" } }));
    const final = runF6FullValidation({ args }, dependencies);
    expect(final.status).toBe("completed");
    expect(readSummary(layout).overallStatus).toBe("completed");
    expect(JSON.parse(readFileSync(final.manifestPath, "utf8")).adoTraceability).toEqual({ status: "not_requested" });
    expect(final.finalReportPdfPath).toBe(path.join(layout.stagePaths.f6, "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf"));
    expect(adoDecisions).toBe(1);
    expect(readdirSync(path.dirname(layout.analysisRoot)).filter((name) => !name.endsWith(".json"))).toHaveLength(1);
    expect(existsSync(path.join(layout.stagePaths.f6, "evidence", "candidate"))).toBe(false);
  }, 30000);
  it("threads the preallocated root through the real Excel selection/confirmation coordinator without allocating twice", () => {
    const { layout, workbook } = fixture();
    const invoke = (extra) => spawnSync(process.execPath, [
      "scripts/f2-excel-runner.mjs", workbook, "--analysis-root", layout.analysisRoot, ...extra,
    ], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, F1_COMPOSED_MODE: "never" } });
    const selection = invoke([]);
    expect(selection.status, selection.stderr).toBe(0);
    const selected = JSON.parse(selection.stdout);
    expect(selected.runRoot).toBe(layout.analysisRoot);
    const confirmed = invoke(["--confirm", "--workbook-hash", layout.workbookContentHash, "--worksheets", "Analysis-A", "--selection-manifest", selected.manifestPath]);
    expect(confirmed.status, `${confirmed.stderr}\n${readFileSync(path.join(layout.stagePaths.f2, "Feature2-Report.json"), "utf8")}`).toBe(0);
    expect(readSummary(layout)).toMatchObject({ currentStage: "f3", stages: { f1: { status: "completed" }, f2: { status: "completed" } } });
    expect(readdirSync(path.dirname(layout.analysisRoot)).filter((name) => !name.endsWith(".json"))).toHaveLength(1);
  });

  it("records failed F2 before the Excel coordinator returns a no-ready-worksheet failure", () => {
    const { layout, workbook } = fixture({ ready: false });
    const invoke = (extra) => spawnSync(process.execPath, [
      "scripts/f2-excel-runner.mjs", workbook, "--analysis-root", layout.analysisRoot, ...extra,
    ], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, F1_COMPOSED_MODE: "never" } });
    expect(invoke([]).status).toBe(0);
    expect(invoke(["--confirm", "--workbook-hash", layout.workbookContentHash, "--worksheets", "Analysis-A",
      "--selection-manifest", path.join(layout.analysisRoot, "manifest.json")]).status).toBe(1);
    expect(readSummary(layout)).toMatchObject({ overallStatus: "failed", failedStage: "f2", stages: { f3: { status: "blocked" } } });
  });
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
