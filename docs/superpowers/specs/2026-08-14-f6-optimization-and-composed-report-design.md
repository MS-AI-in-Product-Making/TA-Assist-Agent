# F6 优化与 F5+F6 联合工程报告设计

**日期：** 2026-08-14  
**状态：** 已批准  
**依赖：** F2 validated report、F3 governance、F4 calculation、F5 governed interpretation、F5 image observation v2（可选）

## 背景

当前 F5 是可运行的受治理解释流程，负责公差链证据、能力与规格对比和主要贡献者。F5 的合理公差范围与设计优化章节固定为 `delegated_to_f6`。

当前 F6 不是部分实现，而是严格的 `feature_not_available` placeholder：没有优化 request/result、solver、artifact loader、workflow、CLI 或 report。F4 已提供确定性 calculation kernel 和通用 scenario overrides，可作为 F6 数值重算底座，但不能替代 F6 的方案生成、反求、可制造性、datum strategy 或 ROI 治理。

本设计实现真正的 F6 optimization workflow，并新增面向 DM、DFSS 和 TA 决策的 F5+F6 composed engineering report。现有详细 `Feature5-Report.json/.md` 保持兼容。

## 目标

- 基于同一 workbook、worksheet set 和 F4 baseline 生成确定性优化 options。
- 支持 top contributor、top 3、mean-shift、target-Cpk reverse solve 和 RSS apportionment。
- 供应商能力、datum strategy 和成本证据缺失时明确输出 `insufficient_evidence`，不做近似预测。
- 生成专业、简洁、量化、面向决策的联合报告。
- 区分 Facts、Findings、Risks、Recommendations，并保留机器可审计 provenance。
- Workbook 总览覆盖 F2 blocked worksheets；能力与优化只处理 ready + downstream-selected worksheets。
- 多 worksheet 采用 workbook 总览加每页完整子报告，不跨 CTQ 混算 Cpk。

## 非目标

- 不把 F4 generic scenario 自动称为 F6 recommendation。
- 不从 F5 图片 SIGNAL 推断 datum strategy 已成立。
- 不用 F0 通用 capability guidance 代替 supplier-specific capability。
- 不在无成本证据时计算 ROI。
- 不修改源 workbook，不发布 ADO，不执行 3D variation analysis。
- 不删除或重解释 legacy F6 placeholder contracts。

## Feature Ownership

### F5

负责：

- Baseline calculation FACTs 的受治理解释。
- F0 interpretation RULEs。
- F3 identifier/governance SIGNALs。
- F5 v2 visual FACT 与 contextual SIGNAL。
- Clarifications 和 proposed assumptions。

F5 不负责：

- 优化方案数值生成。
- Reverse solve。
- RSS tolerance apportionment。
- 方案可行性或 impact ranking。

### F6

负责：

- 冻结并验证 F4 baseline。
- 生成受控 scenario overrides。
- 调用 F4 kernel 重算每个 option。
- Mean shift、reverse solve 和 RSS apportionment。
- Capability feasibility comparison。
- Highest Impact Action。
- 仅在成本证据存在时计算 ROI。

### Composed Report

联合报告 renderer 消费：

- F2 input validation 和 blocked worksheets。
- F5 baseline facts、rules、signals、clarifications。
- F6 options、scenario deltas、feasibility 和 ranking。

它不重新计算工程指标，也不提升 evidence classification。

## Compatibility

- 保留 legacy `comparison-request-v1` / `comparison-result-v1` 和 `feature_not_available` placeholder，供历史调用方读取。
- 新增独立 `f6-optimization-request-v1` / `f6-optimization-result-v1`。
- 现有 F5 workflow 在没有 F6 时继续独立运行。
- 现有 `Feature5-Report.json/.md` 不改变其详细证据职责。
- 新 F6 workflow 生成独立 F6 artifacts 与 composed report。
- Feature register 只有在 contracts、workflow、tests 和 required prerequisites 完成后才将 F6 标记为 available。

## F6 Input Contract

Request 必须绑定：

