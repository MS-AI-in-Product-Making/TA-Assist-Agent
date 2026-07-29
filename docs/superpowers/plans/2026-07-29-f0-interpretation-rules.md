# F0 Interpretation Rules Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a read-only, versioned `interpretation-rules-v1` F0 module that turns approved one-dimensional TA interpretation logic into deterministic rules for future F5/F6 consumers without changing the existing tolerance-guidance knowledge base.

**Architecture:** Add a sibling `interpretation/` namespace inside `@ai-assist/knowledge-base`, backed by strict contracts and an immutable reviewed snapshot. Runtime queries accept only structured facts, resolve project targets before controlled defaults, and return rule references, hypotheses, and unranked options; raw workbooks, worked examples, calculators, and final narrative generation remain outside runtime.

**Tech Stack:** TypeScript ES2024/NodeNext, Zod v3, Vitest v3, Node crypto.

**Design:** [2026-07-29-f0-interpretation-rules-design.md](../specs/2026-07-29-f0-interpretation-rules-design.md)

---

## Preconditions

- The source template and interpretation workbook remain in an access-controlled location and are never added to Git.
- Production entries contain generalized rules only. Worked examples use independently authored anonymous test facts.
- Existing `public/v1`, `internal-v1`, and all 110 tolerance-guidance entries are regression baselines and must not be edited.
- This plan publishes an F0 dependency only. F5 and F6 remain `unavailable`.

## File Structure

- Modify `packages/contracts/src/contracts.ts` and `contracts.test.ts`: strict entry, package, request, and result schemas.
- Create `packages/knowledge-base/src/interpretation/types.ts`: immutable package types.
- Create `packages/knowledge-base/src/interpretation/validation.ts` and test: manifest, hash, reference, and semantic validation.
- Create `packages/knowledge-base/src/interpretation/query.ts` and test: deterministic target resolution and rule evaluation.
- Create `packages/knowledge-base/src/interpretation/data/interpretation-rules-v1.ts`: reviewed generalized rules and source metadata.
- Modify `packages/knowledge-base/src/index.ts`: sibling API exports.
- Modify governance registration, tests, data-classification documentation, Feature Register, and root README.

### Task 1: Define Strict Interpretation Contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write failing contract tests.** Import the new schemas and assert acceptance of one entry per discriminant plus a query with Cpk, sigma, and contributors. Assert rejection of `confidential` production provenance, a global Cpk default of `1.00`, ranked options, a root-cause status other than `hypothesis`, unknown fields, non-finite values, and contribution percentages outside `0..100`.

```ts
expect(interpretationKnowledgeEntrySchema.parse({
  entryId: "performance.cpk.project-target-v1",
  entryType: "performance-rule",
  title: "Compare Cpk with the resolved project target",
  description: "Compare the current Cpk with the resolved target.",
  applicability: { analysisDimension: "one-dimensional" },
  relatedEntryIds: [],
  metric: "cpk",
  comparison: "greater-than-or-equal",
  targetSource: "resolved-target",
  outcomeWhenMatched: "meets-target",
  provenance: validInterpretationProvenance,
})).toBeDefined();
```

- [ ] **Step 2: Run the test and verify RED.** Run `npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts`. Expected: FAIL because the interpretation schemas do not exist.

- [ ] **Step 3: Implement strict schemas.** Add the common schemas and a discriminated entry union:

```ts
export const interpretationRuleVersionSchema = z.literal("interpretation-rules-v1");
export const interpretationEntryTypeSchema = z.enum([
  "metric-definition", "performance-rule", "root-cause-signal",
  "improvement-option", "decision-policy",
]);
export const interpretationProvenanceSchema = z.object({
  classification: z.literal("internal"),
  sourceAlias: z.string().min(1),
  sourceFileHash: sha256Schema,
  sourceVersion: z.string().min(1),
  sheetName: z.string().min(1),
  sourceRange: sourceRangeSchema,
  owner: z.string().min(1),
  confidence: z.number().min(0).max(1),
  effectiveVersion: interpretationRuleVersionSchema,
  changeSummary: z.string().min(1),
}).strict();
```

Metric definitions contain `metric` and `unit`; performance rules contain `metric`, comparison, target source, required facts, and outcome; root-cause signals fix `signalStatus: "hypothesis"` and require validation facts; improvement options contain expected impact, trade-offs, and validation steps with no rank field; decision policies contain a controlled policy kind. Define source metadata, manifest, seed package, load request, facts, evaluation result, evidence DTO, and inferred types.

