---
name: design-optimization
description: Use when a user asks for a complete governed TA analysis, design improvement options, optimization targets, or a final engineering report.
user-invocable: true
argument-hint: "[<ta-workbook-path> | <optimization-output-dir>]"
---

# Design Optimization

Use the language of the user's current request for every response, question, progress update, and action description.

## Purpose

Run or present the complete governed TA optimization flow as a single product capability. In workbook mode, this skill owns the end-to-end orchestration and all confirmations. In existing-artifact mode, this skill validates and presents the governed optimization output without rerunning upstream work.

This skill must keep deterministic execution behavior unchanged while ensuring user-facing planning, questions, progress updates, operation descriptions, and results use product capability language only.

## Entry routing

Choose exactly one mode from the supplied path:

- Entry mode 1 - TA workbook: the input is one `.xlsx` TA workbook.
- Entry mode 2 - Existing optimization artifact: the input is one optimization output directory or optimization JSON artifact.

If no path is supplied, ask for exactly one workbook path or one existing optimization artifact path. Do not infer paths from editor state, historical runs, similarly named files, or partial artifacts.

## Agent planning

Plan and communicate using product capability names only:

1. Knowledge Library: confirm required controlled knowledge versions are available.
2. Data Parsing: complete workbook path and worksheet-selection governance with the first worksheet confirmation.
3. Data Cleaning: validate selected scope and build ready downstream worksheet candidates.
4. Drawing Governance: execute current-run drawing governance analysis and, when required, run the optional ADO publishing gate.
5. TA Calculation: execute governed calculation for the confirmed downstream scope.
6. Result Interpretation: optionally collect image observations, then execute and validate interpreted outputs.
7. Design Optimization: collect optional Analysis Context and optional Optimization Targets through two independent confirmations, run optimization, and validate final outputs.
8. Feedback Application: present final governed output ledger and preserve required decision and evidence disclosures.

Workbook mode must preserve two worksheet gates, optional ADO publishing gate behavior, optional image-observation behavior, independent Analysis Context and Optimization Targets confirmations, built-in top-contributor policy behavior, and final output disposition reporting.

## Internal executor contract

The remainder of this document is machine-facing execution contract text. Literal commands, artifact names, schema identifiers, policy IDs, and reason codes in this section must not be copied into user-facing plan, question, progress, action description, or result text.

## Entry mode 1 - TA workbook

### Phase W0 - Validate workbook and F0 capabilities

Resolve exactly one canonical `.xlsx` path, verify that it is a regular non-linked file, and preserve it read-only. Confirm the repository-backed F0 modules required by the flow: public knowledge base `v1`, internal tolerance guidance `internal-v1`, and interpretation rules `interpretation-rules-v1`. Stop if a required controlled version is unavailable.

### Phase W1 - Generate F1 worksheet selection

Run the selection-only F2 Excel command. Require `selectionRequired`, then validate `Feature1-Selection.json`, the controlled run root and manifest, workbook identity, workbook content hash, and unique worksheet options.

Make an **F1/F2 scope call** with `vscode_askQuestions` (`multiSelect: true`) listing only validated worksheet options. Require at least one worksheet and preserve the result as an exact, unique set. Cancellation or an empty response stops the run.

No complete F1, F2, F3, F4, F5, or F6 execution may begin before the first selection succeeds.

### Phase W2 - Confirm and run F1 plus F2

Run the confirmed F2 Excel command with exactly the first selection and the W1 workbook hash. Validate the completed manifest, controlled F1 and F2 roots, `Feature1-Report.json`, `Feature2-Report.json`, workbook identity, selected worksheet scope, source paths, and hashes. Never continue from the selection-only root.

The `F1` output is the validated F1 root and report. The `F2` output is the validated F2 root and report, including ready and blocked worksheet handoffs.

### Phase W3 - Select ready downstream worksheets

Build the eligible set only from W1-selected F2 handoffs with `status: readyForNextFeature`. For each candidate require a valid F1 `imageReference`, a contained physical image, matching worksheet identity, and matching SHA-256. Exclude blocked, malformed, missing-image, and identity-mismatched worksheets.

Make an **F3/F4/F5/F6 scope call** with `vscode_askQuestions` (`multiSelect: true`) listing only eligible worksheet names. Require at least one worksheet and preserve the result as an exact, unique downstream set. Cancellation or an empty response stops the run.

No F3, F4, F5, or F6 execution may begin before the second selection succeeds. The exact downstream worksheet set is reused by F3, F5, and F6.

