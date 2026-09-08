import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import TAResultsInterpretation from "./TAResultsInterpretation.vue";
import type { F7SessionSnapshot } from "../api/f7-client";
import * as assumptionResultsInterpretationModule from "../assumption-results-interpretation";
import type {
  F7NarrativeResultJudgment,
  F7NarrativeRootCauseItem,
} from "@ai-assist/product-language/f7-engineering-narrative";

let actualBuildAssumptionResultsInterpretation: typeof assumptionResultsInterpretationModule.buildAssumptionResultsInterpretation;
let buildAssumptionResultsInterpretationSpy: { mockImplementation: (fn: typeof assumptionResultsInterpretationModule.buildAssumptionResultsInterpretation) => unknown; mockReturnValue: (value: ReturnType<typeof assumptionResultsInterpretationModule.buildAssumptionResultsInterpretation>) => unknown; mockReset: () => unknown; };

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

function unavailableInterpretationSnapshot(): F7SessionSnapshot {
  return {
    systemSpecification: { status: "unavailable" },
    factors: [],
  } as unknown as F7SessionSnapshot;
}

function mountWithActualInterpretation(session: F7SessionSnapshot) {
  buildAssumptionResultsInterpretationSpy.mockImplementation(actualBuildAssumptionResultsInterpretation);
  return mount(TAResultsInterpretation, {
    props: { session },
  });
}

function overrideResultJudgment(
  resultJudgment: F7NarrativeResultJudgment,
  override: Partial<F7NarrativeResultJudgment>,
): F7NarrativeResultJudgment {
  return {
    ...resultJudgment,
    ...override,
  };
}

