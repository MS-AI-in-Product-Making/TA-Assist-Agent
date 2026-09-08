import {
  createTypedError,
  interpretationFactReferenceSchema,
  interpretationRuleEvaluationRequestSchema,
  interpretationRuleEvaluationSchema,
  interpretationRuleLoadRequestSchema,
  type InterpretationFactReference,
  type InterpretationKnowledgeEntry,
  type InterpretationRuleEvaluation,
  type InterpretationRuleEvaluationRequest,
} from "@ai-assist/contracts";
import { createReviewedInterpretationRulesV1SeedPackage } from "./data/interpretation-rules-v1.js";
import { createReviewedInterpretationRulesV2SeedPackage } from "./data/interpretation-rules-v2.js";
import type { InterpretationKnowledgeSnapshot } from "./types.js";
import { createInterpretationKnowledgeSnapshot } from "./validation.js";

type PerformanceRule = Extract<InterpretationKnowledgeEntry, { entryType: "performance-rule" }>;
type RootCauseSignal = Extract<InterpretationKnowledgeEntry, { entryType: "root-cause-signal" }>;
type ImprovementOption = Extract<InterpretationKnowledgeEntry, { entryType: "improvement-option" }>;
type MatchedRule = InterpretationRuleEvaluation["matchedRules"][number];
type Facts = InterpretationRuleEvaluationRequest["facts"];

export interface InterpretationRules {
  evaluateInterpretationRules(request: unknown): InterpretationRuleEvaluation;
}

export function loadInterpretationRules(request: unknown): InterpretationRules {
  const parsed = parseOrThrow(
    interpretationRuleLoadRequestSchema,
    request,
    "Interpretation rule load request is invalid.",
    "interpretation-rule-load-request",
  );
  const snapshot = createInterpretationKnowledgeSnapshot(
    parsed.version === "interpretation-rules-v1"
      ? createReviewedInterpretationRulesV1SeedPackage()
      : createReviewedInterpretationRulesV2SeedPackage(),
  );
  return createInterpretationRulesFromValidatedEntries(snapshot.entries, snapshot.manifest.version);
}

export function createInterpretationRulesFromValidatedEntries(
  validatedEntries: InterpretationKnowledgeSnapshot["entries"],
  version = validatedEntries[0]?.provenance.effectiveVersion ?? "interpretation-rules-v1",
): InterpretationRules {
  const entries = structuredClone(validatedEntries) as InterpretationKnowledgeEntry[];
  return {
    evaluateInterpretationRules: (request) => evaluate(entries, version, request),
  };
}

