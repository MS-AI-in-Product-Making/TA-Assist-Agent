# F2.4 标识符质量与统一例外处置实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付纯、机密、不可变的 F2.4 标识符质量检查器，并新增显式 F2.3 v2 统一例外处置器，以在保留 F2.3 v1 行为的同时覆盖当前 F2.2 和 F2.4 信号。

**Architecture:** `@ai-assist/contracts` 定义两个严格 v1 F2.4 DTO schema，以及与现有 v1 完全分开的 F2.3 v2 request/result schema。`@ai-assist/workbook-catalog` 中的 F2.4 检查器仅遍历已解析的 F1.1 资产并以 F2.1 为门禁；新的 v2 resolver 仅使用已完成的 F2.2/F2.4 结果自行派生规范引用、快照和覆盖结果。两者均以 `structuredClone` 后的递归冻结 DTO 返回，不持久化、不联网、不读取 workbook 字节、不写回 workbook。

**Tech Stack:** TypeScript strict ESM、Zod v3、Vitest v3、现有 `createTypedError`、`structuredClone` 和递归冻结模式、匿名内存 fixture。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `packages/contracts/src/contracts.ts` | F2.4 request/result、信号和摘要 schema；F2.3 v2 request/result、快照、来源摘要 schema 与公共类型。 |
| `packages/contracts/src/contracts.test.ts` | 新增 schema 严格性、门禁、哈希和汇总不变量回归。 |
| `packages/workbook-catalog/src/identifier-quality-check.ts` | 纯 F2.4 检查器，聚合缺失、不可用、不可打印文本及 DIM 重复。 |
| `packages/workbook-catalog/src/identifier-quality-check.test.ts` | F2.4 实际 F1.1/F2.1 fixture、隐私、冻结、ESM 导出测试。 |
| `packages/workbook-catalog/src/unified-exception-resolution.ts` | 纯 F2.3 v2 resolver，统一派生 F2.2/F2.4 信号。 |
| `packages/workbook-catalog/src/unified-exception-resolution.test.ts` | 完整覆盖、候选分类、来源统计、v1 不回归测试。 |
| `packages/workbook-catalog/src/index.ts` | 导出 F2.4 检查器、v2 resolver 和相关公共类型。 |
| `packages/governance/src/feature-register.ts` | 启用 F2.4，并将可用 F2.3 注册迁移至 v2 统一契约。 |
| `packages/governance/src/policy-gate.test.ts` | F2.4/F2.3 精确可用注册回归。 |
| `docs/superpowers/specs/2026-07-27-f2-4-identifier-quality-design.md` | 已批准的设计依据；实现时不扩大其边界。 |

## 不变式与命名

F2.4 只检查 `drawingNumber` 与 `dimCharacteristicId`。它按 `(worksheetName, tableId, field, signalKind, discriminator)` 聚合，信号按首次遇到的 worksheet、table、field、row 顺序输出。每条信号保留 `sourceRows`，但绝不把 `rawText`、`sourceCell` 或标准化 DIM ID 放入结果；唯一的例外是 F2.3 v2 中受机密分类保护的 `dim_id_duplicate` 聚合区分符，它仅用于稳定引用和不会被记录到日志。

定义这些 F2.4 信号分支：

```ts
type IdentifierQualitySignalKind =
  | "identifier_missing"
  | "identifier_evidence_unavailable"
  | "identifier_text_invalid"
  | "dim_id_duplicate";
```

- `identifier_missing`：字段对象缺失、不是 `available`，或 `available.rawText.trim()` 为空；按字段聚合。
- `identifier_evidence_unavailable`：字段状态为 `unavailable`；按 `reasonCode` 聚合，且保留该原因代码。
- `identifier_text_invalid`：可用、非空文本匹配 `/[\p{C}]/u`；按字段聚合。
- `dim_id_duplicate`：同一表内的可用、非空、无不可打印字符的 `dimCharacteristicId` 经 `trim()` 后值相同；大小写敏感且只在同表内检查。Drawing Number 永不产生重复信号。

