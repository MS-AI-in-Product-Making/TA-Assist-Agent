# F7 PDF Engineering Evidence Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a searchable, report-native engineering evidence page containing Factor Setup, Dimension Chain, Normal Distribution Curve, and Response Summary before the existing F7 Decision Brief pages.

**Architecture:** The Web builds a bounded structured evidence projection from confirmed setup and report-relevant Dimension Chain state. The local API validates the projection and renders a dedicated A4 landscape evidence page using escaped HTML and static SVG; the existing decision and action pages remain intact and move to pages 2 and 3.

**Tech Stack:** Vue 3, TypeScript, Zod, Vitest, Playwright Core, HTML/CSS/SVG PDF rendering

---

## File Structure

- Create `apps/f7-web/src/assumption-results-pdf-evidence.ts`: Web evidence projection types and confirmed-session projection builder.
- Create `apps/f7-web/src/assumption-results-pdf-evidence.test.ts`: projection unit tests.
- Modify `apps/f7-web/src/components/DimensionChainPanel.vue`: emit report-relevant chain state.
- Modify `apps/f7-web/src/components/DimensionChainPanel.test.ts`: chain report projection tests.
- Modify `apps/f7-web/src/components/FactorInputTable.vue`: combine setup/calculation/chain evidence and emit it.
- Modify `apps/f7-web/src/App.vue`: cache current-session evidence and pass it to interpretation.
- Modify `apps/f7-web/src/App.test.ts`: sibling event/prop wiring and session reset tests.
- Modify `apps/f7-web/src/components/TAResultsInterpretation.vue`: require current evidence and add it to the PDF request.
- Modify `apps/f7-web/src/components/TAResultsInterpretation.test.ts`: exact request mapping tests.
- Modify `apps/f7-web/src/api/f7-client.ts` and `f7-client.test.ts`: expanded request type and route body.
- Modify `apps/f7-local-api/src/assumption-results-pdf-contract.ts`: strict bounded evidence schemas.
- Create `apps/f7-local-api/src/assumption-results-pdf-evidence-renderer.ts`: evidence-page HTML/SVG rendering.
- Create `apps/f7-local-api/src/assumption-results-pdf-evidence-renderer.test.ts`: escaped table, curve, chain, and fallback tests.
- Modify `apps/f7-local-api/src/assumption-results-pdf-renderer.ts` and test: compose three explicit pages.
- Modify `local-test/F7_Test_Finetune_05/verify-assumption-results-pdf.ts`: ignored representative verifier payload only.

### Task 1: Define the bounded Web evidence projection

**Files:**
- Create: `apps/f7-web/src/assumption-results-pdf-evidence.ts`
- Create: `apps/f7-web/src/assumption-results-pdf-evidence.test.ts`

- [ ] **Step 1: Write failing projection tests**

Test that `buildConfirmedEngineeringEvidence(session, chain)` returns ordered factor rows from confirmed `factor.setup` and `factor.evidence`, finite response-curve inputs from the current calculation evidence, response-summary groups, and the supplied current chain projection. Test that missing confirmed evidence returns `undefined`.

```ts
expect(result?.factorSetup.rows[0]).toMatchObject({
  itemNumber: 1,
  factorName: "Fabric thickness",
  designNominal: -0.57,
  upperTolerance: 0.05,
  lowerTolerance: -0.05,
});
expect(result?.responseDistribution).toEqual({
  mean: -0.05,
  standardDeviation: 0.0451,
  lowerSpecLimit: -0.15,
  upperSpecLimit: 0.05,
  target: -0.05,
});
```

- [ ] **Step 2: Run the unit test and verify RED**

Run: `npx.cmd vitest run --project f7-web apps/f7-web/src/assumption-results-pdf-evidence.test.ts`

Expected: FAIL because the module and builder do not exist.

- [ ] **Step 3: Implement the projection type and builder**

Define `AssumptionResultsEngineeringEvidence`, `DimensionChainReportProjection`, factor row/footer, curve, and summary types. Build only from confirmed session values; return `undefined` for absent setup/evidence or unavailable system limits. Keep text and arrays plain JSON values and do not include HTML, SVG, URLs, or image bytes.

- [ ] **Step 4: Run the unit test and verify GREEN**

Run: `npx.cmd vitest run --project f7-web apps/f7-web/src/assumption-results-pdf-evidence.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/f7-web/src/assumption-results-pdf-evidence.ts apps/f7-web/src/assumption-results-pdf-evidence.test.ts
git commit -m "feat(f7): project PDF engineering evidence"
```

### Task 2: Export Dimension Chain report state

