# Response Distribution Curve Design

## Goal

Add an Excel-aligned Normal Distribution Curve directly below the Response Summary Table. The chart updates whenever Factor Setup values, Additional Mean Shift, or system specifications change.

## Data Model

- Mean: `f4Calculation.system.mean` (Adjusted Mean).
- Standard deviation: `f4Calculation.system.rssSigma`.
- LSL/USL: `f4Calculation.capability.lowerSpecLimit` and `upperSpecLimit`.
- Target: midpoint of LSL and USL.
- Sigma references: Mean +/- 3sigma, 4sigma, 4.5sigma, and 6sigma.
- The Normal density curve is computed from Mean and RSS sigma. Factor Setup remains the source because those values feed the existing F4 calculation kernel.

## UI

- Place a full-width `Normal Distribution Curve` section immediately after the Response Summary Table.
- Render with responsive native SVG, following the existing Monte Carlo chart pattern and current F7 visual language.
- Show a black Normal curve, amber LSL/USL lines, gray Target line, orange dashed Mean line, and distinct dashed/dotted sigma pairs.
- Display an inline legend above the plot and numeric labels at the x-axis reference positions.
- Provide four checkboxes for `+/-3sigma`, `+/-4sigma`, `+/-4.5sigma`, and `+/-6sigma`.
- Match the reference defaults: 4sigma and 6sigma visible; 3sigma and 4.5sigma hidden.
- Keep LSL, USL, Target, Mean, and the Normal curve always visible.

## Plot Behavior

- Build an x-domain that includes LSL, USL, Mean +/- 6sigma, and modest horizontal padding.
- Scale the density curve to the plot height; the y-axis is intentionally omitted because the chart communicates relative probability density.
- Handle overlapping vertical references with staggered labels while preserving exact x positions.
- If RSS sigma is zero or the F4 calculation is unavailable, show a compact unavailable state instead of invalid SVG geometry.
- Checkbox state is local display state and does not affect calculations.

## Architecture

- Add a focused `ResponseDistributionCurve.vue` presentation component.
- Add a pure `response-distribution-plot.ts` model builder for domain, curve path, ticks, and references.
- Pass the existing `KernelCalculationResult` from `FactorInputTable.vue`; do not duplicate tolerance calculations in the component.
- Add component/model tests for reference values, defaults, toggles, reactive updates, zero sigma, and narrow rendering.

## Accessibility

- SVG uses a title and description containing Mean, sigma, LSL, and USL.
- Checkboxes have explicit labels and remain keyboard accessible.
- Line meaning is represented by labels and dash patterns, not color alone.

## Acceptance Criteria

1. The chart appears immediately below Response Summary Table when F4 calculation data is available.
2. Its Mean, sigma, LSL, USL, Target, and sigma references match the current calculation result.
3. Factor Setup and Additional Mean Shift changes update the chart without regeneration.
4. 4sigma and 6sigma are visible by default; 3sigma and 4.5sigma can be enabled.
5. The chart remains readable on desktop and mobile without text overlap or horizontal page overflow.
6. Existing Factor Setup, Dimension Chain, and F4 calculation behavior remains unchanged.
