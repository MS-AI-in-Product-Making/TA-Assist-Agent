# Documentation Index

Design document set for the Surface TA Analysis Agent (V1). All diagrams use Mermaid and render directly on GitHub.

| No. | Document | Content |
|---|---|---|
| 00 | [Overview](00-overview.md) | One-page What / Why / How and business value |
| 01 | [Architecture](01-architecture.md) | V1 end-to-end architecture (knowledge base + DIM ID linking + ADO orchestration + calculation engine + three output modes + closed loop) |
| 02 | [End-to-End Flow](02-end-to-end-flow.md) | Runtime flow: ADO trigger → cleansing → DIM ID linking → method recommendation → interpretation → output → measured-data closed loop |
| 03 | [Differentiation](03-differentiation.md) | Traditional Excel vs. general LLM vs. dedicated Agent |
| 04 | [Feature Breakdown](04-feature-breakdown.md) | Epic → User Story → Feature → Task (mapped to Milestones / Issues) |
| 05 | [Design Decisions](05-design-decisions.md) | Three knowledge bases, objective interpretation, clarification card, spec reverse-solve, read-only evidence pane, DIM ID linking (D7), measured closed loop (D8) |

## Shared Conventions

- **V1 scope:** No drawing image recognition, no 3D VA (out of scope for now; may be merged into V1 later). Data-to-drawing linking is done through **DIM ID** (S3); the measured-data closed loop (S8) first imports data manually from a centralized store (SharePoint / platform), which is an external prerequisite outside the project's control.
- **Calculation engine:** One-dimensional, and **fully consistent** with the Excel formulas in the TA template.
- **Tracking:** User Story IDs (S0–S9) are ordered by process flow and map to GitHub Milestones; their child Features / Tasks map to Issues.
- **Reminder timing:** A server-side service periodically checks program milestones and reminds the owner to complete missing information **before a key milestone (e.g. EV1)**. This wording is used consistently across all documents.

## Terminology

To avoid ambiguity, the following terms are used consistently across all documents:

- **Factor**: Each dimension entry in the TA report that participates in the dimension-chain calculation.
- **Part**: The physical component a factor corresponds to.
- **Owner**: The responsible person determined from the ADO work item fields.
- **DIM ID**: An existing dimension identifier in the TA template, used as the unique key that links a factor to a drawing dimension.
- **Three knowledge bases**: Capability Library (Lib 1), Rules Library (Lib 2), Terminology Library (Lib 3).
- Technical abbreviations kept in their standard form: Cpk, RSS, WC, σ, DPM, CTS, CTF, ADO, EV1, PPAP, xlsx, etc.
