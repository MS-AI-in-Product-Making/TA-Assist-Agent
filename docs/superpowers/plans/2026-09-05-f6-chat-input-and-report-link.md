# F6 聊天输入、模型证据连续性与最终报告链接实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户只通过聊天自然语言补充 Analysis Context 和 Optimization Targets，修复 F5 图片观察到 F6 模型解读的 evidence continuity，并保证成功的 Agent 最终答复始终包含可点击的 Design Optimization Report。

**Architecture:** 模型只产生不含身份、hash 和计算结果的受限 proposal；共享 materializer 使用当前 validated F2/F4/F5 lineage 生成 identity-bound immutable draft，再经过两个独立预览与确认门控进入 F6。F6 自动继承当前 F5 已发布的 observation copy，所有报告入口只指向当前 validated、hash-matched 的最终 Markdown。

**Tech Stack:** TypeScript、Node.js ESM、Zod、React、Fastify、SQLite、VS Code Extension API、Vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-05-f6-chat-input-and-report-link-design.md`

## Global Constraints

- 用户不得被要求创建、理解或提供 Analysis Context/Optimization Targets JSON 文件或路径。
- 模型只能产生 proposal；不得产生 workbook hash、table ID、source row、baseline identity、artifact path/hash、受治理计算值或 session command。
- 所有 worksheet、Factor、unit 和 baseline identity 必须由当前 validated lineage exact/unique matching 后补齐。
- Analysis Context 与 Optimization Targets 保持两个独立预览和确认门控。
- specification 未获得明确数值和独立确认时不得产生 scenario。
- F6 只读消费 F5 已发布 observation copy，不修改 F5 行为或 artifact。
- 不修改 F4 calculation kernel，不改变 F1-F5/F7 的业务顺序，不移动现有目录。
- 成功的 Agent 最终答复必须包含可点击的 `Design Optimization Report`；不满足 current revision、review context、validated 和 hash 条件时不得显示。
- 每项行为变更先写失败测试并观察预期 RED，再实现最小 GREEN。

---

### Task 1: 定义聊天 proposal、draft 与确认契约

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/contracts/src/f8-contracts.test.ts`

**Interfaces:**
- Produces: `f6AnalysisContextProposalSchema` / `F6AnalysisContextProposal`。
- Produces: `f6OptimizationTargetsProposalSchema` / `F6OptimizationTargetsProposal`。
- Produces: `f6InputProposalSchema`、`f6InputClarificationSchema`、`f6MaterializedDraftSchema`、`f6MaterializationResultSchema`。
- Produces: `f8PendingF6InputDraftSchema`，以及 Context/Targets 专用确认 payload：`decision + draftId + draftHash`。

- [ ] **Step 1: 写 proposal contract 失败测试**

在 `contracts.test.ts` 创建两个严格 proposal fixture：

```ts
const contextProposal = {
  proposalVersion: "f6-analysis-context-proposal-v1",
  userText: "橡胶压缩会影响装配间隙，500g load 是关键工况。",
  worksheetSelectors: ["gap w rubber_TPoverload500g"],
  analysisObjectKind: "GAP",
  functionalBoundary: "TP bracket to battery gap",
  operatingConditions: ["500g load"],
  clarifications: [],
};

const targetsProposal = {
  proposalVersion: "f6-optimization-targets-proposal-v1",
  userText: "优先评估 mean shift，再看 battery flatness tolerance。",
  directions: [
    { adjustmentClass: "system_mean_shift", worksheetSelector: "gap w rubber_TPoverload500g" },
    { adjustmentClass: "factor_tolerance", worksheetSelector: "gap w rubber_TPoverload500g", factorSelector: "battery flatness" },
  ],
  clarifications: [],
};
```

断言 proposal 拒绝 `workbookContentHash`、`tableId`、`sourceRow`、`baselineIdentity`、`artifactPath`、`contentHash`、`cpk`、`deltaCpk` 和未知字段。允许用户明确提供 `numericTarget: { value, unit, field }`，但不允许模型生成 calculation result。

