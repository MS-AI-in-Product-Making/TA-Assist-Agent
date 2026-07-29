import { z } from "zod";
import {
  createTypedError,
  internalToleranceGuidanceEntrySchema,
  internalToleranceGuidanceManifestSchema,
  internalToleranceGuidanceSourceMetadataSchema,
  type InternalToleranceGuidanceEntry,
  type InternalToleranceGuidanceSourceMetadata,
} from "@ai-assist/contracts";
import type { InternalKnowledgeSeedPackage, InternalKnowledgeSnapshot } from "./types.js";
import { contentHash } from "../validation.js";

export { canonicalJson, contentHash } from "../validation.js";

const MANIFEST_REFERENCE = "internal-tolerance-guidance-manifest";
const SOURCES_REFERENCE = "internal-tolerance-guidance-sources";
const ENTRIES_REFERENCE = "internal-tolerance-guidance-entries";
const VALIDATION_ERROR_SUMMARY = "Internal tolerance-guidance package is invalid.";
const VALIDATION_ERROR_ACTION = "Provide a valid internal tolerance-guidance package.";
const SAFE_VALIDATION_ERRORS = new WeakSet<object>();

const seedPackageSchema = z.object({
  manifest: z.unknown(),
  sources: z.array(z.unknown()),
  entries: z.array(z.unknown()),
}).strict();

export function createInternalKnowledgeSnapshot(value: unknown): InternalKnowledgeSnapshot {
  return failClosed(() => deepFreeze(structuredClone(validateInternalSeedPackage(value))));
}

function validateInternalSeedPackage(value: unknown): InternalKnowledgeSeedPackage {
  const root = safeParse(seedPackageSchema, value);
  if (!root.success) throw validationError([]);

  const manifest = safeParse(internalToleranceGuidanceManifestSchema, root.data.manifest);
  const sources = root.data.sources.map((source) => safeParse(internalToleranceGuidanceSourceMetadataSchema, source));
  const entries = root.data.entries.map((entry) => safeParse(internalToleranceGuidanceEntrySchema, entry));
  if (!manifest.success || sources.some((source) => !source.success) || entries.some((entry) => !entry.success)) {
    throw validationError([]);
  }

  const parsed: InternalKnowledgeSeedPackage = {
    manifest: manifest.data,
    sources: sources.map((source) => (source as { data: InternalToleranceGuidanceSourceMetadata }).data),
    entries: entries.map((entry) => (entry as { data: InternalToleranceGuidanceEntry }).data),
  };

  validateUniqueIds(parsed.sources, (source) => source.sourceId, SOURCES_REFERENCE);
  validateUniqueIds(parsed.entries, (entry) => entry.entryId, ENTRIES_REFERENCE);
  validateEntryProvenance(parsed);
  validateManifest(parsed);
  validateFallbackGraph(parsed.entries);
  validateEqualPriorityPredicates(parsed.entries);
  return parsed;
}

function validateUniqueIds<Entry>(entries: readonly Entry[], getId: (entry: Entry) => string, reference: string): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(getId(entry))) throw validationError([reference]);
    ids.add(getId(entry));
  }
}

function validateEntryProvenance(seed: InternalKnowledgeSeedPackage): void {
  const sourcesById = new Map(seed.sources.map((source) => [source.sourceId, source]));
  for (const entry of seed.entries) {
    const source = sourcesById.get(entry.provenance.sourceId);
    if (source === undefined
      || entry.provenance.sourceFile !== source.sourceFile
      || entry.provenance.sourceFileHash !== source.sourceFileHash
      || entry.provenance.sourceVersion !== source.sourceVersion
      || entry.provenance.sheetName !== source.sheetName
      || entry.provenance.sourceRange !== source.sourceRange
      || entry.provenance.classification !== source.classification) {
      throw validationError([ENTRIES_REFERENCE]);
    }
  }
}

