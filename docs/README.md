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

Phase 0 是本地优先、可审计、契约驱动的工程基础，不是 F0-F8 业务功能交付。当前 F0-F7
均不可用，F4 仅返回 `feature_not_available`；F8 仅提供匿名 `public` fixture 的受治理
Skill 运行时验收，不包含真实工作簿、外部 Adapter、模型、ADO、SharePoint 或 UI 行为。

| 文档 | 内容 |
|---|---|
| [Phase 0 设计](superpowers/specs/2026-07-22-ai-assist-agent-foundation-design.md) | 架构、契约、策略门、审计和清理生命周期 |
| [Phase 0 实施计划](superpowers/plans/2026-07-22-ai-assist-agent-foundation.md) | 任务分解、TDD 步骤和质量门 |
| [系统架构](01-architecture.md) | 产品架构与后续业务能力边界 |
| [Feature Register](governance/feature-register.md) | F0-F8 可用性、依赖、契约和禁用行为 |
| [数据分类](governance/data-classification.md) | `public`、`internal`、`confidential`、`secret` 处理规则 |
| [开发协作标准](governance/development-standard.md) | 分支、PR、文档和验收要求 |
| [Phase 0 验收](governance/phase-0-acceptance.md) | Definition of Done、命令、预期结果和安全边界 |

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
