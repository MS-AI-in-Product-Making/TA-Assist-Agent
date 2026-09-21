# Feature Register

## 目的

Feature Register 是 Phase 0 对 F0-F7 的唯一可查询能力清单。它提供规则和查询接口，
用于区分已完成的工程基座与尚未交付的业务能力，避免调用方、测试或文档将规划能力
误认为可用。F0 为本地、匿名、`public`、只读的 `knowledge-base-v1` 查询，以及经审查的
`internal-v1` 制程指导和 `interpretation-rules-v2` 解读规则而标记为 `available`；F1 为受控 `confidential` 工作簿字节的只读 catalog 与 F1.1 资产准备而标记为
`available`；F1.7 为因子表语义识别与人工确认闸门而标记为 `available`；根 F2 Initial 为 worksheet 隔离的数据清洗与能力一致性门禁而标记为 `available`；F2.1 为严格必填字段校验而标记为 `available`；F2.2 为非阻断能力库与 distribution
一致性校验而标记为 `available`；F2.3 的受限例外处理与 F2.4 的标识符质量检查也标记为
`available`；F3 为 `drawing-governance-v2` 本地治理核心和受控 Surface MCP adapter 而标记为
`available`；F4 为受 F1/F2 证据门禁的 `excel-ta-v1` 计算服务而标记为 `available`；根 F5 为
直接消费 F0/F1/F3/F4 受控工件的能力、规格与贡献解读而标记为 `available`，F5.1 保留为其
历史 internal compatible core；F6 为消费 F2/F3/F4/F5 受控工件的本地优化 workflow 而标记为
`available`，其历史 comparison placeholder API 仍返回 `feature_not_available`；F7 仍为 `unavailable`。F8 与 participant/workbench runtime 已退休，当前产品入口为 Copilot Skills 与直接 workflow 脚本。这些状态不表示已启用 F7、真实工程知识或未经确认的外部写入
能力；调用方和后续编排器仍必须在执行前查询该清单。

## 当前条目

