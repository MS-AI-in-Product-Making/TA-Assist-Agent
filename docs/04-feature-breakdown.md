# Feature Breakdown (V1)

> Hierarchy: **Epic → User Story → Feature → Task**, with Risk / Issue notes.
> User Story IDs (S0–S9) are ordered by process flow and map to [GitHub Milestones](https://github.com/MS-AI-in-Product-Making/AI-TVA-Analysis-Agent/milestones); their child Features / Tasks map to Issues.

## Epic

**Surface TA Analysis Agent (V1)**

> Goal: upgrade TA — previously done by people through "calculation plus experience-based interpretation" — into a tool with a knowledge base, rules, traceability, and a closed loop, delivering objective, well-grounded engineering decision support.

> **Process backbone:** S0 foundation → S1 parse → S2 cleanse → S3 DIM linking → S4 method → S5 engine → S6 interpret → S7 optimize → S9 interaction/output; **S8 closed loop** feeds production measured data back into S0, making the system more accurate over time.

> **Core features (⭐):** S0, S2, S3, S6, S7, S8, S9. Supporting features (S1, S4, S5) are kept lightweight.

---

## S0 · Knowledge Base ⭐ (the source of every judgment)

> Without a knowledge base, TA is just a calculator with no reference: cleansing has no basis, interpretation has no foundation, optimization has no view of cost. The knowledge base is human-maintained, with source, confidence, and coverage on every entry. See [Design Decision D1](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Feature | **Capability Library (Lib 1)**: reasonable tolerance band + process capability (source tiers: T1 measured/PPAP → T3 empirical → T0 no data) + recommended distribution |
| 📘 Feature | **Rules Library (Lib 2)**: CTS=6-sigma / CTF=4-sigma / Cpk≥1.33; distribution factors are engine constants and don't belong here |
| 📘 Feature | **Terminology Library (Lib 3)**: part-category vocabulary / subsystem (ME, PCBA, Glass, Display) / datum; used by S6 to detect cross-subsystem cases, and becomes a confirmation item when not found |
| 🔧 Task | Entry schema (source / confidence / effective version); publish coverage; single owner plus change log |
| ⚠ Risk | A missing or stale library misleads judgment: coverage must be published; T0 (no data) asserts no feasibility — when in doubt, stop |

## S1 · Report Parsing & Asset Prep (supporting)

| Type | Content |
|---|---|
| 📘 Feature | After uploading the xlsx, auto-detect worksheets containing TA content, reducing manual selection |
| 🔧 Task | Scan worksheets, recognize the fixed layout, list them for user confirmation |
| 📘 Feature | Process multiple worksheets in parallel to speed up output (review is still done page by page, gated by a human) |
| 🔧 Task | Parallel scheduling, parse the factor table (E14:T26), extract the Loop screenshot, aggregate |
| ⚠ Risk | Irregular worksheet names or layouts may cause missed detection, requiring manual selection as a fallback |

## S2 · Data Cleansing ⭐ (solves "manual cleansing is error-prone")

| Type | Content |
|---|---|
| 📘 Feature | Check whether user-filled information is missing |
| 🔧 Task | Required-field check: factor description / part name / part category / design nominal / tolerance / long-term and safety factor / sigma level / distribution (optional fields such as drawing number only prompt, not block) |
| 📘 Feature | Judge whether the input is reasonable against the Capability Library (Lib 1) |
| 🔧 Task | Load Lib 1, compare tolerance range, check whether the distribution is reasonable, highlight differences, and flag "in-library / out-of-library" |
| 📘 Feature | Include **DIM ID completeness** as part of cleansing (feeds S3) |
| 🔧 Task | Flag factors missing a DIM ID as a gap; do not block calculation, but carry it into later linking and reminders |
| 📘 Feature | Two paths to fix a difference: the user edits Excel, or the system edits the data and recomputes |
| ⚠ Issue | The library is still being filled in and incomplete, so coverage must be published honestly; when there is no measured data (T0), mark "process capability unknown" |

## S3 · Data-to-Drawing Linking · Active Drawing Loop ⭐ (NEW: identifier linking + ADO governance, no image recognition)

> Uses the `DIM ID` field already present in the TA template to uniquely link each factor to a drawing dimension (**identifier linking only, no OCR or image recognition**), and actively drives the DIM IDs and dimension chain onto the drawing before a key milestone (e.g. EV1). This is the "drawing loop." It also provides a shared ADO-trigger plus server-side scheduled reminder service, which the S8 data loop reuses as well. See [Design Decision D7](05-design-decisions.md).
>
> **Scenario:** An engineer creates an ADO work item and attaches the TA `.xlsx`; the system runs automatically. If the program is still pre-ASR (no drawing yet, so `Part Number` and `DIM ID` are just placeholders), a background service checks program milestones weekly or monthly; as a key milestone (e.g. EV1) approaches, it reminds the owner on ADO to complete the DIM IDs and reminds the designer to mark the dimension chain on the drawing — closing the loop.

**Sub-loop A · Linking (establish the link by identifier)**

| Type | Content |
|---|---|
| 📘 Feature | Use `DIM ID` as the unique identifier to link each factor to a drawing dimension |
| 🔧 Task | Build a `DIM ID ↔ factor ↔ (future) measurement` link table; validate uniqueness and completeness within a submission |
| 📘 Feature | Handle the "no drawing or ID early on" case (placeholder first, backfill later) |
| 🔧 Task | Assign placeholder IDs and add a reminder step so the purpose-dimension requirements are backfilled into the TA task later |
| 📘 Feature | **Microsoft-to-supplier ID reconciliation**: map the supplier's external IDs (by revision) onto Microsoft's canonical IDs |
| 🔧 Task | Build a crosswalk table (supplier ID + revision → canonical DIM ID) with uniqueness checks and versioning; a supplier ID change updates the crosswalk, not the canonical ID |
| 📘 Feature | Do only a lightweight format check (Microsoft templates are already fairly uniform; no strict naming convention needed internally) |
| 🔧 Task | Detect duplicate / missing / malformed DIM IDs and flag them (non-blocking); on a conflict or an unmapped external ID, raise a clarification card and stop to confirm first |
| ⚠ Risk | The real drift risk is at the supplier boundary, not inside Microsoft: the core is good mapping and conflict confirmation, not enforcing an internal naming convention |

**Sub-loop B · ADO orchestration and scheduled governance (shared substrate, reused by S8)**

| Type | Content |
|---|---|
| 📘 Feature | **Event trigger**: creating an ADO work item with the TA `.xlsx` attached runs the system automatically |
| 🔧 Task | ADO work-item webhook or polling, pull the attachment, start S1→S9 |
| 📘 Feature | **Owner assignment**: bind this run to a responsible person automatically |
| 🔧 Task | Resolve the owner from the ADO owner or `Request By` field; raise a clarification when missing |
| 📘 Feature | **Scheduled reminders (by milestone)**: check weekly or monthly and remind before information goes missing, independent of whether the analysis is running |
| 🔧 Task | A server-side background service reads milestones via `surface-mcp` (`GetProgramMilestones`) and open items via `workiq`; the cadence follows the milestones; as a key milestone (e.g. EV1) approaches with DIM IDs still missing, it reminds the owner on ADO |
| 📘 Feature | **Grouping by category (using the terminology library)**: when a report has many worksheets, group by part category plus description, since same-category dimensions usually live on the same drawing |
| 🔧 Task | Classify with Lib 3, aggregate by category or drawing, and keep a link from each `DIM ID` to its exact position (the same description at a different position may be a different dimension) so designers can jump to the exact dimension |
| 📘 Feature | **Dimension-chain list**: auto-generate a per-part list from the TA report for drawing markup |
| 🔧 Task | Generate `part name / join number / DIM ID` per part, as the reference target for drawing markup |
| 📘 Feature | **Drawing reminder (server-side scheduled)**: remind the design owner to mark the dimension chain on the drawing, packaged per drawing or group |
| 🔧 Task | The server-side scheduler reminds on a cadence, sends the grouped list to the owner (ADO), and tracks whether it has been marked on the drawing |
| 📘 Feature | **State and history**: record loop state on ADO for traceability |
| 🔧 Task | Track `placeholder → DIM ID filled → marked on drawing` per factor, keeping history on the work item |
| ⚠ Risk | Reminders too frequent or sent to the wrong person: tie the cadence to milestones and keep an owner fallback; the background service needs ADO / MCP permissions |

## S4 · Method Recommendation (supporting)

| Type | Content |
|---|---|
| 📘 Feature | Recommend a suitable target-tolerance reference method by factor count |
| 🔧 Task | Count and identify CTS/CTF: `<4` recommend WC, `4–10` recommend RSS, `>10` prompt to refer to DM; compute and output both WC and RSS |

## S5 · Calculation Engine (foundation of trust, fully consistent with Excel)

| Type | Content |
|---|---|
| 📘 Feature | Results are trustworthy and reproducible |
| 🔧 Task | Reproduce factor-level / system-level / capability metrics; regress against a sample (Cpk 0.74 / DPM 26500 / FAIL) |

## S6 · Data Interpretation ⭐ (objective five sections, the output face of the knowledge base)

> Positioning: assert only `FACT` (computed result) and `RULE` (threshold check); `SIGNAL` (needs engineering judgment) is only a flag, no conclusion; `OPTION` (alternatives) is presented in parallel, not ranked, not recommended — the final judgment is left to the user. Every `RULE` or capability judgment must cite the knowledge-base entry it relies on (entry version, coverage), so "grounded" is concrete rather than hand-wavy. See [Design Decisions D2 and D3](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Feature | **1 Loop validity**: Is it closed? Is it the same datum chain? Is the assembly datum face / stack start clear (raise a clarification card if not)? |
| 🔧 Task | Closed-loop check, datum-chain consistency, assembly datum face confirmation, additive/subtractive direction check |
| 📘 Feature | **2 Capability vs. spec**: RSS σ / Cpk judgment (`<1` fail, `1~1.33` at risk, `≥1.33` pass), and whether the spec window is `<6σ` (physically impossible) |
| 🔧 Task | Capability calculation, threshold judgment (cite the Lib 2 rule), 6-sigma feasibility check |
| 📘 Feature | **3 Top contributors**: ranked by contribution, with the top 2–3 marked and their causes (large tolerance / amplified mid-chain / direct one-directional effect on output) |
| 🔧 Task | Contribution ranking, cause classification |
| 📘 Feature | **4 Structural risk (SIGNAL, flag only)**: cross-subsystem datum chains (ME/PCBA/Glass), non-geometric variables (switch travel, non-linearity of foam and adhesive), overly long chains (`>10`) |
| 🔧 Task | Cross-subsystem detection (query Lib 3), non-geometric variable flagging, long-chain warning |
| 📘 Feature | **5 Options (OPTION, not ranked)**: present in parallel A keep design / B adjust spec / C optimize capability, with quantified consequences; CTF allows a spec-vs-yield trade-off, CTS forbids loosening; close with one `FACT` factual summary |
| 🔧 Task | Quantify the three paths, apply CTS/CTF constraints, produce a factual summary (no recommended action) |
| 📘 Feature | **6 Clarification card / assumption list (when in doubt, stop)**: don't guess when evidence is insufficient; raise a clarification card for the assembly datum face / stack start (with candidates) and hold the conclusions that depend on it; when cross-subsystem attribution isn't in Lib 3, make it a confirmation item |
| 🔧 Task | Assumption list plus a confirmation gate, assembly datum face clarification card, local hold |
| 📘 Feature | **7 Evidence citation**: every `RULE` or capability conclusion carries a reference to the knowledge-base entry and version it relies on |
| 🔧 Task | Attach entry ID / version / coverage to each `RULE` |
| ⚠ Risk | Interpretation may fabricate: controlled by the assertion-tag system + forced citation of knowledge-base entries + a clarification card when in doubt |

## S7 · Tolerance & Dimension-Chain Optimization ⭐ (formerly What-if, the part the field values most)

> Not just "compute Cpk," but answer "how to change it most economically." The three types of tolerance shortfall reported from the field map to three optimization levers. Output stays parallel and unranked, with judgment left to the user. See [Design Decision D5](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Feature | **Mean-shift centering**: detect nominal offset (often from a compressed part or empty insert) and give the zero-cost centering gain first |
| 🔧 Task | Detect the offset, recompute Cpk after centering, show before/after |
| 📘 Feature | **Contribution economics**: the larger a factor's contribution, the more economical it is to loosen; rank parts by cost-saving leverage |
| 🔧 Task | Rank by contribution-weighted leverage, estimate relative cost (loosen ratio × contribution), consider both tightening and loosening |
| 📘 Feature | **RSS apportionment**: distribute the required σ reduction across the top contributors by proportion |
| 🔧 Task | Compute the required σ reduction and apportion it across the top 2–3 |
| 📘 Feature | **What-if simulation**: quantify "tighten / loosen X → change in Cpk," turning causes into numbers |
| 🔧 Task | Perturb a single part's tolerance, recompute, compare before/after |
| 📘 Feature | **Spec reverse-solve**: give 2–3 parallel options (single-point tighten / top 2–3 combined / center plus tighten), each with new tolerances, resulting Cpk, and feasibility |
| 🔧 Task | Generate 2–3 options; a red warning when a target exceeds process capability (against Lib 1); mark T0 as "feasibility unknown" |

## S8 · Measured-Cpk Closed Loop ⭐ (NEW: measured data → real gap + knowledge-base upgrade)

> Backfill the supplier's **measured yield / Cpk** to the corresponding factor by `DIM ID`. Two things happen: (1) the target dimension is recomputed with real capability so the user sees the **real gap and real tolerance range** (versus the initial estimate); and (2) the matching Lib 1 entry is upgraded from "empirical estimate (T3)" to "measured (T1)," making the system more accurate over time. It reuses the ADO orchestration substrate from S3. See [Design Decision D8](05-design-decisions.md).
>
> **Scenario:** Once measured data is available, the owner backfills measured Cpk by `DIM ID`; the system re-runs TA with real capability and compares it against the initial estimate — when the gap is significant, it hands off to S7 for adjustment options.

| Type | Content |
|---|---|
| 📘 Feature | Ingest measured data by `DIM ID` |
| 🔧 Task | Define the measurement data schema (keyed by DIM ID); **manually import** from the centralized store (SharePoint / platform, agreed and set up externally); handle permissions |
| 📘 Feature | **Real gap / real tolerance**: recompute the target dimension with real capability |
| 🔧 Task | Recompute σ from measured data (handle non-normal cases); report the "estimated vs. measured" gap; hand off to S7 when the gap is large |
| 📘 Feature | Update the tier and σ of the Lib 1 entry from the measured distribution |
| 🔧 Task | Upgrade the entry from T3 to T1, bump the version, feed back into S0 |
| ⚠ Risk | **The centralized store (SharePoint / platform) is an external prerequisite** outside our control; DIM ID governance (S3) is a hard prerequisite; measured distributions may be non-normal, which affects σ conversion |
| 🔭 Later | Once the loop and the centralized store are proven, add **automatic capture** of measured data (manual upload is impractical for multi-part assemblies) and automatically writing suggested specs back into Excel |

## S9 · User Interaction · Read-Only Evidence Pane + Output Report ⭐

> No need to reopen Excel after uploading. Present the original TA data faithfully and read-only, so the user trusts what they see rather than a black box. See [Design Decision D6](05-design-decisions.md).

| Type | Content |
|---|---|
| 📘 Feature | **Read-only evidence pane**: the left side reproduces the `Example_TA` factor table read-only (same values, layout, and units), with the extracted Loop image below |
| 🔧 Task | Render the original table read-only, embed the Loop image |
| 📘 Feature | **Citable dialogue**: on the right, every conclusion cites a visible row or cell on the left; clicking highlights it; source data is never silently changed |
| 🔧 Task | Conclusion-to-cell citation linkage, read-only guarantee, two paths to change data |
| 📘 Feature | **Consolidated report**: a complete interpretation report including the Loop image, traceable item by item |
| 🔧 Task | Consolidated output |

---
**Related docs:** [Architecture](01-architecture.md) · [End-to-End Flow](02-end-to-end-flow.md) · [Differentiation](03-differentiation.md) · [Design Decisions](05-design-decisions.md)
