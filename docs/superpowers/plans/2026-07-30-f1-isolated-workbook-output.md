# Feature 1 单工作簿独立输出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让单工作簿 Feature 1 命令生成按工作簿名隔离的完整固定输出，同时保持无参数批量验证输出不变。

**Architecture:** 新增纯函数模块负责解析批量/单工作簿输出布局，主工作流在确认输入存在后按布局初始化目录。单工作簿模式只重建自己的生成目录并写固定报告名；批量模式继续写时间戳报告和 `latest.*`。

**Tech Stack:** Node.js ESM、Vitest、PowerShell、现有 Feature 1 workflow

---

### Task 1: 输出布局纯函数

**Files:**
- Create: `scripts/f1-output-layout.mjs`
- Create: `scripts/f1-output-layout.test.mjs`

- [ ] **Step 1: 写失败测试**

创建测试，覆盖批量模式、单工作簿固定目录和安全化名称：

```js
import { describe, expect, it } from "vitest";
import { resolveFeature1OutputLayout } from "./f1-output-layout.mjs";

describe("resolveFeature1OutputLayout", () => {
  it("keeps timestamped validation outputs for batch mode", () => {
    expect(resolveFeature1OutputLayout([], "2026-07-30T06-11-28-928Z")).toEqual({
      mode: "batch",
      outRoot: "test/demo-output/feature1-validation",
      reportMdName: "f1-strict-workflow-2026-07-30T06-11-28-928Z.md",
      reportJsonName: "f1-strict-workflow-2026-07-30T06-11-28-928Z.json",
      latestMdName: "latest.md",
      latestJsonName: "latest.json",
      resetOutputRoot: false,
    });
  });

  it("isolates a single workbook under a fixed workbook directory", () => {
    expect(resolveFeature1OutputLayout(
      ["test/Mauna_Loa_TP_Step_20260611.xlsx"],
      "ignored",
    )).toEqual({
      mode: "single",
      outRoot: "test/demo-output/feature1-output/Mauna_Loa_TP_Step_20260611",
      reportMdName: "Feature1-Report.md",
      reportJsonName: "Feature1-Report.json",
      resetOutputRoot: true,
    });
  });

  it("removes the extension and sanitizes an unsafe workbook name", () => {
    const layout = resolveFeature1OutputLayout(["test/A:B report.xlsx"], "ignored");
    expect(layout.outRoot).toBe("test/demo-output/feature1-output/A-B-report");
  });
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npx vitest run scripts/f1-output-layout.test.mjs`

Expected: FAIL，提示无法导入 `scripts/f1-output-layout.mjs`。

- [ ] **Step 3: 写最小实现**

创建纯函数模块：

```js
import path from "node:path";

function safeName(value) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
}

export function resolveFeature1OutputLayout(args, runId) {
  if (args.length === 0) {
    return {
      mode: "batch",
      outRoot: "test/demo-output/feature1-validation",
      reportMdName: `f1-strict-workflow-${runId}.md`,
      reportJsonName: `f1-strict-workflow-${runId}.json`,
      latestMdName: "latest.md",
      latestJsonName: "latest.json",
      resetOutputRoot: false,
    };
  }

  if (args.length !== 1) {
    throw new Error("Feature 1 output layout accepts at most one workbook path.");
  }

  const extension = path.extname(args[0]);
  const workbookName = safeName(path.basename(args[0], extension));
  if (!workbookName) throw new Error("Feature 1 workbook output name is empty.");

  return {
    mode: "single",
    outRoot: path.join("test", "demo-output", "feature1-output", workbookName),
    reportMdName: "Feature1-Report.md",
    reportJsonName: "Feature1-Report.json",
    resetOutputRoot: true,
  };
}
```

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `npx vitest run scripts/f1-output-layout.test.mjs`

Expected: 1 test file passed，3 tests passed。

### Task 2: 主工作流接入隔离布局

**Files:**
- Modify: `scripts/run-f1-full-validation.mjs`
- Test: `scripts/f1-output-layout.test.mjs`

- [ ] **Step 1: 接入布局并调整初始化顺序**

在主脚本中导入 `rmSync` 和布局函数；保留 `safeName` 供已有工作表文件名逻辑使用。把 `outRoot`、`outSheetsRoot` 与目录创建从模块顶部移到 jobs 存在性检查之后：

