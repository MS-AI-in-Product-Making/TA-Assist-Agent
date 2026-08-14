# F6 Optimization and Composed Engineering Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可运行、可审计的 F6 optimization workflow，并生成符合 DM/DFSS/TA 决策格式的 workbook 总览与逐 worksheet F5+F6 联合工程报告。

**Architecture:** 本计划必须在 `2026-08-14-f5-contextual-image-observations-v2.md` 完成后执行。F6 通过新的受控 scenario adapter 调用公开 `createCalculation()`，不暴露 F4 私有 helpers；F6 负责 scenario 生成、reverse solve、RSS apportionment、feasibility 和 impact ranking，composed renderer 只组合 F2/F5/F6 artifacts，不重新计算或提升 evidence classification。Legacy `comparison-result-v1: feature_not_available` 保持兼容。

**Tech Stack:** TypeScript、Zod、Node.js ESM、Vitest、F4 calculation engine、Markdown/JSON artifacts

---

## File Structure

- Modify: `packages/contracts/src/contracts.ts`, `packages/contracts/src/contracts.test.ts` - F6 request/result/options/evidence/report contracts。
- Create: `packages/workbook-catalog/src/f6-solver.ts`, `.test.ts` - target sigma、band scaling、reverse solve。
- Create: `packages/workbook-catalog/src/f6-apportionment.ts`, `.test.ts` - RSS allocation strategies。
- Create: `packages/workbook-catalog/src/f6-feasibility.ts`, `.test.ts` - capability/datum/supplier/cost evidence gates。
- Create: `packages/workbook-catalog/src/f6-scenario-adapter.ts`, `.test.ts` - governed F4 scenario execution。
- Create: `packages/workbook-catalog/src/f6-optimization.ts`, `.test.ts` - F6 orchestrator and impact ranking。
- Create: `packages/workbook-catalog/src/f6-composed-report.ts`, `.test.ts` - workbook/worksheet decision model and PASS/FAIL/RISK status。
- Modify: `packages/workbook-catalog/src/index.ts` - export only governed F6 APIs。
- Create: `scripts/f6-artifact-loader.mjs`, `.test.mjs` - F2/F3/F4/F5 identity binding and blocked worksheets。
- Create: `scripts/f6-cli-args.mjs`, `.test.mjs` - strict CLI parsing。
- Create: `scripts/f6-output-layout.mjs`, `.test.mjs` - run-scoped artifact paths。
- Create: `scripts/f6-report.mjs`, `.test.mjs` - detailed F6 report。
- Create: `scripts/f6-composed-report.mjs`, `.test.mjs` - workbook/worksheet decision report。
- Create: `scripts/run-f6-full-validation.mjs`, `scripts/f6-full-flow.test.mjs` - atomic workflow。
- Modify: `package.json` - `workflow:f6` only after runner exists and tests pass。
- Create: `apps/cli/src/commands/feature6.ts`, `.test.ts`; modify `apps/cli/src/index.ts`, `.test.ts` - CLI surface。
- Modify: `packages/governance/src/feature-register.ts`, `packages/governance/src/policy-gate.test.ts`, `docs/governance/feature-register.md` - availability transition after acceptance gates。
- Modify: `README.md`, `docs/README.md`, architecture/end-to-end/feature docs - F6 behavior and report contract。

## Execution Prerequisite

- Confirm F5 v2 plan is merged into this branch and its complete suite passes.
- Do not mark F6 available until Tasks 1-10 pass.
- Keep legacy comparison placeholder and tests unchanged.

### Task 1: Define F6 optimization contracts

**Files:**
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/contracts/src/contracts.ts`

- [ ] **Step 1: Write RED contract fixtures**

Add the fixture inside the existing F5 root-contract `describe` block in `contracts.test.ts`, where `calculationCompletedResult`, `rootResult`, and `governanceRow` are already defined. Use this minimal valid request/result fixture:

```ts
const reference = (artifact: string) => ({ artifact, contentHash: "a".repeat(64) });

const validF6WorksheetInput = {
  worksheetName: "Analysis-A",
  baselineCalculation: calculationCompletedResult,
  f5Worksheet: rootResult.worksheets[0],
  f3GovernanceRows: [governanceRow],
  f2Findings: [],
};

