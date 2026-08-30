import { describe, expect, it } from "vitest";
import {
  VERSION,
  distributionInterpretationRules,
  getDistributionRulesByKind,
  getDistributionRulesByValue,
  validateDistributionInterpretationRules,
} from "./public-distribution-rules.js";

const expectedMappings = [
  ["f0:distribution:bootstrap:acceptable", "bootstrap-status", "acceptable"],
  ["f0:distribution:bootstrap:weak", "bootstrap-status", "weak"],
  ["f0:distribution:bootstrap:rejected", "bootstrap-status", "rejected"],
  ["f0:distribution:confidence:moderate", "selection-confidence", "moderate"],
  ["f0:distribution:confidence:low", "selection-confidence", "low"],
  ["f0:distribution:uncertainty:small-sample", "selection-reason", "SMALL_SAMPLE_UNCERTAINTY"],
  ["f0:distribution:compatibility:not-proof", "interpretation-policy", "compatibility-not-proof"],
] as const;

const expectedStatements = [
  "Bootstrap fit evidence is acceptable for the selected distribution.",
  "Bootstrap fit evidence is weak; treat the selected distribution cautiously.",
  "Bootstrap fit evidence rejects the selected distribution.",
  "Selection confidence is moderate; retain the stated uncertainty in downstream decisions.",
  "Selection confidence is low; do not rely on this selection alone.",
  "The small sample increases uncertainty in the selected distribution.",
  "Distribution compatibility is not proof that the measured and assumed distributions are equivalent.",
] as const;

describe("public distribution interpretation rules", () => {
  it("exports the exact version and governed rule mapping", () => {
    expect(VERSION).toBe("distribution-interpretation-v1");
    expect(distributionInterpretationRules).toHaveLength(expectedMappings.length);
    expect(distributionInterpretationRules.map((rule) => [
      rule.ruleId,
      rule.kind,
      "applicableValue" in rule ? rule.applicableValue : rule.policyId,
    ])).toEqual(expectedMappings);
    expect(distributionInterpretationRules.map(({ statement }) => statement)).toEqual(expectedStatements);
  });

  it("uses approved F0 governance provenance without an invented confidence", () => {
    for (const rule of distributionInterpretationRules) {
      expect(rule.provenance).toEqual({
        owner: "knowledge-steward",
        effectiveVersion: VERSION,
        source: "F0 distribution interpretation governance",
        sourceReference: "docs/superpowers/specs/2026-08-29-f7-selected-distribution-guidance-design.md",
        changeSummary: "Initial controlled interpretation rules for selected measured distributions.",
      });
      expect(rule.provenance).not.toHaveProperty("confidence");
    }
  });

  it("rejects duplicate IDs and invalid governed values", () => {
    const duplicate = [distributionInterpretationRules[0], distributionInterpretationRules[0]];
    expect(() => validateDistributionInterpretationRules(duplicate)).toThrow(/unique/i);
    expect(() => validateDistributionInterpretationRules([{
      ...distributionInterpretationRules[0],
      applicableValue: "not-a-bootstrap-status",
    }])).toThrow();
    expect(() => validateDistributionInterpretationRules([{
      ...distributionInterpretationRules[0],
      statement: "Uncontrolled replacement",
    }])).toThrow();
    expect(() => validateDistributionInterpretationRules([{
      ...distributionInterpretationRules[0],
      unexpected: true,
    }])).toThrow();
    expect(() => validateDistributionInterpretationRules([{
      ...distributionInterpretationRules[0],
      provenance: { ...distributionInterpretationRules[0]!.provenance, confidence: 0.8 },
    }])).toThrow();
  });

  it("returns deeply frozen canonical and query results", () => {
    const byKind = getDistributionRulesByKind("bootstrap-status");
    const byValue = getDistributionRulesByValue("selection-confidence", "low");
    expect(byKind).toHaveLength(3);
    expect(byValue.map(({ ruleId }) => ruleId)).toEqual(["f0:distribution:confidence:low"]);
    for (const value of [distributionInterpretationRules, byKind, byValue]) {
      expect(Object.isFrozen(value)).toBe(true);
      expect(Object.isFrozen(value[0])).toBe(true);
      expect(Object.isFrozen(value[0]?.provenance)).toBe(true);
      expect(() => Reflect.apply(Array.prototype.push, value, [{}])).toThrow();
    }
  });

  it("returns a frozen empty result for unknown queries", () => {
    const unknownKind = getDistributionRulesByKind("unknown");
    const unknownValue = getDistributionRulesByValue("bootstrap-status", "unknown");
    expect(unknownKind).toEqual([]);
    expect(unknownValue).toEqual([]);
    expect(Object.isFrozen(unknownKind)).toBe(true);
    expect(Object.isFrozen(unknownValue)).toBe(true);
  });
});
