---
name: f6-analysis
description: "Use when F6, 使用F6分析报告, 使用 F6 分析报告, use F6 analysis report, or complete governed F0-F6 TA workbook analysis is requested."
user-invocable: true
argument-hint: "[<ta-workbook-path> | <f6-output-dir>]"
---

# F6 Analysis

## Purpose

Run or present the complete governed TA analysis through F6. In workbook mode the agent owns interaction and sequencing while repository workflow commands remain deterministic executors. The user does not assemble commands manually, but must supply the workbook and answer the governed worksheet and optional-evidence questions.

F0 is controlled capability and rule consumption, not a standalone artifact runner. Never invent `workflow:f0`. Record the validated public knowledge base `v1`, internal tolerance guidance `internal-v1`, and interpretation rules `interpretation-rules-v1` as the `F0` output disclosure.

## Entry routing

Choose exactly one mode from the supplied path:

- **Entry mode 1 - TA workbook**: the input is one `.xlsx` TA workbook. Follow W0-W10 in order.
- **Entry mode 2 - Existing F6 artifact**: the input is an F6 output directory or `Feature6-Composed-Report.json`. Follow the existing-artifact protocol only.

If the trigger phrase contains no path, ask for one workbook or one existing F6 artifact path. Do not infer a workbook from editor state, previous runs, similarly named files, or historical artifacts. Resolve canonical paths and reject ambiguous, missing, out-of-root, linked-out, or identity-mismatched inputs.

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

### Phase W4 - Run local F3

Run F3 once with one repeated `--worksheet` argument per downstream worksheet. F3 is local analysis only. Do not publish to ADO, ask for an ADO target, write an ADO reminder, or invoke an ADO tool. `governance_required` is a valid nonfailed result and must remain visible as a governance signal.

Validate the exact worksheet set, workbook hash, image references, table IDs, source rows, and factor identities against F1/F2. The `F3` output is the validated F3 root and `Feature3-Report.json`.

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

### Phase W8 - Collect optional F6 evidence

Ask whether governed supplier capability, datum strategy, or cost evidence should be supplied. Each supplied path must be an existing, contained, non-linked JSON artifact accepted by the corresponding F6 schema and bound to the same workbook and factor identities. Omitted or rejected evidence is not a workflow failure.

Without valid supplier capability or datum strategy evidence, the corresponding options remain `insufficient_evidence`. Without valid cost evidence, ROI remains `not_computed`. Do not promote missing evidence into a recommendation or ROI. Image observations use the immutable copy published by the current F5 run when available.

### Phase W9 - Run and validate F6

Run F6 with the current F2, F3, F4, and F5 roots and one repeated `--worksheet` per downstream worksheet. The base allowed command may append only these controlled optional pairs after the worksheet arguments: `--supplier-capability <artifact-path>`, `--datum-strategy <artifact-path>`, `--cost <artifact-path>`, and `--image-observations <artifact-path>`.

Validate `Feature6-Optimization.json` with `f6OptimizationResultSchema` and `Feature6-Composed-Report.json` with `f6ComposedEngineeringReportSchema`. Validate the run summary, manifest, six-file output set, exact downstream worksheet set, F2 blocked worksheet placement, input provenance hashes, output hashes, option counts, evidence gates, and ROI gates.

The `F6` output is the validated F6 root, optimization JSON/Markdown, composed-report JSON/Markdown, run summary, and manifest.

### Phase W10 - Present every Feature output

Present one concise run ledger containing:

- F0 output: validated controlled versions and no standalone workflow artifact.
- `F1` output: status, root, report, selected worksheet count, and workbook hash.
- `F2` output: status, root, report, ready worksheets, and blocked worksheets with sanitized reasons.
- `F3` output: status, root, report, governance-complete and governance-required counts.
- `F4` output: status, root, calculation/report paths, and accepted downstream calculation count.
- `F5` output: status, root, report paths, image mode (`v2` or `not_evaluated`), and clarification count.
- `F6` output: status, root, six artifact paths, completed/failed/evidence-gated option counts, ROI status, overall report status, and blocked worksheet section.

Do not report a phase as completed until its contract, containment, identity, manifest, and recorded hashes have passed. Keep FACT, RULE, SIGNAL, OPTION, assumptions, clarifications, risks, and evidence-gated options distinct.

## Entry mode 2 - Existing F6 artifact

Resolve the supplied F6 directory or `Feature6-Composed-Report.json` beneath the controlled publish root. Validate the composed report against `f6ComposedEngineeringReportSchema`, the optimization result against `f6OptimizationResultSchema`, and verify the run summary, manifest, six expected files, workbook/worksheet identities, source provenance hashes, output hashes, classifications, blocked worksheet placement, and evidence/ROI gates.

If validation succeeds, present the validated F6 report without rerunning F0, F1, F2, F3, F4, F5, or F6. Do not recreate observations or evidence. If any check fails, stop without presenting untrusted content.

## Allowed commands

- `npm run workflow:f2:excel -- <ta-workbook-path>`
- `npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm`
- `npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`
- `npm run workflow:f4 -- --f2-report <f2-output-dir>/Feature2-Report.json`
- `npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`
- `npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --image-observations <artifact-path>`
- `npm run workflow:f6 -- <f2-output-dir> <f3-output-dir> <f4-output-dir> <f5-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`

The two F2 commands are separate gates and must not be merged, omitted, or reordered. Do not add an F4 worksheet flag. Workbook mode always supplies the exact downstream worksheet set to F3, F5, and F6. Only W9 may append the four documented optional F6 evidence pairs to the final allowed command.

## Safety boundaries

- Never request or expose credentials.
- No REST, browser network, shell HTTP, curl, or Invoke-WebRequest.
- Never modify the source workbook.
- F3 is local analysis only.
- Do not publish to ADO or perform any implicit ADO access.
- Treat all inputs and outputs as confidential.
- Validate canonical containment, linked-path ancestry, artifact identity, contracts, manifests, and hashes before use.
- Run commands only in the documented phase order.
- Stop on command failure or validation failure.
- Do not continue from a historical or partial run.
- Do not silently replace the selected worksheet set, evidence, image, or artifact root.