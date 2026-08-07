# F4 F2-Selected Worksheet Excel Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production workflow that calculates every ready worksheet selected by F2, emits machine-readable and Markdown F4 reports, and optionally compares those calculations with hash-bound Excel formulas.

**Architecture:** A strict loader accepts only `Feature2-Report.json` and its `f4Handoffs`; a batch service adapts each handoff into the existing `createCalculation` API. Separate output and Excel-comparison modules keep the normal F4 path independent from Excel, while the Excel path discovers only controlled result cells and delegates recalculation to the existing isolated COM harness.

**Tech Stack:** Node.js ESM, TypeScript/Zod contracts, Vitest, SheetJS `xlsx`, PowerShell Excel COM, npm workspaces.

---

## File Structure

- Modify `packages/contracts/src/contracts.ts`: strict workflow and comparison output schemas.
- Modify `packages/contracts/src/contracts.test.ts`: schema invariants and unsafe-output rejection.
- Create `scripts/f4-artifact-loader.mjs`: load and validate one F2 JSON report without reading Markdown or Excel.
- Create `scripts/f4-artifact-loader.test.mjs`: loader acceptance, ordering, hash, and readiness tests.
- Create `scripts/f4-calculation-workflow.mjs`: adapt all F2 handoffs and call the existing F4 engine.
- Create `scripts/f4-calculation-workflow.test.mjs`: batch calculation and isolation tests.
- Create `scripts/f4-output-layout.mjs`: safe run output paths.
- Create `scripts/f4-output-layout.test.mjs`: path and argument validation tests.
- Create `scripts/f4-report.mjs`: render the machine result as a human-readable Markdown report.
- Create `scripts/f4-report.test.mjs`: report content and redaction tests.
- Create `scripts/f4-excel-mapping.mjs`: discover controlled Excel result cells by semantic anchors.
- Create `scripts/f4-excel-mapping.test.mjs`: synthetic workbook mapping and ambiguity tests.
- Modify `scripts/verify-f4-excel-regression.ps1`: return values, differences, display text, formulas, tolerance, and formula IDs.
- Modify `scripts/f4-excel-regression.test.mjs`: validate the enriched mapping and safe diagnostic output.
- Create `scripts/f4-excel-comparison.mjs`: invoke the COM harness per selected worksheet and normalize results.
- Create `scripts/f4-excel-comparison.test.mjs`: dependency-injected pass, mismatch, unavailable, and hash tests.
- Create `scripts/run-f4-full-validation.mjs`: orchestration, atomic writes, manifest, and optional comparison.
- Create `scripts/f4-full-flow.test.mjs`: end-to-end workflow tests using structured fixtures.
- Modify `package.json`: add `workflow:f4`.
- Modify `README.md`: document the F2-to-F4 command and outputs.

### Task 1: Define Strict F4 Workflow Contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add fixtures built from an existing valid `calculationCompletedResultSchema` value and require:

```ts
expect(f4WorkflowCalculationResultSchema.parse({
  contractVersion: "v1",
  workflowVersion: "f4-f2-v1",
  outputClassification: "confidential",
  featureId: "F4",
  status: "completed",
  runId: "f4-run-1",
  generatedAt: "2026-08-07T00:00:00.000Z",
  source: {
    artifactReference: "Feature2-Report.json",
    workbookFileName: "Anonymous.xlsx",
    workbookContentHash: contentHash,
  },
  calculations: [completedResult],
  summary: { selectedWorksheetCount: 1, completedWorksheetCount: 1 },
})).toMatchObject({ status: "completed" });
```

