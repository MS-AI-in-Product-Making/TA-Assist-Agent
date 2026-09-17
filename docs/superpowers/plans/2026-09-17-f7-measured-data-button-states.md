# F7 Measured Data Button States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every `Measured Data` button a deterministic empty, ready, warning, or blocked visual state while preserving blocked bulk-import feedback until users correct the data.

**Architecture:** `FactorInputTable` owns a pure four-state projection from persisted Factor data plus an optional Web-only blocked-import map. `App.vue` derives and retains blocked Factor diagnostics from import previews, clears them at lifecycle boundaries, and passes them into the table. Existing measurement warning logic remains the single advisory authority.

**Tech Stack:** Vue 3 Composition API, TypeScript, CSS, Vitest, Vue Test Utils, Playwright.

---

### Task 1: Factor Button State Projection

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.test.ts`
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`

- [ ] **Step 1: Write failing component tests**

Add tests that mount measured Factors in these exact conditions and assert the button state:

```ts
expect(button.attributes("data-measured-state")).toBe("empty");
expect(button.attributes("aria-label")).toContain("No measured data");

expect(button.attributes("data-measured-state")).toBe("ready");
expect(button.attributes("aria-label")).toContain("passed validation");

expect(button.attributes("data-measured-state")).toBe("warning");
expect(wrapper.get(".factor-workspace-warning-indicator").text()).toBe("Warning");

expect(button.attributes("data-measured-state")).toBe("blocked");
expect(wrapper.get(".factor-workspace-blocked-indicator").text()).toBe("Action required");
expect(button.attributes("disabled")).toBeUndefined();
```

Cover both a persisted `measurementPasteResult.status === "blocked"` and an ID supplied through the optional bulk-blocked prop. Assert `blocked` takes precedence over an otherwise ready warning Factor.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npx.cmd vitest run apps/f7-web/src/components/FactorInputTable.test.ts -t "Measured Data button state"
```

Expected: FAIL because `data-measured-state`, blocked diagnostics prop, and `Action required` do not exist.

- [ ] **Step 3: Implement the minimal state projection**

Add these local types and optional prop:

```ts
type MeasuredDataButtonState = "empty" | "ready" | "warning" | "blocked";

interface BlockedMeasurementFactor {
  readonly factorId: string;
  readonly message: string;
}

const props = defineProps<{
  // existing props remain unchanged
  readonly blockedMeasurementFactors?: readonly BlockedMeasurementFactor[];
}>();
```

Build a computed ID-to-message map, then project state with strict precedence:

```ts
function measuredDataButtonState(factor: DeepReadonly<F7FactorState>): MeasuredDataButtonState {
  const factorId = factor.evidence?.factorId;
  if (factor.measurementPasteResult?.status === "blocked"
    || (factorId && blockedMeasurementFactorMessages.value.has(factorId))) return "blocked";
  if (factor.measurementPasteResult?.status !== "ready") return "empty";
  if (measurementWorkspaceWarnings(factor).length > 0) return "warning";
  return "ready";
}
```

Add state-aware `data-measured-state`, `aria-label`, and `title` to both Bulk Import and individual-entry workspace buttons. Render `Warning` for `warning` and `Action required` for `blocked`, keeping the button clickable unless the existing global `busy` state applies.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the same focused Vitest command. Expected: all `Measured Data button state` tests PASS.

### Task 2: Semantic Button Styling

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] **Step 1: Write failing CSS contract assertions**

Add one assertion for each stable state selector:

```ts
expect(STYLE_SOURCE).toMatch(/\.factor-workspace-button\[data-measured-state="empty"\]/);
expect(STYLE_SOURCE).toMatch(/\.factor-workspace-button\[data-measured-state="ready"\]/);
expect(STYLE_SOURCE).toMatch(/\.factor-workspace-button\[data-measured-state="warning"\]/);
expect(STYLE_SOURCE).toMatch(/\.factor-workspace-button\[data-measured-state="blocked"\]/);
```

- [ ] **Step 2: Run the focused App test and verify RED**

Run:

```powershell
npx.cmd vitest run apps/f7-web/src/App.test.ts -t "factor_setup exposes editable specifications"
```

Expected: FAIL because the four state selectors are absent.

- [ ] **Step 3: Add semantic state styles**

Implement the approved colors:

```css
.factor-workspace-button[data-measured-state="empty"] {
  border-color: #5f6d80;
  background: #fff;
  color: #16253d;
}

