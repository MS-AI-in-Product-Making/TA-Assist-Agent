# F0 Internal Tolerance Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a read-only, versioned `internal-v1` F0 library that identifies TA tolerances exceeding an approved maximum total tolerance band and returns source evidence for a future F2 consumer.

**Architecture:** The anonymous `public/v1` library remains unchanged. A separately validated internal snapshot stores reviewed rules plus source hashes and locations, never raw workbook bytes. A maintenance-only SheetJS importer converts approved `.xls`/`.xlsx` bytes into candidate rules; the runtime API normalizes to a total band, performs deterministic exact/fallback matching, and returns only `within-guidance`, `guidance-exceeded`, or `unknown/T0`.

**Tech Stack:** TypeScript ES2024/NodeNext, Zod v3, Vitest v3, Node crypto, SheetJS `xlsx` v0.18.5.

**Design:** [2026-07-28-f0-internal-tolerance-guidance-design.md](../specs/2026-07-28-f0-internal-tolerance-guidance-design.md)

---

## Preconditions

- The six original matrices remain in an access-controlled internal document library. Current `.gitignore`, repository verification, and data-classification rules prohibit tracking raw Excel files.
- A knowledge steward supplies each source as maintenance-command bytes and provides the approved workbook/sheet/header mapping.
- This work provides F2's dependency only; F2 remains unavailable and no TA business workflow is implemented.

## File Structure

- Modify `packages/contracts/src/contracts.ts` and `contracts.test.ts`: strict internal rule, source, manifest, request, and result schemas.
- Create `packages/knowledge-base/src/internal/{types,validation,query,import-capability-matrices}.ts` and focused tests: immutable package loading, guidance assessment, and maintenance import.
- Create `packages/knowledge-base/src/internal/data/internal-v1.ts`: reviewed six-process snapshot with evidence metadata only.
- Modify `packages/knowledge-base/src/index.ts`: internal API exports without changing public-v1 behavior.
- Modify `package.json` and `package-lock.json`: add SheetJS.
- Modify governance and documentation: F0 registration, data classification, feature register, and README.

### Task 1: Define the `internal-v1` Contract

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write failing schema tests.** Import `internalToleranceGuidanceEntrySchema`, `internalToleranceGuidanceRequestSchema`, and `internalToleranceGuidanceResultSchema`. Accept a CNC bilateral request and a `guidance-exceeded` DTO; reject public provenance, unsupported process, a zero threshold, absent evidence range, extra fields, and `pass`, `fail`, `feasible`, or `tooTight` output fields.

- [ ] **Step 2: Verify failure.** Run `npm test -- packages/contracts/src/contracts.test.ts`. Expected: FAIL because the internal schemas are not exported.

- [ ] **Step 3: Implement strict schemas and types.** Add `.strict()` schemas for process families `cnc-machining`, `die-casting`, `die-cutting`, `pcb-fpc`, `plastic-injection-molding`, and `sheet-metal`; tolerance representations `bilateral`, `unilateral`, and `total-band`; and `internal-v1`. Define entries with positive `maximumRecommendedTotalBand`, optional inclusive nominal range in `mm`, integer priority, optional fallback ID, tier `T1|T2|T3`, and `internal` provenance. Define source evidence as file name, SHA-256, sheet name, and `A1:B2`-style range. Export inferred types.

```ts
export const internalEvidenceSchema = z.object({
  sourceFile: z.string().min(1), sourceFileHash: sha256Schema,
  sheetName: z.string().min(1), sourceRange: z.string().regex(/^[A-Z]+[1-9]\d*:[A-Z]+[1-9]\d*$/),
}).strict();
```

- [ ] **Step 4: Verify and commit.** Run `npm test -- packages/contracts/src/contracts.test.ts` and `npm run build -- --force`; both must PASS. Then commit with `git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts` and `git commit -m "feat: define internal tolerance guidance contracts"`.

### Task 2: Create and Validate an Immutable Internal Snapshot

**Files:**
- Create: `packages/knowledge-base/src/internal/types.ts`
- Create: `packages/knowledge-base/src/internal/validation.ts`
- Create: `packages/knowledge-base/src/internal/validation.test.ts`
- Modify: `packages/knowledge-base/src/index.ts`

