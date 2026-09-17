# F7 Monte Carlo PDF Web-Parity Design

## Goal

Revise the PDF produced by **Download PDF Report** so its content order and visual language closely match the Web experience beginning at **Governed result**, while remaining a stable governed engineering document on A4 landscape pages.

The document title is **F7 Monte Carlo Governed Result Report**.

## Scope

This change is limited to the F7 local API report PDF renderer and its focused tests. It does not change the Web workflow, API contract, authoritative report projection, workbook handling, or the separate assumption-results PDF feature.

## Content Order

The PDF follows the Web sequence rather than leading with a separate executive-summary layout:

1. Report title, workbook, worksheet, generation time, and classification.
2. **Governed result** with predicted yield and target-status treatment.
3. **Monte Carlo output distribution** with observed histogram bars, fitted Normal curve, optional Factor Setup curve, specification limits, target, mean, target sigma range, and legend.
4. **TA Comparison Matrix** matching the Monte Carlo panel: Mean, Standard deviation, Cp, Cpk, Yield, and Defect rate where governed evidence is available.
5. Run metadata: Iterations, Median, LSL / USL, Target sigma / Cpk, and Run seed.
6. **TA interpretation and optimization report** matching the subsequent Web report panel.
7. **Factor Setup vs Monte Carlo TA** comparison table.
8. **Interpretation and optimization direction**, including provenance, interpretations, optimization directions, and applicability.
9. **Governed assessment** with the same status meaning and release-decision disclaimer as the Web.
10. Governed engineering detail retained from the existing PDF: Engineering Summary, Root Cause Analysis, Engineering Risk, Suggested Action Sequence, Validation Requirements, Evidence Disclosure, and Reproducibility Evidence.

Unavailable analysis is presented with the same controlled reason across affected sections. Optional rows and chart overlays are omitted when their required governed evidence is unavailable.

## Visual Design

- Use A4 landscape with the Web palette: dark navy text, teal accent, neutral gray surfaces, blue in-spec bars, red out-of-spec bars, and status-specific success or danger treatment.
- Reproduce the Web hierarchy with uppercase eyebrow labels, restrained section headings, bordered tables, metadata tiles, and a left-accent governed assessment banner.
- Render the distribution as inline SVG generated only from the authoritative report projection. No browser DOM capture, external resources, or network requests are introduced.
- Keep chart labels, legends, tables, assessment banners, action cards, and evidence tables intact with `break-inside: avoid` and explicit section-level page breaks where needed.
- Allow content to flow to additional pages rather than shrinking engineering text below a readable print size.

## Architecture And Data Flow

`renderF7ReportPdfHtml` remains the single report HTML entry point. Small local helpers derive display values, the comparison matrix, chart geometry, and governed report sections from `F7ReportProjection`.

The existing flow remains unchanged:

1. The Web requests a PDF for the active session.
2. The local API regenerates the authoritative report projection.
3. The renderer builds self-contained HTML and inline SVG from that projection.
4. Controlled local Edge or Chrome prints the HTML to PDF.
5. Existing PDF signature validation, bounded queueing, cleanup, and response checks remain in force.

## Error Handling And Governance

- All dynamic report values continue to use HTML escaping.
- SVG geometry accepts only finite numeric values derived from the validated report contract.
- Missing or non-evaluable capability data uses controlled unavailable messaging instead of fabricated values.
- The server remains authoritative; client-supplied narrative or browser state is not used as report authority.
- PDF creation continues to fail closed for missing browsers, missing output, invalid signatures, or cleanup failures.

## Verification

- Renderer tests first assert the new title, Web section order, comparison matrix rows, governed report-panel content, assessment disclaimer, SVG chart elements, legend, and reproducibility evidence.
- Tests cover escaped workbook and factor content and unavailable analysis behavior.
- Existing filename, valid-PDF, cleanup, renderer-failure, and queue-capacity tests remain passing.
- A real local browser render verifies the PDF signature and page output.
- Visual inspection verifies readable landscape pages, intact chart and table blocks, and no clipped or overlapping content.

## Out Of Scope

- Pixel-identical browser screenshots.
- Changes to the interactive Web page.
- Changes to report contracts or Monte Carlo calculations.
- Changes to the assumption-results PDF or workbook-catalog features.