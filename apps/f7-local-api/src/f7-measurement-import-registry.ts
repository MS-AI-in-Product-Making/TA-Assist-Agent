import {
  createTypedError,
  f7MeasurementImportAuthoritySchema,
  f7MeasurementImportStoredBatchSchema,
  type F7MeasurementImportAuthority,
  type F7MeasurementImportAuthorityContext,
  type F7MeasurementImportStoredBatch,
} from "@ai-assist/contracts";
import { z } from "zod";

const INPUT_REFERENCE = "f7-measurement-import-registry";
const OPAQUE_ID_PATTERN = /^(?:[a-f0-9]{32,}|[A-Za-z0-9_-]{22,})$/;

export const F7_MEASUREMENT_IMPORT_PREVIEW_TTL_MS = 10 * 60 * 1000;
export const MAX_F7_MEASUREMENT_IMPORT_PREVIEWS = 16;
export const MAX_F7_MEASUREMENT_IMPORT_TEMPLATES = 16;
export const F7_MEASUREMENT_IMPORT_MAX_PREVIEWS_PER_SESSION = 2;
export const F7_MEASUREMENT_IMPORT_MAX_TEMPLATES_PER_SESSION = 2;

const measurementImportAuthorityContextSchema = z.object({
  authority: f7MeasurementImportAuthoritySchema,
  expectedMeasurementImportRevision: z.number().int().nonnegative(),
}).strict();

interface SessionState {
  generation: number;
  previewGeneration: number;
  currentTemplateId: string | undefined;
  currentPreviewId: string | undefined;
}

interface TemplateRecord {
  readonly templateId: string;
  readonly sessionId: string;
  readonly context: F7MeasurementImportAuthorityContext;
  readonly sessionGeneration: number;
  readonly insertedSequence: number;
  readonly expiresAtMs: number;
}

interface PreviewRecord {
  state: "available" | "blocked" | "consumed";
  readonly previewId: string;
  readonly templateId: string;
  readonly sessionId: string;
  preview: F7MeasurementImportStoredBatch | undefined;
  readonly expectedMeasurementImportRevision: number;
  readonly sessionGeneration: number;
  readonly previewGeneration: number;
  readonly insertedSequence: number;
  readonly expiresAtMs: number;
}

export type F7MeasurementImportTemplateResolution =
  | {
    readonly status: "available";
    readonly templateId: string;
    readonly authority: F7MeasurementImportAuthority;
    readonly expiresAt: string;
    readonly sessionGeneration: number;
  }
  | { readonly status: "not_found" | "expired" | "stale" | "session_mismatch" };

export type F7MeasurementImportPreviewClaim =
  | {
    readonly status: "claimed";
    readonly previewId: string;
    readonly preview: F7MeasurementImportStoredBatch;
    readonly expectedMeasurementImportRevision: number;
    readonly expiresAt: string;
    readonly sessionGeneration: number;
    readonly previewGeneration: number;
  }
  | { readonly status: "not_found" | "expired" | "stale" | "blocked" | "consumed" | "session_mismatch" };

export interface F7MeasurementImportRegistry {
  registerTemplate(request: {
    readonly sessionId: string;
    readonly createAuthority: (input: {
      readonly templateId: string;
      readonly sessionGeneration: number;
      readonly expiresAt: string;
    }) => F7MeasurementImportAuthorityContext;
  }): {
    readonly templateId: string;
    readonly authority: F7MeasurementImportAuthority;
    readonly expiresAt: string;
    readonly sessionGeneration: number;
  };
  resolveTemplate(request: {
    readonly sessionId: string;
    readonly templateId: string;
  }): F7MeasurementImportTemplateResolution;
  storePreview(request: {
    readonly sessionId: string;
    readonly templateId: string;
    readonly createStoredBatch: (input: {
      readonly previewId: string;
      readonly expiresAt: string;
      readonly sessionGeneration: number;
      readonly previewGeneration: number;
    }) => F7MeasurementImportStoredBatch;
  }): {
    readonly previewId: string;
    readonly storedBatch: F7MeasurementImportStoredBatch;
    readonly expiresAt: string;
    readonly sessionGeneration: number;
    readonly previewGeneration: number;
  };
  storeBlockedPreview(request: {
    readonly sessionId: string;
    readonly templateId: string;
  }): {
    readonly previewId: string;
    readonly expiresAt: string;
    readonly sessionGeneration: number;
    readonly previewGeneration: number;
  };
  claimPreview(request: {
    readonly sessionId: string;
    readonly previewId: string;
  }): F7MeasurementImportPreviewClaim;
}

