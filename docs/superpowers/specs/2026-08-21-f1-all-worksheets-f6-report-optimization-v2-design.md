# F1 全 Worksheet 提取与 F6 报告优化 V2 设计

**日期：** 2026-08-21  
**状态：** 待用户审阅  
**分支：** `user/xumax/feature6-report-optimization-v2`  
**基线：** `99c95c5`  
**影响范围：** F1 workbook extraction、F1/F2 contracts、F6 Optimization v2、F6 最终报告、F6 skill governance

## 1. 背景

当前 F1 只为选中的 TA analysis worksheets 生成完整 JSON、Markdown 和图片产物。Title Page 的 Revision 已被 workbook catalog 读取，但没有通过 F1/F2 artifact contract 传递到 F6，因此最终报告只能显示 `N/A`。非 TA worksheets 也没有形成完整、统一的 F1 输出。

当前 F6 最终报告包含不需要的文档控制字段、难以理解的治理措辞、跳号章节和冗长的方法章节。Optimization 在没有 caller-authorized targets 时只能输出 candidate，不允许生成量化 scenario。新需求要求：当任一侧预测 Cpk 低于 worksheet Target Cpk 时，按固定三套 Top-3 公差缩减规则自动重算并在最终报告中比较。

本设计通过扩展受治理数据链完成需求，不在 Markdown renderer 中临时补值或重复实现工程数学。

## 2. 已批准决策

1. 从当前 F6 报告基线创建独立分支 `user/xumax/feature6-report-optimization-v2`。
2. F1 对 workbook 中全部 worksheets 输出完整 JSON、Markdown 和图片，不只处理 TA analysis pages。
3. 非 TA worksheets 只属于 F1 workbook extraction，不得进入 F2-F6 TA validation、governance 或 calculation scope。
4. F1 workbook metadata 中的 Title Page Revision 通过受控 contracts 传递到 F2 和 F6。
5. 三套固定 Tol 缩减方案成为 F6 内建、版本化、确定性的受控规则，不要求外部 Optimization Targets 授权。
6. 内建规则只在 `CpkL < worksheet.targetCpk` 或 `CpkU < worksheet.targetCpk` 时触发；不使用固定 `1.33` 替代 worksheet target。
7. 所有 scenario 必须复用 F4 calculation engine；F6 renderer 不得自行计算 capability。
8. Worksheet 章节删除模型假设后连续编号，最终为 3.1 至 3.7。
9. 通过阈值的 worksheet 不输出 Optimize 章节。

## 3. F1 全 Workbook 提取

### 3.1 Workbook Worksheet Inventory

F1 report 新增 workbook-level worksheet inventory，按 Excel workbook 原始顺序记录全部 worksheets：

- `worksheetName`
- `worksheetIndex`
- `visibility`
- `worksheetKind`
- `isTaAnalysis`
- `isSelectedForTaAnalysis`
- sheet relationship/source part identity
- JSON、Markdown 和 image output references

`worksheetKind` 至少区分：

- `title_page`
- `summary`
- `analysis`
- `example_or_template`
- `other`

分类只决定展示和 downstream eligibility，不决定是否提取。

### 3.2 全 Sheet 内容产物

每个 worksheet 均生成：

```text
sheets/<workbook-slug>/json/<sheet-slug>.sheet.full.json
sheets/<workbook-slug>/md/<sheet-slug>.sheet.md
sheets/<workbook-slug>/images/<sheet-slug>__<content-id>.<ext>
```

完整 JSON 保留现有 F1 安全边界下可提取的：

- used cells 与 actual/display values
- formulas
- merged regions
- hyperlinks
- drawing/image relationships
- row/column coordinates
- worksheet identity

Markdown 提供可读表格及图片链接。没有图片的 worksheet 仍生成 JSON 和 Markdown，并记录空 image list；不得伪造图片。

### 3.3 TA Downstream 隔离

`selectedWorksheetNames`、F2 worksheet list、F4 handoff 和 downstream F3-F6 scope 仍只接受经 selection prompt 确认的 TA analysis worksheets。

以下内容不得因为全 sheet extraction 而进入 F2-F6：

- Title Page
- Auto Summary
- Example/template sheet
- 任意非 TA sheet

F1 inventory 与 TA selected scope 使用不同字段和 schema，不复用一个数组表达两种语义。

### 3.4 Revision 数据链

Revision 的唯一来源为 F1 workbook catalog 已解析的 Title Page metadata：

```text
Title Page revision cell
  -> F1 workbook.metadata.revision
  -> F1 report workbook metadata
  -> F2 report workbook.revision
  -> F6 final report Workbook Revision
```

