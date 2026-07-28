# F8 公开工作流契约实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为匿名 `public` F8 smoke workflow 提供严格、可查询且不泄露本地运行目录的 `workflow-request-v1` / `workflow-result-v1` 公共契约入口。

**Architecture:** `@ai-assist/contracts` 定义 DTO 与 `PublicWorkflowRequest` / `PublicWorkflowResult`。`@ai-assist/orchestrator` 以 `runPublicWorkflow` 包装既有 `runSmokeWorkflow`，只映射验证后的 message 与固定的两项 Skill；既有 smoke API 和 CLI 不变。

**Tech Stack:** TypeScript strict ESM、Zod v3、Vitest v3、`createTypedError`、`structuredClone` 和递归冻结。

---

### Task 1: F8 契约 RED/GREEN

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: 添加失败 schema 测试。** 从 `./index.js` import `workflowRequestSchema`、`workflowResultSchema`，并新增：

```ts
describe("F8 public workflow contracts", () => {
  const request = {
    contractVersion: "v1",
    workflowId: "public-smoke",
    inputClassification: "public",
    message: "anonymous smoke message",
  };
  const result = {
    contractVersion: "v1",
    workflowId: "public-smoke",
    outputClassification: "public",
    runId: "00000000-0000-4000-8000-000000000001",
    manifestValid: true,
    executedSkillIds: ["public-echo", "classification-check"],
  };

  it("accepts the fixed public smoke request and result", () => {
    expect(workflowRequestSchema.parse(request)).toEqual(request);
    expect(workflowResultSchema.parse(result)).toEqual(result);
  });

  it("rejects non-public input, unknown fields, invalid messages, and altered skill order", () => {
    expect(workflowRequestSchema.safeParse({ ...request, inputClassification: "confidential" }).success).toBe(false);
    expect(workflowRequestSchema.safeParse({ ...request, unexpected: true }).success).toBe(false);
    expect(workflowRequestSchema.safeParse({ ...request, message: " " }).success).toBe(false);
    expect(workflowResultSchema.safeParse({ ...result, executedSkillIds: ["classification-check", "public-echo"] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 确认 RED。**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL，F8 schema 尚未导出。

- [ ] **Step 3: 添加最小严格 schema 与类型。** 在 `contracts.ts` 的 F7 schema 后添加：

```ts
const workflowRunIdSchema = z.string().uuid();

export const workflowRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  workflowId: z.literal("public-smoke"),
  inputClassification: z.literal("public"),
  message: z.string().trim().min(1).max(4_096),
}).strict();

export const workflowResultSchema = z.object({
  contractVersion: contractVersionSchema,
  workflowId: z.literal("public-smoke"),
  outputClassification: z.literal("public"),
  runId: workflowRunIdSchema,
  manifestValid: z.literal(true),
  executedSkillIds: z.tuple([
    z.literal("public-echo"),
    z.literal("classification-check"),
  ]),
}).strict();

export type PublicWorkflowRequest = z.infer<typeof workflowRequestSchema>;
export type PublicWorkflowResult = z.infer<typeof workflowResultSchema>;
```

- [ ] **Step 4: 确认 GREEN 并提交。**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
git add -- packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat: add F8 public workflow contracts"
```

Expected: PASS，包含 F8 的两项新增测试。

### Task 2: F8 包装入口 RED/GREEN

**Files:**
- Modify: `packages/orchestrator/src/run-orchestrator.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `packages/orchestrator/src/index.test.ts`

- [ ] **Step 1: 添加失败入口测试。** 从 `./index.js` import `runPublicWorkflow`。用 `mkdtemp` 临时 root 调用：

```ts
{
  contractVersion: "v1",
  workflowId: "public-smoke",
  inputClassification: "public",
  message: "public contract smoke",
}
```

断言结果为 `contractVersion: "v1"`、`workflowId: "public-smoke"`、`outputClassification: "public"`、`manifestValid: true`、`executedSkillIds: ["public-echo", "classification-check"]` 和 UUID `runId`；断言结果及 `executedSkillIds` 已冻结，且 `"runDirectory" in result` 为 false。另以 `inputClassification: "confidential"` 调用并断言错误 `code` 为 `policy_denied`。每个测试在 `finally` 删除临时 root。

- [ ] **Step 2: 确认 RED。**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/orchestrator/src/index.test.ts
```

