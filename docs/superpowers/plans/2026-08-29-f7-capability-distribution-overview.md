# F7 Capability and Distribution Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the complete Distribution Fit analysis beneath Capability Analysis, move Review Measurement Data above the Capability heading, and preserve the dedicated Distribution Fit stage.

**Architecture:** Extract the existing distribution-fit presentation into a stateless shared Vue component that owns presentation-derived transforms and formatting. `MeasurementPastePanel.vue` retains session state, API calls, expanded plot state, capability calculations, and governance validation before emitting approval to the parent application; it renders the shared component in both Capability and Distribution stages and requests fitting once when Capability is entered without a result.

**Tech Stack:** Vue 3.5 SFCs, TypeScript, Vitest 3, Vue Test Utils, Vite 7, CSS

---

## File Structure

- Create `apps/f7-web/src/components/DistributionFitAnalysis.vue`: shared complete distribution-fit presentation, presentation-derived transforms, formatting, candidate sorting, conclusion text, Q-Q details, plots, and approval control.
- Modify `apps/f7-web/src/components/MeasurementPastePanel.vue`: move Review Measurement Data, render the shared component twice, retain session state, API call, expanded plot state, and approval-governance ownership, and auto-request fitting from Capability.
- Modify `apps/f7-web/src/style.css`: style the embedded section boundary and responsive action placement without duplicating distribution table styles.
- Modify `apps/f7-web/src/App.test.ts`: cover page order, automatic fitting, complete embedded content, shared plot state, approval, and preserved detail navigation.

### Task 1: Lock Capability overview behavior with failing tests

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] **Step 1: Add a placement and automatic-fit test**

Add a test using `phaseReadySnapshot()` and `distributionFitSnapshot()` that opens the measurement workspace, clicks `[data-stage='capability']`, and asserts:

```ts
const workspace = wrapper.get("[aria-label='Factor measurement workspace']");
await workspace.get("button[data-stage='capability']").trigger("click");

expect(client.fitDistribution).toHaveBeenCalledWith({
  sessionId: "session-01",
  factorId: HASH_C,
});
await vi.waitFor(() => {
  expect(workspace.find("[data-capability-distribution-fit]").exists()).toBe(true);
});
const capabilityHeading = workspace.get(".capability-analysis h3");
const reviewButton = workspace.get("[data-review-measurements]");
expect(reviewButton.element.compareDocumentPosition(capabilityHeading.element)
  & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
expect(workspace.findAll("[data-capability-distribution-fit] .distribution-fit-table tbody > tr")).not.toHaveLength(0);
expect(workspace.get("[data-capability-distribution-fit] [data-fit-conclusion]").text())
  .toContain("Proposed final distribution: Normal");
```

- [ ] **Step 2: Add a no-duplicate-fit test**

Mount from `distributionFitSnapshot()`, enter Capability, and assert:

```ts
expect(client.fitDistribution).not.toHaveBeenCalled();
expect(workspace.find("[data-capability-distribution-fit] table.distribution-fit-table").exists()).toBe(true);
```

- [ ] **Step 3: Add shared interaction assertions**

From Capability, toggle the Normal plot and approve the proposed distribution:

```ts
await workspace.get("[data-capability-distribution-fit] [data-fit-plot-family='normal']").trigger("click");
expect(workspace.find("[data-capability-distribution-fit] [data-distribution-plot='normal']").exists()).toBe(true);
await workspace.get("[data-capability-distribution-fit] [data-approve-distribution]").trigger("click");
expect(client.approveDistribution).toHaveBeenCalledWith({
  sessionId: "session-01",
  factorId: HASH_C,
  family: "normal",
  confirmed: true,
});
```

- [ ] **Step 4: Run the focused tests and verify failure**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "Capability.*Distribution|distribution.*Capability" --testTimeout=15000
```

Expected: FAIL because `[data-capability-distribution-fit]` and `[data-review-measurements]` do not exist and Capability does not request fitting.

### Task 2: Extract the complete Distribution Fit presentation

**Files:**
- Create: `apps/f7-web/src/components/DistributionFitAnalysis.vue`
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`

