# Feature Breakdown (V1)

> Hierarchy: **Epic → Feature → User Story → Task**, with Risk / Issue notes.
> Feature IDs (F0–F9) are ordered by the end-to-end **process flow** and map one-to-one to [GitHub Milestones](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestones) and Issues.

## Epic

**Surface T/VA Analysis Agent (V1)**

> Strategic / project level — upgrade TA that relies on people for "calculation + experience-based interpretation" into an intelligent assistant backed by a knowledge base + rules, with data-to-drawing traceability and a measured-Cpk closed loop, delivering objective, evidence-backed engineering decisions.

> **Process backbone:** F0 foundation → F1 parse → F2 cleanse → F3 DIM link → F4 method → F5 engine → F6 interpret → F7 optimize → F9 interact/output; **F8 closed loop** flows measured data from the line back into **F0**, forming a "gets better the more it is used" cycle.

> **Focus features (⭐):** F0, F2, F3, F6, F7, F8, F9. Supporting features (F1, F4, F5) are kept minimal.

---

## F0 · Knowledge Base ⭐ (the soul — the source of all judgment)

> Without the knowledge base, TA is a soulless calculator: cleansing has no yardstick, interpretation has no basis, optimization has no cost view. Human-curated, with source / confidence / coverage. See [Design Decision D1](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Story | **Classified Capability Library** (Tier 0 foundation) — reasonable tolerance band + process capability (source tiers T1 measured·PPAP → T3 empirical → T0 no-data marked "unknown") + recommended distribution |
| 📘 Story | **Engineering Rules Library** — CTS=6-sigma / CTF=4-sigma / Cpk≥1.33; distribution factors are engine constants, not stored here |
| 📘 Story | **Terminology · Ontology Library** — part-category vocabulary / subsystem (ME·PCBA·Glass·Display) / datum; used by F6 for cross-subsystem detection, not found → confirmation item |
| 🔧 Task | Entry schema (source / confidence / effective version) · coverage metric published · single owner + change log |
| ⚠ Risk | Library missing or stale → publish coverage; Tier 0 does not assert feasibility (fail-closed) |

## F1 · Report Parsing & Asset Prep (supporting)

| Type | Content |
|---|---|
| 📘 Story | Upload xlsx and auto-detect worksheets containing TA content, no manual selection needed |
| 🔧 Task | Scan worksheets · recognize fixed layout · list for user confirmation |
| 📘 Story | Parallel-accelerated processing of multi-sheet reports for fast output (review still per-page, human-gated) |
| 🔧 Task | Parallel scheduling · factor table (E14:T26) parsing · Loop screenshot extraction · aggregation |
| ⚠ Risk | Irregular worksheet naming / layout causes missed detection → manual fallback selection |

## F2 · Data Cleansing ⭐ (solves "cleansing by hand is error-prone")

| Type | Content |
|---|---|
| 📘 Story | Validate whether user-filled information is missing |
| 🔧 Task | Required-field check — factor description / part name / part category / design nominal / tolerance / long term·safety factor / sigma level / distribution (missing optional fields such as drawing number only prompt, do not block) |
| 📘 Story | Judge reasonableness against the per-category **Classified Capability Library** (F0 Lib 1) |
| 🔧 Task | Load Lib 1 · tolerance-range match · distribution reasonableness check · difference highlighting, flag "in-library evidenced / out-of-library" |
| 📘 Story | Include **DIM ID completeness** as part of cleansing (feeds F3) |
| 🔧 Task | Flag factors missing a DIM ID as a key-optional gap; do not block, but surface for later linking |
| 📘 Story | Two correction paths for differences: user edits Excel / Agent edits data and recomputes |
| ⚠ Issue | Library is an example and incomplete for now → publish coverage; no measured data (Tier 0) marked "process capability unknown" |

## F3 · Dimension-to-Drawing Association (DIM ID) ⭐ (NEW · lightweight metadata link, not image reading)

> Anchors each factor to a unique drawing dimension via the existing `DIM ID` field + tags. This is **metadata association, not OCR / image reading** (image extraction stays in V2). It is the prerequisite for the F8 closed loop. See [Design Decision D7](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Story | Uniquely link each factor to a drawing dimension by `DIM ID` (the canonical anchor) |
| 🔧 Task | Build the anchor table `DIM ID ↔ factor ↔ (future) measurement`; validate **uniqueness + completeness** within a submission |
| 📘 Story | Handle the "no drawing / no ID early on" case (placeholder-first, backfill-later) |
| 🔧 Task | Allocate placeholder anchors · reminder step to backfill purpose-dimension requirements into the TA task |
| 📘 Story | **MS ↔ supplier ID reconciliation** — map external supplier IDs (per revision) onto the canonical MS anchor via an alias / crosswalk table |
| 🔧 Task | Alias table (supplier ID + revision → canonical DIM ID) · uniqueness check · versioned mapping so a supplier ID change updates the alias, not the anchor |
| 📘 Story | Light format sanity-check only (MS templates already uniform → no strict convention needed internally) |
| 🔧 Task | Duplicate / missing / malformed DIM ID detection → surface for review (non-blocking); on collision / unmapped external ID → **clarification card (fail-closed, reuse D4)** |
| ⚠ Risk | Real drift risk is at the **supplier boundary**, not inside MS → mapping + conflict-confirmation is the core, strict internal naming rules are de-emphasized |

## F4 · Method Recommendation (supporting)

| Type | Content |
|---|---|
| 📘 Story | Recommend a suitable target-tolerance reference method by factor count |
| 🔧 Task | Count + CTS/CTF identification · `<4` recommend WC · `4-10` recommend RSS · `>10` prompt to refer to DM; both WC and RSS computed and output |

## F5 · Calculation Engine (trust foundation · strictly consistent with Excel)

| Type | Content |
|---|---|
| 📘 Story | Results are trustworthy and reproducible |
| 🔧 Task | Per-factor / system-level / capability replication · sample regression (Cpk 0.74 / DPM 26500 / FAIL) |

## F6 · Data Interpretation ⭐ (objective 5-section · the delivery face of the "soul")

> Positioning: assert only `FACT` (computed) / `RULE` (threshold check); `SIGNAL` (needs engineering judgment) is flagged as uncertainty only; `OPTION` (alternative paths) is presented in parallel, not ranked, not recommended — **judgment is left to the user**. **Every RULE / capability judgment cites the F0 library entry it relies on (entry vX, coverage y%)** — this is what makes "evidence-backed" hard rather than hand-wavy. See [Design Decisions D2/D3](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Story | **1 Loop Validity** — closed loop? same datum chain? is the **assembly datum face / stack start** clear (uncertain → clarification card) |
| 🔧 Task | Closed-loop check · datum-chain consistency · assembly datum face confirmation · additive / subtractive direction validation |
| 📘 Story | **2 Capability vs Spec** — RSS σ / Cpk judgment (`<1` FAIL · `1~1.33` risk · `≥1.33` PASS), and whether the spec window is `<6σ` (physically infeasible) |
| 🔧 Task | Capability calculation · threshold judgment (cite F0 Lib 2 rule) · 6-sigma feasibility check |
| 📘 Story | **3 Top Contributors** — ranked by % contribution, mark Top 2~3 with causes (large tolerance / mid-stack amplification / direct single-direction effect on output) |
| 🔧 Task | Contribution ranking · cause classification |
| 📘 Story | **4 Structural Risk (SIGNAL, flag only)** — cross-subsystem datum chain (ME/PCBA/Glass), non-pure-geometric variables (switch travel / foam·adhesive non-linearity), over-long stack (`>10`) |
| 🔧 Task | Cross-subsystem detection (query F0 Lib 3 ontology) · non-geometric variable flagging · long-stack warning |
| 📘 Story | **5 Options (OPTION, not ranked)** — present in parallel A keep design / B adjust Spec / C optimize Capability with quantified consequences; CTF allows spec↔yield trade-off, CTS forbids loosening; closing one-line **FACT** summary |
| 🔧 Task | Three-path quantification · CTS/CTF rule constraints · factual summary (no recommended action) |
| 📘 Story | **6 Clarification Card / Assumption Register (fail-closed)** — do not guess when evidence is insufficient; raise a clarification card for the **assembly datum face / stack start** (with candidates), locally block dependent conclusions; cross-subsystem attribution not found in F0 Lib 3 → confirmation item |
| 🔧 Task | Assumption register + confidence gate · assembly datum face clarification card · local blocking |
| 📘 Story | **7 Evidence-chain citation** — each RULE / capability statement carries a reference to its F0 library entry and version |
| 🔧 Task | Attach entry id / version / coverage to every RULE-tagged statement |
| ⚠ Risk | Interpretation hallucination → assertion-tag system + forced citation of F0 entries + clarification card when uncertain (fail-closed) |

## F7 · Tolerance / Dimension-Chain Optimization ⭐ (was What-if · the most hands-on part per field feedback)

> Not just "compute Cpk" but answer "how to change it most economically". The three tolerance-shortfall types from the field map to three optimization levers. Output stays **parallel, not ranked, judgment left to user**. See [Design Decisions D5](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Story | **Mean-shift centering** — detect nominal offset (often from part compression / empty-insert), give the zero-cost centering gain first |
| 🔧 Task | Offset detection · recompute Cpk after centering · output before/after |
| 📘 Story | **Contribution economics** — the larger a factor's contribution, the more economical it is to loosen; rank parts by cost-saving leverage |
| 🔧 Task | Contribution-weighted ranking · relative-cost proxy (loosen ratio × contribution) · both tighten and loosen directions |
| 📘 Story | **RSS apportionment (square-tolerance)** — share the required σ reduction across Top contributors by proportion |
| 🔧 Task | Compute required σ reduction · apportion across Top 2-3 |
| 📘 Story | **What-if simulation** — quantify "tighten / loosen X → Cpk change", turning root causes into numbers |
| 🔧 Task | Single-part tolerance perturbation · recompute · before/after comparison |
| 📘 Story | **Spec reverse-solve** — 2-3 parallel options (single-point tighten / Top 2-3 combination / center + tighten), each with new tolerance, resulting Cpk, feasibility |
| 🔧 Task | Generate 2-3 options · **over-capability → RED warning** (vs F0 Lib 1 process capability); Tier 0 → "feasibility unknown" |

## F8 · Closed-Loop Real-Cpk Feedback ⭐ (NEW · V1 read-in side only)

> Feed supplier **measured yield / Cpk** back to the corresponding factor by `DIM ID`, upgrading process capability from "empirical estimate (Tier 3)" to "measured (Tier 1)". The **feedback target is F0**, so analysis gets more accurate the more it is used. V1 does the **read-in side only** (no auto write-back to Excel — that stays V2). See [Design Decision D8](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Story | Ingest measured data keyed by `DIM ID` |
| 🔧 Task | Define measurement schema (DIM ID key) · import pipeline · permissions |
| 📘 Story | Update F0 Lib 1 tier and σ from measured distributions |
| 🔧 Task | Recompute σ from measured data (handle non-normal) · promote entry tier T3→T1 · version bump |
| ⚠ Risk | DIM ID governance (F3) is a hard prerequisite; measured distribution may be non-normal → affects σ conversion |

## F9 · User Interaction / Read-Only Evidence Pane + Output Report ⭐

> No need to reopen Excel after upload. Present the original TA data faithfully, read-only, so the user trusts their eyes rather than a black box. See [Design Decision D6](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Story | **Read-only evidence pane** — left pane read-only reproduces the `Example_TA` factor table (same values / layout / units) + the extracted Loop image below |
| 🔧 Task | Read-only rendering of the original table · Loop image embedding |
| 📘 Story | **Cited dialogue** — right pane Agent cites visible rows/cells for every conclusion; click-to-highlight linkage; source data never silently edited |
| 🔧 Task | Conclusion↔cell citation linkage · read-only guarantee + two change-data paths |
| 📘 Story | **Consolidated report** — complete interpretation report including the Loop image, per-item traceable |
| 🔧 Task | Consolidated output |

---
**Related docs:** [Architecture](01-architecture.md) · [End-to-End Flow](02-end-to-end-flow.md) · [Differentiation](03-differentiation.md) · [Design Decisions](05-design-decisions.md)