Expected: FAIL，`runPublicWorkflow` 尚未导出。

- [ ] **Step 3: 实现最小包装入口。** 在 `run-orchestrator.ts` 导入 `workflowRequestSchema`、`workflowResultSchema`、`PublicWorkflowResult` 和 `createTypedError`；添加：

```ts
export interface RunPublicWorkflowOptions {
  readonly rootDir: string;
  readonly request: unknown;
}
```

`runPublicWorkflow` 安全读取分类：显式字符串且不是 `public` 时抛出 `policy_denied`，并使用 `affectedInputReferences: ["workflow-request-v1"]`；其他 schema 失败抛出 `validation_error`。验证后仅将 message 映射为既有 `runSmokeWorkflow` 私有 request。结果必须验证两项内部 skill ID 严格等于 `public-echo`、`classification-check`，否则抛出 `internal_error`。再用 `workflowResultSchema` 验证公开字段，克隆并递归冻结后返回；不得返回 `runDirectory`、`skillResults`、adapter 或私有 request。

在 `index.ts` 导出 `runPublicWorkflow` 和 `RunPublicWorkflowOptions`，并从 contracts re-export `PublicWorkflowRequest`、`PublicWorkflowResult`。

- [ ] **Step 4: 确认 GREEN 及 ESM 导出。** 在 orchestrator 测试新增 built ESM 断言：

```ts
const output = execFileSync(
  process.execPath,
  ["--input-type=module", "--eval", "import { runPublicWorkflow } from '@ai-assist/orchestrator'; console.log(typeof runPublicWorkflow);"],
  { cwd: process.cwd(), encoding: "utf8" },
);
expect(output.trim()).toBe("function");
```

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/orchestrator/src/index.test.ts
git add -- packages/orchestrator/src/run-orchestrator.ts packages/orchestrator/src/index.ts packages/orchestrator/src/index.test.ts
git commit -m "feat: add F8 public workflow entry"
```

Expected: build 和 orchestrator 测试通过。

### Task 3: F8 治理与兼容性回归

**Files:**
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `docs/governance/feature-register.md`
- Modify: `docs/superpowers/plans/2026-07-28-f8-public-workflow-contract.md`

- [ ] **Step 1: 添加完整 F8 注册断言。**

```ts
it("reports F8 as the available anonymous public workflow fixture", () => {
  expect(getFeatureStatus("F8")).toEqual({
    featureId: "F8",
    title: "TA 工作流编排",
    status: "available",
    dependsOn: ["orchestrator-v1", "skill-runtime-v1"],
    inputContractId: "workflow-request-v1",
    outputContractId: "workflow-result-v1",
    maximumClassification: "public",
    acceptanceChecks: ["anonymous-workflow-fixture", "anonymous-governed-skill"],
    externalPrerequisites: ["approved-skill-manifests"],
    disableBehavior: "return feature_not_available",
  });
});
```

- [ ] **Step 2: 更新 F8 规则。** 在 `docs/governance/feature-register.md` 的 F8 段落补充：新入口只接受 `workflowId: "public-smoke"`，固定两项 Skill；公开结果不包含 `runDirectory` 或 Skill 输出；CLI smoke 仍是兼容 fixture。

- [ ] **Step 3: 运行聚焦验证与 CLI 兼容性测试。**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/orchestrator/src/index.test.ts packages/governance/src/policy-gate.test.ts apps/cli/src/phase-0.acceptance.test.ts
npm run lint
git diff --check
```

Expected: build、聚焦测试、CLI smoke 兼容性、lint 和差异检查全部通过。

- [ ] **Step 4: 提交回归、文档和计划。**

```powershell
git add -- packages/governance/src/policy-gate.test.ts docs/governance/feature-register.md docs/superpowers/plans/2026-07-28-f8-public-workflow-contract.md
git commit -m "test: lock F8 public workflow governance"
```