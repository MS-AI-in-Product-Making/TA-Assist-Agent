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

describe("buildF7EngineeringNarrative", () => {
  it("builds the complete combined-cause narrative in governed reading order", () => {
    const narrative = buildF7EngineeringNarrative(combinedCauseInput());

    expect(narrative.resultJudgment).toMatchObject({
      status: "below-target",
      headline: "Capability is below target",
      cpk: 0.92,
      targetCpk: 1.33,
      margin: -0.41,
      nearerSpecificationSide: "USL",
    });
    expect(narrative.rootCauseAnalysis.map(({ ruleId }) => ruleId)).toEqual([
      "root-cause-excessive-variation",
      "root-cause-mean-shift",
      "root-cause-contributor-concentration",
    ]);
    expect(narrative.rootCauseAnalysis[1]).toMatchObject({
      ruleId: "root-cause-mean-shift",
      completeEvidence: true,
      quantitativeEvidence: {
        cpCpkGap: 0.26,
        specificationMidpoint: 0,
        meanOffset: 0.08,
        direction: "USL",
      },
    });
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

    expect(narrative.resultJudgment.margin).toBe(-0.41);
    expect(narrative.rootCauseAnalysis[0]?.quantitativeEvidence).toMatchObject({
      cp: 1.18,
      targetCpk: 1.33,
      cpTargetGap: -0.15,
    });
    expectRecursivelyFrozen(narrative);
    expect(input).toEqual(snapshot);
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