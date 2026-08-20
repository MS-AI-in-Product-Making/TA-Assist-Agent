# F6 最终公差分析报告模板接入设计

**日期：** 2026-08-20  
**状态：** 待用户审阅  
**模板：** `.github/report_template.md`，`TA-REPORT-V2.0`  
**替代范围：** 旧 F6 双报告输出中的 legacy report JSON/Markdown 及其判断链  
**保持不变：** F0-F5 artifact contracts、F4 数学内核、F5 证据分类、F6 Optimization v2 与可选输入治理

## 1. 背景

F6 当前同时发布 Optimization 与另一套报告模型。legacy JSON/Markdown 形成第二套报告模型，内容较长，并与用户确认的最终报告模板重复。最终报告需要回到原有工程报告框架，直接解释 F0-F5 已验证数据，不再通过 legacy report artifact 形成结论。

本设计将 `.github/report_template.md` 接入 F6 runner，生成一个完整、简洁、可追溯的最终 Markdown 报告。模板保持以下结构：

1. 文档控制
2. Workbook 决策总览
3. Worksheet 3.1-3.8
4. Appendix: Reference Traceability

模板不包含 `3.9` 优化场景。优化明细继续由 `Feature6-Optimization.json/.md` 独立承载。

## 2. 已批准决策

1. F6 最终完整报告文件名为 `Feature6-Report.md`。
2. 停止生成 legacy report JSON/Markdown。
3. F6 每次成功运行固定发布五个文件，不保留 legacy report 兼容副本。
4. 最终报告直接使用 runner 内已验证的 F2/F3/F4/F5 数据、F6 Optimization 结果及已确认 Analysis Context。
5. 最终报告不读取任何 legacy report artifact，也不使用 F6 `runStatus` 形成工程 disposition。
6. F4 继续作为 Mean、RSS、Worst Case、Cp/Cpk、Yield、DPM、贡献率和公式追溯的唯一数值真源。
7. 全量 factor 输入表保留在 Worksheet 正文；同一规格和关键计算结果只出现一次。
8. 缺少依据时使用 `N/A`、`NOT_PROVIDED`、`NOT_EVALUATED` 或 `INSUFFICIENT_EVIDENCE`，不得推测填充。
9. `Feature6-Optimization.json/.md` 继续发布，但最终报告不展开优化场景。
10. 报告只输出 Markdown，不新增最终报告 JSON contract。

## 3. 输出契约

成功运行的固定文件集合为：

```text
Feature6-Report.md
Feature6-Optimization.json
Feature6-Optimization.md
Feature6-Run-Summary.json
manifest.json
```

移除 legacy report JSON/Markdown。

`manifest.json` 的 artifacts 改为：

```json
{
  "optimizationJson": "Feature6-Optimization.json",
  "optimizationMarkdown": "Feature6-Optimization.md",
  "finalReportMarkdown": "Feature6-Report.md",
  "runSummary": "Feature6-Run-Summary.json"
}
```

`Feature6-Run-Summary.json` 记录三个内容工件的 SHA-256：

- `optimizationJsonSha256`
- `optimizationMarkdownSha256`
- `finalReportMarkdownSha256`

Run summary 同时记录最终报告的结构化判定摘要：

```json
{
  "reportSummary": {
    "workbookDisposition": "FAIL | INCOMPLETE | CONDITIONAL_PASS | PASS",
    "worksheetDispositions": [
      {
        "worksheetName": "<validated worksheet name>",
        "disposition": "FAIL | INCOMPLETE | CONDITIONAL_PASS | PASS"
      }
    ]
  }
}
```

`worksheetDispositions` 的顺序和名称必须与 F2 selected scope 完全一致，`workbookDisposition` 必须等于最严重 Worksheet disposition。该摘要由最终 report projection 与 Markdown 同时产生，runner 不得分别重复计算。

CLI 成功结果返回 `finalReportMdPath`，不再返回旧报告路径字段。

## 4. 数据流

```text
Validated F2 report
Validated F3 report
Validated F4 calculation
Validated F5 report
Confirmed Analysis Context (optional)
F6 Optimization result
            |
            v
renderF6FinalReport(...)
            |
            v
Feature6-Report.md
```

