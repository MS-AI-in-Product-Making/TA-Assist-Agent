# F2 语义化 Artifact 与 F4 Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 F1/F2 通过 worksheet 语义锚点兼容不同 TA 模板布局，校验 Response Summary 三项必填规格，并只为用户明确确认且数据完整的 worksheet 生成 F4 handoff。

**Architecture:** F1 只执行一次语义提取，生成 canonical factor rows 和 worksheet system specification；F2 loader 将 v1/v2 artifact 规范化为同一内部模型，F2 report 在 worksheet 级 fail closed；独立 adapter 将 ready handoff 转成现有 F4 calculation request。worksheet 选择采用 `selectionRequired -> confirmed selection` 两阶段协议，未确认时不运行分析。

**Tech Stack:** TypeScript 5.7、Node.js ESM、Zod、Vitest、SheetJS、现有 OOXML reader、PowerShell/Excel COM（仅真实 workbook 回归）。

---

## 文件与职责

### 新增文件

- `packages/workbook-catalog/src/factor-header-resolver.ts`：解析唯一 factor header cluster。
- `packages/workbook-catalog/src/factor-header-resolver.test.ts`：E:T、G:V、整体位移、辅助标签和歧义测试。
- `packages/workbook-catalog/src/response-summary.ts`：按 section anchor 提取 worksheet system specification。
- `packages/workbook-catalog/src/response-summary.test.ts`：两种布局、位移、Suggested Spec 隔离和异常测试。
- `packages/workbook-catalog/src/f4-handoff.ts`：构造 handoff，并适配现有 calculation request。
- `packages/workbook-catalog/src/f4-handoff.test.ts`：ready/blocked、派生规格和 calculation adapter 测试。

### 主要修改文件

- `packages/contracts/src/contracts.ts`：selection、artifact v2、system specification、F2 issue 和 F4 handoff schemas。
- `packages/workbook-catalog/src/worksheet-selection.ts`：生成 options 并验证 confirmation。
- `packages/workbook-catalog/src/worksheet-analysis-assets.ts`：使用 resolver、扫描稀疏 used range、输出 canonical rows 与 Response Summary。
- `scripts/f1-factor-actuals.mjs`：从 canonical fields 投影 `actualFields`，移除固定 E:T。
- `scripts/run-f1-full-validation.mjs`：显式 selection gate 和 artifact v2 输出。
- `scripts/f2-artifact-loader.mjs`：v1/v2 normalize 与精确 issue path。
- `packages/workbook-catalog/src/f2-user-report.ts`：系统规格校验与状态传播。
- `scripts/f2-report.mjs`、`scripts/run-f2-full-validation.mjs`：规格展示和 handoff 落盘。
- `scripts/f2-excel-runner.mjs`、`apps/cli/src/index.ts`、`apps/cli/src/commands/feature2.ts`：两阶段选择交互。
- 对应所有 `.test.ts` / `.test.mjs`：TDD 回归。

## 实施约束

1. 不按 Excel revision 建模板 profile。
2. 不从 Markdown 解析结构化数据。
3. 不放宽九项 F2 因子必填；Drawing Number 继续是 F3 非阻断治理字段。
4. 不修改 F4 计算公式，只新增 handoff adapter。
5. 不保留无确认自动分析路径；旧 artifact 兼容不等于旧交互行为兼容。
6. 每个任务先看到预期失败，再写最小实现，并单独提交。

### Task 1: 定义 Worksheet 两阶段选择契约

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/workbook-catalog/src/worksheet-selection.ts`
- Modify: `packages/workbook-catalog/src/worksheet-selection.test.ts`

- [ ] **Step 1: 写 prompt、confirmation 和结果 union 的失败测试**

```ts
expect(worksheetSelectionPromptSchema.parse({
  contractVersion: "v1",
  inputClassification: "confidential",
  status: "selectionRequired",
  workbook: { fileName: "rev-g.xlsx", contentHash: HASH },
  options: [{
    selectionIndex: 1,
    worksheetName: "TP_C_Step_TA",
    toleranceLoopDescription: "TP to C Cover Step",
    worksheetKind: "analysis",
    source,
  }],
})).toBeDefined();

