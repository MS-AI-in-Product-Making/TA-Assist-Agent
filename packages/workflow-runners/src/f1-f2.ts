import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  f2UserReportSchema,
  worksheetSelectionConfirmationSchema,
  worksheetSelectionPromptSchema,
  type F2UserReport,
} from "@ai-assist/contracts";

import { assertAnalysisWorkspaceWorkbookIdentity, validateAnalysisWorkspaceLayout } from "./analysis-workspace.js";
import { normalizeRunnerError } from "./error-normalizer.js";
import { isWithinOrEqual } from "./path-containment.js";
import type {
  F1F2ConfirmedRequest,
  F1F2ConfirmedResult,
  F1F2SelectionRequest,
  F1F2SelectionReference,
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
  selection: { status: string; selectedWorksheetNames: string[]; promptPath?: string; workbookContentHash?: string };
  execution?: { status: string; boundAt?: string; resumedAt?: string; completedAt?: string; failedAt?: string; error?: { name: string; message: string } };
  stages: Record<string, Record<string, unknown>>;
  error?: { name: string; message: string };
}

interface SelectionRegistryEntry {
  readonly runId: string;
  readonly runRoot: string;
  readonly manifestPath: string;
  readonly promptPath: string;
  readonly workbookPath: string;
  readonly workbookContentHash: string;
  readonly status: "selectionRequired" | "confirmed" | "completed";
}

interface SelectionRegistry {
  readonly contractVersion: "v1";
  readonly selections: readonly SelectionRegistryEntry[];
}

const SELECTION_REGISTRY_FILE = "f2-selection-registry.json";
const EXECUTION_STATUS = {
  waitingConfirmation: "waiting_confirmation",
  confirmedPendingExecution: "confirmed_pending_execution",
  running: "running",
  failedRetryable: "failed_retryable",
  completed: "completed",
} as const;

type ExecutionStatus = (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
}

function errorDetails(error: unknown): { name: string; message: string } {
  return { name: error instanceof Error ? error.name : "Error", message: error instanceof Error ? error.message : String(error) };
}

function sameWorksheetSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((name) => right.includes(name));
}

function executionStatus(manifest: WorkflowManifest): ExecutionStatus {
  const status = manifest.execution?.status;
  if (status === EXECUTION_STATUS.waitingConfirmation
    || status === EXECUTION_STATUS.confirmedPendingExecution
    || status === EXECUTION_STATUS.running
    || status === EXECUTION_STATUS.failedRetryable
    || status === EXECUTION_STATUS.completed) {
    return status;
  }
  if (manifest.status === "completed") return EXECUTION_STATUS.completed;
  if (manifest.status === "failed" && manifest.selection.status === "confirmed") return EXECUTION_STATUS.failedRetryable;
  if (manifest.status === "running" && manifest.selection.status === "confirmed") return EXECUTION_STATUS.running;
  if (manifest.selection.status === "confirmed") return EXECUTION_STATUS.confirmedPendingExecution;
  return EXECUTION_STATUS.waitingConfirmation;
}

function setExecutionStatus(
  manifest: WorkflowManifest,
  status: ExecutionStatus,
  now: () => Date,
  options: { readonly error?: { name: string; message: string }; readonly preserveError?: boolean } = {},
): void {
  const timestamp = now().toISOString();
  const nextExecution = { ...(manifest.execution ?? {}), status };
  if (status === EXECUTION_STATUS.confirmedPendingExecution && nextExecution.boundAt === undefined) nextExecution.boundAt = timestamp;
  if (status === EXECUTION_STATUS.running) nextExecution.resumedAt = timestamp;
  if (status === EXECUTION_STATUS.failedRetryable) nextExecution.failedAt = timestamp;
  if (status === EXECUTION_STATUS.completed) nextExecution.completedAt = timestamp;
  if (options.error) nextExecution.error = options.error;
  else if (!options.preserveError) delete nextExecution.error;
  manifest.execution = nextExecution;
}

function stageStatus(manifest: WorkflowManifest, stage: string): string {
  return typeof manifest.stages[stage]?.status === "string" ? String(manifest.stages[stage]?.status) : "pending";
}

