# F8 Web ADO Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ADO target selection, validation preview, final write confirmation, and receipt visible and operable in the Workbench Web UI while VS Code Extension remains the only Surface MCP host.

**Architecture:** Server exposes a strict browser ADO projection and a CSRF-protected final-confirm route. Validation completion stores a preview but creates no write action until Web authorization; Extension discovers and pumps only existing pending actions.

**Tech Stack:** TypeScript NodeNext, Zod 3, Fastify 5, node:sqlite, React 19, VS Code Extension API, Surface MCP, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-f8-web-ado-acceptance-design.md`

## Global Constraints

- Browser never receives bearer, lease, claim, host instance, or credential data.
- Web final confirmation and target selection are separate user actions.
- Extension is the only Surface MCP execution host.
- No write action exists before Web final authorization.
- Source Workbook remains immutable.
- F7 remains unavailable.

---

### Task 1: Browser ADO contracts

**Files:**
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/contracts/src/contracts.test.ts`

**Interfaces:**
- Produces: `f8AdoProjectionSchema`, `F8AdoProjection`, `f8AdoWriteConfirmationSchema`.

- [ ] Add failing schema tests for selection, validation pending, preview, write pending, receipt, and strict rejection of lease/bearer fields.
- [ ] Run `npm exec vitest -- run packages/contracts/src/contracts.test.ts` and verify failure.
- [ ] Add strict discriminated schemas and exported inferred types.
- [ ] Rerun the contract tests and verify pass.

### Task 2: Store and registry projection support

**Files:**
- Modify: `packages/workbench/src/host-actions.ts`
- Modify: `packages/workbench/src/host-actions.test.ts`
- Modify: `apps/workbench-server/src/server.ts`

**Interfaces:**
- Consumes: existing `HostActionRecord`.
- Produces: session-scoped deterministic reads for validation and write action IDs without exposing claims.

- [ ] Add failing store tests for completed validation result retrieval and absence of write action before authorization.
- [ ] Run the focused host-action tests and verify failure.
- [ ] Add the smallest registry/store methods needed by Server projection and authorization.
- [ ] Rerun focused tests and verify pass.

### Task 3: Server ADO projection and confirmation gate

**Files:**
- Create: `apps/workbench-server/src/routes/ado.ts`
- Modify: `apps/workbench-server/src/routes/host-actions.ts`
- Modify: `apps/workbench-server/src/server.ts`
- Modify: `apps/workbench-server/src/server.test.ts`
- Modify: `apps/workbench-server/src/security.test.ts`

**Interfaces:**
- Produces: `GET /api/sessions/:sessionId/ado` and `POST /api/sessions/:sessionId/ado/confirm`.

- [ ] Add failing route tests showing validation completion exposes preview but creates no write action.
- [ ] Add failing security tests for cross-session read, missing CSRF, stale revision, and hash mismatch.
- [ ] Remove automatic write-action creation from validation result handling.
- [ ] Implement sanitized projection and confirmation route that creates `surface_write` exactly once.
- [ ] Rerun Server/security tests and verify pass.

### Task 4: Web staged ADO experience

**Files:**
- Modify: `apps/workbench-web/src/api.ts`
- Modify: `apps/workbench-web/src/use-session.ts`
- Modify: `apps/workbench-web/src/app.tsx`
- Replace: `apps/workbench-web/src/components/AdoWorkspaceDecision.tsx`
- Modify: `apps/workbench-web/src/components/AdoWorkspaceDecision.test.tsx`
- Modify: `apps/workbench-web/src/components/EngineeringWorkspace.tsx`
- Modify: `apps/workbench-web/src/workbench.css`

**Interfaces:**
- Consumes: `F8AdoProjection`, `WorkbenchApi.readAdoProjection`, `WorkbenchApi.confirmAdoWrite`.
- Produces: staged target, preview, confirmation, pending, receipt, and error UI.

- [ ] Add failing component tests for full existing URL validation, preview rendering, separate confirmation, and receipt.
- [ ] Add failing hook/API tests for polling only during ADO pending and CSRF confirmation.
- [ ] Implement API and session state.
- [ ] Implement the staged panel with complete content and diff, replacing the misleading preparation-only view.
- [ ] Rerun Web tests and verify pass.

### Task 5: Extension automatic pending-action pump

**Files:**
- Modify: `apps/vscode-extension/src/extension.ts`
- Modify: `apps/vscode-extension/src/host-action-pump.ts`
- Modify: `apps/vscode-extension/src/host-action-pump.test.ts`
- Modify: `apps/vscode-extension/package.json`

**Interfaces:**
- Consumes: Server pending executable ADO action discovery.
- Produces: bounded automatic validation/write execution while Extension is active.

- [ ] Add failing tests that discover validation automatically and cannot discover write before Web confirmation.
- [ ] Implement one-at-a-time polling with no automatic retry after terminal failure.
- [ ] Keep the manual command as recovery only.
- [ ] Run Extension tests and typecheck.

### Task 6: End-to-end Web ADO acceptance

**Files:**
- Modify: `test/f8-e2e/engineering-workspace.spec.ts`
- Modify: `.superpowers/sdd/2026-08-26-f8-ta-engineering-workspace-ui/progress.md`

**Interfaces:**
- Consumes: complete Web/Server/Extension ADO flow.
- Produces: reproducible create and existing-mode acceptance evidence.

- [ ] Add a browser E2E with a controlled fake Host executor proving preview-before-confirm and receipt-after-confirm.
- [ ] Run contracts, Server, Web, Extension, and Playwright suites.
- [ ] Build/embed production assets and restart port `63569`.
- [ ] Execute the current session from Web through Surface validation, Web final confirmation, receipt, and F4-F6 progression.
- [ ] Record exact results in the progress ledger and Session Record.
