# F2 Artifact Report Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 F2 改为只消费 F1 JSON/MD/images artifact bundle，并输出以 factor 行为中心、可直接指导用户修改 TA Excel 的严格 JSON 和中文 Markdown 报告。

**Architecture:** F1 导出层补充独立 `partNumber` 和语义截面图证据；Node artifact loader 负责受控文件读取与 bundle 一致性校验，然后把规范化 DTO 交给纯 TypeScript composer。Composer 逐 factor 生成缺失字段、非阻塞能力库差异和 ADO 待触发事件，Markdown renderer 只消费同一份 `F2UserReport`，旧 `createF2InitialWorkflow` 保留作兼容 API。

**Tech Stack:** TypeScript strict ESM、Zod v3、Vitest v3、Node.js ESM、现有 F0 knowledge-base、现有 F1 worksheet JSON/MD/image 导出格式。

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/contracts/src/contracts.ts` | 新增 `partNumber`、规范化 F1 artifact 输入及严格 `F2UserReport` 契约。 |
| `packages/contracts/src/contracts.test.ts` | schema、判别联合、汇总计数与状态不变量测试。 |
| `packages/workbook-catalog/src/worksheet-analysis-assets.ts` | 识别独立 Part Number 表头并保留为 F1 用户输入证据。 |
| `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts` | Part Number 独立于 Drawing Number 的提取回归。 |
| `packages/workbook-catalog/src/f2-user-report.ts` | 从规范化 F1 artifact DTO 组合行级 F2 用户报告。 |
| `packages/workbook-catalog/src/f2-user-report.test.ts` | 必填阻塞、能力差异非阻塞、库外和 ADO 聚合测试。 |
| `packages/workbook-catalog/src/index.ts` | 导出 composer 与新类型。 |
| `scripts/run-f1-full-validation.mjs` | 在 worksheet JSON 中输出 `tolerancePathImage`，保持现有报告结构。 |
| `scripts/f2-artifact-loader.mjs` | 只读 F1 根 JSON/MD、worksheet JSON/MD/images 并建立规范化 bundle。 |
| `scripts/f2-artifact-loader.test.mjs` | bundle 缺失、不一致、路径越界与有效输入测试。 |
| `scripts/f2-report.mjs` | 从 `F2UserReport` 生成中文摘要、缺失统计、增强 raw-data 与 ADO 清单。 |
| `scripts/f2-report.test.mjs` | 用户文案、单 factor 单行、转义和内部术语不可见测试。 |
| `scripts/f2-output-layout.mjs` | 从 F1 artifact 目录解析稳定的 F2 输出目录。 |
| `scripts/f2-output-layout.test.mjs` | F1 目录参数与安全名称测试。 |
| `scripts/run-f2-full-validation.mjs` | 新 CLI：F1 目录 → loader → composer → JSON/Markdown。 |
| `scripts/f2-artifact-flow.test.mjs` | 匿名 F1 artifact bundle 的可执行贯通测试，并证明不需要 workbook。 |
| `package.json` | 保持 `workflow:f2` 名称，将参数语义改为 F1 artifact 目录。 |
| `README.md`, `docs/README.md`, `docs/governance/feature-register.md` | 更新 F2 输入、阻塞语义、ADO 边界和 demo 命令。 |

## Compatibility Decisions

1. `createF2InitialWorkflow` 及其 v1 contract 不删除、不静默改义；现有 `workflow:f2` 命令原地迁移为 artifact consumer，不保留第二条容易混淆的 legacy CLI。
2. `partNumber` 作为 `worksheetFieldNameSchema` 的新增语义字段。没有 Part Number 列的现有模板由 composer 显示 `（缺失）`，不得回退到 `drawingNumber`。
3. F1 worksheet JSON 继续保留现有 `displayValue/actualValue/valueOrigin` 格式，只新增 `tolerancePathImage`；不把内部 `worksheet-analysis-assets` 整体泄漏到 artifact。
4. F2 只把九个业务字段和截面图缺失计入 worksheet blocking。能力范围/分布差异、库外、DIM ID 和 Part Number 缺失均非阻塞。
5. 新 CLI 不接受 `.xlsx`。真实 demo 先显式运行 F1 生成 artifacts，再运行 F2；这两条命令之间形成可检查边界。

### Task 1: Extend F1 Artifact Evidence

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`
- Modify: `scripts/run-f1-full-validation.mjs`

