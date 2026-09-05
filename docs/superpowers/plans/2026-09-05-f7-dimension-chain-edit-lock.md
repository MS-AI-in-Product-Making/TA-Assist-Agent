# F7 Dimension Chain Edit Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable Dimension Chain Generate/Update, Horizontal, and Vertical controls until the user enters Factor Setup edit mode.

**Architecture:** Reuse the existing `editable` prop already derived from `editingSetup && !busy`. Apply it directly to the three editing controls while preserving Generate/Update's existing validity and stale-state conditions. Pure viewport, image, and visibility controls remain unchanged.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils

---

### Task 1: Bind Dimension Chain editing controls to the existing edit state

**Files:**
- Modify: `apps/f7-web/src/components/DimensionChainPanel.vue`
- Test: `apps/f7-web/src/components/DimensionChainPanel.test.ts`

- [x] **Step 1: Write the failing component test**

Add a test that mounts with `editable: false` and verifies Generate, Horizontal, and Vertical are disabled. Update props to `editable: true` and verify all three become enabled when the factor data is valid. Then set `valid: false` and verify Generate is disabled while the orientation buttons remain enabled.

```ts
it("enables generation and orientation only while Factor Setup is editable", async () => {
  const wrapper = mount(DimensionChainPanel, {
    props: { factors, valid: true, editable: false },
  });
  const generate = wrapper.get("[data-generate-dimension-chain]");
  const horizontal = wrapper.get("button[aria-label='Horizontal dimension chain']");
  const vertical = wrapper.get("button[aria-label='Vertical dimension chain']");

  expect(generate.attributes("disabled")).toBeDefined();
  expect(horizontal.attributes("disabled")).toBeDefined();
  expect(vertical.attributes("disabled")).toBeDefined();

  await wrapper.setProps({ editable: true });
  expect(generate.attributes("disabled")).toBeUndefined();
  expect(horizontal.attributes("disabled")).toBeUndefined();
  expect(vertical.attributes("disabled")).toBeUndefined();

  await wrapper.setProps({ valid: false });
  expect(generate.attributes("disabled")).toBeDefined();
  expect(horizontal.attributes("disabled")).toBeUndefined();
  expect(vertical.attributes("disabled")).toBeUndefined();
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts -t "enables generation and orientation only while Factor Setup is editable"
```

Expected: FAIL because all three controls currently ignore `editable`.

- [x] **Step 3: Implement the minimal disabled bindings**

In `DimensionChainPanel.vue`, prepend `!editable` to Generate/Update's existing disabled expression and bind `:disabled="!editable"` to both orientation buttons.

```vue
:disabled="!editable || (!valid && !emptyStateActionEnabled) || (generatedFactors !== undefined && !stale)"
```

```vue
:disabled="!editable"
```

- [x] **Step 4: Run focused and full validation**

Run:

```powershell
npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts
npx vitest run apps/f7-web/src/App.test.ts
npm run build:f7:web
git diff --check
```

Expected: all tests and build pass. Existing unrelated build-size or line-ending warnings may remain, but no new errors are introduced.

- [x] **Step 5: Verify the real UI state transition**

In the active F7 browser session, confirm Generate, Horizontal, and Vertical are disabled before selecting `Edit setup`, become enabled after selecting it, and pure view controls remain enabled in the locked state.
