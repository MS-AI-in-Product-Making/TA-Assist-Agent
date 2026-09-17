# F7 PDF Inputs and Trimmed Output Design

## Goal

Make the F7 Monte Carlo PDF show the governed engineering inputs before its results, while removing internal engineering-detail and reproducibility sections that users do not need.

## Scope

This change applies only to the F7 governed report projection and F7 PDF renderer on `User/Ralf_F7_Generate_PDF_Report`.

Included:

- Extend each projected report Factor with its confirmed Factor Setup values.
- Render a Factor Setup table at the beginning of the PDF.
- Render a reproducible horizontal Dimension Chain from the confirmed Factor order and signed nominal values.
- Remove all PDF content beginning with `Governed engineering detail`, including reproducibility evidence.

Excluded:

- Changes to Factor Setup editing behavior.
- Persistence of Dimension Chain orientation, drag positions, lane offsets, or other browser-only presentation state.
- Changes to Monte Carlo calculations, capability decisions, F0 interpretation, or the Web report.
- Changes to the separate assumption-results PDF.

## Governed Data Contract

Extend `f7ReportFactorSchema` with these confirmed input fields:

- `designNominal`
- `upperTolerance`
- `lowerTolerance`
- `longTermSafetyFactor`
- `sigmaLevel`
- `setupDistribution`

Existing fields remain authoritative for simulation provenance:

- `factorId`
- `factorName`
- `loopCoefficient`
- `sourceMode`
- `approvedDistribution`
- `sourceReferences`

`createF7ReportProjection` copies the new values from each factor's validated `F7FactorEvidence`. This keeps the PDF request server-authoritative and prevents browser display state from becoming report evidence.

The contract remains strict. Existing fixtures and route tests must supply the new required fields so incomplete report projections fail closed.

## PDF Structure

The PDF reading order becomes:

1. Report title and workbook metadata.
2. `Engineering Inputs`.
3. Factor Setup table.
4. Dimension Chain diagram.
5. `Governed Result`.
6. Monte Carlo output distribution.
7. TA Comparison Matrix and run metadata.
8. F0 interpretation and optimization report.
9. Governed assessment and Release/Hold disclaimer.
10. Contract footer.

The PDF ends after the governed assessment. It must not render:

- Governed Engineering Detail
- Engineering Summary
- Root Cause Analysis
- Engineering Risk
- Suggested Action Sequence
- Validation Requirements
- Evidence Disclosure
- Reproducibility Evidence
- Factor evidence

The F0 interpretation and optimization direction remain because they are part of the user-facing governed result shown in the Web UI.

## Factor Setup Table

Render one row per confirmed Factor in report order with these columns:

- Item
- Factor
- Design nominal
- Upper tolerance
- Lower tolerance
- Long-term safety factor
- Sigma level
- Setup distribution
- Source mode

Values use the renderer's finite engineering-number formatting. Dynamic text is HTML escaped. The table is allowed to continue onto another page when many Factors exist, while its header repeats through normal print-table behavior.

## Dimension Chain

Render a self-contained inline SVG immediately after the Factor Setup table.

Rules:

- Orientation is always horizontal.
- Factor order matches the confirmed Factor Setup order.
- Positive nominal values point right and are labeled additive.
- Negative nominal values point left and are labeled subtractive.
- Zero nominal values are shown as a zero-length marker.
- Each segment shows item number, Factor name, and signed nominal value.
- A closure arrow returns from the final accumulated position to zero.
- Segment lengths use the same bounded compression principle as the Web Dimension Chain so large magnitude ratios remain legible.
- The diagram is reconstructed from governed report inputs only. Browser orientation, dragging, and manual layout are intentionally excluded.
- SVG coordinates and labels must remain finite for extreme finite contract values.
- Dynamic SVG text and attributes are escaped.

For many Factors, the chart width remains fixed to the printable area and segments are distributed across wrapped lanes or vertically stacked label rows without clipping. The SVG may grow vertically but must not scale text below readable print size.

## Error Handling

- Projection creation fails closed if confirmed factor evidence required by the report contract is unavailable.
- The renderer must not emit `NaN` or `Infinity` for valid finite inputs.
- The existing browser rendering queue, temporary-file cleanup, PDF signature validation, and controlled local-browser policy remain unchanged.
- No external resources, scripts, or network PDF services are introduced.

## Testing

Contract tests verify:

- New Factor Setup fields are required and strictly validated.
- Invalid non-finite values and unsupported distributions are rejected.

Projection tests verify:

- Confirmed Factor evidence maps exactly to the report Factor inputs.
- User-added, baseline, and measured Factors retain the same input values and ordering.

Renderer tests verify:

- Engineering Inputs precede Governed Result.
- Factor Setup columns and escaped values are present.
- Dimension Chain contains one segment per Factor, correct direction, labels, and closure.
- Zero, mixed-sign, compressed, and extreme finite chains render finite SVG geometry.
- All sections from Governed Engineering Detail onward are absent.
- Governed Result, chart, comparison, F0 interpretation, assessment, and disclaimer remain.
- Existing PDF lifecycle, filename, queue, cleanup, and `%PDF-` validation tests continue to pass.

A real generated PDF is visually checked in A4 landscape for readable table columns, unclipped chain labels, stable page breaks, and the expected reduced page count.

## Acceptance Criteria

- Users can identify every confirmed Factor Setup input at the start of the report.
- Users can understand the signed Dimension Chain before reading simulation results.
- The report contains no content beginning with Governed Engineering Detail or Reproducibility Evidence.
- The report is generated only from the server-authoritative projection.
- All focused contract, projection, renderer, and API route tests pass.
- Target files pass TypeScript and ESLint checks.
