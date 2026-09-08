export type F7NarrativeEvidenceBasis = "assumption" | "measured";
export type F7NarrativeMethod = "rss" | "monte-carlo";
export type F7NarrativeKnowledgeBaseVersion = "interpretation-rules-v2";
export type F7NarrativeSpecificationSide = "LSL" | "USL" | "balanced";
export type F7NarrativeJudgmentStatus = "meets-target" | "below-target";

export interface F7NarrativeRule {
  readonly ruleId: string;
  readonly title: string;
}

export interface F7NarrativeOption extends F7NarrativeRule {
  readonly validationSteps: readonly string[];
}

export interface F7NarrativeContributor {
  readonly name: string;
  readonly reference: string;
  readonly contributionPercent: number;
}

export interface BuildF7EngineeringNarrativeInput {
  readonly evidenceBasis: F7NarrativeEvidenceBasis;
  readonly method: F7NarrativeMethod;
  readonly cpk: number;
  readonly targetCpk: number;
  readonly cp?: number;
  readonly mean?: number;
  readonly lowerSpecLimit?: number;
  readonly upperSpecLimit?: number;
  readonly rootCauseRules: readonly F7NarrativeRule[];
  readonly controlledOptions: readonly F7NarrativeOption[];
  readonly contributors: readonly F7NarrativeContributor[];
  readonly knowledgeBaseVersion: F7NarrativeKnowledgeBaseVersion;
}

export interface F7NarrativeResultJudgment {
  readonly status: F7NarrativeJudgmentStatus;
  readonly headline: string;
  readonly judgment: string;
  readonly cpk: number;
  readonly targetCpk: number;
  readonly margin: number;
  readonly nearerSpecificationSide?: F7NarrativeSpecificationSide;
}

export interface F7NarrativeRootCauseItem {
  readonly ruleId: string;
  readonly title: string;
  readonly hypothesisStatus: "hypothesis";
  readonly narrative: string;
  readonly completeEvidence: boolean;
  readonly quantitativeEvidence?: Readonly<Record<string, number | string>>;
}

export interface F7NarrativeActionItem {
  readonly optionId: string;
  readonly title: string;
  readonly narrative: string;
  readonly validationSteps: readonly string[];
}

export interface F7EngineeringNarrative {
  readonly resultJudgment: F7NarrativeResultJudgment;
  readonly engineeringSummary: string;
  readonly rootCauseAnalysis: readonly F7NarrativeRootCauseItem[];
  readonly engineeringRisk: string;
  readonly suggestedActionSequence: readonly F7NarrativeActionItem[];
  readonly validationRequirements: readonly string[];
  readonly evidenceDisclosure: string;
}

const ROOT_CAUSE_ORDER: Readonly<Record<string, number>> = Object.freeze({
  "root-cause-excessive-variation": 0,
  "root-cause-mean-shift": 1,
  "root-cause-contributor-concentration": 2,
});

const ACTION_ORDER: Readonly<Record<string, number>> = Object.freeze({
  "improvement-center-mean": 0,
  "improvement-reduce-variation": 1,
  "improvement-reduce-contributor": 2,
});

const INCOMPLETE_EVIDENCE_MESSAGE = "Evidence is incomplete for this matched hypothesis.";
const BALANCED_DISTANCE_SCALE = Number.EPSILON * 32;

function assertFiniteNumber(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
}

function assertOptionalFiniteNumber(name: string, value: number | undefined): void {
  if (value !== undefined) {
    assertFiniteNumber(name, value);
  }
}

function sortByReadingOrder<T extends { readonly ruleId: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const leftOrder = ROOT_CAUSE_ORDER[left.ruleId] ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = ROOT_CAUSE_ORDER[right.ruleId] ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.ruleId.localeCompare(right.ruleId, "en", { sensitivity: "base" });
  });
}

function sortOptionsBySequence<T extends { readonly ruleId: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const leftOrder = ACTION_ORDER[left.ruleId] ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = ACTION_ORDER[right.ruleId] ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.ruleId.localeCompare(right.ruleId, "en", { sensitivity: "base" });
  });
}

