import { loadProcessRequirements } from "@ai-assist/knowledge-base/process-requirements";
import type { ProcessRequirementEntry, ProcessRequirementMatchedEntry } from "@ai-assist/contracts";
import type { DeepReadonly } from "vue";
import type { F7SessionSnapshot } from "./api/f7-client";

const VERSION = "process-requirements-v1" as const;
type ProcessRequirementEvaluator = ReturnType<typeof loadProcessRequirements>["evaluateProcessRequirements"];
type ProcessRequirementLister = ReturnType<typeof loadProcessRequirements>["listProcessRequirements"];

export interface F0ProcessGuidanceEntry extends ProcessRequirementMatchedEntry {
  readonly state: "guidance" | "warning";
}

export type F0ProcessGuidance =
  | {
    readonly status: "available";
    readonly version: typeof VERSION;
    readonly entries: readonly F0ProcessGuidanceEntry[];
  }
  | {
    readonly status: "unavailable";
    readonly entries: readonly [];
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

    const facts = {
      actor: "all",
      analysisMethod: "one-dimensional-rss",
      toleranceCount: session.factors.length,
      ...(requirementGapPresent === undefined ? {} : { requirementGapPresent }),
    } as const;
    const evaluation = knowledge.evaluateProcessRequirements(facts);
    const matchedEntryIds = new Set(evaluation.matchedEntries.map(({ entryId }) => entryId));
    const availableFacts = new Set(Object.keys(facts));
    const entries = knowledge.listProcessRequirements({})
      .filter((entry) => entry.entryType !== "definition")
      .filter((entry) => entry.applicability.requiredFacts.every((fact) => availableFacts.has(fact)))
      .map((entry) => toGuidanceEntry(entry, matchedEntryIds));

    return {
      status: "available",
      version: VERSION,
      entries,
    };
  } catch {
    return {
      status: "unavailable",
      entries: [],
    };
  }
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
