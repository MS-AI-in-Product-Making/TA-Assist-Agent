# Feature Breakdown (V1)

> Hierarchy: **Epic → Feature → User Story → Task**, with Risk / Issue notes.
> Feature IDs (F0–F7) map one-to-one to [GitHub Milestones](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestones) and Issues.

## Epic

**Surface T/VA Analysis Agent (V1)**

> Strategic / project level — upgrade TA that relies on people for "calculation + experience-based interpretation" into an intelligent assistant backed by rules + a classified capability library, with efficient multi-sheet processing and actionable engineering decisions.

---

## F0 · Knowledge Base (3 libraries · the foundation of the whole differentiation)

> Human-curated, with source / confidence / coverage. See [Design Decision D1](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Story | **Classified Capability Library** (Tier 0 foundation) — reasonable tolerance band + process capability (source tiers T1 measured·PPAP → T3 empirical → T0 no-data marked "unknown") + recommended distribution |
| 📘 Story | **Engineering Rules Library** — CTS=6-sigma / CTF=4-sigma / Cpk≥1.33; distribution factors are engine constants, not stored here |
| 📘 Story | **Terminology · Ontology Library** — part-category vocabulary / subsystem (ME·PCBA·Glass·Display) / datum; used by F5 for cross-subsystem detection, not found → confirmation item |
| ⚠ Risk | Library missing or stale → publish coverage; Tier 0 does not assert feasibility (fail-closed) |

## F1 · Report Parsing & Asset Prep

| Type | Content |
|---|---|
| 📘 Story | Upload xlsx and auto-detect worksheets containing TA content, no manual selection needed |
| 🔧 Task | Scan worksheets · recognize fixed layout · list for user confirmation |
| 📘 Story | Parallel-accelerated processing of multi-sheet reports for fast output (review still per-page, human-gated) |
| 🔧 Task | Parallel scheduling · factor table (E14:T26) parsing · Loop screenshot extraction · aggregation |
| ⚠ Risk | Irregular worksheet naming / layout causes missed detection → manual fallback selection |

## F2 · Data Cleansing (solves "cleansing by hand is error-prone")

| Type | Content |
|---|---|
| 📘 Story | Validate whether user-filled information is missing |
| 🔧 Task | Required-field check — factor description / part name / part category / design nominal / tolerance / long term·safety factor / sigma level / distribution (missing optional fields such as drawing number only prompt, do not block) |
| 📘 Story | Judge reasonableness against the per-category **Classified Capability Library** |
| 🔧 Task | Load Classified Capability Library (reasonable tolerance band + process capability [source-tiered] + recommended distribution) · tolerance-range match · distribution reasonableness check · difference highlighting, flag "in-library / out-of-library evidenced" |
| 📘 Story | Two correction paths for differences: user edits Excel / Agent edits data and recomputes |
| ⚠ Issue | Library is an example and incomplete for now → publish coverage; no measured data (Tier 0) marked "process capability unknown" |

## F3 · Method Recommendation

| Type | Content |
|---|---|
| 📘 Story | Recommend a suitable target-tolerance reference method by factor count |
| 🔧 Task | Count + CTS/CTF identification · `<4` recommend WC · `4-10` recommend RSS · `>10` prompt to refer to DM; both WC and RSS computed and output |

## F4 · Calculation Engine (strictly consistent with Excel)

| Type | Content |
|---|---|
| 📘 Story | Results are trustworthy and reproducible |
| 🔧 Task | Per-factor / system-level / capability replication · sample regression (Cpk 0.74 / DPM 26500 / FAIL) |

## F5 · Standardized Professional Interpretation (TA-expert role · fixed 5-section · **objective presentation**)

> Positioning: assert only `FACT` (computed) / `RULE` (threshold check); `SIGNAL` (needs engineering judgment) is flagged as uncertainty only; `OPTION` (alternative paths) is presented in parallel, not ranked, not recommended — **judgment is left to the user**. See [Design Decisions D2/D3](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Story | **1 Loop Validity** — whether it is a closed loop, whether it follows the same datum chain, whether the **assembly datum face / stack start** is clear (uncertain → clarification card) |
| 🔧 Task | Closed-loop check · datum-chain consistency · assembly datum face confirmation · additive / subtractive direction validation |
| 📘 Story | **2 Capability vs Spec** — RSS σ / Cpk judgment (`<1` FAIL · `1~1.33` risk · `≥1.33` PASS), and whether the spec window is `<6σ` (physically infeasible) |
| 🔧 Task | Capability calculation · threshold judgment · 6-sigma feasibility check |
| 📘 Story | **3 Top Contributors** — ranked by % contribution, mark Top 2~3 with causes (large tolerance / mid-stack amplification / direct single-direction effect on output) |
| 🔧 Task | Contribution ranking · cause classification |
| 📘 Story | **4 Structural Risk (SIGNAL, flag only)** — whether the datum chain is cross-subsystem (ME/PCBA/Glass), whether it contains non-pure-geometric variables (switch travel / foam·adhesive non-linearity), whether the stack is over-long (`>10`) |
| 🔧 Task | Cross-subsystem detection (query Lib 3 ontology) · non-geometric variable flagging · long-stack warning |
| 📘 Story | **5 Options (OPTION, not ranked)** — present in parallel A keep design / B adjust Spec / C optimize Capability with their quantified consequences; CTF allows spec↔yield trade-off, CTS forbids loosening and can only optimize design/process; closing one-line **FACT** summary |
| 🔧 Task | Three-path quantification · CTS/CTF rule constraints · factual summary (no recommended action) |
| 📘 Story | **6 Clarification Card / Assumption Register (fail-closed)** — do not guess when evidence is insufficient; raise a clarification card for the **assembly datum face / stack start** (with candidates), locally block dependent conclusions; cross-subsystem attribution not found in Lib 3 → confirmation item |
| 🔧 Task | Assumption register + confidence gate · assembly datum face clarification card · local blocking |
| ⚠ Risk | Interpretation hallucination → assertion-tag system + forced citation of rules/data source + clarification card when uncertain (fail-closed) |

## F6 · What-if Sensitivity / Spec Reverse-Solve / Centering (high-value decisions)

| Type | Content |
|---|---|
| 📘 Story | What-if simulation: quantify "how much Cpk changes after tightening a part", turning root causes into quantifiable numbers |
| 🔧 Task | Single-part tolerance perturbation · recompute Cpk · output before/after comparison |
| 📘 Story | **Spec reverse-solve**: based on Top contributors, give 2-3 parallel options (single-point tighten / Top 2-3 combination / center + tighten), each with new tolerance, resulting Cpk, feasibility |
| 🔧 Task | Compute required σ reduction · generate 2-3 options · **over-capability → RED warning** (vs Lib 1 process capability) |
| 📘 Story | Mean-centering analysis: detect nominal offset, surface zero-cost centering gains |
| 🔧 Task | Offset detection · recompute Cpk after centering · output |

## F7 · Output Report

| Type | Content |
|---|---|
| 📘 Story | Complete interpretation report including the Loop image |
| 🔧 Task | Consolidated output |
| 📘 Story | **Read-only evidence pane** (D6) — no need to reopen Excel after upload; left pane read-only reproduces the original table + Loop image, right pane Agent cites visible rows for every conclusion with click-to-highlight linkage, source data never silently edited |
| 🔧 Task | Read-only rendering of the original table · Loop image embedding · conclusion↔cell citation linkage |

---
**Related docs:** [Architecture](01-architecture.md) · [End-to-End Flow](02-end-to-end-flow.md) · [Differentiation](03-differentiation.md) · [Design Decisions](05-design-decisions.md)
