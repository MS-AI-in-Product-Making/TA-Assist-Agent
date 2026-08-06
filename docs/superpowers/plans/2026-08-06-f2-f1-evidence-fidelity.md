# F2 对 F1 证据保真优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 F2 直接引用 F1 已提取图片、原样展示 F1 系统规格标签，并正确传递 `1σ` 与 `% Cont. to σ` 的公式 cached values。

**Architecture:** F1 semantic extraction 继续是唯一证据生产者：header resolver 识别实际计算列表头，Response Summary evidence 保存原始 label。F2 report row 保存经过 loader 校验的 F1 image reference，renderer 仅计算从 F2 输出目录到 F1 文件的 Markdown 相对链接，不复制图片；F3/F4 只升级严格契约 fixture，业务计算保持不变。

**Tech Stack:** TypeScript 5.7、Node.js ESM、Zod、Vitest、现有 OOXML reader、SheetJS、PowerShell/Excel COM（真实 workbook 验收）。

---

## 文件与职责

### 修改文件

- `packages/workbook-catalog/src/factor-header-resolver.ts`：增加实际 `1σ` 与 `% Cont. to σ` alias。
- `packages/workbook-catalog/src/factor-header-resolver.test.ts`：验证符号和缩写表头的语义映射。
- `packages/contracts/src/contracts.ts`：available system specification evidence 增加 `sourceLabel`；F2 row 将 `imageTarget` 替换为 `imageReference`。
- `packages/contracts/src/contracts.test.ts`：验证新 evidence 和 image reference 严格契约。
- `packages/workbook-catalog/src/response-summary.ts`：保存 label cell 原文，并为 defaulted mean shift 提供 canonical label。
- `packages/workbook-catalog/src/response-summary.test.ts`：覆盖原始 label 保真与 defaulted label。
- `scripts/f2-artifact-loader.test.mjs`：验证旧 artifact 缺 `sourceLabel` 时精确拒绝。
- `packages/workbook-catalog/src/f2-user-report.ts`：将已校验的 F1 image path 投影为 row `imageReference`。
- `packages/workbook-catalog/src/f2-user-report.test.ts`：验证 F1 图片引用不改名、不生成 F2 target。
- `scripts/f2-report.mjs`：使用 `sourceLabel`，并基于 F1 root/F2 output root 生成链接。
- `scripts/f2-report.test.mjs`：验证 label 原文、Windows 路径归一化及图片链接。
- `scripts/run-f2-full-validation.mjs`：移除 image materialization，向 renderer 传递 F2 output root。
- `scripts/f2-artifact-flow.test.mjs`：验证 F2 不创建图片副本且 Markdown 指向 F1。
- `scripts/f3-artifact-loader.test.mjs`、`scripts/f3-full-flow.test.mjs`：升级严格 F2 report fixture。
- `packages/workbook-catalog/src/f4-handoff.test.ts`、`scripts/f2-excel-runner.test.mjs`：升级 system specification fixture 并验证计算语义不变。
- `README.md`、`docs/02-end-to-end-flow.md`、`docs/02-端到端流程.md`、`docs/04-feature-breakdown.md`、`docs/04-功能拆分.md`：记录 F1 单一图片锚点与 label 保真规则。

### 删除文件

- `scripts/f2-image-materializer.mjs`：F2 不再复制图片。
- `scripts/f2-image-materializer.test.mjs`：复制行为被 artifact flow 的“不复制”验收替代。

## 实施约束

1. 所有行为修改先写失败测试并确认 RED，再写最小实现。
2. 不按固定 R/S 列读取计算值，也不在 F2 重新计算计算列。
3. 不从 F1 Markdown 反向解析 label；旧 artifact 缺少 `sourceLabel` 必须重新运行 F1。
4. 不在 F2 JSON 保存 F2 输出相对图片路径；`imageReference.relativePath` 始终相对 F1 `artifactRoot`。
5. 不修改 F4 calculation kernel、F0 capability 判断或 worksheet blocking 规则。
6. 每个任务独立提交，不把真实 demo output 纳入 Git。

