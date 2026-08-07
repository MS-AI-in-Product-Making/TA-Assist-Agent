# F2 Excel 显示值一致性修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 让 F2 Markdown 对系统规格和全部 factor 字段使用 Excel 可见文本，同时保持 F2 JSON、F4 handoff 和业务判断中的 `actualValue` 完整精度不变。

**架构：** F1 继续负责从 SheetJS cell 保存 `actualValue` 与 `displayValue`。F2 enhanced row 增加向后兼容的可选 `displayFields` 投影，renderer 按 `displayFields -> actualFields -> —` 选择用户文本，业务逻辑仍只读取 `actualFields`。

**技术栈：** TypeScript 5.7、Node.js ESM、Zod、SheetJS、Vitest、PowerShell

---

## 文件结构

- 修改 `packages/contracts/src/contracts.ts`：定义 F2 enhanced row 的可选 `displayFields`。
- 修改 `packages/contracts/src/contracts.test.ts`：验证新字段和 strict schema 行为。
- 新建 `scripts/f1-system-specification-display.mjs`：根据 system specification 的 `sourceCell` 读取 SheetJS display text。
- 新建 `scripts/f1-system-specification-display.test.mjs`：验证 annotation 不改变 actual evidence。
- 修改 `scripts/run-f1-full-validation.mjs`：在输出 F1 worksheet artifact 前调用 annotation。
- 修改 `packages/workbook-catalog/src/f2-user-report.ts`：从 F1 evidence 投影 `displayFields`。
- 修改 `packages/workbook-catalog/src/f2-user-report.test.ts`：验证展示投影与业务数值隔离。
- 修改 `scripts/f2-report.mjs`：优先渲染 `displayFields`。
- 修改 `scripts/f2-report.test.mjs`：覆盖浮点尾数、百分比、escaping 和 fallback。

### Task 1：扩展 F2 enhanced row contract

**文件：**
- 修改：`packages/contracts/src/contracts.ts`
- 测试：`packages/contracts/src/contracts.test.ts`

- [ ] **Step 1：写 contract RED 测试**

在现有 F2 user report fixture 的 row 中加入完整的 `displayFields`，包含 `mean: "-0.100"`、`oneSigma: "0.0167"`、`percentContributionToSigma: "2.7%"`，其余 key 与 `actualFields` 完全一致。断言 `f2UserReportSchema.parse()` 接受该属性；另保留拼错为 `displayedFields` 的 fixture，断言 strict schema 拒绝它。

- [ ] **Step 2：运行测试并确认失败**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

预期：FAIL，enhanced row 不接受 `displayFields`。

- [ ] **Step 3：实现可选 display schema**

在 `f2ActualFieldsSchema` 后增加 key 完全一致、value 均为 `z.string().nullable()` 的 `f2DisplayFieldsSchema`，并在 `f2EnhancedRowSchema` 中加入：

```ts
displayFields: f2DisplayFieldsSchema.optional(),
```

- [ ] **Step 4：运行 Step 2 命令并确认全部 PASS**

- [ ] **Step 5：提交 contract 改动**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat: add F2 display fields contract"
```

### Task 2：修正 F1 系统规格 displayValue

**文件：**
- 新建：`scripts/f1-system-specification-display.mjs`
- 新建：`scripts/f1-system-specification-display.test.mjs`
- 修改：`scripts/run-f1-full-validation.mjs`

- [ ] **Step 1：写纯函数 RED 测试**

fixture 中 lower evidence 为 `actualValue: 0.178`、错误 `displayValue: "0.17799999999999999"`；upper evidence 为 `actualValue: 1.1`、错误 `displayValue: "1.1000000000000001"`；target evidence 为 `actualValue: 3`。worksheet cells 使用：

```js
{
  P54: { v: 0.178, w: "0.178" },
  P55: { v: 1.1, w: "1.1" },
  P56: { v: 3, w: "3.0σ" },
}
```

断言三个 display value 分别变为 `0.178`、`1.1`、`3.0σ`，`actualValue`、原对象和没有 `sourceCell` 的 defaulted evidence 均不变。

- [ ] **Step 2：运行测试并确认 helper 不存在而失败**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f1-system-specification-display.test.mjs
```

- [ ] **Step 3：实现纯 annotation helper**

新增函数：

```js
export function withSystemSpecificationDisplayValues(specification, worksheetSheet) {
  // 遍历 lowerSpecLimit、upperSpecLimit、targetSigmaLevel、additionalMeanShift。
}
```

只处理 `status === "available"` 且存在 `sourceCell` 的 evidence。以 `sourceCell.slice(sourceCell.lastIndexOf("!") + 1)` 提取 address，使用 `cellDisplayText` 获取 Excel 文本，并以不可变复制替换 `displayValue`；cell 缺失时保留原 evidence。

- [ ] **Step 4：运行 Step 2 命令并确认 PASS**

- [ ] **Step 5：接入 F1 worksheet artifact**

在 `run-f1-full-validation.mjs` 导入 helper，在 `worksheetRecord` 前计算：

```js
const systemSpecification = withSystemSpecificationDisplayValues(
  worksheet.systemSpecification,
  dualWorksheetSheet,
);
```

将 record 的 `systemSpecification: worksheet.systemSpecification` 替换为 `systemSpecification`。

