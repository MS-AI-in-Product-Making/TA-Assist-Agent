# F2.3 Non-Blocking Exception Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver F2.3 as a confidential pure service that derives F2.2 signals, validates one engineer-authored candidate per signal, and permits continuation only with complete, valid, unique coverage.

**Architecture:** `@ai-assist/contracts` owns strict request/result schemas and invariants. A new `@ai-assist/workbook-catalog` resolver consumes only a completed F2.2 result, derives canonical source-bound signals itself, and returns a cloned, deeply frozen DTO. Governance enables F2.3; this work adds no persistence, authorization, network, OOXML, F0 lookup, calculation, or workbook writeback.

**Tech Stack:** TypeScript strict ESM, Zod v3, Vitest v3, existing typed-error and immutable-DTO patterns, anonymous in-memory fixtures.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/contracts/src/contracts.ts` | F2.3 schemas and public types. |
| `packages/contracts/src/contracts.test.ts` | Strict parsing and invariant tests. |
| `packages/workbook-catalog/src/exception-resolution.ts` | Pure F2.3 resolver. |
| `packages/workbook-catalog/src/exception-resolution.test.ts` | Resolver, immutability, and export tests. |
| `packages/workbook-catalog/src/index.ts` | Public exports. |
| `packages/governance/src/feature-register.ts` | F2.3 availability registration. |
| `packages/governance/src/policy-gate.test.ts` | Registration regression test. |
| `README.md`, `docs/README.md`, `docs/governance/feature-register.md` | Scope and design/plan links. |

## Contract Decisions

The resolver, never the caller, creates every canonical reference:

```ts
const signalRef = [workbookContentHash, worksheetName, tableId, sourceRow, signalKind].join("|");
```

Use this exact union:

```ts
type ExceptionSignalKind =
  | "tolerance_out_of_library"
  | "tolerance_unable_to_validate"
  | "distribution_mismatch"
  | "distribution_unable_to_validate";
```

Candidates contain only `signalRef`, `recordedBy`, `recordedAt`, and `rationale`; snapshots and source coordinates are derived. The request schema accepts only those four string fields and rejects unknown keys, while the resolver classifies blank recorder/rationale and invalid timestamps as invalid candidates. The stricter accepted-record schema requires non-empty trimmed recorder/rationale and a canonical UTC `YYYY-MM-DDTHH:mm:ss.sssZ` timestamp with a valid `Date.parse` result.

Signal snapshots are strict discriminated branches with `signalKind`, worksheet/table/row/factor binding, and only their corresponding F2.2 evidence: tolerance range/unit, tolerance inability reason, distribution actual/recommended, or distribution inability reason. No raw F1.1 fields, new F0 data, or engineering conclusion is allowed.

Each current signal produces one accepted or pending record. Pending reasons are `missing_candidate`, `duplicate_candidate`, and `invalid_candidate`. Unknown or malformed candidate references increment `invalidCandidateCount` but create no source-bound pending record. `readyToContinue` is true only when pending and invalid counts are both zero.

### Task 1: Define Strict F2.3 Contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write failing schema tests.**

Add anonymous completed F2.2 fixtures with `out_of_library` and `distribution_mismatch` outcomes. Verify a valid request accepts exactly this candidate:

```ts
{
  signalRef: `${contentHash}|Analysis-A|table-a|2|tolerance_out_of_library`,
  recordedBy: "anonymous-engineer",
  recordedAt: "2026-07-27T10:15:30.000Z",
  rationale: "Anonymous evidence reviewed.",
}
```

Reject unknown request/candidate/result keys, public classification, F2.2 `required_fields_not_ready`, local-offset or invalid times, blank recorder/rationale, incompatible snapshots, wrong summary counts, duplicate signal references, accepted/pending overlap, and status/boolean disagreement.

- [ ] **Step 2: Confirm contracts fail before implementation.**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL because F2.3 schemas and public types do not exist.

- [ ] **Step 3: Add strict request, candidate, and signal schemas.**

After `capabilityValidationResultSchema`, define strict signal snapshot branches with `z.discriminatedUnion("signalKind", ...)`. Reuse F2.2 branch schemas only where state is exactly compatible. Define a structural request-candidate schema that contains only four strings, and a stricter accepted-record schema for validated data:

```ts
const exceptionCandidateSubmissionSchema = z.object({
  signalRef: z.string(),
  recordedBy: z.string(),
  recordedAt: z.string(),
  rationale: z.string(),
}).strict();

