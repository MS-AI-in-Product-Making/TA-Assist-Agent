# F6 Editable HTML Report Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用当前已验证 F6 报告生成一个离线、自包含、Microsoft 风格、可在页面内编辑、可另存 HTML 并可打印为 PDF 的非治理原型。

**Architecture:** 保留正式 F6 五文件发布链路不变。新增一个纯 HTML 原型 renderer，把现有受控 F6 HTML 投影包进 Draft shell；新增只读 CLI，复用当前 F6 artifact validator 和受控图片内联逻辑，将原型写入独立目录。页面交互全部在本地执行，不依赖服务器或网络。

**Tech Stack:** Node.js ESM、TypeScript、`marked`、Vitest、Playwright、Microsoft Edge/Chromium、原生 HTML/CSS/JavaScript。

**Spec:** `docs/superpowers/specs/2026-09-11-f6-html-pdf-report-links-design.md`

## Global Constraints

- 本轮只创建 F6 报告原型，不修改 F1-F5、计算、优化策略或正式报告处置。
- HTML 必须持续显示 `DRAFT / NOT GOVERNED`，不得表述为正式验证结果。
- HTML 必须自包含、离线运行，不加载 CDN、网络字体、远程图片或外部脚本。
- 用户编辑不得回写源 Markdown、源工作簿、正式 PDF、历史 F6 run、run summary 或 manifest。
- 正式 F6 仍保持 `f6-artifact-set-v3` 五文件合同。
- 原型图片只能来自 validator-confirmed F6 报告引用，并通过 managed-root containment、非链接文件和 TOCTOU 身份检查。
- 页面使用 Microsoft Fluent 工程报告视觉语言：`Segoe UI Variable` / `Segoe UI`、`#0078D4`、中性灰阶和现有状态色。
- 两个操作按钮的精确文案为 `Save draft HTML` 和 `Print / export PDF`。
- 字距必须为 `0`；不使用外部字体、装饰渐变、嵌套卡片或营销式布局。
- 所有实现遵循 RED -> GREEN -> REFACTOR；没有观察到预期失败前不得写生产代码。
- 不提交生成的真实机密 HTML/PDF 原型。

---

### Task 0: 建立 worktree 可验证基线

**Files:**
- Modify: none

**Interfaces:**
- Consumes: 当前 `feat/f6-html-pdf-report-links` worktree。
- Produces: 已安装依赖、成功 build 和与本任务相关的绿色基线测试。

- [ ] **Step 1: 安装依赖并构建**

Run:

```powershell
npm install
npm run build -- --force
```

Expected: 两个命令均 exit 0。

- [ ] **Step 2: 运行现有 F6 输出基线测试**

Run:

```powershell
npx vitest run --project node packages/product-export/src/f6-pdf-export.test.ts scripts/f6-full-flow.test.mjs scripts/verify-current-f6.test.mjs
```

Expected: all PASS。若失败，停止实施并先报告基线失败，不修改生产代码。

---

### Task 1: 暴露受控图片内联能力

**Files:**
- Modify: `packages/product-export/src/f6-pdf-export.ts`
- Modify: `packages/product-export/src/f6-pdf-export.test.ts`

**Interfaces:**
- Consumes: 现有 `F6PdfRenderInput`。
- Produces: `validatedF6InlineImages(input: F6PdfRenderInput): ReadonlyMap<string, string>`。
- Compatibility: `renderF6PdfSync()` 继续调用同一逻辑，行为和错误码不变。

- [ ] **Step 1: 添加导出行为的失败测试**

在 `f6-pdf-export.test.ts` 将 import 改为：

```ts
import { renderF6PdfSync, validatedF6InlineImages } from "./f6-pdf-export.js";
```

新增测试，使用临时 managed root、Markdown 和 PNG fixture：

