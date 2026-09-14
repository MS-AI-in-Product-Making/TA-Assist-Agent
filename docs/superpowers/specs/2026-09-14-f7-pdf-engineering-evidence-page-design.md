# F7 PDF Engineering Evidence Page Design

**Date:** 2026-09-14
**Status:** Approved
**Target branch:** `User/Ralf/F7_Generate_a_PDF_Report`
**Selected layout:** B - Factor Setup above, Dimension Chain and response performance below

## Goal

Add the displayed Factor Setup, Dimension Chain, Normal Distribution Curve, and Response Summary evidence to the assumption-results PDF. Keep the evidence readable by making it a dedicated first A4 landscape page and shifting the existing two-page Decision Brief to pages 2 and 3.

## Decision

The report becomes a stable three-page document for the representative F7 analysis:

1. Engineering Evidence
2. Decision and Diagnosis
3. Action and Priority

Page 1 uses the selected B layout. A compact Factor Setup table spans the upper region. The lower region contains a static Dimension Chain report view on the left and a Normal Distribution Curve with compact Response Summary on the right. Editing toolbars, buttons, sliders, checkboxes, and empty interaction instructions are not report content and are omitted.

The PDF remains server-generated through the controlled Playwright renderer. It does not capture the Web page, serialize DOM HTML, upload arbitrary SVG, or use `window.print()`.

## Engineering Evidence Projection

The Web application sends a bounded structured `engineeringEvidence` projection with the existing PDF request.

### Factor Setup

Each factor row contains only report fields already shown by the confirmed setup:

- item number and factor name
- design nominal
- upper and lower tolerance
- long-term safety factor and sigma level
- distribution and mean
- combined tolerance and one-sigma value
- contribution percentage

The projection also contains the displayed setup footer values: design nominal total, upper and lower worst-case tolerance, mean response, RSS tolerance, RSS sigma, contribution total, additional mean shift, and adjusted mean.

The report uses confirmed Factor Setup evidence. Unconfirmed edits cannot silently replace the governed values. PDF generation remains available only from the existing non-editing interpretation state.

### Dimension Chain

The projection is a serializable report model rather than SVG markup or a bitmap screenshot. It includes generated status, source signature, orientation, confirmed factors, manual layout, reversed factor arrows, and closure-arrow direction. Pan, zoom, selection, opacity controls, and other viewport-only state are excluded.

When a generated chain is current, the report preserves its orientation and manual layout. When it is absent or stale, the report renderer builds a standard horizontal chain from the confirmed factors and labels it as automatically generated for the report. This condition does not block PDF export.

The optional background can only come from the image already held by the validated local F7 session. Client `blob:` URLs, data URLs, arbitrary file paths, remote URLs, and uploaded SVG/HTML are rejected. If no controlled session image exists, the chain renders on a neutral background without losing its dimensions and labels.

### Response Performance

The Normal Distribution Curve is reconstructed from finite numeric inputs: mean, standard deviation, lower specification limit, upper specification limit, and target. The report always displays the governed `+/-3 sigma` references and omits Web-only range toggles.

The compact Response Summary contains the same calculation groups visible in the current Factor Setup view: RSS and worst case, response and specifications, sigma level and capability, and defects per million. Values are structured text or finite numbers with bounded collection sizes.

## Data Flow

`DimensionChainPanel` emits its serializable report projection after generation and after report-relevant layout changes. `FactorInputTable` combines that projection with confirmed factor rows, calculation results, curve inputs, and response summary, then emits one engineering-evidence projection.

`App.vue` stores the latest projection for the current session and passes it to `TAResultsInterpretation`. The component includes it in `AssumptionResultsPdfRequest`. The local API validates the expanded Zod contract and verifies the session as it does today. The renderer escapes all text and draws report-native HTML tables and SVG graphics.

The API renderer may read only the validated session's existing dimension-chain image bytes and copy them into the render temporary directory. The PDF HTML references that controlled local copy. No network fetch is introduced.

## Pagination and Readability

All pages remain A4 landscape with explicit page groups and page breaks.

Page 1 reserves approximately 45 percent of printable height for the Factor Setup table and 55 percent for the two lower evidence panels. The representative seven-factor setup must fit without clipping. Text must remain readable at normal PDF viewing scale; the renderer may compact spacing but must not shrink body text below the report's established minimum.

The existing Decision and Diagnosis and Action and Priority content remains complete and unchanged except for page numbering and explicit page breaks. Longer bounded content may add pages rather than truncate engineering evidence.

## Error and State Handling

- Missing or stale generated chain state falls back to a labeled standard chain.
- A missing controlled background image falls back to a neutral background.
- Invalid, oversized, non-finite, or unsupported evidence fails request validation and produces no PDF.
- Session changes clear cached engineering evidence so one workbook cannot leak into another report.
- Browser timeout, queue release, PDF signature validation, temporary cleanup, stale-download suppression, and accessible completion feedback remain enforced.
- No workbook write-back or remote upload is introduced.

## Testing

Implementation follows test-driven development:

1. Add contract tests for valid evidence and bounded rows, text, numbers, layout values, and forbidden image/markup fields.
2. Add Dimension Chain projection tests for generated, changed, stale, and reset states.
3. Add Factor Input projection tests proving the emitted table, curve, and summary match displayed confirmed values.
4. Add App and interpretation tests for current-session evidence wiring, session reset, and exact PDF request mapping.
5. Add renderer tests for three explicit page groups, page order, evidence table, both static SVG views, escaping, and controlled fallback labels.
6. Add server tests proving the request is session-bound and any background bytes come only from that session.
7. Run focused F7 Web and API regressions, type checks, and the production Web build.
8. Generate a representative real PDF, verify `%PDF-`, `%%EOF`, exactly three page objects, searchable key text, and visually inspect every page for clipping and overlap.
9. Measure generation time after the larger report is added and report cold and warm results without weakening the existing timeout.

## Acceptance Criteria

- One click downloads a searchable PDF without a print dialog.
- Page 1 uses layout B and contains the complete representative Factor Setup, Dimension Chain, Normal Distribution Curve, and Response Summary evidence.
- Pages 2 and 3 retain all existing Decision Brief content.
- The representative report contains exactly three A4 landscape pages with no clipping, overlap, blank page, or unreadably small text.
- Report values match the confirmed Factor Setup and assumption calculation shown for the same session.
- A stale or absent Dimension Chain uses the documented automatic fallback; it never uses another session's state or an uncontrolled image.
- Structured contract limits, text escaping, controlled browser execution, render timeout, queue limits, PDF validation, and cleanup continue to pass.
- No screenshot-based report, arbitrary HTML/SVG ingestion, remote upload, workbook mutation, F6 change, or unrelated shared-package change is introduced.