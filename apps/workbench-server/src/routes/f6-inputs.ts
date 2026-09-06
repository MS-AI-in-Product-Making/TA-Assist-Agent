import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

import {
  createTypedError,
  f6AnalysisContextSchema,
  f6InputProposalSchema,
  f6OptimizationTargetsSchema,
  f8PendingF6InputDraftSchema,
  type F6InputProposal,
} from "@ai-assist/contracts";
import {
  canonicalSelectedWorksheetSetHash,
  openSessionStore,
  type ReviewContextIdentity,
  type SessionArtifactReference,
} from "@ai-assist/workbench";
import { materializeF6InputProposal } from "@ai-assist/workflow-runners";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { errorStatusCode, safeErrorResponse } from "../security.js";
import type { WorkbenchServerContext } from "../server.js";

const routePayloadSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  kind: z.enum(["analysis_context", "optimization_targets"]),
  proposal: f6InputProposalSchema,
}).strict();

const DRAFT_REFERENCE_PATTERN = /^draft:([^#\r\n]+)#sha256:([a-f0-9]{64})$/;

export interface MaterializeF6InputDraftResult {
  readonly status: string;
  readonly pendingDraft?: ReturnType<typeof f8PendingF6InputDraftSchema.parse>;
  readonly preview?: unknown;
  readonly snapshotRevision?: number;
  readonly clarifications?: readonly {
    readonly clarificationId: string;
    readonly reasonCode: string;
    readonly question: string;
    readonly requiredFields: readonly string[];
  }[];
}

export const f6InputsRoutes: FastifyPluginAsync<{ readonly context: WorkbenchServerContext }> = async (app, { context }) => {
  app.post("/api/sessions/:sessionId/f6-input-drafts", async (request, reply) => {
    const auth = context.requireBrowserMutation(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId } = request.params as { readonly sessionId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    const parsed = routePayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "f6_input_draft_schema_rejected" });
    }

    if (!kindMatchesProposal(parsed.data.kind, parsed.data.proposal)) {
      return reply.code(400).send({ error: "f6_input_draft_schema_rejected" });
    }

    try {
      const snapshot = await context.sessions.read(sessionId);
      if (snapshot === undefined) {
        return reply.code(404).send({ error: "session_not_found" });
      }
      if (snapshot.revision !== parsed.data.expectedRevision) {
        return reply.code(409).send({ error: "session_revision_conflict" });
      }

      const materialized = await materializeF6InputDraftFromProposal({
        rootDir: context.rootDir,
        sessionId,
        snapshot,
        kind: parsed.data.kind,
        proposal: parsed.data.proposal,
      });
      await context.syncSessionRecord(sessionId);
      if (materialized.pendingDraft === undefined) {
        return reply.code(200).send({
          status: materialized.status,
          clarifications: materialized.clarifications,
        });
      }

      return reply.code(201).send(materialized);
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
  });

  app.get("/api/sessions/:sessionId/f6-input-drafts/:draftId", async (request, reply) => {
    const auth = context.requireBrowserSession(request, reply);
    if (auth === undefined) {
      return reply;
    }

    const { sessionId, draftId } = request.params as { readonly sessionId: string; readonly draftId: string };
    if (auth.sessionId !== sessionId) {
      return reply.code(403).send({ error: "session_scope_rejected" });
    }

    try {
      const snapshot = await context.sessions.read(sessionId);
      if (snapshot === undefined) return reply.code(404).send({ error: "session_not_found" });
      const resolved = await resolvePersistedDraft(context.rootDir, sessionId, draftId);
      if (resolved === undefined) return reply.code(404).send({ error: "f6_input_draft_not_found" });

      const materialization = resolved.reference.metadata?.materialization;
      if (typeof materialization !== "object" || materialization === null) {
        throw createTypedError({
          code: "evidence_mismatch",
          summary: "Pending F6 draft metadata is missing materialization preview.",
          suggestedAction: "Regenerate the draft from the current validated review context.",
          affectedInputReferences: [resolved.reference.artifactId],
        });
      }

      const pendingDraft = f8PendingF6InputDraftSchema.parse(resolved.reference.metadata?.pendingDraft);
      const parsedReference = parseDraftReference(readDraftReference(snapshot, pendingDraft.kind));
      const confirmed = parsedReference !== undefined
        && parsedReference.draftId === pendingDraft.draftId
        && parsedReference.contentHash === pendingDraft.contentHash;

      return {
        pendingDraft,
        materialization,
        confirmed,
      };
    } catch (error) {
      return reply.code(errorStatusCode(error)).send(safeErrorResponse(error));
    }
  });
};

export async function materializeF6InputDraftFromProposal(input: {
  readonly rootDir: string;
  readonly sessionId: string;
  readonly snapshot: {
    readonly sessionId: string;
    readonly revision: number;
    readonly inputRevision: number;
    readonly state: ReturnType<typeof z.string>["_type"];
    readonly pendingAnalysisContextDraft?: unknown;
    readonly pendingOptimizationTargetsDraft?: unknown;
    readonly downstreamScopeSelection?: {
      readonly workbookContentHash: string;
      readonly selectedWorksheetNames: readonly string[];
      readonly confirmed: true;
      readonly provenance?: "user" | "internal_fixture" | "legacy_unverified" | undefined;
    } | undefined;
    readonly priorRunReferences: readonly { readonly featureId: string; readonly workbookHash?: string | undefined; readonly runReference?: string | undefined }[];
    readonly artifactRefs?: readonly {
      readonly artifactId: string;
      readonly kind: string;
      readonly revision: number;
      readonly validated: boolean;
      readonly reviewContextId?: string | undefined;
    }[] | undefined;
  };
  readonly kind: "analysis_context" | "optimization_targets";
  readonly proposal: F6InputProposal;
}): Promise<MaterializeF6InputDraftResult> {
  const lineage = await resolveMaterializationLineage(input.rootDir, input.sessionId, input.snapshot);
  const materialized = materializeF6InputProposal(input.proposal, lineage);
  if (materialized.status !== "draft_ready") {
    return {
      status: materialized.status,
      clarifications: materialized.clarifications,
    };
  }
  if (materialized.artifact === undefined) {
    return {
      status: "clarification_required",
      clarifications: [{
        clarificationId: "proposal_ambiguous",
        reasonCode: "proposal_ambiguous",
        question: "A governed draft artifact is required before confirmation. Provide numeric targets or use not_provided/decline.",
        requiredFields: ["directions"],
      }],
    };
  }

  const draftId = randomUUID();
  const artifactBytes = Buffer.from(`${JSON.stringify(materialized.artifact, null, 2)}\n`, "utf8");
  const contentHash = createHash("sha256").update(artifactBytes).digest("hex");
  const relativePath = join("runtime", "workbench", "managed-artifacts", input.sessionId, "f6-input-drafts", input.kind, `${draftId}.json`).replace(/\\/g, "/");
  await writeImmutableArtifact(input.rootDir, relativePath, artifactBytes);

  const pendingDraft = f8PendingF6InputDraftSchema.parse({
    draftId,
    kind: input.kind,
    inputRevision: input.snapshot.inputRevision,
    reviewContextId: lineage.reviewContextId,
    artifactId: draftArtifactId(input.kind, draftId),
    contentHash,
    status: "preview_required",
  });

  const nextSnapshot = await persistPendingDraft(input.rootDir, input.snapshot, pendingDraft, {
    proposal: input.proposal,
    preview: materialized.preview,
  }, relativePath);

  return {
    status: "draft_ready",
    pendingDraft,
    preview: materialized.preview,
    snapshotRevision: nextSnapshot.revision,
  };
}

function kindMatchesProposal(kind: "analysis_context" | "optimization_targets", proposal: F6InputProposal): boolean {
  return (kind === "analysis_context" && proposal.proposalVersion === "f6-analysis-context-proposal-v1")
    || (kind === "optimization_targets" && proposal.proposalVersion === "f6-optimization-targets-proposal-v1");
}

function draftArtifactId(kind: "analysis_context" | "optimization_targets", draftId: string): string {
  return `f6-input-draft:${kind}:${draftId}`;
}

function pendingFieldName(kind: "analysis_context" | "optimization_targets"): "pendingAnalysisContextDraft" | "pendingOptimizationTargetsDraft" {
  return kind === "analysis_context" ? "pendingAnalysisContextDraft" : "pendingOptimizationTargetsDraft";
}

function readDraftReference(snapshot: { readonly priorRunReferences: readonly { readonly featureId: string; readonly referenceId: string; readonly runReference?: string | undefined }[] }, kind: "analysis_context" | "optimization_targets"): string | undefined {
  const prefix = kind === "analysis_context" ? "f6-analysis-context:" : "f6-optimization-targets:";
  const decision = snapshot.priorRunReferences.findLast((reference) => reference.featureId === "F6" && reference.referenceId.startsWith(prefix));
  return decision?.runReference;
}

function parseDraftReference(reference: string | undefined): { draftId: string; contentHash: string } | undefined {
  if (typeof reference !== "string") return undefined;
  const match = DRAFT_REFERENCE_PATTERN.exec(reference.trim());
  if (match === null) return undefined;
  return { draftId: match[1]!, contentHash: match[2]! };
}

async function persistPendingDraft(
  rootDir: string,
  snapshot: { readonly sessionId: string; readonly revision: number; readonly inputRevision: number; readonly state: ReturnType<typeof z.string>["_type"]; readonly pendingAnalysisContextDraft?: unknown; readonly pendingOptimizationTargetsDraft?: unknown },
  pendingDraft: ReturnType<typeof f8PendingF6InputDraftSchema.parse>,
  materialization: { readonly proposal: F6InputProposal; readonly preview: unknown },
  relativePath: string,
) {
  const store = await openSessionStore({ rootDir, sessionId: snapshot.sessionId });
  const field = pendingFieldName(pendingDraft.kind);
  const previous = snapshot[field] as { artifactId?: string } | undefined;
  try {
    return await store.applySnapshotMutation(snapshot.revision, async (current) => ({
      snapshot: {
        ...current,
        [field]: pendingDraft,
      },
      artifactReferenceOps: {
        upsert: [{
          artifactId: pendingDraft.artifactId,
          sessionId: snapshot.sessionId,
          inputRevision: snapshot.inputRevision,
          kind: "f6_input_draft",
          relativePath,
          contentHash: pendingDraft.contentHash,
          metadata: {
            pendingDraft,
            materialization,
          },
        }],
        ...(typeof previous?.artifactId === "string" && previous.artifactId !== pendingDraft.artifactId
          ? { delete: [previous.artifactId] }
          : {}),
      },
    }));
  } finally {
    await store.close();
  }
}

async function resolvePersistedDraft(rootDir: string, sessionId: string, draftId: string): Promise<{ readonly reference: SessionArtifactReference; readonly kind: "analysis_context" | "optimization_targets" } | undefined> {
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    const analysisId = draftArtifactId("analysis_context", draftId);
    const optimizationId = draftArtifactId("optimization_targets", draftId);
    const analysis = await store.readArtifactReference(analysisId);
    if (analysis?.kind === "f6_input_draft") return { reference: analysis, kind: "analysis_context" };
    const optimization = await store.readArtifactReference(optimizationId);
    if (optimization?.kind === "f6_input_draft") return { reference: optimization, kind: "optimization_targets" };
    return undefined;
  } finally {
    await store.close();
  }
}

