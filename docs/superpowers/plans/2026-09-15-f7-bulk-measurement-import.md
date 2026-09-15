# F7 Bulk Measurement Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a worksheet-bound Excel template that imports ready measured datasets for every confirmed F7 Factor atomically while preserving individual Factor entry and workspace access.

**Architecture:** Shared strict contracts define the manifest, diagnostics, preview, and commit boundary. `workbook-catalog` generates and defensively parses a controlled OOXML workbook; the local API owns server-held template/preview authority and delegates one revision-checked snapshot replacement to `F7SessionService`; Vue adds a top-level bulk/individual entry surface over the existing canonical Factor state.

**Tech Stack:** TypeScript, Zod, Vue 3, Vitest, `fflate`, controlled OOXML, Node HTTP, Playwright

---

## File Structure

### Stage 1: Contracts and controlled Excel

- Modify `packages/contracts/src/f7-contracts.ts`: optional governed Factor traceability plus strict bulk template, diagnostic, preview, commit, and service schemas/types.
- Modify `packages/contracts/src/f7-contracts.test.ts`: contract bounds, strictness, aggregate, and traceability tests.
- Modify `packages/workbook-catalog/src/factor-header-resolver.ts` and test: resolve optional Part Number and exact Factor LSL/USL headers without conflating Part Name, Drawing Number, or response limits; reuse `dimCharacteristicId` for DIM ID.
- Modify `packages/workbook-catalog/src/f7-excel-adapter.ts` and test: carry optional Part Number, DIM ID, and controlled Factor limit source into confirmed evidence without changing Factor identity hashes.
- Create `packages/workbook-catalog/src/f7-measurement-template.ts`: versioned coordinates, digest helpers, authority builder, and physical-limit status.
- Create `packages/workbook-catalog/src/f7-measurement-template.test.ts`: digest, limits, and authority tests.
- Create `packages/workbook-catalog/src/f7-measurement-template-writer.ts` and test: deterministic protected OOXML generation.
- Create `packages/workbook-catalog/src/f7-measurement-template-parser.ts` and test: fixed-coordinate parse, tamper detection, diagnostics, and existing dataset projection.
- Modify `packages/workbook-catalog/src/index.ts`: export the new pure APIs and types.

### Stage 2: Session service and local API

- Modify `apps/f7-local-api/src/f7-session-service.ts` and test: private measurement-import revision, authority projection, preview batch validation, and synchronous atomic commit.
- Create `apps/f7-local-api/src/f7-measurement-import-registry.ts` and test: bounded template authority, preview generations, expiry, and one-time atomic claim.
- Modify `apps/f7-local-api/src/server.ts` and test: XLSX download, preview, and commit routes.
- Modify `apps/f7-local-api/src/main.ts`: create and inject one process-local registry.
- Modify `apps/f7-local-api/src/index.ts`: export registry construction for tests.

### Stage 3: Web and acceptance

- Modify `apps/f7-web/src/api/f7-client.ts` and test: binary template download and strict preview/commit calls.
- Modify `apps/f7-web/src/state/f7-session.ts` and test: preview lifecycle, busy actions, cancellation, and commit refresh.
- Create `apps/f7-web/src/components/MeasurementImportPanel.vue` and test: layout A controls, review, diagnostics, warnings, and overwrite confirmation.
- Modify `apps/f7-web/src/components/FactorInputTable.vue` and test: show canonical Source Mode status in Import Data view and editable radios only in Enter Individually view.
- Modify `apps/f7-web/src/App.vue` and test: top-level mode ownership and event wiring.
- Modify `apps/f7-web/src/style.css`: restrained responsive import/review styling.
- Create `test/f8-e2e/f7-bulk-measurement-import.spec.ts`: real download, upload, warning, rejection, overwrite, atomic commit, mode switch, and workspace acceptance.
- Create `test/f8-e2e/fixtures/f7-bulk-measurement-import.ts`: ignored-runtime fixture helpers that edit generated templates without committing generated `.xlsx` output.

## Stage 1 - Contracts And Controlled Excel

### Task 1: Add governed Factor traceability

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `packages/contracts/src/f7-contracts.test.ts`
- Modify: `packages/workbook-catalog/src/factor-header-resolver.ts`
- Modify: `packages/workbook-catalog/src/factor-header-resolver.test.ts`
- Modify: `packages/workbook-catalog/src/f7-excel-adapter.ts`
- Modify: `packages/workbook-catalog/src/f7-excel-adapter.test.ts`

- [x] **Step 1: Write failing resolver, contract, and adapter tests**

Add a resolver case with headers `Factor Description`, `Part Number`, `DIM ID`, `Factor LSL`, and `Factor USL`. Assert optional traceability and explicit physical limits survive candidate extraction and confirmation. Assert missing Factor limit columns use normalized nominal/tolerance endpoints with source `Derived`; exact controlled Factor LSL/USL columns use source `Worksheet`; response-level `LSL`/`USL` labels elsewhere are never treated as Factor columns. Absent traceability and user-added Factors omit Part Number/DIM ID. Assert changing display traceability does not change `factorCandidateId` or `factorId`.