`loadF6ArtifactBundle()` 已读取并验证 F3/F4；返回值增加 `f3Report` 和 `f4Report`，供最终报告直接投影。该增强不改变 F6 optimization request contract。

最终 renderer 接口：

```js
renderF6FinalReport({
  f2Report,
  f3Report,
  f4Report,
  f5Report,
  f6Optimization,
  analysisContext,
  generatedAt,
}, {
  outputRoot,
  f1ArtifactRoot,
  publishRoot,
})
```

renderer 必须先 schema-validate 所有结构化输入，并复用既有 Markdown sanitizer、工程格式化和安全图片引用逻辑。

renderer 返回不可变 projection，而不是只返回字符串：

```js
{
  markdown,
  reportSummary: {
    workbookDisposition,
    worksheetDispositions,
  },
}
```

Markdown 与 run summary 必须消费同一个 `reportSummary`，避免判定逻辑分叉。

## 5. Feature 数据归属

| Feature | 最终报告使用内容 |
|---|---|
| F0 | public knowledge、internal capability、interpretation rule versions |
| F1 | workbook metadata、source cells/rows、tolerance path image identity |
| F2 | selected scope、system specification、ready/blocked、missing inputs |
| F3 | Drawing Number、DIM ID、governance status |
| F4 | Mean、RSS、Worst Case、Cp/Cpk、Yield、DPM、contribution、formula trace |
| F5 | FACT、RULE、SIGNAL、OPTION、assumption、image evaluation、clarification |
| F6 | Optimization artifact provenance；不在最终报告中重复 scenario 明细 |

`createF6ReportProjection()` 用于复用 F4 formula checks、statistical ranges、margins 与 consistency checks。renderer 不得自行实现第二套工程数学。

## 6. 报告结构

### 6.1 文档控制

输出 workbook identity、hash、selected/ready/blocked counts、生成时间、受控版本和 review 状态。没有确认 Analysis Context 时 Project 输出 `NOT_PROVIDED`；没有报告级 reviewer 时输出 `PENDING`。

### 6.2 Workbook 决策总览

每个 Worksheet 只输出 Tolerance Loop、最高优先级 finding 和 disposition。关键数值不在总览重复。

### 6.3 Worksheet

- `3.1`：结论、主要 finding、Top Contributor 和 required action；不重复详细计算数值。
- `3.2`：Target、LSL、USL、Target Cpk、Evaluation Level 及来源。
- `3.4`：F1 tolerance path image、F5 image evaluation 和 review 状态。
- `3.5`：全量 factor 输入、Drawing Number、DIM ID 与输入完整性。
- `3.6`：模型、相关性、方向、长期系数、公式与自检证据。
- `3.7`：统计范围、Worst Case、margin、Cp/Cpk、Yield、DPM、Mean 与 RSS。
- `3.8`：贡献率与累计贡献；不得自动提升为物理根因。

### 6.4 Appendix

`Appendix: Reference Traceability` 记录 F0-F6 artifact、source row/cell、image identity、formula ID、statement ID 和 clarification ID。正文不重复完整 provenance。

## 7. Disposition 规则

按以下优先级判定 Worksheet：

1. `FAIL`：F2 blocked、F4 无有效计算，或存在阻塞判定的数据缺口。
2. `INCOMPLETE`：受支持证据确认规格越界，或 predictive Cpk 未达到明确 Target Cpk。
3. `CONDITIONAL_PASS`：数值通过，但 F3 governance、F5 SIGNAL/假设或工程复核尚未关闭。
4. `PASS`：输入、治理、计算及工程要求均通过，且没有影响结论的开放缺口。

Workbook disposition 取最严重 Worksheet 状态：

```text
FAIL > INCOMPLETE > CONDITIONAL_PASS > PASS
```

这是本功能明确采用的业务语义：`FAIL` 表示输入或计算链被阻断；`INCOMPLETE` 表示已有受支持数值证据确认未达到工程要求。实现与测试不得替换为行业常见命名语义。

F6 optimization `runStatus` 只表示优化执行状态，不参与上述 disposition。

Existing F6 artifact 模式接受 F6 output directory 或其中的 `Feature6-Optimization.json`。它验证五文件集合、manifest、三个内容 hash、Optimization v2 schema 和 run summary `reportSummary`；随后才可呈现 hash 绑定的 `Feature6-Report.md`。它不解析 Markdown 反推 disposition。