function featureArtifactPath(root: string, fileName: string): string {
  return path.join(root, fileName);
}

function ensureStageArtifactAbsent(root: string, fileName: string, label: string): void {
  const artifactPath = featureArtifactPath(root, fileName);
  if (!existsSync(artifactPath)) return;
  ensureContainedPhysicalPath(root, artifactPath, label, "file");
  throw new Error(`${label} identity mismatch.`);
}

function ensureStageArtifactPresent(root: string, fileName: string, label: string): string {
  const artifactPath = featureArtifactPath(root, fileName);
  return ensureContainedPhysicalPath(root, artifactPath, label, "file");
}

function buildCompletedResult(
  confirmation: ReturnType<typeof worksheetSelectionConfirmationSchema.parse>,
  layout: { runId: string; runRoot: string; f1Root: string; f2Root: string; validationRoot: string; manifestPath: string },
): F1F2ConfirmedResult {
  const report = parseCompletedReport(ensureStageArtifactPresent(layout.f2Root, "Feature2-Report.json", "Feature 2 report"));
  return {
    featureId: "F2",
    status: report.status === "partiallyBlocked" ? "partiallyBlocked" : "completed",
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

function createLayout(managedOutputRoot: string, workbookPath: string, now: () => Date, analysisWorkspace?: F1F2SelectionRequest["analysisWorkspace"]) {
  if (analysisWorkspace) {
    validateAnalysisWorkspaceLayout(analysisWorkspace);
    if (analysisWorkspace.workbookFileName !== path.basename(workbookPath)) {
      throw new Error("Feature 2 analysis workspace workbook identity mismatch.");
    }
    return {
      startedAt: now().toISOString(),
      runId: path.basename(analysisWorkspace.analysisRoot),
      runRoot: analysisWorkspace.analysisRoot,
      f1Root: analysisWorkspace.stagePaths.f1,
      f2Root: analysisWorkspace.stagePaths.f2,
      validationRoot: analysisWorkspace.stagePaths.f2,
      manifestPath: path.join(analysisWorkspace.analysisRoot, "manifest.json"),
    };
  }
  ensureCreationPathIsPhysical(managedOutputRoot, "Feature 2 managed output root");
  const workbookName = safeName(path.basename(workbookPath, path.extname(workbookPath)));
  if (!workbookName) throw new Error("Feature 2 workbook output name is empty.");
  const startedAt = now().toISOString();
  const runId = startedAt.replace(/[:.]/g, "-");
  const runRoot = path.join(path.resolve(managedOutputRoot), "f2-runs", workbookName, runId);
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

function pathChain(value: string): string[] {
  const absolute = path.resolve(value);
  const root = path.parse(absolute).root;
  const segments = path.relative(root, absolute).split(path.sep).filter(Boolean);
  const chain = [root];
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    chain.push(current);
  }
  return chain;
}

function ensureCreationPathIsPhysical(targetPath: string, label: string): string {
  const chain = pathChain(targetPath);
  for (const candidate of chain.slice(1)) {
    if (!existsSync(candidate)) return path.resolve(targetPath);
    const stats = lstatSync(candidate);
    if (stats.isSymbolicLink()) throw new Error(`${label} is invalid.`);
  }
  const targetStats = lstatSync(path.resolve(targetPath));
  if (targetStats.isSymbolicLink()) throw new Error(`${label} is invalid.`);
  return path.resolve(targetPath);
}

function ensurePhysicalPath(targetPath: string, label: string, kind: "file" | "directory"): string {
  const absolute = path.resolve(targetPath);
  for (const candidate of pathChain(absolute).slice(1)) {
    if (!existsSync(candidate)) throw new Error(`${label} is missing.`);
    const stats = lstatSync(candidate);
    if (stats.isSymbolicLink()) throw new Error(`${label} is invalid.`);
  }
  const targetStats = lstatSync(absolute);
  if (targetStats.isSymbolicLink()) throw new Error(`${label} is invalid.`);
  if (kind === "file" && !targetStats.isFile()) throw new Error(`${label} is invalid.`);
  if (kind === "directory" && !targetStats.isDirectory()) throw new Error(`${label} is invalid.`);
  return realpathSync(absolute);
}

function ensureContainedPhysicalPath(rootPath: string, targetPath: string, label: string, kind: "file" | "directory"): string {
  const rootRealPath = ensurePhysicalPath(rootPath, "Feature 2 managed output root", "directory");
  const targetRealPath = ensurePhysicalPath(targetPath, label, kind);
  if (!isWithinOrEqual(rootRealPath, targetRealPath)) throw new Error(`${label} must stay inside the managed output root.`);
  return targetRealPath;
}

function throwIfAborted(context: RunContext, stage: string): void {
  if (!context.signal.aborted) return;
  throw normalizeRunnerError(new Error(`AbortError: signal already aborted before ${stage}.`), {
    fallbackRunId: context.attemptId,
    affectedInputReferences: [stage],
  });
}

function validateWorkbook(repositoryRoot: string, workbookPath: string): string {
  const workbook = path.resolve(repositoryRoot, workbookPath);
  if (path.extname(workbook).toLowerCase() !== ".xlsx") throw new Error("Feature 2 Excel workflow requires exactly one .xlsx workbook.");
  if (!existsSync(workbook)) throw new Error(`Feature 2 workbook does not exist: ${workbookPath}`);
  const workbookStats = lstatSync(workbook);
  if (!workbookStats.isFile() || workbookStats.isSymbolicLink()) throw new Error(`Feature 2 workbook does not exist: ${workbookPath}`);
  return workbook;
}

function selectionRegistryPath(managedOutputRoot: string): string {
  return path.join(path.resolve(managedOutputRoot), SELECTION_REGISTRY_FILE);
}

function loadSelectionRegistry(managedOutputRoot: string): SelectionRegistry {
  const registryPath = selectionRegistryPath(managedOutputRoot);
  if (!existsSync(registryPath)) return { contractVersion: "v1", selections: [] };
  const parsed = JSON.parse(readFileSync(registryPath, "utf8")) as SelectionRegistry;
  if (parsed.contractVersion !== "v1" || !Array.isArray(parsed.selections)) throw new Error("Feature 2 selection registry is invalid.");
  return parsed;
}

function persistSelectionRegistry(managedOutputRoot: string, registry: SelectionRegistry): void {
  mkdirSync(path.resolve(managedOutputRoot), { recursive: true });
  writeFileSync(selectionRegistryPath(managedOutputRoot), `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

function upsertSelectionRegistryEntry(managedOutputRoot: string, entry: SelectionRegistryEntry): void {
  const registry = loadSelectionRegistry(managedOutputRoot);
  const selections = registry.selections.filter((candidate) => candidate.runId !== entry.runId
    && !(entry.status === "selectionRequired"
      && candidate.status === "selectionRequired"
      && candidate.workbookPath === entry.workbookPath
      && candidate.workbookContentHash === entry.workbookContentHash));
  selections.push(entry);
  persistSelectionRegistry(managedOutputRoot, { contractVersion: "v1", selections });
}

function updateSelectionRegistryStatus(managedOutputRoot: string, runId: string, status: SelectionRegistryEntry["status"]): void {
  const registry = loadSelectionRegistry(managedOutputRoot);
  let changed = false;
  const selections = registry.selections.map((entry) => {
    if (entry.runId !== runId || entry.status === status) return entry;
    changed = true;
    return { ...entry, status };
  });
  if (changed) persistSelectionRegistry(managedOutputRoot, { contractVersion: "v1", selections });
}

function selectionReferenceFor(layout: { runId: string; runRoot: string; manifestPath: string }, promptPath: string): F1F2SelectionReference {
  return {
    runId: layout.runId,
    runRoot: layout.runRoot,
    manifestPath: layout.manifestPath,
    promptPath,
  };
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
    execution: { status: worksheetNames === undefined ? EXECUTION_STATUS.waitingConfirmation : EXECUTION_STATUS.confirmedPendingExecution },
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

function parseManifest(manifestPath: string): WorkflowManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as WorkflowManifest;
}

function explicitSelectionReference(request: F1F2ConfirmedRequest): F1F2SelectionReference | undefined {
  return request.selectionReference;
}

function registrySelectionReference(
  request: F1F2ConfirmedRequest,
  context: RunContext,
  workbook: string,
): F1F2SelectionReference {
  const registry = loadSelectionRegistry(context.managedOutputRoot);
  const matches = registry.selections.filter((entry) => entry.workbookPath === workbook
    && entry.workbookContentHash === request.workbookContentHash);

  if (matches.length === 0) throw new Error("Feature 2 pending selection was not found.");

  const stale = [] as SelectionRegistryEntry[];
  const waiting = [] as SelectionRegistryEntry[];
  const confirmed = [] as SelectionRegistryEntry[];
  for (const entry of matches) {
    try {
      ensureContainedPhysicalPath(context.managedOutputRoot, entry.manifestPath, "Feature 2 selection manifest", "file");
      const manifest = parseManifest(entry.manifestPath);
      const promptPath = manifest.selection.promptPath;
      if (typeof promptPath !== "string" || promptPath !== entry.promptPath) {
        stale.push(entry);
        continue;
      }
      ensurePhysicalPath(promptPath, "Feature 2 selection prompt path", "file");
      const prompt = worksheetSelectionPromptSchema.parse(JSON.parse(readFileSync(promptPath, "utf8")));
      const availableNames = prompt.options.map((option) => option.worksheetName);
      const selectionStatus = manifest.selection.status;
      const execution = executionStatus(manifest);
      const requestMatchesPrompt = request.selectedWorksheetNames.length > 0
        && request.selectedWorksheetNames.every((name) => availableNames.includes(name));
      const requestMatchesConfirmed = selectionStatus === "confirmed"
        && manifest.selection.workbookContentHash === request.workbookContentHash
        && sameWorksheetSet(manifest.selection.selectedWorksheetNames, request.selectedWorksheetNames);
      const isWaitingForInitialConfirmation = selectionStatus === "selectionRequired"
        && execution === EXECUTION_STATUS.waitingConfirmation
        && requestMatchesPrompt;
      const isRetryOrCompleted = requestMatchesConfirmed
        && (execution === EXECUTION_STATUS.confirmedPendingExecution
          || execution === EXECUTION_STATUS.running
          || execution === EXECUTION_STATUS.failedRetryable
          || execution === EXECUTION_STATUS.completed);
      if (isWaitingForInitialConfirmation) waiting.push(entry);
      else if (isRetryOrCompleted) confirmed.push(entry);
      else stale.push(entry);
    } catch {
      stale.push(entry);
    }
  }

  if (waiting.length === 1) {
    const candidate = waiting[0]!;
    return {
      runId: candidate.runId,
      runRoot: candidate.runRoot,
      manifestPath: candidate.manifestPath,
      promptPath: candidate.promptPath,
    };
  }
  if (waiting.length > 1) throw new Error("Feature 2 pending selection is ambiguous.");
  if (confirmed.length === 1) {
    const candidate = confirmed[0]!;
    return {
      runId: candidate.runId,
      runRoot: candidate.runRoot,
      manifestPath: candidate.manifestPath,
      promptPath: candidate.promptPath,
    };
  }
  if (confirmed.length > 1) throw new Error("Feature 2 pending selection is ambiguous.");
  if (stale.length > 0) throw new Error("Feature 2 pending selection registry contains stale candidates.");
  throw new Error("Feature 2 pending selection is ambiguous.");
}

function resolveSelectionReference(
  request: F1F2ConfirmedRequest,
  context: RunContext,
  workbook: string,
): F1F2SelectionReference {
  return explicitSelectionReference(request) ?? registrySelectionReference(request, context, workbook);
}

function loadSelectionRun(
  request: F1F2ConfirmedRequest,
  context: RunContext,
  workbook: string,
): { manifest: WorkflowManifest; promptPath: string; prompt: ReturnType<typeof worksheetSelectionPromptSchema.parse> } {
  const selectionReference = resolveSelectionReference(request, context, workbook);
  ensureContainedPhysicalPath(context.managedOutputRoot, selectionReference.manifestPath, "Feature 2 selection manifest", "file");
  const manifest = parseManifest(selectionReference.manifestPath);
  if (manifest.contractVersion !== "v1") throw new Error("Feature 2 selection manifest contract version mismatch.");
  if (manifest.runId !== selectionReference.runId || manifest.runRoot !== selectionReference.runRoot) {
    throw new Error("Feature 2 selection reference identity mismatch.");
  }
  if (manifest.repositoryRoot !== context.repositoryRoot) throw new Error("Feature 2 selection manifest repository mismatch.");
  const realRunRoot = ensureContainedPhysicalPath(context.managedOutputRoot, manifest.runRoot, "Feature 2 selection run root", "directory");
  if (manifest.workbookPath !== workbook) throw new Error("Feature 2 selection workbook identity mismatch.");
  const promptPath = manifest.selection.promptPath;
  if (typeof promptPath !== "string" || promptPath !== selectionReference.promptPath) {
    throw new Error("Feature 2 selection prompt identity mismatch.");
  }
  const realPromptPath = ensurePhysicalPath(promptPath, "Feature 2 selection prompt path", "file");
  if (!isWithinOrEqual(realRunRoot, realPromptPath)) throw new Error("Feature 2 selection prompt path is invalid.");
  const prompt = worksheetSelectionPromptSchema.parse(JSON.parse(readFileSync(promptPath, "utf8")));
  if (prompt.workbook.contentHash !== request.workbookContentHash) {
    throw new Error("Feature 2 selection workbookContentHash mismatch.");
  }
  if (new Set(request.selectedWorksheetNames).size !== request.selectedWorksheetNames.length) {
    throw new Error("Feature 2 selected worksheet names must be unique.");
  }
  const availableNames = new Set(prompt.options.map((option) => option.worksheetName));
  if (request.selectedWorksheetNames.length === 0 || request.selectedWorksheetNames.some((name) => !availableNames.has(name))) {
    throw new Error("Feature 2 selected worksheet names do not match the selection prompt.");
  }
  if (manifest.selection.status === "confirmed") {
    if (manifest.selection.workbookContentHash !== request.workbookContentHash
      || !sameWorksheetSet(manifest.selection.selectedWorksheetNames, request.selectedWorksheetNames)) {
      throw new Error("Feature 2 confirmed selection identity mismatch.");
    }
  } else if (manifest.selection.status !== "selectionRequired") {
    throw new Error("Feature 2 selection reference is stale.");
  }
  return { manifest, promptPath, prompt };
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
  const featureId = stage === "f1-selection" || stage === "f1" ? "F1" : "F2";
  throwIfAborted(context, stage);
  setExecutionStatus(manifest, EXECUTION_STATUS.running, now, { preserveError: true });
  manifest.stages[stage] = { status: "running", startedAt: now().toISOString() };
  persistManifest(manifest, manifestPath, now);
  context.emit({ kind: "stage_started", featureId, stage, timestamp: now().toISOString() });
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
    context.emit({ kind: "stage_completed", featureId, stage, timestamp: now().toISOString() });
  } catch (error) {
    const details = errorDetails(error);
    const normalized = normalizeRunnerError(error, { fallbackRunId: context.attemptId, affectedInputReferences: [stage] });
    writeFileSync(path.join(validationRoot, `${stage}.stdout.log`), (error as ExecuteStageResult | undefined)?.stdout ?? "", "utf8");
    writeFileSync(path.join(validationRoot, `${stage}.stderr.log`), (error as ExecuteStageResult | undefined)?.stderr ?? details.message, "utf8");
    manifest.stages[stage] = { ...manifest.stages[stage], status: "failed", failedAt: now().toISOString(), error: details };
    manifest.status = "failed";
    manifest.error = details;
    setExecutionStatus(manifest, EXECUTION_STATUS.failedRetryable, now, { error: details });
    persistManifest(manifest, manifestPath, now);
    context.emit({ kind: "stage_failed", featureId, stage, timestamp: now().toISOString(), detail: normalized.summary });
    throw normalized;
  }
}

function parseCompletedReport(reportPath: string): F2UserReport {
  const parsed = f2UserReportSchema.parse(JSON.parse(readFileSync(reportPath, "utf8")));
  if (parsed.status !== "completed" && parsed.status !== "partiallyBlocked") throw new Error("Feature 2 report must contain at least one ready worksheet before downstream use.");
  return parsed as F2UserReport;
}

export function runF1F2Selection(
  request: F1F2SelectionRequest,
  context: RunContext,
  dependencies: F1F2Dependencies = {},
): F1F2SelectionResult {
  const executeStage = dependencies.executeStage ?? defaultExecuteStage;
  const now = request.now ?? (() => new Date());
  try {
    const workbook = validateWorkbook(context.repositoryRoot, request.workbookPath);
    const layout = createLayout(context.managedOutputRoot, workbook, now, request.analysisWorkspace);
    mkdirSync(layout.validationRoot, { recursive: true });
    ensureContainedPhysicalPath(context.managedOutputRoot, layout.runRoot, "Feature 2 selection run root", "directory");
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
    const generatedPromptPath = path.join(layout.f1Root, "Feature1-Selection.json");
    const prompt = worksheetSelectionPromptSchema.parse(JSON.parse(readFileSync(generatedPromptPath, "utf8")));
    if (request.analysisWorkspace) {
      assertAnalysisWorkspaceWorkbookIdentity(request.analysisWorkspace, path.basename(workbook), prompt.workbook.contentHash);
    }
    const promptPath = path.join(layout.validationRoot, "Feature1-Selection.json");
    writeFileSync(promptPath, `${JSON.stringify(prompt, null, 2)}\n`, "utf8");
    manifest.selection = { status: "selectionRequired", promptPath, workbookContentHash: prompt.workbook.contentHash, selectedWorksheetNames: [] };
    manifest.status = "selectionRequired";
    setExecutionStatus(manifest, EXECUTION_STATUS.waitingConfirmation, now);
    persistManifest(manifest, layout.manifestPath, now);
    upsertSelectionRegistryEntry(context.managedOutputRoot, {
      runId: layout.runId,
      runRoot: layout.runRoot,
      manifestPath: layout.manifestPath,
      promptPath,
      workbookPath: workbook,
      workbookContentHash: prompt.workbook.contentHash,
      status: "selectionRequired",
    });
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
      selectionReference: selectionReferenceFor(layout, promptPath),
    };
  } catch (error) {
    throw normalizeRunnerError(error, { fallbackRunId: context.attemptId, affectedInputReferences: ["f1-selection"] });
  }
}

export function runF1F2Confirmed(
  request: F1F2ConfirmedRequest,
  context: RunContext,
  dependencies: F1F2Dependencies = {},
): F1F2ConfirmedResult {
  const executeStage = dependencies.executeStage ?? defaultExecuteStage;
  const now = request.now ?? (() => new Date());
  try {
    const workbook = validateWorkbook(context.repositoryRoot, request.workbookPath);
    const confirmation = worksheetSelectionConfirmationSchema.parse({
      workbookContentHash: request.workbookContentHash,
      selectedWorksheetNames: [...request.selectedWorksheetNames],
      confirmed: true,
    });
    const loadedRun = loadSelectionRun(request, context, workbook);
    let manifest = loadedRun.manifest;
    const promptPath = loadedRun.promptPath;
    let layout = {
      runId: manifest.runId,
      runRoot: manifest.runRoot,
      f1Root: manifest.outputs.f1Root,
      f2Root: manifest.outputs.f2Root,
      validationRoot: manifest.outputs.validationRoot,
      manifestPath: path.resolve(manifest.runRoot, "manifest.json"),
    };
    if (request.refreshF2 === true && (executionStatus(manifest) === EXECUTION_STATUS.completed || manifest.status === "completed")) {
      const startedAt = now().toISOString();
      const runId = `${startedAt.replace(/[:.]/g, "-")}-f2-refresh`;
      const runRoot = path.join(path.dirname(manifest.runRoot), runId);
      if (existsSync(runRoot)) throw new Error(`Feature 2 refresh run already exists: ${runRoot}`);
      layout = {
        runId,
        runRoot,
        f1Root: manifest.outputs.f1Root,
        f2Root: path.join(runRoot, "f2"),
        validationRoot: path.join(runRoot, "validation"),
        manifestPath: path.join(runRoot, "manifest.json"),
      };
      manifest = {
        ...manifest,
        runId,
        runRoot,
        startedAt,
        updatedAt: startedAt,
        status: "running",
        outputs: { f1Root: layout.f1Root, f2Root: layout.f2Root, validationRoot: layout.validationRoot },
        execution: { status: EXECUTION_STATUS.confirmedPendingExecution, boundAt: startedAt },
        stages: { f1: { ...manifest.stages.f1, status: "completed" }, f2: { status: "pending" }, validation: { status: "pending" } },
      };
      delete manifest.error;
      mkdirSync(runRoot, { recursive: true });
      persistManifest(manifest, layout.manifestPath, now);
      upsertSelectionRegistryEntry(context.managedOutputRoot, {
        runId,
        runRoot,
        manifestPath: layout.manifestPath,
        promptPath,
        workbookPath: workbook,
        workbookContentHash: confirmation.workbookContentHash,
        status: "confirmed",
      });
    }
    mkdirSync(layout.validationRoot, { recursive: true });
    ensureContainedPhysicalPath(context.managedOutputRoot, layout.runRoot, "Feature 2 selection run root", "directory");
    if (executionStatus(manifest) === EXECUTION_STATUS.completed || manifest.status === "completed") {
      updateSelectionRegistryStatus(context.managedOutputRoot, layout.runId, "completed");
      return buildCompletedResult(confirmation, layout);
    }
    if (manifest.selection.status === "selectionRequired") {
      manifest.selection = {
        status: "confirmed",
        promptPath,
        workbookContentHash: confirmation.workbookContentHash,
        selectedWorksheetNames: [...confirmation.selectedWorksheetNames],
      };
      setExecutionStatus(manifest, EXECUTION_STATUS.confirmedPendingExecution, now);
      manifest.status = "running";
      persistManifest(manifest, layout.manifestPath, now);
      updateSelectionRegistryStatus(context.managedOutputRoot, layout.runId, "confirmed");
    }

    const f1StageStatus = stageStatus(manifest, "f1");
    if (f1StageStatus === "completed") {
      ensureStageArtifactPresent(layout.f1Root, "Feature1-Report.json", "Feature 1 report");
    } else {
      ensureStageArtifactAbsent(layout.f1Root, "Feature1-Report.json", "Feature 1 report");
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
    }

    const f2StageStatus = stageStatus(manifest, "f2");
    if (f2StageStatus === "completed") {
      ensureStageArtifactPresent(layout.f2Root, "Feature2-Report.json", "Feature 2 report");
    } else {
      ensureStageArtifactAbsent(layout.f2Root, "Feature2-Report.json", "Feature 2 report");
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
    }

    manifest.stages.validation = { status: "running", startedAt: now().toISOString() };
    persistManifest(manifest, layout.manifestPath, now);
    const reportPath = ensureStageArtifactPresent(layout.f2Root, "Feature2-Report.json", "Feature 2 report");
    const report = parseCompletedReport(reportPath);
    const validation = { status: "valid", validatedAt: now().toISOString(), reportPath, reportStatus: report.status };
    writeFileSync(path.join(layout.validationRoot, "Feature2-Validation.json"), `${JSON.stringify(validation, null, 2)}\n`, "utf8");
    manifest.stages.validation = { ...manifest.stages.validation, status: "completed", completedAt: now().toISOString() };
    manifest.status = "completed";
    delete manifest.error;
    setExecutionStatus(manifest, EXECUTION_STATUS.completed, now);
    persistManifest(manifest, layout.manifestPath, now);
    updateSelectionRegistryStatus(context.managedOutputRoot, layout.runId, "completed");
    context.emit({ kind: "artifact_written", featureId: "F2", stage: "validation", timestamp: now().toISOString(), path: reportPath });
    return {
      featureId: "F2",
      status: report.status === "partiallyBlocked" ? "partiallyBlocked" : "completed",
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
  } catch (error) {
    throw normalizeRunnerError(error, { fallbackRunId: context.attemptId, affectedInputReferences: ["f1", "f2", "validation"] });
  }
}