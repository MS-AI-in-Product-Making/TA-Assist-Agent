# F6 HTML 与 PDF 报告链接优化设计

**日期：** 2026-09-11  
**状态：** 待用户审阅  
**目标分支：** `feat/f6-html-pdf-report-links`

## 1. 目标

优化 F6 工程报告的 HTML 投影和 PDF 导出，使报告符合克制、清晰的 Microsoft 工程文档风格，并确保 PDF 中的工作表目录和公差路径图片可点击。

HTML 是受控的临时中间文件，用于生成 PDF，但不进入最终发布目录、manifest 或用户报告链接。F6 最终仍发布现有五文件集合，用户报告仍为 Markdown 与 PDF。

## 2. 范围

本变更只涉及 F6 报告输出：

- Markdown 到 HTML 的投影。
- Microsoft 风格的屏幕与打印样式。
- HTML 内部章节链接和图片链接。
- Chromium HTML-to-PDF 导出。
- PDF 链接 annotation 验证。

本变更不修改：

- F1-F5 工作流。
- TA 数值计算、能力指标或优化策略。
- F6 报告业务内容与处置逻辑。
- 最终五文件发布合同。
- 源工作簿或任何历史运行产物。

## 3. 当前问题

当前 Markdown 报告包含工作表章节链接和原始图片链接。HTML 投影器会把图片链接替换为内嵌 `<img>`，但不会保留外层 `<a href>`。Chromium 打印后，PDF 只保留内部章节 destination，公差路径图片没有可执行链接 annotation。

现有 PDF 校验只验证 `%PDF-` 签名与 SHA-256，无法发现“PDF 可以打开但链接不可点击”的回归。

## 4. 方案决策

采用增强现有 HTML 投影器的方案，不引入新的浏览器自动化框架，也不在 PDF 生成后注入链接。

理由：

1. HTML 与 PDF 保持同源，符合当前哈希绑定与原子发布模型。
2. 复用现有 `marked` renderer、图片 containment 和哈希验证。
3. 改动集中在 `product-export` 与对应测试，不扩大到计算和编排层。
4. 避免 PDF 后处理带来的字体、结构、annotation 坐标和签名风险。

## 5. 数据流

```text
Validated F6 Markdown
  -> validate relative image references
  -> resolve images beneath managed publish root
  -> verify regular file, ancestry, identity, and hash
  -> render temporary Microsoft-style HTML
     -> internal worksheet anchors
     -> inlined image wrapped by validated source link
  -> Chromium print-to-PDF
  -> validate PDF signature, hash, and link annotations
  -> atomic five-file F6 publication
  -> delete temporary HTML
```

HTML 不得被复制到最终运行目录。无论成功或失败，临时目录都必须清理。

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

## 7. 链接行为

### 7.1 工作表目录

Workbook Summary 中的工作表名称必须生成 `href="#worksheet-N"`。对应工作表容器必须具有唯一 `id="worksheet-N"`。HTML 点击后滚动到目标章节；PDF 中必须生成内部 destination/link annotation。

### 7.2 公差路径图片

经验证的图片链接在 HTML 中渲染为：

```html
<a class="stack-image-link" href="VALIDATED_SOURCE_URI">
  <figure class="stack-image">
    <img src="VALIDATED_DATA_URI" alt="Open tolerance path image">
  </figure>
</a>
```

图片内容继续使用 data URI 内嵌，保证 PDF 渲染稳定。`href` 仅由已经通过受控 containment、非链接文件、TOCTOU 身份和哈希检查的图片路径生成，不直接采用未验证 Markdown 文本。

禁止 `javascript:`、`data:`、网络 URL、任意绝对输入和逃逸 managed root 的路径作为链接目标。无法建立安全链接时必须失败关闭，不得生成无链接 PDF 并报告成功。

本地 PDF viewer 可能基于安全策略询问用户是否允许打开本地文件，但 PDF 本身必须包含有效图片链接 annotation。

## 8. PDF 导出与验证

继续使用已安装的受控 Microsoft Edge 或 Google Chrome，以临时 HTML 生成 PDF。PDF 成功条件扩展为：

1. 文件以 `%PDF-` 开头。
2. SHA-256 与 run summary、manifest 一致。
3. 至少存在预期数量的内部章节链接 annotation。
4. 每个公差路径图片存在对应的链接 annotation。
5. annotation 目标不得包含未验证协议或越界路径。

链接校验应使用结构化 PDF parser 或仓库可控的解析能力，不使用脆弱的字节字符串计数作为正式验证逻辑。

## 9. 错误处理

- HTML 投影失败：停止 PDF 与最终发布。
- 图片验证失败：返回现有受控 PDF artifact 错误，不输出降级 HTML/PDF。
- Chromium 未生成链接 annotation：报告验证失败，不发布五文件集合。
- 临时文件清理失败不得泄露报告内容；错误日志不得包含机密 HTML、图片字节或绝对用户路径。
- 不改写或修复历史 F6 运行目录；修复只影响后续新运行。

## 10. 测试策略

严格采用测试驱动开发：

1. HTML 单元测试先证明图片当前未被 `<a>` 包裹，再要求安全 `href`、内部章节锚点、Microsoft tokens、focus-visible 与打印样式。
2. 安全测试覆盖网络协议、`javascript:`、绝对路径、路径穿越、符号链接和受控根逃逸。
3. 真实 PDF 集成测试使用受控 Chromium 生成 PDF，并结构化检查内部 destination 与图片 link annotation。
4. F6 runner/full-flow 测试确认最终仍是五文件、manifest-last、Markdown/PDF 同源和哈希一致。
5. 运行当前 governed F6 verifier，确认现有发布合同未被扩大。
6. 使用当前 TA 样例生成新运行，人工点击工作表目录和公差路径图片，并检查桌面 PDF 显示无重叠、截断或空白页。

## 11. 验收标准

- 新分支只包含 F6 报告输出相关代码、测试和设计文档。
- HTML 明确采用 Microsoft 工程文档风格，并可在 Chromium 中正确呈现。
- HTML 工作表目录与图片均可点击。
- PDF 工作表目录能跳转到对应章节。
- PDF 内嵌图片可点击并指向已验证原始图片。
- PDF 链接 annotation 由自动测试验证。
- 最终仍只发布五个治理文件，不保留临时 HTML。
- F1-F5、计算结果、优化结果和报告处置不发生变化。