async function resolveMaterializationLineage(
  rootDir: string,
  sessionId: string,
  snapshot: {
    readonly inputRevision: number;
    readonly downstreamScopeSelection?: {
      readonly workbookContentHash: string;
      readonly selectedWorksheetNames: readonly string[];
      readonly confirmed: true;
      readonly provenance?: "user" | "internal_fixture" | "legacy_unverified" | undefined;
    } | undefined;
    readonly priorRunReferences: readonly { readonly featureId: string; readonly workbookHash?: string | undefined; readonly runReference?: string | undefined }[];
    readonly artifactRefs?: readonly {
      readonly artifactId: string;
      readonly kind: string;
      readonly revision: number;
      readonly validated: boolean;
      readonly reviewContextId?: string | undefined;
    }[] | undefined;
  },
) {
  const scope = snapshot.downstreamScopeSelection;
  if (scope?.confirmed !== true || scope.provenance !== "user") {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "F6 input materialization requires the current user-confirmed downstream worksheet scope.",
      suggestedAction: "Confirm downstream worksheet scope from the current workbook revision.",
      affectedInputReferences: [sessionId],
    });
  }

  const f4Refs = (snapshot.artifactRefs ?? []).filter((reference) =>
    reference.kind === "f4_calculation" && reference.validated && reference.revision === snapshot.inputRevision,
  );
  const f5Refs = (snapshot.artifactRefs ?? []).filter((reference) =>
    reference.kind === "f5_report" && reference.validated && reference.revision === snapshot.inputRevision,
  );
  if (f4Refs.length !== 1 || f5Refs.length !== 1) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "F6 input materialization requires exactly one current validated F4 calculation and F5 report.",
      suggestedAction: "Regenerate F4 and F5 from the current workbook lineage, then retry.",
      affectedInputReferences: [sessionId],
    });
  }
  const reviewContextId = f4Refs[0]!.reviewContextId;
  if (typeof reviewContextId !== "string" || reviewContextId.length === 0 || f5Refs[0]!.reviewContextId !== reviewContextId) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "F6 input materialization requires one unambiguous current review context.",
      suggestedAction: "Regenerate F4 and F5 from the same current workbook lineage.",
      affectedInputReferences: [sessionId],
    });
  }

  const baselineMatches = snapshot.priorRunReferences.filter((reference) =>
    reference.featureId === "F2"
    && reference.workbookHash === scope.workbookContentHash
    && typeof reference.runReference === "string"
    && reference.runReference.length > 0,
  );
  if (baselineMatches.length !== 1) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "F6 input materialization requires exactly one current validated F2 baseline lineage for the workbook.",
      suggestedAction: "Regenerate Data Cleaning for the current workbook lineage and retry.",
      affectedInputReferences: [sessionId],
    });
  }
  const baselineRunReference = baselineMatches[0]!.runReference as string;

  const f4Reference = await readPersistedArtifactReference(rootDir, sessionId, f4Refs[0]!.artifactId);
  const reviewContext = parseReviewContext(f4Reference.metadata?.reviewContext);
  const expectedReviewContext: ReviewContextIdentity = {
    workbookHash: scope.workbookContentHash,
    downstreamSelectionHash: canonicalSelectedWorksheetSetHash(scope.selectedWorksheetNames),
    baselineRunReference: baselineRunReference,
  };
  if (reviewContext.workbookHash !== expectedReviewContext.workbookHash
    || reviewContext.downstreamSelectionHash !== expectedReviewContext.downstreamSelectionHash
    || reviewContext.baselineRunReference !== expectedReviewContext.baselineRunReference) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "F6 input materialization review context drifted from current F2/F4/F5 lineage.",
      suggestedAction: "Regenerate F4/F5 from the current review context and retry.",
      affectedInputReferences: [sessionId],
    });
  }

  const f4Json = await readSafeJson(rootDir, f4Reference.relativePath, basename(f4Reference.relativePath));
  const calculations = Array.isArray((f4Json as { calculations?: unknown }).calculations)
    ? (f4Json as { calculations: unknown[] }).calculations
    : [];
  const worksheets = calculations.flatMap((entry) => {
    const worksheetName = readString(entry, ["worksheetSelection", "worksheetName"]);
    const tableId = readString(entry, ["worksheetSelection", "tableId"]);
    const factors = Array.isArray((entry as { factors?: unknown }).factors) ? (entry as { factors: unknown[] }).factors : [];
    const system = readSystem(entry);
    if (worksheetName === undefined || tableId === undefined || system === undefined) return [];
    return [{
      worksheetName,
      tableId,
      factors: factors.flatMap((factor) => {
        const sourceRow = readNumber(factor, ["source", "sourceRow"]);
        const factorName = readString(factor, ["factorName"]);
        const unit = readString(factor, ["unit"]) ?? "mm";
        const lowerTolerance = readNumber(factor, ["lowerTolerance"]);
        const upperTolerance = readNumber(factor, ["upperTolerance"]);
        if (sourceRow === undefined || factorName === undefined || lowerTolerance === undefined || upperTolerance === undefined) return [];
        return [{ sourceRow, factorName, unit, lowerTolerance, upperTolerance }];
      }),
      system,
    }];
  });

  if (worksheets.length === 0) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "F6 input materialization requires current validated F4 worksheet factors and system metrics.",
      suggestedAction: "Regenerate F4 calculation artifacts for the current workbook lineage.",
      affectedInputReferences: [f4Refs[0]!.artifactId],
    });
  }

  return {
    reviewContextId,
    expectedReviewContextId: reviewContextId,
    workbookContentHash: scope.workbookContentHash,
    calculationVersion: "excel-ta-v1" as const,
    projectReference: sessionId,
    runReference: baselineRunReference,
    worksheets,
  };
}

