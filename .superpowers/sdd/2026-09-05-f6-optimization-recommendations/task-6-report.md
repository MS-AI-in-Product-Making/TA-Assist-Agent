# Task 6 Report - 强制 Agent turn 保存当前报告引用

## Status
- Completed (GREEN)
- Scope kept to Task 6 target files and tests only.

## What Changed
- `packages/agent-runtime/src/runtime.ts`
  - Added canonical current report selector based on `selectCompleteReviewContext(snapshot)`.
  - Enforced `open_report` action from snapshot-only canonical projection, including model-response and replay paths.
  - Persisted assistant turn `artifact_reference` (`Feature6-Report.md`) and `relatedArtifactIds` when current validated report is eligible.
  - Gated report action/reference on current `inputRevision` + complete review context; stale/unvalidated/mismatch now produce no report link/action.
- `apps/workbench-server/src/routes/host-actions.ts`
  - Added canonical report projection in `vscode_model_request` result write path.
  - Persisted model turn with canonical `artifact_reference`, canonical `open_report` tool action, and `relatedArtifactIds` from snapshot only.
- `packages/agent-runtime/src/runtime.test.ts`
  - Added RED/GREEN tests for deterministic projection, replay with missing stored actions, and incomplete review-context gating.
  - Updated existing fixtures to use complete current review context for report eligibility.
- `apps/workbench-server/src/routes/conversation.test.ts`
  - Added host-action second-write-path test that enforces canonical report projection on `turnId:model`.
  - Extended harness to inject a snapshot fixture for review-context-gated validation.
- `packages/conversation/src/conversation-store.test.ts`
  - Added round-trip persistence test for `artifact_reference` + canonical `open_report` `tool_result`.

## Tests
- RED check command:
  - `npx vitest run packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/routes/conversation.test.ts packages/conversation/src/conversation-store.test.ts`
  - Result: expected failures on newly added Task 6 assertions before implementation.
- GREEN check command:
  - `npx vitest run packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/routes/conversation.test.ts packages/conversation/src/conversation-store.test.ts`
  - Result: `3 passed`, `31 passed`.

## Commit
- `1eebab7`
- Message: `fix(f6): persist canonical final report references`

## Concerns / Residual Risk
- Current Task 6 scope validates runtime + host-action persistence and replay behavior. UI rendering consistency (web pane/main view/vscode clickable entry) is covered by other tasks and should still be verified in integration/e2e for full product acceptance.

## Follow-up (2026-09-05)
- Controller ruling applied: `ConversationStore` remains immutable; no replay mutation of historical turns. This follow-up adds negative coverage only and does not change production replay behavior.
- Added focused negative host-action model-result tests in `apps/workbench-server/src/routes/conversation.test.ts` to prove no `artifact_reference`, no `relatedArtifactIds` for `f6-report:7`, and no `open_report` when report state is invalid:
  - stale revision (`f6_report.revision` older than `inputRevision`)
  - unvalidated report (`validated: false`)
  - incomplete review context (`f6_report.reviewContextId` missing)
  - mismatched review context (`f6_report.reviewContextId` differs from complete context)
- Verification command:
  - `npx vitest run packages/agent-runtime/src/runtime.test.ts apps/workbench-server/src/routes/conversation.test.ts packages/conversation/src/conversation-store.test.ts`
  - Result: `3 passed`, `35 passed`.
- RED outcome:
  - No new RED in follow-up. Coverage-only update; no production code changes required.