### Task 1: 识别实际计算列表头

**Files:**
- Modify: `packages/workbook-catalog/src/factor-header-resolver.test.ts`
- Modify: `packages/workbook-catalog/src/factor-header-resolver.ts`

- [ ] **Step 1: 写符号表头失败测试**

在测试文件增加：

```ts
it("resolves the workbook's symbolic calculated headers", () => {
  const cells = cluster(7).map((cell) => {
    if (cell.value === "1 Sigma") return { ...cell, value: "1σ" };
    if (cell.value === "% Contribution to Sigma") return { ...cell, value: "% Cont. to σ" };
    return cell;
  });

  const result = resolveFactorHeaderCluster(cells);

  expect(result.status).toBe("resolved");
  if (result.status !== "resolved") return;
  expect(result.columns.oneSigma).toMatchObject({ semanticField: "oneSigma", sourceColumn: "T", headerText: "1σ" });
  expect(result.columns.percentContributionToSigma).toMatchObject({ semanticField: "percentContributionToSigma", sourceColumn: "U", headerText: "% Cont. to σ" });
});
```

- [ ] **Step 2: 运行测试确认 RED**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/factor-header-resolver.test.ts
```

Expected: FAIL，`result.columns.oneSigma` 或 `percentContributionToSigma` 为 `undefined`。

- [ ] **Step 3: 增加最小 alias**

```ts
oneSigma: ["1 sigma", "one sigma", "1σ"],
percentContributionToSigma: ["% contribution to sigma", "percent contribution to sigma", "% cont. to σ"],
```

- [ ] **Step 4: 运行测试确认 GREEN**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/factor-header-resolver.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add packages/workbook-catalog/src/factor-header-resolver.ts packages/workbook-catalog/src/factor-header-resolver.test.ts
git commit -m "fix(f1): resolve symbolic sigma headers"
```

### Task 2: 保存系统规格原始标签

**Files:**
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/workbook-catalog/src/response-summary.test.ts`
- Modify: `packages/workbook-catalog/src/response-summary.ts`

- [ ] **Step 1: 写 evidence 契约和提取失败测试**

给 available evidence fixture 增加 `sourceLabel`，并增加以下提取断言：

```ts
const result = extractResponseSummarySystemSpecification("TP_C_Step_TA", [
  cell("M44", "Additional Mean Shift ►"), cell("R44", "0"),
  cell("M50", "Response Summary Table"),
  cell("M54", "*Lower Spec Limit ►"), cell("P54", "-0.15"),
  cell("M55", "*Upper Spec Limit ►"), cell("P55", "0.05"),
  cell("M56", "*Target σ Level ►"), cell("P56", "3.0σ"),
]);

expect(result.status).toBe("available");
if (result.status !== "available") return;
expect(result.lowerSpecLimit.sourceLabel).toBe("*Lower Spec Limit ►");
expect(result.upperSpecLimit.sourceLabel).toBe("*Upper Spec Limit ►");
expect(result.targetSigmaLevel.sourceLabel).toBe("*Target σ Level ►");
expect(result.additionalMeanShift.sourceLabel).toBe("Additional Mean Shift ►");
```

另加 defaulted 场景断言：

```ts
expect(result.additionalMeanShift).toMatchObject({
  status: "available",
  sourceLabel: "Additional Mean Shift",
  actualValue: 0,
  valueOrigin: "defaulted",
});
```

- [ ] **Step 2: 运行测试确认 RED**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/response-summary.test.ts
```

Expected: FAIL，available evidence 缺少必填 `sourceLabel`，提取结果也没有该字段。

- [ ] **Step 3: 扩展严格契约和本地类型**

在 `availableWorksheetEvidenceNumberSchema` 增加：

```ts
sourceLabel: z.string().min(1),
```

同步扩展 `response-summary.ts` 的 available `EvidenceNumber`：

