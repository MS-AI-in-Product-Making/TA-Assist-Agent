import { afterEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { f4ExcelComparisonResultSchema, f4WorkflowCalculationResultSchema } from "../packages/contracts/dist/contracts.js";
import { createTypedError } from "../packages/contracts/dist/index.js";
import { runF4CliMain, runF4FullValidation, summarizeF4CliResult } from "./run-f4-full-validation.mjs";

const cleanup = [];
const runnerPath = fileURLToPath(new URL("./run-f4-full-validation.mjs", import.meta.url));

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

function completedCalculation(workbookHash) {
  return {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    calculationVersion: "excel-ta-v1",
    projectReference: "project-ref",
    runReference: "run-ref-1",
    workbookContentHash: workbookHash,
    worksheetSelection: { worksheetName: "Analysis-A", tableId: "table-a" },
    factorCount: 1,
    recommendation: {
      method: "worst_case",
      reason: "factor_count_1_to_3",
      refer3d: false,
      criticality: "none",
      criticalityRisk: false,
    },
    factors: [{
      factorName: "Factor A",
      unit: "mm",
      source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 14 },
      input: {
        nominalValue: 0,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "normal",
      },
      mean: 0,
      halfTolerance: 0.1,
      sigma: 0.025,
      contribution: 1,
      trace: {
        formulaIds: ["factor-mean-v1", "factor-half-tolerance-v1", "factor-sigma-v1", "contribution-v1"],
        sourceCells: ["Analysis-A!I14"],
      },
    }],
    system: {
      designNominal: 0,
      mean: 0,
      additionalMeanShift: 0,
      worstCaseUpper: 0.1,
      worstCaseLower: -0.1,
      rssSigma: 0.025,
    },
    capability: {
      lowerSpecLimit: -1,
      upperSpecLimit: 1,
      targetSigmaLevel: 4,
      targetCpk: 1.33,
      cp: 13.333333333333334,
      lowerCpk: 13.333333333333334,
      upperCpk: 13.333333333333334,
      cpk: 13.333333333333334,
      lowerZ: 40,
      upperZ: 40,
      lowerDpm: 0,
      upperDpm: 0,
      totalDpm: 0,
      outOfSpecRatio: 0,
      yield: 1,
      status: "PASS",
    },
    traceRecords: [{
      outputField: "system.rssSigma",
      formulaVersion: "excel-ta-v1",
      formulaId: "rss-v1",
      sourceCells: ["Analysis-A!T44"],
    }],
    scenarios: [],
  };
}

function workflowResult(runId = "2026-08-07T12-00-00-000Z") {
  const workbookHash = "a".repeat(64);
  return f4WorkflowCalculationResultSchema.parse({
    contractVersion: "v1",
    workflowVersion: "f4-f2-v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    runId,
    generatedAt: "2026-08-07T12:00:00.000Z",
    source: {
      artifactReference: "Feature2-Report.json",
      workbookFileName: "Demo.xlsx",
      workbookContentHash: workbookHash,
    },
    calculations: [completedCalculation(workbookHash)],
    summary: { selectedWorksheetCount: 1, completedWorksheetCount: 1 },
  });
}

function comparisonResult(runId, status = "passed") {
  if (status === "excel_unavailable") {
    return f4ExcelComparisonResultSchema.parse({
      contractVersion: "v1",
      comparisonVersion: "f4-excel-comparison-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status,
      runId,
      generatedAt: "2026-08-07T12:00:00.000Z",
      reasonCode: "excel_runtime_unavailable",
    });
  }
  return f4ExcelComparisonResultSchema.parse({
    contractVersion: "v1",
    comparisonVersion: "f4-excel-comparison-v1",
    outputClassification: "confidential",
    featureId: "F4",
    status,
    runId,
    generatedAt: "2026-08-07T12:00:00.000Z",
    source: { workbookContentHash: "a".repeat(64) },
    worksheets: [{
      worksheetName: "Analysis-A",
      metrics: [{
        metric: "system.rssSigma",
        f4Value: 0.025,
        excelValue: 0.025,
        excelDisplayText: "0.025",
        absoluteDifference: 0,
        relativeDifference: 0,
        tolerance: 1e-12,
        passed: true,
        sourceCell: "Analysis-A!T44",
        excelFormula: "=SQRT(SUMSQ(T14:T43))",
        f4FormulaId: "rss-v1",
      }],
    }],
    summary: { worksheetCount: 1, metricCount: 1, passedMetricCount: 1, mismatchMetricCount: 0 },
  });
}

