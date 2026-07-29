# AI Assist Agent

An AI agent that automates **Tolerance Analysis (TA)** interpretation for the
Microsoft Surface program and its downstream ODM / supplier partners.

The agent ingests a filled-in TA template (`.xlsx`), reuses the exact calculation engine of the
Excel template, and produces **standardized, evidence-backed engineering decisions** — instead of
relying on individual engineers' experience.

## Two Core Highlights

1. **Process automation** — Manual TA workbook upload, optional ADO governance, **server-side scheduled reminders** for linked ADO items (independent of whether the agent is running), and measured-data backfill connect **design ⇄ analysis ⇄ real data** into a traceable closed loop.
2. **Data interpretation** — objective, evidence-backed **5-section** reading (every RULE cites a knowledge-base entry), with the final judgment left to the engineer.

> **Scope.** Drawing-content image understanding, OCR, dimension recognition, and 3D VA are out of scope for now. F1.1 may register embedded-image metadata and return hash-gated raw bytes, but it does not interpret image content. Data-to-drawing linking is done via **DIM ID metadata** (not image recognition).

## Documentation

Full design docs live in [`docs/`](docs/README.md) (Mermaid diagrams render natively on GitHub):

- [00 · Overview](docs/00-overview.md)
- [01 · System Architecture](docs/01-architecture.md)
- [02 · End-to-End Flow](docs/02-end-to-end-flow.md)
- [03 · Differentiation](docs/03-differentiation.md)
- [04 · Feature Breakdown](docs/04-feature-breakdown.md)
- [05 · Design Decisions (D1–D8)](docs/05-design-decisions.md)
- [06 · System Architecture Visual](docs/06-system-architecture-visual.html)
- [07 · Proposed Roadmap 2026H2](docs/07-proposed-roadmap-2026H2.html)
- [中文文档索引](docs/README.md)

## Phase 0 工程基座

Phase 0 建立面向产品路线图的本地优先、可审计 TypeScript 工程基础。F0 保留匿名
`public-v1` 的本地只读知识库查询，并已发布经审查的 `internal-v1` 公差指导快照与
`interpretation-rules-v1` TA 结果解读规则快照。三个模块通过独立 loader 并列存在：
`loadKnowledgeBase`、`loadInternalToleranceGuidance` 和 `loadInterpretationRules`，互不替换或
扩展彼此的查询语义。制程指导结果
仅为 `guidance-exceeded`、`within-guidance` 或 `unknown`，不声明能力紧度或可制造性。该快照
保留来源文件 hash、工作表和单元格范围。解读规则快照只包含审核后的通用 `internal` 子集，
不包含 worked examples 或计算器；原始能力矩阵、TA 模板与规则工作簿仍不进入 Git。F5/F6
保持 `unavailable`，发布规则依赖不表示解释或推荐能力已经启用。F1 仅接受受控 `confidential` `.xlsx` 字节，创建只读
worksheet catalog，并从 catalog 确认的 worksheet 提取因子表、公式及缓存值、嵌入图片元数据，
图片字节只可由 workbook hash 与唯一 image hash 共同验证后读取。F1 不计算公式、不换算单位、
不执行 OCR、渲染、风险解释、行动建议或 workbook 写回，也不调用外部服务、不跟踪或导出原始
`.xls`、`.xlsx` 或 `.xlsm`（除非另行批准受控白名单）。F2.1 只接受 F1.1 confidential 资产，对九项必填因子字段执行严格完整性阻断；
Drawing Number 与 DIM/Characteristic ID 只形成非阻断提示。F2.2 仅在 F2.1 ready 且内容哈希绑定时，
按类别、`mm` 公差范围和受控 distribution 别名与 F0 比对；所有差异均为非阻断信号。F2.3
提供受限的非阻断例外处理，F2.4 提供标识符质量检查；根 F2 和 F3-F7 保持不可用，F4 返回
`feature_not_available`，F8 仅限用于受治理 Skill 运行时验收的匿名 `public`
fixture。此阶段不包含真实工程知识、外部 Adapter、模型、ADO、SharePoint 或 UI 行为。

