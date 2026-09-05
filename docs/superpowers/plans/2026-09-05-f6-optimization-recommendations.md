# Feature 6 优化建议与报告链接实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让模型基于每个 worksheet 的受治理证据判断应调整 nominal、mean shift、system specification 或 tolerance，由确定性 F6 计算量化方案，并在 Web 与 VS Code 的最终 Agent 输出中强制展示已验证报告链接。

**Architecture:** 以版本化 v2 输入扩展 F6，不改变 v1 语义；模型输出结构化 adjustment assessment，不输出优化数值，F6 optimizer 将 assessment 和 caller-authorized targets 映射到既有 F4 scenario override。最终报告通过 current revision 的 artifact reference 进入 Agent turn，再由 Web 和 VS Code 两个宿主渲染为可点击入口。

**Tech Stack:** TypeScript、Node.js ESM、Zod、React、VS Code Extension API、Vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-05-f6-optimization-recommendations-design.md`

## Global Constraints

- 不修改 F1、F2、F3、F4、F5 或 F7 的业务行为、artifact contract 和工作流顺序。
- 不调整 monorepo package/app 结构，不移动现有目录，不进行无关重构。
- 不修改 F4 数学定义；F6 只调用既有 calculation kernel 和 scenario override。
- 模型只能判断 adjustment class、优先级、理由和 Factor 身份，不能生成 nominal、mean、specification 或 tolerance 数值。
- 未经 caller authorization 不得改变 system specification。
- 只有 current revision、current review context、`validated: true` 且 hash 校验通过的 `f6_report` 可以显示。
- 每个行为变更先写失败测试并确认以预期原因失败，再写最小实现。
- 如果实现需要突破上述边界，停止并请求用户确认。

---

### Task 1: 定义 F6 v2 输入与模型判断契约

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/contracts/src/f8-contracts.test.ts`

**Interfaces:**
- Produces: `f6ModelInterpretationV1ArtifactSchema`、`f6ModelInterpretationV2ArtifactSchema` 和兼容读取两版的 `f6ModelInterpretationArtifactSchema`。
- Produces: `f6AnalysisContextV1Schema`、`f6AnalysisContextV2Schema` 和兼容 union。
- Produces: `f6OptimizationTargetsV1Schema`、`f6OptimizationTargetsV2Schema` 和兼容 union。
- Produces: v2 adjustment class、assessment、target 和 TypeScript inferred types。
- Produces: 可表达 factor-only 或 system-only override 的 F6 scenario evidence contract。

- [ ] **Step 1: 为模型 adjustment assessment 写失败测试**

在 `contracts.test.ts` 增加一个完整 v2 fixture，要求每个 worksheet 恰好包含四个唯一类别：

```ts
optimizationAssessment: [
  { adjustmentClass: "factor_nominal", disposition: "RECOMMENDED", priority: 1, rationale: "Center the stack through the controlled locating factor.", factor: factorIdentity, evidenceReferences: [f4Reference] },
  { adjustmentClass: "system_mean_shift", disposition: "CONSIDER", priority: 2, rationale: "The governed mean is off center.", evidenceReferences: [f4Reference] },
  { adjustmentClass: "system_specification", disposition: "INSUFFICIENT_EVIDENCE", priority: 3, rationale: "Requirement authority is absent.", evidenceReferences: [f5Reference] },
  { adjustmentClass: "factor_tolerance", disposition: "RECOMMENDED", priority: 4, rationale: "Variance is concentrated.", factor: factorIdentity, evidenceReferences: [f4Reference] },
]
```

同时断言缺类别、重复类别、重复 priority、错误 Factor identity、空理由、未知字段和任意 numeric override 字段均失败；v1 fixture 继续成功。

- [ ] **Step 2: 运行 contract 测试并确认 RED**

Run: `npx vitest run packages/contracts/src/contracts.test.ts`

Expected: FAIL，因为 v2 interpretation schema 和 assessment 类型尚不存在。

- [ ] **Step 3: 为 Analysis Context v2 与 Optimization Targets v2 写失败测试**

覆盖：

```ts
engineeringNarrative: "Assembly preload and cosmetic flushness must both be protected."
```

以及三类新 target：

