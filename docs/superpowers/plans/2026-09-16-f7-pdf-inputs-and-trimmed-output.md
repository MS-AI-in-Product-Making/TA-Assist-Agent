# F7 PDF Inputs and Trimmed Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add governed Factor Setup inputs and a reproducible horizontal Dimension Chain to the beginning of the F7 Monte Carlo PDF, and end the PDF after the governed assessment.

**Architecture:** Extend the strict `F7ReportProjection` factor contract so the server-authoritative report carries every confirmed setup input needed for presentation. Map those fields from validated session evidence, then render a standalone inputs section and finite inline SVG before the existing result sections. Remove renderer-only internal engineering and reproducibility sections without changing calculations or the Web workflow.

**Tech Stack:** TypeScript, Zod, Vitest, HTML/CSS, inline SVG, local Edge/Chrome PDF printing.

---

## File Structure

- Modify `packages/contracts/src/f7-contracts.ts`: require confirmed Factor Setup fields on each projected report factor.
- Modify `packages/contracts/src/f7-contracts.test.ts`: verify strict acceptance and rejection of the new fields.
- Modify `apps/f7-local-api/src/f7-report.ts`: map validated `F7FactorEvidence` into the expanded report factor.
- Modify `apps/f7-local-api/src/f7-report.test.ts`: verify exact mapping and order.
- Modify `apps/f7-local-api/src/f7-report-pdf-renderer.ts`: render inputs/table/chain and remove post-assessment sections.
- Modify `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts`: verify layout order, SVG behavior, removed content, escaping, finite geometry, and lifecycle regression coverage.

### Task 1: Expand The Governed Factor Contract

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Test: `packages/contracts/src/f7-contracts.test.ts`

- [ ] **Step 1: Extend the report fixture and add failing strict-validation tests**

Add the required fields to each report-factor fixture:

```ts
{
  factorId: SHA256,
  factorName: "Frame",
  loopCoefficient: 1,
  designNominal: 10,
  upperTolerance: 0.2,
  lowerTolerance: -0.1,
  longTermSafetyFactor: 1.5,
  sigmaLevel: 3,
  setupDistribution: "Normal",
  sourceMode: "BASELINE_ASSUMPTION",
  approvedDistribution: "normal",
  sourceReferences: ["Analysis-A!G14"],
}
```

Add one test that deletes each required field in turn and expects `f7ReportProjectionSchema.safeParse` to fail. Add assertions that `Infinity` in any numeric setup field and a lowercase `setupDistribution: "normal"` fail.

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```powershell
npx.cmd vitest run --project node packages/contracts/src/f7-contracts.test.ts
```

Expected: FAIL because `f7ReportFactorSchema` strips or rejects the newly supplied fields and does not yet enforce them.

- [ ] **Step 3: Extend `f7ReportFactorSchema` with the exact governed fields**

Use existing schemas rather than duplicate validation:

```ts
export const f7ReportFactorSchema = z.object({
  factorId: sha256LowerSchema,
  factorName: z.string().min(1),
  loopCoefficient: f7LoopCoefficientSchema,
  ...editableFactorSpecificationFields,
  longTermSafetyFactor: f7FactorCalculationControlFields.longTermSafetyFactor,
  sigmaLevel: f7FactorCalculationControlFields.sigmaLevel,
  setupDistribution: f7ToleranceDistributionSchema,
  sourceMode: f7FactorSourceModeSchema,
  approvedDistribution: f7DistributionCandidateFamilySchema,
  sourceReferences: z.array(z.string().min(1)).min(1),
}).strict();
```

Do not add calculated fields or browser Dimension Chain state.

- [ ] **Step 4: Run contract tests and TypeScript verification**

Run:

```powershell
npx.cmd vitest run --project node packages/contracts/src/f7-contracts.test.ts
npx.cmd tsc --noEmit -p packages/contracts/tsconfig.json
```

