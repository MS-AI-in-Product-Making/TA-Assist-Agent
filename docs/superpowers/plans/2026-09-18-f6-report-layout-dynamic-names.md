# F6 Report Layout and Dynamic Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布动态命名的 F6 Markdown/PDF 报告，改善 PDF 标题与摘要表头布局，并让 Agent 输出两个验证后的完整绝对路径。

**Architecture:** 在 contracts 包新增唯一的报告命名 helper，新写入升级为 `f6-artifact-set-v4`，从已验证 workbook identity 计算报告 basename。写入器、CLI、Workbench 和验证器共享该规则；验证器保留 `f6-artifact-set-v3` 固定名只读分支。PDF 视觉仅修改现有 HTML/CSS 投影，并通过单元测试和 Playwright 几何断言验证。

**Tech Stack:** TypeScript, Node.js ESM, Zod, Vitest, Playwright, PowerShell, Edge/Chrome PDF rendering

**Spec:** `docs/superpowers/specs/2026-09-18-f6-report-layout-dynamic-names-design.md`

## Global Constraints

- 新写入 artifact set 必须是 `f6-artifact-set-v4`。
- 历史 `f6-artifact-set-v3` 保持只读兼容，继续要求 `Feature6-Report.md/.pdf`。
- 新报告名只能来自已验证的 workbook `fileName`，只移除末尾大小写不敏感的 `.xlsx`。
- 新报告名必须是 `<basename> - TA ENGINEERING ANALYSIS REPORT.md/.pdf`。
- 五文件原子发布、manifest-last、Markdown/PDF SHA-256 和 `%PDF-` 签名约束保持不变。
- Agent 成功结果只输出验证后的 Markdown 和 PDF canonical absolute paths。
- 源工作簿保持只读；不得迁移、重命名或重写历史运行。
- 所有生产改动严格执行 RED → GREEN；每个任务结束前运行其聚焦验证。

---

### Task 1: 建立动态报告命名契约

**Files:**
- Create: `packages/contracts/src/f6-artifact-names.ts`
- Create: `packages/contracts/src/f6-artifact-names.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `scripts/f6-output-layout.mjs`
- Modify: `scripts/f6-output-layout.test.mjs`

**Interfaces:**
- Consumes: `workbookCatalogFileNameSchema` from `packages/contracts/src/contracts.ts`.
- Produces: `createF6ReportFileNames(workbookFileName: string): F6ReportFileNames`.
- Produces: `F6ReportFileNames` with `finalReportMdName` and `finalReportPdfName`.
- Produces: `resolveFeature6OutputLayout(args, outputRoot, now, publishRoot, workbookFileName)` returning v4 layout names.

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import { createF6ReportFileNames } from "./f6-artifact-names.js";

describe("createF6ReportFileNames", () => {
  it("preserves the validated workbook basename in report names", () => {
    expect(createF6ReportFileNames("Meara TP TA_20241030-v0 - test0918.xlsx")).toEqual({
      finalReportMdName: "Meara TP TA_20241030-v0 - test0918 - TA ENGINEERING ANALYSIS REPORT.md",
      finalReportPdfName: "Meara TP TA_20241030-v0 - test0918 - TA ENGINEERING ANALYSIS REPORT.pdf",
    });
  });

  it.each(["../escape.xlsx", "CON.xlsx", "name.txt", "name.xlsx "])(
    "rejects unsafe workbook identity %s",
    (fileName) => expect(() => createF6ReportFileNames(fileName)).toThrow(),
  );
});
```

Extend `scripts/f6-output-layout.test.mjs` to pass `Anonymous.xlsx` and expect `artifactSetVersion: "f6-artifact-set-v4"` plus the two dynamic report names.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
npx vitest run packages/contracts/src/f6-artifact-names.test.ts scripts/f6-output-layout.test.mjs --reporter=verbose
```

Expected: FAIL because the helper/export and v4 layout behavior do not exist.

- [ ] **Step 3: Implement the naming helper**

Create:

```ts
import { workbookCatalogFileNameSchema } from "./contracts.js";

export interface F6ReportFileNames {
  readonly finalReportMdName: string;
  readonly finalReportPdfName: string;
}