const f6Request = {
  contractVersion: "v1",
  inputClassification: "confidential",
  workbook: { fileName: "Demo.xlsx", contentHash: "b".repeat(64) },
  selectedWorksheetNames: ["Analysis-A"],
  f2Reference: reference("Feature2-Report.json"),
  f3Reference: reference("Feature3-Report.json"),
  f4Reference: {
    ...reference("Feature4-Calculation.json"),
    runId: "f4-run-1",
    calculationVersion: "excel-ta-v1",
  },
  f5Reference: {
    ...reference("Feature5-Report.json"),
    interpretationVersion: "f5-data-interpretation-v1",
  },
  f0Versions: {
    knowledgeBaseVersion: "v1",
    capabilityVersion: "internal-v1",
    interpretationVersion: "interpretation-rules-v1",
  },
  scenarioPolicyVersion: "f6-scenario-policy-v1",
  worksheets: [validF6WorksheetInput],
};
```

Assert valid parse; public classification, absolute artifact path, duplicate selected name, workbook mismatch, invalid option delta, completed summary mismatch, and input-rejected worksheet with options fail. Add a `f6-composed-report-v1` fixture with workbook summary, blocked input findings, ready worksheet sections, evidence references, and exact 5/10 bullet limits. Assert legacy `comparisonRequestSchema` and `comparisonResultSchema` still parse unchanged.

- [ ] **Step 2: Run contracts test and verify RED**

Run: `npx vitest run packages/contracts/src/contracts.test.ts`

Expected: FAIL because F6 optimization schemas do not exist.

- [ ] **Step 3: Implement strict F6 schemas**

Build `f6OptimizationRequestSchema` from the exact fields in the RED fixture: contract/classification/workbook, unique selected names, strict F2/F3/F4/F5 references, F0 versions, scenario policy, optional evidence, and worksheet inputs. Export the result schemas below:

```ts
export const f6MetricsSchema = z.object({
  mean: z.number().finite(),
  rssSigma: z.number().finite().nonnegative(),
  cp: z.number().finite(),
  cpk: z.number().finite(),
  yield: z.number().finite().min(0).max(1),
  dpm: z.number().finite().nonnegative(),
}).strict();
export const f6OptimizationResultSchema = z.object({
  contractVersion: contractVersionSchema,
  outputClassification: z.literal("confidential"),
  featureId: z.literal("F6"),
  status: z.enum(["completed", "partially_completed", "input_rejected"]),
  optimizationVersion: z.literal("f6-optimization-v1"),
  workbook: z.object({ fileName: workbookCatalogFileNameSchema, contentHash: sha256Schema }).strict(),
  worksheets: z.array(f6WorksheetResultSchema).min(1),
  summary: f6SummarySchema,
  provenance: f6ProvenanceSchema,
}).strict();
export const f6ComposedEngineeringReportSchema = z.object({
  contractVersion: contractVersionSchema,
  outputClassification: z.literal("confidential"),
  reportVersion: z.literal("f6-composed-report-v1"),
  workbook: z.object({ fileName: workbookCatalogFileNameSchema, contentHash: sha256Schema }).strict(),
  overallStatus: z.enum(["PASS", "FAIL", "RISK"]),
  workbookExecutiveSummary: z.array(z.string().min(1)).max(5),
  blockedWorksheets: z.array(f6BlockedWorksheetReportSchema),
  worksheets: z.array(f6ComposedWorksheetReportSchema),
}).strict();
```

Define strict evidence unions and option kinds from the spec. Use `"insufficient_evidence"` and `"not_computed"`, not `null`/zero, for missing supplier/datum/cost evidence. Add root/worksheet summary and status `superRefine` checks.

Define and export strict schemas/types matching these DTOs before the root schemas:

```ts
type F6ToleranceChange = {
  worksheetName: string;
  tableId: string;
  sourceRow: number;
  originalLowerTolerance: number;
  originalUpperTolerance: number;
  resultingLowerTolerance: number;
  resultingUpperTolerance: number;
  originalBand: number;
  resultingBand: number;
  bandCenter: number;
};

type F6ControlledScenario = {
  scenarioId: string;
  optionKind: F6OptionKind;
  factorOverrides: CalculationScenarioOverride["factorOverrides"];
  systemSpecification?: CalculationScenarioOverride["systemSpecification"];
};

type F6ReverseSolveResult = {
  targetCpk: number;
  targetRssSigma: number;
  strategy: "single-factor" | "top-3" | "rss-apportionment" | "centering-plus-tighten";
  toleranceChanges: F6ToleranceChange[];
  residualError: number;
};

