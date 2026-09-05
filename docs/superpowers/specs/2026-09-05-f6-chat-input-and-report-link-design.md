# F6 聊天输入、模型证据连续性与最终报告链接设计

## 背景

当前 Design Optimization 工作流存在三个相互关联的问题：

1. 已通过 schema、baseline 和 calculation claim 校验的模型解读，在 F6 运行时仍可能因图片观察来源未进入 F6 evidence ledger 而被软拒绝。
2. Analysis Context 和 Optimization Targets 要求用户提供 JSON 文件路径，但目标用户只会在聊天窗口提供自然语言补充。
3. 最终报告虽然已经注册为受验证 artifact，但不同执行入口仍可能只显示目录或文本路径；Agent 最终答复没有统一的强制可点击链接契约。

本设计只修改 F6 输入、证据传递和报告交付边界，不修改 F1-F5/F7 的业务行为，不改变 F4 数学定义，也不调整 monorepo 结构。

## 根因分析

### 模型解读被拒绝

本次运行中的模型解读 artifact 绑定了已由 Result Interpretation 发布的 `Feature5-Image-Observations.json`，其 hash 与 F5 run summary 一致。

F6 loader 只在自身 optional evidence 输入中设置 `sourceReferences.imageObservation`。本次 F6 invocation 没有把 F5 root 中已发布的 observation copy 纳入该 evidence ledger，因此 loader 计算出的 expected observation reference 为 `undefined`。模型解读中的非空 `sourceReferences.imageObservation` 与 `undefined` 做严格比较后触发 `identity_mismatch`。

模型叙述、worksheet 顺序、baseline identity、F2/F4/F5 hashes 和 calculation claims 均不是此次失败原因。

### 自然语言输入缺失 materialization 层

当前聊天模型可以读取受治理证据并返回文本，但不能把用户自然语言转成 identity-bound 的 Context/Targets draft。现有确认命令只接受 decision 和 artifact reference；F6 loader 只接受受治理 JSON。因此 UI 被迫要求用户自己准备 JSON。

### 报告链接依赖入口

Workbench 与 VS Code participant 已能从 current validated review context 生成受控报告入口，但直接 Design Optimization skill/CLI 的最终呈现仍主要依赖 Agent 自觉输出路径。必须把链接提升为所有成功入口的完成条件。

## 目标

1. F6 自动继承当前 F5 已发布且 hash-validated 的 v2 图片观察 copy，使模型解读与 F6 使用完全一致的 evidence ledger。
2. 用户只在聊天窗口输入自然语言，不需要创建、理解或提供 JSON 文件。
3. 自然语言先成为 proposal，再由受控 materializer 绑定当前 workbook、worksheet、Factor、unit 和 baseline identity，生成不可变 draft artifact。
4. Analysis Context 与 Optimization Targets 保持两个独立预览和确认门控。
5. 模型不得生成受治理计算值、baseline identity、artifact path、hash 或执行命令。
6. 最终成功答复必须包含一个可点击的 `Design Optimization Report` 链接，点击后直接打开当前 validated report。

## 非目标

- 不让自由文本直接进入 F6 calculation request。
- 不从模糊文字猜测 Factor、单位、规格或数值。
- 不自动放宽 LSL/USL。
- 不允许模型直接提交确认命令或生成 caller-authorized 决策。
- 不修改源工作簿。
- 不重新设计 Workbench 页面或项目目录结构。

## 总体架构

采用共享的 F6 输入 proposal/materialization 层：

```text
用户自然语言
  -> 模型结构化 proposal（无身份、无 hash、无计算结果）
  -> Server/本地 materializer 读取当前 validated lineage
  -> identity-bound immutable draft artifact
  -> 完整预览
  -> 独立用户确认
  -> confirmed artifact reference + expected hash
  -> F6 loader 与 deterministic optimizer
```

Workbench 和直接 Agent 工作流共享同一套 proposal contract 与 materializer。Workbench 通过 server API 调用；直接 Agent 通过仓库受控 runner 调用。用户在两个入口都只看到自然语言问题、澄清、预览和确认，不看到 JSON 路径。

## F5 到 F6 的证据连续性

### 发现规则

F6 loader 从当前传入的 F5 root 读取 run summary 和 manifest：