```ts
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const cleanupRoots: string[] = [];
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const temporaryManagedRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "f6-inline-images-"));
  cleanupRoots.push(root);
  return root;
};
const writeFixture = (filePath: string, value: string | Buffer): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
};
const writeBinaryFixture = writeFixture;
afterEach(() => {
  for (const root of cleanupRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("exposes validated inline images for the editable prototype", () => {
  const root = temporaryManagedRoot();
  const reportPath = path.join(root, "runs", "run-1", "Feature6-Report.md");
  const imagePath = path.join(root, "evidence", "stack.png");
  writeFixture(reportPath, "[Open tolerance path image](<../../evidence/stack.png>)\n");
  writeBinaryFixture(imagePath, PNG);

  const markdown = readFileSync(reportPath, "utf8");
  const images = validatedF6InlineImages({
    markdown,
    sourceHash: createHash("sha256").update(markdown).digest("hex"),
    reportPath,
    managedRoot: root,
  });

  expect(images.get("../../evidence/stack.png")).toBe(`data:image/png;base64,${PNG.toString("base64")}`);
});
```

测试工具函数必须在测试文件内创建和清理临时目录，不向仓库写 fixture。

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```powershell
npx vitest run --project node packages/product-export/src/f6-pdf-export.test.ts
```

Expected: FAIL，因为 `validatedF6InlineImages` 尚未导出。

- [ ] **Step 3: 最小化导出既有实现**

在 `f6-pdf-export.ts` 仅把现有私有函数：

```ts
function inlineReportImages(input: F6PdfRenderInput): ReadonlyMap<string, string>
```

改名并导出为：

```ts
export function validatedF6InlineImages(input: F6PdfRenderInput): ReadonlyMap<string, string>
```

将 `renderF6PdfSync()` 中唯一调用点改为 `validatedF6InlineImages(input)`。不得改变 containment、symlink、TOCTOU、media type 或错误处理逻辑。

- [ ] **Step 4: 运行聚焦测试并确认 GREEN**

Run:

```powershell
npx vitest run --project node packages/product-export/src/f6-pdf-export.test.ts
```

Expected: PASS，现有 PDF 测试与新 helper 测试全部通过。

- [ ] **Step 5: 提交**

```powershell
git add packages/product-export/src/f6-pdf-export.ts packages/product-export/src/f6-pdf-export.test.ts
git commit -m "refactor: expose validated F6 inline images"
```

---

### Task 2: 创建 Microsoft 风格可编辑 Draft renderer

**Files:**
- Create: `packages/product-export/src/f6-editable-report.ts`
- Create: `packages/product-export/src/f6-editable-report.test.ts`
- Modify: `packages/product-export/src/index.ts`

**Interfaces:**
- Consumes:

```ts
export interface F6EditableReportInput {
  readonly governedHtml: string;
  readonly sourceReportName: string;
  readonly generatedAt: string;
}
```

- Produces:

```ts
export function renderF6EditableReport(input: F6EditableReportInput): string;
```

- The returned string is a complete `<!doctype html>` document with no external resource references.

- [ ] **Step 1: 写 Microsoft shell 与安全边界的失败测试**

创建 `f6-editable-report.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { renderF6EditableReport } from "./f6-editable-report.js";

const GOVERNED_HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><main><section class="report-content"><h1>TA Engineering Analysis Report</h1><a href="#worksheet-1">Analysis-A</a><section id="worksheet-1"><img src="data:image/png;base64,iVBORw0KGgo=" alt="Open tolerance path image"></section></section></main></body></html>`;

