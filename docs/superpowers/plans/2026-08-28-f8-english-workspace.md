# F8 English Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an all-English, dense worksheet workspace with F0-F7 labels, source-text traceability, a no-horizontal-scroll factor table, and analysis-target evidence metadata.

**Architecture:** Add a pure Web projection layer between governed artifacts and React components. Keep source artifacts unchanged; projected strings retain original source text for tooltip/focus disclosure.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS, existing F2/F4 contracts

**Spec:** `docs/superpowers/specs/2026-08-28-f8-web-projection-optimization-design.md`

## Global Constraints

- F8 remains a projection layer; do not alter F0-F7 calculation ownership.
- All visible Web content is English.
- Workbook-derived source text remains available through tooltip/focus disclosure.
- At 1280px and wider, core factor columns require no horizontal scrolling.
- Do not commit unless the user explicitly authorizes it.

---

### Task 1: Central English Projection

**Files:**
- Create: `apps/workbench-web/src/web-projection.ts`
- Create: `apps/workbench-web/src/web-projection.test.ts`
- Modify: `apps/workbench-web/src/business-status.ts`
- Modify: `apps/workbench-web/src/workbench-session.ts`

**Interfaces:**
- Produces: `ProjectedText`, `projectSourceText(sourceText, translation?)`, `featureDisplay(featureId)`, `reasonDisplay(reasonCode)`.

- [ ] Write tests asserting every F0-F7 label is at most two words and reason/status output is English.
- [ ] Run `npm exec vitest -- run apps/workbench-web/src/web-projection.test.ts`; expect failures for missing module.
- [ ] Implement deterministic fixed-copy mappings and `ProjectedText { displayText, sourceText, translated }`.
- [ ] Replace Chinese status/error projection strings with calls to the new module.
- [ ] Re-run the focused test; expect PASS.
- [ ] Review checkpoint; do not commit without authorization.

### Task 2: Dynamic Source Text Projection

**Files:**
- Modify: `apps/workbench-web/src/workspace-model.ts`
- Modify: `apps/workbench-web/src/workspace-model.test.ts`
- Create: `apps/workbench-web/src/components/SourceText.tsx`
- Create: `apps/workbench-web/src/components/SourceText.test.tsx`

**Interfaces:**
- Consumes: `ProjectedText` from Task 1.
- Produces: projected factor/part/recommendation fields and `<SourceText value />`.

- [ ] Add fixture tests with distinct English `displayText` and Chinese/non-English `sourceText`.
- [ ] Assert table-visible text is English and source text is available by focus and `title`/tooltip semantics.
- [ ] Run focused tests and verify RED.
- [ ] Extend `FactorRowModel` dynamic text fields to use `ProjectedText` without changing source artifact schemas.
- [ ] Implement accessible source disclosure; do not add parallel source columns.
- [ ] Run focused tests and verify PASS.
- [ ] Review checkpoint; do not commit without authorization.

### Task 3: Compact Factor Table

**Files:**
- Modify: `apps/workbench-web/src/components/FactorTable.tsx`
- Modify: `apps/workbench-web/src/components/FactorTable.test.tsx`
- Modify: `apps/workbench-web/src/styles.css`

**Interfaces:**
- Consumes: projected factor rows from Task 2.
- Produces: compact core-column table and row detail access for Notes/source text.

- [ ] Add a component test asserting the compact header set and absence of a horizontal-scroll wrapper at desktop layout.
- [ ] Run focused test and verify RED.
- [ ] Combine Part/Drawing/DIM ID and Status/Recommendation into compact cells; abbreviate only headers, never values.
- [ ] Move Notes to row detail/tooltip and retain keyboard access.
- [ ] Set table header to 10-11px, body to 11-12px, numeric cells to tabular numerals, and fixed responsive column tracks.
- [ ] Run component tests and Playwright at 1280x800; assert `scrollWidth === clientWidth` for the table viewport.
- [ ] Review checkpoint; do not commit without authorization.

### Task 4: Evidence Layout And Analysis Target

**Files:**
- Modify: `apps/workbench-web/src/workspace-model.ts`
- Modify: `apps/workbench-web/src/components/EvidenceImagePane.tsx`
- Modify: `apps/workbench-web/src/components/EvidenceImagePane.test.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`
- Modify: `apps/workbench-web/src/styles.css`

**Interfaces:**
- Produces: `AnalysisTargetModel { description, nominal, upperTolerance, lowerTolerance, unit }`.

- [ ] Add tests proving target values come from worksheet system specification, not the selected factor.
- [ ] Run focused tests and verify RED.
- [ ] Add analysis target projection and render `Tolerance loop description`, `Target nominal`, `Upper tolerance`, `Lower tolerance` below the image.
- [ ] Change desktop split to 34/66 with equal-height evidence/table areas and full-image containment.
- [ ] Run tests and desktop/mobile screenshots; verify no overlap or page-level horizontal overflow.
- [ ] Review checkpoint; do not commit without authorization.

### Task 5: Full English Surface And Acceptance

**Files:**
- Modify: all mounted components under `apps/workbench-web/src/components/` containing visible Chinese copy
- Test: `apps/workbench-web/src/app.test.tsx`

**Interfaces:**
- Consumes: fixed and dynamic projection APIs from Tasks 1-4.

- [ ] Add an app-level test scanning rendered visible text for the known Chinese UI strings and asserting F0-F7 labels.
- [ ] Translate headings, controls, statuses, empty states, validation copy, chart labels, and ADO/Conversation shell copy.
- [ ] Run `npm exec vitest -- run apps/workbench-web/src --reporter=dot`.
- [ ] Build with `npm run build --workspace @ai-assist/workbench-server`.
- [ ] Verify desktop 1440x900 and mobile 390x844 with Playwright; inspect overflow and source tooltip behavior.
- [ ] Review checkpoint; do not commit without authorization.
