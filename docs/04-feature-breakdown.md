# Feature Breakdown (V1) · 功能分解

> 层级结构：**Epic → Feature → User Story → Task**，附 Risk / Issue 提示。
> Feature 编号 (F1–F7) 与 [GitHub Milestones](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestones) 及 Issues 一一对应。

## Epic

**Surface T/VA 分析 Agent (V1)**

> 战略 / 项目级——把"算 + 经验解读"靠人的 TA，升级为有规则 + 分类规范库支撑、多页高效处理、可给出可执行工程决策的智能助手。

---

## F1 · 报告解析与素材准备

| 类型 | 内容 |
|---|---|
| 📘 Story | 上传 xlsx 自动识别含 TA 内容的 worksheet，无需手动指定 |
| 🔧 Task | 扫描 worksheet · 识别固定布局 · 列出供用户确认 |
| 📘 Story | 多页报告并行加速处理、快速产出（审核仍逐页人工把关）|
| 🔧 Task | 并行调度 · factor 表 (E14:T26) 解析 · Loop 截图抽取 · 汇总 |
| ⚠ Risk | worksheet 命名 / 布局不规范致漏识别 → 兜底人工选择 |

## F2 · 数据清洗（解决"清洗靠人易错"）

| 类型 | 内容 |
|---|---|
| 📘 Story | 校验用户填写信息是否缺失 |
| 🔧 Task | 必填项检查 — factor description / part name / part category / design nominal / tolerance / long term·safety factor / σ level / distribution（drawing number 等可选项缺失仅提示不阻断）|
| 📘 Story | 对照按零件分类的**分类公差能力库**判断合理性 |
| 🔧 Task | 加载分类公差能力库（合理公差带 + 制程能力[来源分级] + 推荐分布）· 公差范围匹配 · 分布合理性判断 · 差异高亮，标注"库内/库外有据" |
| 📘 Story | 差异两种修正：用户改 Excel / Agent 改数据重算 |
| ⚠ Issue | 库为 example 暂不全 → 标注覆盖率；无实测数据(Tier 0)标"制程能力未知" |

## F3 · 方法推荐

| 类型 | 内容 |
|---|---|
| 📘 Story | 按 factor 数量推荐合适的目标公差参考方法 |
| 🔧 Task | 计数 + CTS/CTF 识别 · `<4` 荐 WC · `4-10` 荐 RSS · `>10` 提示转 DM；WC 与 RSS 均计算并生成结果 |

## F4 · 计算引擎（与 Excel 严格一致）

| 类型 | 内容 |
|---|---|
| 📘 Story | 结果可信、可复现 |
| 🔧 Task | 单因子 / 系统级 / 能力复刻 · 样例回归 (Cpk 0.74 / DPM 26500 / FAIL) |

## F5 · 标准化专业解读（TA 专家角色 · 固定 5 段式 · **客观呈现**）

> 立场：只断言 `FACT`（计算）/ `RULE`（阈值对照）；`SIGNAL`（需工程判断）只标注不定性；`OPTION`（可选路径）平行呈现、不排序不推荐——**判断权留用户**。详见 [设计决策 D2/D3](05-design-decisions.md)。

| 类型 | 内容 |
|---|---|
| 📘 Story | **① Loop Validity** — 是否闭环、是否同一 datum chain、**装配基准面/堆叠起点**是否明确（不确定→确认卡）|
| 🔧 Task | 闭环检查 · datum 链一致性 · 装配基准面确认 · 正向叠加 / 反向扣除校验 |
| 📘 Story | **② Capability vs Spec** — RSS σ / Cpk 判定（`<1` FAIL · `1~1.33` 风险 · `≥1.33` PASS），并判断 spec window 是否 `<6σ`（物理不可实现）|
| 🔧 Task | 能力计算 · 阈值判定 · 6σ 可行性检查 |
| 📘 Story | **③ Top Contributors** — 按 %贡献排序，标出 Top 2~3 并给原因（公差大 / 位于 stack 中部放大 / 单向直接作用 output）|
| 🔧 Task | 贡献度排序 · 原因归类 |
| 📘 Story | **④ 结构级风险（SIGNAL，只标注）** — datum 链是否跨体系 (ME/PCBA/Glass)、是否含非纯几何变量 (switch 行程 / foam·adhesive 非线性)、stack 是否过长 (`>10`) |
| 🔧 Task | 跨体系识别（查库3本体）· 非几何变量标记 · 长 stack 预警 |
| 📘 Story | **⑤ 可选路径（OPTION，不排序）** — 平行列出 A 保持设计 / B 调整 Spec / C 优化 Capability 及各自量化后果；CTF 允许 spec↔yield trade-off，CTS 禁止放宽只能优化 design/process；结尾一句话**事实**总结 |
| 🔧 Task | 三路径量化 · CTS/CTF 规则约束 · 事实总结（不给推荐动作）|
| ⚠ Risk | 解读幻觉 → 断言标签制 + 强制引用规则/数据来源 + 不确定弹确认卡（Fail-closed）|

## F6 · What-if 敏感度 / Spec 反解 / 居中分析（高价值决策）

| 类型 | 内容 |
|---|---|
| 📘 Story | What-if 模拟：量化"收紧某件后 Cpk 变多少"，把根因变可量化数字 |
| 🔧 Task | 单件公差扰动 · 重算 Cpk · 输出前后对比 |
| 📘 Story | **Spec 反解**：基于 Top contributors 给 2–3 并列方案（单点收紧 / Top2-3 组合 / 居中+收紧），各含新公差、达成 Cpk、可行性 |
| 🔧 Task | 计算所需 σ 削减量 · 生成 2-3 方案 · **超制程可达→红色预警**（对照库1 制程能力）|
| 📘 Story | 均值居中分析：检测 nominal 偏置，给出零成本居中收益 |
| 🔧 Task | 偏置检测 · 居中后 Cpk 重算 · 输出 |

## F7 · 输出报告

| 类型 | 内容 |
|---|---|
| 📘 Story | 含 Loop 图的完整解读报告 |
| 🔧 Task | 整合输出 |

---
**相关文档：** [系统架构图](01-architecture.md) · [端到端流程图](02-end-to-end-flow.md) · [差异化对比](03-differentiation.md) · [设计决策](05-design-decisions.md)
