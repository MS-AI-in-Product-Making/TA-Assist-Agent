# Response Distribution Curve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Excel-aligned, responsive Normal distribution curve below the F4 Response Summary Table that updates from the current Factor Setup calculation.

**Architecture:** A pure TypeScript plot builder owns domains, ticks, Normal density sampling, and reference positions. A focused Vue SVG component owns visibility toggles and accessible rendering. `FactorInputTable.vue` passes its existing `KernelCalculationResult`, keeping calculation authority in the workbook kernel.

**Tech Stack:** Vue 3.5, TypeScript, native SVG, Vitest, Vue Test Utils, Playwright browser verification.

---

## File Structure

- Create `apps/f7-web/src/response-distribution-plot.ts`: pure chart model and finite geometry.
- Create `apps/f7-web/src/response-distribution-plot.test.ts`: plot math and edge cases.
- Create `apps/f7-web/src/components/ResponseDistributionCurve.vue`: responsive SVG, legend, controls, empty state.
- Create `apps/f7-web/src/components/ResponseDistributionCurve.test.ts`: rendering, defaults, toggles, reactive props.
- Modify `apps/f7-web/src/components/FactorInputTable.vue`: render chart below Response Summary Table.
- Modify `apps/f7-web/src/App.test.ts`: integration assertion for chart data updates.
- Modify `apps/f7-web/src/style.css`: chart layout, line styles, controls, responsive constraints.

### Task 1: Pure Plot Model

**Files:**
- Create: `apps/f7-web/src/response-distribution-plot.ts`
- Test: `apps/f7-web/src/response-distribution-plot.test.ts`

- [ ] **Step 1: Write failing model tests**

Test an input with Mean `-0.05`, sigma `0.045`, LSL `-0.15`, and USL `0.05`. Assert:

```ts
const model = buildResponseDistributionPlot({
  mean: -0.05,
  standardDeviation: 0.045,
  lowerSpecLimit: -0.15,
  upperSpecLimit: 0.05,
});
expect(model.target).toBeCloseTo(-0.05, 12);
expect(model.references.find(({ id }) => id === "minus-4-sigma")?.value).toBeCloseTo(-0.23, 12);
expect(model.references.find(({ id }) => id === "plus-6-sigma")?.value).toBeCloseTo(0.22, 12);
expect(model.curvePath.startsWith("M")).toBe(true);
expect(model.xTicks).toHaveLength(7);
```

Also assert all geometry is finite and invalid/zero sigma returns `undefined`.

- [ ] **Step 2: Run the model test and verify RED**

Run: `npx vitest run apps/f7-web/src/response-distribution-plot.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the model builder**

Define:

```ts
export type ResponseDistributionReferenceId =
  | "lower-spec-limit" | "upper-spec-limit" | "target" | "mean"
  | "minus-3-sigma" | "plus-3-sigma"
  | "minus-4-sigma" | "plus-4-sigma"
  | "minus-4-5-sigma" | "plus-4-5-sigma"
  | "minus-6-sigma" | "plus-6-sigma";

export interface ResponseDistributionPlotInput {
  readonly mean: number;
  readonly standardDeviation: number;
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
}
```

Use a 760 x 300 SVG model with plot bounds `left=52`, `right=744`, `top=48`, `bottom=252`. Domain candidates are LSL, USL, Mean +/- 6sigma, padded by 5%. Sample 121 Normal PDF points and normalize peak height to the plot. Return seven x ticks and references with exact values and x positions. Return `undefined` unless all input is finite and sigma is positive.

- [ ] **Step 4: Run the model test and verify GREEN**

Run: `npx vitest run apps/f7-web/src/response-distribution-plot.test.ts`
Expected: all model tests pass.

### Task 2: SVG Curve Component

**Files:**
- Create: `apps/f7-web/src/components/ResponseDistributionCurve.vue`
- Test: `apps/f7-web/src/components/ResponseDistributionCurve.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] **Step 1: Write failing component tests**

Mount with a typed calculation fixture and assert:

```ts
expect(wrapper.get("[data-response-distribution-curve]").exists()).toBe(true);
expect(wrapper.get("[data-response-distribution-normal]").attributes("d")).toMatch(/^M/);
expect(wrapper.findAll("[data-response-sigma='4']")).toHaveLength(2);
expect(wrapper.findAll("[data-response-sigma='6']")).toHaveLength(2);
expect(wrapper.findAll("[data-response-sigma='3']")).toHaveLength(0);
expect(wrapper.findAll("[data-response-sigma='4.5']")).toHaveLength(0);
```

