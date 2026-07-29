# F2.1 Strict Required-Field Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend F1.1 evidence extraction and add F2.1 so every TA factor row with an unavailable required field blocks downstream processing while Drawing Number and DIM/Characteristic ID remain advisory.

**Architecture:** `@ai-assist/contracts` owns the strict F1.1 field and F2.1 request/result schemas. `@ai-assist/workbook-catalog` continues to extract only workbook evidence and adds a pure `createRequiredFieldCheck` service that consumes a validated F1.1 result without reopening the workbook. Governance exposes `F2.1` as an available subfeature while retaining root `F2`, F2.2-F2.4, and F3-F7 as unavailable.

**Tech Stack:** TypeScript strict ESM, Zod v3, Vitest v3, `fflate`/`@xmldom/xmldom` through the existing F1.1 parser.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/contracts/src/contracts.ts` | Add new F1.1 semantic fields and strict F2.1 request/result schemas and public types. |
| `packages/contracts/src/contracts.test.ts` | Test new semantic fields and F2.1 schema discrimination, strictness, and state invariants. |
| `packages/workbook-catalog/src/worksheet-analysis-assets.ts` | Add controlled F1.1 aliases, numeric parsing, and retention of zero-row recognized tables. |
| `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts` | Verify aliases, duplicate mapping, numeric evidence, and zero-row table retention with anonymous in-memory OOXML. |
| `packages/workbook-catalog/src/required-field-check.ts` | Implement the pure F2.1 strict required-field checker. |
| `packages/workbook-catalog/src/required-field-check.test.ts` | Test blocked/advisory behavior, issue aggregation, privacy-safe reasons, validation, and immutability. |
| `packages/workbook-catalog/src/index.ts` | Export the F2.1 service and its public contract types. |
| `packages/governance/src/feature-register.ts` | Register F2.1 as available without changing root F2 or later features. |
| `packages/governance/src/policy-gate.test.ts` | Lock the exact F2.1 registration and retain unavailable-feature coverage. |
| `README.md`, `docs/README.md`, `docs/governance/feature-register.md` | Document F2.1’s strict evidence-only boundary and link its design/plan. |

### Task 1: Define F1.1 Field and F2.1 Runtime Contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write failing contract tests for new fields and F2.1 results.**

Add imports for `requiredFieldCheckRequestSchema` and `requiredFieldCheckResultSchema`. In the existing `worksheet analysis asset contracts` describe block, add tests that parse all five new F1.1 semantic fields, accept an F2.1 blocked result with a required-field issue and an advisory issue, accept an empty-issue `readyForNextCheck` result, and reject state inconsistencies and unknown keys.

```ts
it("accepts strict F2.1 required-field check contracts", () => {
  const assets = worksheetAnalysisAssetsResultSchema.parse({
    contractVersion: "v1",
    workbook: { classification: "confidential", contentHash, catalogContractVersion: "v1" },
    worksheets: [],
  });
  const request = requiredFieldCheckRequestSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    worksheetAnalysisAssets: assets,
  });

  expect(requiredFieldCheckResultSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "blocked",
    blockingIssues: [{
      issueCode: "required_field_unavailable",
      worksheetName: "Analysis-A",
      tableId: "table-a",
      sourceRow: 12,
      field: "longTermSafetyFactor",
      reasonCode: "missing",
    }],
    advisoryIssues: [{
      issueCode: "optional_identifier_unavailable",
      worksheetName: "Analysis-A",
      tableId: "table-a",
      sourceRow: 12,
      field: "dimCharacteristicId",
      reasonCode: "missing",
    }],
    summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 1, blockingIssueCount: 1, advisoryIssueCount: 1 },
  }).status).toBe("blocked");

  expect(() => requiredFieldCheckResultSchema.parse({
    contractVersion: "v1", inputClassification: "confidential", status: "readyForNextCheck",
    blockingIssues: [{ issueCode: "factor_table_has_no_rows", worksheetName: "Analysis-A", tableId: "table-a" }],
    advisoryIssues: [],
    summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 0, blockingIssueCount: 1, advisoryIssueCount: 0 },
  })).toThrow();
});
```

- [ ] **Step 2: Run the focused contract test and confirm the new exports are absent.**

Run: `npm run build -- --force; npx vitest run packages/contracts/src/contracts.test.ts`

Expected: TypeScript fails because `requiredFieldCheckRequestSchema` and `requiredFieldCheckResultSchema` do not yet exist.

- [ ] **Step 3: Add the strict schemas and exported types.**

In `packages/contracts/src/contracts.ts`, extend `worksheetFieldNameSchema` with:

```ts
  "partName",
  "partCategory",
  "longTermSafetyFactor",
  "drawingNumber",
  "dimCharacteristicId",
