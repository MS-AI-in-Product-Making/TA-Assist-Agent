import { z } from "zod";
import {
  createTypedError,
  internalToleranceGuidanceRequestSchema,
  internalToleranceGuidanceResultSchema,
  type InternalToleranceGuidanceEntry,
  type InternalToleranceGuidanceRequest,
  type InternalToleranceGuidanceResult,
} from "@ai-assist/contracts";
import { createReviewedInternalV1SeedPackage } from "./data/internal-v1.js";
import { createInternalKnowledgeSnapshot } from "./validation.js";
import type { InternalKnowledgeSnapshot } from "./types.js";

const INTERNAL_VERSION = "internal-v1";
const UNKNOWN_MESSAGE = "制程能力未知，请与供应商确认";
const loadRequestSchema = z.object({ version: z.literal(INTERNAL_VERSION) }).strict();

export interface InternalToleranceGuidance {
  assessToleranceGuidance(request: unknown): InternalToleranceGuidanceResult;
}

export function loadInternalToleranceGuidance(request: unknown): InternalToleranceGuidance {
  parseOrThrow(loadRequestSchema, request, "internal-tolerance-guidance-load-request");
  const snapshot = createInternalKnowledgeSnapshot(createReviewedInternalV1SeedPackage());

  return createInternalToleranceGuidance(snapshot);
}

export function createInternalToleranceGuidance(snapshot: InternalKnowledgeSnapshot): InternalToleranceGuidance {
  return createInternalToleranceGuidanceFromEntries(snapshot.entries);
}

export function createInternalToleranceGuidanceFromEntries(
  entries: readonly InternalToleranceGuidanceEntry[],
): InternalToleranceGuidance {
  return {
    assessToleranceGuidance: (query) => assessToleranceGuidance(entries, query),
  };
}

function assessToleranceGuidance(
  entries: readonly InternalToleranceGuidanceEntry[],
  request: unknown,
): InternalToleranceGuidanceResult {
  const query = parseOrThrow(internalToleranceGuidanceRequestSchema, request, "internal-tolerance-guidance-request");
  const selection = selectEntry(entries, query);
  if (selection === undefined) return immutableDto(unknownResult());

  const assessedTotalBand = totalBand(query);
  const maximumRecommendedTotalBand = selection.entry.maximumRecommendedTotalBand;
  const result: InternalToleranceGuidanceResult = {
    status: assessedTotalBand > maximumRecommendedTotalBand.value ? "guidance-exceeded" : "within-guidance",
    knowledgeBaseVersion: INTERNAL_VERSION,
    matchedEntryId: selection.entry.entryId,
    assessedTotalBand: { value: assessedTotalBand, unit: "mm" },
    maximumRecommendedTotalBand: { ...maximumRecommendedTotalBand },
    fallbackApplied: selection.fallbackApplied,
    evidence: {
      sourceFile: selection.entry.provenance.sourceFile,
      sourceFileHash: selection.entry.provenance.sourceFileHash,
      sheetName: selection.entry.provenance.sheetName,
      sourceRange: selection.entry.provenance.sourceRange,
    },
  };
  return immutableDto(internalToleranceGuidanceResultSchema.parse(result));
}

function selectEntry(
  entries: readonly InternalToleranceGuidanceEntry[],
  query: InternalToleranceGuidanceRequest,
): { entry: InternalToleranceGuidanceEntry; fallbackApplied: boolean } | undefined {
  const fallbackTargetEntryIds = new Set(entries.flatMap(
    (entry) => entry.fallbackEntryId === undefined ? [] : [entry.fallbackEntryId],
  ));
  const directEntry = selectDirectEntry(entries, query, fallbackTargetEntryIds);
  if (directEntry !== undefined) return { entry: directEntry, fallbackApplied: false };

  const fallbackRoot = selectHighestPriority(entries.filter((entry) => isFallbackRoot(entry, query)));
  if (fallbackRoot === undefined) return undefined;

  const fallbackEntry = resolveFallbackEntry(entries, fallbackRoot, query);
  return fallbackEntry === undefined ? undefined : { entry: fallbackEntry, fallbackApplied: true };
}

function selectDirectEntry(
  entries: readonly InternalToleranceGuidanceEntry[],
  query: InternalToleranceGuidanceRequest,
  fallbackTargetEntryIds: ReadonlySet<string>,
): InternalToleranceGuidanceEntry | undefined {
  for (const matches of [isExactDirectMatch, isGenericRangeDirectMatch, isGenericFeatureDirectMatch]) {
    const candidates = entries.filter((entry) => entry.fallbackEntryId === undefined
      && !fallbackTargetEntryIds.has(entry.entryId)
      && matches(entry, query));
    if (candidates.length > 0) return selectHighestPriority(candidates);
  }
  return undefined;
}

function isExactDirectMatch(
  entry: InternalToleranceGuidanceEntry,
  query: InternalToleranceGuidanceRequest,
): boolean {
  return entry.processFamily === query.processFamily
    && entry.featureType === query.featureType
    && entry.material !== undefined
    && entry.material === query.material
    && matchesNominalRange(entry, query)
    && matchesConditions(entry, query);
}

function isGenericRangeDirectMatch(
  entry: InternalToleranceGuidanceEntry,
  query: InternalToleranceGuidanceRequest,
): boolean {
  return entry.processFamily === query.processFamily
    && entry.featureType === query.featureType
    && entry.material === undefined
    && entry.nominalRange !== undefined
    && matchesNominalRange(entry, query)
    && matchesConditions(entry, query);
}

