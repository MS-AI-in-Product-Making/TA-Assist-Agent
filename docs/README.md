# Documentation · Index

Design document set for the Surface TA Analysis Agent (V1). All diagrams use Mermaid and render natively on GitHub.

| # | Document | Content |
|---|---|---|
| 01 | [Architecture](01-architecture.md) | V1 end-to-end system architecture (knowledge base + DIM ID anchor + ADO orchestration + engine + three output modes + closed loop) |
| 02 | [End-to-End Flow](02-end-to-end-flow.md) | Runtime flow: ADO trigger → cleansing → DIM ID link → method recommendation → interpretation → output → measured-Cpk closed loop |
| 03 | [Differentiation](03-differentiation.md) | Traditional Excel vs generic LLM vs dedicated Agent |
| 04 | [Feature Breakdown](04-feature-breakdown.md) | Epic → User Story → Feature → Task (mapped to Milestones / Issues) |
| 05 | [Design Decisions](05-design-decisions.md) | 3-class knowledge base · objective interpretation · clarification card · spec reverse-solver · read-only evidence pane · DIM ID association (D7) · closed-loop feedback (D8) |

## Conventions

- **Scope (V1):** No drawing-content **image** reading, no 3D VA (out of scope for now, may merge into V1 later). Data-to-drawing linking is done via **DIM ID metadata** (S3); the measured-Cpk closed loop (S8) reads in via manual import from a centralized store (SharePoint / platform), an out-of-band prerequisite.
- **Calculation engine:** 1D, **strictly consistent with the TA template Excel formulas**.
- **Tracking:** User Story IDs (S0–S9), ordered by process flow, ↔ GitHub Milestones; Features / Tasks ↔ Issues.
