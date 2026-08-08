# F3 System.History Comment Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the governed F3 Skill to publish its complete Markdown reminder through Surface MCP `update_work_item` and `/fields/System.History` when the direct comment tool has no body parameter.

**Architecture:** Keep network orchestration in the project F3 Skill, where VS Code exposes real Surface MCP tool schemas. Add a strict channel-selection contract: prefer a direct body-capable comment tool, otherwise allow one fixed `System.History` JSON Patch, then verify exactly one new comment and exact readback text before persisting `updated`.

**Tech Stack:** Markdown project Skill, Surface MCP tools, Node.js, Vitest, TypeScript repository checks.

---

## File Structure

- Modify `.github/skills/f3-analysis/SKILL.md`: define schema-qualified `System.History` channel selection and execution order.
- Modify `.github/skills/f3-analysis/references/ado-publishing.md`: define exact JSON Patch, pre-write comment snapshot, and post-write verification.
- Modify `scripts/f3-skill.test.mjs`: enforce the new Skill/protocol contract with deterministic static tests.
- Modify `docs/02-end-to-end-flow.md`: document the English governed fallback channel.
- Modify `docs/02-端到端流程.md`: document the Chinese governed fallback channel.
- Modify `docs/governance/feature-register.md`: align the feature register with the executable Skill contract.

The existing TypeScript drawing-governance adapter is not modified because no runtime bridge connects it to VS Code Surface MCP tool invocation. The fix belongs to the project Skill that performs the actual calls.

### Task 1: Lock The System.History Contract With A Failing Test

**Files:**
- Modify: `scripts/f3-skill.test.mjs`
- Test: `scripts/f3-skill.test.mjs`

- [ ] **Step 1: Write the failing Skill/protocol contract test**

Add this test next to `enforces ordering/policy/fallback statements`:

```js
it("governs the Surface System.History comment channel", () => {
  const skill = readUtf8(skillPath);
  const reference = readUtf8(referencePath);

  for (const contract of [skill, reference]) {
    expect(contract).toContain("mcp_surface_mcp_p_update_work_item");
    expect(contract).toContain("/fields/System.History");
    expect(contract).toContain("mcp_surface_mcp_p_list_work_item_comments");
    expect(contract).toContain("exactly one new comment");
    expect(contract).toContain("SHA-256");
    expect(contract).toContain("write_verification_failed");
  }

  expect(reference).toContain('\"op\": \"add\"');
  expect(reference).toContain('\"path\": \"/fields/System.History\"');
  expect(reference).toContain("value: confirmedMarkdownBody");
  expect(reference).toContain("Do not add any other JSON Patch operation");

  const snapshotIndex = skill.indexOf("snapshot existing comment IDs");
  const previewIndex = skill.indexOf("deterministic English preview");
  const confirmIndex = skill.indexOf("Question call 2 - final write confirmation: vscode_askQuestions");
  const writeIndex = skill.indexOf("mcp_surface_mcp_p_update_work_item");
  const readbackIndex = skill.indexOf("read back comments exactly once");

  expect(snapshotIndex).toBeGreaterThan(-1);
  expect(previewIndex).toBeGreaterThan(snapshotIndex);
  expect(confirmIndex).toBeGreaterThan(previewIndex);
  expect(writeIndex).toBeGreaterThan(confirmIndex);
  expect(readbackIndex).toBeGreaterThan(writeIndex);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs
```

Expected: FAIL in `governs the Surface System.History comment channel` because the Skill and protocol do not yet contain the new route.

- [ ] **Step 3: Commit the failing test**

```powershell
git add scripts/f3-skill.test.mjs
git commit -m "test(f3): require governed System.History channel"
```

### Task 2: Implement The Governed Channel In Skill And Protocol

**Files:**
- Modify: `.github/skills/f3-analysis/SKILL.md`
- Modify: `.github/skills/f3-analysis/references/ado-publishing.md`
- Test: `scripts/f3-skill.test.mjs`

