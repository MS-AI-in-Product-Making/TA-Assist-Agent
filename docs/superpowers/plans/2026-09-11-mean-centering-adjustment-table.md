# Mean Centering Adjustment Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the governed mean-centering recommendation as a structured adjustment table with an expected-result panel.

**Architecture:** Extend the existing product-language action with optional structured mean-centering evidence and coordinated display values. Render that evidence in `TAResultsInterpretation.vue` using the existing specification fallback table and outcome styles, without parsing narrative text.

**Tech Stack:** TypeScript, Vue 3, Vitest, Vue Test Utils

---

### Task 1: Expose Structured Mean-Centering Evidence

**Files:**
- Modify: `packages/product-language/src/f7-engineering-narrative.ts`
- Modify: `packages/product-language/src/f7-engineering-narrative.test.ts`

- [ ] Add a failing test asserting that `improvement-center-mean` includes current mean, target mean, required adjustment, direction, and display strings.
- [ ] Run the focused product-language test and confirm RED.
- [ ] Extend `F7NarrativeActionItem` with optional `meanCentering` evidence and populate it from the same display plan used by the narrative.
- [ ] Keep `meanCentering` absent when mean or specification limits are unavailable.
- [ ] Rerun the focused product-language test and confirm GREEN.

### Task 2: Render the Mean Adjustment Table

**Files:**
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [ ] Add a failing component test for the table caption, headers, Mean row, direction, and Expected result panel.
- [ ] Run the focused component test and confirm RED.
- [ ] Add the table beneath the mean-centering feasibility statement, reusing `specification-fallback`, `specification-adjustments-scroll`, and `specification-outcome` styles.
- [ ] Avoid repeating the numeric narrative sentence when structured evidence is present; retain the original narrative when evidence is absent.
- [ ] Rerun focused tests, complete F7 Web tests, product-language tests, build, ESLint, diagnostics, and `git diff --check`.