```ts
type EvidenceNumber =
  | { readonly status: "available"; readonly actualValue: number; readonly displayValue: string; readonly sourceLabel: string; readonly sourceCell?: string; readonly valueOrigin: "numeric_literal" | "formula_cached" | "defaulted" }
  | { readonly status: "unavailable"; readonly reasonCode: "response_summary_label_missing" | "response_summary_label_ambiguous" | "response_summary_value_missing" | "response_summary_value_invalid"; readonly sourceCell?: string };
```

- [ ] **Step 4: 从 label cell 原样投影 label**

`evidence(...)` 的成功返回增加：

```ts
return {
  status: "available",
  actualValue,
  displayValue,
  sourceLabel: label.value,
  sourceCell,
  valueOrigin: valueCell.formula ? "formula_cached" : "numeric_literal",
};
```

defaulted mean shift 改为：

```ts
const additionalMeanShift = meanShiftLabels.length === 0
  ? { status: "available" as const, actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" as const }
  : evidence(worksheetName, meanShiftLabels, located);
```

- [ ] **Step 5: 运行测试确认 GREEN**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/response-summary.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/response-summary.ts packages/workbook-catalog/src/response-summary.test.ts
git commit -m "feat(f1): preserve specification source labels"
```

### Task 3: 固化旧 F1 Artifact 的精确失败边界

**Files:**
- Modify: `scripts/f2-artifact-loader.test.mjs`

- [ ] **Step 1: 写缺少 sourceLabel 的边界回归测试**

使用 `createBundle(...)` 生成 semantic v2 artifact，删除 `lowerSpecLimit.sourceLabel` 后加载：

```js
const loaded = loadF1ArtifactBundle(root);

expect(loaded.status).toBe("inputRejected");
expect(loaded.report.artifactIssues).toContainEqual(expect.objectContaining({
  reasonCode: "invalid_contract",
  issuePath: "systemSpecification.lowerSpecLimit.sourceLabel",
}));
```

- [ ] **Step 2: 运行测试确认契约错误被 loader 保留**

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f2-artifact-loader.test.mjs
```

Expected: PASS；该行为由 Task 2 的严格 Zod 契约触发，loader 保留完整 issue path，不需要新增生产分支。

- [ ] **Step 3: 运行 loader 与契约测试**

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f2-artifact-loader.test.mjs packages/contracts/src/contracts.test.ts
```

Expected: PASS，旧 artifact 被拒绝且不从 Markdown 猜测 label。

- [ ] **Step 4: 提交**

```powershell
git add scripts/f2-artifact-loader.test.mjs
git commit -m "test(f2): reject artifacts without source labels"
```

### Task 4: 将 F2 图片目标迁移为 F1 图片引用

**Files:**
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/workbook-catalog/src/f2-user-report.test.ts`
- Modify: `packages/workbook-catalog/src/f2-user-report.ts`

- [ ] **Step 1: 写 imageReference 失败测试**

将 F2 row fixture 和期望改为：

```ts
expect(report.worksheets[0]!.rows[0]!.imageReference).toEqual({
  artifact: "f1",
  relativePath: "sheets/anonymous.xlsx/images/Analysis-A.png",
  contentHash: "b".repeat(64),
  worksheetName: "Analysis-A",
});
expect(report.worksheets[0]!.rows[0]).not.toHaveProperty("imageTarget");
```

契约测试验证 `artifact` 只能为 `f1`、`relativePath` 必须满足现有 `relativeArtifactPathSchema`，并拒绝旧 `imageTarget`。

