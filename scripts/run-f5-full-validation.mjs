import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeRunnerError, runF5Interpretation } from "../packages/workflow-runners/dist/index.js";
import { typedErrorSchema } from "../packages/contracts/dist/index.js";
import { createF5DataInterpretation } from "../packages/workbook-catalog/dist/index.js";
import { loadF5ArtifactBundle } from "./f5-artifact-loader.mjs";
import { parseF5CliArgs } from "./f5-cli-args.mjs";
import { resolveFeature5OutputLayout } from "./f5-output-layout.mjs";
import { renderF5Report } from "./f5-report.mjs";

function normalizeDependencies(overrides = {}) {
  return {
    parseArgs: overrides.parseArgs ?? parseF5CliArgs,
    resolveLayout: overrides.resolveLayout ?? ((parsed, options) => resolveFeature5OutputLayout(
      parsed,
      process.env.AI_TVA_F5_OUTPUT_ROOT,
      options.now,
      process.env.AI_TVA_F5_PUBLISH_ROOT,
    )),
    loadBundle: overrides.loadBundle ?? loadF5ArtifactBundle,
    createInterpretation: overrides.createInterpretation ?? createF5DataInterpretation,
    renderReport: overrides.renderReport ?? renderF5Report,
    mkdir: overrides.mkdir ?? mkdirSync,
    randomUUID: overrides.randomUUID ?? randomUUID,
    realpath: overrides.realpath ?? realpathSync,
    stat: overrides.stat ?? statSync,
    open: overrides.open ?? openSync,
    writeFd: overrides.writeFd ?? ((fd, content) => writeFileSync(fd, content, "utf8")),
    close: overrides.close ?? closeSync,
    rename: overrides.rename ?? renameSync,
    rmdir: overrides.rmdir ?? rmdirSync,
    rm: overrides.rm ?? rmSync,
  };
}

function atomicWrite(filePath, content, dependencies) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  let fd;
  let committed = false;
  try {
    fd = dependencies.open(temporaryPath, "wx");
    dependencies.writeFd(fd, content);
    dependencies.close(fd);
    fd = undefined;
    dependencies.rename(temporaryPath, filePath);
    committed = true;
  } finally {
    if (fd !== undefined) dependencies.close(fd);
    if (!committed) dependencies.rm(temporaryPath, { force: true });
  }
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function outputPaths(layout) {
  return {
    reportJsonPath: path.join(layout.runRoot, layout.reportJsonName),
    reportMdPath: path.join(layout.runRoot, layout.reportMdName),
    runSummaryPath: path.join(layout.runRoot, layout.runSummaryJsonName),
    imageObservationsPath: path.join(layout.runRoot, layout.imageObservationsJsonName),
    manifestPath: path.join(layout.runRoot, layout.manifestName),
  };
}

function failedManifest(layout, reasonCode) {
  return {
    contractVersion: "v1",
    featureId: "F5",
    status: "failed",
    runId: layout.runId,
    reasonCode,
    artifacts: {},
  };
}

function reasonCodeForWorkspacePreflight(error) {
  if (error?.code === "prerequisite_not_ready" && error?.reasonCode === "workspace_stage_not_empty") {
    return "workspace_stage_not_empty";
  }
  const typed = typedErrorSchema.safeParse(error);
  if (typed.success && typed.data.code === "validation_error") {
    return "invalid_arguments_or_output_root";
  }
  const normalized = normalizeRunnerError(error);
  if (normalized.code === "validation_error") {
    return "invalid_arguments_or_output_root";
  }
  return undefined;
}

function safeTypedError(error) {
  const typed = typedErrorSchema.safeParse(error);
  if (typed.success) return typed.data;
  const normalized = normalizeRunnerError(error);
  return {
    code: normalized.code,
    runId: normalized.runId,
    summary: normalized.summary,
    retryable: normalized.retryable,
    suggestedAction: normalized.suggestedAction,
    affectedInputReferences: [...normalized.affectedInputReferences],
  };
}

