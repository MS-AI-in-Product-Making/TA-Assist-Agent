# F2 完整 Artifact 与一键分析优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 F2 无损消费 F1 的 E:T 实际值、生成逐 factor 图片链接、严格使用 F0 显式 fallback，并通过单工作簿一键 runner 保存每次 F1/F2/validation 调试输出。

**Architecture:** F1 在现有 worksheet factor row 上新增严格 `actualFields`，F2 loader 只消费该结构并验证图片，composer 生成 actual-only 报告模型，输出阶段复制图片并渲染相对链接。F0 router 只接受知识库 API 返回的 `fallbackApplied`，不推导规则；runner 用独立 UTC run-id 编排现有 F1 和 F2 脚本。

**Tech Stack:** TypeScript strict ESM、Node.js ESM scripts、Zod v3、Vitest v3、SheetJS、PowerShell/Windows Excel export。

---

## 文件结构

- Modify: `packages/contracts/src/contracts.ts` — F1/F2 actual-only 与图片目标 runtime contract。
- Modify: `packages/contracts/src/contracts.test.ts` — 严格契约 RED/GREEN。
- Create: `scripts/f1-factor-actuals.mjs` — 从 worksheet cell `.v` 提取 E:T 实际值。
- Create: `scripts/f1-factor-actuals.test.mjs` — 数值、文本、公式缓存、空值和错误单元格测试。
- Modify: `scripts/run-f1-full-validation.mjs` — 把 `actualFields` 写入现有 factor row，支持受控输出根目录覆盖。
- Modify: `scripts/f2-artifact-loader.mjs` — 验证完整 E:T 与图片元数据。
- Modify: `scripts/f2-artifact-loader.test.mjs` — 旧 artifact 拒绝、完整 artifact 接受、图片安全测试。
- Modify: `packages/workbook-catalog/src/f2-user-report.ts` — `actualFields` composer、标识符 gap、图片目标。
- Modify: `packages/workbook-catalog/src/f2-user-report.test.ts` — actual-only 和 F0 调用测试。
- Modify: `scripts/f2-report.mjs` — 完整 E:T Markdown 与 factor 图片链接。
- Modify: `scripts/f2-report.test.mjs` — Markdown 链接、null 展示、真实数值测试。
- Create: `scripts/f2-image-materializer.mjs` — hash 验证后复制 F1 图片到 F2 `images/`。
- Create: `scripts/f2-image-materializer.test.mjs` — 复制、去重、越界和 hash 失败测试。
- Modify: `scripts/run-f2-full-validation.mjs` — materialize 图片并支持受控输出根目录覆盖。
- Modify: `packages/workbook-catalog/src/f0-capability-router.ts` — 保留显式 fallback 结果，不制造缺失上下文。
- Modify: `packages/workbook-catalog/src/f0-capability-router.test.ts` — `fallbackApplied=true` 与无 fallback 分流。
- Create: `scripts/f2-excel-runner.mjs` — F1→F2→schema validation 编排。
- Create: `scripts/f2-excel-runner.test.mjs` — run-id 布局与失败证据保留。
- Modify: `scripts/f1-output-layout.mjs` / `scripts/f1-output-layout.test.mjs` — 显式输出根目录。
- Modify: `scripts/f2-output-layout.mjs` / `scripts/f2-output-layout.test.mjs` — 显式输出根目录。
- Create: `apps/cli/src/commands/feature2.ts` — CLI runner adapter 与中文别名识别。
- Create: `apps/cli/src/commands/feature2.test.ts` — 参数与错误映射测试。
- Modify: `apps/cli/src/index.ts` / `apps/cli/src/index.test.ts` — `feature2 --workbook` 和别名路由。
- Modify: `package.json` / `README.md` — `workflow:f2:excel` 和使用说明。

### Task 1: 固化当前双 F0/F2 基线

**Files:** 当前未提交的 contracts、F0 router、F2 composer/renderer/CLI 及其测试。