expect(worksheetSelectionConfirmationSchema.parse({
  workbookContentHash: HASH,
  selectedWorksheetNames: [],
  confirmed: true,
})).toBeDefined();
```

catalog 测试覆盖：有效确认、stale hash、空选择、未知名称、重复名称；空选择返回 `cancelled / worksheet_selection_empty`。

- [ ] **Step 2: 运行测试确认新 API 尚不存在**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/worksheet-selection.test.ts
```

Expected: FAIL，缺少 selection schemas 或 validator。

- [ ] **Step 3: 实现最小 schemas**

```ts
export const worksheetKindSchema = z.enum(["analysis", "example_or_template"]);
export const worksheetSelectionPromptSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  status: z.literal("selectionRequired"),
  workbook: z.object({ fileName: workbookCatalogFileNameSchema, contentHash: sha256Schema }).strict(),
  options: z.array(z.object({
    selectionIndex: z.number().int().positive(),
    worksheetName: z.string().min(1),
    toleranceLoopDescription: z.string().min(1),
    worksheetKind: worksheetKindSchema,
    source: workbookCatalogAnalysisSourceSchema,
  }).strict()).min(1),
}).strict();
export const worksheetSelectionConfirmationSchema = z.object({
  workbookContentHash: sha256Schema,
  selectedWorksheetNames: z.array(z.string().min(1)),
  confirmed: z.literal(true),
}).strict();
```

confirmation schema 的 `superRefine` 拒绝重复名称。结果 union 包含 `confirmed`、`cancelled` 和 `rejected`，rejected reason 为 `stale_worksheet_selection | invalid_worksheet_selection`。

- [ ] **Step 4: 实现 prompt 与 confirmation validator**

```ts
export function createWorksheetSelectionPrompt(request: unknown): WorksheetSelectionPrompt;
export function validateWorksheetSelectionConfirmation(request: {
  prompt: WorksheetSelectionPrompt;
  confirmation: unknown;
}): WorksheetSelectionConfirmationResult;
```

`Example_TA` 只标记为 `example_or_template`，不得被过滤。validator 按 schema、hash、空选择、option membership 顺序检查并返回冻结结果。

- [ ] **Step 5: 重跑 Step 2 命令并提交**

Expected: PASS。

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/worksheet-selection.ts packages/workbook-catalog/src/worksheet-selection.test.ts
git commit -m "feat(f1): add explicit worksheet selection contract"
```

### Task 2: 将 Runner 与 CLI 改为显式确认

**Files:**
- Modify: `scripts/run-f1-full-validation.mjs`
- Modify: `scripts/f2-excel-runner.mjs`
- Modify: `scripts/f2-excel-runner.test.mjs`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `apps/cli/src/commands/feature2.ts`
- Modify: `apps/cli/src/commands/feature2.test.ts`

- [ ] **Step 1: 写 selectionRequired/confirmed flow 失败测试**

```js
const promptRun = runF2ExcelWorkflow({ workbookPath, executeStage });
expect(promptRun.status).toBe("selectionRequired");
expect(executedStages).toEqual(["f1-selection"]);

runF2ExcelWorkflow({
  workbookPath,
  worksheetSelection: {
    workbookContentHash: HASH,
    selectedWorksheetNames: ["TP_C_Step_TA"],
    confirmed: true,
  },
  executeStage,
});
expect(executedStages).toEqual(["f1", "f2"]);
```

- [ ] **Step 2: 运行测试确认旧自动行为失败**

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f2-excel-runner.test.mjs apps/cli/src/commands/feature2.test.ts apps/cli/src/index.test.ts
```

Expected: FAIL，无确认时仍执行 F2。

- [ ] **Step 3: 增加 CLI 参数类型和校验**

```ts
type Feature2WorksheetSelectionArgs =
  | { mode: "prompt" }
  | { mode: "confirmed"; workbookContentHash: string; selectedWorksheetNames: string[] };
```

