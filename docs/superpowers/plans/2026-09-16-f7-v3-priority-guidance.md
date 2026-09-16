# F7 Process Requirements V3 Priority Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let F7 users explicitly classify Factors with V3 controlled component categories and show the resulting governed P0-P3 recommendation, definitions, and ME/DM alignment in Web and PDF interpretation.

**Architecture:** Add one optional category to the existing Factor setup confirmation/evidence boundary without changing Factor identity. The Web gathers confirmed categories and delegates recommendation precedence to the existing `process-requirements-v3` evaluator, then projects the same controlled content to the on-screen interpretation and PDF request.

**Tech Stack:** TypeScript, Zod, Vue 3, Vitest, existing process-requirements-v3 knowledge library

---

## File Structure

- Modify `packages/contracts/src/f7-contracts.ts` and tests: optional controlled category on setup/evidence.
- Modify `packages/workbook-catalog/src/f7-excel-adapter.ts` and tests: preserve category without changing identity.
- Modify `apps/f7-web/src/components/FactorInputTable.vue` and tests: controlled category selector and confirmation payload.
- Modify `apps/f7-web/src/f0-process-guidance.ts` and tests: category aggregation, V3 recommendation, definitions.
- Modify `apps/f7-web/src/components/TAResultsInterpretation.vue` and tests: render and export V3 priority content.
- Modify `apps/f7-web/src/api/f7-client.ts`: PDF request types.
- Modify `apps/f7-local-api/src/assumption-results-pdf-contract.ts`, renderer, and tests: strict optional V3 PDF projection.

### Task 1: Preserve controlled category in confirmed Factor evidence

- [ ] **Step 1: Write failing contract and adapter tests**

Assert a valid category is accepted, an unknown category is rejected, absence remains valid, evidence preserves the category, and changing only category leaves `factorId` unchanged.

```ts
expect(f7FactorSetupConfirmationSchema.parse({ ...confirmation, componentCategory: "battery-cts" }))
  .toMatchObject({ componentCategory: "battery-cts" });
expect(() => f7FactorSetupConfirmationSchema.parse({ ...confirmation, componentCategory: "free-text" })).toThrow();
expect(first.factors[0]?.factorId).toBe(second.factors[0]?.factorId);
```

- [ ] **Step 2: Run tests and verify RED**

Run `npx.cmd vitest run --project node packages/contracts/src/f7-contracts.test.ts packages/workbook-catalog/src/f7-excel-adapter.test.ts`.

Expected: FAIL because strict F7 schemas reject `componentCategory` and adapter evidence omits it.

- [ ] **Step 3: Implement the optional field**

Reuse `processRequirementComponentCategorySchema` in both confirmation and evidence:

```ts
componentCategory: processRequirementComponentCategorySchema.optional(),
```

In `confirmF7FactorSetup()`, project it from confirmation to evidence when defined. Do not change candidate schemas or identity builders.

- [ ] **Step 4: Run tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

### Task 2: Add controlled category selection to Factor Setup

- [ ] **Step 1: Write failing FactorInputTable tests**

Assert `Component category` provides one blank option plus all twelve controlled options, restores an existing evidence value, includes a selected category in `confirmFactors`, and omits an unselected category.

```ts
await wrapper.get("[data-component-category]").setValue("battery-cts");
expect(wrapper.emitted("confirmFactors")?.[0]?.[0]?.[0]).toMatchObject({ componentCategory: "battery-cts" });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `npx.cmd vitest run --project f7-web apps/f7-web/src/components/FactorInputTable.test.ts`.

Expected: FAIL because the selector does not exist.

- [ ] **Step 3: Implement selector and draft lifecycle**

Add `ProcessRequirementComponentCategory | ""` to `FactorSpecificationDraft`, preserve it through add/reset/undo/redo snapshots, and emit it only when nonblank. Render a compact select with a blank `Not classified` option and all twelve plain-language controlled options.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command. Expected: PASS.

### Task 3: Project and render V3 priority interpretation

- [ ] **Step 1: Write failing guidance and component tests**

Cover stable category de-duplication, P0-over-P1 precedence, no-category behavior, exactly four V3 definitions, visible version `V3`, recommendation, and ME/DM alignment.

```ts
expect(result.priorityRecommendation).toMatchObject({ selectedPriority: "P0", requiresMeDmAlignment: true });
expect(result.priorityDefinitions.map(({ priority }) => priority)).toEqual(["P0", "P1", "P2", "P3"]);
```

- [ ] **Step 2: Run tests and verify RED**

Run `npx.cmd vitest run --project f7-web apps/f7-web/src/f0-process-guidance.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts`.

Expected: FAIL because the projection and rendered priority content do not exist.

- [ ] **Step 3: Implement V3 projection and UI**

Gather unique defined `factor.evidence.componentCategory` values and include them in evaluator facts. Parse four definition IDs from the V3 list into ordered definitions; fail closed if any are missing, duplicated, or not V3. Return evaluator `priorityRecommendation` when present. Render a visible `V3` marker, recommendation summary, alignment text, four-definition reference list, then existing actions.

- [ ] **Step 4: Run tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

### Task 4: Keep generated PDF aligned and validate

- [ ] **Step 1: Write failing PDF contract and renderer tests**

Assert the strict route accepts current optional priority fields, rejects unknown priorities, renders recommendation/alignment/definitions, and continues accepting legacy requests without them.

```ts
priorityRecommendation: { selectedPriority: "P0", requiresMeDmAlignment: true },
priorityDefinitions: [{ priority: "P0", title: "P0 component priority definition", message: "Priority 0 covers ..." }],
```

- [ ] **Step 2: Run tests and verify RED**

Run `npx.cmd vitest run --project node apps/f7-local-api/src/assumption-results-pdf-contract.test.ts apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts`.

Expected: FAIL because the strict PDF route schema rejects the new fields.

- [ ] **Step 3: Implement optional PDF fields and request parity**

Add bounded strict schemas and matching client types, include current guidance projection in `buildPdfRequest()`, and render the same recommendation, alignment, and definitions before process actions. Keep fields optional for old callers.

- [ ] **Step 4: Run focused and regression validation**

Run the focused contracts, adapter, session, PDF, Factor table, guidance, interpretation, App, and server tests, followed by `npm.cmd run build -- --force`.

Expected: all focused tests and build pass.

- [ ] **Step 5: Run browser and repository hygiene checks**

Run the F7 feature server and inspect desktop/mobile priority interpretation. Then run `git diff --check` and `git status --short`.

Expected: no clipping or overlap; only intended source, test, design, and plan files are staged. Existing generated `dist` changes remain unstaged.