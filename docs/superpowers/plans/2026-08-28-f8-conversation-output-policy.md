# F8 Conversation Context And Output Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send validated F0/F1/F2/F4 Scenario context to the GitHub Chat model and prevent F8 session output from entering Git.

**Architecture:** Build a server-side context envelope from current validated artifacts and lightweight Web selection identity. The extension model receives a sanitized, evidence-labeled prompt; repository policy enforces output exclusion independently of `.gitignore`.

**Tech Stack:** TypeScript, Fastify, Zod, SQLite SessionStore, VS Code Language Model API, Node repository verification

**Spec:** `docs/superpowers/specs/2026-08-28-f8-web-projection-optimization-design.md`

## Global Constraints

- Context artifact IDs must belong to the current Session/input revision/review context.
- The model receives references and structured excerpts, never unrestricted workbook access.
- Model interpretation never mutates governed artifacts.
- `F8-session-output/` is ignored and rejected if tracked.
- Do not commit unless explicitly authorized.

---

### Task 1: Context Envelope Contract

**Files:**
- Modify: `packages/contracts/src/f8-contracts.ts`
- Modify: `packages/contracts/src/f8-contracts.test.ts`

**Interfaces:**
- Produces: `taModelContextEnvelopeSchema` and `TaModelContextEnvelope` with session/revision, worksheet, F0 knowledge items, optional F1 image, F2 factor rows, baseline/scenario metrics, and artifact IDs.

- [ ] Add valid-envelope tests and rejection tests for missing identities, duplicate factors, invalid hashes, and cross-revision references.
- [ ] Run contract tests and verify RED.
- [ ] Implement strict schemas with bounded text/row counts and no filesystem paths.
- [ ] Re-run tests and verify PASS.
- [ ] Review checkpoint.

### Task 2: Server Context Builder

**Files:**
- Create: `apps/workbench-server/src/conversation-context.ts`
- Create: `apps/workbench-server/src/conversation-context.test.ts`
- Modify: `apps/workbench-server/src/routes/conversation.ts`

**Interfaces:**
- Produces: `buildConversationContext(snapshot, selection, artifacts): TaModelContextEnvelope`.

- [ ] Add tests using validated F0 knowledge references, F1 image metadata, current F2 rows, F4 baseline, and saved Scenario.
- [ ] Add rejection tests for stale/cross-session artifact IDs and absent worksheet identity.
- [ ] Run tests and verify RED.
- [ ] Implement bounded extraction using structured parsers and existing artifact hash verification.
- [ ] Replace client-composed prompt context with the server-built envelope.
- [ ] Re-run tests and verify PASS.
- [ ] Review checkpoint.

### Task 3: Evidence-labeled Model Prompt

**Files:**
- Modify: `apps/vscode-extension/src/extension.ts`
- Modify: `apps/vscode-extension/src/participant.ts`
- Modify: `apps/vscode-extension/src/participant.test.ts`
- Modify: `apps/vscode-extension/src/host-action-pump.test.ts`

**Interfaces:**
- Consumes `TaModelContextEnvelope`.
- Produces a prompt with `Governed evidence`, `Open interpretation`, `Missing evidence`, and `Suggested checks` sections.

- [ ] Add prompt snapshot tests asserting F0/F1/F2/F4 identities and explicit interpretation boundaries.
- [ ] Run tests and verify RED.
- [ ] Serialize bounded context without local paths or credentials.
- [ ] Ensure image context remains a managed artifact reference and unsupported image access is reported as missing evidence.
- [ ] Re-run extension tests and verify PASS.
- [ ] Review checkpoint.

### Task 4: English Conversation UI

**Files:**
- Modify: `apps/workbench-web/src/components/TaAssistantPanel.tsx`
- Modify: `apps/workbench-web/src/components/TaAssistantPanel.test.tsx`
- Modify: `apps/workbench-web/src/components/ConversationPane.tsx`

- [ ] Add tests for English suggested prompts, current context summary, pending model state, and evidence labels.
- [ ] Run tests and verify RED.
- [ ] Translate the panel and show concise chips for Knowledge, Loop image, Factor table, Baseline, and Scenario context included in the next request.
- [ ] Re-run tests and verify PASS.
- [ ] Review checkpoint.

### Task 5: Session Output Git Policy

**Files:**
- Modify: `.gitignore`
- Modify: `scripts/verify-repository.mjs`
- Create: `scripts/verify-repository.test.mjs`

**Interfaces:**
- Enforces root and nested `F8-session-output/` exclusion.

- [ ] Add tests creating root/nested output paths and simulating a tracked path list; expect repository verification rejection.
- [ ] Run `npm exec vitest -- run scripts/verify-repository.test.mjs`; verify RED.
- [ ] Add `F8-session-output/` and `**/F8-session-output/` to `.gitignore`.
- [ ] Add case-insensitive normalized-path rejection to repository verification.
- [ ] Run the focused test and `npm run check:repository`; expect PASS.
- [ ] Confirm `git check-ignore -v F8-session-output/probe.json` and nested equivalent identify the explicit rule.
- [ ] Review checkpoint.

### Task 6: End-to-End Acceptance

- [ ] Open a current Session and select a worksheet with F0 recommendation, F1 image, and F4 baseline.
- [ ] Send an open interpretation request and inspect the HostAction prompt envelope.
- [ ] Verify the response distinguishes evidence, interpretation, missing evidence, and checks.
- [ ] Verify no generated output appears in `git status --short`.
- [ ] Run contract, server, extension, Web, and repository verification suites.
- [ ] Review checkpoint.
