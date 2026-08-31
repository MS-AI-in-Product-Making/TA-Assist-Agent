# F8 Engineering Workspace V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a single-page tolerance engineering workspace with F1 evidence, F2-canonical rows, worksheet-level F4 Scenario recalculation, F6 capability visualization, workbook health, grouped ADO governance, and VS Code-hosted conversation.

**Architecture:** F2 owns display identity and ordering; F4 enriches and recalculates worksheet Scenarios by stable source key; F1/F3/F6 add evidence and decision projections. Server exposes only session-scoped artifacts and host actions, while Web owns user interaction and Extension owns model/Surface execution.

**Tech Stack:** TypeScript NodeNext, Zod 3, Fastify 5, React 19, Vite 7, SQLite, VS Code Extension API, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-27-f8-engineering-workspace-v2-design.md`

## Global Constraints

- Source Workbook remains immutable.
- F2 order and field meaning are canonical.
- F4 is the only dynamic calculation engine.
- LSL/USL are temporary Scenario values, not source edits.
- No new Direction selector is introduced in this iteration.
- Browser receives opaque artifact IDs, not filesystem paths.
- F7 remains unavailable.

---

### Task 1: F2-canonical workspace projection

**Files:**
- Modify: `apps/workbench-web/src/workspace-model.ts`
- Modify: `apps/workbench-web/src/workspace-model.test.ts`
- Modify: `apps/workbench-web/src/components/FactorTable.tsx`
- Modify: `apps/workbench-web/src/components/FactorTable.test.tsx`

**Interfaces:**
- Produces: expanded `FactorRowModel` with all F2 report columns and stable source key.
- Consumes: F2 worksheets/factor tables/rows and optional F4 calculation enrichment.

- [ ] Add failing tests proving F2 worksheet/table/row order and exact display fields.
- [ ] Add failing tests proving F4 enrichment uses source key without reordering.
- [ ] Implement F2-first projection and unavailable calculation states.
- [ ] Render the full column set with frozen Row/Factor/Part columns and editable Nominal/tolerances.
- [ ] Run focused projection/component tests and typecheck.

### Task 2: Authenticated F1 image evidence

**Files:**
- Modify: `apps/workbench-server/src/routes/artifacts.ts`
- Modify: `apps/workbench-server/src/routes/artifacts.test.ts`
- Modify: `apps/workbench-server/src/server.ts`
- Modify: `apps/workbench-web/src/api.ts`
- Create: `apps/workbench-web/src/components/EvidenceImagePane.tsx`
- Create: `apps/workbench-web/src/components/EvidenceImagePane.test.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`

**Interfaces:**
- Produces: opaque image artifact IDs, authenticated inline URLs, zoom/focus component.

- [ ] Add failing Server tests for `f1_image` MIME, inline disposition, session scope, and path containment.
- [ ] Register F1 image references from F2 artifacts as authorized image artifacts.
- [ ] Add `WorkbenchApi.artifactUrl()`.
- [ ] Render image pane with zoom, fit, full-screen, missing state, and row highlight.
- [ ] Link Factor and Part cells to the evidence pane.
- [ ] Run route/component tests.

### Task 3: Worksheet-level F4 Scenario contract

**Files:**
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/workflow-runners/src/f4-what-if.ts`
- Modify: `packages/workflow-runners/src/f4-what-if.test.ts`
- Modify: `apps/workbench-server/src/routes/what-if.ts`
- Modify: `apps/workbench-server/src/server.ts`

**Interfaces:**
- Produces: worksheet Scenario request with multiple factor overrides and LSL/USL/Mean Shift overrides; full recalculated factor/system result.

- [ ] Add failing strict-schema tests for multi-factor patches and system specification overrides.
- [ ] Add failing runner tests proving multiple factors and LSL/USL recalculate through F4.
- [ ] Extend the F4 What-if runner to one worksheet Scenario and return all factor metrics/traces.
- [ ] Update Server validation, baseline replay, and response schemas.
- [ ] Run contracts, runner, and Server tests.

### Task 4: Scenario workspace and dynamic table

**Files:**
- Replace: `apps/workbench-web/src/hooks/use-scenario-workspace.ts`
- Modify: `apps/workbench-web/src/hooks/use-scenario-workspace.test.tsx`
- Modify: `apps/workbench-web/src/components/FactorTable.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`

**Interfaces:**
- Consumes: worksheet Scenario API from Task 3.
- Produces: accumulated worksheet draft, baseline/scenario row values, reset/save state.

- [ ] Add failing tests for multi-row accumulated edits, stale suppression, reset, and save.
- [ ] Implement one worksheet draft with 300 ms blur debounce.
- [ ] Project returned Mean/Tolerance/One Sigma/Contribution into every row.
- [ ] Add baseline/scenario visual values and improvement/deterioration semantics.
- [ ] Remove the ambiguous visible Baseline-direction wording without introducing a new Direction control.
- [ ] Run hook/table/workspace tests.

