# F6 Governed Report Context and Requirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 F6 governed PDF 增加真实请求时间、结构化 ADO 可追溯性、确定性 Process and Requirements 检查、完整状态标记、统计图线条、6:4 图文比例和 image3 调色板。

**Architecture:** 入口创建并持久化 `AnalysisRequestContext`，Drawing Governance 保存经 Surface readback 验证的结构化 ADO identity，F6 通过独立的 `createF6ProcessChecks` 将 F2/F3/F4 与分类事实投影为报告检查项。Markdown projection 负责工程语义，PDF renderer 只负责安全 HTML 与样式；历史 artifact 保持只读兼容，五文件发布、hash 和 manifest-last 不变。

**Tech Stack:** TypeScript 5.7、Node.js ESM、Zod、Vitest、Playwright、Marked、Edge/Chrome headless PDF。

**Spec:** `docs/superpowers/specs/2026-09-16-f6-governed-report-context-and-requirements-design.md`

## Global Constraints

- 新报告继续发布 `f6-artifact-set-v3` 的五个文件，不改变文件集合。
- PDF、Markdown 必须来自同一 validated report projection。
- PDF hash、`%PDF-` signature、受控图片路径和 manifest-last 必须保持 fail closed。
- 不改变 F4 公式、capability 判定、F6 Step 1/2/3 顺序和审批规则。
- 不在 renderer 内计算或推断工程结论。
- 用户提供的 ADO URL 只用于临时验证，不持久化、不传入 CLI。
- Battery recommendation 优先 6σ，其次 Gap/Step 3σ，其他 4σ。
- 历史 artifact 不迁移、不回写，仅保留只读验证。
- 用户可见文案使用完整产品能力名称，不显示内部 feature ID。
- 每项生产行为先写失败测试并确认 RED，再实现 GREEN。

---

### Task 0: 封存当前已验证的 PDF Polish

**Files:**
- Modify: `packages/product-export/src/f6-pdf-report.ts`
- Test: `packages/product-export/src/f6-pdf-export.test.ts`
- Modify: `scripts/f6-final-report.mjs`
- Test: `scripts/f6-final-report.test.mjs`

**Interfaces:**
- Consumes: 当前工作树中已经验证的 disclosure、range、capability、mean/specification 显示改动。
- Produces: 一个独立 clean baseline commit，后续 contract 工作不与既有 presentation 改动混合。

- [ ] **Step 1: 核对只包含四个既有文件**

Run:

```powershell
git status --short --branch
git diff --name-only
```

Expected: 分支为 `feat/f6-pdf-report-polish-v2`，除 plan 文档外，未提交代码只包含上述四个文件。

- [ ] **Step 2: 重新运行既有 slice**

Run:

```powershell
npx vitest run --project node packages/product-export/src/f6-pdf-export.test.ts scripts/f6-final-report.test.mjs apps/workbench-server/src/f6-pdf-report.test.ts
```

Expected: renderer/projection/server PDF tests 全部 PASS。

- [ ] **Step 3: 提交既有 polish**

```powershell
git add -- packages/product-export/src/f6-pdf-export.test.ts packages/product-export/src/f6-pdf-report.ts scripts/f6-final-report.mjs scripts/f6-final-report.test.mjs
git diff --cached --check
git commit -m "feat(f6): polish governed PDF report details"
```

Expected: 工作树 clean，提交不含 contract/session/ADO 文件。

---

### Task 1: 定义 Analysis Request Context 与版本化 ADO Identity

**Files:**
- Create: `packages/contracts/src/analysis-request-context.ts`
- Create: `packages/contracts/src/analysis-request-context.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/contracts.ts`
- Test: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/contracts/src/f8-contracts.ts`
- Test: `packages/contracts/src/f8-contracts.test.ts`

**Interfaces:**
- Produces:

```ts
export const analysisRequestContextSchema: z.ZodType<AnalysisRequestContext>;
export interface AnalysisRequestContext {
  requestedAt: string;
  utcOffsetMinutes: number;
  source: "web" | "vscode" | "cli";
}
```

- Produces:

```ts
export interface AdoTraceabilityV3 {
  status: "not_requested" | "draft_ready" | "confirmation_required" |
          "updated" | "blocked" | "failed";
  operation?: "created" | "updated";
  organization?: string;
  project?: string;
  workItemId?: number;
  reasonCode?: string;
}
```

- Produces: `drawingGovernanceResultV3Schema`，保留 `drawingGovernanceResultV2Schema` 只读解析。
- Produces: F8 session snapshot 可携带 `analysisRequestContext`；历史 snapshot 缺失时由 session-store migration 处理，schema 不伪造时间。

- [ ] **Step 1: 写 request context contract 的失败测试**

```ts
it("accepts requester instants and UTC offset boundaries", () => {
  expect(analysisRequestContextSchema.parse({
    requestedAt: "2026-09-16T15:30:12.000Z",
    utcOffsetMinutes: -420,
    source: "web",
  })).toEqual(expect.objectContaining({ utcOffsetMinutes: -420 }));
  expect(analysisRequestContextSchema.safeParse({
    requestedAt: "2026-09-16T15:30:12.000Z",
    utcOffsetMinutes: 841,
    source: "web",
  }).success).toBe(false);
});

