# F0 TA Process Requirements Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an immutable, internally classified `process-requirements-v1` F0 snapshot with structured listing and context evaluation APIs, provenance, and F0 runner validation.

**Architecture:** Add strict standalone contracts, then implement a repository-backed reviewed seed, integrity validator, and pure evaluator in `@ai-assist/knowledge-base`. Extend the F0 runner to require the fourth exact version; do not parse workbooks at runtime or integrate results into calculations or reports in this change.

**Tech Stack:** TypeScript strict ESM, Zod v3, Vitest v3, Node.js, existing `contentHash` and typed-error utilities.

---

## File Structure

- `packages/contracts/src/process-requirements-contracts.ts`: schemas and inferred DTO types.
- `packages/contracts/src/process-requirements-contracts.test.ts`: contract tests.
- `packages/knowledge-base/src/process-requirements/types.ts`: readonly snapshot aliases.
- `packages/knowledge-base/src/process-requirements/test-support.ts`: minimal valid test seed.
- `packages/knowledge-base/src/process-requirements/validation.ts`: integrity validation and freezing.
- `packages/knowledge-base/src/process-requirements/data/process-requirements-v1.ts`: reviewed rules.
- `packages/knowledge-base/src/process-requirements/query.ts`: loader, list query, and evaluator.
- Adjacent `.test.ts` files cover each unit; package indexes expose the API.
- `packages/workflow-runners/src/f0.ts`, `f0.test.ts`, and `types.ts` require the fourth version.

### Task 1: Strict Contracts

**Files:**
- Create: `packages/contracts/src/process-requirements-contracts.ts`
- Create: `packages/contracts/src/process-requirements-contracts.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write the failing contract test**

Test six strict entry types, source metadata, manifest, seed package, list/evaluation requests, and
the three evaluation statuses. Use local valid-object builders so each rejection changes one field.

```ts
it.each(["requirement", "warning", "escalation", "milestone", "instruction", "definition"] as const)(
  "accepts a strict %s entry",
  (entryType) => expect(processRequirementEntrySchema.parse(validEntry(entryType)).entryType).toBe(entryType),
);

it("rejects unknown fields and paths", () => {
  expect(processRequirementEntrySchema.safeParse({ ...validEntry("warning"), sourceText: "raw" }).success).toBe(false);
  expect(processRequirementSourceMetadataSchema.safeParse({ ...validSource(), sourcePath: "C:\\source.xlsx" }).success).toBe(false);
});
```

- [ ] **Step 2: Verify RED**

Run `npx vitest run packages/contracts/src/process-requirements-contracts.test.ts`.
Expected: FAIL because the imported contract module does not exist.

- [ ] **Step 3: Implement the schemas**

Export literal version `process-requirements-v1`; entry types; topics; normative strengths; structured
applicability facts; confidential source/internal release metadata; provenance; manifest counts and
hashes; seed package; load/list/evaluation requests; matched-entry evidence; resolved sigma target;
and `matched`, `insufficient-facts`, `not-applicable` result schemas. Every object uses `.strict()`.

```ts
export const processRequirementVersionSchema = z.literal("process-requirements-v1");
export const processRequirementEntryTypeSchema = z.enum([
  "requirement", "warning", "escalation", "milestone", "instruction", "definition",
]);
export type ProcessRequirementEntry = z.infer<typeof processRequirementEntrySchema>;
```

- [ ] **Step 4: Export and verify GREEN**

Add `export * from "./process-requirements-contracts.js";` to `packages/contracts/src/index.ts`.
Run the focused Vitest command and
`npx eslint packages/contracts/src/process-requirements-contracts.ts packages/contracts/src/process-requirements-contracts.test.ts packages/contracts/src/index.ts`.
Expected: both exit 0.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/process-requirements-contracts.ts packages/contracts/src/process-requirements-contracts.test.ts packages/contracts/src/index.ts
git commit -m "feat: add F0 process requirements contracts"
```

### Task 2: Snapshot Validation

**Files:**
- Create: `packages/knowledge-base/src/process-requirements/types.ts`
- Create: `packages/knowledge-base/src/process-requirements/test-support.ts`
- Create: `packages/knowledge-base/src/process-requirements/validation.ts`
- Create: `packages/knowledge-base/src/process-requirements/validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

```ts
it("creates a deeply immutable snapshot", () => {
  const snapshot = createProcessRequirementSnapshot(createValidProcessRequirementSeed());
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.entries[0]?.applicability)).toBe(true);
});

