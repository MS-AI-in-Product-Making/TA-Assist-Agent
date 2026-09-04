# 产品能力 Skill 权威化设计

日期：2026-09-04
状态：已批准

## 背景

当前 `.github/skills` 同时存在八个产品能力 Skill 与三个按内部阶段编号命名的历史 Skill。`drawing-governance`、`result-interpretation`、`design-optimization` 只提供产品化触发入口，随后加载历史 Skill；完整工作流、治理门禁和报告协议仍由历史 Skill 定义。

这会产生三个问题：

1. 八个产品能力 Skill 没有成为真实能力边界，只是转发层。
2. Skill discovery 同时暴露产品名称和内部阶段名称，职责重复且容易触发错误入口。
3. 历史 Skill 被加载后，内部阶段语言进入 agent 上下文，进而出现在问题、进度更新和结果汇总中。

## 目标

1. 八个产品能力 Skill 成为唯一可发现、可调用、可组合的权威能力入口。
2. 删除三个历史 Skill 目录及所有产品 Skill 对它们的引用。
3. agent 的问题、进度更新、操作说明和最终结果仅使用用户语言下的产品能力名称。
4. 用户主动输入历史阶段名称时仍能被兼容识别，但回答和后续交互只使用产品能力名称。
5. 保持现有 deterministic runner、TypeScript contract、schema、artifact identity、manifest、hash 和工作流行为不变。

## 非目标

1. 不重命名内部 `featureId`、状态值、artifact kind 或 contract version。
2. 不迁移历史输出目录或已有 JSON/Markdown artifact。
3. 不改变计算公式、治理门禁、确认顺序、ADO write-once/readback 规则或图片观察规则。
4. 不把内部 CLI 名称或 artifact 文件名当作产品展示名称。

## 方案

采用“产品 Skill 权威化 + 内部兼容隔离”。

### 产品认知层

`.github/skills` 只保留以下八个产品能力入口：

- `knowledge-library`
- `data-parsing`
- `data-cleaning`
- `drawing-governance`
- `ta-calculation`
- `result-interpretation`
- `design-optimization`
- `feedback-application`

每个 Skill 直接定义自己的触发条件、输入、输出、治理边界、允许操作、验证要求和用户沟通规则。产品 Skill 不再加载按内部阶段命名的 Skill。

`drawing-governance`、`result-interpretation`、`design-optimization` 分别吸收当前历史 Skill 中完整且仍有效的治理协议。迁移时以产品能力和业务动作组织流程，不以内部阶段编号组织 agent 的计划。

### 执行适配层

内部 deterministic runner 继续使用现有 npm scripts、位置参数和 artifact roots。产品 Skill 可以在明确标记的内部执行段引用这些字面 contract，但必须遵守：

- 不在问题、进度更新、操作说明或最终报告中复述内部命令名。
- 工具执行前的说明使用产品能力名称。
- 读取内部输出后，先经过 product-language 投影再进入用户可见文本。
- 不从内部目录名或文件名推导产品显示名称。

可增加产品命名的 npm script alias，让常规工具活动显示产品能力名称；alias 必须调用同一个现有 runner，不改变参数和结果。原 scripts 保留以兼容自动化、测试和历史调用方。

### 内部协议层

以下内容保持原样：

- 内部 feature/stage ID 与状态机值。
- runner 参数、schema 与 contract version。
- artifact 文件名、输出目录结构和 manifest 字段。
- workbook/worksheet identity、SHA-256、containment 与 symlink 检查。
- ADO 目标确认、单次写入和单次 readback。
- 计算、图片观察、优化策略和最终 disposition 规则。

内部协议只服务机器执行和验证，不作为用户或 agent 规划词汇。

## Skill 拆分原则

### Knowledge Library

直接描述受控知识版本、查询边界和无独立执行器约束。禁止把内部阶段编号作为知识模块名称。

### Data Parsing

拥有 workbook 入口验证、selection-only 执行、worksheet 选择和解析 artifact 验证。只负责生成可验证的结构化输入，不执行后续清洗或分析。

### Data Cleaning

拥有 confirmed selection、必填字段检查、distribution/capability 校验和 ready/blocked handoff。输入必须来自同一 workbook revision 的 Data Parsing 输出。

### Drawing Governance

