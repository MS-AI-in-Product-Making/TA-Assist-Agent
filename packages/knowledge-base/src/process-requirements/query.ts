import {
  createTypedError,
  processRequirementEvaluationRequestSchema,
  processRequirementEvaluationSchema,
  processRequirementListRequestSchema,
  processRequirementLoadRequestSchema,
  type ProcessRequirementEntry,
  type ProcessRequirementEvaluation,
  type ProcessRequirementEvaluationFacts,
  type ProcessRequirementFactReference,
  type ProcessRequirementListRequest,
  type ProcessRequirementMatchedEntry,
  type ProcessRequirementSeedPackage,
  type ProcessRequirementVersion,
} from "@ai-assist/contracts";
import { createReviewedProcessRequirementsV1SeedPackage } from "./data/process-requirements-v1.js";
import { createReviewedProcessRequirementsV2SeedPackage } from "./data/process-requirements-v2.js";
import type { DeepReadonly, ProcessRequirementSnapshot } from "./types.js";
import { createProcessRequirementSnapshot } from "./validation.js";

const LIST_REFERENCE = "process-requirements-list-request";
const EVALUATION_REFERENCE = "process-requirements-evaluation-request";
const SEED_PACKAGE_FACTORIES = {
  "process-requirements-v1": createReviewedProcessRequirementsV1SeedPackage,
  "process-requirements-v2": createReviewedProcessRequirementsV2SeedPackage,
} satisfies Record<ProcessRequirementVersion, () => ProcessRequirementSeedPackage>;
const SEVERITY_ORDER = new Map([
  ["escalation", 0],
  ["warning", 1],
  ["requirement", 2],
  ["milestone", 3],
  ["instruction", 4],
]);

type SnapshotEntry = ProcessRequirementSnapshot["entries"][number];
type ListedProcessRequirements = DeepReadonly<ProcessRequirementEntry[]>;

export interface ProcessRequirements {
  readonly manifest: ProcessRequirementSnapshot["manifest"];
  listProcessRequirements(request: unknown): ListedProcessRequirements;
  evaluateProcessRequirements(facts: unknown): DeepReadonly<ProcessRequirementEvaluation>;
}

export function loadProcessRequirements(request: unknown): ProcessRequirements {
  const { version } = parseOrThrow(
    processRequirementLoadRequestSchema,
    request,
    "process-requirements-load-request",
  );
  const seed = SEED_PACKAGE_FACTORIES[version]();
  const snapshot = createProcessRequirementSnapshot(seed);

  return {
    manifest: snapshot.manifest,
    listProcessRequirements: (query) => list(snapshot.entries, query),
    evaluateProcessRequirements: (facts) => evaluate(snapshot, facts),
  };
}

function list(
  entries: ProcessRequirementSnapshot["entries"],
  request: unknown,
): ListedProcessRequirements {
  const query = parseOrThrow(processRequirementListRequestSchema, request, LIST_REFERENCE);
  const filtered = entries.filter((entry) => matchesListFilter(entry, query));
  return immutableDto(filtered) as ListedProcessRequirements;
}

function matchesListFilter(entry: SnapshotEntry, query: ProcessRequirementListRequest): boolean {
  return (query.topics === undefined || query.topics.includes(entry.topic))
    && (query.entryTypes === undefined || query.entryTypes.includes(entry.entryType));
}

function evaluate(
  snapshot: ProcessRequirementSnapshot,
  request: unknown,
): DeepReadonly<ProcessRequirementEvaluation> {
  const entries = snapshot.entries;
  const facts = parseOrThrow(processRequirementEvaluationRequestSchema, request, EVALUATION_REFERENCE);
  const evaluableEntries = entries.filter(({ entryType }) => entryType !== "definition");
  const matchedEntries = sortEntries(evaluableEntries.filter((entry) => matchesEntry(entry, facts)));
  const resolvedTargets = resolveTargets(facts);
  const relevantEntries = evaluableEntries.filter((entry) => isPotentiallyRelevant(entry, facts));
  const missingFacts = uniqueSorted(relevantEntries.flatMap(({ applicability }) => (
    applicability.requiredFacts.filter((reference) => !hasFact(facts, reference))
  )));

  if (matchedEntries.length > 0) {
    return immutableEvaluation({
      version: snapshot.manifest.version,
      status: "matched",
      resolvedTargets,
      factsUsed: uniqueSorted([...matchedEntries, ...relevantEntries].flatMap(({ applicability }) => (
        applicability.requiredFacts.filter((reference) => hasFact(facts, reference))
      ))),
      matchedEntries: matchedEntries.map(toMatchedEntry),
      missingFacts,
    });
  }

  if (missingFacts.length > 0) {
    return immutableEvaluation({
      version: snapshot.manifest.version,
      status: "insufficient-facts",
      resolvedTargets,
      factsUsed: uniqueSorted(relevantEntries.flatMap(({ applicability }) => (
        applicability.requiredFacts.filter((reference) => hasFact(facts, reference))
      ))),
      matchedEntries: [],
      missingFacts,
    });
  }

  return immutableEvaluation({
    version: snapshot.manifest.version,
    status: "not-applicable",
    resolvedTargets,
    factsUsed: [],
    matchedEntries: [],
    missingFacts: [],
  });
}

