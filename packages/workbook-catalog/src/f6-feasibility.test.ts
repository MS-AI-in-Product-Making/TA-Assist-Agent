import {
  f6CostEvidenceSchema,
  f6DatumEvidenceSchema,
  f6FeasibilityAssessmentSchema,
  f6OptionSchema,
  f6SupplierCapabilityEvidenceSchema,
  type F6CostEvidence,
  type F6DatumEvidence,
  type F6SupplierCapabilityEvidence,
} from "@ai-assist/contracts";
import { describe, expect, it } from "vitest";
import {
  assessCost,
  assessDatumScenario,
  assessSupplierScenario,
  assessToleranceFeasibility,
} from "./f6-feasibility.js";

const HASH = "a".repeat(64);

function supplierEvidence(overrides: Partial<F6SupplierCapabilityEvidence> = {}): F6SupplierCapabilityEvidence {
  return {
    evidenceVersion: "supplier-capability-v1",
    supplierReference: "supplier-a",
    processFamily: "machining",
    partCategory: "housing",
    capabilityTier: "T1",
    achievableToleranceBand: 0.2,
    distribution: "normal",
    source: "evidence/supplier-a.json",
    effectiveVersion: "v1",
    contentHash: HASH,
    ...overrides,
  };
}

function datumEvidence(overrides: Partial<F6DatumEvidence> = {}): F6DatumEvidence {
  return {
    evidenceVersion: "datum-strategy-v1",
    datumFace: "A",
    stackStart: "A",
    factorDirections: [{ tableId: "table-a", sourceRow: 2, direction: 1 }],
    datumChainEdges: [{ from: "A", to: "B" }],
    crossSubsystemRelations: [],
    drawingEvidence: ["evidence/drawing-a.pdf"],
    reviewStatus: "confirmed",
    source: "evidence/datum-a.json",
    effectiveVersion: "v1",
    contentHash: HASH,
    ...overrides,
  };
}

function costEvidence(): F6CostEvidence {
  return {
    evidenceVersion: "cost-model-v1",
    model: "relative-cost",
    unit: "points",
    optionCosts: [
      { optionKind: "improve_supplier_capability", cost: 40 },
      { optionKind: "tighten_datum_strategy", cost: 25 },
    ],
    roiPolicyVersion: "roi-v2",
    roiCalculationReference: { artifact: "policies/roi-v2.json", contentHash: HASH },
    source: "evidence/cost-model.json",
    effectiveVersion: "v3",
    contentHash: HASH,
  };
}

