# F3/F5/F6 Engineering Report Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 F0-F6 workflow、F4 计算结果、artifact identity/hash 门禁和历史 JSON 语义的前提下，生成工程师可直接理解的 F6/F5 报告，并按 Worksheet / Part / Subsystem 分类 F3 ADO 治理内容。

**Architecture:** 保持计算、结果合同和展示三层分离。F4/F5/F6 JSON 继续作为审计事实源；`workbook-catalog` projection/composed builder 只增加受控 derived/optional display DTO；Markdown/HTML renderer 负责可读表达，完整 trace 保留在 JSON 或审计附录。F0 只投影 F2 已验证 guidance，不在 F6 重查或推断。

**Tech Stack:** TypeScript 5.7、Node.js ESM、Zod contracts、Vitest 3、Markdown/HTML deterministic renderers。

**Spec:** `docs/superpowers/specs/2026-08-19-f3-f5-f6-report-readability-design.md`

## Global Constraints

- 不改变 `workflow:f2:excel`、`workflow:f3`、`workflow:f4`、`workflow:f5`、`workflow:f6` 的命令形状或执行顺序。
- 不改变任何 F4 baseline calculation 数值、formula ID、trace record 或 capability decision。
- 现有 V2 必填字段保持兼容；新增合同字段必须 optional 或严格 derived，旧 fixture 仍可 parse。
- 没有 caller-authorized `f6-optimization-targets-v1` 时仍只能输出 candidate，不生成默认百分比场景。
- 图片证据不得自动生成 Drawing Number、DIM ID、datum identity、signed loop 或 label-to-source-row mapping。
- F3 ADO 仍是一次 preview、一次确认、一次写入、一次回读；11 headers 与 factor row count 保持不变。
- F5 `FACT/RULE/SIGNAL/OPTION` 分类和 JSON 内容不变；可读性只改变 Markdown projection。
- 不修改历史 `test/demo-output`；真实 workbook 验证必须创建新 run。
- 每个任务先 RED、再最小 GREEN、再相关测试、再独立 commit。
- 每个任务提交前运行 `git diff --check`；最终运行完整 `npm test`，测试数量不得减少。

---

### Task 1: Clarify F6 Statistical Range, Spec, Cpk, Margin, and Formula Substitution

**Files:**
- Modify: `scripts/f6-composed-report.mjs`
- Test: `scripts/f6-composed-report.test.mjs`
- Test: `scripts/f6-report.test.mjs`

**Interfaces:**
- Consumes: existing `f6ComposedEngineeringReportV2.sections.statisticalResults`, `specificationAndMargins`, `capabilityAssessment`, and projection `formulaChecks[].inputs`.
- Produces: deterministic Markdown with Target Nσ labels, separate statistical/Worst Case margins, formula expressions, compact substitutions, and predictive-model source labels.

- [ ] **Step 1: Write failing renderer assertions for Target σ and typed margins**

Extend the V2 renderer test so the Markdown must contain:

```js
expect(markdown).toContain("Target 4σ statistical range");
expect(markdown).toContain("Mean ± 4 × RSS 1σ");
expect(markdown).toContain("Target 4σ Minimum Margin");
expect(markdown).toContain("Worst-case Minimum Margin");
expect(markdown).toContain("负值表示评估范围超出 Spec");
```

Retain the existing fixed sixteen-heading order assertions.

- [ ] **Step 2: Run the renderer test and verify RED**

Run:

```powershell
npx vitest run scripts/f6-composed-report.test.mjs
```

Expected: FAIL because the current renderer prints generic `统计范围` and `Minimum Margin`.

- [ ] **Step 3: Add failing Cpk/spec/formula-substitution assertions**

Use the existing V2 fixture formula inputs and assert:

```js
expect(markdown).toContain("CpkL = (Mean - LSL) / (3 × RSS 1σ)");
expect(markdown).toContain("CpkU = (USL - Mean) / (3 × RSS 1σ)");
expect(markdown).toContain("Cpk = min(CpkL, CpkU)");
expect(markdown).toMatch(/LSL.*USL.*Target Cpk/s);
expect(markdown).toContain("PREDICTIVE_TOLERANCE_MODEL");
expect(markdown).toContain("不是量产实测 Cpk");
```

- [ ] **Step 4: Implement compact quantity and substitution helpers**