```ts
{ targetType: "factor_nominal", factor, nominalValue: 1.25, unit: "mm" }
{ targetType: "system_mean_shift", systemIdentity, target: { targetMean: 0.02, unit: "mm" } }
{ targetType: "system_specification", systemIdentity, lowerSpecLimit: -0.1, upperSpecLimit: 0.2, unit: "mm" }
```

断言 mean target 的 `targetMean` 与 `resultingAdditionalMeanShift` 互斥，spec 至少包含一侧且与 baseline 合成后满足 `lower < upper`，Factor/unit/baseline identity 漂移均失败，v1 仍成功。

- [ ] **Step 4: 运行新增测试并确认 RED**

Run: `npx vitest run packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.test.ts`

Expected: FAIL，指出新版本 literal、target union 或 system-only scenario evidence 不受支持。

- [ ] **Step 5: 实现最小 v1/v2 schema 与类型导出**

保留 v1 strict schema；新增 v2 strict schema；顶层读取 schema 使用 discriminated union。`optimizationAssessment` 不定义任何数值 override。调整 scenario evidence refinement 为：`factorOverrides.length > 0 || systemSpecification !== undefined`。

- [ ] **Step 6: 运行 contract 测试并确认 GREEN**

Run: `npx vitest run packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.test.ts`

Expected: PASS。

- [ ] **Step 7: 提交 Task 1**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.ts packages/contracts/src/f8-contracts.test.ts
git commit -m "feat(f6): define governed optimization assessments"
```

### Task 2: 校验和传递版本化 F6 输入

**Files:**
- Modify: `scripts/f6-artifact-test-fixture.mjs`
- Modify: `scripts/f6-artifact-loader.mjs`
- Modify: `scripts/f6-artifact-loader.test.mjs`
- Modify: `scripts/run-f6-full-validation.mjs`
- Modify: `scripts/run-f6-full-validation.test.mjs`
- Modify: `packages/workflow-runners/src/types.ts`
- Modify: `packages/workflow-runners/src/f6.ts`
- Modify: `packages/workflow-runners/src/f6.test.ts`
- Modify: `.github/skills/design-optimization/SKILL.md`
- Modify: `scripts/f6-skill.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 v1/v2 union schemas。
- Produces: `loadF6ArtifactBundle()` 返回已校验的 v1/v2 context、targets 和 model interpretation。
- Produces: `runF6Optimization()` 把完整 model interpretation 传给 optimizer，而不只传 decision。

- [ ] **Step 1: 写 loader 和 runner 失败测试**

增加 v2 fixtures，断言 loader：

- 校验 exact worksheet set、baseline、Factor、unit、source hash 和四类 assessment。
- soft-reject 非法模型判断，保留 deterministic fallback。
- `system_mean_shift` 和 `system_specification` 不访问不存在的 `target.factor`。
- runner 将 `loaded.modelInterpretation` 原样传给 `createOptimization`。

- [ ] **Step 2: 运行 focused tests 并确认 RED**

Run: `npx vitest run scripts/f6-artifact-loader.test.mjs scripts/run-f6-full-validation.test.mjs packages/workflow-runners/src/f6.test.ts`

Expected: FAIL，因为 loader 只识别 v1，runner 未传递模型判断。

- [ ] **Step 3: 实现版本化 loader 与 runner 透传**

复用现有 containment、symlink、hash 和 identity 校验。新增版本分支时不得弱化 v1 校验；model interpretation 失败继续记录 `REJECTED`，不阻断 F6。

- [ ] **Step 4: 更新 Design Optimization skill contract**

W8 改为生成 v2，并明确四类 assessment、模型不得填数值、每个 worksheet 隔离、soft rejection fallback。W8A/W8B 接受 v1/v2，并保留两个独立确认。W9/W10 加入 adjustment assessment 和最终报告链接硬要求。

- [ ] **Step 5: 运行 focused tests 并确认 GREEN**

Run: `npx vitest run scripts/f6-artifact-loader.test.mjs scripts/run-f6-full-validation.test.mjs packages/workflow-runners/src/f6.test.ts scripts/f6-skill.test.mjs`

Expected: PASS。

- [ ] **Step 6: 提交 Task 2**