- [ ] **Step 1: Define the shared component contract**

Create a script setup component with these inputs and events:

```ts
import { computed, type DeepReadonly } from "vue";
import type {
  F7DistributionFitResult,
  F7SessionSnapshot,
  F7UiError,
} from "../api/f7-client";
import type {
  DistributionFitObservedDomain,
  DistributionFitReferences,
  FactorSetupAssumption,
} from "../distribution-fit-plot";
import DistributionFitPlot from "./DistributionFitPlot.vue";

type DistributionApproval = NonNullable<
  F7SessionSnapshot["factors"][number]["distributionApproval"]
>;

const props = defineProps<{
  readonly result: DeepReadonly<F7DistributionFitResult> | undefined;
  readonly approval: DeepReadonly<DistributionApproval> | undefined;
  readonly fitLoading: boolean;
  readonly fitError: F7UiError | null;
  readonly busy: boolean;
  readonly factorName: string | undefined;
  readonly expandedPlotFamily: string | undefined;
  readonly plotDomain: DistributionFitObservedDomain | undefined;
  readonly plotReferences: DistributionFitReferences | undefined;
  readonly setupAssumption: FactorSetupAssumption | undefined;
}>();

const emit = defineEmits<{
  togglePlot: [family: string];
  approve: [family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform"];
}>();
```

- [ ] **Step 2: Move presentation-derived logic into the component**

Move presentation-derived candidate sorting, warnings, failed candidates, conclusion statements, family labels, parameter formatting, model labels, decision labels, reason checks, and failure labels from `MeasurementPastePanel.vue`. Keep them computed solely from `props.result`; session state, API calls, expanded plot state, and approval governance remain in `MeasurementPastePanel.vue`.

- [ ] **Step 3: Move the full Distribution Fit template**

Move loading, error, candidate table, plot rows, Q-Q details, warnings, failures, no-model state, conclusion, and approval button into the shared component. Preserve all existing data attributes, ARIA labels, table structure, and text. Replace handlers with:

```vue
@click="emit('togglePlot', candidate.family)"
```

and:

```vue
@click="selectionDecision?.proposedFinalFamily
  && emit('approve', selectionDecision.proposedFinalFamily)"
```

- [ ] **Step 4: Render the shared component in the dedicated stage**

Replace the moved markup in `MeasurementPastePanel.vue` with:

```vue
<DistributionFitAnalysis
  :result="distributionFitResult"
  :approval="distributionApproval"
  :fit-loading="fitLoading"
  :fit-error="fitError"
  :busy="busy"
  :factor-name="selectedFactor?.factorCandidate.factorName"
  :expanded-plot-family="expandedPlotFamily"
  :plot-domain="distributionPlotDomain"
  :plot-references="distributionPlotReferences"
  :setup-assumption="factorSetupAssumption"
  @toggle-plot="toggleDistributionPlot"
  @approve="approveDistributionFamily"
/>
```

Change approval control to accept the emitted family and preserve governance checks before emitting `approve` to the parent application.

- [ ] **Step 5: Run existing Distribution Fit tests**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "8b|8c|8e" --testTimeout=15000
```

Expected: PASS with the dedicated Distribution Fit behavior unchanged.

### Task 3: Embed Distribution Fit and request it from Capability

**Files:**
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] **Step 1: Move Review Measurement Data above the heading**

At the start of the Capability branch, render:

```vue
<div class="capability-heading-actions">
  <button
    type="button"
    class="workspace-close-button"
    data-review-measurements
    @click="activeStage = 'measurement'"
  >
    Review Measurement Data
  </button>
