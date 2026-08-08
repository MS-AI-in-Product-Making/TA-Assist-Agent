# F3 Surface MCP System.History 评论通道设计

## 背景

当前 Surface MCP 可完成 organization、project、Work Item 和 comment 读取，但
`add_work_item_comment` 的注册 schema 不包含 `body`、`content`、`text` 或语义等价的正文参数。
F3 因此在写入前按协议返回 `surface_mcp_comment_body_unsupported`，没有调用 ADO 写接口。

Surface MCP 同时提供 `update_work_item`，其 `requestBody` 支持 Azure DevOps JSON Patch。
本设计使用 `/fields/System.History` 作为受治理的评论写入通道，并保留现有确认、单次写入和回读校验规则。

## 目标

1. 当 comment tool 没有正文参数时，允许 F3 通过 Surface MCP `update_work_item` 创建 ADO Discussion 评论。
2. 保留完整、确定性的英文 11 列 Markdown payload，不由模型改写治理记录。
3. 写入前仍要求独立的 `Confirm write`。
4. 每次发布最多执行一次 Surface 写调用，不自动重试。
5. 通过新增 comment ID 和完整正文回读验证写入结果。

## 非目标

- 不修改或部署 `https://surfacemcp.microsoft.com` 服务端。
- 不使用 Azure DevOps REST、浏览器自动化、shell HTTP 或其他 MCP 作为回退。
- 不使用 `System.Description`、`System.Title` 或其他 Work Item 字段承载治理报告。
- 不放宽 organization、project、Work Item ID 和用户确认门禁。
- 不把 ADO URL、凭据或完整 comment body 放入 CLI 参数或普通日志。

## 通道选择

F3 在目标验证后检查当前 Surface MCP 工具 schema，按以下顺序选择写入通道：

1. 如果 comment create/update tool 有可承载完整 Markdown 的字符串正文参数，使用直接评论通道。
2. 否则，如果 `update_work_item` 同时满足以下条件，使用 `System.History` 通道：
   - 接收 `organization` 和正整数 `work_item_id`；
   - 接收 `requestBody` 数组；
   - 数组项支持 `op`、`path` 和字符串 `value`；
   - `op` 支持 `add`。
3. 两个通道都不满足时，保持 `blocked / surface_mcp_comment_body_unsupported`。

不得仅因存在通用 Work Item 更新工具就判定能力可用。Skill 必须确认上述真实 schema。

## 数据流

严格执行以下顺序：

```text
publishing mode
-> Surface connection/authentication
-> organization/project/work item validation
-> target confirmation
-> write-channel schema selection
-> read current comment IDs
-> render complete deterministic preview
-> Confirm write
-> one Surface write
-> one comment readback
-> exact body and new-ID verification
-> persist updated or failed outcome
```

`System.History` 写入请求固定为：

```json
[
  {
    "op": "add",
    "path": "/fields/System.History",
      "value": "## F3 DIM ID / Drawing Governance Reminder\n\n| Device Level Dim | ... | Governance issue |"
  }
]
```

Skill 不得生成其他 JSON Patch 项，不得把用户输入用作 `path`，也不得把正文拆成多次写入。

## 回读验证

写入前保存目标 Work Item 当前可见 comment ID 集合。写入后只调用一次 comment list/read 工具，并执行：

1. 计算写入后新增的 comment IDs。
2. 必须恰好新增一个 comment。
3. 新 comment 的 `work_item_id` 必须匹配已验证目标。
4. 新 comment 的 `text` 必须与确认过的完整 Markdown payload 字节级一致。
5. 对确认 payload 和回读 text 分别计算 SHA-256；hash 必须一致。

任一条件失败时不重试写入，持久化
`failed / write_verification_failed`，并关联已经验证的 Work Item ID。
全部通过后持久化 `updated`，不保存 reason code。

## 失败处理

| 阶段 | 结果 |
| --- | --- |
| 无直接评论正文能力且 `System.History` schema 不合格 | `blocked / surface_mcp_comment_body_unsupported` |
| 用户未确认最终写入 | `blocked / user_declined_write` |
| Surface 写调用失败 | `failed / write_verification_failed` |
| 未新增、增加多个、目标不匹配或正文/hash 不一致 | `failed / write_verification_failed` |
| 写入与回读完全匹配 | `updated` |

## 代码与文档范围

- 更新 `.github/skills/f3-analysis/SKILL.md`：增加受治理的通道选择和 `System.History` 调用契约。
- 更新 `.github/skills/f3-analysis/references/ado-publishing.md`：补充预读 comment IDs、固定 JSON Patch 和回读规则。
- 更新 `scripts/f3-skill.test.mjs`：以静态合同测试约束工具名、字段路径、顺序、单次写入和失败关闭行为。
- 必要时同步 F3 端到端文档；不修改 F3 核心分析结果合同。

## 测试策略

遵循 TDD：

1. 先新增合同测试，要求 Skill 和 protocol 明确支持 `update_work_item` 的
   `/fields/System.History` 通道；确认测试因缺少合同文本而失败。
2. 最小修改 Skill 和 protocol，使专项测试通过。
3. 运行 F3 skill、reminder、report 和 full-flow 专项测试。
4. 运行 build 与 repository check，确认没有合同或生成物漂移。
5. 基于现有 F3 artifact 执行真实发布验收；最终写入前仍向用户展示完整 preview 并请求
   `Confirm write`。

## 验收标准

1. 当前 bodyless `add_work_item_comment` 不再是唯一的写入阻塞点。
2. 只有 schema 合格的 Surface `update_work_item` 才能作为替代通道。
3. 写入只包含一个 `add /fields/System.History` patch。
4. 未经最终确认不得调用写工具。
5. 每次发布最多一次写调用、一次写后回读，不自动重试。
6. 新增 comment ID、目标 ID、正文和 SHA-256 均验证通过后才标记 `updated`。
7. 现有 Surface-only、凭据隔离、URL 不持久化和本地 fallback 规则继续生效。