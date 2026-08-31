import { getPublicEngineeringRule, engineeringRules } from "./public-engineering-rules.js";
import { createCanonicalSeedData } from "./data/v1.js";

const result = getPublicEngineeringRule({ ruleId: "default-cpk-target" });

if (result.status === "matched") {
  // Intentional compile-time negative assertion: assigning to readonly should be an error
  // @ts-expect-error - entry.threshold should be readonly
  result.entry.threshold = 2;
}

// @ts-expect-error - engineeringRules should be readonly
engineeringRules.push({} as unknown as never);

// @ts-expect-error - createCanonicalSeedData().rules should be readonly
createCanonicalSeedData().rules.push({} as unknown as never);

export {};
