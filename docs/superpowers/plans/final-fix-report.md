# Final Fix Report (F3/F5/F6 Report Readability)

## Scope
- Worktree: `C:\Users\xumax\AI Project\AI TVA Analysis\.worktrees\F3-F5-F6-report-readability-optimization`
- Date: 2026-08-19
- Round: final branch fix round

## Findings Closed

### 1) Action-plan grouping key must include suggestedSource
- Change:
  - Updated grouping key in `packages/workbook-catalog/src/f6-composed-report.ts` to include `suggestedSource` in addition to `priority/action/owner/verification`.
- Result:
  - Same action/owner/verification with different sources no longer merge.
- Test:
  - Added test `keeps same action/owner/verification split when suggestedSource differs` in `packages/workbook-catalog/src/f6-composed-report.test.ts`.

### 2) Render non-completed options even when scenarioComparisons exist
- Change:
  - Updated renderer in `scripts/f6-composed-report.mjs` section 11 logic:
    - Keep completed scenarios in comparison table.
    - Additionally render all non-completed options (`candidate`, `insufficient_evidence`, `calculation_failed`) with status/reason/required inputs.
- Result:
  - Mixed-status worksheets preserve completed scenario table and explicitly show uncompleted options.
- Test:
  - Added test `keeps completed scenarios in table and still renders every non-completed option` in `scripts/f6-composed-report.test.mjs`.

### 3) Remove regex source-row extraction from gapId; use explicit map
- Change:
  - Removed regex parsing of `sourceRow` from `gapId` in action-plan derivation.
  - Added explicit `gapId -> sourceRows` metadata map during row-level drawing gap construction.
  - Passed this map into action-plan grouping derivation.
  - Non-row gaps are not assigned source rows.
- Result:
  - No accidental source-row inference from unusual/non-row `gapId` values.
  - Drawing row scopes remain complete via explicit map.
- Test:
  - Added test `never infers source rows from unusual non-row gap IDs and keeps drawing-row scopes complete` in `packages/workbook-catalog/src/f6-composed-report.test.ts`.

## Compatibility and Non-goals
- Preserved canonical `dataGaps` structure and existing contract behavior.
- No workflow/calculation/demo behavior changes.
- No compatibility-breaking schema changes.

## Verification
- Focused tests passed:
  - `npx vitest run --workspace vitest.workspace.ts packages/workbook-catalog/src/f6-composed-report.test.ts scripts/f6-composed-report.test.mjs`
  - Result: `2 passed`, `56 passed`.
- Full test suite passed:
  - `npm test`
  - Result: `102 passed`, `2277 passed`, `4 skipped`.

## Self-review Checklist
- [x] Only requested findings addressed.
- [x] Added targeted tests for each finding.
- [x] No regex-based source-row inference remains in action-plan derivation.
- [x] Mixed-status rendering behavior validated.
- [x] Full repository regression passed.
