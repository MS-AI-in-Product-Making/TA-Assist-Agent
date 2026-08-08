# F3 System.History HTML Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a deterministic HTML table body for Surface MCP `System.History` comments while preserving the existing Markdown reminder for local and direct-comment use.

**Architecture:** Add a second pure renderer that consumes the validated F3 report directly and emits a safe HTML fragment. Both F3 artifact writers persist Markdown and HTML variants; the Skill selects the body by channel and verifies the exact channel-specific body after one write.

**Tech Stack:** Node.js ESM, Vitest, Zod-validated F3 reports, Surface MCP `update_work_item`.

---

## File Structure

- Modify `scripts/f3-ado-reminder.mjs`: add deterministic HTML renderer and HTML escaping.
- Modify `scripts/f3-ado-reminder.test.mjs`: test exact table structure, row preservation, escaping, and redaction.
- Modify `scripts/run-f3-full-validation.mjs`: write Markdown and HTML ADO artifacts for accepted reports.
- Modify `scripts/f3-full-flow.test.mjs`: verify both artifacts are created from the same report.
- Modify `scripts/write-f3-ado-reminder.mjs`: atomically regenerate the HTML artifact with ADO outcome updates.
- Modify `scripts/write-f3-ado-reminder.test.mjs`: verify the HTML path and content.
- Modify `.github/skills/f3-analysis/SKILL.md`: select Markdown or HTML body by write channel.
- Modify `.github/skills/f3-analysis/references/ado-publishing.md`: define HTML body and readback contract.
- Modify `scripts/f3-skill.test.mjs`: enforce channel-specific body behavior.
- Modify `docs/02-end-to-end-flow.md`, `docs/02-端到端流程.md`, and `docs/governance/feature-register.md`: synchronize user-facing governance rules.

### Task 1: Add The Pure HTML Renderer

**Files:**
- Modify: `scripts/f3-ado-reminder.test.mjs`
- Modify: `scripts/f3-ado-reminder.mjs`
- Test: `scripts/f3-ado-reminder.test.mjs`

- [ ] **Step 1: Write failing renderer tests**

Import `renderF3AdoHistoryHtml`, then add tests that assert:

```js
const html = renderF3AdoHistoryHtml(acceptedReport([
  baseRow({
    factorDescription: "A&B <critical> \"quoted\" 'single'\nnext",
    qualitySignals: ["drawing_number_missing"],
    governanceStatus: "needs_governance",
  }),
]));

expect(html).toContain("<h2>F3 DIM ID / Drawing Governance Reminder</h2>");
expect(html.match(/<th>/g)).toHaveLength(11);
expect(html.match(/<tbody><tr>/g)).toHaveLength(1);
expect(html).toContain("<table>");
expect(html).toContain("<thead><tr><th>Device Level Dim</th>");
expect(html).toContain("<td>A&amp;B &lt;critical&gt; &quot;quoted&quot; &#39;single&#39;<br>next</td>");
expect(html).not.toContain("A&B <critical>");
```

Add a second test using a Windows path and bearer token, asserting the HTML contains
`[redacted-local-path]` and `Authorization: [redacted]` but not the original values.

- [ ] **Step 2: Run the renderer test and verify RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-ado-reminder.test.mjs
```

Expected: FAIL because `renderF3AdoHistoryHtml` is not exported.

- [ ] **Step 3: Implement minimal HTML escaping and rendering**

Add:

```js
export const ADO_HTML_TABLE_HEADERS = [
  "Device Level Dim",
  "Dimension Description",
  "Part / Subsystem",
  "Drawing Number",
  "Dim ID",
  "Factor Description",
  "Nominal",
  "Upper Tolerance (+)",
  "Lower Tolerance (-)",
  "σ Level",
  "Governance issue",
];

