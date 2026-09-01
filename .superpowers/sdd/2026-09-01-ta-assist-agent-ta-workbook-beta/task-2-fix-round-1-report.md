# Task 2 Fix Round 1 Report

## Scope
- Round: Task 2 fix round 1
- Base HEAD: 599c4b3
- Constraints followed:
  - Kept callback-injection resolver signature unchanged.
  - Kept importWorkbook flow unchanged (selection outputs still route through importWorkbook).
  - Limited changes to Task 2 implementation/tests under apps/vscode-extension.

## TDD Evidence

### RED
Added required tests first, then ran:

```powershell
npx vitest run apps/vscode-extension/src/analyze-intent.test.ts apps/vscode-extension/src/workspace-workbook-resolver.test.ts apps/vscode-extension/src/participant.test.ts apps/vscode-extension/src/extension.test.ts packages/agent-runtime/src/intents.test.ts
```

Observed failing tests before fix:
- `parseAnalyzeIntent` incorrectly classified these as new analyze intents:
  - `继续分析当前 session 的 report.xlsx`
  - `当前分析为什么被阻塞 report.xlsx`
- `workspace-workbook-resolver` glob escape assertion failed for `report[1]{a}*?,.xlsx`.

### GREEN
Implemented minimal fixes and reran same suite: all passed (5 files, 43 tests).

## Implemented Changes

1. Session-first intent precedence hardening
- File: `apps/vscode-extension/src/analyze-intent.ts`
- Change: apply `SESSION_FIRST_INTENT_PATTERN` before new analyze routing when input is not malformed and carries at most one absolute path or one exact workbook filename.
- Outcome: explicit session operations do not create new analyze sessions even with embedded absolute path or bare workbook filename.

2. Exact glob segment escaping cleanup
- File: `apps/vscode-extension/src/workspace-workbook-resolver.ts`
- Change: replaced chained `replaceAll` with single-pass character escaping to avoid double-escaping brackets.
- Outcome: special filenames (e.g., `report[1]{a}*?,.xlsx`) produce exact escaped glob patterns and resolve correctly.

3. Added required tests
- `apps/vscode-extension/src/analyze-intent.test.ts`
  - Added explicit session-operation precedence tests including the three required prompts.
- `apps/vscode-extension/src/extension.test.ts`
  - Added Quick Pick cancel path: no import, no extra session creation.
  - Added Open Dialog cancel path: no import.
  - Added Open Dialog non-xlsx selected URI path: still routes through `importWorkbook` and returns safe rejection text.
- `apps/vscode-extension/src/workspace-workbook-resolver.test.ts`
  - Added multi-root duplicate exact-name ambiguity test.
  - Added glob-special filename escaping and unique resolution test.

## Verification

Executed:

```powershell
npx vitest run apps/vscode-extension/src/analyze-intent.test.ts apps/vscode-extension/src/workspace-workbook-resolver.test.ts apps/vscode-extension/src/participant.test.ts apps/vscode-extension/src/extension.test.ts packages/agent-runtime/src/intents.test.ts
npm run build
git diff --check
```

Results:
- Tests: pass (5 files, 43 tests).
- Build: pass (`tsc -b`).
- `git diff --check`: clean.

## Changed Files
- `apps/vscode-extension/src/analyze-intent.ts`
- `apps/vscode-extension/src/workspace-workbook-resolver.ts`
- `apps/vscode-extension/src/analyze-intent.test.ts`
- `apps/vscode-extension/src/workspace-workbook-resolver.test.ts`
- `apps/vscode-extension/src/extension.test.ts`
