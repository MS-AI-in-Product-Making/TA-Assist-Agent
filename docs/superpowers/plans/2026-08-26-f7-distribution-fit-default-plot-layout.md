# F7 Distribution Fit Default Plot Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically show only the governed final Distribution Plot by default and move every Plot's explanatory text into a grouped right-side panel.

**Architecture:** Keep `selectionDecision.proposedFinalFamily` as the sole default-selection authority in `MeasurementPastePanel.vue`; synchronize the local single-expanded-family state only at lifecycle boundaries so manual collapse remains respected. Keep all chart calculations and SVG rendering unchanged, while `DistributionFitPlot.vue` and shared CSS provide a responsive chart-plus-caption layout.

**Tech Stack:** Vue 3 Composition API, TypeScript, native SVG, CSS Grid, Vitest, Vue Test Utils, Playwright

---

## File Structure

- Modify `apps/f7-web/src/App.test.ts`: workflow-level assertions for automatic, exclusive, and absent-default Plot behavior.
- Modify `apps/f7-web/src/components/MeasurementPastePanel.vue`: initialize the expanded family from the governed final selection at controlled lifecycle boundaries.
- Modify `apps/f7-web/src/components/DistributionFitPlot.vue`: add semantic chart and grouped caption wrappers.
- Modify `apps/f7-web/src/style.css`: implement desktop right-side information panel and narrow-screen stacking/internal scrolling.

### Task 1: Governed Default Plot State

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`

- [ ] **Step 1: Write failing workflow tests**

Update the existing distribution-fit workflow test so it asserts the Normal Plot immediately after fitting, before any Plot button click:

```ts
const normalPlot = workspace.get("[data-distribution-plot='normal']");
expect(workspace.get("button[data-fit-plot-family='normal']").text()).toBe("Hide plot");
expect(workspace.find("[data-distribution-plot='lognormal']").exists()).toBe(false);
expect(workspace.find("[data-distribution-plot='gamma']").exists()).toBe(false);
```

Then click Lognormal and assert exclusive switching, followed by manual collapse:

```ts
await workspace.get("button[data-fit-plot-family='lognormal']").trigger("click");
expect(workspace.find("[data-distribution-plot='normal']").exists()).toBe(false);
expect(workspace.find("[data-distribution-plot='lognormal']").exists()).toBe(true);
await workspace.get("button[data-fit-plot-family='lognormal']").trigger("click");
expect(workspace.findAll("[data-distribution-plot]")).toHaveLength(0);
```

In the existing no-acceptable-model case, assert no Plot is rendered by default:

```ts
expect(workspace.findAll("[data-distribution-plot]")).toHaveLength(0);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "distribution fit|acceptable model"
```

Expected: FAIL because the proposed Normal Plot is absent until its button is clicked.

- [ ] **Step 3: Implement minimal lifecycle synchronization**

Add a small helper in `MeasurementPastePanel.vue`:

```ts
function showProposedDistributionPlot(): void {
  expandedPlotFamily.value = selectionDecision.value?.proposedFinalFamily;
}
```

Call it when entering Distribution Fit if a result already exists. Add a watcher keyed by the current factor and its fit result so a newly returned result or factor switch applies the governed default once:

```ts
watch(
  () => [props.factorId, distributionFitResult.value] as const,
  ([, result], [, previousResult]) => {
    if (activeStage.value === "distribution" && result !== previousResult) {
      showProposedDistributionPlot();
    }
  },
);
```

Do not watch `expandedPlotFamily` or continuously mirror `selectionDecision`; clicking `Hide plot` must remain effective until a lifecycle boundary.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "distribution fit|acceptable model"
```

Expected: all selected tests PASS.

