# F6 Workbook Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让“使用F6分析报告”触发受治理的 F0-F6 workbook 全流程，并汇总每个 Feature 的验证输出。

**Architecture:** 新增独立 `f6-analysis` agent skill 管理交互和阶段状态；复用现有 workflow CLI 作为确定性执行器。显式 `feature6` CLI 继续只执行 artifact-driven F6，不承担 VS Code 多选和图片观察。

**Tech Stack:** Markdown agent skill、Node.js 24、TypeScript、Vitest、Zod、npm workspaces。

**Spec:** `docs/superpowers/specs/2026-08-18-f6-workbook-orchestration-design.md`

## Global Constraints

- 不新增或暗示独立 `workflow:f0`。
- F1/F2 必须保持 selection 和 confirmed execution 两阶段握手。
- F3 必须是 local-only，禁止隐式 ADO。
- F5 新 image mode 只创建 `f5-image-observation-v2`。
- F6 必须消费同一 run 的 F2/F3/F4/F5 roots 和第二次确认的精确 worksheet set。
- 无受控 supplier/datum/cost evidence 时保留 `insufficient_evidence` 和 `not_computed`。
- source workbook 只读；所有 artifacts 均为 confidential。

---

### Task 1: F6 Skill Contract

**Files:**
- Create: `scripts/f6-skill.test.mjs`
- Create: `.github/skills/f6-analysis/SKILL.md`

**Interfaces:**
- Consumes: 现有五个 workflow CLI command shapes 和 `vscode_askQuestions`。
- Produces: user-invocable `f6-analysis` skill，支持 workbook 和 existing F6 artifact 两种模式。

- [ ] **Step 1: Write the failing skill contract test**

测试要求 frontmatter 包含三个触发语；allowed commands 只允许两条 F2、F3、F4、两条 F5 和 F6；正文按 W0-W10 排序，并包含两次 worksheet gate、F5 v2、F6 evidence gate、逐 Feature 输出汇总和 existing-artifact fast path。

- [ ] **Step 2: Run test to verify RED**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts scripts/f6-skill.test.mjs`

Expected: FAIL because `.github/skills/f6-analysis/SKILL.md` does not exist.

- [ ] **Step 3: Implement the skill**

创建严格 frontmatter 和 W0-W10 协议。Allowed commands 必须逐字为：

```text
npm run workflow:f2:excel -- <ta-workbook-path>
npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm
npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]
npm run workflow:f4 -- --f2-report <f2-output-dir>/Feature2-Report.json
npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]
npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --image-observations <artifact-path>
npm run workflow:f6 -- <f2-output-dir> <f3-output-dir> <f4-output-dir> <f5-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]
```

F6 optional evidence flags只作为最后一条命令的受控扩展描述，不增加不完整 command shape。

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts scripts/f6-skill.test.mjs`

Expected: PASS.

### Task 2: Governance Registration

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: repository test that asserts F6 registration

**Interfaces:**
- Consumes: `getFeatureStatus("F6")`。
- Produces: F6 acceptance checks `f6-skill-contract-check`、`f0-f6-real-workbook-flow`、`f6-composed-report-check`。

- [ ] **Step 1: Locate and extend the F6 registration test**

断言 F6 为 `available`、classification 为 `confidential`，并包含三个新 acceptance checks。

- [ ] **Step 2: Run governance test to verify RED**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/governance`

Expected: FAIL because F6 registration lacks the checks.

- [ ] **Step 3: Add the acceptance checks**

只扩展 F6 `acceptanceChecks`，不改变 contracts、status 或 external prerequisites。

- [ ] **Step 4: Run governance test to verify GREEN**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts packages/governance`

Expected: PASS.

### Task 3: Workflow Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/governance/feature-register.md`

**Interfaces:**
- Consumes: approved skill behavior and existing CLI command shapes。
- Produces: 中英文一致的入口、阶段、证据门和输出说明。

- [ ] **Step 1: Add documentation assertions to the skill test**

要求 README 和中英文 flow 文档都出现“使用F6分析报告”、F0-F6 顺序、两次 worksheet confirmation、local-only F3、F5 v2 和 F6 evidence gates。

- [ ] **Step 2: Run test to verify RED**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts scripts/f6-skill.test.mjs`

Expected: FAIL on missing documentation markers.

- [ ] **Step 3: Update documentation**

说明自然语言由 agent skill 编排，显式 CLI 保持 artifact-driven；列出每个 Feature 输出并注明不自动运行 ADO。

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts scripts/f6-skill.test.mjs scripts/workflow-docs.test.mjs`

Expected: PASS.

### Task 4: End-to-End Verification

**Files:**
- Test: `scripts/f6-skill.test.mjs`
- Test: `apps/cli/src/commands/feature6.test.ts`
- Test: `apps/cli/src/commands/feature6.security.test.ts`
- Test: `scripts/f6-full-flow.test.mjs`

**Interfaces:**
- Consumes: complete skill, governance registration and existing F6 CLI。
- Produces: fresh verification evidence for release readiness。

- [ ] **Step 1: Run focused verification**

Run: `npm exec -- vitest run --workspace vitest.workspace.ts scripts/f6-skill.test.mjs apps/cli/src/commands/feature6.test.ts apps/cli/src/commands/feature6.security.test.ts scripts/f6-full-flow.test.mjs`

Expected: PASS with no failures.

- [ ] **Step 2: Build the repository**

Run: `npm run build -- --force`

Expected: exit code 0.

- [ ] **Step 3: Run the complete test suite**

Run: `npm test`

Expected: all test files pass; environment-dependent symlink tests may remain explicitly skipped.

- [ ] **Step 4: Inspect tracked changes**

Run: `git status --short`

Expected: only the skill, tests, governance entry and documentation planned above are modified; confidential acceptance artifacts remain ignored.