- [ ] **Step 1: 运行现有聚焦验证**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f0-capability-router.test.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-report.test.mjs scripts/f2-artifact-flow.test.mjs
```

Expected: build PASS；5 个测试文件、173 个测试 PASS。

- [ ] **Step 2: 检查提交边界**

```powershell
git diff --check
git status --short
```

Expected: 仅列出现有双 F0/F2 实现与测试，没有生成报告被跟踪。

- [ ] **Step 3: 提交双 F0/F2 基线**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f0-capability-router.ts packages/workbook-catalog/src/f0-capability-router.test.ts packages/workbook-catalog/src/f2-user-report.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-artifact-flow.test.mjs scripts/f2-report.mjs scripts/f2-report.test.mjs scripts/run-f2-full-validation.mjs
git commit -m "feat: route F2 capability checks through F0"
```

### Task 2: 提取 E:T 实际值

**Files:**
- Create: `scripts/f1-factor-actuals.mjs`
- Create: `scripts/f1-factor-actuals.test.mjs`
- Modify: `scripts/run-f1-full-validation.mjs`

- [ ] **Step 1: 写 actual value RED 测试**

测试使用内存 worksheet，证明 `.v` 为唯一数据源，`.w` 不进入结果：

```js
import { describe, expect, it } from "vitest";
import { extractFactorActualFields } from "./f1-factor-actuals.mjs";

it("extracts E:T actual values without display text", () => {
  const sheet = {
    E14: { t: "s", v: "factor", w: "FACTOR DISPLAY" },
    J14: { t: "n", v: 1.25, w: "1.250" },
    P14: { t: "n", f: "=SUM(A1:A2)", v: 1.2, w: "1.200" },
    S14: { t: "n", v: 0.52710843373494, w: "52.7%" },
    T14: { t: "s", v: "review" },
  };
  expect(extractFactorActualFields(sheet, 14)).toEqual({
    factorName: "factor", partName: null, drawingNumber: null,
    dimCharacteristicId: null, partCategory: null, nominalValue: 1.25,
    upperTolerance: null, lowerTolerance: null, longTermSafetyFactor: null,
    sigmaLevel: null, distribution: null, mean: 1.2, tolerance: null,
    oneSigma: null, percentContributionToSigma: 0.52710843373494, notes: "review",
  });
});
```

另加错误单元格返回 null、非有限数字返回 null、数字按 15 位有效数字归一化测试。

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts scripts/f1-factor-actuals.test.mjs`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现最小提取器**

```js
const columns = {
  factorName: "E", partName: "F", drawingNumber: "G", dimCharacteristicId: "H",
  partCategory: "I", nominalValue: "J", upperTolerance: "K", lowerTolerance: "L",
  longTermSafetyFactor: "M", sigmaLevel: "N", distribution: "O", mean: "P",
  tolerance: "Q", oneSigma: "R", percentContributionToSigma: "S", notes: "T",
};

function actualValue(cell) {
  if (!cell || cell.t === "e" || cell.v === undefined || cell.v === null) return null;
  if (typeof cell.v === "number") return Number.isFinite(cell.v)
    ? Number(cell.v.toPrecision(15))
    : null;
  const value = String(cell.v).trim();
  return value.length === 0 ? null : value;
}

export function extractFactorActualFields(sheet, sourceRow) {
  return Object.fromEntries(Object.entries(columns).map(
    ([field, column]) => [field, actualValue(sheet?.[`${column}${sourceRow}`])],
  ));
}
```

- [ ] **Step 4: 接入 F1 row**

在 `run-f1-full-validation.mjs` 的 `withDisplayActualFields` 中接收 `dualWorksheetSheet`，每行增加：

```js
return {
  sourceRow: row.sourceRow,
  fields: nextFields,
  actualFields: extractFactorActualFields(dualWorksheetSheet, row.sourceRow),
};
```

- [ ] **Step 5: 运行测试并提交**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f1-factor-actuals.test.mjs scripts/f1-dual-grid.test.mjs
git add scripts/f1-factor-actuals.mjs scripts/f1-factor-actuals.test.mjs scripts/run-f1-full-validation.mjs
git commit -m "feat: preserve actual E to T factor values"
```

