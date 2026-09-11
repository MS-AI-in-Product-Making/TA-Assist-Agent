import { describe, expect, it } from "vitest";

import {
  buildF7EngineeringNarrative,
  type BuildF7EngineeringNarrativeInput,
} from "./f7-engineering-narrative.js";
import { buildF7EngineeringNarrative as buildFromRootExport } from "./index.js";

function nextRepresentableUp(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (Object.is(value, -0)) return Number.MIN_VALUE;
  if (value === 0) return Number.MIN_VALUE;

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  let bits = view.getBigUint64(0, false);
  bits += value > 0 ? 1n : -1n;
  view.setBigUint64(0, bits, false);
  return view.getFloat64(0, false);
}

function nextRepresentableDown(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return -Number.MIN_VALUE;

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  let bits = view.getBigUint64(0, false);
  bits += value > 0 ? -1n : 1n;
  view.setBigUint64(0, bits, false);
  return view.getFloat64(0, false);
}

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
          "Update representative variation evidence.",
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
  expect(text).not.toMatch(/(^|\s|[;(])(?:[+-]?0(?:\.0+)?)(?=$|\s|[;,])/);
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
      "root-cause-mean-shift",
      "root-cause-excessive-variation",
      "root-cause-contributor-concentration",
    ]);
    expect(narrative.rootCauseAnalysis[0]).toMatchObject({
      ruleId: "root-cause-mean-shift",
      completeEvidence: true,
      quantitativeEvidence: {
        specificationMidpoint: 0,
        meanOffset: 0.08,
        direction: "USL",
      },
    });
    expect((narrative.rootCauseAnalysis[0]?.quantitativeEvidence as { cpCpkGap?: number } | undefined)?.cpCpkGap).toBeCloseTo(0.26, 12);
    expect(narrative.rootCauseAnalysis[2]).toMatchObject({
      ruleId: "root-cause-contributor-concentration",
      completeEvidence: true,
      quantitativeEvidence: {
        contributorName: "Factor A",
        contributionPercent: 46,
      },
    });
    expect(narrative.engineeringRisk.indexOf("RC02")).toBeLessThan(narrative.engineeringRisk.indexOf("RC01"));
    expect(narrative.suggestedActionSequence.map(({ optionId }) => ({ optionId }))).toEqual([
      { optionId: "improvement-center-mean" },
      { optionId: "improvement-reduce-variation" },
    ]);
    expect(narrative.suggestedActionSequence[0]?.narrative).toBe(
      "Confirm mean-centering feasibility before changing the process centerline. Current mean: +0.08; target mean: 0; required adjustment: -0.08 toward LSL.",
    );
    expect(narrative.suggestedActionSequence[1]).toMatchObject({
      optionId: "improvement-reduce-variation",
      title: "Reduce total variation",
      narrative: "Reduce total variation only after representative variation evidence confirms the modeled shortfall; investigate the dominant contributor before changing its tolerance or process controls.",
      validationSteps: [
        "Update representative variation evidence.",
        "Rerun the same RSS or Monte Carlo method with unchanged specifications and target.",
        "Confirm Cp and Cpk meet the resolved target using a new representative sample.",
        "Validate the dominant contributor evidence before changing its tolerance or process controls.",
        "Recalculate the tolerance stack after the proposed contributor change.",
        "Confirm the improvement with representative data against the unchanged resolved target.",
      ],
    });
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

  it("preserves matched rule provenance on ordered root causes and suggested actions", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      rootCauseRules: [
        {
          ruleId: "root-cause-excessive-variation",
          title: "RC01 Excessive variation hypothesis",
          sourceAlias: "kb://root-cause-excessive-variation",
          sourceFileHash: "a".repeat(64),
        },
      ],
      controlledOptions: [
        {
          ruleId: "improvement-reduce-variation",
          title: "Reduce total variation",
          sourceAlias: "kb://improvement-reduce-variation",
          sourceFileHash: "b".repeat(64),
          validationSteps: ["Update representative variation evidence."],
        },
      ],
      contributors: [],
    });

    expect(narrative.rootCauseAnalysis[0]).toMatchObject({
      ruleId: "root-cause-excessive-variation",
      sourceAlias: "kb://root-cause-excessive-variation",
      sourceFileHash: "a".repeat(64),
    });
    expect(narrative.suggestedActionSequence[0]).toMatchObject({
      optionId: "improvement-reduce-variation",
      sourceAlias: "kb://improvement-reduce-variation",
      sourceFileHash: "b".repeat(64),
    });
  });

  it("keeps standalone variation suggestions unchanged", () => {
    const input = combinedCauseInput();
    const variationOption = input.controlledOptions.find(({ ruleId }) => ruleId === "improvement-reduce-variation");
    const contributorOption = input.controlledOptions.find(({ ruleId }) => ruleId === "improvement-reduce-contributor");
    if (variationOption === undefined || contributorOption === undefined) {
      throw new Error("expected both variation options in the test fixture");
    }

    const variationNarrative = buildF7EngineeringNarrative({
      ...input,
      controlledOptions: [{
        ...variationOption,
        sourceAlias: "kb://improvement-reduce-variation",
        sourceFileHash: "a".repeat(64),
      }],
    });
    const contributorNarrative = buildF7EngineeringNarrative({
      ...input,
      controlledOptions: [{
        ...contributorOption,
        sourceAlias: "kb://improvement-reduce-contributor",
        sourceFileHash: "b".repeat(64),
      }],
    });

    expect(variationNarrative.suggestedActionSequence).toMatchObject([{
      optionId: "improvement-reduce-variation",
      title: "Reduce total variation",
      sourceAlias: "kb://improvement-reduce-variation",
      sourceFileHash: "a".repeat(64),
      narrative: "Reduce total variation only after representative variation evidence confirms the modeled shortfall.",
      validationSteps: variationOption.validationSteps,
    }]);
    expect(contributorNarrative.suggestedActionSequence).toMatchObject([{
      optionId: "improvement-reduce-contributor",
      title: "Reduce the dominant contributor",
      sourceAlias: "kb://improvement-reduce-contributor",
      sourceFileHash: "b".repeat(64),
      narrative: "Investigate the dominant contributor before changing its tolerance or process controls.",
      validationSteps: contributorOption.validationSteps,
    }]);
  });

  it("reports a positive mean-centering adjustment toward USL", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      mean: -0.07,
      lowerSpecLimit: -0.1,
      upperSpecLimit: 0,
      controlledOptions: [combinedCauseInput().controlledOptions[2]!],
    });

    expect(narrative.suggestedActionSequence[0]?.narrative).toBe(
      "Confirm mean-centering feasibility before changing the process centerline. Current mean: -0.07; target mean: -0.05; required adjustment: +0.02 toward USL.",
    );
    expect(narrative.suggestedActionSequence[0]).toMatchObject({
      meanCentering: {
        feasibilityNarrative: "Confirm mean-centering feasibility before changing the process centerline.",
        currentMean: -0.07,
        targetMean: -0.05,
        requiredAdjustment: expect.closeTo(0.02, 12),
        direction: "USL",
        display: {
          currentMean: "-0.07",
          targetMean: "-0.05",
          requiredAdjustment: "+0.02",
        },
      },
    });
  });

  it("reports a nonzero target mean for asymmetric specifications", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      mean: 0.2,
      lowerSpecLimit: -0.4,
      upperSpecLimit: 0.6,
      controlledOptions: [combinedCauseInput().controlledOptions[2]!],
    });

    expect(narrative.suggestedActionSequence[0]?.narrative).toBe(
      "Confirm mean-centering feasibility before changing the process centerline. Current mean: +0.2; target mean: 0.1; required adjustment: -0.1 toward LSL.",
    );
  });

  it("preserves a very small nonzero mean adjustment", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      mean: 1e-8,
      controlledOptions: [combinedCauseInput().controlledOptions[2]!],
    });

    expect(narrative.suggestedActionSequence[0]?.narrative).toContain(
      "Current mean: +1e-8; target mean: 0; required adjustment: -1e-8 toward LSL.",
    );
  });

  it("calculates a finite midpoint for large same-sign specifications", () => {
    const lowerSpecLimit = Number.MAX_VALUE - 3e292;
    const upperSpecLimit = Number.MAX_VALUE;
    const mean = lowerSpecLimit;
    const expectedTargetMean = lowerSpecLimit + (upperSpecLimit - lowerSpecLimit) / 2;

    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      mean,
      lowerSpecLimit,
      upperSpecLimit,
      controlledOptions: [combinedCauseInput().controlledOptions[2]!],
    });
    const meanCentering = narrative.suggestedActionSequence[0]?.meanCentering;

    expect(meanCentering).toBeDefined();
    expect(meanCentering?.currentMean).toBe(mean);
    expect(Number.isFinite(meanCentering?.targetMean)).toBe(true);
    expect(meanCentering!.targetMean).toBeGreaterThan(lowerSpecLimit);
    expect(meanCentering!.targetMean).toBeLessThan(upperSpecLimit);
    expect(meanCentering!.targetMean).toBeCloseTo(expectedTargetMean, 12);
    expect(meanCentering!.requiredAdjustment).toBeGreaterThan(0);
    expect(meanCentering!.requiredAdjustment).toBeCloseTo(expectedTargetMean - mean, 12);
    expect(meanCentering!.direction).toBe("USL");
  });

  it.each(["mean", "lowerSpecLimit", "upperSpecLimit"] as const)(
    "keeps feasibility-only mean-centering guidance when %s is missing",
    (missingField) => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      [missingField]: undefined,
      controlledOptions: [combinedCauseInput().controlledOptions[2]!],
    });

    expect(narrative.suggestedActionSequence[0]?.narrative).toBe(
      "Confirm mean-centering feasibility before changing the process centerline.",
    );
    expect(narrative.suggestedActionSequence[0]).not.toHaveProperty("meanCentering");
    },
  );

  it("reports that no mean adjustment is required when the process is centered", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      mean: 0,
      controlledOptions: [combinedCauseInput().controlledOptions[2]!],
    });

    expect(narrative.suggestedActionSequence[0]?.narrative).toBe(
      "Confirm mean-centering feasibility before changing the process centerline. Current mean: +0; target mean: 0; no adjustment required.",
    );
    expect(narrative.suggestedActionSequence[0]?.meanCentering).toEqual({
      feasibilityNarrative: "Confirm mean-centering feasibility before changing the process centerline.",
      currentMean: 0,
      targetMean: 0,
      requiredAdjustment: 0,
      direction: "balanced",
      display: {
        currentMean: "+0",
        targetMean: "0",
        requiredAdjustment: "0",
      },
    });
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
      "Cpk 1.329 versus target 1.330. Capability is below target by 0.001, and enhanced root-cause explanation remains limited by incomplete evidence.",
    );
    expect(narrative.engineeringRisk).toContain("The capability shortfall of 0.001 indicates below-target performance");
    expect(narrative.engineeringRisk).not.toContain("shortfall of 0 indicates");
    expect(narrative.resultJudgment.display).toEqual({
      cpk: "1.329",
      targetCpk: "1.330",
      margin: "-0.001",
    });
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
      "Cpk 1.331 versus target 1.330. Capability currently meets the resolved target with a margin of 0.001; continue stability verification with representative evidence and ME review.",
    );
    expect(narrative.resultJudgment.display).toEqual({
      cpk: "1.331",
      targetCpk: "1.330",
      margin: "+0.001",
    });
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
    expect(narrative.resultJudgment.judgment).toContain("0.0000001 below");
    expect(narrative.resultJudgment.judgment).not.toContain("0 below");
    expect(narrative.engineeringSummary).toContain("Cpk 1.3299999 versus target 1.3300000.");
    expect(narrative.engineeringSummary).toContain("below target by 0.0000001");
    expect(narrative.engineeringRisk).toContain("shortfall of 0.0000001 indicates below-target performance");
    expectNoZeroRepresentation(narrative.resultJudgment.judgment);
    expectNoZeroRepresentation(narrative.engineeringSummary);
    expectNoZeroRepresentation(narrative.engineeringRisk);
  });

  it("keeps near-target negative endpoints distinguishable and relation-consistent in judgment summary and risk", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk: 1.3299999,
      targetCpk: 1.33,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    });

    expect(narrative.resultJudgment.status).toBe("below-target");
    expect(narrative.resultJudgment.judgment).toBe("Cpk 1.3299999 is 0.0000001 below the resolved target of 1.3300000.");
    expect(narrative.engineeringSummary).toBe(
      "Cpk 1.3299999 versus target 1.3300000. Capability is below target by 0.0000001, and enhanced root-cause explanation remains limited by incomplete evidence.",
    );
    expect(narrative.engineeringRisk).toBe(
      "The capability shortfall of 0.0000001 indicates below-target performance for Cpk 1.3299999 against the resolved target of 1.3300000; the mean direction is consistent with nearer exposure toward USL; the matched hypothesis set requires validation.",
    );
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
    expect(narrative.resultJudgment.judgment).toContain("0.0000001 above");
    expect(narrative.resultJudgment.judgment).not.toContain("0 above");
    expect(narrative.engineeringSummary).toContain("Cpk 1.3300001 versus target 1.3300000.");
    expect(narrative.engineeringSummary).toContain("margin of 0.0000001");
    expectNoZeroRepresentation(narrative.resultJudgment.judgment);
    expectNoZeroRepresentation(narrative.engineeringSummary);
    expectNoZeroRepresentation(narrative.engineeringRisk);
  });

  it("renders subprecision contributor percentages without collapsing them to zero prose", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      rootCauseRules: [
        { ruleId: "root-cause-contributor-concentration", title: "RC03 Dominant contributor hypothesis" },
      ],
      controlledOptions: [],
      contributors: [
        { name: "Factor A", reference: "factor-a", contributionPercent: 0.0000001 },
      ],
    });

    expect(narrative.rootCauseAnalysis[0]?.narrative).toContain("contributes 0.0000001%");
    expect(narrative.rootCauseAnalysis[0]?.narrative).not.toContain("contributes 0%");
  });

  it("keeps near-target positive endpoints distinguishable and relation-consistent in judgment summary and risk", () => {
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
    expect(narrative.resultJudgment.judgment).toBe("Cpk 1.3300001 is 0.0000001 above the resolved target of 1.3300000.");
    expect(narrative.engineeringSummary).toBe(
      "Cpk 1.3300001 versus target 1.3300000. Capability currently meets the resolved target with a margin of 0.0000001; continue stability verification with representative evidence and ME review.",
    );
    expect(narrative.engineeringRisk).toBe(
      "The calculated result meets the resolved target and indicates a stable baseline only if representative evidence and ME review confirm the assumptions.",
    );
  });

  it("keeps scientific negative endpoints distinguishable for 1e-8 deltas and adjacent representable values", () => {
    const targetCpk = 1e-8;
    const cpk = nextRepresentableDown(targetCpk);
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk,
      targetCpk,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    });

    expect(narrative.resultJudgment.status).toBe("below-target");
    expect(narrative.resultJudgment.margin).toBeCloseTo(cpk - targetCpk, 30);
    expect(narrative.resultJudgment.judgment).toContain("below the resolved target");
    expect(narrative.resultJudgment.judgment).toContain("9.999999999999999e-9");
    expect(narrative.resultJudgment.judgment).toContain("1e-8");
    expect(narrative.resultJudgment.judgment).not.toContain("Cpk 1e-8 is");
  });

  it("keeps scientific positive endpoints distinguishable for +1e-8 deltas and adjacent representable values", () => {
    const targetCpk = 1e-8;
    const cpk = nextRepresentableUp(targetCpk);
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk,
      targetCpk,
      cp: cpk,
      mean: 0,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    });

    expect(narrative.resultJudgment.status).toBe("meets-target");
    expect(narrative.resultJudgment.margin).toBeCloseTo(cpk - targetCpk, 30);
    expect(narrative.resultJudgment.judgment).toContain("above the resolved target");
    expect(narrative.resultJudgment.judgment).toContain("1.0000000000000002e-8");
    expect(narrative.resultJudgment.judgment).toContain("1e-8");
    expect(narrative.resultJudgment.judgment).not.toContain("Cpk 1e-8 is");
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

  it("keeps combined RC02 direction balanced when mean-to-limit distances are equal", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      mean: Number.EPSILON * 8,
      lowerSpecLimit: -1,
      upperSpecLimit: 1,
      rootCauseRules: [
        { ruleId: "root-cause-excessive-variation", title: "RC01 Excessive variation hypothesis" },
        { ruleId: "root-cause-mean-shift", title: "RC02 Mean shift hypothesis" },
      ],
    });

    expect(narrative.resultJudgment.nearerSpecificationSide).toBe("balanced");
    expect(narrative.rootCauseAnalysis[0]).toMatchObject({
      ruleId: "root-cause-mean-shift",
      completeEvidence: true,
      quantitativeEvidence: {
        specificationMidpoint: 0,
        direction: "balanced",
      },
    });
    expect((narrative.rootCauseAnalysis[0]?.quantitativeEvidence as { meanOffset?: number } | undefined)?.meanOffset).toBeCloseTo(Number.EPSILON * 8, 20);
    expect(narrative.rootCauseAnalysis[0]?.narrative).toContain("balanced around the specification midpoint");
    expect(narrative.rootCauseAnalysis[0]?.narrative).not.toContain("toward USL");
    expect(narrative.rootCauseAnalysis[0]?.narrative).not.toContain("toward LSL");
    expect(narrative.engineeringRisk).toContain("mean remains at or balanced around the specification midpoint");
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
        ruleId: "root-cause-mean-shift",
        completeEvidence: false,
        narrative: "Evidence is incomplete for this matched hypothesis.",
      }),
      expect.objectContaining({
        ruleId: "root-cause-excessive-variation",
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

  it("throws a deterministic RangeError when result margin arithmetic is non-finite", () => {
    expect(() => buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk: Number.MAX_VALUE,
      targetCpk: -Number.MAX_VALUE,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    })).toThrowError(new RangeError("Derived narrative value resultJudgment.margin must be finite."));
  });

  it("throws a deterministic RangeError when RC quantitative differences become non-finite", () => {
    expect(() => buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk: -Number.MAX_VALUE,
      targetCpk: 1.33,
      cp: Number.MAX_VALUE,
      rootCauseRules: [
        { ruleId: "root-cause-excessive-variation", title: "RC01 Excessive variation hypothesis" },
        { ruleId: "root-cause-mean-shift", title: "RC02 Mean shift hypothesis" },
      ],
    })).toThrowError(new RangeError("Derived narrative value rootCauseAnalysis.cpCpkGap must be finite."));
  });

  it("formats huge finite endpoints without emitting Infinity in public narrative output", () => {
    const narrative = buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk: Number.MAX_VALUE,
      targetCpk: 1,
      cp: Number.MAX_VALUE,
      mean: 0,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    });

    expect(narrative.resultJudgment.status).toBe("meets-target");
    expect(narrative.resultJudgment.judgment).not.toContain("Infinity");
    expect(narrative.engineeringSummary).not.toContain("Infinity");
    expect(narrative.engineeringRisk).not.toContain("Infinity");
    expect(narrative.resultJudgment.judgment).toContain("1.7976931348623157e308");
  });

  it("throws a deterministic RangeError when nearest-side distance delta overflows", () => {
    expect(() => buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      cpk: 1.2,
      targetCpk: 1.33,
      cp: 1.2,
      mean: 0,
      lowerSpecLimit: -Number.MAX_VALUE,
      upperSpecLimit: -Number.MAX_VALUE,
      rootCauseRules: [],
      controlledOptions: [],
      contributors: [],
    })).toThrowError(new RangeError("Derived narrative value resultJudgment.distanceDelta must be finite."));
  });

  it("preserves raw quantitative values and keeps the output recursively frozen", () => {
    const input = combinedCauseInput();
    const snapshot = structuredClone(input);

    const narrative = buildF7EngineeringNarrative(input);

    expect(narrative.resultJudgment.margin).toBeCloseTo(-0.41, 12);
    expect(narrative.rootCauseAnalysis[1]?.quantitativeEvidence).toMatchObject({
      cp: 1.18,
      targetCpk: 1.33,
    });
    expect((narrative.rootCauseAnalysis[1]?.quantitativeEvidence as { cpTargetGap?: number } | undefined)?.cpTargetGap).toBeCloseTo(-0.15, 12);
    expect(narrative.rootCauseAnalysis[1]?.quantitativeEvidenceLabels).toEqual({
      cp: "Cp",
      targetCpk: "Target Cpk",
      cpTargetGap: "Cp vs target gap",
    });
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
    expect(narrative.rootCauseAnalysis[1]).toMatchObject({
      ruleId: "root-cause-excessive-variation",
      quantitativeEvidence: {
        cp: 1.184,
        targetCpk: 1.331,
      },
    });
    expect((narrative.rootCauseAnalysis[1]?.quantitativeEvidence as { cpTargetGap?: number } | undefined)?.cpTargetGap).toBeCloseTo(-0.147, 12);
    expect(narrative.rootCauseAnalysis[1]?.narrative).toContain("a 0.15 shortfall");
    expect(narrative.rootCauseAnalysis[0]).toMatchObject({
      ruleId: "root-cause-mean-shift",
      quantitativeEvidence: {
        specificationMidpoint: 0,
        meanOffset: 0.0837,
        direction: "USL",
      },
    });
    expect((narrative.rootCauseAnalysis[0]?.quantitativeEvidence as { cpCpkGap?: number } | undefined)?.cpCpkGap).toBeCloseTo(0.261, 12);
    expect(narrative.rootCauseAnalysis[0]?.quantitativeEvidenceLabels).toEqual({
      cpCpkGap: "Cp-Cpk gap",
      specificationMidpoint: "Specification midpoint",
      meanOffset: "Mean offset",
      direction: "Direction",
    });
    expect(narrative.rootCauseAnalysis[0]?.narrative).toContain("Cp exceeds Cpk by 0.26");
    expect(narrative.rootCauseAnalysis[0]?.narrative).toContain("the mean is +0.08");
  });

  it("labels contributor evidence with explicit engineering names", () => {
    const narrative = buildF7EngineeringNarrative(combinedCauseInput());

    expect(narrative.rootCauseAnalysis[2]?.quantitativeEvidenceLabels).toEqual({
      contributorName: "Contributor",
      contributorReference: "Contributor reference",
      contributionPercent: "Contribution (%)",
    });
  });

  it("rejects unsupported governed root-cause and action rule IDs", () => {
    expect(() => buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      rootCauseRules: [{ ruleId: "root-cause-unknown", title: "Unknown root cause" }],
    })).toThrowError("Unsupported F7 narrative root-cause rule: root-cause-unknown.");

    expect(() => buildF7EngineeringNarrative({
      ...combinedCauseInput(),
      controlledOptions: [{
        ruleId: "improvement-unknown",
        title: "Unknown action",
        validationSteps: [],
      }],
    })).toThrowError("Unsupported F7 narrative action rule: improvement-unknown.");
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