- 如果 F5 没有发布 image observations，F6 保持 `not_evaluated`，模型解读不得声明 observation reference。
- 如果 F5 manifest 声明 `Feature5-Image-Observations.json`，F6 必须在同一 F5 root 中安全打开该文件，验证 containment、无链接祖先、schema、workbook hash、worksheet scope、image references 和 run-summary hash。
- 通过后，F6 将该 copy 加入 `sourceReferences.imageObservation`，并要求模型解读中的 observation reference 完全相同。
- 文件缺失、hash 漂移或 identity 不一致时，F6 输入失败；不能把已声明的 evidence 静默降级为不存在。

### 兼容性

- 历史 F5 没有 observation artifact 时保持兼容。
- 现有显式 evidence 输入如仍被测试或内部调用使用，必须与 F5 copy 完全一致；不允许两个不同 observation 来源同时进入。
- 模型解读仍是可选 soft-rejected input；但 rejection reason 必须细化到 observation missing/hash/identity，而不是只返回笼统 `identity_mismatch`。

## Analysis Context 自然语言流程

### 用户体验

问题改为：

> 是否需要补充分析背景？你可以直接描述产品功能、装配关系、使用工况、功能边界、通过标准或其他工程关注点；也可以选择不补充。

不再提及 JSON 或文件路径。

### Proposal contract

模型只能输出：

- 用户原始文本的受控引用。
- worksheet name 或“适用于全部当前 worksheet”的选择。
- 建议的 analysis object 类别。
- 功能要求、工况、功能边界和需要澄清的内容。
- correlation/loop 信息只有在用户明确描述时才能提出。

模型不得输出 workbook hash、table ID、source row、artifact reference 或计算值。

### Materialization

Materializer：

1. 读取当前唯一 validated F2/F4/F5 lineage。
2. 将 worksheet 名称解析为当前 scope 中的唯一 worksheet。
3. 使用当前 F4 baseline 填充 baseline identity。
4. 对用户未提供的结构化字段使用 `NOT_PROVIDED`/空集合，而不是推断。
5. 将用户原文保存在 v2 `engineeringNarrative` 中。
6. 生成新的不可变 artifact、SHA-256、draft ID 和完整预览。

如果 worksheet 不唯一、scope 不匹配或输入含无法安全结构化的断言，则返回 clarification，不生成 draft。

### 确认

用户查看完整预览后单独选择“确认分析背景”。只有确认后的 draft 才能成为 `CALLER_AUTHORIZED`。用户拒绝时记录 `DECLINED`；选择不补充时记录 `NOT_PROVIDED`。

## Optimization Targets 自然语言流程

### 用户体验

问题改为：

> 是否需要补充优化方向？你可以直接描述希望优先评估 nominal、mean shift、specification 或 tolerance；如有明确目标值，请同时说明 worksheet、Factor 和单位。也可以让系统依据当前证据判断。

不再提及 JSON 或文件路径。

### Proposal contract

模型可以提取：

- adjustment class。
- 用户明确说出的 worksheet/Factor 名称。
- 用户明确说出的目标数值和单位。
- 用户明确说出的优先级或约束。
- 需要进一步澄清的歧义。

模型不得补写用户没有提供的数值，不得自行选择 source row/table ID，不得计算 Cpk、delta、target mean 或 tolerance ratio。

### Materialization

- 用户只描述优化方向而没有数值：记录为 qualitative direction，供模型 assessment 排序；不创建 caller-target quantified scenario。确定性 centering 和内置 tolerance policy 仍可按规则运行。
- 用户明确给出数值：materializer 必须唯一解析 worksheet、Factor 和 unit，并使用当前 F4 baseline 补全 v2 target identity。
- Factor 名称不唯一、单位缺失、规格上下限含义不明确或数值非法：返回 clarification，不猜测。
- specification target 必须明确给出 LSL、USL 或二者之一，并在预览中标记为 Requirement Change。

### 确认

Targets 使用独立于 Context 的完整预览与“确认优化方向”门控。确认前不得执行 caller-target scenario。拒绝和未提供继续沿用现有四态 decision ledger。

## 共享 materializer

新增纯函数/服务边界，职责限定为：

- 输入：proposal、current review context、current F2/F4/F5 artifacts。
- 输出：immutable draft 或 structured clarifications。
- 不执行 F6、不调用模型、不写 session command。
- 所有 identity、unit、worksheet 和 Factor 解析均为 exact/unique matching。
- artifact 写入由 managed artifact writer 完成，使用新 UUID 目录、原子写入和 read-back schema validation。

Workbench server 保存 draft ID、input revision、review context ID、artifact path 和 hash。确认命令引用 server-issued draft ID/hash，而不是接受客户端提供任意路径。

