import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import TAResultsInterpretation from "./TAResultsInterpretation.vue";
import type { F7SessionSnapshot } from "../api/f7-client";
import * as assumptionResultsInterpretationModule from "../assumption-results-interpretation";
import type {
  F7NarrativeResultJudgment,
  F7NarrativeRootCauseItem,
} from "@ai-assist/product-language/f7-engineering-narrative";
import type { ProcessRequirementMatchedEntry } from "@ai-assist/contracts";

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

function overrideResultJudgment(
  resultJudgment: F7NarrativeResultJudgment,
  override: Partial<F7NarrativeResultJudgment>,
): F7NarrativeResultJudgment {
  return {
    ...resultJudgment,
    ...override,
  };
}

function processGuidanceEntries(): readonly ProcessRequirementMatchedEntry[] {
  return [
    {
      entryId: "guidance-escalation",
      entryType: "escalation",
      topic: "review",
      title: "Escalate tolerance ownership",
      message: "Escalate to the owning engineering lead before closing the worksheet review.",
      normativeStrength: "must",
      relatedFactReferences: ["analysisMethod"],
      evidence: {
        sourceAlias: "ta-process-requirements",
        sourceFileHash: "a".repeat(64),
        sourceRevision: "Seed",
        sheetName: "TA Process Requirements",
        sourceRange: "Escalations!A2",
        effectiveVersion: "process-requirements-v1",
        owner: "TA Governance",
        confidence: "reviewed",
        changeSummary: "Seeded guidance for escalation coverage.",
      },
    },
    {
      entryId: "guidance-warning",
      entryType: "warning",
      topic: "review",
      title: "Check workbook evidence freshness",
      message: "Warning entries should stay visible beside stronger guidance types.",
      normativeStrength: "should",
      relatedFactReferences: ["toleranceCount"],
      evidence: {
        sourceAlias: "ta-process-requirements",
        sourceFileHash: "b".repeat(64),
        sourceRevision: "Seed",
        sheetName: "TA Process Requirements",
        sourceRange: "Warnings!A3",
        effectiveVersion: "process-requirements-v1",
        owner: "TA Governance",
        confidence: "reviewed",
        changeSummary: "Seeded guidance for warning coverage.",
      },
    },
    {
      entryId: "guidance-requirement",
      entryType: "requirement",
      topic: "review",
      title: "Capture governed requirement linkage",
      message: "Requirement entries should retain their own semantic styling.",
      normativeStrength: "must",
      relatedFactReferences: ["requirementGapPresent"],
      evidence: {
        sourceAlias: "ta-process-requirements",
        sourceFileHash: "c".repeat(64),
        sourceRevision: "Seed",
        sheetName: "TA Process Requirements",
        sourceRange: "Requirements!A4",
        effectiveVersion: "process-requirements-v1",
        owner: "TA Governance",
        confidence: "reviewed",
        changeSummary: "Seeded guidance for requirement coverage.",
      },
    },
    {
      entryId: "guidance-milestone",
      entryType: "milestone",
      topic: "review",
      title: "Schedule the next F0 review milestone",
      message: "Milestone guidance should remain distinct from requirements and instructions.",
      normativeStrength: "should",
      relatedFactReferences: ["actor"],
      evidence: {
        sourceAlias: "ta-process-requirements",
        sourceFileHash: "d".repeat(64),
        sourceRevision: "Seed",
        sheetName: "TA Process Requirements",
        sourceRange: "Milestones!A5",
        effectiveVersion: "process-requirements-v1",
        owner: "TA Governance",
        confidence: "reviewed",
        changeSummary: "Seeded guidance for milestone coverage.",
      },
    },
    {
      entryId: "guidance-instruction",
      entryType: "instruction",
      topic: "review",
      title: "Document the operator follow-up action",
      message: "Instruction guidance should render after milestone entries in source order.",
      normativeStrength: "should",
      relatedFactReferences: ["analysisMethod", "toleranceCount"],
      evidence: {
        sourceAlias: "ta-process-requirements",
        sourceFileHash: "e".repeat(64),
        sourceRevision: "Seed",
        sheetName: "TA Process Requirements",
        sourceRange: "Instructions!A6",
        effectiveVersion: "process-requirements-v1",
        owner: "TA Governance",
        confidence: "reviewed",
        changeSummary: "Seeded guidance for instruction coverage.",
      },
    },
  ];
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
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      processGuidance: {
        status: "available",
        version: "process-requirements-v1",
        entries: processGuidanceEntries(),
      },
    });
    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot() },
    });

    expect(wrapper.get("[data-result-judgment]").text()).toContain("Capability is below target");
    expect(wrapper.findAll("[data-result-summary-header]").map((item) => item.text())).toEqual([
      "Metric",
      "Result",
      "Specification / Reference",
      "Difference",
      "Assessment",
      "Performance Context",
    ]);
    expect(wrapper.findAll("[data-result-summary-row]").map((item) => item.attributes("data-metric"))).toEqual([
      "mean",
      "standard-deviation",
      "cp",
      "cpk",
      "lower-cpk",
      "upper-cpk",
    ]);
    expect(wrapper.findAll('[data-result-summary-row][data-row-kind="comparison"]')).toHaveLength(6);
    expect(wrapper.find("[data-reference-information]").exists()).toBe(false);
    expect(wrapper.find('[data-result-summary-group="reference"]').exists()).toBe(false);
    expect(wrapper.get("[data-result-summary-scroll]").text()).not.toContain("Reference Information");
    expect(wrapper.get("[data-result-summary-scroll]").attributes()).toMatchObject({
      tabindex: "0",
      role: "region",
      "aria-label": "TA result summary metrics",
    });
    expect(wrapper.get("[data-result-summary-caption]").text()).toContain("assumption-based RSS results");
    expect(wrapper.get('[data-result-summary-row][data-metric="mean"] [data-reference-detail]').text()).toBe("System Design Nominal");
    expect(wrapper.get('[data-result-summary-row][data-metric="standard-deviation"] [data-reference-detail]').text()).toContain("Derived from nearest specification limit");
    expect(wrapper.get('[data-result-summary-row][data-metric="cpk"] [data-result-value]').classes()).toContain("numeric-value");
    expect(wrapper.get('[data-result-summary-row][data-metric="cpk"] [data-assessment]').attributes("data-tone")).toBe("fail");
    expect(wrapper.get('[data-result-summary-row][data-metric="cpk"]').text()).toContain("Below target");
    expect(wrapper.get('[data-result-summary-row][data-metric="cpk"] [data-performance-context]').text()).toContain("of target");
    expect(wrapper.findAll("[data-performance-context]")).toHaveLength(6);
    expect(wrapper.get("[data-overall-assessment]").text()).toContain("Fail. Mean is centered");
    expect(wrapper.get("[data-overall-assessment]").text()).toContain("Standard deviation is too high");
    expect(wrapper.get("[data-overall-assessment]").text()).toContain("Cpk 0.23 is below target 1.33");
    expect(wrapper.get("[data-overall-assessment]").text()).toContain("Lower- and upper-side capabilities are insufficient");
    expect(wrapper.get("[data-overall-assessment]").text()).not.toContain("hypothesis");
    expect(wrapper.find("[data-engineering-summary]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Engineering Summary");
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
    expect(wrapper.find("[data-engineering-interpretation]").exists()).toBe(false);
    expect(wrapper.find("[data-assumption-disclosure]").exists()).toBe(false);
    expect(wrapper.find("[data-input-readiness]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Verification Requirements");
    expect(wrapper.text()).not.toContain("Evidence Disclosure");
    expect(wrapper.text()).not.toContain("Assumption Disclosure");
    expect(wrapper.text()).not.toContain("Rule provenance");
    expect(wrapper.text()).not.toContain("Input Readiness");

    const processGuidance = wrapper.get("[data-process-guidance]");
    expect(processGuidance.text()).toContain("F0 Process Guidance");
    expect(processGuidance.text()).toContain("Triggered by the current TA worksheet and analysis state.");
    expect(processGuidance.get("[data-process-guidance-version]").text()).toContain("process-requirements-v1");
    expect(processGuidance.findAll("[data-process-guidance-entry]")).toHaveLength(5);
    expect(processGuidance.findAll("[data-process-guidance-entry]").map((item) => item.attributes("data-entry-type"))).toEqual([
      "escalation",
      "warning",
      "requirement",
      "milestone",
      "instruction",
    ]);
    expect(processGuidance.findAll("[data-process-guidance-entry-id]").map((item) => item.text())).toEqual([
      "guidance-escalation",
      "guidance-warning",
      "guidance-requirement",
      "guidance-milestone",
      "guidance-instruction",
    ]);
    expect(processGuidance.findAll("[data-process-guidance-entry-type-label]").map((item) => item.text())).toEqual([
      "Escalation",
      "Warning",
      "Requirement",
      "Milestone",
      "Instruction",
    ]);
    expect(processGuidance.findAll("[data-process-guidance-entry-title]").map((item) => item.text())).toEqual([
      "Escalate tolerance ownership",
      "Check workbook evidence freshness",
      "Capture governed requirement linkage",
      "Schedule the next F0 review milestone",
      "Document the operator follow-up action",
    ]);
    expect(processGuidance.findAll("[data-process-guidance-entry-message]").map((item) => item.text())).toEqual([
      "Escalate to the owning engineering lead before closing the worksheet review.",
      "Warning entries should stay visible beside stronger guidance types.",
      "Requirement entries should retain their own semantic styling.",
      "Milestone guidance should remain distinct from requirements and instructions.",
      "Instruction guidance should render after milestone entries in source order.",
    ]);

    const topLevelSections = wrapper.findAll(".narrative-flow > section");
    expect(topLevelSections[0]?.attributes("data-result-judgment")).toBe("");
    expect(topLevelSections[2]?.attributes("data-engineering-risk")).toBe("");
    const panelChildren = wrapper.findAll(".ta-results-interpretation > *");
    expect(panelChildren[panelChildren.length - 1]?.attributes("data-process-guidance")).toBe("");
  });

  it("keeps the unavailable interpretation message and can still show worksheet-supported guidance", () => {
    const unavailable = actualBuildAssumptionResultsInterpretation(unavailableInterpretationSnapshot());
    if (unavailable.status !== "unavailable") throw new Error("expected unavailable interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...unavailable,
      processGuidance: {
        status: "available",
        version: "process-requirements-v1",
        entries: processGuidanceEntries(),
      },
    });
    const wrapper = mount(TAResultsInterpretation, {
      props: { session: unavailableInterpretationSnapshot() },
    });

    expect(wrapper.get("[data-interpretation-unavailable]").text()).toContain(
      "Complete and confirm Factor Setup inputs to interpret assumption-based results.",
    );
    expect(wrapper.find("[data-input-readiness]").exists()).toBe(false);
    expect(wrapper.find("[data-process-guidance]").exists()).toBe(true);
    const panelChildren = wrapper.findAll(".ta-results-interpretation > *");
    expect(panelChildren[panelChildren.length - 1]?.attributes("data-process-guidance")).toBe("");
  });

  it("omits the entire guidance section when no process guidance entries are available", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      processGuidance: {
        status: "available",
        version: "process-requirements-v1",
        entries: [],
      },
    });
    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot() },
    });

    expect(wrapper.find("[data-process-guidance]").exists()).toBe(false);
  });

  it("omits the entire guidance section when process guidance is unavailable", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      processGuidance: {
        status: "unavailable",
        entries: [],
      },
    });
    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot() },
    });

    expect(wrapper.find("[data-process-guidance]").exists()).toBe(false);
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

  it("renders near-target negative status and display strings without collapsing the margin sign", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      overallAssessment: "Fail. Mean is centered. Standard deviation is too high. Cpk 1.3299999 is below target 1.3300000. Lower- and upper-side capabilities are insufficient.",
      resultSummary: available.resultSummary.map((row) => row.key === "cpk"
        ? { ...row, result: "1.3299999", reference: "Target 1.3300000", difference: "-0.0000001" }
        : row),
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
    const cpkRow = wrapper.get('[data-result-summary-row][data-metric="cpk"]').text();
    expect(judgment).toContain("Capability is below target");
    expect(cpkRow).toContain("Cpk");
    expect(cpkRow).toContain("1.3299999");
    expect(cpkRow).toContain("Target 1.3300000");
    expect(cpkRow).toMatch(/-0\.0000001(?!\d)/);
  });

  it("renders near-target positive status and display strings without hiding the positive margin sign", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      overallAssessment: "Pass. Mean is centered. Standard deviation is within target. Cpk 1.3300001 meets target 1.3300000. Lower- and upper-side capability meet target.",
      resultSummary: available.resultSummary.map((row) => row.key === "cpk"
        ? { ...row, result: "1.3300001", reference: "Target 1.3300000", difference: "+0.0000001", assessment: "Meets target", tone: "pass" }
        : row),
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
    const cpkRow = wrapper.get('[data-result-summary-row][data-metric="cpk"]').text();
    expect(judgment).toContain("Capability meets target");
    expect(wrapper.get("[data-overall-assessment]").text()).toContain("Pass. Mean is centered");
    expect(cpkRow).toContain("Cpk");
    expect(cpkRow).toContain("1.3300001");
    expect(cpkRow).toContain("Target 1.3300000");
    expect(cpkRow).toMatch(/\+0\.0000001(?!\d)/);
    expect(wrapper.get('[data-result-summary-row][data-metric="cpk"] [data-assessment]').attributes("data-tone")).toBe("pass");
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

  it("does not render a small nonzero quantitative evidence value as zero", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      narrative: {
        ...available.narrative,
        rootCauseAnalysis: available.narrative.rootCauseAnalysis.map((item, index) => (index === 0
          ? {
              ...item,
              quantitativeEvidence: { contributionPercent: 0.0000001 },
              quantitativeEvidenceLabels: { contributionPercent: "Contribution (%)" },
            }
          : item)),
      },
    });

    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot() },
    });

    const evidenceText = wrapper.findAll("[data-root-cause-item]")[0]?.text();
    expect(evidenceText).toContain("Contribution (%)");
    expect(evidenceText).toContain("0.0000001%");
    expect(evidenceText).not.toContain("Contribution (%)0.00%");
  });
});