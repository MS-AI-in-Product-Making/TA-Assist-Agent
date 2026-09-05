# F6 自由模型解读设计

日期：2026-09-04
状态：已批准

## 背景

当前 `Feature6-Report.md` 的第 4 章由 deterministic renderer 从 F4 计算字段和 F5 图片观察字段拼装固定小节。该实现可复现且可验签，但输出结构仍然沿用上游字段顺序，不能满足“由模型结合图片、完整 Factor 表和计算结果，自由组织工程解读”的目标。

F6 runner 当前保持本地、无网络和确定性执行。直接在 renderer 或 runner 内调用模型会使相同输入产生不同报告，并引入 provider、认证、重试和模型版本治理。因此，自由模型解读必须在 deterministic F6 执行前形成一个独立、不可变、可校验的输入 artifact。

## 目标

1. 第 4 章由模型自由组织工程叙述，不再按 F0-F4 输出字段或固定七段模板拼装。
2. 模型可使用同一 worksheet 的验证图片、完整 Factor 表、F4 受控计算结果和 F5 图片证据。
3. 模型叙述与确定性事实保持明确来源边界，所有数值仍可追溯到 F4。
4. F6 runner 和 renderer 保持本地、无网络、确定性和 hash-bound。
5. 模型解读缺失或校验失败时，F6 继续生成，第 4 章明确显示 `模型解读 unavailable`，不回退到机械模板。
6. 保持第 3.3 节仅显示验证图片和链接。

## 非目标

1. 不在 repository runner 中集成 LLM SDK、provider credential 或网络调用。
2. 不让模型重新计算 Factor、RSS、Cpk、Yield 或 contribution。
3. 不把图片中的 A-H 等标签自动升级为 Drawing Number、DIM ID 或 Factor mapping。
4. 不改变 F4 公式、F5 observation contract、F6 optimization policy 或最终 disposition 规则。
5. 不恢复旧的 Reference Traceability appendix 或 F5 模型图文联合参考解读小节。

## 方案选择

采用独立 `f6-model-interpretation-v1` immutable artifact。

不扩展 `f6-analysis-context-v1`。Analysis Context 表达 caller 提供的功能边界、工况、相关性和 loop definition；将模型叙述混入该 contract 会模糊 caller evidence 与 model inference。

不在 F6 runner 内调用模型。模型生成由 Design Optimization workflow 的 agent phase 负责，runner 只消费已验证 artifact。

## 架构

### 模型生成层

在 Result Interpretation 完成后、Design Optimization deterministic execution 前增加独立阶段。Agent 按 worksheet 隔离读取：

- W3 已验证的物理图片及其 SHA-256。
- F2/F4 中该 worksheet 的完整 Factor 行和 source row identity。
- F4 calculation identity、metrics、specification、contribution 和受控数值。
- F5 interpretation、v2 image FACT、contextual SIGNAL、clarification 和 direct conflict。

Agent 为每个 worksheet 生成一段自由 Markdown。contract 不规定段落数量、标题名称或字段顺序，允许模型根据主要风险和工程意义自行组织重点。

模型必须遵守以下内容边界：

- 引用数字时只能使用 artifact 中已有的 F4 数值，不自行重算。
- 图片可见内容按 FACT 表述。
- 图片与 Factor 表之间未验证的解释按 INFERENCE 或 SIGNAL 表述。
- 缺失输入、冲突或待确认事项按 CLARIFICATION 表述。
- 不把标签、箭头或几何关系提升为未经结构化证据支持的 identity mapping。
- 结论必须保留 preliminary engineering judgment 和 ME review 提示。

### Artifact contract

新增严格 schema `f6ModelInterpretationArtifactSchema`，顶层至少包含：

- `contractVersion: "v1"`
- `inputClassification: "confidential"`
- `interpretationVersion: "f6-model-interpretation-v1"`
- `workbookContentHash`
- `generatedAt`
- `worksheets`

每个 worksheet entry 至少包含：

- `worksheetName`
- `tableId`
- `baselineIdentity`
- `sourceReferences`
- `narrativeMarkdown`
- `calculationClaims`
- `reviewStatus: "ME_REVIEW_REQUIRED"`

