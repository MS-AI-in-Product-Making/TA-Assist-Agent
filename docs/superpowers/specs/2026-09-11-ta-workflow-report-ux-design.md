# TA 工作流与报告体验优化设计

## 1. 目标

在不调整项目目录结构、不重构计算内核、不删除历史兼容契约的前提下，减少 TA Assist Agent 的低价值交互，并修复最终工程报告的信息完整性、链接呈现和 PDF 可读性问题。

## 2. 范围约束

本次只修改现有控制点，不新增子系统，不迁移历史产物，不改变 TA 计算公式、能力判定、哈希治理、PDF 签名校验或 ADO 单次写入与回读协议。

保留以下兼容能力：

- Analysis Context 与 Optimization Targets 的 schema、artifact loader 和历史产物读取能力。
- CLI 已有可选参数及其机器接口，除非现有实现必须通过最小适配才能保持状态一致。
- `f6-top3-tolerance-policy-v1` 及其 OP1、OP2、OP3 确定性计算。
- F6 五文件发布集、Markdown/PDF 同源投影、manifest-last 发布与内容哈希校验。

不做以下工作：

- 不删除历史 schema 或历史运行支持。
- 不重构 Workbench、Agent Runtime、F5 或 F6 的目录与模块边界。
- 不修改源工作簿。
- 不改变 ADO 组织、项目、目标、确认、写入和回读治理门。

## 3. 工作流交互简化

### 3.1 Analysis Context 与 Optimization Targets

TA Assist Agent 的标准新运行不再向用户询问 Analysis Context 或 Optimization Targets，也不再停靠对应交互状态。标准流程在结果解释和必需图像评估完成后直接进入 Design Optimization。

新运行固定记录：

- `analysisContext.outcome = NOT_PROVIDED`
- `optimizationTargets.outcome = NOT_PROVIDED`

这两个决策继续写入 Optimization、run summary、manifest 和最终 ledger，以保持受控审计。内置 Top 3 策略不视为调用方 Optimization Targets，也不改变上述决策。

现有历史 artifact、CLI 高级入口和读取兼容逻辑保留，不在本次删除。

### 3.2 图像证据评估

图像证据评估从用户可选项改为标准流程内部必选步骤，不再显示“是否评估图像证据”的提示。

每个下游工作表独立执行以下五项评估：

- `tolerance_loop_closure`
- `datum_chain`
- `assembly_datum_face`
- `stack_start`
- `direction`

继续使用已验证的 F1 图片、完整活动 Factor 集和匹配的 F3/F4 证据，禁止跨工作表混用上下文，禁止推断不可见几何、Drawing Number、DIM ID、datum identity 或不受支持的标签映射。

失败策略按工作表隔离：

- 某一工作表缺图、图像哈希或身份不匹配、五项评估不完整、观察 artifact 回读失败或 Factor 映射失败时，仅该工作表进入 `FAIL`。
- 其他工作表继续分析并进入最终报告。
- 标准新运行不再把内部评估失败降级为 `not_evaluated` 成功结果。
- 低置信度或证据不足仍可记录为 `needs_review` / `insufficient_evidence`，但必须证明五项评估实际完成。

## 4. ADO 默认标题交互

新建 ADO Task 时保留可编辑标题输入。标题输入旁紧邻显示使用当前 Excel 文件名展开的示例标题：

`[TA Requirement][Project][Phase] Update Drawing Requirements for <current-workbook-name.xlsx>`

示例标题要求：

- 只读显示，不替代用户编辑值。
- 提供复制图标按钮和说明性 tooltip。
- 点击复制完整示例标题。
- 保持现有 title、task owner、目标验证和最终写入确认契约不变。

## 5. 最终回复报告链接

TA Assist Agent 成功完成后只呈现两个 validator-confirmed 报告链接，不再向用户显示裸绝对路径。

链接标签使用源 Excel 文件名：

- `<Excel 文件名（不含 .xlsx）> - TA Report`
- `<Excel 文件名（不含 .xlsx）> - TA Report PDF`

链接目标仍从最终验证通过的 Markdown/PDF 路径转换为 workspace-relative 链接。不得从 run ID 猜测路径；任一报告缺失、越界、陈旧或哈希验证失败时不得呈现成功链接。

CLI 的可信机器输出可继续保留绝对路径，避免把用户回复契约扩散到自动化接口。

## 6. 第三节完整 Factor 表

### 6.1 所有工作表均显示

最终报告第三节中的每个工作表都必须显示一张完整 Factor 表，包括 ready、blocked、`PASS`、`CONDITIONAL_PASS`、`INCOMPLETE` 和 `FAIL` 工作表。

ready 工作表的显示行数必须等于当前确定性计算中的 `factorCount`。blocked 工作表的显示行数必须等于 F2 中该工作表的全部活动 Factor 行数。

### 6.2 单表显示列

Factor 信息保持一张表，不拆分。用户可见列固定为：

1. Factor Description
2. Part Name
3. Part Category
4. Drawing Number
5. DIM ID
6. Design Nominal
7. + Tolerance
8. - Tolerance
9. Long Term / Safety Factor
10. Sigma Level
11. Mean
12. Tolerance
13. One Sigma
14. Capability / Knowledge Guidance

