---
name: result-interpretation
description: "Use when a user asks to interpret TA calculations, explain risks and drivers, evaluate drawing evidence, or present governed engineering findings."
user-invocable: true
argument-hint: "[<ta-workbook-path> | <interpretation-output-dir>]"
---

# Result Interpretation

Determine the interaction language from the user request that starts the current product workflow. Keep that language locked for the entire workflow, including every response, question, option label, progress update, action description, and final result. Do not re-detect language from confirmation answers, selected option labels, paths, worksheet names, artifact content, quoted text, tool output, or assistant messages. Change the locked language only when the user explicitly requests a language change or starts a new independent product workflow.

Use product capability names only in user-facing questions, progress updates, operation descriptions, and result narratives.

## Purpose

Produce or present a controlled Result Interpretation while preserving artifact identity, worksheet scope, deterministic calculation evidence, and confidentiality. This capability consumes validated Data Parsing, Drawing Governance, and TA Calculation evidence; it does not invent missing evidence or perform Design Optimization work.

## Entry routing

Choose exactly one mode from the supplied path:

- **Entry mode 1 - TA workbook**: the input is a TA workbook. Follow the governed capability sequence in order.
- **Entry mode 2 - Existing interpretation artifact**: the input is a Result Interpretation output directory or its report artifact. Follow the existing-artifact protocol only.

Do not silently switch modes. Resolve canonical paths and reject ambiguous, missing, out-of-root, linked-out, or identity-mismatched inputs.

## Internal executor contract

Machine-literal commands, artifact names, schema names, and reason codes in this section are executor-only and must not be used for user-facing phase/action/result text.

### Entry mode 1 - TA workbook

#### Phase W0 - Validate input and F0 capabilities

Resolve and validate exactly one canonical `.xlsx` workbook path and preserve the source read-only. Confirm that the repository-backed F0 modules required by this flow are available: public knowledge base `v1`, internal tolerance guidance `internal-v1`, and interpretation rules `interpretation-rules-v1`. F0 is consumed through controlled APIs inside F2 and F5; do not invent or run `workflow:f0`.

#### Phase W1 - Generate F1 worksheet selection

Run `npm run workflow:f2:excel -- <ta-workbook-path>`. Require the returned status to be `selectionRequired`, then strictly validate `Feature1-Selection.json`, its controlled run root and manifest, workbook identity, workbook content hash, and unique worksheet options.

Make a **Worksheet Selection scope call - `vscode_askQuestions` (`multiSelect: true`)** listing only the validated prompt options. Require at least one worksheet. If the call is cancelled or returns none, stop without running complete F1 or F2. Preserve the returned names as one exact, unique selected set. No complete F1, F2, F3, F4, or F5 execution may begin before the first selection succeeds.

#### Phase W2 - Confirm and run F1 plus F2

Run `npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm` with the exact selected set and content hash from Phase W1. Strictly validate the completed manifest, controlled F1 and F2 roots, `Feature1-Report.json`, `Feature2-Report.json`, workbook identity, selected worksheet scope, source paths, and hashes. Stop on any command or validation failure; never continue from the selection-only root or another historical run.

#### Phase W3 - Select ready worksheets

Read only worksheets whose validated F2 handoff has `status: readyForNextFeature`. Before treating one as F5 ready, require it to belong to the Phase W1 selection and require its F1 `imageReference` and referenced physical image to exist and pass the controlled-path, identity, and hash checks. W3 already validates each F1 physical image SHA and keeps its verified `imageReference`. For each selected worksheet, use only the real file referenced by F1 imageReference, resolve it beneath the controlled F1 root, and verify the controlled path and SHA-256 contentHash before viewing. Apply the same fail-closed boundary as F2/F5 when either is missing, even if the F2 handoff says ready: exclude that worksheet from the F5 ready set and do not promise or attempt continuation for it. Never offer blocked, malformed, or F5-ineligible worksheets.

