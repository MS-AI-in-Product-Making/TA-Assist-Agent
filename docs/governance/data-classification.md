# 数据分类与治理规则

## 分类定义

系统使用 `public`、`internal`、`confidential` 与 `secret` 四级分类。Phase 0 提供
分类规则与 fail-closed 策略评估接口；没有明确允许规则时，评估结果默认拒绝。处理
数据的 Skill、Adapter、运行记录和导出工件都必须携带分类。当前未交付生产编排器，
调用方与后续编排器必须在执行前调用策略门，不能宣称本阶段已对这些路径完成端到端
运行时强制。

| 分类 | 示例 | 存储与运行记录 | 输出与提交 | 导出 |
|---|---|---|---|---|
| `public` | 匿名 fixture、schema、公开文档 | 可存入受控本地运行记录 | 仅匿名 `public` fixture 可提交到 Git；输出前仍需避免混入其他分类 | 可导出，但必须保留来源与分类 manifest |
| `internal` | 非敏感配置、运行元数据 | 可在本地受控路径保存，记录最小必要信息 | 不得将未审查运行记录直接提交；输出遵循最小披露 | 仅在策略允许的受控范围内导出，并附分类 manifest |
| `confidential` | TA 工作簿、DIM ID、供应商信息、Cpk、ADO 内容 | 默认仅保留哈希和必要元数据；原始工件的本地保留须有显式选择 | 不得提交到 Git；不得输出到控制台或共享位置，除非有显式审批 | 不得导出；只有经明确确认和策略批准的受控导出才可进行 |
| `secret` | Token、密码、连接字符串、证书 | 仅可放入环境变量或系统凭据存储；不得写入 memory、audit、logs 或运行工件 | 不得提交、显示、序列化或通过错误信息输出 | 永不导出 |

每个 run 的受控根目录直接包含 `transcript.jsonl`、`decisions.jsonl`、
`events.jsonl`、`artifacts/`，并在最终封存时由 audit 写入根目录
`manifest.json`。`events.jsonl` 和 `manifest.json` 只能由 audit API 管理；memory
不得自行写入、解析或在损坏时把审计查询降级为“未找到事件”。未显式选择保留时，
`confidential` transcript、decision 和 artifact 原文均不得落盘，只可记录不含原文的
hash 或必要元数据；`secret` 始终以 `policy_denied` 拒绝且不得持久化。

## 策略门

以下限制是当前策略规则与后续运行时集成的共同设计目标。当前 `evaluatePolicy` 只提供
纯评估接口；生产执行路径必须由调用方和后续编排器在实际执行前调用它，并根据拒绝
结果停止操作。

- 所有网络外部访问必须在 Skill 或 Adapter manifest 中声明，并逐次获得策略审批。
  未声明网络权限必须返回 `{ allowed: false, reason: "policy_denied" }`。
- 默认 Adapter 为 deny。没有显式 allow 规则时，不得连接模型、ADO、SharePoint、
  计算 Worker 或其他外部系统。
- `secret + persist` 始终拒绝，并返回
  `{ allowed: false, reason: "policy_denied" }`。不得以哈希、转码、错误上下文或
  调试日志规避该限制。
- 当前明确允许的低风险操作是读取 `public` 分类输入。新增 allow 规则前，必须
  说明分类、权限、审计证据、测试 fixture 与回滚方式。

## 提交、日志与审计

- Git 只接受匿名 `public` fixture。真实 TA 数据、供应商信息、DIM ID、测量数据、
  ADO 内容、`.env` 与 runtime 记录均不得提交。
- `public-v1` 知识库始终只包含匿名 `public` 内容。经审查的 F0 内部规则与快照元数据
  可以作为 `internal` 治理工件维护；原始 `.xls`、`.xlsx`、`.xlsm` 一律不得提交，直到
  另行批准受控白名单。
- F0 的 T0 仅表示 `guidance-exceeded`、`within-guidance` 或 `unknown` 三种指导结果语义；
  不得由此推断能力紧度或可制造性。
- 审计和日志只能记录分类、别名、哈希、事件代码与必要元数据。它们不得包含
  `secret`，也不得泄露 `confidential` 原文、DIM ID、供应商名称或环境变量值。
- **Phase 0 审计根目录部署契约：**每个 run 必须使用独立、私有的本地目录；只有
  受控的进程身份可以写入该目录。`append` 与 `seal` 通过根目录内的排他锁协调，
  因此多个受控实例或进程可共享同一 run 根目录，但不得将其部署在共享、非受信任或
  可被其他主体任意写入的文件系统上。Phase 0 不提供自动陈旧锁恢复：发现
  `audit.lock` 后，写入在有限重试后以 `dependency_error` 拒绝，绝不自动删除、
  重命名或修改既有锁。崩溃遗留的 `audit.lock` 是运行目录的受控维护事项；维护者
  必须先确认没有运行实例，再手动移除锁文件，之后才可恢复写入。
- 审计完整性保证以该私有目录和操作系统访问控制为前提。符号链接、junction、锁文件
  或工件在受控操作之外被并发恶意替换，不在 Phase 0 的威胁模型内；此类环境必须在
  调用审计 API 前提供操作系统级隔离或不可变存储，不能把路径校验或文件锁视为安全
  边界。
- 导出先生成分类 manifest。发现 `secret` 时拒绝；发现 `confidential` 时默认拒绝，
  只有用户明确确认且策略批准的受控场景才能继续。
- 清理是封存前的生命周期步骤。`planPurge` 和 `executePurge` 发现 run 已由
  `manifest.json` 封存时必须以 `dependency_error` 拒绝，且不得删除任何内容。对未
  封存 run，审计必须先成功记录 `purge_planned` 和 `purge_completed`，然后才执行删除；
  删除完成后方可写入最终 `manifest.json`。这样不会发生“数据已删除但没有清理证据”的
  状态。
- 后续生产编排器遇到策略拒绝时，不得执行替代动作，必须以 `policy_denied` 记录可
  审计的拒绝事件。Phase 0 评估器本身不执行外部动作或审计写入。