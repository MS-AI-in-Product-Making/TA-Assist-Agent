# F7 Bulk Measurement Import Design

**Date:** 2026-09-15
**Status:** Approved
**Target branch:** `User/Ralf/F7_Bulk_Measurement_Import`
**Selected layout:** A - top-level `Import Data` / `Enter Individually` mode switch

## Goal

Add a worksheet-bound Excel workflow for entering measured values for every confirmed Factor in one operation. Preserve the existing per-Factor measurement workspace and downstream governance. A successful bulk import must appear in the canonical Factor table exactly like successful individual entry: `Source Mode: MEASURED`, `Readiness: Ready`, and `Open workspace` remains available for every Factor.

## Scope

This feature changes four owned surfaces:

- `apps/f7-web`: mode selector, template download/upload, validation review, overwrite confirmation, and canonical status display.
- `apps/f7-local-api`: bounded template, preview, and atomic commit routes tied to the current local session.
- `packages/contracts`: strict template-manifest, preview, diagnostic, and commit DTOs.
- `packages/workbook-catalog`: deterministic XLSX generation and defensive XLSX parsing with cell-level diagnostics.

The feature does not create a second measurement model. It produces the existing `F7MeasurementDataset` for each Factor and uses the existing dataset validation, capability, distribution-fit, disposition, and Monte Carlo paths after commit.

Out of scope are CSV templates, arbitrary spreadsheets, partial commits, remote upload, workbook write-back, multi-worksheet imports, editing Factor specifications in the template, and changing downstream capability or Monte Carlo rules.

## User Experience

The measurement-entry page uses one top-level segmented control:

1. `Import Data`
2. `Enter Individually`

`Import Data` is the default view when no measured datasets exist. It presents `Download template` and `Upload completed template` commands plus the current worksheet identity and Factor count. `Enter Individually` retains the current Source Mode controls and per-Factor workspace.

Switching views changes only the input surface. It never clears, converts, or commits data. The canonical Factor status table remains visible in both views. Existing measured datasets remain available when the user switches modes.

Uploading runs a dry preview and opens an unframed review section. The review reports:

- template and worksheet identity status;
- every Factor, parsed sample count, measurement structure, and readiness result;
- red cell-level blocking diagnostics;
- red cross-zero specification warnings that do not block otherwise valid data;
- which Factors will replace existing measured datasets.

`Confirm import` is enabled only when all current Factors are present and ready. If any dataset will be replaced, the button text and confirmation copy state the replacement count. Canceling or switching views discards the preview and leaves the session unchanged.

After commit, the page reports the imported Factor count and refreshes the existing session snapshot. Each imported row shows `MEASURED`, `Ready`, and `Open workspace` without a separate bulk-import status model.

## Excel Template

The server generates an `.xlsx` only after worksheet selection and Factor Setup confirmation. The visible worksheet is named `Measurements`. One Factor occupies one column; fields occupy rows.

### Locked rows

- Factor Description
- Part Number
- DIM ID
- Design Nominal `|abs|`
- `+ Tol`
- `- Tol`
- Factor LSL
- Factor USL
- Specification Source (`Worksheet` or `Derived`)
- Limit Status (`Valid` or `CROSSES ZERO`)

Part Number and DIM ID are displayed when present and remain blank when absent. They are traceability evidence, not matching keys. Stable Factor IDs are the matching keys.

Factor LSL and USL come from the current confirmed Factor evidence. Explicit controlled worksheet limits take precedence when available; otherwise the existing signed-endpoint normalization derives physical limits. These cells are locked and cannot override the session specification.

### Editable rows

- Measurement Structure: `UNORDERED_SAMPLE`, `ORDERED_INDIVIDUALS`, or `RATIONAL_SUBGROUP`
- Subgroup Size, required only for `RATIONAL_SUBGROUP`
- Estimator, `RANGE_D2` or `S_C4`, required only for `RATIONAL_SUBGROUP`
- Measurement 1 through Measurement 500

The generated default structure is `UNORDERED_SAMPLE`. Bulk import follows the current individual-entry behavior and records MSA status as `unknown`; the template does not introduce a new MSA claim.

