# Design Decisions (V1)

> This document records the key trade-offs of V1 — the "why" behind the architecture, flow, and feature breakdown.
> Stance: **certainty, verifiability, and auditability first; present evidence objectively and leave judgment to the user; when in doubt, stop and ask, and never fabricate.**

---

## D1 · Knowledge Base Design (three libraries + source tiers)

Differentiation is bet on the knowledge base, so **how complete and how honest it is directly decides how far the project can go**. V1 converges on **three controlled knowledge bases** (human-maintained, not auto-learned).

### Capability Library (Lib 1)

Organized by part category, each entry has three dimensions:

| Dimension | Question it answers | Source |
|---|---|---|
| Reasonable tolerance band | Is the user-entered tolerance **reasonable** (from a design standpoint)? | Standards / historical drawings / engineering experience |
| Process capability (tiered) | Can this tolerance **actually be achieved** (from a manufacturing standpoint)? | Measured / PPAP / supplier statement |
| Recommended distribution | Which distribution **should this feature class use** (to avoid a wrong σ from defaulting to normal)? | Induced from process characteristics |

> **Merge note:** The former "process capability library" and "classified tolerance spec library" overlapped structurally and are merged into one library here; "recommended distribution" is also per category, so it becomes a column in the same table rather than a separate library.

**Source tiers (to solve "measured data is often missing"):**

| Tier | Data source | Behavior in reverse-solve / cleansing |
|---|---|---|
| Tier 1 | Measured / PPAP | Assert feasibility directly |
| Tier 2 | Supplier statement / historical project | Assert, but mark "to be reviewed" |
| Tier 3 | Engineering experience / standard estimate | Use as the default fallback |
| **Tier 0** | **No data** | **Assert no feasibility; mark "process capability unknown, confirm with supplier"** |

**Why:** In reality Tier 1 is often missing. Tiering lets the system **degrade gracefully** — rigorous when data exists, honestly marked "unknown" when it doesn't, rather than guessing.

### Rules Library (Lib 2)

Standards such as CTS=6σ, CTF=4σ, and a default target of Cpk≥1.33. They change slowly and are authoritative, so they need **version locking and change logs**.

### Terminology Library (Lib 3, a controlled dictionary)

A "controlled dictionary" that **keeps the model from inventing terms or misclassifying**. It has three lookup tables:

1. **Part-category vocabulary**: a fixed list of categories (housing / bracket / screw / foam / adhesive / switch / glass / PCBA…) → validates the part category and serves as the index key for Lib 1.
2. **Subsystem vocabulary**: tags each part with a subsystem (ME / PCBA / Glass / Display…) → the prerequisite for detecting "cross-subsystem risk."
3. **Datum vocabulary**: naming conventions for datum faces.

**How to build it:** No AI — extract from the part names already in the existing TA template, organize them into a flat list, and tag each part with its subsystem. It's just a lookup table, extended when new parts appear.

**Why:** Without it, "cross-subsystem" and "category matching" are meaningless — the model wouldn't know that Glass and bracket belong to different subsystems. It's the index layer that lets the other two libraries and the structural-risk judgment line up.

### Maintenance Principles

- Human-maintained, not auto-learned (the same reason "experience distillation" was rejected — the risk of hardening mistakes).
- Every entry carries **source / confidence / effective version**; only then can a cleansing conclusion be flagged "in-library / out-of-library."
- A single owner, a change log, and published **coverage** (e.g. "Lib 1 covers 6/20 high-frequency categories").
- Distribution factor constants (Normal=1 / Uniform=1.732 / …) are **built-in engine constants**, not part of the knowledge base.
- **Feeding measured Cpk back into Lib 1 is handled by F7 (see D8).**

---

## D2 · Objective Interpretation: State the Evidence, Leave Judgment to the User

**No prescriptive advice** — assert only what calculation or rules can prove. The mechanism: **tag every statement with an "assertion type."**

