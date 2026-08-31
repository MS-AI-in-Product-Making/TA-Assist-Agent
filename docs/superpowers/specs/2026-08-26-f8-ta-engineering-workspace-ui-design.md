# F8 TA 工程工作台用户界面设计

**日期：** 2026-08-26
**开发分支：** `user/xumax/F8-user-interact`
**状态：** 用户已批准
**关系：** 本设计替代 `2026-08-24-f8-user-interaction-workbench-design.md` 中面向普通用户的页面结构和流程展示；原有 session 状态机、安全边界、governed runners、artifact lineage、HostAction 和 F7 placeholder 设计继续有效。

## 目标

为不熟悉 VS Code 和 CLI 的 TA 工程用户提供一个直接可操作的本地 Web 工作台。用户上传 workbook 后，应进入以 TA 表格为核心的分析界面，可以调整临时 Scenario 数据、快速查看重算结果、阅读图表和结论，并在同一页面向 TA Assistant 提问。

F0-F7 是后台治理和计算实现，不是用户导航模型。普通用户界面不展示 Feature 编号、阶段队列、`running`、`pending` 或内部状态机。只有需要用户处理的业务问题、计算结果和可执行操作进入界面。

## 已确认决策

1. 采用 **Scenario 编辑模式（A）**：源 workbook 永远只读，网页修改不回写源文件。
2. 采用 **标准化 Factor 表格（A1）**：每行一个 Factor，不还原 Excel 的物理行列布局。
3. 采用 **工程分析图表组合（V1）**：Cp/Cpk 指标、Factor Contribution、Baseline 与 Scenario 对比、规格范围与预测分布。
4. 采用 **右侧常驻问答面板（C1）**：桌面约 70% 工程区、30% 对话区；窄屏改为底部抽屉。
5. 采用 **顶部 Worksheet 搜索下拉框（W1）**：显示 `Ready / Risk / Blocked / Modified` 业务状态。
6. 采用 **编辑后自动重算（R1）**：单元格失焦后约 300 ms 防抖，保留上一版有效结果。
7. 采用 **上传后自动进入工作台（E1）**：后台准备必要数据并打开第一个 `Ready` worksheet，不展示 F0-F7 进程。
8. F7 继续保持不可用，不生成模拟 measured 结果，也不在普通用户界面占用固定区域。

## 产品原则

- **表格优先：** 第一视觉焦点是 TA Factor 表格，不是状态、卡片或流程图。
- **业务语言：** 使用“正在准备 TA 工作区”“需要补充方向证据”“3 张 Worksheet 缺少必要数据”等表达。
- **即时反馈：** 编辑、计算、图表和结论围绕当前 Factor 与当前 Worksheet 联动。
- **原始证据不可变：** Baseline、源 workbook 和 governed artifacts 不被 Scenario 编辑覆盖。
- **渐进展示：** 默认展示工程人员当前需要的信息；审计、lineage 和内部阶段只在诊断入口中提供。
- **无隐藏写入：** 保存 Scenario、提升 F6 targets、导出结果均为独立明确操作。

## 用户工作流

### 首次进入

1. 用户打开本地工作台，只看到上传入口和最近使用的受管 session（如有）。
2. 用户上传 `.xlsx`。
3. 页面显示单一准备状态：“正在准备 TA 工作区…”。
4. 后台完成 workbook 安全检查、worksheet inventory 和必要的 governed analysis。
5. 系统自动打开第一个 `Ready` worksheet。
6. 如果没有 `Ready` worksheet，页面展示按业务原因归类的问题列表和可执行建议，不展示失败阶段名。

### 日常分析

1. 用户通过顶部下拉框切换 worksheet。
2. 用户在标准化表格中选择 Factor。
3. 右侧问答自动获得当前 workbook、worksheet、table 和 Factor 上下文。
4. 用户修改 `Nominal`、`+Tolerance`、`-Tolerance` 或 `Additional Mean Shift`。
5. 单元格失焦后触发防抖重算。
6. 指标、图表和风险结论更新为 Scenario 结果，同时保留 Baseline 对照。
7. 用户可撤销、重置、保存 Scenario，或将仅含公差调整的 Scenario 提升为 F6 候选 targets。

