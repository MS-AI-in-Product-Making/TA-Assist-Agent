# F7 PDF Measurement Table Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the representative seven-row PDF Measurement Analysis table on one A4 landscape page while removing Source Mode and Readiness and applying the approved high-density layout.

**Architecture:** Keep the governed `F7ReportProjection` unchanged and make a presentation-only change in the F7 PDF renderer. Wrap the Measurement Analysis heading and table in one best-fit print fragment, remove two rendered columns, and apply table-specific compact CSS while preserving row-safe fallback pagination for oversized tables.

**Tech Stack:** TypeScript, Vitest, HTML/CSS print layout, local Edge/Chrome PDF rendering, `pdfjs-dist` for page-text verification.

---

## File Structure

- Modify `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts`: define the eight-column and compact print-layout behavior before implementation.
- Modify `apps/f7-local-api/src/f7-report-pdf-renderer.ts`: remove the two presentation columns, add the best-fit wrapper, and apply Measurement Analysis-specific density styles.
- Do not modify report contracts, report projection, Web UI, or calculation code.

### Task 1: Define The Compact Eight-Column Contract

**Files:**
- Modify: `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts`
- Test: `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts`

- [ ] **Step 1: Update the renderer test with failing column assertions**

In `renders the governed report in Web order with chart, comparison, and F0 evidence`, change `analysisHeadings` to the approved eight columns:

```ts
expect(analysisHeadings).toEqual([
  "Item",
  "Factor",
  "Mean",
  "Tolerance",
  "1σ",
  "Cpk",
  "% Contribution to σ",
  "Sample Count",
]);
expect(measurementAnalysisTable).not.toContain("<th>Source Mode</th>");
expect(measurementAnalysisTable).not.toContain("<th>Readiness</th>");
expect(measurementAnalysisTable).not.toContain("Measured Data");
expect(measurementAnalysisTable).not.toContain("Baseline Assumption");
expect(measurementAnalysisTable).not.toContain("status-ready");
expect(measurementAnalysisTable).not.toContain("status-warning");
expect(measurementAnalysisTable).toContain(">32<");
expect(measurementAnalysisTable).toContain(">0<");
```

Retain the existing metric, contribution, escaping, order, and Sample Count assertions. Remove only assertions that require source mode, warning, or readiness text inside this table.

- [ ] **Step 2: Add failing print-layout assertions**

In the same test, assert the explicit wrapper and approved option B density contract:

```ts
expect(html).toContain('<div class="measurement-analysis-wrapper">');
expect(html).toContain(
  ".measurement-analysis-wrapper { break-inside: avoid; page-break-inside: avoid; }",
);
expect(html).toContain(
  "[data-factor-measurement-analysis] { table-layout: fixed; font-size: 6.4pt; line-height: 1.12; }",
);
expect(html).toContain(
  "[data-factor-measurement-analysis] th, [data-factor-measurement-analysis] td { padding: 2px 3px; }",
);
expect(html).toContain(
  "[data-factor-measurement-analysis] .metric-label { font-size: 5.8pt; }",
);
```

- [ ] **Step 3: Run the focused test and verify RED**

```powershell
npm exec vitest -- run --project node apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
```

Expected: FAIL because the renderer still emits ten columns, status text, `8.2pt` table text, and no Measurement Analysis wrapper.

- [ ] **Step 4: Commit the failing contract test**

```powershell
git add apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
git commit -m "test(f7): require compact PDF measurement table"
```

### Task 2: Implement The Presentation-Only Renderer Change

**Files:**
- Modify: `apps/f7-local-api/src/f7-report-pdf-renderer.ts`
- Test: `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts`

- [ ] **Step 1: Remove obsolete source-mode formatting**

Delete `sourceModeLabel`, because no remaining PDF renderer path uses it after Source Mode is hidden.

- [ ] **Step 2: Render only the approved eight columns**

In `renderFactorMeasurementAnalysis`, remove the `sourceMode` and `readiness` local values and return rows with Sample Count as the final cell:

```ts
return `<tr><td>${index + 1}</td><td>${escapeHtml(factor.factorName)}</td><td>${metric(factor.setupMean, comparison?.mean)}</td><td>${metric(factor.setupTolerance, comparison?.tolerance, { tolerance: true })}</td><td>${metric(factor.setupOneSigma, comparison?.oneSigma)}</td><td>${metric(factor.setupCpk, comparison?.cpk)}</td><td>${formatNumber(factor.percentContributionToSigma * 100)}%</td><td>${formatNumber(factor.sampleCount, 0)}</td></tr>`;
```