it("rejects unknown fields and invalid instants", () => {
  expect(analysisRequestContextSchema.safeParse({
    requestedAt: "local morning",
    utcOffsetMinutes: 0,
    source: "cli",
    locale: "en-US",
  }).success).toBe(false);
});
```

- [ ] **Step 2: 运行 contract RED**

Run:

```powershell
npx vitest run packages/contracts/src/analysis-request-context.test.ts
```

Expected: FAIL，因为 module/export 尚不存在。

- [ ] **Step 3: 实现严格 request context schema**

```ts
export const analysisRequestContextSchema = z.object({
  requestedAt: z.string().datetime({ offset: true }),
  utcOffsetMinutes: z.number().int().min(-840).max(840),
  source: z.enum(["web", "vscode", "cli"]),
}).strict();

export type AnalysisRequestContext = z.infer<typeof analysisRequestContextSchema>;
```

从 `packages/contracts/src/index.ts` 导出，不复用语义不同的 `f6AnalysisContextSchema`。

- [ ] **Step 4: 写 Drawing Governance v3 失败测试**

在 `contracts.test.ts` 内新增 `readyDrawingGovernanceV3Fixture()`：从该文件现有的合法 completed F3 v2 object 复制 workbook、worksheet、row、summary 字段，只将 `contractVersion` 和 `ado` 替换为本任务定义的 v3 结构。该 helper 必须返回一个可被 `drawingGovernanceResultV3Schema.parse()` 接受的新对象，禁止复用可变单例。

```ts
it("accepts complete structured ADO readback identity", () => {
  const parsed = drawingGovernanceResultV3Schema.parse({
    ...readyDrawingGovernanceV3Fixture(),
    ado: {
      status: "updated",
      operation: "created",
      organization: "contoso",
      project: "Devices",
      workItemId: 1119604,
    },
  });
  expect(parsed.ado.workItemId).toBe(1119604);
});

it("rejects partial ADO identity", () => {
  expect(drawingGovernanceResultV3Schema.safeParse({
    ...readyDrawingGovernanceV3Fixture(),
    ado: { status: "updated", operation: "updated", workItemId: 1119604 },
  }).success).toBe(false);
});
```

要求 `updated` 状态下 operation/organization/project/workItemId 成组出现；非 updated 状态禁止这些字段。

- [ ] **Step 5: 运行 ADO contract RED**

Run:

```powershell
npx vitest run packages/contracts/src/contracts.test.ts -t "structured ADO"
npx vitest run packages/contracts/src/f8-contracts.test.ts -t "ADO target identity"
```

Expected: FAIL，因为 v3/receipt identity 尚不存在。

- [ ] **Step 6: 实现版本化 contract**

在 `contracts.ts` 新增 `drawingGovernanceResultV3Schema`，不修改 v2 字段含义。将 F8 的 target identity 提升为导出 schema，并让 `surfaceUpdateReceiptSchema` 保存：

```ts
{
  operation: "created" | "updated";
  targetIdentity: {
    organization: string;
    project: string;
    workItemId: number;
  };
  verifiedAt: string;
}
```

receipt 不包含用户输入 URL。

- [ ] **Step 7: 运行 GREEN 并提交**

```powershell
npx vitest run packages/contracts/src/analysis-request-context.test.ts packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.test.ts
git add -- packages/contracts/src/analysis-request-context.ts packages/contracts/src/analysis-request-context.test.ts packages/contracts/src/index.ts packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.ts packages/contracts/src/f8-contracts.test.ts
git commit -m "feat(contracts): add governed request and ADO context"
```

---

### Task 2: 在 Session 中捕获并保持原始请求上下文

**Files:**
- Modify: `packages/workbench/src/session-store.ts`
- Test: `packages/workbench/src/session-store.test.ts`
- Modify: `apps/workbench-server/src/routes/sessions.ts`
- Modify: `apps/workbench-server/src/server.ts`
- Test: `apps/workbench-server/src/server.test.ts`
- Modify: `apps/workbench-web/src/api.ts`
- Test: `apps/workbench-web/src/api.test.ts`

**Interfaces:**
- Consumes: `AnalysisRequestContext`。
- Produces: `createSession({ utcOffsetMinutes, source })`，server 生成 authority instant。
- Produces: session snapshot 的 `analysisRequestContext` 在 reopen/retry 中不可变。

- [ ] **Step 1: 写 Web request RED**

```ts
it("sends requester UTC offset without a client instant", async () => {
  await createSession({ utcOffsetMinutes: -420 });
  expect(fetchBody()).toEqual({ utcOffsetMinutes: -420, source: "web" });
  expect(fetchBody()).not.toHaveProperty("requestedAt");
});
```

- [ ] **Step 2: 写 server authority RED**

```ts
it("server stamps the request instant and rejects a client instant", async () => {
  const created = await postSession({ utcOffsetMinutes: -420, source: "web" });
  expect(created.snapshot.analysisRequestContext).toEqual({
    requestedAt: "2026-09-16T15:30:12.000Z",
    utcOffsetMinutes: -420,
    source: "web",
  });
  expect(await postSession({
    requestedAt: "2020-01-01T00:00:00.000Z",
    utcOffsetMinutes: 0,
    source: "web",
  })).toHaveStatus(400);
});
```

测试依赖注入 `now: () => new Date("2026-09-16T15:30:12.000Z")`，不用真实时钟。

- [ ] **Step 3: 运行 RED**

```powershell
npx vitest run apps/workbench-web/src/api.test.ts -t "UTC offset"
npx vitest run apps/workbench-server/src/server.test.ts -t "request instant"
npx vitest run packages/workbench/src/session-store.test.ts -t "request context"
```

Expected: FAIL，因为 request body、snapshot 和 store 尚无字段。

- [ ] **Step 4: 实现 capture 与 persistence**

- Web 使用 `-new Date().getTimezoneOffset()`。
- `POST /api/sessions` 只接受 strict `{ utcOffsetMinutes, source:"web" }`。
- server 通过依赖注入时钟生成 `requestedAt`。
- `createInitialSnapshot` 接收完整 context 并写入 snapshot。
- reopen/retry 不重新赋值。
- `parseSnapshotJson` 对历史 snapshot 保持可读，但不得为历史 governed artifact 伪造 request time；仅在创建新 session 时强制 context。

- [ ] **Step 5: 运行 GREEN 并提交**

```powershell
npx vitest run packages/workbench/src/session-store.test.ts apps/workbench-web/src/api.test.ts apps/workbench-server/src/server.test.ts
git add -- packages/workbench/src/session-store.ts packages/workbench/src/session-store.test.ts apps/workbench-server/src/routes/sessions.ts apps/workbench-server/src/server.ts apps/workbench-server/src/server.test.ts apps/workbench-web/src/api.ts apps/workbench-web/src/api.test.ts
git commit -m "feat(workbench): capture analysis request context"
```

---

### Task 3: 接通 VS Code 与 CLI 请求上下文

**Files:**
- Modify: `apps/cli/src/index.ts`
- Test: `apps/cli/src/index.test.ts`
- Modify: `apps/cli/src/commands/agent.ts`
- Modify: `apps/cli/src/commands/agent-launcher.ts`
- Test: `apps/cli/src/commands/agent.test.ts`
- Modify: `apps/vscode-extension/src/workbench-launcher.ts`
- Test: `apps/vscode-extension/src/workbench-launcher.test.ts`
- Modify: `apps/vscode-extension/src/extension.ts`
- Test: `apps/vscode-extension/src/extension.test.ts`

**Interfaces:**
- Consumes: `AnalysisRequestContext`。
- Produces: `AgentCliRequest.analysisRequestContext`。
- CLI explicit flag: `--analysis-request-context <strict-json>`。
- VS Code launcher flags: `--request-source vscode --utc-offset-minutes <integer>`；server/CLI launcher 生成 instant，不接收客户端 instant。

- [ ] **Step 1: 写 CLI RED**

```ts
it("parses explicit CLI analysis request context only for a new analysis", () => {
  expect(parseArguments([
    "agent", "analyze", "Demo.xlsx",
    "--analysis-request-context",
    '{"requestedAt":"2026-09-16T15:30:12.000Z","utcOffsetMinutes":-420,"source":"cli"}',
  ])).toEqual(expect.objectContaining({
    analysisRequestContext: expect.objectContaining({ utcOffsetMinutes: -420 }),
  }));
  expect(() => parseArguments([
    "agent", "resume", "session-1", "--analysis-request-context", "{}",
  ])).toThrow();
});
```

- [ ] **Step 2: 写默认 CLI/VS Code RED**

```ts
it("creates the default CLI context exactly once", async () => {
  const request = await launchAnalyze({ now: fixedNow, utcOffsetMinutes: 480 });
  expect(request.analysisRequestContext).toEqual({
    requestedAt: "2026-09-16T00:00:00.000Z",
    utcOffsetMinutes: 480,
    source: "cli",
  });
});

