import type {
  CapabilityEntry,
  CapabilityItemMapping,
  EngineeringRuleEntry,
  TerminologyEntry,
} from "@ai-assist/contracts";

import type { DeepReadonly } from "../deep-readonly.js";

// Import canonical rules from the public module so both modules share the same rule set
import { engineeringRules } from "../public-engineering-rules.js";

interface CanonicalSeedData {
  capabilities: DeepReadonly<CapabilityEntry[]>;
  itemMappings: DeepReadonly<CapabilityItemMapping[]>;
  rules: DeepReadonly<EngineeringRuleEntry[]>;
  terminology: DeepReadonly<TerminologyEntry[]>;
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
  itemMappings: [
    {
      itemId: "item-demo-bracket-arm",
      itemName: "demo bracket arm",
      partCategory: "demo-bracket",
      capabilityEntryId: "cap-demo-bracket",
      keywords: ["bracket arm", "mount arm"],
      provenance,
    },
    {
      itemId: "item-demo-bracket-mount",
      itemName: "demo bracket mount",
      partCategory: "demo-bracket",
      capabilityEntryId: "cap-demo-bracket",
      keywords: ["mount", "support"],
      provenance,
    },
  ],
  rules: engineeringRules,
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
      entryId: "demo-spacer",
      termType: "part-category",
      canonicalName: "demo-spacer",
      aliases: ["demonstration spacer"],
      definition: "A public demonstration spacer part category.",
      provenance,
    },
    {
      entryId: "demo-t0-clip",
      termType: "part-category",
      canonicalName: "demo-t0-clip",
      aliases: ["demonstration clip"],
      definition: "A public demonstration clip part category.",
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

export function createCanonicalSeedData(): DeepReadonly<CanonicalSeedData> {
  return deepFreeze(structuredClone(canonicalSeedData)) as DeepReadonly<CanonicalSeedData>;
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
