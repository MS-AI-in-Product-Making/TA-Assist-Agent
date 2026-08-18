# F6 Workbook 端到端编排设计

## 目标

用户在 VS Code agent 中输入“使用F6分析报告”后，由 `f6-analysis` skill 受治理地完成 F0、F1、F2、F3、F4、F5、F6 全流程，并生成和验证每个 Feature 的输出。用户不需要手工拼接 workflow 命令，但仍须提供 workbook，并完成 worksheet 和可选证据的交互确认。

## 架构边界

自然语言入口属于 agent skill。Skill 负责交互、阶段顺序、停止条件和结果汇总；现有 `workflow:f2:excel`、`workflow:f3`、`workflow:f4`、`workflow:f5`、`workflow:f6` 继续作为确定性 CLI 执行器。仓库没有独立 `workflow:f0`：F0 通过 F2、F5、F6 使用的受控知识库和规则版本体现。

不把整条流程封装成一个交互式 CLI。普通 CLI 无法执行 `vscode_askQuestions` 多选或 agent 图片观察；让 `feature6` 命令猜测 worksheet 会绕过既有 F1/F2 和 F3/F4/F5 门禁。显式 `feature6` 命令继续只消费已经验证的 F2、F3、F4、F5 roots 和精确 worksheet set。

## 入口模式

### TA workbook

1. 验证一个 canonical `.xlsx` workbook，并确认 F0 所需版本可用。
2. 第一次运行 `workflow:f2:excel` 只生成 F1 worksheet selection。
3. 用户多选 worksheet 后，携带 workbook hash 和 `--confirm` 完成 F1/F2。
4. 只从 F2 `readyForNextFeature` 且具备有效 F1 image provenance 的 worksheet 中发起第二次多选。
5. 对精确下游选择依次运行本地 F3、F4、F5 和 F6。
6. F5 可选生成新的 `f5-image-observation-v2`；不得创建 v1，也不得修改已有 observation artifact。
7. F6 可选消费 supplier capability、datum strategy 和 cost evidence。没有受控证据时继续运行，但 supplier/datum option 必须为 `insufficient_evidence`，ROI 必须为 `not_computed`。
8. 逐阶段验证输出后，汇总 F1、F2、F3、F4、F5、F6 的状态和路径。

### Existing F6 artifact

输入为 F6 output directory 或 `Feature6-Composed-Report.json` 时，只执行受控 containment、schema、identity、manifest 和 hash 验证，然后展示结果；不重跑上游，不重复图片观察。

## 数据与控制流

同一次 workbook run 的 content hash 是全流程 identity anchor。第一次 worksheet 选择控制 F1/F2 解析范围，第二次选择控制 F3/F5/F6 的精确范围；F4 runner 可以包含额外 ready calculations，但 F5/F6 必须通过重复 `--worksheet` 收敛到第二次选择。

F6 输入必须来自本次运行中已验证的 F2、F3、F4、F5 roots。F5 发布的 observation 副本可传给 F6；F6 不直接信任 agent 临时对象。每个阶段失败时停止，不回退到历史 run 或部分 artifacts。

## 安全与治理

- source workbook 始终只读，所有输出均为 confidential。
- F3 只运行本地治理；不请求 ADO target，不调用 ADO，不生成发布 reminder。
- 禁止 REST、HTTP、browser network 和 credential 请求。
- 所有 paths 需要 canonical containment、reparse/symlink 防护及 hash/identity 验证。
- 图片 FACT 与 contextual SIGNAL 分离；没有工程证据时不得提升为最终 RULE。
- F6 不得用无证据 supplier/datum/cost 结论填充推荐或 ROI。
- 最终报告必须保留 F2 blocked worksheets，而不是把它们伪装成 F6 calculation failures。

## 验收

`scripts/f6-skill.test.mjs` 锁定 frontmatter、允许命令、W0-W10 顺序、两次 worksheet gate、F5 v2、F6 evidence gate、existing-artifact 快速路径和安全禁止项。Feature register 增加 `f6-skill-contract-check`、`f0-f6-real-workbook-flow` 与 `f6-composed-report-check`。最终运行 skill、governance、CLI/F6 flow 定向测试以及完整 `npm test`。