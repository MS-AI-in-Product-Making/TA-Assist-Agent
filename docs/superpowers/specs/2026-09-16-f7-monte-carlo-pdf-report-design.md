# F7 Monte Carlo PDF Report Design

## Goal

Add a visible PDF export action beside **Back to factors** in the Monte Carlo header. The action downloads the generated governed F7 report as a PDF with a clear engineering title.

## User Experience

- Place a `FileDown` icon and **Download PDF Report** button immediately to the right of **Back to factors**.
- Keep **Back to factors** visually secondary and the PDF action visually primary.
- Show the PDF action only after a Monte Carlo result exists.
- Disable it while any report or PDF request is active.
- Display **Generating PDF...** while rendering.
- Preserve the Monte Carlo result and generated report if PDF generation fails; show a controlled retryable error near the action.
- Use **F7 Monte Carlo Analysis Report** as the PDF document title.
- Show the workbook and worksheet names as report context below the title.
- Download as `<workbook>-<worksheet>-f7-monte-carlo-report.pdf`, with unsafe filename characters removed.

## Architecture

1. `MonteCarloPanel` owns the header control and emits a PDF-download command.
2. `App` coordinates report readiness. It reuses the existing report projection when available or generates it before requesting the PDF.
3. `f7-client` sends the report projection to a dedicated local PDF endpoint and validates the PDF response.
4. `f7-local-api` validates the request, renders self-contained HTML, prints it through the existing controlled local browser mechanism, and returns `application/pdf` with safe download headers.
5. The source workbook remains read-only and all processing remains local.

## Report Content

The PDF presents the governed report projection rather than the separate assumption-results projection. It includes:

- title and workbook/worksheet provenance;
- assessment and capability summary;
- Factor Setup versus Monte Carlo comparison;
- root-cause analysis and engineering risk;
- suggested action sequence and validation requirements;
- simulation reproducibility evidence.

## Error Handling

- A missing Monte Carlo result or report projection is a controlled prerequisite error.
- Invalid request payloads return controlled validation errors.
- Renderer failures return the existing controlled internal PDF error without exposing local paths or workbook data.
- The UI retains report state and allows another click after a failure.

## Verification

- Component test: button placement, label, icon, visibility, disabled/loading behavior, and emitted command.
- App test: existing report reuse, report generation before PDF export, and failure recovery.
- Client test: request body, PDF MIME validation, empty response rejection, and error mapping.
- API test: strict route validation, PDF response headers, safe filename, unknown session handling, and renderer failure mapping.
- Renderer test: title, escaped provenance, required governed sections, valid PDF output, and cleanup.
- Browser verification: desktop and mobile layouts have no overlap and the downloaded PDF begins with `%PDF-`.
