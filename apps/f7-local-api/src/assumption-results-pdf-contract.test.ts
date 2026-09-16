import { describe, expect, it } from "vitest";
import { loadProcessRequirements } from "@ai-assist/knowledge-base/process-requirements";
import {
  assumptionResultsPdfRouteRequestSchema,
  type AssumptionResultsPdfRouteRequest,
} from "./assumption-results-pdf-contract.js";

const HASH_A = "a".repeat(64);

function canonicalPriorityDefinitions() {
  const processRequirements = loadProcessRequirements({ version: "process-requirements-v3" });
  return processRequirements
    .listProcessRequirements({ topics: ["priority"], entryTypes: ["definition"] })
    .map((entry) => ({
      priority: entry.title.slice(0, 2) as "P0" | "P1" | "P2" | "P3",
      title: entry.title,
      message: entry.message,
    }));
}

function canonicalPriorityRecommendation() {
  return {
    selectedPriority: "P0" as const,
    requiresMeDmAlignment: true as const,
  };
}

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
  it("accepts canonical definitions-only, canonical recommendation with definitions, and legacy requests", () => {
    const definitions = canonicalPriorityDefinitions();

    expect(assumptionResultsPdfRouteRequestSchema.safeParse(validRequest()).success).toBe(true);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityDefinitions: definitions,
    }).success).toBe(true);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityRecommendation: canonicalPriorityRecommendation(),
      priorityDefinitions: definitions,
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

  it("rejects empty, partial, oversized, duplicate, or unordered priority definitions", () => {
    const definitions = canonicalPriorityDefinitions();

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityDefinitions: [],
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityDefinitions: definitions.slice(0, 3),
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityDefinitions: [...definitions, definitions[0]!],
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityDefinitions: [definitions[0]!, definitions[1]!, definitions[1]!, definitions[3]!],
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityDefinitions: [definitions[1]!, definitions[0]!, definitions[2]!, definitions[3]!],
    }).success).toBe(false);
  });

  it("rejects recommendation without complete definitions and rejects non-canonical title or message content", () => {
    const definitions = canonicalPriorityDefinitions();

    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityRecommendation: canonicalPriorityRecommendation(),
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityRecommendation: canonicalPriorityRecommendation(),
      priorityDefinitions: definitions.map((definition, index) => index === 0
        ? { ...definition, title: "Tampered title" }
        : definition),
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      priorityRecommendation: canonicalPriorityRecommendation(),
      priorityDefinitions: definitions.map((definition, index) => index === 1
        ? { ...definition, message: "Tampered message" }
        : definition),
    }).success).toBe(false);
  });
});