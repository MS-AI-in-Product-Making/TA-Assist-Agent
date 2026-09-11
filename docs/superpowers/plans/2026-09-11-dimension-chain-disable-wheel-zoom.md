# Dimension Chain Disable Wheel Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent mouse-wheel input over the Dimension Chain canvas from changing viewport zoom while preserving normal page scrolling and toolbar controls.

**Architecture:** Remove the canvas wheel event binding and its component handler. Keep `zoomTo` because toolbar and area-selection controls still own explicit zoom behavior.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils

---

### Task 1: Remove Wheel Zoom

**Files:**
- Modify: `apps/f7-web/src/components/DimensionChainPanel.test.ts`
- Modify: `apps/f7-web/src/components/DimensionChainPanel.vue`

- [ ] **Step 1: Write the failing test**

Replace the current wheel-zoom assertion with a cancelable wheel event and assert that zoom remains `1`, `dispatchEvent` returns `true`, and toolbar Zoom in still increases zoom.

```ts
const wheelEvent = new WheelEvent("wheel", {
  deltaY: -100,
  clientX: 180,
  clientY: 180,
  cancelable: true,
});
expect(canvas.element.dispatchEvent(wheelEvent)).toBe(true);
await wrapper.vm.$nextTick();
expect(svg.attributes("data-view-zoom")).toBe("1");

await wrapper.get("button[aria-label='Zoom in']").trigger("click");
expect(Number(svg.attributes("data-view-zoom"))).toBeGreaterThan(1);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run --project f7-web apps/f7-web/src/components/DimensionChainPanel.test.ts -t "uses toolbar pan, bounds zoom, selects a local view, and restores the full view"
```

Expected: FAIL because the existing handler cancels the wheel event and increases `data-view-zoom`.

- [ ] **Step 3: Implement the minimal change**

Remove `onWheel` and remove `@wheel="onWheel"` from the canvas. Remove `WheelEvent` from the file-level global declaration when no longer used.

- [ ] **Step 4: Verify focused and full behavior**

Run:

```powershell
npx vitest run --project f7-web apps/f7-web/src/components/DimensionChainPanel.test.ts
npx vitest run --project f7-web
npm run build:f7:web
npx eslint apps/f7-web/src/components/DimensionChainPanel.vue apps/f7-web/src/components/DimensionChainPanel.test.ts
git diff --check
```

Expected: all tests and the build pass, ESLint reports no errors, and `git diff --check` produces no output.