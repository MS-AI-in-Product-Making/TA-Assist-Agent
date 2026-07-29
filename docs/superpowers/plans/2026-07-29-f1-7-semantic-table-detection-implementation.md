# F1.7 语义化因子表识别与人工确认 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不同版本 TA Excel 布局下，用“规则 + 评分”识别因子表，并在不确定时阻断下游、输出人工确认负载。

**Architecture:** 在 `@ai-assist/contracts` 新增 F1.7 request/result 契约；在 `@ai-assist/workbook-catalog` 新增纯服务 `createSemanticTableDetection`，复用现有 OOXML 读取和字段解析逻辑，输出候选表、置信度、状态机与 reason codes；CLI demo 脚本串联 1.6 产物与 1.7 检测结果，验证“未确认不继续”。

**Tech Stack:** TypeScript strict ESM, Zod v3, Vitest v3, 现有 workbook-catalog OOXML parser, Node scripts.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/contracts/src/contracts.ts` | 定义 F1.7 检测请求/结果 schema 与类型（状态、评分、确认负载、reason codes）。 |
| `packages/contracts/src/contracts.test.ts` | 覆盖 F1.7 契约严格性、状态一致性、计数一致性测试。 |
| `packages/workbook-catalog/src/semantic-table-detection.ts` | 实现候选发现、字段映射、评分、闸门决策、确认负载生成。 |
| `packages/workbook-catalog/src/semantic-table-detection.test.ts` | 用匿名 workbook fixture 测试 auto/pending/blocked 场景与 fail-fast 行为。 |
| `packages/workbook-catalog/src/index.ts` | 导出 F1.7 service 和类型。 |
| `scripts/run-f1-task1-7-demo.mjs` | 基于真实示例跑 1.7 检测，产出 JSON/MD 诊断与确认清单。 |
| `package.json` | 增加 `demo:f1-task1-7` 脚本。 |
| `packages/governance/src/feature-register.ts` | 注册 `F1.7` 可用能力，标注依赖与验收检查。 |
| `packages/governance/src/policy-gate.test.ts` | 锁定 F1.7 注册项。 |
| `README.md`, `docs/README.md`, `docs/governance/feature-register.md` | 文档化 F1.7 边界、状态机、与 1.6 衔接。 |

### Task 1: 定义 F1.7 合同与状态机

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 F1.7 契约行为**

在 `contracts.test.ts` 新增用例，覆盖：
1. `semanticTableDetectionRequestSchema` 接受 confidential workbook + catalog + 可选 manual confirmation。
2. `semanticTableDetectionResultSchema` 接受 `auto_confirmed` / `pending_confirmation` / `manual_confirmed` / `blocked`。
3. `pending_confirmation` 与 `blocked` 必须包含 `confirmationPayload`。
4. `auto_confirmed` 必须 `requiresUserConfirmation=false`。
5. summary 计数必须与数组长度一致。

```ts
it("accepts F1.7 pending_confirmation payload with strict counts", () => {
  const parsed = semanticTableDetectionResultSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { contentHash, catalogContractVersion: "v1" },
    worksheets: [{
      worksheetName: "Analysis-A",
      recognitionStatus: "pending_confirmation",
      confidenceScore: 71,
      confidenceBreakdown: { headerScore: 36, typeScore: 20, completenessScore: 15, penalty: 0 },
      uncertaintyReasons: ["ambiguous_mapping"],
      requiresUserConfirmation: true,
      confirmationPayload: {
        candidateId: "cand-a",
        headerRow: 12,
        dataRange: { startRow: 13, endRow: 26 },
        recommendedAction: "confirm_as_is",
      },
    }],
    summary: {
      worksheetCount: 1,
      autoConfirmedCount: 0,
      manualConfirmedCount: 0,
      pendingConfirmationCount: 1,
      blockedCount: 0,
    },
  });

  expect(parsed.summary.pendingConfirmationCount).toBe(1);
});
```

- [ ] **Step 2: 运行聚焦测试，确认当前失败**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: FAIL，提示 `semanticTableDetection*` schema/type 尚不存在。

- [ ] **Step 3: 在 contracts 中补齐 F1.7 schema 与类型**

在 `contracts.ts` 增加：
1. `semanticTableDetectionRequestSchema`
2. `semanticTableDetectionResultSchema`
3. `recognitionStatus`、`reasonCode`、`recommendedAction`、`confidenceBreakdown` 子 schema
4. `SemanticTableDetectionRequest` / `SemanticTableDetectionResult` type export

最小结构：

```ts
export const semanticTableDetectionRequestSchema = z.object({
  contractVersion: contractVersionSchema,
  inputClassification: z.literal("confidential"),
  workbookBytes: nonEmptyWorkbookBytesSchema,
  workbookCatalog: workbookCatalogResultSchema,
  worksheetSelection: worksheetAnalysisAssetsRequestSchema.shape.worksheetSelection.optional(),
  manualConfirmations: z.array(z.object({
    worksheetName: z.string().min(1),
    candidateId: z.string().min(1),
    action: z.enum(["confirm_as_is", "remap_fields", "select_another_candidate", "skip_sheet"]),
  }).strict()).optional(),
}).strict();
```

```ts
export type SemanticTableDetectionRequest = z.infer<typeof semanticTableDetectionRequestSchema>;
export type SemanticTableDetectionResult = z.infer<typeof semanticTableDetectionResultSchema>;
```

- [ ] **Step 4: 重新运行 contracts 测试并通过**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/contracts/src/contracts.test.ts
```

