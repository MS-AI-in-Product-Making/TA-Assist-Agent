# F7 Monte Carlo Factor Contribution Design

## Goal

After Step 3 completes, show each participating Factor's contribution based on the distribution actually used by Monte Carlo, alongside the existing Setup contribution and a percentage-point delta.

## Calculation

For the independent linear stack, the governed method is `F7_INDEPENDENT_VARIANCE_CONTRIBUTION_V1`:

```text
effectiveCoefficient = coefficient === 0 ? 1 : coefficient
weightedVariance[i] = (effectiveCoefficient * distributionStandardDeviation[i]) ^ 2
contribution[i] = weightedVariance[i] / sum(weightedVariance)
deltaPercentagePoints[i] = 100 * (contribution[i] - setupContribution[i])
```

Distribution standard deviations are derived analytically from the exact sampler parameters:

- Normal: `standardDeviation`
- Uniform: `(maximum - minimum) / sqrt(12)`
- Lognormal: `sqrt((exp(s^2) - 1) * exp(2 * mu + s^2))`
- Gamma: `sqrt(shape) * scale`
- Weibull: `scale * sqrt(Gamma(1 + 2 / shape) - Gamma(1 + 1 / shape)^2)`

Location parameters do not affect variance. When total weighted variance is zero, every contribution is zero. Invalid or non-finite derived values fail closed.

## Contract And Ownership

`packages/f7-simulation` owns the calculation and returns one immutable entry per manifest Factor for every new run. `packages/contracts` accepts legacy snapshots without this extension; when the extension is present, it validates finite non-negative values, unique Factor IDs, manifest alignment, each derived weighted variance, and normalized contribution values. The session service stores and transports the result without recomputing it.

Each entry contains Factor ID, source mode, distribution family, loop coefficient, distribution standard deviation, weighted variance, contribution fraction, and method ID. This preserves whether the result is measurement-driven (`MEASURED`) or assumption-driven (`BASELINE_ASSUMPTION`).

## User Interface

Actual Distribution is available as soon as Step 2 confirms the measured distribution. The Factor table reads it from `factor.distributionApproval.family`, displays it in the measured comparison row beneath Setup Distribution, and highlights the Actual value in red when the families differ. It does not wait for or infer this value from a Step 3 Monte Carlo result.

The existing Setup `% Cont. to sigma` remains unchanged. Once Monte Carlo results exist, the same cell also shows:

```text
MC Actual (Measured) 30.76%
Delta +23.07 pp
```

Baseline Factors use `MC Actual (Baseline)`. Delta is always MC contribution minus Setup contribution in percentage points. Before a run, no MC comparison is shown.

## Reporting

The governed simulation payload carries Factor contributions. Existing report manifest matching remains authoritative; report projection must preserve or explicitly validate the new contribution data without changing current PDF presentation in this feature.

## Verification

Tests cover all supported distribution variance formulas, neutral coefficient handling, normalization, zero variance, contract rejection, session persistence, UI source labels, and percentage-point deltas. Relevant contract, simulation, API, and Web suites plus lint/type checks must pass.