`calculationClaims` 为正文中每个工程数值建立结构化引用，至少包含唯一 `claimId`、F4 metric/contribution locator、原始数值、显示格式和单位。模型在 `narrativeMarkdown` 中只能使用 `{{calc:<claimId>}}` 占位符引用工程数值；renderer 根据已验证 claim 生成最终显示文本。模型不得在正文直接写入 RSS、Cpk、Yield、specification、contribution、nominal、tolerance 或 sigma 数值。

`sourceReferences` 必须绑定同一 worksheet，并记录：

- F2 report artifact reference 和 content hash。
- F4 calculation artifact reference、content hash、run ID 和 calculation version。
- F5 report artifact reference、content hash 和 interpretation version。
- 图片 artifact reference、content hash 和 image identity。
- 接受 v2 图片观察时，其 artifact reference、content hash 和 observation version。

Schema 必须拒绝未知字段、重复 worksheet、baseline identity 漂移、跨 worksheet reference、缺失 source hash、空 narrative、重复或未引用的 calculation claim、未知占位符和非 `ME_REVIEW_REQUIRED` 状态。Loader 还必须用 F4 source 验证每个 claim locator、原始数值和单位；任何漂移都拒绝整个 artifact。

### Artifact 写入治理

模型 artifact 写入受控根目录下的系统生成 UUID 目录。生成过程遵守与 F5 image observation 相同的不可变规则：

1. 验证 canonical containment 和 existing ancestor，拒绝 symlink/reparse point。
2. 目标必须不存在，不覆盖、不追加、不修复、不复用历史 artifact。
3. 写入后 read-back，并使用当前 schema 验证完整内容。
4. 重新计算文件 SHA-256，并将路径和 hash 作为 F6 输入 provenance。
5. 任一 worksheet identity 或 source hash 不匹配时，拒绝整个可选 artifact。

### F6 输入与 provenance

F6 CLI 增加可选参数：

```text
--model-interpretation <artifact-path>
```

Artifact loader 将其作为独立 optional input 处理，不与 Analysis Context 合并。run summary、manifest 和 optimization result 增加 `modelInterpretationDecision` 及对应 artifact reference：

- `CALLER_AUTHORIZED`：artifact 已通过 schema、identity、containment、hash 和 scope 校验。
- `REJECTED`：提供了输入但校验失败。
- `NOT_PROVIDED`：没有生成或没有提供输入。

该 artifact 是 agent 在当前受控 workflow 中生成的模型输出，仍需显式记录 input decision，避免历史 artifact 被静默复用。当前阶段不增加单独用户确认；用户对完整 workflow 的启动授权允许生成该可选分析，但不能绕过 read-back validation。

为保持现有 `f6-optimization-v2` artifact 可读，新 decision 在读取 schema 中保持 backward-compatible optional；新 runner 必须始终写出明确 decision。Existing-artifact validator 仅在 summary、manifest 和 optimization provenance 三处同时缺失该字段时接受历史 artifact，并将其解释为 legacy `NOT_PROVIDED`；任何部分缺失或三方不一致都必须拒绝。

### 报告投影

`Feature6-Report.md` 保持 `# 4. TA 总结性分析` 标题。对每个 worksheet：

- 有效 entry：显示 worksheet 标题、统一的模型局限与 ME review 提示，然后原样投影经过安全检查的 `narrativeMarkdown`。
- 无有效 entry：显示 `模型解读 unavailable`，并说明缺失或拒绝状态；不恢复当前 deterministic 七段模板。

Renderer 不解析叙述来计算 disposition，不从 Markdown 提取数字，不改写段落，不调用模型，也不补齐模型未提及的字段。Renderer 仅将已验证的 `{{calc:<claimId>}}` 替换为受控格式化值；这不是重新计算。

第 3.3 节继续只显示同一 worksheet 的验证图片和链接。模型 narrative 不在第 3.3 节重复。

## Markdown 安全边界

自由 Markdown 只允许报告已有的文本表现能力：标题、段落、列表、表格、强调和受控 artifact 相对链接。投影前拒绝或移除：

- HTML、script、iframe 和 event handler。
- `javascript:`、`data:`、外部网络 URL 和绝对文件路径。
- 越界相对路径和未在 source references 中声明的 artifact 链接。

安全检查不得重写工程语义。无法安全投影时，将该 artifact 视为 `REJECTED` 并使用 unavailable fallback。

## 失败处理

模型生成、写入、read-back、schema、identity、hash、scope 或 Markdown 安全检查失败时：