- [ ] **Step 1: Write failing validation tests.** Create a valid package with a manifest, one source metadata record, two rules, and a hash. Assert `createInternalKnowledgeSnapshot` rejects duplicate IDs, an inverted nominal range, zero threshold, missing fallback target, circular fallback, equal-priority overlap, source-hash mismatch, and non-internal provenance. Assert typed error summaries omit source-file text.

- [ ] **Step 2: Verify failure.** Run `npm test -- packages/knowledge-base/src/internal/validation.test.ts`. Expected: FAIL because the internal validation module does not exist.

- [ ] **Step 3: Implement validation.** Reuse public `canonicalJson` and `contentHash`; do not reuse the public manifest schema. Build hashes from canonical source metadata and rules. Validate schemas, manifest counts/hashes, unique entry/source IDs, version consistency, positive thresholds, nominal bounds, fallback existence/cycles, and equal-priority predicate overlap. Deep-clone and recursively freeze a fully validated package. Throw a typed `validation_error` with summary `Internal tolerance-guidance package is invalid.` and only stable IDs as affected references.

```ts
export function createInternalKnowledgeSnapshot(value: unknown): InternalKnowledgeSnapshot {
  return deepFreeze(structuredClone(validateInternalSeedPackage(value)));
}
```

- [ ] **Step 4: Export and commit.** Export snapshot functions/types from `packages/knowledge-base/src/index.ts`. Run `npm test -- packages/knowledge-base/src/internal/validation.test.ts`; expected PASS. Commit with `git add packages/knowledge-base/src/internal packages/knowledge-base/src/index.ts` and `git commit -m "feat: validate internal tolerance guidance snapshots"`.

### Task 3: Implement Total-Band Guidance Queries

**Files:**
- Create: `packages/knowledge-base/src/internal/query.ts`
- Create: `packages/knowledge-base/src/internal/query.test.ts`
- Modify: `packages/knowledge-base/src/index.ts`

- [ ] **Step 1: Write failing behavior tests.** Use test snapshot rules for an exact CNC hole case, an explicit lower-priority fallback, and a CNC general fallback. Assert `bilateral ±0.08 mm` becomes `0.16 mm`; `0.16 > 0.10` returns `guidance-exceeded`, `0.10` returns `within-guidance`, and unmatched feature, size, unit, or tied best candidate returns the exact `unknown/T0` DTO. Assert no result has feasibility or tightness fields.

- [ ] **Step 2: Verify failure.** Run `npm test -- packages/knowledge-base/src/internal/query.test.ts`. Expected: FAIL because `loadInternalToleranceGuidance` is absent.

- [ ] **Step 3: Implement the read-only API.** `loadInternalToleranceGuidance` accepts only `{ version: "internal-v1" }`. Normalize bilateral as `2 * value`, total-band as `value`, and unilateral as `upperValue - lowerValue`; reject invalid/unrecognized input via typed validation error. Choose only rules with matching process/feature/material and an inclusive size range. Prefer the greatest priority; resolve an explicit fallback only when its target is valid; a highest-priority tie is `unknown/T0`. Deep-freeze a fresh result DTO with source file, sheet, range, and source hash.

```ts
const status = totalBand > entry.maximumRecommendedTotalBand.value
  ? "guidance-exceeded"
  : "within-guidance";
```

- [ ] **Step 4: Verify and commit.** Run `npm test -- packages/knowledge-base/src/internal/query.test.ts packages/knowledge-base/src/knowledge-base.test.ts`; expected PASS with unchanged public-v1 tests. Commit with `git add packages/knowledge-base/src/internal/query.ts packages/knowledge-base/src/internal/query.test.ts packages/knowledge-base/src/index.ts` and `git commit -m "feat: add internal tolerance guidance query"`.

### Task 4: Add the Maintenance-Only Matrix Importer and Reviewed Rules

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `packages/knowledge-base/src/internal/import-capability-matrices.ts`
- Create: `packages/knowledge-base/src/internal/import-capability-matrices.test.ts`
- Create: `packages/knowledge-base/src/internal/data/internal-v1.ts`
- Modify: `packages/knowledge-base/src/internal/validation.ts`