function evaluate(
  entries: readonly InterpretationKnowledgeEntry[],
  version: InterpretationRuleEvaluation["knowledgeBaseVersion"],
  request: unknown,
): InterpretationRuleEvaluation {
  const query = parseOrThrow(
    interpretationRuleEvaluationRequestSchema,
    request,
    "Interpretation rule evaluation request is invalid.",
    "interpretation-rule-evaluation-request",
  );
  const applicableEntries = entries.filter((entry) => (
    entry.applicability.analysisDimension === query.analysisDimension
    && (entry.applicability.method === undefined || entry.applicability.method === query.method)
  ));
  const performanceRules = applicableEntries.filter(
    (entry): entry is PerformanceRule => entry.entryType === "performance-rule",
  );
  if (performanceRules.length === 0) return immutableEvaluation(notApplicable(version));

  const relevantPerformanceRules = selectRelevantPerformanceRules(performanceRules, query.facts);
  const missingPerformanceFacts = uniqueSorted(relevantPerformanceRules.flatMap(
    (rule) => rule.requiredFacts.filter((fact) => !hasFact(query.facts, fact)),
  ));
  const resolvedTargets = resolveTargets(query.facts);
  const availablePerformanceFacts = uniqueSorted(relevantPerformanceRules.flatMap(
    (rule) => rule.requiredFacts.filter((fact) => hasFact(query.facts, fact)),
  ));
  if (missingPerformanceFacts.length > 0) {
    return immutableEvaluation({
      knowledgeBaseVersion: version,
      status: "insufficient-facts",
      resolvedTargets,
      factsUsed: availablePerformanceFacts,
      matchedRules: [],
      missingFacts: missingPerformanceFacts,
    });
  }

  const matchedPerformanceRules = sortByEntryId(
    relevantPerformanceRules.filter((rule) => compareRule(rule, query.facts)),
  );
  const matchedPerformanceIds = new Set(matchedPerformanceRules.map((rule) => rule.entryId));
  const candidateSignals = sortByEntryId(applicableEntries.filter(
    (entry): entry is RootCauseSignal => entry.entryType === "root-cause-signal"
      && entry.relatedEntryIds.every((entryId) => matchedPerformanceIds.has(entryId)),
  ));
  const matchedSignals = sortByEntryId(candidateSignals.filter(
    (signal) => signal.requiredFacts.every((fact) => hasFact(query.facts, fact))
      && signalConditionMatches(signal, query.facts),
  ));
  const matchedSignalIds = new Set(matchedSignals.map((signal) => signal.entryId));
  const matchedOptions = sortByEntryId(applicableEntries.filter(
    (entry): entry is ImprovementOption => entry.entryType === "improvement-option"
      && entry.relatedEntryIds.every((entryId) => matchedSignalIds.has(entryId)),
  ));
  const signalReferences = new Map(matchedSignals.map((signal) => [signal.entryId, factReferences(
    query.facts,
    signal.requiredFacts,
  )]));
  const matchedRules = [
    ...matchedPerformanceRules.map((rule) => matchedRule(rule, factReferences(query.facts, rule.requiredFacts))),
    ...matchedSignals.map((signal) => matchedRule(signal, signalReferences.get(signal.entryId)!)),
    ...matchedOptions.map((option) => matchedRule(
      option,
      uniqueSorted(option.relatedEntryIds.flatMap((entryId) => signalReferences.get(entryId) ?? [])),
    )),
  ];

  if (matchedPerformanceIds.size === 0) return immutableEvaluation(notApplicable(version));
  return immutableEvaluation({
    knowledgeBaseVersion: version,
    status: "matched",
    resolvedTargets,
    factsUsed: uniqueSorted(matchedRules.flatMap((rule) => rule.relatedFactReferences)),
    matchedRules,
    missingFacts: [],
  });
}

function selectRelevantPerformanceRules(
  rules: readonly PerformanceRule[],
  facts: Facts,
): readonly PerformanceRule[] {
  const relevant = rules.filter((rule) => metricFactReferences(rule.metric).some((fact) => hasFact(facts, fact)));
  return relevant.length > 0 ? relevant : rules;
}

function metricFactReferences(metric: string): readonly InterpretationFactReference[] {
  switch (metric) {
    case "cpk": return ["cpk", "targetCpk"];
    case "sigma": return ["achievedSigma", "targetSigma"];
    default: return [];
  }
}

function compareRule(rule: PerformanceRule, facts: Facts): boolean {
  const [valueReference, targetReference] = metricFactReferences(rule.metric);
  if (valueReference === undefined || targetReference === undefined) return false;
  const value = factValue(facts, valueReference);
  const target = factValue(facts, targetReference);
  if (typeof value !== "number" || typeof target !== "object" || target === null || !("value" in target)) {
    return false;
  }
  const targetValue = target.value;
  if (typeof targetValue !== "number") return false;
  switch (rule.comparison) {
    case "greater-than-or-equal": return value >= targetValue;
    case "greater-than": return value > targetValue;
    case "less-than-or-equal": return value <= targetValue;
    case "less-than": return value < targetValue;
    case "equal": return value === targetValue;
    case "not-equal": return value !== targetValue;
  }
}

