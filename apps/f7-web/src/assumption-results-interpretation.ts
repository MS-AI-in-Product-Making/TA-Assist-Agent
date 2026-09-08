import type { DeepReadonly } from "vue";
import {
  interpretationRuleLoadRequestSchema,
  type Distribution,
} from "@ai-assist/contracts";
import { loadInterpretationRules } from "@ai-assist/knowledge-base/interpretation-rules";
import {
  buildF7EngineeringNarrative,
  type F7EngineeringNarrative,
} from "@ai-assist/product-language";
import { calculateToleranceAnalysis } from "@ai-assist/workbook-catalog/calculation-kernel";
import type {
  F7DatasetValidationIssue,
  F7SessionSnapshot,
  F7SetupDistribution,
} from "./api/f7-client";

const UNAVAILABLE_REASONS = {
  "prerequisites-unavailable": "Complete and confirm Factor Setup inputs to interpret assumption-based results.",
  "calculation-unavailable": "Assumption-based calculation is unavailable; review Factor Setup values.",
  "rules-unavailable": "F0 interpretation rules are unavailable; do not issue a governed conclusion.",
} as const;
const INTERPRETATION_VERSION = "interpretation-rules-v2" as const;
const PROVENANCE = "F0 interpretation-rules-v2" as const;
const CONCENTRATION_RULE_ID = "root-cause-contributor-concentration" as const;
const ROOT_CAUSE_DISPLAY_ORDER = [
  "root-cause-excessive-variation",
  "root-cause-mean-shift",
  CONCENTRATION_RULE_ID,
] as const;
const ASSUMPTION_DISCLOSURE = "These results are based on confirmed Factor Setup assumptions and RSS analysis; they are not measured or Monte Carlo evidence.";
const CONCENTRATION_DISCLOSURE = "The contributor concentration hypothesis requires engineering validation.";

const REASON_LABELS = {
  subgroup_too_small: "Subgroup too small",
  ordered_sequence_invalid: "Ordered sequence invalid",
  sample_count_below_minimum: "Sample count below minimum",
  exploratory_only: "Exploratory only",
  fit_uncertainty: "Fit uncertainty",
  unit_mismatch: "Unit mismatch",
  specification_missing: "Specification missing",
  non_finite_measurement: "Non-finite measurement",
  duplicate_measurement: "Duplicate measurement",
  msa_evidence_missing: "MSA evidence missing",
  mixed_batch_conditions: "Mixed batch conditions",
  outlier_candidate: "Outlier candidate",
  invalid_rows_rejected: "Invalid rows rejected",
} as const satisfies Readonly<Record<F7DatasetValidationIssue["reason"], string>>;

const DISTRIBUTION_BY_LABEL: Readonly<Record<F7SetupDistribution, Distribution>> = {
  Normal: "normal",
  Uniform: "uniform",
  Triangular: "triangular",
  Trapezoidal: "trapezoidal",
  Elliptical: "elliptical",
  Beta: "beta",
};

const RULE_TITLES = {
  "performance-cpk": "Cpk meets target",
  "performance-cpk-below-target": "Cpk below target",
  "root-cause-excessive-variation": "RC01 Excessive variation hypothesis",
  "root-cause-mean-shift": "RC02 Mean shift hypothesis",
  "root-cause-contributor-concentration": "RC03 Contributor concentration hypothesis",
  "improvement-reduce-variation": "Reduce total variation",
  "improvement-center-mean": "Center the process mean",
  "improvement-reduce-contributor": "Reduce the dominant contributor",
} as const;

type ControlledRuleId = keyof typeof RULE_TITLES;

export interface InputReadinessIssue {
  readonly key: string;
  readonly factorId: string;
  readonly factorName: string;
  readonly label: string;
  readonly rowNumbers: readonly number[];
}

export interface InputReadiness {
  readonly evaluatedFactorCount: number;
  readonly unevaluatedFactorNames: readonly string[];
  readonly blockingIssues: readonly InputReadinessIssue[];
  readonly advisoryIssues: readonly InputReadinessIssue[];
}

export type AssumptionResultsInterpretation =
  | {
      readonly status: "available";
      readonly capability: {
        readonly status: "meets-target" | "below-target";
        readonly cpk: number;
        readonly targetCpk: number;
        readonly statement: string;
      };
      readonly dominantContributors: readonly {
        readonly factorName: string;
        readonly reference: string;
        readonly contributionPercent: number;
      }[];
      readonly concentrationHypothesisMatched: boolean;
      readonly engineeringInterpretations: readonly string[];
      readonly improvementOptions: readonly string[];
      readonly validationRequirements: readonly string[];
      readonly assumptions: readonly string[];
      readonly inputReadiness: InputReadiness;
      readonly narrative: F7EngineeringNarrative;
      readonly provenance: typeof PROVENANCE;
    }
  | {
      readonly status: "unavailable";
      readonly kind: keyof typeof UNAVAILABLE_REASONS;
      readonly reason: string;
      readonly assumptions: readonly string[];
      readonly inputReadiness: InputReadiness;
    };

