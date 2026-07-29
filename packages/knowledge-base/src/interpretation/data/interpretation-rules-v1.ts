import type {
  InterpretationKnowledgeEntry,
  InterpretationKnowledgeSeedPackage,
} from "@ai-assist/contracts";
import { contentHash } from "../../validation.js";

export function createReviewedInterpretationRulesV1SeedPackage(): InterpretationKnowledgeSeedPackage {
  const source = {
    sourceAlias: "capability-handbook",
    sourceFileHash: "a".repeat(64),
    sourceVersion: "2026-Q3",
    classification: "internal" as const,
    owner: "knowledge-steward",
  };
  const provenance = {
    ...source,
    sheetName: "Rules",
    sourceRange: "A2:H20",
    confidence: 0.9,
    effectiveVersion: "interpretation-rules-v1" as const,
    changeSummary: "Initial reviewed interpretation rules.",
  };
  const common = {
    title: "Reviewed interpretation",
    description: "Reviewed internal interpretation guidance.",
    applicability: { analysisDimension: "one-dimensional" as const, method: "rss" as const },
    provenance,
  };
  const entries: InterpretationKnowledgeEntry[] = [
    {
      ...common,
      entryId: "metric-cpk",
      entryType: "metric-definition",
      relatedEntryIds: [],
      metric: "cpk",
      unit: "ratio",
    },
    {
      ...common,
      entryId: "performance-cpk",
      entryType: "performance-rule",
      relatedEntryIds: ["metric-cpk"],
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
      relatedEntryIds: [
        "performance-cpk-below-target",
        "metric-cpk",
        "performance-sigma-below-target",
        "metric-sigma",
      ],
      signalStatus: "hypothesis",
      requiredFacts: ["contributors"],
      validationFacts: ["contributor-evidence"],
    },
    {
      ...common,
      entryId: "improvement-reduce-contributor",
      entryType: "improvement-option",
      relatedEntryIds: ["root-cause-contributor-concentration"],
      expectedImpact: "Reduce the largest contributor.",
      tradeoffs: ["May increase manufacturing cost."],
      validationSteps: ["Recalculate the tolerance stack."],
    },
    {
      ...common,
      entryId: "decision-escalate",
      entryType: "decision-policy",
      relatedEntryIds: [
        "metric-cpk",
        "performance-cpk",
        "performance-cpk-below-target",
        "metric-sigma",
        "performance-sigma-below-target",
        "performance-sigma-meets-target",
        "root-cause-contributor-concentration",
        "improvement-reduce-contributor",
      ],
      policyKind: "engineering-review",
    },
    {
      ...common,
      entryId: "performance-cpk-below-target",
      entryType: "performance-rule",
      relatedEntryIds: ["metric-cpk"],
      metric: "cpk",
      comparison: "less-than",
      targetSource: "resolved-target",
      requiredFacts: ["cpk", "targetCpk"],
      outcomeWhenMatched: "below-target",
    },
    {
      ...common,
      entryId: "metric-sigma",
      entryType: "metric-definition",
      relatedEntryIds: [],
      metric: "sigma",
      unit: "sigma",
    },
    {
      ...common,
      entryId: "performance-sigma-below-target",
      entryType: "performance-rule",
      relatedEntryIds: ["metric-sigma"],
      metric: "sigma",
      comparison: "less-than",
      targetSource: "resolved-target",
      requiredFacts: ["achievedSigma", "targetSigma"],
      outcomeWhenMatched: "below-target",
    },
    {
      ...common,
      entryId: "performance-sigma-meets-target",
      entryType: "performance-rule",
      relatedEntryIds: ["metric-sigma"],
      metric: "sigma",
      comparison: "greater-than-or-equal",
      targetSource: "resolved-target",
      requiredFacts: ["achievedSigma", "targetSigma"],
      outcomeWhenMatched: "meets-target",
    },
  ];
  const seed: InterpretationKnowledgeSeedPackage = {
    manifest: {
      version: "interpretation-rules-v1",
      classification: "internal",
      sourceCount: 1,
      entryCount: entries.length,
      entryTypeCounts: {
        "metric-definition": 2,
        "performance-rule": 4,
        "root-cause-signal": 1,
        "improvement-option": 1,
        "decision-policy": 1,
      },
      sourcesHash: "0".repeat(64),
      entriesHash: "0".repeat(64),
      contentHash: "0".repeat(64),
    },
    sources: [source],
    entries,
  };
  seed.manifest.sourcesHash = contentHash(seed.sources);
  seed.manifest.entriesHash = contentHash(seed.entries);
  seed.manifest.contentHash = contentHash({
    version: seed.manifest.version,
    sourcesHash: seed.manifest.sourcesHash,
    entriesHash: seed.manifest.entriesHash,
  });
  return seed;
}