describe("TAResultsInterpretation", () => {
  beforeAll(async () => {
    ({ buildAssumptionResultsInterpretation: actualBuildAssumptionResultsInterpretation } = await vi.importActual("../assumption-results-interpretation"));
    buildAssumptionResultsInterpretationSpy = vi.spyOn(assumptionResultsInterpretationModule, "buildAssumptionResultsInterpretation");
  });

  afterEach(() => {
    buildAssumptionResultsInterpretationSpy.mockReset();
  });

  it("renders the governed engineering narrative hierarchy in the required reading order", () => {
    const wrapper = mountWithActualInterpretation(enhancedInterpretationSnapshot());

    expect(wrapper.get("[data-result-judgment]").text()).toContain("Capability is below target");
    expect(wrapper.get("[data-result-judgment]").text()).toContain("Cpk");
    expect(wrapper.get("[data-result-judgment]").text()).toContain("Target");
    expect(wrapper.get("[data-result-judgment]").text()).toContain("Margin");
    expect(wrapper.get("[data-engineering-summary]").text()).toContain("Cpk");
    expect(wrapper.findAll("[data-root-cause-item]")).toHaveLength(3);
    expect(wrapper.findAll("[data-root-cause-item]").map((item) => item.text())).toEqual([
      expect.stringContaining("root-cause-excessive-variation"),
      expect.stringContaining("root-cause-mean-shift"),
      expect.stringContaining("root-cause-contributor-concentration"),
    ]);
    expect(wrapper.findAll("[data-root-cause-item]")[1]?.text()).toContain("Cp-Cpk gap");
    expect(wrapper.findAll("[data-root-cause-item]")[2]?.text()).toContain("Contribution");
    expect(wrapper.findAll("[data-root-cause-item]")[2]?.text()).toContain("hypothesis");
    expect(wrapper.get("[data-engineering-risk]").text()).toContain("requires validation");
    expect(wrapper.findAll("[data-action-sequence-item]")).toHaveLength(3);
    expect(wrapper.findAll("[data-action-sequence-item]").map((item) => item.text())).toEqual([
      expect.stringContaining("improvement-center-mean"),
      expect.stringContaining("improvement-reduce-variation"),
      expect.stringContaining("improvement-reduce-contributor"),
    ]);
    expect(wrapper.get("[data-evidence-disclosure]").text()).toContain("not measured capability evidence");
    expect(wrapper.get("[data-evidence-disclosure]").text()).toContain("Matched rule IDs: root-cause-excessive-variation, root-cause-mean-shift, root-cause-contributor-concentration");
    expect(wrapper.find("[data-engineering-interpretation]").exists()).toBe(false);

    const topLevelSections = wrapper.findAll(".narrative-flow > section");
    expect(topLevelSections[0]?.attributes("data-result-judgment")).toBe("");
    expect(topLevelSections[1]?.attributes("data-engineering-summary")).toBe("");
    expect(topLevelSections[3]?.attributes("data-engineering-risk")).toBe("");
    expect(topLevelSections[5]?.attributes("data-assumption-disclosure")).toBe("");
    const panelChildren = wrapper.findAll(".ta-results-interpretation > *");
    expect(panelChildren[panelChildren.length - 1]?.attributes("data-input-readiness")).toBe("");
  });

  it("keeps the unavailable behavior unchanged and shows input readiness last", () => {
    const wrapper = mountWithActualInterpretation(unavailableInterpretationSnapshot());

    expect(wrapper.get("[data-interpretation-unavailable]").text()).toContain(
      "Complete and confirm Factor Setup inputs to interpret assumption-based results.",
    );
    const sections = wrapper.findAll("section, div.input-readiness");
    expect(sections[sections.length - 1]?.attributes("data-input-readiness")).toBe("");
  });

  it("shows the incomplete-evidence visual state when a matched hypothesis lacks dependent facts", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      narrative: {
        ...available.narrative,
        rootCauseAnalysis: [...available.narrative.rootCauseAnalysis.map<F7NarrativeRootCauseItem>((item, index) => (index === 1
          ? {
              ruleId: item.ruleId,
              title: item.title,
              hypothesisStatus: item.hypothesisStatus,
              narrative: "Evidence is incomplete for this matched hypothesis.",
              completeEvidence: false,
            }
          : item))],
      },
    });
    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot() },
    });

    const incompleteItems = wrapper.findAll("[data-root-cause-item]").filter((item) => item.text().includes("Incomplete evidence"));
    expect(incompleteItems.length).toBeGreaterThan(0);
  });

  it("shows verification, provenance, assumptions, and evidence disclosure together in the narrative disclosure section", () => {
    const wrapper = mountWithActualInterpretation(enhancedInterpretationSnapshot());

    const disclosure = wrapper.get("[data-assumption-disclosure]").text();
    expect(disclosure).toContain("Verification Requirements");
    expect(disclosure).toContain("Evidence Disclosure");
    expect(disclosure).toContain("Assumption Disclosure");
    expect(wrapper.get("[data-f0-provenance]").text()).toBe("F0 interpretation-rules-v2");
  });

  it("renders near-target negative status and display strings without collapsing the margin sign", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      narrative: {
        ...available.narrative,
        resultJudgment: overrideResultJudgment(available.narrative.resultJudgment, {
          status: "below-target",
          headline: "Capability is below target",
          cpk: 1.3299999,
          targetCpk: 1.33,
          margin: -0.0000001,
          display: {
            cpk: "1.3299999",
            targetCpk: "1.3300000",
            margin: "-0.0000001",
          },
          judgment: "Cpk 1.3299999 is 0.0000001 below the resolved target of 1.3300000.",
        }),
      },
    });

    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot() },
    });

    const judgment = wrapper.get("[data-result-judgment]").text();
    expect(judgment).toContain("Capability is below target");
    expect(judgment).toContain("Cpk 1.3299999");
    expect(judgment).toContain("Target 1.3300000");
    expect(judgment).toContain("Margin -0.0000001");
    expect(judgment).toMatch(/Margin -0\.0000001(?!\d)/);
  });

  it("renders near-target positive status and display strings without hiding the positive margin sign", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      narrative: {
        ...available.narrative,
        resultJudgment: overrideResultJudgment(available.narrative.resultJudgment, {
          status: "meets-target",
          headline: "Capability meets target",
          cpk: 1.3300001,
          targetCpk: 1.33,
          margin: 0.0000001,
          display: {
            cpk: "1.3300001",
            targetCpk: "1.3300000",
            margin: "+0.0000001",
          },
          judgment: "Cpk 1.3300001 is 0.0000001 above the resolved target of 1.3300000.",
        }),
      },
    });

    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot() },
    });

    const judgment = wrapper.get("[data-result-judgment]").text();
    expect(judgment).toContain("Capability meets target");
    expect(judgment).toContain("Cpk 1.3300001");
    expect(judgment).toContain("Target 1.3300000");
    expect(judgment).toContain("Margin +0.0000001");
    expect(judgment).toMatch(/Margin \+0\.0000001(?!\d)/);
  });

  it("renders explicit engineering evidence labels instead of raw camelCase keys", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      narrative: {
        ...available.narrative,
        rootCauseAnalysis: available.narrative.rootCauseAnalysis.map((item) => {
          if (item.ruleId === "root-cause-excessive-variation") {
            return {
              ...item,
              quantitativeEvidenceLabels: {
                cp: "Cp",
                targetCpk: "Target Cpk",
                cpTargetGap: "Cp vs target gap",
              },
            };
          }
          if (item.ruleId === "root-cause-mean-shift") {
            return {
              ...item,
              quantitativeEvidenceLabels: {
                cpCpkGap: "Cp-Cpk gap",
                specificationMidpoint: "Specification midpoint",
                meanOffset: "Mean offset",
                direction: "Direction",
              },
            };
          }
          return {
            ...item,
            quantitativeEvidenceLabels: {
              contributorName: "Contributor",
                contributorReference: "Contributor reference",
                contributionPercent: "Contribution (%)",
            },
          };
        }),
      },
    });

    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot() },
    });

    const rootCauseText = wrapper.findAll("[data-root-cause-item]").map((item) => item.text()).join(" ");
    expect(rootCauseText).toContain("Cp vs target gap");
    expect(rootCauseText).toContain("Cp-Cpk gap");
    expect(rootCauseText).toContain("Specification midpoint");
    expect(rootCauseText).toContain("Mean offset");
    expect(rootCauseText).toContain("Direction");
    expect(rootCauseText).toContain("Contributor");
    expect(rootCauseText).toContain("Contributor reference");
    expect(rootCauseText).toContain("Contribution (%)");
    expect(rootCauseText).not.toContain("cpTargetGap");
    expect(rootCauseText).not.toContain("cpCpkGap");
    expect(rootCauseText).not.toContain("specificationMidpoint");
    expect(rootCauseText).not.toContain("meanOffset");
    expect(rootCauseText).not.toContain("contributorName");
    expect(rootCauseText).not.toContain("contributionPercent");
  });
});