type F6ApportionmentResult = {
  policy: "proportional-to-contribution" | "equal-allocation-among-top-N" | "bounded-by-capability" | "residual-after-centering";
  targetRssSigma: number;
  allocations: Array<{ tableId: string; sourceRow: number; targetSigma: number; targetTolerance: number }>;
  residualError: number;
  feasibility: F6FeasibilityAssessment;
};

type F6CapabilityBound = {
  tableId: string;
  sourceRow: number;
  minimumToleranceBand: number;
  maximumToleranceBand: number;
  evidenceReference: string;
};

type F6FeasibilityAssessment = {
  status: "supported" | "requires_engineering_review" | "insufficient_evidence" | "not_supported";
  reasonCodes: string[];
  evidenceReferences: string[];
};
```

Define `f6OptionSchema` as a discriminated union on `status`:

```ts
const f6CompletedOptionSchema = z.object({
  status: z.literal("completed"),
  optionId: z.string().min(1),
  optionKind: f6OptionKindSchema,
  baselineMetrics: f6MetricsSchema,
  resultMetrics: f6MetricsSchema,
  deltaCpk: z.number().finite(),
  deltaCp: z.number().finite(),
  deltaRssSigma: z.number().finite(),
  deltaDpm: z.number().finite(),
  deltaYield: z.number().finite(),
  factorOverrides: z.array(f6FactorOverrideSchema),
  toleranceChanges: z.array(f6ToleranceChangeSchema),
  reverseSolve: f6ReverseSolveResultSchema.optional(),
  apportionment: f6ApportionmentResultSchema.optional(),
  feasibility: f6FeasibilityAssessmentSchema,
  evidenceReferences: z.array(controlledReferenceSchema),
  relativeCost: z.union([z.number().finite().nonnegative(), z.literal("insufficient_evidence")]),
  roiScore: z.union([z.number().finite(), z.literal("not_computed")]),
  impactRank: z.number().int().positive().nullable(),
  calculationTrace: controlledReferenceSchema,
}).strict();

const f6CalculationFailedOptionSchema = z.object({
  status: z.literal("calculation_failed"),
  optionId: z.string().min(1),
  optionKind: f6OptionKindSchema,
  reasonCode: z.string().min(1),
  evidenceReferences: z.array(controlledReferenceSchema),
  impactRank: z.null(),
}).strict();

const f6InsufficientEvidenceOptionSchema = z.object({
  status: z.literal("insufficient_evidence"),
  optionId: z.string().min(1),
  optionKind: z.enum(["improve_supplier_capability", "tighten_datum_strategy"]),
  predictedImprovement: z.literal("insufficient_evidence"),
  requiredInputs: z.array(z.string().min(1)).min(1),
  evidenceReferences: z.array(controlledReferenceSchema),
  relativeCost: z.literal("insufficient_evidence"),
  roiScore: z.literal("not_computed"),
  impactRank: z.null(),
}).strict();
```

Mirror every DTO above with a strict Zod schema, including `f6ControlledScenarioSchema`, `f6ToleranceChangeSchema`, `f6ReverseSolveResultSchema`, `f6ApportionmentResultSchema`, `f6CapabilityBoundSchema`, and `f6FeasibilityAssessmentSchema`, then export their inferred types. Add strict supplier, datum, and cost evidence schemas with version, source/effective version, and content hash. Define root/worksheet status rules so any `calculation_failed` makes that worksheet/root `partially_completed` when at least one option completed; failed/insufficient options cannot carry result metrics, ranking, or recommendations.

- [ ] **Step 4: Run contracts test and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat(contracts): add F6 optimization contracts"
```

### Task 2: Implement deterministic solver primitives

**Files:**
- Create: `packages/workbook-catalog/src/f6-solver.test.ts`
- Create: `packages/workbook-catalog/src/f6-solver.ts`

- [ ] **Step 1: Write RED solver tests**

Test asymmetric band scaling:

```ts
expect(scaleToleranceBandAroundCenter({ lowerTolerance: -0.1, upperTolerance: 0.3, scale: 0.8 })).toEqual({
  lowerTolerance: -0.06,
  upperTolerance: 0.26,
  center: 0.1,
  originalBand: 0.4,
  resultingBand: 0.32,
});
```

Test stable contributor tie-break by contribution then worksheet/table/source row. Test:

```ts
expect(solveTargetRssSigma({ mean: 1, lowerSpecLimit: 0, upperSpecLimit: 2, targetCpk: 1.33333333333333 }))
  .toBeCloseTo(0.25, 12);
expect(solveCenteringShift({ factorMeans: [0.2, 0.3], lowerSpecLimit: 0, upperSpecLimit: 2 }))
  .toEqual({ targetMean: 1, additionalMeanShift: 0.5 });
```

Reject scale outside `(0,1]`, invalid spec, mean outside spec, nonpositive target Cpk, unreachable single-factor target, and nonfinite inputs.

For every reverse-solve result assert `strategy`, `targetCpk`, `targetRssSigma`, complete `toleranceChanges`, and `residualError`; these exact DTOs must later be embedded in the completed F6 option.

- [ ] **Step 2: Run solver test and verify RED**

Run: `npx vitest run packages/workbook-catalog/src/f6-solver.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement pure solver functions**

Export:

```ts
export function scaleToleranceBandAroundCenter(input: ScaleToleranceBandInput): ScaleToleranceBandResult;
export function selectTopContributors(factors: readonly CalculationCompletedResult["factors"], count: number): readonly CalculationCompletedResult["factors"][number][];
export function solveCenteringShift(input: CenteringInput): CenteringResult;
export function solveTargetRssSigma(input: TargetRssSigmaInput): number;
export function solveSingleFactorTolerance(input: SingleFactorSolveInput): F6ToleranceChange;
export function solveTopNCombinedTolerance(input: TopNSolveInput): readonly F6ToleranceChange[];
```

Use the exact formulas in the approved spec. Keep functions pure and return frozen/readonly values through structured clones at service boundary.

- [ ] **Step 4: Run solver test and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f6-solver.ts packages/workbook-catalog/src/f6-solver.test.ts
git commit -m "feat(f6): add optimization solver primitives"
```

### Task 3: Implement RSS apportionment policies

**Files:**
- Create: `packages/workbook-catalog/src/f6-apportionment.test.ts`
- Create: `packages/workbook-catalog/src/f6-apportionment.ts`

- [ ] **Step 1: Write RED tests for four policies**

Cover `proportional-to-contribution`, `equal-allocation-among-top-N`, `bounded-by-capability`, and `residual-after-centering`. Assert output includes target sigma/tolerance per factor, policy, residual error, feasibility; sum of allocated sigma squares matches target within tolerance. Test bound saturation and infeasible target.

Assert the returned `F6ApportionmentResult` is schema-valid and can be assigned unchanged to a completed option's `apportionment` field.

- [ ] **Step 2: Run apportionment test and verify RED**

Run: `npx vitest run packages/workbook-catalog/src/f6-apportionment.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement policy dispatcher**

Export:

```ts
export function apportionRssTolerance(input: {
  factors: readonly CalculationCompletedResult["factors"];
  targetRssSigma: number;
  policy: "proportional-to-contribution" | "equal-allocation-among-top-N" | "bounded-by-capability" | "residual-after-centering";
  selectedSources: readonly CalculationCompletedResult["factors"][number]["source"][];
  capabilityBounds?: readonly F6CapabilityBound[];
}): F6ApportionmentResult;
```

Do not silently redistribute beyond explicit policy. Return `not_supported` with residual when target cannot be met.

- [ ] **Step 4: Run test and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f6-apportionment.ts packages/workbook-catalog/src/f6-apportionment.test.ts
git commit -m "feat(f6): add RSS apportionment policies"
```

### Task 4: Add capability and evidence feasibility gates

**Files:**
- Create: `packages/workbook-catalog/src/f6-feasibility.test.ts`
- Create: `packages/workbook-catalog/src/f6-feasibility.ts`

- [ ] **Step 1: Write RED tier/evidence tests**

Assert T1 can be `supported/not_supported`; T2/T3 are `requires_engineering_review`; T0/missing is `insufficient_evidence`; `internal_guidance_exceeded` alone is not `not_supported`. Missing supplier/datum/cost returns explicit evidence-limited statuses and never numeric prediction/ROI.

- [ ] **Step 2: Run test and verify RED**