export function createF6ReportFileNames(workbookFileName: string): F6ReportFileNames {
  const validated = workbookCatalogFileNameSchema.parse(workbookFileName);
  if (!/\.xlsx$/i.test(validated)) throw new Error("F6 report naming requires an .xlsx workbook identity.");
  const basename = validated.slice(0, -5);
  const reportBasename = `${basename} - TA ENGINEERING ANALYSIS REPORT`;
  return {
    finalReportMdName: `${reportBasename}.md`,
    finalReportPdfName: `${reportBasename}.pdf`,
  };
}
```

Export it from `packages/contracts/src/index.ts`.

- [ ] **Step 4: Update output layout to consume the validated workbook name**

Import the built helper from `../packages/contracts/dist/index.js`; require `workbookFileName`, return `f6-artifact-set-v4`, and use the helper names instead of fixed `Feature6-Report.*` values. Keep optimization, run summary, and manifest names unchanged.

- [ ] **Step 5: Build contracts and verify GREEN**

Run:

```powershell
npx tsc -b packages/contracts --force
npx vitest run packages/contracts/src/f6-artifact-names.test.ts scripts/f6-output-layout.test.mjs --reporter=verbose
```

Expected: both test files PASS.

- [ ] **Step 6: Commit**

```powershell
git add packages/contracts/src/f6-artifact-names.ts packages/contracts/src/f6-artifact-names.test.ts packages/contracts/src/index.ts scripts/f6-output-layout.mjs scripts/f6-output-layout.test.mjs
git commit -m "feat(f6): derive governed report names from workbook"
```

---

### Task 2: 发布 v4 并保留 v3 只读验证

**Files:**
- Modify: `packages/workflow-runners/src/f6.ts`
- Modify: `packages/workflow-runners/src/f6.test.ts`
- Modify: `scripts/run-f6-full-validation.mjs`
- Modify: `scripts/run-f6-full-validation.test.mjs`
- Modify: `scripts/f6-full-flow.test.mjs`
- Modify: `packages/workflow-runners/src/existing-f6.ts`
- Modify: `packages/workflow-runners/src/existing-f6.test.ts`
- Modify: `scripts/verify-current-f6.mjs`
- Modify: `scripts/verify-current-f6.test.mjs`

**Interfaces:**
- Consumes: `createF6ReportFileNames(workbook.fileName)`.
- Produces: `F6Layout.artifactSetVersion: "f6-artifact-set-v4"` for current writes.
- Produces: manifest `finalReportMarkdown` and `finalReportPdf` values equal to dynamic basenames.
- Preserves: v3 validator contract with fixed report names.

- [ ] **Step 1: Write failing current-write tests**

Update runner/full-flow tests so an `Anonymous.xlsx` bundle expects:

```ts
expect(result.finalReportPath).toEndWith("Anonymous - TA ENGINEERING ANALYSIS REPORT.md");
expect(result.finalReportPdfPath).toEndWith("Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf");
expect(manifest.artifactSetVersion).toBe("f6-artifact-set-v4");
expect(manifest.artifacts.finalReportMarkdown).toBe("Anonymous - TA ENGINEERING ANALYSIS REPORT.md");
```

Add an assertion that `Feature6-Report.md` and `Feature6-Report.pdf` do not exist in a new v4 run.

- [ ] **Step 2: Run current-write tests and verify RED**

Run:

```powershell
npx vitest run packages/workflow-runners/src/f6.test.ts scripts/f6-full-flow.test.mjs scripts/run-f6-full-validation.test.mjs --reporter=verbose
```

Expected: FAIL on v3 literal and fixed report names.

- [ ] **Step 3: Reorder load-before-layout and implement v4 publication**

In script and Workbench entry paths, validate/load the bundle before resolving layout, then pass the validated `workbook.fileName`. Change `F6Layout` current literal to v4, retain all existing `outputPaths()`, exclusive creation, atomic writes and manifest-last ordering, and write actual dynamic basenames into the manifest.

- [ ] **Step 4: Run current-write tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Write failing dual-version validator tests**

Add tests proving:

```ts
expect(validateExistingF6(v3Fixture)).toMatchObject({ status: "accepted" });
expect(validateExistingF6(v4Fixture)).toMatchObject({
  status: "accepted",
  finalReportPath: expect.stringContaining("Anonymous - TA ENGINEERING ANALYSIS REPORT.md"),
});
```

Add v4 rejection cases for fixed `Feature6-Report.*`, a manifest filename differing from the workbook-derived name, an extra report file, wrong Markdown/PDF hash, and invalid PDF signature.

- [ ] **Step 6: Run validator tests and verify RED**

Run:

```powershell
npx vitest run packages/workflow-runners/src/existing-f6.test.ts scripts/verify-current-f6.test.mjs --reporter=verbose
```

Expected: v4 acceptance tests FAIL because only v3 is recognized.

- [ ] **Step 7: Implement versioned artifact contracts**

In both validators, branch on `artifactSetVersion`:

```ts
if (version === "f6-artifact-set-v3") return fixedV3Contract;
if (version === "f6-artifact-set-v4") {
  const names = createF6ReportFileNames(optimization.workbook.fileName);
  return contractFor(names.finalReportMdName, names.finalReportPdfName);
}
return unsupportedArtifactSet();
```

Construct exact file sets, manifest mappings and hash mappings from the selected contract. Do not trust manifest names to generate expectations.

- [ ] **Step 8: Run all publication tests and verify GREEN**

Run:

```powershell
npx vitest run packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.test.ts scripts/f6-full-flow.test.mjs scripts/run-f6-full-validation.test.mjs scripts/verify-current-f6.test.mjs --reporter=verbose
```

Expected: PASS with v3 historical and v4 current coverage.

- [ ] **Step 9: Commit**

```powershell
git add packages/workflow-runners/src/f6.ts packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.ts packages/workflow-runners/src/existing-f6.test.ts scripts/run-f6-full-validation.mjs scripts/run-f6-full-validation.test.mjs scripts/f6-full-flow.test.mjs scripts/verify-current-f6.mjs scripts/verify-current-f6.test.mjs
git commit -m "feat(f6): publish and validate dynamic report artifacts"
```

---

### Task 3: 同步 CLI、Workbench 与 Agent 完整路径输出

**Files:**
- Modify: `apps/cli/src/commands/feature6.ts`
- Modify: `apps/cli/src/commands/feature6.test.ts`
- Modify: `apps/cli/src/commands/feature6.security.test.ts`
- Modify: `apps/workbench-server/src/production-stage-runner.ts`
- Modify: `apps/workbench-server/src/production-stage-runner.test.ts`
- Modify: `apps/workbench-server/src/routes/artifacts.ts`
- Modify: `apps/workbench-server/src/f6-pdf-report.test.ts`
- Modify: `apps/workbench-server/src/routes/host-actions.ts`
- Modify: `apps/workbench-server/src/routes/host-actions.test.ts`
- Modify: `.github/skills/ta-assist-agent/SKILL.md`
- Modify: `.github/skills/design-optimization/SKILL.md`
- Modify: `.github/skills/pdf-report-export/SKILL.md`
- Modify: `scripts/f6-skill.test.mjs`
- Modify: `scripts/pdf-report-export-skill.test.mjs`

**Interfaces:**
- Consumes: validator-confirmed `finalReportPath` and `finalReportPdfPath`.
- Produces: CLI fields `fullReportPath` and `fullPdfReportPath` with dynamic canonical absolute paths.
- Produces: Workbench dynamic Markdown/PDF artifact names.
- Produces: Agent success presentation containing exactly two canonical absolute paths.

- [ ] **Step 1: Write failing CLI and Workbench tests**

Change expectations from fixed basenames to:

```ts
const reportBase = "Anonymous - TA ENGINEERING ANALYSIS REPORT";
expect(output).toContain(`fullReportPath: ${join(runRoot, `${reportBase}.md`)}`);
expect(output).toContain(`fullPdfReportPath: ${join(runRoot, `${reportBase}.pdf`)}`);
```

Add route/host action expectations that dynamic names are used and that unvalidated arbitrary manifest names are rejected.

- [ ] **Step 2: Run consumer tests and verify RED**

Run:

```powershell
npx vitest run apps/cli/src/commands/feature6.test.ts apps/cli/src/commands/feature6.security.test.ts apps/workbench-server/src/production-stage-runner.test.ts apps/workbench-server/src/f6-pdf-report.test.ts apps/workbench-server/src/routes/host-actions.test.ts --reporter=verbose
```

Expected: FAIL on fixed basename assumptions.

- [ ] **Step 3: Implement dynamic consumer paths**

Replace fixed basename checks with `createF6ReportFileNames(validatedWorkbookFileName)`. Preserve canonicalization, linked-component rejection, root containment, file existence and hash checks. Register both report paths in Workbench state; use the dynamic PDF basename for download and the dynamic Markdown basename for canonical host references.

- [ ] **Step 4: Run consumer tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Write failing Agent contract tests**

Update skill tests to require these exact semantics:

```text
Present exactly two validator-confirmed canonical absolute paths.
Present the Markdown path first and the PDF path second.
Do not convert either report path to a workspace-relative link.
Do not present Optimization JSON, run summary, or manifest as user reports.
```

Also require current `f6-artifact-set-v4`, dynamic report names, and historical v3 read-only compatibility.

- [ ] **Step 6: Run Agent contract tests and verify RED**

Run:

```powershell
npx vitest run scripts/f6-skill.test.mjs scripts/pdf-report-export-skill.test.mjs --reporter=verbose
```

Expected: FAIL because skills still require workspace-relative `Feature6-Report.*` links.

- [ ] **Step 7: Update the three governed skills**

Replace current fixed-name/current-v3 text with v4 dynamic publication rules, retain v3 historical read-only wording, and require exactly two validator-confirmed canonical absolute paths. Remove contradictory prohibitions on absolute paths.

- [ ] **Step 8: Run Agent contract tests and verify GREEN**

Run the Step 6 command. Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add apps/cli/src/commands/feature6.ts apps/cli/src/commands/feature6.test.ts apps/cli/src/commands/feature6.security.test.ts apps/workbench-server/src/production-stage-runner.ts apps/workbench-server/src/production-stage-runner.test.ts apps/workbench-server/src/routes/artifacts.ts apps/workbench-server/src/f6-pdf-report.test.ts apps/workbench-server/src/routes/host-actions.ts apps/workbench-server/src/routes/host-actions.test.ts .github/skills/ta-assist-agent/SKILL.md .github/skills/design-optimization/SKILL.md .github/skills/pdf-report-export/SKILL.md scripts/f6-skill.test.mjs scripts/pdf-report-export-skill.test.mjs
git commit -m "feat(f6): expose dynamic reports by canonical path"
```

