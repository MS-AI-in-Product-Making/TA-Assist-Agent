# F5 Contextual Image Observations v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增只供新 image mode 创建的 `f5-image-observation-v2`，强制每个 selected worksheet 完整检查五项核心 scope，并将纯视觉 FACT 与图文联合 SIGNAL 分层且可审计。

**Architecture:** 保留 v1 历史 artifact 的只读兼容，在 contracts 中使用 `observationVersion` discriminated union。F5 loader 从 verified F3 governance rows 构造 expected context snapshot，与 v2 artifact 逐行比对；任一 mismatch 时丢弃整个 v2 并继续 deterministic F5。Interpretation 只允许 high-confidence visual observation 形成 FACT，context assessment 永远形成 `requiresEngineeringReview` SIGNAL。

**Tech Stack:** TypeScript、Zod、Node.js ESM、Vitest、Markdown skill contracts

---

## File Structure

- Modify: `packages/contracts/src/contracts.ts` - v1/v2 observation schemas、request/result statement unions。
- Modify: `packages/contracts/src/contracts.test.ts` - v1 compatibility、v2 completeness/provenance tests。
- Modify: `scripts/f5-artifact-loader.mjs` - snapshot identity validation 与 v2 all-or-nothing fallback。
- Modify: `scripts/f5-artifact-loader.test.mjs` - v2 fixture、row/image/set mismatch tests。
- Modify: `packages/workbook-catalog/src/f5-data-interpretation.ts` - visual FACT/context SIGNAL generation。
- Modify: `packages/workbook-catalog/src/f5-data-interpretation.test.ts` - evidence gate tests。
- Modify: `scripts/f5-report.mjs` - scope matrix、visual/context/snapshot tables。
- Modify: `scripts/f5-report.test.mjs` - report structure and provenance assertions。
- Modify: `.github/skills/f5-analysis/SKILL.md` - W6 v2 creation protocol。
- Modify: `scripts/f5-skill.test.mjs` - skill protocol contract。
- Modify: `scripts/f5-full-flow.test.mjs` - v1/v2/no-image/fallback full-flow。
- Modify: `docs/02-end-to-end-flow.md`, `docs/02-端到端流程.md`, `docs/04-feature-breakdown.md`, `docs/04-功能拆分.md`, `README.md`, `docs/README.md` - behavior and compatibility docs。

### Task 1: Add the versioned observation contracts

**Files:**
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/contracts/src/contracts.ts`

- [ ] **Step 1: Write RED tests for v1/v2 discrimination and five-scope completeness**

Add fixtures with this exact v2 shape:

```ts
const coreScopes = [
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
] as const;

const validV2 = {
  contractVersion: "v1",
  inputClassification: "confidential",
  observationVersion: "f5-image-observation-v2",
  workbookContentHash: "a".repeat(64),
  worksheets: [{
    worksheetName: "Analysis-A",
    imageReference: {
      artifact: "f1",
      relativePath: "sheets/Analysis-A/image.png",
      contentHash: "b".repeat(64),
      worksheetName: "Analysis-A",
    },
    contextSnapshot: {
      dimensionDescription: "Device gap",
      rows: [{
        tableId: "table-a",
        sourceRow: 14,
        partName: "Bracket",
        partSubsystem: "Bracket",
        partCategory: "CNC",
        factorName: "Bracket height",
        factorDescription: "Bracket height",
        nominal: 1,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        sigmaLevel: 4,
        sourceCells: { factorName: "Analysis-A!G14", partName: "Analysis-A!H14" },
      }],
    },
    observations: coreScopes.map((scope) => ({
      scope,
      visualObservation: {
        observedValue: "ambiguous",
        confidence: "medium",
        visibleBasis: `Visible basis for ${scope}.`,
        reviewStatus: "unreviewed",
      },
      contextualSignal: {
        signalValue: "insufficient_evidence",
        textBasis: `Context basis for ${scope}.`,
        linkedSourceRows: [],
        requiresEngineeringReview: true,
      },
    })),
  }],
};
```

Assert:

```ts
expect(f5ImageObservationArtifactV2Schema.parse(validV2)).toEqual(validV2);
expect(f5ImageObservationArtifactSchema.parse(observationArtifact)).toEqual(observationArtifact);
expect(f5ImageObservationArtifactSchema.parse(validV2)).toEqual(validV2);
expect(f5ImageObservationArtifactV2Schema.safeParse({
  ...validV2,
  worksheets: [{ ...validV2.worksheets[0], observations: validV2.worksheets[0].observations.slice(1) }],
}).success).toBe(false);
```

Also reject duplicate core scope, missing `sourceCells`, duplicate `{tableId, sourceRow}`, unknown observation version, `requiresEngineeringReview: false`, and confirmed visual observation without both confirmation fields.

- [ ] **Step 2: Run contracts test and verify RED**

Run: `npx vitest run packages/contracts/src/contracts.test.ts`

Expected: FAIL because v2 exports and schema do not exist.

- [ ] **Step 3: Implement v1 extraction, v2 schemas, and union**

Rename the current exported v1 artifact schema to `f5ImageObservationArtifactV1Schema` without changing its fields or refinements. Then add these exports:

```ts
export const f5ContextSnapshotRowV2Schema = z.object({
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  partName: z.string().min(1).nullable(),
  partSubsystem: z.string().min(1).nullable(),
  partCategory: z.string().min(1).nullable(),
  factorName: z.string().min(1).nullable(),
  factorDescription: z.string().min(1).nullable(),
  nominal: z.number().finite().nullable(),
  upperTolerance: z.number().finite().nullable(),
  lowerTolerance: z.number().finite().nullable(),
  sigmaLevel: z.number().finite().positive().nullable(),
  sourceCells: z.record(z.string(), z.string().min(1)),
}).strict();