- [ ] **Step 1: Replace the capability gate in the Skill**

In Phase 4, use this contract:

```markdown
4. Capability gate contract:
   - inspect the real Surface tool schemas.
   - Prefer a comment create/update tool only when it has a string field that carries the full Markdown body.
   - Otherwise allow the `System.History` channel only when `mcp_surface_mcp_p_update_work_item` exposes `requestBody[]` items with `op`, `path`, and string `value`, and `op` accepts `add`.
   - Before preview, call `mcp_surface_mcp_p_list_work_item_comments` once and snapshot existing comment IDs.
   - If neither channel qualifies, fail closed to `surface_mcp_comment_body_unsupported`.
```

- [ ] **Step 2: Add the exact write and readback contract to Phase 6**

Add these rules after the existing one-write rule:

```markdown
2. Define `confirmedMarkdownBody` as the complete Markdown body shown in Question call 2. For the `System.History` channel, after `Confirm write`, call `mcp_surface_mcp_p_update_work_item` exactly once with one requestBody item: `op=add`, `path=/fields/System.History`, and `value` equal to `confirmedMarkdownBody`.
3. Do not add any other JSON Patch operation and never derive `path` from user input.
4. After the write returns, read back comments exactly once with `mcp_surface_mcp_p_list_work_item_comments`.
5. Require exactly one new comment, matching work item ID, exact text, and SHA-256 of the confirmed body.
6. A write error or any readback mismatch is `write_verification_failed`; do not retry.
```

Renumber the remaining Phase 6 rules without changing their meaning.

- [ ] **Step 3: Add the protocol channel priority and exact JSON Patch**

Document direct comment first, then schema-qualified `mcp_surface_mcp_p_update_work_item`. Add this exact block before confirmation policy:

```js
const requestBody = [{
  op: "add",
  path: "/fields/System.History",
  value: confirmedMarkdownBody,
}];
```

State that no other patch operation is allowed, existing comment IDs are captured before preview, and one post-write read must find exactly one new comment whose target ID, exact text, and SHA-256 match.

- [ ] **Step 4: Run the focused test and verify GREEN**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs
```

Expected: PASS with all tests in `scripts/f3-skill.test.mjs` green.

- [ ] **Step 5: Commit the Skill implementation**

```powershell
git add .github/skills/f3-analysis/SKILL.md .github/skills/f3-analysis/references/ado-publishing.md
git commit -m "fix(f3): add governed System.History publish channel"
```

### Task 3: Synchronize User-Facing Governance Documentation

**Files:**
- Modify: `scripts/f3-skill.test.mjs`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/governance/feature-register.md`
- Test: `scripts/f3-skill.test.mjs`

- [ ] **Step 1: Extend the documentation contract test**

Inside the EN/CN F3 section loop, add:

```js
expectContainsAny(flowSection, ["System.History"], "missing governed System.History channel");
expectContainsAny(flowSection, [
  "exactly one new comment",
  "恰好一个新增评论",
], "missing new-comment readback rule");
expectContainsAny(flowSection, [
  "exact text and SHA-256",
  "正文与 SHA-256 完全一致",
], "missing exact body verification rule");
```

After the feature-register assertions, add:

```js
expect(featureRegister).toContain("System.History");
expect(featureRegister).toContain("exactly one new comment");
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs
```

Expected: FAIL because the EN/CN flow docs and feature register do not mention the new channel.

- [ ] **Step 3: Update the English flow contract**

Replace the bodyless-schema bullet with:

```markdown
- If the direct comment schema is bodyless, F3 may use the Surface MCP `update_work_item` `System.History` channel only when its real schema supports one fixed `add /fields/System.History` patch with the complete body. Snapshot comment IDs before preview; after one write, require exactly one new comment with matching work item ID, exact text and SHA-256. If the route is unavailable or verification fails, use the governed local fallback; never empty comment.
```

