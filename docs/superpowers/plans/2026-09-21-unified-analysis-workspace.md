# Unified Analysis Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish every new complete F1-F6 analysis into one collision-safe, user-visible folder under `test` with six fixed stage directories and a governed lifecycle summary.

**Architecture:** Add a versioned workspace allocator and summary writer to `@ai-assist/workflow-runners`. The interactive Copilot Skill allocates one workspace before F1, then each existing stage runner receives its canonical stage path and records validated artifacts in the root summary. Historical `test/demo-output` readers remain read-only.

**Tech Stack:** TypeScript, Node.js ESM, Zod, npm workspaces, Vitest, PowerShell, governed JSON/Markdown/PDF artifacts

**Spec:** `docs/superpowers/specs/2026-09-21-unified-analysis-workspace-f8-retirement-design.md`

## Dependency

Execute `docs/superpowers/plans/2026-09-21-f8-participant-retirement.md` first so the output migration does not update F8/Workbench paths that will be deleted.

## Global Constraints

- New complete F1-F6 analyses write under `test\<local YYYYMMDD - workbook basename[-N]>\`.
- Use exactly six approved code-plus-description stage folders.
- Do not create timestamp/UUID run directories beneath stage folders.
- Preserve all F1-F6 engineering logic, confirmations, hashes, manifests, atomic writes, and fail-closed behavior.
- Preserve historical `test/demo-output` artifacts and supported validators as read-only.
- Keep F7 output and workflow independent.
- Preserve the uncommitted F6 report-layout changes already present on the branch.

---

### Task 1: Define the Workspace Contract

**Files:**
- Create: `packages/workflow-runners/src/analysis-workspace.ts`
- Create: `packages/workflow-runners/src/analysis-workspace.test.ts`
- Modify: `packages/workflow-runners/src/index.ts`

**Interfaces:**
- Produces: `ANALYSIS_STAGE_DIRS`, `AnalysisWorkspaceLayout`, `AnalysisWorkspaceSummary`, `formatLocalDateYYYYMMDD`, `resolveAnalysisWorkspaceStagePaths`, and validation helpers.

- [ ] **Step 1: Write failing contract tests**

Test the exact constants and schema:

```ts
expect(ANALYSIS_STAGE_DIRS).toEqual({
  f1: "01 - F1 Data Parsing",
  f2: "02 - F2 Data Cleaning",
  f3: "03 - F3 Drawing Governance",
  f4: "04 - F4 Calculation Engine",
  f5: "05 - F5 Result Interpretation",
  f6: "06 - F6 Design Optimization",
});

expect(formatLocalDateYYYYMMDD(new Date(2026, 8, 21, 23, 59))).toBe("20260921");
```

Add rejection cases for absolute stage paths, traversal, renamed stages, changed workbook identity, a completed downstream stage with an incomplete predecessor, and `overallStatus: "completed"` before F6 completion.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run packages/workflow-runners/src/analysis-workspace.test.ts --reporter=verbose
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the types and validators**

Implement:

```ts
export const ANALYSIS_STAGE_DIRS = {
  f1: "01 - F1 Data Parsing",
  f2: "02 - F2 Data Cleaning",
  f3: "03 - F3 Drawing Governance",
  f4: "04 - F4 Calculation Engine",
  f5: "05 - F5 Result Interpretation",
  f6: "06 - F6 Design Optimization",
} as const;

export type AnalysisStage = keyof typeof ANALYSIS_STAGE_DIRS;
export type AnalysisStageStatus = "pending" | "running" | "completed" | "failed" | "blocked";

export interface AnalysisWorkspaceStagePaths {
  readonly f1: string;
  readonly f2: string;
  readonly f3: string;
  readonly f4: string;
  readonly f5: string;
  readonly f6: string;
}

