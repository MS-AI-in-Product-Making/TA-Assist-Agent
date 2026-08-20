# Documentation Index

Design document set for AI Assist Agent (V1). All diagrams use Mermaid and render directly on GitHub.

| No. | Document | Content |
|---|---|---|
| 00 | [Overview](00-overview.md) | One-page What / Why / How and business value |
| 00-CN | [Overview (Chinese)](00-概览.md) | Chinese translation of the overview |
| 01 | [Architecture](01-architecture.md) | V1 end-to-end architecture (knowledge base + DIM ID linking + optional ADO governance + calculation engine + output modes + closed loop) |
| 01-CN | [Architecture Mapping (Chinese)](01-架构映射.md) | Chinese mapping of the V1 architecture diagram and layer responsibilities |
| 02 | [End-to-End Flow](02-end-to-end-flow.md) | Runtime flow: manual upload → optional ADO link → cleansing → DIM ID linking → method recommendation → interpretation → output → measured-data closed loop |
| 03-CN | [Differentiation (Chinese)](03-差异化.md) | Chinese translation of the differentiation comparison |
| 03 | [Differentiation](03-differentiation.md) | Traditional Excel vs. general LLM vs. dedicated Agent |
| 04-CN | [Feature Breakdown (Chinese)](04-功能拆分.md) | Chinese translation of Epic → User Story → Feature → Task |
| 04 | [Feature Breakdown](04-feature-breakdown.md) | Epic → User Story → Feature → Task (mapped to Milestones / Issues) |
| 05-CN | [Design Decisions (Chinese)](05-设计决策.md) | Chinese translation of V1 design decisions |
| 05 | [Design Decisions](05-design-decisions.md) | Three knowledge bases, objective interpretation, clarification card, spec reverse-solve, read-only evidence pane, DIM ID linking (D7), measured closed loop (D8) |
| 06 | [System Architecture Visual](06-system-architecture-visual.html) | Dark-theme visual architecture board (high-level + detailed flow), suitable for review screenshots |
| 07 | [Proposed Roadmap 2026H2](07-proposed-roadmap-2026H2.html) | Management-facing roadmap aligned to proposed milestones (planning/design/develop/test/release/launch), covering information gathering, program development, and feature delivery |

## Phase 0 工程基座

Phase 0 是本地优先、可审计、契约驱动的工程基础，不是 F0-F8 业务功能交付。F0 提供三个
独立只读模块：匿名 `public-v1` 查询、`internal-v1` 制程公差指导，以及审核后的
`interpretation-rules-v1` 通用解读规则。原始模板、规则工作簿和案例保持 `confidential` 且
不进入 Git；F1
仅接受受控 `confidential` `.xlsx` 字节，创建只读 worksheet catalog，并从 catalog 确认的
worksheet 提取因子表、公式及缓存值、嵌入图片元数据；图片字节必须由 workbook hash 与唯一
image hash 共同验证后读取。F1 不计算公式、不换算单位、不 OCR、不渲染、不输出风险解释或
行动建议，也不写回 workbook、不调用外部服务、不跟踪或导出原始 `.xlsx`。根 F2 已可用：
它只消费 F1 的 JSON、MD 和 images artifact bundle，按 worksheet 隔离检查九项必填字段与公差路径截面图；
F0 Mapping 缺口、公差推荐差异和 distribution 差异均非阻断。独立 Part Number 与
DIM/Characteristic ID 缺失形成 `adoReminderRequested` 待触发事件；本阶段不调用 ADO。
F2.1-F2.4 继续提供严格完整性阻断、非阻断一致性信号、受限例外处理与标识符质量检查。F4 已启用
受治理的 `excel-ta-v1` 纯计算核心：少于 4 个因子推荐 WC，4 至 10 个推荐 RSS，多于 10 个转介
DM 团队进行 3D 分析，同时始终计算 WC/RSS；支持六种受控分布、同单位输入、绝对或相对误差
`1e-12` 的批准模板回归，以及复用同一 kernel 且工作量不超过 1000 的 What-if。错误不得泄露
机密输入。Windows Excel Worker 仅用于发布黄金回归，不在生产热路径中。F3 已启用
`drawing-governance-v2` 本地治理核心和受控 Surface MCP adapter，真实 Comment 0 写入仍需
capability、策略审批和逐次用户确认。根 F5 现为 staged `available`，提供受治理的完整解读
workflow；F5.1 保留为受 F4/F0 证据约束的 compatibility core，不代表独立的完整工作流状态。
历史 `f5-image-observation-v1` artifact 仅只读兼容；新 image mode 只创建 v2。每个 selected worksheet
必须完整覆盖五项 core scope 与全部 active factor rows；visual FACT 和要求 ME review 的
`image_text_context_review` SIGNAL 分层保存，direction 仅通过结构化 `linkedVisualLabels` 映射，
不得使用自由文本推断。V2 以 immutable UUID-scoped 目录单次创建，并在 invocation 前 readback。Loader 校验
exact content against schema、workbook/worksheet identity 与 selected set、snapshot/source provenance、携带的
`imageReference` identity，并重新校验物理 F1 image SHA-256。Observation artifact 不存在可预先校验的自身
digest；接受后由 workflow runner 计算其 SHA-256 并记录到 `Feature5-Run-Summary`。Observation-only 失败整件
回退到 deterministic F5，baseline identity 错误 fail closed。
F6 已作为 F5 后的本地 `f6-optimization-v2` workflow 启用，消费 F2/F3/F4/F5 受控工件并原子发布 `Feature6-Report.md`、`Feature6-Optimization.json/.md`、`Feature6-Run-Summary.json` 和 `manifest.json`；Run Summary 保存结构化 Workbook/Worksheet dispositions；F7 仍为 `unavailable`。历史 F6 comparison placeholder 继续单独返回 `feature_not_available`；F8 仅提供匿名
`public` fixture 的受治理 Skill 运行时验收，不包含外部 Adapter、模型、ADO、SharePoint 或 UI 行为。