function setup({ workbook = false, comparisonStatus = "passed", calculationError } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "f4-full-flow-"));
  cleanup.push(root);
  const runRoot = path.join(root, "ignored-f4-runs", "Demo", "2026-08-07T12-00-00-000Z");
  const calculation = workflowResult();
  const renameCalls = [];
  const deps = {
    resolveLayout: () => ({
      runId: calculation.runId,
      f2ReportPath: path.join(root, "Feature2-Report.json"),
      workbookPath: workbook ? path.join(root, "Demo.xlsx") : undefined,
      runRoot,
      calculationJsonName: "Feature4-Calculation.json",
      reportMdName: "Feature4-Report.md",
      comparisonJsonName: "Feature4-Comparison.json",
      manifestName: "manifest.json",
      validationDirName: "validation",
    }),
    loadHandoffs: vi.fn(() => ({
      status: "accepted",
      reportPath: "Feature2-Report.json",
      workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64) },
      handoffs: [{ worksheetName: "Analysis-A", factors: [{ tableId: "table-a" }] }],
    })),
    calculateWorkflow: vi.fn(() => {
      if (calculationError) throw new Error("sensitive calculation details");
      return calculation;
    }),
    buildMapping: vi.fn(() => ({ version: "excel-ta-v1", inputs: [], outputs: [] })),
    compareWithExcel: vi.fn(() => comparisonResult(calculation.runId, comparisonStatus)),
    renderReport: vi.fn((_result, options) => `# F4 Report\n${options.comparisonResult?.status ?? "calculation_only"}\n`),
    rename: (from, to) => {
      renameCalls.push({ from, to });
      renameSync(from, to);
    },
  };
  return { root, runRoot, calculation, deps, renameCalls };
}

