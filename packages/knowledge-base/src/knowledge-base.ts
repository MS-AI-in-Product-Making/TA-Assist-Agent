import { z } from "zod";
import {
  createTypedError,
  engineeringRuleQuerySchema,
  knowledgeBaseQueryRequestSchema,
  terminologyQuerySchema,
  type CapabilityEntry,
  type EngineeringRuleEntry,
  type KnowledgeBaseManifest,
  type TerminologyEntry,
} from "@ai-assist/contracts";
import { createKnowledgeSnapshot, createSeedPackage } from "./validation.js";

const loadKnowledgeBaseRequestSchema = z.object({ version: z.string() }).strict();
const UNKNOWN_CAPABILITY_MESSAGE = "制程能力未知，请与供应商确认";

export interface CapabilityMatch {
  readonly status: "matched";
  readonly knowledgeBaseVersion: "v1";
  readonly entry: CapabilityEntry;
}

export interface CapabilityUnknown {
  readonly status: "unknown";
  readonly knowledgeBaseVersion: "v1";
  readonly capabilityTier: "T0";
  readonly message: "制程能力未知，请与供应商确认";
}

export interface RuleMatch {
  readonly status: "matched";
  readonly knowledgeBaseVersion: "v1";
  readonly entry: EngineeringRuleEntry;
}

export interface RuleUnknown {
  readonly status: "unknown";
  readonly knowledgeBaseVersion: "v1";
}

export interface TerminologyMatch {
  readonly status: "matched";
  readonly knowledgeBaseVersion: "v1";
  readonly entry: TerminologyEntry;
}

export interface TerminologyUnknown {
  readonly status: "unknown";
  readonly knowledgeBaseVersion: "v1";
}

export interface KnowledgeBase {
  getKnowledgeBaseManifest(): KnowledgeBaseManifest;
  findCapability(request: unknown): CapabilityMatch | CapabilityUnknown;
  getEngineeringRule(request: unknown): RuleMatch | RuleUnknown;
  resolveTerminology(request: unknown): TerminologyMatch | TerminologyUnknown;
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
  };
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
    && (candidate.subsystem === undefined || candidate.subsystem === query.subsystem)
    && (candidate.datum === undefined || candidate.datum === query.datum));

  return entry === undefined
    ? immutableDto(unknownCapability())
    : immutableDto({ status: "matched", knowledgeBaseVersion: "v1", entry });
}

function getEngineeringRule(
  entries: readonly EngineeringRuleEntry[],
  request: unknown,
): RuleMatch | RuleUnknown {
  const query = parseRuleQueryOrThrow(request);
  const entry = entries.find((candidate) => candidate.ruleId === query.ruleId);
  return entry === undefined
    ? immutableDto(unknownResult())
    : immutableDto({ status: "matched", knowledgeBaseVersion: "v1", entry });
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
    ? immutableDto(unknownResult())
    : immutableDto({ status: "matched", knowledgeBaseVersion: "v1", entry });
}

function parseRuleQueryOrThrow(request: unknown): { ruleId: string } {
  const parsed = safeParse(engineeringRuleQuerySchema, request);
  if (parsed.success) return parsed.data;

  const relaxed = safeParse(z.object({ ruleId: z.string().min(1) }).strict(), request);
  if (relaxed.success) return relaxed.data;
  throw validationError("engineering rule query");
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
    status: "unknown",
    knowledgeBaseVersion: "v1",
    capabilityTier: "T0",
    message: UNKNOWN_CAPABILITY_MESSAGE,
  };
}

function unknownResult(): RuleUnknown & TerminologyUnknown {
  return { status: "unknown", knowledgeBaseVersion: "v1" };
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