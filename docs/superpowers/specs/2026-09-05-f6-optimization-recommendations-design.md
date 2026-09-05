# Feature 6 优化建议与报告链接设计

## 背景

Issue #97 要求 Design Optimization 根据前序 Data Cleaning、Drawing Governance、TA Calculation 和 Result Interpretation 的受治理数据与结果给出优化建议。用户还可以补充工程背景及优化方向；优化方向优先考虑 nominal 或 mean shift，其次考虑 upper/lower specification，最后考虑 Top contributor tolerance。

另有一项不可降级的产品要求：当最终工程报告已经通过当前 revision 的治理校验时，Agent 最终输出必须在用户当前窗口中展示可点击的 `Feature6-Report.md` 链接。该要求不能依赖模型自行记住、用户再次询问或某个未挂载页面。

## 目标

1. 接收与当前工作簿、worksheet、table 和 baseline calculation 严格绑定的补充工程背景。
2. 接收并单独确认 nominal、mean shift、system specification 和 tolerance 等优化方向。
3. 使用现有 F4 计算内核重新计算每个可执行方案，不允许模型生成或重算受治理数值。
4. 按工程优先级组织建议，同时区分设计改善、需求变更和制造能力改善。
5. 在 Web Workbench 和 VS Code Chat 中强制展示当前、已验证的最终报告链接。
6. 保持现有 `v1` 输入和已发布 F6 artifact 的读取兼容性。

## 非目标

- 不允许模型直接修改源工作簿。
- 不根据自由文本自动推断数值目标。
- 不自动放宽 LSL/USL，并把规格放宽描述为设计改善。
- 不绕过 Analysis Context 和 Optimization Targets 的独立确认门控。
- 不展示 stale、hash 不匹配、revision 不匹配或未验证的报告。
- 不在本 Issue 中改变 F7 实测数据分析流程。

## 方案选择

采用“版本化治理输入 + 确定性方案计算 + 宿主强制报告投影”。

仅修改 Skill 文案无法保证模型每次输出链接；仅挂载现有报告组件无法补齐 nominal、mean 和 specification 目标，也无法覆盖 VS Code Chat。因此，报告链接必须成为 Agent response contract 和 conversation artifact 的确定性部分，优化方向必须成为版本化 schema 的显式输入。

## 受治理输入

### Analysis Context v2

新增 `f6-analysis-context-v2`，保留 v1 的 worksheet 身份、baseline 身份、结构化工程上下文和 evidence locator，并允许每个 worksheet 提供一个受限长度的 `engineeringNarrative`。

`engineeringNarrative` 的规则：

- 只作为工程背景和模型解释上下文，不直接成为数值计算输入。
- 必须绑定当前 workbook content hash、worksheet name、table ID 和 baseline calculation identity。
- 在单独确认前展示完整、经过控制字符清理的预览。
- 记录原始 artifact hash 和 `CALLER_AUTHORIZED`、`DECLINED`、`REJECTED` 或 `NOT_PROVIDED` 决策。
- 不从聊天历史、worksheet prose 或历史 run 静默构造。

现有 `f6-analysis-context-v1` 保持可读。v1 没有 narrative 时按现有行为执行。

### Optimization Targets v2

新增 `f6-optimization-targets-v2`，保留 v1 的目标类型并增加：

- `factor_nominal`：绑定一个 Factor，提供目标 nominal 和单位。
- `system_mean_shift`：绑定当前 system baseline，提供目标 mean 或 resulting additional mean shift；artifact 中只允许一种表达。
- `system_specification`：绑定当前 system baseline，提供 resulting lower spec、upper spec 或二者；合成后的规格必须满足 `lower < upper`。

每个目标必须有唯一 target ID，并通过 workbook、worksheet、table、Factor source row、unit、run reference 和 calculation version 校验。v1 输入继续按原语义读取，不原地扩展 v1 schema。

所有目标在执行前使用单独的 Optimization Targets 预览和确认。自由文本中的“把 nominal 改成 1.2”不能直接触发计算；系统必须先形成受治理 v2 artifact，再由用户确认。

## 优化策略

### 执行顺序

每个 worksheet 的 caller-authorized 方案按以下顺序生成和展示：