function createAnalysisWorkspaceRoot(root) {
  const analysisRoot = path.join(root, "20260921 - Demo");
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

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

describe("runF4FullValidation", () => {
  it("summarizes successful CLI output without embedding calculation payloads", () => {
    const context = setup();
    const result = runF4FullValidation({ args: ["--f2-report", "Feature2-Report.json"] }, context.deps);

    expect(summarizeF4CliResult(result)).toEqual({
      status: "completed",
      outputDirectory: context.runRoot,
      calculationJsonPath: path.join(context.runRoot, "Feature4-Calculation.json"),
      reportMdPath: path.join(context.runRoot, "Feature4-Report.md"),
      manifestPath: path.join(context.runRoot, "manifest.json"),
      summary: { selectedWorksheetCount: 1, completedWorksheetCount: 1 },
    });
  });

  it("writes calculation, Markdown, and completed manifest without workbook comparison", () => {
    const context = setup();
    const result = runF4FullValidation({ args: ["--f2-report", "Feature2-Report.json"] }, context.deps);

    expect(result.status).toBe("completed");
    expect(existsSync(path.join(context.runRoot, "Feature4-Calculation.json"))).toBe(true);
    expect(existsSync(path.join(context.runRoot, "Feature4-Report.md"))).toBe(true);
    expect(existsSync(path.join(context.runRoot, "Feature4-Comparison.json"))).toBe(false);
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({
      status: "completed",
      calculationStatus: "completed",
      comparisonStatus: "not_requested",
    });
  });

  it("writes calculation, comparison, Markdown, and manifest in workbook mode", () => {
    const context = setup({ workbook: true });
    const result = runF4FullValidation({ args: ["--f2-report", "Feature2-Report.json", "--workbook", "Demo.xlsx"] }, context.deps);

    expect(result.status).toBe("completed");
    expect(readJson(path.join(context.runRoot, "Feature4-Comparison.json")).status).toBe("passed");
    expect(readFileSync(path.join(context.runRoot, "Feature4-Report.md"), "utf8")).toContain("passed");
    expect(context.deps.buildMapping).toHaveBeenCalledWith(expect.objectContaining({ workbookPath: expect.any(String) }));
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({ comparisonStatus: "passed" });
  });

  it("publishes the current workspace flow directly into the fixed F4 stage without a run-id child", () => {
    const context = setup();
    const workspace = createAnalysisWorkspaceRoot(context.root);
    context.runRoot = workspace.stagePaths.f4;
    context.deps.resolveLayout = () => ({
      runId: context.calculation.runId,
      f2ReportPath: path.join(workspace.stagePaths.f2, "Feature2-Report.json"),
      workbookPath: undefined,
      runRoot: context.runRoot,
      calculationJsonName: "Feature4-Calculation.json",
      reportMdName: "Feature4-Report.md",
      comparisonJsonName: "Feature4-Comparison.json",
      manifestName: "manifest.json",
      validationDirName: "validation",
      allowExistingRunRoot: true,
    });

    const result = runF4FullValidation({ args: ["--f2-report", "Feature2-Report.json"] }, context.deps);

    expect(result.status).toBe("completed");
    expect(result.outputDirectory).toBe(context.runRoot);
    expect(result.outputDirectory.endsWith(context.calculation.runId)).toBe(false);
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({ status: "completed" });
  });

  it("leaves a dirty workspace stage unchanged instead of rewriting its manifest", () => {
    const context = setup();
    const workspace = createAnalysisWorkspaceRoot(context.root);
    const staleManifestPath = path.join(workspace.stagePaths.f4, "manifest.json");
    const staleCalculationPath = path.join(workspace.stagePaths.f4, "Feature4-Calculation.json");
    writeFileSync(staleManifestPath, '{"status":"completed"}\n', "utf8");
    writeFileSync(staleCalculationPath, '{"status":"completed"}\n', "utf8");
    context.deps.resolveLayout = () => ({
      runId: context.calculation.runId,
      f2ReportPath: path.join(workspace.stagePaths.f2, "Feature2-Report.json"),
      workbookPath: undefined,
      runRoot: workspace.stagePaths.f4,
      calculationJsonName: "Feature4-Calculation.json",
      reportMdName: "Feature4-Report.md",
      comparisonJsonName: "Feature4-Comparison.json",
      manifestName: "manifest.json",
      validationDirName: "validation",
      allowExistingRunRoot: true,
    });

    const result = runF4FullValidation({ args: ["--f2-report", "Feature2-Report.json"] }, context.deps);

    expect(result).toMatchObject({
      status: "failed",
      reasonCode: "workspace_stage_not_empty",
      outputDirectory: workspace.stagePaths.f4,
      manifestPath: staleManifestPath,
    });
    expect(readFileSync(staleManifestPath, "utf8")).toBe('{"status":"completed"}\n');
    expect(readFileSync(staleCalculationPath, "utf8")).toBe('{"status":"completed"}\n');
  });

  it("writes every artifact atomically without leftover temporary files", () => {
    const context = setup({ workbook: true });
    runF4FullValidation({ args: [] }, context.deps);

    expect(context.renameCalls.map(({ to }) => path.basename(to))).toEqual([
      "Feature4-Calculation.json",
      "Feature4-Comparison.json",
      "Feature4-Report.md",
      "manifest.json",
    ]);
    expect(readdirSync(context.runRoot).some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("leaves only a controlled failed manifest when calculation fails", () => {
    const context = setup({ calculationError: true });
    const result = runF4FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "calculation_failed" });
    expect(existsSync(path.join(context.runRoot, "Feature4-Calculation.json"))).toBe(false);
    expect(existsSync(path.join(context.runRoot, "Feature4-Report.md"))).toBe(false);
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({
      status: "failed",
      reasonCode: "calculation_failed",
      calculationStatus: "failed",
    });
    expect(readFileSync(path.join(context.runRoot, "manifest.json"), "utf8")).not.toContain("sensitive calculation details");
  });

  it("rejects an invalid calculation contract before writing calculation artifacts", () => {
    const context = setup();
    context.deps.calculateWorkflow.mockReturnValue({
      ...context.calculation,
      calculations: [],
    });

    const result = runF4FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "calculation_failed" });
    expect(existsSync(path.join(context.runRoot, "Feature4-Calculation.json"))).toBe(false);
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({
      status: "failed",
      calculationStatus: "failed",
    });
  });

  it.each([
    ["runId", (calculation) => ({ ...calculation, runId: "other-run" })],
    ["workbook hash", (calculation) => ({
      ...calculation,
      source: { ...calculation.source, workbookContentHash: "b".repeat(64) },
    })],
    ["worksheet set", (calculation) => ({
      ...calculation,
      calculations: calculation.calculations.map((item) => ({
        ...item,
        worksheetSelection: { ...item.worksheetSelection, worksheetName: "Analysis-B" },
      })),
    })],
  ])("rejects a schema-valid calculation with mismatched %s evidence", (_label, mutate) => {
    const context = setup();
    context.deps.calculateWorkflow.mockReturnValue(mutate(context.calculation));

    const result = runF4FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "calculation_failed" });
    expect(existsSync(path.join(context.runRoot, "Feature4-Calculation.json"))).toBe(false);
  });

  it("preserves calculation and records a formal Excel unavailable comparison", () => {
    const context = setup({ workbook: true, comparisonStatus: "excel_unavailable" });
    const result = runF4FullValidation({ args: [] }, context.deps);

    expect(result.status).toBe("completed");
    expect(readJson(path.join(context.runRoot, "Feature4-Calculation.json")).status).toBe("completed");
    expect(readJson(path.join(context.runRoot, "Feature4-Comparison.json"))).toMatchObject({
      status: "excel_unavailable",
      reasonCode: "excel_runtime_unavailable",
    });
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({ comparisonStatus: "excel_unavailable" });
  });

  it("records an already-written comparison if a later report stage fails", () => {
    const context = setup({ workbook: true });
    context.deps.renderReport.mockImplementation(() => {
      throw new Error("sensitive report details");
    });

    const result = runF4FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({
      status: "failed",
      calculationStatus: "completed",
      comparisonStatus: "passed",
      artifacts: {
        calculation: "Feature4-Calculation.json",
        comparison: "Feature4-Comparison.json",
      },
    });
  });

  it("rejects an invalid comparison contract before writing the comparison artifact", () => {
    const context = setup({ workbook: true });
    context.deps.compareWithExcel.mockReturnValue({ status: "passed" });

    const result = runF4FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(existsSync(path.join(context.runRoot, "Feature4-Calculation.json"))).toBe(true);
    expect(existsSync(path.join(context.runRoot, "Feature4-Comparison.json"))).toBe(false);
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({
      calculationStatus: "completed",
      comparisonStatus: "not_started",
    });
  });

  it("rejects a schema-valid comparison associated with another run", () => {
    const context = setup({ workbook: true });
    context.deps.compareWithExcel.mockReturnValue({
      ...comparisonResult(context.calculation.runId),
      runId: "other-run",
    });

    const result = runF4FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(existsSync(path.join(context.runRoot, "Feature4-Comparison.json"))).toBe(false);
  });

  it("removes a temporary file when an atomic rename fails", () => {
    const context = setup();
    let shouldFail = true;
    context.deps.rename = (from, to) => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error("rename failed");
      }
      renameSync(from, to);
    };

    const result = runF4FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "calculation_failed" });
    expect(readdirSync(context.runRoot).some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("refuses a pre-existing run root without changing its artifacts", () => {
    const context = setup();
    mkdirSync(context.runRoot, { recursive: true });
    const stalePath = path.join(context.runRoot, "Feature4-Report.md");
    const staleContent = "stale completed report\n";
    writeFileSync(stalePath, staleContent, "utf8");

    expect(() => runF4FullValidation({ args: [] }, context.deps)).toThrow();
    expect(readFileSync(stalePath, "utf8")).toBe(staleContent);
    expect(context.deps.calculateWorkflow).not.toHaveBeenCalled();
  });

  it("keeps all outputs under the configured run root", () => {
    const context = setup({ workbook: true });
    const result = runF4FullValidation({ args: [] }, context.deps);
    const relative = path.relative(context.runRoot, result.outputDirectory);

    expect(relative).toBe("");
    for (const { to } of context.renameCalls) {
      expect(path.relative(context.runRoot, to)).not.toMatch(/^\.\./u);
    }
  });
});

