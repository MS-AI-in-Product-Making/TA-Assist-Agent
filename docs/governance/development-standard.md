# 开发协作标准

## 适用范围

本标准适用于本仓库的功能、缺陷修复、文档和治理变更。计划、实现、执行和验收文档默认使用中文；代码标识符、路径、命令、错误码、协议和契约名称可保留英文。

## Issue 与分支

- 每个 Feature 必须从 GitHub Issue 开始，Issue 应说明用户价值、输入/输出契约、数据分级、依赖、验收检查和外部前置条件。
- 不得直接在 `main` 分支开发或提交变更。
- 开始工作前先同步最新 `main`，再创建 `feature/<issue-id>-<topic>`、`fix/<issue-id>-<topic>` 或 `docs/<issue-id>-<topic>` 分支。
- 缺陷、文档和治理变更也应关联相应的 GitHub Issue；治理规则变更使用“治理变更”模板。

## Pull Request 要求

每个 Pull Request 必须关联 Issue，并在 PR 描述中明确：

- 变更摘要与受影响范围。
- 输入/输出契约影响，包括兼容性和迁移要求。
- 隐私与数据分级影响，确认未提交敏感数据或说明已完成的必要审查。
- 已执行的测试命令及结果。
- 回滚条件、回滚步骤和负责边界。

合并前，提交者应处理评审意见并确保所需检查通过。紧急变更同样需要补建 Issue 和 PR 记录，保留决策依据与验证证据。

## 文档与验收

计划说明范围、依赖和风险；实现记录设计与契约；执行记录操作和结果；验收记录检查项、证据和结论。除非交付对象另有语言要求，这四类文档默认使用中文，并与对应 Issue 和 PR 保持可追溯关系。

## F2 Initial 验收

- F2 任一模块的验收必须执行完整 `F0 -> F1 -> F2` 链路，不能以孤立单元测试替代端到端证据。
- 使用 `npm run workflow:f2 -- "test/<workbook.xlsx>"` 运行真实 workbook；报告仅写入 `test/demo-output/feature2-output/<workbook-base-name>/`。
- 验收必须覆盖九项必填字段、公差路径截面图、默认 `mm` 假设、worksheet 隔离、Mapping 缺口非阻断、唯一匹配差异阻断和标识符非阻断语义。
- F2 Initial 不调用 F2.3，不接受例外覆盖必填、截面图、公差或 distribution 阻断。
- 设计与执行依据见 [F2 Initial 工作流设计](../superpowers/specs/2026-08-03-f2-initial-workflow-design.md) 和 [F2 Initial 实施计划](../superpowers/plans/2026-08-03-f2-initial-workflow.md)。