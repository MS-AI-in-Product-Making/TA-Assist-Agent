# F7 TA Result Summary List Design

## Scope

Replace the current `Capability is below target` result-judgment block in `TAResultsInterpretation.vue` with one compact engineering result table. Keep Root Cause Analysis, Engineering Risk, Suggested Action Sequence, disclosures, and Input Readiness unchanged. Omit the separate Engineering Summary because the fact-first Overall assessment already provides the concise result summary.

This change is limited to `apps/f7-web`. It reuses the existing assumption-based RSS calculation and does not change calculation, contract, knowledge-base, API, or report behavior.

## Result Model

Extend the available assumption-results view model with an ordered `resultSummary` containing these rows:

1. Mean
2. Standard Deviation
3. Cp
4. Cpk
5. Lower Cpk
6. Upper Cpk

Each row supplies display-ready values for `metric`, `result`, `reference`, optional `referenceDetail`, `difference`, `assessment`, `performanceContext`, and semantic `tone`. The component renders the view model and does not repeat engineering formulas.

## Comparison Semantics

- **Mean:** result is the calculated system mean; reference is the system design nominal and explicitly identifies `System Design Nominal` as its source; difference is `mean - designNominal`. Assessment indicates centered, shifted low, or shifted high.
- **Standard Deviation:** result is RSS sigma. The maximum allowed value is `min(mean - LSL, USL - mean) / (3 * targetCpk)`, based on the current mean and resolved Cpk target. The reference explicitly states that it is derived from the nearest specification limit and target Cpk. Difference is actual RSS sigma minus this maximum. Assessment is within target or too high.
- **Cp:** result is calculated Cp; reference is the resolved Cpk target; difference is `cp - targetCpk`. Assessment is meets target or below target.
- **Cpk:** result, target, signed margin, and assessment reuse the governed result judgment.
- **Lower Cpk:** result is calculated lower-side Cpk; reference is the resolved Cpk target; difference is `lowerCpk - targetCpk`. Assessment is meets target or below target.
- **Upper Cpk:** result is calculated upper-side Cpk; reference is the resolved Cpk target; difference is `upperCpk - targetCpk`. Assessment is meets target or below target.

## Performance Context

F0 `interpretation-rules-v2` governs only `Meets target` and `Below target` for Cpk performance. It does not define Excellent, Good, Marginal, Poor, or similar multi-level grades. The table must not invent those grades. The existing Assessment column remains the only governed performance level.

The adjacent Performance Context column provides deterministic explanatory evidence:

- **Mean:** `Centered on nominal`, or the absolute offset as a percentage of the full specification span with the shift direction.
- **Standard Deviation:** actual sigma as a percentage of the maximum allowed sigma, plus margin or overage. If the maximum is not positive, display `No positive allowance at target` instead of a ratio.
- **Cp, Cpk, Lower Cpk, Upper Cpk:** achieved value as a percentage of resolved target, plus surplus or shortfall. Exact target displays `100% of target` without a second clause.

Percentages use the existing F7 narrative number formatter. These statements are explanatory calculations, not additional F0 grades.

All values use the existing F7 narrative precision policy. The Cpk row reuses the governed result-judgment display strings so the result, target, and signed margin always share precision. Signed differences retain their sign, including values close to zero.

## Presentation

The replacement block contains:

- Header `TA Result Summary`.
- Overall status badge using the governed Cpk status.
- Six columns: `Metric`, `Result`, `Specification / Reference`, `Difference`, `Assessment`, and `Performance Context`.
- Six comparison rows in the fixed order above. LSL, USL, Yield, and DPM are omitted because they repeat information already available elsewhere and do not participate in this comparison.
- Final overall-assessment line starts with the governed binary conclusion `Pass` or `Fail`, followed by short deterministic facts in this order: Mean shift and direction, Standard Deviation status, Cpk against target, and side-specific capability based on Lower Cpk and Upper Cpk. It does not repeat Root Cause hypotheses.
- No separate Engineering Summary section is rendered between Overall assessment and Root Cause Analysis.

The desktop table uses a muted header, clear cell separators, bold right-aligned result values, tabular numerals, compact spacing, and restrained pass/fail/warning/reference badges. On narrow screens, each metric becomes a two-column information block instead of forcing horizontal scrolling. The table includes a caption and a named focusable region; assessment never relies on color alone.

## Error Handling

The existing unavailable state remains unchanged. The summary is built only after the same prerequisites, calculation, and governed interpretation checks pass. Invalid or non-finite calculations continue to return the controlled unavailable state rather than partial rows.

## Testing

- Builder tests verify six-row order, Lower/Upper Cpk target comparisons, formulas, signs, and unavailable behavior.
- Builder tests verify Pass/Fail assessment wording, mean direction, sigma status, governed Cpk precision, and lower-, upper-, or both-side capability shortfalls.
- Component tests verify the six headers, performance context display, six comparison rows, absence of the removed Reference Information group, concise overall assessment, near-target precision, and preserved downstream narrative order.
- Run the focused F7 Web unit tests and production build.
- Store browser screenshots, temporary workbook inputs, and manual test results only under `local-test/F7_Test_Finetune_05/`.

## Boundaries

No files outside `apps/f7-web` need implementation changes. If implementation reveals a missing source value or requires changes in contracts, calculation kernel, knowledge base, API, or another application, stop and request approval before modifying that module.