```powershell
git add scripts/f6-artifact-test-fixture.mjs scripts/f6-artifact-loader.mjs scripts/f6-artifact-loader.test.mjs scripts/run-f6-full-validation.mjs scripts/run-f6-full-validation.test.mjs packages/workflow-runners/src/types.ts packages/workflow-runners/src/f6.ts packages/workflow-runners/src/f6.test.ts .github/skills/design-optimization/SKILL.md scripts/f6-skill.test.mjs
git commit -m "feat(f6): validate model-directed optimization inputs"
```

### Task 3: 将模型判断映射到确定性 F4-backed 方案

**Files:**
- Modify: `packages/workbook-catalog/src/f6-optimization.ts`
- Modify: `packages/workbook-catalog/src/f6-optimization.test.ts`
- Modify: `packages/workbook-catalog/src/f6-scenario-adapter.test.ts`

**Interfaces:**
- Consumes: v2 `optimizationAssessment` 和 v1/v2 caller targets。
- Produces: `scenarioForTarget()` 对 nominal、mean shift 和 specification 的 scenario mapping。
- Produces: adjustment class 顺序稳定的 F6 options。

- [ ] **Step 1: 写三个新增 target 的失败测试**

使用真实 `calculateF6Scenario()` 断言：

- `factor_nominal` 只修改绑定 Factor 的 `nominalValue`。
- `system_mean_shift.targetMean` 被确定性转换为 `additionalMeanShift`。
- `system_specification` 只修改 caller-authorized 的 LSL/USL。
- baseline request 和 F4 结果保持可复算，输入对象不被 mutation。

- [ ] **Step 2: 运行 optimizer tests 并确认 RED**

Run: `npx vitest run packages/workbook-catalog/src/f6-scenario-adapter.test.ts packages/workbook-catalog/src/f6-optimization.test.ts`

Expected: FAIL，因为 `scenarioForTarget()` 不识别新 target。

- [ ] **Step 3: 实现最小 target-to-scenario mapping**

只修改 F6 optimizer/adapter 的组装逻辑。不得修改 `packages/workbook-catalog/src/calculation.ts` 或 calculation kernel。system-only scenario 必须产生完整 scenario evidence。

确定性求值规则固定为：

- 模型推荐 `factor_nominal` 且绑定唯一 Factor、caller 未提供具体值时，以规格中心 `targetMean = (LSL + USL) / 2` 为目标，将 `targetMean - baselineMean` 应用到该 Factor 的 baseline nominal；最终结果必须由 F4 scenario 重算验证。
- caller 提供 `factor_nominal.nominalValue` 时使用 caller-authorized 值，不使用模型文本中的数字。
- caller 提供 `system_mean_shift.targetMean` 时，计算 `resultingAdditionalMeanShift = baselineAdditionalMeanShift + targetMean - baselineMean`。
- 模型推荐 `system_mean_shift` 且 caller 未提供具体值时，使用同一规格中心公式生成 centering scenario。
- `system_specification` 没有 caller-authorized 数值时只产生 clarification，不生成 scenario。
- `factor_tolerance` 没有 caller target 时继续使用当前 Top contributor policy 的受控 ratios。

- [ ] **Step 4: 写模型选择与类别顺序失败测试**

断言：

- 只有 `RECOMMENDED` 和具备确定性输入的 `CONSIDER` 类别进入候选集。
- `INSUFFICIENT_EVIDENCE` 产生 clarification，不生成伪数值。
- 类别顺序固定为 nominal、mean shift、specification、tolerance。
- 类别内继续使用现有 deterministic rank/tie-break。
- 没有有效 v2 assessment 时保留现有 Top 3 fallback。
- 没有 caller-authorized specification target 时不生成 specification override。

- [ ] **Step 5: 运行新测试并确认 RED**

Run: `npx vitest run packages/workbook-catalog/src/f6-optimization.test.ts`

Expected: FAIL，因为 optimizer 尚未消费 assessment 或按类别排序。

- [ ] **Step 6: 实现 assessment filtering、fallback 和稳定排序**

把类别选择与数值生成分开：assessment 只选择候选 builder；builder 使用 solver 或 caller target；最终 option 保留 scenario calculation reference、evidence、feasibility 和 delta。

- [ ] **Step 7: 运行 optimizer tests 并确认 GREEN**

