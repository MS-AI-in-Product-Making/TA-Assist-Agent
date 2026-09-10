import { describe, expect, it } from "vitest";
import type { F7SessionSnapshot } from "./api/f7-client";
import { buildAssumptionResultsInterpretation } from "./assumption-results-interpretation";

type NarrativeRuleLike = { readonly ruleId: string };
type NarrativeActionLike = { readonly optionId: string };
type GuidanceEntryLike = { readonly entryId: string };

function enhancedInterpretationSnapshot(): F7SessionSnapshot {
  return {
    systemSpecification: {
      status: "available",
      designNominal: { status: "available", actualValue: 0.03, valueOrigin: "numeric_literal" },
      lowerSpecLimit: { status: "available", actualValue: -0.1, valueOrigin: "numeric_literal" },
      upperSpecLimit: { status: "available", actualValue: 0.1, valueOrigin: "numeric_literal" },
      targetSigmaLevel: { status: "available", actualValue: 4, valueOrigin: "numeric_literal" },
      additionalMeanShift: { status: "available", actualValue: 0, valueOrigin: "defaulted" },
    },
    factors: [{
      factorCandidate: { factorCandidateId: "factor-01", factorName: "Factor 01" },
      setup: { confirmed: true },
      evidence: {
        worksheetName: "Anonymous_TA",
        tableId: "factor-table",
        sourceRow: 1,
        factorName: "Factor 01",
        unit: "mm",
        designNominal: 0.03,
        upperTolerance: 0.3,
        lowerTolerance: -0.3,
        longTermSafetyFactor: 1,
        sigmaLevel: 3,
        distribution: "Normal",
      },
    }],
  } as unknown as F7SessionSnapshot;
}

describe("assumption results enhanced interpretation", () => {
  it("uses the governed system design nominal as the Mean reference", () => {
    const snapshot = enhancedInterpretationSnapshot();
    const specification = snapshot.systemSpecification;
    if (specification?.status !== "available" || specification.designNominal?.status !== "available") {
      throw new Error("expected available specification");
    }

    const result = buildAssumptionResultsInterpretation({
      ...snapshot,
      systemSpecification: {
        ...specification,
        designNominal: { ...specification.designNominal, actualValue: 0.04 },
      },
    });

    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(result.resultSummary[0]).toMatchObject({
      key: "mean",
      reference: "Nominal 0.04",
      referenceDetail: "System Design Nominal",
    });
  });

  it("renders coexisting V2 causes, options, and controlled validation requirements", () => {
    const result = buildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());

    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(result.narrative.resultJudgment.headline).toBe("Capability is below target");
    expect(result.narrative.resultJudgment.margin).toBeLessThan(0);
    expect(result.overallAssessment).toMatch(/^Fail\. Mean is centered\. Standard deviation is too high\. Cpk /);
    expect(result.overallAssessment).toMatch(/side capabilit(?:y is|ies are) insufficient/);
    expect(result.resultSummary.map((row) => row.key)).toEqual([
      "mean",
      "standard-deviation",
      "cp",
      "cpk",
      "lower-cpk",
      "upper-cpk",
    ]);
    expect(result.narrative.rootCauseAnalysis.map((item: NarrativeRuleLike) => item.ruleId)).toEqual([
      "root-cause-excessive-variation",
      "root-cause-mean-shift",
      "root-cause-contributor-concentration",
    ]);
    expect(result.narrative.rootCauseAnalysis[1]?.quantitativeEvidence).toMatchObject({
      cpCpkGap: expect.any(Number),
      specificationMidpoint: expect.any(Number),
      meanOffset: expect.any(Number),
      direction: "USL",
    });
    expect(result.narrative.rootCauseAnalysis[2]?.quantitativeEvidence).toMatchObject({
      contributorName: "Factor 01",
      contributionPercent: expect.any(Number),
    });
    expect(result.narrative.engineeringRisk).toMatch(/requires validation/i);
    expect(result.narrative.suggestedActionSequence.map((item: NarrativeActionLike) => item.optionId)).toEqual([
      "improvement-center-mean",
      "improvement-reduce-variation",
      "improvement-reduce-contributor",
    ]);
    expect(result.narrative.evidenceDisclosure).toContain("Assumption-based RSS evidence; this is not measured capability evidence.");
    expect(result.engineeringInterpretations).toEqual([
      "RC01 Excessive variation hypothesis",
      "RC02 Mean shift hypothesis",
      "RC03 Contributor concentration hypothesis",
    ]);
    expect(result.improvementOptions).toEqual([
      "Center the process mean",
      "Reduce the dominant contributor",
      "Reduce total variation",
    ]);
    expect(result.validationRequirements).toContain("Update representative variation evidence.");
    expect(result.validationRequirements).toContain("Confirm physical centering feasibility through ME review.");
    expect(result.validationRequirements).toContain("Validate the dominant contributor evidence before changing its tolerance or process controls.");
    expect(new Set(result.validationRequirements).size).toBe(result.validationRequirements.length);
    expect(result.validationRequirements).toEqual(result.narrative.validationRequirements);
  });

  it("attaches F0 process guidance for enhanced below-target results including requirement gap notice", () => {
    const result = buildAssumptionResultsInterpretation(enhancedInterpretationSnapshot()) as {
      readonly status: string;
      readonly capability?: { readonly status: string };
      readonly processGuidance?: { readonly entries: readonly GuidanceEntryLike[] };
    };

    expect(result.status).toBe("available");
    expect(result.capability?.status).toBe("below-target");
    expect(result.processGuidance?.entries.map((entry) => entry.entryId)).toContain("requirement-gap-ado-notice");
  });

  it("retains worksheet-supported input completeness guidance when prerequisites are unavailable", () => {
    const snapshot = enhancedInterpretationSnapshot();
    const result = buildAssumptionResultsInterpretation({
      ...snapshot,
      systemSpecification: undefined,
    } as unknown as F7SessionSnapshot) as {
      readonly status: string;
      readonly processGuidance?: { readonly entries: readonly GuidanceEntryLike[] };
    };

    expect(result.status).toBe("unavailable");
    expect(result.processGuidance?.entries.map((entry) => entry.entryId)).toContain("requirement-input-completeness");
  });
});