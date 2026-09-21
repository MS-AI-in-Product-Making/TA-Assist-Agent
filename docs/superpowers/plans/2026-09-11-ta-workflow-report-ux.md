# TA Workflow and Report UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不重构项目、不改变计算内核和历史兼容读取的前提下，移除三个低价值用户提示，内部强制图像评估并按工作表隔离失败，完整呈现单张 14 列 Factor 表，修复 PDF 排版，并优化 ADO 标题示例与最终报告链接。

**Architecture:** 复用现有 F8 状态机、F2/F3/F4/F5/F6 数据源和 PDF 发布链，只调整标准新运行的状态转移与现有报告投影。为表达“单工作表图像评估失败、其余工作表继续”，新增一个与 v3 并存的最小版本化 outcome union；v3、历史 commands、CLI 参数和历史 artifact reader 保持不变。

**Tech Stack:** TypeScript、Node.js ESM、React、Vitest、Marked、受控 Edge/Chrome headless PDF export。

**Spec:** `docs/superpowers/specs/2026-09-11-ta-workflow-report-ux-design.md`

## Global Constraints

- 不改变项目目录结构，不重构无关模块，不修改 TA 计算公式或 capability/disposition 策略。
- 不删除 Analysis Context、Optimization Targets、image decision 的历史 schema、commands、CLI 参数或 artifact reader。
- 标准新运行固定记录 Analysis Context 与 Optimization Targets 为 `NOT_PROVIDED`，但内置 `f6-top3-tolerance-policy-v1` 保持原行为。
- 图像评估对标准新运行必选；单工作表失败只将该工作表投影为 `FAIL`，其余工作表继续。
- 每个工作表在第三节恰好展示一张 14 列 Factor 表；禁止拆表。
- 用户可见表格隐藏 Source Row、Notes、Validation Status、Missing Fields、Ordinal、Distribution、Variance Contribution；内部 provenance 保留。
- PDF 使用自然分页和稳定可读字号，不使用整页缩放、固定 worksheet 高度、负边距或隐藏溢出。
- F6 五文件发布集、Markdown/PDF 同源投影、manifest-last、SHA-256 与 `%PDF-` 校验保持不变。
- 每个任务仅修改列出的现有文件；编译或测试证明直接依赖时才可加入邻近文件。

## Execution Order

按依赖顺序执行 `Task 2 -> Task 1 -> Task 3 -> Task 4 -> Task 5 -> Task 6`。Task 2 先建立逐工作表终态表达，Task 1 才能让标准流程安全绕过图像选择门；编号保留为需求分组，不代表执行先后。

---

### Task 1: 简化标准工作流门控

**Files:**
- Modify: `packages/workbench/src/state-machine.ts`
- Test: `packages/workbench/src/state-machine.test.ts`
- Modify: `the retired F8 server app/src/server.ts`
- Test: `the retired F8 server app/src/server.test.ts`
- Modify: `.github/skills/design-optimization/SKILL.md`
- Modify: `.github/skills/result-interpretation/SKILL.md`
- Modify: `.github/skills/ta-assist-agent/SKILL.md`
- Test: `scripts/f6-skill.test.mjs`

**Interfaces:**
- Consumes: existing `resolveCompletionState()`, `appendF6InputDecisionReference()`, F8 decision reference format, existing historical confirmation commands.
- Produces: standard transition `f4_running -> f5_running -> f6_running`, internal image evaluation instruction, and two `NOT_PROVIDED` references without user prompts.

**Dependency:** Task 2 必须先完成，使 F4 completion 能建立逐工作表内部评估并等待全部 terminal outcomes。

- [ ] **Step 1: Write failing state-machine tests**

Update `enforces the governed F4-F6 ordering and state allowlists` to assert:

```ts
expect(completeStage(snapshotAt("f4_running")).state).toBe("f5_running");

const afterF5 = completeStage(snapshotAt("f5_running"));
expect(afterF5.state).toBe("f6_running");
expect(afterF5.priorRunReferences).toEqual(expect.arrayContaining([
  "f6-analysis-context:not_provided",
  "f6-optimization-targets:not_provided",
]));
```

