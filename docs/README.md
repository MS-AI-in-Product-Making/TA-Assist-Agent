# TA Assist Agent Documentation

This directory contains the current product architecture, governed workflow, capability boundaries, and implementation records for TA Assist Agent.

## Start Here

1. [Overview](00-overview.md) - product purpose, users, and capability boundaries.
2. [Architecture](01-architecture.md) - components, contracts, security boundaries, and supported entry surfaces.
3. [End-to-End Flow](02-end-to-end-flow.md) - governed workbook processing from workbook intake to final report publication.
4. [Differentiation](03-differentiation.md) - comparison with manual Excel workflows and generic language models.
5. [Feature Breakdown](04-feature-breakdown.md) - capability ownership for F0-F7.
6. [Design Decisions](05-design-decisions.md) - accepted architecture and governance decisions.

## Current Product Entry Surfaces

Supported user entry is now split between **Copilot Skills** and **direct governed workflows**:

- **Complete workbook analysis:** `.github/skills/ta-assist-agent/SKILL.md`
- **Governed design and report workflow:** `.github/skills/design-optimization/SKILL.md`
- **Focused result review:** `.github/skills/result-interpretation/SKILL.md`
- **Drawing governance publication:** `.github/skills/drawing-governance/SKILL.md`
- **Measured-data follow-up:** `.github/skills/ta-real-measurement-analysis/SKILL.md`
- **PDF report publication:** `.github/skills/pdf-report-export/SKILL.md`

Engineers can also run deterministic stages directly when a skill is not the desired entry surface:

```powershell
npm run workflow:f2:excel -- "C:\path\to\workbook.xlsx"
npm run workflow:f3 -- "<f2-output-dir>" --worksheet "Worksheet A"
npm run workflow:f4 -- --f2-report "<f2-output-dir>\Feature2-Report.json"
npm run workflow:f5 -- "<f1-output-dir>" "<f3-output-dir>" "<f4-output-dir>" --worksheet "Worksheet A"
npm run workflow:f6 -- "<f2-output-dir>" "<f3-output-dir>" "<f4-output-dir>" "<f5-output-dir>" --worksheet "Worksheet A" --language en --analysis-request-context <strict-json> --model-interpretation <artifact-path>
```

## Developer Workbook Handshake

The deterministic F1/F2 development runner keeps the worksheet-selection handshake:

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

The [superpowers/specs](superpowers/specs/) and [superpowers/plans](superpowers/plans/) directories preserve dated design and implementation records. Historical records may describe retired F8/participant surfaces or earlier report shapes; unless a current product document references them, they are not the active contract.