### Task 3: 迁移 F1/F2 Runtime Contract

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: 写严格契约 RED 测试**

```ts
const actualFields = {
  factorName: "factor", partName: "part", drawingNumber: null,
  dimCharacteristicId: null, partCategory: "CNC", nominalValue: 3.145,
  upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1,
  sigmaLevel: 4, distribution: "Normal", mean: 3.145, tolerance: 0.1,
  oneSigma: 0.025, percentContributionToSigma: 0.043, notes: null,
};
expect(f2ArtifactInputSchema.parse(input).worksheets[0].factorTables[0].rows[0].actualFields)
  .toEqual(actualFields);
expect(() => f2UserReportSchema.parse(reportWithDisplayedFields)).toThrow();
```

补充：缺列、额外列、NaN、绝对图片路径、`..` 路径和图片 hash 格式均拒绝。

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts`

Expected: FAIL，`actualFields` 尚未进入 schema，`displayedFields` 仍被要求。

- [ ] **Step 3: 实现 actual-only schema**

```ts
const f2ActualScalarSchema = z.union([z.string(), z.number().finite(), z.null()]);
const f2ActualFieldsSchema = z.object({
  factorName: z.string().nullable(), partName: z.string().nullable(),
  drawingNumber: f2ActualScalarSchema, dimCharacteristicId: f2ActualScalarSchema,
  partCategory: z.string().nullable(), nominalValue: f2ActualScalarSchema,
  upperTolerance: f2ActualScalarSchema, lowerTolerance: f2ActualScalarSchema,
  longTermSafetyFactor: f2ActualScalarSchema, sigmaLevel: f2ActualScalarSchema,
  distribution: z.string().nullable(), mean: f2ActualScalarSchema,
  tolerance: f2ActualScalarSchema, oneSigma: f2ActualScalarSchema,
  percentContributionToSigma: f2ActualScalarSchema, notes: f2ActualScalarSchema,
}).strict();
```

artifact row 和 enhanced row 使用同一 schema。新增：

```ts
imageTarget: z.object({ relativePath: relativeArtifactPathSchema, contentHash: sha256Schema }).strict().optional(),
missingIdentifiers: z.array(z.enum(["dimCharacteristicId", "partNumber"])),
```

删除 `displayedFields`。DIM 计数读取 `actualFields.dimCharacteristicId === null`；Part Number 由
`missingIdentifiers` 统计，绝不使用 Drawing Number。

- [ ] **Step 4: 运行测试并提交**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat: define actual-only F2 factor contract"
```

### Task 4: Loader 与 Composer 消费完整实际值

**Files:**
- Modify: `scripts/f2-artifact-loader.mjs`
- Modify: `scripts/f2-artifact-loader.test.mjs`
- Modify: `packages/workbook-catalog/src/f2-user-report.ts`
- Modify: `packages/workbook-catalog/src/f2-user-report.test.ts`

- [ ] **Step 1: 写 loader RED 测试**

完整 fixture 应 accepted；删除 `actualFields.notes` 后应返回 `inputRejected/invalid_contract`。

```js
expect(loadF1ArtifactBundle(root)).toMatchObject({ status: "accepted" });
delete worksheet.factorTables[0].rows[0].actualFields.notes;
expect(loadF1ArtifactBundle(root)).toMatchObject({
  status: "inputRejected",
  report: { artifactIssues: [{ reasonCode: "invalid_contract" }] },
});
```