| Feature | 标题 | 当前状态 | 依赖与外部前置条件 | 输入/输出契约 | 最大分类 | 验收检查 | 禁用行为 |
|---|---|---|---|---|---|---|---|
| F0 | 知识库 | `available` | `knowledge-base-v1`, `internal-tolerance-guidance-v1`, `interpretation-rules-v2`; `approved-public-knowledge-snapshot`, `approved-internal-knowledge-snapshot`, `approved-interpretation-rules-snapshot` | `knowledge-base-query-request-v1` / `knowledge-base-query-result-v1` | `internal` | `anonymous-knowledge-base-fixture`, `unknown-capability-t0-fixture`, `knowledge-base-integrity-check`, `internal-tolerance-guidance-integrity-check`, `guidance-only-result-fixture`, `internal-source-evidence-dto`, `interpretation-rules-integrity-check`, `internal-interpretation-source-evidence` | `return feature_not_available` |
| F1 | TA 报告解析与资产准备 | `available` | `workbook-catalog-v1`, `worksheet-analysis-assets-v1`; `approved-ooxml-parser` | `worksheet-analysis-assets-request-v1` / `worksheet-analysis-assets-result-v1` | `confidential` | `anonymous-workbook-catalog-fixture`, `dynamic-date-cache-fixture`, `workbook-catalog-privacy-check`, `anonymous-worksheet-analysis-assets-fixture`, `worksheet-image-read-privacy-check` | `return feature_not_available` |
| F1.7 | TA 因子表语义识别与人工确认 | `available` | `workbook-catalog-v1`, `semantic-table-detection-v1`; `approved-ooxml-parser` | `semantic-table-detection-request-v1` / `semantic-table-detection-result-v1` | `confidential` | `anonymous-semantic-table-detection-fixture`, `semantic-detection-failfast-check`, `semantic-detection-privacy-check` | `return feature_not_available` |
| F2 | TA 数据清洗与能力一致性门禁 | `available` | `knowledge-base-v1`, `capability-item-mapping-v1`, `worksheet-analysis-assets-v1`, `f2-artifact-input-v1`, `f2-user-report-v1`; `approved-public-knowledge-snapshot`, `approved-ooxml-parser` | `f2-artifact-input-v1` / `f2-user-report-v1` | `confidential` | `f0-f1-artifact-f2-real-workbook-flow`, `f2-artifact-only-check`, `f2-blocking-policy-check`, `f2-capability-difference-nonblocking-check`, `f2-privacy-check` | `return feature_not_available` |
| F2.1 | TA 必填字段严格校验 | `available` | `worksheet-analysis-assets-v1`, `required-field-check-v1`; `approved-ooxml-parser` | `required-field-check-request-v1` / `required-field-check-result-v1` | `confidential` | `anonymous-required-field-check-fixture`, `required-field-blocking-check`, `required-field-privacy-check` | `return feature_not_available` |
| F2.2 | 能力库与分布一致性校验 | `available` | `worksheet-analysis-assets-v1`, `required-field-check-v1`, `knowledge-base-v1`, `capability-validation-v1`; `approved-public-knowledge-snapshot` | `capability-validation-request-v1` / `capability-validation-result-v1` | `confidential` | `anonymous-capability-validation-fixture`, `capability-validation-gate-check`, `capability-validation-nonblocking-check`, `capability-validation-privacy-check` | `return feature_not_available` |
| F2.3 | 非阻断差异例外处理 | `available` | `capability-validation-v1`, `identifier-quality-check-v1`, `unified-exception-resolution-v2`; `approved-exception-policy` | `unified-exception-resolution-request-v2` / `unified-exception-resolution-result-v2` | `confidential` | `anonymous-unified-exception-resolution-fixture`, `unified-exception-resolution-coverage-check`, `unified-exception-resolution-privacy-check` | `return feature_not_available` |
| F2.4 | DIM ID 与 Drawing Number 质量检查 | `available` | `worksheet-analysis-assets-v1`, `required-field-check-v1`, `identifier-quality-check-v1`; `approved-ooxml-parser` | `identifier-quality-check-request-v1` / `identifier-quality-check-result-v1` | `confidential` | `anonymous-identifier-quality-fixture`, `identifier-quality-gate-check`, `identifier-quality-privacy-check` | `return feature_not_available` |
| F3 | DIM ID 与图纸治理 | `available` | `f2-user-report-v1`, `drawing-governance-v2`, `surface-mcp-adapter-v1`; `approved-surface-mcp-access`, `approved-comment-zero-write-policy` | `drawing-governance-request-v2` / `drawing-governance-result-v2` | `confidential` | `anonymous-drawing-governance-fixture`, `drawing-governance-anchor-check`, `drawing-governance-privacy-check`, `surface-mcp-comment-zero-confirmation-check` | `return feature_not_available` |
| F4 | 方法推荐与 Excel 一致性计算 | `available` | `worksheet-analysis-assets-v1`, `required-field-check-v1`, `exception-resolution-v1`, `calculation-service-v1`; `approved-windows-excel-worker` | `calculation-request-v1` / `calculation-result-v1` | `confidential` | `anonymous-calculation-kernel-fixture`, `approved-template-regression`, `calculation-privacy-check` | `return feature_not_available` |
| F5 | 客观结果解释 | `available` | `interpretation-rules-v2`, `worksheet-analysis-assets-v1`, `drawing-governance-v2`, `calculation-service-v1`; `approved-knowledge-base`, `approved-me-review` | `f5-data-interpretation-request-v1` / `f5-data-interpretation-result-v1` | `confidential` | `f5-artifact-association-check`, `f5-rule-traceability-check`, `f5-clarification-gate-check`, `f5-skill-contract-check` | `return feature_not_available` |
| F5.1 | 客观结果解读 | `available` | `calculation-service-v1`, `knowledge-base-v1`, `interpretation-rules-v2`, `objective-interpretation-v1`; `approved-knowledge-base` | `interpretation-request-v1` / `interpretation-result-v1` | `confidential` | `anonymous-interpretation-fixture`, `interpretation-rule-traceability-check`, `interpretation-privacy-check` | `return feature_not_available` |
| F6 | 可比较的方案选项 | `available` | `interpretation-rules-v2`, `f2-user-report-v1`, `drawing-governance-v2`, `calculation-service-v1`, `f5-data-interpretation-v1`, `f6-analysis-context-v1`, `f6-optimization-targets-v1`, `f6-optimization-v2`; `approved-knowledge-base` | `f6-analysis-context-v1` / `f6-optimization-v2` | `confidential` | `anonymous-f6-optimization-fixture`, `f6-artifact-association-check`, `f6-optimization-contract-check`, `f6-privacy-check`, `f6-no-write-network-check`, `f6-supplier-datum-evidence-gate-check`, `f6-roi-gate-check`, `f6-skill-contract-check`, `f0-f6-real-workbook-flow`, `f6-final-report-check` | `return feature_not_available` |
|   | 产品能力名称：Design Optimization。 |   |   |   |   |   |   |
| F7 | 实测 Cpk 闭环 | `unavailable` | `interpretation-rules-v2`, `measurement-store-v1`, `dim-id-service-v1`; `approved-measurement-store`, `canonical-dim-id-policy` | `cpk-request-v1` / `cpk-result-v1` | `confidential` | `anonymous-cpk-fixture` | `return feature_not_available` |

