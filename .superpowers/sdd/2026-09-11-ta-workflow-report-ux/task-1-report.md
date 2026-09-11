# Task 1 Report

## Status

- Task: Task 1 实现代理完成 `简化标准工作流门控`。
- Branch: `fix/ta-workflow-report-ux`
- Commit message: `feat: simplify governed TA workflow prompts`
- Untracked guardrail: 根目录异常未跟踪文件 `` 未修改、未删除、未提交。

## RED

- Test command:

```bash
npx vitest run packages/workbench/src/state-machine.test.ts apps/workbench-server/src/server.test.ts scripts/f6-skill.test.mjs
```

- Observed failures:
  - `packages/workbench/src/state-machine.test.ts`
    - `f4_running` 完成后仍进入 `image_decision_required`，未进入标准 `f5_running`。
  - `apps/workbench-server/src/server.test.ts`
    - 标准路径仍表现为旧门控流，未满足免提交 `confirm_image_decision` / `confirm_analysis_context` / `confirm_optimization_targets` 的新期望。
  - `scripts/f6-skill.test.mjs`
    - Skill contract 仍描述用户触发的图片评估门控，未切换为 workflow-owned internal image evaluation。

## Implementation

- `packages/workbench/src/state-machine.ts`
  - 仅调整 `resolveCompletionState()` 的标准路径流转：`f4_running -> f5_running`，`f5_running -> f6_running`。
  - 在 `f5_running` 完成后自动追加两条 `NOT_PROVIDED` F6 decision references，保留历史 decision states、commands、schema 与 CLI 兼容。
- `apps/workbench-server/src/server.ts`
  - 移除标准路径自动提交 `confirm_image_decision` 的逻辑；保留历史命令面与其他 gate 处理。
- `.github/skills/design-optimization/SKILL.md`
  - 将标准 workbook flow 的 W6 改为 workflow-owned internal image evaluation，保留 language gate、两次 worksheet gate、required model interpretation、Top 3 policy、ADO confirmation、PDF 治理。
- `.github/skills/result-interpretation/SKILL.md`
  - 明确当 Design Optimization 拥有端到端 workbook workflow 时，不再额外增加 caller image-confirmation gate。
- `.github/skills/ta-assist-agent/SKILL.md`
  - 明确 internal image evaluation 位于 optional Analysis Context / Optimization Targets gates 之前，并保留 PDF governed publication 要求。
- Direct neighbor required by harness:
  - `packages/workbench/dist/state-machine.js`
  - 原因：`apps/workbench-server` 通过 `@ai-assist/workbench` package export 消费 `dist`，若不同步则 server tests 仍走旧状态机实现。

## GREEN

- Final verification command:

```bash
npx vitest run packages/workbench/src/state-machine.test.ts apps/workbench-server/src/server.test.ts scripts/f6-skill.test.mjs
```

- Final result:
  - `Test Files  3 passed (3)`
  - `Tests  108 passed (108)`

## Files

- Modified:
  - `.github/skills/design-optimization/SKILL.md`
  - `.github/skills/result-interpretation/SKILL.md`
  - `.github/skills/ta-assist-agent/SKILL.md`
  - `apps/workbench-server/src/server.test.ts`
  - `apps/workbench-server/src/server.ts`
  - `packages/workbench/src/state-machine.test.ts`
  - `packages/workbench/src/state-machine.ts`
  - `packages/workbench/dist/state-machine.js`
  - `scripts/f6-skill.test.mjs`

## Commit

- HEAD before commit: `010ffdbd164d2a7ffa3718e575e321ed4420162f`
- Implementation commit: `7a654072947e5d1a248cd33e82942067989647ba` (`feat: simplify governed TA workflow prompts`)
- Follow-up commit for ignored report/dist artifacts: pending

## Scope Self-Review

- 保留了历史 `confirm_image_decision` / `confirm_analysis_context` / `confirm_optimization_targets` command shapes 与 decision states，未删除 schema、allowlists、materializers、CLI inputs。
- 未修改 calculation kernel。
- 未进入 Task 3 / 4 / 5。
- Skill 修改保留了 language gate、两次 worksheet gate、required model interpretation、Top 3、ADO confirmation、PDF 治理。
- server 标准路径测试仅收束到 Task 1 所要求的 legacy confirmation non-submission，不把 Task 2 mixed-outcome 的完整内部评估收尾错误地扩展成 Task 1 义务。

## Concerns

- `packages/workbench/dist/state-machine.js` 是为当前 package export harness 做的直接邻居同步；后续若运行正式 build，应确认生成产物与源码一致。