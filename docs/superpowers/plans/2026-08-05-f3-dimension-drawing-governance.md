# F3 DIM ID 与图纸治理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可追溯、非阻断的 F3 Drawing Number/DIM ID 治理能力，生成本地 JSON/Markdown 清单，并通过宿主注入的 Surface MCP client 安全准备和执行 ADO Comment 0 更新。

**Architecture:** 保留现有 F3 v1 placeholder 兼容面，新增正式 `drawing-governance-request-v2` / `drawing-governance-result-v2`。确定性治理核心位于 `workbook-catalog`，所有 MCP 和文件 IO 位于 adapter/runner 边界；F2 只做兼容字段透传，F3 v2 对结构化来源执行严格校验。

**Tech Stack:** TypeScript 5.7、Node.js ESM、Zod 3、Vitest 3、npm workspaces、Markdown/JSON artifacts、宿主注入 Surface MCP capability client。

---

## 文件职责

### 修改

- `packages/contracts/src/contracts.ts`：F2 兼容字段迁移、F3 v2 DTO、Surface MCP prepare/execute DTO。
- `packages/contracts/src/contracts.test.ts`：严格 schema、跨字段一致性和隐私边界测试。
- `scripts/f2-artifact-loader.mjs`：从 F1 worksheet JSON 透传 `toleranceLoopDescription`。
- `scripts/f2-artifact-loader.test.mjs`：F2 loader 传输回归。
- `packages/workbook-catalog/src/f2-user-report.ts`：把 description 保留到 worksheet 报告。
- `packages/workbook-catalog/src/f2-user-report.test.ts`：F2 report 兼容回归。
- `packages/workbook-catalog/src/index.ts`：导出正式 F3 core。
- `packages/adapters/src/index.ts`：导出 Surface MCP F3 adapter 和配置检查器。
- `apps/cli/src/index.ts`、`apps/cli/src/index.test.ts`：注册 `feature3` 命令。
- `package.json`：增加 `workflow:f3`。
- `packages/governance/src/feature-register.ts`、`packages/governance/src/policy-gate.test.ts`：验收完成后启用 F3 v2。
- `docs/01-architecture.md`、`docs/01-架构映射.md`：移除里程碑 scheduler，改为即时确认写入。
- `docs/02-end-to-end-flow.md`、`docs/02-端到端流程.md`：同步 F3 新流程。
- `docs/04-feature-breakdown.md`、`docs/04-功能拆分.md`：同步组合键和 DIM ID 规则。
- `docs/05-design-decisions.md`、`docs/05-设计决策.md`：同步仅 Surface MCP 与本地回退。
- `docs/governance/feature-register.md`：同步正式 F3 状态和边界。

### 新增

- `packages/workbook-catalog/src/f3-drawing-governance.ts`：纯函数治理核心。
- `packages/workbook-catalog/src/f3-drawing-governance.test.ts`：锚点、格式、重复、排序和拒绝测试。
- `packages/adapters/src/surface-mcp-drawing-governance-adapter.ts`：宿主注入 Surface MCP client 的 prepare/confirm/execute adapter。
- `packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts`：能力、负责人、并发和 fail-closed 测试。
- `packages/adapters/src/surface-mcp-config.ts`：只读配置检测和 capability 报告。
- `packages/adapters/src/surface-mcp-config.test.ts`：仅 surface-mcp 配置测试。
- `scripts/f3-artifact-loader.mjs`、`scripts/f3-artifact-loader.test.mjs`：读取 F2 JSON，不解析 Markdown。
- `scripts/f3-report.mjs`、`scripts/f3-report.test.mjs`：同模型 Markdown renderer。
- `scripts/f3-output-layout.mjs`、`scripts/f3-output-layout.test.mjs`：受控输出布局。
- `scripts/run-f3-full-validation.mjs`、`scripts/f3-full-flow.test.mjs`：本地端到端 runner。
- `apps/cli/src/commands/feature3.ts`、`apps/cli/src/commands/feature3.test.ts`：CLI 包装。

## Task 1: 增加 F2 兼容字段与 F3 v2 契约

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: 写入 F2 description 兼容迁移的失败测试**

在 `packages/contracts/src/contracts.test.ts` 增加一个包含 worksheet description 的 F2 artifact，并断言旧 artifact 仍可解析：

```ts
it("accepts an optional tolerance loop description during F2 migration", () => {
  const withDescription = f2ArtifactInputSchema.parse({
    ...validF2ArtifactInput(),
    worksheets: [{
      ...validF2ArtifactInput().worksheets[0],
      toleranceLoopDescription: "Anonymous device gap",
    }],
  });
  expect(withDescription.worksheets[0]?.toleranceLoopDescription).toBe("Anonymous device gap");
  expect(() => f2ArtifactInputSchema.parse(validF2ArtifactInput())).not.toThrow();
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL，严格 `f2ArtifactInputSchema` 拒绝未知字段 `toleranceLoopDescription`。

- [ ] **Step 3: 最小扩展 F2 worksheet schema**

在 `f2ArtifactInputSchema` 的 worksheet 对象增加：

```ts
toleranceLoopDescription: z.string().min(1).optional(),
```

保持 optional 以兼容历史 F2 artifact；F3 v2 将单独要求该字段。

- [ ] **Step 4: 写入 F3 v2 schema 的失败测试**

增加测试覆盖：严格字段、`confidential`、ready worksheet、来源位置、状态计数、正式键条件以及 ADO 状态。

```ts
it("parses a strict F3 v2 governance report", () => {
  const report = drawingGovernanceResultV2Schema.parse(validF3GovernanceResult());
  expect(report.modelVersion).toBe("drawing-governance-v2");
  expect(report.worksheets[0]?.rows[0]?.factorInstanceId).toMatch(/^[a-f0-9]{64}$/);
  expect(report.worksheets[0]?.rows[0]?.source.sourceRow).toBe(14);
});