export function formatLocalDateYYYYMMDD(now: Date): string;
export function resolveAnalysisWorkspaceStagePaths(analysisRoot: string): AnalysisWorkspaceStagePaths;
export function validateAnalysisWorkspaceSummary(summary: AnalysisWorkspaceSummary): void;
```

Use existing workbook filename and path-containment helpers; do not duplicate their validation.

- [ ] **Step 4: Run tests**

```powershell
npx vitest run packages/workflow-runners/src/analysis-workspace.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workflow-runners/src/analysis-workspace.ts packages/workflow-runners/src/analysis-workspace.test.ts packages/workflow-runners/src/index.ts
git commit -m "feat: define analysis workspace contract" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Allocate Collision-Safe Analysis Roots

**Files:**
- Modify: `packages/workflow-runners/src/analysis-workspace.ts`
- Modify: `packages/workflow-runners/src/analysis-workspace.test.ts`

**Interfaces:**
- Consumes: validated workbook filename/content hash and local `Date`.
- Produces: `allocateAnalysisWorkspace(input): AnalysisWorkspaceLayout`.

- [ ] **Step 1: Write failing allocator tests**

Define the API:

```ts
export interface AllocateAnalysisWorkspaceInput {
  readonly testRoot: string;
  readonly workbookFileName: string;
  readonly workbookContentHash: string;
  readonly now: Date;
}

export function allocateAnalysisWorkspace(input: AllocateAnalysisWorkspaceInput): AnalysisWorkspaceLayout;
```

Assert:

```ts
expect(first.analysisRoot).toEndWith(
  "test\\20260921 - Maera_gap_TP_brkt_and _battery_20260305V1 - test",
);
expect(second.analysisRoot).toEndWith(
  "test\\20260921 - Maera_gap_TP_brkt_and _battery_20260305V1 - test -1",
);
expect(third.analysisRoot).toEndWith(
  "test\\20260921 - Maera_gap_TP_brkt_and _battery_20260305V1 - test -2",
);
```

Add two concurrent allocations and assert distinct roots. Assert unsafe names and a `testRoot` escape fail.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run packages/workflow-runners/src/analysis-workspace.test.ts --reporter=verbose
```

- [ ] **Step 3: Implement exclusive allocation**

Use synchronous exclusive directory creation in a bounded retry loop. Create the six fixed stage directories only after the root is exclusively allocated. Do not probe then create in separate non-atomic steps.

- [ ] **Step 4: Run tests**

```powershell
npx vitest run packages/workflow-runners/src/analysis-workspace.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workflow-runners/src/analysis-workspace.ts packages/workflow-runners/src/analysis-workspace.test.ts
git commit -m "feat: allocate analysis workspaces" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Persist the Governed Run Summary

**Files:**
- Modify: `packages/workflow-runners/src/analysis-workspace.ts`
- Modify: `packages/workflow-runners/src/analysis-workspace.test.ts`

**Interfaces:**
- Produces: `createInitialAnalysisWorkspaceSummary`, `recordAnalysisStageStarted`, `recordAnalysisStageCompleted`, `recordAnalysisStageFailed`, `writeAnalysisWorkspaceSummary`.

- [ ] **Step 1: Write failing lifecycle tests**

Specify:

```ts
export function createInitialAnalysisWorkspaceSummary(layout: AnalysisWorkspaceLayout): AnalysisWorkspaceSummary;
export function recordAnalysisStageStarted(summary: AnalysisWorkspaceSummary, stage: AnalysisStage): AnalysisWorkspaceSummary;
export function recordAnalysisStageCompleted(
  summary: AnalysisWorkspaceSummary,
  stage: AnalysisStage,
  artifacts: Readonly<Record<string, string>>,
): AnalysisWorkspaceSummary;
export function recordAnalysisStageFailed(
  summary: AnalysisWorkspaceSummary,
  stage: AnalysisStage,
  failureCategory: string,
): AnalysisWorkspaceSummary;
export function writeAnalysisWorkspaceSummary(layout: AnalysisWorkspaceLayout, summary: AnalysisWorkspaceSummary): void;
```