Toggle the `+/-3sigma` checkbox and assert two 3sigma references appear. Update calculation props and assert Mean/LSL/USL data values change. Mount with zero sigma and assert the unavailable state appears without an SVG path.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npx vitest run apps/f7-web/src/components/ResponseDistributionCurve.test.ts`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the SVG component**

Props:

```ts
const props = defineProps<{
  readonly calculation: DeepReadonly<KernelCalculationResult>;
}>();
```

Compute the model from `calculation.system.mean`, `rssSigma`, and capability limits. Keep local visibility state:

```ts
const visibleSigma = reactive<Record<"3" | "4" | "4.5" | "6", boolean>>({
  "3": false,
  "4": true,
  "4.5": false,
  "6": true,
});
```

Render a title, inline legend, responsive `viewBox="0 0 760 300"`, axis/ticks, Normal path, always-visible LSL/USL/Target/Mean lines, filtered sigma lines, numeric badges, and four native checkbox controls. Add SVG `<title>` and `<desc>` with current numeric values.

- [ ] **Step 4: Add restrained industrial styling**

Use existing color variables. Style Normal as ink, LSL/USL as amber solid lines, Target as gray solid, Mean as orange dashed, 3sigma purple dotted, 4sigma blue dotted, 4.5sigma brown dashed, and 6sigma green dashed. Use a minimum chart width inside an overflow viewport, compact controls, tabular numbers, and no nested card treatment.

- [ ] **Step 5: Run component tests and verify GREEN**

Run: `npx vitest run apps/f7-web/src/components/ResponseDistributionCurve.test.ts`
Expected: all component tests pass.

### Task 3: Factor Setup Integration

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] **Step 1: Write failing integration assertions**

In the existing Factor Setup F4 test, assert the chart appears after Response Summary when `f4Calculation` exists, and expose reference values through `data-value`:

```ts
const chart = wrapper.get("[data-response-distribution-curve]");
expect(chart.get("[data-response-reference='mean']").attributes("data-value"))
  .toBe(wrapper.get("[data-summary-adjusted-mean]").text());
```

Change a Factor Design Nominal or Additional Mean Shift and assert both the summary and chart Mean update.

- [ ] **Step 2: Run integration test and verify RED**

Run: `npx vitest run apps/f7-web/src/App.test.ts -t "factor_setup"`
Expected: FAIL because the chart is not rendered.

- [ ] **Step 3: Integrate the component**

Import `ResponseDistributionCurve` and render it immediately after the Response Summary section:

```vue
<ResponseDistributionCurve
  v-if="f4Calculation"
  :calculation="f4Calculation"
/>
```

Keep it inside `factor-output-layout` so it shares the current responsive content width and follows the summary in DOM order.

- [ ] **Step 4: Run integration and full Web tests**

Run: `npx vitest run apps/f7-web/src/App.test.ts -t "factor_setup"`
Expected: targeted integration tests pass.

Run: `npx vitest run apps/f7-web`
Expected: all Web tests pass.

### Task 4: Browser and Production Verification

**Files:**
- No source changes unless verification finds a chart-specific defect.

- [ ] **Step 1: Verify desktop behavior in the running F7 app**

Import `test/feature1-input/Mauna_Loa_TP_Step_20260611.xlsx`, select `Example_TA`, and verify the chart appears below Response Summary. Confirm Mean, sigma, LSL, USL, and Target DOM values match the table/calculation.

- [ ] **Step 2: Verify controls and reactivity**

Toggle 3sigma and 4.5sigma on/off. Change Additional Mean Shift and one Factor Design Nominal; confirm the curve and Mean reference update without reloading.

- [ ] **Step 3: Verify desktop and mobile screenshots**

Capture desktop and mobile screenshots. Check nonblank SVG pixels, no text overlap, no page-level horizontal overflow, and chart-local overflow only when needed.

- [ ] **Step 4: Run final checks**

Run: `npm run build:f7:web`
Expected: Vue TypeScript and Vite build succeed.

Run: `git diff --check`
Expected: no whitespace errors or conflict markers.

## Execution Record

- [x] Pure plot model implemented with finite geometry, 121 curve points, seven ticks, and governed references.
- [x] SVG component implemented with accessible labels and local sigma visibility controls.
- [x] Factor Setup integration implemented using the existing F4 calculation result.
- [x] Desktop browser verification completed with the chart spanning below the output row and no badge overlap.
- [x] Mean Shift and Factor changes verified to update chart references and the curve reactively.
- [x] Mobile verification completed at 390px with chart-local horizontal scrolling and keyboard focus.
- [x] The existing Factor table remains the source of pre-existing page-level mobile overflow; hiding the chart does not change it.
