# F7 Step 6 Report 设计

## 1. 背景与目标

F7 Measurement Workbench 已完成 Worksheet 选择、测量数据、能力分析、分布拟合和 Monte Carlo。Step 6 当前永久锁定，也没有报告合同、生成端点或展示组件。

Step 6 将当前受治理的会话和 Monte Carlo 结果投影为一份可审阅、可追溯的结构化报告，并从同一投影生成可下载 Markdown。应用内报告采用“审阅摘要型”主布局，完整证据链放在可展开区域。

## 2. 已批准范围

1. 提供应用内完整报告。
2. 提供确定性 Markdown 下载。
3. 不提供 PDF、打印模板、报告编辑、签核或持久化文件发布。
4. 不把统计能力评估表述为产品 Release/Hold 决策。
5. 不重新运行 Monte Carlo，也不从 Markdown 反向解析结构化结论。

## 3. 方案与决策

评估的方案：

1. 纯前端投影：实现较快，但 UI 与导出容易形成两套判定逻辑。
2. 服务端结构化投影与 Markdown：报告结论只有一个受验证来源，UI 与下载保持一致。
3. 仅 Markdown：实现面较小，但不满足 Step 6 的应用内审阅体验。

采用方案 2。服务端从当前会话快照生成结构化报告和 Markdown；前端只展示结构化字段，并下载同一响应中的 Markdown。

## 4. 输出合同

新增严格 Zod 合同 `f7ReportProjectionSchema`，核心结构如下：

```ts
{
  contractId: "f7-report-v1";
  outputClassification: "confidential";
  sessionId: string;
  generatedAt: string;
  assessment: "MEETS_TARGET" | "BELOW_TARGET" | "NOT_EVALUABLE";
  workbook: {
    fileName: string;
    workbookContentHash: string;
    worksheetName: string;
  };
  summary: {
    mean: number;
    standardDeviation: number;
    yield: number;
    ppm: number;
    lowerSpecLimit: number;
    upperSpecLimit: number;
    targetSigmaLevel: number;
    cp?: number;
    cpk?: number;
    targetCpk: number;
  };
  simulation: F7MonteCarloResult;
  factors: readonly F7ReportFactor[];
  evidence: F7ReportEvidence;
  markdown: string;
}
```

`assessment` 只由 Monte Carlo capability 产生：

- capability `available` 且 `targetStatus === "meets_target"` → `MEETS_TARGET`；
- capability `available` 且 `targetStatus === "below_target"` → `BELOW_TARGET`；
- capability `not_available` → `NOT_EVALUABLE`。

该评估不等于设计放行、生产放行或物理根因确认。

## 5. 生成接口与状态

新增 `POST /f7/report`，请求体仅包含 `sessionId`。服务端要求：

1. 会话存在且状态为 `phase_1_ready`；
2. 当前会话包含完整、已验证的 `monteCarloResult`；
3. Monte Carlo `factorManifest` 与当前因子来源模式及批准分布一致。

成功响应为 `f7ReportProjectionSchema`。缺少或过期的模拟结果返回 `prerequisite_not_ready`；无效请求沿用受控 `validation_error`。

报告由用户进入 Step 6 时显式生成。`generatedAt` 在单次生成时固定，结构化字段与 Markdown 使用同一内存投影。前端不会自行重算 assessment。

现有因子模式、测量数据、测量处置、拟合结果或分布批准发生变化时，会话已经清除 `monteCarloResult`，因此旧报告无法再次生成。前端在收到新的会话快照后同时清除本地报告投影。

## 6. 报告内容

应用内报告按以下顺序展示：

1. Assessment 横幅：`MEETS_TARGET`、`BELOW_TARGET` 或 `NOT_EVALUABLE`，附非放行声明。
2. 关键指标：预测 yield、标准差、Cpk/Target Cpk、Observed PPM。
3. Monte Carlo 分布：复用现有 histogram/normal-fit 图表。
4. 模拟摘要：均值、分位数、规格边界、迭代次数和 correlation mode。
5. 因子模型：因子名称、loop coefficient、来源模式、批准分布和来源引用。
6. 可展开证据链：工作簿哈希、Worksheet、规格来源单元格、方法 ID、随机种子、因子 manifest 和生成时间。

Markdown 使用相同顺序和相同结构化字段。所有工作簿文本必须转义 Markdown 控制字符和 HTML，不允许原始 HTML 注入。

## 7. 前端交互

Step 6 在 `monteCarloResult` 存在时变为可进入状态。Step 5 成功运行后显示 `Open report`；工作流 rail 将 Step 5 标记为完成、Step 6 标记为当前。

新增 `ReportPanel.vue`：

- 进入时调用一次报告生成接口；
- busy、受控错误和重试沿用 session store 模式；
- `Back to Monte Carlo` 返回 Step 5 且不重跑模拟；
- `Download Markdown` 使用响应中的 Markdown 创建本地下载，文件名基于安全化 workbook 名称；
- 证据链使用原生 `details/summary`，默认折叠且支持键盘操作。

## 8. 组件与代码边界

- `packages/contracts`：报告及路由 DTO，不包含展示逻辑。
- `apps/f7-local-api`：纯报告投影/Markdown renderer、session service 方法和 HTTP 路由。
- `apps/f7-web/src/api`：严格解析报告响应。
- `apps/f7-web/src/state`：报告生成 action、busy/error 和失效处理。
- `ReportPanel.vue`：只负责展示和下载；复用 `MonteCarloHistogram.vue`。
- `App.vue`：Step 5/6 导航和 workflow 状态，不计算报告结论。

## 9. 错误与安全边界

- 所有输入和输出通过严格合同验证。
- 响应继续受现有最大响应字节数和 `no-store` 约束。
- Markdown renderer 对来自 workbook 的文本进行单元格、换行和 HTML 转义。
- 报告只引用当前 session 的内存快照，不接受客户端上传的统计结果或 assessment。
- 下载由浏览器从已验证响应生成，不向任意路径写文件。

## 10. 测试与验收

1. 合同测试覆盖三种 assessment、严格字段、非法数值和 manifest。
2. 投影测试覆盖 assessment 映射、字段一致性、Markdown 转义和确定性。
3. service 测试覆盖无模拟阻塞、成功生成和因子变化后的失效。
4. server 测试覆盖路由、媒体类型、请求大小、错误映射和响应解析。
5. client/store 测试覆盖请求 DTO、严格响应、busy/error 和报告清除。
6. component 测试覆盖三种 assessment、指标、图表、证据折叠与 Markdown 下载。
7. App 测试覆盖 Step 6 解锁、进入、返回以及 Step 5/6 rail 状态。
8. 根构建、F7 Web 构建和相关 Vitest 集全部通过。
9. 浏览器验证桌面与移动视口无重叠，报告图表非空，键盘可访问，下载内容与页面投影一致。

## 11. 非目标

- 报告历史、跨进程恢复或数据库持久化；
- PDF、DOCX 或服务端文件系统导出；
- 审批签名、评论或 ADO 发布；
- correlation mode 扩展；
- 新的统计计算或 Monte Carlo 方法变更。