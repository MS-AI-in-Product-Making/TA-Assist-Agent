# F1 All Worksheets and F6 Report Optimization V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 F1 完整发布 workbook 全部 worksheets，并让 F6 以可读的连续章节展示 Revision、通俗判定和受治理的 Top-3 三方案公差重算。

**Architecture:** F1 新增独立的 workbook sheet inventory 与 all-sheet asset publisher，和 TA selection/downstream 数据面分离；Revision 通过 F1/F2 contract 显式传递。F6 Optimization v2 新增唯一的版本化内建 policy，复用 F4 scenario calculation 产生 OP1/OP2/OP3；最终报告只投影已验证结果，不自行实现 capability 数学。

**Tech Stack:** TypeScript、Node.js ESM、Zod、Vitest、OOXML ZIP/XML reader、Markdown artifact pipeline

**Spec:** `docs/superpowers/specs/2026-08-21-f1-all-worksheets-f6-report-optimization-v2-design.md`

## Global Constraints

- 分支固定为 `user/xumax/feature6-report-optimization-v2`，worktree 固定为 `.worktrees/feature6-report-optimization-v2`。
- F4 `excel-ta-v1` 是 Mean、RSS、Worst Case、Cp/Cpk、Yield、DPM 和 scenario result 的唯一数值真源。
- 内建 policy ID 固定为 `f6-top3-tolerance-policy-v1`；不得增加其他自动比例。
- 触发条件固定为 `lowerCpk < targetCpk || upperCpk < targetCpk`，其中 target 来自 worksheet。
- OP1 固定为 Top1 25%、Top2/3 10%；OP2 固定为 Top1 20%、Top2/3 15%；OP3 固定为 Top1 40%、Top2/3 5%。
- 非 TA worksheets 只进入 F1 extraction，不得进入 F2-F6 selection、governance 或 calculation。
- 图片、workbook 和 artifact 继续遵守 containment、non-linked、identity、hash 与 confidential classification 边界。
- 所有 production behavior 必须先有对应失败测试并观察到预期 RED。
- 不修改源 Excel，不改变 F3 ADO publishing protocol，不计算成本或 ROI。

---

### Task 1: Expose Complete OOXML Worksheet Inventory

**Files:**
- Modify: `packages/workbook-catalog/src/ooxml-reader.ts`
- Modify: `packages/workbook-catalog/src/ooxml-reader.test.ts`
- Modify: `packages/workbook-catalog/src/test-support.ts`
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/workbook-catalog/src/workbook-catalog.ts`
- Modify: `packages/workbook-catalog/src/workbook-catalog.test.ts`

**Interfaces:**
- Consumes: existing `readOoxmlWorkbook(bytes, worksheetNames?, includeImages?, cellWindow?, options?)`.
- Produces: `OoxmlWorkbook.worksheetInventory` in workbook order and `WorkbookCatalog.workbook.worksheetInventory` with classification fields.
- Preserves: existing `worksheets` map, `worksheetNames`, and `analyses` semantics.

- [ ] **Step 1: Write the failing OOXML inventory test**

Add a fixture with visible, hidden, and veryHidden sheets and assert source order and relationship identity:

```ts
it("exposes every worksheet in workbook order with visibility and source identity", () => {
  const workbook = readOoxmlWorkbook(createAnonymousWorkbookZip({
    sheets: [
      { name: "Title Page", state: "visible" },
      { name: "Hidden Notes", state: "hidden" },
      { name: "Auto Summary", state: "veryHidden" },
      { name: "Analysis-A", state: "visible" },
    ],
  }));

  expect(workbook.worksheetInventory).toEqual([
    expect.objectContaining({ worksheetName: "Title Page", worksheetIndex: 0, visibility: "visible", partName: "xl/worksheets/sheet1.xml" }),
    expect.objectContaining({ worksheetName: "Hidden Notes", worksheetIndex: 1, visibility: "hidden", partName: "xl/worksheets/sheet2.xml" }),
    expect.objectContaining({ worksheetName: "Auto Summary", worksheetIndex: 2, visibility: "veryHidden", partName: "xl/worksheets/sheet3.xml" }),
    expect.objectContaining({ worksheetName: "Analysis-A", worksheetIndex: 3, visibility: "visible", partName: "xl/worksheets/sheet4.xml" }),
  ]);
});
```

- [ ] **Step 2: Run the OOXML test and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/ooxml-reader.test.ts -t "exposes every worksheet"
```

Expected: FAIL because `worksheetInventory` is absent.

- [ ] **Step 3: Implement the minimal OOXML inventory**

Add exact public types:

```ts
export type OoxmlWorksheetVisibility = "visible" | "hidden" | "veryHidden";

export type OoxmlWorksheetInfo = {
  readonly worksheetName: string;
  readonly worksheetIndex: number;
  readonly visibility: OoxmlWorksheetVisibility;
  readonly relationshipId: string;
  readonly partName: string;
};

export type OoxmlWorkbook = {
  readonly worksheets: ReadonlyMap<string, OoxmlWorksheet>;
  readonly worksheetNames: readonly string[];
  readonly worksheetInventory: readonly OoxmlWorksheetInfo[];
};
```

Parse each `<sheet>` in source order. Treat an absent `state` as `visible`; reject unsupported state values through the existing controlled OOXML error path. Resolve `r:id` through workbook relationships once and use the same resolved `partName` for inventory and worksheet loading.

- [ ] **Step 4: Run OOXML tests and verify GREEN**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/ooxml-reader.test.ts
```

Expected: PASS with existing archive and XML limits unchanged.

- [ ] **Step 5: Write failing catalog/schema tests**

Add a strict inventory schema and assert sheet classification without changing TA analyses:

```ts
it("records all workbook sheets while keeping analyses limited to TA sheets", () => {
  const result = createWorkbookCatalog(workbookRequestWithTitleSummaryTemplateAndAnalysis());

  expect(result.workbook.worksheetInventory.map(({ worksheetName, worksheetKind }) => ({ worksheetName, worksheetKind }))).toEqual([
    { worksheetName: "Title Page", worksheetKind: "title_page" },
    { worksheetName: "Auto Summary", worksheetKind: "summary" },
    { worksheetName: "Analysis-A", worksheetKind: "analysis" },
    { worksheetName: "Example_TA", worksheetKind: "example_or_template" },
  ]);
  expect(result.analyses.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A", "Example_TA"]);
});
```

Add schema rejection tests for duplicate `worksheetIndex`, duplicate names, non-contiguous ordering, and mismatched inventory/OOXML source part.

- [ ] **Step 6: Run catalog/schema tests and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/workbook-catalog.test.ts packages/contracts/src/contracts.test.ts -t "worksheet inventory|all workbook sheets"
```

Expected: FAIL because catalog and contracts do not expose inventory.

- [ ] **Step 7: Implement inventory contracts and classification**

Add:

```ts
export const worksheetKindSchema = z.enum([
  "title_page",
  "summary",
  "analysis",
  "example_or_template",
  "other",
]);
```

Add `worksheetInventory` under each F1 workbook identity with strict unique name/index validation. Classify known role sheets by workbook structure and existing analysis discovery results; do not infer TA eligibility from arbitrary substrings alone. Keep `analyses` unchanged.

- [ ] **Step 8: Run focused tests and build**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/ooxml-reader.test.ts packages/workbook-catalog/src/workbook-catalog.test.ts packages/contracts/src/contracts.test.ts
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```powershell
git add packages/workbook-catalog/src/ooxml-reader.ts packages/workbook-catalog/src/ooxml-reader.test.ts packages/workbook-catalog/src/test-support.ts packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/workbook-catalog.ts packages/workbook-catalog/src/workbook-catalog.test.ts
git commit -m "feat(f1): expose complete worksheet inventory"
```

---

### Task 2: Publish Full F1 Assets for Every Worksheet

**Files:**
- Create: `packages/workbook-catalog/src/workbook-sheet-assets.ts`
- Create: `packages/workbook-catalog/src/workbook-sheet-assets.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `scripts/run-f1-full-validation.mjs`
- Modify: `scripts/f1-output-layout.mjs`
- Modify: `scripts/f1-output-layout.test.mjs`
- Modify: `scripts/f2-excel-runner.test.mjs`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

**Interfaces:**
- Consumes: `OoxmlWorkbook.worksheetInventory`, full worksheet cells/images, F1 output root.
- Produces: `createWorkbookSheetAssets(request): WorkbookSheetAssetsResult` for every worksheet.
- Preserves: `createWorksheetAnalysisAssetsParallel()` as analysis-only and selected-scope only.

- [ ] **Step 1: Write the failing all-sheet asset test**

```ts
it("creates JSON Markdown and image records for every worksheet without widening TA selection", async () => {
  const result = await createWorkbookSheetAssets({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookBytes: workbookWithTitleSummaryAnalysisAndTemplate(),
    workbookCatalog: createWorkbookCatalog(catalogRequest()),
  });

  expect(result.worksheets.map(({ worksheetName }) => worksheetName)).toEqual([
    "Title Page",
    "Auto Summary",
    "Analysis-A",
    "Example_TA",
  ]);
  expect(result.worksheets.every(({ jsonDocument, markdown }) => jsonDocument && markdown)).toBe(true);
  expect(result.worksheets.find(({ worksheetName }) => worksheetName === "Title Page")?.images).toHaveLength(1);
  expect(result.worksheets.find(({ worksheetName }) => worksheetName === "Auto Summary")?.images).toEqual([]);
});
```

- [ ] **Step 2: Run the asset test and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/workbook-sheet-assets.test.ts
```

Expected: FAIL because module/API does not exist.

- [ ] **Step 3: Implement the focused all-sheet asset module**

Define:

```ts
export type WorkbookSheetAsset = {
  readonly worksheetName: string;
  readonly worksheetIndex: number;
  readonly visibility: "visible" | "hidden" | "veryHidden";
  readonly worksheetKind: "title_page" | "summary" | "analysis" | "example_or_template" | "other";
  readonly sourcePart: string;
  readonly jsonDocument: Readonly<Record<string, unknown>>;
  readonly markdown: string;
  readonly images: readonly OoxmlImage[];
};

export function createWorkbookSheetAssets(request: WorkbookSheetAssetsRequest): WorkbookSheetAssetsResult;
```

Reuse existing value-origin, display-value, image extraction, safe slug, and Markdown escaping helpers. Do not call TA factor detection for non-analysis sheets. Preserve cells/formulas and the existing image bytes/reference model; empty images are valid.

- [ ] **Step 4: Run the asset test and verify GREEN**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/workbook-sheet-assets.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing runner/output-layout tests**

Assert that a confirmed F1 run publishes all sheets while selected TA scope remains exact:

```js
expect(report.workbooks[0].allWorksheetOutputs.map(({ worksheetName }) => worksheetName)).toEqual([
  "Title Page",
  "Auto Summary",
  "Analysis-A",
  "Example_TA",
]);
expect(report.workbooks[0].task13_pre_analysis_selection.selectedWorksheetNames).toEqual(["Analysis-A"]);
expect(report.workbooks[0].task14_parallel_processing.pages.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
```

Assert the output layout contains one JSON and one Markdown per inventory entry and only actual image files for sheets that contain images.

- [ ] **Step 6: Run runner/output tests and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f1-output-layout.test.mjs scripts/f2-excel-runner.test.mjs packages/workbook-catalog/src/worksheet-analysis-assets.test.ts
```

Expected: FAIL because F1 runner only publishes selected analysis assets.

- [ ] **Step 7: Integrate all-sheet publishing without widening downstream scope**

In `run-f1-full-validation.mjs`:

1. Build catalog and confirmed TA selection as today.
2. Build all-sheet assets from the unfiltered OOXML workbook.
3. Publish each all-sheet JSON/Markdown/image beneath the existing F1 sheet root.
4. Publish selected analysis assets/handoff data through the existing path.
5. Record inventory output references and extraction status in `Feature1-Report.json`.

Keep F2 loader inputs derived only from `task13_pre_analysis_selection` and selected analysis output records.

- [ ] **Step 8: Run focused F1/F2 boundary tests**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/workbook-sheet-assets.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts scripts/f1-output-layout.test.mjs scripts/f2-excel-runner.test.mjs scripts/f2-artifact-loader.test.mjs scripts/f2-full-flow.test.mjs
npm run build -- --force
```

Expected: PASS; non-TA names never appear in F2 worksheets/handoffs.

- [ ] **Step 9: Commit Task 2**

```powershell
git add packages/workbook-catalog/src/workbook-sheet-assets.ts packages/workbook-catalog/src/workbook-sheet-assets.test.ts packages/workbook-catalog/src/index.ts packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts scripts/run-f1-full-validation.mjs scripts/f1-output-layout.mjs scripts/f1-output-layout.test.mjs scripts/f2-excel-runner.test.mjs packages/workbook-catalog/src/worksheet-analysis-assets.test.ts
git commit -m "feat(f1): publish assets for every worksheet"
```

---

### Task 3: Propagate Title Page Revision Through F2 to F6

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `scripts/f2-artifact-loader.mjs`
- Modify: `scripts/f2-artifact-loader.test.mjs`
- Modify: `packages/workbook-catalog/src/f2-user-report.ts`
- Modify: `packages/workbook-catalog/src/f2-user-report.test.ts`
- Modify: `scripts/f2-full-flow.test.mjs`
- Modify: `scripts/f6-artifact-loader.test.mjs`

**Interfaces:**
- Consumes: `Feature1-Report.json -> workbooks[0].workbook.metadata.revision`.
- Produces: `Feature2-Report.json -> workbook.revision: string | null`.
- Later consumer: `createF6FinalReportProjection()`.

- [ ] **Step 1: Write failing revision propagation tests**

```js
it("propagates the F1 Title Page revision into the F2 workbook identity", () => {
  const bundle = createBundle();
  const report = JSON.parse(readFileSync(bundle.f1ReportPath, "utf8"));
  report.workbooks[0].workbook.metadata.revision = "D";
  writeFileSync(bundle.f1ReportPath, JSON.stringify(report));

  const loaded = loadF1ArtifactBundle(bundle.f1Root);

  expect(loaded.status).toBe("accepted");
  expect(loaded.input.workbook.revision).toBe("D");
});
```

Add schema tests that accept `revision: "D"` and `revision: null`, reject blank strings, and allow missing revision only for explicitly historical read compatibility.

- [ ] **Step 2: Run revision tests and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f2-artifact-loader.test.mjs packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f2-user-report.test.ts -t "revision|Title Page"
```

Expected: FAIL because F2 workbook schema and loader omit revision.

- [ ] **Step 3: Implement the revision contract and mapping**

Extend current-run F2 workbook identity with:

```ts
revision: z.string().trim().min(1).nullable()
```

Map the validated F1 metadata value exactly. Use `null` when the Title Page field is absent; do not parse filename or other workbook text. Ensure `createF2UserReport` preserves the field unchanged.

- [ ] **Step 4: Run F2 and loader tests and verify GREEN**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f2-artifact-loader.test.mjs packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-full-flow.test.mjs scripts/f6-artifact-loader.test.mjs
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts scripts/f2-artifact-loader.mjs scripts/f2-artifact-loader.test.mjs packages/workbook-catalog/src/f2-user-report.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-full-flow.test.mjs scripts/f6-artifact-loader.test.mjs
git commit -m "feat(f2): preserve workbook revision provenance"
```

---

### Task 4: Extend F6 V2 Contracts for Built-In Policy Results

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `scripts/f6-artifact-test-fixture.mjs`
- Modify: `scripts/f6-artifact-loader.test.mjs`

**Interfaces:**
- Consumes: existing `f6OptionV2Schema`, `f6MetricsV2Schema`, `F6FactorIdentity`.
- Produces: policy provenance on completed/calculation-failed options and side-specific capability metrics.
- Preserves: caller target option fields and input decision ledgers.

- [ ] **Step 1: Write failing F6 contract tests**

Add a valid built-in completed option:

```ts
const builtInOption = {
  optionId: "Analysis-A:builtin-top3:OP1",
  status: "completed",
  optionSource: "BUILT_IN_POLICY",
  policyContext: {
    policyId: "f6-top3-tolerance-policy-v1",
    optionCode: "OP1",
    trigger: {
      lowerCpk: 1.21,
      upperCpk: 3.57,
      targetCpk: 1.33333333333333,
      failedSides: ["lowerCpk"],
    },
    selectedFactorCount: 3,
    reductions: [
      { factor: factorA, rank: 1, reductionRatio: 0.25, scale: 0.75 },
      { factor: factorB, rank: 2, reductionRatio: 0.10, scale: 0.90 },
      { factor: factorC, rank: 3, reductionRatio: 0.10, scale: 0.90 },
    ],
  },
  baselineMetrics: metrics,
  resultMetrics: {
    ...metrics,
    lowerCpk: 1.40,
    upperCpk: 4.10,
    capabilityStatus: "PASS",
  },
  scenarioEvidence,
  impactRank: null,
};
```

Assert rejection for wrong policy ID, OP1 ratios that do not equal `0.25/0.10/0.10`, duplicate ranks, `scale !== 1 - reductionRatio`, mismatched factor identities, missing side metrics, or option IDs outside the built-in namespace.

- [ ] **Step 2: Run contract tests and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts -t "built-in top3|policy context|side capability"
```

Expected: FAIL because policy context and side metrics are not in V2 schemas.

- [ ] **Step 3: Implement strict policy and metrics schemas**

Add:

```ts
const f6BuiltInPolicyIdSchema = z.literal("f6-top3-tolerance-policy-v1");
const f6BuiltInOptionCodeSchema = z.enum(["OP1", "OP2", "OP3"]);
const f6OptionSourceSchema = z.enum(["BUILT_IN_POLICY", "CALLER_TARGET"]);
```

Extend V2 metrics with finite `lowerCpk`, `upperCpk`, and `capabilityStatus: PASS | FAIL`. Add a strict `policyContext` union only for `BUILT_IN_POLICY`. Require caller options to retain `targetId`/target provenance and forbid built-in policy context.

Encode the allowed reduction matrix in a single exported constant or schema refinement used by both contracts and optimizer; do not duplicate ratio tables.

- [ ] **Step 4: Update F6 fixture and artifact-loader tests**

Make fixture-generated metrics include side Cpk values. Add round-trip tests proving built-in options survive Optimization JSON parse/readback and caller targets remain unchanged.

- [ ] **Step 5: Run contract/loader tests and verify GREEN**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts scripts/f6-artifact-loader.test.mjs
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts scripts/f6-artifact-test-fixture.mjs scripts/f6-artifact-loader.test.mjs
git commit -m "feat(f6): define built-in tolerance policy contract"
```

---

### Task 5: Generate and Recalculate OP1 OP2 OP3

**Files:**
- Modify: `packages/workbook-catalog/src/f6-solver.ts`
- Modify: `packages/workbook-catalog/src/f6-solver.test.ts`
- Modify: `packages/workbook-catalog/src/f6-optimization.ts`
- Modify: `packages/workbook-catalog/src/f6-optimization.test.ts`
- Modify: `packages/workbook-catalog/src/f6-scenario-adapter.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

**Interfaces:**
- Consumes: baseline F4 calculation, worksheet `targetCpk`, existing `scaleToleranceBandAroundCenter`, `calculateF6Scenario`.
- Produces: `createBuiltInTop3ToleranceOptions(...)` and completed/failed V2 options.
- Preserves: caller-authorized target option flow and candidate fallback for passing/no-target worksheets.

- [ ] **Step 1: Write failing stable Top-3 selection tests**

```ts
it("orders equal contributors by source row and then stable factor identity", () => {
  const selected = selectPolicyTopContributors(equalContributionFactorsOutOfOrder(), 3);
  expect(selected.map(({ source, factorName }) => [source.sourceRow, factorName])).toEqual([
    [14, "Factor A"],
    [15, "Factor B"],
    [15, "Factor C"],
  ]);
});
```

- [ ] **Step 2: Run solver test and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f6-solver.test.ts -t "equal contributors"
```

Expected: FAIL because policy-specific stable selector does not exist.

- [ ] **Step 3: Implement `selectPolicyTopContributors`**

Sort by contribution descending, source row ascending, then a stable identity tuple of worksheet/table/factor name. Return at most `min(3, factors.length)` and do not mutate input.

- [ ] **Step 4: Run solver tests and verify GREEN**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f6-solver.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing optimizer gate and ratio tests**

Add separate tests for:

```ts
it("uses worksheet target Cpk to trigger exactly OP1 OP2 OP3", () => { /* lowerCpk below target */ });
it("does not generate built-in options when both side Cpk values meet target", () => { /* passing */ });
it("freezes baseline top three and preserves each tolerance band center", () => { /* exact ratios */ });
it("uses all available factors when fewer than three exist", () => { /* two factors */ });
it("isolates one policy scenario failure while completing the other options", () => { /* OP2 throws */ });
it("keeps built-in and caller-authorized options with unique stable IDs", () => { /* coexistence */ });
```

For the ratio test, assert exact reductions:

```ts
expect(policyRatios(options)).toEqual({
  OP1: [0.25, 0.10, 0.10],
  OP2: [0.20, 0.15, 0.15],
  OP3: [0.40, 0.05, 0.05],
});
expect(options.flatMap(policyCenters)).toEqual(options.flatMap(baselineCenters));
```

- [ ] **Step 6: Run optimizer tests and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f6-optimization.test.ts -t "worksheet target Cpk|built-in options|baseline top three|fewer than three|policy scenario failure|caller-authorized"
```

Expected: FAIL because current no-target path returns only a candidate.

- [ ] **Step 7: Implement the built-in scenario factory**

Define the public constants and focused factory:

```ts
export const F6_TOP3_TOLERANCE_POLICY_ID = "f6-top3-tolerance-policy-v1" as const;

export const F6_TOP3_TOLERANCE_OPTIONS = {
  OP1: [0.25, 0.10, 0.10],
  OP2: [0.20, 0.15, 0.15],
  OP3: [0.40, 0.05, 0.05],
} as const;

export function createBuiltInTop3ToleranceOptions(input: {
  readonly worksheet: F6OptimizationRequestWorksheet;
  readonly baselineRequest: CalculationRequest;
  readonly calculateScenario?: typeof calculateF6Scenario;
}): readonly F6OptionV2[];
```

Use `baseline.capability.lowerCpk`, `upperCpk`, and `targetCpk` for the gate. Build overrides only through `scaleToleranceBandAroundCenter`. Read all result metrics from the F4 calculation result. Catch errors per option and sanitize failure reason codes.

Compose options in stable order:

```ts
const options = [
  ...builtInOptions,
  ...callerTargetOptions,
  ...(builtInOptions.length === 0 && callerTargetOptions.length === 0 ? [candidateOption] : []),
];
```

- [ ] **Step 8: Run optimizer/scenario tests and verify GREEN**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f6-solver.test.ts packages/workbook-catalog/src/f6-optimization.test.ts packages/workbook-catalog/src/f6-scenario-adapter.test.ts
npm run build -- --force
```

Expected: PASS; summary counts match the option union and a single failed OP yields partial completion without stopping peers.

- [ ] **Step 9: Commit Task 5**

```powershell
git add packages/workbook-catalog/src/f6-solver.ts packages/workbook-catalog/src/f6-solver.test.ts packages/workbook-catalog/src/f6-optimization.ts packages/workbook-catalog/src/f6-optimization.test.ts packages/workbook-catalog/src/f6-scenario-adapter.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat(f6): recalculate governed top3 tolerance options"
```

---

### Task 6: Render the Revised Final and Optimization Reports

**Files:**
- Modify: `scripts/f6-final-report.mjs`
- Modify: `scripts/f6-final-report.test.mjs`
- Modify: `scripts/f6-report.mjs`
- Modify: `scripts/f6-report.test.mjs`
- Modify: `.github/report_template.md`

**Interfaces:**
- Consumes: validated F2/F3/F4/F5 reports and F6 Optimization v2 policy options.
- Produces: revised `Feature6-Report.md` and policy-aware `Feature6-Optimization.md`.
- Preserves: `reportSummary` as the only structured disposition projection and F6 JSON as the only optimization data contract.

- [ ] **Step 1: Write failing document control and section tests**

```js
it("renders revision, compact timestamp, plain findings, and continuous worksheet sections", () => {
  const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
  inputs.f2Report.workbook.revision = "D";

  const { markdown } = createF6FinalReportProjection({
    ...inputs,
    generatedAt: "2026-08-20T11:25:45.098Z",
  });

  expect(markdown).toContain("| Workbook Revision | D | F1 workbook metadata |");
  expect(markdown).toContain("| Report Generated At | 2026-08-20 11:25:45 | Report runtime |");
  expect(markdown).not.toContain("| Project |");
  expect(markdown).not.toContain("| Workbook Hash |");
  expect(markdown).not.toContain("| Controlled Versions |");
  expect(markdown).toContain("| Tolerance Loop Description |");
  expect(markdown).not.toContain("| Primary Finding |");
  expect(markdown).toContain("## 3.3 Tolerance Path Image");
  expect(markdown).toContain("## 3.4 输入数据");
  expect(markdown).toContain("## 3.5 结果与规格符合性");
  expect(markdown).toContain("## 3.6 贡献与敏感度");
  expect(markdown).not.toContain("模型假设与计算方法");
});
```

Add assertions for `Design Nominal`, `Mean`, absence of `F3 Governance`, four-state explanation text, and open-item-specific Key Finding/one-line conclusion.

- [ ] **Step 2: Run final report tests and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f6-final-report.test.mjs -t "revision|compact timestamp|continuous worksheet|plain findings"
```

Expected: FAIL against current report structure.

- [ ] **Step 3: Implement report helpers and structural cleanup**

Add:

```js
export function formatReportTimestamp(value) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error("invalid_report_timestamp");
  return instant.toISOString().slice(0, 19).replace("T", " ");
}
```

Add focused helpers for plain finding text and required action. Build conditional-pass text from actual open items, naming Drawing Number, DIM ID, image review, or engineering review rather than using a generic phrase.

Render Design Nominal from `f4Calculation.system.designNominal`. Remove methods rendering from the worksheet composition. Renumber render calls to 3.1-3.6.

- [ ] **Step 4: Implement safe image-only rendering**

Replace the image section with one validated link. Reject absolute references and `..`; resolve the physical image beneath `f1ArtifactRoot`, ensure it remains within the controlled publish root, and create an output-root-relative forward-slash URI-encoded link:

```md
[Open tolerance path image](<../../controlled/f1/sheets/.../image.png>)
```

Do not render artifact/hash/evaluation/review prose in 3.3.

- [ ] **Step 5: Run report tests and verify GREEN for structural changes**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f6-final-report.test.mjs
```

