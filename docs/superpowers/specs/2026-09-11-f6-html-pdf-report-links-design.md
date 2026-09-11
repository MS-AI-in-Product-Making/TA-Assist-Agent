# F6 可编辑 HTML 与 PDF 报告原型设计

**日期：** 2026-09-11  
**状态：** 已批准
**目标分支：** `feat/f6-html-pdf-report-links`

## 1. 目标

使用当前真实 F6 报告内容创建一个独立、离线、可直接编辑的 HTML 原型，用于确定最终工程报告的版式和内容。原型采用克制、清晰的 Microsoft 工程文档风格，可保存修改后的 HTML 草稿，并可通过浏览器打印或导出为 PDF。

HTML 原型是明确标记为 `DRAFT / NOT GOVERNED` 的设计评审资产。本轮不把它接入正式 F6 发布流程，不替换现有 `Feature6-Report.md` 或 `Feature6-Report.pdf`，也不改变五文件治理合同。用户确认原型后，再单独设计正式 F6 renderer、受保护计算字段和治理发布门。

## 2. 范围

本变更只创建 F6 报告设计原型：

- 从当前 validator-confirmed F6 报告读取真实内容和图片。
- 生成自包含 Microsoft 风格 HTML。
- 在浏览器页面内直接编辑报告正文。
- 保存修改后的独立 Draft HTML。
- 使用浏览器打印或导出 Draft PDF。
- 保留 HTML 内部章节链接和图片交互。

本变更不修改：

- F1-F5 工作流。
- TA 数值计算、能力指标或优化策略。
- F6 报告业务内容与处置逻辑。
- 最终五文件发布合同。
- 源工作簿或任何历史运行产物。
- 正式 F6 renderer、runner、manifest 和 verifier。

## 3. 当前问题

当前 F6 只有最终 Markdown/PDF，没有一个适合用户在定稿前直接调整版式与文字的可视化草稿。现有 HTML 仅存在于 PDF 导出的临时目录，生成后立即删除，且页面没有编辑、另存或草稿状态能力。

当前 PDF 中图片链接也会在 HTML 投影时被替换为纯内嵌 `<img>`，不适合作为最终交互方案的设计基线。原型需要让用户先验证目录、图片、内容密度和打印版式，再决定正式 F6 的链接和发布合同。

## 4. 方案决策

采用独立原型页面方案，不直接修改正式 F6 HTML/PDF renderer。

理由：

1. 用户可以先用真实内容确认信息架构、样式和文字，再固化正式 renderer。
2. 原型与正式治理产物隔离，不会让手工修改后的数值或结论冒充已验证结果。
3. 自包含 HTML 可以离线打开、直接编辑、另存和打印，不需要本地服务器或网络服务。
4. 后续正式接入时可将已确认的视觉 tokens、布局和交互迁移到 `product-export`，避免反复修改正式发布链路。

## 5. 数据流

```text
Validator-confirmed current F6 report
  -> read governed Markdown and validated image
  -> generate self-contained editable Draft HTML
  -> user edits content in the browser
     -> save a new Draft HTML snapshot
     -> print or export Draft PDF
  -> user reviews layout and content
  -> later phase: translate approved design into formal F6 renderer
```

原型文件存放在独立的受控 prototype 目录，不写入任何历史 F6 run。保存操作创建新的本地 Draft HTML，不回写源 Markdown、源工作簿或正式 PDF。

## 6. HTML 报告设计

### 6.1 视觉语言

报告采用 Microsoft Fluent 工程文档方向，而不是营销页面：

| Token | Value | 用途 |
| --- | --- | --- |
| Microsoft Blue | `#0078D4` | 主标题规则线、关键数据和链接 |
| Fluent Blue Dark | `#005A9E` | 链接 hover/focus 与强调 |
| Ink | `#172033` | 主文本 |
| Neutral | `#4B5563` | 次级说明 |
| Surface | `#FFFFFF` | 报告纸面 |
| Canvas | `#F3F6F9` | 屏幕背景与表格分区 |
| Success | `#107C10` | PASS |
| Warning | `#8A4B08` | REVIEW / WARNING |
| Critical | `#D13438` | FAIL / 缺失信息 |

字体使用 `Segoe UI Variable`、`Segoe UI`，并提供可靠的 sans-serif fallback。标题、表格和数字采用清楚的层级与 tabular numerals；字距固定为 `0`。

### 6.2 布局

- 屏幕模式：居中的工程纸面，适度最大宽度和清晰页边距。
- 打印模式：A4 landscape，移除屏幕背景和装饰，不依赖阴影。
- Document Overview 与 Workbook Summary 保持可扫描表格。
- 每个工作表强制从新页开始。
- Factor 表、统计图和贡献图保持现有信息密度，不创建嵌套卡片。
- 链接具有可见下划线、键盘焦点轮廓和足够对比度。

