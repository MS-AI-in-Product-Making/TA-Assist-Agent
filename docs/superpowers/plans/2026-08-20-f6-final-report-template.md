# F6 Final Tolerance Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `.github/report_template.md` 接入 F6，生成直接基于已验证 F2-F5 数据与 F6 Optimization 的 `Feature6-Report.md`，并用五文件输出契约替代 Composed artifacts。

**Architecture:** F6 loader 暴露已验证 F3/F4 reports；新的 final-report projection 统一计算 Worksheet/Workbook disposition、结构化 `reportSummary` 和 Markdown。Runner 原子发布 Optimization JSON/Markdown、Final Report Markdown、Run Summary 和 manifest，不再调用 Composed builder/renderer。

**Tech Stack:** Node.js ESM、TypeScript/Zod contracts、Vitest、Markdown sanitizer、现有 F4 report projection 与原子文件发布工具。

**Spec:** `docs/superpowers/specs/2026-08-20-f6-final-report-template-design.md`

## Global Constraints

- F4 `excel-ta-v1` 是报告数值与公式的唯一真源。
- Disposition 固定为 `FAIL > INCOMPLETE > CONDITIONAL_PASS > PASS`。
- `FAIL` 表示 F2 blocked、F4 无有效计算或阻塞判定的数据缺口。
- `INCOMPLETE` 表示受支持证据确认规格越界或 predictive Cpk 未达到 Target Cpk。
- F6 Optimization `runStatus` 不参与工程 disposition。
- 成功目录固定五个文件，不生成 legacy report JSON/Markdown。
- 不新增 Final Report JSON；结构化判定保存在 Run Summary `reportSummary`。
- 最终报告不包含 `3.9`，不重复 Optimization scenario。
- 缺少依据时只使用 `N/A`、`NOT_PROVIDED`、`NOT_EVALUATED` 或 `INSUFFICIENT_EVIDENCE`。
- 不削弱 containment、identity、hash 和 atomic publish 边界。
- 不自动创建 Git commit；仅在用户明确要求时提交。

---

### Task 1: Replace the F6 output layout contract

**Files:**
- Modify: `scripts/f6-output-layout.mjs`
- Test: `scripts/f6-output-layout.test.mjs`

**Interfaces:**
- Produces: `finalReportMdName: "Feature6-Report.md"`
- Removes: `composedReportJsonName`, `composedReportMdName`

- [ ] **Step 1: Write the failing layout test**

```js
expect(layout).toMatchObject({
  optimizationJsonName: "Feature6-Optimization.json",
  optimizationMdName: "Feature6-Optimization.md",
  finalReportMdName: "Feature6-Report.md",
  runSummaryJsonName: "Feature6-Run-Summary.json",
  manifestName: "manifest.json",
});
expect(layout).not.toHaveProperty("composedReportJsonName");
expect(layout).not.toHaveProperty("composedReportMdName");
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run scripts/f6-output-layout.test.mjs`  
Expected: FAIL because the final report name is absent and Composed names remain.

- [ ] **Step 3: Implement the minimal return-shape change**

Replace the two Composed names with:

```js
finalReportMdName: "Feature6-Report.md",
```

- [ ] **Step 4: Verify GREEN**

Run the same command. Expected: PASS.

### Task 2: Expose validated F3/F4 reports from the loader

**Files:**
- Modify: `scripts/f6-artifact-loader.mjs`
- Test: `scripts/f6-artifact-loader.test.mjs`

**Interfaces:**
- Produces accepted bundle fields: `f3Report`, `f4Report`
- Preserves all existing request and optional evidence fields

- [ ] **Step 1: Add failing accepted-bundle assertions**

```js
expect(result.status).toBe("accepted");
expect(result.f3Report).toEqual(readJson(bundle.paths.f3));
expect(result.f4Report).toEqual(readJson(bundle.paths.f4));
expect(result.f3Report.workbook.contentHash).toBe(result.request.workbook.contentHash);
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run scripts/f6-artifact-loader.test.mjs`  
Expected: FAIL because the accepted bundle does not expose these reports.

