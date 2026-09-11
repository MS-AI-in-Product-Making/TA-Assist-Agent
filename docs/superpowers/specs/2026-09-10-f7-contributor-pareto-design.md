# F7 Contributor Pareto Design

**Date:** 2026-09-10

## Goal

Replace the single dominant-contributor evidence block under `Contributor concentration hypothesis` with a compact Pareto view that makes tolerance-adjustment priority immediately visible.

## Data

The interpretation view model exposes every calculated Factor contribution, sorted by `% Cont. to sigma` descending with the existing stable reference tie-break. Each row also contains cumulative contribution percentage. No contribution is omitted merely because it is small.

## Presentation

The concentration root-cause item renders a Pareto chart only when contributor evidence is complete:

- ranked bars show individual `% Cont. to sigma`;
- a cumulative line shows cumulative percentage against a 0-100% scale;
- Factor names and exact percentages remain readable in a compact ranking table;
- the old Contributor, Contributor reference, and Contribution evidence grid is removed for this item;
- other root-cause evidence grids remain unchanged.

The chart uses native SVG and HTML without adding a chart dependency. On desktop, the chart and compact ranking table sit side by side. On narrow screens they stack and their viewports scroll horizontally instead of clipping labels.

The final-specification fallback shows calculated minimum outward limits. For modeled mean $\mu$, modeled standard deviation $\sigma$, and target Cpk $C_{pk,t}$:

- calculated LSL is the lesser of the current LSL and $\mu - 3\sigma C_{pk,t}$;
- calculated USL is the greater of the current USL and $\mu + 3\sigma C_{pk,t}$.

This keeps a side unchanged when it already has sufficient margin and never tightens either specification. The UI labels the values as assumption-based and subject to requirement-owner approval.

## Validation

Tests cover descending order, cumulative percentages, conditional rendering, accessible chart metadata, and preservation of other root-cause evidence. Validate with the complete F7 test project, production build, ESLint, and the live workbook page at desktop and mobile widths.