## 8. 错误处理与安全边界

- F2-F5 identity、hash、containment 或 schema 校验失败时，不生成成功报告。
- final renderer 输入缺失、身份不一致或 Markdown 生成失败时，run 以 `report_failed` 终止，只发布 failed manifest。
- run summary 的 worksheet scope、disposition 或 workbook worst-status 关系无效时，Existing F6 artifact 模式 fail closed，不呈现 Markdown。
- blocked Worksheet 只输出 finding 和 traceability，不输出虚构的 F4 capability 数值。
- 图片链接必须使用已验证的 F1 image reference，并保持在受控 publish root 内。
- 所有 workbook 文本、factor 名称、finding 和 evidence 文本经过 Markdown sanitizer。
- renderer 不修改输入对象，不修改源 workbook，不执行网络调用。
- 四个成功内容工件在 manifest 之前原子写入；manifest 继续最后写入。

## 9. 实现边界

新增：

- `scripts/f6-final-report.mjs`
- `scripts/f6-final-report.test.mjs`

修改：

- `scripts/f6-artifact-loader.mjs`
- `scripts/run-f6-full-validation.mjs`
- `scripts/f6-output-layout.mjs`
- `scripts/f6-artifact-loader.test.mjs`
- `scripts/f6-full-flow.test.mjs`
- `scripts/f6-output-layout.test.mjs`
- `.github/skills/f6-analysis/SKILL.md`
- `scripts/f6-skill.test.mjs`
- 与 F6 固定输出文件集合直接相关的 README/governance 文档

不修改：

- F4 calculation kernel 与 calculation schemas
- F5 statement/evidence contracts
- F6 Optimization v2 schema 与 scenario calculation
- F3 ADO publishing protocol

旧 legacy-report builder、renderer、contracts 和测试如无其他调用者则删除；删除前必须通过引用搜索确认无保留入口。

## 10. 测试与验收

### 10.1 Renderer 测试

- 严格输出模板章节顺序，且不存在 `3.9`。
- LSL、USL、Cpk 和 RSS 的详细值各只有一个正文填值位置。
- 全量 factor rows 输出，F2/F3/F4 identities 对齐。
- blocked Worksheet 不输出 capability 表。
- F4 formula、margin 和 consistency checks 保持数值一致。
- F5 FACT/RULE/SIGNAL/OPTION 不发生证据升级。
- Top Contributor 不被表述为物理根因。
- 无 context/image/reviewer 时使用规定的缺失状态。
- workbook 文本和路径不能造成 Markdown injection 或路径泄露。

### 10.2 Runner 与集成测试

- 成功目录恰好包含五个文件。
- manifest 只列新 artifact keys。
- run summary hash 与三个实际内容工件一致。
- run summary `reportSummary` 与 renderer 返回值一致，worksheet scope 完整且 workbook worst-status 可复算。
- CLI 返回 `finalReportMdPath`。
- 不调用 composed builder/renderer，不生成 Composed 文件。
- 无 Optimization Targets 时仍生成完整最终报告，Optimization 保持 candidate-only。
- 输入 artifact 保持字节不变。
- 输出继续遵守 containment、identity 和 atomic publish 边界。

### 10.3 验收命令

实施计划应使用仓库现有 Vitest 命令，至少覆盖：

```text
scripts/f6-final-report.test.mjs
scripts/f6-artifact-loader.test.mjs
scripts/f6-output-layout.test.mjs
scripts/f6-full-flow.test.mjs
scripts/f6-skill.test.mjs
```

随后执行 F6 相关测试集合、TypeScript build/lint，以及当前 governed F6 output verification。若 repository-wide 既有失败与本改动无关，应单独记录，不得修改无关功能。

## 11. 文档迁移

所有将 F6 描述为旧输出集合、旧报告模型或要求呈现 legacy report JSON/Markdown 的当前文档必须同步更新。历史设计文档保持历史记录，不回写；当前 F6 skill、README、feature register、end-to-end flow 和验证脚本使用新的五文件契约。

Existing-artifact 文档同步改为从 output directory 或 `Feature6-Optimization.json` 进入，并使用 run summary 结构化判定摘要加最终 Markdown hash 完成验证。
