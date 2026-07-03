# Design Decisions (V1)

> This document records the core design trade-offs of V1 — the "why" layer behind the architecture / flow / feature breakdown.
> Positioning: **determinism, verifiability, auditability first; present evidence objectively, leave judgment to the user; stop and ask when uncertain, never fabricate.**

---

## D1 · Knowledge Base Design (3 classes + source tiers)

The differentiation is bet on the knowledge base, so **its completeness and honesty directly decide the project's success**. V1 converges to **3 controlled libraries** (human-curated, not auto-learned).

### Lib 1 · Classified Capability Library

By part category, each entry has three dimensions:

| Dimension | Question answered | Source |
|---|---|---|
| Reasonable tolerance band | Is the user-filled tolerance **sensible** (design-side norm)? | Standards / historical drawings / engineering experience |
| Process capability (source-tiered) | Is this tolerance **actually achievable** (manufacturing-side reality)? | Measured / PPAP / supplier statement |
| Recommended distribution | Which distribution should this **feature class use** (prevents wrong σ from defaulting to Normal)? | Process-characteristic induction |

> **Merge note:** The former "process capability library" and "classified tolerance spec library" were structurally duplicated and are merged into one class here; "recommended distribution" is also per part category, so it becomes a column in the same table rather than a separate library.

**Source tiers (solve "measured data is often missing"):**

| Tier | Data source | Reverse-solve / cleansing behavior |
|---|---|---|
| Tier 1 | Measured / PPAP | Assert feasibility directly |
| Tier 2 | Supplier statement / historical project | Assert + mark "to be reviewed" |
| Tier 3 | Engineering experience / standard estimate | Default fallback value |
| **Tier 0** | **No data** | **Do not assert feasibility, mark "process capability unknown, confirm with supplier"** |

**Why:** In reality Tier 1 is often missing. Tiering lets the system **degrade gracefully** — rigorous when data exists, honestly marked "unknown" when it does not, rather than guessing (fail-closed).

### Lib 2 · Engineering Rules Library

Standards such as CTS = 6σ · CTF = 4σ · default target Cpk ≥ 1.33. They change very slowly and are authoritative, so they need **version locking + change log**.

### Lib 3 · Terminology / Ontology Library (controlled dictionary)

A "controlled dictionary" that **prevents the model from inventing terms or misclassifying**. Three lookup tables:

1. **Part-category vocabulary**: a fixed category list (housing / bracket / screw / foam / adhesive / switch / glass / PCBA…) → validate `part category`, serve as index key for Lib 1.
2. **Subsystem vocabulary**: tag each part with a subsystem (ME / PCBA / Glass / Display…) → **the prerequisite for "cross-subsystem risk" detection**.
3. **datum vocabulary**: datum-face naming conventions.

**How to build:** No AI — extract from part names already present in the existing TA template, organize into a flat list, tag each part with its subsystem. It is just a lookup table; extend when new parts appear.

**Why:** Without it, "cross-subsystem" and "category matching" are meaningless — the model would not know Glass and bracket belong to different subsystems. It is the index layer that lets the other two libraries and the structural-risk judgment **line up**.

### Maintenance Principles

- Human-curated, not auto-learned (same reason "experience distillation" was rejected — the risk of ossifying errors).
- Every entry carries **source / confidence / effective version**; only then can a cleansing conclusion be flagged "in-library evidenced / out-of-library".
- Single owner + change log + **coverage metric** published (e.g. "Lib 1 covers 6/20 high-frequency part classes").
- Distribution factor constants (Normal=1 / Uniform=1.732 / …) are **engine built-in constants**, not part of the knowledge base.
- **Closed-loop feedback (feeding measured Cpk back into Lib 1) is moved to V2.**

---

## D2 · Objective Interpretation: State Evidence, Leave Judgment to the User

**No prescriptive advice** — assert only what can be proven by calculation / rules. Mechanism = **tag every statement with an "assertion type"**:

| Tag | Meaning | Can assert? |
|---|---|---|
| `FACT` | Pure computed result (Cpk=0.74, A contributes 62%) | ✅ State directly |
| `RULE` | Objective comparison to a threshold (0.74 < 1.33) | ✅ State directly |
| `SIGNAL` | A signal needing engineering judgment | ⚠ Only flag "worth noting", no conclusion |
| `OPTION` | Alternative path + its quantified consequence | 📊 Presented in parallel, not ranked, not recommended |

