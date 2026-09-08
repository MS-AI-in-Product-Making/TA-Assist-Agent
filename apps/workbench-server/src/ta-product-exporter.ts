import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path, { basename, dirname, join, relative, resolve } from "node:path";

import {
  createTypedError,
  taEngineeringReportProjectionSchema,
  taEngineeringReportProjectionContentSchema,
  taProductExportCommandSchema,
  taProductExportManifestSchema,
  taProductExportReceiptSchema,
  type TaEngineeringReportProjectionContent,
  type TaProductExportCommand,
  type TaProductExportManifest,
  type TaProductExportReceipt,
  type TaProductExportRecord,
} from "@ai-assist/contracts";
import { createProductRunReference } from "@ai-assist/product-language";
import {
  commitProductExport,
  contentSha256,
  prepareProductExport,
  verifyExistingProductExport,
  type ProductExportRequest,
  type ProductExportResult,
} from "@ai-assist/product-export";
import { canonicalSelectedWorksheetSetHash, computeTaReportSemanticDigest, openSessionStore, type SessionArtifactReference } from "@ai-assist/workbench";

import { createProductExportStore, type ProductExportStoreRecord } from "./product-export-store.js";

type EvidenceFeature = "F2" | "F3" | "F4" | "F5" | "F6";

interface ResolvedArtifact {
  readonly reference: SessionArtifactReference;
  readonly text: string;
  readonly mediaType: string;
}

interface ProductionRoots {
  readonly f1Root: string;
  readonly f2Root: string;
  readonly f3Root?: string;
  readonly f4Root?: string;
  readonly f5Root?: string;
  readonly f6Root?: string;
}

interface TrustedExportSource {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly sourceRunReference: string;
  readonly workbook: {
    readonly fileName: string;
    readonly contentHash: string;
  };
  readonly worksheetScope: readonly string[];
  readonly projection: TaEngineeringReportProjectionContent;
  readonly semanticDigest: string;
  readonly finalReport: string;
  readonly improvementOptions: string;
  readonly runSummaryJson: string;
  readonly evidenceFiles: readonly {
    readonly relativePath: string;
    readonly content: string;
    readonly displayName: string;
    readonly mediaType: string;
  }[];
  readonly sourceBinding: {
    readonly sourceRunReference: string;
    readonly workbookContentHash: string;
    readonly worksheetScope: readonly string[];
    readonly reviewContext: {
      readonly workbookHash: string;
      readonly downstreamSelectionHash: string;
      readonly baselineRunReference: string;
    };
    readonly productionRoots: {
      readonly f3Root: string;
      readonly f4Root: string;
      readonly f5Root: string;
      readonly f6Root: string;
    };
    readonly artifactHashes: Readonly<Record<string, string>>;
  };
  readonly projectionArtifactId: string;
  readonly projectionArtifactSha256: string;
}

export interface TaAnalysisExportSource {
  readonly sourceRunReference: string;
  readonly sourceClass: "validated_production" | "internal_fixture";
  readonly verificationStatus: "verified" | "legacy_unverified";
  readonly lineage: {
    readonly initialScopeProvenance: "user" | "system";
    readonly downstreamScopeProvenance: "user" | "system";
  };
  readonly workbook: {
    readonly fileName: string;
    readonly contentHash: string;
  };
  readonly worksheetScope: readonly string[];
  readonly executionStatus: "completed" | "failed" | "cancelled";
  readonly businessDisposition: "PASS" | "FAIL" | "CONDITIONAL_PASS" | "INCOMPLETE";
  readonly finalReport: string;
  readonly improvementOptions: string;
  readonly runSummaryJson: string;
}

export interface TaProductExportResult {
  readonly root: string;
  readonly manifest: TaProductExportManifest;
  readonly semanticDigest: string;
}

export interface TaProductExporterOptions {
  readonly rootDir: string;
  readonly runF6?: () => unknown;
}

function deny(summary: string, reference: string): never {
  throw createTypedError({
    code: "policy_denied",
    summary,
    suggestedAction: "Export only validated production output with user-confirmed lineage.",
    affectedInputReferences: [reference],
  });
}