1. `factor_nominal` 和 `system_mean_shift`
2. `system_specification`
3. `factor_tolerance`、`factor_sigma`、`improvement_ratio` 和 `system_target`
4. 未被 caller target 取代的内置 Top 3 tolerance policy

该顺序是报告和建议排序，不改变 target ID，也不跨 worksheet 合并输入。

### 计算边界

- `factor_nominal` 通过现有 calculation scenario 的 Factor `nominalValue` override 执行。
- `system_mean_shift` 通过 system `additionalMeanShift` override 执行；如果输入是目标 mean，先使用 baseline identity 确定 resulting shift，再交给 F4 内核计算。
- `system_specification` 通过 system `lowerSpecLimit` 和 `upperSpecLimit` override 执行。
- tolerance 和 sigma 继续使用现有受治理 solver 和 scenario adapter。
- 每个方案都保留 baseline metrics、result metrics、delta、scenario calculation reference 和 source artifact references。
- 任何身份不一致、单位不一致、数值无效或计算失败只阻断对应方案，并以明确 reason code 报告；不得回退为模型估算。

### 工程语义

- Mean centering 是优化建议，但必须标记物理约束需要 ME 复核。
- Specification 改动是 requirement change，不得与制造或设计能力改善混为一谈，也不得自动执行。
- Tolerance tightening 必须保留 supplier capability evidence gate；无证据时维持 `requires_engineering_review` 或 `insufficient_evidence`。
- 没有 caller targets 时，系统可以生成基于当前计算结果的 centering 建议和既有 Top 3 policy；不得自动生成 specification relaxation。
- 模型解释只能说明已有受治理结果，不能产生新的计算值或替代 deterministic option ordering。

## Workbench 数据流

1. F5 完成后，Workbench 进入 Analysis Context 决策。
2. 用户可以提供 v1/v2 artifact，系统完成身份校验、完整预览和独立确认；也可以明确选择不提供。
3. 随后进入 Optimization Targets 决策，执行同样的 artifact 校验、完整预览和独立确认。
4. F6 production runner 只接收已授权 artifact 的路径和 hash。
5. F6 runner 调用现有 F4 calculation kernel 计算各方案，生成五件套 artifact，并以 manifest 最后提交。
6. server 为当前 revision 注册所有 F6 artifact，至少将 `Feature6-Report.md` 标记为 validated `f6_report`。
7. session 进入 `review_required` 后，Agent runtime 从 snapshot 投影最终报告引用和打开动作。

不能继续使用当前 Workbench 自动将两个决策写成 `not_provided` 的行为；无输入必须是用户可见的显式选择，或由可审计的产品默认步骤记录。

## 最终报告链接不变量

定义以下程序级不变量：

> 当 session 存在与当前 `inputRevision` 和 review context 匹配、`validated: true` 的 `f6_report` artifact 时，每一个完成态 Agent assistant turn 都必须包含该报告的 `artifact_reference`、`relatedArtifactIds` 和 canonical `open_report` action。

具体要求：

- Agent runtime 在 deterministic response 阶段附加报告引用；模型响应可以补充文字，但不能删除或替换 canonical 报告引用。
- Conversation store 保存 artifact reference，保证刷新和恢复 session 后链接仍存在。
- Web `ConversationPane` 将 `artifact_reference` 渲染为带认证的 artifact URL，而不是普通 `Evidence:` 文本。
- Workbench 主工程界面在当前 F6 report 可用时固定展示同一个链接。
- VS Code participant 在最终回答中展示可点击的 `Feature6-Report.md` 文件入口；该入口通过受控命令打开当前 session 的受验证 artifact 或 Workbench report surface。
- `open_report` 不再要求用户先表达 `open_report` intent；只要最终报告有效，它就是完成态响应的必选 action。
- stale revision、不同 review context、未验证 artifact 或 hash 校验失败时不生成链接。
- artifact endpoint 使用 Markdown MIME 和安全 attachment filename，并继续执行 session isolation、路径 containment 和 content hash 校验。

## Artifact 集合

F6 仍然原子发布：

1. `Feature6-Optimization.json`
2. `Feature6-Optimization.md`
3. `Feature6-Report.md`
4. `Feature6-Run-Summary.json`
5. `manifest.json`

