import {
  f6CostEvidenceSchema,
  f6DatumEvidenceSchema,
  f6FeasibilityAssessmentSchema,
  f6OptionSchema,
  f6SupplierCapabilityEvidenceSchema,
  f6ToleranceChangeSchema,
  type F6CostEvidence,
  type F6DatumEvidence,
  type F6FeasibilityAssessment,
  type F6Option,
  type F6OptionKind,
  type F6SupplierCapabilityEvidence,
  type F6ToleranceChange,
} from "@ai-assist/contracts";

type CapabilityTier = "T0" | "T1" | "T2" | "T3";
type EvidenceLimitedOption = Extract<F6Option, { status: "insufficient_evidence" }>;

export interface ToleranceFeasibilityInput {
  readonly requestedToleranceBand?: number;
  readonly toleranceChange?: F6ToleranceChange;
  readonly capabilityTier?: CapabilityTier;
  readonly achievableToleranceBand?: number;
  readonly guidanceStatus?: string;
  readonly evidenceReferences?: readonly string[];
}

export interface GovernedEvidenceScenario {
  readonly status: "requires_engineering_review";
  readonly optionKind: "improve_supplier_capability" | "tighten_datum_strategy";
  readonly predictedImprovement: "controlled_scenario_required";
  readonly requiredInputs: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly relativeCost: "insufficient_evidence";
  readonly roiScore: "not_computed";
  readonly impactRank: null;
  readonly requiresEngineeringReview: true;
  readonly feasibility: F6FeasibilityAssessment;
}

export type F6EvidenceScenarioResult = EvidenceLimitedOption | GovernedEvidenceScenario;

export interface CostAssessmentInput {
  readonly evidence?: unknown;
  readonly optionKind?: F6OptionKind;
}

