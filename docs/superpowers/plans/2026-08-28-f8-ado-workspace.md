# F8 ADO Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the F3 ADO Reminder section the single place to inspect grouped governance rows and create or update an Azure DevOps work item with a compatible previewed payload.

**Architecture:** Derive one ADO view/payload model from the validated F3 report. Reuse existing HostAction validation, confirmation, and write boundaries; Web never receives credentials.

**Tech Stack:** React 19, TypeScript, Fastify, Zod, existing Surface MCP adapter and HostAction store

**Spec:** `docs/superpowers/specs/2026-08-28-f8-web-projection-optimization-design.md`

## Global Constraints

- F3 ADO Reminder is the only content source.
- Create and update share one deterministic formatter.
- Preview bytes equal HostAction `nextContent` bytes.
- No ADO write occurs without explicit final confirmation.
- Do not commit unless explicitly authorized.

---

### Task 1: Canonical ADO Markdown Formatter

**Files:**
- Create: `packages/workflow-runners/src/f3-ado-markdown.ts`
- Create: `packages/workflow-runners/src/f3-ado-markdown.test.ts`
- Modify: `packages/workflow-runners/src/f3.ts`
- Modify: `packages/workflow-runners/src/index.ts`

**Interfaces:**
- Produces: `renderF3AdoMarkdown(report): { markdown, groups, contentHash }`.

- [ ] Add golden tests for Part/Subsystem grouping, pipes, backslashes, multiline cells, missing fields, and deterministic order.
- [ ] Assert output uses only headings, simple tables, and `<br>` cell breaks.
- [ ] Add an over-limit test that returns a typed validation error without truncation.
- [ ] Run tests and verify RED.
- [ ] Implement formatter and route existing reminder rendering through it.
- [ ] Re-run tests and verify PASS.
- [ ] Review checkpoint.

### Task 2: Unified ADO Section

**Files:**
- Modify: `apps/workbench-web/src/components/F3Governance.tsx`
- Create: `apps/workbench-web/src/components/F3Governance.test.tsx`
- Modify: `apps/workbench-web/src/components/AdoWorkspaceDecision.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`
- Modify: `apps/workbench-web/src/styles.css`

**Interfaces:**
- Produces one `AdoWorkspace` containing grouped rows, target mode, validation, preview, confirm, and result.

- [ ] Test grouped row counts and exact agreement with F3 report rows.
- [ ] Test Local only, Create work item, and Update existing work item controls appear only in this section.
- [ ] Run tests and verify RED.
- [ ] Merge the current modal/decision UI into F3Governance and remove ADO controls elsewhere.
- [ ] Add preview and target validation states without nesting cards.
- [ ] Re-run tests and verify PASS.
- [ ] Review checkpoint.

### Task 3: Server Preview And Confirmation Identity

**Files:**
- Modify: `apps/workbench-server/src/routes/ado.ts`
- Modify: `apps/workbench-server/src/server.ts`
- Modify: `apps/workbench-server/src/server.test.ts`
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/contracts/src/f8-contracts.test.ts`

**Interfaces:**
- Produces preview response `{ target, markdown, contentHash, expectedRevision }` and confirmation requiring the same hash.

- [ ] Add route tests proving preview source is the current validated F3 artifact and stale revisions/hashes are rejected.
- [ ] Run tests and verify RED.
- [ ] Use `renderF3AdoMarkdown` for both create and update prepare requests.
- [ ] Require final confirmation hash to match preview exactly before creating the Surface write HostAction.
- [ ] Re-run contract/server tests and verify PASS.
- [ ] Review checkpoint.

### Task 4: Surface MCP Compatibility

**Files:**
- Modify: `apps/vscode-extension/src/surface-host-client.ts`
- Modify: `apps/vscode-extension/src/surface-host-client.test.ts`
- Modify: `apps/vscode-extension/src/host-action-pump.test.ts`

**Interfaces:**
- Consumes canonical Markdown and existing create/update prepare request.

- [ ] Add adapter tests for create and update preserving headings, table rows, escaped cells, and content hash.
- [ ] Run tests and verify RED where behavior is missing.
- [ ] Keep credentials and tool invocation inside the extension host; return only sanitized receipt fields.
- [ ] Verify blocked capability, target mismatch, and duplicate result behavior remain fail-closed.
- [ ] Run extension, server, workflow-runner, and contract focused suites.
- [ ] Review checkpoint.

### Task 5: Browser Acceptance

- [ ] Run a real F3 session and compare every Web group/row with `Feature3-ADO-Reminder.md`.
- [ ] Preview Create and Update payloads and compare hashes.
- [ ] Stop before remote write unless the user explicitly confirms a test work item.
- [ ] Verify all ADO text is English and no ADO controls remain outside the section.
- [ ] Review checkpoint.
