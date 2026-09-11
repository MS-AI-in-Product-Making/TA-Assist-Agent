# TA Assist Agent Beta 发布准备设计

**日期：** 2026-09-11  
**状态：** 待用户审阅  
**目标版本：** `0.1.0-beta.1`  
**发布模式：** Microsoft InnerSource + 内部 VSIX 制品分发  
**目标分支：** `release/beta-launch-readiness`

## 1. 目标与范围

本设计为 TA Assist Agent Beta 建立可审计的发布门禁。Beta 源码采用 Microsoft InnerSource 模式，允许受管 Microsoft 员工身份查看，并允许只读贡献者通过受控的 Microsoft Enterprise 内部 fork 提交 Pull Request。只向获得授权的内部员工分发由固定 Git tag 构建的 VSIX。发布流程必须证明许可、仓库权限、运行时能力、机密数据边界、第三方依赖和最终制品均满足要求。

本设计不修改 TA 计算方法、工程判断、工作簿 schema 或最终报告的数值契约。当前工作区中已有的 F6、多模态和报告实现改动不属于首批治理文件变更，实施时不得覆盖或回退这些改动。

## 2. 已批准决策

1. Beta 采用 Microsoft InnerSource 模式：源码对目标 Microsoft Enterprise 内的员工可见，但不向公众开放，也不允许未授权对外再分发。
2. GitHub 仓库使用经 Microsoft Organization 管理员确认的 `Internal` visibility；如果该 Organization 无法证明 `Internal` 只覆盖受管 Microsoft 身份，则使用 `Private` visibility 并通过 Microsoft Teams 授予只读访问。根 npm workspace 和所有子 package 保持 `private: true`，防止 npm 意外发布。
3. 正式交付物是 Windows 平台 VSIX，不发布 npm package，也不发布源码归档作为用户安装入口。
4. Release 只能由受保护的 `v<semver>` tag 触发，Beta 首个目标 tag 为 `v0.1.0-beta.1`。
5. 每个 Release 必须附带 VSIX、SHA256、NOTICE、SBOM 和发布审批记录。
6. Microsoft 批准的 InnerSource 使用条款和最终使用条款必须由 Legal 或 Organization 治理方确认；仓库可以先提供明确标记的审批模板，但模板不得被误认为已获批准。
7. GitHub 管理设置、真实 CODEOWNERS 身份、审批人和干净机器由用户或相应管理员提供；自动化不得猜测这些值。
8. 普通内部贡献者只有读取和创建内部 fork 的能力，可以提交 PR，但不能向主仓库直接 push、修改受保护分支或 merge PR。
9. 只有具名 Maintainer/Release Maintainer 可以 merge；仓库管理员仅负责治理配置，不因 Admin 身份默认获得日常 merge 授权。

## 3. 发布门禁模型

发布准备分为三类证据：

| 类型 | 责任边界 | 通过条件 |
| --- | --- | --- |
| 自动门禁 | 仓库代码和 CI | 命令退出码为 0，结果被当前 commit 和 tag 绑定 |
| 管理员门禁 | GitHub Organization/Repository 管理员 | 设置截图或导出记录包含检查日期、操作者和结论 |
| 人工审批 | Product、Engineering、Security、Legal | 发布记录包含具名审批人、时间和批准结论 |

任何必需门禁为失败、未知、未审批或证据过期时，发布状态必须为 `NO-GO`。不得以 README 声明代替实现测试，不得以本地测试代替 GitHub 管理设置，不得以生成文件代替 Legal 或工程审批。

## 4. 需求与证据映射