| 文档 | 内容 |
|---|---|
| [Phase 0 设计](superpowers/specs/2026-07-22-ai-assist-agent-foundation-design.md) | 架构、契约、策略门、审计和清理生命周期 |
| [Phase 0 实施计划](superpowers/plans/2026-07-22-ai-assist-agent-foundation.md) | 任务分解、TDD 步骤和质量门 |
| [F0 知识库设计](superpowers/specs/2026-07-22-f0-knowledge-base-design.md) | F0 本地匿名公共只读查询能力、Git/PR 维护边界和契约 |
| [F0 知识库实施计划](superpowers/plans/2026-07-22-f0-knowledge-base.md) | F0 实施任务、TDD 步骤和质量门 |
| [F0 内部制程公差指导库设计](superpowers/specs/2026-07-28-f0-internal-tolerance-guidance-design.md) | 内部制程指导、来源证据和单向筛查边界 |
| [F0 TA 结果解读规则库设计](superpowers/specs/2026-07-29-f0-interpretation-rules-design.md) | 独立解读规则快照、F5/F6 未来消费和保密边界 |
| [F0 TA 结果解读规则库实施计划](superpowers/plans/2026-07-29-f0-interpretation-rules.md) | 解读规则契约、快照、查询、治理与验证任务 |
| [F1 工作簿目录设计](superpowers/specs/2026-07-23-f1-workbook-catalog-design.md) | F1 受控机密字节、只读 worksheet catalog 和隐私边界 |
| [F1 工作簿目录实施计划](superpowers/plans/2026-07-23-f1-workbook-catalog.md) | F1 实施任务、TDD 步骤和质量门 |
| [F1.1 工作表资产提取设计](superpowers/specs/2026-07-24-f1-1-worksheet-analysis-assets-design.md) | catalog 绑定的因子表、公式缓存和图片证据边界 |
| [F1.1 工作表资产提取实施计划](superpowers/plans/2026-07-24-f1-1-worksheet-analysis-assets.md) | F1.1 实施任务、TDD 步骤和质量门 |
| [F1.7 因子表语义识别与人工确认设计](superpowers/specs/2026-07-29-f1-7-semantic-table-detection-design.md) | 不依赖固定区域的候选识别、置信度评分、确认闸门 |
| [F1.7 因子表语义识别与人工确认实施计划](superpowers/plans/2026-07-29-f1-7-semantic-table-detection-implementation.md) | F1.7 契约、服务、治理与演示任务分解 |
| [F2.1 必填字段严格校验设计](superpowers/specs/2026-07-27-f2-1-required-field-validation-design.md) | 基于 F1.1 证据的九项严格阻断与两项 ID 提示 |
| [F2.1 必填字段严格校验实施计划](superpowers/plans/2026-07-27-f2-1-required-field-validation.md) | F2.1 实施任务、TDD 步骤和质量门 |
| [F2.2 能力库与分布一致性校验设计](superpowers/specs/2026-07-27-f2-2-capability-distribution-validation-design.md) | 基于 ready F2.1 证据的非阻断能力库与 distribution 比对 |
| [F2.2 能力库与分布一致性校验实施计划](superpowers/plans/2026-07-27-f2-2-capability-distribution-validation.md) | F2.2 契约、F0 查询、治理和质量门 |
| [F2.3 非阻断差异例外处理设计](superpowers/specs/2026-07-27-f2-3-exception-resolution-design.md) | 基于 completed F2.2 信号的纯例外覆盖解析 |
| [F2.3 非阻断差异例外处理实施计划](superpowers/plans/2026-07-27-f2-3-exception-resolution.md) | F2.3 契约、纯服务、治理和质量门 |
| [F2 Initial 工作流设计](superpowers/specs/2026-08-03-f2-initial-workflow-design.md) | F0/F1/F2 worksheet 隔离、Mapping 与阻断语义 |
| [F2 Initial 实施计划](superpowers/plans/2026-08-03-f2-initial-workflow.md) | F2 Initial TDD、CLI、报告与完整链路验收 |
| [F2 Artifact 报告优化设计](superpowers/specs/2026-08-03-f2-artifact-report-redesign.md) | F1 artifact 输入、增强 raw-data 报告与 ADO 事件边界 |
| [F2 Artifact 报告实施计划](superpowers/plans/2026-08-03-f2-artifact-report-redesign.md) | Artifact loader、用户报告契约、CLI 与真实 demo |
| [F5 Workbook 完整编排设计](superpowers/specs/2026-08-12-f5-workbook-end-to-end-orchestration-design.md) | F0-F5 完整链路、双 worksheet 确认和 fail-closed 边界 |
| [F5 Workbook 完整编排实施计划](superpowers/plans/2026-08-12-f5-workbook-end-to-end-orchestration.md) | F3/F5 skill 合同、文档回归和真实 workbook 验收步骤 |
| [F5 图文联合图片观察 v2 设计](superpowers/specs/2026-08-12-f5-contextual-image-observations-design.md) | v1 只读兼容、五项 scope、全 active-row snapshot 与 visual/context evidence 分层 |
| [F5 图文联合图片观察 v2 实施计划](superpowers/plans/2026-08-14-f5-contextual-image-observations-v2.md) | v2 contracts、loader 校验、报告、Skill protocol 与回归任务 |
| [F6 最终公差分析报告模板接入设计](superpowers/specs/2026-08-20-f6-final-report-template-design.md) | 五文件输出契约、最终报告模板、Run Summary dispositions 与既有 artifact 快速验证 |
| [F6 最终公差分析报告模板接入实施计划](superpowers/plans/2026-08-20-f6-final-report-template.md) | final report projection、runner wiring、旧报告 runtime 退役、文档迁移与最终验证 |
| [F4 计算引擎设计](superpowers/specs/2026-07-30-f4-calculation-engine-design.md) | 方法推荐、Excel 一致计算、What-if、隐私与黄金回归边界 |
| [F4 计算引擎实施计划](superpowers/plans/2026-07-30-f4-calculation-engine.md) | F4 契约、kernel、服务、回归、治理和质量门 |
| [系统架构](01-architecture.md) | 产品架构与后续业务能力边界 |
| [Feature Register](governance/feature-register.md) | F0-F8 可用性、依赖、契约和禁用行为 |
| [数据分类](governance/data-classification.md) | `public`、`internal`、`confidential`、`secret` 处理规则 |
| [开发协作标准](governance/development-standard.md) | 分支、PR、文档和验收要求 |
| [Phase 0 验收](governance/phase-0-acceptance.md) | Definition of Done、命令、预期结果和安全边界 |