吸收当前完整 Drawing Number、DIM ID、traceability 和 ADO 发布协议。ADO 仍须使用独立模式选择、目标验证、完整 preview、最终确认、一次写入和一次 readback。

### TA Calculation

拥有 validated input 到 deterministic calculation 的完整输入条件、输出指标、formula provenance 和 validation 要求。

### Result Interpretation

吸收当前完整 interpretation 协议，包括 worksheet scope、图片证据五类观察、FACT/RULE/SIGNAL/OPTION 分类、fallback、artifact identity 和报告验证。

### Design Optimization

吸收当前完整端到端编排和优化协议。其 agent 计划使用产品能力顺序，不再使用内部阶段顺序。Analysis Context 和 Optimization Targets 保持两个独立确认；内置策略及最终五文件验证不变。

### Feedback Application

继续作为测量反馈导入与复核后的应用入口。未实现的执行能力必须明确说明，不得伪造 standalone workflow。

## 历史输入兼容

历史阶段名称不保留为 Skill metadata 或 Skill 目录。兼容识别通过现有 product-language 映射或独立 parser 完成：

1. 输入匹配历史名称时，解析为对应产品能力 ID。
2. 从首次回复起只使用用户语言下的产品能力名称。
3. 兼容输入不得被回显到进度、问题、按钮或最终报告。
4. 兼容映射测试可包含历史字面值，但产品 Skill 正文不依赖这些值。

## 用户可见出口

以下出口都必须使用统一产品语言投影与禁止标识断言：

- agent runtime 最终回答和 fallback。
- VS Code host prompt 与 pending-action projection。
- Workbench server host-action 回写。
- Workbench Web conversation、action queue、状态标签和错误摘要。
- CLI 的人类可读 stdout/stderr。
- Skill 的问题模板、进度模板和最终 ledger。

机器可读 JSON 模式可保留内部协议字段，但不得把机器字段混入人类可读摘要。

## 测试策略

### Skill 结构测试

- 断言 `.github/skills` 的产品能力集合完整。
- 断言三个历史 Skill 目录不存在。
- 断言产品 Skill 不引用历史目录。
- 断言 metadata、用户流程、问题模板、进度模板和最终模板不包含禁止的内部阶段显示形式。
- 断言三个迁入 Skill 保留原协议的关键门禁与允许操作。

### 兼容映射测试

- 历史输入可解析为正确产品能力。
- 中文输入产生中文产品名称，英文输入产生英文产品名称。
- 投影后的文本不包含历史阶段显示形式、内部 state 或 artifact kind。

### 行为回归测试

- Drawing Governance 的 workbook、existing artifact 和 ADO 分支保持原行为。
- Result Interpretation 的 image evaluated、not evaluated、invalid observation fallback 保持原行为。
- Design Optimization 的完整 workbook、existing artifact、optional input 和 built-in policy 保持原行为。
- 现有 runner、contract 和 artifact validation 测试全部通过。

### 交互泄漏测试

模拟一次完整 workbook 分析，收集 assistant messages、questions、progress updates、action labels 和 final ledger，断言只出现产品能力名称。内部 fixture 和 machine-readable payload 允许保留稳定 contract ID。

## 迁移顺序

1. 先扩展 Skill 结构与泄漏测试，使当前转发结构失败。
2. 将 Drawing Governance 协议迁入产品 Skill并验证。
3. 将 Result Interpretation 协议迁入产品 Skill并验证。
4. 将 Design Optimization 编排迁入产品 Skill并验证。
5. 删除三个历史 Skill 目录和失效引用。
6. 补齐用户可见出口的统一投影与断言。
7. 增加产品命名 script aliases，但保留原 scripts。
8. 运行定向测试、完整 typecheck、Vitest、Playwright 和 governed output verification。
9. 审查 diff，确认没有内部 contract 或 workflow 行为变化。

## 验收标准

1. 八个产品 Skill 是唯一产品分析 Skill；不存在历史转发 Skill。
2. 三个核心产品 Skill 包含完整权威协议，不依赖被删除目录。
3. agent 正常规划和交互只使用产品能力名。
4. 历史输入仍可隐式路由，且不会被回显。
5. 内部 CLI、schema、artifact、manifest、hash 与结果兼容。
6. 定向和完整回归全部通过，或明确记录与本改造无关的既有失败。
