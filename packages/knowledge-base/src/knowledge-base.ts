import { z } from "zod";
import {
  createTypedError,
  capabilityItemMatchResultSchema,
  capabilityItemQuerySchema,
  engineeringRuleQuerySchema,
  knowledgeBaseQueryRequestSchema,
  terminologyQuerySchema,
  type CapabilityEntry,
  type CapabilityItemMapping,
  type CapabilityItemMatchResult,
  type EngineeringRuleEntry,
  type KnowledgeBaseManifest,
  type TerminologyEntry,
} from "@ai-assist/contracts";
import { createKnowledgeSnapshot, createSeedPackage } from "./validation.js";

const loadKnowledgeBaseRequestSchema = z.object({ version: z.string() }).strict();
const UNKNOWN_CAPABILITY_MESSAGE = "制程能力未知，请与供应商确认";

export interface CapabilityMatch {
  readonly queryType: "capability";
  readonly status: "matched";
  readonly contractVersion: "v1";
  readonly knowledgeBaseVersion: "v1";
  readonly entry: CapabilityEntry;
}

export interface CapabilityUnknown {
  readonly queryType: "capability";
  readonly status: "unknown";
  readonly contractVersion: "v1";
  readonly knowledgeBaseVersion: "v1";
  readonly capabilityTier: "T0";
  readonly message: "制程能力未知，请与供应商确认";
}

export interface RuleMatch {
  readonly queryType: "rule";
  readonly status: "matched";
  readonly contractVersion: "v1";
  readonly knowledgeBaseVersion: "v1";
  readonly entry: EngineeringRuleEntry;
}

export interface RuleUnknown {
  readonly queryType: "rule";
  readonly status: "unknown";
  readonly contractVersion: "v1";
  readonly knowledgeBaseVersion: "v1";
}

export interface TerminologyMatch {
  readonly queryType: "terminology";
  readonly status: "matched";
  readonly contractVersion: "v1";
  readonly knowledgeBaseVersion: "v1";
  readonly entry: TerminologyEntry;
}

export interface TerminologyUnknown {
  readonly queryType: "terminology";
  readonly status: "unknown";
  readonly contractVersion: "v1";
  readonly knowledgeBaseVersion: "v1";
}

export interface KnowledgeBase {
  getKnowledgeBaseManifest(): KnowledgeBaseManifest;
  findCapability(request: unknown): CapabilityMatch | CapabilityUnknown;
  getEngineeringRule(request: unknown): RuleMatch | RuleUnknown;
  resolveTerminology(request: unknown): TerminologyMatch | TerminologyUnknown;
  matchCapabilityItem(request: unknown): CapabilityItemMatchResult;
}

export function loadKnowledgeBase(request: unknown): KnowledgeBase {
  const parsedRequest = parseOrThrow(loadKnowledgeBaseRequestSchema, request, "load request");
  if (parsedRequest.version !== "v1") throw unavailableVersionError();

  const snapshot = createKnowledgeSnapshot(createSeedPackage());
  return {
    getKnowledgeBaseManifest: () => immutableDto(snapshot.manifest),
    findCapability: (query) => findCapability(snapshot.capabilities, query),
    getEngineeringRule: (query) => getEngineeringRule(snapshot.rules, query),
    resolveTerminology: (query) => resolveTerminology(snapshot.terminology, query),
    matchCapabilityItem: (query) => matchCapabilityItem(snapshot.capabilities, snapshot.itemMappings, snapshot.terminology, query),
  };
}

function matchCapabilityItem(
  capabilities: readonly CapabilityEntry[],
  mappings: readonly CapabilityItemMapping[],
  terminology: readonly TerminologyEntry[],
  request: unknown,
): CapabilityItemMatchResult {
  const query = parseOrThrow(capabilityItemQuerySchema, request, "capability item query");
  const category = resolveTerminology(terminology, { termType: "part-category", value: query.partCategory });
  if (category.status === "unknown") return itemResult({ queryType: "capability-item", status: "category_not_defined", contractVersion: "v1", knowledgeBaseVersion: "v1" });
  const canonicalPartCategory = category.entry.canonicalName;
  const inputs = { factorName: normalizeKeywordText(query.factorName), partName: normalizeKeywordText(query.partName) };
  const candidates = mappings
    .filter((mapping) => mapping.partCategory === canonicalPartCategory)
    .flatMap((mapping) => {
      const hits = mapping.keywords.flatMap((keyword) => {
        const normalizedKeyword = normalizeKeywordText(keyword);
        const hitSources = (Object.entries(inputs) as ["factorName" | "partName", string][])
          .filter(([, value]) => ` ${value} `.includes(` ${normalizedKeyword} `))
          .map(([source]) => source);
        return hitSources.length === 0 ? [] : [{ keyword, hitSources }];
      });
      if (hits.length === 0) return [];
      return [{
        itemId: mapping.itemId,
        itemName: mapping.itemName,
        capabilityEntryId: mapping.capabilityEntryId,
        hitKeywords: [...new Set(hits.map((hit) => hit.keyword))],
        hitSources: [...new Set(hits.flatMap((hit) => hit.hitSources))],
      }];
    });
  if (candidates.length === 0) return itemResult({ queryType: "capability-item", status: "item_unmatched", contractVersion: "v1", knowledgeBaseVersion: "v1", canonicalPartCategory });
  if (candidates.length > 1) return itemResult({ queryType: "capability-item", status: "item_ambiguous", contractVersion: "v1", knowledgeBaseVersion: "v1", canonicalPartCategory, candidates });
  const candidate = candidates[0]!;
  const capabilityEntry = capabilities.find((entry) => entry.entryId === candidate.capabilityEntryId);
  if (!capabilityEntry) throw validationError("capability item mapping");
  return itemResult({ queryType: "capability-item", status: "matched", contractVersion: "v1", knowledgeBaseVersion: "v1", canonicalPartCategory, candidate, capabilityEntry });
}

