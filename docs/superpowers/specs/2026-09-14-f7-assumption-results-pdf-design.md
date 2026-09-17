# F7 Assumption Results PDF Export Design

**Date:** 2026-09-14
**Status:** Approved
**Target branch:** `User/Ralf/F7_Generate_a_PDF_Report`

## Goal

Add a `Generate PDF` action to the upper-right of the **TA Results Interpretation (based on Assumptions)** panel. One click downloads a searchable, print-optimized PDF containing the complete panel content.

## Scope

The PDF includes the panel title and all available interpretation content:

- TA Result Summary and overall assessment
- Root Cause Analysis
- Suggested Action Sequence
- contributor Pareto chart and priority table
- TA Process and Requirements

The application header, Workflow rail, unrelated controls, and the export button are excluded. The source workbook remains read-only. The change is limited to `apps/f7-web` and `apps/f7-local-api`; F6 publication and shared packages are unchanged.

## User Experience

The panel title becomes a compact left/right header. The right side contains a `FileDown` icon and `Generate PDF` label, following existing F7 action-button styling. While generating, the control is disabled and displays progress. On success, the browser downloads a safely named PDF. On failure, an accessible inline error appears without removing the displayed results.

## Architecture and Data Flow

The browser owns the interpretation projection already displayed by the Vue component. It maps that projection into a structured JSON export request containing display strings, rows, narrative sections, contributor values, and process guidance. Arbitrary HTML is never accepted.

```text
TAResultsInterpretation
  -> build structured export request from current computed interpretation
  -> POST /f7/assumption-results/pdf
  -> validate request and escape every string
  -> render self-contained print HTML
  -> controlled local Edge/Chrome print-to-PDF
  -> verify %PDF- signature and non-empty bytes
  -> return application/pdf
  -> browser downloads <workbook>-<worksheet>-assumption-results.pdf
```

The renderer uses A4 landscape, stable margins, repeating table headers, and page-break avoidance for headings, narrative items, chart/table rows, and process-guidance entries. The contributor chart is rendered as report-native HTML/CSS/SVG from numeric request data so it remains sharp.

## API Contract

`POST /f7/assumption-results/pdf` accepts a bounded structured request with `sessionId`, workbook/worksheet labels, result-summary rows, assessment text, root-cause items, action items, contributor rows, and process-guidance entries. The server verifies that the session exists and validates lengths, finite numbers, enums, and required sections before rendering.

The successful response is `200 application/pdf` with `Content-Disposition: attachment`. Invalid input/session returns JSON `400`/`404`; renderer failure returns JSON `500`. No temporary path or workbook data is exposed.

## Security and Failure Behavior

- All report text is HTML-escaped; no client HTML, script, URL, or local path is accepted.
- Rendering uses only an installed controlled Edge or Chrome executable with networking disabled for the self-contained document.
- Temporary HTML/PDF files are created beneath a controlled local temporary directory and removed in `finally`.
- The API fails closed unless output has a valid `%PDF-` signature and non-zero content.
- Client cancellation or errors do not mutate the session or source workbook.

## Testing

Use TDD in narrow slices:

1. Vue component test for action placement, structured request, loading state, successful Blob download, safe filename, and inline error.
2. F7 client test for binary response handling and JSON error propagation.
3. API route tests for validation, content type/disposition, session enforcement, renderer failure, and PDF signature.
4. Renderer tests for escaped content, every required heading, contributor data, print rules, and cleanup.
5. F7 Web build plus focused Web/API tests.
6. Browser verification on desktop and mobile, followed by a real PDF download whose signature, size, page rendering, content coverage, and lack of overlap are checked locally.

## Acceptance Criteria

- The button is visible only with the assumption-results panel and sits at its upper-right.
- One click downloads a valid searchable PDF without opening a print dialog.
- Every visible report section is represented; application chrome is absent.
- Long tables and narrative content paginate without clipping or overlap.
- Errors are actionable and no empty/corrupt file is downloaded.
- No network service, workbook write-back, F6 change, or shared-package change is introduced.