Run: `npx vitest run packages/workbook-catalog/src/f6-scenario-adapter.test.ts packages/workbook-catalog/src/f6-optimization.test.ts`

Expected: PASS。

- [ ] **Step 8: 提交 Task 3**

```powershell
git add packages/workbook-catalog/src/f6-optimization.ts packages/workbook-catalog/src/f6-optimization.test.ts packages/workbook-catalog/src/f6-scenario-adapter.test.ts
git commit -m "feat(f6): calculate model-directed optimization options"
```

### Task 4: 在 F6 报告和 manifest 中呈现建议依据

**Files:**
- Modify: `scripts/f6-report.mjs`
- Modify: `scripts/f6-report.test.mjs`
- Modify: `scripts/f6-final-report.mjs`
- Modify: `scripts/f6-final-report.test.mjs`
- Modify: `scripts/f6-full-flow.test.mjs`
- Modify: `packages/workflow-runners/src/existing-f6.ts`
- Modify: `packages/workflow-runners/src/existing-f6.test.ts`
- Modify: `scripts/verify-current-f6.mjs`
- Modify: `scripts/verify-current-f6.test.mjs`

**Interfaces:**
- Consumes: Task 3 的 ordered options、assessment、clarifications 和 scenario evidence。
- Produces: 五件套 hash-bound artifact，报告中明确模型判断、确定性数值、requirement change 和 ME review。

- [ ] **Step 1: 写 report projection 失败测试**

断言最终报告逐 worksheet 显示：模型推荐类别与理由、确定性 option 数值、类别顺序、specification 的 requirement-change 标签、无法求值类别的 clarification。断言报告不渲染模型提供的任何非 placeholder 数值。

- [ ] **Step 2: 运行 report tests 并确认 RED**

Run: `npx vitest run scripts/f6-report.test.mjs scripts/f6-final-report.test.mjs`

Expected: FAIL，因为 projection 尚未消费 adjustment assessment。

- [ ] **Step 3: 实现最小 report projection**

复用现有 Markdown sanitizer、calculation claim substitution 和 product-language 投影；不从 Markdown 反向解析 disposition 或 option。

- [ ] **Step 4: 写 full-flow 与 existing-artifact 兼容测试**

覆盖五文件、manifest-last、三个 optional input decision/hash、v1 历史 artifact、v2 新 artifact、reportSummary 和 actual content hash。

- [ ] **Step 5: 运行兼容测试并确认 RED，再实现最小版本支持**

Run: `npx vitest run scripts/f6-full-flow.test.mjs packages/workflow-runners/src/existing-f6.test.ts scripts/verify-current-f6.test.mjs`

Expected before implementation: FAIL；实现后再次运行并要求 PASS。

- [ ] **Step 6: 提交 Task 4**

```powershell
git add scripts/f6-report.mjs scripts/f6-report.test.mjs scripts/f6-final-report.mjs scripts/f6-final-report.test.mjs scripts/f6-full-flow.test.mjs packages/workflow-runners/src/existing-f6.ts packages/workflow-runners/src/existing-f6.test.ts scripts/verify-current-f6.mjs scripts/verify-current-f6.test.mjs
git commit -m "feat(f6): report governed optimization recommendations"
```

### Task 5: 接通 Workbench 的 F6 输入门控与五件套注册

**Files:**
- Modify: `packages/workbench/src/state-machine.ts`
- Modify: `packages/workbench/src/state-machine.test.ts`
- Modify: `packages/workbench/src/scenario-draft.ts`
- Modify: `packages/workbench/src/scenario-draft.test.ts`
- Modify: `apps/workbench-server/src/server.ts`
- Modify: `apps/workbench-server/src/server.test.ts`
- Modify: `apps/workbench-server/src/production-stage-runner.ts`
- Modify: `apps/workbench-server/src/production-stage-runner.test.ts`

**Interfaces:**
- Consumes: v2 context/targets 与现有 F6 runner result paths。
- Produces: 显式的两个独立 decision、已授权输入引用、五个 F6 artifact references。

- [ ] **Step 1: 写显式门控失败测试**

断言 F5 完成后不能由 `applyAutomaticStageDecisions()` 连续写入两个 `not_provided`；Analysis Context 和 Optimization Targets 必须分别形成可审计 decision。确认 payload 必须绑定当前 artifact path/hash 或明确 `not_provided`。