```

Immediately after `worksheetAnalysisAssetsResultSchema`, add the following schemas. Reuse `worksheetAnalysisAssetsResultSchema`, `worksheetSourceCellSchema`, and the exact existing unavailable reason-code enum; do not introduce `invalid_numeric` or a second reason vocabulary.

```ts
const requiredFieldNameSchema = z.enum([
  "factorName", "partName", "partCategory", "nominalValue", "upperTolerance",
  "lowerTolerance", "longTermSafetyFactor", "standardDeviation", "distribution",
]);
const optionalIdentifierFieldNameSchema = z.enum(["drawingNumber", "dimCharacteristicId"]);
const worksheetUnavailableReasonCodeSchema = z.enum([
  "missing", "duplicate_mapping", "invalid_format", "ambiguous_mapping", "missing_cached_value",
]);

export const requiredFieldCheckRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  worksheetAnalysisAssets: worksheetAnalysisAssetsResultSchema,
}).strict();

const requiredFieldUnavailableIssueSchema = z.object({
  issueCode: z.literal("required_field_unavailable"),
  worksheetName: z.string().min(1), tableId: z.string().min(1),
  sourceRow: z.number().int().positive(), field: requiredFieldNameSchema,
  reasonCode: worksheetUnavailableReasonCodeSchema,
  sourceCell: worksheetSourceCellSchema.optional(),
}).strict();
const emptyFactorTableIssueSchema = z.object({
  issueCode: z.literal("factor_table_has_no_rows"),
  worksheetName: z.string().min(1), tableId: z.string().min(1),
}).strict();
const optionalIdentifierUnavailableIssueSchema = z.object({
  issueCode: z.literal("optional_identifier_unavailable"),
  worksheetName: z.string().min(1), tableId: z.string().min(1),
  sourceRow: z.number().int().positive(), field: optionalIdentifierFieldNameSchema,
  reasonCode: worksheetUnavailableReasonCodeSchema,
  sourceCell: worksheetSourceCellSchema.optional(),
}).strict();

export const requiredFieldCheckResultSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  status: z.enum(["blocked", "readyForNextCheck"]),
  blockingIssues: z.array(z.discriminatedUnion("issueCode", [requiredFieldUnavailableIssueSchema, emptyFactorTableIssueSchema])),
  advisoryIssues: z.array(optionalIdentifierUnavailableIssueSchema),
  summary: z.object({
    worksheetsChecked: z.number().int().nonnegative(), factorTablesChecked: z.number().int().nonnegative(),
    factorRowsChecked: z.number().int().nonnegative(), blockingIssueCount: z.number().int().nonnegative(),
    advisoryIssueCount: z.number().int().nonnegative(),
  }).strict(),
}).strict().superRefine((result, context) => {
  if ((result.status === "blocked") !== (result.blockingIssues.length > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "status must match blocking issues", path: ["status"] });
  }
  if (result.summary.blockingIssueCount !== result.blockingIssues.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "blocking issue count must match", path: ["summary", "blockingIssueCount"] });
  }
  if (result.summary.advisoryIssueCount !== result.advisoryIssues.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "advisory issue count must match", path: ["summary", "advisoryIssueCount"] });
  }
});