| Tag | Meaning | Can assert directly? |
|---|---|---|
| `FACT` | A pure computed result (Cpk=0.74, A contributes 62%) | ✅ State directly |
| `RULE` | An objective comparison to a threshold (0.74 < 1.33) | ✅ State directly |
| `SIGNAL` | A signal needing engineering judgment | ⚠ Flag "worth noting" only, no conclusion |
| `OPTION` | An alternative path and its quantified consequence | 📊 Presented in parallel, not ranked, not recommended |

**Rewrite example:** Change "recommend tightening part A" to **"Part A contributes 62%; if its tolerance is ×0.5, Cpk goes from 0.74 to 1.05 (computed)."** State the cause and the numbers; leave the action to the user. The closing line is a **factual summary**, not advice.

**Benefit:** Judgments with no basis are removed from the system; the validation set only needs to check `FACT` and `RULE`, which is naturally regressable.

---

## D3 · SIGNAL List (flag only, no automatic conclusion)

**Cross-subsystem** (the dimension chain crosses different engineering subsystems with different tolerance habits, thermal expansion, and assembly methods):

- ME structural part ↔ PCBA (board thickness, component height)
- ME ↔ Glass / cover (glass cutting, lamination)
- ME ↔ Display module
- Metal part ↔ plastic part (large difference in thermal expansion)
- Hard part ↔ soft part (foam / adhesive / gasket)

