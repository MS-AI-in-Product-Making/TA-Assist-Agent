# F1 TA 工作簿目录首版实施计划

> **执行方式：**使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项执行；每项完成后更新 checkbox。

**目标：**仅从受控 `confidential` `.xlsx` 字节创建只读、版本化的 TA worksheet catalog，保留 `Title Page` 元数据与 `Auto Summary` 来源关系；不接收路径、URL 或文件句柄，不保存或导出原始工作簿。

**架构：**新增 `@ai-assist/workbook-catalog` package。它调用受限 ZIP/OOXML reader，解析 workbook relationship、`Title Page`、`Auto Summary` 和 shared strings。通过 Zod 严格验证输入、输出以及深拷贝/冻结 DTO。所有匿名测试数据由 Vitest 在内存生成 OOXML ZIP，因此不会提交 `.xlsx`。

**技术：**TypeScript ES2024/NodeNext、Zod v3、Vitest v3、`fflate@^0.8.2`、`@xmldom/xmldom@^0.9.10`、Node `crypto`。

**设计：**[2026-07-23-f1-workbook-catalog-design.md](../specs/2026-07-23-f1-workbook-catalog-design.md)

## 固定安全界限

在 `packages/workbook-catalog/src/zip-security.ts` 定义且不允许调用方覆盖：

```ts
export const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 256;
export const MAX_SINGLE_UNCOMPRESSED_BYTES = 4 * 1024 * 1024;
export const MAX_TOTAL_UNCOMPRESSED_BYTES = 16 * 1024 * 1024;
export const MAX_COMPRESSION_RATIO = 100;
```

ZIP reader 拒绝 ZIP64、加密 entry、非 deflate/stored method、重复或空 entry、绝对路径、`\0`、反斜杠、`..` 段、目录 entry、超过任一上限或声明/实际解压大小不一致的 entry。必须有 `[Content_Types].xml`、`_rels/.rels`、`xl/workbook.xml`、`xl/_rels/workbook.xml.rels`。解析 XML 前以词法方式拒绝 `<!DOCTYPE`、`<!ENTITY` 和 XML declaration 外的每一个 processing instruction（不区分大小写）；后续使用 `DOMParser`，且 diagnostics fatal。

所有异常使用 `createTypedError`，不得包含路径、异常消息或单元格内容。摘要只能是：

```text
Workbook-catalog request is invalid.
Workbook-catalog input is not permitted.
Workbook-catalog archive cannot be processed.
```

`affectedInputReferences` 仅可使用 `workbook-request`、`workbook-archive`、`workbook-structure`、`title-page`、`auto-summary`、`analysis-row-<row>`。

## 任务 1：F1 契约和 package skeleton

**文件：**
- Modify: `package.json`、`package-lock.json`、`tsconfig.json`
- Modify: `packages/contracts/src/contracts.ts`、`packages/contracts/src/contracts.test.ts`
- Create: `packages/workbook-catalog/package.json`、`tsconfig.json`、`src/index.ts`

- [ ] **先添加失败测试。**在 `contracts.test.ts` import `workbookCatalogRequestSchema` 和 `workbookCatalogResultSchema`。验证接受下列请求：

```ts
{
  contractVersion: "v1", fileName: "anonymous-ta.xlsx",
  inputClassification: "confidential", workbookBytes: new Uint8Array([0x50, 0x4b, 3, 4]),
}
```

验证拒绝 `C:\private.xlsx`、`../private.xlsx`、`public` 分类、空字节、额外字段。验证目录结果拒绝额外 `rawValue` 字段与非 `confidential` 输出分类。

- [ ] **确认测试红灯。**

```powershell
npm test -- packages/contracts/src/contracts.test.ts
```

预期：F1 schema 尚未导出。

- [ ] **在 `contracts.ts` 添加严格 schema 和 type。**每个 `z.object` 必须 `.strict()`：