- [Phase 0 设计](docs/superpowers/specs/2026-07-22-ai-assist-agent-foundation-design.md)
- [Phase 0 实施计划](docs/superpowers/plans/2026-07-22-ai-assist-agent-foundation.md)
- [F0 知识库设计](docs/superpowers/specs/2026-07-22-f0-knowledge-base-design.md)
- [F0 知识库实施计划](docs/superpowers/plans/2026-07-22-f0-knowledge-base.md)
- [F0 内部制程公差指导库设计](docs/superpowers/specs/2026-07-28-f0-internal-tolerance-guidance-design.md)
- [F0 内部制程公差指导库实施计划](docs/superpowers/plans/2026-07-28-f0-internal-tolerance-guidance.md)
- [F0 TA 结果解读规则库设计](docs/superpowers/specs/2026-07-29-f0-interpretation-rules-design.md)
- [F0 TA 结果解读规则库实施计划](docs/superpowers/plans/2026-07-29-f0-interpretation-rules.md)
- [F1 工作簿目录设计](docs/superpowers/specs/2026-07-23-f1-workbook-catalog-design.md)
- [F1 工作簿目录实施计划](docs/superpowers/plans/2026-07-23-f1-workbook-catalog.md)
- [F1.1 工作表资产提取设计](docs/superpowers/specs/2026-07-24-f1-1-worksheet-analysis-assets-design.md)
- [F1.1 工作表资产提取实施计划](docs/superpowers/plans/2026-07-24-f1-1-worksheet-analysis-assets.md)
- [F1.7 因子表语义识别与人工确认设计](docs/superpowers/specs/2026-07-29-f1-7-semantic-table-detection-design.md)
- [F1.7 因子表语义识别与人工确认实施计划](docs/superpowers/plans/2026-07-29-f1-7-semantic-table-detection-implementation.md)
- [F2.1 必填字段严格校验设计](docs/superpowers/specs/2026-07-27-f2-1-required-field-validation-design.md)
- [F2.1 必填字段严格校验实施计划](docs/superpowers/plans/2026-07-27-f2-1-required-field-validation.md)
- [F2.2 能力库与分布一致性校验设计](docs/superpowers/specs/2026-07-27-f2-2-capability-distribution-validation-design.md)
- [F2.2 能力库与分布一致性校验实施计划](docs/superpowers/plans/2026-07-27-f2-2-capability-distribution-validation.md)
- [F2.3 非阻断差异例外处理设计](docs/superpowers/specs/2026-07-27-f2-3-exception-resolution-design.md)
- [F2.3 非阻断差异例外处理实施计划](docs/superpowers/plans/2026-07-27-f2-3-exception-resolution.md)
- [系统架构](docs/01-architecture.md) 与 [Feature Register](docs/governance/feature-register.md)
- [数据分类](docs/governance/data-classification.md) 与 [开发协作标准](docs/governance/development-standard.md)
- [Phase 0 验收](docs/governance/phase-0-acceptance.md)

---

## Positioning

**Objective evidence provider + verifiable decision support** — not a black-box adviser.
Every statement is tagged **FACT** (computed) / **RULE** (threshold check) → asserted, or
**SIGNAL** (needs engineering judgment) / **OPTION** (parallel path) → flagged only. Options are
presented in parallel and **not ranked**; the final judgment stays with the engineer. When evidence
is insufficient (e.g. the assembly datum face), the agent **stops and asks** instead of guessing
(fail-closed).

---

## Why an Agent (not Excel, not a generic LLM)

In process-flow order. See [full table](docs/03-differentiation.md).