参数形态为 `--worksheets "TP_C_Step_TA" --workbook-hash $selection.workbook.contentHash --confirm`。三个参数必须同时出现；部分出现时参数校验失败且不启动 stage。

- [ ] **Step 4: 实现两阶段 runner**

无 confirmation 时写 `Feature1-Selection.json` 并停止。confirmed 时调用 validator，再将 names 传给 assets extractor。移除 manifest/fallback 形成的静默自动选择路径。

manifest 增加 `selection.status`、`promptPath` 和 `selectedWorksheetNames`。selectionRequired 不是进程失败；stale/unknown 是 rejected 和非零退出。

- [ ] **Step 5: 重跑 Step 2 命令并提交**

Expected: PASS。

```powershell
git add scripts/run-f1-full-validation.mjs scripts/f2-excel-runner.mjs scripts/f2-excel-runner.test.mjs apps/cli/src/index.ts apps/cli/src/index.test.ts apps/cli/src/commands/feature2.ts apps/cli/src/commands/feature2.test.ts
git commit -m "feat(f2): require worksheet confirmation"
```

### Task 3: 建立 Factor Header Cluster 与 Canonical Row

**Files:**
- Create: `packages/workbook-catalog/src/factor-header-resolver.ts`
- Create: `packages/workbook-catalog/src/factor-header-resolver.test.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`
- Modify: `scripts/f1-factor-actuals.mjs`
- Modify: `scripts/f1-factor-actuals.test.mjs`
- Modify: `scripts/run-f1-full-validation.mjs`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: 写 Rev G cluster 失败测试**

```ts
const result = resolveFactorHeaderCluster([
  header("C13", "+ Tolerance"), header("D13", "+ Tolerance"),
  header("G13", "Factor Description (TA Loop)"), header("H13", "Part Name"),
  header("I13", "Drawing Number"), header("J13", "Dim / Characteristic ID"),
  header("K13", "Part Category"), header("L13", "Design Nominal"),
  header("M13", "+ Tolerance"), header("N13", "- Tolerance"),
  header("O13", "Long Term/Safety Factor"), header("P13", "σ Level"),
  header("Q13", "Distribution"),
]);
expect(result.status).toBe("resolved");
expect(result.columns.upperTolerance.sourceColumn).toBe("M");
expect(result.columns.lowerTolerance.sourceColumn).toBe("N");
```

同时覆盖 E:T、AA:AP、主锚点缺失、cluster 内重复和两个同分 cluster。

- [ ] **Step 2: 运行新测试确认 resolver 不存在**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/factor-header-resolver.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现 resolver**

```ts
export type FactorHeaderResolution =
  | { status: "resolved"; anchorColumn: string; columns: Readonly<Record<FactorFieldName, ResolvedHeaderColumn>> }
  | { status: "unavailable"; reasonCode: "factor_header_missing" | "ambiguous_factor_header" };
export function resolveFactorHeaderCluster(rowCells: readonly HeaderCell[]): FactorHeaderResolution;
```

列名先转整数排序；只考虑主锚点及其右侧；按受控字段顺序前进；必填 header 缺失/重复时 fail closed；不使用绝对列号。

- [ ] **Step 4: 将 worksheet extractor 改用 resolver 和稀疏 used range**

`sheetAssets` 不再整行聚合所有 alias。移除 `F1_ANALYSIS_CELL_WINDOW` 调用限制，但保留 OOXML reader 的最大 cells、XML part 和 archive size 安全检查。

- [ ] **Step 5: 将 actualFields 改为 canonical projection**

