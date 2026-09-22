# F8 and Participant Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the F8 Workbench runtime and VS Code `@ta-assist` participant while preserving Copilot Skills, direct F1-F6 workflows, and the independent F7 applications.

**Architecture:** Retire consumers before deleting providers. Add repository-level retirement guards, remove participant and F8 launch paths, delete unreachable F8 apps/packages, then update configuration, lockfiles, and active documentation. Keep shared contracts/packages only where surviving F1-F7 imports prove they are required.

**Tech Stack:** TypeScript, Node.js ESM, npm workspaces, Vitest, Playwright, VS Code extension manifest, Markdown

**Spec:** `docs/superpowers/specs/2026-09-21-unified-analysis-workspace-f8-retirement-design.md`

## Global Constraints

- Preserve `.github/skills/ta-assist-agent` and all retained Copilot Skills.
- Preserve direct F1-F6 workflow scripts and non-Workbench CLI commands.
- Preserve `apps/f7-local-api`, `apps/f7-web`, and `packages/f7-*`.
- Do not rename or remove the `@ai-assist/*` npm namespace.
- Delete F8-only historical specs/plans; rewrite active documentation that mentions `@ta-assist`.
- Do not modify the uncommitted F6 report-layout changes already present on the branch.
- Use RED -> GREEN for every behavior change and verify retained F1-F7 surfaces after each deletion boundary.

---

### Task 1: Characterize Retained Product Surfaces

**Files:**
- Create: `scripts/f8-retirement.test.mjs`
- Modify: `scripts/verify-repository.test.mjs`

**Interfaces:**
- Consumes: repository root resolved from `import.meta.url`.
- Produces: tests proving Copilot Skills, direct F1-F6 scripts, and F7 entrypoints remain throughout retirement.

- [ ] **Step 1: Write retained-surface characterization tests**

Create a table-driven test that checks:

```js
const retainedPaths = [
  ".github/skills/ta-assist-agent/SKILL.md",
  "scripts/run-f1-full-validation.mjs",
  "scripts/run-f2-full-validation.mjs",
  "scripts/run-f3-full-validation.mjs",
  "scripts/run-f4-full-validation.mjs",
  "scripts/run-f5-full-validation.mjs",
  "scripts/run-f6-full-validation.mjs",
  "apps/f7-local-api",
  "apps/f7-web",
];
```

Assert every retained path exists. Parse root `package.json` and assert `workflow:f1` through `workflow:f6` plus F7 scripts remain defined.

- [ ] **Step 2: Run the test and establish GREEN**

Run:

```powershell
npx vitest run scripts/f8-retirement.test.mjs --reporter=verbose
```

Expected: PASS against the pre-retirement repository.

- [ ] **Step 3: Add retained paths to repository verification**

Extend `scripts/verify-repository.test.mjs` with the same retained-path assertions so repository cleanup cannot remove Copilot Skills or F1-F7 entrypoints.

- [ ] **Step 4: Run the guards**

```powershell
npx vitest run scripts/f8-retirement.test.mjs scripts/verify-repository.test.mjs --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit the characterization**

```powershell
git add scripts/f8-retirement.test.mjs scripts/verify-repository.test.mjs
git commit -m "test: characterize retained TA entrypoints" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Remove Participant and F8 CLI Entry Paths

**Files:**
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `apps/cli/package.json`
- Delete: `apps/cli/src/commands/agent-launcher.ts`
- Delete: `apps/vscode-extension/`
- Modify: root `package.json`

**Interfaces:**
- Consumes: direct F1-F6 command dispatch already exposed by `apps/cli/src/index.ts`.
- Produces: CLI without `agent analyze|resume|status|workbench`; no VS Code participant package.

- [ ] **Step 1: Write failing CLI assertions**

Update `apps/cli/src/index.test.ts` so:

```ts
expect(() => parseCli(["agent", "analyze"])).toThrow(/unknown command/iu);
expect(() => parseCli(["agent", "resume"])).toThrow(/unknown command/iu);
expect(() => parseCli(["agent", "status"])).toThrow(/unknown command/iu);
expect(() => parseCli(["agent", "workbench"])).toThrow(/unknown command/iu);
```

Keep existing direct Feature/F1-F6 command expectations unchanged.

Extend `scripts/f8-retirement.test.mjs` to require these paths to be absent:

```js
const retiredParticipantPaths = [
  "apps/vscode-extension",
  "apps/cli/src/commands/agent-launcher.ts",
];
```

