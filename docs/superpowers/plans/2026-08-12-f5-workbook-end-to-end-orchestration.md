# F5 Workbook Complete Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 F3/F5 workbook 入口，使其通过现有 F2 Excel 两阶段握手完整执行 F0/F1/F2/F3/F4/F5，并在两个 worksheet 治理边界停下来向用户确认。

**Architecture:** 不修改 F0 API、F1 confirmation validator 或 feature 核心计算。F3/F5 skills 改用 `workflow:f2:excel`：第一次调用生成 F1 selection prompt，用户确认后第二次调用生成同一 workbook identity 下的受控 F1/F2 artifacts；后续继续从 F2-ready 集合选择 F3/F4/F5 范围。静态契约测试锁定命令形状、阶段顺序、F0 版本披露和文档一致性，最后以真实 Mauna Loa workbook 完成两次人工确认的端到端验收。

**Tech Stack:** Markdown skills、Node.js 24、Vitest 3、npm workspace scripts、现有 `f2-excel-runner.mjs`、VS Code `vscode_askQuestions`

---

## File Structure

- Modify: `.github/skills/f5-analysis/SKILL.md` - F5 workbook/existing-artifact 路由、双 worksheet 选择、F3/F4/F5 顺序、图片观察与结果披露。
- Modify: `scripts/f5-skill.test.mjs` - F5 命令、阶段、停止边界、F0 披露与禁止行为契约。
- Modify: `.github/skills/f3-analysis/SKILL.md` - F3 workbook/existing-artifact 路由、F1/F2 握手、ready worksheet 与 ADO gate。
- Modify: `scripts/f3-skill.test.mjs` - F3 真实命令形状与上游握手契约。
- Create: `scripts/workflow-docs.test.mjs` - 防止 README 再将单 workbook 裸 F1/F2 描述为完整路径。
- Modify: `README.md` - Feature 2/F5 workbook 示例统一为两阶段协议。
- Modify: `docs/README.md` - 移除过期裸 F1→F2 示例并链接设计与计划。

## Execution Prerequisites

- 首次修改 `SKILL.md` 前读取并遵循 `writing-skills` skill。
- 每个行为改动遵循 `test-driven-development`：先观察新增断言预期失败，再修改 skill/document。
- 不创建 `workflow:f0`，不修改 `package.json` scripts。
- 不修改源 workbook，不复用失败运行的部分 artifacts。
- 每个任务只提交该任务列出的文件。

### Task 1: Lock the F5 upstream handshake contract

**Files:**
- Modify: `scripts/f5-skill.test.mjs`
- Test: `scripts/f5-skill.test.mjs`

- [ ] **Step 1: Replace the stale allowed command fixtures**

将 `allowedCommands` 中裸 F1/F2 两行替换为：

```js
"npm run workflow:f2:excel -- <ta-workbook-path>",
"npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm",
```

其余 F3/F4/F5 command fixtures 保持原顺序。

- [ ] **Step 2: Lock the real package script and reject stale commands**

在 `lists only repository-backed workflow command shapes` 中使用：

```js
expect([...new Set(workflowCommands(skill))].sort()).toEqual([
  "workflow:f2:excel",
  "workflow:f3",
  "workflow:f4",
  "workflow:f5",
]);
expect(scripts["workflow:f2:excel"]).toBe("node scripts/f2-excel-runner.mjs");
for (const command of ["workflow:f3", "workflow:f4", "workflow:f5"]) {
  expect(scripts[command], `${command} must be backed by package.json`).toMatch(/^node scripts\//);
}
expect(skill).not.toMatch(/npm\s+run\s+workflow:f1\s+--\s+<ta-workbook-path>/i);
expect(skill).not.toMatch(/npm\s+run\s+workflow:f2\s+--\s+<f1-output-dir>/i);
```

- [ ] **Step 3: Lock both user gates and F0 disclosure**

将 phase-order 测试 markers 改为：