Assert legal ordered transitions, blocked downstream stages after failure, relative artifact paths only, immutable input objects, and temp-file plus rename publication.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run packages/workflow-runners/src/analysis-workspace.test.ts --reporter=verbose
```

- [ ] **Step 3: Implement lifecycle and atomic write**

Write `analysis-run-summary.json` beside the six stage folders. Use a same-directory temporary file, validate the complete object, rename atomically, and remove only the exact temporary file on failure.

- [ ] **Step 4: Run tests**

```powershell
npx vitest run packages/workflow-runners/src/analysis-workspace.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workflow-runners/src/analysis-workspace.ts packages/workflow-runners/src/analysis-workspace.test.ts
git commit -m "feat: track analysis workspace lifecycle" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Route F1 and F2 into Fixed Stage Folders

**Files:**
- Modify: `packages/workflow-runners/src/f1-f2.ts`
- Modify: `packages/workflow-runners/src/f1-f2.test.ts`
- Modify: `scripts/run-f1-full-validation.mjs`
- Modify: `scripts/run-f1-full-validation.test.mjs`
- Modify: `scripts/run-f2-full-validation.mjs`
- Modify: `scripts/run-f2-full-validation.test.mjs`
- Modify: `.github/skills/data-parsing/SKILL.md`
- Modify: `.github/skills/data-cleaning/SKILL.md`

**Interfaces:**
- Consumes: `AnalysisWorkspaceLayout.stagePaths.f1` and `.f2`.
- Produces: validated F1/F2 artifact references recorded in the root summary.

- [ ] **Step 1: Write failing workspace-path tests**

Add an `analysisWorkspace` request option and assert that one F1/F2 run writes parsed assets only under F1 and cleaning artifacts only under F2. Assert no `f2-runs`, timestamp, or UUID directory is created.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run packages/workflow-runners/src/f1-f2.test.ts scripts/run-f1-full-validation.test.mjs scripts/run-f2-full-validation.test.mjs --reporter=verbose
```

- [ ] **Step 3: Implement workspace routing**

Keep explicit legacy roots accepted for historical tests. For current full-flow writes, require the workspace paths and replace the `f2-runs/<workbook>/<runId>` resolver with direct F1/F2 stage roots.

Update both Skills to create/reuse one workspace and pass its canonical root to subsequent stages.

- [ ] **Step 4: Run tests**

```powershell
npx vitest run packages/workflow-runners/src/f1-f2.test.ts scripts/run-f1-full-validation.test.mjs scripts/run-f2-full-validation.test.mjs --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workflow-runners/src/f1-f2.ts packages/workflow-runners/src/f1-f2.test.ts scripts/run-f1-full-validation.mjs scripts/run-f1-full-validation.test.mjs scripts/run-f2-full-validation.mjs scripts/run-f2-full-validation.test.mjs .github/skills/data-parsing/SKILL.md .github/skills/data-cleaning/SKILL.md
git commit -m "feat: publish F1 and F2 into analysis workspace" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Route F3 and F4 into Fixed Stage Folders

**Files:**
- Modify: `packages/workflow-runners/src/f3.ts`
- Modify: `packages/workflow-runners/src/f3.test.ts`
- Modify: `packages/workflow-runners/src/f4.ts`
- Modify: `packages/workflow-runners/src/f4.test.ts`
- Modify: `scripts/run-f3-full-validation.mjs`
- Modify: `scripts/run-f3-full-validation.test.mjs`
- Modify: `scripts/run-f4-full-validation.mjs`
- Modify: `scripts/run-f4-full-validation.test.mjs`
- Modify: `.github/skills/drawing-governance/SKILL.md`
- Modify: `.github/skills/ta-calculation/SKILL.md`

**Interfaces:**
- Consumes: completed F2/F3 artifact references from the workspace summary.
- Produces: F3/F4 artifact references and unchanged identity/hash validation.

- [ ] **Step 1: Write failing path and handoff tests**

