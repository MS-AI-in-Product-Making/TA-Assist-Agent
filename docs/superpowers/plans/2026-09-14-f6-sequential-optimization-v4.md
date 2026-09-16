# F6 Sequential Optimization V4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed F6 V4 scenario chain that centers the response, reverse-solves Factor tolerances, relaxes only failed specification sides as a last resort, and publishes a Raw Data versus Optimized Data comparison slide for every under-target worksheet.

**Architecture:** Keep F4 as the only numeric authority and keep `f6-artifact-set-v3` as the five-file publication protocol. Add a versioned V4 optimization contract and writer, chain each F4-backed scenario from the last valid result, then project the validated selected result into Markdown and a dedicated fixed-size PDF slide. Historical V2/V3 readers and writers remain unchanged.

**Tech Stack:** TypeScript, Zod, Node.js, Vitest, Marked, Playwright/Chromium PDF export, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-14-f6-sequential-optimization-v4-design.md`

## Global Constraints

- Do not modify F1-F5 or F7 workflow order, artifact contracts, or behavior.
- Do not modify the F4 calculation formulas or capability definitions.
- Keep historical `f6-optimization-v2` and `f6-optimization-v3` read-only compatible.
- New writes use `f6-optimization-v4` and `f6-sequential-optimization-policy-v2`.
- Keep `f6-artifact-set-v3`, the five output filenames, manifest-last publication, PDF signature, and SHA-256 verification.
- Every optimization number must come from `calculateF6Scenario`; renderers format validated values and never calculate capability metrics.
- A specification relaxation is always `changeClass: "requirement_change"`, `approvalRequired: true`, and `capabilityImprovementClaim: false`.
- Keep `f6-top3-tolerance-policy-v1` OP1/OP2/OP3 as internal sensitivity scenarios; they cannot become the selected optimized result.
- Follow strict RED/GREEN TDD for every production behavior.

---

### Task 1: Define the F6 V4 Contract Boundary

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

**Interfaces:**
- Consumes: existing `f6InputBaselineIdentitySchema`, `f6MetricsV2Schema`, `f6FactorIdentitySchema`, `f6ToleranceOptionV3Schema`, and V3 provenance schemas.
- Produces: `f6OptimizationResultV4Schema`, `F6OptimizationResultV4`, V2/V3/V4 readable union, and a V4 new-writer alias.

- [ ] **Step 1: Add failing version-boundary tests**

Add a minimal valid V4 fixture with this public shape and assert that V4 parses, V2/V3 still parse through the readable schema, V3 rejects V4, and the new-writer alias rejects V3:

```ts
const resultV4 = {
  contractVersion: "v1",
  outputClassification: "confidential",
  featureId: "F6",
  optimizationVersion: "f6-optimization-v4",
  sequentialPolicyId: "f6-sequential-optimization-policy-v2",
  interactionLanguage,
  runStatus: "COMPLETED",
  workbook,
  worksheets: [v4Worksheet],
  summary: {
    worksheetCount: 1,
    baselineMeetsTargetWorksheetCount: 1,
    optimizedWorksheetCount: 0,
    noValidatedResultWorksheetCount: 0,
    clarificationRequiredWorksheetCount: 0,
  },
  provenance: v3Provenance,
} as const;

