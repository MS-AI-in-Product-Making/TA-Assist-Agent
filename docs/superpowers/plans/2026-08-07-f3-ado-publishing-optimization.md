# F3 ADO Publishing Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project Copilot Skill that runs the F0/F1/F2/F3 workflow, validates an ADO target through Surface MCP, requires explicit confirmation before comment writes, and produces the same English governance reminder locally when ADO publishing is declined or unavailable.

**Architecture:** Keep F3 core deterministic and network-free. Add a pure English ADO reminder renderer plus a small local artifact writer/status updater; the project Skill owns multi-turn user interaction and Surface MCP orchestration. Surface MCP capability gaps fail closed to `Feature3-ADO-Reminder.md` without Azure DevOps MCP or browser fallback.

**Tech Stack:** TypeScript 5.7, Node.js ESM, Zod 3, Vitest 3, GitHub Copilot Agent Skills, Surface MCP, Markdown/JSON artifacts.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/f3-ado-reminder.mjs` | Pure English comment/reminder rendering and governance-issue mapping. |
| `scripts/f3-ado-reminder.test.mjs` | Exact 11-column contract, English template, escaping, and privacy tests. |
| `scripts/write-f3-ado-reminder.mjs` | Validate F3 JSON, write local reminder atomically, and persist controlled ADO outcomes. |
| `scripts/write-f3-ado-reminder.test.mjs` | Local fallback and ADO status persistence tests. |
| `scripts/f3-report.mjs` | Display optional Work Item reference and reason code from the result model. |
| `scripts/f3-report.test.mjs` | Markdown status rendering regression tests. |
| `.github/skills/f3-analysis/SKILL.md` | User interaction, F0/F1/F2/F3 orchestration, Surface MCP validation, and confirmation protocol. |
| `.github/skills/f3-analysis/references/ado-publishing.md` | Exact Surface MCP query order, English payload contract, capability fail-closed rules. |
| `scripts/f3-skill.test.mjs` | Static skill discovery and safety-policy acceptance tests. |
| `docs/governance/feature-register.md` | User-visible F3 publishing boundary. |
| `docs/02-end-to-end-flow.md` | English end-to-end F3 interaction flow. |
| `docs/02-端到端流程.md` | Chinese end-to-end F3 interaction flow. |

### Task 1: Build the English ADO Reminder Renderer

**Files:**
- Create: `scripts/f3-ado-reminder.mjs`
- Create: `scripts/f3-ado-reminder.test.mjs`

- [ ] **Step 1: Write the failing exact-column test**

```js
import { describe, expect, it } from "vitest";
import { renderF3AdoReminder } from "./f3-ado-reminder.mjs";

it("renders the required English ADO governance table", () => {
  const markdown = renderF3AdoReminder(governanceReport());
  expect(markdown).toContain("## F3 DIM ID / Drawing Governance Reminder");
  expect(markdown).toContain(
    "| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Governance issue |",
  );
  expect(markdown).toContain("Drawing Number missing; DIM ID suspected invalid");
  expect(markdown).not.toContain("Source Location");
});
```

- [ ] **Step 2: Run the renderer test and verify RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-ado-reminder.test.mjs
```

Expected: FAIL because `scripts/f3-ado-reminder.mjs` does not exist.

- [ ] **Step 3: Implement the minimal pure renderer**

Implement and export:

```js
export const ADO_TABLE_HEADER = "| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Governance issue |";

export function governanceIssue(row) {
  const labels = {
    drawing_number_missing: "Drawing Number missing",
    dim_id_missing: "DIM ID missing",
    dim_id_suspected_invalid: "DIM ID suspected invalid",
    dim_id_needs_confirmation: "DIM ID needs confirmation",
    duplicate_conflict: "Duplicate Drawing Number and DIM ID conflict",
  };
  const issues = row.qualitySignals.map((signal) => labels[signal]);
  return issues.length === 0 ? "Complete" : issues.join("; ");
}

export function renderF3AdoReminder(report) {
  const parsed = drawingGovernanceResultV2Schema.parse(report);
  if (parsed.status === "input_rejected") throw new Error("F3 ADO reminder requires an accepted governance report.");
  // Render fixed English summary, exact table header, all rows, and requested actions.
}
```