- [ ] **Step 1: Write failing Part Number extraction and contract tests.**

在现有匿名 OOXML test-support fixture 中新增 Part Number 表头和值，并放在不同于 Drawing Number 的列，断言两者保持独立；不要依赖真实 workbook 的当前填写内容：

```ts
expect(row.fields).toEqual(expect.objectContaining({
  drawingNumber: expect.objectContaining({ status: "available", rawText: "DWG-100" }),
  partNumber: expect.objectContaining({ status: "available", rawText: "PN-200" }),
}));
```

Also assert a template without a Part Number column remains schema-valid and does not relabel Drawing Number.

- [ ] **Step 2: Run focused tests and verify RED.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts
```

Expected: FAIL because `partNumber` is not a supported semantic field or header alias.

- [ ] **Step 3: Add the independent F1 semantic field.**

Add `partNumber` to `worksheetFieldNameSchema`, `HEADER_ALIASES` and `USER_INPUT_FIELDS`:

```ts
partNumber: ["part number", "part no", "part no.", "pn"],
```

Do not add Drawing Number aliases to this list. Keep `partNumber` textual, optional at extraction time and available to downstream artifact annotation.

- [ ] **Step 4: Export semantic tolerance-path evidence in every worksheet JSON.**

Add the existing worksheet evidence to `worksheetRecord`:

```js
tolerancePathImage: worksheet.tolerancePathImage,
```

Retain `imageAssets` with `contentHash`, `byteLength` and `outputFile`; the F2 loader will join the semantic image hash to the written image file. Do not add workbook bytes or original workbook path to worksheet artifacts.

- [ ] **Step 5: Re-run focused tests and commit.**

Run the Step 2 command. Expected: PASS.

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts scripts/run-f1-full-validation.mjs
git commit -m "feat: expose F1 part number artifacts"
```

### Task 2: Define Strict Artifact and User Report Contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write failing strict schema tests.**

Create fixtures for `f2ArtifactInputSchema` and `f2UserReportSchema`. The normalized input must contain no path to an Excel file and use this boundary:

```ts
{
  contractVersion: "v1",
  inputClassification: "confidential",
  artifactRoot: "test/demo-output/feature1-output/Demo",
  workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64), f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
  worksheets: [{
    worksheetName: "Analysis-A",
    worksheetJsonPath: "sheets/Demo.xlsx/json/Analysis-A.json",
    worksheetMdPath: "sheets/Demo.xlsx/md/Analysis-A.md",
    tolerancePathImage: { status: "available", imagePath: "sheets/Demo.xlsx/images/a.png", contentHash: "b".repeat(64) },
    factorTables: [],
  }],
}
```

Reject unknown keys, duplicate worksheet names, path traversal, mismatched summaries, `completed` reports with missing required fields, and ADO events with no identifier field. Model `F2UserReport` as a discriminated union: `inputRejected` contains `artifactIssues` and no worksheet business result; accepted runs contain `blocked`、`partiallyBlocked` or `completed` plus worksheets and business summaries.

- [ ] **Step 2: Run contract tests and verify RED.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL because both schemas and types are absent.

- [ ] **Step 3: Add normalized artifact schemas.**

Define strict annotated fields using the existing F1 artifact values:

```ts
const f1ArtifactFieldSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available"), sourceCell: worksheetSourceCellSchema, displayValue: z.string(), actualValue: z.union([z.string(), z.number()]), valueOrigin: z.enum(["text_literal", "numeric_literal", "formula_cached"]), numericValue: z.number().finite().optional() }).strict(),
  z.object({ status: z.literal("unavailable"), reasonCode: worksheetUnavailableReasonCodeSchema, sourceCell: worksheetSourceCellSchema.optional(), displayValue: z.literal(""), actualValue: z.literal(""), valueOrigin: z.literal("missing") }).strict(),
]);
```