Run: `npx vitest run packages/workbook-catalog/src/f6-feasibility.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement feasibility evaluators**

Export:

```ts
export function assessToleranceFeasibility(input: ToleranceFeasibilityInput): F6FeasibilityAssessment;
export function assessSupplierScenario(evidence?: F6SupplierCapabilityEvidence): F6EvidenceLimitedOption;
export function assessDatumScenario(evidence?: F6DatumStrategyEvidence): F6EvidenceLimitedOption;
export function assessCost(evidence?: F6CostEvidence): { relativeCost: number | "insufficient_evidence"; roiScore: number | "not_computed" };
```

All outputs include evidence references and `requiresEngineeringReview` where applicable.

- [ ] **Step 4: Run test and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f6-feasibility.ts packages/workbook-catalog/src/f6-feasibility.test.ts
git commit -m "feat(f6): govern option feasibility"
```

### Task 5: Add the controlled F4 scenario adapter

**Files:**
- Create: `packages/workbook-catalog/src/f6-scenario-adapter.test.ts`
- Create: `packages/workbook-catalog/src/f6-scenario-adapter.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write RED adapter tests**

Assert one allowlisted F6 scenario is appended to a confidential baseline request, calls `createCalculation`, returns completed scenario/result trace, and preserves workbook/worksheet/table/source identity. Reject unknown source row, extra worksheet, disallowed field, public input, and baseline identity mutation. Assert F4 private helpers remain unexported.

- [ ] **Step 2: Run adapter test and verify RED**

Run: `npx vitest run packages/workbook-catalog/src/f6-scenario-adapter.test.ts`

Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Implement the governed adapter**

```ts
export function calculateF6Scenario(input: {
  readonly baselineRequest: CalculationRequest;
  readonly scenario: F6ControlledScenario;
}): CalculationCompletedResult {
  const request = calculationRequestSchema.parse(input.baselineRequest);
  const scenario = f6ControlledScenarioSchema.parse(input.scenario);
  validateScenarioSources(request, scenario);
  const result = createCalculation({ ...request, scenarioOverrides: [...request.scenarioOverrides, scenario] });
  return calculationCompletedResultSchema.parse(result);
}
```

Export only `calculateF6Scenario`; do not export `createScenarioEntry`, `applyScenarioFactorOverride`, or kernel internals.

- [ ] **Step 4: Run adapter test and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f6-scenario-adapter.ts packages/workbook-catalog/src/f6-scenario-adapter.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat(f6): add controlled scenario adapter"
```

### Task 6: Build the F6 optimization orchestrator

**Files:**
- Create: `packages/workbook-catalog/src/f6-optimization.test.ts`
- Create: `packages/workbook-catalog/src/f6-optimization.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write RED orchestrator tests**

For one valid worksheet assert options include top-1 -20%, top-3 -30%, mean shift, reverse-solve variants, supplier and datum rows. Assert top selections are frozen from baseline; each calculated option has metrics/deltas/trace; reverse options preserve `reverseSolve`; RSS options preserve `apportionment`; missing supplier/datum yields `insufficient_evidence`; missing cost yields `roiScore: "not_computed"`; highest impact ranks by reaches-target, `deltaCpk`, `deltaDpm`, yield, risk closure, feasibility. One `calculation_failed` option yields `partially_completed` but independent options remain and the failed option carries no result metrics/rank/recommendation.

- [ ] **Step 2: Run orchestrator test and verify RED**

Run: `npx vitest run packages/workbook-catalog/src/f6-optimization.test.ts`

Expected: FAIL because orchestrator does not exist.

- [ ] **Step 3: Implement orchestrator**

```ts
export function createF6Optimization(input: unknown): F6OptimizationResult {
  const request = f6OptimizationRequestSchema.parse(structuredClone(input));
  const result = request.worksheets.map((worksheet) => optimizeWorksheet(request, worksheet));
  return deepFreeze(f6OptimizationResultSchema.parse(buildF6Result(request, result)));
}
```

In the same module define private `optimizeWorksheet(request, worksheet)`, `buildF6Result(request, worksheetResults)`, and recursive `deepFreeze(value)` helpers before the exported function. `optimizeWorksheet` performs target selection, option generation/calculation, feasibility and ranking; `buildF6Result` derives root status and summary from worksheet results. Use workbook target first, controlled `1.33` fallback second. Recommendations reference only verified options/evidence-closure actions. Compute ROI only with valid cost evidence.

- [ ] **Step 4: Run orchestrator test and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f6-optimization.ts packages/workbook-catalog/src/f6-optimization.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat(f6): orchestrate optimization options"
```

### Task 7: Load and bind F2/F3/F4/F5 artifacts

**Files:**
- Create: `scripts/f6-artifact-loader.test.mjs`
- Create: `scripts/f6-artifact-loader.mjs`

