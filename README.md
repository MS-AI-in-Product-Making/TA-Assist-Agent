# AI TA Analysis Agent

An AI agent that automates **Tolerance Analysis (TA)** interpretation for the
Microsoft Surface program and its downstream ODM / supplier partners.

The agent ingests a filled-in TA template (`.xlsx`), reuses the exact calculation engine of the
Excel template, and produces **standardized, evidence-backed engineering decisions** — instead of
relying on individual engineers' experience.

## Two Core Highlights

1. **Process automation** — ADO-triggered runs, **server-side scheduled reminders** (independent of whether the agent is running), and measured-data backfill that connect **design ⇄ analysis ⇄ real data** into a traceable closed loop.
2. **Data interpretation** — objective, evidence-backed **5-section** reading (every RULE cites a knowledge-base entry), with the final judgment left to the engineer.

> **Scope.** Drawing-content **image** reading and 3D VA are out of scope for now (they may be merged in later when needed). Data-to-drawing linking is done via **DIM ID metadata** (not image reading).

## Documentation

Full design docs live in [`docs/`](docs/README.md) (Mermaid diagrams render natively on GitHub):

- [01 · System Architecture](docs/01-architecture.md)
- [02 · End-to-End Flow](docs/02-end-to-end-flow.md)
- [03 · Differentiation](docs/03-differentiation.md)
- [04 · Feature Breakdown](docs/04-feature-breakdown.md)
- [05 · Design Decisions (D1–D8)](docs/05-design-decisions.md)

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

| Stage | Dimension | Traditional TA Excel | Generic LLM | **Dedicated TA Agent** |
|---|---|---|---|---|
| **F0 · Knowledge base (soul)** | Basis | Lives in the engineer's head | No grounding | 3 controlled libraries; every judgment traces to a library entry |
| **F2 · Cleansing** | Data cleansing | Manual, error-prone | No basis | Missing-field + DIM ID check + per-category **Capability Library** (tolerance band / capability / distribution) validation |
| **F3 · DIM link** | Data-to-drawing | Manual, ambiguous | Cannot link | Anchor each factor to a drawing dimension by **DIM ID** (metadata, not image reading); **ADO auto-trigger + server-side scheduled EV1 reminder** (surface-mcp + workiq, independent of the agent) drives DIM IDs onto the drawing |
| **F5 · Engine** | Calculation | Reliable formulas | Often wrong / non-reproducible | Reuses the **same Excel engine** |
| **F6 · Interpret** | Interpretation | Personal experience | No rules / knowledge base | Fixed **5-section** output, **objective, each RULE cites its F0 entry**, judgment left to user |
| **F7 · Optimize** | Tolerance optimization | Manual re-runs | Cannot compute | Mean-shift centering + contribution economics + RSS apportionment + **spec reverse-solve** (over-capability warning) |
| **F8 · Closed loop** | Real Cpk | Measured data never returns | None | Backfill measured Cpk by DIM ID → **real gap vs estimate** + library **T3 empirical → T1 measured** |
| **F9 · Interaction** | User trust | Read raw Excel yourself | Chat only | Read-only faithful evidence pane + cited dialogue |
| Global | Result | Hard to standardize | One-off, unstructured | Structured, standardized, traceable |

---

## Knowledge Base (3 classes — the soul, F0)

The knowledge base is what gives TA its soul: without it, cleansing has no yardstick, interpretation has no basis, optimization has no cost view.

1. **Classified Capability Library** — reasonable tolerance band + process capability (**source-tiered** T1 measured/PPAP → T3 empirical → T0 no-data) + recommended distribution.
2. **Engineering Rules Library** — CTS = 6σ / CTF = 4σ / Cpk ≥ 1.33 (distribution factors are engine constants, not stored here).
3. **Terminology / Ontology Library** — part-category vocabulary / subsystem (ME·PCBA·Glass) / datum.

Human-curated with source / confidence / coverage. T0 (no data) is marked "capability unknown, confirm with supplier" — never asserted feasible. **Fed by the F8 closed loop** so it improves over time.

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

## V1 Scope (Epic → User Story → Feature → Task)

**Epic:** Surface TA Analysis Agent (V1)

| User Story | Summary |
|---|---|
| **F0 Knowledge base** ⭐ | 3-class library: Classified Capability Library (source-tiered) / Engineering Rules / Terminology·Ontology — the soul |
| **F1 Report parsing & asset prep** | Auto-detect TA worksheets; parallel processing; factor-table parse (E14:T26); extract Loop screenshot |
| **F2 Data cleansing** ⭐ | Missing required-field + DIM ID check; per-category Capability Library & distribution validation; two correction paths |
| **F3 Dimension-to-drawing link (DIM ID)** ⭐ | Anchor each factor to a drawing dimension by DIM ID (metadata, not image reading); placeholder-first, backfill-later; **group worksheets by part category (F0 Lib 3 ontology)** so same-category dimensions are packaged per drawing, with a traceable link from each item to its specific location; **ADO auto-trigger + server-side scheduled reminders (surface-mcp milestones + workiq) @mention owner before EV1** + remind to put the chain on the drawing |
| **F4 Method recommendation** | Factor count + CTS/CTF; `<4`→WC, `4–10`→RSS, `>10`→refer to DM; both WC & RSS computed |
| **F5 Calculation engine** | Excel-consistent per-factor / system / capability; sample regression |
| **F6 Data interpretation** ⭐ | Fixed 5-section output — **objective (FACT/RULE/SIGNAL/OPTION)**, each RULE cites its F0 entry; clarification card when uncertain |
| **F7 Tolerance / dimension-chain optimization** ⭐ | Mean-shift centering + contribution economics + RSS apportionment + spec reverse-solve (over-capability warning) |
| **F8 Closed-loop real-Cpk feedback** ⭐ | Backfill measured Cpk by DIM ID → real gap vs estimate + upgrade library T3→T1. Reads in via manual import from a **centralized measured-data store (SharePoint / platform)** that must be set up out-of-band (external prerequisite) |
| **F9 User interaction / read-only pane + output** ⭐ | Read-only faithful evidence pane + cited dialogue + consolidated report incl. Loop image |

### F6 — Fixed 5-section interpretation (objective; judgment left to user)
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
- 3D VA (VSA-class tool integration)
- **Automatic API capture** of measurement data (the loop is proven first via manual import from the centralized store)
- Write-back to Excel (Auto Summary / suggested spec)
- Monte Carlo (Quantum XL) integration

---

## Repository Notes

- `test/` and all `*.xlsx` (confidential templates / sample data) are **git-ignored**.
- Internal `*.html` design reports are **git-ignored** and not committed.
- Project planning is tracked via GitHub **Milestones** (one per User Story, F0–F9) and **Issues** (Features / Tasks).

---

*Microsoft Confidential — engine reverse-engineered from template M1160113 REV_D.*