```js
expectOrdered(skill, [
  "Phase W0 - Validate input and F0 capabilities",
  "Phase W1 - Generate F1 worksheet selection",
  "Phase W2 - Confirm and run F1 plus F2",
  "Phase W3 - Select ready worksheets",
  "Phase W4 - Run local F3",
  "Phase W5 - Run F4 from F2",
  "Phase W6 - Optional image observations",
  "Phase W7 - Run F5 with the same selection",
  "Phase W8 - Validate and present F5",
]);
expect(skill).toContain("F1/F2 scope call - `vscode_askQuestions` (`multiSelect: true`)");
expect(skill).toContain("F3/F4/F5 scope call - `vscode_askQuestions` (`multiSelect: true`)");
expect(skill).toContain("No complete F1, F2, F3, F4, or F5 execution may begin before the first selection succeeds");
expect(skill).toContain("No F3, F4, or F5 execution may begin before the second selection succeeds");
```

新增测试：

```js
it("keeps F0 internal and discloses controlled versions", () => {
  const skill = readSkill();
  expect(skill).toContain("`v1`");
  expect(skill).toContain("`internal-v1`");
  expect(skill).toContain("`interpretation-rules-v1`");
  expect(skill).toContain("validate the versions recorded by the F2 and F5 artifacts");
  expect(skill).not.toMatch(/npm\s+run\s+workflow:f0\b/i);
});
```

- [ ] **Step 4: Verify RED**

Run: `npx vitest run scripts/f5-skill.test.mjs`

Expected: FAIL because the skill still lists naked F1/F2 and lacks W0-W2 plus both exact question labels.

- [ ] **Step 5: Commit the RED test**

```powershell
git add scripts/f5-skill.test.mjs
git commit -m "test(f5): require complete workbook orchestration"
```

### Task 2: Implement the F5 workbook orchestration skill

**Files:**
- Modify: `.github/skills/f5-analysis/SKILL.md`
- Test: `scripts/f5-skill.test.mjs`

- [ ] **Step 1: Replace W1-W3 with W0-W3**

使用以下内容，后续 image evidence gates 保持不变：

```markdown
### Phase W0 - Validate input and F0 capabilities

Resolve and validate exactly one canonical `.xlsx` workbook path and preserve the source read-only. Confirm that the repository-backed F0 modules required by this flow are available: public knowledge base `v1`, internal tolerance guidance `internal-v1`, and interpretation rules `interpretation-rules-v1`. F0 is consumed through controlled APIs inside F2 and F5; do not invent or run `workflow:f0`.

### Phase W1 - Generate F1 worksheet selection

Run `npm run workflow:f2:excel -- <ta-workbook-path>`. Require status `selectionRequired`, then validate `Feature1-Selection.json`, its run root and manifest, workbook identity/hash, and unique options.

Make an **F1/F2 scope call - `vscode_askQuestions` (`multiSelect: true`)** listing only validated options. Require at least one worksheet. On cancel or empty selection, stop without complete F1/F2. No complete F1, F2, F3, F4, or F5 execution may begin before the first selection succeeds.

### Phase W2 - Confirm and run F1 plus F2

Run `npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm` with the exact W1 names and hash. Validate the completed manifest, F1/F2 roots and reports, workbook identity, selected scope, source paths, and hashes. Never continue from the selection-only root or a historical run.

### Phase W3 - Select ready worksheets

Read only validated F2 handoffs with `status: readyForNextFeature`. Require membership in W1 and a valid controlled F1 `imageReference` plus physical image.

Make an **F3/F4/F5 scope call - `vscode_askQuestions` (`multiSelect: true`)** listing only eligible names. Require at least one worksheet. On cancel or empty selection, stop before F3/F4/F5. No F3, F4, or F5 execution may begin before the second selection succeeds.
```

- [ ] **Step 2: Add F0 version presentation to W8**

```markdown
Validate the versions recorded by the F2 and F5 artifacts and present public knowledge base `v1`, internal tolerance guidance `internal-v1`, and interpretation rules `interpretation-rules-v1`. This disclosure records controlled F0 use; it does not imply a separate F0 workflow command.
```

- [ ] **Step 3: Replace Allowed commands**