expect(f6OptimizationResultV4Schema.parse(resultV4)).toEqual(resultV4);
expect(f6ReadableOptimizationResultSchema.parse(resultV3)).toEqual(resultV3);
expect(f6OptimizationResultSchema.safeParse(resultV3).success).toBe(false);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx vitest run --project node packages/contracts/src/contracts.test.ts`

Expected: FAIL because `f6OptimizationResultV4Schema` does not exist and the new-writer alias still accepts V3.

- [ ] **Step 3: Add strict V4 snapshot, step, worksheet, summary, and provenance schemas**

Define a scenario snapshot that contains the complete F4 result projection required by the report without renderer recomputation:

```ts
const f6ScenarioSnapshotV4Schema = z.object({
  scenarioId: z.string().min(1),
  sourceStep: z.enum(["baseline", "meanResponseCentering", "toleranceReverseSolve", "specificationRelaxation"]),
  inputScenarioId: z.string().min(1).nullable(),
  calculationVersion: z.literal("excel-ta-v1"),
  calculationReference: f6ArtifactReferenceSchema,
  baselineIdentity: f6InputBaselineIdentitySchema,
  system: z.object({
    designNominal: z.number().finite(), mean: z.number().finite(), additionalMeanShift: z.number().finite(),
    rssSigma: z.number().finite().positive(), worstCaseLower: z.number().finite(), worstCaseUpper: z.number().finite(),
  }).strict(),
  capability: z.object({
    lowerSpecLimit: z.number().finite(), upperSpecLimit: z.number().finite(), targetCpk: z.number().finite().positive(),
    lowerCpk: z.number().finite(), upperCpk: z.number().finite(), cpk: z.number().finite(),
    yield: z.number().finite(), totalDpm: z.number().finite(), status: z.enum(["PASS", "FAIL"]),
  }).strict(),
  factors: z.array(z.object({
    factor: f6FactorIdentitySchema,
    nominalValue: z.number().finite(), lowerTolerance: z.number().finite(), upperTolerance: z.number().finite(),
    mean: z.number().finite(), sigma: z.number().finite().positive(), contribution: z.number().finite().nonnegative(),
  }).strict()).min(1),
  factorOverrides: z.array(z.object({
    factor: f6FactorIdentitySchema, nominalValue: z.number().finite().optional(),
    lowerTolerance: z.number().finite().optional(), upperTolerance: z.number().finite().optional(),
  }).strict()),
  systemSpecificationOverride: z.object({
    lowerSpecLimit: z.number().finite().optional(), upperSpecLimit: z.number().finite().optional(),
    additionalMeanShift: z.number().finite().optional(),
  }).strict().optional(),
  formulaReferences: z.array(f6V2FormulaReferenceSchema),
}).strict();
```

Add a fixed three-element tuple for `meanResponseCentering`, `toleranceReverseSolve`, and `specificationRelaxation`. Use the exact status literals from the spec. Model `selectedResult` as a discriminated union over `baseline_meets_target`, `step1_centered`, `step2_tolerance_optimized`, `step3_specification_relaxed_pending_approval`, and `no_validated_optimized_result`. Reuse the V3 OP schemas beneath `sensitivityScenarios` without allowing them in `selectedResult`.

- [ ] **Step 4: Add V4 sequence and tamper refinements**

Add `superRefine` checks for:

```ts
// Required invariants, expressed with exact tuple indexes.
// - baseline PASS => selectedResult baseline_meets_target and all steps NOT_NEEDED.
// - COMPLETED_TARGET_MET => every later step NOT_RUN_EARLIER_STEP_MET_TARGET.
// - Step 2 inputScenarioId matches the Step 1 result or baseline fallback.
// - Step 3 inputScenarioId matches the Step 2 result or last valid fallback.
// - selectedResult snapshot matches the stopping step snapshot.
// - specification result carries all three approval/change-class literals.
// - every snapshot baseline identity and F4 reference matches worksheet/root provenance.
// - sensitivity scenario IDs remain f6-top3-tolerance-policy-v1:OP1/OP2/OP3.
```

Add rejection tests for each invariant, including a sensitivity scenario promoted into `selectedResult`.

- [ ] **Step 5: Migrate only the readable and new-writer aliases**

```ts
export const f6ReadableOptimizationResultSchema = z.union([
  f6OptimizationResultV2Schema,
  f6OptimizationResultV3Schema,
  f6OptimizationResultV4Schema,
]);
export const f6OptimizationResultSchema = f6OptimizationResultV4Schema;
export type F6OptimizationResultV4 = z.infer<typeof f6OptimizationResultV4Schema>;
export type F6OptimizationResult = F6OptimizationResultV4;
```

Do not edit the V2 or V3 schemas.

- [ ] **Step 6: Run contract tests and build**

Run: `npx vitest run --project node packages/contracts/src/contracts.test.ts`

Run: `npm run build -- --force`

Expected: PASS. Restore only unrelated tracked `dist` churn produced by the build; retain generated files only if this repository already tracks the corresponding changed source output and the diff is required by the task.

- [ ] **Step 7: Commit Task 1**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/contracts/dist
git commit -m "feat(contracts): add F6 optimization v4"
```