Add strict factor table, worksheet, semantic image and top-level schemas. Relative artifact paths must reject absolute paths and `..` segments.

- [ ] **Step 4: Add the shared `F2UserReport` model and invariants.**

Use these user statuses:

```ts
type CapabilityStatus = "in_library_recommended" | "in_library_tolerance_outside" | "in_library_distribution_differs" | "in_library_tolerance_and_distribution_differ" | "outside_library" | "unable_to_check";
type F2Status = "inputRejected" | "blocked" | "partiallyBlocked" | "completed";
```

Each enhanced row contains the full displayed F1 fields, `missingRequiredFields`, capability status/recommendation, and `adoReminderRequested`. Add worksheet-level image status, missing-field summaries, category identifier summaries, deterministic ADO events and top-level counts. Super-refinement must recompute every count and derive status only from required-field/image blocking.

- [ ] **Step 5: Re-run tests and commit.**

Run Step 2. Expected: PASS.

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat: define F2 user report contracts"
```

### Task 3: Load and Validate F1 Artifact Bundles

**Files:**
- Create: `scripts/f2-artifact-loader.mjs`
- Create: `scripts/f2-artifact-loader.test.mjs`

- [ ] **Step 1: Write failing filesystem boundary tests.**

Build temporary anonymous directories in tests and cover: valid root JSON/MD + worksheet JSON/MD + semantic image; missing root MD; missing worksheet JSON; hash mismatch; duplicate worksheet; image hash without a matching file; zero-byte image; unsupported media type; and `../` path escape.

The valid assertion is:

```js
const loaded = loadF1ArtifactBundle(root);
expect(loaded.status).toBe("accepted");
expect(loaded.input.workbook.fileName).toBe("anonymous.xlsx");
expect(loaded.input.worksheets[0].tolerancePathImage).toEqual(expect.objectContaining({ status: "available" }));
expect(Object.hasOwn(loaded.input, "workbookBytes")).toBe(false);
expect(Object.hasOwn(loaded.input, "workbookPath")).toBe(false);
```

- [ ] **Step 2: Run loader tests and verify RED.**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f2-artifact-loader.test.mjs
```

Expected: FAIL because `loadF1ArtifactBundle` does not exist.

- [ ] **Step 3: Implement safe structured loading.**

Export:

```js
export function loadF1ArtifactBundle(artifactRoot) {
  // returns { status: "accepted", input } or { status: "inputRejected", report }
}
```

Use `resolve`, `relative`, `readFileSync` and `statSync`; reject any resolved child outside the root. Parse `Feature1-Report.json` for workbook identity and its structured `task15...sheets[].jsonPath`, `task16...sheets[].mdPath` and `sheetReadmePath`; require `Feature1-Report.md` and README to exist but do not scrape Markdown tables. Parse each worksheet JSON, verify workbook identity, join `tolerancePathImage.imageContentHash` to exactly one `imageAssets[].contentHash`, and verify the referenced `outputFile` exists, is nonempty and has supported media type.

- [ ] **Step 4: Return actionable `inputRejected` details without leaking file content.**

Use stable artifact reason codes such as `root_json_missing`, `root_md_missing`, `worksheet_json_missing`, `worksheet_md_missing`, `workbook_identity_mismatch`, `image_missing`, `image_empty`, `image_unsupported` and `path_outside_root`. Collect all safely discoverable issues and return an `inputRejected` `F2UserReport` branch so the CLI can still write JSON/Markdown; messages may include relative artifact paths but never raw worksheet values.

- [ ] **Step 5: Re-run tests and commit.**

Run Step 2. Expected: PASS.

```powershell
git add scripts/f2-artifact-loader.mjs scripts/f2-artifact-loader.test.mjs
git commit -m "feat: load F1 artifact bundles"
```

