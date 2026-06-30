# Differentiation · 差异化对比

> 传统 TA Excel vs 通用 LLM vs 专用 TA Agent（本项目）。
> 本 Agent 的价值不在"计算自动化"（引擎复用 Excel），而在**有据可依的解读、自动清洗把关、按角色给出可执行工程决策**。

## Three-Way Comparison · 三方对比

| 维度 | 传统 TA Excel | 通用 LLM | 专用 TA Agent（本项目）|
|---|---|---|---|
| **数据清洗** | 靠人工，易错 | 无依据，泛泛而谈 | ① 校验必填项是否缺失（factor description / part name / part category / design nominal / tolerance / long term·safety factor / σ level / distribution）；② 对照按零件分类的通用规范库，判断公差范围与分布是否合理 |
| **方法选择** | 凭经验 | 通用建议无约束 | 按 factor 数规则化推荐合适的目标公差参考；WC 与 RSS 两种方法均计算并生成结果 |
| **计算** | 模板公式可靠 | 易算错 / 不复现 | 复用 Excel 同款引擎，一致 |
| **解读依据** | 个人经验 | 无规则 / 知识库 | TA 专家角色 + 固定 5 段式输出（loop 合理性 / 能力 vs spec / Top 贡献者 / 结构级风险 / 决策建议）|
| **解读结果** | 难标准化、因人而异 | 一次性、不结构化 | 结构化、标准化、可复现 |
| **多页处理** | 人工一页页串行 | 串行、不可控 | 并行加速处理，效率高（审核仍逐页人工把关）|
| **可规模化** | 弱（依赖人力）| 弱（不可信）| 强（标准 / 高效 / 可审计）|
| **定位** | 计算工具 | 一次性辅助 | 标准化解读 + 工程决策助手 |

## One-Line Differentiation · 一句话差异化

> Excel 只解决"算"、通用 LLM 是无依据的一次性工具；专用 Agent 在**可靠引擎之上叠加规则库 + 分类规范库**，给出**结构化、可复现、可执行**的工程决策建议。

---
**相关文档：** [系统架构图](01-architecture.md) · [端到端流程图](02-end-to-end-flow.md) · [功能分解](04-feature-breakdown.md)