- [ ] **Step 2: 运行 state/server tests 并确认 RED**

Run: `npx vitest run packages/workbench/src/state-machine.test.ts apps/workbench-server/src/server.test.ts`

Expected: FAIL，因为 server 当前自动跳过两个门控且不持久化输入引用。

- [ ] **Step 3: 实现 F6 范围内的门控持久化和 runner 传参**

仅扩展既有 `confirm_analysis_context`、`confirm_optimization_targets` 路径；不改变 F1-F5/F7 状态或命令。移除这两个 F6 决策的隐式连续自动确认。

- [ ] **Step 4: 写五件套 artifact 注册失败测试**

断言 production F6 注册 `Feature6-Optimization.json`、`Feature6-Optimization.md`、`Feature6-Report.md`、`Feature6-Run-Summary.json`、`manifest.json`，每个引用携带 current revision、content hash、validated flag 和 review context；projection 作为宿主衍生 artifact 保留。

- [ ] **Step 5: 运行 production runner test 并确认 RED**

Run: `npx vitest run apps/workbench-server/src/production-stage-runner.test.ts`

Expected: FAIL，因为当前只注册三个 artifact。

- [ ] **Step 6: 实现五件套注册并确认 GREEN**

Run: `npx vitest run packages/workbench/src/state-machine.test.ts packages/workbench/src/scenario-draft.test.ts apps/workbench-server/src/server.test.ts apps/workbench-server/src/production-stage-runner.test.ts`

Expected: PASS。

- [ ] **Step 7: 提交 Task 5**

```powershell
git add packages/workbench/src/state-machine.ts packages/workbench/src/state-machine.test.ts packages/workbench/src/scenario-draft.ts packages/workbench/src/scenario-draft.test.ts apps/workbench-server/src/server.ts apps/workbench-server/src/server.test.ts apps/workbench-server/src/production-stage-runner.ts apps/workbench-server/src/production-stage-runner.test.ts
git commit -m "feat(f6): govern workbench optimization inputs"
```

### Task 6: 强制 Agent turn 保存当前报告引用

**Files:**
- Modify: `packages/agent-runtime/src/runtime.ts`
- Modify: `packages/agent-runtime/src/runtime.test.ts`
- Modify: `apps/workbench-server/src/routes/host-actions.ts`
- Modify: `apps/workbench-server/src/routes/conversation.test.ts`
- Test: `packages/conversation/src/conversation-store.test.ts`

**Interfaces:**
- Produces: canonical current report selector。
- Produces: completion assistant turn 中不可被模型移除的 `artifact_reference`、`relatedArtifactIds` 和 `open_report` action。

- [ ] **Step 1: 写 deterministic/model/replay 失败测试**

对 current validated report 断言：

```ts
expect(turn.content).toContainEqual({
  kind: "artifact_reference",
  artifactId: "f6-report:7",
  label: "Feature6-Report.md",
});
expect(turn.relatedArtifactIds).toEqual(["f6-report:7"]);
expect(result.actions).toContainEqual({
  type: "open_report",
  target: "/report/current",
  label: "打开当前报告",
});
```

分别覆盖 deterministic response、模型省略 action、模型伪造 action、model failure、stored-turn replay 和 host-action 第二写入路径。stale revision、unvalidated、review-context mismatch 均不得产生引用。

- [ ] **Step 2: 运行 agent tests 并确认 RED**

Run: `npx vitest run packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/routes/conversation.test.ts packages/conversation/src/conversation-store.test.ts`

Expected: FAIL，因为 assistant turn 当前固定 `relatedArtifactIds: []`。

- [ ] **Step 3: 实现 canonical report projection**

复用 current review-context 选择规则。先 canonicalize deterministic result，再合并安全模型文本；报告 action/reference 始终由 snapshot 生成，不接受模型提供的 artifact ID 或 label。

- [ ] **Step 4: 运行 agent tests 并确认 GREEN**