- `contractVersion`
- `inputClassification: confidential`
- workbook file name 和 content hash
- selected worksheet set
- F2 report reference/hash
- F3 report reference/hash
- F4 calculation reference/hash、run id 和 calculation version
- F5 report reference/hash 和 interpretation version
- F0 knowledge/capability/interpretation versions
- 可选 F5 image observation v2 reference/hash
- 可选 supplier capability evidence
- 可选 cost evidence
- scenario policy version

Worksheet input 包含：

- Baseline F4 completed calculation。
- F5 capability、contributors、signals 和 clarifications。
- F3 governance rows。
- F2 validation findings。
- 可选 reviewed datum/context evidence。

任何 workbook hash、worksheet、table/source-row 或 artifact identity mismatch 都使对应 worksheet F6 fail closed。

## F6 Result Contract

Root status：

- `completed`
- `partially_completed`
- `input_rejected`

每个 worksheet 结果包含：

- baseline metrics
- target capability 及来源
- input findings
- generated options
- feasibility assessments
- risk assessments
- recommendations
- highest impact action
- ROI status
- clarifications

每个 option 包含：

- `optionId`
- `optionKind`
- baseline/result metrics
- `deltaCpk`、`deltaCp`、`deltaRssSigma`、`deltaDpm`、`deltaYield`
- factor/system overrides
- tolerance changes
- capability feasibility
- evidence references
- `relativeCost`
- `roiScore`
- impact rank
- calculation trace/reference

## Target Capability

目标优先级：

1. Worksheet `targetCpk` / `targetSigmaLevel`。
2. 若缺失，使用受控默认 `Cpk = 1.33`，并在报告披露来源。

Target 是 worksheet-level，不跨 worksheet 合并。LSL/USL 默认固定；只有显式、受控的 requirement-change option 才允许改变规格。

## Deterministic Options

### Top Contributor -20%

- 按 baseline contribution 选择 Rank 1。
- 将该 factor 总公差带乘 $0.8$。
- 保持原公差带中心。
- 对 symmetric/asymmetric tolerance 使用同一 band-center 变换。
- 通过 F4 kernel 重算结果。

### Top 3 Contributors -30%

- 按 baseline contribution 固定选择 Top 3。
- 每个 factor 总公差带乘 $0.7$，分别保持原中心。
- Scenario 后不重新选择 Top 3。
- 通过 F4 kernel 重算结果。

### Mean-Shift Centering

- 以 spec center 为候选 target mean。
- 通过 `additionalMeanShift` override 重算两侧 Cpk、DPM 和 yield。
- 若 design nominal、物理约束或 datum evidence 不足，feasibility 为 `requires_engineering_review`。
- 这是平行 OPTION，不自动成为 recommendation。

### Reverse Solve to Target Cpk

固定 baseline mean 和 specification limits，目标 RSS sigma 为：

$$
\sigma_{target} = \min\left(
\frac{\mu-LSL}{3Cpk_{target}},
\frac{USL-\mu}{3Cpk_{target}}
\right)
$$

Solver 生成：

- Single-factor tighten。
- Top-3 combined tighten。
- Bounded RSS apportionment。
- Centering plus tighten。

每个方案都必须通过 F4 kernel 回算验证；闭式结果不能直接成为最终 option。

### RSS Apportionment

支持受控策略：

- proportional-to-contribution
- equal-allocation-among-top-N
- bounded-by-capability
- residual-after-centering

输出每个 factor 的 target sigma、target tolerance、allocation rule、residual error、resulting capability 和 feasibility。

## Evidence-Limited Scenarios

### Improve Supplier Capability

只有 supplier-specific、版本化 evidence 存在时才计算。Evidence 至少包含 supplier reference、process family、part category、capability tier、achievable tolerance band、distribution、source evidence 和 effective version。

只有 F0 generic guidance 时：

- 可产生 capability SIGNAL。
- 不产生 supplier prediction。
- `predictedImprovement = insufficient_evidence`。

### Tighten Datum Strategy

数值 scenario 需要 reviewed datum strategy model：datum face、stack start、direction per factor、datum-chain edges、cross-subsystem relations 和 drawing/3D evidence。

只有 F5 v2 unreviewed/ambiguous signal 时：

- 可产生 risk 和 evidence-closure action。
- 不产生数值 delta。
- `predictedImprovement = insufficient_evidence`。

## Feasibility

