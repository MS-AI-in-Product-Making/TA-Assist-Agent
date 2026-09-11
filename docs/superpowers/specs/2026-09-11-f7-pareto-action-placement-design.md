# F7 Pareto Action Placement Design

## Goal

Present Tolerance Adjustment Priority under `Reduce total variation` as implementation guidance instead of root-cause evidence.

## Design

- Remove the Pareto chart from the Excessive variation root-cause item.
- Render the unchanged chart and heading inside the `improvement-reduce-variation` action item when contributor priorities are available.
- Keep contributor calculations, ordering, percentages, table fields, and chart styling unchanged.
- Do not duplicate the chart in both sections.

## Verification

- The Excessive variation item no longer contains the Pareto chart or its heading.
- The Reduce total variation item contains the heading and chart.
- Existing Pareto data and percentage-label tests continue to pass.