**Non-geometric variables** (involve physical behavior and can't be stacked linearly as rigid bodies):

- Switch / button travel and compression
- Foam compression ratio (non-linear, changes under load)
- Adhesive layer thickness (cure shrinkage, press deformation)
- Gasket compression
- Preload and deformation from screw torque
- Thermal expansion (varies with temperature, not the assembly state)
- Elastic-part / snap-fit assembly deformation

---

## D4 · Preventing Fabrication: When in Doubt, Stop and Confirm

**Principle: better to ask than to invent.** The real uncertainty isn't the datum "direction" but the **assembly datum face / stack start** — the model can read the numbers but can't tell from the table which face the physical stack starts from or which faces mate (that information is in the drawing / 3D, out of scope for V1).

The mechanism is an **assumption list plus a confirmation gate**:

1. Any "non-pure-calculation" inference (assembly datum face, whether the loop is closed, cross-subsystem attribution) may only be asserted if evidence can be obtained from the input.
2. When evidence is missing or ambiguous — **don't guess** — raise a targeted clarification card with candidates:
   > ⚠ Need your confirmation: in this dimension chain, which face of part A is the **assembly datum face**? (It determines the stack start and can't be judged from the table.)
3. **Local hold**: confirmed parts are analyzed as usual; conclusions that depend on this assumption are held, and nothing is computed on a wrong premise.
4. All assumptions are listed together; the final version is issued after the user confirms or corrects them.

> **Cross-subsystem attribution**: which subsystem a part belongs to (ME/PCBA/Glass…) is judged by the Lib 3 subsystem vocabulary; **when not found, it also becomes a confirmation item.**

---

## D5 · Spec Reverse-Solve (2–3 parallel options + over-spec warning)

Goal: compute the total σ needed to reach Cpk_target=1.33, back out the variation to eliminate, and generate **parallel** options (not recommended, only compared):

| Option | Strategy | Applicability |
|---|---|---|
| Option A · single-point tighten | Tighten only the top contributor to pass | Simple; if it exceeds process capability, mark it infeasible |
| Option B · top 2–3 combined tighten | Split the tightening by contribution ratio | More realistic, less pressure on any single part |
| Option C · center plus tighten | Do zero-cost mean-centering first, then tighten the remaining gap | Most economical when there is a nominal offset |

Each option outputs: new tolerance per part → resulting Cpk → **feasibility flag (against Lib 1 process capability)** → relative cost estimate.

**Over-spec warning (core):** when the solved tolerance is tighter than what the process can achieve for that part class → a **red warning**, to keep the user from blindly narrowing the tolerance:

> ⚠ Target tolerance 0.02 is already below the process-achievable 0.05 for this part class (Tier 2) — **not achievable in process; forcing it will collapse yield and spike cost.**

For Tier 0 (no capability data), mark "feasibility unknown, confirm with supplier."

---

## D6 · Interaction Design: Read-Only Evidence Pane, What You See Is the Basis

**No need to reopen Excel after uploading.** The premise: present the original TA data **faithfully, read-only, and unaltered**, so the user trusts what they see rather than a black box.

**Layout: evidence on the left, dialogue on the right**

- **Left (read-only evidence)**: reproduce the `Example_TA` factor table exactly — same values, layout, and units, **not editable** — with the extracted **Loop screenshot** directly below. It is a "replica view," not re-entry.
- **Right (dialogue)**: every conclusion **cites a visible row or cell on the left** ("see row 3, part A, contribution 62%"); clicking a conclusion highlights the corresponding row on the left.

**Three levels of trust**: see the raw data (trust your eyes) → see the system's values match Excel (trust the engine) → see that each interpretation is traceable (trust the conclusion).

**Read-only guarantee plus two paths to change data:** source data is never silently overwritten; to change it, the user edits Excel and re-uploads, or the system proposes a difference that is applied only after confirmation.

---

## D7 · Data-to-Drawing Linking (DIM ID): Active Drawing Loop, No Image Recognition

**The field's real need is to trace from the TA table to the drawing dimension — and to enforce it before it's too late.** The approach here is deliberately **lightweight**: reuse the `DIM ID` field (plus tags) already in the TA template to uniquely link each factor to a drawing dimension. This is **identifier linking, not OCR / image recognition** — reading drawing images is out of scope for now.

Mechanism — **Sub-loop A · linking:**

1. Build a link table `DIM ID ↔ factor ↔ (future) measurement` and validate uniqueness.
2. **Missing-ID handling**: when a DIM ID or PN is missing, keep the 1D TA path available but group the affected factors by Lib 3 part category/drawing and create a locatable dimension-chain list. The list carries part name, join number, DIM ID/PN state, and exact source location.
3. **Uniqueness plus cross-source reconciliation**, so IDs stay unique and the link doesn't drift. Inside Microsoft a shared template already keeps IDs consistent, so a strict naming convention adds little value; the real drift risk is at the **Microsoft-to-supplier boundary** (their own numbering plus revisions). So the mechanism is a **crosswalk table** that maps external IDs onto the canonical ID, stopping to confirm on conflicts (see D4) — not an enforced naming scheme.

Mechanism — **Sub-loop B · ADO orchestration and scheduled governance** (from the factory meeting; this substrate is **shared with the D8 data loop**):

4. **Run entry:** the user manually uploads the TA `.xlsx`; creating or linking an ADO work item is optional. The tool runs on the uploaded file; auto-parsing an ADO attachment is a later goal.
5. **Owner assignment:** when an ADO item is linked, bind the governed reminder workflow to its owner or `Request By` field, with a clarification fallback when missing.
6. **Scheduled reminders (server-side):** for a linked ADO item, a **server-side background service** runs weekly or monthly, **independent of whether the analysis is running**, reading Microsoft program milestones via `surface-mcp` (`GetProgramMilestones`) and open items via `workiq`; as a **key milestone (e.g. EV1)** approaches with DIM IDs still placeholder or missing, it **reminds the owner on ADO**. Reminding early avoids discovering missing information only at the key milestone.
7. **ADO or local fallback:** reuse the ADO choice made at upload. If an ADO item is linked, ask the user to confirm the reminder, @mention the owner, and write the missing-ID list to `Comment 0`. If the user did not create or link ADO, save the list locally rather than blocking analysis.
8. **Packaged drawing reminder (server-side):** using the same server-side scheduler, remind the design owner — **once per drawing or group**, not per factor — to mark the dimension chain **on the drawing**.
9. **State and history on ADO:** for linked items, record missing-ID resolution and drawing-markup status for traceability.

**Why it's in scope:** it needs no image understanding, reuses existing fields, and is a **hard prerequisite for the D8 loop** (without a stable identifier, measured data cannot be routed back). ADO governance is optional: it adds owner-based traceability and reminders, while the local-list path preserves analysis when no ADO work item is desired.

**Difficulties:** missing or non-unique DIM IDs (handled by governance plus placeholders), reminders that are too frequent or sent to the wrong person (cadence tied to milestones plus an owner fallback), and the background service's ADO / MCP permission scope.

---

## D8 · Measured-Cpk Closed Loop: See the Real Gap Now, Improve the Knowledge Base Over Time

**This loop is what makes the whole system more valuable the more it's used:** when measured yield / Cpk becomes available, it is manually imported and routed back to the corresponding factor by `DIM ID`. Two payoffs:

- **Immediate:** the target dimension is recomputed with **real** capability, so the user sees the **real gap and real tolerance range** — and a comparison against the initial estimate. When the gap is large, the system hands off to F6 for adjustment options.
- **Compounding:** the matching Lib 1 entry is upgraded from "empirical estimate (Tier 3)" to "measured (Tier 1)," so cleansing, interpretation, and optimization are all more accurate next time. **The feedback target is F0**, closing the D1 loop.

**External prerequisite — where the measured data lives:**

Collecting and storing real Cpk data is **not something this project can control**; it needs an external agreement so measured data lands in a **single, centralized store — a SharePoint folder or a platform system** — with a stable structure. This is a hard, non-engineering prerequisite: without a known, agreed place to read from, the loop can't start.

**Scope — the read-in side only:**

1. Define a measurement data schema keyed by `DIM ID`; **manually import** the standardized measured data from the centralized store; read in the measured distribution; recompute σ (handling non-normal cases honestly).
2. Report "**initial estimate vs. measured**" and upgrade the Lib 1 entry from T3 to T1 with a version bump.
3. **No automatic write-back to Excel** — writing suggested specs back into the workbook is out of scope for now.

Automatic capture of measured data (avoiding manual upload for multi-part assemblies) is the natural next step once the loop and the centralized store are proven.

**Difficulties:**

- **DIM ID governance (D7) is a hard prerequisite** — without a stable identifier, there's nothing to route by.
- Measured distributions are often **non-normal**, so σ conversion must not blindly assume normal.
- The **centralized store** (SharePoint / platform) must be agreed and maintained externally; without it there's no source to import from.
- Manual import proves the loop first; automatic capture can follow once the store and loop are stable.

**Why read-in only:** it delivers the value of "see the real gap now, get more accurate over time" while deferring the riskier write-back and the cost questions of automatic capture. It also turns Lib 1's source-tier design (D1) from a documented concept into a path that is actually exercised.

---

## How the Decisions Shape the Feature Flow

Features are ordered by process flow (not by priority): **F0 knowledge base → F1 TA report parsing and asset prep → F2 data cleansing → F3 data-to-drawing linking (DIM ID) → F4 method recommendation and calculation engine → F5 data interpretation → F8 user interaction, read-only pane and output → F6 tolerance / dimension-chain optimization**, followed by the **F7 measured-Cpk closed loop** feeding measured Cpk back into F0. In the method branch, `>10` factors notify the DM team for 3D VA while F4 continues to calculate WC and RSS. The knowledge base (F0) and data interpretation (F5) decide the quality of the tool's judgment; the closed loop (F7) decides whether it gets better over time.

---
**Related docs:** [Architecture](01-architecture.md) · [End-to-End Flow](02-end-to-end-flow.md) · [Differentiation](03-differentiation.md) · [Feature Breakdown](04-feature-breakdown.md)
