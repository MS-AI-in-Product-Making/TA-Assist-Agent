# F7 Factor Traceability Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Component category with editable Part Number and DIM ID columns backed by parsed F7 traceability fields.

**Architecture:** Extend Factor Setup confirmations with nullable traceability overrides. The Excel adapter resolves omitted overrides from parsed candidates, non-empty overrides from user edits, and null overrides as explicit clears; FactorInputTable owns the corresponding drafts and emits those values.

**Tech Stack:** TypeScript, Vue 3 Composition API, Zod, Vitest, Vue Test Utils.

---

### Task 1: Persist Traceability Overrides

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `packages/contracts/src/f7-contracts.test.ts`
- Modify: `packages/workbook-catalog/src/f7-excel-adapter.ts`
- Modify: `packages/workbook-catalog/src/f7-excel-adapter.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add assertions that `f7FactorSetupConfirmationSchema` accepts trimmed strings and `null` for `partNumber` and `dimId`, rejects blank/oversized strings, and continues accepting omitted properties.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx.cmd vitest run packages/contracts/src/f7-contracts.test.ts`

Expected: FAIL because confirmation schema strips or rejects the new properties.

- [ ] **Step 3: Add nullable override fields**

Add to `f7FactorSetupConfirmationSchema`:

```ts
partNumber: factorTraceabilitySchema.nullable().optional(),
dimId: factorTraceabilitySchema.nullable().optional(),
```

- [ ] **Step 4: Write failing adapter tests**

Cover all three resolution states for each field:

```ts
// omitted preserves candidate value
// string replaces candidate value
// null removes candidate value
```

Also cover user-added candidates receiving entered identifiers.

- [ ] **Step 5: Run adapter test and verify RED**

Run: `npx.cmd vitest run packages/workbook-catalog/src/f7-excel-adapter.test.ts`

Expected: FAIL because evidence still copies candidate values directly.

- [ ] **Step 6: Resolve confirmation overrides**

Use a focused helper:

```ts
function resolvedTraceability(
  parsed: string | undefined,
  override: string | null | undefined,
): string | undefined {
  if (override === undefined) return parsed;
  return override ?? undefined;
}
```

Build evidence from resolved Part Number and DIM ID values.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `npx.cmd vitest run packages/contracts/src/f7-contracts.test.ts packages/workbook-catalog/src/f7-excel-adapter.test.ts`

Expected: PASS.

### Task 2: Replace the Factor Table Column

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/components/FactorInputTable.test.ts`
- Modify: `apps/f7-web/src/App.vue`
- Modify: `apps/f7-web/src/state/f7-session.ts`

- [ ] **Step 1: Write failing table tests**

Assert exact leading header keys:

```ts
expect(columnKeys.slice(0, 5)).toEqual([
  "index",
  "factor",
  "partNumber",
  "dimId",
  "designNominal",
]);
expect(columnKeys).not.toContain("componentCategory");
```

Assert parsed values render read-only, absent values render `Missing`, Edit Setup renders labeled inputs, and confirmation emits edited values plus `null` for cleared values.

- [ ] **Step 2: Run FactorInputTable tests and verify RED**

Run: `npx.cmd vitest run apps/f7-web/src/components/FactorInputTable.test.ts`

Expected: FAIL because current table still renders Component category and has no traceability drafts.

- [ ] **Step 3: Add traceability drafts and columns**

Extend the per-Factor draft with:

```ts
partNumber: string;
dimId: string;
```

Initialize from setup/evidence/candidate in authority order. Insert `Part Number` and `DIM ID` columns immediately after Factor, remove Component category markup/options/imports, render `Missing` when read-only and empty, and render text inputs during Edit Setup.

- [ ] **Step 4: Emit explicit traceability overrides**

Serialize trimmed values using:

```ts
partNumber: draft.partNumber.trim() || null,
dimId: draft.dimId.trim() || null,
```

Update `confirmFactors` event, `App.onConfirmFactors`, and session-store signatures to carry nullable values without changing API endpoint behavior.

- [ ] **Step 5: Run Web tests and verify GREEN**

Run: `npx.cmd vitest run apps/f7-web/src/components/FactorInputTable.test.ts apps/f7-web/src/App.test.ts`

Expected: PASS.

### Task 3: Validate the Full F7 Path

**Files:**
- Modify tests only if a failing assertion reflects the approved column contract.

- [ ] **Step 1: Run cross-layer focused regression**

Run:

```powershell
npx.cmd vitest run packages/contracts/src/f7-contracts.test.ts packages/workbook-catalog/src/f7-excel-adapter.test.ts apps/f7-web/src/components/FactorInputTable.test.ts apps/f7-web/src/App.test.ts apps/f7-web/src/api/f7-client.test.ts
```

Expected: PASS.

- [ ] **Step 2: Check diagnostics and formatting**

Check touched source files with VS Code diagnostics, then run:

```powershell
git diff --check
```

Expected: no new diagnostics and no whitespace errors.

- [ ] **Step 3: Verify in browser**

Reload `http://127.0.0.1:5177/`, import the existing local F7 fixture, and verify:

- Component category is absent.
- Part Number and DIM ID follow Factor.
- Parsed identifiers display.
- Missing values display `Missing`.
- Edit Setup permits editing and saved values remain after confirmation.

- [ ] **Step 4: Request code review**

Review correctness, backward compatibility, nullable-clear semantics, and exact table ordering. Resolve all Critical and Important findings before completion.