### Task 4: Compose Row-Centric F2 Results

**Files:**
- Create: `packages/workbook-catalog/src/f2-user-report.ts`
- Create: `packages/workbook-catalog/src/f2-user-report.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: Write failing row-composition tests.**

Cover one factor missing six required fields and assert one enhanced row, one row-level missing array and six summary field counts. Cover image missing once per worksheet. Cover `partNumber` and DIM ID missing with non-blocking status and one category event:

```ts
expect(result.worksheets[0]?.rows).toHaveLength(1);
expect(result.worksheets[0]?.rows[0]).toEqual(expect.objectContaining({
  displayedFields: expect.objectContaining({ partNumber: "（缺失）", dimCharacteristicId: "（缺失）" }),
  adoReminderRequested: true,
}));
expect(result.adoEvents).toEqual([expect.objectContaining({
  eventType: "adoReminderRequested",
  missingFields: ["dimCharacteristicId", "partNumber"],
})]);
```

Also prove tolerance/distribution differences do not block, and unknown/ambiguous mappings display `outside_library` with no recommendation.

- [ ] **Step 2: Run composer tests and verify RED.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f2-user-report.test.ts
```

Expected: FAIL because the composer is absent.

- [ ] **Step 3: Implement required-field and image composition.**

Export:

```ts
export function createF2UserReport(request: unknown): F2UserReport;
```

Check exactly `factorName`, `partName`, `partCategory`, `nominalValue`, `upperTolerance`, `lowerTolerance`, `longTermSafetyFactor`, `standardDeviation` and `distribution`. Render unavailable values as `（缺失）`; preserve available `displayValue`. A worksheet blocks when any row has a missing required field or its semantic tolerance-path image is unavailable.

- [ ] **Step 4: Add deterministic non-blocking capability comparison.**

For complete rows, call `loadKnowledgeBase({ version: "v1" }).matchCapabilityItem`. Unique matches compute `upperTolerance - lowerTolerance` and compare inclusive recommended bounds plus normalized distribution. Store `recommendedToleranceMin`, `recommendedToleranceMax`, `recommendedUnit: "mm"` and `recommendedDistribution`. Category gaps, unmatched and ambiguous rows map to `outside_library`; incomplete rows map to `unable_to_check`. Never add these states to blocking counts.

- [ ] **Step 5: Add identifier summaries and ADO interface events.**

Treat only `dimCharacteristicId` and `partNumber` as identifier reminder fields. Group missing fields by workbook + category + worksheet, sort categories/worksheets/rows deterministically, set `adoReminderRequested` on affected rows, and emit events without ADO project, owner, credentials or network calls. Missing category uses display category `（缺失）`.

- [ ] **Step 6: Validate, freeze and commit.**

Parse the final object with `f2UserReportSchema`, `structuredClone`, recursively freeze it, then run Step 2. Expected: PASS.

```powershell
git add packages/workbook-catalog/src/f2-user-report.ts packages/workbook-catalog/src/f2-user-report.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat: compose row-centric F2 reports"
```

### Task 5: Render the User-Friendly Markdown

**Files:**
- Modify: `scripts/f2-report.mjs`
- Modify: `scripts/f2-report.test.mjs`

- [ ] **Step 1: Replace old renderer expectations with failing user-report tests.**

Assert the Markdown contains `执行摘要`, `请修正 TA Excel 源文件并重新运行 F1`, `缺失字段统计`, `增强 Raw Data`, `能力库结果`, `知识库推荐`, `标识符提醒清单` and `待触发`. Assert one factor appears on exactly one raw-data row even when six fields are missing.

Also assert it does not contain:

```js
for (const internalTerm of ["required_field_unavailable", "tableId", "reasonCode", "governanceSignals"]) {
  expect(markdown).not.toContain(internalTerm);
}
```