直接 Agent runner 接受一个受控 proposal 文件或 stdin payload，在 managed output root 中调用同一 materializer，并返回预览。用户不接触该内部 payload。

## 最终报告链接不变量

定义以下完成条件：

> 只要 F6 成功且当前 review context 中存在唯一、current revision、validated、hash-matched 的最终报告，Agent 最终答复必须包含一个名为 `Design Optimization Report` 的可点击链接。

### Workbench

- Web 主界面和 conversation artifact reference 都指向受鉴权 artifact endpoint。
- 点击链接直接打开或下载当前 `Feature6-Report.md`。
- 不允许用 optimization Markdown、run summary 或 manifest 代替最终报告。

### VS Code

- Participant 必须把 canonical `open_report` action 渲染为 `Design Optimization Report` 按钮。
- 命令只允许打开当前 loopback Workbench 的 report route，不接受任意 URL/path。

### 直接 Agent/Skill

- Design Optimization W10 最终答复必须包含 workspace-relative Markdown link。
- link target 必须来自刚通过 existing-artifact validator 的 `finalReportMarkdownPath`。
- CLI 输出增加最终报告的绝对路径，供 Agent 确定性转换为 workspace link；不得只输出 run directory。

### 失败行为

- report hash、manifest、current revision 或 review context 不满足时，不显示链接，也不声称完成。
- 模型不能删除或替换 canonical report action/reference。
- 最终答复缺少链接视为 workflow contract failure，并由测试阻断。

## 状态与错误处理

- `proposal_ambiguous`：需要用户澄清，不生成 draft。
- `draft_identity_mismatch`：当前 lineage 已变化，draft 作废并重新 materialize。
- `draft_hash_mismatch`：停止，不允许确认。
- `observation_evidence_missing`：F5 声明 observation 但文件不存在。
- `observation_hash_mismatch`：F5 summary 与物理 observation bytes 不一致。
- `model_interpretation_evidence_mismatch`：模型解读与已加载 evidence ledger 不同。

错误对用户使用产品语言说明；reason code 只保留在 artifact/session ledger。

## 主要修改边界

- `.github/skills/design-optimization/SKILL.md`：自然语言问题、内部 materialization、预览确认和最终链接要求。
- `packages/contracts`：proposal/draft/materialization contracts，以及必要的 session draft reference。
- `packages/workflow-runners` / `scripts`：共享 materializer、本地入口、F5 observation 自动继承、CLI 最终报告路径。
- `apps/workbench-server`：proposal materialization API、managed draft persistence、confirmation binding。
- `packages/workbench`：pending draft identity 和两个独立 gate 的最小状态扩展。
- `apps/workbench-web`：聊天输入、clarification、预览和两个独立确认 surface。
- `packages/agent-runtime` / `apps/vscode-extension`：自然语言 gate actions 与最终 canonical report link。

不修改 F4 calculation kernel，不改 F1-F5/F7 的业务顺序，不移动现有目录。

## 测试策略

### 模型证据连续性

- F5 发布 observation copy 时，F6 自动加载并接受绑定相同 reference 的模型解读。
- observation 缺失、hash 漂移、worksheet/image identity 漂移分别产生精确失败。
- F5 未发布 observation 时，历史路径继续通过。

### 自然语言 Context

- 自然语言生成 v2 draft，自动绑定 current workbook/worksheet/baseline。
- 模糊 worksheet、过期 revision、伪造 identity 和客户端路径均拒绝。
- 预览前不可确认；确认后 hash 必须保持一致。

### 自然语言 Targets

- qualitative direction 不生成 caller numeric target。
- 明确 worksheet、Factor、值、unit 可以 materialize。
- 名称不唯一、unit 缺失、spec 含义不清时返回 clarification。
- specification 未确认时不得产生 scenario。

### 报告链接

- CLI 成功输出 final report path。
- Skill contract 要求最终答复包含 workspace-relative link。
- Web 与 VS Code 指向同一 artifact ID/hash。
- stale/unvalidated/mismatched report 不显示。
- E2E 点击入口到达当前最终报告。

## 完成标准

- 用户在整个流程中不需要准备或提供 JSON。
- 模型解读在 evidence ledger 一致时被接受并进入最终报告。
- Context/Targets 均来自自然语言 proposal、server-bound draft、完整预览和独立确认。
- 模型不能生成受治理计算值或越过确认门控。
- 成功的 Agent 最终答复始终包含可点击的 `Design Optimization Report`。
- focused tests、全仓 build/test、跨层 E2E 和真实受治理工作簿回归全部通过。