import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
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
  readonly status: "selectionRequired" | "confirmed";
}

interface SelectionRegistry {
  readonly contractVersion: "v1";
  readonly selections: readonly SelectionRegistryEntry[];
}

const SELECTION_REGISTRY_FILE = "f2-selection-registry.json";

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

function createLayout(managedOutputRoot: string, workbookPath: string, now: () => Date) {
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

function isWithinOrEqual(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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
  const selections = registry.selections.filter((candidate) => candidate.runId !== entry.runId);
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
  const matches = registry.selections.filter((entry) => entry.status === "selectionRequired"
    && entry.workbookPath === workbook
    && entry.workbookContentHash === request.workbookContentHash);

  if (matches.length === 0) throw new Error("Feature 2 pending selection was not found.");

  const stale = [] as SelectionRegistryEntry[];
  const valid = [] as SelectionRegistryEntry[];
  for (const entry of matches) {
    try {
      ensureContainedPhysicalPath(context.managedOutputRoot, entry.manifestPath, "Feature 2 selection manifest", "file");
      const manifest = parseManifest(entry.manifestPath);
      const promptPath = manifest.selection.promptPath;
      if (manifest.status !== "selectionRequired" || manifest.selection.status !== "selectionRequired"
        || typeof promptPath !== "string" || promptPath !== entry.promptPath) {
        stale.push(entry);
        continue;
      }
      ensurePhysicalPath(promptPath, "Feature 2 selection prompt path", "file");
      valid.push(entry);
    } catch {
      stale.push(entry);
    }
  }

  if (stale.length > 0) throw new Error("Feature 2 pending selection registry contains stale candidates.");
  if (valid.length !== 1) throw new Error("Feature 2 pending selection is ambiguous.");
  const candidate = valid[0]!;
  return {
    runId: candidate.runId,
    runRoot: candidate.runRoot,
    manifestPath: candidate.manifestPath,
    promptPath: candidate.promptPath,
  };
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
  if (manifest.status !== "selectionRequired" || manifest.selection.status !== "selectionRequired") {
    throw new Error("Feature 2 selection reference is stale.");
  }
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
  const availableNames = new Set(prompt.options.map((option) => option.worksheetName));
  if (request.selectedWorksheetNames.length === 0 || request.selectedWorksheetNames.some((name) => !availableNames.has(name))) {
    throw new Error("Feature 2 selected worksheet names do not match the selection prompt.");
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
  throwIfAborted(context, stage);
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
    throw normalized;
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
  try {
    const workbook = validateWorkbook(context.repositoryRoot, request.workbookPath);
    const layout = createLayout(context.managedOutputRoot, workbook, now);
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
    const promptPath = path.join(layout.f1Root, "Feature1-Selection.json");
    const prompt = worksheetSelectionPromptSchema.parse(JSON.parse(readFileSync(promptPath, "utf8")));
    manifest.selection = { status: "selectionRequired", promptPath, workbookContentHash: prompt.workbook.contentHash, selectedWorksheetNames: [] };
    manifest.status = "selectionRequired";
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
    const { manifest, promptPath } = loadSelectionRun(request, context, workbook);
    const layout = {
      runId: manifest.runId,
      runRoot: manifest.runRoot,
      f1Root: manifest.outputs.f1Root,
      f2Root: manifest.outputs.f2Root,
      validationRoot: manifest.outputs.validationRoot,
      manifestPath: path.resolve(manifest.runRoot, "manifest.json"),
    };
    mkdirSync(layout.validationRoot, { recursive: true });
    ensureContainedPhysicalPath(context.managedOutputRoot, layout.runRoot, "Feature 2 selection run root", "directory");
    manifest.selection = {
      status: "confirmed",
      promptPath,
      workbookContentHash: confirmation.workbookContentHash,
      selectedWorksheetNames: [...confirmation.selectedWorksheetNames],
    };
    manifest.status = "running";
    persistManifest(manifest, layout.manifestPath, now);
    updateSelectionRegistryStatus(context.managedOutputRoot, layout.runId, "confirmed");
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
  } catch (error) {
    throw normalizeRunnerError(error, { fallbackRunId: context.attemptId, affectedInputReferences: ["f1", "f2", "validation"] });
  }
}