it("rejects a formal drawing key for a non-valid DIM ID", () => {
  const report = validF3GovernanceResult();
  report.worksheets[0].rows[0].dimIdStatus = "suspected_invalid";
  expect(() => drawingGovernanceResultV2Schema.parse(report)).toThrow();
});
```

- [ ] **Step 5: 运行测试并确认 RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL，`drawingGovernanceResultV2Schema` 尚未导出。

- [ ] **Step 6: 实现正式 F3 v2 DTO**

在旧 v1 placeholder schema 旁新增并导出以下结构；旧 `drawingGovernanceRequestSchema` 和 `drawingGovernanceResultSchema` 不删除：

```ts
export const f3DimIdStatusSchema = z.enum([
  "missing",
  "suspected_invalid",
  "valid",
  "needs_confirmation",
]);

export const f3GovernanceStatusSchema = z.enum([
  "complete",
  "needs_governance",
  "blocked_for_reminder",
]);

const f3SourceSchema = z.object({
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  sourceRow: z.number().int().positive(),
  sourceCells: z.record(worksheetFieldNameSchema, worksheetSourceCellSchema),
}).strict();

export const drawingGovernanceRequestV2Schema = z.object({
  contractVersion: contractVersionSchema,
  modelVersion: z.literal("drawing-governance-v2"),
  inputClassification: z.literal("confidential"),
  workbook: z.object({
    fileName: z.string().min(1),
    contentHash: sha256Schema,
  }).strict(),
  worksheets: z.array(z.object({
    worksheetName: z.string().min(1),
    toleranceLoopDescription: z.string().min(1),
    f2Status: z.literal("ready"),
    rows: z.array(f2EnhancedRowSchema),
  }).strict()).min(1),
}).strict();

const f3GovernanceRowSchema = z.object({
  factorInstanceId: sha256Schema,
  drawingDimensionKey: sha256Schema.optional(),
  deviceLevelDim: z.string().min(1),
  dimensionDescription: z.string().min(1),
  partCategory: z.string().min(1),
  partSubsystem: z.string().min(1),
  drawingNumber: z.string().nullable(),
  dimId: z.string().nullable(),
  factorDescription: z.string().min(1),
  nominal: z.number().finite(),
  upperTolerance: z.number().finite(),
  lowerTolerance: z.number().finite(),
  sigmaLevel: z.number().finite(),
  dimIdStatus: f3DimIdStatusSchema,
  qualitySignals: z.array(z.enum([
    "drawing_number_missing",
    "dim_id_missing",
    "dim_id_suspected_invalid",
    "dim_id_needs_confirmation",
    "duplicate_conflict",
  ])),
  governanceStatus: f3GovernanceStatusSchema,
  source: f3SourceSchema,
}).strict().superRefine((row, context) => {
  if (row.drawingDimensionKey !== undefined && row.dimIdStatus !== "valid") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "only valid DIM IDs may have a formal drawing dimension key",
      path: ["drawingDimensionKey"],
    });
  }
});

const drawingGovernanceAcceptedResultV2Schema = z.object({
  contractVersion: contractVersionSchema,
  modelVersion: z.literal("drawing-governance-v2"),
  outputClassification: z.literal("confidential"),
  featureId: z.literal("F3"),
  status: z.enum(["completed", "governance_required"]),
  workbook: z.object({ fileName: z.string().min(1), contentHash: sha256Schema }).strict(),
  worksheets: z.array(z.object({
    worksheetName: z.string().min(1),
    toleranceLoopDescription: z.string().min(1),
    rows: z.array(f3GovernanceRowSchema),
  }).strict()),
  ado: z.object({
    status: z.enum([
      "not_requested",
      "draft_ready",
      "confirmation_required",
      "updated",
      "blocked",
      "failed",
    ]),
    workItemReference: z.string().min(1).optional(),
    reasonCode: z.string().min(1).optional(),
  }).strict(),
  summary: z.object({
    worksheetCount: z.number().int().nonnegative(),
    factorCount: z.number().int().nonnegative(),
    completeCount: z.number().int().nonnegative(),
    governanceRequiredCount: z.number().int().nonnegative(),
    duplicateConflictCount: z.number().int().nonnegative(),
  }).strict(),
}).strict();

const drawingGovernanceInputRejectedResultV2Schema = z.object({
  contractVersion: contractVersionSchema,
  modelVersion: z.literal("drawing-governance-v2"),
  outputClassification: z.literal("confidential"),
  featureId: z.literal("F3"),
  status: z.literal("input_rejected"),
  artifactIssues: z.array(z.object({
    reasonCode: z.enum([
      "f2_report_missing",
      "f2_report_invalid",
      "workbook_identity_mismatch",
      "description_missing",
      "no_ready_worksheet",
    ]),
    artifactReference: z.string().min(1),
  }).strict()).min(1),
}).strict();

