# Workflow Restart From Step One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make completed Workflow step 1 reopen the workbook picker so users can restart worksheet selection.

**Architecture:** Add a template ref for the existing file input and an in-app `alertdialog`. Its Continue button clears and clicks the input directly, preserving trusted user activation; `onImportFile` remains responsible for state replacement and cleanup.

**Tech Stack:** Vue 3, TypeScript, Vue Test Utils, Vitest

---

### Task 1: Add the restart action

**Files:**
- Modify: `apps/f7-web/src/App.vue`
- Test: `apps/f7-web/src/App.test.ts`

- [x] Add a failing test for an actionable completed step 1 that clears and opens the existing file input.
- [x] Add the file input ref, restart action, conditional step button, and completed subtitle.
- [x] Run focused and complete App tests.
- [x] Build F7 Web and verify the file-picker interaction through the component boundary.
- [x] Require confirmation before opening the picker; Cancel preserves the current workflow state.

No Git commit is included because committing requires an explicit user request.