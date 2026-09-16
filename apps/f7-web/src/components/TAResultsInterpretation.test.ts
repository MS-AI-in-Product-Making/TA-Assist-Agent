import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import TAResultsInterpretation, * as taResultsInterpretationModule from "./TAResultsInterpretation.vue";
import type { AssumptionResultsPdfRequest, F7SessionSnapshot } from "../api/f7-client";
import * as assumptionResultsInterpretationModule from "../assumption-results-interpretation";
import type {
  F7NarrativeResultJudgment,
  F7NarrativeRootCauseItem,
} from "@ai-assist/product-language/f7-engineering-narrative";
import { formatF7NarrativeEvidenceValue } from "@ai-assist/product-language/f7-engineering-narrative";
import type { F0ProcessGuidanceEntry } from "../f0-process-guidance";

let actualBuildAssumptionResultsInterpretation: typeof assumptionResultsInterpretationModule.buildAssumptionResultsInterpretation;
let buildAssumptionResultsInterpretationSpy: { mockImplementation: (fn: typeof assumptionResultsInterpretationModule.buildAssumptionResultsInterpretation) => unknown; mockReturnValue: (value: ReturnType<typeof assumptionResultsInterpretationModule.buildAssumptionResultsInterpretation>) => unknown; mockReset: () => unknown; };

function enhancedInterpretationSnapshot(): F7SessionSnapshot {
  return {
    sessionId: "session-export-01",
    workbook: {
      fileName: "Gearbox: Design?.xlsx",
      workbookContentHash: "a".repeat(64),
    },
    selectedWorksheetNames: ["Anonymous/TA"],
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

function renamedInterpretationSnapshot(options: {
  readonly sessionId?: string;
  readonly fileName: string;
  readonly worksheetName: string;
}): F7SessionSnapshot {
  const snapshot = enhancedInterpretationSnapshot();
  return {
    ...snapshot,
    sessionId: options.sessionId ?? snapshot.sessionId,
    workbook: { ...snapshot.workbook, fileName: options.fileName },
    selectedWorksheetNames: [options.worksheetName],
  };
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
        effectiveVersion: "process-requirements-v3",
        owner: "TA Governance",
        confidence: "reviewed",
        changeSummary: "Seeded guidance for escalation coverage.",
      },
    },
    {
      entryId: "instruction-consider-worst-case-small-stack",
      entryType: "instruction",
      topic: "analysis-method",
      title: "Consider Worst Case for small stacks",
      message: "Consider Worst Case values when the tolerance stack contains fewer than 4 factors.",
      normativeStrength: "should",
      state: "guidance",
      relatedFactReferences: ["toleranceCount"],
      evidence: {
        sourceAlias: "controlled-ta-template-beta",
        sourceFileHash: "b".repeat(64),
        sourceRevision: "Beta",
        sheetName: "TA Process and Requirements",
        sourceRange: "B19:R19",
        effectiveVersion: "process-requirements-v3",
        owner: "Dimensional Management",
        confidence: "reviewed",
        changeSummary: "Add reviewed worst-case guidance for tolerance stacks with fewer than four factors.",
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
        effectiveVersion: "process-requirements-v3",
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
        effectiveVersion: "process-requirements-v3",
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
        effectiveVersion: "process-requirements-v3",
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
        effectiveVersion: "process-requirements-v3",
        owner: "TA Governance",
        confidence: "reviewed",
        changeSummary: "Seeded guidance for instruction coverage.",
      },
    },
  ];
}

function expectedEvidenceValue(key: string, value: number | string): string {
  if (typeof value !== "number") return value;
  const formattedValue = formatF7NarrativeEvidenceValue(value);
  return /percent/i.test(key) ? `${formattedValue}%` : formattedValue;
}

