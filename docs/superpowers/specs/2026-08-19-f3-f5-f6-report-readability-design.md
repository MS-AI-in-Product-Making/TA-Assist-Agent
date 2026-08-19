# F3/F5/F6 工程报告可读性优化设计

## 1. 目标

在不改变现有 F0-F6 workflow 命令顺序、输入治理、计算语义、artifact identity、hash 门禁和历史报告结果的前提下，把 F3、F5、F6 Markdown/ADO 输出改造成工程师可以直接审查的报告。

本设计覆盖：

- F6 数值、规格、Margin、Cpk、公式与计算过程的解释；
- F6 对 F3 缺失字段和 F5 图片证据的组合展示；
- F6 target-driven 多场景优化结果展示；
- F3 ADO 内容按 Worksheet 和 Part / Subsystem 分类；
- F5 工程摘要与审计附录分层；
- F0 当前能力边界及后续材料、结构、制程和装配风险知识扩展接口。

## 2. 不可破坏的兼容约束

以下行为必须保持不变：

1. `workflow:f2:excel` selection-only 与 confirm 两阶段门禁及参数顺序。
2. F3、F5、F6 精确 worksheet scope 和 source identity 校验。
3. F4 的 mean、RSS、worst-case、Cp、Cpk、yield 和 DPM 计算结果。
4. F5 的 `FACT`、`RULE`、`SIGNAL`、`OPTION`、clarification、assumption 分类语义。
5. F6 的 `f6-optimization-v2` 和 `f6-composed-report-v2` 现有必填字段及四态判定。
6. 没有 caller-authorized optimization targets 时只能生成 `candidate`，不得生成默认百分比场景。
7. 图片证据不得自动推断 Drawing Number、DIM ID、datum identity 或 label-to-source-row mapping。
8. ADO 仍只允许经过完整 preview、独立 `Confirm write`、单次写入和单次回读验证。
9. 现有 JSON artifacts 保留完整审计数据；Markdown 优化不得删除 JSON trace/provenance。
10. 既有测试与真实 workbook flow 必须保持通过；历史 demo-output 不做原地改写。

允许的兼容扩展：

- 在 V2 schema 内新增 optional/derived display 字段；
- 在 Markdown renderer 中新增解释、分组和附录；
- 在不改变既有字段值的前提下增加 provenance label 和计算代入过程；
- 新增专门的 engineering-summary projection，原始审计结构继续保留。

## 3. F6 报告设计

### 3.1 Workbook 摘要

Workbook 摘要增加：

- ready、blocked、FAIL、CONDITIONAL_PASS、PASS 数量；
- blocked worksheet 的具体缺失列，而不是统一的 F2 blocked 文案；
- Analysis Context、Optimization Targets、F3 ADO、F5 image mode 的输入状态；
- 需要工程师处理的 Top actions，按 P0/P1/P2 去重。

### 3.2 分析特性与结构化工程定义

当前“分析对象”拆成：

- **分析特性**：始终显示 F2/F3 的 `toleranceLoopDescription`；
- **结构化工程定义**：显示 `f6-analysis-context-v1.analysisObject`；缺失时显示“未提供，需确认物理含义和方向”。

不得把 worksheet 名称或描述自动升级为受治理 analysis object。

### 3.3 统计范围、Spec、Cpk 与来源

执行摘要必须明确统计范围使用的 sigma level：

```text
Target 4σ statistical range = Mean ± 4 × RSS 1σ
= 1.170 ± 4 × 0.080195
= 0.849 ～ 1.491 mm
```

Spec 区域显示：

- LSL、USL、Target σ、Target Cpk；
- worksheet source cell 或 calculation input provenance；
- Predictive Cpk 的性质，明确不是量产实测能力。

Cpk 过程显示：

```text
CpkL = (Mean - LSL) / (3 × RSS 1σ)
CpkU = (USL - Mean) / (3 × RSS 1σ)
Cpk  = min(CpkL, CpkU)
```

同时显示数值代入、未舍入结果和工程显示值。

### 3.4 Margin 解释

执行摘要不得再显示无类型的 `Minimum Margin`，改为：

- Target σ minimum margin；
- Worst-case minimum margin；
- 正数表示 remaining margin，负数表示超出 spec 的距离。

规格章节使用表格：

| Assessment | Evaluated Range | Lower Margin | Upper Margin | Minimum | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Target Nσ | ... | ... | ... | ... | PASS/FAIL |
| Worst Case | ... | ... | ... | ... | PASS/FAIL |

公式：

```text
Lower margin = Evaluated lower bound - LSL
Upper margin = USL - Evaluated upper bound
Minimum margin = min(Lower margin, Upper margin)
```

### 3.5 输入数据与 F3 治理完整性

输入完整性增加按 Part / Subsystem 分组的列级检查：

| Part / Subsystem | Factor | Drawing Number | DIM ID | Nominal | +Tol | -Tol | Distribution | Image | Status |

必须区分：

- 阻断计算的 F2 required field；
- 不阻断计算但阻断治理闭环的 F3 Drawing Number / DIM ID；
- 缺少 Analysis Context、loop definition、measured capability；
- 完整可用的 F4 numeric inputs。

### 3.6 公差链图文解读

公差链章节加入：

1. 当前 F1 tolerance-path 图片；
2. tolerance loop description；
3. 所有 factor descriptions，按 source row 排列；
4. F5 visual FACT 摘要：可见箭头、标签、方向和置信度；
5. F5 contextual SIGNAL 摘要及 ME review 标识；
6. loop start/end、signed equation，仅在 caller-authorized Analysis Context 存在时显示。

