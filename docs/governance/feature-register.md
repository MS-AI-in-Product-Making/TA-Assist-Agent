# Feature Register

## 目的

Feature Register 是 Phase 0 对 F0-F8 的唯一可查询能力清单。它提供规则和查询接口，
用于区分已完成的工程基座与尚未交付的业务能力，避免调用方、测试或文档将规划能力
误认为可用。当前所有 F0-F8 均为 `unavailable`。本阶段未交付生产编排器，因此不应
宣称已端到端拦截业务执行；调用方和后续编排器必须在执行前查询该清单。

## 当前条目

| Feature | 标题 | 当前状态 | 依赖与外部前置条件 | 输入/输出契约 | 最大分类 | 验收检查 | 禁用行为 |
|---|---|---|---|---|---|---|---|
| F0 | TA 工作簿基础解析 | `unavailable` | `workbook-parser-v1`; `approved-workbook-parser` | `workbook-request-v1` / `workbook-summary-v1` | `confidential` | `anonymous-workbook-fixture` | `return feature_not_available` |
| F1 | TA 数据质量检查 | `unavailable` | `workbook-parser-v1`, `quality-rules-v1`; `approved-quality-rules` | `quality-check-request-v1` / `quality-check-result-v1` | `confidential` | `anonymous-quality-fixture` | `return feature_not_available` |
| F2 | TA 风险与行动建议 | `unavailable` | `quality-rules-v1`, `recommendation-engine-v1`; `approved-recommendation-rules` | `recommendation-request-v1` / `recommendation-result-v1` | `confidential` | `anonymous-recommendation-fixture` | `return feature_not_available` |
| F3 | DIM ID 与图纸治理 | `unavailable` | `dim-id-service-v1`; `approved-ado-access`, `canonical-dim-id-policy` | `drawing-governance-request-v1` / `drawing-governance-result-v1` | `confidential` | `anonymous-dim-id-fixture` | `return feature_not_available` |
| F4 | 方法推荐与 Excel 一致性计算 | `unavailable` | `calculation-worker-v1`; `approved-windows-excel-worker` | `calculation-request-v1` / `calculation-result-v1` | `confidential` | `approved-template-regression` | `return feature_not_available` |
| F5 | 客观结果解释 | `unavailable` | `calculation-worker-v1`, `knowledge-base-v1`; `approved-knowledge-base` | `interpretation-request-v1` / `interpretation-result-v1` | `confidential` | `anonymous-interpretation-fixture` | `return feature_not_available` |
| F6 | 可比较的方案选项 | `unavailable` | `knowledge-base-v1`, `comparison-engine-v1`; `approved-knowledge-base` | `comparison-request-v1` / `comparison-result-v1` | `confidential` | `anonymous-comparison-fixture` | `return feature_not_available` |
| F7 | 实测 Cpk 闭环 | `unavailable` | `measurement-store-v1`, `dim-id-service-v1`; `approved-measurement-store`, `canonical-dim-id-policy` | `cpk-request-v1` / `cpk-result-v1` | `confidential` | `anonymous-cpk-fixture` | `return feature_not_available` |
| F8 | TA 工作流编排 | `unavailable` | `orchestrator-v1`, `skill-runtime-v1`; `approved-skill-manifests` | `workflow-request-v1` / `workflow-result-v1` | `internal` | `anonymous-workflow-fixture` | `return feature_not_available` |

## 使用规则

- 调用方先通过 `getFeatureStatus(featureId)` 查询条目；未知 ID 返回 `undefined`，
  调用方必须按不可用处理。
- 条目状态为 `unavailable` 时，调用方和后续生产编排器不得执行相应业务逻辑。后续
  运行时必须返回 `feature_not_available`，并说明未满足的依赖或外部前置条件；这是
  后续实现义务，不代表 Phase 0 已完成端到端拦截。
- 修改任一条目时，必须同步更新 `packages/governance` 的测试、此文档、相关契约
  和匿名验收 fixture。若涉及外部访问，还必须经过策略门审批。