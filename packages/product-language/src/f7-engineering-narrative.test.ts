import { describe, expect, it } from "vitest";

import {
  buildF7EngineeringNarrative,
  type BuildF7EngineeringNarrativeInput,
} from "./f7-engineering-narrative.js";
import { buildF7EngineeringNarrative as buildFromRootExport } from "./index.js";

function combinedCauseInput(): BuildF7EngineeringNarrativeInput {
  return {
    evidenceBasis: "assumption",
    method: "rss",
    cpk: 0.92,
    targetCpk: 1.33,
    cp: 1.18,
    mean: 0.08,
    lowerSpecLimit: -0.5,
    upperSpecLimit: 0.5,
    rootCauseRules: [
      { ruleId: "root-cause-contributor-concentration", title: "RC03 Dominant contributor hypothesis" },
      { ruleId: "root-cause-mean-shift", title: "RC02 Mean shift hypothesis" },
      { ruleId: "root-cause-excessive-variation", title: "RC01 Excessive variation hypothesis" },
    ],
    controlledOptions: [
      {
        ruleId: "improvement-reduce-contributor",
        title: "Reduce the dominant contributor",
        validationSteps: [
          "Validate the dominant contributor evidence before changing its tolerance or process controls.",
          "Recalculate the tolerance stack after the proposed contributor change.",
          "Confirm the improvement with representative data against the unchanged resolved target.",
        ],
      },
      {
        ruleId: "improvement-reduce-variation",
        title: "Reduce total variation",
        validationSteps: [
          "Update representative variation evidence.",
          "Rerun the same RSS or Monte Carlo method with unchanged specifications and target.",
          "Confirm Cp and Cpk meet the resolved target using a new representative sample.",
        ],
      },
      {
        ruleId: "improvement-center-mean",
        title: "Center the process mean",
        validationSteps: [
          "Confirm physical centering feasibility through ME review.",
          "Center toward the specification midpoint while preserving the approved specification.",
          "Rerun the same RSS or Monte Carlo method and confirm Cpk against the unchanged target.",
          "Confirm physical centering feasibility through ME review.",
        ],
      },
    ],
    contributors: [
      { name: "Factor B", reference: "factor-b", contributionPercent: 22 },
      { name: "Factor A", reference: "factor-a", contributionPercent: 46 },
      { name: "Factor C", reference: "factor-c", contributionPercent: 18 },
    ],
    knowledgeBaseVersion: "interpretation-rules-v2",
  };
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item));
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => collectStrings(item));
  }
  return [];
}

