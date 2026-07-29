import { contentHash } from "../validation.js";
import { createReviewedInterpretationRulesV1SeedPackage } from "./data/interpretation-rules-v1.js";
import type { InterpretationKnowledgeSeedPackage } from "./types.js";

export function createValidInterpretationKnowledgeSeedPackage(): InterpretationKnowledgeSeedPackage {
  return createReviewedInterpretationRulesV1SeedPackage();
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