- [ ] **Step 2: 运行测试确认 RED**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f2-user-report.test.ts
```

Expected: FAIL，schema 与 report builder 仍使用 `imageTarget`。

- [ ] **Step 3: 替换 row 图片契约**

将 `f2EnhancedRowSchema` 中的 `imageTarget` 替换为：

```ts
imageReference: z.object({
  artifact: z.literal("f1"),
  relativePath: relativeArtifactPathSchema,
  contentHash: sha256Schema,
  worksheetName: z.string().min(1),
}).strict().optional(),
```

- [ ] **Step 4: 直接投影 loader 已验证的 F1 路径**

将 `imageTarget(...)` 替换为：

```ts
function imageReference(worksheet: F2ArtifactInput["worksheets"][number]): {
  artifact: "f1";
  relativePath: string;
  contentHash: string;
  worksheetName: string;
} | undefined {
  if (worksheet.tolerancePathImage.status !== "available") return undefined;
  return {
    artifact: "f1",
    relativePath: worksheet.tolerancePathImage.imagePath,
    contentHash: worksheet.tolerancePathImage.contentHash,
    worksheetName: worksheet.worksheetName,
  };
}
```

在 row 输出中使用 `imageReference: worksheetImageReference`，不构造 `images/<hash>.<ext>`。

- [ ] **Step 5: 运行测试确认 GREEN**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f2-user-report.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f2-user-report.ts packages/workbook-catalog/src/f2-user-report.test.ts
git commit -m "feat(f2): reference F1 image artifacts"
```

### Task 5: 直接渲染 F1 图片链接并删除复制步骤

**Files:**
- Modify: `scripts/f2-report.test.mjs`
- Modify: `scripts/f2-report.mjs`
- Modify: `scripts/f2-artifact-flow.test.mjs`
- Modify: `scripts/run-f2-full-validation.mjs`
- Delete: `scripts/f2-image-materializer.test.mjs`
- Delete: `scripts/f2-image-materializer.mjs`

- [ ] **Step 1: 写 renderer 失败测试**

为 report fixture 设置：

```js
artifactRoot: path.join("C:", "runs", "run-1", "f1"),
imageReference: {
  artifact: "f1",
  relativePath: "sheets/Demo/images/Analysis-A.png",
  contentHash: "b".repeat(64),
  worksheetName: "Analysis-A",
},
```

调用并断言：

```js
const markdown = renderF2Report(report, { outputRoot: path.join("C:", "runs", "run-1", "f2") });
expect(markdown).toContain("[left\\|right](../f1/sheets/Demo/images/Analysis-A.png)");
expect(markdown).toContain("*Lower Spec Limit ►");
expect(markdown).toContain("*Upper Spec Limit ►");
expect(markdown).toContain("*Target σ Level ►");
expect(markdown).not.toContain("| LSL |");
```

- [ ] **Step 2: 将 artifact flow 改为不复制验收**

运行 CLI 后断言：

```js
const reference = report.worksheets[0].rows[0].imageReference;
const expectedHref = path.relative(output, path.join(artifactRoot, reference.relativePath)).split(path.sep).join("/");
expect(markdown).toContain(`[outside-library factor](${expectedHref})`);
expect(existsSync(path.join(output, "images"))).toBe(false);
expect(readFileSync(path.join(artifactRoot, reference.relativePath))).toEqual(Buffer.from([1, 2, 3]));
```

- [ ] **Step 3: 运行测试确认 RED**

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f2-report.test.mjs scripts/f2-artifact-flow.test.mjs
```

Expected: FAIL，renderer 仍读取 `imageTarget`、硬编码规格名称，CLI 仍复制图片。

- [ ] **Step 4: 实现路径计算与 label 渲染**

在 `f2-report.mjs` 引入 `node:path` 并实现：

```js
import path from "node:path";

function imageHref(artifactRoot, outputRoot, imageReference) {
  if (!imageReference) return undefined;
  return path.relative(outputRoot, path.resolve(artifactRoot, imageReference.relativePath)).split(path.sep).join("/");
}

function imageLink(value, href) {
  const label = actualValue(value);
  return href ? `[${label}](${href})` : label;
}

