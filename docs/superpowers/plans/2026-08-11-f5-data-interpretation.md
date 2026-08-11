# F5 数据解读 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 F0/F1/F3/F4 受控输出合成为可追溯的五章节 F5 报告，并提供“使用F5分析报告”可调用 skill，同时保留 ME 工程决策权。

**Architecture:** 保留现有 F5.1 作为 F4/F0 确定性解读内核；新增根 F5 合同、artifact loader、按 worksheet 编排器和 JSON/Markdown workflow。F1 图片观察由 skill 使用 image mode 生成受 schema 约束的 observation artifact，本地 workflow 只验证、关联和执行证据门禁，不隐式调用模型；F6 专属章节固定输出受控委派状态。

**Tech Stack:** TypeScript strict ESM、JavaScript ES modules、Zod v3、Vitest v3、Node.js CLI、Markdown、VS Code skill、`@ai-assist/contracts`、`@ai-assist/knowledge-base`、`@ai-assist/workbook-catalog`。

**Approved design:** `docs/superpowers/specs/2026-08-10-f5-data-interpretation-design.md`

---

## 文件结构

### 新建

- `packages/workbook-catalog/src/f5-data-interpretation.ts`：根 F5 按 worksheet 编排和五章节投影。
- `packages/workbook-catalog/src/f5-data-interpretation.test.ts`：根 F5 核心行为测试。
- `scripts/f5-artifact-loader.mjs`：读取并关联 F1/F3/F4 与可选图片观察 artifact。
- `scripts/f5-artifact-loader.test.mjs`：跨 artifact 身份、选择和证据门禁测试。
- `scripts/f5-report.mjs`、`scripts/f5-report.test.mjs`：五章节 Markdown 渲染。
- `scripts/f5-output-layout.mjs`、`scripts/f5-output-layout.test.mjs`：安全输出路径和固定文件名。
- `scripts/f5-cli-args.mjs`、`scripts/f5-cli-args.test.mjs`：三个上游目录、重复 worksheet 参数和图片观察参数。
- `scripts/run-f5-full-validation.mjs`、`scripts/f5-full-flow.test.mjs`：原子写入、manifest 和端到端 workflow。
- `apps/cli/src/commands/feature5.ts`、`apps/cli/src/commands/feature5.test.ts`：CLI 命令与中文短语识别。
- `.github/skills/f5-analysis/SKILL.md`、`scripts/f5-skill.test.mjs`：用户可调用 skill 与行为合同。

### 修改

- `packages/contracts/src/contracts.ts`、`packages/contracts/src/contracts.test.ts`：根 F5、图片观察和兼容 F5.1 合同。
- `packages/workbook-catalog/src/index.ts`：导出根 F5 编排器。
- `apps/cli/src/index.ts`、`apps/cli/src/index.test.ts`：注册 `feature5` 和短语路由。
- `package.json`：注册 `workflow:f5`。
- `packages/governance/src/feature-register.ts`、`packages/governance/src/policy-gate.test.ts`：F5 阶段能力登记。
- `docs/governance/feature-register.md`、`docs/governance/data-classification.md`：治理说明。
- `docs/01-architecture.md`、`docs/01-架构映射.md`、`docs/02-end-to-end-flow.md`、`docs/02-端到端流程.md`、`docs/04-feature-breakdown.md`、`docs/04-功能拆分.md`：F5/F6 边界和流程。
- `README.md`：workflow 命令和能力矩阵。

## 合同命名决策

- 保留现有 `interpretationRequestSchema`、`interpretationResultSchema` 和 `createInterpretation`，避免破坏 F5.1。
- 为 F5.1 completed 分支新增可读别名 `f5ObjectiveInterpretationCompletedResultSchema`。
- 根 F5 使用 `f5DataInterpretationRequestSchema` 和 `f5DataInterpretationResultSchema`。
- 本地 artifact 路径只由 `parseF5CliArgs` 和 loader 管理；loader 输出结构化 `F5DataInterpretationRequest`，core 和共享 contracts 不读取文件系统。
- F4 输入文件固定为现有 `Feature4-Calculation.json`，其中 `calculations[]` 对应多个 worksheet。

---

### Task 1: 定义根 F5 与图片观察合同

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Test: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: 写 F5.1 兼容与根 F5 RED 测试**

在现有 interpretation 测试旁增加以下断言：

