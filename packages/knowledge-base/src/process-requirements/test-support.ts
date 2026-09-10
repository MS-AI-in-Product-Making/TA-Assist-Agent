import type {
  ProcessRequirementEntry,
  ProcessRequirementEntryType,
  ProcessRequirementSeedPackage,
} from "@ai-assist/contracts";
import { contentHash } from "../validation.js";

const SOURCE_HASH = "a".repeat(64);
const ENTRY_TYPES = [
  "requirement",
  "warning",
  "escalation",
  "milestone",
  "instruction",
  "definition",
] as const satisfies readonly ProcessRequirementEntryType[];

function createEntry(
  entryId: string,
  entryType: ProcessRequirementEntryType,
  relatedEntryIds: string[],
): ProcessRequirementEntry {
  return {
    entryId,
    entryType,
    topic: "scope",
    title: `${entryType} example`,
    message: "Use the governed process requirement for the available facts.",
    normativeStrength: entryType === "warning" ? "should" : "must",
    applicability: {
      actor: "all",
      requiredFacts: ["actor"],
    },
    relatedEntryIds,
    provenance: {
      sourceAlias: "ta-process-requirements",
      sourceFileHash: SOURCE_HASH,
      sourceRevision: "Beta",
      sheetName: "TA Process & Requirements",
      sourceRange: "B7:T55",
      effectiveVersion: "process-requirements-v1",
      owner: "Dimensional Management",
      confidence: "reviewed",
      changeSummary: "Normalized controlled process requirement.",
    },
  };
}

export function createValidProcessRequirementSeedPackage(): ProcessRequirementSeedPackage {
  const seed: ProcessRequirementSeedPackage = {
    manifest: {
      version: "process-requirements-v1",
      classification: "internal",
      releasedAt: "2026-09-09T00:00:00.000Z",
      changeSummary: "Initial reviewed process requirements snapshot.",
      counts: {
        sources: 0,
        entries: 0,
        entryTypes: {
          requirement: 0,
          warning: 0,
          escalation: 0,
          milestone: 0,
          instruction: 0,
          definition: 0,
        },
      },
      sourcesHash: "0".repeat(64),
      entriesHash: "0".repeat(64),
      contentHash: "0".repeat(64),
    },
    sources: [
      {
        sourceAlias: "ta-process-requirements",
        hash: SOURCE_HASH,
        revision: "Beta",
        sheet: "TA Process & Requirements",
        range: "B7:T55",
        sourceClassification: "confidential",
        releasedClassification: "internal",
        owner: "Dimensional Management",
        reviewedAt: "2026-09-09T00:00:00.000Z",
      },
    ],
    entries: [
      createEntry("requirement-scope", "requirement", ["warning-review"]),
      createEntry("warning-review", "warning", []),
    ],
  };
  refreshProcessRequirementManifest(seed);
  return seed;
}

export function refreshProcessRequirementManifest(seed: ProcessRequirementSeedPackage): void {
  seed.manifest.counts.sources = seed.sources.length;
  seed.manifest.counts.entries = seed.entries.length;
  for (const entryType of ENTRY_TYPES) {
    seed.manifest.counts.entryTypes[entryType] = seed.entries.filter(
      (entry) => entry.entryType === entryType,
    ).length;
  }
  seed.manifest.sourcesHash = contentHash(seed.sources);
  seed.manifest.entriesHash = contentHash(seed.entries);
  seed.manifest.contentHash = contentHash({
    version: seed.manifest.version,
    sourcesHash: seed.manifest.sourcesHash,
    entriesHash: seed.manifest.entriesHash,
  });
}