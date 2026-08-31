/* eslint-disable @typescript-eslint/no-explicit-any -- runner facades validate external workflow artifact JSON at schema boundaries. */
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

import {
  createF5DataInterpretation,
} from "@ai-assist/workbook-catalog";
import {
  f5DataInterpretationResultSchema,
  f5ImageObservationArtifactSchema,
} from "@ai-assist/contracts";

import { normalizeRunnerError } from "./error-normalizer.js";
import type { F5InterpretationRequest, F5InterpretationResult, RunContext } from "./types.js";

interface F5Layout {
  readonly runId: string;
  readonly runRoot: string;
  readonly publishRoot: string;
  readonly reportJsonName: string;
  readonly reportMdName: string;
  readonly runSummaryJsonName: string;
  readonly imageObservationsJsonName: string;
  readonly manifestName: string;
}

export interface F5Dependencies {
  readonly resolveOutputLayout?: (request: F5InterpretationRequest, context: RunContext) => F5Layout;
  readonly loadBundle?: (request: F5InterpretationRequest) => any;
  readonly createInterpretation?: typeof createF5DataInterpretation;
  readonly renderReport?: (result: any, options: { outputRoot: string; f1ArtifactRoot: string; publishRoot: string }) => string;
  readonly mkdir?: typeof mkdirSync;
  readonly randomUUID?: typeof randomUUID;
  readonly realpath?: typeof realpathSync;
  readonly stat?: typeof statSync;
  readonly open?: typeof openSync;
  readonly writeFd?: (fd: number, content: string) => void;
  readonly close?: typeof closeSync;
  readonly rename?: typeof renameSync;
  readonly rmdir?: typeof rmdirSync;
  readonly rm?: typeof rmSync;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === ""
    || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function directoryIdentity(target: string, dependencies: Required<Pick<F5Dependencies, "stat">>): { dev: unknown; ino: unknown } {
  const stats = dependencies.stat(target);
  return { dev: stats.dev, ino: stats.ino };
}

function identityAvailable(identity: { dev: unknown; ino: unknown }): boolean {
  const valid = (value: unknown) => typeof value === "bigint"
    || (typeof value === "number" && Number.isFinite(value));
  return valid(identity.dev) && valid(identity.ino) && identity.ino !== 0 && identity.ino !== 0n;
}

function sameIdentity(expected: { dev: unknown; ino: unknown }, actual: { dev: unknown; ino: unknown }): boolean {
  if (!identityAvailable(expected)) return true;
  return identityAvailable(actual) && expected.dev === actual.dev && expected.ino === actual.ino;
}

function captureCreatedRunBoundary(layout: F5Layout, dependencies: Required<Pick<F5Dependencies, "realpath" | "stat" | "rmdir">>) {
  const realPublishRoot = dependencies.realpath(path.resolve(layout.publishRoot));
  const realRunRoot = dependencies.realpath(path.resolve(layout.runRoot));
  if (!isContained(realPublishRoot, realRunRoot)) {
    try { dependencies.rmdir(layout.runRoot); } catch { /* ignore */ }
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

function assertRunRootContained(boundary: ReturnType<typeof captureCreatedRunBoundary>, dependencies: Required<Pick<F5Dependencies, "realpath" | "stat">>): void {
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

function atomicWrite(
  filePath: string,
  content: string,
  boundary: ReturnType<typeof captureCreatedRunBoundary>,
  dependencies: Required<Pick<F5Dependencies, "realpath" | "stat" | "randomUUID" | "open" | "writeFd" | "close" | "rename" | "rm">>,
): void {
  assertRunRootContained(boundary, dependencies);
  const temporaryPath = `${filePath}.${dependencies.randomUUID()}.tmp`;
  let owned = false;
  let committed = false;
  try {
    const fd = dependencies.open(temporaryPath, "wx");
    owned = true;
    try { dependencies.writeFd(fd, content); } finally { dependencies.close(fd); }
    assertRunRootContained(boundary, dependencies);
    dependencies.rename(temporaryPath, filePath);
    committed = true;
  } finally {
    if (owned && !committed) {
      let reachable = true;
      try { assertRunRootContained(boundary, dependencies); } catch { reachable = false; }
      if (reachable) dependencies.rm(temporaryPath, { force: true });
    }
  }
}

function outputPaths(layout: F5Layout) {
  return {
    reportJsonPath: path.join(layout.runRoot, layout.reportJsonName),
    reportMdPath: path.join(layout.runRoot, layout.reportMdName),
    runSummaryPath: path.join(layout.runRoot, layout.runSummaryJsonName),
    imageObservationsPath: path.join(layout.runRoot, layout.imageObservationsJsonName),
    manifestPath: path.join(layout.runRoot, layout.manifestName),
  };
}

function safeSources(sourceReferences: Record<string, string>) {
  return Object.fromEntries(Object.entries(sourceReferences).map(([key, value]) => [key, path.basename(String(value))]));
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function recomputeResult(coreResult: any, rejectedWorksheets: any[], worksheetOrder: readonly string[]) {
  const resultsByWorksheet = new Map([
    ...coreResult.worksheets.map((worksheet: any) => [worksheet.worksheetName, worksheet]),
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
  const worksheets = worksheetOrder.map((worksheetName) => resultsByWorksheet.get(worksheetName)) as any[];
  const completedWorksheets = worksheets.filter((worksheet: any) => worksheet.status === "completed");
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
      statementCount: completedWorksheets.reduce((count: number, worksheet: any) => count + worksheet.statements.length, 0),
      clarificationCount: completedWorksheets.reduce((count: number, worksheet: any) => count + worksheet.clarifications.length, 0),
      assumptionCount: completedWorksheets.reduce((count: number, worksheet: any) => count + worksheet.assumptions.length, 0),
    },
  });
}

function runSummary(result: any, loaded: any, contents: { reportJson: string; reportMarkdown: string; observations?: string }) {
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
      ...(contents.observations === undefined ? {} : { imageObservationsSha256: sha256(contents.observations) }),
    },
  };
}

function manifest(layout: F5Layout, status: string, artifacts: Record<string, string>, reasonCode?: string) {
  return {
    contractVersion: "v1",
    featureId: "F5",
    status,
    runId: layout.runId,
    ...(reasonCode === undefined ? {} : { reasonCode }),
    artifacts,
  };
}

function failedResult(
  layout: F5Layout,
  paths: ReturnType<typeof outputPaths>,
  artifacts: Record<string, string>,
  reasonCode: string,
  boundary: ReturnType<typeof captureCreatedRunBoundary>,
  dependencies: Required<Pick<F5Dependencies, "realpath" | "stat" | "randomUUID" | "open" | "writeFd" | "close" | "rename" | "rm">>,
): F5InterpretationResult {
  try {
    atomicWrite(paths.manifestPath, json(manifest(layout, "failed", artifacts, reasonCode)), boundary, dependencies);
    return { featureId: "F5", status: "failed", reasonCode, outputDirectory: layout.runRoot, selectedWorksheetNames: [], manifestPath: paths.manifestPath };
  } catch {
    return { featureId: "F5", status: "failed", reasonCode: "workflow_output_failed", outputDirectory: layout.runRoot, selectedWorksheetNames: [], manifestPath: paths.manifestPath };
  }
}

function throwIfAborted(context: RunContext, stage: string): void {
  if (!context.signal.aborted) return;
  throw normalizeRunnerError(new Error(`AbortError: signal already aborted before ${stage}.`), {
    fallbackRunId: context.attemptId,
    affectedInputReferences: [stage],
  });
}

export function runF5Interpretation(
  request: F5InterpretationRequest,
  context: RunContext,
  dependencies: F5Dependencies = {},
): F5InterpretationResult {
  const resolveOutputLayout = dependencies.resolveOutputLayout;
  const loadBundle = dependencies.loadBundle;
  const renderReport = dependencies.renderReport;
  const createInterpretation = dependencies.createInterpretation ?? createF5DataInterpretation;
  const mkdir = dependencies.mkdir ?? mkdirSync;
  const randomUuid = dependencies.randomUUID ?? randomUUID;
  const realpath = dependencies.realpath ?? realpathSync;
  const stat = dependencies.stat ?? statSync;
  const open = dependencies.open ?? openSync;
  const writeFd = dependencies.writeFd ?? ((fd, content) => writeFileSync(fd, content, "utf8"));
  const close = dependencies.close ?? closeSync;
  const rename = dependencies.rename ?? renameSync;
  const rmdir = dependencies.rmdir ?? rmdirSync;
  const rm = dependencies.rm ?? rmSync;
  if (!resolveOutputLayout || !loadBundle || !renderReport) {
    throw normalizeRunnerError(new Error("Feature 5 runner dependency is missing."), {
      fallbackRunId: context.attemptId,
      affectedInputReferences: ["f5"],
    });
  }

  let layout: F5Layout | undefined;
  let paths: ReturnType<typeof outputPaths> | undefined;
  let boundary: ReturnType<typeof captureCreatedRunBoundary> | undefined;
  const committedArtifacts: Record<string, string> = {};
  let loadStarted = false;
  let failureStage = "input";
  try {
    throwIfAborted(context, "resolve_output_layout");
    layout = resolveOutputLayout(request, context);
    paths = outputPaths(layout);
    mkdir(path.dirname(layout.runRoot), { recursive: true });
    mkdir(layout.runRoot);
    boundary = captureCreatedRunBoundary(layout, { realpath, stat, rmdir });
    loadStarted = true;
    const loaded = loadBundle(request);
    if (loaded?.status !== "accepted") {
      return failedResult(layout, paths, committedArtifacts, "input_rejected", boundary, { realpath, stat, randomUUID: randomUuid, open, writeFd, close, rename, rm });
    }

    failureStage = "interpretation";
    const observationFallback = loaded.observationFallback === undefined
      ? undefined
      : { reasonCode: "enhanced_observation_rejected" };
    const interpretationRequest = observationFallback === undefined
      ? loaded.request
      : { ...loaded.request, observationFallback };
    const coreResult = f5DataInterpretationResultSchema.parse(createInterpretation(interpretationRequest as never));
    const result = recomputeResult(coreResult, loaded.rejectedWorksheets ?? [], loaded.worksheetOrder);
    const observationArtifact = observationFallback !== undefined || loaded.observationArtifact === undefined
      ? undefined
      : f5ImageObservationArtifactSchema.parse(loaded.observationArtifact);
    const summaryLoaded = observationFallback === undefined
      ? loaded
      : {
          ...loaded,
          sourceReferences: Object.fromEntries(
            Object.entries(loaded.sourceReferences).filter(([key]) => key !== "observation"),
          ),
        };

    failureStage = "output";
    const contents: { reportJson: string; reportMarkdown: string; observations?: string } = {
      reportJson: json(result),
      reportMarkdown: renderReport(result, {
        outputRoot: layout.runRoot,
        f1ArtifactRoot: request.f1ArtifactRoot,
        publishRoot: layout.publishRoot,
      }),
      ...(observationArtifact === undefined ? {} : { observations: json(observationArtifact) }),
    };
    const summary = runSummary(result, summaryLoaded, contents);
    const writeDependencies = { realpath, stat, randomUUID: randomUuid, open, writeFd, close, rename, rm };

    atomicWrite(paths.reportJsonPath, contents.reportJson, boundary, writeDependencies);
    committedArtifacts.reportJson = layout.reportJsonName;
    atomicWrite(paths.reportMdPath, contents.reportMarkdown, boundary, writeDependencies);
    committedArtifacts.reportMarkdown = layout.reportMdName;
    if (contents.observations !== undefined) {
      atomicWrite(paths.imageObservationsPath, contents.observations, boundary, writeDependencies);
      committedArtifacts.imageObservations = layout.imageObservationsJsonName;
    }
    atomicWrite(paths.runSummaryPath, json(summary), boundary, writeDependencies);
    committedArtifacts.runSummary = layout.runSummaryJsonName;
    const workflowFailed = result.status === "input_rejected";
    atomicWrite(paths.manifestPath, json(manifest(layout, workflowFailed ? "failed" : result.status, committedArtifacts, workflowFailed ? "input_rejected" : undefined)), boundary, writeDependencies);
    context.emit({ kind: "artifact_written", featureId: "F5", stage: "report", timestamp: new Date().toISOString(), path: paths.reportJsonPath });
    const finalStatus = workflowFailed || result.status === "input_rejected" ? "failed" : result.status;
    return {
      featureId: "F5",
      status: finalStatus,
      ...(workflowFailed ? { reasonCode: "input_rejected" } : {}),
      outputDirectory: layout.runRoot,
      selectedWorksheetNames: [...(request.selectedWorksheetNames ?? [])],
      reportJsonPath: paths.reportJsonPath,
      reportMdPath: paths.reportMdPath,
      runSummaryPath: paths.runSummaryPath,
      manifestPath: paths.manifestPath,
      ...(observationArtifact === undefined ? {} : { imageObservationsPath: paths.imageObservationsPath, observationArtifact }),
      report: result,
      summary: result.summary,
    };
  } catch (error) {
    if (!loadStarted) {
      throw error;
    }
    if (layout && paths && boundary) {
      const reasonCode = failureStage === "interpretation"
        ? "interpretation_failed"
        : "workflow_output_failed";
      return failedResult(layout, paths, committedArtifacts, reasonCode, boundary, { realpath, stat, randomUUID: randomUuid, open, writeFd, close, rename, rm });
    }
    throw normalizeRunnerError(error, { fallbackRunId: context.attemptId, affectedInputReferences: ["f5"] });
  }
}