it("forwards VS Code source and offset", async () => {
  await launchNewWorkbench({ utcOffsetMinutes: -420 });
  expect(spawnArgs()).toContainSequence([
    "--request-source", "vscode", "--utc-offset-minutes", "-420",
  ]);
});
```

- [ ] **Step 3: 运行 RED**

```powershell
npx vitest run apps/cli/src/index.test.ts -t "analysis request context"
npx vitest run apps/cli/src/commands/agent.test.ts -t "default CLI context"
npx vitest run apps/vscode-extension/src/workbench-launcher.test.ts -t "offset"
```

- [ ] **Step 4: 实现入口 adapters**

- JSON 通过 `analysisRequestContextSchema.parse(JSON.parse(value))`；不手写字段验证。
- 默认 CLI context 使用命令接收时刻及本机 offset。
- VS Code 只传 source/offset，launcher 生成 authority instant。
- resume 不允许覆盖 context。

- [ ] **Step 5: 运行 GREEN 并提交**

```powershell
npx vitest run apps/cli/src/index.test.ts apps/cli/src/commands/agent.test.ts apps/vscode-extension/src/workbench-launcher.test.ts apps/vscode-extension/src/extension.test.ts
git add -- apps/cli/src/index.ts apps/cli/src/index.test.ts apps/cli/src/commands/agent.ts apps/cli/src/commands/agent-launcher.ts apps/cli/src/commands/agent.test.ts apps/vscode-extension/src/workbench-launcher.ts apps/vscode-extension/src/workbench-launcher.test.ts apps/vscode-extension/src/extension.ts apps/vscode-extension/src/extension.test.ts
git commit -m "feat(entry): forward analysis request context"
```

---

### Task 4: 将 Request Context 传入并绑定 F6 Artifact

**Files:**
- Modify: `packages/workflow-runners/src/types.ts`
- Modify: `packages/workflow-runners/src/f6.ts`
- Test: `packages/workflow-runners/src/f6.test.ts`
- Modify: `apps/workbench-server/src/production-stage-runner.ts`
- Test: `apps/workbench-server/src/production-stage-runner.test.ts`
- Modify: `scripts/f6-cli-args.mjs`
- Test: `scripts/f6-cli-args.test.mjs`
- Modify: `scripts/run-f6-full-validation.mjs`
- Test: `scripts/run-f6-full-validation.test.mjs`
- Modify: `scripts/f6-artifact-loader.mjs`
- Test: `scripts/f6-artifact-loader.test.mjs`

**Interfaces:**
- Modify:

```ts
export interface F6OptimizationRequest {
  // existing fields
  readonly analysisRequestContext: AnalysisRequestContext;
}
```

- Produces: run summary/manifest 中保存 exact context；`createFinalReport` 接收同一对象。

- [ ] **Step 1: 写 runner RED**

```ts
it("fails closed without request context and persists it unchanged", async () => {
  expect(await runWithoutContext()).toMatchObject({ status: "failed" });
  const result = await runWithContext(requestContext);
  expect(readSummary(result).analysisRequestContext).toEqual(requestContext);
  expect(readManifest(result).analysisRequestContext).toEqual(requestContext);
});
```

- [ ] **Step 2: 写 CLI/materializer RED**

```js
it("forwards the original request instant", () => {
  const parsed = parseF6CliArgs([
    ...requiredArgs,
    "--analysis-request-context",
    JSON.stringify(requestContext),
  ]);
  expect(parsed.analysisRequestContext).toEqual(requestContext);
});
```

- [ ] **Step 3: 运行 RED**

```powershell
npx vitest run packages/workflow-runners/src/f6.test.ts -t "request context"
npx vitest run scripts/f6-cli-args.test.mjs -t "request context"
npx vitest run scripts/run-f6-full-validation.test.mjs -t "request context"
```

- [ ] **Step 4: 实现端到端传递**

- production stage 从 session snapshot 取 context。
- CLI path 解析 strict JSON。
- loader 验证 context identity，不以 runId 替代 requestedAt。
- runner 将 context 传入 report projection 并 hash-bind 到 summary/manifest。
- 失败路径不输出业务 artifact。

- [ ] **Step 5: 运行 GREEN 并提交**

```powershell
npx vitest run packages/workflow-runners/src/f6.test.ts apps/workbench-server/src/production-stage-runner.test.ts scripts/f6-cli-args.test.mjs scripts/run-f6-full-validation.test.mjs scripts/f6-artifact-loader.test.mjs
git add -- packages/workflow-runners/src/types.ts packages/workflow-runners/src/f6.ts packages/workflow-runners/src/f6.test.ts apps/workbench-server/src/production-stage-runner.ts apps/workbench-server/src/production-stage-runner.test.ts scripts/f6-cli-args.mjs scripts/f6-cli-args.test.mjs scripts/run-f6-full-validation.mjs scripts/run-f6-full-validation.test.mjs scripts/f6-artifact-loader.mjs scripts/f6-artifact-loader.test.mjs
git commit -m "feat(f6): bind request context to governed output"
```

---

### Task 5: 保存结构化 ADO Readback Evidence

**Files:**
- Modify: `packages/adapters/src/surface-mcp-drawing-governance-adapter.ts`
- Test: `packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts`
- Modify: `apps/vscode-extension/src/surface-host-client.ts`
- Test: `apps/vscode-extension/src/surface-host-client.test.ts`
- Create: `packages/workflow-runners/src/f3-ado-outcome.ts`
- Create: `packages/workflow-runners/src/f3-ado-outcome.test.ts`
- Modify: `packages/workflow-runners/src/index.ts`
- Modify: `scripts/write-f3-ado-reminder.mjs`
- Test: `scripts/write-f3-ado-reminder.test.mjs`
- Modify: `apps/workbench-server/src/routes/host-actions.ts`
- Test: `apps/workbench-server/src/routes/host-actions.test.ts`
- Modify: `.github/skills/drawing-governance/SKILL.md`
- Modify: `.github/skills/drawing-governance/references/ado-publishing.md`
- Test: `scripts/f3-skill.test.mjs`

**Interfaces:**
- Produces:

```ts
export interface PersistF3AdoTraceabilityInput {
  readonly f3Root: string;
  readonly receipt: {
    readonly operation: "created" | "updated";
    readonly targetIdentity: {
      readonly organization: string;
      readonly project: string;
      readonly workItemId: number;
    };
    readonly verifiedAt: string;
  };
}

