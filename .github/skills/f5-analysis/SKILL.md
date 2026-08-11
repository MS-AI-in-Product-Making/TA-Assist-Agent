---
name: f5-analysis
description: "Use when F5, 使用F5分析报告, 使用 F5 分析报告, use F5 analysis report, or F0/F1/F3/F4 TA data interpretation is requested."
user-invocable: true
argument-hint: "[<ta-workbook-path> | <f5-output-dir>]"
---

# F5 Analysis

## Purpose

Produce or present a controlled F5 TA data interpretation while preserving artifact identity, worksheet scope, deterministic calculation evidence, and confidentiality. F5 interprets existing F0/F1/F3/F4 evidence; it does not invent missing evidence or perform F6 work.

## Entry routing

Choose exactly one mode from the supplied path:

- **Entry mode 1 - TA workbook**: the input is a TA workbook. Follow phases W1-W8 in order.
- **Entry mode 2 - Existing F5 artifact**: the input is an F5 output directory or its `Feature5-Report.json`. Follow the existing-artifact protocol only.

Do not silently switch modes. Resolve canonical paths and reject ambiguous, missing, out-of-root, linked-out, or identity-mismatched inputs.

## Entry mode 1 - TA workbook

### Phase W1 - Run F1

Validate the workbook path, preserve it read-only, and run the allowed F1 command. Record the controlled F1 output directory and workbook content hash. Stop if the command fails or its artifacts do not validate.

### Phase W2 - Run F2

Run the allowed F2 command against that F1 output. Strictly validate `Feature2-Report.json`, its workbook identity, source paths, and hashes before continuing.

### Phase W3 - Select ready worksheets

Read only worksheets whose F2 handoff has `status: readyForNextFeature`. Before treating one as F5 ready, require its F1 `imageReference` and referenced physical image to exist and pass the controlled-path, identity, and hash checks. Apply the same fail-closed boundary as F2/F5 when either is missing, even if the F2 handoff says ready: exclude that worksheet from the F5 ready set and do not promise or attempt continuation for it. Never offer blocked, malformed, or F5-ineligible worksheets.

Make a **Worksheet selection call - `vscode_askQuestions` (`multiSelect: true`)** listing only those ready worksheet names. Require at least one worksheet. Preserve the returned names as one exact, unique selected set. If the call is cancelled or returns none, stop before F3, F4, and F5.

No downstream execution may begin before this selection succeeds.

### Phase W4 - Run local F3

Run local F3 once with a repeated worksheet argument for every selected name. F3 is local analysis only. Do not publish to ADO, prompt for an ADO target, write a reminder, or invoke any ADO tool or workflow. Validate that the accepted F3 worksheet set equals the selected set and that workbook, image, source-row, and hash identities still match F1/F2.

### Phase W5 - Run F4 from F2

Run F4 from the validated F2 report. F4 may calculate every F2 ready worksheet because its runner has no worksheet flag. It must contain every selected worksheet exactly once with matching workbook/table identities and accepted calculation results.

When the user selected a subset, extra ready F4 calculations are permitted in the F4 artifact but are outside the F5 scope. The effective F4 worksheet set consumed and presented by F5 must equal the selected set: F5 `--worksheet` filters F4 output back to the selected set. F3 and F5 receive the identical selected worksheet-name set.

### Phase W6 - Optional image observations

Ask whether image evidence should be evaluated. Optional observation availability is distinct from missing required F1 image provenance. Use this routing table exactly:

### Image availability routing

| Condition | Prerequisite | Worksheet routing | F5 continuation | Tolerance result |
| --- | --- | --- | --- | --- |
| F1 physical image or imageReference missing | none | fail_closed; exclude from F5 ready | prohibited; do not promise continuation | not produced |
| Image mode unavailable | verified existing F1 imageReference | remain F5 ready | continue deterministic F5 | not_evaluated + clarification |
| User skips image evaluation | verified existing F1 imageReference | remain F5 ready | continue deterministic F5 | not_evaluated + clarification |
| No observation artifact generated | verified existing F1 imageReference | remain F5 ready | continue deterministic F5 | not_evaluated + clarification |

For each continuing `not_evaluated` case, clarify that tolerance drawing evidence was not evaluated; do not imply that the required F1 image or its reference was absent.

For each selected worksheet, use only the real file referenced by F1 imageReference. Resolve it beneath the controlled F1 root, verify the controlled path and SHA-256 contentHash before viewing, and require `artifact: f1` plus the same worksheet name. Never substitute a screenshot, report rendering, URL, or similarly named file.

Use the current agent image capability to inspect a verified image. Do not claim that a shell command invokes an image model. The model must record only visible evidence and a concise visible basis. Do not record hidden chain-of-thought or inferred unseen geometry.

Write an optional strict JSON artifact only at `test/demo-output/f5-observations/<workbook-content-hash>/<system-generated-uuid>/Feature5-Image-Observations.json`. Do not invent a CLI for image analysis.

- The UUID must be system-generated and must not be user-derived.
- Before creation, lexically normalize the intended parent and require it to remain contained beneath `test/demo-output/f5-observations/<workbook-content-hash>/`; reject absolute resets, traversal, alternate roots, and any other lexical escape.
- Before creation, check every existing ancestor for a reparse point, symlink, or junction.
- If ancestry is unverifiable, do not create the artifact; continue deterministic F5 with `not_evaluated` plus clarification.
- Create the observation artifact with `create_file` only.
- Never edit, overwrite, append to, or reuse an observation artifact or target.
- If the target already exists, fail closed and select a new system-generated UUID directory, then repeat all containment and ancestry checks before a single creation attempt.

