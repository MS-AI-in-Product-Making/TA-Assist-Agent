# F7 TA Result Summary List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present six F7 engineering comparisons and an overall governed assessment without duplicate reference-only metrics.

**Architecture:** Add a pure F7 Web summary builder that owns metric comparison formulas and display strings. Feed it existing RSS calculation outputs inside `buildAssumptionResultsInterpretation`, then let `TAResultsInterpretation.vue` render only the resulting rows and governed overall judgment.

**Tech Stack:** TypeScript, Vue 3, Vitest, Vue Test Utils, existing F7 calculation and narrative formatters.

---

### Task 1: Extend the pure result-summary builder

**Files:**
- Create: `apps/f7-web/src/ta-result-summary.ts`
- Create: `apps/f7-web/src/ta-result-summary.test.ts`

- [x] **Step 1: Write failing tests for all six rows**

Cover fixed row order, Lower/Upper Cpk target margins, and all six comparison rows.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run apps/f7-web/src/ta-result-summary.test.ts`

Expected: FAIL because `buildTaResultSummary` does not exist.

- [x] **Step 3: Implement the minimal pure builder**

Extend the input with `lowerCpk` and `upperCpk`, then insert their comparison rows after Cpk.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run apps/f7-web/src/ta-result-summary.test.ts`

Expected: PASS.

### Task 2: Connect the summary to assumption interpretation

**Files:**
- Modify: `apps/f7-web/src/assumption-results-interpretation.ts`
- Modify: `apps/f7-web/src/assumption-results-interpretation.test.ts`

- [x] **Step 1: Write a failing integration assertion**

Assert that an available interpretation exposes `resultSummary` with keys `mean`, `standard-deviation`, `cp`, `cpk`, `lower-cpk`, and `upper-cpk`, while an unavailable interpretation remains unchanged.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run apps/f7-web/src/assumption-results-interpretation.test.ts`

Expected: FAIL because `resultSummary` is missing.

- [x] **Step 3: Add the view-model field and builder call**

Pass `calculation.capability.lowerCpk` and `calculation.capability.upperCpk` into the existing summary builder after governed rule validation succeeds.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run: `npx vitest run apps/f7-web/src/ta-result-summary.test.ts apps/f7-web/src/assumption-results-interpretation.test.ts`

Expected: PASS.

### Task 3: Replace the judgment block with the result table

**Files:**
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [x] **Step 1: Write failing component assertions**

Assert the six column headers, six data rows in fixed order, overall governed judgment, status badge, and preservation of downstream narrative section order.

- [x] **Step 2: Run the focused component test and verify RED**

Run: `npx vitest run apps/f7-web/src/components/TAResultsInterpretation.test.ts`

Expected: FAIL because the summary table is not rendered.

- [x] **Step 3: Implement the accessible responsive table**

Render the six comparison rows in one semantic `tbody`, retain text status labels, and preserve the existing responsive mobile information-block layout.

- [x] **Step 4: Run focused tests and build**

Run: `npx vitest run apps/f7-web/src/ta-result-summary.test.ts apps/f7-web/src/assumption-results-interpretation.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts`

Expected: PASS.

Run: `npm run build:f7:web`

Expected: PASS.

### Task 4: Browser verification

**Files:**
- Store artifacts only under: `local-test/F7_Test_Finetune_05/`

- [x] **Step 1: Refresh the running F7 UI with an existing local test session**

Verify the table appears in place of the previous judgment block and downstream narrative remains visible.

- [x] **Step 2: Check desktop and narrow layouts**

Verify no text overlap, horizontal table access on narrow width, visible assessment labels, and no console or failed-request errors. Save screenshots only under the ignored local test directory.

- [x] **Step 3: Confirm repository scope**

Run: `git status --short`

Expected: only the approved design/plan documents and `apps/f7-web` source/test changes; no local test artifacts.

### Task 5: Add governed performance context

**Files:**
- Modify: `apps/f7-web/src/ta-result-summary.ts`
- Modify: `apps/f7-web/src/ta-result-summary.test.ts`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [x] **Step 1: Write failing builder tests for explanatory context**

Assert Mean offset percentage and direction, Standard Deviation maximum-use percentage with overage or margin, and target achievement with shortfall or surplus for all four capability rows. Assert the non-positive sigma allowance fallback without dividing by zero.

- [x] **Step 2: Run focused builder tests and verify RED**

Run: `npx vitest run --project f7-web apps/f7-web/src/ta-result-summary.test.ts`

Expected: FAIL because summary rows do not expose `performanceContext`.

- [x] **Step 3: Implement performance context in the pure builder**

Add required `performanceContext: string` to `TaResultSummaryRow`. Calculate percentages from existing inputs with the F7 formatter and keep F0 grades limited to the existing Assessment values.

- [x] **Step 4: Run focused builder tests and verify GREEN**

Run: `npx vitest run --project f7-web apps/f7-web/src/ta-result-summary.test.ts`

Expected: PASS.

- [x] **Step 5: Write failing component tests for the sixth column**

Assert `Performance Context` follows `Assessment` and every comparison row renders its context.

- [x] **Step 6: Render and style the sixth column**

Render `row.performanceContext` with `data-label="Performance Context"`; set the separator `colspan` to six and preserve the mobile information-block layout with wrapped context text.

- [x] **Step 7: Verify implementation and browser layouts**

Run the focused tests, complete F7 Web test project, production build, ESLint, desktop browser check, and 390 px mobile browser check. Store temporary artifacts only under `local-test/F7_Test_Finetune_05/`.

### Task 6: Remove duplicate reference information

**Files:**
- Modify: `apps/f7-web/src/ta-result-summary.ts`
- Modify: `apps/f7-web/src/ta-result-summary.test.ts`
- Modify: `apps/f7-web/src/assumption-results-interpretation.ts`
- Modify: `apps/f7-web/src/assumption-results-interpretation.test.ts`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [x] **Step 1: Write failing tests for a comparison-only summary**

Assert exactly six summary rows and verify that no Reference Information separator or reference row group is rendered.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run --project f7-web apps/f7-web/src/ta-result-summary.test.ts apps/f7-web/src/assumption-results-interpretation.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts`

