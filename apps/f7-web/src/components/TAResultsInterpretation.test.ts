import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import TAResultsInterpretation from "./TAResultsInterpretation.vue";
import type { F7SessionSnapshot } from "../api/f7-client";

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

describe("TAResultsInterpretation", () => {
  it("renders the governed engineering narrative hierarchy in the required reading order", () => {
    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot() },
    });

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
    expect(wrapper.findAll("[data-root-cause-item]")[1]?.text()).toContain("cpCpkGap");
    expect(wrapper.findAll("[data-root-cause-item]")[2]?.text()).toContain("contributionPercent");
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
  });
});