function isGenericFeatureDirectMatch(
  entry: InternalToleranceGuidanceEntry,
  query: InternalToleranceGuidanceRequest,
): boolean {
  return entry.processFamily === query.processFamily
    && entry.featureType === query.featureType
    && entry.material === undefined
    && entry.nominalRange === undefined
    && matchesConditions(entry, query);
}

function isFallbackRoot(
  entry: InternalToleranceGuidanceEntry,
  query: InternalToleranceGuidanceRequest,
): boolean {
  return entry.processFamily === query.processFamily
    && entry.featureType === query.featureType
    && (entry.material === undefined || entry.material === query.material)
    && entry.fallbackEntryId !== undefined
    && matchesNominalRange(entry, query)
    && matchesConditions(entry, query);
}

function resolveFallbackEntry(
  entries: readonly InternalToleranceGuidanceEntry[],
  directEntry: InternalToleranceGuidanceEntry,
  query: InternalToleranceGuidanceRequest,
): InternalToleranceGuidanceEntry | undefined {
  const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
  const visited = new Set<string>([directEntry.entryId]);
  let fallbackEntryId = directEntry.fallbackEntryId;

  while (fallbackEntryId !== undefined) {
    const entry = entriesById.get(fallbackEntryId);
    if (entry === undefined || visited.has(entry.entryId)) return undefined;
    visited.add(entry.entryId);

    if (!isCompatibleFallbackEntry(entry, query)) return undefined;
    if (entry.fallbackEntryId === undefined) return entry;
    fallbackEntryId = entry.fallbackEntryId;
  }

  return undefined;
}

function isCompatibleFallbackEntry(
  entry: InternalToleranceGuidanceEntry,
  query: InternalToleranceGuidanceRequest,
): boolean {
  return entry.processFamily === query.processFamily
    && entry.featureType === query.featureType
    && (entry.material === undefined || entry.material === query.material)
    && matchesNominalRange(entry, query)
    && matchesConditions(entry, query);
}

function matchesNominalRange(
  entry: InternalToleranceGuidanceEntry,
  query: InternalToleranceGuidanceRequest,
): boolean {
  return entry.nominalRange === undefined || containsValue(entry.nominalRange, query.nominalValue);
}

function matchesConditions(
  entry: InternalToleranceGuidanceEntry,
  query: InternalToleranceGuidanceRequest,
): boolean {
  const required = entry.conditions;
  if (required === undefined) return true;
  const supplied = query.conditions;
  if (supplied === undefined) return false;
  return (required.processMethod === undefined || supplied.processMethod === required.processMethod)
    && (required.materialFamily === undefined || supplied.materialFamily === required.materialFamily)
    && (required.toleranceGrade === undefined || supplied.toleranceGrade === required.toleranceGrade)
    && (required.dimensionType === undefined || supplied.dimensionType === required.dimensionType)
    && (required.thicknessMm === undefined
      || supplied.thicknessMm !== undefined && containsValue(required.thicknessMm, supplied.thicknessMm));
}

function containsValue(
  range: { min: number; minInclusive?: boolean | undefined; max: number; maxInclusive?: boolean | undefined },
  value: number,
): boolean {
  return (value > range.min || value === range.min && range.minInclusive !== false)
    && (value < range.max || value === range.max && range.maxInclusive !== false);
}

function selectHighestPriority(
  candidates: readonly InternalToleranceGuidanceEntry[],
): InternalToleranceGuidanceEntry | undefined {
  if (candidates.length === 0) return undefined;
  const highestSpecificity = Math.max(...candidates.map(conditionSpecificity));
  const mostSpecificCandidates = candidates.filter((entry) => conditionSpecificity(entry) === highestSpecificity);
  const highestPriority = Math.max(...mostSpecificCandidates.map((entry) => entry.fallbackPriority));
  const highestPriorityCandidates = mostSpecificCandidates.filter((entry) => entry.fallbackPriority === highestPriority);
  return highestPriorityCandidates.length === 1 ? highestPriorityCandidates[0] : undefined;
}

function conditionSpecificity(entry: InternalToleranceGuidanceEntry): number {
  return entry.conditions === undefined ? 0 : Object.keys(entry.conditions).length;
}

function totalBand(request: InternalToleranceGuidanceRequest): number {
  switch (request.tolerance.representation) {
    case "bilateral": return request.tolerance.value * 2;
    case "total-band": return request.tolerance.value;
    case "unilateral": return request.tolerance.upperValue - request.tolerance.lowerValue;
  }
}

function unknownResult(): InternalToleranceGuidanceResult {
  return {
    status: "unknown",
    knowledgeBaseVersion: INTERNAL_VERSION,
    capabilityTier: "T0",
    message: UNKNOWN_MESSAGE,
  };
}

function parseOrThrow<Output>(schema: z.ZodType<Output>, value: unknown, reference: string): Output {
  try {
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
  } catch {
    // Unsafe input getters and proxies are treated as invalid requests.
  }
  throw validationError(reference);
}

function validationError(reference: string): Error {
  return createTypedError({
    code: "validation_error",
    summary: "Internal tolerance-guidance request is invalid.",
    suggestedAction: "Provide a valid internal tolerance-guidance request.",
    affectedInputReferences: [reference],
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