Also reject duplicate worksheet names, calculation hashes that differ from `source.workbookContentHash`, summary count mismatches, unknown fields, comparison items without formula evidence, and non-finite differences.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npx vitest run packages/contracts/src/contracts.test.ts
```

Expected: FAIL because `f4WorkflowCalculationResultSchema` and `f4ExcelComparisonResultSchema` are not exported.

- [ ] **Step 3: Implement the schemas**

Add strict schemas with these public shapes:

```ts
export const f4WorkflowCalculationResultSchema = z.object({
  contractVersion: contractVersionSchema,
  workflowVersion: z.literal("f4-f2-v1"),
  outputClassification: z.literal("confidential"),
  featureId: z.literal("F4"),
  status: z.literal("completed"),
  runId: controlledCalculationReferenceSchema,
  generatedAt: z.string().datetime(),
  source: z.object({
    artifactReference: z.literal("Feature2-Report.json"),
    workbookFileName: z.string().min(1),
    workbookContentHash: sha256Schema,
  }).strict(),
  calculations: z.array(calculationCompletedResultSchema).min(1).max(100),
  summary: z.object({
    selectedWorksheetCount: z.number().int().positive(),
    completedWorksheetCount: z.number().int().positive(),
  }).strict(),
}).strict().superRefine(/* unique worksheets, matching hashes and counts */);
```

The comparison contract must allow statuses `passed`, `mismatch`, `excel_unavailable`, and `mapping_error`. A numeric metric includes `metric`, `f4Value`, `excelValue`, `excelDisplayText`, `absoluteDifference`, `relativeDifference`, `tolerance`, `passed`, `sourceCell`, `excelFormula`, and `f4FormulaId`.

Export inferred `F4WorkflowCalculationResult` and `F4ExcelComparisonResult` types.

- [ ] **Step 4: Run focused tests and build**

```powershell
npx vitest run packages/contracts/src/contracts.test.ts
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat(f4): define F2 workflow output contracts"
```

### Task 2: Load Only Valid F2 Handoffs

**Files:**
- Create: `scripts/f4-artifact-loader.mjs`
- Create: `scripts/f4-artifact-loader.test.mjs`

- [ ] **Step 1: Write failing loader tests**

Use temporary directories and a valid F2 fixture. Test that the loader:

```js
const loaded = loadF4Handoffs(reportPath);
expect(loaded.status).toBe("accepted");
expect(loaded.handoffs.map((item) => item.worksheetName)).toEqual(["Analysis-B", "Analysis-A"]);
```

The fixture order must prove F2 order is retained. Add rejection tests for missing/invalid JSON, `inputRejected`, empty `f4Handoffs`, duplicate handoff worksheet names, handoff/report hash mismatch, a handoff without a matching ready worksheet, and attempts to pass an `.xlsx` path.

- [ ] **Step 2: Run and verify RED**

```powershell
npx vitest run scripts/f4-artifact-loader.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the loader**

Parse only the supplied JSON file with `f2UserReportSchema`. Return:

```js
{
  status: "accepted",
  reportPath,
  workbook: parsed.data.workbook,
  handoffs: parsed.data.f4Handoffs,
}
```

Reject with controlled reason codes: `f2_report_missing`, `f2_report_invalid`, `no_ready_handoff`, or `evidence_mismatch`. Never read `Feature2-Report.md` and never open a workbook.

- [ ] **Step 4: Run focused tests**

```powershell
npx vitest run scripts/f4-artifact-loader.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f4-artifact-loader.mjs scripts/f4-artifact-loader.test.mjs
git commit -m "feat(f4): load validated F2 handoffs"
```

### Task 3: Calculate Every F2-Selected Ready Worksheet

**Files:**
- Create: `scripts/f4-calculation-workflow.mjs`
- Create: `scripts/f4-calculation-workflow.test.mjs`

- [ ] **Step 1: Write failing batch tests**

Inject adapter and calculator dependencies to record calls. Require that every handoff is processed exactly once and in F2 order:

```js
const result = calculateF4Workflow(loaded, {
  runId: "f4-run-1",
  generatedAt: "2026-08-07T00:00:00.000Z",
  createRequest,
  calculate,
});
expect(calls).toEqual(["Analysis-B", "Analysis-A"]);
expect(result.summary).toEqual({ selectedWorksheetCount: 2, completedWorksheetCount: 2 });
```

Verify stable controlled `projectReference`, unique per-worksheet `runReference`, `criticality: "none"`, no worksheet override parameter, deep schema validation, and fail-closed behavior if any calculation is not `completed`.

- [ ] **Step 2: Run and verify RED**

```powershell
npx vitest run scripts/f4-calculation-workflow.test.mjs
```

Expected: FAIL because the workflow module does not exist.

- [ ] **Step 3: Implement the batch service**

Use only:

```js
createCalculationRequestFromF4Handoff({
  handoff,
  projectReference: `f4-${workbookHash.slice(0, 16)}`,
  runReference: `${runId}-${index + 1}`,
  criticality: "none",
});
createCalculation(request);
```

