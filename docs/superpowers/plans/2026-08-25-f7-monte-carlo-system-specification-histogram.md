# F7 Monte Carlo System Specification and Histogram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prefill editable Step 5 system specifications from the selected Excel worksheet and render an empirical Monte Carlo histogram, moment-fitted Normal curve, and governed process/defect statistics.

**Architecture:** Reuse workbook-catalog's semantic Response Summary extractor when worksheet selection is confirmed. Extend strict F7 contracts before adding deterministic bounded summaries to the simulation kernel, then render those summaries with a focused Vue SVG component. Raw simulation samples remain inside the kernel.

**Tech Stack:** TypeScript, Zod, Vue 3, Vite, Vitest, Vue Test Utils, SVG, Playwright browser tools.

---

## File Structure

- Modify `packages/contracts/src/f7-contracts.ts` and its focused tests for the system specification, target sigma, histogram, fit, capability, and result schemas.
- Modify `apps/f7-local-api/src/f7-session-service.ts` and tests for selected worksheet extraction and target sigma forwarding.
- Modify `packages/f7-simulation/src/simulation.ts` and tests for empirical bins, Normal expected counts, Cp/Cpk, and tail estimates.
- Create `apps/f7-web/src/monte-carlo-plot.ts` and test for pure chart geometry.
- Create `apps/f7-web/src/components/MonteCarloHistogram.vue` for accessible SVG rendering.
- Modify `apps/f7-web/src/components/MonteCarloPanel.vue`, `App.vue`, `App.test.ts`, and `style.css` for editable defaults and results.

### Task 1: Extend Strict F7 Contracts

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Test: `packages/contracts/src/f7-contracts.test.ts`
- Test: `packages/contracts/src/f7-monte-carlo-contracts.test.ts`

- [ ] **Step 1: Write failing contract tests**

Require a session snapshot to preserve an available selected worksheet specification:

```ts
expect(f7SessionSnapshotSchema.parse({
  ...snapshot,
  systemSpecification: {
    status: "available",
    lowerSpecLimit: evidence(-0.15, "Analysis-A!P54"),
    upperSpecLimit: evidence(0.05, "Analysis-A!P55"),
    targetSigmaLevel: evidence(3, "Analysis-A!P56"),
    additionalMeanShift: defaultedEvidence(0),
  },
}).systemSpecification.status).toBe("available");
```

Require `targetSigmaLevel` on the run and result. Add negative tests for non-positive target sigma, histogram counts not summing to iterations, non-contiguous bins, inconsistent Cpk minimum, and target Cpk not equal to target sigma divided by three.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run packages/contracts/src/f7-contracts.test.ts packages/contracts/src/f7-monte-carlo-contracts.test.ts`

Expected: FAIL because strict schemas reject the new fields.

- [ ] **Step 3: Implement minimal schemas**

Import and reuse `worksheetSystemSpecificationSchema`. Add positive target sigma to the request and result. Add strict structures equivalent to:

```ts
histogram: {
  methodId: "F7_HISTOGRAM_FD_V1";
  bins: Array<{ minimum: number; maximum: number; observedCount: number }>;
};
normalFit: {
  methodId: "F7_NORMAL_MOMENT_FIT_V1";
  mean: number;
  standardDeviation: number;
  expectedBinCounts: number[];
};
capability: {
  status: "available" | "not_available";
  cp?: number; lowerCpk?: number; upperCpk?: number; cpk?: number;
  targetCpk: number;
  targetStatus?: "meets_target" | "below_target";
};
normalModel: {
  status: "available" | "not_available";
  lowerTailDpm?: number; upperTailDpm?: number; totalDpm?: number; expectedYield?: number;
};
```

Keep all cross-field checks in `superRefine`; do not loosen existing contracts.

- [ ] **Step 4: Verify GREEN**

Run the command from Step 2. Expected: both files PASS.

### Task 2: Carry Excel Specification into the F7 Session

**Files:**
- Modify: `apps/f7-local-api/src/f7-session-service.ts`
- Test: `apps/f7-local-api/src/f7-session-service.test.ts`

- [ ] **Step 1: Write failing session tests**

Extend the workbook fixture with a Response Summary anchor and LSL/USL/Target Sigma labels. After worksheet confirmation assert:

```ts
expect(confirmed.systemSpecification).toMatchObject({
  status: "available",
  lowerSpecLimit: { actualValue: -0.15, sourceCell: "Anonymous_TA!P54" },
  upperSpecLimit: { actualValue: 0.05, sourceCell: "Anonymous_TA!P55" },
  targetSigmaLevel: { actualValue: 3, sourceCell: "Anonymous_TA!P56" },
});
```

Add a fixture without Response Summary and assert an unavailable reason is preserved instead of invented defaults.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/f7-local-api/src/f7-session-service.test.ts`

