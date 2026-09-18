# F7 PDF Factor Setup Web-Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the governed PDF Factor Setup as readable Setup Inputs and Measurement Analysis tables containing the same engineering information and calculation semantics as the Web Factor Setup table.

**Architecture:** Move the provider-neutral capability, subgroup, diagnostics, measured-comparison, and warning calculations into `@ai-assist/f7-statistics`, retaining thin Web re-exports for compatibility. Extend the strict F7 report Factor contract and server-authoritative projection with display-ready setup and measured evidence; keep the PDF renderer presentation-only and split the 18 Web information categories across two A4-landscape tables.

**Tech Stack:** TypeScript, Zod, Vitest, Vue 3, Playwright/Chromium PDF rendering, HTML/CSS print layout.

---

## File Structure

- Create five focused modules under `packages/f7-statistics/src`: capability, measurement structure, diagnostics, measured comparison, and warning evidence.
- Retain the existing Web helper files as compatibility re-exports/adapters and add the shared package dependency.
- Extend `packages/contracts/src/f7-contracts.ts` with strict report parity DTOs.
- Extend `apps/f7-local-api/src/f7-report.ts` with server-authoritative projection mapping.
- Split `apps/f7-local-api/src/f7-report-pdf-renderer.ts` into Setup Inputs and Measurement Analysis rendering helpers.
- Update focused fixtures/tests only where the stricter report contract requires parity fields.

### Task 1: Establish Shared Factor Statistics

**Files:**
- Create: `packages/f7-statistics/src/capability.ts`
- Create: `packages/f7-statistics/src/capability.test.ts`
- Create: `packages/f7-statistics/src/measurement-structure.ts`
- Create: `packages/f7-statistics/src/measurement-structure.test.ts`
- Create: `packages/f7-statistics/src/measurement-diagnostics.ts`
- Create: `packages/f7-statistics/src/measurement-diagnostics.test.ts`
- Create: `packages/f7-statistics/src/factor-measured-comparison.ts`
- Create: `packages/f7-statistics/src/factor-measured-comparison.test.ts`
- Create: `packages/f7-statistics/src/measurement-warnings.ts`
- Create: `packages/f7-statistics/src/measurement-warnings.test.ts`
- Modify: `packages/f7-statistics/src/index.ts`
- Modify: `apps/f7-web/package.json`
- Modify: `apps/f7-web/src/f7-capability.ts`
- Modify: `apps/f7-web/src/measurement-structure.ts`
- Modify: `apps/f7-web/src/measurement-diagnostics.ts`
- Modify: `apps/f7-web/src/factor-measured-comparison.ts`
- Modify: `apps/f7-web/src/measurement-workspace-warnings.ts`

- [ ] **Step 1: Write failing shared-helper tests**

Port the existing Web behavior tests into `packages/f7-statistics/src`. Use provider-neutral observation and subgroup types. Cover Setup/Actual/Delta values, rational subgroups, excluded observations, one included value, zero variation, and warning evidence for cross-zero specification, out-of-spec values, and candidate outliers.

```ts
expect(buildFactorMeasuredComparison(input)?.mean).toEqual({
  setup: -0.57,
  actual: 0.5671,
  delta: -0.0029,
});
expect(buildFactorMeasuredComparison(input)?.cpk.setup).toBe(4 / 3);
```

- [ ] **Step 2: Run shared-helper tests and verify RED**

Run:

```powershell
npx.cmd vitest run packages/f7-statistics/src/capability.test.ts packages/f7-statistics/src/measurement-structure.test.ts packages/f7-statistics/src/measurement-diagnostics.test.ts packages/f7-statistics/src/factor-measured-comparison.test.ts packages/f7-statistics/src/measurement-warnings.test.ts
```

Expected: FAIL because the shared modules do not exist.

- [ ] **Step 3: Move calculations behind provider-neutral types**

Implement the shared modules with the existing Web algorithms. The comparison module exposes:

