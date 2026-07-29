import { z } from "zod";
import {
  createTypedError,
  interpretationKnowledgeEntrySchema,
  interpretationKnowledgeManifestSchema,
  interpretationKnowledgeSourceMetadataSchema,
  type InterpretationEntryType,
  type InterpretationKnowledgeEntry,
  type InterpretationKnowledgeSourceMetadata,
} from "@ai-assist/contracts";
import { contentHash } from "../validation.js";
import type {
  DeepReadonly,
  InterpretationKnowledgeSeedPackage,
  InterpretationKnowledgeSnapshot,
} from "./types.js";

const PACKAGE_REFERENCE = "interpretation-rules-v1";
const VALIDATION_ERROR_SUMMARY = "Interpretation-rules package is invalid.";
const VALIDATION_ERROR_ACTION = "Provide a valid interpretation-rules package.";
const SAFE_VALIDATION_ERRORS = new WeakSet<object>();
const ENTRY_TYPES = [
  "metric-definition",
  "performance-rule",
  "root-cause-signal",
  "improvement-option",
  "decision-policy",
] as const satisfies readonly InterpretationEntryType[];
const ALLOWED_RELATED_TYPES: Readonly<Record<InterpretationEntryType, readonly InterpretationEntryType[]>> = {
  "metric-definition": [],
  "performance-rule": ["metric-definition"],
  "root-cause-signal": ["performance-rule", "metric-definition"],
  "improvement-option": ["root-cause-signal"],
  "decision-policy": ENTRY_TYPES,
};

const seedPackageSchema = z.object({
  manifest: z.unknown(),
  sources: z.array(z.unknown()),
  entries: z.array(z.unknown()),
}).strict();

export function createInterpretationKnowledgeSnapshot(value: unknown): InterpretationKnowledgeSnapshot {
  return failClosed(() => deepFreeze(structuredClone(validateSeedPackage(value))));
}

function validateSeedPackage(value: unknown): InterpretationKnowledgeSeedPackage {
  const root = safeParse(seedPackageSchema, value);
  if (!root.success) throw validationError([]);

  const manifest = safeParse(interpretationKnowledgeManifestSchema, root.data.manifest);
  const sources = root.data.sources.map((source) => safeParse(interpretationKnowledgeSourceMetadataSchema, source));
  const entries = root.data.entries.map((entry) => safeParse(interpretationKnowledgeEntrySchema, entry));
  if (!manifest.success || sources.some((source) => !source.success) || entries.some((entry) => !entry.success)) {
    throw validationError([]);
  }

  const parsed: InterpretationKnowledgeSeedPackage = {
    manifest: manifest.data,
    sources: sources.map((source) => (source as { data: InterpretationKnowledgeSourceMetadata }).data),
    entries: entries.map((entry) => (entry as { data: InterpretationKnowledgeEntry }).data),
  };

  validateUniqueValues(parsed.sources, (source) => source.sourceAlias);
  validateUniqueValues(parsed.entries, (entry) => entry.entryId);
  validateProvenance(parsed);
  validateManifest(parsed);
  validateRelations(parsed.entries);
  return parsed;
}

function validateUniqueValues<Value>(values: readonly Value[], getId: (value: Value) => string): void {
  const seen = new Set<string>();
  for (const value of values) {
    const id = getId(value);
    if (seen.has(id)) throw validationError([id]);
    seen.add(id);
  }
}

function validateProvenance(seed: InterpretationKnowledgeSeedPackage): void {
  const sourcesByAlias = new Map(seed.sources.map((source) => [source.sourceAlias, source]));
  for (const entry of seed.entries) {
    const source = sourcesByAlias.get(entry.provenance.sourceAlias);
    if (source === undefined
      || entry.provenance.sourceFileHash !== source.sourceFileHash
      || entry.provenance.sourceVersion !== source.sourceVersion
      || entry.provenance.classification !== source.classification
      || entry.provenance.owner !== source.owner) {
      throw validationError([entry.entryId]);
    }
  }
}

