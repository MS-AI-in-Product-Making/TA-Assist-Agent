# F7 Model Selection Governance Design

## Scope

This design replaces single-winner distribution selection with auditable model comparison and then adds distribution-sensitive Monte Carlo as a separate, sequential subsystem. It does not relabel the current lowest-AICc candidate as Normal without recalculation.

## Subproject A: Distribution Fit Governance

### Model Specifications And MLE

Each fitted candidate carries an explicit model specification:

- Normal: mean and standard deviation fitted by MLE, `k=2`, location fitted.
- Lognormal: log mean and log standard deviation fitted by MLE, original-scale location fixed at zero, `k=2`; original-scale median is `exp(logMean)`, scale is `exp(logMean)`, and shape is `logStandardDeviation`.
- Weibull: shape and scale fitted by MLE, location fixed at zero, `k=2`.
- Gamma: shape and scale fitted by MLE, location fixed at zero, `k=2`.
- Uniform: minimum and maximum fitted by boundary MLE, `k=2`.

The parameter-count utility supports free-location specifications (`k=3`) so future three-parameter Lognormal, Weibull, and Gamma candidates cannot silently reuse `k=2`. The initial governed candidate set remains fixed-location because free-location fitting is not currently implemented or validated.

### Information Criteria

For every candidate:

$$AIC=2k-2\ell$$

$$AICc=AIC+\frac{2k(k+1)}{n-k-1}$$

$$BIC=k\ln(n)-2\ell$$

The result stores AIC, AICc, BIC, delta AICc, and delta BIC. Deltas are calculated only after all successful candidates are collected.

### Parametric Bootstrap GOF

The governed bootstrap uses Anderson-Darling with 10,000 replicates. Every replicate:

1. samples `n` observations from the candidate's fitted model;
2. refits the same model family;
3. calculates AD against the refitted model;
4. counts the replicate when `AD_bootstrap >= AD_observed`.

The p-value is `(extremeCount + 1) / (B + 1)`. Results include the unrounded number, extreme count, B, seed, stream digest, statistic ID, comparison direction, refit flag, and Wilson 95% confidence interval. Candidate substreams remain deterministic and family/replicate scoped.

### Selection Decision

Only bootstrap-acceptable candidates participate in relative support comparison.

- `deltaAicc <= 2`: competitive/statistically indistinguishable. The cutoff is strict; any positive exceedance is outside the competitive set.
- `2 < deltaAicc <= 4`: some evidence against.
- `4 < deltaAicc <= 10`: substantially less support.
- `deltaAicc > 10`: weak support.

When two or more acceptable candidates have `deltaAicc <= 2`, the result is `NO_UNIQUE_PREFERENCE`; no candidate is labeled Recommended. The lowest candidate is labeled `NUMERICALLY_LOWEST_AICC` only.

For dimensional characteristics, Normal becomes `ENGINEERING_DEFAULT` when it is competitive, sample skewness is small, mean and median are close, coefficient of variation is small, and Normal Q-Q curvature is not materially systematic. Positive values alone never select Lognormal. Other competitive models are `PLAUSIBLE_ALTERNATIVE`.

When `n < 50`, results include `SMALL_SAMPLE_UNCERTAINTY`. If multiple models are competitive, selection confidence is `LOW`. Conclusions use compatibility language rather than asserting that data follow a distribution.

The decision also carries a single `proposedFinalFamily` for the downstream engineering workflow. This field is distinct from statistical preference and is derived deterministically:

1. If Normal is bootstrap-acceptable and competitive (`deltaAicc <= 2` from the acceptable minimum), propose Normal as the engineering choice.
2. Otherwise, propose the bootstrap-acceptable numeric-best family.
3. If candidate fitting is incomplete or no model is bootstrap-acceptable, withhold the proposal.

When acceptable candidates have exactly equal AICc, numeric-best tie-breaking follows the governed family precedence Normal, Lognormal, Weibull, Gamma, then Uniform. This tie-break only makes the downstream proposal deterministic; it does not change `NO_UNIQUE_PREFERENCE` or erase the competitive set.

The Web sorts `proposedFinalFamily` first and highlights it as `Proposed final selection`, while preserving the original AIC/AICc/delta evidence and separate numeric-best label. An engineer must explicitly confirm this proposal before Monte Carlo uses it; display order is never treated as approval.

### Contract And UI

The API returns candidate model specification, information criteria, bootstrap audit evidence, sample diagnostics, and a structured selection decision. The table displays `k`, location policy, parameterization, AIC, delta AICc, delta BIC, GOF method, B, CI, and objective status labels. It sorts and highlights the proposed final family without hiding statistical ties. The conclusion is generated from the structured decision, not from table order.

Each fitted-distribution plot uses an observed-frequency histogram. Bin counts follow the Sturges rule, remain bounded to the observed sample range, and sum to the sample size; the fitted PDF is scaled by `sampleSize * binWidth` to show expected frequency on the same axis. The Y axis uses integer `Frequency (pcs)` ticks and horizontal grid lines. X-axis labels use the decimal precision of LSL and USL while the display domain expands to include every reference line. All candidate plots for one factor share the same engineering reference values: LSL and USL from factor evidence, Target derived as `(LSL + USL) / 2`, sample mean, and sample mean plus/minus 3 and 4 sample standard deviations. Sample standard deviation uses the observed values and the `n - 1` denominator, and the legend identifies Target as midpoint-derived so it is not mistaken for a separately supplied workbook nominal value.

Reference-line labels use collision-aware rows based on their rendered X positions. Labels closer than 48 plot pixels occupy different rows, use an 11 px semibold font with an opaque plot-background backing, and reference lines begin below the label band. The SVG remains at its native 800 px width instead of being continuously scaled; narrower containers scroll the plot locally. The caption separates distribution/sample information from engineering reference values so long numeric labels do not compete in one line.

## Subproject B: Distribution-Sensitive Monte Carlo

Monte Carlo remains a distinct Phase 3 engine with explicit engineer approval. When a measured factor has multiple competitive models, sensitivity runs use Normal and the lowest-AICc non-Normal competitive candidate. Each seeded run compares mean, standard deviation, P0.135, P1, P5, P50, P95, P99, P99.865, yield, out-of-spec probability, PPM, and tail probability.

The engine reports `DISTRIBUTION_SENSITIVE` only when configured engineering tolerances for yield, PPM, or tail quantiles are crossed; otherwise it reports `LIMITED_ENGINEERING_IMPACT`. This subsystem requires the existing Phase 3 worker, approval, independence, convergence, and simulation-manifest contracts and must not be simulated by UI-only calculations.

## Verification

Subproject A includes formula, parameter-count, known-Normal, skewed-Lognormal, near-tie, bootstrap direction/refit/seed/precision, contract, service, API, and UI tests. Subproject B has separate deterministic simulation, dual-model sensitivity, yield/PPM/quantile, convergence, and route/UI tests.
