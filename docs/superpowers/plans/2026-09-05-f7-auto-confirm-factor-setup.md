# F7 Automatic Factor Setup Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically persist imported Factor setup and open the read-only Source Mode workflow without requiring a manual `Save setup` click.

**Architecture:** Keep payload construction in `FactorInputTable.vue` and invoke its existing `submitSetup()` once when a valid `factor_setup` session first mounts outside manual edit mode. Let `App.vue` retain read-only mode after success and enter edit mode after a controlled confirmation failure.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils, Vite

---

### Task 1: Specify automatic confirmation behavior

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`

- [x] **Step 1: Write the failing success-path test**

Update the worksheet confirmation test so `confirmFactors` returns `measurementEntrySnapshot()`, then assert after clicking `Confirm selection` that `confirmFactors` receives the imported Factor values, the table is read-only, `Edit setup` is visible, and Source Mode controls exist:

```ts
const client = createMockClient(createSnapshot({ status: "worksheet_selection" }), {
  importWorkbook: createSnapshot({ status: "worksheet_selection" }),
  confirmWorksheet: factorSetupSnapshot(),
  confirmFactors: measurementEntrySnapshot(),
});
const wrapper = mount(App, { props: { client } });
await uploadWorkbook(wrapper);
await wrapper.get("input[type='radio'][name='worksheet-option'][value='Loop_B']").setValue(true);
await wrapper.get("[aria-label='Worksheet confirmation'] button.action-button").trigger("click");
await vi.waitFor(() => expect(client.confirmFactors).toHaveBeenCalledTimes(1));
expect(wrapper.find("#confirm-factor-setup").exists()).toBe(false);
expect(wrapper.get("[data-edit-factor-setup]").text()).toBe("Edit setup");
expect(wrapper.find("input.factor-spec-input").exists()).toBe(false);
expect(wrapper.find("fieldset.source-mode-options").exists()).toBe(true);
```

Assert the existing DTO contains `sessionId`, imported Factor confirmation values, and the imported system specification.

- [x] **Step 2: Write the failing failure-path test**

Configure `confirmFactors` to reject with a controlled client error after worksheet confirmation. Assert that editable Factor fields and `Save setup` remain available and Source Mode controls remain hidden:

```ts
vi.mocked(client.confirmFactors).mockRejectedValueOnce(new Error("Automatic factor confirmation failed."));
const wrapper = mount(App, { props: { client } });
await uploadWorkbook(wrapper);
await wrapper.get("input[type='radio'][name='worksheet-option'][value='Loop_B']").setValue(true);
await wrapper.get("[aria-label='Worksheet confirmation'] button.action-button").trigger("click");
await vi.waitFor(() => expect(client.confirmFactors).toHaveBeenCalledTimes(1));
expect(wrapper.get("#confirm-factor-setup").text()).toBe("Save setup");
expect(wrapper.find("input.factor-spec-input").exists()).toBe(true);
expect(wrapper.find("fieldset.source-mode-options").exists()).toBe(false);
```

- [x] **Step 3: Run focused tests and verify RED**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "worksheet confirmation"
```

Expected: the new success and failure assertions fail because setup confirmation is not automatic.

### Task 2: Implement automatic confirmation

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/App.vue`

- [x] **Step 1: Trigger the existing setup submission once on mount**

Import `onMounted` and add:

```ts
onMounted(() => {
  if (props.session.status === "factor_setup" && !props.editingSetup) submitSetup();
});
```

Change editability so only explicit user editing unlocks the table:

```ts
const setupEditable = computed(() => props.editingSetup);
```

This keeps automatic and manual confirmations on the existing `submitSetup()` payload path.

- [x] **Step 2: Preserve editable recovery after confirmation failure**

Keep the existing `onConfirmFactors` signature and replace only its function body with explicit success/failure state handling:

```ts
{
  fitActionFactorId.value = "";
  try {
    await store.confirmFactors(confirmations, systemSpecification);
    editingFactorSetup.value = false;
  } catch {
    editingFactorSetup.value = true;
  }
}
```

The store continues to expose the controlled UI error; only the editing state changes on failure.

- [x] **Step 3: Run focused tests and verify GREEN**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "worksheet confirmation"
```

Expected: all worksheet confirmation tests pass.

### Task 3: Update affected setup tests and verify regressions

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`

- [x] **Step 1: Update tests that intentionally exercise setup editing**

For tests mounting a `factor_setup` snapshot and then editing Factor values, configure `confirmFactors: measurementEntrySnapshot()`, await automatic confirmation, and click `[data-edit-factor-setup]` before querying editable inputs. Preserve all existing assertions for manual `Edit setup` to `Save setup` behavior.

- [x] **Step 2: Run the complete App test file**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts
```

Expected: all tests pass with no unhandled errors.

- [x] **Step 3: Run the F7 Web build**

Run:

```powershell
npm run build:f7:web
```

Expected: Vue TypeScript checking and Vite production build both succeed.

### Task 4: Browser regression

**Files:**
- No source changes expected

- [ ] **Step 1: Reload the running F7 UI and import a real workbook through the shared browser**

Use the existing local stack at `http://127.0.0.1:5177`. After the user selects the workbook and confirms the worksheet, wait for automatic confirmation to complete.

- [ ] **Step 2: Verify the primary workflow**

Confirm that `Edit setup` is visible, Factor specification inputs are absent, Source Mode controls are enabled, selecting `MEASURED` enables `Open workspace`, and no console or failed-network errors occur.

- [ ] **Step 3: Verify manual editing**

Click `Edit setup`, verify Factor controls unlock and `Save setup` appears, then leave workbook data unchanged unless the user explicitly requests an engineering data modification.

No Git commit is created because the user did not request one.
