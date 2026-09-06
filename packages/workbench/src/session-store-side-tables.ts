import { StatementSync } from "node:sqlite";

import { createTypedError, f8PendingF6InputDraftSchema, f8ScenarioDraftSchema } from "@ai-assist/contracts";

import { createReviewContextId, type ReviewContextIdentity } from "./review-context.js";

type F8ScenarioDraft = ReturnType<typeof f8ScenarioDraftSchema.parse>;

export interface SessionArtifactReference {
  readonly artifactId: string;
  readonly sessionId: string;
  readonly inputRevision: number;
  readonly kind: string;
  readonly relativePath: string;
  readonly contentHash?: string;
  readonly manifestHash?: string;
  readonly metadata?: Record<string, unknown>;
  readonly reviewContext?: ReviewContextIdentity;
}

const REVIEW_ARTIFACT_KINDS = new Set(["f1_image", "f3_report", "f4_calculation", "f4_report", "f5_report", "f6_optimization", "f6_report"]);

export interface SessionHostActionRecord {
  readonly actionId: string;
  readonly sessionId: string;
  readonly status: "pending" | "claimed" | "completed" | "blocked" | "failed";
  readonly request?: unknown;
  readonly claim?: unknown;
  readonly result?: unknown;
  readonly expiresAt?: string;
  readonly leaseId?: string;
  readonly leaseExpiresAt?: string;
  readonly expectedRevision?: number;
  readonly confirmationHash?: string;
  readonly expectedTargetVersion?: string;
}

export interface SessionDeltaOperations<TRecord> {
  readonly upsert?: readonly TRecord[];
  readonly delete?: readonly string[];
}

export function resolveScenarioDrafts(
  sessionId: string,
  snapshotDrafts: readonly F8ScenarioDraft[] | undefined,
  explicitDrafts: readonly F8ScenarioDraft[] | undefined,
): readonly F8ScenarioDraft[] | undefined {
  const source = explicitDrafts ?? snapshotDrafts;
  if (source === undefined) {
    return undefined;
  }

  return source.map((draft) => {
    const parsedDraft = f8ScenarioDraftSchema.safeParse(draft);
    const draftId = typeof draft === "object" && draft !== null && "draftId" in draft && typeof draft.draftId === "string"
      ? draft.draftId
      : "<unknown>";

    if (!parsedDraft.success) {
      throw createSideTableValidationError(`Scenario draft ${draftId} is invalid.`, draftId);
    }

    if (parsedDraft.data.sessionId !== sessionId) {
      throw createSideTableValidationError(
        `Scenario draft ${parsedDraft.data.draftId} targets ${parsedDraft.data.sessionId}, expected ${sessionId}.`,
        parsedDraft.data.draftId,
      );
    }

    return parsedDraft.data;
  });
}

export function normalizeArtifactReferenceOps(
  sessionId: string,
  references: readonly SessionArtifactReference[] | undefined,
  ops: SessionDeltaOperations<SessionArtifactReference> | undefined,
): SessionDeltaOperations<SessionArtifactReference> | undefined {
  return normalizeDeltaOperations(
    references,
    ops,
    (reference) => {
      ensureNonEmptyString(reference.artifactId, "artifact reference id");
      ensureNonEmptyString(reference.kind, `artifact reference ${reference.artifactId} kind`);
      ensureNonEmptyString(reference.relativePath, `artifact reference ${reference.artifactId} relativePath`);
      ensureSessionOwnership(reference.sessionId, sessionId, `artifact reference ${reference.artifactId}`);
      if (reference.kind === "f6_input_draft") {
        const pendingDraft = f8PendingF6InputDraftSchema.safeParse(reference.metadata?.pendingDraft);
        if (!pendingDraft.success) {
          throw createSideTableValidationError(`F6 pending draft metadata is invalid for artifact ${reference.artifactId}.`, reference.artifactId);
        }
        if (pendingDraft.data.artifactId !== reference.artifactId
          || pendingDraft.data.inputRevision !== reference.inputRevision
          || pendingDraft.data.contentHash !== reference.contentHash
          || pendingDraft.data.kind !== "analysis_context" && pendingDraft.data.kind !== "optimization_targets") {
          throw createSideTableValidationError(`F6 pending draft metadata does not match artifact identity ${reference.artifactId}.`, reference.artifactId);
        }
      }
      if (!REVIEW_ARTIFACT_KINDS.has(reference.kind)) return reference;
      if (reference.reviewContext === undefined) {
        throw createSideTableValidationError(`Review artifact ${reference.artifactId} requires review context identity.`, reference.artifactId);
      }
      const reviewContextId = createReviewContextId(reference.reviewContext);
      return {
        ...reference,
        metadata: { ...reference.metadata, reviewContextId, reviewContext: reference.reviewContext },
      };
    },
    (reference) => reference.artifactId,
    "artifact reference",
  );
}

