# Phase 0 验收

## 验收范围

Phase 0 交付的是本地优先、可审计、契约驱动的工程基座。验收只使用匿名 `public`
fixture 和临时 runtime 目录；不包含 secret、TA 工作簿、DIM ID、供应商或测量数据，也不
调用真实模型、外部 Adapter、ADO、SharePoint 或 UI。

计划、实现、执行与验收文档均使用中文；代码标识符、路径、命令、错误码、协议和契约
名称保留英文。

## Definition of Done

| 完成定义 | 验证命令 | 预期结果 |
|---|---|---|
| workspace 可安装、类型检查并构建 | `npm run build` | TypeScript build 成功，无类型错误。 |
| 代码符合本地规范 | `npm run lint` | ESLint 成功，无 error。 |
| 契约、治理、审计、memory、Skill、编排器和 CLI 均通过回归 | `npm test` | 全部 Vitest 测试通过。 |
| 禁止路径与分类提交规则受检查 | `npm run check:repository` | 输出 `Repository classified-path check passed.`。 |
| Phase 0 CLI 验收覆盖 smoke、export 和清理 | `npm test -- apps/cli/src/phase-0.acceptance.test.ts` | 测试通过；临时目录在 `finally` 中删除。 |
| 改动无空白或补丁格式问题 | `git diff --check` | 无输出且退出码为 0。 |

Windows 上一个符号链接测试可能因为创建 symlink 所需的权限而跳过；junction 重定向保护
仍由测试覆盖，且不因该跳过降低受控 runtime 路径的安全要求。

## CLI 验收流程

`apps/cli/src/phase-0.acceptance.test.ts` 使用 `mkdtemp` 创建独立临时根目录，并在
`finally` 使用递归 `rm` 清理。测试不使用仓库内的 `./runtime-test`，因此不会产生可提交
运行记录或影响其他测试。

1. 执行 `smoke --root <temporary-root>`，从输出取得 UUID `runId`，并断言
   `manifestValid: true` 与 `F4: feature_not_available`。这证明匿名 smoke workflow
   生成了可验证 manifest，且未交付的 F4 没有被宣称为可用。
2. 执行 `export --run-id <smoke-run-id> --root <temporary-root>` 并断言退出码为 2、
  `stderr` 包含 `dependency_error`，且 run 内不存在 `exports` 目录或文件。smoke 的
  manifest 已封存；导出会持久化新文件并要求 `export_created` 审计事件覆盖，因此必须
  fail closed，不得为方便验收而解除封存、重封或产生任何封存后副作用。
3. 对同一 sealed smoke run 执行 `purge-plan` 并断言拒绝。清理同样会修改审计事件，
  必须保持不可变审计语义。
4. 在另一个独立临时根目录创建未封存的 anonymous `public` controlled run。先执行
  `export` 并断言退出码为 0、`stderr` 为空、`classification: public`、`artifactCount: 0`，
  且输出不含原始 smoke 内容。该导出在审计事务中记录 `export_created`，随后才原子写入
  分类 manifest。之后写入 `public-fixture.txt`，执行 `purge-plan`，从输出读取
  `confirmationToken`。
5. 使用错误 token 执行 `purge` 并断言失败；仅使用计划返回的正确 token 执行 `purge`
   并断言成功。验证 `purge_completed` 审计事件存在、artifact 列表为空，并通过
   `inspect` 断言 `artifactCount: 0`。

这个双生命周期验收同时覆盖 CLI 的导出、清理计划和确认机制，并保留 sealed run 的完整性
保证。它不声称 sealed smoke run 可以被导出或清理；所有持久化导出与清理成功证据都来自
受控、未封存的 public run。

## 安全与功能边界

- Feature Register 中 F0-F7 均为 `unavailable`。F4 只能返回
  `feature_not_available`，不执行方法推荐或 Excel 一致性计算。
- F8 的 `available` 仅表示匿名 `public` fixture 的受治理 Skill runtime 可验收，绝不
  表示 TA 产品工作流、生产编排、网络访问或外部写入已实现。
- 默认 Adapter 拒绝外部访问。Phase 0 不包含真实工作簿、模型、ADO、SharePoint、UI、
  测量数据、计划任务或外部系统行为。
- `secret` 不得写入 memory、audit、日志、导出或 Git。`confidential` 数据不得作为验收
  fixture；真实 runtime 与 `.env`、导出包和工作簿路径均须通过仓库检查排除。
- 持久化 `export` 必须在审计未封存时执行：先追加 `export_created`，再原子写入分类
  manifest。已封存 run 的导出必须在创建 `exports` 目录或文件前以 `dependency_error`
  拒绝，且不得产生封存后副作用。
- 清理在未封存审计事务内先写入 `purge_completed`，再删除 scoped data；若已封存则拒绝，
  从而保证不会为清理破坏 manifest 的不可变性。

## 人工复核

验收提交前运行：

```powershell
npm run lint
npm run build
npm test
npm run check:repository
git diff --check
git status --short
```

随后可用已构建 CLI 对新临时目录手动执行 `smoke --root <temporary-root>`。预期输出包含
UUID `runId`、`manifestValid: true` 和 `F4: feature_not_available`；命令结束后删除该临时
目录。该手动检查不接触真实外部系统或业务数据。