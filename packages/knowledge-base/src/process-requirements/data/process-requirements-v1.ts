import type {
  ProcessRequirementEntry,
  ProcessRequirementEntryType,
  ProcessRequirementSeedPackage,
  ProcessRequirementSourceMetadata,
} from "@ai-assist/contracts";
import { contentHash } from "../../validation.js";

const SOURCE_HASH = "44c8249abca1638af5803e0bddc0de2a468fae64093b3e8f0648862923db8418";
const ENTRY_TYPES = [
  "requirement",
  "warning",
  "escalation",
  "milestone",
  "instruction",
  "definition",
] as const satisfies readonly ProcessRequirementEntryType[];

export function createReviewedProcessRequirementsV1SeedPackage(): ProcessRequirementSeedPackage {
  const source: ProcessRequirementSourceMetadata = {
    sourceAlias: "controlled-ta-template-beta",
    hash: SOURCE_HASH,
    revision: "Beta",
    sheet: "TA Process and Requirements",
    range: "A1:T59",
    sourceClassification: "confidential",
    releasedClassification: "internal",
    owner: "Dimensional Management",
    reviewedAt: "2026-09-09T00:00:00.000Z",
  };
  const entries: ProcessRequirementEntry[] = [];
  const add = (
    sourceRange: string,
    entry: Omit<ProcessRequirementEntry, "provenance" | "relatedEntryIds"> & {
      relatedEntryIds?: string[];
    },
  ): void => {
    entries.push({
      ...entry,
      relatedEntryIds: entry.relatedEntryIds ?? [],
      provenance: {
        sourceAlias: source.sourceAlias,
        sourceFileHash: source.hash,
        sourceRevision: source.revision,
        sheetName: source.sheet,
        sourceRange,
        effectiveVersion: "process-requirements-v1",
        owner: source.owner,
        confidence: "reviewed",
        changeSummary: "Normalized reviewed F0 process guidance.",
      },
    });
  };

  add("B19:R19", {
    entryId: "method-escalation-complex-stack",
    entryType: "escalation",
    topic: "analysis-method",
    title: "Escalate complex one-dimensional stacks",
    message: "Escalate a one-dimensional analysis with more than 10 tolerances for three-dimensional method review.",
    normativeStrength: "must",
    applicability: {
      analysisMethod: "one-dimensional-rss",
      minimumToleranceCountExclusive: 10,
      requiredFacts: ["analysisMethod", "toleranceCount"],
    },
  });
  add("B19:R19", {
    entryId: "method-escalation-three-dimensional-sensitivity",
    entryType: "escalation",
    topic: "analysis-method",
    title: "Escalate three-dimensional sensitivity",
    message: "Escalate a one-dimensional analysis with potential three-dimensional geometry sensitivity for method review.",
    normativeStrength: "must",
    applicability: {
      analysisMethod: "one-dimensional-rss",
      hasThreeDimensionalSensitivity: true,
      requiredFacts: ["analysisMethod", "hasThreeDimensionalSensitivity"],
    },
  });
  add("B19:R19", {
    entryId: "camera-fov-escalation",
    entryType: "escalation",
    topic: "analysis-method",
    title: "Escalate camera FOV clearance",
    message: "Do not evaluate camera FOV clearance with one-dimensional TA; obtain Dimensional Management support.",
    normativeStrength: "must",
    applicability: {
      analysisMethod: "one-dimensional-rss",
      subject: "camera-fov-clearance",
      requiredFacts: ["analysisMethod", "subject"],
    },
  });

  add("B22:R22", {
    entryId: "target-cts-six-sigma",
    entryType: "requirement",
    topic: "sigma-target",
    title: "CTS sigma target",
    message: "Use a 6-sigma target for CTS characteristics.",
    normativeStrength: "must",
    applicability: {
      characteristicClass: "cts",
      requiredFacts: ["characteristicClass"],
    },
  });
  add("B22:R22", {
    entryId: "target-ctf-four-sigma",
    entryType: "requirement",
    topic: "sigma-target",
    title: "CTF sigma target",
    message: "Use a 4-sigma target for CTF characteristics.",
    normativeStrength: "must",
    applicability: {
      characteristicClass: "ctf",
      requiredFacts: ["characteristicClass"],
    },
  });

  add("B25:R33", {
    entryId: "milestone-odm-p0-asr",
    entryType: "milestone",
    topic: "review",
    title: "ODM P0 ASR review",
    message: "Share ODM P0 tolerance analyses for Microsoft review at ASR.",
    normativeStrength: "must",
    applicability: {
      actor: "odm",
      priority: "P0",
      lifecycleStage: "asr",
      requiredFacts: ["actor", "priority", "lifecycleStage"],
    },
  });
  add("B25:R33", {
    entryId: "milestone-odm-p1-asr",
    entryType: "milestone",
    topic: "review",
    title: "ODM P1 ASR review",
    message: "Share ODM P1 tolerance analyses for Microsoft review at ASR.",
    normativeStrength: "must",
    applicability: {
      actor: "odm",
      priority: "P1",
      lifecycleStage: "asr",
      requiredFacts: ["actor", "priority", "lifecycleStage"],
    },
  });
  add("B25:R33", {
    entryId: "milestone-odm-p2-before-tooling",
    entryType: "milestone",
    topic: "review",
    title: "ODM P2 pre-tooling review",
    message: "Share ODM P2 tolerance analyses for Microsoft review before tooling starts.",
    normativeStrength: "must",
    applicability: {
      actor: "odm",
      priority: "P2",
      lifecycleStage: "before-tooling",
      requiredFacts: ["actor", "priority", "lifecycleStage"],
    },
  });
  add("B25:R33", {
    entryId: "milestone-odm-p3-before-tooling",
    entryType: "milestone",
    topic: "review",
    title: "ODM P3 pre-tooling review",
    message: "Share ODM P3 tolerance analyses for Microsoft review before tooling starts.",
    normativeStrength: "must",
    applicability: {
      actor: "odm",
      priority: "P3",
      lifecycleStage: "before-tooling",
      requiredFacts: ["actor", "priority", "lifecycleStage"],
    },
  });
  add("B25:R33", {
    entryId: "requirement-post-build-real-part-data",
    entryType: "requirement",
    topic: "review",
    title: "Update analyses with real-part data",
    message: "After tooling trials or builds, update ODM tolerance analyses with real-part data and share them for review.",
    normativeStrength: "must",
    applicability: {
      actor: "odm",
      lifecycleStage: "after-tooling-trial-or-build",
      requiredFacts: ["actor", "lifecycleStage"],
    },
  });
  add("B25:R33", {
    entryId: "milestone-subsystem-dfm-cts",
    entryType: "milestone",
    topic: "review",
    title: "Subsystem CTS DFM review",
    message: "Share subsystem-supplier CTS characteristics during DFM review.",
    normativeStrength: "must",
    applicability: {
      actor: "subsystem-supplier",
      characteristicClass: "cts",
      lifecycleStage: "dfm",
      requiredFacts: ["actor", "characteristicClass", "lifecycleStage"],
    },
  });
  add("B25:R33", {
    entryId: "milestone-subsystem-dfm-ctf",
    entryType: "milestone",
    topic: "review",
    title: "Subsystem CTF DFM review",
    message: "Share subsystem-supplier CTF characteristics during DFM review.",
    normativeStrength: "must",
    applicability: {
      actor: "subsystem-supplier",
      characteristicClass: "ctf",
      lifecycleStage: "dfm",
      requiredFacts: ["actor", "characteristicClass", "lifecycleStage"],
    },
  });

  add("B12:R12", {
    entryId: "requirement-input-completeness",
    entryType: "requirement",
    topic: "inputs",
    title: "Complete tolerance-analysis inputs",
    message: "Identify the characteristic, loop, factor, dimension ID, part category, nominal, tolerance, sigma level, distribution, and evidence.",
    normativeStrength: "must",
    applicability: {
      actor: "all",
      requiredFacts: ["actor"],
    },
  });
  add("B16:R16", {
    entryId: "requirement-output-completeness",
    entryType: "requirement",
    topic: "outputs",
    title: "Complete tolerance-analysis outputs",
    message: "Identify requirement gaps, contribution drivers, upstream dimensional flow-down, and proposed resolutions.",
    normativeStrength: "must",
    applicability: {
      actor: "all",
      requiredFacts: ["actor"],
    },
  });
  add("B16:R16", {
    entryId: "requirement-gap-ado-notice",
    entryType: "requirement",
    topic: "outputs",
    title: "Record requirement-gap resolution",
    message: "When a requirement gap exists, record its resolution and link the related ADO bug, work item, or task in the summary.",
    normativeStrength: "must",
    applicability: {
      requirementGapPresent: true,
      requiredFacts: ["requirementGapPresent"],
    },
  });
  add("B19:R19", {
    entryId: "warning-priority-review-alignment",
    entryType: "warning",
    topic: "priority",
    title: "Align final analysis priority",
    message: "Align final priority with the Microsoft ME/DM engineer and include NUD risk in the review evidence.",
    normativeStrength: "should",
    applicability: {
      actor: "all",
      requiredFacts: ["actor"],
    },
  });

  add("B12:R12", {
    entryId: "instruction-establish-tolerance-loop",
    entryType: "instruction",
    topic: "tolerance-loop",
    title: "Establish the tolerance loop",
    message: "Establish and evidence the complete tolerance loop before entering factors.",
    normativeStrength: "must",
    applicability: {
      actor: "all",
      requiredFacts: ["actor"],
    },
  });
  add("B36:S37", {
    entryId: "instruction-model-pin-hole-float",
    entryType: "instruction",
    topic: "factor-modeling",
    title: "Model uncontrolled pin-hole float",
    message: "Model uncontrolled pin-hole clearance explicitly using the distribution supported by the physical locating behavior.",
    normativeStrength: "must",
    applicability: {
      factorRepresentation: "pin-hole-float",
      requiredFacts: ["factorRepresentation"],
    },
  });
  add("B36:S37", {
    entryId: "instruction-model-position-half-total",
    entryType: "instruction",
    topic: "factor-modeling",
    title: "Enter position as half the total",
    message: "Enter position tolerance as plus or minus one-half of the indicated total value.",
    normativeStrength: "must",
    applicability: {
      factorRepresentation: "position",
      requiredFacts: ["factorRepresentation"],
    },
  });
  add("B36:S37", {
    entryId: "instruction-model-profile-half-total",
    entryType: "instruction",
    topic: "factor-modeling",
    title: "Enter profile as half the total",
    message: "Enter profile tolerance as plus or minus one-half of the indicated total value.",
    normativeStrength: "must",
    applicability: {
      factorRepresentation: "profile",
      requiredFacts: ["factorRepresentation"],
    },
  });
  add("B36:S37", {
    entryId: "instruction-model-mean-shift",
    entryType: "instruction",
    topic: "factor-modeling",
    title: "Model directional mean shift",
    message: "Set directional mean shift from the supported physical locating behavior rather than an unsupported assumption.",
    normativeStrength: "must",
    applicability: {
      factorRepresentation: "mean-shift",
      requiredFacts: ["factorRepresentation"],
    },
  });
  add("B39:M40", {
    entryId: "instruction-select-capability-distribution",
    entryType: "instruction",
    topic: "factor-modeling",
    title: "Use evidenced process capability",
    message: "Select sigma level and distribution from known process capability rather than an unsupported assumption.",
    normativeStrength: "must",
    applicability: {
      actor: "all",
      requiredFacts: ["actor"],
    },
  });
  add("B39:M40", {
    entryId: "warning-long-term-multiplier-guidance",
    entryType: "warning",
    topic: "factor-modeling",
    title: "Review the long-term multiplier",
    message: "Use a long-term multiplier only when justified; 1.0 to 2.0 is normal guidance and 1.3 to 1.5 is typical, not automatic.",
    normativeStrength: "may",
    applicability: {
      actor: "all",
      requiredFacts: ["actor"],
    },
  });
  add("B39:M40", {
    entryId: "instruction-review-model-output",
    entryType: "instruction",
    topic: "factor-modeling",
    title: "Review model specifications and contributions",
    message: "Populate specification limits and target sigma, then review factor contributions for plausibility and unexpected drivers.",
    normativeStrength: "must",
    applicability: {
      actor: "all",
      requiredFacts: ["actor"],
    },
  });
  add("B45:T47", {
    entryId: "instruction-auto-summary-operations",
    entryType: "instruction",
    topic: "workbook-operation",
    title: "Operate Auto Summary safely",
    message: "In Auto Summary, edit only Comments and Other, refresh generated data after TA changes, and keep TA tab names free of spaces.",
    normativeStrength: "must",
    applicability: {
      workbookArea: "auto-summary",
      requiredFacts: ["workbookArea"],
    },
  });
  add("B45:T47", {
    entryId: "instruction-required-dimensions-operations",
    entryType: "instruction",
    topic: "workbook-operation",
    title: "Operate required-dimensions output safely",
    message: "Generate and refresh Part/Sub Required Dimensions after TA changes; do not edit it manually or treat it as an exhaustive drawing list.",
    normativeStrength: "must",
    applicability: {
      workbookArea: "part-sub-required-dimensions",
      requiredFacts: ["workbookArea"],
    },
  });

  const addDefinition = (sourceRange: string, entryId: string, title: string, message: string): void => {
    add(sourceRange, {
      entryId,
      entryType: "definition",
      topic: "terminology",
      title,
      message,
      normativeStrength: "informational",
      applicability: { requiredFacts: [] },
    });
  };
  addDefinition("B7:B9", "definition-cp", "Cp", "Cp describes potential process capability relative to the specification width.");
  addDefinition("B7:B9", "definition-cpk", "Cpk", "Cpk describes process capability while accounting for process centering.");
  addDefinition("B7:B9", "definition-dimensional-management", "Dimensional Management", "Dimensional Management governs dimensional analysis methods and evidence review.");
  addDefinition("B54:M55", "definition-rss", "RSS", "Root sum square combines independent variation contributors statistically.");
  addDefinition("B54:M55", "definition-sigma-level", "Sigma level", "Sigma level expresses the standard-deviation coverage used for capability evaluation.");
  addDefinition("B54:M55", "definition-standard-deviation", "Standard deviation", "Standard deviation measures the spread of a distribution around its mean.");
  addDefinition("B54:M55", "definition-tolerance-analysis", "Tolerance analysis", "Tolerance analysis evaluates how dimensional variation affects an assembly requirement.");
  addDefinition("B54:M55", "definition-tolerance-loop-path", "Tolerance loop or path", "A tolerance loop or path is the complete dimensional chain controlling a requirement.");
  addDefinition("B54:M55", "definition-three-dimensional-variation-analysis", "Three-dimensional variation analysis", "Three-dimensional variation analysis evaluates geometry-dependent variation in spatial assemblies.");
  addDefinition("B54:M55", "definition-worst-case", "Worst case", "Worst case combines contributors at their limiting conditions without statistical cancellation.");

  const sources = [source];
  const entryTypes = Object.fromEntries(ENTRY_TYPES.map((entryType) => [
    entryType,
    entries.filter((entry) => entry.entryType === entryType).length,
  ])) as Record<ProcessRequirementEntryType, number>;
  const sourcesHash = contentHash(sources);
  const entriesHash = contentHash(entries);
  return {
    manifest: {
      version: "process-requirements-v1",
      classification: "internal",
      releasedAt: "2026-09-09T00:00:00.000Z",
      changeSummary: "Initial reviewed F0 process requirements snapshot.",
      counts: {
        sources: sources.length,
        entries: entries.length,
        entryTypes,
      },
      sourcesHash,
      entriesHash,
      contentHash: contentHash({
        version: "process-requirements-v1",
        sourcesHash,
        entriesHash,
      }),
    },
    sources,
    entries,
  };
}