async function readPersistedArtifactReference(rootDir: string, sessionId: string, artifactId: string): Promise<SessionArtifactReference> {
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    const reference = await store.readArtifactReference(artifactId);
    if (reference === undefined) {
      throw createTypedError({
        code: "evidence_mismatch",
        summary: `Artifact ${artifactId} was not found in current session lineage.`,
        suggestedAction: "Regenerate the stage artifacts from current workbook lineage.",
        affectedInputReferences: [artifactId],
      });
    }
    return reference;
  } finally {
    await store.close();
  }
}

async function writeImmutableArtifact(rootDir: string, relativePath: string, bytes: Buffer): Promise<void> {
  const absoluteRoot = resolve(rootDir);
  const absolutePath = resolve(absoluteRoot, relativePath);
  const bounded = relative(absoluteRoot, absolutePath);
  if (bounded.startsWith("..") || resolve(absoluteRoot, bounded) !== absolutePath) {
    throw createTypedError({
      code: "policy_denied",
      summary: "Managed draft path escaped the workbench root.",
      suggestedAction: "Regenerate the draft in the current session.",
      affectedInputReferences: [relativePath],
    });
  }

  await mkdir(dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, bytes, { flag: "wx", mode: 0o600 });
  try {
    await rename(tempPath, absolutePath);
  } finally {
    // Best-effort cleanup in case rename throws.
    try {
      await stat(tempPath);
      await writeFile(tempPath, "", { flag: "w" });
    } catch {
      // no-op
    }
  }

  const readBack = await readSafeJson(rootDir, relativePath, basename(relativePath));
  const reserialized = Buffer.from(`${JSON.stringify(readBack, null, 2)}\n`, "utf8");
  const readBackHash = createHash("sha256").update(reserialized).digest("hex");
  const originalHash = createHash("sha256").update(bytes).digest("hex");
  if (readBackHash !== originalHash) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "Managed draft read-back hash mismatch.",
      suggestedAction: "Regenerate the draft and retry.",
      affectedInputReferences: [relativePath],
    });
  }
}

