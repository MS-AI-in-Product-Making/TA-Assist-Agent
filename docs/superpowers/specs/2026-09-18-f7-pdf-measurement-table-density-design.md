# F7 PDF Measurement Table Density Design

**Date:** 2026-09-18
**Status:** Approved
**Target:** F7 governed PDF report presentation

## Goal

Keep the complete `Setup Inputs` and `Measurement Analysis` tables together on one A4 landscape PDF page without pagination or clipping, using dynamic density when the Factor count increases.

## Scope

Included:

- Remove the `Part Number` and `DIM ID` columns from the PDF `Setup Inputs` table only.
- Remove the `Source Mode` and `Readiness` columns from the PDF `Measurement Analysis` table only.
- Retain `Sample Count` and all setup, actual, delta, contribution, and warning-independent engineering values.
- Apply the user-selected high-density layout to both Factor Setup tables.
- Force the complete Factor Setup block onto one page for the current workflow-supported range of 1 through 100 Factors.
- Dynamically reduce the Factor Setup block scale as row count increases.

Excluded:

- Changes to the Web Factor Setup table.
- Changes to the governed report contract or report projection.
- Changes to source-mode, readiness, or warning calculations.
- Changes to the Dimension Chain, Monte Carlo results, interpretation, or assessment sections.
- Changes to the separate assumption-results PDF.

## Presentation

The PDF `Setup Inputs` table contains these eight columns in order:

1. Item
2. Factor
3. Design Nominal
4. +Tol
5. -Tol
6. Long-term Safety Factor
7. Sigma Level
8. Distribution

The PDF `Measurement Analysis` table contains these eight columns in order:

1. Item
2. Factor
3. Mean
4. Tolerance
5. 1 sigma
6. Cpk
7. % Contribution to sigma
8. Sample Count

`Part Number`, `DIM ID`, `Source Mode`, and `Readiness` remain governed report data but are not rendered in these PDF tables. Measurement warning labels are also absent because their only PDF placement was inside the removed Source Mode column. No report data or validation rule is removed.

Both tables use the approved high-density option B:

- `6.4pt` table text.
- `2px 3px` cell padding.
- `1.12` line height.
- Compact metric-label text sized below the table body without dropping labels.
- Existing colors, borders, number formatting, escaping, and A4 landscape page size.

Seven Factors use the approved option B dimensions without additional scaling. Higher Factor counts use deterministic renderer-owned density values that reduce actual font sizes, padding, margins, gaps, and border widths before Chromium print layout. The most compact values support the contract maximum of 100 Factors while keeping text at or above the browser's reliable `0.5pt` print floor. Extreme Factor counts remain complete but may require electronic magnification to read; completeness and one-page output take precedence over print-size readability because the user explicitly requires no pagination.

## Pagination

The renderer treats the `Factor Setup` heading and both complete tables as one forced single-page print fragment. It derives bounded layout dimensions from `report.factors.length` and places them on the wrapper before Chromium performs print layout. The wrapper and both tables use `break-inside: avoid` and `page-break-inside: avoid`; no fallback row pagination is permitted inside this block. Governed sessions and reports are limited to 100 Factors, and governed Factor names are limited to 300 characters. Inside the two Factor Setup tables, each complete name remains on one line and is horizontally scaled using a conservative wide-glyph allowance without truncation; the Dimension Chain retains its independent complete multiline name rendering.

The Dimension Chain begins on the next page so its layout cannot force either Factor Setup table to split. The renderer must not use fixed-height clipping or overflow suppression to satisfy the page-count requirement.

## Architecture

The presentation change stays in `apps/f7-local-api/src/f7-report-pdf-renderer.ts`. The renderer omits the four presentation columns across the two tables, derives density values from Factor count, and adds compact Factor Setup CSS plus one wrapper that owns forced single-page behavior. `f7ReportFactorSchema` aligns its Factor-name maximum with the existing governed input schemas; all source calculations remain unchanged.

Renderer tests in `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts` define both eight-column contracts, verify that removed traceability and status text is absent from the tables, and assert the compact print CSS. A browser-rendered PDF check verifies that both tables and all seven representative Factor rows occupy one page and that no content is clipped.

## Error Handling And Governance

- PDF generation remains server-authoritative.
- Candidate, user-added confirmation, evidence, final report, and Web editing boundaries consistently enforce the governed 300-character Factor-name maximum. Session, report, and Web insertion boundaries consistently enforce the governed 100-Factor maximum.
- The report contract continues to validate source mode, readiness, warning state, and sample count even when selected fields are not displayed.
- Existing HTML escaping, finite-number formatting, local browser rendering, temporary-file cleanup, queue limits, and `%PDF-` signature validation remain unchanged.
- Reports in the current workflow-supported range of 1 through 100 Factors always retain every Factor row. Extreme row counts trade physical print readability for single-page completeness; they never paginate or clip.

## Verification

1. Update the focused renderer test first and observe failure against the existing Setup Inputs output and page wrapper.
2. Verify both rendered table heading sets are exactly the approved eight columns.
3. Verify `Part Number` and `DIM ID` are absent from Setup Inputs; verify `Source Mode`, `Readiness`, their status labels, and source-mode warning labels are absent from Measurement Analysis while `Sample Count` remains.
4. Verify compact CSS values, density-tier selection, forced page-break selectors, and the Dimension Chain page boundary are present.
5. Run the complete F7 PDF renderer test file.
6. Generate and inspect representative 7-Factor and 100-Factor PDFs, confirming both Factor Setup tables and all rows share one page in each report and no row is clipped.
7. Run TypeScript diagnostics for the touched renderer and test.

## Acceptance Criteria

- The PDF Setup Inputs table no longer displays `Part Number` or `DIM ID`.
- The PDF Measurement Analysis table no longer displays `Source Mode` or `Readiness`.
- The PDF Measurement Analysis table still displays `Sample Count` and all six engineering identification/metric columns.
- The selected high-density styling is applied to both Factor Setup tables.
- The Setup Inputs and Measurement Analysis tables remain together on exactly one PDF page for 7 through 100 Factors.
- No Factor Setup row is clipped, omitted, or continued on another page.
- The Dimension Chain starts on the following page.
- Web UI behavior, governed report data, and downstream PDF sections remain unchanged.
- Focused renderer tests and PDF layout verification pass.