Expected: PASS。

### Task 2: 实现 F1.7 检测核心服务（候选发现 + 评分 + 闸门）

**Files:**
- Create: `packages/workbook-catalog/src/semantic-table-detection.ts`
- Modify: `packages/workbook-catalog/src/index.ts`

- [ ] **Step 1: 先写失败测试入口（函数存在性 + 基本结构）**

在后续测试文件会直接调用：

```ts
import { createSemanticTableDetection } from "./semantic-table-detection.js";
```

先确保导出函数签名：

```ts
export function createSemanticTableDetection(request: unknown): SemanticTableDetectionResult;
```

- [ ] **Step 2: 实现最小可运行骨架（先不做复杂评分）**

骨架包括：
1. confidential gate + typed errors（复用 `createTypedError` 风格）。
2. 校验 workbook hash 与 catalog hash 一致。
3. 按 `selectedAnalyses` 逻辑确定 worksheet 范围。
4. 读取 worksheet cells，返回空候选时 `blocked`。

示意：

```ts
const REQUEST_SUMMARY = "Semantic table detection request is invalid.";
const POLICY_SUMMARY = "Semantic table detection input is not permitted.";
const ARCHIVE_SUMMARY = "Semantic table detection archive cannot be processed.";

export function createSemanticTableDetection(request: unknown): SemanticTableDetectionResult {
  // 1) policy gate
  // 2) schema parse
  // 3) hash verify
  // 4) scan worksheets
  // 5) build result + deepFreeze
}
```

- [ ] **Step 3: 实现候选发现与字段映射**

在 `semantic-table-detection.ts` 添加：
1. `HEADER_ALIASES`（与 F1.1 一致）
2. `discoverCandidates(worksheet)`：按行扫描表头命中。
3. `mapFields(candidate)`：生成字段映射，标注 `missing/duplicate/ambiguous`。

示意：

```ts
function discoverCandidates(worksheet: OoxmlWorksheet): Candidate[] {
  // 逐行扫描，命中 >= 3 个核心别名时产出候选
}

function mapFields(candidate: Candidate): FieldMappingResult {
  // 每个 semantic field 仅允许唯一列映射，否则 reasonCode
}
```

- [ ] **Step 4: 实现评分模型与状态闸门**

实现以下函数：

