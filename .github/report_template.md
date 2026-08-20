# 公差分析报告 Tolerance Analysis Report

> Template Version：TA-REPORT-V2.0  
> 报告原则：区分“数值复算通过”“模型定义有效”“满足工程要求”三个不同结论。所有解释必须来自已有数据、受治理规则或明确证据；缺少依据时使用 `N/A`、`NOT_PROVIDED`、`NOT_EVALUATED` 或 `INSUFFICIENT_EVIDENCE`。

# 1. 文档控制 Document Control

| Field | Value | Source |
|---|---|---|
| Project | {{project_name_or_not_provided}} | Confirmed analysis context or `NOT_PROVIDED` |
| Source Workbook | {{workbook_name}} | F1/F2 workbook identity |
| Workbook Revision | {{workbook_revision_or_na}} | F1 workbook metadata |
| Workbook Hash | {{workbook_content_hash}} | F1-F5 artifact identity |
| Selected Worksheet Count | {{selected_worksheet_count}} | F2 selected scope |
| Ready / Blocked Worksheet Count | {{ready_count}} / {{blocked_count}} | F2 handoff status |
| Report Generated At | {{generated_at}} | Report runtime |
| Controlled Versions | F0 {{f0_versions}}; F4 {{calculation_version}}; F5 {{interpretation_version}} | Artifact metadata |
| Reviewed By | {{reviewed_by_or_pending}} | Explicit review record or `PENDING` |

# 2. Workbook 决策总览

| Worksheet | Tolerance Loop Description | Key Finding | Disposition |
|---|---|---|---|
| {{worksheet_name}} | {{tolerance_loop_description}} | {{highest_priority_finding_or_none}} | {{PASS / CONDITIONAL_PASS / FAIL / INCOMPLETE}} |

---

# 3. Worksheet：{{worksheet_name}}

## 3.1 执行摘要

| Item | Result | Evidence |
|---|---|---|
| Characteristic | {{characteristic_id_and_description}} | F2/F3 |
| Final Disposition | {{PASS / CONDITIONAL_PASS / FAIL / INCOMPLETE}} | F2-F5 governed evidence |
| Primary Finding | {{primary_finding_or_none}} | {{evidence_id_or_reference}} |
| Top Contributor | {{top_contributor_and_percent_or_na}} | F4 contribution result |
| Required Action | {{required_action_or_none}} | F5 clarification / engineering review |

**一句话结论：**  
{{明确说明是否满足要求、主要失败模式或证据缺口、首要贡献因子及下一行动；不得把贡献率直接表述为物理根因。}}

## 3.2 分析目标与要求

| Requirement | Value | Source |
|---|---:|---|
| Target | {{target_or_na}} {{unit}} | F2 {{target_source_cell_or_na}} |
| LSL | {{lsl}} {{unit}} | F2 {{lsl_source_cell}} |
| USL | {{usl}} {{unit}} | F2 {{usl_source_cell}} |
| Target Cpk | {{target_cpk}} | F2/F4 {{target_cpk_source}} |
| Evaluation Level | {{target_sigma_level}}σ | F2/F4 {{sigma_level_source}} |

## 3.4 尺寸链堆叠图

- Tolerance Path Image：{{f1_image_reference}}
- Image Evaluation：{{evaluated_v2 / not_evaluated}}
- Engineering Review：{{required / not_required}}

## 3.5 输入数据

| Row | Factor Description (TA Loop) | Drawing Number | DIM ID | Physical Nominal | Physical Mean | +Tol | -Tol | Distribution | Sigma Level | 1σ | Source |
|---:|---|---|---|---:|---:|---:|---:|---|---:|---:|---|
| {{source_row}} | {{factor_name}} | {{drawing_number_or_missing}} | {{dim_id_or_missing}} | {{nominal}} | {{physical_mean}} | {{upper_tolerance}} | {{lower_tolerance}} | {{distribution}} | {{sigma_level}} | {{sigma}} | F1/F2/F3/F4 {{table_id}} |

### 输入完整性

