import {
  engineeringRuleEntrySchema,
  engineeringRuleMatchResultSchema,
  engineeringRuleQuerySchema,
  engineeringRuleUnknownResultSchema,
  type EngineeringRuleEntry,
} from "@ai-assist/contracts";
import type { DeepReadonly } from "./deep-readonly.js";

const provenance = {
  source: "anonymous engineering estimate",
  confidence: 0.5,
  owner: "knowledge-steward",
  coverage: ["public demo coverage"],
  effectiveVersion: "v1" as const,
  changeSummary: "公开演示知识库初始版本。",
};

const ruleCandidates: unknown[] = [
  {
    ruleId: "cts-sigma",
    ruleType: "sigma",
    threshold: 6,
    unit: "sigma",
    applicability: "public demo capability studies",
    provenance,
  },
  {
    ruleId: "ctf-sigma",
    ruleType: "sigma",
    threshold: 4,
    unit: "sigma",
    applicability: "public demo tolerance flow-down",
    provenance,
  },
  {
    ruleId: "default-cpk-target",
    ruleType: "cpk",
    threshold: 1.33,
    unit: "cpk",
    applicability: "public demo process capability",
    provenance,
  },
];

export function validatePublicEngineeringRules(candidates: unknown): EngineeringRuleEntry[] {
  if (!Array.isArray(candidates)) throw new Error("Public engineering rules must be an array.");
  const rules = candidates.map((candidate) => engineeringRuleEntrySchema.parse(candidate));
  const ruleIds = rules.map(({ ruleId }) => ruleId);
  if (new Set(ruleIds).size !== ruleIds.length) {
    throw new Error("Public engineering rule IDs must be unique.");
  }
  return rules;
}

export const engineeringRules: DeepReadonly<EngineeringRuleEntry[]> = deepFreeze(
  validatePublicEngineeringRules(ruleCandidates),
);

export type RuleMatch = {
  readonly queryType: "rule";
  readonly status: "matched";
  readonly contractVersion: "v1";
  readonly knowledgeBaseVersion: "v1";
  readonly entry: DeepReadonly<EngineeringRuleEntry>;
};

export type RuleUnknown = {
  readonly queryType: "rule";
  readonly status: "unknown";
  readonly contractVersion: "v1";
  readonly knowledgeBaseVersion: "v1";
};

export function getPublicEngineeringRule(request: unknown): RuleMatch | RuleUnknown {
  const query = engineeringRuleQuerySchema.parse(request);
  const entry = engineeringRules.find((candidate) => candidate.ruleId === query.ruleId);
  return entry === undefined
    ? immutableDto<RuleUnknown>(engineeringRuleUnknownResultSchema.parse({
        queryType: "rule",
        status: "unknown",
        contractVersion: "v1",
        knowledgeBaseVersion: "v1",
      }))
    : immutableDto<RuleMatch>(engineeringRuleMatchResultSchema.parse({
        queryType: "rule",
        status: "matched",
        contractVersion: "v1",
        knowledgeBaseVersion: "v1",
        entry,
      }));
}

function immutableDto<Value>(value: Value): DeepReadonly<Value> {
  return deepFreeze(structuredClone(value)) as DeepReadonly<Value>;
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested as Value);
    Object.freeze(value as unknown as Record<string, unknown>);
  }
  return value;
}
