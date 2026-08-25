# F7 Editable Factor Specification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Design Nominal and bilateral tolerances editable during Factor Setup and propagate confirmed values to all downstream analysis.

**Architecture:** Extend candidate, confirmation, and evidence contracts while preserving source-cell audit data. Derive loop direction and physical specifications on the server-side setup boundary, then expose a three-input Vue draft that submits the governed confirmation payload.

**Tech Stack:** TypeScript, Zod, Vue 3, Vitest, XLSX adapter.

---

### Task 1: Governed Contracts

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `packages/contracts/src/f7-contracts.test.ts`

- [x] Add failing tests for signed Design Nominal, tolerance sign constraints, supported zero crossing, strict confirmation fields, and normalized evidence consistency.
- [x] Add the three values to candidate, confirmation, and evidence schemas; derive no values inside schemas except validation invariants.
- [x] Run the focused contract tests and rebuild contracts.

### Task 2: Workbook And Session Propagation

**Files:**
- Modify: `packages/workbook-catalog/src/f7-excel-adapter.ts`
- Modify: `packages/workbook-catalog/src/f7-excel-adapter.test.ts`
- Modify: `apps/f7-local-api/src/f7-session-service.test.ts`
- Modify: `apps/f7-local-api/src/server.test.ts`

- [x] Add failing adapter tests for extracted defaults and confirmation-derived loop direction, physical mean, and physical specs.
- [x] Preserve workbook values on candidates, using signed mean/spec-derived fallback only when explicit nominal/tolerance cells are absent.
- [x] Normalize confirmed values into evidence and verify session/API persistence.

### Task 3: Editable Factor Setup UI

**Files:**
- Modify: `apps/f7-web/src/api/f7-client.ts`
- Modify: `apps/f7-web/src/state/f7-session.ts`
- Modify: `apps/f7-web/src/App.vue`
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [x] Add failing UI tests for the seven-column table, removed Source Cells, editable defaults, payload changes, sign colors, invalid-value blocking, and confirmed read-only values.
- [x] Replace coefficient drafts with Design Nominal and tolerance drafts and submit all three values.
- [x] Add accessible labels, numeric constraints, inline validation, red subtractive styling, and blue additive styling.
- [x] Run focused and full Web tests, production build, and desktop/mobile browser checks.

### Task 4: Final Verification

- [x] Run contract, workbook adapter, local API, and Web tests covering the changed path.
- [x] Run the root TypeScript build and Web production build.
- [x] Confirm source-cell audit fields remain in contracts while the UI column is absent.
