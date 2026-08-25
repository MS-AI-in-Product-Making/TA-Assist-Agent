# F7 Model Selection Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace lowest-AICc winner selection with auditable competitive-model governance and then add dual-model Monte Carlo sensitivity.

**Architecture:** The contracts own the audit shape, `f7-statistics` owns MLE/bootstrap/model selection, the local service supplies engineering context and persists results, and the Web renders structured decisions. Monte Carlo is a separate package and route that consumes engineer-approved model decisions rather than implicit recommendations.

**Tech Stack:** TypeScript, Zod, Vitest, Vue 3, deterministic PCG32 bootstrap and simulation

---

### Task 1: Model Specification And Information Criteria

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `packages/contracts/src/f7-contracts.test.ts`
- Modify: `packages/f7-statistics/src/distribution-fit.ts`
- Modify: `packages/f7-statistics/src/distribution-fit.test.ts`

- [ ] Add failing tests for fixed/free location parameter counts and hand-calculated AIC/AICc/BIC.
- [ ] Add model specification, `parameterCount`, AIC, delta AICc, and delta BIC contract fields.
- [ ] Replace global parameter-count use with candidate model specification.
- [ ] Calculate deltas after successful candidate collection and verify minimum deltas are zero.

### Task 2: Bootstrap Audit And Precision

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `packages/f7-statistics/src/distribution-fit.ts`
- Modify: `packages/f7-statistics/src/distribution-fit.test.ts`

- [ ] Add failing tests for 10,000 replicates, AD comparison direction, per-replicate refit, deterministic same seed, differing streams for different seeds, and p-value precision.
- [ ] Add GOF statistic ID, observed statistic, comparison direction, refit flag, extreme count, Wilson 95% CI, and raw p-value audit fields.
- [ ] Update bootstrap method/version IDs and contract grid validation for 10,001.
- [ ] Confirm high p-values remain traceable and are not converted from booleans.

### Task 3: Competitive Model Selection

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `packages/f7-statistics/src/distribution-fit.ts`
- Modify: `packages/f7-statistics/src/distribution-fit.test.ts`

- [ ] Add failing known-Normal, skewed-Lognormal, and low-CV near-tie tests.
- [ ] Add sample mean, median, skewness, coefficient of variation, and Normal Q-Q curvature diagnostics.
- [ ] Replace `recommendedFamily` with a structured selection decision containing competitive families, numeric minimum, engineering default, confidence, uncertainty flags, and reason codes.
- [ ] Preserve recommendation withholding when candidates fail or no candidate is acceptable.

### Task 4: Service And API Propagation

**Files:**
- Modify: `apps/f7-local-api/src/f7-session-service.ts`
- Modify: `apps/f7-local-api/src/f7-session-service.test.ts`
- Modify: `apps/f7-local-api/src/server.test.ts`
- Modify: `apps/f7-web/src/api/f7-client.ts`

- [ ] Add failing tests for dimensional engineering context and exact structured result propagation.
- [ ] Derive characteristic context from factor evidence without treating positivity as multiplicative evidence.
- [ ] Persist and return the expanded result without dropping audit fields.

### Task 5: Governed Comparison UI

**Files:**
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] Add failing UI tests for k, location policy, AIC/deltas, GOF/B/CI, near-tie labels, small-sample warning, LOW confidence, and no unique preference conclusion.
- [ ] Render objective candidate statuses and remove `Recommended` for competitive ties.
- [ ] Generate cautious bilingual-ready conclusion content from structured reason codes.
- [ ] Verify the current 32-point fixture shows Normal engineering default with Lognormal and Gamma alternatives.

### Task 5A: Proposed Final Distribution

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `packages/contracts/src/f7-contracts.test.ts`
- Modify: `packages/f7-statistics/src/distribution-fit.ts`
- Modify: `packages/f7-statistics/src/distribution-fit.test.ts`
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] Add failing selector and contract tests proving Normal is proposed when it is acceptable and within delta AICc 2, numeric best is proposed when Normal is outside that set, and proposal is withheld for failures/no acceptable model.
- [ ] Add `proposedFinalFamily` to the structured selection decision and derive it in `f7-statistics`; do not derive it from UI row order.
- [ ] Add failing UI tests proving the proposed family is first, visibly highlighted, and independently labeled from numeric best and engineering default.
- [ ] Render the proposed final selection first while preserving all candidate statistics and requiring later engineer confirmation before Monte Carlo.
- [ ] Run focused contracts/statistics/Web tests and the Web type/build check.

