# F7 实测 Cpk 闭环最小占位实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供严格、机密且可调用的 F7 v1 实测 Cpk 闭环占位，并维持 F7 不可用。

**Architecture:** `@ai-assist/contracts` 定义 request/result schema 与类型。`@ai-assist/workbook-catalog` 以纯函数验证请求、回显引用、返回固定状态和 prerequisite，并克隆冻结结果。治理注册不修改，只增加 F7 完整注册的回归断言。

**Tech Stack:** TypeScript strict ESM、Zod v3、Vitest v3、`createTypedError`、`structuredClone` 和递归冻结模式。

---

### Task 1: F7 契约 RED/GREEN

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: 写入 F7 契约失败测试。** 在 `contracts.test.ts` 从 `./index.js` 的 import 列表加入 `cpkRequestSchema` 与 `cpkResultSchema`，并在顶层新增：

```ts
describe("F7 Cpk placeholder contracts", () => {
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
  };
  const result = {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F7",
    status: "feature_not_available",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetReferences: ["controlled-worksheet-reference"],
    requiredPrerequisites: ["approved-measurement-store"],
  };

  it("accepts only confidential controlled references and a fixed unavailable result", () => {
    expect(cpkRequestSchema.parse(request)).toEqual(request);
    expect(cpkResultSchema.parse(result)).toEqual(result);
  });

  it("rejects public classification, unknown fields, and altered prerequisites", () => {
    expect(cpkRequestSchema.safeParse({ ...request, inputClassification: "public" }).success).toBe(false);
    expect(cpkRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(cpkResultSchema.safeParse({ ...result, requiredPrerequisites: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 确认测试为 RED。**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL，`cpkRequestSchema` 与 `cpkResultSchema` 尚未导出。

- [ ] **Step 3: 添加最小严格 schema 和 inferred types。** 在 `contracts.ts` 的 F6 schema 后新增：

```ts
export const cpkRequestSchema = z
  .object({
    contractVersion: contractVersionSchema,
    inputClassification: z.literal("confidential"),
    projectReference: z.string().min(1),
    runReference: z.string().min(1),
    worksheetReferences: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const cpkResultSchema = z
  .object({
    contractVersion: contractVersionSchema,
    outputClassification: z.literal("confidential"),
    featureId: z.literal("F7"),
    status: z.literal("feature_not_available"),
    projectReference: z.string().min(1),
    runReference: z.string().min(1),
    worksheetReferences: z.array(z.string().min(1)).min(1),
    requiredPrerequisites: z.tuple([z.literal("approved-measurement-store")]),
  })
  .strict();
```

在现有 type 导出区加入：

```ts
export type CpkRequest = z.infer<typeof cpkRequestSchema>;
export type CpkResult = z.infer<typeof cpkResultSchema>;
```

- [ ] **Step 4: 确认契约为 GREEN 并提交。**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
git add -- packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat: add F7 Cpk contracts"
```

Expected: PASS，包含 F7 两个新测试。

### Task 2: F7 纯占位服务 RED/GREEN

**Files:**
- Create: `packages/workbook-catalog/src/cpk-placeholder.ts`
- Create: `packages/workbook-catalog/src/cpk-placeholder.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: 创建失败服务测试。** 新建 `cpk-placeholder.test.ts`：

```ts
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createCpkPlaceholder } from "./cpk-placeholder.js";

const request = {
  contractVersion: "v1" as const,
  inputClassification: "confidential" as const,
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetReferences: ["controlled-worksheet-reference"],
};

describe("Cpk placeholder", () => {
  it("returns a deeply frozen unavailable result while preserving controlled references", () => {
    const result = createCpkPlaceholder(request);

    expect(result).toEqual({
      contractVersion: "v1",
      outputClassification: "confidential",
      featureId: "F7",
      status: "feature_not_available",
      projectReference: "controlled-project-reference",
      runReference: "controlled-run-reference",
      worksheetReferences: ["controlled-worksheet-reference"],
      requiredPrerequisites: ["approved-measurement-store"],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.worksheetReferences)).toBe(true);
    expect(Object.isFrozen(result.requiredPrerequisites)).toBe(true);
    expect(() => { (result.worksheetReferences as string[]).push("changed"); }).toThrow();
  });

  it("denies a non-confidential request with a policy error", () => {
    let error: unknown;
    try {
      createCpkPlaceholder({ ...request, inputClassification: "public" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: "policy_denied" });
  });

  it("exports createCpkPlaceholder through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import { createCpkPlaceholder } from '@ai-assist/workbook-catalog'; console.log(typeof createCpkPlaceholder);"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });
});
```

- [ ] **Step 2: 确认服务测试为 RED。**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/cpk-placeholder.test.ts
```

Expected: FAIL，`cpk-placeholder.js` 尚不存在。

- [ ] **Step 3: 添加最小纯服务。** 新建 `cpk-placeholder.ts`，使用 `comparison-placeholder.ts` 的同一验证、`createTypedError`、`structuredClone` 和递归冻结结构，替换项必须为：

```ts
import { cpkRequestSchema, cpkResultSchema, createTypedError, type CpkResult } from "@ai-assist/contracts";

const REQUEST_SUMMARY = "Cpk request is invalid.";
const POLICY_SUMMARY = "Cpk input is not permitted.";
```

请求错误使用 `affectedInputReferences: ["cpk-request-v1"]`。函数签名为：

```ts
export function createCpkPlaceholder(request: unknown): CpkResult
```

合法请求必须只生成：

```ts
{
  contractVersion: "v1",
  outputClassification: "confidential",
  featureId: "F7",
  status: "feature_not_available",
  projectReference: input.projectReference,
  runReference: input.runReference,
  worksheetReferences: input.worksheetReferences,
  requiredPrerequisites: ["approved-measurement-store"],
}
```

在 `index.ts` 添加：

```ts
export { createCpkPlaceholder } from "./cpk-placeholder.js";
```

并在 contracts type re-export 列表加入 `CpkRequest` 和 `CpkResult`。

- [ ] **Step 4: 确认服务为 GREEN 并提交。**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/cpk-placeholder.test.ts
git add -- packages/workbook-catalog/src/cpk-placeholder.ts packages/workbook-catalog/src/cpk-placeholder.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat: add F7 Cpk placeholder"
```

Expected: build 成功；服务测试 3 项 PASS。

### Task 3: F7 治理回归与最终验证

**Files:**
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `docs/superpowers/plans/2026-07-28-f7-minimal-cpk-placeholder.md`

- [ ] **Step 1: 添加 F7 完整注册断言。** 在 F6 的完整断言后新增：

```ts
it("keeps F7 unavailable with its established Cpk contracts", () => {
  expect(getFeatureStatus("F7")).toEqual({
    featureId: "F7",
    title: "实测 Cpk 闭环",
    status: "unavailable",
    dependsOn: ["measurement-store-v1", "dim-id-service-v1"],
    inputContractId: "cpk-request-v1",
    outputContractId: "cpk-result-v1",
    maximumClassification: "confidential",
    acceptanceChecks: ["anonymous-cpk-fixture"],
    externalPrerequisites: ["approved-measurement-store", "canonical-dim-id-policy"],
    disableBehavior: "return feature_not_available",
  });
});
```

- [ ] **Step 2: 运行聚焦验证。**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/cpk-placeholder.test.ts packages/governance/src/policy-gate.test.ts
npm run lint
git diff --check
```

Expected: build、全部聚焦测试、lint 和差异检查通过。

- [ ] **Step 3: 提交治理测试与计划。**

```powershell
git add -- packages/governance/src/policy-gate.test.ts docs/superpowers/plans/2026-07-28-f7-minimal-cpk-placeholder.md
git commit -m "test: lock F7 Cpk placeholder governance"
```