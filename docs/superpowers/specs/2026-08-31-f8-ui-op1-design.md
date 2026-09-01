# F8 UI-OP1 设计

## 目标

优化 TA Assist Workbench 的工程审阅体验，并修复 UI 与受治理 TA 证据不一致的问题。Web 只展示 F1/F2/F3/F4/F5/F6 已验证字段，不自行发明工程术语、数值或图像到 factor 的映射。

## 已确认根因

### 工作簿名遮挡

Toolbar 使用三栏 Grid。工作簿名所在列允许收缩到 0，同时强制单行省略，因此长文件名被截断且没有完整可见的后备展示。

### 部分 worksheet 图片不显示

- `gap w foam_static`：F2 明确记录 `tolerancePathImageStatus: unavailable`，属于源证据缺失。
- `gap w rubber_TPoverload500g` 与 `gap w rubber_TPoverload500g(2)`：物理 PNG 均存在且 SHA-256 正确，但两张图片字节相同、路径不同。当前服务用 `contentHash` 单独作为 image artifact ID，并要求同一 hash 只对应一个路径，因此返回 404。

### Analysis flow 文本重叠

每个 progress step 渲染 marker、Feature ID、Feature 描述、状态四个元素，但 CSS 只定义两列且依赖隐式行，连接线也固定在第一行，导致描述与状态相互覆盖。

### Design Nominal 错误

Excel/F1 Markdown 在 `gap wo rubber_static` row 27 明确记录：

- `Design Nominal: 1.627`
- `Lower Spec Limit: 0`
- `Upper Spec Limit: 5`

当前 F2 worksheet specification 没有保存 worksheet-level Design Nominal。F4 handoff 和 Web 都自行使用 `(LSL + USL) / 2 = 2.5` 作为 `designNominal`。该派生与 Excel 证据冲突，必须从 F1 提取并贯穿 F2/F4/Web，不能仅修改 UI 标签。

### Factor Table 术语漂移

Web 把 F2 的完整 19 列压缩成自定义列，并添加 Excel/F2 不存在的 `Original text` 可见后缀。`Mean Offset` 也是 UI 自行定义的派生词；Excel 使用 `Mean Response`、`Adjusted Mean` 和 `Additional Mean Shift`。

### A/B/C/D 映射不可直接取得

A/B/C/D 是 tolerance-loop 图片中的视觉标注。当前 F1/F2 factor contract 只保存 Excel source row 和 E:T 字段，没有结构化的字母到 factor row 映射。用户已确认：仅显示 F5 v2 `linkedVisualLabels` 中已验证并绑定 `{tableId, sourceRow}` 的 Loop Label；无映射时显示 `Not available`，禁止按行顺序生成。

## 数据契约设计

### Worksheet Design Nominal

扩展 F1 worksheet response-summary extraction，读取 `Design Nominal:` 的唯一数值与 source cell。扩展 F2 worksheet system specification，保存 worksheet-level `designNominal` evidence。

F4 handoff 使用已验证的 `designNominal.actualValue`，不再从 LSL/USL 中点派生。LSL、USL、Target Sigma Level 和 Additional Mean Shift 保持各自现有身份。

兼容策略：新运行要求 Design Nominal 可验证；旧 artifact 不在当前 workbook run 中静默升级。缺失或歧义时按 worksheet fail-closed，并显示明确原因。

### F1 Image Identity

浏览器 image artifact identity 必须绑定：

- 当前 F2 artifact identity
- worksheet name
- image content hash
- F1 relative path

服务端从当前已验证 F2 report 查找指定 worksheet 的 image reference，再验证路径 containment、文件类型和 SHA-256。允许不同 worksheet 使用相同图片字节，但禁止同一 worksheet identity 指向多个路径。

`gap w foam_static` 继续显示受治理的 missing-image 状态，不伪造占位图片。

### Loop Label

Web model 从当前 F5 v2 image observation 的 structured `linkedVisualLabels` 读取 label，并按 `{tableId, sourceRow}` 绑定 factor。只显示通过现有 schema 身份检查的映射；无映射显示 `Not available`。

## UI 信息架构

桌面布局：

```text
[TA Assist | 完整 workbook 名称]
[Worksheet selector] [Actions]
[Analysis progress: marker / Feature / description / status]
[Workbook health summary] [F6 all-worksheet summary]

[Current worksheet + status]
[Compact tolerance-loop image + exact worksheet specification]

[Canonical F2 Factor Table]     [Sticky Live Analysis]
[19 columns, horizontal scroll] [Metrics]
[editable Design Nominal/Tol]   [Factor contribution]
[sticky identity columns]       [Specification range]

[Selected worksheet F6 options]
[F3 governance]
[Conversation drawer]
```

