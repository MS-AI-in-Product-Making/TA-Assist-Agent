# Issue #106 Governed Multimodal Interpretation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require every selected worksheet to receive a validated model interpretation built from its verified image bytes and complete structured Factor table.

**Architecture:** Data Parsing captures the original Factor ordinal and propagates it through F2, F3, and F5 identities. The server creates one descriptor-only model request per worksheet; the VS Code host fetches and revalidates image bytes immediately before sending a multimodal request. A strict result validator requires an exact one-to-one ordinal mapping, and the state machine blocks optimization and final reporting until every worksheet succeeds.

**Tech Stack:** TypeScript, Zod, Node.js artifact validation, VS Code Language Model API, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-07-issue-106-ux-agent-triggering-design.md`

## Global Constraints

- Every active Factor ordinal is read from the cell immediately left of Factor Description; it is never derived from source row or array index.
- Active Factors are the current F4 calculation factors linked by worksheet, table, and source row.
- Each worksheet request contains one verified image and all active Factor rows; data never crosses worksheet boundaries.
- Image bytes are not persisted in host-action JSON; only a restricted descriptor is persisted.
- Model output must map every active ordinal exactly once to the correct Factor identity. Missing, duplicate, extra, ambiguous, not-visible, or cross-worksheet mappings fail the worksheet.
- Model prose cannot replace structured calculation values or perform WC/RSS/Cpk/Yield calculations.
- Any failed selected worksheet blocks Design Optimization and prevents final report publication; `unavailable` is not a valid completion state.

---

### Task 1: Parse and Preserve Factor Ordinals in F1

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.ts`
- Modify: `packages/workbook-catalog/src/worksheet-analysis-assets.test.ts`
- Modify: `scripts/run-f1-full-validation.mjs`
- Modify: `scripts/f1-factor-actuals.mjs`
- Modify: `scripts/f1-factor-actuals.test.mjs`

**Interfaces:**
- Produces: `FactorOrdinalEvidence { value, rawText, sourceCell }` on each F1 active row.
- Consumed by: Task 2.

- [ ] **Step 1: Add failing workbook-layout tests**

```ts
it("reads the ordinal from the cell left of Factor Description", () => {
  const row = result.worksheets[0]!.tables[0]!.rows[0]!;
  expect(row.factorOrdinal).toEqual({ value: "A", rawText: "A", sourceCell: "C12" });
});

it("does not derive a blank ordinal from the source row", () => {
  expect(blankOrdinalRow.factorOrdinal.value).toBe("");
});
```

Cover skipped labels and multi-character labels without normalizing them into a new sequence.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/worksheet-analysis-assets.test.ts scripts/f1-factor-actuals.test.mjs`

Expected: FAIL because F1 rows do not carry ordinal evidence.

- [ ] **Step 3: Implement adjacent-cell extraction**

Read the source cell display text from `factorDescriptionColumn - 1`. Preserve raw text and A1 source cell. Keep blank and duplicate values visible for the downstream readiness gate; do not repair them.

- [ ] **Step 4: Run F1 tests**

Run the command from Step 2.

Expected: PASS for exact source values.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/contracts* packages/workbook-catalog/src/worksheet-analysis-assets* scripts/run-f1-full-validation.mjs scripts/f1-factor-actuals*
git commit -m "feat(f1): parse governed factor ordinals"
```

### Task 2: Propagate Ordinals through F2, F3, and F5

**Files:**
- Modify: `scripts/f2-artifact-loader.mjs`
- Modify: `scripts/f2-artifact-loader.test.mjs`
- Modify: `packages/workbook-catalog/src/f2-user-report.ts`
- Modify: `packages/workbook-catalog/src/f2-user-report.test.ts`
- Modify: `packages/workbook-catalog/src/f3-drawing-governance.ts`
- Modify: `packages/workbook-catalog/src/f3-drawing-governance.test.ts`
- Modify: `scripts/f5-artifact-loader.mjs`
- Modify: `scripts/f5-artifact-loader.test.mjs`
- Modify: `packages/workbook-catalog/src/f5-data-interpretation.ts`
- Modify: `packages/workbook-catalog/src/f5-data-interpretation.test.ts`
- Modify: `scripts/f5-report.mjs`
- Modify: `scripts/f5-report.test.mjs`

