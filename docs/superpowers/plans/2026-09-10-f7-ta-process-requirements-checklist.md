# F7 TA Process and Requirements Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render all currently evaluable F0 process items as a numbered checklist and warn only on demonstrable violations.

**Architecture:** Extend the pure F0 adapter to combine the governed list API with evaluator matches, producing display items with explicit compliance state. Keep Vue presentation free of F0 rule IDs and rule-condition logic.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils

---

### Task 1: Build Checklist View Model

**Files:**
- Modify: `apps/f7-web/src/f0-process-guidance.ts`
- Test: `apps/f7-web/src/f0-process-guidance.test.ts`

- [ ] Write failing tests proving evaluable satisfied items remain listed and matched violations are marked Warning.
- [ ] Run the focused builder test and confirm the expected assertion failure.
- [ ] Add a typed checklist item model and derive it from F0 list/evaluation results.
- [ ] Run the focused builder test and confirm it passes.

### Task 2: Render Numbered Guidance

**Files:**
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Test: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [ ] Write failing component assertions for title, ordered numbering, hidden metadata, and red Warning state.
- [ ] Run the focused component test and confirm the expected assertion failure.
- [ ] Replace entry-type rendering with the checklist presentation and responsive styles.
- [ ] Run the focused component test and confirm it passes.

### Task 3: Regression Validation

**Files:**
- Verify all touched files.

- [ ] Run the complete F7 Vitest project.
- [ ] Run the F7 production build and focused ESLint.
- [ ] Verify the running page at desktop and mobile widths when a live workbook session is available.