Make a **Result Interpretation scope call - `vscode_askQuestions` (`multiSelect: true`)** listing only those ready worksheet names. Require at least one worksheet. Preserve the returned names as one exact, unique selected set. If the call is cancelled or returns none, stop before F3, F4, and F5.

No F3, F4, or F5 execution may begin before the second selection succeeds.

#### Phase W4 - Run local F3

Run local F3 once with a repeated worksheet argument for every selected name. F3 is local analysis only. Do not publish to ADO, prompt for an ADO target, write a reminder, or invoke any ADO tool or workflow. Validate that the accepted F3 worksheet set equals the selected set and that workbook, image, source-row, and hash identities still match F1/F2.

#### Phase W5 - Run F4 from F2

Run F4 from the validated F2 report. F4 may calculate every F2 ready worksheet because its runner has no worksheet flag. It must contain every selected worksheet exactly once with matching workbook/table identities and accepted calculation results.

When the user selected a subset, extra ready F4 calculations are permitted in the F4 artifact but are outside the F5 scope. The effective F4 worksheet set consumed and presented by F5 must equal the selected set: F5 `--worksheet` filters F4 output back to the selected set. F3 and F5 receive the identical selected worksheet-name set.

#### Phase W6 - Optional image observations

Ask whether image evidence should be evaluated. Optional observation availability is distinct from missing required F1 image provenance. Use this routing table exactly:

### Image availability routing

| Condition | Prerequisite | Worksheet routing | F5 continuation | Tolerance result |
| --- | --- | --- | --- | --- |
| F1 physical image or imageReference missing | none | fail_closed; exclude from F5 ready | prohibited; do not promise continuation | not produced |
| Image mode unavailable | verified existing F1 imageReference | remain F5 ready | continue deterministic F5 | not_evaluated + clarification |
| User skips image evaluation | verified existing F1 imageReference | remain F5 ready | continue deterministic F5 | not_evaluated + clarification |
| No observation artifact generated | verified existing F1 imageReference | remain F5 ready | continue deterministic F5 | not_evaluated + clarification |

For each continuing `not_evaluated` case, clarify that tolerance drawing evidence was not evaluated; do not imply that the required F1 image or its reference was absent.

`f5-image-observation-v1` is historical read-only compatibility; new workbook image mode never creates v1. Existing-artifact mode may validate and present a historical v1, but must not migrate, extend, or rewrite it. New image mode creates only `f5-image-observation-v2`.

Before optional image processing, validate the F1/F3/F4 baseline identities, selected worksheet set, table identities, and source rows. A baseline identity mismatch fails closed and prohibits F5 continuation. An image-mode failure is eligible for fallback only after this baseline remains valid.

Follow this order without omission or reordering:

1. **Use every W3-verified selected F1 image.** Preserve each verified F1 `imageReference`, require `artifact: f1` plus the same worksheet name, and never substitute a screenshot, report rendering, URL, or similarly named file.
2. **Construct and validate the all-row context snapshot.** The context snapshot includes ALL active factor rows, not only top contributors. Its exact row set equals the verified F1/F3 selected rows. The snapshot preserves original `partName` and `factorName`, mapped `partSubsystem` and `factorDescription`, `dimensionDescription`, and source provenance. Current mapping requires `partName` to equal `partSubsystem` and `factorName` to equal `factorDescription`. Snapshot `dimensionDescription` equals every governance row `dimensionDescription`, and all governance rows for the worksheet agree. Preserve `tableId`, `sourceRow`, `partCategory`, `nominal`, `upperTolerance`, `lowerTolerance`, `sigmaLevel`, and `sourceCells`; retain missing source values as `null` and do not infer replacements. Require unique `{tableId, sourceRow}` pairs and exact field-by-field agreement with the validated F1/F3 evidence.
3. **Ask exactly five image-mode questions per selected worksheet.** Each selected worksheet answers exactly five questions: `tolerance_loop_closure`, `datum_chain`, `assembly_datum_face`, `stack_start`, and `direction`. Use the current agent image capability with the verified image, complete snapshot, and all five questions. Do not claim that a shell command invokes an image model. The model must record only visible evidence and a concise visible basis. Do not record hidden chain-of-thought or inferred unseen geometry.
	- Use the validated structured Factor rows as the only numeric source; do not OCR, reconstruct, or recalculate Factor values from the image.
	- Compare visible arrow direction and label mapping directly against linked structured Factor descriptions and nominal signs when both sides are explicit.
	- Write each `contextualSignal.textBasis` as a concise user-facing reference interpretation of the visible relationship and its consistency with the linked structured Factor context. Do not infer a Factor link when the visible label mapping is unreliable.
	- Do not state pass/fail, compliance, or capability conclusions unless the validated deterministic evidence contains the required specification.
	- Model-generated reference interpretation may contain hallucinations, label mismatches, or omissions and must be reviewed by ME.