```js
const ACTUAL_FIELD_BY_SEMANTIC_FIELD = Object.freeze({
  factorName: "factorName", partName: "partName", drawingNumber: "drawingNumber",
  dimCharacteristicId: "dimCharacteristicId", partCategory: "partCategory",
  nominalValue: "nominalValue", upperTolerance: "upperTolerance",
  lowerTolerance: "lowerTolerance", longTermSafetyFactor: "longTermSafetyFactor",
  sigmaLevel: "standardDeviation", distribution: "distribution", mean: "mean",
  tolerance: "tolerance", oneSigma: "oneSigma",
  percentContributionToSigma: "percentContributionToSigma", notes: "notes",
});
export function projectFactorActualFields(fields) {
  return Object.fromEntries(Object.entries(ACTUAL_FIELD_BY_SEMANTIC_FIELD).map(
    ([target, source]) => [target, fields[source]?.status === "available" ? fields[source].actualValue : null],
  ));
}
```

`withDisplayActualFields` 必须先 annotate canonical fields，再投影；不得读取固定 worksheet 坐标。

- [ ] **Step 6: 运行 focused tests 并提交**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/factor-header-resolver.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts scripts/f1-factor-actuals.test.mjs
```

Expected: PASS，包括 G:V、M/N 公差列和 AA 列以后。

```powershell
git add packages/workbook-catalog/src/factor-header-resolver.ts packages/workbook-catalog/src/factor-header-resolver.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts packages/workbook-catalog/src/index.ts scripts/f1-factor-actuals.mjs scripts/f1-factor-actuals.test.mjs scripts/run-f1-full-validation.mjs
git commit -m "fix(f1): derive factor values from semantic headers"
```

### Task 4: 提取 Response Summary 系统规格

**Files:**
- Create: `packages/workbook-catalog/src/response-summary.ts`
- Create: `packages/workbook-catalog/src/response-summary.test.ts`
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

- [ ] **Step 1: 写 section boundary 和规格值失败测试**

```ts
expect(extractResponseSummarySystemSpecification("TP_C_Step_TA", cells)).toMatchObject({
  lowerSpecLimit: { status: "available", actualValue: -0.15, sourceCell: "TP_C_Step_TA!P54" },
  upperSpecLimit: { status: "available", actualValue: 0.05, sourceCell: "TP_C_Step_TA!P55" },
  targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceCell: "TP_C_Step_TA!P56" },
});
```

Suggested Spec 的 -0.25/0.15/4 不得进入结果。覆盖 label missing/ambiguous、value missing/invalid、`LSL >= USL`、AA 列和 300 行布局。另覆盖 Response Summary anchor 前的 `Additional Mean Shift`，标签不存在或值为空时返回 `defaulted: 0`。

- [ ] **Step 2: 运行测试确认 extractor/schema 不存在**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/response-summary.test.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 定义 evidence schemas**

```ts
const worksheetEvidenceNumberSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available"), actualValue: z.number().finite(), displayValue: z.string(), sourceCell: worksheetSourceCellSchema, valueOrigin: z.enum(["numeric_literal", "formula_cached", "defaulted"]) }).strict(),
  z.object({ status: z.literal("unavailable"), reasonCode: z.enum(["response_summary_label_missing", "response_summary_label_ambiguous", "response_summary_value_missing", "response_summary_value_invalid", "system_specification_range_invalid"]), sourceCell: worksheetSourceCellSchema.optional() }).strict(),
]);
```

`worksheetSystemSpecificationSchema` 包含 LSL、USL、Target σ 和 Additional Mean Shift。后者无值时返回有 evidence 的 `defaulted: 0`。

- [ ] **Step 4: 实现 extractor 并接入 worksheet assets**

```ts
export function extractResponseSummarySystemSpecification(
  worksheetName: string,
  cells: readonly OoxmlCell[],
): WorksheetSystemSpecification;
```

先找唯一 Response Summary section，再以首个后续 Suggested Spec 为结束行。LSL、USL、Target σ 标签只在该范围查找，并取同一行右侧最近非空 cell。Additional Mean Shift 在 factor table 结束行与 Response Summary anchor 之间查找。标签归一化移除 `*`、`►`、冒号和多余空白。

- [ ] **Step 5: 运行 focused tests 并提交**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/response-summary.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts packages/contracts/src/contracts.test.ts
```

