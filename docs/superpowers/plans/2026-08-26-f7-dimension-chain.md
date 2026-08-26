# F7 Dimension Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manually generated, stale-aware horizontal/vertical dimension-chain chart beside the F4 Response Summary Table.

**Architecture:** Keep scaling and cumulative geometry in a pure TypeScript module, render the result in an isolated Vue SVG component, and let `FactorInputTable.vue` only project its active draft data and arrange the output grid. The generated chart is local component state and adds no chart-specific API, contract, or workbook persistence. Factor Setup continues to enforce the existing non-zero Design Nominal contract.

**Tech Stack:** Vue 3.5, TypeScript, SVG, Vitest, Vue Test Utils, CSS Grid.

**Execution constraint:** Do not create commits unless the user explicitly requests them.

---

## File Structure

- Create `apps/f7-web/src/components/dimension-chain.ts`: factor snapshot types, fingerprinting, scale compression, and cumulative geometry.
- Create `apps/f7-web/src/components/dimension-chain.test.ts`: pure geometry and signature tests.
- Create `apps/f7-web/src/components/DimensionChainPanel.vue`: Generate/Update snapshot state, orientation controls, accessible SVG rendering.
- Create `apps/f7-web/src/components/DimensionChainPanel.test.ts`: interaction and SVG semantics tests.
- Modify `apps/f7-web/src/components/FactorInputTable.vue`: project current factor drafts and place chart beside Response Summary.
- Modify `apps/f7-web/src/App.test.ts`: integration assertions for order, dirty behavior, and unchanged confirmation payloads.
- Modify `apps/f7-web/src/style.css`: industrial panel styling, stable SVG dimensions, responsive side-by-side layout.

### Task 1: Pure Dimension Chain Geometry

**Files:**
- Create: `apps/f7-web/src/components/dimension-chain.ts`
- Create: `apps/f7-web/src/components/dimension-chain.test.ts`

- [ ] **Step 1: Write failing geometry tests**

Cover direct scaling, square-root compression, minimum visibility, defensive zero-value rendering for historical projections, cumulative direction, closure, and signatures:

```ts
import { describe, expect, it } from "vitest";
import { buildDimensionChainGeometry, dimensionChainSignature, type DimensionChainFactor } from "./dimension-chain";

const factor = (itemNumber: number, designNominal: number): DimensionChainFactor => ({
  id: `factor-${itemNumber}`,
  itemNumber,
  name: `Factor ${itemNumber}`,
  designNominal,
  upperTolerance: 0.1,
  lowerTolerance: -0.1,
  longTermSafetyFactor: 1,
  sigmaLevel: 4,
  distribution: "Normal",
});

describe("dimension chain geometry", () => {
  it("builds cumulative additive and subtractive arrows with closure", () => {
    const result = buildDimensionChainGeometry([factor(1, 2), factor(2, -1), factor(3, 0.5)]);
    expect(result.segments.map(({ direction }) => direction)).toEqual(["additive", "subtractive", "additive"]);
    expect(result.segments[0]!.end).toBeGreaterThan(result.segments[0]!.start);
    expect(result.segments[1]!.end).toBeLessThan(result.segments[1]!.start);
    expect(result.closure.start).toBe(result.segments[2]!.end);
    expect(result.closure.end).toBe(0);
  });

  it("compresses extreme ratios while retaining visible short arrows", () => {
    const result = buildDimensionChainGeometry([factor(1, 100), factor(2, 0.01)]);
    expect(result.compressed).toBe(true);
    expect(result.segments[1]!.length).toBeGreaterThanOrEqual(36);
    expect(result.segments[0]!.length).toBe(180);
  });

  it("keeps zero items visible without moving the cumulative position", () => {
    const result = buildDimensionChainGeometry([factor(1, 0)]);
    expect(result.segments[0]).toMatchObject({ direction: "zero", start: 0, end: 0, length: 0 });
  });

  it("changes the signature for every Factor Setup field", () => {
    const original = factor(1, 2);
    expect(dimensionChainSignature([original])).not.toBe(dimensionChainSignature([{ ...original, sigmaLevel: 6 }]));
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
npx vitest run apps/f7-web/src/components/dimension-chain.test.ts
```