function unavailable(
  kind: keyof typeof UNAVAILABLE_REASONS,
  inputReadiness: InputReadiness,
): AssumptionResultsInterpretation {
  return {
    status: "unavailable",
    kind,
    reason: UNAVAILABLE_REASONS[kind],
    assumptions: [],
    inputReadiness,
  };
}

function aggregateIssues(
  session: DeepReadonly<F7SessionSnapshot>,
  kind: "blocking" | "advisory",
): readonly InputReadinessIssue[] {
  const entries = new Map<string, InputReadinessIssue>();

  for (const factor of session.factors) {
    const issues = kind === "blocking"
      ? factor.datasetValidation?.blockingIssues ?? []
      : factor.datasetValidation?.advisoryIssues ?? [];
    for (const issue of issues) {
      const factorId = issue.factorId
        ?? factor.evidence?.factorId
        ?? factor.factorCandidate.factorCandidateId;
      const rowNumbers = [...(issue.rowNumbers ?? [])].sort((left, right) => left - right);
      const key = [kind, factorId, issue.reason, rowNumbers.join(",")].join(":");
      if (!entries.has(key)) {
        entries.set(key, {
          key,
          factorId,
          factorName: factor.evidence?.factorName ?? factor.factorCandidate.factorName,
          label: REASON_LABELS[issue.reason],
          rowNumbers,
        });
      }
    }
  }

  return [...entries.values()];
}

function buildInputReadiness(session: DeepReadonly<F7SessionSnapshot>): InputReadiness {
  return {
    evaluatedFactorCount: session.factors.filter((factor) => factor.datasetValidation !== undefined).length,
    unevaluatedFactorNames: session.factors
      .filter((factor) => factor.datasetValidation === undefined)
      .map((factor) => factor.evidence?.factorName ?? factor.factorCandidate.factorName),
    blockingIssues: aggregateIssues(session, "blocking"),
    advisoryIssues: aggregateIssues(session, "advisory"),
  };
}

function isControlledRuleId(entryId: string): entryId is ControlledRuleId {
  return Object.prototype.hasOwnProperty.call(RULE_TITLES, entryId);
}

function controlledTitle(entryId: string): string {
  if (!isControlledRuleId(entryId)) throw new Error("Unsupported interpretation rule.");
  return RULE_TITLES[entryId];
}

