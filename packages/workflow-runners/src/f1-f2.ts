import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  f2UserReportSchema,
  worksheetSelectionConfirmationSchema,
  worksheetSelectionPromptSchema,
  type F2UserReport,
} from "@ai-assist/contracts";

import { normalizeRunnerError } from "./error-normalizer.js";
import type {
  F1F2ConfirmedRequest,
  F1F2ConfirmedResult,
  F1F2SelectionRequest,
  F1F2SelectionResult,
  RunContext,
} from "./types.js";

export interface ExecuteStageRequest {
  readonly stage: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}

export interface ExecuteStageResult {
  readonly stdout?: string;
  readonly stderr?: string;
}

export interface F1F2Dependencies {
  readonly executeStage?: (request: ExecuteStageRequest) => ExecuteStageResult;
}

interface WorkflowManifest {
  contractVersion: string;
  runId: string;
  status: string;
  workbookPath: string;
  repositoryRoot: string;
  runRoot: string;
  startedAt: string;
  updatedAt: string;
  outputs: { f1Root: string; f2Root: string; validationRoot: string };
  selection: { status: string; selectedWorksheetNames: string[]; promptPath?: string };
  stages: Record<string, Record<string, unknown>>;
  error?: { name: string; message: string };
}

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
}

function errorDetails(error: unknown): { name: string; message: string } {
  return { name: error instanceof Error ? error.name : "Error", message: error instanceof Error ? error.message : String(error) };
}

