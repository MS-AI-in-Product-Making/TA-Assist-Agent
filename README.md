# AI Assist Agent

An AI agent that automates **Tolerance Analysis (TA)** interpretation for the
Microsoft Surface program and its downstream ODM / supplier partners.

The agent ingests a filled-in TA template (`.xlsx`), reuses the exact calculation engine of the
Excel template, and produces **standardized, evidence-backed engineering decisions** — instead of
relying on individual engineers' experience.

## Two Core Highlights

1. **Process automation** — Manual TA workbook upload, optional ADO governance, **server-side scheduled reminders** for linked ADO items (independent of whether the agent is running), and measured-data backfill connect **design ⇄ analysis ⇄ real data** into a traceable closed loop.
2. **Data interpretation** — objective, evidence-backed **5-section** report: F5 owns the first three sections and delegates the last two to F6; every RULE cites a versioned, scoped F0 entry and final judgment stays with the engineer.

> **Scope.** Automatic extraction of drawing truth, OCR, dimension recognition, and 3D VA are out of scope for now. F1 owns hash-gated worksheet images. Historical F5 image-observation v1 artifacts are read-only; new image mode creates v2 only, separating visual FACTs from ME-review-gated image-plus-text SIGNALs. Data-to-drawing linking is done via **DIM ID metadata**.

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
不包含 worked examples 或计算器；原始能力矩阵、TA 模板与规则工作簿仍不进入 Git。根 F5 已按
`f5-data-interpretation-request-v1` / `f5-data-interpretation-result-v1` 已启用；F6 也已通过独立治理门启用
`f6-optimization-v2` 本地 workflow 和 `Feature6-Report.md` 最终报告。F1 仅接受受控 `confidential` `.xlsx` 字节，创建只读
worksheet catalog，并从 catalog 确认的 worksheet 依据语义表头提取因子表、公式及缓存值、嵌入图片元数据，
图片字节只可由 workbook hash 与唯一 image hash 共同验证后读取。F1 不计算公式、不换算单位、
不执行 OCR、渲染、风险解释、行动建议或 workbook 写回，也不调用外部服务、不跟踪或导出原始
`.xls`、`.xlsx` 或 `.xlsm`（除非另行批准受控白名单）。根 F2 已可用：它只接受 F1 落盘的 JSON、MD 和 images artifact bundle，
不读取或重新解析 Excel；F1 是 worksheet 图片证据的唯一生产者和物理所有者，F2 只保存经 hash 校验的 F1 image reference 并在 Markdown 中生成相对链接，不复制或重新生成图片。F2 原样展示 F1 保存的 Response Summary `sourceLabel`，不自定义缩写或名称；`1σ` 与 `% Cont. to σ` 从 F1 semantic artifact 的公式 cached values 投影，不由 F2 重新计算。F2 按 worksheet 隔离检查因子必填字段、公差路径截面图，以及 Response Summary 中的 Lower Spec Limit、Upper Spec Limit 和 Target σ Level。F0 Category/Item
Mapping 缺口及唯一匹配后的公差/distribution 差异均以增强 raw-data 表中的非阻断差异展示。
独立 Part Number 与 DIM/Characteristic ID 缺失生成按 category 汇总的 `adoReminderRequested` 待触发事件，不执行 ADO 网络调用。
F2.1-F2.4 继续提供严格完整性阻断、非阻断一致性信号、受限例外处理与标识符质量检查。F4 已启用受治理的 `excel-ta-v1` 纯计算
核心：少于 4 个因子推荐 WC，4 至 10 个推荐 RSS，多于 10 个转介 DM 团队进行 3D 分析，同时
始终计算 WC/RSS；支持六种受控分布、同单位输入、绝对或相对误差 `1e-12` 的批准模板回归，
以及复用同一 kernel 且工作量不超过 1000 的 What-if。错误不得泄露机密输入；Windows Excel
Worker 仅用于发布黄金回归，不在生产热路径中。F3 已启用 `drawing-governance-v2` 本地治理核心、
JSON/Markdown workflow 和宿主注入的 Surface MCP adapter；真实 Comment 0 写入仍需 capability、
策略审批及逐次用户确认。根 F5 直接消费 F0/F1/F3/F4 受控工件，提供能力、规格、贡献和证据受限的
公差链解读；F5.1 作为历史 internal compatible core 保留。F6 在 F5 后消费 F2/F3/F4/F5 受控工件，负责
options、reverse solve、RSS apportionment、feasibility、impact ranking 与最终 `Feature6-Report.md`；F7 仍不可用。F5/F6 不自动发布
ADO、不回写 workbook；F8 仅限用于受治理 Skill 运行时验收的匿名 `public` fixture。

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
- [F2 Initial 工作流设计](docs/superpowers/specs/2026-08-03-f2-initial-workflow-design.md)
- [F2 Initial 实施计划](docs/superpowers/plans/2026-08-03-f2-initial-workflow.md)
- [F2 Artifact 报告优化设计](docs/superpowers/specs/2026-08-03-f2-artifact-report-redesign.md)
- [F2 Artifact 报告实施计划](docs/superpowers/plans/2026-08-03-f2-artifact-report-redesign.md)
- [F4 计算引擎设计](docs/superpowers/specs/2026-07-30-f4-calculation-engine-design.md)
- [F4 计算引擎实施计划](docs/superpowers/plans/2026-07-30-f4-calculation-engine.md)
- [F6 最终公差分析报告模板接入设计](docs/superpowers/specs/2026-08-20-f6-final-report-template-design.md)
- [F6 最终公差分析报告模板接入实施计划](docs/superpowers/plans/2026-08-20-f6-final-report-template.md)
- [系统架构](docs/01-architecture.md) 与 [Feature Register](docs/governance/feature-register.md)
- [数据分类](docs/governance/data-classification.md) 与 [开发协作标准](docs/governance/development-standard.md)
- [Phase 0 验收](docs/governance/phase-0-acceptance.md)