Assert F3 writes directly to `03 - F3 Drawing Governance`, F4 writes directly to `04 - F4 Calculation Engine`, and neither creates `feature3-output`, `f4-runs`, or run-id children. Add path-escape and wrong-workbook-hash rejection tests.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run packages/workflow-runners/src/f3.test.ts packages/workflow-runners/src/f4.test.ts scripts/run-f3-full-validation.test.mjs scripts/run-f4-full-validation.test.mjs --reporter=verbose
```

- [ ] **Step 3: Implement workspace routing**

Modify `resolveFeature3OutputLayout` and the F4 output resolver to accept canonical stage roots. Keep old explicit roots read-compatible but make current full-flow write code choose workspace paths.

- [ ] **Step 4: Run tests**

```powershell
npx vitest run packages/workflow-runners/src/f3.test.ts packages/workflow-runners/src/f4.test.ts scripts/run-f3-full-validation.test.mjs scripts/run-f4-full-validation.test.mjs --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workflow-runners/src/f3.ts packages/workflow-runners/src/f3.test.ts packages/workflow-runners/src/f4.ts packages/workflow-runners/src/f4.test.ts scripts/run-f3-full-validation.mjs scripts/run-f3-full-validation.test.mjs scripts/run-f4-full-validation.mjs scripts/run-f4-full-validation.test.mjs .github/skills/drawing-governance/SKILL.md .github/skills/ta-calculation/SKILL.md
git commit -m "feat: publish F3 and F4 into analysis workspace" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Route F5 into Its Fixed Stage Folder

**Files:**
- Modify: `packages/workflow-runners/src/f5.ts`
- Modify: `packages/workflow-runners/src/f5.test.ts`
- Modify: `scripts/run-f5-full-validation.mjs`
- Modify: `scripts/run-f5-full-validation.test.mjs`
- Modify: `.github/skills/result-interpretation/SKILL.md`

**Interfaces:**
- Consumes: workspace F1/F3/F4 references.
- Produces: consolidated F5 report and image-observation references under stage F5.

- [ ] **Step 1: Write failing consolidation tests**

Assert F5 report and controlled observation files are beneath `05 - F5 Result Interpretation`; no new `f5-runs` or `f5-observations` root is created. Preserve existing symlink, traversal, and workbook-identity rejection tests.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run packages/workflow-runners/src/f5.test.ts scripts/run-f5-full-validation.test.mjs --reporter=verbose
```

- [ ] **Step 3: Implement F5 workspace publication**

Resolve both F5 report and image-observation locations from the F5 stage root. Use semantic `evidence` or `images` folders only where the current contract requires multiple files. Keep manifest and atomic publication behavior unchanged.

- [ ] **Step 4: Run tests**

```powershell
npx vitest run packages/workflow-runners/src/f5.test.ts scripts/run-f5-full-validation.test.mjs --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workflow-runners/src/f5.ts packages/workflow-runners/src/f5.test.ts scripts/run-f5-full-validation.mjs scripts/run-f5-full-validation.test.mjs .github/skills/result-interpretation/SKILL.md
git commit -m "feat: publish F5 into analysis workspace" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 7: Route F6 into Its Fixed Stage Folder

**Files:**
- Modify: `packages/workflow-runners/src/f6.ts`
- Modify: `packages/workflow-runners/src/f6.test.ts`
- Modify: `scripts/f6-output-layout.mjs`
- Modify: `scripts/f6-output-layout.test.mjs`
- Modify: `scripts/run-f6-full-validation.mjs`
- Modify: `scripts/run-f6-full-validation.test.mjs`
- Modify: `scripts/f6-model-interpretation-materializer.mjs`
- Modify: `scripts/f6-model-interpretation-materializer.test.mjs`
- Modify: `.github/skills/design-optimization/SKILL.md`
- Modify: `.github/skills/pdf-report-export/SKILL.md`

**Interfaces:**
- Consumes: completed F2-F5 artifact references from the workspace summary.
- Produces: F6 evidence plus the unchanged five-file `f6-artifact-set-v4` under stage F6.

- [ ] **Step 1: Write failing F6 workspace tests**

