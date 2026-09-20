import { access, rm, writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { f7ReportProjectionSchema, type F7ReportProjection } from "@ai-assist/contracts";
import {
  AssumptionResultsPdfQueueFullError,
} from "./assumption-results-pdf-renderer.js";
import {
  createF7ReportPdfRenderer,
  factorSetupDensityStyle,
  renderF7ReportPdfHtml,
  safeF7ReportPdfFileName,
  safeUnicodeF7ReportPdfFileName,
  type F7FactorDistributionAppendixEntry,
} from "./f7-report-pdf-renderer.js";

const HASH = "a".repeat(64);
const HASH_B = "b".repeat(64);
const RUN_SEED = `${"0".repeat(60)}3039`;
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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
      factorManifest: [
        { factorId: HASH, family: "normal", sourceMode: "MEASURED" },
        { factorId: HASH_B, family: "uniform", sourceMode: "BASELINE_ASSUMPTION" },
      ],
    },
    factors: [
      {
        factorId: HASH,
        factorName: "Factor <A>",
        partNumber: "PN <100>",
        dimId: "DIM & 1",
        designNominal: 1,
        upperTolerance: 0.2,
        lowerTolerance: -0.2,
        longTermSafetyFactor: 1,
        sigmaLevel: 3,
        setupDistribution: "Normal",
        setupMean: 1.01,
        setupTolerance: 0.2,
        setupOneSigma: 0.05,
        setupCpk: 1,
        percentContributionToSigma: 0.625,
        measurementComparison: {
          mean: { actual: 1.02, delta: 0.01 },
          tolerance: { actual: 0.18, delta: -0.02 },
          oneSigma: { actual: 0.06, delta: 0.01 },
          cpk: { actual: 0.9, delta: -0.1 },
        },
        sampleCount: 32,
        readiness: "ready",
        measurementWarning: true,
        loopCoefficient: 1,
        sourceMode: "MEASURED",
        approvedDistribution: "normal",
        sourceReferences: ["TA!G14"],
      },
      {
        factorId: HASH_B,
        factorName: "Factor & B",
        designNominal: -2,
        upperTolerance: 0.3,
        lowerTolerance: -0.1,
        longTermSafetyFactor: 1.5,
        sigmaLevel: 4,
        setupDistribution: "Uniform",
        setupMean: -1.9,
        setupTolerance: 0.3,
        setupOneSigma: 0.04,
        setupCpk: 4 / 3,
        percentContributionToSigma: 0.375,
        sampleCount: 0,
        readiness: "ready",
        measurementWarning: false,
        loopCoefficient: -1,
        sourceMode: "BASELINE_ASSUMPTION",
        approvedDistribution: "uniform",
        sourceReferences: ["TA!G15"],
      },
    ],
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
      factorManifest: [
        { factorId: HASH, family: "normal", sourceMode: "MEASURED" },
        { factorId: HASH_B, family: "uniform", sourceMode: "BASELINE_ASSUMPTION" },
      ],
    },
    markdown: "# F7 report",
  };
}

describe("Dimension Chain Web visual", () => {
  it("replaces the reconstructed final-report chain with the captured image", () => {
    const html = renderF7ReportPdfHtml(reportFixture(), {
      status: "image",
      mediaType: "image/png",
      dataUrl: PNG_DATA_URL,
      width: 1,
      height: 1,
    });

    expect(html).toContain("data-dimension-chain-visual");
    expect(html).not.toContain("data-dimension-chain-page");
  });

  it("renders no image or reconstructed chain for an empty Web visual", () => {
    const html = renderF7ReportPdfHtml(reportFixture(), { status: "empty" });

    expect(html).toContain("data-dimension-chain-visual-empty");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("data-dimension-chain-page");
  });
});

function reportWithoutAnalysisFixture(): F7ReportProjection {
  return {
    ...reportFixture(),
    analysis: undefined,
  };
}

