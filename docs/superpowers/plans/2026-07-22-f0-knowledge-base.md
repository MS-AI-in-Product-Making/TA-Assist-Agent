# F0 知识库首版实施计划

> **供 Agentic Worker 使用：**必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项执行本计划。步骤以 checkbox（`- [ ]`）跟踪。

**目标：**交付一个本地、匿名 `public`、只读且可版本化的 F0 知识库，为能力范围、工程规则和术语提供严格校验的 `v1` 查询快照。

**架构：**新增 `@ai-assist/knowledge-base` composite workspace package。版本化 Zod 契约位于 `@ai-assist/contracts`；知识库 package 内置唯一的 TypeScript `v1` 种子快照，先验证 manifest、hash 与所有关系，再暴露不可变的查询 DTO。F0 的唯一变更入口是 Git/PR，不创建运行时写 API、路径输入或网络输入。

**技术栈：**Node.js 24、npm workspaces、TypeScript ES2024/NodeNext、Zod v3、Vitest v3、ESLint 9、Node `crypto`。

**设计依据：**[F0 知识库首版设计](../specs/2026-07-22-f0-knowledge-base-design.md)

---

## 文件结构

- Modify: `tsconfig.json`：加入 knowledge-base composite project reference。
- Modify: `packages/contracts/src/contracts.ts`：定义版本化知识库 manifest、三类条目和查询输入/输出 schema。
- Modify: `packages/contracts/src/contracts.test.ts`：验证公共知识库契约。
- Create: `packages/knowledge-base/package.json`：包导出与 contracts 依赖。
- Create: `packages/knowledge-base/tsconfig.json`：package build 设置。
- Create: `packages/knowledge-base/src/data/v1.ts`：唯一的匿名 public `v1` 三库种子快照。
- Create: `packages/knowledge-base/src/validation.ts`：数据包 schema、hash、唯一性、术语关系和敏感文本验证。
- Create: `packages/knowledge-base/src/knowledge-base.ts`：加载、快照缓存、只读查询和 T0 回退。
- Create: `packages/knowledge-base/src/index.ts`：唯一 package 公共入口。
- Create: `packages/knowledge-base/src/knowledge-base.test.ts`：加载、正向查询、T0 与不可变性验收。
- Create: `packages/knowledge-base/src/validation.test.ts`：所有拒绝条件的 fixture 级测试。
- Modify: `packages/governance/src/feature-register.ts`：将 F0 更正为可用的知识库。
- Modify: `packages/governance/src/policy-gate.test.ts`：锁定 F0 条目与 F1–F7 状态。
- Modify: `docs/governance/feature-register.md`：同步 F0 的受控 public/只读语义。
- Modify: `README.md`：将 Phase 0 “F0-F7 均不可用”更正为 F0 可用、F1-F7 不可用，并链接 F0 设计和计划。

## 任务 1：建立知识库公共契约与 workspace 骨架

**文件：**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/knowledge-base/package.json`
- Create: `packages/knowledge-base/tsconfig.json`
- Create: `packages/knowledge-base/src/index.ts`
- Modify: `tsconfig.json`

- [ ] **步骤 1：为公共知识库 schema 写失败测试**

在 `packages/contracts/src/contracts.test.ts` 增加以下 import 和测试。这里锁定首版的
公共边界：manifest 只允许 `public`，能力等级和查询输入均为明确枚举。

```ts
import {
  capabilityTierSchema,
  knowledgeBaseManifestSchema,
  knowledgeBaseQueryRequestSchema,
} from "./index.js";

it("accepts a public v1 knowledge-base manifest", () => {
  expect(
    knowledgeBaseManifestSchema.parse({
      contractVersion: "v1",
      knowledgeBaseVersion: "v1",
      classification: "public",
      releasedAt: "2026-07-22",
      changeSummary: "匿名公开种子数据。",
      libraries: [
        { libraryId: "capability-library", entryCount: 1, coverage: ["demo"], contentHash: "a".repeat(64) },
        { libraryId: "engineering-rules", entryCount: 3, coverage: ["CTS"], contentHash: "b".repeat(64) },
        { libraryId: "terminology-ontology", entryCount: 1, coverage: ["part-category"], contentHash: "c".repeat(64) },
      ],
    }).knowledgeBaseVersion,
  ).toBe("v1");
});