Use the existing F3 Markdown escaping and sensitive-path redaction rules. Preserve source identifiers and user-provided part/factor text verbatim; only template text is required to be English.

- [ ] **Step 4: Add focused edge-case tests**

Add tests that verify:

```js
expect(renderF3AdoReminder(reportWithAllSignals())).toContain("Duplicate Drawing Number and DIM ID conflict");
expect(renderF3AdoReminder(reportWithText("A|B\nC"))).toContain("A\\|B<br>C");
expect(renderF3AdoReminder(validReport())).not.toMatch(/[A-Za-z]:\\/);
expect(renderF3AdoReminder(validReport())).not.toContain("Authorization");
expect(renderF3AdoReminder(completeReport())).toContain("| Complete |");
```

- [ ] **Step 5: Run renderer tests and verify GREEN**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-ado-reminder.test.mjs scripts/f3-report.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the renderer**

```powershell
git add scripts/f3-ado-reminder.mjs scripts/f3-ado-reminder.test.mjs
git commit -m "feat(f3): render English ADO governance reminders"
```

### Task 2: Add Local Fallback and Controlled ADO Outcome Persistence

**Files:**
- Create: `scripts/write-f3-ado-reminder.mjs`
- Create: `scripts/write-f3-ado-reminder.test.mjs`
- Modify: `scripts/f3-report.mjs`
- Modify: `scripts/f3-report.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing local-fallback test**

```js
it("writes Feature3-ADO-Reminder.md beside the F3 report", () => {
  const result = writeF3AdoReminder({
    f3OutputRoot,
    adoOutcome: { status: "not_requested" },
  });
  expect(result.reminderPath).toBe(path.join(f3OutputRoot, "Feature3-ADO-Reminder.md"));
  expect(readFileSync(result.reminderPath, "utf8")).toContain("## F3 DIM ID / Drawing Governance Reminder");
  expect(readJson(reportPath).ado).toEqual({ status: "not_requested" });
});
```

Add a blocked-outcome test:

```js
expect(writeF3AdoReminder({
  f3OutputRoot,
  adoOutcome: {
    status: "blocked",
    workItemReference: "1102392",
    reasonCode: "surface_mcp_comment_body_unsupported",
  },
}).report.ado).toEqual({
  status: "blocked",
  workItemReference: "1102392",
  reasonCode: "surface_mcp_comment_body_unsupported",
});
```

- [ ] **Step 2: Run writer tests and verify RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/write-f3-ado-reminder.test.mjs
```

Expected: FAIL because the writer does not exist.

- [ ] **Step 3: Implement the writer and atomic status update**

Export:

```js
export function writeF3AdoReminder({ f3OutputRoot, adoOutcome }) {
  const reportPath = path.join(path.resolve(f3OutputRoot), "Feature3-Report.json");
  const report = drawingGovernanceResultV2Schema.parse(JSON.parse(readFileSync(reportPath, "utf8")));
  if (report.status === "input_rejected") throw new Error("F3 ADO reminder requires an accepted report.");
  const updatedReport = drawingGovernanceResultV2Schema.parse({ ...report, ado: adoOutcome });
  const reminderPath = path.join(path.resolve(f3OutputRoot), "Feature3-ADO-Reminder.md");
  atomicWrite(reminderPath, renderF3AdoReminder(updatedReport));
  atomicWrite(reportPath, `${JSON.stringify(updatedReport, null, 2)}\n`);
  atomicWrite(path.join(path.resolve(f3OutputRoot), "Feature3-Report.md"), renderF3Report(updatedReport));
  return { reminderPath, report: updatedReport };
}
```

The CLI accepts exactly one F3 output directory and controlled flags:

```text
--status not_requested|blocked|failed|updated
--work-item-reference <reference>
--reason-code <controlled-code>
```

Reject path traversal, unknown flags, unsupported status/reason combinations, and raw comment content on the command line.

- [ ] **Step 4: Update F3 report status rendering tests**

