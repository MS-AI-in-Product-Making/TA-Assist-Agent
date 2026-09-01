# Measured Capability Feedback Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有实测能力原型产品化为由 `@ta-assist` 独立启动、绑定已验证 TA baseline、分析原始测量样本并发布实测与预测比较报告的 durable Beta workflow。

**Architecture:** 独立 Measurement Workflow Orchestrator 持久化 session、baseline link、factor decisions 和 attempts，并通过 Runtime Skill facades 复用现有 parser、statistics、simulation 和 report logic。工作流不会由 TA 完成事件自动启动；知识库只生成 review candidate，最终四文件 output 由独立原子 exporter 发布。

**Tech Stack:** TypeScript 5.7、Node.js 24、Zod、Vue 3、Fastify、SQLite、Vitest、Playwright、VS Code Extension API。

**Spec:** `docs/superpowers/specs/2026-09-01-ta-assist-beta-agent-architecture-design.md`

## Global Constraints

- 本计划依赖 `2026-09-01-ta-assist-agent-ta-workbook-beta.md` 交付的 validated baseline reference、product-language、product run reference 和 export primitives；缺失时停止实现，不复制替代版本。
- Measured Capability Feedback 是独立 Workflow Skill，不是 TA Workbook Analysis 的自动后续步骤。
- 每个 session 绑定一个不可变 baseline run；启动、恢复、计算和导出前都重新验证 lineage。
- 业务 `PASS | CONDITIONAL_PASS | INCOMPLETE | FAIL` 均可作为 baseline；execution/source validation failure 不可用。
- Beta 只接受原始测量样本：UTF-8 `.csv`、`.tsv` 或直接粘贴；不接受外部 Cp/Cpk 汇总作为真源。
- 每个 factor 最多 500 observations、文本最多 1 MiB；文件与粘贴必须进入同一个 parser。
- Identity/unit/spec mismatch 只阻断对应 factor；无 eligible factor 时整个 workflow blocked。
- Knowledge feedback 只生成 `pending_review | approved | rejected` candidate，不写知识库。
- 正常用户表面和 output 不得显示内部 `F0-F7`、state、artifact kind 或内部 run reference。
- Output 固定为 `output/measured-capability-feedback/<workbook-safe-name>/<UTC>-<suffix>/`，禁止覆盖。

---

### Task 1: Measurement Contracts 与 Durable Session Store

**Files:**
- Create: `packages/contracts/src/measured-capability-contracts.ts`
- Create: `packages/contracts/src/measured-capability-contracts.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/workbench/src/measurement-session-store-schema.ts`
- Create: `packages/workbench/src/measurement-session-store.ts`
- Create: `packages/workbench/src/measurement-session-store.test.ts`
- Create: `packages/workbench/src/measurement-state-machine.ts`
- Create: `packages/workbench/src/measurement-state-machine.test.ts`
- Modify: `packages/workbench/src/index.ts`

**Interfaces:**
- Produces: `MeasurementFeedbackLink`, `MeasurementFactorLink`, `MeasurementWorkflowSnapshot`, `MeasurementWorkflowCommand`, `MeasurementAttemptResult`.
- Produces: `createMeasurementSessionStore()`, `openMeasurementSessionStore()`, `reduceMeasurementCommand()`, `acceptMeasurementAttemptResult()`.
- Consumes: Plan A product run reference and validated baseline reference schemas.

- [ ] **Step 1: Write failing contract tests**

```ts
it("binds one immutable baseline with multiple factor links", () => {
  const link = measurementFeedbackLinkSchema.parse({
    baselineSessionId: "baseline-session",
    baselineRunReference: "controlled-baseline-reference",
    workbookContentHash: "a".repeat(64),
    factors: [{
      factorId: "b".repeat(64),
      worksheetName: "Analysis-A",
      drawingNumber: "DWG-100",
      dimId: "D12",
      baselineCalculationReference: "calculation-reference",
    }],
  });
  expect(link.factors).toHaveLength(1);
});

it("separates execution, business and export status", () => {
  const snapshot = measurementWorkflowSnapshotSchema.parse(fixture({
    executionStatus: "completed",
    businessDisposition: "FAIL",
    exportStatus: "pending",
  }));
  expect(snapshot.businessDisposition).toBe("FAIL");
});
```

