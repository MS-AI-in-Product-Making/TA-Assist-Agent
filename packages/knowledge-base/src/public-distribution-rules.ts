import { z } from "zod";
import type { DeepReadonly } from "./deep-readonly.js";

export const VERSION = "distribution-interpretation-v1" as const;

const ProvenanceSchema = z.object({
  owner: z.literal("knowledge-steward"),
  effectiveVersion: z.literal(VERSION),
  source: z.literal("F0 distribution interpretation governance"),
  sourceReference: z.literal("docs/superpowers/specs/2026-08-29-f7-selected-distribution-guidance-design.md"),
  changeSummary: z.literal("Initial controlled interpretation rules for selected measured distributions."),
}).strict();

const ruleSchemas = [
  z.object({
    ruleId: z.literal("f0:distribution:bootstrap:acceptable"),
    kind: z.literal("bootstrap-status"),
    applicableValue: z.literal("acceptable"),
    statement: z.literal("Bootstrap fit evidence is acceptable for the selected distribution."),
    provenance: ProvenanceSchema,
  }).strict(),
  z.object({
    ruleId: z.literal("f0:distribution:bootstrap:weak"),
    kind: z.literal("bootstrap-status"),
    applicableValue: z.literal("weak"),
    statement: z.literal("Bootstrap fit evidence is weak; treat the selected distribution cautiously."),
    provenance: ProvenanceSchema,
  }).strict(),
  z.object({
    ruleId: z.literal("f0:distribution:bootstrap:rejected"),
    kind: z.literal("bootstrap-status"),
    applicableValue: z.literal("rejected"),
    statement: z.literal("Bootstrap fit evidence rejects the selected distribution."),
    provenance: ProvenanceSchema,
  }).strict(),
  z.object({
    ruleId: z.literal("f0:distribution:confidence:moderate"),
    kind: z.literal("selection-confidence"),
    applicableValue: z.literal("moderate"),
    statement: z.literal("Selection confidence is moderate; retain the stated uncertainty in downstream decisions."),
    provenance: ProvenanceSchema,
  }).strict(),
  z.object({
    ruleId: z.literal("f0:distribution:confidence:low"),
    kind: z.literal("selection-confidence"),
    applicableValue: z.literal("low"),
    statement: z.literal("Selection confidence is low; do not rely on this selection alone."),
    provenance: ProvenanceSchema,
  }).strict(),
  z.object({
    ruleId: z.literal("f0:distribution:uncertainty:small-sample"),
    kind: z.literal("selection-reason"),
    applicableValue: z.literal("SMALL_SAMPLE_UNCERTAINTY"),
    statement: z.literal("The small sample increases uncertainty in the selected distribution."),
    provenance: ProvenanceSchema,
  }).strict(),
  z.object({
    ruleId: z.literal("f0:distribution:compatibility:not-proof"),
    kind: z.literal("interpretation-policy"),
    policyId: z.literal("compatibility-not-proof"),
    statement: z.literal("Distribution compatibility is not proof that the measured and assumed distributions are equivalent."),
    provenance: ProvenanceSchema,
  }).strict(),
] as const;

const RuleSchema = z.discriminatedUnion("ruleId", ruleSchemas);
const RuleCollectionSchema = z.array(RuleSchema).superRefine((rules, context) => {
  const ruleIds = new Set<string>();
  for (const [index, rule] of rules.entries()) {
    if (ruleIds.has(rule.ruleId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Rule IDs must be unique; duplicate ${rule.ruleId}`,
        path: [index, "ruleId"],
      });
    }
    ruleIds.add(rule.ruleId);
  }
});

export type DistributionInterpretationRule = z.infer<typeof RuleSchema>;
export type DistributionInterpretationRuleKind = DistributionInterpretationRule["kind"];
export type Rule = DistributionInterpretationRule;

type FrozenRule = DeepReadonly<DistributionInterpretationRule>;
type FrozenRules = readonly FrozenRule[];

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value === null || typeof value !== "object") {
    return value as DeepReadonly<T>;
  }
  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return (Object.isFrozen(value) ? value : Object.freeze(value)) as DeepReadonly<T>;
}

export function validateDistributionInterpretationRules(input: unknown): DistributionInterpretationRule[] {
  return RuleCollectionSchema.parse(input);
}

const provenance = {
  owner: "knowledge-steward",
  effectiveVersion: VERSION,
  source: "F0 distribution interpretation governance",
  sourceReference: "docs/superpowers/specs/2026-08-29-f7-selected-distribution-guidance-design.md",
  changeSummary: "Initial controlled interpretation rules for selected measured distributions.",
} as const;

const rawRules = [
  { ruleId: "f0:distribution:bootstrap:acceptable", kind: "bootstrap-status", applicableValue: "acceptable", statement: "Bootstrap fit evidence is acceptable for the selected distribution.", provenance },
  { ruleId: "f0:distribution:bootstrap:weak", kind: "bootstrap-status", applicableValue: "weak", statement: "Bootstrap fit evidence is weak; treat the selected distribution cautiously.", provenance },
  { ruleId: "f0:distribution:bootstrap:rejected", kind: "bootstrap-status", applicableValue: "rejected", statement: "Bootstrap fit evidence rejects the selected distribution.", provenance },
  { ruleId: "f0:distribution:confidence:moderate", kind: "selection-confidence", applicableValue: "moderate", statement: "Selection confidence is moderate; retain the stated uncertainty in downstream decisions.", provenance },
  { ruleId: "f0:distribution:confidence:low", kind: "selection-confidence", applicableValue: "low", statement: "Selection confidence is low; do not rely on this selection alone.", provenance },
  { ruleId: "f0:distribution:uncertainty:small-sample", kind: "selection-reason", applicableValue: "SMALL_SAMPLE_UNCERTAINTY", statement: "The small sample increases uncertainty in the selected distribution.", provenance },
  { ruleId: "f0:distribution:compatibility:not-proof", kind: "interpretation-policy", policyId: "compatibility-not-proof", statement: "Distribution compatibility is not proof that the measured and assumed distributions are equivalent.", provenance },
] as const;

export const distributionInterpretationRules: FrozenRules = deepFreeze(
  validateDistributionInterpretationRules(rawRules),
);

const EMPTY_RULES: FrozenRules = Object.freeze([]);
const knownKinds = new Set<DistributionInterpretationRuleKind>([
  "bootstrap-status",
  "selection-confidence",
  "selection-reason",
  "interpretation-policy",
]);

export function getDistributionRulesByKind(kind: string): FrozenRules {
  if (!knownKinds.has(kind as DistributionInterpretationRuleKind)) return EMPTY_RULES;
  return deepFreeze(distributionInterpretationRules.filter((rule) => rule.kind === kind));
}

export function getDistributionRulesByValue(kind: string, value: string): FrozenRules {
  if (kind === "interpretation-policy") {
    return deepFreeze(distributionInterpretationRules.filter(
      (rule) => rule.kind === kind && rule.policyId === value,
    ));
  }
  if (!knownKinds.has(kind as DistributionInterpretationRuleKind)) return EMPTY_RULES;
  return deepFreeze(distributionInterpretationRules.filter(
    (rule) => rule.kind === kind && "applicableValue" in rule && rule.applicableValue === value,
  ));
}

export const getRulesByKind = getDistributionRulesByKind;
export const getRulesByValue = getDistributionRulesByValue;
export default distributionInterpretationRules;