Expected: PASS for Document Control, wording, numbering, field names, and image safety tests.

- [ ] **Step 6: Write failing Optimize rendering tests**

```js
it("renders 3.7 Optimize only for under-target worksheets from policy options", () => {
  const inputs = underTargetInputsWithBuiltInOptions();
  const { markdown } = createF6FinalReportProjection(inputs);

  expect(markdown).toContain("## 3.7 Optimize");
  expect(markdown).toContain("| Rank | Factor | Source Row | Current +Tol | Current -Tol | OP1 | OP2 | OP3 |");
  expect(markdown).toContain("| Scenario | CpkL | CpkU | Cpk | RSS 1σ | 4σ Range | Worst-Case Range | Capability |");
  expect(markdown).toContain("f6-top3-tolerance-policy-v1");
  expect(markdown).toContain("不等于供应商实测能力");
});

it("omits 3.7 Optimize for a worksheet whose two side Cpk values meet target", () => {
  const { markdown } = createF6FinalReportProjection(passingInputsWithoutBuiltInOptions());
  expect(markdown).not.toContain("## 3.7 Optimize");
});
```

- [ ] **Step 7: Run Optimize tests and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f6-final-report.test.mjs scripts/f6-report.test.mjs -t "Optimize|built-in policy"
```

Expected: FAIL because renderer does not project built-in options.

- [ ] **Step 8: Implement policy option projection without recalculation**

Add `createOptimizeProjection({ f4Calculation, f6Worksheet })`. It may format ranges from already validated `mean`, `rssSigma`, `targetSigmaLevel`, and worst-case metrics, but must not recompute Cp/Cpk/Yield/DPM. Read CpkL/CpkU/status from option result metrics. Include baseline and OP1-OP3 rows, delta columns, factor reductions, and calculation references.

Update `f6-report.mjs` to display built-in policy provenance separately from caller targets.

- [ ] **Step 9: Update the report template and run renderer tests**

Bring `.github/report_template.md` in line with the implemented sections and conditional Optimize rule. Then run:

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f6-final-report.test.mjs scripts/f6-report.test.mjs
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 10: Commit Task 6**

```powershell
git add scripts/f6-final-report.mjs scripts/f6-final-report.test.mjs scripts/f6-report.mjs scripts/f6-report.test.mjs .github/report_template.md
git commit -m "feat(f6): simplify final report and show optimize options"
```

---

### Task 7: Integrate Run Summary, Governance, Documentation, and End-to-End Verification

**Files:**
- Modify: `scripts/run-f6-full-validation.mjs`
- Modify: `scripts/f6-full-flow.test.mjs`
- Modify: `scripts/f6-output-layout.test.mjs`
- Modify: `scripts/verify-current-f6.mjs`
- Modify: `scripts/verify-current-f6.test.mjs`
- Modify: `.github/skills/f6-analysis/SKILL.md`
- Modify: `scripts/f6-skill.test.mjs`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/governance/feature-register.md`
- Modify: `docs/README.md`
- Modify: repository README only if it currently states that all no-target F6 runs are candidate-only