function normalizeKeywordText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function itemResult(value: unknown): CapabilityItemMatchResult {
  return immutableDto(capabilityItemMatchResultSchema.parse(value));
}

function findCapability(
  entries: readonly CapabilityEntry[],
  request: unknown,
): CapabilityMatch | CapabilityUnknown {
  const query = parseOrThrow(knowledgeBaseQueryRequestSchema, request, "capability query");
  const entry = entries.find((candidate) =>
    candidate.partCategory === query.partCategory
    && candidate.unit === query.unit
    && query.tolerance >= candidate.toleranceMin
    && query.tolerance <= candidate.toleranceMax
    && (query.subsystem === undefined || candidate.subsystem === undefined || candidate.subsystem === query.subsystem)
    && (query.datum === undefined || candidate.datum === undefined || candidate.datum === query.datum));

  return entry === undefined
    ? immutableDto(unknownCapability())
    : immutableDto({ queryType: "capability", status: "matched", contractVersion: "v1", knowledgeBaseVersion: "v1", entry });
}

function getEngineeringRule(
  entries: readonly EngineeringRuleEntry[],
  request: unknown,
): RuleMatch | RuleUnknown {
  const query = parseOrThrow(engineeringRuleQuerySchema, request, "engineering rule query");
  const entry = entries.find((candidate) => candidate.ruleId === query.ruleId);
  return entry === undefined
    ? immutableDto(unknownResult("rule"))
    : immutableDto({ queryType: "rule", status: "matched", contractVersion: "v1", knowledgeBaseVersion: "v1", entry });
}

function resolveTerminology(
  entries: readonly TerminologyEntry[],
  request: unknown,
): TerminologyMatch | TerminologyUnknown {
  const query = parseOrThrow(terminologyQuerySchema, request, "terminology query");
  const normalizedValue = query.value.toLocaleLowerCase();
  const entry = entries.find((candidate) =>
    candidate.termType === query.termType
    && [candidate.canonicalName, ...candidate.aliases]
      .some((name) => name.toLocaleLowerCase() === normalizedValue));
  return entry === undefined
    ? immutableDto(unknownResult("terminology"))
    : immutableDto({ queryType: "terminology", status: "matched", contractVersion: "v1", knowledgeBaseVersion: "v1", entry });
}

function parseOrThrow<Output>(
  schema: z.ZodType<Output>,
  value: unknown,
  reference: string,
): Output {
  const parsed = safeParse(schema, value);
  if (parsed.success) return parsed.data;
  throw validationError(reference);
}

function safeParse<Output>(schema: z.ZodType<Output>, value: unknown): z.SafeParseReturnType<unknown, Output> {
  try {
    return schema.safeParse(value);
  } catch {
    return { success: false, error: new z.ZodError([]) };
  }
}

function unknownCapability(): CapabilityUnknown {
  return {
    queryType: "capability",
    status: "unknown",
    contractVersion: "v1",
    knowledgeBaseVersion: "v1",
    capabilityTier: "T0",
    message: UNKNOWN_CAPABILITY_MESSAGE,
  };
}

function unknownResult<QueryType extends "rule" | "terminology">(queryType: QueryType): QueryType extends "rule" ? RuleUnknown : TerminologyUnknown {
  return { queryType, status: "unknown", contractVersion: "v1", knowledgeBaseVersion: "v1" } as QueryType extends "rule" ? RuleUnknown : TerminologyUnknown;
}

function validationError(reference: string): Error {
  return createTypedError({
    code: "validation_error",
    summary: "Knowledge-base request is invalid.",
    suggestedAction: "Provide a valid knowledge-base request.",
    affectedInputReferences: [reference],
  });
}

function unavailableVersionError(): Error {
  return createTypedError({
    code: "feature_not_available",
    summary: "Knowledge-base version is not available.",
    suggestedAction: "Use the approved embedded knowledge-base version.",
    affectedInputReferences: ["knowledge-base-v1"],
    details: {
      featureId: "F0",
      dependencies: ["knowledge-base-v1"],
      enablementRequirements: ["approved-public-knowledge-snapshot"],
    },
  });
}

function immutableDto<Value>(value: Value): Value {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}