function matchesEntry(entry: SnapshotEntry, facts: ProcessRequirementEvaluationFacts): boolean {
  return entry.applicability.requiredFacts.every((reference) => hasFact(facts, reference))
    && predicatesMatch(entry, facts, false);
}

function isPotentiallyRelevant(
  entry: SnapshotEntry,
  facts: ProcessRequirementEvaluationFacts,
): boolean {
  const predicateReferences = entry.applicability.requiredFacts.filter((reference) => (
    hasPredicate(entry, reference)
  ));
  return predicateReferences.some((reference) => hasFact(facts, reference))
    && predicatesMatch(entry, facts, true);
}

function predicatesMatch(
  entry: SnapshotEntry,
  facts: ProcessRequirementEvaluationFacts,
  ignoreAbsent: boolean,
): boolean {
  const applicability = entry.applicability;
  return applicability.requiredFacts.every((reference) => {
    const actual = factValue(facts, reference);
    if (actual === undefined) return ignoreAbsent;
    switch (reference) {
      case "toleranceCount":
        return typeof actual === "number"
          && (applicability.minimumToleranceCountExclusive === undefined
            || actual > applicability.minimumToleranceCountExclusive)
          && (applicability.maximumToleranceCountExclusive === undefined
            || actual < applicability.maximumToleranceCountExclusive);
      default: {
        const expected = applicability[reference];
        return expected === undefined || expected === "all" || actual === expected;
      }
    }
  });
}

function hasPredicate(entry: SnapshotEntry, reference: ProcessRequirementFactReference): boolean {
  return reference === "toleranceCount"
    ? entry.applicability.minimumToleranceCountExclusive !== undefined
      || entry.applicability.maximumToleranceCountExclusive !== undefined
    : entry.applicability[reference] !== undefined;
}

function hasFact(facts: ProcessRequirementEvaluationFacts, reference: ProcessRequirementFactReference): boolean {
  return factValue(facts, reference) !== undefined;
}

function factValue(
  facts: ProcessRequirementEvaluationFacts,
  reference: ProcessRequirementFactReference,
): ProcessRequirementEvaluationFacts[ProcessRequirementFactReference] {
  return facts[reference];
}

function resolveTargets(facts: ProcessRequirementEvaluationFacts): { sigma?: 4 | 6 } {
  switch (facts.characteristicClass) {
    case "cts": return { sigma: 6 };
    case "ctf": return { sigma: 4 };
    default: return {};
  }
}

function toMatchedEntry(entry: SnapshotEntry): ProcessRequirementMatchedEntry {
  return {
    entryId: entry.entryId,
    entryType: entry.entryType,
    topic: entry.topic,
    title: entry.title,
    message: entry.message,
    normativeStrength: entry.normativeStrength,
    relatedFactReferences: [...entry.applicability.requiredFacts],
    evidence: entry.provenance,
  };
}

function sortEntries(entries: readonly SnapshotEntry[]): SnapshotEntry[] {
  return [...entries].sort((left, right) => {
    const severity = SEVERITY_ORDER.get(left.entryType)! - SEVERITY_ORDER.get(right.entryType)!;
    return severity === 0 ? compareAscii(left.entryId, right.entryId) : severity;
  });
}

function parseOrThrow<Output>(
  schema: { safeParse(value: unknown): { success: true; data: Output } | { success: false } },
  value: unknown,
  reference: string,
): Output {
  try {
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
  } catch {
    // Unsafe getters and proxies are invalid requests.
  }
  throw createTypedError({
    code: "validation_error",
    summary: "Process-requirements request is invalid.",
    suggestedAction: "Provide a valid process-requirements request.",
    affectedInputReferences: [reference],
  });
}

function immutableEvaluation(value: ProcessRequirementEvaluation): DeepReadonly<ProcessRequirementEvaluation> {
  return immutableDto(processRequirementEvaluationSchema.parse(value));
}

function immutableDto<Value>(value: Value): DeepReadonly<Value> {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<Value>(value: Value): DeepReadonly<Value> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value as DeepReadonly<Value>;
}

function uniqueSorted<Value extends string>(values: readonly Value[]): Value[] {
  return [...new Set(values)].sort(compareAscii);
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}