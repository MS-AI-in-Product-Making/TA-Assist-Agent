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
type EvidenceScope = NonNullable<EvidenceLimitedOption["evidenceScope"]>;

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

export interface DatumScenarioInput {
  readonly evidence?: unknown;
}

export interface CostAssessmentInput {
  readonly evidence?: unknown;
  readonly optionKind: F6OptionKind;
}

export interface F6CostAssessment {
  readonly relativeCost: number | "insufficient_evidence";
  readonly roiScore: "not_computed";
  readonly roiPolicyStatus: "insufficient_evidence" | "governed_not_computed";
  readonly roiPolicyVersion?: string;
  readonly roiCalculationReference?: F6CostEvidence["roiCalculationReference"];
  readonly reasonCodes: readonly string[];
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
  if (!Number.isFinite(input.requestedToleranceBand) || input.requestedToleranceBand < 0) {
    return feasibility("insufficient_evidence", ["invalid_requested_tolerance_band"], references);
  }
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

  if (input.requestedToleranceBand >= evidence.achievableToleranceBand) {
    return feasibility("supported", ["t1_governed_bound_satisfied"], references);
  }
  return feasibility("not_supported", ["t1_governed_bound_exceeded"], references);
}

function insufficientOption(
  optionKind: EvidenceLimitedOption["optionKind"],
  requiredInputs: readonly string[],
  evidenceReferences: readonly F6Option["evidenceReferences"][number][],
  evidenceScope?: EvidenceScope,
): EvidenceLimitedOption {
  return immutable(f6OptionSchema.parse({
    status: "insufficient_evidence",
    optionId: `${optionKind}-evidence-gate`,
    optionKind,
    predictedImprovement: "insufficient_evidence",
    requiredInputs: [...requiredInputs],
    evidenceReferences: [...evidenceReferences],
    ...(evidenceScope === undefined ? {} : { evidenceScope }),
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
  evidenceScope?: EvidenceScope,
): F6EvidenceScenarioResult {
  return immutable({
    option: insufficientOption(optionKind, requiredInputs, references, evidenceScope),
    feasibility: assessment,
  });
}

export function assessSupplierScenario(input: SupplierScenarioInput): F6EvidenceScenarioResult {
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
    {
      kind: "supplier",
      supplierReference: parsed.data.supplierReference,
      processFamily: parsed.data.processFamily,
      partCategory: parsed.data.partCategory,
      evidenceReference: reference,
    },
  );
}

export function assessDatumScenario(input: DatumScenarioInput): F6EvidenceScenarioResult {
  const parsed = f6DatumEvidenceSchema.safeParse(input.evidence);
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
    {
      kind: "datum",
      factorSources: parsed.data.factorDirections,
      evidenceReference: reference,
    },
  );
}

function governedCostReferences(evidence: F6CostEvidence): ArtifactReference[] {
  return uniqueArtifactReferences([
    evidenceReference(evidence),
    evidence.roiCalculationReference,
  ]);
}

function insufficientCost(reasonCode: string): F6CostAssessment {
  return immutable({
    relativeCost: "insufficient_evidence",
    roiScore: "not_computed",
    roiPolicyStatus: "insufficient_evidence",
    reasonCodes: [reasonCode],
    evidenceReferences: [],
  });
}

export function assessCost(input: CostAssessmentInput): F6CostAssessment {
  const parsed = f6CostEvidenceSchema.safeParse(input.evidence);
  if (!parsed.success) return insufficientCost("governed_cost_evidence_missing_or_invalid");

  const optionCost = parsed.data.optionCosts.find((candidate) => candidate.optionKind === input.optionKind);
  if (optionCost === undefined) {
    return immutable({
      relativeCost: "insufficient_evidence",
      roiScore: "not_computed",
      roiPolicyStatus: "governed_not_computed",
      roiPolicyVersion: parsed.data.roiPolicyVersion,
      roiCalculationReference: parsed.data.roiCalculationReference,
      reasonCodes: ["cost_evidence_not_applicable"],
      evidenceReferences: governedCostReferences(parsed.data),
    });
  }

  return immutable({
    relativeCost: optionCost.cost,
    roiScore: "not_computed",
    roiPolicyStatus: "governed_not_computed",
    roiPolicyVersion: parsed.data.roiPolicyVersion,
    roiCalculationReference: parsed.data.roiCalculationReference,
    reasonCodes: [],
    evidenceReferences: governedCostReferences(parsed.data),
  });
}