```markdown
- `npm run workflow:f2:excel -- <ta-workbook-path>`
- `npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm`
- `npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`
- `npm run workflow:f4 -- --f2-report <f2-output-dir>/Feature2-Report.json`
- `npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`
- `npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --image-observations <artifact-path>`
```

明确第一条只生成 prompt，第二条才执行 confirmed F1/F2，禁止合并、省略或乱序。

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run scripts/f5-skill.test.mjs`

Expected: PASS，包括既有 image routing、classification、containment、existing-artifact 与 safety tests。

- [ ] **Step 5: Commit**

```powershell
git add .github/skills/f5-analysis/SKILL.md
git commit -m "fix(f5): preserve workbook feature gates"
```

### Task 3: Apply the same upstream contract to F3

**Files:**
- Modify: `scripts/f3-skill.test.mjs`
- Modify: `.github/skills/f3-analysis/SKILL.md`
- Test: `scripts/f3-skill.test.mjs`

- [ ] **Step 1: Update F3 command fixtures and package assertions**

将裸 F1/F2 fixtures 替换为 Task 1 的两条 `workflow:f2:excel` 命令。将 allowed set 的 `workflow:f1`、`workflow:f2` 替换为 `workflow:f2:excel`，并断言：

```js
expect(scripts["workflow:f2:excel"]).toBe("node scripts/f2-excel-runner.mjs");
expect(skill).not.toContain("npm run workflow:f1 -- <ta-workbook-path>");
expect(skill).not.toContain("npm run workflow:f2 -- <f1-output-dir>");
```

两种 F3 commands 和所有 ADO reminder fixtures 保持原样、原顺序。

- [ ] **Step 2: Add ordered F3 workbook gate assertions**

```js
it("requires the F1 selection handshake before F2 validation and F3 selection", () => {
  const skill = readUtf8(skillPath);
  const markers = [
    "Workbook step 1 - generate F1 selection",
    "F1/F2 scope call - vscode_askQuestions (multiSelect: true)",
    "Workbook step 2 - confirm F1 and run F2",
    "Worksheet selection call - vscode_askQuestions (multiSelect: true)",
    "Run workflow:f3 only after the worksheet selection call returns at least one selection.",
  ];
  let previous = -1;
  for (const marker of markers) {
    const index = skill.indexOf(marker);
    expect(index, `Missing ordered marker: ${marker}`).toBeGreaterThan(previous);
    previous = index;
  }
  expect(skill).toContain("public `v1` and internal `internal-v1`");
  expect(skill).not.toMatch(/npm\s+run\s+workflow:f0\b/i);
});
```

- [ ] **Step 3: Verify RED**

Run: `npx vitest run scripts/f3-skill.test.mjs`

Expected: FAIL because F3 skill still advertises naked F1/F2 and lacks pre-F1 selection.

- [ ] **Step 4: Implement the F3 handshake**

Replace the first two supported commands with the two `workflow:f2:excel` commands. In Phase 1 enforce this exact order:

```markdown
1. There is no executable `workflow:f0`. F2 consumes controlled F0 public `v1` and internal `internal-v1` APIs; do not invent an F0 command.
2. Workbook step 1 - generate F1 selection: run the prompt form of `workflow:f2:excel` and validate prompt, hash, options, run root, and manifest.
3. F1/F2 scope call - vscode_askQuestions (multiSelect: true)
4. Require a nonempty selection; cancel stops before complete F1/F2/F3 and every publish question.
5. Workbook step 2 - confirm F1 and run F2: run the confirmed command with exact names/hash and validate completed F1/F2 roots, reports, identities, hashes, and manifest.
6. Read only F2 ready worksheets in artifact order.
7. Worksheet selection call - vscode_askQuestions (multiSelect: true)
8. Require a nonempty downstream selection; cancel stops before F3 and publishing mode.
9. Run workflow:f3 only after the worksheet selection call returns at least one selection.
```

Existing F3 artifact fast path and all ADO phases remain unchanged.

- [ ] **Step 5: Verify GREEN**

Run: `npx vitest run scripts/f3-skill.test.mjs`

Expected: PASS，包括既有 ADO protocol 和 fallback assertions。

- [ ] **Step 6: Commit**

```powershell
git add scripts/f3-skill.test.mjs .github/skills/f3-analysis/SKILL.md
git commit -m "fix(f3): preserve workbook selection handshake"
```

### Task 4: Make workbook documentation regression-tested

**Files:**
- Create: `scripts/workflow-docs.test.mjs`
- Modify: `README.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Create the failing test**

