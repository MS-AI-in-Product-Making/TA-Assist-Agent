import { describe, expect, it } from "vitest";

import { renderF6PdfHtml } from "../../../packages/product-export/src/f6-pdf-report.js";

const REPORT = `# Tolerance Analysis Engineering Report

## 1. Document Overview

| Field | Value |
|---|---|
| Source Workbook | Demo.xlsx |
| Workbook Revision | Rev B |

## 2. Workbook Summary

| Result | Worksheet | Tolerance Loop Description | Key Finding |
|---|---|---|---|
| Need Review | Analysis-A | Display stack | Predictive Cpk 1.21 requires review. |

# 3-1 Worksheet: Analysis-A

## Complete Factor Table

| Ordinal | Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| A | Frame Post Location <span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="14" hidden aria-hidden="true"></span> | Frame | Part | MISSING | 1 | 0 mm | 0.2 mm | -0.2 mm | 1 | 4 | N/A | N/A | N/A | Controlled guidance |
| B | Top Enclosure Height | Enclosure | Part | DWG-2 | DIM-2 | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | 0 mm | 0.1 mm | 0.040 mm | Controlled guidance |

## Tolerance Path Image

[Open tolerance path image](<evidence/stack.png>)

## Requirements and Statistical Results

| Requirement | Value |
|---|---:|
| Design Nominal | 0.000 mm |
| LSL | -0.150 mm |
| USL | 0.050 mm |
| Target Cpk | 1.33 |

| Metric | Lower | Upper | Minimum Margin | Result |
|---|---:|---:|---:|---|
| Statistical Range | -0.120 mm | 0.040 mm | 0.010 mm | PASS |
| Worst-Case Range | -0.200 mm | 0.100 mm | -0.050 mm | FAIL |

| Capability Metric | Value | Result |
|---|---:|---|
| Predictive CpkL | 1.21 | WARNING |
| Predictive CpkU | 1.48 | PASS |

## Adjusted Mean to Spec Center Shift

- Status: offset
- Design Nominal: 0.000 mm
- Adjusted Mean: -0.050 mm
- Offset: 0.010 mm

## Contributor Priorities

| Rank | Factor | One Sigma | Variance Contribution | Priority | Guidance |
|---:|---|---:|---:|---|---|
| 1 | Frame Post Location | 0.050 mm | 50.5% | OP1 | Review frame process. |
| 2 | Top Enclosure Height | 0.040 mm | 32.3% | OP2 | Review enclosure control. |

## Specification Changes

| Side | Current Limit | Proposed Limit | Target Cpk | Approval |
|---|---:|---:|---:|---|
| lower | -0.150 | -0.180 | 1.33 | Engineering approval required |
| upper | 0.050 | 0.080 | 1.33 | Engineering approval required |
`;

