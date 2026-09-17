# F0 TA Process Requirements v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish immutable v3 P0-P3 reference definitions and structured automatic priority recommendations with governed transcription provenance.

**Architecture:** Extend the process-requirements contracts with controlled component categories, priority recommendation output, and workbook/transcription provenance variants. Build v3 from a fresh v2 seed, then keep recommendation policy in the F0 evaluator while migrating exact-version consumers to v3.

**Tech Stack:** TypeScript, Zod, Vitest, npm workspaces

---

### Task 1: Extend contracts and provenance

**Files:**
- Modify: `packages/contracts/src/process-requirements-contracts.ts`
- Test: `packages/contracts/src/process-requirements-contracts.test.ts`

- [ ] Add failing tests for v3, controlled component category arrays, both provenance variants, and priority recommendation output.
- [ ] Run `node node_modules/vitest/vitest.mjs run --project node packages/contracts/src/process-requirements-contracts.test.ts` and verify the new assertions fail.
- [ ] Add the minimal schemas and inferred types.
- [ ] Rerun the same test and verify it passes.

### Task 2: Validate structured facts and transcription provenance

**Files:**
- Modify: `packages/knowledge-base/src/process-requirements/validation.ts`
- Test: `packages/knowledge-base/src/process-requirements/validation.test.ts`

- [ ] Add failing validation tests for category predicates, duplicate categories, and source/provenance locator mismatches.
- [ ] Run the focused validation test and verify failure.
- [ ] Add fact mapping and discriminated provenance checks.
- [ ] Rerun the focused validation test and verify it passes.

### Task 3: Publish immutable v3 data

**Files:**
- Create: `packages/knowledge-base/src/process-requirements/data/process-requirements-v3.ts`
- Create: `packages/knowledge-base/src/process-requirements/data/process-requirements-v3.test.ts`
- Modify: `packages/knowledge-base/src/index.ts`

- [ ] Add a failing seed test that imports the new factory and checks definitions, mappings, hashes, and v2 immutability.
- [ ] Run the seed test and verify the missing export fails.
- [ ] Implement the v3 seed from a fresh v2 clone, add approved-transcription source metadata, four definitions, category recommendation entries, and recomputed hashes.
- [ ] Rerun the seed test and record deterministic hashes in its locked expectations.

### Task 4: Evaluate priority recommendations

**Files:**
- Modify: `packages/knowledge-base/src/process-requirements/query.ts`
- Test: `packages/knowledge-base/src/process-requirements/query.test.ts`

- [ ] Add failing tests for exact v3 loading, each priority, multiple-category precedence, complete matched evidence, and absent categories.
- [ ] Run the focused query test and verify failure.
- [ ] Add v3 dispatch, array membership matching, and recommendation resolution ordered P0 through P3.
- [ ] Rerun the focused query test and verify it passes.

### Task 5: Migrate exact-version consumers

**Files:**
- Modify: `packages/workflow-runners/src/f0.ts`
- Modify: `packages/workflow-runners/src/types.ts`
- Test: `packages/workflow-runners/src/f0.test.ts`
- Modify: `apps/f7-web/src/f0-process-guidance.ts`
- Test: `apps/f7-web/src/f0-process-guidance.test.ts`
- Test: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [ ] Change tests to expect exact v3 and verify v2/mixed provenance fails closed.
- [ ] Run focused F0 and F7 tests and verify failure.
- [ ] Migrate production constants and dependency types to v3 without duplicating category policy.
- [ ] Rerun focused F0 and F7 tests and verify they pass.

### Task 6: Verify the release

**Files:**
- Verify all modified files.

- [ ] Run focused Node and F7 suites.
- [ ] Run `node node_modules/typescript/bin/tsc -b --force --pretty false`.
- [ ] Run ESLint on all changed TypeScript files.
- [ ] Run `git diff --check` and review the final diff against the design.
- [ ] Record unrelated full-suite baseline failures without modifying their code.