- [ ] **Step 2: 运行 proposal tests 并确认 RED**

Run: `npx vitest run packages/contracts/src/contracts.test.ts`

Expected: FAIL，因为 proposal/materialization schemas 尚不存在。

- [ ] **Step 3: 写 pending draft 与确认 payload 失败测试**

在 `f8-contracts.test.ts` 断言：

```ts
pendingAnalysisContextDraft: {
  draftId: "f6-context-draft-1",
  kind: "analysis_context",
  inputRevision: 7,
  reviewContextId: "a".repeat(64),
  artifactId: "f6-context-draft:7",
  contentHash: "b".repeat(64),
  status: "preview_required",
}
```

Context/Targets confirm command 必须携带 matching `draftId` 和 `draftHash`；`not_provided`/`decline` 不得携带 draft；客户端路径或 decisionReference 被拒绝。Host model outcome 可以携带严格 `proposal`，但不能携带 command。

- [ ] **Step 4: 运行 F8 contract tests 并确认 RED**

Run: `npx vitest run packages/contracts/src/f8-contracts.test.ts`

Expected: FAIL，因为 snapshot draft reference 和专用确认 payload 尚不存在。

- [ ] **Step 5: 实现最小 strict schemas 与类型导出**

Proposal 使用 `.strict()`；numeric target 使用 discriminated union：

```ts
type ExplicitNumericTarget =
  | { field: "factor_nominal"; value: number; unit: string }
  | { field: "target_mean"; value: number; unit: string }
  | { field: "additional_mean_shift"; value: number; unit: string }
  | { field: "lower_spec_limit" | "upper_spec_limit"; value: number; unit: string }
  | { field: "upper_tolerance" | "lower_tolerance"; value: number; unit: string };
```

Draft schema 只保存 server-issued identity。确认 payload 不接受路径/hash 之外的客户端治理数据。

- [ ] **Step 6: 运行 contract tests 并确认 GREEN**

Run: `npx vitest run packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.test.ts`

Expected: PASS。