describe("F6 capability and evidence feasibility gates", () => {
  it("derives T1 feasibility from governed evidence at the exact boundary", () => {
    const evidence = supplierEvidence();
    const boundary = assessToleranceFeasibility({
      requestedToleranceBand: 0.2,
      evidence,
    });
    const beyondBound = assessToleranceFeasibility({
      requestedToleranceBand: 0.199,
      evidence,
    });

    expect(boundary).toEqual({
      status: "supported",
      reasonCodes: ["t1_governed_bound_satisfied"],
      evidenceReferences: ["evidence/supplier-a.json"],
    });
    expect(beyondBound.status).toBe("not_supported");
    expect(f6FeasibilityAssessmentSchema.parse(boundary)).toEqual(boundary);
    expect(f6FeasibilityAssessmentSchema.parse(beyondBound)).toEqual(beyondBound);
  });

  it.each([
    ["T2", "t2_requires_engineering_review"],
    ["T3", "t3_empirical_requires_engineering_review"],
  ] as const)("never gives governed tier %s a definite manufacturability conclusion", (capabilityTier, reasonCode) => {
    const result = assessToleranceFeasibility({
      requestedToleranceBand: 0.3,
      evidence: supplierEvidence({ capabilityTier }),
    });

    expect(result.status).toBe("requires_engineering_review");
    expect(result.reasonCodes).toContain(reasonCode);
  });

  it("does not trust loose capability fields without governed evidence", () => {
    const result = assessToleranceFeasibility({
      requestedToleranceBand: 0.3,
      capabilityTier: "T1",
      achievableToleranceBand: 0.2,
    } as Parameters<typeof assessToleranceFeasibility>[0] & {
      capabilityTier: "T1";
      achievableToleranceBand: number;
    });

    expect(result.status).toBe("insufficient_evidence");
  });

  it("rejects tampered governed capability evidence", () => {
    const result = assessToleranceFeasibility({
      requestedToleranceBand: 0.2,
      evidence: supplierEvidence({ contentHash: "tampered" }),
    });

    expect(result.status).toBe("insufficient_evidence");
    expect(result.evidenceReferences).toEqual([]);
  });

  it("fails closed for governed T0 capability", () => {
    const result = assessToleranceFeasibility({
      requestedToleranceBand: 0.3,
      evidence: supplierEvidence({ capabilityTier: "T0" }),
    });

    expect(result.status).toBe("insufficient_evidence");
  });

  it.each([
    ["T0", Number.NaN],
    ["T0", -0.1],
    ["T1", Number.NaN],
    ["T1", -0.1],
    ["T2", Number.NaN],
    ["T2", -0.1],
    ["T3", Number.NaN],
    ["T3", -0.1],
  ] as const)(
    "rejects governed tier %s with invalid requested tolerance band %s",
    (capabilityTier, requestedToleranceBand) => {
      const result = assessToleranceFeasibility({
        requestedToleranceBand,
        evidence: supplierEvidence({ capabilityTier }),
      });

      expect(result).toEqual({
        status: "insufficient_evidence",
        reasonCodes: ["invalid_requested_tolerance_band"],
        evidenceReferences: ["evidence/supplier-a.json"],
      });
      expect(f6FeasibilityAssessmentSchema.parse(result)).toEqual(result);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.evidenceReferences)).toBe(true);
    },
  );

  it("does not turn internal guidance alone into a controlled rejection", () => {
    const result = assessToleranceFeasibility({
      requestedToleranceBand: 0.1,
      guidanceStatus: "internal_guidance_exceeded",
    });

    expect(result.status).toBe("insufficient_evidence");
    expect(result.status).not.toBe("not_supported");
    expect(result.reasonCodes).toContain("internal_guidance_exceeded_without_t1_bound");
  });

  it("returns a strict evidence-limited supplier option when evidence is missing or malformed", () => {
    const missing = assessSupplierScenario({});
    const malformed = assessSupplierScenario({
      evidence: { ...supplierEvidence(), contentHash: "bad" },
    });

    for (const result of [missing, malformed]) {
      expect(result.option.status).toBe("insufficient_evidence");
      expect(result.option.predictedImprovement).toBe("insufficient_evidence");
      expect(result.option.requiredInputs.length).toBeGreaterThan(0);
      expect(result.option.relativeCost).toBe("insufficient_evidence");
      expect(result.option.roiScore).toBe("not_computed");
      expect(result.feasibility.status).toBe("insufficient_evidence");
      expect(f6OptionSchema.parse(result.option)).toEqual(result.option);
      expect(f6FeasibilityAssessmentSchema.parse(result.feasibility)).toEqual(result.feasibility);
    }
  });

  it("requires a requested tolerance band before assessing governed supplier evidence", () => {
    const evidence = supplierEvidence();
    const result = assessSupplierScenario({ evidence });

    expect(f6SupplierCapabilityEvidenceSchema.parse(evidence)).toEqual(evidence);
    expect(result.option.status).toBe("insufficient_evidence");
    expect(result.option.predictedImprovement).toBe("insufficient_evidence");
    expect(result.option.requiredInputs).toContain("controlled_supplier_scenario_calculation");
    expect(result.option.evidenceReferences).toEqual([
      { artifact: "evidence/supplier-a.json", contentHash: HASH },
    ]);
    expect(result.feasibility).toEqual({
      status: "insufficient_evidence",
      reasonCodes: ["controlled_supplier_scenario_calculation"],
      evidenceReferences: ["evidence/supplier-a.json"],
    });
    expect(f6OptionSchema.parse(result.option)).toEqual(result.option);
    expect(f6FeasibilityAssessmentSchema.parse(result.feasibility)).toEqual(result.feasibility);
  });

  it.each([
    [0.2, "supported", "t1_governed_bound_satisfied"],
    [0.199, "not_supported", "t1_governed_bound_exceeded"],
  ] as const)(
    "assesses a governed T1 supplier scenario with requested band %s as %s",
    (requestedToleranceBand, status, reasonCode) => {
      const evidence = supplierEvidence();
      const result = assessSupplierScenario({ evidence, requestedToleranceBand });

      expect(result.option.status).toBe("insufficient_evidence");
      expect(result.option.predictedImprovement).toBe("insufficient_evidence");
      expect(result.option.evidenceReferences).toEqual([
        { artifact: "evidence/supplier-a.json", contentHash: HASH },
      ]);
      expect(result.feasibility).toEqual({
        status,
        reasonCodes: [reasonCode],
        evidenceReferences: ["evidence/supplier-a.json"],
      });
    },
  );

  it.each([
    ["T2", "requires_engineering_review", "t2_requires_engineering_review"],
    ["T3", "requires_engineering_review", "t3_empirical_requires_engineering_review"],
    ["T0", "insufficient_evidence", "capability_tier_t0"],
  ] as const)(
    "preserves the %s supplier feasibility gate when a requested band is provided",
    (capabilityTier, status, reasonCode) => {
      const result = assessSupplierScenario({
        evidence: supplierEvidence({ capabilityTier }),
        requestedToleranceBand: 0.2,
      });

      expect(result.option.status).toBe("insufficient_evidence");
      expect(result.feasibility.status).toBe(status);
      expect(result.feasibility.reasonCodes).toEqual([reasonCode]);
      expect(result.feasibility.evidenceReferences).toEqual(["evidence/supplier-a.json"]);
    },
  );

  it("fails closed for missing, malformed, or unconfirmed datum evidence", () => {
    const missing = assessDatumScenario({});
    const malformed = assessDatumScenario({ evidence: { ...datumEvidence(), factorDirections: [] } });
    const unconfirmed = assessDatumScenario({ evidence: { ...datumEvidence(), reviewStatus: "pending" } });

    for (const result of [missing, malformed, unconfirmed]) {
      expect(result.option.status).toBe("insufficient_evidence");
      expect(result.option.predictedImprovement).toBe("insufficient_evidence");
      expect(result.feasibility.status).toBe("insufficient_evidence");
      expect(f6OptionSchema.parse(result.option)).toEqual(result.option);
      expect(f6FeasibilityAssessmentSchema.parse(result.feasibility)).toEqual(result.feasibility);
    }
  });

  it("requires engineering review for confirmed datum evidence and produces no numeric delta", () => {
    const evidence = datumEvidence();
    const result = assessDatumScenario({ evidence });

    expect(f6DatumEvidenceSchema.parse(evidence)).toEqual(evidence);
    expect(result.option.status).toBe("insufficient_evidence");
    expect(result.feasibility.status).toBe("requires_engineering_review");
    expect(result.option.predictedImprovement).toBe("insufficient_evidence");
    expect(result.option.requiredInputs).toContain("controlled_datum_scenario_calculation");
    expect(result.option.evidenceReferences).toEqual([
      { artifact: "evidence/datum-a.json", contentHash: HASH },
    ]);
    expect(result.option).not.toHaveProperty("numericDelta");
    expect(f6OptionSchema.parse(result.option)).toEqual(result.option);
    expect(f6FeasibilityAssessmentSchema.parse(result.feasibility)).toEqual(result.feasibility);
  });

  it("returns insufficient cost and ROI without governed evidence", () => {
    const missing = assessCost({ optionKind: "improve_supplier_capability" });
    const malformed = assessCost({
      evidence: { ...costEvidence(), contentHash: "bad" },
      optionKind: "improve_supplier_capability",
    });

    for (const result of [missing, malformed]) {
      expect(result).toEqual({
        relativeCost: "insufficient_evidence",
        roiScore: "not_computed",
        roiPolicyStatus: "insufficient_evidence",
        reasonCodes: ["governed_cost_evidence_missing_or_invalid"],
        evidenceReferences: [],
      });
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.reasonCodes)).toBe(true);
      expect(Object.isFrozen(result.evidenceReferences)).toBe(true);
    }
  });

  it("preserves governed cost and ROI policy evidence when the option is not applicable", () => {
    const result = assessCost({ evidence: costEvidence(), optionKind: "requirement_change" });

    expect(result).toEqual({
      relativeCost: "insufficient_evidence",
      roiScore: "not_computed",
      roiPolicyStatus: "governed_not_computed",
      roiPolicyVersion: "roi-v2",
      roiCalculationReference: { artifact: "policies/roi-v2.json", contentHash: HASH },
      reasonCodes: ["cost_evidence_not_applicable"],
      evidenceReferences: [
        { artifact: "evidence/cost-model.json", contentHash: HASH },
        { artifact: "policies/roi-v2.json", contentHash: HASH },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reasonCodes)).toBe(true);
    expect(Object.isFrozen(result.roiCalculationReference)).toBe(true);
    expect(Object.isFrozen(result.evidenceReferences)).toBe(true);
    expect(Object.isFrozen(result.evidenceReferences[0])).toBe(true);
  });

  it("looks up relative cost and returns governed ROI policy references without computing ROI", () => {
    const evidence = costEvidence();
    const result = assessCost({ evidence, optionKind: "tighten_datum_strategy" });

    expect(f6CostEvidenceSchema.parse(evidence)).toEqual(evidence);
    expect(result).toEqual({
      relativeCost: 25,
      roiScore: "not_computed",
      roiPolicyStatus: "governed_not_computed",
      roiPolicyVersion: "roi-v2",
      roiCalculationReference: { artifact: "policies/roi-v2.json", contentHash: HASH },
      reasonCodes: [],
      evidenceReferences: [
        { artifact: "evidence/cost-model.json", contentHash: HASH },
        { artifact: "policies/roi-v2.json", contentHash: HASH },
      ],
    });
    expect(result.roiScore).toBe("not_computed");
  });

  it("does not mutate inputs and deeply freezes outputs", () => {
    const evidence = costEvidence();
    const snapshot = structuredClone(evidence);
    const result = assessCost({ evidence, optionKind: "improve_supplier_capability" });

    expect(evidence).toEqual(snapshot);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.evidenceReferences)).toBe(true);
    expect(Object.isFrozen(result.roiCalculationReference)).toBe(true);
  });

  it("does not mutate governed evidence and deeply freezes feasibility scenario outputs", () => {
    const evidence = supplierEvidence();
    const snapshot = structuredClone(evidence);
    const tolerance = assessToleranceFeasibility({ requestedToleranceBand: 0.2, evidence });
    const scenario = assessSupplierScenario({ evidence, requestedToleranceBand: 0.2 });

    expect(evidence).toEqual(snapshot);
    expect(Object.isFrozen(tolerance)).toBe(true);
    expect(Object.isFrozen(tolerance.evidenceReferences)).toBe(true);
    expect(Object.isFrozen(scenario)).toBe(true);
    expect(Object.isFrozen(scenario.option)).toBe(true);
    expect(Object.isFrozen(scenario.option.evidenceReferences)).toBe(true);
    expect(Object.isFrozen(scenario.option.evidenceReferences[0])).toBe(true);
    expect(Object.isFrozen(scenario.feasibility)).toBe(true);
  });
});