Expected: PASS。

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/response-summary.ts packages/workbook-catalog/src/response-summary.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts
git commit -m "feat(f1): extract response summary specification"
```

### Task 5: 发布 Artifact v2 并规范化 v1/v2

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `scripts/run-f1-full-validation.mjs`
- Modify: `scripts/f2-artifact-loader.mjs`
- Modify: `scripts/f2-artifact-loader.test.mjs`

- [ ] **Step 1: 写 v2、legacy v1 和 issue path 失败测试**

```js
expect(loadF1ArtifactBundle(v2Root)).toMatchObject({ status: "accepted" });
expect(loadF1ArtifactBundle(v1Root)).toMatchObject({
  status: "accepted",
  input: { worksheets: [{ systemSpecification: { status: "unavailable", reasonCode: "legacy_artifact_missing_system_specification" } }] },
});
expect(loadF1ArtifactBundle(invalidRoot).report.artifactIssues[0]).toEqual({
  reasonCode: "invalid_contract",
  artifactPath: "Feature1-Report.json",
  issuePath: "worksheets[0].factorTables[0].rows[0].actualFields.upperTolerance",
});
```

- [ ] **Step 2: 运行 loader tests 确认失败**

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f2-artifact-loader.test.mjs packages/contracts/src/contracts.test.ts
```

Expected: FAIL，只有 v1 且 issue 被折叠。

- [ ] **Step 3: 定义 v2 与 canonical input**

根 report 增加 `artifactContractVersion: "f1-semantic-v2"`；worksheet JSON 包含 canonical tables、confirmed selection evidence 和 system specification。`f2ArtifactInputSchema` 只描述 normalize 后的 canonical shape。

- [ ] **Step 4: 实现 v1/v2 normalize**

`normalizeF1ArtifactV2ToCanonical` 逐字段复制 v2 workbook identity、confirmed selection、canonical factor tables、system specification 和 tolerance path evidence。`normalizeF1ArtifactV1ToCanonical` 保留合法 v1 factor tables 与图片证据，并为每个 worksheet 增加 `{ status: "unavailable", reasonCode: "legacy_artifact_missing_system_specification" }`。

v1 只兼容本身 schema 合法的数据；类型错位的损坏 v1 仍 `inputRejected`。

- [ ] **Step 5: 保留受控 Zod issue path**

`artifactIssues` 增加可选 `issuePath`。路径由 Zod segments 生成，如 `worksheets[0].factorTables[0]...`；不得包含实际 confidential value。

- [ ] **Step 6: 重跑 Step 2 命令并提交**

Expected: PASS。

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts scripts/run-f1-full-validation.mjs scripts/f2-artifact-loader.mjs scripts/f2-artifact-loader.test.mjs
git commit -m "feat(f2): normalize semantic artifact versions"
```

### Task 6: 扩展 F2 校验、报告与 F4 Handoff

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/workbook-catalog/src/f2-user-report.ts`
- Modify: `packages/workbook-catalog/src/f2-user-report.test.ts`
- Create: `packages/workbook-catalog/src/f4-handoff.ts`
- Create: `packages/workbook-catalog/src/f4-handoff.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`
- Modify: `scripts/f2-report.mjs`
- Modify: `scripts/f2-report.test.mjs`
- Modify: `scripts/run-f2-full-validation.mjs`

- [ ] **Step 1: 写 worksheet blocking 和 handoff 失败测试**

```ts
expect(report.status).toBe("partiallyBlocked");
expect(report.worksheets[0].status).toBe("ready");
expect(report.worksheets[1]).toMatchObject({
  status: "blocked",
  systemSpecificationIssues: [{ field: "targetSigmaLevel", reasonCode: "response_summary_value_missing" }],
});
expect(report.f4Handoffs).toHaveLength(1);
```

另断言 Drawing Number 缺失不进入 `missingRequiredFields`，仍产生 `adoReminderRequested`，但 handoff 保留。

- [ ] **Step 2: 运行 F2 tests 确认失败**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f2-user-report.test.ts packages/workbook-catalog/src/f4-handoff.test.ts scripts/f2-report.test.mjs packages/contracts/src/contracts.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 扩展 F2 report schemas 和校验**

