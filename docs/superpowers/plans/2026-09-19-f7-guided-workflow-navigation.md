# F7 Guided Workflow Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all three F7 workflow steps a consistent title, guidance, and explicit action area with clear enabled and disabled states.

**Architecture:** Keep the existing workflow state machine and event handlers in `App.vue`. Reshape only the workflow navigation markup and derived labels, then update the existing CSS selectors and Vue component tests to describe the new presentation and interaction contract.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils, CSS, Playwright browser verification

---

### Task 1: Lock the guided workflow behavior

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] **Step 1: Write the failing tests**

Update the workflow tests to require a `.workflow-step-heading` and `.workflow-step-actions` in every step. Assert that an initial locked step contains a disabled action button rather than no controls, Step 1 exposes `Change selection` after worksheet selection, Step 2 retains `Excel Bulk Import` and `Web Factor Entry`, and Step 3 uses `Run Monte Carlo` before a result and `View results` after a result.

```ts
const steps = wrapper.findAll("ol.workflow-steps > li");
expect(steps.every((step) => step.find(".workflow-step-heading").exists())).toBe(true);
expect(steps.every((step) => step.find(".workflow-step-actions").exists())).toBe(true);
expect(steps[2]!.get("button").attributes("disabled")).toBeDefined();
expect(steps[2]!.get("button").text()).toBe("Run Monte Carlo");
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npx.cmd vitest run apps/f7-web/src/App.test.ts
```

Expected: FAIL because locked steps currently have no buttons and headings/actions are not structurally consistent.

- [ ] **Step 3: Commit the failing behavioral tests**

```powershell
git add apps/f7-web/src/App.test.ts
git commit -m "test(f7): specify guided workflow actions"
```

### Task 2: Implement the consistent three-step navigation

**Files:**
- Modify: `apps/f7-web/src/App.vue`
- Modify: `apps/f7-web/src/style.css`
- Test: `apps/f7-web/src/App.test.ts`

- [ ] **Step 1: Implement state-derived action labels and consistent markup**

Keep `workflowStepState`, `restartFromWorksheetSelection`, `onMeasurementEntryModeChange`, and `openMonteCarlo` as the behavioral authority. Render each title as non-interactive text and place controls in every `.workflow-step-actions` area:

```vue
<h3 class="workflow-step-heading">{{ step.label }}</h3>
<span class="step-status">{{ workflowStepStatusText(step.id, workflowStepState(step.id)) }}</span>
<div class="workflow-step-actions">
  <!-- Step-specific real button controls, including disabled controls when unavailable. -->
</div>
```

Use `Change selection` for the completed Step 1 action, preserve both Step 2 tabs and their keyboard semantics, and label the Step 3 action `Run Monte Carlo` or `View results` according to whether `monteCarloResult` exists. Do not add new state transitions.

- [ ] **Step 2: Apply the approved visual states**

Use shared workflow action sizing and bottom alignment. Enabled primary actions use `var(--ink)` with white text; disabled actions use neutral gray; current and complete cards retain their existing border semantics. Keep the desktop three-column layout and switch directly to one column at the existing narrow breakpoint.

```css
.workflow-steps li {
  grid-template-rows: auto auto 1fr auto;
}

.workflow-step-action {
  min-height: 36px;
  border: 1px solid var(--ink);
  background: var(--ink);
  color: #fff;
}

.workflow-step-action:disabled {
  border-color: #d3d7dc;
  background: #dfe2e6;
  color: #707782;
}
```

- [ ] **Step 3: Run the focused tests and verify GREEN**

Run:

```powershell
npx.cmd vitest run apps/f7-web/src/App.test.ts
```

Expected: all `App.test.ts` tests pass.

- [ ] **Step 4: Run static validation**

Run:

```powershell
npx.cmd eslint apps/f7-web/src/App.vue apps/f7-web/src/App.test.ts
npm.cmd run build --workspace @ai-assist/f7-web
```

Expected: both commands exit 0.

- [ ] **Step 5: Verify desktop and narrow viewport behavior**

Open `http://127.0.0.1:5177`, verify the three cards at desktop width, then verify a narrow viewport. Confirm action colors, disabled states, keyboard focus, wrapping, and no overlap. Capture screenshots as evidence.

- [ ] **Step 6: Commit the implementation**

```powershell
git add apps/f7-web/src/App.vue apps/f7-web/src/style.css apps/f7-web/src/App.test.ts
git commit -m "feat(f7): improve workflow step guidance"
```