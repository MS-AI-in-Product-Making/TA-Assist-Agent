# TA Assist Agent

TA Assist Agent turns a completed tolerance-analysis workbook into a governed engineering report. It validates workbook inputs, preserves drawing and worksheet traceability, reuses the deterministic calculation kernel, interprets the tolerance-path image together with the complete Factor table, and produces review-ready optimization guidance.

The source workbook is always read-only. Model output explains context; it never replaces deterministic calculations or engineering approval.

## Start an Analysis

In VS Code Chat, enter:

```text
/ta-assist-agent C:\path\to\your-ta-workbook.xlsx
```

You can also enter `/ta-assist-agent` without a path. The agent will ask for exactly one `.xlsx` workbook.

This is the primary user entry. The component Skills remain available to the orchestrator, but users do not need to invoke them individually.

## What Happens

1. **Knowledge Library** verifies the controlled engineering-rule and capability-library versions.
2. **Data Parsing** identifies candidate worksheets and asks you to confirm the initial scope.
3. **Data Cleaning** checks required Factor fields, system requirements, images, and identifiers. Blocked worksheets show exact rows and missing fields.
4. **Drawing Governance** validates Drawing Number and DIM ID traceability. Optional ADO publication always requires a separate confirmation.
5. **TA Calculation** runs the governed WC/RSS and capability calculations.
6. **Result Interpretation** evaluates each verified tolerance-path image together with every active Factor and its original ordinal.
7. **Design Optimization** evaluates adjusted mean shift, contributor priorities, and specification-change candidates.
8. The agent validates and presents one final engineering report.

Worksheet selection, optional ADO publication, Analysis Context, and Optimization Targets remain explicit user decisions. The interaction language selected at workflow start remains locked for that session.

## Final Report

Successful current runs publish one user-facing Markdown report:

```text
Feature6-Report.md
```

The report includes:

- Document Overview and Workbook Summary;
- exact blocked worksheet findings;
- a verified tolerance-path image link;
- every active Factor, original ordinal, and complete Factor fields;
- image and Factor-table context interpretation;
- requirements, statistical and worst-case ranges, Cp/CpkL/CpkU/Cpk, Yield, and DPM;
- F0 capability results and controlled recommendations;
- adjusted mean to specification-center offset, shown to three decimal places;
- the complete contributor ranking and a reminder to review the top three tolerance ranges;
- governed specification-change recommendations.

User-facing tables do not show Source or Evidence columns. Provenance, hashes, calculation traces, run decisions, and artifact identity remain available in internal governed artifacts.

Current F6 runs publish exactly four files:

```text
Feature6-Optimization.json
Feature6-Report.md
Feature6-Run-Summary.json
manifest.json
```

Historical five-file F6 bundles remain read-only and hash-validated.

## Safety Boundaries

- Workbooks and uploaded engineering data are confidential and remain local unless an explicitly confirmed integration is used.
- The workflow never writes back to the source workbook.
- ADO writes use the approved Surface MCP path and require preview plus final confirmation.
- F4 is the numeric source of truth. The model does not recalculate Factor values, WC/RSS, capability, Yield, DPM, or specification limits.
- Missing image identity, hash, Factor mapping, or required calculation data fails closed.
- Capability-library guidance is not measured manufacturing capability.
- Specification changes require engineering approval.

## Workspace Structure

- `.github/skills/` - user-facing and internal governed Skills
- `apps/` - CLI, VS Code extension, Workbench, and measured-data applications
- `packages/` - contracts, calculation, governance, orchestration, and product libraries
- `scripts/` - deterministic workflow entrypoints and integration tests
- `docs/` - architecture, governance, design specifications, and implementation plans
- `test/` - test fixtures and generated local acceptance output

Architecture documentation starts at [docs/00-overview.md](docs/00-overview.md). The current report and product optimization design is [docs/superpowers/specs/2026-09-08-ta-assist-agent-report-and-product-optimization-design.md](docs/superpowers/specs/2026-09-08-ta-assist-agent-report-and-product-optimization-design.md).

## Development

Prerequisites:

- Node.js 22 or newer
- npm
- Windows and Microsoft Excel only for Excel COM regression workflows

Install and verify:

```powershell
npm install
npm run build -- --force
npm test
npm run check:repository
node scripts/verify-current-f6.mjs
```

Focused commands:

```powershell
npm run workflow:f2:excel -- "C:\path\to\workbook.xlsx"
npm run workflow:f2:excel -- "C:\path\to\workbook.xlsx" --worksheets "Sheet A,Sheet B" --workbook-hash <sha256> --confirm
npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name>
npm run workflow:f4 -- --f2-report <f2-output-dir>\Feature2-Report.json
npm run workflow:f5 -- <f1-root> <f3-root> <f4-root> --worksheet <worksheet-name>
npm run workflow:f6 -- <f2-root> <f3-root> <f4-root> <f5-root> --worksheet <worksheet-name> --model-interpretation <artifact-path>
```

Direct runner commands are development and validation surfaces. Product users should start with `/ta-assist-agent` so that required governance gates are preserved.

## Product Name

- Product: **TA Assist Agent**
- Root npm package: `ta-assist-agent`
- Repository: `TA-Assist-Agent`
- Internal workspace package scope: `@ai-assist/*` (retained for compatibility)