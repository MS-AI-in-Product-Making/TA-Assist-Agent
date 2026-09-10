import { describe, expect, it } from "vitest";

import { renderF6PdfHtml } from "@ai-assist/product-export";

const REPORT = `# Tolerance Analysis Engineering Report

## 1. Document Overview

| Field | Value |
|---|---|
| Source Workbook | Demo.xlsx |
| Workbook Revision | Rev B |

## 2. Workbook Summary

| Worksheet | Tolerance Loop Description | Key Finding |
|---|---|---|
| Analysis-A | Display stack | Predictive Cpk 1.21 requires review. |

# 3-1 Worksheet: Analysis-A

## 3-1-1 Tolerance Path Image

[Open tolerance path image](<evidence/stack.png>)

## 3-1-2 Complete Factor Table

| Ordinal | Row | Factor Description | Part Name | Drawing Number | DIM ID | Part Category | Design Nominal | + Tolerance | - Tolerance | Long Term/Safety Factor | Sigma Level | Distribution | Mean | Tolerance | One Sigma | % Contribution to Sigma | Notes | Capability and Knowledge Guidance |
|---|---:|---|---|---|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---|---|
| A | 14 | Frame Post Location | Frame | DWG-1 | DIM-1 | Part | 0 mm | 0.2 mm | -0.2 mm | 1 | 4 | normal | 0 mm | 0.2 mm | 0.050 mm | 50.5% | Review | Controlled guidance |
| B | 15 | Top Enclosure Height | Enclosure | DWG-2 | DIM-2 | Part | 0 mm | 0.1 mm | -0.1 mm | 1 | 4 | normal | 0 mm | 0.1 mm | 0.040 mm | 32.3% | Review | Controlled guidance |

## 3-1-3 Requirements and Statistical Results

| Capability Metric | Value | Result |
|---|---:|---|
| Predictive CpkL | 1.21 | WARNING |
| Predictive CpkU | 1.48 | PASS |

## 3-1-5 Contributor Priorities

| Rank | Factor | One Sigma | Variance Contribution | Priority | Guidance |
|---:|---|---:|---:|---|---|
| 1 | Frame Post Location | 0.050 mm | 50.5% | OP1 | Review frame process. |
| 2 | Top Enclosure Height | 0.040 mm | 32.3% | OP2 | Review enclosure control. |
`;

describe("renderF6PdfHtml", () => {
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
    expect(html).toContain("class=\"worksheet-section\"");
    expect(html).toContain("class=\"factor-grid\"");
    expect(html).toContain("class=\"factor-card\"");
    expect(html).toContain("class=\"metric-dashboard\"");
    expect(html).toContain("metric-card--warning");
    expect(html).toContain("metric-card--pass");
    expect(html).toContain("class=\"pareto-chart\"");
    expect(html).toContain("Frame Post Location");
    expect(html).toContain("width:50.5%");
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

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror=");
    expect(html).not.toContain("<img src=x");
  });
});