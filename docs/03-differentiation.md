# Differentiation

> Traditional TA Excel vs generic LLM vs dedicated TA Agent (this project).
> This Agent's value is not "calculation automation" (the engine reuses Excel), but **evidence-backed presentation, automated cleansing gatekeeping, and quantifying root causes into optional plans — with the judgment left to the user**.

## Three-Way Comparison (by priority P0→P5, pipeline stage preserved)

Rows are ordered by value from high to low; the `Stage` column maps to the Features in the [Feature Breakdown](04-feature-breakdown.md), so both orderings are readable in one table.

| Priority | Stage | Dimension | Traditional TA Excel | Generic LLM | Dedicated TA Agent (this project) |
|:---:|:---:|---|---|---|---|
| **P0** | F2 | Data cleansing | Manual, error-prone | No basis, generic talk | 1 missing required-field check; 2 vs Classified Capability Library for tolerance range + distribution, flagged "in-library evidenced / out-of-library" |
| **P1** | F6 | What-if / Spec reverse-solve / centering | Manual trial, time-consuming | Cannot compute reliably | Quantify "tighten X -> Cpk change", 2-3 parallel spec reverse-solve options, centering gains; **over-capability -> RED warning** (prevents blindly shrinking a tolerance band that cannot be made) |
| **P2** | F4 | Calculation (trust foundation) | Template formulas reliable | Often miscalculates / non-reproducible | Reuses the same Excel engine, consistent and reproducible |
| **P3** | F5 | Interpretation (objective presentation) | Personal experience, hard to standardize | No rules / knowledge base, one-off | Facts + threshold checks + contribution breakdown, **objectively stated, judgment left to user**; stops to confirm when uncertain, never fabricates |
| **P4** | F1 | Multi-sheet / asset processing | Manual, page-by-page serial | Serial, uncontrolled | Auto-detect + parallel acceleration (review still per-page, human-gated) |
| **P5** | F3 | Method choice | By experience | Generic advice, unconstrained | Rule-based reference by factor count (both WC / RSS computed) |
| — | Global | Scalability | Weak (labor-dependent) | Weak (untrustworthy) | Strong (standardized / efficient / auditable) |
| — | Global | Positioning | Calculation tool | One-off helper | **Objective evidence provider + verifiable decision support** |

## One-Line Differentiation

> Excel only solves "the math"; a generic LLM is an unfounded one-off tool. The dedicated Agent **layers a rules library + Classified Capability Library on top of a reliable engine**, delivering **structured, reproducible, auditable** evidence and quantified options — **the judgment is returned to the user**, and it stops to confirm wherever it is uncertain.

---
**Related docs:** [Architecture](01-architecture.md) · [End-to-End Flow](02-end-to-end-flow.md) · [Feature Breakdown](04-feature-breakdown.md) · [Design Decisions](05-design-decisions.md)
