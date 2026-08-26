# F7 Editable Factor Specification Design

## Goal

Replace the Factor Setup source/audit columns with editable Design Nominal, +Tolerance, and -Tolerance inputs whose confirmed values govern all downstream F7 analysis.

## Data Model

The workbook candidate preserves the extracted signed design nominal and both tolerance values in addition to source-cell audit references. A factor setup confirmation contains the candidate ID plus the three user-confirmed numeric values. The loop coefficient is derived from the sign of Design Nominal and is not independently editable.

Confirmed evidence retains Design Nominal, +Tolerance, and -Tolerance alongside the normalized physical mean, signed contribution, and physical LSL/USL. Source cells remain in contracts and audit evidence but are not displayed in the Factor Setup table.

## Validation And Normalization

- Design Nominal must be finite and non-zero.
- +Tolerance must be finite and nonnegative.
- -Tolerance must be finite and nonpositive.
- The signed tolerance interval may cross zero; Design Nominal remains the loop-direction authority.
- `loopCoefficient = sign(Design Nominal)`.
- `physicalMean = abs(Design Nominal)`.
- Physical USL is the larger absolute signed endpoint. Physical LSL is zero when the interval crosses zero; otherwise it is the smaller absolute endpoint.
- Signed contribution mean equals Design Nominal.

The server validates the confirmation before creating evidence. Capability, Distribution Fit plots, and future Monte Carlo consume the resulting evidence specifications.

## UI

The table columns are Factor, Design Nominal, +Tolerance, -Tolerance, Source Mode, Sample Count, and Readiness. Source Cells, Signed Mean, Coefficient, and Physical Mean are removed.

Before setup confirmation, all three engineering values are number inputs initialized from workbook data. Negative Design Nominal text is red to identify a subtractive loop dimension; positive text is blue to identify an additive loop dimension. Tolerance inputs use neutral text. Invalid values disable confirmation and expose a concise inline validation message. After confirmation, the values render read-only with the same nominal sign color.

## Verification

Contract tests cover valid positive/negative loops, zero nominal, tolerance signs, supported zero crossing, and strict fields. Adapter tests cover workbook extraction and normalized evidence. Service/API tests cover persistence. Vue tests cover columns, defaults, editing payload, colors, validation, and post-confirmation display.
