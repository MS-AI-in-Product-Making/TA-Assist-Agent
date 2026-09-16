import { access, rm, writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { f7ReportProjectionSchema, type F7ReportProjection } from "@ai-assist/contracts";
import {
  AssumptionResultsPdfQueueFullError,
} from "./assumption-results-pdf-renderer.js";
import {
  createF7ReportPdfRenderer,
  renderF7ReportPdfHtml,
  safeF7ReportPdfFileName,
  safeUnicodeF7ReportPdfFileName,
} from "./f7-report-pdf-renderer.js";

const HASH = "a".repeat(64);
const RUN_SEED = `${"0".repeat(60)}3039`;

function reportFixture(): F7ReportProjection {
  return {
    contractId: "f7-report-v1",
    outputClassification: "confidential",
    sessionId: "session-report",
    generatedAt: "2026-09-16T08:00:00.000Z",
    assessment: "BELOW_TARGET",
    workbook: {
      fileName: "Design <unsafe> 装配.xlsx",
      workbookContentHash: HASH,
      worksheetName: "TA / Result",
    },
    summary: {
      mean: -0.0257,
      standardDeviation: 0.0567,
      yield: 0.8945,
      ppm: 105_500,
      lowerSpecLimit: -0.15,
      upperSpecLimit: 0.05,
      targetSigmaLevel: 3,
      cp: (0.05 - -0.15) / (6 * 0.0567),
      cpk: (0.05 - -0.0257) / (3 * 0.0567),
      targetCpk: 1,
    },
    simulation: {
      methodId: "F7_MONTE_CARLO_V1",
      status: "complete",
      lowerSpecLimit: -0.15,
      upperSpecLimit: 0.05,
      targetSigmaLevel: 3,
      iterations: 10_000,
      runSeed: RUN_SEED,
      correlationMode: "INDEPENDENT",
      mean: -0.0257,
      standardDeviation: 0.0567,
      quantiles: { p00135: -0.2, p01: -0.15, p05: -0.1, p50: -0.0257, p95: 0.05, p99: 0.1, p99865: 0.15 },
      inSpecCount: 8945,
      outOfSpecCount: 1055,
      yield: 0.8945,
      outOfSpecProbability: 0.1055,
      ppm: 105_500,
      histogram: {
        methodId: "F7_HISTOGRAM_FD_V1",
        bins: Array.from({ length: 20 }, (_, index) => ({ minimum: index - 10, maximum: index - 9, observedCount: index === 0 ? 10_000 : 0 })),
      },
      normalFit: {
        methodId: "F7_NORMAL_MOMENT_FIT_V1",
        mean: -0.0257,
        standardDeviation: 0.0567,
        expectedBinCounts: Array.from({ length: 20 }, (_, index) => index === 0 ? 10_000 : 0),
      },
      capability: {
        status: "available",
        cp: (0.05 - -0.15) / (6 * 0.0567),
        lowerCpk: (-0.0257 - -0.15) / (3 * 0.0567),
        upperCpk: (0.05 - -0.0257) / (3 * 0.0567),
        cpk: (0.05 - -0.0257) / (3 * 0.0567),
        targetCpk: 1,
        targetStatus: "below_target",
      },
      normalModel: { status: "available", lowerTailDpm: 14_000, upperTailDpm: 91_500, totalDpm: 105_500, expectedYield: 0.8945 },
      factorManifest: [{ factorId: HASH, family: "normal", sourceMode: "BASELINE_ASSUMPTION" }],
    },
    factors: [{
      factorId: HASH,
      factorName: "Factor <A>",
      loopCoefficient: 1,
      sourceMode: "BASELINE_ASSUMPTION",
      approvedDistribution: "normal",
      sourceReferences: ["TA!G14"],
    }],
    analysis: {
      status: "available",
      provenance: {
        knowledgeBaseVersion: "interpretation-rules-v2",
        ruleId: "performance-cpk-below-target",
        threshold: 1,
        applicability: "one-dimensional",
      },
      comparison: {
        setup: { mean: -0.05, standardDeviation: 0.0451, cp: 0.7396, cpk: 0.7396 },
        monteCarlo: {
          mean: -0.0257,
          standardDeviation: 0.0567,
          cp: (0.05 - -0.15) / (6 * 0.0567),
          cpk: (0.05 - -0.0257) / (3 * 0.0567),
        },
      },
      targetAssessment: "Below target",
      interpretations: ["Mean shifted right."],
      optimizationDirections: ["Reduce variation."],
      rootCauseSignals: [{
        ruleId: "root-cause-variation",
        title: "Variation hypothesis",
        sourceAlias: "kb://root-cause",
        sourceFileHash: HASH,
      }],
      controlledOptions: [{
        ruleId: "improvement-reduce-variation",
        title: "Reduce variation",
        sourceAlias: "kb://action",
        sourceFileHash: HASH,
      }],
      validationRequirements: ["Confirm representative measurements."],
      narrative: {
        resultJudgment: {
          status: "below-target",
          headline: "Capability is below target",
          judgment: "Review required.",
          cpk: (0.05 - -0.0257) / (3 * 0.0567),
          targetCpk: 1,
          margin: (0.05 - -0.0257) / (3 * 0.0567) - 1,
          display: { cpk: "0.445", targetCpk: "1.000", margin: "-0.555" },
        },
        engineeringSummary: "Measured simulation indicates a capability shortfall.",
        rootCauseAnalysis: [{
          ruleId: "root-cause-variation",
          title: "Variation hypothesis",
          sourceAlias: "kb://root-cause",
          sourceFileHash: HASH,
          hypothesis: true,
          explanation: "Variation exceeds the available tolerance window.",
          completeEvidence: true,
        }],
        engineeringRisk: "Specification escapes remain possible.",
        suggestedActionSequence: [{
          optionId: "improvement-reduce-variation",
          title: "Reduce variation",
          sourceAlias: "kb://action",
          sourceFileHash: HASH,
          narrative: "Reduce dominant variation sources.",
          validationSteps: ["Repeat measurement study."],
        }],
        validationRequirements: ["Confirm representative measurements."],
        evidenceDisclosure: "Generated from governed Monte Carlo evidence.",
      },
    },
    evidence: {
      workbookContentHash: HASH,
      worksheetName: "TA / Result",
      specificationSourceCells: {},
      specificationInputOrigins: { lowerSpecLimit: "manual_entry", upperSpecLimit: "manual_entry", targetSigmaLevel: "manual_entry" },
      methodIds: { simulation: "F7_MONTE_CARLO_V1", histogram: "F7_HISTOGRAM_FD_V1", normalFit: "F7_NORMAL_MOMENT_FIT_V1" },
      seed: RUN_SEED,
      iterations: 10_000,
      factorManifest: [{ factorId: HASH, family: "normal", sourceMode: "BASELINE_ASSUMPTION" }],
    },
    markdown: "# F7 report",
  };
}

function reportWithoutAnalysisFixture(): F7ReportProjection {
  return {
    ...reportFixture(),
    analysis: undefined,
  };
}

describe("F7 report PDF renderer", () => {
  it("renders the governed report in Web order with chart, comparison, and F0 evidence", () => {
    const html = renderF7ReportPdfHtml(reportFixture());

    expect(html).toContain("F7 Monte Carlo Governed Result Report");
    expect(html).toContain("Design &lt;unsafe&gt; 装配.xlsx");
    expect(html).not.toContain("Design <unsafe> 装配.xlsx");
    expect(html).toContain("TA / Result");
    expect(html).toContain("Factor &lt;A&gt;");
    expect(html).not.toContain("Factor <A>");
    expect(html).toContain("<h2>TA interpretation and optimization report</h2><p class=\"subtle\">Design &lt;unsafe&gt; 装配.xlsx · TA / Result</p>");

    const orderedHeadings = [
      "Governed result",
      "Monte Carlo output distribution",
      "TA Comparison Matrix",
      "TA interpretation and optimization report",
      "Factor Setup vs Monte Carlo TA",
      "Interpretation and optimization direction",
      "Governed assessment",
      "Engineering Summary",
      "Root Cause Analysis",
      "Engineering Risk",
      "Suggested Action Sequence",
      "Validation Requirements",
      "Evidence Disclosure",
      "Reproducibility Evidence",
      "Factor evidence",
    ];
    let previousIndex = -1;
    for (const heading of orderedHeadings) {
      const headingIndex = html.indexOf(heading);
      expect(headingIndex, `${heading} should follow the previous governed section`).toBeGreaterThan(previousIndex);
      previousIndex = headingIndex;
    }

    expect(html).toContain("data-monte-carlo-chart");
    expect(html).toContain("data-monte-carlo-bin");
    expect(html).toContain("data-monte-carlo-fit");
    expect(html).toContain("data-factor-setup-fit");
    expect(html).toContain("data-factor-setup-mean");
    expect(html).toContain(">Setup Mean<");
    for (const referenceId of [
      "lower-spec-limit",
      "upper-spec-limit",
      "target",
      "mean",
      "minus-target-sigma",
      "plus-target-sigma",
    ]) {
      expect(html).toContain(`data-reference-id="${referenceId}"`);
    }
    expect(html.match(/<g><line class="plot-grid"/g)).toHaveLength(5);
    expect(html.match(/<g><line class="plot-tick"/g)).toHaveLength(5);
    for (const legendText of [
      "In specification",
      "Out of specification",
      "Crosses specification limit",
      "Moment-fitted Normal expected count",
      "Factor Setup TA Normal expected count",
      "Setup Mean",
      "Specification limits",
      "Target (specification midpoint)",
      "Target sigma range",
    ]) {
      expect(html).toContain(`>${legendText}<`);
    }
    expect(html).toContain("data-ta-comparison-matrix");
    expect(html).toContain("Metric");
    expect(html).toContain("Factor Setup TA");
    expect(html).toContain("Monte Carlo output");
    expect(html).toContain("Difference");
    expect(html).toContain("Reading");
    for (const metric of ["Mean", "Standard deviation", "Cp", "Cpk", "Yield", "Defect rate"]) {
      expect(html).toContain(`>${metric}<`);
    }
    for (const metadata of ["Iterations", "Median", "LSL / USL", "Target sigma / Cpk", "Run seed"]) {
      expect(html).toContain(`>${metadata}<`);
    }
    expect(html).toContain(">12345<");

    expect(html).toContain("Factor Setup vs Monte Carlo TA");
    expect(html).toContain("F0 interpretation-rules-v2 / performance-cpk-below-target");
    expect(html).toContain("Mean shifted right.");
    expect(html).toContain("Reduce variation.");
    expect(html).toContain("Applicability: one-dimensional");
    expect(html).toContain("Governed assessment");
    expect(html).toContain("This statistical assessment is not a design or production Release/Hold decision.");
    expect(html).toContain("Root Cause Analysis");
    expect(html).toContain("Engineering Risk");
    expect(html).toContain("Suggested Action Sequence");
    expect(html).toContain("Validation Requirements");
    expect(html).toContain("Evidence Disclosure");
    expect(html).toContain("Reproducibility Evidence");
    expect(html).not.toMatch(/(?:NaN|-?Infinity)/);
    expect(html).not.toMatch(/<script|https?:\/\//i);
  });

  it("places Setup Mean on a new label row when it overlaps every reference row", () => {
    const html = renderF7ReportPdfHtml(reportFixture());

    expect(html).toMatch(/<g data-factor-setup-mean class="factor-setup-mean"><line x1="416\.19" x2="416\.19" y1="72" y2="278"\/><text class="monte-carlo-reference-label" x="416\.19" y="106" text-anchor="middle">Setup Mean<\/text><\/g>/);
  });

  it("keeps every governed reference and finite geometry for extreme finite report values", () => {
    const report = reportFixture();
    if (!report.analysis || report.analysis.status !== "available") throw new Error("Expected available analysis fixture.");
    const maximum = Number.MAX_VALUE;
    const lowerSpecLimit = maximum / 2;
    const upperSpecLimit = maximum;
    const mean = maximum * 0.75;
    const standardDeviation = 2;
    const cp = (upperSpecLimit - lowerSpecLimit) / (6 * standardDeviation);
    const lowerCpk = (mean - lowerSpecLimit) / (3 * standardDeviation);
    const upperCpk = (upperSpecLimit - mean) / (3 * standardDeviation);
    const cpk = Math.min(lowerCpk, upperCpk);
    const targetCpk = maximum / 3;
    const extremeReport: F7ReportProjection = {
      ...report,
      summary: {
        ...report.summary,
        mean,
        standardDeviation,
        lowerSpecLimit,
        upperSpecLimit,
        targetSigmaLevel: maximum,
        cp,
        cpk,
        targetCpk,
      },
      simulation: {
        ...report.simulation,
        lowerSpecLimit,
        upperSpecLimit,
        targetSigmaLevel: maximum,
        mean,
        standardDeviation,
        histogram: {
          ...report.simulation.histogram,
          bins: Array.from({ length: 20 }, (_, index) => ({
            minimum: lowerSpecLimit * (1 - index / 20) + upperSpecLimit * (index / 20),
            maximum: lowerSpecLimit * (1 - (index + 1) / 20) + upperSpecLimit * ((index + 1) / 20),
            observedCount: 500,
          })),
        },
        normalFit: {
          ...report.simulation.normalFit,
          mean,
          standardDeviation,
          expectedBinCounts: Array.from({ length: 20 }, () => 500),
        },
        capability: {
          status: "available",
          cp,
          lowerCpk,
          upperCpk,
          cpk,
          targetCpk,
          targetStatus: "below_target",
        },
      },
      analysis: {
        ...report.analysis,
        provenance: {
          ...report.analysis.provenance,
          threshold: targetCpk,
        },
        comparison: {
          setup: {
            ...report.analysis.comparison.setup,
            mean,
            standardDeviation: maximum / 2,
          },
          monteCarlo: {
            mean,
            standardDeviation,
            cp,
            cpk,
          },
        },
        narrative: {
          ...report.analysis.narrative,
          resultJudgment: {
            ...report.analysis.narrative.resultJudgment,
            cpk,
            targetCpk,
            margin: cpk - targetCpk,
          },
        },
      },
    };

    f7ReportProjectionSchema.parse(extremeReport);
    const html = renderF7ReportPdfHtml(extremeReport);

    expect(html).not.toMatch(/(?:NaN|-?Infinity)/);
    for (const referenceId of [
      "lower-spec-limit",
      "upper-spec-limit",
      "target",
      "mean",
      "minus-target-sigma",
      "plus-target-sigma",
    ]) {
      expect(html).toContain(`data-reference-id="${referenceId}"`);
    }
    const tickLabels = [...html.matchAll(/<text class="plot-tick-label"[^>]*>([^<]+)<\/text>/g)]
      .map((match) => match[1] ?? "");
    expect(tickLabels.length).toBeGreaterThan(0);
    expect(Math.max(...tickLabels.map((label) => label.length))).toBeLessThanOrEqual(16);
  });

  it("uses the Web mean-shift threshold for displayed comparison direction", () => {
    const report = reportFixture();
    if (!report.analysis || report.analysis.status !== "available") throw new Error("Expected available analysis fixture.");
    const setupMean = -0.0258;
    const simulationMean = -0.0257;
    const html = renderF7ReportPdfHtml({
      ...report,
      simulation: {
        ...report.simulation,
        mean: simulationMean,
      },
      analysis: {
        ...report.analysis,
        comparison: {
          ...report.analysis.comparison,
          setup: {
            ...report.analysis.comparison.setup,
            mean: setupMean,
          },
          monteCarlo: {
            ...report.analysis.comparison.monteCarlo,
            mean: simulationMean,
          },
        },
      },
    });
    const meanRow = html.match(/<tr><th>Mean<\/th>.*?<\/tr>/)?.[0];

    expect(meanRow).toBeDefined();
    expect(meanRow).toContain("<td>Shifted right</td>");
  });

  it("preserves very small non-zero report values with scientific notation", () => {
    const report = reportFixture();
    if (!report.analysis || report.analysis.status !== "available") throw new Error("Expected available analysis fixture.");
    const html = renderF7ReportPdfHtml({
      ...report,
      analysis: {
        ...report.analysis,
        comparison: {
          setup: {
            ...report.analysis.comparison.setup,
            mean: 1e-9,
          },
          monteCarlo: {
            ...report.analysis.comparison.monteCarlo,
            mean: 2e-9,
          },
        },
      },
    });

    expect(html).toContain("<td>1e-9</td>");
    expect(html).toContain("<td>2e-9</td>");
  });

  it("reports comparison unavailable when the setup spread change is non-finite", () => {
    const report = reportFixture();
    if (!report.analysis || report.analysis.status !== "available") throw new Error("Expected available analysis fixture.");
    const html = renderF7ReportPdfHtml({
      ...report,
      analysis: {
        ...report.analysis,
        comparison: {
          ...report.analysis.comparison,
          setup: {
            ...report.analysis.comparison.setup,
            standardDeviation: Number.MIN_VALUE,
          },
        },
      },
    });
    const standardDeviationRow = html.match(/<tr><th>Standard deviation<\/th>.*?<\/tr>/)?.[0];

    expect(standardDeviationRow).toBeDefined();
    expect(standardDeviationRow).toContain("<td>N/A</td><td>Comparison unavailable</td>");
    expect(standardDeviationRow).not.toContain("No material change");
  });

  it.each([
    ["setup mean", Number.MAX_VALUE, -Number.MAX_VALUE],
    ["Monte Carlo mean", -Number.MAX_VALUE, Number.MAX_VALUE],
  ])("reports comparison unavailable when the extreme %s makes the mean delta non-finite", (_, setupMean, simulationMean) => {
    const report = reportFixture();
    if (!report.analysis || report.analysis.status !== "available") throw new Error("Expected available analysis fixture.");
    const html = renderF7ReportPdfHtml({
      ...report,
      simulation: {
        ...report.simulation,
        mean: simulationMean,
      },
      analysis: {
        ...report.analysis,
        comparison: {
          ...report.analysis.comparison,
          setup: {
            ...report.analysis.comparison.setup,
            mean: setupMean,
          },
        },
      },
    });
    const meanRow = html.match(/<tr><th>Mean<\/th>.*?<\/tr>/)?.[0];

    expect(meanRow).toBeDefined();
    expect(meanRow).toContain("<td>N/A</td><td>Comparison unavailable</td>");
    expect(meanRow).not.toMatch(/Shifted (?:right|left)/);
  });

  it("styles the target midpoint legend swatch", () => {
    const html = renderF7ReportPdfHtml(reportFixture());

    expect(html).toMatch(/\.legend-center-target \{ background: #[0-9a-f]{6};/i);
  });

  it("renders a continuous Factor Setup curve through its mean and scales for the sample peak", () => {
    const report = reportFixture();
    if (!report.analysis || report.analysis.status !== "available") throw new Error("Expected available analysis fixture.");
    const html = renderF7ReportPdfHtml({
      ...report,
      simulation: {
        ...report.simulation,
        iterations: 1_000,
        histogram: {
          ...report.simulation.histogram,
          bins: Array.from({ length: 20 }, (_, index) => ({
            minimum: index - 10,
            maximum: index - 9,
            observedCount: 0,
          })),
        },
        normalFit: {
          ...report.simulation.normalFit,
          expectedBinCounts: Array.from({ length: 20 }, () => 0),
        },
      },
      analysis: {
        ...report.analysis,
        comparison: {
          ...report.analysis.comparison,
          setup: {
            ...report.analysis.comparison.setup,
            mean: 0,
            standardDeviation: 0.4,
          },
        },
      },
    });
    const setupPath = html.match(/<path data-factor-setup-fit class="factor-setup-fit" d="([^"]+)"\/>/)?.[1];

    expect(setupPath).toBeDefined();
    expect(setupPath?.split(" ")).toHaveLength(21);
    expect(setupPath).toContain("L418.00,72.00");
  });

  it("uses a controlled reason instead of fabricated F0 values when analysis is unavailable", () => {
    const report = reportFixture();
    const reason = "Governed F0 evidence <not available>.";
    const html = renderF7ReportPdfHtml({
      ...report,
      workbook: {
        ...report.workbook,
        worksheetName: "TA <unsafe> / Result",
      },
      analysis: {
        status: "unavailable",
        reason,
        optimizationDirections: ["Complete governed evidence."],
      },
    });

    expect(html).toContain("TA interpretation and optimization report");
  expect(html).toContain("<h2>TA interpretation and optimization report</h2><p class=\"subtle\">Design &lt;unsafe&gt; 装配.xlsx · TA &lt;unsafe&gt; / Result</p>");
  expect(html).not.toContain("TA <unsafe> / Result");
    expect(html).toContain("F0 analysis unavailable");
    expect(html).toContain("Governed F0 evidence &lt;not available&gt;.");
    expect(html).not.toContain(reason);
    expect(html).toContain("Complete governed evidence.");
    expect(html).toContain("Governed assessment");
    expect(html).toContain("This statistical assessment is not a design or production Release/Hold decision.");
    const affectedHeadings = [
      "TA Comparison Matrix",
      "F0 analysis unavailable",
      "Engineering Summary",
      "Root Cause Analysis",
      "Engineering Risk",
      "Suggested Action Sequence",
      "Validation Requirements",
      "Evidence Disclosure",
      "Reproducibility Evidence",
    ];
    const escapedReason = "Governed F0 evidence &lt;not available&gt;.";
    for (let index = 0; index < affectedHeadings.length - 1; index += 1) {
      const sectionStart = html.indexOf(affectedHeadings[index]!);
      const sectionEnd = html.indexOf(affectedHeadings[index + 1]!, sectionStart + 1);
      expect(sectionStart).toBeGreaterThan(-1);
      expect(sectionEnd).toBeGreaterThan(sectionStart);
      expect(html.slice(sectionStart, sectionEnd)).toContain(escapedReason);
    }
    expect(html).not.toContain("data-factor-setup-fit");
    expect(html).not.toContain("data-report-ta-comparison");
    expect(html).not.toContain("Factor Setup assumption and measured-data Monte Carlo comparison");
    expect(html).not.toContain("Assumption vs measured evidence");
    expect(html).not.toContain(">0.7396<");
    expect(html).not.toMatch(/(?:NaN|-?Infinity)/);
  });

  it("uses one controlled default reason without fabricated F0 values when analysis is undefined", () => {
    const report = reportWithoutAnalysisFixture();

    expect(() => f7ReportProjectionSchema.parse(report)).not.toThrow();
    const html = renderF7ReportPdfHtml(report);
    const defaultReason = "Governed interpretation is unavailable.";
    const affectedSections = [
      ["TA Comparison Matrix", "TA interpretation and optimization report"],
      ["F0 analysis unavailable", "Governed assessment"],
      ["Engineering Summary", "Reproducibility Evidence"],
    ] as const;

    for (const [startHeading, endHeading] of affectedSections) {
      const sectionStart = html.indexOf(startHeading);
      const sectionEnd = html.indexOf(endHeading, sectionStart + 1);
      expect(sectionStart).toBeGreaterThan(-1);
      expect(sectionEnd).toBeGreaterThan(sectionStart);
      expect(html.slice(sectionStart, sectionEnd)).toContain(defaultReason);
    }
    expect(html).not.toContain("Factor Setup comparison unavailable because governed evidence is incomplete; Monte Carlo outputs remain available.");
    expect(html).not.toContain("data-factor-setup-fit");
    expect(html).not.toContain("Factor Setup assumption and measured-data Monte Carlo comparison");
    expect(html).not.toContain("Assumption vs measured evidence");
    expect(html).not.toContain(">0.7396<");
  });

  it("builds safe ASCII and Unicode report filenames", () => {
    expect(safeF7ReportPdfFileName("Design 装配.xlsx", "TA / Result"))
      .toBe("Design-TA-Result-f7-monte-carlo-report.pdf");
    expect(safeUnicodeF7ReportPdfFileName("Design 装配.xlsx", "TA / Result"))
      .toBe("Design-装配-TA-Result-f7-monte-carlo-report.pdf");
  });

  it("prints valid PDF bytes and removes its temporary directory", async () => {
    let temporaryDirectory = "";
    const removeDirectory = vi.fn(async (path: string, options) => {
      temporaryDirectory = path;
      await rm(path, options);
    });
    const renderer = createF7ReportPdfRenderer({
      installedBrowsers: () => ["C:\\Browser\\browser.exe"],
      executeFile: async (_executable, args) => {
        const output = args.find((argument) => argument.startsWith("--print-to-pdf="));
        if (!output) throw new Error("Missing output path");
        await writeFile(output.slice("--print-to-pdf=".length), Buffer.from("%PDF-1.7\nreport"));
      },
      removeDirectory,
    });

    await expect(renderer.render({ sessionId: "session-report", report: reportFixture() }))
      .resolves.toEqual(Buffer.from("%PDF-1.7\nreport"));
    expect(removeDirectory).toHaveBeenCalledWith(temporaryDirectory, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
    await expect(access(temporaryDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves the rendering error when cleanup also fails and releases the render slot", async () => {
    const renderer = createF7ReportPdfRenderer({
      installedBrowsers: () => ["C:\\Browser\\browser.exe"],
      executeFile: async () => { throw new Error("Browser rendering failed."); },
      removeDirectory: async () => { throw new Error("Cleanup failed."); },
    });
    const request = { sessionId: "session-report", report: reportFixture() };

    await expect(renderer.render(request)).rejects.toThrow("Browser rendering failed.");
    await expect(renderer.render(request)).rejects.toThrow("Browser rendering failed.");
  });

  it("reports missing browser output and cleans up the temporary directory", async () => {
    let temporaryDirectory = "";
    const renderer = createF7ReportPdfRenderer({
      installedBrowsers: () => ["C:\\Browser\\browser.exe"],
      executeFile: async () => {},
      removeDirectory: async (path, options) => {
        temporaryDirectory = path;
        await rm(path, options);
      },
    });

    await expect(renderer.render({ sessionId: "session-report", report: reportFixture() }))
      .rejects.toThrow("Browser did not produce a PDF document.");
    await expect(access(temporaryDirectory)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("limits report rendering to one active job and three queued jobs", async () => {
    let releaseBrowser!: () => void;
    const browserGate = new Promise<void>((resolve) => { releaseBrowser = resolve; });
    const renderer = createF7ReportPdfRenderer({
      installedBrowsers: () => ["C:\\Browser\\browser.exe"],
      executeFile: async (_executable, args) => {
        await browserGate;
        const output = args.find((argument) => argument.startsWith("--print-to-pdf="));
        if (!output) throw new Error("Missing output path");
        await writeFile(output.slice("--print-to-pdf=".length), Buffer.from("%PDF-1.7\nreport"));
      },
    });
    const request = { sessionId: "session-report", report: reportFixture() };
    const accepted = Array.from({ length: 4 }, () => renderer.render(request));

    await expect(renderer.render(request)).rejects.toBeInstanceOf(AssumptionResultsPdfQueueFullError);
    releaseBrowser();
    await expect(Promise.all(accepted)).resolves.toHaveLength(4);
  });
});
