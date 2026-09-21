# Unified Analysis Workspace and F8 Retirement Design

**Date:** 2026-09-21

## Goal

Make each complete F1-F6 TA analysis publish into one user-visible folder under `test`, consolidate stage artifacts into six clearly named folders, retire F8 and the VS Code `@ta-assist` participant, and preserve the governed F1-F7 execution order, validation, and failure behavior.

## Scope

This design covers:

- New F1-F6 analysis output allocation and publication.
- F1-F6 stage-folder naming and artifact consolidation.
- Duplicate analysis-folder allocation.
- Analysis lifecycle and failure summaries.
- Read-only compatibility for existing `test/demo-output` artifacts.
- Removal of F8 runtime, tests, documentation, and package wiring.
- Removal of the VS Code `@ta-assist` participant and extension surface.
- Retention of Copilot Skills, direct F1-F6 workflows, and the independent F7 workflow.

This design does not:

- Change F1-F7 engineering calculations, governance rules, or stage order.
- Migrate or rewrite historical `test/demo-output` artifacts.
- Merge F7 measured analysis into the F1-F6 analysis workspace.
- Rename the `@ai-assist/*` npm workspace namespace.
- Change the F6 report layout work already present on the implementation branch.

## User-Visible Output Contract

### Analysis Root

A complete F1-F6 analysis creates exactly one root folder:

```text
test\<YYYYMMDD - validated workbook basename[-N]>\
```

Rules:

1. `YYYYMMDD` uses the user's local calendar date at allocation time.
2. The workbook basename comes from the validated workbook filename with only the final case-insensitive `.xlsx` suffix removed.
3. Existing Windows-safe filename validation remains authoritative. Invalid or reserved names fail explicitly.
4. The allocator first attempts the unsuffixed name.
5. If it exists, the allocator tries `-1`, `-2`, and so on.
6. Allocation uses exclusive directory creation so concurrent analyses cannot select the same root.
7. One allocated root represents one analysis attempt, including a failed attempt.

Example:

```text
test\
├─ 20260921 - Maera_gap_TP_brkt_and _battery_20260305V1 - test\
└─ 20260921 - Maera_gap_TP_brkt_and _battery_20260305V1 - test -1\
```

### Fixed Stage Folders

Every allocated analysis root contains these six stage folders and no timestamp or UUID run folder beneath them:

```text
01 - F1 Data Parsing\
02 - F2 Data Cleaning\
03 - F3 Drawing Governance\
04 - F4 Calculation Engine\
05 - F5 Result Interpretation\
06 - F6 Design Optimization\
```

Semantic evidence folders such as `sheets`, `images`, or `evidence` remain allowed where the stage contract requires them. Generic run-id, timestamp, hash, or UUID directory layers are not allowed in new workspace writes.

## Analysis Workspace Contract

Introduce a versioned `analysis-workspace-v1` contract shared by the full-flow coordinator and F1-F6 runners.

The contract contains:

- Workspace version.
- Canonical analysis root.
- Validated workbook filename and content hash.
- Local allocation date.
- The six canonical stage paths as analysis-root-relative paths.
- Current workflow stage.
- Per-stage status.
- Per-stage governed artifact references.
- Overall status: `in_progress`, `completed`, or `failed`.
- Safe failure category and failed stage when applicable.

The contract must reject:

- Absolute stage paths.
- Traversal or paths escaping the analysis root.
- Duplicate or renamed stage folders.
- Workbook identity changes after allocation.
- A stage marked complete without its required validated artifacts.
- Successful downstream stages when an upstream stage is incomplete.

## Workspace Lifecycle

### Allocation

The full F1-F6 workflow allocates the analysis root before F1 starts. It creates the six fixed stage directories and an initial `analysis-run-summary.json`.

Low-level stage runners continue to accept explicit governed artifact roots for tests and historical validation. New complete workflow writes must use the workspace contract and may not fall back to `test/demo-output`.

### Stage Progress

The coordinator passes canonical workspace paths to each runner. Runners do not infer a prior artifact path from folder names such as `f2-runs` or `f4-runs`.

After a stage validates and atomically publishes its outputs, the coordinator atomically replaces `analysis-run-summary.json` with the completed stage receipt and advances the current stage.

### Failure

On failure:

- Keep the analysis root.
- Keep all previously validated and published stage artifacts.
- Do not create success-shaped artifacts for the failed or later stages.
- Atomically update `analysis-run-summary.json` with `status: "failed"`, the failed stage, and a repository-standard safe error category.
- Do not include secrets, raw exception dumps, or confidential workbook content in the summary.

### Completion

The workspace is complete only after the F6 Markdown and PDF reports, hashes, run summary, and manifest pass their existing publication gates. The root summary then records `status: "completed"`.

## Stage Artifact Organization

### 01 - F1 Data Parsing

Contains:

- Worksheet-selection registry.
- Complete parsed workbook JSON.
- Per-worksheet controlled parsing output.
- Tolerance-path image assets and related F1 evidence.

The files currently placed at `test/demo-output` root or under nested F1 run folders move into this stage.

### 02 - F2 Data Cleaning

Contains:

- F2 Data Cleaning report JSON and Markdown.
- Required-input validation results.
- Governed F2 handoff artifacts.

New writes no longer create `f2-runs`.

### 03 - F3 Drawing Governance

Contains:

- F3 Drawing Governance JSON and Markdown reports.
- Drawing Number and DIM ID evidence.
- Optional governed ADO reminder, receipt, or history artifacts.

New writes no longer create `feature3-output`.

### 04 - F4 Calculation Engine

Contains:

- F4 Calculation Engine results.
- Calculation comparison/report artifacts.
- Manifest and integrity metadata.

Existing F2/F3 association, workbook hash, worksheet identity, and atomic publication checks remain unchanged.

New writes no longer create `f4-runs`.

### 05 - F5 Result Interpretation

Contains:

- F5 Result Interpretation report artifacts.
- Controlled image observations.
- F5 evidence and manifest artifacts.

The current `f5-runs` and `f5-observations` roots are consolidated into this stage.

### 06 - F6 Design Optimization

Contains:

- Controlled model interpretation and model response evidence.
- Feature6 optimization JSON.
- Dynamically named final Markdown report.
- Dynamically named final PDF report.
- F6 run summary.
- F6 manifest.

The current `f6-model-interpretations`, `f6-model-responses`, and `f6-runs` roots are consolidated into this stage.

The existing F6 five-file governed publication set remains authoritative. Supporting interpretation evidence does not become part of that five-file set and must remain clearly separated by semantic filename or an `evidence` folder.

## Data Flow and Ordering

The required order remains:

```text
F1 Data Parsing
  -> F2 Data Cleaning
  -> F3 Drawing Governance
  -> F4 Calculation Engine
  -> F5 Result Interpretation
  -> F6 Design Optimization
```

The workspace contract changes path discovery only. It does not change:

- Worksheet confirmation gates.
- Workbook read-only handling.
- F2 required-input validation.
- F3 drawing and DIM governance.
- F4 calculation or capability logic.
- F5 interpretation governance.
- F6 optimization, report, PDF, or ADO governance.

Each downstream stage consumes the exact upstream artifact references recorded in the workspace summary and validates the existing hashes and identities.

## Historical Compatibility

Existing artifacts under `test/demo-output` remain read-only.

Requirements:

- Do not migrate, rename, delete, or rewrite historical artifacts.
- Preserve validators needed to inspect supported historical artifact-set versions.
- New full-flow writes must never create new `test/demo-output/f2-runs`, `feature3-output`, `f4-runs`, `f5-runs`, `f5-observations`, `f6-model-interpretations`, `f6-model-responses`, or `f6-runs` directories.
- Tests must distinguish historical-read fixtures from current-write expectations.

## F8 Retirement

### Remove

Remove the active F8 product surface:

- Workbench Web application.
- Workbench Server application.
- F8 session, store, projection, and public-command runtime.
- F8-only contracts and exports.
- F8 E2E tests, fixtures, and verification scripts.
- F8-generated output conventions such as `F8-session-output`.
- F8-only specs, plans, and current product documentation.
- Package, workspace, CI, test-runner, and repository-check wiring that exists only for F8.

Shared packages must be deleted only after the dependency graph proves no retained F1-F7 code imports them. If a package contains both shared and F8-only code, remove the F8 surface surgically and retain the shared code.

## `@ta-assist` Participant Retirement

Remove:

