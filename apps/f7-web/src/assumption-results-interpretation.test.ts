import { describe, expect, it } from "vitest";
import type { F7SessionSnapshot } from "./api/f7-client";
import { buildAssumptionResultsInterpretation } from "./assumption-results-interpretation";

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
  it("renders coexisting V2 causes, options, and controlled validation requirements", () => {
    const result = buildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());

    expect(result.status).toBe("available");
    if (result.status !== "available") return;
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
  });
});