Wrap the heading and table together and emit exactly eight headers:

```ts
return `<div class="measurement-analysis-wrapper"><h4>Measurement Analysis</h4><table data-factor-measurement-analysis><thead><tr><th>Item</th><th>Factor</th><th>Mean</th><th>Tolerance</th><th>1σ</th><th>Cpk</th><th>% Contribution to σ</th><th>Sample Count</th></tr></thead><tbody>${rows}</tbody></table></div>`;
```

Do not remove `sourceMode`, `readiness`, or `measurementWarning` from the governed report type or projection.

- [ ] **Step 3: Apply the approved high-density print CSS**

Keep Setup Inputs at its current size. Split the combined table selector and add Measurement Analysis-specific rules:

```css
[data-factor-setup-inputs] { table-layout: fixed; font-size: 8.2pt; }
.measurement-analysis-wrapper { break-inside: avoid; page-break-inside: avoid; }
[data-factor-measurement-analysis] { table-layout: fixed; font-size: 6.4pt; line-height: 1.12; }
[data-factor-measurement-analysis] th, [data-factor-measurement-analysis] td { padding: 2px 3px; }
[data-factor-measurement-analysis] .metric-label { font-size: 5.8pt; }
```

Retain `thead { display: table-header-group; }` and the existing per-row `break-inside: avoid; page-break-inside: avoid`. Change the right-aligned Sample Count selector from column 9 to column 8:

```css
[data-factor-measurement-analysis] th:nth-child(8),
[data-factor-measurement-analysis] td:nth-child(8) { text-align: right; }
```

Because `break-inside: avoid` is a best-fit constraint, Chromium moves a fitting seven-row wrapper to the next page but may break an oversized wrapper across pages rather than clipping it.

- [ ] **Step 4: Run the focused test and verify GREEN**

```powershell
npm exec vitest -- run --project node apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
```

Expected: PASS with the eight-column table and compact CSS contract.

- [ ] **Step 5: Run TypeScript and lint validation**

```powershell
npm run build -- --force
npx eslint apps/f7-local-api/src/f7-report-pdf-renderer.ts apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
```

Expected: both commands exit successfully with no diagnostics.

- [ ] **Step 6: Commit the renderer implementation**

```powershell
git add apps/f7-local-api/src/f7-report-pdf-renderer.ts
git commit -m "fix(f7): keep PDF measurement table together"
```

### Task 3: Verify The Browser-Rendered PDF Layout

**Files:**
- Inspect: `apps/f7-local-api/src/f7-report-pdf-renderer.ts`
- Inspect: generated temporary PDF only; do not commit generated reports

- [ ] **Step 1: Build a representative seven-Factor report in a temporary verification harness**

Reuse `reportFixture()` data with seven unique factors, following the existing dimension-chain test pattern:

```ts
const report = reportFixture();
const baseFactor = report.factors[0]!;
const factors = Array.from({ length: 7 }, (_, index) => ({
  ...baseFactor,
  factorId: index.toString(16).padStart(2, "0").repeat(32),
  factorName: `Density factor ${index + 1}`,
  designNominal: index + 1,
}));
```

Render with the installed controlled Edge/Chrome through `createF7ReportPdfRenderer()`; keep the harness and PDF outside tracked source or remove them after inspection.

- [ ] **Step 2: Parse page text with `pdfjs-dist`**

For every page, join text items and identify the page containing `Measurement Analysis`. Assert that this same page contains every unique name from `Density factor 1` through `Density factor 7`:

```ts
const measurementPage = pageTexts.find((pageText) =>
  pageText.includes("Measurement Analysis")
  && factors.every((factor) => pageText.includes(factor.factorName)),
);
expect(measurementPage).toBeDefined();
```

Also inspect the rendered page image or PDF view for clipped text, overlapping cells, and unreadable labels.

- [ ] **Step 3: Re-run focused regression tests after layout verification**

```powershell
npm exec vitest -- run --project node apps/f7-local-api/src/f7-report-pdf-renderer.test.ts apps/f7-local-api/src/server.test.ts
```

Expected: PASS.

- [ ] **Step 4: Confirm the final diff is scoped**

```powershell
git status --short
git diff --check HEAD~2..HEAD
```

Expected: only the approved plan, renderer test, and renderer implementation are present; no generated PDF, visual-companion files, report contract, projection, or Web UI changes are tracked.
