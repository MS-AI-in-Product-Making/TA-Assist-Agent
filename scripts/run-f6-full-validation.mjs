import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
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
import { createTypedError, f2UserReportSchema } from "../packages/contracts/dist/index.js";
import { createF6OptimizationV4 } from "../packages/workbook-catalog/dist/index.js";
import { parseF6CliArgs } from "./f6-cli-args.mjs";
import { loadF6ArtifactBundle } from "./f6-artifact-loader.mjs";
import { createF6FinalReportProjection } from "./f6-final-report.mjs";
import { resolveFeature6OutputLayout } from "./f6-output-layout.mjs";
import { runAnalysisStage } from "./analysis-stage-lifecycle.mjs";
import { beginF6Candidate, cleanupF6Candidate, prepareF6Final, sealF6Candidate } from "./f6-candidate.mjs";

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function governedWorkbookFileName(f2ArtifactRoot) {
  const reportPath = path.join(f2ArtifactRoot, "Feature2-Report.json");
  return f2UserReportSchema.parse(JSON.parse(readFileSync(reportPath, "utf8"))).workbook.fileName;
}

function authoritativeWorkspaceModelInterpretationPath(layout) {
  return path.join(layout.runRoot, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json");
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
      () => governedWorkbookFileName(parsed.f2ArtifactRoot),
    )),
    loadBundle: overrides.loadBundle ?? loadF6ArtifactBundle,
    createOptimization: overrides.createOptimization ?? createF6OptimizationV4,
    createFinalReport: overrides.createFinalReport ?? createF6FinalReportProjection,
    renderFinalReportPdf: overrides.renderFinalReportPdf,
    mkdir: overrides.mkdir ?? mkdirSync,
    randomUUID: overrides.randomUUID ?? randomUUID,
    realpath: overrides.realpath ?? realpathSync,
    lstat: overrides.lstat ?? lstatSync,
    stat: overrides.stat ?? statSync,
    readdir: overrides.readdir ?? readdirSync,
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
  return {
    status: "failed",
    reasonCode: result.reasonCode,
    ...(result.failureDetail === undefined ? {} : { failureDetail: result.failureDetail }),
  };
}

function outputPaths(layout) {
  return {
    manifestPath: path.join(layout.runRoot, layout.manifestName),
  };
}

function failedManifest(layout, reasonCode) {
  return {
    contractVersion: "v1",
    artifactSetVersion: layout.artifactSetVersion,
    featureId: "F6",
    status: "failed",
    runId: layout.runId,
    reasonCode,
    artifacts: {},
  };
}

function atomicWrite(filePath, content, dependencies) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  let descriptor;
  let committed = false;
  try {
    descriptor = dependencies.open(temporaryPath, "wx");
    dependencies.writeFd(descriptor, content);
    dependencies.close(descriptor);
    descriptor = undefined;
    dependencies.rename(temporaryPath, filePath);
    committed = true;
  } finally {
    if (descriptor !== undefined) dependencies.close(descriptor);
    if (!committed) dependencies.rm(temporaryPath, { force: true });
  }
}

function reasonCodeForWorkspacePreflight(error) {
  if (error?.code !== "prerequisite_not_ready") return undefined;
  return error?.details?.reasonCode === "workspace_stage_not_empty"
    || error?.reasonCode === "workspace_stage_not_empty"
    ? "workspace_stage_not_empty"
    : "workspace_stage_not_empty";
}