it.each([
  ["duplicate ID", (seed) => seed.entries.push(structuredClone(seed.entries[0]!))],
  ["unknown source", (seed) => { seed.entries[0]!.provenance.sourceAlias = "missing"; }],
  ["self reference", (seed) => { seed.entries[0]!.relatedEntryIds = [seed.entries[0]!.entryId]; }],
  ["hash mismatch", (seed) => { seed.manifest.entriesHash = "0".repeat(64); }],
])("rejects %s", (_name, mutate) => {
  const seed = createValidProcessRequirementSeed();
  mutate(seed);
  expect(() => createProcessRequirementSnapshot(seed)).toThrow();
});
```

Also test wrong counts/type counts, missing and cyclic relations, provenance mismatch, absolute paths,
URLs, and forbidden `sourceText`, `rawText`, or `verbatim` properties.

- [ ] **Step 2: Verify RED**

Run `npx vitest run packages/knowledge-base/src/process-requirements/validation.test.ts`.
Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement the validator**

Parse the seed schema; compare counts and hashes with `contentHash`; verify unique IDs/aliases,
provenance resolution, and an acyclic relation graph; recursively reject paths, URLs, and forbidden
raw-source keys. Return a structured clone recursively frozen. Throw the existing typed
`validation_error` without source text. `types.ts` uses the existing recursive `DeepReadonly` shape.

- [ ] **Step 4: Verify GREEN**

Run the validation test and ESLint on the four files. Expected: both exit 0.

- [ ] **Step 5: Commit**

```powershell
git add packages/knowledge-base/src/process-requirements/types.ts packages/knowledge-base/src/process-requirements/test-support.ts packages/knowledge-base/src/process-requirements/validation.ts packages/knowledge-base/src/process-requirements/validation.test.ts
git commit -m "feat: validate F0 process requirement snapshots"
```

### Task 3: Reviewed V1 Seed

**Files:**
- Create: `packages/knowledge-base/src/process-requirements/data/process-requirements-v1.ts`
- Create: `packages/knowledge-base/src/process-requirements/data/process-requirements-v1.test.ts`

- [ ] **Step 1: Write the failing seed tests**

Assert source alias, hash `44c8249abca1638af5803e0bddc0de2a468fae64093b3e8f0648862923db8418`,
revision `Beta`, worksheet/range, confidential source/internal release, all six entry types, and stable
IDs covering method/FOV escalation, CTS/CTF targets, milestones, ADO notice, modeling, workbook
operations, and ten definitions. Assert serialization excludes `Test_TP_Step`, `C:\\Users`, recipient
names, document number, and source prose.

- [ ] **Step 2: Verify RED**

Run `npx vitest run packages/knowledge-base/src/process-requirements/data/process-requirements-v1.test.ts`.
Expected: FAIL because the reviewed seed module does not exist.

- [ ] **Step 3: Implement the reviewed seed**

Use one approved source metadata object and an `add()` helper that attaches reviewed provenance.
Publish concise normalized messages and explicit applicability/required facts. Use only approved
source ranges from `B7:B9`, `B12:R12`, `B16:R16`, `B19:R19`, `B22:R22`, `B25:R33`, `B36:S37`,
`B39:M40`, `B45:T47`, and `B54:M55`. Build counts and hashes after entries are complete.

- [ ] **Step 4: Verify GREEN**

Run the seed test together with the validation test. Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/knowledge-base/src/process-requirements/data/process-requirements-v1.ts packages/knowledge-base/src/process-requirements/data/process-requirements-v1.test.ts
git commit -m "feat: publish reviewed F0 process requirements"
```

### Task 4: Read-Only Query API

**Files:**
- Create: `packages/knowledge-base/src/process-requirements/query.ts`
- Create: `packages/knowledge-base/src/process-requirements/query.test.ts`
- Modify: `packages/knowledge-base/src/index.ts`

- [ ] **Step 1: Write failing query tests**

```ts
const knowledge = loadProcessRequirements({ version: "process-requirements-v1" });
expect(knowledge.evaluateProcessRequirements({
  analysisMethod: "one-dimensional-rss",
  toleranceCount: 11,
  hasThreeDimensionalSensitivity: true,
}).matchedEntries.map(({ entryId }) => entryId)).toContain("method-escalation-complex-stack");
expect(knowledge.evaluateProcessRequirements({ characteristicClass: "cts" }).resolvedTargets).toEqual({ sigma: 6 });
expect(knowledge.evaluateProcessRequirements({ characteristicClass: "ctf" }).resolvedTargets).toEqual({ sigma: 4 });
```

Cover camera FOV, ODM milestones, post-build data, supplier DFM, requirement-gap ADO, deterministic
severity order, list filters, definitions never activating, missing facts, not-applicable, unknown
version, extra fields, and repeat-call immutability.