F2.4 request 必须验证 F1.1 `workbook.contentHash` 与 F2.1 `workbookContentHash` 相等。F2.1 非 `readyForNextCheck` 时产生合法 `required_fields_not_ready` 结果，且信号与所有行派生计数为零；哈希不匹配或非机密/未知键是 typed `validation_error`/`policy_denied`，不是门禁结果。

F2.3 v2 使用独立 API：

```ts
export function createUnifiedExceptionResolution(request: unknown): UnifiedExceptionResolutionResult
```

其 schema 常量和类型使用 `unifiedExceptionResolutionV2RequestSchema`、`unifiedExceptionResolutionV2ResultSchema`、`UnifiedExceptionResolutionV2Request` 与 `UnifiedExceptionResolutionV2Result`；工作簿目录包仅导出别名 `UnifiedExceptionResolutionRequest`/`UnifiedExceptionResolutionResult`。v1 的 `createExceptionResolution`、`exceptionResolutionRequestSchema`、`ExceptionResolutionRequest` 和输出形状不得改变。

v2 的规范 reference 由 resolver 而不是调用方创建：

```ts
const capabilitySignalRef = [workbookContentHash, "capability_validation", worksheetName, tableId, sourceRow, signalKind].join("|");
const identifierSignalRef = [
  workbookContentHash,
  "identifier_quality",
  worksheetName,
  tableId,
  field,
  signalKind,
  discriminator,
].join("|");
```

`discriminator` 对普通 F2.4 信号为空字符串，对证据不可用为 `reasonCode`，对 DIM 重复为受机密保护的 trim 后 DIM 值。快照只从已验证的 F2.2/F2.4 结果构造，包含 `source: "capability_validation" | "identifier_quality"`，不信任候选项中的快照、行、字段或理由以外的数据。v2 summary 使用总数加以下来源计数：`capabilitySignalCount`、`identifierSignalCount`、`acceptedCapabilityExceptionCount`、`acceptedIdentifierExceptionCount`、`pendingCapabilityExceptionCount`、`pendingIdentifierExceptionCount`、`invalidCandidateCount`。

### Task 1: 定义 F2.4 严格契约

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: 写出会失败的 F2.4 schema 测试。**

在 `contracts.test.ts` 的 F2 合约区域添加匿名资产与 F2.1 就绪 fixture。测试请求仅接受：

```ts
{
  contractVersion: "v1",
  inputClassification: "confidential",
  worksheetAnalysisAssets,
  requiredFieldCheck,
}
```

测试已完成结果包含下列聚合信号；断言 `sourceRows` 必须为非空、唯一、递增正整数，且每个信号的字段和分支匹配：

```ts
{
  signalKind: "identifier_evidence_unavailable",
  worksheetName: "Analysis-A",
  tableId: "table-a",
  field: "dimCharacteristicId",
  reasonCode: "missing",
  sourceRows: [2, 3],
}
```

拒绝公共分类、未知 request/result key、非 SHA-256 hash、重复或乱序 `sourceRows`、`identifier_evidence_unavailable` 缺失/伪造 `reasonCode`、其他分支携带 `reasonCode`、`required_fields_not_ready` 含信号或非零汇总，以及 `completed` 汇总与信号不一致。

- [ ] **Step 2: 运行测试以确认在实现前失败。**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL，因为尚未导出 `identifierQualityCheckRequestSchema` 与 `identifierQualityCheckResultSchema`。

- [ ] **Step 3: 添加 F2.4 request、信号和 result schema。**

在 `requiredFieldCheckResultSchema` 后添加以下严格 schema 基础：

```ts
const identifierQualityFieldSchema = z.enum(["drawingNumber", "dimCharacteristicId"]);
const identifierQualitySignalSourceSchema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  field: identifierQualityFieldSchema,
  sourceRows: z.array(z.number().int().positive()).min(1),
}).strict().superRefine((signal, context) => {
  if (new Set(signal.sourceRows).size !== signal.sourceRows.length
    || signal.sourceRows.some((row, index) => index > 0 && row <= signal.sourceRows[index - 1]!)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "sourceRows must be unique and ascending", path: ["sourceRows"] });
  }
});

const identifierQualitySignalSchema = z.discriminatedUnion("signalKind", [
  identifierQualitySignalSourceSchema.extend({ signalKind: z.literal("identifier_missing") }).strict(),
  identifierQualitySignalSourceSchema.extend({
    signalKind: z.literal("identifier_evidence_unavailable"),
    reasonCode: worksheetUnavailableReasonCodeSchema,
  }).strict(),
  identifierQualitySignalSourceSchema.extend({ signalKind: z.literal("identifier_text_invalid") }).strict(),
  identifierQualitySignalSourceSchema.extend({
    signalKind: z.literal("dim_id_duplicate"),
    field: z.literal("dimCharacteristicId"),
  }).strict(),
]);
```

