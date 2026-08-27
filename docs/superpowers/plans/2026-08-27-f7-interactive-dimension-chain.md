# F7 Interactive Dimension Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bidirectional Factor sign controls, editable dimension-chain geometry, middle-button-only panning, and local section-image overlays.

**Architecture:** Keep Factor drafts as the sign source of truth in `FactorInputTable.vue`. Add pure display-layout functions beside the existing geometry builder, while `DimensionChainPanel.vue` owns transient manual offsets, pointer previews, and local image URLs. All sign changes cross the component boundary as explicit intents and are applied by the parent in one synchronous mutation for existing Undo/Redo capture.

**Tech Stack:** Vue 3 Composition API, TypeScript, native SVG, Lucide Vue icons, File/Clipboard/Object URL browser APIs, Vitest, Vue Test Utils, Playwright

---

## File Structure

- Modify `apps/f7-web/src/components/dimension-chain.ts`: pure manual-layout types, display-segment projection, crossing detection, and offset pruning.
- Modify `apps/f7-web/src/components/dimension-chain.test.ts`: pure geometry/layout tests.
- Modify `apps/f7-web/src/components/DimensionChainPanel.vue`: reverse/reset/image controls, middle pan, guide/arrow editing, SVG image layer, events, cleanup.
- Modify `apps/f7-web/src/components/DimensionChainPanel.test.ts`: interaction, image lifecycle, and event tests.
- Modify `apps/f7-web/src/components/FactorInputTable.vue`: Factor sign mutation methods, editability props/events, and Factor Setup reverse control.
- Modify `apps/f7-web/src/App.test.ts`: integration, computed result, and Undo/Redo tests.
- Modify `apps/f7-web/src/style.css`: default cursor, draggable hit targets, selected states, image controls, and compact responsive toolbar.

### Task 1: Pure Editable Layout Model

**Files:**
- Modify: `apps/f7-web/src/components/dimension-chain.ts`
- Modify: `apps/f7-web/src/components/dimension-chain.test.ts`

- [x] **Step 1: Write failing pure tests**

Add tests for these exported contracts:

```ts
export type DimensionChainOrientation = "horizontal" | "vertical";
export interface DimensionChainManualLayout {
  readonly boundaryOffsets: Readonly<Record<string, number>>;
  readonly laneOffsets: Readonly<Record<string, number>>;
}
export interface DimensionChainDisplaySegment extends DimensionChainSegment {
  readonly displayStart: number;
  readonly displayEnd: number;
  readonly laneOffset: number;
  readonly displayDirection: "additive" | "subtractive" | "zero";
}
export function boundaryKey(previousId: string, nextId: string): string;
export function buildDisplaySegments(
  geometry: DimensionChainGeometry,
  layout: DimensionChainManualLayout,
): readonly DimensionChainDisplaySegment[];
export function signChangesForDisplay(
  segments: readonly DimensionChainDisplaySegment[],
): ReadonlyArray<{ readonly factorId: string; readonly sign: 1 | -1 }>;
export function pruneManualLayout(
  layout: DimensionChainManualLayout,
  factors: readonly DimensionChainFactor[],
): DimensionChainManualLayout;
```

Assert that a boundary offset changes only the preceding `displayEnd` and following `displayStart`; lane offsets do not affect axis positions; crossing reports only changed nonzero signs; pruning removes stale Factor IDs and invalid boundaries.

- [x] **Step 2: Verify RED**

Run: `npx vitest run apps/f7-web/src/components/dimension-chain.test.ts`

Expected: FAIL because the new exports do not exist.

- [x] **Step 3: Implement pure helpers**

Keep `buildDimensionChainGeometry` unchanged. Derive display endpoints from automatic segment endpoints plus boundary offsets keyed as `${previousId}::${nextId}`. Derive display direction from `Math.sign(displayEnd - displayStart)`. Compare display direction with `Math.sign(designNominal)` to create sign-change intents. Return new objects without mutating geometry or factors.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run apps/f7-web/src/components/dimension-chain.test.ts`

Expected: all pure dimension-chain tests pass.

### Task 2: Factor Sign Source Of Truth

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`

- [x] **Step 1: Write failing integration tests**

Extend the Factor Setup workflow to assert:

- `Reverse all factors` exists in the edit toolbar.
- One click negates every nonblank/nonzero Design Nominal while preserving magnitude.
- Response Summary recalculates.
- Undo restores all signs in one click and Redo reapplies them in one click.
- A synthetic `factor-sign-change` event from Dimension Chain updates only listed Factor IDs and is one Undo step.
- Controls are disabled when `busy` or setup is not editable.

- [x] **Step 2: Verify RED**

Run: `npx vitest run apps/f7-web/src/App.test.ts -t "3\) factor_setup"`

