import type {
  CapabilityEntry,
  EngineeringRuleEntry,
  TerminologyEntry,
} from "@ai-assist/contracts";

interface CanonicalSeedData {
  capabilities: CapabilityEntry[];
  rules: EngineeringRuleEntry[];
  terminology: TerminologyEntry[];
}

const provenance = {
  source: "anonymous engineering estimate",
  confidence: 0.5,
  owner: "knowledge-steward",
  coverage: ["public demo coverage"],
  effectiveVersion: "v1" as const,
  changeSummary: "公开演示知识库初始版本。",
};

const canonicalSeedData: CanonicalSeedData = {
  capabilities: [
  {
    entryId: "cap-demo-bracket",
    partCategory: "demo-bracket",
    subsystem: "mechanical-demo",
    datum: "primary-demo-datum",
    toleranceMin: 0.1,
    toleranceMax: 0.3,
    unit: "mm",
    recommendedDistribution: "normal",
    capabilityTier: "T3",
    provenance,
  },
  {
    entryId: "cap-demo-spacer",
    partCategory: "demo-spacer",
    subsystem: "mechanical-demo",
    datum: "primary-demo-datum",
    toleranceMin: 0.05,
    toleranceMax: 0.2,
    unit: "mm",
    recommendedDistribution: "uniform",
    capabilityTier: "T3",
    provenance,
  },
  {
    entryId: "cap-demo-t0-clip",
    partCategory: "demo-t0-clip",
    toleranceMin: 0.05,
    toleranceMax: 0.15,
    unit: "mm",
    recommendedDistribution: "normal",
    capabilityTier: "T0",
    provenance,
  },
  ],
  rules: [
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
  ],
  terminology: [
  {
    entryId: "demo-bracket",
    termType: "part-category",
    canonicalName: "demo-bracket",
    aliases: ["demonstration bracket"],
    definition: "A public demonstration bracket part category.",
    provenance,
  },
  {
    entryId: "mechanical-demo",
    termType: "subsystem",
    canonicalName: "mechanical-demo",
    aliases: ["demonstration mechanics"],
    definition: "A public demonstration mechanical subsystem.",
    provenance,
  },
  {
    entryId: "primary-demo-datum",
    termType: "datum",
    canonicalName: "primary-demo-datum",
    aliases: ["demo primary reference"],
    definition: "The primary reference datum for the public demonstration.",
    parentEntryId: "mechanical-demo",
    provenance,
  },
  ],
};

deepFreeze(canonicalSeedData);

export function createCanonicalSeedData(): Readonly<CanonicalSeedData> {
  return deepFreeze(structuredClone(canonicalSeedData));
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}