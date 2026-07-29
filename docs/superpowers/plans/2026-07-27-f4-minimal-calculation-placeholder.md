# F4 最小计算占位实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供严格、机密且可调用的 F4 v1 计算占位，并维持 F4 不可用。

**Architecture:** `@ai-assist/contracts` 定义 request/result schema 与类型；`@ai-assist/workbook-catalog` 以纯函数验证请求、回显引用、返回固定状态及 prerequisite，并克隆冻结结果。治理注册不修改。

**Tech Stack:** TypeScript strict ESM、Zod v3、Vitest v3、`createTypedError`、`structuredClone` 和递归冻结模式。

---

### Task 1: 契约 RED/GREEN

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] 先测试 `calculationRequestSchema` 与 `calculationResultSchema`：仅接受机密 v1 受控引用、F4 固定不可用状态及顺序固定的 prerequisite；拒绝公共分类和未知字段。
- [ ] 运行 `npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts`，确认新增导出缺失。
- [ ] 实现严格 schema 与 `CalculationRequest`/`CalculationResult` 类型，并重跑同一测试确认通过。

### Task 2: 服务 RED/GREEN

**Files:**
- Create: `packages/workbook-catalog/src/calculation-placeholder.ts`
- Create: `packages/workbook-catalog/src/calculation-placeholder.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] 先测试 `createCalculationPlaceholder` 的固定不可用结果、冻结、`policy_denied` 和 built ESM 入口。
- [ ] 运行该测试，确认模块缺失。
- [ ] 实现最小纯函数并从入口导出，然后 build 并重跑测试。

### Task 3: 治理与聚焦验证

**Files:**
- Modify: `packages/governance/src/policy-gate.test.ts`

- [ ] 断言 F4 保持 `unavailable`、既有 contract ID 和两个 prerequisite 不变。
- [ ] 运行 build、F4 contracts/service/governance 测试、lint 与 `git diff --check`。