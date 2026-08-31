# F7 Selected Distribution Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Capability page's full distribution comparison with a selected-distribution summary and place F0-grounded measured-distribution interpretation below it.

**Architecture:** Add a browser-safe F0 distribution-rule module and a pure F7 interpretation adapter. Add a focused `SelectedDistributionSummary.vue` for the Capability page while preserving `DistributionFitAnalysis.vue` for the dedicated audit stage. Move existing Factor guidance below the summary and render distribution guidance after it.

**Tech Stack:** Vue 3, TypeScript, Zod, Vitest, Vue Test Utils, npm workspaces

---

### Task 1: F0 Distribution Interpretation Rules

**Files:**
- Create: `packages/knowledge-base/src/public-distribution-rules.ts`
- Create: `packages/knowledge-base/src/public-distribution-rules.test.ts`
- Create: `packages/knowledge-base/src/public-distribution-rules.type-test.ts`
- Modify: `packages/knowledge-base/package.json`
- Modify: `packages/knowledge-base/tsconfig.type-tests.json`

- [ ] Write failing tests for rule IDs, status mapping, provenance, duplicate rejection, runtime deep immutability, and compile-time readonly behavior.
- [ ] Run the focused tests and confirm failure because the module does not exist.
- [ ] Implement a browser-safe validated frozen rule set for Bootstrap status, confidence, small-sample uncertainty, and compatibility-not-proof.
- [ ] Export the new package subpath and include its type test in the no-emit type-test config.
- [ ] Run focused tests, package build, type tests, and focused ESLint.

### Task 2: Pure Selected Distribution Interpretation

**Files:**
- Create: `apps/f7-web/src/distribution-guidance.ts`
- Create: `apps/f7-web/src/distribution-guidance.test.ts`

- [ ] Write failing tests for approved/proposed family resolution, no-selection behavior, controlled status/confidence/small-sample statements, Setup/Sample center and spread facts, provenance, and unavailable rules.
- [ ] Run the focused tests and confirm failure because the adapter does not exist.
- [ ] Implement pure selected-candidate resolution and distribution interpretation using only the F7 fit result, approval, setup comparison, and F0 rule set.
- [ ] Run focused tests, web typecheck, and focused ESLint.

### Task 3: Capability Selected Distribution Summary

**Files:**
- Create: `apps/f7-web/src/components/SelectedDistributionSummary.vue`
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Modify: `apps/f7-web/src/style.css`
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] Replace the embedded complete-table assertions with failing assertions for exactly one selected family, key metrics, an always-visible plot, and no candidate table/Q-Q/other-family content.
- [ ] Add failing assertions that the dedicated Distribution stage still renders the complete candidate table and audit conclusion.
- [ ] Implement the selected summary with approved-family precedence, proposed-family fallback, controlled unavailable states, and heading-level approval.
- [ ] Move Factor Capability Guidance below the selected summary and render Measured Distribution Interpretation after it.
- [ ] Run App tests, all F7 web/API tests, web build, focused ESLint, and scoped diff checks.

### Task 4: Browser Validation

**Files:** None

- [ ] Reload the real workbook session and enter Capability Analysis.
- [ ] Confirm only the selected distribution appears in Capability, with no candidate table or other-family content.
- [ ] Confirm the selected plot is visible and the two guidance sections follow Distribution Fit.
- [ ] Confirm the dedicated Distribution Fit stage retains the full comparison.
- [ ] Capture desktop and narrow-viewport screenshots and verify no overlap or clipping.