单 workbook 先执行 prompt phase：`npm run workflow:f2:excel -- "test/<workbook.xlsx>"`。用户选择至少一个 worksheet 后，使用 prompt 返回的 hash 执行 confirm phase：`npm run workflow:f2:excel -- "test/<workbook.xlsx>" --worksheets "Analysis-A,Analysis-B" --workbook-hash "<sha256>" --confirm`。confirmed run 在独立受控目录中依次生成并验证 F1/F2 artifacts；F3/F5 不得跳过该握手。

F2 任一模块验收必须运行完整 `F0 -> F1 artifacts -> F2` 链路。

F6 在 F5 后运行。直接入口为 `npm run workflow:f6 -- "<f2-root>" "<f3-root>" "<f4-root>" "<f5-root>" --worksheet "<name>"`；app CLI 使用 `feature6 --root ... --f2-artifacts ... --f3-artifacts ... --f4-artifacts ... --f5-artifacts ... --worksheet ...`，并固定发布到 `test/demo-output/f6-runs/<F5-root-name>/<UTC-run-id>/`。可选 evidence 为 supplier capability、datum strategy、cost 和 image observations。完整参数、六件套 artifact、identity/hash/atomic gates，以及 confidential/read-only/no ADO/network/workbook-write 边界见 [Feature Register](governance/feature-register.md)。

## Shared Conventions

- **V1 scope:** No drawing image recognition and no 3D VA. Data-to-drawing linking is done through **DIM ID** (F3); more than 10 factors are referred to the DM team for 3D VA. The measured-data closed loop (F7) first imports data manually from a centralized store (SharePoint / platform), which is an external prerequisite outside the project's control.
- **Calculation engine:** One-dimensional, and **fully consistent** with the Excel formulas in the TA template.
- **Tracking:** Four ME User Stories group the work; Feature IDs (F0-F8) map to GitHub Feature issues and their task checklists map to implementation work items.
- **Reminder timing:** When an ADO item is linked, a server-side service periodically checks program milestones and reminds the owner to complete missing information **before a key milestone (e.g. EV1)**.

## Terminology

To avoid ambiguity, the following terms are used consistently across all documents:

- **Factor**: Each dimension entry in the TA report that participates in the dimension-chain calculation.
- **Part**: The physical component a factor corresponds to.
- **Owner**: The responsible person determined from the ADO work item fields.
- **DIM ID**: An existing dimension identifier in the TA template, used as the unique key that links a factor to a drawing dimension.
- **Three knowledge bases**: Capability Library (Lib 1), Rules Library (Lib 2), Terminology Library (Lib 3).
- Technical abbreviations kept in their standard form: Cpk, RSS, WC, σ, DPM, CTS, CTF, ADO, EV1, PPAP, xlsx, etc.