export function persistF3AdoTraceability(
  input: PersistF3AdoTraceabilityInput,
): DrawingGovernanceResultV3;
```

- Produces: report 可从 organization/project/workItemId 构造链接；receipt/artifact 不保存 URL。

- [ ] **Step 1: 写 adapter/readback RED**

```ts
it("returns structured readback identity without the validation URL", async () => {
  const receipt = await adapter.updateExisting(validatedTargetUrl);
  expect(receipt).toMatchObject({
    operation: "updated",
    targetIdentity: {
      organization: "contoso",
      project: "Devices",
      workItemId: 1119604,
    },
  });
  expect(receipt).not.toHaveProperty("url");
});
```

- [ ] **Step 2: 写 persistence RED**

```ts
it("persists structured readback before advancing review", () => {
  const report = persistF3AdoTraceability({ f3Root, receipt });
  expect(report.ado).toEqual({
    status: "updated",
    operation: "updated",
    organization: "contoso",
    project: "Devices",
    workItemId: 1119604,
  });
});
```

- [ ] **Step 3: 运行 RED**

```powershell
npx vitest run packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts -t "structured readback"
npx vitest run packages/workflow-runners/src/f3-ado-outcome.test.ts
npx vitest run scripts/write-f3-ado-reminder.test.mjs -t "structured"
```

- [ ] **Step 4: 实现 readback 与 v3 persistence**

- Surface client 解析临时 URL 后与 readback identity 精确比较。
- adapter receipt 只返回 operation/targetIdentity/verifiedAt。
- persistence 从已接受的 F3 v2 生成新的 v3 artifact；不得就地改写历史 v2 run。对于当前可写 run，使用既有原子发布机制生成新版本并更新 hash/manifest。
- host action 仅在 persistence 成功后推进状态。
- 失败时使用现有 fail-closed reason，不重试 Surface write。

- [ ] **Step 5: 同步 Drawing Governance 协议**

将文档中的 `--work-item-reference` 标为历史兼容路径；新路径只消费 Surface readback identity。明确：输入 URL 临时验证，不持久化、不传 CLI；报告链接由已验证 identity 构造。

- [ ] **Step 6: 运行 GREEN 并提交**

```powershell
npx vitest run packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts apps/vscode-extension/src/surface-host-client.test.ts packages/workflow-runners/src/f3-ado-outcome.test.ts scripts/write-f3-ado-reminder.test.mjs apps/workbench-server/src/routes/host-actions.test.ts scripts/f3-skill.test.mjs
git add -- packages/adapters/src/surface-mcp-drawing-governance-adapter.ts packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts apps/vscode-extension/src/surface-host-client.ts apps/vscode-extension/src/surface-host-client.test.ts packages/workflow-runners/src/f3-ado-outcome.ts packages/workflow-runners/src/f3-ado-outcome.test.ts packages/workflow-runners/src/index.ts scripts/write-f3-ado-reminder.mjs scripts/write-f3-ado-reminder.test.mjs apps/workbench-server/src/routes/host-actions.ts apps/workbench-server/src/routes/host-actions.test.ts .github/skills/drawing-governance/SKILL.md .github/skills/drawing-governance/references/ado-publishing.md scripts/f3-skill.test.mjs
git commit -m "feat(f3): persist structured ADO traceability"
```

---

### Task 6: 实现确定性 Process and Requirements Checks

**Files:**
- Create: `packages/workbook-catalog/src/f6-process-requirements.ts`
- Create: `packages/workbook-catalog/src/f6-process-requirements.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`
- Modify: `packages/contracts/src/contracts.ts`
- Test: `packages/contracts/src/contracts.test.ts`

**Interfaces:**
- Produces:

```ts
export type F6ProcessCheckId =
  | "analysis-method"
  | "input-completeness"
  | "output-completeness"
  | "tolerance-validity"
  | "drawing-dim-governance"
  | "ado-traceability"
  | "target-sigma";

