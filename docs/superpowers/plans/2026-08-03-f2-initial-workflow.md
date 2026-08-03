# F2 Initial 数据清洗工作流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可从真实 TA workbook 运行完整 `F0 -> F1 -> F2` 链路的 F2 Initial facade，按 worksheet 隔离必填字段、截面图、F0 Item/能力/分布和标识符质量检查，并生成可追溯 JSON/Markdown 报告。

**Architecture:** F1 扩展只读证据，正确保留部分填写行并对 tolerance-path 图片建立语义状态；F0 v1 新增受控 Category/Item 关键字 Mapping 查询。F2 facade 将 F1 资产按 worksheet 切分，复用 F2.1 必填检查、独立标识符扫描和 F0 查询形成工作表级阻塞结果，保留既有 F2.1–F2.4 API，不调用 F2.3 例外路径。

**Tech Stack:** TypeScript strict ESM、Zod v3、Vitest v3、Node.js ESM、PowerShell、现有 OOXML reader 与 F0 knowledge-base API。

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/contracts/src/contracts.ts` | 扩展 F1 tolerance-path 图片证据、F0 Item Mapping 与 F2 Initial v1 契约。 |
| `packages/contracts/src/contracts.test.ts` | 严格 schema、判别联合和汇总不变量测试。 |
| `packages/workbook-catalog/src/worksheet-analysis-assets.ts` | 识别有效输入行和 tolerance-path 图片证据。 |
| `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts` | F1 部分填写行、空白模板行和图片语义测试。 |
| `packages/knowledge-base/src/data/v1.ts` | 匿名公开 Category、Item 关键字和 capability 绑定数据。 |
| `packages/knowledge-base/src/validation.ts` | Item Mapping library 完整性、manifest hash 和引用检查。 |
| `packages/knowledge-base/src/knowledge-base.ts` | `matchCapabilityItem` 只读查询 API。 |
| `packages/knowledge-base/src/knowledge-base.test.ts` | Category 未定义、唯一/无/多重 Item 匹配测试。 |
| `packages/workbook-catalog/src/identifier-quality-check.ts` | 抽取无 F2.1 门禁的标识符扫描核心并保留 v1 API。 |
| `packages/workbook-catalog/src/identifier-quality-check.test.ts` | v1 回归和 blocked worksheet 仍有治理信号测试。 |
| `packages/workbook-catalog/src/distribution-normalization.ts` | F2.2 与 F2 Initial 共用受控 Distribution 规范化。 |
| `packages/workbook-catalog/src/capability-validation.ts` | 改用共用 Distribution 规范化，保持 v1 行为。 |
| `packages/workbook-catalog/src/f2-initial-workflow.ts` | F2 Initial worksheet facade、阻塞策略和汇总。 |
| `packages/workbook-catalog/src/f2-initial-workflow.test.ts` | 工作表隔离、Mapping、公差、分布和隐私测试。 |
| `packages/workbook-catalog/src/index.ts` | 导出 F2 Initial API 和类型。 |
| `scripts/f2-output-layout.mjs` | 解析 Feature 2 单工作簿隔离输出目录。 |
| `scripts/f2-output-layout.test.mjs` | 输出路径、安全化和参数测试。 |
| `scripts/f2-report.mjs` | 从严格 F2 result 生成 Markdown。 |
| `scripts/f2-report.test.mjs` | 报告状态、来源和转义测试。 |
| `scripts/run-f2-full-validation.mjs` | 真实 workbook 的 F0/F1/F2 编排与报告写入。 |
| `scripts/f1-workbook-jobs.mjs` | 共享受控演示 jobs，避免 F1/F2 配置漂移。 |
| `scripts/run-f1-full-validation.mjs` | 改为使用共享 jobs，F1 行为保持不变。 |
| `scripts/f2-full-flow.test.mjs` | 匿名临时 OOXML 的 F0/F1/F2 可执行贯通测试。 |
| `package.json` | 新增 `workflow:f2` 命令。 |
| `packages/governance/src/feature-register.ts` | 将根 F2 注册为 F2 Initial facade。 |
| `packages/governance/src/policy-gate.test.ts` | 精确锁定 F2 注册与 F2.1–F2.4 兼容状态。 |
| `README.md`, `docs/README.md`, `docs/governance/feature-register.md`, `docs/governance/development-standard.md` | 记录入口、阻塞语义、验收和边界。 |

## Compatibility Decisions

1. `worksheet-analysis-assets-result-v1` 只新增 required property 会破坏既有调用方，因此图片语义作为 optional property `tolerancePathImage` 加入 v1 schema；F1 服务为每个成功处理的 worksheet 生成它，旧手工 fixture 可逐步迁移。F2 Initial 将缺少该 property 视为 `evidence_not_produced` 阻塞。
2. 现有 `createCapabilityValidation` 继续保持非阻塞、按 Category/range 查询的 v1 行为。F2 Initial 使用新的 `matchCapabilityItem` 和自己的阻塞 DTO，不静默改变 F2.2。
3. 现有 `createIdentifierQualityCheck` 继续保留 F2.1 gate。新增 `scanIdentifierQuality` 仅供 F2 Initial 使用，并返回带 source cell 的 workflow-owned governance signals；不发布含义不兼容的 F2.4 v1 结果。
4. F2 Initial 不导入或调用 `createExceptionResolution` / `createUnifiedExceptionResolution`。
5. 公开 F0 v1 当前仅有匿名 demo 数据。真实 workbook 贯通验收允许得到 `category_not_defined`/`item_unmatched`；只有已批准 Mapping 唯一命中时才允许产生公差或 Distribution 阻塞，不把覆盖缺口伪装成通过。

### Task 1: Strengthen F1 Active-Row and Tolerance-Path Evidence

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

- [ ] **Step 1: Write failing contract and extraction tests.**

Add a `tolerancePathImage` expectation to the F1 result fixture and add extraction cases for: exact label with PNG anchored below it, label with no image, image with unparsed anchor, unsupported image below the label, a row with blank `factorName` but populated `partName`, and a blank template row whose calculated formulas are cached.

Use these exact result branches:

```ts
const tolerancePathImageSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    labelSourceCell: worksheetSourceCellSchema,
    imageContentHash: sha256Schema,
    imageAnchor: z.object({
      from: z.string().regex(/^[A-Z]+[1-9]\d*$/),
      to: z.string().regex(/^[A-Z]+[1-9]\d*$/),
    }).strict(),
  }).strict(),
  z.object({
    status: z.literal("unavailable"),
    reasonCode: z.enum([
      "label_missing",
      "label_ambiguous",
      "image_missing",
      "unsupported_media_type",
      "unparsed_anchor",
    ]),
    labelSourceCell: worksheetSourceCellSchema.optional(),
  }).strict(),
]);
```

The partial row assertion must prove the row survives F1:

```ts
expect(result.worksheets[0]?.factorTables[0]?.rows).toEqual([
  expect.objectContaining({
    sourceRow: 13,
    fields: expect.objectContaining({
      factorName: expect.objectContaining({ status: "unavailable", reasonCode: "missing" }),
      partName: expect.objectContaining({ status: "available", rawText: "Bracket" }),
    }),
  }),
]);
```

The cached-formula-only row must not appear in `rows`.

- [ ] **Step 2: Run the focused tests and verify RED.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts
```

