# F3 最小治理占位实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供严格、机密且可调用的 F3 v1 治理占位，同时保持 F3 不可用。

**Architecture:** `@ai-assist/contracts` 提供受控引用 request/result schema 与类型。`@ai-assist/workbook-catalog` 提供无副作用的纯函数，验证请求后回显引用、返回固定不可用状态和 prerequisite，并递归冻结克隆结果；治理注册不改变。

**Tech Stack:** TypeScript strict ESM、Zod v3、Vitest v3、现有 `createTypedError` 与 `structuredClone`/递归冻结模式。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `packages/contracts/src/contracts.ts` | F3 v1 严格 request/result schema 与公共类型。 |
| `packages/contracts/src/contracts.test.ts` | F3 schema 严格性和 ESM 导出回归。 |
| `packages/workbook-catalog/src/drawing-governance-placeholder.ts` | 纯不可用响应函数和机密输入错误处理。 |
| `packages/workbook-catalog/src/drawing-governance-placeholder.test.ts` | 回显、策略拒绝、冻结和 ESM 导出测试。 |
| `packages/workbook-catalog/src/index.ts` | 导出函数和 F3 类型。 |
| `packages/governance/src/policy-gate.test.ts` | 确认 F3 注册持续不可用且 contract ID 不变。 |

### Task 1: 定义严格 F3 契约

**Files:**
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/contracts/src/contracts.ts`

- [ ] **Step 1: 写出失败的 request/result schema 测试。**

  测试导入 `drawingGovernanceRequestSchema` 和 `drawingGovernanceResultSchema`，并断言下列值可解析：

  ```ts
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "project-ref",
    runReference: "run-ref",
    worksheetReferences: ["worksheet-ref"],
  };
  ```

  断言 result 仅接受 `featureId: "F3"`、`status: "feature_not_available"`、`outputClassification: "confidential"` 和精确 prerequisite `approved-ado-access`、`canonical-dim-id-policy`。断言 request/result 均拒绝未知字段和公共分类。

- [ ] **Step 2: 运行测试确认 RED。**

  Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts`

  Expected: FAIL，原因是 F3 schema 尚未导出。

- [ ] **Step 3: 写入最小 schema 和类型。**

  在 `contracts.ts` 添加 `.strict()` v1 schema；所有引用使用 `z.string().min(1)`，`worksheetReferences` 使用 `z.array(z.string().min(1))`。result 固定 feature/status/classification/prerequisite 枚举，并导出 `DrawingGovernanceRequest`、`DrawingGovernanceResult`。

- [ ] **Step 4: 运行同一测试确认 GREEN。**

  Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts`

  Expected: PASS。

### Task 2: 实现纯占位服务

**Files:**
- Create: `packages/workbook-catalog/src/drawing-governance-placeholder.test.ts`
- Create: `packages/workbook-catalog/src/drawing-governance-placeholder.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: 写出失败的行为与入口测试。**

  导入 `createDrawingGovernancePlaceholder`。以 Task 1 的 request 调用并断言返回固定不可用状态、引用回显、两个 prerequisite 及冻结输出；传入 `inputClassification: "public"` 时断言错误含 `policy_denied`。通过子进程从 `@ai-assist/workbook-catalog` 导入函数并断言其类型为 `function`。

- [ ] **Step 2: 运行测试确认 RED。**

  Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/drawing-governance-placeholder.test.ts`

  Expected: FAIL，原因是模块和入口导出尚不存在。

- [ ] **Step 3: 写入最小纯函数并导出。**

  以 `drawingGovernanceRequestSchema.safeParse` 验证输入；显式非机密分类时用 `createTypedError({ code: "policy_denied", ... })` 拒绝，其余无效输入使用 `validation_error`。用经验证 request 构造固定 result，使用 `drawingGovernanceResultSchema.safeParse` 验证后 `structuredClone` 并递归冻结。仅从 `index.ts` 导出函数及两个类型。

- [ ] **Step 4: 运行同一测试确认 GREEN。**

  Run: `npm run build -- --force; npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/drawing-governance-placeholder.test.ts`

  Expected: PASS。

### Task 3: 验证 F3 治理边界

**Files:**
- Modify: `packages/governance/src/policy-gate.test.ts`

- [ ] **Step 1: 写出 F3 注册不变测试。**

  断言 `getFeatureStatus("F3")` 的 `status` 为 `unavailable`、input/output contract ID 为 `drawing-governance-request-v1` / `drawing-governance-result-v1`，并保留两个外部 prerequisite。

- [ ] **Step 2: 运行测试确认 GREEN。**

  Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts`

  Expected: PASS，因为注册本身不应改变。

### Task 4: 执行完整聚焦验证

**Files:**
- Verify only: `packages/contracts/src/contracts.test.ts`, `packages/workbook-catalog/src/drawing-governance-placeholder.test.ts`, `packages/governance/src/policy-gate.test.ts`

- [ ] **Step 1: 构建并运行聚焦测试。**

  Run: `npm run build -- --force; npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/drawing-governance-placeholder.test.ts packages/governance/src/policy-gate.test.ts; npm run lint`

  Expected: build、聚焦测试和 lint 均以 exit code 0 结束。