### Task 5B: Plot Axes And Engineering Reference Lines

**Files:**
- Modify: `apps/f7-web/src/distribution-fit-plot.ts`
- Modify: `apps/f7-web/src/distribution-fit-plot.test.ts`
- Modify: `apps/f7-web/src/components/DistributionFitPlot.vue`
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] Add failing plot-model tests for sample mean/standard deviation, midpoint Target, LSL/USL, plus/minus 3 sigma and 4 sigma, finite Y ticks, and X-domain expansion.
- [ ] Build one shared engineering-reference model from observed values and factor evidence; use sample standard deviation with `n - 1` and do not use fitted-family sigma.
- [ ] Add failing component tests for numeric Y-axis labels/grid lines and eight labeled vertical reference lines with full values.
- [ ] Render reference lines with distinct Spec, Center, 3-sigma, and 4-sigma styles and identify Target as midpoint-derived.
- [ ] Verify desktop/mobile label readability, local table/plot scrolling, browser console, focused tests, and Web type/build checks.

### Task 5C: Frequency Histogram And Specification Precision

**Files:**
- Modify: `apps/f7-web/src/distribution-fit-plot.ts`
- Modify: `apps/f7-web/src/distribution-fit-plot.test.ts`
- Modify: `apps/f7-web/src/components/DistributionFitPlot.vue`
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] Replace density bars with integer observed frequencies and scale the fitted PDF to expected frequency using `sampleSize * binWidth`.
- [ ] Use Sturges binning on the observed range only while preserving the reference-expanded display domain.
- [ ] Render integer `Frequency (pcs)` Y ticks and format X-axis ticks to the LSL/USL decimal precision.
- [ ] Run focused plot/App tests, the full Web suite, Web production build, and desktop/mobile browser checks.

### Task 5D: Collision-Free Plot Typography

**Files:**
- Modify: `apps/f7-web/src/distribution-fit-plot.ts`
- Modify: `apps/f7-web/src/distribution-fit-plot.test.ts`
- Modify: `apps/f7-web/src/components/DistributionFitPlot.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] Add a failing pure-model test proving reference labels within 48 plot pixels are assigned to different rows while distant labels reuse rows.
- [ ] Render collision-aware reference labels with 11 px semibold text, background backings, and lines beginning below the label band.
- [ ] Keep the SVG at its native 800 px width and use plot-local horizontal scrolling in narrower containers.
- [ ] Split the caption into distribution/sample and engineering-reference rows.
- [ ] Run focused tests, full Web tests, production build, and browser overlap/legibility checks at desktop and mobile widths.

### Task 6: Distribution-Sensitive Monte Carlo Contract And Kernel

**Files:**
- Create: `packages/f7-simulation/src/index.ts`
- Create: `packages/f7-simulation/src/simulation.ts`
- Create: `packages/f7-simulation/src/simulation.test.ts`
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `package.json`

- [ ] Add failing deterministic dual-model simulation tests for required quantiles, yield, out-of-spec probability, PPM, and tail probability.
- [ ] Implement seeded Normal and best competitive non-Normal sensitivity runs with explicit approved inputs.
- [ ] Add sensitivity thresholds and `DISTRIBUTION_SENSITIVE | LIMITED_ENGINEERING_IMPACT` verdicts.

### Task 7: Monte Carlo Service, Route, And UI

**Files:**
- Modify: `apps/f7-local-api/src/server.ts`
- Modify: `apps/f7-local-api/src/f7-session-service.ts`
- Modify: `apps/f7-web/src/App.vue`
- Modify: `apps/f7-web/src/api/f7-client.ts`
- Create: `apps/f7-web/src/components/DistributionSensitivityPanel.vue`

- [ ] Add failing route tests for approval, independence, readiness, deterministic run, and blocked invalid states.
- [ ] Add explicit model approval and sensitivity-run routes.
- [ ] Unlock Monte Carlo only after all factors are simulation-ready and selection decisions are approved.
- [ ] Render side-by-side Normal/non-Normal results and bilingual sensitivity verdict.

### Task 8: Final Verification

**Files:**
- Verify: `packages/contracts/**`, `packages/f7-statistics/**`, `packages/f7-simulation/**`, `apps/f7-local-api/**`, `apps/f7-web/**`

- [ ] Run focused package tests after each task.
- [ ] Run repository build, full Vitest suite, lint, and repository verification.
- [ ] Run the current 32-point browser flow and record before/after conclusions.
- [ ] Verify desktop/mobile layout, browser console/network, deterministic seeds, and audit-field traceability.