function evidenceMismatch(summary: string, reference: string): never {
  throw createTypedError({
    code: "evidence_mismatch",
    summary,
    suggestedAction: "Rerun Drawing Governance through Design Optimization and retry product export for the current workbook revision.",
    affectedInputReferences: [reference],
  });
}

function toTypedCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof (error as { readonly code?: unknown }).code === "string"
    ? (error as { readonly code: string }).code
    : undefined;
}

function readArtifactReviewContext(reference: SessionArtifactReference): {
  readonly workbookHash: string;
  readonly downstreamSelectionHash: string;
  readonly baselineRunReference: string;
} | undefined {
  const fromMetadata = reference.metadata;
  const candidate = typeof fromMetadata === "object" && fromMetadata !== null && "reviewContext" in fromMetadata
    ? (fromMetadata as { readonly reviewContext?: unknown }).reviewContext
    : reference.reviewContext;
  if (typeof candidate !== "object" || candidate === null) {
    return undefined;
  }
  if (typeof (candidate as { readonly workbookHash?: unknown }).workbookHash !== "string"
    || typeof (candidate as { readonly downstreamSelectionHash?: unknown }).downstreamSelectionHash !== "string"
    || typeof (candidate as { readonly baselineRunReference?: unknown }).baselineRunReference !== "string") {
    return undefined;
  }
  return {
    workbookHash: (candidate as { readonly workbookHash: string }).workbookHash,
    downstreamSelectionHash: (candidate as { readonly downstreamSelectionHash: string }).downstreamSelectionHash,
    baselineRunReference: (candidate as { readonly baselineRunReference: string }).baselineRunReference,
  };
}

function mapBusinessDisposition(value: TaAnalysisExportSource["businessDisposition"]): "PASS" | "FAIL" | "REVIEW" {
  if (value === "PASS") return "PASS";
  if (value === "FAIL") return "FAIL";
  return "REVIEW";
}

function mapProjectionDisposition(value: TaEngineeringReportProjectionContent["workbookDisposition"]): "PASS" | "FAIL" | "REVIEW" {
  if (value === "PASS") return "PASS";
  if (value === "FAIL") return "FAIL";
  return "REVIEW";
}

function toRecord(result: ProductExportResult, displayName: string, fileName: string, mediaType: string): TaProductExportRecord {
  const file = result.manifest.files.find((candidate) => candidate.relativePath === fileName);
  if (file === undefined) {
    evidenceMismatch(`Export manifest is missing required file: ${fileName}`, fileName);
  }
  return {
    displayName,
    fileName,
    mediaType,
    byteSize: file.byteSize,
    sha256: file.sha256,
  };
}

