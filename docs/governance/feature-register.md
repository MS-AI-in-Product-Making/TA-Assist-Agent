# Feature Register

## 目的

Feature Register 是 Phase 0 对 F0-F8 的唯一可查询能力清单。它提供规则和查询接口，
用于区分已完成的工程基座与尚未交付的业务能力，避免调用方、测试或文档将规划能力
误认为可用。F0 为本地、只读的 `knowledge-base-v1` 查询与经审查的 `internal` 指导元数据而标记为
`available`；F1 为受控 `confidential` 工作簿字节的只读 worksheet catalog 而标记为
`available`；F2-F7 均为 `unavailable`。F8 仅为 Phase 0 的匿名、`public`、受治理 Skill
验收 fixture 而标记为 `available`。这些状态不表示已交付 TA 产品工作流、生产编排器、
真实工程知识或任何外部写入能力；调用方和后续编排器仍必须在执行前查询该清单。

## 当前条目

| Feature | 标题 | 当前状态 | 依赖与外部前置条件 | 输入/输出契约 | 最大分类 | 验收检查 | 禁用行为 |
|---|---|---|---|---|---|---|---|
| F0 | 知识库 | `available` | `knowledge-base-v1`, `internal-tolerance-guidance-v1`; `approved-public-knowledge-snapshot`, `approved-internal-knowledge-snapshot` | `knowledge-base-query-request-v1` / `knowledge-base-query-result-v1` | `internal` | `anonymous-knowledge-base-fixture`, `unknown-capability-t0-fixture`, `knowledge-base-integrity-check`, `internal-tolerance-guidance-integrity-check`, `guidance-only-result-fixture`, `internal-source-evidence-dto` | `return feature_not_available` |
| F1 | TA 报告解析与资产准备 | `available` | `workbook-catalog-v1`; `approved-ooxml-parser` | `workbook-catalog-request-v1` / `workbook-catalog-result-v1` | `confidential` | `anonymous-workbook-catalog-fixture`, `dynamic-date-cache-fixture`, `workbook-catalog-privacy-check` | `return feature_not_available` |
| F2 | TA 风险与行动建议 | `unavailable` | `quality-rules-v1`, `recommendation-engine-v1`; `approved-recommendation-rules` | `recommendation-request-v1` / `recommendation-result-v1` | `confidential` | `anonymous-recommendation-fixture` | `return feature_not_available` |
| F3 | DIM ID 与图纸治理 | `unavailable` | `dim-id-service-v1`; `approved-ado-access`, `canonical-dim-id-policy` | `drawing-governance-request-v1` / `drawing-governance-result-v1` | `confidential` | `anonymous-dim-id-fixture` | `return feature_not_available` |
| F4 | 方法推荐与 Excel 一致性计算 | `unavailable` | `calculation-worker-v1`; `approved-windows-excel-worker` | `calculation-request-v1` / `calculation-result-v1` | `confidential` | `approved-template-regression` | `return feature_not_available` |
| F5 | 客观结果解释 | `unavailable` | `calculation-worker-v1`, `knowledge-base-v1`; `approved-knowledge-base` | `interpretation-request-v1` / `interpretation-result-v1` | `confidential` | `anonymous-interpretation-fixture` | `return feature_not_available` |
| F6 | 可比较的方案选项 | `unavailable` | `knowledge-base-v1`, `comparison-engine-v1`; `approved-knowledge-base` | `comparison-request-v1` / `comparison-result-v1` | `confidential` | `anonymous-comparison-fixture` | `return feature_not_available` |
| F7 | 实测 Cpk 闭环 | `unavailable` | `measurement-store-v1`, `dim-id-service-v1`; `approved-measurement-store`, `canonical-dim-id-policy` | `cpk-request-v1` / `cpk-result-v1` | `confidential` | `anonymous-cpk-fixture` | `return feature_not_available` |
| F8 | TA 工作流编排 | `available` | `orchestrator-v1`, `skill-runtime-v1`; `approved-skill-manifests` | `workflow-request-v1` / `workflow-result-v1` | `public` | `anonymous-workflow-fixture`, `anonymous-governed-skill` | `return feature_not_available` |

## 使用规则

- 调用方先通过 `getFeatureStatus(featureId)` 查询条目；未知 ID 返回 `undefined`，
  调用方必须按不可用处理。
- 条目状态为 `unavailable` 时，调用方和后续生产编排器不得执行相应业务逻辑。后续
  运行时必须返回 `feature_not_available`，并说明未满足的依赖或外部前置条件；这是
  后续实现义务，不代表 Phase 0 已完成端到端拦截。
- F0 的 `available` 保留本地、匿名 `public-v1` 对 `knowledge-base-v1` 的只读查询，且
  允许使用已审批的 `internal-v1` 指导规则与快照元数据。内部指导结果只可为
  `guidance-exceeded`、`within-guidance` 或 `unknown`，不得声称能力紧度或可制造性。当前
  `internal-v1` 已发布 110 条经审核规则，覆盖 CNC、压铸、模切、PCB/FPC、注塑与钣金；每条
  规则保留来源 hash、工作表及范围证据。原始 `.xls`、`.xlsx`、`.xlsm` 始终禁止提交，除非另行批准受控白名单。F2 仍为
  `unavailable` 并返回 `feature_not_available`；启用后才会使用文件、工作表和范围证据。
  不得将 F0 状态解释为 F2-F7 已启用。

F0 内部指导范围与维护边界见 [F0 内部制程公差指导库设计](../superpowers/specs/2026-07-28-f0-internal-tolerance-guidance-design.md) 和 [实施计划](../superpowers/plans/2026-07-28-f0-internal-tolerance-guidance.md)。
- F1 的 `available` 仅接受受控的 `confidential` `.xlsx` 字节，并只在受控内存中创建
  worksheet catalog。它不读取或校验因子表、不执行计算、不提取图片、不调用外部服务，
  也不跟踪或导出原始 `.xlsx`；不得将该状态解释为 F2-F7 或完整 TA 工作流可用。
- F8 的 `available` 仅允许匿名 `public` Skill fixture 在 runner 中通过输入分类、
  Feature 状态和策略门检查后执行纯函数或显式注入的 mock adapter。`persist`、
  `network` 和其他外部权限仍由策略门拒绝；不得将该状态解释为生产能力可用。
- 修改任一条目时，必须同步更新 `packages/governance` 的测试、此文档、相关契约
  和匿名验收 fixture。若涉及外部访问，还必须经过策略门审批。

## F1 验收命令

在仓库根目录执行以下命令。聚焦测试仅使用匿名、内存中的 workbook fixture；不得传入
或修改真实工作簿。

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/zip-security.test.ts packages/workbook-catalog/src/ooxml-reader.test.ts packages/workbook-catalog/src/workbook-catalog.test.ts packages/governance/src/policy-gate.test.ts
npm run build -- --force
npm run lint
npm test
npm run check:repository
npm ci --dry-run
git diff --check
git ls-files | Select-String '\.(xlsx|xlsm)$|^test/|^fixtures/confidential/'
```