function fixedError(summary: string, details?: Record<string, unknown>): Error {
  return createTypedError({
    code: "validation_error",
    summary,
    suggestedAction: "Provide the current session-owned template or preview registration inputs and retry.",
    affectedInputReferences: [INPUT_REFERENCE],
    ...(details === undefined ? {} : { details }),
  });
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function cloneFrozen<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function structurallyEqualJsonLike(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null) return false;
  if (typeof left !== "object" || typeof right !== "object") return false;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!structurallyEqualJsonLike(left[index], right[index])) return false;
    }
    return true;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];
    if (leftKey !== rightKey) return false;
    if (!structurallyEqualJsonLike(leftRecord[leftKey!], rightRecord[rightKey!])) return false;
  }
  return true;
}

function validateSessionId(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw fixedError(`${name} must be a non-empty string.`);
  }
  return value;
}

function validateOpaqueId(value: string, name: string): string {
  if (typeof value !== "string" || !OPAQUE_ID_PATTERN.test(value)) {
    throw fixedError(`${name} must be a CSPRNG-shaped opaque identifier.`);
  }
  return value;
}

function isoFromEpochMs(value: number, label: string): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw fixedError(`${label} must be a finite non-negative epoch millisecond integer.`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw fixedError(`${label} must be within the supported Date epoch millisecond range.`);
  }
  return date.toISOString();
}