async function readSafeJson(rootDir: string, relativePath: string, expectedName: string): Promise<unknown> {
  const absoluteRoot = resolve(rootDir);
  const absolutePath = resolve(absoluteRoot, relativePath);
  const bounded = relative(absoluteRoot, absolutePath);
  if (bounded.startsWith("..") || resolve(absoluteRoot, bounded) !== absolutePath) {
    throw createTypedError({
      code: "policy_denied",
      summary: "Managed draft path escaped the workbench root.",
      suggestedAction: "Regenerate the draft in the current session.",
      affectedInputReferences: [relativePath],
    });
  }
  if (basename(absolutePath) !== expectedName) {
    throw createTypedError({
      code: "policy_denied",
      summary: "Managed draft file identity mismatch.",
      suggestedAction: "Regenerate the draft in the current session.",
      affectedInputReferences: [relativePath],
    });
  }

  const handle = await open(absolutePath, "r");
  try {
    const bytes = await handle.readFile();
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw createTypedError({
      code: "validation_error",
      summary: "Managed draft JSON is invalid.",
      suggestedAction: "Regenerate the draft in the current session.",
      affectedInputReferences: [relativePath],
    });
  } finally {
    await handle.close();
  }
}

function parseReviewContext(value: unknown): ReviewContextIdentity {
  const candidate = value as Partial<ReviewContextIdentity> | undefined;
  if (typeof candidate?.workbookHash !== "string"
    || typeof candidate.downstreamSelectionHash !== "string"
    || typeof candidate.baselineRunReference !== "string") {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "Current review context metadata is invalid.",
      suggestedAction: "Regenerate F4/F5 from current validated lineage.",
      affectedInputReferences: ["reviewContext"],
    });
  }
  return candidate as ReviewContextIdentity;
}