function classifyCliFailure(error) {
  const reasonCode = reasonCodeForWorkspacePreflight(error);
  if (reasonCode !== undefined) {
    return { stream: "stdout", payload: { status: "failed", reasonCode } };
  }
  if (typeof error?.reasonCode === "string") {
    return { stream: "stdout", payload: { status: "failed", reasonCode: error.reasonCode } };
  }
  return { stream: "stderr", payload: { status: "failed", error: safeTypedError(error) } };
}

function normalizeFailedResult(result) {
  if (result?.status !== "failed" || result?.reasonCode !== "workflow_output_failed") return result;
  const manifestPath = typeof result.manifestPath === "string" ? result.manifestPath : undefined;
  if (manifestPath && existsSync(manifestPath)) return result;
  return { status: "failed", reasonCode: "workflow_output_failed", outputDirectory: result.outputDirectory };
}

export function runF5FullValidation(options = {}, dependencyOverrides = {}) {
  const dependencies = normalizeDependencies(dependencyOverrides);
  const parsed = dependencies.parseArgs(options.args ?? []);
  try {
    return normalizeFailedResult(runF5Interpretation({
      f1ArtifactRoot: parsed.f1ArtifactRoot,
      f3ArtifactRoot: parsed.f3ArtifactRoot,
      f4ArtifactRoot: parsed.f4ArtifactRoot,
      selectedWorksheetNames: parsed.selectedWorksheetNames,
      imageObservationsPath: parsed.imageObservationsPath,
    }, {
      repositoryRoot: process.cwd(),
      managedOutputRoot: process.env.AI_TVA_F5_OUTPUT_ROOT ?? process.cwd(),
      attemptId: "f5-cli",
      signal: new globalThis.AbortController().signal,
      emit: () => {},
    }, {
      resolveOutputLayout: () => dependencies.resolveLayout(parsed, options),
      loadBundle: (request) => dependencies.loadBundle({
        f1ArtifactRoot: request.f1ArtifactRoot,
        f3ArtifactRoot: request.f3ArtifactRoot,
        f4ArtifactRoot: request.f4ArtifactRoot,
        selectedWorksheetNames: request.selectedWorksheetNames,
        imageObservationArtifact: request.imageObservationsPath,
      }),
      createInterpretation: dependencies.createInterpretation,
      renderReport: dependencies.renderReport,
      mkdir: dependencies.mkdir,
      randomUUID: dependencies.randomUUID,
      realpath: dependencies.realpath,
      stat: dependencies.stat,
      open: dependencies.open,
      writeFd: dependencies.writeFd,
      close: dependencies.close,
      rename: dependencies.rename,
      rmdir: dependencies.rmdir,
      rm: dependencies.rm,
    }));
  } catch (error) {
    const reasonCode = reasonCodeForWorkspacePreflight(error);
    if (reasonCode === undefined) throw error;
    const layout = dependencies.resolveLayout(parsed, options);
    if (layout.allowExistingRunRoot) {
      return { status: "failed", reasonCode, outputDirectory: layout.runRoot, manifestPath: path.join(layout.runRoot, layout.manifestName) };
    }
    const paths = outputPaths(layout);
    atomicWrite(paths.manifestPath, json(failedManifest(layout, reasonCode)), dependencies);
    return { status: "failed", reasonCode, outputDirectory: layout.runRoot, manifestPath: paths.manifestPath };
  }
}

function serializeCliResult(result) {
  if (result.status === "failed") {
    return { status: "failed", reasonCode: result.reasonCode };
  }
  return result;
}

export function runF5Cli(options = {}, dependencyOverrides = {}, io = {}) {
  const log = io.log ?? console.log;
  const errorLog = io.errorLog ?? console.error;
  try {
    const result = runF5FullValidation(options, dependencyOverrides);
    log(json(serializeCliResult(result)).trimEnd());
    return result.status === "failed" ? 1 : 0;
  } catch (error) {
    const failure = classifyCliFailure(error);
    if (failure.stream === "stdout") log(json(failure.payload).trimEnd());
    else errorLog(json(failure.payload).trimEnd());
    return 1;
  }
}

function isDirectExecution() {
  return process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  process.exitCode = runF5Cli({ args: process.argv.slice(2) });
}