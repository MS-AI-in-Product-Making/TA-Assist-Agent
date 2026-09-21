# Task 2 Report: Remove Participant and F8 CLI Entry Paths

## Scope delivered

- Removed the CLI `agent` entrypoint and its launcher wiring from `apps/cli/src/index.ts`.
- Removed CLI package/runtime dependencies and TS project references that only existed for the launcher path.
- Deleted `apps/cli/src/commands/agent-launcher.ts`.
- Deleted the entire `apps/vscode-extension/` participant package.
- Removed root scripts that only built or packaged the deleted VS Code extension.
- Updated guard tests so retained F1-F6/F7 surfaces stay present while participant surfaces must stay absent.
- Updated product-language/repository verification lists so deleted participant files are no longer required.

## RED evidence

Test-first guard failure after adding retirement assertions:

```powershell
npx vitest run scripts/f8-retirement.test.mjs --reporter=verbose
```

Observed failures:

- `removes retired participant surface apps/vscode-extension`
- `removes retired participant surface apps/cli/src/commands/agent-launcher.ts`

Both failed because those paths still existed.

Note: the new `apps/cli/src/index.test.ts` retirement assertions were also added first, but on this branch the `executeCli(["agent", ...])` expectation for `command is invalid` did not produce a standalone RED before parser removal. The task’s path-retirement guard provided the concrete failing proof before implementation.

## GREEN evidence

```powershell
npx vitest run apps/cli/src/index.test.ts apps/cli/src/commands/feature6.test.ts apps/cli/src/commands/feature6.security.test.ts scripts/f8-retirement.test.mjs scripts/product-language-surface.test.mjs --reporter=verbose
```

Result:

- `Test Files  5 passed (5)`
- `Tests  97 passed (97)`

Key passing checks:

- retired CLI `agent analyze|resume|status|workbench` entrypoints reject as invalid
- participant paths are absent
- direct F1-F6 and F7 retained-surface guards still pass
- focused Feature 6 CLI/security coverage remains green

## Self-review

- Confirmed no unrelated generated files were added.
- Confirmed retained root workflow scripts (`workflow:f1`…`workflow:f6`, F7 scripts) remain defined.
- Confirmed only participant-specific build/package scripts were removed.
- Confirmed `apps/cli` no longer references the deleted launcher through source, package dependencies, or TS project references.
- Confirmed root TS references no longer include the deleted VS Code extension project.

## Commit

Planned commit message:

`refactor: remove participant entry paths`
