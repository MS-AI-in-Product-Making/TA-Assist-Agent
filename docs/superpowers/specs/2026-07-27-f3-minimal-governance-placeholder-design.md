# F3 DIM ID 与图纸治理最小占位设计

**日期：** 2026-07-27

## 目标

本次 F3 只定义可调用、严格且机密的治理边界。它接受受控引用并返回不可用结果，使后续负责 DIM ID 和图纸治理的团队可在不破坏调用方的前提下替换实现。

F3 在治理注册中继续保持 `unavailable`。本次不将它接入 F8，也不改变现有 `drawing-governance-request-v1` 或 `drawing-governance-result-v1` contract ID。

## 输入与输出

请求和结果均为严格的 v1 DTO，且仅允许 `confidential` 分类：

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
  featureId: "F3",
  status: "feature_not_available",
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetReferences: ["controlled-worksheet-reference"],
  requiredPrerequisites: ["approved-ado-access", "canonical-dim-id-policy"],
}
```

`projectReference`、`runReference` 与每个 `worksheetReference` 都是非空的受控标识符。它们不能代表工作簿内容、文件路径、URL、DIM ID 值、Drawing Number、图纸内容、ADO work item 或人员身份。输出逐项回显通过验证的引用，并在克隆后递归冻结。

## 纯函数

公共入口为：

```ts
export function createDrawingGovernancePlaceholder(request: unknown): DrawingGovernanceResult
```

显式给出非机密分类时，函数以 `policy_denied` 拒绝；任何无效 schema 则以 `validation_error` 拒绝。函数不读取、写入或记录机密值，也不创建时间、随机数、文件、网络或持久化副作用。

## 明确不在范围内

- DIM ID 生成、解析、规范化、去重或 crosswalk。
- 图纸识别、图纸关联、图纸包、Drawing Number 处理或 OCR。
- ADO、网络、身份/所有者、提醒、里程碑、存储或 UI。
- F1.1/F2 DTO 绑定、workbook 字节、路径、URL、图像或外部适配器。
- F3 状态升级为 `available`，或更改 F8 编排。

## 测试与治理

匿名 fixture 覆盖严格 schema、未知字段、非机密拒绝、输入引用回显、固定 prerequisite、深度冻结和 ESM 导出。治理回归确认 F3 仍为 `unavailable`，并继续使用既有 v1 contract ID 与 prerequisite。