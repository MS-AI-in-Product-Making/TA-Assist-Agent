# F3/F5/F6 工程报告可读性优化验收

## 1. 验收范围

- 分支：`user/xumax/F3-F5-F6-report-readability-optimization`
- 输入工作簿：`Maera_cosmetic_critical_TA - Rev E_0110 - test.xlsx`
- 工作簿 SHA-256：`8805a128b6163b80afda55b3747dfeae58abeb100f40d9bb91ab6ec14d0a3742`
- 下游 worksheets：`Keycap_step`、`Keycap_E_gap_X`、`Keycap_F_gap_Y`、`HDMI_tongue_to_Bucket_Slot_Y`、`AJ_GAP`
- Analysis Context：`NOT_PROVIDED`
- Optimization Targets：`NOT_PROVIDED`
- ADO：验收 run 不执行外部写入。

## 2. 自动化测试

最终命令：

```powershell
npm test
```

结果：

- Test Files：`102 passed / 102`
- Tests：`2274 passed`
- Skipped：`4`（环境相关既有 skip）
- Failed：`0`
- 基线测试：`2252 passed`；本分支新增并保持 `22` 个回归测试。

## 3. 新 immutable workflow run

- F1/F2 run：`test/demo-output/f2-runs/Maera_cosmetic_critical_TA---Rev-E_0110---test/2026-08-19T04-14-00-290Z`
- F3 output：`test/demo-output/feature3-output/f2`
- F4 run：`test/demo-output/f4-runs/f2/2026-08-19T04-16-28-249Z`
- F5 run：`test/demo-output/f5-runs/2026-08-19T04-16-28-249Z/2026-08-19T04-17-00-373Z`
- F6 run：`test/demo-output/f6-runs/2026-08-19T04-17-00-373Z/2026-08-19T04-17-10-070Z`

这些运行目录为 git-ignored 验收产物，不进入功能提交，也未修改历史 demo-output。

## 4. F4 数值兼容比较

改造前与改造后 artifacts 的来源 SHA、比较方法和逐 worksheet 数值已固化在仓库内证据：

- `docs/governance/evidence/f3-f5-f6-report-readability-f4-baseline.json`

该证据记录旧 artifact SHA-256 `03f124af3e8f95cdef8903344b28c70bf617a1b3d5786756eb21f80ffefa70c6`、新 artifact SHA-256 `978b339db276065721f370476759a0f431a247351d1c4d4c6f63afba8c958e1d`，以及以下逐 worksheet 精确比较字段：

- factor `tableId/sourceRow/factorName`；
- factor mean、sigma、contribution；
- system mean、RSS sigma、Worst Case lower/upper；
- LSL、USL、Target sigma、Target Cpk；
- Cp、Cpk、yield、total DPM。

| Worksheet | Baseline Equal | Cpk | RSS 1σ |
| --- | --- | ---: | ---: |
| Keycap_step | yes | 1.2469593727770993 | 0.08019507466172719 |
| Keycap_E_gap_X | yes | 1.1358320728264875 | 0.07336765295414595 |
| Keycap_F_gap_Y | yes | 1.1526881339056756 | 0.07229477851131436 |
| HDMI_tongue_to_Bucket_Slot_Y | yes | 1.402810966662209 | 0.05227599090404696 |
| AJ_GAP | yes | 0.7017714930685405 | 0.023749421045574988 |

结论：报告优化没有改变既有计算流程或数值结果。

## 5. F6 报告验收

`Feature6-Report.md` 已验证包含：

- `Target 4σ statistical range`，不再把 1σ 误标为目标范围；
- `Formula：Mean ± 4 × RSS 1σ` 和对应 `Substitution` 数值代入；
- LSL、USL、Target Cpk、CpkL/CpkU/Cpk 公式；
- Target 4σ Margin 与 Worst-case Margin 分离；
- `F4 基线复算与数值一致性检查`；
- `1e-12 mm` 科学计数阈值，不再显示为 `0.000 mm`；
- 分析特性与结构化工程定义分离；
- F3 Drawing Number / DIM ID 缺失计数；
- F1 tolerance-path image、F5 visual FACT/context SIGNAL、ME review；
- 无受治理 mapping 时明确不能生成 signed equation；
- candidate factors、`target_not_provided` 原因和 required inputs；
- 去重后的工程行动表；
- F0 internal-v1 guidance 仅作为受审计事实，不改变风险或决策。

## 6. F3 ADO payload 验收

新 `Feature3-ADO-History.html`：

- `<th>`：`11`
- `data-f3-factor-row="true"`：`28`
- `data-f3-group-row="true"`：等于全部 factor rows 中规范化后唯一 `Part / Subsystem` 的数量
- 分组层级：跨 Worksheet 的全局 Part / Subsystem；同名 subsystem 合并为一个分组
- Worksheet 身份继续保留在固定 11 列数据和受控 source provenance 中，不生成 Worksheet 分组行
- factor rows 与原报告数量相同；group rows 不计入 factor count。
- 单次 payload、canonical full-body/hash、`top: 200`、单次写入/回读协议保持不变。

## 7. F5 报告验收

`Feature5-Report.md` 已验证：

- `工程审查摘要` 位于 `审计附录` 之前；
- workbook worksheet summary 与 compact cards 可快速阅读；
- 图片 evidence 链接保持可点击且受 containment 检查；
- summary 不展开完整 `sourceCells`/`sourceFileHash`；
- 五个既有章节及完整 FACT/RULE/SIGNAL/OPTION、snapshot、clarification、assumption、provenance 均保留在审计附录；
- F5 owned 与 delegated-to-F6 边界明确。

## 8. F0 能力边界

本分支只投影 F2 已验证的 `internal-v1` process guidance DTO，不在 F6 重新查询 F0，也不从 factor 名称推断材料、结构或装配风险。

当前未新增：

- `material-risk-v1`；
- `structure-risk-v1`；
- `process-risk-v1`；
- `assembly-risk-v1`。

因此缺少受控规则时继续输出 `INSUFFICIENT_EVIDENCE`，不产生确定性材料/结构/装配风险结论。

## 9. 最终结论

- 既有 workflow 命令与门禁：未改变。
- F4 baseline calculation：未改变。
- F3 ADO：分组增强，写入/回读治理不变。
- F5 JSON/schema：未改变；Markdown 可读性增强。
- F6：当前契约原子发布 `Feature6-Report.md`、`Feature6-Optimization.json/.md`、`Feature6-Run-Summary.json` 和 `manifest.json`；结构化 Workbook/Worksheet dispositions 由 Run Summary 保存。
- 自动化和真实工作簿验收：通过。