import { describe, expect, it, vi } from "vitest";
import { createF0CapabilityRouter } from "./f0-capability-router.js";

const internalMatch = {
  status: "within-guidance" as const,
  knowledgeBaseVersion: "internal-v1" as const,
  matchedEntryId: "cnc-linear-6",
  assessedTotalBand: { value: 0.2, unit: "mm" as const },
  maximumRecommendedTotalBand: { value: 0.2, unit: "mm" as const },
  fallbackApplied: false,
  evidence: { sourceFile: "controlled-cnc.xlsx", sourceFileHash: "a".repeat(64), sheetName: "ISO 2768-1 Class m", sourceRange: "A6:F6" },
};

function row(overrides: Partial<{ partCategory: string; factorName: string; partName: string; nominalValue: number; upperTolerance: number; lowerTolerance: number; distribution: string }> = {}) {
  return {
    partCategory: "CNC",
    factorName: "boss height",
    partName: "C-bucket",
    nominalValue: 3.145,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    distribution: "Normal",
    ...overrides,
  };
}

function dependencies(internalResult: unknown = internalMatch) {
  return {
    publicKnowledgeBase: { matchCapabilityItem: vi.fn(() => ({ status: "category_not_defined" as const })) },
    internalGuidance: { assessToleranceGuidance: vi.fn(() => internalResult) },
  };
}

describe("createF0CapabilityRouter", () => {
  it("routes CNC linear dimensions through internal-v1 without copying thresholds", () => {
    const f0 = dependencies();
    const result = createF0CapabilityRouter(f0).assess(row());

    expect(f0.internalGuidance.assessToleranceGuidance).toHaveBeenCalledExactlyOnceWith({
      processFamily: "cnc-machining",
      featureType: "linear-dimension",
      nominalValue: 3.145,
      nominalUnit: "mm",
      tolerance: { representation: "total-band", value: 0.2, unit: "mm" },
    });
    expect(result).toEqual({
      capabilityStatus: "internal_within_guidance",
      f0KnowledgeBaseVersion: "internal-v1",
      recommendation: {
        kind: "internal-guidance",
        assessedTotalBand: 0.2,
        maximumRecommendedTotalBand: 0.2,
        unit: "mm",
        matchedEntryId: "cnc-linear-6",
        fallbackApplied: false,
        evidence: { sourceFileHash: "a".repeat(64), sheetName: "ISO 2768-1 Class m", sourceRange: "A6:F6" },
      },
    });
    expect(f0.publicKnowledgeBase.matchCapabilityItem).not.toHaveBeenCalled();
  });

  it("preserves an explicit fallback selected by the internal F0 API", () => {
    const f0 = dependencies({
      ...internalMatch,
      matchedEntryId: "explicit-fallback",
      assessedTotalBand: { value: 0.18, unit: "mm" as const },
      maximumRecommendedTotalBand: { value: 0.25, unit: "mm" as const },
      fallbackApplied: true,
    });

    expect(createF0CapabilityRouter(f0).assess(row({ upperTolerance: 0.09, lowerTolerance: -0.09 }))).toMatchObject({
      capabilityStatus: "internal_within_guidance",
      recommendation: {
        matchedEntryId: "explicit-fallback",
        assessedTotalBand: 0.18,
        maximumRecommendedTotalBand: 0.25,
        fallbackApplied: true,
      },
    });
    expect(f0.internalGuidance.assessToleranceGuidance).toHaveBeenCalledOnce();
  });

  it("normalizes a negative TA nominal and preserves guidance-exceeded", () => {
    const exceeded = { ...internalMatch, status: "guidance-exceeded" as const, assessedTotalBand: { value: 0.4, unit: "mm" as const } };
    const f0 = dependencies(exceeded);
    const result = createF0CapabilityRouter(f0).assess(row({ nominalValue: -3.145, upperTolerance: 0.2, lowerTolerance: -0.2 }));

    expect(f0.internalGuidance.assessToleranceGuidance).toHaveBeenCalledWith(expect.objectContaining({ nominalValue: 3.145 }));
    expect(result).toMatchObject({ capabilityStatus: "internal_guidance_exceeded", f0KnowledgeBaseVersion: "internal-v1" });
  });

  it.each(["Sheetmetal", "Sheet Metal", "Die Cast", "Diecut", "PCB", "FPC", "Plastic", "Injection Molding"])("reports missing process context for %s without guessing", (partCategory) => {
    const f0 = dependencies();
    const result = createF0CapabilityRouter(f0).assess(row({ partCategory }));

    expect(result).toEqual({ capabilityStatus: "f0_information_insufficient", f0KnowledgeBaseVersion: "internal-v1", f0InformationReason: "missing_process_context" });
    expect(f0.internalGuidance.assessToleranceGuidance).not.toHaveBeenCalled();
    expect(f0.publicKnowledgeBase.matchCapabilityItem).not.toHaveBeenCalled();
  });

  it("keeps explicit public-v1 matches on the public F0 API", () => {
    const f0 = dependencies();
    f0.publicKnowledgeBase.matchCapabilityItem.mockReturnValue({
      status: "matched",
      capabilityEntry: { entryId: "cap-demo-bracket", toleranceMin: 0.1, toleranceMax: 0.3, unit: "mm", recommendedDistribution: "normal" },
    } as never);
    const result = createF0CapabilityRouter(f0).assess(row({ partCategory: "demo-bracket", factorName: "bracket arm", partName: "component", upperTolerance: 0.2, lowerTolerance: 0, distribution: "Normal" }));

    expect(result).toEqual({
      capabilityStatus: "in_library_recommended",
      f0KnowledgeBaseVersion: "v1",
      recommendation: { kind: "public", toleranceMin: 0.1, toleranceMax: 0.3, unit: "mm", distribution: "normal", capabilityEntryId: "cap-demo-bracket" },
    });
    expect(f0.internalGuidance.assessToleranceGuidance).not.toHaveBeenCalled();
  });

  it.each(["Assembly", "Other"])("reports %s as a non-F0 process category", (partCategory) => {
    const f0 = dependencies();
    expect(createF0CapabilityRouter(f0).assess(row({ partCategory }))).toEqual({ capabilityStatus: "non_f0_process_category" });
    expect(f0.publicKnowledgeBase.matchCapabilityItem).toHaveBeenCalledOnce();
    expect(f0.internalGuidance.assessToleranceGuidance).not.toHaveBeenCalled();
  });

  it("reports invalid CNC total bands and unknown F0 guidance without inventing a match", () => {
    const invalidF0 = dependencies();
    expect(createF0CapabilityRouter(invalidF0).assess(row({ upperTolerance: 0, lowerTolerance: 0 }))).toEqual({
      capabilityStatus: "f0_information_insufficient",
      f0KnowledgeBaseVersion: "internal-v1",
      f0InformationReason: "invalid_total_band",
    });
    expect(invalidF0.internalGuidance.assessToleranceGuidance).not.toHaveBeenCalled();

    const unknownF0 = dependencies({ status: "unknown", knowledgeBaseVersion: "internal-v1", capabilityTier: "T0", message: "制程能力未知，请与供应商确认" });
    expect(createF0CapabilityRouter(unknownF0).assess(row())).toEqual({
      capabilityStatus: "f0_information_insufficient",
      f0KnowledgeBaseVersion: "internal-v1",
      f0InformationReason: "guidance_unknown",
    });
  });
});