.factor-workspace-button[data-measured-state="ready"] {
  border-color: #0d7a69;
  background: #f0f7f5;
  color: #0d6a5c;
}

.factor-workspace-button[data-measured-state="warning"] {
  border-color: #b54708;
  background: #fff8e8;
  color: #694600;
}

.factor-workspace-button[data-measured-state="blocked"] {
  border-color: #b5392f;
  background: #fff1ef;
  color: #9f2f28;
}
```

Add state-specific hover colors without changing the existing disabled treatment. Give `.factor-workspace-blocked-indicator` the same placement as the warning indicator and a danger text color.

- [ ] **Step 4: Run focused App and component tests**

Run:

```powershell
npx.cmd vitest run apps/f7-web/src/App.test.ts -t "factor_setup exposes editable specifications"
npx.cmd vitest run apps/f7-web/src/components/FactorInputTable.test.ts
```

Expected: both commands PASS.

### Task 3: Retain Blocked Bulk-Import Results

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/App.vue`

- [ ] **Step 1: Write failing App lifecycle tests**

Add tests that verify:

```ts
expect(wrapper.get(`[data-open-measurement="${blockedFactorId}"]`).attributes("data-measured-state"))
  .toBe("blocked");
```

Cover these transitions independently:

1. A blocked import preview marks only blocked preview Factors red.
2. Closing the import dialog keeps the blocked button state.
3. A successful commit clears blocked state for committed Factors.
4. Replacing the session clears all retained blocked state.

- [ ] **Step 2: Run lifecycle tests and verify RED**

Run:

```powershell
npx.cmd vitest run apps/f7-web/src/App.test.ts -t "retains blocked measurement button state"
```

Expected: FAIL because App does not retain or pass blocked diagnostics.

- [ ] **Step 3: Implement App-only retained state**

Add a ref with a minimal UI-facing shape:

```ts
const blockedMeasurementFactors = ref<readonly {
  readonly factorId: string;
  readonly message: string;
}[]>([]);
```

After `store.previewMeasurementImport(file)`, replace the ref only when the preview contains blocked Factors. Use the first diagnostic `displayMessage`, falling back to `Measurement validation is blocked.` Preserve this ref when the dialog closes.

Before commit, capture preview Factor IDs. After a successful commit, remove those IDs from the ref. In the existing session-ID watcher, clear the ref when the session ID changes. Pass it to `FactorInputTable` as `:blocked-measurement-factors="blockedMeasurementFactors"`.

- [ ] **Step 4: Run lifecycle tests and verify GREEN**

Run the focused lifecycle command. Expected: all retention and clearing tests PASS.

### Task 4: Regression and Browser Verification

**Files:**
- Verify: `apps/f7-web/src/components/FactorInputTable.vue`
- Verify: `apps/f7-web/src/App.vue`
- Verify: `apps/f7-web/src/style.css`

- [ ] **Step 1: Run the complete relevant regression suite**

```powershell
npx.cmd vitest run apps/f7-web/src/components/FactorInputTable.test.ts apps/f7-web/src/App.test.ts apps/f7-web/src/measurement-workspace-warnings.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Check editor diagnostics**

Run diagnostics for the touched Vue, TypeScript test, and CSS files. Expected: no new errors.

- [ ] **Step 3: Verify the live UI with Playwright**

At desktop and mobile viewport widths, verify:

- all visible `Measured Data` buttons retain identical x alignment within the Source Mode column;
- each state has the approved computed background, border, and foreground color;
- `Warning` and `Action required` remain in the right grid column without overlap;
- every non-busy state button remains clickable;
- no horizontal text clipping occurs.

- [ ] **Step 4: Remove the temporary visual comparison overlay**

Remove `#measured-state-design-preview` from the shared browser page and leave the live application visible.