---

### Task 4: 优化 PDF 标题和摘要表头布局

**Files:**
- Modify: `packages/product-export/src/f6-pdf-report.ts`
- Modify: `packages/product-export/src/f6-pdf-export.test.ts`
- Modify: `test/f8-e2e/f6-governed-pdf.spec.ts`

**Interfaces:**
- Consumes: existing `F6PdfRenderer.heading()` markup and recognized table classes.
- Produces: one-line optimization headings and rounded summary header top-right corners.
- Produces: an optional Playwright acceptance path selected only by explicit `AI_TVA_F6_ACCEPTANCE_ROOT`; the test validates that exact governed run before rendering its Markdown through the same PDF HTML projection.

- [ ] **Step 1: Write failing CSS projection tests**

Add exact assertions for CSS rules:

```ts
expect(html).toContain("display:flex");
expect(html).toContain("align-items:baseline");
expect(html).toContain("white-space:nowrap");
expect(html).toContain("flex:0 0 auto");
expect(html).toMatch(/\.document-overview th:last-child[\s\S]*border-top-right-radius/);
expect(html).toMatch(/\.workbook-summary th:last-child[\s\S]*border-top-right-radius/);
```

Scope heading assertions to the optimization panel selectors so unrelated headings are not forced into flex layout.

- [ ] **Step 2: Run PDF unit test and verify RED**