模型可生成“整体视觉描述”，但必须标记为 `SIGNAL`。没有可靠 mapping 时明确写：

> 图片显示尺寸链方向和标签，但尚未建立视觉标签到 factor/source row 的受治理映射，因此不能生成 signed equation。

### 3.7 计算一致性与计算过程

“Loop 一致性与计算自检”改名为：

> F4 基线复算与数值一致性检查

每个检查显示：

- 计算对象；
- F6 recomputed value；
- F4 reported value；
- absolute difference；
- numerical threshold；
- threshold 来源；
- PASS/FAIL。

`1e-12` 必须使用科学计数法，禁止格式化成 `0.000 mm`。

Worst Case 拆成 upper/lower 两个检查，不再把两侧最大误差伪装成 calculated value。

统计分析章节增加工程可读的计算过程：

- factor mean 的求和；
- factor sigma 的 RSS 项；
- worst-case upper/lower tolerance sum；
- statistical bounds；
- Cp/Cpk；
- yield/DPM 仅显示公式标识、关键输入和结果，复杂分布函数细节放审计附录。

正文使用 compact substitution，完整 source cells 和 trace records 保留在 JSON/附录。

### 3.8 优化与收益

没有 targets 时显示：

- candidate factors；
- required target inputs；
- 不量化原因；
- 如何创建 target artifact。

有 caller-authorized targets 时，一个 target 对应一个 scenario。支持至少三组并列展示：

| Scenario | Factor | Baseline Nominal/+Tol/-Tol | Adjusted Nominal/+Tol/-Tol | RSS | Cpk | Margin | Yield | Delta |

Composed report 必须投影 target ID、type、value、selected factors、apportionment policy 和 evidence reference，不得固定输出空 `targets`。

### 3.9 风险、工程建议与设计意图

本轮只使用现有受控证据：

- F4 capability/spec；
- F3 governance；
- F5 visual FACT/context SIGNAL；
- F0 internal tolerance guidance；
- Analysis Context 中 caller-authorized 工况与证据。

输出统一结构：

| Finding | Engineering interpretation | Recommended action | Source type | Source reference | Confidence | Review |

模型解释必须标记为 `SIGNAL`，F0 匹配规则标记为 `RULE`，计算结果标记为 `CALCULATED`。没有材料/结构/装配规则时保持 `INSUFFICIENT_EVIDENCE`，不生成确定性风险。

### 3.10 数据缺口作为执行计划

数据缺口按相同 action/owner/source 合并，输出：

| Priority | Action | Scope | Owner | Required evidence | Blocks decision | Verification |

例如 9 条 Drawing Number 缺失合并为一个 action，并列出 9 个 source rows。

## 4. F3 ADO 报告设计

ADO Markdown 和 System.History HTML 采用：

```text
Workbook summary
  Worksheet
    Part / Subsystem
      固定 11 列治理表
```

要求：

- 每个 Worksheet 和 Part / Subsystem 有计数；
- 空 subsystem 使用明确的 `(missing Part / Subsystem)`；
- 组内保持原 source-row 稳定顺序；
- 总 row count、11 headers、完整 body/hash 回读验证不变；
- 不拆成多次 ADO 写入。

## 5. F5 报告设计

F5 Markdown 分为两层。

### 5.1 工程摘要正文

- Workbook decision table；
- 每个 worksheet compact card；
- tolerance path 图片；
- Cpk/spec；
- Top contributors；
- 图片可见 FACT；
- 需要 ME review 的 SIGNAL；
- 关键治理缺口；
- 明确标识 F5 owned 和 delegated to F6。

### 5.2 审计附录

- 五项 observation matrix；
- 完整 context snapshot；
- FACT/RULE/SIGNAL/OPTION；
- clarification 与 assumption；
- sourceCells、trace、provenance 和 hashes。

正文不重复完整 snapshot 和长 sourceCells。JSON artifact 不删减任何字段。

## 6. F0 能力边界与扩展

当前 `internal-v1` 只支持六类制程的推荐总公差带和条件化 capability guidance。本轮仅把已匹配 guidance 作为 F6 process RULE 展示。

本轮不新增未经评审的风险数据。预留后续版本化知识接口：

- `material-risk-v1`；
- `structure-risk-v1`；
- `process-risk-v1`；
- `assembly-risk-v1`。

每条规则未来必须包含 applicability、required inputs、severity policy、evidence/provenance、confidence 和 verification method。

## 7. 实施顺序

1. F6 projection 与 renderer：数值解释、公式、Margin、Spec 来源、自检。
2. F6 completeness 与图文 loop overview。
3. F6 target projection、多场景和 action plan。
4. F3 ADO Worksheet / Part / Subsystem 分组。
5. F5 工程摘要与审计附录。
6. F0 process guidance 投影和未来 risk 接口边界。

每一步先写失败测试，再做最小实现；每个任务独立 commit。

## 8. 验收标准

1. 现有 `npm test` 全量通过，测试数量不减少。
2. F4 baseline 数值与改造前逐字段一致。
3. F6 V2 JSON 通过现有 schema，并通过新增 optional 字段测试。
4. 没有 targets 时仍只有 candidate；有三个 targets 时显示三组重算场景。
5. F3 ADO 仍为一次写入、一次回读，11 headers 和 row count 不变。
6. F5 JSON 与现有证据分类不变，Markdown 正文显著缩短且保留审计附录。
7. 真实 workbook regression 验证 Keycap、HDMI、AJ 示例中的公式、Spec 来源、Margin 和图片链接。
8. 不修改任何历史 demo-output；新运行只生成新的 immutable artifacts。