function normalizePath(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function toPublicExportRoot(rootDir: string, absoluteRoot: string): string {
  const rootBase = resolve(rootDir);
  const exportRoot = resolve(absoluteRoot);
  const relativeRoot = relative(rootBase, exportRoot);
  if (relativeRoot.length === 0 || relativeRoot.startsWith("..") || path.isAbsolute(relativeRoot)) {
    deny("Product export root escaped the controlled workspace root.", absoluteRoot);
  }
  return relativeRoot.replace(/\\+/g, "/");
}

function isContainedPath(rootReal: string, targetReal: string): boolean {
  const delta = relative(rootReal, targetReal);
  return delta.length > 0 && !delta.startsWith("..") && !delta.split(/[\\/]/).includes("..");
}

async function assertNoSymlinkAncestors(rootReal: string, targetReal: string, reference: string): Promise<void> {
  const segments = relative(rootReal, targetReal).split(/[\\/]/).filter(Boolean);
  let current = rootReal;
  for (const segment of segments) {
    current = join(current, segment);
    const stats = await lstat(current);
    if (stats.isSymbolicLink()) {
      deny("Managed file reference was rejected.", reference);
    }
  }
}

async function readManagedText(rootDir: string, relativePath: string, expectedHash: string | undefined, expectedName: string): Promise<string> {
  const rootReal = await realpath(rootDir);
  const absolutePath = resolve(rootDir, relativePath);
  const originalStats = await lstat(absolutePath);
  if (!originalStats.isFile() || originalStats.isSymbolicLink()) {
    deny("Managed file reference was rejected.", relativePath);
  }
  const targetReal = await realpath(absolutePath);
  const resolvedStats = await lstat(targetReal);
  if (!resolvedStats.isFile() || basename(targetReal) !== expectedName || !isContainedPath(rootReal, targetReal)) {
    deny("Managed file reference was rejected.", relativePath);
  }
  await assertNoSymlinkAncestors(rootReal, targetReal, relativePath);
  if (normalizePath(targetReal) !== normalizePath(absolutePath)) {
    deny("Managed file reference was rejected.", relativePath);
  }

  const bytes = await readFile(targetReal);
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (expectedHash !== undefined && actualHash !== expectedHash) {
    evidenceMismatch("Managed artifact content hash changed.", relativePath);
  }
  return bytes.toString("utf8");
}

async function resolveArtifact(
  rootDir: string,
  sessionId: string,
  readReference: (artifactId: string) => Promise<SessionArtifactReference | undefined>,
  inputRevision: number,
  artifactBaseId: string,
  expectedKind: string,
  mediaType: string,
  expectedReviewContext: {
    readonly workbookHash: string;
    readonly downstreamSelectionHash: string;
    readonly baselineRunReference: string;
  },
): Promise<ResolvedArtifact> {
  const candidates = [`${artifactBaseId}:${inputRevision}:${sessionId}`, `${artifactBaseId}:${inputRevision}`, artifactBaseId];
  let reference: SessionArtifactReference | undefined;
  for (const artifactId of candidates) {
    reference = await readReference(artifactId);
    if (reference !== undefined) break;
  }
  if (reference === undefined || reference.sessionId !== sessionId) {
    evidenceMismatch(`Required artifact ${artifactBaseId} is unavailable.`, artifactBaseId);
  }
  if (reference.kind !== expectedKind || reference.inputRevision !== inputRevision) {
    evidenceMismatch(`Artifact ${artifactBaseId} does not match the current revision lineage.`, artifactBaseId);
  }
  const reviewContext = readArtifactReviewContext(reference);
  if (reviewContext === undefined
    || reviewContext.workbookHash !== expectedReviewContext.workbookHash
    || reviewContext.downstreamSelectionHash !== expectedReviewContext.downstreamSelectionHash
    || reviewContext.baselineRunReference !== expectedReviewContext.baselineRunReference) {
    evidenceMismatch(`Artifact ${artifactBaseId} does not match the current review context lineage.`, artifactBaseId);
  }

  const text = await readManagedText(rootDir, reference.relativePath, reference.contentHash, basename(reference.relativePath));
  return { reference, text, mediaType };
}

async function resolveProjectionArtifact(
  rootDir: string,
  sessionId: string,
  readReference: (artifactId: string) => Promise<SessionArtifactReference | undefined>,
  inputRevision: number,
  expectedReviewContext: {
    readonly workbookHash: string;
    readonly downstreamSelectionHash: string;
    readonly baselineRunReference: string;
  },
): Promise<ResolvedArtifact> {
  const candidates = [`engineering-summary-projection:${inputRevision}:${sessionId}`, `engineering-summary-projection:${inputRevision}`, "engineering-summary-projection"];
  const resolved = await Promise.all(candidates.map(async (artifactId) => await readReference(artifactId)));
  const references = resolved.filter((entry): entry is SessionArtifactReference => entry !== undefined);
  if (references.length !== 1) {
    evidenceMismatch("Exactly one current projection artifact registration is required.", "engineering-summary-projection");
  }
  const reference = references[0]!;
  if (reference.sessionId !== sessionId || reference.kind !== "engineering_summary_projection" || reference.inputRevision !== inputRevision) {
    evidenceMismatch("Projection artifact does not match the current revision lineage.", "engineering-summary-projection");
  }
  const reviewContext = readArtifactReviewContext(reference);
  if (reviewContext === undefined
    || reviewContext.workbookHash !== expectedReviewContext.workbookHash
    || reviewContext.downstreamSelectionHash !== expectedReviewContext.downstreamSelectionHash
    || reviewContext.baselineRunReference !== expectedReviewContext.baselineRunReference) {
    evidenceMismatch("Projection artifact does not match the current review context lineage.", "engineering-summary-projection");
  }

  const text = await readManagedText(rootDir, reference.relativePath, reference.contentHash, basename(reference.relativePath));
  return {
    reference,
    text,
    mediaType: "application/json",
  };
}

function extractEvidenceFeatures(projection: TaEngineeringReportProjectionContent): readonly EvidenceFeature[] {
  const features = new Set<EvidenceFeature>();
  for (const worksheet of projection.worksheets) {
    for (const reference of worksheet.gatingEvidenceReferences) {
      if (/^F2(?::|$)/i.test(reference)) features.add("F2");
      if (/^F3(?::|$)/i.test(reference)) features.add("F3");
      if (/^F4(?::|$)/i.test(reference)) features.add("F4");
      if (/^F5(?::|$)/i.test(reference)) features.add("F5");
      if (/^F6(?::|$)/i.test(reference)) features.add("F6");
    }
  }
  return [...features].sort();
}

function buildEvidenceFiles(
  requested: readonly EvidenceFeature[],
  inputs: {
    readonly f3: ResolvedArtifact;
    readonly f4: ResolvedArtifact;
    readonly f5: ResolvedArtifact;
    readonly f6: ResolvedArtifact;
  },
): TrustedExportSource["evidenceFiles"] {
  const byFeature: Record<EvidenceFeature, ResolvedArtifact | undefined> = {
    F2: undefined,
    F3: inputs.f3,
    F4: inputs.f4,
    F5: inputs.f5,
    F6: inputs.f6,
  };

  return requested
    .map((feature) => {
      const artifact = byFeature[feature];
      if (artifact === undefined) {
        if (feature === "F2") {
          evidenceMismatch("F2 evidence export is not available in Task 7 source bindings.", feature);
        }
        return undefined;
      }
      const fileName = feature === "F3"
        ? "Drawing-Traceability-Review.json"
        : feature === "F4"
          ? "Tolerance-Calculation.json"
          : feature === "F5"
            ? "Engineering-Interpretation.json"
            : "Engineering-Summary-Report.md";
      const displayName = fileName;
      const content = artifact.text;
      return {
        relativePath: `evidence/${fileName}`,
        content,
        displayName,
        mediaType: artifact.mediaType,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== undefined);
}

async function readProductionRoots(rootDir: string, sessionId: string): Promise<Required<Pick<ProductionRoots, "f3Root" | "f4Root" | "f5Root" | "f6Root">>> {
  const registryPath = join(rootDir, "runtime", "workbench", "registries", "production-roots", `${sessionId}.json`);
  let parsed: ProductionRoots;
  try {
    parsed = JSON.parse(await readFile(registryPath, "utf8")) as ProductionRoots;
  } catch {
    evidenceMismatch("Production root binding is unavailable for the current session.", "production-roots");
  }

  if (parsed.f3Root === undefined || parsed.f4Root === undefined || parsed.f5Root === undefined || parsed.f6Root === undefined) {
    evidenceMismatch("Production root binding is incomplete for the current session.", "production-roots");
  }
  return {
    f3Root: parsed.f3Root,
    f4Root: parsed.f4Root,
    f5Root: parsed.f5Root,
    f6Root: parsed.f6Root,
  };
}

async function assertArtifactRootBinding(rootDir: string, sessionId: string, roots: { readonly f3Root: string; readonly f4Root: string; readonly f5Root: string; readonly f6Root: string }, artifacts: { readonly f3: ResolvedArtifact; readonly f4: ResolvedArtifact; readonly f5: ResolvedArtifact; readonly f6Optimization: ResolvedArtifact; readonly f6Report: ResolvedArtifact }): Promise<void> {
  const rootReal = await realpath(rootDir);
  const productionRootReal = await realpath(join(rootDir, "runtime", "workbench", "runner-output", sessionId, "production"));
  if (!isContainedPath(rootReal, productionRootReal)) {
    evidenceMismatch("Production root binding escaped the controlled session root.", "production-roots");
  }

  const resolveClaimedRoot = async (value: string): Promise<string> => {
    try {
      return await realpath(value);
    } catch {
      evidenceMismatch("Production root binding drift detected.", "production-roots");
    }
  };
  const claimed = {
    f3Root: await resolveClaimedRoot(roots.f3Root),
    f4Root: await resolveClaimedRoot(roots.f4Root),
    f5Root: await resolveClaimedRoot(roots.f5Root),
    f6Root: await resolveClaimedRoot(roots.f6Root),
  };
  for (const value of Object.values(claimed)) {
    if (!isContainedPath(productionRootReal, value)) {
      evidenceMismatch("Production root binding drift detected.", "production-roots");
    }
  }

  const ensureUnder = async (artifact: ResolvedArtifact, expectedRoot: string, reference: string) => {
    let realArtifact: string;
    try {
      realArtifact = await realpath(resolve(rootDir, artifact.reference.relativePath));
    } catch {
      evidenceMismatch("Artifact path does not match the current production root binding.", reference);
    }
    if (!isContainedPath(expectedRoot, realArtifact)) {
      evidenceMismatch("Artifact path does not match the current production root binding.", reference);
    }
  };

  await Promise.all([
    ensureUnder(artifacts.f3, claimed.f3Root, "f3-report"),
    ensureUnder(artifacts.f4, claimed.f4Root, "f4-calculation"),
    ensureUnder(artifacts.f5, claimed.f5Root, "f5-report"),
    ensureUnder(artifacts.f6Optimization, claimed.f6Root, "f6-optimization"),
    ensureUnder(artifacts.f6Report, claimed.f6Root, "f6-report"),
  ]);
}

function createExportRequest(source: TrustedExportSource, managedRoot: string): ProductExportRequest {
  const exportId = createProductRunReference(`${source.sourceRunReference}:${source.workbook.contentHash}`);
  return {
    managedRoot,
    exportId,
    files: [
      { relativePath: "TA-Engineering-Analysis-Report.md", content: source.finalReport },
      { relativePath: "TA-Improvement-Options.md", content: source.improvementOptions },
      { relativePath: "TA-Analysis-Run-Summary.json", content: source.runSummaryJson },
      ...source.evidenceFiles.map((entry) => ({ relativePath: entry.relativePath, content: entry.content })),
    ],
  };
}

function buildManifest(source: TrustedExportSource, request: ProductExportRequest, result: ProductExportResult): TaProductExportManifest {
  return taProductExportManifestSchema.parse({
    contractVersion: "ta-assist-product-export-v1",
    workflow: "TA Workbook Analysis",
    generatedAt: result.manifest.generatedAt,
    workbook: source.workbook,
    worksheetScope: [...source.worksheetScope],
    executionStatus: "completed",
    businessDisposition: mapProjectionDisposition(source.projection.workbookDisposition),
    exportStatus: "completed",
    productRunReference: request.exportId,
    files: [
      toRecord(result, "TA Engineering Analysis Report", "TA-Engineering-Analysis-Report.md", "text/markdown"),
      toRecord(result, "TA Improvement Options", "TA-Improvement-Options.md", "text/markdown"),
      toRecord(result, "TA Analysis Run Summary", "TA-Analysis-Run-Summary.json", "application/json"),
      ...source.evidenceFiles.map((entry) => toRecord(result, entry.displayName, entry.relativePath, entry.mediaType)),
    ],
  });
}

function buildRecordBase(source: TrustedExportSource, request: ProductExportRequest): Omit<ProductExportStoreRecord, "status" | "updatedAt"> {
  return {
    contractVersion: "ta-product-export-store-record-v1",
    productRunReference: request.exportId,
    idempotencyKey: source.idempotencyKey,
    sessionId: source.sessionId,
    expectedRevision: source.expectedRevision,
    sourceBinding: source.sourceBinding,
    projectionArtifactId: source.projectionArtifactId,
    projectionArtifactSha256: source.projectionArtifactSha256,
    sourceReportSha256: contentSha256(source.finalReport),
    projectionSchemaVersion: source.projection.schemaVersion,
    semanticDigest: source.semanticDigest,
  };
}

function assertMatchingSourceBinding(existing: ProductExportStoreRecord, current: TrustedExportSource, exportId: string): void {
  if (existing.sourceBinding === undefined) return;
  if (JSON.stringify(existing.sourceBinding) !== JSON.stringify(current.sourceBinding)) {
    evidenceMismatch("Product export source binding drift detected for idempotent command replay.", exportId);
  }
}

async function resolveTrustedSource(command: TaProductExportCommand, options: TaProductExporterOptions): Promise<TrustedExportSource> {
  const store = await openSessionStore({ rootDir: options.rootDir, sessionId: command.sessionId });
  try {
    const snapshot = await store.readSnapshot();
    if (snapshot.revision !== command.expectedRevision) {
      throw createTypedError({
        code: "validation_error",
        summary: `Expected revision ${command.expectedRevision}, found ${snapshot.revision}.`,
        suggestedAction: "Refresh session state and retry product export.",
        affectedInputReferences: [command.sessionId],
      });
    }
    const initial = snapshot.initialScopeSelection;
    const downstream = snapshot.downstreamScopeSelection;
    if (initial?.confirmed !== true || downstream?.confirmed !== true || initial.provenance !== "user" || downstream.provenance !== "user") {
      deny("Product export requires user-confirmed worksheet scope selections.", command.sessionId);
    }
    if (initial.workbookContentHash !== downstream.workbookContentHash) {
      evidenceMismatch("Initial and downstream worksheet scope hashes diverged.", command.sessionId);
    }
    if (new Set(initial.selectedWorksheetNames).size !== initial.selectedWorksheetNames.length
      || new Set(downstream.selectedWorksheetNames).size !== downstream.selectedWorksheetNames.length) {
      evidenceMismatch("Worksheet scope contains duplicate worksheet names.", command.sessionId);
    }
    const initialSet = new Set(initial.selectedWorksheetNames);
    if (downstream.selectedWorksheetNames.length === 0 || downstream.selectedWorksheetNames.some((name) => !initialSet.has(name))) {
      evidenceMismatch("Downstream worksheet scope is not a validated subset of initial scope.", command.sessionId);
    }

    const sourceRunReference = snapshot.priorRunReferences.findLast((reference) => reference.featureId === "F2" && typeof reference.runReference === "string")?.runReference;
    if (sourceRunReference === undefined) {
      evidenceMismatch("Validated F2 baseline run reference is unavailable.", command.sessionId);
    }

    const expectedReviewContext = {
      workbookHash: downstream.workbookContentHash,
      downstreamSelectionHash: canonicalSelectedWorksheetSetHash(downstream.selectedWorksheetNames),
      baselineRunReference: sourceRunReference,
    };
    const productionRoots = await readProductionRoots(options.rootDir, command.sessionId);

    const [f3, f4, f5, f6Optimization, f6Report, projectionArtifact] = await Promise.all([
      resolveArtifact(options.rootDir, command.sessionId, (artifactId) => store.readArtifactReference(artifactId), snapshot.inputRevision, "f3-report", "f3_report", "application/json", expectedReviewContext),
      resolveArtifact(options.rootDir, command.sessionId, (artifactId) => store.readArtifactReference(artifactId), snapshot.inputRevision, "f4-calculation", "f4_calculation", "application/json", expectedReviewContext),
      resolveArtifact(options.rootDir, command.sessionId, (artifactId) => store.readArtifactReference(artifactId), snapshot.inputRevision, "f5-report", "f5_report", "application/json", expectedReviewContext),
      resolveArtifact(options.rootDir, command.sessionId, (artifactId) => store.readArtifactReference(artifactId), snapshot.inputRevision, "f6-optimization", "f6_optimization", "application/json", expectedReviewContext),
      resolveArtifact(options.rootDir, command.sessionId, (artifactId) => store.readArtifactReference(artifactId), snapshot.inputRevision, "f6-report", "f6_report", "text/markdown", expectedReviewContext),
      resolveProjectionArtifact(options.rootDir, command.sessionId, (artifactId) => store.readArtifactReference(artifactId), snapshot.inputRevision, expectedReviewContext),
    ]);
    await assertArtifactRootBinding(options.rootDir, command.sessionId, productionRoots, { f3, f4, f5, f6Optimization, f6Report });

    const projection = taEngineeringReportProjectionContentSchema.parse(JSON.parse(projectionArtifact.text) as unknown);
    const reportSurface = taEngineeringReportProjectionSchema.safeParse({
      markdown: f6Report.text,
      reportSummary: {
        workbookDisposition: projection.workbookDisposition,
        worksheetDispositions: projection.worksheetDispositions,
      },
      projection,
    });
    if (!reportSurface.success) {
      evidenceMismatch("Final report does not satisfy the governed user-facing report contract.", command.sessionId);
    }
    const f6RootRelative = dirname(f6Report.reference.relativePath);
    const [improvementOptions, runSummaryJson] = await Promise.all([
      readManagedText(options.rootDir, join(f6RootRelative, "Feature6-Optimization.md"), undefined, "Feature6-Optimization.md"),
      readManagedText(options.rootDir, join(f6RootRelative, "Feature6-Run-Summary.json"), undefined, "Feature6-Run-Summary.json"),
    ]);

    const evidenceFiles = buildEvidenceFiles(extractEvidenceFeatures(projection), {
      f3,
      f4,
      f5,
      f6: f6Report,
    });
    return {
      sessionId: command.sessionId,
      expectedRevision: command.expectedRevision,
      idempotencyKey: command.idempotencyKey,
      sourceRunReference,
      workbook: {
        fileName: projection.workbook.fileName,
        contentHash: projection.workbook.contentHash,
      },
      worksheetScope: [...downstream.selectedWorksheetNames],
      projection,
      semanticDigest: computeTaReportSemanticDigest(projection),
      finalReport: f6Report.text,
      improvementOptions,
      runSummaryJson,
      evidenceFiles,
      sourceBinding: {
        sourceRunReference,
        workbookContentHash: projection.workbook.contentHash,
        worksheetScope: [...downstream.selectedWorksheetNames],
        reviewContext: expectedReviewContext,
        productionRoots: {
          f3Root: productionRoots.f3Root,
          f4Root: productionRoots.f4Root,
          f5Root: productionRoots.f5Root,
          f6Root: productionRoots.f6Root,
        },
        artifactHashes: {
          "f3-report": f3.reference.contentHash ?? contentSha256(f3.text),
          "f4-calculation": f4.reference.contentHash ?? contentSha256(f4.text),
          "f5-report": f5.reference.contentHash ?? contentSha256(f5.text),
          "f6-optimization": f6Optimization.reference.contentHash ?? contentSha256(f6Optimization.text),
          "f6-report": f6Report.reference.contentHash ?? contentSha256(f6Report.text),
          "engineering-summary-projection": projectionArtifact.reference.contentHash ?? contentSha256(projectionArtifact.text),
          "f6-optimization-markdown": contentSha256(improvementOptions),
          "f6-run-summary": contentSha256(runSummaryJson),
        },
      },
      projectionArtifactId: projectionArtifact.reference.artifactId,
      projectionArtifactSha256: projectionArtifact.reference.contentHash ?? contentSha256(projectionArtifact.text),
    };
  } finally {
    await store.close();
  }
}

function exportRequest(source: TaAnalysisExportSource, rootDir: string): ProductExportRequest {
  const productRunReference = createProductRunReference(`${source.sourceRunReference}:${source.workbook.contentHash}`);
  const managedRoot = path.join(rootDir, "runtime", "workbench", "product-exports");
  return {
    managedRoot,
    exportId: productRunReference,
    files: [
      { relativePath: "TA-Engineering-Analysis-Report.md", content: source.finalReport },
      { relativePath: "TA-Improvement-Options.md", content: source.improvementOptions },
      { relativePath: "TA-Analysis-Run-Summary.json", content: source.runSummaryJson },
    ],
  };
}

function semanticDigest(source: TaAnalysisExportSource): string {
  return computeTaReportSemanticDigest({
    schemaVersion: "ta-engineering-report-projection-v1",
    title: "TA Engineering Analysis Report",
    workbookDisposition: source.businessDisposition,
    worksheetDispositions: source.worksheetScope.map((worksheetName) => ({ worksheetName, disposition: source.businessDisposition })),
    workbook: {
      fileName: source.workbook.fileName,
      contentHash: source.workbook.contentHash,
    },
    worksheets: source.worksheetScope.map((worksheetName) => ({
      worksheetName,
      toleranceLoopDescription: worksheetName,
      disposition: source.businessDisposition,
      requiredAction: source.businessDisposition === "PASS" ? "None" : "Engineering review required before release decision",
      findings: [],
      assumptions: [],
      clarifications: [],
      gatingEvidenceReferences: [],
    })),
  });
}

export async function exportTaAnalysis(source: TaAnalysisExportSource, options: TaProductExporterOptions): Promise<TaProductExportResult> {
  if (source.executionStatus !== "completed") {
    deny("Product export only permits completed workflow execution status.", source.sourceRunReference);
  }
  if (source.sourceClass !== "validated_production") {
    deny("Product export rejects internal fixture sources.", source.sourceRunReference);
  }
  if (source.verificationStatus !== "verified") {
    deny("Product export rejects legacy unverified sources.", source.sourceRunReference);
  }
  if (source.lineage.initialScopeProvenance !== "user" || source.lineage.downstreamScopeProvenance !== "user") {
    deny("Product export requires user provenance for both worksheet confirmations.", source.sourceRunReference);
  }

  const request = exportRequest(source, options.rootDir);
  let result: ProductExportResult;
  try {
    result = await verifyExistingProductExport(request);
  } catch (error) {
    const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
    if (code !== "evidence_mismatch") {
      throw error;
    }
    result = await commitProductExport(await prepareProductExport(request));
  }

  const productRunReference = createProductRunReference(`${source.sourceRunReference}:${source.workbook.contentHash}`);
  const manifest = taProductExportManifestSchema.parse({
    contractVersion: "ta-assist-product-export-v1",
    workflow: "TA Workbook Analysis",
    generatedAt: result.manifest.generatedAt,
    workbook: source.workbook,
    worksheetScope: [...source.worksheetScope],
    executionStatus: source.executionStatus,
    businessDisposition: mapBusinessDisposition(source.businessDisposition),
    exportStatus: "completed",
    productRunReference,
    files: [
      toRecord(result, "TA Engineering Analysis Report", "TA-Engineering-Analysis-Report.md", "text/markdown"),
      toRecord(result, "TA Improvement Options", "TA-Improvement-Options.md", "text/markdown"),
      toRecord(result, "TA Analysis Run Summary", "TA-Analysis-Run-Summary.json", "application/json"),
    ],
  });

  const digest = semanticDigest(source);
  const summaryHash = contentSha256(source.runSummaryJson);
  void summaryHash;

  return {
    root: toPublicExportRoot(options.rootDir, result.root),
    manifest,
    semanticDigest: digest,
  };
}

export async function exportTaAnalysisForSession(commandInput: unknown, options: TaProductExporterOptions): Promise<TaProductExportReceipt> {
  const command = taProductExportCommandSchema.parse(commandInput);
  const exportStore = await createProductExportStore(options.rootDir);

  let source: TrustedExportSource | undefined;
  let request: ProductExportRequest | undefined;
  let base: Omit<ProductExportStoreRecord, "status" | "updatedAt"> | undefined;

  try {
    source = await resolveTrustedSource(command, options);
    request = createExportRequest(source, exportStore.root);
    base = buildRecordBase(source, request);

    const existing = await exportStore.readRecord(request.exportId);
    if (existing !== undefined && existing.status === "completed") {
      assertMatchingSourceBinding(existing, source, request.exportId);
    }

    let result: ProductExportResult;
    try {
      result = await verifyExistingProductExport(request);
    } catch (error) {
      if (toTypedCode(error) !== "evidence_mismatch") {
        throw error;
      }
      if (existing !== undefined && existing.status === "completed") {
        evidenceMismatch("Product export files drifted after completion.", request.exportId);
      }
      result = await commitProductExport(await prepareProductExport(request));
    }

    const manifest = buildManifest(source, request, result);
    const manifestBytes = await readFile(join(result.root, "export-manifest.json"));
    const exportManifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");

    await exportStore.writeRecord({
      ...base,
      status: "completed",
      exportRoot: result.root,
      exportManifestSha256,
      updatedAt: new Date().toISOString(),
    });

    return taProductExportReceiptSchema.parse({
      root: toPublicExportRoot(options.rootDir, result.root),
      manifest,
      semanticDigest: source.semanticDigest,
      exportManifestSha256,
    });
  } catch (error) {
    if (base !== undefined) {
      const failureCode = toTypedCode(error);
      await exportStore.writeRecord({
        ...base,
        status: "failed",
        ...(failureCode === undefined ? {} : { failureCode }),
        failureSummary: error instanceof Error ? error.message : "Product export failed.",
        updatedAt: new Date().toISOString(),
      });
    }
    throw error;
  }
}