worksheet 增加 `systemSpecification` 和 `systemSpecificationIssues`，report 增加 `f4Handoffs`。superRefine 验证 ready worksheet 无 blocking issue 且恰有一个 matching handoff；blocked worksheet 不得有 ready handoff。

```ts
function validateWorksheetSystemSpecification(
  specification: WorksheetSystemSpecification,
): readonly F2SystemSpecificationIssue[];
```

blocking 条件仅为 tolerance path、九项因子必填或 system specification issue；Drawing Number/DIM ID 保持治理事件。

- [ ] **Step 4: 实现 handoff**

```ts
export function createF4Handoff(input: {
  workbookContentHash: string;
  worksheet: F2ReadyWorksheet;
}): F4HandoffReady;
```

`targetCpk = targetSigmaLevel / 3`；Additional Mean Shift 使用 evidence 值。每个 factor 保留 tableId、sourceRow、sourceCells。

- [ ] **Step 5: 更新 JSON/Markdown 与落盘**

Markdown 展示 LSL、USL、Target σ、source cell、校验状态和 handoff status。`run-f2-full-validation.mjs` 只为 ready worksheet 写 `f4-handoffs/<safe-worksheet>.json`。

- [ ] **Step 6: 重跑 Step 2 命令并提交**

Expected: PASS。

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f2-user-report.ts packages/workbook-catalog/src/f2-user-report.test.ts packages/workbook-catalog/src/f4-handoff.ts packages/workbook-catalog/src/f4-handoff.test.ts packages/workbook-catalog/src/index.ts scripts/f2-report.mjs scripts/f2-report.test.mjs scripts/run-f2-full-validation.mjs
git commit -m "feat(f2): validate system specs and emit F4 handoffs"
```

### Task 7: 将 Ready Handoff 适配为现有 F4 Request

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/workbook-catalog/src/f4-handoff.ts`
- Modify: `packages/workbook-catalog/src/f4-handoff.test.ts`
- Modify: `packages/workbook-catalog/src/calculation.test.ts`

- [ ] **Step 1: 写 adapter 失败测试**

```ts
const request = createCalculationRequestFromF4Handoff({
  handoff: readyHandoff,
  projectReference: "project-1",
  runReference: "run-1",
  criticality: "none",
});
expect(request.systemSpecification).toEqual({
  designNominal: -0.05, lowerSpecLimit: -0.15, upperSpecLimit: 0.05,
  targetSigmaLevel: 3, targetCpk: 1, additionalMeanShift: 0,
});
expect(() => createCalculationRequestFromF4Handoff({ handoff: blockedHandoff })).toThrow();
```

- [ ] **Step 2: 运行 F4 tests 确认失败**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f4-handoff.test.ts packages/workbook-catalog/src/calculation.test.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现 adapter，不修改 calculation kernel**

```ts
export function createCalculationRequestFromF4Handoff(input: {
  handoff: F4HandoffReady;
  projectReference: string;
  runReference: string;
  criticality: "none" | "CTS" | "CTF";
}): CalculationRequest;
```

构造现有 `calculationRequestSchema` 需要的 assets、required field check、exception resolution、selection 和 system specification；全部从 handoff evidence 投影，不重新读取 workbook。

- [ ] **Step 4: 验证可直接运行现有 F4**

```ts
const result = createCalculation(createCalculationRequestFromF4Handoff(input));
expect(result.status).toBe("completed");
expect(result.capability.targetSigmaLevel).toBe(3);
```

- [ ] **Step 5: 重跑 Step 2 命令并提交**

Expected: PASS，现有 calculation regression 不变化。

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f4-handoff.ts packages/workbook-catalog/src/f4-handoff.test.ts packages/workbook-catalog/src/calculation.test.ts
git commit -m "feat(f4): accept validated F2 handoffs"
```

### Task 8: 真实 Workbook 回归、文档和全仓验收

**Files:**
- Modify: `scripts/f2-full-flow.test.mjs`
- Modify: `README.md`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/04-feature-breakdown.md`
- Modify: `docs/04-功能拆分.md`

