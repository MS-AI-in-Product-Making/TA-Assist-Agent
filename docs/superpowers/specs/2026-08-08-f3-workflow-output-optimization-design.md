# F3 工作流与输出优化设计

## 背景

当前 F3 直接消费 F2 artifact 中所有 `ready` worksheet，没有在执行前提醒用户选择分析范围。选择 `Use an existing ADO work item` 后，现有 skill 只规定验证 work item ID，没有显式收集 ADO URL。F3 从 F2 行映射治理结果时还丢失了指向 F1 截面图的 `imageReference`，导致 Markdown 中 `Device Level Dim`、`Dimension Description` 和 `Factor Description` 只能显示纯文本。现有 `Source Location` 仅拼接源单元格地址，缺少 worksheet、table、row 和字段对应关系，语义不清。

## 目标

1. F3 执行前必须列出 F2 中状态为 `ready` 的 worksheets，并要求用户至少选择一个。
2. existing ADO 模式必须要求用户输入 ADO work item URL，并从 URL 自动解析 ADO number。
3. F3 Markdown 中三列必须链接到对应 worksheet 的 F1 输出图片，F1 图片是唯一图片锚点，F3 不复制或生成替代图片。
4. 将 Markdown 列名 `Source Location` 改为 `Source Evidence`，以结构化、可读方式显示来源。
5. 保持 F3 的治理计算、排序、ADO 写入确认和 Surface-only 发布约束不变。

## 非目标

- 不允许 F3 从原始 workbook 的全部 worksheets 中重新选择。
- 不回退或重跑 F1/F2。
- 不在 F3 输出目录复制 F1 图片。
- 不将 ADO URL 写入 F3 JSON 持久化合同；通过验证后继续使用已有 `workItemReference` 保存解析出的 ID。
- 不改变 DIM ID 分类、重复冲突识别或治理状态规则。

## 方案

采用合同贯通方案：skill 负责用户交互和发布门禁，F3 workflow 接收 worksheet 过滤参数，artifact loader 负责验证并过滤 F2 ready worksheets，F3 行合同透传 F2 已有的 F1 `imageReference`，Markdown renderer 使用该引用生成相对链接。

不采用临时复制或改写 F2 artifact 的方案，因为这会产生不受合同管理的中间工件并削弱审计链。不把完整交互嵌入 CLI，因为 worksheet 和 ADO 发布交互已经由 VS Code skill 与 Surface MCP 管理，重复实现会造成行为分叉。

## Worksheet 选择流程

1. 解析用户提供的 TA workbook 或 F2 artifact 输入，并完成现有前置条件检查。
2. 读取 F2 report 中状态为 `ready` 的 worksheet 名称，保持 artifact 中的确定性顺序。
3. 使用独立的 `vscode_askQuestions` 调用显示多选问题，允许选择一个或多个 worksheet。
4. 用户取消或没有选择任何 worksheet 时停止，不运行 F3，也不进入 ADO 发布模式问题。
5. 将选择结果作为现有 `workflow:f3` 命令的可选 worksheet 参数传入。
6. loader 校验每个名称都属于 F2 ready worksheets。出现未知、重复或空选择时 fail closed，不生成部分报告。
7. 未提供过滤参数的直接 CLI 调用保持兼容，继续处理所有 F2 ready worksheets。

该选择只缩小 F3 分析范围，不改变 F2 artifact，也不让 blocked worksheet 绕过 F2 门禁。

## Existing ADO 流程

选择 `Use an existing ADO work item` 后，skill 必须进行独立问题调用以收集 ADO URL。URL 必须符合 Azure DevOps work item URL 形式并包含 `_workitems/edit/<id>`；skill 从 URL 解析正整数 ID，不再要求用户重复填写 ADO number。

随后保持严格验证顺序：

1. 从 URL 确认 organization。
2. 从 URL 确认 project。
3. 通过 Surface MCP 读取解析出的 work item ID。
4. 验证读取结果属于 URL 指定的 organization 和 project。
5. 向用户展示 ID、title、type、state 和 assigned owner，并要求确认目标。
6. 完成报告预览后，再通过单独问题调用要求 `Confirm write`。

URL 无法解析、work item 不存在、organization/project 不一致、用户未确认目标或最终未确认写入时都必须停止 Surface 写入，并按现有协议选择对应本地 fallback。URL 只用于本次交互和验证；本地 reminder 继续使用解析出的 `workItemReference`，避免不必要的合同扩展。