export function createF7MeasurementImportRegistry(dependencies: {
  readonly now: () => number;
  readonly createId: () => string;
}): F7MeasurementImportRegistry {
  if (typeof dependencies.now !== "function" || typeof dependencies.createId !== "function") {
    throw fixedError("Registry dependencies are invalid.");
  }

  const sessions = new Map<string, SessionState>();
  const templateRecords = new Map<string, TemplateRecord>();
  const previewRecords = new Map<string, PreviewRecord>();
  let sequence = 0;
  let lastNow = -1;

  const readNow = (): number => {
    const value = dependencies.now();
    if (!Number.isSafeInteger(value) || value < 0) {
      throw fixedError("now() must return a finite non-negative epoch millisecond integer.");
    }
    if (value < lastNow) {
      throw fixedError("now() must be monotonic for registry operations.");
    }
    lastNow = value;
    return value;
  };

  const readSession = (sessionId: string): SessionState => {
    const current = sessions.get(sessionId);
    if (current) return current;
    return {
      generation: 0,
      previewGeneration: 0,
      currentTemplateId: undefined,
      currentPreviewId: undefined,
    };
  };

  const deleteSessionIfEmpty = (sessionId: string): void => {
    const hasTemplate = [...templateRecords.values()].some((record) => record.sessionId === sessionId);
    const hasPreview = [...previewRecords.values()].some((record) => record.sessionId === sessionId);
    if (!hasTemplate && !hasPreview) sessions.delete(sessionId);
  };

  const deleteTemplateRecord = (record: TemplateRecord): void => {
    templateRecords.delete(record.templateId);
    const session = sessions.get(record.sessionId);
    if (!session) return;
    if (session.currentTemplateId === record.templateId) {
      session.currentTemplateId = undefined;
      session.currentPreviewId = undefined;
    }
    deleteSessionIfEmpty(record.sessionId);
  };

  const deletePreviewRecord = (record: PreviewRecord): void => {
    previewRecords.delete(record.previewId);
    const session = sessions.get(record.sessionId);
    if (!session) return;
    if (session.currentPreviewId === record.previewId) {
      session.currentPreviewId = undefined;
    }
    deleteSessionIfEmpty(record.sessionId);
  };

  const evictOldestPerSessionTemplates = (): void => {
    const recordsBySession = new Map<string, TemplateRecord[]>();
    for (const record of templateRecords.values()) {
      const sessionRecords = recordsBySession.get(record.sessionId) ?? [];
      sessionRecords.push(record);
      recordsBySession.set(record.sessionId, sessionRecords);
    }
    for (const sessionRecords of recordsBySession.values()) {
      sessionRecords.sort((left, right) => left.insertedSequence - right.insertedSequence);
      while (sessionRecords.length > F7_MEASUREMENT_IMPORT_MAX_TEMPLATES_PER_SESSION) {
        const next = sessionRecords.shift();
        if (!next) break;
        deleteTemplateRecord(next);
      }
    }
  };

  const evictOldestPerSessionPreviews = (): void => {
    const recordsBySession = new Map<string, PreviewRecord[]>();
    for (const record of previewRecords.values()) {
      const sessionRecords = recordsBySession.get(record.sessionId) ?? [];
      sessionRecords.push(record);
      recordsBySession.set(record.sessionId, sessionRecords);
    }
    for (const sessionRecords of recordsBySession.values()) {
      sessionRecords.sort((left, right) => left.insertedSequence - right.insertedSequence);
      while (sessionRecords.length > F7_MEASUREMENT_IMPORT_MAX_PREVIEWS_PER_SESSION) {
        const next = sessionRecords.shift();
        if (!next) break;
        deletePreviewRecord(next);
      }
    }
  };

  const evictOldestTemplates = (): void => {
    if (templateRecords.size <= MAX_F7_MEASUREMENT_IMPORT_TEMPLATES) return;
    const records = [...templateRecords.values()].sort((left, right) => left.insertedSequence - right.insertedSequence);
    while (templateRecords.size > MAX_F7_MEASUREMENT_IMPORT_TEMPLATES) {
      const next = records.shift();
      if (!next) break;
      deleteTemplateRecord(next);
    }
  };

  const evictOldestPreviews = (): void => {
    if (previewRecords.size <= MAX_F7_MEASUREMENT_IMPORT_PREVIEWS) return;
    const records = [...previewRecords.values()].sort((left, right) => left.insertedSequence - right.insertedSequence);
    while (previewRecords.size > MAX_F7_MEASUREMENT_IMPORT_PREVIEWS) {
      const next = records.shift();
      if (!next) break;
      deletePreviewRecord(next);
    }
  };

  const nextOpaqueId = (name: string): string => {
    const value = validateOpaqueId(dependencies.createId(), name);
    if (templateRecords.has(value) || previewRecords.has(value)) {
      throw fixedError(`${name} is duplicate and must be unique across active registry records.`);
    }
    return value;
  };

  const currentTemplateRecord = (sessionId: string, templateId: string, nowMs: number): TemplateRecord => {
    const resolution = resolveTemplateInternal(sessionId, templateId, nowMs);
    if (resolution.status === "available") return resolution.record;
    throw fixedError(`Template ${templateId} is ${resolution.status}.`);
  };

  const resolveTemplateInternal = (
    sessionId: string,
    templateId: string,
    nowMs: number,
  ):
    | { readonly status: "available"; readonly record: TemplateRecord }
    | { readonly status: "not_found" | "expired" | "stale" | "session_mismatch" } => {
    const record = templateRecords.get(templateId);
    if (!record) return { status: "not_found" };
    if (record.sessionId !== sessionId) return { status: "session_mismatch" };
    if (nowMs >= record.expiresAtMs) return { status: "expired" };
    const session = sessions.get(sessionId);
    if (!session || session.currentTemplateId !== templateId || session.generation !== record.sessionGeneration) {
      return { status: "stale" };
    }
    return { status: "available", record };
  };

  return {
    registerTemplate(request) {
      const nowMs = readNow();
      const sessionId = validateSessionId(request?.sessionId, "sessionId");
      if (typeof request?.createAuthority !== "function") {
        throw fixedError("createAuthority must be a function.");
      }

      const session = readSession(sessionId);
      const templateId = nextOpaqueId("templateId");
      const sessionGeneration = session.generation + 1;
      const expiresAtMs = nowMs + F7_MEASUREMENT_IMPORT_PREVIEW_TTL_MS;
      const expiresAt = isoFromEpochMs(expiresAtMs, "expiresAt");
      const context = cloneFrozen(measurementImportAuthorityContextSchema.parse(request.createAuthority({
        templateId,
        sessionGeneration,
        expiresAt,
      })));

      if (context.authority.sessionId !== sessionId) {
        throw fixedError("Authority sessionId must match the owning session.");
      }
      if (context.authority.manifest.templateId !== templateId) {
        throw fixedError("Authority templateId must match the generated template id.");
      }

      sessions.set(sessionId, session);
      session.generation = sessionGeneration;
      session.previewGeneration = 0;
      session.currentTemplateId = templateId;
      session.currentPreviewId = undefined;

      templateRecords.set(templateId, {
        templateId,
        sessionId,
        context,
        sessionGeneration,
        insertedSequence: sequence++,
        expiresAtMs,
      });
      evictOldestPerSessionTemplates();
      evictOldestTemplates();

      return {
        templateId,
        authority: context.authority,
        expiresAt,
        sessionGeneration,
      };
    },

    resolveTemplate(request) {
      const nowMs = readNow();
      const sessionId = validateSessionId(request?.sessionId, "sessionId");
      const templateId = validateOpaqueId(request?.templateId, "templateId");
      const resolved = resolveTemplateInternal(sessionId, templateId, nowMs);
      if (resolved.status !== "available") return resolved;
      return {
        status: "available" as const,
        templateId,
        authority: resolved.record.context.authority,
        expiresAt: isoFromEpochMs(resolved.record.expiresAtMs, "expiresAt"),
        sessionGeneration: resolved.record.sessionGeneration,
      };
    },

    storePreview(request) {
      const nowMs = readNow();
      const sessionId = validateSessionId(request?.sessionId, "sessionId");
      const templateId = validateOpaqueId(request?.templateId, "templateId");
      if (typeof request?.createStoredBatch !== "function") {
        throw fixedError("createStoredBatch must be a function.");
      }

      const template = currentTemplateRecord(sessionId, templateId, nowMs);
      const session = readSession(sessionId);
      const previewId = nextOpaqueId("previewId");
      const previewGeneration = session.previewGeneration + 1;
      const expiresAtMs = nowMs + F7_MEASUREMENT_IMPORT_PREVIEW_TTL_MS;
      const expiresAt = isoFromEpochMs(expiresAtMs, "expiresAt");
      const storedBatch = cloneFrozen(f7MeasurementImportStoredBatchSchema.parse(request.createStoredBatch({
        previewId,
        expiresAt,
        sessionGeneration: template.sessionGeneration,
        previewGeneration,
      })));

      if (storedBatch.previewId !== previewId) {
        throw fixedError("Preview batch previewId must match the generated preview id.");
      }
      if (storedBatch.expiresAt !== expiresAt) {
        throw fixedError("Preview batch expiresAt must match the generated expiry.");
      }
      if (storedBatch.sessionId !== sessionId) {
        throw fixedError("Preview batch sessionId must match the owning session.");
      }
      if (storedBatch.authority.sessionId !== sessionId) {
        throw fixedError("Preview batch authority must match the owning session.");
      }
      if (storedBatch.authority.manifest.templateId !== templateId) {
        throw fixedError("Preview batch authority must match the current template id.");
      }
      if (storedBatch.sessionStateDigest !== template.context.authority.sessionStateDigest) {
        throw fixedError("Preview batch sessionStateDigest must match the registered authority session state digest.");
      }
      if (storedBatch.factorSetDigest !== template.context.authority.manifest.factorSetDigest) {
        throw fixedError("Preview batch factorSetDigest must match the registered authority factor set digest.");
      }
      if (!structurallyEqualJsonLike(storedBatch.authority, template.context.authority)) {
        throw fixedError("Preview batch authority must exactly match the registered authoritative template.");
      }

      session.previewGeneration = previewGeneration;
      session.currentPreviewId = previewId;

      previewRecords.set(previewId, {
        state: "available",
        previewId,
        templateId,
        sessionId,
        preview: storedBatch,
        expectedMeasurementImportRevision: template.context.expectedMeasurementImportRevision,
        sessionGeneration: template.sessionGeneration,
        previewGeneration,
        insertedSequence: sequence++,
        expiresAtMs,
      });
      evictOldestPerSessionPreviews();
      evictOldestPreviews();

      return {
        previewId,
        storedBatch,
        expiresAt,
        sessionGeneration: template.sessionGeneration,
        previewGeneration,
      };
    },

    storeBlockedPreview(request) {
      const nowMs = readNow();
      const sessionId = validateSessionId(request?.sessionId, "sessionId");
      const templateId = validateOpaqueId(request?.templateId, "templateId");
      const template = currentTemplateRecord(sessionId, templateId, nowMs);
      const session = readSession(sessionId);
      const previewId = nextOpaqueId("previewId");
      const previewGeneration = session.previewGeneration + 1;
      const expiresAtMs = nowMs + F7_MEASUREMENT_IMPORT_PREVIEW_TTL_MS;
      const expiresAt = isoFromEpochMs(expiresAtMs, "expiresAt");

      session.previewGeneration = previewGeneration;
      session.currentPreviewId = previewId;
      previewRecords.set(previewId, {
        state: "blocked",
        previewId,
        templateId,
        sessionId,
        preview: undefined,
        expectedMeasurementImportRevision: template.context.expectedMeasurementImportRevision,
        sessionGeneration: template.sessionGeneration,
        previewGeneration,
        insertedSequence: sequence++,
        expiresAtMs,
      });
      evictOldestPerSessionPreviews();
      evictOldestPreviews();

      return {
        previewId,
        expiresAt,
        sessionGeneration: template.sessionGeneration,
        previewGeneration,
      };
    },

    claimPreview(request) {
      const nowMs = readNow();
      const sessionId = validateSessionId(request?.sessionId, "sessionId");
      const previewId = validateOpaqueId(request?.previewId, "previewId");
      const record = previewRecords.get(previewId);
      if (!record) return { status: "not_found" };
      if (record.sessionId !== sessionId) return { status: "session_mismatch" };
      if (record.state === "consumed") return { status: "consumed" };
      if (nowMs >= record.expiresAtMs) return { status: "expired" };

      const session = sessions.get(sessionId);
      if (
        !session
        || session.currentTemplateId !== record.templateId
        || session.generation !== record.sessionGeneration
        || session.currentPreviewId !== previewId
        || session.previewGeneration !== record.previewGeneration
      ) {
        return { status: "stale" };
      }
      if (record.state === "blocked") return { status: "blocked" };

      const preview = record.preview;
      if (!preview) {
        return { status: "consumed" };
      }
      record.state = "consumed";
      record.preview = undefined;
      return {
        status: "claimed",
        previewId,
        preview,
        expectedMeasurementImportRevision: record.expectedMeasurementImportRevision,
        expiresAt: isoFromEpochMs(record.expiresAtMs, "expiresAt"),
        sessionGeneration: record.sessionGeneration,
        previewGeneration: record.previewGeneration,
      };
    },
  };
}