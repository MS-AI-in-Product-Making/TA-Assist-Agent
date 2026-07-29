import { contentHash } from "../validation.js";
import { createReviewedInterpretationRulesV1SeedPackage } from "./data/interpretation-rules-v1.js";
import type { InterpretationKnowledgeSeedPackage } from "./types.js";

export function createValidInterpretationKnowledgeSeedPackage(): InterpretationKnowledgeSeedPackage {
  const seed = createReviewedInterpretationRulesV1SeedPackage();
  const provenance = structuredClone(seed.entries[0]!.provenance);
  seed.entries.push(
    {
      applicability: { analysisDimension: "one-dimensional", method: "rss" },
      entryId: "metric-sigma",
      entryType: "metric-definition",
      title: "Test sigma metric",
      description: "Test-only sigma metric definition.",
      relatedEntryIds: [],
      provenance,
      metric: "sigma",
      unit: "sigma",
    },
    {
      applicability: { analysisDimension: "one-dimensional", method: "rss" },
      entryId: "performance-sigma-below-target",
      entryType: "performance-rule",
      title: "Test sigma below target",
      description: "Test-only sigma comparison.",
      relatedEntryIds: ["metric-sigma"],
      provenance,
      metric: "sigma",
      comparison: "less-than",
      targetSource: "resolved-target",
      requiredFacts: ["achievedSigma", "targetSigma"],
      outcomeWhenMatched: "below-target",
    },
    {
      applicability: { analysisDimension: "one-dimensional", method: "rss" },
      entryId: "performance-sigma-meets-target",
      entryType: "performance-rule",
      title: "Test sigma meets target",
      description: "Test-only sigma comparison.",
      relatedEntryIds: ["metric-sigma"],
      provenance,
      metric: "sigma",
      comparison: "greater-than-or-equal",
      targetSource: "resolved-target",
      requiredFacts: ["achievedSigma", "targetSigma"],
      outcomeWhenMatched: "meets-target",
    },
  );
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