it("rejects non-public knowledge-base data and invalid capability tiers", () => {
  expect(() => capabilityTierSchema.parse("T4")).toThrow();
  expect(() => knowledgeBaseManifestSchema.parse({ classification: "confidential" })).toThrow();
});

it("requires a supported capability query payload", () => {
  expect(
    knowledgeBaseQueryRequestSchema.parse({
      partCategory: "demo-bracket",
      tolerance: 0.2,
      unit: "mm",
    }).unit,
  ).toBe("mm");
  expect(() => knowledgeBaseQueryRequestSchema.parse({ partCategory: "", tolerance: -1 })).toThrow();
});
```

- [ ] **步骤 2：运行契约测试并确认失败**

运行：

```powershell
npm test -- packages/contracts/src/contracts.test.ts
```

预期：失败，提示 `capabilityTierSchema`、`knowledgeBaseManifestSchema` 或
`knowledgeBaseQueryRequestSchema` 尚未导出。

- [ ] **步骤 3：定义最小且完整的 v1 契约**

在 `packages/contracts/src/contracts.ts` 追加下列 schema；所有对象使用 `.strict()`，防止
未受控字段进入种子包或查询边界。

```ts
export const capabilityTierSchema = z.enum(["T0", "T1", "T2", "T3"]);
export const distributionSchema = z.enum(["normal", "uniform", "triangular", "trapezoidal", "elliptical", "beta"]);
export const knowledgeLibraryIdSchema = z.enum(["capability-library", "engineering-rules", "terminology-ontology"]);
export const knowledgeBaseVersionSchema = z.literal("v1");

export const provenanceSchema = z.object({
  source: z.string().min(1), confidence: z.number().min(0).max(1), owner: z.string().min(1),
  coverage: z.array(z.string().min(1)).min(1), effectiveVersion: knowledgeBaseVersionSchema,
  changeSummary: z.string().min(1),
}).strict();

export const capabilityEntrySchema = z.object({
  entryId: z.string().min(1), partCategory: z.string().min(1), subsystem: z.string().min(1).optional(),
  datum: z.string().min(1).optional(), toleranceMin: z.number().nonnegative(), toleranceMax: z.number().positive(),
  unit: z.literal("mm"), recommendedDistribution: distributionSchema, capabilityTier: capabilityTierSchema,
  provenance: provenanceSchema,
}).strict().refine((entry) => entry.toleranceMin <= entry.toleranceMax, { message: "toleranceMin must not exceed toleranceMax" });

export const engineeringRuleEntrySchema = z.object({
  ruleId: z.enum(["cts-sigma", "ctf-sigma", "default-cpk-target"]), ruleType: z.enum(["sigma", "cpk"]),
  threshold: z.number().positive(), unit: z.string().min(1), applicability: z.string().min(1), provenance: provenanceSchema,
}).strict();

export const terminologyEntrySchema = z.object({
  entryId: z.string().min(1), termType: z.enum(["part-category", "subsystem", "datum"]),
  canonicalName: z.string().min(1), aliases: z.array(z.string().min(1)), definition: z.string().min(1),
  parentEntryId: z.string().min(1).optional(), provenance: provenanceSchema,
}).strict();