- [ ] **Step 4: Verify and commit.** Run the focused contract test and `npm run build -- --force`; both must PASS. Commit:

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat: define interpretation rules contracts"
```

### Task 2: Validate an Immutable Interpretation Snapshot

**Files:**
- Create: `packages/knowledge-base/src/interpretation/types.ts`
- Create: `packages/knowledge-base/src/interpretation/validation.ts`
- Create: `packages/knowledge-base/src/interpretation/validation.test.ts`
- Modify: `packages/knowledge-base/src/index.ts`

- [ ] **Step 1: Write failing validation tests.** Build a valid package through a local test helper, then reject duplicate entry IDs/source aliases, source hash mismatch, manifest count/hash mismatch, wrong version, unknown related entry, circular relation, incompatible relation type, an inline Cpk target of `1.00`, and a ranked option. Assert errors expose stable aliases/IDs but no source text.

```ts
expect(() => createInterpretationKnowledgeSnapshot({
  ...validPackage,
  entries: [...validPackage.entries, validPackage.entries[0]],
})).toThrowError(expect.objectContaining({ name: "AiAssistError" }));
```

- [ ] **Step 2: Run the test and verify RED.** Run `npm exec -- vitest run --workspace vitest.workspace.ts packages/knowledge-base/src/interpretation/validation.test.ts`. Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement package validation.** Reuse `canonicalJson` and `contentHash`. Validate schema, source hashes, per-type counts, content hash, uniqueness, related-entry existence, allowed relation graph, and acyclic references. Return a defensive clone recursively frozen.

```ts
export function createInterpretationKnowledgeSnapshot(
  value: unknown,
): InterpretationKnowledgeSnapshot {
  const parsed = interpretationKnowledgeSeedPackageSchema.safeParse(value);
  if (!parsed.success) throw invalidPackageError();
  validateManifest(parsed.data);
  validateReferences(parsed.data.entries);
  return deepFreeze(structuredClone(parsed.data));
}
```

Allowed edges are performance rule to metric definition; root-cause signal to performance rule/metric definition; improvement option to root-cause signal; decision policy to any entry. Reject cycles and self-references.

- [ ] **Step 4: Export and verify GREEN.** Export snapshot functions/types from `packages/knowledge-base/src/index.ts`. Run the focused test and existing internal validation test. Expected: both PASS.

- [ ] **Step 5: Commit.**

```powershell
git add packages/knowledge-base/src/interpretation packages/knowledge-base/src/index.ts
git commit -m "feat: validate interpretation rule snapshots"
```

### Task 3: Implement Deterministic Rule Evaluation

**Files:**
- Create: `packages/knowledge-base/src/interpretation/query.ts`
- Create: `packages/knowledge-base/src/interpretation/query.test.ts`
- Modify: `packages/knowledge-base/src/index.ts`

- [ ] **Step 1: Write failing behavior tests.** Inject a minimal snapshot and cover project target precedence, equality boundaries, missing targets, unsupported methods, suppression of dependent signals/options, hypothesis status, unranked options, immutability, and existing internal-guidance regression.

```ts
const result = rules.evaluateInterpretationRules({
  analysisDimension: "one-dimensional",
  method: "rss",
  facts: {
    cpk: 1.21,
    targetCpk: { value: 1.33, source: "project" },
    achievedSigma: 3.8,
    targetSigma: { value: 4, source: "template" },
    contributors: [{ reference: "factor-1", contributionPercent: 42 }],
  },
});
expect(result.status).toBe("matched");
expect(result.resolvedTargets.cpk).toEqual({ value: 1.33, source: "project" });
```

- [ ] **Step 2: Run the test and verify RED.** Run `npm exec -- vitest run --workspace vitest.workspace.ts packages/knowledge-base/src/interpretation/query.test.ts`. Expected: FAIL because the query API is absent.

- [ ] **Step 3: Implement loader and evaluator.** Expose only the strict API:

```ts
export interface InterpretationRules {
  evaluateInterpretationRules(request: unknown): InterpretationRuleEvaluation;
}

export function loadInterpretationRules(request: unknown): InterpretationRules {
  parseOrThrow(interpretationRuleLoadRequestSchema, request);
  return createInterpretationRules(
    createInterpretationKnowledgeSnapshot(createReviewedInterpretationRulesV1SeedPackage()),
  );
}
```

Resolve request targets before exactly one controlled default. If absent or ambiguous, return `insufficient-facts`. Evaluate performance rules, then signals, then options; include only entries whose required facts and related entries matched. Sort by `entryId`; recursively freeze fresh DTOs.

- [ ] **Step 4: Verify and commit.** Run the new test, `internal/query.test.ts`, and `knowledge-base.test.ts`; expected PASS. Commit:

```powershell
git add packages/knowledge-base/src/interpretation/query.ts packages/knowledge-base/src/interpretation/query.test.ts packages/knowledge-base/src/index.ts
git commit -m "feat: evaluate interpretation rules"
```

### Task 4: Publish the Reviewed Generalized Snapshot

**Files:**
- Create: `packages/knowledge-base/src/interpretation/data/interpretation-rules-v1.ts`
- Create: `packages/knowledge-base/src/interpretation/data/interpretation-rules-v1.test.ts`
- Create: `packages/knowledge-base/src/interpretation/test-support.ts`

- [ ] **Step 1: Write failing snapshot tests.** Require all five entry types, no project identifiers or worked-example values, no global Cpk `1.00` default, complete provenance, and one full metric-to-option chain.

```ts
expect(snapshot.entries.some((entry) => entry.entryType === "metric-definition")).toBe(true);
expect(snapshot.entries.some((entry) => entry.entryType === "performance-rule")).toBe(true);
expect(JSON.stringify(snapshot)).not.toMatch(/worked example|project name|part number/i);
```

- [ ] **Step 2: Run the test and verify RED.** Run `npm exec -- vitest run --workspace vitest.workspace.ts packages/knowledge-base/src/interpretation/data/interpretation-rules-v1.test.ts`. Expected: FAIL because the reviewed seed is absent.

- [ ] **Step 3: Add approved generalized entries.** Convert approved content from metric definitions, performance rules, root-cause library, improvement options, F5/F6 decision logic, and source register. Use the actual source SHA-256 and reviewed ranges. Exclude `06_Worked_Examples`, `07_Dynamic_Calculator`, `09_Fallback_Calculator`, and `10_Example_TA_Interpretation`.

Include these reviewed semantic chains without case-specific prose:

```text
metric.cpk -> performance.cpk.below-resolved-target
  -> signal.dominant-contributor (max contribution >=30%)
  -> option.review-dominant-contributor