describe("TAResultsInterpretation", () => {
  it("shows no adjustment required for a zero adjustment or balanced direction", () => {
    const formatMeanAdjustment = (taResultsInterpretationModule as {
      formatMeanAdjustment?: (meanCentering: {
        readonly requiredAdjustment: number;
        readonly direction: "LSL" | "USL" | "balanced";
        readonly display: { readonly requiredAdjustment: string };
      }) => string;
    }).formatMeanAdjustment;

    expect(formatMeanAdjustment).toEqual(expect.any(Function));
    if (formatMeanAdjustment === undefined) return;

    expect(formatMeanAdjustment({
      requiredAdjustment: 0,
      direction: "LSL",
      display: { requiredAdjustment: "0" },
    })).toBe("No adjustment required");
    expect(formatMeanAdjustment({
      requiredAdjustment: 0.01,
      direction: "balanced",
      display: { requiredAdjustment: "+0.01" },
    })).toBe("No adjustment required");
  });

  beforeAll(async () => {
    ({ buildAssumptionResultsInterpretation: actualBuildAssumptionResultsInterpretation } = await vi.importActual("../assumption-results-interpretation"));
    buildAssumptionResultsInterpretationSpy = vi.spyOn(assumptionResultsInterpretationModule, "buildAssumptionResultsInterpretation");
  });

  afterEach(() => {
    buildAssumptionResultsInterpretationSpy.mockReset();
    vi.unstubAllGlobals();
  });

  it("shows the header action for available and unavailable panels but only enables an available export", () => {
    buildAssumptionResultsInterpretationSpy.mockImplementation(actualBuildAssumptionResultsInterpretation);
    const generatePdf = vi.fn(async (_request: AssumptionResultsPdfRequest) => (
      new Blob(["%PDF-1.7"], { type: "application/pdf" })
    ));
    const availableWrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot(), generatePdf },
    });
    const unavailableWrapper = mount(TAResultsInterpretation, {
      props: { session: unavailableInterpretationSnapshot(), generatePdf },
    });

    const header = availableWrapper.get(".interpretation-header");
    expect(header.element.firstElementChild?.tagName).toBe("H2");
    const availableButton = header.get("[data-generate-assumption-results-pdf]");
    expect(availableButton.text()).toContain("Generate PDF");
    expect(availableButton.find("svg").exists()).toBe(true);
    expect(availableButton.attributes("disabled")).toBeUndefined();
    const unavailableButton = unavailableWrapper.get("[data-generate-assumption-results-pdf]");
    expect(unavailableButton.attributes("disabled")).toBeDefined();
    expect(unavailableButton.attributes("title")).toContain("available assumption results");
  });

  it("maps the exact displayed interpretation into the structured PDF request", async () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    const projected = {
      ...available,
      processGuidance: {
        status: "available" as const,
        version: "process-requirements-v3" as const,
        entries: processGuidanceEntries(),
      },
    };
    buildAssumptionResultsInterpretationSpy.mockReturnValue(projected);
    const generatePdf = vi.fn(async (_request: AssumptionResultsPdfRequest) => (
      new Blob(["%PDF-1.7"], { type: "application/pdf" })
    ));
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:assumption-results"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot(), generatePdf },
    });

    await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");

    expect(generatePdf).toHaveBeenCalledWith({
      sessionId: "session-export-01",
      workbookName: "Gearbox: Design?.xlsx",
      worksheetName: "Anonymous/TA",
      resultJudgment: {
        status: projected.narrative.resultJudgment.status,
        headline: projected.narrative.resultJudgment.headline,
      },
      resultSummaryCaption: "Comparison of assumption-based RSS results with system specifications and derived targets",
      summaryRows: projected.resultSummary.map((row) => ({
        metric: row.metric,
        result: row.result,
        reference: row.reference,
        ...(row.referenceDetail ? { referenceDetail: row.referenceDetail } : {}),
        difference: row.difference,
        assessment: row.assessment,
        performanceContext: row.performanceContext,
        ...(row.tone === "pass" || row.tone === "fail" || row.tone === "warning" ? { tone: row.tone } : {}),
      })),
      overallAssessment: projected.overallAssessment,
      rootCauseItems: projected.narrative.rootCauseAnalysis
        .filter((item) => item.ruleId !== "root-cause-contributor-concentration")
        .map((item) => ({
          title: item.title,
          narrative: item.narrative,
          hypothesisStatus: item.hypothesisStatus,
          incompleteEvidence: !item.completeEvidence,
          quantitativeEvidence: Object.entries(item.quantitativeEvidence ?? {}).map(([key, value]) => ({
            label: item.quantitativeEvidenceLabels?.[key] ?? key,
            value: expectedEvidenceValue(key, value),
          })),
        })),
      actionItems: projected.narrative.suggestedActionSequence.map((item) => ({
        optionId: item.optionId,
        title: item.title,
        narrative: item.optionId === "improvement-center-mean" && item.meanCentering
          ? item.meanCentering.feasibilityNarrative
          : item.narrative,
        ...(item.optionId === "improvement-center-mean" && item.meanCentering ? {
          meanCenteringAdjustment: {
            current: item.meanCentering.display.currentMean,
            recommended: item.meanCentering.display.targetMean,
            adjustment: taResultsInterpretationModule.formatMeanAdjustment(item.meanCentering),
          },
          outcome: {
            label: "Expected result",
            value: `Mean ${item.meanCentering.display.targetMean}`,
            context: "after applying the recommended adjustment",
          },
        } : {}),
        ...(item.optionId === "improvement-relax-final-specification" ? {
          specificationAdjustment: {
            lower: { current: "-0.1", recommended: "-0.37", adjustment: "-0.27" },
            upper: { current: "0.1", recommended: "0.43", adjustment: "+0.33" },
          },
          outcome: {
            label: "Expected result",
            value: "Cpk 1.33",
            context: "after applying both recommended limits",
          },
        } : {}),
      })),
      contributors: projected.contributorPriorities.map((item) => ({
        factorName: item.factorName,
        reference: item.reference,
        designNominal: item.designNominal,
        upperTolerance: item.upperTolerance,
        lowerTolerance: item.lowerTolerance,
        contributionPercent: item.contributionPercent,
        cumulativePercent: item.cumulativePercent,
      })),
      processGuidanceContext: "Evaluated against the current TA worksheet and analysis state.",
      processGuidance: processGuidanceEntries().map(({ state, title, message }) => ({ state, title, message })),
    });
  });

  it("disables the action and exposes busy state while PDF generation is pending", async () => {
    buildAssumptionResultsInterpretationSpy.mockImplementation(actualBuildAssumptionResultsInterpretation);
    let resolvePdf: ((blob: Blob) => void) | undefined;
    const generatePdf = vi.fn(async () => await new Promise<Blob>((resolve) => { resolvePdf = resolve; }));
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:pending"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot(), generatePdf },
    });

    await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");

    const button = wrapper.get("[data-generate-assumption-results-pdf]");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.attributes("aria-busy")).toBe("true");
    expect(button.text()).toContain("Generating PDF");
    resolvePdf?.(new Blob(["%PDF-1.7"], { type: "application/pdf" }));
    await vi.waitFor(() => expect(button.attributes("aria-busy")).toBe("false"));
  });

  it("does not download a stale session response or let its finally clear a newer generation", async () => {
    buildAssumptionResultsInterpretationSpy.mockImplementation(actualBuildAssumptionResultsInterpretation);
    const resolvePdf: Array<(blob: Blob) => void> = [];
    const generatePdf = vi.fn(async () => await new Promise<Blob>((resolve) => { resolvePdf.push(resolve); }));
    const createObjectURL = vi.fn(() => "blob:current");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot(), generatePdf },
    });

    await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");
    await wrapper.setProps({
      session: renamedInterpretationSnapshot({
        sessionId: "session-export-02",
        fileName: "Current.xlsx",
        worksheetName: "Current TA",
      }),
    });
    await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");
    expect(generatePdf).toHaveBeenCalledTimes(2);

    resolvePdf[0]?.(new Blob(["%PDF-stale"], { type: "application/pdf" }));
    await vi.waitFor(() => expect(resolvePdf).toHaveLength(2));
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(wrapper.get("[data-generate-assumption-results-pdf]").attributes("aria-busy")).toBe("true");

    resolvePdf[1]?.(new Blob(["%PDF-current"], { type: "application/pdf" }));
    await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(wrapper.get("[data-generate-assumption-results-pdf]").attributes("aria-busy")).toBe("false");
  });

  it("does not download a pending PDF after unmount", async () => {
    buildAssumptionResultsInterpretationSpy.mockImplementation(actualBuildAssumptionResultsInterpretation);
    let resolvePdf: ((blob: Blob) => void) | undefined;
    const generatePdf = vi.fn(async () => await new Promise<Blob>((resolve) => { resolvePdf = resolve; }));
    const createObjectURL = vi.fn(() => "blob:disposed");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot(), generatePdf },
    });

    await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");
    wrapper.unmount();
    resolvePdf?.(new Blob(["%PDF-1.7"], { type: "application/pdf" }));
    await Promise.resolve();
    await Promise.resolve();

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it("uses the click-time workbook and worksheet snapshot for the download filename", async () => {
    buildAssumptionResultsInterpretationSpy.mockImplementation(actualBuildAssumptionResultsInterpretation);
    let resolvePdf: ((blob: Blob) => void) | undefined;
    const generatePdf = vi.fn(async () => await new Promise<Blob>((resolve) => { resolvePdf = resolve; }));
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:snapshot-name"),
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot(), generatePdf },
    });

    await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");
    await wrapper.setProps({
      session: renamedInterpretationSnapshot({
        fileName: "Renamed.xlsx",
        worksheetName: "Renamed TA",
      }),
    });
    resolvePdf?.(new Blob(["%PDF-1.7"], { type: "application/pdf" }));

    await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
    const clickedAnchor = click.mock.instances[0] as HTMLAnchorElement | undefined;
    expect(clickedAnchor?.download).toBe("Gearbox-Design-Anonymous-TA-assumption-results.pdf");
  });

  it("downloads the PDF with a safe filename and always removes and revokes the temporary URL", async () => {
    buildAssumptionResultsInterpretationSpy.mockImplementation(actualBuildAssumptionResultsInterpretation);
    const pdf = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    const createObjectURL = vi.fn(() => "blob:download");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const wrapper = mount(TAResultsInterpretation, {
      props: {
        session: enhancedInterpretationSnapshot(),
        generatePdf: vi.fn(async () => pdf),
      },
    });

    await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");

    const clickedAnchor = click.mock.instances[0] as HTMLAnchorElement | undefined;
    expect(createObjectURL).toHaveBeenCalledWith(pdf);
    expect(clickedAnchor?.download).toBe("Gearbox-Design-Anonymous-TA-assumption-results.pdf");
    expect(clickedAnchor?.href).toContain("blob:download");
    expect(clickedAnchor?.isConnected).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download");
  });

  it("announces a successful PDF download with elapsed time", async () => {
    buildAssumptionResultsInterpretationSpy.mockImplementation(actualBuildAssumptionResultsInterpretation);
    let currentTime = 1_000;
    let resolvePdf: ((blob: Blob) => void) | undefined;
    const now = vi.spyOn(performance, "now").mockImplementation(() => currentTime);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:timed-download"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const wrapper = mount(TAResultsInterpretation, {
      props: {
        session: enhancedInterpretationSnapshot(),
        generatePdf: vi.fn(async () => await new Promise<Blob>((resolve) => { resolvePdf = resolve; })),
      },
    });

    await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");
    currentTime = 2_800;
    resolvePdf?.(new Blob(["%PDF-1.7"], { type: "application/pdf" }));
    await vi.waitFor(() => expect(wrapper.find("[data-assumption-results-pdf-status]").exists()).toBe(true));

    const status = wrapper.get("[data-assumption-results-pdf-status]");
    expect(status.attributes("aria-live")).toBe("polite");
    expect(status.text()).toBe("PDF downloaded in 1.8 seconds.");

    await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");
    expect(wrapper.find("[data-assumption-results-pdf-status]").exists()).toBe(false);
    now.mockRestore();
  });

  it("clears PDF success feedback when the session changes", async () => {
    buildAssumptionResultsInterpretationSpy.mockImplementation(actualBuildAssumptionResultsInterpretation);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:session-change"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const wrapper = mount(TAResultsInterpretation, {
      props: {
        session: enhancedInterpretationSnapshot(),
        generatePdf: vi.fn(async () => new Blob(["%PDF-1.7"], { type: "application/pdf" })),
      },
    });

    await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");
    expect(wrapper.find("[data-assumption-results-pdf-status]").exists()).toBe(true);

    await wrapper.setProps({
      session: renamedInterpretationSnapshot({
        sessionId: "session-export-02",
        fileName: "Current.xlsx",
        worksheetName: "Current TA",
      }),
    });

    expect(wrapper.find("[data-assumption-results-pdf-status]").exists()).toBe(false);
  });

  it("announces a controlled export failure without attempting a download", async () => {
    buildAssumptionResultsInterpretationSpy.mockImplementation(actualBuildAssumptionResultsInterpretation);
    const createObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const wrapper = mount(TAResultsInterpretation, {
      props: {
        session: enhancedInterpretationSnapshot(),
        generatePdf: vi.fn(async () => {
          throw {
            code: "pdf_failed",
            summary: "Unable to generate the assumption-results PDF.",
            suggestedAction: "Retry after restarting the local API.",
            affectedInputReferences: ["assumption-results"],
          };
        }),
      },
    });

    await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");

    const error = wrapper.get("[data-assumption-results-pdf-error]");
    expect(error.attributes("aria-live")).toBe("polite");
    expect(error.text()).toContain("Unable to generate the assumption-results PDF.");
    expect(error.text()).toContain("Retry after restarting the local API.");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("renders the governed engineering narrative hierarchy in the required reading order", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      processGuidance: {
        status: "available",
        version: "process-requirements-v3",
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
    expect(wrapper.findAll("[data-root-cause-item]")[1]?.text()).not.toContain("Tolerance Adjustment Priority (% Cont. to σ)");
    expect(wrapper.findAll("[data-root-cause-item]")[1]?.find("[data-contributor-pareto]").exists()).toBe(false);
    expect(wrapper.findAll("[data-root-cause-item]")[1]?.text()).not.toContain("Contributor concentration hypothesis");
    expect(wrapper.findAll("[data-root-cause-item]")[1]?.text()).toContain("State hypothesis");
    expect(wrapper.get("[data-root-cause-list]").element.tagName).toBe("OL");
    expect(wrapper.find("[data-engineering-risk]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Engineering Risk");
    expect(wrapper.findAll("[data-action-sequence-item]")).toHaveLength(3);
    expect(wrapper.findAll("[data-action-sequence-item]").map((item) => item.text())).toEqual([
      expect.stringContaining("improvement-center-mean"),
      expect.stringContaining("improvement-reduce-variation"),
      expect.stringContaining("improvement-relax-final-specification"),
    ]);
    const meanCenteringAction = wrapper.find("[data-action-sequence-item][data-option-id='improvement-center-mean']");
    const meanCenteringAdjustment = meanCenteringAction?.get("[data-mean-centering-adjustment]");
    expect(meanCenteringAction?.get("p").text()).toBe(
      "Confirm mean-centering feasibility before changing the process centerline.",
    );
    expect(meanCenteringAction?.get("p").text()).not.toContain("Current mean:");
    expect(meanCenteringAdjustment?.get("[data-mean-centering-table] caption").text()).toBe("Required mean change");
    expect(meanCenteringAdjustment?.findAll("[data-mean-centering-table] thead th").map((item) => item.text())).toEqual([
      "Parameter",
      "Current",
      "Recommended",
      "Adjustment",
    ]);
    expect(meanCenteringAdjustment?.get("[data-mean-centering-row]").findAll("th, td").map((cell) => cell.text())).toEqual([
      "Mean",
      "+0.03",
      "→ 0",
      "-0.03 toward LSL",
    ]);
    expect(meanCenteringAdjustment?.get("[data-mean-centering-outcome-label]").text()).toBe("Expected result");
    expect(meanCenteringAdjustment?.get("[data-mean-centering-outcome-value]").text()).toBe("Mean 0");
    expect(meanCenteringAdjustment?.get("small").text()).toBe("after applying the recommended adjustment");
    expect(wrapper.findAll("[data-action-sequence-item]")[1]?.text()).toContain(
      "investigate the dominant contributor before changing its tolerance or process controls",
    );
    expect(wrapper.findAll("[data-action-sequence-item]")[1]?.text()).toContain("Tolerance Adjustment Priority (% Cont. to σ)");
    expect(wrapper.findAll("[data-action-sequence-item]")[1]?.find("[data-contributor-pareto]").exists()).toBe(true);
    expect(wrapper.findAll("[data-contributor-pareto]")).toHaveLength(1);
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
    expect(processGuidance.findAll("[data-process-guidance-entry]")).toHaveLength(6);
    expect(processGuidance.get("ol").classes()).toContain("process-guidance-list");
    expect(processGuidance.get("ol").classes()).toContain("action-sequence");
    expect(processGuidance.findAll("[data-process-guidance-entry]").every((item) => (
      item.classes().includes("narrative-item")
    ))).toBe(true);
    expect(processGuidance.findAll("[data-process-guidance-entry]").map((item) => item.attributes("data-guidance-state"))).toEqual([
      "warning",
      "guidance",
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
      "Consider Worst Case for small stacks",
      "Check workbook evidence freshness",
      "Capture governed requirement linkage",
      "Schedule the next F0 review milestone",
      "Document the operator follow-up action",
    ]);
    expect(processGuidance.findAll("[data-process-guidance-entry-message]").map((item) => item.text())).toEqual([
      "Escalate to the owning engineering lead before closing the worksheet review.",
      "Consider Worst Case values when the tolerance stack contains fewer than 4 factors.",
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
        version: "process-requirements-v3",
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
    expect(chart.findAll("[data-pareto-bar-label]").map((label) => ({
      factorName: label.attributes("data-factor-name"),
      text: label.text(),
    }))).toEqual([
      { factorName: "Factor B", text: "50.00%" },
      { factorName: "Factor C", text: "30.00%" },
      { factorName: "Factor A", text: "20.00%" },
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
    expect(excessiveVariationItem.find("[data-pareto-layout]").exists()).toBe(false);
    const variationAction = wrapper.findAll("[data-action-sequence-item]")[1];
    if (!variationAction) throw new Error("expected reduce total variation action");
    const actionNarrative = variationAction.get("p").element;
    const paretoHeading = variationAction.findAll(".narrative-item-header")[1]?.element;
    if (!paretoHeading) throw new Error("expected tolerance adjustment priority heading");
    const pareto = variationAction.get("[data-pareto-layout]").element;
    expect(actionNarrative.compareDocumentPosition(paretoHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(paretoHeading.compareDocumentPosition(pareto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("omits tolerance adjustment priority when no contributor priorities are available", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      contributorPriorities: [],
    });

    const wrapper = mount(TAResultsInterpretation, {
      props: { session: enhancedInterpretationSnapshot() },
    });

    expect(wrapper.find("[data-contributor-pareto]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Tolerance Adjustment Priority (% Cont. to σ)");
  });

  it("omits the entire guidance section when no process guidance entries are available", () => {
    const available = actualBuildAssumptionResultsInterpretation(enhancedInterpretationSnapshot());
    if (available.status !== "available") throw new Error("expected available interpretation");
    buildAssumptionResultsInterpretationSpy.mockReturnValue({
      ...available,
      processGuidance: {
        status: "available",
        version: "process-requirements-v3",
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
    const interpretationText = wrapper.text();
    expect(rootCauseText).toContain("Cp vs target gap");
    expect(rootCauseText).toContain("Cp-Cpk gap");
    expect(rootCauseText).toContain("Specification midpoint");
    expect(rootCauseText).toContain("Mean offset");
    expect(rootCauseText).toContain("Direction");
    expect(interpretationText).toContain("Contributor");
    expect(interpretationText).toContain("% Cont. to σ");
    expect(interpretationText).toContain("Cumulative");
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