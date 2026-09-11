# F7 Mean Centering Values Design

## Goal

Tell users how far and in which direction to move the process mean.

## Design

- Generate the numeric guidance in the shared product-language narrative layer so Web and API reports agree.
- Calculate `target mean = LSL + (USL - LSL) / 2` and `required adjustment = target mean - current mean`.
- Show current mean, target mean, signed required adjustment, and LSL/USL direction in the Center the process mean narrative.
- Use the existing adaptive narrative number formatting so small nonzero adjustments remain visible.
- If Mean, LSL, or USL is unavailable, retain the existing feasibility-only narrative.
- If the required adjustment is zero, state that no adjustment is required.

## Verification

- The combined scenario reports `+0.08`, target `0`, and `-0.08 toward LSL`.
- A positive adjustment reports `toward USL`.
- Missing evidence preserves the existing fallback narrative.