Revision 缺失时输出 `N/A`，不得从文件名、worksheet 名或 free-form text 推断。

## 4. Contract 与兼容策略

### 4.1 F1/F2 Contracts

新增或扩展严格 schema：

- F1 workbook metadata：增加完整 `worksheetInventory`。
- F1 report：同时保留 all-sheet inventory 与 selected TA analyses。
- F2 workbook identity：增加可选/nullable `revision`，值必须与 F1 metadata 精确一致。

旧 artifact 若没有 inventory/revision，只能由历史只读兼容路径读取；当前 workbook run 必须生成新字段。不得在 loader 中静默构造假 inventory。

### 4.2 F6 Optimization Policy

新增版本化 policy identifier，例如：

```text
f6-top3-tolerance-policy-v1
```

内建 policy 与 caller-authorized targets 是两条不同来源：

- 内建 policy：仅由 capability under-target gate 触发。
- Caller targets：继续遵守现有 W8B 确认与 provenance 规则。

同一 worksheet 同时存在 caller targets 时，caller targets 不被内建 policy 覆盖。实现计划必须明确两类 option 的并存顺序和稳定 ID，禁止同 ID 冲突。

### 4.3 F6 Skill Governance

更新 F6 skill：

- 保留“不得发明任意默认百分比场景”。
- 新增唯一例外：版本化 `f6-top3-tolerance-policy-v1` 可在 under-target gate 下自动生成三套固定 scenario。
- 该例外不授权任何其他自动比例、factor 选择或 spec 改动。
- 每个 scenario 必须记录 policy ID、baseline identity、top-3 factor identities、缩减比例、F4 calculation reference 和公式 trace。

## 5. 内建 Optimize 规则

### 5.1 触发条件

对每个 F4 completed calculation：

$$
trigger = Cpk_L < Cpk_{target} \lor Cpk_U < Cpk_{target}
$$

其中 `Cpk_target` 必须来自该 worksheet 的受控 `targetCpk`。任一必要值缺失或非有限数时，不生成量化 scenario，输出受控 clarification。

通过条件为两侧都满足：

$$
Cpk_L \ge Cpk_{target} \land Cpk_U \ge Cpk_{target}
$$

通过时 Optimization artifact 不生成内建 option，最终报告不输出 3.7 Optimize。

### 5.2 Top-3 固定选择

按 baseline variance contribution 降序选择前三个 factor。排序 tie-breaker 固定为 source row，再以 factor identity 作稳定比较。Top-3 在三个 option 间冻结，scenario 后不得重新选择。

若有效 factor 少于三个，使用全部有效 factor，并记录实际 factor count；不得虚构第三个 factor。

### 5.3 三套公差缩减

| Option | Top 1 reduction | Top 2 reduction | Top 3 reduction |
|---|---:|---:|---:|
| OP1 | 25% | 10% | 10% |
| OP2 | 20% | 15% | 15% |
| OP3 | 40% | 5% | 5% |

对每个 factor 保持原 tolerance band center：

$$
c=\frac{U+L}{2},\qquad h=\frac{U-L}{2}
$$

若 reduction 为 $r$：

$$
U_{new}=c+h(1-r),\qquad L_{new}=c-h(1-r)
$$

该规则同时适用于对称和非对称 tolerance，不改变 band center、nominal、mean、distribution、sigma level、spec limits 或 additional mean shift。

### 5.4 重算与状态

每个 option 调用现有 `calculateF6Scenario` / F4 `createCalculation`。结果至少包含：

- Mean
- RSS Sigma
- CpkL
- CpkU
- Cpk
- 4σ lower/upper range
- Worst-Case lower/upper range
- capability PASS/FAIL
- delta versus baseline

单个 option 重算失败时仅该 option 为 `calculation_failed`；其他 option 继续。Baseline identity mismatch 时整个 worksheet fail closed。

Top contributor 只表示模型方差贡献，不得表述为物理根因、供应商责任或已确认改善可制造性。

## 6. F6 最终报告结构

### 6.1 Document Control

保留：

- Source Workbook
- Workbook Revision
- Selected Worksheet Count
- Ready / Blocked Worksheet Count
- Report Generated At
- Reviewed By

删除：

- Project
- Workbook Hash
- Controlled Versions

`Report Generated At` 格式固定为：

```text
yyyy-MM-dd HH:mm:ss
```

例如：`2026-08-20 11:25:45`。时间来源仍是受控 run timestamp，只改变展示格式。