---

### Task 2: Implement the F4-Backed Sequential V4 Optimizer

**Files:**
- Modify: `packages/workbook-catalog/src/f6-solver.ts`
- Modify: `packages/workbook-catalog/src/f6-solver.test.ts`
- Modify: `packages/workbook-catalog/src/f6-optimization.ts`
- Modify: `packages/workbook-catalog/src/f6-optimization.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

**Interfaces:**
- Consumes: `calculateF6Scenario`, `solveCenteringShift`, `solveTargetRssSigma`, `solveTopNCombinedTolerance`, `solveOneSidedSpecificationLimits`, `selectTopContributors`, and Task 1 V4 types.
- Produces: `createF6OptimizationV4(input, inputs, dependencies): F6OptimizationResultV4` and `F6OptimizationV4Inputs`.

- [ ] **Step 1: Add failing guard-band solver tests**

Add a named exported helper that derives a target RSS strictly inside the F4 capability boundary:

```ts
expect(solveGuardedTargetRssSigma({
  lowerSpecLimit: -1,
  upperSpecLimit: 1,
  mean: 0,
  targetCpk: 1.33,
}).targetRssSigma).toBeLessThan(1 / (3 * 1.33));
```

Also test finite positive output for tiny/large representable values and structured `target_unreachable` behavior.

- [ ] **Step 2: Run solver tests and verify RED**

Run: `npx vitest run --project node packages/workbook-catalog/src/f6-solver.test.ts`

Expected: FAIL because `solveGuardedTargetRssSigma` does not exist.

- [ ] **Step 3: Implement a versioned numeric guard band**

Implement `solveGuardedTargetRssSigma` by calling `solveTargetRssSigma`, then applying a fixed machine-resolution guard such as `target * (1 - 64 * Number.EPSILON)`. Reject a nonpositive or unrepresentable guarded value with `F6SolverError("target_unreachable", ...)`. Export the helper from `index.ts`. Do not change F4 comparisons.

- [ ] **Step 4: Add failing V4 optimizer tests in execution order**

Create `describe("createF6Optimization V4")` with real calculation requests and injected `calculateScenario` observation. Cover these cases separately:

```ts
it("does not run scenarios when the baseline meets target", ...);
it("selects a verified mean-shift centering result and skips later steps", ...);
it("requires engineering confirmation for a nominal centering path without signed direction evidence", ...);
it("uses the last verified centering result as the tolerance scenario baseline", ...);
it("reverse-solves top contributors and stops when F4 reports PASS", ...);
it("uses the last valid tolerance result for failed-side specification relaxation", ...);
it("selects an approval-required specification result only after F4 verification", ...);
it("returns no_validated_optimized_result when every executable path fails", ...);
it("keeps OP1 OP2 OP3 only in sensitivityScenarios", ...);
```

Assert scenario call order and `inputScenarioId`, not only the final values.

- [ ] **Step 5: Run optimizer tests and verify RED**

Run: `npx vitest run --project node packages/workbook-catalog/src/f6-optimization.test.ts`

Expected: FAIL because `createF6OptimizationV4` does not exist.

- [ ] **Step 6: Add snapshot and chained-request helpers**

Implement private helpers with these responsibilities:

```ts
function snapshotV4(input: {
  calculation: CalculationCompletedResult;
  scenarioId: string;
  sourceStep: "baseline" | "meanResponseCentering" | "toleranceReverseSolve" | "specificationRelaxation";
  inputScenarioId: string | null;
  baselineIdentity: F6InputBaselineIdentity;
  calculationReference: { artifact: string; contentHash: string };
  factorOverrides?: readonly F6ControlledScenario["factorOverrides"][number][];
  systemSpecification?: F6ControlledScenario["systemSpecification"];
}): F6ScenarioSnapshotV4;