```js
const cliArgs = process.argv.slice(2);
const jobs = resolveFeature1Jobs(cliArgs, configuredJobs)
  .filter((job) => existsSync(job.workbookPath));
if (jobs.length === 0) {
  throw new Error("No configured workbook exists for Feature 1 workflow.");
}

const generatedAt = new Date().toISOString();
const runId = generatedAt.replace(/[:.]/g, "-");
const outputLayout = resolveFeature1OutputLayout(cliArgs, runId);
const outRoot = outputLayout.outRoot;
const outSheetsRoot = path.join(outRoot, "sheets");
if (outputLayout.resetOutputRoot) rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outSheetsRoot, { recursive: true });
```

- [ ] **Step 2: 按布局写报告文件**

用布局文件名替换固定时间戳与 `latest.*` 路径：

```js
const jsonPath = path.join(outRoot, outputLayout.reportJsonName);
const mdPath = path.join(outRoot, outputLayout.reportMdName);

writeFileSync(jsonPath, JSON.stringify(report, null, 2));
writeFileSync(mdPath, finalMd.join("\n"));

if (outputLayout.mode === "batch") {
  writeFileSync(path.join(outRoot, outputLayout.latestJsonName), JSON.stringify(report, null, 2));
  writeFileSync(path.join(outRoot, outputLayout.latestMdName), finalMd.join("\n"));
}
```

控制台始终打印当前报告路径；仅批量模式打印 `Latest` 路径。

- [ ] **Step 3: 运行聚焦测试**

Run: `npx vitest run scripts/f1-output-layout.test.mjs scripts/f1-workbook-jobs.test.mjs`

Expected: 2 test files passed，6 tests passed。

- [ ] **Step 4: 运行构建回归检查**

Run: `npm run build -- --force`

Expected: exit code 0。

### Task 3: 真实工作簿独立输出验收

**Files:**
- Generate: `test/demo-output/feature1-output/Mauna_Loa_TP_Step_20260611/Feature1-Report.md`
- Generate: `test/demo-output/feature1-output/Mauna_Loa_TP_Step_20260611/Feature1-Report.json`
- Generate: `test/demo-output/feature1-output/Mauna_Loa_TP_Step_20260611/sheets/**`

- [ ] **Step 1: 记录共享 latest 时间戳并执行工作流**

Run:

```powershell
$before = (Get-Item "test/demo-output/feature1-validation/latest.json").LastWriteTimeUtc
npm run workflow:f1 -- "test/Mauna_Loa_TP_Step_20260611.xlsx"
if ($LASTEXITCODE -ne 0) { throw "Feature 1 workflow failed" }
$after = (Get-Item "test/demo-output/feature1-validation/latest.json").LastWriteTimeUtc
if ($after -ne $before) { throw "Shared latest.json was unexpectedly modified" }
```

Expected: 命令退出码为 0，且共享 `latest.json` 时间戳不变。

- [ ] **Step 2: 验证完整独立报告**

Run:

```powershell
$root = "test/demo-output/feature1-output/Mauna_Loa_TP_Step_20260611"
$report = Get-Content "$root/Feature1-Report.json" -Raw | ConvertFrom-Json
if ($report.workbooks.Count -ne 1) { throw "Expected one workbook" }
if ($report.workbooks[0].task11_scan.detectedWorksheetCount -ne 8) { throw "Expected 8 detected worksheets" }
if ($report.workbooks[0].task14_parallel_processing.pageCount -ne 8) { throw "Expected 8 processed pages" }
if ((Get-ChildItem "$root/sheets" -Recurse -File).Count -eq 0) { throw "Expected sheet outputs" }
```

Expected: 校验不抛错，报告包含一个工作簿和 8 个 worksheet 页面，`sheets/` 非空。

- [ ] **Step 3: 检查生成目录边界**

Run: `Get-ChildItem "test/demo-output/feature1-output/Mauna_Loa_TP_Step_20260611" | Select-Object Name`

Expected: 只显示 `Feature1-Report.json`、`Feature1-Report.md`、`sheets` 和 `_tmp`。

> 本计划不包含 Git commit；除非用户明确要求，不修改提交历史。