Validate the assembled output with `f4WorkflowCalculationResultSchema`, clone it, and freeze it before returning.

- [ ] **Step 4: Run focused tests**

```powershell
npx vitest run scripts/f4-calculation-workflow.test.mjs packages/workbook-catalog/src/calculation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f4-calculation-workflow.mjs scripts/f4-calculation-workflow.test.mjs
git commit -m "feat(f4): calculate F2-selected worksheets"
```

### Task 4: Add Safe Output Layout and Markdown Report

**Files:**
- Create: `scripts/f4-output-layout.mjs`
- Create: `scripts/f4-output-layout.test.mjs`
- Create: `scripts/f4-report.mjs`
- Create: `scripts/f4-report.test.mjs`

- [ ] **Step 1: Write failing layout and report tests**

Require exactly one `--f2-report`, an optional `--workbook`, safe output override handling, and filenames:

```js
expect(resolveFeature4OutputLayout(args, undefined, now)).toMatchObject({
  calculationJsonName: "Feature4-Calculation.json",
  reportMdName: "Feature4-Report.md",
  comparisonJsonName: "Feature4-Comparison.json",
  manifestName: "manifest.json",
});
```

Render a completed calculation and assert the Markdown includes worksheet, method, factor rows, system values, capability values and comparison status. Assert pipes/newlines are escaped and absolute local paths are redacted.

- [ ] **Step 2: Run and verify RED**

```powershell
npx vitest run scripts/f4-output-layout.test.mjs scripts/f4-report.test.mjs
```

Expected: FAIL because both modules do not exist.

- [ ] **Step 3: Implement layout and renderer**

Use the same `safeName`, path-override validation, and redaction patterns as F1/F3. The Markdown must include:

```markdown
# Feature 4 TA 计算报告
## 执行摘要
## TP_C_Step_TA
### 系统计算
### 能力指标
### Factor 结果
### Excel 回归
```

Do not parse or calculate from Markdown.

- [ ] **Step 4: Run focused tests**

```powershell
npx vitest run scripts/f4-output-layout.test.mjs scripts/f4-report.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f4-output-layout.mjs scripts/f4-output-layout.test.mjs scripts/f4-report.mjs scripts/f4-report.test.mjs
git commit -m "feat(f4): render workflow calculation reports"
```

### Task 5: Discover Controlled Excel Result Cells

**Files:**
- Create: `scripts/f4-excel-mapping.mjs`
- Create: `scripts/f4-excel-mapping.test.mjs`

- [ ] **Step 1: Write failing semantic-mapping tests**

Create synthetic workbooks in memory with moved rows/columns. Test that discovery uses labels and the Response Summary section, stops before `Suggested Spec`, and maps factor outputs from the selected factor source rows.

Expected metric mapping for the acceptance template:

| F4 metric | Excel semantic target | Sample cell |
| --- | --- | --- |
| `factors[i].mean` | factor row `Mean` | `R14:R20` |
| `factors[i].halfTolerance` | factor row `Tolerance` | `S14:S20` |
| `factors[i].sigma` | factor row `One Sigma` | `T14:T20` |
| `factors[i].contribution` | factor row `% Contribution to Sigma` | `U14:U20` |
| `system.designNominal` | `Design Nominal:` | `L44` |
| `system.mean` | `Adjusted Mean:` | `R46` |
| `system.additionalMeanShift` | `Additional Mean Shift` | `R45` |
| `system.worstCaseUpper` | positive tolerance total | `M44` |
| `system.worstCaseLower` | negative tolerance total | `N44` |
| `system.rssSigma` | RSS total | `T44` |
| `capability.lowerZ` | `Lower Z (Sigma Level):` | `T50` |
| `capability.upperZ` | `Upper Z (Sigma Level):` | `T51` |
| `capability.lowerDpm` | `DPM, Lower:` | `X50` |
| `capability.upperDpm` | `DPM, Upper:` | `X51` |
| `capability.totalDpm` | `Total DPM:` | `X52` |
| `capability.outOfSpecRatio` | `% Out of Spec:` | `X53` |
| `capability.cp` | `Cp:` | `T54` |
| `capability.yield` | `Yield:` | `X54` |
| `capability.lowerCpk` | `Lower Cpk:` | `T55` |
| `capability.upperCpk` | `Upper Cpk:` | `T56` |
| `capability.cpk` | `Cpk:` | `T57` |
| `capability.status` | Cpk status | `U57` |

