# F5 客观结果解释最小占位设计

**日期：** 2026-07-27

## 目标

本次 F5 只定义可调用、严格且机密的解释服务边界。它接受受控引用并返回不可用结果，以便后续负责计算事实、规则引用和澄清流程的团队替换实现而不破坏调用方。

F5 在治理注册中继续保持 `unavailable`，并保留既有 `interpretation-request-v1` 与 `interpretation-result-v1` contract ID。

## 输入、输出与纯函数

```ts
{
  contractVersion: "v1",
  inputClassification: "confidential",
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetReferences: ["controlled-worksheet-reference"],
}

{
  contractVersion: "v1",
  outputClassification: "confidential",
  featureId: "F5",
  status: "feature_not_available",
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetReferences: ["controlled-worksheet-reference"],
  requiredPrerequisites: ["approved-knowledge-base"],
}
```

公共入口为 `createInterpretationPlaceholder(request: unknown): InterpretationResult`。显式非机密输入返回 `policy_denied`，其他无效输入返回 `validation_error`。结果仅回显验证后的受控引用，并在克隆后递归冻结。

## 不在范围内

- `FACT`、`RULE`、`SIGNAL`、`OPTION`、结论、排序、建议或工程判断。
- calculation result、知识库查询、规则阈值、规则引用、来源证据、图纸证据、澄清卡或假设日志。
- 网络、持久化、日志、UI、文件、workbook 字节或外部适配器。
- 将 F5 设为 `available`，或修改 F8。

## 测试与治理

测试覆盖严格 schema、未知字段、非机密拒绝、固定 prerequisite、深度冻结和 ESM 导出。治理回归确认 F5 仍为 `unavailable`，并使用既有 v1 contract ID。