- Factors：{{factor_count}}
- Drawing Number 缺失：{{missing_drawing_count}}
- DIM ID 缺失：{{missing_dim_count}}
- Distribution 缺失：{{missing_distribution_count}}
- F3 Governance：{{governance_complete_count}} complete / {{governance_required_count}} review required
- 阻塞计算的问题：{{blocking_input_gaps_or_none}}

## 3.6 模型假设与计算方法

| Assumption / Method | Applied Value | Evidence | Validation Status |
|---|---|---|---|
| Calculation model | {{linear_stack_model_or_recorded_method}} | F4 {{formula_id}} | {{SUPPORTED / NEEDS_REVIEW}} |
| Factor independence / correlation | {{independent / correlated / not_provided}} | Confirmed analysis context | {{status}} |
| Direction and sign convention | {{confirmed_value_or_not_provided}} | F3/F5 {{evidence_id_or_na}} | {{status}} |
| Long-term safety factor | {{value_or_na}} | F2/F4 source row | {{status}} |
| Image interpretation | {{evaluated_v2 / not_evaluated}} | F1/F5 image identity | {{status}} |
| Nonlinear / contact effects | {{included / excluded / not_provided}} | Confirmed analysis context | {{status}} |

使用的 RSS 公式：`{{rss_formula_expression}}`

- Formula ID / Version：{{rss_formula_id}} / {{rss_formula_version}}
- Formula Self-Check：{{formula_check_status}}
- Numerical Tolerance：{{recorded_numerical_tolerance_or_na}}
- 未由现有证据确认的方法或假设不得补写。

## 3.7 结果与规格符合性

| Metric | Lower | Upper | Minimum Margin | Result | Source |
|---|---:|---:|---:|---|---|
| {{target_sigma_level}}σ Statistical Range | {{stat_lower}} | {{stat_upper}} | {{stat_margin}} | {{PASS / FAIL}} | F4 calculation |
| Worst-Case Range | {{wc_lower}} | {{wc_upper}} | {{wc_margin}} | {{PASS / FAIL}} | F4 calculation |

| Capability Metric | Value | Result | Source |
|---|---:|---|---|
| Predictive Cp | {{cp}} | {{result}} | F4 calculation |
| Predictive CpkL | {{cpkl}} | {{result}} | F4 calculation |
| Predictive CpkU | {{cpku}} | {{result}} | F4 calculation |
| Predictive Cpk | {{cpk}} | {{PASS / FAIL}} | F4 calculation |
| Predicted Yield | {{yield_or_na}} | {{result_or_na}} | F4 calculation |
| Predicted DPM | {{dpm_or_na}} | {{result_or_na}} | F4 calculation |

- Mean Response：{{mean}} {{unit}}
- Mean Shift：{{mean_shift}} {{unit}}
- RSS 1σ：{{rss_sigma}} {{unit}}
- Yield / Cpk 限制：基于设计公差模型，不等同于实测量产能力。
- Margin 公式：`min(lower_bound - LSL, USL - upper_bound)`。

## 3.8 贡献与敏感度

| Rank | Factor | 1σ | Variance Contribution | Cumulative | Evidence |
|---:|---|---:|---:|---:|---|
| {{rank}} | {{factor}} | {{sigma}} | {{contribution_percent}} | {{cumulative_percent}} | F4/F5 {{evidence_id}} |

> 贡献率表示模型中的方差占比，不等于已确认的物理根因或供应商责任。方向、敏感度或根因解释只有在 F5 存在受支持证据时才可输出。

# 4. Appendix: Reference Traceability

| Reference | Traceability |
|---|---|
| F0 controlled versions | {{f0_versions}} |
| F1 workbook cells / source rows / image identity | {{f1_references}} |
| F2 specification / readiness / missing inputs | {{f2_references}} |
| F3 Drawing Number / DIM ID governance | {{f3_references}} |
| F4 calculation / formula IDs / precision | {{f4_references}} |
| F5 FACT / RULE / SIGNAL / OPTION / clarification IDs | {{f5_references}} |
| F6 optimization artifact provenance | {{f6_optimization_reference_or_na}} |