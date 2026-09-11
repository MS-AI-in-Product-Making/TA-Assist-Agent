# F7 Readonly Specification Gray-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gray out locked LSL, USL, and Target Sigma Level fields.

**Architecture:** Add a state-specific class to the existing non-editable outputs and style it in the shared F7 stylesheet. Preserve the component state model and element semantics.

**Tech Stack:** Vue 3, CSS, Vitest, Vue Test Utils

---

### Task 1: Style Locked System Specifications

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/style.css`
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] Add a failing test for the three readonly classes and gray-out CSS.
- [ ] Run the focused App test and confirm RED.
- [ ] Add the classes and CSS.
- [ ] Rerun focused and full F7 Web tests, build, ESLint, diagnostics, and `git diff --check`.