```ts
expect(f5ObjectiveInterpretationCompletedResultSchema.parse(completedInterpretation)).toEqual(
  completedInterpretation,
);
expect(interpretationResultSchema.parse(completedInterpretation)).toEqual(completedInterpretation);

const observationArtifact = {
  contractVersion: "v1",
  inputClassification: "confidential",
  observationVersion: "f5-image-observation-v1",
  workbookContentHash: "a".repeat(64),
  worksheets: [{
    worksheetName: "Analysis-A",
    imageReference: {
      artifact: "f1",
      relativePath: "worksheets/Analysis-A/tolerance-path.png",
      contentHash: "b".repeat(64),
      worksheetName: "Analysis-A",
    },
    observations: [{
      scope: "stack_start",
      observedValue: "visible",
      confidence: "medium",
      visibleBasis: "A labeled start marker is visible in the worksheet image.",
      reviewStatus: "unreviewed",
    }],
  }],
};
expect(f5ImageObservationArtifactSchema.parse(observationArtifact)).toEqual(observationArtifact);
```

再构造一个最小根 F5 结果，要求五个 section key 固定存在：

```ts
expect(f5DataInterpretationResultSchema.parse(result).worksheets[0].sections).toMatchObject({
  toleranceChainValidity: { status: "not_evaluated" },
  capabilityVsSpecification: { status: "supported" },
  majorContributors: { status: "supported" },
  reasonableToleranceRange: { status: "delegated_to_f6" },
  designOptimizationAndParallelOptions: { status: "delegated_to_f6" },
});
```

覆盖拒绝场景：未知字段、`public` 分类、绝对图片路径、图片 worksheet/hash 不一致、OPTION 非 `rank: null`、RULE 缺知识库 `entryId/effectiveVersion/applicability/evidence`、F6 章节非 `delegated_to_f6`。

- [ ] **Step 2: 运行合同测试并确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL，提示 `f5DataInterpretationResultSchema` 或 `f5ImageObservationArtifactSchema` 未导出。

- [ ] **Step 3: 实现严格 schema 与类型**

在 `contracts.ts` 中定义并导出：

```ts
export const f5StructuralScopeSchema = z.enum([
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
  "cross_subsystem",
  "non_geometric_variable",
  "long_dimension_chain",
]);

export const f5EvidenceStatusSchema = z.enum([
  "supported",
  "needs_review",
  "not_evaluated",
  "insufficient_evidence",
  "not_applicable",
]);

export const f5ImageObservationArtifactSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  observationVersion: z.literal("f5-image-observation-v1"),
  workbookContentHash: sha256Schema,
  worksheets: z.array(z.object({
    worksheetName: z.string().min(1),
    imageReference: f1ImageReferenceSchema,
    observations: z.array(z.object({
      scope: f5StructuralScopeSchema,
      observedValue: z.enum(["visible", "not_visible", "ambiguous"]),
      confidence: z.enum(["high", "medium", "low"]),
      visibleBasis: z.string().min(1).max(500),
      reviewStatus: z.enum(["unreviewed", "confirmed", "rejected"]),
      confirmedBy: controlledReferenceSchema.optional(),
      confirmedAt: z.string().datetime().optional(),
    }).strict()).max(100),
  }).strict()).min(1),
}).strict();
```

增加 refinement：`imageReference.worksheetName === worksheetName`；`confirmed` 必须同时有 `confirmedBy/confirmedAt`，其他状态不得携带确认字段；worksheet 和 `(scope)` 不重复；图片路径必须沿用相对 artifact path schema。

根 F5 request 使用 loader 已解析的结构化证据：

```ts
export const f5DataInterpretationRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  workbook: z.object({ fileName: z.string().min(1), contentHash: sha256Schema }).strict(),
  knowledgeBaseVersion: z.literal("interpretation-rules-v1"),
  worksheets: z.array(z.object({
    worksheetName: z.string().min(1),
    imageReference: f1ImageReferenceSchema,
    governanceRows: z.array(f3GovernanceRowSchema),
    calculationResult: calculationCompletedResultSchema,
    imageObservations: z.array(f5ImageObservationArtifactSchema.shape.worksheets.element.shape.observations.element).max(100),
  }).strict()).min(1),
}).strict();
```

根结果定义 `status: completed | partially_completed | input_rejected`、按 worksheet 的 `completed | input_rejected` 联合、五个固定 section、clarification/assumption、summary 数量一致性 refinement。导出：

```ts
export type F5ImageObservationArtifact = z.infer<typeof f5ImageObservationArtifactSchema>;
export type F5DataInterpretationRequest = z.infer<typeof f5DataInterpretationRequestSchema>;
export type F5DataInterpretationResult = z.infer<typeof f5DataInterpretationResultSchema>;
```

将现有 F5.1 completed schema 改为导出的 `f5ObjectiveInterpretationCompletedResultSchema`，并继续由 `interpretationResultSchema` 引用它。

