# F7 Measured Data Analysis Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show current and queued automatic measurement analysis progress in the Factor table after bulk import.

**Architecture:** App owns transient sequential-fit progress and passes a readonly projection to FactorInputTable. FactorInputTable changes only Source Mode presentation while the existing store remains the authority for busy and session state.

**Tech Stack:** Vue 3 Composition API, TypeScript, CSS, Vitest, Vue Test Utils.

---

### Task 1: Component Progress Presentation

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.test.ts`
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/style.css`

- [ ] Write failing tests for completed, active `Analyzing`, and later `Queued` rows plus `Analyzing measured data 2 / 7`.
- [ ] Run `npx.cmd vitest run apps/f7-web/src/components/FactorInputTable.test.ts -t "automatic measured analysis progress"` and verify RED.
- [ ] Add the optional progress prop, accessible progress summary, row labels, decorative spinner, and stable layout styles.
- [ ] Rerun the focused component test and verify GREEN.

### Task 2: App Sequential Progress Lifecycle

**Files:**
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/App.vue`

- [ ] Write a failing App test that holds each automatic fit promise and verifies active/queued advancement.
- [ ] Verify RED with `npx.cmd vitest run apps/f7-web/src/App.test.ts -t "shows sequential automatic analysis progress"`.
- [ ] Track ordered IDs, active ID, and completed count around the existing fit loop; clear progress in `finally`; pass it to FactorInputTable.
- [ ] Rerun the focused App test and verify GREEN.

### Task 3: Regression and Browser Verification

**Files:**
- Verify: `apps/f7-web/src/App.vue`
- Verify: `apps/f7-web/src/components/FactorInputTable.vue`
- Verify: `apps/f7-web/src/style.css`

- [ ] Run the full relevant F7 Web suite.
- [ ] Check editor diagnostics on touched files.
- [ ] Verify desktop and mobile alignment, progress text, spinner visibility, and no clipping in the live browser.

### Task 4: Full-Width Animated Analysis Feedback

**Files:**
- Modify: `apps/f7-web/src/components/FactorInputTable.test.ts`
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] **Step 1: Extend the component test to require the approved feedback strip**

In the existing `shows automatic measured analysis progress for active and queued Source Mode rows` test, assert that progress is outside the table header, includes the indeterminate bar, and disappears when progress clears:

```ts
const feedback = queuedWrapper.get("[data-automatic-analysis-feedback]");
expect(feedback.get("[data-automatic-analysis-progress]").text()).toBe("Analyzing measured data 1 / 2");
expect(feedback.get("[data-automatic-analysis-bar]").exists()).toBe(true);
expect(queuedWrapper.find("thead [data-automatic-analysis-progress]").exists()).toBe(false);

await activeWrapper.setProps({ automaticAnalysisProgress: undefined, busy: false });
expect(activeWrapper.find("[data-automatic-analysis-feedback]").exists()).toBe(false);
```

- [ ] **Step 2: Run the focused component test and verify RED**

Run:

```powershell
npx.cmd vitest run apps/f7-web/src/components/FactorInputTable.test.ts -t "automatic measured analysis progress"
```

Expected: FAIL because `[data-automatic-analysis-feedback]` and `[data-automatic-analysis-bar]` do not exist yet.

- [ ] **Step 3: Move the summary out of Source Mode and add the full-width feedback strip**

Insert this block after the Factor Setup heading and before the empty/table content, using the existing `LoaderCircle` import:

```vue
<div
	v-if="automaticAnalysisProgress"
	class="automatic-analysis-feedback"
	data-automatic-analysis-feedback
	role="status"
	aria-live="polite"
>
	<p>
		<LoaderCircle class="automatic-analysis-spinner" :size="14" aria-hidden="true" />
		<span data-automatic-analysis-progress>
			Analyzing measured data {{ automaticAnalysisProgress.completedCount + 1 }} / {{ automaticAnalysisProgress.factorIds.length }}
		</span>
	</p>
	<div class="automatic-analysis-bar" data-automatic-analysis-bar aria-hidden="true"><span></span></div>
</div>
```

Delete the former `v-if="column.key === 'sourceMode' && automaticAnalysisProgress"` summary span from the Source Mode table header.

- [ ] **Step 4: Add stable strip and indeterminate animation styles**

Replace the former `.automatic-analysis-progress` text styles with:

```css
.automatic-analysis-feedback {
	margin: 0 0 8px;
}

.automatic-analysis-feedback p {
	display: flex;
	align-items: center;
	gap: 6px;
	margin: 0 0 6px;
	color: var(--ink);
	font-size: 0.78rem;
	font-weight: 600;
}

.automatic-analysis-bar {
	height: 4px;
	overflow: hidden;
	border-radius: 2px;
	background: #dfe4eb;
}

.automatic-analysis-bar span {
	display: block;
	width: 38%;
	height: 100%;
	border-radius: inherit;
	background: var(--accent);
	animation: worksheet-analysis-progress 1.4s ease-in-out infinite;
}
```

The existing global `@media (prefers-reduced-motion: reduce)` rule disables the animation without additional CSS.

- [ ] **Step 5: Update the CSS source assertions**

Replace the obsolete `.automatic-analysis-progress` assertion in `App.test.ts` with:

```ts
expect(STYLE_SOURCE).toMatch(/\.automatic-analysis-feedback p\s*\{[^}]*display:\s*flex[^}]*font-size:\s*0\.78rem/s);
expect(STYLE_SOURCE).toMatch(/\.automatic-analysis-bar\s*\{[^}]*height:\s*4px[^}]*overflow:\s*hidden/s);
expect(STYLE_SOURCE).toMatch(/\.automatic-analysis-bar span\s*\{[^}]*animation:\s*worksheet-analysis-progress\s+1\.4s\s+ease-in-out\s+infinite/s);
```

- [ ] **Step 6: Run focused and full regression tests**

Run:

```powershell
npx.cmd vitest run apps/f7-web/src/components/FactorInputTable.test.ts -t "automatic measured analysis progress"
npx.cmd vitest run apps/f7-web/src/components/FactorInputTable.test.ts apps/f7-web/src/App.test.ts apps/f7-web/src/measurement-workspace-warnings.test.ts
```

Expected: focused test passes; full suite reports 123 passing tests and zero failures.

- [ ] **Step 7: Verify the live UI**

Hold automatic fit requests long enough to inspect the active state. Confirm the strip spans the Factor Setup content width, the orange segment moves continuously, Source Mode retains only row states, and the strip disappears after both successful completion and controlled failure. Check desktop and 390 px mobile viewports for clipping and overlap.