`identifierQualityCheckRequestSchema` 必须是 `.strict()` 机密 v1 对象。`identifierQualityCheckResultSchema` 使用 `completed`/`required_fields_not_ready` 判别联合，公开 `workbookContentHash`、严格 `signals` 与严格 summary。summary 包含 `factorRowsChecked`、四种信号的各自计数和 `actionableSignalCount`；在 `.superRefine` 中从 `signals` 重新计数，并要求门禁结果 rows/counts 都为零。

- [ ] **Step 4: 添加类型并重跑合约测试。**

在现有 F2.1/F2.2 类型旁导出：

```ts
export type IdentifierQualityCheckRequest = z.infer<typeof identifierQualityCheckRequestSchema>;
export type IdentifierQualityCheckResult = z.infer<typeof identifierQualityCheckResultSchema>;
```

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: 提交合约增量。**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat: define F2.4 identifier quality contracts"
```

### Task 2: 以 TDD 实现纯 F2.4 检查器

**Files:**
- Create: `packages/workbook-catalog/src/identifier-quality-check.ts`
- Create: `packages/workbook-catalog/src/identifier-quality-check.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: 写出会失败的真实输入行为测试。**

从 `capability-validation.test.ts` 复制其匿名 `available`、`unavailable`、`fieldsFor` 和 `assetsFor` helpers，并以真实 `createRequiredFieldCheck` 生成 F2.1 结果。为同一个表创建 4 个 row：缺失 Drawing Number、空白 DIM ID、`unavailable/missing` DIM ID、带 `\u0000` 的 Drawing Number，以及两个 trim 后为 `DIM-01` 的可用 DIM ID。断言按字段/原因/重复值聚合，并保证 Drawing Number 重复不增加信号：

```ts
expect(result).toMatchObject({
  status: "completed",
  signals: expect.arrayContaining([
    { signalKind: "identifier_missing", field: "drawingNumber", sourceRows: [2] },
    { signalKind: "identifier_missing", field: "dimCharacteristicId", sourceRows: [3] },
    { signalKind: "identifier_evidence_unavailable", field: "dimCharacteristicId", reasonCode: "missing", sourceRows: [4] },
    { signalKind: "identifier_text_invalid", field: "drawingNumber", sourceRows: [5] },
    { signalKind: "dim_id_duplicate", field: "dimCharacteristicId", sourceRows: [6, 7] },
  ]),
});
```

另写独立测试：F2.1 blocked 返回无信号 gate；哈希不匹配被拒绝；`dim-01` 与 `DIM-01` 不冲突；每种 `unavailable` 原因独立聚合；显式非机密分类为 `policy_denied`；返回值和嵌套数组冻结；输入突变不会影响已返回 DTO；构建的 ESM entrypoint 导出函数。