- [ ] **Step 3: Return the already validated objects**

```js
return {
  status: "accepted",
  request: request.data,
  f2Report: f2,
  f3Report: f3,
  f4Report: f4,
  f5Report: f5,
  // preserve existing fields
};
```

Do not reread files or weaken prior schema/identity checks.

- [ ] **Step 4: Verify GREEN**

Run the same loader test. Expected: PASS.

### Task 3: Implement the final-report disposition projection

**Files:**
- Create: `scripts/f6-final-report.mjs`
- Create: `scripts/f6-final-report.test.mjs`

**Interfaces:**
- Produces: `createF6FinalReportProjection(input, options)`
- Returns: `{ markdown, reportSummary: { workbookDisposition, worksheetDispositions } }`
- Consumes: F2/F3/F4/F5 reports, F6 Optimization, optional Analysis Context and generated time

- [ ] **Step 1: Write failing policy tests**

```js
it.each([
  ["blocked F2", { blocked: true }, "FAIL"],
  ["missing F4", { calculation: null }, "FAIL"],
  ["Cpk below target", { cpk: 1.1, targetCpk: 1.33 }, "INCOMPLETE"],
  ["open governance", { cpk: 1.5, governanceRequired: true }, "CONDITIONAL_PASS"],
  ["fully supported", { cpk: 1.5 }, "PASS"],
])("maps %s", (_name, overrides, expected) => {
  const result = createF6FinalReportProjection(fixture(overrides));
  expect(result.reportSummary.worksheetDispositions[0].disposition).toBe(expected);
});
```

Add workbook worst-status coverage with `["PASS", "INCOMPLETE", "FAIL"]` expecting `FAIL`.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run scripts/f6-final-report.test.mjs`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the single disposition policy**

```js
export const F6_DISPOSITION_RANK = {
  PASS: 0,
  CONDITIONAL_PASS: 1,
  INCOMPLETE: 2,
  FAIL: 3,
};

