# TA Assist Agent 与 TA Workbook Analysis Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有完整 TA 分析产品化为可由 `the retired VS Code participant 请帮我分析 <文件> 的 TA` 启动的 Beta Agent，同时保留 worksheet 双确认、ADO governed interaction、确定性最终报告，并发布到稳定的用户 `output/`。

**Architecture:** VS Code Agent Shell 只做意图与文件路由；`packages/workbench` 继续作为 durable Workflow Orchestrator，通过稳定 Runtime Skill facade 调用现有 deterministic runners。用户表面通过共享 product-language 投影隐藏内部 Feature ID；最终报告从同一 validated projection 生成，并由独立 exporter 原子发布。

**Tech Stack:** TypeScript 5.7、Node.js 24、Zod、React、Fastify、SQLite、Vitest、Playwright、VS Code Extension API。

**Spec:** `docs/superpowers/specs/2026-09-01-ta-assist-beta-agent-architecture-design.md`

## Global Constraints

- Beta 正式入口必须保留两次独立 worksheet 用户确认；`auto_confirm_initial_scope` 仅限 internal fixture。
- ADO 必须保持 §3.2 六步协议；execute-write 不自动重试，readback/reconciliation 只读可重试。
- 不修改 F4 数学、F5 statement/evidence contracts、F6 optimization policy 或源 workbook。
- Agent 不直接调用 runner；Workflow Orchestrator 只通过 Runtime Skill facade 调用既有 runner。
- 正常用户表面不得出现 `F0-F7`、`Feature0-Feature7`、内部 state、artifact kind 或内部 run reference。
- 用户报告与内部报告必须共享 validated projection、`projectionContractVersion` 和 `semanticDigest`。
- 用户 output 固定为 `output/ta-analysis/<workbook-safe-name>/<UTC>-<suffix>/`，禁止覆盖。
- 业务 `FAIL` 是有效结论并必须导出；execution failure 不得导出成功目录。
- 所有新增产品和计划文档使用中文；代码标识、命令、contract 名和用户英文 UI copy 保持英文。

---

### Task 1: 产品语言与导出基础 Contracts

**Files:**
- Create: `packages/product-language/package.json`
- Create: `packages/product-language/tsconfig.json`
- Create: `packages/product-language/src/index.ts`
- Create: `packages/product-language/src/ta-workbook-language.ts`
- Create: `packages/product-language/src/product-identifiers.ts`
- Create: `packages/product-language/src/product-identifiers.test.ts`
- Create: `packages/product-language/src/ta-workbook-language.test.ts`
- Create: `packages/contracts/src/ta-product-contracts.ts`
- Create: `packages/contracts/src/ta-product-contracts.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `tsconfig.json`

**Interfaces:**
- Produces: `TA_WORKBOOK_WORKFLOW`, `TA_WORKBOOK_STAGES`, `projectTaWorkbookStage()`, `productSafeNameV1()`, `createProductRunReference()`, `assertNoProhibitedProductIdentifiers()`.
- Produces: `taProductExportManifestSchema`, `taProductExportRecordSchema`, `taProductRunReferenceSchema`, `validatedTaBaselineReferenceSchema`.
- Consumes: existing internal workflow states and artifact metadata without renaming them.

- [ ] **Step 1: Write failing product identifier and manifest tests**

```ts
it("creates stable Windows-safe names and rejects internal identifiers", () => {
  expect(productSafeNameV1("Gearbox TA.xlsx")).toBe("Gearbox-TA");
  expect(productSafeNameV1("CON.xlsx")).toBe("workbook-CON");
  expect(() => assertNoProhibitedProductIdentifiers("F6 running")).toThrow();
  expect(() => assertNoProhibitedProductIdentifiers("Feature6-Report.md")).toThrow();
});

it("accepts a product-only export manifest", () => {
  expect(taProductExportManifestSchema.parse({
    contractVersion: "ta-assist-product-export-v1",
    workflow: "TA Workbook Analysis",
    generatedAt: "2026-09-01T00:00:00.000Z",
    workbook: { fileName: "Gearbox-TA.xlsx", contentHash: "a".repeat(64) },
    worksheetScope: ["Analysis-A"],
    executionStatus: "completed",
    businessDisposition: "FAIL",
    exportStatus: "completed",
    productRunReference: "ta-run-7m4k2p9q",
    files: [{ displayName: "TA Engineering Analysis Report", fileName: "TA-Engineering-Analysis-Report.md", mediaType: "text/markdown", byteSize: 12, sha256: "b".repeat(64) }],
  })).toBeDefined();
});

