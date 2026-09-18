# F7 PDF Measurement Table Density Design

**Date:** 2026-09-18
**Status:** Approved
**Target:** F7 governed PDF report presentation

## Goal

Keep the representative seven-row `Measurement Analysis` table together on one A4 landscape PDF page while improving horizontal space and preserving readable engineering evidence.

## Scope

Included:

- Remove the `Source Mode` and `Readiness` columns from the PDF `Measurement Analysis` table only.
- Retain `Sample Count` and all setup, actual, delta, contribution, and warning-independent engineering values.
- Apply the user-selected high-density layout to this table.
- Prefer keeping the complete table together when it fits on a page.
- Preserve repeated headers and row-safe pagination when a larger table cannot fit on one page.

Excluded:

- Changes to the Web Factor Setup table.
- Changes to the governed report contract or report projection.
- Changes to source-mode, readiness, or warning calculations.
- Changes to the Setup Inputs table, Dimension Chain, Monte Carlo results, interpretation, or assessment sections.
- Changes to the separate assumption-results PDF.

## Presentation

The PDF `Measurement Analysis` table contains these eight columns in order:

1. Item
2. Factor
3. Mean
4. Tolerance
5. 1 sigma
6. Cpk
7. % Contribution to sigma
8. Sample Count

`Source Mode` and `Readiness` remain governed report data but are not rendered in this PDF table. Measurement warning labels are also absent because their only PDF placement was inside the removed Source Mode column. No report data or validation rule is removed.

The table uses the approved high-density option B:

- `6.4pt` table text.
- `2px 3px` cell padding.
- `1.12` line height for measurement cells.
- Compact metric-label text sized below the table body without dropping labels.
- Existing colors, borders, number formatting, escaping, and A4 landscape page size.

## Pagination

The renderer prefers the heading and complete `Measurement Analysis` table as one print fragment. A representative seven-row table must remain on one PDF page rather than continuing on the next page.

Tables larger than a physical page must still flow across pages. In that case:

- table headers repeat through existing print-table semantics;
- individual Factor rows remain intact;
- content is never clipped or allowed to overflow the printable page.

This is a best-fit print constraint, not an unconditional no-break rule for arbitrarily large Factor counts.

## Architecture

The change stays in `apps/f7-local-api/src/f7-report-pdf-renderer.ts`. The renderer omits the two presentation columns and adds Measurement Analysis-specific compact CSS and a wrapper that owns the best-fit page-break behavior. The server-authoritative `F7ReportProjection` and all source calculations remain unchanged.

Renderer tests in `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts` define the eight-column contract, verify that removed status text is absent from the table, and assert the compact print CSS. A browser-rendered PDF check verifies that all seven representative Factor rows occupy one page and that no content is clipped.

## Error Handling And Governance

- PDF generation remains server-authoritative.
- The report contract continues to validate source mode, readiness, warning state, and sample count even when selected fields are not displayed.
- Existing HTML escaping, finite-number formatting, local browser rendering, temporary-file cleanup, queue limits, and `%PDF-` signature validation remain unchanged.
- If a table is too large for one page, readable pagination takes precedence over the no-split preference.

## Verification

1. Update the focused renderer test first and observe failure against the existing ten-column output.
2. Verify the rendered Measurement Analysis headings are exactly the approved eight columns.
3. Verify `Source Mode`, `Readiness`, their status labels, and source-mode warning labels are absent from this table while `Sample Count` remains.
4. Verify compact CSS values and best-fit pagination selectors are present.
5. Run the complete F7 PDF renderer test file.
6. Generate and inspect a representative seven-Factor PDF, confirming all Measurement Analysis rows share one page and text does not clip or overlap.
7. Run TypeScript diagnostics for the touched renderer and test.

## Acceptance Criteria

- The PDF Measurement Analysis table no longer displays `Source Mode` or `Readiness`.
- The PDF Measurement Analysis table still displays `Sample Count` and all six engineering identification/metric columns.
- The selected high-density styling is applied only where needed.
- The representative seven-row Measurement Analysis table is not divided across two PDF pages.
- Larger tables paginate without clipping, with repeated headers and intact rows.
- Web UI behavior, governed report data, and downstream PDF sections remain unchanged.
- Focused renderer tests and PDF layout verification pass.