export const f5ImageObservationArtifactV2Schema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  observationVersion: z.literal("f5-image-observation-v2"),
  workbookContentHash: sha256Schema,
  worksheets: z.array(f5ContextualObservationWorksheetV2Schema).min(1),
}).strict();

export const f5ImageObservationArtifactSchema = z.discriminatedUnion("observationVersion", [
  f5ImageObservationArtifactV1Schema,
  f5ImageObservationArtifactV2Schema,
]);
```

Use `superRefine` to enforce exact five-scope set, unique worksheet names, unique snapshot row keys, linked rows contained in snapshot, and ambiguous/insufficient signals when `linkedSourceRows` is empty.

- [ ] **Step 4: Run contracts test and verify GREEN**

Run: `npx vitest run packages/contracts/src/contracts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat(contracts): add F5 image observation v2"
```

### Task 2: Validate v2 context snapshots in the F5 loader

**Files:**
- Modify: `scripts/f5-artifact-loader.test.mjs`
- Modify: `scripts/f5-artifact-loader.mjs`

- [ ] **Step 1: Write RED loader tests**

Extend `setupBundle()` with `v2ObservationArtifact()` built from each F3 row:

```js
function snapshotRow(row) {
  return {
    tableId: row.source.tableId,
    sourceRow: row.source.sourceRow,
    partSubsystem: row.partSubsystem,
    partCategory: row.partCategory,
    factorDescription: row.factorDescription,
    nominal: row.nominal,
    upperTolerance: row.upperTolerance,
    lowerTolerance: row.lowerTolerance,
    sigmaLevel: row.sigmaLevel,
    sourceCells: row.source.sourceCells,
  };
}
```

Add parameterized mutations for dimension description, missing/extra/duplicate row, `partName`, `partSubsystem`, `factorName`, `factorDescription`, numeric fields, `sourceCells`, image reference, missing selected worksheet, and extra worksheet. Assert every invalid v2 produces an observation-only fallback with no partial v2 observations. Assert baseline identity mismatch still returns `inputRejected`. Assert the existing v1 fixture from `setupBundle()` remains accepted without snapshot fields or v2 reserialization.

- [ ] **Step 2: Run loader test and verify RED**

Run: `npx vitest run scripts/f5-artifact-loader.test.mjs`

Expected: FAIL because v2 snapshots are not validated.

- [ ] **Step 3: Implement deterministic snapshot comparison**

Add helpers:

```js
function sourceKey({ tableId, sourceRow }) {
  return `${tableId}\u0000${sourceRow}`;
}

function buildExpectedContextSnapshot(f1Table, f3Worksheet) {
  const f1BySourceRow = new Map(f1Table.rows.map((row) => [row.sourceRow, row]));
  const rows = [...f3Worksheet.rows]
    .sort((left, right) => left.source.sourceRow - right.source.sourceRow)
    .map((row) => {
      const f1Row = f1BySourceRow.get(row.source.sourceRow);
      if (!f1Row) throw new Error("missing F1 source row");
      return {
        tableId: row.source.tableId,
        sourceRow: row.source.sourceRow,
        partName: f1Row.actualFields.partName,
        partSubsystem: row.partSubsystem,
        partCategory: row.partCategory,
        factorName: f1Row.actualFields.factorName,
        factorDescription: row.factorDescription,
        nominal: row.nominal,
        upperTolerance: row.upperTolerance,
        lowerTolerance: row.lowerTolerance,
        sigmaLevel: row.sigmaLevel,
        sourceCells: row.source.sourceCells,
      };
    });
  return { dimensionDescription: f3Worksheet.toleranceLoopDescription, rows };
}