Add:

```js
expect(renderF3Report(reportWithAdo({
  status: "blocked",
  workItemReference: "1102392",
  reasonCode: "surface_mcp_comment_body_unsupported",
}))).toContain("ADO Work Item：`1102392`");
```

Also assert the reason code appears and that no comment body is embedded in the regular F3 report.

- [ ] **Step 5: Add the package script**

Add to `package.json`:

```json
"workflow:f3:ado-reminder": "node scripts/write-f3-ado-reminder.mjs"
```

- [ ] **Step 6: Run writer/report tests and verify GREEN**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/write-f3-ado-reminder.test.mjs scripts/f3-ado-reminder.test.mjs scripts/f3-report.test.mjs scripts/f3-full-flow.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit local fallback support**

```powershell
git add scripts/write-f3-ado-reminder.mjs scripts/write-f3-ado-reminder.test.mjs scripts/f3-report.mjs scripts/f3-report.test.mjs package.json
git commit -m "feat(f3): persist governed ADO publishing outcomes"
```

### Task 3: Create the Project F3 Analysis Skill

**Files:**
- Create: `.github/skills/f3-analysis/SKILL.md`
- Create: `.github/skills/f3-analysis/references/ado-publishing.md`
- Create: `scripts/f3-skill.test.mjs`

- [ ] **Step 1: Write the failing skill-discovery test**

```js
it("defines a discoverable F3 analysis skill", () => {
  const skill = readFileSync(".github/skills/f3-analysis/SKILL.md", "utf8");
  expect(skill).toMatch(/^---\nname: f3-analysis\n/);
  expect(skill).toContain("使用 F3 分析报告");
  expect(skill).toContain("use F3 to analyze");
});
```

- [ ] **Step 2: Write failing workflow-policy tests**

Assert the Skill includes all three publishing choices, validates organization/project/type or ID before use, defaults to `Task`, uses `vscode_askQuestions` before a write, forbids Azure DevOps MCP/browser fallback, and invokes local reminder fallback for declined/capability-blocked flows.

```js
expect(skill).toContain("Create a new ADO work item");
expect(skill).toContain("Use an existing ADO work item");
expect(skill).toContain("Do not publish to ADO");
expect(skill).toContain("Default: Task");
expect(skill).toContain("vscode_askQuestions");
expect(skill).toContain("Never use Azure DevOps MCP");
expect(skill).toContain("workflow:f3:ado-reminder");
```

Assert the reference file contains the exact 11-column header.

- [ ] **Step 3: Run skill tests and verify RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs
```

Expected: FAIL because the project Skill files do not exist.

- [ ] **Step 4: Implement `SKILL.md`**

Use frontmatter:

```yaml
---
name: f3-analysis
description: 'Run the complete F0/F1/F2/F3 TA analysis and govern DIM ID / Drawing Number results. Use when the user asks to use F3, analyze a TA workbook/report with F3, publish F3 findings to an ADO Work Item, or generate a local F3 reminder.'
argument-hint: '<workbook-or-f2-artifact-path>'
user-invocable: true
---
```

The procedure must be sequential:

1. Resolve input and run/locate F0/F1/F2/F3 artifacts.
2. Ask the publishing-mode question before any Surface MCP entity call.
3. For `create`, query organizations, projects, Work Item types; default to `Task`; correct invalid values before create.
4. For `existing`, query organization/project and read the Work Item; show ID/title/type/state/owner and ask target confirmation.
5. Render the English preview from `Feature3-Report.json` via `f3-ado-reminder.mjs` or the local writer.
6. Inspect the exact Surface MCP comment-write schema. A write capability is valid only when it accepts full Markdown body content.
7. Show a separate `vscode_askQuestions` confirmation containing target metadata and preview summary.
8. On confirm, write exactly once, then read back and verify.
9. On decline or capability failure, run `npm run workflow:f3:ado-reminder -- <f3-dir> ...`.
10. Report artifact paths and controlled status without exposing secrets.

- [ ] **Step 5: Implement the Surface MCP reference**

Document exact query order and candidate correction behavior. Include the fixed English header and quality-signal mappings. State explicitly:

```text
Never use Azure DevOps MCP, REST, browser automation, or shell HTTP calls as a write fallback.
Never call a comment tool whose registered schema has no full comment-body parameter.
Never create an empty comment.
```

- [ ] **Step 6: Run skill tests and verify GREEN**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the project Skill**

```powershell
git add .github/skills/f3-analysis/SKILL.md .github/skills/f3-analysis/references/ado-publishing.md scripts/f3-skill.test.mjs
git commit -m "feat(f3): add governed ADO publishing skill"
```

### Task 4: Synchronize F3 Documentation and Run Acceptance Tests

**Files:**
- Modify: `docs/governance/feature-register.md`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`

