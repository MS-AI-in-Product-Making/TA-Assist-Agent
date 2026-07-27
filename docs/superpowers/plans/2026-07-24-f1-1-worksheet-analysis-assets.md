# F1.1 TA 工作表分析资产提取 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从与 F1 catalog 内容 hash 绑定的受控 confidential workbook 提取 TA worksheet 因子表、公式缓存和内嵌图像元数据，并提供安全图像二进制读取。

**Architecture:** `@ai-assist/contracts` 定义严格 F1.1 schemas。`@ai-assist/workbook-catalog` 扩展现有受限 OOXML reader 的 drawing/media relationship 读取，新增 assets service：先复核 F1 catalog hash，再只处理 catalog worksheet，输出深度冻结资产包。图像读取接口每次重新验证 workbook hash，按 image hash 返回防御性字节副本。

**Tech Stack:** TypeScript ES2024/NodeNext、Zod v3、Vitest v3、Node crypto、现有 fflate 与 xmldom。

**Design:** [2026-07-24-f1-1-worksheet-analysis-assets-design.md](../specs/2026-07-24-f1-1-worksheet-analysis-assets-design.md)

---

## File Structure

- `packages/contracts/src/contracts.ts` and `contracts.test.ts`: F1.1 request/result/image-read schemas and types.
- `packages/workbook-catalog/src/ooxml-reader.ts`, `ooxml-reader.test.ts`, and `test-support.ts`: bounded internal drawing/media records and anonymous in-memory fixtures.
- `packages/workbook-catalog/src/worksheet-analysis-assets.ts` and `.test.ts`: catalog-bound table/formula/image assets and controlled reads.
- `packages/workbook-catalog/src/index.ts`: public F1.1 exports.
- `packages/governance/src/feature-register.ts`, `policy-gate.test.ts`, `README.md`, and `docs/README.md`: F1.1 acceptance registration and real scope documentation.

### Task 1: Define F1.1 Runtime Contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: Write failing schema tests.** Import `worksheetAnalysisAssetsRequestSchema`, `worksheetAnalysisAssetsResultSchema`, and `worksheetImageReadRequestSchema`. Build a minimal `workbookCatalogResultSchema.parse` catalog. Test valid confidential request; reject public input, upper-case hash, extra fields, image reads missing either hash, and unavailable fields containing raw text.

```ts
expect(worksheetAnalysisAssetsRequestSchema.safeParse({
  contractVersion: "v1", inputClassification: "confidential",
  workbookBytes: new Uint8Array([0x50, 0x4b, 3, 4]), workbookCatalog: catalog,
}).success).toBe(true);
expect(worksheetAnalysisAssetsResultSchema.safeParse({
  contractVersion: "v1",
  workbook: { classification: "confidential", contentHash: "A".repeat(64), catalogContractVersion: "v1" },
  worksheets: [],
}).success).toBe(false);
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npm test -- packages/contracts/src/contracts.test.ts`

Expected: FAIL because F1.1 contract exports are absent.

- [ ] **Step 3: Add strict schemas.** Define lower-case SHA-256; strict request/result objects; available/unavailable field union; parsed number/unit; table/row/column; formula cache state; image anchor/metadata; and image read request/result. Available fields retain `rawText` plus source; unavailable fields expose only reason code and optional source cell.

```ts
export const worksheetAssetUnavailableFieldSchema = z.object({
  status: z.literal("unavailable"),
  reasonCode: z.enum(["missing", "duplicate_mapping", "invalid_format", "ambiguous_mapping", "missing_cached_value"]),
  sourceCell: z.string().regex(/^[^!]+![A-Z]+[1-9]\d*$/).optional(),
}).strict();
```

Export `WorksheetAnalysisAssetsRequest`, `WorksheetAnalysisAssetsResult`, `WorksheetImageReadRequest`, and `WorksheetImageReadResult`.

- [ ] **Step 4: Verify and commit.**

Run: `npm test -- packages/contracts/src/contracts.test.ts`