Retain tests proving `confirm_image_decision`, `confirm_analysis_context`, and `confirm_optimization_targets` still parse and reduce historical snapshots.

- [ ] **Step 2: Run the narrow state-machine test and verify RED**

Run:

```powershell
npx vitest run packages/workbench/src/state-machine.test.ts
```

Expected: FAIL because F4 and F5 still enter the three decision states.

- [ ] **Step 3: Implement direct standard transitions**

In `resolveCompletionState()` change only:

```ts
case "f4_running":
  return "f5_running";
case "f5_running":
  return "f6_running";
```

At the F5 completion boundary, append the two existing not-provided references using the current helper. Do not delete decision states, command branches, schemas, or command allowlists.

- [ ] **Step 4: Update server standard-path tests**

Adjust the current full-flow server test to assert the server does not submit these commands in a new standard run:

```ts
expect(submittedCommands).not.toContain("confirm_image_decision");
expect(submittedCommands).not.toContain("confirm_analysis_context");
expect(submittedCommands).not.toContain("confirm_optimization_targets");
```

Keep separate tests for historical decision-state handling.

- [ ] **Step 5: Remove obsolete automatic gate submissions**

In `StoreBackedQueueSessionStore.applyAutomaticStageDecisions()`, remove only the standard-path workaround that auto-submits `confirm_image_decision`. Do not remove historical command handling or proposal materializers.

- [ ] **Step 6: Update Skill contract tests first**

Change `scripts/f6-skill.test.mjs` assertions so the standard workbook flow:

- contains no user confirmation for image evaluation, Analysis Context, or Optimization Targets;
- records both caller inputs as `NOT_PROVIDED`;
- retains both worksheet selection gates, required multimodal interpretation, Top 3 policy, and optional ADO publishing confirmation.

- [ ] **Step 7: Update the three Skill files minimally**

Remove the three standard-flow questions and document direct execution. Preserve historical artifact mode and CLI compatibility wording. Do not introduce new command shapes.

- [ ] **Step 8: Run focused workflow tests**

Run:

```powershell
npx vitest run packages/workbench/src/state-machine.test.ts the retired F8 server app/src/server.test.ts
npx vitest run scripts/f6-skill.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```powershell
git add packages/workbench/src/state-machine.ts packages/workbench/src/state-machine.test.ts the retired F8 server app/src/server.ts the retired F8 server app/src/server.test.ts .github/skills/design-optimization/SKILL.md .github/skills/result-interpretation/SKILL.md .github/skills/ta-assist-agent/SKILL.md scripts/f6-skill.test.mjs
git commit -m "feat: simplify governed TA workflow prompts"
```

---

### Task 2: 隔离单工作表图像评估失败

**Files:**
- Modify: `packages/contracts/src/ta-multimodal-contracts.ts`
- Test: `packages/contracts/src/ta-multimodal-contracts.test.ts`
- Modify: `the retired F8 server app/src/server.ts`
- Test: `the retired F8 server app/src/multimodal-coordinator.test.ts`
- Modify: `the retired F8 server app/src/production-stage-runner.ts`
- Test: `the retired F8 server app/src/production-stage-runner.test.ts`

**Interfaces:**
- Consumes: existing v3 worksheet request/result pair, request hashes, workbook identity and selected worksheet order.
- Produces: one new versioned aggregate that can hold `completed` or `failed` per worksheet without weakening v3 validation.

- [ ] **Step 1: Write failing contract tests for partial outcomes**

Add a strict versioned contract beside v3:

```ts
type F5MultimodalWorksheetOutcomeV4 =
  | {
      status: "completed";
      request: F5MultimodalWorksheetRequestV3;
      result: F5MultimodalWorksheetResultV3;
    }
  | {
      status: "failed";
      request: F5MultimodalWorksheetRequestV3;
      reasonCode: F5MultimodalEvaluationFailureReason;
      summary: string;
    };