```ts
const workbookFileNameSchema = z.string().min(1).max(240)
  .refine((value) => !/[\\/]/.test(value) && !value.includes(".."))
  .refine((value) => value.toLowerCase().endsWith(".xlsx"));

export const workbookCatalogRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  fileName: workbookFileNameSchema,
  inputClassification: z.literal("confidential"),
  workbookBytes: z.instanceof(Uint8Array).refine((value) => value.byteLength > 0),
}).strict();

export const workbookCatalogDateSchema = z.object({
  value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  formula: z.string().min(1).optional(),
  sourceCell: z.string().regex(/^Title Page![A-Z]+[1-9]\d*$/),
}).strict();

export const workbookCatalogAnalysisSchema = z.object({
  worksheetName: z.string().min(1),
  toleranceLoopDescription: z.string().min(1),
  source: z.object({
    summarySheet: z.literal("Auto Summary"),
    summaryRow: z.number().int().positive(),
    worksheetAnchor: z.string().regex(/^.+!A1$/),
  }).strict(),
}).strict();

export const workbookCatalogResultSchema = z.object({
  contractVersion: contractVersionSchema,
  workbook: z.object({
    fileName: workbookFileNameSchema,
    classification: z.literal("confidential"),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    metadata: z.object({
      documentNo: z.string().min(1), revision: z.string().min(1), date: workbookCatalogDateSchema,
    }).strict(),
  }).strict(),
  analyses: z.array(workbookCatalogAnalysisSchema).min(1),
}).strict();
```

导出 `WorkbookCatalogRequest` 和 `WorkbookCatalogResult` infer types。现有 `index.ts` 的 `export *` 可自动公开 schema。

- [ ] **创建 package 并安装依赖。**`package.json` 应沿用 knowledge-base ESM exports，依赖为 `@ai-assist/contracts: 0.1.0`、`zod: ^3.24.0`、`fflate: ^0.8.2`、`@xmldom/xmldom: ^0.9.10`。`tsconfig.json` 引用 `../contracts` 并设 `composite`、`rootDir: src`、`outDir: dist`。根 `tsconfig.json` 新增唯一 project reference。创建空 `src/index.ts` 后执行：

```powershell
npm install --package-lock-only --ignore-scripts
npm test -- packages/contracts/src/contracts.test.ts
npm run build -- --force
npm ci --dry-run
```

预期：契约通过、workspace 可构建、lockfile 可干净安装。

- [ ] **提交。**

```powershell
git add package.json package-lock.json tsconfig.json packages/contracts packages/workbook-catalog
git commit -m "feat: define F1 workbook catalog contracts"
```

## 任务 2：受限 ZIP 与 OOXML 读取器

**文件：**
- Create: `packages/workbook-catalog/src/zip-security.ts`、`zip-security.test.ts`
- Create: `packages/workbook-catalog/src/ooxml-reader.ts`、`ooxml-reader.test.ts`
- Create: `packages/workbook-catalog/src/test-support.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **先创建匿名 in-memory fixture builder 与失败测试。**`test-support.ts` 用 `fflate.zipSync` 生成最小 OOXML，包含 required parts、shared strings、`Title Page`、`Auto Summary` 和两个分析 worksheet。不得创建或读写 `.xlsx` 文件。fixture 必须能注入 XML、重命名 ZIP entry、移除 cell cache、创建重复 sheet/row。

`zip-security.test.ts` 先断言有效 archive 含 `xl/workbook.xml`；再断言 `../outside.xml`、`xl\outside.xml`、重复名、过高压缩比、ZIP64、DTD/entity XML 均抛 `validation_error` 且不回显匿名 marker。`ooxml-reader.test.ts` 先断言通过 workbook relationship 得到：

```ts
expect(workbook.worksheets.get("Title Page")?.partName).toBe("xl/worksheets/sheet1.xml");
expect(workbook.worksheets.get("Auto Summary")?.partName).toBe("xl/worksheets/sheet2.xml");
```

- [ ] **运行红灯。**

```powershell
npm test -- packages/workbook-catalog/src/zip-security.test.ts packages/workbook-catalog/src/ooxml-reader.test.ts
```

- [ ] **实现 `readSafeZip(bytes)`。**读取 EOCD 和 central directory（从尾部最多扫描 65,557 bytes），逐项验证 flags、method、UTF-8 name、central/local header 一致性、compressed/uncompressed bytes 和全部上限。使用 `fflate.inflateSync`，解压结果长度必须精确等于 directory 声明长度。只返回 `ReadonlyMap<string, Uint8Array>`；任何失败产生固定 archive typed error。

- [ ] **实现 `readOoxmlWorkbook(bytes)`。**定义：

```ts
export interface OoxmlCell { readonly reference: string; readonly value: string; readonly formula?: string; readonly cachedValue?: string; }
export interface OoxmlWorksheet { readonly name: string; readonly partName: string; readonly cells: readonly OoxmlCell[]; }
export interface OoxmlWorkbook { readonly worksheets: ReadonlyMap<string, OoxmlWorksheet>; }
export function readOoxmlWorkbook(bytes: Uint8Array): OoxmlWorkbook;
```

以后续的 `DOMParser`（diagnostics fatal）读取 `xl/workbook.xml`、`xl/_rels/workbook.xml.rels`、可选 `xl/sharedStrings.xml` 和 worksheet XML；解析前以词法方式拒绝 `<!DOCTYPE`、`<!ENTITY` 和 XML declaration 外的每一个 processing instruction。通过 `r:id` relationship 获取 target，target 必须是相对 `xl/` 的安全路径。支持 string、inlineStr、shared-string、number。公式不执行，仅保存 `<f>` 与 `<v>` cache。重复 sheet 名、未知 relationship、缺失 target 均是 archive typed error。

- [ ] **导出并验证。**

```ts
export { readOoxmlWorkbook } from "./ooxml-reader.js";
export { readSafeZip } from "./zip-security.js";
```

```powershell
npm test -- packages/workbook-catalog/src/zip-security.test.ts packages/workbook-catalog/src/ooxml-reader.test.ts
npm run build -- --force
```

- [ ] **提交。**

```powershell
git add packages/workbook-catalog/src
git commit -m "feat: add safe OOXML workbook reader"
```

## 任务 3：实现 F1 worksheet catalog

**文件：**
- Create: `packages/workbook-catalog/src/workbook-catalog.ts`
- Create: `packages/workbook-catalog/src/workbook-catalog.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **先添加目录行为失败测试。**匿名 fixture 的 `Title Page` 包含 `Document No.`、`Revision:`、`Date:`；日期 cell 为 `<f>TODAY()</f><v>2026-07-23</v>`。`Auto Summary` headers 位于第 9 行，其后两行有 `Device Level Dim`、`Tolerance Loop Description` 与刻意不同的 Cpk/Pass/Fail/Milestone 值。测试 `createWorkbookCatalog` 返回两个 item，按 row 升序、名称不筛选、来源为 `Auto Summary`/原行号/`${worksheetName}!A1`。

