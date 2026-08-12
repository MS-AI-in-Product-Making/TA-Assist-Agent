# F5 图文联合图片观察 v2 设计

**日期：** 2026-08-12  
**状态：** 已批准  
**分支：** `feature/f5-contextual-image-observations`

## 背景

当前 `f5-image-observation-v1` 只记录 `imageReference` 与扁平 observation：`scope`、`observedValue`、`confidence`、`visibleBasis` 和 `reviewStatus`。它能够审计“图片中可见什么”，但不能审计 image mode 实际使用了哪些 worksheet 文字，也不要求每个 worksheet 完整检查关键结构项。

实际 Maera gap F5 分析只观察了 `direction`、`tolerance_loop_closure`、`datum_chain` 和 `assembly_datum_face`，`stack_start` 保持 `not_evaluated`。报告也无法证明图片解读是否结合了每行 part/factor 文字。

## 目标

- Image mode 启用时，每个 selected worksheet 必须检查 `tolerance_loop_closure`、`datum_chain`、`assembly_datum_face`、`stack_start` 和 `direction`。
- Image mode 同时使用唯一、hash-verified F1 图片和该 worksheet 的全部 active factor rows。
- 保存实际使用的 part/factor 文字快照和 source provenance。
- 纯视觉观察与图文联合判断分层：视觉内容最多形成 image FACT，联合判断只能形成 `requiresEngineeringReview` SIGNAL。
- v1 历史 artifact 只读兼容；新 image mode 只创建 v2。
- deterministic F5、F3 本地治理、F4 计算和 F6 delegation 保持不变。

## 非目标

- 不从图片自动生成最终工程结论或 F0 RULE。
- 不声明图片箭头与某 factor row 一一对应，除非可见标签和文字来源均能支持。
- 不新增或猜测 workbook 中不存在的 `partDescription` 列。
- 不修改源 workbook，不发布 ADO，不执行 F6。
- 不重新解析 workbook；复用已验证 F1/F3 artifacts。

## 术语映射

当前合同没有独立 `partDescription` 字段。本设计采用：

- `partName`：F2 `actualFields.partName`，在 F3 中为 `partSubsystem`。
- `part description`：F3 `factorDescription` 与 worksheet 级 `dimensionDescription` 的组合。
- `factorDescription`：来自 F1/F2 `factorName`。
- `dimensionDescription`：来自 F1 `toleranceLoopDescription`。

该映射不制造新 workbook 列，并保留 source-cell provenance。

## 版本策略

### v1

- `f5-image-observation-v1` 保持现有 schema 和结果语义。
- Existing F5 artifact fast path 继续验证和展示历史 v1 artifact/report。
- 新 workbook image mode 不得创建 v1。
- v1 不自动迁移、补写或升级为 v2。

### v2

- 新增 `observationVersion: "f5-image-observation-v2"`。
- Worksheet set 必须与 selected set 完全相等。
- 每个 worksheet 必须包含五个核心 scope，且每项恰好一次。
- 每个 worksheet 保存经过验证的文字上下文快照。
- 沿用 immutable、UUID-scoped、不可覆盖、containment、reparse-point、readback 和 SHA-256 gates。

## v2 Artifact 合同

Root 包含 `contractVersion`、`inputClassification: confidential`、`observationVersion`、`workbookContentHash` 和唯一 worksheets。

每个 worksheet 包含：

- `worksheetName`
- F1 `imageReference`
- `contextSnapshot`
- 五项 `observations`

### Context Snapshot

Snapshot 包含 worksheet 的 `dimensionDescription` 和按 `sourceRow` 升序排列的全部 active rows。每行包含：

- `tableId`、`sourceRow`
- `partName/partSubsystem`
- `partCategory`
- `factorName/factorDescription`
- `nominal`、`upperTolerance`、`lowerTolerance`、`sigmaLevel`
- `sourceCells`

约束：

- `dimensionDescription` 必须等于 F3 受控 worksheet description。
- `{tableId, sourceRow}` 在 worksheet 内唯一。
- Snapshot row set 必须与 F3 governance row set 完全一致，不允许子集或额外行。
- 文本、数值和 `sourceCells` 必须逐字段匹配 F3 rows。
- 缺失原始值保留 `null`，不得补写推断值。

### Core Observation

每项 observation 包含 `scope`、`visualObservation` 和 `contextualSignal`。五项固定 scope 为：

- `tolerance_loop_closure`
- `datum_chain`
- `assembly_datum_face`
- `stack_start`
- `direction`

#### visualObservation

包含：

- `observedValue: visible | not_visible | ambiguous`
- `confidence: high | medium | low`
- `visibleBasis`
- `reviewStatus: unreviewed | confirmed | rejected`
- 条件式 `confirmedBy/confirmedAt`

`visibleBasis` 只能描述图片中的标签、箭头、符号、线段、接触面和几何可见关系，不得用 worksheet 文字证明图上事实。

沿用 evidence gates：

- `high + unreviewed/confirmed` 可产生 image FACT，但仍要求 engineering review。
- `medium` 不产生 FACT，最多产生 SIGNAL。
- `low` 只产生 clarification。
- `rejected` 排除出结论并产生 clarification。
- `confirmed` 不产生 RULE，也不解除 ME review。

#### contextualSignal

包含：

- `signalValue: indicated_consistent | indicated_conflict | ambiguous | insufficient_evidence`
- `textBasis`
- `linkedSourceRows[]`
- `requiresEngineeringReview: true`

约束：

- `textBasis` 描述图片观察与 snapshot 文字共同提示的检查事项，不是最终结论。
- `linkedSourceRows` 只引用当前 snapshot 的 `{tableId, sourceRow}`。
- 无法可靠映射图片元素到 row 时，引用必须为空，且状态只能是 `ambiguous` 或 `insufficient_evidence`。
- Context signal 永远不能生成 FACT 或 RULE。
- `indicated_consistent` 仍要求 ME review，不能表述为“已确认一致”。