```ts
function scoreCandidate(mapped: FieldMappingResult): {
  score: number;
  breakdown: { headerScore: number; typeScore: number; completenessScore: number; penalty: number };
  reasons: readonly string[];
}

function decideRecognitionStatus(score: number, reasons: readonly string[]): "auto_confirmed" | "pending_confirmation" | "blocked" {
  if (reasons.includes("missing_required_field") || reasons.includes("duplicate_mapping")) return "blocked";
  if (score >= 80) return "auto_confirmed";
  if (score >= 60) return "pending_confirmation";
  return "blocked";
}
```

- [ ] **Step 5: 接入 manual confirmation 流转**

对 `manualConfirmations` 做状态覆盖：
1. pending + confirm_as_is => manual_confirmed
2. pending + skip_sheet => blocked
3. manual 指向不存在 candidate => 保持 pending 并追加 `invalid_manual_confirmation`

- [ ] **Step 6: 导出并构造不可变返回 DTO**

在 `index.ts` 添加：

```ts
export { createSemanticTableDetection } from "./semantic-table-detection.js";
export type { SemanticTableDetectionRequest, SemanticTableDetectionResult } from "@ai-assist/contracts";
```

- [ ] **Step 7: 运行编译确保新模块可被引用**

Run:

```powershell
npm run build -- --force
```

Expected: PASS。

### Task 3: 用匿名 fixture 锁定行为测试

**Files:**
- Create: `packages/workbook-catalog/src/semantic-table-detection.test.ts`

- [ ] **Step 1: 写 auto_confirmed 场景失败测试**

构造标准表头 + 合规数值列，期望自动通过：

```ts
expect(result.worksheets[0]).toMatchObject({
  worksheetName: "Analysis-A",
  recognitionStatus: "auto_confirmed",
  requiresUserConfirmation: false,
});
```

- [ ] **Step 2: 写 pending_confirmation 场景失败测试**

构造边界场景（如一列可疑格式、置信度 60~79），期望 pending 且有 payload：

```ts
expect(result.worksheets[0]).toMatchObject({
  recognitionStatus: "pending_confirmation",
  requiresUserConfirmation: true,
  confirmationPayload: expect.objectContaining({ recommendedAction: "confirm_as_is" }),
});
```

- [ ] **Step 3: 写 blocked fail-fast 场景失败测试**

构造关键字段缺失/重复映射：

```ts
expect(result.worksheets[0]).toMatchObject({
  recognitionStatus: "blocked",
  uncertaintyReasons: expect.arrayContaining(["missing_required_field"]),
});
```

- [ ] **Step 4: 写 manual confirmation 状态流转测试**

```ts
expect(withManual.worksheets[0]?.recognitionStatus).toBe("manual_confirmed");
expect(withManual.summary.manualConfirmedCount).toBe(1);
```

- [ ] **Step 5: 运行聚焦测试并通过**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/semantic-table-detection.test.ts
```

Expected: PASS。

### Task 4: 连接 1.6 -> 1.7 演示入口

**Files:**
- Create: `scripts/run-f1-task1-7-demo.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写 demo 脚本失败测试（文件存在性与基本输出）**

在 `apps/cli/src/phase-0.acceptance.test.ts` 或新建 demo test 中添加最小断言：运行脚本后生成 `task1.7` 目录和 summary JSON。

```ts
expect(summary.summary.pendingConfirmationCount + summary.summary.blockedCount).toBeGreaterThanOrEqual(0);
```

- [ ] **Step 2: 实现 demo 脚本**

脚本行为：
1. 读取与 1.6 相同的示例 workbook 列表。
2. 调 `createWorkbookCatalog` + `createSemanticTableDetection`。
3. 输出：
   - `test/demo-output/task1.7/json/*.task1.7.semantic.full.json`
   - `test/demo-output/task1.7/md/*.task1.7.semantic.summary.md`

脚本核心调用示意：

```js
const detection = createSemanticTableDetection({
  contractVersion: "v1",
  inputClassification: "confidential",
  workbookBytes,
  workbookCatalog,
  worksheetSelection: { mode: "all" },
});
```

- [ ] **Step 3: 在 package.json 增加脚本命令**

