# Persistent Workflow Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the complete Workflow visible from initial load through report generation, with step-1 import and worksheet controls in the right workspace.

**Architecture:** Render the existing `layout-grid` without requiring a session. Move the Import Workbook panel into `workflow-content`, keep session-specific metadata and workflow components conditional, and preserve the current responsive grid behavior.

**Tech Stack:** Vue 3, TypeScript, CSS Grid, Vue Test Utils, Vitest, Playwright

---

### Task 1: Persist the Workflow shell

**Files:**
- Modify: `apps/f7-web/src/App.vue`
- Test: `apps/f7-web/src/App.test.ts`
- Modify if needed: `apps/f7-web/src/style.css`

- [x] Update the initial UI test to assert the three-step Workflow is present before import, step 1 is current, steps 2 and 3 are locked, and Import Workbook is inside `workflow-content`.
- [x] Run the focused test and confirm it fails because the Workflow shell currently requires a session.
- [x] Render `layout-grid` unconditionally, move Import Workbook into `workflow-content`, and guard only session-dependent metadata and content.
- [x] Run focused and complete App tests.
- [x] Build F7 Web and validate desktop/mobile layouts in the browser.

No Git commit is included because committing requires an explicit user request.