- [ ] **Step 2: Run renderer tests and verify RED.**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f2-report.test.mjs
```

Expected: FAIL because the current renderer exposes internal issue arrays.

- [ ] **Step 3: Render the five approved report sections.**

Change the API to:

```js
export function renderF2Report(report) { /* Markdown only from F2UserReport */ }
```

Render Chinese execution summary, missing-field statistics, one enhanced table per worksheet, category identifier reminders and compact technical traceability. 每张增强表固定包含 `Row`、`Factor Description`、`Part Name`、`Part Number`、`DIM ID`、`Part Category`、`Design Nominal`、`+ Tolerance`、`- Tolerance`、`Long Term/Safety Factor`、`Sigma Level`、`Distribution`，再追加且只追加 `能力库结果` 和 `知识库推荐`；display unavailable values as `（缺失）`, and use `—` when no reliable recommendation exists.

- [ ] **Step 4: Re-run tests and commit.**

Run Step 2. Expected: PASS.

```powershell
git add scripts/f2-report.mjs scripts/f2-report.test.mjs
git commit -m "feat: render readable F2 reports"
```

### Task 6: Switch CLI to F1 Artifacts and Produce the Real Demo

**Files:**
- Modify: `scripts/f2-output-layout.mjs`
- Modify: `scripts/f2-output-layout.test.mjs`
- Modify: `scripts/run-f2-full-validation.mjs`
- Create: `scripts/f2-artifact-flow.test.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/governance/feature-register.md`

- [ ] **Step 1: Write failing CLI layout and artifact-only flow tests.**

Call the CLI with an anonymous temporary F1 directory and no `.xlsx` file. Assert both reports exist, JSON parses with `f2UserReportSchema`, Markdown has one row per factor, and the output directory derives from `workbook.fileName`. Assert passing an `.xlsx` path fails with `Feature 2 requires a Feature 1 artifact directory`.

- [ ] **Step 2: Run executable tests and verify RED.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f2-output-layout.test.mjs scripts/f2-artifact-flow.test.mjs
```

Expected: FAIL because the CLI still reads workbook bytes and re-runs F0/F1.

- [ ] **Step 3: Replace workbook orchestration with artifact orchestration.**

The CLI must execute only:

```js
const loaded = loadF1ArtifactBundle(process.argv[2]);
const report = loaded.status === "inputRejected"
  ? loaded.report
  : createF2UserReport({ ...loaded.input, knowledgeBaseVersion: "v1", mappingRuleVersion: "v1" });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(mdPath, `${renderF2Report(report)}\n`);
```

Remove imports and calls for `readFileSync(workbookPath)`, `createWorkbookCatalog`, `createWorksheetSelectionView` and `createWorksheetAnalysisAssetsParallel`. Keep generated outputs ignored by Git.

- [ ] **Step 4: Update usage and governance documentation.**

Document the exact workflow:

```powershell
npm run workflow:f1 -- "test/<workbook>.xlsx"
npm run workflow:f2 -- "test/demo-output/feature1-output/<workbook-safe-name>"
```

State that nine business fields + semantic image block; capability differences and identifier reminders do not; ADO is only a pending interface event.