4. **Create one immutable `f5-image-observation-v2` artifact.** Write the optional strict JSON artifact only at `test/demo-output/f5-observations/<workbook-content-hash>/<system-generated-uuid>/Feature5-Image-Observations.json`. Do not invent a CLI for image analysis.
5. **Read back and validate schema, identity, and source rows.** After creation, read back and validate the artifact with `f5ImageObservationArtifactSchema`. Validate the contract version, workbook identity, selected worksheets, images, five scopes, complete snapshots, source provenance, and structured links. W6 readback must exactly match those already verified image references and the v2 snapshot and source identities.
6. **Pass the validated v2 artifact to F5, or discard the whole artifact and use deterministic fallback.** The v2 selected worksheet set must be exact. Any worksheet, scope, or snapshot mismatch discards the entire v2 artifact; partial consumption is prohibited. A missing, unreadable, malformed JSON, unknown, or invalid optional observation artifact uses the same whole-artifact deterministic fallback. When the validated baseline remains valid, continue deterministic F5 with `not_evaluated` plus clarification. Never repair an immutable artifact in place.

Creation controls apply to the entire v2 artifact:

- The UUID must be system-generated and must not be user-derived.
- Before creation, lexically normalize the intended parent and require it to remain contained beneath `test/demo-output/f5-observations/<workbook-content-hash>/`; reject absolute resets, traversal, alternate roots, and any other lexical escape.
- Before creation, check every existing ancestor for a reparse point, symlink, or junction.
- If ancestry is unverifiable, do not create the artifact; continue deterministic F5 with `not_evaluated` plus clarification.
- Create the observation artifact with `create_file` only.
- Never edit, overwrite, append to, or reuse an observation artifact or target.
- If the target already exists, fail closed and select a new system-generated UUID directory, then repeat all containment and ancestry checks before a single creation attempt.
- Readback must exactly match the validated workbook content hash and selected worksheets.
- Each readback `imageReference` must exactly match the W3-verified `relativePath`, `contentHash`, and `worksheetName`; W6 does not independently rehash the physical image or the new observation artifact.
- If reread, schema, identity, source-row, provenance, link, or hash validation fails, discard the entire artifact from the F5 invocation. Do not partially consume it.
- The F5 loader is the authoritative runtime revalidation gate for physical image SHA and content identity when consuming v2.
- No additional shell or hash command is permitted or invented.

The artifact contract is:

- Root: `contractVersion`, `inputClassification` = `confidential`, `observationVersion` = `f5-image-observation-v2`, `workbookContentHash`, and nonempty unique `worksheets` whose exact set equals the selected worksheets.
- Worksheet: `worksheetName`, exact F1 `imageReference`, `contextSnapshot`, and exactly five `observations`. Worksheet names are unique and must match their image references.
- Context snapshot: worksheet `dimensionDescription` plus all selected active rows. Each row contains original `partName` and `factorName`, mapped `partSubsystem` and `factorDescription`, numeric source values, `tableId`, `sourceRow`, and `sourceCells` provenance.
- Observation: unique `scope`, `visualObservation`, and `contextualSignal`.
- `visualObservation`: `observedValue` (`visible`, `not_visible`, or `ambiguous`), `confidence` (`low`, `medium`, or `high`), nonempty `visibleBasis`, unique nonempty `visibleLabels`, `reviewStatus` (`unreviewed`, `confirmed`, or `rejected`), and conditional `confirmedBy` / `confirmedAt`.
- `contextualSignal`: `signalValue` (`indicated_consistent`, `indicated_conflict`, `ambiguous`, or `insufficient_evidence`), nonempty `textBasis`, structured `linkedVisualLabels`, `linkedSourceRows`, and `requiresEngineeringReview: true`.
- Allowed scopes are `tolerance_loop_closure`, `datum_chain`, `assembly_datum_face`, `stack_start`, `direction`, `cross_subsystem`, `non_geometric_variable`, and `long_dimension_chain`.
- A new v2 uses exactly the first five allowed scopes, each exactly once. The remaining scopes are retained for historical v1 compatibility and deterministic clarification handling.
- `confirmedBy` and `confirmedAt` are required only when `reviewStatus` is `confirmed`; they are forbidden otherwise.

