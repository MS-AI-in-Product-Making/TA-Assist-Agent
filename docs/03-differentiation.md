# Differentiation

> Traditional TA Excel vs. general-purpose LLM vs. AI Assist Agent.
> This tool's value isn't "automating the calculation" (the calculation itself reuses Excel). It's the combination of a knowledge base and grounded, objective interpretation, plus traceable linking between data and drawings and a measured-Cpk closed loop — while leaving the final judgment to the user.

## Three-Way Comparison (in process order)

Rows follow the end-to-end flow; the "Stage" column maps to the Feature IDs in the [Feature Breakdown](04-feature-breakdown.md).

| Stage | Dimension | Traditional TA Excel | General-purpose LLM | AI Assist Agent |
|:---:|---|---|---|---|
| **F0** | Knowledge base | None — lives only in the engineer's head | None — no grounding | Three controlled knowledge bases (capability / rules / terminology); every judgment traces back to a specific entry |
| **F2** | Data cleansing | Manual, error-prone | No basis, generic talk | Checks required fields and validates tolerance range and distribution against the capability library, flagging "in-library / out-of-library"; also checks whether DIM IDs are complete |
| **F3** | Data-to-drawing linking (DIM ID) | Manual, description-based, ambiguous | Cannot link | Uniquely links each factor to a drawing dimension via DIM ID (identifier only, no image recognition); groups by category and locates the exact position; placeholder first, backfill later; when an optional ADO item is linked, scheduled reminders notify the owner before EV1 or another key milestone to complete and mark the chain on the drawing |
| **F4** | Calculation | Template formulas are reliable | Often miscalculates, not reproducible | Reuses the same Excel formulas; consistent and reproducible |
| **F5** | Data interpretation | Depends on individual experience, hard to standardize | No rules, no knowledge base, one-off answers | Facts plus threshold checks plus contribution breakdown, with every rule-based judgment citing a knowledge-base entry; states things objectively and leaves judgment to the user; confirms when in doubt, never fabricates |
| **F6** | Tolerance / dimension-chain optimization | Manual trial and error, time-consuming | Cannot calculate reliably | Mean-shift centering plus contribution economics plus RSS apportionment plus spec reverse-solve (2–3 parallel options); a red warning when a target exceeds process capability |
| **F7** | Measured closed loop | None — measured data never flows back | None | Backfills measured Cpk by DIM ID, compares against the initial estimate, and upgrades capability-library entries from empirical (Tier 3) to measured (Tier 1); imported manually from a centralized store at first, and gets more accurate with more data |
| **F8** | Interaction | Read the raw Excel yourself | Chat only, no view of the source data | A read-only evidence pane on the left plus citable interpretation on the right, with click-to-highlight linking; source data is never silently changed |
| Global | Scalability | Weak (depends on labor) | Weak (not trustworthy) | Strong (standardized / efficient / auditable) |
| Global | Positioning | A calculation tool | A one-off helper | **An objective-evidence provider + verifiable decision support** |

> Note: The supporting features F1 (multi-worksheet parsing) and F4 (method recommendation and calculation engine) also differ (parallel speed-up; rule-based recommendation with both WC and RSS computed), but they are not the core differentiator.

## In One Sentence

> Excel only handles "getting the math right"; a general-purpose LLM is an ungrounded, one-off tool. This tool adds a controlled knowledge base on top of a reliable calculation engine, delivers structured, reproducible, auditable objective interpretation, links data to drawings via DIM ID, and closes the loop with measured Cpk — returning the final judgment to the user and stopping to confirm wherever there is doubt.

---
**Related docs:** [Architecture](01-architecture.md) · [End-to-End Flow](02-end-to-end-flow.md) · [Feature Breakdown](04-feature-breakdown.md) · [Design Decisions](05-design-decisions.md)
