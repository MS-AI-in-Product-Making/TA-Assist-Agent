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
  it("supports T1 requests at the exact governed boundary and rejects tighter requests", () => {
    const boundary = assessToleranceFeasibility({
      requestedToleranceBand: 0.2,
      capabilityTier: "T1",
      achievableToleranceBand: 0.2,
      evidenceReferences: ["evidence/capability.json"],
    });
    const beyondBound = assessToleranceFeasibility({
      requestedToleranceBand: 0.199,
      capabilityTier: "T1",
      achievableToleranceBand: 0.2,
      evidenceReferences: ["evidence/capability.json"],
    });

    expect(boundary).toEqual({
      status: "supported",
      reasonCodes: ["t1_governed_bound_satisfied"],
      evidenceReferences: ["evidence/capability.json"],
    });
    expect(beyondBound.status).toBe("not_supported");
    expect(f6FeasibilityAssessmentSchema.parse(boundary)).toEqual(boundary);
    expect(f6FeasibilityAssessmentSchema.parse(beyondBound)).toEqual(beyondBound);
  });

  it.each([
    ["T2", "t2_requires_engineering_review"],
    ["T3", "t3_empirical_requires_engineering_review"],
  ] as const)("never gives tier %s a definite manufacturability conclusion", (capabilityTier, reasonCode) => {
    const result = assessToleranceFeasibility({
      requestedToleranceBand: 0.3,
      capabilityTier,
      achievableToleranceBand: 0.2,
      evidenceReferences: ["evidence/capability.json"],
    });

    expect(result.status).toBe("requires_engineering_review");
    expect(result.reasonCodes).toContain(reasonCode);
  });

  it.each([undefined, "T0"] as const)("fails closed for missing or %s capability", (capabilityTier) => {
    const result = assessToleranceFeasibility({
      requestedToleranceBand: 0.3,
      capabilityTier,
      achievableToleranceBand: 0.2,
      evidenceReferences: ["evidence/capability.json"],
    });

    expect(result.status).toBe("insufficient_evidence");
  });

  it("does not turn internal guidance alone into a controlled rejection", () => {
    const result = assessToleranceFeasibility({
      requestedToleranceBand: 0.1,
      guidanceStatus: "internal_guidance_exceeded",
      evidenceReferences: ["guidance/internal.json"],
    });

    expect(result.status).toBe("insufficient_evidence");
    expect(result.status).not.toBe("not_supported");
    expect(result.reasonCodes).toContain("internal_guidance_exceeded_without_t1_bound");
  });

  it("returns a strict evidence-limited supplier option when evidence is missing or malformed", () => {
    const missing = assessSupplierScenario();
    const malformed = assessSupplierScenario({ ...supplierEvidence(), contentHash: "bad" });

    for (const result of [missing, malformed]) {
      expect(result.status).toBe("insufficient_evidence");
      expect(result.predictedImprovement).toBe("insufficient_evidence");
      expect(result.requiredInputs.length).toBeGreaterThan(0);
      expect(result.relativeCost).toBe("insufficient_evidence");
      expect(result.roiScore).toBe("not_computed");
      expect(f6OptionSchema.parse(result)).toEqual(result);
    }
  });

  it("governs strict supplier evidence without inventing numeric improvement", () => {
    const evidence = supplierEvidence();
    const result = assessSupplierScenario(evidence);

    expect(f6SupplierCapabilityEvidenceSchema.parse(evidence)).toEqual(evidence);
    expect(result.status).toBe("requires_engineering_review");
    expect(result.feasibility.status).toBe("requires_engineering_review");
    expect(result.evidenceReferences).toEqual(["evidence/supplier-a.json"]);
    expect(typeof result.predictedImprovement).toBe("string");
    expect(result.predictedImprovement).toBe("controlled_scenario_required");
  });

  it("fails closed for missing, malformed, or unconfirmed datum evidence", () => {
    const missing = assessDatumScenario();
    const malformed = assessDatumScenario({ ...datumEvidence(), factorDirections: [] });
    const unconfirmed = assessDatumScenario({ ...datumEvidence(), reviewStatus: "pending" });

    for (const result of [missing, malformed, unconfirmed]) {
      expect(result.status).toBe("insufficient_evidence");
      expect(result.predictedImprovement).toBe("insufficient_evidence");
      expect(f6OptionSchema.parse(result)).toEqual(result);
    }
  });

  it("requires engineering review for confirmed datum evidence and produces no numeric delta", () => {
    const evidence = datumEvidence();
    const result = assessDatumScenario(evidence);

    expect(f6DatumEvidenceSchema.parse(evidence)).toEqual(evidence);
    expect(result.status).toBe("requires_engineering_review");
    expect(result.feasibility.status).toBe("requires_engineering_review");
    expect(result.predictedImprovement).toBe("controlled_scenario_required");
    expect(result).not.toHaveProperty("numericDelta");
  });

  it("returns insufficient cost and ROI without governed evidence or a matching option", () => {
    expect(assessCost()).toEqual({
      relativeCost: "insufficient_evidence",
      roiScore: "not_computed",
      roiPolicyStatus: "insufficient_evidence",
      evidenceReferences: [],
    });
    expect(assessCost({ evidence: costEvidence(), optionKind: "requirement_change" }).relativeCost)
      .toBe("insufficient_evidence");
    expect(assessCost({ evidence: { ...costEvidence(), contentHash: "bad" }, optionKind: "improve_supplier_capability" }).relativeCost)
      .toBe("insufficient_evidence");
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
      evidenceReferences: ["evidence/cost-model.json", "policies/roi-v2.json"],
    });
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
});