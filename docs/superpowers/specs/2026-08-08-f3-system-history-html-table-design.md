# F3 System.History HTML 表格设计

## 背景

Surface MCP 通过 `/fields/System.History` 创建的 ADO comment 格式为 `html`。当前 F3 将 Markdown
正文直接写入该字段，ADO 因此把换行和管道表格当作普通文本展示。数据写入和回读虽然完全一致，
但阅读体验不符合治理报告要求。

## 目标

1. `System.History` comment 在 ADO 中显示为结构化标题、摘要、操作列表和 11 列表格。
2. 本地 Markdown reminder 与 ADO HTML comment 继续由同一份 F3 report 确定性生成。
3. 直接 comment 通道继续使用 Markdown；`System.History` 通道只使用 HTML。
4. 保留完整行、敏感信息脱敏、写前确认、单次写入和写后全文/hash 验证。
5. 为 Work Item `1102392` 新增一条格式正确的替代评论；不尝试编辑或删除旧评论 `17755592`。

## 非目标

- 不引入通用 Markdown parser。
- 不依赖 ADO CSS 或 JavaScript。
- 不修改 F3 JSON 数据合同、治理判定或 11 列含义。
- 不通过 REST、浏览器或其他 MCP 写入 ADO。
- 不绕过现有 target validation 和 `Confirm write`。

## 双渲染器

`scripts/f3-ado-reminder.mjs` 保留 `renderF3AdoReminder(report)`，并新增
`renderF3AdoHistoryHtml(report)`。两个函数都直接消费经过
`drawingGovernanceResultV2Schema` 验证的 report，不互相解析输出。

Markdown renderer 用于：

- 本地 `Feature3-ADO-Reminder.md`；
- 支持完整 Markdown body 的直接 comment tool；
- 最终确认界面的可读预览。

HTML renderer 用于：

- 本地 `Feature3-ADO-History.html`；
- Surface MCP `update_work_item` 的 `/fields/System.History` value；
- `System.History` 写后回读和 SHA-256 校验。

## HTML 结构

HTML body 使用以下固定结构：

```html
<h2>F3 DIM ID / Drawing Governance Reminder</h2>
<p><strong>Workbook:</strong> Maera_cosmetic_critical_TA - Rev E_0110 - test.xlsx</p>
<ul><li>Fill in missing Drawing Number and DIM ID fields in the source workbook.</li></ul>
<table>
  <thead><tr><th>Device Level Dim</th><th>Dimension Description</th><th>Part / Subsystem</th><th>Drawing Number</th><th>Dim ID</th><th>Factor Description</th><th>Nominal</th><th>Upper Tolerance (+)</th><th>Lower Tolerance (-)</th><th>σ Level</th><th>Governance issue</th></tr></thead>
  <tbody><tr><td>Feet_gap</td><td>DIM1018, Feet gap to D cover</td><td>Gap</td><td>(missing)</td><td>5</td><td>gap</td><td>0.26</td><td>0.225</td><td>-0.225</td><td>4</td><td>Drawing Number missing; DIM ID suspected invalid</td></tr></tbody>
</table>
```

表头顺序必须与现有 Markdown 11 列合同完全一致。每个 governance row 恰好生成一个 `<tr>`，不得截断、
合并或重排。模板只使用 ADO 支持的基础元素：`h2`、`p`、`strong`、`ul`、`li`、`table`、`thead`、
`tbody`、`tr`、`th`、`td` 和 `br`。

## 转义与脱敏

所有动态文本先复用现有 Windows 路径与 Authorization 脱敏，再进行 HTML escaping：

- `&` -> `&amp;`
- `<` -> `&lt;`
- `>` -> `&gt;`
- `"` -> `&quot;`
- `'` -> `&#39;`
- CRLF/LF -> `<br>`

不得把 workbook、worksheet、part、factor 或 governance issue 文本当作原始 HTML 注入。

## Artifact 生成

`scripts/run-f3-full-validation.mjs` 在成功生成 F3 report 时同时写出：

- `Feature3-Report.json`
- `Feature3-Report.md`
- `Feature3-ADO-Reminder.md`
- `Feature3-ADO-History.html`

`scripts/write-f3-ado-reminder.mjs` 在更新 ADO outcome 时重新生成 Markdown reminder 和 HTML history
artifact，确保状态更新后两个发布正文仍来自当前 report。

## 发布与验证

Skill 根据通道选择 body：

- direct comment channel：`confirmedMarkdownBody`；
- `System.History` channel：`confirmedHistoryHtml`。

最终确认必须展示完整治理数据，并明确实际写入的是确定性 HTML table。确认后只执行一次
`add /fields/System.History`。写前保存 comment IDs，写后只回读一次，并要求：

1. 恰好一个新增 comment；
2. Work Item ID 匹配；
3. comment format 为 `html`；
4. comment text 与 `confirmedHistoryHtml` 字节级一致；
5. 两侧 SHA-256 一致。

任一条件失败时使用 `write_verification_failed`，不得重试。

## 测试

1. HTML renderer 输出固定标题、摘要、操作列表和 11 个 `<th>`。
2. 每个 factor row 恰好对应一个 `<tbody>` row。
3. 动态文本正确脱敏并转义 HTML 特殊字符。
4. Markdown renderer 的现有输出保持兼容。
5. F3 workflow 和 reminder writer 都生成两份 ADO artifact。
6. Skill/protocol 明确 channel-specific body、HTML format 和 exact HTML/hash readback。
7. F3 专项测试、build、repository check 和全量测试通过。

## 验收标准

1. 新 ADO comment 以 HTML table 展示，不再显示 Markdown 管道和分隔行。
2. 新评论包含 32 个 factor rows 和固定 11 列。
3. 新增 comment ID、format、目标 ID、完整 HTML 与 SHA-256 回读验证通过。
4. 本地 report 状态保持 `updated`，无 reason code。