- [ ] **Step 2: 运行 loader 测试确认 RED**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts scripts/f2-artifact-loader.test.mjs`

Expected: FAIL，旧 loader 未验证 actualFields。

- [ ] **Step 3: 最小修改 loader**

保留现有身份/image hash 校验；把 actualFields 交给 schema。available image 增加 `mediaType`，schema
只允许 `image/png`、`image/jpeg`。

- [ ] **Step 4: 写 composer RED 测试**

```ts
const row = createF2UserReport(input).worksheets[0]!.rows[0]!;
expect(row.actualFields.nominalValue).toBe(3.145);
expect(row.actualFields.notes).toBeNull();
expect(row).not.toHaveProperty("displayedFields");
expect(row.imageTarget).toEqual({
  relativePath: `images/${"b".repeat(64)}.png`, contentHash: "b".repeat(64),
});
```

同时断言 F0 router 收到 number actual values；非 number nominal/tolerance 进入 missing，router 零调用。

- [ ] **Step 5: 实现 composer 并验证**

文本必填必须为非空 string，数值必填必须为 finite number。输出 actualFields、sourceCells、
missingIdentifiers 和 hash 命名 imageTarget。

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f2-artifact-loader.test.mjs packages/workbook-catalog/src/f2-user-report.test.ts
git add scripts/f2-artifact-loader.mjs scripts/f2-artifact-loader.test.mjs packages/workbook-catalog/src/f2-user-report.ts packages/workbook-catalog/src/f2-user-report.test.ts
git commit -m "feat: compose F2 from complete actual values"
```

### Task 5: 复制图片并渲染可移植链接

**Files:**
- Create: `scripts/f2-image-materializer.mjs`
- Create: `scripts/f2-image-materializer.test.mjs`
- Modify: `scripts/f2-report.mjs`
- Modify: `scripts/f2-report.test.mjs`
- Modify: `scripts/run-f2-full-validation.mjs`
- Modify: `scripts/f2-artifact-flow.test.mjs`

- [ ] **Step 1: 写 materializer RED 测试**

```js
const result = materializeF2Images({ artifactRoot, outputRoot, input, report });
expect(result.copied).toEqual([`images/${hash}.png`]);
expect(readFileSync(path.join(outputRoot, "images", `${hash}.png`))).toEqual(bytes);
```

另测相同 hash 去重、源 hash 不符、source path 越界。

- [ ] **Step 2: 运行测试确认 RED**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts scripts/f2-image-materializer.test.mjs`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现安全复制**

使用 `path.resolve` + `path.relative` 拒绝越界，重新计算 SHA-256 后才 `copyFileSync`；按 hash 去重。

- [ ] **Step 4: 写 renderer RED 测试**

```js
expect(markdown).toContain(`[factor](images/${hash}.png)`);
expect(markdown).toContain(`[part](images/${hash}.png)`);
expect(markdown).toContain("| 3.145 | 0.1 | -0.1 |");
expect(markdown).not.toContain("displayedFields");
```

表头固定为 Row + E:T + 能力库结果 + 知识库推荐；null 展示 `—`。

- [ ] **Step 5: 实现 renderer 与写出顺序**

F2 主脚本顺序：创建 output root → materialize images → 写 JSON → 写 Markdown。只对 Factor/Part
添加链接，JSON 路径保持相对 F2 root。

- [ ] **Step 6: 运行测试并提交**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f2-image-materializer.test.mjs scripts/f2-report.test.mjs scripts/f2-artifact-flow.test.mjs
git add scripts/f2-image-materializer.mjs scripts/f2-image-materializer.test.mjs scripts/f2-report.mjs scripts/f2-report.test.mjs scripts/run-f2-full-validation.mjs scripts/f2-artifact-flow.test.mjs
git commit -m "feat: add portable factor image links to F2"
```

### Task 6: 验证 F0 显式 Fallback 边界

**Files:**
- Modify: `packages/workbook-catalog/src/f0-capability-router.test.ts`
- Modify: `packages/workbook-catalog/src/f0-capability-router.ts`（仅测试暴露缺陷时）
- Test: `packages/knowledge-base/src/internal/query.test.ts`
- Test: `packages/knowledge-base/src/internal/validation.test.ts`

- [ ] **Step 1: 写显式 fallback 测试**