```ts
const result = createWorkbookCatalog({
  contractVersion: "v1", fileName: "anonymous-ta.xlsx",
  inputClassification: "confidential", workbookBytes: createAnonymousWorkbookZip(),
});
expect(result.workbook.metadata.date).toEqual({
  value: "2026-07-23", formula: "=TODAY()", sourceCell: "Title Page!B6",
});
expect(result.analyses.map((item) => item.worksheetName)).toEqual(["Analysis-A", "Analysis-B"]);
```

添加：缺 `Title Page`、缺 `Auto Summary`、重复或缺 header、空 description、重复 name、未匹配 worksheet、日期公式无 cache、非法输入和返回 DTO mutation 测试。每个 typed error 必须通过 `typedErrorSchema`，错误文本/reference 不得包含 fixture 的 `anonymous-private-marker`。

- [ ] **运行红灯。**

```powershell
npm test -- packages/workbook-catalog/src/workbook-catalog.test.ts
```

- [ ] **实现 `createWorkbookCatalog(request: unknown): WorkbookCatalogResult`。**

1. 安全地 `safeParse(workbookCatalogRequestSchema)`；代理/getter/schema 异常为 `validation_error`、`workbook-request`。
2. 在解析字节之前拒绝任何非 confidential 输入为 `policy_denied`、摘要 `Workbook-catalog input is not permitted.`。
3. 用 `createHash("sha256")` 计算原始 bytes 的小写 hash，调用 `readOoxmlWorkbook`。
4. 要求精确的 `Title Page` 和 `Auto Summary` sheet。`normalizeLabel` 仅 trim、折叠空格、lowercase；在 Title Page 查唯一 `document no.`、`revision:`、`date:` label，读取该行右侧第一个 nonempty cell。缺失或歧义拒绝。
5. `Date` 有公式时必须有 nonempty cached value，绝不使用当前时间。接受 ISO date、Excel serial `1..2958465` 和可解析日期文本，输出 UTC `YYYY-MM-DD`。保留 formula（以 `=` 开头）和 source A1；固定值不含 formula。
6. 在 `Auto Summary` 找同一行唯一 `Device Level Dim` 与 `Tolerance Loop Description` header。每个后续 row：name 空则跳过；否则 description 非空、name 唯一且对应 workbook worksheet。不要读取、推断或过滤任何 Cpk、Pass/Fail、Milestone 或其他列。
7. 用 `workbookCatalogResultSchema.parse` 验证最终 object，随后 `structuredClone` + 递归 `Object.freeze` 返回。