function readString(value: unknown, path: readonly string[]): string | undefined {
  let cursor: unknown = value;
  for (const segment of path) {
    if (typeof cursor !== "object" || cursor === null || !(segment in cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === "string" && cursor.length > 0 ? cursor : undefined;
}

function readNumber(value: unknown, path: readonly string[]): number | undefined {
  let cursor: unknown = value;
  for (const segment of path) {
    if (typeof cursor !== "object" || cursor === null || !(segment in cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === "number" && Number.isFinite(cursor) ? cursor : undefined;
}

function readSystem(value: unknown): {
  readonly designNominal: number;
  readonly mean: number;
  readonly rssSigma: number;
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
  readonly targetCpk: number;
  readonly traceReferences: readonly { readonly outputField: string; readonly formulaId: string; readonly formulaVersion: string }[];
} | undefined {
  const system = (value as { readonly system?: unknown }).system;
  if (typeof system !== "object" || system === null) return undefined;
  const designNominal = readNumber(system, ["designNominal"]);
  const mean = readNumber(system, ["mean"]);
  const rssSigma = readNumber(system, ["rssSigma"]);
  const lowerSpecLimit = readNumber(system, ["lowerSpecLimit"]);
  const upperSpecLimit = readNumber(system, ["upperSpecLimit"]);
  const targetCpk = readNumber(system, ["targetCpk"]);
  if (designNominal === undefined || mean === undefined || rssSigma === undefined || lowerSpecLimit === undefined || upperSpecLimit === undefined || targetCpk === undefined) {
    return undefined;
  }
  return {
    designNominal,
    mean,
    rssSigma,
    lowerSpecLimit,
    upperSpecLimit,
    targetCpk,
    traceReferences: [],
  };
}

export function resolveDraftReferenceFromRunReference(runReference: string): { readonly draftId: string; readonly contentHash: string } {
  const match = DRAFT_REFERENCE_PATTERN.exec(runReference.trim());
  if (match === null) {
    throw createTypedError({
      code: "validation_error",
      summary: "F6 decision draft reference must be draft:<draftId>#sha256:<64-hex>.",
      suggestedAction: "Regenerate and reconfirm the current pending draft.",
      affectedInputReferences: [runReference],
    });
  }
  return { draftId: match[1]!, contentHash: match[2]! };
}

export async function resolveF6DraftArtifactReference(rootDir: string, sessionId: string, kind: "analysis_context" | "optimization_targets", draftId: string): Promise<SessionArtifactReference | undefined> {
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    return await store.readArtifactReference(draftArtifactId(kind, draftId));
  } finally {
    await store.close();
  }
}

export async function verifyF6DraftArtifactIdentity(rootDir: string, reference: SessionArtifactReference, expectedHash: string, kind: "analysis_context" | "optimization_targets"): Promise<string> {
  if (reference.kind !== "f6_input_draft") {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "F6 pending draft identity mismatch.",
      suggestedAction: "Regenerate and reconfirm the current draft.",
      affectedInputReferences: [reference.artifactId],
    });
  }
  if (reference.contentHash !== expectedHash) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "draft_hash_mismatch",
      suggestedAction: "Refresh the pending draft and reconfirm with the current hash.",
      affectedInputReferences: [reference.artifactId],
    });
  }
  const parsed = await readSafeJson(rootDir, reference.relativePath, basename(reference.relativePath));
  if (kind === "analysis_context" && !f6AnalysisContextSchema.safeParse(parsed).success) {
    throw createTypedError({
      code: "validation_error",
      summary: "F6 analysis context draft artifact schema mismatch.",
      suggestedAction: "Regenerate and reconfirm the current analysis context draft.",
      affectedInputReferences: [reference.artifactId],
    });
  }
  if (kind === "optimization_targets" && !f6OptimizationTargetsSchema.safeParse(parsed).success) {
    throw createTypedError({
      code: "validation_error",
      summary: "F6 optimization targets draft artifact schema mismatch.",
      suggestedAction: "Regenerate and reconfirm the current optimization targets draft.",
      affectedInputReferences: [reference.artifactId],
    });
  }
  const bytes = Buffer.from(`${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  const readHash = createHash("sha256").update(bytes).digest("hex");
  if (readHash !== expectedHash) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "draft_hash_mismatch",
      suggestedAction: "Refresh the pending draft and reconfirm with the current hash.",
      affectedInputReferences: [reference.artifactId],
    });
  }
  return reference.relativePath;
}
