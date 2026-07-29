# F2.2 Capability Library and Distribution Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver F2.2 as a confidential, non-blocking, evidence-only comparison of ready TA factor rows against the approved F0 Capability Library and its recommended distributions.

**Architecture:** Contracts own F2.2 request/result schemas and add an F1.1 content-hash binding to F2.1 results. A pure catalog service consumes F1.1 assets plus a ready, bound F2.1 result and queries F0 only through `loadKnowledgeBase({ version })`. Governance enables only F2.2; root F2 and later subfeatures stay unavailable.

**Tech Stack:** TypeScript strict ESM, Zod v3, Vitest v3, existing F0 API, anonymous in-memory F1.1-shaped fixtures.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/contracts/src/contracts.ts` | F2.1 binding and F2.2 schemas/types. |
| `packages/contracts/src/contracts.test.ts` | Strict contract and invariant tests. |
| `packages/workbook-catalog/package.json` | F0 workspace dependency. |
| `packages/workbook-catalog/src/required-field-check.ts` | Populate F2.1 content hash. |
| `packages/workbook-catalog/src/required-field-check.test.ts` | Verify the F2.1 binding. |
| `packages/workbook-catalog/src/capability-validation.ts` | Pure F2.2 validator. |
| `packages/workbook-catalog/src/capability-validation.test.ts` | F2.2 behavior tests. |
| `packages/workbook-catalog/src/index.ts` | F2.2 exports. |
| `packages/governance/src/feature-register.ts` | F2.2 registration. |
| `packages/governance/src/policy-gate.test.ts` | F2.2 status regression. |
| `README.md`, `docs/README.md`, `docs/governance/feature-register.md` | Scope and design/plan links. |

### Task 1: Bind F2.1 Results to the Checked Assets

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/workbook-catalog/src/required-field-check.ts`
- Modify: `packages/workbook-catalog/src/required-field-check.test.ts`

- [ ] **Step 1: Add failing tests for a required F2.1 content hash.**

Update valid F2.1 result fixtures to include `workbookContentHash`, and assert omission or a non-SHA-256 value is rejected. In the service test, assert:

```ts
const result = createRequiredFieldCheck(requestFor(completeFields()));
expect(result.workbookContentHash).toBe("a".repeat(64));
expect(Object.isFrozen(result)).toBe(true);
```