```

Tests must reject duplicate/missing worksheet names, request hash mismatch, order mismatch, unknown reason codes and failed entries without request identity.

- [ ] **Step 2: Run contract tests and verify RED**

```powershell
npx vitest run packages/contracts/src/ta-multimodal-contracts.test.ts
```

Expected: FAIL because v4 schemas/validators do not exist.

- [ ] **Step 3: Implement the smallest parallel v4 contract**

Add only:

- `f5MultimodalEvaluationFailureReasonSchema`
- `f5MultimodalWorksheetOutcomeV4Schema`
- `f5MultimodalArtifactV4Schema`
- `validateF5MultimodalArtifactV4()`

Keep all v3 exports and behavior unchanged. Allowed failure reasons are exactly:

```ts
[
  "image_missing",
  "image_hash_mismatch",
  "image_identity_mismatch",
  "image_media_type_invalid",
  "evaluation_incomplete",
  "observation_readback_failed",
  "factor_mapping_failed",
  "model_capability_unavailable",
  "evaluation_failed",
]
```

- [ ] **Step 4: Write failing coordinator test for mixed outcomes**

Create two worksheet requests where one host result is complete and one is failed. Assert aggregate completion returns both ordered outcomes and does not call whole-attempt failure.

- [ ] **Step 5: Implement mixed-outcome aggregation**

Modify only the existing aggregation branch in `materializeCompletedMultimodalArtifact()` / `reconcileActiveMultimodalAttempt()`:

- complete responses become `{ status: "completed", request, result }`;
- failed responses become `{ status: "failed", request, reasonCode, summary }`;
- aggregate finalizes after every selected worksheet reaches a terminal outcome;
- no selected worksheet may disappear.

Do not add a model provider, network call, retry or new host action kind.

- [ ] **Step 6: Write failing production runner test**

Assert a v4 aggregate with one completed and one failed worksheet:

- starts F5 only for the completed worksheet set;
- preserves the failed worksheet identity for final report scope;
- does not synthesize F3/F4/F5 calculation output for the failed worksheet.

- [ ] **Step 7: Implement worksheet filtering at the existing runner boundary**

Derive the F5 invocation selection from v4 `completed` outcomes. Carry failed outcomes as report-scope blockers through the existing stage metadata/reference channel; do not mutate F2.

If the current F6 loader cannot consume this blocker reference without a new field, stop and revise the spec instead of widening F2/F6 schemas implicitly.

- [ ] **Step 8: Run focused multimodal tests**

```powershell
npx vitest run packages/contracts/src/ta-multimodal-contracts.test.ts the retired F8 server app/src/multimodal-coordinator.test.ts the retired F8 server app/src/production-stage-runner.test.ts
```

Expected: PASS.

- [ ] **Step 9: Scope gate**

Run:

```powershell
git diff --name-only
```

Expected: only Task 2 files. If implementing the report blocker requires broader request/loader changes, pause and ask for approval rather than extending scope.

- [ ] **Step 10: Commit Task 2**

```powershell
git add packages/contracts/src/ta-multimodal-contracts.ts packages/contracts/src/ta-multimodal-contracts.test.ts the retired F8 server app/src/server.ts the retired F8 server app/src/multimodal-coordinator.test.ts the retired F8 server app/src/production-stage-runner.ts the retired F8 server app/src/production-stage-runner.test.ts
git commit -m "feat: isolate worksheet image evaluation failures"
```

---

### Task 3: 输出单张 14 列完整 Factor 表

**Files:**
- Modify: `scripts/f6-final-report.mjs`
- Test: `scripts/f6-final-report.test.mjs`

**Interfaces:**
- Consumes: ready worksheet F2 rows plus F4 calculations; blocked worksheet F2 rows and `missingFieldSummary` only.
- Produces: exactly one 14-column Factor table per worksheet, including all blocked rows with field-specific `MISSING` and unavailable calculations as `N/A`.

- [ ] **Step 1: Write failing ready-table test**

Replace the old 20-column expectation with an exact header assertion:

```js
const expectedHeaders = [
  "Factor Description",
  "Part Name",
  "Part Category",
  "Drawing Number",
  "DIM ID",
  "Design Nominal",
  "+ Tolerance",
  "- Tolerance",
  "Long Term / Safety Factor",
  "Sigma Level",
  "Mean",
  "Tolerance",
  "One Sigma",
  "Capability / Knowledge Guidance",
];
```

Assert exactly `factorCount` body rows and absence of the seven hidden headers.

- [ ] **Step 2: Write failing blocked-table test**

Create a blocked worksheet with at least two F2 rows and `missingFieldSummary = [{ field: "factorName", factorCount: 1, sourceRows: [16] }]`. Assert:

- both rows appear;
- row 16 Factor Description is `MISSING`;
- existing row values remain visible;
- Mean, Tolerance, One Sigma and unavailable guidance are `N/A`;
- no hidden column is rendered;
- only one Factor table exists in that worksheet section.

- [ ] **Step 3: Run report tests and verify RED**

```powershell
npx vitest run scripts/f6-final-report.test.mjs
```

Expected: FAIL because ready has 20 columns and blocked has no table.

- [ ] **Step 4: Implement one shared 14-column table renderer**

Add a local helper such as:

```js
function renderCompleteFactorTable(rows, catalog) {
  // renders the exact 14 headers and supplied display cells
}
```

Use it from both `renderF6V3Worksheet()` and `renderF6V3BlockedWorksheet()`. Do not change artifact schemas or calculation values.

- [ ] **Step 5: Implement ready row projection**

Continue using `v3CompleteFactorRows()` and assert its row count equals `calculation.factorCount`. Drop only the seven hidden display columns; provenance remains in input artifacts.

- [ ] **Step 6: Implement blocked row projection from F2 only**

Build `Map<sourceRow, Set<field>>` from `missingFieldSummary`. For each F2 row:

- render validated `actualFields` values;
- render `MISSING` only when the controlled summary marks that field missing;
- render `N/A` for Mean, Tolerance, One Sigma and unavailable guidance;
- emit an explicit row marker/class only for a required-missing row.

Do not call F4/F5/F6 or infer values for blocked rows.

- [ ] **Step 7: Run focused report tests**

```powershell
npx vitest run scripts/f6-final-report.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```powershell
git add scripts/f6-final-report.mjs scripts/f6-final-report.test.mjs
git commit -m "feat: include complete factor tables in F6 reports"
```