### Task 2: Right-Side Grouped Plot Explanation

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/components/DistributionFitPlot.vue`
- Modify: `apps/f7-web/src/style.css`

- [ ] **Step 1: Write failing component structure assertions**

Extend the Plot assertions in `App.test.ts`:

```ts
expect(normalPlot.get("[data-distribution-plot-graphic]").find("svg").exists()).toBe(true);
const explanation = normalPlot.get("[data-distribution-plot-explanation]");
expect(explanation.get("[data-plot-legend]").text()).toContain("Observed frequency");
expect(explanation.get("[data-plot-legend]").text()).toContain("Fitted normal expected frequency");
expect(explanation.get("[data-plot-legend]").text()).toContain("n = 32");
expect(explanation.get("[data-plot-references]").findAll("dt").map((node) => node.text())).toEqual([
  "LSL", "USL", "Target", "Mean", "±3σ (sample)", "±4σ (sample)",
]);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "renders governed comparison results"
```

Expected: FAIL because the graphic/explanation/legend/reference wrappers do not exist.

- [ ] **Step 3: Implement semantic wrappers and groups**

In `DistributionFitPlot.vue`, wrap the SVG in:

```vue
<div class="distribution-fit-plot-graphic" data-distribution-plot-graphic>
  <svg><!-- unchanged chart content --></svg>
</div>
```

Replace the two horizontal caption rows with:

```vue
<figcaption class="distribution-fit-plot-explanation" data-distribution-plot-explanation>
  <section class="plot-explanation-group" data-plot-legend aria-label="Plot legend">
    <h4>Legend</h4>
    <!-- observed, fitted family, and n entries -->
  </section>
  <section class="plot-explanation-group" aria-label="Plot references">
    <h4>References</h4>
    <dl class="plot-reference-values" data-plot-references>
      <!-- LSL, USL, Target, Mean, ±3σ, and ±4σ dt/dd pairs -->
    </dl>
  </section>
</figcaption>
```

Reuse `formatAxis`; preserve `Target ... (midpoint-derived)` and all existing text values.

- [ ] **Step 4: Implement responsive CSS Grid**

Change `.distribution-fit-plot` to a two-column grid with `grid-template-columns: minmax(0, 2.6fr) minmax(190px, 1fr)`. Move horizontal overflow to `.distribution-fit-plot-graphic`, keep the SVG at 800px, and style the caption with a left divider, compact headings, legend swatches, and a two-column definition list.

At `max-width: 620px`, set `.distribution-fit-plot { grid-template-columns: minmax(0, 1fr); width: 100%; }`, replace the caption's left divider with a top divider, and keep overflow confined to `.distribution-fit-plot-graphic`.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "renders governed comparison results"
```

Expected: PASS with the grouped explanation structure and unchanged chart assertions.

### Task 3: Regression and Browser Verification

**Files:**
- Verify: `apps/f7-web/src/App.test.ts`
- Verify: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Verify: `apps/f7-web/src/components/DistributionFitPlot.vue`
- Verify: `apps/f7-web/src/style.css`

- [ ] **Step 1: Run focused F7 Web tests**

```powershell
npx vitest run apps/f7-web/src/App.test.ts apps/f7-web/src/distribution-fit-plot.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run typecheck and production build**

```powershell
npm run build --workspace @ai-assist/f7-web
```

Expected: `vue-tsc --noEmit` and Vite build PASS.

- [ ] **Step 3: Run browser acceptance checks**

Using the running F7 application and a governed distribution-fit fixture/workbook, verify:

1. The highlighted final row initially shows `Hide plot` and its Plot is visible.
2. Every other row initially shows `Show plot` and has no Plot row.
3. Selecting another candidate displays only that Plot; hiding it displays none.
4. Desktop layout places Legend and References to the right of the Plot.
5. At 390px, `body.scrollWidth === body.clientWidth`, the Plot scrolls inside its graphic viewport, and the explanation is below it.
6. Browser console contains no errors.

- [ ] **Step 4: Check diagnostics and whitespace**

Run editor diagnostics for the three touched source files, then:

```powershell
git diff --check -- apps/f7-web/src/App.test.ts apps/f7-web/src/components/MeasurementPastePanel.vue apps/f7-web/src/components/DistributionFitPlot.vue apps/f7-web/src/style.css
```

Expected: no diagnostics and no whitespace errors.