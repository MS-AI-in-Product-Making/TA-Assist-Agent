# Mean Centering Adjustment Table Design

## Goal

Present the Center the process mean recommendation in the same scannable table-and-outcome style as Required specification change.

## Data

The governed `improvement-center-mean` narrative action exposes optional structured `meanCentering` evidence containing current mean, target mean, required adjustment, direction, and coordinated display strings. This keeps formatting consistent with the narrative and avoids parsing prose in the UI.

## Presentation

- Keep the action title and rule ID.
- Keep only the mean-centering feasibility statement as introductory text.
- Render a four-column table: Parameter, Current, Recommended, Adjustment.
- Render one Mean row with the recommended arrow and direction appended to the adjustment.
- Render an Expected result panel showing the target Mean and the text `after applying the recommended adjustment`.
- Reuse the existing specification fallback layout and responsive behavior for visual consistency.

## Fallback

When complete numeric evidence is unavailable, omit the table and retain the controlled feasibility narrative.

## Verification

Tests cover structured evidence, exact table labels and values, expected-result content, unavailable evidence, and retention of the existing specification-change table.