export type F6ProcessCheckStatus = "COMPLETE" | "WARNING" | "MISSING";

export interface F6ProcessCheck {
  readonly checkId: F6ProcessCheckId;
  readonly status: F6ProcessCheckStatus;
  readonly summary: string;
  readonly details: readonly string[];
}

export function createF6ProcessChecks(input: {
  readonly worksheetName: string;
  readonly toleranceLoopDescription: string;
  readonly f2Worksheet: F2UserReport["worksheets"][number];
  readonly f3Worksheet: DrawingGovernanceResultV3["worksheets"][number];
  readonly f3Ado: AdoTraceabilityV3;
  readonly calculation: CalculationCompletedResult;
  readonly analysisContext?: F6AnalysisContext;
}): readonly F6ProcessCheck[];
```

- Produces: `classifyWorksheetDomain(input)` 返回 `{ kind:"battery"|"gap"|"step"|"other"|"ambiguous", source, matchedField? }`。
- Controlled lexicon: token-boundary `battery`、`battery pack`；不使用模糊 `cell`。Battery 优先于 Gap/Step。
- Gap/Step 优先使用 `analysisObject.kind`；缺失时可从 worksheet/description 做确定性 token match，并将 source 记录为 `deterministic-text`。ambiguous 时 warning，不冒充 caller-confirmed。

- [ ] **Step 1: 写七项 checks RED**

在新测试文件中定义 `completeFixture(overrides = {})`，返回一份最小但 contract-valid 的 F2 worksheet、F3 v3 worksheet、ADO outcome、F4 completed calculation 和 analysis context；`fixture(overrides)` 基于 `structuredClone(completeFixture())` 应用 factor count、worksheet text、current sigma 等显式覆盖。定义 `findCheck(checks, checkId)`，若目标不存在则抛错，避免 optional assertion 掩盖失败。

```ts
it("returns seven checks in fixed order", () => {
  expect(createF6ProcessChecks(completeFixture()).map(({ checkId }) => checkId)).toEqual([
    "analysis-method",
    "input-completeness",
    "output-completeness",
    "tolerance-validity",
    "drawing-dim-governance",
    "ado-traceability",
    "target-sigma",
  ]);
});