- [ ] **Step 2: Run CLI tests and verify RED**

```powershell
npx vitest run apps/cli/src/index.test.ts --reporter=verbose
```

Expected: FAIL because the `agent` commands still dispatch.

- [ ] **Step 3: Remove the participant and launcher surfaces**

Remove the `agent` parser/dispatcher branch and `agent-launcher` imports from `apps/cli/src/index.ts`. Remove Workbench dependencies from `apps/cli/package.json`.

Delete `apps/vscode-extension/` because the approved product entry is Copilot Skills plus direct workflows and no non-participant extension function is retained.

Remove root scripts that only build/package the deleted extension:

```json
"build:beta": "...",
"package:vsix": "..."
```

Keep `workflow:f1` through `workflow:f6` and all F7 scripts.

- [ ] **Step 4: Run focused CLI tests**

```powershell
npx vitest run apps/cli/src/index.test.ts apps/cli/src/commands/feature6.test.ts apps/cli/src/commands/feature6.security.test.ts --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -A apps/cli apps/vscode-extension package.json
git commit -m "refactor: remove participant entry paths" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Delete the F8 Runtime Graph

**Files:**
- Delete: `apps/workbench-server/`
- Delete: `apps/workbench-web/`
- Delete: `packages/workbench/`
- Delete: `packages/contracts/src/f8-contracts.ts`
- Delete: `packages/contracts/src/f8-contracts.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Delete: `test/f8-e2e/`
- Delete: `scripts/f8-ado-fixture-contract.test.mjs`
- Delete: `scripts/verify-chat-entry-e2e.mjs`
- Delete: `packages/conversation/`
- Delete: `packages/agent-runtime/`

**Interfaces:**
- Consumes: retirement guards from Task 1.
- Produces: repository runtime graph with no F8 session/workbench contracts.

- [ ] **Step 1: Write failing F8 path guards**

Extend `scripts/f8-retirement.test.mjs` to require these paths to be absent:

```js
const retiredF8Paths = [
  "apps/workbench-server",
  "apps/workbench-web",
  "packages/workbench",
  "packages/conversation",
  "packages/agent-runtime",
  "packages/contracts/src/f8-contracts.ts",
  "test/f8-e2e",
  "scripts/f8-ado-fixture-contract.test.mjs",
  "scripts/verify-chat-entry-e2e.mjs",
];
```

Run:

```powershell
npx vitest run scripts/f8-retirement.test.mjs --reporter=verbose
```

Expected: FAIL because the F8 runtime still exists.

- [ ] **Step 2: Confirm the dependency inventory**

Run:

```powershell
rg -n "@ai-assist/(workbench|workbench-server|conversation|agent-runtime)|f8SessionSnapshotSchema|F8SessionSnapshot|F8Ado|f8PublicSessionCommandSchema" apps packages scripts --glob "*.{ts,tsx,js,mjs,json}"
```

Verify every remaining result is inside a directory listed for deletion in this task. Stop and report a dependency violation if any retained F1-F7 file imports these packages or F8 symbols.

- [ ] **Step 3: Delete F8 providers and fixtures**

Delete the listed F8 applications, Workbench package, F8 contracts/tests, E2E fixtures, and verification scripts. Remove F8 exports from `packages/contracts/src/index.ts`.

Delete `packages/conversation` and `packages/agent-runtime`; the dependency inventory found no retained F1-F7 imports after the F8 consumers are removed. Add both directories to the retirement guard.

- [ ] **Step 4: Run the retirement guard**

```powershell
npx vitest run scripts/f8-retirement.test.mjs scripts/verify-repository.test.mjs --reporter=verbose
```

Expected: the path-removal assertions pass.

- [ ] **Step 5: Build contracts**

```powershell
npx tsc -b packages/contracts --force
```

Expected: PASS with no F8 export references.

- [ ] **Step 6: Commit**