1. 不修改已存在 artifact。
2. 不重试并覆盖同一目标。
3. 不阻止 deterministic F6 optimization 和最终报告生成。
4. 在 input decision ledger 记录 `REJECTED` 或 `NOT_PROVIDED`。
5. 第 4 章显示 `模型解读 unavailable`，不生成替代性模板解读。

F2、F3、F4、F5 或 F6 必需输入失败仍沿用现有 stop behavior；本设计只改变新的可选模型解读输入。

## 测试策略

### Contract

- 接受完整、严格、同 worksheet 且 hash-bound 的 artifact。
- 拒绝未知字段、空 narrative、重复 worksheet 和错误 review status。
- 拒绝 workbook、table、baseline、F2/F4/F5/image identity 或 hash 漂移。
- 拒绝跨 worksheet source reference。
- 拒绝重复、未引用或未知 calculation claim 以及正文中的直接工程数值。
- 拒绝与 F4 locator、原始数值或单位不一致的 calculation claim。

### Loader 与 CLI

- 解析 `--model-interpretation` 并保留其他 optional input 行为。
- 验证 containment、symlink ancestry、schema、scope 和 content hash。
- 将接受、拒绝和缺失结果写入 input decision ledger。
- 确认历史 artifact 不会被隐式发现或复用。

### Runner 与 provenance

- run summary、manifest 和 optimization result 对 model interpretation decision 与 hash 保持一致。
- 五文件 publish 的原子性和现有 output verification 保持不变。
- rejected/not-provided model interpretation 不改变 worksheet disposition。

### Renderer

- 有效 narrative 按模型原有结构投影，不出现固定七段模板标题。
- 仅用已验证 calculation claim 替换正文占位符，并使用既有 engineering formatter。
- 多 worksheet narrative 严格隔离并按 validated report scope 投影。
- 缺失或拒绝时显示 unavailable，且 F6 其余章节完整。
- 拒绝不安全 Markdown、外部链接和越界路径。
- 第 3.3 节仍只有图片和链接。
- 报告保留 hallucination、mapping mismatch、omission 和 ME review warning。

### 回归与真实 artifact

- 运行 contracts、F6 CLI、loader、workflow runner、renderer 和 skill 定向测试。
- 运行 workspace build/typecheck 与现有 F5/F6 相关回归。
- 使用当前真实 workbook artifacts 生成新的模型 interpretation artifact 和 F6 五文件输出。
- 执行 current governed F6 verifier，并人工检查第 4 章叙述质量。

## 影响范围

预计涉及：

- `packages/contracts`：新增 schema、types、input decision/provenance fields。
- `scripts/f6-cli-args.mjs`：新增可选参数。
- `scripts/f6-artifact-loader.mjs`：新增受控输入加载与校验。
- `packages/workbook-catalog`：接收并记录新 artifact decision/reference。
- `packages/workflow-runners`：透传输入并写入 manifest/run summary。
- `scripts/f6-final-report.mjs`：移除 deterministic 第 4 章拼装，投影模型 narrative 或 unavailable。
- `scripts/run-f6-full-validation.mjs`：透传新 CLI 输入。
- `scripts/verify-current-f6.mjs`：验证新增 decision 和 provenance。
- `design-optimization` Skill：增加模型生成阶段、artifact read-back 和失败降级协议。
- 相应 contract、CLI、loader、runner、renderer、skill 和 verifier 测试。

## 验收标准

1. 第 4 章不再按 F0-F4 字段或固定七段模板输出。
2. 有效模型 artifact 可产生自由、连贯、以工程风险为中心的 worksheet 解读。
3. 报告中出现的计算数值均来自受控 F4 source reference。
4. 模型叙述与图片 FACT、工程 INFERENCE、待确认事项保持可审查边界。
5. artifact 与 workbook、worksheet、table、F2、F4、F5 和 image hashes 完整绑定。
6. F6 runner 与 renderer 不进行网络或模型调用，相同输入产生相同输出。
7. 模型 artifact 缺失或失败时，第 4 章显示 unavailable，F6 继续且不回退模板总结。
8. 第 3.3 节仍只显示图片和链接。
9. 定向测试、build/typecheck、F5/F6 回归和 governed F6 verifier 通过。
10. 新真实报告可供用户人工验收第 4 章的叙述质量。