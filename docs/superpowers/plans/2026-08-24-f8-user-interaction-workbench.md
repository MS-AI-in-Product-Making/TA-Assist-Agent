# F8 User Interaction Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建本地 TA Assist 工作台，让 VS Code、CLI 和浏览器共享同一 TA session，对 F0-F6 进行完整受治理分析，并提供单 Draft 公差 What-if；F7 保持明确不可执行占位。

**Architecture:** 新增版本化 F8 contracts、可恢复 SessionStore、ConversationStore 和 F0-F7 状态机；CLI、VS Code Extension 和 Web 通过 loopback Fastify server 调用同一套结构化 workflow runner facade。React/Vite Web 只渲染 snapshot 和提交结构化 command；F4 内核负责所有 baseline/What-if 数学，ADO 仍由 VS Code Host Bridge 经 Surface MCP 执行。

**Tech Stack:** Node.js 24、TypeScript strict ESM、Zod v3、Vitest v3、Fastify v5、React 19、Vite 7、VS Code Chat Participant API、Playwright、现有 OOXML/F0-F6 artifact pipeline

**Spec:** `docs/superpowers/specs/2026-08-24-f8-user-interaction-workbench-design.md`

## Global Constraints

- 分支固定为 `user/xumax/F8-user-interact`。
- 源 workbook 永远只读；不得覆盖、回写或导出修改副本。
- 浏览器、CLI 和 VS Code 不得解析 stdout、Markdown 或 terminal 文本控制流程。
- F0 没有 standalone workflow；只调用受控 knowledge-base APIs。
- F0-F6 必须严格保持现有 W0-W10 顺序、两次 worksheet 选择和全部独立确认。
- F3 ADO 只允许 Surface MCP；发布方式与 `Confirm write` 必须分开，写一次并回读一次。
- F4 `excel-ta-v1` 是 baseline 和 What-if 的唯一数学真源。
- What-if Draft 标记为 `WHAT_IF`；只有 tolerance diff 可转为现有 `f6-optimization-targets-v1`，nominal/mean shift 不得晋级当前 F6。
- F7 产品运行时固定为 `feature_not_available / in_development`；保留合同和页面，不调用 mock runner 生成工程结果。
- Web server 只监听 `127.0.0.1`；浏览器 token 不得进入 URL、localStorage 或日志。
- 每个 production behavior 必须先有对应失败测试并观察到预期 RED。
- Phase 1-3 是内部里程碑；Task 14 全部通过才达到 F8 MVP release gate。

## Package Dependency DAG

```text
contracts
├─ conversation
├─ workbench
├─ workflow-runners -> knowledge-base + workbook-catalog + audit + memory
└─ agent-runtime -> conversation + workbench

workbench-server -> conversation + workbench + workflow-runners + agent-runtime
workbench-web -> contracts only at build time; runtime uses HTTP/SSE DTOs
cli -> agent-runtime + workbench-server client
vscode-extension -> contracts + agent-runtime + Surface adapter + workbench-server client
```

- `workbench` 不依赖 `workflow-runners`；server 通过注入的 stage executor 驱动状态机。
- `agent-runtime` 不依赖 Fastify、`vscode` 或 Surface adapter；模型和 host actions 都通过接口注入。
- Web 使用单独 bundler tsconfig，不加入 NodeNext composite reference；其他新增 Node packages 加入根 `tsconfig.json` references。

---

### Task 1: Define F8 Session, Conversation, Host and F7 Placeholder Contracts

**Files:**
- Create: `packages/contracts/src/f8-contracts.ts`
- Create: `packages/contracts/src/f8-contracts.test.ts`
- Create: `packages/contracts/src/f7-handoff-contracts.ts`
- Create: `packages/contracts/src/f7-handoff-contracts.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: existing `typedErrorSchema`, worksheet selection schemas and F0-F6 artifact contracts.
- Produces: `f8SessionCommandSchema`, `f8SessionSnapshotSchema`, `f8SessionEventSchema`, `conversationTurnSchema`, `hostActionRequestSchema`, `hostActionClaimSchema`, `hostActionResultSchema`, `f8ScenarioDraftSchema`, `f7PlaceholderStatusSchema`.
- F7 scope: only availability/status plus owner contract ID/version references; do not define measured fields, thresholds, preview result, or proposal payload before the F7 owner publishes them.

- [ ] **Step 1: Write failing strict-schema tests**

```ts
it("accepts an idempotent command and rejects unknown fields", () => {
  const command = {
    contractVersion: "f8-session-command-v1",
    sessionId: SESSION_ID,
    commandId: COMMAND_ID,
    expectedRevision: 3,
    command: "confirm_initial_scope",
    payload: { worksheetNames: ["AJ_GAP"], workbookHash: HASH },
  };
  expect(f8SessionCommandSchema.parse(command)).toEqual(command);
  expect(() => f8SessionCommandSchema.parse({ ...command, outputRoot: "C:/arbitrary" })).toThrow();
});