export function normalizeHostActionOps(
  sessionId: string,
  actions: readonly SessionHostActionRecord[] | undefined,
  ops: SessionDeltaOperations<SessionHostActionRecord> | undefined,
): SessionDeltaOperations<SessionHostActionRecord> | undefined {
  return normalizeDeltaOperations(
    actions,
    ops,
    (action) => {
      ensureNonEmptyString(action.actionId, "host action id");
      ensureSessionOwnership(action.sessionId, sessionId, `host action ${action.actionId}`);
      return action;
    },
    (action) => action.actionId,
    "host action",
  );
}

export function replaceScenarioDrafts(
  deleteStatement: StatementSync,
  insertStatement: StatementSync,
  sessionId: string,
  drafts: readonly F8ScenarioDraft[],
  stringifyJson: (value: unknown) => string,
): void {
  deleteStatement.run(sessionId);
  drafts.forEach((draft) => {
    insertStatement.run(
      draft.draftId,
      sessionId,
      stringifyJson(draft),
      draft.updatedAt ?? new Date().toISOString(),
    );
  });
}

export function applyArtifactReferenceOps(
  upsertStatement: StatementSync,
  deleteStatement: StatementSync,
  sessionId: string,
  ops: SessionDeltaOperations<SessionArtifactReference>,
  stringifyJson: (value: unknown) => string,
): void {
  ops.delete?.forEach((artifactId) => {
    deleteStatement.run(artifactId, sessionId);
  });

  ops.upsert?.forEach((reference) => {
    upsertStatement.run(
      reference.artifactId,
      sessionId,
      reference.inputRevision,
      reference.kind,
      reference.relativePath,
      reference.contentHash ?? null,
      reference.manifestHash ?? null,
      reference.metadata === undefined ? null : stringifyJson(reference.metadata),
    );
  });
}

export function applyHostActionOps(
  upsertStatement: StatementSync,
  deleteStatement: StatementSync,
  sessionId: string,
  ops: SessionDeltaOperations<SessionHostActionRecord>,
  stringifyJson: (value: unknown) => string,
): void {
  ops.delete?.forEach((actionId) => {
    deleteStatement.run(actionId, sessionId);
  });

  const now = new Date().toISOString();
  ops.upsert?.forEach((action) => {
    upsertStatement.run(
      action.actionId,
      sessionId,
      action.status,
      action.request === undefined ? null : stringifyJson(action.request),
      action.claim === undefined ? null : stringifyJson(action.claim),
      action.result === undefined ? null : stringifyJson(action.result),
      action.expiresAt ?? null,
      action.leaseId ?? null,
      action.leaseExpiresAt ?? null,
      action.expectedRevision ?? null,
      action.confirmationHash ?? null,
      action.expectedTargetVersion ?? null,
      now,
    );
  });
}

function normalizeDeltaOperations<TRecord>(
  legacyUpserts: readonly TRecord[] | undefined,
  ops: SessionDeltaOperations<TRecord> | undefined,
  validateRecord: (record: TRecord) => TRecord,
  readId: (record: TRecord) => string,
  label: string,
): SessionDeltaOperations<TRecord> | undefined {
  const upsertSource = ops?.upsert ?? legacyUpserts;
  const deleteIds = normalizeDeleteIds(label, ops?.delete);
  const upsertRecords = upsertSource?.map((record) => validateRecord(record));

  if (upsertRecords === undefined && deleteIds === undefined) {
    return undefined;
  }

  const deleteIdSet = new Set(deleteIds ?? []);
  upsertRecords?.forEach((record) => {
    const id = readId(record);
    if (deleteIdSet.has(id)) {
      throw createSideTableValidationError(`Cannot upsert and delete ${label} ${id} in the same mutation.`, id);
    }
  });

  return {
    ...(upsertRecords === undefined ? {} : { upsert: upsertRecords }),
    ...(deleteIds === undefined ? {} : { delete: deleteIds }),
  };
}

function normalizeDeleteIds(label: string, ids: readonly string[] | undefined): readonly string[] | undefined {
  if (ids === undefined) {
    return undefined;
  }

  const normalized = ids.map((id) => {
    ensureNonEmptyString(id, `${label} delete id`);
    return id;
  });

  if (new Set(normalized).size !== normalized.length) {
    throw createSideTableValidationError(`Duplicate ${label} delete ids are not allowed.`, label);
  }

  return normalized;
}

function ensureSessionOwnership(actualSessionId: string, expectedSessionId: string, label: string): void {
  if (actualSessionId !== expectedSessionId) {
    throw createSideTableValidationError(`${label} targets ${actualSessionId}, expected ${expectedSessionId}.`, label);
  }
}

function ensureNonEmptyString(value: string, label: string): void {
  if (value.length === 0) {
    throw createSideTableValidationError(`${label} must not be empty.`, label);
  }
}

function createSideTableValidationError(summary: string, reference: string) {
  return createTypedError({
    code: "validation_error",
    summary,
    suggestedAction: "Submit session-owned, schema-valid side-table records and retry the transaction.",
    affectedInputReferences: [reference],
  });
}