Feasibility 状态：

- `supported`
- `requires_engineering_review`
- `insufficient_evidence`
- `not_supported`

F0 capability tier 处理：

- T1：可形成 supported/not-supported assessment。
- T2：assessment 必须要求 review。
- T3：经验性 SIGNAL，不能表述为确定可制造。
- T0/缺失：`insufficient_evidence`。

`internal_guidance_exceeded` 不自动等于不可制造。

## Cost、ROI 与 Ranking

缺少受控成本证据时：

- `relativeCost = insufficient_evidence`
- `roiScore = not_computed`
- 不使用 “Highest ROI Action”
- 按确定性能力改善与风险解除输出 “Highest Impact Action”

Impact ranking 依次考虑：

1. 是否使 Cpk 达到 target。
2. `deltaCpk`。
3. `deltaDpm` / OOS reduction。
4. Yield improvement。
5. High/Critical risk closure。
6. Feasibility status。

只有 cost model、单位、来源和 effective version 均受控时才计算 ROI。

## Workbook and Worksheet Status

Worksheet capability status：

- `FAIL`：`Cpk < 1.0` 或存在已证实 requirement violation。
- `RISK`：`1.0 <= Cpk < targetCpk`，或有未关闭 High/Critical evidence risk。
- `PASS`：`Cpk >= targetCpk` 且无未关闭 High/Critical risk。
- 缺数据：`RISK / insufficient_evidence`，不伪装成 FAIL。

Workbook status 取最差等级：`FAIL > RISK > PASS`。

- F2 blocked worksheets 进入 workbook Input Validation，并至少使 workbook 为 RISK。
- 不跨 worksheet/CTQ 合并 Cpk。
- Capability 和 F6 options 只针对 ready + downstream-selected worksheets。

## Composed Engineering Report

### Workbook Executive Summary

最多 5 bullets：

- Overall Status。
- 最差 Cpk 和 worksheet。
- OOS / yield 关键风险。
- Workbook top contributor 或最高结构风险。
- Highest Impact Action。

### Worksheet Report Structure

每个 worksheet 使用以下固定结构：

1. Executive Summary
2. Requirement Review
3. Input Validation
4. Capability Assessment
5. Contributor Analysis
6. Root Cause Analysis
7. Risk Assessment
8. Recommendations
9. What-If Analysis
10. Final Conclusion

### Executive Summary

最多 5 bullets，包含 status、Cpk、yield、OOS rate、top contributor、key risk 和 recommended action。允许将相关字段合并到同一 bullet，但不得超过 5 条。

### Requirement Review

表格字段：CTQ、Nominal、LSL、USL、Spec Width。CTQ 来自 `dimensionDescription`；数值来自受控 calculation/system-spec fields。Assessment 只写 requirement understanding 和 risk level。

### Input Validation

只列异常：missing tolerance、missing nominal、extreme tolerance、duplicate contributor、potential sign issue、unsupported assumption 及其他受控 validation finding。

Severity：

- Critical：阻断 calculation 或 spec identity。
- Major：sign/duplicate/unsupported assumption、缺关键 image/datum evidence。
- Minor：不阻断的 identifier/governance gap。

### Capability Assessment

表格字段：Mean、Sigma、Cp、Cpk、Yield、DPMO。OOS Rate 为 $1-Yield$，同时提供 ppm。只列最多三个关键 findings，不重复公式和 cell trace。

### Contributor Analysis

展示 Top 5、Top 1 concentration、Top 3 concentration 和 concentrated/distributed 判断。判断阈值必须版本化，不由 renderer 自由推断。

### Root Cause Analysis

- Fact-Based Findings 仅来自 contribution、capability 和 verified input findings。
- Design/Manufacturing/Assembly 只写 evidence-backed SIGNAL。
- 无足够证据时明确 `insufficient_evidence`。
- F5 visual FACT 与 contextual SIGNAL 保持原分类，不升级为工程事实。

### Risk Assessment

覆盖 Product、Manufacturing、Assembly、Supplier 和 Customer Experience，评级为 Low/Medium/High/Critical。未知不自动等于 High；每个 rating 必须有 reason 和 evidence reference。

### Recommendations

只列：