- [ ] **Step 1: 运行 prompt phase**

```powershell
npm run workflow:f2:excel -- "test/Test_TP_Step_202600805.xlsx"
```

Expected: `selectionRequired`；options 包含 `Example_TA` 和 `TP_C_Step_TA`；没有 F2 report。

- [ ] **Step 2: 用返回 hash 显式确认**

```powershell
$runRoot = Get-ChildItem "test/demo-output/f2-runs/Test_TP_Step_202600805" -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
$selection = Get-Content (Join-Path $runRoot "f1/Feature1-Selection.json") | ConvertFrom-Json
npm run workflow:f2:excel -- "test/Test_TP_Step_202600805.xlsx" --worksheets "TP_C_Step_TA" --workbook-hash $selection.workbook.contentHash --confirm
```

Expected: 7 factors；第一行 `Fabric thickness / Fabric / -0.57 / 0.05 / -0.05`；LSL -0.15、USL 0.05、Target σ 3；F2 `completed`、worksheet `ready`；Drawing Number 缺失只产生治理事件；生成一个 ready handoff；没有 `inputRejected` 或 `duplicate_mapping`。

- [ ] **Step 3: 固化自动回归并更新文档**

`scripts/f2-full-flow.test.mjs` 使用受控 fixture 固化 prompt/confirm、partial blocking 和 handoff count。真实 confidential workbook 只用于本机 acceptance，不提交其生成 artifact。README 和中英文流程文档说明两步命令、hash 防过期、三项规格必填和 worksheet 级 blocking。

- [ ] **Step 4: 运行 changed-slice tests**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/worksheet-selection.test.ts packages/workbook-catalog/src/factor-header-resolver.test.ts packages/workbook-catalog/src/response-summary.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts packages/workbook-catalog/src/f2-user-report.test.ts packages/workbook-catalog/src/f4-handoff.test.ts packages/workbook-catalog/src/calculation.test.ts scripts/f1-factor-actuals.test.mjs scripts/f2-artifact-loader.test.mjs scripts/f2-report.test.mjs scripts/f2-excel-runner.test.mjs scripts/f2-full-flow.test.mjs apps/cli/src/commands/feature2.test.ts apps/cli/src/index.test.ts
```

Expected: 全部 PASS。

- [ ] **Step 5: 运行完整验证**

```powershell
npm test
npm run check:repository
git diff --check
git status --short
```

Expected: build 成功、全部非环境性测试通过、repository check passed、无 diff 格式错误。

- [ ] **Step 6: 提交回归与文档**

```powershell
git add README.md docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/04-feature-breakdown.md docs/04-功能拆分.md scripts/f2-full-flow.test.mjs
git commit -m "test(f2): verify semantic workbook workflow"
```

## 最终验收清单

- [ ] 未确认 worksheet 时只返回 options，不创建分析 artifact。
- [ ] confirmation 绑定 workbook hash，过期确认 fail closed。
- [ ] E:T、G:V、AA:AP 和行位移由同一 resolver 处理。
- [ ] Rev G 的 C/D 辅助 `+ Tolerance` 不污染 M 列。
- [ ] `actualFields` 只从 canonical fields 投影。
- [ ] Response Summary 与 Suggested Spec 完全隔离。
- [ ] LSL、USL、Target σ 缺任一项时只阻断对应 worksheet。
- [ ] Drawing Number 缺失保持非阻断治理语义。
- [ ] ready worksheet 有且仅有一个 F4 handoff；blocked worksheet 没有 ready handoff。
- [ ] F4 adapter 复用现有 calculation request/kernel，不改变计算公式。
- [ ] v1 artifact 缺系统规格时提示重跑 F1，不从 Markdown 猜值。
- [ ] schema 损坏返回精确 issue path，且不泄漏 confidential value。
- [ ] 真实 Rev G workbook 验收通过。
- [ ] focused tests、`npm test` 和 `npm run check:repository` 全部通过。