---

### Task 4: 修复 PDF 自然分页与可读性

**Files:**
- Modify: `packages/product-export/src/f6-pdf-report.ts`
- Test: `packages/product-export/src/f6-pdf-export.test.ts`
- Test: `the retired F8 server app/src/f6-pdf-report.test.ts`

**Interfaces:**
- Consumes: unchanged governed Markdown with one 14-column table per worksheet.
- Produces: self-contained A4 landscape HTML that preserves complete tables and naturally paginates before controlled Chromium PDF printing.

- [ ] **Step 1: Write failing renderer tests**

Assert rendered HTML:

```ts
expect(html).toContain("<table class=\"factor-table factor-table--complete\">");
expect(html).toContain("@page { size:A4 landscape");
expect(html).not.toContain("drawing-health");
expect(html).not.toContain("fitWorksheetPages");
expect(html).not.toContain("height:174mm");
expect(html).not.toContain("overflow:hidden");
expect(html).not.toContain("overflow-wrap:anywhere");
```

Also assert every Factor Description and `MISSING` marker remains in HTML.

- [ ] **Step 2: Run PDF renderer tests and verify RED**

```powershell
npx vitest run packages/product-export/src/f6-pdf-export.test.ts the retired F8 server app/src/f6-pdf-report.test.ts
```

Expected: FAIL because the renderer substitutes the Factor table and injects fit scaling.

- [ ] **Step 3: Preserve the complete Factor table**

