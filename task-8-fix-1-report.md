# Task 8 Fix Round 1 Report

- Branch: `feat/f6-pdf-report-polish-v2`
- Scope: `packages/product-export/src/f6-pdf-report.ts`, `packages/product-export/src/f6-pdf-export.test.ts`, `apps/workbench-server/src/f6-pdf-report.test.ts`
- Change: replaced both F6 image-panel grid definitions from `60% 40%` to `minmax(0,3fr) minmax(0,2fr)`, added `min-width:0` guards for the grid container and children, and kept `object-fit: contain` unchanged.
- Non-goal: did not change any `MISSING` rendering behavior.

Verification:
- `npx vitest run packages/product-export/src/f6-pdf-export.test.ts apps/workbench-server/src/f6-pdf-report.test.ts --testTimeout 30000`
- `npm run build -- --force`
- Restored generated `packages/contracts/dist/f7-contracts.d.ts`

Result:
- Focused renderer/server tests: pass
- Build: pass
- Working tree: source changes only