注入 internal API 返回 `fallbackApplied: true`，断言 router 原样保留 matched entry、band 和 fallback；
保留 Sheetmetal/Die cut 缺上下文时 internal API 零调用的测试。

```ts
expect(router.assess(cncRow)).toMatchObject({
  capabilityStatus: "internal_within_guidance",
  recommendation: { matchedEntryId: "explicit-fallback", fallbackApplied: true },
});
```

- [ ] **Step 2: 运行 F0 测试**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f0-capability-router.test.ts packages/knowledge-base/src/internal/query.test.ts packages/knowledge-base/src/internal/validation.test.ts
```

Expected: 显式 fallback 被保留；无 fallback 仍为 `f0_information_insufficient`。

- [ ] **Step 3: 审计发布 seed**

```powershell
node --input-type=module -e "import {createReviewedInternalV1SeedPackage} from './packages/knowledge-base/dist/index.js'; const s=createReviewedInternalV1SeedPackage(); console.log(JSON.stringify({entries:s.entries.length,fallbackRoots:s.entries.filter(e=>e.fallbackEntryId).length},null,2))"
```

Expected: `entries: 110`, `fallbackRoots: 0`。受控 capability workbook 不在仓库中，本任务不得新增
推导 seed；未来只有 importer 证明源 row 明确含 Fallback Entry ID 后才能发布。

- [ ] **Step 4: 提交行为测试**

```powershell
git add packages/workbook-catalog/src/f0-capability-router.ts packages/workbook-catalog/src/f0-capability-router.test.ts
git commit -m "test: enforce explicit F0 fallback semantics"
```

### Task 7: 实现 run-id 一键 Runner

**Files:**
- Modify: `scripts/f1-output-layout.mjs` / `scripts/f1-output-layout.test.mjs`
- Modify: `scripts/f2-output-layout.mjs` / `scripts/f2-output-layout.test.mjs`
- Create: `scripts/f2-excel-runner.mjs`
- Create: `scripts/f2-excel-runner.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写输出覆盖 RED 测试**

```js
expect(resolveFeature1OutputLayout(["a.xlsx"], runId, "runs/x/f1").outRoot).toBe("runs/x/f1");
expect(resolveFeature2OutputLayout(["artifact"], "runs/x/f2").outRoot).toBe("runs/x/f2");
```

仍拒绝空 override 和含 `..` 的 override。

- [ ] **Step 2: 实现输出覆盖**

F1/F2 主脚本分别读取 `AI_TVA_F1_OUTPUT_ROOT`、`AI_TVA_F2_OUTPUT_ROOT`；无变量时保留现有布局。

- [ ] **Step 3: 写 runner RED 测试**

导出可注入 `executeStage` 和时钟的 `runF2ExcelWorkflow`：

```js
const result = runF2ExcelWorkflow({
  workbookPath, repositoryRoot,
  now: () => new Date("2026-08-05T01:02:03.000Z"), executeStage,
});
expect(result.runRoot).toEndWith("Demo/2026-08-05T01-02-03-000Z");
```

失败 fixture 必须保留 manifest 和已完成 f1 输出。

- [ ] **Step 4: 实现 runner**

验证唯一 `.xlsx`，创建 `test/demo-output/f2-runs/<safe-workbook>/<UTC-run-id>/{f1,f2,validation}`。
依次执行 F1、F2，最后用 built `f2UserReportSchema` 验证 JSON。每阶段前后更新 manifest；失败时保留输出。

- [ ] **Step 5: 添加 npm script、验证并提交**

