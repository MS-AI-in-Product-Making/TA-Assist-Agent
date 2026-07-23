import { createHash } from "node:crypto";
import {
  capabilityEntrySchema,
  createTypedError,
  engineeringRuleEntrySchema,
  knowledgeBaseManifestSchema,
  terminologyEntrySchema,
  type CapabilityEntry,
  type EngineeringRuleEntry,
  type KnowledgeBaseManifest,
  type TerminologyEntry,
} from "@ai-assist/contracts";
import {
  createCanonicalSeedData,
} from "./data/v1.js";

const BANNED_STRING_PATTERN = /(\.xlsx|\.xlsm|\bdim[\s_-]*id\b|\bsupplier\b|\binternal\b|\bconfidential\b|\bsecret\b|\bproject[-_ ]?code\b)/i;
const LIBRARY_IDS = [
  "capability-library",
  "engineering-rules",
  "terminology-ontology",
] as const;
const MANIFEST_REFERENCE = "knowledge-base-manifest";

export interface KnowledgeBaseSeedPackage {
  manifest: KnowledgeBaseManifest;
  capabilities: CapabilityEntry[];
  rules: EngineeringRuleEntry[];
  terminology: TerminologyEntry[];
}

export type KnowledgeSnapshot = Readonly<KnowledgeBaseSeedPackage>;

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function contentHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function createSeedPackage(): KnowledgeBaseSeedPackage {
  const canonical = createCanonicalSeedData();
  const capabilities = structuredClone(canonical.capabilities);
  const rules = structuredClone(canonical.rules);
  const terminology = structuredClone(canonical.terminology);

  return {
    manifest: {
      contractVersion: "v1",
      knowledgeBaseVersion: "v1",
      classification: "public",
      releasedAt: "2026-07-22",
      changeSummary: "公开演示知识库 v1 发布。",
      libraries: [
        {
          libraryId: "capability-library",
          contractId: "capability-library-v1",
          entryCount: capabilities.length,
          coverage: ["public demo coverage"],
          contentHash: contentHash(capabilities),
        },
        {
          libraryId: "engineering-rules",
          contractId: "engineering-rules-v1",
          entryCount: rules.length,
          coverage: ["public demo coverage"],
          contentHash: contentHash(rules),
        },
        {
          libraryId: "terminology-ontology",
          contractId: "terminology-ontology-v1",
          entryCount: terminology.length,
          coverage: ["public demo coverage"],
          contentHash: contentHash(terminology),
        },
      ],
    },
    capabilities,
    rules,
    terminology,
  };
}

export function createKnowledgeSnapshot(value: unknown): KnowledgeSnapshot {
  const seed = validateSeedPackage(value);
  return deepFreeze(structuredClone(seed));
}

function validateSeedPackage(value: unknown): KnowledgeBaseSeedPackage {
  if (!isSeedPackage(value) || containsBannedString(value)) {
    throw validationError([]);
  }

  const manifest = knowledgeBaseManifestSchema.safeParse(value.manifest);
  const capabilities = value.capabilities.map((entry) => capabilityEntrySchema.safeParse(entry));
  const rules = value.rules.map((entry) => engineeringRuleEntrySchema.safeParse(entry));
  const terminology = value.terminology.map((entry) => terminologyEntrySchema.safeParse(entry));
  if (!manifest.success || capabilities.some((entry) => !entry.success) || rules.some((entry) => !entry.success) || terminology.some((entry) => !entry.success)) {
    throw validationError([]);
  }

  const parsed: KnowledgeBaseSeedPackage = {
    manifest: manifest.data,
    capabilities: capabilities.map((entry) => (entry as { data: CapabilityEntry }).data),
    rules: rules.map((entry) => (entry as { data: EngineeringRuleEntry }).data),
    terminology: terminology.map((entry) => (entry as { data: TerminologyEntry }).data),
  };

  validateUniqueIds(parsed.capabilities, (entry) => entry.entryId, "capability-library");
  validateUniqueIds(parsed.rules, (entry) => entry.ruleId, "engineering-rules");
  validateUniqueIds(parsed.terminology, (entry) => entry.entryId, "terminology-ontology");
  validateProvenanceVersions(parsed);
  validateManifest(parsed);
  validateTerminologyGraph(parsed.terminology);
  validateTerminologyNames(parsed.terminology);
  return parsed;
}