- [ ] **Step 2: Write failing persistence and replay tests**

```ts
it("restores the last committed measurement state after reopen", async () => {
  const store = await createMeasurementSessionStore(options);
  await store.apply(createSessionCommand);
  await store.close();
  const reopened = await openMeasurementSessionStore(options);
  expect(await reopened.readSnapshot()).toMatchObject({ workflowId: "measured-capability-feedback-v1" });
});

it("does not apply a command receipt twice", async () => {
  const first = await store.apply(command);
  const replay = await store.apply(command);
  expect(replay).toEqual(first);
});
```

Cover stale revision, late attempt result, TA/measurement session ID mismatch and attempted baseline rebinding.

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `npx vitest run packages/contracts/src/measured-capability-contracts.test.ts packages/workbench/src/measurement-session-store.test.ts packages/workbench/src/measurement-state-machine.test.ts`

Expected: FAIL because contracts and durable store do not exist.

- [ ] **Step 4: Implement strict schemas and SQLite store**

Use the transaction/receipt pattern from the existing TA session store but create separate tables:

```sql
CREATE TABLE measurement_sessions (session_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL);
CREATE TABLE measurement_commands (session_id TEXT NOT NULL, command_id TEXT NOT NULL, result_json TEXT NOT NULL, PRIMARY KEY (session_id, command_id));
CREATE TABLE measurement_attempts (attempt_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, state TEXT NOT NULL, result_json TEXT);
CREATE TABLE measurement_artifact_refs (session_id TEXT NOT NULL, artifact_id TEXT NOT NULL, metadata_json TEXT NOT NULL, PRIMARY KEY (session_id, artifact_id));
```

Deep-parse snapshots on every read and write. A `bind_baseline` command is allowed exactly once.

- [ ] **Step 5: Run store and state tests**

Run: `npx vitest run packages/contracts/src/measured-capability-contracts.test.ts packages/workbench/src/measurement-session-store.test.ts packages/workbench/src/measurement-state-machine.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add packages/contracts/src/measured-capability-contracts* packages/contracts/src/index.ts packages/workbench/src/measurement-* packages/workbench/src/index.ts
git commit -m "feat: add durable measured capability sessions"
```

---

### Task 2: Eligible Baseline Resolution 与不可变绑定

**Files:**
- Create: `packages/workflow-runners/src/baseline-analysis-resolution.ts`
- Create: `packages/workflow-runners/src/baseline-analysis-resolution.test.ts`
- Modify: `packages/workflow-runners/src/types.ts`
- Modify: `packages/workflow-runners/src/index.ts`
- Modify: `packages/workflow-runners/src/existing-f6.ts`
- Create: `apps/f7-local-api/src/baseline-catalog.ts`
- Create: `apps/f7-local-api/src/baseline-catalog.test.ts`

**Interfaces:**
- Produces: `resolveEligibleBaseline(reference): EligibleBaselineResult`.
- Produces: baseline summaries safe for user selection and controlled internal factor links.
- Consumes: Plan A baseline source record with F3/F4/F5 references and hashes; existing `validateExistingF6()`.

- [ ] **Step 1: Write failing eligibility and lineage tests**

```ts
it.each(["PASS", "CONDITIONAL_PASS", "INCOMPLETE", "FAIL"])(
  "accepts a validated %s business baseline",
  async (disposition) => {
    const result = await resolveEligibleBaseline(validatedReference({ disposition }));
    expect(result.status).toBe("eligible");
  },
);

it("rejects a baseline with stale F3 factor identity", async () => {
  const result = await resolveEligibleBaseline(referenceWithF3HashDrift());
  expect(result).toMatchObject({ status: "rejected", reason: "baseline_lineage_invalid" });
});
```

Add tests for missing source artifacts, mismatched workbook hash, duplicate `(Drawing Number, DIM ID)`, invalid DIM ID and deleted source run.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run packages/workflow-runners/src/baseline-analysis-resolution.test.ts apps/f7-local-api/src/baseline-catalog.test.ts`

Expected: FAIL because resolver and catalog do not exist.

- [ ] **Step 3: Implement controlled baseline resolver**

```ts
export type EligibleBaselineResult =
  | { readonly status: "eligible"; readonly summary: EligibleBaselineSummary; readonly link: MeasurementFeedbackLink }
  | { readonly status: "rejected"; readonly reason: "baseline_lineage_invalid" | "baseline_source_missing" | "factor_identity_ambiguous" };
