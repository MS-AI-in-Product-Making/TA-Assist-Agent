# Dimension Chain Visibility Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible icon button that toggles generated dimension-chain annotations without hiding the background image.

**Architecture:** Keep visibility as local view state in `DimensionChainPanel.vue`. Render all generated annotations inside one conditional SVG group and apply the same state to the accessible list.

**Tech Stack:** Vue 3, TypeScript, lucide-vue-next, Vitest, Vue Test Utils

---

### Task 1: Add and verify the visibility toggle

**Files:**
- Modify: `apps/f7-web/src/components/DimensionChainPanel.vue`
- Test: `apps/f7-web/src/components/DimensionChainPanel.test.ts`

- [x] Add a component test that generates the chain, asserts `Hide dimension chain` is pressed, clicks it, verifies the overlay disappears while the background remains, then clicks `Show dimension chain` and verifies restoration.
- [x] Run the focused test and confirm it fails because the toggle does not exist.
- [x] Add `Eye` and `EyeOff`, local visible state, an interaction-cancelling toggle function, the toolbar button, and a conditional SVG overlay group.
- [x] Apply the same visibility condition to the accessible component list.
- [x] Run the focused test, the complete component suite, and `npm run build:f7:web`.

No Git commit is included because this workspace requires explicit user authorization before committing.