```js
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("workbook workflow documentation", () => {
  for (const relativePath of ["README.md", "docs/README.md"]) {
    it(`${relativePath} uses the confirmed F1/F2 handshake`, () => {
      const markdown = readFileSync(path.join(root, relativePath), "utf8");
      expect(markdown).toContain("npm run workflow:f2:excel --");
      expect(markdown).toContain("--workbook-hash");
      expect(markdown).toContain("--worksheets");
      expect(markdown).toContain("--confirm");
      expect(markdown).not.toMatch(/npm run workflow:f1 -- [^\r\n]+[\s\S]{0,160}npm run workflow:f2 --/);
    });
  }
});
```

- [ ] **Step 2: Verify RED**

Run: `npx vitest run scripts/workflow-docs.test.mjs`

Expected: FAIL because both documents retain the stale naked F1→F2 example.

- [ ] **Step 3: Update README.md**

Delete the two stale “先运行 F1 / 再运行 F2” bullets and add:

```markdown
- F3/F5 从 workbook 启动时复用上述两阶段 `workflow:f2:excel` 协议：先获取 F1 worksheet options，再由用户确认 hash 与范围后生成同一 workbook identity 的受控 F1/F2 artifacts；不得以裸 F1→F2 命令绕过确认。
```

- [ ] **Step 4: Update docs/README.md**

Replace the stale block with:

```markdown
单 workbook 先执行 prompt phase：`npm run workflow:f2:excel -- "test/<workbook.xlsx>"`。用户选择至少一个 worksheet 后，使用 prompt 返回的 hash 执行 confirm phase：`npm run workflow:f2:excel -- "test/<workbook.xlsx>" --worksheets "Analysis-A,Analysis-B" --workbook-hash "<sha256>" --confirm`。confirmed run 在独立受控目录中依次生成并验证 F1/F2 artifacts；F3/F5 不得跳过该握手。
```

Add index rows:

```markdown
| [F5 Workbook 完整编排设计](superpowers/specs/2026-08-12-f5-workbook-end-to-end-orchestration-design.md) | F0-F5 完整链路、双 worksheet 确认和 fail-closed 边界 |
| [F5 Workbook 完整编排实施计划](superpowers/plans/2026-08-12-f5-workbook-end-to-end-orchestration.md) | F3/F5 skill 合同、文档回归和真实 workbook 验收步骤 |
```

- [ ] **Step 5: Verify GREEN and focused regression**

Run:

```powershell
npx vitest run scripts/workflow-docs.test.mjs
npx vitest run scripts/f2-excel-runner.test.mjs scripts/f3-skill.test.mjs scripts/f5-skill.test.mjs scripts/workflow-docs.test.mjs
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```powershell
git add scripts/workflow-docs.test.mjs README.md docs/README.md
git commit -m "docs: align workbook workflows with confirmation gates"
```

### Task 5: Run related regressions and repository checks

**Files:** No changes expected.

- [ ] **Step 1: Run selection and argument regressions**

Run: `npx vitest run scripts/f2-excel-runner.test.mjs scripts/f3-cli-args.test.mjs scripts/f5-cli-args.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run downstream artifact/full-flow regressions**

Run: `npx vitest run scripts/f3-artifact-loader.test.mjs scripts/f3-full-flow.test.mjs scripts/f4-full-flow.test.mjs scripts/f5-artifact-loader.test.mjs scripts/f5-full-flow.test.mjs`

Expected: PASS.

- [ ] **Step 3: Run repository verification**

Run: `npm run check:repository`

Expected: exit code 0.

- [ ] **Step 4: Verify repository state**

Run: `git status --short --branch`

Expected: clean worktree and only the planned commits ahead of the prior baseline.