F5 的 `approved-knowledge-base` 与 `approved-me-review` 是 Feature 发布/启用治理批准，不是每次运行要求用户提供的交互输入。F5 当前 `status: available` 表示这些部署批准已满足。每次运行中的 ME review 由 `requiresEngineeringReview` SIGNAL、clarification/assumption，以及禁止生成缺少受控证据支持的最终 RULE 共同门禁；physical image、artifact identity/hash 或 schema evidence 校验失败仍在运行时 fail closed。

### F5 验收证据映射

| Feature Register 验收检查 | 验收证据 |
|---|---|
| `f5-artifact-association-check` | `scripts/f5-artifact-loader.test.mjs`、`scripts/f5-full-flow.test.mjs` |
| `f5-rule-traceability-check` | knowledge query tests、F5.1 interpretation tests、root F5 tests |
| `f5-clarification-gate-check` | root F5 tests、F5 report tests |
| `f5-skill-contract-check` | `scripts/f5-skill.test.mjs` |

该映射用于人工与 CI 验收追溯，不表示仓库会自动生成或维护独立 acceptance manifest。

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
  规则保留来源 hash、工作表及范围证据。原始 `.xls`、`.xlsx`、`.xlsm` 始终禁止提交，除非另行批准受控白名单。
  不得仅凭 F0 状态推断其他 Feature 已启用；根 F5 的可用性由其独立条目、四项验收证据和外部前置条件治理。
- F0 的 `interpretation-rules-v2` 是独立的只读审核子集，仅接受结构化事实并返回规则证据、
  待验证信号与未排序选项。它不读取 Excel、不包含具体案例或计算器、不生成最终解释文本，
  也不改变 `public-v1` 或 `internal-v1`。新增 loader 使用 interpretation evaluation contract schema，
  F0 主行继续保留兼容公共契约；根 F5 通过该规则子集解读受控结构化事实，F5.1 保留为历史
  internal compatible core。RC01、RC02 与其受控选项的来源别名为
  `user-approved-f0-v2-rules-2026-09-08`，表示用户批准的治理规则，不得宣称来自尚未取得的 V4.2
  工作簿。F6 由其独立的受控工件、优化契约与验收门禁启用，并且独占量化 what-if 情境、排序与
  建议值的所有权；不得仅凭 F0 状态或 F0 未排序选项推断 F6 可执行或已完成优化。

F0 内部指导范围与维护边界见 [F0 内部制程公差指导库设计](../superpowers/specs/2026-07-28-f0-internal-tolerance-guidance-design.md) 和 [实施计划](../superpowers/plans/2026-07-28-f0-internal-tolerance-guidance.md)。
F0 解读规则范围与维护边界见 [F0 TA 结果解读规则库设计](../superpowers/specs/2026-07-29-f0-interpretation-rules-design.md) 和 [实施计划](../superpowers/plans/2026-07-29-f0-interpretation-rules.md)。
- F1 的 `available` 仅接受受控的 `confidential` `.xlsx` 字节，并只在受控内存中创建
  worksheet catalog、因子表/公式 cached value/图片元数据证据。它不计算、不换算单位、不 OCR、
  不渲染、不解释风险、不写回、不调用外部服务，也不跟踪或导出原始 `.xlsx`；不得将该状态
  解释为完整 TA 工作流可用。
