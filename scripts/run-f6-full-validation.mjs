import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
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
import {
  createF6ComposedEngineeringReport,
  createF6Optimization,
} from "../packages/workbook-catalog/dist/index.js";
import { parseF6CliArgs } from "./f6-cli-args.mjs";
import { loadF6ArtifactBundle } from "./f6-artifact-loader.mjs";
import { renderComposedEngineeringReport } from "./f6-composed-report.mjs";
import { resolveFeature6OutputLayout } from "./f6-output-layout.mjs";
import { renderF6Report } from "./f6-report.mjs";

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function identity(target, dependencies) {
  const stats = dependencies.stat(target);
  return { dev: stats.dev, ino: stats.ino };
}

function identityAvailable(value) {
  const valid = (field) => typeof field === "bigint" || (typeof field === "number" && Number.isFinite(field));
  return valid(value.dev) && valid(value.ino) && value.ino !== 0 && value.ino !== 0n;
}

function sameIdentity(expected, actual) {
  return !identityAvailable(expected) || (identityAvailable(actual) && expected.dev === actual.dev && expected.ino === actual.ino);
}

function captureBoundary(layout, dependencies) {
  const realPublishRoot = dependencies.realpath(path.resolve(layout.publishRoot));
  const realRunRoot = dependencies.realpath(path.resolve(layout.runRoot));
  if (!isContained(realPublishRoot, realRunRoot)) {
    try { dependencies.rmdir(layout.runRoot); } catch { /* Preserve unexpected content. */ }
    throw new Error("Feature 6 run root must remain inside the publish root.");
  }
  return {
    layout,
    realPublishRoot,
    realRunRoot,
    publishIdentity: identity(realPublishRoot, dependencies),
    runIdentity: identity(realRunRoot, dependencies),
  };
}

function assertBoundary(boundary, dependencies) {
  const realPublishRoot = dependencies.realpath(path.resolve(boundary.layout.publishRoot));
  const realRunRoot = dependencies.realpath(path.resolve(boundary.layout.runRoot));
  if (!isContained(realPublishRoot, realRunRoot)
    || realPublishRoot !== boundary.realPublishRoot
    || realRunRoot !== boundary.realRunRoot
    || !sameIdentity(boundary.publishIdentity, identity(realPublishRoot, dependencies))
    || !sameIdentity(boundary.runIdentity, identity(realRunRoot, dependencies))) {
    throw new Error("Feature 6 run root changed after creation.");
  }
}

function atomicWrite(filePath, content, boundary, dependencies) {
  assertBoundary(boundary, dependencies);
  const temporaryPath = `${filePath}.${dependencies.randomUUID()}.tmp`;
  let owned = false;
  let committed = false;
  try {
    const descriptor = dependencies.open(temporaryPath, "wx");
    owned = true;
    try { dependencies.writeFd(descriptor, content); } finally { dependencies.close(descriptor); }
    assertBoundary(boundary, dependencies);
    dependencies.rename(temporaryPath, filePath);
    committed = true;
  } finally {
    if (owned && !committed) {
      try {
        assertBoundary(boundary, dependencies);
        dependencies.rm(temporaryPath, { force: true });
      } catch {
        // The controlled path is no longer safe to address.
      }
    }
  }
}

function outputPaths(layout) {
  return {
    optimizationJson: path.join(layout.runRoot, layout.optimizationJsonName),
    optimizationMarkdown: path.join(layout.runRoot, layout.optimizationMdName),
    composedReportJson: path.join(layout.runRoot, layout.composedReportJsonName),
    composedReportMarkdown: path.join(layout.runRoot, layout.composedReportMdName),
    runSummary: path.join(layout.runRoot, layout.runSummaryJsonName),
    manifest: path.join(layout.runRoot, layout.manifestName),
  };
}

function safeSources(sourceReferences = {}) {
  return Object.fromEntries(Object.entries(sourceReferences).map(([key, reference]) => [key, {
    artifact: path.basename(String(reference.artifact)),
    contentHash: reference.contentHash,
  }]));
}

function manifest(layout, status, artifacts, reasonCode) {
  return {
    contractVersion: "v1",
    featureId: "F6",
    status,
    runId: layout.runId,
    ...(reasonCode === undefined ? {} : { reasonCode }),
    artifacts,
  };
}

function failedResult(layout, paths, artifacts, reasonCode, boundary, dependencies) {
  try {
    atomicWrite(paths.manifest, json(manifest(layout, "failed", artifacts, reasonCode)), boundary, dependencies);
    return { status: "failed", reasonCode, outputDirectory: layout.runRoot, manifestPath: paths.manifest };
  } catch {
    return { status: "failed", reasonCode: "workflow_output_failed", outputDirectory: layout.runRoot };
  }
}

