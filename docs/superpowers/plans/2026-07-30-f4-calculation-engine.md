# F4 Calculation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an F1/F2-gated F4 service that recommends WC/RSS/3D VA by factor count, reproduces approved Excel calculations, and supports deterministic What-if recalculation.

**Architecture:** Strict Zod contracts bind F1 assets and F2 readiness evidence to one workbook hash. A file-free TypeScript kernel performs factor and capability calculations; the service normalizes selected source rows, builds traceable immutable results, and applies scenarios through the same kernel. A Windows-only Excel regression script validates approved workbooks outside the production hot path.

**Tech Stack:** TypeScript strict ESM, Zod v3, Vitest v3, `@stdlib/stats-base-dists-normal-cdf`, PowerShell Excel COM, npm workspaces.

---

## File Structure

- Modify `packages/contracts/src/contracts.ts`: replace the F4 unavailable-only schema with strict completed request/result schemas while retaining explicit unavailable result compatibility.
- Modify `packages/contracts/src/contracts.test.ts`: verify strict F4 contracts, hash binding, result invariants and scenario overrides.
- Create `packages/workbook-catalog/src/calculation-kernel.ts`: pure normalized factor math, method recommendation and capability calculations.
- Create `packages/workbook-catalog/src/calculation-kernel.test.ts`: formula, precision and boundary tests.
- Create `packages/workbook-catalog/src/calculation.ts`: policy gate, F1/F2 readiness gate, normalization, trace construction and scenario execution.
- Create `packages/workbook-catalog/src/calculation.test.ts`: service, privacy, evidence and immutable result tests.
- Modify `packages/workbook-catalog/src/index.ts`: export the completed F4 service while preserving the placeholder export.
- Modify `packages/workbook-catalog/package.json` and root lock file: add the normal CDF dependency.
- Create `scripts/verify-f4-excel-regression.ps1`: read-only approved-workbook regression runner using temporary copies and `CalculateFullRebuild`.
- Create `scripts/f4-excel-regression.test.mjs`: validate argument, hash and mapping behavior without requiring Excel mutation.
- Modify `package.json`: expose the F4 regression command.
- Modify `packages/governance/src/feature-register.ts` and `packages/governance/src/policy-gate.test.ts`: publish F4 availability and acceptance controls.
- Modify `docs/governance/feature-register.md`, `docs/governance/development-standard.md`, `docs/README.md` and `README.md`: document availability, formula version and validation command.

### Task 1: Define Completed F4 Runtime Contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [x] **Step 1: Write failing contract tests.**

Add a `describe("F4 completed calculation contracts", ...)` block that constructs one confidential request with existing `worksheetAnalysisAssetsResultSchema`, `requiredFieldCheckResultSchema` and `exceptionResolutionResultSchema` fixtures. Assert acceptance of:

```ts
{
  contractVersion: "v1",
  inputClassification: "confidential",
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetAnalysisAssets,
  requiredFieldCheck,
  exceptionResolution,
  worksheetSelection: { worksheetName: "Analysis-A", tableId: "table-a" },
  systemSpecification: {
    designNominal: 0,
    lowerSpecLimit: -0.15,
    upperSpecLimit: 0.05,
    targetSigmaLevel: 3,
    targetCpk: 1,
    additionalMeanShift: 0,
  },
  criticality: "none",
  scenarioOverrides: [],
}
```

Assert that F2.1 must be `readyForNextCheck` and F2.3 must be `readyToContinue`. Also assert rejection for a mismatched workbook hash, blocked required fields, `pendingExceptions`, `upperSpecLimit <= lowerSpecLimit`, unknown fields, public classification and duplicate scenario IDs.

Define the expected completed result fixture with `calculationVersion: "excel-ta-v1"`, method recommendation, factor/system/capability values, trace records and scenarios. Keep the legacy `feature_not_available` result fixture accepted as a separate union member.

