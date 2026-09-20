import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { f7ReportProjectionSchema } from "@ai-assist/contracts";
import type { F7ReportProjection } from "../api/f7-client";
import ReportPanel from "./ReportPanel.vue";
import REPORT_PANEL_SOURCE from "./ReportPanel.vue?raw";

const WORKBOOK_HASH = "a".repeat(64);
const RUN_SEED = "b".repeat(64);

function createReport(
  assessment: F7ReportProjection["assessment"] = "MEETS_TARGET",
): F7ReportProjection {
  const notEvaluable = assessment === "NOT_EVALUABLE";
  const targetSigmaLevel = assessment === "MEETS_TARGET" ? 3 : 6;
  const targetCpk = targetSigmaLevel / 3;
  const standardDeviation = notEvaluable ? 0 : 0.1;
  const inSpecCount = notEvaluable ? 10_000 : 9_997;
  const outOfSpecCount = 10_000 - inSpecCount;
  const histogramBins = Array.from({ length: 20 }, (_, index) => ({
    minimum: index - 10,
    maximum: index - 9,
    observedCount: index === 10 ? inSpecCount : index === 11 ? outOfSpecCount : 0,
  }));
  const factorManifest = [{
    factorId: WORKBOOK_HASH,
    family: "normal" as const,
    sourceMode: "MEASURED" as const,
  }];
  const capability = notEvaluable
    ? { status: "not_available" as const, reason: "zero_variance" as const, targetCpk }
    : {
        status: "available" as const,
        cp: (0.5 - -0.5) / (6 * standardDeviation),
        lowerCpk: (0.012345 - -0.5) / (3 * standardDeviation),
        upperCpk: (0.5 - 0.012345) / (3 * standardDeviation),
        cpk: Math.min((0.012345 - -0.5) / (3 * standardDeviation), (0.5 - 0.012345) / (3 * standardDeviation)),
        targetCpk,
        targetStatus: assessment === "MEETS_TARGET" ? "meets_target" as const : "below_target" as const,
      };
  const narrativeStatus = capability.status === "available" && capability.cpk >= capability.targetCpk
    ? "meets-target"
    : "below-target";
  const narrativeHeadline = narrativeStatus === "meets-target"
    ? "Capability meets target"
    : "Capability is below target";
  const narrativeCpk = capability.status === "available" ? capability.cpk : 0;
  const narrativeTargetCpk = capability.targetCpk;
  const narrativeMargin = narrativeCpk - narrativeTargetCpk;
  const simulation: F7ReportProjection["simulation"] = {
    methodId: "F7_MONTE_CARLO_V1",
    status: "complete",
    lowerSpecLimit: -0.5,
    upperSpecLimit: 0.5,
    targetSigmaLevel,
    iterations: 10_000,
    runSeed: RUN_SEED,
    correlationMode: "INDEPENDENT",
    mean: 0.012345,
    standardDeviation,
    quantiles: notEvaluable
      ? { p00135: 0, p01: 0, p05: 0, p50: 0, p95: 0, p99: 0, p99865: 0 }
      : { p00135: -0.3, p01: -0.23, p05: -0.16, p50: 0.01, p95: 0.18, p99: 0.25, p99865: 0.31 },
    inSpecCount,
    outOfSpecCount,
    yield: inSpecCount / 10_000,
    outOfSpecProbability: outOfSpecCount / 10_000,
    ppm: outOfSpecCount * 100,
    histogram: { methodId: "F7_HISTOGRAM_FD_V1", bins: histogramBins },
    normalFit: {
      methodId: "F7_NORMAL_MOMENT_FIT_V1",
      mean: 0.012345,
      standardDeviation,
      expectedBinCounts: histogramBins.map((bin) => bin.observedCount),
    },
    capability,
    normalModel: notEvaluable
      ? { status: "not_available", reason: "zero_variance" }
      : {
          status: "available",
          lowerTailDpm: 100,
          upperTailDpm: 200,
          totalDpm: 300,
          expectedYield: 0.9997,
        },
    factorManifest,
  };

  return f7ReportProjectionSchema.parse({
    contractId: "f7-report-v1",
    outputClassification: "confidential",
    sessionId: "session-1",
    generatedAt: "2026-08-25T08:00:00.000Z",
    assessment,
    workbook: {
      fileName: "Demo fixture (rev 2).xlsx",
      workbookContentHash: WORKBOOK_HASH,
      worksheetName: "Analysis-A",
    },
    summary: {
      mean: simulation.mean,
      standardDeviation,
      yield: simulation.yield,
      ppm: simulation.ppm,
      lowerSpecLimit: simulation.lowerSpecLimit,
      upperSpecLimit: simulation.upperSpecLimit,
      targetSigmaLevel,
      ...(capability.status === "available" ? { cp: capability.cp, cpk: capability.cpk } : {}),
      targetCpk,
    },
    simulation,
    factors: [{
      factorId: WORKBOOK_HASH,
      factorName: "Gap",
      loopCoefficient: 1,
      sourceMode: "MEASURED",
      designNominal: 0,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      longTermSafetyFactor: 1,
      sigmaLevel: 4,
      setupDistribution: "Normal",
      setupMean: 0,
      setupTolerance: 0.1,
      setupOneSigma: 0.025,
      setupCpk: 4 / 3,
      percentContributionToSigma: 1,
      sampleCount: 25,
      readiness: "ready",
      measurementWarning: false,
      approvedDistribution: "normal",
      sourceReferences: ["Analysis-A!A2", "clipboard-run-1"],
    }],
    analysis: notEvaluable
      ? {
          status: "unavailable",
          reason: "TA comparison is unavailable because Monte Carlo capability is not evaluable.",
          optimizationDirections: ["Resolve variation evidence and rerun Monte Carlo."],
        }
      : {
          status: "available",
          provenance: {
            knowledgeBaseVersion: "v1",
            ruleId: "default-cpk-target",
            threshold: narrativeTargetCpk,
            applicability: "public demo process capability",
          },
          comparison: {
            setup: { mean: 0, standardDeviation: 0.08, cp: 2.083333, cpk: 2.083333 },
            monteCarlo: {
              mean: simulation.mean,
              standardDeviation,
              cp: capability.status === "available" ? capability.cp : 0,
              cpk: capability.status === "available" ? capability.cpk : 0,
            },
          },
          narrative: {
            resultJudgment: {
              status: narrativeStatus,
              headline: narrativeHeadline,
              judgment: narrativeMargin >= 0
                ? `Cpk ${narrativeCpk.toFixed(3)} is ${narrativeMargin.toFixed(3)} above the resolved target of ${narrativeTargetCpk.toFixed(2)}.`
                : `Cpk ${narrativeCpk.toFixed(3)} is ${Math.abs(narrativeMargin).toFixed(3)} below the resolved target of ${narrativeTargetCpk.toFixed(2)}.`,
              cpk: narrativeCpk,
              targetCpk: narrativeTargetCpk,
              margin: narrativeMargin,
              display: {
                cpk: narrativeCpk.toFixed(3),
                targetCpk: narrativeTargetCpk.toFixed(2),
                margin: `${narrativeMargin >= 0 ? "+" : ""}${narrativeMargin.toFixed(3)}`,
              },
              nearerSpecificationSide: "balanced",
            },
            engineeringSummary: "Monte Carlo capability meets target for this fixture while remaining subject to governed validation requirements.",
            rootCauseAnalysis: [
              {
                ruleId: "root-cause-excessive-variation",
                sourceAlias: "F0",
                sourceFileHash: WORKBOOK_HASH,
                title: "RC01 Excessive variation hypothesis",
                hypothesis: true,
                explanation: "Variation evidence should still be validated before reusing this interpretation beyond the fixture.",
                completeEvidence: true,
                quantitativeEvidence: {
                  cpk: narrativeCpk,
                  targetCpk: narrativeTargetCpk,
                },
                quantitativeEvidenceLabels: {
                  cpk: "Cpk",
                  targetCpk: "Target Cpk",
                },
              },
            ],
            engineeringRisk: "Even when capability meets target, governed validation is still required before operational use.",
            suggestedActionSequence: [
              {
                sourceAlias: "F0",
                sourceFileHash: WORKBOOK_HASH,
                title: "Reduce total variation",
                validationSteps: ["Confirm the measured variation evidence remains representative."],
                optionId: "improvement-reduce-variation",
                narrative: "Preserve the current margin by keeping measured variation stable and rerunning the governed evaluation when inputs change.",
              },
            ],
            validationRequirements: ["Confirm the measured variation evidence remains representative."],
            evidenceDisclosure: "Measured Monte Carlo evidence is scenario-specific and still requires governed validation.",
          },
          targetAssessment: narrativeMargin >= 0
            ? `Monte Carlo Cpk ${narrativeCpk.toFixed(3)} meets the F0 default target of ${narrativeTargetCpk.toFixed(2)}.`
            : `Monte Carlo Cpk ${narrativeCpk.toFixed(3)} is below the F0 default target of ${narrativeTargetCpk.toFixed(2)}.`,
          interpretations: ["Measured variation is wider than the Factor Setup assumption."],
          optimizationDirections: ["Prioritize reducing and stabilizing measured within-factor variation."],
          rootCauseSignals: [
            {
              ruleId: "root-cause-excessive-variation",
              title: "RC01 Excessive variation hypothesis",
              sourceAlias: "F0",
              sourceFileHash: WORKBOOK_HASH,
            },
          ],
          controlledOptions: [
            {
              ruleId: "improvement-reduce-variation",
              title: "Reduce total variation",
              sourceAlias: "F0",
              sourceFileHash: WORKBOOK_HASH,
            },
          ],
          validationRequirements: [
            "Confirm the measured variation evidence remains representative.",
          ],
        },
    evidence: {
      workbookContentHash: WORKBOOK_HASH,
      worksheetName: "Analysis-A",
      specificationSourceCells: {
        lowerSpecLimit: "Analysis-A!B2",
        upperSpecLimit: "Analysis-A!B3",
        targetSigmaLevel: "Analysis-A!B4",
      },
      specificationInputOrigins: {
        lowerSpecLimit: "excel_source",
        upperSpecLimit: "excel_source",
        targetSigmaLevel: "excel_source",
      },
      methodIds: {
        simulation: "F7_MONTE_CARLO_V1",
        histogram: "F7_HISTOGRAM_FD_V1",
        normalFit: "F7_NORMAL_MOMENT_FIT_V1",
      },
      seed: RUN_SEED,
      iterations: 10_000,
      factorManifest,
    },
    markdown: "# F7 Report\n\nExact markdown bytes: π\n",
  });
}

