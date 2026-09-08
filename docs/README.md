# TA Assist Agent Documentation

This directory contains the architecture, workflow, product decisions, governance rules, and implementation records for TA Assist Agent.

## Start Here

1. [Overview](00-overview.md) - product purpose, users, and capability boundaries.
2. [Architecture](01-architecture.md) - components, contracts, security boundaries, and deployment model.
3. [End-to-End Flow](02-end-to-end-flow.md) - governed workbook processing from upload to final report.
4. [Differentiation](03-differentiation.md) - comparison with manual Excel workflows and generic language models.
5. [Feature Breakdown](04-feature-breakdown.md) - detailed capability ownership.
6. [Design Decisions](05-design-decisions.md) - accepted architecture and governance decisions.

## Current Product Contract

Users start a complete workbook analysis with:

```text
/ta-assist-agent C:\path\to\workbook.xlsx
```

Current runs publish one user-facing report, `Feature6-Report.md`, plus three internal governance artifacts. The final report contains verified image links, every active Factor, complete deterministic statistics, F0 guidance, adjusted-mean assessment, contributor priorities, and specification recommendations.

## Developer Workbook Handshake

The deterministic F1/F2 development runner uses a selection request followed by a hash-bound confirmation:

```powershell
npm run workflow:f2:excel -- "C:\path\to\workbook.xlsx"
npm run workflow:f2:excel -- "C:\path\to\workbook.xlsx" --worksheets "Sheet A,Sheet B" --workbook-hash <sha256> --confirm
```

Do not run independent F1 and F2 commands as a substitute for this confirmed handshake.

See the current design and execution plan:

- [TA Assist Agent report and product optimization design](superpowers/specs/2026-09-08-ta-assist-agent-report-and-product-optimization-design.md)
- [TA Assist Agent report and product optimization implementation plan](superpowers/plans/2026-09-08-ta-assist-agent-report-and-product-optimization.md)

## Governance

The [governance](governance/) directory defines data classification, engineering standards, evidence requirements, feature registration, and release acceptance. Source workbooks remain read-only. Deterministic calculation artifacts remain authoritative for numeric results. Model interpretation remains reviewable context and cannot approve engineering changes.

## Historical Records

The [superpowers/specs](superpowers/specs/) and [superpowers/plans](superpowers/plans/) directories preserve dated design and implementation records. Historical records may describe earlier artifact versions and are not the current product contract unless referenced by an active design.