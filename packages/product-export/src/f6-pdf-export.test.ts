import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { renderF6PdfSync } from "./f6-pdf-export.js";
import { renderF6PdfHtml } from "./f6-pdf-report.js";

const MARKDOWN = "# Governed report\n";
const HASH = createHash("sha256").update(MARKDOWN).digest("hex");

describe("renderF6PdfSync", () => {
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

  it("renders a 16:9 one-page worksheet with navigable anchors and colored comments", () => {
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

    expect(html).toContain("@page { size:320mm 180mm;");
    expect(html).toContain('<section class="worksheet-section" id="worksheet-1">');
    expect(html).toContain('href="#worksheet-1"');
    expect(html).toContain('class="comment comment--pass">Pass</span>');
    expect(html).toContain('class="comment comment--need-review">Need Review</span>');
    expect(html).toContain('class="comment comment--fail">Fail</span>');
    expect(html).toContain('class="contribution-chart"');
    expect(html).not.toContain('<table class="contribution-table"');
    expect(html).toContain("fitWorksheetPages");
    expect(html).toContain("break-after:page");
    expect(html).toContain('class="analysis-grid"');
    expect(html).toContain('analysis-panel--contributors');
    expect(html).toContain("gap:0");
    expect(html).toContain("grid-template-columns:78mm minmax(0,1fr)");
    expect(html).toContain("grid-template-rows:auto auto");
    expect(html).toContain(".analysis-panel--results { display:grid; grid-template-columns:1fr 1fr;");
    expect(html).toContain(".analysis-panel--center,.analysis-panel--contributors,.analysis-panel--specifications { min-height:36mm;");
  });

  it("builds a graph-first engineering brief while retaining complete Factor data in Markdown", () => {
    const markdown = [
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Complete Factor Table",
      "",
      "| Ordinal | Row | Factor Description | Part Name | Drawing Number | DIM ID | Part Category | Design Nominal | + Tolerance | - Tolerance | Long Term/Safety Factor | Sigma Level | Distribution | Mean | Tolerance | One Sigma | % Contribution to Sigma | Notes | Capability and Knowledge Guidance |",
      "|---|---:|---|---|---|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---|---|",
      "| 1 | 14 | Factor A | Part A | MISSING | 21 | CNC | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | normal | 0 mm | 0.1 mm | 0.025 mm | 60.0% | Preserve this note | Capability: f0\\_information\\_insufficient; Knowledge: missing\\_process\\_context |",
      "| 2 | 15 | Factor B | Part B | DWG-2 | 1 | PCBA | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | normal | 0 mm | 0.1 mm | 0.020 mm | 40.0% | Preserve this note | Capability: internal_within_guidance; Recommended tolerance band or range: &lt;= 0.2 mm; Knowledge: internal-v1 |",
      "| 3 | 16 | Factor C | Part C | DWG-3 | 202 | Other | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | normal | 0 mm | 0.1 mm | 0.015 mm | 10.0% | Preserve this note | Capability: non\\_f0\\_process\\_category |",
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
      "| 3 | Factor C | 0.015 mm | 10.0% | Medium | Confirm input |",
      "",
      "## Specification Changes",
      "",
      "| Side | Current Limit | Proposed Limit | Target Cpk | Approval |",
      "|---|---:|---:|---:|---|",
      "| lower | -0.150 | -0.180 | 1.333 | Engineering approval required |",
      "| upper | 0.050 | 0.080 | 1.333 | Engineering approval required |",
    ].join("\n");
    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(markdown).toContain("| Ordinal | Row | Factor Description");
    expect(markdown).toContain("| Notes | Capability and Knowledge Guidance |");
    expect(markdown).toContain("Preserve this note");
    expect(html).not.toContain('<table class="factor-table">');
    expect(html).not.toContain("Preserve this note");
    expect(html).toContain('class="drawing-health"');
    expect(html).toContain('data-missing-drawings="1"');
    expect(html).toContain('data-invalid-dim-ids="1"');
    expect(html).toContain("1 of 3 Factors have complete drawing identifiers.");
    expect(html).toContain('class="capability-spectrum"');
    expect(html).toContain('data-target-cpk="1.333"');
    expect(html).toContain('class="spec-range-graph"');
    expect(html).toContain('data-statistical-result="PASS"');
    expect(html).toContain('data-worst-case-result="FAIL"');
    expect(html).toContain('class="mean-offset-graph"');
    expect(html).toContain('data-offset="0.010"');
    expect(html).toContain('class="contribution-chart"');
    expect(html).toContain('class="spec-change-graph"');
    expect(html).not.toContain('<table class="result-table">');
    expect(html).not.toContain('<table class="analysis-table">');
    expect(html).toContain("Graph-first engineering brief");
    expect(html).toContain(".report-content { padding:4mm; }");
    expect(html).toContain(".worksheet-section { width:calc(100% + 8mm); height:174mm; margin:-4mm;");
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