**Files:**
- Modify: `apps/f7-web/src/components/DimensionChainPanel.vue`
- Modify: `apps/f7-web/src/components/DimensionChainPanel.test.ts`
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`

- [ ] **Step 1: Write failing component tests**

Assert `report-projection-change` emits after Generate and report-relevant orientation/layout/arrow changes. The payload must contain only `status`, `sourceSignature`, `orientation`, factors, manual layout, reversed factor IDs, and closure direction. Assert stale/reset state emits `{ status: "fallback", sourceSignature }`.

```ts
expect(wrapper.emitted("report-projection-change")?.at(-1)?.[0]).toMatchObject({
  status: "generated",
  orientation: "horizontal",
  sourceSignature,
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx.cmd vitest run --project f7-web apps/f7-web/src/components/DimensionChainPanel.test.ts`

Expected: FAIL because the event does not exist.

- [ ] **Step 3: Implement minimal report event emission**

Add the typed event and one `emitReportProjection()` helper. Call it after generation, orientation/manual-layout/arrow changes, stale source changes, and reset. Do not emit pan, zoom, selected element, local `blob:` background, or toolbar state. Forward the event from `FactorInputTable` while combining it with `buildConfirmedEngineeringEvidence`.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `npx.cmd vitest run --project f7-web apps/f7-web/src/components/DimensionChainPanel.test.ts apps/f7-web/src/assumption-results-pdf-evidence.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/f7-web/src/components/DimensionChainPanel.vue apps/f7-web/src/components/DimensionChainPanel.test.ts apps/f7-web/src/components/FactorInputTable.vue
git commit -m "feat(f7): expose dimension chain report state"
```

### Task 3: Wire evidence into PDF generation

**Files:**
- Modify: `apps/f7-web/src/App.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`
- Modify: `apps/f7-web/src/api/f7-client.ts`
- Modify: `apps/f7-web/src/api/f7-client.test.ts`

- [ ] **Step 1: Write failing wiring and request tests**

Assert App caches `engineering-evidence-change`, clears it on session ID change, and passes only matching evidence to `TAResultsInterpretation`. Assert the generated POST body contains `engineeringEvidence` exactly once and generation is disabled until current evidence exists.

```ts
expect(generatePdf).toHaveBeenCalledWith(expect.objectContaining({
  engineeringEvidence: expectedEngineeringEvidence,
}));
```

- [ ] **Step 2: Run focused Web tests and verify RED**

Run: `npx.cmd vitest run --project f7-web apps/f7-web/src/components/TAResultsInterpretation.test.ts apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/App.test.ts`

Expected: FAIL because no evidence prop/request field exists.

- [ ] **Step 3: Implement session-bound wiring**

Add the evidence field to `AssumptionResultsPdfRequest`. Cache `{ sessionId, evidence }` in App from FactorInputTable; clear on workbook/session replacement; pass a matching projection to interpretation. Add an `engineeringEvidence` prop and include it in `buildPdfRequest()`. Preserve generation tokens, elapsed status, and filename behavior.

- [ ] **Step 4: Run focused Web tests and verify GREEN**

Run: `npx.cmd vitest run --project f7-web apps/f7-web/src/components/TAResultsInterpretation.test.ts apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/App.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/f7-web/src/App.vue apps/f7-web/src/App.test.ts apps/f7-web/src/components/TAResultsInterpretation.vue apps/f7-web/src/components/TAResultsInterpretation.test.ts apps/f7-web/src/api/f7-client.ts apps/f7-web/src/api/f7-client.test.ts
git commit -m "feat(f7): send PDF engineering evidence"
```

### Task 4: Validate the API evidence contract

**Files:**
- Modify: `apps/f7-local-api/src/assumption-results-pdf-contract.ts`
- Modify: `apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts`
- Modify: `apps/f7-local-api/src/server.test.ts`

- [ ] **Step 1: Write failing contract tests**

Extend the representative request with `engineeringEvidence`. Assert acceptance of finite bounded values and rejection of unknown fields, more than 100 factors, non-finite numbers, arbitrary `html`/`svg`/`imageUrl`, excessive layout offsets, and mismatched response-summary shapes.

```ts
expect(() => schema.parse({
  ...request,
  engineeringEvidence: { ...evidence, imageUrl: "https://example.test/a.png" },
})).toThrow();
```

- [ ] **Step 2: Run API tests and verify RED**

Run: `npx.cmd vitest run --project node apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts apps/f7-local-api/src/server.test.ts`

Expected: FAIL because strict request parsing rejects the new field.

- [ ] **Step 3: Add strict Zod schemas**

Add nested strict schemas mirroring the Web type. Bound arrays to 100 factors, names to 300 characters, display values to 2,000 characters, and manual offsets to finite values within `-10_000..10_000`. Use discriminated `generated`/`fallback` chain states. Do not permit markup, URL, path, or raw image fields.

- [ ] **Step 4: Run API tests and verify GREEN**

Run: `npx.cmd vitest run --project node apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts apps/f7-local-api/src/server.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/f7-local-api/src/assumption-results-pdf-contract.ts apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts apps/f7-local-api/src/server.test.ts
git commit -m "feat(f7): validate PDF engineering evidence"
```

### Task 5: Render the engineering evidence page

**Files:**
- Create: `apps/f7-local-api/src/assumption-results-pdf-evidence-renderer.ts`
- Create: `apps/f7-local-api/src/assumption-results-pdf-evidence-renderer.test.ts`
- Modify: `apps/f7-local-api/src/assumption-results-pdf-renderer.ts`
- Modify: `apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts`

- [ ] **Step 1: Write failing renderer tests**

Assert layout B order, all factor columns/rows, compact footer/summary values, static chain SVG labels/arrows, static Normal curve/spec/target/sigma labels, fallback chain notice, text escaping, and no script/image/remote URL injection. Assert exactly three `.report-page` groups with decision and action pages each using `break-before: page`.

```ts
expect(html.match(/class="report-page/g)).toHaveLength(3);
expect(html.indexOf("Factor Setup")).toBeLessThan(html.indexOf("TA Result Summary"));
expect(html).toContain("Normal Distribution Curve");
expect(html).toContain("Response Summary");
```

- [ ] **Step 2: Run renderer tests and verify RED**

Run: `npx.cmd vitest run --project node apps/f7-local-api/src/assumption-results-pdf-evidence-renderer.test.ts apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts`

Expected: FAIL because the evidence renderer/page does not exist.

- [ ] **Step 3: Implement report-native HTML and SVG**

Create pure render helpers that accept only validated evidence and an HTML escape function. Render the Factor Setup table across the upper page and a two-column lower grid. Build chain coordinates deterministically from ordered factors/manual offsets and draw arrows/labels as inline SVG. Build a finite Normal curve polyline from the four governed numeric inputs and render specification, target, mean, and `+/-3 sigma` guides. Render response summary as compact grouped tables. Add the evidence page before existing content and explicit breaks before decision and action pages.

- [ ] **Step 4: Run renderer tests and verify GREEN**

Run: `npx.cmd vitest run --project node apps/f7-local-api/src/assumption-results-pdf-evidence-renderer.test.ts apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/f7-local-api/src/assumption-results-pdf-evidence-renderer.ts apps/f7-local-api/src/assumption-results-pdf-evidence-renderer.test.ts apps/f7-local-api/src/assumption-results-pdf-renderer.ts apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts
git commit -m "feat(f7): render PDF engineering evidence page"
```

### Task 6: Full validation and real PDF inspection

**Files:**
- Modify: `local-test/F7_Test_Finetune_05/verify-assumption-results-pdf.ts` (ignored local verifier)

- [ ] **Step 1: Run all focused regressions**

```powershell
npx.cmd vitest run --project node apps/f7-local-api/src/assumption-results-pdf-evidence-renderer.test.ts apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts apps/f7-local-api/src/server.test.ts
npx.cmd vitest run --project f7-web apps/f7-web/src/assumption-results-pdf-evidence.test.ts apps/f7-web/src/components/DimensionChainPanel.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/App.test.ts
npx.cmd tsc -p apps/f7-local-api/tsconfig.json --noEmit
npm.cmd run build:f7:web
```

Expected: all tests and type checks pass; Web build succeeds with no new warnings.

- [ ] **Step 2: Generate the representative PDF**

Update the ignored verifier with the same seven-factor evidence shown in the approved screenshots, then run:

```powershell
npx.cmd tsx local-test/F7_Test_Finetune_05/verify-assumption-results-pdf.ts
```

Expected: `%PDF-` output, no renderer error, elapsed time recorded.

- [ ] **Step 3: Verify page structure and visual integrity**

Count `/Type /Page` objects excluding `/Pages` and require exactly 3. Open the PDF and inspect all pages at desktop viewport: page 1 contains the complete table and both lower graphics; pages 2 and 3 retain the Decision Brief; no clipping, overlap, blank panel, or unreadably small text.

- [ ] **Step 4: Review and commit any focused visual corrections**

Run `git diff --check` after corrections. Do not stage the ignored verifier/PDF or `packages/workbench/dist/state-machine.js`.

```powershell
git add apps/f7-web apps/f7-local-api
git commit -m "fix(f7): polish PDF evidence layout"
```

- [ ] **Step 5: Push the feature branch**

```powershell
git push
git status --short --branch
```

Expected: the feature branch matches its remote; only the pre-existing worktree-only generated-file status may remain.