- [ ] **Step 2: 运行检查器测试以确认失败。**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/identifier-quality-check.test.ts
```

Expected: FAIL，因为 `createIdentifierQualityCheck` 模块及导出尚不存在。

- [ ] **Step 3: 实现最小检查器。**

实现：

```ts
export function createIdentifierQualityCheck(request: unknown): IdentifierQualityCheckResult
```

遵循 `required-field-check.ts` 的安全 classification 访问、`createTypedError`、`safeParse`、`structuredClone` 和 cycle-safe `deepFreeze` 模式。预先验证 request schema，并在业务逻辑开始前检查：

```ts
if (input.worksheetAnalysisAssets.workbook.contentHash !== input.requiredFieldCheck.workbookContentHash) {
  throw requestError(REQUEST_SUMMARY);
}
```

F2.1 未就绪时立即用原始资产 hash 返回 `required_fields_not_ready` 和全零 summary。就绪时以资产中的 worksheet/table/row 顺序遍历两个标识符字段。只对 `status === "available"` 且 `rawText.trim()` 非空、且不匹配 `/[\p{C}]/u` 的 DIM 值加入同表 `Map<string, number[]>`；最后仅为数组长度大于一的条目增加 `dim_id_duplicate`。使用一个 insertion-ordered map，以聚合键保存首遇到位置和 `sourceRows`，从而稳定输出。不要读取 `sourceCell`、不要输出 `rawText`、不要使用 F0、时钟、OOXML、日志、网络、持久化或写回。

- [ ] **Step 4: 导出并运行检查器测试。**

在 `packages/workbook-catalog/src/index.ts` 添加：

```ts
export { createIdentifierQualityCheck } from "./identifier-quality-check.js";
```

并将 `IdentifierQualityCheckRequest` 和 `IdentifierQualityCheckResult` 加入现有 `@ai-assist/contracts` type export。运行 Step 2 命令。Expected: PASS.

- [ ] **Step 5: 提交检查器增量。**

```powershell
git add packages/workbook-catalog/src/identifier-quality-check.ts packages/workbook-catalog/src/identifier-quality-check.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat: add F2.4 identifier quality check"
```

### Task 3: 定义 F2.3 v2 统一处置契约

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: 写出会失败的 v2 schema 测试。**

构造同 hash 的已完成 F2.2 与已完成 F2.4 fixture。验证 `unifiedExceptionResolutionV2RequestSchema` 只接受：

```ts
{
  contractVersion: "v2",
  inputClassification: "confidential",
  capabilityValidation,
  identifierQualityCheck,
  candidates: [{
    signalRef: "canonical derived reference",
    recordedBy: "anonymous-engineer",
    recordedAt: "2026-07-27T10:15:30.000Z",
    rationale: "Anonymous evidence reviewed.",
  }],
}
```

拒绝 v1 版本、非机密分类、任一未完成输入、哈希不匹配、候选未知键，以及 result 的来源/快照分支不匹配。为一个 capability 和一个 identifier 信号写合法 ready result；再拒绝不等于 accepted+pending 的总数、来源计数不匹配、重复/重叠 signal refs，以及 `readyToContinue` 与 pending/invalid 数不一致。

- [ ] **Step 2: 确认 v2 测试先失败。**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL，因为 v2 schema 和类型尚不存在。

- [ ] **Step 3: 添加独立的 v2 request 和 snapshot schema。**

保持 v1 `contractVersionSchema` 不变，另行定义：

```ts
const contractVersionV2Schema = z.literal("v2");
const unifiedExceptionCandidateSubmissionSchema = z.object({
  signalRef: z.string(),
  recordedBy: z.string(),
  recordedAt: z.string(),
  rationale: z.string(),
}).strict();
```

使用包含 `source: z.literal("capability_validation")` 的四个 F2.2 snapshot 分支，以及包含 `source: z.literal("identifier_quality")` 的四个 F2.4 snapshot 分支。后者复用 F2.4 signal 结构并不含 `sourceRows` 以外的原始标识符文本。request `.superRefine` 必须要求 `capabilityValidation.status === "completed"`、`identifierQualityCheck.status === "completed"`，且两个 hash 相同。

- [ ] **Step 4: 添加 v2 result 和严格不变量。**

accepted/pending schema 以 `unifiedExceptionSignalSnapshotSchema` 为 snapshot，并保留与 v1 相同的 candidate 有效性约束。result 的 summary 精确为：

```ts
{
  actionableSignalCount: z.number().int().nonnegative(),
  capabilitySignalCount: z.number().int().nonnegative(),
  identifierSignalCount: z.number().int().nonnegative(),
  acceptedExceptionCount: z.number().int().nonnegative(),
  acceptedCapabilityExceptionCount: z.number().int().nonnegative(),
  acceptedIdentifierExceptionCount: z.number().int().nonnegative(),
  pendingExceptionCount: z.number().int().nonnegative(),
  pendingCapabilityExceptionCount: z.number().int().nonnegative(),
  pendingIdentifierExceptionCount: z.number().int().nonnegative(),
  invalidCandidateCount: z.number().int().nonnegative(),
}
```

在 `.superRefine` 中重算 accepted/pending 数、来源数、source 计数、唯一性、集合无交叠和 ready 状态。v2 result 含两个相同输入派生的 `workbookContentHash`，并保留 F2.2 `knowledgeBaseVersion`。导出两个 v2 类型，同时不修改现有 v1 schema/type。

- [ ] **Step 5: 重跑合约测试并提交。**

Run the Step 2 command. Expected: PASS.

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat: define unified exception resolution v2 contracts"
```