- [x] **Step 2: Run the focused contract test and verify RED.**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts`

Expected: FAIL because the current schemas do not accept F1/F2 evidence or completed results.

- [x] **Step 3: Implement strict schemas and invariants.**

In `contracts.ts`, define and export reusable F4 schemas for:

```ts
const calculationMethodSchema = z.enum(["worst_case", "rss_1d", "refer_3d_variation_analysis"]);
const calculationCriticalitySchema = z.enum(["none", "CTS", "CTF"]);
const calculationScenarioOverrideSchema = z.object({
  scenarioId: z.string().min(1),
  factorOverrides: z.array(z.object({
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
    nominalValue: z.number().finite().optional(),
    upperTolerance: z.number().finite().optional(),
    lowerTolerance: z.number().finite().optional(),
    longTermSafetyFactor: z.number().finite().positive().optional(),
    sigmaLevel: z.number().finite().positive().optional(),
    distribution: distributionSchema.optional(),
  }).strict()).max(100),
  systemSpecification: z.object({
    lowerSpecLimit: z.number().finite().optional(),
    upperSpecLimit: z.number().finite().optional(),
    targetSigmaLevel: z.number().finite().positive().optional(),
    targetCpk: z.number().finite().positive().optional(),
    additionalMeanShift: z.number().finite().optional(),
  }).strict().optional(),
}).strict();
```

Use `.superRefine` to enforce evidence hash equality, ready statuses, unique scenario IDs, unique factor override keys and valid specification ranges. Define `calculationResultSchema` as a union of a strict completed result and the existing strict unavailable result. Export all inferred public types needed by the service.

- [x] **Step 4: Run the focused contract test and verify GREEN.**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts`

Expected: PASS.

- [x] **Step 5: Commit the contract slice.**

Run: `git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts && git commit -m "feat(f4): define calculation contracts"`

### Task 2: Implement Method Recommendation and Pure Calculation Kernel

**Files:**
- Create: `packages/workbook-catalog/src/calculation-kernel.ts`
- Create: `packages/workbook-catalog/src/calculation-kernel.test.ts`
- Modify: `packages/workbook-catalog/package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Install the normal CDF dependency.**

Run: `npm install @stdlib/stats-base-dists-normal-cdf -w @ai-assist/workbook-catalog`

Expected: dependency appears in the workspace package and lock file.

- [x] **Step 2: Write failing kernel tests.**

Define normalized factors with source references and test:

```ts
expect(recommendCalculationMethod(3)).toBe("worst_case");
expect(recommendCalculationMethod(4)).toBe("rss_1d");
expect(recommendCalculationMethod(10)).toBe("rss_1d");
expect(recommendCalculationMethod(11)).toBe("refer_3d_variation_analysis");
```

Use the seven-factor `Example_TA` input extracted from the approved template and assert:

```ts
expect(result.system.mean).toBeCloseTo(-0.05, 14);
expect(result.system.rssSigma).toBeCloseTo(0.0450693909432999, 14);
expect(result.capability.cpk).toBeCloseTo(0.739600261633636, 12);
expect(result.capability.totalDpm).toBeCloseTo(26500, -2);
expect(result.capability.status).toBe("FAIL");
```

Add focused cases for all six distribution multipliers, negative nominal/asymmetric tolerance, zero RSS rejection, negative Cpk and contribution sum near one.

- [x] **Step 3: Run kernel tests and verify RED.**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/calculation-kernel.test.ts`

Expected: FAIL because the kernel module does not exist.

- [x] **Step 4: Implement the minimal pure kernel.**

Export:

```ts
export const CALCULATION_VERSION = "excel-ta-v1" as const;
export function recommendCalculationMethod(factorCount: number): CalculationMethod;
export function calculateToleranceAnalysis(input: NormalizedCalculationInput): KernelCalculationResult;
```

Use the approved distribution constants exactly. Compute factor mean with the template's sign-dependent formula, factor half-tolerance, factor sigma, WC sums, RSS, contributions, Cp/Cpk/Z, side and total DPM, out-of-spec ratio, yield and template-compatible status comparisons. Reject non-finite outputs, zero RSS and invalid specifications before division.

- [x] **Step 5: Run kernel tests and verify GREEN.**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/calculation-kernel.test.ts`

Expected: PASS.

- [x] **Step 6: Commit the kernel slice.**

Run: `git add packages/workbook-catalog/src/calculation-kernel.ts packages/workbook-catalog/src/calculation-kernel.test.ts packages/workbook-catalog/package.json package-lock.json && git commit -m "feat(f4): add Excel-consistent calculation kernel"`

### Task 3: Implement the F1/F2-Gated Calculation Service

**Files:**
- Create: `packages/workbook-catalog/src/calculation.ts`
- Create: `packages/workbook-catalog/src/calculation.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [x] **Step 1: Write failing service tests.**

