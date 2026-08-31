# F8 TA 工程工作台用户界面实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 F0-F7 流程监控页面改造成面向普通 TA 工程用户的表格工作台，支持自动进入 Ready worksheet、Scenario 表格编辑、即时 governed What-if、工程图表和上下文问答。

**Architecture:** 保留现有 loopback Server、SessionStore、状态机、artifact lineage 和 workflow runners，只替换用户界面的导航模型。新增纯函数 workspace projection 将 F2/F4/F5/F6 artifacts 转换为 Worksheet 与 Factor view model；React 页面消费该模型，所有计算继续调用现有 What-if API。E1 自动进入由 Server 根据严格的 F1/F2 结果执行结构化命令，不由浏览器猜测或绕过治理。

**Tech Stack:** TypeScript 5 / Node.js 24 / React 19 / Vite 7 / Fastify 5 / Zod 3 / Vitest / Testing Library / Playwright / 原生 SVG

**Spec:** `docs/superpowers/specs/2026-08-26-f8-ta-engineering-workspace-ui-design.md`

## Global Constraints

- 源 workbook 永远只读；不覆盖、不回写，也不在首版导出修改后的 workbook。
- 浏览器不得复制 F4 公式；所有 Cp/Cpk、RSS、WC 和 Margin 重算必须调用现有 governed What-if API。
- 普通用户路径不得展示 `F0` 至 `F7`、`running`、`pending` 或内部 state 名称。
- 同一 session 同时最多一个 active Scenario Draft；Factor identity 使用 `worksheetName + tableId + sourceRow`。
- 自动计算使用单元格失焦后 300 ms 防抖；旧请求结果不得覆盖新编辑，失败保留编辑值与上一版有效结果。
- F7 保持不可用，不生成模拟 measured 结果，也不占用普通用户界面的固定区域。
- Server 仅监听 loopback，继续执行 cookie、CSRF、Host/Origin/CSP、opaque artifact ID、路径 containment 与内容 hash 校验。
- 不引入浏览器端 Excel parser、图表运行时或 3D 库；首版图表使用 React + 原生 SVG/HTML。
- 桌面主工程区与问答区约 70% / 30%；窄屏问答区改为底部抽屉。

---

### Task 1: 建立可靠的 Web Build Gate

**Files:**
- Modify: `apps/workbench-web/src/use-session.ts`
- Modify: `apps/workbench-web/src/api.ts`
- Modify: `apps/workbench-web/src/components/F2WorksheetStatus.tsx`
- Modify: `apps/workbench-web/src/components/WhatIfEditor.tsx`
- Modify: `apps/workbench-web/src/components/WorksheetReview.tsx`
- Modify: `apps/workbench-web/src/components/WorksheetReview.test.tsx`
- Modify: `apps/workbench-web/src/use-session.test.tsx`
- Test: `apps/workbench-web/src/api.test.ts`

**Interfaces:**
- Consumes: `WorkbenchApi`, `F8SessionSnapshot`, `ConversationTurn` from their owning packages.
- Produces: `npm exec tsc -- -p apps/workbench-web/tsconfig.json --noEmit` with zero diagnostics; unchanged runtime behavior.

- [ ] **Step 1: Capture the current compiler failures**

Run:

```powershell
npm exec tsc -- -p apps/workbench-web/tsconfig.json --noEmit
```

Expected: FAIL on the known exact-optional, `ConversationTurn`, `useRef`, artifact mock tuple, and inferred callback diagnostics.

- [ ] **Step 2: Fix package ownership and exact optional types**

Implement these concrete changes:

```ts
import type { ConversationTurn } from "@ai-assist/conversation";

const lastEventIdRef = useRef<string | undefined>(undefined);

return {
  api,
  ...(sessionId === undefined ? {} : { sessionId }),
  ...(snapshot === undefined ? {} : { snapshot }),
  ...(pendingWorkbookHash === undefined ? {} : { pendingWorkbookHash }),
  ...(error === undefined ? {} : { error }),
  // retain required properties unchanged
};
```