function specificationLabel(evidence) {
  return evidence?.status === "available" ? mdEscape(evidence.sourceLabel) : "（缺失或无效）";
}
```

将导出签名改为：

```js
export function renderF2Report(report, { outputRoot } = {}) {
  if (typeof outputRoot !== "string" || outputRoot.length === 0) throw new Error("F2 report outputRoot is required.");
```

每个 row 以 `imageHref(report.artifactRoot, outputRoot, row.imageReference)` 生成链接；系统规格四行使用 `specificationLabel(evidence)`，不再硬编码显示名称。

- [ ] **Step 5: 移除 materializer 并传入 output root**

从 runner 删除 import 与调用：

```js
import { materializeF2Images } from "./f2-image-materializer.mjs";
materializeF2Images(...);
```

报告写入改为：

```js
writeFileSync(
  path.join(outputLayout.outRoot, outputLayout.reportMdName),
  `${renderF2Report(f2Result, { outputRoot: outputLayout.outRoot })}\n`,
  "utf8",
);
```

删除 `scripts/f2-image-materializer.mjs` 与其测试。

- [ ] **Step 6: 运行测试确认 GREEN**

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f2-report.test.mjs scripts/f2-artifact-flow.test.mjs
```

Expected: PASS，F2 output 中没有 `images/`。

- [ ] **Step 7: 提交**

```powershell
git add scripts/f2-report.mjs scripts/f2-report.test.mjs scripts/f2-artifact-flow.test.mjs scripts/run-f2-full-validation.mjs
git rm scripts/f2-image-materializer.mjs scripts/f2-image-materializer.test.mjs
git commit -m "feat(f2): link directly to F1 images"
```

### Task 6: 升级 F3/F4 严格契约 Fixtures

**Files:**
- Modify: `scripts/f3-artifact-loader.test.mjs`
- Modify: `scripts/f3-full-flow.test.mjs`
- Modify: `packages/workbook-catalog/src/f4-handoff.test.ts`
- Modify: `scripts/f2-excel-runner.test.mjs`
- Modify as found by exact search: other test fixtures containing available system specification evidence or `imageTarget`

- [ ] **Step 1: 运行下游测试确认严格契约 RED**

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f3-artifact-loader.test.mjs scripts/f3-full-flow.test.mjs packages/workbook-catalog/src/f4-handoff.test.ts scripts/f2-excel-runner.test.mjs
```

Expected: FAIL，fixture 缺 `sourceLabel` 或仍含 `imageTarget`。

- [ ] **Step 2: 机械升级 system specification fixtures**

所有 available evidence 按字段增加对应 label：

```ts
lowerSpecLimit: { status: "available", sourceLabel: "*Lower Spec Limit ►", actualValue: -0.15, displayValue: "-0.15", sourceCell: `${worksheetName}!P54`, valueOrigin: "numeric_literal" },
upperSpecLimit: { status: "available", sourceLabel: "*Upper Spec Limit ►", actualValue: 0.05, displayValue: "0.05", sourceCell: `${worksheetName}!P55`, valueOrigin: "numeric_literal" },
targetSigmaLevel: { status: "available", sourceLabel: "*Target σ Level ►", actualValue: 3, displayValue: "3.0σ", sourceCell: `${worksheetName}!P56`, valueOrigin: "numeric_literal" },
additionalMeanShift: { status: "available", sourceLabel: "Additional Mean Shift", actualValue: 0, displayValue: "0", valueOrigin: "defaulted" },
```

F2 row fixture 中有图片时改用 Task 4 定义的 `imageReference`；F3/F4 业务断言不增加图片依赖。

- [ ] **Step 3: 确认没有残余旧字段**

```powershell
rg "\bimageTarget\b|LSL \||USL \||Target σ \|" packages scripts --glob "*.ts" --glob "*.mjs"
```

Expected: 无生产代码或 active fixture 命中；OOXML 内部 `imageTargets` 局部变量不在此搜索结果范围。

- [ ] **Step 4: 运行下游测试确认 GREEN**

```powershell
npx vitest run --workspace vitest.workspace.ts scripts/f3-artifact-loader.test.mjs scripts/f3-full-flow.test.mjs packages/workbook-catalog/src/f4-handoff.test.ts scripts/f2-excel-runner.test.mjs
```

Expected: PASS；F4 calculation request 数值断言保持不变。

- [ ] **Step 5: 提交**

```powershell
git add packages scripts
git commit -m "test(f2): align downstream evidence fixtures"
```

### Task 7: 更新文档并完成真实 Workbook 验收

**Files:**
- Modify: `README.md`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/04-feature-breakdown.md`
- Modify: `docs/04-功能拆分.md`
- Do not commit: generated files under `test/demo-output/`

- [ ] **Step 1: 更新中英文流程说明**

文档必须明确以下规则：

```text
F1 is the sole producer and physical owner of worksheet image evidence.
F2 stores a hash-bound reference to the F1 image and renders a relative Markdown link; it does not copy or regenerate the image.
System specification display labels are preserved from F1 source labels.
Calculated columns such as 1σ and % Cont. to σ are projected from cached worksheet formula values, not recalculated by F2.
```

中文对应表述使用项目现有术语，不翻译 code identifier、artifact contract 名称或命令。

- [ ] **Step 2: 运行聚焦测试和构建**

```powershell
npx vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/factor-header-resolver.test.ts packages/workbook-catalog/src/response-summary.test.ts packages/workbook-catalog/src/f2-user-report.test.ts packages/workbook-catalog/src/f4-handoff.test.ts scripts/f1-factor-actuals.test.mjs scripts/f2-artifact-loader.test.mjs scripts/f2-report.test.mjs scripts/f2-artifact-flow.test.mjs scripts/f2-excel-runner.test.mjs scripts/f3-artifact-loader.test.mjs scripts/f3-full-flow.test.mjs
npm run build
```

Expected: 全部 PASS，TypeScript build exit code 0。

- [ ] **Step 3: 运行完整 repository 验证**

```powershell
npm test
npm run verify:repository
git diff --check
```

Expected: repository suite PASS；既有显式 skip 数量不增加；classified-path 验证与 whitespace 检查 PASS。

- [ ] **Step 4: 对真实 workbook 执行两阶段 F2 workflow**

先获取 worksheet options 并从 JSON 自动读取 hash：

```powershell
$workbook = "C:\Users\xumax\AI Project\AI TVA Analysis\test\Test_TP_Step_202600805.xlsx"
$selection = npm run --silent workflow:f2:excel -- $workbook | ConvertFrom-Json
$workbookHash = $selection.prompt.workbook.contentHash
$selection.prompt.options | Format-Table selectionIndex, worksheetName, worksheetKind
```

确认唯一目标 worksheet：

```powershell
$completed = npm run --silent workflow:f2:excel -- $workbook --worksheets "TP_C_Step_TA" --workbook-hash $workbookHash --confirm | ConvertFrom-Json
$completed | Format-List status, runId, runRoot, f1Root, f2Root
```

Expected: `status: completed`，worksheet `ready`，7 factors，1 个 ready F4 handoff。

- [ ] **Step 5: 验证生成 artifact**

在新 run 的 `f2/Feature2-Report.json` 与 Markdown 中确认：

```text
row 14 oneSigma = 0.0125
row 14 percentContributionToSigma = 0.0769230769230769
system labels = *Lower Spec Limit ► / *Upper Spec Limit ► / *Target σ Level ► / Additional Mean Shift ►
imageReference.contentHash = 对应 F1 tolerancePathImage.contentHash
F2 Markdown link resolves to the F1 image
F2 output directory has no images subdirectory
```

Generated demo output 只用于验收，不执行 `git add test/demo-output`。

- [ ] **Step 6: 提交文档**

```powershell
git add README.md docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/04-feature-breakdown.md docs/04-功能拆分.md
git commit -m "docs(f2): document F1 evidence references"
```

- [ ] **Step 7: 最终状态检查**

```powershell
git status --short
git log -7 --oneline
```

Expected: 工作树干净；7 个优化提交按任务顺序存在。