```json
"workflow:f2:excel": "node scripts/f2-excel-runner.mjs"
```

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f1-output-layout.test.mjs scripts/f2-output-layout.test.mjs scripts/f2-excel-runner.test.mjs
git add scripts/f1-output-layout.mjs scripts/f1-output-layout.test.mjs scripts/f2-output-layout.mjs scripts/f2-output-layout.test.mjs scripts/f2-excel-runner.mjs scripts/f2-excel-runner.test.mjs package.json
git commit -m "feat: add isolated F2 Excel workflow runner"
```

### Task 8: CLI 与中文别名

**Files:**
- Create: `apps/cli/src/commands/feature2.ts`
- Create: `apps/cli/src/commands/feature2.test.ts`
- Modify: `apps/cli/src/index.ts` / `apps/cli/src/index.test.ts`
- Modify: `README.md`

- [ ] **Step 1: 写 adapter RED 测试**

```ts
expect(isFeature2Phrase("帮我用F2分析下excel")).toBe(true);
expect(isFeature2Phrase("use F2 to analyze Excel")).toBe(true);
```

缺文件、非 xlsx、runner script 不存在分别映射安全错误。

- [ ] **Step 2: 实现 adapter 与 CLI RED 测试**

`runFeature2WorkflowCommand(rootDir, workbookPath)` 调 runner 并返回 run root、F1/F2/validation 路径。

```ts
expect(await executeCli(["feature2", "--root", root, "--workbook", workbook]))
  .toMatchObject({ exitCode: 0, stderr: "" });
expect(await executeCli(["帮我用F2分析下excel", workbook]))
  .toMatchObject({ exitCode: 0, stderr: "" });
```

只有短语而无 workbook 时返回 validation error，不能扫描猜测目标。

- [ ] **Step 3: 扩展 parser、路由和 README**

`Command` 增加 feature2；`--workbook` 只允许 feature2。README 增加：

```powershell
npm run workflow:f2:excel -- "path/to/report.xlsx"
node apps/cli/dist/index.js feature2 --root . --workbook "path/to/report.xlsx"
```

- [ ] **Step 4: 运行测试并提交**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts apps/cli/src/commands/feature2.test.ts apps/cli/src/index.test.ts
git add apps/cli/src/commands/feature2.ts apps/cli/src/commands/feature2.test.ts apps/cli/src/index.ts apps/cli/src/index.test.ts README.md
git commit -m "feat: expose F2 Excel workflow through CLI"
```

### Task 9: 聚焦验证与真实工作簿验收

**Generate only:** `test/demo-output/f2-runs/Maera_gap_TP_brkt_and-_battery_20260305V1/<run-id>/`

- [ ] **Step 1: 强制构建与聚焦测试**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/knowledge-base/src/internal/query.test.ts packages/workbook-catalog/src/f0-capability-router.test.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f1-factor-actuals.test.mjs scripts/f2-artifact-loader.test.mjs scripts/f2-image-materializer.test.mjs scripts/f2-report.test.mjs scripts/f2-artifact-flow.test.mjs scripts/f2-excel-runner.test.mjs apps/cli/src/commands/feature2.test.ts
```

Expected: build 和聚焦测试 PASS。

- [ ] **Step 2: 运行真实一键流程**

```powershell
npm run workflow:f2:excel -- "test/Maera_gap_TP_brkt_and-_battery_20260305V1.xlsx"
```

Expected: stdout 返回唯一 run-id 目录，状态 completed。

- [ ] **Step 3: 严格验收 JSON**

断言 7 worksheets、50 rows、每行 16 个 actualFields、不含 displayedFields、图片目标存在。附件示例
row 16 的 nominal `3.145`、upper `0.1`、lower `-0.1` 必须为 number；row 20 contribution 必须为
`0.096815834767642`，不是 `9.7%`。

- [ ] **Step 4: 验收 Markdown 与 F0**

确认 factor/part 链接目标存在，CNC 仍用 internal-v1。seed 仍为 `fallbackRoots: 0` 时，Sheetmetal/
Die cut 必须保持 `F0 信息不足`，不得声称 fallback 命中。

- [ ] **Step 5: 最终卫生检查**

```powershell
git diff --check
git status --short
git ls-files test/demo-output/f2-runs
```

Expected: 无空白错误；run 输出不被 Git 跟踪。报告聚焦测试计数、真实 run-id、fallback 审计结果和
任何既有全仓超时，不把超时误报为本次功能失败。
