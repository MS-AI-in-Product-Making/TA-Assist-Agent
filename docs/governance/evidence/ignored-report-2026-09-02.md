# Ignored Report - 2026-09-02

## Scope
- Branch: feat/ta-assist-workbook-beta
- Worktree: .worktrees/ta-assist-workbook-beta

## Executed Checks
- Build: `npm run build` -> PASS
- Server tests: `npx vitest run apps/workbench-server/src/ta-product-exporter.test.ts apps/workbench-server/src/routes/product-export.test.ts packages/contracts/src/ta-product-contracts.test.ts` -> PASS
- F6 tests: `npx vitest run scripts/verify-current-f6.test.mjs scripts/run-f6-full-validation.test.mjs packages/workflow-runners/src/f6.test.ts packages/workflow-runners/src/existing-f6.test.ts` -> PASS
- Diff check: `git diff --check` and `git diff --stat` -> PASS (no whitespace errors)

## Ignored Items
1. Check: `node scripts/verify-current-f6.mjs`
- Result: `{"status":"rejected","reasonCode":"invalid_artifact_entry"}`
- Reason for ignore: this verifier validates an existing governed F6 artifact directory; current worktree has no generated runtime artifact entry to validate.
- Risk assessment: low for code correctness (covered by unit/integration tests), medium for artifact-governance readiness until a real governed run artifact is produced.
- Follow-up: run governed F6 pipeline to produce a real artifact, then re-run `node scripts/verify-current-f6.mjs` as release gate.
