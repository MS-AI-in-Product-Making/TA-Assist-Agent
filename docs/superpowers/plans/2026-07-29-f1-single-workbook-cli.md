# Feature 1 单报告命令行输入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Feature 1 workflow 接受一个可选 Excel 路径，并仅解析指定报告，同时保留无参数时的默认批处理行为。

**Architecture:** 新增独立纯函数模块负责把 CLI 参数转换为 workflow jobs，主脚本继续负责文件存在性检查和完整解析。测试直接覆盖纯函数，避免导入主脚本时触发 Excel 和文件输出副作用。

**Tech Stack:** Node.js ESM、Vitest、npm workspaces、现有 Feature 1 workflow

---

### Task 1: 单报告 job 选择

**Files:**
- Create: `scripts/f1-workbook-jobs.mjs`
- Create: `scripts/f1-workbook-jobs.test.mjs`
- Modify: `scripts/run-f1-full-validation.mjs`

- [ ] **Step 1: 写失败测试**

创建 `scripts/f1-workbook-jobs.test.mjs`：

```js
import { describe, expect, it } from "vitest";
import { resolveFeature1Jobs } from "./f1-workbook-jobs.mjs";

const defaults = [
  { workbookPath: "test/default-a.xlsx", selectedManifestPath: "test/a.json" },
  { workbookPath: "test/default-b.xlsx" },
];

describe("resolveFeature1Jobs", () => {
  it("preserves configured jobs when no workbook argument is provided", () => {
    expect(resolveFeature1Jobs([], defaults)).toEqual(defaults);
  });

  it("selects only the workbook supplied on the command line", () => {
    expect(resolveFeature1Jobs(["test/report.xlsx"], defaults)).toEqual([
      { workbookPath: "test/report.xlsx" },
    ]);
  });

  it("rejects more than one workbook argument", () => {
    expect(() => resolveFeature1Jobs(["test/a.xlsx", "test/b.xlsx"], defaults))
      .toThrow("Feature 1 workflow accepts at most one workbook path.");
  });
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npx vitest run scripts/f1-workbook-jobs.test.mjs`

Expected: FAIL，因为 `scripts/f1-workbook-jobs.mjs` 尚不存在。

- [ ] **Step 3: 写最小实现**

创建 `scripts/f1-workbook-jobs.mjs`：

```js
export function resolveFeature1Jobs(args, configuredJobs) {
  if (args.length > 1) {
    throw new Error("Feature 1 workflow accepts at most one workbook path.");
  }

  if (args.length === 1) {
    return [{ workbookPath: args[0] }];
  }

  return configuredJobs;
}
```

在 `scripts/run-f1-full-validation.mjs` 中导入函数：

```js
import { resolveFeature1Jobs } from "./f1-workbook-jobs.mjs";
```

并把 job 选择改为：

```js
const jobs = resolveFeature1Jobs(process.argv.slice(2), configuredJobs)
  .filter((job) => existsSync(job.workbookPath));
```

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `npx vitest run scripts/f1-workbook-jobs.test.mjs`

Expected: 1 test file passed，3 tests passed。

- [ ] **Step 5: 运行 TypeScript 构建回归检查**

Run: `npm run build -- --force`

Expected: exit code 0。

### Task 2: 执行并验收目标报告

**Files:**
- Generate: `test/demo-output/feature1-validation/latest.json`
- Generate: `test/demo-output/feature1-validation/latest.md`

- [ ] **Step 1: 执行目标报告**

Run: `npm run workflow:f1 -- "test/Maera_cosmetic_critical_TA - Rev E_0110.xlsx"`

Expected: exit code 0，并打印 `latest.md` 与 `latest.json` 输出路径。

- [ ] **Step 2: 验证输出只包含目标报告**

Run:

```powershell
$report = Get-Content "test/demo-output/feature1-validation/latest.json" -Raw | ConvertFrom-Json
if ($report.workbooks.Count -ne 1) { throw "Expected exactly one workbook" }
if ($report.workbooks[0].workbook.fileName -ne "Maera_cosmetic_critical_TA - Rev E_0110.xlsx") { throw "Unexpected workbook" }
$report.workbooks[0].task14_parallel_processing.pages | Format-Table worksheetName,status,reasonCode,factorTableCount,factorRowCount,formulaCellCount,imageAssetCount
```

Expected: 校验不抛错，并输出所有 worksheet 的解析统计。

- [ ] **Step 3: 汇总 Feature 1 结果**

读取 `latest.json`，报告以下项目：workbook metadata、detected/selected worksheet 数量、page 状态、factor table/row 数量、formula 数量、image 数量、composed snapshot 数量，以及任何失败页的 `reasonCode` 和 `errorSummary`。