- F1.7 的 `available` 仅在 F1 输入边界内完成候选因子表识别、字段映射评分与人工确认闸门。
  当关键字段缺失、映射冲突或低置信度时，结果必须进入 `pending_confirmation` 或 `blocked`，
  未确认 worksheet 不得继续下游流程。F1.7 不做工程计算、风险结论、外部调用或 workbook 写回。
- F2.1 的 `available` 只接受已验证的 F1.1 confidential 资产，严格阻断缺失或不可用的九项
  因子字段。Drawing Number 与 DIM/Characteristic ID 仅为非阻断提示；F2.1 不查询能力库、
  不记录例外、不治理 DIM ID、不计算、不解释风险、不写回或调用外部服务。
- F2.2 的 `available` 只接受 ready、内容哈希绑定的 F2.1 结果与同一份 F1.1 confidential
  资产。它仅按类别、`mm` 公差范围和受控 distribution 别名查询批准的公共 F0 快照，输出
  in-library、out-of-library、mismatch 或 unable 信号。所有信号均为非阻断；它不换算单位、
  推断可行性、记录例外、重读 workbook、调用外部服务或写回数据。例外处理由独立的 F2.3
  受限契约承接，不能由 F2.2 自动执行。
- 根 F2 只接受 F1 confidential JSON、MD 和 images artifact bundle，不读取或重跑 workbook。
  九项必填字段与公差路径截面图缺失阻断对应 worksheet；Category/Item Mapping 缺口、唯一 Item
  匹配后的公差/distribution 差异均非阻断。独立 Part Number 与 DIM ID 缺失生成按 category
  汇总的 `adoReminderRequested` 待触发事件，不执行 ADO 调用。执行命令为
  `npm run workflow:f2 -- "test/demo-output/feature1-output/<workbook-safe-name>"`，输出位于
  `test/demo-output/feature2-output/<workbook-base-name>/`。任何 F2 模块验收必须运行完整
  `F0 -> F1 artifacts -> F2` 链路。现行依据见
  [F2 Artifact 报告优化设计](../superpowers/specs/2026-08-03-f2-artifact-report-redesign.md) 和
  [实施计划](../superpowers/plans/2026-08-03-f2-artifact-report-redesign.md)。
- F3 的 `available` 只覆盖 `drawing-governance-v2` 确定性核心、本地 JSON/Markdown artifact workflow
  以及宿主注入的 Surface MCP adapter。当前 Part Number 等同 Drawing Number；正式键为
  `(Drawing Number, DIM ID)`，跨图纸相同 DIM ID 合法，同图纸重复产生 `duplicate_conflict`，
  一位纯数字为不阻塞 TA 的 `suspected_invalid`。Skill 必须先从 F2 `ready` worksheets 中取得至少一个
  用户选择，并以可重复的 `--worksheet <worksheet-name>` 传入本地命令；不带筛选参数的直接 CLI 调用仍处理
  全部 ready worksheets。F3 Markdown 的 Device Level Dim、Dimension Description 和 Factor Description
  只链接 F1 所拥有的 worksheet 图片，`Source Evidence` 显示 worksheet/table/row/field-cell 追溯。
  本地命令为 `npm run workflow:f3 -- "<feature2-artifact-directory>"`。ADO 写入严格执行
  `prepare -> confirm -> execute`；真实写入仍需 Surface MCP capability、策略审批和逐次用户确认。
  无 ADO、负责人、能力、确认或写入失败时保存同一份 confidential 清单并继续 TA。F3 不依赖
  Azure DevOps MCP，不读取日期、不做截止临近判断，也不运行 scheduler。
  F3 治理发布的固定摘要为：用户经 `.github/skills/drawing-governance/SKILL.md` 进入；Question call 1 在
  `Create a new ADO work item` / `Use an existing ADO work item` / `Do not publish to ADO` 中三选一，且
  Surface MCP entity calls may start only after Question call 1 returns；existing 模式必须从 HTTPS ADO work item URL
  解析 organization/project/ID，与 Surface readback 目标一致，且不持久化 URL；校验范围限定为
  Surface MCP-only 的 `organization/project/type or ID` 并允许 candidate correction；新建类型默认
  `Default: Task`；完整预览后再执行 Question call 2 终确认；Comment 与本地提醒模板均固定英文，
  12 列固定表头为 `Worksheet Source | Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Governance issue`；
  用户拒绝/能力不足/写后校验失败分别使用 `user_declined_write`、`surface_mcp_comment_body_unsupported`、
  `write_verification_failed` 并写本地 `Feature3-ADO-Reminder.md`；Bodyless direct comment schemas may use the
  schema-qualified Surface MCP `System.History` channel. Direct comments use `confirmedMarkdownBody`; System.History
  uses `confirmedHistoryHtml` from `Feature3-ADO-History.html`, and one write must produce exactly one new comment with
  comment format `html`, one 12-header payload, counted rows marked `data-f3-factor-row=true`, excluded rows marked
  `data-f3-group-row=true`, matching ADO-safe canonical HTML body/hash, and unchanged `top: 200` readback scope.
  两种正文通道都不合格时必须阻断并拒绝空评论；
  Never use Azure DevOps MCP/REST/browser/shell HTTP；no scheduler/milestone timer，且 no F4 calculation/handoff impact。