function validateV2ContextSnapshot(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}
```

Use stable sorted objects instead of ad-hoc strings if `sourceCells` key order differs. Verify `partName === partSubsystem` and `factorName === factorDescription` for the current F3 mapping, while preserving both original and mapped fields in the snapshot. Require v2 worksheet set to exactly equal selection and discard the whole v2 artifact on any mismatch. Preserve v1 path unchanged.

Define loader return behavior explicitly:

```js
// Baseline F1/F3/F4 error
{ status: "inputRejected", reasonCode, artifactReference }

// Baseline accepted, v2 rejected
{
  status: "accepted",
  request: deterministicRequestWithoutImageObservations,
  observationFallback: { reasonCode, artifactReference },
  sourceReferences,
}
```

The second branch must not expose `observationArtifact`, `contextSnapshot`, or any partial context SIGNAL.

- [ ] **Step 4: Run loader test and verify GREEN**

Run: `npx vitest run scripts/f5-artifact-loader.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f5-artifact-loader.mjs scripts/f5-artifact-loader.test.mjs
git commit -m "feat(f5): validate contextual image snapshots"
```

### Task 3: Separate visual FACTs from contextual SIGNALs

**Files:**
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/workbook-catalog/src/f5-data-interpretation.test.ts`
- Modify: `packages/workbook-catalog/src/f5-data-interpretation.ts`

- [ ] **Step 1: Write RED request/result and interpretation tests**

Assert v2 request preserves `observationVersion`, `contextSnapshot`, and observations. Assert snapshot includes both original `partName/factorName` and mapped `partSubsystem/factorDescription`. Assert output context signal equals:

```ts
{
  type: "SIGNAL",
  section: "tolerance-chain-validity",
  content: {
    signalKind: "image_text_context_review",
    scope: "direction",
    signalValue: "ambiguous",
    textBasis: "No reliable row-to-arrow mapping.",
    linkedSourceRows: [],
    requiresEngineeringReview: true,
  },
}
```

For high visual confidence expect one image FACT; for medium/low expect no image FACT. For every contextual observation expect one context SIGNAL and no new RULE. Assert five core scope items exist exactly once and F6 sections remain `delegated_to_f6`.

Add semantic cases:

- `stack_start` with no visible start marker and no reliable row mapping must be `ambiguous` or `insufficient_evidence` with empty `linkedSourceRows`.
- `assembly_datum_face` without a marked face must not be `indicated_consistent`.
- `direction` may use linked rows only when the fixture contains matching visible label evidence.
- Medium/low visual confidence never creates an image FACT for any core scope.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npx vitest run packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f5-data-interpretation.test.ts
```

Expected: FAIL because contextual signals are absent.

- [ ] **Step 3: Implement v2 request/result statement schemas and interpretation path**

Add `signalKind: "image_text_context_review"` to the F5 root SIGNAL union. Branch `createImageEvidence()` by observation version:

```ts
function createContextSignal(observation: F5ContextualObservationV2) {
  return {
    statementId: `f5-context-signal-${observation.scope}`,
    type: "SIGNAL" as const,
    section: "tolerance-chain-validity" as const,
    content: {
      signalKind: "image_text_context_review" as const,
      scope: observation.scope,
      ...observation.contextualSignal,
    },
  };
}
```

Keep visual FACT content unchanged and never copy `textBasis` or snapshot data into it. Preserve v1 behavior.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f5-data-interpretation.ts packages/workbook-catalog/src/f5-data-interpretation.test.ts
git commit -m "feat(f5): separate visual and contextual evidence"
```

### Task 4: Render the contextual evidence layers

**Files:**
- Modify: `scripts/f5-report.test.mjs`
- Modify: `scripts/f5-report.mjs`

- [ ] **Step 1: Write RED report assertions**

Require headings/table labels:

```text
五项状态矩阵
Visual FACT
Worksheet context SIGNAL
图文联合提示，非工程结论
dimensionDescription
partSubsystem
partName
factorDescription
factorName
sourceCells
linkedSourceRows
requiresEngineeringReview
```

Assert five core scopes each appear once in the matrix; visual table excludes `textBasis`; context table includes signal value/text/linked rows; snapshot table includes every active row; no absolute path appears. No-v2 fixture must retain `not_evaluated` clarification.

- [ ] **Step 2: Run report test and verify RED**

Run: `npx vitest run scripts/f5-report.test.mjs`

Expected: FAIL because v2 tables are absent.

- [ ] **Step 3: Implement focused render helpers**

Extract the current FACT loop from `renderTolerance()` into `renderVisualFacts()`. Add three focused helpers with these exact responsibilities:

- `renderScopeMatrix(lines, worksheet)`: iterate the fixed five core scopes and append one row with visual/context/review status per scope.
- `renderVisualFacts(lines, worksheet, options)`: filter `FACT + image_observation`, render only visual fields, and use the existing `imageLink()`.
- `renderContextSignals(lines, worksheet)`: filter `SIGNAL + image_text_context_review`, render signal value, text basis, linked row keys, and `requiresEngineeringReview`.
- `renderContextSnapshot(lines, worksheet)`: sort snapshot rows by `sourceRow` and render dimension description, part subsystem, factor description, numeric inputs, and source-cell references.

Escape Markdown cells with the existing `cell()` helper. Render source-cell values, not absolute artifact paths. Preserve legacy v1 rendering.

- [ ] **Step 4: Run report test and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f5-report.mjs scripts/f5-report.test.mjs
git commit -m "feat(f5): report contextual image evidence"
```

### Task 5: Govern new image-mode creation in the skill

**Files:**
- Modify: `scripts/f5-skill.test.mjs`
- Modify: `.github/skills/f5-analysis/SKILL.md`

- [ ] **Step 1: Write RED skill contract assertions**

Require exact phrases covering v1 read-only, v2-only creation, all active rows, exact five scopes, snapshot/F3 equality, visual FACT/context SIGNAL separation, all-or-nothing v2 validation, and deterministic fallback. Assert command allowlist is unchanged and no image-model CLI is introduced.

- [ ] **Step 2: Run skill test and verify RED**

Run: `npx vitest run scripts/f5-skill.test.mjs`

Expected: FAIL because W6 still describes v1 only.

- [ ] **Step 3: Update W6 protocol**

Document this ordered flow:

```text
verify F1 image
-> build all-active-row snapshot from verified F3
-> inspect image + snapshot for five scopes
-> create immutable v2 only
-> readback/schema/identity/source-row validation
-> pass v2 to F5 or discard whole v2 and continue deterministic F5
```

Keep existing UUID, containment, reparse, `create_file`, no-overwrite, confidence and ME-review gates.

- [ ] **Step 4: Run skill test and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f5-skill.test.mjs .github/skills/f5-analysis/SKILL.md
git commit -m "docs(f5): govern contextual image observations"
```

### Task 6: Complete full-flow compatibility and fallback

**Files:**
- Modify: `scripts/f5-full-flow.test.mjs`
- Modify: `scripts/run-f5-full-validation.mjs`

- [ ] **Step 1: Write RED full-flow cases**

Add cases using the existing `observations()` v1 fixture and real artifact bundle: historical v1 accepted without snapshot enrichment or v2 reserialization, valid v2 rendered, no observation deterministic F5, invalid v2 snapshot fallback, selected worksheet missing from v2 fallback, and all-or-nothing behavior. Assert successful v2 has `stack_start != not_evaluated`; fallback has no partial context SIGNAL. Assert baseline workbook/image mismatch remains `inputRejected` and never falls back.

- [ ] **Step 2: Run full-flow test and verify RED**

Run: `npx vitest run scripts/f5-full-flow.test.mjs`

Expected: FAIL on v2/fallback cases.

- [ ] **Step 3: Implement safe union/fallback handling**

Consume the loader's explicit `observationFallback` accepted branch: run deterministic interpretation from `request`, include a controlled fallback clarification, and omit observation output/hash fields. Do not rerun or reinterpret an `inputRejected` baseline branch. Preserve atomic write order.

- [ ] **Step 4: Run full-flow test and verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f5-full-flow.test.mjs scripts/run-f5-full-validation.mjs
git commit -m "feat(f5): add contextual observation fallback"
```

### Task 7: Update behavior documentation and run regressions

**Files:**
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/04-feature-breakdown.md`
- Modify: `docs/04-功能拆分.md`
- Modify: `README.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Document v1 read-only and v2 creation behavior**

State five-scope completeness, all active rows, visual/context evidence separation, all-or-nothing validation, deterministic fallback, and unchanged F6 delegation. Link the approved spec and this plan from `docs/README.md`.

- [ ] **Step 2: Run focused regression**

```powershell
npx vitest run packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f5-data-interpretation.test.ts scripts/f5-artifact-loader.test.mjs scripts/f5-report.test.mjs scripts/f5-skill.test.mjs scripts/f5-full-flow.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run repository verification and build**

```powershell
npm run build -- --force
npm run check:repository
```

Expected: both exit 0.

- [ ] **Step 4: Commit docs**

```powershell
git add docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/04-feature-breakdown.md docs/04-功能拆分.md README.md docs/README.md
git commit -m "docs: document F5 contextual image evidence"
```

- [ ] **Step 5: Run complete suite**

Run: `npm test`

Expected: all test files pass; environment-specific symlink tests may remain skipped.

- [ ] **Step 6: Verify branch state**

Run: `git status --short --branch`

Expected: clean branch `user/xumax/F5-F6-contextual-image-observations-report-optimization`.