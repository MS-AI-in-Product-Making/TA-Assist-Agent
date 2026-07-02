# AI TVA Analysis Agent

An AI agent that automates **Tolerance / Variation Analysis (T/VA)** interpretation for the
Microsoft Surface program and its downstream ODM / supplier partners.

The agent ingests a filled-in T/VA template (`.xlsx`), reuses the exact calculation engine of the
Excel template, and produces **standardized, evidence-backed engineering decisions** — instead of
relying on individual engineers' experience.

> **Scope: V1.** Drawing-content reading and 3D Variation Analysis (VSA) are explicitly **out of
> scope** for V1 and tracked for V2.

## Documentation

Full design docs live in [`docs/`](docs/README.md) (Mermaid diagrams render natively on GitHub):

- [01 · System Architecture](docs/01-architecture.md)
- [02 · End-to-End Flow](docs/02-end-to-end-flow.md)
- [03 · Differentiation](docs/03-differentiation.md)
- [04 · Feature Breakdown](docs/04-feature-breakdown.md)
- [05 · Design Decisions (D1–D6)](docs/05-design-decisions.md)

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

Ordered by value priority (P0 highest). See [full table](docs/03-differentiation.md).

| Priority · Stage | Dimension | Traditional TA Excel | Generic LLM | **Dedicated TA Agent** |
|---|---|---|---|---|
| **P0 · Cleansing** | Data cleansing | Manual, error-prone | No basis | Missing-field check + per-category **Capability Library** (tolerance band / process capability / distribution) validation |
| **P1 · What-if** | Decision support | Manual re-runs | Cannot compute | What-if + **Spec reverse-solver** (2–3 parallel options, **over-capability warning**) + mean-centering |
| **P2 · Engine** | Calculation | Reliable formulas | Often wrong / non-reproducible | Reuses the **same Excel engine** |
| **P3 · Interpret** | Interpretation | Personal experience | No rules / knowledge base | TA-expert role, fixed **5-section** output — **objective, judgment left to user** |
| **P4 · Parse** | Multi-sheet | Page-by-page manual | Serial, uncontrolled | Parallel acceleration (review still per-page) |
| **P5 · Method** | Method choice | By experience | Unconstrained | Rule-based reference; **both WC & RSS computed** |
| Global | Result | Hard to standardize | One-off, unstructured | Structured, standardized, traceable |
| Global | Basis | Engineer's experience | None | Rules + curated **knowledge base**, every claim cited |

---

## Knowledge Base (3 classes — the foundation, F0)

1. **Classified Capability Library** — reasonable tolerance band + process capability (**source-tiered** T1 measured/PPAP → T3 empirical → T0 no-data) + recommended distribution.
2. **Engineering Rules Library** — CTS = 6σ / CTF = 4σ / Cpk ≥ 1.33 (distribution factors are engine constants, not stored here).
3. **Terminology / Ontology Library** — part-category vocabulary / subsystem (ME·PCBA·Glass) / datum.

Human-curated with source / confidence / coverage. T0 (no data) is marked "capability unknown, confirm with supplier" — never asserted feasible.

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

## V1 Scope (Epic → Feature → Story → Task)

**Epic:** Surface T/VA Analysis Agent (V1)

| Feature | Summary |
|---|---|
| **F0 Knowledge base** | 3-class library: Classified Capability Library (source-tiered) / Engineering Rules / Terminology·Ontology |
| **F1 Report parsing & asset prep** | Auto-detect TA worksheets; parallel processing; factor-table parse (E14:T26); extract Loop screenshot |
| **F2 Data cleansing** | Missing required-field check; per-category Capability Library & distribution validation; two correction paths |
| **F3 Method recommendation** | Factor count + CTS/CTF; `<4`→WC, `4–10`→RSS, `>10`→refer to DM; both WC & RSS computed |
| **F4 Calculation engine** | Excel-consistent per-factor / system / capability; sample regression |
| **F5 Standardized interpretation** | TA-expert role, fixed 5-section output — **objective (FACT/RULE/SIGNAL/OPTION)**; clarification card when uncertain |
| **F6 What-if / Spec reverse-solve / centering** | Quantify tighten-impact on Cpk; 2–3 reverse-solve options (over-capability warning); zero-cost mean-centering |
| **F7 Output report** | Consolidated report incl. Loop image; **read-only evidence pane** (no need to reopen Excel) |

### F5 — Fixed 5-section interpretation (objective; judgment left to user)
1. **Loop validity** — closed loop? same datum chain? **assembly datum face / stack start** clear? (if uncertain → clarification card)
2. **Capability vs Spec** — RSS σ / Cpk (`<1` FAIL · `1–1.33` risk · `≥1.33` PASS); spec window `<6σ` physically infeasible?
3. **Top contributors** — ranked by % contribution; Top 2–3 with cause (large tol / mid-stack amplification / direct single-direction effect)
4. **Structural risk (SIGNAL, flag only)** — cross-domain datum chain (ME/PCBA/Glass); non-geometric variables (switch travel, foam/adhesive); over-long stack (`>10`)
5. **Options (OPTION, not ranked)** — A keep design / B adjust spec / C optimize capability, each with quantified consequence; CTF allows spec↔yield trade-off, CTS forbids loosening spec; one-line **FACT** summary (no recommended action)

---

## V2 Backlog (not in V1)

- Drawing-content reading (extract nominal/tol from 2D drawings/PDF)
- Three-way consistency (user ⇄ drawing ⇄ knowledge base)
- 3D VA (VSA-class tool integration)
- Real process-capability data ingestion
- Write-back to Excel (Auto Summary / suggested spec)
- ADO linkage (auto-create work items for FAIL)
- Monte Carlo (Quantum XL) integration

---

## Repository Notes

- `test/` and all `*.xlsx` (confidential templates / sample data) are **git-ignored**.
- Internal `*.html` design reports are **git-ignored** and not committed.
- Project planning is tracked via GitHub **Milestones** (one per Feature) and **Issues** (Stories/Tasks).

---

*Microsoft Confidential — engine reverse-engineered from template M1160113 REV_D.*