metric.cpk -> performance.cpk.meets-resolved-target
  -> terminate without triggering a root-cause signal
```

The contributor threshold comes directly from the RC03 root-cause signal activation condition. Do not create a contribution performance rule: performance entries compare an actual metric with a resolved target, and RC03 has no contribution target. Use `sourceAlias`, never the confidential file name. Derive manifest counts and hashes using canonical metadata.

- [ ] **Step 4: Verify and commit.** Run snapshot, validation, and query tests, and verify `git ls-files` contains no workbook. Commit:

```powershell
git add packages/knowledge-base/src/interpretation
git commit -m "feat: publish interpretation rules v1 snapshot"
```

### Task 5: Register Governance and Future Consumers

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `docs/governance/data-classification.md`
- Modify: `docs/governance/feature-register.md`
- Modify: `README.md`

- [ ] **Step 1: Write failing governance tests.** Require F0 dependencies/checks for `interpretation-rules-v1`; require F5/F6 to list it while remaining `unavailable`; preserve F0 classification and existing dependencies.

- [ ] **Step 2: Run the test and verify RED.** Run `npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts`. Expected: FAIL because the dependency is unregistered.

- [ ] **Step 3: Update governance and docs.** Register the sibling module. Document generalized entries as `internal`, source workbooks/examples and eventual F5 output as `confidential`, and all three F0 APIs as independent. State that F5/F6 remain unavailable.

- [ ] **Step 4: Verify and commit.** Run governance tests and `npm run check:repository`; expected PASS. Commit:

```powershell
git add packages/governance/src/feature-register.ts packages/governance/src/policy-gate.test.ts docs/governance/data-classification.md docs/governance/feature-register.md README.md
git commit -m "docs: govern F0 interpretation rules"
```

### Task 6: Complete Repository Regression Verification

**Files:**
- Verify only; modify only a directly related file if a command exposes an introduced defect.

- [ ] **Step 1: Run focused F0 regression.**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/knowledge-base/src/knowledge-base.test.ts packages/knowledge-base/src/internal/validation.test.ts packages/knowledge-base/src/internal/query.test.ts packages/knowledge-base/src/interpretation/validation.test.ts packages/knowledge-base/src/interpretation/query.test.ts packages/knowledge-base/src/interpretation/data/interpretation-rules-v1.test.ts packages/governance/src/policy-gate.test.ts
```

Expected: PASS, including unchanged public and internal tolerance-guidance tests.

- [ ] **Step 2: Run complete validation.**

```powershell
npm run build -- --force
npm run lint
npm test
npm run check:repository
git diff --check
git ls-files | Select-String '\.(xls|xlsx|xlsm)$'
```

Expected: all validations PASS and the final command returns no tracked workbook path.

- [ ] **Step 3: Confirm scope.** Run `git status --short` and inspect commits. Expected: only contracts, new `interpretation/` files, sibling exports, governance, and documentation changed; existing `internal-v1` data remains untouched.

- [ ] **Step 4: Commit only an in-scope repair.** If Step 2 exposes a defect introduced by Tasks 1-5, commit the minimal fix as `fix: complete interpretation rules verification`; otherwise create no empty commit.

## Plan Self-Review

- Tasks 1-4 cover the v1 release-review subset across every required knowledge type, source evidence, immutable snapshot, deterministic query, target precedence, insufficient facts, hypotheses, and unranked options.
- Tasks 3, 5, and 6 preserve `public/v1`, `internal-v1`, the 110-entry baseline, and F5/F6 unavailable states.
- Task 4 excludes worked examples and calculators from production while retaining source-register evidence; it does not promise or fabricate a contribution performance rule.
- Tasks 5-6 enforce the `internal`/`confidential` boundary and verify no workbook is tracked.
- Function names, version literals, statuses, and DTO fields are consistent across tasks; no implementation placeholder remains.