- [ ] **Step 5: Run focused and full validation.**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-artifact-loader.test.mjs scripts/f2-report.test.mjs scripts/f2-output-layout.test.mjs scripts/f2-artifact-flow.test.mjs
npm test
npm run check:repository
git diff --check
```

Expected: all focused/new tests pass; full suite and repository verifier pass. Existing unrelated full-lint baseline findings may be reported but no touched-file lint finding is allowed.

- [ ] **Step 6: Regenerate F1 and run the real F2 demo.**

First regenerate the real F1 artifacts so they contain `tolerancePathImage` and the new field vocabulary, then run F2 only against that directory:

```powershell
npm run workflow:f1 -- "test/Maera_gap_TP_brkt_and _battery_20260305V1.xlsx"
npm run workflow:f2 -- "test/demo-output/feature1-output/Maera_gap_TP_brkt_and-_battery_20260305V1"
```

Validate `Feature2-Report.json` with `f2UserReportSchema`, compare its summary to the Markdown header, confirm `Feature2-Report.md` has no internal issue codes, and confirm no generated report or confidential workbook is tracked.

- [ ] **Step 7: Commit implementation and acceptance coverage.**

```powershell
git add scripts/f2-output-layout.mjs scripts/f2-output-layout.test.mjs scripts/run-f2-full-validation.mjs scripts/f2-artifact-flow.test.mjs package.json README.md docs/README.md docs/governance/feature-register.md
git commit -m "feat: run F2 from F1 artifacts"
```

Do not stage `test/demo-output/**`, real workbooks or temporary inspection files.

### Task 7: Correct Real Workbook Field Fidelity

**Files:**
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`
- Modify: `scripts/f1-dual-grid.mjs`
- Modify: `scripts/f1-dual-grid.test.mjs`
- Modify: `scripts/run-f1-full-validation.mjs`

- [ ] **Step 1: Write failing regressions for the real template vocabulary and artifact fidelity.**

Add a worksheet extraction test whose header is exactly `σ Level` and assert it produces an available
`standardDeviation` field with numeric value `4`. Add dual-grid helper tests that assert an annotated numeric
field uses XLSX display text `0.280` while retaining numeric `actualValue: 0.28`, and that worksheet selection
removes `Example_TA` from both detected defaults and manifest-provided names.

- [ ] **Step 2: Run the focused tests and verify RED.**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts scripts/f1-dual-grid.test.mjs
```

Expected: the `σ Level` assertion fails because the alias is absent; artifact annotation and example-page
selection assertions fail because the helpers do not yet exist.

- [ ] **Step 3: Implement the minimal source fixes.**

Add `"σ level"` to the controlled `standardDeviation` aliases. Export small pure helpers from
`scripts/f1-dual-grid.mjs` to annotate an extracted field with a supplied XLSX display value and to filter
worksheet names whose normalized value is exactly `example_ta`. In `run-f1-full-validation.mjs`, derive each
field's display text from its `sourceCell` in `dualWorksheetSheet`; retain numeric actual/numeric values and use
the filtered selection for both default and manifest paths.

- [ ] **Step 4: Verify focused behavior and regenerate the real reports.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts scripts/f1-dual-grid.test.mjs packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-artifact-flow.test.mjs
npm run workflow:f1 -- "test/Maera_gap_TP_brkt_and _battery_20260305V1.xlsx"
npm run workflow:f2 -- "test/demo-output/feature1-output/Maera_gap_TP_brkt_and-_battery_20260305V1"
```

Expected: `Example_TA` is absent; `gap wo rubber_TPoverload500g` row 20 shows Sigma Level `4.0`, tolerance
`0.280`, and a deterministic capability result other than `无法检查`.

- [ ] **Step 5: Run repository checks and commit.**

```powershell
npm exec -- eslint packages/workbook-catalog/src/worksheet-analysis-assets.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts scripts/f1-dual-grid.mjs scripts/f1-dual-grid.test.mjs scripts/run-f1-full-validation.mjs
npm run check:repository
git diff --check
git add docs/superpowers/specs/2026-08-03-f2-artifact-report-redesign.md docs/superpowers/plans/2026-08-03-f2-artifact-report-redesign.md packages/workbook-catalog/src/worksheet-analysis-assets.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts scripts/f1-dual-grid.mjs scripts/f1-dual-grid.test.mjs scripts/run-f1-full-validation.mjs
git commit -m "fix: preserve F1 worksheet field fidelity"
```

### Task 8: Route F2 Capability Decisions Through F0

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Create: `packages/workbook-catalog/src/f0-capability-router.ts`
- Create: `packages/workbook-catalog/src/f0-capability-router.test.ts`
- Modify: `packages/workbook-catalog/src/f2-user-report.ts`
- Modify: `packages/workbook-catalog/src/f2-user-report.test.ts`
- Modify: `scripts/f2-report.mjs`
- Modify: `scripts/f2-report.test.mjs`
- Modify: `scripts/run-f2-full-validation.mjs`
- Modify: `scripts/f2-artifact-flow.test.mjs`

- [ ] **Step 1: Write failing strict contract tests for dual F0 results.**

Change the accepted report fixture to carry:

```ts
knowledgeBaseVersions: ["v1", "internal-v1"],
```

Add accepted enhanced-row fixtures for these internal results:

```ts
{
  capabilityStatus: "internal_within_guidance",
  f0KnowledgeBaseVersion: "internal-v1",
  recommendation: {
    kind: "internal-guidance",
    assessedTotalBand: 0.2,
    maximumRecommendedTotalBand: 0.2,
    unit: "mm",
    matchedEntryId: "cnc-linear-6",
    fallbackApplied: false,
    evidence: {
      sourceFileHash: "a".repeat(64),
      sheetName: "ISO 2768-1 Class m",
      sourceRange: "A6:F6",
    },
  },
}
```

Also cover `internal_guidance_exceeded`, `f0_information_insufficient`,
`non_f0_process_category`, existing public recommendation states, and `unable_to_check`.
Require internal matched states to have `internal-v1` plus an internal recommendation; public matched
states to have `v1` plus a public recommendation; information-insufficient to have `internal-v1` and no
recommendation; non-F0 and unable states to have no recommendation. Replace ambiguous summary fields with:

```ts
internalWithinGuidanceCount: number;
internalGuidanceExceededCount: number;
f0InformationInsufficientCount: number;
publicLibraryMatchCount: number;
nonF0ProcessCategoryCount: number;
unableToCheckCount: number;
publicToleranceDifferenceCount: number;
publicDistributionDifferenceCount: number;
```

- [ ] **Step 2: Run contract tests and verify RED.**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL because internal capability states, dual versions, recommendation union and new summaries do
not exist.

- [ ] **Step 3: Implement the strict F2 report contract migration.**

Define `f2CapabilityStatusSchema` with existing public states plus:

```ts
"internal_within_guidance"
"internal_guidance_exceeded"
"f0_information_insufficient"
"non_f0_process_category"
"unable_to_check"
```

Make `recommendation` a strict discriminated union on `kind`:

```ts
{ kind: "public", toleranceMin, toleranceMax, unit: "mm", distribution, capabilityEntryId }
{ kind: "internal-guidance", assessedTotalBand, maximumRecommendedTotalBand, unit: "mm", matchedEntryId, fallbackApplied, evidence }
```

Add `f0KnowledgeBaseVersion?: "v1" | "internal-v1"` and
`f0InformationReason?: "missing_process_context" | "invalid_total_band" | "guidance_unknown"` with
super-refinement matching the row status. Replace top-level `knowledgeBaseVersion` with the exact tuple
`knowledgeBaseVersions: ["v1", "internal-v1"]` and recompute every new summary count from rows.

- [ ] **Step 4: Re-run contract tests and verify GREEN.**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Write failing tests for a pure F0 capability router.**

Create tests for `createF0CapabilityRouter` using injected fake F0 APIs. Assert:

1. `CNC`, nominal `3.145`, upper `0.1`, lower `-0.1` calls internal F0 exactly once with
   `cnc-machining`, `linear-dimension`, nominal `3.145` and total band `0.2`, then returns
   `internal_within_guidance` with the unchanged F0 evidence.
2. Negative TA nominal is normalized with `Math.abs`.
3. F0 `guidance-exceeded` becomes `internal_guidance_exceeded`.
4. `Sheetmetal`, die cast, die cut, PCB/FPC and plastic aliases return
   `f0_information_insufficient` with `missing_process_context` and do not fabricate an internal query.
5. A public demo category still uses the injected public API and returns the existing public result.
6. `Assembly` and `Other` return `non_f0_process_category` rather than an internal result.
7. Missing required business fields are handled by the composer and never call either router dependency.

- [ ] **Step 6: Run router tests and verify RED.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f0-capability-router.test.ts
```

Expected: FAIL because the router module does not exist.

- [ ] **Step 7: Implement the router exclusively through F0 APIs.**

Export:

```ts
export function createF0CapabilityRouter(dependencies = {
  publicKnowledgeBase: loadKnowledgeBase({ version: "v1" }),
  internalGuidance: loadInternalToleranceGuidance({ version: "internal-v1" }),
}) {
  return { assess(row: F0CapabilityRow): F0CapabilityAssessment { /* routing only */ } };
}
```

Keep exact normalized alias sets in the router. Do not import seed files or copy any tolerance threshold.
For CNC, call `internalGuidance.assessToleranceGuidance`; preserve its status, entry ID, maximum band,
fallback flag and evidence. For the five process families whose required conditions are not present in F1,
return information-insufficient before query. For non-process categories, call public
`matchCapabilityItem`; only explicit public matches may produce public recommendation results.

- [ ] **Step 8: Re-run router tests and verify GREEN.**

Run the Step 6 command. Expected: PASS.

- [ ] **Step 9: Write failing composer and renderer integration tests.**

Update `f2-user-report.test.ts` to inject the router and prove incomplete rows make no F0 call, while CNC,
Sheetmetal and Other produce the three distinct statuses without changing worksheet blocking. Update renderer
fixtures and assert the Chinese labels `F0 内部指导-符合`, `F0 内部指导-超出`, `F0 信息不足`,
`非 F0 制程分类`, and recommendation text
`最大总公差带 0.2 mm · internal-v1 · cnc-linear-6`. Assert Markdown contains no internal source filename
or SHA-256 evidence.

- [ ] **Step 10: Run integration tests and verify RED.**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-report.test.mjs scripts/f2-artifact-flow.test.mjs
```