Expected: contract tests PASS; TypeScript may identify downstream fixtures that Task 2 must update, but no error may remain in the contract package itself.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- packages/contracts/src/f7-contracts.ts packages/contracts/src/f7-contracts.test.ts
git diff --cached --check
git commit -m "feat(f7): govern report factor setup inputs"
```

### Task 2: Project Confirmed Factor Setup Inputs

**Files:**
- Modify: `apps/f7-local-api/src/f7-report.ts`
- Test: `apps/f7-local-api/src/f7-report.test.ts`
- Modify fixtures as required: `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts`, `apps/f7-local-api/src/server.test.ts`, and other compile-identified F7 report fixtures only

- [ ] **Step 1: Add failing projection assertions**

Update the expected `report.factors` in `f7-report.test.ts` to include exact evidence values:

```ts
expect(report.factors[0]).toMatchObject({
  designNominal: snapshot.factors[0]!.evidence!.designNominal,
  upperTolerance: snapshot.factors[0]!.evidence!.upperTolerance,
  lowerTolerance: snapshot.factors[0]!.evidence!.lowerTolerance,
  longTermSafetyFactor: snapshot.factors[0]!.evidence!.longTermSafetyFactor,
  sigmaLevel: snapshot.factors[0]!.evidence!.sigmaLevel,
  setupDistribution: snapshot.factors[0]!.evidence!.distribution,
});
```

Assert the output factor IDs remain in the same order as `snapshot.factors`, covering baseline and measured factors. Keep source mode and approved distribution assertions unchanged.

- [ ] **Step 2: Run projection test and verify RED**

Run:

```powershell
npx.cmd vitest run --project node apps/f7-local-api/src/f7-report.test.ts
```

Expected: FAIL because the new setup fields are absent from `createF7ReportProjection` output.

- [ ] **Step 3: Map validated evidence fields into each report factor**

In the existing `factors` mapper, add:

```ts
designNominal: evidence.designNominal,
upperTolerance: evidence.upperTolerance,
lowerTolerance: evidence.lowerTolerance,
longTermSafetyFactor: evidence.longTermSafetyFactor,
sigmaLevel: evidence.sigmaLevel,
setupDistribution: evidence.distribution,
```

Keep `approvedDistribution` separate because it describes the simulation sampler after measured-data approval.

- [ ] **Step 4: Update only strict report fixtures identified by TypeScript/tests**

For each `F7ReportProjection` literal, add realistic finite setup values and the governed `Normal`/`Uniform` spelling. Do not weaken schemas or make fields optional for fixture convenience.

- [ ] **Step 5: Run projection, renderer, route, and compile checks**

Run:

```powershell
npx.cmd vitest run --project node apps/f7-local-api/src/f7-report.test.ts apps/f7-local-api/src/f7-report-pdf-renderer.test.ts apps/f7-local-api/src/server.test.ts
npx.cmd tsc --noEmit -p apps/f7-local-api/tsconfig.json
```

Expected: all selected tests and TypeScript PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- packages/contracts/src/f7-contracts.test.ts apps/f7-local-api/src/f7-report.ts apps/f7-local-api/src/f7-report.test.ts apps/f7-local-api/src/f7-report-pdf-renderer.test.ts apps/f7-local-api/src/server.test.ts
git diff --cached --check
git commit -m "feat(f7): project confirmed report inputs"
```

Stage only files actually changed.

### Task 3: Render Inputs And Trim The PDF

**Files:**
- Modify: `apps/f7-local-api/src/f7-report-pdf-renderer.ts`
- Test: `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts`

- [ ] **Step 1: Write failing reading-order and removal tests**

Update the primary renderer test so the ordered headings begin with:

```ts
const orderedHeadings = [
  "Engineering Inputs",
  "Factor Setup",
  "Dimension Chain",
  "Governed result",
  "Monte Carlo output distribution",
  "TA Comparison Matrix",
  "TA interpretation and optimization report",
  "Factor Setup vs Monte Carlo TA",
  "Interpretation and optimization direction",
  "Governed assessment",
];
```

Assert the HTML contains all nine Factor Setup table headings and expected escaped factor values. Assert these strings are absent:

```ts
for (const removed of [
  "Governed engineering detail",
  "Engineering Summary",
  "Root Cause Analysis",
  "Engineering Risk",
  "Suggested Action Sequence",
  "Validation Requirements",
  "Evidence Disclosure",
  "Reproducibility Evidence",
  "Factor evidence",
]) expect(html).not.toContain(removed);
```

- [ ] **Step 2: Write failing Dimension Chain behavior tests**

Build a fixture with positive, negative, and zero nominal values. Assert one `[data-dimension-chain-segment]` per factor, direction attributes `additive`, `subtractive`, and `zero`, escaped labels, and one `[data-dimension-chain-closure]`.

Build a second fixture with nominal magnitudes `1` and `1000`; assert `data-compressed="true"`. Build an extreme finite fixture with `Number.MAX_VALUE` and `-Number.MAX_VALUE`; assert generated SVG attributes contain neither `NaN` nor `Infinity`.

- [ ] **Step 3: Run renderer tests and verify RED**

Run:

```powershell
npx.cmd vitest run --project node apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
```

Expected: FAIL because Engineering Inputs and Dimension Chain are missing and removed sections are still present.

- [ ] **Step 4: Implement a finite Dimension Chain model inside the renderer**

Add bounded constants and a pure model builder:

```ts
const DIMENSION_CHAIN_MIN_LENGTH = 36;
const DIMENSION_CHAIN_MAX_LENGTH = 180;
const DIMENSION_CHAIN_COMPRESSION_RATIO = 8;

function dimensionChainLength(magnitude: number, maximum: number, compressed: boolean): number {
  if (magnitude === 0 || maximum === 0) return 0;
  const normalized = Math.min(1, Math.max(0, magnitude / maximum));
  return Math.max(
    DIMENSION_CHAIN_MIN_LENGTH,
    (compressed ? Math.sqrt(normalized) : normalized) * DIMENSION_CHAIN_MAX_LENGTH,
  );
}
```