function defaultExecuteStage({ command, args, cwd, env }: ExecuteStageRequest): ExecuteStageResult {
  const result = spawnSync(command, [...args], { cwd, env, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = Object.assign(
      new Error(`Workflow stage exited with code ${result.status}: ${result.stderr || result.stdout}`.trim()),
      { stdout: result.stdout ?? "", stderr: result.stderr ?? "" },
    );
    throw error;
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function createLayout(repositoryRoot: string, workbookPath: string, now: () => Date) {
  const workbookName = safeName(path.basename(workbookPath, path.extname(workbookPath)));
  if (!workbookName) throw new Error("Feature 2 workbook output name is empty.");
  const startedAt = now().toISOString();
  const runId = startedAt.replace(/[:.]/g, "-");
  const runRoot = path.join(repositoryRoot, "test", "demo-output", "f2-runs", workbookName, runId);
  if (existsSync(runRoot)) throw new Error(`Feature 2 run already exists: ${runRoot}`);
  return {
    startedAt,
    runId,
    runRoot,
    f1Root: path.join(runRoot, "f1"),
    f2Root: path.join(runRoot, "f2"),
    validationRoot: path.join(runRoot, "validation"),
    manifestPath: path.join(runRoot, "manifest.json"),
  };
}

function validateWorkbook(repositoryRoot: string, workbookPath: string): string {
  const workbook = path.resolve(repositoryRoot, workbookPath);
  if (path.extname(workbook).toLowerCase() !== ".xlsx") throw new Error("Feature 2 Excel workflow requires exactly one .xlsx workbook.");
  if (!existsSync(workbook) || !statSync(workbook).isFile()) throw new Error(`Feature 2 workbook does not exist: ${workbookPath}`);
  return workbook;
}

function initialManifest(repositoryRoot: string, workbook: string, layout: ReturnType<typeof createLayout>, worksheetNames: readonly string[] | undefined): WorkflowManifest {
  return {
    contractVersion: "v1",
    runId: layout.runId,
    status: "running",
    workbookPath: workbook,
    repositoryRoot,
    runRoot: layout.runRoot,
    startedAt: layout.startedAt,
    updatedAt: layout.startedAt,
    outputs: { f1Root: layout.f1Root, f2Root: layout.f2Root, validationRoot: layout.validationRoot },
    selection: {
      status: worksheetNames === undefined ? "pending" : "confirmed",
      selectedWorksheetNames: worksheetNames ? [...worksheetNames] : [],
    },
    stages: {
      "f1-selection": { status: "pending" },
      f1: { status: "pending" },
      f2: { status: "pending" },
      validation: { status: "pending" },
    },
  };
}

function persistManifest(manifest: WorkflowManifest, manifestPath: string, now: () => Date): void {
  manifest.updatedAt = now().toISOString();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function runStage(
  context: RunContext,
  manifest: WorkflowManifest,
  manifestPath: string,
  validationRoot: string,
  stage: string,
  args: readonly string[],
  outputVariable: "AI_TVA_F1_OUTPUT_ROOT" | "AI_TVA_F2_OUTPUT_ROOT",
  outputRoot: string,
  executeStage: (request: ExecuteStageRequest) => ExecuteStageResult,
  now: () => Date,
): void {
  manifest.stages[stage] = { status: "running", startedAt: now().toISOString() };
  persistManifest(manifest, manifestPath, now);
  context.emit({ kind: "stage_started", featureId: "F2", stage, timestamp: now().toISOString() });
  try {
    const result = executeStage({
      stage,
      command: process.execPath,
      args,
      cwd: context.repositoryRoot,
      env: { ...process.env, [outputVariable]: outputRoot },
    }) ?? {};
    writeFileSync(path.join(validationRoot, `${stage}.stdout.log`), result.stdout ?? "", "utf8");
    writeFileSync(path.join(validationRoot, `${stage}.stderr.log`), result.stderr ?? "", "utf8");
    manifest.stages[stage] = { ...manifest.stages[stage], status: "completed", completedAt: now().toISOString() };
    persistManifest(manifest, manifestPath, now);
    context.emit({ kind: "stage_completed", featureId: "F2", stage, timestamp: now().toISOString() });
  } catch (error) {
    const details = errorDetails(error);
    const normalized = normalizeRunnerError(error, { fallbackRunId: context.attemptId, affectedInputReferences: [stage] });
    writeFileSync(path.join(validationRoot, `${stage}.stdout.log`), (error as ExecuteStageResult | undefined)?.stdout ?? "", "utf8");
    writeFileSync(path.join(validationRoot, `${stage}.stderr.log`), (error as ExecuteStageResult | undefined)?.stderr ?? details.message, "utf8");
    manifest.stages[stage] = { ...manifest.stages[stage], status: "failed", failedAt: now().toISOString(), error: details };
    manifest.status = "failed";
    manifest.error = details;
    persistManifest(manifest, manifestPath, now);
    context.emit({ kind: "stage_failed", featureId: "F2", stage, timestamp: now().toISOString(), detail: normalized.summary });
    throw error;
  }
}

function parseCompletedReport(reportPath: string): F2UserReport {
  const parsed = f2UserReportSchema.parse(JSON.parse(readFileSync(reportPath, "utf8")));
  if (parsed.status !== "completed") throw new Error("Feature 2 report must be completed before downstream use.");
  return parsed as F2UserReport;
}

export function runF1F2Selection(
  request: F1F2SelectionRequest,
  context: RunContext,
  dependencies: F1F2Dependencies = {},
): F1F2SelectionResult {
  const executeStage = dependencies.executeStage ?? defaultExecuteStage;
  const now = request.now ?? (() => new Date());
  const workbook = validateWorkbook(context.repositoryRoot, request.workbookPath);
  const layout = createLayout(context.repositoryRoot, workbook, now);
  mkdirSync(layout.validationRoot, { recursive: true });
  const manifest = initialManifest(context.repositoryRoot, workbook, layout, undefined);
  persistManifest(manifest, layout.manifestPath, now);
  runStage(
    context,
    manifest,
    layout.manifestPath,
    layout.validationRoot,
    "f1-selection",
    ["scripts/run-f1-full-validation.mjs", workbook, "--selection-only"],
    "AI_TVA_F1_OUTPUT_ROOT",
    layout.f1Root,
    executeStage,
    now,
  );
  const promptPath = path.join(layout.f1Root, "Feature1-Selection.json");
  const prompt = worksheetSelectionPromptSchema.parse(JSON.parse(readFileSync(promptPath, "utf8")));
  manifest.selection = { status: "selectionRequired", promptPath, selectedWorksheetNames: [] };
  manifest.status = "selectionRequired";
  persistManifest(manifest, layout.manifestPath, now);
  return {
    featureId: "F2",
    status: "selectionRequired",
    prompt,
    workbookContentHash: prompt.workbook.contentHash,
    selectedWorksheetNames: [],
    runId: layout.runId,
    runRoot: layout.runRoot,
    f1Root: layout.f1Root,
    f2Root: layout.f2Root,
    validationRoot: layout.validationRoot,
    manifestPath: layout.manifestPath,
    promptPath,
  };
}

export function runF1F2Confirmed(
  request: F1F2ConfirmedRequest,
  context: RunContext,
  dependencies: F1F2Dependencies = {},
): F1F2ConfirmedResult {
  const executeStage = dependencies.executeStage ?? defaultExecuteStage;
  const now = request.now ?? (() => new Date());
  const workbook = validateWorkbook(context.repositoryRoot, request.workbookPath);
  const confirmation = worksheetSelectionConfirmationSchema.parse({
    workbookContentHash: request.workbookContentHash,
    selectedWorksheetNames: [...request.selectedWorksheetNames],
    confirmed: true,
  });
  const layout = createLayout(context.repositoryRoot, workbook, now);
  mkdirSync(layout.validationRoot, { recursive: true });
  const manifest = initialManifest(context.repositoryRoot, workbook, layout, confirmation.selectedWorksheetNames);
  persistManifest(manifest, layout.manifestPath, now);
  runStage(
    context,
    manifest,
    layout.manifestPath,
    layout.validationRoot,
    "f1",
    [
      "scripts/run-f1-full-validation.mjs",
      workbook,
      "--workbook-hash",
      confirmation.workbookContentHash,
      "--worksheets",
      confirmation.selectedWorksheetNames.join(","),
      "--confirm",
    ],
    "AI_TVA_F1_OUTPUT_ROOT",
    layout.f1Root,
    executeStage,
    now,
  );
  runStage(
    context,
    manifest,
    layout.manifestPath,
    layout.validationRoot,
    "f2",
    ["scripts/run-f2-full-validation.mjs", layout.f1Root],
    "AI_TVA_F2_OUTPUT_ROOT",
    layout.f2Root,
    executeStage,
    now,
  );

  manifest.stages.validation = { status: "running", startedAt: now().toISOString() };
  persistManifest(manifest, layout.manifestPath, now);
  const reportPath = path.join(layout.f2Root, "Feature2-Report.json");
  const report = parseCompletedReport(reportPath);
  const validation = { status: "valid", validatedAt: now().toISOString(), reportPath, reportStatus: report.status };
  writeFileSync(path.join(layout.validationRoot, "Feature2-Validation.json"), `${JSON.stringify(validation, null, 2)}\n`, "utf8");
  manifest.stages.validation = { ...manifest.stages.validation, status: "completed", completedAt: now().toISOString() };
  manifest.status = "completed";
  persistManifest(manifest, layout.manifestPath, now);
  context.emit({ kind: "artifact_written", featureId: "F2", stage: "validation", timestamp: now().toISOString(), path: reportPath });
  return {
    featureId: "F2",
    status: "completed",
    workbookContentHash: confirmation.workbookContentHash,
    selectedWorksheetNames: [...confirmation.selectedWorksheetNames],
    runId: layout.runId,
    runRoot: layout.runRoot,
    f1Root: layout.f1Root,
    f2Root: layout.f2Root,
    validationRoot: layout.validationRoot,
    manifestPath: layout.manifestPath,
    report,
  };
}