## 信息架构

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Workbook  Worksheet⌄  Baseline/Scenario  Undo  Reset  Save  Export      │
├──────────────────────────────────────────────────┬───────────────────────┤
│ TA Factor Table                                  │ TA Assistant          │
│ Factor | Nominal | +Tol | -Tol | Direction      │ 当前选择上下文        │
│ Contribution | Cp | Cpk | Status                 │ 对话记录              │
│                                                  │ 提问输入              │
├──────────────────────────────────────────────────┤                       │
│ Cp/Cpk │ RSS │ WC │ Margin                      │                       │
│ Contribution Chart                               │                       │
│ Baseline vs Scenario │ Specification Plot        │                       │
└──────────────────────────────────────────────────┴───────────────────────┘
```

### 顶部工具栏

- Workbook 名称与只读标记。
- 可搜索 Worksheet 下拉框；每项显示业务状态与是否存在未保存修改。
- `Baseline / Scenario` 分段控件。
- Undo、Reset 使用图标按钮并提供 tooltip。
- Save Scenario 和 Export 为明确命令。
- 当前有未保存修改时展示克制的状态提示，不使用全局弹窗。

### TA Factor 表格

固定列：

| 列 | 行为 |
|---|---|
| Factor / DIM ID | 只读；用于选择和问答上下文 |
| Nominal | Scenario 可编辑 |
| +Tolerance | Scenario 可编辑 |
| -Tolerance | Scenario 可编辑 |
| Direction | 只读 governed evidence；缺失时阻止需要方向的计算 |
| Contribution | 自动计算；支持排序 |
| Cp | 自动计算 |
| Cpk | 自动计算 |
| Status | `Pass / Risk / Blocked / Modified` |

表格行为：

- 单击选择行；双击或 Enter 进入可编辑单元格。
- 编辑值保留原始精度，不以显示格式覆盖真实数值。
- 非法数字、上下公差符号错误和不合理范围在单元格内提示。
- 表头固定，支持键盘上下移动与横向滚动。
- 不允许编辑 Factor identity、Direction 或 governed source references。
- 大表采用行虚拟化，动态内容不得改变列宽和布局。

### 结果与图表

结果区域跟随当前 worksheet，不跟随单个行选择隐藏整体结果。

1. **指标条：** Mean、RSS、Worst Case、Cp、Cpk、Margin。
2. **Contribution Chart：** 横向条形图，按贡献度降序；Baseline 与 Scenario 使用两种高对比但非单色的编码。
3. **Baseline vs Scenario：** 展示关键指标变化和方向，不把所有数字包装成卡片。
4. **Specification Plot：** 展示 LSL、USL、设计中心、预测均值和分布范围；缺少方向证据时展示明确空状态。

图表必须支持 tooltip、单位、数值格式和可访问文本摘要。首版使用 SVG/HTML 图表组件，不引入 3D 或动画图形库。

### TA Assistant

- 桌面端右侧常驻，宽度约占工作区 30%。
- 自动绑定当前 session、worksheet、table、Factor 和当前 Scenario Draft。
- 支持“解释当前 Cpk”“哪个 Factor 风险最高”“这次修改为什么无效”“给出可行的公差调整建议”等提问。
- 回答引用当前 validated artifact 或 calculation reference；缺少证据时明确说明。
- 对话不能直接修改表格、保存 Scenario 或提交 F6 targets；写操作必须回到显式控件确认。
- 窄屏下收起为底部抽屉，打开时不遮挡当前编辑单元格。

## 状态映射

后台状态只映射为以下用户状态：

| 后台情况 | 用户界面 |
|---|---|
| 上传、F0-F4 必要准备 | 正在准备 TA 工作区… |
| 等待 worksheet 决定 | 自动选择第一个 Ready；无 Ready 时展示问题清单 |
| 计算执行中 | 正在更新结果…，继续显示上一版有效结果 |
| 计算失败 | 保留编辑值和上一版结果，显示业务原因与重试 |
| 缺少证据 | 在相关单元格、图表或结论处显示阻塞原因 |
| ADO / image / context / targets 决策 | 仅在对应业务操作被触发时显示确认对话框 |
| F7 unavailable | 普通用户界面不显示；仅在请求 measured workflow 时说明暂不可用 |

## Scenario 数据模型与计算

- Baseline 来自 validated F2/F4 artifacts 和精确 run lineage。
- 每个 session 同时最多一个 active Scenario Draft。
- Draft 以稳定 identity 定位 Factor：`worksheetName + tableId + sourceRow`。
- 编辑值通过现有 What-if API 发送，不在浏览器复制 F4 公式。
- 300 ms 防抖从单元格失焦后开始；新的编辑使旧请求结果失效。
- 请求期间保留 `lastValidResult`，图表以轻量 updating 状态呈现。
- 失败只更新当前编辑错误，不清除 Draft 或 Baseline。
- Undo/Reset 是本地 Draft 变换；Save 后写入 SessionStore。
- 只有 tolerance-only 且与 Baseline 存在实际差异的 Draft 可提升为 F6 targets。

## 后台自动化边界

E1 不等于跳过治理确认。普通主路径由 Server 使用已有结构化命令自动完成可安全推导的 worksheet scope；以下情况仍必须要求用户处理：

- 没有可唯一确定的 `Ready` worksheet。
- Drawing Number、DIM ID 或方向证据存在歧义。
- ADO create/use/local-only 决定。
- 图片分析授权或输入缺失。
- Analysis Context、Optimization Targets 或 Scenario promotion 确认。

这些确认使用业务对话框或内联问题面板，不显示 Feature 名称。

## 响应式设计

- 桌面宽度优先，主表格与对话区使用稳定 `minmax()` 轨道。
- 中等宽度下问答区缩窄，图表改为单列。
- 小屏下工具栏换行，TA Assistant 变为底部抽屉，表格保持横向滚动。
- 不按 viewport 宽度缩放字体；表格数字使用 tabular numerals。
- 固定工具栏、表头和图表尺寸，避免计算状态引发布局跳动。

## 错误与恢复

- 上传失败：保留上传入口，显示可操作原因，不清空现有可用 workspace。
- 网络/SSE 中断：显示“连接恢复中”，编辑保留在本地，恢复后校验 revision。
- Revision 冲突：停止自动保存，刷新 Baseline 后让用户选择保留或放弃本地编辑。
- Evidence mismatch：禁止展示可能混合不同 run 的图表，要求刷新当前 worksheet。
- 计算不可用：保留上一版结果，并在关联 Factor 上说明缺少的证据。
- Server restart：从 SessionStore、artifact refs 和 Scenario Draft 恢复，不依赖浏览器内存中的流程状态。

## 安全与治理

- Server 仅监听 loopback，继续使用 cookie、CSRF、Host/Origin/CSP 和 opaque artifact ID。
- Workbook、artifact path 和绝对路径不暴露给浏览器。
- 浏览器不持有 Surface token、MCP bearer 或工作项写权限。
- 源 workbook 不修改、不覆盖、不回写。
- 图表和对话只能使用当前 input revision 的 validated artifacts。
- 导出与 F6 promotion 记录独立审计事件。

## 可访问性

- 表格支持键盘导航、可见焦点和屏幕阅读器列标题。
- 编辑错误通过 `aria-describedby` 关联单元格。
- 图表提供文本摘要，不仅依赖颜色。
- 状态同时使用文本和视觉编码。
- 图标按钮均有可访问名称与 tooltip。

## 测试与验收

### 单元测试

- worksheet 状态映射与自动选择。
- Factor row projection 和稳定 identity。
- Scenario cell validation、undo、reset 与 stale-result 抑制。
- Baseline/Scenario 指标和图表 view model。
- 后台状态到业务提示的映射，不出现 F0-F7 文案。

### 集成测试

- 上传后自动准备并进入第一个 Ready worksheet。
- 修改 tolerance 后触发一次防抖 What-if 请求。
- 失败时保留编辑值和上一版有效结果。
- Save Scenario 与 F6 promotion 保持独立确认。
- 对话请求携带当前 worksheet/Factor 上下文但不能直接写入。

### 浏览器验收

- 桌面和移动 viewport 无重叠、截断或布局跳动。
- 真实 workbook 可进入表格工作区并切换 worksheet。
- Cp/Cpk、Contribution、Baseline 对比和 Specification Plot 与 governed calculation 一致。
- 页面普通路径不出现 `F0` 至 `F7`、`running`、`pending` 或内部 state 名称。
- 原始 workbook 的内容 hash 在完整操作后保持不变。

## 非目标

- 还原完整 Excel 网格、公式编辑器或宏行为。
- 回写或覆盖源 workbook。
- 多 Scenario A/B/C 并行管理。
- 云端协作、多用户权限或远程部署。
- Monte Carlo 动画、3D 图形或复杂报表设计器。
- 在 F7 正式交付前提供 measured import 或模拟结果。

## 实施范围建议

实施按可独立验收的四个切片推进：

1. 用户壳层、上传准备态、Worksheet 导航和后台状态隐藏。
2. 标准化 Factor 表格、Scenario 编辑和自动 What-if。
3. 指标与 V1 图表组合。
4. 上下文问答、错误恢复、响应式与真实 workbook 浏览器验收。