**Interfaces:**
- Consumes: F1 `FactorOrdinalEvidence`.
- Produces: field-identical ordinal evidence in F2 row, F3 governance row, and F5 complete context snapshot.

- [ ] **Step 1: Add field-by-field propagation failures**

Use one fixture row and assert `{ value, rawText, sourceCell, worksheetName, tableId, sourceRow }` remains identical through each stage. Add blank and duplicate ordinal blockers before interpretation.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run scripts/f2-artifact-loader.test.mjs packages/workbook-catalog/src/f2-user-report.test.ts packages/workbook-catalog/src/f3-drawing-governance.test.ts scripts/f5-artifact-loader.test.mjs packages/workbook-catalog/src/f5-data-interpretation.test.ts scripts/f5-report.test.mjs`

Expected: FAIL because downstream schemas omit ordinal evidence.

- [ ] **Step 3: Add fields and identity checks**

Propagate values without parsing display text. Reject a current workflow before model interpretation when any active ordinal is blank or duplicated inside a worksheet/table identity.

- [ ] **Step 4: Run propagation tests**

Run the command from Step 2.

Expected: PASS without changing historical artifact read semantics.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f2-artifact-loader* packages/workbook-catalog/src/f2-user-report* packages/workbook-catalog/src/f3-drawing-governance* scripts/f5-artifact-loader* packages/workbook-catalog/src/f5-data-interpretation* scripts/f5-report*
git commit -m "feat(contracts): propagate factor ordinals"
```

### Task 3: Define Strict Multimodal Request and Result Contracts

**Files:**
- Create: `packages/contracts/src/ta-multimodal-contracts.ts`
- Create: `packages/contracts/src/ta-multimodal-contracts.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/contracts/src/f8-contracts.test.ts`

**Interfaces:**
- Produces: `worksheetMultimodalModelRequestV1Schema`, `worksheetMultimodalModelResultV1Schema`, `f6ModelInterpretationV3ArtifactSchema`, `validateExactOrdinalMapping()`, and `assertCompleteWorksheetInterpretations()`.

- [ ] **Step 1: Write contract failures**

```ts
it.each(["missing", "duplicate", "extra", "ambiguous", "not_visible", "cross_worksheet"])(
  "rejects %s ordinal mappings",
  scenario => expect(() => validateWorksheetModelResult(request, resultFor(scenario))).toThrow(),
);
```

Add selected worksheet exact-set tests and request-hash binding tests.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run packages/contracts/src/ta-multimodal-contracts.test.ts packages/contracts/src/f8-contracts.test.ts`

Expected: FAIL because the contracts do not exist and host actions only carry text prompts.

- [ ] **Step 3: Implement contracts and pure validators**

```ts
export function validateExactOrdinalMapping(
  expectedRows: readonly WorksheetModelFactorRow[],
  mappings: readonly WorksheetOrdinalMapping[],
): void;

export function assertCompleteWorksheetInterpretations(
  selectedWorksheetNames: readonly string[],
  artifact: F6ModelInterpretationV3Artifact,
): void;
```

Compare `{ worksheetName, tableId, sourceRow, factorOrdinal }` tuples. Require `visibleStatus: "visible"` and exact request hash/worksheet identity.

- [ ] **Step 4: Run contract tests**

Run the command from Step 2.

Expected: PASS for complete mappings and fail closed for every malformed case.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts/src/ta-multimodal-contracts* packages/contracts/src/f8-contracts* packages/contracts/src/index.ts
git commit -m "feat(contracts): add governed multimodal interpretation"
```

### Task 4: Assemble Worksheet-Isolated Requests and Secure Image Reads

**Files:**
- Create: `apps/workbench-server/src/worksheet-interpretation-context.ts`
- Create: `apps/workbench-server/src/worksheet-interpretation-context.test.ts`
- Modify: `apps/workbench-server/src/conversation-context.ts`
- Modify: `apps/workbench-server/src/conversation-context.test.ts`
- Modify: `apps/workbench-server/src/routes/artifacts.ts`
- Modify: `apps/workbench-server/src/routes/host-actions.ts`
- Modify: `apps/workbench-server/src/auth.ts`
- Modify: `apps/workbench-server/src/server.ts`
- Modify: `apps/workbench-server/src/server.test.ts`

