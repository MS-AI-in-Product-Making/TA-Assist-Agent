import type {
  ProcessRequirementEntry,
  ProcessRequirementEntryType,
  ProcessRequirementSeedPackage,
} from "@ai-assist/contracts";
import { contentHash } from "../../validation.js";
import { createReviewedProcessRequirementsV1SeedPackage } from "./process-requirements-v1.js";

const VERSION = "process-requirements-v2";
const ENTRY_TYPES = [
  "requirement",
  "warning",
  "escalation",
  "milestone",
  "instruction",
  "definition",
] as const satisfies readonly ProcessRequirementEntryType[];

export function createReviewedProcessRequirementsV2SeedPackage(): ProcessRequirementSeedPackage {
  const seed = structuredClone(createReviewedProcessRequirementsV1SeedPackage());
  const source = seed.sources[0]!;
  source.reviewedAt = "2026-09-16T00:00:00.000Z";

  for (const entry of seed.entries) {
    entry.provenance.effectiveVersion = VERSION;
    entry.provenance.changeSummary = "Reissue reviewed guidance for process requirements v2.";
  }

  const complexStackIndex = seed.entries.findIndex(({ entryId }) => (
    entryId === "method-escalation-complex-stack"
  ));
  const complexStack = seed.entries[complexStackIndex]!;
  complexStack.message = "Consult Dimensional Management and consider 3D Variation Analysis software when a one-dimensional stack has more than 10 tolerances.";
  complexStack.provenance.changeSummary = "Clarify reviewed complex-stack escalation guidance.";

  const smallStack: ProcessRequirementEntry = {
    entryId: "instruction-consider-worst-case-small-stack",
    entryType: "instruction",
    topic: "analysis-method",
    title: "Consider Worst Case for small stacks",
    message: "Consider Worst Case values when the tolerance stack contains fewer than 4 factors.",
    normativeStrength: "should",
    applicability: {
      maximumToleranceCountExclusive: 4,
      requiredFacts: ["toleranceCount"],
    },
    relatedEntryIds: [],
    provenance: {
      ...complexStack.provenance,
      changeSummary: "Add reviewed worst-case guidance for tolerance stacks with fewer than four factors.",
    },
  };
  seed.entries.splice(complexStackIndex + 1, 0, smallStack);

  const sourcesHash = contentHash(seed.sources);
  const entriesHash = contentHash(seed.entries);
  const entryTypes = Object.fromEntries(ENTRY_TYPES.map((entryType) => [
    entryType,
    seed.entries.filter((entry) => entry.entryType === entryType).length,
  ])) as Record<ProcessRequirementEntryType, number>;
  seed.manifest = {
    version: VERSION,
    classification: "internal",
    releasedAt: "2026-09-16T00:00:00.000Z",
    changeSummary: "Add small-stack worst-case guidance and clarify complex-stack escalation.",
    counts: {
      sources: seed.sources.length,
      entries: seed.entries.length,
      entryTypes,
    },
    sourcesHash,
    entriesHash,
    contentHash: contentHash({ version: VERSION, sourcesHash, entriesHash }),
  };

  return seed;
}