Assert model interpretations/responses and final outputs are under `06 - F6 Design Optimization`; no new `f6-model-interpretations`, `f6-model-responses`, or `f6-runs` root is created. Assert the final artifact set still contains exactly five governed files and the PDF hash/signature checks remain.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run packages/workflow-runners/src/f6.test.ts scripts/f6-output-layout.test.mjs scripts/run-f6-full-validation.test.mjs scripts/f6-model-interpretation-materializer.test.mjs --reporter=verbose
```

- [ ] **Step 3: Implement F6 workspace publication**

Resolve all current F6 write paths from the stage F6 root. Place supporting model evidence under a semantic `evidence` folder and keep the five-file report artifact set at the F6 stage root. Preserve staging, manifest-last publication, dynamic report names, Markdown/PDF hash binding, and `%PDF-` validation.

- [ ] **Step 4: Run tests**

```powershell
npx vitest run packages/workflow-runners/src/f6.test.ts scripts/f6-output-layout.test.mjs scripts/run-f6-full-validation.test.mjs scripts/f6-model-interpretation-materializer.test.mjs scripts/f6-full-flow.test.mjs scripts/f6-skill.test.mjs scripts/pdf-report-export-skill.test.mjs --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workflow-runners/src/f6.ts packages/workflow-runners/src/f6.test.ts scripts/f6-output-layout.mjs scripts/f6-output-layout.test.mjs scripts/run-f6-full-validation.mjs scripts/run-f6-full-validation.test.mjs scripts/f6-model-interpretation-materializer.mjs scripts/f6-model-interpretation-materializer.test.mjs .github/skills/design-optimization/SKILL.md .github/skills/pdf-report-export/SKILL.md
git commit -m "feat: publish F6 into analysis workspace" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 8: Integrate Workspace Lifecycle Across F1-F6

**Files:**
- Create: `scripts/create-analysis-workspace.mjs`
- Create: `scripts/create-analysis-workspace.test.mjs`
- Modify: `scripts/run-f1-full-validation.mjs`
- Modify: `scripts/run-f2-full-validation.mjs`
- Modify: `scripts/run-f3-full-validation.mjs`
- Modify: `scripts/run-f4-full-validation.mjs`
- Modify: `scripts/run-f5-full-validation.mjs`
- Modify: `scripts/run-f6-full-validation.mjs`
- Modify: `.github/skills/ta-assist-agent/SKILL.md`

**Interfaces:**
- Produces: `create-analysis-workspace --workbook <absolute.xlsx> [--test-root <absolute-directory>]`.
- Consumes: `--analysis-root <canonical-root>` in each F1-F6 stage script.

- [ ] **Step 1: Write failing command and lifecycle tests**

Assert the creation command returns one canonical root, initializes the six folders and summary, and emits no success on invalid input. Add a controlled F4 failure fixture and assert F1-F3 evidence remains while the summary records F4 failed and F5/F6 blocked.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run scripts/create-analysis-workspace.test.mjs scripts/run-f1-full-validation.test.mjs scripts/run-f2-full-validation.test.mjs scripts/run-f3-full-validation.test.mjs scripts/run-f4-full-validation.test.mjs scripts/run-f5-full-validation.test.mjs scripts/run-f6-full-validation.test.mjs --reporter=verbose
```

- [ ] **Step 3: Implement command and stage summary updates**

The creation command allocates the workspace. Each stage script requires the canonical analysis root for new full-flow execution, validates the workspace identity, marks itself running, records validated relative artifacts on success, and records a safe failed/blocked state on error before rethrowing.

Update the TA Assist Agent skill to:

1. Allocate once before F1.
2. Pass the same canonical analysis root to F1-F6.
3. Never allocate a second root during one analysis.
4. Present final F6 report paths only after the root summary is completed.

- [ ] **Step 4: Run lifecycle tests**

```powershell
npx vitest run scripts/create-analysis-workspace.test.mjs scripts/run-f1-full-validation.test.mjs scripts/run-f2-full-validation.test.mjs scripts/run-f3-full-validation.test.mjs scripts/run-f4-full-validation.test.mjs scripts/run-f5-full-validation.test.mjs scripts/run-f6-full-validation.test.mjs scripts/ta-assist-agent-skill.test.mjs --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/create-analysis-workspace.mjs scripts/create-analysis-workspace.test.mjs scripts/run-f1-full-validation.mjs scripts/run-f2-full-validation.mjs scripts/run-f3-full-validation.mjs scripts/run-f4-full-validation.mjs scripts/run-f5-full-validation.mjs scripts/run-f6-full-validation.mjs .github/skills/ta-assist-agent/SKILL.md
git commit -m "feat: coordinate F1-F6 analysis workspaces" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 9: Preserve Historical Readers and Update Active Docs

