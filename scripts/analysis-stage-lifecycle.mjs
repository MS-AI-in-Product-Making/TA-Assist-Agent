import { createHash } from "node:crypto";
import { closeSync, lstatSync, openSync, readFileSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import {
  ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME, assertAnalysisWorkspaceWorkbookIdentity,
  recordAnalysisStageCompleted, recordAnalysisStageFailed, recordAnalysisStageStarted,
  resolveAnalysisWorkspaceStagePaths, validateAnalysisWorkspaceLayout,
  validateAnalysisWorkspaceSummary, writeAnalysisWorkspaceSummary,
} from "../packages/workflow-runners/dist/index.js";
import { validateAnalysisStageArtifacts } from "./analysis-stage-validation.mjs";
import { validateF6Candidate } from "./f6-candidate.mjs";

function failure() { return new Error("Analysis workspace validation failed; this run cannot continue."); }
function readJson(file) { return JSON.parse(readFileSync(file, "utf8")); }

export function analysisRootArgument(args) {
  const indexes = args.flatMap((value, index) => value === "--analysis-root" ? [index] : []);
  if (indexes.length === 0) return undefined;
  const value = args[indexes[0] + 1];
  if (indexes.length !== 1 || !value || !path.isAbsolute(value)) throw failure();
  return value;
}

export function withoutAnalysisRoot(args) {
  const index = args.indexOf("--analysis-root");
  return index < 0 ? args : [...args.slice(0, index), ...args.slice(index + 2)];
}

function assertCanonical(target, directory) {
  const resolved = path.resolve(target);
  let current = path.parse(resolved).root;
  for (const segment of path.relative(current, resolved).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (lstatSync(current).isSymbolicLink()) throw failure();
  }
  const stats = lstatSync(resolved);
  if (directory ? !stats.isDirectory() : !stats.isFile()) throw failure();
  if (realpathSync(resolved) !== resolved) throw failure();
}

export function loadWorkspace(analysisRoot) {
  assertCanonical(analysisRoot, true);
  const summaryPath = path.join(analysisRoot, ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME);
  assertCanonical(summaryPath, false);
  const summary = readJson(summaryPath);
  validateAnalysisWorkspaceSummary(summary);
  if (summary.analysisRoot !== analysisRoot || summary.summaryPath !== summaryPath) throw failure();
  const layout = {
    contractVersion: summary.contractVersion, analysisRoot, summaryPath,
    workbookFileName: summary.workbook.fileName, workbookContentHash: summary.workbook.contentHash,
    allocationDate: summary.allocationDate, stagePaths: resolveAnalysisWorkspaceStagePaths(analysisRoot),
  };
  validateAnalysisWorkspaceLayout(layout);
  for (const stagePath of Object.values(layout.stagePaths)) assertCanonical(stagePath, true);
  return { summary, layout };
}

function validateWorkbook(layout, stage, args) {
  let workbookPath;
  if (stage === "f1") {
    workbookPath = withoutAnalysisRoot(args)[0];
  } else {
    const reportPath = path.join(layout.stagePaths.f1, "Feature1-Report.json");
    assertCanonical(reportPath, false);
    const report = readJson(reportPath);
    if (report.workbooks?.length !== 1) throw failure();
    const workbook = report.workbooks[0];
    assertAnalysisWorkspaceWorkbookIdentity(layout, workbook.workbook?.fileName, workbook.workbook?.contentHash);
    workbookPath = workbook.workbookPath;
    const index = args.indexOf("--workbook");
    if (index !== -1 && path.resolve(args[index + 1]) !== path.resolve(workbookPath)) throw failure();
  }
  if (!workbookPath || !path.isAbsolute(workbookPath)) throw failure();
  assertAnalysisWorkspaceWorkbookIdentity(layout, path.basename(workbookPath),
    createHash("sha256").update(readFileSync(workbookPath)).digest("hex"));
}

// The lock serializes the read/start/write transaction across processes. A crash
// deliberately leaves a lock/running summary, never a resumable success state.
export function runAnalysisStage({ stage, args = [], selectionOnly = false, candidate = false, afterCompleted }, execute) {
  if (candidate && stage !== "f6") throw failure();
  const analysisRoot = analysisRootArgument(args);
  if (analysisRoot === undefined) return execute();
  const initial = loadWorkspace(analysisRoot);
  recordAnalysisStageStarted(initial.summary, stage);
  const lockPath = path.join(analysisRoot, ".analysis-stage.lock");
  const lock = openSync(lockPath, "wx");
  let running;
  let layout;
  let completionWritten = false;
  let released = false;
  function release() {
    if (released) return;
    released = true;
    closeSync(lock);
    rmSync(lockPath);
  }
  function fail(error) {
    try {
      if (running && !completionWritten) {
        loadWorkspace(analysisRoot);
        writeAnalysisWorkspaceSummary(layout, recordAnalysisStageFailed(running, stage, "stage_execution_failed"));
      }
    } finally { release(); }
    throw error;
  }
  function complete(result) {
    loadWorkspace(analysisRoot);
    if (!selectionOnly) {
      if (["failed", "inputRejected", "input_rejected", "rejected"].includes(result?.status)) {
        writeAnalysisWorkspaceSummary(layout, recordAnalysisStageFailed(running, stage, "stage_execution_failed"));
        release();
        return { status: "failed", reasonCode: result.reasonCode ?? "stage_execution_failed" };
      }
      validateWorkbook(layout, stage, args);
      if (candidate) {
        validateF6Candidate(layout, args);
        writeAnalysisWorkspaceSummary(layout, initial.summary);
      } else {
        const artifacts = validateAnalysisStageArtifacts(layout, stage);
        const completed = recordAnalysisStageCompleted(running, stage, artifacts);
        writeAnalysisWorkspaceSummary(layout, completed);
        completionWritten = true;
        if (JSON.stringify(loadWorkspace(analysisRoot).summary) !== JSON.stringify(completed)) throw failure();
        afterCompleted?.(layout, result);
      }
    }
    release();
    return result;
  }
  try {
    const loaded = loadWorkspace(analysisRoot);
    layout = loaded.layout;
    running = recordAnalysisStageStarted(loaded.summary, stage);
    // A selection prompt is not a completed F1 run; it pauses for confirmation.
    if (!selectionOnly) writeAnalysisWorkspaceSummary(layout, running);
    validateWorkbook(layout, stage, args);
    const result = execute(layout);
    if (result && typeof result.then === "function") return result.then(complete).catch(fail);
    return complete(result);
  } catch (error) { return fail(error); }
}
