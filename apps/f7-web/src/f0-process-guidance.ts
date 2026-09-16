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
    const matches = entries.filter((entry) => entry.entryId === entryId);
    if (matches.length !== 1) throw new Error("Priority definition must be unique and complete.");
    const entry = matches[0];
    if (
      entry === undefined
      || !processRequirementEntrySchema.safeParse(entry).success
      || entry.entryType !== "definition"
      || entry.topic !== "priority"
      || entry.title !== `${priority} component priority definition`
      || entry.provenance.effectiveVersion !== VERSION
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