Expected: FAIL because `tolerancePathImage` is absent and partial rows are currently skipped when `factorName` is blank.

- [ ] **Step 3: Add the optional F1 evidence property and active-row rules.**

Add `tolerancePathImage: tolerancePathImageSchema.optional()` beside `imageAssets`. In `worksheet-analysis-assets.ts`, define the input fields independently of calculated columns:

```ts
const USER_INPUT_FIELDS = new Set<FieldName>([
  "factorName",
  "partName",
  "drawingNumber",
  "dimCharacteristicId",
  "partCategory",
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "longTermSafetyFactor",
  "standardDeviation",
  "distribution",
]);
```

For each detected table, derive `inputColumns` from uniquely mapped columns in this set. Stop at the first row where every input cell is blank, even if Mean/Tolerance/1 sigma/contribution formula cells contain cache values. Include any row where at least one input cell is nonblank, and call `field(...)` for every uniquely mapped column so an empty `factorName` becomes traceable unavailable evidence.

- [ ] **Step 4: Derive tolerance-path image evidence without OCR or fuzzy matching.**

Use controlled normalized labels:

```ts
const TOLERANCE_PATH_LABELS = new Set([
  "include the tolerance path (screen shot) below",
  "include the tolerance path (screenshot) below",
]);
const TOLERANCE_PATH_MEDIA_TYPES = new Set(["image/png", "image/jpeg"]);
```