```ts
expect(result.columns).toMatchObject({
  partNumber: { sourceColumn: "B", headerText: "Part Number" },
  dimCharacteristicId: { sourceColumn: "C", headerText: "DIM ID" },
  factorLowerSpecLimit: { sourceColumn: "G", headerText: "Factor LSL" },
  factorUpperSpecLimit: { sourceColumn: "H", headerText: "Factor USL" },
});
expect(setup.factors[0]).toMatchObject({
  partNumber: "PN-1042",
  dimId: "307",
  specificationSource: "Worksheet",
  lowerSpecLimit: 0.52,
  upperSpecLimit: 0.62,
});
```

- [x] **Step 2: Run tests and verify RED**

Run:

```powershell
npx.cmd vitest run --project node packages/contracts/src/f7-contracts.test.ts packages/workbook-catalog/src/factor-header-resolver.test.ts packages/workbook-catalog/src/f7-excel-adapter.test.ts
```

Expected: FAIL because traceability, exact Factor limit semantics, and specification source do not exist.

- [x] **Step 3: Implement minimal optional traceability**

Add `partNumber`, `factorLowerSpecLimit`, and `factorUpperSpecLimit` to `FACTOR_FIELD_ORDER`. Use aliases `part number`, `part no`, and `part no.` only for Part Number, and exact aliases `factor lsl`/`factor lower spec limit` and `factor usl`/`factor upper spec limit` only for physical Factor limits. Add bounded optional `partNumber` and `dimId` strings plus optional backward-compatible `specificationSource: "Worksheet" | "Derived"` to candidate/evidence schemas. Existing evidence without the field behaves as `Derived`.

In extraction, require Factor LSL and USL columns as a pair, finite values, `0 <= LSL < USL`, and controlled source cells. Preserve those values with source `Worksheet`; otherwise derive both physical limits from signed nominal/tolerance endpoints with source `Derived`. `confirmF7FactorSetup()` retains explicit worksheet limits when present and otherwise performs the current normalization. Update the evidence super-refinement to require normalized endpoints only for Derived/legacy evidence and to require controlled Factor-limit source cells for Worksheet evidence. Do not include traceability, limit source, or displayed limits in `buildCandidateId()` or `buildFactorId()`.

```ts
const optionalTraceabilityFields = {
  partNumber: z.string().trim().min(1).max(300).optional(),
  dimId: z.string().trim().min(1).max(300).optional(),
  specificationSource: z.enum(["Worksheet", "Derived"]).optional(),
} as const;
```

- [x] **Step 4: Run tests and verify GREEN**

Run the Step 2 command.

Expected: PASS with existing extraction and factor identity tests unchanged.

- [x] **Step 5: Commit**

```powershell
git add packages/contracts/src/f7-contracts.ts packages/contracts/src/f7-contracts.test.ts packages/workbook-catalog/src/factor-header-resolver.ts packages/workbook-catalog/src/factor-header-resolver.test.ts packages/workbook-catalog/src/f7-excel-adapter.ts packages/workbook-catalog/src/f7-excel-adapter.test.ts
git commit -m "feat(f7): preserve factor import traceability"
```

### Task 2: Define bulk-import contracts

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `packages/contracts/src/f7-contracts.test.ts`

- [ ] **Step 1: Write failing strict-schema tests**

Cover a valid 2-Factor manifest, ready and blocked previews, bounded diagnostics, exact aggregate counts, duplicate Factor rejection, 101 Factors, 501 observations, unknown fields, non-finite values, invalid structure/config combinations, mismatched replacement IDs, and `confirmed !== true`.

```ts
expect(f7MeasurementImportPreviewResponseSchema.parse(preview)).toMatchObject({
  status: "ready",
  factorCount: 2,
  replacementFactorIds: [],
});
expect(() => f7MeasurementImportManifestSchema.parse({
  ...manifest,
  factors: Array.from({ length: 101 }, () => manifest.factors[0]),
})).toThrow();
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx.cmd vitest run --project node packages/contracts/src/f7-contracts.test.ts`

Expected: FAIL because the bulk-import schemas are not exported.

- [ ] **Step 3: Add constants and strict schemas**

Define these public constants and schemas in `f7-contracts.ts`, next to existing measurement contracts:

```ts
export const F7_MEASUREMENT_IMPORT_TEMPLATE_CONTRACT_ID = "f7-measurement-import-template-v1";
export const F7_MEASUREMENT_IMPORT_MAX_FACTORS = 100;
export const F7_MEASUREMENT_IMPORT_MAX_DIAGNOSTICS = 2_000;

export const f7MeasurementImportDiagnosticReasonSchema = z.enum([
  "invalid_template_identity", "stale_template", "changed_locked_cell",
  "missing_factor", "extra_factor", "duplicate_factor", "invalid_enum",
  "missing_structure_configuration", "incomplete_subgroup",
  "non_finite_measurement", "negative_physical_measurement",
  "sample_validation_failure", "unsupported_workbook_content",
]);
```

