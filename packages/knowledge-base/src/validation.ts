import { createHash } from "node:crypto";
import { z } from "zod";
import {
  capabilityEntrySchema,
  capabilityItemMappingSchema,
  createTypedError,
  engineeringRuleEntrySchema,
  knowledgeBaseManifestSchema,
  terminologyEntrySchema,
  type CapabilityEntry,
  type CapabilityItemMapping,
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
  "capability-item-mapping",
  "engineering-rules",
  "terminology-ontology",
] as const;
const MANIFEST_REFERENCE = "knowledge-base-manifest";
const SAFE_VALIDATION_ERRORS = new WeakSet<object>();
const VALIDATION_ERROR_SUMMARY = "Knowledge-base package is invalid.";
const VALIDATION_ERROR_ACTION = "Provide a valid public knowledge-base package.";

const seedPackageSchema = z
  .object({
    manifest: z.unknown(),
    capabilities: z.array(z.unknown()),
    itemMappings: z.array(z.unknown()),
    rules: z.array(z.unknown()),
    terminology: z.array(z.unknown()),
  })
  .strict();

export interface KnowledgeBaseSeedPackage {
  manifest: KnowledgeBaseManifest;
  capabilities: CapabilityEntry[];
  itemMappings: CapabilityItemMapping[];
  rules: EngineeringRuleEntry[];
  terminology: TerminologyEntry[];
}

export type KnowledgeSnapshot = Readonly<KnowledgeBaseSeedPackage>;

export function canonicalJson(value: unknown): string {
  return failClosed(() => JSON.stringify(canonicalize(value)));
}

export function contentHash(value: unknown): string {
  return failClosed(() => createHash("sha256").update(canonicalJson(value)).digest("hex"));
}

export function createSeedPackage(): KnowledgeBaseSeedPackage {
  const canonical = createCanonicalSeedData();
  const capabilities = structuredClone(canonical.capabilities) as CapabilityEntry[];
  const itemMappings = structuredClone(canonical.itemMappings) as CapabilityItemMapping[];
  const rules = structuredClone(canonical.rules) as EngineeringRuleEntry[];
  const terminology = structuredClone(canonical.terminology) as TerminologyEntry[];

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
          libraryId: "capability-item-mapping",
          contractId: "capability-item-mapping-v1",
          entryCount: itemMappings.length,
          coverage: ["public demo coverage"],
          contentHash: contentHash(itemMappings),
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
    itemMappings,
    rules,
    terminology,
  };
}

export function createKnowledgeSnapshot(value: unknown): KnowledgeSnapshot {
  return failClosed(() => {
    const seed = validateSeedPackage(value);
    return deepFreeze(structuredClone(seed));
  });
}

function validateSeedPackage(value: unknown): KnowledgeBaseSeedPackage {
  const root = safeParse(seedPackageSchema, value);
  if (!root.success || containsBannedString(root.data)) {
    throw validationError([]);
  }

  const manifest = safeParse(knowledgeBaseManifestSchema, root.data.manifest);
  const capabilities = root.data.capabilities.map((entry) => safeParse(capabilityEntrySchema, entry));
  const itemMappings = root.data.itemMappings.map((entry) => safeParse(capabilityItemMappingSchema, entry));
  const rules = root.data.rules.map((entry) => safeParse(engineeringRuleEntrySchema, entry));
  const terminology = root.data.terminology.map((entry) => safeParse(terminologyEntrySchema, entry));
  if (!manifest.success || capabilities.some((entry) => !entry.success) || itemMappings.some((entry) => !entry.success) || rules.some((entry) => !entry.success) || terminology.some((entry) => !entry.success)) {
    throw validationError([]);
  }

  const parsed: KnowledgeBaseSeedPackage = {
    manifest: manifest.data,
    capabilities: capabilities.map((entry) => structuredClone((entry as { data: CapabilityEntry }).data)),
    itemMappings: itemMappings.map((entry) => structuredClone((entry as { data: CapabilityItemMapping }).data)),
    rules: rules.map((entry) => structuredClone((entry as { data: EngineeringRuleEntry }).data)),
    terminology: terminology.map((entry) => structuredClone((entry as { data: TerminologyEntry }).data)),
  };

  validateUniqueIds(parsed.capabilities, (entry) => entry.entryId, "capability-library");
  validateUniqueIds(parsed.itemMappings, (entry) => entry.itemId, "capability-item-mapping");
  validateUniqueIds(parsed.rules, (entry) => entry.ruleId, "engineering-rules");
  validateUniqueIds(parsed.terminology, (entry) => entry.entryId, "terminology-ontology");
  validateProvenanceVersions(parsed);
  validateManifest(parsed);
  validateTerminologyGraph(parsed.terminology);
  validateTerminologyNames(parsed.terminology);
  validateItemMappings(parsed);
  return parsed;
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
  const entries = [...seed.capabilities, ...seed.itemMappings, ...seed.rules, ...seed.terminology];
  for (const entry of entries) {
    if (entry.provenance.effectiveVersion !== seed.manifest.knowledgeBaseVersion) {
      throw validationError(["capability-library", "capability-item-mapping", "engineering-rules", "terminology-ontology"]);
    }
  }
}

function validateManifest(seed: KnowledgeBaseSeedPackage): void {
  const expected = new Map([
    ["capability-library", { contractId: "capability-library-v1", entries: seed.capabilities }],
    ["capability-item-mapping", { contractId: "capability-item-mapping-v1", entries: seed.itemMappings }],
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
  const error = createTypedError({
    code: "validation_error",
    summary: VALIDATION_ERROR_SUMMARY,
    suggestedAction: VALIDATION_ERROR_ACTION,
    affectedInputReferences,
  });
  SAFE_VALIDATION_ERRORS.add(error);
  return error;
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

function safeParse<Output>(schema: z.ZodType<Output>, value: unknown): z.SafeParseReturnType<unknown, Output> {
  try {
    return schema.safeParse(value);
  } catch {
    return { success: false, error: new z.ZodError([]) };
  }
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
    const affectedInputReferences = properties.affectedInputReferences?.value;
    return properties.code?.value === "validation_error"
      && properties.summary?.value === VALIDATION_ERROR_SUMMARY
      && properties.suggestedAction?.value === VALIDATION_ERROR_ACTION
      && properties.retryable?.value === false
      && typeof properties.runId?.value === "string"
      && Array.isArray(affectedInputReferences)
      && affectedInputReferences.every((reference) => typeof reference === "string");
  } catch {
    return false;
  }
}

function validateItemMappings(seed: KnowledgeBaseSeedPackage): void {
  const capabilities = new Map(seed.capabilities.map((entry) => [entry.entryId, entry]));
  const categories = new Set(seed.terminology.filter((entry) => entry.termType === "part-category").map((entry) => entry.canonicalName));
  for (const capability of seed.capabilities) {
    if (!categories.has(capability.partCategory)) throw validationError(["terminology-ontology"]);
  }
  for (const mapping of seed.itemMappings) {
    const normalizedKeywords = mapping.keywords.map(normalizeKeyword);
    if (new Set(normalizedKeywords).size !== normalizedKeywords.length) {
      throw validationError(["capability-item-mapping"]);
    }
    const capability = capabilities.get(mapping.capabilityEntryId);
    if (!capability || capability.partCategory !== mapping.partCategory) {
      throw validationError(["capability-item-mapping"]);
    }
  }
}

function normalizeKeyword(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