it("retains controlled source references required by measurement feedback", () => {
  expect(validatedTaBaselineReferenceSchema.parse({
    contractVersion: "validated-ta-baseline-reference-v1",
    baselineSessionId: "session-01",
    baselineRunReference: "controlled-run-reference",
    workbookContentHash: "a".repeat(64),
    finalReportSha256: "b".repeat(64),
    sourceArtifacts: {
      drawingGovernance: { artifactId: "controlled-f3", sha256: "c".repeat(64) },
      calculation: { artifactId: "controlled-f4", sha256: "d".repeat(64) },
      interpretation: { artifactId: "controlled-f5", sha256: "e".repeat(64) },
      optimization: { artifactId: "controlled-f6", sha256: "f".repeat(64) },
    },
  })).toBeDefined();
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run packages/product-language/src/product-identifiers.test.ts packages/product-language/src/ta-workbook-language.test.ts packages/contracts/src/ta-product-contracts.test.ts`

Expected: FAIL because the package, schemas and exports do not exist.

- [ ] **Step 3: Implement minimal shared vocabulary and schemas**

```ts
export const TA_WORKBOOK_STAGES = [
  "prepare_workbook",
  "validate_analysis_inputs",
  "review_dimension_traceability",
  "calculate_and_interpret",
  "evaluate_and_publish",
] as const;

export const TA_WORKBOOK_STAGE_LABELS = {
  prepare_workbook: "Prepare workbook",
  validate_analysis_inputs: "Validate analysis inputs",
  review_dimension_traceability: "Review dimension traceability",
  calculate_and_interpret: "Calculate and interpret tolerance performance",
  evaluate_and_publish: "Evaluate improvement options and publish report",
} as const;
```

Implement `productSafeNameV1()` with NFC normalization, extension removal, reserved-name prefixing, trailing dot/space removal, deterministic 96-character limit and hash suffix on collision-prone truncation. Implement prohibited-pattern checks for `F[0-7]`, `Feature[ _-]?[0-7]`, internal state names and internal artifact kinds. `validatedTaBaselineReferenceSchema` must retain only controlled artifact IDs and hashes for drawing governance, calculation, interpretation and optimization; it must not expose absolute paths or be copied into the user manifest.

- [ ] **Step 4: Wire project references and run tests**

Run: `npm run build -- --force; npx vitest run packages/product-language/src packages/contracts/src/ta-product-contracts.test.ts`

Expected: build PASS and focused tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/product-language packages/contracts/src/ta-product-contracts.ts packages/contracts/src/ta-product-contracts.test.ts packages/contracts/src/index.ts tsconfig.json
git commit -m "feat: add TA product language contracts"
```

---

### Task 2: 自然语言入口与 Workspace 文件解析

**Files:**
- Modify: `apps/vscode-extension/src/analyze-intent.ts`
- Modify: `apps/vscode-extension/src/analyze-intent.test.ts`
- Create: `apps/vscode-extension/src/workspace-workbook-resolver.ts`
- Create: `apps/vscode-extension/src/workspace-workbook-resolver.test.ts`
- Modify: `apps/vscode-extension/src/participant.ts`
- Modify: `apps/vscode-extension/src/participant.test.ts`
- Modify: `apps/vscode-extension/src/extension.ts`
- Modify: `packages/agent-runtime/src/intents.ts`
- Modify: `packages/agent-runtime/src/intents.test.ts`

**Interfaces:**
- Produces: `TaAnalyzeIntent` with `workbookPath?: string` or `workbookFileName?: string`.
- Produces: `resolveWorkspaceWorkbook(fileName, workspaceFolders)` returning `unique | ambiguous | not_found`.
- Consumes: existing `importWorkbook()` security checks after path resolution.

- [ ] **Step 1: Write failing intent precedence and resolver tests**

```ts
it("recognizes an exact workspace workbook name", () => {
  expect(classifyAnalyzeIntent("请帮我分析 Gearbox-TA.xlsx 的 TA")).toEqual({
    kind: "analyze_ta",
    workbookFileName: "Gearbox-TA.xlsx",
  });
});

it("does not turn a session continuation into a new analysis", () => {
  expect(classifyAnalyzeIntent("继续分析当前 session 的 factor table")).toBeUndefined();
});

it("requires selection for duplicate exact file names", async () => {
  await expect(resolveWorkspaceWorkbook("report.xlsx", fixtureWorkspace([
    "a/report.xlsx", "b/report.xlsx",
  ]))).resolves.toMatchObject({ kind: "ambiguous", candidates: expect.any(Array) });
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run apps/vscode-extension/src/analyze-intent.test.ts apps/vscode-extension/src/workspace-workbook-resolver.test.ts packages/agent-runtime/src/intents.test.ts`

Expected: FAIL because bare filenames are rejected and resolver is absent.

- [ ] **Step 3: Implement exact-name resolution and picker fallback**

```ts
export type WorkbookResolution =
  | { readonly kind: "unique"; readonly uri: vscode.Uri }
  | { readonly kind: "ambiguous"; readonly candidates: readonly vscode.Uri[] }
  | { readonly kind: "not_found" };

export async function resolveWorkspaceWorkbook(
  fileName: string,
  findFiles: (pattern: string) => Thenable<readonly vscode.Uri[]>,
): Promise<WorkbookResolution>;
```

Use `vscode.workspace.findFiles("**/<escaped exact filename>")`, sort only for stable presentation, use `showQuickPick()` for ambiguity and `showOpenDialog({ canSelectMany: false, filters: { "Excel Workbook": ["xlsx"] } })` for absent/not-found input. Do not select the first candidate automatically.

- [ ] **Step 4: Integrate participant routing before session turns**

Update `handleAnalyzeIntent()` so resume/status/report/blocker/current-session requests are classified before new workbook analysis. Preserve absolute path validation and call `importWorkbook()` only after one concrete path is selected.

- [ ] **Step 5: Run extension and runtime tests**

Run: `npx vitest run apps/vscode-extension/src/analyze-intent.test.ts apps/vscode-extension/src/workspace-workbook-resolver.test.ts apps/vscode-extension/src/participant.test.ts packages/agent-runtime/src/intents.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/vscode-extension/src packages/agent-runtime/src/intents.ts packages/agent-runtime/src/intents.test.ts
git commit -m "feat: start TA analysis from workspace workbook names"
```

---

### Task 3: 锁定两次 Worksheet 用户确认

**Files:**
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/contracts/src/f8-contracts.test.ts`
- Modify: `packages/workbench/src/state-machine.ts`
- Modify: `packages/workbench/src/state-machine.test.ts`
- Modify: `the retired F8 server app/src/server.ts`
- Modify: `the retired F8 server app/src/server.test.ts`
- Modify: `the retired F8 web app/src/app.test.tsx`
- Modify: `packages/workflow-runners/src/f1-f2.test.ts`

**Interfaces:**
- Produces: worksheet decision provenance `user | internal_fixture`.
- Consumes: existing `confirm_initial_scope` and `confirm_downstream_scope` commands.
- Enforces: product export eligibility requires both decisions with `provenance: "user"`.

- [ ] **Step 1: Write failing confirmation provenance tests**

```ts
it("records two distinct user worksheet decisions", () => {
  const initial = reduceSession(createdSnapshot, confirmInitialCommand);
  const downstream = reduceSession(readySnapshot(initial), confirmDownstreamCommand);
  expect(downstream.initialScopeSelection).toMatchObject({ confirmed: true, provenance: "user" });
  expect(downstream.downstreamScopeSelection).toMatchObject({ confirmed: true, provenance: "user" });
});

it("does not auto-confirm a production chat session", async () => {
  const snapshot = await startProductionSession();
  expect(snapshot.state).toBe("initial_scope_required");
  expect(snapshot.initialScopeSelection).toBeUndefined();
});
```

Add cases for empty selection, duplicate names, stale workbook hash, blocked downstream worksheet and scope drift.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run packages/contracts/src/f8-contracts.test.ts packages/workbench/src/state-machine.test.ts the retired F8 server app/src/server.test.ts`

Expected: FAIL because provenance is absent and production auto-entry still confirms selections.

- [ ] **Step 3: Add provenance and fixture-only auto-confirm policy**

```ts
const worksheetDecisionProvenanceSchema = z.enum(["user", "internal_fixture"]);

const worksheetScopeSelectionSchema = z.object({
  workbookContentHash: sha256Schema,
  selectedWorksheetNames: z.array(z.string().trim().min(1)).min(1),
  confirmed: z.literal(true),
  provenance: worksheetDecisionProvenanceSchema,
});
```

Make normal commands write `user`. Gate `applyAutoEntry()` and `applyAutoDownstream()` behind an explicit injected `allowInternalFixtureAutoConfirmation` dependency that defaults to `false`.

- [ ] **Step 4: Run workflow and UI confirmation tests**

Run: `npx vitest run packages/workbench/src/state-machine.test.ts the retired F8 server app/src/server.test.ts the retired F8 web app/src/app.test.tsx packages/workflow-runners/src/f1-f2.test.ts`

Expected: PASS; production session stops at both confirmation states.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/f8-contracts* packages/workbench/src/state-machine* the retired F8 server app/src/server* the retired F8 web app/src/app.test.tsx packages/workflow-runners/src/f1-f2.test.ts
git commit -m "fix: require user worksheet confirmations"
```

---

### Task 4: Runtime Skill Facades 与生产编排接入

**Files:**
- Create: `packages/workbench/src/runtime-skill-facade.ts`
- Create: `packages/workbench/src/runtime-skill-facade.test.ts`
- Create: `packages/workbench/src/ta-workbook-orchestrator.ts`
- Create: `packages/workbench/src/ta-workbook-orchestrator.test.ts`
- Create: `the retired F8 server app/src/ta-runtime-skill-facades.ts`
- Create: `the retired F8 server app/src/ta-runtime-skill-facades.test.ts`
- Modify: `packages/workbench/src/index.ts`
- Modify: `the retired F8 server app/src/server.ts`
- Modify: `the retired F8 server app/src/production-stage-runner.ts`

**Interfaces:**
- Produces: `RuntimeSkillMetadata`, `RuntimeSkillInvocation<Input>`, `RuntimeSkillResult<Output>`, `RuntimeSkillFacade<Input, Output>`.
- Produces: eleven fixed TA facade IDs from the spec.
- Consumes: existing `validateF0Capabilities`, `runF1F2Selection`, `runF1F2Confirmed`, `runF3Analysis`, `runF4Calculation`, `runF5Interpretation`, `runF6Optimization`.

- [ ] **Step 1: Write failing metadata and delegation tests**

```ts
it("declares stable TA runtime skill metadata", () => {
  expect(TA_RUNTIME_SKILLS.map((skill) => skill.skillId)).toEqual([
    "knowledge-and-rules-validation-v1",
    "workbook-scope-discovery-v1",
    "workbook-analysis-assets-v1",
    "analysis-input-validation-v1",
    "dimension-traceability-review-v1",
    "ado-governance-publication-v1",
    "tolerance-performance-calculation-v1",
    "engineering-interpretation-v1",
    "improvement-evaluation-v1",
    "engineering-summary-report-v1",
    "ta-product-export-v1",
  ]);
});

it("delegates calculation exactly once to the existing runner", async () => {
  const runF4 = vi.fn().mockResolvedValue(calculationResult);
  const result = await facades.calculation.invoke(invocation, { runF4 });
  expect(runF4).toHaveBeenCalledTimes(1);
  expect(result.output).toEqual(calculationResult);
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run packages/workbench/src/runtime-skill-facade.test.ts packages/workbench/src/ta-workbook-orchestrator.test.ts the retired F8 server app/src/ta-runtime-skill-facades.test.ts`

Expected: FAIL because facade contracts do not exist.

- [ ] **Step 3: Implement generic facade contract**

```ts
export interface RuntimeSkillMetadata {
  readonly skillId: string;
  readonly contractVersion: "v1";
  readonly inputClassification: "internal" | "confidential";
  readonly permissions: readonly ("read" | "persist" | "adapter" | "network")[];
  readonly idempotent: boolean;
  readonly retryable: boolean;
  readonly sideEffect: "none" | "local_persist" | "external_write";
}

export interface RuntimeSkillFacade<Input, Output> {
  readonly metadata: RuntimeSkillMetadata;
  invoke(invocation: RuntimeSkillInvocation<Input>): Promise<RuntimeSkillResult<Output>>;
}
```

Validate `inputRevision`, `idempotencyKey`, artifact references and worksheet scope before delegation. Return structured `completed | blocked | failed`; do not parse stdout.

- [ ] **Step 4: Route production stages through facades**

Replace direct calls in `runDefaultStage()` and `runProductionStage()` with injected facade calls. Keep runner functions injected beneath facades so existing behavior and tests remain authoritative.

- [ ] **Step 5: Prove old and facade paths are equivalent**

Run: `npx vitest run packages/workbench/src/runtime-skill-facade.test.ts packages/workbench/src/ta-workbook-orchestrator.test.ts the retired F8 server app/src/ta-runtime-skill-facades.test.ts packages/workflow-runners/src`

Expected: PASS and fixtures produce deep-equal structured outputs.

- [ ] **Step 6: Commit**

```powershell
git add packages/workbench/src the retired F8 server app/src
git commit -m "refactor: route TA workflow through runtime skill facades"
```

---

### Task 5: 五阶段产品投影与用户语言清理

**Files:**
- Modify: `packages/workbench/src/projections.ts`
- Modify: `packages/workbench/src/projections.test.ts`
- Modify: `the retired F8 web app/src/workbench-session.ts`
- Modify: `the retired F8 web app/src/web-projection.ts`
- Modify: `the retired F8 web app/src/components/AnalysisProgress.tsx`
- Modify: `the retired F8 web app/src/components/AnalysisProgress.test.tsx`
- Modify: `the retired F8 web app/src/components/EvidenceImagePane.tsx`
- Modify: `the retired F8 web app/src/components/EvidencePane.tsx`
- Modify: `the retired F8 web app/src/components/AdoWorkspaceDecision.tsx`
- Modify: `the retired F8 web app/src/business-status.ts`
- Modify: `packages/agent-runtime/src/context-builder.ts`
- Modify: `packages/agent-runtime/src/runtime.ts`
- Create: `scripts/product-language-surface.test.mjs`

**Interfaces:**
- Produces: `projectTaProductStages(snapshot, progress)` returning exactly five user stages.
- Preserves: `projectFeatureLedger()` for internal diagnostics only.
- Consumes: `packages/product-language` labels and prohibited identifier checker.

- [ ] **Step 1: Write failing five-stage projection and surface tests**

```ts
it("projects internal workflow into five product stages", () => {
  expect(projectTaProductStages(snapshotAt("f4_running"))).toEqual([
    expect.objectContaining({ label: "Prepare workbook", status: "completed" }),
    expect.objectContaining({ label: "Validate analysis inputs", status: "completed" }),
    expect.objectContaining({ label: "Review dimension traceability", status: "completed" }),
    expect.objectContaining({ label: "Calculate and interpret tolerance performance", status: "running" }),
    expect.objectContaining({ label: "Evaluate improvement options and publish report", status: "pending" }),
  ]);
});

it("does not render internal feature identifiers", () => {
  render(<AnalysisProgress stages={productStages} connected />);
  expect(screen.queryByText(/^F[0-7]$/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run packages/workbench/src/projections.test.ts the retired F8 web app/src/components/AnalysisProgress.test.tsx scripts/product-language-surface.test.mjs`

Expected: FAIL because progress still renders Feature IDs and F7 placeholder.

- [ ] **Step 3: Implement product projection and update UI**

Pass `ProductStage[]` into `AnalysisProgress`; remove `entry.featureId` and `${activeFeatureId} running` from rendered copy. Replace `F1 Evidence`, `F0 Rule`, `F3 reminder`, `F7 in development` and internal state messages with product vocabulary. Do not delete internal contracts or diagnostic projections.

- [ ] **Step 4: Add static and rendered prohibited-identifier scan**

Make `scripts/product-language-surface.test.mjs` scan extension participant metadata, default Agent replies, Web rendered fixtures, product report fixtures, output filenames and product manifests. Scope exceptions to explicit internal diagnostic fixtures only.

- [ ] **Step 5: Run product surface tests**

Run: `npx vitest run packages/workbench/src/projections.test.ts the retired F8 web app/src packages/agent-runtime/src scripts/product-language-surface.test.mjs`

Expected: PASS with no user-visible prohibited identifiers.

- [ ] **Step 6: Commit**

```powershell
git add packages/workbench/src/projections* the retired F8 web app/src packages/agent-runtime/src scripts/product-language-surface.test.mjs
git commit -m "feat: present TA workflow in product language"
```

---

### Task 6: ADO Unknown Outcome 与只读 Reconciliation

**Files:**
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/contracts/src/f8-contracts.test.ts`
- Modify: `packages/workbench/src/host-actions.ts`
- Modify: `packages/workbench/src/host-actions.test.ts`
- Modify: `packages/workbench/src/host-action-support.ts`
- Modify: `packages/workbench/src/session-store-schema.ts`
- Modify: `the retired F8 server app/src/routes/ado.ts`
- Modify: `the retired F8 server app/src/server.test.ts`
- Modify: `apps/vscode-extension/src/surface-host-client.ts`
- Modify: `apps/vscode-extension/src/surface-host-client.test.ts`
- Modify: `the retired F8 web app/src/components/AdoWorkspaceDecision.tsx`
- Modify: `the retired F8 web app/src/components/AdoWorkspaceDecision.test.tsx`

**Interfaces:**
- Produces: ADO phases `validate_target | prepare_preview | execute_write | readback | reconcile`.
- Produces: terminal/intermediate state `write_outcome_unknown`.
- Produces: `reconcileSurfaceWrite()` using the same target identity and preview marker/hash.

- [ ] **Step 1: Write failing interruption-window tests**

```ts
it("moves an interrupted write to unknown outcome without replay", async () => {
  const state = await store.recordWriteDispatched(confirmedAction);
  const restored = await reopenStore(state.rootDir);
  expect(restored.ado.state).toBe("write_outcome_unknown");
  await expect(restored.retryWrite()).rejects.toMatchObject({ code: "policy_denied" });
});

it("reconciles an existing write through read-only Surface calls", async () => {
  const result = await reconcileSurfaceWrite(unknownOutcome, surfaceWithMatchingComment());
  expect(result).toMatchObject({ state: "completed", writeReplayed: false });
});
```

Add cases for confirmed absent, inconclusive, target mismatch and preview hash mismatch.

- [ ] **Step 2: Run ADO tests and confirm failure**

Run: `npx vitest run packages/workbench/src/host-actions.test.ts the retired F8 server app/src/server.test.ts apps/vscode-extension/src/surface-host-client.test.ts`

Expected: FAIL because unknown outcome and reconciliation are absent.

- [ ] **Step 3: Extend contracts and persistence**

```ts
const adoExecutionPhaseSchema = z.enum([
  "validate_target", "prepare_preview", "execute_write", "readback", "reconcile",
]);

const adoUnknownOutcomeSchema = z.object({
  state: z.literal("write_outcome_unknown"),
  targetIdentity: adoTargetIdentitySchema,
  previewHash: sha256Schema,
  previewMarker: z.string().min(1),
  writeDispatchedAt: isoDateTimeSchema,
});
```

Persist dispatch before invoking Surface. Persist receipt and readback independently. Never infer absence from timeout.

- [ ] **Step 4: Implement reconciliation and user flow**

Use only existing Surface MCP read channel. Matching marker/hash completes without writing; absent result enables a new explicit confirmation flow; inconclusive remains blocked. UI labels the condition in product language and never offers a generic retry-write button.

- [ ] **Step 5: Run six-step regression suite**

Run: `npx vitest run packages/contracts/src/f8-contracts.test.ts packages/workbench/src/host-actions.test.ts the retired F8 server app/src/server.test.ts apps/vscode-extension/src/surface-host-client.test.ts the retired F8 web app/src/components/AdoWorkspaceDecision.test.tsx`

Expected: PASS; existing validate/preview/confirm/write/readback tests remain unchanged.

- [ ] **Step 6: Commit**

```powershell
git add packages/contracts/src/f8-contracts* packages/workbench/src/host-action* packages/workbench/src/session-store-schema.ts the retired F8 server app/src apps/vscode-extension/src/surface-host-client* the retired F8 web app/src/components/AdoWorkspaceDecision*
git commit -m "feat: reconcile uncertain ADO write outcomes"
```

---

### Task 7: 最终报告 Semantic Digest 与 TA Product Export

**Files:**
- Create: `packages/contracts/src/ta-report-contracts.ts`
- Create: `packages/contracts/src/ta-report-contracts.test.ts`
- Create: `packages/workbench/src/report-semantic-digest.ts`
- Create: `packages/workbench/src/report-semantic-digest.test.ts`
- Create: `packages/product-export/package.json`
- Create: `packages/product-export/tsconfig.json`
- Create: `packages/product-export/src/index.ts`
- Create: `packages/product-export/src/atomic-product-export.ts`
- Create: `packages/product-export/src/atomic-product-export.test.ts`
- Modify: `tsconfig.json`
- Modify: `the retired F8 server app/package.json`
- Modify: `the retired F8 server app/tsconfig.json`
- Modify: `scripts/f6-final-report.mjs`
- Modify: `scripts/f6-final-report.test.mjs`
- Modify: `packages/workflow-runners/src/f6.ts`
- Modify: `the retired F8 server app/src/production-stage-runner.ts`
- Create: `the retired F8 server app/src/product-export-store.ts`
- Create: `the retired F8 server app/src/ta-product-exporter.ts`
- Create: `the retired F8 server app/src/ta-product-exporter.test.ts`
- Create: `the retired F8 server app/src/routes/product-export.ts`
- Modify: `the retired F8 server app/src/server.ts`

**Interfaces:**
- Produces: `taEngineeringReportProjectionSchema`, `computeTaReportSemanticDigest()`.
- Produces: shared `prepareProductExport()`, `commitProductExport()`, `verifyExistingProductExport()` primitives for Plan B.
- Produces: `exportTaAnalysis(sourceRunReference)` and idempotent export record.
- Consumes: validated F6 final projection, product-language and Task 1 export schemas.

- [ ] **Step 1: Write failing semantic digest mutation tests**

```ts
it("permits display labels but rejects engineering semantic changes", () => {
  expect(computeTaReportSemanticDigest(baseProjection)).toBe(
    computeTaReportSemanticDigest({ ...baseProjection, title: "TA Engineering Analysis Report" }),
  );
  expect(computeTaReportSemanticDigest(baseProjection)).not.toBe(
    computeTaReportSemanticDigest({ ...baseProjection, workbookDisposition: "PASS" }),
  );
});
```

Add mutations for worksheet order, metrics, findings, assumptions, clarifications, gates and evidence references.

- [ ] **Step 2: Write failing exporter safety and idempotency tests**

```ts
it("exports a valid business FAIL without rerunning analysis", async () => {
  const exported = await exportTaAnalysis(validatedSource({ businessDisposition: "FAIL" }));
  expect(exported.manifest.executionStatus).toBe("completed");
  expect(exported.manifest.businessDisposition).toBe("FAIL");
  expect(runF6).not.toHaveBeenCalled();
});

it("returns the same export for identical retry and rejects drift", async () => {
  const first = await exportTaAnalysis(source);
  expect(await exportTaAnalysis(source)).toEqual(first);
  await mutateExportedReport(first.root);
  await expect(exportTaAnalysis(source)).rejects.toMatchObject({ code: "evidence_mismatch" });
});
```

Cover symlink ancestors, additional files, staging crash, stale hash, internal auto-confirm decisions and execution failure.

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `npx vitest run packages/contracts/src/ta-report-contracts.test.ts packages/workbench/src/report-semantic-digest.test.ts packages/product-export/src/atomic-product-export.test.ts scripts/f6-final-report.test.mjs the retired F8 server app/src/ta-product-exporter.test.ts`

Expected: FAIL because structured projection, digest and exporter are absent.

- [ ] **Step 4: Extend final report projection without changing engineering logic**

Return `{ markdown, reportSummary, projection }` from `createF6FinalReportProjection()`. Build projection from the same validated values currently used to render Markdown. Do not parse Markdown and do not introduce a second disposition calculation.

- [ ] **Step 5: Implement canonical digest and atomic exporter**

Use canonical object-key ordering and a strict JSON Pointer display allowlist. Implement lexical/physical containment, linked-ancestor checks, staging, all-file enumeration, hash verification and atomic rename once in `packages/product-export`; the TA exporter supplies workflow-specific names and content. Publish to a sibling staging directory, hash every regular file, write manifest last, recheck physical containment, then atomically rename. Fixed files:

```text
TA-Engineering-Analysis-Report.md
TA-Improvement-Options.md
TA-Analysis-Run-Summary.json
export-manifest.json
```

Create `evidence/` only when the final report references validated evidence.

- [ ] **Step 6: Run report and exporter tests**

Run: `npx vitest run packages/workbench/src/report-semantic-digest.test.ts packages/product-export/src/atomic-product-export.test.ts scripts/f6-final-report.test.mjs the retired F8 server app/src/ta-product-exporter.test.ts`

Expected: PASS, including identical retry and crash recovery.

- [ ] **Step 7: Commit**

```powershell
git add packages/contracts/src/ta-report-contracts* packages/workbench/src/report-semantic-digest* packages/product-export tsconfig.json scripts/f6-final-report* packages/workflow-runners/src/f6.ts the retired F8 server app
git commit -m "feat: publish validated TA product reports"
```

---

### Task 8: VSIX 打包与 Beta 端到端发布门

**Files:**
- Modify: `apps/vscode-extension/src/extension.ts`
- Create: `apps/vscode-extension/scripts/build.mjs`
- Create: `apps/vscode-extension/scripts/package-vsix.mjs`
- Create: `apps/vscode-extension/src/vsix-package.test.ts`
- Modify: `apps/vscode-extension/package.json`
- Modify: `package.json`
- Modify: `test/f8-e2e/chat-entry.spec.ts`
- Modify: `test/f8-e2e/engineering-workspace.spec.ts`
- Create: `test/f8-e2e/product-output.spec.ts`
- Modify: `README.md`
- Modify: `docs/governance/feature-register.md`

**Interfaces:**
- Produces: self-contained VSIX with extension bundle, local Host, Workbench assets and product-language runtime.
- Consumes: Tasks 1-7 production entry and export route.
- Verifies: no dependency on source files under the user's TA workspace.

- [ ] **Step 1: Write failing package-content test**

```ts
it("packages a self-contained TA Assist Beta extension", async () => {
  const entries = await listVsixEntries(vsixPath);
  expect(entries).toEqual(expect.arrayContaining([
    "extension/dist/extension.js",
    "extension/runtime/cli/index.js",
    "extension/runtime/workbench/workbench.js",
    "extension/runtime/workbench/workbench.css",
  ]));
  expect(entries.some((entry) => entry.includes("test/demo-output"))).toBe(false);
});
```

- [ ] **Step 2: Run package test and confirm failure**

Run: `npx vitest run apps/vscode-extension/src/vsix-package.test.ts`

Expected: FAIL because the current extension launches `apps/cli/dist/index.js` from the user workspace.

- [ ] **Step 3: Build self-contained runtime and launch from extension URI**

Resolve the bundled host from `context.extensionUri`, not `workspaceRoot`:

```ts
const cliUri = vscode.Uri.joinPath(context.extensionUri, "runtime", "cli", "index.js");
const processLauncher = createCliProcessLauncher(workspaceRoot, cliUri.fsPath);
```

Package only runtime dependencies and generated Workbench assets. Add root scripts `build:beta` and `package:vsix`.

- [ ] **Step 4: Extend E2E flows**

Cover Chinese/English prompts, absolute/bare/picker input, ambiguity, both worksheet confirmations, ADO local and write/reconciliation branches, five product stages, business `FAIL` report, product output hashes and absence of prohibited identifiers. Assert completing TA does not create a measurement session.

- [ ] **Step 5: Run focused and full verification**

Run:

```powershell
npm run build -- --force
npx vitest run apps/vscode-extension/src packages/workbench/src the retired F8 server app/src the retired F8 web app/src packages/agent-runtime/src scripts/product-language-surface.test.mjs scripts/f6-final-report.test.mjs
npx playwright test test/f8-e2e/chat-entry.spec.ts test/f8-e2e/engineering-workspace.spec.ts test/f8-e2e/product-output.spec.ts
npm run package:vsix
npm run check:repository
git diff --check
```

Expected: all commands PASS; VSIX installs without repository source dependency; output is created only after verified completion.

- [ ] **Step 6: Commit**

```powershell
git add apps/vscode-extension package.json test/f8-e2e README.md docs/governance/feature-register.md
git commit -m "feat: package TA Assist workbook analysis beta"
```