export function worstDisposition(dispositions) {
  return dispositions.reduce((worst, value) =>
    F6_DISPOSITION_RANK[value] > F6_DISPOSITION_RANK[worst] ? value : worst,
  "PASS");
}
```

Worksheet policy order:

```js
if (isBlocked || calculation === undefined || hasBlockingDataGap) return "FAIL";
if (hasSupportedSpecificationFailure || calculation.capability.cpk < targetCpk) return "INCOMPLETE";
if (hasGovernanceReview || hasOpenF5Review) return "CONDITIONAL_PASS";
return "PASS";
```

Do not read `f6Optimization.runStatus` in this policy.

- [ ] **Step 4: Verify GREEN for policy tests**

Run the same test. Expected: policy tests PASS.

### Task 4: Render the approved report template

**Files:**
- Modify: `scripts/f6-final-report.mjs`
- Test: `scripts/f6-final-report.test.mjs`
- Read: `.github/report_template.md`
- Reuse: `scripts/f6-markdown-sanitizer.mjs`, `scripts/engineering-format.mjs`

**Interfaces:**
- Markdown follows headings `1`, `2`, `3.1-3.8`, `4` exactly.
- Markdown and Run Summary consume the same `reportSummary` object.

- [ ] **Step 1: Add failing structure tests**

```js
const { markdown } = createF6FinalReportProjection(fixture());
expect(markdown).toContain("# 1. 文档控制 Document Control");
expect(markdown).toContain("# 2. Workbook 决策总览");
expect(markdown).toContain("## 3.8 贡献与敏感度");
expect(markdown).toContain("# 4. Appendix: Reference Traceability");
expect(markdown).not.toContain("3.9");
expect(markdown).not.toContain(deprecatedF6ReportArtifactName);
expect(markdown.match(/Predictive Cpk \|/g)).toHaveLength(1);
expect(markdown.match(/RSS 1σ/g)).toHaveLength(1);
```

Add full-factor and blocked behavior assertions:

```js
expect(markdown.match(/^\| \d+ \| Factor /gm)).toHaveLength(calculation.factorCount);
expect(blockedMarkdown).toContain("| Blocked-A |");
expect(blockedMarkdown).not.toContain("## 3.7 结果与规格符合性");
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run scripts/f6-final-report.test.mjs`  
Expected: FAIL on missing sections.

- [ ] **Step 3: Implement focused section renderers**

Implement:

```js
renderDocumentControl(context)
renderWorkbookOverview(context)
renderExecutiveSummary(worksheet)
renderRequirements(worksheet)
renderToleranceImage(worksheet, options)
renderInputs(worksheet)
renderMethods(worksheet)
renderResults(worksheet)
renderContributors(worksheet)
renderTraceability(context)
```

Join ready data by exact `worksheetName` and `tableId`. Use F4 factors for numeric rows, F5 governance rows for Drawing Number/DIM ID, F2 for specification sources, and the existing F4 projection for ranges, margins and formula checks.

- [ ] **Step 4: Add evidence and sanitization tests**

```js
expect(noContextMarkdown).toContain("NOT_PROVIDED");
expect(noImageMarkdown).toContain("NOT_EVALUATED");
expect(markdown).toContain("不等于已确认的物理根因");
expect(markdown).not.toContain("<script>");
expect(markdown).not.toContain("C:\\private\\");
```

- [ ] **Step 5: Verify GREEN**

Run the renderer test. Expected: all tests PASS.

### Task 5: Wire the final report into the atomic runner

**Files:**
- Modify: `scripts/run-f6-full-validation.mjs`
- Test: `scripts/f6-full-flow.test.mjs`

**Interfaces:**
- Produces path key `finalReportMarkdown` and result field `finalReportMdPath`
- Run Summary gains `reportSummary`

- [ ] **Step 1: Change full-flow expectations to five files**

```js
expect(readdirSync(runRoot).sort()).toEqual([
  "Feature6-Optimization.json",
  "Feature6-Optimization.md",
  "Feature6-Report.md",
  "Feature6-Run-Summary.json",
  "manifest.json",
]);
expect(summary.hashes).toEqual({
  optimizationJsonSha256: artifactHash(path.join(runRoot, "Feature6-Optimization.json")),
  optimizationMarkdownSha256: artifactHash(path.join(runRoot, "Feature6-Optimization.md")),
  finalReportMarkdownSha256: artifactHash(path.join(runRoot, "Feature6-Report.md")),
});
expect(summary.reportSummary.workbookDisposition).toBeDefined();
```

Manifest must contain only `optimizationJson`, `optimizationMarkdown`, `finalReportMarkdown`, `runSummary`.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run scripts/f6-full-flow.test.mjs`  
Expected: FAIL because the runner still publishes Composed files.

- [ ] **Step 3: Replace composed dependencies and content keys**

Remove composed imports/dependencies. Call:

```js
const finalReport = dependencies.createFinalReport({
  f2Report: loaded.f2Report,
  f3Report: loaded.f3Report,
  f4Report: loaded.f4Report,
  f5Report: loaded.f5Report,
  f6Optimization: optimization,
  analysisContext: loaded.analysisContext,
  generatedAt: options.now().toISOString(),
}, reportOptions);
```

Publish `optimizationJson`, `optimizationMarkdown`, `finalReportMarkdown`; set `summary.reportSummary = finalReport.reportSummary`; then write summary and manifest last.

- [ ] **Step 4: Verify GREEN**

Run the full-flow test. Expected: PASS with exactly five files.

### Task 6: Validate existing five-file F6 artifacts

**Files:**
- Modify: `.github/skills/f6-analysis/SKILL.md`
- Modify: `scripts/f6-skill.test.mjs`
- Modify: `scripts/verify-current-f6.mjs`
- Create if absent: `scripts/verify-current-f6.test.mjs`

**Interfaces:**
- Existing entry accepts output directory or `Feature6-Optimization.json`.
- Validates Optimization schema, manifest, three hashes and `reportSummary` consistency.

