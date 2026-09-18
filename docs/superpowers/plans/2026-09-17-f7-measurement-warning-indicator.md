# F7 Measurement Warning Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark measured Factors with committed import warnings and expose the exact warning details in their workspace.

**Architecture:** Add one F7 Web pure helper that derives warning messages from persisted Factor evidence and included observations. Reuse it in the Factor table and measurement workspace so indicator visibility and details share one authority.

**Tech Stack:** TypeScript, Vue 3, Vitest, Vue Test Utils, CSS.

---

### Task 1: Derive Committed Import Warnings

**Files:**
- Create: `apps/f7-web/src/measurement-workspace-warnings.ts`
- Create: `apps/f7-web/src/measurement-workspace-warnings.test.ts`

- [ ] Write tests proving cross-zero, out-of-spec, and candidate-outlier messages are returned and clean data returns no warning.
- [ ] Run `npx vitest run apps/f7-web/src/measurement-workspace-warnings.test.ts` and verify RED.
- [ ] Implement `measurementWorkspaceWarnings(factor)` using confirmed limits and included observations.
- [ ] Rerun the focused test and verify GREEN.

### Task 2: Render Indicator and Details

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] Add an App test requiring red `Warning` beside the affected Factor's `Open workspace` button and no label for a clean Factor.
- [ ] Extend the test to open the workspace and require the exact warning messages.
- [ ] Run the focused App test and verify RED.
- [ ] Render the indicator and detail region using the shared helper.
- [ ] Add restrained red warning styling without creating another button.
- [ ] Rerun the focused App test and verify GREEN.

### Task 3: Validate

**Files:**
- Verify all modified F7 Web files.

- [ ] Run the focused helper and App tests.
- [ ] Run the F7 Web TypeScript build.
- [ ] Check VS Code diagnostics for modified files.
- [ ] Verify the real browser workflow shows the warning label and detail after opening the workspace.