- [ ] **Step 4: 运行合同测试并确认 GREEN**

Run: Step 2 command.  
Expected: PASS，现有 F5.1 和新增根 F5 合同测试均通过。

- [ ] **Step 5: 记录合同检查点**

经用户授权提交时执行：

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat(f5): define data interpretation contracts"
```

---

### Task 2: 实现 F1/F3/F4 Artifact Loader

**Files:**
- Create: `scripts/f5-artifact-loader.mjs`
- Create: `scripts/f5-artifact-loader.test.mjs`

- [ ] **Step 1: 写 accepted bundle RED 测试**

测试 fixture 必须写出真实文件名：

```text
<f1-root>/Feature1-Report.json
<f3-root>/Feature3-Report.json
<f4-root>/Feature4-Calculation.json
```

F1 fixture 复用 F2 loader 所需的 `workbooks[0]` 索引和 worksheet JSON；F3 fixture 使用 `drawingGovernanceResultV2Schema`；F4 fixture使用 `f4WorkflowCalculationResultSchema`。断言：

```js
const loaded = loadF5ArtifactBundle({
  f1ArtifactRoot: f1Root,
  f3ArtifactRoot: f3Root,
  f4ArtifactRoot: f4Root,
  selectedWorksheetNames: ["Analysis-A"],
});
expect(loaded.status).toBe("accepted");
expect(loaded.request.worksheets).toHaveLength(1);
expect(loaded.request.worksheets[0]).toMatchObject({
  worksheetName: "Analysis-A",
  calculationResult: { featureId: "F4", status: "completed" },
});
```

- [ ] **Step 2: 运行 loader 测试并确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f5-artifact-loader.test.mjs
```

Expected: FAIL with module-not-found for `f5-artifact-loader.mjs`。

- [ ] **Step 3: 实现最小 accepted loader**

导出：

```js
export function loadF5ArtifactBundle({
  f1ArtifactRoot,
  f3ArtifactRoot,
  f4ArtifactRoot,
  selectedWorksheetNames,
  imageObservationArtifact,
})
```

实现要求：

1. 使用 `readFileSync` + JSON parse + contracts dist schema，不吞掉 schema 错误中的机密值。
2. F1 读取 `Feature1-Report.json` 并沿其 worksheet JSON 索引取得图片引用。
3. F3 只接受 `Feature3-Report.json` 且状态为 `completed` 或 `governance_required`。
4. F4 只接受 `Feature4-Calculation.json` 且状态为 `completed`。
5. 以 `(worksheetName, tableId)` 关联 F4 calculation；以 worksheet 关联 F1/F3。
6. 默认选择 F4 `calculations[]` 的顺序；显式选择保持用户顺序。
7. 返回 `f5DataInterpretationRequestSchema.parse(...)` 的 request。

- [ ] **Step 4: 增加关联门禁 RED 测试**

用 table-driven tests 覆盖：

```js
it.each([
  ["workbook hash mismatch", mutateF3Hash],
  ["unknown worksheet", selectUnknownWorksheet],
  ["duplicate worksheet", selectDuplicateWorksheet],
  ["F3 image hash mismatch", mutateF3ImageHash],
  ["F4 table mismatch", mutateF4TableId],
  ["F4 factor source mismatch", mutateFactorSource],
])("rejects %s", (_name, arrange) => {
  const loaded = loadF5ArtifactBundle(arrange(validBundle));
  expect(loaded).toMatchObject({ status: "inputRejected" });
});
```

再覆盖多 worksheet 隔离：一页 F3/F4 关联失败时返回一个 rejected worksheet 和其他 accepted worksheet；选择合同本身无效时整个 bundle `inputRejected`。

- [ ] **Step 5: 实现 fail-closed 关联与图片观察加载**

可选 `imageObservationArtifact` 必须由 `f5ImageObservationArtifactSchema` 解析，并验证 workbook hash、worksheet、图片 relative path/content hash。`low`、`rejected` observation 不在 loader 丢弃，而是传给 core 产生澄清；身份不匹配直接拒绝对应 worksheet。

拒绝结果只包含：

```js
{
  status: "inputRejected",
  reasonCode: "artifact_missing" | "artifact_contract_invalid" | "artifact_identity_mismatch" | "worksheet_selection_invalid",
  artifactReference: safeRelativeReference,
}
```

不得返回原始 JSON 或绝对路径。

