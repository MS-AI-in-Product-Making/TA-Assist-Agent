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

- [01 · System Architecture · 系统架构图](docs/01-architecture.md)
- [02 · End-to-End Flow · 端到端流程图](docs/02-end-to-end-flow.md)
- [03 · Differentiation · 差异化对比](docs/03-differentiation.md)
- [04 · Feature Breakdown · 功能分解](docs/04-feature-breakdown.md)

---

## Why an Agent (not Excel, not a generic LLM)

| Dimension | Traditional TA Excel | Generic LLM | **Dedicated TA Agent** |
|---|---|---|---|
| Data cleansing | Manual, error-prone | No basis | Missing-field check + per-category spec/distribution validation |
| Method choice | By experience | Unconstrained | Rule-based recommendation; **both WC & RSS computed** |
| Calculation | Reliable formulas | Often wrong / non-reproducible | Reuses the **same Excel engine** |
| Interpretation basis | Personal experience | No rules / knowledge base | TA-expert role + fixed **5-section output** |
| Result | Hard to standardize | One-off, unstructured | Structured, standardized, reproducible |
| Multi-sheet | Page-by-page manual | Serial, uncontrolled | Parallel acceleration (review still per-page) |
| Positioning | Calculation tool | One-off helper | Standardized interpretation + decision assistant |

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
| **F1 Report parsing & asset prep** | Auto-detect TA worksheets; parallel processing; factor-table parse (E14:T26); extract Loop screenshot |
| **F2 Data cleansing** | Missing required-field check; per-category spec & distribution validation; two correction paths |
| **F3 Method recommendation** | Factor count + CTS/CTF; `<4`→WC, `4–10`→RSS, `>10`→refer to DM; both WC & RSS computed |
| **F4 Calculation engine** | Excel-consistent per-factor / system / capability; sample regression |
| **F5 Standardized interpretation** | TA-expert role, fixed 5-section output (see below) |
| **F6 What-if & centering analysis** | Quantify tighten-impact on Cpk; zero-cost mean-centering gains |
| **F7 Output report** | Consolidated interpretation report incl. Loop image |

### F5 — Fixed 5-section interpretation
1. **Loop validity** — closed loop? same datum chain? add/subtract direction correct?
2. **Capability vs Spec** — RSS σ / Cpk (`<1` FAIL · `1–1.33` risk · `≥1.33` PASS); spec window `<6σ` physically infeasible?
3. **Top contributors** — ranked by % contribution; Top 2–3 with cause (large tol / mid-stack amplification / direct single-direction effect)
4. **Structural risk** — cross-domain datum chain (ME/PCBA/Glass); non-geometric variables (switch travel, foam/adhesive); over-long stack (`>10`)
5. **Decision** — A keep design / B adjust spec / C optimize capability; CTF allows spec↔yield trade-off, CTS forbids loosening spec; one-line summary

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
