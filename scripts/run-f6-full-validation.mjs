import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runF6Optimization } from "../packages/workflow-runners/dist/index.js";
import { createTypedError } from "../packages/contracts/dist/index.js";
import { createF6OptimizationV3 } from "../packages/workbook-catalog/dist/index.js";
import { parseF6CliArgs } from "./f6-cli-args.mjs";
import { loadF6ArtifactBundle } from "./f6-artifact-loader.mjs";
import { createF6FinalReportProjection } from "./f6-final-report.mjs";
import { resolveFeature6OutputLayout } from "./f6-output-layout.mjs";

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function loaderOptions(parsed) {
  const evidenceFields = [
    "supplierCapabilityArtifact",
    "datumStrategyArtifact",
    "costArtifact",
    "imageObservationArtifact",
    "analysisContextArtifact",
    "optimizationTargetsArtifact",
  ];
  const paths = evidenceFields.map((field) => parsed[field]).filter((value) => value !== undefined);
  let normalized = parsed;
  if (paths.length > 0) {
    const parents = new Set(paths.map((value) => path.resolve(path.dirname(value))));
    if (parents.size !== 1) throw new Error("Feature 6 governed evidence files must share one directory.");
    normalized = {
      ...normalized,
      evidenceArtifactRoot: [...parents][0],
      ...Object.fromEntries(evidenceFields.map((field) => [
        field,
        parsed[field] === undefined ? undefined : path.basename(parsed[field]),
      ])),
    };
  }
  if (parsed.modelInterpretationArtifact !== undefined) {
    normalized = {
      ...normalized,
      modelInterpretationArtifactRoot: path.resolve(path.dirname(parsed.modelInterpretationArtifact)),
      modelInterpretationArtifact: path.basename(parsed.modelInterpretationArtifact),
    };
  }
  return normalized;
}

function normalizeDependencies(overrides = {}) {
  return {
    parseArgs: overrides.parseArgs ?? parseF6CliArgs,
    resolveLayout: overrides.resolveLayout ?? ((parsed, options) => resolveFeature6OutputLayout(
      parsed,
      process.env.AI_TVA_F6_OUTPUT_ROOT,
      options.now,
      process.env.AI_TVA_F6_PUBLISH_ROOT,
    )),
    loadBundle: overrides.loadBundle ?? loadF6ArtifactBundle,
    createOptimization: overrides.createOptimization ?? createF6OptimizationV3,
    createFinalReport: overrides.createFinalReport ?? createF6FinalReportProjection,
    mkdir: overrides.mkdir ?? mkdirSync,
    randomUUID: overrides.randomUUID ?? randomUUID,
    realpath: overrides.realpath ?? realpathSync,
    lstat: overrides.lstat ?? lstatSync,
    stat: overrides.stat ?? statSync,
    open: overrides.open ?? openSync,
    writeFd: overrides.writeFd ?? ((descriptor, content) => writeFileSync(descriptor, content, "utf8")),
    close: overrides.close ?? closeSync,
    rename: overrides.rename ?? renameSync,
    beforeRename: overrides.beforeRename ?? (() => {}),
    afterRename: overrides.afterRename ?? (() => {}),
    rmdir: overrides.rmdir ?? rmdirSync,
    rm: overrides.rm ?? rmSync,
  };
}