Expected: FAIL because composer and renderer still use the public-only states.

- [ ] **Step 11: Connect the router to composer, CLI and Markdown.**

Change `createF2UserReport(request, dependencies?)` so complete rows call the router and incomplete rows stay
`unable_to_check`. Pass `knowledgeBaseVersions: ["v1", "internal-v1"]` from the CLI request. Render the new
summary counts and labels, internal maximum band/version/entry ID, public range/distribution, and `—` for all
no-recommendation states. Technical traceability must list both F0 versions.

- [ ] **Step 12: Run focused tests and real F0-to-F2 acceptance.**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/knowledge-base/src/internal/query.test.ts packages/workbook-catalog/src/f0-capability-router.test.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-report.test.mjs scripts/f2-artifact-loader.test.mjs scripts/f2-artifact-flow.test.mjs
npm run workflow:f2 -- "test/demo-output/feature1-output/Maera_gap_TP_brkt_and-_battery_20260305V1"
```

Parse the real JSON with `f2UserReportSchema`. Assert every CNC row has an internal status and
`f0KnowledgeBaseVersion: "internal-v1"`, Sheetmetal rows are information-insufficient, Assembly/Other rows
are non-F0 categories, `unableToCheckCount` remains zero, and Markdown contains no CNC row labelled `库外`.

- [ ] **Step 13: Validate and commit.**

```powershell
npm exec -- eslint packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f0-capability-router.ts packages/workbook-catalog/src/f0-capability-router.test.ts packages/workbook-catalog/src/f2-user-report.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-report.mjs scripts/f2-report.test.mjs scripts/run-f2-full-validation.mjs scripts/f2-artifact-flow.test.mjs
npm run check:repository
git diff --check
git add docs/superpowers/plans/2026-08-03-f2-artifact-report-redesign.md packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f0-capability-router.ts packages/workbook-catalog/src/f0-capability-router.test.ts packages/workbook-catalog/src/f2-user-report.ts packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-report.mjs scripts/f2-report.test.mjs scripts/run-f2-full-validation.mjs scripts/f2-artifact-flow.test.mjs
git commit -m "feat: route F2 capability checks through F0"
```

Do not stage generated reports, confidential workbooks or F0 source workbooks.