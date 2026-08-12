# F5 Workbook 完整端到端编排设计

**日期：** 2026-08-12  
**状态：** 已批准  
**范围：** F3/F5 skills、skill 契约测试、workbook 流程文档

## 背景

用户以 TA workbook 路径调用 F5 时，系统必须保留 F0/F1/F2/F3/F4 已建立的治理机制，并按阶段完成 F5 数据解释。当前 F5 skill 在 W1 直接执行：

```text
npm run workflow:f1 -- <ta-workbook-path>
```

但 F1 runner 已要求显式 worksheet confirmation。单 workbook 的完整 F1 合同实际包含两个阶段：

1. `--selection-only` 生成 `Feature1-Selection.json`。
2. 用户确认 workbook hash 和 worksheet 集合后，以 `--workbook-hash`、`--worksheets`、`--confirm` 执行完整 F1。

因此裸 F1 调用会稳定失败并报告 `Feature 1 worksheet confirmation is required.`。这不是 workbook 数据问题，也不应通过放宽 F1 confirmation gate 解决。根因是 F3/F5 skill 的上游编排合同落后于 F1/F2 已实现的交互合同。

## 目标

- F5 workbook 模式必须按受控顺序完成 F0/F1/F2/F3/F4/F5 机制。
- 需要用户决策时必须停下来提问，不得静默全选或跳过确认。
- F1/F2 范围与 F3/F4/F5 范围分别确认，表达不同治理边界。
- 任一阶段失败时 fail closed，不得自动使用历史或部分工件继续。
- F0 保持受控内部 API，不新增不存在的 `workflow:f0`。
- 最终结果说明实际使用的 F0 知识库版本。

## 非目标

- 不修改 F0 knowledge-base API 或新增 F0 CLI。
- 不放宽 F1 worksheet confirmation validator。
- 不修改 F2/F3/F4/F5 核心计算、artifact schema 或业务结论。
- 不增加 F3 ADO 发布行为。
- 不执行 F6 计算或建议。
- 不设计跨请求自动恢复或历史工件复用。

## 方案选择

采用现有 `workflow:f2:excel` 的两阶段握手作为 F5 workbook 模式的上游入口。

该 runner 已实现：

- selection-only F1 执行；
- `Feature1-Selection.json` schema 校验；
- workbook hash 与 worksheet confirmation；
- confirmed F1 和 F2 顺序执行；
- 独立 run root、manifest、validation logs 和受控 F1/F2 roots。

不选择以下方案：

- 让裸 F1 CLI 直接负责 VS Code 交互：会混淆 runner 与 agent 的职责，并破坏非交互执行。
- 新增完整 `workflow:f5:excel` orchestrator：需要重新实现多个交互停点和 artifact 校验，当前范围过大且重复已有能力。

## 端到端流程

### E0：输入与 F0 能力校验

1. 解析 workbook canonical path。
2. 要求输入存在、为单个 `.xlsx` 文件、位于允许范围内且不是 linked-out 路径。
3. 保持源 workbook 只读。
4. 确认仓库声明的 F0 能力可用：public knowledge base `v1`、internal tolerance guidance `internal-v1`、interpretation rules `interpretation-rules-v1`。
5. 不运行或发明 `workflow:f0`。F0 由 F2 和 F5 的受控 API 在其阶段内部消费。

### E1：生成 F1 worksheet selection

调用 `workflow:f2:excel` 的 selection-only 入口，只生成该 run 的 F1 selection prompt。读取并严格校验：

- `Feature1-Selection.json`；
- workbook file identity；
- workbook content hash；
- 可选 worksheet 名称集合；
- output root 与 manifest containment。

此阶段不得生成完整 F1/F2 分析，也不得启动 F3/F4/F5。

### E2：第一次用户确认

使用 `vscode_askQuestions` 和 `multiSelect: true` 展示 F1 prompt 中的 worksheet options。此次选择定义 F1/F2 的分析范围。