function loaderOptions(parsed) {
  const fields = [
    "supplierCapabilityArtifact",
    "datumStrategyArtifact",
    "costArtifact",
    "imageObservationArtifact",
  ];
  const paths = fields.map((field) => parsed[field]).filter((value) => value !== undefined);
  if (paths.length === 0) return parsed;
  const parents = new Set(paths.map((value) => path.resolve(path.dirname(value))));
  if (parents.size !== 1) throw new Error("Feature 6 governed evidence files must share one directory.");
  return {
    ...parsed,
    evidenceArtifactRoot: [...parents][0],
    ...Object.fromEntries(fields.map((field) => [
      field,
      parsed[field] === undefined ? undefined : path.basename(parsed[field]),
    ])),
  };
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
    createOptimization: overrides.createOptimization ?? createF6Optimization,
    createComposedReport: overrides.createComposedReport ?? createF6ComposedEngineeringReport,
    renderOptimization: overrides.renderOptimization ?? renderF6Report,
    renderComposedReport: overrides.renderComposedReport ?? renderComposedEngineeringReport,
    mkdir: overrides.mkdir ?? mkdirSync,
    randomUUID: overrides.randomUUID ?? randomUUID,
    realpath: overrides.realpath ?? realpathSync,
    stat: overrides.stat ?? statSync,
    open: overrides.open ?? openSync,
    writeFd: overrides.writeFd ?? ((descriptor, content) => writeFileSync(descriptor, content, "utf8")),
    close: overrides.close ?? closeSync,
    rename: overrides.rename ?? renameSync,
    rmdir: overrides.rmdir ?? rmdirSync,
    rm: overrides.rm ?? rmSync,
  };
}

export function runF6FullValidation(options = {}, dependencyOverrides = {}) {
  const dependencies = normalizeDependencies(dependencyOverrides);
  const parsed = dependencies.parseArgs(options.args ?? []);
  const layout = dependencies.resolveLayout(parsed, options);
  const paths = outputPaths(layout);
  dependencies.mkdir(path.dirname(layout.runRoot), { recursive: true });
  dependencies.mkdir(layout.runRoot);
  const boundary = captureBoundary(layout, dependencies);
  const artifacts = {};
  let failureStage = "input";
  try {
    const loaded = dependencies.loadBundle(loaderOptions(parsed));
    if (loaded?.status !== "accepted") {
      return failedResult(layout, paths, artifacts, "input_rejected", boundary, dependencies);
    }
    failureStage = "optimization";
    const optimization = dependencies.createOptimization(loaded.request);
    failureStage = "report";
    const composedReport = dependencies.createComposedReport({
      f2Report: loaded.f2Report,
      f5Report: loaded.f5Report,
      f6Result: optimization,
    });
    const contents = {
      optimizationJson: json(optimization),
      optimizationMarkdown: dependencies.renderOptimization(optimization, { outputRoot: layout.runRoot }),
      composedReportJson: json(composedReport),
      composedReportMarkdown: dependencies.renderComposedReport(composedReport, { outputRoot: layout.runRoot }),
    };
    const summary = {
      contractVersion: "v1",
      featureId: "F6",
      status: optimization.status,
      sources: safeSources(loaded.sourceReferences),
      counts: optimization.summary,
      hashes: Object.fromEntries(Object.entries(contents).map(([key, content]) => [`${key}Sha256`, sha256(content)])),
    };

    failureStage = "output";
    for (const key of ["optimizationJson", "optimizationMarkdown", "composedReportJson", "composedReportMarkdown"]) {
      atomicWrite(paths[key], contents[key], boundary, dependencies);
      artifacts[key] = path.basename(paths[key]);
    }
    atomicWrite(paths.runSummary, json(summary), boundary, dependencies);
    artifacts.runSummary = layout.runSummaryJsonName;
    atomicWrite(paths.manifest, json(manifest(layout, optimization.status, artifacts)), boundary, dependencies);
    return {
      status: optimization.status,
      outputDirectory: layout.runRoot,
      optimizationJsonPath: paths.optimizationJson,
      optimizationMdPath: paths.optimizationMarkdown,
      composedReportJsonPath: paths.composedReportJson,
      composedReportMdPath: paths.composedReportMarkdown,
      runSummaryPath: paths.runSummary,
      manifestPath: paths.manifest,
      summary: optimization.summary,
    };
  } catch {
    const reasonCode = failureStage === "input"
      ? "input_rejected"
      : failureStage === "optimization"
        ? "optimization_failed"
        : failureStage === "report"
          ? "report_failed"
          : "workflow_output_failed";
    return failedResult(layout, paths, artifacts, reasonCode, boundary, dependencies);
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
  } catch {
    result = { status: "failed", reasonCode: "invalid_arguments_or_output_root" };
  }
  log(json(result.status === "failed" ? { status: result.status, reasonCode: result.reasonCode } : result).trimEnd());
  return result.status === "failed" ? 1 : 0;
}

if (isDirectExecution()) process.exitCode = runF6Cli({ args: process.argv.slice(2) });