- [ ] **Step 2: Confirm the focused tests fail.**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/required-field-check.test.ts
```

Expected: failure because `RequiredFieldCheckResult` has no binding field.

- [ ] **Step 3: Add the binding field and service output.**

Add the existing hash schema to `requiredFieldCheckResultSchema`:

```ts
workbookContentHash: sha256Schema,
```

Populate it only from validated F1.1 evidence:

```ts
workbookContentHash: parsed.data.worksheetAnalysisAssets.workbook.contentHash,
```

Do not accept a caller-provided hash, recompute a hash, or change F2.1 blocker/advisory behavior.

- [ ] **Step 4: Re-run the focused tests.**

Run the command from Step 2. Expected: PASS.

### Task 2: Define Strict F2.2 Contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write failing F2.2 schema tests.**

Create valid request/result fixtures covering completed `in_library`, `out_of_library`, and `unable_to_validate` tolerance outcomes, plus the `required_fields_not_ready` gate. Reject unknown keys, incompatible state fields, incorrect summary counts, and gate rows.

```ts
expect(() => capabilityValidationResultSchema.parse({
  contractVersion: "v1",
  inputClassification: "confidential",
  knowledgeBaseVersion: "v1",
  workbookContentHash: "a".repeat(64),
  status: "required_fields_not_ready",
  rows: [{ worksheetName: "Analysis-A" }],
  summary: emptyCapabilitySummary,
})).toThrow();
```

- [ ] **Step 2: Confirm the focused contract test fails.**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: failure because F2.2 schemas and types do not yet exist.

- [ ] **Step 3: Add the strict request schema.**

```ts
export const capabilityValidationRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  knowledgeBaseVersion: knowledgeBaseVersionSchema,
  worksheetAnalysisAssets: worksheetAnalysisAssetsResultSchema,
  requiredFieldCheck: requiredFieldCheckResultSchema,
}).strict();
```

- [ ] **Step 4: Add strict row outcome unions.**

Use `z.discriminatedUnion("status", ...)` for tolerance states:

```ts
in_library: { totalTolerance, unit: "mm", capabilityEntryId, capabilityTier }
out_of_library: { totalTolerance, unit: "mm" }
unable_to_validate: { reasonCode: "unit_unavailable" | "invalid_tolerance" }
```

Use another discriminated union for distribution states:

```ts
matches_recommendation: { actual: Distribution, recommended: Distribution }
distribution_mismatch: { actual: Distribution, recommended: Distribution }
unable_to_validate: { reasonCode: "distribution_unavailable" }
not_applicable: {}
```

Every branch is `.strict()`. A row contains only `worksheetName`, `tableId`, `sourceRow`, `factorName`, tolerance, and distribution.

- [ ] **Step 5: Add result branches, summaries, and public types.**

Require `contractVersion`, confidential classification, F0 version, and content hash for both result branches. Gate results require `rows: []` and all-zero counts. Completed summaries must exactly match row-derived counts for:

```text
factorRowsChecked, inLibraryCount, outOfLibraryCount, toleranceUnableToValidateCount,
distributionMatchCount, distributionMismatchCount, distributionUnableToValidateCount,
distributionNotApplicableCount
```

Use `.superRefine` to enforce both the gate and count invariants. Export inferred `CapabilityValidationRequest` and `CapabilityValidationResult`.

- [ ] **Step 6: Re-run the focused contract test.**

Run the command from Step 2. Expected: PASS.

### Task 3: Implement and Test the Pure F2.2 Validator

**Files:**
- Modify: `packages/workbook-catalog/package.json`
- Create: `packages/workbook-catalog/src/capability-validation.ts`
- Create: `packages/workbook-catalog/src/capability-validation.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Add the internal F0 package dependency.**

Add the workspace dependency:

```json
"@ai-assist/knowledge-base": "0.1.0"
```

Run `npm install` from repository root to refresh workspace links. Do not upgrade unrelated packages.

- [ ] **Step 2: Write failing behavior tests using anonymous F1.1-shaped fixtures.**

Build F2.1 input by calling `createRequiredFieldCheck`, not by manually forging a result. Test all of these cases: blocked F2.1 gate has no rows; mismatched hashes throw; `secret` is denied; unavailable F0 version throws; asymmetric total tolerance is upper-minus-lower; inclusive range bounds match; unmatched range is `out_of_library`; matched T0 stays `in_library`; absent/non-`mm` unit is non-blocking unavailable; every approved distribution alias normalizes; unknown distribution is non-blocking unavailable; unequal known distributions mismatch; multi-row summaries match; result is deeply frozen; built ESM export exists.

```ts
expect(validateRow({ upperTolerance: 0.1, lowerTolerance: -0.05 })).toMatchObject({
  tolerance: { status: "in_library", capabilityTier: "T0" },
});
expect(validateRow({ upperTolerance: 99, lowerTolerance: -99 })).toMatchObject({
  tolerance: { status: "out_of_library" },
});
```