- [ ] **Step 7: 提交 Task 1**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.ts packages/contracts/src/f8-contracts.test.ts
git commit -m "feat(f6): define chat input proposal contracts"
```

### Task 2: 实现共享 F6 输入 materializer

**Files:**
- Create: `packages/workflow-runners/src/f6-input-materializer.ts`
- Create: `packages/workflow-runners/src/f6-input-materializer.test.ts`
- Modify: `packages/workflow-runners/src/index.ts`
- Modify: `packages/workflow-runners/src/types.ts`

**Interfaces:**
- Consumes: Task 1 proposal/materialization contracts。
- Produces: `materializeF6AnalysisContext(proposal, lineage)`。
- Produces: `materializeF6OptimizationTargets(proposal, lineage)`。
- Produces: `materializeF6InputProposal(proposal, lineage)`。
- Produces: `F6InputMaterializationLineage`，只包含当前 validated F2/F4/F5 投影。

- [ ] **Step 1: 写 Analysis Context materialization 失败测试**

用真实最小 F2/F4/F5 fixture 断言：

- 用户文字进入 `engineeringNarrative`。
- worksheet selector exact/unique 匹配。
- baseline identity 由当前 F4 填充。
- 未提供的 requirements/loop 使用空集合或省略，不推断。
- unknown worksheet、重复 selector、过期 review context 返回 `proposal_ambiguous` / `draft_identity_mismatch` clarification，不产出 artifact。

- [ ] **Step 2: 运行 materializer test 并确认 RED**

Run: `npx vitest run packages/workflow-runners/src/f6-input-materializer.test.ts`

Expected: FAIL，因为 materializer 尚不存在。

- [ ] **Step 3: 写 Targets materialization 失败测试**

覆盖：

- 纯 `system_mean_shift` 方向进入 `qualitativeDirections`，不生成 numeric `targets`。
- 明确 `battery flatness + upper_tolerance + 0.25 mm` 唯一绑定 table/sourceRow/unit 并生成 v2 target。
- Factor 重名、unit 缺失、worksheet 不在 scope、spec 没说明 LSL/USL、上下限非法时只返回 clarification。
- 客户端伪造 identity/hash 无法进入 materializer 输入。

- [ ] **Step 4: 运行新增测试并确认 RED**

Run: `npx vitest run packages/workflow-runners/src/f6-input-materializer.test.ts`

Expected: FAIL，指出 Targets materialization 尚未实现。

- [ ] **Step 5: 实现纯 materializer**

实现 exact/unique helper：

```ts
resolveWorksheet(selector, lineage): ResolvedWorksheet | F6InputClarification
resolveFactor(worksheet, selector, unit): ResolvedFactor | F6InputClarification
```

Materializer 不做 I/O、不执行 F6、不计算 Cpk。输出 artifact payload 与完整 sanitized preview data；artifact path/hash 由调用方写入后补充。

- [ ] **Step 6: 运行 materializer tests 并确认 GREEN**

Run: `npx vitest run packages/workflow-runners/src/f6-input-materializer.test.ts`

Expected: PASS。

- [ ] **Step 7: 提交 Task 2**

```powershell
git add packages/workflow-runners/src/f6-input-materializer.ts packages/workflow-runners/src/f6-input-materializer.test.ts packages/workflow-runners/src/index.ts packages/workflow-runners/src/types.ts
git commit -m "feat(f6): materialize governed chat inputs"
```

### Task 3: 修复 F5 observation 到 F6 的证据连续性

**Files:**
- Modify: `scripts/f6-artifact-loader.mjs`
- Modify: `scripts/f6-artifact-loader.test.mjs`
- Modify: `scripts/f6-artifact-test-fixture.mjs`
- Modify: `scripts/f6-full-flow.test.mjs`
- Create: `scripts/f6-model-observation-regression.test.mjs`
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

**Interfaces:**
- Consumes: 当前 F5 root 的 manifest、run summary 和 observation copy。
- Produces: F6 `sourceReferences.imageObservation`，以及精确 observation rejection reason。
- Preserves: 历史无 observation 的 F5 run。

- [ ] **Step 1: 写真实失败回归测试**

用受控 fixture 复现：F5 manifest 声明 observation，模型解读绑定同一 hash，但 F6 未显式传 observation。断言当前代码将 model interpretation 记为 `REJECTED identity_mismatch`，这是预期 RED。

- [ ] **Step 2: 运行回归测试并确认 RED**

Run: `npx vitest run scripts/f6-model-observation-regression.test.mjs`

Expected: FAIL，因为目标行为应为 `CALLER_AUTHORIZED` 且 `sources.imageObservation` 存在。

- [ ] **Step 3: 写 observation 边界失败测试**

覆盖：

- manifest 声明但文件缺失 -> `observation_evidence_missing`。
- summary hash 与 bytes 不同 -> `observation_hash_mismatch`。
- workbook/worksheet/image identity 漂移 -> `observation_identity_mismatch`。
- model interpretation 绑定不同 observation -> soft `model_interpretation_evidence_mismatch`。
- F5 没有 observation entry -> 继续接受历史路径。
- 显式兼容 observation 与 F5 copy 不同 -> fail closed。

- [ ] **Step 4: 运行 loader tests 并确认 RED**

Run: `npx vitest run scripts/f6-artifact-loader.test.mjs scripts/f6-full-flow.test.mjs`

Expected: FAIL，因为 F5 copy 尚未自动加载、精确 reason 尚不存在。

- [ ] **Step 5: 实现 F5 observation 自动继承**

读取当前 F5 manifest 的固定 artifact entry 和 run summary hash，使用现有安全读取函数；完成 schema/identity replay 后设置：

```js
optionalRequestFields.imageObservationReference = loaded.reference;
sourceReferences.imageObservation = loaded.reference;
```

显式兼容入口存在时必须与自动来源的 bytes hash 和 worksheet identity 相同。

- [ ] **Step 6: 运行全部证据测试并确认 GREEN**

Run: `npx vitest run packages/contracts/src/contracts.test.ts scripts/f6-artifact-loader.test.mjs scripts/f6-full-flow.test.mjs scripts/f6-model-observation-regression.test.mjs`

Expected: PASS；回归 fixture 的 model interpretation 变为 `CALLER_AUTHORIZED`。

- [ ] **Step 7: 提交 Task 3**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts scripts/f6-artifact-loader.mjs scripts/f6-artifact-loader.test.mjs scripts/f6-artifact-test-fixture.mjs scripts/f6-full-flow.test.mjs scripts/f6-model-observation-regression.test.mjs
git commit -m "fix(f6): preserve image observation evidence lineage"
```

