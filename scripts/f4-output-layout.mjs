import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME,
  resolveAnalysisWorkspaceStagePaths,
  validateAnalysisWorkspaceLayout,
  validateAnalysisWorkspaceSummary,
} from "../packages/workflow-runners/dist/index.js";
import { safeName } from "./f1-output-layout.mjs";

const F4_DEFAULT_BASE = path.resolve("test", "demo-output", "f4-runs");

function isDotSegment(value) {
  return value === "." || value === "..";
}

function resolveF2RunStem(reportPath) {
  const normalized = reportPath.replaceAll("\\", "/");
  const parent = path.posix.basename(path.posix.dirname(normalized));
  if (!parent || isDotSegment(parent)) {
    throw new Error("Feature 4 output name is unsafe.");
  }
  const stem = safeName(parent).replaceAll(/\.+/g, ".").trim();
  if (!stem || isDotSegment(stem)) {
    throw new Error("Feature 4 output name is unsafe.");
  }
  return stem;
}

function resolveDefaultRunRoot(stem) {
  const outRoot = path.resolve(F4_DEFAULT_BASE, stem);
  const relative = path.relative(F4_DEFAULT_BASE, outRoot);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
    throw new Error("Feature 4 default output root is unsafe.");
  }
  return path.posix.join("test", "demo-output", "f4-runs", stem);
}

function outputRootOverride(value) {
  if (value === undefined) return undefined;
  if (!value.trim() || value.split(/[\\/]+/).includes("..")) throw new Error("Feature 4 output root override is unsafe.");
  return value;
}

function ensureFlagValue(args, index, flagName) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Feature 4 ${flagName} value is missing.`);
  }
  return value;
}

function parseCliArgs(args) {
  const flags = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) throw new Error(`Feature 4 option is unsupported: ${token}`);
    if (token !== "--f2-report" && token !== "--workbook" && token !== "--analysis-root") {
      throw new Error(`Feature 4 option is unsupported: ${token}`);
    }
    if (flags.has(token)) throw new Error(`Feature 4 option is duplicated: ${token}`);

    const value = ensureFlagValue(args, index, token);
    flags.set(token, value);
    index += 1;
  }

  if (!flags.has("--f2-report")) throw new Error("Feature 4 requires exactly one --f2-report option.");
  return {
    f2ReportPath: flags.get("--f2-report"),
    workbookPath: flags.get("--workbook"),
    analysisRoot: flags.get("--analysis-root"),
  };
}

function validateF2ReportPath(reportPath) {
  if (path.basename(reportPath) !== "Feature2-Report.json") {
    throw new Error("Feature 4 --f2-report must point to Feature2-Report.json.");
  }
}

function validateWorkbookPath(workbookPath) {
  if (path.extname(workbookPath) !== ".xlsx") {
    throw new Error("Feature 4 --workbook must point to a .xlsx workbook.");
  }
}

function resolveAnalysisWorkspace(analysisRoot) {
  const resolvedRoot = path.resolve(analysisRoot);
  const summaryPath = path.join(resolvedRoot, ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME);
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  validateAnalysisWorkspaceSummary(summary);
  const layout = {
    contractVersion: summary.contractVersion,
    analysisRoot: summary.analysisRoot,
    summaryPath: summary.summaryPath,
    workbookFileName: summary.workbook.fileName,
    workbookContentHash: summary.workbook.contentHash,
    allocationDate: summary.allocationDate,
    stagePaths: resolveAnalysisWorkspaceStagePaths(summary.analysisRoot),
  };
  validateAnalysisWorkspaceLayout(layout);
  if (path.resolve(layout.analysisRoot) !== resolvedRoot) {
    throw new Error("Feature 4 analysis workspace root does not match the validated summary.");
  }
  return layout;
}

export function resolveFeature4OutputLayout(args, outputRoot, now = () => new Date()) {
  const override = outputRootOverride(outputRoot);
  const { f2ReportPath, workbookPath, analysisRoot } = parseCliArgs(args);

  validateF2ReportPath(f2ReportPath);
  if (workbookPath !== undefined) validateWorkbookPath(workbookPath);
  if (analysisRoot !== undefined && override !== undefined) {
    throw new Error("Feature 4 analysis workspace root cannot be combined with an explicit output root.");
  }

  const runId = now().toISOString().replace(/[:.]/g, "-");
  const runStem = workbookPath
    ? safeName(path.basename(workbookPath, path.extname(workbookPath)))
    : resolveF2RunStem(f2ReportPath);
  if (!runStem || isDotSegment(runStem)) throw new Error("Feature 4 output name is unsafe.");

  if (analysisRoot !== undefined) {
    const layout = resolveAnalysisWorkspace(analysisRoot);
    const expectedReportPath = path.join(layout.stagePaths.f2, "Feature2-Report.json");
    if (path.resolve(f2ReportPath) !== path.resolve(expectedReportPath)) {
      throw new Error("Feature 4 current workspace flow requires the exact validated F2 report path.");
    }
    return {
      runId,
      f2ReportPath,
      workbookPath,
      runRoot: layout.stagePaths.f4,
      calculationJsonName: "Feature4-Calculation.json",
      reportMdName: "Feature4-Report.md",
      comparisonJsonName: "Feature4-Comparison.json",
      manifestName: "manifest.json",
      validationDirName: "validation",
      allowExistingRunRoot: true,
    };
  }

  const runRootBase = override ?? resolveDefaultRunRoot(runStem);
  return {
    runId,
    f2ReportPath,
    workbookPath,
    runRoot: path.posix.join(runRootBase, runId),
    calculationJsonName: "Feature4-Calculation.json",
    reportMdName: "Feature4-Report.md",
    comparisonJsonName: "Feature4-Comparison.json",
    manifestName: "manifest.json",
    validationDirName: "validation",
    allowExistingRunRoot: false,
  };
}
