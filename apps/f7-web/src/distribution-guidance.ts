import {
  VERSION,
  distributionInterpretationRules,
  validateDistributionInterpretationRules,
  type DistributionInterpretationRule,
} from "@ai-assist/knowledge-base/public-distribution-rules";
import type {
  F7DistributionApproval,
  F7DistributionFitResult,
} from "@ai-assist/contracts";

export type SelectedDistributionResolution =
  | {
      readonly available: true;
      readonly source: "approved" | "proposed";
      readonly candidate: F7DistributionFitResult["candidates"][number];
    }
  | {
      readonly available: false;
      readonly reason: "selection-unavailable" | "selected-candidate-unavailable";
    };

export type MeasuredDistributionInterpretation =
  | {
      readonly available: true;
      readonly status: "available";
      readonly selected: Extract<SelectedDistributionResolution, { available: true }>;
      readonly controlledStatements: readonly string[];
      readonly factualComparisons: readonly string[];
      readonly ruleIds: readonly string[];
      readonly provenanceLabel: string;
    }
  | {
      readonly available: false;
      readonly status: "unavailable";
      readonly reason: "selection-unavailable" | "selected-candidate-unavailable" | "rules-unavailable" | "comparison-unavailable";
    };

export function resolveSelectedDistribution(
  fitResult: F7DistributionFitResult,
  approval: F7DistributionApproval | undefined,
): SelectedDistributionResolution {
  if (approval?.factorId === fitResult.factorId) {
    const approvedCandidate = fitResult.candidates.find(({ family }) => family === approval.family);
    return approvedCandidate
      ? { available: true, source: "approved", candidate: approvedCandidate }
      : { available: false, reason: "selected-candidate-unavailable" };
  }

  if (
    fitResult.selectionDecision.status === "no_acceptable_model"
    || fitResult.selectionDecision.status === "withheld_candidate_failures"
    || !fitResult.selectionDecision.proposedFinalFamily
  ) {
    return { available: false, reason: "selection-unavailable" };
  }

  const proposedCandidate = fitResult.candidates.find(
    ({ family }) => family === fitResult.selectionDecision.proposedFinalFamily,
  );
  return proposedCandidate
    ? { available: true, source: "proposed", candidate: proposedCandidate }
    : { available: false, reason: "selected-candidate-unavailable" };
}

export function buildMeasuredDistributionInterpretation(input: {
  readonly fitResult: F7DistributionFitResult;
  readonly approval?: F7DistributionApproval;
  readonly setup: { readonly mean: number; readonly standardDeviation: number };
  readonly sample: { readonly mean: number; readonly standardDeviation: number };
  readonly rules?: readonly DistributionInterpretationRule[] | null;
}): MeasuredDistributionInterpretation {
  const selected = resolveSelectedDistribution(input.fitResult, input.approval);
  if (!selected.available) {
    return { available: false, status: "unavailable", reason: selected.reason };
  }

  const comparisonValues = [
    input.setup.mean,
    input.setup.standardDeviation,
    input.sample.mean,
    input.sample.standardDeviation,
  ];
  if (
    comparisonValues.some((value) => !Number.isFinite(value))
    || input.setup.standardDeviation <= 0
    || input.sample.standardDeviation < 0
  ) {
    return { available: false, status: "unavailable", reason: "comparison-unavailable" };
  }

  const suppliedRules = input.rules === undefined ? distributionInterpretationRules : input.rules;
  if (!suppliedRules) return { available: false, status: "unavailable", reason: "rules-unavailable" };
  let rules: readonly DistributionInterpretationRule[];
  try {
    rules = validateDistributionInterpretationRules(suppliedRules);
  } catch {
    return { available: false, status: "unavailable", reason: "rules-unavailable" };
  }

  const requiredRules = [
    findRule(rules, "bootstrap-status", selected.candidate.bootstrap.status),
    findRule(rules, "selection-confidence", input.fitResult.selectionDecision.confidence),
    ...(input.fitResult.selectionDecision.reasonCodes.includes("SMALL_SAMPLE_UNCERTAINTY")
      ? [findRule(rules, "selection-reason", "SMALL_SAMPLE_UNCERTAINTY")]
      : []),
    findRule(rules, "interpretation-policy", "compatibility-not-proof"),
  ];
  if (requiredRules.some((rule) => !rule)) {
    return { available: false, status: "unavailable", reason: "rules-unavailable" };
  }

  const matchedRules = requiredRules.filter((rule): rule is DistributionInterpretationRule => rule !== undefined);
  return {
    available: true,
    status: "available",
    selected,
    controlledStatements: matchedRules.map(({ statement }) => statement),
    factualComparisons: [
      formatMeanComparison(input.setup.mean, input.sample.mean),
      formatStandardDeviationComparison(input.setup.standardDeviation, input.sample.standardDeviation),
    ],
    ruleIds: matchedRules.map(({ ruleId }) => ruleId),
    provenanceLabel: `F0 ${VERSION}`,
  };
}

function findRule(
  rules: readonly DistributionInterpretationRule[],
  kind: DistributionInterpretationRule["kind"],
  value: string,
): DistributionInterpretationRule | undefined {
  return rules.find((rule) => rule.kind === kind && (
    "applicableValue" in rule ? rule.applicableValue === value : rule.policyId === value
  ));
}

function formatMeanComparison(setup: number, sample: number): string {
  const delta = sample - setup;
  if (Math.abs(delta) < 0.00005) {
    return `Sample mean matched the Factor Setup value at ${sample.toFixed(4)}.`;
  }
  return `Sample mean ${delta > 0 ? "increased" : "decreased"} from the Factor Setup value of ${setup.toFixed(4)} to ${sample.toFixed(4)} (${formatSigned(delta, 4)}).`;
}

function formatStandardDeviationComparison(setup: number, sample: number): string {
  const relativeChange = (sample - setup) / setup;
  if (Math.abs(relativeChange * 100) < 0.05) {
    return `Sample standard deviation matched the Factor Setup value at ${sample.toFixed(4)}.`;
  }
  return `Sample standard deviation ${relativeChange > 0 ? "increased" : "decreased"} from the Factor Setup value of ${setup.toFixed(4)} to ${sample.toFixed(4)} (${formatSigned(relativeChange * 100, 1)}%).`;
}

function formatSigned(value: number, digits: number): string {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}`;
}
