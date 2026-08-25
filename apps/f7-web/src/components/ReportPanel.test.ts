import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
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
        cp: 5 / 3,
        lowerCpk: 5 / 3,
        upperCpk: 5 / 3,
        cpk: 5 / 3,
        targetCpk,
        targetStatus: assessment === "MEETS_TARGET" ? "meets_target" as const : "below_target" as const,
      };
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

  return {
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
      approvedDistribution: "normal",
      sourceReferences: ["Analysis-A!A2", "clipboard-run-1"],
    }],
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
  };
}

const histogramStub = {
  name: "MonteCarloHistogram",
  props: ["result"],
  template: "<div data-histogram-stub />",
};

function mountReport(report = createReport()) {
  return mount(ReportPanel, {
    props: { report },
    global: { stubs: { MonteCarloHistogram: histogramStub } },
  });
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
    expect(REPORT_PANEL_SOURCE).toMatch(/\.evidence-details\s*\{[^}]*min-width:\s*0;/s);
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

  it("renders governed metrics and passes the report simulation to the histogram unchanged", () => {
    const report = createReport();
    const wrapper = mountReport(report);
    const metrics = wrapper.get("[data-report-metrics]");

    expect(metrics.text()).toContain("99.97%");
    expect(metrics.text()).toContain("Std. deviation");
    expect(metrics.text()).toContain("1.666667");
    expect(metrics.text()).toContain("Target Cpk");
    expect(metrics.text()).toContain("300");
    expect(wrapper.getComponent(histogramStub).props("result")).toBe(report.simulation);
  });

  it("uses scientific notation instead of rounding tiny non-zero metrics or boundary percentages", () => {
    const report = createReport();
    report.summary.standardDeviation = 0.000000004321;
    report.summary.ppm = 0.000000000987;
    report.summary.yield = 0.999999999999;
    const wrapper = mountReport(report);
    const metrics = wrapper.get("[data-report-metrics]").text();

    expect(metrics).toContain("4.32e-9");
    expect(metrics).toContain("9.87e-10");
    expect(metrics).toContain("100% - 1e-10%");
    expect(metrics).not.toMatch(/Std\. deviation\s*0(?:\D|$)/);
    expect(metrics).not.toMatch(/Observed PPM\s*0(?:\D|$)/);
  });

  it("omits Cp and Cpk values when capability is not evaluable but shows target and reason", () => {
    const wrapper = mountReport(createReport("NOT_EVALUABLE"));
    const metrics = wrapper.get("[data-report-metrics]");

    expect(metrics.find("[data-metric-cp]").exists()).toBe(false);
    expect(metrics.find("[data-metric-cpk]").exists()).toBe(false);
    expect(metrics.text()).toContain("Target Cpk");
    expect(metrics.text()).toContain("Not evaluable");
    expect(metrics.text()).toContain("Zero variance");
  });

  it("renders simulation, factor, and closed evidence details", () => {
    const wrapper = mountReport();
    const text = wrapper.text();
    const details = wrapper.get("details[data-report-evidence]");
    const evidenceRows = details.findAll(".evidence-list > div");
    const worksheetValue = evidenceRows.find((row) => row.get("dt").text() === "Worksheet")?.get("dd");
    const specificationSourceValue = evidenceRows
      .find((row) => row.get("dt").text() === "Specification source cells")
      ?.get("dd");

    expect(text).toContain("Monte Carlo summary");
    expect(text).toContain("Mean");
    expect(text).toContain("P0.135");
    expect(text).toContain("P99.865");
    expect(text).toContain("Independent");
    expect(wrapper.get("table[aria-label='Factor models'] caption").text()).toContain("Factor models");
    expect(text).toContain("Gap");
    expect(text).toContain("MEASURED");
    expect(text).toContain("normal");
    expect(text).toContain("Analysis-A!A2");
    expect(details.attributes("open")).toBeUndefined();
    expect(details.text()).toContain(WORKBOOK_HASH);
    expect(details.text()).toContain("LSL: Excel source Analysis-A!B2");
    expect(details.text()).toContain("USL: Excel source Analysis-A!B3");
    expect(details.text()).toContain("Target sigma: Excel source Analysis-A!B4");
    expect(details.text()).toContain("F7_MONTE_CARLO_V1");
    expect(details.text()).toContain(RUN_SEED);
    expect(details.text()).toContain("10,000");
    expect(details.text()).toContain("Generated at");
    expect(details.text()).toContain("2026-08-25");
    expect(details.text()).toContain("Factor manifest");
    expect(worksheetValue?.classes()).toContain("evidence-value");
    expect(specificationSourceValue?.classes()).toContain("evidence-value");
  });

  it("distinguishes manual specification overrides and entries from Excel sources", () => {
    const report = createReport();
    report.evidence.specificationInputOrigins = {
      lowerSpecLimit: "manual_override",
      upperSpecLimit: "manual_entry",
      targetSigmaLevel: "excel_source",
    };
    delete report.evidence.specificationSourceCells.lowerSpecLimit;
    delete report.evidence.specificationSourceCells.upperSpecLimit;
    const details = mountReport(report).get("details[data-report-evidence]").text();

    expect(details).toContain("LSL: Manual override");
    expect(details).toContain("USL: Manual entry");
    expect(details).toContain("Target sigma: Excel source Analysis-A!B4");
    expect(details).not.toContain("LSL: Not available");
    expect(details).not.toContain("USL: Not available");
  });

  it("emits close from the report back button", async () => {
    const wrapper = mountReport();

    expect(wrapper.get("[data-report-back]").text()).toBe("Back to Monte Carlo");

    await wrapper.get("[data-report-back]").trigger("click");

    expect(wrapper.emitted("close")).toEqual([[]]);
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
        stubs: { MonteCarloHistogram: histogramStub },
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
    expect(REPORT_PANEL_SOURCE).toMatch(/\.long-value\s*{[^}]*min-width:\s*0/s);
    expect(REPORT_PANEL_SOURCE).toMatch(
      /\.evidence-value\s*{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere[^}]*word-break:\s*break-word/s,
    );
    expect(REPORT_PANEL_SOURCE).toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*?\.report-header\s*{[^}]*flex-direction:\s*column/s);
    expect(REPORT_PANEL_SOURCE).not.toMatch(/@media\s*\(max-width:\s*720px\)[\s\S]*?\.report-header[^}]*grid-template-columns/s);
    expect(REPORT_PANEL_SOURCE).not.toMatch(/font-size:\s*[^;]*(?:vw|dvw|svw|lvw)/);
  });
});