For optional component props, conditionally spread only defined values. Type worksheet and row callbacks from `F2UserReport`. Update API mocks so `loadArtifactJson(sessionId, artifactId, kind)` has all three parameters.

- [ ] **Step 3: Run focused tests and typecheck**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src/api.test.ts apps/workbench-web/src/use-session.test.tsx apps/workbench-web/src/components/WorksheetReview.test.tsx apps/workbench-web/src/components/WhatIfEditor.test.tsx
npm exec tsc -- -p apps/workbench-web/tsconfig.json --noEmit
```

Expected: all selected tests PASS and zero TypeScript diagnostics.

- [ ] **Step 4: Commit**

```powershell
git add apps/workbench-web/src

git commit -m "fix(f8): restore workbench web type safety"
```

---

### Task 2: 定义用户工作台 View Model

**Files:**
- Create: `apps/workbench-web/src/workspace-model.ts`
- Create: `apps/workbench-web/src/workspace-model.test.ts`
- Modify: `apps/workbench-web/src/app.tsx`

**Interfaces:**
- Consumes: `F2UserReport`, `F4WorkflowCalculationResult`, `F5DataInterpretationResult`, `F6OptimizationResultV2`, `F8SessionSnapshot`.
- Produces:

```ts
export type WorksheetBusinessStatus = "ready" | "risk" | "blocked" | "modified";

export interface FactorRowModel {
  readonly key: string;
  readonly worksheetName: string;
  readonly tableId: string;
  readonly sourceRow: number;
  readonly factorName: string;
  readonly dimId?: string;
  readonly unit: string;
  readonly nominalValue: number;
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
  readonly additionalMeanShift: number;
  readonly directionLabel: string;
  readonly directionAvailable: boolean;
  readonly contribution?: number;
  readonly cp?: number;
  readonly cpk?: number;
  readonly status: "pass" | "risk" | "blocked" | "modified";
}

export interface WorksheetWorkspaceModel {
  readonly worksheetName: string;
  readonly status: WorksheetBusinessStatus;
  readonly factors: readonly FactorRowModel[];
  readonly metrics?: WhatIfMetrics;
  readonly issues: readonly string[];
}

export interface EngineeringWorkspaceModel {
  readonly workbookName?: string;
  readonly worksheets: readonly WorksheetWorkspaceModel[];
  readonly selectedWorksheetName?: string;
  readonly preparationMessage?: string;
}

export function projectEngineeringWorkspace(input: {
  readonly snapshot?: F8SessionSnapshot;
  readonly f2Report?: F2UserReport;
  readonly f4Report?: F4WorkflowCalculationResult;
  readonly f5Report?: F5DataInterpretationResult;
  readonly f6Report?: F6OptimizationResultV2;
  readonly selectedWorksheetName?: string;
}): EngineeringWorkspaceModel;
```

- [ ] **Step 1: Write projection tests**

Cover these exact cases:

```ts
it("projects one stable factor row per F4 factor", () => {
  const model = projectEngineeringWorkspace(fixtureInput());
  expect(model.worksheets[0]?.factors[0]).toMatchObject({
    key: "Analysis-A\u0000factor-table-1\u000012",
    worksheetName: "Analysis-A",
    tableId: "factor-table-1",
    sourceRow: 12,
  });
});

it("maps blocked F2 worksheets without inventing factors", () => {
  const model = projectEngineeringWorkspace(blockedFixtureInput());
  expect(model.worksheets[0]).toMatchObject({ status: "blocked", factors: [] });
});

it("uses the first ready worksheet when no valid selection exists", () => {
  expect(projectEngineeringWorkspace(twoWorksheetFixture()).selectedWorksheetName).toBe("Ready-A");
});