| # | 发布要求 | 类型 | 必需证据 |
| --- | --- | --- | --- |
| 1 | 明确发布模式 | 人工审批 | 本设计、README 和发布记录一致声明 Microsoft InnerSource + 内部 VSIX |
| 2 | 添加专有许可协议 | 人工审批 | `LICENSE.txt` 及 Legal 审批记录 |
| 3 | README 使用、隐私和工程责任条款 | 自动 + 人工 | 文档检查通过，Product/Legal/Engineering 审阅 |
| 4 | 创建 SECURITY.md | 自动 + 人工 | 文件存在，包含私密报告渠道、SLA、支持版本和数据要求 |
| 5 | 创建 CHANGELOG.md | 自动 | 当前版本存在且内容与 Release 一致 |
| 6 | 创建真实 CODEOWNERS | 管理员 | `.github/CODEOWNERS` 不含示例账号，owner 在 GitHub 中可解析 |
| 7 | 保护 main 分支 | 管理员 | Ruleset 导出或截图及测试 PR 证据 |
| 8 | 最小化 Write/Maintain/Admin | 管理员 | 普通贡献者为只读；Collaborators/Teams 权限审计记录列出唯一可 merge 的维护者 |
| 9 | 限制 fork、删除、force push 和 tag 改写 | 管理员 | 仅允许受管内部 fork；Repository 与 tag ruleset 审计记录 |
| 10 | 审计 Apps、Deploy Keys、Webhooks | 管理员 | 主体、用途、owner、权限、到期日和保留结论 |
| 11 | 只发布固定 tag 制品 | 自动 + 管理员 | Release workflow 验证 tag、版本和 commit 一致 |
| 12 | Release 附带 SHA256、NOTICE、SBOM | 自动 | Release asset 完整性测试 |
| 13 | 扫描 secret、路径、工作簿和机密 fixture | 自动 | 源码历史、工作树和解包 VSIX 三层扫描报告 |
| 14 | 扫描第三方依赖许可证 | 自动 + Legal | 生产制品依赖清单、许可证策略结果和 Legal 例外 |
| 15 | MCP 使用显式工具白名单 | 自动 | 配置和测试拒绝 `*`、未知工具与非批准写工具 |
| 16 | Skill 无 git push/GitHub 写能力 | 自动 | 源码与解包 VSIX capability 测试 |
| 17 | Skill 不读取敏感路径 | 自动 | `.git`、`.env`、仓库外敏感路径的拒绝测试 |
| 18 | 源工作簿只读 | 自动 + 干净机 | 单元测试及验收前后 hash、mtime、文件属性记录 |
| 19 | ADO 写入需要预览和最终确认 | 自动 + 干净机 | 无确认零写入、确认后单写入和 readback 证据 |
| 20 | 报告不泄露受限信息 | 自动 + 人工 | Markdown、PDF、日志和 Release asset 内容扫描 |
| 21 | 干净机器安装和验收 | 人工验收 | 环境指纹、安装记录、验收步骤和结果 |
| 22 | 记录版本、SHA、环境和审批人 | 自动 + 人工 | 完整 release evidence manifest |

## 5. 许可与文档边界

### 5.1 InnerSource 使用条款

`LICENSE.txt` 或 Organization 指定的等效文件必须至少表达版权所有、Microsoft 内部授权用户范围、内部贡献方式、禁止未授权对外复制和再分发、无权利转让、终止与联系渠道。最终文本必须来自 Microsoft 批准的 InnerSource 模板，或由 Legal/Organization 治理方明确批准。

在 Legal 尚未批准前：

- 文件状态显示 `LEGAL REVIEW REQUIRED`。
- Release workflow 必须拒绝带有该标记的正式 tag。
- 内部测试制品可以生成，但不得发布给 Beta 用户。

### 5.2 README

README 必须清楚说明：

- 仅限授权内部用户和批准设备使用。
- 工作簿、图纸、供应商资料、DIM ID 和生成报告属于机密工程数据。
- 数据默认在本机处理；只有用户完成预览并最终确认后才允许 ADO 写入。
- 产品不要求用户在聊天、参数、日志或 Issue 中提交密码、PAT、Token、MFA 或其他凭据。
- 结果是工程决策支持，不替代 ME、质量、制造、供应商管理或其他授权人员的评审和签核。
- 用户负责确认输入、假设、图纸版本、能力证据和输出适用性。
- Beta 的支持范围、已知限制、问题报告渠道和数据清理责任。

### 5.3 SECURITY.md

安全问题必须通过公司批准的私密渠道报告。公开 Issue 中禁止包含真实工作簿、报告、图纸、DIM ID、供应商信息、绝对路径、Token 或访问凭据。文档必须列出支持版本、初始响应目标和安全联系人角色；真实邮箱由 Security owner 提供。

## 6. GitHub 仓库治理

管理员必须对 `main` 启用 ruleset：