Expected: FAIL because snapshots lack `systemSpecification`.

- [ ] **Step 3: Implement semantic extraction**

Use `readOoxmlWorkbook(current.workbookBytes)` and `extractResponseSummarySystemSpecification(extraction.worksheetName, worksheet.cells)` inside `confirmWorksheet`. Store the result on the normalized snapshot. Do not use fixed cell coordinates or expose workbook bytes.

- [ ] **Step 4: Forward target sigma**

Pass `parsedRequest.data.body.targetSigmaLevel` from `runMonteCarlo` into `runF7MonteCarloSimulation`.

- [ ] **Step 5: Verify GREEN**

Run the command from Step 2. Expected: PASS.

### Task 3: Produce Deterministic Histogram and Statistics

**Files:**
- Modify: `packages/f7-simulation/src/simulation.ts`
- Test: `packages/f7-simulation/src/simulation.test.ts`

- [ ] **Step 1: Write failing deterministic summary tests**

Assert equal requests return identical summaries, bin counts sum to iterations, bins are contiguous, and expected Normal counts are finite. Assert formulas directly:

```ts
expect(result.capability.cpk).toBeCloseTo(Math.min(
  (result.mean - request.lowerSpecLimit) / (3 * result.standardDeviation),
  (request.upperSpecLimit - result.mean) / (3 * result.standardDeviation),
));
expect(result.capability.targetCpk).toBe(1);
expect(result.normalModel.totalDpm).toBeCloseTo(
  result.normalModel.lowerTailDpm + result.normalModel.upperTailDpm,
);
```

Run the same seed with target sigma 3 and 4. Assert mean, standard deviation, quantiles, and observed counts are unchanged while target Cpk/status may change.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run packages/f7-simulation/src/simulation.test.ts`

Expected: FAIL because the summary fields do not exist.

- [ ] **Step 3: Implement bounded bins**

After sorting, calculate Q1/Q3 and a Freedman-Diaconis bin count bounded to 20 through 60. Use bounded `ceil(sqrt(n))` when IQR or width is zero. Include the maximum in the final bin and ensure every iteration increments exactly one bin.

- [ ] **Step 4: Implement Normal expected counts**

Use an existing validated probability helper if available; otherwise add a focused deterministic Normal CDF helper with locked reference tests. For each bin compute `n * (CDF(maximum) - CDF(minimum))`. Label this moment fit, never goodness-of-fit acceptance.

- [ ] **Step 5: Implement capability and tail summaries**

For positive sample standard deviation calculate Cp/Cpk and Normal tail estimates. For zero variance return `not_available` with reason `zero_variance`.

- [ ] **Step 6: Verify GREEN**

Run:

`npx vitest run packages/contracts/src/f7-monte-carlo-contracts.test.ts packages/f7-simulation/src/simulation.test.ts apps/f7-local-api/src/f7-session-service.test.ts`

Expected: all focused tests PASS.

### Task 4: Build the Plot Model and SVG Component

**Files:**
- Create: `apps/f7-web/src/monte-carlo-plot.ts`
- Create: `apps/f7-web/src/monte-carlo-plot.test.ts`
- Create: `apps/f7-web/src/components/MonteCarloHistogram.vue`

- [ ] **Step 1: Write failing plot-model tests**

Require the x-domain to include bin bounds, LSL, USL, mean, and mean +/- target sigma. Require finite geometry, a non-empty fitted path, and stable references:

```ts
expect(model.references.map(({ id }) => id)).toEqual([
  "lower-spec-limit", "upper-spec-limit", "mean", "minus-target-sigma", "plus-target-sigma",
]);
expect(model.curvePath.startsWith("M")).toBe(true);
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/f7-web/src/monte-carlo-plot.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure model**

