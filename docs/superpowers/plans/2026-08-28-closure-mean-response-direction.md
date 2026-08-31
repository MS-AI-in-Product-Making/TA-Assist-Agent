# Closure Closed-Loop Direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Closure arrow connected from the final dimension endpoint to the first dimension start and prevent Closure guides from crossing.

**Architecture:** Dimension Chain renders the Closure directly from its generated start and end topology. Guide movement is clamped against the stationary guide while preserving existing factor-sign synchronization.

**Tech Stack:** Vue 3, TypeScript, SVG, Vitest, Vue Test Utils

---

### Task 1: Closed-Loop Contract

**Files:**
- Modify: `apps/f7-web/src/components/DimensionChainPanel.test.ts`
- Modify: `apps/f7-web/src/components/DimensionChainPanel.vue`

- [x] Add a failing horizontal and vertical test asserting Closure starts at the final dimension endpoint and ends at the first dimension start.
- [x] Remove Mean Response endpoint swapping and render Closure directly from generated topology.
- [x] Run `npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts` and confirm all component tests pass.

### Task 2: Non-Crossing Guides

**Files:**
- Modify: `apps/f7-web/src/components/DimensionChainPanel.test.ts`
- Modify: `apps/f7-web/src/components/DimensionChainPanel.vue`

- [x] Add failing tests that drag each Closure guide past the other in horizontal and vertical orientations.
- [x] Clamp the moving guide to its original side with a one-unit minimum gap.
- [x] Verify existing connected-arrow sign-change tests still pass.

### Task 3: Remove Superseded Data Flow

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`

- [x] Remove the superseded `meanResponse` prop from `DimensionChainPanel`.
- [x] Remove the corresponding Factor Setup binding and integration assertion.
- [x] Verify Factor Setup summary calculations remain unchanged.

### Task 4: Final Verification

- [x] Run `npx vitest run apps/f7-web` (10 files, 172 tests passed).
- [x] Run `npm run build:f7:web` (passed; existing chunk-size warning only).
- [x] Verify the final-to-first topology and guide constraints in the shared browser page for horizontal and vertical layouts.
- [x] Run `git diff --check` and inspect editor diagnostics.

Browser evidence: in both orientations, Closure start, the start guide, the start marker, and the final dimension endpoint all resolved to the same axis coordinate. Closure end, the end guide, and the first dimension start also resolved to the same axis coordinate.