### Task 5: Capability and range visualization

**Files:**
- Modify: `apps/workbench-web/src/chart-model.ts`
- Modify: `apps/workbench-web/src/chart-model.test.ts`
- Replace: `apps/workbench-web/src/components/EngineeringCharts.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringCharts.test.tsx`

**Interfaces:**
- Consumes: baseline F4 metrics and full worksheet Scenario result.
- Produces: baseline/scenario contribution bars, metrics, statistical range, worst-case range, editable LSL/USL.

- [ ] Add failing chart-model tests for paired contribution bars and direct LSL/USL ranges.
- [ ] Render Mean, Mean Shift, RSS, Cp, CpkL/U, Cpk, Margin, Yield, and DPM.
- [ ] Render 4σ and worst-case horizontal bars with baseline/scenario overlays.
- [ ] Place LSL/USL inputs on the range axis and route edits into Scenario state.
- [ ] Add accessible color + textual delta semantics.
- [ ] Run chart tests and responsive screenshot checks.

### Task 6: Workbook health and F6 options

**Files:**
- Create: `apps/workbench-web/src/workbook-health.ts`
- Create: `apps/workbench-web/src/workbook-health.test.ts`
- Create: `apps/workbench-web/src/components/WorkbookHealth.tsx`
- Create: `apps/workbench-web/src/components/WorkbookHealth.test.tsx`
- Replace: `apps/workbench-web/src/components/F6Summary.tsx`
- Modify: `apps/workbench-web/src/components/F6Summary.test.tsx`

**Interfaces:**
- Consumes: F2 execution/missing evidence and F6 worksheet options.
- Produces: linked health findings and governed option comparisons.

- [ ] Add failing projection tests for the exact F2 summary counts and affected rows.
- [ ] Implement linked health findings for blocked worksheets, missing fields/images, identifiers, and F0 coverage.
- [ ] Expand F6 summary to baseline/result metrics, impact rank, feasibility, highest-impact action, and evidence.
- [ ] Keep temporary Scenario visually distinct from F6 governed options.
- [ ] Run health/F6 tests.

### Task 7: Part / Subsystem ADO governance

**Files:**
- Create: `packages/workbook-catalog/src/f3-governance-projection.ts`
- Create: `packages/workbook-catalog/src/f3-governance-projection.test.ts`
- Modify: `scripts/f3-ado-reminder.mjs`
- Replace: `apps/workbench-web/src/components/F3Governance.tsx`
- Modify: `apps/workbench-web/src/components/AdoWorkspaceDecision.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`

**Interfaces:**
- Produces: shared deterministic groups by Part / Subsystem and expandable Web governance details.

- [ ] Add failing tests for global grouping, counts, order, and missing Drawing/DIM totals.
- [ ] Move grouping to shared projection and reuse it in report renderers.
- [ ] Render Workbook-level group summary and expandable factor rows.
- [ ] Show ADO URL, org, project, ID, Owner, Version, preview, write status, and receipt.
- [ ] Run projection and Web tests.

### Task 8: VS Code model conversation bridge

**Files:**
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/conversation/src/conversation-store.ts`
- Modify: `packages/agent-runtime/src/runtime.ts`
- Modify: `apps/workbench-server/src/routes/conversation.ts`
- Modify: `apps/workbench-server/src/server.ts`
- Modify: `apps/vscode-extension/src/extension.ts`
- Modify: `apps/workbench-web/src/use-session.ts`
- Modify: `apps/workbench-web/src/components/TaAssistantPanel.tsx`

**Interfaces:**
- Produces: model-request HostAction, conversation append event, context-rich shared turns, explicit host availability states.

- [ ] Add failing tests for context persistence and conversation append events.
- [ ] Add failing host-action tests for Web model requests and Extension model responses.
- [ ] Persist related artifacts/stage/decision/calculation context.
- [ ] Publish conversation events to Web and VS Code cursors.
- [ ] Render artifact links and waiting/offline states.
- [ ] Run conversation/runtime/Server/Extension/Web tests.

### Task 9: Responsive integration and acceptance

**Files:**
- Modify: `apps/workbench-web/src/workbench.css`
- Modify: `apps/workbench-web/src/components/WorkspaceToolbar.tsx`
- Modify: `test/f8-e2e/engineering-workspace.spec.ts`
- Modify: `.superpowers/sdd/2026-08-26-f8-ta-engineering-workspace-ui/progress.md`

**Interfaces:**
- Consumes: all prior task components.
- Produces: production-ready desktop/mobile workspace.

- [ ] Fix toolbar tracks, overflow, wrapping, and stable control dimensions.
- [ ] Add desktop and mobile E2E for image/table links, multi-row edit, LSL/USL, F6, health, ADO, and conversation.
- [ ] Build and embed production assets.
- [ ] Run affected regression, full typecheck, Playwright screenshots, and `git diff --check`.
- [ ] Restart port `63569` and perform real-session acceptance without changing the source Workbook hash.