```ts
export interface FactorMeasurementObservation {
  readonly value: number;
  readonly disposition: string;
  readonly originalRow: number;
}

export interface ComparisonMetric {
  readonly setup: number;
  readonly actual: number | undefined;
  readonly delta: number | undefined;
}

export interface FactorMeasuredComparison {
  readonly mean: ComparisonMetric & { readonly actual: number; readonly delta: number };
  readonly tolerance: ComparisonMetric;
  readonly oneSigma: ComparisonMetric;
  readonly cpk: ComparisonMetric;
}
```

The warning module returns structured evidence, not UI strings:

```ts
export interface FactorMeasurementWarningEvidence {
  readonly crossesZero: boolean;
  readonly outOfSpecCount: number;
  readonly candidateOutlierCount: number;
}

export function hasFactorMeasurementWarning(evidence: FactorMeasurementWarningEvidence): boolean {
  return evidence.crossesZero
    || evidence.outOfSpecCount > 0
    || evidence.candidateOutlierCount > 0;
}
```

Export all modules from `packages/f7-statistics/src/index.ts`.

- [ ] **Step 4: Run shared-helper tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Point Web compatibility modules at the shared package**

Add `"@ai-assist/f7-statistics": "0.1.0"` to `apps/f7-web/package.json`. Replace implementation bodies of the four calculation helpers with typed re-exports. Keep `measurement-workspace-warnings.ts` responsible for English messages, deriving counts from `evaluateFactorMeasurementWarnings`.

- [ ] **Step 6: Build shared package and run Web regressions**

```powershell
npx.cmd tsc -b packages/f7-statistics --force
npx.cmd vitest run apps/f7-web/src/f7-capability.test.ts apps/f7-web/src/measurement-structure.test.ts apps/f7-web/src/measurement-diagnostics.test.ts apps/f7-web/src/factor-measured-comparison.test.ts apps/f7-web/src/measurement-workspace-warnings.test.ts apps/f7-web/src/components/FactorInputTable.test.ts
```

Expected: PASS; Web behavior remains unchanged.

- [ ] **Step 7: Commit shared statistics**

```powershell
git add packages/f7-statistics apps/f7-web/package.json apps/f7-web/src/f7-capability.ts apps/f7-web/src/measurement-structure.ts apps/f7-web/src/measurement-diagnostics.ts apps/f7-web/src/factor-measured-comparison.ts apps/f7-web/src/measurement-workspace-warnings.ts package-lock.json
git commit -m "refactor(f7): share factor measurement statistics"
```

### Task 2: Extend the Governed Report Factor Contract

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `packages/contracts/src/f7-contracts.test.ts`

- [ ] **Step 1: Write failing contract tests**

Extend the report fixture with:

```ts
partNumber: "PN-100",
dimId: "DIM-1",
setupMean: -0.567,
setupTolerance: 0.05,
setupOneSigma: 0.0125,
setupCpk: 4 / 3,
percentContributionToSigma: 0.076923,
measurementComparison: {
  mean: { actual: 0.5671, delta: -0.0029 },
  tolerance: { actual: 0.0464, delta: -0.0036 },
  oneSigma: { actual: 0.0155, delta: 0.003 },
  cpk: { actual: 0.9312, delta: -0.4021 },
},
sampleCount: 32,
readiness: "ready",
measurementWarning: true,
```

Assert rejection of blank/oversized traceability, contribution outside `[0, 1]`, non-finite metrics, invalid sample counts/readiness, unknown properties, and a metric containing only `actual` or `delta`.

- [ ] **Step 2: Run contract tests and verify RED**

```powershell
npx.cmd vitest run packages/contracts/src/f7-contracts.test.ts
```

Expected: FAIL because strict Factor schemas reject the new fields.

- [ ] **Step 3: Add strict report parity schemas**

```ts
const f7ReportMeasuredMetricSchema = z.object({
  actual: finiteNumberSchema,
  delta: finiteNumberSchema,
}).strict();

const f7ReportFactorMeasurementComparisonSchema = z.object({
  mean: f7ReportMeasuredMetricSchema,
  tolerance: f7ReportMeasuredMetricSchema.optional(),
  oneSigma: f7ReportMeasuredMetricSchema.optional(),
  cpk: f7ReportMeasuredMetricSchema.optional(),
}).strict();
```

