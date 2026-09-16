# F0 TA Process and Requirements V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `process-requirements-v2` with small-stack Worst Case guidance and expanded complex-stack 3D analysis guidance, while preserving v1 and moving F0/F7 defaults to v2.

**Architecture:** Extend the shared contract with a maximum-exclusive tolerance-count predicate and a v1/v2 version union. Build v2 from a fresh v1 seed, then make the query loader dispatch by requested version. F0 and F7 request v2 explicitly; F7 derives presentation state from F0 evaluation without owning thresholds.

**Tech Stack:** TypeScript, Zod, Vitest, Vue 3, npm workspaces

---

## File Structure

- `packages/contracts/src/process-requirements-contracts.ts`: version and applicability schemas.
- `packages/knowledge-base/src/process-requirements/validation.ts`: predicate mapping and interval validation.
- `packages/knowledge-base/src/process-requirements/data/process-requirements-v2.ts`: reviewed v2 snapshot.
- `packages/knowledge-base/src/process-requirements/query.ts`: dual-version loading and evaluation.
- `packages/workflow-runners/src/f0.ts`: governed F0 default version.
- `apps/f7-web/src/f0-process-guidance.ts`: F7 adapter requesting v2.
- Neighboring `*.test.ts` files: contract, seed, query, runner, builder, and component coverage.

### Task 1: Contract and Applicability Validation

**Files:**
- Modify: `packages/contracts/src/process-requirements-contracts.test.ts`
- Modify: `packages/contracts/src/process-requirements-contracts.ts`
- Modify: `packages/knowledge-base/src/process-requirements/validation.test.ts`
- Modify: `packages/knowledge-base/src/process-requirements/validation.ts`

- [ ] **Step 1: Write failing contract tests**

Assert that v1 and v2 parse, that the following applicability parses, and that values `-1` and `3.5` fail:

```ts
{
  maximumToleranceCountExclusive: 4,
  requiredFacts: ["toleranceCount"],
}
```

- [ ] **Step 2: Verify RED**

Run `npx.cmd vitest run --project node packages/contracts/src/process-requirements-contracts.test.ts`.
Expected: FAIL because v2 and the maximum predicate are not accepted.

- [ ] **Step 3: Implement the schemas**

Use:

```ts
export const processRequirementVersionSchema = z.enum([
  "process-requirements-v1",
  "process-requirements-v2",
]);
```

Add this strict applicability property:

```ts
maximumToleranceCountExclusive: z.number().int().nonnegative().optional(),
```

- [ ] **Step 4: Verify GREEN**

Rerun the contract test. Expected: PASS.

- [ ] **Step 5: Write failing validation tests**

Add a test proving `maximumToleranceCountExclusive` requires `toleranceCount` in `requiredFacts`.
Add a table test rejecting compound integer intervals `(3,4)`, `(4,4)`, and `(5,4)` because no
integer can satisfy both exclusive bounds.

- [ ] **Step 6: Verify RED**

Run `npx.cmd vitest run --project node packages/knowledge-base/src/process-requirements/validation.test.ts`.
Expected: FAIL because the predicate is not mapped or interval-validated.

- [ ] **Step 7: Implement validation**

Add this predicate mapping:

```ts
maximumToleranceCountExclusive: "toleranceCount",
```

Inside `validateApplicability`, reject the empty integer interval:

```ts
const { minimumToleranceCountExclusive: minimum, maximumToleranceCountExclusive: maximum } = entry.applicability;
if (minimum !== undefined && maximum !== undefined && minimum + 1 >= maximum) {
  throw validationError([ENTRIES_REFERENCE]);
}
```

- [ ] **Step 8: Verify and commit**

Run both focused tests. Stage only the four Task 1 files and commit with
`feat: extend process requirement applicability`.

### Task 2: V2 Snapshot and Dual-Version Query

**Files:**
- Create: `packages/knowledge-base/src/process-requirements/data/process-requirements-v2.ts`
- Create: `packages/knowledge-base/src/process-requirements/data/process-requirements-v2.test.ts`
- Modify: `packages/knowledge-base/src/process-requirements/query.test.ts`
- Modify: `packages/knowledge-base/src/process-requirements/query.ts`
- Modify: `packages/knowledge-base/src/index.ts`

- [ ] **Step 1: Write the failing v2 seed test**

Assert the v2 manifest/version, review date `2026-09-16T00:00:00.000Z`, valid generated hashes,
all-v2 provenance, and no mutation of a separately created v1 seed. Assert this new entry:

```ts
{
  entryId: "instruction-consider-worst-case-small-stack",
  entryType: "instruction",
  topic: "analysis-method",
  title: "Consider Worst Case for small stacks",
  message: "Consider Worst Case values when the tolerance stack contains fewer than 4 factors.",
  normativeStrength: "should",
  applicability: {
    maximumToleranceCountExclusive: 4,
    requiredFacts: ["toleranceCount"],
  },
  relatedEntryIds: [],
}
```

Assert the revised complex-stack message contains both `Dimensional Management` and
`3D Variation Analysis software`.

- [ ] **Step 2: Verify RED**

Run `npx.cmd vitest run --project node packages/knowledge-base/src/process-requirements/data/process-requirements-v2.test.ts`.
Expected: FAIL because the v2 module does not exist.

- [ ] **Step 3: Implement the v2 seed**

Create v2 from a fresh `createReviewedProcessRequirementsV1SeedPackage()` result. Deep-clone before
changes, update source review metadata, update every provenance `effectiveVersion` and change
summary, replace only the complex-stack message, insert the small-stack instruction immediately
after that entry, and recompute all counts and hashes with `contentHash`.