export interface F6CostAssessment {
  readonly relativeCost: number | "insufficient_evidence";
  readonly roiScore: "not_computed";
  readonly roiPolicyStatus: "insufficient_evidence" | "governed_not_computed";
  readonly roiPolicyVersion?: string;
  readonly roiCalculationReference?: F6CostEvidence["roiCalculationReference"];
  readonly evidenceReferences: readonly string[];
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function immutable<Value>(value: Value): Value {
  return deepFreeze(structuredClone(value));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueReferences(references: readonly string[]): string[] {
  return [...new Set(references)].sort(compareText);
}

function feasibility(
  status: F6FeasibilityAssessment["status"],
  reasonCodes: readonly string[],
  evidenceReferences: readonly string[],
): F6FeasibilityAssessment {
  return immutable(f6FeasibilityAssessmentSchema.parse({
    status,
    reasonCodes: [...reasonCodes],
    evidenceReferences: uniqueReferences(evidenceReferences),
  }));
}

function requestedBand(input: ToleranceFeasibilityInput): number | undefined {
  if (input.toleranceChange !== undefined) {
    const parsed = f6ToleranceChangeSchema.safeParse(input.toleranceChange);
    return parsed.success ? parsed.data.resultingBand : undefined;
  }
  return input.requestedToleranceBand;
}

export function assessToleranceFeasibility(input: ToleranceFeasibilityInput): F6FeasibilityAssessment {
  const references = input.evidenceReferences ?? [];
  const requested = requestedBand(input);
  const achievable = input.achievableToleranceBand;
  const validRequested = requested !== undefined && Number.isFinite(requested) && requested >= 0;
  const validAchievable = achievable !== undefined && Number.isFinite(achievable) && achievable >= 0;

  if (input.capabilityTier === undefined || input.capabilityTier === "T0") {
    const reasonCode = input.guidanceStatus === "internal_guidance_exceeded"
      ? "internal_guidance_exceeded_without_t1_bound"
      : "capability_tier_missing_or_t0";
    return feasibility("insufficient_evidence", [reasonCode], references);
  }
  if (input.capabilityTier === "T2") {
    return feasibility("requires_engineering_review", ["t2_requires_engineering_review"], references);
  }
  if (input.capabilityTier === "T3") {
    return feasibility("requires_engineering_review", ["t3_empirical_requires_engineering_review"], references);
  }
  if (!validRequested || !validAchievable) {
    return feasibility("insufficient_evidence", ["t1_governed_bound_incomplete"], references);
  }

  if (requested >= achievable) {
    return feasibility("supported", ["t1_governed_bound_satisfied"], references);
  }
  return feasibility("not_supported", ["t1_governed_bound_exceeded"], references);
}

function insufficientOption(
  optionKind: EvidenceLimitedOption["optionKind"],
  requiredInputs: readonly string[],
  evidenceReferences: readonly F6Option["evidenceReferences"][number][],
): EvidenceLimitedOption {
  return immutable(f6OptionSchema.parse({
    status: "insufficient_evidence",
    optionId: `${optionKind}-evidence-gate`,
    optionKind,
    predictedImprovement: "insufficient_evidence",
    requiredInputs: [...requiredInputs],
    evidenceReferences: [...evidenceReferences],
    relativeCost: "insufficient_evidence",
    roiScore: "not_computed",
    impactRank: null,
  }) as EvidenceLimitedOption);
}

function governedScenario(
  optionKind: GovernedEvidenceScenario["optionKind"],
  source: string,
  reasonCode: string,
): GovernedEvidenceScenario {
  const assessment = feasibility("requires_engineering_review", [reasonCode], [source]);
  return immutable({
    status: "requires_engineering_review",
    optionKind,
    predictedImprovement: "controlled_scenario_required",
    requiredInputs: ["controlled_scenario_inputs", "engineering_review"],
    evidenceReferences: [source],
    relativeCost: "insufficient_evidence",
    roiScore: "not_computed",
    impactRank: null,
    requiresEngineeringReview: true,
    feasibility: assessment,
  });
}

export function assessSupplierScenario(evidence?: unknown): F6EvidenceScenarioResult {
  const parsed = f6SupplierCapabilityEvidenceSchema.safeParse(evidence);
  if (!parsed.success) {
    return insufficientOption(
      "improve_supplier_capability",
      ["confirmed_supplier_capability_evidence", "controlled_scenario_inputs"],
      [],
    );
  }
  return governedScenario(
    "improve_supplier_capability",
    parsed.data.source,
    `supplier_${parsed.data.capabilityTier.toLowerCase()}_evidence_requires_controlled_scenario`,
  );
}

export function assessDatumScenario(evidence?: unknown): F6EvidenceScenarioResult {
  const parsed = f6DatumEvidenceSchema.safeParse(evidence);
  if (!parsed.success) {
    return insufficientOption(
      "tighten_datum_strategy",
      ["confirmed_datum_chain_evidence", "controlled_scenario_inputs"],
      [],
    );
  }
  return governedScenario(
    "tighten_datum_strategy",
    parsed.data.source,
    "confirmed_datum_evidence_requires_engineering_review",
  );
}

function insufficientCost(): F6CostAssessment {
  return immutable({
    relativeCost: "insufficient_evidence",
    roiScore: "not_computed",
    roiPolicyStatus: "insufficient_evidence",
    evidenceReferences: [],
  });
}

function costInput(
  evidenceOrInput: unknown,
  optionKindArgument: F6OptionKind | undefined,
): { readonly evidence: unknown; readonly optionKind: F6OptionKind | undefined } {
  if (evidenceOrInput !== null && typeof evidenceOrInput === "object" && "evidence" in evidenceOrInput) {
    const input = evidenceOrInput as CostAssessmentInput;
    return { evidence: input.evidence, optionKind: input.optionKind ?? optionKindArgument };
  }
  return { evidence: evidenceOrInput, optionKind: optionKindArgument };
}

export function assessCost(
  evidenceOrInput?: F6CostEvidence | CostAssessmentInput | unknown,
  optionKindArgument?: F6OptionKind,
): F6CostAssessment {
  const input = costInput(evidenceOrInput, optionKindArgument);
  const parsed = f6CostEvidenceSchema.safeParse(input.evidence);
  if (!parsed.success) return insufficientCost();

  const optionKind = input.optionKind
    ?? (parsed.data.optionCosts.length === 1 ? parsed.data.optionCosts[0]!.optionKind : undefined);
  const optionCost = parsed.data.optionCosts.find((candidate) => candidate.optionKind === optionKind);
  if (optionCost === undefined) return insufficientCost();

  return immutable({
    relativeCost: optionCost.cost,
    roiScore: "not_computed",
    roiPolicyStatus: "governed_not_computed",
    roiPolicyVersion: parsed.data.roiPolicyVersion,
    roiCalculationReference: parsed.data.roiCalculationReference,
    evidenceReferences: uniqueReferences([
      parsed.data.source,
      parsed.data.roiCalculationReference.artifact,
    ]),
  });
}