Strip one trailing colon before comparing normalized cell text. If exactly one label exists, choose the supported image with an available anchor whose `from` row is greater than the label row and is closest by row. If none exists, return `unsupported_media_type` when an anchored image below uses another media type, `unparsed_anchor` when only unparsed images remain, otherwise `image_missing`. Zero labels return `label_missing`; multiple labels return `label_ambiguous` and must not be guessed. Include the property in every successfully processed worksheet asset.

- [ ] **Step 5: Re-run focused tests and commit.**

Run the Step 2 command. Expected: PASS with no F1 regression.

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts
git commit -m "feat: add F1 tolerance path evidence"
```

### Task 2: Add F0 Category-to-Item Mapping

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/knowledge-base/src/data/v1.ts`
- Modify: `packages/knowledge-base/src/validation.ts`
- Modify: `packages/knowledge-base/src/validation.test.ts`
- Modify: `packages/knowledge-base/src/knowledge-base.ts`
- Modify: `packages/knowledge-base/src/knowledge-base.test.ts`

- [ ] **Step 1: Write failing F0 schema, integrity, and query tests.**

Define anonymous mappings that exercise all branches without using real workbook text:

```ts
const itemMappings = [
  {
    itemId: "item-demo-bracket-arm",
    itemName: "demo bracket arm",
    partCategory: "demo-bracket",
    capabilityEntryId: "cap-demo-bracket",
    keywords: ["bracket arm", "mount arm"],
    provenance,
  },
  {
    itemId: "item-demo-bracket-mount",
    itemName: "demo bracket mount",
    partCategory: "demo-bracket",
    capabilityEntryId: "cap-demo-bracket",
    keywords: ["mount", "support"],
    provenance,
  },
];
```

Test `category_not_defined`, `item_unmatched`, unique `matched`, and `item_ambiguous`. Assert each candidate contains `itemId`, `itemName`, `capabilityEntryId`, `hitKeywords`, and `hitSources: ("factorName" | "partName")[]`. Add integrity failures for duplicate Item IDs, missing capability references, category mismatch with the referenced capability, duplicate normalized keywords within one Item, and manifest hash/count mismatch.

- [ ] **Step 2: Run focused F0 tests and verify RED.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/knowledge-base/src/validation.test.ts packages/knowledge-base/src/knowledge-base.test.ts
```

Expected: FAIL because Item Mapping contracts and `matchCapabilityItem` do not exist.

- [ ] **Step 3: Add strict Item Mapping contracts and manifest library.**

Add `capabilityItemMappingSchema` with the exact fields shown in Step 1, nonempty unique keywords, and strict provenance. Extend `knowledgeLibraryIdSchema` and the manifest union with:

```ts
{
  libraryId: "capability-item-mapping",
  contractId: "capability-item-mapping-v1",
  entryCount: number,
  coverage: string[],
  contentHash: sha256,
}
```

Change the manifest invariant from three to four unique libraries. Add strict request/result schemas for `matchCapabilityItem`:

```ts
{
  partCategory: string,
  factorName: string,
  partName: string,
}
```

Result statuses are `category_not_defined`, `item_unmatched`, `item_ambiguous`, and `matched`; only `matched` contains the full `CapabilityEntry`, while ambiguous results contain candidate metadata but no engineering conclusion.

- [ ] **Step 4: Extend and validate the immutable F0 snapshot.**

Add `itemMappings` to `CanonicalSeedData`, `KnowledgeBaseSeedPackage`, snapshot creation, manifest hashing, unique-ID validation, provenance validation, and banned-string validation. Validate every mapping's `capabilityEntryId`, require mapping/capability `partCategory` equality, and ensure every capability category has one `part-category` terminology entry. Add missing anonymous terminology entries for `demo-spacer` and `demo-t0-clip`.

- [ ] **Step 5: Implement deterministic keyword matching.**

Expose:

```ts
matchCapabilityItem(request: unknown): CapabilityItemMatchResult;
```

Normalize Category through the existing exact terminology API. Normalize names and keywords with locale-independent lowercase, punctuation-to-space, trim, and whitespace collapse. A keyword hits when the padded normalized input contains the padded normalized keyword; do not use edit distance, stemming, model calls, or priority guessing. Deduplicate candidates by `itemId`, preserve source order, collect all hit keywords/sources, and return fresh recursively frozen DTOs.

- [ ] **Step 6: Re-run focused tests and commit.**

Run the Step 2 command. Expected: PASS, including existing F0 queries.

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/knowledge-base/src/data/v1.ts packages/knowledge-base/src/validation.ts packages/knowledge-base/src/validation.test.ts packages/knowledge-base/src/knowledge-base.ts packages/knowledge-base/src/knowledge-base.test.ts
git commit -m "feat: add F0 capability item mapping"
```