function signalConditionMatches(signal: RootCauseSignal, facts: Facts): boolean {
  switch (signal.activationCondition.kind) {
    case "maximum-contribution-at-least": {
      const contributors = facts.contributors;
      return contributors !== undefined
        && contributors.length > 0
        && Math.max(...contributors.map(({ contributionPercent }) => contributionPercent))
          >= signal.activationCondition.thresholdPercent;
    }
    case "cp-below-target":
      return facts.cp !== undefined
        && facts.targetCpk !== undefined
        && facts.cp < facts.targetCpk.value;
    case "mean-off-center": {
      if (facts.cp === undefined || facts.cpk === undefined || facts.mean === undefined
        || facts.lowerSpecLimit === undefined || facts.upperSpecLimit === undefined) return false;
      const midpoint = (facts.lowerSpecLimit + facts.upperSpecLimit) / 2;
      return facts.cp - facts.cpk > signal.activationCondition.minimumCpCpkGap
        && Math.abs(facts.mean - midpoint) > signal.activationCondition.minimumMeanOffset;
    }
  }
}

function resolveTargets(facts: Facts): NonNullable<InterpretationRuleEvaluation["resolvedTargets"]> {
  return {
    ...(facts.targetCpk === undefined ? {} : { cpk: { ...facts.targetCpk } }),
    ...(facts.targetSigma === undefined ? {} : { sigma: { ...facts.targetSigma } }),
  };
}

function hasFact(facts: Facts, reference: string): boolean {
  return factValue(facts, reference) !== undefined;
}

function factValue(facts: Facts, reference: string): unknown {
  return (facts as Record<string, unknown>)[reference];
}

function factReferences(
  facts: Facts,
  requiredFacts: readonly string[],
): InterpretationFactReference[] {
  return uniqueSorted(requiredFacts.flatMap((fact) => {
    const parsed = interpretationFactReferenceSchema.safeParse(fact);
    return parsed.success && hasFact(facts, parsed.data) ? [parsed.data] : [];
  }));
}

function matchedRule(
  entry: PerformanceRule | RootCauseSignal | ImprovementOption,
  relatedFactReferences: readonly InterpretationFactReference[],
): MatchedRule {
  return {
    entryId: entry.entryId,
    entryType: entry.entryType,
    title: entry.title,
    effectiveVersion: entry.provenance.effectiveVersion,
    applicability: structuredClone(entry.applicability),
    relatedFactReferences: [...relatedFactReferences],
    evidence: structuredClone(entry.provenance),
    ...(entry.entryType === "improvement-option"
      ? { validationSteps: [...entry.validationSteps] }
      : {}),
  };
}

function notApplicable(
  version: InterpretationRuleEvaluation["knowledgeBaseVersion"],
): InterpretationRuleEvaluation {
  return {
    knowledgeBaseVersion: version,
    status: "not-applicable",
    resolvedTargets: {},
    factsUsed: [],
    matchedRules: [],
    missingFacts: [],
  };
}

function parseOrThrow<Output>(
  schema: { safeParse(value: unknown): { success: true; data: Output } | { success: false } },
  value: unknown,
  summary: string,
  reference: string,
): Output {
  try {
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
  } catch {
    // Unsafe input getters and proxies are invalid requests.
  }
  throw createTypedError({
    code: "validation_error",
    summary,
    suggestedAction: "Provide a valid interpretation rule request.",
    affectedInputReferences: [reference],
  });
}

function immutableEvaluation(value: InterpretationRuleEvaluation): InterpretationRuleEvaluation {
  return deepFreeze(structuredClone(interpretationRuleEvaluationSchema.parse(value)));
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function uniqueSorted<Value extends string>(values: readonly Value[]): Value[] {
  return [...new Set(values)].sort(compareAscii);
}

function sortByEntryId<Entry extends { entryId: string }>(entries: readonly Entry[]): Entry[] {
  return [...entries].sort((left, right) => compareAscii(left.entryId, right.entryId));
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}