function validateManifest(seed: InternalKnowledgeSeedPackage): void {
  if (seed.manifest.sourceCount !== seed.sources.length || seed.manifest.entryCount !== seed.entries.length) {
    throw validationError([MANIFEST_REFERENCE]);
  }
  if (seed.manifest.sourcesContentHash !== contentHash(seed.sources) || seed.manifest.entriesContentHash !== contentHash(seed.entries)) {
    throw validationError([MANIFEST_REFERENCE]);
  }
}

function validateFallbackGraph(entries: readonly InternalToleranceGuidanceEntry[]): void {
  const byId = new Map(entries.map((entry) => [entry.entryId, entry]));
  for (const entry of entries) {
    if (entry.fallbackEntryId !== undefined && !byId.has(entry.fallbackEntryId)) {
      throw validationError([ENTRIES_REFERENCE]);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (entry: InternalToleranceGuidanceEntry): void => {
    if (visiting.has(entry.entryId)) throw validationError([ENTRIES_REFERENCE]);
    if (visited.has(entry.entryId)) return;
    visiting.add(entry.entryId);
    if (entry.fallbackEntryId !== undefined) visit(byId.get(entry.fallbackEntryId)!);
    visiting.delete(entry.entryId);
    visited.add(entry.entryId);
  };
  for (const entry of entries) visit(entry);
}

function validateEqualPriorityPredicates(entries: readonly InternalToleranceGuidanceEntry[]): void {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    for (const candidate of entries.slice(index + 1)) {
      if (entry.fallbackPriority === candidate.fallbackPriority
        && !areDirectlyLinkedByFallback(entry, candidate)
        && predicatesOverlap(entry, candidate)) {
        throw validationError([ENTRIES_REFERENCE]);
      }
    }
  }
}

function areDirectlyLinkedByFallback(
  left: InternalToleranceGuidanceEntry,
  right: InternalToleranceGuidanceEntry,
): boolean {
  return left.fallbackEntryId === right.entryId || right.fallbackEntryId === left.entryId;
}

function predicatesOverlap(left: InternalToleranceGuidanceEntry, right: InternalToleranceGuidanceEntry): boolean {
  return left.processFamily === right.processFamily
    && left.featureType === right.featureType
    && (left.material === undefined || right.material === undefined || left.material === right.material)
    && rangesOverlap(left.nominalRange, right.nominalRange)
    && conditionsOverlap(left.conditions, right.conditions);
}

function conditionsOverlap(
  left: InternalToleranceGuidanceEntry["conditions"],
  right: InternalToleranceGuidanceEntry["conditions"],
): boolean {
  return stringConditionsOverlap(left?.processMethod, right?.processMethod)
    && stringConditionsOverlap(left?.materialFamily, right?.materialFamily)
    && stringConditionsOverlap(left?.toleranceGrade, right?.toleranceGrade)
    && stringConditionsOverlap(left?.dimensionType, right?.dimensionType)
    && thicknessRangesOverlap(left?.thicknessMm, right?.thicknessMm);
}

function stringConditionsOverlap(left: string | undefined, right: string | undefined): boolean {
  return left === undefined || right === undefined || left === right;
}

function thicknessRangesOverlap(
  left: { min: number; minInclusive?: boolean | undefined; max: number; maxInclusive?: boolean | undefined } | undefined,
  right: { min: number; minInclusive?: boolean | undefined; max: number; maxInclusive?: boolean | undefined } | undefined,
): boolean {
  return left === undefined || right === undefined || rangesIntersect(left, right);
}

function rangesOverlap(
  left: InternalToleranceGuidanceEntry["nominalRange"],
  right: InternalToleranceGuidanceEntry["nominalRange"],
): boolean {
  return left === undefined || right === undefined || rangesIntersect(left, right);
}

function rangesIntersect(
  left: { min: number; minInclusive?: boolean | undefined; max: number; maxInclusive?: boolean | undefined },
  right: { min: number; minInclusive?: boolean | undefined; max: number; maxInclusive?: boolean | undefined },
): boolean {
  if (left.max < right.min || right.max < left.min) return false;
  if (left.max === right.min) return left.maxInclusive !== false && right.minInclusive !== false;
  if (right.max === left.min) return right.maxInclusive !== false && left.minInclusive !== false;
  return true;
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

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
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