Run: `npx vitest run packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/routes/conversation.test.ts packages/conversation/src/conversation-store.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交 Task 6**

```powershell
git add packages/agent-runtime/src/runtime.ts packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/routes/host-actions.ts apps/workbench-server/src/routes/conversation.test.ts packages/conversation/src/conversation-store.test.ts
git commit -m "fix(f6): persist canonical final report references"
```

### Task 7: 在 Web 与 VS Code 窗口呈现可点击报告链接

**Files:**
- Modify: `apps/workbench-server/src/routes/artifacts.ts`
- Modify: `apps/workbench-server/src/security.test.ts`
- Modify: `apps/workbench-web/src/components/ConversationPane.tsx`
- Modify: `apps/workbench-web/src/components/ConversationPane.test.tsx`
- Modify: `apps/workbench-web/src/components/TaAssistantPanel.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.test.tsx`
- Modify: `apps/vscode-extension/src/participant.ts`
- Modify: `apps/vscode-extension/src/participant.test.ts`
- Modify: `apps/vscode-extension/src/extension.ts`
- Modify: `apps/vscode-extension/src/extension.test.ts`

**Interfaces:**
- Consumes: Task 6 的 canonical `artifact_reference` 和 `open_report` action。
- Produces: Web authenticated `<a>`、主界面固定 report link、VS Code Chat 的 `Feature6-Report.md` 入口。

- [ ] **Step 1: 写安全 Markdown 下载失败测试**

断言 `f6_report` 返回 `text/markdown; charset=utf-8`、安全 `Feature6-Report.md` filename，并校验 persisted `contentHash`。hash mismatch 返回 `409`；cross-session、stale path、symlink/junction 继续拒绝。

- [ ] **Step 2: 运行 server security test 并确认 RED**

Run: `npx vitest run apps/workbench-server/src/security.test.ts`

Expected: FAIL，因为 `f6_report` 当前按 JSON MIME 返回且持久化路径未执行 hash 比对。

- [ ] **Step 3: 实现最小 artifact endpoint 修复并确认 GREEN**

Run: `npx vitest run apps/workbench-server/src/security.test.ts`

Expected: PASS。

- [ ] **Step 4: 写 Web 链接失败测试**

断言 conversation 中的 `artifact_reference` 渲染为 `/api/sessions/{sessionId}/artifacts/{artifactId}` 链接；主工程界面在 current report 存在时固定显示同一 artifact ID；不存在时不伪造链接。

- [ ] **Step 5: 运行 Workbench Web tests 并确认 RED**

Run: `npx vitest run --project workbench-web apps/workbench-web/src/components/ConversationPane.test.tsx apps/workbench-web/src/components/EngineeringWorkspace.test.tsx`

Expected: FAIL，因为 conversation 当前只显示 `Evidence:` 文本，主界面未挂载 report link。

- [ ] **Step 6: 实现 Web 链接并确认 GREEN**

复用 `artifactUrl()` 和 `ReportLink`，不引入新 router 或改变页面结构。

Run: `npx vitest run --project workbench-web apps/workbench-web/src/components/ConversationPane.test.tsx apps/workbench-web/src/components/EngineeringWorkspace.test.tsx`

Expected: PASS。

- [ ] **Step 7: 写 VS Code 最终入口失败测试**

断言存在 canonical report action 时，Chat stream 总是显示标题为 `Feature6-Report.md` 的受控按钮；扩展命令只打开 active loopback Workbench 的 current report surface，不接受任意 URL/path。

- [ ] **Step 8: 运行 extension tests 并确认 RED，再实现并确认 GREEN**

Run: `npx vitest run apps/vscode-extension/src/participant.test.ts apps/vscode-extension/src/extension.test.ts`

Expected before implementation: FAIL；实现后再次运行并要求 PASS。

- [ ] **Step 9: 提交 Task 7**

```powershell
git add apps/workbench-server/src/routes/artifacts.ts apps/workbench-server/src/security.test.ts apps/workbench-web/src/components/ConversationPane.tsx apps/workbench-web/src/components/ConversationPane.test.tsx apps/workbench-web/src/components/TaAssistantPanel.tsx apps/workbench-web/src/components/EngineeringWorkspace.tsx apps/workbench-web/src/components/EngineeringWorkspace.test.tsx apps/vscode-extension/src/participant.ts apps/vscode-extension/src/participant.test.ts apps/vscode-extension/src/extension.ts apps/vscode-extension/src/extension.test.ts
git commit -m "fix(f6): show final report links in agent windows"
```

### Task 8: 完成跨层验收与范围审计

**Files:**
- Modify only if a failing Issue #97 assertion requires a local correction: `test/f8-e2e/*`
- Modify only if required for the governed verification fixture: `scripts/verify-current-f6.test.mjs`

**Interfaces:**
- Consumes: Tasks 1-7 的完整行为。
- Produces: Issue #97 的回归证据与无越界审计结果。

- [ ] **Step 1: 增加完成态端到端失败测试**

使用 current revision 的真实 F6 report artifact，断言 Web 与 VS Code 投影指向同一 artifact ID/content hash；至少覆盖三 worksheet、模型类别判断、未授权 specification 不变和最终报告链接。

- [ ] **Step 2: 运行 Issue #97 focused suite**

```powershell
npx vitest run packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.test.ts
npx vitest run packages/workbook-catalog/src/f6-scenario-adapter.test.ts packages/workbook-catalog/src/f6-optimization.test.ts
npx vitest run scripts/f6-artifact-loader.test.mjs scripts/f6-report.test.mjs scripts/f6-final-report.test.mjs scripts/f6-full-flow.test.mjs scripts/f6-skill.test.mjs
npx vitest run packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.test.ts
npx vitest run packages/agent-runtime/src/runtime.test.ts packages/conversation/src/conversation-store.test.ts
npx vitest run apps/workbench-server/src/production-stage-runner.test.ts apps/workbench-server/src/security.test.ts apps/workbench-server/src/server.test.ts
npx vitest run --project workbench-web
npx vitest run apps/vscode-extension/src/participant.test.ts apps/vscode-extension/src/extension.test.ts
```

Expected: 全部 PASS，无 unhandled rejection 或新增 warning。

- [ ] **Step 3: 运行全仓静态验证**

```powershell
npm run build -- --force
npm run lint
```

Expected: 两个命令 exit code 0。

- [ ] **Step 4: 运行当前受治理 F6 验证**

Run: `node scripts/verify-current-f6.mjs`

Expected: exit code 0，并验证五件套、input decisions、source hashes、report summary 和 final report hash。

- [ ] **Step 5: 审计修改范围**

Run: `git diff --name-only main...HEAD`

Expected: 仅出现本计划列出的 F6 文件、必要 shared contract 文件和宿主报告链接文件；不得出现 F1-F5/F7 业务实现或目录结构移动。

- [ ] **Step 6: 请求代码审查并处理发现**

以 `main` 为 base、当前 HEAD 为 target，要求 reviewer 特别检查：模型是否能注入数值、spec 是否可能未授权变化、stale report 是否可能显示、以及是否误改其他 Feature。

- [ ] **Step 7: 提交验收修正**

```powershell
git add test/f8-e2e scripts/verify-current-f6.test.mjs
git commit -m "test(f6): verify optimization recommendations and report links"
```

仅在确有修正文件时执行该提交；没有修正时保持工作区干净。

## Task 8 执行报告（2026-09-05）

- 问题定位：`scripts/f6-final-report.test.mjs` 用例 `renders structured recommendation basis for v2 model assessments without trusting model numeric prose` 依赖了陈旧 fixture/dist 副作用。`loadRealF6Inputs` 在测试改写 `modelInterpretation.optimizationAssessment` 前已构建 F6 optimization，而用例未显式注入 `system_specification_target_required` clarification。
- 最小修复：仅修改测试，在渲染前向 `inputs.f6Optimization.worksheets[0].clarifications` 显式追加一条合法 clarification：
  - `reasonCode: "system_specification_target_required"`
  - `requiredInputs: ["system_specification_target"]`
  - `evidenceReferences: [inputs.f6Optimization.provenance.f4Reference]`
- 生产代码变更：无。
- 断言策略：未放宽任何现有断言，继续要求报告仅渲染受治理结构化澄清依据。

已执行验证：

1. `npx vitest run scripts/f6-final-report.test.mjs` → PASS（29 passed）。
2. `npx vitest run scripts/f6-full-flow.test.mjs packages/workflow-runners/src/existing-f6.test.ts scripts/verify-current-f6.test.mjs` → PASS（71 passed, 1 skipped）。