- F4 的 `available` 只接受 F1/F2 已验证且内容哈希绑定的 `confidential` 结构化证据。计算版本为
  `excel-ta-v1`：少于 4 个有效因子推荐 WC，4 至 10 个推荐一维 RSS，多于 10 个转介 DM 团队
  跟进 3D Variation Analysis，但三种区间均继续计算 WC 和 RSS。核心支持 Normal、Uniform、
  Triangular、Trapezoidal、Elliptical 和 Beta 六种分布；同一请求中的因子必须使用同一单位。
  TypeScript 结果与批准模板按绝对或相对误差 `1e-12` 验收。What-if 复用同一 calculation kernel，
  工作量 `scenario count × factor count` 不得超过 1000。错误、日志和审计仅返回受控引用与错误码，
  不得泄露原始机密输入值。`approved-windows-excel-worker` 仅用于批准模板的黄金回归、发布门禁和
  差异诊断，不在生产请求热路径中；文档和配置不得记录真实 workbook 路径或 hash。F4 可用本身不启用
  其他 Feature；根 F5 与 F6 均由各自独立治理条目、契约与验收证据启用。
- 根 F5 的 `available` 覆盖能力与规格、主要贡献因子及基于受控证据的公差链有效性解读。直接输入为
  F0 `interpretation-rules-v2`、F1 `worksheet-analysis-assets-v1`、F3 `drawing-governance-v2` 和 F4
  `calculation-service-v1` 工件；从 workbook 启动时必须先通过 F2 门禁。F0 规则引用必须保留规则 ID、
  版本和适用范围。报告固定展示五章节，但仅前三章由 F5 生成，结构性风险和并列改善方案两章明确
  委派给 F6，不得伪造 F6 结果。F1 是 worksheet 图片的唯一物理 owner；缺少 F1 `imageReference`
  或物理图片时对应 worksheet fail closed。存在已验证图片但跳过观察、image mode 不可用或未生成观察
  工件时，确定性解读继续，图片证据标记为 `not_evaluated` 并生成 clarification。图片观察不是 drawing
  truth：必须记录 confidence，任何可用于结构判断的结果都保持 ME review-gated。输出仅使用 `FACT`、
  `RULE`、`SIGNAL`、`OPTION` 四类 statement；未确认假设只记录缺口并阻断依赖结论。受支持入口为
  `workflow:f5` 和触发短语“使用F5分析报告”。F5 不自动发布 ADO、不回写 workbook；工件关联、规则
  追溯、澄清门或 Skill 合同失败时 fail closed。`approved-knowledge-base` 与 `approved-me-review` 不作为
  每次运行的交互参数重复收集；运行时工程复核继续由 `requiresEngineeringReview` SIGNAL、clarification/
  assumption 和不生成无证据最终 RULE 的门禁执行。
- F5.1 的 `available` 是历史 internal compatible core，仅覆盖由 F4 `excel-ta-v1` 结果和 F0 `interpretation-rules-v2` 支持的能力与
  规格、主要贡献因子解读。它保留可追溯 FACT，并仅在 F4 方法为一维 RSS 时生成带 F0 证据的
  RULE、SIGNAL 和未排序 OPTION；WC 和 3D Variation Analysis 场景不得套用 RSS 规则，只能保留
  确定性 FACT 并返回规则不适用或 3D 跟进澄清。F5.1 不判断图纸、公差链、基准链、装配基准面、
  堆叠方向或跨子系统结构风险，也不提供完整澄清流程；调用方应通过根 F5 合同取得完整受治理报告，
  不得把 F5.1 描述为唯一可用 F5 入口。