function requestFromSnapshot(
  original: CalculationRequest,
  snapshot: F6ScenarioSnapshotV4,
): CalculationRequest;
```

`requestFromSnapshot` must create a fresh request whose selected Factor inputs and system specification equal the prior F4 result, preserve workbook/table/source identities, and reset `scenarioOverrides` so each next call has one explicit parent snapshot. Add a focused test proving replay of the chained request equals the snapshot calculation.

- [ ] **Step 7: Implement `createF6OptimizationV4` minimally**

Use one worksheet-local loop with explicit step functions:

```ts
const baselineSnapshot = snapshotV4(...);
const step1 = runMeanResponseCentering(...);
if (step1.status === "COMPLETED_TARGET_MET") return stoppedAfterStep1(...);
const step2Input = lastValidSnapshot(step1, baselineSnapshot);
const step2 = runToleranceReverseSolve(step2Input, ...);
if (step2.status === "COMPLETED_TARGET_MET") return stoppedAfterStep2(...);
const step3Input = lastValidSnapshot(step2, step2Input);
const step3 = runSpecificationRelaxation(step3Input, ...);
return finalizeSelectedResult(...);
```

For automatic Step 1, allow `system_mean_shift_centering` only when governed model/target input explicitly classifies the offset as system/process shift. A Factor nominal path without exact Factor identity and signed direction evidence returns `ENGINEERING_CONFIRMATION_REQUIRED` and proceeds to Step 2. Never alter system `designNominal` as a centering mechanism.

Step 2 must select stable Top 3 contributors from the current snapshot, call `solveGuardedTargetRssSigma`, call `solveTopNCombinedTolerance` with `proportional-to-contribution`, preserve every band center, then verify through `calculateF6Scenario`.

Step 3 must derive failed sides from the Step 2 input snapshot, call `solveOneSidedSpecificationLimits`, verify through `calculateF6Scenario`, and attach the three required governance literals.

- [ ] **Step 8: Keep fixed OP scenarios as sensitivity only**

Reuse the existing fixed policy generator against the same worksheet baseline. Map its completed/calculation-failed results into `sensitivityScenarios`; do not include it in step status selection or `selectedResult`.

- [ ] **Step 9: Run optimizer, solver, scenario, and contract tests**

Run: `npx vitest run --project node packages/workbook-catalog/src/f6-solver.test.ts packages/workbook-catalog/src/f6-scenario-adapter.test.ts packages/workbook-catalog/src/f6-optimization.test.ts packages/contracts/src/contracts.test.ts`

Expected: PASS with historical V2/V3 tests unchanged.

- [ ] **Step 10: Commit Task 2**

```powershell
git add packages/workbook-catalog/src/f6-solver.ts packages/workbook-catalog/src/f6-solver.test.ts packages/workbook-catalog/src/f6-optimization.ts packages/workbook-catalog/src/f6-optimization.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat(optimization): chain F6 v4 scenarios"
```

---

### Task 3: Publish and Validate V4 Artifacts

**Files:**
- Modify: `packages/workflow-runners/src/types.ts`
- Modify: `packages/workflow-runners/src/f6.ts`
- Modify: `packages/workflow-runners/src/f6.test.ts`
- Modify: `packages/workflow-runners/src/existing-f6.ts`
- Modify: `packages/workflow-runners/src/existing-f6.test.ts`
- Modify: `scripts/f6-artifact-loader.test.mjs`
- Modify: `scripts/f6-full-flow.test.mjs`
- Modify: `scripts/verify-current-f6.mjs`
- Modify: `scripts/verify-current-f6.test.mjs`

**Interfaces:**
- Consumes: Task 2 `createF6OptimizationV4` and Task 1 `f6OptimizationResultV4Schema`.
- Produces: new F6 runs with V4 optimization JSON inside unchanged `f6-artifact-set-v3`, plus V2/V3/V4 existing-artifact validation.

- [ ] **Step 1: Add failing runner and validator version tests**

Assert that the runner dependency is V4, rejects an injected V3 result before publication, and emits:

```ts
expect(result.optimization?.optimizationVersion).toBe("f6-optimization-v4");
expect(result.optimization?.sequentialPolicyId).toBe("f6-sequential-optimization-policy-v2");
expect(manifest.artifactSetVersion).toBe("f6-artifact-set-v3");
```

Add existing-artifact fixtures for valid V4, selected-result tampering, scenario lineage tampering, hash mismatch, and unchanged V2/V3 readable validation.

- [ ] **Step 2: Run runner/validator tests and verify RED**

Run: `npx vitest run --project node packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.test.ts scripts/verify-current-f6.test.mjs scripts/f6-full-flow.test.mjs`

Expected: FAIL because production still writes V3 and V4 falls through historical validation logic.

- [ ] **Step 3: Switch only the production writer path to V4**

Update `F6Dependencies.createOptimization` to `typeof createF6OptimizationV4`, parse output with `f6OptimizationResultV4Schema`, and update workflow result types to V4. Keep `createF6OptimizationV3` exported and untouched. Preserve file names, hashes, PDF rendering order, atomic staging, and manifest-last behavior.

- [ ] **Step 4: Add explicit V4 existing-artifact dispatch**

In both `existing-f6.ts` and `verify-current-f6.mjs`, branch on `optimizationVersion`:

```ts
switch (optimization.optimizationVersion) {
  case "f6-optimization-v4": validateV4SourcesAndLineage(...); break;
  case "f6-optimization-v3": validateV3Sources(...); break;
  case "f6-optimization-v2": validateV2Sources(...); break;
}
```

V4 validation must require multimodal provenance, exact worksheet/report scope, summary counts, selected-result snapshot identity, F4 artifact reference, step lineage, report summary consistency, and all three output hashes. Do not parse Markdown to derive result disposition.

- [ ] **Step 5: Update full-flow fixtures and assertions**

Make current-run fixtures emit a real V4 shape generated through `createF6OptimizationV4`, not hand-authored values. Keep historical fixture coverage. Assert exactly five files and unchanged `f6-artifact-set-v3`.

- [ ] **Step 6: Run focused runner and full-flow tests**

Run: `npx vitest run --project node packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.test.ts scripts/f6-artifact-loader.test.mjs scripts/verify-current-f6.test.mjs scripts/f6-full-flow.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```powershell
git add packages/workflow-runners/src/types.ts packages/workflow-runners/src/f6.ts packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.ts packages/workflow-runners/src/existing-f6.test.ts scripts/f6-artifact-loader.test.mjs scripts/f6-full-flow.test.mjs scripts/verify-current-f6.mjs scripts/verify-current-f6.test.mjs
git commit -m "feat(workflow): publish governed F6 v4 results"
```