</div>
<p class="workspace-eyebrow">Measurement data confirmed</p>
<h3>Capability Analysis</h3>
```

Remove the old button below the capability status content.

- [ ] **Step 2: Add the embedded shared component below Capability**

After the capability result/error content, render:

```vue
<section class="capability-distribution-fit" data-capability-distribution-fit>
  <p class="workspace-eyebrow">Complete model comparison</p>
  <h3>Distribution Fit</h3>
  <DistributionFitAnalysis
    :result="distributionFitResult"
    :approval="distributionApproval"
    :fit-loading="fitLoading"
    :fit-error="fitError"
    :busy="busy"
    :factor-name="selectedFactor?.factorCandidate.factorName"
    :expanded-plot-family="expandedPlotFamily"
    :plot-domain="distributionPlotDomain"
    :plot-references="distributionPlotReferences"
    :setup-assumption="factorSetupAssumption"
    @toggle-plot="toggleDistributionPlot"
    @approve="approveDistributionFamily"
  />
</section>
```

- [ ] **Step 3: Add one-shot automatic fitting on Capability entry**

Extend the existing `watch(activeStage, ...)` callback:

```ts
watch(activeStage, (stage) => {
  emit("stageChange", stage);
  if (
    stage === "capability"
    && measurementReady.value
    && !props.busy
    && !props.fitLoading
    && !props.fitError
    && !distributionFitResult.value
  ) {
    emit("fit", props.factorId);
  }
});
```

Keep `openDistributionFit()` responsible for explicit detail-page fitting and retry behavior.

- [ ] **Step 4: Keep proposed plot selection synchronized**

Update the result watcher so a newly returned fit result opens the proposed plot in either Capability or Distribution:

```ts
if (
  (activeStage.value === "capability" || activeStage.value === "distribution")
  && resultKey !== previousResultKey
) {
  showProposedDistributionPlot();
}
```

- [ ] **Step 5: Run Capability integration tests**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "Capability.*Distribution|distribution.*Capability|calculates capability" --testTimeout=15000
```

Expected: PASS, including automatic fitting, full embedded evidence, button order, plot interaction, and approval.

### Task 4: Responsive styling and end-to-end verification

**Files:**
- Modify: `apps/f7-web/src/style.css`
- Test: `apps/f7-web/src/App.test.ts`

- [ ] **Step 1: Add visual separation and action alignment**

Add:

```css
.capability-heading-actions {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 12px;
}

.capability-heading-actions .workspace-close-button {
  margin-top: 0;
}

.capability-distribution-fit {
  min-width: 0;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 2px solid var(--line);
}
```

Keep `.distribution-fit-table-scroll { overflow-x: auto; }` as the containment boundary so the document does not overflow horizontally.

- [ ] **Step 2: Run all frontend tests**

Run:

```powershell
npx vitest run apps/f7-web/src --testTimeout=15000
```

Expected: all frontend test files and tests pass.

- [ ] **Step 3: Build the frontend**

Run:

```powershell
npm run build:f7:web
```

Expected: exit code 0 with no TypeScript or Vite build errors.

- [ ] **Step 4: Validate desktop in the shared browser**

At `1440 x 900`, verify:

- Review Measurement Data appears above Capability Analysis;
- Capability metrics and the complete Distribution Fit section are visible in one continuous page;
- candidate table scrolls within its container;
- plot toggles, Q-Q details, and approval operate;
- the dedicated Distribution Fit stage still opens the same analysis.

- [ ] **Step 5: Validate mobile in the shared browser**

At `390 x 844`, verify:

- no document-level horizontal overflow;
- Review Measurement Data remains visible before Capability Analysis;
- candidate table owns horizontal scrolling;
- plot and conclusion text remain readable.

- [ ] **Step 6: Restore desktop viewport and check diagnostics**

Restore `1440 x 900` and run editor diagnostics for:

- `apps/f7-web/src/components/DistributionFitAnalysis.vue`;
- `apps/f7-web/src/components/MeasurementPastePanel.vue`;
- `apps/f7-web/src/style.css`;
- `apps/f7-web/src/App.test.ts`.

Expected: no errors.