Run:

```powershell
npx vitest run packages/product-export/src/f6-pdf-export.test.ts --reporter=verbose
```

Expected: FAIL because the CSS rules are absent.

- [ ] **Step 3: Implement minimal CSS**

Apply single-line flex styling only to the three optimization panel headings. Keep letter spacing at zero, reserve fixed space for `.step-label`, and choose a fixed report-scale font size that fits the longest current heading without viewport-based scaling. Add `border-top-right-radius` only to the last header cell of `.document-overview` and `.workbook-summary`.

- [ ] **Step 4: Run PDF unit test and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Add Playwright geometry assertions**

For each optimization heading, assert:

```ts
expect(await heading.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
expect(await heading.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe("nowrap");
```

Compare heading and `.step-label` bounding boxes to require vertical overlap and no clipping. For both summary tables, require `parseFloat(getComputedStyle(lastTh).borderTopRightRadius) > 0`.

Add a separate test named `validates supplied governed report layout` that runs only when `AI_TVA_F6_ACCEPTANCE_ROOT` is nonempty. It must:

1. call `validateExistingF6Artifact(process.env.AI_TVA_F6_ACCEPTANCE_ROOT, { publishRoot: path.resolve("test", "demo-output") })`;
2. require `status: "accepted"` and use the returned `finalReportMarkdownPath` and `finalReportPdfPath` without directory scanning;
3. call the existing `inspectPdf(finalReportPdfPath)` to verify every PDF text item remains within page bounds;
4. render the exact accepted Markdown with `renderF6PdfHtml()`, open that HTML in Playwright, run the same heading and rounded-header geometry assertions, and save `meara-v4-report.png` under the test output directory.

