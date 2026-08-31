# F8 Web Projection Optimization 设计规格

## 1. 背景与定位

F0-F6 已具备生产能力，F7 正在开发。F8 不重新实现分析流程，只负责将同一受管 Session 中 F0-F7 的状态、证据、结果与允许的操作投影到 Web。GitHub Chat、VS Code Host 与 Web 必须共享同一个 SessionStore、artifact lineage 和 HostAction 边界。

本次优化解决四类问题：

1. Web 信息密度、语言和布局不适合工程审阅。
2. Scenario 指标与规格图缺乏清晰、可信的 baseline 对比交互。
3. F3 ADO Reminder 的展示与 ADO 操作分散。
4. Conversation 缺少受管工程上下文，Session 输出存在误提交风险。

## 2. 设计原则

- F8 是 projection 和 interaction layer，不改变 F0-F7 的计算所有权。
- 源 workbook、F0 knowledge、F1 image、F2-F6 artifacts 始终只读。
- Web 所有可见内容使用英文。
- workbook 派生文本翻译为英文后显示，原文通过 hover/focus tooltip 提供。
- 翻译不得覆盖、修改或伪造源 artifact；翻译结果属于 F8 projection metadata。
- Scenario 动态计算只调用现有 F4 What-if 服务。
- ADO 写入只通过现有 HostAction 和最终确认流程。
- 不显示无法证明的进度百分比。

## 3. English Projection

新增集中的 `WebProjection` 边界，负责：

- 固定 UI copy、状态、错误、空状态和字段名称的英文显示。
- reason code、capability status、governance status 的确定性英文映射。
- workbook 动态文本的英文 projection，并保留 `sourceText`。
- knowledge recommendation 和 report excerpt 的英文 projection。
- 未获得可信翻译时显示原文并标记 `Original text`，不得生成虚构翻译。

动态文本 model：

```ts
interface ProjectedText {
  readonly displayText: string;
  readonly sourceText: string;
  readonly translated: boolean;
}
```

UI 默认显示 `displayText`；可聚焦元素通过 tooltip 展示 `sourceText`。表格不得因双语并排增加宽度。

## 4. F0-F7 Progress Track

每个 Feature 旁显示不超过两个英文单词的说明：

| Feature | Label |
|---|---|
| F0 | Load Library |
| F1 | Extract Data |
| F2 | Check Inputs |
| F3 | Drawing Governance |
| F4 | Calculate TA |
| F5 | Interpret Results |
| F6 | Optimize Design |
| F7 | Apply Feedback |

状态使用 `Completed`、`Running`、`Action required`、`Failed`、`Pending`、`In development`。当前子阶段和 elapsed time 保留。Feature label 是固定 UI projection，不进入 F0-F7 artifacts。

## 5. Worksheet Workspace

### 5.1 布局

桌面布局为 34% evidence / 66% factor table。两侧等高，图片优先完整适配，不裁切分析目标。窄屏按 evidence、objective、factor table 顺序纵向排列。

Factor Table 必须在桌面常用宽度 1280px 及以上无需水平滚动即可查看核心信息。核心列：

- Row
- Factor
- Part / Drawing / DIM ID（紧凑组合列）
- Category
- Nominal
- +Tol
- -Tol
- L/T Factor
- Sigma
- Distribution
- Mean
- One Sigma
- Contribution
- Status / Recommendation（紧凑组合列）

字体目标：表头 10-11px，正文 11-12px，数字使用稳定 tabular numerals。长文本截断并提供 source tooltip。Notes 通过行详情或 tooltip 查看，不占常驻宽列。

### 5.2 Evidence footer

图片下方固定显示：

- `Tolerance loop description`
- `Target nominal`
- `Upper tolerance`
- `Lower tolerance`

数值来源为 worksheet system specification / analysis target，而非当前选中 Factor。缺失值显示 `Not available` 和对应受管理由。

## 6. Mean Offset

删除可编辑 `Additional Mean Shift` 控件。显示只读 `Mean offset`：

$$
\text{Mean Offset} = \text{Calculated Mean} - \text{Target Nominal}
$$

该值属于计算结果 projection，不能被用户直接编辑。用户可编辑的仍是允许进入 F4 What-if 的 Factor nominal/tolerance 和 system LSL/USL。现有底层 `additionalMeanShift` 字段保持兼容，但 F8 不提供直接编辑入口。

## 7. Metrics And Contribution Chart

Metric strip 使用紧凑 5 列或响应式网格，降低标题和数值字号。每项显示 baseline 值；存在 Scenario 时显示 delta 或 Scenario 值，且不引起布局跳动。

Factor Contribution 固定显示图例：

- `Baseline`：来自当前 validated F4 artifact，始终不变。
- `Scenario`：来自当前 F4 What-if draft。

