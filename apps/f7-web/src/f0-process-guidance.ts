import type { ProcessRequirementMatchedEntry } from "@ai-assist/contracts";
import { loadProcessRequirements } from "@ai-assist/knowledge-base";
import type { DeepReadonly } from "vue";
import type { F7SessionSnapshot } from "./api/f7-client";

const VERSION = "process-requirements-v1" as const;

export type F0ProcessGuidance =
  | {
    readonly status: "available";
    readonly version: typeof VERSION;
    readonly entries: readonly ProcessRequirementMatchedEntry[];
  }
  | {
    readonly status: "unavailable";
    readonly entries: readonly [];
  };

interface Dependencies {
  readonly load?: typeof loadProcessRequirements;
}

export function buildF0ProcessGuidance(
  session: DeepReadonly<F7SessionSnapshot>,
  requirementGapPresent?: boolean,
  dependencies: Dependencies = {},
): F0ProcessGuidance {
  try {
    const evaluation = (dependencies.load ?? loadProcessRequirements)({ version: VERSION })
      .evaluateProcessRequirements({
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

export default buildF0ProcessGuidance;
