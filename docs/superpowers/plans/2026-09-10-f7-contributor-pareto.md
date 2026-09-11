# F7 Contributor Pareto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every Factor contribution in descending priority order as an accessible Pareto chart.

**Architecture:** Extend the existing interpretation view model with sorted contributor rows and cumulative percentages. Render those rows in a focused Vue component used only by the contributor-concentration root-cause item.

**Tech Stack:** Vue 3, TypeScript, SVG, Vitest, Vue Test Utils

---

### Task 1: Contributor Ranking View Model

**Files:**
- Modify: `apps/f7-web/src/assumption-results-interpretation.ts`
- Test: `apps/f7-web/src/assumption-results-interpretation.test.ts`

- [ ] Add a failing test for all contributors sorted descending with cumulative percentages.
- [ ] Run the focused test and confirm the expected failure.
- [ ] Add the minimal ranked contributor view model.
- [ ] Run the focused test and confirm it passes.

### Task 2: Pareto Component

**Files:**
- Create: `apps/f7-web/src/components/ContributorParetoChart.vue`
- Create: `apps/f7-web/src/components/ContributorParetoChart.test.ts`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [ ] Add failing tests for bar order, cumulative line, exact percentages, and accessible labels.
- [ ] Run focused tests and confirm the expected failures.
- [ ] Implement the SVG Pareto chart and integrate it into the concentration item.
- [ ] Run focused tests and confirm they pass.

### Task 3: Regression and Browser Validation

- [ ] Run the complete F7 Vitest project.
- [ ] Run the F7 production build and focused ESLint.
- [ ] Verify desktop and mobile layout in the shared live-workbook page.