- [ ] **Step 6: 运行 loader 与合同测试**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f5-artifact-loader.test.mjs packages/contracts/src/contracts.test.ts
```

Expected: PASS。

- [ ] **Step 7: 记录 loader 检查点**

经用户授权提交时执行：

```powershell
git add scripts/f5-artifact-loader.mjs scripts/f5-artifact-loader.test.mjs
git commit -m "feat(f5): load controlled upstream artifacts"
```

---

### Task 3: 实现根 F5 确定性编排器

**Files:**
- Create: `packages/workbook-catalog/src/f5-data-interpretation.ts`
- Create: `packages/workbook-catalog/src/f5-data-interpretation.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: 写能力/贡献章节 RED 测试**

复用 `interpretation-placeholder.test.ts` 的 completed calculation fixture，构造一个 worksheet request，注入 spy：

```ts
const createObjectiveInterpretation = vi.fn(() => completedInterpretation);
const result = createF5DataInterpretation(request, { createObjectiveInterpretation });

expect(createObjectiveInterpretation).toHaveBeenCalledWith({
  contractVersion: "v1",
  inputClassification: "confidential",
  calculationResult: request.worksheets[0].calculationResult,
});
expect(result.worksheets[0].sections.capabilityVsSpecification.status).toBe("supported");
expect(result.worksheets[0].sections.majorContributors.items.map((item) => item.contributionPercent))
  .toEqual([60, 40]);
expect(result.worksheets[0].sections.reasonableToleranceRange.status).toBe("delegated_to_f6");
expect(result.worksheets[0].sections.designOptimizationAndParallelOptions.status)
  .toBe("delegated_to_f6");
```

- [ ] **Step 2: 运行 core 测试并确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f5-data-interpretation.test.ts
```

Expected: FAIL，因为模块或导出不存在。

- [ ] **Step 3: 实现 objective interpretation 复用和五章节骨架**

导出：

```ts
export function createF5DataInterpretation(
  input: unknown,
  dependencies: { createObjectiveInterpretation?: typeof createInterpretation } = {},
): F5DataInterpretationResult
```

实现顺序：

1. `f5DataInterpretationRequestSchema.parse(input)`。
2. 每个 worksheet 调现有 `createInterpretation`，不复制 F0 阈值或 F4 trace 校验。
3. capability section 只投影 F5.1 的 capability FACT/RULE。
4. contributor section 以 contribution 降序，tie 使用 F4 原索引；合并 F3 drawing/DIM ID/source。
5. 两个 F6 section 固定 `delegated_to_f6`，OPTION 保持 `rank: null`。
6. 用 `f5DataInterpretationResultSchema.parse` 二次验证，structuredClone 后递归冻结。

- [ ] **Step 4: 写结构证据与澄清 RED 测试**

覆盖以下精确结果：

- 无 observation：所有结构 scope 为 `not_evaluated`，有 `image_not_available` 或 `drawing_evidence_not_evaluated` clarification。
- `low`：`insufficient_evidence` + `image_observation_low_confidence`。
- `medium/unreviewed`：最多 `needs_review` SIGNAL。
- `high/unreviewed`：仍不得生成最终 RULE。
- `confirmed`：可生成 image FACT，但工程判断仍保留 `requiresEngineeringReview: true`。
- `rejected`：不生成 FACT/SIGNAL，产生 clarification。
- 缺 assembly datum/stack start/subsystem/direction：只影响依赖 scope，不删除 capability 或 contributor 结论。

- [ ] **Step 5: 实现 evidence gate、F3 SIGNAL 和假设清单**

结构观察只生成：

```ts
{
  type: "FACT",
  provenanceKind: "image_observation",
  scope,
  observedValue,
  imageReference,
  confidence,
  reviewStatus,
}
```

或：

```ts
{
  type: "SIGNAL",
  requiresEngineeringReview: true,
  triggerFactReferences: [factId],
}
```

F3 的 `missing/suspected_invalid/duplicate_conflict` 生成 `identifier_governance_gap` SIGNAL；不得把它转换为“公差链无效”。未确认 assumption 固定 `status: proposed`，不能改变 section status。

- [ ] **Step 6: 运行 core、F5.1 和 F0 回归测试**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f5-data-interpretation.test.ts packages/workbook-catalog/src/interpretation-placeholder.test.ts packages/knowledge-base/src/interpretation/query.test.ts
```

Expected: PASS。

- [ ] **Step 7: 记录 core 检查点**

经用户授权提交时执行：

```powershell
git add packages/workbook-catalog/src/f5-data-interpretation.ts packages/workbook-catalog/src/f5-data-interpretation.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat(f5): compose evidence-based interpretations"
```

---

### Task 4: 实现五章节 Markdown 报告