### Task 4: 以 TDD 实现 F2.3 v2 resolver 并回归 v1

**Files:**
- Create: `packages/workbook-catalog/src/unified-exception-resolution.ts`
- Create: `packages/workbook-catalog/src/unified-exception-resolution.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`
- Verify: `packages/workbook-catalog/src/exception-resolution.ts`
- Verify: `packages/workbook-catalog/src/exception-resolution.test.ts`

- [ ] **Step 1: 写出会失败的统一行为测试。**

在新测试中通过真实 `createRequiredFieldCheck`、`createCapabilityValidation` 和新的 `createIdentifierQualityCheck` 创建输入，而不是伪造结果。使用一个 F2.2 `tolerance_out_of_library` 和一个 F2.4 `identifier_missing`；依据本计划的两个 canonical reference 给出各一个有效候选，断言：

```ts
expect(result).toMatchObject({
  contractVersion: "v2",
  status: "readyToContinue",
  readyToContinue: true,
  acceptedExceptions: [
    { snapshot: { source: "capability_validation", signalKind: "tolerance_out_of_library" } },
    { snapshot: { source: "identifier_quality", signalKind: "identifier_missing", field: "drawingNumber" } },
  ],
  summary: {
    actionableSignalCount: 2,
    capabilitySignalCount: 1,
    identifierSignalCount: 1,
    acceptedCapabilityExceptionCount: 1,
    acceptedIdentifierExceptionCount: 1,
    pendingExceptionCount: 0,
    invalidCandidateCount: 0,
  },
});
```

独立测试任一来源缺少候选、F2.4 四种 signal kind、重复/未知/非法候选、两结果哈希不一致、F2.2 或 F2.4 未完成、对象深冻结与输入隔离、ESM export。复用现有 `exception-resolution.test.ts` 的匿名 UTC candidate 值。最后直接调用 v1 `createExceptionResolution`，断言原始 v1 request 仍返回 v1 `readyToContinue` 结果。

- [ ] **Step 2: 运行 v2 测试以确认失败。**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/unified-exception-resolution.test.ts packages/workbook-catalog/src/exception-resolution.test.ts
```

Expected: FAIL，因为 v2 resolver 模块和 package export 尚不存在；v1 测试保持 PASS。

- [ ] **Step 3: 实现派生、候选分类和输出。**

复制 `exception-resolution.ts` 中的安全 classification、UTC 语义验证、typed error、clone/freeze 辅助方式，但不要导入或修改 v1 函数。实现 capability 派生时，仅包含 v1 resolver 当前的四种 F2.2 非阻塞状态。实现 identifier 派生时，按 F2.4 `signals` 的已排序顺序创建 snapshot/reference。将候选按引用映射：未知引用 `invalidCandidateCount += 1`；同一已知引用的多个候选生成 `duplicate_candidate` 并把数量加入 invalid count；唯一但语义无效候选生成 `invalid_candidate`；每个无候选信号生成 `missing_candidate`。候选无法创建快照、行或字段。

构造 schema 允许的 v2 result，`readyToContinue` 仅在 pending 数和 invalid 数均为零时为 true；通过 `unifiedExceptionResolutionV2ResultSchema.safeParse`，随后 `structuredClone` 和递归冻结。不得导入 OOXML、F0、F2.4 的 request/资产、网络、审计、存储、时钟或 logging adapter。

- [ ] **Step 4: 导出并重跑 v2 与 v1 测试。**

在 package index 添加：

```ts
export { createUnifiedExceptionResolution } from "./unified-exception-resolution.js";
```

再导出 `UnifiedExceptionResolutionV2Request` 和 `UnifiedExceptionResolutionV2Result`；为了与函数 API 一致，额外 type alias `UnifiedExceptionResolutionRequest` 与 `UnifiedExceptionResolutionResult` 必须在 `contracts.ts` 定义并导出。运行 Step 2 命令。Expected: PASS.

- [ ] **Step 5: 提交 resolver 增量。**

```powershell
git add packages/workbook-catalog/src/unified-exception-resolution.ts packages/workbook-catalog/src/unified-exception-resolution.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat: add F2.3 v2 unified exception resolution"
```

### Task 5: 启用治理注册

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`

