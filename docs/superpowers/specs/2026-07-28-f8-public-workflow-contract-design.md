# F8 公开工作流契约边界设计

**日期：** 2026-07-28

## 目标

本次 F8 将现有匿名 `public` smoke workflow 从 orchestrator 的私有 request/result 类型提升为严格、可查询的 `workflow-request-v1` 与 `workflow-result-v1` 契约。新的公共入口只包装已有受治理的两步运行，不改变既有 `runSmokeWorkflow` 或 CLI `smoke` fixture。

F8 在治理注册中继续保持 `available`，其含义仍严格限定为匿名、`public`、受治理 Skill fixture；这不代表完整 TA 工作流、生产编排、报告面板或任何外部写入已可用。

## 输入、输出与包装入口

```ts
{
  contractVersion: "v1",
  workflowId: "public-smoke",
  inputClassification: "public",
  message: "anonymous smoke message",
}

{
  contractVersion: "v1",
  workflowId: "public-smoke",
  outputClassification: "public",
  runId: "00000000-0000-4000-8000-000000000001",
  manifestValid: true,
  executedSkillIds: ["public-echo", "classification-check"],
}
```

公共入口为：

```ts
runPublicWorkflow({ rootDir, request: unknown }): Promise<PublicWorkflowResult>
```

它先解析 `workflow-request-v1`，再将验证后的 `message` 映射为现有 `runSmokeWorkflow` 的私有输入。它验证内部运行只完成固定的 `public-echo` 和 `classification-check` 两项受治理 Skill，并以 `workflow-result-v1` 创建、克隆并递归冻结公开结果。

`runDirectory` 是本地存储实现细节，不属于公开结果契约，也不得出现在该入口返回值中。`rootDir` 是本地运行配置，不属于请求 DTO。

显式非 `public` 分类返回 `policy_denied`；未知字段、错误版本、错误 workflow ID、空白或超长 message 等其他无效输入返回 `validation_error`。

## 兼容性与不在范围内

- 既有 `runSmokeWorkflow`、`SmokeWorkflowRequest`、`WorkflowResult` 和 CLI `smoke` 的输入输出行为保持不变。
- 请求不得选择任意 Skill、步骤、adapter、权限、重试策略或运行目录。
- 不接收 `internal`、`confidential` 或 `secret` 数据，不连接 F1-F7，不解析 workbook，也不生成 TA 报告、风险结论或面板。
- 不新增 network、外部持久化、ADO 写入、邮件、文件导出、UI 或外部 adapter 权限；既有本地匿名 run/audit 封存仍由现有 orchestrator 负责。
- 不修改 F8 的 `available` 状态、依赖、外部 prerequisite 或 F0-F7 状态。

## 测试与治理

测试覆盖 request/result schema 的严格性、`policy_denied` 与 `validation_error` 分类、固定 Skill 顺序、结果深度冻结、ESM 导出及既有 CLI smoke 兼容性。治理回归确认 F8 继续使用既有 `workflow-request-v1` / `workflow-result-v1` contract ID，并维持匿名 `public` fixture 限制。