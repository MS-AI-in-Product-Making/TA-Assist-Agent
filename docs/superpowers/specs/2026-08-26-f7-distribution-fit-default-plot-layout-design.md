# F7 Distribution Fit 默认 Plot 与右侧说明栏设计

## 1. 背景与目标

Distribution Fit 当前要求用户手动点击 `Show plot` 才能查看候选分布图，并将图例、样本量和参考值横向排列在 Plot 下方。候选表已经通过 `selectionDecision.proposedFinalFamily` 高亮最终选择，因此页面应同步使用该字段自动展示最重要的 Plot，并改善图表说明的扫描效率。

目标：

1. 最终选择的 Distribution 在进入 Distribution Fit 后自动显示 Plot。
2. 未选择的 Distribution 默认不显示 Plot。
3. 桌面端把所有 Plot 说明移到 Plot 右侧，并按用途分组。
4. 移动端保持内容完整、可读且不造成页面级横向溢出。

## 2. 已批准交互

`selectionDecision.proposedFinalFamily` 是高亮行和默认 Plot 的唯一事实来源。

- 当 Distribution Fit 结果可用且用户进入该阶段时，自动展开 `proposedFinalFamily` 对应的 Plot。
- 若没有 `proposedFinalFamily`，所有 Plot 默认折叠。
- 用户可点击任意候选的 `Show plot`；展开新候选时关闭此前 Plot，始终最多显示一个。
- 用户可点击当前候选的 `Hide plot`，将所有 Plot 折叠。自动默认只在进入阶段、切换因子或收到新的拟合结果时应用，不会立即覆盖用户的手动折叠。
- 离开 factor workspace 后仍清理展开状态，避免状态泄漏到下一次会话。

## 3. Plot 布局

采用已批准的 A 方案“分组信息栏”。

桌面端 Plot 内容使用双栏布局：

- 左栏约占 72%，承载现有 SVG histogram、拟合曲线、坐标轴和参考线。
- 右栏约占 28%，承载语义化 `figcaption`。
- 右栏分为 `Legend` 和 `References` 两组。
- `Legend` 显示 Observed frequency、动态的 Fitted `<distribution>` expected frequency，以及样本量 `n`。
- `References` 使用标签/值两列展示 LSL、USL、Target、Mean、±3σ 和 ±4σ。
- 数值继续复用现有格式化逻辑，不改变统计含义、精度或 `midpoint-derived` 标记。

SVG 内的 LSL、USL、Target、Mean、±3σ、±4σ 标签和参考线保留。右栏是便于阅读的完整文字说明，不替代图内定位标签。

## 4. 响应式行为

- 宽屏下图表和说明栏并排，Grid 轨道使用 `minmax(0, ...)`，避免 SVG 最小内容宽度撑开页面。
- Plot 区域在空间不足时允许内部横向滚动。
- 窄屏下改为 Plot 在上、说明栏在下；说明栏移除左边界并增加顶部分隔线。
- 页面本身不得出现横向溢出；现有候选表继续在自己的滚动容器中滚动。

## 5. 组件边界

### `MeasurementPastePanel.vue`

负责根据 `selectionDecision.proposedFinalFamily` 初始化和重置 `expandedPlotFamily`，并保留现有单一展开切换行为。它不复制候选选择规则，也不推导新的最终分布。

### `DistributionFitPlot.vue`

负责将现有 SVG 和 `figcaption` 包装为响应式双栏。说明内容改为语义化的 Legend 列表与 References 定义列表；图表数据计算和 SVG 绘制逻辑不变。

### `style.css`

负责桌面双栏、右侧分组、内部滚动和移动端堆叠。沿用现有颜色、字体和工业工作台视觉语言。

## 6. 测试与验收

自动化测试覆盖：

1. `proposedFinalFamily` 对应 Plot 在进入 Distribution Fit 后自动存在且按钮显示 `Hide plot`。
2. 其他候选 Plot 默认不存在且按钮显示 `Show plot`。
3. 点击其他候选后只显示该候选 Plot；点击当前候选可全部折叠。
4. 无最终选择时所有 Plot 默认折叠。
5. Plot 说明区包含 Legend、样本量及全部六类 References，并使用独立的右栏结构。
6. 390px 视口下页面无横向溢出，图表按需在内部滚动，说明栏堆叠在图表下方。

验证命令包括聚焦 Vitest、F7 Web 构建和浏览器桌面/移动端检查。

## 7. 非目标

- 不改变候选排序、拟合算法、Bootstrap、AIC/AICc/BIC 或最终选择治理逻辑。
- 不改变 Q-Q evidence 的展开行为。
- 不允许同时展开多个候选 Plot。
- 不新增服务端字段或 API 请求。