Create a request fixture with available F1 fields. Assert that `createCalculation(request)`:

- selects exactly the requested worksheet/table;
- maps `standardDeviation` to the template Sigma level input;
- reads only available numeric values and accepted distribution text;
- returns source-cell traces and a deeply frozen completed result;
- returns 3D referral plus WC/RSS for 11 factors;
- emits `criticalityRisk: true` for CTS/CTF without changing the recommendation;
- throws fixed typed errors for public classification, malformed input, hash mismatch, blocked F2.1, pending F2.3, missing selection and zero RSS;
- does not expose workbook bytes or arbitrary raw fields in errors/results;
- exports `createCalculation` from the built ESM package.

- [x] **Step 2: Run service tests and verify RED.**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/calculation.test.ts`

Expected: FAIL because `createCalculation` does not exist.

- [x] **Step 3: Implement normalization, gates and trace building.**

Follow existing guarded classification and `createTypedError` patterns. Parse the request with `calculationRequestSchema`, locate one exact table, normalize fields, call the kernel, build `formulaId` values from a fixed allowlist, validate with `calculationResultSchema`, then `structuredClone` and recursively freeze the result.

Do not call the placeholder, open a workbook or infer headers. Keep `createCalculationPlaceholder` unchanged and export both functions.

- [x] **Step 4: Run service and existing placeholder tests.**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/calculation.test.ts packages/workbook-catalog/src/calculation-placeholder.test.ts`

Expected: PASS.

- [x] **Step 5: Commit the service slice.**

Run: `git add packages/workbook-catalog/src/calculation.ts packages/workbook-catalog/src/calculation.test.ts packages/workbook-catalog/src/index.ts && git commit -m "feat(f4): calculate validated worksheet selections"`

### Task 4: Add Deterministic What-if Scenarios

**Files:**
- Modify: `packages/workbook-catalog/src/calculation.ts`
- Modify: `packages/workbook-catalog/src/calculation.test.ts`
- Modify: `packages/workbook-catalog/src/calculation-kernel.test.ts`

- [ ] **Step 1: Write failing What-if tests.**

Assert that one tolerance override changes RSS/Cpk, reports deltas, retains a baseline reference and leaves the baseline deeply equal to a request without scenarios. Assert unknown row references, duplicate row overrides, invalid post-override specifications and more than 100 scenarios are rejected.

- [ ] **Step 2: Run the focused What-if tests and verify RED.**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/calculation.test.ts -t "What-if"`

Expected: FAIL because scenarios are not yet evaluated.

- [ ] **Step 3: Apply immutable overrides and call the same kernel.**

Index factors by `worksheetName|tableId|sourceRow`, clone only the normalized model, apply allowlisted overrides, validate the changed model and specification, execute `calculateToleranceAnalysis`, then return ordered scenario results with `baselineRunReference` and numeric deltas.

- [ ] **Step 4: Run all F4 service/kernel tests and verify GREEN.**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/calculation.test.ts packages/workbook-catalog/src/calculation-kernel.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the What-if slice.**

Run: `git add packages/workbook-catalog/src/calculation.ts packages/workbook-catalog/src/calculation.test.ts packages/workbook-catalog/src/calculation-kernel.test.ts && git commit -m "feat(f4): add deterministic what-if recalculation"`

### Task 5: Add the Windows Excel Golden Regression Harness

**Files:**
- Create: `scripts/verify-f4-excel-regression.ps1`
- Create: `scripts/f4-excel-regression.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing harness tests.**

Test that the script requires `-WorkbookPath`, `-ExpectedSha256`, `-WorksheetName` and a JSON mapping; rejects hash mismatch before Excel startup; rejects output cells outside the mapping; and supports `-ValidateOnly` for CI without COM.

- [ ] **Step 2: Run harness tests and verify RED.**

Run: `node --test scripts/f4-excel-regression.test.mjs`

Expected: FAIL because the script does not exist.