Create typed scaling helpers that derive bar geometry, fitted expected-count path, axis ticks, references, and collision-safe label rows. Do not read DOM state.

- [ ] **Step 4: Verify model GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Implement `MonteCarloHistogram.vue`**

Render responsive SVG with accessible title/description, observed bars, dark fitted line, dashed spec lines, distinct target-sigma lines, axes, and legend. Add test selectors for bins, fit path, and reference IDs.

### Task 5: Integrate Editable Defaults and Result Sections

**Files:**
- Modify: `apps/f7-web/src/components/MonteCarloPanel.vue`
- Modify: `apps/f7-web/src/App.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] **Step 1: Write failing UI tests**

Update the approved snapshot fixture with Excel evidence. Assert Step 5 opens with `-0.15`, `0.05`, and `3`, shows P54/P55/P56, and submits target sigma. Add tests that editing target sigma to 4 marks an override, target sigma 0 disables Run, unavailable evidence leaves controls empty, and result sections distinguish expected DPM from observed PPM.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/f7-web/src/App.test.ts`

Expected: FAIL on defaults, target sigma control, chart, and statistics.

- [ ] **Step 3: Implement defaults and override state**

Initialize the form once from available `session.systemSpecification` actual values. Add editable Target Sigma Level and source labels. Compare numeric form values with evidence to display `Excel default` or `Override`; never mutate the snapshot.

- [ ] **Step 4: Integrate chart and statistics**

Render `MonteCarloHistogram` after a result. Add Process Outputs (iterations, mean, standard deviation, median, LSL, USL, target sigma), Normal Model Statistics (expected DPM/yield, Cp/Cpk, target), and Observed Defect Statistics (count, PPM, yield).

- [ ] **Step 5: Add responsive styles**

Use existing variables and square industrial panels. Keep the chart full width and mobile controls single-column. Do not add gradients, decorative cards, or a chart library.

- [ ] **Step 6: Verify GREEN**

Run: `npx vitest run apps/f7-web/src/App.test.ts apps/f7-web/src/monte-carlo-plot.test.ts`

Expected: PASS.

### Task 6: Full Validation and Browser Acceptance

**Files:**
- Verify all files above.

- [ ] **Step 1: Run focused regression suite**

Run:

`npx vitest run packages/contracts/src/f7-contracts.test.ts packages/contracts/src/f7-monte-carlo-contracts.test.ts packages/f7-simulation/src/simulation.test.ts apps/f7-local-api/src/f7-session-service.test.ts apps/f7-local-api/src/server.test.ts apps/f7-web/src`

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run builds**

Run: `npm run build:f7:web` then `npm run build -- --force`.

Expected: both exit 0 with no TypeScript or Vue errors.

- [ ] **Step 3: Exercise the browser flow**

Upload a valid workbook with Response Summary evidence, complete factor/distribution setup, verify Excel defaults, edit Target Sigma, and run 10,000 iterations. Assert all F7 requests return 200 and there are no unexpected console errors.

- [ ] **Step 4: Validate chart at desktop and mobile widths**

At 1440x900 and 390x844, verify non-zero SVG/bar/path bounds, five visible references, no page-level horizontal overflow, no text overlap, and readable metrics.

- [ ] **Step 5: Review scope**

Run `git diff --check` and inspect `git diff --stat`. Confirm only planned F7 files and design/plan documents changed. Do not commit unless explicitly requested.
