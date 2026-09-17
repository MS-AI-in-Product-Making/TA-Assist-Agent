# F7 Factor Setup Measured Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Actual / Delta row beneath each ready measured Factor and a Cpk column to the Factor Setup table.

**Architecture:** A pure F7 Web helper derives display-safe measured comparison values from existing accepted observations and Factor evidence. `FactorInputTable` renders the projection without modifying session state, API contracts, or governed calculation code.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils, existing F7 capability and rational-subgroup utilities.

---

### Task 1: Measured Comparison Projection

**Files:**
- Create: `apps/f7-web/src/factor-measured-comparison.ts`
- Create: `apps/f7-web/src/factor-measured-comparison.test.ts`

- [ ] Write tests covering: included observations only; absolute Mean delta; Actual Tolerance as `3 * standardDeviation`; Setup Cpk as `sigmaLevel / 3`; Actual Cpk from Factor LSL/USL; excluded observations; rational subgroup governed sigma; one-observation unavailable metrics; zero-variation unavailable metrics.
- [ ] Run `npx.cmd vitest run apps/f7-web/src/factor-measured-comparison.test.ts` and verify RED because the helper is missing.
- [ ] Implement `buildFactorMeasuredComparison(input)` with explicit setup, limits, structure/config, and observations. Return `undefined` when there are no included finite observations. Return Mean independently and optional variation/Cpk metrics when capability is not ready. Reuse `calculateF7Capability` and `calculateRationalSubgroupStandardDeviation`; do not duplicate Cpk formulas.
- [ ] Rerun the focused test and verify GREEN.

### Task 2: Factor Table Comparison Row

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.test.ts`
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/style.css`
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] Add component tests requiring: Cpk header immediately after 1σ; Setup Cpk=`sigmaLevel/3`; one Actual / Δ row immediately after a ready measured Factor; signed deltas for Mean, ±3σ Tolerance, 1σ, and Cpk; no comparison row for baseline/unready Factors; comparison rows hidden while editing.
- [ ] Run `npx.cmd vitest run apps/f7-web/src/components/FactorInputTable.test.ts -t "measured comparison"` and verify RED.
- [ ] Add a `cpk` base column after `oneSigma`. Build a computed map keyed by stable Factor candidate ID using ready `measurementPasteResult.dataset`, evidence limits, `calculatedValues(factor)`, and setup/evidence sigma level.
- [ ] Convert the body loop to a keyed `<template v-for>`. Keep the existing Setup row unchanged except for its Setup Cpk cell. Add one adjacent comparison row with the same column count; label it `Actual / Δ`, keep non-comparison cells empty, and stack explicit Actual/Δ labels in Mean, Tolerance, 1σ, and Cpk cells.
- [ ] Add quiet neutral row styling, fixed cell layout, nowrap numeric values, and accessible row labeling. Preserve existing table horizontal scrolling.
- [ ] Update CSS source assertions in `App.test.ts` for the new row and metric stack.
- [ ] Rerun the focused component test, then run `npx.cmd vitest run apps/f7-web/src/factor-measured-comparison.test.ts apps/f7-web/src/components/FactorInputTable.test.ts apps/f7-web/src/App.test.ts apps/f7-web/src/measurement-workspace-warnings.test.ts`.
- [ ] Run `npm.cmd run build:f7:web`; distinguish any known unrelated F0/readonly diagnostics from new errors.
- [ ] Check editor diagnostics and verify desktop plus 390 px browser layouts for row alignment, labels, no overlap, and retained horizontal scroll.