function expectRecursivelyFrozen(value: unknown): void {
  if (!value || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  if (Array.isArray(value)) {
    for (const item of value) expectRecursivelyFrozen(item);
    return;
  }
  for (const nested of Object.values(value)) {
    expectRecursivelyFrozen(nested);
  }
}

function expectNoZeroRepresentation(text: string): void {
  expect(text).not.toMatch(/(^|\s|[;(])(?:[+-]?0(?:\.0+)?)(?=$|\s|[;).])/);
}

describe("buildF7EngineeringNarrative", () => {
  it("builds the complete combined-cause narrative in governed reading order", () => {
    const narrative = buildF7EngineeringNarrative(combinedCauseInput());

    expect(narrative.resultJudgment).toMatchObject({
      status: "below-target",
      headline: "Capability is below target",
      cpk: 0.92,
      targetCpk: 1.33,
      nearerSpecificationSide: "USL",
    });
    expect(narrative.resultJudgment.margin).toBeCloseTo(-0.41, 12);
    expect(narrative.rootCauseAnalysis.map(({ ruleId }) => ruleId)).toEqual([
      "root-cause-excessive-variation",
      "root-cause-mean-shift",
      "root-cause-contributor-concentration",
    ]);
    expect(narrative.rootCauseAnalysis[1]).toMatchObject({
      ruleId: "root-cause-mean-shift",
      completeEvidence: true,
      quantitativeEvidence: {
        specificationMidpoint: 0,
        meanOffset: 0.08,
        direction: "USL",
      },
    });
    expect((narrative.rootCauseAnalysis[1]?.quantitativeEvidence as { cpCpkGap?: number } | undefined)?.cpCpkGap).toBeCloseTo(0.26, 12);
    expect(narrative.rootCauseAnalysis[2]).toMatchObject({
      ruleId: "root-cause-contributor-concentration",
      completeEvidence: true,
      quantitativeEvidence: {
        contributorName: "Factor A",
        contributionPercent: 46,
      },
    });
    expect(narrative.suggestedActionSequence.map(({ optionId }) => ({ optionId }))).toEqual([
      { optionId: "improvement-center-mean" },
      { optionId: "improvement-reduce-variation" },
      { optionId: "improvement-reduce-contributor" },
    ]);
    expect(narrative.validationRequirements).toEqual([
      "Confirm physical centering feasibility through ME review.",
      "Center toward the specification midpoint while preserving the approved specification.",
      "Rerun the same RSS or Monte Carlo method and confirm Cpk against the unchanged target.",
      "Update representative variation evidence.",
      "Rerun the same RSS or Monte Carlo method with unchanged specifications and target.",
      "Confirm Cp and Cpk meet the resolved target using a new representative sample.",
      "Validate the dominant contributor evidence before changing its tolerance or process controls.",
      "Recalculate the tolerance stack after the proposed contributor change.",
      "Confirm the improvement with representative data against the unchanged resolved target.",
    ]);
    expect(narrative.evidenceDisclosure).toContain("Assumption-based RSS evidence; this is not measured capability evidence.");
    expect(narrative.evidenceDisclosure).toContain("interpretation-rules-v2");
  });

  it("returns a meets-target judgment without inventing causes or actions", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk: 1.33,
      targetCpk: 1.33,
      cp: 1.33,
      mean: 0,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    });

    expect(narrative.resultJudgment).toMatchObject({
      status: "meets-target",
      headline: "Capability meets target",
      margin: 0,
      nearerSpecificationSide: "balanced",
    });
    expect(narrative.rootCauseAnalysis).toEqual([]);
    expect(narrative.suggestedActionSequence).toEqual([]);
    expect(narrative.engineeringRisk).not.toMatch(/root cause|corrective action/i);
  });

  it("keeps near-target negative raw margin below target even when rounded prose reaches zero", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk: 1.329,
      targetCpk: 1.33,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    });

    expect(narrative.resultJudgment.status).toBe("below-target");
    expect(narrative.resultJudgment.headline).toBe("Capability is below target");
    expect(narrative.resultJudgment.margin).toBeCloseTo(-0.001, 12);
    expect(narrative.resultJudgment.judgment).toBe("Cpk 1.329 is 0.001 below the resolved target of 1.330.");
    expect(narrative.engineeringSummary).toBe(
      "Capability is below target by 0.001, and enhanced root-cause explanation remains limited by incomplete evidence.",
    );
    expect(narrative.engineeringRisk).toContain("The capability shortfall of 0.001 indicates below-target performance");
    expect(narrative.engineeringRisk).not.toContain("shortfall of 0 indicates");
  });

  it("keeps near-target positive raw margin truthful and deterministic in concise prose", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk: 1.331,
      targetCpk: 1.33,
      cp: 1.331,
      mean: 0,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    });

    expect(narrative.resultJudgment.status).toBe("meets-target");
    expect(narrative.resultJudgment.margin).toBeCloseTo(0.001, 12);
    expect(narrative.resultJudgment.judgment).toBe("Cpk 1.331 is 0.001 above the resolved target of 1.330.");
    expect(narrative.engineeringSummary).toBe(
      "Capability currently meets the resolved target with a margin of 0.001; continue stability verification with representative evidence and ME review.",
    );
  });

  it("renders subprecision negative margins without collapsing them to zero prose", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk: 1.3299999,
      targetCpk: 1.33,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    });

    expect(narrative.resultJudgment.status).toBe("below-target");
    expect(narrative.resultJudgment.margin).toBeCloseTo(-1e-7, 12);
    expect(narrative.resultJudgment.judgment).toContain("1e-7 below");
    expect(narrative.resultJudgment.judgment).not.toContain("0 below");
    expect(narrative.engineeringSummary).toContain("below target by 1e-7");
    expect(narrative.engineeringRisk).toContain("shortfall of 1e-7 indicates below-target performance");
    expectNoZeroRepresentation(narrative.resultJudgment.judgment);
    expectNoZeroRepresentation(narrative.engineeringSummary);
    expectNoZeroRepresentation(narrative.engineeringRisk);
  });

  it("renders subprecision positive margins without collapsing them to zero prose", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk: 1.3300001,
      targetCpk: 1.33,
      cp: 1.3300001,
      mean: 0,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    });

    expect(narrative.resultJudgment.status).toBe("meets-target");
    expect(narrative.resultJudgment.margin).toBeCloseTo(1e-7, 12);
    expect(narrative.resultJudgment.judgment).toContain("1e-7 above");
    expect(narrative.resultJudgment.judgment).not.toContain("0 above");
    expect(narrative.engineeringSummary).toContain("margin of 1e-7");
    expectNoZeroRepresentation(narrative.resultJudgment.judgment);
    expectNoZeroRepresentation(narrative.engineeringSummary);
    expectNoZeroRepresentation(narrative.engineeringRisk);
  });

  it("treats equal mean-to-limit distances as balanced within scaled tolerance", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      mean: Number.EPSILON * 8,
      lowerSpecLimit: -1,
      upperSpecLimit: 1,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    });

    expect(narrative.resultJudgment.nearerSpecificationSide).toBe("balanced");
  });

  it("returns incomplete-evidence items when matched hypotheses lack dependent facts", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cp: undefined,
      mean: undefined,
      lowerSpecLimit: undefined,
      upperSpecLimit: undefined,
      contributors: [],
      controlledOptions: [],
    });

    expect(narrative.rootCauseAnalysis).toEqual([
      expect.objectContaining({
        ruleId: "root-cause-excessive-variation",
        completeEvidence: false,
        narrative: "Evidence is incomplete for this matched hypothesis.",
      }),
      expect.objectContaining({
        ruleId: "root-cause-mean-shift",
        completeEvidence: false,
        narrative: "Evidence is incomplete for this matched hypothesis.",
      }),
      expect.objectContaining({
        ruleId: "root-cause-contributor-concentration",
        completeEvidence: false,
        narrative: "Evidence is incomplete for this matched hypothesis.",
      }),
    ]);
  });

  it("preserves raw quantitative values and keeps the output recursively frozen", () => {
    const input = combinedCauseInput();
    const snapshot = structuredClone(input);

    const narrative = buildF7EngineeringNarrative(input);

    expect(narrative.resultJudgment.margin).toBeCloseTo(-0.41, 12);
    expect(narrative.rootCauseAnalysis[0]?.quantitativeEvidence).toMatchObject({
      cp: 1.18,
      targetCpk: 1.33,
    });
    expect((narrative.rootCauseAnalysis[0]?.quantitativeEvidence as { cpTargetGap?: number } | undefined)?.cpTargetGap).toBeCloseTo(-0.15, 12);
    expectRecursivelyFrozen(narrative);
    expect(input).toEqual(snapshot);
  });

  it("retains raw structured evidence values and rounds only prose", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk: 0.923,
      targetCpk: 1.331,
      cp: 1.184,
      mean: 0.0837,
      rootCauseRules: [
        { ruleId: "root-cause-excessive-variation", title: "RC01 Excessive variation hypothesis" },
        { ruleId: "root-cause-mean-shift", title: "RC02 Mean shift hypothesis" },
      ],
    });

    expect(narrative.resultJudgment.margin).toBeCloseTo(-0.408, 12);
    expect(narrative.rootCauseAnalysis[0]).toMatchObject({
      ruleId: "root-cause-excessive-variation",
      quantitativeEvidence: {
        cp: 1.184,
        targetCpk: 1.331,
      },
    });
    expect((narrative.rootCauseAnalysis[0]?.quantitativeEvidence as { cpTargetGap?: number } | undefined)?.cpTargetGap).toBeCloseTo(-0.147, 12);
    expect(narrative.rootCauseAnalysis[0]?.narrative).toContain("a 0.15 shortfall");
    expect(narrative.rootCauseAnalysis[1]).toMatchObject({
      ruleId: "root-cause-mean-shift",
      quantitativeEvidence: {
        specificationMidpoint: 0,
        meanOffset: 0.0837,
        direction: "USL",
      },
    });
    expect((narrative.rootCauseAnalysis[1]?.quantitativeEvidence as { cpCpkGap?: number } | undefined)?.cpCpkGap).toBeCloseTo(0.261, 12);
    expect(narrative.rootCauseAnalysis[1]?.narrative).toContain("Cp exceeds Cpk by 0.26");
    expect(narrative.rootCauseAnalysis[1]?.narrative).toContain("the mean is +0.08");
  });

  it("exports the builder from the package root", () => {
    expect(buildFromRootExport).toBe(buildF7EngineeringNarrative);
  });

  it("does not emit prohibited optimization or release language", () => {
    const narrative = buildF7EngineeringNarrative(combinedCauseInput());
    const joined = collectStrings(narrative).join("\n");

    expect(joined).not.toMatch(/optimized tolerance|release|hold|ranked recommendation/i);
  });
});