describe("renderF6EditableReport", () => {
  it("renders an offline Microsoft-style editable draft shell", () => {
    const html = renderF6EditableReport({
      governedHtml: GOVERNED_HTML,
      sourceReportName: "Feature6-Report.md",
      generatedAt: "2026-09-11T12:00:00.000Z",
    });

    expect(html).toContain("DRAFT / NOT GOVERNED");
    expect(html).toContain('contenteditable="true"');
    expect(html).toContain('data-action="save-draft"');
    expect(html).toContain('data-action="print-report"');
    expect(html).toContain("Segoe UI Variable");
    expect(html).toContain("#0078d4");
    expect(html).toContain(":focus-visible");
    expect(html).toContain("@media print");
    expect(html).toContain("letter-spacing:0");
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\//iu);
  });
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```powershell
npx vitest run --project node packages/product-export/src/f6-editable-report.test.ts
```

Expected: FAIL，因为模块不存在。

- [ ] **Step 3: 实现最小完整 HTML shell**

实现 `renderF6EditableReport()`：

1. 验证 `governedHtml` 含完整 doctype、单一 `<main>` 和 `.report-content`。
2. 拒绝 `<script src>`、`<link href>`、`http:`、`https:`、UNC path 和 Windows absolute path。
3. 从 `governedHtml` 提取 `<main>...</main>`，不得执行或保留输入中的 script。
4. 输出新的完整 HTML，包含 CSP：

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'">
```

5. 在不可编辑 toolbar 中渲染 Draft badge、source label、状态文本和两个按钮。
6. 将报告正文包在：

```html
<main class="report-shell" data-editable-report contenteditable="true" spellcheck="true">
```

7. CSS 使用 spec 第 6 节 tokens；工具栏高度固定，正文最大宽度稳定，打印时隐藏 `[data-draft-controls]`、编辑 outline 和操作提示，保留固定 Draft watermark。
8. 图片保持 data URI，不产生网络访问。

- [ ] **Step 4: 导出接口并运行测试**

在 `packages/product-export/src/index.ts` 添加：

```ts
export * from "./f6-editable-report.js";
```

Run:

```powershell
npx vitest run --project node packages/product-export/src/f6-editable-report.test.ts packages/product-export/src/f6-pdf-export.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add packages/product-export/src/f6-editable-report.ts packages/product-export/src/f6-editable-report.test.ts packages/product-export/src/index.ts
git commit -m "feat: add editable F6 report draft shell"
```

---

### Task 3: 实现页面编辑、保存、打印与图片放大

**Files:**
- Modify: `packages/product-export/src/f6-editable-report.ts`
- Modify: `packages/product-export/src/f6-editable-report.test.ts`
- Create: `scripts/f6-editable-report.browser.test.mjs`

**Interfaces:**
- Consumes: Task 2 的完整 Draft HTML。
- Produces: 无服务器的浏览器交互；DOM selectors 固定为：
  - `[data-editable-report]`
  - `[data-draft-status]`
  - `[data-action="save-draft"]`
  - `[data-action="print-report"]`
  - `[data-image-detail]`

- [ ] **Step 1: 写交互结构失败测试**

新增断言：

```ts
const renderPrototype = (): string => renderF6EditableReport({
  governedHtml: GOVERNED_HTML,
  sourceReportName: "Feature6-Report.md",
  generatedAt: "2026-09-11T12:00:00.000Z",
});

it("embeds local edit, save, print, and image-detail behavior", () => {
  const html = renderPrototype();

  expect(html).toContain("Unsaved changes");
  expect(html).toContain("URL.createObjectURL");
  expect(html).toContain("Feature6-Report-Draft.html");
  expect(html).toContain("window.print()");
  expect(html).toContain('data-image-detail');
  expect(html).toContain("showModal()");
  expect(html).toContain('event.key === "Escape"');
});
```

再增加结构断言，要求每个 `.stack-image img` 被同页 detail trigger 包裹，detail dialog 复制同一个 data URI，不使用 `file:` URL。

同时创建 `scripts/f6-editable-report.browser.test.mjs`，在实现交互前定义真实浏览器流程：

```js
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect as playwrightExpect } from "@playwright/test";
import { it } from "vitest";
import { renderF6EditableReport } from "../packages/product-export/dist/f6-editable-report.js";

const GOVERNED_HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><main><section class="report-content"><h1>TA Engineering Analysis Report</h1><a href="#worksheet-1">Analysis-A</a><section id="worksheet-1"><figure class="stack-image"><img src="data:image/png;base64,iVBORw0KGgo=" alt="Open tolerance path image"></figure></section></section></main></body></html>`;

it("edits, saves, prints, and reopens an offline draft", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "f6-editable-browser-"));
  const htmlPath = path.join(root, "Feature6-Report-Draft.html");
  writeFileSync(htmlPath, renderF6EditableReport({
    governedHtml: GOVERNED_HTML,
    sourceReportName: "Feature6-Report.md",
    generatedAt: "2026-09-11T12:00:00.000Z",
  }), "utf8");
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const networkRequests = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("file:")) networkRequests.push(request.url());
  });

  try {
await page.goto(pathToFileURL(htmlPath).href);
await playwrightExpect(page.getByText("DRAFT / NOT GOVERNED")).toBeVisible();
await page.locator("[data-editable-report] h1").fill("Edited TA Engineering Report");
await playwrightExpect(page.locator("[data-draft-status]")).toHaveText("Unsaved changes");

const downloadPromise = page.waitForEvent("download");
await page.locator('[data-action="save-draft"]').click();
const download = await downloadPromise;
await playwrightExpect(download.suggestedFilename()).toBe("Feature6-Report-Draft.html");
await playwrightExpect(networkRequests).toEqual([]);
  } finally {
    await browser.close();
    rmSync(root, { recursive: true, force: true });
  }
});
```

测试还必须定义：下载后的 HTML 重新打开并保留标题与图片、print button 只调用一次 `window.print()`、图片 dialog 可打开并可用 Escape 关闭、页面无网络请求、print media 隐藏 controls 并保留 Draft watermark。

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```powershell
npx vitest run --project node packages/product-export/src/f6-editable-report.test.ts scripts/f6-editable-report.browser.test.mjs
```

Expected: 两个测试文件均因缺少 dirty/save/print/dialog 行为而 FAIL；失败不得来自浏览器安装、路径或 fixture 错误。

- [ ] **Step 3: 实现 dirty 与保存行为**

内联脚本必须：

```js
const report = document.querySelector("[data-editable-report]");
const status = document.querySelector("[data-draft-status]");
report.addEventListener("input", () => {
  document.documentElement.dataset.dirty = "true";
  status.textContent = "Unsaved changes";
});
```

保存时：

1. clone `document.documentElement`。
2. 将 clone 的 `data-dirty` 设为 `false`。
3. 将 clone 中 `[data-draft-status]` 文本设为 `Saved draft`。
4. 生成 `<!doctype html>\n${clone.outerHTML}` Blob。
5. 使用临时 `<a download="Feature6-Report-Draft.html">` 下载。
6. revoke object URL。
7. 成功触发下载后更新当前页面状态为 `Saved draft`。

不得使用 `localStorage`、`fetch`、XHR、File System Access API 或服务器调用。

- [ ] **Step 4: 实现打印与图片 detail**

- Print button 只调用 `window.print()`。
- renderer 为每个 `.stack-image img` 生成同页 trigger 和 `<dialog data-image-detail>`。
- dialog 使用相同 data URI；trigger click 调用 `showModal()`；关闭按钮和 Escape 调用 `close()`。
- dialog、按钮和焦点样式使用 Microsoft tokens；打印时 detail dialog 和所有 controls 隐藏。

- [ ] **Step 5: 运行测试并确认 GREEN**

Run:

```powershell
npx vitest run --project node packages/product-export/src/f6-editable-report.test.ts scripts/f6-editable-report.browser.test.mjs
```

Expected: PASS，0 个网络请求，编辑/保存/重开/打印/dialog 和 print media 全部通过。

- [ ] **Step 6: 提交**

```powershell
git add packages/product-export/src/f6-editable-report.ts packages/product-export/src/f6-editable-report.test.ts scripts/f6-editable-report.browser.test.mjs
git commit -m "feat: add local editing and draft export controls"
```

---

### Task 4: 创建只读 F6 原型生成 CLI

**Files:**
- Create: `scripts/generate-f6-editable-report.mjs`
- Create: `scripts/generate-f6-editable-report.test.mjs`
- Create: `scripts/f6-verified-run-test-fixture.mjs`
- Modify: `package.json`

**Interfaces:**
- CLI:

```text
npm run prototype:f6:report -- <f6-run-dir> --publish-root <managed-root> [--output-root <prototype-root>]
```

- Programmatic API:

```js
export function generateF6EditableReport(options)
```

with:

```js
{
  entryPath: string,
  publishRoot: string,
  outputRoot?: string,
  prototypeId?: string,
  generatedAt?: string,
}
```

- Result:

```js
{
  status: "created",
  sourceRunRoot: string,
  outputDirectory: string,
  htmlPath: string,
}
```

- Shared test fixture:

```js
export function createVerifiedF6RunFixture({ worksheetNames = ["Analysis-A"] } = {})
// returns { runRoot, bundle, cleanup }
```

`createVerifiedF6RunFixture()` 必须复用 `createF6ArtifactBundleFixture()`、`installRequiredMultimodalV3()` 和 `runF6FullValidation()`，使用固定测试 PDF bytes `%PDF-1.7\nvalidated report\n` 创建真实 accepted `f6-artifact-set-v3`。`cleanup()` 删除 fixture 的临时根。不得从测试文件导入 helper。

- [ ] **Step 1: 写 accepted-run 失败测试**

使用 `createVerifiedF6RunFixture()` 创建当前 V3 fixture，并调用：

```js
const verified = createVerifiedF6RunFixture();
const result = generateF6EditableReport({
  entryPath: verified.runRoot,
  publishRoot: verified.bundle.publishRoot,
  outputRoot: path.join(verified.bundle.root, "prototypes"),
  prototypeId: "11111111-1111-4111-8111-111111111111",
  generatedAt: "2026-09-11T12:00:00.000Z",
});
```

断言：

```js
expect(result.status).toBe("created");
expect(path.basename(result.htmlPath)).toBe("Feature6-Report-Draft.html");
expect(readFileSync(result.htmlPath, "utf8")).toContain("DRAFT / NOT GOVERNED");
expect(readdirSync(verified.runRoot).sort()).toEqual(originalRunFiles);
verified.cleanup();
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```powershell
npx vitest run --project node scripts/generate-f6-editable-report.test.mjs
```

Expected: FAIL，因为生成器不存在。

- [ ] **Step 3: 实现受控加载和 exclusive output**

生成器必须按顺序：

1. 调用 `validateExistingF6Artifact(entryPath, { publishRoot })`；非 `accepted` 立即失败。
2. 使用 `validatedF6InlineImages()` 加载 Markdown 中的图片。
3. 调用 `renderF6PdfHtml()` 生成现有受控报告 HTML 投影。
4. 调用 `renderF6EditableReport()` 添加 Draft shell 和交互。
5. 默认输出到 `test/demo-output/f6-report-prototypes/<uuid>/Feature6-Report-Draft.html`。
6. 校验 output root 的现有祖先不是 symlink/junction；UUID 目录和文件必须不存在。
7. 使用 exclusive create 写入 UTF-8 HTML；不得覆盖、append 或复用目标。
8. 输出 JSON result，不打印 HTML、图片 data URI 或绝对源工作簿路径。

- [ ] **Step 4: 写 fail-closed 安全测试**

新增测试：

- 非 accepted F6 run 被拒绝。
- output target 已存在时拒绝覆盖。
- symlink ancestor 被拒绝；Windows 不支持创建 symlink 的环境显式 skip。
- source run 文件集在生成前后完全一致。
- 输出 HTML 不包含源工作簿绝对路径、`http://`、`https://`、`<script src` 或 `<link href`。

- [ ] **Step 5: 添加 npm script 并运行 GREEN**

在 `package.json` 添加：

```json
"prototype:f6:report": "node scripts/generate-f6-editable-report.mjs"
```

Run:

```powershell
npx vitest run --project node scripts/generate-f6-editable-report.test.mjs packages/product-export/src/f6-editable-report.test.ts packages/product-export/src/f6-pdf-export.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```powershell
git add package.json scripts/f6-verified-run-test-fixture.mjs scripts/generate-f6-editable-report.mjs scripts/generate-f6-editable-report.test.mjs
git commit -m "feat: generate editable F6 report prototypes"
```

---

### Task 5: 浏览器视觉验收 Microsoft 报告版式

**Files:**
- Modify: none expected

**Interfaces:**
- Consumes: Task 4 生成的自包含 HTML fixture。
- Produces: Edge/Chromium 桌面与打印版式验收结果。

- [ ] **Step 1: 生成非机密 fixture 原型**

使用 Task 4 的 test fixture 生成 HTML，并在 Edge `1440x1000` viewport 打开。不得使用真实工作簿内容。

- [ ] **Step 2: 检查桌面布局**

确认 toolbar、Draft badge、正文和表格不重叠；最长表头不溢出；正文左对齐；颜色符合 spec；图片非空白；focus 状态清楚；没有不必要的圆角卡片、渐变或装饰。

- [ ] **Step 3: 检查打印布局**

切换 print media，确认 controls、dialog 和编辑 outline 隐藏，Draft watermark 保留，A4 landscape 下无横向溢出、空白页、内容遮挡或异常截断。

- [ ] **Step 4: 若发现缺陷，先补 RED 测试再修复**

每个视觉缺陷先在 `f6-editable-report.test.ts` 或 `f6-editable-report.browser.test.mjs` 增加可重复失败断言，确认 RED 后才修改 renderer；修复后重跑两个测试文件并单独提交：

```powershell
git add packages/product-export/src/f6-editable-report.ts packages/product-export/src/f6-editable-report.test.ts scripts/f6-editable-report.browser.test.mjs
git commit -m "fix: polish editable F6 report layout"
```

---

### Task 6: 生成真实原型并完成回归验证

**Files:**
- Modify: none expected
- Generated, ignored: `test/demo-output/f6-report-prototypes/<uuid>/Feature6-Report-Draft.html`

**Interfaces:**
- Consumes: 当前 validator-confirmed F6 run。
- Produces: 用户可打开和编辑的真实 Draft HTML，不提交 Git。

- [ ] **Step 1: 运行 build**

Run:

```powershell
npm run build -- --force
```

Expected: exit 0。

- [ ] **Step 2: 运行完整聚焦测试集**

Run:

```powershell
npx vitest run --project node packages/product-export/src/f6-pdf-export.test.ts packages/product-export/src/f6-editable-report.test.ts scripts/generate-f6-editable-report.test.mjs scripts/f6-editable-report.browser.test.mjs scripts/f6-full-flow.test.mjs scripts/verify-current-f6.test.mjs
```

Expected: all PASS，0 failures。

- [ ] **Step 3: 验证正式 F6 合同未变化**

Run:

```powershell
node scripts/verify-current-f6.mjs
```

Expected: `status: accepted`，仍为五文件 `f6-artifact-set-v3`。

- [ ] **Step 4: 从当前真实 F6 run 生成原型**

Run:

```powershell
$sourcePublishRoot = 'C:\Users\xumax\AI Project\AI TVA Analysis\test\demo-output'
$env:AI_TVA_F6_PUBLISH_ROOT = $sourcePublishRoot
$validated = node scripts/verify-current-f6.mjs | ConvertFrom-Json
if ($validated.status -ne 'accepted') { throw "Current F6 report is not accepted: $($validated.reasonCode)" }
npm run prototype:f6:report -- $validated.outputDirectory --publish-root $sourcePublishRoot --output-root (Join-Path $PWD 'test\demo-output\f6-report-prototypes')
Remove-Item Env:AI_TVA_F6_PUBLISH_ROOT
```

`$validated.outputDirectory` 必须直接来自 validator 输出，不得根据目录名猜测。Expected: JSON `status: created`，返回唯一 `Feature6-Report-Draft.html`。

- [ ] **Step 5: 浏览器视觉验收**

用 Edge 打开生成 HTML，检查桌面 `1440x1000` 和打印 media：

- Microsoft tokens、标题层级和表格清晰。
- 工具栏与正文不重叠。
- 长表格无水平溢出。
- 图片非空白且可打开 detail dialog。
- 编辑标题后显示 `Unsaved changes`。
- 保存后下载的新 HTML 可重新打开并保留修改。
- 打印预览无空白页、内容遮挡或异常截断。

保存一张临时 screenshot 作为本地验收证据，但不得提交包含真实机密内容的截图。

- [ ] **Step 6: 最终 diff 与仓库检查**

Run:

```powershell
git diff --check
git status --short
git log --oneline main..HEAD
npm run check:repository
```

Expected: 无未提交代码；生成 HTML 被 `.gitignore` 排除；repository check exit 0。

- [ ] **Step 7: 最终提交（仅在 Step 5 暴露并修复问题时）**

```powershell
git add packages/product-export/src/f6-editable-report.ts packages/product-export/src/f6-editable-report.test.ts scripts/f6-editable-report.browser.test.mjs scripts/generate-f6-editable-report.mjs scripts/generate-f6-editable-report.test.mjs
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) { throw 'No final polish changes to commit.' }
git commit -m "fix: polish editable F6 report prototype"
```

不得提交 `test/demo-output` 下的真实原型或 screenshot。