**Files:**
- Modify: `packages/workflow-runners/src/existing-f6.ts`
- Modify: `packages/workflow-runners/src/existing-f6.test.ts`
- Modify: `scripts/verify-current-f6.mjs`
- Modify: `scripts/verify-current-f6.test.mjs`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/04-feature-breakdown.md`
- Modify: `docs/governance/f3-f5-f6-report-readability-acceptance.md`

**Interfaces:**
- Consumes: old `test/demo-output` artifacts and new workspace-v1 artifacts.
- Produces: read-only validation for both; no legacy writes.

- [ ] **Step 1: Write failing dual-layout tests**

Keep existing historical fixtures and add a workspace-v1 fixture. Assert both validate, but current write resolvers reject a `test/demo-output` destination.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run packages/workflow-runners/src/existing-f6.test.ts scripts/verify-current-f6.test.mjs --reporter=verbose
```

- [ ] **Step 3: Implement dual-layout reads**

Branch validation on the explicit workspace/artifact-set version. Do not infer a new workspace from a legacy folder shape and do not rewrite legacy manifests.

Update active docs with the exact six-folder tree and mark legacy paths read-only.

- [ ] **Step 4: Run tests**

```powershell
npx vitest run packages/workflow-runners/src/existing-f6.test.ts scripts/verify-current-f6.test.mjs --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/workflow-runners/src/existing-f6.ts packages/workflow-runners/src/existing-f6.test.ts scripts/verify-current-f6.mjs scripts/verify-current-f6.test.mjs docs/02-end-to-end-flow.md docs/04-feature-breakdown.md docs/governance/f3-f5-f6-report-readability-acceptance.md
git commit -m "docs: document unified analysis workspace" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 10: Verify Complete Workspace Behavior

**Files:**
- Test only; no production edits expected.

**Interfaces:**
- Consumes: completed Tasks 1-9.
- Produces: final evidence for workspace correctness and retained F7 behavior.

- [ ] **Step 1: Run workspace and stage tests**

```powershell
npx vitest run packages/workflow-runners/src/analysis-workspace.test.ts packages/workflow-runners/src/f1-f2.test.ts packages/workflow-runners/src/f3.test.ts packages/workflow-runners/src/f4.test.ts packages/workflow-runners/src/f5.test.ts packages/workflow-runners/src/f6.test.ts scripts/create-analysis-workspace.test.mjs scripts/f6-full-flow.test.mjs --reporter=verbose
```

- [ ] **Step 2: Run skill and report publication tests**

```powershell
npx vitest run scripts/ta-assist-agent-skill.test.mjs scripts/f6-skill.test.mjs scripts/pdf-report-export-skill.test.mjs packages/product-export/src/f6-pdf-export.test.ts --reporter=verbose
```

- [ ] **Step 3: Run build, repository, and F7 validation**

```powershell
npm run build
npm run check:repository
npx vitest run scripts/f7-project-wiring.test.mjs apps/f7-local-api/src/f7-report.test.ts --reporter=verbose
```

- [ ] **Step 4: Run the complete surviving test suite**

```powershell
npm test
npm run test:e2e
```

- [ ] **Step 5: Inspect generated topology**

Run one controlled fixture analysis and verify:

```text
test\<YYYYMMDD - workbook basename>\
  analysis-run-summary.json
  01 - F1 Data Parsing\
  02 - F2 Data Cleaning\
  03 - F3 Drawing Governance\
  04 - F4 Calculation Engine\
  05 - F5 Result Interpretation\
  06 - F6 Design Optimization\
```

Confirm no new `test/demo-output/*-runs`, `feature3-output`, model-response root, timestamp child, or UUID child was created.