- [ ] **Step 1: Add documentation acceptance assertions**

Extend `scripts/f3-skill.test.mjs` to read all three docs and assert they contain:

```text
Create / existing / do not publish
Surface MCP validation
explicit confirmation
Feature3-ADO-Reminder.md
surface_mcp_comment_body_unsupported
```

The English and Chinese flow docs must both state that ADO comment content is English and uses the fixed 11-column table.

- [ ] **Step 2: Run documentation assertions and verify RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs
```

Expected: FAIL because the docs do not yet describe the optimized flow.

- [ ] **Step 3: Update governance and flow documents**

Document:

- the project Skill as the user entry point;
- Surface MCP-only validation and publishing;
- new/existing/no-publish choices;
- default `Task` type;
- explicit write confirmation;
- English comment contract;
- local fallback and stable reason code;
- no scheduler and no impact on F4 handoff.

- [ ] **Step 4: Run focused F3 validation**

Run:

```powershell
npm run build -- --force
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-ado-reminder.test.mjs scripts/write-f3-ado-reminder.test.mjs scripts/f3-skill.test.mjs scripts/f3-report.test.mjs scripts/f3-artifact-loader.test.mjs scripts/f3-output-layout.test.mjs scripts/f3-full-flow.test.mjs packages/workbook-catalog/src/f3-drawing-governance.test.ts packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts packages/adapters/src/surface-mcp-config.test.ts apps/cli/src/commands/feature3.test.ts apps/cli/src/index.test.ts packages/governance/src/policy-gate.test.ts
```

Expected: PASS with no failed tests.

- [ ] **Step 5: Run repository validation**

Run:

```powershell
npm run check:repository
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 6: Run local fallback acceptance on the existing F3 artifact**

Run:

```powershell
npm run workflow:f3:ado-reminder -- "test/demo-output/f3-acceptance/Test_TP_Step_202600805/2026-08-07T09-52-00/f3" --status blocked --work-item-reference 1102392 --reason-code surface_mcp_comment_body_unsupported
```

Expected:

- `Feature3-ADO-Reminder.md` is written;
- it contains all seven factors and the exact 11 columns;
- `Feature3-Report.json` remains schema-valid;
- `ado.status` is `blocked` with the controlled reason code.

- [ ] **Step 7: Commit documentation and final validation changes**

```powershell
git add docs/governance/feature-register.md docs/02-end-to-end-flow.md docs/02-端到端流程.md scripts/f3-skill.test.mjs
git commit -m "docs(f3): document governed ADO publishing flow"
```

## Final Verification

Run from the repository root:

```powershell
npm run build -- --force
npm run lint
npm run check:repository
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-ado-reminder.test.mjs scripts/write-f3-ado-reminder.test.mjs scripts/f3-skill.test.mjs scripts/f3-report.test.mjs scripts/f3-artifact-loader.test.mjs scripts/f3-output-layout.test.mjs scripts/f3-full-flow.test.mjs packages/workbook-catalog/src/f3-drawing-governance.test.ts packages/adapters/src/surface-mcp-drawing-governance-adapter.test.ts packages/adapters/src/surface-mcp-config.test.ts apps/cli/src/commands/feature3.test.ts apps/cli/src/index.test.ts packages/governance/src/policy-gate.test.ts
```

Expected: build, lint, repository checks, and all focused tests pass with zero failures.
