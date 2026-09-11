import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import TAResultsInterpretation from "./TAResultsInterpretation.vue";
import type { F7SessionSnapshot } from "../api/f7-client";
import * as assumptionResultsInterpretationModule from "../assumption-results-interpretation";
import type {
  F7NarrativeResultJudgment,
  F7NarrativeRootCauseItem,
} from "@ai-assist/product-language/f7-engineering-narrative";
import type { F0ProcessGuidanceEntry } from "../f0-process-guidance";

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

function processGuidanceEntries(): readonly F0ProcessGuidanceEntry[] {
  return [
    {
      entryId: "guidance-escalation",
      entryType: "escalation",
      topic: "review",
      title: "Escalate tolerance ownership",
      message: "Escalate to the owning engineering lead before closing the worksheet review.",
      normativeStrength: "must",
      state: "warning",
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
      state: "guidance",
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
      state: "warning",
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
      state: "guidance",
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
      state: "guidance",
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
    expect(wrapper.findAll("[data-root-cause-item]")).toHaveLength(2);
    expect(wrapper.findAll("[data-root-cause-item]").map((item) => item.text())).toEqual([
      expect.stringContaining("Mean shift hypothesis"),
      expect.stringContaining("Excessive variation hypothesis"),
    ]);
    expect(wrapper.findAll("[data-root-cause-item]")[0]?.text()).toContain("Cp-Cpk gap");
    expect(wrapper.findAll("[data-root-cause-item]")[0]?.text()).not.toMatch(/RC\d+|root-cause-/);
    expect(wrapper.findAll("[data-root-cause-item]")[1]?.text()).not.toMatch(/RC\d+|root-cause-/);
    expect(wrapper.findAll("[data-root-cause-item]")[1]?.text()).toContain("Tolerance Adjustment Priority (% Cont. to σ)");
    expect(wrapper.findAll("[data-root-cause-item]")[1]?.text()).not.toContain("Contributor concentration hypothesis");
    expect(wrapper.findAll("[data-root-cause-item]")[1]?.text()).toContain("State hypothesis");
    expect(wrapper.get("[data-root-cause-list]").element.tagName).toBe("OL");
    expect(wrapper.find("[data-engineering-risk]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Engineering Risk");
    expect(wrapper.findAll("[data-action-sequence-item]")).toHaveLength(4);
    expect(wrapper.findAll("[data-action-sequence-item]").map((item) => item.text())).toEqual([
      expect.stringContaining("improvement-center-mean"),
      expect.stringContaining("improvement-reduce-variation"),
      expect.stringContaining("improvement-reduce-contributor"),
      expect.stringContaining("improvement-relax-final-specification"),
    ]);
    const fallbackAction = wrapper.findAll("[data-action-sequence-item]").at(-1);
    const fallback = fallbackAction?.get("[data-specification-fallback]");
    expect(fallback?.get(".specification-adjustments-scroll").attributes()).toMatchObject({
      role: "region",
      "aria-label": "Recommended specification limit changes",
      tabindex: "0",
    });
    expect(fallback?.get("[data-specification-adjustments] caption").text()).toBe("Required specification change");
    expect(fallback?.findAll("[data-specification-adjustments] thead th").map((item) => item.text())).toEqual([
      "Limit",
      "Current",
      "Recommended",
      "Adjustment",
    ]);
    expect(fallback?.findAll("[data-specification-row]").map((item) => item.findAll("th, td").map((cell) => cell.text()))).toEqual([
      ["LSL", "-0.1", "→ -0.37", "-0.27"],
      ["USL", "0.1", "→ 0.43", "+0.33"],
    ]);
    expect(fallback?.get("[data-specification-outcome-label]").text()).toBe("Expected result");
    expect(fallback?.get("[data-specification-outcome-value]").text()).toBe("Cpk 1.33");
    expect(wrapper.find("[data-engineering-interpretation]").exists()).toBe(false);
    expect(wrapper.find("[data-assumption-disclosure]").exists()).toBe(false);
    expect(wrapper.find("[data-input-readiness]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Verification Requirements");
    expect(wrapper.text()).not.toContain("Evidence Disclosure");
    expect(wrapper.text()).not.toContain("Assumption Disclosure");
    expect(wrapper.text()).not.toContain("Rule provenance");
    expect(wrapper.text()).not.toContain("Input Readiness");

    const processGuidance = wrapper.get("[data-process-guidance]");
    expect(processGuidance.text()).toContain("TA Process and Requirements");
    expect(processGuidance.text()).not.toContain("F0 Process Guidance");
    expect(processGuidance.text()).toContain("Evaluated against the current TA worksheet and analysis state.");
    expect(processGuidance.text()).not.toContain("Triggered by");
    expect(processGuidance.find("[data-process-guidance-version]").exists()).toBe(false);
    expect(processGuidance.findAll("[data-process-guidance-entry]")).toHaveLength(5);
    expect(processGuidance.get("ol").classes()).toContain("process-guidance-list");
    expect(processGuidance.get("ol").classes()).toContain("action-sequence");
    expect(processGuidance.findAll("[data-process-guidance-entry]").every((item) => (
      item.classes().includes("narrative-item")
    ))).toBe(true);
    expect(processGuidance.findAll("[data-process-guidance-entry]").map((item) => item.attributes("data-guidance-state"))).toEqual([
      "warning",
      "guidance",
      "warning",
      "guidance",
      "guidance",
    ]);
    expect(processGuidance.find("[data-process-guidance-entry-id]").exists()).toBe(false);
    expect(processGuidance.find("[data-process-guidance-entry-type-label]").exists()).toBe(false);
    expect(processGuidance.text()).not.toContain("guidance-escalation");
    expect(processGuidance.findAll("[data-process-guidance-warning]")).toHaveLength(2);
    expect(processGuidance.findAll("[data-process-guidance-warning]").map((item) => item.text())).toEqual([
      "Warning",
      "Warning",
    ]);
    expect(processGuidance.findAll('[data-guidance-state="guidance"] [data-process-guidance-warning]')).toHaveLength(0);
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

  it("renders contributor priorities as a descending Pareto chart", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      contributorPriorities: [
        { factorName: "Factor B", reference: "ref-b", designNominal: 2.5, upperTolerance: 0.3, lowerTolerance: -0.2, contributionPercent: 50, cumulativePercent: 50 },
        { factorName: "Factor C", reference: "ref-c", designNominal: 1.25, upperTolerance: 0.2, lowerTolerance: -0.1, contributionPercent: 30, cumulativePercent: 80 },
        { factorName: "Factor A", reference: "ref-a", designNominal: 0.75, upperTolerance: 0.1, lowerTolerance: -0.05, contributionPercent: 20, cumulativePercent: 100 },
      ],
    });

    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot() },
    });

    const chart = wrapper.get("[data-contributor-pareto]");
    expect(chart.get("[data-pareto-layout]").classes()).toContain("pareto-layout");
    expect(chart.find("[data-pareto-chart-pane]").exists()).toBe(true);
    expect(chart.find("[data-pareto-table-pane]").exists()).toBe(true);
    expect(chart.get("svg").attributes("role")).toBe("img");
    expect(chart.get("svg title").text()).toBe("Contributor priority Pareto chart");
    expect(chart.findAll("[data-pareto-bar]").map((bar) => bar.attributes("data-factor-name"))).toEqual([
      "Factor B",
      "Factor C",
      "Factor A",
    ]);
    expect(chart.findAll("[data-pareto-bar]").map((bar) => bar.attributes("data-contribution"))).toEqual([
      "50",
      "30",
      "20",
    ]);
    expect(chart.find("[data-pareto-cumulative-line]").exists()).toBe(true);
    expect(chart.get("[data-pareto-table-pane]").attributes()).toMatchObject({
      role: "region",
      "aria-label": "Contributor priority details",
      tabindex: "0",
    });
    expect(chart.findAll("thead th").map((cell) => cell.text())).toEqual([
      "Priority",
      "Contributor",
      "Design Nominal",
      "+ Tol",
      "- Tol",
      "% Cont. to σ",
      "Cumulative",
    ]);
    expect(chart.findAll("[data-pareto-rank-row]").map((row) => row.text())).toEqual([
      expect.stringMatching(/1.*Factor B.*2\.5.*\+0\.3.*-0\.2.*50\.00%.*50\.00%/s),
      expect.stringMatching(/2.*Factor C.*1\.25.*\+0\.2.*-0\.1.*30\.00%.*80\.00%/s),
      expect.stringMatching(/3.*Factor A.*0\.75.*\+0\.1.*-0\.05.*20\.00%.*100\.00%/s),
    ]);
    const excessiveVariationItem = wrapper.findAll("[data-root-cause-item]")[1];
    if (!excessiveVariationItem) throw new Error("expected excessive variation item");
    expect(excessiveVariationItem.text()).toContain("Excessive variation hypothesis");
    expect(excessiveVariationItem.find(".evidence-grid").exists()).toBe(true);
    expect(excessiveVariationItem.find("[data-pareto-layout]").exists()).toBe(true);
    const evidence = excessiveVariationItem.get(".evidence-grid").element;
    const pareto = excessiveVariationItem.get("[data-pareto-layout]").element;
    expect(evidence.compareDocumentPosition(pareto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    expect(rootCauseText).toContain("% Cont. to σ");
    expect(rootCauseText).toContain("Cumulative");
    expect(rootCauseText).not.toContain("Contributor reference");
    expect(rootCauseText).not.toContain("Contribution (%)");
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