### Task 4: 实现 Server-owned immutable drafts 与独立确认

**Files:**
- Create: `apps/workbench-server/src/routes/f6-inputs.ts`
- Create: `apps/workbench-server/src/routes/f6-inputs.test.ts`
- Modify: `apps/workbench-server/src/server.ts`
- Modify: `apps/workbench-server/src/routes/conversation.ts`
- Modify: `apps/workbench-server/src/routes/conversation.test.ts`
- Modify: `packages/workbench/src/state-machine.ts`
- Modify: `packages/workbench/src/state-machine.test.ts`
- Modify: `packages/workbench/src/session-store-side-tables.ts`
- Modify: `packages/workbench/src/session-store.test.ts`

**Interfaces:**
- Consumes: Task 2 materializer 和 Task 1 draft contracts。
- Produces: `POST /api/sessions/:sessionId/f6-input-drafts`。
- Produces: `GET /api/sessions/:sessionId/f6-input-drafts/:draftId`。
- Produces: current snapshot 的两个独立 pending draft references。

- [ ] **Step 1: 写 server materialization 失败测试**

测试使用当前 validated review context，POST context/targets proposal 后断言：

- UUID managed path 位于 session managed root。
- artifact 原子写入、read-back schema-valid、hash 与 bytes 一致。
- response 只给 draft ID、sanitized preview、clarifications，不暴露物理路径。
- stale revision、ambiguous review context、伪造 proposal identity 和 cross-session 访问被拒绝。

- [ ] **Step 2: 运行 route tests 并确认 RED**

Run: `npx vitest run apps/workbench-server/src/routes/f6-inputs.test.ts`

Expected: FAIL，因为 route 和 managed writer 尚不存在。

- [ ] **Step 3: 实现 materialize/read-preview route**

复用当前 managed artifact root、safe open/realpath/inode 检查和 immutable write pattern。写入成功后把 `F8PendingF6InputDraft` 持久化到 side table，并投影到 snapshot。

- [ ] **Step 4: 写确认绑定失败测试**

断言：

- Context confirm 只能消费 matching current context draft；成功后才进入 targets gate。
- Targets confirm 只能消费 matching current targets draft；成功后才进入 F6。
- draft ID/hash/revision/reviewContext 任一漂移 -> `draft_identity_mismatch` 或 `draft_hash_mismatch`。
- `not_provided`/`decline` 不需要 draft，且两个 gate 仍独立。
- 客户端 decisionReference/path 被 schema 拒绝。

- [ ] **Step 5: 运行 state/store tests 并确认 RED**

Run: `npx vitest run packages/workbench/src/state-machine.test.ts packages/workbench/src/session-store.test.ts apps/workbench-server/src/server.test.ts`

Expected: FAIL，因为 state 仍信任旧 decision reference。

- [ ] **Step 6: 实现 pending draft 状态与确认**

删除客户端路径信任。确认时 server 从 side table 解析 artifact reference/hash，再写入 F6 decision ledger。Context/Targets 保持不同 kind，禁止跨用。

- [ ] **Step 7: 运行 Task 4 tests 并确认 GREEN**

Run: `npx vitest run packages/workbench/src/state-machine.test.ts packages/workbench/src/session-store.test.ts apps/workbench-server/src/routes/f6-inputs.test.ts apps/workbench-server/src/routes/conversation.test.ts apps/workbench-server/src/server.test.ts`

Expected: PASS。

- [ ] **Step 8: 提交 Task 4**