Add the approved fields to `f7ReportFactorSchema`. Keep traceability optional and make all setup/display-state fields required so reports fail closed.

- [ ] **Step 4: Run tests and build contracts**

```powershell
npx.cmd vitest run packages/contracts/src/f7-contracts.test.ts
npx.cmd tsc -b packages/contracts --force
```

Expected: PASS. Do not commit unrelated generated declaration churn.

- [ ] **Step 5: Commit the contract**

```powershell
git add packages/contracts/src/f7-contracts.ts packages/contracts/src/f7-contracts.test.ts
git commit -m "feat(f7): extend report factor evidence"
```

### Task 3: Project Web-Equivalent Factor Evidence

**Files:**
- Modify: `apps/f7-local-api/src/f7-report.ts`
- Modify: `apps/f7-local-api/src/f7-report.test.ts`

- [ ] **Step 1: Write failing projection tests**

Extend measured and baseline snapshots with traceability and measurement datasets. Assert projected setup values, traceability, normalized contribution, measured comparison, sample count, readiness, and warning state. Add rational-subgroup, excluded-observation, one-value, zero-variation, baseline, and pending cases.

```ts
expect(report.factors[0]).toMatchObject({
  partNumber: "PN-100",
  dimId: "DIM-1",
  setupMean: -0.57,
  setupTolerance: 0.05,
  setupOneSigma: 0.0125,
  setupCpk: 4 / 3,
  sampleCount: 32,
  readiness: "ready",
  measurementWarning: true,
});
```

- [ ] **Step 2: Run projection tests and verify RED**

```powershell
npx.cmd vitest run apps/f7-local-api/src/f7-report.test.ts
```

Expected: FAIL because parity fields are absent.

- [ ] **Step 3: Derive report-wide contribution once**

```ts
const setupVarianceTotal = parsedSnapshot.factors.reduce((total, factor) => (
  total + (factor.evidence?.oneSigma ?? 0) ** 2
), 0);
```

Project `evidence.oneSigma ** 2 / setupVarianceTotal`, returning zero only when the total is zero.

- [ ] **Step 4: Project setup and measured evidence**

Use evidence directly for Setup Mean, Tolerance, and 1 sigma; use `sigmaLevel / 3` for Setup Cpk. Count included observations. Build measured comparison only for measured Factors with ready datasets, omitting optional metrics whose shared result is unavailable.

```ts
const readiness = sourceMode === "BASELINE_ASSUMPTION"
  || factorState.measurementPasteResult?.status === "ready"
  ? "ready"
  : "pending";
```

Use shared warning evidence for the boolean warning field.

- [ ] **Step 5: Run projection and contract tests**

