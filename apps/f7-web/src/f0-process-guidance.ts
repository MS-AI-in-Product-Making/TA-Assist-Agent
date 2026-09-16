import { loadProcessRequirements } from "@ai-assist/knowledge-base/process-requirements";
import {
  processRequirementEntrySchema,
  type ProcessRequirementComponentCategory,
  type ProcessRequirementEntry,
  type ProcessRequirementMatchedEntry,
  type ProcessRequirementPriority,
  type ProcessRequirementPriorityRecommendation,
  type ProcessRequirementProvenance,
} from "@ai-assist/contracts";
import type { DeepReadonly } from "vue";
import type { F7SessionSnapshot } from "./api/f7-client";

const VERSION = "process-requirements-v3" as const;
const PRIORITY_DEFINITION_IDS = [
  ["definition-priority-p0-components", "P0"],
  ["definition-priority-p1-components", "P1"],
  ["definition-priority-p2-components", "P2"],
  ["definition-priority-p3-components", "P3"],
] as const satisfies readonly (readonly [string, ProcessRequirementPriority])[];
const PRIORITY_DEFINITION_EXPECTATIONS = {
  "definition-priority-p0-components": {
    priority: "P0",
    title: "P0 component priority definition",
    message: "Priority 0 covers battery CTS; Z-axis and around-XY clearances; glass/TDM gaps and Z-step; thermal-module critical paths; and PCB critical clearances or alignment.",
    provenance: {
      sourceType: "approved-transcription",
      sourceAlias: "approved-priority-guidance",
      sourceRevision: "user-approved-2026-09-16",
      section: "priority-definitions.p0",
    },
  },
  "definition-priority-p1-components": {
    priority: "P1",
    title: "P1 component priority definition",
    message: "Priority 1 covers fit and functionality of covers, hinges, trackpads, buttons, and sensors, plus cable routing.",
    provenance: {
      sourceType: "approved-transcription",
      sourceAlias: "approved-priority-guidance",
      sourceRevision: "user-approved-2026-09-16",
      section: "priority-definitions.p1",
    },
  },
  "definition-priority-p2-components": {
    priority: "P2",
    title: "P2 component priority definition",
    message: "Priority 2 covers audio jacks, USB ports, kickstands, logos, SSDs, PCB components, screws, pins, hooks, magnets, and engagement or assembly features.",
    provenance: {
      sourceType: "approved-transcription",
      sourceAlias: "approved-priority-guidance",
      sourceRevision: "user-approved-2026-09-16",
      section: "priority-definitions.p2",
    },
  },
  "definition-priority-p3-components": {
    priority: "P3",
    title: "P3 component priority definition",
    message: "Priority 3 covers foams and gaskets used for sealing, cushioning, or noise and vibration reduction.",
    provenance: {
      sourceType: "approved-transcription",
      sourceAlias: "approved-priority-guidance",
      sourceRevision: "user-approved-2026-09-16",
      section: "priority-definitions.p3",
    },
  },
} as const satisfies Readonly<Record<string, {
  readonly priority: ProcessRequirementPriority;
  readonly title: string;
  readonly message: string;
  readonly provenance: {
    readonly sourceType: "approved-transcription";
    readonly sourceAlias: string;
    readonly sourceRevision: string;
    readonly section: string;
  };
}>>;
type ProcessRequirementEvaluator = ReturnType<typeof loadProcessRequirements>["evaluateProcessRequirements"];
type ProcessRequirementLister = ReturnType<typeof loadProcessRequirements>["listProcessRequirements"];

export interface F0ProcessGuidanceEntry extends ProcessRequirementMatchedEntry {
  readonly state: "guidance" | "warning";
}

export interface F0ProcessPriorityDefinition {
  readonly entryId: string;
  readonly priority: ProcessRequirementPriority;
  readonly title: string;
  readonly message: string;
  readonly evidence: ProcessRequirementProvenance;
}

export type F0ProcessGuidance =
  | {
    readonly status: "available";
    readonly version: typeof VERSION;
    readonly entries: readonly F0ProcessGuidanceEntry[];
    readonly priorityDefinitions: readonly F0ProcessPriorityDefinition[];
    readonly priorityRecommendation?: DeepReadonly<ProcessRequirementPriorityRecommendation>;
  }
  | {
    readonly status: "unavailable";
    readonly entries: readonly [];
    readonly priorityDefinitions: readonly [];
  };

type ProcessRequirementLoadRequest = { readonly version: typeof VERSION };

interface LoadedProcessRequirements {
  readonly manifest: {
    readonly version: string;
  };
  readonly listProcessRequirements: ProcessRequirementLister;
  readonly evaluateProcessRequirements: ProcessRequirementEvaluator;
}

