# Task 4 Report - Runtime Skill Facades 与生产编排接入

## Status
- Completed

## Scope Delivered
- Added generic runtime skill facade contract and invocation validation in packages/workbench.
- Added TA workbook orchestrator that routes runnable stages through runtime facades.
- Added server-side TA runtime skill facades that delegate to existing runners:
  - validateF0Capabilities
  - runF1F2Selection
  - runF1F2Confirmed
  - runF3Analysis
  - runF4Calculation
  - runF5Interpretation
  - runF6Optimization
- Routed production execution paths through orchestrator/facade chain:
  - f0_validating
  - f1_f2_running
  - f3_running
  - f4_running
  - f5_running
  - f6_running
- Kept ADO facade as boundary-only (blocked status), no external write protocol change.

## Fixed Skill IDs (11)
1. knowledge-and-rules-validation-v1
2. workbook-scope-discovery-v1
3. workbook-analysis-assets-v1
4. analysis-input-validation-v1
5. dimension-traceability-review-v1
6. ado-governance-publication-v1
7. tolerance-performance-calculation-v1
8. engineering-interpretation-v1
9. improvement-evaluation-v1
10. engineering-summary-report-v1
11. ta-product-export-v1

## TDD Evidence
- RED:
  - npx vitest run packages/workbench/src/runtime-skill-facade.test.ts packages/workbench/src/ta-workbook-orchestrator.test.ts apps/workbench-server/src/ta-runtime-skill-facades.test.ts
  - Failed initially because new facade/orchestrator modules did not exist.
- GREEN:
  - Same focused command now passes.

## Validation Rules Implemented
- inputRevision: must be non-negative integer.
- idempotencyKey: must be non-empty.
- artifact references: non-empty artifactId/kind, non-negative revision, no duplicate artifactId.
- worksheet scope: non-empty workbook hash, non-empty/unique worksheet names.
- stage-specific required artifact kinds enforced at facade entry (e.g., f3 requires f2_report).

## Structured Result Contract
- Facade result statuses are normalized to:
  - completed
  - blocked
  - failed
- No stdout parsing added; output is passed through from deterministic runners.

## Equivalence Proof
- Added explicit parity test in apps/workbench-server/src/ta-runtime-skill-facades.test.ts:
  - facade output is deep-equal to legacy runner fixture output for F4 path.

## Tests Run
- Focused Task 4 tests:
  - pass (6 tests)
- Workflow runners suite:
  - npx vitest run packages/workflow-runners/src
  - pass (12 files, 50 tests)
- Build:
  - npm run build -- --force
  - pass

## Concerns
- analysis-input-validation-v1, engineering-summary-report-v1, ta-product-export-v1, and ado-governance-publication-v1 are boundary facades in this task and intentionally return blocked or delegated behavior; full standalone execution wiring is expected in later tasks.
- Server path currently consumes runtime skill outputs as typed pass-throughs; if future tasks add richer blocked/failed payload contracts, mapping helpers should be centralized to avoid drift.