---

## Positioning

**Objective evidence provider + verifiable decision support** — not a black-box adviser.
Every statement is tagged **FACT** (computed) / **RULE** (threshold check) → asserted, or
**SIGNAL** (needs engineering judgment) / **OPTION** (parallel path) → flagged only. Options are
presented by F5 in parallel and **not ranked**. F6 separately generates governed optimization options
and deterministically ranks supported options by impact; neither workflow makes the final engineering
judgment. When evidence is insufficient (e.g. the assembly datum face), the agent **stops and asks**
instead of guessing (fail-closed).

---

## Why an Agent (not Excel, not a generic LLM)

In process-flow order. See [full table](docs/03-differentiation.md).

| Stage | Dimension | Traditional TA Excel | Generic LLM | **AI Assist Agent** |
|---|---|---|---|---|
| **F0 · Knowledge base** | Basis | Lives in the engineer's head | No grounding | 3 controlled libraries; every judgment traces to a library entry |
| **F1 · Report parsing & asset prep** | Input prep | Manual worksheet review | No reliable extraction | Auto-detect TA worksheets, process selected sheets in parallel, and extract Loop screenshots |
| **F2 · Data cleansing** | Data cleansing | Manual, error-prone | No basis | Missing-field + DIM ID check + per-category **Capability Library** validation |
| **F3 · DIM-to-drawing linking** | Data-to-drawing | Manual, ambiguous | Cannot link | Use `(Drawing Number, DIM ID)` as the formal identity, flag same-drawing conflicts, and generate a traceable confidential list. Optional ADO updates use Surface MCP Comment 0 with `prepare -> confirm -> execute`; otherwise the same list stays local. |
| **F4 · Method recommendation / calculation** | Calculation | Reliable formulas | Often wrong / non-reproducible | Reuses the **same Excel engine** and selects WC or RSS by factor count |
| **F5 · Data interpretation** | Interpretation | Personal experience | No rules / knowledge base | Sections 1-3 of the fixed **5-section** report, **objective, each RULE cites its versioned/scoped F0 entry**; sections 4-5 are delegated to F6 |
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
| **F3 DIM-to-drawing linking (DIM ID)** ⭐ | Treat Part Number as Drawing Number in the current contract; use `(Drawing Number, DIM ID)` as the formal key; allow cross-drawing DIM ID reuse, flag same-drawing duplicates, and keep one-digit IDs as nonblocking `suspected_invalid`; optional Surface MCP writes update Comment 0 only after explicit confirmation, otherwise save the same confidential list locally |
| **F4 Method recommendation / calculation** | Factor count + CTS/CTF; `<4`→WC, `4–10`→RSS, `>10`→notify DM for 3D VA follow-up; F4 continues to compute both WC and RSS |
| **F5 Data interpretation** ⭐ | Fixed 5-section presentation: F5 owns loop validity, capability vs specification, and top contributors; structural risks and parallel options are delegated to F6. Uses **FACT/RULE/SIGNAL/OPTION**, scoped F0 citations, clarifications, and assumptions. |
| **F6 Tolerance / dimension-chain optimization** ⭐ | Mean-shift centering + contribution economics + RSS apportionment + spec reverse-solve (over-capability warning) |
| **F7 Closed-loop real-Cpk feedback** ⭐ | Backfill measured Cpk by DIM ID → real gap vs estimate + upgrade library T3→T1. Reads in via manual import from a **centralized measured-data store (SharePoint / platform)** that must be set up out-of-band (external prerequisite) |
| **F8 User interaction / read-only pane + output** ⭐ | Read-only faithful evidence pane + cited dialogue + consolidated report incl. Loop image |