### 6.2 Workbook 决策总览

表格保留 Worksheet、Tolerance Loop Description、Key Finding、Disposition。Key Finding 使用直接、通俗的动作或结果语言：

- `PASS`：`数值、输入和工程复核均已通过。`
- `CONDITIONAL_PASS`：`数值达到要求，但仍需补齐 Drawing Number / DIM ID 或完成图像与工程复核。`
- `INCOMPLETE`：`计算已完成，但 CpkL/CpkU 或规格范围未达到 worksheet 要求。`
- `FAIL`：`缺少必填输入、图片或有效计算，当前 worksheet 无法完成分析。`

表格后增加四态说明：

- `PASS`：计算满足要求，且没有影响发布的开放问题。
- `CONDITIONAL_PASS`：计算满足要求，但标识、图像或工程复核尚未完成。
- `INCOMPLETE`：计算链有效，但数值结果未达到明确工程要求。
- `FAIL`：输入、身份、图片或计算链被阻断，无法形成完整分析。

### 6.3 Worksheet 章节

连续编号如下：

1. `3.1 执行摘要`
2. `3.2 分析目标与要求`
3. `3.3 Tolerance Path Image`
4. `3.4 输入数据`
5. `3.5 结果与规格符合性`
6. `3.6 贡献与敏感度`
7. `3.7 Optimize`，仅 under-target worksheet 输出

#### 3.1 执行摘要

- `Characteristic` 改为 `Tolerance Loop Description`。
- 删除 `Primary Finding` 行。
- 保留 Final Disposition、Top Contributor、Required Action。
- 一句话结论改为直接说明：是否达到数值要求、还缺什么、下一步做什么。

示例：

```text
预测 CpkL 为 1.21，低于目标 1.33；优先评估 battery flatness、Deflection at 150g load 和 battery bracket spot welding 的公差收紧方案，并补齐 Drawing Number 与 DIM ID。
```

#### 3.2 分析目标与要求

- `Target` 改为 `Design Nominal`。
- 值来自 F4 `system.designNominal`。
- 保留 LSL、USL、Target Cpk、Evaluation Level 及 provenance。

#### 3.3 Tolerance Path Image

只输出一个可点击图片链接：

```markdown
[Open tolerance path image](<validated-relative-image-path>)
```

不输出 artifact、worksheet、SHA、Image Evaluation、Engineering Review 或 Image Evidence 文本。链接目标仍必须是已验证的 F1 image reference。

#### 3.4 输入数据

- `Physical Nominal` 改为 `Design Nominal`。
- `Physical Mean` 改为 `Mean`。
- 删除输入完整性中的 `F3 Governance` 行。
- Drawing Number、DIM ID 缺失统计仍保留。

#### 3.5 结果与规格符合性

沿用 F4/F6 projection 的现有结果，不重复计算。保留 statistical range、worst-case range、margin、Cp/Cpk、Yield、DPM、Mean 和 RSS。

#### 3.6 贡献与敏感度

保留 contribution 排名、1σ、累计贡献和“贡献率不等于物理根因”声明。

#### 3.7 Optimize

仅 under-target worksheet 输出：

1. Top-3 factor 与各 option reduction 表。
2. Baseline / OP1 / OP2 / OP3 对比表。
3. 每个 option 的 capability status 和相对 baseline delta。
4. 明确说明该结果是设计公差模型重算，不等于供应商实测能力。

通过 worksheet 完全省略该章节，不输出空表或“不需要优化”占位。

### 6.4 删除章节

删除原 `模型假设与计算方法` 整章。公式与 provenance 继续保留在 F4/F6 JSON、run summary 和 appendix，不在 worksheet 正文重复。

## 7. Disposition 与报告文案

Disposition 数学规则保持现有四态语义，不因文案优化而改变：

```text
FAIL > INCOMPLETE > CONDITIONAL_PASS > PASS
```

- `FAIL`：F2 blocked、身份/图片/必填输入阻断、无有效计算。
- `INCOMPLETE`：有有效计算，但 CpkL/CpkU、统计范围或明确工程要求未通过。
- `CONDITIONAL_PASS`：数值通过，但标识治理、图像确认或工程复核仍开放。
- `PASS`：数值、输入、治理和工程复核全部关闭。

最终报告不得再使用未解释的“治理或工程复核尚未关闭”。所有开放项必须点名，例如 Drawing Number、DIM ID、方向确认或图像复核。

## 8. 错误处理与安全边界