export const exceptionResolutionRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  capabilityValidation: capabilityValidationResultSchema,
  candidates: z.array(exceptionCandidateSubmissionSchema),
}).strict().superRefine((request, context) => {
  if (request.capabilityValidation.status !== "completed") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "capability validation must be completed", path: ["capabilityValidation", "status"] });
  }
});
```

- [ ] **Step 4: Add result schema and count invariants.**

Add strict accepted and pending records. The accepted record must use the semantic validation rules described above; the pending record receives only a derived snapshot and reason code. Use a result base with confidential classification, F2.2 content hash/F0 version, arrays, and:

```ts
summary: z.object({
  actionableSignalCount: z.number().int().nonnegative(),
  acceptedExceptionCount: z.number().int().nonnegative(),
  pendingExceptionCount: z.number().int().nonnegative(),
  invalidCandidateCount: z.number().int().nonnegative(),
}).strict()
```

Create `readyToContinue`/true and `pendingExceptions`/false branches. In `.superRefine`, ensure counts match arrays, actionable equals accepted plus pending, each accepted/pending reference is unique, the two sets do not overlap, and the ready branch has no pending records or invalid candidates. Export `ExceptionResolutionRequest` and `ExceptionResolutionResult` beside F2.2 types.

- [ ] **Step 5: Re-run focused contracts.**

Run the command from Step 2. Expected: PASS.

### Task 2: Implement the Pure Resolver

**Files:**
- Create: `packages/workbook-catalog/src/exception-resolution.ts`
- Create: `packages/workbook-catalog/src/exception-resolution.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write failing behavior tests from real F2.2 evidence.**

Reuse the anonymous F1.1 fixture helpers from `capability-validation.test.ts`, then call real `createRequiredFieldCheck` and `createCapabilityValidation`; never forge F2.2 output. Cover tolerance out-of-library, tolerance unable, distribution mismatch, and distribution unable. Confirm `not_applicable` adds no signal, identical outcomes in two factor rows require two candidates, and multi-worksheet/table/row fixtures retain source binding.

```ts
expect(createExceptionResolution({ ...request, candidates: completeCandidates })).toMatchObject({
  status: "readyToContinue",
  readyToContinue: true,
  summary: { actionableSignalCount: 2, acceptedExceptionCount: 2, pendingExceptionCount: 0, invalidCandidateCount: 0 },
});

expect(createExceptionResolution({ ...request, candidates: [] })).toMatchObject({
  status: "pendingExceptions",
  pendingExceptions: [{ reasonCode: "missing_candidate" }],
});
```

Test duplicate, unknown, stale, blank-rationale, blank-recorder, malformed-time, and malformed-reference candidates. They must create a non-continuable DTO, not silently overwrite data. Reject non-completed F2.2, public/secret classifications, and unknown request keys as typed errors. Test deep freezing and the built ESM export.

- [ ] **Step 2: Confirm resolver test fails.**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/exception-resolution.test.ts
```

Expected: FAIL because resolver module and public export do not exist.

- [ ] **Step 3: Validate input and derive signals.**

Follow `capability-validation.ts` for safe preliminary classification access, `createTypedError`, `structuredClone`, and cycle-safe recursive freeze. Use:

```ts
const REQUEST_SUMMARY = "Exception resolution request is invalid.";
const POLICY_SUMMARY = "Exception resolution input is not permitted.";

