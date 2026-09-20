# F7 Actual Value Severity Design

## Goal

Help users scan the measured comparison row and quickly identify Actual values whose adverse deviation from Setup is meaningful, without treating small differences or engineering improvements as problems.

## Severity Levels

Use three levels based on adverse relative deviation:

- `normal`: deviation is at most 5%; keep the standard text color.
- `attention`: deviation is greater than 5% and at most 15%; show the Actual value in amber.
- `critical`: deviation is greater than 15%; show the Actual value in red.

Threshold boundaries are inclusive at 5% and 15%, so minor numerical noise remains normal. The severity class applies only to the Actual value, not the `Actual` label, Delta, cell, or row. Each value also exposes its severity and percentage through machine-readable attributes and a tooltip so color is not the only available signal.

## Metric Rules

For numeric metrics, `relativeDeviation = adverseDifference / abs(setup)` when the Setup magnitude is nonzero.

- Mean: `adverseDifference = abs(abs(actual) - abs(setup))`. This preserves the table's existing absolute-magnitude Delta semantics, so a sign reversal caused by Factor direction does not create a false alert. If Setup Mean is zero, use Setup Tolerance as the denominator. If both are zero, an exact match is normal and any difference is critical.
- Tolerance: `adverseDifference = max(0, actual - setup)`. A smaller measured spread is an improvement and remains normal.
- 1 Sigma: `adverseDifference = max(0, actual - setup)`. A smaller measured sigma is an improvement and remains normal.
- Cpk: `adverseDifference = max(0, setup - actual)`. A higher measured Cpk is an improvement and remains normal.
- Contribution: `adverseDifference = max(0, actual - setup)`. A lower measured contribution remains normal.
- Distribution: matching families are normal; a different approved measured family is critical because it is categorical and has no meaningful percentage distance.

Unavailable Actual values have no severity class. Calculations use unrounded numeric values; formatting does not influence classification.

## Ownership And Rendering

A small pure Web helper owns severity classification and is independently unit tested. `FactorInputTable.vue` supplies the existing Setup and Actual values, applies the returned severity only to a nested Actual-value span, and leaves current Delta display unchanged. No contract, API, simulation, workbook, or report changes are required.

Use existing F7 palette semantics:

- Normal: inherited `--ink`.
- Attention: a readable amber token added to the root palette.
- Critical: existing `--danger`.

## Verification

Unit tests cover both threshold boundaries, adverse and improving directions, zero Setup behavior, unavailable values, and categorical Distribution mismatch. Component tests verify each severity class is attached only to the Actual value and that labels and Delta remain uncolored. Existing Factor table and F7 application regression suites must continue to pass.