Expected: PASS.

Run: `npm run build -- --force`

Expected: PASS.

Run: `git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts; git commit -m "feat: define F1.1 asset contracts"`

Expected: commit created.

### Task 2: Read Bounded OOXML Drawing and Media Evidence

**Files:**
- Modify: `packages/workbook-catalog/src/ooxml-reader.ts`
- Modify: `packages/workbook-catalog/src/ooxml-reader.test.ts`
- Modify: `packages/workbook-catalog/src/test-support.ts`

- [ ] **Step 1: Write failing reader tests.** Extend anonymous in-memory ZIP fixture with worksheet `.rels`, drawing XML, drawing `.rels`, and two anonymous binary media parts. Assert `Analysis-A` returns image hash, MIME, size, drawing/media source, two-cell and one-cell anchors. Add external target mode, path escape, duplicate target, and 65-image negative cases.

```ts
expect(workbook.worksheets.get("Analysis-A")?.images).toEqual([
  expect.objectContaining({ mediaType: "image/png", anchor: { from: "C3", to: "K20" } }),
  expect.objectContaining({ mediaType: "image/jpeg", anchor: { from: "A1", to: "A1" } }),
]);
```

- [ ] **Step 2: Run reader tests to verify failure.**

Run: `npm test -- packages/workbook-catalog/src/ooxml-reader.test.ts`

Expected: FAIL because `images` is absent.

- [ ] **Step 3: Extend fixture and parser.** Add static-anonymous XML fixture options for drawing, external relation and image count. Extend `OoxmlWorksheet` with `images`; validate worksheet/drawing relationship namespaces and child hierarchy; resolve only safe internal relative targets. Enforce 64 images per worksheet and 256 per workbook. Map png/jpeg/gif/bmp/tiff/emf/wmf, otherwise `application/octet-stream`; do not render, OCR, or infer semantics.

```ts
export interface OoxmlImage {
  readonly contentHash: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly sourcePart: string;
  readonly drawingSourcePart: string;
  readonly anchor?: { readonly from: string; readonly to: string };
  readonly bytes: Uint8Array;
}
```

- [ ] **Step 4: Verify and commit.**

Run: `npm test -- packages/workbook-catalog/src/ooxml-reader.test.ts`

Expected: PASS.

Run: `npm run build -- --force`

Expected: PASS.

Run: `git add packages/workbook-catalog/src/ooxml-reader.ts packages/workbook-catalog/src/ooxml-reader.test.ts packages/workbook-catalog/src/test-support.ts; git commit -m "feat: read bounded worksheet image evidence"`

Expected: commit created.

### Task 3: Extract Catalog-Bound Factor Tables and Formula Evidence

