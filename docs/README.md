# Documentation · 项目文档索引

Surface T/VA Analysis Agent (V1) 的设计文档集。所有图表使用 Mermaid，GitHub 原生渲染。

| # | 文档 | 内容 |
|---|---|---|
| 01 | [系统架构图 · Architecture](01-architecture.md) | V1 端到端系统架构（七层 + 三种输出模式 + 增值能力）|
| 02 | [端到端流程图 · End-to-End Flow](02-end-to-end-flow.md) | 上传 → 清洗 → 方法推荐 → 解读 → 输出 的运行时流程 |
| 03 | [差异化对比 · Differentiation](03-differentiation.md) | 传统 Excel vs 通用 LLM vs 专用 Agent |
| 04 | [功能分解 · Feature Breakdown](04-feature-breakdown.md) | Epic → Feature → Story → Task（对应 Milestones / Issues）|

## 约定

- **范围（V1）：** 不含图纸读取、不含 3D VA。
- **计算引擎：** 1D，**与 T/VA 模板 Excel 公式严格一致**。
- **追踪：** Feature 编号 (F1–F7) ↔ GitHub Milestones；Story / Task ↔ Issues。
