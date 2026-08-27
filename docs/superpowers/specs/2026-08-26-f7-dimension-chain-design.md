# F7 Dimension Chain Design

## Goal

Add a manually generated dimension-chain visualization to Factor Setup. The chart represents additive and subtractive loops from the current factor data and sits to the left of the existing Response Summary Table.

## User Experience

- Before the first generation, the panel shows an empty state and a `Generate` button.
- Generation captures a snapshot of the current Factor Setup data. The chart does not update while the user edits factors.
- After any Factor Setup field changes, the existing chart remains visible and a warning says that an update is required. The primary action becomes `Update`.
- Clicking `Update` replaces the saved snapshot and redraws the chart.
- A segmented `Horizontal / Vertical` control changes chart orientation immediately. Orientation is presentation state and does not require regeneration.
- On wide screens, Dimension Chain and Response Summary Table share the output row at an equal 50/50 width. On narrow screens, they stack vertically with Dimension Chain first.

## Factor Semantics

- Item Number is the current visible Factor table order, starting at 1. Reordering, adding, or removing factors changes these numbers on the next generation.
- A positive Design Nominal is an additive loop and points forward along the selected axis.
- A negative Design Nominal is a subtractive loop and points backward.
- Additive arrows and start dots use the same blue as positive Design Nominal text. Subtractive arrows and start dots use the same red as negative Design Nominal text.
- Factor Setup rejects a zero Design Nominal in accordance with the F7 factor contract. The chart retains a short zero marker only as defensive rendering for historical or external projections.
- Each component displays its Item Number and signed Design Nominal. The Factor name is also exposed in the visual label or accessible description.
- Every component uses a filled circle at its start and one arrowhead at its end.
- The closure arrow starts with a filled green dot at the final cumulative graphical position and points back to the original position. It is green and labeled `Closure`.
- A dashed origin guide makes the first component start and closure endpoint visibly collinear.

## Geometry And Scaling

Use a cumulative, lane-based SVG chart:

1. Each component occupies its own lane.
2. The component starts at the previous component's cumulative endpoint.
3. Its signed value determines direction.
4. Its scaled absolute value determines arrow length.
5. Light projection guides connect shared cumulative positions across lanes.
6. The green closure arrow is drawn on a final lane from the final endpoint back to the origin.

Scaling preserves direct proportions when values are reasonably close. Let `ratio = maxNonZeroMagnitude / minNonZeroMagnitude`:

- When `ratio <= 8`, use linear normalized magnitudes.
- When `ratio > 8`, use square-root compression.
- Clamp nonzero arrows to a minimum visible length and the chart's maximum available component length.
- A defensively received zero value uses a distinct short marker and does not move the cumulative position; it is not a confirmable Factor Setup value.
- Arrowhead markers use a compact `4 x 4` size, half the original marker dimensions.
- Clicking `Update` rebuilds geometry from the new snapshot, recalculating the maximum magnitude, compression mode, and every arrow length.

The same geometry is rotated for vertical mode rather than recomputed with different semantics.

## Snapshot And Dirty State

The generated snapshot contains factor ID, current order, Item Number, Factor name, Design Nominal, tolerances, safety factor, sigma level, and distribution.

A deterministic signature compares the current Factor Setup data with the generated snapshot. Changes to any Factor Setup field, factor order, factor name, factor count, or factor identity mark the chart stale. The stale chart remains visible until `Update` is clicked.

Invalid or incomplete factor drafts disable generation and show the existing Factor Setup validation behavior. No chart is generated from partial data.

## Components

Create `DimensionChainPanel.vue` as an isolated presentation and interaction component. It receives the current factor projection and validity state, owns the generated snapshot and orientation, and renders the SVG.

`FactorInputTable.vue` projects its active factor drafts into the component and wraps Dimension Chain and Response Summary in a shared output layout. Existing F4 calculation and confirmation flows remain unchanged.

No chart-specific API, persistence, or workbook changes are required. The generated chart is local UI state for the current page session and follows the existing non-zero Design Nominal contract.

## Accessibility

- Use real buttons for Generate/Update and the orientation controls.
- Expose orientation with `aria-pressed`.
- Give the SVG a title and description summarizing item count and orientation.
- Give each component arrow an accessible label with Item Number, Factor name, signed value, and additive/subtractive role.
- Do not rely on direction or color alone; retain text labels for role and closure.

## Responsive Layout

- Desktop output grid uses `repeat(2, minmax(0, 1fr))`, giving Dimension Chain and Response Summary equal width.
- Response Summary becomes denser within the half-width panel: reduce heading and cell padding, use a smaller but readable table font, tighten row height, and reduce each summary section's minimum track width. Numeric values remain right aligned and labels do not overlap or truncate silently.
- Response Summary retains internal horizontal scrolling only when its content cannot fit after compacting; the page itself must not gain horizontal overflow.
- Below the existing application breakpoint, switch to one column with Dimension Chain above Response Summary.
- SVG uses a stable view box and does not allow labels or arrowheads to resize the surrounding layout.

## Tests

Add focused tests for:

- Initial empty state and Generate action.
- Item Number and Factor-name labels.
- Positive forward and negative backward directions.
- Filled start dots, direction-colored one-way component arrows, dashed origin guide, and green closure arrow.
- Linear scaling, compressed scaling, minimum visible arrows, and zero values.
- Snapshot behavior: edits do not redraw the existing chart.
- Dirty warning and Update action after every Factor Setup field category, reorder, add, and remove.
- Horizontal and vertical controls without regeneration.
- Dimension Chain appearing before Response Summary in the shared output layout.
- Default output layout exposing two equal columns.
- Compact Response Summary styles retaining readable labels, numeric alignment, and contained horizontal overflow.
- Existing Factor Setup calculations and confirmation payloads remaining unchanged.