### Task 3: Define Strict F2 Initial Contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write failing request/result contract tests.**

Use a request containing only trusted F1 assets and controlled versions:

```ts
{
  contractVersion: "v1",
  inputClassification: "confidential",
  knowledgeBaseVersion: "v1",
  mappingRuleVersion: "v1",
  toleranceUnitAssumption: "mm",
  worksheetAnalysisAssets,
}
```

Test all overall statuses, all five blocking issue codes, all three Mapping statuses, matched capability evidence, governance signals, unknown-key rejection, duplicate worksheet names, summary mismatch, a ready worksheet with blocking issues, a blocked worksheet without blocking issues, and incompatible overall status/count combinations.

- [ ] **Step 2: Run the contract test and verify RED.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL because F2 Initial schemas/types do not exist.

- [ ] **Step 3: Add strict workflow request and source-reference schemas.**

Add `f2InitialWorkflowRequestSchema` matching Step 1. Define reusable provenance:

```ts
const f2SourceReferenceSchema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1).optional(),
  sourceRow: z.number().int().positive().optional(),
  sourceCell: worksheetSourceCellSchema.optional(),
}).strict();
```

- [ ] **Step 4: Add discriminated workflow result schemas.**

Define strict unions for:

```text
blockingIssues:
  required_field_unavailable | factor_table_has_no_rows |
  cross_section_image_unavailable | tolerance_out_of_range |
  distribution_mismatch

mappingRecords:
  category_not_defined | item_unmatched | item_ambiguous

capabilityChecks:
  tolerance_and_distribution_match | tolerance_out_of_range |
  distribution_mismatch | tolerance_and_distribution_mismatch

governanceSignals:
  identifier_missing | identifier_evidence_unavailable |
  identifier_text_invalid | dim_id_duplicate
```

Each row-level branch carries workbook hash indirectly through the result root and directly carries worksheet/table/source row plus F1-provided source cells. F0 branches carry `knowledgeBaseVersion`, `mappingRuleVersion`, matched Item/Capability IDs, total tolerance, `unit: "mm"`, actual/recommended Distribution, and hit keywords where applicable.

Define the result root exactly as:

```ts
{
  contractVersion: "v1",
  inputClassification: "confidential",
  knowledgeBaseVersion: "v1",
  mappingRuleVersion: "v1",
  workbookContentHash: string,
  toleranceUnitAssumption: "mm",
  status: "completed" | "partiallyBlocked" | "blocked",
  worksheets: F2InitialWorksheetResult[],
  summary: F2InitialSummary,
}
```

Worksheet status is `blocked | readyForNextFeature`. Use `.superRefine` to derive all summary counts and enforce root/worksheet status invariants. Export `F2InitialWorkflowRequest` and `F2InitialWorkflowResult`.

- [ ] **Step 5: Re-run the contract test and commit.**