- [ ] **Step 1: Write RED loader tests**

Build an isolated bundle with ready + blocked worksheets. Assert exact workbook/hash/artifact/selected-set/source-row identity; blocked worksheet is returned only as validation finding; F5 v2 identity is checked; stale/partial/other-run artifacts reject; missing supplier/datum/cost are accepted as absent evidence; mismatched baseline fails closed.

- [ ] **Step 2: Run loader test and verify RED**

Run: `npx vitest run scripts/f6-artifact-loader.test.mjs`

Expected: FAIL because loader does not exist.

- [ ] **Step 3: Implement loader API**

Export `loadF6ArtifactBundle(options)` where `options` has required `f2ArtifactRoot`, `f3ArtifactRoot`, `f4ArtifactRoot`, `f5ArtifactRoot`, and `selectedWorksheetNames`, plus optional image/supplier/datum/cost artifact paths. Return the existing loader-style union `{ status: "accepted", request, blockedWorksheets, sourceReferences } | { status: "inputRejected", reasonCode, artifactReference }`.

Follow F5 loader containment/read/schema patterns. Return accepted request plus blocked validation records; never calculate blocked worksheets.

- [ ] **Step 4: Run loader test and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f6-artifact-loader.mjs scripts/f6-artifact-loader.test.mjs
git commit -m "feat(f6): load governed optimization artifacts"
```

### Task 8: Build and render the composed engineering report

**Files:**
- Create: `packages/workbook-catalog/src/f6-composed-report.test.ts`
- Create: `packages/workbook-catalog/src/f6-composed-report.ts`
- Create: `scripts/f6-report.test.mjs`
- Create: `scripts/f6-report.mjs`
- Create: `scripts/f6-composed-report.test.mjs`
- Create: `scripts/f6-composed-report.mjs`

- [ ] **Step 1: Write RED composed-model and report structure tests**

Test `createF6ComposedEngineeringReport({ f2Report, f5Report, f6Result })` status rules:

```ts
expect(report.overallStatus).toBe("FAIL"); // any computed worksheet Cpk < 1.0
expect(riskReport.overallStatus).toBe("RISK"); // 1.0 <= Cpk < target, blocked worksheet, or open High/Critical risk
expect(passReport.overallStatus).toBe("PASS"); // all selected Cpk >= target and no open High/Critical risk
```

Assert blocked worksheets exist only as input-validation records and have no capability/options. Assert workbook summary selects the worst worksheet without averaging Cpk across CTQs. Assert each recommendation references a verified option ID or evidence-closure action ID.

Assert composed Markdown contains `# F5 + F6 联合工程报告`, workbook summary, and per worksheet exact section order:

```js
[
  "Executive Summary", "Requirement Review", "Input Validation",
  "Capability Assessment", "Contributor Analysis", "Root Cause Analysis",
  "Risk Assessment", "Recommendations", "What-If Analysis", "Final Conclusion",
]
```

Assert max 5 executive bullets and max 10 final bullets; four fixed What-If rows; blocked worksheets only in Input Validation; no full formula trace/source-cell dump; visual FACT/context SIGNAL remain labeled; no datum certainty from unreviewed signal; no `Highest ROI Action` without cost; recommendations reference verified option/evidence action.

Lock exact table headers:

```text
| Item | Value |
| Metric | Result | Status |
| Rank | Contributor | Contribution |
| Risk Area | Rating | Reason |
| Priority | Recommendation | Expected Benefit |
| Scenario | Predicted Improvement |
```

- [ ] **Step 2: Run report tests and verify RED**

Run: `npx vitest run packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-report.test.mjs scripts/f6-composed-report.test.mjs`

Expected: FAIL because renderers do not exist.

- [ ] **Step 3: Implement the composed model and renderers**

Export from the package:

```ts
export function createF6ComposedEngineeringReport(input: {
  f2Report: F2UserReport;
  f5Report: F5DataInterpretationResult;
  f6Result: F6OptimizationResult;
}): F6ComposedEngineeringReport;
```

This service parses all inputs, verifies workbook/worksheet identity, derives workbook and worksheet PASS/FAIL/RISK status, converts blocked worksheets to input-validation records, selects worst capability, and builds the ten fixed sections. It copies verified metrics/options/evidence references but performs no tolerance calculation.