export function createExceptionResolution(request: unknown): ExceptionResolutionResult
```

Explicit non-confidential input throws `policy_denied`; strict schema failure is a validation error. Iterate only `input.capabilityValidation.rows` in source order. Derive a reference/snapshot for every `out_of_library`, tolerance `unable_to_validate`, `distribution_mismatch`, and distribution `unable_to_validate` state. Derive none for `in_library`, `matches_recommendation`, or `not_applicable`.

- [ ] **Step 4: Classify candidates and build derived-only output.**

Map every derived ref to its signal. A reference is accepted only once. A recognized duplicate makes its signal `duplicate_candidate`; a recognized malformed candidate makes it `invalid_candidate`; unknown/malformed references add only to `invalidCandidateCount`. Build snapshots only from the derived list:

```ts
const acceptedExceptions = signals.flatMap((signal) => {
  const candidate = acceptedCandidateBySignal.get(signal.signalRef);
  return candidate === undefined ? [] : [{ ...candidate, snapshot: signal.snapshot }];
});
```

Construct pending records similarly from derived signals. Set ready only when pending and invalid counts are zero. Copy content hash and knowledge-base version only from F2.2. Parse the result schema, clone it, then deep freeze it. Do not import OOXML, F0, a network adapter, audit store, or a clock.

- [ ] **Step 5: Export and re-run resolver tests.**

Add:

```ts
export { createExceptionResolution } from "./exception-resolution.js";
```

to the package index, plus `ExceptionResolutionRequest` and `ExceptionResolutionResult` in its type export list. Run the command from Step 2. Expected: PASS.

### Task 3: Enable F2.3 and Update Documentation

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/governance/feature-register.md`

- [ ] **Step 1: Write failing exact registration test.**

Add a dedicated F2.3 assertion and remove it from unavailable features:

```ts
expect(getFeatureStatus("F2.3")).toEqual({
  featureId: "F2.3",
  title: "非阻断差异例外处理",
  status: "available",
  dependsOn: ["capability-validation-v1", "exception-resolution-v1"],
  inputContractId: "exception-resolution-request-v1",
  outputContractId: "exception-resolution-result-v1",
  maximumClassification: "confidential",
  acceptanceChecks: ["anonymous-exception-resolution-fixture", "exception-resolution-coverage-check", "exception-resolution-privacy-check"],
  externalPrerequisites: ["approved-exception-policy"],
  disableBehavior: "return feature_not_available",
});
```

Keep root F2, F2.4, and F3-F7 unavailable.

- [ ] **Step 2: Confirm governance test fails.**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts
```

Expected: FAIL because F2.3 remains unavailable.

- [ ] **Step 3: Register and document F2.3.**

Replace F2.3's unavailable registration with the exact available object tested above. Update the three documentation surfaces: F2.3 accepts completed F2.2 evidence, derives non-blocking signals, requires exactly one valid exception per signal to continue, and returns only a payload for a later governed runtime.

State explicitly: no F2.1 bypass, F2.2 rerun, F0 reload, unit conversion, engineering feasibility/risk conclusion, identity authentication, persistence, network, OOXML/workbook read, or writeback. Link the approved F2.3 design and this plan using existing relative-link style. Do not claim root F2, F2.4, or F3-F7 are available.

- [ ] **Step 4: Re-run governance tests.**

Run the command from Step 2. Expected: PASS.

### Task 4: Full Regression and Boundary Verification

**Files:**
- Verify: all files in Tasks 1-3

- [ ] **Step 1: Run touched-slice tests.**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/required-field-check.test.ts packages/workbook-catalog/src/capability-validation.test.ts packages/workbook-catalog/src/exception-resolution.test.ts packages/governance/src/policy-gate.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run final repository checks.**

Run the lint, full-test, repository-check, whitespace-check, and tracked-confidential-artifact scan commands already documented in `docs/governance/feature-register.md`.

Expected: lint and repository checks pass. The full suite may reproduce the known unrelated audit-store concurrent audit-root lock failure; record it if present and do not change audit code. The artifact scan must find no tracked confidential workbook or fixture path.

- [ ] **Step 3: Confirm completed boundary.**

Verify F2.3 accepts no workbook bytes, paths, URLs, images, raw external data, persistence target, or identity/auth adapter; never invokes F0/F2.2; derives snapshots only from completed F2.2 output; treats missing/duplicate/invalid candidates as non-continuable; freezes output; and preserves root F2, F2.4, and F3-F7 as unavailable.