# F6 可比较方案选项最小占位设计

**日期：** 2026-07-27

## 目标

本次 F6 只定义可调用、严格且机密的方案比较服务边界。它接受受控引用并返回不可用结果，使后续负责反向求解、可行性判断和方案比较的团队能替换实现而不破坏调用方。

F6 在治理注册中继续保持 `unavailable`，并保留既有 `comparison-request-v1` 与 `comparison-result-v1` contract ID。

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
  featureId: "F6",
  status: "feature_not_available",
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetReferences: ["controlled-worksheet-reference"],
  requiredPrerequisites: ["approved-knowledge-base"],
}
```

公共入口为 `createComparisonPlaceholder(request: unknown): ComparisonResult`。显式非机密输入返回 `policy_denied`，其他无效输入返回 `validation_error`。结果仅回显验证后的受控引用，并在克隆后递归冻结。

## 不在范围内

- `OPTION` 数据、方案排序、工程推荐、成本比较或任何结论。
- Cpk、容差、均值、贡献度、反向求解、what-if 计算或精度策略。
- CTS/CTF 限制、Capability Library 查询、T0 判定或可行性判断。
- network、持久化、日志、UI、文件、workbook 字节或外部适配器。
- 将 F6 设为 `available`，或修改 F8。

## 测试与治理

测试覆盖严格 schema、未知字段、非机密拒绝、固定 prerequisite、深度冻结和 ESM 导出。治理回归确认 F6 仍为 `unavailable`，并使用既有 v1 contract ID。