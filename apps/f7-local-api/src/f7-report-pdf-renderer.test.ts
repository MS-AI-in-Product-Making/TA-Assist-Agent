import { access, rm, writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import type { F7ReportProjection } from "@ai-assist/contracts";
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
      runSeed: HASH,
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
      seed: HASH,
      iterations: 10_000,
      factorManifest: [{ factorId: HASH, family: "normal", sourceMode: "BASELINE_ASSUMPTION" }],
    },
    markdown: "# F7 report",
  };
}

describe("F7 report PDF renderer", () => {
  it("renders the governed report with a clear title and escaped provenance", () => {
    const html = renderF7ReportPdfHtml(reportFixture());

    expect(html).toContain("F7 Monte Carlo Analysis Report");
    expect(html).toContain("Design &lt;unsafe&gt; 装配.xlsx");
    expect(html).toContain("TA / Result");
    expect(html).toContain("Factor Setup vs Monte Carlo TA");
    expect(html).toContain("Root Cause Analysis");
    expect(html).toContain("Engineering Risk");
    expect(html).toContain("Suggested Action Sequence");
    expect(html).toContain("Validation Requirements");
    expect(html).toContain("Reproducibility Evidence");
    expect(html).not.toMatch(/<script|https?:\/\//i);
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