**Interfaces:**
- Consumes: complete F1/F2/F6 contracts and built-in policy options.
- Produces: hash-bound five-file F6 output whose summary/verifier recognizes policy provenance.
- Preserves: separate Analysis Context/Optimization Targets decision ledgers.

- [ ] **Step 1: Write failing full-flow and verifier tests**

Add a full-flow fixture with one under-target ready worksheet, one passing ready worksheet, and one F2 blocked worksheet. Assert:

```js
expect(runSummary.inputDecisions.optimizationTargets.outcome).toBe("NOT_PROVIDED");
expect(runSummary.counts.completedOptionCount).toBe(3);
expect(optimization.worksheets[0].options.map(({ policyContext }) => policyContext.optionCode)).toEqual(["OP1", "OP2", "OP3"]);
expect(optimization.worksheets[1].options.some(({ optionSource }) => optionSource === "BUILT_IN_POLICY")).toBe(false);
expect(runSummary.reportSummary.worksheetDispositions).toContainEqual({ worksheetName: "Blocked-A", disposition: "FAIL" });
expect(manifest.inputDecisions).toEqual(runSummary.inputDecisions);
```

Assert the verifier accepts the five files and all three recorded output hashes after policy scenarios are present.

- [ ] **Step 2: Run full-flow tests and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f6-full-flow.test.mjs scripts/f6-output-layout.test.mjs scripts/verify-current-f6.test.mjs -t "built-in policy|under-target|five-file"
```

Expected: FAIL because runner/verifier do not yet expose policy scenarios and revised report hash.

- [ ] **Step 3: Integrate runner summaries and verification**

Continue deriving counts from `optimization.summary`; do not add a parallel counter. Ensure report rendering receives F2 revision and policy options. Keep manifest input decisions unchanged: built-in policy provenance belongs to Optimization options, not `optimizationTargets` authorization.

Update current artifact verification to validate:

- strict built-in policy schema and stable IDs
- reportSummary subset/blocked placement
- source artifact basenames and hashes
- optimization JSON/MD/final report hashes
- exactly five successful output files

- [ ] **Step 4: Run integration tests and verify GREEN**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f6-full-flow.test.mjs scripts/f6-output-layout.test.mjs scripts/verify-current-f6.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Write the failing F6 skill governance test**

Replace the absolute no-scenario assertion with a narrow exception assertion:

```js
expect(skill).toContain("f6-top3-tolerance-policy-v1");
expect(skill).toContain("CpkL");
expect(skill).toContain("CpkU");
expect(skill).toContain("OP1");
expect(skill).toContain("OP2");
expect(skill).toContain("OP3");
expect(skill).toContain("No other automatic percentage scenario is permitted");
```

Keep assertions that caller targets require separate confirmation and that the built-in exception cannot alter specs, factor selection rules, or percentages.

- [ ] **Step 6: Run skill test and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f6-skill.test.mjs
```

