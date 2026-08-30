# F7 Monte Carlo Factor Setup Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed Factor Setup TA expected-count curve and center/spread comparison to the Monte Carlo result chart.

**Architecture:** A pure setup-summary adapter derives system mean and RSS sigma from confirmed session evidence. The pure Monte Carlo plot builder converts the Setup Normal distribution into bin expected counts and includes its support in the shared domain. Vue components only render the resulting model and factual comparison.

**Tech Stack:** Vue 3, TypeScript, SVG, Vitest, Vue Test Utils, Vite

---

### Task 1: Pure Factor Setup Comparison Model

**Files:**
- Create: `apps/f7-web/src/monte-carlo-setup-comparison.ts`
- Create: `apps/f7-web/src/monte-carlo-setup-comparison.test.ts`
- Modify: `apps/f7-web/src/monte-carlo-plot.ts`
- Modify: `apps/f7-web/src/monte-carlo-plot.test.ts`

- [ ] Write failing tests that derive setup mean from confirmed `calculatedMean` values plus Additional Mean Shift and setup sigma from RSS `oneSigma` values.
- [ ] Add unavailable tests for missing evidence, non-finite values, non-positive RSS sigma, and unavailable shift evidence.
- [ ] Write failing plot tests for setup expected counts, setup curve path, Setup Mean reference, domain expansion through setup plus/minus six sigma, and finite geometry.
- [ ] Run focused tests and confirm failures are caused by missing behavior.
- [ ] Implement the pure setup-summary and comparison formatter.
- [ ] Extend `buildMonteCarloPlot` with optional setup mean/sigma and iteration count; calculate Normal bin probability using the standard Normal CDF difference, then scale by iterations.
- [ ] Run focused tests, Vue typecheck, and focused ESLint.

### Task 2: Monte Carlo Chart Integration

**Files:**
- Modify: `apps/f7-web/src/components/MonteCarloHistogram.vue`
- Modify: `apps/f7-web/src/components/MonteCarloPanel.vue`
- Modify: `apps/f7-web/src/style.css`
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] Write failing component/App assertions for the orange dashed setup curve, Setup Mean reference, chart legend, mean/std comparison, factual interpretation, and unavailable state.
- [ ] Run focused tests and confirm the new assertions fail.
- [ ] Pass the session-derived setup summary from `MonteCarloPanel` to `MonteCarloHistogram`.
- [ ] Render both curves and both mean references on the same axes without changing existing histogram or Monte Carlo statistics.
- [ ] Add the compact three-part comparison band and narrow-screen stacking styles.
- [ ] Update SVG title/description and stable data attributes.
- [ ] Run App tests, pure plot tests, Vue typecheck, focused ESLint, production build, and `git diff --check` scoped to touched files.

### Task 3: Browser Validation

**Files:** None

- [ ] Use a real workbook to reach a completed Monte Carlo result.
- [ ] Confirm both curves, both mean references, comparison metrics, and factual interpretation render.
- [ ] Verify curve SVG paths are nonblank and distinct when Setup and Monte Carlo differ.
- [ ] Check desktop and 390px viewport geometry for overlap, clipping, and page-level horizontal overflow.
