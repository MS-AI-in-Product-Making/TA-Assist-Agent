# F7 Workbook Replacement Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require explicit confirmation before a selected workbook replaces any existing F7 session.

**Architecture:** `App.vue` stages a replacement `File` locally instead of calling the client immediately. The existing alert dialog renders action-specific copy and either imports the staged file or opens the native picker for the existing workflow restart path.

**Tech Stack:** Vue 3.5, TypeScript, Vitest 3, Vue Test Utils

---

### Task 1: Protect Direct Workbook Replacement

**Files:**
- Modify: `apps/f7-web/src/App.vue`
- Test: `apps/f7-web/src/App.test.ts`

- [x] **Step 1: Write the failing replacement tests**

Add focused tests that mount `App` with an existing `worksheet_selection` session, select `replacement.xlsx`, and assert that `client.importWorkbook` is not called before the alert dialog decision. Verify `Cancel` keeps the current workbook name, clears the native input, and permits the same file to trigger the dialog again. Verify `Continue` imports the exact staged `File` once.

```ts
const replacement = new File([new Uint8Array([4, 5, 6])], "replacement.xlsx");
await uploadWorkbook(wrapper, replacement);

expect(client.importWorkbook).not.toHaveBeenCalled();
expect(wrapper.get("[data-workflow-restart-confirmation]").text()).toContain("Replace current workbook?");

await wrapper.get("[data-workflow-restart-cancel]").trigger("click");
expect(wrapper.get("[data-workbook-name]").text()).toBe("demo.xlsx");
expect((wrapper.get("#workbook-file").element as HTMLInputElement).value).toBe("");

await uploadWorkbook(wrapper, replacement);
await wrapper.get("[data-workflow-restart-continue]").trigger("click");
expect(client.importWorkbook).toHaveBeenCalledTimes(1);
expect(client.importWorkbook).toHaveBeenCalledWith(replacement);
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "confirms before replacing"
```

Expected: FAIL because the current change handler calls `importWorkbook` immediately and does not render replacement-specific confirmation text.

- [x] **Step 3: Stage replacements and reuse the alert dialog**

Add `pendingWorkbookFile`, extract immediate import into `importWorkbookFile(file)`, and route input changes based on whether `store.session.value` exists.

```ts
const pendingWorkbookFile = ref<File>();

async function importWorkbookFile(file: File): Promise<void> {
  fitActionFactorId.value = "";
  try {
    await store.importWorkbook(file);
    reportRequestToken += 1;
    activeMeasurementFactorId.value = "";
    activeMeasurementStage.value = "measurement";
    editingFactorSetup.value = false;
  } catch {
    // Store already captures and exposes a controlled UI error.
  } finally {
    pendingWorkbookFile.value = undefined;
    if (workbookInput.value) workbookInput.value.value = "";
  }
}

function onImportFile(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  if (!store.session.value) {
    void importWorkbookFile(file);
    return;
  }
  pendingWorkbookFile.value = file;
  restartConfirmationVisible.value = true;
  void nextTick(() => restartContinueButton.value?.focus());
}
```

Update cancellation to clear the staged file and native input. Update confirmation so a staged file is imported directly; otherwise preserve the existing clear-and-click picker behavior.

```ts
function cancelWorksheetRestart(): void {
  restartConfirmationVisible.value = false;
  pendingWorkbookFile.value = undefined;
  if (workbookInput.value) workbookInput.value.value = "";
}

function confirmWorksheetRestart(): void {
  const input = workbookInput.value;
  if (!input) return;
  restartConfirmationVisible.value = false;
  const replacement = pendingWorkbookFile.value;
  if (replacement) {
    void importWorkbookFile(replacement);
    return;
  }
  input.value = "";
  input.click();
}
```

Render `Replace current workbook?` and replacement-specific description when `pendingWorkbookFile` exists. Retain existing workflow-restart copy otherwise, and disable both dialog actions while busy.

- [x] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "confirms before replacing|workflow rail marks step2"
```

Expected: both replacement and existing workflow restart tests pass.

- [x] **Step 5: Run regression and build verification**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts
npm run build:f7:web
git diff --check
```

Expected: all App tests pass, the F7 Web production build exits successfully, and `git diff --check` reports no whitespace errors.

- [x] **Step 6: Verify the browser workflow**

With an existing workbook loaded at `http://127.0.0.1:5178/`, select a different workbook. Confirm the modal appears before any parsing progress, `Cancel` preserves the original workbook, and `Continue` starts the existing parsing progress state for the staged replacement.