function isSeedPackage(value: unknown): value is {
  manifest: unknown;
  capabilities: unknown[];
  rules: unknown[];
  terminology: unknown[];
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.capabilities) && Array.isArray(candidate.rules) && Array.isArray(candidate.terminology) && "manifest" in candidate;
}

function validateUniqueIds<Entry>(
  entries: readonly Entry[],
  getId: (entry: Entry) => string,
  affectedInputReference: (typeof LIBRARY_IDS)[number],
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    const id = getId(entry);
    if (seen.has(id)) throw validationError([affectedInputReference]);
    seen.add(id);
  }
}

function validateProvenanceVersions(seed: KnowledgeBaseSeedPackage): void {
  const entries = [...seed.capabilities, ...seed.rules, ...seed.terminology];
  for (const entry of entries) {
    if (entry.provenance.effectiveVersion !== seed.manifest.knowledgeBaseVersion) {
      throw validationError(["capability-library", "engineering-rules", "terminology-ontology"]);
    }
  }
}

function validateManifest(seed: KnowledgeBaseSeedPackage): void {
  const expected = new Map([
    ["capability-library", { contractId: "capability-library-v1", entries: seed.capabilities }],
    ["engineering-rules", { contractId: "engineering-rules-v1", entries: seed.rules }],
    ["terminology-ontology", { contractId: "terminology-ontology-v1", entries: seed.terminology }],
  ]);

  for (const libraryId of LIBRARY_IDS) {
    const library = seed.manifest.libraries.find((item) => item.libraryId === libraryId);
    const expectedLibrary = expected.get(libraryId)!;
    if (!library || library.contractId !== expectedLibrary.contractId || library.entryCount !== expectedLibrary.entries.length || library.contentHash !== contentHash(expectedLibrary.entries)) {
      throw validationError([MANIFEST_REFERENCE]);
    }
  }
}

function validateTerminologyGraph(entries: readonly TerminologyEntry[]): void {
  const byId = new Map(entries.map((entry) => [entry.entryId, entry]));
  for (const entry of entries) {
    if (entry.parentEntryId !== undefined && !byId.has(entry.parentEntryId)) {
      throw validationError(["terminology-ontology"]);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (entry: TerminologyEntry): void => {
    if (visiting.has(entry.entryId)) throw validationError(["terminology-ontology"]);
    if (visited.has(entry.entryId)) return;
    visiting.add(entry.entryId);
    if (entry.parentEntryId !== undefined) visit(byId.get(entry.parentEntryId)!);
    visiting.delete(entry.entryId);
    visited.add(entry.entryId);
  };
  for (const entry of entries) visit(entry);
}

function validateTerminologyNames(entries: readonly TerminologyEntry[]): void {
  const namesByType = new Map<string, Set<string>>();
  for (const entry of entries) {
    const names = namesByType.get(entry.termType) ?? new Set<string>();
    for (const name of [entry.canonicalName, ...entry.aliases]) {
      const normalized = name.toLowerCase();
      if (names.has(normalized)) throw validationError(["terminology-ontology"]);
      names.add(normalized);
    }
    namesByType.set(entry.termType, names);
  }
}

function containsBannedString(value: unknown, activeObjects = new WeakSet<object>()): boolean {
  if (typeof value === "string") return BANNED_STRING_PATTERN.test(value);
  if (Array.isArray(value)) {
    if (activeObjects.has(value)) return true;
    activeObjects.add(value);
    const containsBannedValue = value.some((nested) => containsBannedString(nested, activeObjects));
    activeObjects.delete(value);
    return containsBannedValue;
  }
  if (typeof value === "object" && value !== null) {
    if (activeObjects.has(value)) return true;
    activeObjects.add(value);
    const containsBannedValue = Object.entries(value).some(([key, nested]) => BANNED_STRING_PATTERN.test(key) || containsBannedString(nested, activeObjects));
    activeObjects.delete(value);
    return containsBannedValue;
  }
  return false;
}

function validationError(affectedInputReferences: readonly string[]): Error {
  return createTypedError({
    code: "validation_error",
    summary: "Knowledge-base package is invalid.",
    suggestedAction: "Provide a valid public knowledge-base package.",
    affectedInputReferences,
  });
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}