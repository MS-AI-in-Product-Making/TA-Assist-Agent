# F7 Selected Distribution Guidance Design

## Goal

Make the Capability page decision-focused by showing only the selected distribution, then place the Factor capability and measured-distribution interpretation directly below it.

## Scope

- The Capability page shows one selected distribution only.
- The dedicated Distribution Fit stage retains the complete candidate comparison, Q-Q evidence, warnings, failures, and governed conclusion.
- An approved family is the final selection. Before approval, the governed `proposedFinalFamily` is shown and the approval action remains available.
- When selection is withheld or no model is acceptable, the Capability page shows a controlled unavailable state and does not substitute another candidate.

## Selected Distribution Summary

The summary contains the selected family, model specification, parameters, Bootstrap status and p-value, AICc, sample size, selection confidence, approval state, and an always-visible plot for that family. Other candidates and their metrics are not rendered in the Capability page.

## Guidance Placement

`Factor Capability Guidance` moves below the selected Distribution Fit summary. A new `Measured Distribution Interpretation` follows it so both interpretations form the final section of the Capability page.

## F0 Distribution Rules

A browser-safe, immutable F0 rule set controls these interpretations:

- Bootstrap goodness-of-fit status (`acceptable`, `weak`, or `rejected`).
- Selection confidence (`moderate` or `low`).
- Small-sample uncertainty when the governed reason code is present.
- Compatibility with the observed sample does not prove the population distribution.

The measured center and spread comparisons remain factual Setup/Sample evidence. They are not presented as F0 rules. Every controlled statement includes the F0 rule-set version and rule IDs. If rules are unavailable or invalid, the interpretation displays an unavailable state instead of an unsupported conclusion.

## Testing

- Validate and freeze the F0 distribution rules at runtime and type level.
- Unit-test selected-family resolution and interpretation for acceptable, weak, rejected, low-confidence, small-sample, and unavailable cases.
- Verify Capability renders one distribution and no candidate table while the dedicated stage remains complete.
- Verify guidance order: selected Distribution Fit, Factor Capability Guidance, Measured Distribution Interpretation.
- Validate responsive rendering in the browser with the real workbook.