Expected: FAIL because current skill prohibits all no-target scenarios.

- [ ] **Step 7: Update skill and current documentation**

Update W8B/W9 to distinguish:

- caller-authored targets: still require artifact validation and confirmation
- built-in under-target policy: fixed ID, fixed ratios, fixed Top-3 selection, automatic F4 recalculation
- all other automatic percentage scenarios: prohibited

Update English/Chinese end-to-end flow, feature register, and docs index. Historical specs remain unchanged.

- [ ] **Step 8: Run skill/docs/repository tests**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f6-skill.test.mjs scripts/workflow-docs.test.mjs scripts/verify-repository.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Run all focused suites**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/ooxml-reader.test.ts packages/workbook-catalog/src/workbook-catalog.test.ts packages/workbook-catalog/src/workbook-sheet-assets.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts packages/contracts/src/contracts.test.ts scripts/f2-artifact-loader.test.mjs scripts/f2-full-flow.test.mjs packages/workbook-catalog/src/f6-solver.test.ts packages/workbook-catalog/src/f6-optimization.test.ts packages/workbook-catalog/src/f6-scenario-adapter.test.ts scripts/f6-report.test.mjs scripts/f6-final-report.test.mjs scripts/f6-artifact-loader.test.mjs scripts/f6-full-flow.test.mjs scripts/f6-output-layout.test.mjs scripts/f6-skill.test.mjs scripts/verify-current-f6.test.mjs
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 10: Run the complete repository suite**

