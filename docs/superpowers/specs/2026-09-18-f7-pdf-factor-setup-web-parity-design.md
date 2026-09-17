# F7 PDF Factor Setup Web-Parity Design

**Date:** 2026-09-18
**Status:** Approved
**Target:** F7 governed report projection and PDF report

## Goal

Make the `Download PDF Report` Factor Setup content match the information shown in the Web Factor Setup table while preserving readable A4 landscape output.

The PDF will use two consecutive tables instead of compressing all 18 Web columns into one table. The two tables retain the same Factor order and use `Item` and `Factor` as stable visual keys.

## Scope

Included:

- Extend the governed report Factor projection with traceability, setup-analysis, measured-comparison, contribution, sample-count, readiness, and warning data required by the Web display.
- Replace the existing nine-column PDF Factor Setup table with a Setup Inputs table and a Measurement Analysis table.
- Preserve Web display semantics for `Missing`, `Setup`, `Actual`, `Delta`, source mode, readiness, and warning state.
- Keep existing report ordering, Dimension Chain, Monte Carlo results, interpretation, and assessment sections unchanged.

Excluded:

- Changes to Factor Setup editing or measurement-entry workflows.
- Browser DOM capture or client-authored report fields.
- Changes to Monte Carlo, capability, or distribution-fit algorithms.
- Pixel-identical rendering between the scrollable Web table and printable PDF.
- Changes to the separate assumption-results PDF.

## Governed Data Contract

`f7ReportFactorSchema` remains the strict authority boundary for each projected Factor. Extend it with the display evidence needed by the PDF:

- `partNumber` and `dimId`: optional confirmed traceability strings.
- `setupMean`, `setupTolerance`, `setupOneSigma`, and `setupCpk`: finite setup-analysis values.
- `percentContributionToSigma`: finite value from zero through one.
- `measurementComparison`: optional measured comparison containing finite `actual` and `delta` values for Mean, Tolerance, 1 sigma, and Cpk. Metrics unavailable under governed rules remain absent rather than fabricated.
- `sampleCount`: nonnegative integer representing included accepted observations; zero for Factors without a ready measured dataset.
- `readiness`: `ready` or `pending`, using the same rule as Web Factor Setup.
- `measurementWarning`: boolean using the same measurement warning criterion as the Web source-mode control.

The report contract continues to fail closed. Unknown properties, non-finite values, out-of-range contributions, negative sample counts, and incomplete comparison metric pairs are invalid.

## Data Flow And Calculation Authority

`packages/f7-statistics` becomes the shared owner of the pure Factor measured-comparison calculation currently implemented in `apps/f7-web/src/factor-measured-comparison.ts`. Both the Web table and `createF7ReportProjection` consume that shared helper, so the approved formulas have one implementation. The helper accepts contract-owned dataset shapes and returns a provider-neutral comparison DTO; it has no Vue or local-API dependency.

`createF7ReportProjection` derives the new fields from the validated `F7SessionSnapshot`. It uses the shared measured-comparison helper and the same setup-value formulas used by the Web table. The PDF renderer only formats projected values; it does not calculate statistics from raw measurements.

Warning parity remains based on the current Web warning rules: specification crossing zero, included observations outside Factor limits, or candidate outliers. Move the pure warning evaluator and any provider-neutral diagnostics it requires to the same shared statistics boundary; retain Web-only message presentation in the Web app. The report projection stores only the boolean warning state required by the PDF.

The calculation semantics match the approved Web measured-comparison design:

- Setup Mean uses the existing calculated Factor mean.
- Setup Tolerance uses the existing positive half-tolerance.
- Setup 1 sigma uses the existing calculated Factor one-sigma value.
- Setup Cpk is `sigmaLevel / 3`.
- Actual Mean is the arithmetic mean of included observations.
- Mean Delta is `abs(actualMean) - abs(setupMean)`.
- Actual Tolerance is `3 * actualStandardDeviation`.
- Tolerance Delta is `actualTolerance - setupTolerance`.
- Actual 1 sigma is sample standard deviation, or governed within-subgroup standard deviation for rational subgroups.
- 1 sigma Delta is `actualStandardDeviation - setupOneSigma`.
- Actual Cpk uses the existing Factor capability result.
- Cpk Delta is `actualCpk - setupCpk`.
- Percent contribution is the Factor setup variance divided by total setup variance.
- Readiness is `ready` for baseline Factors or Factors with a ready measurement result; otherwise it is `pending`.