两组 bars 始终使用固定颜色。Scenario 与 baseline 相同时仍绘制两层或使用清晰 marker，保证图例语义不消失。

## 8. Interactive Specification Plot

规格图必须包含：

- 有标签和数值的 LSL、USL 垂直线。
- Baseline mean、Scenario mean marker。
- Baseline statistical range。
- Scenario statistical range。
- Worst-case range。
- 明确 legend 和横轴数值刻度。

LSL/USL 支持 pointer drag 和精确数字输入。交互规则：

1. 拖动时更新本地 draft，并节流调用非持久化 F4 preview。
2. 松手后只提交一次 Scenario calculation。
3. `LSL < USL` 为硬约束；越界时 clamp 到最近有效值并显示英文原因。
4. 键盘方向键可移动聚焦的规格线；输入框 blur/Enter 与 pointer release 使用同一 commit path。
5. Preview 失败时保留最后一次有效计算并显示局部错误，不清空 baseline。

## 9. F3 ADO Workspace

`Feature3-ADO-Reminder` 是 ADO section 的唯一内容来源。Web 按 `Part / Subsystem` 分组，显示 group count、missing Drawing Number、missing DIM ID，展开后显示完整 rows。

所有 ADO 操作集中在该 section：

- Local analysis only
- Create work item
- Update existing work item
- Validate target
- Preview payload
- Final confirmation
- Write result / blocked reason

其他 section 不再显示 ADO action。

### 9.1 ADO-compatible payload

使用确定性的 Azure DevOps Markdown projection：

- ATX headings (`##` / `###`)
- 简单 Markdown tables
- 转义 `|`、反斜杠和换行
- 单元格换行转换为 `<br>`，仅使用 ADO 支持的最小 HTML 子集
- 不使用 nested table、details 或脚本
- 每个 Part / Subsystem 独立 section
- payload 超过受管长度上限时 fail closed，并提示拆分，不静默截断

Preview 必须与最终 HostAction `nextContent` 字节一致。Create 和 Update 共享同一个 formatter。

## 10. Conversation Context

发送 Conversation 消息时构造受管上下文 envelope：

```ts
interface TaModelContextEnvelope {
  readonly sessionId: string;
  readonly inputRevision: number;
  readonly worksheetName: string;
  readonly f0Knowledge: readonly KnowledgeContextItem[];
  readonly toleranceLoopImage?: ArtifactContextReference;
  readonly factorTable: readonly FactorContextRow[];
  readonly baselineMetrics?: MetricContext;
  readonly scenarioMetrics?: MetricContext;
  readonly relatedArtifactIds: readonly string[];
}
```

内容包括：与当前 Factors 相关的 F0 knowledge、F1 tolerance-loop image 引用和 metadata、当前 F2 Factor Table、F4 baseline、当前 Scenario、选中 Factor identity。

服务端必须验证 envelope 中所有 artifact IDs 属于当前 Session、input revision 和 review context。模型提示明确区分：`Governed evidence`、`Open interpretation`、`Missing evidence`、`Suggested checks`。模型不能将开放解读写回 governed artifacts。

## 11. Session Output Policy

`.gitignore` 增加：

```gitignore
F8-session-output/
**/F8-session-output/
```

repository verifier 同时拒绝 tracked `F8-session-output` 路径，防止通过 `git add -f` 绕过。已有 `runtime/` ignore 保持不变。

## 12. Error Handling

- 单个 artifact projection 失败不清空其他已加载 artifacts。
- 翻译失败显示原文并标记，不阻塞计算数据。
- Scenario preview 失败保留 baseline 和 last-valid Scenario。
- ADO target validation 或 write 失败只影响 ADO section。
- Conversation context validation 失败不得发送降级为无来源的 prompt。

## 13. Acceptance Criteria

1. 1440px 桌面下 Factor Table 核心列无水平滚动；390px 下页面无横向溢出。
2. 所有可见固定和动态内容为英文；每个翻译文本可查看原始 source text。
3. F0-F7 显示两词以内英文说明。
4. Evidence footer 显示 analysis target description 和 nominal/+Tol/-Tol。
5. Mean Offset 只读且等于 calculated mean 减 target nominal。
6. Contribution chart 同时显示固定 Baseline/Scenario legend。
7. LSL/USL 可拖动实时 preview，松手只提交一次。
8. ADO section 与 F3 Reminder rows 一致，Create/Update 使用同一 ADO-compatible payload。
9. Conversation envelope 包含并验证 F0、F1 image、F2 table 和 F4/Scenario context。
10. `F8-session-output/` 无法被正常添加，repository verifier 对 tracked 路径失败。
11. Web、Server、Scenario、ADO、Conversation 和 repository checks 的聚焦测试通过。