```powershell
git add -A apps/workbench-server apps/workbench-web packages/workbench packages/contracts test/f8-e2e scripts/f8-ado-fixture-contract.test.mjs scripts/verify-chat-entry-e2e.mjs packages/conversation packages/agent-runtime
git commit -m "refactor: retire F8 runtime" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Remove F8 Build and Test Wiring

**Files:**
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Modify: `.github/ci.example.yml`
- Modify: `scripts/verify-repository.mjs`
- Modify: `scripts/verify-repository.test.mjs`

**Interfaces:**
- Consumes: deleted workspaces from Tasks 2-3.
- Produces: package graph and test runners that reference only retained projects.

- [ ] **Step 1: Run configuration guards and verify RED**

```powershell
npx vitest run scripts/f8-retirement.test.mjs scripts/verify-repository.test.mjs scripts/f7-project-wiring.test.mjs --reporter=verbose
```

Expected: FAIL on stale project, script, or workspace references.

- [ ] **Step 2: Remove stale configuration**

Remove deleted project references from `tsconfig.json`, Vitest projects from `vitest.config.ts`, F8 Playwright projects/test directories from `playwright.config.ts`, F8-only root scripts from `package.json`, and F8-only ignored outputs from `.gitignore`.

Update `scripts/verify-repository.mjs` so it no longer expects deleted F8 fixtures while continuing to reject generated runtime/output files.

- [ ] **Step 3: Regenerate dependency metadata**

```powershell
npm install --package-lock-only
```

Confirm the lockfile contains no workspace entries for deleted apps/packages.

- [ ] **Step 4: Run configuration guards**

```powershell
npx vitest run scripts/f8-retirement.test.mjs scripts/verify-repository.test.mjs scripts/f7-project-wiring.test.mjs --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add tsconfig.json vitest.config.ts playwright.config.ts package.json package-lock.json .gitignore .github/ci.example.yml scripts/verify-repository.mjs scripts/verify-repository.test.mjs
git commit -m "build: remove F8 project wiring" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Remove F8 and Participant Documentation

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/01-architecture.md`
- Modify: `docs/02-end-to-end-flow.md`
- Modify: `docs/03-differentiation.md`
- Modify: `docs/04-feature-breakdown.md`
- Modify: `docs/governance/feature-register.md`
- Delete: F8-only files matching `docs/superpowers/specs/2026-*-f8-*.md`
- Delete: F8-only files matching `docs/superpowers/plans/2026-*-f8-*.md`
- Modify: retained specs/plans that describe `@ta-assist` as an active entrypoint

**Interfaces:**
- Consumes: approved product entry choice.
- Produces: active documentation describing Copilot Skills plus direct F1-F7 workflows.

- [ ] **Step 1: Add documentation guard assertions**

Extend `scripts/f8-retirement.test.mjs` to scan active docs and fail on:

```text
@ta-assist
onChatParticipant:ta-assist
F8-session-output
apps/workbench-server
apps/workbench-web
```

Exclude only the approved retirement spec and implementation plan from the literal scan.

- [ ] **Step 2: Run the guard and verify RED**

```powershell
npx vitest run scripts/f8-retirement.test.mjs --reporter=verbose
```

Expected: FAIL on active and historical F8/participant documentation.

- [ ] **Step 3: Delete and rewrite documentation**

Delete F8-only specs/plans. Rewrite active architecture and workflow docs to identify Copilot Skills and direct scripts as the supported entrypoints. Remove participant invocation examples from retained historical documents without changing unrelated F1-F7 engineering content.

- [ ] **Step 4: Run documentation and skill tests**

```powershell
npx vitest run scripts/f8-retirement.test.mjs scripts/ta-assist-agent-skill.test.mjs scripts/f6-skill.test.mjs --reporter=verbose
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -A docs scripts/f8-retirement.test.mjs
git commit -m "docs: retire F8 and participant guidance" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Verify the Retained Product

**Files:**
- Test only; no production edits expected.

**Interfaces:**
- Consumes: repository after Tasks 1-5.
- Produces: evidence that retirement does not break retained functionality.

- [ ] **Step 1: Run focused retained-flow tests**

```powershell
npx vitest run packages/workflow-runners/src/f1-f2.test.ts packages/workflow-runners/src/f3.test.ts packages/workflow-runners/src/f4.test.ts packages/workflow-runners/src/f5.test.ts packages/workflow-runners/src/f6.test.ts apps/cli/src/commands/feature6.test.ts scripts/f7-project-wiring.test.mjs --reporter=verbose
```

- [ ] **Step 2: Run build and repository validation**

```powershell
npm run build
npm run check:repository
```

- [ ] **Step 3: Run the complete surviving test suite**

```powershell
npm test
npm run test:e2e
```

Expected: all configured surviving projects pass with no F8/participant project present.

- [ ] **Step 4: Confirm the branch contains no accidental F6 layout edits in retirement commits**

```powershell
git --no-pager status --short
git --no-pager log --oneline --decorate -8
```

The four pre-existing F6 report-layout files may remain modified but must not be included in retirement commits.