**Files:**
- Create: `packages/workbook-catalog/src/worksheet-analysis-assets.ts`
- Create: `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

- [ ] **Step 1: Write failing service tests.** Build an anonymous workbook with two catalogued analysis sheets. `Analysis-A` has two shifted-header tables, a fully blank mapped row, all supported aliases, one formula with cache, one without, malformed numeric/unit data, and valid `1.25 mm`. Build F1 catalog from same bytes. Assert two tables, blank-row termination, exact sources, cacheless formula unavailable, malformed field unavailable, and surviving worksheet.

```ts
expect(result.worksheets[0]!.factorTables).toHaveLength(2);
expect(result.worksheets[0]!.factorTables[0]!.dataRange).toEqual({ startRow: 13, endRow: 14 });
expect(result.worksheets[0]!.factorTables[0]!.rows[0]!.fields.nominalValue).toMatchObject({
  status: "available", rawText: "1.25 mm", numericValue: 1.25, unit: "mm", sourceCell: "Analysis-A!C13",
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npm test -- packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

Expected: FAIL because `createWorksheetAnalysisAssets` is missing.

- [ ] **Step 3: Implement request gate and catalog binding.** Safely inspect classification before byte access; reject non-confidential input with `policy_denied`; validate schema; hash bytes before OOXML reader; require equality with F1 catalog hash; iterate only catalog `analyses` in catalog order. Use only fixed summaries `Worksheet-analysis assets request is invalid.`, `Worksheet-analysis assets input is not permitted.`, and `Worksheet-analysis assets archive cannot be processed.`

```ts
const contentHash = createHash("sha256").update(parsed.data.workbookBytes).digest("hex");
if (contentHash !== parsed.data.workbookCatalog.workbook.contentHash) {
  throw assetsError("Worksheet-analysis assets request is invalid.", "workbook-catalog");
}
```

- [ ] **Step 4: Implement table/formula extraction.** Normalize exact aliases only by trim, collapsed whitespace, lowercase. A unique factor-name mapping starts a table. Read down to first row where all mapped columns are missing/blank; output every matching table. Preserve raw source; parse number/unit only when unambiguous; never convert units. Formula cache absence yields `missing_cached_value`; table formula fields are excluded from duplicate worksheet-wide formula records.

```ts
const HEADER_ALIASES = {
  factorName: ["factor", "factor name"], nominalValue: ["nominal", "nominal value"],
  upperTolerance: ["upper tol", "upper tolerance"], lowerTolerance: ["lower tol", "lower tolerance"],
  unit: ["unit"], distribution: ["distribution", "assumption"], contribution: ["contribution"],
  sensitivity: ["sensitivity"], mean: ["mean"], standardDeviation: ["standard deviation", "sigma"],
  cpk: ["cpk"], upperSpecificationLimit: ["usl", "upper spec limit"],
  lowerSpecificationLimit: ["lsl", "lower spec limit"], assemblyDirection: ["assembly direction"],
} as const;
```

- [ ] **Step 5: Validate, clone, freeze, verify, and commit.** Validate final output with result schema, `structuredClone`, recursively freeze nested arrays/objects.

Run: `npm test -- packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

Expected: PASS.

Run: `npm run build -- --force`

Expected: PASS.

Run: `git add packages/workbook-catalog/src/worksheet-analysis-assets.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts; git commit -m "feat: extract F1.1 factor and formula assets"`

Expected: commit created.

### Task 4: Add Metadata-Only Images and Hash-Gated Reads

**Files:**
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

- [ ] **Step 1: Write failing image tests.** Use anonymous `new Uint8Array([1, 2, 3, 4])`. Assert asset result has hash/type/size/worksheet/relationship/anchor but no `bytes`. Read with both hashes; assert byte equality but distinct reference, mutate returned bytes, read again and prove it unchanged. Reject hash mismatch, unknown hash, public input, duplicate image hash, and error marker leakage.

```ts
expect(result.worksheets[0]!.imageAssets[0]).not.toHaveProperty("bytes");
const first = readWorksheetImageAsset(imageRequest(workbookBytes, workbookHash, imageHash));
expect(first.bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npm test -- packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

Expected: FAIL because controlled image reads are missing.

- [ ] **Step 3: Implement metadata and controlled reads.** Do not inline bytes. Preserve metadata; emit unavailable anchor state when no anchor parsed. Validate image request, hash workbook before OOXML open, require submitted hash equality, require exactly one matching image, return new mutable `Uint8Array`. Freeze response metadata but not its byte clone.

```ts
return Object.freeze({
  contractVersion: "v1", classification: "confidential", workbookContentHash: contentHash,
  imageContentHash: image.contentHash, mediaType: image.mediaType, bytes: new Uint8Array(image.bytes),
});
```

- [ ] **Step 4: Verify and commit.**

Run: `npm test -- packages/workbook-catalog/src/worksheet-analysis-assets.test.ts packages/workbook-catalog/src/ooxml-reader.test.ts`

Expected: PASS.

Run: `npm run build -- --force`

Expected: PASS.

Run: `git add packages/workbook-catalog/src/worksheet-analysis-assets.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts; git commit -m "feat: add controlled F1.1 image reads"`

Expected: commit created.

### Task 5: Publish and Register F1.1

**Files:**
- Modify: `packages/workbook-catalog/src/index.ts`
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `README.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Write failing export/governance tests.** Assert built ESM import exposes both APIs. Update F1 expected registry dependencies with `worksheet-analysis-assets-v1` and checks `anonymous-worksheet-analysis-assets-fixture`, `worksheet-image-controlled-read`, `worksheet-assets-privacy-check`; assert F2-F7 stay unavailable.

```ts
expect(getFeatureStatus("F1").dependsOn).toEqual([
  "workbook-catalog-v1", "worksheet-analysis-assets-v1",
]);
expect(getFeatureStatus("F2").status).toBe("unavailable");
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npm test -- packages/workbook-catalog/src/worksheet-analysis-assets.test.ts packages/governance/src/policy-gate.test.ts`

Expected: FAIL because exports and registry are incomplete.

- [ ] **Step 3: Export, document, verify, and commit.** Export both functions/types. Document header-driven factor/table evidence, cached-only formula evidence, metadata-only internal images and hash-gated reads. Explicitly exclude F2 cleaning, F4 calculation/unit conversion, F5 interpretation, OCR/rendering, file writes, external services, and paths.

```ts
export { createWorksheetAnalysisAssets, readWorksheetImageAsset } from "./worksheet-analysis-assets.js";
export type { WorksheetAnalysisAssetsRequest, WorksheetAnalysisAssetsResult, WorksheetImageReadRequest, WorksheetImageReadResult } from "@ai-assist/contracts";
```

Run: `npm test -- packages/workbook-catalog/src/worksheet-analysis-assets.test.ts packages/governance/src/policy-gate.test.ts`

Expected: PASS.

Run: `git add packages/workbook-catalog/src/index.ts packages/governance/src/feature-register.ts packages/governance/src/policy-gate.test.ts README.md docs/README.md; git commit -m "docs: register F1.1 worksheet asset support"`

Expected: commit created.

### Task 6: Security and Repository Acceptance

**Files:**
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`

- [ ] **Step 1: Add final regressions.** Prove nested output mutation cannot affect later call; errors/results omit anonymous cell/formula/media markers; mismatched catalog fails before reader; result has no `risk`, `recommendation`, `calculation`, or `ocrText`.

```ts
expect(JSON.stringify(error)).not.toContain("anonymous-private-marker");
expect(result).not.toHaveProperty("risk");
expect(result.worksheets[0]).not.toHaveProperty("recommendation");
```

- [ ] **Step 2: Run focused acceptance.**

Run: `npm test -- packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/zip-security.test.ts packages/workbook-catalog/src/ooxml-reader.test.ts packages/workbook-catalog/src/workbook-catalog.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts packages/governance/src/policy-gate.test.ts`

Expected: PASS.

- [ ] **Step 3: Run repository gates.**

Run: `npm run build -- --force`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm test`

Expected: PASS.

Run: `npm run check:repository`

Expected: PASS.

Run: `npm ci --dry-run`

Expected: PASS.

Run: `git diff --check`

Expected: no output and exit code 0.

Run: `git ls-files | Select-String '\.(xlsx|xlsm)$|^test/|^fixtures/confidential/'`

Expected: no output.

- [ ] **Step 4: Commit final acceptance.**

Run: `git add packages/workbook-catalog/src/worksheet-analysis-assets.test.ts; git commit -m "test: verify F1.1 worksheet asset acceptance"`

Expected: commit created.

## PR Delivery Check

- [ ] `git status --short --branch` shows only expected F1.1 work.
- [ ] `git diff main...HEAD --check` has no whitespace errors.
- [ ] PR describes catalog-hash binding, exact header extraction, field-level unavailable states, cached-only formulas, metadata-only images, hash-gated reads, anonymous fixtures, and F2/F4/F5/OCR exclusions.
- [ ] No real `.xlsx`/`.xlsm`, screenshot, drawing, formula, factor value, `test/`, or `fixtures/confidential/` content is tracked.