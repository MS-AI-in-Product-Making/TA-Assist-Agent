# F7 Distribution Fit Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a histogram with fitted density curve for every F7 distribution candidate and explain the governed recommendation.

**Architecture:** Put deterministic chart mathematics in a pure TypeScript module and rendering in a focused Vue component. Keep recommendation authority in the API contract; the existing measurement panel only composes plots and explanatory text.

**Tech Stack:** Vue 3, TypeScript, native SVG, Vitest, Vue Test Utils

---

### Task 1: Distribution Plot Model

**Files:**
- Create: `apps/f7-web/src/distribution-fit-plot.ts`
- Create: `apps/f7-web/src/distribution-fit-plot.test.ts`

- [ ] Write tests proving histogram density integrates to one and Normal, Lognormal, Weibull, Gamma, and Uniform PDFs return finite nonnegative values for governed parameter fixtures.
- [ ] Run `npx vitest run apps/f7-web/src/distribution-fit-plot.test.ts` and confirm the missing-module failure.
- [ ] Implement `buildDistributionFitPlot(candidate)` with finite axes, histogram bars, 96 fitted curve points, and SVG-ready coordinates.
- [ ] Rerun the focused test and confirm it passes.

### Task 2: Expandable Candidate Plot

**Files:**
- Create: `apps/f7-web/src/components/DistributionFitPlot.vue`
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] Add a component test that opens the Normal candidate plot and expects histogram bars, a density curve, axes, and an accessible title.
- [ ] Run the focused test and confirm it fails because the plot disclosure does not exist.
- [ ] Add a `Plot` column and a full-width expandable row per candidate using `DistributionFitPlot`.
- [ ] Style the chart as a compact engineering diagnostic with responsive SVG sizing and no nested cards.
- [ ] Rerun the focused test and confirm it passes.

### Task 3: Governed Recommendation Explanation

**Files:**
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] Add a test requiring the conclusion to name the recommended family, list its parameters and diagnostics, and state the lowest-AICc acceptable rule.
- [ ] Run the focused test and confirm the conclusion is absent.
- [ ] Render the conclusion only when `recommendedFamily` resolves to a returned candidate; retain existing withheld states otherwise.
- [ ] Rerun the focused test and confirm it passes.

### Task 4: Full Verification

**Files:**
- Verify: `apps/f7-web/**`

- [ ] Run `npx vitest run apps/f7-web` and expect all files and tests to pass.
- [ ] Run `npm run build:f7:web` and expect `vue-tsc` and Vite to pass.
- [ ] Use the running local application to expand each family plot, verify the conclusion, check browser errors, and capture desktop/mobile screenshots.
- [ ] Run `git diff --check` for all touched files and confirm no whitespace errors.