Use this complex-stack message:

```text
Consult Dimensional Management and consider 3D Variation Analysis software when a one-dimensional stack has more than 10 tolerances.
```

Do not modify `process-requirements-v1.ts` or its expected hashes.

- [ ] **Step 4: Verify the seed test GREEN**

Rerun the v2 seed test. Record deterministic expected hash constants in the test. Expected: PASS.

- [ ] **Step 5: Write failing query boundary tests**

Assert exact loading of both versions. Against v2, assert Factor counts 3/4 match/do not match
`instruction-consider-worst-case-small-stack`, and counts 10/11 do not match/match
`method-escalation-complex-stack`. Assert missing `toleranceCount` reports that missing fact without
matching either count rule. Retain the unsupported-version test to prove the loader fails closed.

- [ ] **Step 6: Verify query RED**

Run `npx.cmd vitest run --project node packages/knowledge-base/src/process-requirements/query.test.ts`.
Expected: FAIL because v2 dispatch and maximum matching are absent.

- [ ] **Step 7: Implement dual-version loading**

Parse the request, dispatch to the matching seed constructor, and pass `snapshot.manifest.version`
into evaluation output instead of a v1 module constant. For `toleranceCount`, require every present
bound:

```ts
return (applicability.minimumToleranceCountExclusive === undefined
    || typeof actual === "number" && actual > applicability.minimumToleranceCountExclusive)
  && (applicability.maximumToleranceCountExclusive === undefined
    || typeof actual === "number" && actual < applicability.maximumToleranceCountExclusive);
```

Treat either bound as a predicate in `hasPredicate`. Export the v2 constructor from
`packages/knowledge-base/src/index.ts`.

- [ ] **Step 8: Verify and commit**

Run the v1 seed, v2 seed, query, and validation tests together. Expected: PASS with unchanged v1
hash assertions. Stage only the five Task 2 files and commit with
`feat: publish process requirements v2`.

### Task 3: F0 Default Migration

**Files:**
- Modify: `packages/workflow-runners/src/f0.test.ts`
- Modify: `packages/workflow-runners/src/f0.ts`
- Modify: `packages/workflow-runners/src/types.ts`

- [ ] **Step 1: Update tests first**

Change injected manifests, loader expectations, result tuples, mismatch tests, and failure text to
expect `process-requirements-v2` while leaving the other three F0 versions unchanged.

- [ ] **Step 2: Verify RED**

Run `npx.cmd vitest run --project node packages/workflow-runners/src/f0.test.ts`.
Expected: FAIL because the runner requests v1.

- [ ] **Step 3: Update runtime code**

Change `F0Dependencies.loadProcessRequirements`, `DEFAULT_VERSIONS`, the request, exact-version
check, and `F0ValidationResult.versions` tuple to v2.

- [ ] **Step 4: Verify and commit**

Rerun the F0 test. Expected: PASS. Stage only the three Task 3 files and commit with
`feat: validate F0 process requirements v2`.

### Task 4: F7 Guidance Migration

**Files:**
- Modify: `apps/f7-web/src/f0-process-guidance.test.ts`
- Modify: `apps/f7-web/src/f0-process-guidance.ts`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [ ] **Step 1: Write failing builder tests**

Change the exact version expectation to v2. For a three-Factor session, assert the small-stack entry
has state `guidance`. For eleven Factors, assert complex-stack has state `warning`. Retain the
existing 4/10 boundary assertions at the F0 query layer. Update the manifest-mismatch fixture to v2
and retain evaluator-error coverage so both paths continue to fail closed with no invented guidance.

F7 intentionally lists all entries whose required facts are available. Therefore, the small-stack
item may remain visible as ordinary guidance at four Factors; F0 evaluation remains authoritative
for whether the condition matched.

- [ ] **Step 2: Verify RED**

Run `npx.cmd vitest run --project f7-web apps/f7-web/src/f0-process-guidance.test.ts`.
Expected: FAIL because F7 still requests v1.

- [ ] **Step 3: Update F7 production code**

Set `VERSION` to `process-requirements-v2`. Do not add thresholds or controlled wording to F7.

- [ ] **Step 4: Verify builder GREEN**

Rerun the builder test. Expected: PASS.

- [ ] **Step 5: Update component fixtures**

Use v2 in fixture manifest/provenance values. Include the controlled small-stack title/message in
the ordered rendering expectation and assert it has no Warning badge. Preserve all unrelated
existing changes in this currently modified test area.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npx.cmd vitest run --project f7-web apps/f7-web/src/f0-process-guidance.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts
```

Expected: PASS. Inspect diffs before staging, then commit only the Task 4 hunks with
`feat: show F0 process requirements v2 in F7`.

### Task 5: Final Verification

- [ ] **Step 1: Run focused Node tests**

```powershell
npx.cmd vitest run --project node packages/contracts/src/process-requirements-contracts.test.ts packages/knowledge-base/src/process-requirements packages/workflow-runners/src/f0.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run focused F7 tests**

```powershell
npx.cmd vitest run --project f7-web apps/f7-web/src/f0-process-guidance.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Build and lint**

Run `npm.cmd run build -- --force`, followed by ESLint for the touched source and test paths.
Expected: exit code 0 and no new diagnostics.

- [ ] **Step 4: Check the final diff**

Run `git diff --check` and `git status --short --branch`. Confirm no whitespace errors and that all
pre-existing unrelated worktree changes remain untouched and excluded from feature commits.