- After creation, read back and validate the artifact with `f5ImageObservationArtifactSchema`.
- Readback must exactly match the validated workbook content hash and selected worksheets.
- Each readback `imageReference` must exactly match `relativePath`, `contentHash`, and `worksheetName`, including SHA-256 `contentHash` verification.
- If reread, schema, identity, or hash validation fails, discard the artifact from the F5 invocation and continue deterministic F5 as `not_evaluated`; never repair the file in place.

The artifact contract is:

- Root: `contractVersion`, `inputClassification` = `confidential`, `observationVersion` = `f5-image-observation-v1`, `workbookContentHash`, and nonempty `worksheets`.
- Worksheet: `worksheetName`, exact F1 `imageReference`, and `observations`. Worksheet names are unique and must match their image references.
- Observation: unique `scope`, `observedValue` (`visible`, `not_visible`, or `ambiguous`), `confidence` (`low`, `medium`, or `high`), nonempty `visibleBasis`, `reviewStatus` (`unreviewed`, `confirmed`, or `rejected`), and conditional `confirmedBy` / `confirmedAt`.
- Allowed scopes are `tolerance_loop_closure`, `datum_chain`, `assembly_datum_face`, `stack_start`, `direction`, and `cross_subsystem`.
- `confirmedBy` and `confirmedAt` are required only when `reviewStatus` is `confirmed`; they are forbidden otherwise.

Evidence gates are strict and apply exactly as follows. An image FACT records only what is visibly observed; it is never a dimensional RULE or a final engineering determination.

### Image evidence classification gates

| Classification | FACT | SIGNAL | RULE | Final engineering determination | ME review | Conclusion handling |
| --- | --- | --- | --- | --- | --- | --- |
| high + unreviewed | image FACT only | requiresEngineeringReview | prohibited | prohibited | required | image evidence pending ME review |
| high + confirmed | image FACT only | requiresEngineeringReview | prohibited; never automatic | prohibited | still required | image evidence remains subject to ME review |
| medium | prohibited | at most SIGNAL | prohibited | prohibited | required before promotion | SIGNAL only |
| low | prohibited | prohibited | prohibited | prohibited | not applicable | clarification only |
| rejected | prohibited | prohibited | prohibited | prohibited | not applicable | excluded from conclusions; emit clarification requiring reviewer/new evidence |

Never upgrade confidence or review status to avoid these gates. `confirmed` records reviewer confirmation but does not remove ME review, create a RULE automatically, or authorize a final engineering determination.

### Phase W7 - Run F5 with the same selection

Run the matching allowed F5 worksheet-filtered command with a repeated `--worksheet` argument for every selected name, adding the observation artifact only when Phase W6 created and validated one. The three artifact roots must be the controlled F1, F3, and F4 outputs from this run. Workbook mode always selects at least one worksheet and always passes the exact selected set to F5; never omit the worksheet filter.

### Phase W8 - Validate and present F5

Strictly validate `Feature5-Report.json`, the manifest, run summary, output containment, source identities, worksheet set, classifications, and recorded hashes. Present FACT, RULE, SIGNAL, OPTION, assumptions, and clarifications without promoting one category into another. When a verified F1 image reference exists but image mode is unavailable, the user skips evaluation, or no observation artifact is generated, drawing evidence remains `not_evaluated` with clarification and deterministic F5 results still complete. A missing F1 physical image or `imageReference` is instead fail-closed and produces no F5 result for that worksheet.

## Entry mode 2 - Existing F5 artifact

Resolve the supplied directory or `Feature5-Report.json` under its controlled artifact root, then read `Feature5-Report.json`. Validate the parsed JSON against the `f5DataInterpretationResultSchema` concept before trusting or presenting any field. Its schema semantics must establish `featureId: F5`, confidential output classification, root and worksheet status consistency, exact summary counts, workbook file identity and contentHash, unique worksheet identity, and each completed worksheet calculation's workbook-hash identity. Also validate controlled containment, the manifest/run-summary linkage, recorded report hashes, and sanitized source basenames.

The report is a read-and-validate fast path, but validation remains governed by the repository schema concept. Do not execute node or any other non-whitelisted command to validate it. If the schema cannot be applied conceptually and every required identity and hash cannot be verified with available read capabilities, stop.

If validation succeeds, present the validated report without rerunning F1, F2, F3, F4, or F5. In this mode do not create or repeat image observations. If any contract, path, identity, or hash check fails, stop and report the sanitized reason without presenting untrusted content.

## Allowed commands

- `npm run workflow:f1 -- <ta-workbook-path>`
- `npm run workflow:f2 -- <f1-output-dir>`
- `npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`
- `npm run workflow:f4 -- --f2-report <f2-output-dir>/Feature2-Report.json`
- `npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`
- `npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --image-observations <artifact-path>`

These are the complete workflow command shapes. Do not invoke another workflow command, add an F4 worksheet option, or invent an F0 command. Workbook mode has no unfiltered F5 form: pass at least one repeated worksheet argument, including when every ready worksheet was selected.

## Safety boundaries

- Never request or expose credentials.
- No REST, browser, shell HTTP, curl, or Invoke-WebRequest.
- Never modify the source workbook.
- No implicit ADO access or publishing.
- Do not perform F6 calculation or recommendation.
- Treat all inputs and outputs as confidential.
- Validate path containment, artifact identity, and hashes before use.
- Run commands only in the documented phase order.
- Stop on command failure or validation failure; do not continue with stale, partial, or mismatched artifacts.
- Keep displayed errors and paths sanitized; do not expose workbook contents beyond the requested controlled report.