Expected: FAIL because the builder and component still include four reference rows.

- [x] **Step 3: Remove reference rows and their rendering path**

Remove LSL, USL, Yield, and DPM summary keys and rows. Retain LSL and USL only as inputs to the Standard Deviation comparison formula. Remove the separate reference `tbody`, separator markup, and reference-only styles. Remove unused Yield and DPM summary inputs.

- [x] **Step 4: Run focused tests and verify GREEN**

Run the three focused test files and expect all tests to pass.

- [x] **Step 5: Run full validation and browser checks**

Run the complete F7 Web tests, production build, ESLint, diagnostics, and desktop/mobile browser checks. Confirm that the result summary contains exactly six rows and no Reference Information text.

### Task 7: Make the overall assessment fact-first

**Files:**
- Modify: `apps/f7-web/src/ta-result-summary.ts`
- Modify: `apps/f7-web/src/ta-result-summary.test.ts`
- Modify: `apps/f7-web/src/assumption-results-interpretation.ts`
- Modify: `apps/f7-web/src/assumption-results-interpretation.test.ts`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [x] **Step 1: Write failing pure-builder and component tests**

Assert that the assessment begins with governed `Pass` or `Fail`, then states Mean direction, Standard Deviation status, Cpk versus target, and the insufficient lower, upper, or both capability sides. Assert that the component renders this concise assessment instead of the longer governed judgment.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run --project f7-web apps/f7-web/src/ta-result-summary.test.ts apps/f7-web/src/assumption-results-interpretation.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts`

Expected: FAIL because no dedicated overall assessment exists.

- [x] **Step 3: Implement the deterministic assessment builder**

Add a pure builder using the same summary inputs and existing F7 formatter. Use the governed Cpk status for `Pass` or `Fail`; compare Lower Cpk and Upper Cpk independently with the resolved target; do not add Root Cause hypotheses.

- [x] **Step 4: Connect and render the assessment**

Expose `overallAssessment` on available interpretations and render it in the existing Overall assessment line. Keep the top governed status badge and downstream Root Cause Analysis unchanged.

- [x] **Step 5: Run full validation and browser checks**

Run focused and complete F7 Web tests, production build, ESLint, diagnostics, and desktop/mobile browser checks. Confirm the sentence is concise, fact-first, and does not duplicate Root Cause content.

### Task 8: Remove the redundant Engineering Summary section

**Files:**
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [x] **Step 1: Write and run a failing component test**

Assert that neither the Engineering Summary heading nor its section marker is rendered, while Root Cause Analysis remains in the narrative flow.

- [x] **Step 2: Remove the presentation-only section**

Remove the Engineering Summary section from `TAResultsInterpretation.vue`. Retain the underlying narrative field for other consumers.

- [x] **Step 3: Run full validation and browser checks**

Run focused and complete F7 Web tests, production build, ESLint, diagnostics, and desktop/mobile browser checks. Confirm Root Cause Analysis follows the result summary directly.