- [ ] **Step 6: Run PDF E2E and verify GREEN**

Run:

```powershell
npx playwright test test/f8-e2e/f6-governed-pdf.spec.ts --reporter=line
```

Expected: all assertions and screenshots PASS with no overlap or clipping.

- [ ] **Step 7: Commit**

```powershell
git add packages/product-export/src/f6-pdf-report.ts packages/product-export/src/f6-pdf-export.test.ts test/f8-e2e/f6-governed-pdf.spec.ts
git commit -m "fix(f6): polish optimization and summary layout"
```

---

### Task 5: 完整回归与真实报告验收

**Files:**
- Modify only if validation exposes an in-scope defect.
- Generated validation outputs remain untracked and must not be committed.

**Interfaces:**
- Consumes: completed v4 publication pipeline.
- Produces: fresh evidence for build, tests, lint, PDF E2E, governed validation and visual acceptance.

- [ ] **Step 1: Run focused regression suite**

```powershell
npx vitest run packages/contracts/src/f6-artifact-names.test.ts packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.test.ts packages/product-export/src/f6-pdf-export.test.ts apps/cli/src/commands/feature6.test.ts apps/cli/src/commands/feature6.security.test.ts apps/workbench-server/src/production-stage-runner.test.ts apps/workbench-server/src/f6-pdf-report.test.ts apps/workbench-server/src/routes/host-actions.test.ts scripts/f6-output-layout.test.mjs scripts/f6-full-flow.test.mjs scripts/run-f6-full-validation.test.mjs scripts/verify-current-f6.test.mjs scripts/f6-skill.test.mjs scripts/pdf-report-export-skill.test.mjs --reporter=dot
```

Expected: all test files PASS, zero failures.

- [ ] **Step 2: Run build and lint**

```powershell
npm run build -- --force
npx eslint packages/contracts/src/f6-artifact-names.ts packages/contracts/src/f6-artifact-names.test.ts packages/workflow-runners/src/f6.ts packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.ts packages/workflow-runners/src/existing-f6.test.ts packages/product-export/src/f6-pdf-report.ts packages/product-export/src/f6-pdf-export.test.ts apps/cli/src/commands/feature6.ts apps/cli/src/commands/feature6.test.ts apps/cli/src/commands/feature6.security.test.ts apps/workbench-server/src/production-stage-runner.ts apps/workbench-server/src/production-stage-runner.test.ts apps/workbench-server/src/routes/artifacts.ts apps/workbench-server/src/routes/host-actions.ts apps/workbench-server/src/routes/host-actions.test.ts scripts/f6-output-layout.mjs scripts/f6-output-layout.test.mjs scripts/run-f6-full-validation.mjs scripts/run-f6-full-validation.test.mjs scripts/f6-full-flow.test.mjs scripts/verify-current-f6.mjs scripts/verify-current-f6.test.mjs scripts/f6-skill.test.mjs scripts/pdf-report-export-skill.test.mjs test/f8-e2e/f6-governed-pdf.spec.ts
```

Expected: exit code 0. Restore only known generated tracked dist drift if the build modifies it; never restore source changes.

- [ ] **Step 3: Run PDF E2E again after the full build**

```powershell
npx playwright test test/f8-e2e/f6-governed-pdf.spec.ts --reporter=line
```

Expected: PASS.

- [ ] **Step 4: Generate a fresh Meara v4 report using the validated existing run inputs**

From the worktree, invoke the documented F6 command with the already validator-accepted source roots from the completed workbook workflow. Capture the command's JSON result and take `outputDirectory` from that result; do not discover a run by modification time:

```powershell
$f2 = 'C:\Users\xumax\AI Project\AI TVA Analysis\test\demo-output\f2-runs\Meara-TP-TA_20241030-v0---test0918\2026-09-18T09-07-36-685Z\f2'
$f3 = 'C:\Users\xumax\AI Project\AI TVA Analysis\test\demo-output\feature3-output'
$f4 = 'C:\Users\xumax\AI Project\AI TVA Analysis\test\demo-output\f4-runs\f2\2026-09-18T09-15-28-798Z'
$f5 = 'C:\Users\xumax\AI Project\AI TVA Analysis\test\demo-output\f5-runs\2026-09-18T09-15-28-798Z\2026-09-18T09-25-32-309Z'
$model = 'C:\Users\xumax\AI Project\AI TVA Analysis\test\demo-output\f6-model-interpretations\c01821bdeee3693afc4b40a6546260f25729e5975d440e63b8799ace563c93ce\009488a8-3a45-4b70-b958-c533357d9aa7\Feature6-Model-Interpretation.json'
$worksheets = @('TP step','gap battery and tp screw','boss top Gap w TPshim','boss top Gap w backplate','boss btm Gap w TPshim','boss btm Gap w backplate')
$args = @('run','workflow:f6','--',$f2,$f3,$f4,$f5)
foreach ($worksheet in $worksheets) { $args += @('--worksheet',$worksheet) }
$args += @('--language','zh-CN','--analysis-request-context','{"requestedAt":"2026-09-18T17:07:18.8467933+08:00","utcOffsetMinutes":480,"source":"vscode"}','--model-interpretation',$model)
$output = @(& npm @args 2>&1)
if ($LASTEXITCODE -ne 0) { $output | Write-Output; throw 'Meara F6 generation failed.' }
$jsonStart = 0..($output.Count - 1) | Where-Object { $output[$_] -eq '{' } | Select-Object -First 1
if ($null -eq $jsonStart) { throw 'F6 JSON result was not found.' }
$result = (($output[$jsonStart..($output.Count - 1)] | ForEach-Object { $_.ToString() }) -join "`n") | ConvertFrom-Json
if ($result.status -ne 'completed') { throw 'Meara F6 generation did not complete.' }
$acceptanceRoot = $result.outputDirectory
```

Do not modify the source workbook or any historical report set.

Expected new report basenames:

```text
Meara TP TA_20241030-v0 - test0918 - TA ENGINEERING ANALYSIS REPORT.md
Meara TP TA_20241030-v0 - test0918 - TA ENGINEERING ANALYSIS REPORT.pdf
```

- [ ] **Step 5: Validate the fresh governed output**

```powershell
$validation = node scripts/verify-current-f6.mjs $acceptanceRoot | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $validation.status -ne 'accepted') { throw 'Governed v4 validation failed.' }
if ($validation.outputDirectory -ne $acceptanceRoot) { throw 'Validator accepted a different run.' }
$expectedBase = 'Meara TP TA_20241030-v0 - test0918 - TA ENGINEERING ANALYSIS REPORT'
if ((Split-Path $validation.finalReportMarkdownPath -Leaf) -ne "$expectedBase.md") { throw 'Markdown basename mismatch.' }
$summary = Get-Content -Raw (Join-Path $acceptanceRoot 'Feature6-Run-Summary.json') | ConvertFrom-Json
$manifest = Get-Content -Raw (Join-Path $acceptanceRoot 'manifest.json') | ConvertFrom-Json
if ($summary.artifactSetVersion -ne 'f6-artifact-set-v4' -or $manifest.artifactSetVersion -ne 'f6-artifact-set-v4') { throw 'Artifact set version mismatch.' }
```

Expected: the explicit `$acceptanceRoot` is accepted; returned Markdown path uses the dynamic name; artifact set is v4; hashes and PDF signature pass.

- [ ] **Step 6: Inspect rendered PDF geometry**

Run the explicit supplied-run acceptance test against the same `$acceptanceRoot`:

```powershell
$env:AI_TVA_F6_ACCEPTANCE_ROOT = $acceptanceRoot
npx playwright test test/f8-e2e/f6-governed-pdf.spec.ts -g "validates supplied governed report layout" --reporter=line
Remove-Item Env:AI_TVA_F6_ACCEPTANCE_ROOT
```

Open the generated `meara-v4-report.png` from this test and verify:

- all three purple headings and STEP labels are one line;
- no heading is clipped or overlaps panel content;
- both summary blue headers have rounded top-right corners;
- Markdown and PDF names match the validated workbook basename.

- [ ] **Step 7: Verify branch cleanliness and diff**

```powershell
git diff --check
git status --short
git log --oneline --decorate -6
```

Expected: no unexpected generated files or whitespace errors; only intentional source/test/doc changes are committed.

If any validation step exposes an in-scope defect, return to the task that owns that behavior, add a failing regression test, repeat its RED/GREEN commands, and amend that task with a new focused commit before rerunning Task 5 from Step 1. Do not create an empty or catch-all validation commit.
