import { loadProcessRequirements } from "@ai-assist/knowledge-base";
import type { DeepReadonly } from "vue";
import type { F7SessionSnapshot } from "./api/f7-client";

const VERSION = "process-requirements-v1" as const;
type ProcessRequirementEvaluator = ReturnType<typeof loadProcessRequirements>["evaluateProcessRequirements"];
type ProcessRequirementEntries = ReturnType<ProcessRequirementEvaluator>["matchedEntries"];

export type F0ProcessGuidance =
  | {
    readonly status: "available";
    readonly version: typeof VERSION;
    readonly entries: ProcessRequirementEntries;
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

    const evaluation = knowledge.evaluateProcessRequirements({
      actor: "all",
      analysisMethod: "one-dimensional-rss",
      toleranceCount: session.factors.length,
      ...(requirementGapPresent === undefined ? {} : { requirementGapPresent }),
    });

    return {
      status: "available",
      version: VERSION,
      entries: evaluation.matchedEntries,
    };
  } catch {
    return {
      status: "unavailable",
      entries: [],
    };
  }
}