Add renderer-local helpers without changing report JSON:

```js
function signedNumber(value, decimals = 6) {
  return Number(value).toFixed(decimals).replace(/\.0+$|(?<=\.[0-9]*?)0+$/u, "");
}

function formulaInput(formula, name) {
  return formula.inputs.find((input) => input.name === name);
}

function marginResult(minimumMargin) {
  return minimumMargin >= 0 ? "PASS" : "FAIL";
}
```

Render compact formula blocks from existing formula checks. Do not recompute or replace JSON results.

- [ ] **Step 5: Run F6 renderer tests and verify GREEN**

Run:

```powershell
npx vitest run scripts/f6-composed-report.test.mjs scripts/f6-report.test.mjs
```

Expected: PASS; existing sixteen-section ordering and candidate-only behavior remain green.

- [ ] **Step 6: Commit Task 1**

```powershell
git add scripts/f6-composed-report.mjs scripts/f6-composed-report.test.mjs scripts/f6-report.test.mjs
git commit -m "feat(f6): explain capability and margin calculations"
```

---

### Task 2: Make F4 Baseline Recalculation Checks Engineer-Readable

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/workbook-catalog/src/f6-report-projection.ts`
- Modify: `packages/workbook-catalog/src/f6-composed-report.ts`
- Modify: `scripts/f6-composed-report.mjs`
- Test: `packages/workbook-catalog/src/f6-report-projection.test.ts`
- Test: `packages/workbook-catalog/src/f6-composed-report.test.ts`
- Test: `scripts/f6-composed-report.test.mjs`

**Interfaces:**
- Consumes: F4 `CalculationCompletedResult` and `inputResolution: 1e-12`.
- Produces: optional V2 `worstCaseUpperCheck` and `worstCaseLowerCheck`; existing `worstCaseCheck` remains for backward compatibility during V2 migration.

- [ ] **Step 1: Add failing projection tests for separate Worst Case checks**

Assert:

```ts
expect(result.selfChecks.worstCaseUpper).toMatchObject({
  checkId: "worst-case-upper",
  result: "PASS",
});
expect(result.selfChecks.worstCaseLower).toMatchObject({
  checkId: "worst-case-lower",
  result: "PASS",
});
expect(result.selfChecks.worstCaseUpper.calculated.value)
  .toBeCloseTo(result.selfChecks.worstCaseUpper.reported.value);
```

Also assert the tolerance remains exactly `0.01` in the unit fixture and `toleranceBasis === "input resolution"`.

- [ ] **Step 2: Run projection test and verify RED**

```powershell
npx vitest run packages/workbook-catalog/src/f6-report-projection.test.ts
```

Expected: FAIL because only aggregate `worstCase` exists.

- [ ] **Step 3: Implement separate checks without changing baseline math**

Replace the aggregate-only construction with:

```ts
const worstCaseUpper = comparison(
  "worst-case-upper",
  calculatedWorstCaseUpper,
  calculation.system.worstCaseUpper,
  inputResolution,
  unit,
  ["system.worstCaseUpper"],
);
const worstCaseLower = comparison(
  "worst-case-lower",
  calculatedWorstCaseLower,
  calculation.system.worstCaseLower,
  inputResolution,
  unit,
  ["system.worstCaseLower"],
);
```

Keep `worstCase` as the legacy aggregate derived from the maximum absolute side difference until a future contract major version removes it.

- [ ] **Step 4: Extend V2 contract with optional side checks**

In the calculation self-check section schema, add optional fields with the existing consistency-check schema:

```ts
worstCaseUpperCheck: f6ConsistencyCheckV2Schema.optional(),
worstCaseLowerCheck: f6ConsistencyCheckV2Schema.optional(),
```

Project both fields in `buildV2Worksheet()` when present.

- [ ] **Step 5: Add failing Markdown assertions for values and scientific threshold**

```js
expect(markdown).toContain("F4 基线复算与数值一致性检查");
expect(markdown).toContain("F6 recomputed");
expect(markdown).toContain("F4 reported");
expect(markdown).toContain("1e-12 mm");
expect(markdown).not.toContain("Tolerance 0.000 mm");
```

- [ ] **Step 6: Implement scientific threshold rendering**

```js
function thresholdText(quantity) {
  if (Math.abs(quantity.value) < 0.001) return `${quantity.value.toExponential()} ${quantity.unit}`;
  return quantityText(quantity, 6);
}
```

Render a table with check ID, recomputed, reported, absolute difference, threshold, basis, result.

- [ ] **Step 7: Run focused contract/projection/builder/renderer tests**

```powershell
npx vitest run packages/workbook-catalog/src/f6-report-projection.test.ts packages/workbook-catalog/src/f6-composed-report.test.ts packages/contracts/src/contracts.test.ts scripts/f6-composed-report.test.mjs
```

Expected: PASS with existing V2 fixtures still accepted.

- [ ] **Step 8: Commit Task 2**

```powershell
git add packages/contracts/src/contracts.ts packages/workbook-catalog/src/f6-report-projection.ts packages/workbook-catalog/src/f6-composed-report.ts scripts/f6-composed-report.mjs packages/workbook-catalog/src/f6-report-projection.test.ts packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-composed-report.test.mjs
git commit -m "feat(f6): clarify baseline consistency checks"
```

---

### Task 3: Combine Analysis Characteristic, F3 Completeness, and F5 Image Evidence

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/workbook-catalog/src/f6-composed-report.ts`
- Modify: `scripts/f6-composed-report.mjs`
- Test: `packages/workbook-catalog/src/f6-composed-report.test.ts`
- Test: `scripts/f6-composed-report.test.mjs`