### Toolbar

工作簿名允许两行显示并支持 `overflow-wrap:anywhere`，同时提供完整 `title`。Toolbar 在中等宽度自动换行，不覆盖 Worksheet selector 或 actions。

### Analysis Progress

每个 step 使用明确的 marker 列和内容列；Feature ID、描述、状态分行，不使用隐式 Grid 放置。连接线只连接 marker。移动端为两列或四列分组，不产生文本覆盖。

### Workbook Summary

`WorkbookHealth` 和 F6 workbook-level summary 移到当前 worksheet 详情之前。默认先显示计数和 disposition；具体 findings 可展开并导航 worksheet。

### Evidence Pane

默认图片 stage 最大高度约 180px，保持 `object-fit:contain`；Full screen 保留。图片提供明确 width/height、lazy loading 和 load-error 状态。

字段使用 Excel/F2 原始标签：

- `Tolerance Loop Description`
- `Design Nominal`
- `Lower Spec Limit`
- `Upper Spec Limit`

值使用 source display value，不由 Web 二次计算。

### Canonical Factor Table

列名和顺序与 F2 Markdown 一致：

1. `Loop Label`
2. `Factor Description`
3. `Part Name`
4. `Drawing Number`
5. `DIM ID`
6. `Part Category`
7. `Design Nominal`
8. `+ Tolerance`
9. `- Tolerance`
10. `Long Term/Safety Factor`
11. `Sigma Level`
12. `Distribution`
13. `Mean`
14. `Tolerance`
15. `One Sigma`
16. `% Contribution to Sigma`
17. `Notes`
18. `Capability Result`
19. `Knowledge Recommendation`

`Loop Label` 替代可见 Excel row；Excel source row 保留在 accessible provenance/title 中。删除可见 `Original text` 后缀。可编辑字段保持 Design Nominal、+ Tolerance、- Tolerance；其他字段只读。

### Live Analysis Cockpit

桌面端 Factor Table 和 sticky Live Analysis 并列。Live Analysis 包含：

- `Mean Response`
- `Additional Mean Shift`
- `RSS`
- `Cp`, `CpkL`, `CpkU`, `Cpk`
- Margin, Yield, DPM
- Factor contribution
- Specification range and predicted distribution

修改 factor 参数后，同一区域立即显示 scenario 结果。删除 `Mean Offset` 术语及其派生展示。

### Conversation

桌面端改为可折叠右侧 drawer，不长期挤压主分析宽度。保持当前 worksheet/factor context 和 suggested prompts；移动端继续使用底部 drawer。Conversation 的打开状态由显式按钮控制并具有可见 focus 状态。

## Web Interface Guidelines

实现必须满足：

- 长文本容器正确换行或截断，并提供完整内容访问方式。
- 图片有 width/height、alt、lazy loading 和错误态。
- Icon button 有 aria-label。
- 输入有 label/aria-label、name、正确 type 和 autocomplete。
- 异步状态使用 aria-live。
- interactive row 不与内部 input/button 竞争事件。
- 使用 semantic button/link；避免新增 `span role=button`。
- 所有 focus-visible 状态可见。
- 不使用 `transition: all`。
- 数字列使用 tabular numerals。
- desktop/mobile 不发生页面级横向 overflow；宽表只在局部容器滚动。

## 验证

### 单元与契约测试

- F1 response-summary Design Nominal 唯一提取、缺失、歧义。
- F2 contract 和 Markdown 保持 source label/value/cell。
- F4 handoff 使用 Excel Design Nominal，不使用 spec midpoint。
- 相同 hash、不同 worksheet 路径的图片均可读取。
- missing image 与 image load failure 显示不同状态。
- Factor Table 19 列表头、字段顺序和无 `Original text`。
- Loop Label 只接受 F5 structured mapping。
- 无 `Mean Offset`，显示 `Mean Response` 和 `Additional Mean Shift`。

### 浏览器验收

使用实际 gap workbook session 验证：

- 长 workbook 名完整可访问。
- 两个 rubber overload worksheet 图片非空且渲染。
- foam static 显示 source image unavailable。
- `gap wo rubber_static` 显示 Design Nominal `1.627`、LSL `0`、USL `5`。
- Progress 文本在 desktop/mobile 不重叠。
- Workbook summary 位于 worksheet details 上方。
- Factor Table、metrics、contribution 和 specification plot 在桌面首个分析 viewport 同屏。
- 页面无横向 overflow；Factor Table 宽度只在局部 scroll container 内处理。
- 键盘 focus、drawer、zoom/fullscreen 和 parameter editing 可操作。