### Task 6: Execute the real Mauna Loa F5 flow

**Input:** `test/Mauna_Loa_TP_Step_20260611.xlsx` (read-only)

- [ ] **Step 1: Generate the F1 selection prompt**

```powershell
npm run workflow:f2:excel -- "C:\Users\xumax\AI Project\AI TVA Analysis\test\Mauna_Loa_TP_Step_20260611.xlsx"
```

Expected: exit 0, status `selectionRequired`, controlled prompt/manifest/hash/options, and complete F1/F2 still pending.

- [ ] **Step 2: Validate and ask the first question**

Validate workbook identity/hash, unique options, containment, and stage statuses. Use `vscode_askQuestions` (`multiSelect: true`) titled `F1/F2 分析范围`, listing only validated options. Cancel/empty stops before complete F1/F2.

- [ ] **Step 3: Run confirmed F1/F2**

```powershell
npm run workflow:f2:excel -- "C:\Users\xumax\AI Project\AI TVA Analysis\test\Mauna_Loa_TP_Step_20260611.xlsx" --worksheets "<confirmed-comma-separated-names>" --workbook-hash "<validated-sha256>" --confirm
```

Expected: completed manifest and valid controlled F1/F2 roots/reports for the first selection.

- [ ] **Step 4: Validate readiness and ask the second question**

Offer only worksheets in the first selection with F2 `readyForNextFeature` and a controlled, identity/hash-valid F1 image. Use `vscode_askQuestions` (`multiSelect: true`) titled `F3/F4/F5 ready 范围`. Cancel/empty stops before F3/F4/F5.

- [ ] **Step 5: Run local F3 with the exact downstream set**

```powershell
npm run workflow:f3 -- "<validated-f2-root>" --worksheet "<worksheet-1>" --worksheet "<worksheet-2>"
```

Omit/add repeated pairs to exactly match the selection. Expected: accepted F3 set equals selection. Do not run ADO reminder or Surface tools.

- [ ] **Step 6: Run F4 from validated F2**

```powershell
npm run workflow:f4 -- --f2-report "<validated-f2-root>/Feature2-Report.json"
```

Expected: valid calculations include every selected worksheet; extra ready calculations remain outside F5 scope.

- [ ] **Step 7: Ask whether to evaluate images**

Use `vscode_askQuestions`. Skip means deterministic F5 with `not_evaluated`; accept means inspect only verified F1 images and create one immutable, schema-valid observation artifact under the prescribed UUID path.

- [ ] **Step 8: Run F5 with the exact downstream set**

```powershell
npm run workflow:f5 -- "<validated-f1-root>" "<validated-f3-root>" "<validated-f4-root>" --worksheet "<worksheet-1>" --worksheet "<worksheet-2>"
```

Omit/add repeated pairs to match selection. Append `--image-observations "<validated-path>"` only when the artifact passed readback validation.

- [ ] **Step 9: Validate and present the result**

Validate report, manifest, run summary, identities, hashes, classifications and containment. Present Chinese results preserving FACT/RULE/SIGNAL/OPTION, assumptions, clarifications and F6 delegation. Report `v1`, `internal-v1`, `interpretation-rules-v1` and image evaluation status.

- [ ] **Step 10: Keep generated confidential outputs uncommitted**

Run: `git status --short --branch`

Expected: no tracked source changes from analysis. Never add generated workbook artifacts.

## Final Verification Checklist

- [ ] F3/F5 workbook modes contain no naked F1/F2 path.
- [ ] Both skills prohibit `workflow:f0` while disclosing controlled F0 versions.
- [ ] First selection precedes complete F1/F2; second selection precedes F3/F4/F5.
- [ ] Second selection is restricted to validated F2-ready worksheets with valid F1 images.
- [ ] F3 and F5 receive the same downstream set; F4 receives no invented worksheet flag.
- [ ] F5 local F3 does not publish to ADO.
- [ ] Contract, runner, documentation, downstream and repository checks pass.
- [ ] Mauna Loa reaches F5 or stops only at an explicit user/fail-closed gate.