export const drawingGovernanceResultV2Schema = z.union([
  drawingGovernanceInputRejectedResultV2Schema,
  drawingGovernanceAcceptedResultV2Schema,
]);
```

导出 `DrawingGovernanceRequestV2` 和 `DrawingGovernanceResultV2` inferred types。super refinement 还必须重算 summary 与顶层 status，拒绝计数不一致。

- [ ] **Step 7: 运行 contracts 测试并确认 GREEN**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: PASS。

- [ ] **Step 8: 提交契约变更**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat(f3): define drawing governance v2 contracts"
```

## Task 2: 贯通 F1 到 F2 的 Dimension Description

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`
- Modify: `scripts/f2-artifact-loader.mjs`
- Modify: `scripts/f2-artifact-loader.test.mjs`
- Modify: `packages/workbook-catalog/src/f2-user-report.ts`
- Modify: `packages/workbook-catalog/src/f2-user-report.test.ts`

- [ ] **Step 1: 写入 loader 失败测试**

在 worksheet JSON fixture 顶层加入 `toleranceLoopDescription: "Anonymous device gap"`，并断言：

```js
expect(result.status).toBe("accepted");
expect(result.input.worksheets[0].toleranceLoopDescription)
  .toBe("Anonymous device gap");
```

- [ ] **Step 2: 运行 loader 测试并确认 RED**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f2-artifact-loader.test.mjs
```

Expected: FAIL，loader 输出没有该字段。

- [ ] **Step 3: 在 loader 中结构化透传**

解析 worksheet JSON 后，要求原值是非空字符串，并在 `worksheets.push` 中加入：

```js
toleranceLoopDescription: worksheetJson.toleranceLoopDescription,
```

缺失时返回 `inputRejected`，reason 使用现有 `invalid_contract`，不得解析 worksheet Markdown 补值。

- [ ] **Step 4: 写入 F2 report 失败测试**

```ts
expect(report.worksheets[0]?.toleranceLoopDescription)
  .toBe("Anonymous device gap");
```

- [ ] **Step 5: 运行 F2 report 测试并确认 RED**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f2-user-report.test.ts
```

Expected: FAIL，worksheet report 尚未保留 description。

- [ ] **Step 6: 保留 worksheet description**

在 `createF2UserReport` 返回 worksheet 对象中加入：

```ts
toleranceLoopDescription: worksheet.toleranceLoopDescription,
```

同时在 `f2AcceptedReportSchema` worksheet 对象加入 optional 字段，以保持旧报告可读：

```ts
toleranceLoopDescription: z.string().min(1).optional(),
```

- [ ] **Step 7: 跑 F2 传输链回归**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f2-artifact-loader.test.mjs packages/workbook-catalog/src/f2-user-report.test.ts scripts/f2-report.test.mjs scripts/f2-artifact-flow.test.mjs scripts/f2-excel-runner.test.mjs apps/cli/src/commands/feature2.test.ts
```

Expected: 所有指定测试 PASS，旧 artifact fixture 仍可由 schema 解析。

- [ ] **Step 8: 提交字段传输变更**

```powershell
git add packages/contracts/src/contracts.ts scripts/f2-artifact-loader.mjs scripts/f2-artifact-loader.test.mjs packages/workbook-catalog/src/f2-user-report.ts packages/workbook-catalog/src/f2-user-report.test.ts
git commit -m "feat(f2): preserve tolerance loop descriptions"
```

## Task 3: 实现确定性 F3 Governance Core

**Files:**
- Create: `packages/workbook-catalog/src/f3-drawing-governance.ts`
- Create: `packages/workbook-catalog/src/f3-drawing-governance.test.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: 写入锚点与 DIM ID 分类失败测试**

测试至少包含：空值、`1`、`12`、`307`、`1234`、`DIM307`，以及不同图纸共享 `307`。

```ts
it.each([
  [null, "missing"],
  ["1", "suspected_invalid"],
  ["12", "valid"],
  ["307", "valid"],
  ["1234", "valid"],
  ["DIM307", "needs_confirmation"],
] as const)("classifies %s as %s", (dimId, expected) => {
  const report = createF3DrawingGovernance(requestWithDimId(dimId));
  expect(report.worksheets[0]?.rows[0]?.dimIdStatus).toBe(expected);
});

it("allows the same DIM ID on different drawings", () => {
  const report = createF3DrawingGovernance(requestWithRows([
    row({ drawingNumber: "DRAW-A", dimId: "307" }),
    row({ drawingNumber: "DRAW-B", dimId: "307" }),
  ]));
  expect(report.summary.duplicateConflictCount).toBe(0);
});
```

- [ ] **Step 2: 运行 core 测试并确认 RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f3-drawing-governance.test.ts
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现规范化、hash 和分类 helpers**

```ts
import { createHash } from "node:crypto";
import {
  drawingGovernanceRequestV2Schema,
  drawingGovernanceResultV2Schema,
  type DrawingGovernanceRequestV2,
  type DrawingGovernanceResultV2,
} from "@ai-assist/contracts";