function exactLengthFactorName(prefix: string, length: number): string {
  return `${prefix}${"x".repeat(length - prefix.length)}`;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function visibleHtmlText(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("F7 report PDF renderer", () => {
  it("renders the Factor distribution Appendix only when authoritative entries are provided", () => {
    const appendix: readonly F7FactorDistributionAppendixEntry[] = [
      {
        factorId: HASH,
        factorName: "Factor <A>",
        lowerSpecLimit: 0.8,
        upperSpecLimit: 1.2,
        setup: { mean: 1, standardDeviation: 0.05, distribution: "Normal" },
        selectedCandidate: {
          family: "normal",
          parameters: { mean: 1.02, standardDeviation: 0.06 },
          qqPoints: Array.from({ length: 20 }, (_, index) => ({
            observed: 0.9 + index * 0.012,
            theoretical: -2 + index * 0.2,
          })),
        },
      },
      {
        factorId: HASH_B,
        factorName: "Factor B",
        lowerSpecLimit: 1.8,
        upperSpecLimit: 2.2,
        setup: { mean: 2, standardDeviation: 0.04, distribution: "Uniform" },
        selectedCandidate: {
          family: "uniform",
          parameters: { minimum: 1.9, maximum: 2.1 },
          qqPoints: Array.from({ length: 20 }, (_, index) => ({
            observed: 1.9 + index * 0.01,
            theoretical: 1.9 + index * 0.01,
          })),
        },
      },
    ];

    expect(renderF7ReportPdfHtml(reportFixture())).not.toContain("data-factor-distribution-appendix");
    const html = renderF7ReportPdfHtml(reportFixture(), undefined, appendix);

    expect(html).toContain("data-factor-distribution-appendix");
    expect(html).toContain("Factor distribution references");
    expect(html).toContain("Factor &lt;A&gt;");
    expect(html).not.toContain("Factor <A>");
    expect(html.indexOf("Factor &lt;A&gt;")).toBeLessThan(html.indexOf("Factor B"));
    expect(html.match(/data-factor-distribution-chart/g)).toHaveLength(2);
    expect(html).toContain("data-factor-distribution-bin");
    expect(html).toContain("data-selected-distribution-fit");
    expect(html).toContain("data-factor-setup-distribution-fit");
    expect(html).toContain('data-reference-id="lower-spec-limit"');
    expect(html).toContain('data-reference-id="upper-spec-limit"');
  });

  it("derives bounded Factor Setup density styles and rejects invalid values", () => {
    expect(factorSetupDensityStyle(7)).toBe("--factor-setup-table-font-size:6.4pt;--factor-setup-label-font-size:5.8pt;--factor-setup-cell-y:2px;--factor-setup-cell-x:3px;--factor-setup-h3-font-size:10.5pt;--factor-setup-h4-font-size:9pt;--factor-setup-h3-margin-top:9px;--factor-setup-h3-margin-bottom:4px;--factor-setup-h4-margin-top:8px;--factor-setup-h4-margin-bottom:3px;--factor-setup-table-margin:7px;--factor-setup-metric-stack-gap:1px;--factor-setup-metric-line-gap:4px;--factor-setup-border-width:1px;");
    expect(factorSetupDensityStyle(8)).toBe("--factor-setup-table-font-size:5.028571pt;--factor-setup-label-font-size:4.557143pt;--factor-setup-cell-y:1.571429px;--factor-setup-cell-x:2.357143px;--factor-setup-h3-font-size:8.25pt;--factor-setup-h4-font-size:7.071429pt;--factor-setup-h3-margin-top:7.071429px;--factor-setup-h3-margin-bottom:3.142857px;--factor-setup-h4-margin-top:6.285714px;--factor-setup-h4-margin-bottom:2.357143px;--factor-setup-table-margin:5.5px;--factor-setup-metric-stack-gap:0.785714px;--factor-setup-metric-line-gap:3.142857px;--factor-setup-border-width:0.785714px;");
    expect(factorSetupDensityStyle(14)).toBe("--factor-setup-table-font-size:2.707692pt;--factor-setup-label-font-size:2.453846pt;--factor-setup-cell-y:0.846154px;--factor-setup-cell-x:1.269231px;--factor-setup-h3-font-size:4.442308pt;--factor-setup-h4-font-size:3.807692pt;--factor-setup-h3-margin-top:3.807692px;--factor-setup-h3-margin-bottom:1.692308px;--factor-setup-h4-margin-top:3.384615px;--factor-setup-h4-margin-bottom:1.269231px;--factor-setup-table-margin:2.961538px;--factor-setup-metric-stack-gap:0.423077px;--factor-setup-metric-line-gap:1.692308px;--factor-setup-border-width:0.423077px;");
    expect(factorSetupDensityStyle(100)).toBe("--factor-setup-table-font-size:0.5pt;--factor-setup-label-font-size:0.5pt;--factor-setup-cell-y:0.111111px;--factor-setup-cell-x:0.166667px;--factor-setup-h3-font-size:0.583333pt;--factor-setup-h4-font-size:0.5pt;--factor-setup-h3-margin-top:0.5px;--factor-setup-h3-margin-bottom:0.222222px;--factor-setup-h4-margin-top:0.444444px;--factor-setup-h4-margin-bottom:0.166667px;--factor-setup-table-margin:0.388889px;--factor-setup-metric-stack-gap:0.055556px;--factor-setup-metric-line-gap:0.222222px;--factor-setup-border-width:0.055556px;");

    for (const style of [factorSetupDensityStyle(7), factorSetupDensityStyle(8), factorSetupDensityStyle(14), factorSetupDensityStyle(100)]) {
      expect(style).not.toContain("zoom");
      expect(style).not.toContain("--factor-setup-width");
    }

    for (const factorCount of [0, -1, 1.5, 101, Number.NaN]) {
      expect(() => factorSetupDensityStyle(factorCount)).toThrowError(
        "Factor count must be an integer between 1 and 100.",
      );
    }
  });

  it("renders the governed report with a side-by-side result visual and F0 evidence", () => {
    const report = reportFixture();
    const html = renderF7ReportPdfHtml({
      ...report,
      simulation: {
        ...report.simulation,
        factorContributions: [
          { methodId: "F7_INDEPENDENT_VARIANCE_CONTRIBUTION_V1", factorId: HASH, family: "normal", sourceMode: "MEASURED", coefficient: 1, standardDeviation: 0.06, weightedVariance: 0.0036, contribution: 0.6923076923076923 },
          { methodId: "F7_INDEPENDENT_VARIANCE_CONTRIBUTION_V1", factorId: HASH_B, family: "uniform", sourceMode: "BASELINE_ASSUMPTION", coefficient: -1, standardDeviation: 0.04, weightedVariance: 0.0016, contribution: 0.3076923076923077 },
        ],
      },
    });

    expect(html).toContain("F7 Monte Carlo Governed Result Report");
    expect(html).toContain("Design &lt;unsafe&gt; 装配.xlsx");
    expect(html).not.toContain("Design <unsafe> 装配.xlsx");
    expect(html).toContain("TA / Result");
    expect(html).toContain("Factor &lt;A&gt;");
    expect(html).not.toContain("Factor <A>");
    expect(html).toContain("<h2>Engineering Analysis</h2><p class=\"subtle\">Design &lt;unsafe&gt; 装配.xlsx · TA / Result</p>");
    expect(html).toContain("Executive Summary");
    expect(html).toContain("Capability is below target");
    expect(html).toContain("Measured simulation indicates a capability shortfall.");

    const resultKpis = html.match(/<dl class="monte-carlo-kpis"[\s\S]*?<\/dl>/)?.[0];
    expect(resultKpis).toContain("Yield");
    expect(resultKpis).toContain("Cpk");
    expect(resultKpis).toContain("Mean");
    expect(resultKpis).toContain("Std Dev");
    expect(resultKpis).toContain("89.45%");
    expect(resultKpis).toContain("0.445");
    expect(resultKpis).toContain("-0.026");
    expect(resultKpis).toContain("0.057");
    expect(resultKpis).not.toContain("0.445032");
    expect(resultKpis).toContain("105,500 PPM out of spec");

    const governedResult = html.match(/<section class="monte-carlo-decision[^"]*"[\s\S]*?<\/section>/)?.[0];
    expect(governedResult).toContain("Attention required");
    expect(governedResult).toContain("Mean -0.026 differs from Factor Setup Mean -0.05.");
    expect(governedResult).toContain("Cpk 0.445 is below the target Cpk 1.");
    expect(governedResult).toContain('class="monte-carlo-decision-details"');
    expect(html).toContain(".monte-carlo-decision.decision-below-target");

    const orderedHeadings = [
      "Engineering Inputs",
      "Factor Setup",
      "Governed result",
      "Dimension Chain",
      "Monte Carlo output distribution",
      "Engineering Analysis",
      "Executive Summary",
      "Factor Setup vs Monte Carlo TA",
      "Top Contributors",
      "Engineering Risks &amp; Recommended Actions",
      "Governed assessment",
    ];
    let previousIndex = -1;
    for (const heading of orderedHeadings) {
      const headingIndex = html.indexOf(heading);
      expect(headingIndex, `${heading} should follow the previous governed section`).toBeGreaterThan(previousIndex);
      previousIndex = headingIndex;
    }

    const factorSetupTable = html.match(/<table data-factor-setup>[\s\S]*?<\/table>/)?.[0];
    expect(factorSetupTable).toBeDefined();
    expect(html).toContain(`<div class="factor-setup-wrapper" style="${factorSetupDensityStyle(reportFixture().factors.length)}">`);
    expect(html).toContain("font-size: var(--factor-setup-label-font-size);");
    expect(html).not.toContain("dimension-chain-wrapper");
    const setupHeadings = [...(factorSetupTable ?? "").matchAll(/<th>([^<]+)<\/th>/g)].map((match) => match[1]);
    expect(setupHeadings).toEqual([
      "Item",
      "Factor",
      "Part Number",
      "DIM ID",
      "Design Nominal",
      "+ Tol",
      "- Tol",
      "Long Term/Safety Factor",
      "σ Level",
      "Distribution",
      "Mean",
      "Tolerance",
      "1σ",
      "Cpk",
      "% Cont. to σ",
      "Source Mode",
      "Sample Count",
      "Readiness",
    ]);
    expect(html).toContain(".engineering-inputs, .engineering-inputs table { break-inside: auto; }");
    expect(html).toContain(".engineering-inputs tr { break-inside: avoid; }");
    expect(factorSetupTable).toContain("PN &lt;100&gt;");
    expect(factorSetupTable).toContain("DIM &amp; 1");
    expect(factorSetupTable).toContain("Missing");
    expect(factorSetupTable?.indexOf("Factor &lt;A&gt;")).toBeLessThan(factorSetupTable?.indexOf("Factor &amp; B") ?? -1);
    expect(factorSetupTable).toContain('rowspan="2"');
    expect(factorSetupTable).toContain(`data-factor-measured-comparison="${HASH}"`);
    expect(factorSetupTable).toContain('data-measured-comparison-metric="distribution"');
    expect(factorSetupTable).toContain('data-measured-comparison-metric="contribution"');
    expect(factorSetupTable).toContain('class="nominal-positive">1</span>');
    expect(factorSetupTable).toContain('class="nominal-negative">-2</span>');
    expect(factorSetupTable).toContain('class="factor-measured-comparison-metric factor-measured-comparison-metric-three-row" data-measured-comparison-metric="cpk"');
    expect(factorSetupTable).toContain('<span class="actual-value-severity-attention">0.9</span>');
    expect(factorSetupTable).toContain('<span class="comparison-percentage-group actual-value-severity-attention">(-10.00%)</span>');
    expect(factorSetupTable).toContain('<td>1.33</td>');
    expect(factorSetupTable).toContain('<span class="source-mode-badge source-mode-warning">Measured Data</span>');
    expect(factorSetupTable).toContain("Actual");
    expect(factorSetupTable).toContain("Δ");
    expect(html).not.toContain("<h4>Setup Inputs</h4>");
    expect(html).not.toContain("<h4>Measurement Analysis</h4>");
    expect(html.indexOf("data-factor-setup")).toBeLessThan(html.indexOf("Governed result"));
    expect(html.indexOf("Governed result")).toBeLessThan(html.indexOf("Dimension Chain"));

    const comparisonTable = html.match(/<table data-report-ta-comparison>[\s\S]*?<\/table>/)?.[0];
    expect(comparisonTable).toBeDefined();
    for (const metric of ["Mean", "Standard deviation", "Cp", "Cpk", "CPL", "CPU", "Lower DPM", "Upper DPM", "Total DPM", "% Out of Spec"]) {
      expect(comparisonTable).toContain(`<th>${metric}</th>`);
    }
    expect(comparisonTable).toContain("+0.024 (+12.15%)");
    expect(comparisonTable).toContain("actual-value-severity-critical");
    expect(comparisonTable).toContain("DPM");
    expect(comparisonTable).not.toMatch(/\d+\.\d{4,}/);
    for (const percentage of comparisonTable?.matchAll(/[+-]?\d+(?:\.\d+)?%/g) ?? []) {
      expect(percentage[0]).not.toMatch(/\.\d{3,}%/);
    }

    const contributors = html.match(/<ol class="contributor-list"[\s\S]*?<\/ol>/)?.[0];
    expect(contributors).toContain("Factor &lt;A&gt;");
    expect(contributors).toContain("62.5%");
    expect(contributors?.indexOf("Factor &lt;A&gt;")).toBeLessThan(contributors?.indexOf("Factor &amp; B") ?? -1);
    expect(html).toContain("Specification escapes remain possible.");
    expect(html).toContain("Recommended Actions");
    expect(html).toContain("Current σ");
    expect(html).toContain("Maximum σ");
    expect(html).toContain("Required reduction");
    const recommendedActions = html.match(/<div class="embedded-actions" data-report-recommended-actions>[\s\S]*?<\/ol><\/div>/)?.[0];
    expect(recommendedActions).toBeDefined();
    expect(recommendedActions).not.toMatch(/\d+\.\d{4,}/);
    for (const percentage of recommendedActions?.matchAll(/[+-]?\d+(?:\.\d+)?%/g) ?? []) {
      expect(percentage[0]).not.toMatch(/\.\d{3,}%/);
    }

    const factorSetupText = visibleHtmlText(factorSetupTable ?? "");
    for (const metricValue of ["1.01", "Actual 1.02", "Δ +0.01 (+0.99%)", "± 0.2", "Actual ±3σ 0.18", "Δ -0.02 (-10.00%)", "0.05", "Actual 0.06", "Actual 0.9"]) {
      expect(factorSetupText).toContain(metricValue);
    }
    expect(factorSetupTable).toContain("62.5%");
    expect(factorSetupTable).toContain("37.5%");
    expect(factorSetupTable).toContain("<th>Source Mode</th>");
    expect(factorSetupTable).toContain("<th>Readiness</th>");
    expect(factorSetupTable).toContain("Measured Data");
    expect(factorSetupTable).toContain("Baseline Assumption");
    expect(factorSetupTable).toContain("status-ready");
    expect(factorSetupTable).toContain("status-warning");
    expect(factorSetupTable).toContain("actual-value-severity-critical");
    expect(html).toContain(".factor-measured-comparison-metric-three-row");
    expect(html).toContain(".nominal-positive");
    expect(html).toContain(".source-mode-warning");
    expect(factorSetupTable).toContain(">32<");
    expect(factorSetupTable).toContain(">0<");

    expect(html).toContain("data-monte-carlo-chart");
    expect(html).toContain("data-monte-carlo-bin");
    expect(html).toContain("data-monte-carlo-fit");
    expect(html).toContain("data-factor-setup-fit");
    expect(html).toContain("data-factor-setup-mean");
    expect(html).toContain(">Setup Mean -0.05<");
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
    expect(html.match(/data-reference-row="top"/g)).toHaveLength(3);
    expect(html.match(/data-reference-row="middle"/g)).toHaveLength(1);
    expect(html.match(/data-reference-row="bottom"/g)).toHaveLength(3);
    for (const label of ["LSL -0.15", "Target -0.05", "USL 0.05", "−3σ -0.196", "Mean -0.026", "+3σ 0.144"]) {
      expect(html).toContain(`>${label}<`);
    }
    const chart = html.match(/<svg data-monte-carlo-chart[\s\S]*?<\/svg>/)?.[0];
    expect(chart).toBeDefined();
    for (const label of chart?.matchAll(/class="(?:plot-tick-label|monte-carlo-reference-label)"[^>]*>([^<]+)<\/text>/g) ?? []) {
      expect(label[1]).not.toMatch(/\d+\.\d{4,}/);
      expect(label[1]).not.toMatch(/\.\d*0$/);
    }
    expect(html).toContain('class="monte-carlo-reference-badge"');
    expect(html).toContain('class="monte-carlo-reference-badge setup-mean-badge"');
    expect(html).toContain('y1="106" y2="300"');
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
    expect(html).toContain("data-result-visuals");
    expect(html).toContain("data-result-dimension-chain");
    expect(html).toContain("data-result-distribution");
    expect(html).toContain("data-dimension-chain-fallback");
    expect(html).toContain(".dimension-chain-fallback { height: 105mm; overflow: hidden; }");
    expect(html).toContain(".dimension-chain-fallback .dimension-chain-pages { display: flex;");
    expect(html).toContain(".result-visual-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);");
    expect(html).toContain(".result-dimension-chain .dimension-chain-visual { align-items: flex-start;");
    expect(html).toContain("object-position: center top;");
    expect(html).not.toContain("TA Comparison Matrix");
    expect(html).not.toContain("data-ta-comparison-matrix");

    expect(html).toContain("Factor Setup vs Monte Carlo TA");
    expect(html).toContain("F0 interpretation-rules-v2 / performance-cpk-below-target");
    expect(html).toContain("Mean shifted right.");
    expect(html).toContain("Reduce variation.");
    expect(html).toContain("Governed assessment");
    expect(html).toContain("This statistical assessment is not a design or production Release/Hold decision.");
    for (const removed of [
      "Governed engineering detail",
      "Engineering Summary",
      "Root Cause Analysis",
      "Suggested Action Sequence",
      "Validation Requirements",
      "Evidence Disclosure",
      "Reproducibility Evidence",
      "Factor evidence",
    ]) {
      expect(html).not.toContain(removed);
    }
    expect(html).not.toMatch(/(?:NaN|-?Infinity)/);
    expect(html).not.toMatch(/<script|https?:\/\//i);
  });

  it("renders mixed-sign factors in report order with one finite segment and one closure", () => {
    const report = reportFixture();
    const baseFactor = report.factors[0]!;
    const html = renderF7ReportPdfHtml({
      ...report,
      factors: [
        { ...baseFactor, factorId: "a".repeat(64), factorName: "Positive <A>", designNominal: 10 },
        { ...baseFactor, factorId: "b".repeat(64), factorName: "Negative & B", designNominal: -5 },
        { ...baseFactor, factorId: "c".repeat(64), factorName: "Zero > C", designNominal: 0 },
      ],
    });
    const dimensionChain = html.match(/<svg data-dimension-chain[\s\S]*?<\/svg>/)?.[0];

    expect(dimensionChain).toBeDefined();
    expect(dimensionChain?.match(/data-dimension-chain-segment/g)).toHaveLength(3);
    expect(dimensionChain?.match(/data-direction="additive"/g)).toHaveLength(1);
    expect(dimensionChain?.match(/data-direction="subtractive"/g)).toHaveLength(1);
    expect(dimensionChain?.match(/data-direction="zero"/g)).toHaveLength(1);
    expect(dimensionChain).toMatch(/<tspan[^>]*>Additive<\/tspan>/);
    expect(dimensionChain).toMatch(/<tspan[^>]*>Subtractive<\/tspan>/);
    expect(dimensionChain).toMatch(/<tspan[^>]*>Zero<\/tspan>/);
    expect(dimensionChain).toContain("Positive &lt;A&gt;");
    expect(dimensionChain).toContain("Negative &amp; B");
    expect(dimensionChain).toContain("Zero &gt; C");
    expect(dimensionChain?.match(/data-dimension-chain-closure/g)).toHaveLength(1);
    expect(dimensionChain?.indexOf("Positive &lt;A&gt;")).toBeLessThan(dimensionChain?.indexOf("Negative &amp; B") ?? -1);
    expect(dimensionChain?.indexOf("Negative &amp; B")).toBeLessThan(dimensionChain?.indexOf("Zero &gt; C") ?? -1);
  });

  it("dynamically paginates long Dimension Chain labels into bounded independently printable blocks", () => {
    const report = reportFixture();
    const baseFactor = report.factors[0]!;
    const oversizedFactorName = exactLengthFactorName("Oversized <escaped> & factor ", 3_100);
    const factors = Array.from({ length: 21 }, (_, index) => ({
      ...baseFactor,
      factorId: index.toString(16).padStart(2, "0").repeat(32),
      factorName: index < 5
        ? exactLengthFactorName(`Long factor ${index + 1} <&> `, 310)
        : index === 10
          ? oversizedFactorName
          : `Factor ${index + 1}`,
      designNominal: index === 20 ? 0 : index % 3 === 0 ? index + 1 : -(index + 1),
    }));
    const html = renderF7ReportPdfHtml({
      ...report,
      factors,
    });
    const factorSetupTable = html.match(/<table data-factor-setup>[\s\S]*?<\/table>/)?.[0];
    const dimensionChainPages = [...html.matchAll(/<div data-dimension-chain-page[^>]*>[\s\S]*?<\/svg><\/div>/g)]
      .map((match) => match[0]);

    expect(decodeHtmlAttribute(factorSetupTable ?? "")).toContain(oversizedFactorName);
    expect(html).toContain(".dimension-chain-svg { width: 100%; height: auto; max-height: none; }");
    expect(html).toContain("thead { display: table-header-group; }");
    expect(html).toContain(".engineering-inputs, .engineering-inputs table { break-inside: auto; }");
    expect(html).toContain(".engineering-inputs tr { break-inside: avoid; }");
    expect(html).toContain(".factor-measured-comparison-metric { display: grid; grid-template-rows: repeat(2, minmax(0, 1fr));");
    expect(html).toContain(".result-dimension-chain .dimension-chain-pages { break-inside: auto; page-break-inside: auto; }");
    expect(html).toContain(".result-dimension-chain .dimension-chain-page { break-inside: avoid; page-break-inside: avoid;");
    expect(dimensionChainPages.length).toBeGreaterThan(5);
    expect(html).toContain("data-dimension-chain-fallback-unavailable");
    expect(html).toContain("Dimension Chain visual unavailable");
    expect(html).toContain("data-reconstructed-dimension-chain-audit");
    expect(html).toContain("Dimension Chain audit appendix");
    expect(dimensionChainPages.map((page) => Number(page.match(/data-dimension-chain-page-index="(\d+)"/)?.[1]))).toEqual(
      Array.from({ length: dimensionChainPages.length }, (_, index) => index + 1),
    );
    expect(dimensionChainPages.every((page) => page.includes(`data-dimension-chain-page-count="${dimensionChainPages.length}"`))).toBe(true);
    expect(dimensionChainPages.every((page) => (page.match(/data-dimension-chain-segment/g)?.length ?? 0) <= 5)).toBe(true);
    expect(dimensionChainPages.reduce((count, page) => count + (page.match(/data-dimension-chain-segment/g)?.length ?? 0), 0)).toBe(factors.length);
    const renderedFactorIndexes = [...html.matchAll(/data-dimension-chain-factor-part[^>]*data-factor-index="(\d+)"/g)]
      .map((match) => Number(match[1]));
    expect(renderedFactorIndexes).toEqual([...renderedFactorIndexes].sort((left, right) => left - right));
    for (const [factorIndex, factor] of factors.entries()) {
      const factorParts = [...html.matchAll(new RegExp(`<g data-dimension-chain-factor-part[^>]*data-factor-index="${factorIndex + 1}"[^>]*data-factor-id="${factor.factorId}"[^>]*>[\\s\\S]*?<\\/g>`, "g"))]
        .map((match) => match[0]);
      expect(factorParts.length, `factor ${factorIndex + 1} should be represented`).toBeGreaterThan(0);
      expect(html.match(new RegExp(`data-dimension-chain-segment[^>]*data-factor-index="${factorIndex + 1}"`, "g")) ?? []).toHaveLength(1);
      const recoveredName = factorParts
        .flatMap((part) => [...part.matchAll(/data-label-chunk="([^"]*)"/g)].map((match) => decodeHtmlAttribute(match[1]!)))
        .join("");
      expect(recoveredName).toBe(factor.factorName);
    }
    expect(dimensionChainPages.slice(1).every((page) => page.includes("Dimension Chain continued"))).toBe(true);
    expect(dimensionChainPages.every((page) => /<title id="dimension-chain-title-\d+">/.test(page))).toBe(true);
    expect(dimensionChainPages.every((page) => /<desc id="dimension-chain-description-\d+">/.test(page))).toBe(true);
    expect(dimensionChainPages.slice(0, -1).every((page) => !page.includes("data-dimension-chain-closure"))).toBe(true);
    expect(dimensionChainPages.at(-1)?.match(/data-dimension-chain-closure/g)).toHaveLength(1);
    expect(dimensionChainPages.at(-1)).toContain("Final closure to global datum");

    const oversizedParts = [...html.matchAll(/<g data-dimension-chain-factor-part[^>]*data-factor-index="11"[^>]*>[\s\S]*?<\/g>/g)].map((match) => match[0]);
    expect(oversizedParts.length).toBeGreaterThan(1);
    expect(oversizedParts.slice(1).every((part) => part.includes("Factor 11 label continued"))).toBe(true);
    const recoveredOversizedName = oversizedParts
      .flatMap((part) => [...part.matchAll(/data-label-chunk="([^"]*)"/g)].map((match) => decodeHtmlAttribute(match[1]!)))
      .join("");
    expect(recoveredOversizedName).toBe(oversizedFactorName);

    const viewBoxHeights = dimensionChainPages.map((page) => Number(page.match(/viewBox="0 0 800 ([^"]+)"/)?.[1]));
    const printableHeightMillimeters = 186;
    const printableWidthMillimeters = 297 - 2 * 12;
    expect(viewBoxHeights.every(Number.isFinite)).toBe(true);
    expect(viewBoxHeights.every((height) => height <= 500)).toBe(true);
    expect(viewBoxHeights.every((height) => height / 800 * printableWidthMillimeters < printableHeightMillimeters)).toBe(true);
    expect(dimensionChainPages.join("")).not.toMatch(/(?:NaN|-?Infinity)/);
  });

  it.each(["W".repeat(300), "测".repeat(300)])("renders complete wide Factor names in the unified table", (factorName) => {
    const report = reportFixture();
    const html = renderF7ReportPdfHtml({
      ...report,
      factors: [{ ...report.factors[0]!, factorName }],
    });

    expect(html.match(new RegExp(`<table data-factor-setup>[\\s\\S]*?${factorName}[\\s\\S]*?<\\/table>`))).toBeTruthy();
  });

  it("compresses the Dimension Chain when factor magnitudes differ by more than eight times", () => {
    const report = reportFixture();
    const baseFactor = report.factors[0]!;
    const html = renderF7ReportPdfHtml({
      ...report,
      factors: [
        { ...baseFactor, factorId: "a".repeat(64), designNominal: 1 },
        { ...baseFactor, factorId: "b".repeat(64), designNominal: 1000 },
      ],
    });

    expect(html).toContain("data-dimension-chain data-compressed=\"true\"");
  });

  it("keeps extreme finite nominal labels and Factor Setup numeric cells compact", () => {
    const report = reportFixture();
    const baseFactor = report.factors[0]!;
    const html = renderF7ReportPdfHtml({
      ...report,
      factors: [
        { ...baseFactor, factorId: "a".repeat(64), designNominal: Number.MAX_VALUE },
        { ...baseFactor, factorId: "b".repeat(64), designNominal: -Number.MAX_VALUE },
      ],
    });
    const dimensionChain = html.match(/<svg data-dimension-chain[\s\S]*?<\/svg>/)?.[0];
    const nominalLabels = [...(dimensionChain ?? "").matchAll(/<text class="dimension-chain-metadata"[^>]*><tspan>Item \d+<\/tspan><tspan dx="10">([^<]+)<\/tspan>/g)]
      .map((match) => match[1] ?? "");
    const factorSetupTable = html.match(/<table data-factor-setup>[\s\S]*?<\/table>/)?.[0];
    const factorSetupNumericCells = [...(factorSetupTable ?? "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
      .flatMap((row) => [...row[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
        .map((cell, index) => ({ index, value: (cell[1] ?? "").replace(/<[^>]+>/g, "") })))
      .filter(({ index }) => index === 0 || index >= 2 && index <= 6)
      .map(({ value }) => value);

    expect(dimensionChain).toBeDefined();
    expect(dimensionChain).not.toMatch(/(?:NaN|-?Infinity)/);
    expect(nominalLabels).toHaveLength(2);
    expect(nominalLabels.every((label) => label.length <= 16)).toBe(true);
    expect(nominalLabels[0]).toMatch(/^\+[1-9](?:\.\d+)?e308$/);
    expect(nominalLabels[1]).toMatch(/^-[1-9](?:\.\d+)?e308$/);
    expect(factorSetupNumericCells.length).toBeGreaterThan(0);
    expect(factorSetupNumericCells).toContain("1.8e308");
    expect(factorSetupNumericCells).toContain("-1.8e308");
  });

  it("allows measurement metric lines to wrap within fixed table cells", () => {
    const html = renderF7ReportPdfHtml(reportFixture());
    const metricRule = html.match(/\.factor-measured-comparison-metric\s*\{([^}]*)\}/)?.[1];

    expect(metricRule).toBeDefined();
    expect(metricRule).toMatch(/display:\s*grid/);
    expect(metricRule).toMatch(/grid-template-rows:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(metricRule).toMatch(/white-space:\s*normal/);
    expect(metricRule).toMatch(/overflow-wrap:\s*anywhere/);
    expect(metricRule).not.toMatch(/white-space:\s*nowrap/);
    expect(html).toContain(".factor-measured-comparison-metric-three-row { grid-template-rows: repeat(3, minmax(0, 1fr)); }");
  });

  it("renders em dashes for absent optional measured metrics without inventing values", () => {
    const report = reportFixture();
    const measuredFactor = report.factors[0]!;
    const html = renderF7ReportPdfHtml({
      ...report,
      factors: [{
        ...measuredFactor,
        measurementComparison: {
          mean: measuredFactor.measurementComparison!.mean,
        },
      }],
    });
    const factorSetupTable = html.match(/<table data-factor-setup>[\s\S]*?<\/table>/)?.[0];

    expect(factorSetupTable).toBeDefined();
    expect(factorSetupTable?.match(/<strong>Actual<\/strong>(?:<span>±3σ )?<span class="actual-value-severity-normal">—<\/span>(?:<\/span>)?/g)).toHaveLength(3);
    expect(factorSetupTable?.match(/<strong>Δ<\/strong><span>—<\/span>/g)).toHaveLength(3);
    expect(factorSetupTable?.match(/<span class="comparison-percentage-group actual-value-severity-normal">\(N\/A\)<\/span>/g)).toHaveLength(3);
  });

  it("keeps the three PDF label rows legible at half-page width", () => {
    const html = renderF7ReportPdfHtml(reportFixture());

    expect(html).toContain('viewBox="0 0 800 350"');
    expect(html).toMatch(/data-reference-row="top"[^>]*>[\s\S]*?transform="translate\([^)]* 4\)"/);
    expect(html).toMatch(/<g data-factor-setup-mean data-reference-row="middle" class="factor-setup-mean"><line x1="416\.19" x2="416\.19" y1="106" y2="300"\/><g class="monte-carlo-reference-badge setup-mean-badge" transform="translate\([^)]* 38\)"><rect [^>]*height="22"[^>]*\/><text class="monte-carlo-reference-label"[^>]*>Setup Mean -0\.05<\/text><\/g><\/g>/);
    expect(html).toMatch(/data-reference-row="bottom"[^>]*>[\s\S]*?transform="translate\([^)]* 72\)"/);
    expect(html).toMatch(/\.monte-carlo-reference-label\s*\{[^}]*font:\s*700 13px/);
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
    expect(setupPath).toContain("L418.00,106.00");
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

    expect(html).toContain("Engineering Analysis");
    expect(html).toContain("<h2>Engineering Analysis</h2><p class=\"subtle\">Design &lt;unsafe&gt; 装配.xlsx · TA &lt;unsafe&gt; / Result</p>");
    expect(html).not.toContain("TA <unsafe> / Result");
    expect(html).toContain("F0 analysis unavailable");
    expect(html).toContain("Governed F0 evidence &lt;not available&gt;.");
    expect(html).not.toContain(reason);
    expect(html).toContain("Complete governed evidence.");
    expect(html).toContain("Governed assessment");
    expect(html).toContain("This statistical assessment is not a design or production Release/Hold decision.");
    const escapedReason = "Governed F0 evidence &lt;not available&gt;.";
    for (const [startHeading, endHeading] of [
      ["F0 analysis unavailable", "Governed assessment"],
    ] as const) {
      const sectionStart = html.indexOf(startHeading);
      const sectionEnd = html.indexOf(endHeading, sectionStart + 1);
      expect(sectionStart).toBeGreaterThan(-1);
      expect(sectionEnd).toBeGreaterThan(sectionStart);
      expect(html.slice(sectionStart, sectionEnd)).toContain(escapedReason);
    }
    for (const removed of ["Engineering Summary", "Root Cause Analysis", "Reproducibility Evidence"]) {
      expect(html).not.toContain(removed);
    }
    expect(html).not.toContain("data-factor-setup-fit");
    expect(html).not.toContain("<table data-report-ta-comparison>");
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
      ["F0 analysis unavailable", "Governed assessment"],
    ] as const;

    for (const [startHeading, endHeading] of affectedSections) {
      const sectionStart = html.indexOf(startHeading);
      const sectionEnd = html.indexOf(endHeading, sectionStart + 1);
      expect(sectionStart).toBeGreaterThan(-1);
      expect(sectionEnd).toBeGreaterThan(sectionStart);
      expect(html.slice(sectionStart, sectionEnd)).toContain(defaultReason);
    }
    expect(html).not.toContain("Engineering Summary");
    expect(html).not.toContain("Reproducibility Evidence");
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
