# Chat-to-Web TA Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@ta-assist` natural-language analysis requests create and bind a real Web Session, automatically import an explicitly supplied absolute `.xlsx` path, or wait for Web upload when no path is supplied.

**Architecture:** A deterministic extension-side intent parser extracts an optional path. The CLI creates a real Session before browser launch; workbook bytes travel over bounded launcher IPC into a non-HTTP server host-import API that reuses existing upload validation and session commands.

**Tech Stack:** TypeScript, VS Code Extension API, Node child-process IPC, Fastify server internals, SQLite SessionStore, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-31-chat-to-web-ta-analysis-design.md`

## Global Constraints

- Do not change F0-F7 calculation ownership.
- F8 only orchestrates existing F0-F6 runners, SessionStore, artifacts, and UI projection; do not duplicate business logic.
- Tolerance loop evidence and TA Factor Table are vertically stacked; desktop table content must remain readable without horizontal scrolling.
- Never persist or expose the local workbook path.
- Do not follow symlinks or scan directories.
- Server must re-run existing size, MIME, signature, OOXML, artifact, command, and queue validation.
- No remote ADO or external model side effects during tests.
- Do not commit unless explicitly authorized.

---

### Task 1: Natural-language Analyze Intent

**Files:**
- Create: `apps/vscode-extension/src/analyze-intent.ts`
- Create: `apps/vscode-extension/src/analyze-intent.test.ts`
- Modify: `apps/vscode-extension/src/participant.ts`
- Modify: `apps/vscode-extension/src/participant.test.ts`

**Interfaces:**
- Produces: `parseAnalyzeIntent(text): { kind: "analyze_ta"; workbookPath?: string } | undefined`.

- [ ] Add table-driven tests for Chinese/English requests, quoted/bare Windows absolute paths, spaces, no path, multiple paths, relative paths, URLs, controls, and non-xlsx files.
- [ ] Run focused test and verify RED.
- [ ] Implement deterministic parsing without filesystem access.
- [ ] Route natural-language analyze intent before ordinary active-session conversation handling.
- [ ] Run tests and verify PASS.
- [ ] Review checkpoint.

### Task 2: Session-first Launcher

**Files:**
- Modify: `apps/cli/src/commands/agent-launcher.ts`
- Modify: `apps/cli/src/commands/agent.test.ts`
- Modify: `apps/vscode-extension/src/workbench-launcher.ts`
- Modify: `apps/vscode-extension/src/workbench-launcher.test.ts`
- Modify: `apps/vscode-extension/src/extension.ts`
- Modify: `apps/vscode-extension/src/extension.test.ts`

**Interfaces:**
- Produces: `launchNewWorkbench(...): { sessionId: string; url: string }` for analyze.

- [ ] Add tests proving analyze creates a non-pending Session before launch and the URL binds that Session.
- [ ] Verify RED.
- [ ] Create SessionStore snapshot before starting/resuming the server; issue session-bound bootstrap.
- [ ] Store active Session/URL in extension globalState immediately.
- [ ] Preserve `/resume` and pure workbench behavior.
- [ ] Run CLI/extension tests and verify PASS.
- [ ] Review checkpoint.

### Task 3: Bounded Host Workbook Import

**Files:**
- Create: `apps/vscode-extension/src/workbook-import.ts`
- Create: `apps/vscode-extension/src/workbook-import.test.ts`
- Modify: `apps/vscode-extension/src/workbench-launcher.ts`
- Modify: `apps/cli/src/commands/agent-launcher.ts`
- Modify: `apps/workbench-server/src/server.ts`
- Modify: `apps/workbench-server/src/server.test.ts`

**Interfaces:**
- Extension produces `importWorkbook({ sessionId, workbookPath })`.
- Launcher IPC message carries `{ type: "importWorkbook", requestId, sessionId, fileName, bytes }`.
- Server produces `importHostWorkbook(sessionId, fileName, bytes)` with sanitized receipt.

- [ ] Add negative tests for missing, directory, symlink, non-xlsx, oversized, malformed OOXML, wrong Session, and duplicate requestId.
- [ ] Verify RED.
- [ ] Implement extension physical-path validation and byte-only IPC.
- [ ] Implement server host import by reusing `storeUpload`, artifact authorization, `upload_workbook`, queue enqueue, and session record sync.
- [ ] Ensure receipt/errors contain no local path.
- [ ] Run extension/CLI/server/security tests and verify PASS.
- [ ] Review checkpoint.

### Task 4: Participant Path And No-path Flows

**Files:**
- Modify: `apps/vscode-extension/src/extension.ts`
- Modify: `apps/vscode-extension/src/participant.ts`
- Modify: associated tests

**Interfaces:**
- Consumes intent parser, session-first launcher, and host import.

- [ ] Add path-flow test: create Session, bind, import, open URL, return running response.
- [ ] Add no-path test: create Session, bind, open URL, return upload-required response.
- [ ] Add import-failure test with sanitized actionable response and bound recoverable Session.
- [ ] Verify RED.
- [ ] Implement orchestration and exact English Chat responses from the spec.
- [ ] Verify subsequent ordinary messages use the new active Session without `/resume`.
- [ ] Run extension integration tests and verify PASS.
- [ ] Review checkpoint.

### Task 5: True End-to-End Acceptance

**Files:**
- Create: `test/f8-e2e/chat-entry.spec.ts`
- Modify: `test/f8-e2e/server.mjs` only if deterministic host fixtures are required
- Create: `scripts/verify-chat-entry-e2e.mjs`

**Interfaces:**
- Exercises the production parser, launcher/session store, host import, server queue, Web SSE, and F0-F6 runners.

- [ ] Implement Case A with an explicit absolute workbook path and assert same Session, automatic upload, live progress, and governed artifacts.
- [ ] Implement Case B without path and assert upload UI, then Web multipart upload and same downstream flow.
- [ ] Implement all negative cases without remote side effects.
- [ ] Run deterministic Playwright E2E and verify PASS.
- [ ] Run one real workbook path through the production entry and monitor to terminal business state.
- [ ] Verify persisted Session/artifact hashes and absence of local paths.
- [ ] Run root build and affected regression suites.
- [ ] Final review checkpoint.