- [ ] **Step 1: Write failing skill/verifier tests**

```js
expect(skill).toContain("Feature6-Report.md");
expect(skill).toContain("five-file");
expect(skill).toContain("reportSummary");
expect(skill).not.toContain(deprecatedF6ReportArtifactJsonName);
```

Verifier cases: valid run accepted; changed Markdown rejected as `artifact_hash_mismatch`; invalid workbook worst-status rejected as `report_summary_invalid`.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run scripts/f6-skill.test.mjs scripts/verify-current-f6.test.mjs`  
Expected: FAIL on old output-set assumptions.

- [ ] **Step 3: Implement exact summary validation**

Require unique worksheet names, exact selected scope, allowed dispositions, and:

```js
const expected = worstDisposition(
  reportSummary.worksheetDispositions.map(({ disposition }) => disposition),
);
if (reportSummary.workbookDisposition !== expected) {
  return { status: "rejected", reasonCode: "report_summary_invalid" };
}
```

Never parse Markdown to derive disposition; verify only its SHA-256 before presentation.

- [ ] **Step 4: Verify GREEN**

Run the same tests. Expected: PASS.

### Task 7: Retire Composed runtime code

**Files:**
- Delete: legacy report runtime source and test files
- Delete: legacy report package source and test files
- Modify: `packages/workbook-catalog/src/index.ts`
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Test: `scripts/verify-repository.test.mjs`

**Interfaces:**
- Removes composed builder/renderer/contracts/exports.
- Preserves F6 Optimization v2 and shared evidence types.

- [ ] **Step 1: Add a failing active-reference guard**

Assert active F6 runtime, skills and current docs do not contain the deprecated F6 report artifact token; exclude historical `docs/superpowers/specs` and `docs/superpowers/plans`.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run scripts/verify-repository.test.mjs`  
Expected: FAIL on active composed code/exports.

- [ ] **Step 3: Remove implementation, schemas and exports**

Delete the four files, remove package exports and composed Zod schemas/tests. Do not remove any type used by Optimization.

- [ ] **Step 4: Rebuild and Verify GREEN**

Run:

```powershell
npm run build -- --force
npx vitest run packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f6-optimization.test.ts scripts/verify-repository.test.mjs
```

Expected: build and tests PASS; generated `dist` no longer exports composed APIs.

### Task 8: Migrate current docs and run final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/governance/feature-register.md`
- Modify: `docs/governance/f3-f5-f6-report-readability-acceptance.md`
- Preserve: historical files under `docs/superpowers/specs/` and `docs/superpowers/plans/`

- [ ] **Step 1: Update current-state wording**

Use the exact contract: F6 atomically publishes `Feature6-Report.md`, `Feature6-Optimization.json/.md`, `Feature6-Run-Summary.json`, and `manifest.json`; Run Summary owns structured Workbook/Worksheet dispositions.

- [ ] **Step 2: Scan active references**

Run:

```powershell
rg "<deprecated F6 report artifact token>|<old output-set wording>" README.md docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/governance .github/skills/f6-analysis scripts packages apps
```

Expected: no active references.

- [ ] **Step 3: Run focused F6 suite and Verify GREEN**

```powershell
npx vitest run scripts/f6-final-report.test.mjs scripts/f6-artifact-loader.test.mjs scripts/f6-output-layout.test.mjs scripts/f6-full-flow.test.mjs scripts/f6-skill.test.mjs scripts/verify-current-f6.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 4: Run build, lint and governed verification**

```powershell
npm run build -- --force
npm run lint
node scripts/verify-current-f6.mjs
```

Expected: all commands exit 0 and verifier confirms the five-file current run.

- [ ] **Step 5: Run repository suite**

Run: `npm test`  
Expected: exit 0. Record any pre-existing unrelated failure exactly; do not modify unrelated functionality.

- [ ] **Step 6: Review final diff**

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: only template, approved spec/plan, F6 runtime/tests, current F6 skill and current governance docs changed; no source workbook or generated demo artifacts modified.