```powershell
git add apps/workbench-server/src/routes/f6-inputs.ts apps/workbench-server/src/routes/f6-inputs.test.ts apps/workbench-server/src/server.ts apps/workbench-server/src/routes/conversation.ts apps/workbench-server/src/routes/conversation.test.ts packages/workbench/src/state-machine.ts packages/workbench/src/state-machine.test.ts packages/workbench/src/session-store-side-tables.ts packages/workbench/src/session-store.test.ts
git commit -m "feat(f6): persist governed chat input drafts"
```

### Task 5: 接通 Web 与 Agent 的自然语言输入体验

**Files:**
- Create: `apps/workbench-web/src/components/F6InputGate.tsx`
- Create: `apps/workbench-web/src/components/F6InputGate.test.tsx`
- Modify: `apps/workbench-web/src/api.ts`
- Modify: `apps/workbench-web/src/app.tsx`
- Modify: `apps/workbench-web/src/components/ConversationPane.tsx`
- Modify: `apps/workbench-web/src/components/ConversationPane.test.tsx`
- Modify: `packages/agent-runtime/src/runtime.ts`
- Modify: `packages/agent-runtime/src/runtime.test.ts`
- Modify: `apps/workbench-server/src/routes/host-actions.ts`
- Modify: `apps/workbench-server/src/routes/conversation.test.ts`
- Modify: `.github/skills/design-optimization/SKILL.md`
- Modify: `scripts/f6-skill.test.mjs`

**Interfaces:**
- Consumes: Task 4 draft APIs。
- Produces: 自然语言输入、clarification、preview、confirm/decline/not-provided UI。
- Produces: model host outcome 的 optional strict `proposal`，不包含 command。

- [ ] **Step 1: 写 Web gate 失败测试**

Context state 显示：

```text
补充分析背景
直接描述产品功能、装配关系、工况、功能边界或关注点
```

Targets state 显示：

```text
补充优化方向
描述希望优先评估 nominal、mean shift、specification 或 tolerance
```

断言页面不出现 `JSON`、`文件路径`、`artifact path`。输入后先显示 clarifications/preview；只有 preview-ready 才启用确认。两个 gate 不同时显示确认按钮。

- [ ] **Step 2: 运行 Web tests 并确认 RED**

Run: `npx vitest run --project workbench-web apps/workbench-web/src/components/F6InputGate.test.tsx apps/workbench-web/src/components/ConversationPane.test.tsx`

Expected: FAIL，因为 gate UI/API 尚不存在。

- [ ] **Step 3: 实现 Web API 与 F6InputGate**

使用现有 panel/field/button 样式，不新增页面路由。Chat text 提交 proposal materialization；preview 渲染 worksheet、Factor、数值、unit、Requirement Change 和 clarification。

- [ ] **Step 4: 写 Agent proposal 失败测试**

断言模型响应只能携带 strict proposal；runtime/server 不接受模型 command、artifact path、hash 或 confirmation。Proposal 到达 server 后仅创建 pending draft，不能直接改变 state 或运行 F6。

- [ ] **Step 5: 运行 Agent/server tests 并确认 RED**

Run: `npx vitest run packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/routes/conversation.test.ts`

Expected: FAIL，因为 model outcome 尚不支持受限 proposal。

- [ ] **Step 6: 实现 proposal 转交与产品文案**

更新 pending action 文案为“补充/确认分析背景”和“补充/确认优化方向”。更新 Design Optimization W8A/W8B：不询问 JSON path；使用聊天自然语言、共享 materializer、完整预览与两个独立确认。

- [ ] **Step 7: 运行 Task 5 tests 并确认 GREEN**

Run: `npx vitest run --project workbench-web apps/workbench-web/src/components/F6InputGate.test.tsx apps/workbench-web/src/components/ConversationPane.test.tsx apps/workbench-web/src/app.test.tsx; npx vitest run packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/routes/conversation.test.ts scripts/f6-skill.test.mjs`

Expected: PASS，且 product language surface 不出现 JSON path 请求。

- [ ] **Step 8: 提交 Task 5**