**Interfaces:**
- Consumes: F2 `toleranceLoopDescription` and row completeness, F3 governance rows, F5 V2 `imageReference/contextSnapshot/imageObservations`, optional Analysis Context.
- Produces: optional derived display fields under existing sections; does not alter evidence classification or signed-loop authorization.

- [ ] **Step 1: Add failing builder tests for analysis characteristic and governance completeness**

Assert each worksheet exposes:

```ts
expect(worksheet.sections.objectiveAndRequirements.analysisCharacteristic)
  .toBe("DIM829, Audio Jack to C bucket Gap");
expect(worksheet.sections.inputIntegrity.governanceSummary).toMatchObject({
  factorCount: 3,
  drawingNumberMissingCount: 3,
  dimIdMissingCount: 3,
});
```

Keep `analysisObject` null when no caller-authorized context exists.

- [ ] **Step 2: Run builder tests and verify RED**

```powershell
npx vitest run packages/workbook-catalog/src/f6-composed-report.test.ts
```

- [ ] **Step 3: Extend optional V2 display schemas**

Add optional fields:

```ts
analysisCharacteristic: z.string().min(1).optional(),
governanceSummary: z.object({
  factorCount: z.number().int().nonnegative(),
  drawingNumberMissingCount: z.number().int().nonnegative(),
  dimIdMissingCount: z.number().int().nonnegative(),
  affectedSourceRows: z.array(z.number().int().positive()),
}).strict().optional(),
```

Add a strict optional loop evidence summary containing exact F5 image reference, visual FACT summaries, context SIGNAL summaries, factor descriptions, and `signedEquationAuthorized`.

- [ ] **Step 4: Project exact identities only**

Join rows by `worksheetName + tableId + sourceRow`. Copy existing F3/F5 values; do not derive labels or signs. Set:

```ts
signedEquationAuthorized: analysisContext?.loopDefinition !== undefined
```

When false, equation remains null and renderer explains the mapping gap.

- [ ] **Step 5: Add failing Markdown tests for image and grouped completeness**

Assert:

```js
expect(markdown).toContain("分析特性：DIM829, Audio Jack to C bucket Gap");
expect(markdown).toContain("结构化工程定义：未提供");
expect(markdown).toContain("Drawing Number 缺失：3/3");
expect(markdown).toContain("DIM ID 缺失：3/3");
expect(markdown).toContain("F1 tolerance-path image");
expect(markdown).toContain("SIGNAL");
expect(markdown).toContain("不能生成 signed equation");
```

- [ ] **Step 6: Implement renderer tables and image link reuse**

Use the contained relative `imageReference` already validated by F5 output. Do not resolve arbitrary user paths in the F6 renderer.

- [ ] **Step 7: Run focused tests**

```powershell
npx vitest run packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-composed-report.test.mjs scripts/f5-report.test.mjs
```

- [ ] **Step 8: Commit Task 3**