```

Call `validateExistingF6()` first, then re-read and validate F3/F4/F5 source references. Join factors through controlled worksheet/table/source-row identity and require one valid Drawing Number/DIM ID mapping. Never derive links from user product Markdown.

- [ ] **Step 4: Implement catalog selection boundary**

Return sanitized baseline summaries. Zero eligible baselines blocks launch; one still requires user confirmation; multiple require explicit selection. Persist the full controlled link only after confirmation.

- [ ] **Step 5: Run resolver tests**

Run: `npx vitest run packages/workflow-runners/src/baseline-analysis-resolution.test.ts apps/f7-local-api/src/baseline-catalog.test.ts packages/workflow-runners/src/existing-f6.test.ts`

Expected: PASS without weakening existing F6 validation.

- [ ] **Step 6: Commit**

```powershell
git add packages/workflow-runners/src apps/f7-local-api/src/baseline-catalog*
git commit -m "feat: resolve validated TA baselines for measurement feedback"
```

---

### Task 3: Measurement Runtime Skill Facades 与 CSV/TSV Adapter

**Files:**
- Create: `packages/workbench/src/measurement-runtime-skills.ts`
- Create: `packages/workbench/src/measurement-runtime-skills.test.ts`
- Create: `apps/f7-local-api/src/measurement-runtime-skill-implementations.ts`
- Create: `apps/f7-local-api/src/measurement-runtime-skill-implementations.test.ts`
- Create: `apps/f7-local-api/src/measurement-file-adapter.ts`
- Create: `apps/f7-local-api/src/measurement-file-adapter.test.ts`
- Modify: `apps/f7-local-api/src/server.ts`

**Interfaces:**
- Produces: nine fixed measurement Runtime Skill facades from the spec.
- Produces: `decodeMeasurementFile(fileName, bytes)` returning parser text.
- Consumes: `parseF7MeasurementPaste`, `validateF7MeasurementDataset`, `applyF7MeasurementDisposition`, `fitDistribution`, `runF7MonteCarlo`.

- [ ] **Step 1: Write failing facade metadata tests**

```ts
it("declares the complete measured capability skill sequence", () => {
  expect(MEASUREMENT_RUNTIME_SKILLS.map(({ skillId }) => skillId)).toEqual([
    "baseline-analysis-resolution-v1",
    "measurement-dataset-validation-v1",
    "measurement-distribution-evaluation-v1",
    "actual-capability-calculation-v1",
    "measured-simulation-v1",
    "measured-vs-estimated-comparison-v1",
    "knowledge-feedback-candidate-v1",
    "measured-capability-report-v1",
    "measurement-product-export-v1",
  ]);
});
```

- [ ] **Step 2: Write failing file adapter equivalence tests**

```ts
it.each(["measurements.csv", "measurements.tsv"])("feeds %s through the canonical parser", async (fileName) => {
  const text = "value,sequence\n0.51,1\n0.52,2";
  const decoded = decodeMeasurementFile(fileName, new TextEncoder().encode(text));
  expect(parseF7MeasurementPaste(request(decoded)).dataset?.contentHash).toBe(
    parseF7MeasurementPaste(request(text)).dataset?.contentHash,
  );
});
```

Add rejection tests for invalid UTF-8, unsupported extension, more than 1 MiB and linked source metadata.

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `npx vitest run packages/workbench/src/measurement-runtime-skills.test.ts apps/f7-local-api/src/measurement-runtime-skill-implementations.test.ts apps/f7-local-api/src/measurement-file-adapter.test.ts`

Expected: FAIL because facades and adapter do not exist.

- [ ] **Step 4: Implement facades over existing services**

Use the Plan A `RuntimeSkillFacade` interface. Each facade validates classification, idempotency key, baseline/factor identity and input hashes before calling one existing service. Do not register with smoke-only Skill SDK in Beta.

- [ ] **Step 5: Implement strict file decoding**

```ts
export function decodeMeasurementFile(fileName: string, bytes: Uint8Array): string {
  const extension = extname(fileName).toLowerCase();
  if (extension !== ".csv" && extension !== ".tsv") throw measurementFileError("unsupported_extension");
  if (bytes.byteLength === 0 || bytes.byteLength > 1_048_576) throw measurementFileError("invalid_size");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
```

Route decoded text and direct paste through the same measurement dataset facade.

- [ ] **Step 6: Run parser and facade regression tests**

Run: `npx vitest run packages/workbench/src/measurement-runtime-skills.test.ts apps/f7-local-api/src/measurement-runtime-skill-implementations.test.ts apps/f7-local-api/src/measurement-file-adapter.test.ts packages/workbook-catalog/src/f7-measurement-parser.test.ts`

Expected: PASS and identical datasets for equivalent file/paste content.

- [ ] **Step 7: Commit**

```powershell
git add packages/workbench/src/measurement-runtime-skills* apps/f7-local-api/src/measurement-runtime-skill-implementations* apps/f7-local-api/src/measurement-file-adapter* apps/f7-local-api/src/server.ts
git commit -m "feat: add measured capability runtime skill facades"
```

---

### Task 4: Per-Factor Partial Blocking 与 Distribution Approval

**Files:**
- Modify: `packages/workbench/src/measurement-state-machine.ts`
- Modify: `packages/workbench/src/measurement-state-machine.test.ts`
- Create: `packages/workbench/src/measurement-partial-blocking.test.ts`
- Modify: `apps/f7-local-api/src/measurement-runtime-skill-implementations.ts`
- Modify: `apps/f7-local-api/src/measurement-runtime-skill-implementations.test.ts`
- Modify: `apps/f7-local-api/src/f7-session-service.ts`
- Modify: `apps/f7-local-api/src/f7-session-service.test.ts`

**Interfaces:**
- Produces: per-factor `ready | blocked` state with reasons, dataset hash, exclusions, fit and approval.
- Enforces: workflow proceeds when at least one independently validated factor is eligible.
- Consumes: existing dataset validation and distribution fitting services.

- [ ] **Step 1: Write failing partial-blocking tests**

```ts
it("continues with one ready factor when another factor is blocked", () => {
  const next = acceptMeasurementAttemptResult(snapshotWithTwoFactors(), result({
    factors: [readyFactor("factor-a"), blockedFactor("factor-b", "unit_mismatch")],
  }));
  expect(next.state).toBe("distribution_review_required");
  expect(next.factors.find(({ factorId }) => factorId === "factor-b")?.status).toBe("blocked");
});

it("blocks the workflow when no factor is eligible", () => {
  expect(acceptMeasurementAttemptResult(snapshot, allBlockedResult).state).toBe("blocked");
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run packages/workbench/src/measurement-partial-blocking.test.ts apps/f7-local-api/src/f7-session-service.test.ts`

Expected: FAIL because the prototype uses all-or-nothing readiness.

- [ ] **Step 3: Implement factor-scoped state and commands**

Add commands `confirm_measurement_structure`, `apply_measurement_disposition` and `approve_distribution`, each bound to `factorId`, dataset hash and snapshot revision. A stale dataset invalidates downstream fit/approval for that factor only.

- [ ] **Step 4: Preserve explicit engineering approval**

Require proposed distribution family, fit artifact hash, approval identity and timestamp. Simulation cannot consume an unapproved measured distribution. Do not infer approval from fit rank.

- [ ] **Step 5: Run validation, fit and state tests**

Run: `npx vitest run packages/workbench/src/measurement-state-machine.test.ts packages/workbench/src/measurement-partial-blocking.test.ts apps/f7-local-api/src/f7-session-service.test.ts packages/workbook-catalog/src/f7-dataset-validation.test.ts packages/f7-statistics/src/distribution-fit.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add packages/workbench/src/measurement-* apps/f7-local-api/src/f7-session-service* apps/f7-local-api/src/measurement-runtime-skill-implementations*
git commit -m "feat: support factor-scoped measured capability review"
```

---

### Task 5: Actual Capability 与 Measured-vs-Estimated 计算

**Files:**
- Create: `packages/f7-statistics/src/actual-capability.ts`
- Create: `packages/f7-statistics/src/actual-capability.test.ts`
- Create: `packages/f7-statistics/src/measured-vs-estimated.ts`
- Create: `packages/f7-statistics/src/measured-vs-estimated.test.ts`
- Modify: `packages/f7-statistics/src/index.ts`
- Modify: `apps/f7-web/src/f7-capability.ts`
- Modify: `apps/f7-web/src/f7-capability.test.ts`
- Modify: `apps/f7-web/src/capability-comparison.ts`
- Modify: `apps/f7-web/src/capability-comparison.test.ts`
- Modify: `apps/f7-local-api/src/measurement-runtime-skill-implementations.ts`

**Interfaces:**
- Produces: `calculateActualCapability(input): ActualCapabilityResult`.
- Produces: `compareMeasuredWithEstimated(input): MeasuredVsEstimatedComparison`.
- Consumes: approved measured distribution, bound baseline specification and F4 calculation reference.

- [ ] **Step 1: Move existing frontend examples into failing package tests**

```ts
it("calculates two-sided measured capability from bound limits", () => {
  expect(calculateActualCapability({ mean: 10, sigma: 0.5, lowerSpecLimit: 8, upperSpecLimit: 12 })).toMatchObject({
    cp: 1.3333333333333333,
    cpk: 1.3333333333333333,
  });
});

it("reports measured degradation without changing the baseline", () => {
  const comparison = compareMeasuredWithEstimated({ estimatedCpk: 1.5, measuredCpk: 1.1 });
  expect(comparison).toMatchObject({ deltaCpk: -0.4, direction: "worse" });
});
```

- [ ] **Step 2: Run package tests and confirm failure**

Run: `npx vitest run packages/f7-statistics/src/actual-capability.test.ts packages/f7-statistics/src/measured-vs-estimated.test.ts`

Expected: FAIL because calculations only exist in frontend helpers.

- [ ] **Step 3: Implement deterministic statistics functions**

Require finite values, positive sigma and `LSL < USL`. Specifications come only from the bound baseline. Return calculation method/version and input hash. Never accept externally supplied Cp/Cpk as an override.

- [ ] **Step 4: Make frontend helpers delegate to package functions**

Preserve existing UI return shapes as adapters; remove duplicate formulas from frontend files. Facades call package functions directly.

- [ ] **Step 5: Run statistics, frontend and simulation tests**

Run: `npx vitest run packages/f7-statistics/src apps/f7-web/src/f7-capability.test.ts apps/f7-web/src/capability-comparison.test.ts packages/f7-simulation/src/simulation.test.ts`

Expected: PASS with no duplicate capability formula in frontend production code.

- [ ] **Step 6: Commit**

```powershell
git add packages/f7-statistics/src apps/f7-web/src/f7-capability* apps/f7-web/src/capability-comparison* apps/f7-local-api/src/measurement-runtime-skill-implementations.ts
git commit -m "feat: calculate and compare measured capability"
```

---

### Task 6: Knowledge Candidate 与 Measured Report Skill

**Files:**
- Create: `apps/f7-local-api/src/knowledge-feedback-candidate.ts`
- Create: `apps/f7-local-api/src/knowledge-feedback-candidate.test.ts`
- Create: `apps/f7-local-api/src/measured-capability-report.ts`
- Create: `apps/f7-local-api/src/measured-capability-report.test.ts`
- Modify: `apps/f7-local-api/src/index.ts`
- Modify: `packages/workbench/src/measurement-state-machine.ts`
- Modify: `packages/workbench/src/measurement-state-machine.test.ts`

**Interfaces:**
- Produces: `createKnowledgeFeedbackCandidate()` with immutable evidence bindings.
- Produces: `createMeasuredCapabilityReportProjection()` and renderer.
- Consumes: validated actual capability, simulation, comparison and candidate; does not recalculate.

- [ ] **Step 1: Write failing candidate lifecycle tests**

```ts
it("creates a pending candidate bound to measurement evidence", () => {
  expect(createKnowledgeFeedbackCandidate(input)).toMatchObject({
    status: "pending_review",
    baselineRunReference: input.baselineRunReference,
    measurementDatasetHashes: input.measurementDatasetHashes,
  });
});

it("never writes the knowledge base when approving a candidate", () => {
  const next = reduceMeasurementCommand(reviewSnapshot, approveCandidateCommand);
  expect(next.knowledgeCandidate?.status).toBe("approved");
  expect(writeKnowledgeBase).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Write failing report projection tests**

```ts
it("renders ready and blocked factors without internal feature labels", () => {
  const report = createMeasuredCapabilityReportProjection(reportInput);
  expect(report.factorResults).toHaveLength(2);
  expect(report.markdown).not.toMatch(/\bF[0-7]\b|Feature[ _-]?[0-7]/);
});
```

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `npx vitest run apps/f7-local-api/src/knowledge-feedback-candidate.test.ts apps/f7-local-api/src/measured-capability-report.test.ts packages/workbench/src/measurement-state-machine.test.ts`

Expected: FAIL because candidate lifecycle and product report are absent.

- [ ] **Step 4: Implement immutable candidate and explicit review commands**

Hash canonical baseline, factor identities, datasets, actual results and comparisons. `approve_knowledge_candidate` and `reject_knowledge_candidate` only change decision status and reviewer metadata.

- [ ] **Step 5: Implement report projection and renderer**

Use product-language headings. Include baseline summary, ready factor metrics, blocked factor reasons, distribution approvals, simulation provenance, actual-vs-estimated comparison and candidate status. Renderer consumes projection and performs no calculations.

- [ ] **Step 6: Run candidate and report tests**

Run: `npx vitest run apps/f7-local-api/src/knowledge-feedback-candidate.test.ts apps/f7-local-api/src/measured-capability-report.test.ts apps/f7-local-api/src/f7-report.test.ts packages/workbench/src/measurement-state-machine.test.ts`

Expected: PASS; old report tests remain a numerical compatibility check only.

- [ ] **Step 7: Commit**

```powershell
git add apps/f7-local-api/src/knowledge-feedback-candidate* apps/f7-local-api/src/measured-capability-report* apps/f7-local-api/src/index.ts packages/workbench/src/measurement-state-machine*
git commit -m "feat: generate measured capability feedback reports"
```

---

### Task 7: Measurement Product Export

**Files:**
- Create: `apps/f7-local-api/src/measurement-product-export.ts`
- Create: `apps/f7-local-api/src/measurement-product-export.test.ts`
- Create: `apps/f7-local-api/src/measurement-export-store.ts`
- Create: `apps/f7-local-api/src/routes/measurement-export.ts`
- Modify: `apps/f7-local-api/package.json`
- Modify: `apps/f7-local-api/tsconfig.json`
- Modify: `apps/f7-local-api/src/server.ts`
- Modify: `apps/f7-local-api/src/server.test.ts`

**Interfaces:**
- Produces: `exportMeasurementFeedback(sourceRunReference)`.
- Consumes: Plan A safe-name/run-reference/export primitives and validated measured report projection.
- Publishes: exactly four required user files.

- [ ] **Step 1: Write failing output and retry tests**

```ts
it("publishes the fixed four-file measurement output", async () => {
  const result = await exportMeasurementFeedback(validatedSource);
  expect(await listRegularFiles(result.root)).toEqual([
    "Actual-vs-Estimated-Comparison.json",
    "Knowledge-Feedback-Candidate.json",
    "Measured-Capability-Feedback-Report.md",
    "export-manifest.json",
  ]);
});

it("does not rerun analysis when retrying export", async () => {
  await exportMeasurementFeedback(validatedSource);
  await exportMeasurementFeedback(validatedSource);
  expect(runMeasurementAnalysis).not.toHaveBeenCalled();
});
```

Cover existing-identical, existing-conflict, staging crash, symlink ancestor, extra file, hash drift, execution failure and business `FAIL`.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run apps/f7-local-api/src/measurement-product-export.test.ts apps/f7-local-api/src/server.test.ts`

Expected: FAIL because exporter and route do not exist.

- [ ] **Step 3: Implement atomic four-file exporter**

Reuse Plan A primitives instead of copying path logic. Manifest enumerates every regular file with product display name, media type, byte size and SHA-256. Controlled export record retains internal source references; user manifest uses only opaque product reference.

- [ ] **Step 4: Add export route and state transition**

Allow export only after report projection validation. Persist `exportStatus` independently. Failed export returns a retry action that invokes only exporter facade.

- [ ] **Step 5: Run exporter and security tests**

Run: `npx vitest run apps/f7-local-api/src/measurement-product-export.test.ts apps/f7-local-api/src/server.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/f7-local-api/package.json apps/f7-local-api/tsconfig.json apps/f7-local-api/src/measurement-product-export* apps/f7-local-api/src/measurement-export-store.ts apps/f7-local-api/src/routes/measurement-export.ts apps/f7-local-api/src/server*
git commit -m "feat: publish measured capability feedback output"
```

---

### Task 8: Agent 路由、Resume/Status 与 Beta E2E

**Files:**
- Create: `apps/vscode-extension/src/workflow-intent.ts`
- Create: `apps/vscode-extension/src/workflow-intent.test.ts`
- Create: `apps/vscode-extension/src/measurement-launcher.ts`
- Create: `apps/vscode-extension/src/measurement-launcher.test.ts`
- Modify: `apps/vscode-extension/src/participant.ts`
- Modify: `apps/vscode-extension/src/extension.ts`
- Modify: `packages/agent-runtime/src/intents.ts`
- Modify: `packages/agent-runtime/src/runtime.ts`
- Modify: `apps/f7-local-api/src/server.ts`
- Modify: `apps/f7-local-api/src/main.ts`
- Modify: `apps/f7-web/src/App.vue`
- Create: `test/f8-e2e/measured-capability-feedback.spec.ts`
- Create: `test/f8-e2e/fixtures/measured-factor.csv`
- Modify: `README.md`
- Modify: `docs/governance/feature-register.md`

**Interfaces:**
- Produces: workflow-qualified active binding `{ workflowId, sessionId, url }`.
- Produces: intents `start_ta_analysis`, `start_measured_capability`, `resume`, `status`, `open_report`, `explain_blocker`.
- Consumes: durable measurement store, baseline catalog and measurement APIs.

- [ ] **Step 1: Write failing workflow-intent tests**

```ts
it("routes measured data language to the independent workflow", () => {
  expect(classifyWorkflowIntent("请基于之前的 TA 分析评估这份实测数据")).toEqual({
    type: "start_measured_capability",
  });
});

it("qualifies resume by workflow and session", () => {
  expect(activeBindingSchema.parse({
    workflowId: "measured-capability-feedback-v1",
    sessionId: "measurement-session",
    url: "http://127.0.0.1:4317",
  })).toBeDefined();
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run apps/vscode-extension/src/workflow-intent.test.ts apps/vscode-extension/src/measurement-launcher.test.ts packages/agent-runtime/src/intents.test.ts`

Expected: FAIL because runtime only exposes the placeholder `f7_status` behavior.

- [ ] **Step 3: Implement workflow-qualified Agent routing**

Replace single `activeSessionId` binding with `{ workflowId, sessionId, url }`. Starting measurement opens baseline selection; status/resume read the durable store and never create a session. A unique baseline still requires explicit confirmation.

- [ ] **Step 4: Connect UI to durable APIs**

Replace in-memory-only startup with store-backed session service. Preserve existing measurement entry, fit and simulation UI while adding baseline summary, factor status, candidate review and product-language progress. TA completion does not call measurement launch.

- [ ] **Step 5: Implement end-to-end Beta scenarios**

The Playwright test must cover:

```text
Agent measured-data prompt
  -> explicit baseline selection
  -> CSV upload and parser equivalence
  -> one ready and one blocked factor
  -> distribution approval
  -> actual capability and simulation
  -> actual-vs-estimated comparison
  -> candidate approve/reject without knowledge write
  -> service restart and session resume
  -> four-file output and manifest hash verification
```

Also verify multiple baselines are never guessed and TA completion creates no measurement session.

- [ ] **Step 6: Run focused and full verification**

Run:

```powershell
npm run build -- --force
npx vitest run packages/contracts/src/measured-capability-contracts.test.ts packages/workbench/src/measurement-* packages/workflow-runners/src/baseline-analysis-resolution.test.ts packages/f7-statistics/src apps/f7-local-api/src apps/f7-web/src apps/vscode-extension/src/workflow-intent.test.ts apps/vscode-extension/src/measurement-launcher.test.ts
npx playwright test test/f8-e2e/measured-capability-feedback.spec.ts test/f8-e2e/chat-entry.spec.ts
npm run package:vsix
npm run check:repository
git diff --check
```

Expected: all commands PASS; restart preserves decisions; no automatic TA-to-measurement transition or knowledge write occurs.

- [ ] **Step 7: Commit**

```powershell
git add apps/vscode-extension/src apps/f7-local-api/src apps/f7-web/src packages/agent-runtime/src test/f8-e2e README.md docs/governance/feature-register.md
git commit -m "feat: release measured capability feedback beta"
```