Use signs independently from raw magnitude arithmetic, accumulate only bounded display lengths, and use existing `finiteSum`, `formatNumber`, and HTML escaping. Assign labels to alternating rows so adjacent segment labels do not overlap. Render a fixed-width `viewBox` with a height derived from label rows and factor count.

- [ ] **Step 5: Implement the Engineering Inputs section**

Add `renderEngineeringInputs(report)` that returns:

```html
<section class="engineering-inputs page-break-after" data-engineering-inputs>
  <p class="eyebrow">Governed analysis inputs</p>
  <h2>Engineering Inputs</h2>
  <h3>Factor Setup</h3>
  <table data-factor-setup-inputs>...</table>
  <h3>Dimension Chain</h3>
  ...inline SVG...
</section>
```

Render rows in `report.factors` order. Use `formatNumber` for finite values, `escapeHtml` for text, and human-readable source modes. Add CSS for repeated table headers, compact numeric columns, arrowheads, additive/subtractive/zero styling, labels, closure, and print-safe page breaks.

- [ ] **Step 6: Insert inputs and remove internal output**

In `renderF7ReportPdfHtml`, insert `${renderEngineeringInputs(report)}` immediately after the report header and before `.hero-result`. Remove `${engineeringDetails(report)}` and `${reproducibilityEvidence(report)}`, then delete those now-unused functions and their now-unused CSS selectors.

Do not alter `renderWebReport`, `renderAssessment`, PDF queueing, browser execution, cleanup, filenames, or `%PDF-` validation.

- [ ] **Step 7: Run focused tests and fix only local defects**

Run:

```powershell
npx.cmd vitest run --project node apps/f7-local-api/src/f7-report-pdf-renderer.test.ts apps/f7-local-api/src/f7-report.test.ts apps/f7-local-api/src/server.test.ts
npx.cmd eslint apps/f7-local-api/src/f7-report-pdf-renderer.ts apps/f7-local-api/src/f7-report-pdf-renderer.test.ts packages/contracts/src/f7-contracts.ts packages/contracts/src/f7-contracts.test.ts apps/f7-local-api/src/f7-report.ts apps/f7-local-api/src/f7-report.test.ts
npx.cmd tsc --noEmit -p apps/f7-local-api/tsconfig.json
```

Expected: all selected tests, lint, and TypeScript PASS.

- [ ] **Step 8: Generate and visually inspect a real PDF**

Use the running F7 API and a fixture under ignored `local-test/F7_Test_Finetune_05/` to generate a PDF through `/f7/report/pdf`. Verify HTTP 200, `application/pdf`, `%PDF-`, and render pages to images using existing local validation tooling when available. Confirm readable Factor Setup columns, unclipped chain labels, inputs before results, no internal-detail pages, and reduced page count.

- [ ] **Step 9: Commit Task 3**

```powershell
git add -- apps/f7-local-api/src/f7-report-pdf-renderer.ts apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
git diff --cached --check
git commit -m "feat(f7): add inputs and trim governed PDF"
```

### Task 4: Final Integration Review

**Files:**
- Verify all changed files from Tasks 1-3

- [ ] **Step 1: Run final focused verification**

```powershell
npx.cmd vitest run --project node packages/contracts/src/f7-contracts.test.ts apps/f7-local-api/src/f7-report.test.ts apps/f7-local-api/src/f7-report-pdf-renderer.test.ts apps/f7-local-api/src/server.test.ts
npx.cmd tsc --noEmit -p apps/f7-local-api/tsconfig.json
npx.cmd eslint packages/contracts/src/f7-contracts.ts packages/contracts/src/f7-contracts.test.ts apps/f7-local-api/src/f7-report.ts apps/f7-local-api/src/f7-report.test.ts apps/f7-local-api/src/f7-report-pdf-renderer.ts apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
git diff --check HEAD~3..HEAD
```

Expected: all commands PASS. Existing repository-wide lint failures outside these files are not part of this change.

- [ ] **Step 2: Review contract/projection/renderer consistency**

Confirm every contract input is projected exactly once and rendered exactly once; `setupDistribution` remains distinct from `approvedDistribution`; no browser-only Dimension Chain state appears in the contract; removed sections cannot be reached through alternate analysis branches.

- [ ] **Step 3: Request final code review**

Dispatch the repository `code-reviewer` against the approved design and all implementation commits. Resolve every blocking or important finding and rerun the focused verification.

- [ ] **Step 4: Confirm final branch state**

```powershell
git status --short --branch
git log --oneline --decorate -6
```

Expected: clean worktree with the design, plan, and implementation commits on `User/Ralf_F7_Generate_PDF_Report`.