export const knowledgeBaseManifestSchema = z.object({
  contractVersion: contractVersionSchema, knowledgeBaseVersion: knowledgeBaseVersionSchema, classification: z.literal("public"),
  releasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), changeSummary: z.string().min(1),
  libraries: z.array(z.object({ libraryId: knowledgeLibraryIdSchema, contractId: z.string().min(1), entryCount: z.number().int().nonnegative(), coverage: z.array(z.string().min(1)).min(1), contentHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).length(3),
}).strict();

export const knowledgeBaseQueryRequestSchema = z.object({ partCategory: z.string().min(1), tolerance: z.number().nonnegative(), unit: z.literal("mm"), subsystem: z.string().min(1).optional(), datum: z.string().min(1).optional() }).strict();
export const engineeringRuleQuerySchema = z.object({ ruleId: engineeringRuleEntrySchema.shape.ruleId }).strict();
export const terminologyQuerySchema = z.object({ termType: terminologyEntrySchema.shape.termType, value: z.string().min(1) }).strict();
export type CapabilityEntry = z.infer<typeof capabilityEntrySchema>;
export type EngineeringRuleEntry = z.infer<typeof engineeringRuleEntrySchema>;
export type TerminologyEntry = z.infer<typeof terminologyEntrySchema>;
export type KnowledgeBaseManifest = z.infer<typeof knowledgeBaseManifestSchema>;
export type KnowledgeBaseQueryRequest = z.infer<typeof knowledgeBaseQueryRequestSchema>;
export type EngineeringRuleQuery = z.infer<typeof engineeringRuleQuerySchema>;
export type TerminologyQuery = z.infer<typeof terminologyQuerySchema>;
```

`packages/contracts/src/index.ts` 继续导出 `contracts.js`；不引入新的 barrel 路径。

创建 package 元数据和配置：

```json
// packages/knowledge-base/package.json
{
  "name": "@ai-assist/knowledge-base",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "dependencies": { "@ai-assist/contracts": "0.1.0", "zod": "^3.24.0" }
}
```

```json
// packages/knowledge-base/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "composite": true, "rootDir": "src", "outDir": "dist" },
  "references": [{ "path": "../contracts" }],
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

创建暂时为空的 `packages/knowledge-base/src/index.ts`：

```ts
export {};
```

在根 `tsconfig.json` 的 `references` 数组中新增：

```json
{ "path": "./packages/knowledge-base" }
```

- [ ] **步骤 4：运行契约与 TypeScript 构建检查**

运行：

```powershell
npm test -- packages/contracts/src/contracts.test.ts
npm run build -- --force
```

预期：契约测试通过；构建通过并生成 knowledge-base 空 package 的声明产物。

- [ ] **步骤 5：提交本任务**

```powershell
git add package-lock.json tsconfig.json packages/contracts packages/knowledge-base/package.json packages/knowledge-base/tsconfig.json packages/knowledge-base/src/index.ts
git commit -m "feat: define F0 knowledge base contracts"
```

## 任务 2：实现受控 v1 种子快照与严格加载验证

**文件：**
- Create: `packages/knowledge-base/src/data/v1.ts`
- Create: `packages/knowledge-base/src/validation.ts`
- Create: `packages/knowledge-base/src/validation.test.ts`
- Modify: `packages/knowledge-base/src/index.ts`

- [ ] **步骤 1：写入拒绝非法快照的失败测试**

创建 `packages/knowledge-base/src/validation.test.ts`。测试必须覆盖重复 ID、倒置范围、
hash 不一致、术语别名冲突、无效父级与疑似敏感文本。

```ts
import { describe, expect, it } from "vitest";
import { createKnowledgeSnapshot, createSeedPackage } from "./validation.js";

describe("knowledge-base package validation", () => {
  it.each([
    ["duplicate entry id", (value: ReturnType<typeof createSeedPackage>) => { value.capabilities[1] = { ...value.capabilities[1]!, entryId: value.capabilities[0]!.entryId }; }],
    ["inverted tolerance", (value: ReturnType<typeof createSeedPackage>) => { value.capabilities[0] = { ...value.capabilities[0]!, toleranceMin: 0.4, toleranceMax: 0.1 }; }],
    ["sensitive marker", (value: ReturnType<typeof createSeedPackage>) => { value.capabilities[0] = { ...value.capabilities[0]!, provenance: { ...value.capabilities[0]!.provenance, source: "supplier confidential sample" } }; }],
  ])("rejects %s", (_label, mutate) => {
    const value = createSeedPackage();
    mutate(value);
    expect(() => createKnowledgeSnapshot(value)).toThrow(/Knowledge-base package is invalid/);
  });

  it("rejects a manifest content hash mismatch", () => {
    const value = createSeedPackage();
    value.manifest.libraries[0] = { ...value.manifest.libraries[0]!, contentHash: "0".repeat(64) };
    expect(() => createKnowledgeSnapshot(value)).toThrow(/content hash/);
  });
});
```

- [ ] **步骤 2：运行验证测试并确认失败**

运行：

```powershell
npm test -- packages/knowledge-base/src/validation.test.ts
```

预期：失败，因为 `validation.js` 与公共种子包尚不存在。

- [ ] **步骤 3：创建唯一的匿名 public 种子包**

创建 `packages/knowledge-base/src/data/v1.ts`。使用概念化类别而不使用真实工程、供应商
或 DIM 标识；示例至少包括两个能力条目、三条规则、三个类别/子系统/基准术语。数据值
必须与 schema 一致，例如：

```ts
export const KNOWLEDGE_BASE_VERSION = "v1" as const;
export const capabilitySeed = [
  { entryId: "cap-demo-bracket", partCategory: "demo-bracket", toleranceMin: 0.1, toleranceMax: 0.3, unit: "mm", recommendedDistribution: "normal", capabilityTier: "T3", provenance: { source: "anonymous engineering estimate", confidence: 0.5, owner: "knowledge-steward", coverage: ["demo-bracket"], effectiveVersion: "v1", changeSummary: "初始匿名演示能力范围。" } },
  { entryId: "cap-demo-spacer", partCategory: "demo-spacer", toleranceMin: 0.05, toleranceMax: 0.2, unit: "mm", recommendedDistribution: "uniform", capabilityTier: "T3", provenance: { source: "anonymous engineering estimate", confidence: 0.5, owner: "knowledge-steward", coverage: ["demo-spacer"], effectiveVersion: "v1", changeSummary: "初始匿名演示能力范围。" } },
] as const;
```

规则必须分别为 `cts-sigma=6`、`ctf-sigma=4` 和 `default-cpk-target=1.33`。术语须包含
`demo-bracket`、`mechanical-demo` 和 `primary-demo-datum`，其所有关系都在同一数组内。

- [ ] **步骤 4：实现 hash、关系和隐私验证**

创建 `packages/knowledge-base/src/validation.ts`，并实现下列明确行为：

```ts
export interface KnowledgeBaseSeedPackage {
  manifest: KnowledgeBaseManifest;
  capabilities: CapabilityEntry[];
  rules: EngineeringRuleEntry[];
  terminology: TerminologyEntry[];
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function contentHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
```

`createSeedPackage` 必须对 `capabilitySeed`、`engineeringRuleSeed` 和
`terminologySeed` 分别调用 `contentHash`，构造含三个固定 `libraryId` 的 manifest，并为
它们设置 `contractId`：`capability-library-v1`、`engineering-rules-v1`、
`terminology-ontology-v1`。它返回 `structuredClone` 后的可变测试副本。`createKnowledgeSnapshot`
必须先执行完整验证，再对 `structuredClone(value)` 递归 `Object.freeze` 并返回该冻结副本。

`createKnowledgeSnapshot` 依次执行 contracts schema 验证、每库 stable ID 唯一性、规则
ID 唯一性、`provenance.effectiveVersion === manifest.knowledgeBaseVersion`、manifest
的三个固定 library ID/条目数/hash、术语父级可解析及无循环、同一 `termType` 内不含
冲突 canonical/alias 名称，以及所有字符串不匹配下列大小写不敏感模式：

```ts
/(\.xlsx|\.xlsm|\bdim[\s_-]*id\b|\bsupplier\b|\bconfidential\b|\bsecret\b|\bproject[-_ ]?code\b)/i
```

任何失败都抛出 `createTypedError({ code: "validation_error", ... })`，`summary` 固定为
`Knowledge-base package is invalid.`，而 `affectedInputReferences` 只含安全的库 ID 或
条目 ID，绝不含原始文本。

- [ ] **步骤 5：导出验证辅助函数并运行聚焦测试**

将 `createKnowledgeSnapshot`、`createSeedPackage` 和 `contentHash` 从
`packages/knowledge-base/src/index.ts` 导出。

运行：

```powershell
npm test -- packages/knowledge-base/src/validation.test.ts
```

预期：所有验证用例通过；敏感文本没有出现在错误摘要中。

- [ ] **步骤 6：提交本任务**

```powershell
git add packages/knowledge-base/src
git commit -m "feat: add validated public knowledge snapshot"
```

## 任务 3：实现只读查询与强制 T0 回退

**文件：**
- Create: `packages/knowledge-base/src/knowledge-base.ts`
- Create: `packages/knowledge-base/src/knowledge-base.test.ts`
- Modify: `packages/knowledge-base/src/index.ts`

- [ ] **步骤 1：编写查询行为的失败测试**

创建 `packages/knowledge-base/src/knowledge-base.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "./index.js";

describe("F0 knowledge-base queries", () => {
  it("loads shared v1 and resolves all three libraries", () => {
    const knowledgeBase = loadKnowledgeBase({ version: "v1" });
    expect(knowledgeBase.getKnowledgeBaseManifest().knowledgeBaseVersion).toBe("v1");
    expect(knowledgeBase.findCapability({ partCategory: "demo-bracket", tolerance: 0.2, unit: "mm" })).toMatchObject({ status: "matched", entry: { entryId: "cap-demo-bracket", capabilityTier: "T3" } });
    expect(knowledgeBase.getEngineeringRule({ ruleId: "cts-sigma" })).toMatchObject({ status: "matched", entry: { threshold: 6 } });
    expect(knowledgeBase.resolveTerminology({ termType: "part-category", value: "demo-bracket" })).toMatchObject({ status: "matched", entry: { canonicalName: "demo-bracket" } });
  });

  it("returns T0 without feasibility assertions for an unknown capability", () => {
    const result = loadKnowledgeBase({ version: "v1" }).findCapability({ partCategory: "unknown-category", tolerance: 0.2, unit: "mm" });
    expect(result).toEqual({ status: "unknown", capabilityTier: "T0", message: "制程能力未知，请与供应商确认", knowledgeBaseVersion: "v1" });
    expect(result).not.toHaveProperty("feasible");
  });

  it("does not let callers mutate a loaded snapshot", () => {
    const first = loadKnowledgeBase({ version: "v1" }).getEngineeringRule({ ruleId: "ctf-sigma" });
    expect(() => { (first as { entry?: { threshold: number } }).entry!.threshold = 999; }).toThrow();
    expect(loadKnowledgeBase({ version: "v1" }).getEngineeringRule({ ruleId: "ctf-sigma" })).toMatchObject({ entry: { threshold: 4 } });
  });
});
```

- [ ] **步骤 2：运行查询测试并确认失败**

运行：

```powershell
npm test -- packages/knowledge-base/src/knowledge-base.test.ts
```

预期：失败，因为 `loadKnowledgeBase` 尚未实现。

- [ ] **步骤 3：实现受限版本加载和查询对象**

创建 `packages/knowledge-base/src/knowledge-base.ts`。公开工厂与对象应为：

```ts
export function loadKnowledgeBase(request: unknown): KnowledgeBase {
  // Only { version: "v1" } is valid; no filesystem path, URL, or caller data is accepted.
}

export interface KnowledgeBase {
  getKnowledgeBaseManifest(): KnowledgeBaseManifest;
  findCapability(request: unknown): CapabilityMatch | CapabilityUnknown;
  getEngineeringRule(request: unknown): RuleMatch | RuleUnknown;
  resolveTerminology(request: unknown): TerminologyMatch | TerminologyUnknown;
}
```

并在同一文件定义完整的查询响应类型：

```ts
export type CapabilityMatch = { readonly status: "matched"; readonly knowledgeBaseVersion: "v1"; readonly entry: CapabilityEntry };
export type CapabilityUnknown = { readonly status: "unknown"; readonly knowledgeBaseVersion: "v1"; readonly capabilityTier: "T0"; readonly message: "制程能力未知，请与供应商确认" };
export type RuleMatch = { readonly status: "matched"; readonly knowledgeBaseVersion: "v1"; readonly entry: EngineeringRuleEntry };
export type RuleUnknown = { readonly status: "unknown"; readonly knowledgeBaseVersion: "v1" };
export type TerminologyMatch = { readonly status: "matched"; readonly knowledgeBaseVersion: "v1"; readonly entry: TerminologyEntry };
export type TerminologyUnknown = { readonly status: "unknown"; readonly knowledgeBaseVersion: "v1" };
```

`loadKnowledgeBase` 先以 `z.object({ version: z.string() }).strict()` 解析请求；缺少
`version`、额外的路径/URL 字段或非字符串版本抛出 `validation_error`。字符串版本不是
`v1` 时抛出 `feature_not_available`，详细字段为
`featureId: "F0"`、`dependencies: ["knowledge-base-v1"]`、
`enablementRequirements: ["approved-public-knowledge-snapshot"]`。

能力查询必须首先验证 `knowledgeBaseQueryRequestSchema`，然后要求 `partCategory`、`unit`
和公差范围完整匹配；`subsystem` 或 `datum` 被条目声明时也必须相等。无匹配、范围外或
上下文不足均返回完全相同的 `CapabilityUnknown`：

```ts
{ status: "unknown", capabilityTier: "T0", message: "制程能力未知，请与供应商确认", knowledgeBaseVersion: "v1" }
```

规则和术语未命中返回 `{ status: "unknown", knowledgeBaseVersion: "v1" }`，不进行模糊
匹配。所有 matched DTO 包含 `status: "matched"`、`knowledgeBaseVersion: "v1"` 和深冻的
`entry` 深拷贝。

- [ ] **步骤 4：导出 API 并运行查询测试**

在 `packages/knowledge-base/src/index.ts` 增加：

```ts
export * from "./knowledge-base.js";
```

运行：

```powershell
npm test -- packages/knowledge-base/src/knowledge-base.test.ts
npm run build -- --force
```

预期：查询测试与构建通过，生成可从 `@ai-assist/knowledge-base` 导入的 ESM 入口。

- [ ] **步骤 5：提交本任务**

```powershell
git add packages/knowledge-base/src
git commit -m "feat: add read-only F0 knowledge queries"
```

## 任务 4：同步 Feature Register 与公开治理说明

**文件：**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `docs/governance/feature-register.md`
- Modify: `README.md`

- [ ] **步骤 1：写入 F0 Register 更正的失败测试**

在 `packages/governance/src/policy-gate.test.ts` 增加：

```ts
it("reports the public read-only F0 knowledge base as available", () => {
  expect(getFeatureStatus("F0")).toEqual({
    featureId: "F0", title: "知识库", status: "available", dependsOn: ["knowledge-base-v1"],
    inputContractId: "knowledge-base-query-request-v1", outputContractId: "knowledge-base-query-result-v1",
    maximumClassification: "public",
    acceptanceChecks: ["anonymous-knowledge-base-fixture", "unknown-capability-t0-fixture", "knowledge-base-integrity-check"],
    externalPrerequisites: ["approved-public-knowledge-snapshot"], disableBehavior: "return feature_not_available",
  });
});

it.each(["F1", "F2", "F3", "F4", "F5", "F6", "F7"])("keeps %s unavailable", (featureId) => {
  expect(getFeatureStatus(featureId)?.status).toBe("unavailable");
});
```

- [ ] **步骤 2：运行治理测试并确认失败**

运行：

```powershell
npm test -- packages/governance/src/policy-gate.test.ts
```

预期：失败，因为当前 F0 仍然是 `TA 工作簿基础解析` 且状态为 `unavailable`。

- [ ] **步骤 3：仅更正 F0 条目，不触碰 F1–F8 行为**

在 `packages/governance/src/feature-register.ts` 将 F0 从 `unavailableFeature(...)` 改为：

```ts
{
  featureId: "F0", title: "知识库", status: "available", dependsOn: ["knowledge-base-v1"],
  inputContractId: "knowledge-base-query-request-v1", outputContractId: "knowledge-base-query-result-v1",
  maximumClassification: "public",
  acceptanceChecks: ["anonymous-knowledge-base-fixture", "unknown-capability-t0-fixture", "knowledge-base-integrity-check"],
  externalPrerequisites: ["approved-public-knowledge-snapshot"],
  disableBehavior: "return feature_not_available",
},
```

更新 `docs/governance/feature-register.md` 的概述和 F0 表格行，明确它只表示本地匿名
`public`、只读的 `knowledge-base-v1` 可用，并不能启用 F1–F7 或真实工程知识。

更新 `README.md` 的 Phase 0 段落为“F0 可用于匿名 `public` 的只读知识查询；F1-F7
保持不可用”，并在该列表加入 F0 设计和本计划链接。

- [ ] **步骤 4：运行治理聚焦测试**

运行：

```powershell
npm test -- packages/governance/src/policy-gate.test.ts
```

预期：F0 精确匹配新条目，F1–F7 仍全部不可用。

- [ ] **步骤 5：提交本任务**

```powershell
git add packages/governance docs/governance/feature-register.md README.md
git commit -m "docs: mark public F0 knowledge base available"
```

## 任务 5：执行 F0 跨包验收与仓库质量门

**文件：**
- Modify: `packages/knowledge-base/src/knowledge-base.test.ts`
- Modify: `docs/governance/feature-register.md`

- [ ] **步骤 1：添加 package ESM 入口和异常语义验收**

在 `packages/knowledge-base/src/knowledge-base.test.ts` 增加以下测试，确保发布入口及错误
模型不依赖源文件相对导入：

```ts
import { execFileSync } from "node:child_process";

it("exposes loadKnowledgeBase from the package ESM entrypoint", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "--eval", "import { loadKnowledgeBase } from '@ai-assist/knowledge-base'; console.log(typeof loadKnowledgeBase);"], { cwd: process.cwd(), encoding: "utf8" });
  expect(output.trim()).toBe("function");
});

it("fails closed for unsupported versions and malformed requests", () => {
  expect(() => loadKnowledgeBase({ version: "v2" })).toMatchObject({ code: "feature_not_available", featureId: "F0" });
  expect(() => loadKnowledgeBase({ path: "C:\\private.xlsx" })).toMatchObject({ code: "validation_error" });
});
```

- [ ] **步骤 2：运行聚焦验收并确认通过**

运行：

```powershell
npm test -- packages/knowledge-base/src/knowledge-base.test.ts packages/knowledge-base/src/validation.test.ts packages/governance/src/policy-gate.test.ts
```

预期：F0 三库正向查询、T0 回退、数据拒绝、ESM 导出和 Register 更正全部通过。

- [ ] **步骤 3：运行完整质量门**

运行：

```powershell
npm run build -- --force
npm run lint
npm test
npm run check:repository
git diff --check
```

预期：所有命令退出码为 `0`。若失败，只修复与 F0 改动直接相关的问题，并从相同的
聚焦测试重新开始验证。

- [ ] **步骤 4：在治理文档记录验收命令**

在 `docs/governance/feature-register.md` 的 F0 使用规则后加入以下 F0 验收命令，避免
读者将静态数据包误认为未验证的文档示例：

```powershell
npm test -- packages/knowledge-base/src/knowledge-base.test.ts packages/knowledge-base/src/validation.test.ts
npm run build -- --force
npm run lint
npm run check:repository
```

- [ ] **步骤 5：提交验收与文档**

```powershell
git add packages/knowledge-base/src/knowledge-base.test.ts docs/governance/feature-register.md
git commit -m "test: verify F0 knowledge base acceptance"
```

## 实施后检查

- [ ] 确认 `git status --short --branch` 只包含预期的 F0 文件。
- [ ] 确认 `git diff main...HEAD --check` 没有空白错误。
- [ ] 确认 PR 描述明确：匿名 `public` 数据、仅 Git/PR 更新、T0 不做可行性声明、未启用 F1-F7。
- [ ] 确认没有 `.xlsx`、`.xlsm`、DIM ID、供应商、真实项目标识、`confidential` 或 `secret` 内容被提交。