Expected: FAIL because `dimension-chain.ts` does not exist.

- [ ] **Step 3: Implement the pure geometry module**

Define the exact public model and deterministic geometry:

```ts
export interface DimensionChainFactor {
  readonly id: string;
  readonly itemNumber: number;
  readonly name: string;
  readonly designNominal: number;
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
  readonly longTermSafetyFactor: number;
  readonly sigmaLevel: number;
  readonly distribution: string;
}

export interface DimensionChainSegment extends DimensionChainFactor {
  readonly direction: "additive" | "subtractive" | "zero";
  readonly start: number;
  readonly end: number;
  readonly length: number;
}

export interface DimensionChainGeometry {
  readonly segments: readonly DimensionChainSegment[];
  readonly closure: { readonly start: number; readonly end: 0 };
  readonly minPosition: number;
  readonly maxPosition: number;
  readonly compressed: boolean;
}

const MIN_ARROW_LENGTH = 36;
const MAX_ARROW_LENGTH = 180;
const COMPRESSION_RATIO = 8;

export function dimensionChainSignature(factors: readonly DimensionChainFactor[]): string {
  return JSON.stringify(factors);
}

export function buildDimensionChainGeometry(factors: readonly DimensionChainFactor[]): DimensionChainGeometry {
  const nonZero = factors.map(({ designNominal }) => Math.abs(designNominal)).filter((value) => value > 0);
  const maximum = Math.max(0, ...nonZero);
  const minimum = Math.min(...nonZero);
  const compressed = nonZero.length > 1 && maximum / minimum > COMPRESSION_RATIO;
  let cursor = 0;
  const positions = [0];
  const segments = factors.map((factor) => {
    const magnitude = Math.abs(factor.designNominal);
    const normalized = maximum === 0 ? 0 : magnitude / maximum;
    const scaled = magnitude === 0 ? 0 : Math.max(
      MIN_ARROW_LENGTH,
      (compressed ? Math.sqrt(normalized) : normalized) * MAX_ARROW_LENGTH,
    );
    const signedLength = Math.sign(factor.designNominal) * scaled;
    const start = cursor;
    cursor += signedLength;
    positions.push(cursor);
    return {
      ...factor,
      direction: factor.designNominal > 0 ? "additive" as const : factor.designNominal < 0 ? "subtractive" as const : "zero" as const,
      start,
      end: cursor,
      length: scaled,
    };
  });
  return {
    segments,
    closure: { start: cursor, end: 0 },
    minPosition: Math.min(...positions),
    maxPosition: Math.max(...positions),
    compressed,
  };
}
```

- [ ] **Step 4: Run geometry tests and verify GREEN**

Run the same Vitest command. Expected: all geometry tests pass without warnings.

### Task 2: Snapshot-Aware SVG Panel

**Files:**
- Create: `apps/f7-web/src/components/DimensionChainPanel.vue`
- Create: `apps/f7-web/src/components/DimensionChainPanel.test.ts`

- [ ] **Step 1: Write failing component tests**

Mount with three factors and assert:

```ts
const wrapper = mount(DimensionChainPanel, { props: { factors, valid: true } });
expect(wrapper.find("svg").exists()).toBe(false);
await wrapper.get("[data-generate-dimension-chain]").trigger("click");
expect(wrapper.findAll("[data-dimension-segment]")).toHaveLength(3);
expect(wrapper.get("[data-dimension-segment='2']").attributes("data-direction")).toBe("subtractive");
expect(wrapper.get("[data-dimension-closure]").classes()).toContain("dimension-chain-closure");
expect(wrapper.text()).toContain("Item 1");

await wrapper.setProps({ factors: [{ ...factors[0]!, designNominal: 9 }, ...factors.slice(1)] });
expect(wrapper.get("[data-dimension-chain-stale]").text()).toContain("Update");
expect(wrapper.get("[data-generate-dimension-chain]").text()).toBe("Update");
expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("2");
await wrapper.get("[data-generate-dimension-chain]").trigger("click");
expect(wrapper.get("[data-dimension-segment='1']").attributes("data-value")).toBe("9");

await wrapper.get("button[aria-label='Vertical dimension chain']").trigger("click");
expect(wrapper.get("button[aria-label='Vertical dimension chain']").attributes("aria-pressed")).toBe("true");
```

