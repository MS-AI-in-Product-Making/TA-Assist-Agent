# Roadmap

Delivery roadmap for the **TA Agent** (Tolerance Analysis Agent).

Hierarchy: **Epic → User Story (`Sx` / Milestone) → Feature (`Fx.y` / Issue) → Task**.
This page lists every User Story and its Features. Codes link to their GitHub Milestone / Issue.

Scope note: this is the **V1** backlog. Items are grouped by process order (S0 → S9), not by priority.

Repo: [MS-AI-in-Product-Making/AI-TVA-Analysis-Agent](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent)

---

## S0 · Knowledge Base — [milestone](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestone/8)

Foundational 3-class knowledge base underpinning S2 / S5 / S6. Human-curated with source / confidence / coverage.

- **F0.1** Classified Capability Library — [#17](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/17)
- **F0.2** Engineering Rules Library — [#18](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/18)
- **F0.3** Terminology / Ontology Library — [#19](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/19)

## S1 · Report Parsing & Asset Prep — [milestone](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestone/1)

Auto-detect TA worksheets (parallel processing), parse the factor table, and extract the dimension-chain Loop screenshot as a separate asset.

- **F1.1** Auto-detect TA worksheets — [#1](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/1)
- **F1.2** Parallel multi-sheet processing — [#2](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/2)

## S2 · Data Cleansing — [milestone](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestone/2)

Check missing required fields + DIM ID completeness; validate tolerance band / capability / distribution against the per-category Classified Capability Library (S0 Lib 1); two correction paths.

- **F2.1** Missing required-field check — [#3](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/3)
- **F2.2** Per-category spec & distribution validation — [#4](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/4)
- **F2.3** Two correction paths for differences — [#5](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/5)
- **F2.4** DIM ID presence & format check — [#22](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/22)

## S3 · Dimension-to-Drawing Association (DIM ID) — [milestone](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestone/9)

Anchor each factor to a drawing dimension via DIM ID metadata; placeholder-first, backfill-later; ontology-driven part grouping; ADO auto-trigger + server-side scheduled reminders. Prerequisite for the S8 closed loop.

- **F3.1** Unique DIM ID ↔ factor anchor — [#23](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/23)
- **F3.2** Placeholder-first, backfill-later — [#24](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/24)
- **F3.3** DIM ID uniqueness & MS↔supplier reconciliation — [#25](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/25)
- **F3.4** Event trigger — ADO work item + .xlsx auto-runs agent — [#32](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/32)
- **F3.5** Owner identification — bind run to a responsible person — [#33](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/33)
- **F3.6** Scheduled EV1 reminder — milestone-driven nudge before info is missing — [#34](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/34)
- **F3.7** Dimension-chain list — per-part list for drawing mapping — [#35](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/35)
- **F3.8** Drawing reminder (server-side scheduled) — reflect the dimension chain on the drawing — [#36](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/36)
- **F3.9** State & history — ADO maintains loop status for traceability — [#37](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/37)
- **F3.10** Part-category grouping (ontology-driven) for drawing packaging — [#39](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/39)

## S4 · Method Recommendation — [milestone](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestone/3)

Recommend a method by factor count informed by CTS / CTF: <4 Worst Case, 4–10 RSS, >10 refer to the DM team; both WC and RSS are always computed.

- **F4.1** Recommend method by factor count — [#6](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/6)

## S5 · Calculation Engine — [milestone](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestone/4)

1D calculation engine kept strictly consistent with the TA template Excel formulas, validated by a sample regression check.

- **F5.1** Excel-consistent calculation engine — [#7](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/7)

## S6 · Data Interpretation — [milestone](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestone/5)

Fixed 5-section objective interpretation (FACT / RULE / SIGNAL / OPTION); every RULE cites its S0 entry; stops with a clarification card when uncertain; final judgment left to the user.

- **F6.1** Loop validity — [#8](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/8)
- **F6.2** Capability vs Spec — [#9](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/9)
- **F6.3** Top contributors — [#10](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/10)
- **F6.4** Structural risk identification — [#11](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/11)
- **F6.5** Options presentation (objective, no recommendation) — [#12](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/12)
- **F6.6** Clarification card & assumption register (fail-closed) — [#20](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/20)
- **F6.7** Evidence-chain citation to S0 — [#26](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/26)

## S7 · Tolerance / Dimension-Chain Optimization — [milestone](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestone/6)

Mean-shift centering + contribution economics + RSS apportionment + spec reverse-solve (2–3 parallel options, not ranked); over-capability raises a RED warning.

- **F7.1** Mean-shift centering analysis — [#14](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/14)
- **F7.2** Contribution economics analysis — [#27](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/27)
- **F7.3** RSS tolerance apportionment — [#28](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/28)
- **F7.4** What-if sensitivity simulation — [#13](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/13)
- **F7.5** Spec reverse-solver (options) — [#16](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/16)

## S8 · Closed-Loop Real-Cpk Feedback — [milestone](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestone/10)

Ingest measured yield / Cpk by DIM ID and feed back into S0 (upgrade Lib 1 tier T3→T1); report real gap vs initial estimate. V1 = read-in side only, via manual import from a centralized measured-data store set up out-of-band.

- **F8.1** Ingest measured yield/Cpk by DIM ID — [#29](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/29)
- **F8.2** Real gap vs initial estimate — recompute on measured capability — [#38](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/38)
- **F8.3** Upgrade Lib1 entry tier from measured data — [#30](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/30)

## S9 · User Interaction, Read-Only Pane & Output — [milestone](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestone/7)

Read-only faithful evidence pane + cited dialogue with click-to-highlight + consolidated report including the Loop image; the source workbook is never silently edited.

- **F9.1** Consolidated interpretation report — [#15](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/15)
- **F9.2** Read-only evidence pane UX — [#21](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/issues/21)

---

_10 User Stories · 38 Features. See [`docs/04-feature-breakdown.md`](docs/04-feature-breakdown.md) for full per-feature detail._