- 已验证 F6 option。
- 明确的 evidence-closure action。

按 expected impact 排序，禁止 generic suggestion。

### What-If Analysis

固定行：

- Reduce Top Contributor 20%。
- Reduce Top 3 Contributors 30%。
- Improve Supplier Capability。
- Tighten Datum Strategy。

前两项显示确定性重算；后两项无输入时显示 `insufficient_evidence` 和 required inputs。显示 Highest Impact Action；ROI 不可用时明确说明。

### Final Conclusion

最多 10 bullets，只回答：

1. 当前设计能否达到目标能力？
2. 最大差距是什么？
3. 最重要行动是什么？
4. 应达到什么 capability target？

Target 必须披露 workbook/default 来源。

## Report Content Rules

- 聚焦工程结论和决策支持。
- 简洁、量化、evidence-based。
- 区分 Facts、Findings、Risks、Recommendations。
- 使用表格和短 bullets。
- 不重复输入中的计算明细、公式轨迹或完整 source-cell 列表。
- 按 Cpk、Yield、Product Quality 和 Manufacturing Risk 排序信息。
- 专业报告保存 evidence references；详细 provenance 仍在 F5/F6 JSON 和详细 artifact 中。

## Error Handling

- F5 v2 无效：F5 baseline 继续；F6 datum options 为 `insufficient_evidence`。
- 单个 F6 option 失败：该 option 为 `calculation_failed`，其他独立 options 可继续。
- Baseline identity mismatch：对应 worksheet F6 fail closed。
- F2 blocked worksheet：只进入 Input Validation，不生成 capability/F6 数值。
- 缺 supplier/datum/cost evidence：保留报告行，不产生预测或 ROI。
- Composed report root status 必须与 worksheet/option statuses 精确一致。
- 不从 stale、partial 或其他 run artifacts 补位。

## Implementation Surfaces

新增 contracts：

- `f6-optimization-request-v1`
- `f6-optimization-result-v1`
- `f6-option-v1`
- `f6-reverse-solve-v1`
- `f6-feasibility-assessment-v1`
- supplier/datum/cost evidence contracts

新增 services：

- F6 optimization orchestrator
- scenario generator
- reverse solver
- RSS apportionment
- capability feasibility
- impact ranking

新增 scripts：

- F6 artifact loader
- F6 CLI args
- F6 output layout
- F6 report renderer
- composed report renderer
- full validation runner

复用 F4 kernel，但不将 F4 private scenario helper 直接暴露为无治理 public API；需要受控 adapter 或 service boundary。

## Test Strategy

1. Contract RED：request/result、identity、status/count consistency、option provenance。
2. Solver RED：target sigma、single/top3/reverse solve、asymmetric band-center transform。
3. Scenario RED：Top 1 -20%、Top 3 -30%、mean shift 和 kernel delta。
4. Apportionment RED：四种策略、bounds、residual 和 infeasible cases。
5. Feasibility RED：T1/T2/T3/T0、supplier missing、datum missing、cost missing。
6. Loader RED：F2/F3/F4/F5 hashes、worksheet set、source-row identity、stale/partial rejection。
7. Report RED：固定章节、表格列、5/10 bullet limits、异常-only validation、无公式重复。
8. Compatibility：legacy F6 placeholder、旧 F5、F5 v1/v2 和无 F6 路径。
9. Full flow、repository check、build 和 complete test suite。

## Acceptance Scenario

使用 Maera gap workbook：

- F2 blocked worksheets 出现在 workbook Input Validation。
- 四个 ready worksheets 生成完整 F5+F6 子报告。
- Workbook 总览优先显示 below-target worksheet。
- Top 1 -20% 和 Top 3 -30% 有确定性 `deltaCpk`、`deltaDpm` 和 yield delta。
- Supplier/Datum 无证据时显示 `insufficient_evidence`，不产生近似数字。
- F5 五项图片观察和 part/factor context 出现在 root cause/risk evidence 中，但不升级为工程事实。
- Recommendation 只引用 verified option 或 evidence-closure action。
- 无成本证据时输出 Highest Impact Action，ROI 为 `not_computed`。
- Legacy F6 placeholder 与现有 F5 workflow 继续通过兼容测试。