```powershell
git add packages/contracts/src/contracts.ts packages/workbook-catalog/src/f6-composed-report.ts scripts/f6-composed-report.mjs packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-composed-report.test.mjs
git commit -m "feat(f6): combine governance and image evidence"
```

---

### Task 4: Project Optimization Targets, Scenarios, and Deduplicated Action Plan

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/workbook-catalog/src/f6-composed-report.ts`
- Modify: `scripts/f6-composed-report.mjs`
- Modify: `scripts/f6-report.mjs`
- Test: `packages/workbook-catalog/src/f6-composed-report.test.ts`
- Test: `scripts/f6-composed-report.test.mjs`
- Test: `scripts/f6-report.test.mjs`

**Interfaces:**
- Consumes: `f6OptimizationResultV2.worksheets[].options`, caller-authorized target summaries, baseline/scenario metrics.
- Produces: one displayed scenario per governed target and an optional action-plan projection; candidate-only behavior remains unchanged.

- [ ] **Step 1: Add a three-target fixture and failing target projection test**

Build a fixture with unique targets:

```ts
const baselineIdentity = {
  calculationVersion: "excel-ta-v1" as const,
  projectReference: "f4-project-a",
  runReference: "f4-run-a",
  workbookContentHash: "a".repeat(64),
  worksheetName: "Analysis-A",
  tableId: "table-a",
};
const factorA = { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 14, factorName: "Bracket height", unit: "mm" };
const factorB = { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 15, factorName: "Shim thickness", unit: "mm" };
const factorC = { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 16, factorName: "Housing datum offset", unit: "mm" };
const targets = [
  {
    targetId: "scenario-a",
    targetType: "factor_tolerance" as const,
    factor: factorA,
    upperTolerance: 0.05,
    lowerTolerance: -0.05,
    unit: "mm",
  },
  {
    targetId: "scenario-b",
    targetType: "improvement_ratio" as const,
    factor: factorB,
    ratio: 0.2,
    appliesTo: "tolerance_band" as const,
  },
  {
    targetId: "scenario-c",
    targetType: "system_target" as const,
    systemIdentity: {
      baselineIdentity,
      designNominal: 0,
      mean: 0,
      rssSigma: 0.1,
      lowerSpecLimit: -0.5,
      upperSpecLimit: 0.5,
      targetCpk: 1.33333333333333,
      traceReferences: [{ outputField: "capability.cpk", formulaId: "cpk-v1", formulaVersion: "excel-ta-v1" }],
    },
    target: { targetCpk: 1.5 },
    apportionment: { policy: "EQUAL_SELECTED" as const, selectedFactors: [factorA, factorB, factorC] },
  },
];
```

Assert `sensitivityAndOptimization.targets` has length 3 and preserves ID/type/value/evidence.

- [ ] **Step 2: Run tests and verify RED**

```powershell
npx vitest run packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-composed-report.test.mjs
```

Expected: FAIL because targets are currently fixed to `[]`.

- [ ] **Step 3: Project target and scenario summaries**

Map target identity and each completed option without recalculating it. Add optional scenario comparison rows:

```ts
{
  optionId,
  targetId,
  factor,
  baselineInput,
  adjustedInput,
  baselineMetrics,
  scenarioMetrics,
  deltas,
  roiStatus,
}
```

- [ ] **Step 4: Preserve candidate-only governance**

Add an explicit test:

```ts
expect(candidateWorksheet.options).toHaveLength(1);
expect(candidateWorksheet.options[0]).toMatchObject({
  status: "candidate",
  reasonCode: "target_not_provided",
});
```

- [ ] **Step 5: Render baseline plus three scenario rows**

The table must display nominal/+Tol/-Tol, RSS, Cpk, minimum margin, yield and delta. For system targets, display apportionment policy and selected factors.

- [ ] **Step 6: Add deduplicated action-plan projection**

Group gaps by:

```ts
`${priority}\u0000${missingInformation}\u0000${responsibleRole}\u0000${verificationMethod}`
```

Preserve all affected source rows and evidence references. Do not change underlying `worksheet.dataGaps`.

- [ ] **Step 7: Run F6 optimization/composed tests**

```powershell
npx vitest run packages/workbook-catalog/src/f6-solver.test.ts packages/workbook-catalog/src/f6-scenario-adapter.test.ts packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-report.test.mjs scripts/f6-composed-report.test.mjs
```

- [ ] **Step 8: Commit Task 4**

```powershell
git add packages/contracts/src/contracts.ts packages/workbook-catalog/src/f6-composed-report.ts scripts/f6-composed-report.mjs scripts/f6-report.mjs packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-composed-report.test.mjs scripts/f6-report.test.mjs
git commit -m "feat(f6): present governed optimization scenarios"
```

---

### Task 5: Group F3 ADO Governance by Worksheet and Part / Subsystem

**Files:**
- Modify: `scripts/f3-ado-reminder.mjs`
- Modify: `.github/skills/f3-analysis/SKILL.md`
- Modify: `.github/skills/f3-analysis/references/ado-publishing.md`
- Test: `scripts/f3-ado-reminder.test.mjs`
- Test: `scripts/f3-full-flow.test.mjs`
- Test: `scripts/f3-skill.test.mjs`

**Interfaces:**
- Consumes: accepted F3 worksheets and rows in stable source order.
- Produces: one Markdown/HTML payload grouped by Worksheet then Part / Subsystem; still exactly one ADO write.

- [ ] **Step 1: Add failing Markdown grouping tests**

Use two worksheets and multiple subsystems. Assert headings and row uniqueness:

```js
expect(markdown).toContain("### Worksheet: Analysis-A");
expect(markdown).toContain("#### Part / Subsystem: Bracket (2 factors)");
expect(markdown.match(/Feature-A/g)).toHaveLength(1);
expect(markdown.match(/Feature-B/g)).toHaveLength(1);
```

- [ ] **Step 2: Add failing HTML grouping and factor-row tests**

Require:

```js
expect(html).toContain("<h3>Worksheet: Analysis-A</h3>");
expect(html).toContain("<h4>Part / Subsystem: Bracket (2 factors)</h4>");
expect((html.match(/<th>/g) ?? []).length).toBe(11);
expect((html.match(/<tr data-f3-factor-row=\"true\">/g) ?? []).length).toBe(3);
```

- [ ] **Step 3: Run F3 renderer tests and verify RED**

```powershell
npx vitest run scripts/f3-ado-reminder.test.mjs scripts/f3-full-flow.test.mjs
```

- [ ] **Step 4: Implement stable grouping**

Create a renderer helper:

```js
function groupedRows(worksheets) {
  return worksheets.map((worksheet) => ({
    worksheetName: worksheet.worksheetName,
    groups: [...Map.groupBy(worksheet.rows, (row) => row.partSubsystem ?? "(missing Part / Subsystem)")]
      .map(([partSubsystem, rows]) => ({ partSubsystem, rows })),
  }));
}
```

If runtime compatibility excludes `Map.groupBy`, implement the same stable grouping with `Map` and insertion order.

- [ ] **Step 5: Keep one 11-column table per payload and mark factor rows**

HTML may use group headings outside the table and one table per group only if the verification counts unique header names rather than raw `<th>` total. Preferred migration: one table with factor rows carrying `data-f3-factor-row="true"`; group labels use concrete attributes such as `<tbody data-worksheet="Analysis-A" data-part-subsystem="Bracket">` plus `<caption>`/preceding headings. Update verification contract to count marked factor rows, not all `<tr>`.

- [ ] **Step 6: Update ADO protocol contract tests**

Require the protocol to state:

- 11 unique header names;
- expected number of `data-f3-factor-row="true"` rows;
- group headings are not factor rows;
- canonical full-body/hash comparison remains mandatory.

- [ ] **Step 7: Run all F3 tests**

```powershell
npx vitest run scripts/f3-ado-reminder.test.mjs scripts/f3-full-flow.test.mjs scripts/f3-skill.test.mjs scripts/write-f3-ado-reminder.test.mjs
```

- [ ] **Step 8: Commit Task 5**

```powershell
git add scripts/f3-ado-reminder.mjs .github/skills/f3-analysis/SKILL.md .github/skills/f3-analysis/references/ado-publishing.md scripts/f3-ado-reminder.test.mjs scripts/f3-full-flow.test.mjs scripts/f3-skill.test.mjs
git commit -m "feat(f3): group ADO governance by subsystem"
```

---

### Task 6: Split F5 Markdown into Engineering Summary and Audit Appendix

**Files:**
- Modify: `scripts/f5-report.mjs`
- Test: `scripts/f5-report.test.mjs`
- Test: `scripts/f5-full-flow.test.mjs`

**Interfaces:**
- Consumes: unchanged `f5DataInterpretationResultSchema` JSON.
- Produces: one deterministic Markdown containing a compact engineering summary followed by a complete audit appendix.

- [ ] **Step 1: Add failing top-level summary assertions**

```js
expect(markdown).toContain("## 工程审查摘要");
expect(markdown).toContain("| Worksheet | Status | Cpk | Target Cpk | Top Contributor | Image Evidence | Governance | Next Step |");
expect(markdown.indexOf("## 工程审查摘要"))
  .toBeLessThan(markdown.indexOf("## 审计附录"));
```

- [ ] **Step 2: Add failing compact-card and appendix boundary tests**

Assert the summary contains image, capability, top contributors, key SIGNAL and clarification count but not `sourceFileHash=` or full `sourceCells=`. Assert those values still appear after `## 审计附录`.

- [ ] **Step 3: Run renderer tests and verify RED**

```powershell
npx vitest run scripts/f5-report.test.mjs
```

- [ ] **Step 4: Extract focused renderer functions**

Within the same module, add:

```js
function renderEngineeringSummary(lines, report, options) { /* compact only */ }
function renderAuditAppendix(lines, report, options) { /* existing five chapters */ }
```

Reuse existing `imageLink`, `sourceText`, `evidenceText`, redaction and containment helpers. Do not duplicate path handling.

- [ ] **Step 5: Add explicit ownership labels**

Render:

- `F5 owned: image evidence, capability/spec interpretation, contributors`;
- `Delegated to F6: quantified tolerance range, optimization scenarios, ROI, final engineering decision`.

- [ ] **Step 6: Keep all five existing audit chapters unchanged under appendix**

Existing chapter order/provenance tests must still pass by searching within the appendix.

- [ ] **Step 7: Run all F5 report/full-flow tests**

```powershell
npx vitest run scripts/f5-report.test.mjs scripts/f5-full-flow.test.mjs scripts/f5-output-layout.test.mjs
```

- [ ] **Step 8: Commit Task 6**

```powershell
git add scripts/f5-report.mjs scripts/f5-report.test.mjs scripts/f5-full-flow.test.mjs
git commit -m "feat(f5): add engineering summary and audit appendix"
```

---

### Task 7: Project Existing F0 Process Guidance into F6 as Audited Facts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/workbook-catalog/src/f6-composed-report.ts`
- Modify: `scripts/f6-composed-report.mjs`
- Test: `packages/workbook-catalog/src/f6-composed-report.test.ts`
- Test: `scripts/f6-composed-report.test.mjs`

**Interfaces:**
- Consumes: F2 row `capabilityStatus`, `recommendation`, and provenance already validated by the F6 loader.
- Produces: optional `processGuidance` per input-integrity factor; no new F0 query, risk, PASS/FAIL or recommendation.

- [ ] **Step 1: Add failing projection test for matched guidance**

Create an F2 factor fixture with `internal_within_guidance` and assert:

```ts
expect(factor.processGuidance).toMatchObject({
  status: "within-guidance",
  capabilityVersion: "internal-v1",
  assessedTotalBand: { value: 0.05, unit: "mm" },
  maximumRecommendedTotalBand: { value: 0.2, unit: "mm" },
  matchedEntryId: "cnc-linear-6",
});
```

- [ ] **Step 2: Run builder test and verify RED**

```powershell
npx vitest run packages/workbook-catalog/src/f6-composed-report.test.ts
```

- [ ] **Step 3: Add optional strict `processGuidance` schema**

Include status/version/bands/matched entry/fallback/evidence/reason. Do not add material, structure, assembly or supplier claims.

- [ ] **Step 4: Project by exact source identity**

Join F2 and F4 factors by worksheet/table/sourceRow. Copy F2 DTO values only. Do not call `loadInternalToleranceGuidance()` from F6.

- [ ] **Step 5: Add Markdown source-labelled process guidance table**

Display `RULE: F0 internal-v1` only for matched internal guidance; display `INSUFFICIENT_EVIDENCE` for missing process context.

- [ ] **Step 6: Add explicit negative tests**

Assert guidance-exceeded does not automatically create F6 risk, FAIL decision, feasibility result or optimization action.

- [ ] **Step 7: Run F0/F2/F6 related tests**

```powershell
npx vitest run packages/workbook-catalog/src/f0-capability-router.test.ts scripts/f2-report.test.mjs packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-composed-report.test.mjs
```

- [ ] **Step 8: Commit Task 7**

```powershell
git add packages/contracts/src/contracts.ts packages/workbook-catalog/src/f6-composed-report.ts scripts/f6-composed-report.mjs packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-composed-report.test.mjs
git commit -m "feat(f6): surface audited F0 process guidance"
```

---

### Task 8: Validate Real Workbook Compatibility and Full Repository Regression

**Files:**
- Modify only if necessary: existing focused tests from Tasks 1-7
- Create: `docs/governance/f3-f5-f6-report-readability-acceptance.md`
- Test: all repository tests and a new immutable real-workbook run

**Interfaces:**
- Consumes: the real workbook and the existing governed F0-F6 workflow.
- Produces: acceptance evidence only; does not modify the source workbook or historical demo-output.

- [ ] **Step 1: Run focused F3/F5/F6 suites**

```powershell
npx vitest run scripts/f3-ado-reminder.test.mjs scripts/f3-full-flow.test.mjs scripts/f5-report.test.mjs scripts/f5-full-flow.test.mjs packages/workbook-catalog/src/f6-report-projection.test.ts packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-report.test.mjs scripts/f6-composed-report.test.mjs scripts/f6-full-flow.test.mjs
```

Expected: all pass, no skipped test count increases.

- [ ] **Step 2: Run complete repository suite**

```powershell
npm test
```

Expected baseline or greater: 102 test files, 2252 passing tests, 4 environment-dependent skips, zero failures.

- [ ] **Step 3: Run a new governed real-workbook flow**

Use the F6 skill W0-W10 sequence against `test/Maera_cosmetic_critical_TA - Rev E_0110 - test.xlsx`. Select the same Keycap/HDMI/AJ worksheet set for comparison. Do not reuse or overwrite the previous run.

- [ ] **Step 4: Compare immutable calculation JSON values**

Assert the new F4 baseline values for Keycap/HDMI/AJ match the pre-change artifact for:

- system mean/RSS/Worst Case;
- LSL/USL/Target σ/Target Cpk;
- Cp/Cpk/yield/DPM;
- factor source identities and contributions.

Only report/optional derived display fields may differ.

- [ ] **Step 5: Review generated Markdown acceptance points**

Record evidence that the new reports show:

- Target 4σ label and substitution;
- typed statistical/Worst Case margins;
- Cpk formula/spec source;
- scientific self-check threshold;
- F3 missing-column summary;
- F5 image + SIGNAL loop overview;
- three scenarios only when targets are authorized;
- grouped F3 ADO payload;
- F5 summary before audit appendix.

- [ ] **Step 6: Write Chinese acceptance document**

Create `docs/governance/f3-f5-f6-report-readability-acceptance.md` with commands, pass counts, old/new artifact hashes, unchanged numeric baselines, generated report paths, and known F0 risk-library limitations.

- [ ] **Step 7: Run final diff and diagnostics**

```powershell
git diff --check
git status --short
```

Use VS Code diagnostics for all touched source/test files. No temporary generators, verifier scripts or modified historical demo-output may remain.

- [ ] **Step 8: Commit Task 8**

```powershell
git add docs/governance/f3-f5-f6-report-readability-acceptance.md
git commit -m "docs: record report readability acceptance"
```

---

## Final Integration Gate

Before merge:

1. `git log main..HEAD --oneline` shows one design commit plus eight independently reviewable implementation commits.
2. `npm test` is green with no test-count reduction.
3. `git diff main...HEAD -- test/demo-output` is empty except new immutable acceptance runs explicitly documented and intended for version control; default is no demo-output commit.
4. Source workbook SHA-256 remains `8805a128b6163b80afda55b3747dfeae58abeb100f40d9bb91ab6ec14d0a3742`.
5. F3 ADO protocol tests still enforce `top: 200`, one write, one readback, 11 headers, expected marked factor rows, canonical body and SHA-256.
6. Existing V2 artifacts still parse and existing report tests remain green.