Run the Step 2 command. Expected: PASS.

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat: define F2 initial workflow contracts"
```

### Task 4: Make Identifier Scanning Independent of Required-Field Gate

**Files:**
- Modify: `packages/workbook-catalog/src/identifier-quality-check.ts`
- Modify: `packages/workbook-catalog/src/identifier-quality-check.test.ts`

- [ ] **Step 1: Write failing core-scanner tests.**

Add tests that call a new package-internal export with one worksheet whose required `partCategory` is missing. Assert Drawing Number and DIM ID missing/unavailable/invalid/duplicate signals are still returned, each affected source includes `sourceRow` and the F1 `sourceCell` when available. Keep the existing public v1 gate test unchanged.

```ts
const signals = scanIdentifierQuality(blockedWorksheetAssets);
expect(signals).toEqual(expect.arrayContaining([
  expect.objectContaining({
    signalKind: "identifier_missing",
    field: "drawingNumber",
    sources: [expect.objectContaining({ sourceRow: 13 })],
  }),
]));
```

- [ ] **Step 2: Run the focused test and verify RED.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/identifier-quality-check.test.ts
```

Expected: FAIL because the independent scanner is not exported.

- [ ] **Step 3: Extract a pure scanner and preserve the public v1 API.**

Move row traversal, grouping and duplicate detection into:

```ts
export function scanIdentifierQuality(
  assets: WorksheetAnalysisAssetsResult,
): readonly F2IdentifierGovernanceSignal[];
```

Store `sources: { sourceRow, sourceCell? }[]` rather than only row numbers. `createIdentifierQualityCheck` must continue returning `required_fields_not_ready` with no v1 signals when its F2.1 gate is blocked; when ready, adapt core signals back to the existing v1 contract exactly. Deep-freeze scanner output.

- [ ] **Step 4: Re-run the focused test and commit.**

Run the Step 2 command. Expected: PASS, including all existing F2.4 tests.

```powershell
git add packages/workbook-catalog/src/identifier-quality-check.ts packages/workbook-catalog/src/identifier-quality-check.test.ts
git commit -m "refactor: expose ungated identifier scan"
```

### Task 5: Implement the Worksheet-Isolated F2 Facade

**Files:**
- Create: `packages/workbook-catalog/src/distribution-normalization.ts`
- Create: `packages/workbook-catalog/src/distribution-normalization.test.ts`
- Modify: `packages/workbook-catalog/src/capability-validation.ts`
- Modify: `packages/workbook-catalog/src/capability-validation.test.ts`
- Create: `packages/workbook-catalog/src/f2-initial-workflow.ts`
- Create: `packages/workbook-catalog/src/f2-initial-workflow.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write failing Distribution helper and facade tests.**

Cover the approved aliases, unknown Distribution, policy denial, malformed request, deep freeze, and built ESM export. For the facade, test:

1. all worksheets ready -> `completed`;
2. one blocked and one ready -> `partiallyBlocked`;
3. all blocked -> `blocked`;
4. partial input row creates all missing-field blockers;
5. unavailable tolerance-path evidence blocks only its worksheet;
6. `category_not_defined`, `item_unmatched`, and `item_ambiguous` create Mapping records only;
7. unique Item + inclusive-range tolerance + matching Distribution passes;
8. unique Item + out-of-range tolerance and/or mismatched Distribution creates the exact blockers;
9. blocked worksheets still contain identifier governance signals;
10. calculated fields and optional identifiers do not block.

- [ ] **Step 2: Run focused tests and verify RED.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/distribution-normalization.test.ts packages/workbook-catalog/src/f2-initial-workflow.test.ts packages/workbook-catalog/src/capability-validation.test.ts
```

Expected: FAIL because the helper and facade do not exist.

- [ ] **Step 3: Extract shared Distribution normalization.**

Move the existing exact alias map into:

```ts
export function normalizeDistribution(value: string | undefined):
  | "normal"
  | "uniform"
  | "triangular"
  | "trapezoidal"
  | "elliptical"
  | "beta"
  | undefined;
```

Update `capability-validation.ts` to import it. Existing F2.2 output must remain byte-for-byte equivalent for the same request.

- [ ] **Step 4: Implement worksheet splitting and complete issue collection.**

In `createF2InitialWorkflow(request)`, validate policy before schema parsing. For each worksheet, create a one-worksheet `WorksheetAnalysisAssetsResult` retaining the same workbook hash. Run `createRequiredFieldCheck` and `scanIdentifierQuality` independently. Convert absent/unavailable `tolerancePathImage` to `cross_section_image_unavailable` with reason `evidence_not_produced | label_missing | label_ambiguous | image_missing | unsupported_media_type | unparsed_anchor`.