以下字段继续保留在受控 artifact 与内部追溯中，但不在最终报告表格显示：

- Source Row
- Notes
- Validation Status
- Missing Fields
- Ordinal
- Distribution
- Variance Contribution

### 6.3 缺失字段与 blocked 工作表

因表格信息填写不全而失败的工作表仍展示全部活动行。缺失字段所在单元格显示 `MISSING`，对应整行使用可打印的浅红色背景。

表格上方显示简洁缺失摘要，但不新增 `Validation Status` 或 `Missing Fields` 列。内部继续使用 worksheet、table ID 和 source row 验证行身份。

blocked 工作表的数据来源只允许使用已验证的 F2 行：

- 已存在的字段按原值显示。
- 缺失字段显示 `MISSING`。
- 未执行、无权生成或无法从受控上游取得的计算字段显示 `N/A`。
- 不调用后续计算补全 blocked 行，不推测缺失值。

## 7. PDF 排版

PDF 改为 A4 landscape 自然分页。删除把每个工作表强制压入单页的固定高度、负边距、隐藏溢出、强制 `break-after` 和整体 JS scale。

排版规则：

- 工作表内容允许自然跨页。
- Factor 表允许跨页并重复表头。
- 单个 Factor 行不得被拆到两页。
- 表头和单元格允许最多两行的正常换行。
- 禁止逐字符断行和 `overflow-wrap:anywhere`。
- Factor Description、Part Name 和 Capability / Knowledge Guidance 获得较宽列。
- 数值列紧凑、右对齐并保持工程单位。
- 图片、单个统计 panel 和短图表使用 `break-inside: avoid`。
- 不使用整体缩放牺牲字号；正文和表格使用稳定的最小可读字号。
- 不要求每个工作表独占一页，减少无意义空白。
- 页眉、页脚、页码和来源哈希继续保留。

## 8. 数据流与兼容性

标准新运行的数据流调整为：

`F4 complete -> internal image evaluation -> F5 -> required multimodal interpretation -> F6 -> optional ADO publishing`

不再经过 image decision、analysis context decision 或 optimization targets decision 用户门。历史会话和历史 artifact 的解析能力保留；新会话不得停靠已移除的标准交互门。

报告投影继续以 F2/F3/F4/F5/F6 的受控结果为唯一数据来源。PDF 只改变同源报告的视觉投影，不改变工程值、状态或 disposition。

## 9. 验收标准

### 9.1 工作流

- 标准 TA Assist Agent 运行不出现 Analysis Context、Optimization Targets 或图像评估选择提示。
- 两个可选输入决策均记录为 `NOT_PROVIDED`。
- 内置 Top 3 策略继续按原条件运行。
- 图像评估自动执行；单表失败只阻塞该表，其余表继续。

### 9.2 ADO 与最终回复

- ADO 标题输入旁显示当前 Excel 文件名展开的示例和复制按钮。
- 最终回复只显示两个以 Excel 文件名命名的可点击报告链接。
- 用户可见回复不显示裸绝对路径。

### 9.3 报告完整性

- 第三节每个工作表恰好有一张完整 Factor 表。
- 表格只显示本设计列出的 14 列。
- ready 和 blocked 工作表的行覆盖均与受控来源一致。
- 所有 required missing fields 在对应行显示 `MISSING`。
- blocked 行未产生的计算结果显示 `N/A`。

### 9.4 PDF 可读性

使用真实受控 Edge/Chrome 打印并验证：

- 页面标题和工作表标题不被裁切。
- 表格、图表和正文不存在隐藏溢出。
- 不出现逐字符换行。
- Factor 表跨页时表头重复，单行不跨页。
- 页面不因强制工作表独占页产生大面积空白。
- PDF 文本提取能找到每个工作表及其全部 Factor Description。
- PDF 签名、Markdown/PDF 内容哈希、五文件 artifact set 和最终 validator 继续通过。

## 10. 预计修改边界

实现优先限制在以下现有文件及其邻近测试：

- `.github/skills/design-optimization/SKILL.md`
- `.github/skills/result-interpretation/SKILL.md`
- `.github/skills/ta-assist-agent/SKILL.md`
- `scripts/f6-skill.test.mjs`
- `packages/workbench/src/state-machine.ts`
- `packages/workbench/src/state-machine.test.ts`
- `apps/workbench-server/src/server.ts`
- `apps/workbench-server/src/server.test.ts`
- `apps/workbench-web/src/components/F6InputGate.tsx` 及测试（仅在移除标准 gate 引用所必需时）
- `apps/workbench-web/src/components/AdoWorkspaceDecision.tsx` 及测试
- `scripts/f6-final-report.mjs`
- `scripts/f6-final-report.test.mjs`
- `packages/product-export/src/f6-pdf-report.ts`
- `packages/product-export/src/f6-pdf-export.test.ts`
- `apps/workbench-server/src/f6-pdf-report.test.ts`

只有测试或编译证明存在直接依赖时，才允许增加邻近文件；不得借机重构或清理无关代码。