Reject missing anchors, duplicate labels in the same controlled section, non-formula calculated targets, unknown worksheets, and mappings that cross into Suggested Spec.

- [ ] **Step 2: Run and verify RED**

```powershell
npx vitest run scripts/f4-excel-mapping.test.mjs
```

Expected: FAIL because the mapping module does not exist.

- [ ] **Step 3: Implement semantic discovery**

Use SheetJS only to inspect worksheet labels, addresses, cached display values, and formulas. Build the existing `excel-ta-v1` mapping with an empty `inputs` array and outputs containing `name`, `cell`, `expected`, `tolerance`, and `formulaId`. Expected values must come from F4 calculations, never from Excel inputs.

- [ ] **Step 4: Run focused tests**

```powershell
npx vitest run scripts/f4-excel-mapping.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f4-excel-mapping.mjs scripts/f4-excel-mapping.test.mjs
git commit -m "feat(f4): map controlled Excel result formulas"
```

### Task 6: Enrich and Wrap the Excel COM Comparator

**Files:**
- Modify: `scripts/verify-f4-excel-regression.ps1`
- Modify: `scripts/f4-excel-regression.test.mjs`
- Create: `scripts/f4-excel-comparison.mjs`
- Create: `scripts/f4-excel-comparison.test.mjs`

- [ ] **Step 1: Write failing harness and wrapper tests**

Extend mapping validation to accept required `formulaId`. For each output require the harness payload to contain only controlled diagnostics:

```json
{
  "name": "system.rssSigma",
  "cell": "T44",
  "expected": 0.045,
  "actual": 0.045,
  "displayText": "0.045",
  "absoluteDifference": 0,
  "relativeDifference": 0,
  "tolerance": 1e-12,
  "formula": "SQRT(SUMSQ(T14:T43))",
  "formulaId": "rss-v1",
  "pass": true
}
```

Test formula-prefix rejection remains limited to mapping inputs, formula text is read only from the selected output cell, temporary copies are cleaned, and workbook hash remains unchanged. Wrapper tests inject `spawnSync` and cover passed, mismatch, `excel_unavailable`, malformed harness output, and source hash mismatch.

- [ ] **Step 2: Run and verify RED**

```powershell
node --test scripts/f4-excel-regression.test.mjs
npx vitest run scripts/f4-excel-comparison.test.mjs
```

Expected: FAIL because diagnostics and wrapper are absent.

- [ ] **Step 3: Implement enriched diagnostics and wrapper**

In PowerShell read `$range.Value2`, `$range.Text`, and `$range.Formula` after `CalculateFullRebuild()`. Compute absolute and scaled relative difference. Do not return neighboring cells or workbook paths.

The Node wrapper invokes the harness once per selected worksheet, parses only the final JSON line, normalizes expected failure exit codes, and validates the final object with `f4ExcelComparisonResultSchema`.

- [ ] **Step 4: Run focused tests**

```powershell
node --test scripts/f4-excel-regression.test.mjs
npx vitest run scripts/f4-excel-comparison.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/verify-f4-excel-regression.ps1 scripts/f4-excel-regression.test.mjs scripts/f4-excel-comparison.mjs scripts/f4-excel-comparison.test.mjs
git commit -m "feat(f4): report Excel formula differences"
```

### Task 7: Orchestrate the Full Workflow