it("never exposes internal feature or state labels", () => {
  expect(JSON.stringify(projectEngineeringWorkspace(fixtureInput()))).not.toMatch(/F[0-7]|running|pending|f4_running/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src/workspace-model.test.ts
```

Expected: FAIL because `workspace-model.ts` does not exist.

- [ ] **Step 3: Implement the pure projection**

Move the existing `createWhatIfBaselines`, `createDownstreamOptions`, and worksheet-name collection semantics out of `app.tsx`. Use available-value guards rather than unchecked casts. Do not introduce React state or API calls in this module.

- [ ] **Step 4: Verify projection and existing App behavior**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src/workspace-model.test.ts apps/workbench-web/src/app.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/workbench-web/src/workspace-model.ts apps/workbench-web/src/workspace-model.test.ts apps/workbench-web/src/app.tsx

git commit -m "feat(f8): project TA engineering workspace data"
```

---

### Task 3: 自动进入第一个 Ready Worksheet

**Files:**
- Create: `apps/workbench-server/src/auto-entry.ts`
- Create: `apps/workbench-server/src/auto-entry.test.ts`
- Modify: `apps/workbench-server/src/server.ts`
- Modify: `apps/workbench-server/src/routes/commands.ts`
- Modify: `packages/contracts/src/f8-contracts.ts`
- Test: `apps/workbench-server/src/server.test.ts`

**Interfaces:**
- Consumes: completed `F1F2SelectionResult.prompt`, current input revision, managed workbook hash.
- Produces:

```ts
export interface AutoEntryDecision {
  readonly kind: "confirm_initial_scope";
  readonly workbookHash: string;
  readonly worksheetNames: readonly string[];
}

export function createAutoEntryDecision(prompt: WorksheetSelectionPrompt): AutoEntryDecision | undefined;
```

Rule: return a decision only when at least one option has `worksheetKind === "analysis"`; select all analysis worksheets for governed F1/F2 execution, while the browser opens the first resulting `ready` worksheet. Return `undefined` for zero analysis options or duplicate/invalid identity; never auto-confirm downstream F3 scope.

- [ ] **Step 1: Write strict auto-entry tests**

```ts
it("selects only analysis worksheets in workbook order", () => {
  expect(createAutoEntryDecision(promptWithTemplatesAndAnalysis())).toEqual({
    kind: "confirm_initial_scope",
    workbookHash: HASH,
    worksheetNames: ["Analysis-A", "Analysis-B"],
  });
});

it("requires user recovery when no analysis worksheet exists", () => {
  expect(createAutoEntryDecision(templateOnlyPrompt())).toBeUndefined();
});
```

Add a Server integration test that uploads a valid workbook and eventually reads `downstream_scope_required` with one `f2_report` artifact, without a public `confirm_initial_scope` request.

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-server/src/auto-entry.test.ts apps/workbench-server/src/server.test.ts -t "auto-enters|auto entry"
```

Expected: FAIL because the decision helper and internal command do not exist.

- [ ] **Step 3: Add an internal-only auto confirmation command**

Extend only `f8SessionCommandSchema`, not `f8PublicSessionCommandSchema`:

```ts
commandEnvelopeSchema("auto_confirm_initial_scope", worksheetScopePayloadSchema)
```

Route it through the same reducer used by `confirm_initial_scope`. The public browser contract must reject this command.

- [ ] **Step 4: Apply the auto decision after F0 inventory**

The default worker must first run real `runF1F2Selection`, persist its selection reference, then return a JSON-canonical selection result. The queue result recorder applies `auto_confirm_initial_scope` with CAS and enqueues the resulting `f1_f2_running` attempt. If no strict decision exists, preserve `initial_scope_required` and expose a business recovery message.

- [ ] **Step 5: Verify server behavior and security**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-server/src/auto-entry.test.ts apps/workbench-server/src/server.test.ts packages/workbench/src/state-machine.test.ts
npm exec tsc -- -p apps/workbench-server/tsconfig.json --noEmit
```

Expected: PASS; public schema still rejects `auto_confirm_initial_scope`.

- [ ] **Step 6: Commit**

```powershell
git add apps/workbench-server/src packages/contracts/src/f8-contracts.ts packages/workbench/src/state-machine.ts packages/workbench/src/state-machine.test.ts

git commit -m "feat(f8): auto-enter ready TA worksheets"
```

---

### Task 4: 构建纯用户工作台壳层

**Files:**
- Create: `apps/workbench-web/src/components/WorkspaceToolbar.tsx`
- Create: `apps/workbench-web/src/components/WorkspacePreparation.tsx`
- Create: `apps/workbench-web/src/components/WorksheetPicker.tsx`
- Create: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`
- Create: `apps/workbench-web/src/components/EngineeringWorkspace.test.tsx`
- Modify: `apps/workbench-web/src/app.tsx`
- Modify: `apps/workbench-web/src/styles.css`
- Delete after migration: `apps/workbench-web/src/components/F0Status.tsx`
- Delete after migration: `apps/workbench-web/src/components/AnalysisProgress.tsx`
- Delete after migration: `apps/workbench-web/src/components/F7Placeholder.tsx`

**Interfaces:**
- Consumes: `EngineeringWorkspaceModel`, `uploadWorkbook`, selected worksheet state, business errors.
- Produces:

```ts
export interface EngineeringWorkspaceProps {
  readonly model: EngineeringWorkspaceModel;
  readonly loading: boolean;
  readonly connected: boolean;
  readonly onUpload: (file: File) => Promise<void>;
  readonly onSelectWorksheet: (worksheetName: string) => void;
}
```

- [ ] **Step 1: Write UI RED tests**

```tsx
it("shows one preparation message and no feature process UI", () => {
  render(<EngineeringWorkspace model={preparingModel()} {...handlers} />);
  expect(screen.getByText("正在准备 TA 工作区…")).toBeVisible();
  expect(screen.queryByText(/F0|F1|running|pending/)).not.toBeInTheDocument();
});

it("renders a searchable worksheet picker with business statuses", async () => {
  render(<EngineeringWorkspace model={readyModel()} {...handlers} />);
  await userEvent.click(screen.getByRole("combobox", { name: "Worksheet" }));
  expect(screen.getByText("Analysis-A")).toBeVisible();
  expect(screen.getByText("Ready")).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src/components/EngineeringWorkspace.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement the shell**

Replace the hero, feature ledger, progress list, two worksheet confirmation panels and fixed F7 placeholder with:

```tsx
<WorkspaceToolbar ... />
<div className="engineering-layout">
  <main className="engineering-layout__workbench">...</main>
  <aside className="engineering-layout__assistant">...</aside>
</div>
```

Use a native searchable combobox pattern (`input` + filtered listbox), not horizontal tabs. Keep internal diagnostics out of visible copy.

- [ ] **Step 4: Implement restrained responsive styling**

Define neutral engineering colors, tabular numerals, stable table tracks, 8 px maximum radius, no decorative cards or orbs. Use:

```css
.engineering-layout {
  display: grid;
  grid-template-columns: minmax(720px, 7fr) minmax(300px, 3fr);
  min-height: calc(100vh - 64px);
}
```

At `max-width: 900px`, move the assistant to a fixed bottom drawer and retain horizontal table scrolling.

- [ ] **Step 5: Verify UI and remove obsolete process components**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src/app.test.tsx apps/workbench-web/src/components/EngineeringWorkspace.test.tsx
npm --workspace @ai-assist/workbench-web run build
```

Expected: PASS; generated bundle contains no visible `F0 到 F6 状态` or `F4 - F7 Progress` copy.

- [ ] **Step 6: Commit**

```powershell
git add apps/workbench-web/src

git commit -m "feat(f8): replace process UI with TA workspace"
```

---

### Task 5: 标准化 Factor 表格与 Scenario Controller

**Files:**
- Create: `apps/workbench-web/src/scenario-controller.ts`
- Create: `apps/workbench-web/src/scenario-controller.test.ts`
- Create: `apps/workbench-web/src/components/FactorTable.tsx`
- Create: `apps/workbench-web/src/components/FactorTable.test.tsx`
- Create: `apps/workbench-web/src/hooks/use-scenario-workspace.ts`
- Create: `apps/workbench-web/src/hooks/use-scenario-workspace.test.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`
- Delete after migration: `apps/workbench-web/src/components/WhatIfEditor.tsx`
- Delete after migration: `apps/workbench-web/src/components/WhatIfEditor.test.tsx`

**Interfaces:**
- Consumes: `FactorRowModel`, `WorkbenchApi.calculateWhatIf`, `save_what_if_draft`, current `inputRevision`.
- Produces:

```ts
export interface FactorScenarioState {
  readonly values: WhatIfValues;
  readonly dirty: boolean;
  readonly calculating: boolean;
  readonly error?: string;
  readonly lastValidResult?: WhatIfCalculationResult;
}

export interface ScenarioWorkspaceController {
  readonly factorStates: ReadonlyMap<string, FactorScenarioState>;
  edit(factorKey: string, field: keyof WhatIfValues, rawValue: string): void;
  commit(factorKey: string): void;
  undo(): void;
  reset(factorKey?: string): void;
  save(factorKey: string): Promise<void>;
}
```

- [ ] **Step 1: Write pure validation and stale-result tests**

Cover finite numbers, blank values, tolerance sign rules, unchanged baseline, request sequence, undo and reset. Example:

```ts
it("ignores an older calculation result after a newer edit", async () => {
  const controller = createScenarioController(fixtureDeps());
  controller.commit(FACTOR_KEY);
  controller.edit(FACTOR_KEY, "upperTolerance", "0.25");
  controller.commit(FACTOR_KEY);
  resolveFirstRequest(oldResult);
  expect(controller.read(FACTOR_KEY).lastValidResult).toBeUndefined();
  resolveSecondRequest(newResult);
  expect(controller.read(FACTOR_KEY).lastValidResult).toEqual(newResult);
});
```

- [ ] **Step 2: Run RED tests**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src/scenario-controller.test.ts apps/workbench-web/src/hooks/use-scenario-workspace.test.tsx apps/workbench-web/src/components/FactorTable.test.tsx
```

Expected: FAIL because controller, hook and table do not exist.

- [ ] **Step 3: Implement the controller and hook**

Use 300 ms timers only after `commit`, not every keypress. Increment a per-factor request sequence before each request. Preserve `lastValidResult` when setting `calculating` or `error`. Generate a stable draft ID per active factor identity and input revision.

- [ ] **Step 4: Implement FactorTable**

Render the approved columns. Inputs exist only for Nominal, +Tolerance and -Tolerance; expose Additional Mean Shift in a compact selected-row detail strip. Use `onBlur={() => controller.commit(row.key)}`. Direction, identity and governed source data remain read-only.

- [ ] **Step 5: Verify table and automatic calculation**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src/scenario-controller.test.ts apps/workbench-web/src/hooks/use-scenario-workspace.test.tsx apps/workbench-web/src/components/FactorTable.test.tsx apps/workbench-web/src/app.test.tsx
```

Expected: PASS; fake timers observe exactly one calculation after 300 ms.

- [ ] **Step 6: Commit**

```powershell
git add apps/workbench-web/src

git commit -m "feat(f8): add editable TA factor table"
```

---

### Task 6: 工程指标与 V1 图表

**Files:**
- Create: `apps/workbench-web/src/chart-model.ts`
- Create: `apps/workbench-web/src/chart-model.test.ts`
- Create: `apps/workbench-web/src/components/MetricStrip.tsx`
- Create: `apps/workbench-web/src/components/ContributionChart.tsx`
- Create: `apps/workbench-web/src/components/BaselineScenarioChart.tsx`
- Create: `apps/workbench-web/src/components/SpecificationPlot.tsx`
- Create: `apps/workbench-web/src/components/EngineeringCharts.test.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`
- Delete after migration: `apps/workbench-web/src/components/MetricComparison.tsx`

**Interfaces:**
- Consumes: worksheet baseline metrics, factor contribution values, active Scenario results.
- Produces:

```ts
export interface ContributionDatum {
  readonly factorKey: string;
  readonly label: string;
  readonly baseline: number;
  readonly scenario?: number;
  readonly unit: string;
}

export interface SpecificationPlotModel {
  readonly lsl: number;
  readonly usl: number;
  readonly baselineMean: number;
  readonly scenarioMean?: number;
  readonly baselineSigma: number;
  readonly scenarioSigma?: number;
}
```

- [ ] **Step 1: Write chart-model tests**

Assert deterministic sorting, zero ranges, negative values, missing direction evidence and finite SVG domains. Never synthesize absent metrics.

- [ ] **Step 2: Run RED tests**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src/chart-model.test.ts apps/workbench-web/src/components/EngineeringCharts.test.tsx
```

Expected: FAIL because chart modules do not exist.

- [ ] **Step 3: Implement pure chart view models**

Normalize values into explicit domains with a minimum nonzero span. Keep unit formatting in one helper. Return an unavailable reason when required evidence is missing.

- [ ] **Step 4: Implement native SVG/HTML charts**

Use accessible `<svg role="img" aria-labelledby>` and an adjacent visually available text summary. Contribution bars use separate baseline/scenario patterns and colors. SpecificationPlot marks LSL, USL, means and ±3σ spans; it does not claim a distribution when sigma is unavailable.

- [ ] **Step 5: Verify rendering and build**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src/chart-model.test.ts apps/workbench-web/src/components/EngineeringCharts.test.tsx apps/workbench-web/src/app.test.tsx
npm --workspace @ai-assist/workbench-web run build
```

Expected: PASS; no new chart dependency in `package.json`.

- [ ] **Step 6: Commit**

```powershell
git add apps/workbench-web/src apps/workbench-web/package.json

git commit -m "feat(f8): visualize TA scenario results"
```

---

### Task 7: 上下文问答面板

**Files:**
- Create: `packages/conversation/src/ta-context.ts`
- Create: `packages/conversation/src/ta-context.test.ts`
- Modify: `packages/conversation/src/contracts.ts`
- Modify: `apps/workbench-server/src/routes/conversation.ts`
- Modify: `apps/workbench-web/src/api.ts`
- Modify: `apps/workbench-web/src/use-session.ts`
- Create: `apps/workbench-web/src/components/TaAssistantPanel.tsx`
- Create: `apps/workbench-web/src/components/TaAssistantPanel.test.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`
- Delete after migration: `apps/workbench-web/src/components/ConversationPane.tsx`

**Interfaces:**
- Consumes: current worksheet, selected Factor identity, current Scenario calculation reference, validated artifact IDs.
- Produces:

```ts
export interface TaConversationContext {
  readonly worksheetName?: string;
  readonly tableId?: string;
  readonly sourceRow?: number;
  readonly factorName?: string;
  readonly calculationReference?: string;
  readonly relatedArtifactIds: readonly string[];
}

export interface AppendTaTurnRequest {
  readonly turn: ConversationTurn;
  readonly context: TaConversationContext;
}
```

- [ ] **Step 1: Write context validation tests**

Reject cross-session artifact IDs, stale calculation references and a Factor identity not present in the current F4 baseline. Accept context-free general questions.

- [ ] **Step 2: Run RED tests**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts packages/conversation/src/ta-context.test.ts apps/workbench-web/src/components/TaAssistantPanel.test.tsx
```

Expected: FAIL because context contracts and panel do not exist.

- [ ] **Step 3: Implement validated context append**

The Server resolves artifact IDs and Factor identity against the current session before appending. Store context as structured metadata, not hidden text injected into the user message. Conversation writes cannot call session commands or HostActions.

- [ ] **Step 4: Implement the C1 panel**

Render current context above the conversation list. Suggested prompts are buttons that populate the input but do not auto-send. On narrow screens expose an icon button with accessible name `打开 TA Assistant`; open a bottom drawer that does not cover the focused cell.

- [ ] **Step 5: Verify security and interaction**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts packages/conversation/src/ta-context.test.ts apps/workbench-server/src/server.test.ts apps/workbench-web/src/components/TaAssistantPanel.test.tsx apps/workbench-web/src/app.test.tsx
```

Expected: PASS; cross-session context returns 403/validation error and no turn is appended.

- [ ] **Step 6: Commit**

```powershell
git add packages/conversation apps/workbench-server/src apps/workbench-web/src

git commit -m "feat(f8): add contextual TA assistant panel"
```

---

### Task 8: 业务错误恢复与操作确认

**Files:**
- Create: `apps/workbench-web/src/business-status.ts`
- Create: `apps/workbench-web/src/business-status.test.ts`
- Create: `apps/workbench-web/src/components/WorkspaceIssuePanel.tsx`
- Create: `apps/workbench-web/src/components/WorkspaceIssuePanel.test.tsx`
- Create: `apps/workbench-web/src/components/ScenarioActions.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`
- Modify: `apps/workbench-web/src/app.tsx`
- Delete after migration: `apps/workbench-web/src/components/ActionQueue.tsx`
- Delete after migration: `apps/workbench-web/src/components/ErrorPanel.tsx`

**Interfaces:**
- Consumes: `TypedError`, session decision states, saved Scenario Draft and promotion preview.
- Produces:

```ts
export interface WorkspaceIssue {
  readonly severity: "info" | "warning" | "error";
  readonly title: string;
  readonly detail: string;
  readonly action?: "retry" | "refresh" | "upload" | "confirm";
}

export function projectWorkspaceIssue(snapshot: F8SessionSnapshot | undefined, error: TypedError | undefined): WorkspaceIssue | undefined;
```

- [ ] **Step 1: Write copy and leakage tests**

Assert business messages for upload failure, no Ready worksheet, missing direction, stale revision and connection recovery. Assert serialized output does not contain internal state names or Feature IDs.

- [ ] **Step 2: Run RED tests**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src/business-status.test.ts apps/workbench-web/src/components/WorkspaceIssuePanel.test.tsx
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement issue projection and explicit actions**

Map known typed error codes and affected references to user copy. Keep ADO, image, analysis context, optimization targets and F6 promotion as explicit dialogs/buttons. Do not auto-submit write actions.

- [ ] **Step 4: Verify all user-visible copy**

Run:

```powershell
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src/business-status.test.ts apps/workbench-web/src/components/WorkspaceIssuePanel.test.tsx apps/workbench-web/src/app.test.tsx
```

Expected: PASS and no internal process copy in ordinary states.

- [ ] **Step 5: Commit**

```powershell
git add apps/workbench-web/src

git commit -m "feat(f8): translate workflow state into user actions"
```

---

### Task 9: 浏览器验收与真实 Workbook 验证

**Files:**
- Create: `test/f8-e2e/engineering-workspace.spec.ts`
- Create: `test/f8-e2e/engineering-workspace.visual.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `apps/workbench-server/scripts/build.mjs`
- Modify: `README.md`
- Modify: `docs/00-概览.md`
- Modify: `docs/04-功能拆分.md`

**Interfaces:**
- Consumes: production browser bundle, real loopback Server, synthetic safe fixture, optional local real workbook path.
- Produces: reproducible desktop/mobile Playwright evidence and an unchanged source workbook hash.

- [ ] **Step 1: Write browser RED tests**

Cover:

```ts
test("uploads and opens the first ready worksheet without process UI", async ({ page }) => {
  await uploadFixture(page);
  await expect(page.getByRole("grid", { name: "TA Factor Table" })).toBeVisible();
  await expect(page.getByText(/F0|F1|running|pending/)).toHaveCount(0);
});

test("edits tolerance and updates charts while retaining baseline", async ({ page }) => {
  await editCell(page, "Upper Tolerance", "0.25");
  await expect(page.getByText("正在更新结果…")).toBeVisible();
  await expect(page.getByRole("img", { name: "Baseline 与 Scenario 对比" })).toBeVisible();
});
```

Also test the assistant drawer at 390×844 and no element overlap at 1440×900.

- [ ] **Step 2: Run browser tests to verify RED**

Run:

```powershell
npm exec playwright -- test test/f8-e2e/engineering-workspace.spec.ts test/f8-e2e/engineering-workspace.visual.spec.ts
```

Expected: FAIL until the complete workspace bundle is deployed.

- [ ] **Step 3: Build and embed production assets**

Run:

```powershell
npm --workspace @ai-assist/workbench-web run build
node apps/workbench-server/scripts/build.mjs
npm exec tsc -- -b apps/workbench-server apps/cli
```

Update build script tests so `workbench.js` and `workbench.css` hashes match Web dist.

- [ ] **Step 4: Run full verification**

Run:

```powershell
npm exec tsc -- -p apps/workbench-web/tsconfig.json --noEmit
npm exec tsc -- -p apps/workbench-server/tsconfig.json --noEmit
npm exec vitest -- run --workspace vitest.workspace.ts apps/workbench-web/src apps/workbench-server/src packages/conversation/src packages/workbench/src/session-store.test.ts packages/workflow-runners/src/f4-what-if.test.ts
npm exec playwright -- test test/f8-e2e/engineering-workspace.spec.ts test/f8-e2e/engineering-workspace.visual.spec.ts
git diff --check
```

Expected: all commands PASS.

- [ ] **Step 5: Validate the named real workbook without modifying it**

Record the source SHA-256 before and after. Upload through the production browser, wait for the table, switch worksheets, edit a Scenario tolerance, verify governed metrics and ask one contextual question. Expected source hash remains identical and no generated output is written beside the source file.

- [ ] **Step 6: Update user documentation**

Document only the user workflow: launch, upload, worksheet switch, Scenario editing, interpreting charts, asking questions, saving and reset. Keep internal F0-F7 detail in architecture documents, not user quick-start content.

- [ ] **Step 7: Commit**

```powershell
git add test/f8-e2e playwright.config.ts apps/workbench-server/scripts/build.mjs README.md docs/00-概览.md docs/04-功能拆分.md

git commit -m "test(f8): verify TA engineering workspace"
```

---

## Final Acceptance

- [ ] Upload transitions through one business preparation state and opens the first Ready worksheet.
- [ ] Standardized Factor table supports Scenario edits without writing the source workbook.
- [ ] Cell blur triggers one governed What-if request after 300 ms; stale results cannot win.
- [ ] Mean, RSS, WC, Cp, Cpk and Margin retain Baseline while Scenario updates.
- [ ] Contribution, Baseline comparison and Specification charts have accessible text summaries.
- [ ] TA Assistant receives validated current worksheet/Factor context and cannot perform writes.
- [ ] Ordinary UI contains no Feature IDs, process ledger or internal state labels.
- [ ] Desktop and mobile Playwright checks show no overlap, clipping or layout shift.
- [ ] F7 remains unavailable and no simulated measured result is created.
- [ ] Named real workbook hash is unchanged after the complete browser workflow.