### F5 — Fixed 5-section interpretation (objective; judgment left to user)
1. **Loop validity** — closed loop? same datum chain? **assembly datum face / stack start** clear? (if uncertain → clarification card)
2. **Capability vs Spec** — RSS σ / Cpk (`<1` FAIL · `1–1.33` risk · `≥1.33` PASS); spec window `<6σ` physically infeasible?
3. **Top contributors** — ranked by % contribution; Top 2–3 with cause (large tol / mid-stack amplification / direct single-direction effect)
4. **Structural risk (delegated F6)** — cross-domain datum chain (ME/PCBA/Glass), non-geometric variables, and over-long stacks; F5 records the delegation and F6 evaluates only supported evidence.
5. **Options (delegated F6)** — quantified improvement paths are generated and ranked by F6; F5 does not rank, recommend, or invent them.

F5 directly consumes F0/F1/F3/F4 artifacts; workbook entry first passes the F2 gate. Historical `f5-image-observation-v1` artifacts remain read-only compatible, while new image mode creates only v2. Each selected worksheet must contain exactly the five scopes `tolerance_loop_closure`, `datum_chain`, `assembly_datum_face`, `stack_start`, and `direction`, with a snapshot of all active factor rows preserving original/mapped fields and source-cell provenance. Confidence-gated visual evidence may produce an image `FACT`; image-plus-text assessment produces only an ME-review-required `image_text_context_review` `SIGNAL`. Direction mapping requires structured `linkedVisualLabels`, never free-text inference.

V2 is validated all-or-nothing. An observation-only failure discards the whole v2 and continues deterministic F5 with clarification; baseline identity or required-image errors fail closed. V2 is immutable, UUID-scoped, created once, and read back before invocation. The loader validates its exact content against the schema, workbook/worksheet identity and selected set, snapshot/source provenance, carried `imageReference` identity, and the physical F1 image SHA-256. The observation artifact has no pre-existing digest to validate; after acceptance, the workflow runner computes and records its SHA-256 in `Feature5-Run-Summary`. F6 accepts the governed F5 v1 baseline and optional v2 image-observation evidence without changing the existing detailed F5 report or its delegation markers.

---

## Out of Scope (for now)

Deferred until there is a proven need; each can be merged into the product later.

- Automatic extraction of drawing truth from 2D drawings/PDF; optional governed F5 image observations remain visible evidence only
- Three-way consistency (user ⇄ drawing ⇄ knowledge base)
- DM-owned 3D VA (VSA-class tool integration)
- **Automatic API capture** of measurement data (the loop is proven first via manual import from the centralized store)
- Write-back to Excel (Auto Summary / suggested spec)
- Monte Carlo (Quantum XL) integration

---

## Repository Notes

## Workbench Server Release Build

- 根 `npm run build` 按设计只执行 TypeScript project build。发布或打包 `@ai-assist/workbench-server` 时使用 server package build；`apps/workbench-server` 的 `build` 会先构建 `@ai-assist/workbench-web`，再复制确定性的 `workbench.js` / `workbench.css` 到 package-local `assets/workbench`。`prepack` 会在 `npm pack` / publish 前自动运行同一 server package build，避免发布 stale committed assets。

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

## Feature 2 Initial Workflow