Add strict schemas/types for `F7MeasurementImportFactorManifest`, `F7MeasurementImportManifest`, `F7MeasurementImportAuthority`, `F7MeasurementImportDiagnostic`, `F7MeasurementImportFactorPreview`, `F7MeasurementImportPreviewRequest/Response`, stored batch projection, `F7MeasurementImportCommitRequest`, and route envelopes. Reuse `f7MeasurementDatasetSchema`, `f7DatasetValidationResultSchema`, and the existing 500-observation constant. Super-refine counts, unique ordered Factor IDs, ready/blocked consistency, and exact replacement sets.

- [ ] **Step 4: Run the contract test and verify GREEN**

Run: `npx.cmd vitest run --project node packages/contracts/src/f7-contracts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/f7-contracts.ts packages/contracts/src/f7-contracts.test.ts
git commit -m "feat(f7): define bulk measurement import contracts"
```

### Task 3: Build manifest authority and deterministic layout

**Files:**
- Create: `packages/workbook-catalog/src/f7-measurement-template.ts`
- Create: `packages/workbook-catalog/src/f7-measurement-template.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write failing authority tests**

Assert fixed coordinates, ordered Factor columns beginning at `B`, first measurement row, 500 reserved rows, cross-zero status, Part Number/DIM ID blank handling, and stable domain-separated SHA-256 digests. Assert order, unit, specifications, workbook hash, worksheet, or revision changes the appropriate digest.

```ts
expect(layout).toMatchObject({
  visibleSheetName: "Measurements",
  manifestSheetName: "_F7_MANIFEST",
  firstFactorColumn: 2,
  measurementCapacity: 500,
});
expect(authority.manifest.factors[0]).toMatchObject({
  factorName: "HAF thickness",
  lowerSpecLimit: 0,
  limitStatus: "CROSSES_ZERO",
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx.cmd vitest run --project node packages/workbook-catalog/src/f7-measurement-template.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure layout, limits, and digest helpers**

Export `F7_MEASUREMENT_TEMPLATE_LAYOUT`, `createF7MeasurementImportAuthority()`, `hashF7MeasurementFactorSet()`, and `hashF7MeasurementSessionState()`. Use `createHash("sha256")` with length-prefixed UTF-8 fields and explicit domains. Authority input contains only validated workbook identity, selected worksheet, private revision, template ID, and confirmed evidence.

```ts
const FACTOR_SET_HASH_DOMAIN = "f7-measurement-factor-set-v1";
const SESSION_STATE_HASH_DOMAIN = "f7-measurement-session-state-v1";

export const F7_MEASUREMENT_TEMPLATE_LAYOUT = Object.freeze({
  visibleSheetName: "Measurements",
  manifestSheetName: "_F7_MANIFEST",
  firstFactorColumn: 2,
  measurementCapacity: F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS,
});
```

Treat the already-confirmed evidence LSL/USL as authoritative. Compute `CROSSES_ZERO` only from signed nominal/tolerance endpoints and assert it agrees with confirmed physical limits.

- [ ] **Step 4: Run the test and verify GREEN**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f7-measurement-template.ts packages/workbook-catalog/src/f7-measurement-template.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat(f7): build measurement template authority"
```

### Task 4: Generate the protected Excel template

**Files:**
- Create: `packages/workbook-catalog/src/f7-measurement-template-writer.ts`
- Create: `packages/workbook-catalog/src/f7-measurement-template-writer.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write failing OOXML writer tests**

Generate twice from the same manifest and assert identical bytes. Read the output through `readSafeZip()` and `readOoxmlWorkbook()`. Assert `Measurements` is visible, `_F7_MANIFEST` is `veryHidden`, locked rows and 500 measurement rows exist, enum data validations exist, warning styles mark cross-zero Factors, and formulas/macros/external links are absent.

```ts
const first = generateF7MeasurementTemplate(manifest);
const second = generateF7MeasurementTemplate(manifest);
expect(first).toEqual(second);
expect(workbook.worksheets.map(({ name, state }) => ({ name, state }))).toEqual([
  { name: "Measurements", state: "visible" },
  { name: "_F7_MANIFEST", state: "veryHidden" },
]);
```

- [ ] **Step 2: Run the writer test and verify RED**

Run: `npx.cmd vitest run --project node packages/workbook-catalog/src/f7-measurement-template-writer.test.ts`

Expected: FAIL because the writer does not exist.

- [ ] **Step 3: Implement the minimal deterministic OOXML package**

Use the package's existing `fflate` dependency and deterministic timestamps. Generate only required content types, root/workbook relationships, workbook, styles, and two worksheets. Use inline strings, XML escaping, worksheet protection, locked/unlocked styles, list validations, freeze panes, filters only where required, and a fixed ZIP entry order. Do not use the root `xlsx` devDependency.

```ts
export function generateF7MeasurementTemplate(
  input: F7MeasurementImportManifest,
): Uint8Array {
  const manifest = f7MeasurementImportManifestSchema.parse(input);
  return zipSync(buildTemplateParts(manifest), { level: 6, mtime: FIXED_ZIP_DATE });
}
```

- [ ] **Step 4: Run writer and security regressions**

Run:

```powershell
npx.cmd vitest run --project node packages/workbook-catalog/src/f7-measurement-template-writer.test.ts packages/workbook-catalog/src/ooxml-reader.test.ts packages/workbook-catalog/src/zip-security.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbook-catalog/src/f7-measurement-template-writer.ts packages/workbook-catalog/src/f7-measurement-template-writer.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat(f7): generate measurement import template"
```

### Task 5: Parse and validate completed templates

**Files:**
- Create: `packages/workbook-catalog/src/f7-measurement-template-parser.ts`
- Create: `packages/workbook-catalog/src/f7-measurement-template-parser.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write failing parser tests**

Create completed templates for all three structures. Assert physical Excel rows are preserved; ordered sequence is assigned `1..n`; rational subgroup labels are contiguous full blocks; zero is accepted; blank cells are ignored; and diagnostics sort by Factor then row. Cover stale/wrong manifest, changed locked cells, renamed/deleted sheets, missing/extra/duplicate Factors, invalid enum/config, incomplete subgroup, formula/date/boolean/error/string/non-finite/negative measurement cells, macros, external links, embedded content, and nonblank content outside the 500-cell area.

```ts
expect(result.status).toBe("ready");
expect(result.datasets[1]?.observations.slice(0, 2)).toMatchObject([
  { originalRow: firstMeasurementRow, sequence: "1", value: 1.01 },
  { originalRow: firstMeasurementRow + 1, sequence: "2", value: 1.02 },
]);
expect(blocked.diagnostics[0]).toMatchObject({
  reason: "negative_physical_measurement",
  factorId,
  cell: `B${firstMeasurementRow + 1}`,
  value: -0.003,
});
```

- [ ] **Step 2: Run the parser test and verify RED**

Run: `npx.cmd vitest run --project node packages/workbook-catalog/src/f7-measurement-template-parser.test.ts`

Expected: FAIL because the parser does not exist.

- [ ] **Step 3: Implement defensive fixed-coordinate parsing**

Call `readSafeZip()` first, enforce an explicit OOXML part allowlist, then call `readOoxmlWorkbook()`. Read the hidden template ID before selecting server authority, but trust only the registry-provided authority. Compare every immutable cell with the manifest digest. Build existing `F7MeasurementDataset` values directly so Excel `originalRow` is retained, then parse through `f7MeasurementDatasetSchema` and `validateF7MeasurementDataset()`.

```ts
export type F7MeasurementTemplateParseResult =
  | { readonly status: "ready"; readonly datasets: readonly F7MeasurementDataset[] }
  | { readonly status: "blocked"; readonly diagnostics: readonly F7MeasurementImportDiagnostic[] };

export function parseF7MeasurementTemplate(
  bytes: Uint8Array,
  authority: F7MeasurementImportAuthority,
  importedAt: string,
): F7MeasurementTemplateParseResult;
```

Malformed nonblank cells become blocking diagnostics, never silent rejection summaries. Out-of-spec nonnegative values remain observations and add advisory counts outside this parser result. Cap diagnostics at 2,000 deterministically.

- [ ] **Step 4: Run focused Stage 1 tests and verify GREEN**

Run:

```powershell
npx.cmd vitest run --project node packages/contracts/src/f7-contracts.test.ts packages/workbook-catalog/src/factor-header-resolver.test.ts packages/workbook-catalog/src/f7-excel-adapter.test.ts packages/workbook-catalog/src/f7-measurement-template.test.ts packages/workbook-catalog/src/f7-measurement-template-writer.test.ts packages/workbook-catalog/src/f7-measurement-template-parser.test.ts packages/workbook-catalog/src/f7-measurement-parser.test.ts packages/workbook-catalog/src/f7-dataset-validation.test.ts packages/workbook-catalog/src/ooxml-reader.test.ts packages/workbook-catalog/src/zip-security.test.ts
```

Expected: PASS.

- [ ] **Step 5: Build package outputs and commit**

Run: `npm.cmd run build -- --force`

Expected: TypeScript build succeeds. Do not stage generated `dist` files if the repository ignores them.

```powershell
git add packages/workbook-catalog/src/f7-measurement-template-parser.ts packages/workbook-catalog/src/f7-measurement-template-parser.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat(f7): parse measurement import templates"
```

## Stage 2 - Session Service And Local API

### Task 6: Add private revision and atomic batch commit

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `apps/f7-local-api/src/f7-session-service.ts`
- Modify: `apps/f7-local-api/src/f7-session-service.test.ts`

- [ ] **Step 1: Write failing service tests**

Assert initial authority revision `0`; worksheet confirmation, Factor confirmation, individual paste, disposition, and successful bulk commit increment it; distribution fit/approval and Monte Carlo do not. Assert a two-Factor candidate is applied in one operation. Revision mismatch, duplicate/missing Factor, blocked validation, injected synchronous failure, and stale Factor set must preserve `JSON.stringify(previousSnapshot)` exactly.

```ts
const before = service.getSession(sessionId);
expect(() => service.commitMeasurementImport({
  sessionId,
  expectedMeasurementImportRevision: revision - 1,
  factors: readyFactors,
})).toThrow();
expect(service.getSession(sessionId)).toEqual(before);
```

- [ ] **Step 2: Run the service test and verify RED**

Run: `npx.cmd vitest run --project node apps/f7-local-api/src/f7-session-service.test.ts`

Expected: FAIL because authority and batch commit methods do not exist.

- [ ] **Step 3: Extend the service contract and internal session**

Add service request types and methods:

```ts
export interface F7SessionService {
  // existing methods remain unchanged
  getMeasurementImportAuthority(request: {
    sessionId: string;
    templateId: string;
  }): F7MeasurementImportAuthority;
  commitMeasurementImport(request: F7MeasurementImportCommitMutation): F7SessionSnapshot;
}
```

Add `measurementImportRevision: number` to private `InternalSession`, never to `F7SessionSnapshot`. Preserve it in `writeSession()` calls and increment only for authority/dataset-changing mutations.

- [ ] **Step 4: Implement synchronous compare-and-swap commit**

Construct and validate a complete cloned candidate snapshot before one `sessions.set()` call. Require exactly the current confirmed Factor set, ready validation, matching units and IDs, and exact replacement metadata. Populate `input.mode`, `input.dataset`, `measurementPasteResult`, and `datasetValidation` so existing `readyForPhaseOne()` and `FactorInputTable` work without special bulk state.

```ts
if (current.measurementImportRevision !== request.expectedMeasurementImportRevision) {
  throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready", { reasonCode: "stale_measurement_import" });
}
const candidateSnapshot = normalizeSnapshot(buildBulkCandidate(current.snapshot, request.factors));
writeSession(request.sessionId, {
  ...current,
  measurementImportRevision: current.measurementImportRevision + 1,
  snapshot: candidateSnapshot,
});
```

- [ ] **Step 5: Run tests and commit**

Run the Step 2 command.

Expected: PASS.

```powershell
git add packages/contracts/src/f7-contracts.ts apps/f7-local-api/src/f7-session-service.ts apps/f7-local-api/src/f7-session-service.test.ts
git commit -m "feat(f7): commit measurement batches atomically"
```

### Task 7: Implement bounded template and preview registry

**Files:**
- Create: `apps/f7-local-api/src/f7-measurement-import-registry.ts`
- Create: `apps/f7-local-api/src/f7-measurement-import-registry.test.ts`
- Modify: `apps/f7-local-api/src/index.ts`

- [ ] **Step 1: Write failing registry tests with a fake clock and ID source**

Cover CSPRNG-shape IDs from injected `createId`, one authoritative template per session generation, 10-minute expiry, newer-preview invalidation, global and per-session eviction, session ownership, one-time `available -> claimed`, two concurrent claim attempts with one winner, and fresh-registry restart invalidation.

```ts
const first = registry.claimPreview({ sessionId, previewId });
expect(first.status).toBe("claimed");
expect(registry.claimPreview({ sessionId, previewId })).toEqual({ status: "consumed" });
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx.cmd vitest run --project node apps/f7-local-api/src/f7-measurement-import-registry.test.ts`

Expected: FAIL because the registry module does not exist.

- [ ] **Step 3: Implement synchronous bounded state transitions**

Export `createF7MeasurementImportRegistry({ now, createId })`. Keep server-held template authorities and parsed preview batches in private Maps. Use a session generation counter and claim records synchronously before any commit call. Set capacities as named exported constants and evict oldest records deterministically.

```ts
export const F7_MEASUREMENT_IMPORT_PREVIEW_TTL_MS = 10 * 60 * 1_000;
export const MAX_F7_MEASUREMENT_IMPORT_PREVIEWS = 16;
export const MAX_F7_MEASUREMENT_IMPORT_TEMPLATES = 16;
```

- [ ] **Step 4: Run the test and verify GREEN**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/f7-local-api/src/f7-measurement-import-registry.ts apps/f7-local-api/src/f7-measurement-import-registry.test.ts apps/f7-local-api/src/index.ts
git commit -m "feat(f7): govern measurement import previews"
```

### Task 8: Add template download and dry-run preview routes

**Files:**
- Modify: `apps/f7-local-api/src/server.ts`
- Modify: `apps/f7-local-api/src/server.test.ts`
- Modify: `apps/f7-local-api/src/main.ts`

- [ ] **Step 1: Write failing route tests**

Cover `POST /f7/measurements/import-template`, `POST /f7/measurements/import-preview`, exact strict bodies, XLSX attachment headers, sanitized worksheet filename, canonical base64 and existing byte bound, `no-store`, wrong session/template ownership, stale authority, tampering, parser diagnostics, and that preview leaves the session byte-for-byte unchanged.

```ts
expect(download.status).toBe(200);
expect(download.headers["content-type"]).toBe(
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
);
expect(preview.body).toMatchObject({ status: "ready", factorCount: 2 });
expect(service.getSession(sessionId)).toEqual(before);
```

- [ ] **Step 2: Run server tests and verify RED**

Run: `npx.cmd vitest run --project node apps/f7-local-api/src/server.test.ts`

Expected: FAIL with 404 for both routes.

- [ ] **Step 3: Implement bounded download and preview orchestration**

Inject one registry into `createF7LocalServer` and construct it in `main.ts` with `randomBytes(16).toString("hex")`. Download gets current service authority, registers it, generates bytes, and writes an attachment. Preview decodes bytes, extracts the template ID, resolves only server-held authority, re-checks current service digests, parses all Factors, runs existing readiness validation, computes replacement IDs and out-of-spec advisory counts, then stores the ready/blocked projection without mutating the session.

```ts
const MEASUREMENT_IMPORT_TEMPLATE_PATH = "/f7/measurements/import-template";
const MEASUREMENT_IMPORT_PREVIEW_PATH = "/f7/measurements/import-preview";
```

Use uniform error envelopes; never return hidden manifest authority, datasets, or private revision to the browser.

- [ ] **Step 4: Run focused API tests and verify GREEN**

Run:

```powershell
npx.cmd vitest run --project node apps/f7-local-api/src/f7-measurement-import-registry.test.ts apps/f7-local-api/src/f7-session-service.test.ts apps/f7-local-api/src/server.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/f7-local-api/src/server.ts apps/f7-local-api/src/server.test.ts apps/f7-local-api/src/main.ts
git commit -m "feat(f7): preview bulk measurement workbooks"
```

### Task 9: Add one-time commit route

**Files:**
- Modify: `apps/f7-local-api/src/server.ts`
- Modify: `apps/f7-local-api/src/server.test.ts`

- [ ] **Step 1: Write failing commit route tests**

Cover `POST /f7/measurements/import-commit`, `confirmed: true`, exact sorted replacement IDs, blocked previews, expired/stale/wrong-session previews, newer generation, repeated commit, and two overlapping requests. Assert only one succeeds and a service validation error consumes the preview while preserving the prior snapshot.

```ts
expect(success.status).toBe(200);
expect(success.body.snapshot.factors.every((factor) =>
  factor.sourceMode === "MEASURED" && factor.measurementPasteResult?.status === "ready",
)).toBe(true);
expect(repeated.status).toBe(409);
```

- [ ] **Step 2: Run server tests and verify RED**

Run: `npx.cmd vitest run --project node apps/f7-local-api/src/server.test.ts`

Expected: FAIL with 404 for the commit route.

- [ ] **Step 3: Implement claim-before-CAS commit**

Parse the strict request, synchronously claim the preview, compare exact replacement consent, then call `service.commitMeasurementImport()` with the stored private revision and parsed batch. Return the existing `f7-analysis-result-v1` envelope. Map expired/stale/consumed previews to stable 409 envelopes; leave candidate validation as 400 and unexpected failures as 500.

```ts
const MEASUREMENT_IMPORT_COMMIT_PATH = "/f7/measurements/import-commit";
const claimed = registry.claimPreview({ sessionId, previewId });
if (claimed.status !== "claimed") throw stalePreviewError(claimed.status);
```

- [ ] **Step 4: Run Stage 2 tests and build**

Run:

```powershell
npx.cmd vitest run --project node apps/f7-local-api/src/f7-measurement-import-registry.test.ts apps/f7-local-api/src/f7-session-service.test.ts apps/f7-local-api/src/server.test.ts
npm.cmd run build -- --force
```

Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/f7-local-api/src/server.ts apps/f7-local-api/src/server.test.ts
git commit -m "feat(f7): commit measurement imports once"
```

## Stage 3 - Web And Acceptance

### Task 10: Add Web client and store lifecycle

**Files:**
- Modify: `apps/f7-web/src/api/f7-client.ts`
- Modify: `apps/f7-web/src/api/f7-client.test.ts`
- Modify: `apps/f7-web/src/state/f7-session.ts`
- Modify: `apps/f7-web/src/state/f7-session.test.ts`

- [ ] **Step 1: Write failing client and store tests**

Assert exact paths/bodies, binary MIME validation and filename extraction, file-to-canonical-base64 preview, strict response parsing, and commit mapping. Store tests cover default null preview, busy actions, success, blocked preview retention, cancellation, upload failure clearing, session-changing mutation clearing, refresh clearing, commit snapshot replacement, and old session preservation on failure.

```ts
expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/f7/measurements/import-preview"), expect.objectContaining({ method: "POST" }));
expect(store.measurementImportPreview.value).toMatchObject({ status: "ready" });
await store.commitMeasurementImport();
expect(store.session.value?.factors[0]?.sourceMode).toBe("MEASURED");
```

- [ ] **Step 2: Run Web tests and verify RED**

Run:

```powershell
npx.cmd vitest run --project f7-web apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/state/f7-session.test.ts
```

Expected: FAIL because client/store methods do not exist.

- [ ] **Step 3: Implement client methods and preview state**

Add `downloadMeasurementTemplate`, `previewMeasurementImport`, and `commitMeasurementImport`. Validate XLSX content type and download bytes; use existing `fileToBase64()` for preview; parse JSON with shared schemas. Add three `BusyAction` values and a readonly preview ref. Only commit calls `commitMutationSnapshot`; preview never changes `session`.

```ts
async function previewMeasurementImport(request: {
  sessionId: string;
  file: File;
}): Promise<F7MeasurementImportPreviewResponse>;
```

Clear preview after cancel, successful commit, workbook/worksheet/Factor confirmation changes, individual paste/disposition, and refresh. Preserve a blocked preview for review; clear stale preview before a new upload begins.

- [ ] **Step 4: Run tests and verify GREEN**

Run the Step 2 command.

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/f7-web/src/api/f7-client.ts apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/state/f7-session.ts apps/f7-web/src/state/f7-session.test.ts
git commit -m "feat(f7): manage measurement import lifecycle"
```

### Task 11: Build layout A and unified result display

**Files:**
- Create: `apps/f7-web/src/components/MeasurementImportPanel.vue`
- Create: `apps/f7-web/src/components/MeasurementImportPanel.test.ts`
- Modify: `apps/f7-web/src/components/FactorInputTable.vue`
- Modify: `apps/f7-web/src/components/FactorInputTable.test.ts`
- Modify: `apps/f7-web/src/App.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/style.css`

- [ ] **Step 1: Write failing component and App tests**

Assert a keyboard-accessible `Import Data` / `Enter Individually` segmented control, default import mode only when no measured dataset exists, worksheet identity and Factor count, icon buttons with accessible names, `.xlsx` file restriction, busy states, review focus, all Factor rows, sample/structure/readiness, cross-zero text plus red styling, cell diagnostics, disabled confirmation for blocked preview, replacement count copy, cancel, success message, and unchanged canonical `Open workspace` actions after commit. In Import Data mode, assert FactorInputTable shows `MEASURED` or `BASELINE_ASSUMPTION` as text and has no Source Mode radios; in Enter Individually mode, assert the current radios and workspace button remain available.

```ts
expect(wrapper.get("[role='tab'][aria-selected='true']").text()).toContain("Import Data");
expect(wrapper.get("[data-import-warning='cross-zero']").text()).toContain("LSL 0");
expect(wrapper.get("[data-confirm-measurement-import]").attributes("disabled")).toBeDefined();
```

- [ ] **Step 2: Run component tests and verify RED**

Run:

```powershell
npx.cmd vitest run --project f7-web apps/f7-web/src/components/MeasurementImportPanel.test.ts apps/f7-web/src/App.test.ts
```

Expected: FAIL because the component and App wiring do not exist.

- [ ] **Step 3: Implement the dedicated import component**

Use Lucide `Download`, `Upload`, `FileSpreadsheet`, `TriangleAlert`, and `CheckCircle2`. Emit `download`, `upload`, `confirm`, `cancel`, and `mode-change`; keep file input reset local. Render review as an unframed section, not nested cards. Associate each diagnostic with Factor name and cell; use text/icon plus red, never color alone. Focus the review heading after preview changes.

```ts
const emit = defineEmits<{
  download: [];
  upload: [file: File];
  confirm: [];
  cancel: [];
  "mode-change": [mode: "import" | "individual"];
}>();
```

- [ ] **Step 4: Wire App and preserve canonical Factor ownership**

Render `MeasurementImportPanel` at measurement-entry level and keep `FactorInputTable` as the only Source Mode/Readiness/Open workspace table. Add a typed `measurementEntryMode: "import" | "individual"` prop to FactorInputTable. The Source Mode cell renders read-only mode text in `import` mode and the existing fieldset/radios in `individual` mode; `Open workspace` remains visible for measured Factors in both modes. App owns only view mode, transient success text, and event forwarding to the store. Switching mode never calls a mutation. After bulk commit, the refreshed existing snapshot drives `MEASURED`, `Ready`, sample count, and workspace access.

- [ ] **Step 5: Run focused Web tests and production build**

Run:

```powershell
npx.cmd vitest run --project f7-web apps/f7-web/src/components/MeasurementImportPanel.test.ts apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/state/f7-session.test.ts apps/f7-web/src/App.test.ts apps/f7-web/src/components/FactorInputTable.test.ts apps/f7-web/src/components/MeasurementPastePanel.test.ts
npm.cmd run build:f7:web
```

Expected: all tests pass and Vite build succeeds without new warnings.

- [ ] **Step 6: Commit**

```powershell
git add apps/f7-web/src/components/MeasurementImportPanel.vue apps/f7-web/src/components/MeasurementImportPanel.test.ts apps/f7-web/src/components/FactorInputTable.vue apps/f7-web/src/components/FactorInputTable.test.ts apps/f7-web/src/App.vue apps/f7-web/src/App.test.ts apps/f7-web/src/style.css
git commit -m "feat(f7): add bulk measurement import workspace"
```

### Task 12: Run real Excel, browser, and regression acceptance

**Files:**
- Create: `test/f8-e2e/f7-bulk-measurement-import.spec.ts`
- Create: `test/f8-e2e/fixtures/f7-bulk-measurement-import.ts`
- Use only ignored runtime output under: `local-test/F7_Test_Finetune_05/`

- [ ] **Step 1: Write the failing browser acceptance test**

Use the existing anonymous workbook fixture. Download the generated template through the UI, then use the root test-only `xlsx` devDependency in the Playwright fixture helper to create controlled completed copies under `local-test/F7_Test_Finetune_05/`; production generation and parsing must not import `xlsx`. Verify:

1. valid complete import for the representative seven Factors;
2. all rows show `MEASURED`, `Ready`, and `Open workspace`;
3. mode switching preserves committed data;
4. one Factor workspace opens after bulk commit;
5. cross-zero displays a red textual warning but permits nonnegative import;
6. a negative cell blocks the complete batch and identifies its Excel cell;
7. overwrite review names the replacement count and requires explicit confirmation.

- [ ] **Step 2: Run focused unit and integration regressions**

Run:

```powershell
npx.cmd vitest run --project node packages/contracts/src/f7-contracts.test.ts packages/workbook-catalog/src/factor-header-resolver.test.ts packages/workbook-catalog/src/f7-excel-adapter.test.ts packages/workbook-catalog/src/f7-measurement-template.test.ts packages/workbook-catalog/src/f7-measurement-template-writer.test.ts packages/workbook-catalog/src/f7-measurement-template-parser.test.ts packages/workbook-catalog/src/f7-measurement-parser.test.ts packages/workbook-catalog/src/f7-dataset-validation.test.ts apps/f7-local-api/src/f7-measurement-import-registry.test.ts apps/f7-local-api/src/f7-session-service.test.ts apps/f7-local-api/src/server.test.ts
npx.cmd vitest run --project f7-web apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/state/f7-session.test.ts apps/f7-web/src/components/MeasurementImportPanel.test.ts apps/f7-web/src/components/FactorInputTable.test.ts apps/f7-web/src/components/MeasurementPastePanel.test.ts apps/f7-web/src/App.test.ts
```

Expected: all pass.

- [ ] **Step 3: Run workspace validation**

Run:

```powershell
npm.cmd run build -- --force
npm.cmd run lint
npm.cmd run test
```

Expected: build, lint, and all Vitest projects pass. If unrelated pre-existing failures occur, record their exact command/output and do not modify unrelated modules.

- [ ] **Step 4: Start the feature worktree and run Playwright**

From `.worktrees/f7-bulk-measurement-import`, start the long-running server:

```powershell
npm.cmd run dev:f7
```

Wait for API `127.0.0.1:4317` and Web `127.0.0.1:5177`, then run:

```powershell
npx.cmd playwright test test/f8-e2e/f7-bulk-measurement-import.spec.ts
```

Expected: all acceptance scenarios pass in Edge. Capture desktop and mobile screenshots and verify no overlap, clipping, blank upload state, or unreadable diagnostic text.

- [ ] **Step 5: Verify repository hygiene**

Run:

```powershell
git diff --check
git status --short
```

Expected: no generated `.xlsx`, screenshots, PDFs, `.js`, `.map`, `dist`, or files under `local-test/F7_Test_Finetune_05/` are staged. Only intended source/test/plan files may remain.

- [ ] **Step 6: Commit E2E coverage and push**

```powershell
git add test/f8-e2e/f7-bulk-measurement-import.spec.ts test/f8-e2e/fixtures/f7-bulk-measurement-import.ts
git commit -m "test(f7): cover bulk measurement import flow"
git push
git status --short --branch
```

Expected: `User/Ralf/F7_Bulk_Measurement_Import` matches its remote and the tracked worktree is clean.