it("keeps F7 unavailable without a result payload", () => {
  expect(f7PlaceholderStatusSchema.parse({
    contractVersion: "f7-workbench-placeholder-v1",
    status: "feature_not_available",
    lifecycle: "in_development",
  })).toBeDefined();
  expect(() => f7PlaceholderStatusSchema.parse({
    contractVersion: "f7-workbench-placeholder-v1",
    status: "completed",
    measuredCpk: 1.2,
  })).toThrow();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/contracts/src/f8-contracts.test.ts packages/contracts/src/f7-handoff-contracts.test.ts
```

Expected: FAIL because the F8/F7 schemas are not exported.

- [ ] **Step 3: Implement discriminated unions and immutable DTOs**

Define exact top-level states in W0-W10 order:

```ts
export const f8SessionStateSchema = z.enum([
  "created", "workbook_required", "workbook_validating", "f0_validating", "f0_validated",
  "initial_scope_required", "f1_f2_running", "downstream_scope_required", "f3_running",
  "ado_decision_required", "ado_action_pending", "f4_running", "image_decision_required",
  "f5_running", "analysis_context_decision_required", "optimization_targets_decision_required",
  "f6_running", "review_required", "f7_import_required", "f7_preview_required", "f7_running",
  "feedback_review_required", "completed", "failed", "cancelled",
]);
```

Use `.strict()` on every API DTO. Define strict payload schemas for every command, including `upload_workbook`, `replace_workbook`, `confirm_initial_scope`, `confirm_downstream_scope`, ADO decisions, image decision, Context decision, Targets decision, retry, cancel and `complete_review`. Snapshot includes `inputRevision`, active attempt and immutable prior-run references. Scenario Draft is worksheet-scoped and not part of `f8SessionStateSchema`. F7 defines only this compatibility envelope:

```ts
export const f7PlaceholderStatusSchema = z.object({
  contractVersion: z.literal("f7-workbench-placeholder-v1"),
  status: z.literal("feature_not_available"),
  lifecycle: z.literal("in_development"),
  ownerInputContractId: z.string().min(1).optional(),
  ownerOutputContractId: z.string().min(1).optional(),
}).strict();
```

- [ ] **Step 4: Run contracts tests and build**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/contracts/src/f8-contracts.test.ts packages/contracts/src/f7-handoff-contracts.test.ts
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src
git commit -m "feat(f8): define workbench contracts"
```

---

### Task 2: Implement Recoverable SessionStore

**Files:**
- Create: `packages/workbench/package.json`
- Create: `packages/workbench/tsconfig.json`
- Create: `packages/workbench/src/index.ts`
- Create: `packages/workbench/src/managed-paths.ts`
- Create: `packages/workbench/src/session-store.ts`
- Create: `packages/workbench/src/session-store.test.ts`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: `F8SessionSnapshot`, `F8SessionCommand`, `F8SessionEvent` from Task 1.
- Produces: `createSessionStore(options)`, `openSessionStore(options)`, `SessionStore.applyCommand(command, reducer)`, `SessionStore.recordAttemptResult(result)`.

- [ ] **Step 1: Write failing CAS, idempotency and recovery tests**

```ts
it("applies a command once and recovers the same revision", async () => {
  const store = await createSessionStore({ rootDir, sessionId: SESSION_ID });
  const first = await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);
  const duplicate = await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);
  expect(duplicate).toEqual(first);

  const reopened = await openSessionStore({ rootDir, sessionId: SESSION_ID });
  expect(await reopened.readSnapshot()).toEqual(first);
});

it("rejects stale revisions and late worker results", async () => {
  await expect(store.applyCommand(commandAt(0, OTHER_COMMAND_ID), reducer)).rejects.toMatchObject({ code: "evidence_mismatch" });
  await expect(store.recordAttemptResult({ attemptId: OLD_ATTEMPT_ID, result: {} })).resolves.toMatchObject({ accepted: false });
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts packages/workbench/src/session-store.test.ts`

Expected: FAIL because `SessionStore` does not exist.

- [ ] **Step 3: Implement atomic snapshot and append-only logs**

Use Node.js 24 built-in `node:sqlite` with one database at `runtime/workbench/workbench.sqlite`. Enable WAL and foreign keys. Create tables `sessions`, `commands`, `events`, `stage_attempts`, `artifact_refs`, `scenario_drafts`, and `host_actions`.

```sql
BEGIN IMMEDIATE;
INSERT INTO commands(command_id, session_id, expected_revision, request_json, result_json)
VALUES (?, ?, ?, ?, NULL);
UPDATE sessions SET revision = revision + 1, snapshot_json = ?
WHERE session_id = ? AND revision = ?;
UPDATE commands SET result_json = ? WHERE command_id = ?;
COMMIT;
```

The command ID has a unique constraint. An accepted retry reads `result_json` and returns the original result. A stale revision causes the `UPDATE` row count to be zero and rolls back. Stage attempts only store immutable `runId`, manifest hash and artifact references in SessionStore; stage artifacts remain in separate RunStore/AuditStore roots.

Add transaction rollback tests by injecting failures after command insert, snapshot update and result update. Reopening the database must show either the entire committed transition or none of it.

- [ ] **Step 4: Run focused tests and build**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbench/src/session-store.test.ts
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbench tsconfig.json
git commit -m "feat(f8): add recoverable session store"
```

---

### Task 3: Implement Shared ConversationStore

**Files:**
- Create: `packages/conversation/package.json`
- Create: `packages/conversation/tsconfig.json`
- Create: `packages/conversation/src/index.ts`
- Create: `packages/conversation/src/conversation-store.ts`
- Create: `packages/conversation/src/conversation-store.test.ts`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: `ConversationTurn` from Task 1.
- Produces: `createConversationStore({rootDir})`, `appendTurn(turn, commandId)`, `readTurns(sessionId, {afterSequence})`, `advanceCursor(sessionId, consumerId, sequence)`.

- [ ] **Step 1: Write failing ordering and idempotency tests**

```ts
it("shares ordered turns across web, vscode, and cli", async () => {
  await store.appendTurn(turn("web", "user", 1), "web-command-1");
  await store.appendTurn(turn("vscode", "assistant", 2), "vscode-command-1");
  await store.appendTurn(turn("cli", "user", 3), "cli-command-1");
  expect((await store.readTurns(SESSION_ID, { afterSequence: 0 })).map(t => t.source))
    .toEqual(["web", "vscode", "cli"]);
});

it("does not duplicate a participant request retry", async () => {
  const original = await store.appendTurn(turn("vscode", "user", 1), COMMAND_ID);
  const retried = await store.appendTurn(turn("vscode", "user", 1), COMMAND_ID);
  expect(retried).toEqual(original);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts packages/conversation/src/conversation-store.test.ts`

Expected: FAIL because the package is absent.

- [ ] **Step 3: Implement append-only turn storage and cursors**

Persist only TA participant turns. Native `ChatContext.history` is never imported. Use a per-session lock, strict schema readback, monotonically increasing sequence, `turnId` uniqueness and command receipt idempotency. Cursor files are keyed by safe `consumerId`, for example `web:<browserId>` and `vscode:<extensionInstanceId>`.

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/conversation/src/conversation-store.test.ts
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/conversation tsconfig.json
git commit -m "feat(f8): add shared conversation store"
```

---

### Task 4: Implement F0-F7 Session State Machine and UI Projections

**Files:**
- Create: `packages/workbench/src/commands.ts`
- Create: `packages/workbench/src/attempts.ts`
- Create: `packages/workbench/src/state-machine.ts`
- Create: `packages/workbench/src/state-machine.test.ts`
- Create: `packages/workbench/src/projections.ts`
- Create: `packages/workbench/src/projections.test.ts`
- Modify: `packages/workbench/src/index.ts`

**Interfaces:**
- Consumes: Task 1 contracts and Task 2 SessionStore reducer contract.
- Produces: `reduceSessionCommand(snapshot, command)`, `acceptAttemptResult(snapshot, result)`, `projectActionQueue(snapshot)`, `projectFeatureLedger(snapshot)`.

- [ ] **Step 1: Write failing sequence and confirmation tests**

```ts
it("enforces the governed F4-F6 ordering", () => {
  expect(allowedCommands(snapshot("f4_running"))).not.toContain("confirm_analysis_context");
  expect(nextAfter("f4_running", "stage_completed")).toBe("image_decision_required");
  expect(nextAfter("f5_running", "stage_completed")).toBe("analysis_context_decision_required");
  expect(nextAfter("analysis_context_decision_required", "decline_analysis_context"))
    .toBe("optimization_targets_decision_required");
});

it("projects F7 as a non-executable placeholder", () => {
  expect(projectFeatureLedger(snapshot("review_required")).find(x => x.featureId === "F7"))
    .toMatchObject({ status: "feature_not_available", lifecycle: "in_development", actions: [] });
});

it("completes the MVP when F7 is unavailable without creating an F7 attempt", () => {
  const result = reduceSessionCommand(reviewSnapshotWithUnavailableF7(), completeReviewCommand());
  expect(result.state).toBe("completed");
  expect(result.featureLedger.F7).toMatchObject({ status: "feature_not_available" });
  expect(result.activeAttempt).toBeUndefined();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts packages/workbench/src/state-machine.test.ts packages/workbench/src/projections.test.ts`

Expected: FAIL because reducers and projections are absent.

- [ ] **Step 3: Implement allowlists and transition tables**

Encode transitions as exhaustive records keyed by state and command, not nested UI conditionals. Preserve these branches:

```text
F3 completed -> F4
F3 governance_required -> ADO decision -> terminal ADO outcome -> F4
F4 -> image decision -> F5 -> Context -> Targets -> F6 -> review
```

Use `commandId` receipt from SessionStore and `attemptId` CAS for running states. A failed state keeps the last successful immutable stage references and exposes retry only when `TypedError.retryable` is true. `replace_workbook` increments `inputRevision`, clears pending selections/attempts and downstream references from the active revision, and retains immutable prior-run references. `complete_review` checks F7 availability: unavailable records the placeholder outcome and transitions to `completed`; only a future compatible registered runner may enter `f7_import_required`.

- [ ] **Step 4: Run tests and build**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbench/src/state-machine.test.ts packages/workbench/src/projections.test.ts
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbench/src
git commit -m "feat(f8): govern workbench session states"
```

---

### Task 5: Create Structured Workflow Runner Facade for F0-F3

**Files:**
- Create: `packages/workflow-runners/package.json`
- Create: `packages/workflow-runners/tsconfig.json`
- Create: `packages/workflow-runners/src/index.ts`
- Create: `packages/workflow-runners/src/types.ts`
- Create: `packages/workflow-runners/src/error-normalizer.ts`
- Create: `packages/workflow-runners/src/error-normalizer.test.ts`
- Create: `packages/workflow-runners/src/f0.ts`
- Create: `packages/workflow-runners/src/f0.test.ts`
- Create: `packages/workflow-runners/src/f1-f2.ts`
- Create: `packages/workflow-runners/src/f1-f2.test.ts`
- Create: `packages/workflow-runners/src/f3.ts`
- Create: `packages/workflow-runners/src/f3.test.ts`
- Create: `packages/workflow-runners/src/f7-placeholder.ts`
- Create: `packages/workflow-runners/src/f7-placeholder.test.ts`
- Modify: `scripts/f2-excel-runner.mjs`
- Modify: `scripts/run-f3-full-validation.mjs`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: F0 APIs, `runF2ExcelWorkflow`, F1/F2 contracts, F3 core and current artifact loaders.
- Produces: `validateF0Capabilities`, `runF1F2Selection`, `runF1F2Confirmed`, `runF3Analysis`, `getF7PlaceholderStatus`.

- [ ] **Step 1: Write failing facade tests with dependency injection**

```ts
it("validates F0 without inventing a workflow artifact", async () => {
  await expect(validateF0Capabilities({ repositoryRoot }, fakeF0Dependencies()))
    .resolves.toEqual(expect.objectContaining({
      status: "completed",
      versions: ["v1", "internal-v1", "interpretation-rules-v1"],
      artifactRoot: undefined,
    }));
});

it("returns F7 unavailable and never calls a runner", async () => {
  const execute = vi.fn();
  expect(await getF7PlaceholderStatus({ execute })).toMatchObject({ status: "feature_not_available" });
  expect(execute).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts packages/workflow-runners/src`

Expected: FAIL because the facade package does not exist.

- [ ] **Step 3: Implement typed runner context and F0/F7 boundaries**

```ts
export interface RunContext {
  readonly attemptId: string;
  readonly repositoryRoot: string;
  readonly managedOutputRoot: string;
  readonly signal: AbortSignal;
  readonly emit: (event: GovernedRunnerEvent) => void;
}
```

Normalize all script errors to the nine existing `TypedErrorCode` values. Unknown errors become sanitized `internal_error`; identity/hash/manifest failures become non-retryable `evidence_mismatch`.

- [ ] **Step 4: Implement F1/F2 two-call facade and local F3**

Extract import-safe F2 selection/confirmed and F3 local orchestration into the package. `scripts/f2-excel-runner.mjs` and `scripts/run-f3-full-validation.mjs` become thin argument/JSON wrappers; the TS package must not import files from `scripts/`. `runF1F2Selection` validates `worksheetSelectionPromptSchema`. `runF1F2Confirmed` requires exact workbook hash and selected names, then validates complete F1/F2 roots and reports. `runF3Analysis` validates exact downstream scope and never publishes ADO.

- [ ] **Step 5: Run focused and regression tests**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workflow-runners/src scripts/f2-excel-runner.test.mjs scripts/f2-full-flow.test.mjs scripts/f3-full-flow.test.mjs
npm run build -- --force
```

Expected: PASS with existing scripts unchanged at this checkpoint.

- [ ] **Step 6: Commit**

```powershell
git add packages/workflow-runners scripts/f2-excel-runner.mjs scripts/run-f3-full-validation.mjs tsconfig.json
git commit -m "feat(f8): expose structured F0 to F3 runners"
```

---

### Task 6: Implement Leased Host Actions and Surface-Only ADO Bridge

**Files:**
- Create: `packages/workbench/src/host-actions.ts`
- Create: `packages/workbench/src/host-actions.test.ts`
- Modify: `packages/workbench/src/index.ts`

**Interfaces:**
- Consumes: Host action contracts, SessionStore and existing `SurfaceMcpDrawingGovernanceClient` adapter contract.
- Produces: `createHostAction`, `claimHostAction`, `completeHostAction`, `expireHostAction`.

- [ ] **Step 1: Write failing lease and write-once tests**

```ts
it("allows one host claim and rejects a second writer", async () => {
  const action = await createHostAction(surfaceValidateRequest());
  const claim = await claimHostAction(action.actionId, "vscode-1");
  await expect(claimHostAction(action.actionId, "vscode-2")).rejects.toMatchObject({ code: "prerequisite_not_ready" });
  await completeHostAction(resultFor(claim));
  await expect(completeHostAction(resultFor(claim))).rejects.toMatchObject({ code: "policy_denied" });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts packages/workbench/src/host-actions.test.ts`

Expected: FAIL because host actions do not exist.

- [ ] **Step 3: Implement prepare/claim/result with confirmation hash**

Validation action may return a sanitized complete preview. Write action requires a distinct action ID, exact `confirmationHash`, expected target version, an unexpired single-owner lease and terminal validation reference. A lost/expired write result moves to manual reconciliation; it must not retry automatically.

- [ ] **Step 4: Preserve F3 protocol tests**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbench/src/host-actions.test.ts packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts scripts/f3-skill.test.mjs
```

Expected: PASS with Surface-only, separate confirmations, write once and readback once unchanged.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbench/src
git commit -m "feat(f8): add leased Surface host bridge"
```

---

### Task 7: Add Structured F4-F6 Runners and Thin Script Wrappers

**Files:**
- Create: `packages/workflow-runners/src/f4.ts`
- Create: `packages/workflow-runners/src/f4.test.ts`
- Create: `packages/workflow-runners/src/f5.ts`
- Create: `packages/workflow-runners/src/f5.test.ts`
- Create: `packages/workflow-runners/src/f6.ts`
- Create: `packages/workflow-runners/src/f6.test.ts`
- Create: `packages/workflow-runners/src/existing-f6.ts`
- Create: `packages/workflow-runners/src/existing-f6.test.ts`
- Modify: `packages/workflow-runners/src/index.ts`
- Modify: `scripts/run-f4-full-validation.mjs`
- Modify: `scripts/run-f5-full-validation.mjs`
- Modify: `scripts/run-f6-full-validation.mjs`
- Modify: `apps/cli/src/commands/feature5.ts`
- Modify: `apps/cli/src/commands/feature6.ts`

**Interfaces:**
- Consumes: current F2/F3/F4/F5 artifact roots, exact downstream worksheet scope and optional confirmed Context/Targets.
- Produces: `runF4Calculation`, `runF5Interpretation`, `runF6Optimization`, `validateExistingF6` with structured results.

- [ ] **Step 1: Write failing structured-result tests**

```ts
it("keeps F4 extras outside downstream scope", async () => {
  const result = await runF4Calculation(requestWithReadySheets(["A", "B"]), context, dependencies);
  expect(result.acceptedCalculations.map(x => x.worksheetName)).toEqual(["A"]);
  expect(result.extraCalculations.map(x => x.worksheetName)).toEqual(["B"]);
});

it("requires Context before Targets and Targets before F6", async () => {
  await expect(runF6Optimization(requestWithoutContextDecision(), context, dependencies))
    .rejects.toMatchObject({ code: "prerequisite_not_ready" });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts packages/workflow-runners/src/f4.test.ts packages/workflow-runners/src/f5.test.ts packages/workflow-runners/src/f6.test.ts`

Expected: FAIL because the structured runners are absent.

- [ ] **Step 3: Extract import-safe runner functions**

Move orchestration bodies behind package APIs while retaining current artifact filenames, atomic publication, manifest/hash checks, controlled roots and CLI timeouts. Scripts become argument/JSON wrappers that call the package facade. CLI formatters consume the structured result and preserve existing user-facing text.

- [ ] **Step 4: Validate W5-W9 behavior and wrappers**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workflow-runners/src/f4.test.ts packages/workflow-runners/src/f5.test.ts packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.test.ts
npx vitest run --workspace vitest.workspace.ts scripts/f4-full-flow.test.mjs scripts/f5-full-flow.test.mjs scripts/f6-full-flow.test.mjs apps/cli/src/commands/feature5.test.ts apps/cli/src/commands/feature6.test.ts
```

Expected: PASS; no CLI regression and no Markdown parsing for disposition.

- [ ] **Step 5: Commit**

```powershell
git add packages/workflow-runners scripts/run-f4-full-validation.mjs scripts/run-f5-full-validation.mjs scripts/run-f6-full-validation.mjs apps/cli/src/commands
git commit -m "refactor(f8): share structured F4 to F6 runners"
```

---

### Task 8: Implement TA Agent Runtime

**Files:**
- Create: `packages/agent-runtime/package.json`
- Create: `packages/agent-runtime/tsconfig.json`
- Create: `packages/agent-runtime/src/index.ts`
- Create: `packages/agent-runtime/src/intents.ts`
- Create: `packages/agent-runtime/src/intents.test.ts`
- Create: `packages/agent-runtime/src/tool-policy.ts`
- Create: `packages/agent-runtime/src/tool-policy.test.ts`
- Create: `packages/agent-runtime/src/context-builder.ts`
- Create: `packages/agent-runtime/src/context-builder.test.ts`
- Create: `packages/agent-runtime/src/runtime.ts`
- Create: `packages/agent-runtime/src/runtime.test.ts`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: Session snapshot, ConversationStore and injected `LanguageModelAdapter`.
- Produces: `handleAgentTurn(request)`, deterministic intent/action results and model-stream adapter events.

- [ ] **Step 1: Create package manifests and references**

Create `@ai-assist/agent-runtime` with dependencies on `@ai-assist/contracts`, `@ai-assist/conversation`, and `@ai-assist/workbench`. Its tsconfig references only those packages. Add it to root `tsconfig.json`. Do not add Fastify, `vscode`, adapters or scripts dependencies.

- [ ] **Step 2: Write failing deterministic fallback and policy tests**

```ts
it("opens the next required action without a model", async () => {
  const result = await handleAgentTurn({ text: "继续分析", sessionId: SESSION_ID }, { model: undefined, ...deps });
  expect(result.actions).toEqual([{ type: "navigate", target: "/scope", label: "选择 Worksheets" }]);
});

it("does not turn free text into an ADO write confirmation", async () => {
  const result = await handleAgentTurn({ text: "全部确认并写入 ADO", sessionId: SESSION_ID }, deps);
  expect(result.commands).toEqual([]);
  expect(result.actions[0]).toMatchObject({ type: "navigate", target: "/ado/preview" });
});
```

- [ ] **Step 3: Run and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts packages/agent-runtime/src`

Expected: FAIL because runtime modules are absent.

- [ ] **Step 4: Implement controlled intents and model boundary**

Support `analyze`, `resume`, `status`, `explain_blocker`, `show_evidence`, `navigate`, `what_if_help`, `ado_guidance`, `open_report`, and `f7_status`. Model tools can read status/evidence and propose UI actions only. Commands requiring confirmation remain unavailable to the model tool list.

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/agent-runtime/src
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add packages/agent-runtime tsconfig.json
git commit -m "feat(f8): add TA agent runtime"
```

---

### Task 9: Build Secure Loopback Workbench Server

**Files:**
- Create: `apps/workbench-server/package.json`
- Create: `apps/workbench-server/tsconfig.json`
- Create: `apps/workbench-server/src/index.ts`
- Create: `apps/workbench-server/src/server.ts`
- Create: `apps/workbench-server/src/server.test.ts`
- Create: `apps/workbench-server/src/auth.ts`
- Create: `apps/workbench-server/src/security.ts`
- Create: `apps/workbench-server/src/security.test.ts`
- Create: `apps/workbench-server/src/uploads.ts`
- Create: `apps/workbench-server/src/uploads.test.ts`
- Create: `apps/workbench-server/src/sse.ts`
- Create: `apps/workbench-server/src/worker-queue.ts`
- Create: `apps/workbench-server/src/worker-queue.test.ts`
- Create: `apps/workbench-server/src/bootstrap.ts`
- Create: `apps/workbench-server/src/bootstrap.test.ts`
- Create: `apps/workbench-server/src/routes/sessions.ts`
- Create: `apps/workbench-server/src/routes/files.ts`
- Create: `apps/workbench-server/src/routes/commands.ts`
- Create: `apps/workbench-server/src/routes/conversation.ts`
- Create: `apps/workbench-server/src/routes/host-actions.ts`
- Create: `apps/workbench-server/src/routes/artifacts.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: SessionStore, ConversationStore, Agent Runtime and injected runner facade.
- Produces: loopback HTTP/SSE API from the spec and `startWorkbenchServer(options)`.

- [ ] **Step 1: Create package manifests and project reference**

Create `@ai-assist/workbench-server` with `type: "module"`, build/test/start scripts, and workspace dependencies on contracts, conversation, workbench, workflow-runners and agent-runtime. Create its NodeNext composite tsconfig with references to those packages, a minimal `src/index.ts`, and add it to root `tsconfig.json`.

- [ ] **Step 2: Install server dependencies**

Run:

```powershell
npm install --workspace apps/workbench-server fastify@^5 @fastify/cookie@^11 @fastify/multipart@^9 @fastify/static@^8
```

Expected: package manifest and lockfile update without audit errors that block installation.

- [ ] **Step 3: Write failing bind, bootstrap, auth and path tests**

```ts
it("binds loopback and rejects hostile Host or missing CSRF", async () => {
  const server = await createTestServer();
  expect(server.listenOptions.host).toBe("127.0.0.1");
  await expect(server.inject({ method: "POST", url: "/api/sessions", headers: { host: "evil.test" } }))
    .resolves.toMatchObject({ statusCode: 403 });
});

it("consumes a fragment bootstrap nonce once and never returns it", async () => {
  const nonce = await rendezvous.issueBrowserBootstrap();
  const first = await server.inject({ method: "POST", url: "/api/bootstrap", payload: { nonce } });
  expect(first.statusCode).toBe(204);
  expect(first.cookies.some(cookie => cookie.name === "ta_session" && cookie.httpOnly)).toBe(true);
  expect(await server.inject({ method: "POST", url: "/api/bootstrap", payload: { nonce } }))
    .toMatchObject({ statusCode: 401 });
});

it("never accepts a client supplied output path", async () => {
  const response = await authenticatedInject(server, {
    method: "POST", url: `/api/sessions/${SESSION_ID}/files`,
    payload: { kind: "workbook", outputRoot: "C:/escape" },
  });
  expect(response.statusCode).toBe(400);
});
```

- [ ] **Step 4: Run and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts apps/workbench-server/src`

Expected: FAIL because the server is absent.

- [ ] **Step 5: Implement browser bootstrap and host authentication**

Launcher issues a 128-bit one-time nonce with 60-second expiry and opens `http://127.0.0.1:<port>/#bootstrap=<nonce>`. The fragment is not sent in HTTP or server logs; bootstrap JavaScript reads it once, immediately removes it with `history.replaceState`, POSTs to `/api/bootstrap`, then discards it. The response sets the long-lived HttpOnly SameSite cookie; a read-only `/api/csrf` returns a per-session CSRF token held only in page memory. CLI/Extension use scoped bearer credentials stored outside URL/localStorage. Enforce Origin/Host allowlist, no CORS, CSP, frame deny, `no-store`, upload limits, MIME allowlist, safe names, symlink/linked-ancestor checks and session-authorized artifact download with `Content-Disposition: attachment`.

- [ ] **Step 6: Implement persistent worker queue and routes**

Define `WorkbenchWorkerQueue.enqueue(StageJob)`, `cancel(jobId)` and `reconcile()` with max concurrency 1 for Excel work and configurable concurrency for pure calculation. Jobs persist `attemptId` in SessionStore before execution; restart reconciliation marks orphaned running jobs as retryable dependency failures rather than replaying them. Terminal callback commits only when attempt CAS matches. E2E injects a deterministic in-process queue. Every mutation parses Task 1 schemas; SSE sends only sanitized events; Host action claim/result validates scope, lease and result hash.

- [ ] **Step 7: Run server tests and build**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts apps/workbench-server/src
npm run build -- --force
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add apps/workbench-server package.json package-lock.json tsconfig.json
git commit -m "feat(f8): add secure local workbench server"
```

---

### Task 10: Build Simple Workbench Web for Upload, Selection and Governance

**Files:**
- Create: `apps/workbench-web/package.json`
- Create: `apps/workbench-web/tsconfig.json`
- Create: `apps/workbench-web/tsconfig.app.json`
- Create: `apps/workbench-web/vite.config.ts`
- Create: `apps/workbench-web/index.html`
- Create: `apps/workbench-web/src/main.tsx`
- Create: `apps/workbench-web/src/app.tsx`
- Create: `apps/workbench-web/src/api.ts`
- Create: `apps/workbench-web/src/use-session.ts`
- Create: `apps/workbench-web/src/styles.css`
- Create: `apps/workbench-web/src/components/ConversationPane.tsx`
- Create: `apps/workbench-web/src/components/UploadPanel.tsx`
- Create: `apps/workbench-web/src/components/WorksheetSelection.tsx`
- Create: `apps/workbench-web/src/components/F0Status.tsx`
- Create: `apps/workbench-web/src/components/F2WorksheetStatus.tsx`
- Create: `apps/workbench-web/src/components/F3Governance.tsx`
- Create: `apps/workbench-web/src/components/AdoDecision.tsx`
- Create: `apps/workbench-web/src/components/ActionQueue.tsx`
- Create: `apps/workbench-web/src/components/ErrorPanel.tsx`
- Create: `apps/workbench-web/src/app.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vitest.workspace.ts`

**Interfaces:**
- Consumes: Workbench Server HTTP/SSE and F8 snapshots.
- Produces: four-stage simple UI through F3; no engineering calculation in browser.

- [ ] **Step 1: Create Web package and test configuration**

Create `@ai-assist/workbench-web` with Vite build/dev scripts and no Node workspace dependencies. `tsconfig.app.json` uses `moduleResolution: "Bundler"`, `jsx: "react-jsx"`, `noEmit: true`. Do not add Web to root NodeNext project references. Extend `vitest.workspace.ts` with a separate Web project that includes `apps/workbench-web/src/**/*.test.tsx`, uses `environment: "jsdom"`, and loads `apps/workbench-web/src/test-setup.ts` for Testing Library cleanup.

- [ ] **Step 2: Install Web dependencies**

Run:

```powershell
npm install --workspace apps/workbench-web react@^19 react-dom@^19
npm install --workspace apps/workbench-web --save-dev vite@^7 @vitejs/plugin-react@^5 @types/react@^19 @types/react-dom@^19 @testing-library/react@^16 @testing-library/user-event@^14 jsdom@^26
```

- [ ] **Step 3: Write failing main-flow UI test**

```tsx
it("keeps the two worksheet confirmations separate", async () => {
  render(<App api={fakeApi(initialScopeSnapshot())} />);
  await user.click(screen.getByRole("checkbox", { name: "AJ_GAP" }));
  await user.click(screen.getByRole("button", { name: "确认初始分析范围" }));
  expect(fakeApi.commands.at(-1)?.command).toBe("confirm_initial_scope");

  rerender(<App api={fakeApi(downstreamScopeSnapshot())} />);
  expect(screen.getByRole("button", { name: "确认进入工程分析" })).toBeVisible();
});
```

- [ ] **Step 4: Run and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts apps/workbench-web/src/app.test.tsx`

Expected: FAIL because the Web app is absent.

- [ ] **Step 5: Implement restrained MVP UI**

Use the approved compact metrology visual direction: pine navigation, red inspection accent, dense tables and minimal motion. The UI holds only snapshot/revision/form draft; cookie auth is implicit and no token is stored. Blocked worksheets cannot be selected downstream. ADO appears only for `governance_required`.

- [ ] **Step 6: Run UI tests and production build**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts apps/workbench-web/src
npm --workspace apps/workbench-web run build
```

Expected: PASS and Vite output contains no source workbook data.

- [ ] **Step 7: Commit**

```powershell
git add apps/workbench-web package.json package-lock.json vitest.workspace.ts
git commit -m "feat(f8): add guided workbench UI"
```

---

### Task 11: Add F4-F6 Progress, Three-Pane Review and F7 Placeholder UI

**Files:**
- Create: `packages/workbench/src/review-projection.ts`
- Create: `packages/workbench/src/review-projection.test.ts`
- Create: `apps/workbench-web/src/components/AnalysisProgress.tsx`
- Create: `apps/workbench-web/src/components/WorksheetReview.tsx`
- Create: `apps/workbench-web/src/components/EvidencePane.tsx`
- Create: `apps/workbench-web/src/components/ConclusionPane.tsx`
- Create: `apps/workbench-web/src/components/F6Options.tsx`
- Create: `apps/workbench-web/src/components/ReportLink.tsx`
- Create: `apps/workbench-web/src/components/F7Placeholder.tsx`
- Create: `apps/workbench-web/src/components/WorksheetReview.test.tsx`
- Modify: `apps/workbench-web/src/app.tsx`

**Interfaces:**
- Consumes: validated F1/F3/F4/F5/F6 artifact summaries.
- Produces: `projectWorksheetReview(snapshot, worksheetName)` and evidence-linked review UI.

- [ ] **Step 1: Write failing review projection and UI tests**

```ts
it("links a finding to source row, cells, image, formula, and F0 rule", () => {
  expect(projectWorksheetReview(fixture, "AJ_GAP").findings[0].evidence).toEqual({
    sourceRow: 15,
    sourceCells: ["AJ_GAP!J15", "AJ_GAP!K15", "AJ_GAP!L15"],
    imageArtifactId: "img-aj-gap",
    formulaIds: ["cpk-v1"],
    ruleEntryId: "performance-cpk-below-target",
  });
});
```

```tsx
it("shows F7 as unavailable without measured values", () => {
  render(<F7Placeholder status={{ status: "feature_not_available", lifecycle: "in_development" }} />);
  expect(screen.getByText("F7 正在开发")).toBeVisible();
  expect(screen.queryByText(/Measured Cpk/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts packages/workbench/src/review-projection.test.ts apps/workbench-web/src/components/WorksheetReview.test.tsx`

Expected: FAIL because review projection/components are absent.

- [ ] **Step 3: Implement review projection and simple three-pane UI**

Left pane lists downstream worksheets, center shows read-only factor/image evidence, right shows action cards. Clicking a finding highlights the bound source row. Context and Targets cards occur only after F5. F6 options remain evidence-limited. F7 displays no import control while unavailable.

- [ ] **Step 4: Run tests and Web build**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbench/src/review-projection.test.ts apps/workbench-web/src
npm --workspace apps/workbench-web run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbench/src apps/workbench-web/src
git commit -m "feat(f8): add evidence-linked engineering review"
```

---

### Task 12: Implement One-Draft F4 What-if and Tolerance-Only F6 Promotion

**Files:**
- Create: `packages/workbench/src/scenario-draft.ts`
- Create: `packages/workbench/src/scenario-draft.test.ts`
- Create: `packages/workflow-runners/src/f4-what-if.ts`
- Create: `packages/workflow-runners/src/f4-what-if.test.ts`
- Create: `apps/workbench-web/src/components/WhatIfEditor.tsx`
- Create: `apps/workbench-web/src/components/WhatIfEditor.test.tsx`
- Create: `apps/workbench-web/src/components/MetricComparison.tsx`
- Create: `apps/workbench-web/src/components/PromotionPreview.tsx`
- Create: `apps/workbench-web/src/components/PromotionPreview.test.tsx`
- Modify: `packages/workbench/src/index.ts`
- Modify: `packages/workflow-runners/src/index.ts`

**Interfaces:**
- Consumes: immutable baseline F4 calculation identity and factor rows.
- Produces: `applyScenarioPatch`, `calculateWhatIf`, `resetDraft`, `saveDraft`, `createToleranceTargetsPreview`.

- [ ] **Step 1: Write failing What-if kernel tests**

```ts
it("uses the F4 kernel and rejects nominal output without signed mapping", async () => {
  const result = await calculateWhatIf(requestWithNominalPatch(), context, dependenciesWithoutDirection());
  expect(result.status).toBe("calculation_not_possible");
  expect(result.reasonCode).toBe("DIRECTION_EVIDENCE_REQUIRED");
  expect(result.metrics).toBeUndefined();
});

it("allows only tolerance changes in the F6 targets preview", () => {
  expect(f6OptimizationTargetsSchema.parse(createToleranceTargetsPreview(toleranceOnlyDraft())))
    .toMatchObject({ contractVersion: "v1", targetVersion: "f6-optimization-targets-v1" });
  expect(() => createToleranceTargetsPreview(draftWithMeanShift())).toThrowError(/mean shift cannot be promoted/i);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts packages/workbench/src/scenario-draft.test.ts packages/workflow-runners/src/f4-what-if.test.ts`

Expected: FAIL because What-if modules are absent.

- [ ] **Step 3: Implement one worksheet-scoped Draft**

Support nominal/mean, upper tolerance, lower tolerance and additional mean shift. Expose `applyScenarioPatch`, `undoScenarioPatch`, `resetDraft`, `saveDraft`, `runF4WhatIfCalculation` and `createToleranceTargetsPreview`. Calculate through `createCalculation`/F4 scenario adapter only. Keep previous valid result while edits are invalid. Reject late attempt revisions. `saveDraft` persists the patch and calculation reference; it does not publish a governed artifact.

- [ ] **Step 4: Write failing UI interaction tests**

```tsx
it("recalculates on Enter and resets to baseline", async () => {
  render(<WhatIfEditor baseline={baseline} api={api} />);
  await user.clear(screen.getByLabelText("AJ center to C-bucket +Tol"));
  await user.type(screen.getByLabelText("AJ center to C-bucket +Tol"), "0.040{Enter}");
  expect(api.calculate).toHaveBeenCalledWith(expect.objectContaining({ upperTolerance: 0.04 }));
  await user.click(screen.getByRole("button", { name: "恢复 Baseline" }));
  expect(screen.getByLabelText("AJ center to C-bucket +Tol")).toHaveValue("0.050");
});
```

- [ ] **Step 5: Implement editor and promotion preview**

Use 250 ms debounce plus Enter immediate calculation. Show Baseline/Draft Mean, RSS 1σ, Cp, CpkL, CpkU, Cpk, statistical margin and WC margin. Promotion requires a complete diff and a new independent `Confirm optimization targets`; never reuse Draft save as confirmation.

- [ ] **Step 6: Run focused tests and build**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/workbench/src/scenario-draft.test.ts packages/workflow-runners/src/f4-what-if.test.ts apps/workbench-web/src/components/WhatIfEditor.test.tsx apps/workbench-web/src/components/PromotionPreview.test.tsx packages/workbook-catalog/src/calculation.test.ts
npm run build -- --force
npm --workspace apps/workbench-web run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add packages/workbench/src packages/workflow-runners/src apps/workbench-web/src
git commit -m "feat(f8): add governed tolerance what-if"
```

---

### Task 13: Add Unified CLI Agent and VS Code Chat Participant

**Files:**
- Create: `apps/cli/src/commands/agent.ts`
- Create: `apps/cli/src/commands/agent.test.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `apps/cli/package.json`
- Create: `apps/vscode-extension/package.json`
- Create: `apps/vscode-extension/tsconfig.json`
- Create: `apps/vscode-extension/src/extension.ts`
- Create: `apps/vscode-extension/src/participant.ts`
- Create: `apps/vscode-extension/src/participant.test.ts`
- Create: `apps/vscode-extension/src/language-model.ts`
- Create: `apps/vscode-extension/src/workbench-launcher.ts`
- Create: `apps/vscode-extension/src/host-action-pump.ts`
- Create: `apps/vscode-extension/src/host-action-pump.test.ts`
- Create: `apps/vscode-extension/src/surface-host-client.ts`
- Create: `apps/vscode-extension/src/surface-host-client.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: Agent Runtime and Workbench Server APIs.
- Produces: CLI `agent analyze|resume|status|workbench`; VS Code `@ta-assist` participant with `/analyze`, `/resume`, `/workbench`.

- [ ] **Step 1: Create Extension package and project reference**

Create `@ai-assist/vscode-extension` with VS Code `engines.vscode`, `main`, `activationEvents`, one `chatParticipants` contribution named `ta-assist`, and commands `analyze`, `resume`, `workbench`. Dependencies are contracts, agent-runtime and adapters; no Fastify dependency. Add a NodeNext composite tsconfig referencing those packages and root `tsconfig.json`.

- [ ] **Step 2: Install Extension dependencies**

Run:

```powershell
npm install --workspace apps/vscode-extension --save-dev @types/vscode@^1.104.0 @vscode/test-electron@^2.5.2
```

- [ ] **Step 3: Write failing CLI parity tests**

```ts
it("routes the CLI Agent to the same workbench session", async () => {
  const result = await executeCli(["agent", "resume", "--session", SESSION_ID], dependencies);
  expect(result).toMatchObject({ exitCode: 0, stderr: "" });
  expect(dependencies.agent.resume).toHaveBeenCalledWith(SESSION_ID);
});
```

- [ ] **Step 4: Write failing participant history-boundary and unread tests**

```ts
it("persists the current participant request but not native history", async () => {
  await handleParticipant(request("继续分析"), contextWithNativeHistory(), stream, token, deps);
  expect(deps.conversation.appendTurn).toHaveBeenCalledTimes(2);
  expect(deps.conversation.appendTurn).not.toHaveBeenCalledWith(expect.objectContaining({ content: "unrelated copilot turn" }), expect.anything());
});

it("shows web unread count and advances the extension cursor after reading", async () => {
  await pumpConversationUpdates(deps);
  expect(deps.statusBar.text).toContain("3");
  await deps.commands.openWorkbench();
  expect(deps.conversation.advanceCursor).toHaveBeenCalledWith(SESSION_ID, expect.stringMatching(/^vscode:/), 3);
});
```

- [ ] **Step 5: Run and verify RED**

Run: `npx vitest run --workspace vitest.workspace.ts apps/cli/src/commands/agent.test.ts apps/vscode-extension/src`

Expected: FAIL because Agent entries are absent.

- [ ] **Step 6: Implement CLI Agent entry**

The product path starts/opens/resumes Workbench and prints a sanitized session reference plus local URL without credentials. Existing `feature1`-`feature6` explicit commands remain backward compatible for engineering/debug use.

- [ ] **Step 7: Implement VS Code participant and host pump**

Register one participant named `ta-assist`, commands `analyze`, `resume`, `workbench`, and participant detection examples specific to TA workbooks. Use `request.model`; `ChatContext.history` is temporary model context only. Stream progress/Markdown/buttons. `surface-host-client.ts` is the only Surface MCP implementation and adapts the approved `SurfaceMcpDrawingGovernanceClient`; WorkIQ and REST are not fallbacks. Host pump claims only scoped actions and submits one hashed result. Add a status bar unread count backed by ConversationStore cursor APIs.

- [ ] **Step 8: Run tests and builds**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts apps/cli/src/commands/agent.test.ts apps/cli/src/index.test.ts apps/vscode-extension/src
npm run build -- --force
npm --workspace apps/vscode-extension run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add apps/cli apps/vscode-extension package.json package-lock.json tsconfig.json
git commit -m "feat(f8): unify CLI and VS Code TA agent"
```

---

### Task 14: Register F8 Workbench, Add E2E Security Coverage and Update Documentation

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `docs/governance/feature-register.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/01-architecture.md`
- Modify: `docs/01-架构映射.md`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/04-feature-breakdown.md`
- Modify: `docs/04-功能拆分.md`
- Modify: `docs/05-design-decisions.md`
- Modify: `docs/05-设计决策.md`
- Create: `playwright.config.ts`
- Create: `test/f8-e2e/main-flow.spec.ts`
- Create: `test/f8-e2e/security.spec.ts`
- Create: `test/f8-e2e/f7-placeholder.spec.ts`
- Create: `test/f8-e2e/fixtures/anonymous-ta-workbook.xlsx`
- Create: `test/f8-e2e/fixtures/fixture-hashes.json`
- Create: `test/f8-e2e/workbench-fixture.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: completed F8 MVP from Tasks 1-13.
- Produces: governed F8 registration, F7 unavailable projection, anonymous E2E evidence and bilingual operating documentation.

- [ ] **Step 1: Install Playwright**

Run:

```powershell
npm install --save-dev @playwright/test@^1.55.0
npx playwright install chromium
```

- [ ] **Step 2: Write failing governance tests**

```ts
it("registers confidential F8 workbench while F7 remains unavailable", () => {
  expect(getFeatureStatus("F8")).toMatchObject({
    status: "available",
    maximumClassification: "confidential",
    inputContractId: "f8-session-command-v1",
    outputContractId: "f8-session-snapshot-v1",
  });
  expect(getFeatureStatus("F7")).toMatchObject({ status: "unavailable" });
});
```

Preserve the historical fixture under a separate `F8.public-smoke` registration using existing `workflow-request-v1` / `workflow-result-v1`. Register product `F8` as the confidential workbench. Add separate tests for both keys so migration does not silently delete the legacy explicit API.

- [ ] **Step 3: Write failing browser E2E tests**

```ts
test("runs F0-F6 and a tolerance What-if without workbook writeback", async ({ page }) => {
  await page.goto(await authenticatedWorkbenchUrl());
  await page.getByLabel("TA Workbook").setInputFiles(anonymousWorkbook);
  await page.getByRole("button", { name: "确认初始分析范围" }).click();
  await page.getByRole("button", { name: "确认进入工程分析" }).click();
  await page.getByRole("button", { name: "仅保存在本地" }).click();
  await page.getByRole("button", { name: "跳过图片评估" }).click();
  await page.getByRole("button", { name: "本轮不提供分析上下文" }).click();
  await page.getByRole("button", { name: "本轮不提供优化目标" }).click();
  await expect(page.getByText("F6 分析完成")).toBeVisible();
  await page.getByRole("button", { name: "打开公差试算" }).click();
  await page.getByLabel("AJ center to C-bucket +Tol").fill("0.040");
  await page.getByLabel("AJ center to C-bucket +Tol").press("Enter");
  await expect(page.getByTestId("draft-cpk")).not.toHaveText("0.702");
  expect(await sha256(anonymousWorkbook)).toBe(originalWorkbookHash);
});
```

- [ ] **Step 4: Run focused tests and verify RED**

Run:

```powershell
npx vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts
npx playwright test test/f8-e2e
```

Expected: FAIL until registration, E2E server fixture and routes are wired.

- [ ] **Step 5: Implement registration and E2E harness**

Generate the anonymous workbook fixture only from synthetic part/factor names and record its fixed SHA-256 in `fixture-hashes.json`; never copy a real workbook. `workbench-fixture.ts` starts the server with deterministic in-process queue, fake model adapter and browser bootstrap nonce. Register F8 only after all contract, server, UI, conversation, agent and What-if checks exist. Keep F7 `unavailable`. Security E2E verifies hostile Host, reused bootstrap nonce, missing CSRF, traversal, unauthorized artifact and F7 no-result behavior. Main E2E submits both worksheet confirmations plus ADO, image, Context and Targets decisions separately.

- [ ] **Step 6: Update bilingual documentation**

Document the unified TA Assist Agent entry, browser workbench, Chat history boundary, W0-W10 order, What-if limitations, source read-only rule, Surface-only ADO and F7 placeholder. Do not claim full Copilot history synchronization or executable F7.

- [ ] **Step 7: Run complete verification**

Run:

```powershell
npx playwright test test/f8-e2e
npm run build -- --force
npm run lint
npm test
npm run check:repository
git diff --check
```

Expected: all commands PASS; F0-F6 workbench E2E completes, F7 remains visibly unavailable, and source workbook hash is unchanged.

- [ ] **Step 8: Commit**

```powershell
git add packages/governance docs README.md test/f8-e2e playwright.config.ts package.json package-lock.json
git commit -m "feat(f8): deliver TA interaction workbench"
```

---

## Requirement Coverage Matrix

| Requirement | Tasks |
|---|---|
| Unified VS Code/CLI Agent entry | 8, 13 |
| Shared TA session conversation | 1, 3, 8, 13 |
| Recoverable session and revision safety | 1, 2, 4, 9 |
| F0-F3 guided interaction | 4, 5, 6, 10 |
| F4-F6 governed analysis | 4, 7, 11 |
| ADO Surface-only protocol | 6, 9, 13 |
| Evidence-linked worksheet review | 11 |
| One Draft What-if | 12 |
| Source workbook read-only | 5, 9, 12, 14 |
| F7 explicit placeholder | 1, 4, 5, 11, 14 |
| Security and confidential handling | 2, 3, 6, 9, 14 |
| Bilingual docs and final acceptance | 14 |

## Execution Notes

- Execute tasks in order. Tasks 2 and 3 may run in parallel only after Task 1; all later tasks depend on both contracts and stores.
- Do not introduce a `workbench -> workflow-runners` package dependency. The server injects runner operations into state-machine command handlers to avoid a cycle.
- Do not import `vscode` in `agent-runtime`, `workbench`, `conversation`, or server packages. The Extension supplies model and host adapters.
- Do not make scripts the long-term API. After Task 7, scripts call the facade; facade packages never parse script stdout.
- Do not register an F7 mock runner in production. Contract fixtures and product runtime registries must remain separate.
- Review each task against the spec before committing; do not continue if focused tests fail for an unrelated reason without documenting the blocker.