---

### Task 4: Project the Raw and Optimized Comparison

**Files:**
- Modify: `scripts/f6-final-report.mjs`
- Modify: `scripts/f6-final-report.test.mjs`
- Modify: `scripts/f6-report.mjs`
- Modify: `scripts/f6-report.test.mjs`

**Interfaces:**
- Consumes: validated V4 baseline snapshot, ordered steps, selected result, and changed Factor rows.
- Produces: final Markdown with one stable comparison block per under-target worksheet and no block for baseline PASS worksheets.

- [ ] **Step 1: Add failing V4 report projection tests**

Cover Step 1, Step 2, Step 3, and no-result reports. Assert:

```ts
expect(markdown).toContain("## Optimization Comparison");
expect(markdown).toContain("<!-- f6-optimization-comparison -->");
expect(markdown).toContain("| Metric | Raw Data | Optimized Data |");
expect(markdown).toContain("| Step | Status | Action | Result |");
expect(markdown).toContain("| Factor | Table / Row | Nominal Before | Nominal After |");
```

Assert a baseline PASS worksheet has neither marker nor heading. Assert no-result output contains `No validated optimized result` and does not contain an Optimized numeric cell. Assert Step 3 displays `Requirement change - engineering approval required`.

- [ ] **Step 2: Run report tests and verify RED**

