import {
  f6CostEvidenceSchema,
  f6DatumEvidenceSchema,
  f6FeasibilityAssessmentSchema,
  f6OptionSchema,
  f6SupplierCapabilityEvidenceSchema,
  type F6CostEvidence,
  type F6FeasibilityAssessment,
  type F6Option,
  type F6OptionKind,
} from "@ai-assist/contracts";

type EvidenceLimitedOption = Extract<F6Option, { status: "insufficient_evidence" }>;
type ArtifactReference = F6Option["evidenceReferences"][number];

export interface ToleranceFeasibilityInput {
  readonly requestedToleranceBand: number;
  readonly evidence?: unknown;
  readonly guidanceStatus?: string;
}

export interface F6EvidenceScenarioResult {
  readonly option: EvidenceLimitedOption;
  readonly feasibility: F6FeasibilityAssessment;
}

export interface SupplierScenarioInput {
  readonly evidence?: unknown;
  readonly requestedToleranceBand?: number;
}

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
  readonly evidenceReferences: readonly ArtifactReference[];
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

function uniquePaths(paths: readonly string[]): string[] {
  return [...new Set(paths)].sort(compareText);
}

function uniqueArtifactReferences(references: readonly ArtifactReference[]): ArtifactReference[] {
  const byIdentity = new Map(references.map((reference) => [
    `${reference.artifact}\u0000${reference.contentHash}`,
    reference,
  ]));
  return [...byIdentity.values()].sort((left, right) =>
    compareText(left.artifact, right.artifact) || compareText(left.contentHash, right.contentHash));
}

function feasibility(
  status: F6FeasibilityAssessment["status"],
  reasonCodes: readonly string[],
  evidenceReferences: readonly string[],
): F6FeasibilityAssessment {
  return immutable(f6FeasibilityAssessmentSchema.parse({
    status,
    reasonCodes: [...reasonCodes],
    evidenceReferences: uniquePaths(evidenceReferences),
  }));
}

function evidenceReference(evidence: { readonly source: string; readonly contentHash: string }): ArtifactReference {
  return { artifact: evidence.source, contentHash: evidence.contentHash };
}

export function assessToleranceFeasibility(input: ToleranceFeasibilityInput): F6FeasibilityAssessment {
  const parsed = f6SupplierCapabilityEvidenceSchema.safeParse(input.evidence);
  if (!parsed.success) {
    const reasonCode = input.guidanceStatus === "internal_guidance_exceeded"
      ? "internal_guidance_exceeded_without_t1_bound"
      : "governed_capability_evidence_missing_or_invalid";
    return feasibility("insufficient_evidence", [reasonCode], []);
  }

  const evidence = parsed.data;
  const references = [evidence.source];
  if (evidence.capabilityTier === "T0") {
    const reasonCode = input.guidanceStatus === "internal_guidance_exceeded"
      ? "internal_guidance_exceeded_without_t1_bound"
      : "capability_tier_t0";
    return feasibility("insufficient_evidence", [reasonCode], references);
  }
  if (evidence.capabilityTier === "T2") {
    return feasibility("requires_engineering_review", ["t2_requires_engineering_review"], references);
  }
  if (evidence.capabilityTier === "T3") {
    return feasibility("requires_engineering_review", ["t3_empirical_requires_engineering_review"], references);
  }
  if (!Number.isFinite(input.requestedToleranceBand) || input.requestedToleranceBand < 0) {
    return feasibility("insufficient_evidence", ["t1_governed_bound_incomplete"], references);
  }

  if (input.requestedToleranceBand >= evidence.achievableToleranceBand) {
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

function scenarioResult(
  optionKind: EvidenceLimitedOption["optionKind"],
  requiredInputs: readonly string[],
  references: readonly ArtifactReference[],
  assessment: F6FeasibilityAssessment,
): F6EvidenceScenarioResult {
  return immutable({
    option: insufficientOption(optionKind, requiredInputs, references),
    feasibility: assessment,
  });
}

function supplierScenarioInput(
  inputOrEvidence: SupplierScenarioInput | unknown,
  requestedToleranceBandArgument: number | undefined,
): { readonly evidence: unknown; readonly requestedToleranceBand: number | undefined } {
  if (inputOrEvidence !== null && typeof inputOrEvidence === "object" && "evidence" in inputOrEvidence) {
    const input = inputOrEvidence as SupplierScenarioInput;
    return {
      evidence: input.evidence,
      requestedToleranceBand: input.requestedToleranceBand ?? requestedToleranceBandArgument,
    };
  }
  return { evidence: inputOrEvidence, requestedToleranceBand: requestedToleranceBandArgument };
}

export function assessSupplierScenario(input?: SupplierScenarioInput): F6EvidenceScenarioResult;
export function assessSupplierScenario(evidence?: unknown, requestedToleranceBand?: number): F6EvidenceScenarioResult;
export function assessSupplierScenario(
  inputOrEvidence?: SupplierScenarioInput | unknown,
  requestedToleranceBandArgument?: number,
): F6EvidenceScenarioResult {
  const input = supplierScenarioInput(inputOrEvidence, requestedToleranceBandArgument);
  const parsed = f6SupplierCapabilityEvidenceSchema.safeParse(input.evidence);
  if (!parsed.success) {
    return scenarioResult(
      "improve_supplier_capability",
      ["confirmed_supplier_capability_evidence", "controlled_scenario_inputs"],
      [],
      feasibility("insufficient_evidence", ["governed_supplier_evidence_missing_or_invalid"], []),
    );
  }

  const reference = evidenceReference(parsed.data);
  const assessment = input.requestedToleranceBand === undefined
    ? feasibility(
      "insufficient_evidence",
      ["controlled_supplier_scenario_calculation"],
      [reference.artifact],
    )
    : assessToleranceFeasibility({
      evidence: parsed.data,
      requestedToleranceBand: input.requestedToleranceBand,
    });
  return scenarioResult(
    "improve_supplier_capability",
    ["controlled_supplier_scenario_calculation"],
    [reference],
    assessment,
  );
}

export function assessDatumScenario(evidence?: unknown): F6EvidenceScenarioResult {
  const parsed = f6DatumEvidenceSchema.safeParse(evidence);
  if (!parsed.success) {
    return scenarioResult(
      "tighten_datum_strategy",
      ["confirmed_datum_chain_evidence", "controlled_scenario_inputs"],
      [],
      feasibility("insufficient_evidence", ["governed_datum_evidence_missing_or_invalid"], []),
    );
  }

  const reference = evidenceReference(parsed.data);
  return scenarioResult(
    "tighten_datum_strategy",
    ["controlled_datum_scenario_calculation", "engineering_review"],
    [reference],
    feasibility(
      "requires_engineering_review",
      ["confirmed_datum_evidence_requires_engineering_review"],
      [reference.artifact],
    ),
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
    evidenceReferences: uniqueArtifactReferences([
      evidenceReference(parsed.data),
      parsed.data.roiCalculationReference,
    ]),
  });
}