Production runner 应注册五个当前 revision artifact reference。最终 Agent 输出必须突出 `Feature6-Report.md`；其余四个文件可以在受治理输出 ledger 或报告详情中展示，但不替代最终报告链接。

## 错误处理

- v2 artifact schema、identity、containment 或 hash 失败：记录 `REJECTED`，不执行对应输入。
- 用户拒绝确认：记录 `DECLINED`，继续允许内置无目标策略。
- 单个 target 计算失败：产生 target-scoped failure reason，其他合法 target 继续。
- 最终报告写出或 hash 校验失败：F6 不得进入可展示完成态，也不得产生报告链接。
- artifact 下载时发现 hash 不一致：返回受控错误，不返回文件内容。
- Agent 模型失败或返回不安全 action：使用 deterministic response，仍保留有效报告链接。

## 测试策略

### Contract

- v2 接受正确绑定的 nominal、mean shift 和 specification target。
- 拒绝重复 target ID、错误 Factor、错误 baseline、单位不一致和无效规格区间。
- v1 fixture 继续通过原 schema。

### Optimization

- 每种新增 target 都通过真实 calculation kernel 产生可复算 scenario。
- 断言方案排序为 nominal/mean、specification、tolerance。
- 断言 specification 不会在没有 caller authorization 时自动变化。
- 断言单 target 失败不会污染其他 worksheet 或 option。

### Workbench 与 Agent

- production runner 把已确认的 v2 artifact 传入 F6，并注册五件套。
- 当前 validated report 自动进入 assistant turn 的 content 和 `relatedArtifactIds`。
- 模型响应无法移除 canonical report action/reference。
- stale 或 unvalidated report 不产生链接。
- Web conversation 和主工程界面都渲染可点击报告链接。
- VS Code participant 最终输出包含可点击报告入口。
- artifact endpoint 验证 Markdown MIME、filename、hash mismatch 和 session isolation。

### 端到端验收

运行一个三 worksheet 的受治理 F6 流程，确认：

1. Analysis Context 和 Optimization Targets 使用独立确认。
2. 报告中的建议按既定工程顺序展示。
3. 所有数值可追溯到 F4 scenario calculation。
4. Web Workbench 完成态消息中显示可点击的 `Feature6-Report.md`。
5. VS Code Chat 完成态消息中显示可点击的 `Feature6-Report.md`。
6. 点击两处入口均打开当前 revision 的同一份 hash-verified 报告。

## 兼容与迁移

- 保留 v1 schema、loader 和历史 artifact 验证。
- 新写入使用 v2；不静默把历史 v1 文件重写为 v2。
- F6 optimization output 继续使用当前受治理输出版本，除非新增字段无法以向后兼容方式表达；如需升级输出版本，旧版 existing-artifact validator 保持只读支持。
- CLI 现有参数保持有效，仅扩展其接受的已验证 context/targets artifact 版本。

## 主要修改边界

- `packages/contracts`：v2 输入、conversation artifact/action 契约。
- `packages/workbook-catalog`：新增 target 到 calculation scenario 的确定性转换和排序。
- `packages/workflow-runners` 与 `scripts`：版本化加载、决策记录、五件套输出校验。
- `packages/workbench`：scenario promotion、state projection 和 review projection。
- `apps/workbench-server`：确认输入传递、artifact 注册和安全下载。
- `packages/agent-runtime`：不可被模型移除的最终报告引用与 action。
- `apps/workbench-web`：conversation 与主界面的报告链接。
- `apps/vscode-extension`：Chat 窗口中的受控报告入口。
- `.github/skills/design-optimization`：更新产品流程与最终 output ledger 规则。

## 完成标准

- 新目标类型及优先级通过 contract、optimizer 和 report tests。
- 两个可选输入保持独立、显式、可审计的确认状态。
- F6 所有建议数值均来自 F4-backed scenario。
- 未授权时不会更改 specification。
- Web 和 VS Code 的完成态 Agent 输出均展示当前、已验证、可点击的 `Feature6-Report.md`。
- focused tests、相关 package tests、typecheck、lint、F6 full validation 和真实受治理样例验证全部通过。