export type RequiredFieldCheckRequest = z.infer<typeof requiredFieldCheckRequestSchema>;
export type RequiredFieldCheckResult = z.infer<typeof requiredFieldCheckResultSchema>;
```

- [ ] **Step 4: Run the focused contract tests.**

Run: `npm run build -- --force; npx vitest run packages/contracts/src/contracts.test.ts`

Expected: PASS; the schema rejects unknown fields, malformed source references, invalid status/issue combinations, and mismatched summary counts.

### Task 2: Extend F1.1 Controlled Evidence Extraction

**Files:**
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

- [ ] **Step 1: Write failing extraction tests for all new aliases and a zero-row table.**

Add one anonymous `createAnonymousWorkbookZip` fixture with `Factor`, `Part Name`, `Part Category`, `Design Nominal`, `+ Tolerance`, `- Tolerance`, `Safety Factor`, `Sigma Level`, `Distribution`, `Drawing Number`, and `DIM/Characteristic ID` headers. Assert that its first row exposes the new fields and that `Safety Factor` maps to `longTermSafetyFactor`.

Add parameterized cases for `Long Term Factor`, `Safety Factor`, and `Long Term/Safety Factor`, each asserting the exact same semantic field. Add a fixture containing both `Safety Factor` and `Long Term Factor` in one header row, and assert `fields.longTermSafetyFactor` equals `{ status: "unavailable", reasonCode: "duplicate_mapping" }`.

Add a recognized `Factor` header with no following data row and assert the result retains one table with `rows: []`, `dataRange: { startRow: 2, endRow: 1 }` is **not** allowed. Update the contract and implementation together to represent an empty range as `dataRange: { startRow: 2, endRow: 2 }`; `rows` is the authoritative empty indicator.

- [ ] **Step 2: Run the focused extraction test and confirm it fails.**

Run: `npm run build -- --force; npx vitest run packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

Expected: FAIL because new headers are not mapped and zero-row candidate tables are omitted.

- [ ] **Step 3: Implement aliases, numeric parsing, and zero-row retention.**

Update `HEADER_ALIASES` and `NUMERIC_FIELDS` in `packages/workbook-catalog/src/worksheet-analysis-assets.ts`:

```ts
  partName: ["part name"],
  partCategory: ["part category"],
  longTermSafetyFactor: ["long term factor", "safety factor", "long term/safety factor"],
  drawingNumber: ["drawing number"],
  dimCharacteristicId: ["dim id", "characteristic id", "dim/characteristic id"],
```

Add `longTermSafetyFactor` to `NUMERIC_FIELDS`. Preserve the current exact normalized-alias lookup; never use substring matching.

Change the end of `sheetAssets` so every unique-`factorName` candidate table is pushed, even when `dataRows` is empty:

```ts
factorTables.push({
  tableId: createHash("sha256").update(`${worksheetName}:${headerRow}`).digest("hex").slice(0, 16),
  headerRow,
  dataRange: {
    startRow: headerRow + 1,
    endRow: dataRows.length === 0 ? headerRow + 1 : headerRow + dataRows.length,
  },
  columns,
  rows: dataRows,
});
```

Do not add synthetic fields to `rows.fields`; F2.1 must distinguish absent mappings by checking for a missing property.

- [ ] **Step 4: Lock the canonical zero-row range with a contract regression test.**

The existing `dataRange` refinement already permits `startRow === endRow` and rejects inverted ranges. Add an assertion in `packages/contracts/src/contracts.test.ts` that a factor table with `rows: []` and `dataRange: { startRow: 2, endRow: 2 }` parses, while `{ startRow: 2, endRow: 1 }` remains rejected. Do not alter the existing range schema.

- [ ] **Step 5: Run focused contracts and extraction tests.**

Run: `npm run build -- --force; npx vitest run packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

Expected: PASS; all new values remain confidential in memory and only their structured field evidence is returned.

### Task 3: Implement the Pure F2.1 Required-Field Check Service

**Files:**
- Create: `packages/workbook-catalog/src/required-field-check.ts`
- Create: `packages/workbook-catalog/src/required-field-check.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write failing F2.1 behavior tests.**