- [ ] **Step 4: Update the Chinese flow contract**

Replace the corresponding Chinese bullet with:

```markdown
- direct comment schema 无 body 时，仅当 Surface MCP `update_work_item` 的真实 schema 支持携带完整正文的单个 `add /fields/System.History` patch，F3 才可使用 `System.History` 通道。预览前保存 comment IDs；单次写入后必须恰好一个新增评论，并验证 Work Item ID、正文与 SHA-256 完全一致。通道不可用或校验失败时使用受治理的本地回退；禁止空评论（never empty comment）。
```

- [ ] **Step 5: Update the feature register**

Add this sentence to the F3 ADO publishing entry:

```markdown
Bodyless direct comment schemas may use the schema-qualified Surface MCP `System.History` channel; one write must produce exactly one new comment with exact body/hash readback.
```

- [ ] **Step 6: Run the focused test and verify GREEN**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit synchronized documentation**

```powershell
git add scripts/f3-skill.test.mjs docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/governance/feature-register.md
git commit -m "docs(f3): document System.History verification"
```

### Task 4: Run Repository Verification

**Files:**
- Verify only; no planned file changes.

- [ ] **Step 1: Run focused F3 publishing tests**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs scripts/write-f3-ado-reminder.test.mjs scripts/f3-ado-reminder.test.mjs scripts/f3-report.test.mjs scripts/f3-full-flow.test.mjs
```

Expected: all selected test files pass with zero failed tests.

- [ ] **Step 2: Run build**

```powershell
npm run build -- --force
```

Expected: exit code 0.

- [ ] **Step 3: Run repository checks**

```powershell
npm run check:repository
```

Expected: exit code 0 and repository verification passes.

- [ ] **Step 4: Confirm branch scope**

```powershell
git status --short --branch
git log --oneline main..HEAD
```

Expected: branch `user/xumax/F3_debug`, clean worktree, and only the design plus focused fix commits.

### Task 5: Execute Governed Live Acceptance

**Files:**
- Existing artifact: `test/demo-output/feature3-output/Maera_cosmetic_critical_TA---Rev-E_0110---test/Feature3-Report.json`

- [ ] **Step 1: Reuse the accepted F3 artifact without rerunning analysis**

Confirm the report remains schema-valid and contains Work Item reference `1102392`, 7 worksheets, and 32 factors.

- [ ] **Step 2: Validate the existing target read-only**

Use Surface MCP in strict order: list organizations, list project `MechanicalEngineering`, read Work Item `1102392`, and ask the user to confirm the target.

- [ ] **Step 3: Snapshot comments and render the complete preview**

Call `mcp_surface_mcp_p_list_work_item_comments` once and retain the current two comment IDs. Render all 32 governance rows with the exact 11-column English header.

- [ ] **Step 4: Request final write confirmation**

Use a separate `vscode_askQuestions` call whose only confirmation choice is `Confirm write`. Include organization, project, Work Item ID/title, factor count, governance-required count, complete preview, and the effect `one add /fields/System.History write`.

- [ ] **Step 5: Write exactly once**

Only after confirmation, call `mcp_surface_mcp_p_update_work_item` with organization `1ES4Devices`, Work Item ID `1102392`, and exactly one request body item:

```js
const confirmedMarkdownBody = completePreviewShownInQuestionCall2;
const requestBody = [{
  op: "add",
  path: "/fields/System.History",
  value: confirmedMarkdownBody,
}];
```

- [ ] **Step 6: Read back exactly once and persist the outcome**

Call `mcp_surface_mcp_p_list_work_item_comments` once. Require one new comment, Work Item ID `1102392`, exact text equality, and matching SHA-256. On success persist `ado.status = updated`; on any mismatch run the existing `write_verification_failed` local fallback and do not retry.

- [ ] **Step 7: Report acceptance evidence**

Report the new comment ID, readback verification result, final local ADO status, and the F3 report paths without exposing the full confidential payload in terminal logs.