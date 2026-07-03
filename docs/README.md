# Documentation · Index

Design document set for the Surface T/VA Analysis Agent (V1). All diagrams use Mermaid and render natively on GitHub.

| # | Document | Content |
|---|---|---|
| 01 | [Architecture](01-architecture.md) | V1 end-to-end system architecture (seven layers + three output modes + value-add capabilities) |
| 02 | [End-to-End Flow](02-end-to-end-flow.md) | Runtime flow: upload → cleansing → method recommendation → interpretation → output |
| 03 | [Differentiation](03-differentiation.md) | Traditional Excel vs generic LLM vs dedicated Agent |
| 04 | [Feature Breakdown](04-feature-breakdown.md) | Epic → Feature → Story → Task (mapped to Milestones / Issues) |
| 05 | [Design Decisions](05-design-decisions.md) | 3-class knowledge base · objective interpretation · clarification card · spec reverse-solver · read-only evidence pane |

## Conventions

- **Scope (V1):** No drawing-content reading, no 3D VA.
- **Calculation engine:** 1D, **strictly consistent with the T/VA template Excel formulas**.
- **Tracking:** Feature IDs (F0–F9), ordered by process flow, ↔ GitHub Milestones; Stories / Tasks ↔ Issues.