function validateManifest(seed: InterpretationKnowledgeSeedPackage): void {
  if (seed.manifest.sourceCount !== seed.sources.length || seed.manifest.entryCount !== seed.entries.length) {
    throw validationError([PACKAGE_REFERENCE]);
  }

  const actualTypeCounts = countEntryTypes(seed.entries);
  if (ENTRY_TYPES.some((entryType) => seed.manifest.entryTypeCounts[entryType] !== actualTypeCounts[entryType])) {
    throw validationError([PACKAGE_REFERENCE]);
  }

  const sourcesHash = contentHash(seed.sources);
  const entriesHash = contentHash(seed.entries);
  const packageHash = contentHash({ version: seed.manifest.version, sourcesHash, entriesHash });
  if (seed.manifest.sourcesHash !== sourcesHash
    || seed.manifest.entriesHash !== entriesHash
    || seed.manifest.contentHash !== packageHash) {
    throw validationError([PACKAGE_REFERENCE]);
  }
}

function countEntryTypes(entries: readonly InterpretationKnowledgeEntry[]): Record<InterpretationEntryType, number> {
  const counts: Record<InterpretationEntryType, number> = {
    "metric-definition": 0,
    "performance-rule": 0,
    "root-cause-signal": 0,
    "improvement-option": 0,
    "decision-policy": 0,
  };
  for (const entry of entries) counts[entry.entryType] += 1;
  return counts;
}

function validateRelations(entries: readonly InterpretationKnowledgeEntry[]): void {
  const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
  for (const entry of entries) {
    for (const relatedId of entry.relatedEntryIds) {
      const related = entriesById.get(relatedId);
      if (related === undefined
        || relatedId === entry.entryId
        || !ALLOWED_RELATED_TYPES[entry.entryType].includes(related.entryType)) {
        throw validationError([entry.entryId]);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (entry: InterpretationKnowledgeEntry): void => {
    if (visiting.has(entry.entryId)) throw validationError([entry.entryId]);
    if (visited.has(entry.entryId)) return;
    visiting.add(entry.entryId);
    for (const relatedId of entry.relatedEntryIds) visit(entriesById.get(relatedId)!);
    visiting.delete(entry.entryId);
    visited.add(entry.entryId);
  };
  for (const entry of entries) visit(entry);
}

function validationError(affectedInputReferences: readonly string[]): Error {
  const error = createTypedError({
    code: "validation_error",
    summary: VALIDATION_ERROR_SUMMARY,
    suggestedAction: VALIDATION_ERROR_ACTION,
    affectedInputReferences,
  });
  SAFE_VALIDATION_ERRORS.add(error);
  return error;
}

function safeParse<Output>(schema: z.ZodType<Output>, value: unknown): z.SafeParseReturnType<unknown, Output> {
  try {
    return schema.safeParse(value);
  } catch {
    return { success: false, error: new z.ZodError([]) };
  }
}

function deepFreeze<Value>(value: Value): DeepReadonly<Value> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value as DeepReadonly<Value>;
}

function failClosed<Output>(action: () => Output): Output {
  try {
    return action();
  } catch (error) {
    if (isSafeValidationError(error)) throw error;
    throw validationError([]);
  }
}

function isSafeValidationError(error: unknown): error is Error {
  if (typeof error !== "object" || error === null || !SAFE_VALIDATION_ERRORS.has(error)) return false;
  try {
    const properties = Object.getOwnPropertyDescriptors(error);
    return properties.code?.value === "validation_error"
      && properties.summary?.value === VALIDATION_ERROR_SUMMARY
      && properties.suggestedAction?.value === VALIDATION_ERROR_ACTION
      && properties.retryable?.value === false
      && typeof properties.runId?.value === "string"
      && Array.isArray(properties.affectedInputReferences?.value);
  } catch {
    return false;
  }
}