- 仅允许 Pull Request 合并，禁止直接 push。
- 至少一名非作者审批，并要求 CODEOWNERS 审批。
- 要求所有正式 CI 检查成功。
- 要求对话解决、分支为最新状态并阻止规则绕过。
- 禁止 force push 和 branch deletion。
- 将允许 merge 的主体限制为具名 Maintainer/Release Maintainer team；普通 Microsoft 员工、只读贡献者和 PR 作者不能 merge。
- 禁止 PR 作者自行批准；需要独立 reviewer 和对应 CODEOWNER 批准。

管理员必须对 `v*` 启用 tag ruleset：

- 只有指定 Release 管理员或专用发布主体可以创建 tag。
- tag 创建后禁止更新、force push 和删除。
- Release workflow 的 tag commit 必须可到达受保护的 `main`。

仓库禁止 public fork、外部 fork 和向非 Microsoft 受管 namespace 创建 fork。为了让没有 `Write` 权限的内部员工提交 PR，只允许 Microsoft Enterprise 策略控制下的内部 fork；若 Organization 无法提供该隔离保证，则在完成安全设计前暂停普通员工贡献入口。Organization base permission 采用 `Read` 或更低，普通贡献者不得获得主仓库 `Write`。只有具名 Maintainer team 可以获得满足审核后 merge 所必需的权限，Maintain、Admin 仅保留有明确治理职责的最小主体。Collaborators、Teams、Apps、Deploy Keys 和 Webhooks 必须记录 owner、用途、权限和保留理由，无 owner 或用途不明的主体必须移除。

InnerSource 贡献流固定为：

```text
Microsoft employee reads repository
	-> creates a managed internal fork
	-> pushes a topic branch to that fork
	-> opens a Pull Request against the main repository
	-> CI and required reviews complete
	-> a named Maintainer merges or rejects the Pull Request
```

贡献者对自己的内部 fork 拥有的写权限不得扩展为主仓库写权限。提交 PR 不构成 merge 授权。

## 7. Skill 与 MCP 最小权限

### 7.1 MCP 白名单

`.mcp.json` 和 VS Code 生效配置不得使用 `"*"`。白名单只能包含 Drawing Governance 协议实际调用的能力：

- 组织、项目、Work Item type、用户候选和 Work Item 的只读查询。
- 创建模式所需的 Work Item 创建工具。
- 写入前后所需的评论列表读取工具。
- 经 capability gate 验证的唯一评论或 `System.History` 更新工具。

最终工具名称必须从当前 Surface MCP schema 获取，不能根据文档猜测。任何新增写工具都必须通过独立治理变更 PR。

### 7.2 禁止仓库写能力

Skill、Extension 和打包后的 VSIX 不得包含或调用 `git push`、GitHub repository write API、Octokit 写客户端、`gh` 写命令或修改 Git refs 的能力。构建脚本可以读取 Git commit、tag 和 tracked-file 状态，但不能修改远端或仓库历史。

### 7.3 文件读取边界

用户输入路径必须经过统一文件策略。以下路径始终拒绝：

- 任意 `.git` 文件或目录。
- 任意 `.env`、`.env.*`，只有开发仓库中的 `.env.example` 可被静态检查读取，运行时 Skill 不读取它。
- 凭据存储、SSH key、浏览器 profile 和操作系统 secret store。
- 非工作簿输入声明的仓库外路径。

源 `.xlsx` 只能以只读方式打开。验证必须拒绝符号链接、junction、路径穿越、TOCTOU 身份变化和不受控扩展名。

## 8. 数据与报告隐私

绝对路径、Token、密码、PAT、API key、连接字符串和凭据必须从用户回复、错误、日志、Markdown、PDF 与 Release assets 中移除。

供应商信息和 DIM ID 的边界按以下方式定义：

- 它们可以出现在由授权用户在本地生成的受治理工程报告中，因为当前报告将 Drawing Number 和 DIM ID 作为工程可追溯字段。
- 它们不得出现在遥测、通用日志、错误消息、公共 fixture、README 示例、Issue 模板、NOTICE、SBOM、Release notes 或发布审批记录中。
- Release 扫描使用合成 canary 值验证传播边界，不使用真实供应商或 DIM ID。
- 若 Product 或 Security 要求工程报告本身也隐藏 DIM ID，必须另立“脱敏报告”设计并修改现有报告契约；不能把该变化混入发布治理工作。

`.github/skills/ta-assist-agent/SKILL.md` 是成功回复的产品边界，不显示绝对路径。`pdf-report-export` 子 Skill 必须与该规则一致，不得要求在成功回复中显示完整绝对路径。