`visualObservation` records unique nonempty `visibleLabels` as structured visual evidence; never parse `visibleBasis` to discover labels. `direction` row links require structured `linkedVisualLabels`; never parse `visibleBasis` to infer links. Each direction `linkedVisualLabels` label exists in `visualObservation.visibleLabels`, and direction label/source row key sets align exactly. Non-direction scopes keep `linkedVisualLabels` empty but may link unique snapshot source rows and may use `indicated_consistent` or `indicated_conflict` when evidence permits. Every `linkedSourceRows` item must reference a current snapshot `{tableId, sourceRow}`. With no reliable mapping, `linkedVisualLabels` and `linkedSourceRows` are empty and `signalValue` is `ambiguous` or `insufficient_evidence`.

`visualObservation` may produce only an image `FACT` when the evidence gates permit. The current classification table governs only outputs derived from `visualObservation`. `image_text_context_review` is an independent contextual `SIGNAL` for every core scope. It remains present when visual confidence is low or visual `reviewStatus` is rejected. It always requires ME review and never creates a `FACT`, `RULE`, or final engineering determination. `visibleBasis` describes only labels, arrows, symbols, lines, faces, and visible geometric relationships in the image; worksheet text belongs in `textBasis` and cannot prove a visual FACT.

Each result `image_text_context_review` SIGNAL copies the complete `visualObservation` into self-contained `visualEvidence`, adding the exact worksheet `imageReference`. Preserve `observedValue`, `confidence`, `visibleBasis`, `visibleLabels`, `reviewStatus`, and conditional `confirmedBy` / `confirmedAt`. Result validation uses `visualEvidence.visibleLabels`, never the existence of a visual FACT, for structured direction label links. It also validates confirmation metadata and exact image identity against the containing worksheet. Visual FACT gates do not remove or invalidate the context SIGNAL.

Evidence gates are strict and apply exactly as follows. An image FACT records only what is visibly observed; it is never a dimensional RULE or a final engineering determination.

### Image evidence classification gates

| Classification | FACT | SIGNAL | RULE | Final engineering determination | ME review | Conclusion handling |
| --- | --- | --- | --- | --- | --- | --- |
| high + unreviewed | image FACT only | requiresEngineeringReview | prohibited | prohibited | required | image evidence pending ME review |
| high + confirmed | image FACT only | requiresEngineeringReview | prohibited; never automatic | prohibited | still required | image evidence remains subject to ME review |
| medium | prohibited | at most SIGNAL | prohibited | prohibited | required before promotion | SIGNAL only |
| low | prohibited | visual-derived SIGNAL prohibited; independent context SIGNAL preserved | prohibited | prohibited | context SIGNAL still requires review | clarification plus context SIGNAL |
| rejected | prohibited | visual-derived SIGNAL prohibited; independent context SIGNAL preserved | prohibited | prohibited | context SIGNAL still requires review | excluded from visual conclusions; emit clarification and preserve context SIGNAL |

Never upgrade confidence or review status to avoid these gates. `confirmed` records reviewer confirmation but does not remove ME review, create a RULE automatically, or authorize a final engineering determination.

