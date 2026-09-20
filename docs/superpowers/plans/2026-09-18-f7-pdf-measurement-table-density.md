# F7 PDF Measurement Table Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep both complete PDF Factor Setup tables on one A4 landscape page while removing four presentation-only columns and applying dynamic high-density layout.

**Architecture:** Wrap both Factor Setup tables in one forced single-page fragment, remove two rendered columns from each table, and derive actual print dimensions from Factor count so workflow-valid reports remain complete without clipping. Align the final report Factor-name limit with the existing 300-character governed input limit and horizontally fit complete names inside the two Factor Setup tables.

**Tech Stack:** TypeScript, Vitest, HTML/CSS print layout, local Edge/Chrome PDF rendering, `pdfjs-dist` for page-text verification.

---

## File Structure

- Modify `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts`: define the eight-column and compact print-layout behavior before implementation.
- Modify `apps/f7-local-api/src/f7-report-pdf-renderer.ts`: remove the two Measurement Analysis presentation columns and apply its compact density styles.
- Extend the same two files for the approved forced-single-page increment: remove Setup Inputs traceability columns, wrap both tables, and add deterministic density scaling.
- Modify `packages/contracts/src/f7-contracts.ts` and its test to enforce the governed 300-character Factor-name maximum throughout the Factor lifecycle and the existing 100-Factor resource maximum on sessions and final reports.
- Modify `apps/f7-web/src/components/FactorInputTable.vue` and its tests so user-added Factor names expose the same 300-character input boundary and every insertion path stops at 100 Factors.
- Do not modify calculation code.

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

### Task 4: Force Both Factor Setup Tables Onto One Page

This task supersedes Task 2's Measurement-only best-fit wrapper and fallback-pagination behavior. The earlier task remains in the plan as implementation history; the final renderer behavior is the forced single-page contract below.

**Files:**
- Modify: `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts`
- Modify: `apps/f7-local-api/src/f7-report-pdf-renderer.ts`
- Inspect: generated temporary PDFs only; do not commit generated reports

- [ ] **Step 1: Write failing assertions for the Setup Inputs columns and shared wrapper**

Change the Setup Inputs heading expectation to:

```ts
expect(setupHeadings).toEqual([
  "Item",
  "Factor",
  "Design Nominal",
  "+Tol",
  "-Tol",
  "Long-term Safety Factor",
  "Sigma Level",
  "Distribution",
]);
expect(setupInputsTable).not.toContain("<th>Part Number</th>");
expect(setupInputsTable).not.toContain("<th>DIM ID</th>");
```

Replace the Measurement-only wrapper assertion with a Factor Setup wrapper assertion that proves the wrapper contains the `Factor Setup` heading, `Setup Inputs` heading/table, and `Measurement Analysis` heading/table in that order. Assert that the wrapper has inline density dimensions and that `Dimension Chain` follows a forced page boundary outside the wrapper.

- [ ] **Step 2: Write failing density-function tests**

Export a presentation-only helper `factorSetupDensityStyle(factorCount: number)` and assert the exact table font, label font, cell padding, heading size, margins, metric gaps, and border width for 1, 7, and 100 Factors. The helper must reject values outside the governed 1-100 range and must keep printed text at or above `0.5pt`.

- [ ] **Step 3: Run the focused test and verify RED**

```powershell
npm exec vitest -- run --project node apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
```

Expected: FAIL because Setup Inputs still renders ten columns, both tables do not share one wrapper, and the density helper does not exist.

- [ ] **Step 4: Implement the eight-column Setup Inputs table**

Change `renderFactorSetupInputs` to omit `partNumber` and `dimId` cells and headers. Retain Item, Factor, Design Nominal, +Tol, -Tol, Long-term Safety Factor, Sigma Level, and Distribution with existing escaping and number formatting.

- [ ] **Step 5: Implement deterministic density and the forced single-page wrapper**

Use bounded deterministic decimal formatting without locale dependence. Scale real CSS dimensions instead of using Chromium `zoom`. Refactor rendering so `renderFactorMeasurementAnalysis` returns its heading/table without a wrapper, and `renderEngineeringInputs` emits:

```html
<div class="factor-setup-wrapper" style="...">
  <h3>Factor Setup</h3>
  ...Setup Inputs...
  ...Measurement Analysis...
</div>
<div class="dimension-chain-wrapper">
  <h3>Dimension Chain</h3>
  ...Dimension Chain...
</div>
```

- [ ] **Step 6: Apply forced print CSS without clipping**

Use:

```css
.factor-setup-wrapper {
  break-inside: avoid;
  page-break-inside: avoid;
}
.dimension-chain-wrapper { break-before: page; page-break-before: always; }
[data-factor-setup-inputs], [data-factor-measurement-analysis] {
  table-layout: fixed;
  font-size: var(--factor-setup-table-font-size);
  line-height: 1.12;
}
[data-factor-setup-inputs] th, [data-factor-setup-inputs] td,
[data-factor-measurement-analysis] th, [data-factor-measurement-analysis] td {
  padding: var(--factor-setup-cell-y) var(--factor-setup-cell-x);
}
```

Keep complete Factor names on one line and horizontally scale them to the Factor column using a conservative capacity for wide glyphs, including CJK text. Do not add fixed heights, `overflow: hidden`, text truncation, row omission, or fallback pagination inside the Factor Setup wrapper.

- [ ] **Step 7: Run focused checks and commit GREEN**

```powershell
npm exec vitest -- run --project node apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
npx eslint apps/f7-local-api/src/f7-report-pdf-renderer.ts apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
```

Expected: PASS. Commit only the renderer and renderer test:

```powershell
git add apps/f7-local-api/src/f7-report-pdf-renderer.ts apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
git commit -m "fix(f7): force PDF factor setup onto one page"
```

- [ ] **Step 8: Verify real 7-Factor and 100-Factor PDFs**

Use temporary tests under `local-test/F7_Test_Finetune_05/` or a temporary test block removed before commit. Render with the installed controlled browser and parse each PDF with `pdfjs-dist`. For both counts, assert exactly one page contains `Setup Inputs`, `Measurement Analysis`, every unique Setup Inputs row marker, and every unique Measurement Analysis row marker. Assert `Dimension Chain` starts on a later page. Verify all nonblank PDF text items remain within the page viewport and visually inspect both PDFs for omitted rows or clipping.

- [ ] **Step 9: Run regression and build checks**

```powershell
npm exec vitest -- run --project node apps/f7-local-api/src/f7-report-pdf-renderer.test.ts apps/f7-local-api/src/server.test.ts
npm run build -- --force
```

Expected: focused tests and build pass. Restore only build-generated tracked `dist` changes after recording `BUILD_OK`; the worktree must be clean except for ignored local verification PDFs.