Run: `npx vitest run --project node scripts/f6-final-report.test.mjs scripts/f6-report.test.mjs`

Expected: FAIL because the final report parser is V4 after Task 1 but no V4 projection exists.

- [ ] **Step 3: Add V4 report dispatch and comparison projection**

Keep `createF6V3Report` unchanged. Add `createF6V4Report`, `renderF6V4Worksheet`, and `renderOptimizationComparison`. The comparison renderer must read all numeric cells directly from `baselineResult` and `selectedResult.snapshot`; it may format numbers but must not derive Cpk, Yield, DPM, RSS, worst-case bounds, or deltas.

Use a fixed system metric list and compare Factor identities to show only rows where an override changed nominal or tolerance. Render unchanged Factor count as text. Render all three ordered step states and the stopping reason.

- [ ] **Step 4: Add deterministic continuation blocks**

Set a constant changed-Factor capacity per slide. Projection splits rows before Markdown rendering and emits:

```md
<!-- f6-optimization-comparison continuation="1" -->
## Optimization Comparison (Continued)
```

Do not reduce font size based on row count.

- [ ] **Step 5: Run report and contract tests**

Run: `npx vitest run --project node scripts/f6-final-report.test.mjs scripts/f6-report.test.mjs packages/contracts/src/contracts.test.ts`

Expected: PASS, including unchanged V3 report tests.

- [ ] **Step 6: Commit Task 4**

```powershell
git add scripts/f6-final-report.mjs scripts/f6-final-report.test.mjs scripts/f6-report.mjs scripts/f6-report.test.mjs
git commit -m "feat(report): compare raw and optimized TA results"
```

---

### Task 5: Render Dedicated Optimization PDF Slides

**Files:**
- Modify: `packages/product-export/src/f6-pdf-report.ts`
- Modify: `packages/product-export/src/f6-pdf-export.test.ts`

**Interfaces:**
- Consumes: Task 4 stable comparison markers and already formatted Markdown tables.
- Produces: `.slide-optimization` and `.slide-optimization-continuation` at 1920 x 1080 with no engineering recalculation.

- [ ] **Step 1: Add failing renderer state tests**

Create Markdown containing two worksheet headings and one comparison marker between them. Assert exact DOM order:

```ts
expect(html).toMatch(/slide-worksheet[\s\S]*slide-optimization[\s\S]*slide-worksheet/u);
expect((html.match(/class="[^"]*slide-optimization/g) ?? [])).toHaveLength(1);
expect(html).toContain("width:1920px");
expect(html).toContain("height:1080px");
```

Add no-marker and continuation-marker tests, plus closing-tag balance around the next worksheet.

- [ ] **Step 2: Run PDF tests and verify RED**

Run: `npx vitest run --project node packages/product-export/src/f6-pdf-export.test.ts`

Expected: FAIL because comparison content remains inside the worksheet slide.

- [ ] **Step 3: Extend renderer section state**

Replace the single worksheet boolean with an explicit section state:

```ts
type SlideSection = "summary" | "worksheet" | "optimization" | "optimization-continuation";
```

When a comparison marker/heading is encountered, close the analysis grid and worksheet section, open the corresponding optimization slide, and ensure the next worksheet closes it. `finishContent()` must close whichever section remains open.

- [ ] **Step 4: Add fixed comparison layout styles**

Add stable grid areas for decision summary, three-step path, system comparison, and changed Factors. Keep text at fixed sizes and rely on Task 4 continuation blocks for overflow. Do not parse numeric strings or calculate statuses in the PDF renderer.

- [ ] **Step 5: Run PDF and report tests**