- [ ] **Step 6：运行 F1 focused tests**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f1-system-specification-display.test.mjs scripts/f1-dual-grid.test.mjs scripts/f1-factor-actuals.test.mjs
```

预期：全部 PASS。

- [ ] **Step 7：提交 F1 改动**

```powershell
git add scripts/f1-system-specification-display.mjs scripts/f1-system-specification-display.test.mjs scripts/run-f1-full-validation.mjs
git commit -m "fix: preserve Excel display text for F1 specifications"
```

### Task 3：将 F1 displayValue 投影到 F2 row

**文件：**
- 修改：`packages/workbook-catalog/src/f2-user-report.ts`
- 测试：`packages/workbook-catalog/src/f2-user-report.test.ts`

- [ ] **Step 1：写 projection RED 测试**

让 F1 evidence 与 actual fields 使用不同文本和值：

```ts
fields.mean = availableField("M14", "-0.100", -0.10000000000000002);
fields.oneSigma = availableField("N14", "0.0167", 0.016666666666666666);
fields.percentContributionToSigma = availableField("O14", "2.7%", 0.026937809003607087);
```

断言 enhanced row 的 `displayFields` 保留三个文本，`actualFields` 保留三个 number；同时断言 injected capability router 收到 numeric actual tolerances，而不是 display strings。

- [ ] **Step 2：运行测试并确认 row 没有 displayFields 而失败**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f2-user-report.test.ts
```

- [ ] **Step 3：实现 display projection**

增加从 actual key 到 F1 field key 的显式映射，其中 `sigmaLevel` 映射到 `standardDeviation`，其余同名。available evidence 返回 `displayValue`，unavailable evidence 返回 `null`；enhanced row 同时返回 `actualFields` 与 `displayFields`。

- [ ] **Step 4：运行 Step 2 命令并确认 PASS**

- [ ] **Step 5：重建 TypeScript references**

```powershell
npm run build -- --force
```

预期：exit code 0。

- [ ] **Step 6：提交 projection 改动**

```powershell
git add packages/workbook-catalog/src/f2-user-report.ts packages/workbook-catalog/src/f2-user-report.test.ts
git commit -m "feat: project Excel display values into F2 rows"
```

### Task 4：F2 Markdown 优先使用 Excel display text

**文件：**
- 修改：`scripts/f2-report.mjs`
- 测试：`scripts/f2-report.test.mjs`

- [ ] **Step 1：写 renderer RED 测试**

测试 row 使用带浮点尾数的 actual fields，并增加 `mean: "-0.100"`、`oneSigma: "0.0167"`、`percentContributionToSigma: "2.7%"` 的 display fields。断言 Markdown 包含 display 文本，不包含对应 float tails。另保留无 `displayFields` 的 row，断言仍回退展示 actual values。

- [ ] **Step 2：运行测试并确认 renderer 仍输出 float tails 而失败**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f2-report.test.mjs
```

- [ ] **Step 3：实现统一字段展示 helper**

```js
function fieldValue(row, fieldName) {
  const displayValue = row.displayFields?.[fieldName];
  return displayValue === null || displayValue === undefined || displayValue === ""
    ? actualValue(row.actualFields[fieldName])
    : mdEscape(displayValue);
}
```

row render loop 的每个字段改为 `fieldValue(row, fieldName)`。Factor Description 与 Part Name 的 image label 也使用同一文本选择规则，链接地址保持不变。

- [ ] **Step 4：运行 Step 2 命令并确认 PASS**

- [ ] **Step 5：运行 F2 focused regression**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-report.test.mjs scripts/f2-artifact-flow.test.mjs
```

预期：全部 PASS。

- [ ] **Step 6：提交 renderer 改动**

```powershell
git add scripts/f2-report.mjs scripts/f2-report.test.mjs
git commit -m "fix: render F2 values with Excel display text"
```

### Task 5：真实 workbook 回归与仓库验收

**输入：** `test/Mauna_Loa_TP_Step_20260611.xlsx`

- [ ] **Step 1：运行完整 build 与 focused tests**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f1-system-specification-display.test.mjs scripts/f1-dual-grid.test.mjs scripts/f1-factor-actuals.test.mjs scripts/f2-report.test.mjs scripts/f2-artifact-flow.test.mjs
```

- [ ] **Step 2：运行 Mauna Loa 两阶段 F2 workflow**

```powershell
npm run workflow:f2:excel -- "test/Mauna_Loa_TP_Step_20260611.xlsx"
```

读取最新 `Feature1-Selection.json` 的 `workbookHash` 和全部 suggested worksheet names，再运行：

```powershell
npm run workflow:f2:excel -- "test/Mauna_Loa_TP_Step_20260611.xlsx" --workbook-hash "<selection workbookHash>" --worksheets "<all suggested worksheet names>" --confirm
```

预期：F1/F2 完成且 artifact validation 为 `valid`；因源 workbook 缺字段，business report 可以继续为 `blocked`。

- [ ] **Step 3：验证展示文本与 actual precision**

对最新 `Feature2-Report.md` 搜索：

```powershell
Select-String -Path "<latest-run>\f2\Feature2-Report.md" -Pattern "0\.17799999999999999|1\.1000000000000001|-0\.10000000000000002|0\.043300000000000005"
```

预期：无匹配。再搜索 `0.178|1.1|2.7%`，预期存在匹配。读取最新 F1/F2 JSON，确认代表性 `actualValue` 仍为 number 且未变成显示字符串。

- [ ] **Step 4：运行仓库治理和完整测试**

```powershell
npm run verify:repo
npm test -- --run
git diff --check
```

预期：repository governance PASS；完整 Vitest suite PASS；`git diff --check` 无输出。

- [ ] **Step 5：检查工作树**

```powershell
git status --short
```

生成的 `test/demo-output/f2-runs` 不纳入提交。只提交有意修改的 tracked fixture；没有 tracked 改动时不创建空 commit。