function htmlCell(value) {
  const text = value === null || value === undefined || value === ""
    ? "(missing)"
    : redactSensitiveText(value);
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll(/\r?\n/g, "<br>");
}
```

Implement `renderF3AdoHistoryHtml(report)` by validating the report, rejecting `input_rejected`, and returning one compact HTML fragment with:

```js
const header = `<thead><tr>${ADO_HTML_TABLE_HEADERS.map((name) => `<th>${htmlCell(name)}</th>`).join("")}</tr></thead>`;
const body = `<tbody>${rows.map((row) => `<tr>${[
  row.deviceLevelDim,
  row.dimensionDescription,
  row.partSubsystem,
  row.drawingNumber,
  row.dimId,
  row.factorDescription,
  row.nominal,
  row.upperTolerance,
  row.lowerTolerance,
  row.sigmaLevel,
  governanceIssue(row),
].map((value) => `<td>${htmlCell(value)}</td>`).join("")}</tr>`).join("")}</tbody>`;
```

Use the existing `requestedActions` output to build
`` `<ul>${requestedActions(count).map((action) => `<li>${htmlCell(action)}</li>`).join("")}</ul>` ``.
End the fragment with `\n` for deterministic file output.

- [ ] **Step 4: Run renderer tests and verify GREEN**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-ado-reminder.test.mjs
```

Expected: all renderer tests pass.

- [ ] **Step 5: Commit the renderer**

```powershell
git add scripts/f3-ado-reminder.mjs scripts/f3-ado-reminder.test.mjs
git commit -m "feat(f3): render ADO history HTML table"
```

### Task 2: Persist Both ADO Artifact Formats

**Files:**
- Modify: `scripts/f3-full-flow.test.mjs`
- Modify: `scripts/run-f3-full-validation.mjs`
- Modify: `scripts/write-f3-ado-reminder.test.mjs`
- Modify: `scripts/write-f3-ado-reminder.mjs`
- Test: `scripts/f3-full-flow.test.mjs`
- Test: `scripts/write-f3-ado-reminder.test.mjs`

- [ ] **Step 1: Write failing artifact tests**

In the F3 full-flow test, assert accepted output includes files named
`Feature3-ADO-Reminder.md` and `Feature3-ADO-History.html`. Assert the HTML contains `<table>` and 11 `<th>` elements.

In the writer test, assert the result includes `historyHtmlPath`, the file exists, and its content contains:

```js
expect(historyHtml).toContain("<h2>F3 DIM ID / Drawing Governance Reminder</h2>");
expect(historyHtml).toContain("<table>");
expect(historyHtml.match(/<th>/g)).toHaveLength(11);
```

- [ ] **Step 2: Run artifact tests and verify RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-full-flow.test.mjs scripts/write-f3-ado-reminder.test.mjs
```

Expected: FAIL because the HTML artifact is not created.

- [ ] **Step 3: Wire the F3 runner**

Import both ADO renderers. For accepted reports, atomically write:

```js
const reminderMdPath = path.join(outputLayout.outRoot, "Feature3-ADO-Reminder.md");
const historyHtmlPath = path.join(outputLayout.outRoot, "Feature3-ADO-History.html");
atomicWrite(reminderMdPath, renderF3AdoReminder(report));
atomicWrite(historyHtmlPath, renderF3AdoHistoryHtml(report));
```

Include both paths in the JSON CLI result only for accepted reports.

- [ ] **Step 4: Wire the outcome writer atomically**

Add `historyHtmlPath` to validated paths and sensitive-path redaction. Render HTML beside Markdown and include it in the same staged atomic transaction:

```js
const historyHtml = renderF3AdoHistoryHtml(report);
const targets = [
  { targetPath: loaded.reminderPath, content: reminderMd },
  { targetPath: loaded.historyHtmlPath, content: historyHtml },
  { targetPath: loaded.reportJsonPath, content: `${JSON.stringify(updatedReport, null, 2)}\n` },
  { targetPath: loaded.reportMdPath, content: reportMd },
];
```

Return `historyHtmlPath` with the existing result.

- [ ] **Step 5: Run artifact tests and verify GREEN**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-full-flow.test.mjs scripts/write-f3-ado-reminder.test.mjs
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit artifact wiring**

```powershell
git add scripts/run-f3-full-validation.mjs scripts/f3-full-flow.test.mjs scripts/write-f3-ado-reminder.mjs scripts/write-f3-ado-reminder.test.mjs
git commit -m "feat(f3): persist ADO HTML history artifact"
```

### Task 3: Make The Publish Contract Channel-Specific

**Files:**
- Modify: `scripts/f3-skill.test.mjs`
- Modify: `.github/skills/f3-analysis/SKILL.md`
- Modify: `.github/skills/f3-analysis/references/ado-publishing.md`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/02-端到端流程.md`
- Modify: `docs/governance/feature-register.md`
- Test: `scripts/f3-skill.test.mjs`

