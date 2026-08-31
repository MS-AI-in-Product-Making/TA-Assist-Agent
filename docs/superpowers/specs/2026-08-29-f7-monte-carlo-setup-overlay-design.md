# F7 Monte Carlo Factor Setup Overlay Design

## Goal

Overlay the governed Factor Setup system-response Normal curve on the Monte Carlo output chart so users can compare center shift and spread directly.

## Data Governance

The Factor Setup comparison uses only confirmed session evidence:

- Setup mean: sum of each confirmed Factor `evidence.calculatedMean` plus the available `systemSpecification.additionalMeanShift`, defaulting the shift to zero only when the governed evidence marks it as defaulted.
- Setup standard deviation: root-sum-square of each confirmed Factor `evidence.oneSigma`.
- Monte Carlo mean and standard deviation: unchanged values from `monteCarloResult`.

If any Factor evidence is absent, a required value is non-finite, the setup standard deviation is not positive, or Additional Mean Shift is unavailable without a governed default, the setup comparison is unavailable and no setup curve or unsupported comparison is shown.

## Chart

Keep the existing observed histogram, specification coloring, Monte Carlo moment-fitted Normal curve, LSL, USL, Target, Monte Carlo Mean, and target-sigma references.

Add:

- An orange dashed `Factor Setup TA Normal expected count` curve.
- A separate orange `Setup Mean` reference line.
- A legend entry for the setup curve and setup mean.

The setup probability density is integrated over each existing histogram bin and multiplied by the Monte Carlo iteration count. This produces expected counts on the same Y-axis as the histogram and Monte Carlo expected-count curve. The shared X-axis domain includes the setup mean and at least the setup mean plus or minus six setup standard deviations so a materially shifted or wider setup curve is not clipped.

## Comparison Metrics

Below the chart, render one compact comparison band containing:

- Mean: Factor Setup, Monte Carlo, and signed delta (`Monte Carlo - Setup`).
- Standard deviation: Factor Setup RSS sigma, Monte Carlo standard deviation, and relative change.
- Interpretation: left/right/no displayed mean shift and wider/narrower/no displayed spread change.

These statements are factual comparisons, not F0 governed recommendations.

## Responsive And Accessibility

The existing horizontally scrollable chart viewport remains. The new curve and mean line receive stable data attributes, SVG title/description coverage, and text legend entries. The metric band stacks on narrow screens without page-level horizontal overflow.

## Testing

- Unit-test confirmed setup summary calculation, invalid/unavailable inputs, expected-count conversion, domain expansion, and finite extreme geometry.
- Component-test curve, mean reference, legend, metric delta, interpretation, and unavailable state.
- App-test the completed Monte Carlo workflow with confirmed Factor Setup evidence.
- Verify desktop and narrow browser rendering with a real workbook session.
