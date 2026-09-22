# Differentiation

> Traditional TA Excel vs. general-purpose LLM vs. TA Assist Agent.
> The product advantage is not just calculation. It is governed data preparation, controlled rules, traceable interpretation, drawing governance, and measured-feedback continuity delivered through Copilot Skills and deterministic workflows.

## Three-Way Comparison (in process order)

Rows follow the end-to-end flow; the "Stage" column maps to the active F0-F7 capability set.

| Stage | Dimension | Traditional TA Excel | General-purpose LLM | TA Assist Agent |
|:---:|---|---|---|---|
| **F0** | Knowledge base | None — lives only in the engineer's head | None — no grounding | Three controlled knowledge bases (capability / rules / terminology); every judgment traces to versioned evidence |
| **F2** | Data cleansing | Manual, error-prone | No basis, generic talk | Checks required fields and validates tolerance range and distribution against the capability library, while preserving worksheet isolation |
| **F3** | Data-to-drawing linking | Manual, description-based, ambiguous | Cannot link | Links each factor to a drawing dimension via `(Drawing Number, DIM ID)` and prepares governed local or ADO follow-up |
| **F4** | Calculation | Template formulas are reliable | Often miscalculates, not reproducible | Reuses Excel-consistent formulas and deterministic validation gates |
| **F5** | Data interpretation | Depends on individual experience, hard to standardize | No rules, no knowledge base, one-off answers | Facts plus threshold checks plus contribution breakdown, with rule-based judgments citing controlled evidence |
| **F6** | Design optimization | Manual trial and error, time-consuming | Cannot calculate reliably | Mean-shift centering plus contribution economics plus RSS apportionment plus spec reverse-solve under governed validation |
| **F7** | Measured closed loop | None — measured data never flows back | None | Binds measured capability to the validated baseline and proposes governed knowledge feedback |
| — | Delivery surface | Raw workbook plus ad hoc follow-up | Chat only | Copilot Skills for orchestrated product runs plus direct workflow scripts for engineers who need phase-level control |
| Global | Scalability | Weak (depends on labor) | Weak (not trustworthy) | Strong (standardized / efficient / auditable) |
| Global | Positioning | A calculation tool | A one-off helper | **An objective-evidence provider + governed decision support system** |

## In One Sentence

> Excel only handles the math, and a general-purpose LLM is ungrounded. TA Assist Agent combines controlled libraries, deterministic calculations, governed interpretation, drawing governance, and measured feedback while keeping the final engineering decision with the reviewer.

---
**Related docs:** [Architecture](01-architecture.md) · [End-to-End Flow](02-end-to-end-flow.md) · [Feature Breakdown](04-feature-breakdown.md) · [Design Decisions](05-design-decisions.md)