**Files:**
- Create: `scripts/run-f4-full-validation.mjs`
- Create: `scripts/f4-full-flow.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write failing full-flow tests**

Use dependency injection for calculation and Excel comparison. Verify:

- no-workbook mode writes calculation JSON, Markdown and manifest but no comparison file;
- workbook mode writes all three reports;
- files are written atomically;
- a calculation failure leaves a failed manifest and no forged completed report;
- Excel unavailable preserves valid calculation output and records comparison status;
- output is under the configured ignored run root.

- [ ] **Step 2: Run and verify RED**

```powershell
npx vitest run scripts/f4-full-flow.test.mjs
```

Expected: FAIL because the full runner does not exist.

- [ ] **Step 3: Implement orchestration and command**

Add:

```json
"workflow:f4": "node scripts/run-f4-full-validation.mjs"
```

The CLI shape is:

```powershell
npm run workflow:f4 -- --f2-report <Feature2-Report.json> [--workbook <golden.xlsx>]
```

Write `Feature4-Calculation.json` first after successful schema validation, then optional comparison, then Markdown and the final manifest. Print only paths and controlled summary fields to stdout.

- [ ] **Step 4: Run focused and repository tests**

```powershell
npx vitest run scripts/f4-full-flow.test.mjs scripts/f4-*.test.mjs packages/workbook-catalog/src/calculation.test.ts packages/contracts/src/contracts.test.ts
node --test scripts/f4-excel-regression.test.mjs
npm run build -- --force
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/run-f4-full-validation.mjs scripts/f4-full-flow.test.mjs package.json README.md
git commit -m "feat(f4): add F2-driven calculation workflow"
```

### Task 8: Run the Real TP_C_Step_TA Acceptance

**Files:**
- Generated only under: `test/demo-output/f4-runs/`
- Modify implementation files only if a proven formula mismatch requires a TDD fix.

- [ ] **Step 1: Calculate from the existing F2 report without Excel**

```powershell
npm run workflow:f4 -- --f2-report "test/demo-output/f2-runs/Test_TP_Step_202600805/2026-08-07T02-01-30-880Z/f2/Feature2-Report.json"
```

Expected: one completed calculation for `TP_C_Step_TA`, seven factors, one JSON report and one Markdown report.

- [ ] **Step 2: Run Excel golden comparison**

```powershell
npm run workflow:f4 -- --f2-report "test/demo-output/f2-runs/Test_TP_Step_202600805/2026-08-07T02-01-30-880Z/f2/Feature2-Report.json" --workbook "C:\Users\ralfye\OneDrive - Microsoft\Work\Project\18_Mauna_Loa\Test_TP_Step_202600805.xlsx"
```

Expected: comparison is `passed`, or every mismatch includes metric, values, differences, source cell, Excel formula, and F4 formula ID.

- [ ] **Step 3: Diagnose any mismatch before changing the engine**

Classify each mismatch as display rounding, Excel cached/recalculated behavior, unit/mapping error, or formula semantic mismatch. Do not alter `calculation-kernel.ts` for mapping or display errors.

- [ ] **Step 4: If and only if F4 is semantically wrong, add a failing kernel test and repair it**

```powershell
npx vitest run packages/workbook-catalog/src/calculation-kernel.test.ts
```

Observe RED for the exact Excel formula case, make the smallest kernel change, then observe GREEN and rerun the Excel workflow.

- [ ] **Step 5: Verify source integrity and repository status**

```powershell
Get-FileHash -Algorithm SHA256 "C:\Users\ralfye\OneDrive - Microsoft\Work\Project\18_Mauna_Loa\Test_TP_Step_202600805.xlsx"
git status --short --branch
```

Expected: workbook hash remains `ebcb1bc37a751211d71e42f54eead97ac150e40025592af913f45dd909c2430e`; generated outputs are ignored.

### Task 9: Final Verification and Review

**Files:** None unless review identifies a scoped defect.

- [ ] **Step 1: Run the complete repository verification**

```powershell
npm test
npm run lint
npm run check:repository
node --test scripts/f4-excel-regression.test.mjs
```

Expected: all relevant tests pass. If known environment-dependent tests fail, record exact failures without modifying unrelated code.

- [ ] **Step 2: Review against the approved specification**

Confirm: F4 never reads Excel inputs, no worksheet can be added after F2 confirmation, JSON is suitable for F5, Markdown is human-readable, formula diagnostics are controlled, and existing F4 APIs remain unchanged.

- [ ] **Step 3: Request code review**

Review all commits after `eb6d0e6` for correctness, security boundaries, test gaps, and accidental scope expansion. Repair only confirmed defects and rerun the relevant verification.

- [ ] **Step 4: Show final diff and status**

```powershell
git diff --stat origin/User/Ralf/F4_to_connect_F2...HEAD
git status --short --branch
```

Expected: only planned source, tests, docs, and package script changes are tracked; generated Excel/F4 outputs are ignored.