### Phase W4 - Run and validate current F3

F6 workbook mode must execute F3 for the current confirmed run once with `npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`, using one repeated `--worksheet` argument per downstream worksheet. Never reuse a historical F3 root, an F3 root supplied by the user, or an output selected from another run. The deterministic F3 repository runner remains local and network-free.

Read and validate the newly generated `Feature3-Report.json` before any publishing decision. Validate the exact worksheet set, workbook hash, image references, table IDs, source rows, and factor identities against the current F1/F2 artifacts. `governance_required` is a valid nonfailed analysis result and must remain visible as a governance signal. The `F3` output is the validated current-run F3 root and report.

Only `governance_required` enters W4A. A completed F3 skips W4A and proceeds directly to W5. Any failed, malformed, identity-mismatched, historical, or unvalidated F3 result stops the run.

### Phase W4A - Govern optional F3 ADO publishing

This phase is an optional external side effect after the current F3 analysis has passed validation. Never publish automatically or implicitly.

REQUIRED SUB-SKILL: Use drawing-governance.

Follow the drawing-governance ADO publishing protocol with identical controls: organization/project/target validation, deterministic preview, explicit mode choice, separate final write confirmation, single write, and single readback verification.

Make F3 `Question call 1` with exactly these choices:

- `Create a new ADO work item`
- `Use an existing ADO work item`
- `Do not publish to ADO`

Surface MCP entity calls may start only after Question call 1 selects a publishing mode. The `Do not publish to ADO` branch records the F3 `not_requested` local fallback and proceeds to W5. Create and existing modes must use organization/project/target validation, capability gate, complete deterministic preview, and a separate `Question call 2` with the exact `Confirm write` choice. Credentials, tokens, verification codes, and MFA responses never pass through chat or tool arguments.

After `Confirm write`, use only the qualified Surface MCP channel, write exactly once, then read back exactly once and verify the complete body and hash. Authentication failure, unavailable capability, unsupported comment body, user-declined write, or write verification failure must use the corresponding governed F3 local fallback with no retry. W4A outcome does not change the validated F3 analysis result or its worksheet scope; after the protocol records a terminal `not_requested`, `updated`, `blocked`, or `failed` publishing outcome, continue deterministic analysis at W5. An invalid or unverifiable local fallback artifact stops the run.

### Phase W5 - Run F4

Run F4 from the W2 `Feature2-Report.json`. Validate that every downstream worksheet has exactly one accepted F4 calculation with matching workbook and table identity. F4 may calculate extra F2-ready worksheets because its runner has no worksheet filter; extras remain outside downstream scope.

The `F4` output is the validated F4 root, `Feature4-Calculation.json`, report, run summary, and manifest.

### Phase W6 - Evaluate optional F5 v2 image evidence

Ask whether to evaluate the already verified F1 images. If the user skips, image capability is unavailable, or no valid observation artifact can be created, continue deterministic F5 with `not_evaluated` and clarifications. A missing F1 image or image reference is different: that worksheet was excluded in W3 and cannot continue.

For image mode, inspect only each W3-verified physical image and use all active factor rows, not only top contributors. Keep visible image FACTs separate from contextual SIGNALs. Evaluate exactly these five core scopes per worksheet: `tolerance_loop_closure`, `datum_chain`, `assembly_datum_face`, `stack_start`, and `direction`. Do not infer unseen geometry, Drawing Number, DIM ID, datum identity, or label-to-row mappings.

New image mode creates only `f5-image-observation-v2`; v1 is historical read-only compatibility. Create one immutable artifact beneath `test/demo-output/f5-observations/<workbook-content-hash>/<system-generated-uuid>/Feature5-Image-Observations.json`. Validate lexical containment and every existing ancestor before creation. Never edit, overwrite, append to, repair, or reuse an observation target. Read back with `f5ImageObservationArtifactSchema` and require exact workbook hash, downstream worksheet set, image references, all-row snapshots, source rows, and five scopes. Any mismatch discards the whole optional artifact and uses deterministic fallback.

### Phase W7 - Run and validate F5

Run F5 with the current F1, F3, and F4 roots and one repeated `--worksheet` per downstream worksheet. Add `--image-observations` only for a W6 artifact that passed readback validation. Require F5 to publish the observation copy when v2 was accepted; reject an unexpected `enhanced_observation_rejected` fallback in image mode.

