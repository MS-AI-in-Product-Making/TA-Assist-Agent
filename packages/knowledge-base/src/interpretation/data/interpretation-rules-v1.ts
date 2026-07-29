import type {
  InterpretationKnowledgeEntry,
  InterpretationKnowledgeSeedPackage,
} from "@ai-assist/contracts";

export function createReviewedInterpretationRulesV1SeedPackage(): InterpretationKnowledgeSeedPackage {
  const source = {
    sourceAlias: "ta-interpretation-rules-v4-2",
    sourceFileHash: "e3e1954233e94c058088c5084b9a27a7847efc74fbf8a26f51584c40ca4f9fa5",
    sourceVersion: "4.2",
    classification: "internal" as const,
    owner: "TA knowledge steward",
  };
  const provenance = (sheetName: string, sourceRange: string) => ({
    ...source,
    sheetName,
    sourceRange,
    confidence: 0.9,
    effectiveVersion: "interpretation-rules-v1" as const,
    changeSummary: "Reviewed TA interpretation guidance from source version 4.2.",
  });
  const common = {
    applicability: { analysisDimension: "one-dimensional" as const, method: "rss" as const },
  };
  const entries: InterpretationKnowledgeEntry[] = [
    {
      ...common,
      entryId: "metric-cpk",
      entryType: "metric-definition",
      title: "Process capability index (Cpk)",
      description: "Defines Cpk as the process capability ratio evaluated against the resolved Cpk target.",
      relatedEntryIds: [],
      provenance: provenance("01_Metric_Definitions", "A3:H3"),
      metric: "cpk",
      unit: "ratio",
    },
    {
      ...common,
      entryId: "performance-cpk",
      entryType: "performance-rule",
      title: "Cpk meets target",
      description: "Matches when achieved Cpk is greater than or equal to the resolved target; project/template target overrides workbook example threshold.",
      relatedEntryIds: ["metric-cpk"],
      provenance: provenance("02_Performance_Rules", "A2:H4"),
      metric: "cpk",
      comparison: "greater-than-or-equal",
      targetSource: "resolved-target",
      requiredFacts: ["cpk", "targetCpk"],
      outcomeWhenMatched: "meets-target",
    },
    {
      ...common,
      entryId: "root-cause-contributor-concentration",
      entryType: "root-cause-signal",
      title: "Contributor concentration hypothesis",
      description: "Flags concentrated tolerance contributors as a root-cause hypothesis after a below-target performance result.",
      relatedEntryIds: [
        "performance-cpk-below-target",
        "metric-cpk",
      ],
      provenance: provenance("03_Root_Cause_Library", "A4:H4"),
      signalStatus: "hypothesis",
      requiredFacts: ["contributors"],
      validationFacts: ["contributor-evidence"],
      activationCondition: {
        kind: "maximum-contribution-at-least",
        thresholdPercent: 30,
      },
    },
    {
      ...common,
      entryId: "improvement-reduce-contributor",
      entryType: "improvement-option",
      title: "Reduce the dominant contributor",
      description: "Proposes reducing the largest validated tolerance contributor and recalculating the stack.",
      relatedEntryIds: ["root-cause-contributor-concentration"],
      provenance: provenance("04_Improvement_Proposals", "A4:M4"),
      expectedImpact: "Reduce the largest contributor.",
      tradeoffs: ["May increase manufacturing cost."],
      validationSteps: ["Recalculate the tolerance stack."],
    },
    {
      ...common,
      entryId: "decision-escalate",
      entryType: "decision-policy",
      title: "Escalate interpretation for engineering review",
      description: "Requires engineering review of input and model validity before optimization proceeds.",
      relatedEntryIds: [
        "metric-cpk",
        "performance-cpk",
        "performance-cpk-below-target",
        "root-cause-contributor-concentration",
        "improvement-reduce-contributor",
      ],
      provenance: provenance("05_F5_F6_Decision_Logic", "A2:E2"),
      policyKind: "engineering-review",
    },
    {
      ...common,
      entryId: "performance-cpk-below-target",
      entryType: "performance-rule",
      title: "Cpk below target",
      description: "Matches when achieved Cpk is lower than the resolved target; project/template target overrides workbook example threshold.",
      relatedEntryIds: ["metric-cpk"],
      provenance: provenance("02_Performance_Rules", "A2:H4"),
      metric: "cpk",
      comparison: "less-than",
      targetSource: "resolved-target",
      requiredFacts: ["cpk", "targetCpk"],
      outcomeWhenMatched: "below-target",
    },
  ];
  const seed: InterpretationKnowledgeSeedPackage = {
    manifest: {
      version: "interpretation-rules-v1",
      classification: "internal",
      sourceCount: 1,
      entryCount: entries.length,
      entryTypeCounts: {
        "metric-definition": 1,
        "performance-rule": 2,
        "root-cause-signal": 1,
        "improvement-option": 1,
        "decision-policy": 1,
      },
      sourcesHash: "a32bd4cf0dc80a97a212b0419fa3a2a7c2ae3522e7567fba238414f0dc5ef3b9",
      entriesHash: "e159298cd0fe256a42a9515fd2c745d7a51d248552583e5b6ae50227b77ca648",
      contentHash: "c9278142b4114552dd0cd4666d1756a3769ae8d9bbe99e41c48050a9e6b6e890",
    },
    sources: [source],
    entries,
  };
  return seed;
}