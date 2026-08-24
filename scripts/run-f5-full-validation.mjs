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
import { runF5Interpretation } from "../packages/workflow-runners/dist/index.js";
import { createF5DataInterpretation } from "../packages/workbook-catalog/dist/index.js";
import { loadF5ArtifactBundle } from "./f5-artifact-loader.mjs";
import { parseF5CliArgs } from "./f5-cli-args.mjs";
import { resolveFeature5OutputLayout } from "./f5-output-layout.mjs";
import { renderF5Report } from "./f5-report.mjs";

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

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

function normalizeF5Result(result) {
  if (result?.status !== "failed" || result?.reasonCode !== "workflow_output_failed") return result;
  const manifestPath = typeof result.manifestPath === "string" ? result.manifestPath : undefined;
  if (manifestPath && existsSync(manifestPath)) return result;
  return {
    status: "failed",
    reasonCode: "workflow_output_failed",
    outputDirectory: result.outputDirectory,
  };
}

export function runF5FullValidation(options = {}, dependencyOverrides = {}) {
  const dependencies = normalizeDependencies(dependencyOverrides);
  const parsed = dependencies.parseArgs(options.args ?? []);
  return normalizeF5Result(runF5Interpretation({
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
}

function isDirectExecution() {
  return process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

export function runF5Cli(options = {}, dependencyOverrides = {}, io = {}) {
  const log = io.log ?? console.log;
  let result;
  try {
    result = runF5FullValidation(options, dependencyOverrides);
  } catch (error) {
    const errorReasonCode = error?.reasonCode ?? error?.code;
    result = {
      status: "failed",
      reasonCode: errorReasonCode === "workflow_output_failed"
        ? "workflow_output_failed"
        : "invalid_arguments_or_output_root",
    };
  }

  log(json(result.status === "failed"
    ? { status: result.status, reasonCode: result.reasonCode }
    : result).trimEnd());
  return result.status === "failed" ? 1 : 0;
}

if (isDirectExecution()) {
  process.exitCode = runF5Cli({ args: process.argv.slice(2) });
}