- Prompt phase：`npm run workflow:f2:excel -- "path/to/report.xlsx"`，只返回 worksheet options 和 workbook content hash，不创建 F2 report。
- Confirm phase：`npm run workflow:f2:excel -- "path/to/report.xlsx" --worksheets "Analysis-A,Analysis-B" --workbook-hash "<sha256>" --confirm`。
- CLI 使用同一两阶段协议：`node apps/cli/dist/index.js feature2 --root . --workbook "path/to/report.xlsx"`，确认时追加 `--worksheets`、`--workbook-hash` 和 `--confirm`。
- 短语别名：`帮我用F2分析下excel "path/to/report.xlsx"` 或 `use F2 to analyze Excel "path/to/report.xlsx"`
- 确认与 workbook hash 绑定；文件内容变化后，旧确认以 `stale_worksheet_selection` fail closed，必须重新获取 options。
- 每次运行输出：`test/demo-output/f2-runs/<workbook-safe-name>/<UTC-run-id>/{f1,f2,validation}`，根目录同时保留 `manifest.json`；失败时不删除已完成阶段和 debug logs。
- F3/F5 从 workbook 启动时复用上述两阶段 `workflow:f2:excel` 协议：先获取 F1 worksheet options，再由用户确认 hash 与范围后生成同一 workbook identity 的受控 F1/F2 artifacts；不得以裸 F1→F2 命令绕过确认。
- 输出：`test/demo-output/feature2-output/<workbook-base-name>/Feature2-Report.json` 和 `Feature2-Report.md`
- 报告：每个 factor 按语义表头投影 canonical actual values，不依赖固定 column；并追加可移植截面图链接、`能力库结果` 与 `知识库推荐`，空值显示 `—`。
- 阻塞：因子必填字段、截面图或三项系统规格缺失时，只阻断对应 worksheet；能力库差异、库外、Drawing Number、DIM ID 或 Part Number 缺失均非阻塞。只有 `ready` worksheet 生成一个 F4 handoff。
- 验收：F2 任一模块必须执行完整 `F0 -> F1 artifacts -> F2` 链路，不得用孤立模块通过替代端到端证据。

## Feature 4 F2-driven Workflow

- 计算命令：`npm run workflow:f4 -- --f2-report "path/to/Feature2-Report.json"`
- 可选 Excel 黄金回归：在上述命令后追加 `--workbook "path/to/golden.xlsx"`。
- F4 只计算 F2 报告中状态为 `ready` 且已由用户确认的 worksheet handoff。F2 JSON 是计算的唯一业务输入；可选 workbook 只验证 F4 输出，不提供或覆盖计算输入。
- 每次运行输出到 `test/demo-output/f4-runs/<workbook-safe-name>/<UTC-run-id>/`。计算成功后依次原子写入 `Feature4-Calculation.json`、可选的 `Feature4-Comparison.json`、`Feature4-Report.md` 和最终 `manifest.json`。
- JSON 计算结果供 F5 使用，Markdown 供人工查看；Excel 不可用时保留有效计算结果，并在 comparison 和 manifest 中记录受控状态。

## Feature 5 Governed Interpretation Workflow

- 三个直接 artifact roots：`npm run workflow:f5 -- "path/to/f1-root" "path/to/f3-root" "path/to/f4-root" --worksheet "Analysis-A" --worksheet "Analysis-B"`
- 直接 `workflow:f5` 的 `--worksheet <name>` 可选且可重复；省略时默认使用 F4 calculations 中的 worksheets。
- Skill/workbook 交互模式必须至少选择一个 worksheet，并将每个选择以重复的 `--worksheet <name>` 传入；F3 与 F5 必须使用完全相同的 selected worksheet set。
- 可选图片观察：在上述命令末尾追加 `--image-observations "path/to/Feature5-Image-Observations.json"`。历史 v1 仅只读；新 image mode 只创建 immutable、UUID-scoped v2。Invocation 前的 readback 由 loader 校验 exact content against schema、workbook/worksheet identity 与 selected set、snapshot/source provenance、携带的 `imageReference` identity，并重新校验物理 F1 image SHA-256。Observation artifact 不存在可预先校验的自身 digest；接受后由 workflow runner 计算其 SHA-256 并记录到 `Feature5-Run-Summary`。
- workbook 启动顺序为 F1 -> F2 门禁 -> selected F3 -> F4 -> F5。F5 直接消费 F0 规则及 F1/F3/F4 工件；仓库不承诺或虚构独立 F0 workflow 命令。
- Skill 入口为“使用F5分析报告”。该入口不自动发布 ADO、不回写 workbook。`approved-knowledge-base` 与 `approved-me-review` 是 Feature 发布/启用批准，当前 F5 `available` 表示部署已批准，不是每次运行的交互输入。
- 运行时 ME review 由 `requiresEngineeringReview` SIGNAL、clarification/assumption 和不生成缺少受控证据支持的最终 RULE 门禁。V2 observation 校验失败时整件丢弃并继续 deterministic F5；baseline identity/hash 或必需 physical image 错误仍 fail closed。
- 每次运行输出到 `test/demo-output/f5-runs/<workbook-safe-name>/<UTC-run-id>/`，包含 `Feature5-Report.json`、`Feature5-Report.md`、`Feature5-Run-Summary.json` 和 `manifest.json`；可选输入 artifact 为 `Feature5-Image-Observations.json`。