Do not stop after the first issue. Run F0 checks for every row whose nine required fields are available even when the worksheet already has an image blocker; skip only rows that cannot be validated reliably.

- [ ] **Step 5: Implement F0 matching and blocking capability checks.**

For each complete row, call:

```ts
const mapping = knowledgeBase.matchCapabilityItem({
  partCategory,
  factorName,
  partName,
});
```

Convert the three gap statuses to non-blocking Mapping records. For `matched`, calculate:

```ts
const totalTolerance = upperTolerance - lowerTolerance;
const toleranceMatches = totalTolerance >= capability.toleranceMin
  && totalTolerance <= capability.toleranceMax;
const actualDistribution = normalizeDistribution(distribution);
const distributionMatches = actualDistribution === capability.recommendedDistribution;
```

A negative/non-finite band cannot occur after required numeric validation; if encountered, throw `validation_error` rather than inventing an engineering result. Add one or two blocking issues as applicable, retain all matched evidence, and never call F2.3.

- [ ] **Step 6: Derive worksheet/overall statuses and immutable output.**

A worksheet is blocked iff its `blockingIssues` is nonempty. Derive `completed`, `partiallyBlocked`, or `blocked` from worksheet counts, derive every summary count from arrays, parse with `f2InitialWorkflowResultSchema`, structured-clone, and recursively freeze.

Export:

```ts
export { createF2InitialWorkflow } from "./f2-initial-workflow.js";
export type { F2InitialWorkflowRequest, F2InitialWorkflowResult } from "@ai-assist/contracts";
```

- [ ] **Step 7: Re-run focused tests and commit.**

Run the Step 2 command. Expected: PASS with existing F2.2 tests unchanged.

```powershell
git add packages/workbook-catalog/src/distribution-normalization.ts packages/workbook-catalog/src/distribution-normalization.test.ts packages/workbook-catalog/src/capability-validation.ts packages/workbook-catalog/src/capability-validation.test.ts packages/workbook-catalog/src/f2-initial-workflow.ts packages/workbook-catalog/src/f2-initial-workflow.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat: add worksheet isolated F2 workflow"
```

### Task 6: Add F0/F1/F2 CLI and Reports

**Files:**
- Modify: `scripts/f1-workbook-jobs.mjs`
- Modify: `scripts/f1-workbook-jobs.test.mjs`
- Modify: `scripts/run-f1-full-validation.mjs`
- Create: `scripts/f2-output-layout.mjs`
- Create: `scripts/f2-output-layout.test.mjs`
- Create: `scripts/f2-report.mjs`
- Create: `scripts/f2-report.test.mjs`
- Create: `scripts/run-f2-full-validation.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing jobs, layout, and report tests.**

Move the current three anonymous/controlled job definitions into an exported frozen `configuredFeature1Jobs` array in `f1-workbook-jobs.mjs`; test that `resolveFeature1Jobs` still returns one CLI job or the supplied configured list.

Test the Feature 2 layout:

```js
expect(resolveFeature2OutputLayout(["test/Demo Workbook.xlsx"])).toEqual({
  outRoot: "test/demo-output/feature2-output/Demo-Workbook",
  reportJsonName: "Feature2-Report.json",
  reportMdName: "Feature2-Report.md",
});
```

Test Markdown rendering of overall/worksheet statuses, blockers, Mapping records, capability evidence, governance signals, source rows/cells, and pipe/newline escaping.

- [ ] **Step 2: Run script tests and verify RED.**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f1-workbook-jobs.test.mjs scripts/f2-output-layout.test.mjs scripts/f2-report.test.mjs
```

Expected: FAIL because F2 layout/report modules do not exist.

- [ ] **Step 3: Implement shared jobs and isolated F2 output.**

Update F1 to import `configuredFeature1Jobs` with no report behavior change. `resolveFeature2OutputLayout` accepts exactly one workbook path, strips its extension, uses the existing safe-name rules, rejects an empty name, and always returns the fixed `feature2-output/<workbook>` directory. Before writing, remove only that resolved workbook directory.