Each Factor has exactly 500 reserved measurement cells. Blank cells are ignored and nonblank cells retain their physical Excel row as `originalRow`. For `ORDERED_INDIVIDUALS`, the parser assigns `sequence` values `1..n` in ascending measurement-row order. For `RATIONAL_SUBGROUP`, the parser assigns contiguous nonblank observations to subgroup labels `1..n` in blocks of the selected Subgroup Size. Every subgroup, including the final subgroup, must contain exactly that size; an incomplete group blocks preview. `UNORDERED_SAMPLE` assigns neither sequence nor subgroup. This deterministic mapping avoids adding a second set of per-observation metadata columns.

Any nonblank content below Measurement 500 or outside the defined editable controls is unsupported template content and blocks preview. The 500-observation contract bound therefore applies to both reserved physical cells and parsed observations, not merely to accepted values.

Data validation lists constrain enum cells. Worksheet protection and locked styling prevent accidental edits but are not treated as a security boundary.

### Hidden manifest

A `veryHidden` manifest worksheet contains a versioned strict manifest with:

- template contract ID and version;
- opaque template ID;
- source workbook content hash;
- selected worksheet stable identity;
- confirmed Factor-set digest;
- ordered stable Factor IDs and units;
- expected visible-cell coordinates and immutable-value digests.

The local API retains the authoritative manifest for the active session. Upload validation compares the file against that authority; hidden metadata and worksheet protection are never trusted by themselves. A template from another session, workbook, worksheet, Factor confirmation, or unsupported version is rejected.

All digests use SHA-256 over deterministic length-prefixed UTF-8 fields with an explicit domain and contract version, matching the repository's existing measurement-content hashing style. The Factor-set digest covers ordered Factor ID, unit, confirmed nominal/tolerances, physical LSL/USL, and specification source. The session-state digest covers the template contract version, source workbook hash, selected worksheet identity, Factor-set digest, and the session service's measurement-import revision. Template and preview IDs are generated by the server with a CSPRNG and at least 128 bits of entropy. Every comparison uses server-held session state; no digest supplied by the workbook is authoritative.

## Physical Specifications And Negative Values

Design Nominal keeps its existing signed loop-direction meaning. Template measurements are physical magnitudes and therefore must be finite and greater than or equal to zero.

For a signed Factor interval that crosses zero:

- physical LSL is clamped to `0` by the existing normalization rule;
- physical USL remains the largest absolute endpoint;
- the Factor header, LSL/USL cells, and Limit Status are red in the template;
- the Web preview repeats the red warning and asks the user to review Factor Setup;
- the warning does not block import when all observations are nonnegative and all other readiness checks pass.

For derivation only, let `a = designNominal + lowerTolerance` and `b = designNominal + upperTolerance`, with `a <= b`. If `a <= 0 <= b`, physical limits are `[0, max(|a|, |b|)]`. If both endpoints are nonnegative, they are `[a, b]`. If both are nonpositive, they are `[|b|, |a|]`. Equal physical limits are invalid Factor evidence and prevent template generation. The template, preview validator, and capability flow all consume the same confirmed physical LSL/USL; the bulk parser never independently overrides them.

Any observed value below zero is a blocking `negative_physical_measurement` diagnostic. The diagnostic identifies Factor, Excel cell, row, value, and required minimum. One negative value rejects the complete preview and no session data changes.

Measurements outside a nonzero LSL/USL remain valid observations for capability analysis; they are not silently dropped. The preview may report their count as an engineering warning, while existing capability logic determines the resulting performance.

## Contracts

The shared contracts add strict, bounded schemas for:

- template manifest and Factor manifest entries;
- template download metadata;
- upload-preview request carrying `sessionId`, `.xlsx` file name, and canonical base64 bytes;
- per-Factor preview containing structure, subgroup configuration, sample count, readiness, replacement state, warnings, and a projected `F7MeasurementDataset`;
- cell diagnostic with stable reason code, Factor ID, sheet cell, row number, and bounded display fields;
- preview response with an opaque preview ID, expiry, session-state digest, Factor-set digest, and aggregate replacement count;
- commit request with `sessionId`, preview ID, exact replacement Factor IDs, and `confirmed: true`;
- commit response using the existing analysis-result envelope and updated session snapshot.