- 至少选择一个 worksheet。
- 取消、跳过或空选时受控停止。
- 返回名称必须精确属于 prompt options，且去重后保持同一集合。
- 不得默认全选或根据 worksheet 名称推断用户意图。

### E3：执行 confirmed F1 和 F2

使用同一 selection prompt 的 workbook content hash 和第一次选择结果，再次调用 `workflow:f2:excel` confirmed 入口。runner 必须按顺序完成：

1. confirmed F1；
2. F1 artifact validation；
3. F2；
4. F2 report validation。

记录本次 run 的受控 `f1Root`、`f2Root`、manifest 和 workbook content hash。任何命令、schema、identity、hash 或 containment 失败都立即停止。

### E4：第二次用户确认

从已验证 F2 report 中筛选 `status: readyForNextFeature` 的 worksheets，并逐项验证其 F1 `imageReference`、物理图片、worksheet identity、controlled path 和 SHA-256 hash。

仅将通过全部检查的 worksheets 提供给用户。使用 `vscode_askQuestions` 和 `multiSelect: true` 获取 F3/F4/F5 范围。

- 此次选择只能是第一次选择的子集。
- 至少选择一个 worksheet。
- blocked、malformed、缺少受控图片的 worksheet 不得展示。
- 取消、跳过或空选时在 F3 前受控停止。

### E5：执行本地 F3

对第二次选择的精确 worksheet 集合运行一次 F3，使用 repeated `--worksheet` 参数。验证 F3 接受集合与选择集合完全一致，并验证 workbook、F2 row、F1 image 和 hash identities。

F3 只执行本地 drawing governance：

- 不提示 ADO target；
- 不发布 ADO Work Item；
- 不写 ADO reminder；
- 不调用任何 ADO 工具或网络流程。

### E6：执行 F4

从本次 run 的已验证 `Feature2-Report.json` 运行 F4。F4 runner 可以计算全部 F2-ready worksheets，因为其 CLI 没有 worksheet filter。

验证 F4 至少包含第二次选择的每个 worksheet，且每项 workbook/table identities 和 calculation result 均有效。未被第二次选择的额外 F4 结果不进入 F5 展示范围。

### E7：图片评估询问

在 deterministic F5 前单独询问用户是否评估 drawing image evidence。

- 选择跳过：继续 F5，并将 drawing evidence 标记为 `not_evaluated`，附明确 clarification。
- 选择评估：只查看 F1 `imageReference` 指向且 hash 已验证的真实图片。
- 图片观察 artifact 必须遵循现有不可覆盖、UUID、containment、schema 和 readback 规则。
- 图片观察失败不伪装成图片缺失；在 required F1 image provenance 已验证的前提下，继续 deterministic F5 并标记 `not_evaluated`。

### E8：执行并展示 F5

使用本次 run 的 `f1Root`、`f3Root`、`f4Root` 和第二次选择的精确 worksheet 集合运行 F5。仅在图片观察 artifact 创建并验证成功时传入该 artifact。

严格校验 `Feature5-Report.json`、manifest、run summary、source identities、worksheet set、hashes 和 classifications。最终展示：

- workbook identity 和分析 worksheet 范围；
- F0 public/internal versions：`v1`、`internal-v1`；
- F5 interpretation rules version：`interpretation-rules-v1`；
- FACT、RULE、SIGNAL、OPTION；
- assumptions 和 clarifications；
- 图片证据是否 evaluated；
- F6 delegated sections，不生成 F6 结论。

## 状态与停止语义

每次 workbook 请求使用独立 run root。阶段只允许单向前进：

```text
input_validated
  -> f1_selection_ready
  -> f1_selection_confirmed
  -> f1_f2_validated
  -> downstream_selection_confirmed
  -> f3_validated
  -> f4_validated
  -> image_decision_recorded
  -> f5_validated
  -> presented
```

用户取消问题时为受控停止，不声明分析失败或完成。命令失败、schema 无效、路径越界、identity/hash 不一致或 required image provenance 缺失时为 fail-closed failure。

失败后不得：