Also assert `valid: false` disables Generate. Keep a zero-marker assertion as defensive rendering coverage; Factor Setup must reject zero Design Nominal before confirmation.

- [ ] **Step 2: Run the tests and verify RED**

```powershell
npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `DimensionChainPanel.vue`**

Use:

```ts
const props = defineProps<{
  readonly factors: readonly DimensionChainFactor[];
  readonly valid: boolean;
}>();
const orientation = ref<"horizontal" | "vertical">("horizontal");
const generatedFactors = ref<readonly DimensionChainFactor[]>();
const currentSignature = computed(() => dimensionChainSignature(props.factors));
const generatedSignature = computed(() => generatedFactors.value ? dimensionChainSignature(generatedFactors.value) : "");
const stale = computed(() => generatedFactors.value !== undefined && currentSignature.value !== generatedSignature.value);
const geometry = computed(() => generatedFactors.value ? buildDimensionChainGeometry(generatedFactors.value) : undefined);

function generate(): void {
  if (!props.valid) return;
  generatedFactors.value = props.factors.map((factor) => ({ ...factor }));
}
```

Render:

- `Generate` before a snapshot and `Update` after it becomes stale.
- A warning with `role="status"` and `data-dimension-chain-stale`.
- Two real orientation buttons with `aria-pressed`.
- One SVG lane per segment with a filled `<circle>`, a line/path using a navy arrow marker, Item label, Factor name, and signed value.
- A zero segment using a short perpendicular tick and filled circle.
- A final green closure line/path, filled green start dot, compact marker, and visible `Closure` text.
- A dashed guide connecting the initial origin to the closure endpoint.
- Blue additive and red subtractive arrows matching Design Nominal text colors.
- Stable SVG `viewBox` dimensions derived from `minPosition`, `maxPosition`, and lane count; swap axis calculations in vertical mode.
- `<title>` and `<desc>`, plus per-segment `aria-label` values.

- [ ] **Step 4: Run component tests and verify GREEN**

Run the same component Vitest command. Expected: all tests pass without warnings.

### Task 3: Integrate With Factor Setup And Response Summary

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] **Step 1: Add failing integration assertions**

In the existing Factor Setup test, assert initial placement and generation:

```ts
const outputLayout = wrapper.get("[data-factor-output-layout]");
expect(outputLayout.element.firstElementChild?.getAttribute("data-dimension-chain-panel")).not.toBeNull();
expect(outputLayout.element.lastElementChild?.getAttribute("data-f4-response-summary")).not.toBeNull();
expect(wrapper.find("[data-dimension-chain-svg]").exists()).toBe(false);
await wrapper.get("[data-generate-dimension-chain]").trigger("click");
expect(wrapper.findAll("[data-dimension-segment]")).toHaveLength(3);
```

Then edit Design Nominal, tolerance, distribution, reorder, add, and remove in focused assertions and verify each operation exposes `[data-dimension-chain-stale]` while the generated segment values remain unchanged until Update.

Retain the existing exact `confirmFactors` payload assertion to protect API behavior.

- [ ] **Step 2: Run the focused integration test and verify RED**

```powershell
npx vitest run apps/f7-web/src/App.test.ts -t "3\) factor_setup"
```

Expected: FAIL because the output layout and dimension-chain controls do not exist.

- [ ] **Step 3: Project Factor Setup drafts into the panel**

Import the component and type, then add:

```ts
const dimensionChainFactors = computed<DimensionChainFactor[]>(() => activeFactors.value.map((factor, index) => {
  const draft = candidateDraft(factor);
  return {
    id: factor.factorCandidate.factorCandidateId,
    itemNumber: index + 1,
    name: factorNameFor(factor).trim(),
    designNominal: numericDraftValue(draft.designNominal),
    upperTolerance: numericDraftValue(draft.upperTolerance),
    lowerTolerance: numericDraftValue(draft.lowerTolerance),
    longTermSafetyFactor: numericDraftValue(draft.longTermSafetyFactor),
    sigmaLevel: numericDraftValue(draft.sigmaLevel),
    distribution: draft.distribution,
  };
}));
```

Wrap the new panel and existing F4 summary:

```vue
<div class="factor-output-layout" data-factor-output-layout>
  <DimensionChainPanel
    :factors="dimensionChainFactors"
    :valid="setupIsValid"
  />
  <section class="f4-response-summary" data-f4-response-summary ...>
    <!-- existing summary unchanged -->
  </section>
