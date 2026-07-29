import type { InterpretationKnowledgeEntry } from "@ai-assist/contracts";
import { contentHash } from "../validation.js";
import type { InterpretationKnowledgeSeedPackage } from "./types.js";

export function createValidInterpretationKnowledgeSeedPackage(): InterpretationKnowledgeSeedPackage {
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
      entryId: "root-cause-contributor",
      entryType: "root-cause-signal",
      relatedEntryIds: ["performance-cpk", "metric-cpk"],
      signalStatus: "hypothesis",
      requiredFacts: ["contributors"],
      validationFacts: ["contributor-evidence"],
    },
    {
      ...common,
      entryId: "improvement-review",
      entryType: "improvement-option",
      relatedEntryIds: ["root-cause-contributor"],
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
        "root-cause-contributor",
        "improvement-review",
      ],
      policyKind: "engineering-review",
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
        "performance-rule": 1,
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
  refreshInterpretationKnowledgeManifest(seed);
  return seed;
}

export function refreshInterpretationKnowledgeManifest(seed: InterpretationKnowledgeSeedPackage): void {
  seed.manifest.sourceCount = seed.sources.length;
  seed.manifest.entryCount = seed.entries.length;
  seed.manifest.entryTypeCounts = {
    "metric-definition": seed.entries.filter((entry) => entry.entryType === "metric-definition").length,
    "performance-rule": seed.entries.filter((entry) => entry.entryType === "performance-rule").length,
    "root-cause-signal": seed.entries.filter((entry) => entry.entryType === "root-cause-signal").length,
    "improvement-option": seed.entries.filter((entry) => entry.entryType === "improvement-option").length,
    "decision-policy": seed.entries.filter((entry) => entry.entryType === "decision-policy").length,
  };
  seed.manifest.sourcesHash = contentHash(seed.sources);
  seed.manifest.entriesHash = contentHash(seed.entries);
  seed.manifest.contentHash = contentHash({
    version: seed.manifest.version,
    sourcesHash: seed.manifest.sourcesHash,
    entriesHash: seed.manifest.entriesHash,
  });
}