- [ ] **Step 1: Write failing Skill contract assertions**

Add assertions that Skill and protocol contain:

```js
for (const contract of [skill, reference]) {
  expect(contract).toContain("Feature3-ADO-History.html");
  expect(contract).toContain("confirmedHistoryHtml");
  expect(contract).toContain("comment format `html`");
  expect(contract).toContain("exact HTML text and SHA-256");
}
expect(skill).toContain("direct comment channel uses `confirmedMarkdownBody`");
expect(skill).toContain("System.History channel uses `confirmedHistoryHtml`");
```

Extend EN/CN flow and feature-register assertions with `Feature3-ADO-History.html` and `confirmedHistoryHtml`.

- [ ] **Step 2: Run Skill tests and verify RED**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs
```

Expected: FAIL because the current contract writes Markdown to both channels.

- [ ] **Step 3: Update Skill and protocol**

Define:

```markdown
- direct comment channel uses `confirmedMarkdownBody` from `Feature3-ADO-Reminder.md`.
- System.History channel uses `confirmedHistoryHtml` from `Feature3-ADO-History.html`.
```

For `System.History`, require comment format `html`, exact HTML text and SHA-256 readback. The confirmation must show the complete governance data and state that the write body is its deterministic HTML table serialization.

- [ ] **Step 4: Synchronize EN/CN flow and feature register**

Document the dual artifacts and state that raw Markdown must never be sent to `System.History`.

- [ ] **Step 5: Run Skill tests and verify GREEN**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-skill.test.mjs
```

Expected: all Skill contract tests pass.

- [ ] **Step 6: Commit contract synchronization**

```powershell
git add scripts/f3-skill.test.mjs .github/skills/f3-analysis/SKILL.md .github/skills/f3-analysis/references/ado-publishing.md docs/02-end-to-end-flow.md docs/02-端到端流程.md docs/governance/feature-register.md
git commit -m "fix(f3): use HTML for System.History comments"
```

### Task 4: Verify And Publish The Corrected Comment

**Files:**
- Existing artifact directory: `test/demo-output/feature3-output/Maera_cosmetic_critical_TA---Rev-E_0110---test`

- [ ] **Step 1: Run focused tests**

```powershell
npm exec -- vitest run --workspace vitest.workspace.ts scripts/f3-ado-reminder.test.mjs scripts/f3-full-flow.test.mjs scripts/write-f3-ado-reminder.test.mjs scripts/f3-skill.test.mjs scripts/f3-report.test.mjs
```

Expected: all selected tests pass.

- [ ] **Step 2: Run build and repository check**

```powershell
npm run build -- --force
npm run check:repository
```

Expected: both commands exit 0.

- [ ] **Step 3: Generate HTML for the existing accepted artifact**

Run the supported updated-status writer for Work Item `1102392`, then assert `Feature3-ADO-History.html` exists, has 11 `<th>` elements and 32 `<tbody>` rows, and contains no local path or Authorization secret.

- [ ] **Step 4: Run governed ADO confirmation**

Validate organization `1ES4Devices`, project `MechanicalEngineering`, and Work Item `1102392`. Snapshot comments, show the full governance preview, and state that the write will add a deterministic HTML table. Ask the user for the separate exact `Confirm write` choice.

- [ ] **Step 5: Write and read back once**

After confirmation, call `mcp_surface_mcp_p_update_work_item` exactly once with one `add /fields/System.History` patch whose value is the exact content of `Feature3-ADO-History.html`. Read comments exactly once and require one new comment, format `html`, Work Item ID `1102392`, exact HTML text, and equal SHA-256.

- [ ] **Step 6: Run complete repository tests**

```powershell
npm test
```

Expected: all test files pass; the existing environment-dependent symlink test may remain skipped.

- [ ] **Step 7: Confirm branch state**

```powershell
git status --short --branch
git log --oneline main..HEAD
```

Expected: clean `user/xumax/F3_debug` branch with focused HTML table commits.