## 五项解读定义

### tolerance_loop_closure

- 视觉：是否存在连续闭环、明确 target 和返回起点的路径。
- 联合：active rows 的 part/factor 顺序是否提示缺项、重复或闭合风险。

### datum_chain

- 视觉：是否可见 datum 标识、接触关系或连续基准传递。
- 联合：图片 part 顺序与 context rows 是否提示同一基准链或潜在跨基准风险。

### assembly_datum_face

- 视觉：是否有明确装配基准面或可识别基准接触面。
- 联合：part/factor 与 dimension description 是否足以识别该面；不足时为 `insufficient_evidence`。

### stack_start

- 视觉：是否可见起始面、起点标记或明确首段尺寸。
- 联合：首个 active row 是否有可审计图片对应证据；不得凭行顺序推断起点。

### direction

- 视觉：箭头、正负号、坐标或尺寸方向是否可见。
- 联合：nominal、上下公差、factor description 与图片方向是否提示一致、冲突或证据不足。

## 运行数据流

1. W0-W5 保持现有 F0/F1/F2/F3/F4 顺序和双 worksheet gate。
2. 用户启用 image mode 后，读取本次 selected worksheets 的 verified F3 report。
3. 构造 deterministic context snapshot，校验 F1/F3/F4 workbook、worksheet、table、source-row 和 image identities。
4. Image mode 对每个 worksheet 同时接收 hash-verified F1 图片、完整 snapshot、五个固定问题和禁止猜测 row 映射的指令。
5. 五项逐一返回 visual observation 与 contextual signal；缺证据也必须返回 `ambiguous` 或 `insufficient_evidence`。
6. 在新 UUID 目录中单次创建 v2 artifact。
7. Readback 验证 schema、selected set、五项完整性、图片 hash、snapshot rows 和 provenance。
8. 验证成功才传给 F5；失败时丢弃整个 v2，不修补、不部分消费。
9. F5 loader 接受 v1/v2 union；v2 生成 visual FACT 和 `image_text_context_review` SIGNAL。

## 失败与回退

- 用户跳过 image mode：继续 deterministic F5，图片 scope 为 `not_evaluated + clarification`。
- Image mode 启用但 v2 无法创建或验证：继续 deterministic F5，并说明图片存在但增强 artifact 未通过验证。
- 任一 selected worksheet 缺 record、缺核心 scope、图片 mismatch 或 snapshot mismatch：整个 v2 不消费。
- Part/factor/provenance 缺失：保持 `null`，context signal 使用 `ambiguous` 或 `insufficient_evidence`。
- 不允许从 v2 自动确认 assumption、生成 RULE、产生最终工程判断或触发 F6。

## F5 报告

“公差链有效性”增加：

1. 五项状态矩阵：scope、visual status、context signal 和 ME review。
2. Visual FACT 表：observed value、confidence、review status、image 和 visible basis。
3. Worksheet context SIGNAL 表：signal value、text basis、关联 part/factor/source rows，并标注“图文联合提示，非工程结论”。
4. 分析上下文表：实际提供给 image mode 的 part name、factor description、dimension description 和 source cells。

其余三个 structural scopes 继续按已有 observation/clarification 规则处理；F6 sections 保持 `delegated_to_f6`。

## 修改边界

预计修改：

- `packages/contracts/src/contracts.ts` 与测试：v1/v2 union、snapshot 和 core scopes。
- `scripts/f5-artifact-loader.mjs` 与测试：v2 identity/context validation、v1 compatibility。
- `packages/workbook-catalog/src/f5-data-interpretation.ts` 与测试：visual FACT、context SIGNAL 分层。
- `scripts/f5-report.mjs` 与测试：证据与上下文呈现。
- `.github/skills/f5-analysis/SKILL.md` 与测试：v2 protocol、全部 active rows、五项完整性。
- `scripts/f5-full-flow.test.mjs`：v1/v2/no-image end-to-end。
- 相关中英文流程文档与 README 索引。

不修改 F0、F1 parser、F2 清洗规则、F3 ADO protocol、F4 kernel 或 F6。

## 测试策略

1. Contract RED：缺 scope、重复 scope、无 provenance、错误 confirmation metadata 时 v2 拒绝；合法 v2 与历史 v1 通过。
2. Loader RED：selected set、图片、snapshot rows、文字/数值/sourceCells 任一 mismatch 时拒绝，禁止部分消费。
3. Interpretation RED：视觉 high 生成 FACT；context 只生成 `requiresEngineeringReview` SIGNAL，永不生成 RULE。
4. Report RED：visual FACT、context SIGNAL、snapshot、clarification 分层显示。
5. Skill RED：全部 active rows、五项逐项回答、只创建 v2、immutable UUID/readback gates。
6. Full-flow：v1 existing artifact、v2 workbook flow、无 observation deterministic F5 均通过。
7. Build、related regression 和 complete test suite 通过。

## 验收场景

重新分析当前 Maera gap workbook 的四个 ready worksheets：

- 每个 worksheet 的五个核心 scope 均有记录，`stack_start` 不再因漏观察而 `not_evaluated`。
- 报告展示 image mode 实际使用的全部 active part/factor rows 与 provenance。
- Visual FACT 不引用 worksheet 文字作为视觉证明。
- 图文联合判断只显示为 `image_text_context_review` SIGNAL 并要求 ME review。
- 无法映射图片元素到 row 时保持 `ambiguous/insufficient_evidence`。
- v1 历史 F5 artifact 仍可验证和展示。
- capability、contributors、F3 governance 与 F4 calculation 结果不变。