export function runF6FullValidation(options = {}, dependencyOverrides = {}) {
  const args = options.args ?? [];
  const candidate = args.includes("--candidate");
  if (candidate && !args.includes("--analysis-root")) throw new Error("Feature 6 candidate requires an analysis workspace.");
  let cleanupPlan;
  return runAnalysisStage({
    stage: "f6", args, candidate,
    afterCompleted: (workspace) => {
      try {
        (dependencyOverrides.cleanupCandidate ?? cleanupF6Candidate)(workspace, cleanupPlan);
        try {
          lstatSync(cleanupPlan.paths.root);
          throw new Error("Candidate cleanup left evidence behind.");
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      } catch {
        throw Object.assign(new Error("Final publication completed but candidate cleanup failed."), { reasonCode: "candidate_cleanup_failed" });
      }
    },
  }, (workspace) => {
    if (!workspace) return executeF6(options, dependencyOverrides);
    if (candidate) {
      const candidateRoot = beginF6Candidate(workspace, args);
      const result = executeF6(options, dependencyOverrides, candidateRoot);
      return result.status === "failed" ? result : sealF6Candidate(workspace, args);
    }
    cleanupPlan = prepareF6Final(workspace, args);
    return executeF6(options, dependencyOverrides);
  });
}

function executeF6(options, dependencyOverrides, candidateRoot) {
  const dependencies = normalizeDependencies(dependencyOverrides);
  const parsed = dependencies.parseArgs(options.args ?? []);
  const finalLayout = dependencies.resolveLayout(parsed, options);
  const layout = candidateRoot === undefined ? finalLayout : { ...finalLayout, runRoot: candidateRoot, allowExistingRunRoot: false, internalOnly: true };
  const authoritativeModelInterpretationPath = parsed.analysisRoot === undefined || !finalLayout.allowExistingRunRoot
    ? parsed.modelInterpretationArtifact
    : authoritativeWorkspaceModelInterpretationPath(finalLayout);
  try {
    return normalizeF6Result(runF6Optimization({
      f2ArtifactRoot: parsed.f2ArtifactRoot,
      f3ArtifactRoot: parsed.f3ArtifactRoot,
      f4ArtifactRoot: parsed.f4ArtifactRoot,
      f5ArtifactRoot: parsed.f5ArtifactRoot,
      selectedWorksheetNames: parsed.selectedWorksheetNames,
      analysisRequestContext: parsed.analysisRequestContext,
      interactionLanguage: parsed.interactionLanguage,
      supplierCapabilityPath: parsed.supplierCapabilityArtifact,
      datumStrategyPath: parsed.datumStrategyArtifact,
      costPath: parsed.costArtifact,
      imageObservationsPath: parsed.imageObservationArtifact,
      analysisContextPath: parsed.analysisContextArtifact,
      optimizationTargetsPath: parsed.optimizationTargetsArtifact,
      modelInterpretationPath: authoritativeModelInterpretationPath,
      expectedModelInterpretationContentHash: parsed.expectedModelInterpretationContentHash ?? (typeof authoritativeModelInterpretationPath === "string"
        ? createHash("sha256").update(readFileSync(authoritativeModelInterpretationPath)).digest("hex")
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
        analysisRequestContext: request.analysisRequestContext,
        supplierCapabilityArtifact: request.supplierCapabilityPath,
        datumStrategyArtifact: request.datumStrategyPath,
        costArtifact: request.costPath,
        imageObservationArtifact: request.imageObservationsPath,
        analysisContextArtifact: request.analysisContextPath,
        optimizationTargetsArtifact: request.optimizationTargetsPath,
        modelInterpretationArtifact: authoritativeModelInterpretationPath === undefined ? request.modelInterpretationPath : authoritativeModelInterpretationPath,
        expectedModelInterpretationContentHash: request.expectedModelInterpretationContentHash,
        requireMultimodalV3: true,
        analysisRoot: parsed.analysisRoot,
        publishRoot: layout.publishRoot,
      })),
      createOptimization: (...args) => normalizeOptimizationResult(dependencies.createOptimization(...args)),
      createFinalReport: dependencies.createFinalReport,
      ...(dependencies.renderFinalReportPdf === undefined ? {} : { renderFinalReportPdf: dependencies.renderFinalReportPdf }),
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
      readdir: dependencies.readdir,
      rmdir: dependencies.rmdir,
      rm: dependencies.rm,
    }));
  } catch (error) {
    const workspaceReasonCode = reasonCodeForWorkspacePreflight(error);
    if (workspaceReasonCode !== undefined && layout.allowExistingRunRoot) {
      const { manifestPath } = outputPaths(layout);
      atomicWrite(manifestPath, json(failedManifest(layout, workspaceReasonCode)), dependencies);
      return { status: "failed", reasonCode: workspaceReasonCode, outputDirectory: layout.runRoot, manifestPath };
    }
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
      reasonCode: error?.reasonCode === "candidate_cleanup_failed"
        ? "candidate_cleanup_failed"
        : error?.reasonCode === "workflow_output_failed"
        ? "workflow_output_failed"
        : error?.reasonCode === "optimization_failed"
          ? "optimization_failed"
          : "invalid_arguments_or_output_root",
    };
  }
  log(json(result.status === "failed" ? {
    status: result.status,
    reasonCode: result.reasonCode,
    ...(result.failureDetail === undefined ? {} : { failureDetail: result.failureDetail }),
  } : result).trimEnd());
  return result.status === "failed" ? 1 : 0;
}

if (isDirectExecution()) process.exitCode = runF6Cli({ args: process.argv.slice(2) });