**Files:**
- Create: `scripts/f5-report.mjs`
- Create: `scripts/f5-report.test.mjs`

- [ ] **Step 1: 写固定章节和证据链接 RED 测试**

```js
const markdown = renderF5Report(completedResult, { outputRoot });
expect(markdown.indexOf("## 1. 公差链有效性"))
  .toBeLessThan(markdown.indexOf("## 2. 能力与规格对比"));
expect(markdown).toContain("## 3. 主要贡献因子");
expect(markdown).toContain("## 4. 合理公差范围");
expect(markdown).toContain("## 5. 设计优化与并列方案");
expect(markdown).toContain("delegated_to_f6");
expect(markdown).toContain("interpretation-rules-v1");
expect(markdown).toContain("[F1 图片](../f1/worksheets/Analysis-A/tolerance-path.png)");
expect(markdown).not.toMatch(/[A-Z]:\\/i);
```

- [ ] **Step 2: 运行 report 测试并确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f5-report.test.mjs
```

Expected: FAIL，因为 renderer 不存在。

- [ ] **Step 3: 实现确定性 renderer**

导出：

```js
export function renderF5Report(report, { outputRoot } = {})
```

要求：先 parse `f5DataInterpretationResultSchema`；按 artifact root 与 output root 生成相对链接；转义 Markdown 表格字符；RULE 显示 entry/version/applicability/source range/hash；SIGNAL 显示“需要 ME 评审”；OPTION 显示“未排序”；澄清卡片显示 missing evidence、受影响结论和 reviewer question；假设显示状态，不将 proposed 写成已采用。

- [ ] **Step 4: 增加隐私和状态矩阵测试**

覆盖 `completed`、`partially_completed`、`input_rejected`；确保报告不包含绝对路径、workbook bytes、模型隐藏推理、未受控规则文本或 `recommended/preferred` 字段。

- [ ] **Step 5: 运行 report 测试并确认 GREEN**

Run: Step 2 command.  
Expected: PASS。

- [ ] **Step 6: 记录 report 检查点**

经用户授权提交时执行：

```powershell
git add scripts/f5-report.mjs scripts/f5-report.test.mjs
git commit -m "feat(f5): render five-section analysis report"
```

---

### Task 5: 实现 F5 参数解析与输出布局

**Files:**
- Create: `scripts/f5-cli-args.mjs`
- Create: `scripts/f5-cli-args.test.mjs`
- Create: `scripts/f5-output-layout.mjs`
- Create: `scripts/f5-output-layout.test.mjs`

- [ ] **Step 1: 写 CLI parser RED 测试**

```js
expect(parseF5CliArgs([
  "f1-run",
  "f3-run",
  "f4-run",
  "--worksheet", "Analysis-A",
  "--worksheet", "Analysis-B",
  "--image-observations", "observations.json",
])).toEqual({
  f1ArtifactRoot: "f1-run",
  f3ArtifactRoot: "f3-run",
  f4ArtifactRoot: "f4-run",
  selectedWorksheetNames: ["Analysis-A", "Analysis-B"],
  imageObservationsPath: "observations.json",
});
```

拒绝少于/多于三个位置参数、重复 worksheet、空值、未知 flag、重复 image flag。

- [ ] **Step 2: 写 output layout RED 测试**

固定文件名：

```js
expect(resolveFeature5OutputLayout(parsed, outputRoot, now)).toMatchObject({
  reportJsonName: "Feature5-Report.json",
  reportMdName: "Feature5-Report.md",
  runSummaryJsonName: "Feature5-Run-Summary.json",
  imageObservationsJsonName: "Feature5-Image-Observations.json",
  manifestName: "manifest.json",
});
```

拒绝空 output override、`..` traversal 和无法生成安全 stem 的输入。

- [ ] **Step 3: 运行 parser/layout 测试并确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f5-cli-args.test.mjs scripts/f5-output-layout.test.mjs
```

Expected: FAIL with module-not-found。

- [ ] **Step 4: 实现 parser 与 layout**

`parseF5CliArgs(args)` 只接受三个位置参数、重复 `--worksheet <name>` 和单个 `--image-observations <path>`。`resolveFeature5OutputLayout(parsed, outputRoot, now)` 沿用 F3/F4 的 `safeName`、ISO run ID 和 traversal 防护；默认根目录为 `test/demo-output/f5-runs/<f4-run-stem>/<runId>`。

- [ ] **Step 5: 运行 parser/layout 测试并确认 GREEN**

Run: Step 3 command.  
Expected: PASS。

- [ ] **Step 6: 记录 CLI/layout 检查点**

经用户授权提交时执行：