| Stage | Dimension | Traditional TA Excel | Generic LLM | **AI Assist Agent** |
|---|---|---|---|---|
| **F0 · Knowledge base** | Basis | Lives in the engineer's head | No grounding | 3 controlled libraries; every judgment traces to a library entry |
| **F1 · Report parsing & asset prep** | Input prep | Manual worksheet review | No reliable extraction | Auto-detect TA worksheets, process selected sheets in parallel, and extract Loop screenshots |
| **F2 · Data cleansing** | Data cleansing | Manual, error-prone | No basis | Missing-field + DIM ID check + per-category **Capability Library** validation |
| **F3 · DIM-to-drawing linking** | Data-to-drawing | Manual, ambiguous | Cannot link | Anchor each factor to a drawing dimension by **DIM ID** (metadata, not image reading); missing IDs are grouped by category/drawing. ADO governance is optional: linked items receive owner reminders; otherwise the list is saved locally. |
| **F4 · Method recommendation / calculation** | Calculation | Reliable formulas | Often wrong / non-reproducible | Reuses the **same Excel engine** and selects WC or RSS by factor count |
| **F5 · Data interpretation** | Interpretation | Personal experience | No rules / knowledge base | Fixed **5-section** output, **objective, each RULE cites its F0 entry**, judgment left to user |
| **F6 · Optimization** | Tolerance optimization | Manual re-runs | Cannot compute | Mean-shift centering + contribution economics + RSS apportionment + **spec reverse-solve** (over-capability warning) |
| **F7 · Closed loop** | Real Cpk | Measured data never returns | None | Backfill measured Cpk by DIM ID → **real gap vs estimate** + library **T3 empirical → T1 measured** |
| **F8 · Interaction / output** | User trust | Read raw Excel yourself | Chat only | Read-only faithful evidence pane + cited dialogue + consolidated report |
| Global | Result | Hard to standardize | One-off, unstructured | Structured, standardized, traceable |

---

## Knowledge Base (3 classes — the soul, F0)

The knowledge base is what gives TA its soul: without it, cleansing has no yardstick, interpretation has no basis, optimization has no cost view.

1. **Classified Capability Library** — reasonable tolerance band + process capability (**source-tiered** T1 measured/PPAP → T3 empirical → T0 no-data) + recommended distribution.
2. **Engineering Rules Library** — CTS = 6σ / CTF = 4σ / Cpk ≥ 1.33 (distribution factors are engine constants, not stored here).
3. **Terminology / Ontology Library** — part-category vocabulary / subsystem (ME·PCBA·Glass) / datum.

Human-curated with source / confidence / coverage. T0 (no data) is marked "capability unknown, confirm with supplier" — never asserted feasible. **Fed by the F7 closed loop** so it improves over time.

---

## Calculation Engine (reverse-engineered from the template, kept strictly consistent)

**Per factor (rows 14–26, up to 13 factors):**

| Quantity | Formula |
|---|---|
| Mean (P) | `IF(nominal<0,(J-K+J-L)/2, J+(K+L)/2)` |
| Tolerance (Q) | `(K-L)/2` |
| 1σ (R) | `((K-L)/2)×(M/N)×C` — M=long-term/safety factor, N=σ level, C=distribution factor |
| % contribution (S) | `R² / RSS²` |

**Distribution factor C:** Normal 1 · Uniform 1.732 · Triangular 1.225 · Trapezoidal 1.369 ·
Elliptical 1.5 · Beta 2.023

**System level:**

- RSS 1σ (statistical) = `√(ΣR²)` · Worst Case (arithmetic) = `ΣQ`
- `Cp = (USL−LSL)/6σ` · `Cpk = MIN((mean−LSL)/3σ, (USL−mean)/3σ)`
- `Z = (mean−limit)/σ` · `DPM = (1−NORMSDIST(Z))×10⁶` · Target `Cpk = target σ / 3`

**Sample regression check:** RSS σ = 0.045 · Cpk = 0.74 · Total DPM ≈ 26,500 · verdict **FAIL** —
matches the template exactly.

---

## Scope (Epic → User Story → Feature → Task)

**Epic:** AI Assist Agent