Run: `npx vitest run --project node packages/product-export/src/f6-pdf-export.test.ts scripts/f6-final-report.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```powershell
git add packages/product-export/src/f6-pdf-report.ts packages/product-export/src/f6-pdf-export.test.ts
git commit -m "feat(pdf): add F6 optimization comparison slides"
```

---

### Task 6: Update Governance and Complete End-to-End Validation

**Files:**
- Modify: `.github/skills/design-optimization/SKILL.md`
- Modify: `scripts/f6-skill.test.mjs`
- Modify: `.github/skills/pdf-report-export/SKILL.md` only if its current contract explicitly fixes the optimization version
- Modify: `scripts/pdf-report-export-skill.test.mjs` only when the preceding skill file changes
- Modify: `README.md` or `docs/04-feature-breakdown.md` only if current public behavior documentation claims V3 is the new-write path

**Interfaces:**
- Consumes: completed V4 workflow and report behavior.
- Produces: governed product instructions matching runtime behavior and a verified feature branch.

- [ ] **Step 1: Add failing skill contract assertions**

Assert the Design Optimization skill states:

```text
f6-optimization-v4
f6-sequential-optimization-policy-v2
mean response centering before tolerance reverse solve
specification relaxation only after tolerance cannot meet target
OP1/OP2/OP3 are sensitivity/fallback and never selectedResult
one Raw Data vs Optimized Data page for every under-target worksheet
f6-artifact-set-v3 remains the five-file publication contract
```

- [ ] **Step 2: Run skill tests and verify RED**

Run: `npx vitest run --project node scripts/f6-skill.test.mjs scripts/pdf-report-export-skill.test.mjs`

Expected: FAIL on V3 current-write wording and missing V4 sequence/report requirements.

- [ ] **Step 3: Update product skill wording minimally**

Replace current-new-write V3 instructions with V4 sequence and validation. Retain historical V2/V3 read-only behavior, exact phase order, selected worksheet gates, required multimodal input, ADO confirmation gates, allowed commands, confidentiality, containment, hashes, and PDF fail-closed rules.

- [ ] **Step 4: Run focused F6 validation**

Run:

```powershell
npx vitest run --project node packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f6-solver.test.ts packages/workbook-catalog/src/f6-scenario-adapter.test.ts packages/workbook-catalog/src/f6-optimization.test.ts packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.test.ts packages/product-export/src/f6-pdf-export.test.ts scripts/f6-artifact-loader.test.mjs scripts/f6-final-report.test.mjs scripts/f6-report.test.mjs scripts/f6-full-flow.test.mjs scripts/verify-current-f6.test.mjs scripts/f6-skill.test.mjs scripts/pdf-report-export-skill.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Build, lint, and run the complete test suite**

Run:

```powershell
npm run build -- --force
npm run lint
npm test
```

Expected: all commands exit 0. Do not fix unrelated pre-existing failures; record them with exact commands if the baseline changed externally.

- [ ] **Step 6: Generate and verify one governed V4 sample**

Run the existing F6 full-flow fixture that produces a controlled five-file run, then run:

```powershell
node scripts/verify-current-f6.mjs
```

Require V4 optimization validation, `%PDF-` signature, matching Markdown/PDF hashes, exact five-file set, one comparison slide for each under-target worksheet, and no comparison slide for a baseline PASS worksheet.

- [ ] **Step 7: Perform browser PDF visual validation**

Open the generated HTML/PDF with the repository Playwright tooling. Capture desktop and PDF-page screenshots and assert nonblank canvas pixels, 1920 x 1080 framing, worksheet/comparison adjacency, no overlap, no clipping, and continuation slide behavior. Keep generated evidence outside tracked source paths.

- [ ] **Step 8: Commit governance and documentation**

```powershell
git add .github/skills/design-optimization/SKILL.md scripts/f6-skill.test.mjs .github/skills/pdf-report-export/SKILL.md scripts/pdf-report-export-skill.test.mjs README.md docs/04-feature-breakdown.md
git commit -m "docs(governance): require F6 v4 sequential optimization"
```

Stage only files actually changed.

- [ ] **Step 9: Final branch review**

Review `7706437..HEAD` for correctness, historical compatibility, missing tests, calculation duplication, source-workbook mutation, artifact-set drift, and report overflow. Resolve all load-bearing findings, rerun the narrow affected test, then rerun the complete verification from Steps 4-7.
