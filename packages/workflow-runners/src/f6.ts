/* eslint-disable @typescript-eslint/no-explicit-any -- runner facades validate external workflow artifact JSON at schema boundaries. */
import { randomUUID, createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  closeSync,
  readdirSync,
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

import { analysisRequestContextSchema, completedF5MultimodalProjection, createTypedError, f6OptimizationResultV4Schema, taEngineeringReportProjectionSchema } from "@ai-assist/contracts";
import { renderF6PdfSync } from "@ai-assist/product-export";
import { createF6OptimizationV4 } from "@ai-assist/workbook-catalog";

import { normalizeRunnerError } from "./error-normalizer.js";
import type { F6OptimizationRequest, F6OptimizationResult, RunContext } from "./types.js";

interface F6Layout {
  readonly artifactSetVersion: "f6-artifact-set-v3" | "f6-artifact-set-v4";
  readonly runId: string;
  readonly runRoot: string;
  readonly publishRoot: string;
  readonly optimizationJsonName: string;
  readonly finalReportMdName: string;
  readonly finalReportPdfName: string;
  readonly runSummaryJsonName: string;
  readonly manifestName: string;
  readonly allowExistingRunRoot?: boolean;
  readonly workspaceBoundary?: {
    readonly publishRootIdentity: {
      readonly requestedPath: string;
      readonly canonicalPath: string;
      readonly requestedDev: unknown;
      readonly requestedIno: unknown;
      readonly canonicalDev: unknown;
      readonly canonicalIno: unknown;
    };
    readonly runRootIdentity: {
      readonly requestedPath: string;
      readonly canonicalPath: string;
      readonly requestedDev: unknown;
      readonly requestedIno: unknown;
      readonly canonicalDev: unknown;
      readonly canonicalIno: unknown;
    };
  };
}

export interface F6Dependencies {
  readonly resolveOutputLayout?: (request: F6OptimizationRequest, context: RunContext) => F6Layout;
  readonly loadBundle?: (request: F6OptimizationRequest & { publishRoot?: string }) => any;
  readonly createOptimization?: typeof createF6OptimizationV4;
  readonly createFinalReport?: (input: any, options: { outputRoot: string; f1ArtifactRoot: string; publishRoot: string; requireMultimodalV3?: boolean }) => { markdown: string; reportSummary: unknown; projection: unknown };
  readonly renderFinalReportPdf?: typeof renderF6PdfSync;
  readonly mkdir?: typeof mkdirSync;
  readonly randomUUID?: typeof randomUUID;
  readonly realpath?: typeof realpathSync;
  readonly lstat?: typeof lstatSync;
  readonly stat?: typeof statSync;
  readonly open?: typeof openSync;
  readonly writeFd?: (descriptor: number, content: string | Buffer) => void;
  readonly close?: typeof closeSync;
  readonly rename?: typeof renameSync;
  readonly beforeRename?: (info: { temporaryPath: string; filePath: string }) => void;
  readonly afterRename?: (info: { temporaryPath: string; filePath: string }) => void;
  readonly readdir?: typeof readdirSync;
  readonly rmdir?: typeof rmdirSync;
  readonly rm?: typeof rmSync;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function identity(target: string, dependencies: Required<Pick<F6Dependencies, "stat">>) {
  const stats = dependencies.stat(target);
  return { dev: stats.dev, ino: stats.ino };
}

function identityAvailable(value: { dev: unknown; ino: unknown }): boolean {
  const valid = (field: unknown) => typeof field === "bigint" || (typeof field === "number" && Number.isFinite(field));
  return valid(value.dev) && valid(value.ino) && value.ino !== 0 && value.ino !== 0n;
}

function sameIdentity(expected: { dev: unknown; ino: unknown }, actual: { dev: unknown; ino: unknown }): boolean {
  return !identityAvailable(expected) || (identityAvailable(actual) && expected.dev === actual.dev && expected.ino === actual.ino);
}

function captureDirectoryIdentity(
  targetPath: string,
  dependencies: Required<Pick<F6Dependencies, "lstat" | "realpath" | "stat">>,
) {
  const requestedPath = path.resolve(targetPath);
  const requestedStats = dependencies.lstat(requestedPath);
  if (!requestedStats.isDirectory()) {
    throw new Error("Feature 6 workspace root identity is invalid.");
  }
  const canonicalPath = dependencies.realpath(requestedPath);
  const canonicalStats = dependencies.stat(canonicalPath);
  if (!canonicalStats.isDirectory()) {
    throw new Error("Feature 6 workspace root identity is invalid.");
  }
  return {
    requestedPath,
    canonicalPath,
    requestedDev: requestedStats.dev,
    requestedIno: requestedStats.ino,
    canonicalDev: canonicalStats.dev,
    canonicalIno: canonicalStats.ino,
  };
}

function samePinnedIdentity(
  expected: {
    readonly requestedPath: string;
    readonly canonicalPath: string;
    readonly requestedDev: unknown;
    readonly requestedIno: unknown;
    readonly canonicalDev: unknown;
    readonly canonicalIno: unknown;
  },
  actual: ReturnType<typeof captureDirectoryIdentity>,
): boolean {
  return expected.requestedPath === actual.requestedPath
    && expected.canonicalPath === actual.canonicalPath
    && expected.requestedDev === actual.requestedDev
    && expected.requestedIno === actual.requestedIno
    && expected.canonicalDev === actual.canonicalDev
    && expected.canonicalIno === actual.canonicalIno;
}

function assertPinnedDirectoryIdentity(
  expected: {
    readonly requestedPath: string;
    readonly canonicalPath: string;
    readonly requestedDev: unknown;
    readonly requestedIno: unknown;
    readonly canonicalDev: unknown;
    readonly canonicalIno: unknown;
  },
  dependencies: Required<Pick<F6Dependencies, "lstat" | "realpath" | "stat">>,
): void {
  const actual = captureDirectoryIdentity(expected.requestedPath, dependencies);
  if (!samePinnedIdentity(expected, actual)) {
    throw new Error("Feature 6 workspace root changed after validation.");
  }
}

function captureBoundary(layout: F6Layout, dependencies: Required<Pick<F6Dependencies, "realpath" | "stat" | "rmdir">>) {
  const realPublishRoot = dependencies.realpath(path.resolve(layout.publishRoot));
  const realRunRoot = dependencies.realpath(path.resolve(layout.runRoot));
  if (!isContained(realPublishRoot, realRunRoot)) {
    try { dependencies.rmdir(layout.runRoot); } catch { /* ignore */ }
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

function assertPublishBoundary(boundary: ReturnType<typeof captureBoundary>, dependencies: Required<Pick<F6Dependencies, "lstat" | "realpath" | "stat">>): void {
  if (boundary.layout.workspaceBoundary) {
    assertPinnedDirectoryIdentity(boundary.layout.workspaceBoundary.publishRootIdentity, dependencies);
  }
  const realPublishRoot = dependencies.realpath(path.resolve(boundary.layout.publishRoot));
  if (realPublishRoot !== boundary.realPublishRoot || !sameIdentity(boundary.publishIdentity, identity(realPublishRoot, dependencies))) {
    throw new Error("Feature 6 publish root changed after creation.");
  }
}

function assertBoundary(boundary: ReturnType<typeof captureBoundary>, dependencies: Required<Pick<F6Dependencies, "lstat" | "realpath" | "stat">>): void {
  assertPublishBoundary(boundary, dependencies);
  if (boundary.layout.workspaceBoundary) {
    assertPinnedDirectoryIdentity(boundary.layout.workspaceBoundary.runRootIdentity, dependencies);
  }
  const realPublishRoot = boundary.realPublishRoot;
  const realRunRoot = dependencies.realpath(path.resolve(boundary.layout.runRoot));
  if (!isContained(realPublishRoot, realRunRoot)
    || realRunRoot !== boundary.realRunRoot
    || !sameIdentity(boundary.runIdentity, identity(realRunRoot, dependencies))) {
    throw new Error("Feature 6 run root changed after creation.");
  }
}

function assertDirectoryNotReparse(target: string, dependencies: Required<Pick<F6Dependencies, "lstat">>): void {
  const stats = dependencies.lstat(target);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("Feature 6 staging path must be a physical directory.");
  }
}

function captureStagingBoundary(boundary: ReturnType<typeof captureBoundary>, dependencies: Required<Pick<F6Dependencies, "realpath" | "stat" | "lstat" | "mkdir" | "randomUUID">>) {
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
  if (realStagingRoot !== stagingRoot || !isContained(boundary.realPublishRoot, realStagingRoot) || isContained(boundary.realRunRoot, realStagingRoot)) {
    throw new Error("Feature 6 staging directory is outside its controlled boundary.");
  }
  return {
    stagingBase,
    realStagingBase,
    stagingRoot,
    realStagingRoot,
    baseIdentity: identity(realStagingBase, dependencies),
    rootIdentity: identity(realStagingRoot, dependencies),
    ownedTemporaryPaths: new Set<string>(),
  };
}

function assertStagingBoundary(boundary: ReturnType<typeof captureBoundary>, staging: ReturnType<typeof captureStagingBoundary>, dependencies: Required<Pick<F6Dependencies, "realpath" | "stat" | "lstat">>): void {
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

function assertCommittedFile(filePath: string, expectedIdentity: { dev: unknown; ino: unknown }, boundary: ReturnType<typeof captureBoundary>, dependencies: Required<Pick<F6Dependencies, "realpath" | "stat">>): void {
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

function removeOwnedTemporary(temporaryPath: string, boundary: ReturnType<typeof captureBoundary>, staging: ReturnType<typeof captureStagingBoundary>, dependencies: Required<Pick<F6Dependencies, "realpath" | "stat" | "lstat" | "rm">>): void {
  try {
    assertStagingBoundary(boundary, staging, dependencies);
    dependencies.rm(temporaryPath, { force: true });
    staging.ownedTemporaryPaths.delete(temporaryPath);
  } catch {
    // ignore
  }
}

function atomicWrite(filePath: string, content: string | Buffer, boundary: ReturnType<typeof captureBoundary>, staging: ReturnType<typeof captureStagingBoundary>, dependencies: Required<Pick<F6Dependencies, "realpath" | "stat" | "lstat" | "randomUUID" | "open" | "writeFd" | "close" | "rename" | "beforeRename" | "afterRename" | "rm">>): void {
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

function cleanupStaging(boundary: ReturnType<typeof captureBoundary>, staging: ReturnType<typeof captureStagingBoundary>, dependencies: Required<Pick<F6Dependencies, "realpath" | "stat" | "lstat" | "rmdir" | "rm">>): void {
  try {
    assertStagingBoundary(boundary, staging, dependencies);
    for (const temporaryPath of staging.ownedTemporaryPaths) dependencies.rm(temporaryPath, { force: true });
    staging.ownedTemporaryPaths.clear();
    dependencies.rmdir(staging.stagingRoot);
    assertPublishBoundary(boundary, dependencies);
    assertDirectoryNotReparse(staging.stagingBase, dependencies);
    if (sameIdentity(staging.baseIdentity, identity(staging.stagingBase, dependencies))) {
      try { dependencies.rmdir(staging.stagingBase); } catch { /* ignore */ }
    }
  } catch {
    // ignore
  }
}

function outputPaths(layout: F6Layout) {
  return {
    optimizationJson: path.join(layout.runRoot, layout.optimizationJsonName),
    finalReportMarkdown: path.join(layout.runRoot, layout.finalReportMdName),
    finalReportPdf: path.join(layout.runRoot, layout.finalReportPdfName),
    runSummary: path.join(layout.runRoot, layout.runSummaryJsonName),
    manifest: path.join(layout.runRoot, layout.manifestName),
  };
}

function assertWorkspaceStageReady(
  layout: F6Layout,
  dependencies: Required<Pick<F6Dependencies, "readdir" | "lstat">>,
): void {
  if (!layout.allowExistingRunRoot) return;
  const entries = dependencies.readdir(layout.runRoot, { withFileTypes: true });
  const hasOnlySemanticEvidence = entries.length === 1
    && entries[0]?.name === "evidence"
    && entries[0].isDirectory()
    && !dependencies.lstat(path.join(layout.runRoot, entries[0].name)).isSymbolicLink();
  if (entries.length === 0 || hasOnlySemanticEvidence) return;
  throw createTypedError({
    code: "prerequisite_not_ready",
    summary: "Workspace stage already contains published artifacts.",
    suggestedAction: "Choose a fresh analysis workspace stage before rerunning this workflow.",
    affectedInputReferences: [layout.runRoot],
    details: { reasonCode: "workspace_stage_not_empty" },
  });
}

function generatedAtFromRunId(runId: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(String(runId));
  if (match === null) return String(runId);
  const [, date, hour, minute, second, millisecond] = match;
  return `${date}T${hour}:${minute}:${second}.${millisecond}Z`;
}

function safeSources(sourceReferences: Record<string, { artifact: string; contentHash: string }>) {
  return Object.fromEntries(Object.entries(sourceReferences).map(([key, reference]) => [key, {
    artifact: path.basename(String(reference.artifact)),
    contentHash: reference.contentHash,
  }]));
}

function manifest(layout: F6Layout, status: string, artifacts: Record<string, string>, reasonCode?: string, inputDecisions?: unknown, interactionLanguage?: unknown, analysisRequestContext?: unknown, adoTraceability?: unknown, failureDetail?: F6OptimizationResult["failureDetail"]) {
  return {
    contractVersion: "v1",
    artifactSetVersion: layout.artifactSetVersion,
    featureId: "F6",
    status,
    runId: layout.runId,
    ...(reasonCode === undefined ? {} : { reasonCode }),
    ...(inputDecisions === undefined ? {} : { inputDecisions }),
    ...(interactionLanguage === undefined ? {} : { interactionLanguage }),
    ...(analysisRequestContext === undefined ? {} : { analysisRequestContext }),
    ...(adoTraceability === undefined ? {} : { adoTraceability }),
    ...(failureDetail === undefined ? {} : { failureDetail }),
    artifacts,
  };
}

function adoTraceability(f3Report: any): unknown | undefined {
  return f3Report?.modelVersion === "drawing-governance-v3" ? f3Report.ado : undefined;
}

function safeReportFailureDetail(stage: string, error: unknown): F6OptimizationResult["failureDetail"] | undefined {
  if (stage === "report_projection") return { code: "report_projection_failed" };
  if (stage !== "pdf_render") return undefined;
  if (typeof error !== "object" || error === null || !("code" in error)) return { code: "pdf_render_failed" };
  const code = (error as { code?: unknown }).code;
  if (code !== "pdf_artifact_invalid" && code !== "pdf_render_unavailable") return { code: "pdf_render_failed" };
  if (!("attempts" in error) || !Array.isArray((error as { attempts?: unknown }).attempts)) return { code };

  const attempts: Array<{ browser: string; reason: "execution_failed" | "invalid_pdf" }> = [];
  for (const attempt of (error as { attempts: unknown[] }).attempts) {
    if (typeof attempt !== "object" || attempt === null) continue;
    const browser = "browser" in attempt ? attempt.browser : undefined;
    const reason = "reason" in attempt ? attempt.reason : undefined;
    if (typeof browser !== "string" || browser.length === 0
      || (reason !== "execution_failed" && reason !== "invalid_pdf")) continue;
    attempts.push({ browser: path.basename(browser), reason });
  }
  return attempts.length === 0 ? { code } : { code, attempts };
}

function validInteractionLanguage(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const language = value as Record<string, unknown>;
  return typeof language.languageTag === "string" && language.languageTag.length > 0
    && (language.uiCatalogLanguage === "en" || language.uiCatalogLanguage === "zh")
    && typeof language.lockedAtTurnId === "string" && language.lockedAtTurnId.length > 0
    && (language.source === "workflow_start" || language.source === "explicit_user_change")
    && language.fallbackUsed === false
    && Object.keys(language).length === 5;
}

function failedResult(layout: F6Layout, paths: ReturnType<typeof outputPaths>, artifacts: Record<string, string>, reasonCode: string, boundary: ReturnType<typeof captureBoundary>, staging: ReturnType<typeof captureStagingBoundary>, dependencies: Required<Pick<F6Dependencies, "realpath" | "stat" | "lstat" | "randomUUID" | "open" | "writeFd" | "close" | "rename" | "beforeRename" | "afterRename" | "rm">>, failureDetail?: F6OptimizationResult["failureDetail"]): F6OptimizationResult {
  try {
    assertBoundary(boundary, dependencies);
    atomicWrite(paths.manifest, json(manifest(layout, "failed", artifacts, reasonCode, undefined, undefined, undefined, undefined, failureDetail)), boundary, staging, dependencies);
    return { featureId: "F6", status: "failed", reasonCode, ...(failureDetail === undefined ? {} : { failureDetail }), outputDirectory: layout.runRoot, manifestPath: paths.manifest };
  } catch {
    return { featureId: "F6", status: "failed", reasonCode: "workflow_output_failed", outputDirectory: layout.runRoot };
  }
}

function requireDecisionOrder(inputDecisions: any, loaded: any): void {
  const hasContext = inputDecisions.analysisContext?.outcome === "CALLER_AUTHORIZED" || loaded.analysisContext !== undefined;
  const hasTargets = inputDecisions.optimizationTargets?.outcome === "CALLER_AUTHORIZED" || loaded.optimizationTargets !== undefined;
  if (hasTargets && !hasContext) {
    throw createTypedError({
      code: "prerequisite_not_ready",
      summary: "Feature 6 requires a confirmed analysis context before optimization targets.",
      retryable: false,
      suggestedAction: "Confirm analysis context before providing optimization targets.",
      affectedInputReferences: ["analysisContext", "optimizationTargets"],
    });
  }
}

function verifyCallerAuthorizedHash(
  expectedHash: string | undefined,
  decision: { readonly outcome?: unknown; readonly artifactReference?: { readonly contentHash?: unknown } } | undefined,
): boolean {
  if (expectedHash === undefined) return true;
  return decision?.outcome === "CALLER_AUTHORIZED"
    && typeof decision.artifactReference?.contentHash === "string"
    && decision.artifactReference.contentHash === expectedHash;
}

function parseAnalysisRequestContext(value: unknown) {
  return analysisRequestContextSchema.safeParse(value);
}

function throwIfAborted(context: RunContext, stage: string): void {
  if (!context.signal.aborted) return;
  throw normalizeRunnerError(new Error(`AbortError: signal already aborted before ${stage}.`), {
    fallbackRunId: context.attemptId,
    affectedInputReferences: [stage],
  });
}

export function runF6Optimization(
  request: F6OptimizationRequest,
  context: RunContext,
  dependencies: F6Dependencies = {},
): F6OptimizationResult {
  const resolveOutputLayout = dependencies.resolveOutputLayout;
  const loadBundle = dependencies.loadBundle;
  const createOptimization = dependencies.createOptimization ?? createF6OptimizationV4;
  const createFinalReport = dependencies.createFinalReport;
  const renderFinalReportPdf = dependencies.renderFinalReportPdf ?? renderF6PdfSync;
  const mkdir = dependencies.mkdir ?? mkdirSync;
  const randomUuid = dependencies.randomUUID ?? randomUUID;
  const realpath = dependencies.realpath ?? realpathSync;
  const lstat = dependencies.lstat ?? lstatSync;
  const stat = dependencies.stat ?? statSync;
  const open = dependencies.open ?? openSync;
  const writeFd = dependencies.writeFd ?? ((descriptor, content) => writeFileSync(descriptor, content, "utf8"));
  const close = dependencies.close ?? closeSync;
  const rename = dependencies.rename ?? renameSync;
  const beforeRename = dependencies.beforeRename ?? (() => {});
  const afterRename = dependencies.afterRename ?? (() => {});
  const readdir = dependencies.readdir ?? readdirSync;
  const rmdir = dependencies.rmdir ?? rmdirSync;
  const rm = dependencies.rm ?? rmSync;
  if (!resolveOutputLayout || !loadBundle || !createFinalReport) {
    throw normalizeRunnerError(new Error("Feature 6 runner dependency is missing."), {
      fallbackRunId: context.attemptId,
      affectedInputReferences: ["f6"],
    });
  }

  let boundary: ReturnType<typeof captureBoundary> | undefined;
  let staging: ReturnType<typeof captureStagingBoundary> | undefined;
  let artifacts: Record<string, string> | undefined;
  let failureStage = "output";
  try {
    throwIfAborted(context, "resolve_output_layout");
    const layout = resolveOutputLayout(request, context);
    const paths = outputPaths(layout);
    mkdir(path.dirname(layout.runRoot), { recursive: true });
    if (!layout.allowExistingRunRoot) mkdir(layout.runRoot);
    boundary = captureBoundary(layout, { realpath, stat, rmdir });
    assertWorkspaceStageReady(layout, { readdir, lstat });
    staging = captureStagingBoundary(boundary, { realpath, stat, lstat, mkdir, randomUUID: randomUuid });
    artifacts = {};
    failureStage = "input";

    const loaded = loadBundle({ ...request, publishRoot: layout.publishRoot });
    if (loaded?.status !== "accepted") {
      return failedResult(layout, paths, artifacts, "input_rejected", boundary, staging, { realpath, stat, lstat, randomUUID: randomUuid, open, writeFd, close, rename, beforeRename, afterRename, rm });
    }
    const parsedRequestContext = parseAnalysisRequestContext(request.analysisRequestContext);
    const parsedLoadedRequestContext = parseAnalysisRequestContext(loaded.request?.analysisRequestContext);
    if (!parsedRequestContext.success
      || !parsedLoadedRequestContext.success
      || !isDeepStrictEqual(parsedRequestContext.data, parsedLoadedRequestContext.data)) {
      return failedResult(layout, paths, artifacts, "input_rejected", boundary, staging, { realpath, stat, lstat, randomUUID: randomUuid, open, writeFd, close, rename, beforeRename, afterRename, rm });
    }

    const inputDecisions = {
      analysisContext: loaded.inputDecisions?.analysisContext ?? { outcome: "NOT_PROVIDED" },
      optimizationTargets: loaded.inputDecisions?.optimizationTargets ?? { outcome: "NOT_PROVIDED" },
      modelInterpretation: loaded.inputDecisions?.modelInterpretation ?? { outcome: "NOT_PROVIDED" },
    };
    requireDecisionOrder(inputDecisions, loaded);
    if (!validInteractionLanguage(request.interactionLanguage)
      || !verifyCallerAuthorizedHash(request.expectedAnalysisContextContentHash, inputDecisions.analysisContext)
      || !verifyCallerAuthorizedHash(request.expectedOptimizationTargetsContentHash, inputDecisions.optimizationTargets)
      || loaded.modelInterpretation === undefined
      || !["f5-multimodal-artifact-v3", "f5-multimodal-artifact-v4"].includes(loaded.modelInterpretation.contractVersion)
      || typeof request.expectedModelInterpretationContentHash !== "string"
      || !verifyCallerAuthorizedHash(request.expectedModelInterpretationContentHash, inputDecisions.modelInterpretation)) {
      return failedResult(layout, paths, artifacts, "input_rejected", boundary, staging, { realpath, stat, lstat, randomUUID: randomUuid, open, writeFd, close, rename, beforeRename, afterRename, rm });
    }

    failureStage = "optimization";
    const { analysisRequestContext: _loadedAnalysisRequestContext, ...optimizationRequest } = loaded.request;
    const optimizationCandidate = createOptimization(optimizationRequest, {
      interactionLanguage: request.interactionLanguage,
      multimodalInterpretation: loaded.modelInterpretation.contractVersion === "f5-multimodal-artifact-v4"
        ? completedF5MultimodalProjection(loaded.modelInterpretation)
        : loaded.modelInterpretation,
      multimodalReference: inputDecisions.modelInterpretation.artifactReference,
      ...(loaded.sourceReferences.imageObservation === undefined
        ? {}
        : { imageObservationReference: loaded.sourceReferences.imageObservation }),
      ...(loaded.sourceReferences.supplierCapability === undefined
        ? {}
        : { supplierCapabilityReference: loaded.sourceReferences.supplierCapability }),
      ...(loaded.sourceReferences.datumStrategy === undefined
        ? {}
        : { datumStrategyReference: loaded.sourceReferences.datumStrategy }),
      ...(loaded.sourceReferences.cost === undefined
        ? {}
        : { costReference: loaded.sourceReferences.cost }),
      ...(loaded.sourceReferences.analysisContext === undefined
        ? {}
        : { analysisContextReference: loaded.sourceReferences.analysisContext }),
      ...(loaded.sourceReferences.optimizationTargets === undefined
        ? {}
        : { optimizationTargetsReference: loaded.sourceReferences.optimizationTargets }),
      ...(loaded.optimizationTargets === undefined ? {} : { optimizationTargets: loaded.optimizationTargets }),
      optimizationTargetsDecision: inputDecisions.optimizationTargets,
    });
    const parsedOptimization = f6OptimizationResultV4Schema.safeParse(optimizationCandidate);
    if (!parsedOptimization.success) throw new Error("Feature 6 optimizer must emit a governed v4 result.");
    const optimization = parsedOptimization.data;

    failureStage = "report_projection";
    const finalReportCandidate = createFinalReport({
      f2Report: loaded.f2Report,
      f3Report: loaded.f3Report,
      f4Report: loaded.f4Report,
      f5Report: loaded.f5Report,
      f6Optimization: optimization,
      interactionLanguage: request.interactionLanguage,
      analysisRequestContext: parsedRequestContext.data,
      generatedAt: generatedAtFromRunId(layout.runId),
      ...(loaded.analysisContext === undefined ? {} : { analysisContext: loaded.analysisContext }),
      ...(loaded.modelInterpretation === undefined ? {} : { modelInterpretation: loaded.modelInterpretation }),
    }, {
      outputRoot: layout.runRoot,
      f1ArtifactRoot: loaded.f2Report.artifactRoot,
      publishRoot: layout.publishRoot,
      requireMultimodalV3: true,
    });
    const finalReport = taEngineeringReportProjectionSchema.parse(finalReportCandidate);

    failureStage = "pdf_render";
    const finalReportPdf = renderFinalReportPdf({
      markdown: finalReport.markdown,
      sourceHash: sha256(finalReport.markdown),
      reportPath: paths.finalReportMarkdown,
      managedRoot: layout.publishRoot,
    });
    if (!Buffer.isBuffer(finalReportPdf)
      || finalReportPdf.length < 8
      || finalReportPdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("Feature 6 PDF renderer must return valid PDF bytes.");
    }
    const contents = {
      optimizationJson: json(optimization),
      finalReportMarkdown: finalReport.markdown,
      finalReportPdf,
    };
    const workflowStatus = optimization.runStatus.toLowerCase() as F6OptimizationResult["status"];
    const structuredAdoTraceability = adoTraceability(loaded.f3Report);
    const summary = {
      contractVersion: "v1",
      artifactSetVersion: layout.artifactSetVersion,
      featureId: "F6",
      status: workflowStatus,
      sources: safeSources(loaded.sourceReferences),
      inputDecisions,
      interactionLanguage: request.interactionLanguage,
      analysisRequestContext: parsedRequestContext.data,
      ...(structuredAdoTraceability === undefined ? {} : { adoTraceability: structuredAdoTraceability }),
      counts: optimization.summary,
      hashes: Object.fromEntries(Object.entries(contents).map(([key, content]) => [`${key}Sha256`, sha256(content)])),
      reportSummary: finalReport.reportSummary,
    };

    failureStage = "output";
    const writeDependencies = { realpath, stat, lstat, randomUUID: randomUuid, open, writeFd, close, rename, beforeRename, afterRename, rm };
    for (const key of ["optimizationJson", "finalReportMarkdown", "finalReportPdf"] as const) {
      atomicWrite(paths[key], contents[key], boundary, staging, writeDependencies);
      artifacts[key] = path.basename(paths[key]);
    }
    atomicWrite(paths.runSummary, json(summary), boundary, staging, writeDependencies);
    artifacts.runSummary = layout.runSummaryJsonName;
    atomicWrite(paths.manifest, json(manifest(layout, workflowStatus, artifacts, undefined, inputDecisions, request.interactionLanguage, parsedRequestContext.data, structuredAdoTraceability)), boundary, staging, writeDependencies);
    context.emit({ kind: "artifact_written", featureId: "F6", stage: "report", timestamp: new Date().toISOString(), path: paths.optimizationJson });
    return {
      featureId: "F6",
      status: workflowStatus,
      outputDirectory: layout.runRoot,
      optimizationJsonPath: paths.optimizationJson,
      finalReportMdPath: paths.finalReportMarkdown,
      finalReportPdfPath: paths.finalReportPdf,
      runSummaryPath: paths.runSummary,
      manifestPath: paths.manifest,
      optimization,
      finalReportProjection: finalReport.projection,
      inputDecisions,
      summary: optimization.summary,
    };
  } catch (error) {
    if (boundary && staging && artifacts && !(error instanceof Error && "code" in error && (error as any).code === "prerequisite_not_ready")) {
      const reasonCode = failureStage === "input"
        ? "input_rejected"
        : failureStage === "optimization"
          ? "optimization_failed"
          : failureStage === "report_projection" || failureStage === "pdf_render"
            ? "report_failed"
            : "workflow_output_failed";
      const failureDetail = safeReportFailureDetail(failureStage, error);
      try {
        return failedResult(boundary.layout, outputPaths(boundary.layout), artifacts, reasonCode, boundary, staging, { realpath, stat, lstat, randomUUID: randomUuid, open, writeFd, close, rename, beforeRename, afterRename, rm }, failureDetail);
      } finally {
        cleanupStaging(boundary, staging, { realpath, stat, lstat, rmdir, rm });
      }
    }
    if (error instanceof Error && "code" in error && (error as any).code === "prerequisite_not_ready") {
      throw error;
    }
    throw normalizeRunnerError(error, { fallbackRunId: context.attemptId, affectedInputReferences: ["f6"] });
  } finally {
    if (boundary && staging) cleanupStaging(boundary, staging, { realpath, stat, lstat, rmdir, rm });
  }
}