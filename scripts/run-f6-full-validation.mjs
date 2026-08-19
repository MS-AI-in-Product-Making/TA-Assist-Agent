import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  lstatSync,
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

function assertPublishBoundary(boundary, dependencies) {
  const realPublishRoot = dependencies.realpath(path.resolve(boundary.layout.publishRoot));
  if (realPublishRoot !== boundary.realPublishRoot
    || !sameIdentity(boundary.publishIdentity, identity(realPublishRoot, dependencies))) {
    throw new Error("Feature 6 publish root changed after creation.");
  }
}

function assertBoundary(boundary, dependencies) {
  assertPublishBoundary(boundary, dependencies);
  const realPublishRoot = boundary.realPublishRoot;
  const realRunRoot = dependencies.realpath(path.resolve(boundary.layout.runRoot));
  if (!isContained(realPublishRoot, realRunRoot)
    || realRunRoot !== boundary.realRunRoot
    || !sameIdentity(boundary.runIdentity, identity(realRunRoot, dependencies))) {
    throw new Error("Feature 6 run root changed after creation.");
  }
}

function assertDirectoryNotReparse(target, dependencies) {
  const stats = dependencies.lstat(target);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("Feature 6 staging path must be a physical directory.");
  }
}

function captureStagingBoundary(boundary, dependencies) {
  assertBoundary(boundary, dependencies);
  const stagingBase = path.join(boundary.realPublishRoot, ".f6-staging");
  dependencies.mkdir(stagingBase, { recursive: true });
  assertDirectoryNotReparse(stagingBase, dependencies);
  const realStagingBase = dependencies.realpath(stagingBase);
  if (realStagingBase !== stagingBase || !isContained(boundary.realPublishRoot, realStagingBase)) {
    throw new Error("Feature 6 staging root escaped the publish root.");
  }

  const safeRunId = String(boundary.layout.runId).replace(/[^A-Za-z0-9._-]/g, "_");
  const stagingRoot = path.join(realStagingBase, `${safeRunId}-${dependencies.randomUUID()}`);
  dependencies.mkdir(stagingRoot);
  assertDirectoryNotReparse(stagingRoot, dependencies);
  const realStagingRoot = dependencies.realpath(stagingRoot);
  if (realStagingRoot !== stagingRoot
    || !isContained(boundary.realPublishRoot, realStagingRoot)
    || isContained(boundary.realRunRoot, realStagingRoot)) {
    throw new Error("Feature 6 staging directory is outside its controlled boundary.");
  }
  return {
    stagingBase,
    realStagingBase,
    stagingRoot,
    realStagingRoot,
    baseIdentity: identity(realStagingBase, dependencies),
    rootIdentity: identity(realStagingRoot, dependencies),
    ownedTemporaryPaths: new Set(),
  };
}

function assertStagingBoundary(boundary, staging, dependencies) {
  assertPublishBoundary(boundary, dependencies);
  assertDirectoryNotReparse(staging.stagingBase, dependencies);
  assertDirectoryNotReparse(staging.stagingRoot, dependencies);
  const realStagingBase = dependencies.realpath(staging.stagingBase);
  const realStagingRoot = dependencies.realpath(staging.stagingRoot);
  if (realStagingBase !== staging.realStagingBase
    || realStagingRoot !== staging.realStagingRoot
    || !isContained(boundary.realPublishRoot, realStagingRoot)
    || isContained(boundary.realRunRoot, realStagingRoot)
    || !sameIdentity(staging.baseIdentity, identity(realStagingBase, dependencies))
    || !sameIdentity(staging.rootIdentity, identity(realStagingRoot, dependencies))) {
    throw new Error("Feature 6 staging boundary changed after creation.");
  }
}