## 9. Release 供应链

### 9.1 触发与版本

Release workflow 只响应 `v*` tag，并验证：

1. tag 符合 SemVer。
2. tag 版本与根 package 和 VS Code Extension package 的版本一致。
3. tag commit 可到达 `origin/main`。
4. 工作树构建输入只来自该 commit，依赖使用 `npm ci`。

### 9.2 制品

VSIX 文件名包含产品、版本和目标平台：

```text
ta-assist-agent-0.1.0-beta.1-win32-x64.vsix
```

Release 同时生成：

```text
ta-assist-agent-0.1.0-beta.1-win32-x64.vsix.sha256
NOTICE.txt
ta-assist-agent-0.1.0-beta.1.cdx.json
release-evidence-0.1.0-beta.1.json
```

SBOM 使用 CycloneDX JSON。NOTICE 和许可证扫描必须以解包后的实际 VSIX 内容为准，避免把仅用于开发的依赖误判为运行时分发依赖。Windows Sharp/libvips 原生运行时需要单独确认 LGPL 通知和再分发义务。

### 9.3 扫描

发布前至少执行：

- 全 Git 历史 secret 扫描。
- 当前 tracked 与 untracked 发布输入扫描。
- 禁止工作簿、机密 fixture、runtime session、绝对路径和 canary secret 的仓库检查。
- 解包 VSIX 后重复执行机密内容和能力扫描。
- npm vulnerability audit。
- 实际分发依赖许可证策略检查。

扫描发现项只能通过具名、安全审批且有到期日的例外记录关闭。

## 10. 干净机器验收

使用不包含源码仓库、开发依赖、历史工作簿和开发者凭据的 Windows 机器或 VM：

1. 记录 Windows、VS Code、Node、CPU architecture 和机器用途。
2. 从 Release 下载 VSIX 并独立核对 SHA256。
3. 安装 VSIX，确认发布者、版本和目标平台正确。
4. 使用批准的合成 `.xlsx` 完成一次 TA 分析。
5. 对比源工作簿运行前后的 SHA256、mtime 和只读属性，确认未修改。
6. 验证 `.git`、`.env`、符号链接和越界路径输入被拒绝。
7. 在 ADO 预览后取消，确认零写入；经授权后再执行一次确认写入并验证 readback。
8. 扫描用户回复、日志、Markdown 和 PDF，确认无绝对路径、凭据 canary 和未授权信息。
9. 卸载 Extension，并按 README 指引清理本地运行数据。

真实 ADO 写入只能在专用测试项目和测试 Work Item 中执行。

## 11. 发布审批记录

`release-evidence-<version>.json` 必须包含：

- 产品版本、tag、完整 commit SHA 和构建时间。
- GitHub Actions run ID、runner OS、Node、npm、VS Code target 和目标平台。
- VSIX、NOTICE、SBOM 的文件名和 SHA256。
- CI、secret、依赖、许可证、VSIX 内容和干净机验收结果。
- Product、Engineering、Security、Legal 和 Release approver 的姓名或企业身份、批准时间和结论。
- 每个例外的 owner、依据、到期日和补救计划。

审批人字段不得由自动化预填。正式 Release 只有在所有必需身份和结论存在且无未批准例外时才允许发布。

## 12. 实施顺序

1. 建立许可、README、SECURITY、CHANGELOG、CODEOWNERS 和发布台账模板。
2. 激活 CI 并加入仓库、Skill、路径和机密数据静态门禁。
3. 从实际 Surface MCP schema 固定显式工具白名单。
4. 增加 VSIX capability、路径、工作簿只读和报告泄露测试。
5. 实现固定 tag Release、SHA256、NOTICE、SBOM 和 evidence manifest。
6. 完成 GitHub 管理员设置和权限审计。
7. 在干净机器执行验收，收集全部人工审批。
8. 只有发布清单全部通过后创建 `v0.1.0-beta.1`。

## 13. 完成定义

Beta 只有在 22 项发布要求都有当前 commit 对应的有效证据、所有自动门禁通过、所有管理员操作已验证、所有必需审批已具名完成且干净机验收通过时，才可从 `NO-GO` 转为 `GO`。任何证据缺失都必须在发布清单中保持未完成，不得用口头确认替代。