**Interfaces:**
- Produces: `buildWorksheetInterpretationContext(snapshot, worksheetName, artifacts)` and a restricted action-bound image read endpoint.
- Consumes: Task 3 request schema.

- [ ] **Step 1: Write two-worksheet isolation failures**

Use selected order `B, A`, distinct bytes/hashes/ordinals, and a deliberately swapped descriptor. Assert each request includes only its own image descriptor and all its own active F4 rows; swapped input fails before host dispatch.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run apps/workbench-server/src/worksheet-interpretation-context.test.ts apps/workbench-server/src/conversation-context.test.ts apps/workbench-server/src/server.test.ts`

Expected: FAIL because the current context chooses a generic first image and cannot serve action-bound bytes.

- [ ] **Step 3: Implement exact artifact selection**

Match worksheet name, workbook hash, input revision, table identity, path containment, and content hash. Persist descriptors only. Grant image read capability only to the claimed host action and exact artifact identity.

- [ ] **Step 4: Run server tests**

Run the command from Step 2.

Expected: PASS, including same-content-hash/different-worksheet identity coverage.

- [ ] **Step 5: Commit**

```powershell
git add apps/workbench-server/src/worksheet-interpretation-context* apps/workbench-server/src/conversation-context* apps/workbench-server/src/routes apps/workbench-server/src/auth.ts apps/workbench-server/src/server*
git commit -m "feat(workbench): assemble isolated multimodal requests"
```

### Task 5: Execute Revalidated Multimodal Requests in VS Code

**Files:**
- Create: `apps/vscode-extension/src/worksheet-multimodal-model.ts`
- Create: `apps/vscode-extension/src/worksheet-multimodal-model.test.ts`
- Modify: `apps/vscode-extension/src/host-action-pump.ts`
- Modify: `apps/vscode-extension/src/host-action-pump.test.ts`
- Modify: `apps/vscode-extension/src/model-host-prompt.ts`
- Modify: `apps/vscode-extension/src/model-host-prompt.test.ts`
- Modify: `apps/vscode-extension/src/extension.ts`
- Modify: `apps/vscode-extension/src/extension.test.ts`

**Interfaces:**
- Consumes: descriptor-only request and restricted image endpoint from Task 4.
- Produces: schema-valid `WorksheetMultimodalModelResultV1` or a structured worksheet blocker.

- [ ] **Step 1: Confirm the installed VS Code API shape**

Read the workspace's locked `vscode` typings and use its supported binary language-model part constructor. Do not guess or add a custom base64 prompt fallback.

- [ ] **Step 2: Write host adapter failures**

Test exact bytes/media type/all rows, image hash mismatch before `sendRequest`, no selected model, malformed model JSON, and ordinal ambiguity. Assert `sendRequest` is not called for preflight failures.

- [ ] **Step 3: Verify RED**

Run: `npx vitest run apps/vscode-extension/src/worksheet-multimodal-model.test.ts apps/vscode-extension/src/host-action-pump.test.ts apps/vscode-extension/src/extension.test.ts`

Expected: FAIL because host requests currently contain text only.

- [ ] **Step 4: Implement fetch, revalidation, and model dispatch**

Recompute SHA-256, check byte length/media type/worksheet/revision, then send exactly one image part and one structured text part. Parse result JSON and invoke Task 3 validators before submission.

- [ ] **Step 5: Run adapter tests**

Run the command from Step 3.

Expected: PASS; no model capability produces `model_capability_unavailable` without an interpretation artifact.

- [ ] **Step 6: Commit**

```powershell
git add apps/vscode-extension/src/worksheet-multimodal-model* apps/vscode-extension/src/host-action-pump* apps/vscode-extension/src/model-host-prompt* apps/vscode-extension/src/extension*
git commit -m "feat(vscode): execute worksheet multimodal models"
```

### Task 6: Gate Workflow Completion on Every Interpretation

**Files:**
- Modify: `packages/workbench/src/commands.ts`
- Modify: `packages/workbench/src/state-machine.ts`
- Modify: `packages/workbench/src/state-machine.test.ts`
- Modify: `packages/workbench/src/ta-workbook-orchestrator.ts`
- Modify: `packages/workbench/src/ta-workbook-orchestrator.test.ts`
- Modify: `apps/workbench-server/src/production-stage-runner.ts`
- Modify: `apps/workbench-server/src/production-stage-runner.test.ts`
- Modify: `packages/workflow-runners/src/types.ts`

**Interfaces:**
- Consumes: validated per-worksheet model results.
- Produces: immutable `f6-model-interpretation-v3` artifact and a hard transition prerequisite for Design Optimization.

- [ ] **Step 1: Write transition failures**

Test all worksheets success, one of two failed, stale revision result, result after workbook replacement, and exact selected-set mismatch. Assert one failure preserves valid internal diagnostics but does not start Design Optimization.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run packages/workbench/src/state-machine.test.ts packages/workbench/src/ta-workbook-orchestrator.test.ts apps/workbench-server/src/production-stage-runner.test.ts`