In `required-field-check.test.ts`, construct only anonymous F1.1-shaped assets and call `createRequiredFieldCheck`. Cover these cases:

```ts
it("blocks every unavailable required field without short-circuiting", () => {
  const result = createRequiredFieldCheck(requiredCheckRequest({
    nominalValue: unavailable("missing", "Analysis-A!D2"),
    distribution: unavailable("missing_cached_value", "Analysis-A!I2"),
    drawingNumber: unavailable("missing"),
    dimCharacteristicId: unavailable("duplicate_mapping"),
  }));

  expect(result.status).toBe("blocked");
  expect(result.blockingIssues).toEqual(expect.arrayContaining([
    expect.objectContaining({ field: "nominalValue", reasonCode: "missing", sourceCell: "Analysis-A!D2" }),
    expect.objectContaining({ field: "distribution", reasonCode: "missing_cached_value", sourceCell: "Analysis-A!I2" }),
  ]));
  expect(result.advisoryIssues).toEqual(expect.arrayContaining([
    expect.objectContaining({ field: "drawingNumber", reasonCode: "missing" }),
    expect.objectContaining({ field: "dimCharacteristicId", reasonCode: "duplicate_mapping" }),
  ]));
});

it("returns readyForNextCheck when every required field is available and identifiers are advisory", () => {
  const result = createRequiredFieldCheck(requiredCheckRequest({
    drawingNumber: unavailable("missing"),
    dimCharacteristicId: unavailable("missing"),
  }));
  expect(result).toMatchObject({ status: "readyForNextCheck", blockingIssues: [], summary: { advisoryIssueCount: 2 } });
});
```

Add individual cases for every required field missing entirely from `fields`, every F1.1 unavailable reason code, non-finite/missing numeric values for `nominalValue`, `upperTolerance`, `lowerTolerance`, `longTermSafetyFactor`, and `standardDeviation`, an empty table, malformed/non-confidential input, and recursive immutability of the result.

- [ ] **Step 2: Run the new F2.1 test and confirm it fails.**

Run: `npm run build -- --force; npx vitest run packages/workbook-catalog/src/required-field-check.test.ts`

Expected: FAIL because the module and public function do not exist.

- [ ] **Step 3: Implement runtime validation, issue collection, and deep immutability.**

Create `packages/workbook-catalog/src/required-field-check.ts`. Use the exact schemas from Task 1, and reuse the existing `createTypedError` error pattern from `worksheet-analysis-assets.ts`. The service must never call `readOoxmlWorkbook` or accept workbook bytes.

```ts
const REQUIRED_FIELDS = [
  "factorName", "partName", "partCategory", "nominalValue", "upperTolerance",
  "lowerTolerance", "longTermSafetyFactor", "standardDeviation", "distribution",
] as const;
const NUMERIC_REQUIRED_FIELDS = new Set([
  "nominalValue", "upperTolerance", "lowerTolerance", "longTermSafetyFactor", "standardDeviation",
]);
const OPTIONAL_IDENTIFIER_FIELDS = ["drawingNumber", "dimCharacteristicId"] as const;

export function createRequiredFieldCheck(request: unknown): RequiredFieldCheckResult {
  const parsed = requiredFieldCheckRequestSchema.safeParse(request);
  if (!parsed.success) throw validationError();

  const blockingIssues: RequiredFieldCheckResult["blockingIssues"] = [];
  const advisoryIssues: RequiredFieldCheckResult["advisoryIssues"] = [];
  let factorTablesChecked = 0;
  let factorRowsChecked = 0;

  for (const worksheet of parsed.data.worksheetAnalysisAssets.worksheets) {
    for (const table of worksheet.factorTables) {
      factorTablesChecked += 1;
      if (table.rows.length === 0) {
        blockingIssues.push({ issueCode: "factor_table_has_no_rows", worksheetName: worksheet.worksheetName, tableId: table.tableId });
        continue;
      }
      for (const row of table.rows) {
        factorRowsChecked += 1;
        for (const field of REQUIRED_FIELDS) {
          const issue = fieldIssue(worksheet.worksheetName, table.tableId, row.sourceRow, field, row.fields[field], NUMERIC_REQUIRED_FIELDS.has(field));
          if (issue) blockingIssues.push(issue);
        }
        for (const field of OPTIONAL_IDENTIFIER_FIELDS) {
          const issue = identifierIssue(worksheet.worksheetName, table.tableId, row.sourceRow, field, row.fields[field]);
          if (issue) advisoryIssues.push(issue);
        }
      }
    }
  }

  const result = requiredFieldCheckResultSchema.parse({
    contractVersion: "v1", inputClassification: "confidential",
    status: blockingIssues.length === 0 ? "readyForNextCheck" : "blocked",
    blockingIssues, advisoryIssues,
    summary: {
      worksheetsChecked: parsed.data.worksheetAnalysisAssets.worksheets.length,
      factorTablesChecked, factorRowsChecked,
      blockingIssueCount: blockingIssues.length, advisoryIssueCount: advisoryIssues.length,
    },
  });
  return deepFreeze(structuredClone(result));
}
```

