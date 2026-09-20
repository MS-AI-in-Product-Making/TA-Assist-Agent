# F7 Monte Carlo Factor Contribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calculate and display governed per-Factor Monte Carlo contribution and its percentage-point difference from Setup contribution.

**Architecture:** Extend the strict result contract, calculate analytical independent variance shares in the simulation package, let the API snapshot transport them, and render the comparison in the existing Factor table. No UI-side statistical calculation is introduced.

**Tech Stack:** TypeScript, Zod, Vue 3, Vitest, Vue Test Utils

---

### Task 1: Governed Result Contract

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Test: `packages/contracts/src/f7-monte-carlo-contracts.test.ts`

- [ ] Add a failing parse test for `factorContributions`, including uniqueness, manifest alignment, non-negative finite values, normalized positive variance, and legacy snapshot compatibility.
- [ ] Run `npx vitest run packages/contracts/src/f7-monte-carlo-contracts.test.ts` and confirm failure because the field is absent.
- [ ] Add `F7_INDEPENDENT_VARIANCE_CONTRIBUTION_V1` entry and result schemas with cross-field refinements.
- [ ] Rerun the focused contract test and confirm it passes.

### Task 2: Simulation Calculation

**Files:**
- Modify: `packages/f7-simulation/src/simulation.ts`
- Test: `packages/f7-simulation/src/simulation.test.ts`

- [ ] Add failing tests for Normal, Uniform, Lognormal, Gamma, Weibull, neutral coefficients, normalization, and zero total variance.
- [ ] Run `npx vitest run packages/f7-simulation/src/simulation.test.ts` and confirm the missing result fails.
- [ ] Implement analytical standard deviations and independent weighted-variance shares, including a stable log-gamma helper for Weibull moments.
- [ ] Rerun the simulation test and confirm it passes.

### Task 3: Strict Fixture And API Propagation

**Files:**
- Modify matching Monte Carlo fixtures in `packages/contracts`, `apps/f7-local-api`, and `apps/f7-web` tests.
- Test: `apps/f7-local-api/src/f7-session-service.test.ts`

- [ ] Add a failing session assertion that stored contributions match simulation inputs and sources.
- [ ] Update strict fixtures with valid contribution arrays and preserve report manifest validation.
- [ ] Run the focused session and report tests and confirm they pass.

### Task 4: Factor Table Comparison

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Test: `apps/f7-web/src/components/FactorInputTable.test.ts`

- [ ] Add failing rendering tests for Measured and Baseline MC values, hidden pre-run state, and signed percentage-point delta.
- [ ] Map contributions by Factor ID and render `MC Actual (Measured|Baseline)` plus `Delta +/-x.xx pp` below Setup contribution.
- [ ] Run `npx vitest run apps/f7-web/src/components/FactorInputTable.test.ts` and confirm it passes.
- [ ] Add a failing rendering test proving an approved Step 2 `distributionApproval.family` appears before any Monte Carlo result, with mismatch styling based on the Setup distribution.
- [ ] Read Actual Distribution from `distributionApproval.family`; keep Contribution sourced only from the Step 3 Monte Carlo result.

### Task 5: Integrated Verification

**Files:**
- Verify all touched files.

- [ ] Run focused contract, simulation, API, report, and Web tests.
- [ ] Run ESLint and TypeScript build checks for touched workspaces.
- [ ] Start or refresh F7 Web and verify Step 3 output in the browser at desktop and narrow viewport.
- [ ] Inspect `git diff --check` and confirm no unintended files or temporary F7 data are included.