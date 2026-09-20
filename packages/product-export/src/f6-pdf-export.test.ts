import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderF6PdfSync, validatedF6InlineImages } from "./f6-pdf-export.js";
import { renderF6PdfHtml } from "./f6-pdf-report.js";

const MARKDOWN = "# Governed report\n";
const HASH = createHash("sha256").update(MARKDOWN).digest("hex");
const cleanupRoots: string[] = [];
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const temporaryManagedRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "f6-inline-images-"));
  cleanupRoots.push(root);
  return root;
};

const writeFixture = (filePath: string, value: string | Buffer): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
};

const writeBinaryFixture = writeFixture;

afterEach(() => {
  for (const root of cleanupRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("renderF6PdfSync", () => {
  it("exposes validated inline images for the editable prototype", () => {
    const root = temporaryManagedRoot();
    const reportPath = path.join(root, "runs", "run-1", "Feature6-Report.md");
    const imagePath = path.join(root, "evidence", "stack.png");
    writeFixture(reportPath, "[Open tolerance path image](<../../evidence/stack.png>)\n");
    writeBinaryFixture(imagePath, PNG);

    const markdown = readFileSync(reportPath, "utf8");
    const images = validatedF6InlineImages({
      markdown,
      sourceHash: createHash("sha256").update(markdown).digest("hex"),
      reportPath,
      managedRoot: root,
    });

    expect(images.get("../../evidence/stack.png")).toBe(`data:image/png;base64,${PNG.toString("base64")}`);
  });

  it("renders validated Markdown as PDF bytes with the source hash embedded", () => {
    const executeFile = vi.fn((_browser: string, args: readonly string[]) => {
      const output = args.find((arg) => arg.startsWith("--print-to-pdf="))?.slice("--print-to-pdf=".length);
      const htmlUrl = args.at(-1);
      if (output === undefined || htmlUrl === undefined) throw new Error("missing browser arguments");
      const htmlPath = new URL(htmlUrl);
      expect(readFileSync(htmlPath, "utf8")).toContain(`data-source-sha256="${HASH}"`);
      writeFileSync(output, Buffer.from("%PDF-1.7\nvalidated\n"));
    });

    const pdf = renderF6PdfSync({
      markdown: MARKDOWN,
      sourceHash: HASH,
      reportPath: path.resolve("Feature6-Report.md"),
      managedRoot: process.cwd(),
    }, {
      installedBrowsers: () => ["controlled-browser.exe"],
      executeFile,
    });

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(executeFile).toHaveBeenCalledOnce();
  });

  it("fails closed when no browser produces a valid PDF", () => {
    expect(() => renderF6PdfSync({
      markdown: MARKDOWN,
      sourceHash: HASH,
      reportPath: path.resolve("Feature6-Report.md"),
      managedRoot: process.cwd(),
    }, {
      installedBrowsers: () => ["controlled-browser.exe"],
      executeFile: vi.fn(),
    })).toThrow(expect.objectContaining({ code: "pdf_render_unavailable" }));
  });

  it("isolates browser profiles when falling back after a render failure", () => {
    const profilePaths: string[] = [];
    const executeFile = vi.fn((browser: string, args: readonly string[]) => {
      const profile = args.find((arg) => arg.startsWith("--user-data-dir="));
      if (profile === undefined) throw new Error("missing browser profile");
      profilePaths.push(profile);
      if (browser === "edge.exe") throw new Error("render timed out");

      const output = args.find((arg) => arg.startsWith("--print-to-pdf="))?.slice("--print-to-pdf=".length);
      if (output === undefined) throw new Error("missing PDF output");
      writeFileSync(output, Buffer.from("%PDF-1.7\nvalidated\n"));
    });

    const pdf = renderF6PdfSync({
      markdown: MARKDOWN,
      sourceHash: HASH,
      reportPath: path.resolve("Feature6-Report.md"),
      managedRoot: process.cwd(),
    }, {
      installedBrowsers: () => ["edge.exe", "chrome.exe"],
      executeFile,
    });

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(profilePaths).toHaveLength(2);
    expect(new Set(profilePaths)).toHaveLength(2);
  });

  it("reports a safe failure category for every browser attempt", () => {
    let attempt = 0;
    let failure: unknown;
    try {
      renderF6PdfSync({
        markdown: MARKDOWN,
        sourceHash: HASH,
        reportPath: path.resolve("Feature6-Report.md"),
        managedRoot: process.cwd(),
      }, {
        installedBrowsers: () => ["edge.exe", "chrome.exe"],
        executeFile: vi.fn((_browser, args) => {
          attempt += 1;
          if (attempt === 1) throw new Error("confidential browser output");
          const output = args.find((arg) => arg.startsWith("--print-to-pdf="))?.slice("--print-to-pdf=".length);
          if (output === undefined) throw new Error("missing PDF output");
          writeFileSync(output, "not a PDF");
        }),
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      code: "pdf_render_unavailable",
      attempts: [
        { browser: "edge.exe", reason: "execution_failed" },
        { browser: "chrome.exe", reason: "invalid_pdf" },
      ],
    });
    expect(String(failure)).not.toContain("confidential browser output");
  });

  it("does not render unresolved local image links", () => {
    expect(() => renderF6PdfHtml({
      markdown: "[Open image](../outside.png)",
      sourceHash: createHash("sha256").update("[Open image](../outside.png)").digest("hex"),
    })).toThrow("validated and inlined");
  });

  it("renders Markdown image tokens only from validated inline bytes", () => {
    const markdown = "![Tolerance stack](evidence/stack.png)";
    const html = renderF6PdfHtml({
      markdown,
      sourceHash: createHash("sha256").update(markdown).digest("hex"),
      inlineImages: new Map([["evidence/stack.png", "data:image/png;base64,iVBORw0KGgo="]]),
    });

    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(html).not.toContain('src="evidence/stack.png"');
  });

  it("renders a fixed 16:9 Stencil and Tablet summary plus one slide per worksheet", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "## 2. Workbook Summary",
      "",
      "| Result | Worksheet | Tolerance Loop Description | Key Finding |",
      "|---|---|---|---|",
      "| Pass | [Analysis-A](#worksheet-1) | Loop A | Meets target. |",
      "| Need Review | [Analysis-B](#worksheet-2) | Loop B | Review required. |",
      "| Fail | [Analysis-C](#worksheet-3) | Loop C | Does not meet target. |",
      "",
      '<a id="worksheet-1"></a>',
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Contributor Priorities",
      "",
      "| Rank | Factor | One Sigma | Variance Contribution | Priority | Guidance |",
      "|---:|---|---:|---:|---|---|",
      "| 1 | Factor A | 0.1 mm | 60.0% | High | Tighten tolerance |",
    ].join("\n");
    const html = renderF6PdfHtml({
      markdown,
      sourceHash: createHash("sha256").update(markdown).digest("hex"),
    });

    expect(html).toContain("@page { size:20in 11.25in;");
    expect(html).toContain('class="report-content slide slide-summary"');
    expect(html).toContain('<section class="worksheet-section slide slide-worksheet" id="worksheet-1">');
    expect(html).toContain('href="#worksheet-1"');
    expect(html).toContain('class="comment comment--pass">Pass</span>');
    expect(html).toContain('class="comment comment--need-review">Need Review</span>');
    expect(html).toContain('class="comment comment--fail">CPK FAIL</span>');
    expect(html).toContain('class="contribution-chart"');
    expect(html).not.toContain('<table class="contribution-table"');
    expect(html).not.toContain("fitWorksheetPages");
    expect(html).toContain("width:1920px");
    expect(html).toContain("height:1080px");
    expect(html).toContain("break-after:page");
    expect(html).toContain("Stardos Stencil");
    expect(html).toContain("Barlow Condensed");
    expect(html).toContain("--p-gray-242:#F2F2F2");
    expect(html).toContain('class="analysis-grid"');
    expect(html).toContain('analysis-panel--contributors');
    expect(html).toContain("grid-template-columns:.72fr 1.15fr .95fr");
    expect(html).toContain("grid-template-rows:1fr 220px");
  });

  it("renders exactly one summary slide plus one slide per worksheet", () => {
    const worksheetSections = Array.from({ length: 5 }, (_value, index) => [
      `# 3-${index + 1} Worksheet: Analysis-${index + 1}`,
      "",
      "Worksheet content.",
    ].join("\n"));
    const markdown = ["# TA Engineering Analysis Report", "", ...worksheetSections].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html.match(/class="report-content slide slide-summary"/gu)).toHaveLength(1);
    expect(html.match(/class="worksheet-section slide slide-worksheet"/gu)).toHaveLength(5);
    expect(html.match(/class="[^"]*\bslide\b[^"]*"/gu)).toHaveLength(6);
  });

  it("paginates localized worksheets and maps localized panel headings", () => {
    const markdown = [
      "# TA 工程分析报告",
      "",
      "# 3-1 工作表: 分析-A",
      "",
      "## 完整 Factor 表",
      "",
      "| Ordinal | Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |",
      "|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
      "| A | Factor A | Part A | CNC | DWG-1 | DIM-1 | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | 0 mm | 0.1 mm | 0.025 mm | Within guidance |",
      "",
      "## 公差路径图片",
      "",
      "Image reviewed.",
      "",
      "## 要求与统计结果",
      "",
      "Results reviewed.",
      "",
      "## 贡献因子优先级",
      "",
      "Contributors reviewed.",
      "",
      "## 规格变更建议",
      "",
      "No change proposed.",
      "",
      "# 3-2 工作表: 分析-B",
      "",
      "Worksheet content.",
    ].join("\n");

    const html = renderF6PdfHtml({
      markdown,
      sourceHash: createHash("sha256").update(markdown).digest("hex"),
    });

    expect(html.match(/class="worksheet-section slide slide-worksheet"/gu)).toHaveLength(2);
    expect(html).toContain('id="worksheet-1"');
    expect(html).toContain('id="worksheet-2"');
    expect(html).toContain('class="factor-table factor-table--complete"');
    expect(html).toContain('analysis-panel--image');
    expect(html).toContain('analysis-panel--results');
    expect(html).toContain('analysis-panel--contributors');
    expect(html).toContain('analysis-panel--specifications');
  });

  it("renders the issue 121 bounded worksheet layout", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "## 1. Document Overview",
      "",
      "| Field | Value |",
      "|---|---|",
      "| Source Workbook | sample.xlsx |",
      "",
      "## 2. Workbook Summary",
      "",
      "| Result | Worksheet | Tolerance Loop Description | Key Finding |",
      "|---|---|---|---|",
      "| Fail | [Analysis-A](#worksheet-1) | Loop A | Drawing Numbers, drawing dimension definition is missing. |",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Complete Factor Table",
      "",
      "| Ordinal | Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |",
      "|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
      "| A | Factor A | Part A | CNC | DRAW-1 | DIM-1 | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | 0 mm | 0.1 mm | 0.025 mm | Within guidance |",
      "",
      "## Process and Requirements",
      "",
      "- A: Factor A; Recommended tolerance band: 0.20 mm",
      "- Result: WARNING - engineering review required.",
      "",
      "## Tolerance Path Image",
      "",
      "Image reviewed.",
      "",
      "## Requirements and Statistical Results",
      "",
      "| Requirement | Value |",
      "|---|---:|",
      "| Design Nominal | 0.000 mm |",
      "| LSL | -0.150 mm |",
      "| USL | 0.050 mm |",
      "| Target Cpk | 1.333 |",
      "| Evaluation Level | 4 sigma |",
      "",
      "| Metric | Lower | Upper | Minimum Margin | Result |",
      "|---|---:|---:|---:|---|",
      "| 3-Sigma Range | -0.100 mm | 0.040 mm | 0.010 mm | PASS |",
      "| 4-Sigma Range | -0.120 mm | 0.060 mm | -0.010 mm | FAIL |",
      "| 6-Sigma Range | -0.160 mm | 0.100 mm | -0.050 mm | FAIL |",
      "| Worst-Case Range | -0.200 mm | 0.150 mm | -0.100 mm | FAIL |",
      "",
      "| Capability Metric | Value | Result |",
      "|---|---:|---|",
      "| Predictive Cp | 0.794 | FAIL |",
      "| Predictive CpkL | 0.794 | FAIL |",
      "| Predictive CpkU | 0.794 | FAIL |",
      "| Predictive Cpk | 0.794 | FAIL |",
      "",
      "## Adjusted Mean to Spec Center Shift",
      "",
      "- Design Nominal: 0.000 mm",
      "- Adjusted Mean: -0.050 mm",
      "- Offset: -0.050 mm",
      "",
      "## Contributor Priorities",
      "",
      "| Rank | Factor | One Sigma | Variance Contribution | Priority | Guidance |",
      "|---:|---|---:|---:|---|---|",
      "| 1 | Factor A | 0.025 mm | 100.0% | High | Tighten tolerance |",
      "",
      "## Specification Changes",
      "",
      "| Side | Current Limit | Proposed Limit | Target Cpk | Approval |",
      "|---|---:|---:|---:|---|",
      "| lower | -0.150 | -0.180 | 1.333 | Engineering approval required |",
      "| upper | 0.050 | 0.080 | 1.333 | Engineering approval required |",
      "",
      "- Summary: Adjust the specification range from [-0.150, 0.0500] to [-0.180, 0.0800], subject to ME and requirement-owner approval.",
      "",
      "<!-- f6-optimization-comparison -->",
      "## Optimization Comparison",
      "",
      "| Metric | Raw Data | Optimized Data |",
      "|---|---:|---:|",
      "| Predictive Cpk | 0.740 | 1.333 |",
    ].join("\n");
    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain("grid-template-columns:.72fr 1.28fr");
    expect(html).toContain('class="comment comment--fail">CPK FAIL</span>');
    expect(html).toContain('analysis-panel--process');
    expect(html).toContain('class="range-spec-line range-spec-line--lower"');
    expect(html).toContain('class="range-spec-line range-spec-line--upper"');
    expect(html.match(/class="range-spec-labels"/gu)).toHaveLength(1);
    expect(html.match(/class="range-spec-label range-spec-label--lower">/gu)).toHaveLength(1);
    expect(html.match(/class="range-spec-label range-spec-label--upper">/gu)).toHaveLength(1);
    expect(html.match(/class="range-spec-line range-spec-line--lower" aria-hidden="true"/gu)).toHaveLength(4);
    expect(html.match(/class="range-spec-line range-spec-line--upper" aria-hidden="true"/gu)).toHaveLength(4);
    expect(html).toContain('<small class="range-values">-0.100 to 0.0400');
    expect(html).not.toContain("Margin");
    expect(html).toContain('data-worst-case-result="FAIL"');
    expect(html).toContain('data-evaluation-level="4 sigma"');
    expect(html).toContain("<figcaption><span>Capability against target</span><strong>4 sigma · 1.33</strong></figcaption>");
    expect(html).toContain('class="mean-marker mean-marker--nominal"');
    expect(html).toContain('class="mean-marker mean-marker--adjusted"');
    expect(html).toContain('class="mean-value mean-value--nominal">Design nominal');
    expect(html).toContain('class="mean-value mean-value--adjusted">Adjusted mean');
    expect(html).toContain('class="spec-marker spec-marker--current"');
    expect(html).toContain('class="spec-marker spec-marker--proposed"');
    expect(html).toContain('<div class="spec-change-legend"><span class="spec-value spec-value--current">Current</span><span class="spec-value spec-value--proposed">Proposed</span></div>');
    expect(html).toContain('class="spec-value spec-value--current"');
    expect(html).toContain('class="spec-value spec-value--proposed"');
    expect(html).toContain("Adjust the specification range from [-0.150, 0.0500] to [-0.180, 0.0800]");
    expect(html).toContain("--signal-red:var(--p-dark-red)");
    expect(html).toContain("--signal-green:var(--p-green)");
    expect(html).toContain(".factor-table th:nth-child(15),.factor-table td:nth-child(15) { width:12%;");
    expect(html).toContain("--raw-data:#0078D4");
    expect(html).toContain("--interpretation:#50E6FF");
    expect(html).toContain("--optimization:#D59DFF");
    expect(html).toContain('class="report-stage-legend"');
    expect(html).toContain('<span class="stage-key stage-key--raw">Raw data</span>');
    expect(html).toContain('<span class="stage-key stage-key--interpretation">Interpretation</span>');
    expect(html).toContain('<span class="stage-key stage-key--optimization">Optimization</span>');
    expect(html).toContain(".slide-summary { grid-template-columns:.72fr 1.28fr; grid-template-rows:64px 1fr;");
    expect(html).toContain(".slide-summary>h1 { grid-column:1/-1; align-self:start;");
    expect(html).toContain(".workbook-summary td { white-space:nowrap; font-size:12px; line-height:1;");
    expect(html).toContain(".workbook-summary th:nth-child(1),.workbook-summary td:nth-child(1) { width:9%;");
    expect(html).toContain(".workbook-summary th:nth-child(2),.workbook-summary td:nth-child(2) { width:21%;");
    expect(html).toContain(".workbook-summary th:nth-child(3),.workbook-summary td:nth-child(3) { width:25%;");
    expect(html).toContain(".workbook-summary th:nth-child(4),.workbook-summary td:nth-child(4) { width:45%;");
    expect(html).toContain(".workbook-summary .comment { display:inline-block; padding:3px 6px;");
    expect(html).toContain(".factor-table th:nth-child(2),.factor-table td:nth-child(2) { width:17%; white-space:nowrap;");
    expect(html).toContain(".factor-table--dense th:nth-child(2),.factor-table--dense td:nth-child(2) { width:20%; white-space:nowrap;");
    expect(html).toContain(".range-spec-line { position:absolute; top:-.8mm; width:1px; height:5.6mm; min-height:0; padding:0; background:var(--signal-red); font-size:0; z-index:4;");
    expect(html).toContain(".analysis-panel--image>h2,.analysis-panel--results>h2 { color:var(--interpretation); }");
    expect(html).toContain(".analysis-panel--center>h2,.analysis-panel--contributors>h2,.analysis-panel--specifications>h2 { color:var(--optimization); }");
    expect(html).toContain(".analysis-panel--center h2,.analysis-panel--contributors h2,.analysis-panel--specifications h2 { margin-bottom:6px; font-size:22px; }");
    expect(html).toContain(".analysis-panel--center .mean-offset-graph p { color:var(--p-black); font-size:11px;");
    expect(html).toContain('.analysis-panel--center::after,.analysis-panel--contributors::after { content:"→";');
    expect(html).toContain(".analysis-panel--contributors:last-child::after { display:none; }");
    expect(html).toContain("th { background:var(--raw-data) !important;");
    expect(html.match(/class="worksheet-section slide slide-worksheet"/gu)).toHaveLength(1);
    expect(html.match(/class="[^"]*\bslide\b[^"]*"/gu)).toHaveLength(2);
    expect(html).not.toMatch(/class="[^"]*slide-optimization/u);
  });

  it("anchors specification labels to track edges and positions row markers by graph domain", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Requirements and Statistical Results",
      "",
      "| Requirement | Value |",
      "|---|---:|",
      "| Design Nominal | 0.000 mm |",
      "| LSL | -0.150 mm |",
      "| USL | 0.050 mm |",
      "| Target Cpk | 1.333 |",
      "| Evaluation Level | 4 sigma |",
      "",
      "| Metric | Lower | Upper | Minimum Margin | Result |",
      "|---|---:|---:|---:|---|",
      "| 3-Sigma Range | -0.100 mm | 0.040 mm | 0.010 mm | PASS |",
      "| 4-Sigma Range | -0.120 mm | 0.060 mm | -0.010 mm | FAIL |",
      "| 6-Sigma Range | -0.160 mm | 0.100 mm | -0.050 mm | FAIL |",
      "| Worst-Case Range | -0.200 mm | 0.150 mm | -0.100 mm | FAIL |",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain('class="range-spec-label range-spec-label--lower">LSL -0.150</b>');
    expect(html).toContain('class="range-spec-label range-spec-label--upper">USL 0.0500</b>');
    expect(html.match(/class="range-spec-line range-spec-line--lower" aria-hidden="true" style="left:14\.2857142857142\d%"/gu)).toHaveLength(4);
    expect(html.match(/class="range-spec-line range-spec-line--upper" aria-hidden="true" style="left:71\.42857142857143%"/gu)).toHaveLength(4);
  });

  it("renders MISSING status, DIM ID review, range row spec lines, image3 palette, and 60/40 image split", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Complete Factor Table",
      "",
      "| Ordinal | Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |",
      "|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
      "| A | Factor A | Part A | CNC | MISSING | 1 | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | MISSING | MISSING | N/A | Controlled guidance |",
      "| B | Factor B | Part B | CNC | DWG-2 | DIM-1 | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | 0 mm | 0.1 mm | 0.025 mm | Controlled guidance |",
      "| C | Factor C | Part C | CNC | DWG-3 | 12 | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | 0 mm | 0.1 mm | 0.025 mm | Controlled guidance |",
      "",
      "## Process and Requirements",
      "",
      "| Check | Status | Assessment |",
      "|---|---|---|",
      "| Input Completeness | MISSING | Drawing Number is missing. |",
      "| Target Sigma | WARNING | Current 4 sigma differs from recommended 6 sigma. |",
      "| Output Completeness | COMPLETE | Specification limits are available. |",
      "",
      "## Tolerance Path Image",
      "",
      "![Tolerance stack](evidence/stack.png)",
      "",
      "Reviewed by model. *Model output is advisory.*",
      "",
      "## Requirements and Statistical Results",
      "",
      "| Requirement | Value |",
      "|---|---:|",
      "| Design Nominal | 0.000 mm |",
      "| LSL | -0.150 mm |",
      "| USL | 0.050 mm |",
      "| Target Cpk | 1.333 |",
      "| Evaluation Level | 4 sigma |",
      "",
      "| Metric | Lower | Upper | Minimum Margin | Result |",
      "|---|---:|---:|---:|---|",
      "| 3-Sigma Range | -0.0294 mm | 0.409 mm | -0.359 mm | PASS |",
      "| 4-Sigma Range | -0.120 mm | 0.060 mm | -0.010 mm | FAIL |",
      "| 6-Sigma Range | -0.160 mm | 0.100 mm | -0.050 mm | FAIL |",
      "| Worst-Case Range | -0.200 mm | 0.150 mm | -0.100 mm | FAIL |",
    ].join("\n");

    const html = renderF6PdfHtml({
      markdown,
      sourceHash: createHash("sha256").update(markdown).digest("hex"),
      inlineImages: new Map([["evidence/stack.png", "data:image/png;base64,iVBORw0KGgo="]]),
    });

    expect(html).toContain('<strong class="status-missing">MISSING</strong>');
    expect(html).toContain('<strong class="status-warning">WARNING</strong>');
    expect(html).toContain('<strong class="status-complete">COMPLETE</strong>');
    expect(html).toContain('<strong class="dim-id-review">1</strong>');
    expect(html).not.toContain('<strong class="dim-id-review">DIM-1</strong>');
    expect(html).not.toContain('<strong class="dim-id-review">12</strong>');
    expect(html.match(/class="range-spec-line range-spec-line--lower"/gu)).toHaveLength(4);
    expect(html.match(/class="range-spec-line range-spec-line--upper"/gu)).toHaveLength(4);
    expect(html.match(/class="range-spec-labels"/gu)).toHaveLength(1);
    expect(html).toContain('<small class="range-values">-0.0294 to 0.409</small>');
    expect(html).not.toContain("Margin");
    expect(html).not.toContain("grid-template-columns:60% 40%");
    expect(html).toContain("grid-template-columns:minmax(0,3fr) minmax(0,2fr)");
    expect((html.match(/grid-template-columns:minmax\(0,3fr\) minmax\(0,2fr\)/gu) ?? [])).toHaveLength(2);
    expect(html).toContain(".analysis-panel--image { display:grid; min-width:0; grid-template-columns:minmax(0,3fr) minmax(0,2fr);");
    expect(html).toContain(".analysis-panel--image>.stack-image { display:block; min-width:0; grid-column:1; grid-row:2/span 4; width:100%; margin:0;");
    expect(html).toContain(".analysis-panel--image .stack-image img { width:100%; height:248px; max-height:248px; object-fit:contain;");
    expect(html).toContain(".analysis-panel--image>p { min-width:0; grid-column:2; margin:7px 0; color:var(--p-black); font-size:15px; line-height:1.28;");
    expect(html).toContain("object-fit:contain");
    for (const color of [
      "#000000", "#FFFFFF", "#F2F2F2", "#D2D2D2", "#505050",
      "#FF9349", "#FEF000", "#9BF00B", "#30E5D0", "#50E6FF",
      "#D59DFF", "#A72929",
    ]) expect(html).toContain(color);
    expect(html).not.toMatch(/#e2dcc9|#c73b7a|#ee7a2e|#2d7e73|#3f73b7|#d8a93b/iu);
  });

  it("keeps the target-only capability caption when evaluation level is missing", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Requirements and Statistical Results",
      "",
      "| Requirement | Value |",
      "|---|---:|",
      "| Design Nominal | 0.000 mm |",
      "| LSL | -0.150 mm |",
      "| USL | 0.050 mm |",
      "| Target Cpk | 1.333 |",
      "| Evaluation Level |  |",
      "",
      "| Capability Metric | Value | Result |",
      "|---|---:|---|",
      "| Predictive Cp | 0.794 | FAIL |",
      "| Predictive CpkL | 0.794 | FAIL |",
      "| Predictive CpkU | 0.794 | FAIL |",
      "| Predictive Cpk | 0.794 | FAIL |",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain("<figcaption><span>Capability against target</span><strong>1.33</strong></figcaption>");
    expect(html).not.toContain("N/A · 1.33");
    expect(html).not.toContain("data-evaluation-level=");
  });

  it("keeps optimization comparison inline between worksheet slides", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Contributor Priorities",
      "",
      "| Rank | Factor | One Sigma | Variance Contribution | Priority | Guidance |",
      "|---:|---|---:|---:|---|---|",
      "| 1 | Factor A | 0.1 mm | 60.0% | High | Tighten tolerance |",
      "",
      "<!-- f6-optimization-comparison -->",
      "## Optimization Comparison",
      "",
      "| Metric | Raw Data | Optimized Data |",
      "|---|---:|---:|",
      "| Predictive Cpk | 0.740000 | 1.333000 |",
      "",
      "# 3-2 Worksheet: Analysis-B",
      "",
      "Worksheet content.",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toMatch(/slide-worksheet[\s\S]*optimization-inline--optimization[\s\S]*slide-worksheet/u);
    expect(html.match(/class="[^"]*slide-optimization/g)).toBeNull();
    expect(html.match(/class="worksheet-section slide slide-worksheet"/gu)).toHaveLength(2);
    expect(html).toContain("width:1920px");
    expect(html).toContain("height:1080px");
    expect(html).toContain(".optimization-table--path td { overflow-wrap:anywhere; word-break:break-word; }");
    expect(html).toContain(".optimization-table--path th:nth-child(3),.optimization-table--path td:nth-child(3) { width:32%; }");
  });

  it("keeps worksheet flow unchanged when optimization heading has no marker", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Optimization Comparison",
      "",
      "| Metric | Raw Data | Optimized Data |",
      "|---|---:|---:|",
      "| Predictive Cpk | 0.740000 | 1.333000 |",
      "",
      "# 3-2 Worksheet: Analysis-B",
      "",
      "Worksheet content.",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html.match(/class="[^"]*slide-optimization/g)).toBeNull();
    expect(html).toContain('<h2>Optimization Comparison</h2>');
    expect(html.match(/class="worksheet-section slide slide-worksheet"/gu)).toHaveLength(2);
  });

  it("renders continuation marker inline and preserves balanced closure", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "<!-- f6-optimization-comparison continuation=\"1\" -->",
      "## Optimization Comparison (Continued)",
      "",
      "| Factor | Table / Row | Nominal Raw -> Optimized | Tolerance Raw -> Optimized | Sigma Raw -> Optimized | Contribution Raw -> Optimized | Changed By |",
      "|---|---|---|---|---|---|---|",
      "| Factor A | Main / 12 | 0.000 -> 0.000 | -0.100 / 0.100 -> -0.080 / 0.080 | 0.025 -> 0.020 | 100% -> 100% | toleranceReverseSolve |",
      "",
      "# 3-2 Worksheet: Analysis-B",
      "",
      "Worksheet content.",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect((html.match(/class="optimization-inline optimization-inline--optimization-continuation/g) ?? [])).toHaveLength(1);
    expect(html).toContain('class="optimization-table optimization-table--factors"');
    expect(html).toMatch(/optimization-inline--optimization-continuation"[^>]*>[\s\S]*<\/section><\/div><\/section><section class="worksheet-section slide slide-worksheet" id="worksheet-2">/u);
    expect(html.match(/class="report-content slide slide-summary"/gu)).toHaveLength(1);
    expect(html.match(/class="worksheet-section slide slide-worksheet"/gu)).toHaveLength(2);
    expect(html.match(/class="[^"]*\bslide\b[^"]*"/gu)).toHaveLength(3);
  });

  it("closes optimization slide wrappers in exact order before continuation and next worksheet", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "<!-- f6-optimization-comparison -->",
      "## Optimization Comparison",
      "",
      "| Metric | Raw Data | Optimized Data |",
      "|---|---:|---:|",
      "| Predictive Cpk | 0.740000 | 1.333000 |",
      "",
      "<!-- f6-optimization-comparison continuation=\"1\" -->",
      "## Optimization Comparison (Continued)",
      "",
      "| Factor | Table / Row | Nominal Raw -> Optimized | Tolerance Raw -> Optimized | Sigma Raw -> Optimized | Contribution Raw -> Optimized | Changed By |",
      "|---|---|---|---|---|---|---|",
      "| Factor A | Main / 12 | 0.000 -> 0.000 | -0.100 / 0.100 -> -0.080 / 0.080 | 0.025 -> 0.020 | 100% -> 100% | toleranceReverseSolve |",
      "",
      "# 3-2 Worksheet: Analysis-B",
      "",
      "Worksheet content.",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain('</section><section class="optimization-inline optimization-inline--optimization-continuation">');
    expect(html).toContain('</section></div></section><section class="worksheet-section slide slide-worksheet" id="worksheet-2">');
  });

  it("renders the Task 3 complete Factor table with hidden missing markers preserved", () => {
    const markdown = [
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Complete Factor Table",
      "",
      "| Ordinal | Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |",
      "|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
      "| A | Factor A <span class=\"f6-inline-marker\" data-f6-marker=\"required-missing\" data-source-row=\"14\" hidden aria-hidden=\"true\"></span> | Part A | CNC | MISSING | DIM-14 | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | N/A | N/A | N/A | Capability: f0_information_insufficient; Knowledge: missing_process_context |",
      "| B | Factor B | Part B | PCBA | DWG-2 | DIM-15 | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | 0 mm | 0.1 mm | 0.020 mm | Capability: internal_within_guidance; Recommended tolerance band or range: &lt;= 0.35 mm; Knowledge: internal-v9 · dynamic-rule |",
      "",
      "## Requirements and Statistical Results",
      "",
      "| Requirement | Value |",
      "|---|---:|",
      "| Design Nominal | 0.000 mm |",
      "| LSL | -0.150 mm |",
      "| USL | 0.050 mm |",
      "| Target Cpk | 1.333 |",
      "| Evaluation Level | 3 sigma |",
      "",
      "| Metric | Lower | Upper | Minimum Margin | Result |",
      "|---|---:|---:|---:|---|",
      "| Statistical Range | -0.120 mm | 0.040 mm | 0.010 mm | PASS |",
      "| Worst-Case Range | -0.200 mm | 0.100 mm | -0.050 mm | FAIL |",
      "",
      "| Capability Metric | Value | Result |",
      "|---|---:|---|",
      "| Predictive CpkL | 0.740 | FAIL |",
      "| Predictive CpkU | 1.480 | PASS |",
      "| Predictive Cpk | 0.740 | FAIL |",
      "| Predicted Yield | 97.3% | N/A |",
      "| Predicted DPM | 26500 | N/A |",
      "",
      "## Adjusted Mean to Spec Center Shift",
      "",
      "- Status: offset",
      "- Adjusted Mean: -0.050 mm",
      "- Design Nominal: -0.050 mm",
      "- Offset: 0.010 mm",
      "",
      "## Contributor Priorities",
      "",
      "| Rank | Factor | One Sigma | Variance Contribution | Priority | Guidance |",
      "|---:|---|---:|---:|---|---|",
      "| 1 | Factor A | 0.025 mm | 60.0% | High | Tighten tolerance |",
      "| 2 | Factor B | 0.020 mm | 30.0% | Medium | Review process |",
      "| 3 | Factor C | 0.015 mm | 7.7% | Medium | Confirm input |",
      "",
      "## Specification Changes",
      "",
      "| Side | Current Limit | Proposed Limit | Target Cpk | Approval |",
      "|---|---:|---:|---:|---|",
      "| lower | -0.150 | -0.180 | 1.333 | Engineering approval required |",
      "| upper | 0.050 | 0.080 | 1.333 | Engineering approval required |",
    ].join("\n");
    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain('<table class="factor-table factor-table--complete" data-factor-count="2">');
    expect(html).toContain('<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="14" hidden="" aria-hidden="true"></span>');
    expect(html).toMatch(/<tr class="[^"]*missing[^"]*">\s*<td>A<\/td>\s*<td>Factor A <span class="f6-inline-marker"/u);
    expect(html).toContain("Factor A");
    expect(html).toContain("MISSING");
    expect(html).toContain("<th>Guidance</th>");
    expect(html).toContain("Insufficient evidence");
    expect(html).toContain("Within guidance &le; 0.350&nbsp;mm");
    expect(html).not.toContain("f0_information_insufficient");
    expect(html).not.toContain("internal-v1");
    expect(html).not.toContain('class="drawing-health"');
    expect(html).toContain('class="capability-spectrum"');
    expect(html).toContain('data-target-cpk="1.333"');
    expect(html).toContain("<figcaption><span>Capability against target</span><strong>3 sigma · 1.33</strong></figcaption>");
    expect(html).toContain("<strong>1.48</strong>");
    expect(html).toContain('<span class="spec-value spec-value--current">-0.150</span> → <span class="spec-value spec-value--proposed">-0.180</span>');
    expect(html).toContain('class="spec-range-graph"');
    expect(html).toContain('data-statistical-result="PASS"');
    expect(html).toContain('data-worst-case-result="FAIL"');
    expect(html).toContain('class="mean-offset-graph"');
    expect(html).toContain('data-offset="0.010"');
    expect(html).toContain('class="contribution-chart"');
    expect(html).toContain("<strong>7.70&nbsp;%</strong>");
    expect(html).toContain('class="spec-change-graph"');
    expect(html).not.toContain('<table class="result-table">');
    expect(html).not.toContain('<table class="analysis-table">');
    expect(html).not.toContain("Graph-first engineering brief");
    expect(html).toContain('data-factor-count="2"');
    expect(html).toContain(".factor-table { height:330px;");
  });

  it("renders restrained report branding and separates statistical labels", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "## Document Overview",
      "",
      "| Field | Value |",
      "|---|---|",
      "| Source Workbook | Analysis.xlsx |",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Process and Requirements",
      "",
      "| Check | Status | Assessment |",
      "|---|---|---|",
      "| ADO Traceability | COMPLETE | ADO work item updated. |",
      "",
      "## Tolerance Path Image",
      "",
      "![Tolerance stack](evidence/stack.png)",
      "",
      "## Requirements and Statistical Results",
      "",
      "| Requirement | Value |",
      "|---|---:|",
      "| Design Nominal | 0.000 mm |",
      "| LSL | -0.150 mm |",
      "| USL | 0.050 mm |",
      "| Target Cpk | 1.333 |",
      "| Evaluation Level | 4 sigma |",
      "",
      "| Metric | Lower | Upper | Minimum Margin | Result |",
      "|---|---:|---:|---:|---|",
      "| 4-Sigma Range | -0.120 mm | 0.060 mm | -0.010 mm | FAIL |",
      "",
      "| Capability Metric | Value | Result |",
      "|---|---:|---|",
      "| Predictive Cpk | 0.740 | FAIL |",
    ].join("\n");

    const html = renderF6PdfHtml({
      markdown,
      sourceHash: createHash("sha256").update(markdown).digest("hex"),
      inlineImages: new Map([["evidence/stack.png", "data:image/png;base64,iVBORw0KGgo="]]),
    });

    expect(html).toContain("TA ENGINEERING ANALYSIS REPORT - TA ASSIST AGENT DRAFT");
    expect(html).toContain("font:700 56px/.9 var(--st-display)");
    expect(html).not.toContain('.slide::after');
    expect(html).not.toContain('content:"TA Assist Agent');
    expect(html).toContain(".document-overview td,.workbook-summary td { padding:9px 16px;");
    expect(html).toContain("font-size:17px;");
    expect(html).toContain(".workbook-summary td { white-space:nowrap; font-size:12px;");
    expect(html).toContain(".workbook-summary .comment { display:inline-block; padding:3px 6px;");
    expect(html).toContain("font:800 12px/1 var(--st-meta)");
    expect(html).toContain(".analysis-panel--process { grid-column:1; grid-row:1; background:var(--p-white);");
    expect(html).toContain(".analysis-panel--results { display:block; grid-column:3; grid-row:1; background:var(--p-white);");
    expect(html).toContain('class="range-spec-label range-spec-label--lower">LSL -0.150</b>');
    expect(html).toContain('class="range-spec-label range-spec-label--upper">USL 0.0500</b>');
    expect(html).toContain("<figcaption><span>Capability against target</span><strong>4 sigma · 1.33</strong></figcaption>");
  });

  it("keeps summary tables inside their borders and applies the governed visual hierarchy", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "## Document Overview",
      "",
      "| Field | Value |",
      "|---|---|",
      "| Source Workbook | Analysis.xlsx |",
      "",
      "## Workbook Summary",
      "",
      "| Result | Worksheet | Tolerance Loop Description | Key Finding |",
      "|---|---|---|---|",
      "| Fail | [Analysis-A](#worksheet-1) | Loop A | Capability requires review. |",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Complete Factor Table",
      "",
      "| Ordinal | Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |",
      "|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
      "| A | Factor A | Part A | CNC | DWG-1 | DIM-1 | 1 mm | 0.1 mm | -0.1 mm | 1 | 4 | 1 mm | 0.1 mm | 0.025 mm | Capability: non_f0_process_category |",
      "",
      "## Process and Requirements",
      "",
      "| Check | Status | Assessment |",
      "|---|---|---|",
      "| ADO Traceability | COMPLETE | ADO work item updated. |",
      "",
      "## Tolerance Path Image",
      "",
      "## Requirements and Statistical Results",
      "",
      "## Adjusted Mean to Spec Center Shift",
      "",
      "## Contributor Priorities",
      "",
      "## Specification Changes",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain(">CPK FAIL</span>");
    expect(html).toContain(".comment--fail { color:var(--p-dark-red) !important;");
    expect(html).toContain(".document-overview,.workbook-summary { align-self:stretch; box-sizing:border-box;");
    expect(html).toContain("clip-path:inset(0 round 24px)");
    expect(html).toContain("text-align:center; text-transform:uppercase;");
    expect(html).toContain(".workbook-summary td:nth-child(2) a { color:var(--raw-data);");
    expect(html).toContain(".factor-table th:nth-child(6),.factor-table td:nth-child(6) { width:3%;");
    expect(html).toContain(".factor-table th:nth-child(15),.factor-table td:nth-child(15) { width:12%;");
    expect(html).toContain(".analysis-panel--process>h2,.analysis-panel--image>h2,.analysis-panel--results>h2 { color:var(--interpretation);");
    expect(html).toContain('<span class="step-label">Step 1</span>');
    expect(html).toContain('<span class="step-label">Step 2</span>');
    expect(html).toContain('<span class="step-label">Step 3</span>');
    expect(html).toContain(".analysis-panel--center,.analysis-panel--contributors,.analysis-panel--specifications { height:220px;");
    expect(html).toContain(".analysis-panel--center>h2,.analysis-panel--contributors>h2,.analysis-panel--specifications>h2 { display:flex; align-items:baseline; white-space:nowrap;");
    expect(html).toContain(".step-label { flex:0 0 auto;");
    expect(html).toContain(".document-overview th:first-child,.workbook-summary th:first-child { border-top-left-radius:22px;");
    expect(html).toContain(".document-overview th:last-child,.workbook-summary th:last-child { border-top-right-radius:22px;");
    expect(html).toContain(".analysis-panel--contributors { padding:20px 22px 10px;");
    expect(html).toContain("--signal-green:var(--p-green)");
    expect(html).toContain("--p-green:#9BF00B");
  });

  it("uses compact Factor rows after seven entries and normalizes unavailable guidance", () => {
    const rows = Array.from({ length: 8 }, (_value, index) => (
      `| ${index + 1} | Factor description ${index + 1} | Part | CNC | DWG-${index + 1} | DIM-${index + 1} | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | 0 mm | 0.1 mm | 0.020 mm | ${index === 0 ? "Capability: f0_information_insufficient; Knowledge: guidance_unknown" : "Capability: non_f0_process_category"} |`
    ));
    const markdown = [
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Complete Factor Table",
      "",
      "| Ordinal | Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |",
      "|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
      ...rows,
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain('class="factor-table factor-table--complete factor-table--dense" data-factor-count="8"');
    expect(html).toContain("Insufficient evidence");
    expect(html).toContain("Not covered");
    expect(html).not.toContain("guidance_unknown");
    expect(html).not.toContain("f0_information_insufficient");
    expect(html).toContain(".factor-table--dense th:nth-child(2),.factor-table--dense td:nth-child(2) { width:20%; white-space:nowrap;");
    expect(html).toContain(".factor-table--dense td { padding:5px 6px; font-size:13px;");
  });

  it("uses compact summary and worksheet copy with concise exceeded guidance", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "## Workbook Summary",
      "",
      "| Result | Worksheet | Tolerance Loop Description | Key Finding |",
      "|---|---|---|---|",
      "| Fail | Analysis-A | Loop A | Capability requires review. |",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Complete Factor Table",
      "",
      "| Ordinal | Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |",
      "|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
      "| A | Factor A | Part A | CNC | DWG-1 | DIM-1 | 1.2 mm | 0.2 mm | -0.2 mm | 1 | 4 | 1.2 mm | 0.2 mm | 0.05 mm | Capability: internal_guidance_exceeded; Recommended tolerance band or range: &lt;= 0.200 mm; Knowledge: internal-v1 |",
      "",
      "## Adjusted Mean to Spec Center Shift",
      "",
      "- Adjusted Mean: 1.20 mm",
      "- Design Nominal: 1.20 mm",
      "- Offset: 0.00 mm",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain("Exceeds guidance &le; 0.200&nbsp;mm");
    expect(html).not.toContain("internal_guidance_exceeded");
    expect(html).toContain(".workbook-summary td { white-space:nowrap; font-size:12px; line-height:1;");
    expect(html).toContain(".document-overview td,.workbook-summary td { padding:9px 16px;");
    expect(html).toContain(".factor-table td { padding:5px 7px;");
    expect(html).toContain(".analysis-panel--center .mean-offset-graph p { color:var(--p-black); font-size:11px;");
  });

  it("fails closed when a worksheet exceeds the fixed slide Factor capacity", () => {
    const rows = Array.from({ length: 11 }, (_value, index) => (
      `| ${index + 1} | Factor ${index + 1} | Part | CNC | DWG-${index + 1} | DIM-${index + 1} | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | 0 mm | 0.1 mm | 0.020 mm | Capability: non_f0_process_category |`
    ));
    const markdown = [
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Complete Factor Table",
      "",
      "| Ordinal | Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |",
      "|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
      ...rows,
    ].join("\n");

    expect(() => renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") }))
      .toThrow("fixed slide supports at most 10 Factors");
  });

  it("formats displayed engineering values to three significant figures", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "## 2. Workbook Summary",
      "",
      "| Result | Worksheet | Tolerance Loop Description | Key Finding |",
      "|---|---|---|---|",
      "| Fail | [Analysis-A](#worksheet-1) | Loop A | CpkL 0.7396 and CpkU 0.7396 do not meet Target Cpk 1. |",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "- Mean Response: -0.050000 mm",
      "- RSS One Sigma: 0.045069 mm",
      "- Predicted Yield: 97.3499%",
      "- DPM 26500.280602",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain("CpkL 0.740 and CpkU 0.740 do not meet Target Cpk 1.00");
    expect(html).toContain("-0.0500&nbsp;mm");
    expect(html).toContain("0.0451&nbsp;mm");
    expect(html).toContain("97.3&nbsp;%");
    expect(html).toContain("DPM 2.65 × 10^4");
    expect(html).not.toContain("0.045069 mm");
  });

  it("formats inline optimization comparison values consistently with the worksheet", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "- Mean Response: -0.050000 mm",
      "",
      "<!-- f6-optimization-comparison -->",
      "## Optimization Comparison",
      "",
      "| Metric | Raw Data | Optimized Data |",
      "|---|---:|---:|",
      "| Mean Offset | 1.234567 mm | 0.999999 mm |",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain("-0.0500&nbsp;mm");
    expect(html).toContain("1.23&nbsp;mm");
    expect(html).toContain("1.00&nbsp;mm");
    expect(html).not.toContain("1.234567 mm");
    expect(html).not.toContain("0.999999 mm");
  });

  it("fails graph values closed instead of treating unsafe or unavailable evidence as zero", () => {
    const markdown = [
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Requirements and Statistical Results",
      "",
      "| Requirement | Value |",
      "|---|---:|",
      "| Design Nominal | N/A |",
      "| LSL | N/A |",
      "| USL | N/A |",
      "| Target Cpk | N/A |",
      "",
      "| Metric | Lower | Upper | Minimum Margin | Result |",
      "|---|---:|---:|---:|---|",
      "| Statistical Range | N/A | N/A | N/A | PASS\" onmouseover=\"alert(1) |",
      "| Worst-Case Range | N/A | N/A | N/A | N/A |",
      "",
      "| Capability Metric | Value | Result |",
      "|---|---:|---|",
      "| Predictive Cpk | N/A | N/A |",
      "",
      "## Adjusted Mean to Spec Center Shift",
      "",
      "- Adjusted Mean: N/A",
      "- Design Nominal: N/A",
      "- Offset: N/A",
      "",
      "## Specification Changes",
      "",
      "| Side | Current Limit | Proposed Limit | Target Cpk | Approval |",
      "|---|---:|---:|---:|---|",
      "| lower | N/A | N/A | N/A | Engineering approval required |",
    ].join("\n");
    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).not.toContain("onmouseover=");
    expect(html).not.toContain('data-target-cpk="0.000"');
    expect(html.match(/class="graph-unavailable"/g)).toHaveLength(4);
    expect(html).toContain("Insufficient numeric evidence");
  });

  it("rejects malformed numeric evidence and clamps negative capability geometry", () => {
    const malformed = [
      "# 3-1 Worksheet: Analysis-A", "", "## Requirements and Statistical Results", "",
      "| Requirement | Value |", "|---|---:|", "| LSL | -0.150 trailing |", "| USL | 0.050 mm |", "| Design Nominal | 0.000 mm |", "| Target Cpk | 1.333 |",
      "", "| Metric | Lower | Upper | Minimum Margin | Result |", "|---|---:|---:|---:|---|", "| Statistical Range | -0.100 mm | 0.040 mm | 0.010 mm | PASS |",
    ].join("\n");
    const malformedHtml = renderF6PdfHtml({ markdown: malformed, sourceHash: createHash("sha256").update(malformed).digest("hex") });
    expect(malformedHtml).toContain('class="spec-range-graph"');
    expect(malformedHtml).toContain('class="graph-unavailable"');

    const negative = [
      "# 3-1 Worksheet: Analysis-A", "", "## Requirements and Statistical Results", "",
      "| Requirement | Value |", "|---|---:|", "| Target Cpk | 1.333 |",
      "", "| Capability Metric | Value | Result |", "|---|---:|---|", "| Predictive Cpk | -0.250 | FAIL |",
    ].join("\n");
    const negativeHtml = renderF6PdfHtml({ markdown: negative, sourceHash: createHash("sha256").update(negative).digest("hex") });
    expect(negativeHtml).toContain("<strong>-0.250</strong>");
    expect(negativeHtml).toContain('style="width:0%"');
    expect(negativeHtml).not.toMatch(/style="width:-/u);
  });
});