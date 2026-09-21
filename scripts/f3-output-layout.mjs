import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME,
  resolveAnalysisWorkspaceStagePaths,
  validateAnalysisWorkspaceLayout,
  validateAnalysisWorkspaceSummary,
} from "../packages/workflow-runners/dist/index.js";
import { safeName } from "./f1-output-layout.mjs";

function outputRootOverride(value) {
  if (value === undefined) return undefined;
  if (!value.trim() || value.split(/[\\/]+/).includes("..")) throw new Error("Feature 3 output root override is unsafe.");
  return value;
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
    throw new Error("Feature 3 analysis workspace root does not match the validated summary.");
  }
  return layout;
}

export function resolveFeature3OutputLayout(args, outputRoot, analysisRoot) {
  const override = outputRootOverride(outputRoot);
  if (args.length !== 1) {
    throw new Error("Feature 3 workflow requires exactly one Feature 2 artifact directory.");
  }
  if (/\.xls[xm]?$/i.test(args[0])) throw new Error("Feature 3 requires a Feature 2 artifact directory, not an Excel workbook.");
  if (analysisRoot !== undefined && override !== undefined) {
    throw new Error("Feature 3 analysis workspace root cannot be combined with an explicit output root.");
  }

  if (analysisRoot !== undefined) {
    const layout = resolveAnalysisWorkspace(analysisRoot);
    if (path.resolve(args[0]) !== path.resolve(layout.stagePaths.f2)) {
      throw new Error("Feature 3 current workspace flow requires the exact validated F2 stage path.");
    }
    return {
      outRoot: layout.stagePaths.f3,
      reportJsonName: "Feature3-Report.json",
      reportMdName: "Feature3-Report.md",
      workspaceMode: true,
    };
  }

  const artifactName = safeName(path.basename(path.normalize(args[0])));
  if (!artifactName) throw new Error("Feature 3 artifact output name is empty.");
  return {
    outRoot: override ?? path.posix.join("test", "demo-output", "feature3-output", artifactName),
    reportJsonName: "Feature3-Report.json",
    reportMdName: "Feature3-Report.md",
    workspaceMode: false,
  };
}