- 跳过当前阶段；
- 自动改用历史 artifact；
- 静默切换到 existing F5 artifact mode；
- 使用部分输出或同名目录继续；
- 扩大用户已确认的 worksheet 范围。

## 修改范围

### Skills

- `.github/skills/f5-analysis/SKILL.md`
  - 用 `workflow:f2:excel` 两阶段握手替换裸 F1/F2 编排。
  - 在 F1 前增加第一次 worksheet selection。
  - 保留 F2 后的 F5-ready selection。
  - 明确 F0 内部校验与最终版本披露。
- `.github/skills/f3-analysis/SKILL.md`
  - 同步修复 workbook entry，避免 F3 独立调用时复现同一缺陷。

### Tests

- `scripts/f5-skill.test.mjs`
- `scripts/f3-skill.test.mjs`
- 必要时增加一项跨合同静态测试，验证 skill 命令形状与 runner 必需参数一致。

### Documentation

- `README.md`
- `docs/README.md`

文档中的单 workbook 示例不得再把裸 `workflow:f1 -- <path>` 描述为完整执行路径。

## 测试策略

遵循 test-first：先写会因当前 skill 合同而失败的测试，再修改 skill 和文档。

### 契约测试

1. F5/F3 workbook mode 必须包含 `workflow:f2:excel` selection-only 和 confirmed 两种调用形状。
2. confirmed 调用必须携带 workbook hash、worksheet 集合和 confirm。
3. 第一次 worksheet confirmation 必须发生在完整 F1/F2 前。
4. 第二次 worksheet confirmation 必须发生在 F2 validation 后、F3/F4/F5 前。
5. 两次选择均要求非空，取消或空选均停止。
6. F3 和 F5 使用完全相同的第二次选择集合。
7. F4 不得增加不存在的 worksheet flag。
8. skill 不得声明或调用 `workflow:f0`。
9. 最终展示必须披露 F2/F5 工件中的 F0 版本。

### 文档一致性测试

README 和 docs 不得把单 workbook 裸 F1 命令描述为可完成 F1/F2 的路径；示例必须体现 selection prompt、用户确认和 confirmed execution。

### 回归测试

- F2 Excel runner 的 selection-required 和 confirmed execution 测试保持通过。
- F3/F5 skill tests 通过。
- 相关 CLI argument、artifact loader、full-flow tests 通过。
- repository verification 通过。

## 验收场景

对 `Mauna_Loa_TP_Step_20260611.xlsx` 发起 F5 workbook 分析：

1. 系统成功生成 F1 worksheet prompt，不再抛出 confirmation-required 错误。
2. 系统停下来请求第一次 worksheet 选择。
3. 用户确认后，系统完成并验证同一 run 的 F1 和 F2。
4. 系统只展示 F5-ready worksheets，并停下来请求第二次选择。
5. 用户确认后，系统按顺序完成本地 F3、F4、图片评估询问和 F5。
6. 最终报告的 worksheet 集合等于第二次选择集合。
7. 最终结果披露 `v1`、`internal-v1` 和 `interpretation-rules-v1`，并保持 FACT/RULE/SIGNAL/OPTION 分类边界。
8. 任一阶段失败时流程停在该阶段，且不使用旧工件继续。

## 风险与控制

- **风险：两次 worksheet 选择造成含义混淆。** 控制：问题标题和说明分别标注“F1/F2 分析范围”和“F3/F4/F5 ready 范围”。
- **风险：selection-only 与 confirmed 执行之间 workbook 被替换。** 控制：confirmation 必须携带 prompt hash，F1 validator 再次计算并比对。
- **风险：F4 产生额外 ready worksheet 结果。** 控制：F5 repeated `--worksheet` 精确过滤至第二次选择集合。
- **风险：用户误以为未运行独立 F0 CLI 等于跳过 F0。** 控制：最终展示 F2/F5 工件记录的知识库版本，并说明 F0 由受控 API 内部消费。
- **风险：失败后误用同名历史目录。** 控制：独立 run root、manifest linkage、containment 和 hash validation；禁止自动恢复。