```powershell
git add apps/workbench-web/src/components/F6InputGate.tsx apps/workbench-web/src/components/F6InputGate.test.tsx apps/workbench-web/src/api.ts apps/workbench-web/src/app.tsx apps/workbench-web/src/components/ConversationPane.tsx apps/workbench-web/src/components/ConversationPane.test.tsx packages/agent-runtime/src/runtime.ts packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/routes/host-actions.ts apps/workbench-server/src/routes/conversation.test.ts .github/skills/design-optimization/SKILL.md scripts/f6-skill.test.mjs
git commit -m "feat(f6): collect governed inputs through chat"
```

### Task 6: 强制所有成功入口呈现最终报告链接

**Files:**
- Modify: `apps/cli/src/commands/feature6.ts`
- Modify: `apps/cli/src/commands/feature6.test.ts`
- Modify: `packages/agent-runtime/src/runtime.ts`
- Modify: `packages/agent-runtime/src/runtime.test.ts`
- Modify: `apps/workbench-server/src/routes/host-actions.ts`
- Modify: `apps/workbench-server/src/routes/conversation.test.ts`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.test.tsx`
- Modify: `apps/workbench-web/src/components/ConversationPane.test.tsx`
- Modify: `apps/vscode-extension/src/participant.test.ts`
- Modify: `apps/vscode-extension/src/extension.test.ts`
- Modify: `.github/skills/design-optimization/SKILL.md`
- Modify: `scripts/f6-skill.test.mjs`

**Interfaces:**
- Consumes: validated `finalReportMdPath` / current `f6_report` artifact。
- Produces: CLI `report: C:\TA\run\Feature6-Report.md` 形式的绝对路径输出。
- Produces: final Agent Markdown link 或 canonical artifact/action。

- [ ] **Step 1: 写 CLI report path 失败测试**

断言成功输出包含：

```text
report: C:\TA\run\Feature6-Report.md
```

并拒绝不存在、linked、publish root 外或与 result output root 不一致的 path。

- [ ] **Step 2: 运行 CLI tests 并确认 RED**

Run: `npx vitest run apps/cli/src/commands/feature6.test.ts`

Expected: FAIL，因为当前只打印 F6 output directory。

- [ ] **Step 3: 实现安全 final report path 输出**

只使用 runner 返回且重新验证的 `finalReportMdPath`。不从目录拼接猜测。

- [ ] **Step 4: 写最终答复链接 contract 测试**

覆盖：

- Skill W10 明确要求 `[Design Optimization Report](test/demo-output/f6-runs/run-id/Feature6-Report.md)` 形式的 workspace-relative link。
- Runtime/host turn 的 artifact reference 与 open action 不可被模型删除。
- Web link 与 VS Code action 指向同一 current artifact ID/hash。
- stale、unvalidated、hash mismatch、非 final report kind 均不显示。
- successful final answer without link 被测试判失败。

- [ ] **Step 5: 运行链接 tests 并确认 RED**

Run: `npx vitest run scripts/f6-skill.test.mjs packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/routes/conversation.test.ts --project workbench-web apps/workbench-web/src/components/EngineeringWorkspace.test.tsx apps/workbench-web/src/components/ConversationPane.test.tsx apps/vscode-extension/src/participant.test.ts apps/vscode-extension/src/extension.test.ts`

Expected: 新的 direct-final-answer/CLI 链接断言失败。

- [ ] **Step 6: 实现链接硬约束并确认 GREEN**

Skill 使用 existing-artifact validator 的 final path 转换 workspace link。Workbench/VS Code 复用现有 canonical action，不增加外部 URL 能力。

- [ ] **Step 7: 提交 Task 6**

```powershell
git add apps/cli/src/commands/feature6.ts apps/cli/src/commands/feature6.test.ts packages/agent-runtime/src/runtime.ts packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/routes/host-actions.ts apps/workbench-server/src/routes/conversation.test.ts apps/workbench-web/src/components/EngineeringWorkspace.test.tsx apps/workbench-web/src/components/ConversationPane.test.tsx apps/vscode-extension/src/participant.test.ts apps/vscode-extension/src/extension.test.ts .github/skills/design-optimization/SKILL.md scripts/f6-skill.test.mjs
git commit -m "fix(f6): require clickable final report delivery"
```

### Task 7: 跨层验收与真实工作簿回归

**Files:**
- Modify: `test/f8-e2e/engineering-workspace.spec.ts`
- Modify: `test/f8-e2e/server.mjs`
- Modify only if required by regression fixture: `scripts/f6-model-observation-regression.test.mjs`

**Interfaces:**
- Consumes: Tasks 1-6 完整行为。
- Produces: 用户不接触 JSON、模型解读被接受、最终链接可点击的端到端证据。

- [ ] **Step 1: 写端到端失败测试**

流程覆盖：

1. session 进入 Context gate。
2. 用户输入自然语言，得到 preview，单独确认。
3. session 进入 Targets gate。
4. 用户输入 qualitative direction，得到 preview，单独确认。
5. F6 自动继承 F5 observation，模型解读为 `CALLER_AUTHORIZED`。
6. 最终 Agent turn 包含 `Design Optimization Report` artifact/action。
7. Web 点击和 VS Code action 打开同一 artifact ID/hash。
8. 页面与 Agent 问题中不出现 JSON/path 要求。

- [ ] **Step 2: 运行 E2E 并确认 RED**

Run: `npx playwright test test/f8-e2e/engineering-workspace.spec.ts --grep "materializes F6 chat inputs and opens the final report"`

Expected: FAIL，直到全部跨层接口接通。

- [ ] **Step 3: 完成最小 fixture 接线并确认 GREEN**

只扩展 E2E server fixture 的当前 F2/F4/F5 lineage 与 draft endpoints；不复制生产 materializer 逻辑。

- [ ] **Step 4: 运行 focused 验证矩阵**

```powershell
npm run build -- --force
npx vitest run packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.test.ts
npx vitest run packages/workflow-runners/src/f6-input-materializer.test.ts packages/workflow-runners/src/f6.test.ts
npx vitest run scripts/f6-artifact-loader.test.mjs scripts/f6-full-flow.test.mjs scripts/f6-model-observation-regression.test.mjs scripts/f6-skill.test.mjs
npx vitest run packages/workbench/src/state-machine.test.ts packages/workbench/src/session-store.test.ts
npx vitest run apps/workbench-server/src/routes/f6-inputs.test.ts apps/workbench-server/src/routes/conversation.test.ts apps/workbench-server/src/server.test.ts --maxWorkers=1
npx vitest run --project workbench-web
npx vitest run packages/agent-runtime/src/runtime.test.ts apps/vscode-extension/src/participant.test.ts apps/vscode-extension/src/extension.test.ts apps/cli/src/commands/feature6.test.ts
```

Expected: 全部 PASS。

- [ ] **Step 5: 运行确定性全仓验证**

Run: `npm test -- --maxWorkers=1`

Expected: exit code 0；记录测试文件、通过和跳过数量。

- [ ] **Step 6: 运行真实工作簿回归**

使用 `test/Maera_gap_TP_brkt_and _battery_20260305V1 - test.xlsx` 的新受治理 run，选择同一 worksheet 范围并提供一段 Context、一个 qualitative Target：

- F5 observation 自动进入 F6 sources。
- 模型解读 decision 为 `CALLER_AUTHORIZED`。
- final report section 4 包含模型解读与 adjustment assessment。
- report validator 为 `accepted`。
- 最终答复包含可点击 link。

- [ ] **Step 7: 审计范围并请求最终 review**

Run: `git diff --name-only main...HEAD`

Expected: 仅本计划列出的 F6/shared-host 文件，无 F1-F5/F7 业务实现或 F4 kernel。

- [ ] **Step 8: 提交验收测试**

```powershell
git add test/f8-e2e/engineering-workspace.spec.ts test/f8-e2e/server.mjs scripts/f6-model-observation-regression.test.mjs
git commit -m "test(f6): verify chat inputs and final report delivery"
```