function stableHash(parts: readonly (string | number)[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function normalizedText(value: string | number | null): string | undefined {
  const text = value === null ? "" : String(value).trim();
  return text.length === 0 ? undefined : text;
}

function normalizeDrawingNumber(value: string): string {
  return value.trim().toUpperCase();
}

function classifyDimId(value: string | undefined) {
  if (value === undefined) return "missing" as const;
  if (/^\d$/.test(value)) return "suspected_invalid" as const;
  if (/^\d{2,4}$/.test(value)) return "valid" as const;
  return "needs_confirmation" as const;
}
```

- [ ] **Step 4: 实现组合键、重复检测和稳定排序**

先按所有非空 `(normalizedDrawingNumber, normalizedDimId)` 计数以生成 `duplicate_conflict`；只有 `dimIdStatus === "valid"` 且 Drawing Number 非空时生成正式 `drawingDimensionKey`。`factorInstanceId` 固定使用 workbook hash、worksheet、table 和 source row。

```ts
const factorInstanceId = stableHash([
  request.workbook.contentHash,
  row.worksheetName,
  row.tableId,
  row.sourceRow,
]);

const drawingDimensionKey = drawingNumber !== undefined && dimIdStatus === "valid"
  ? stableHash([normalizeDrawingNumber(drawingNumber), dimId])
  : undefined;
```

输出排序固定为 `partCategory -> normalized Drawing Number -> worksheetName -> tableId -> sourceRow`。

- [ ] **Step 5: 实现严格入口和冻结结果**

```ts
export function createF3DrawingGovernance(request: unknown): DrawingGovernanceResultV2 {
  const input = drawingGovernanceRequestV2Schema.parse(request);
  const result = composeGovernanceResult(input);
  return deepFreeze(drawingGovernanceResultV2Schema.parse(result));
}
```

纯 core 只接受 request schema 已验证的 `ready` worksheets。非 `ready`、description/partCategory 缺失或 artifact 绑定不一致由 Task 7 loader 返回 `input_rejected`；core 对绕过 loader 的无效直接调用抛出 `validation_error`。不得使用 F2 的 `（缺失）` category 分组字符串。

- [ ] **Step 6: 增加同图纸重复和稳定性测试**

```ts
it("flags duplicate DIM IDs only within the same drawing", () => {
  const report = createF3DrawingGovernance(requestWithRows([
    row({ drawingNumber: "DRAW-A", dimId: "307", sourceRow: 14 }),
    row({ drawingNumber: " draw-a ", dimId: "307", sourceRow: 15 }),
  ]));
  expect(report.summary.duplicateConflictCount).toBe(2);
  expect(report.worksheets[0]?.rows.every((item) =>
    item.qualitySignals.includes("duplicate_conflict"))).toBe(true);
});

it("is deterministic", () => {
  const request = requestWithRows([row({ sourceRow: 15 }), row({ sourceRow: 14 })]);
  expect(createF3DrawingGovernance(request)).toEqual(createF3DrawingGovernance(request));
});
```

- [ ] **Step 7: 运行 core 和 contracts 测试**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f3-drawing-governance.test.ts
```

Expected: PASS。

- [ ] **Step 8: 导出并提交 core**

在 `packages/workbook-catalog/src/index.ts` 增加：

```ts
export { createF3DrawingGovernance } from "./f3-drawing-governance.js";
```

```powershell
git add packages/workbook-catalog/src/f3-drawing-governance.ts packages/workbook-catalog/src/f3-drawing-governance.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat(f3): add deterministic drawing governance core"
```

## Task 4: 生成 F3 JSON/Markdown 治理清单

**Files:**
- Create: `scripts/f3-report.mjs`
- Create: `scripts/f3-report.test.mjs`

- [ ] **Step 1: 写入 renderer 失败测试**

```js
it("renders grouped drawing governance tables", () => {
  const markdown = renderF3Report(validGovernanceReport());
  expect(markdown).toContain("# Feature 3 DIM ID 与图纸治理报告");
  expect(markdown).toContain("## Display / DRAW-A");
  expect(markdown).toContain("| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Source Location |");
  expect(markdown).toContain("TP_Gap_X!E14");
});
```

- [ ] **Step 2: 运行并确认 RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-report.test.mjs
```

Expected: FAIL，renderer 不存在。

- [ ] **Step 3: 实现安全 Markdown renderer**

```js
function cell(value) {
  if (value === null || value === undefined || value === "") return "（缺失）";
  return String(value).replaceAll("|", "\\|").replaceAll(/\r?\n/g, "<br>");
}

function sourceLocation(row) {
  const cells = Object.values(row.source.sourceCells).filter(Boolean).sort();
  return cells.length > 0
    ? cells.join(", ")
    : `${row.source.worksheetName}!row ${row.source.sourceRow}`;
}

export function renderF3Report(report) {
  if (report.status === "input_rejected") return renderRejected(report);
  return renderAccepted(report, cell, sourceLocation);
}
```

报告必须包含执行摘要、质量状态计数、ADO 状态、按 Part Category/Drawing Number 分组的固定表头和技术追溯。不得输出本地绝对路径、token 或完整 MCP payload。

- [ ] **Step 4: 增加转义和隐私测试**

```js
expect(renderF3Report(reportWithText("A|B\nC"))).toContain("A\\|B<br>C");
expect(renderF3Report(validGovernanceReport())).not.toContain("C:\\Users\\");
expect(renderF3Report(validGovernanceReport())).not.toContain("Authorization");
```

- [ ] **Step 5: 运行 renderer 测试并提交**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-report.test.mjs
git add scripts/f3-report.mjs scripts/f3-report.test.mjs
git commit -m "feat(f3): render drawing governance reports"
```

Expected: PASS 后提交。

## Task 5: 实现 Surface MCP Comment 0 安全协议

**Files:**
- Create: `packages/adapters/src/surface-mcp-drawing-governance-adapter.ts`
- Create: `packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts`
- Modify: `packages/adapters/src/index.ts`

- [ ] **Step 1: 写入 capability 和负责人失败测试**

```ts
it("blocks prepare when required Surface MCP capabilities are missing", async () => {
  const adapter = createSurfaceMcpDrawingGovernanceAdapter(client({
    capabilities: ["workItems.read"],
  }));
  await expect(adapter.prepare(linkRequest())).resolves.toMatchObject({
    status: "blocked",
    reasonCode: "surface_mcp_capability_missing",
  });
});

it("falls back from Owner to Request By", async () => {
  const adapter = createSurfaceMcpDrawingGovernanceAdapter(client({
    owner: null,
    requestBy: "controlled-user-reference",
  }));
  await expect(adapter.prepare(linkRequest())).resolves.toMatchObject({
    ownerReference: "controlled-user-reference",
  });
});
```

- [ ] **Step 2: 运行 adapter 测试并确认 RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts
```

Expected: FAIL，adapter 不存在。

- [ ] **Step 3: 定义宿主注入 client 与 adapter**

```ts
export type SurfaceMcpCapability =
  | "workItems.create"
  | "workItems.read"
  | "workItems.comments.read"
  | "workItems.comments.update";

export interface SurfaceMcpDrawingGovernanceClient {
  listCapabilities(): Promise<readonly SurfaceMcpCapability[]>;
  createWorkItem(input: { readonly title: string }): Promise<{ readonly workItemReference: string }>;
  readWorkItem(reference: string): Promise<{
    readonly version: string;
    readonly ownerReference?: string;
    readonly requestByReference?: string;
  }>;
  readCommentZero(reference: string): Promise<{
    readonly commentReference: string;
    readonly version: string;
    readonly content: string;
  }>;
  updateCommentZero(input: {
    readonly workItemReference: string;
    readonly commentReference: string;
    readonly expectedVersion: string;
    readonly content: string;
  }): Promise<{ readonly version: string }>;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableHash(parts: readonly string[]): string {
  return sha256(JSON.stringify(parts));
}

function createLineDiff(before: string, after: string) {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const length = Math.max(beforeLines.length, afterLines.length);
  return Array.from({ length }, (_, index) => ({
    before: beforeLines[index] ?? null,
    after: afterLines[index] ?? null,
    changed: beforeLines[index] !== afterLines[index],
  }));
}
```

adapter 只调用注入 client；不得自行 HTTP fetch、读取 token 或引用 Azure DevOps MCP。

- [ ] **Step 4: 实现 prepare confirmation payload**

prepare 读取 Work Item 与 Comment 0，按 Owner -> Request By 解析负责人，生成 diff 和 hash：

```ts
const confirmationHash = stableHash([
  input.workItemReference,
  comment.commentReference,
  comment.version,
  nextContent,
]);

return {
  status: "confirmation_required" as const,
  workItemReference: input.workItemReference,
  ownerReference,
  commentReference: comment.commentReference,
  expectedVersion: comment.version,
  beforeContentHash: sha256(comment.content),
  nextContent,
  confirmationHash,
  diff: createLineDiff(comment.content, nextContent),
};
```

缺 owner、Comment 0 不存在或 capability 不足时返回 `blocked`；不得改写 Description 或创建普通评论。

- [ ] **Step 5: 写入并发和确认失败测试**

```ts
it("rejects execute when confirmation hash does not match", async () => {
  await expect(adapter.execute({ ...prepared, confirmationHash: "0".repeat(64) }))
    .rejects.toMatchObject({ code: "validation_error" });
});

it("rejects execute when Comment 0 changed after prepare", async () => {
  mockCommentVersion("v2");
  await expect(adapter.execute(prepared))
    .rejects.toMatchObject({ code: "dependency_error" });
  expect(clientInvocations()).not.toContain("updateCommentZero");
});
```

- [ ] **Step 6: 实现 execute fail-closed**

execute 重新读取 Comment 0，校验 comment reference、version、next content hash 和 confirmation hash，再调用一次 `updateCommentZero`。任何校验失败不得写入或自动重试。

- [ ] **Step 7: 运行 adapter 套件并提交**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts packages/adapters/src/adapters.test.ts
git add packages/adapters/src/surface-mcp-drawing-governance-adapter.ts packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts packages/adapters/src/index.ts
git commit -m "feat(f3): add Surface MCP governance adapter"
```

Expected: PASS 后提交。

## Task 6: 增加 Surface MCP 配置与能力检测

**Files:**
- Create: `packages/adapters/src/surface-mcp-config.ts`
- Create: `packages/adapters/src/surface-mcp-config.test.ts`
- Modify: `packages/adapters/src/index.ts`

- [ ] **Step 1: 写入仅 Surface MCP 的失败测试**

```ts
it("recognizes the configured Surface MCP server", () => {
  expect(inspectSurfaceMcpConfig({
    servers: {
      "surface-mcp": { type: "http", url: "https://surfacemcp.microsoft.com" },
    },
  })).toEqual({ configured: true, serverName: "surface-mcp" });
});

it("does not require Azure DevOps MCP", () => {
  const result = inspectSurfaceMcpConfig({ servers: {} });
  expect(result).toEqual({ configured: false, reasonCode: "surface_mcp_missing" });
});
```

- [ ] **Step 2: 运行并确认 RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/adapters/src/surface-mcp-config.test.ts
```

Expected: FAIL，检测器不存在。

- [ ] **Step 3: 实现纯配置检查和 capability report**

```ts
import { z } from "zod";

const mcpServerSchema = z.object({
  type: z.string().min(1),
  url: z.string().url().optional(),
  command: z.string().min(1).optional(),
}).passthrough();

const mcpConfigSchema = z.object({
  servers: z.record(z.string(), mcpServerSchema),
}).passthrough();

export function inspectSurfaceMcpConfig(config: unknown): SurfaceMcpConfigInspection {
  const parsed = mcpConfigSchema.safeParse(config);
  if (!parsed.success || parsed.data.servers["surface-mcp"] === undefined) {
    return { configured: false, reasonCode: "surface_mcp_missing" };
  }
  return { configured: true, serverName: "surface-mcp" };
}

export async function inspectSurfaceMcpCapabilities(
  client: Pick<SurfaceMcpDrawingGovernanceClient, "listCapabilities">,
): Promise<SurfaceMcpCapabilityReport> {
  const available = await client.listCapabilities();
  return buildCapabilityReport(available, REQUIRED_F3_CAPABILITIES);
}
```

该模块不自动修改用户全局配置，不读取或打印 secret；调用方可根据 `surface_mcp_missing` 展示固定配置说明。

- [ ] **Step 4: 覆盖缺失 capability 和未知字段**

测试报告分别列出 available/missing，且只接受四个 F3 capability；未知 capability 不得被误认为满足要求。

- [ ] **Step 5: 运行测试并提交**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/adapters/src/surface-mcp-config.test.ts packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts
git add packages/adapters/src/surface-mcp-config.ts packages/adapters/src/surface-mcp-config.test.ts packages/adapters/src/index.ts
git commit -m "feat(f3): inspect Surface MCP capabilities"
```

Expected: PASS 后提交。

## Task 7: 组装本地 F3 Artifact Workflow

**Files:**
- Create: `scripts/f3-artifact-loader.mjs`
- Create: `scripts/f3-artifact-loader.test.mjs`
- Create: `scripts/f3-output-layout.mjs`
- Create: `scripts/f3-output-layout.test.mjs`
- Create: `scripts/run-f3-full-validation.mjs`
- Create: `scripts/f3-full-flow.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写入 F2 artifact loader 失败测试**

```js
it("loads only a structured Feature 2 JSON report", () => {
  const loaded = loadF2ArtifactBundle(f2OutputRoot());
  expect(loaded.status).toBe("accepted");
  expect(loaded.request.worksheets[0].toleranceLoopDescription)
    .toBe("Anonymous device gap");
});

it("does not recover descriptions from Markdown", () => {
  removeDescriptionFromJson();
  writeMarkdown("Anonymous device gap");
  expect(loadF2ArtifactBundle(f2OutputRoot())).toMatchObject({
    status: "inputRejected",
  });
});
```

- [ ] **Step 2: 运行并确认 RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-artifact-loader.test.mjs
```

Expected: FAIL，loader 不存在。

- [ ] **Step 3: 实现 F3 loader**

只读取 `Feature2-Report.json`，要求 status 为 `completed` 或只选择 `ready` worksheets，映射为 `drawingGovernanceRequestV2Schema`。`blocked` worksheet 不进入 F3；若没有 ready worksheet，返回 `inputRejected`。

- [ ] **Step 4: 写入 output layout 失败测试**

```js
expect(resolveFeature3OutputLayout(["runs/demo/f2"]))
  .toEqual({
    outRoot: "test/demo-output/feature3-output/f2",
    reportJsonName: "Feature3-Report.json",
    reportMdName: "Feature3-Report.md",
  });
```

- [ ] **Step 5: 实现安全输出布局**

沿用 `safeName` 和 F2 override 防 traversal 规则，环境变量固定为 `AI_TVA_F3_OUTPUT_ROOT`。

- [ ] **Step 6: 写入完整本地流程失败测试**

```js
it("writes matching Feature 3 JSON and Markdown reports", () => {
  const result = runFeature3Fixture();
  expect(result.status).toBe("governance_required");
  expect(readJson(result.reportJsonPath).modelVersion).toBe("drawing-governance-v2");
  expect(readText(result.reportMdPath)).toContain("Dimension Description");
});
```

- [ ] **Step 7: 实现 runner**

`run-f3-full-validation.mjs` 顺序固定为：load F2 JSON -> create F3 core report -> render Markdown -> 原子写入 `Feature3-Report.json` 与 `.md`。本地 runner 默认 `ado.status = "not_requested"`，不尝试调用 Surface MCP。

在 `package.json` 增加：

```json
"workflow:f3": "node scripts/run-f3-full-validation.mjs"
```

- [ ] **Step 8: 运行 workflow 测试并提交**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-artifact-loader.test.mjs scripts/f3-output-layout.test.mjs scripts/f3-report.test.mjs scripts/f3-full-flow.test.mjs
git add scripts/f3-artifact-loader.mjs scripts/f3-artifact-loader.test.mjs scripts/f3-output-layout.mjs scripts/f3-output-layout.test.mjs scripts/run-f3-full-validation.mjs scripts/f3-full-flow.test.mjs package.json
git commit -m "feat(f3): add local artifact workflow"
```

Expected: PASS 后提交。

## Task 8: 接入 Feature 3 CLI

**Files:**
- Create: `apps/cli/src/commands/feature3.ts`
- Create: `apps/cli/src/commands/feature3.test.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`

- [ ] **Step 1: 写入 command 失败测试**

```ts
it("runs Feature 3 from one Feature 2 artifact directory", async () => {
  const result = await runFeature3WorkflowCommand(rootDir, f2Root);
  expect(result).toContain("Feature 3 workflow completed.");
  expect(result).toContain("f3:");
});

it("rejects an xlsx input", async () => {
  await expect(runFeature3WorkflowCommand(rootDir, "Demo.xlsx"))
    .rejects.toMatchObject({ code: "validation_error" });
});
```

- [ ] **Step 2: 运行并确认 RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts apps/cli/src/commands/feature3.test.ts
```

Expected: FAIL，command 不存在。

- [ ] **Step 3: 实现 CLI 包装**

沿 Feature 2 模式执行 `scripts/run-f3-full-validation.mjs`，但输入必须是已有目录且包含 `Feature2-Report.json`：

```ts
export async function runFeature3WorkflowCommand(
  rootDir: string,
  f2ArtifactRoot: string,
): Promise<string> {
  validateFeature2ArtifactRoot(f2ArtifactRoot);
  const { stdout } = await execFileAsync(process.execPath, [scriptPath, f2ArtifactRoot], {
    cwd: rootDir,
    maxBuffer: 4 * 1024 * 1024,
  });
  return formatFeature3Output(JSON.parse(stdout));
}

function validateFeature2ArtifactRoot(value: string): void {
  if (!existsSync(value) || !statSync(value).isDirectory()) {
    throw feature3Error("validation_error", "Feature 3 requires one existing Feature 2 artifact directory.");
  }
  if (!existsSync(join(value, "Feature2-Report.json"))) {
    throw feature3Error("validation_error", "Feature 2 report JSON is missing.");
  }
}

function formatFeature3Output(value: unknown): string {
  const parsed = feature3RunnerOutputSchema.parse(value);
  return [
    "Feature 3 workflow completed.",
    `f3: ${parsed.outputDirectory}`,
    `status: ${parsed.status}`,
  ].join("\n");
}
```

增加短语 `帮我用F3治理DIM ID` 和 `use F3 to govern DIM IDs`，并注册：

```text
feature3 --root <repo> --f2-artifacts <directory>
```

- [ ] **Step 4: 更新 parser 和 dependency injection 测试**

`Command` union、`CliDependencies`、`parseCommand` 和 `executeCli` 都增加 feature3；测试使用假 runner，不访问真实 filesystem/MCP。

- [ ] **Step 5: 运行 CLI 回归并提交**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts apps/cli/src/commands/feature3.test.ts apps/cli/src/index.test.ts apps/cli/src/commands/feature2.test.ts
git add apps/cli/src/commands/feature3.ts apps/cli/src/commands/feature3.test.ts apps/cli/src/index.ts apps/cli/src/index.test.ts
git commit -m "feat(cli): expose Feature 3 workflow"
```

Expected: PASS 后提交。

## Task 9: 同步 01/02/04/05 中英文文档

**Files:**
- Modify: `docs/01-architecture.md`
- Modify: `docs/01-架构映射.md`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/04-feature-breakdown.md`
- Modify: `docs/04-功能拆分.md`
- Modify: `docs/05-design-decisions.md`
- Modify: `docs/05-设计决策.md`

- [ ] **Step 1: 写出文档差异检查命令并确认当前 FAIL**

Run:

```powershell
rg -n "GetProgramMilestones|scheduled reminder|定时提醒|server-side background|后台服务" docs/01-architecture.md docs/01-架构映射.md docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/04-feature-breakdown.md docs/04-功能拆分.md docs/05-design-decisions.md docs/05-设计决策.md
```

Expected: 找到旧里程碑/scheduler 定义。

- [ ] **Step 2: 同步架构和流程**

所有中英文文档必须统一为：

```text
F3 does not read milestone dates or schedule reminders.
F3 generates the current governance list; after explicit user confirmation,
the Surface MCP adapter updates ADO Comment 0. Without ADO or required
capabilities, the same confidential list is saved locally and TA continues.
```

中文对应表述必须明确：不读取里程碑、不做临近判断、不运行 scheduler。

- [ ] **Step 3: 同步业务规则**

04/05 中英文必须同时包含：

- 当前 Part Number 等同 Drawing Number。
- 正式键是 `(Drawing Number, DIM ID)`。
- 跨图纸相同 DIM ID 合法；同图纸重复产生冲突。
- 一位纯数字为 `suspected_invalid`，不阻塞 TA。
- 仅依赖 Surface MCP，不要求 Azure DevOps MCP。

- [ ] **Step 4: 运行文档一致性检查**

```powershell
$files = @('docs/01-architecture.md','docs/01-架构映射.md','docs/02-end-to-end-flow.md','docs/02-端到端流程.md','docs/04-feature-breakdown.md','docs/04-功能拆分.md','docs/05-design-decisions.md','docs/05-设计决策.md'); $legacy = rg -n "GetProgramMilestones|scheduled reminder|定时提醒|server-side background|后台服务" $files; if ($LASTEXITCODE -eq 0) { $legacy; exit 1 }; git diff --check -- $files
```

Expected: exit 0，无旧 scheduler 文案和空白错误。

- [ ] **Step 5: 提交文档同步**

```powershell
git add docs/01-architecture.md docs/01-架构映射.md docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/04-feature-breakdown.md docs/04-功能拆分.md docs/05-design-decisions.md docs/05-设计决策.md
git commit -m "docs(f3): align drawing governance flow"
```

## Task 10: 完整验收并启用 F3 v2

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `docs/governance/feature-register.md`
- Modify: `README.md`

- [ ] **Step 1: 写入 available register 失败测试**

```ts
it("registers the accepted F3 v2 governance capability", () => {
  expect(getFeatureStatus("F3")).toMatchObject({
    status: "available",
    dependsOn: ["f2-user-report-v1", "drawing-governance-v2", "surface-mcp-adapter-v1"],
    inputContractId: "drawing-governance-request-v2",
    outputContractId: "drawing-governance-result-v2",
    maximumClassification: "confidential",
    externalPrerequisites: ["approved-surface-mcp-access", "approved-comment-zero-write-policy"],
  });
});
```

- [ ] **Step 2: 运行 register 测试并确认 RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts
```

Expected: FAIL，F3 仍为 unavailable v1 placeholder。

- [ ] **Step 3: 先运行完整 F3/F2 验收门**

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f3-drawing-governance.test.ts packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts packages/adapters/src/surface-mcp-config.test.ts scripts/f2-artifact-loader.test.mjs packages/workbook-catalog/src/f2-user-report.test.ts scripts/f3-artifact-loader.test.mjs scripts/f3-output-layout.test.mjs scripts/f3-report.test.mjs scripts/f3-full-flow.test.mjs apps/cli/src/commands/feature3.test.ts apps/cli/src/index.test.ts
```

Expected: 全部 PASS。任何失败都必须在启用 register 前修复并重跑同一命令。

- [ ] **Step 4: 将 F3 注册升级为 available v2**

用直接 registration object 替换 `unavailableFeature(...)`：

```ts
[
  "F3",
  {
    featureId: "F3",
    title: "DIM ID 与图纸治理",
    status: "available",
    dependsOn: ["f2-user-report-v1", "drawing-governance-v2", "surface-mcp-adapter-v1"],
    inputContractId: "drawing-governance-request-v2",
    outputContractId: "drawing-governance-result-v2",
    maximumClassification: "confidential",
    acceptanceChecks: [
      "anonymous-drawing-governance-fixture",
      "drawing-governance-anchor-check",
      "drawing-governance-privacy-check",
      "surface-mcp-comment-zero-confirmation-check",
    ],
    externalPrerequisites: [
      "approved-surface-mcp-access",
      "approved-comment-zero-write-policy",
    ],
    disableBehavior: "return feature_not_available",
  },
],
```

更新治理文档和 README，明确 `available` 覆盖本地治理核心和受控 Surface MCP adapter；真实写入仍需 capability、策略审批和逐次用户确认。

- [ ] **Step 5: 跑全仓验证**

```powershell
npm run build -- --force
npm test
npm run check:repository
```

Expected: build、Vitest workspace 和 repository check 全部 exit 0。若 `npm test` 暴露与 F3 无关的既有失败，记录精确文件和错误，并继续运行上一步的 F3/F2 聚焦验收确认本变更状态。

- [ ] **Step 6: 检查真实数据和 secret 未进入 Git**

```powershell
$changed = git diff --name-only HEAD; $forbidden = $changed | Where-Object { $_ -match '\.(xlsx|xlsm|xls)$|(^|/)(\.env|test/demo-output/f2-runs)/' }; if ($forbidden) { $forbidden; exit 1 }; git diff --check
```

Expected: exit 0，不包含 workbook、真实运行输出或 secret 文件。

- [ ] **Step 7: 提交治理启用**

```powershell
git add packages/governance/src/feature-register.ts packages/governance/src/policy-gate.test.ts docs/governance/feature-register.md README.md
git commit -m "feat(governance): enable Feature 3 v2"
```

- [ ] **Step 8: 提交后最终验证**

```powershell
git status --short --branch
git log -10 --oneline --decorate
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts packages/workbook-catalog/src/f3-drawing-governance.test.ts packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts packages/adapters/src/surface-mcp-config.test.ts scripts/f3-artifact-loader.test.mjs scripts/f3-report.test.mjs scripts/f3-full-flow.test.mjs apps/cli/src/commands/feature3.test.ts packages/governance/src/policy-gate.test.ts
```

Expected: 工作区无未提交变更；最近提交与任务提交顺序一致；聚焦验收全部 PASS。

## 实施约束

- 每个 Task 独立执行 RED -> GREEN -> commit，不跨任务批量实现。
- 所有脚本测试前先 build，避免读取过期 `dist`。
- 真实 ADO 内容、Drawing Number、DIM ID、人员和 workbook 永不进入 fixture、日志或 Git。
- Surface MCP 写入测试默认 mock；Feature `1102392` 的真实检查默认只读。
- 任何真实 Comment 0 写入必须在执行时单独展示 diff 并取得用户确认，本计划中的测试命令不得自动写入。
- 不增加 Azure DevOps MCP、milestone API、提醒窗口或后台 scheduler。
