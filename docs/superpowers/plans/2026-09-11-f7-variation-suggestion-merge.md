# F7 Variation Suggestion Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit one user-facing total-variation suggestion when both total-variation and dominant-contributor improvement options match.

**Architecture:** Keep the knowledge-base rules independent and merge only in `buildSuggestedActions`, the shared product-language composition boundary. Preserve the total-variation option identity and ordering, merge validation steps without duplicates, and leave standalone option behavior unchanged.

**Tech Stack:** TypeScript, Vitest, Vue 3 consumer tests

---

### Task 1: Merge Related Variation Suggestions

**Files:**
- Modify: `packages/product-language/src/f7-engineering-narrative.test.ts`
- Modify: `packages/product-language/src/f7-engineering-narrative.ts`
- Modify: `apps/f7-web/src/assumption-results-interpretation.test.ts`
- Modify if required by failing consumer assertions: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`
- Modify if required by failing consumer assertions: `apps/f7-local-api/src/f7-report.test.ts`

- [ ] **Step 1: Write the failing product-language test**

Change the combined-cause expectation so `suggestedActionSequence` contains only mean centering and total variation. Assert that the total-variation item uses this merged narrative and contains validation steps from both controlled inputs:

```ts
expect(narrative.suggestedActionSequence.map(({ optionId }) => optionId)).toEqual([
  "improvement-center-mean",
  "improvement-reduce-variation",
]);
expect(narrative.suggestedActionSequence[1]).toMatchObject({
  title: "Reduce total variation",
  narrative: "Reduce total variation only after representative variation evidence confirms the modeled shortfall; investigate the dominant contributor before changing its tolerance or process controls.",
});
expect(narrative.suggestedActionSequence[1]?.validationSteps).toEqual([
  "Update representative variation evidence.",
  "Rerun the same RSS or Monte Carlo method with unchanged specifications and target.",
  "Confirm Cp and Cpk meet the resolved target using a new representative sample.",
  "Validate the dominant contributor evidence before changing its tolerance or process controls.",
  "Recalculate the tolerance stack after the proposed contributor change.",
  "Confirm the improvement with representative data against the unchanged resolved target.",
]);
```

- [ ] **Step 2: Run the product-language test and verify RED**

Run:

```powershell
npx vitest run --project product-language packages/product-language/src/f7-engineering-narrative.test.ts
```

Expected: FAIL because both suggestions are still emitted.

- [ ] **Step 3: Implement the minimal merge**

In `buildSuggestedActions`, detect when both option IDs exist. Skip the standalone contributor option only in that case. For the total-variation item, use the merged narrative and combine validation steps with `Set` while preserving source order. Keep every other option and standalone case unchanged.

- [ ] **Step 4: Verify GREEN and update consumer expectations**

Run the focused product-language test. Then run F7 Web and local API tests; update only assertions that still expect both user-facing suggestion IDs. Do not change knowledge-base rule matching assertions.

```powershell
npx vitest run --project product-language packages/product-language/src/f7-engineering-narrative.test.ts
npx vitest run --project f7-web
npx vitest run --project f7-local-api
```

Expected: all tests pass, and user-facing consumers show one merged variation suggestion.

- [ ] **Step 5: Validate production quality**

```powershell
npx tsc -b packages/product-language --force
npm run build:f7:web
npx eslint packages/product-language/src/f7-engineering-narrative.ts packages/product-language/src/f7-engineering-narrative.test.ts apps/f7-web/src/assumption-results-interpretation.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts apps/f7-local-api/src/f7-report.test.ts
git diff --check
```

Expected: builds and lint pass with no diff whitespace errors.