- [ ] **Step 3: Implement the read-only regression harness.**

The script must:

1. hash the source file and compare it with `-ExpectedSha256`;
2. copy it to a unique temporary directory;
3. set `AutomationSecurity = 3`, disable alerts and link updates;
4. open only the temporary copy;
5. write allowlisted fixture cells, call `CalculateFullRebuild`, and read allowlisted result cells;
6. compare numeric values with absolute-or-relative tolerance `1e-12` and text exactly;
7. close without saving and remove the temporary directory in `finally`;
8. emit JSON without input values.

Add root script:

```json
"verify:f4-excel-regression": "pwsh -NoProfile -File scripts/verify-f4-excel-regression.ps1"
```

- [ ] **Step 4: Run harness unit tests and approved workbook checks.**

Run: `node --test scripts/f4-excel-regression.test.mjs`

Run the script against the approved template `Example_TA` and `test/feature1-input/Mauna_Loa_TP_Step_20260611.xlsx` mappings on Windows.

Expected: unit tests PASS; approved core outputs stay within `1e-12`, formatted Cpk/status match exactly, and source workbook hashes remain unchanged.

- [ ] **Step 5: Commit the regression slice.**

Run: `git add scripts/verify-f4-excel-regression.ps1 scripts/f4-excel-regression.test.mjs package.json && git commit -m "test(f4): add Excel golden regression harness"`

### Task 6: Enable F4 Governance and Documentation

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `docs/governance/feature-register.md`
- Modify: `docs/governance/development-standard.md`
- Modify: `docs/README.md`
- Modify: `README.md`

- [ ] **Step 1: Write the failing governance expectation.**

Update the F4 policy test to expect `status: "available"`, dependencies on the validated calculation service, unchanged confidential classification, acceptance checks for kernel and template regression, and the approved Excel Worker as a release-only prerequisite rather than a production runtime dependency.

- [ ] **Step 2: Run governance tests and verify RED.**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts`

Expected: FAIL because F4 remains unavailable.

- [ ] **Step 3: Update registration and docs.**

Use the existing available feature entry shape. Document `excel-ta-v1`, method boundaries, both WC/RSS outputs, confidential evidence handling, the What-if reuse rule and both validation commands. Do not claim F5/F6 availability.

- [ ] **Step 4: Run governance and repository checks.**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts`

Run: `npm run check:repository`

Expected: PASS.

- [ ] **Step 5: Commit governance and documentation.**

Run: `git add packages/governance/src/feature-register.ts packages/governance/src/policy-gate.test.ts docs/governance/feature-register.md docs/governance/development-standard.md docs/README.md README.md && git commit -m "feat(f4): enable governed calculation engine"`

### Task 7: Full Verification and Requirements Audit

**Files:**
- Verify all files changed by Tasks 1-6.

- [ ] **Step 1: Run focused F4 verification.**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/calculation-kernel.test.ts packages/workbook-catalog/src/calculation.test.ts packages/workbook-catalog/src/calculation-placeholder.test.ts packages/governance/src/policy-gate.test.ts`

Expected: PASS with zero failed tests.

- [ ] **Step 2: Run full repository verification.**

Run: `npm test`

Run: `npm run lint`

Run: `npm run check:repository`

Run: `git diff --check`

Expected: all commands exit zero.

- [ ] **Step 3: Audit the approved design requirement by requirement.**

Confirm evidence for method boundaries, simultaneous WC/RSS, six distributions, mean/Sigma/contribution/Cp/Cpk/Z/DPM/Yield, CTS/CTF risk-only behavior, What-if kernel reuse, immutable traceable output, privacy errors, Excel regression and F4 governance. Record any intentionally deferred 3D/Monte Carlo/optimization work as out of scope, not as F4 completion gaps.

- [ ] **Step 4: Request code review.**

Dispatch the `code-reviewer` agent against `docs/superpowers/specs/2026-07-30-f4-calculation-engine-design.md`, this plan and the complete branch diff. Resolve all correctness findings and rerun the relevant focused and full checks.

- [ ] **Step 5: Commit verification-only fixes if needed.**

Run: `git status --short` and commit only concrete review fixes with a scoped message. Do not create an empty completion commit.