- [ ] **Step 1: 写出会失败的精确可用性测试。**

将 F2.4 从 unavailable 参数化列表删除，并添加：

```ts
expect(getFeatureStatus("F2.4")).toEqual({
  featureId: "F2.4",
  title: "DIM ID 与 Drawing Number 质量检查",
  status: "available",
  dependsOn: ["worksheet-analysis-assets-v1", "required-field-check-v1", "identifier-quality-check-v1"],
  inputContractId: "identifier-quality-check-request-v1",
  outputContractId: "identifier-quality-check-result-v1",
  maximumClassification: "confidential",
  acceptanceChecks: [
    "anonymous-identifier-quality-fixture",
    "identifier-quality-gate-check",
    "identifier-quality-privacy-check",
  ],
  externalPrerequisites: ["approved-ooxml-parser"],
  disableBehavior: "return feature_not_available",
});
```

同时将 F2.3 期望值更新为 `dependsOn: ["capability-validation-v1", "identifier-quality-check-v1", "unified-exception-resolution-v2"]`、`inputContractId: "unified-exception-resolution-request-v2"`、`outputContractId: "unified-exception-resolution-result-v2"`，并将 acceptance checks 改为 `anonymous-unified-exception-resolution-fixture`、`unified-exception-resolution-coverage-check`、`unified-exception-resolution-privacy-check`。保留其标题、机密分类、`approved-exception-policy` 和 disable behavior。

- [ ] **Step 2: 运行治理测试以确认失败。**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts
```

Expected: FAIL，因为 F2.4 仍不可用且 F2.3 仍注册 v1。

- [ ] **Step 3: 更新 feature register。**

将 F2.4 替换为与测试完全一致的可用对象。将 F2.3 的可用注册替换为测试中的 v2 元数据。根 F2 和 F3-F7 必须继续不可用；不要新增 Part Number、规范 DIM ID 策略、图纸链接、身份、持久化或外部先决条件。

- [ ] **Step 4: 重跑并提交治理测试。**

Run the Step 2 command. Expected: PASS.

```powershell
git add packages/governance/src/feature-register.ts packages/governance/src/policy-gate.test.ts
git commit -m "feat: enable F2.4 identifier quality governance"
```

### Task 6: 完整回归与边界验证

**Files:**
- Verify: Tasks 1-5 的所有变更

- [ ] **Step 1: 运行受影响 slice。**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/required-field-check.test.ts packages/workbook-catalog/src/capability-validation.test.ts packages/workbook-catalog/src/exception-resolution.test.ts packages/workbook-catalog/src/identifier-quality-check.test.ts packages/workbook-catalog/src/unified-exception-resolution.test.ts packages/governance/src/policy-gate.test.ts
```

Expected: PASS，且 F2.3 v1 和 F2.3 v2 测试同时通过。

- [ ] **Step 2: 运行仓库质量检查。**

```powershell
npm run lint
npm test
npm run check:repository
git diff --check
```

Expected: lint、构建、测试和 repository check 均通过。若完整套件重现已知的、与本变更无关的 audit-root 并发锁时序失败，记录完整输出，不修改 audit 代码，并重新运行受影响 slice 以确认 F2.4/F2.3 v2 自身没有失败。

- [ ] **Step 3: 验证发布边界。**

确认 F2.4 只消费 F1.1/F2.1 结果，F2.3 v2 只消费已完成 F2.2/F2.4 结果；两个服务均不接受 workbook bytes、路径、URL、图像、F0 数据、网络/身份/时钟 adapter 或持久化目标。确认普通结果与日志没有原始标识符、source cell、候选 rationale、记录人或时间戳；确认 DIM 大小写保持区分，Drawing Number 重复被允许；确认 root F2、F3-F7 仍不可用。
