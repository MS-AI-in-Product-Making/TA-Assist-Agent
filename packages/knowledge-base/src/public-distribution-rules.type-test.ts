import {
  distributionInterpretationRules,
  getDistributionRulesByKind,
} from "./public-distribution-rules.js";

// @ts-expect-error - canonical rules are readonly
 distributionInterpretationRules.push(distributionInterpretationRules[0]);
// @ts-expect-error - rule statements are readonly
 distributionInterpretationRules[0]!.statement = "mutated";
// @ts-expect-error - nested provenance is readonly
 distributionInterpretationRules[0]!.provenance.owner = "mutated";

const queryResult = getDistributionRulesByKind("bootstrap-status");
// @ts-expect-error - query results are readonly
 queryResult.push(queryResult[0]!);
// @ts-expect-error - queried rules remain deeply readonly
 queryResult[0]!.statement = "mutated";

export {};