#### Phase W7 - Run F5 with the same selection

Run the matching allowed F5 worksheet-filtered command with a repeated `--worksheet` argument for every selected name, adding the v2 observation artifact only when Phase W6 created and validated the entire artifact. The three artifact roots must be the controlled F1, F3, and F4 outputs from this run. Workbook mode always selects at least one worksheet and always passes the exact selected set to F5; never omit the worksheet filter.

#### Phase W8 - Validate and present F5

Strictly validate `Feature5-Report.json`, the manifest, run summary, output containment, source identities, worksheet set, classifications, and recorded hashes. The post-run summary records the observation artifact hash. Present FACT, RULE, SIGNAL, OPTION, assumptions, and clarifications without promoting one category into another. For v2 image mode, present the model-generated reference interpretation beside its deterministic Factor evidence and explicitly warn that it may contain hallucinations, label mismatches, or omissions, cannot replace an engineering conclusion, and requires ME review. Before presentation, validate the versions recorded by the F2 and F5 artifacts and present public knowledge base `v1`, internal tolerance guidance `internal-v1`, and interpretation rules `interpretation-rules-v1`. This disclosure records controlled F0 use; it does not imply a separate F0 workflow command. When a verified F1 image reference exists but image mode is unavailable, the user skips evaluation, or no observation artifact is generated, drawing evidence remains `not_evaluated` with clarification and deterministic F5 results still complete. A missing F1 physical image or `imageReference` is instead fail-closed and produces no F5 result for that worksheet.

The user-facing TA interpretation narrative must summarize tolerance-chain and Target understanding, capability results, major contributors and engineering risk, direct image-to-Table anomalies, and required clarifications. Report each `indicated_conflict` prominently as a direct image-to-Table anomaly, preserving `textBasis` and linked Factor names, and label it as requiring ME review. Do not include `datum_chain` or `stack_start` in the user-facing narrative; retain them only in governed internal evidence and the audit appendix.

### Entry mode 2 - Existing F5 artifact

Resolve the supplied directory or `Feature5-Report.json` under its controlled artifact root, then read `Feature5-Report.json`. Validate the parsed JSON against the `f5DataInterpretationResultSchema` concept before trusting or presenting any field. Its schema semantics must establish `featureId: F5`, confidential output classification, root and worksheet status consistency, exact summary counts, workbook file identity and contentHash, unique worksheet identity, and each completed worksheet calculation's workbook-hash identity. Also validate controlled containment, the manifest/run-summary linkage, recorded report hashes, and sanitized source basenames.

The report is a read-and-validate fast path, but validation remains governed by the repository schema concept. Do not execute node or any other non-whitelisted command to validate it. If the schema cannot be applied conceptually and every required identity and hash cannot be verified with available read capabilities, stop.

If validation succeeds, present the validated report without rerunning F1, F2, F3, F4, or F5. In this mode do not create or repeat image observations. If any contract, path, identity, or hash check fails, stop and report the sanitized reason without presenting untrusted content.

### Allowed commands

- `npm run workflow:f2:excel -- <ta-workbook-path>`
- `npm run workflow:f2:excel -- <ta-workbook-path> --worksheets <worksheet-name>[,<worksheet-name>...] --workbook-hash <sha256> --confirm`
- `npm run workflow:f3 -- <f2-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`
- `npm run workflow:f4 -- --f2-report <f2-output-dir>/Feature2-Report.json`
- `npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...]`
- `npm run workflow:f5 -- <f1-output-dir> <f3-output-dir> <f4-output-dir> --worksheet <worksheet-name> [--worksheet <worksheet-name> ...] --image-observations <artifact-path>`

These are the complete workflow command shapes. The first `workflow:f2:excel` command only generates the F1 selection prompt; the second performs confirmed F1 and F2 execution. Do not merge, omit, or reorder them. Do not invoke another workflow command, add an F4 worksheet option, or invent an F0 command. Workbook mode has no unfiltered F5 form: pass at least one repeated worksheet argument, including when every ready worksheet was selected.

### Safety boundaries

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