import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runF4Calculation } from "../packages/workflow-runners/dist/index.js";
import {
  createTypedError,
} from "../packages/contracts/dist/index.js";
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
    if (error?.code === "EEXIST") throw error;
    const layout = dependencies.resolveLayout(args);
    const paths = outputPaths(layout);
    const typed = error?.code === undefined ? createTypedError({
      code: "internal_error",
      summary: "Feature 4 workflow execution failed.",
      affectedInputReferences: ["feature4-workflow"],
    }) : error;
    const reasonCode = typed.code === "validation_error" ? "invalid_arguments_or_output_root" : "calculation_failed";
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

function isDirectExecution() {
  return process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  try {
    const result = runF4FullValidation({ args: process.argv.slice(2) });
    console.log(json(summarizeF4CliResult(result)).trimEnd());
    if (result.status !== "completed") process.exitCode = 1;
  } catch {
    console.log(json({ status: "failed", reasonCode: "invalid_arguments_or_output_root" }).trimEnd());
    process.exitCode = 1;
  }
}