Validate `Feature5-Report.json`, run summary, manifest, output containment, source identities, worksheet set, classifications, and recorded hashes. The `F5` output is the validated F5 root and all published F5 artifacts.

### Phase W8A - Collect optional TA Analysis Context

Collect at most one optional `f6-analysis-context-v1` artifact. Require an existing, contained, non-linked JSON file accepted by the current schema and bound to the same workbook and selected worksheet identities. Invalid input is `REJECTED`; absent input is `NOT_PROVIDED`. Do not infer a context artifact from workbook prose, images, historical runs, or free-form chat.

For a valid supplied artifact, show a complete sanitized preview and make a dedicated `vscode_askQuestions` call with the exact affirmative choice `Confirm analysis context`. Record confirmation as `CALLER_AUTHORIZED`; record a declined confirmation as `DECLINED`. Declined analysis context omits `--analysis-context` and continues with explicit context gaps.

### Phase W8B - Collect optional Optimization Targets

Collect at most one optional `f6-optimization-targets-v1` artifact after W8A is terminal. Require an existing, contained, non-linked JSON file accepted by the current schema and bound to the same baseline workbook, worksheet, factor, unit, and calculation identities. Invalid input is `REJECTED`; absent input is `NOT_PROVIDED`.

For a valid supplied artifact, show every target, policy, selected factor, value, ratio, and unit in a complete sanitized preview. Make a second dedicated `vscode_askQuestions` call with the exact affirmative choice `Confirm optimization targets`. Record confirmation as `CALLER_AUTHORIZED`; record a declined confirmation as `DECLINED`. Declined optimization targets omit `--optimization-targets`; caller-target options remain unavailable.

W8A and W8B use two separate `vscode_askQuestions` calls. Neither call may be merged with the other, and each must not be combined with the F3 ADO confirmation. Caller-target optimization scenarios may not be generated before target confirmation. Only caller-authorized targets may create caller-target quantified scenarios.

The sole no-target exception is the versioned built-in policy `f6-top3-tolerance-policy-v1`. For a worksheet where `CpkL` or `CpkU` is below that worksheet's recorded Target Cpk, F6 automatically freezes the baseline Top 3 variance contributors and runs exactly these F4-backed options: `OP1` = Top 1 tolerance band reduced 25% and Top 2/3 reduced 10%; `OP2` = Top 1 reduced 20% and Top 2/3 reduced 15%; `OP3` = Top 1 reduced 40% and Top 2/3 reduced 5%. The policy preserves each tolerance-band center, does not change specifications, and records policy, factor, ratio, baseline, and scenario calculation provenance. A worksheet whose `CpkL` and `CpkU` both meet Target Cpk receives no built-in option. No other automatic percentage scenario is permitted.

Preserve each optional input decision as `CALLER_AUTHORIZED`, `DECLINED`, `REJECTED`, or `NOT_PROVIDED` in Optimization, run summary, manifest, and the final ledger. Built-in policy execution does not change the Optimization Targets input decision.

### Phase W9 - Run and validate F6

Run F6 with the current F2, F3, F4, and F5 roots and one repeated `--worksheet` per downstream worksheet. Append `--analysis-context <artifact-path>` only after W8A caller authorization and `--optimization-targets <artifact-path>` only after W8B caller authorization. The loader may also consume the current F5 immutable image observation copy and governed supplier, datum, or cost evidence when already supplied by the controlled workflow.

Validate `Feature6-Optimization.json` as `f6-optimization-v2` with `f6OptimizationResultSchema` and validate the hash-bound `Feature6-Report.md` only through the recorded SHA-256 before presentation. Validate the run summary, manifest, five-file output set, exact downstream worksheet set, F2 blocked worksheet placement, input decisions, input provenance hashes, output hashes, option counts, evidence gates, ROI gates, built-in policy IDs/ratios/side-Cpk trigger/F4 scenario references, and `reportSummary`. Require Optimization worksheet names to be a unique subset of `reportSummary` worksheet names. Any `reportSummary` worksheet not present in Optimization is blocked `FAIL`; reportSummary extras with any other disposition are blocked FAIL. The exact full report scope comes from the validated run summary and manifest, not from Optimization alone. Reject current-entry v1 artifacts as unsupported rather than converting or presenting them. Never parse Markdown to derive disposition.

The `F6` output is the validated F6 root, optimization JSON/Markdown, final report Markdown, run summary, and manifest.

### Phase W10 - Present every Feature output

Present one concise run ledger containing:

- F0 output: validated controlled versions and no standalone workflow artifact.
- `F1` output: status, root, report, selected worksheet count, and workbook hash.
- `F2` output: status, root, report, ready worksheets, and blocked worksheets with sanitized reasons.
- `F3` output: status, root, report, governance-complete and governance-required counts, plus the optional ADO publishing outcome and sanitized work item reference when one was validated.
- `F4` output: status, root, calculation/report paths, and accepted downstream calculation count.
- `F5` output: status, root, report paths, image mode (`v2` or `not_evaluated`), and clarification count.
- `F6` output: status, root, five artifact paths, Context/Targets decision outcomes and controlled hashes, candidate/completed/failed option counts, four-state report status (`PASS`, `CONDITIONAL_PASS`, `FAIL`, or `INCOMPLETE`), and blocked worksheet section.

Do not report a phase as completed until its contract, containment, identity, manifest, and recorded hashes have passed. Keep FACT, RULE, SIGNAL, OPTION, assumptions, clarifications, risks, and evidence-gated options distinct.

## Entry mode 2 - Existing F6 artifact

Resolve the supplied F6 directory or `Feature6-Optimization.json` beneath the controlled publish root. Validate exactly the five-file artifact set: `Feature6-Report.md`, `Feature6-Optimization.json`, `Feature6-Optimization.md`, `Feature6-Run-Summary.json`, and `manifest.json`. Validate `Feature6-Optimization.json` against `f6OptimizationResultSchema`, then verify the manifest artifact map, the required run-summary and manifest input decision ledgers, the three recorded content hashes, workbook/worksheet identities, exact source provenance basename/hash bindings, classifications, blocked worksheet placement, evidence/ROI gates, and `reportSummary` consistency.

The `reportSummary.worksheetDispositions` entries must use unique worksheet names and use only `PASS`, `CONDITIONAL_PASS`, `INCOMPLETE`, or `FAIL`. Optimization worksheet names must be a unique subset of reportSummary worksheet names. Any reportSummary worksheet not present in Optimization is blocked FAIL; reportSummary extras with any other disposition are blocked FAIL. The exact full report scope comes from the validated run summary and manifest, not from Optimization alone. Compute the expected workbook disposition by calling the exported Task 3 `worstDisposition` policy on those worksheet dispositions; do not duplicate the ranking table in the existing-artifact validator. If `reportSummary.workbookDisposition` differs, reject with `report_summary_invalid`. If any of the three recorded content hashes differs from the actual artifact bytes, reject with `artifact_hash_mismatch`. Never parse `Feature6-Report.md` to derive disposition; present it only after its SHA-256 has been verified.

If validation succeeds, present the validated F6 report without rerunning F0, F1, F2, F3, F4, F5, or F6. Do not recreate observations or evidence. If any check fails, stop without presenting untrusted content.

## Allowed commands

- `npm run workflow:f2:excel -- <ta-workbook-path>`
- `npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm`
- `npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`
- `npm run workflow:f4 -- --f2-report <f2-output-dir>/Feature2-Report.json`
- `npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`
- `npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --image-observations <artifact-path>`
- `npm run workflow:f6 -- <f2-output-dir> <f3-output-dir> <f4-output-dir> <f5-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] [--analysis-context <artifact-path>] [--optimization-targets <artifact-path>]`

The two F2 commands are separate gates and must not be merged, omitted, or reordered. Do not add an F4 worksheet flag. Workbook mode always supplies the exact downstream worksheet set to F3, F5, and F6. Only W9 may append the two documented, separately authorized V2 input pairs to the final allowed command.

W4A does not add F3 ADO commands to this local runner list. When W4A is entered, use drawing-governance as the required sub-skill authority for local reminder commands and Surface MCP operations. F6 must not invent, duplicate, or broaden that allowlist.

## Safety boundaries

- Never request or expose credentials.
- No REST, browser network, shell HTTP, curl, or Invoke-WebRequest for ADO.
- Never modify the source workbook.
- F3 and F6 repository runners remain deterministic and network-free.
- Never publish automatically or implicitly; optional ADO publishing is available only through W4A and the required drawing-governance protocol.
- Treat all inputs and outputs as confidential.
- Validate canonical containment, linked-path ancestry, artifact identity, contracts, manifests, and hashes before use.
- Run commands only in the documented phase order.
- Stop on command failure or validation failure.
- Do not continue from a historical or partial run.
- Do not silently replace the selected worksheet set, evidence, image, or artifact root.