```json
{
  "scripts": {
    "demo:f1-task1-7": "node scripts/run-f1-task1-7-demo.mjs"
  }
}
```

- [ ] **Step 4: 运行 demo 并验证产物**

Run:

```powershell
npm run demo:f1-task1-7
```

Expected:
1. 命令成功退出。
2. `test/demo-output/task1.7` 下生成 json 和 md。
3. 至少一份输出包含 `pending_confirmation` 或 `blocked`（用于验证提醒机制）。

### Task 5: 治理注册与文档

**Files:**
- Modify: `packages/governance/src/feature-register.ts`
- Modify: `packages/governance/src/policy-gate.test.ts`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/governance/feature-register.md`

- [ ] **Step 1: 写 F1.7 注册测试（先失败）**

在 `policy-gate.test.ts` 增加：

```ts
expect(getFeatureStatus("F1.7")).toEqual({
  featureId: "F1.7",
  title: "TA 因子表语义识别与人工确认",
  status: "available",
  dependsOn: ["workbook-catalog-v1", "semantic-table-detection-v1"],
  inputContractId: "semantic-table-detection-request-v1",
  outputContractId: "semantic-table-detection-result-v1",
  maximumClassification: "confidential",
  acceptanceChecks: [
    "anonymous-semantic-table-detection-fixture",
    "semantic-detection-failfast-check",
    "semantic-detection-privacy-check"
  ],
  externalPrerequisites: ["approved-ooxml-parser"],
  disableBehavior: "return feature_not_available",
});
```

- [ ] **Step 2: 更新 feature register**

在 `feature-register.ts` 注册 `F1.7` 条目，字段与测试完全一致。

- [ ] **Step 3: 更新文档边界说明**

文档中补充：
1. F1.7 仅做识别与确认闸门。
2. 未确认 sheet 不进入下游。
3. 不包含 F2/F4 计算或风险解读。

- [ ] **Step 4: 运行治理与文档相关测试**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts packages/governance/src/policy-gate.test.ts
```

Expected: PASS。

### Task 6: 全量回归与交付核验

**Files:**
- Verify: Task 1-5 touched files

- [ ] **Step 1: 运行受影响测试切片**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts \
  packages/contracts/src/contracts.test.ts \
  packages/workbook-catalog/src/worksheet-analysis-assets.test.ts \
  packages/workbook-catalog/src/semantic-table-detection.test.ts \
  packages/governance/src/policy-gate.test.ts
```

Expected: PASS。

- [ ] **Step 2: 跑 1.6 + 1.7 联合演示**

Run:

```powershell
npm run demo:f1-task1-6
npm run demo:f1-task1-7
```

Expected:
1. 1.6 产物仍可生成。
2. 1.7 明确输出 auto/pending/blocked/manual 状态。
3. 未确认项被阻断，不会下沉到后续步骤。

- [ ] **Step 3: 频繁小提交（建议）**

```powershell
git add packages/contracts/src/contracts.ts packages/contracts/src/contracts.test.ts
git commit -m "feat(f1.7): add semantic-table-detection contracts"

git add packages/workbook-catalog/src/semantic-table-detection.ts packages/workbook-catalog/src/semantic-table-detection.test.ts packages/workbook-catalog/src/index.ts
git commit -m "feat(f1.7): implement semantic detection scoring and confirmation gate"

git add scripts/run-f1-task1-7-demo.mjs package.json packages/governance/src/feature-register.ts packages/governance/src/policy-gate.test.ts README.md docs/README.md docs/governance/feature-register.md
git commit -m "feat(f1.7): add demo, governance registration, and docs"
```

## 自检结果

1. 覆盖性：已覆盖 spec 中的候选发现、字段映射、评分阈值、状态机、人工确认、阻断策略、1.6 衔接、验收标准。
2. 无占位符：计划中未使用 TBD/TODO/“后续补充”。
3. 命名一致：`createSemanticTableDetection`、`semanticTableDetection*Schema`、`recognitionStatus` 在任务中保持一致。