- [ ] **Step 1: Install the parser.** Run `npm install --save-dev xlsx@0.18.5`. Expected: only `package.json` and `package-lock.json` change; no source workbook is added to Git.

- [ ] **Step 2: Write failing importer tests with in-memory anonymous workbooks.** Use `xlsx.utils.aoa_to_sheet` and `xlsx.write` to test one supported row and source range. Reject absent/duplicate headers, merged data cells, blank/non-numeric thresholds, wrong unit labels, blank worksheet, source-hash mismatch, and unapproved source metadata.

- [ ] **Step 3: Verify failure.** Run `npm test -- packages/knowledge-base/src/internal/import-capability-matrices.test.ts`. Expected: FAIL because `importCapabilityMatrix` is absent.

- [ ] **Step 4: Implement fail-closed import.** Accept only `Uint8Array` bytes and approved source metadata, never a path or URL. Require the exact approved headers `Process`, `Feature Type`, `Nominal Min (mm)`, `Nominal Max (mm)`, and `Maximum Recommended Total Band (mm)`; `Material` and `Fallback Entry ID` are optional. Validate source SHA-256 before reading, reject merged data rows and unrecognized values, and produce candidate rules with real worksheet/range evidence. Never invent a missing threshold, unit, feature, process, or fallback.

- [ ] **Step 5: Populate reviewed rules.** Add only steward-reviewed rows from the six matrices to `internal-v1.ts`: CNC, die casting, die cutting, PCB/FPC, plastic injection molding, and sheet metal. Each must contain actual source filename, SHA-256, sheet name, range, and source version. A matrix not unambiguously imported is omitted; related queries must remain `unknown/T0`.

- [ ] **Step 6: Verify and commit.** Run `npm test -- packages/knowledge-base/src/internal/import-capability-matrices.test.ts packages/knowledge-base/src/internal/validation.test.ts packages/knowledge-base/src/internal/query.test.ts`; expected PASS. Commit with `git add package.json package-lock.json packages/knowledge-base/src/internal` and `git commit -m "feat: import internal tolerance capability matrices"`.

### Task 5: Register the Internal Boundary and Complete Verification

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `docs/governance/data-classification.md`
- Modify: `docs/governance/feature-register.md`
- Modify: `README.md`

- [ ] **Step 1: Write failing governance tests.** Require F0 to include `internal-tolerance-guidance-v1`, `internal-tolerance-guidance-integrity-check`, `guidance-only-result-fixture`, and `internal-source-evidence-dto`; assert F0 maximum classification is `internal`, `knowledge-base-v1` remains present, F2 remains unavailable, and no feature enables runtime Excel loading.

- [ ] **Step 2: Verify failure.** Run `npm test -- packages/governance/src/policy-gate.test.ts`. Expected: FAIL because F0 is registered as public-only.

- [ ] **Step 3: Update policy and docs.** Change F0 maximum classification to `internal`; preserve public-v1's public-only rule. Add `approved-internal-knowledge-snapshot` as an external prerequisite. State that reviewed internal snapshots and source hashes can be governed artifacts, while raw `.xls/.xlsx` remains prohibited until a separately approved whitelist is implemented. Document that F2 can display F0 file/sheet/range evidence but remains unavailable.

- [ ] **Step 4: Run all verification and commit.** Run `npm test -- packages/governance/src/policy-gate.test.ts`, `npm run build -- --force`, `npm run lint`, `npm test`, and `npm run check:repository`; every command must PASS and repository verification must still reject tracked Excel paths. Commit with `git add packages/governance/src/feature-register.ts packages/governance/src/policy-gate.test.ts docs/governance/data-classification.md docs/governance/feature-register.md README.md` and `git commit -m "docs: govern internal tolerance guidance"`.

## Plan Self-Review

- Tasks 1-3 cover internal classification, immutable data, total-band conversion, oversized-tolerance-only assessment, safe fallback, T0 handling, and F2-visible source evidence.
- Task 4 covers the six process families and rejects ambiguous source data rather than inventing rules.
- Task 5 preserves the existing raw-Excel Git prohibition, documents the approved data boundary, and runs the complete repository validation suite.