Collections use existing F7 Factor limits and the existing maximum of 500 observations per Factor. Schemas reject unknown fields, non-finite numbers, duplicate Factor IDs, duplicate observation rows, invalid structure/configuration combinations, and inconsistent aggregate counts.

The diagnostic reason set distinguishes at least invalid template identity, stale template, changed locked cell, missing/extra/duplicate Factor, invalid enum, missing structure configuration, non-finite measurement, negative physical measurement, sample validation failure, and unsupported workbook content.

`Ready` means the projected dataset passes the existing F7 dataset validator with no blocking issues. A blank Factor column and fewer than 20 observations are blocking. Malformed nonblank XLSX cells are blocking parser diagnostics and are not silently converted into rejected observations. Existing validator advisory issues, a cross-zero warning, and measurements outside LSL/USL remain visible but do not disable confirmation. All current confirmed Factors must be ready in the same preview.

## API And State Flow

The local API adds three session-bound operations:

1. Download a template for the current confirmed worksheet and Factor set.
2. Upload bytes for a dry-run preview.
3. Commit one valid preview after explicit confirmation.

The routes reuse the existing confidential local-workbook classification, canonical base64 decoding, request-size limits, no-store responses, XLSX ZIP defenses, and uniform error envelopes. Template download returns an attachment with a sanitized worksheet-based file name. No network request or remote storage is introduced.

Preview performs these steps without mutating the F7 session:

1. Validate request and XLSX container bounds.
2. Resolve the current session, worksheet, confirmed evidence, units, and Factor set.
3. Validate the hidden manifest and every locked visible value against server authority.
4. Parse editable controls and nonblank measurement cells by stable Factor ID.
5. Build one existing measurement-paste request per Factor with a cell-derived source reference and MSA status `unknown`.
6. Run the existing parser and dataset readiness validation for every Factor.
7. Compute warnings and exact overwrite impact.
8. Store a bounded one-time preview in local API memory and return its opaque ID plus review projection.

A preview expires after 10 minutes, when its measurement-import revision changes, after one commit attempt, or when a newer preview is created for that session. Each session has a monotonically increasing preview generation. Commit atomically claims the current generation before validation; only the first request can change it from `available` to `claimed`, and all concurrent or repeated requests receive a stale/consumed response. The preview registry has a bounded global and per-session capacity. An API restart clears the in-memory registry, so all prior preview IDs become invalid and the user must upload again.

Commit revalidates preview expiry, current session-state digest, current Factor-set digest, and exact replacement consent. `workbook-catalog` owns only generation and typed batch parsing; the local API owns route orchestration and preview storage; `F7SessionService` owns the new atomic batch mutation.

The service mutation is one synchronous compare-and-swap operation over the session record. It receives the expected measurement-import revision, builds a cloned candidate snapshot containing every projected dataset, validates that complete snapshot, and replaces the stored session record exactly once only if the revision still matches. It increments the revision on success. Revision mismatch, candidate validation failure, repeated commit, synchronous exception, or process termination before replacement leaves the old record unchanged; termination after replacement leaves the complete new record. No `await` or externally visible mutation occurs inside the operation. The API never loops through the existing mutating single-Factor route because that could expose partial state.

Changing workbook, worksheet, or confirmed Factor Setup invalidates outstanding templates and previews. Re-uploading the same file creates a new preview; it does not commit automatically.

## Workbook Generation And Parsing

`packages/workbook-catalog` owns pure template generation and parsing functions because it already owns controlled XLSX/OOXML handling. Generation receives only a validated manifest projection and returns bytes. Parsing receives bytes plus the authoritative manifest and returns either a complete typed batch projection or ordered diagnostics.

The parser addresses fixed manifest coordinates rather than searching for display labels. It rejects renamed/deleted required sheets, macros, external links, unsupported embedded content, formula cells in editable measurement areas, changed locked cells, extra Factor columns, duplicate mappings, and content beyond contract bounds. Blank measurement cells are ignored; zero is a valid measurement. The first reserved measurement row is recorded in the versioned manifest, so `Measurement 1`, Excel cell references, and dataset `originalRow` map without inference. Error ordering is deterministic by Factor order and physical cell row.