A ready dataset with included observations may have Mean available while variation-dependent metrics remain unavailable. The projection preserves that distinction with optional metric pairs.

## PDF Structure

Under `Engineering Inputs > Factor Setup`, render these consecutive tables.

### Setup Inputs

Columns:

1. Item
2. Factor
3. Part Number
4. DIM ID
5. Design Nominal
6. +Tol
7. -Tol
8. Long-term Safety Factor
9. Sigma Level
10. Distribution

Missing Part Number or DIM ID displays exactly `Missing`. Numeric values use the existing bounded engineering-number formatter. Dynamic text is HTML escaped.

### Measurement Analysis

Columns:

1. Item
2. Factor
3. Mean
4. Tolerance
5. 1 sigma
6. Cpk
7. % Contribution to sigma
8. Source Mode
9. Sample Count
10. Readiness

Each metric cell shows the Setup value. When governed measured comparison evidence exists, the same cell also shows labeled `Actual` and `Delta` lines. Unavailable measured values display an em dash and are never inferred.

Source Mode uses the Web labels `Measured Data` and `Baseline Assumption`. A measured Factor with a warning displays a visible `Warning` label next to Source Mode. Readiness displays `Ready` or `Pending` with text in addition to color.

## Layout And Pagination

- Retain A4 landscape and the existing PDF visual language.
- Keep both tables at normal report font size instead of shrinking an 18-column grid.
- Repeat table headers through print-table semantics when a table spans pages.
- Permit page breaks between Factor rows, but keep each row intact.
- Keep table order stable and preserve one-to-one row alignment through Item and Factor values.
- Render the Dimension Chain after both Factor Setup tables.
- Do not change subsequent report sections or their page-break rules.

## Error Handling And Governance

- PDF generation remains server-authoritative and accepts no browser-supplied analysis values.
- Report generation fails closed when required confirmed Factor evidence is missing or inconsistent with the simulation manifest.
- Optional measured metrics represent governed unavailability; the renderer displays an em dash rather than zero.
- All text remains escaped and all projected numeric values remain finite under the strict contract.
- Existing local-browser rendering, queue limits, temporary-file cleanup, PDF signature validation, and filename controls remain unchanged.

## Verification

Contract tests verify strict acceptance of complete parity fields and rejection of invalid traceability, contribution, metric-pair, sample-count, readiness, and warning values.

Projection tests verify:

- Part Number and DIM ID map from confirmed Factor evidence.
- Setup metrics and contribution match the Web calculation rules.
- Ready measured Factors project Actual and Delta metrics, sample count, warning, and readiness.
- Baseline and unready Factors omit measured metrics without inventing values.
- Rational-subgroup, insufficient-data, zero-variation, and excluded-observation behavior matches the Web helper.

Shared-helper tests verify the measured-comparison and warning calculations independently. Existing Web helper and component tests are migrated to import the shared implementation and remain behaviorally unchanged.

Renderer tests verify:

- The Setup Inputs table has the approved ten columns in order.
- The Measurement Analysis table has the approved ten columns in order.
- Both tables retain Factor order and escaped names.
- Missing traceability displays `Missing`.
- Setup, Actual, Delta, contribution, source mode, warning, sample count, and readiness display correctly.
- Unavailable optional metrics display an em dash.
- Both tables precede the Dimension Chain and Governed Result.
- Existing PDF sections and lifecycle tests remain passing.

A generated PDF is visually checked at A4 landscape for readable text, repeating headers, stable row alignment, and no clipping or overlap.

## Acceptance Criteria

- Every Web Factor Setup information category appears in the PDF across the two tables.
- Setup, Actual, and Delta values use the same governed calculation semantics as Web Factor Setup.
- Traceability, warning, sample-count, and readiness states match the report session snapshot.
- The PDF remains readable at A4 landscape without an 18-column compressed table.
- Dimension Chain and all downstream report content remain unchanged.
- Focused contract, projection, renderer, API, and PDF lifecycle tests pass.