Run:

```powershell
npm test
npm run lint
npm run check:repository
```

Expected: PASS with no new warnings attributable to this branch. Existing npm audit findings are not modified by this feature.

- [ ] **Step 11: Run the real governed workbook regression**

Use the approved workbook through the current F6 skill sequence, preserving worksheet gates and optional evidence decisions. Verify the newly generated current output with:

```powershell
node scripts/verify-current-f6.mjs
```

Acceptance checks for `Maera_gap_TP_brkt_and _battery_20260305V1 - test.xlsx`:

- F1 report inventory includes Title Page, Auto Summary, all seven selected analysis sheets, and Example_TA in workbook order.
- Title Page Revision `D` appears in final Document Control.
- `gap w rubber_TPoverload500g` triggers OP1/OP2/OP3 because lower Cpk is below its worksheet target.
- passing ready worksheets omit 3.7 Optimize.
- the two blocked foam worksheets remain FAIL and receive no optimization calculation.
- final report timestamp is `yyyy-MM-dd HH:mm:ss`.
- five F6 files and recorded hashes validate.

- [ ] **Step 12: Commit Task 7**

```powershell
git add scripts/run-f6-full-validation.mjs scripts/f6-full-flow.test.mjs scripts/f6-output-layout.test.mjs scripts/verify-current-f6.mjs scripts/verify-current-f6.test.mjs .github/skills/f6-analysis/SKILL.md scripts/f6-skill.test.mjs docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/governance/feature-register.md docs/README.md README.md
git commit -m "feat(f6): govern built-in report optimization flow"
```

---

## Final Review Checklist

- [ ] Confirm `git status --short` contains only intended generated test outputs or is clean.
- [ ] Inspect `git diff 99c95c5...HEAD --stat` for unrelated churn.
- [ ] Confirm every production change was preceded by a failing focused test.
- [ ] Confirm no non-TA worksheet appears in F2/F3/F4/F5/F6 worksheet arrays.
- [ ] Confirm F4 remains the only scenario calculation implementation.
- [ ] Confirm built-in policy ratios occur in one source constant and one strict contract refinement.
- [ ] Confirm passing worksheets do not receive built-in options or Optimize sections.
- [ ] Confirm caller target governance and input decision ledgers remain unchanged.
- [ ] Confirm current F6 verifier accepts the real newly generated artifact set.