- [ ] **导出并验证。**

```ts
export { createWorkbookCatalog } from "./workbook-catalog.js";
export type { WorkbookCatalogResult } from "@ai-assist/contracts";
```

```powershell
npm test -- packages/workbook-catalog/src/workbook-catalog.test.ts packages/workbook-catalog/src/ooxml-reader.test.ts packages/workbook-catalog/src/zip-security.test.ts
npm run build -- --force
```

- [ ] **提交。**

```powershell
git add packages/workbook-catalog/src
git commit -m "feat: catalog confidential TA workbooks"
```

## 任务 4：Feature Register 和中文文档同步

**文件：**
- Modify: `packages/governance/src/feature-register.ts`、`policy-gate.test.ts`
- Modify: `docs/governance/feature-register.md`、`docs/governance/phase-0-acceptance.md`
- Modify: `README.md`、`docs/README.md`

- [ ] **先新增精确 Register 失败测试。**

```ts
expect(getFeatureStatus("F1")).toEqual({
  featureId: "F1", title: "TA 报告解析与资产准备", status: "available",
  dependsOn: ["workbook-catalog-v1"],
  inputContractId: "workbook-catalog-request-v1",
  outputContractId: "workbook-catalog-result-v1",
  maximumClassification: "confidential",
  acceptanceChecks: ["anonymous-workbook-catalog-fixture", "dynamic-date-cache-fixture", "workbook-catalog-privacy-check"],
  externalPrerequisites: ["approved-ooxml-parser"],
  disableBehavior: "return feature_not_available",
});
```

并用 `it.each(["F2", "F3", "F4", "F5", "F6", "F7"])` 断言仍为 `unavailable`。

- [ ] **运行红灯。**

```powershell
npm test -- packages/governance/src/policy-gate.test.ts
```

- [ ] **替换唯一 F1 Register entry 并同步文档。**F1 说明必须明确：只接收受控 confidential bytes；只产生 worksheet catalog；不解析因子表、不计算、不读图片、不调用外部服务；原始 `.xlsx` 仍不可跟踪。F2-F7 与 F8 语义不得改变。README 与 docs README 链接 F1 设计和本计划。

- [ ] **运行并提交。**

```powershell
npm test -- packages/governance/src/policy-gate.test.ts
git add packages/governance README.md docs
git commit -m "docs: mark F1 workbook catalog available"
```

## 任务 5：完整验收

**文件：**
- Modify: `packages/workbook-catalog/src/workbook-catalog.test.ts`
- Modify: `docs/governance/feature-register.md`

- [ ] **增加 ESM package 入口测试。**构建后通过 `execFileSync(process.execPath, ["--input-type=module", "--eval", "import { createWorkbookCatalog } from '@ai-assist/workbook-catalog'; console.log(typeof createWorkbookCatalog);"])`，断言输出 `function`。

- [ ] **执行 F1 聚焦验收。**

```powershell
npm test -- packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/zip-security.test.ts packages/workbook-catalog/src/ooxml-reader.test.ts packages/workbook-catalog/src/workbook-catalog.test.ts packages/governance/src/policy-gate.test.ts
```

- [ ] **在 Feature Register 文档记录 F1 验收命令后执行完整质量门。**

```powershell
npm run build -- --force
npm run lint
npm test
npm run check:repository
npm ci --dry-run
git diff --check
git ls-files | Select-String '\.(xlsx|xlsm)$|^test/|^fixtures/confidential/'
```

预期：前六条命令均为退出码 `0`，最后一条无输出。若失败，仅修复 F1 更改直接造成的问题，随后重跑失败命令和相关聚焦测试。

- [ ] **提交验收测试和文档。**

```powershell
git add packages/workbook-catalog/src/workbook-catalog.test.ts docs/governance/feature-register.md
git commit -m "test: verify F1 workbook catalog acceptance"
```

## PR 交付检查

- [ ] `git status --short --branch` 只显示预期 F1 修改。
- [ ] `git diff main...HEAD --check` 无空白错误。
- [ ] PR 说明列出：受控 confidential bytes、只读目录、匿名 in-memory fixtures、ZIP/XML 防护和 F2-F7 仍不可用。
- [ ] PR 不包含真实 TA workbook、真实 worksheet 内容、`.xlsx`/`.xlsm`、`test/` 或 `fixtures/confidential/` 路径。