- 全 sheet extraction 继续遵守 OOXML archive、XML node、shared string、cell count 和 path containment limits。
- 单个非 TA sheet 提取失败时，当前 F1 run 必须按 artifact contract 记录失败；不得静默省略该 sheet。
- 非 TA sheet 不得影响 TA selected scope，但 F1 inventory 必须完整反映其提取状态。
- Revision source identity 不匹配时停止传递，不用历史值补位。
- 内建 optimization policy 不改变源 workbook、baseline artifacts 或 spec limits。
- Scenario 数学失败不得由 renderer 估算或补算。
- 图片链接必须保持在受控 F1 root 内，且使用 hash 已验证的 reference。
- Markdown 内容继续做 escaping，防止 workbook 文本注入表格或链接。
- F6 五文件原子发布、manifest-last、hash-bound presentation 保持不变。

## 9. 实现表面

预期修改：

- `packages/workbook-catalog/src/workbook-catalog.ts`
- `packages/workbook-catalog/src/worksheet-analysis-assets.ts`
- `packages/workbook-catalog/src/worksheet-selection.ts`
- `packages/contracts/src/contracts.ts`
- `scripts/run-f1-full-validation.mjs`
- `scripts/f2-excel-runner.mjs`
- `scripts/run-f2-full-validation.mjs`
- `scripts/f6-artifact-loader.mjs`
- `packages/workbook-catalog/src/f6-optimization.ts`
- `packages/workbook-catalog/src/f6-scenario-adapter.ts`
- `scripts/f6-report.mjs`
- `scripts/f6-final-report.mjs`
- `scripts/run-f6-full-validation.mjs`
- `.github/skills/f6-analysis/SKILL.md`
- 直接相关 contracts、feature register 和 current workflow 文档

对应测试：

- `packages/workbook-catalog/src/workbook-catalog.test.ts`
- `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`
- `packages/workbook-catalog/src/worksheet-selection.test.ts`
- `packages/contracts/src/contracts.test.ts`
- `scripts/f2-excel-runner.test.mjs`
- `scripts/f2-full-flow.test.mjs`
- `packages/workbook-catalog/src/f6-optimization.test.ts`
- `packages/workbook-catalog/src/f6-scenario-adapter.test.ts`
- `scripts/f6-report.test.mjs`
- `scripts/f6-final-report.test.mjs`
- `scripts/f6-artifact-loader.test.mjs`
- `scripts/f6-full-flow.test.mjs`
- `scripts/f6-skill.test.mjs`
- `scripts/verify-current-f6.test.mjs`

## 10. TDD 与验收

实施必须按 RED-GREEN-REFACTOR 分批进行：

1. F1 all-sheet inventory 与非 TA full outputs。
2. Revision F1→F2→F6 contract propagation。
3. F6 under-target gate 与固定 Top-3 policy。
4. OP1/OP2/OP3 tolerance overrides 和 F4 recalculation。
5. Optimization JSON/Markdown、run summary、manifest provenance。
6. Final report document control、通俗文案和连续章节。
7. Existing-artifact validation 与 skill governance。

每批先新增一个能因缺失行为而失败的 focused test，确认 RED 后才改 production code。

最终验收至少包括：

```text
npm run build -- --force
F1/workbook-catalog focused tests
contracts focused tests
F2 focused tests
F6 optimization/scenario focused tests
F6 final report/full-flow/skill focused tests
npm test
node scripts/verify-current-f6.mjs
```

验收 fixture 必须证明：

- Title Page、Auto Summary、TA 与 template sheet 均有 F1 JSON/Markdown/image outputs（无图 sheet 合法记录空 images）。
- 非 TA sheets 不进入 F2-F6 scope。
- Title Page Revision 在最终报告中正确显示。
- Document Control 指定三行已删除，时间格式正确。
- Worksheet 章节连续，删除方法章节和 Primary Finding。
- 只有 under-target worksheet 出现 Optimize。
- 三套 option 使用冻结的 Top-3、正确 reduction、保持 band center，并由 F4 重算。
- 通过 worksheet 不生成内建 scenario。
- F6 artifact hashes、reportSummary、blocked placement 和五文件集合继续通过 governed verifier。

## 11. 非目标

- 不修改源 Excel。
- 不把非 TA sheet 送入 TA calculation。
- 不从 worksheet 名或图片猜测 Revision、direction、datum 或 factor mapping。
- 不改变 F3 ADO publishing protocol。
- 不计算成本或 ROI。
- 不自动选择除固定 Top-3 policy 外的其他优化比例。
- 不把预测 Cpk/Yield/DPM 表述为实测量产能力。