Expected: FAIL because model interpretation is optional and not a state transition gate.

- [ ] **Step 3: Add the governed interpretation stage**

Create one action per selected worksheet, bind results to expected revision/request hash, materialize one immutable aggregate artifact only after every result validates, and expose actionable blockers for failed worksheets.

- [ ] **Step 4: Run transition tests**

Run the command from Step 2.

Expected: PASS with no Design Optimization attempt after partial failure.

- [ ] **Step 5: Commit**

```powershell
git add packages/workbench/src packages/workflow-runners/src/types.ts apps/workbench-server/src/production-stage-runner*
git commit -m "feat(workbench): require complete model interpretation"
```

### Task 7: Add Defense-in-Depth F6 and Final Report Gates

**Files:**
- Modify: `scripts/f6-artifact-loader.mjs`
- Modify: `scripts/f6-artifact-loader.test.mjs`
- Modify: `packages/workflow-runners/src/f6.ts`
- Modify: `packages/workflow-runners/src/f6.test.ts`
- Modify: `scripts/f6-final-report.mjs`
- Modify: `scripts/f6-final-report.test.mjs`

**Interfaces:**
- Consumes: `f6-model-interpretation-v3` only for new workflows.
- Preserves: v1/v2 only in historical existing-artifact readers.

- [ ] **Step 1: Write hard-gate failures**

Test missing interpretation, v1/v2 on a new run, ordinal ambiguity, exact-set mismatch, and one blocked worksheet. Assert no optimization or `Feature6-Report.md` write occurs.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run scripts/f6-artifact-loader.test.mjs packages/workflow-runners/src/f6.test.ts scripts/f6-final-report.test.mjs`

Expected: FAIL because current behavior renders an unavailable section.

- [ ] **Step 3: Require v3 at loader, runner, and composer**

Remove the new-run unavailable fallback. Keep explicit sanitized reason codes for UI recovery. Do not delete historical v1/v2 schemas.

- [ ] **Step 4: Run gate tests**

Run the command from Step 2.

Expected: PASS and no final report file on any gate failure.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f6-artifact-loader* packages/workflow-runners/src/f6* scripts/f6-final-report*
git commit -m "feat(f6): fail closed on multimodal interpretation"
```

### Task 8: Two-Worksheet End-to-End Verification

**Files:**
- Modify: `test/f8-e2e/engineering-workspace.spec.ts`

**Interfaces:**
- Verifies the complete third-phase delivery before F6 v3 work begins.

- [ ] **Step 1: Add an end-to-end two-worksheet case**

Use different image bytes, hashes, ordinals, and Factor names. Select worksheets in reverse fixture order. Assert each model request and report interpretation contains only the matching worksheet context.

- [ ] **Step 2: Add model-unavailable and ambiguous-mapping cases**

Assert the UI shows a recoverable worksheet blocker and the current-report endpoint returns no final report.

- [ ] **Step 3: Run end-to-end and repository checks**

```powershell
npx playwright test test/f8-e2e/engineering-workspace.spec.ts
npm run build -- --force
npm run lint
npm test
```

Expected: every command exits 0.

- [ ] **Step 4: Commit**

```powershell
git add test/f8-e2e/engineering-workspace.spec.ts
git commit -m "test(e2e): verify isolated multimodal evidence"
```