- F6 的 `available` 仅覆盖当前本地 `f6-optimization-v2` workflow 和最终报告输出。应用入口为
  `node apps/cli/dist/index.js feature6 --root "<repository-root>" --f2-artifacts "<f2-root>" --f3-artifacts "<f3-root>" --f4-artifacts "<f4-root>" --f5-artifacts "<f5-root>" --worksheet "<worksheet-name>"`；
  `--worksheet` 可重复且至少一次，worksheet 名称必须 trim 后非空且唯一。四个 artifact root 必须分别包含
  `Feature2-Report.json`、`Feature3-Report.json`、`Feature4-Calculation.json` 和 `Feature5-Report.json`，并通过
  artifact identity、内容 hash、schema、workbook 与 worksheet association 门禁；不得扫描目录猜测输入。
  可选 `f6-analysis-context-v1` 与 `f6-optimization-targets-v1` 分别经过 `Confirm analysis context` 和
  `Confirm optimization targets` 独立确认后，才可追加 `--analysis-context` 与 `--optimization-targets`。两次确认不得互相合并或与 F3 ADO 确认合并；caller-target scenario 仍要求 confirmed targets。唯一自动例外为 `f6-top3-tolerance-policy-v1`：仅当 CpkL 或 CpkU 低于 worksheet Target Cpk 时，按固定 OP1（25%/10%/10%）、OP2（20%/15%/15%）、OP3（40%/5%/5%）收紧 baseline Top 3 tolerance bands，并通过 F4 完整重算；不得生成其他自动百分比 scenario。supplier capability 与 datum strategy 缺少绑定证据时不得输出已验证可行性；cost 证据缺失、
  身份不一致或未覆盖候选方案时，ROI 必须保持 `not_computed`，不得据此排序或推荐。所有输入、日志、错误、manifest
  与摘要必须遵守 `confidential` 隐私边界，不得泄露 child-process、原始路径或工程值。该确定性 workflow 不写回 workbook、
  不发布 ADO、不执行网络或其他外部写入；相关能力缺失或输出为 `failed`、无效 JSON、多个 JSON 文档时 fail closed。
  历史 `createComparisonPlaceholder`、`comparison-request-v1` 与 `comparison-result-v1` 仅为兼容 API，继续返回
  `status: feature_not_available`，不得将该 placeholder 的不可用状态解释为优化 workflow 不可用。
  Agent Skill 入口“使用F6分析报告”受 `f6-skill-contract-check`、`f0-f6-real-workbook-flow` 和
  `f6-final-report-check` 治理。该入口由 agent 负责 workbook 与 two worksheet confirmations，按 F0-F6
  顺序调用既有确定性 runners；显式 `feature6` CLI 仍只消费 F2-F5 roots 和精确 worksheet set，不得伪装成交互式
  orchestrator。Skill 必须执行并验证 current-run F3，并在 F4、F5 与 F6 完成后让每个已验证 F3 结果进入复用 F3 完整双确认协议的
  optional ADO publishing gate，发布 never automatic or implicit。Skill 展示 F1-F6 output ledger，并在缺少 evidence 时保留
  `insufficient_evidence` / `not_computed`。F6 原子发布 `Feature6-Report.md`、`Feature6-Optimization.json/.md`、`Feature6-Run-Summary.json` 和 `manifest.json`；Run Summary 保存结构化 Workbook/Worksheet dispositions，最终报告使用 `PASS`、`CONDITIONAL_PASS`、`FAIL`、`INCOMPLETE` 四态。ADO gate 的终态进入 review，只记录发布结果，不改变已验证的 F3 分析结果或 worksheet scope。当前入口对历史 V1 F6 artifact 返回受控 unsupported-version，不自动转换或展示。
- F8 与 participant/workbench runtime 已退休，不再作为当前产品 Feature Register 条目。现行入口以 Copilot Skills 与直接 workflow scripts 为准，且不得恢复已删除的 session/runtime/product-export 假设。
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