```powershell
git add scripts/f5-cli-args.mjs scripts/f5-cli-args.test.mjs scripts/f5-output-layout.mjs scripts/f5-output-layout.test.mjs
git commit -m "feat(f5): define workflow inputs and outputs"
```

---

### Task 6: 实现 F5 Full Workflow

**Files:**
- Create: `scripts/run-f5-full-validation.mjs`
- Create: `scripts/f5-full-flow.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写 completed full-flow RED 测试**

使用 dependency injection 构造 accepted loader 和 completed core result，断言原子写入顺序：

```js
expect(result).toMatchObject({ status: "completed", outputDirectory: runRoot });
expect(readdirSync(runRoot).sort()).toEqual([
  "Feature5-Report.json",
  "Feature5-Report.md",
  "Feature5-Run-Summary.json",
  "manifest.json",
].sort());
expect(renameCalls.map(({ to }) => path.basename(to))).toEqual([
  "Feature5-Report.json",
  "Feature5-Report.md",
  "Feature5-Run-Summary.json",
  "manifest.json",
]);
```

有 observation 输入时额外写 `Feature5-Image-Observations.json`，内容必须是 schema-validated artifact。

- [ ] **Step 2: 运行 full-flow 测试并确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f5-full-flow.test.mjs
```

Expected: FAIL，因为 runner 不存在。

- [ ] **Step 3: 实现 runner 与 manifest**

导出：

```js
export function runF5FullValidation(options = {}, dependencyOverrides = {})
```

流程固定为：parse args -> resolve layout -> load bundle -> create interpretation -> parse result -> render Markdown -> 原子写 JSON/MD/summary/optional observations -> 最后写 manifest。返回：

```js
{
  status: "completed" | "partially_completed" | "failed",
  outputDirectory,
  reportJsonPath,
  reportMdPath,
  runSummaryPath,
  manifestPath,
  summary,
}
```

失败 manifest reason code 只允许 `input_rejected`、`interpretation_failed`、`workflow_output_failed`、`invalid_arguments_or_output_root`，不包含异常原文。

- [ ] **Step 4: 增加失败与隔离测试**

覆盖 loader reject、core throw、Markdown throw、原子 rename 失败、一个 worksheet rejected、临时文件清理，以及 manifest 不引用未成功写出的 artifact。

- [ ] **Step 5: 注册 npm workflow 并运行真实进程测试**

在 `package.json` 增加：

```json
"workflow:f5": "node scripts/run-f5-full-validation.mjs"
```

full-flow 通过 `execFileSync(process.execPath, ["scripts/run-f5-full-validation.mjs", ...])` 验证 stdout 是 machine-readable JSON，失败退出码非零。

- [ ] **Step 6: 运行 workflow 聚焦测试**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f5-artifact-loader.test.mjs scripts/f5-report.test.mjs scripts/f5-cli-args.test.mjs scripts/f5-output-layout.test.mjs scripts/f5-full-flow.test.mjs
```

Expected: PASS。

- [ ] **Step 7: 记录 runner 检查点**

经用户授权提交时执行：

```powershell
git add scripts/run-f5-full-validation.mjs scripts/f5-full-flow.test.mjs package.json
git commit -m "feat(f5): add full validation workflow"
```

---

### Task 7: 增加 CLI Feature 5 路由

**Files:**
- Create: `apps/cli/src/commands/feature5.ts`
- Create: `apps/cli/src/commands/feature5.test.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`

- [ ] **Step 1: 写 command 与 phrase RED 测试**

```ts
expect(isFeature5Phrase("使用F5分析报告")).toBe(true);
expect(isFeature5Phrase("使用 F5 分析报告")).toBe(true);
expect(isFeature5Phrase("use f5 analysis report")).toBe(true);
expect(isFeature5Phrase("F5")).toBe(false);
```

mock `execFile` 或 runner process，断言只调用 `scripts/run-f5-full-validation.mjs`，参数顺序为 F1/F3/F4 roots，stdout 必须包含 `f5: <outputDirectory>` 和 status。

- [ ] **Step 2: 运行 command 测试并确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts apps/cli/src/commands/feature5.test.ts apps/cli/src/index.test.ts
```

Expected: FAIL，因为 feature5 module 和路由不存在。

- [ ] **Step 3: 实现 command、显式命令和自然语言路由**

导出：

```ts
export async function runFeature5WorkflowCommand(
  rootDir: string,
  f1ArtifactRoot: string,
  f3ArtifactRoot: string,
  f4ArtifactRoot: string,
  options: { selectedWorksheetNames?: string[]; imageObservationsPath?: string } = {},
): Promise<string>

export function isFeature5Phrase(value: string | undefined): boolean
```