function assertCommittedFile(filePath, expectedIdentity, boundary, dependencies) {
  const relative = path.relative(path.resolve(boundary.layout.runRoot), path.resolve(filePath));
  const expectedRealPath = path.resolve(boundary.realRunRoot, relative);
  const realFilePath = dependencies.realpath(path.resolve(filePath));
  const stats = dependencies.stat(realFilePath);
  if (!isContained(boundary.realRunRoot, realFilePath)
    || realFilePath !== expectedRealPath
    || !stats.isFile()
    || !sameIdentity(expectedIdentity, { dev: stats.dev, ino: stats.ino })) {
    throw new Error("Feature 6 committed output failed identity validation.");
  }
}

function removeOwnedTemporary(temporaryPath, boundary, staging, dependencies) {
  try {
    assertStagingBoundary(boundary, staging, dependencies);
    dependencies.rm(temporaryPath, { force: true });
    staging.ownedTemporaryPaths.delete(temporaryPath);
  } catch {
    // The captured staging path is no longer safe to address.
  }
}

function atomicWrite(filePath, content, boundary, staging, dependencies) {
  assertBoundary(boundary, dependencies);
  assertStagingBoundary(boundary, staging, dependencies);
  const temporaryPath = path.join(staging.realStagingRoot, `${dependencies.randomUUID()}.tmp`);
  let owned = false;
  try {
    const descriptor = dependencies.open(temporaryPath, "wx");
    owned = true;
    staging.ownedTemporaryPaths.add(temporaryPath);
    try { dependencies.writeFd(descriptor, content); } finally { dependencies.close(descriptor); }
    const temporaryIdentity = identity(temporaryPath, dependencies);
    dependencies.beforeRename({ temporaryPath, filePath });
    assertBoundary(boundary, dependencies);
    assertStagingBoundary(boundary, staging, dependencies);
    // Portable Node APIs cannot make boundary validation and rename one indivisible filesystem operation.
    dependencies.rename(temporaryPath, filePath);
    staging.ownedTemporaryPaths.delete(temporaryPath);
    owned = false;
    dependencies.afterRename({ temporaryPath, filePath });
    assertBoundary(boundary, dependencies);
    assertCommittedFile(filePath, temporaryIdentity, boundary, dependencies);
  } finally {
    if (owned) removeOwnedTemporary(temporaryPath, boundary, staging, dependencies);
  }
}

