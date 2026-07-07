# Differentiation

> Traditional TA Excel vs generic LLM vs dedicated TA Agent (this project).
> This Agent's value is not "calculation automation" (the engine reuses Excel), but a **knowledge base + objective interpretation** that gives TA its soul, plus data-to-drawing traceability and a measured-Cpk closed loop — with the judgment left to the user.

## Three-Way Comparison (in process-flow order)

Rows follow the end-to-end flow; the `Stage` column maps to the Features in the [Feature Breakdown](04-feature-breakdown.md).

| Stage | Dimension | Traditional TA Excel | Generic LLM | Dedicated TA Agent (this project) |
|:---:|---|---|---|---|
| **F0** | Knowledge base (the soul) | None — lives in the engineer's head | None — no grounding | 3 controlled libraries (classified capability [source-tiered] / engineering rules / terminology·ontology); every judgment traces to a library entry |
| **F2** | Data cleansing | Manual, error-prone | No basis, generic talk | Missing required-field check + vs Classified Capability Library for tolerance range + distribution, flagged "in-library evidenced / out-of-library"; DIM ID completeness |
| **F3** | Data-to-drawing link (DIM ID) | Manual, description-based, ambiguous | Cannot link | Uniquely anchors each factor to a drawing dimension by DIM ID (metadata, not image reading); placeholder-first, backfill-later; **ADO auto-trigger + scheduled service (surface-mcp milestones + workiq) @mentions the owner before EV1 and reminds to put the chain on the drawing** |
| **F5** | Calculation (trust foundation) | Template formulas reliable | Often miscalculates / non-reproducible | Reuses the same Excel engine, consistent and reproducible |
| **F6** | Data interpretation (objective) | Personal experience, hard to standardize | No rules / knowledge base, one-off | Facts + threshold checks + contribution breakdown, **each RULE cites its F0 entry**; objectively stated, judgment left to user; stops to confirm when uncertain, never fabricates |
| **F7** | Tolerance / dimension-chain optimization | Manual trial, time-consuming | Cannot compute reliably | Mean-shift centering + contribution economics + RSS apportionment + spec reverse-solve (2-3 parallel options); **over-capability → RED warning** |
| **F8** | Closed loop (real Cpk) | None — measured data never returns | None | Backfill measured Cpk by DIM ID → **real gap vs initial estimate** + upgrade library from empirical (Tier 3) to measured (Tier 1); V1 manual MDA-export import (V2 MDA API); gets more accurate the more it is used |
| **F9** | User interaction | Read the raw Excel yourself | Chat only, no source view | Read-only faithful evidence pane + cited dialogue with click-to-highlight; source never silently edited |
| Global | Scalability | Weak (labor-dependent) | Weak (untrustworthy) | Strong (standardized / efficient / auditable) |
| Global | Positioning | Calculation tool | One-off helper | **Objective evidence provider + verifiable decision support** |

> Note: supporting features F1 (multi-sheet parsing) and F4 (method recommendation) also differ (parallel acceleration; rule-based reference with both WC/RSS computed) but are not the differentiating core.

## One-Line Differentiation

> Excel only solves "the math"; a generic LLM is an unfounded one-off tool. The dedicated Agent **grounds a reliable engine in a curated knowledge base**, delivers **structured, reproducible, auditable** objective interpretation, links data to drawings and closes the loop with measured Cpk — **the judgment is returned to the user**, and it stops to confirm wherever it is uncertain.

---
**Related docs:** [Architecture](01-architecture.md) · [End-to-End Flow](02-end-to-end-flow.md) · [Feature Breakdown](04-feature-breakdown.md) · [Design Decisions](05-design-decisions.md)