Export `renderF6Report(result, options = {})` and `renderComposedEngineeringReport(report, options = {})`. Both renderers parse their structured input, build a local `lines` array, append every required section in fixed order, and return `${lines.join("\n")}\n`. The composed renderer accepts only `F6ComposedEngineeringReport`, not raw F2/F5/F6 documents.

Renderer consumes parsed artifacts only. Use worst worksheet for workbook status, never aggregate Cpk across CTQs. Show OOS as `1 - yield` and ppm. Keep detailed provenance in JSON/artifact references, not repeated calculation details.

- [ ] **Step 4: Run report tests and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f6-composed-report.ts packages/workbook-catalog/src/f6-composed-report.test.ts packages/workbook-catalog/src/index.ts scripts/f6-report.mjs scripts/f6-report.test.mjs scripts/f6-composed-report.mjs scripts/f6-composed-report.test.mjs
git commit -m "feat(f6): render optimization engineering reports"
```

### Task 9: Add output layout and full validation workflow

**Files:**
- Create: `scripts/f6-output-layout.test.mjs`
- Create: `scripts/f6-output-layout.mjs`
- Create: `scripts/f6-cli-args.test.mjs`
- Create: `scripts/f6-cli-args.mjs`
- Create: `scripts/f6-full-flow.test.mjs`
- Create: `scripts/run-f6-full-validation.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write RED layout/CLI/full-flow tests**

Lock artifacts:

```text
Feature6-Optimization.json
Feature6-Optimization.md
Feature6-Composed-Report.json
Feature6-Composed-Report.md
Feature6-Run-Summary.json
manifest.json
```

CLI shape:

```text
workflow:f6 -- <f2-root> <f3-root> <f4-root> <f5-root>
  --worksheet <name> [--worksheet <name> ...]
  [--supplier-capability <path>] [--datum-strategy <path>]
  [--cost <path>] [--image-observations <path>]
```

Full-flow cases cover mixed ready/blocked, no optional evidence, invalid F5 v2, one option failure, identity mismatch, legacy placeholder compatibility, and old F5 unchanged.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npx vitest run scripts/f6-output-layout.test.mjs scripts/f6-cli-args.test.mjs scripts/f6-full-flow.test.mjs
```

Expected: FAIL because workflow files do not exist.

- [ ] **Step 3: Implement atomic runner and package script**

Runner order:

```text
parse args -> load/validate bundle -> create F6 result
-> create composed report model -> render F6/composed Markdown
-> serialize F6/composed JSON -> hash contents
-> atomically write artifacts -> write manifest last
```

Add only after runner exists:

```json
"workflow:f6": "node scripts/run-f6-full-validation.mjs"
```

- [ ] **Step 4: Run tests and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f6-output-layout.mjs scripts/f6-output-layout.test.mjs scripts/f6-cli-args.mjs scripts/f6-cli-args.test.mjs scripts/run-f6-full-validation.mjs scripts/f6-full-flow.test.mjs package.json
git commit -m "feat(f6): add full optimization workflow"
```

### Task 10: Expose CLI and governance availability

**Files:**
- Create: `apps/cli/src/commands/feature6.test.ts`
- Create: `apps/cli/src/commands/feature6.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `docs/governance/feature-register.md`

- [ ] **Step 1: Write RED CLI/governance tests**

Test exact four roots, repeated worksheet options, optional evidence paths, whitespace rejection, safe child-process output parsing, and typed errors. Update governance expectation from unavailable placeholder to available optimization workflow only after all prerequisites/contracts are named. Add an independent compatibility test that calling `createComparisonPlaceholder()` still returns `feature_not_available` under the legacy `comparison-result-v1` contract.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npx vitest run apps/cli/src/commands/feature6.test.ts apps/cli/src/index.test.ts packages/governance/src/policy-gate.test.ts
```

Expected: FAIL because CLI and available register entry do not exist.

- [ ] **Step 3: Implement CLI and update register**

```ts
export async function runFeature6WorkflowCommand(
  rootDir: string,
  f2ArtifactRoot: string,
  f3ArtifactRoot: string,
  f4ArtifactRoot: string,
  f5ArtifactRoot: string,
  options?: Feature6CommandOptions,
): Promise<string>;
```

Register new input/output contracts, dependencies, confidential max classification, fixtures, and prohibited unsafe behavior. Preserve legacy comparison placeholder as a separate backward-compatible API, not the active workflow contract.

Wire `feature6` through every existing CLI layer:

- Add `"feature6"` to the `Command` union and `isCommand()`.
- Add `runFeature6` to `CliDependencies` for test injection.
- Extend `parseArguments()` with four required roots, repeated `--worksheet`, and optional evidence flags.
- Add a typed `feature6` parsed-command branch.
- Add `executeCommand()` dispatch to `runFeature6WorkflowCommand()`.
- Preserve `executeCli()` safe error sanitization and reject F6-only flags on all other commands.
- Test both package script `workflow:f6` and app CLI `feature6` as separate entrypoints.

- [ ] **Step 4: Run tests and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/cli/src/commands/feature6.ts apps/cli/src/commands/feature6.test.ts apps/cli/src/index.ts apps/cli/src/index.test.ts packages/governance/src/feature-register.ts packages/governance/src/policy-gate.test.ts docs/governance/feature-register.md
git commit -m "feat(f6): expose governed optimization workflow"
```

### Task 11: Document, validate, and run the Maera acceptance flow

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/01-architecture.md`
- Modify: `docs/01-架构映射.md`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/04-feature-breakdown.md`
- Modify: `docs/04-功能拆分.md`

- [ ] **Step 1: Document F6 workflow and report contract**

Document ownership, inputs, deterministic/evidence-limited scenarios, report sections, status rules, Highest Impact vs ROI, legacy placeholder compatibility, and exact CLI. Link both approved specs and plans from `docs/README.md`.

- [ ] **Step 2: Run focused F6 suite**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f6-solver.test.ts packages/workbook-catalog/src/f6-apportionment.test.ts packages/workbook-catalog/src/f6-feasibility.test.ts packages/workbook-catalog/src/f6-scenario-adapter.test.ts packages/workbook-catalog/src/f6-optimization.test.ts packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-artifact-loader.test.mjs scripts/f6-output-layout.test.mjs scripts/f6-cli-args.test.mjs scripts/f6-report.test.mjs scripts/f6-composed-report.test.mjs scripts/f6-full-flow.test.mjs apps/cli/src/commands/feature6.test.ts packages/governance/src/policy-gate.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run build and repository verification**

```powershell
npm run build -- --force
npm run check:repository
```

Expected: both exit 0.

- [ ] **Step 4: Commit docs**

```powershell
git add README.md docs/README.md docs/01-architecture.md docs/01-架构映射.md docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/04-feature-breakdown.md docs/04-功能拆分.md
git commit -m "docs: document F6 optimization workflow"
```

- [ ] **Step 5: Run complete suite**

Run: `npm test`

Expected: all test files pass; environment-specific symlink tests may remain skipped.

- [ ] **Step 6: Execute Maera gap acceptance**

Use read-only workbook `C:\Users\xumax\AI Project\AI TVA Analysis\test\Maera_gap_TP_brkt_and _battery_20260305V1 - test.xlsx`. Re-run the controlled F0-F5 workflow and select these ready worksheets:

```text
gap wo rubber_static
gap w rubber_TPoverload500g(2)
gap w rubber_TPoverload500g
gap w rubber_static
```

Verify these blocked worksheets remain validation-only:

```text
gap w foam_TPoverload500g
gap w foam_static
```

Run F6 with roots returned by that same run:

```powershell
npm run workflow:f6 -- "<validated-f2-root>" "<validated-f3-root>" "<validated-f4-root>" "<validated-f5-root>" --worksheet "gap wo rubber_static" --worksheet "gap w rubber_TPoverload500g(2)" --worksheet "gap w rubber_TPoverload500g" --worksheet "gap w rubber_static" --image-observations "<validated-v2-observation-path>"
```

Expected status: `completed` or `partially_completed` only when an individual option is explicitly `calculation_failed`; output root must contain all six fixed artifacts from Task 9. Parse the JSON artifacts and verify:

- F2 blocked worksheets appear only in workbook Input Validation.
- Four ready worksheets receive complete composed subreports.
- Worst below-target worksheet drives workbook summary.
- Top 1 -20% and Top 3 -30% include deterministic `deltaCpk`, `deltaDpm`, and yield delta.
- Supplier/Datum show `insufficient_evidence` without estimates.
- F5 visual/context evidence remains FACT/SIGNAL.
- Recommendations reference verified options/evidence actions.
- ROI is `not_computed` without cost; Highest Impact Action is present.

- [ ] **Step 7: Verify branch state**

Run: `git status --short --branch`

Expected: clean branch `user/xumax/F5-F6-contextual-image-observations-report-optimization`.