## Feature 6 Governed Optimization Workflow

- Agent Skill 入口为“使用F6分析报告”。用户无需手工拼接命令；agent 在取得 TA workbook 后按 `F0 -> F1 -> F2 -> F3 -> F4 -> F5 -> F6` 执行，保留 two worksheet confirmations：第一次确认 F1/F2 解析范围，第二次只从 F2 ready 且 F1 图片有效的 worksheets 中确认 F3/F4/F5/F6 范围。Workbook mode 必须执行并验证 current-run F3；仅当结果为 `governance_required` 时进入复用 F3 双确认协议的 optional ADO publishing gate，发布 never automatic or implicit。新图片评估只创建 immutable `f5-image-observation-v2`。
- Skill 完成后展示 F1-F6 output ledger，并单独披露 F0 的 `v1`、`internal-v1`、`interpretation-rules-v1` 版本；F0 没有虚构的独立 workflow artifact。每个 Feature 的 contract、identity、manifest 和 hash 必须验证后才标记完成。已有 F6 output directory 或 `Feature6-Optimization.json` 走 read-and-validate 快速路径，不重跑上游。
- F6 在完成 F5 后运行。直接 CLI：`npm run workflow:f6 -- "<f2-root>" "<f3-root>" "<f4-root>" "<f5-root>" --worksheet "Analysis-A"`；四个 root 顺序固定，`--worksheet` 至少一个、可重复且 trim 后唯一。Skill 先分别收集并验证 `f6-analysis-context-v1` 与 `f6-optimization-targets-v1`，再以 `Confirm analysis context` 和 `Confirm optimization targets` 两次独立确认决定是否追加 `--analysis-context` 与 `--optimization-targets`。
- App CLI：`node apps/cli/dist/index.js feature6 --root "." --f2-artifacts "<f2-root>" --f3-artifacts "<f3-root>" --f4-artifacts "<f4-root>" --f5-artifacts "<f5-root>" --worksheet "Analysis-A"`，支持相同两个 V2 input flags。它只执行仓库内 trusted runner，并固定把结果写入 `test/demo-output/f6-runs/<F5-root-name>/<UTC-run-id>/`；app CLI 不接受自定义 output root。
- F5 owns baseline FACT/RULE/SIGNAL、clarification 和可选 v2 evidence；F6 owns target-driven options、reverse solve、RSS apportionment、feasibility、impact ranking 和 `Feature6-Report.md` 最终报告。只有已确认 targets 才生成量化 scenario；没有 targets 时仅输出 candidate，不存在默认百分比场景。所有数值场景均须回到 F4 kernel 验证。
- Supplier/datum/cost 都是 evidence-limited。缺失或不匹配时输出 `insufficient_evidence`；只有全部 supported ranked options 都具备受控正成本时才计算 ROI，否则显示 `Highest Impact Action` 与 `ROI: not_computed`，不得改称 Highest ROI。
- 每次成功或部分成功 run 原子生成五个 artifact：`Feature6-Report.md`、`Feature6-Optimization.json/.md`、`Feature6-Run-Summary.json` 和 `manifest.json`。Run Summary 保存结构化 Workbook/Worksheet dispositions；最终报告包含 workbook summary 和每个 ready worksheet 的固定 sections，结论使用 `PASS`、`CONDITIONAL_PASS`、`FAIL`、`INCOMPLETE` 四态；F2 blocked worksheet 仅进入 input integrity，不生成 capability 或 optimization 数值。
- 所有输入/输出均为 `confidential`，源 workbook 只读。F3/F6 repository runners 和直接 CLI 无 ADO、网络或 workbook write；可选 ADO side effect 只存在于 agent 的受治理 publishing gate。Artifact identity/hash、schema、workbook/worksheet association、受控 publish boundary、staging identity 与提交后 file identity任一失败均 fail closed。
- 历史 `comparison-request-v1` / `comparison-result-v1` placeholder 仍单独返回 `feature_not_available`；当前入口拒绝旧 F6 artifact version，不自动迁移或展示。治理边界以 [Feature Register](docs/governance/feature-register.md) 为准。

- `test/` and all `*.xlsx` (confidential templates / sample data) are **git-ignored**.
- Internal `*.html` design reports are **git-ignored** and not committed.
- Project planning is tracked via GitHub **Project #1** as four ME User Stories, Feature issues (F0-F8), and implementation tasks in each Feature checklist.

---

*Microsoft Confidential — engine reverse-engineered from template M1160113 REV_D.*