Add an exact 14-header detector in `F6PdfRenderer.table()`. For that table call `super.table(token)` and add `factor-table factor-table--complete`; never route it to `drawingHealthGraph()`.

Do not change statistical and contributor graph transforms unless a focused test proves they cause overflow after the Factor table fix.

- [ ] **Step 4: Replace fixed-page CSS with natural flow**

Change only print layout rules:

- `@page { size:A4 landscape; margin:10mm 8mm 12mm; }`
- remove worksheet fixed height, negative margin, hidden overflow and forced `break-after`;
- keep a non-negative section margin and optional `break-before:page` for worksheet starts;
- remove `.worksheet-fit` transforms and `FIT_SCRIPT` entirely;
- retain `thead { display:table-header-group; }` and `tr { break-inside:avoid; }`;
- assign stable widths to the 14 Factor columns;
- use normal word wrapping, at most two visual lines where content permits;
- use a printable pale-red missing-row style;
- keep body/table font at a readable floor, initially 8.5pt or higher.

- [ ] **Step 5: Run renderer tests**

```powershell
npx vitest run packages/product-export/src/f6-pdf-export.test.ts the retired F8 server app/src/f6-pdf-report.test.ts
```

Expected: PASS.

- [ ] **Step 6: Generate a real governed PDF from the current fixture**

Run the repository's existing focused F6 flow or current report renderer without altering the source workbook. Capture the newly published PDF path from command output.

- [ ] **Step 7: Inspect real PDF text and pages**

Use available PDF tooling to verify:

- `%PDF-` signature;
- every worksheet title exists;
- every expected Factor Description exists;
- `MISSING` appears for blocked required fields;
- no extracted text is split into one character per line;
- page count is plausible and no content is omitted.

Do not add `pdfjs-dist` unless built-in tooling cannot perform this check; dependency addition requires explicit scope approval.

- [ ] **Step 8: Visually inspect desktop PDF pages**

Open the newly generated local PDF and inspect screenshots for title clipping, readable text, repeated headers, unsplit rows and excessive blank space. If a CSS defect is found, change one rule at a time and rerun Steps 5-8.

- [ ] **Step 9: Commit Task 4**

```powershell
git add packages/product-export/src/f6-pdf-report.ts packages/product-export/src/f6-pdf-export.test.ts the retired F8 server app/src/f6-pdf-report.test.ts
git commit -m "fix: render readable naturally paginated F6 PDFs"
```

---

### Task 5: 优化 ADO 标题示例与报告链接

**Files:**
- Modify: `the retired F8 web app/src/components/AdoWorkspaceDecision.tsx`
- Test: `the retired F8 web app/src/components/AdoWorkspaceDecision.test.tsx`
- Modify only if needed: `the retired F8 web app/src/styles.css`
- Modify: `.github/skills/design-optimization/SKILL.md`
- Modify: `.github/skills/ta-assist-agent/SKILL.md`
- Test: `scripts/f6-skill.test.mjs`

**Interfaces:**
- Consumes: existing `defaultCreateTitle(workbookFileName)` and validator-confirmed final report paths.
- Produces: adjacent expanded title example with copy behavior, and two Excel-named workspace-relative final links without user-visible absolute paths.

- [ ] **Step 1: Write failing ADO component tests**

Assert:

```tsx
expect(screen.getByLabelText(/Title example/i)).toHaveValue(
  "[TA Requirement][Project][Phase] Update Drawing Requirements for Gearbox TA.xlsx",
);
expect(screen.getByRole("button", { name: /copy title example/i })).toHaveAttribute("title");
```

Mock `navigator.clipboard.writeText`; clicking copy must pass the complete expanded example, leave editable title unchanged, and not call `onSubmit`.

- [ ] **Step 2: Run component test and verify RED**

```powershell
npx vitest run the retired F8 web app/src/components/AdoWorkspaceDecision.test.tsx
```

Expected: FAIL because the example remains generic and has no copy button.

