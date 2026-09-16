# Task 9 Fix Round 1 Report

## 结论

修复了 `scripts/verify-current-f6.mjs` 的当前 ADO 追踪验证顺序：现在会先检查当前报告里的 `/_workitems/edit/` 链接，再处理 `summary` / `manifest` 中 `adoTraceability` 为空的情况。这样，current v3/v4 报告如果包含合法-looking 的 ADO work item 链接，但摘要与清单里没有结构化 ADO identity，会被拒绝；而没有 identity 且没有链接的 `not_requested` 语义仍然接受。

## 变更

- `scripts/verify-current-f6.mjs`
- `scripts/verify-current-f6.test.mjs`

## 验证

- `npx vitest run scripts/verify-current-f6.test.mjs`
- `npx vitest run --project node scripts/verify-current-f6.test.mjs scripts/f6-full-flow.test.mjs scripts/run-f6-full-validation.test.mjs packages/workflow-runners/src/f6.test.ts`
- `npm run build -- --force`
- `node scripts/verify-current-f6.mjs` 返回 `rejected`，符合新规则对当前 artifact 的 fail-closed 行为

## 状态

- 工作区已恢复 build 生成的 `packages/contracts/dist/f7-contracts.d.ts`
- 当前剩余改动仅为本次 verifier 修复