### 6.3 页面内编辑

- 报告正文使用 `contenteditable`，点击后可直接修改标题、段落和表格文字。
- 固定工具栏不属于可编辑正文，提供编辑状态、保存 Draft HTML 和打印/导出 PDF 操作。
- 页面持续显示 `DRAFT / NOT GOVERNED`，手工修改后切换为 `Unsaved changes` 状态。
- 保存通过浏览器本地 Blob 下载生成新的自包含 HTML，不调用服务器，不覆盖原型源文件。
- 打印时隐藏工具栏、编辑轮廓和操作提示，但保留 Draft 水印。
- 支持键盘操作和清晰的 `:focus-visible` 状态；不劫持浏览器原生撤销、重做和文本选择。

## 7. 原型链接行为

### 7.1 工作表目录

Workbook Summary 中的工作表名称必须生成 `href="#worksheet-N"`。对应工作表容器必须具有唯一 `id="worksheet-N"`。HTML 点击后滚动到目标章节；打印 PDF 时应保留可用的内部 destination/link annotation，供用户评估最终行为。

### 7.2 公差路径图片

图片以内嵌 data URI 渲染，保证原型另存后仍可离线显示。点击图片打开同页的放大查看层，避免本地 `file:` 链接被 PDF viewer 安全策略阻断。放大查看层提供关闭按钮和键盘 Escape 支持。

原型结构为：

```html
<a class="stack-image-link" href="#image-1-detail">
  <figure class="stack-image">
    <img src="VALIDATED_DATA_URI" alt="Open tolerance path image">
  </figure>
</a>
```

图片 data URI 只来自当前已验证的 F6 图片资产。禁止执行 `javascript:`、加载网络 URL、读取任意用户路径或把编辑后的 HTML 自动写回治理产物。

## 8. Draft HTML 保存与 PDF 导出

原型提供两个本地操作：

1. `Save draft HTML`：序列化当前可编辑正文、样式、脚本和内嵌图片，下载新的自包含 HTML。
2. `Print / export PDF`：调用浏览器原生打印界面，由用户选择 Microsoft Print to PDF 或 Save as PDF。

Draft PDF 不是正式 F6 工程报告，不写入 run summary 或 manifest。自动测试验证打印样式、工具栏隐藏、Draft 水印和内部链接 HTML 结构；人工验收使用 Edge 打印预览检查分页、重叠、截断和链接行为。

## 9. 错误处理

- 找不到当前 validator-confirmed F6 报告或图片：停止原型生成，不猜测历史路径。
- 图片验证失败：停止原型生成，不输出缺图版本。
- 浏览器不支持本地下载：保留页面编辑内容并给出明确状态，不清空用户修改。
- 打印由浏览器原生能力完成；取消打印不改变页面或已保存草稿。
- 不改写或修复历史 F6 运行目录，不把 Draft 状态表述为正式验证成功。

## 10. 测试策略

严格采用测试驱动开发：

1. DOM 测试先验证编辑、dirty 状态、保存和打印行为缺失，再实现最小交互。
2. HTML 结构测试要求内部章节锚点、图片放大入口、Microsoft tokens、`:focus-visible` 和 `@media print`。
3. 安全测试确认无外部脚本、网络资源、绝对机密路径和治理写回能力。
4. 保存测试确认导出的 HTML 保留用户修改、内嵌图片和 Draft 标记，并排除临时 dirty 状态。
5. 打印测试确认工具栏、编辑边框和操作提示隐藏，Draft 水印保留。
6. 运行当前 governed F6 verifier，证明原型未改变正式五文件合同。
7. 使用 Edge 在桌面视口打开原型，实际修改内容、保存后重新打开，并通过打印预览检查分页、重叠、截断和空白页。

## 11. 验收标准

- 新分支只包含 F6 报告原型、测试、生成工具和设计文档。
- HTML 明确采用 Microsoft 工程文档风格，并可在 Edge 中离线打开。
- 报告正文可直接编辑，修改后显示未保存状态。
- 保存后的 Draft HTML 可重新打开，并保留文字修改、版式和内嵌图片。
- HTML 工作表目录和图片放大入口均可点击。
- 浏览器打印预览可生成布局稳定的 Draft PDF，工具栏不进入打印内容。
- 页面始终明确标记 `DRAFT / NOT GOVERNED`。
- 正式 F6 仍只发布五个治理文件，原型不写入历史运行目录。
- F1-F5、计算结果、优化结果和正式报告处置不发生变化。
