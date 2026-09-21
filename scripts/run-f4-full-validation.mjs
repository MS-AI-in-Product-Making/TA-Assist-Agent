import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeRunnerError, runF4Calculation } from "../packages/workflow-runners/dist/index.js";
import { typedErrorSchema } from "../packages/contracts/dist/index.js";
import { loadF4Handoffs } from "./f4-artifact-loader.mjs";
import { calculateF4Workflow } from "./f4-calculation-workflow.mjs";
import { compareF4WithExcel } from "./f4-excel-comparison.mjs";
import { buildF4ExcelMapping } from "./f4-excel-mapping.mjs";
import { resolveFeature4OutputLayout } from "./f4-output-layout.mjs";
import { renderF4Report } from "./f4-report.mjs";

function atomicWrite(filePath, content, dependencies) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  let committed = false;
  try {
    dependencies.writeFile(temporaryPath, content, "utf8");
    dependencies.rename(temporaryPath, filePath);
    committed = true;
  } finally {
    if (!committed) dependencies.rm(temporaryPath, { force: true });
  }
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function outputPaths(layout) {
  return {
    calculationJsonPath: path.join(layout.runRoot, layout.calculationJsonName),
    comparisonJsonPath: path.join(layout.runRoot, layout.comparisonJsonName),
    reportMdPath: path.join(layout.runRoot, layout.reportMdName),
    manifestPath: path.join(layout.runRoot, layout.manifestName),
  };
}

function failedManifest(layout, reasonCode) {
  return {
    contractVersion: "v1",
    featureId: "F4",
    status: "failed",
    runId: layout.runId,
    reasonCode,
    calculationStatus: "failed",
    comparisonStatus: "not_started",
    artifacts: {},
  };
}

function normalizeDependencies(overrides = {}) {
  return {
    resolveLayout: overrides.resolveLayout ?? ((args) => resolveFeature4OutputLayout(
      args,
      process.env.AI_TVA_F4_OUTPUT_ROOT,
    )),
    loadHandoffs: overrides.loadHandoffs ?? loadF4Handoffs,
    calculateWorkflow: overrides.calculateWorkflow ?? calculateF4Workflow,
    buildMapping: overrides.buildMapping ?? buildF4ExcelMapping,
    compareWithExcel: overrides.compareWithExcel ?? compareF4WithExcel,
    renderReport: overrides.renderReport ?? renderF4Report,
    mkdir: overrides.mkdir ?? mkdirSync,
    writeFile: overrides.writeFile ?? writeFileSync,
    rename: overrides.rename ?? renameSync,
    rm: overrides.rm ?? rmSync,
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
  const normalized = safeTypedError(error);
  if (normalized.code === "validation_error") {
    return { stream: "stdout", payload: { status: "failed", reasonCode: "invalid_arguments_or_output_root" } };
  }
  return { stream: "stderr", payload: { status: "failed", error: normalized } };
}

export function runF4FullValidation(options = {}, dependencyOverrides = {}) {
  const dependencies = normalizeDependencies(dependencyOverrides);
  const args = options.args ?? [];
  try {
    return runF4Calculation({
      artifactRoot: "",
      workbookPath: undefined,
      generatedAt: options.generatedAt,
    }, {
      repositoryRoot: process.cwd(),
      managedOutputRoot: process.env.AI_TVA_F4_OUTPUT_ROOT ?? process.cwd(),
      attemptId: "f4-cli",
      signal: new globalThis.AbortController().signal,
      emit: () => {},
    }, {
      resolveOutputLayout: () => dependencies.resolveLayout(args),
      loadHandoffs: dependencies.loadHandoffs,
      calculateWorkflow: dependencies.calculateWorkflow,
      buildMapping: dependencies.buildMapping,
      compareWithExcel: dependencies.compareWithExcel,
      renderReport: dependencies.renderReport,
      mkdir: dependencies.mkdir,
      writeFile: dependencies.writeFile,
      rename: dependencies.rename,
      rm: dependencies.rm,
    });
  } catch (error) {
    const reasonCode = reasonCodeForWorkspacePreflight(error);
    if (reasonCode === undefined) throw error;
    const layout = dependencies.resolveLayout(args);
    if (layout.allowExistingRunRoot) {
      return { status: "failed", reasonCode, outputDirectory: layout.runRoot, manifestPath: path.join(layout.runRoot, layout.manifestName) };
    }
    const paths = outputPaths(layout);
    atomicWrite(paths.manifestPath, json(failedManifest(layout, reasonCode)), dependencies);
    return { status: "failed", reasonCode, outputDirectory: layout.runRoot, manifestPath: paths.manifestPath };
  }
}

export function summarizeF4CliResult(result) {
  return {
    status: result.status,
    ...(result.reasonCode ? { reasonCode: result.reasonCode } : {}),
    outputDirectory: result.outputDirectory,
    ...(result.calculationJsonPath ? { calculationJsonPath: result.calculationJsonPath } : {}),
    ...(result.comparisonJsonPath ? { comparisonJsonPath: result.comparisonJsonPath } : {}),
    ...(result.reportMdPath ? { reportMdPath: result.reportMdPath } : {}),
    manifestPath: result.manifestPath,
    ...(result.summary ? { summary: result.summary } : {}),
  };
}

function serializeCliResult(result) {
  if (result.status === "failed"
    && (result.reasonCode === "invalid_arguments_or_output_root" || result.reasonCode === "workspace_stage_not_empty")) {
    return { status: "failed", reasonCode: result.reasonCode };
  }
  return summarizeF4CliResult(result);
}

export function runF4CliMain({
  args = process.argv.slice(2),
  runFullValidation = runF4FullValidation,
  writeStdout = (value) => process.stdout.write(value),
  writeStderr = (value) => process.stderr.write(value),
} = {}) {
  try {
    const result = runFullValidation({ args });
    writeStdout(json(serializeCliResult(result)));
    return result.status === "completed" ? 0 : 1;
  } catch (error) {
    const failure = classifyCliFailure(error);
    if (failure.stream === "stdout") writeStdout(json(failure.payload));
    else writeStderr(json(failure.payload));
    return 1;
  }
}

function isDirectExecution() {
  return process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  process.exitCode = runF4CliMain();
}