Expected: FAIL because sign controls/events do not exist.

- [x] **Step 3: Implement parent mutations**

Add:

```ts
function applyFactorSigns(changes: readonly { factorId: string; sign: 1 | -1 }[]): void {
  const signs = new Map(changes.map((change) => [change.factorId, change.sign]));
  for (const factor of activeFactors.value) {
    const sign = signs.get(factor.factorCandidate.factorCandidateId);
    const draft = candidateDraft(factor);
    if (sign && typeof draft.designNominal === "number" && draft.designNominal !== 0) {
      draft.designNominal = Math.abs(draft.designNominal) * sign;
    }
  }
}

function reverseAllFactors(): void {
  applyFactorSigns(activeFactors.value.flatMap((factor) => {
    const value = candidateDraft(factor).designNominal;
    return typeof value === "number" && value !== 0
      ? [{ factorId: factor.factorCandidate.factorCandidateId, sign: (value > 0 ? -1 : 1) as 1 | -1 }]
      : [];
  }));
}
```

Use one synchronous mutation so the existing post-flush snapshot watcher creates one history entry. Add a Lucide reverse icon button to `.factor-edit-toolbar`. Pass `:editable="setupEditable && !busy"`, `@reverse-all="reverseAllFactors"`, and `@factor-sign-change="applyFactorSigns"` to Dimension Chain.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run apps/f7-web/src/App.test.ts -t "3\) factor_setup"`

Expected: focused Factor Setup tests pass.

### Task 3: Reverse Controls And Snapshot Sign Synchronization

**Files:**
- Modify: `apps/f7-web/src/components/DimensionChainPanel.test.ts`
- Modify: `apps/f7-web/src/components/DimensionChainPanel.vue`

- [x] **Step 1: Write failing component tests**

Add `editable?: boolean` and test:

- Toolbar button `Reverse all factors` emits `reverse-all` only when editable.
- Current zoom and manual offsets remain unchanged.
- When factor props return with only sign changes caused by a pending diagram intent, matching generated factors update signs immediately.
- A pre-existing stale condition remains stale after sign synchronization.
- `Reset layout` clears manual offsets without resetting viewport.

- [x] **Step 2: Verify RED**

Run: `npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts -t "reverse|Reset layout"`

Expected: FAIL because controls and events do not exist.

- [x] **Step 3: Implement events and controlled synchronization**

Declare:

```ts
const emit = defineEmits<{
  "reverse-all": [];
  "factor-sign-change": [changes: readonly { factorId: string; sign: 1 | -1 }[]];
}>();
```

Track pending sign IDs only for component-originated intents. Watch props; update only the sign of matching `generatedFactors`, preserve every magnitude and other snapshot field, then clear pending IDs. Add Reverse and Reset Layout buttons to the Generate/orientation row.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts`

Expected: all component tests pass.

### Task 4: Middle-Button-Only Viewport Pan

**Files:**
- Modify: `apps/f7-web/src/components/DimensionChainPanel.test.ts`
- Modify: `apps/f7-web/src/components/DimensionChainPanel.vue`
- Modify: `apps/f7-web/src/style.css`

- [x] **Step 1: Write failing pointer tests**

Assert left-button drag on empty canvas keeps `data-view-x/y`; middle-button (`button: 1`, `buttons: 4`) changes them; active middle drag sets `.is-panning`; pointer release ends panning. Preserve area-selection left drag.

- [x] **Step 2: Verify RED**

Run: `npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts -t "middle button"`

Expected: FAIL because left button currently pans.

- [x] **Step 3: Implement input routing**

Route pointer down in this priority: active area selection with left button, guide/arrow target handlers, middle-button canvas pan, otherwise no action. Use `event.button === 1` to start pan. Set canvas cursor to `default`; only `.is-panning` uses `grabbing` or `move`.

- [x] **Step 4: Verify GREEN**

Run: `npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts`

Expected: all existing wheel/area-zoom tests and new pan tests pass.

### Task 5: Guide And Arrow Editing

**Files:**
- Modify: `apps/f7-web/src/components/DimensionChainPanel.test.ts`
- Modify: `apps/f7-web/src/components/DimensionChainPanel.vue`
- Modify: `apps/f7-web/src/style.css`

- [x] **Step 1: Write failing guide tests**

Generate at least three factors. Drag the transparent shared-boundary hit target along the active axis and assert adjacent display endpoints move. Cross an endpoint and assert preview direction/color changes while no event is emitted during move. On pointerup assert one `factor-sign-change` event. On pointercancel/Escape assert offsets and preview restore with no event.

- [x] **Step 2: Write failing arrow tests**