interface Dependencies {
  readonly load?: (request: ProcessRequirementLoadRequest) => LoadedProcessRequirements;
}

export function buildF0ProcessGuidance(
  session: DeepReadonly<F7SessionSnapshot>,
  requirementGapPresent?: boolean,
  dependencies: Dependencies = {},
): F0ProcessGuidance {
  try {
    const knowledge = (dependencies.load ?? loadProcessRequirements)({ version: VERSION });
    if (knowledge.manifest.version !== VERSION) {
      throw new Error("Process requirements manifest version mismatch.");
    }

    const componentCategories = [...new Set(session.factors.flatMap((factor) => {
      const evidence = factor.evidence as (typeof factor.evidence & {
        readonly componentCategory?: ProcessRequirementComponentCategory;
      });
      return evidence?.componentCategory === undefined ? [] : [evidence.componentCategory];
    }))].sort(compareAscii);
    const facts = {
      actor: "all",
      analysisMethod: "one-dimensional-rss",
      toleranceCount: session.factors.length,
      ...(requirementGapPresent === undefined ? {} : { requirementGapPresent }),
      ...(componentCategories.length === 0 ? {} : { componentCategories }),
    } as const;
    const evaluation = knowledge.evaluateProcessRequirements(facts);
    if (evaluation.version !== VERSION) {
      throw new Error("Process requirements evaluation version mismatch.");
    }

    const listedEntries = knowledge.listProcessRequirements({});
    if (listedEntries.some((entry) => entry.provenance.effectiveVersion !== VERSION)) {
      throw new Error("Process requirements entry version mismatch.");
    }
    const priorityDefinitions = projectPriorityDefinitions(listedEntries);

    const matchedEntryIds = new Set(evaluation.matchedEntries.map(({ entryId }) => entryId));
    const availableFacts = new Set(Object.keys(facts));
    const entries = listedEntries
      .filter((entry) => entry.entryType !== "definition")
      .filter((entry) => entry.recommendedPriority === undefined)
      .filter((entry) => entry.applicability.requiredFacts.every((fact) => availableFacts.has(fact)))
      .map((entry) => toGuidanceEntry(entry, matchedEntryIds));

    return {
      status: "available",
      version: VERSION,
      entries,
      priorityDefinitions,
      ...(evaluation.status === "matched" && evaluation.priorityRecommendation !== undefined
        ? { priorityRecommendation: evaluation.priorityRecommendation }
        : {}),
    };
  } catch {
    return {
      status: "unavailable",
      entries: [],
      priorityDefinitions: [],
    };
  }
}

function projectPriorityDefinitions(
  entries: DeepReadonly<readonly ProcessRequirementEntry[]>,
): readonly F0ProcessPriorityDefinition[] {
  return PRIORITY_DEFINITION_IDS.map(([entryId, priority]) => {
    const expected = PRIORITY_DEFINITION_EXPECTATIONS[entryId];
    const matches = entries.filter((entry) => entry.entryId === entryId);
    if (matches.length !== 1) throw new Error("Priority definition must be unique and complete.");
    const entry = matches[0];
    if (
      entry === undefined
      || !processRequirementEntrySchema.safeParse(entry).success
      || entry.entryType !== "definition"
      || entry.topic !== "priority"
      || entry.title !== expected.title
      || entry.message !== expected.message
      || entry.provenance.effectiveVersion !== VERSION
      || entry.provenance.sourceType !== expected.provenance.sourceType
      || entry.provenance.sourceAlias !== expected.provenance.sourceAlias
      || entry.provenance.sourceRevision !== expected.provenance.sourceRevision
      || entry.provenance.section !== expected.provenance.section
    ) {
      throw new Error("Priority definition is invalid.");
    }
    return {
      entryId,
      priority,
      title: entry.title,
      message: entry.message,
      evidence: entry.provenance,
    };
  });
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toGuidanceEntry(
  entry: DeepReadonly<ProcessRequirementEntry>,
  matchedEntryIds: ReadonlySet<string>,
): F0ProcessGuidanceEntry {
  const isViolation = matchedEntryIds.has(entry.entryId)
    && (entry.entryType === "escalation" || entry.applicability.requirementGapPresent === true);

  return {
    entryId: entry.entryId,
    entryType: entry.entryType,
    topic: entry.topic,
    title: entry.title,
    message: entry.message,
    normativeStrength: entry.normativeStrength,
    relatedFactReferences: [...entry.applicability.requiredFacts],
    evidence: entry.provenance,
    state: isViolation ? "warning" : "guidance",
  };
}
