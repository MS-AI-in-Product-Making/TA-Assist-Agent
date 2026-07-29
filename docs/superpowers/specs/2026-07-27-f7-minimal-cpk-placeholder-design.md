# F7 实测 Cpk 闭环最小占位设计

**日期：** 2026-07-27

## 目标

本次 F7 只定义可调用、严格且机密的实测 Cpk 闭环服务边界。它接受受控引用并返回不可用结果，使后续负责测量数据导入、DIM ID 锚定、能力计算与知识库回填的团队能替换实现而不破坏调用方。

F7 在治理注册中继续保持 `unavailable`，并保留既有 `cpk-request-v1` 与 `cpk-result-v1` contract ID。

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
  featureId: "F7",
  status: "feature_not_available",
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetReferences: ["controlled-worksheet-reference"],
  requiredPrerequisites: ["approved-measurement-store"],
}
```

公共入口为 `createCpkPlaceholder(request: unknown): CpkResult`。显式非机密输入返回 `policy_denied`，其他无效输入返回 `validation_error`。结果仅回显验证后的受控引用，并在克隆后递归冻结。

## 不在范围内

- 测量记录、DIM ID、Cpk、良率、分布、均值、标准差、规格或实际能力的读取、导入、校验或计算。
- 初始估算与实测结果的差异、容差范围重算、任何工程建议或结论。
- Capability Library 查询、T3 到 T1 的证据等级升级、版本历史或审批写入。
- network、持久化、日志、UI、文件、workbook 字节、外部测量存储或外部适配器。
- 将 F7 设为 `available`，或修改 F0、F6、F8。

## 测试与治理

测试覆盖严格 schema、未知字段、非机密拒绝、固定 prerequisite、深度冻结和 ESM 导出。治理回归确认 F7 仍为 `unavailable`，并使用既有 v1 contract ID、依赖项和外部 prerequisite。