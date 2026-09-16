import { describe, expect, it } from "vitest";
import {
  assumptionResultsPdfRouteRequestSchema,
  type AssumptionResultsPdfRouteRequest,
} from "./assumption-results-pdf-contract.js";

const HASH_A = "a".repeat(64);

function validRequest(): AssumptionResultsPdfRouteRequest {
  return {
    sessionId: "session-1",
    workbookName: "Workbook.xlsx",
    worksheetName: "Sheet 1",
    resultJudgment: {
      status: "below-target",
      headline: "Capability is below target",
    },
    resultSummaryCaption: "Comparison of assumption-based RSS results with system specifications and derived targets",
    summaryRows: [{
      metric: "Mean",
      result: "1.20",
      reference: "1.00",
      difference: "+0.20",
      assessment: "Below target",
      performanceContext: "80% of target",
      tone: "fail",
    }],
    overallAssessment: "Overall capability is below target.",
    rootCauseItems: [{
      title: "Variation hypothesis",
      narrative: "Variation is the primary driver.",
      hypothesisStatus: "hypothesis",
      incompleteEvidence: false,
      quantitativeEvidence: [{
        label: "Cp-Cpk gap",
        value: "0.42",
      }],
    }],
    actionItems: [{
      optionId: "improvement-reduce-variation",
      title: "Reduce total variation",
      narrative: "Prioritize reducing overall variation.",
    }],
    contributors: [{
      factorName: "Factor 01",
      reference: "Anonymous_TA!R15",
      designNominal: 0.03,
      upperTolerance: 0.3,
      lowerTolerance: -0.3,
      contributionPercent: 100,
      cumulativePercent: 100,
    }],
    processGuidanceContext: "Evaluated against the current TA worksheet and analysis state.",
    processGuidance: [{
      state: "guidance",
      title: "Next step",
      message: "Collect measurements.",
    }],
    engineeringEvidence: {
      factorSetup: {
        rows: [{
          itemNumber: 1,
          factorName: "Factor 01",
          designNominal: 0.03,
          upperTolerance: 0.3,
          lowerTolerance: -0.3,
          longTermSafetyFactor: 1,
          sigmaLevel: 3,
          distribution: "Normal",
          mean: 0.03,
          tolerance: 0.3,
          oneSigma: 0.1,
          contributionPercent: 100,
        }],
        footer: {
          designNominalTotal: 0.03,
          upperWorstCaseTolerance: 0.3,
          lowerWorstCaseTolerance: -0.3,
          meanResponse: 0.03,
          rssTolerance: 0.3,
          rssSigma: 0.1,
          contributionTotalPercent: 100,
          additionalMeanShift: 0,
          adjustedMean: 0.03,
        },
      },
      dimensionChain: {
        status: "fallback",
        sourceSignature: JSON.stringify({
          workbookName: "Workbook.xlsx",
          worksheetName: "Sheet 1",
          factorIds: [HASH_A],
        }),
      },
      responseDistribution: {
        mean: 0.03,
        standardDeviation: 0.1,
        lowerSpecLimit: -0.1,
        upperSpecLimit: 0.1,
        target: 0.03,
      },
      responseSummary: {
        rssAndWorstCase: {
          sigmaBands: [{ sigma: 1, tolerance: 0.1, upper: 0.13, lower: -0.07 }],
          worstCase: { tolerance: 0.3, upper: 0.33, lower: -0.27 },
        },
        responseAndSpecifications: {
          designNominal: 0.03,
          meanResponse: 0.03,
          additionalMeanShift: 0,
          adjustedMean: 0.03,
          lowerSpecLimit: -0.1,
          upperSpecLimit: 0.1,
          targetSigmaLevel: 4,
          targetCpk: 1.33,
        },
        sigmaLevelAndCapability: {
          lowerZ: { value: 4, status: "PASS" },
          upperZ: { value: 4, status: "PASS" },
          calculatedSigmaLevel: { value: 4, status: "PASS" },
          cp: { value: 1.33, status: "PASS" },
          lowerCpk: { value: 1.33, status: "PASS" },
          upperCpk: { value: 1.33, status: "PASS" },
          calculatedCpk: { value: 1.33, status: "PASS" },
        },
        defectsPerMillion: {
          lowerDpm: 31.67,
          upperDpm: 31.67,
          totalDpm: 63.34,
          outOfSpecPercent: 0.006334,
          yieldPercent: 99.993666,
        },
      },
    },
  };
}

describe("assumptionResultsPdfRouteRequestSchema priority guidance", () => {
  it("accepts bounded strict optional V3 priority guidance fields and legacy requests without them", () => {
    expect(assumptionResultsPdfRouteRequestSchema.safeParse(validRequest()).success).toBe(true);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityRecommendation: {
        selectedPriority: "P0",
        requiresMeDmAlignment: true,
      },
      priorityDefinitions: [
        { priority: "P0", title: "P0 component priority definition", message: "Priority 0 covers safety-critical components." },
        { priority: "P1", title: "P1 component priority definition", message: "Priority 1 covers key function-fit components." },
        { priority: "P2", title: "P2 component priority definition", message: "Priority 2 covers secondary interfaces." },
        { priority: "P3", title: "P3 component priority definition", message: "Priority 3 covers low-risk components." },
      ],
    }).success).toBe(true);
  });

  it("rejects unknown priorities, false alignment, and unknown fields under strict schemas", () => {
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityRecommendation: {
        selectedPriority: "PX",
        requiresMeDmAlignment: true,
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityRecommendation: {
        selectedPriority: "P1",
        requiresMeDmAlignment: false,
      },
    }).success).toBe(false);

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityDefinitions: [{
        priority: "P0",
        title: "P0 component priority definition",
        message: "Priority 0 covers safety-critical components.",
        unknownField: "unexpected",
      }],
    }).success).toBe(false);
  });
});