**Rewrite example:** Change "recommend tightening part A" → **"Part A contributes 62%; if its tolerance ×0.5, Cpk goes 0.74→1.05 (computed)"**. State the causality and numbers, leave the action to the user. The closing one-liner is a **factual summary**, not advice.

**Benefit:** "Judgments" without ground truth are removed from the system; the validation set only needs to check `FACT` / `RULE`, naturally regressable.

---

## D3 · SIGNAL List (flag only, no automatic conclusion)

**Cross-subsystem** (the dimension chain crosses different engineering subsystems with different tolerance habits / thermal expansion / assembly methods):

- ME structural part ↔ PCBA (board thickness, component height)
- ME ↔ Glass / cover (glass cutting, lamination)
- ME ↔ Display module
- Metal part ↔ plastic part (large CTE difference)
- Hard part ↔ soft part (foam / adhesive / gasket)

**Non-geometric variables** (involve physical behavior, cannot be linearly stacked as rigid bodies):

- switch / button travel and compression
- foam compression ratio (non-linear, changes under load)
- adhesive layer thickness (cure shrinkage, press deformation)
- gasket compression
- preload / deformation from screw torque
- thermal expansion (temperature-dependent, not the assembly state)
- elastic part / snap-fit assembly deformation

---

## D4 · Hallucination Handling: Stop and Confirm When Uncertain (fail-closed)

**Principle: better to ask than to fabricate.** The real uncertainty is not the datum "direction" but the **assembly datum face / stack start** — the model can read numbers but cannot tell from the table which face the physical stack starts from or which face mates with which (that information lives in the drawing / 3D, excluded from V1).

Mechanism = **assumption register + confidence gate**:

1. Every "non-pure-calculation" inference (assembly datum face, whether the loop is closed, cross-subsystem attribution) may only be asserted if evidence can be obtained from the input.
2. Evidence missing / ambiguous → **do not guess**, raise a **targeted clarification card** with candidates:
   > ⚠ Need your confirmation: which face of part A is the **assembly datum face** of this dimension chain? (Determines the stack start; cannot be judged from the table.)
3. **Local blocking**: confirmed parts are analyzed as usual, conclusions depending on that assumption are held, nothing is computed on a faulty basis.
4. All assumptions are listed together; the final version is issued after the user confirms / corrects them.

> **Cross-subsystem attribution**: deciding which subsystem a part belongs to (ME/PCBA/Glass…) is judged by the Lib 3 subsystem vocabulary; **not found → also becomes a confirmation item**.

---

## D5 · Spec Reverse-Solver (2-3 parallel options + over-spec warning)

Goal: the total σ needed to reach Cpk_target=1.33, back-solve the variation to be eliminated, and generate **parallel** options (not recommended, only compared):

| Option | Strategy | Applicability |
|---|---|---|
| Option A · single-point tighten | Tighten only the Top-1 contributor to pass | Simple; if over process capability, flag infeasible |
| Option B · Top 2-3 combined tighten | Share the reduction by contribution ratio | More realistic, less pressure per part |
| Option C · center + tighten | Zero-cost mean-centering first, then tighten the remaining gap | Most economical when a nominal offset exists |

Each option outputs: new tolerance per part → resulting Cpk → **feasibility flag (vs Lib 1 process capability)** → relative cost proxy.

**Over-spec warning (core):** when the back-solved tolerance is tighter than the process-achievable value for that part class → **RED warning**, to stop the user from blindly shrinking the tolerance band:

> ⚠ Target tolerance 0.02 is already below the process-achievable 0.05 for this part class (Tier 2) — **not achievable in process; forcing it will collapse yield / spike cost.**

For Tier 0 (no capability data), mark "feasibility unknown, confirm with supplier".

---

## D6 · User Interaction: Read-Only Evidence Pane + What-You-See-Is-The-Basis
**No need to reopen Excel after upload.** Premise: present the original TA data **faithfully, read-only, unaltered**, so the user trusts their eyes rather than a black box.

**Layout: evidence on the left / dialogue on the right**