export function buildAssumptionResultsInterpretation(
  session: DeepReadonly<F7SessionSnapshot>,
): AssumptionResultsInterpretation {
  const inputReadiness = buildInputReadiness(session);
  const specification = session.systemSpecification;
  if (
    session.factors.length === 0
    || session.factors.some((factor) => (
      factor.setup?.confirmed !== true || factor.evidence === undefined
    ))
    || specification?.status !== "available"
    || specification.designNominal.status !== "available"
    || specification.lowerSpecLimit.status !== "available"
    || specification.upperSpecLimit.status !== "available"
    || specification.targetSigmaLevel.status !== "available"
    || specification.additionalMeanShift.status !== "available"
  ) {
    return unavailable("prerequisites-unavailable", inputReadiness);
  }

  const systemValues = [
    specification.designNominal.actualValue,
    specification.lowerSpecLimit.actualValue,
    specification.upperSpecLimit.actualValue,
    specification.targetSigmaLevel.actualValue,
    specification.additionalMeanShift.actualValue,
  ];
  if (
    systemValues.some((value) => !Number.isFinite(value))
    || specification.targetSigmaLevel.actualValue <= 0
    || specification.lowerSpecLimit.actualValue >= specification.upperSpecLimit.actualValue
  ) {
    return unavailable("prerequisites-unavailable", inputReadiness);
  }

  const shift = specification.additionalMeanShift.valueOrigin === "defaulted"
    ? 0
    : specification.additionalMeanShift.actualValue;
  const factors = session.factors.map((factor) => {
    const evidence = factor.evidence!;
    return {
      source: {
        worksheetName: evidence.worksheetName,
        tableId: evidence.tableId,
        sourceRow: evidence.sourceRow,
      },
      name: evidence.factorName,
      unit: evidence.unit,
      input: {
        nominalValue: evidence.designNominal,
        upperTolerance: evidence.upperTolerance,
        lowerTolerance: evidence.lowerTolerance,
        longTermSafetyFactor: evidence.longTermSafetyFactor,
        sigmaLevel: evidence.sigmaLevel,
        distribution: DISTRIBUTION_BY_LABEL[evidence.distribution],
      },
    };
  });
  const targetCpk = specification.targetSigmaLevel.actualValue / 3;
  const targetSource = specification.targetSigmaLevel.valueOrigin === "defaulted" ? "template" : "project";
  let calculation: ReturnType<typeof calculateToleranceAnalysis>;
  try {
    calculation = calculateToleranceAnalysis({
      factors,
      system: {
        designNominal: factors.reduce((total, factor) => total + factor.input.nominalValue, 0),
        lowerSpecLimit: specification.lowerSpecLimit.actualValue,
        upperSpecLimit: specification.upperSpecLimit.actualValue,
        targetSigmaLevel: specification.targetSigmaLevel.actualValue,
        targetCpk,
        shift,
      },
    });
  } catch {
    return unavailable("calculation-unavailable", inputReadiness);
  }

  const contributors = calculation.factors
    .map((factor) => ({
      factorName: factor.name,
      reference: JSON.stringify([
        factor.source.worksheetName,
        factor.source.tableId,
        factor.source.sourceRow,
      ]),
      contributionPercent: factor.contribution * 100,
    }))
    .sort((left, right) => (
      right.contributionPercent - left.contributionPercent
      || (left.reference === right.reference ? 0 : left.reference < right.reference ? -1 : 1)
    ));

  try {
    const loadRequest = interpretationRuleLoadRequestSchema.parse({ version: INTERPRETATION_VERSION });
    const evaluation = loadInterpretationRules(loadRequest).evaluateInterpretationRules({
      analysisDimension: "one-dimensional",
      method: "rss",
      facts: {
        cp: calculation.capability.cp,
        cpk: calculation.capability.cpk,
        targetCpk: { value: targetCpk, source: targetSource },
        mean: calculation.system.mean,
        lowerSpecLimit: calculation.capability.lowerSpecLimit,
        upperSpecLimit: calculation.capability.upperSpecLimit,
        contributors: contributors.map(({ reference, contributionPercent }) => ({
          reference,
          contributionPercent,
        })),
      },
    });
    if (evaluation.status !== "matched"
      || evaluation.knowledgeBaseVersion !== INTERPRETATION_VERSION
      || evaluation.resolvedTargets?.cpk?.value !== targetCpk
      || evaluation.resolvedTargets.cpk.source !== targetSource) {
      return unavailable("rules-unavailable", inputReadiness);
    }
    for (const rule of evaluation.matchedRules) controlledTitle(rule.entryId);

    const performanceRules = evaluation.matchedRules.filter((rule) => rule.entryType === "performance-rule");
    if (performanceRules.length !== 1) return unavailable("rules-unavailable", inputReadiness);
    const performanceRule = performanceRules[0]!;
    const capabilityStatus = performanceRule.entryId === "performance-cpk"
      ? "meets-target"
      : performanceRule.entryId === "performance-cpk-below-target"
        ? "below-target"
        : undefined;
    if (capabilityStatus === undefined) return unavailable("rules-unavailable", inputReadiness);

    const rootCauseRules = evaluation.matchedRules.filter((rule) => rule.entryType === "root-cause-signal");
    const improvementRules = evaluation.matchedRules.filter((rule) => rule.entryType === "improvement-option");
    const concentrationMatched = rootCauseRules.some((rule) => rule.entryId === CONCENTRATION_RULE_ID);
    const engineeringInterpretations = ROOT_CAUSE_DISPLAY_ORDER
      .filter((entryId) => rootCauseRules.some((rule) => rule.entryId === entryId))
      .map(controlledTitle);
    const narrative = buildF7EngineeringNarrative({
      evidenceBasis: "assumption",
      method: "rss",
      cp: calculation.capability.cp,
      cpk: calculation.capability.cpk,
      targetCpk,
      mean: calculation.system.mean,
      lowerSpecLimit: calculation.capability.lowerSpecLimit,
      upperSpecLimit: calculation.capability.upperSpecLimit,
      rootCauseRules: rootCauseRules.map((rule) => ({ ruleId: rule.entryId, title: rule.title })),
      controlledOptions: improvementRules.map((rule) => ({
        ruleId: rule.entryId,
        title: rule.title,
        validationSteps: rule.validationSteps ?? [],
      })),
      contributors: contributors.map(({ factorName, reference, contributionPercent }) => ({
        name: factorName,
        reference,
        contributionPercent,
      })),
      knowledgeBaseVersion: evaluation.knowledgeBaseVersion,
    });

    return {
      status: "available",
      capability: {
        status: capabilityStatus,
        cpk: calculation.capability.cpk,
        targetCpk,
        statement: controlledTitle(performanceRule.entryId),
      },
      dominantContributors: concentrationMatched
        ? contributors
            .slice(0, 1)
            .map(({ factorName, reference, contributionPercent }) => ({ factorName, reference, contributionPercent }))
        : [],
      concentrationHypothesisMatched: concentrationMatched,
      engineeringInterpretations,
      improvementOptions: improvementRules.map((rule) => controlledTitle(rule.entryId)),
      validationRequirements: [...new Set(improvementRules.flatMap((rule) => rule.validationSteps ?? []))],
      assumptions: concentrationMatched
        ? [ASSUMPTION_DISCLOSURE, CONCENTRATION_DISCLOSURE]
        : [ASSUMPTION_DISCLOSURE],
      inputReadiness,
      narrative,
      provenance: PROVENANCE,
    };
  } catch {
    return unavailable("rules-unavailable", inputReadiness);
  }
}