扩展 CLI dependency injection、`Command` union、`parseArguments` 和 `executeCommand`。显式命令使用：

```text
feature5 --root <repo> --f1-artifacts <dir> --f3-artifacts <dir> --f4-artifacts <dir>
```

自然语言短语必须同时接收三个 artifact roots；缺任一项返回受控 validation error。不要在 CLI 内运行 image mode。

- [ ] **Step 4: 运行 CLI 测试并确认 GREEN**

Run: Step 2 command.  
Expected: PASS，并且 feature1/2/3 路由回归通过。

- [ ] **Step 5: 记录 CLI 检查点**

经用户授权提交时执行：

```powershell
git add apps/cli/src/commands/feature5.ts apps/cli/src/commands/feature5.test.ts apps/cli/src/index.ts apps/cli/src/index.test.ts
git commit -m "feat(cli): expose feature 5 workflow"
```

---

### Task 8: 创建“使用F5分析报告”Skill 与 Image Mode 协议

**Files:**
- Create: `.github/skills/f5-analysis/SKILL.md`
- Create: `scripts/f5-skill.test.mjs`

- [ ] **Step 1: 写 frontmatter 和命令白名单 RED 测试**

复用 `f3-skill.test.mjs` 的 frontmatter/command helper 风格，锁定：

```js
expect(frontmatter.name).toBe("f5-analysis");
expect(frontmatter["user-invocable"]).toBe("true");
expect(frontmatter.description).toContain("使用F5分析报告");
expect(frontmatter.description).toContain("使用 F5 分析报告");
expect(commands).toEqual([
  "npm run workflow:f1 -- <ta-workbook-path>",
  "npm run workflow:f2 -- <f1-output-dir>",
  "npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]",
  "npm run workflow:f4 -- --f2-report <f2-output-dir>/Feature2-Report.json",
  "npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir>",
  "npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --image-observations <artifact-path>",
]);
```

- [ ] **Step 2: 写 phase 顺序与安全边界 RED 测试**

要求 skill 明确：

1. workbook 模式先 F1 -> F2 -> ready worksheet 多选 -> 同选择 F3/F4 -> 可选 image mode -> F5。
2. 已有 F5 artifact 模式验证 `Feature5-Report.json` 后直接展示，不重跑。
3. F3 local workflow 不进入 ADO publish phase。
4. image mode 只能读取 F1 `imageReference`，不能读取任意路径。
5. observation 必须写入 `f5-image-observation-v1` JSON，并在 F5 前经 hash/worksheet 校验。
6. 缺图或用户跳过图片分析时继续确定性 F5，结构章节为 `not_evaluated`。
7. skill 不请求 credential，不调用 REST/browser/shell HTTP，不修改源 workbook。

- [ ] **Step 3: 运行 skill 测试并确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f5-skill.test.mjs
```

Expected: FAIL，因为 skill 文件不存在。

- [ ] **Step 4: 编写 skill**

frontmatter：

```yaml
---
name: f5-analysis
description: "Use when the user asks for F5, 使用F5分析报告, 使用 F5 分析报告, use F5 analysis report, or TA data interpretation from F0/F1/F3/F4 outputs."
user-invocable: true
argument-hint: "<ta-workbook-or-f5-report-path>"
---
```

正文定义两种 entry mode、命令白名单、worksheet 选择、image observation schema 字段、证据门禁、报告展示和禁止项。图片观察只记录可见内容，不输出隐藏推理；`medium/high unreviewed` 最多产生 FACT/SIGNAL，最终判断交给 ME。

- [ ] **Step 5: 运行 skill 与 workflow 测试**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f5-skill.test.mjs scripts/f5-full-flow.test.mjs scripts/f3-skill.test.mjs
```

Expected: PASS，F3 skill 合同不回退。

- [ ] **Step 6: 记录 skill 检查点**

经用户授权提交时执行：

```powershell
git add .github/skills/f5-analysis/SKILL.md scripts/f5-skill.test.mjs
git commit -m "feat(f5): add invocable analysis skill"
```

---

