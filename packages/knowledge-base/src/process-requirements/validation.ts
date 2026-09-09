import {
  createTypedError,
  processRequirementSeedPackageSchema,
  type ProcessRequirementEntry,
  type ProcessRequirementEntryType,
  type ProcessRequirementSeedPackage,
} from "@ai-assist/contracts";
import { contentHash } from "../validation.js";
import type { DeepReadonly, ProcessRequirementSnapshot } from "./types.js";

const MANIFEST_REFERENCE = "process-requirements-manifest";
const SOURCES_REFERENCE = "process-requirements-sources";
const ENTRIES_REFERENCE = "process-requirements-entries";
const VALIDATION_ERROR_SUMMARY = "Process-requirements package is invalid.";
const VALIDATION_ERROR_ACTION = "Provide a valid process-requirements package.";
const SAFE_VALIDATION_ERRORS = new WeakSet<object>();
const ENTRY_TYPES = [
  "requirement",
  "warning",
  "escalation",
  "milestone",
  "instruction",
  "definition",
] as const satisfies readonly ProcessRequirementEntryType[];
const FORBIDDEN_PROPERTY_NAMES = new Set(["sourcetext", "rawtext", "verbatim"]);
const URL_PATTERN = /\b(?:file|https?):\/+/i;
const ABSOLUTE_WINDOWS_PATH_PATTERN = /(?:^|[^A-Za-z0-9])(?:[A-Za-z]:[\\/]|\\\\|\\(?=[^\\/]))/;
const ABSOLUTE_UNIX_PATH_PATTERN = /(?:^|[\s"'(])\/(?!\/)/;

export function createProcessRequirementSnapshot(input: unknown): ProcessRequirementSnapshot {
  return failClosed(() => {
    const result = processRequirementSeedPackageSchema.safeParse(input);
    if (!result.success) throw validationError([]);
    const seed = result.data;

    validateUniqueValues(seed.sources, (source) => source.sourceAlias, SOURCES_REFERENCE);
    validateUniqueValues(seed.entries, (entry) => entry.entryId, ENTRIES_REFERENCE);
    validateProvenance(seed);
    validateManifest(seed);
    validateRelations(seed.entries);
    if (containsForbiddenContent(seed)) throw validationError([]);

    return deepFreeze(structuredClone(seed));
  });
}

function validateUniqueValues<Value>(
  values: readonly Value[],
  getValue: (value: Value) => string,
  reference: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    const identifier = getValue(value);
    if (seen.has(identifier)) throw validationError([reference]);
    seen.add(identifier);
  }
}

function validateProvenance(seed: ProcessRequirementSeedPackage): void {
  const sourcesByAlias = new Map(seed.sources.map((source) => [source.sourceAlias, source]));
  for (const entry of seed.entries) {
    const source = sourcesByAlias.get(entry.provenance.sourceAlias);
    if (source === undefined
      || entry.provenance.sourceFileHash !== source.hash
      || entry.provenance.sourceRevision !== source.revision
      || entry.provenance.sheetName !== source.sheet
      || entry.provenance.sourceRange !== source.range
      || entry.provenance.owner !== source.owner
      || entry.provenance.effectiveVersion !== seed.manifest.version) {
      throw validationError([ENTRIES_REFERENCE]);
    }
  }
}

function validateManifest(seed: ProcessRequirementSeedPackage): void {
  if (seed.manifest.counts.sources !== seed.sources.length
    || seed.manifest.counts.entries !== seed.entries.length) {
    throw validationError([MANIFEST_REFERENCE]);
  }

  for (const entryType of ENTRY_TYPES) {
    const expectedCount = seed.entries.filter((entry) => entry.entryType === entryType).length;
    if (seed.manifest.counts.entryTypes[entryType] !== expectedCount) {
      throw validationError([MANIFEST_REFERENCE]);
    }
  }

  const sourcesHash = contentHash(seed.sources);
  const entriesHash = contentHash(seed.entries);
  const packageHash = contentHash({
    version: seed.manifest.version,
    sourcesHash,
    entriesHash,
  });
  if (seed.manifest.sourcesHash !== sourcesHash
    || seed.manifest.entriesHash !== entriesHash
    || seed.manifest.contentHash !== packageHash) {
    throw validationError([MANIFEST_REFERENCE]);
  }
}

function validateRelations(entries: readonly ProcessRequirementEntry[]): void {
  const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
  for (const entry of entries) {
    for (const relatedEntryId of entry.relatedEntryIds) {
      if (relatedEntryId === entry.entryId || !entriesById.has(relatedEntryId)) {
        throw validationError([ENTRIES_REFERENCE]);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (entry: ProcessRequirementEntry): void => {
    if (visiting.has(entry.entryId)) throw validationError([ENTRIES_REFERENCE]);
    if (visited.has(entry.entryId)) return;
    visiting.add(entry.entryId);
    for (const relatedEntryId of entry.relatedEntryIds) {
      visit(entriesById.get(relatedEntryId)!);
    }
    visiting.delete(entry.entryId);
    visited.add(entry.entryId);
  };
  for (const entry of entries) visit(entry);
}

function containsForbiddenContent(value: unknown): boolean {
  if (typeof value === "string") {
    return URL_PATTERN.test(value)
      || ABSOLUTE_WINDOWS_PATH_PATTERN.test(value)
      || ABSOLUTE_UNIX_PATH_PATTERN.test(value);
  }
  if (Array.isArray(value)) return value.some(containsForbiddenContent);
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(([key, nested]) => (
      FORBIDDEN_PROPERTY_NAMES.has(key.toLowerCase()) || containsForbiddenContent(nested)
    ));
  }
  return false;
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