describe("renderF6PdfHtml", () => {
  it.each([
    ["comment", '<!-- <span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="14" hidden aria-hidden="true"></span> -->'],
    ["unclosed", '<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="14" hidden aria-hidden="true">'],
    ["nonempty", '<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="14" hidden aria-hidden="true">VISIBLE</span>'],
    ["nested", '<div><span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="14" hidden aria-hidden="true"></span></div>'],
    ["extra attribute", '<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="14" hidden aria-hidden="true" title="spoof"></span>'],
  ])("rejects %s marker without hiding following content", (_name, marker) => {
    const legitimate = '<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="14" hidden aria-hidden="true"></span>';
    const html = renderF6PdfHtml({
      markdown: REPORT.replace(legitimate, `${marker} AFTER_MARKER`),
      sourceHash: "a".repeat(64),
      inlineImages: new Map([["evidence/stack.png", "data:image/png;base64,iVBORw0KGgo="]]),
    });
    expect(html).not.toContain('class="missing"');
    expect(html).not.toContain('<span class="f6-inline-marker"');
    expect(html).toContain("AFTER_MARKER</td>");
    expect(html).toContain("Top Enclosure Height");
    if (_name === "nonempty") expect(html).toContain("VISIBLE");
  });

  it("does not recognize a complete marker outside the Factor Description cell", () => {
    const marker = '<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="14" hidden aria-hidden="true"></span>';
    const html = renderF6PdfHtml({
      markdown: REPORT.replace(marker, "").replace("| Frame |", `| Frame ${marker} |`),
      sourceHash: "a".repeat(64),
      inlineImages: new Map([["evidence/stack.png", "data:image/png;base64,iVBORw0KGgo="]]),
    });
    expect(html).not.toContain('class="missing"');
    expect(html).not.toContain('<span class="f6-inline-marker"');
  });

  it("projects the governed report into a self-contained engineering print layout", () => {
    const html = renderF6PdfHtml({
      markdown: REPORT,
      sourceHash: "a".repeat(64),
      inlineImages: new Map([["evidence/stack.png", "data:image/png;base64,iVBORw0KGgo="]]),
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Tolerance Analysis Engineering Report");
    expect(html).toContain("Demo.xlsx");
    expect(html).toContain("Analysis-A");
    expect(html).toContain("data-source-sha256=\"aaaaaaaa");
    expect(html).toContain("@page");
    expect(html).toContain("class=\"document-overview\"");
    expect(html).toContain("class=\"workbook-summary\"");
    expect(html).toContain("font-variant-numeric:tabular-nums");
    expect(html).toContain(".slide-summary>h1 {");
    expect(html).toContain(".document-overview,.workbook-summary { table-layout:fixed;");
    expect(html).toContain(".analysis-panel h2 {");
    expect(html).toContain("border-radius:22px");
    expect(html).not.toContain("box-shadow:");
    expect(html).toContain("class=\"worksheet-section slide slide-worksheet\"");
    expect(html).toContain("class=\"factor-table factor-table--complete\"");
    expect(html).toContain("data-f6-marker=\"required-missing\"");
    expect(html).toContain('<strong class="status-missing">MISSING</strong>');
    expect(html).toContain('<strong class="dim-id-review">1</strong>');
    expect(html).not.toContain('<strong class="dim-id-review">DIM-2</strong>');
    expect(html).toMatch(/<tr class="[^"]*missing[^"]*">\s*<td>A<\/td>\s*<td>Frame Post Location <span class="f6-inline-marker"/u);
    expect(html).not.toContain("class=\"drawing-health\"");
    expect(html).toContain("class=\"analysis-grid\"");
    expect(html).toContain("analysis-panel--image");
    expect(html).toContain("analysis-panel--results");
    expect(html).toContain("analysis-panel--contributors");
    expect(html).toContain("grid-template-columns:minmax(0,3fr) minmax(0,2fr)");
    expect(html).toContain("min-width:0");
    expect(html).toContain("class=\"spec-range-graph\"");
    expect(html).toContain("class=\"capability-spectrum\"");
    expect(html).toContain("class=\"mean-offset-graph\"");
    expect(html).toContain("class=\"contribution-chart\"");
    expect(html).toContain("class=\"spec-change-graph\"");
    expect(html).toContain("Frame Post Location");
    expect(html).toContain("width:50.5%");
    expect(html).toContain("@page { size:20in 11.25in;");
    expect(html).toContain("Stardos Stencil");
    expect(html).toContain("Barlow Condensed");
    expect(html).not.toContain("fitWorksheetPages");
    expect(html).not.toContain("height:174mm");
    expect(html).not.toContain(".worksheet-section { width:calc(100% + 8mm); height:174mm; margin:-4mm; overflow:hidden;");
    expect(html).not.toContain(".factor-table td { overflow-wrap:anywhere");
    expect(html).not.toContain(".worksheet-section { overflow-wrap:anywhere");
    expect(html).toContain(".optimization-table--path td { overflow-wrap:anywhere; word-break:break-word; }");
  });

  it("accepts validated inline images without changing report semantics", () => {
    const html = renderF6PdfHtml({
      markdown: REPORT,
      sourceHash: "c".repeat(64),
      inlineImages: new Map([["evidence/stack.png", "data:image/png;base64,iVBORw0KGgo="]]),
    });

    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(html).not.toContain('src="evidence/stack.png"');
  });

  it("does not preserve executable raw HTML from Markdown", () => {
    const html = renderF6PdfHtml({
      markdown: `${REPORT}\n<script>globalThis.compromised = true</script>\n<img src=x onerror=alert(1)>`,
      sourceHash: "b".repeat(64),
      inlineImages: new Map([["evidence/stack.png", "data:image/png;base64,iVBORw0KGgo="]]),
    });

    expect(html).toContain("data-f6-marker=\"required-missing\"");
    expect(html).not.toContain("globalThis.compromised");
    expect(html).not.toContain("onerror=");
    expect(html).not.toContain("<img src=x");
  });

  it("rejects spoofed required-missing markers with extra attributes", () => {
    const html = renderF6PdfHtml({
      markdown: `# Tolerance Analysis Engineering Report

# 3-1 Worksheet: Analysis-A

## Complete Factor Table

| Ordinal | Factor Description | Part Name | Part Category | Drawing Number | DIM ID | Design Nominal | + Tolerance | - Tolerance | Long Term / Safety Factor | Sigma Level | Mean | Tolerance | One Sigma | Capability / Knowledge Guidance |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| A | Evil <span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="14" hidden aria-hidden="true" data-extra="1"></span> | Frame | Part | DWG-1 | DIM-1 | 0 mm | 0.2 mm | -0.2 mm | 1 | 4 | 0 mm | 0.1 mm | 0.040 mm | Controlled guidance |`,
      sourceHash: "d".repeat(64),
    });

    expect(html).not.toContain('class="missing"');
    expect(html).not.toContain('data-f6-marker="required-missing"');
    expect(html).not.toContain('data-extra="1"');
  });

  it("drops unmatched closing span tags from unapproved raw HTML", () => {
    const html = renderF6PdfHtml({
      markdown: `# Tolerance Analysis Engineering Report

Evil <span onclick="alert(1)">x</span>`,
      sourceHash: "e".repeat(64),
    });

    expect(html).toContain("Evil x");
    expect(html).not.toContain("<span onclick");
    expect(html).not.toContain("</span>");
  });
});