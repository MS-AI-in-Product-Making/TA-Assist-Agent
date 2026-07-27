# F6 最小方案比较占位实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供严格、机密且可调用的 F6 v1 方案比较占位，并维持 F6 不可用。

**Architecture:** `@ai-assist/contracts` 定义 request/result schema 与类型；`@ai-assist/workbook-catalog` 以纯函数验证请求、回显引用、返回固定状态和 prerequisite，并克隆冻结结果。治理注册不修改。

**Tech Stack:** TypeScript strict ESM、Zod v3、Vitest v3、`createTypedError`、`structuredClone` 和递归冻结模式。

---

### Task 1: 契约 RED/GREEN

**Files:** `packages/contracts/src/contracts.ts`, `packages/contracts/src/contracts.test.ts`

- [ ] 测试 `comparisonRequestSchema` 与 `comparisonResultSchema`：仅接受机密 v1 受控引用、F6 固定不可用状态和 `approved-knowledge-base` prerequisite；拒绝公共分类和未知字段。
- [ ] 运行 contracts 测试确认 schema 导出尚不存在，再添加最小严格 schema 与 `ComparisonRequest`/`ComparisonResult` 类型并确认测试通过。

### Task 2: 服务 RED/GREEN

**Files:** `packages/workbook-catalog/src/comparison-placeholder.ts`, `packages/workbook-catalog/src/comparison-placeholder.test.ts`, `packages/workbook-catalog/src/index.ts`

- [ ] 测试 `createComparisonPlaceholder` 的固定不可用结果、冻结、`policy_denied` 和 built ESM 入口；确认模块缺失后实现最小纯函数并导出。
- [ ] build 后重跑服务测试。

### Task 3: 治理与聚焦验证

**Files:** `packages/governance/src/policy-gate.test.ts`

- [ ] 断言 F6 继续 `unavailable`，且既有 contract ID 与 prerequisite 不变。
- [ ] 运行 build、F6 contracts/service/governance 测试、lint 与 `git diff --check`。