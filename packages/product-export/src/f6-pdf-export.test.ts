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
    expect(html).toContain("max-width:72mm");
    expect(html).toContain("gap:0");
    expect(html).toContain("background:transparent");
    expect(html).toContain("grid-template-columns:84mm minmax(0,1fr)");
    expect(html).toContain("grid-template-rows:auto auto");
    expect(html).toContain(".analysis-panel--results .metric-dashboard { border-top:1px solid var(--line);");
    expect(html).toContain(".analysis-panel--center,.analysis-panel--contributors,.analysis-panel--specifications { min-height:36mm;");
  });

  it("keeps the complete Factor data in one readable table", () => {
    const markdown = [
      "# 3-1 Worksheet: Analysis-A",
      "",
      "## Complete Factor Table",
      "",
      "| Ordinal | Row | Factor Description | Part Name | Drawing Number | DIM ID | Part Category | Design Nominal | + Tolerance | - Tolerance | Long Term/Safety Factor | Sigma Level | Distribution | Mean | Tolerance | One Sigma | % Contribution to Sigma | Notes | Capability and Knowledge Guidance |",
      "|---|---:|---|---|---|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---|---|",
      "| 1 | 14 | Factor A | Part A | MISSING | 1 | CNC | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | normal | 0 mm | 0.1 mm | 0.025 mm | 60.0% | Preserve this note | Capability: f0\\_information\\_insufficient; Knowledge: missing\\_process\\_context |",
      "| 2 | 15 | Factor B | Part B | DWG-2 | 21 | PCBA | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | normal | 0 mm | 0.1 mm | 0.020 mm | 40.0% | Preserve this note | Capability: internal_within_guidance; Recommended tolerance band or range: &lt;= 0.2 mm; Knowledge: internal-v1 |",
      "| 3 | 16 | Factor C | Part C | DWG-3 | 202 | Other | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | normal | 0 mm | 0.1 mm | 0.015 mm | 10.0% | Preserve this note | Capability: non\\_f0\\_process\\_category |",
    ].join("\n");
    const html = renderF6PdfHtml({ markdown, sourceHash: createHash("sha256").update(markdown).digest("hex") });

    expect(html).toContain('<table class="factor-table">');
    expect(html.match(/<table class="factor-table">/g)).toHaveLength(1);
    expect(markdown).toContain("| Ordinal | Row | Factor Description");
    expect(markdown).toContain("| Notes | Capability and Knowledge Guidance |");
    expect(markdown).toContain("Preserve this note");
    expect(html).not.toContain("<th>Row</th>");
    expect(html).not.toContain("<th>Notes</th>");
    expect(html).not.toContain("Preserve this note");
    expect(html).toContain("0.000 mm");
    expect(html).toContain("0.100 mm");
    expect(html).toContain("-0.100 mm");
    expect(html).toContain("Missing process context");
    expect(html).toContain("Knowledge library: Recommended tolerance band or range: &lt;= 0.2 mm");
    expect(html).toContain("No process category");
    expect(html).toContain('<span class="field-alert">MISSING</span>');
    expect(html).toContain('<span class="field-alert">1</span>');
    expect(html).not.toContain('<span class="field-alert">21</span>');
    expect(html).not.toContain('<span class="field-alert">202</span>');
    expect(html).toContain(".field-alert { color:var(--fail); font-weight:700; }");
    expect(html).not.toContain('class="factor-grid"');
    expect(html).not.toContain('class="factor-card"');
    expect(html).toContain("font-size:10pt; line-height:1.25; font-variant-numeric:tabular-nums");
    expect(html).toContain("height:166mm; font-size:13pt;");
    expect(html).toContain("max-height:84mm");
    expect(html).toContain('content.style.transform = "scale(" + scale + ")"');
    expect(html).toContain(".factor-table th,.factor-table td { text-align:center; font-size:7.5pt;");
    expect(html).toContain(".analysis-grid { font-size:8pt;");
    expect(html).toContain(".result-table { display:inline-table; width:auto; max-width:72mm; margin:0 1.5mm 1mm 0; font-size:8pt;");
    expect(html).toContain(".metric-card>span,.metric-card>strong,.metric-card>small { font-size:8pt;");
    expect(html).toContain("min-height:3.5mm; font-size:8pt;");
    expect(html).not.toContain("Math.max(0.76");
    expect(html).toContain("const heightScale = section.clientHeight / content.scrollHeight;");
    expect(html).toContain("const widthScale = section.clientWidth / content.scrollWidth;");
    expect(html).toContain("const scale = Math.min(1, heightScale, widthScale);");
  });
});