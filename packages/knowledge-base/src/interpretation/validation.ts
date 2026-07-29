import {
  createTypedError,
  interpretationKnowledgeSeedPackageSchema,
  type InterpretationEntryType,
  type InterpretationKnowledgeEntry,
} from "@ai-assist/contracts";
import { contentHash } from "../validation.js";
import type {
  DeepReadonly,
  InterpretationKnowledgeSeedPackage,
  InterpretationKnowledgeSnapshot,
} from "./types.js";

const PACKAGE_REFERENCE = "interpretation-rules-v1";
const DEPENDENCY_ERROR_SUMMARY = "Interpretation-rules package is invalid.";
const DEPENDENCY_ERROR_ACTION = "Provide a valid interpretation-rules package.";
const SAFE_DEPENDENCY_ERRORS = new WeakSet<object>();
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

export function createInterpretationKnowledgeSnapshot(value: unknown): InterpretationKnowledgeSnapshot {
  return failClosed(() => deepFreeze(structuredClone(validateSeedPackage(value))));
}

function validateSeedPackage(value: unknown): InterpretationKnowledgeSeedPackage {
  const result = interpretationKnowledgeSeedPackageSchema.safeParse(value);
  if (!result.success) throw dependencyError([]);
  const parsed = result.data;

  validateUniqueValues(parsed.sources, (source) => source.sourceAlias);
  validateUniqueValues(parsed.entries, (entry) => entry.entryId);
  validateProvenance(parsed);
  validateManifest(parsed);
  validatePerformanceRequiredFacts(parsed.entries);
  validateRelations(parsed.entries);
  return parsed;
}

function validateUniqueValues<Value>(values: readonly Value[], getId: (value: Value) => string): void {
  const seen = new Set<string>();
  for (const value of values) {
    const id = getId(value);
    if (seen.has(id)) throw dependencyError([id]);
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
      throw dependencyError([entry.entryId]);
    }
  }
}

function validateManifest(seed: InterpretationKnowledgeSeedPackage): void {
  const sourcesHash = contentHash(seed.sources);
  const entriesHash = contentHash(seed.entries);
  const packageHash = contentHash({ version: seed.manifest.version, sourcesHash, entriesHash });
  if (seed.manifest.sourcesHash !== sourcesHash
    || seed.manifest.entriesHash !== entriesHash
    || seed.manifest.contentHash !== packageHash) {
    throw dependencyError([PACKAGE_REFERENCE]);
  }
}

function validatePerformanceRequiredFacts(entries: readonly InterpretationKnowledgeEntry[]): void {
  const requiredFactsByMetric: Readonly<Record<string, readonly string[]>> = {
    cpk: ["cpk", "targetCpk"],
    sigma: ["achievedSigma", "targetSigma"],
  };
  for (const entry of entries) {
    if (entry.entryType !== "performance-rule") continue;
    const expected = requiredFactsByMetric[entry.metric];
    if (expected === undefined
      || entry.requiredFacts.length !== expected.length
      || new Set(entry.requiredFacts).size !== expected.length
      || expected.some((fact) => !entry.requiredFacts.includes(fact))) {
      throw dependencyError([entry.entryId]);
    }
  }
}

function validateRelations(entries: readonly InterpretationKnowledgeEntry[]): void {
  const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
  for (const entry of entries) {
    for (const relatedId of entry.relatedEntryIds) {
      const related = entriesById.get(relatedId);
      if (related === undefined
        || relatedId === entry.entryId
        || !ALLOWED_RELATED_TYPES[entry.entryType].includes(related.entryType)) {
        throw dependencyError([entry.entryId]);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (entry: InterpretationKnowledgeEntry): void => {
    if (visiting.has(entry.entryId)) throw dependencyError([entry.entryId]);
    if (visited.has(entry.entryId)) return;
    visiting.add(entry.entryId);
    for (const relatedId of entry.relatedEntryIds) visit(entriesById.get(relatedId)!);
    visiting.delete(entry.entryId);
    visited.add(entry.entryId);
  };
  for (const entry of entries) visit(entry);
}

function dependencyError(affectedInputReferences: readonly string[]): Error {
  const error = createTypedError({
    code: "dependency_error",
    summary: DEPENDENCY_ERROR_SUMMARY,
    suggestedAction: DEPENDENCY_ERROR_ACTION,
    affectedInputReferences,
  });
  SAFE_DEPENDENCY_ERRORS.add(error);
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
    if (isSafeDependencyError(error)) throw error;
    throw dependencyError([]);
  }
}

function isSafeDependencyError(error: unknown): error is Error {
  if (typeof error !== "object" || error === null || !SAFE_DEPENDENCY_ERRORS.has(error)) return false;
  try {
    const properties = Object.getOwnPropertyDescriptors(error);
    return properties.code?.value === "dependency_error"
      && properties.summary?.value === DEPENDENCY_ERROR_SUMMARY
      && properties.suggestedAction?.value === DEPENDENCY_ERROR_ACTION
      && properties.retryable?.value === false
      && typeof properties.runId?.value === "string"
      && Array.isArray(properties.affectedInputReferences?.value);
  } catch {
    return false;
  }
}