# 数据分类与治理规则

## 分类定义

系统使用 `public`、`internal`、`confidential` 与 `secret` 四级分类。处理数据的
Skill、Adapter、运行记录和导出工件都必须携带分类，并在策略门许可后才可继续。
没有明确允许规则时，系统默认拒绝。

| 分类 | 示例 | 存储与运行记录 | 输出与提交 | 导出 |
|---|---|---|---|---|
| `public` | 匿名 fixture、schema、公开文档 | 可存入受控本地运行记录 | 仅匿名 `public` fixture 可提交到 Git；输出前仍需避免混入其他分类 | 可导出，但必须保留来源与分类 manifest |
| `internal` | 非敏感配置、运行元数据 | 可在本地受控路径保存，记录最小必要信息 | 不得将未审查运行记录直接提交；输出遵循最小披露 | 仅在策略允许的受控范围内导出，并附分类 manifest |
| `confidential` | TA 工作簿、DIM ID、供应商信息、Cpk、ADO 内容 | 默认仅保留哈希和必要元数据；原始工件的本地保留须有显式选择 | 不得提交到 Git；不得输出到控制台或共享位置，除非有显式审批 | 不得导出；只有经明确确认和策略批准的受控导出才可进行 |
| `secret` | Token、密码、连接字符串、证书 | 仅可放入环境变量或系统凭据存储；不得写入 memory、audit、logs 或运行工件 | 不得提交、显示、序列化或通过错误信息输出 | 永不导出 |

## 策略门

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
- 审计和日志只能记录分类、别名、哈希、事件代码与必要元数据。它们不得包含
  `secret`，也不得泄露 `confidential` 原文、DIM ID、供应商名称或环境变量值。
- 导出先生成分类 manifest。发现 `secret` 时拒绝；发现 `confidential` 时默认拒绝，
  只有用户明确确认且策略批准的受控场景才能继续。
- 任何策略拒绝都不执行替代动作，必须以 `policy_denied` 记录可审计的拒绝事件。