`fieldIssue` and `identifierIssue` must return `missing` when a field property is absent, `available.rawText` trims empty, or an optional/required cell is absent; propagate an existing F1.1 `unavailable.reasonCode` and optional `sourceCell` unchanged. For numeric required fields, return `invalid_format` unless `numericValue` is a finite number. Use a local recursive `deepFreeze` with a `WeakSet`, matching F1.1’s cycle-safe behavior.

Use a fixed `createTypedError` response with `code: "validation_error"`, summary `"Required-field check request is invalid."`, suggested action `"Provide valid confidential worksheet-analysis assets."`, and affected reference `"worksheet-analysis-assets"`. Before parsing, read only `inputClassification` in a guarded `try` block; a present non-`confidential` string must return the same fixed `policy_denied` behavior used by F1.1, without inspecting nested assets.

- [ ] **Step 4: Export the service and types.**

Add to `packages/workbook-catalog/src/index.ts`:

```ts
export { createRequiredFieldCheck } from "./required-field-check.js";
export type { RequiredFieldCheckRequest, RequiredFieldCheckResult } from "@ai-assist/contracts";
```

Extend `required-field-check.test.ts` with a built-package ESM import assertion:

```ts
expect((await import("@ai-assist/workbook-catalog")).createRequiredFieldCheck).toBeTypeOf("function");
```

- [ ] **Step 5: Run the focused F2.1 suite.**

Run: `npm run build -- --force; npx vitest run packages/workbook-catalog/src/required-field-check.test.ts`

Expected: PASS; validation/policy errors expose only fixed text, result DTOs are deeply frozen, and no test depends on a real workbook fixture.

### Task 4: Register Only F2.1 and Preserve Feature Boundaries

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`

- [ ] **Step 1: Write failing governance tests for the independent F2.1 subfeature.**

Add an exact assertion for `getFeatureStatus("F2.1")`:

```ts
expect(getFeatureStatus("F2.1")).toEqual({
  featureId: "F2.1",
  title: "TA 必填字段严格校验",
  status: "available",
  dependsOn: ["worksheet-analysis-assets-v1", "required-field-check-v1"],
  inputContractId: "required-field-check-request-v1",
  outputContractId: "required-field-check-result-v1",
  maximumClassification: "confidential",
  acceptanceChecks: ["anonymous-required-field-check-fixture", "required-field-blocking-check", "required-field-privacy-check"],
  externalPrerequisites: ["approved-ooxml-parser"],
  disableBehavior: "return feature_not_available",
});
```

Keep root `F2` unavailable and extend the unavailable parameterized assertion to `F2.2`, `F2.3`, and `F2.4` after adding their placeholder registrations. Do not change assertions for F3-F7.

- [ ] **Step 2: Run the focused governance test and confirm it fails.**

Run: `npm run build -- --force; npx vitest run packages/governance/src/policy-gate.test.ts`

Expected: FAIL because F2.1 and the F2.2-F2.4 placeholder entries are absent.

- [ ] **Step 3: Add the F2.1 available registration and unavailable subfeature placeholders.**

In `feature-register.ts`, add an `F2.1` map entry using the exact values above. Add `F2.2`, `F2.3`, and `F2.4` with `unavailableFeature`, separate future dependency/contract IDs, `maximumClassification: "confidential"`, and acceptance checks that describe only their respective future capability. Leave the existing root F2 entry `unavailable`; it represents the incomplete aggregate feature and must not be repointed to F2.1’s contract.

- [ ] **Step 4: Run the focused governance test.**

Run: `npm run build -- --force; npx vitest run packages/governance/src/policy-gate.test.ts`

Expected: PASS; F2.1 alone is available, and later cleansing, identifier, calculation, interpretation, optimization, and measured-data behavior remains unavailable.

### Task 5: Update Documentation and Run Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/governance/feature-register.md`
- Create: `docs/superpowers/plans/2026-07-27-f2-1-required-field-validation.md` (this plan)