- [ ] **Step 3: Confirm the validator test fails.**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/capability-validation.test.ts
```

Expected: failure because `createCapabilityValidation` is not implemented or exported.

- [ ] **Step 4: Implement policy validation, evidence binding, and the F2.1 gate.**

Follow `required-field-check.ts` for safe classification extraction, `createTypedError`, `structuredClone`, and cycle-safe recursive freeze. Use fixed summaries:

```ts
const REQUEST_SUMMARY = "Capability validation request is invalid.";
const POLICY_SUMMARY = "Capability validation input is not permitted.";
```

After parsing `capabilityValidationRequestSchema`, reject unequal F1.1/F2.1 hashes:

```ts
if (request.requiredFieldCheck.workbookContentHash !== request.worksheetAnalysisAssets.workbook.contentHash) {
  throw requestError(REQUEST_SUMMARY);
}
```

For blocked F2.1, return `required_fields_not_ready` with no rows and zero counts. Do not load F0 on that path.

- [ ] **Step 5: Implement tolerance matching and distribution comparison.**

Load F0 only by requested version:

```ts
const knowledgeBase = loadKnowledgeBase({ version: request.knowledgeBaseVersion });
```

Traverse all F1.1 factor rows in source order. Use finite numeric evidence and calculate:

```ts
const totalTolerance = upperTolerance - lowerTolerance;
```

For finite nonnegative tolerance and normalized `mm`, call:

```ts
knowledgeBase.findCapability({ partCategory, tolerance: totalTolerance, unit: "mm" });
```

Map F0 `matched` to `in_library`, retaining entry ID/tier/recommended distribution. Map F0 `unknown` to `out_of_library`, never copying its synthetic T0. Missing, blank, unavailable, or non-`mm` units map to `unit_unavailable`; invalid numeric or negative totals map to `invalid_tolerance`. Never convert units, choose nearest matches, or conclude feasibility.

Use this explicit local alias map after trim plus case folding:

```ts
normal: ["normal", "gaussian", "正态分布"]
uniform: ["uniform", "均匀分布"]
triangular: ["triangular", "三角分布"]
trapezoidal: ["trapezoidal", "梯形分布"]
elliptical: ["elliptical", "椭圆分布"]
beta: ["beta", "贝塔分布"]
```

For `in_library`, return match, mismatch, or `distribution_unavailable`; all other tolerance states return distribution `not_applicable` with no actual/recommended fields. Derive counts from constructed rows, parse the result schema, then clone and freeze it.

- [ ] **Step 6: Export and re-run the focused tests.**

Add:

```ts
export { createCapabilityValidation } from "./capability-validation.js";
```

to `index.ts` and export both F2.2 contract types. Run the command from Step 3. Expected: PASS.

### Task 4: Enable F2.2 and Update Documentation

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/governance/feature-register.md`

- [ ] **Step 1: Write the failing exact registration test.**

Replace the generic unavailable assertion for F2.2 with an available entry containing:

```ts
dependsOn: ["worksheet-analysis-assets-v1", "required-field-check-v1", "knowledge-base-v1", "capability-validation-v1"]
inputContractId: "capability-validation-request-v1"
outputContractId: "capability-validation-result-v1"
acceptanceChecks: [
  "anonymous-capability-validation-fixture",
  "capability-validation-gate-check",
  "capability-validation-nonblocking-check",
  "capability-validation-privacy-check",
]
```

Keep root F2, F2.3, F2.4, and F3-F7 unavailable.

- [ ] **Step 2: Confirm the governance test fails.**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts
```

Expected: F2.2 differs because it is still unavailable.

- [ ] **Step 3: Register F2.2 and update documentation.**

Replace F2.2's unavailable entry with the exact available object tested in Step 1. In README and governance docs, say it requires ready hash-bound F2.1 evidence; checks only total tolerance against F0 category/unit/range and distribution against the recommended distribution; returns non-blocking states; does not convert units, decide feasibility, create exceptions, calculate, call external services, or write workbooks. Link the approved F2.2 design and this plan using existing relative-link style. Do not claim F2.3 is available.

- [ ] **Step 4: Re-run governance tests.**

Run the command from Step 2. Expected: PASS.

### Task 5: Full Regression and Privacy Validation

**Files:**
- Verify: all files in Tasks 1-4

- [ ] **Step 1: Run the touched-package suite.**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/required-field-check.test.ts packages/workbook-catalog/src/capability-validation.test.ts packages/governance/src/policy-gate.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run final repository checks.**

Run:

```powershell
npm run lint
npm test
npm run check:repository
git diff --check
git ls-files | Select-String '\.(xlsx|xlsm)$|^test/|^fixtures/confidential/'
```

Expected: all checks pass and the final command finds no tracked confidential workbook or fixture path.

- [ ] **Step 3: Confirm the completed boundary.**

Review code and tests to confirm F2.2 imports no OOXML reader, accepts no workbook bytes/paths/URLs/images, loads only an approved F0 version, keeps matched T0 as `in_library`, makes unit/distribution inability non-blocking, and leaves F2.3, F2.4, and F3-F7 unavailable.