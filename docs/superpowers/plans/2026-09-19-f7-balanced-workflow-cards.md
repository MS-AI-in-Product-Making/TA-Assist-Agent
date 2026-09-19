# F7 Balanced Workflow Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing three-step F7 workflow as balanced compact cards inspired by the approved reference while preserving all English copy, behavior, and accessibility.

**Architecture:** Keep workflow state and event handling in `App.vue`. Add presentational Lucide components and state badges to the existing ordered-list markup, then implement the approved card hierarchy and responsive layout in `style.css`. Extend the existing `App.test.ts` workflow tests so structure and critical style contracts fail before implementation and protect behavior afterward.

**Tech Stack:** Vue 3, TypeScript, lucide-vue-next, CSS Grid/Flexbox, Vitest, Vue Test Utils, Playwright browser validation.

---

### Task 1: Add Workflow Visual Semantics

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/App.vue`

- [ ] **Step 1: Write the failing markup test**

Extend workflow test 9 to require one `.workflow-step-icon` and one `.workflow-step-state` per card, state labels `CURRENT`, `LOCKED`, `LOCKED`, and an SVG icon inside every workflow action button.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx.cmd vitest run apps/f7-web/src/App.test.ts -t "workflow rail renders three grouped steps"`
Expected: FAIL because the icon and state elements do not exist.

- [ ] **Step 3: Implement the minimal markup**

Import `ChartNoAxesCombined`, `Dices`, `FileSpreadsheet`, `Globe2`, `Play`, and `TableProperties` from `lucide-vue-next`. Store each phase icon in `workflowSteps`, render it with `<component :is="step.icon">`, render the uppercase state in `.workflow-step-state`, and place decorative Lucide icons in the existing action buttons. Keep button text, event handlers, tab roles, and disabled states unchanged.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx.cmd vitest run apps/f7-web/src/App.test.ts -t "workflow rail renders three grouped steps"`
Expected: PASS.

### Task 2: Apply Balanced Tall-Card Styling

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] **Step 1: Write the failing CSS contract test**

Require a compact card grid with a 104px minimum height, a shared number/icon/state top row, bottom actions, side-by-side Step 2 tabs, 8px-or-smaller corners, state gradients, current outline, and the existing responsive connector orientation.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx.cmd vitest run apps/f7-web/src/App.test.ts -t "workflow rail renders three grouped steps"`
Expected: FAIL because the current compact horizontal card layout does not satisfy the tall-card rules.

- [ ] **Step 3: Implement the approved visual treatment**

Update `style.css` so the number, icon, and badge share a compact top row above the centered title, supporting status, and 28px action row. Use pale blue for current, pale green for complete, white/light blue-gray for pending, and gray for locked. Keep green enabled actions, gray disabled actions, visible focus, equal card heights, horizontal desktop connectors, and vertical mobile connectors.

- [ ] **Step 4: Run focused and full validation**

Run:
- `npx.cmd vitest run apps/f7-web/src/App.test.ts -t "workflow rail renders three grouped steps"`
- `npx.cmd vitest run apps/f7-web/src/App.test.ts`
- `npx.cmd eslint apps/f7-web/src/App.vue apps/f7-web/src/App.test.ts`

Expected: 95 tests pass and ESLint exits with no errors.

- [ ] **Step 5: Perform browser verification**

At `http://127.0.0.1:5177`, verify 1440px and 390px viewports. Confirm equal desktop card heights, bottom-aligned actions, readable English labels, correct state colors, visible connectors, vertical mobile stacking, no overlap, and no horizontal overflow.

- [ ] **Step 6: Commit**

```powershell
git add -- apps/f7-web/src/App.vue apps/f7-web/src/App.test.ts apps/f7-web/src/style.css docs/superpowers/plans/2026-09-19-f7-balanced-workflow-cards.md
git commit -m "style(f7): add balanced workflow cards"
```