- VS Code `chatParticipants` contribution.
- `onChatParticipant:ta-assist` activation.
- `vscode.chat.createChatParticipant("ta-assist", ...)`.
- Participant routing, classification, tests, and participant-only commands.
- VS Code extension packaging and bootstrap if no non-participant function remains.
- CLI `agent analyze`, `agent resume`, `agent status`, and `agent workbench` launcher paths that exist only to start or control F8.

Retain:

- `.github/skills/ta-assist-agent` and other Copilot Skills.
- Direct F1-F6 workflow scripts and their non-Workbench CLI commands.
- F7 Local API, F7 Web, F7 simulation/statistics packages, and F7 workflow.
- The `@ai-assist/*` npm package namespace.

Current documentation must describe Copilot Skills plus governed workflow scripts as the supported F1-F6 entry path. Retained historical documents must not instruct users to invoke `@ta-assist`. F8-only historical specs and plans are deleted rather than rewritten.

## Package and Repository Cleanup

After deletion:

- Remove deleted workspaces from TypeScript project references and build configuration.
- Remove root scripts such as extension packaging or Workbench development commands when no retained target uses them.
- Remove dependencies that become unreachable.
- Regenerate lockfile and built declarations only through repository-standard tools.
- Remove F8/participant test projects from Vitest and Playwright configuration.
- Update architecture, end-to-end flow, feature breakdown, feature register, README, and CI examples.
- Keep F7 development scripts and dependencies intact.

## Safety and Error Handling

- All new path joins must be containment-checked against the allocated analysis root.
- Use exclusive creation for analysis-root allocation.
- Do not silently select a different workbook or reuse an existing analysis root.
- Do not copy artifacts after publication as a consolidation mechanism.
- Preserve stage-level temp-file plus rename publication.
- Preserve F6 staging, manifest-last, Markdown/PDF hash binding, and `%PDF-` validation.
- Surface invalid workspace state as explicit repository-standard errors.
- Never return a successful analysis result when the workspace summary is failed or incomplete.

## Testing Strategy

### Workspace Unit Tests

- Local-date `YYYYMMDD` formatting.
- Valid workbook basename derivation.
- Windows reserved-name and traversal rejection.
- Unsuffixed first allocation.
- Sequential `-1`, `-2` collision allocation.
- Concurrent exclusive-allocation behavior.
- Exact six stage names.
- No timestamp/UUID stage run directory.
- Workspace schema containment and ordering.
- Atomic status-summary updates.

### Stage Integration Tests

- F1 writes only to `01 - F1 Data Parsing`.
- F2 writes only to `02 - F2 Data Cleaning`.
- F3 writes only to `03 - F3 Drawing Governance`.
- F4 writes only to `04 - F4 Calculation Engine`.
- F5 writes only to `05 - F5 Result Interpretation`.
- F6 writes only to `06 - F6 Design Optimization`.
- Existing identity, hash, manifest, PDF, and fail-closed assertions remain.
- A failed stage preserves completed predecessors and produces a failed root summary.
- A complete run creates one analysis root and no new legacy output roots.

### Compatibility Tests

- Supported historical `test/demo-output` fixtures remain readable.
- Historical artifact-set versions remain read-only.
- Current-write tests reject legacy path allocation.

### Retirement Tests

- No runtime import or package dependency references F8 contracts, Workbench runtime, or the participant.
- No manifest registers `@ta-assist`.
- No retained CLI command launches F8.
- No active documentation instructs users to invoke F8 or `@ta-assist`.
- Copilot Skill validation passes.
- F1-F6 builds and tests pass.
- F7 builds, tests, and development entry validation pass.
- Repository checks pass with deleted workspaces and fixtures.

## Acceptance Criteria

1. One complete F1-F6 analysis creates exactly one root folder under `test`.
2. The root name follows local-date plus validated workbook basename and deterministic numeric collision suffixes.
3. The root contains the six approved code-plus-description stage folders.
4. New writes create no legacy run-root directories.
5. F1-F6 stage order and engineering behavior are unchanged.
6. A failed run remains traceable without success-shaped downstream output.
7. Historical `test/demo-output` artifacts remain unchanged and readable.
8. F8 runtime, tests, package wiring, and F8-only documentation are removed.
9. The VS Code `@ta-assist` participant and participant-only launcher paths are removed.
10. Copilot Skills, direct F1-F6 workflows, and independent F7 workflows remain operational.