function mountReport(report = createReport()) {
  return mount(ReportPanel, { props: { report } });
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ReportPanel", () => {
  it("contains wide report content within the mobile report column", () => {
    expect(REPORT_PANEL_SOURCE).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(REPORT_PANEL_SOURCE).toMatch(/\.assessment-banner\s*\{[^}]*min-width:\s*0;/s);
  });

  it.each([
    ["MEETS_TARGET", "Meets target"],
    ["BELOW_TARGET", "Below target"],
    ["NOT_EVALUABLE", "Not evaluable"],
  ] as const)("renders the %s assessment with an explicit decision disclaimer", (assessment, label) => {
    const wrapper = mountReport(createReport(assessment));
    const banner = wrapper.get("[data-report-assessment]");

    expect(banner.attributes("data-assessment")).toBe(assessment);
    expect(banner.text()).toContain(label);
    expect(banner.text()).toContain("not a design or production Release/Hold decision");
    expect(banner.attributes("role")).toBe("status");
  });

  it("does not repeat the Monte Carlo histogram or percentile summary", () => {
    const wrapper = mountReport();

    expect(wrapper.find(".monte-carlo-histogram").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("P0.135");
    expect(wrapper.text()).not.toContain("P99.865");
  });

  it("leads with the Setup versus Monte Carlo comparison and F0 optimization guidance", () => {
    const wrapper = mountReport();
    const comparison = wrapper.get("[data-report-ta-comparison]");
    const guidance = wrapper.get("[data-report-f0-guidance]");

    expect(comparison.text()).toContain("Factor Setup assumption");
    expect(comparison.text()).toContain("Measured-data Monte Carlo");
    expect(comparison.text()).toContain("Mean");
    expect(comparison.text()).toContain("Standard deviation");
    expect(comparison.text()).toContain("Cp");
    expect(comparison.text()).toContain("Cpk");
    expect(comparison.text()).toContain("CPL");
    expect(comparison.text()).toContain("CPU");
    expect(comparison.text()).toContain("Lower DPM");
    expect(comparison.text()).toContain("Upper DPM");
    expect(comparison.text()).toContain("Total DPM");
    expect(comparison.text()).toContain("% Out of Spec");
    expect(guidance.text()).toContain("Measured variation is wider");
    expect(guidance.text()).toContain("Engineering Risks & Recommended Actions");
    expect(guidance.text()).toContain("Prioritize reducing and stabilizing");
    expect(guidance.find(".risk-lead").exists()).toBe(false);
    expect(guidance.text()).not.toContain("governed validation is still required before operational use");
    expect(wrapper.find("[data-report-actions]").exists()).toBe(false);
    expect(wrapper.find("[data-report-methodology]").exists()).toBe(false);
  });

  it("presents the analysis as an engineering decision dashboard", () => {
    const report = createReport();
    if (report.analysis?.status !== "available") throw new Error("expected available analysis");
    report.simulation.factorContributions = [{
      methodId: "F7_INDEPENDENT_VARIANCE_CONTRIBUTION_V1",
      factorId: WORKBOOK_HASH,
      family: "normal",
      sourceMode: "MEASURED",
      coefficient: 1,
      standardDeviation: 0.1,
      weightedVariance: 0.01,
      contribution: 1,
    }];
    const wrapper = mountReport(report);

    expect(wrapper.get("[data-executive-summary]").text()).toContain("Executive Summary");
    expect(wrapper.get("[data-report-decision]").attributes("data-assessment")).toBe("MEETS_TARGET");
    expect(wrapper.get("[data-report-metric='mean']").findAll("td").map((cell) => cell.text())).toEqual([
      "0",
      "0.012",
      "+0.012 (+1.23%)",
    ]);
    expect(wrapper.get("[data-report-metric='standardDeviation']").findAll("td").map((cell) => cell.text())).toEqual([
      "0.08",
      "0.1",
      "+0.02 (+25%)",
    ]);
    expect(wrapper.get("[data-report-difference='standardDeviation']").classes()).toContain("actual-value-severity-critical");
    expect(wrapper.get("[data-report-metric='cp']").findAll("td").map((cell) => cell.text())).toEqual([
      "2.0833",
      "1.6667",
      "-0.4167 (-20%)",
    ]);
    expect(wrapper.get("[data-report-difference='cp']").classes()).toContain("actual-value-severity-critical");
    expect(REPORT_PANEL_SOURCE).toMatch(/\.report-difference\s*\{[^}]*background:\s*#fff/s);
    expect(REPORT_PANEL_SOURCE).not.toMatch(/\.report-difference\.actual-value-severity-(?:attention|critical)\s*\{[^}]*background:/s);
    expect(wrapper.get("[data-report-metric='cpl'] [data-monte-carlo-value]").text()).toBe("1.7078");
    expect(wrapper.get("[data-report-metric='cpu'] [data-monte-carlo-value]").text()).toBe("1.6255");
    expect(wrapper.get("[data-report-metric='lowerDpm'] [data-monte-carlo-value]").text()).toBe("100 DPM");
    expect(wrapper.get("[data-report-metric='upperDpm'] [data-monte-carlo-value]").text()).toBe("200 DPM");
    expect(wrapper.get("[data-report-metric='totalDpm'] [data-monte-carlo-value]").text()).toBe("300 DPM");
    expect(wrapper.get("[data-report-metric='outOfSpec'] [data-monte-carlo-value]").text()).toBe("0.03%");
    expect(wrapper.get("[data-report-top-contributors]").text()).toContain("Gap");
    const decision = wrapper.get("[data-report-risk-summary]");
    expect(decision.text()).toContain("Engineering Risks & Recommended Actions");
    expect(decision.text()).toContain("Recommended Actions");
    expect(wrapper.text()).not.toContain("Controlled improvement sequence");
    expect(wrapper.text()).not.toContain("Methodology and run provenance");
  });

  it("renders DPM values as whole-part counts", () => {
    const report = createReport();
    if (report.analysis?.status !== "available") throw new Error("expected available analysis");
    report.analysis.comparison.setup.standardDeviation = 0.2;
    report.simulation.normalModel = {
      status: "available",
      lowerTailDpm: 13_250.095074,
      upperTailDpm: 90_896.990782,
      totalDpm: 104_147.085856,
      expectedYield: 0.895852914144,
    };
    const wrapper = mountReport(report);

    expect(wrapper.get("[data-report-metric='lowerDpm'] [data-monte-carlo-value]").text()).toBe("13,250 DPM");
    expect(wrapper.get("[data-report-metric='upperDpm'] [data-monte-carlo-value]").text()).toBe("90,897 DPM");
    expect(wrapper.get("[data-report-metric='totalDpm'] [data-monte-carlo-value]").text()).toBe("104,147 DPM");
    expect(wrapper.get("[data-report-difference='lowerDpm']").text()).toMatch(/^[-+]?\d[\d,]* \([-+]?\d[\d,.]*%\)$/);
    expect(wrapper.get("[data-report-difference='upperDpm']").text()).toMatch(/^[-+]?\d[\d,]* \([-+]?\d[\d,.]*%\)$/);
    expect(wrapper.get("[data-report-difference='totalDpm']").text()).toMatch(/^[-+]?\d[\d,]* \([-+]?\d[\d,.]*%\)$/);
    expect(wrapper.get("[data-report-difference='lowerDpm']").text()).toContain("(+113.38%)");
    expect(wrapper.get("[data-report-difference='upperDpm']").text()).toContain("(+1,363.8%)");
    expect(wrapper.get("[data-report-difference='totalDpm']").text()).toContain("(+738.59%)");
  });

  it("adds concrete engineering targets to each recommended action", () => {
    const wrapper = mountReport(createReport("BELOW_TARGET"));
    const actions = wrapper.findAll("[data-recommended-action]");

    expect(actions).toHaveLength(1);
    expect(actions[0]?.text()).toContain("Prioritize reducing and stabilizing");
    expect(actions[0]?.findAll("dt").map((item) => item.text())).toEqual(["Current σ", "Maximum σ", "Required reduction"]);
    expect(actions[0]?.findAll("dd").map((item) => item.text())).toEqual(["0.1", "0.081276", "0.018724 (18.72%)"]);

    const report = createReport("BELOW_TARGET");
    if (report.analysis?.status !== "available") throw new Error("expected available analysis");
    report.analysis.optimizationDirections = [
      "Center the process mean",
      "Reduce total variation",
      "Relax the final specification as a fallback",
    ];
    const complete = mountReport(report).findAll("[data-recommended-action]");

    expect(complete[0]?.findAll("dd").map((item) => item.text())).toEqual(["0.012345", "0", "-0.012345"]);
    expect(complete[2]?.findAll("dd").map((item) => item.text())).toEqual(["-0.5 / 0.5", "≤ -0.587655", "≥ 0.612345"]);
  });

  it("uses scientific notation instead of rounding a tiny non-zero comparison value", () => {
    const report = createReport();
    if (report.analysis?.status !== "available") throw new Error("expected available analysis");
    report.analysis.comparison.setup.mean = 0.000000004321;
    const wrapper = mountReport(report);
    const comparison = wrapper.get("[data-report-ta-comparison]").text();

    expect(comparison).toContain("4.32e-9");
  });

  it("shows the governed reason and recovery direction when analysis is not evaluable", () => {
    const wrapper = mountReport(createReport("NOT_EVALUABLE"));
    const unavailable = wrapper.get("[data-report-analysis-unavailable]");

    expect(wrapper.find("[data-report-ta-comparison]").exists()).toBe(false);
    expect(unavailable.text()).toContain("not evaluable");
    expect(unavailable.text()).toContain("Resolve variation evidence");
  });

  it("does not expose the internal evidence chain", () => {
    const wrapper = mountReport();

    expect(wrapper.find("[data-report-evidence]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Evidence chain");
  });

  it("downloads exact Markdown bytes with a safe filename and revokes the object URL", async () => {
    const report = createReport();
    const objectUrl = "blob:f7-report";
    const createObjectURL = vi.fn((_blob: Blob) => objectUrl);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const remove = vi.spyOn(HTMLAnchorElement.prototype, "remove");
    const wrapper = mountReport(report);

    await wrapper.get("[data-download-report]").trigger("click");

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("text/markdown;charset=utf-8");
    expect(await readBlob(blob)).toBe(report.markdown);
    expect(click).toHaveBeenCalledOnce();
    const clickedAnchor = click.mock.contexts[0] as HTMLAnchorElement | undefined;
    expect(clickedAnchor).toBeDefined();
    const anchor = clickedAnchor!;
    expect(anchor.download).toBe("Demo-fixture-rev-2-f7-report.md");
    expect(anchor.href).toBe(objectUrl);
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it.each([
    ["C:\\private\\runs\\" + "a".repeat(180) + "<>:\"|?*.xlsx", `${"a".repeat(120)}-f7-report.md`],
    ["C:\\private\\.xlsx", "f7-f7-report.md"],
    ["/private/分析报告.xlsx", "f7-f7-report.md"],
  ])("downloads %s without retaining directories or unsafe filename content", async (fileName, expected) => {
    const report = createReport();
    report.workbook.fileName = fileName;
    const objectUrl = "blob:f7-report";
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => objectUrl),
      revokeObjectURL: vi.fn(),
    });
    let download = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
    });
    const wrapper = mountReport(report);

    await wrapper.get("[data-download-report]").trigger("click");

    expect(download).toBe(expected);
    expect(download.length).toBeLessThan(255);
    expect(download).not.toMatch(/[\\/<>:"|?*]/);
  });

  it.each(["click", "remove"] as const)("revokes the object URL when anchor %s throws", async (operation) => {
    const objectUrl = "blob:f7-report";
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => objectUrl),
      revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      if (operation === "click") throw new Error("click failed");
    });
    vi.spyOn(HTMLAnchorElement.prototype, "remove").mockImplementation(() => {
      if (operation === "remove") throw new Error("remove failed");
    });
    const errorHandler = vi.fn();
    const wrapper = mount(ReportPanel, {
      props: { report: createReport() },
      global: {
        config: { errorHandler },
      },
    });

    wrapper.get("[data-download-report]").element.dispatchEvent(new MouseEvent("click"));

    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ message: `${operation} failed` }),
      expect.anything(),
      expect.anything(),
    );
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("uses an effective mobile header layout and permits long values to wrap", () => {
    expect(REPORT_PANEL_SOURCE).toMatch(/\.report-header\s*>\s*div,[^{]*{[^}]*min-width:\s*0/s);
    expect(REPORT_PANEL_SOURCE).toMatch(/\.report-header\s+\.subtle\s*{[^}]*overflow-wrap:\s*anywhere/s);
    expect(REPORT_PANEL_SOURCE).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*?\.report-header\s*{[^}]*flex-direction:\s*column/s);
    expect(REPORT_PANEL_SOURCE).not.toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*?\.report-header[^}]*grid-template-columns/s);
    expect(REPORT_PANEL_SOURCE).not.toMatch(/font-size:\s*[^;]*(?:vw|dvw|svw|lvw)/);
  });
});