| Feature | Summary |
|---|---|
| **F0 Knowledge base** ⭐ | 3-class library: Classified Capability Library (source-tiered) / Engineering Rules / Terminology·Ontology — the soul |
| **F1 Report parsing & asset prep** | Manual upload; auto-detect TA worksheets; parallel processing; factor-table parse (E14:T26); extract Loop screenshot |
| **F2 Data cleansing** ⭐ | Missing required-field + DIM ID check; per-category Capability Library & distribution validation; source-Excel correction or recorded exception |
| **F3 DIM-to-drawing linking (DIM ID)** ⭐ | Anchor each factor to a drawing dimension by DIM ID (metadata, not image reading); group missing DIM ID/PN items by part category and drawing, keeping each item traceable to its source location; for a linked ADO item, confirmation sends an owner reminder and writes the list to Comment 0; without ADO, save the list locally |
| **F4 Method recommendation / calculation** | Factor count + CTS/CTF; `<4`→WC, `4–10`→RSS, `>10`→notify DM for 3D VA follow-up; F4 continues to compute both WC and RSS |
| **F5 Data interpretation** ⭐ | Fixed 5-section output — **objective (FACT/RULE/SIGNAL/OPTION)**, each RULE cites its F0 entry; clarification card when uncertain |
| **F6 Tolerance / dimension-chain optimization** ⭐ | Mean-shift centering + contribution economics + RSS apportionment + spec reverse-solve (over-capability warning) |
| **F7 Closed-loop real-Cpk feedback** ⭐ | Backfill measured Cpk by DIM ID → real gap vs estimate + upgrade library T3→T1. Reads in via manual import from a **centralized measured-data store (SharePoint / platform)** that must be set up out-of-band (external prerequisite) |
| **F8 User interaction / read-only pane + output** ⭐ | Read-only faithful evidence pane + cited dialogue + consolidated report incl. Loop image |

### F5 — Fixed 5-section interpretation (objective; judgment left to user)
1. **Loop validity** — closed loop? same datum chain? **assembly datum face / stack start** clear? (if uncertain → clarification card)
2. **Capability vs Spec** — RSS σ / Cpk (`<1` FAIL · `1–1.33` risk · `≥1.33` PASS); spec window `<6σ` physically infeasible?
3. **Top contributors** — ranked by % contribution; Top 2–3 with cause (large tol / mid-stack amplification / direct single-direction effect)
4. **Structural risk (SIGNAL, flag only)** — cross-domain datum chain (ME/PCBA/Glass); non-geometric variables (switch travel, foam/adhesive); over-long stack (`>10`)
5. **Options (OPTION, not ranked)** — A keep design / B adjust spec / C optimize capability, each with quantified consequence; CTF allows spec↔yield trade-off, CTS forbids loosening spec; one-line **FACT** summary (no recommended action)

---

## Out of Scope (for now)

Deferred until there is a proven need; each can be merged into the product later.

- Drawing-content **image** reading (extract nominal/tol from 2D drawings/PDF)
- Three-way consistency (user ⇄ drawing ⇄ knowledge base)
- DM-owned 3D VA (VSA-class tool integration)
- **Automatic API capture** of measurement data (the loop is proven first via manual import from the centralized store)
- Write-back to Excel (Auto Summary / suggested spec)
- Monte Carlo (Quantum XL) integration

---

## Repository Notes

## Dual Markdown Export (A=Actual, D=Display)

For worksheet evidence review, use the reusable dual-track exporter:

- `npm run export:dual-md` writes to `test/demo-output/full-tables-md-dual/`
- `npm run export:dual-md:lite` writes to `test/demo-output/full-tables-md-lite/`

Output markdown preserves worksheet grid structure and shows:

- single value when actual and display values are identical
- `A:... / D:...` when actual (`Value2`) and display (`Text`) differ

## Feature 1 Reusable Workflow

Feature 1 parsing and asset-prep can be invoked as a reusable workflow over uploaded TA workbooks.

1. Terminal workflow command:
	- `npm run workflow:f1`
	- Output: `test/demo-output/feature1-validation/latest.md` and `test/demo-output/feature1-validation/latest.json`
2. CLI command:
	- `node apps/cli/dist/index.js feature1 --root .`
3. Phrase alias (agent trigger):
	- `用feature 1来解析报告`

The workflow executes Task 1.1-1.7 with real workbook inputs and emits a final review report including scan, selection, parallel page status, Task 1.5/1.6/1.7 outputs, and real system signals.

- `test/` and all `*.xlsx` (confidential templates / sample data) are **git-ignored**.
- Internal `*.html` design reports are **git-ignored** and not committed.
- Project planning is tracked via GitHub **Project #1** as four ME User Stories, Feature issues (F0-F8), and implementation tasks in each Feature checklist.

---

*Microsoft Confidential — engine reverse-engineered from template M1160113 REV_D.*