function cleanupStaging(boundary, staging, dependencies) {
  try {
    assertStagingBoundary(boundary, staging, dependencies);
    for (const temporaryPath of staging.ownedTemporaryPaths) {
      dependencies.rm(temporaryPath, { force: true });
    }
    staging.ownedTemporaryPaths.clear();
    dependencies.rmdir(staging.stagingRoot);
    assertPublishBoundary(boundary, dependencies);
    assertDirectoryNotReparse(staging.stagingBase, dependencies);
    if (sameIdentity(staging.baseIdentity, identity(staging.stagingBase, dependencies))) {
      try { dependencies.rmdir(staging.stagingBase); } catch { /* Keep a non-empty shared staging base. */ }
    }
  } catch {
    // Cleanup never follows a staging path whose captured identity no longer matches.
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

function manifest(layout, status, artifacts, reasonCode, inputDecisions) {
  return {
    contractVersion: "v1",
    featureId: "F6",
    status,
    runId: layout.runId,
    ...(reasonCode === undefined ? {} : { reasonCode }),
    ...(inputDecisions === undefined ? {} : { inputDecisions }),
    artifacts,
  };
}

function failedResult(layout, paths, artifacts, reasonCode, boundary, staging, dependencies) {
  try {
    assertBoundary(boundary, dependencies);
    atomicWrite(paths.manifest, json(manifest(layout, "failed", artifacts, reasonCode)), boundary, staging, dependencies);
    return { status: "failed", reasonCode, outputDirectory: layout.runRoot, manifestPath: paths.manifest };
  } catch {
    return { status: "failed", reasonCode: "workflow_output_failed" };
  }
}

function loaderOptions(parsed) {
  const fields = [
    "supplierCapabilityArtifact",
    "datumStrategyArtifact",
    "costArtifact",
    "imageObservationArtifact",
    "analysisContextArtifact",
    "optimizationTargetsArtifact",
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

export function runF6FullValidation(options = {}, dependencyOverrides = {}) {
  const dependencies = normalizeDependencies(dependencyOverrides);
  const parsed = dependencies.parseArgs(options.args ?? []);
  const layout = dependencies.resolveLayout(parsed, options);
  const paths = outputPaths(layout);
  dependencies.mkdir(path.dirname(layout.runRoot), { recursive: true });
  dependencies.mkdir(layout.runRoot);
  const boundary = captureBoundary(layout, dependencies);
  const artifacts = {};
  let failureStage = "output";
  let staging;
  try {
    staging = captureStagingBoundary(boundary, dependencies);
    failureStage = "input";
    const loaded = dependencies.loadBundle(loaderOptions({ ...parsed, publishRoot: layout.publishRoot }));
    if (loaded?.status !== "accepted") {
      return failedResult(layout, paths, artifacts, "input_rejected", boundary, staging, dependencies);
    }
    failureStage = "optimization";
    const persistedInputDecisions = loaded.inputDecisions;
    const inputDecisions = persistedInputDecisions ?? {
      analysisContext: { outcome: "NOT_PROVIDED" },
      optimizationTargets: { outcome: "NOT_PROVIDED" },
    };
    const optimization = dependencies.createOptimization(loaded.request, {
      ...(loaded.analysisContext === undefined ? {} : { analysisContext: loaded.analysisContext }),
      ...(loaded.optimizationTargets === undefined ? {} : { optimizationTargets: loaded.optimizationTargets }),
      inputDecisions,
    });
    failureStage = "report";
    const composedReport = dependencies.createComposedReport({
      f2Report: loaded.f2Report,
      f5Report: loaded.f5Report,
      f6Result: optimization,
      ...(loaded.analysisContext === undefined ? {} : { analysisContext: loaded.analysisContext }),
    });
    const contents = {
      optimizationJson: json(optimization),
      optimizationMarkdown: dependencies.renderOptimization(optimization, { outputRoot: layout.runRoot }),
      composedReportJson: json(composedReport),
      composedReportMarkdown: dependencies.renderComposedReport(composedReport, {
        outputRoot: layout.runRoot,
        f1ArtifactRoot: loaded.f2Report.artifactRoot,
        publishRoot: layout.publishRoot,
      }),
    };
    const workflowStatus = optimization.runStatus === undefined
      ? optimization.status
      : optimization.runStatus.toLowerCase();
    const summary = {
      contractVersion: "v1",
      featureId: "F6",
      status: workflowStatus,
      sources: safeSources(loaded.sourceReferences),
      inputDecisions,
      counts: optimization.summary,
      hashes: Object.fromEntries(Object.entries(contents).map(([key, content]) => [`${key}Sha256`, sha256(content)])),
    };

    failureStage = "output";
    for (const key of ["optimizationJson", "optimizationMarkdown", "composedReportJson", "composedReportMarkdown"]) {
      atomicWrite(paths[key], contents[key], boundary, staging, dependencies);
      artifacts[key] = path.basename(paths[key]);
    }
    atomicWrite(paths.runSummary, json(summary), boundary, staging, dependencies);
    artifacts.runSummary = layout.runSummaryJsonName;
    atomicWrite(paths.manifest, json(manifest(layout, workflowStatus, artifacts, undefined, persistedInputDecisions)), boundary, staging, dependencies);
    return {
      status: workflowStatus,
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
    if (staging === undefined) return { status: "failed", reasonCode: "workflow_output_failed" };
    return failedResult(layout, paths, artifacts, reasonCode, boundary, staging, dependencies);
  } finally {
    if (staging !== undefined) cleanupStaging(boundary, staging, dependencies);
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