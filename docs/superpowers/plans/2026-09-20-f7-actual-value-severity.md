# F7 Actual Value Severity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply three-level, risk-direction-aware severity colors to measured Actual values in the Factor comparison row.

**Architecture:** Add a pure Web utility that converts Setup and Actual values into `normal`, `attention`, or `critical`, with direction rules per metric. Keep statistical calculations and Delta values unchanged; the Vue table only maps existing values to classes and accessible metadata.

**Tech Stack:** TypeScript, Vue 3, Vitest, Vue Test Utils, CSS

---

### Task 1: Pure Severity Classification

**Files:**
- Create: `apps/f7-web/src/actual-value-severity.ts`
- Create: `apps/f7-web/src/actual-value-severity.test.ts`

- [ ] **Step 1: Write failing threshold and direction tests**

Test `classifyActualValueSeverity` at 5%, above 5%, 15%, and above 15%. Cover Mean absolute-magnitude movement, Tolerance/1 Sigma/Contribution increases only, Cpk decreases only, zero Mean fallback to tolerance, zero-without-fallback behavior, and unavailable values. Test `classifyDistributionSeverity` for matching and mismatching families.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx.cmd vitest run apps/f7-web/src/actual-value-severity.test.ts`
Expected: FAIL because the utility module is absent.

- [ ] **Step 3: Implement the pure classifier**

Export `ActualValueSeverity`, `ActualValueMetric`, `ActualValueSeverityResult`, `classifyActualValueSeverity`, and `classifyDistributionSeverity`. Return both severity and adverse percentage for accessible UI metadata. Use unrounded values and inclusive normal/attention boundaries.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx.cmd vitest run apps/f7-web/src/actual-value-severity.test.ts`
Expected: all severity tests pass.

### Task 2: Factor Table Rendering

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/components/FactorInputTable.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] **Step 1: Write failing component tests**

Assert that each Actual value has `data-actual-severity`, the correct severity class, and a percentage-bearing title. Assert `Actual` labels and Delta rows do not receive severity classes. Cover Distribution mismatch as critical and a small numeric difference as normal.

- [ ] **Step 2: Run the focused component tests and verify RED**

Run: `npx.cmd vitest run apps/f7-web/src/components/FactorInputTable.test.ts -t "Actual value severity"`
Expected: FAIL because the value spans and severity metadata are absent.

- [ ] **Step 3: Render value-only severity styling**

Import the pure classifier, map Mean/Tolerance/1 Sigma/Cpk/Contribution to existing Setup and Actual values, and wrap only rendered Actual values in a severity span. Keep all Delta formatting unchanged. Add `--attention`, `.actual-value-severity-attention`, and `.actual-value-severity-critical`, with normal inheriting the existing text color.

- [ ] **Step 4: Run component and app regression tests**

Run: `npx.cmd vitest run apps/f7-web/src/actual-value-severity.test.ts apps/f7-web/src/components/FactorInputTable.test.ts apps/f7-web/src/App.test.ts`
Expected: all tests pass.

### Task 3: Static Verification

**Files:**
- Verify all files modified by Tasks 1 and 2.

- [ ] **Step 1: Run diagnostics and lint**

Run: `npx.cmd eslint apps/f7-web/src/actual-value-severity.ts apps/f7-web/src/actual-value-severity.test.ts apps/f7-web/src/components/FactorInputTable.vue apps/f7-web/src/components/FactorInputTable.test.ts`
Expected: zero errors; existing Vue formatting warnings may remain.

- [ ] **Step 2: Check repository diff**

Run: `git diff --check`
Expected: no whitespace errors and no temporary F7 data included.