</div>
```

- [ ] **Step 4: Add layout and chart styles**

Add narrowly scoped styles:

```css
.factor-output-layout {
  display: grid;
  grid-template-columns: minmax(420px, 0.8fr) minmax(0, 2fr);
  align-items: start;
  gap: 12px;
  margin-top: 22px;
}

.factor-output-layout .f4-response-summary { margin-top: 0; min-width: 0; }
.dimension-chain-panel { border: 1px solid #87939b; background: #f4f6f7; min-width: 0; }
.dimension-chain-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; }
.dimension-chain-canvas { overflow: auto; background: #fff; }
.dimension-chain-component { stroke: var(--ink); stroke-width: 3; }
.dimension-chain-start { fill: var(--ink); }
.dimension-chain-closure { stroke: #2e7d32; }
.dimension-chain-closure-head, .dimension-chain-closure-start { fill: #2e7d32; }
.dimension-chain-stale { border-left: 3px solid #b86813; background: #fff1dd; color: #71400d; }

@media (max-width: 1000px) {
  .factor-output-layout { grid-template-columns: minmax(0, 1fr); }
}
```

Reuse existing button and segmented-control visual language rather than introducing new colors or rounded cards.

- [ ] **Step 5: Run integration and component tests**

```powershell
npx vitest run apps/f7-web/src/components/dimension-chain.test.ts apps/f7-web/src/components/DimensionChainPanel.test.ts apps/f7-web/src/App.test.ts
```

Expected: all tests pass and no Vue warnings are emitted.

### Task 4: Full Verification And Browser Validation

**Files:**
- Verify all modified files; no new production files in this task.

- [ ] **Step 1: Run static and production checks**

```powershell
npx vue-tsc --noEmit -p apps/f7-web/tsconfig.json
npm run build --workspace @ai-assist/f7-web
git diff --check
```

Expected: zero type/build/diff errors. An unrelated pre-existing line-ending warning may remain and must be reported rather than changed.

- [ ] **Step 2: Run the full F7 Web suite**

```powershell
npx vitest run apps/f7-web
```

Expected: all F7 Web tests pass without warnings.

- [ ] **Step 3: Validate the live UI with Playwright**

At desktop and mobile viewport widths:

- Generate the chart and confirm filled starts, compact direction-colored arrowheads, signed directions, labels, dashed origin guide, and green closure.
- Change a Factor field and confirm the old SVG stays unchanged while the Update warning appears.
- Click Update and confirm the SVG changes.
- Toggle Vertical and confirm no stale warning is introduced.
- Confirm Dimension Chain is left of Response Summary on desktop and above it on mobile.
- Check computed bounds and screenshots for clipping, overlap, horizontal overflow containment, and readable minimum arrows.

- [ ] **Step 4: Check editor diagnostics**

Run diagnostics on:

- `apps/f7-web/src/components/dimension-chain.ts`
- `apps/f7-web/src/components/dimension-chain.test.ts`
- `apps/f7-web/src/components/DimensionChainPanel.vue`
- `apps/f7-web/src/components/DimensionChainPanel.test.ts`
- `apps/f7-web/src/components/FactorInputTable.vue`
- `apps/f7-web/src/App.test.ts`
- `apps/f7-web/src/style.css`

Expected: no errors.
