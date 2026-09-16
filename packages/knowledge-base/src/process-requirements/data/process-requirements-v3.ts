import type {
  ProcessRequirementComponentCategory,
  ProcessRequirementEntry,
  ProcessRequirementEntryType,
  ProcessRequirementPriority,
  ProcessRequirementProvenance,
  ProcessRequirementSeedPackage,
} from "@ai-assist/contracts";
import { contentHash } from "../../validation.js";
import { createReviewedProcessRequirementsV2SeedPackage } from "./process-requirements-v2.js";

const VERSION = "process-requirements-v3";
const SOURCE_ALIAS = "approved-priority-guidance";
const REVISION = "user-approved-2026-09-16";
const REVIEWED_AT = "2026-09-16T00:00:00.000Z";
const SOURCE_SECTION = "priority-definitions";
const ENTRY_TYPES = [
  "requirement",
  "warning",
  "escalation",
  "milestone",
  "instruction",
  "definition",
] as const satisfies readonly ProcessRequirementEntryType[];

const PRIORITY_DEFINITIONS = [
  {
    priority: "P0",
    message: "Priority 0 covers battery CTS; Z-axis and around-XY clearances; glass/TDM gaps and Z-step; thermal-module critical paths; and PCB critical clearances or alignment.",
  },
  {
    priority: "P1",
    message: "Priority 1 covers fit and functionality of covers, hinges, trackpads, buttons, and sensors, plus cable routing.",
  },
  {
    priority: "P2",
    message: "Priority 2 covers audio jacks, USB ports, kickstands, logos, SSDs, PCB components, screws, pins, hooks, magnets, and engagement or assembly features.",
  },
  {
    priority: "P3",
    message: "Priority 3 covers foams and gaskets used for sealing, cushioning, or noise and vibration reduction.",
  },
] as const satisfies readonly { priority: ProcessRequirementPriority; message: string }[];

const CATEGORY_MAPPINGS = [
  ["battery-cts", "P0", "battery CTS"],
  ["z-axis-or-around-xy-clearance", "P0", "Z-axis or around-XY clearance"],
  ["glass-tdm-gap-or-z-step", "P0", "glass/TDM gap or Z-step"],
  ["thermal-module-critical-path", "P0", "thermal-module critical path"],
  ["pcb-critical-clearance-or-alignment", "P0", "PCB critical clearance or alignment"],
  ["cover-fit-and-function", "P1", "cover fit and functionality"],
  ["hinge-trackpad-button-or-sensor", "P1", "hinge, trackpad, button, or sensor fit and functionality"],
  ["cable-routing", "P1", "cable routing"],
  ["external-port-kickstand-logo-or-ssd", "P2", "audio jack, USB port, kickstand, logo, or SSD"],
  ["pcb-component-or-fastener", "P2", "PCB component, screw, pin, hook, or magnet"],
  ["engagement-or-assembly-feature", "P2", "engagement or assembly feature"],
  ["foam-or-gasket-sealing-cushioning-or-nvh", "P3", "foam or gasket used for sealing, cushioning, or noise and vibration reduction"],
] as const satisfies readonly [ProcessRequirementComponentCategory, ProcessRequirementPriority, string][];

const TRANSCRIPTION_HASH = contentHash({
  definitions: PRIORITY_DEFINITIONS,
  mappings: CATEGORY_MAPPINGS,
  alignment: "Final priority requires Microsoft ME/DM alignment.",
});

export function createReviewedProcessRequirementsV3SeedPackage(): ProcessRequirementSeedPackage {
  const seed = structuredClone(createReviewedProcessRequirementsV2SeedPackage());
  for (const source of seed.sources) source.reviewedAt = REVIEWED_AT;
  seed.sources.push({
    sourceType: "approved-transcription",
    sourceAlias: SOURCE_ALIAS,
    hash: TRANSCRIPTION_HASH,
    revision: REVISION,
    section: SOURCE_SECTION,
    sourceClassification: "confidential",
    releasedClassification: "internal",
    owner: "Dimensional Management",
    reviewedAt: REVIEWED_AT,
  });

  for (const entry of seed.entries) {
    entry.provenance.effectiveVersion = VERSION;
    entry.provenance.changeSummary = "Reissue reviewed guidance for process requirements v3.";
  }

  seed.entries.push(...createDefinitionEntries(), ...createRecommendationEntries());
  seed.manifest = createManifest(seed);
  return seed;
}

function createDefinitionEntries(): ProcessRequirementEntry[] {
  return PRIORITY_DEFINITIONS.map(({ priority, message }) => ({
    entryId: `definition-priority-${priority.toLowerCase()}-components`,
    entryType: "definition",
    topic: "priority",
    title: `${priority} component priority definition`,
    message,
    normativeStrength: "informational",
    applicability: { requiredFacts: [] },
    relatedEntryIds: ["warning-priority-review-alignment"],
    provenance: transcriptionProvenance(
      `priority-definitions.${priority.toLowerCase()}`,
      `Add approved ${priority} component priority definition.`,
    ),
  }));
}

function createRecommendationEntries(): ProcessRequirementEntry[] {
  return CATEGORY_MAPPINGS.map(([componentCategory, priority, description]) => ({
    entryId: `priority-recommendation-${componentCategory}`,
    entryType: "instruction",
    topic: "priority",
    title: `Recommend ${priority} for ${description}`,
    message: `Recommend ${priority} when the analysis includes ${description}; align the final priority with Microsoft ME/DM.`,
    normativeStrength: "should",
    recommendedPriority: priority,
    applicability: {
      componentCategory,
      requiredFacts: ["componentCategories"],
    },
    relatedEntryIds: ["warning-priority-review-alignment"],
    provenance: transcriptionProvenance(
      `priority-definitions.${priority.toLowerCase()}.${componentCategory}`,
      `Add approved ${priority} recommendation mapping for ${componentCategory}.`,
    ),
  }));
}

function transcriptionProvenance(
  section: string,
  changeSummary: string,
): ProcessRequirementProvenance {
  return {
    sourceType: "approved-transcription",
    sourceAlias: SOURCE_ALIAS,
    sourceContentHash: TRANSCRIPTION_HASH,
    sourceRevision: REVISION,
    section,
    effectiveVersion: VERSION,
    owner: "Dimensional Management",
    confidence: "reviewed",
    changeSummary,
  };
}

function createManifest(seed: ProcessRequirementSeedPackage): ProcessRequirementSeedPackage["manifest"] {
  const sourcesHash = contentHash(seed.sources);
  const entriesHash = contentHash(seed.entries);
  const entryTypes = Object.fromEntries(ENTRY_TYPES.map((entryType) => [
    entryType,
    seed.entries.filter((entry) => entry.entryType === entryType).length,
  ])) as Record<ProcessRequirementEntryType, number>;
  return {
    version: VERSION,
    classification: "internal",
    releasedAt: REVIEWED_AT,
    changeSummary: "Add governed P0-P3 component definitions and structured priority recommendations.",
    counts: {
      sources: seed.sources.length,
      entries: seed.entries.length,
      entryTypes,
    },
    sourcesHash,
    entriesHash,
    contentHash: contentHash({ version: VERSION, sourcesHash, entriesHash }),
  };
}