```powershell
npx.cmd vitest run apps/f7-local-api/src/f7-report.test.ts packages/contracts/src/f7-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit projection changes**

```powershell
git add apps/f7-local-api/src/f7-report.ts apps/f7-local-api/src/f7-report.test.ts
git commit -m "feat(f7): project factor setup report parity"
```

### Task 4: Render Both Approved Factor Tables

**Files:**
- Modify: `apps/f7-local-api/src/f7-report-pdf-renderer.ts`
- Modify: `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts`

- [ ] **Step 1: Write failing renderer structure tests**

Update `reportFixture()` with required parity fields. Assert exact headings:

```ts
expect(setupHeadings).toEqual([
  "Item", "Factor", "Part Number", "DIM ID", "Design Nominal",
  "+Tol", "-Tol", "Long-term Safety Factor", "Sigma Level", "Distribution",
]);
expect(analysisHeadings).toEqual([
  "Item", "Factor", "Mean", "Tolerance", "1σ", "Cpk",
  "% Contribution to σ", "Source Mode", "Sample Count", "Readiness",
]);
```

Assert both tables precede Dimension Chain, preserve Factor order, escape dynamic values, and display exact `Missing`.

- [ ] **Step 2: Write failing value tests**

Assert metric cells contain labeled `Setup`, `Actual`, and `Δ`; unavailable optional metrics render `—`; source modes display `Measured Data` and `Baseline Assumption`; Warning, sample count, Ready, and Pending are visible text.

- [ ] **Step 3: Run renderer tests and verify RED**

```powershell
npx.cmd vitest run apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
```

Expected: FAIL because only the legacy table exists.

- [ ] **Step 4: Add presentation-only helpers**

```ts
function renderFactorSetupInputs(factors: readonly F7ReportFactor[]): string;
function renderFactorMeasurementAnalysis(factors: readonly F7ReportFactor[]): string;
function renderAnalysisMetric(
  setup: number,
  measured?: { readonly actual: number; readonly delta: number },
  options?: { readonly tolerance?: boolean },
): string;
```

Format Setup first and conditionally append explicit Actual and Δ lines. Do not calculate statistics in the renderer.

- [ ] **Step 5: Add print-safe styles**

Use `data-factor-setup-inputs` and `data-factor-measurement-analysis`, normal report font size, repeated headers, row-level break avoidance, compact metric stacks, and textual states. Keep A4 landscape and downstream page rules unchanged.

- [ ] **Step 6: Run tests and commit**

```powershell
npx.cmd vitest run apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
git add apps/f7-local-api/src/f7-report-pdf-renderer.ts apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
git commit -m "feat(f7): align PDF factor setup with Web"
```

Expected: PASS before commit.

### Task 5: Cross-Layer And Real-PDF Verification

**Files:**
- Modify fixture-only tests if required by the stricter report schema:
  - `apps/f7-local-api/src/server.test.ts`
  - `apps/f7-local-api/src/f7-session-service.test.ts`
  - Other focused fixtures named by TypeScript/Vitest

- [ ] **Step 1: Run full related regressions**

```powershell
$tests = @(
  (Get-ChildItem packages/f7-statistics/src/*.test.ts).FullName
  'packages/contracts/src/f7-contracts.test.ts'
  'apps/f7-web/src/f7-capability.test.ts'
  'apps/f7-web/src/measurement-structure.test.ts'
  'apps/f7-web/src/measurement-diagnostics.test.ts'
  'apps/f7-web/src/factor-measured-comparison.test.ts'
  'apps/f7-web/src/measurement-workspace-warnings.test.ts'
  'apps/f7-web/src/components/FactorInputTable.test.ts'
  'apps/f7-local-api/src/f7-report.test.ts'
  'apps/f7-local-api/src/f7-report-pdf-renderer.test.ts'
  'apps/f7-local-api/src/f7-session-service.test.ts'
  'apps/f7-local-api/src/server.test.ts'
)
npx.cmd vitest run $tests
```

Expected: PASS. If strict fixtures fail, add exact required parity fields; do not weaken the contract.

- [ ] **Step 2: Run build and formatting checks**

```powershell
npm.cmd run build -- --force
git diff --check
```

Expected: build exits zero and no whitespace errors occur. Restore unrelated generated declaration churn before committing.

- [ ] **Step 3: Generate and inspect a real PDF**

Start the isolated F7 stack, import the controlled local fixture, complete the measured workflow, and use `Download PDF Report`. Keep generated files under `local-test/F7_Test_Finetune_05/` and do not commit them.

Verify:

- Valid `%PDF-` signature.
- Setup Inputs followed by Measurement Analysis.
- Part Number/DIM ID or exact `Missing`.
- Setup/Actual/Delta, contribution, Source Mode, Warning, Sample Count, and Readiness match Web.
- Repeated headers and no clipped/overlapping text.
- Dimension Chain and later report sections remain unchanged.

- [ ] **Step 4: Request code review**

Review contract strictness, shared-statistics parity, server-authoritative flow, optional metrics, escaping, pagination, and regression scope. Resolve all Critical and Important findings.

- [ ] **Step 5: Commit fixture updates only when changed**

```powershell
git add apps/f7-local-api/src/server.test.ts apps/f7-local-api/src/f7-session-service.test.ts
git commit -m "test(f7): verify PDF factor setup parity"
```