## F1 图片锚点

F2 row 已包含 `imageReference`，其 `artifact` 必须为 `f1`，`relativePath` 指向 F1 artifact 中对应 worksheet 的截面图。F3 request 和 result row 合同复用同一受约束结构，治理映射只透传该引用，不重写路径。

F3 Markdown renderer 根据 F2 artifact root、F3 output root 和 `relativePath` 计算相对链接。以下三列使用同一个 worksheet 对应的 F1 图片链接：

- `Device Level Dim`
- `Dimension Description`
- `Factor Description`

缺少合法 F1 image reference 时必须由现有 F2/F3 artifact 校验拒绝输入，不能生成无锚点链接，也不能查找其他图片替代。链接标签仍使用原有字段文本，并继续执行 Markdown escaping 与敏感信息清理。

## Source Evidence

F3 JSON 保留现有结构化 `source` 对象：`worksheetName`、`tableId`、`sourceRow` 和 `sourceCells`。Markdown 表头由 `Source Location` 改为 `Source Evidence`，每行按以下固定顺序渲染：

```text
Worksheet: TP_Gap_X; Table: factor-table-1; Row: 14; Fields: factorName=TP_Gap_X!E14, nominalValue=TP_Gap_X!F14
```

`sourceCells` 的字段名按字典序排序，保证输出确定性。没有 source cell 时仍显示 worksheet、table 和 row，并将 `Fields` 显示为 `none`。所有值沿用报告的 escaping 和敏感路径清理规则。

## 合同与兼容性

- F3 request row 和 result row 新增必需的 F1 `imageReference`。
- F3 loader 从 F2 ready row 透传 `imageReference`。
- F3 workflow 新增可选 worksheet 过滤参数；无参数调用保持当前全量 ready worksheet 行为。
- F3 report 的列数保持 11 列，只把最后一列表头和内容改得更明确。
- ADO 持久化结构不新增 URL 字段，现有 reminder 状态矩阵保持兼容。

## 错误处理

- worksheet 选择为空：停止执行并提示至少选择一个 ready worksheet。
- worksheet 不属于 ready 集合：拒绝输入，列出无效名称，不静默忽略。
- ADO URL 格式无效或缺少 ID：停止 existing flow，不调用 Surface 写入。
- URL 与 Surface 读取目标不一致：停止并提示重新输入 URL。
- F1 image reference 缺失、越界或 artifact 不是 `f1`：拒绝 F3 输入。
- Markdown 相对路径计算必须以解析后的 artifact/output root 为边界，禁止引入本地绝对路径。

## 测试与验收

实施遵循 TDD，每项行为先增加会因当前实现缺失而失败的测试，再做最小实现。

1. Skill contract 测试验证 worksheet 多选问题位于 F3 执行和 ADO 模式问题之前，并验证 existing 模式要求 ADO URL、自动解析 ID 和目标确认。
2. Artifact loader 测试验证 ready worksheet 子集过滤、空选择、未知名称、blocked worksheet 和无过滤参数兼容行为。
3. Contracts 与 workbook catalog 测试验证 `imageReference.artifact === "f1"`，以及 F2 到 F3 request/result 的无损透传。
4. Report 测试验证三列链接到同一个 F1 相对图片路径，不复制图片，并验证 Markdown escaping。
5. Report 测试验证 `Source Evidence` 的固定结构、字段排序和无 cells fallback。
6. Full-flow 测试验证最终 worksheet/factor 计数只包含用户选择范围，JSON 与 Markdown 一致。
7. 运行 F3 相关测试、repository verification 和 TypeScript build，确认无回归。

## 验收标准

- 使用 F3 skill 时，不完成 worksheet 多选就不能运行 F3。
- 选择 existing ADO work item 后，必须看到 ADO URL 输入；合法 URL 自动得到 ID，并在写入前展示已读取目标供确认。
- F3 报告三列均可点击并打开 F1 artifact 中对应 worksheet 的图片，链接目标不来自 F2/F3 复制文件。
- 最后一列名称为 `Source Evidence`，用户可以直接识别 worksheet、table、row 和字段对应单元格。
- 所有新增与现有 F3 自动化测试通过。