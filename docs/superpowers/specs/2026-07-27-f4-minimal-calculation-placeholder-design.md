# F4 Excel 一致性计算最小占位设计

**日期：** 2026-07-27

## 目标

本次 F4 仅定义可调用、严格且机密的计算服务边界。它接受受控引用并返回不可用结果，使后续负责公式、模板回归和 Excel worker 的团队可以替换实现而不破坏调用方。

F4 在治理注册中继续保持 `unavailable`，且既有 `calculation-request-v1` 与 `calculation-result-v1` contract ID 不变。

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
  featureId: "F4",
  status: "feature_not_available",
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetReferences: ["controlled-worksheet-reference"],
  requiredPrerequisites: ["approved-template-regression", "approved-windows-excel-worker"],
}
```

公共入口为 `createCalculationPlaceholder(request: unknown): CalculationResult`。显式非机密输入返回 `policy_denied`，其他无效输入返回 `validation_error`。结果仅回显验证后的受控引用，并在克隆后递归冻结。

## 不在范围内

- Worst Case、RSS、3D referral、CTS/CTF 或方法推荐。
- 因子数据、单位、公式、Cp/Cpk/Z/DPM/yield、数值计算或精度规则。
- Excel/Windows worker、workbook 字节、模板、文件、网络、持久化、日志或 UI。
- 将 F4 设为 `available`，或修改 F8。

## 测试与治理

测试覆盖严格 schema、未知字段、非机密拒绝、固定 prerequisite、深度冻结和 ESM 导出。治理回归确认 F4 仍为 `unavailable`，且使用既有 v1 contract ID。