function normalizeOptimizationResult(result) {
  if (result && typeof result === "object" && typeof result.runStatus !== "string" && typeof result.status === "string") {
    const normalized = { ...result };
    Object.defineProperty(normalized, "runStatus", {
      value: String(result.status).toUpperCase(),
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return normalized;
  }
  return result;
}

function isUnsafeFailureOutput(result) {
  if (typeof result?.outputDirectory !== "string") return true;
  try {
    const stats = lstatSync(result.outputDirectory);
    return stats.isSymbolicLink() || !stats.isDirectory();
  } catch {
    return true;
  }
}

function normalizeF6Result(result) {
  if (result?.status !== "failed" || !isUnsafeFailureOutput(result)) return result;
  return { status: "failed", reasonCode: result.reasonCode };
}

export function runF6FullValidation(options = {}, dependencyOverrides = {}) {
  const dependencies = normalizeDependencies(dependencyOverrides);
  const parsed = dependencies.parseArgs(options.args ?? []);
  try {
    const layout = dependencies.resolveLayout(parsed, options);
    return normalizeF6Result(runF6Optimization({
      f2ArtifactRoot: parsed.f2ArtifactRoot,
      f3ArtifactRoot: parsed.f3ArtifactRoot,
      f4ArtifactRoot: parsed.f4ArtifactRoot,
      f5ArtifactRoot: parsed.f5ArtifactRoot,
      selectedWorksheetNames: parsed.selectedWorksheetNames,
      interactionLanguage: parsed.interactionLanguage,
      supplierCapabilityPath: parsed.supplierCapabilityArtifact,
      datumStrategyPath: parsed.datumStrategyArtifact,
      costPath: parsed.costArtifact,
      imageObservationsPath: parsed.imageObservationArtifact,
      analysisContextPath: parsed.analysisContextArtifact,
      optimizationTargetsPath: parsed.optimizationTargetsArtifact,
      modelInterpretationPath: parsed.modelInterpretationArtifact,
      expectedModelInterpretationContentHash: parsed.expectedModelInterpretationContentHash ?? (typeof parsed.modelInterpretationArtifact === "string"
        ? createHash("sha256").update(readFileSync(parsed.modelInterpretationArtifact)).digest("hex")
        : undefined),
    }, {
      repositoryRoot: process.cwd(),
      managedOutputRoot: process.env.AI_TVA_F6_OUTPUT_ROOT ?? process.cwd(),
      attemptId: "f6-cli",
      signal: new globalThis.AbortController().signal,
      emit: () => {},
    }, {
      resolveOutputLayout: () => layout,
      loadBundle: (request) => dependencies.loadBundle(loaderOptions({
        f2ArtifactRoot: request.f2ArtifactRoot,
        f3ArtifactRoot: request.f3ArtifactRoot,
        f4ArtifactRoot: request.f4ArtifactRoot,
        f5ArtifactRoot: request.f5ArtifactRoot,
        selectedWorksheetNames: request.selectedWorksheetNames,
        supplierCapabilityArtifact: request.supplierCapabilityPath,
        datumStrategyArtifact: request.datumStrategyPath,
        costArtifact: request.costPath,
        imageObservationArtifact: request.imageObservationsPath,
        analysisContextArtifact: request.analysisContextPath,
        optimizationTargetsArtifact: request.optimizationTargetsPath,
        modelInterpretationArtifact: request.modelInterpretationPath,
        expectedModelInterpretationContentHash: request.expectedModelInterpretationContentHash,
        requireMultimodalV3: true,
        publishRoot: layout.publishRoot,
      })),
      createOptimization: (...args) => normalizeOptimizationResult(dependencies.createOptimization(...args)),
      createFinalReport: dependencies.createFinalReport,
      mkdir: dependencies.mkdir,
      randomUUID: dependencies.randomUUID,
      realpath: dependencies.realpath,
      lstat: dependencies.lstat,
      stat: dependencies.stat,
      open: dependencies.open,
      writeFd: dependencies.writeFd,
      close: dependencies.close,
      rename: dependencies.rename,
      beforeRename: dependencies.beforeRename,
      afterRename: dependencies.afterRename,
      rmdir: dependencies.rmdir,
      rm: dependencies.rm,
    }));
  } catch (error) {
    const typed = error?.code === undefined ? createTypedError({
      code: "internal_error",
      summary: "Feature 6 workflow execution failed.",
      affectedInputReferences: ["feature6-workflow"],
    }) : error;
    const reasonCode = typed.code === "prerequisite_not_ready"
      ? "optimization_failed"
      : typed.code === "validation_error"
        ? "workflow_output_failed"
        : "workflow_output_failed";
    return { status: "failed", reasonCode };
  }
}

function isDirectExecution() {
  return process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

export function runF6Cli(options = {}, dependencyOverrides = {}, io = {}) {
  const log = io.log ?? console.log;
  let result;
  try {
    result = runF6FullValidation(options, dependencyOverrides);
  } catch (error) {
    result = {
      status: "failed",
      reasonCode: error?.reasonCode === "workflow_output_failed"
        ? "workflow_output_failed"
        : error?.reasonCode === "optimization_failed"
          ? "optimization_failed"
          : "invalid_arguments_or_output_root",
    };
  }
  log(json(result.status === "failed" ? { status: result.status, reasonCode: result.reasonCode } : result).trimEnd());
  return result.status === "failed" ? 1 : 0;
}

if (isDirectExecution()) process.exitCode = runF6Cli({ args: process.argv.slice(2) });