- [ ] **Step 4: Implement the pure Markdown renderer.**

`renderF2Report(result, workbookFileName)` must render:

```text
Overall status and counts
Per-worksheet status
Blocking issues with table/row/cell
Matched F0 Item, tolerance and Distribution evidence
Mapping optimization records with candidate/hit keywords
Drawing Number and DIM ID governance signals
F0 version, Mapping rule version, workbook hash and mm assumption
```

It must not add conclusions absent from the strict result.

- [ ] **Step 5: Implement the real workbook workflow command.**

`run-f2-full-validation.mjs` accepts exactly one workbook path and executes in this order:

```js
const workbookCatalog = createWorkbookCatalog(...);
const selectionView = createWorksheetSelectionView(...);
const parallelAssets = await createWorksheetAnalysisAssetsParallel(...);
const f2Result = createF2InitialWorkflow({
  contractVersion: "v1",
  inputClassification: "confidential",
  knowledgeBaseVersion: "v1",
  mappingRuleVersion: "v1",
  toleranceUnitAssumption: "mm",
  worksheetAnalysisAssets: parallelAssets.assets,
});
```

Fail if any selected F1 page failed; do not silently drop it. Write the strict result as `Feature2-Report.json` and renderer output as `Feature2-Report.md`. Add:

```json
"workflow:f2": "node scripts/run-f2-full-validation.mjs"
```

Do not read `Feature1-Report.json`, mutate `feature1-output`, or persist workbook bytes/images under Feature 2 output.

- [ ] **Step 6: Re-run script tests and F1 regression, then commit.**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f1-workbook-jobs.test.mjs scripts/f1-output-layout.test.mjs scripts/f2-output-layout.test.mjs scripts/f2-report.test.mjs
npm run build -- --force
```

Expected: PASS.

```powershell
git add package.json scripts/f1-workbook-jobs.mjs scripts/f1-workbook-jobs.test.mjs scripts/run-f1-full-validation.mjs scripts/f2-output-layout.mjs scripts/f2-output-layout.test.mjs scripts/f2-report.mjs scripts/f2-report.test.mjs scripts/run-f2-full-validation.mjs
git commit -m "feat: add F2 full validation reports"
```

### Task 7: Register and Document F2 Initial

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/governance/feature-register.md`
- Modify: `docs/governance/development-standard.md`

- [ ] **Step 1: Write the failing exact registration test.**

Replace only the root F2 unavailable assertion with:

```ts
expect(getFeatureStatus("F2")).toEqual({
  featureId: "F2",
  title: "TA 数据清洗与能力一致性门禁",
  status: "available",
  dependsOn: [
    "knowledge-base-v1",
    "capability-item-mapping-v1",
    "worksheet-analysis-assets-v1",
    "required-field-check-v1",
    "identifier-quality-check-v1",
    "f2-initial-workflow-v1",
  ],
  inputContractId: "f2-initial-workflow-request-v1",
  outputContractId: "f2-initial-workflow-result-v1",
  maximumClassification: "confidential",
  acceptanceChecks: [
    "f0-f1-f2-real-workbook-flow",
    "f2-worksheet-isolation-check",
    "f2-blocking-policy-check",
    "f2-mapping-gap-nonblocking-check",
    "f2-privacy-check",
  ],
  externalPrerequisites: ["approved-public-knowledge-snapshot", "approved-ooxml-parser"],
  disableBehavior: "return feature_not_available",
});
```

Keep F2.1–F2.4 available with their existing contract IDs. Remove `F2` from the unavailable feature parameterized test.

