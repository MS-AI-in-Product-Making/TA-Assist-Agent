# TA Assist Agent Report and Product Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish one complete governed TA report, provide one `/ta-assist-agent` entry, and migrate product branding and engineering assets to TA Assist Agent and English.

**Architecture:** Extend the existing F6 v3 projection and renderer rather than creating a second report path. Keep F2/F4/F5/F6 internal provenance authoritative, materialize verified images beside the final report, move new F6 publication to an explicit four-file contract, and preserve historical five-file readers through version dispatch.

**Tech Stack:** TypeScript, Node.js ESM, Zod, Vitest, Markdown, VS Code workspace Skills, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-09-08-ta-assist-agent-report-and-product-optimization-design.md`

## Global Constraints

- Work on branch `issue/106-ux-agent-triggering` and preserve the ten pre-existing uncommitted Issue 106 files.
- F4 remains the only numeric calculation authority; renderers and models must not recalculate engineering results.
- Join Factors by worksheet, table ID, source row, and Factor ordinal, never by Factor name alone.
- User-facing report tables contain no Source or Evidence columns; internal artifacts retain provenance.
- New runs publish one Markdown report and three internal governance files; historical five-file bundles remain read-only.
- Product-visible name is `TA Assist Agent`; root npm name is `ta-assist-agent`; internal `@ai-assist/*` scopes remain unchanged.
- Engineering assets use English; explicit localization catalogs and localized fixtures remain bilingual.
- Do not rename the GitHub repository until all local validation passes.

---

### Task 1: Preserve Existing Issue 106 Work

**Files:**
- Modify only if tests expose defects: `packages/contracts/src/contracts.ts`
- Modify only if tests expose defects: `packages/workbook-catalog/src/f6-optimization.ts`
- Modify only if tests expose defects: `packages/workflow-runners/src/existing-f6.ts`
- Modify only if tests expose defects: `scripts/f6-artifact-loader.mjs`
- Modify only if tests expose defects: `scripts/f6-final-report.mjs`
- Modify only if tests expose defects: `scripts/verify-current-f6.mjs`
- Test: the corresponding currently modified `*.test.*` files

**Interfaces:**
- Consumes: current uncommitted blocked-scope and DIM-ID compatibility changes.
- Produces: a passing, understood baseline before adding report behavior.

- [ ] **Step 1: Record the current branch and modified-file baseline**

```powershell
git status --short --branch
git diff --stat
```

Expected: branch is `issue/106-ux-agent-triggering`; the ten known F6 files remain modified.

- [ ] **Step 2: Run the narrow existing-change tests**

```powershell
npx vitest run packages/workbook-catalog/src/f6-optimization.test.ts scripts/f6-artifact-loader.test.mjs scripts/f6-final-report.test.mjs scripts/verify-current-f6.test.mjs
```

Expected: PASS, or a local failure that identifies an unfinished existing change.

- [ ] **Step 3: Repair only baseline-local defects**

Keep the current intent: v3 report scope includes blocked worksheet names, optimization worksheets match the nonblocked ordered subset, numeric and textual DIM IDs compare semantically, and blocked worksheets remain evidence-only.

- [ ] **Step 4: Rerun the narrow baseline tests**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the preserved baseline**

```powershell
git add packages/contracts/src/contracts.ts packages/workbook-catalog/src/f6-optimization.ts packages/workbook-catalog/src/f6-optimization.test.ts packages/workflow-runners/src/existing-f6.ts scripts/f6-artifact-loader.mjs scripts/f6-artifact-loader.test.mjs scripts/f6-final-report.mjs scripts/f6-final-report.test.mjs scripts/verify-current-f6.mjs scripts/verify-current-f6.test.mjs
git commit -m "fix(report): preserve blocked F6 worksheet scope"
```

### Task 2: Add Exact Workbook Diagnostics

**Files:**
- Modify: `scripts/f6-final-report.test.mjs`
- Modify: `scripts/f6-final-report.mjs`

**Interfaces:**
- Consumes: F2 `missingFieldSummary`, `systemSpecificationIssues`, `f4CalculabilityIssues`, row `missingRequiredFields`, identifier signals, and tolerance-path image status.
- Produces: `formatWorksheetFindings(worksheet, catalog): string[]` and an exact workbook-summary Key Finding.

- [ ] **Step 1: Write failing diagnostic tests**

Add focused cases that assert exact, localized messages for:

```text
Row 18: Design Nominal is missing.
Rows 15 and 17: Sigma Level is invalid.
Tolerance path image is missing.
Drawing Number is missing on row 14; calculation can continue but drawing governance review is required.
```

Also assert that a blocked worksheet never falls back to `Required input, image, or calculation is missing.`.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run scripts/f6-final-report.test.mjs -t "diagnostic|blocked|Workbook Summary"
```

Expected: FAIL because `primaryFinding()` returns generic disposition text.

- [ ] **Step 3: Implement deterministic diagnostic projection**

Add field-name catalogs and stable ordering. Aggregate identical field failures by row, distinguish identifier reminders from blockers, and sanitize every displayed workbook value through the existing Markdown-safe text helper.

- [ ] **Step 4: Verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/f6-final-report.mjs scripts/f6-final-report.test.mjs
git commit -m "feat(report): show exact worksheet blockers"
```

### Task 3: Render the Complete Governed Report

**Files:**
- Modify: `scripts/f6-final-report.test.mjs`
- Modify: `scripts/f6-final-report.mjs`
- Modify only if projection fields are unavailable: `packages/workbook-catalog/src/f6-report-projection.ts`
- Modify only if projection fields are unavailable: `packages/workbook-catalog/src/f6-report-projection.test.ts`
- Modify: `scripts/f6-full-flow.test.mjs`

**Interfaces:**
- Consumes: validated F2 rows, F4 calculations, required multimodal v3 artifact, F0 row guidance, and F6 v3 steps.
- Produces: `Feature6-Report.md` with Document Overview, Workbook Summary, complete worksheet sections, and no provenance display columns.

- [ ] **Step 1: Write failing report-contract tests**

Assert exact headers for the complete Factor table:

```js
[
  "Ordinal", "Row", "Factor Description", "Part Name", "Drawing Number", "DIM ID",
  "Part Category", "Design Nominal", "+ Tolerance", "- Tolerance",
  "Long Term/Safety Factor", "Sigma Level", "Distribution", "Mean", "Tolerance",
  "One Sigma", "% Contribution to Sigma", "Notes", "Capability Library Result",
  "Knowledge Library Recommendation",
]
```

Assert every active Factor identity and original ordinal occurs exactly once. Assert Document Overview fields, Workbook Summary, requirements, statistical/worst-case ranges, Cp/CpkL/CpkU/Cpk, Yield/DPM, Mean Response, Mean Shift, RSS One Sigma, full contributor ranking, and the standalone F0 guidance table.

Assert no Markdown header cell equals `Source`, `Evidence`, `来源`, or `证据`.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run scripts/f6-final-report.test.mjs scripts/f6-full-flow.test.mjs
```

Expected: FAIL on missing report sections and columns.

- [ ] **Step 3: Implement strict Factor joins**

Build maps keyed by serialized `[worksheetName, tableId, sourceRow, normalizedOrdinal]`. Reject missing, duplicate, extra, or mismatched F2/F4/multimodal rows. Keep numeric formatting delegated to `formatEngineering()` and `formatPercent()`.

- [ ] **Step 4: Implement report sections**

Render, in governed order:

```text
1. Document Overview
2. Workbook Summary
3-N.1 Tolerance Path Image
3-N.2 Complete Factor Table
3-N.3 Image and Factor Table Context Interpretation
3-N.4 Requirements and Statistical Results
3-N.5 F0 Capability and Knowledge Guidance
3-N.6 Adjusted Mean to Spec Center Shift
3-N.7 Contributor Priorities
3-N.8 Specification Changes
```

Use localized catalogs while keeping source code and identifiers English.

- [ ] **Step 5: Implement the center-shift display**

Consume governed adjusted mean and specification limits, and format the already-governed center assessment operands with exactly three decimal places:

```text
Offset = adjusted mean - (lower spec limit + upper spec limit) / 2
```

Display adjusted mean, specification center, and offset with unit. For nonzero offset, add the localized Factor nominal optimization reminder.

- [ ] **Step 6: Implement contributor and F0 guidance tables**

Render every ranked contributor with Rank, Factor, One Sigma, Variance Contribution, Priority, and Guidance. Add the Top 3 tolerance-range review reminder. Render every Factor in the F0 table with capability result, recommended tolerance band/range, recommended distribution, and knowledge recommendation; use `N/A` for absent governed guidance.

- [ ] **Step 7: Verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add scripts/f6-final-report.mjs scripts/f6-final-report.test.mjs scripts/f6-full-flow.test.mjs packages/workbook-catalog/src/f6-report-projection.ts packages/workbook-catalog/src/f6-report-projection.test.ts
git commit -m "feat(report): publish complete governed TA report"
```

### Task 4: Materialize Verified Report Images

**Files:**
- Modify: `scripts/f6-final-report.test.mjs`
- Modify: `scripts/f6-final-report.mjs`
- Modify: `packages/workflow-runners/src/f6.test.ts`
- Modify: `packages/workflow-runners/src/f6.ts`
- Modify: `scripts/f6-full-flow.test.mjs`

**Interfaces:**
- Consumes: validated F1 image reference, controlled publish root, and final run root.
- Produces: a verified image beneath the final run root and a final-report-relative Markdown link.

- [ ] **Step 1: Write failing image-link tests**

Cover a valid nested upstream image, the historical broken relative-link layout, missing file, unsupported media type, hash mismatch, lexical escape, and symlink/junction escape. Resolve the emitted link from `dirname(Feature6-Report.md)` and assert that the file exists and its SHA-256 matches the recorded image hash.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run scripts/f6-final-report.test.mjs packages/workflow-runners/src/f6.test.ts scripts/f6-full-flow.test.mjs -t "image|link|materializ"
```

Expected: FAIL because the renderer copies the upstream relative path.

- [ ] **Step 3: Implement verified materialization**

Use structured path APIs and existing repository containment helpers. Canonicalize source and target ancestry, reject links/reparse points, require a regular PNG/JPEG, verify SHA-256, copy bytes into a deterministic `images/` path beneath the final run root, and compute the Markdown target with `path.relative(finalReportDirectory, target)`.

- [ ] **Step 4: Keep publication atomic**

Materialize into the staging run directory before manifest publication. Any image validation failure must prevent successful final report and manifest publication.

- [ ] **Step 5: Verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add scripts/f6-final-report.mjs scripts/f6-final-report.test.mjs packages/workflow-runners/src/f6.ts packages/workflow-runners/src/f6.test.ts scripts/f6-full-flow.test.mjs
git commit -m "fix(report): publish valid tolerance image links"
```

### Task 5: Publish the New Four-File F6 Contract

**Files:**
- Modify: `scripts/f6-output-layout.test.mjs`
- Modify: `scripts/f6-output-layout.mjs`
- Modify: `packages/workflow-runners/src/f6.test.ts`
- Modify: `packages/workflow-runners/src/f6.ts`
- Modify: `packages/workflow-runners/src/types.ts`
- Modify: `scripts/run-f6-full-validation.test.mjs`
- Modify: `scripts/run-f6-full-validation.mjs`
- Modify: `scripts/f6-full-flow.test.mjs`
- Modify: `packages/workflow-runners/src/existing-f6.test.ts`
- Modify: `packages/workflow-runners/src/existing-f6.ts`
- Modify: `scripts/verify-current-f6.test.mjs`
- Modify: `scripts/verify-current-f6.mjs`

**Interfaces:**
- Produces for new runs: `Feature6-Optimization.json`, `Feature6-Report.md`, `Feature6-Run-Summary.json`, and manifest-last `manifest.json`.
- Preserves: version-dispatched read-only validation for historical five-file v2/v3 bundles.

- [ ] **Step 1: Write failing current-writer tests**

Assert exactly four files, no `Feature6-Optimization.md`, no optimization Markdown path/hash in current results, and manifest-last publication. Require an explicit writer/manifest contract discriminator.

- [ ] **Step 2: Write failing historical-reader tests**

Use immutable fixtures for historical five-file v2 and v3 bundles. Assert that both remain hash-validated and no file is rewritten. Assert that a four-file bundle without the new discriminator is rejected.

- [ ] **Step 3: Verify RED**

```powershell
npx vitest run scripts/f6-output-layout.test.mjs packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.test.ts scripts/run-f6-full-validation.test.mjs scripts/f6-full-flow.test.mjs scripts/verify-current-f6.test.mjs
```

Expected: FAIL because the current writer requires five files.

- [ ] **Step 4: Implement the current four-file writer**

Remove `optimizationMdName`, `optimizationMdPath`, content generation, current hash fields, and publication steps from the current writer path. Add the explicit current artifact-set discriminator and keep manifest publication last.

- [ ] **Step 5: Implement version-aware readers**

Dispatch on the explicit contract/version field. Validate four exact files for current bundles and five exact files for historical bundles. Never infer the contract from directory contents alone.

- [ ] **Step 6: Verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add scripts/f6-output-layout* scripts/run-f6-full-validation* scripts/f6-full-flow.test.mjs scripts/verify-current-f6* packages/workflow-runners/src/f6* packages/workflow-runners/src/existing-f6* packages/workflow-runners/src/types.ts
git commit -m "feat(workflow): publish one F6 Markdown report"
```

### Task 6: Update Workbench, CLI, and Export Consumers

**Files:**
- Modify: `the retired F8 server app/src/production-stage-runner.test.ts`
- Modify: `the retired F8 server app/src/production-stage-runner.ts`
- Modify: `the retired F8 server app/src/ta-product-exporter.test.ts`
- Modify: `the retired F8 server app/src/ta-product-exporter.ts`
- Modify if current registration includes optimization Markdown: `the retired F8 server app/src/routes/artifacts.ts`
- Modify if current registration includes optimization Markdown: `the retired F8 server app/src/routes/host-actions.ts`
- Verify: `apps/cli/src/commands/feature6.test.ts`
- Verify: `apps/cli/src/commands/feature6.ts`

**Interfaces:**
- Consumes: current four-file F6 result and historical readable bundles.
- Produces: one user-facing report reference, always `Feature6-Report.md`.

- [ ] **Step 1: Write failing consumer tests**

Assert that production artifact registration and product export do not request or expose `Feature6-Optimization.md`, while preserving optimization JSON as an internal artifact. Assert the report action resolves only the validated final report.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run the retired F8 server app/src/production-stage-runner.test.ts the retired F8 server app/src/ta-product-exporter.test.ts apps/cli/src/commands/feature6.test.ts
```

Expected: FAIL where current export still reads optimization Markdown.

- [ ] **Step 3: Update current consumers**

Remove current optimization Markdown reads and references. Keep historical compatibility behind existing-artifact validation rather than current production registration.

- [ ] **Step 4: Verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add the retired F8 server app/src/production-stage-runner* the retired F8 server app/src/ta-product-exporter* the retired F8 server app/src/routes/artifacts.ts the retired F8 server app/src/routes/host-actions.ts apps/cli/src/commands/feature6*
git commit -m "feat(workbench): expose one final TA report"
```

### Task 7: Add the `/ta-assist-agent` Workspace Skill

**Files:**
- Create: `.github/skills/ta-assist-agent/SKILL.md`
- Modify: `scripts/product-skills.test.mjs`
- Modify: `scripts/agent-triggering-surface.test.mjs`
- Modify only if routing gaps are exposed: `packages/product-language/src/workflow-intent.ts`
- Modify only if routing gaps are exposed: `packages/product-language/src/workflow-intent.test.ts`

**Interfaces:**
- Consumes: existing governed component Skills and workflow intent classifier.
- Produces: one primary user command, `/ta-assist-agent [workbook-path]`.

- [ ] **Step 1: Read the skill authoring requirements**

Read `writing-skills` and the workspace Skill frontmatter reference before creating the file.

- [ ] **Step 2: Write failing trigger tests**

Positive cases include English and Chinese requests for complete TA workbook analysis. Negative cases include generic spreadsheet editing, generic Cpk questions, generic Monte Carlo programming, reviewed-feedback import, measured-data analysis, and unrelated image interpretation. Ambiguous cases must route to clarification rather than execution.

- [ ] **Step 3: Verify RED**

```powershell
npx vitest run scripts/product-skills.test.mjs scripts/agent-triggering-surface.test.mjs packages/product-language/src/workflow-intent.test.ts
```

Expected: FAIL because the `ta-assist-agent` Skill does not exist.

- [ ] **Step 4: Implement the orchestrator Skill**

Use frontmatter:

```yaml
---
name: ta-assist-agent
description: Use when a user wants to run the complete governed TA workbook analysis and produce the final TA Assist Agent engineering report from one .xlsx workbook.
user-invocable: true
argument-hint: "[<ta-workbook-path>]"
---
```

Delegate to the existing governed capability sequence and preserve every confirmation and safety gate. Do not duplicate runner implementation or broaden trigger phrases into generic spreadsheet/statistics work.

- [ ] **Step 5: Verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add .github/skills/ta-assist-agent/SKILL.md scripts/product-skills.test.mjs scripts/agent-triggering-surface.test.mjs packages/product-language/src/workflow-intent*
git commit -m "feat(agent): add TA Assist Agent entry skill"
```

### Task 8: Migrate Branding, README, and English Checks

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `apps/vscode-extension/package.json`
- Modify product-visible strings in: `apps/vscode-extension/src/extension.ts`
- Modify product-visible strings in: `apps/vscode-extension/src/participant.ts`
- Modify corresponding tests under: `apps/vscode-extension/src/*.test.ts`
- Modify: `scripts/verify-repository.test.mjs`
- Modify: `scripts/verify-repository.mjs`
- Consolidate tracked English/Chinese duplicate documentation under: `docs/`

**Interfaces:**
- Produces: product-visible `TA Assist Agent`, root package `ta-assist-agent`, clear English onboarding, and a tracked engineering-asset language gate.

- [ ] **Step 1: Write failing branding and language-gate tests**

Assert root metadata, extension display text, README title and `/ta-assist-agent` onboarding. Add repository-check fixtures proving that CJK in an English engineering file is rejected and CJK in an approved localization catalog or localized fixture is accepted.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run scripts/verify-repository.test.mjs apps/vscode-extension/src/extension.test.ts apps/vscode-extension/src/participant.test.ts
```

Expected: FAIL on legacy naming and missing language enforcement.

- [ ] **Step 3: Update product metadata and README**

Set the root package name to `ta-assist-agent`, preserve `@ai-assist/*` dependency scopes, use `TA Assist Agent` on visible surfaces, and rewrite the root README around one-command onboarding, workflow stages, outputs, safety boundaries, and developer verification.

- [ ] **Step 4: Add the tracked-file English check**

Use `git ls-files` as the source set. Exclude generated outputs, uploads, bundles, and immutable historical artifacts. Permit CJK only in narrowly listed localization catalogs, Chinese user-facing prompts/responses, and their tests. Return exact file and line diagnostics.

- [ ] **Step 5: Consolidate duplicate localized developer docs**

Compare each tracked Chinese duplicate with its English counterpart. Merge unique current facts into English, then delete only the duplicate Chinese developer document. Do not modify immutable report artifacts or user data.

- [ ] **Step 6: Verify GREEN**

```powershell
npx vitest run scripts/verify-repository.test.mjs apps/vscode-extension/src/extension.test.ts apps/vscode-extension/src/participant.test.ts
npm run check:repository
```

Expected: PASS with no disallowed tracked engineering CJK text.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json README.md apps/vscode-extension scripts/verify-repository* docs
git commit -m "refactor(product): rename project to TA Assist Agent"
```

### Task 9: Final Verification and GitHub Repository Rename

**Files:**
- No production edits expected.
- Update documentation only if verified remote details differ from the approved canonical name.

**Interfaces:**
- Verifies: complete local behavior and remote repository identity.
- Produces: canonical GitHub repository `TA-Assist-Agent` and matching local `origin`, or a precise permission blocker.

- [ ] **Step 1: Run focused validation**

```powershell
npx vitest run scripts/f6-final-report.test.mjs scripts/f6-full-flow.test.mjs scripts/f6-output-layout.test.mjs scripts/f6-skill.test.mjs scripts/product-skills.test.mjs scripts/agent-triggering-surface.test.mjs scripts/verify-repository.test.mjs packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.test.ts the retired F8 server app/src/production-stage-runner.test.ts the retired F8 server app/src/ta-product-exporter.test.ts apps/vscode-extension/src
```

Expected: PASS.

- [ ] **Step 2: Run build and governed artifact verification**

```powershell
npm run build -- --force
npm run check:repository
node scripts/verify-current-f6.mjs
```

Expected: all commands exit 0 and current F6 verifies the four-file artifact contract.

- [ ] **Step 3: Inspect final changes**

```powershell
git status --short --branch
git diff --check
git log --oneline --decorate -10
```

Expected: no unintended files, whitespace errors, generated outputs, or user data.

- [ ] **Step 4: Rename and verify the GitHub repository**

```powershell
gh repo rename TA-Assist-Agent --repo MS-AI-in-Product-Making/AI-TVA-Analysis-Agent
git remote set-url origin https://github.com/MS-AI-in-Product-Making/TA-Assist-Agent.git
gh repo view MS-AI-in-Product-Making/TA-Assist-Agent --json name,nameWithOwner,url
git ls-remote --symref origin HEAD
git remote -v
```

Expected: repository name is `TA-Assist-Agent`, remote read succeeds, and both origin URLs use the canonical repository. If authorization fails, stop remote operations, retain the verified local implementation, and report the exact administrator action without claiming remote success.

- [ ] **Step 5: Record verification evidence**

Summarize exact test counts, build status, governed F6 status, branch commits, remote repository result, and any unrelated pre-existing failures.
