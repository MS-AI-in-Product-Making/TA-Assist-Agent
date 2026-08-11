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
  f5DataInterpretationResultSchema,
  f5ImageObservationArtifactSchema,
} from "../packages/contracts/dist/contracts.js";
import { createF5DataInterpretation } from "../packages/workbook-catalog/dist/index.js";
import { loadF5ArtifactBundle } from "./f5-artifact-loader.mjs";
import { parseF5CliArgs } from "./f5-cli-args.mjs";
import { resolveFeature5OutputLayout } from "./f5-output-layout.mjs";
import { renderF5Report } from "./f5-report.mjs";

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

// Node has no openat-style rename boundary; these checkpoints catch link swaps, while OS ACLs
// must prevent a continuously racing local process.
function atomicWrite(filePath, content, boundary, dependencies) {
  assertRunRootContained(boundary, dependencies);
  const temporaryPath = `${filePath}.${dependencies.randomUUID()}.tmp`;
  let owned = false;
  let committed = false;
  try {
    const fd = dependencies.open(temporaryPath, "wx");
    owned = true;
    try {
      dependencies.writeFd(fd, content);
    } finally {
      dependencies.close(fd);
    }
    assertRunRootContained(boundary, dependencies);
    dependencies.rename(temporaryPath, filePath);
    committed = true;
  } finally {
    if (owned && !committed) {
      let reachable = true;
      try {
        assertRunRootContained(boundary, dependencies);
      } catch {
        reachable = false;
      }
      // A replaced directory makes the owned temp unreachable by this path.
      if (reachable) dependencies.rm(temporaryPath, { force: true });
    }
  }
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

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === ""
    || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function directoryIdentity(target, dependencies) {
  const stats = dependencies.stat(target);
  return { dev: stats.dev, ino: stats.ino };
}

function identityAvailable(identity) {
  const valid = (value) => typeof value === "bigint"
    || (typeof value === "number" && Number.isFinite(value));
  return valid(identity.dev)
    && valid(identity.ino)
    && identity.ino !== 0
    && identity.ino !== 0n;
}

function sameIdentity(expected, actual) {
  if (!identityAvailable(expected)) return true;
  return identityAvailable(actual)
    && expected.dev === actual.dev
    && expected.ino === actual.ino;
}

function captureCreatedRunBoundary(layout, dependencies) {
  const realPublishRoot = dependencies.realpath(path.resolve(layout.publishRoot));
  const realRunRoot = dependencies.realpath(path.resolve(layout.runRoot));
  if (!isContained(realPublishRoot, realRunRoot)) {
    try {
      dependencies.rmdir(layout.runRoot);
    } catch {
      // Preserve any content that appeared after this process created the run root.
    }
    throw new Error("Feature 5 run root must remain inside the publish root after creation.");
  }
  return {
    layout,
    realPublishRoot,
    realRunRoot,
    publishIdentity: directoryIdentity(realPublishRoot, dependencies),
    runIdentity: directoryIdentity(realRunRoot, dependencies),
  };
}

function assertRunRootContained(boundary, dependencies) {
  const realPublishRoot = dependencies.realpath(path.resolve(boundary.layout.publishRoot));
  const realRunRoot = dependencies.realpath(path.resolve(boundary.layout.runRoot));
  const publishIdentity = directoryIdentity(realPublishRoot, dependencies);
  const runIdentity = directoryIdentity(realRunRoot, dependencies);
  if (!isContained(realPublishRoot, realRunRoot)
    || realPublishRoot !== boundary.realPublishRoot
    || realRunRoot !== boundary.realRunRoot
    || !sameIdentity(boundary.publishIdentity, publishIdentity)
    || !sameIdentity(boundary.runIdentity, runIdentity)) {
    throw new Error("Feature 5 run root changed after creation.");
  }
}

function recomputeResult(coreResult, rejectedWorksheets, worksheetOrder) {
  const resultsByWorksheet = new Map([
    ...coreResult.worksheets.map((worksheet) => [worksheet.worksheetName, worksheet]),
    ...rejectedWorksheets.map(({ worksheetName, reasonCode, artifactReference }) => [worksheetName, {
      worksheetName,
      status: "input_rejected",
      reasonCode,
      artifactReference,
    }]),
  ]);
  if (!Array.isArray(worksheetOrder)
    || worksheetOrder.length !== resultsByWorksheet.size
    || new Set(worksheetOrder).size !== worksheetOrder.length
    || worksheetOrder.some((worksheetName) => !resultsByWorksheet.has(worksheetName))) {
    throw new Error("F5 worksheet order does not match worksheet results.");
  }
  const worksheets = worksheetOrder.map((worksheetName) => resultsByWorksheet.get(worksheetName));
  const completedWorksheets = worksheets.filter(({ status }) => status === "completed");
  const inputRejectedWorksheetCount = worksheets.length - completedWorksheets.length;
  return f5DataInterpretationResultSchema.parse({
    ...coreResult,
    status: inputRejectedWorksheetCount === 0
      ? "completed"
      : completedWorksheets.length === 0
        ? "input_rejected"
        : "partially_completed",
    worksheets,
    summary: {
      worksheetCount: worksheets.length,
      completedWorksheetCount: completedWorksheets.length,
      inputRejectedWorksheetCount,
      statementCount: completedWorksheets.reduce((count, worksheet) => count + worksheet.statements.length, 0),
      clarificationCount: completedWorksheets.reduce((count, worksheet) => count + worksheet.clarifications.length, 0),
      assumptionCount: completedWorksheets.reduce((count, worksheet) => count + worksheet.assumptions.length, 0),
    },
  });
}

function safeSources(sourceReferences) {
  return Object.fromEntries(Object.entries(sourceReferences).map(([key, value]) => [
    key,
    path.basename(String(value)),
  ]));
}

function runSummary(result, loaded, contents) {
  return {
    contractVersion: "v1",
    featureId: "F5",
    status: result.status,
    sources: safeSources(loaded.sourceReferences),
    counts: {
      worksheetCount: result.summary.worksheetCount,
      completedWorksheetCount: result.summary.completedWorksheetCount,
      inputRejectedWorksheetCount: result.summary.inputRejectedWorksheetCount,
      statementCount: result.summary.statementCount,
      clarificationCount: result.summary.clarificationCount,
      assumptionCount: result.summary.assumptionCount,
    },
    hashes: {
      reportJsonSha256: sha256(contents.reportJson),
      reportMarkdownSha256: sha256(contents.reportMarkdown),
      ...(contents.observations === undefined ? {} : {
        imageObservationsSha256: sha256(contents.observations),
      }),
    },
  };
}

function manifest(layout, status, artifacts, reasonCode) {
  return {
    contractVersion: "v1",
    featureId: "F5",
    status,
    runId: layout.runId,
    ...(reasonCode === undefined ? {} : { reasonCode }),
    artifacts,
  };
}

function failedResult(layout, paths, artifacts, reasonCode, boundary, dependencies) {
  try {
    atomicWrite(
      paths.manifestPath,
      json(manifest(layout, "failed", artifacts, reasonCode)),
      boundary,
      dependencies,
    );
    return {
      status: "failed",
      reasonCode,
      outputDirectory: layout.runRoot,
      manifestPath: paths.manifestPath,
    };
  } catch {
    return {
      status: "failed",
      reasonCode: "workflow_output_failed",
      outputDirectory: layout.runRoot,
    };
  }
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

export function runF5FullValidation(options = {}, dependencyOverrides = {}) {
  const dependencies = normalizeDependencies(dependencyOverrides);
  const parsed = dependencies.parseArgs(options.args ?? []);
  const layout = dependencies.resolveLayout(parsed, options);
  const paths = outputPaths(layout);
  dependencies.mkdir(path.dirname(layout.runRoot), { recursive: true });
  dependencies.mkdir(layout.runRoot);
  const boundary = captureCreatedRunBoundary(layout, dependencies);

  const committedArtifacts = {};
  let failureStage = "input";
  try {
    const loaded = dependencies.loadBundle({
      ...parsed,
      imageObservationArtifact: parsed.imageObservationsPath,
    });
    if (loaded?.status !== "accepted") {
      const reasonCode = "input_rejected";
      return failedResult(layout, paths, committedArtifacts, reasonCode, boundary, dependencies);
    }

    failureStage = "interpretation";
    const coreResult = f5DataInterpretationResultSchema.parse(
      dependencies.createInterpretation(loaded.request),
    );
    const result = recomputeResult(
      coreResult,
      loaded.rejectedWorksheets ?? [],
      loaded.worksheetOrder,
    );
    const observationArtifact = loaded.observationArtifact === undefined
      ? undefined
      : f5ImageObservationArtifactSchema.parse(loaded.observationArtifact);

    failureStage = "output";
    const contents = {
      reportJson: json(result),
      reportMarkdown: dependencies.renderReport(result, {
        outputRoot: layout.runRoot,
        f1ArtifactRoot: parsed.f1ArtifactRoot,
        publishRoot: layout.publishRoot,
      }),
      ...(observationArtifact === undefined ? {} : { observations: json(observationArtifact) }),
    };
    const summary = runSummary(result, loaded, contents);

    atomicWrite(paths.reportJsonPath, contents.reportJson, boundary, dependencies);
    committedArtifacts.reportJson = layout.reportJsonName;
    atomicWrite(paths.reportMdPath, contents.reportMarkdown, boundary, dependencies);
    committedArtifacts.reportMarkdown = layout.reportMdName;
    if (contents.observations !== undefined) {
      atomicWrite(paths.imageObservationsPath, contents.observations, boundary, dependencies);
      committedArtifacts.imageObservations = layout.imageObservationsJsonName;
    }
    atomicWrite(paths.runSummaryPath, json(summary), boundary, dependencies);
    committedArtifacts.runSummary = layout.runSummaryJsonName;
    const workflowFailed = result.status === "input_rejected";
    atomicWrite(
      paths.manifestPath,
      json(manifest(
        layout,
        workflowFailed ? "failed" : result.status,
        committedArtifacts,
        workflowFailed ? "input_rejected" : undefined,
      )),
      boundary,
      dependencies,
    );

    return {
      status: workflowFailed ? "failed" : result.status,
      ...(workflowFailed ? { reasonCode: "input_rejected" } : {}),
      outputDirectory: layout.runRoot,
      reportJsonPath: paths.reportJsonPath,
      reportMdPath: paths.reportMdPath,
      runSummaryPath: paths.runSummaryPath,
      manifestPath: paths.manifestPath,
      ...(observationArtifact === undefined ? {} : {
        imageObservationsPath: paths.imageObservationsPath,
      }),
      summary: result.summary,
    };
  } catch {
    const reasonCode = failureStage === "input"
      ? "input_rejected"
      : failureStage === "interpretation"
        ? "interpretation_failed"
        : "workflow_output_failed";
    return failedResult(layout, paths, committedArtifacts, reasonCode, boundary, dependencies);
  }
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
    result = {
      status: "failed",
      reasonCode: error?.reasonCode === "workflow_output_failed"
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