- **Left pane (read-only evidence)**: faithfully reproduce the `Example_TA` factor table — same values, same layout, same units, **not editable**; the extracted **Loop screenshot** directly below. It is a "replica view", not re-entry.
- **Right pane (Agent dialogue)**: every conclusion **cites a visible row / cell in the left pane** ("see row 3, part A, %contribution 62%"); clicking a conclusion highlights the corresponding row on the left.

**Trust ladder (three levels):** see the raw data (trust your eyes) → see the Agent values match Excel (trust the engine) → see each interpretation is traceable (trust the conclusion).

**Read-only guarantee + two paths to change data:** source data is never silently overwritten; to change it, the user edits Excel and re-uploads / the Agent proposes a difference for approval.

---

## D7 · Dimension-to-Drawing Association (DIM ID) — metadata link, not image reading

**The field team's real need is traceability from the TA table to the drawing dimension.** The chosen mechanism is deliberately **lightweight**: use the `DIM ID` field (plus tags) that already exists in the TA template to anchor each factor to a unique drawing dimension. This is **metadata association, not OCR / image reading** — reading drawing images stays in V2.

Mechanism:

1. Build an anchor table `DIM ID ↔ factor ↔ (future) measurement`; validate uniqueness.
2. **Placeholder-first, backfill-later**: early in a program there may be no drawing / no ID yet. Allocate a placeholder anchor and add a reminder process step so purpose-dimension requirements are backfilled into the TA task once the drawing exists (per the field discussion).
3. **Uniqueness + cross-source reconciliation** so IDs stay unique and the anchor does not drift.
   Inside MS a shared template keeps IDs consistent, so a strict naming convention is low-value;
   the actual drift risk is at the **MS ↔ supplier boundary** (their own numbering + revisions).
   The mechanism is therefore an **alias / crosswalk table** mapping external IDs onto the canonical
   anchor, with fail-closed confirmation (D4) on collisions — not an enforced naming scheme.

**Why V1:** it needs no image understanding, reuses an existing column, and is the **hard prerequisite for the D8 closed loop** (you cannot route measured data back without a stable key).

**Bottleneck:** the missing / non-unique DIM ID case. Without governance the anchor is meaningless; hence placeholder + convention rules are part of the feature, not an afterthought.

---

## D8 · Closed-Loop Real-Cpk Feedback — the knowledge base gets better the more it is used

**The loop that gives the whole system compounding value:** real measured yield / Cpk from the line → routed by `DIM ID` back to the corresponding factor → upgrades that entry's process capability in Lib 1 from "empirical estimate (Tier 3)" to "measured (Tier 1)". Better capability data → better cleansing, interpretation and optimization next time. The **feedback target is F0**, closing the D1 loop.

**V1 scope = read-in side only:**

1. Define a measurement-data schema keyed by `DIM ID`.
2. Ingest measured distributions; recompute σ (handle non-normal distributions honestly).
3. Promote the Lib 1 entry tier (T3 → T1) and bump its version.
4. **No auto write-back to Excel** — suggesting spec changes back into the workbook stays in V2.

**Bottlenecks:**

- **DIM ID governance (D7) is a hard prerequisite** — no stable key, no routing.
- Measured distributions are often **non-normal**, so σ conversion must not blindly assume Normal.
- Data pipeline / permissions for supplier measurement data.

**Why read-in only:** it delivers the "gets more accurate over time" value while deferring the riskier write-back and cost/economics coupling. It also makes Lib 1's source-tier design (D1) a concrete, exercised path rather than a documentation concept.

---

## Impact of Decisions on Feature Flow

Features are ordered by the end-to-end **process flow** (not priority): **F0 knowledge base (soul) → F1 parse → F2 cleanse → F3 DIM link → F4 method → F5 engine → F6 objective interpretation → F7 tolerance optimization → F9 interaction/output**, with **F8 closed loop** feeding measured Cpk back into F0. The knowledge base (F0) and objective interpretation (F6) are the "soul" of the tool; the closed loop (F8) is what lets that soul improve over time.

---
**Related docs:** [Architecture](01-architecture.md) · [End-to-End Flow](02-end-to-end-flow.md) · [Differentiation](03-differentiation.md) · [Feature Breakdown](04-feature-breakdown.md)