it.each([
  [3, "WARNING", "Worst Case"],
  [4, "COMPLETE", "suitable"],
  [11, "WARNING", "3D Variation Analysis"],
])("maps factor count %i deterministically", (factorCount, status, phrase) => {
  const check = findCheck(createF6ProcessChecks(fixture({ factorCount })), "analysis-method");
  expect(check).toMatchObject({ status });
  expect(check.summary).toContain(phrase);
  expect(check.summary).not.toMatch(/one-dimensional.*10|10.*one-dimensional/iu);
});
```

- [ ] **Step 2: 写 completeness/tolerance RED**

覆盖：全部 complete；按 ordinal 汇总 missingRequiredFields/missingIdentifiers；LSL/USL/target sigma 缺失；`factor_tolerance_range_invalid`；process guidance 不覆盖只产生 warning。

- [ ] **Step 3: 写 Drawing/ADO/sigma RED**

```ts
it("gives Battery precedence over Gap", () => {
  const check = targetSigmaCheck(fixture({
    worksheetName: "Battery_gap",
    toleranceLoopDescription: "Battery pack gap",
    currentSigma: 4,
  }));
  expect(check).toMatchObject({ status: "WARNING" });
  expect(check.summary).toContain("recommended 6 sigma");
});

it("does not classify ambiguous cell text as Battery", () => {
  expect(classifyWorksheetDomain(fixture({ worksheetName: "cell_gap" })).kind).toBe("gap");
});
```

ADO cases：created/updated 显示 ID；not_requested 为 MISSING 并列出待记录 dimensions；blocked/failed 为 WARNING；partial identity 在 contract 层已拒绝。

- [ ] **Step 4: 运行 RED**

```powershell
npx vitest run packages/workbook-catalog/src/f6-process-requirements.test.ts
```

Expected: FAIL，module 尚不存在。

- [ ] **Step 5: 实现纯函数**

- 不读取文件、不访问网络、不调用模型。
- 所有 details 按 Factor ordinal/source row 稳定排序。
- 状态 priority 固定 `MISSING > WARNING > COMPLETE`。
- ADO 链接不在本函数构造；只输出结构化 identity summary data 或稳定文本。
- 输出 deep-frozen 或返回新 immutable objects，避免调用方修改。

- [ ] **Step 6: 运行 GREEN 并提交**

```powershell
npx vitest run packages/workbook-catalog/src/f6-process-requirements.test.ts packages/contracts/src/contracts.test.ts
git add -- packages/workbook-catalog/src/f6-process-requirements.ts packages/workbook-catalog/src/f6-process-requirements.test.ts packages/workbook-catalog/src/index.ts packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat(f6): add governed process requirement checks"
```

---

### Task 7: 将请求时间、Required Action、Checks 和 ADO 链接投影到报告

**Files:**
- Modify: `scripts/f6-final-report.mjs`
- Test: `scripts/f6-final-report.test.mjs`
- Modify: `packages/contracts/src/ta-report-contracts.ts`
- Test: `packages/contracts/src/ta-report-contracts.test.ts`

**Interfaces:**
- Consumes: `analysisRequestContext`、`createF6ProcessChecks`、Drawing Governance v3 identity。
- Produces: 首页 `Analysis Requested At`。
- Produces: Markdown check table：

```markdown
| Check | Status | Assessment |
|---|---|---|
| Analysis Method | WARNING | Consider Worst Case as the primary assessment method. |
```

- Produces: ADO link only from `organization/project/workItemId`，使用 URL-safe path encoding。

- [ ] **Step 1: 写时间 RED**

```js
it("uses the original request instant and requester offset", () => {
  const report = createF6FinalReportProjection(inputs, {
    analysisRequestContext: {
      requestedAt: "2026-09-16T15:30:12.000Z",
      utcOffsetMinutes: -420,
      source: "web",
    },
  });
  expect(report.markdown).toContain("| Analysis Requested At | 2026-09-16 08:30:12 (UTC -7) |");
  expect(report.markdown).not.toContain("Report Generated At");
});
```

转换必须用 instant + explicit offset，不调用运行机器 `getTimezoneOffset()`。

- [ ] **Step 2: 写 Required Action/check RED**

```js
expect(blockedSection).toContain(
  "Required Action: Resolve Data Cleaning evidence before Calculation Engine, Analysis Interpretation, and Report Enhancement.",
);
expect(blockedSection).not.toMatch(/\bF[2456]\b/u);
expect(readySection).toContain("| Analysis Method | WARNING |");
expect(readySection).toContain("| ADO Traceability | MISSING |");
```

- [ ] **Step 3: 写 ADO link RED**

```js
expect(readySection).toContain(
  "[Updated Work Item #1119604](https://dev.azure.com/contoso/Devices/_workitems/edit/1119604)",
);
expect(noAdoSection).not.toContain("https://dev.azure.com/");
```

organization/project 使用 `encodeURIComponent`，ID 必须为正整数。

- [ ] **Step 4: 运行 RED**

```powershell
npx vitest run scripts/f6-final-report.test.mjs -t "request instant|process checks|ADO traceability|product capability names"
```

- [ ] **Step 5: 实现 projection**

- 用 `formatAtOffset(requestedAt, utcOffsetMinutes)` 替代基于 F6 run time 的首页时间。
- `renderProcessAndRequirements` 只渲染 `createF6ProcessChecks`，不从 HTML/Markdown 反推。
- Required Action 使用固定产品能力 catalog。
- ADO link 只在 identity 完整时生成。
- structured projection 如需保存 check IDs/status，字段名避开被禁止的 `source/evidence/provenance`，使用 `checkId/status/assessment`。

- [ ] **Step 6: 运行 GREEN 并提交**

```powershell
npx vitest run scripts/f6-final-report.test.mjs packages/contracts/src/ta-report-contracts.test.ts
git add -- scripts/f6-final-report.mjs scripts/f6-final-report.test.mjs packages/contracts/src/ta-report-contracts.ts packages/contracts/src/ta-report-contracts.test.ts
git commit -m "feat(f6): project governed request and process checks"
```

---

### Task 8: 实现状态标记、统计线条、6:4 和 Image3 Palette

**Files:**
- Modify: `packages/product-export/src/f6-pdf-report.ts`
- Test: `packages/product-export/src/f6-pdf-export.test.ts`
- Modify: `apps/workbench-server/src/f6-pdf-report.test.ts`

**Interfaces:**
- Consumes: validated Markdown tables/checks。
- Produces: semantic HTML classes：

```text
.status-missing
.status-warning
.status-complete
.dim-id-review
.range-spec-line--lower
.range-spec-line--upper
```

- Produces image3 tokens：`--p-black`、`--p-white`、`--p-gray-242`、`--p-gray-210`、`--p-gray-80`、`--p-orange`、`--p-yellow`、`--p-green`、`--p-aqua`、`--p-cyan`、`--p-purple`、`--p-dark-red`。

- [ ] **Step 1: 写状态 cell RED**

```ts
expect(html).toContain('<strong class="status-missing">MISSING</strong>');
expect(html).toContain('<strong class="dim-id-review">1</strong>');
expect(html).not.toContain('<strong class="dim-id-review">DIM-1</strong>');
expect(html).not.toContain('<strong class="dim-id-review">12</strong>');
```

Renderer 只能根据已知 table header/index 标记 DIM ID，不能全局 regex 替换数字。

- [ ] **Step 2: 写 range RED**

```ts
expect(html.match(/class="range-spec-line range-spec-line--lower"/gu)).toHaveLength(4);
expect(html.match(/class="range-spec-line range-spec-line--upper"/gu)).toHaveLength(4);
expect(html).toContain('<small class="range-values">-0.0294 to 0.409</small>');
expect(html).not.toContain("Margin");
```

- [ ] **Step 3: 写 image split/palette RED**

```ts
expect(html).toContain("grid-template-columns:60% 40%");
for (const color of [
  "#000000", "#FFFFFF", "#F2F2F2", "#D2D2D2", "#505050",
  "#FF9349", "#FEF000", "#9BF00B", "#30E5D0", "#50E6FF",
  "#D59DFF", "#A72929",
]) expect(html).toContain(color);
expect(html).not.toMatch(/#e2dcc9|#c73b7a|#ee7a2e|#2d7e73|#3f73b7|#d8a93b/iu);
```

- [ ] **Step 4: 运行 RED**

```powershell
npx vitest run --project node packages/product-export/src/f6-pdf-export.test.ts -t "MISSING|DIM ID|range row|image3 palette|60/40"
```

- [ ] **Step 5: 实现 renderer/CSS**

- Factor table renderer 按 cell index 包装 `MISSING` 与单数字 DIM ID。
- Range row 每行生成 lower/upper spec line，顶部 label 仍只出现一次。
- `range-values` 使用 Rich Black，移除 margin 文本。
- image panel 使用 grid `60% 40%`，图片 `object-fit:contain`。
- 全部 panel/status color 从 image3 token 引用，不残留旧 palette。
- 保留 status 文本，颜色不是唯一表达。

- [ ] **Step 6: 运行 GREEN 并提交**

```powershell
npx vitest run --project node packages/product-export/src/f6-pdf-export.test.ts apps/workbench-server/src/f6-pdf-report.test.ts
git add -- packages/product-export/src/f6-pdf-report.ts packages/product-export/src/f6-pdf-export.test.ts apps/workbench-server/src/f6-pdf-report.test.ts
git commit -m "feat(f6): render governed requirement checks and palette"
```

---

### Task 9: 加固 Verifier、历史兼容和 Full Flow

**Files:**
- Modify: `scripts/verify-current-f6.mjs`
- Test: `scripts/verify-current-f6.test.mjs`
- Modify: `scripts/f6-full-flow.test.mjs`
- Modify: `scripts/run-f6-full-validation.test.mjs`
- Modify: `packages/workflow-runners/src/f6.test.ts`

**Interfaces:**
- Consumes: 新 request context、Drawing Governance v3、现有 `f6-artifact-set-v3`。
- Produces: current runs 强制 request context 与 ADO identity consistency；历史 runs 继续只读接受。

- [ ] **Step 1: 写 verifier RED**

```js
it("rejects current artifacts without request context", () => {
  const run = currentRunFixture();
  delete run.summary.analysisRequestContext;
  recomputeHashes(run);
  expect(validateExistingF6Artifact(run.root, { publishRoot: run.publishRoot }))
    .toEqual({ status: "rejected", reasonCode: "artifact_validation_failed" });
});

it("keeps historical artifact versions read-only compatible", () => {
  expect(validateHistoricalRunWithoutRequestContext()).toMatchObject({ status: "accepted" });
});
```

- [ ] **Step 2: 写 full-flow RED**

验证：request instant/offset 在 report、summary、manifest 一致；ADO identity 输出链接；not_requested 不输出链接；五文件集合完全不变；manifest 最后写入。

- [ ] **Step 3: 运行 RED**

```powershell
npx vitest run scripts/verify-current-f6.test.mjs -t "request context|historical"
npx vitest run --project node scripts/f6-full-flow.test.mjs -t "request context|ADO"
```

- [ ] **Step 4: 实现 verifier/version routing**

- artifact contract 根据明确 version/字段组合判断 current/historical，不靠文件时间。
- current run 验证 context strict equality 与 ADO identity consistency。
- 不给 historical run 添加字段，不改历史 hash。

- [ ] **Step 5: 运行 GREEN 并提交**

```powershell
npx vitest run --project node scripts/verify-current-f6.test.mjs scripts/f6-full-flow.test.mjs scripts/run-f6-full-validation.test.mjs packages/workflow-runners/src/f6.test.ts
git add -- scripts/verify-current-f6.mjs scripts/verify-current-f6.test.mjs scripts/f6-full-flow.test.mjs scripts/run-f6-full-validation.test.mjs packages/workflow-runners/src/f6.test.ts
git commit -m "test(f6): verify governed report context end to end"
```

---

### Task 10: 真实 PDF 与最终回归验收

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `test/f8-e2e/f6-governed-pdf.spec.ts`
- Test artifact: ignored `test/demo-output/f6-runs/**/Feature6-Report.pdf`

**Interfaces:**
- Consumes: 完成后的 F6 workflow 与 controlled Edge/Chrome。
- Produces: PDF page-count、截图和内容/布局验收；不修改 governed artifact。

- [ ] **Step 1: 引入受控本地 PDF parser**

Run:

```powershell
npm install --save-dev pdfjs-dist
```

使用锁定版本写入 package lock。禁止用 `/Type /Page` regex 作为页数 authority。

- [ ] **Step 2: 写 PDF E2E RED**

```ts
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

test("publishes one overview page plus one page per worksheet", async () => {
  const run = await createGovernedF6FixtureRun();
  const pdf = await getDocument({ data: new Uint8Array(await readFile(run.pdfPath)) }).promise;
  expect(pdf.numPages).toBe(1 + run.worksheetNames.length);
});
```

再增加 Playwright screenshots：overview、ready worksheet、blocked worksheet、ADO linked、ADO missing。对 HTML projection 在 Chromium 中断言每个 `.slide`：

```ts
expect(await slide.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
expect(await slide.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
```

- [ ] **Step 3: 运行 E2E RED/GREEN**

Run:

```powershell
npx playwright test test/f8-e2e/f6-governed-pdf.spec.ts
```

Expected after implementation: PDF 非空、页数正确、无 overflow、图片可见、ADO link/missing 状态与 Process checks 不重叠。

- [ ] **Step 4: 运行完整验证**

```powershell
npm run build -- --force
npx vitest run --project node packages/contracts/src/analysis-request-context.test.ts packages/contracts/src/contracts.test.ts packages/contracts/src/f8-contracts.test.ts packages/workbook-catalog/src/f6-process-requirements.test.ts packages/product-export/src/f6-pdf-export.test.ts apps/workbench-server/src/f6-pdf-report.test.ts scripts/f6-final-report.test.mjs scripts/f6-full-flow.test.mjs scripts/verify-current-f6.test.mjs
npm test -- --maxWorkers=1
node scripts/verify-current-f6.mjs
git diff --check
git status --short --branch
```

Expected:

- Build exit 0。
- Focused tests 0 failures。
- Full suite exit 0；若 runner 因残留句柄不退出，记录所有 suites 的结果并单独重跑任何 timeout slice，不将挂起误报为通过。
- Verifier 返回 `accepted`，并回显它实际验证的 exact `outputDirectory`；最终报告只引用这个 validator-confirmed 路径。
- PDF SHA-256 与 summary 完全一致，signature 为 `%PDF-`。
- 提交 Step 6 前，工作树只允许 `package.json`、`package-lock.json` 和 `test/f8-e2e/f6-governed-pdf.spec.ts`；不得包含 generated PDF、Markdown、manifest 或 snapshot 文件。

- [ ] **Step 5: 最终只读 code review**

审查重点：

- request instant 是否被 retry/F6 run time 覆盖；
- URL 是否被持久化；
- Battery 优先级与 ambiguous fallback；
- renderer 是否从文本推断工程结论；
- historical verifier 是否回写；
- 颜色、overflow、页数和 ADO link safety。

修复所有 Critical/Important findings 后重复 Step 4。

- [ ] **Step 6: 提交 E2E 与依赖**

```powershell
git add -- package.json package-lock.json test/f8-e2e/f6-governed-pdf.spec.ts
git commit -m "test(f6): validate governed PDF presentation"
```

---

## 最终交付检查

- [ ] 首页显示原始分析请求时间及发起方 UTC offset。
- [ ] Required Action 只使用完整产品能力名称。
- [ ] 所有 MISSING 红色粗体；单数字 DIM ID 黄色粗体。
- [ ] 七项 Process and Requirements 检查按固定顺序、固定状态输出。
- [ ] ADO created/updated 显示完整 ID 与安全链接；not requested 显示 MISSING。
- [ ] Battery 6σ 优先于 Gap/Step 3σ；其他 4σ。
- [ ] 每个统计 row 绘制 LSL/USL，显示黑色 range，不显示 margin。
- [ ] Tolerance Path Image 图文为 60/40。
- [ ] 全报告使用 image3 token，无旧 palette 残留。
- [ ] overview + 每 worksheet 一页，无 overflow/cropping。
- [ ] 五文件、hash、signature、manifest-last 和历史只读兼容通过。