- [ ] **Step 1: Write documentation assertions before editing prose.**

Add focused assertions in `scripts/verify-repository.test.mjs` that the new F2.1 spec and plan exist, that no forbidden real workbook artifact is tracked, and that the F2.1 docs do not claim OCR, calculation, ADO, workbook writeback, external service access, capability-library matching, risk interpretation, or exception bypass. Use the repository checker’s existing file-reading/test helpers rather than adding a new shell-based test framework.

- [ ] **Step 2: Run the repository policy test and confirm documentation assertions fail.**

Run: `npx vitest run scripts/verify-repository.test.mjs`

Expected: FAIL until the F2.1 documentation links and scope language are added.

- [ ] **Step 3: Update user-facing and governance documentation.**

In `README.md` and `docs/README.md`, replace the blanket statement that F2-F7 are unavailable with an exact statement: F2.1 is available only for strict required-field evidence checks on confidential F1.1 assets; it blocks when any of the nine required factor fields is unavailable; Drawing Number and DIM/Characteristic ID are advisory; F2.2-F2.4 and F3-F7 remain unavailable. Link both the F2.1 design and this plan.

In `docs/governance/feature-register.md`, add a row for `F2.1` with its contract IDs, dependencies, classification, acceptance checks, and explicit exclusions. Retain the root F2 and later F2 subfeatures as unavailable.

- [ ] **Step 4: Run policy, lint, build, and full test verification.**

Run:

```powershell
npx vitest run scripts/verify-repository.test.mjs
npm run lint
npm run build -- --force
npm test
npm run check:repository
```

Expected: every command exits `0`. The test suite retains all prior passing tests; new F2.1 tests pass; repository policy reports no tracked real `.xlsx`/`.xlsm`, confidential fixtures, or unsafe paths.

- [ ] **Step 5: Inspect the final scope diff.**

Run: `git diff --check; git diff --stat; git status --short --branch`

Expected: no whitespace errors; changes are limited to contracts, workbook-catalog, governance, documentation, and anonymous tests. Do not create a commit unless the user explicitly requests one.

## Plan Self-Review

- **Spec coverage:** Task 1 defines strict versions, runtime schemas, issue states, counts, and status invariants. Task 2 adds all approved F1.1 fields, aliases, numeric validation, duplicate handling, and zero-row table evidence. Task 3 implements all nine strict blockers, optional identifier advisories, aggregation, privacy-safe failures, and immutable results. Task 4 limits availability to F2.1. Task 5 documents boundaries and runs repository, lint, build, and full test validation.
- **Scope control:** No task invokes F0 capability matching, exception recording, DIM governance, ADO, calculation, risk interpretation, OCR, rendering, external access, workbook persistence, or writeback.
- **Type consistency:** The plan uses `longTermSafetyFactor`, `dimCharacteristicId`, `createRequiredFieldCheck`, `required-field-check-request-v1`, and `required-field-check-result-v1` consistently. It preserves F1.1’s existing `invalid_format` reason code rather than inventing `invalid_numeric`.
- **No placeholders:** The implementation names, schemas, test behavior, commands, failure expectations, and final validation commands are specified. No task requires real customer/engineering workbooks.