- [ ] **Step 3: Implement the adjacent example control**

Compute the example once with `defaultCreateTitle(workbookFileName)`. Keep the existing readonly input and add an adjacent icon-style button with `aria-label` and `title`.

Use `navigator.clipboard.writeText(example)` when available. If unavailable, keep focus/select behavior; do not add a package dependency or unrelated clipboard abstraction.

- [ ] **Step 4: Add only necessary CSS**

Reuse `.icon-button`. Add one local wrapper rule only if needed to keep the readonly example and button adjacent without layout shift.

- [ ] **Step 5: Write failing final-link contract tests**

Update `scripts/f6-skill.test.mjs` to require exactly two labels derived from the validated workbook basename:

```md
[<Excel basename> - TA Report](<validated workspace-relative markdown path>)
[<Excel basename> - TA Report PDF](<validated workspace-relative pdf path>)
```

Assert successful user-visible output does not require or print `完整 Markdown 报告路径:` or `完整 PDF 报告路径:`. Keep the rule that both links are validator-confirmed and fail closed together.

- [ ] **Step 6: Update Skill presentation contract**

Modify only final user-facing presentation language. Do not change CLI machine output or artifact validation.

- [ ] **Step 7: Run focused UI and Skill tests**

```powershell
npx vitest run the retired F8 web app/src/components/AdoWorkspaceDecision.test.tsx
npx vitest run scripts/f6-skill.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

```powershell
git add the retired F8 web app/src/components/AdoWorkspaceDecision.tsx the retired F8 web app/src/components/AdoWorkspaceDecision.test.tsx the retired F8 web app/src/styles.css .github/skills/design-optimization/SKILL.md .github/skills/ta-assist-agent/SKILL.md scripts/f6-skill.test.mjs
git commit -m "feat: streamline TA report links and ADO title copy"
```

---

### Task 6: 集成验证与范围审计

**Files:**
- Modify only when a failing in-scope test demonstrates a direct defect in the approved behavior.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: verified branch with no unrelated changes and a governed sample Markdown/PDF report.

- [ ] **Step 1: Run all focused tests**

```powershell
npx vitest run packages/contracts/src/ta-multimodal-contracts.test.ts packages/workbench/src/state-machine.test.ts the retired F8 server app/src/multimodal-coordinator.test.ts the retired F8 server app/src/production-stage-runner.test.ts the retired F8 server app/src/server.test.ts scripts/f6-final-report.test.mjs packages/product-export/src/f6-pdf-export.test.ts the retired F8 server app/src/f6-pdf-report.test.ts the retired F8 web app/src/components/AdoWorkspaceDecision.test.tsx
npx vitest run scripts/f6-skill.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run build and repository checks**

```powershell
npm run build -- --force
npm run check:repository
```

Expected: PASS.

- [ ] **Step 3: Run governed F6 output verification**

```powershell
node scripts/verify-current-f6.mjs
```

Expected: accepted five-file output, matching Markdown/PDF hashes and valid PDF signature.

- [ ] **Step 4: Inspect final generated reports**

Verify the current sample workbook report has:

- no three removed prompts in the standard flow;
- one 14-column Factor table in every worksheet section;
- complete blocked worksheet rows;
- field-specific `MISSING` and unavailable `N/A`;
- no title clipping, character-by-character wrapping or hidden content;
- two Excel-named clickable final report links.

- [ ] **Step 5: Audit branch scope**

```powershell
git diff main...HEAD --stat
git diff main...HEAD --name-only
git status --short --branch
```

Expected: only approved files and generated governed test outputs excluded by repository policy. No schema/CLI deletion, calculation-kernel changes or unrelated formatting.

- [ ] **Step 6: Request code review**

Use `superpowers:requesting-code-review` against `main...HEAD`. Resolve only findings that affect the approved requirements.

- [ ] **Step 7: Final verification before completion**

Use `superpowers:verification-before-completion`; rerun the focused tests, build and governed verifier after the last code change. Report exact commands and outcomes.

