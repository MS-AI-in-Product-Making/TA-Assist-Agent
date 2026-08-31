# F8 Scenario Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace editable mean shift with a read-only Mean Offset, provide compact baseline/scenario metrics, and deliver an understandable draggable specification plot backed by F4 What-if.

**Architecture:** Keep F4 as the sole calculator. React maintains a transient specification draft for pointer/keyboard preview and commits one worksheet Scenario on release/Enter/blur.

**Tech Stack:** React 19, TypeScript, SVG pointer events, Vitest, Testing Library, existing F4 What-if API

**Spec:** `docs/superpowers/specs/2026-08-28-f8-web-projection-optimization-design.md`

## Global Constraints

- `Mean Offset = Calculated Mean - Target Nominal` and is read-only.
- Baseline values never mutate during Scenario editing.
- Dragging previews continuously; pointer release commits exactly once.
- `LSL < USL` is mandatory.
- Do not commit unless explicitly authorized.

---

### Task 1: Read-only Mean Offset

**Files:**
- Modify: `apps/workbench-web/src/workspace-model.ts`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`
- Modify: `apps/workbench-web/src/components/MetricComparison.tsx`
- Modify: associated tests

**Interfaces:**
- Produces: `metrics.meanOffset` derived from calculated mean and target nominal.

- [ ] Add tests with mean `1.627` and target nominal `1.500`; expect `0.127` and no editable mean-shift control.
- [ ] Run focused tests and verify RED.
- [ ] Remove the Additional Mean Shift input from the mounted workspace.
- [ ] Project and render read-only Mean Offset with source values available in an accessible description.
- [ ] Re-run tests and verify PASS.
- [ ] Review checkpoint.

### Task 2: Compact Metrics And Contribution Legend

**Files:**
- Modify: `apps/workbench-web/src/components/EngineeringCharts.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringCharts.test.tsx`
- Modify: `apps/workbench-web/src/chart-model.ts`
- Modify: `apps/workbench-web/src/styles.css`

**Interfaces:**
- Produces fixed `Baseline` and `Scenario` series.

- [ ] Add tests asserting both legend entries exist even when values are equal and baseline remains unchanged after scenario input.
- [ ] Run focused tests and verify RED.
- [ ] Render compact metrics with stable dimensions and smaller type.
- [ ] Draw baseline and scenario bars with fixed semantic colors and visible legend labels.
- [ ] Re-run tests and capture desktop/mobile screenshots.
- [ ] Review checkpoint.

### Task 3: Specification Draft Model

**Files:**
- Create: `apps/workbench-web/src/specification-drag.ts`
- Create: `apps/workbench-web/src/specification-drag.test.ts`
- Modify: `apps/workbench-web/src/hooks/use-scenario-workspace.ts`
- Modify: `apps/workbench-web/src/hooks/use-scenario-workspace.test.tsx`

**Interfaces:**
- Produces: `clampSpecDraft`, `specValueFromPointer`, and `previewSystemSpecification`/`commitSystemSpecification` callbacks.

- [ ] Test pixel-to-value conversion, reversed domains, LSL/USL clamping, keyboard increments, and one commit per release.
- [ ] Run tests and verify RED.
- [ ] Implement pure drag math with no DOM dependency.
- [ ] Add transient system draft and throttled non-persistent preview to the Scenario hook.
- [ ] Use the existing worksheet What-if endpoint for committed calculations; preserve last-valid result on preview failure.
- [ ] Re-run hook tests and verify PASS.
- [ ] Review checkpoint.

### Task 4: Interactive Specification Plot

**Files:**
- Modify: `apps/workbench-web/src/components/EngineeringCharts.tsx`
- Create: `apps/workbench-web/src/components/SpecificationPlot.tsx`
- Create: `apps/workbench-web/src/components/SpecificationPlot.test.tsx`
- Modify: `apps/workbench-web/src/styles.css`

**Interfaces:**
- Consumes Task 3 draft callbacks.
- Produces draggable LSL/USL handles and accessible numeric controls.

- [ ] Write tests for labeled LSL/USL lines, axis ticks, baseline/scenario means, statistical ranges, worst-case range, pointer drag, release commit, and arrow keys.
- [ ] Run tests and verify RED.
- [ ] Extract the plot into a focused component and implement pointer capture.
- [ ] Add fixed legend, line labels, numeric ticks, and synchronized precision inputs.
- [ ] Ensure invalid crossing clamps and displays an English inline reason.
- [ ] Run component/hook tests and Playwright interaction at desktop/mobile sizes.
- [ ] Review checkpoint.

### Task 5: Scenario Regression

**Files:**
- Test: `apps/workbench-web/src/hooks/use-scenario-workspace.test.tsx`
- Test: `apps/workbench-server/src/server.test.ts`

- [ ] Verify baseline metrics and contribution series remain immutable.
- [ ] Verify drag preview does not persist drafts and release causes one calculation request.
- [ ] Verify reload returns governed baseline unless a Scenario was explicitly saved.
- [ ] Run `npm exec vitest -- run apps/workbench-web/src apps/workbench-server/src --reporter=dot`.
- [ ] Build server package and verify the real session with Playwright.
- [ ] Review checkpoint.