### Task 9: 更新治理状态与中英文文档

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `docs/governance/feature-register.md`
- Modify: `docs/governance/data-classification.md`
- Modify: `docs/01-architecture.md`
- Modify: `docs/01-架构映射.md`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/04-feature-breakdown.md`
- Modify: `docs/04-功能拆分.md`
- Modify: `README.md`

- [ ] **Step 1: 写治理 RED 测试**

保留 F5.1 available 断言，并要求根 F5：

```ts
expect(getFeatureStatus("F5")).toMatchObject({
  featureId: "F5",
  status: "available",
  inputContractId: "f5-data-interpretation-request-v1",
  outputContractId: "f5-data-interpretation-result-v1",
  maximumClassification: "confidential",
});
expect(getFeatureStatus("F5.1").status).toBe("available");
```

F5 acceptance evidence 包含 `f5-artifact-association-check`、`f5-rule-traceability-check`、`f5-clarification-gate-check`、`f5-skill-contract-check`；外部前置条件包含 approved knowledge base 和 ME review。

- [ ] **Step 2: 运行 governance 测试并确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts
```

Expected: FAIL，因为根 F5 当前仍 unavailable。

- [ ] **Step 3: 更新 feature register**

根 F5 标为阶段性 available，并在 `feature-register.ts` 的说明字段明确：

- capability/contributor interpretation available；
- image structural results remain review-gated；
- F6 sections delegated；
- 无证据时 fail closed。

不要修改 F5.1 的已有合同或历史验收记录。

- [ ] **Step 4: 同步中英文文档**

所有文档统一以下口径：

- F5 五章节展示，前三段由 F5，后两段委派 F6。
- F5 直接输入 F0/F1/F3/F4；从 workbook 启动时 F2 是必要上游门禁。
- F1 是图片唯一物理 owner。
- image mode observation 不是图纸真值，必须经过置信度与 ME review gate。
- `workflow:f5` 和“使用F5分析报告”是受支持入口。
- F5 不自动发布 ADO，不回写 workbook。

README 增加 `npm run workflow:f5 -- <f1> <f3> <f4>` 示例和 artifact 文件列表。

- [ ] **Step 5: 运行治理与 repository 检查**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts
npm run check:repository
```

Expected: PASS。

- [ ] **Step 6: 记录治理文档检查点**

经用户授权提交时执行：

```powershell
git add packages/governance/src/feature-register.ts packages/governance/src/policy-gate.test.ts docs/governance/feature-register.md docs/governance/data-classification.md docs/01-architecture.md docs/01-架构映射.md docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/04-feature-breakdown.md docs/04-功能拆分.md README.md
git commit -m "docs(f5): publish governed interpretation workflow"
```

---

### Task 10: 最终验证与审查

**Files:**
- Review: all files changed by Tasks 1-9

- [ ] **Step 1: 运行 F5 聚焦测试**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/knowledge-base/src/interpretation/query.test.ts packages/workbook-catalog/src/interpretation-placeholder.test.ts packages/workbook-catalog/src/f5-data-interpretation.test.ts scripts/f5-artifact-loader.test.mjs scripts/f5-report.test.mjs scripts/f5-cli-args.test.mjs scripts/f5-output-layout.test.mjs scripts/f5-full-flow.test.mjs scripts/f5-skill.test.mjs apps/cli/src/commands/feature5.test.ts apps/cli/src/index.test.ts packages/governance/src/policy-gate.test.ts
```

Expected: all selected tests PASS。

- [ ] **Step 2: 运行构建、lint 和仓库验证**

```powershell
npm run build -- --force
npm run lint
npm run check:repository
git diff --check
```

Expected: every command exits 0。

- [ ] **Step 3: 运行完整测试套件**

```powershell
npm test
```

Expected: PASS。若出现与本分支无关的既有失败，记录精确测试名和失败输出，不修改无关代码。

- [ ] **Step 4: 做需求覆盖审查**

逐项确认：

- 四类 statement 都有合同和测试。
- 五章节固定存在，F6 两段无越界计算。
- RSS sigma、Cpk、规格窗口规则引用 F0 entry/version/scope。
- contributor 排序稳定且原因只来自可测量事实/规则。
- 跨子系统、非几何变量、长链只生成有证据 SIGNAL。
- 装配基准面、起点、方向、子系统缺失产生 clarification/assumption。
- F1/F3/F4 identity mismatch fail closed。
- “使用F5分析报告”可触发 skill。
- 现有 F5.1/F3/F4 回归通过。

- [ ] **Step 5: 请求代码审查**

使用 `requesting-code-review` 流程审查批准规格、此计划、branch diff 和验证结果。修复 high/medium finding 时重新执行对应 RED/GREEN 测试，再重复 Steps 1-3。

- [ ] **Step 6: 最终状态检查**

```powershell
git status --short --branch
git diff --stat
git diff --check
```

Expected: 只包含 F5 计划范围内变更，无临时 artifact、绝对路径或未跟踪测试输出。是否提交、推送或创建 PR 由用户另行明确授权。
