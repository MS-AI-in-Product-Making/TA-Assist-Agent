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
      "| Worksheet | Tolerance Loop Description | Key Finding | Comment |",
      "|---|---|---|---|",
      "| [Analysis-A](#worksheet-1) | Loop A | Meets target. | Pass |",
      "| [Analysis-B](#worksheet-2) | Loop B | Review required. | Need Review |",
      "| [Analysis-C](#worksheet-3) | Loop C | Does not meet target. | Fail |",
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
    expect(html).toContain('class="comment comment--fail">Fail</span>');
    expect(html).toContain('class="contribution-chart"');
    expect(html).not.toContain('<table class="contribution-table"');
    expect(html).not.toContain("fitWorksheetPages");
    expect(html).toContain("width:1920px");
    expect(html).toContain("height:1080px");
    expect(html).toContain("break-after:page");
    expect(html).toContain("Stardos Stencil");
    expect(html).toContain("Barlow Condensed");
    expect(html).toContain("--st-bone:#e2dcc9");
    expect(html).toContain('class="analysis-grid"');
    expect(html).toContain('analysis-panel--contributors');
    expect(html).toContain("grid-template-columns:1.15fr .85fr .72fr");
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

  it("renders worksheet -> optimization -> next worksheet in dedicated slide order", () => {
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

    expect(html).toMatch(/slide-worksheet[\s\S]*slide-optimization[\s\S]*slide-worksheet/u);
    expect((html.match(/class="[^"]*slide-optimization/g) ?? [])).toHaveLength(1);
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

  it("renders continuation marker as a continuation optimization slide and preserves balanced closure", () => {
    const markdown = [
      "# TA Engineering Analysis Report",
      "",
      "# 3-1 Worksheet: Analysis-A",
      "",
      "<!-- f6-optimization-comparison continuation=\"1\" -->",
      "## Optimization Comparison (Continued)",
      "",
      "| Factor | Table / Row | Nominal Before | Nominal After |",
      "|---|---|---:|---:|",
      "| Factor A | Main / 12 | 0.000 (+0.100 / -0.100) | 0.000 (+0.080 / -0.080) |",
      "",
      "# 3-2 Worksheet: Analysis-B",
      "",
      "Worksheet content.",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect((html.match(/class="[^"]*slide-optimization-continuation/g) ?? [])).toHaveLength(1);
    expect(html).toMatch(/slide-optimization-continuation"[^>]*>[\s\S]*<\/section><section class="worksheet-section slide slide-worksheet" id="worksheet-2">/u);
    expect(html.match(/class="report-content slide slide-summary"/gu)).toHaveLength(1);
    expect(html.match(/class="worksheet-section slide slide-worksheet"/gu)).toHaveLength(2);
    expect(html.match(/class="[^"]*\bslide\b[^"]*"/gu)).toHaveLength(4);
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
      "| Factor | Table / Row | Nominal Before | Nominal After |",
      "|---|---|---:|---:|",
      "| Factor A | Main / 12 | 0.000 (+0.100 / -0.100) | 0.000 (+0.080 / -0.080) |",
      "",
      "# 3-2 Worksheet: Analysis-B",
      "",
      "Worksheet content.",
    ].join("\n");

    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain('</section></div></section><section class="optimization-section slide slide-optimization slide-optimization-continuation">');
    expect(html).toContain('</section></div></section><section class="worksheet-section slide slide-worksheet" id="worksheet-2">');
  });

  it("renders the Task 3 complete Factor table with hidden missing markers preserved", () => {
    const markdown = [
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Complete Factor Table",
      "",
      "| Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |",
      "|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
      "| Factor A <span class=\"f6-inline-marker\" data-f6-marker=\"required-missing\" data-source-row=\"14\" hidden aria-hidden=\"true\"></span> | Part A | CNC | MISSING | DIM-14 | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | N/A | N/A | N/A | Capability: f0_information_insufficient; Knowledge: missing_process_context |",
      "| Factor B | Part B | PCBA | DWG-2 | DIM-15 | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | 0 mm | 0.1 mm | 0.020 mm | Capability: internal_within_guidance; Recommended tolerance band or range: &lt;= 0.35 mm; Knowledge: internal-v9 · dynamic-rule |",
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
      "- Specification Center: -0.050 mm",
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
    expect(html).toMatch(/<tr class="[^"]*missing[^"]*">\s*<td>Factor A <span class="f6-inline-marker"/u);
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
    expect(html).toContain("Capability against target <strong>1.33</strong>");
    expect(html).toContain("<strong>1.48</strong>");
    expect(html).toContain("<small>-0.150 → -0.180</small>");
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

  it("fails closed when a worksheet exceeds the fixed slide Factor capacity", () => {
    const rows = Array.from({ length: 11 }, (_value, index) => (
      `| Factor ${index + 1} | Part | CNC | DWG-${index + 1} | DIM-${index + 1} | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | 0 mm | 0.1 mm | 0.020 mm | Capability: non_f0_process_category |`
    ));
    const markdown = [
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Complete Factor Table",
      "",
      "| Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |",
      "|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
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
      "| Worksheet | Tolerance Loop Description | Key Finding | Comment |",
      "|---|---|---|---|",
      "| [Analysis-A](#worksheet-1) | Loop A | CpkL 0.7396 and CpkU 0.7396 do not meet Target Cpk 1. | Fail |",
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

  it("keeps optimization comparison values verbatim while preserving global formatting elsewhere", () => {
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
    expect(html).toContain("1.234567 mm");
    expect(html).toContain("0.999999 mm");
    expect(html).not.toContain("1.23&nbsp;mm");
    expect(html).not.toContain("1.00&nbsp;mm");
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
      "- Specification Center: N/A",
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