Formula results are not accepted as measurement input. Dates, booleans, strings that are not canonical numeric cells, Excel error values, NaN, and infinities are blocking diagnostics. The original Excel row is preserved in each resulting observation.

## Error And Recovery Behavior

- Wrong or stale template: block preview and direct the user to download a new template.
- Changed locked identity/specification cell: block the complete preview; do not use the changed value.
- Missing, extra, or duplicate Factor column: block the complete preview.
- Invalid measurement or structure configuration: show all bounded cell diagnostics in one review so the file can be corrected once.
- Existing dataset replacement: require explicit review confirmation; no silent overwrite.
- Session change between preview and commit: reject commit as stale and require a new upload preview.
- Commit validation failure: preserve the previous snapshot and consume the invalid preview.
- Cancel, upload failure, or browser refresh: preserve all previously committed datasets.

The UI uses concise accessible status feedback, moves focus to the review heading after preview, and associates diagnostics with Factor and cell. Red is accompanied by text and an icon; color is never the only warning signal.

## Testing

Implementation follows test-driven development:

1. Contract tests cover strict valid DTOs, all diagnostic reasons, bounds, identity digests, replacement consent, and malformed aggregates.
2. Workbook-catalog tests generate a deterministic representative template, parse valid values for all three structures, and reject tampering, formulas, unsupported content, wrong identity, duplicate/missing Factors, more than 500 values, non-finite cells, and negative values.
3. Physical-limit tests cover positive, negative-loop, and cross-zero signed specifications; cross-zero warns with LSL 0, while any negative observation blocks.
4. Session-service tests prove a valid batch updates every Factor with one revision-checked replacement and every mismatch, validation error, or thrown exception leaves the byte-for-byte prior snapshot unchanged.
5. API tests cover attachment headers, canonical base64 and size bounds, confidential classification, preview expiry/capacity/generation, restart invalidation, concurrent one-time claim, stale-session rejection, exact overwrite consent, and no-store responses.
6. Client/store tests cover exact route mapping, preview lifecycle, cancellation, stale preview clearing, and session refresh.
7. Vue tests cover layout A, keyboard-accessible mode switching, download/upload, complete review projection, replacement copy, disabled confirmation, cross-zero warnings, cell diagnostics, success status, and retained `Open workspace` actions.
8. Regression tests prove existing individual paste, disposition, capability, distribution-fit, Monte Carlo, PDF, and workbook replacement flows are unchanged.
9. Run focused package/app suites, workspace type checks, lint, and the F7 Web production build.
10. Run a real browser flow with a generated template and the representative seven-Factor fixture, then cover overwrite import, cross-zero warning, negative-value rejection, and individual workspace access after commit. Contract and component tests also cover arbitrary valid confirmed Factor counts.

Implementation planning must preserve three independently verifiable stages: contracts plus workbook generation/parsing; session/API preview and atomic commit; Web UI plus end-to-end acceptance. Each stage runs its focused regression checks before the next stage begins.

## Acceptance Criteria

- The user can switch between bulk and individual entry without data loss or state mutation.
- The downloaded `.xlsx` is bound to the current local session, workbook, selected worksheet, and exact confirmed Factor set.
- The visible template has one Factor per column, locked traceability/specification rows, editable structure controls, and up to 500 measurement rows.
- Every Factor exposes physical LSL and USL. A cross-zero specification is visibly warned in red and uses physical LSL 0.
- Any negative physical observation blocks the complete batch and reports the exact Factor and Excel cell.
- Preview performs no mutation and reports every Factor's readiness plus exact overwrite impact.
- Commit requires explicit replacement consent and is all-or-nothing.
- A valid complete import makes every Factor display `MEASURED` and `Ready`, while retaining `Open workspace` and all existing downstream analysis behavior.
- Wrong, stale, tampered, oversized, or unsupported workbooks cannot mutate the session.
- No partial import, remote upload, arbitrary spreadsheet mapping, template-based specification override, or second measurement state model is introduced.