- [ ] **Step 2: Run governance test and verify RED.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts
```

Expected: FAIL because root F2 remains unavailable.

- [ ] **Step 3: Register F2 and update documentation.**

Update the four docs in Chinese. Document the exact `npm run workflow:f2 -- "<workbook.xlsx>"` command, output paths, nine required fields, tolerance-path image blocker, default `mm` assumption, worksheet isolation, F0 gap non-blocking semantics, unique-match blockers, identifier non-blocking semantics, no exception override, and the requirement that module acceptance runs the complete F0/F1/F2 chain. Link the approved spec and this plan.

Do not rename F2.3 or claim its exception behavior is part of F2 Initial.

- [ ] **Step 4: Re-run governance test and commit.**

Run the Step 2 command. Expected: PASS.

```powershell
git add packages/governance/src/feature-register.ts packages/governance/src/policy-gate.test.ts README.md docs/README.md docs/governance/feature-register.md docs/governance/development-standard.md
git commit -m "docs: register F2 initial workflow"
```

### Task 8: Full-Flow Acceptance and Repository Verification

**Files:**
- Create: `scripts/f2-full-flow.test.mjs`
- Verify: all files in Tasks 1–7
- Generate locally: `test/demo-output/feature2-output/<workbook-base-name>/Feature2-Report.json`
- Generate locally: `test/demo-output/feature2-output/<workbook-base-name>/Feature2-Report.md`

- [ ] **Step 1: Write an executable anonymous F0/F1/F2 integration test.**

Build an in-memory OOXML fixture through existing `test-support.ts` helpers with two TA worksheets. One must uniquely match the anonymous F0 demo Item and pass; the other must have a required-field or tolerance-path image blocker. Invoke the real package APIs in order, including `loadKnowledgeBase({ version: "v1" })` as an explicit F0 availability assertion before F1 and F2. Assert `partiallyBlocked`, source-cell provenance, Mapping version, and frozen result.

- [ ] **Step 2: Run the complete touched-slice suite.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/knowledge-base/src/validation.test.ts packages/knowledge-base/src/knowledge-base.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts packages/workbook-catalog/src/required-field-check.test.ts packages/workbook-catalog/src/capability-validation.test.ts packages/workbook-catalog/src/identifier-quality-check.test.ts packages/workbook-catalog/src/distribution-normalization.test.ts packages/workbook-catalog/src/f2-initial-workflow.test.ts packages/governance/src/policy-gate.test.ts scripts/f1-workbook-jobs.test.mjs scripts/f1-output-layout.test.mjs scripts/f2-output-layout.test.mjs scripts/f2-report.test.mjs scripts/f2-full-flow.test.mjs
```

Expected: PASS. This command is the module-level acceptance gate because it includes the executable full-flow test in addition to focused unit tests.

- [ ] **Step 3: Run the controlled real workbook acceptance.**

```powershell
npm run workflow:f2 -- "test/Maera_gap_TP_brkt_and _battery_20260305V1.xlsx"
$root = "test/demo-output/feature2-output/Maera_gap_TP_brkt_and-_battery_20260305V1"
$result = Get-Content "$root/Feature2-Report.json" -Raw | ConvertFrom-Json
if ($result.contractVersion -ne "v1") { throw "Unexpected F2 contract version" }
if ($result.worksheets.Count -eq 0) { throw "Expected worksheet results" }
if ($result.summary.worksheetsChecked -ne $result.worksheets.Count) { throw "Worksheet summary mismatch" }
if (-not (Test-Path "$root/Feature2-Report.md")) { throw "Missing Markdown report" }
```

Expected: exit code 0 and both reports exist. It is valid for current public F0 coverage to yield Mapping gap records; inspect the report to confirm no gap is mislabeled as a pass/fail and every row-level record includes worksheet/table/source row/source cell when F1 supplied one.

- [ ] **Step 4: Verify report isolation and no generated artifacts are staged.**

```powershell
if (Test-Path "test/demo-output/feature2-output/Maera_gap_TP_brkt_and-_battery_20260305V1/Feature1-Report.json") { throw "F2 output contains F1 report" }
git status --short
git ls-files "test/demo-output/feature2-output/**"
```

Expected: no tracked Feature 2 generated report and no unrelated source modification.

- [ ] **Step 5: Run final repository checks.**

```powershell
npm run lint
npm test
npm run check:repository
git diff --check
git ls-files | Select-String '\.(xlsx|xlsm)$|^fixtures/confidential/'
```

Expected: all checks pass; the final command returns no tracked confidential workbook.

- [ ] **Step 6: Commit the integration test and any final scoped fixes.**

```powershell
git add scripts/f2-full-flow.test.mjs
git commit -m "test: verify F0 F1 F2 full flow"
```

Do not stage `test/demo-output/feature2-output/**` or unrelated user changes.