Drag a component hit target perpendicular to horizontal and vertical orientations. Assert its lane coordinate and labels move, while `data-value`, display axis endpoints, direction, and other arrows' lane offsets remain unchanged.

- [x] **Step 3: Verify RED**

Run: `npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts -t "guide|arrow lane"`

Expected: FAIL because edit hit targets and manual layouts do not exist.

- [x] **Step 4: Implement orientation-specific layout state**

Maintain:

```ts
const manualLayouts = reactive<Record<DimensionChainOrientation, DimensionChainManualLayout>>({
  horizontal: { boundaryOffsets: {}, laneOffsets: {} },
  vertical: { boundaryOffsets: {}, laneOffsets: {} },
});
```

Use reversible drag snapshots. Convert client deltas through current viewBox scale. Guide deltas update active boundary offsets along the axis. Arrow deltas update only the selected Factor's lane offset perpendicular to the axis. Derive rendered segments with pure helpers.

- [x] **Step 5: Render accessible hit targets and styles**

Add transparent SVG lines with `tabindex="0"`, meaningful `aria-label`, selection state, pointer handlers, and visible selected/focus outlines. Preserve visible dashed guides and arrow geometry above any image.

- [x] **Step 6: Verify GREEN**

Run: `npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts apps/f7-web/src/components/dimension-chain.test.ts`

Expected: all geometry and component tests pass.

### Task 6: Local Image Import And Clipboard Paste

**Files:**
- Modify: `apps/f7-web/src/components/DimensionChainPanel.test.ts`
- Modify: `apps/f7-web/src/components/DimensionChainPanel.vue`
- Modify: `apps/f7-web/src/style.css`

- [x] **Step 1: Write failing image lifecycle tests**

Mock `URL.createObjectURL` and `URL.revokeObjectURL`. Assert:

- Import accepts PNG/JPEG/WebP and renders `[data-dimension-chain-background]` before Generate.
- SVG image is first visual layer, centered, bottom-aligned, and preserves aspect ratio.
- Canvas paste reads the first supported image ClipboardItem/File.
- Replace revokes previous URL; Remove and unmount revoke current URL.
- Unsupported content shows a polite error and retains current image.
- Opacity defaults to 0.6 and changes from a range input.
- Generate, Update, orientation change, Reset layout, and sign changes retain the image.

- [x] **Step 2: Verify RED**

Run: `npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts -t "image|paste|opacity"`

Expected: FAIL because image controls do not exist.

- [x] **Step 3: Implement local image state**

Use a hidden `<input type="file" accept="image/png,image/jpeg,image/webp">`, an image icon button, `backgroundUrl`, natural width/height, opacity, and error refs. Decode dimensions with a temporary `Image` before replacing existing state. Revoke URLs on replacement/removal/unmount. Handle `paste` on a focusable canvas wrapper and ignore non-image clipboard data.

- [x] **Step 4: Render image under the chain**

Keep the canvas available when `backgroundUrl || geometry`. Render `<image>` before guides with `preserveAspectRatio="xMidYMax meet"`, dimensions fitted into the base canvas, horizontal centering, and bottom alignment. Keep chain controls and empty-state messaging usable before Generate.

- [x] **Step 5: Verify GREEN**

Run: `npx vitest run apps/f7-web/src/components/DimensionChainPanel.test.ts`

Expected: all image and existing component tests pass without leaked URLs.

### Task 7: Full Regression And Browser Verification

**Files:**
- Test: `apps/f7-web/src/components/dimension-chain.test.ts`
- Test: `apps/f7-web/src/components/DimensionChainPanel.test.ts`
- Test: `apps/f7-web/src/App.test.ts`

- [x] **Step 1: Run focused tests**

Run: `npx vitest run apps/f7-web/src/components/dimension-chain.test.ts apps/f7-web/src/components/DimensionChainPanel.test.ts apps/f7-web/src/App.test.ts`

Expected: all focused tests pass.

- [x] **Step 2: Run full Web tests and build**

Run: `npx vitest run apps/f7-web/src`

Run: `npm run build:f7:web`

Expected: all F7 Web tests pass and production build exits 0.

- [x] **Step 3: Check diagnostics and diff**

Check diagnostics for all modified files and run `git diff --check`.

Expected: no new errors or whitespace failures.

- [x] **Step 4: Browser verification**

Using a local nonconfidential image or generated bitmap, verify desktop and narrow viewports: default cursor, middle pan, wheel zoom, area zoom, reverse controls, Undo/Redo, guide crossing commit on release, arrow perpendicular drag, orientation-specific layouts, Reset layout, import/paste/opacity/replace/remove, image layering, 50/50 output layout, internal summary scrolling, and no page-level overflow.

No Git commit is made unless the user explicitly requests it.