describe("runF4CliMain", () => {
  it("returns invalid_arguments_or_output_root only for argument/layout validation failures", () => {
    const stdout = [];
    const stderr = [];
    const exitCode = runF4CliMain({
      args: ["--f2-report"],
      writeStdout: (value) => stdout.push(value),
      writeStderr: (value) => stderr.push(value),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout.join(""))).toEqual({
      status: "failed",
      reasonCode: "invalid_arguments_or_output_root",
    });
    expect(stderr.join("")).toBe("");
  });

  it("preserves the explicit dirty-stage reason code at the CLI boundary", () => {
    const stdout = [];
    const stderr = [];
    const exitCode = runF4CliMain({
      args: ["--f2-report", "Feature2-Report.json"],
      runFullValidation: () => { throw createTypedError({
        code: "prerequisite_not_ready",
        summary: "Workspace stage already contains published artifacts.",
        suggestedAction: "Choose a fresh analysis workspace stage before rerunning this workflow.",
        affectedInputReferences: ["Feature4-Calculation.json"],
        details: { reasonCode: "workspace_stage_not_empty" },
      }); },
      writeStdout: (value) => stdout.push(value),
      writeStderr: (value) => stderr.push(value),
    });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout.join(""))).toEqual({
      status: "failed",
      reasonCode: "workspace_stage_not_empty",
    });
    expect(stderr.join("")).toBe("");
  });

  it("serializes unexpected failures as safe typed internal_error payloads without leaking details", () => {
    const stdout = [];
    const stderr = [];
    const exitCode = runF4CliMain({
      args: ["--f2-report", "Feature2-Report.json"],
      runFullValidation: () => { throw new Error("disk failure at C:/secret/path"); },
      writeStdout: (value) => stdout.push(value),
      writeStderr: (value) => stderr.push(value),
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("")).toBe("");
    expect(JSON.parse(stderr.join(""))).toMatchObject({
      status: "failed",
      error: { code: "internal_error", summary: "Workflow runner failed unexpectedly." },
    });
    expect(stderr.join("")).not.toContain("disk failure");
    expect(stderr.join("")).not.toContain("C:/secret/path");
  });
});