function formatNumber(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formatSignedNumber(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`;
}

function roundToHundredths(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function dedupeStable(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    deduped.push(value);
  }
  return deduped;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) {
      deepFreeze(descriptor.value, seen);
    }
  }
  return Object.freeze(value);
}

function resolveNearestSpecificationSide(
  mean: number | undefined,
  lowerSpecLimit: number | undefined,
  upperSpecLimit: number | undefined,
): F7NarrativeSpecificationSide | undefined {
  if (mean === undefined || lowerSpecLimit === undefined || upperSpecLimit === undefined) {
    return undefined;
  }

  const lowerDistance = mean - lowerSpecLimit;
  const upperDistance = upperSpecLimit - mean;
  const tolerance = BALANCED_DISTANCE_SCALE * Math.max(1, Math.abs(mean), Math.abs(lowerSpecLimit), Math.abs(upperSpecLimit), Math.abs(lowerDistance), Math.abs(upperDistance));
  if (Math.abs(lowerDistance - upperDistance) <= tolerance) {
    return "balanced";
  }
  return lowerDistance < upperDistance ? "LSL" : "USL";
}

function buildResultJudgment(input: BuildF7EngineeringNarrativeInput): F7NarrativeResultJudgment {
  const rawMargin = input.cpk - input.targetCpk;
  const margin = roundToHundredths(rawMargin);
  const status: F7NarrativeJudgmentStatus = margin >= 0 ? "meets-target" : "below-target";
  const headline = margin >= 0 ? "Capability meets target" : "Capability is below target";
  const judgment = `Cpk ${formatNumber(input.cpk)} is ${formatNumber(Math.abs(margin))} ${margin >= 0 ? "above" : "below"} the resolved target of ${formatNumber(input.targetCpk)}.`;
  const nearerSpecificationSide = resolveNearestSpecificationSide(input.mean, input.lowerSpecLimit, input.upperSpecLimit);
  return nearerSpecificationSide === undefined ? {
    status,
    headline,
    judgment,
    cpk: input.cpk,
    targetCpk: input.targetCpk,
    margin,
  } : {
    status,
    headline,
    judgment,
    cpk: input.cpk,
    targetCpk: input.targetCpk,
    margin,
    nearerSpecificationSide,
  };
}

function buildVariationNarrative(input: BuildF7EngineeringNarrativeInput, rule: F7NarrativeRule): F7NarrativeRootCauseItem {
  if (input.cp === undefined) {
    return {
      ruleId: rule.ruleId,
      title: rule.title,
      hypothesisStatus: "hypothesis",
      narrative: INCOMPLETE_EVIDENCE_MESSAGE,
      completeEvidence: false,
    };
  }

  const cpTargetGap = roundToHundredths(input.cp - input.targetCpk);
  return {
    ruleId: rule.ruleId,
    title: rule.title,
    hypothesisStatus: "hypothesis",
    narrative: `Cp is ${formatNumber(input.cp)} versus the target Cpk of ${formatNumber(input.targetCpk)}, a ${formatNumber(Math.abs(cpTargetGap))} ${cpTargetGap >= 0 ? "surplus" : "shortfall"} that indicates variation-related exposure and requires validation.`,
    completeEvidence: true,
    quantitativeEvidence: {
      cp: input.cp,
      targetCpk: input.targetCpk,
      cpTargetGap,
    },
  };
}

function buildMeanShiftNarrative(input: BuildF7EngineeringNarrativeInput, rule: F7NarrativeRule): F7NarrativeRootCauseItem {
  if (
    input.cp === undefined
    || input.mean === undefined
    || input.lowerSpecLimit === undefined
    || input.upperSpecLimit === undefined
  ) {
    return {
      ruleId: rule.ruleId,
      title: rule.title,
      hypothesisStatus: "hypothesis",
      narrative: INCOMPLETE_EVIDENCE_MESSAGE,
      completeEvidence: false,
    };
  }

  const cpCpkGap = roundToHundredths(input.cp - input.cpk);
  const specificationMidpoint = (input.lowerSpecLimit + input.upperSpecLimit) / 2;
  const meanOffset = roundToHundredths(input.mean - specificationMidpoint);
  const direction = resolveNearestSpecificationSide(input.mean, input.lowerSpecLimit, input.upperSpecLimit) === "LSL" ? "LSL" : "USL";
  return {
    ruleId: rule.ruleId,
    title: rule.title,
    hypothesisStatus: "hypothesis",
    narrative: `Cp exceeds Cpk by ${formatNumber(cpCpkGap)} and the mean is ${formatSignedNumber(meanOffset)} from the specification midpoint toward ${direction}, indicating a centering-loss hypothesis that requires validation.`,
    completeEvidence: true,
    quantitativeEvidence: {
      cpCpkGap,
      specificationMidpoint,
      meanOffset,
      direction,
    },
  };
}

function findDominantContributor(contributors: readonly F7NarrativeContributor[]): F7NarrativeContributor | undefined {
  return [...contributors].sort((left, right) => {
    if (left.contributionPercent !== right.contributionPercent) {
      return right.contributionPercent - left.contributionPercent;
    }
    return left.reference.localeCompare(right.reference, "en", { sensitivity: "base" });
  })[0];
}

function buildContributorNarrative(input: BuildF7EngineeringNarrativeInput, rule: F7NarrativeRule): F7NarrativeRootCauseItem {
  const dominantContributor = findDominantContributor(input.contributors);
  if (!dominantContributor) {
    return {
      ruleId: rule.ruleId,
      title: rule.title,
      hypothesisStatus: "hypothesis",
      narrative: INCOMPLETE_EVIDENCE_MESSAGE,
      completeEvidence: false,
    };
  }

  return {
    ruleId: rule.ruleId,
    title: rule.title,
    hypothesisStatus: "hypothesis",
    narrative: `${dominantContributor.name} contributes ${formatNumber(dominantContributor.contributionPercent)}% of the modeled variation, indicating contributor concentration that requires validation against representative evidence.`,
    completeEvidence: true,
    quantitativeEvidence: {
      contributorName: dominantContributor.name,
      contributorReference: dominantContributor.reference,
      contributionPercent: dominantContributor.contributionPercent,
    },
  };
}

function buildRootCauseAnalysis(input: BuildF7EngineeringNarrativeInput): F7NarrativeRootCauseItem[] {
  const sortedRules = sortByReadingOrder(input.rootCauseRules);
  return sortedRules.map((rule) => {
    switch (rule.ruleId) {
      case "root-cause-excessive-variation":
        return buildVariationNarrative(input, rule);
      case "root-cause-mean-shift":
        return buildMeanShiftNarrative(input, rule);
      case "root-cause-contributor-concentration":
        return buildContributorNarrative(input, rule);
      default:
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          hypothesisStatus: "hypothesis",
          narrative: INCOMPLETE_EVIDENCE_MESSAGE,
          completeEvidence: false,
        };
    }
  });
}

function buildSuggestedActions(input: BuildF7EngineeringNarrativeInput): F7NarrativeActionItem[] {
  return sortOptionsBySequence(input.controlledOptions).map((option) => {
    let narrative = `${option.title} requires controlled validation before any downstream decision.`;
    if (option.ruleId === "improvement-center-mean") {
      narrative = "Confirm mean-centering feasibility before changing the process centerline.";
    } else if (option.ruleId === "improvement-reduce-variation") {
      narrative = "Reduce total variation only after representative variation evidence confirms the modeled shortfall.";
    } else if (option.ruleId === "improvement-reduce-contributor") {
      narrative = "Investigate the dominant contributor before changing its tolerance or process controls.";
    }
    return {
      optionId: option.ruleId,
      title: option.title,
      narrative,
      validationSteps: [...option.validationSteps],
    };
  });
}

function buildEngineeringSummary(
  resultJudgment: F7NarrativeResultJudgment,
  rootCauseAnalysis: readonly F7NarrativeRootCauseItem[],
): string {
  if (resultJudgment.status === "meets-target") {
    return `Capability currently meets the resolved target with a margin of ${formatNumber(resultJudgment.margin)}; continue stability verification with representative evidence and ME review.`;
  }

  const completeRules = rootCauseAnalysis.filter((item) => item.completeEvidence).map((item) => item.ruleId);
  if (completeRules.length === 0) {
    return `Capability is below target by ${formatNumber(Math.abs(resultJudgment.margin))}, and enhanced root-cause explanation remains limited by incomplete evidence.`;
  }

  return `Capability is below target by ${formatNumber(Math.abs(resultJudgment.margin))}; the matched governed hypotheses indicate ${completeRules.map((ruleId) => ruleId.replace(/^root-cause-/, "").replace(/-/g, " ")).join(", ")} and require validation before any corrective change.`;
}

function buildEngineeringRisk(
  input: BuildF7EngineeringNarrativeInput,
  resultJudgment: F7NarrativeResultJudgment,
  rootCauseAnalysis: readonly F7NarrativeRootCauseItem[],
): string {
  if (resultJudgment.status === "meets-target") {
    return "The calculated result meets the resolved target and indicates a stable baseline only if representative evidence and ME review confirm the assumptions.";
  }

  const clauses = [`The capability shortfall of ${formatNumber(Math.abs(resultJudgment.margin))} indicates below-target performance`];
  if (resultJudgment.nearerSpecificationSide === "LSL" || resultJudgment.nearerSpecificationSide === "USL") {
    clauses.push(`the mean direction is consistent with nearer exposure toward ${resultJudgment.nearerSpecificationSide}`);
  } else if (resultJudgment.nearerSpecificationSide === "balanced") {
    clauses.push("the mean remains geometrically balanced between the specification limits");
  }
  if (rootCauseAnalysis.some((item) => item.ruleId === "root-cause-excessive-variation" && item.completeEvidence)) {
    clauses.push("RC01 indicates variation-related exposure");
  }
  if (rootCauseAnalysis.some((item) => item.ruleId === "root-cause-mean-shift" && item.completeEvidence)) {
    clauses.push("RC02 indicates centering loss");
  }
  if (rootCauseAnalysis.some((item) => item.ruleId === "root-cause-contributor-concentration" && item.completeEvidence)) {
    clauses.push("RC03 indicates contributor concentration");
  }
  clauses.push("all matched hypotheses require validation");
  return `${clauses.join("; ")}.`;
}

function buildEvidenceDisclosure(
  input: BuildF7EngineeringNarrativeInput,
  rootCauseAnalysis: readonly F7NarrativeRootCauseItem[],
): string {
  const methodLabel = input.method === "rss" ? "RSS" : "Monte Carlo";
  const evidenceLead = input.evidenceBasis === "assumption"
    ? `Assumption-based ${methodLabel} evidence; this is not measured capability evidence.`
    : `Measured ${methodLabel} evidence was supplied for this narrative projection.`;
  const matchedRuleIds = rootCauseAnalysis.map(({ ruleId }) => ruleId).join(", ") || "none";
  return `${evidenceLead} Provenance: ${input.knowledgeBaseVersion}. Matched rule IDs: ${matchedRuleIds}. This output does not replace ME review or F6 optimization.`;
}

export function buildF7EngineeringNarrative(input: BuildF7EngineeringNarrativeInput): F7EngineeringNarrative {
  assertFiniteNumber("cpk", input.cpk);
  assertFiniteNumber("targetCpk", input.targetCpk);
  assertOptionalFiniteNumber("cp", input.cp);
  assertOptionalFiniteNumber("mean", input.mean);
  assertOptionalFiniteNumber("lowerSpecLimit", input.lowerSpecLimit);
  assertOptionalFiniteNumber("upperSpecLimit", input.upperSpecLimit);
  for (const contributor of input.contributors) {
    assertFiniteNumber(`contributors.${contributor.reference}.contributionPercent`, contributor.contributionPercent);
  }

  const resultJudgment = buildResultJudgment(input);
  const rootCauseAnalysis = resultJudgment.status === "meets-target" ? [] : buildRootCauseAnalysis(input);
  const suggestedActionSequence = resultJudgment.status === "meets-target" ? [] : buildSuggestedActions(input);
  const validationRequirements = dedupeStable(suggestedActionSequence.flatMap((item) => item.validationSteps));
  const result: F7EngineeringNarrative = {
    resultJudgment,
    engineeringSummary: buildEngineeringSummary(resultJudgment, rootCauseAnalysis),
    rootCauseAnalysis,
    engineeringRisk: buildEngineeringRisk(input, resultJudgment, rootCauseAnalysis),
    suggestedActionSequence,
    validationRequirements,
    evidenceDisclosure: buildEvidenceDisclosure(input, rootCauseAnalysis),
  };

  return deepFreeze({
    resultJudgment: { ...result.resultJudgment },
    engineeringSummary: result.engineeringSummary,
    rootCauseAnalysis: result.rootCauseAnalysis.map((item) => item.quantitativeEvidence
      ? { ...item, quantitativeEvidence: { ...item.quantitativeEvidence } }
      : { ...item }),
    engineeringRisk: result.engineeringRisk,
    suggestedActionSequence: result.suggestedActionSequence.map((item) => ({
      ...item,
      validationSteps: [...item.validationSteps],
    })),
    validationRequirements: [...result.validationRequirements],
    evidenceDisclosure: result.evidenceDisclosure,
  });
}