- [ ] **Step 2: Verify RED**

Run `npx vitest run packages/knowledge-base/src/process-requirements/query.test.ts`.
Expected: FAIL because the query module does not exist.

- [ ] **Step 3: Implement the evaluator**

Load only the reviewed static seed through the validator. Parse all requests and return typed errors.
Match explicit predicates only when the required fact is present; implement the tolerance threshold
through `minimumToleranceCountExclusive`. Relevant absent facts become `missingFacts`, never matches.
Definitions are list-only. Sort by escalation, warning, requirement, milestone, instruction, then ID.
Clone and freeze every result.

- [ ] **Step 4: Export and verify GREEN**

Export validator, reviewed factory, loader, `ProcessRequirements`, seed, and snapshot types from
`packages/knowledge-base/src/index.ts`. Run all process-requirement tests and
`npm run typecheck:type-tests --workspace @ai-assist/knowledge-base`. Expected: exit 0.

- [ ] **Step 5: Commit**

```powershell
git add packages/knowledge-base/src/process-requirements/query.ts packages/knowledge-base/src/process-requirements/query.test.ts packages/knowledge-base/src/index.ts
git commit -m "feat: query F0 process requirements"
```

### Task 5: F0 Runner Integration

**Files:**
- Modify: `packages/workflow-runners/src/f0.ts`
- Modify: `packages/workflow-runners/src/f0.test.ts`
- Modify: `packages/workflow-runners/src/types.ts`

- [ ] **Step 1: Write failing runner tests**

Inject `loadProcessRequirements`, expect request `{ version: "process-requirements-v1" }`, return
`{ manifest: { version: "process-requirements-v1" } }`, and expect the exact four-version tuple.
Test missing manifest, wrong version, and loader error; none may emit `stage_completed`.

- [ ] **Step 2: Verify RED**

Run `npx vitest run packages/workflow-runners/src/f0.test.ts`.
Expected: FAIL because the fourth dependency and version are absent.

- [ ] **Step 3: Implement runner validation**

Import and invoke `loadProcessRequirements`, add the dependency injection field, append the version,
and extend `F0ValidationResult.versions`. Refactor exact version validation to receive the expected
manifest field explicitly: existing loaders use `effectiveVersion`; the new loader uses `version`.

- [ ] **Step 4: Verify GREEN**

Run the runner test, all new focused tests, and ESLint over touched source/test paths. Expected: all
commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add packages/workflow-runners/src/f0.ts packages/workflow-runners/src/f0.test.ts packages/workflow-runners/src/types.ts
git commit -m "feat: validate process requirements in F0"
```

### Task 6: Build and Final Verification

**Files:**
- Verify generated output; never stage unrelated user changes.

- [ ] **Step 1: Preserve the user declaration diff**

Save `git diff -- packages/contracts/dist/f7-contracts.d.ts` to
`$env:TEMP\f7-contracts-user.patch`, record its SHA-256, and do not reset that file.

- [ ] **Step 2: Build touched projects**

Run `npx tsc -b packages/contracts packages/knowledge-base packages/workflow-runners --force`.
Expected: exit 0. Compare the user declaration diff to the saved patch and reapply only that saved
user diff if generation changed it.

- [ ] **Step 3: Run focused verification**

```powershell
npx vitest run packages/contracts/src/process-requirements-contracts.test.ts packages/knowledge-base/src/process-requirements/validation.test.ts packages/knowledge-base/src/process-requirements/data/process-requirements-v1.test.ts packages/knowledge-base/src/process-requirements/query.test.ts packages/workflow-runners/src/f0.test.ts
npm run typecheck:type-tests --workspace @ai-assist/knowledge-base
npx eslint packages/contracts/src/process-requirements-contracts.ts packages/contracts/src/process-requirements-contracts.test.ts packages/contracts/src/index.ts packages/knowledge-base/src/process-requirements packages/knowledge-base/src/index.ts packages/workflow-runners/src/f0.ts packages/workflow-runners/src/f0.test.ts packages/workflow-runners/src/types.ts
git diff --check
```

Expected: zero failures and exit 0 for every command.

- [ ] **Step 4: Run repository-wide verification**

Run `npm test`. Expected: exit 0. Restore only the saved user declaration diff if the forced build
overwrites it.

- [ ] **Step 5: Review scope**

Run `git status --short`, `git diff --stat`, and `git diff --check`. Confirm no workbook, local path,
verbatim source text, unrelated script change, or user-owned change is staged. Commit only newly
required generated outputs, if repository convention tracks them, with
`git commit -m "build: update process requirements declarations"`; otherwise make no empty commit.