describe("run-f4-full-validation CLI", () => {
  it("prints invalid_arguments_or_output_root and exits nonzero for invalid arguments", () => {
    const result = spawnSync(process.execPath, [runnerPath, "--f2-report"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      status: "failed",
      reasonCode: "invalid_arguments_or_output_root",
    });
    expect(result.stderr.trim()).toBe("");
  });

  it("prints workspace_stage_not_empty and leaves a dirty workspace stage unchanged", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f4-cli-dirty-"));
    cleanup.push(root);
    const workspace = createAnalysisWorkspaceRoot(root);
    const staleManifestPath = path.join(workspace.stagePaths.f4, "manifest.json");
    const staleCalculationPath = path.join(workspace.stagePaths.f4, "Feature4-Calculation.json");
    writeFileSync(staleManifestPath, '{"status":"completed"}\n', "utf8");
    writeFileSync(staleCalculationPath, '{"status":"completed"}\n', "utf8");
    writeFileSync(path.join(workspace.stagePaths.f2, "Feature2-Report.json"), "{}\n", "utf8");

    const result = spawnSync(process.execPath, [
      runnerPath,
      "--f2-report", path.join(workspace.stagePaths.f2, "Feature2-Report.json"),
      "--analysis-root", workspace.analysisRoot,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      status: "failed",
      reasonCode: "workspace_stage_not_empty",
    });
    expect(result.stderr.trim()).toBe("");
    expect(readFileSync(staleManifestPath, "utf8")).toBe('{"status":"completed"}\n');
    expect(readFileSync(staleCalculationPath, "utf8")).toBe('{"status":"completed"}\n');
  });
});