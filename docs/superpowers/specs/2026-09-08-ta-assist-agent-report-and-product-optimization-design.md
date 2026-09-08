# TA Assist Agent Report and Product Optimization Design

Date: 2026-09-08
Status: Approved
Working branch: `issue/106-ux-agent-triggering`

## 1. Context

The current governed workflow already produces an F6 v3 engineering report, a structured optimization artifact, and a validated multimodal interpretation. However, the final user report is incomplete compared with the accepted historical report presentation: its image link can resolve outside the final report directory, its Factor table omits governed fields, blocked worksheet findings are too generic, statistical results are incomplete, and optimization details remain split across two Markdown files.

The product also exposes multiple entry points and legacy names. New users should start the complete workflow with one project Skill, while implementation assets should use English consistently and user-facing content should continue to follow the session language.

## 2. Goals

1. Publish one complete user-facing Markdown report containing workbook overview, exact worksheet findings, tolerance-path images, complete Factor data, multimodal interpretation, statistical results, F0 guidance, and optimization recommendations.
2. Preserve deterministic calculation authority, source traceability, artifact hashes, and historical artifact compatibility.
3. Make `/ta-assist-agent` the single documented entry for other users.
4. Rename the product and repository to **TA Assist Agent** and `TA-Assist-Agent`.
5. Migrate tracked engineering assets to English while preserving localized Chinese and English product experiences.

## 3. Non-Goals

1. Do not change the F4 calculation formulas or recalculate governed numeric results in the report renderer or model.
2. Do not write recommendations back to the source workbook.
3. Do not remove provenance from internal JSON, run summaries, manifests, audit records, or validators.
4. Do not rename the existing internal `@ai-assist/*` npm package scope in this project.
5. Do not rewrite generated output, uploaded workbooks, untracked temporary files, or historical immutable artifacts.

## 4. User-Facing Report

### 4.1 Document Overview

Rename section 1 to `Document Overview`. Preserve these values:

- Source Workbook
- Workbook Revision
- Selected Worksheet Count
- Ready / Blocked Worksheet Count
- Report Generated At
- Reviewed By

The table must not contain a Source or Evidence column.

### 4.2 Workbook Summary

Preserve the worksheet summary with Worksheet, Tolerance Loop Description, Key Finding, and Disposition. The table must not contain a Source or Evidence column.

Blocked findings must identify the exact problem instead of displaying a generic message. Diagnostics are projected from validated F2 data and include, where applicable:

- source row and user-facing field name for every missing required Factor value;
- invalid row-level tolerance, safety-factor, sigma-level, or calculation input;
- missing, empty, unsupported, or unparsed tolerance-path image;
- missing or ambiguous response-summary requirement and its user-facing field name;
- Drawing Number and DIM ID governance reminders, explicitly distinguished from calculation blockers.

Examples:

- `Row 18: Design Nominal is missing.`
- `Rows 15 and 17: Sigma Level is invalid.`
- `Tolerance path image is missing.`

### 4.3 Worksheet Sections

Use governed worksheet order and continuous numbering: `3-1`, `3-2`, and so on. Each completed worksheet contains the following sections:

1. Tolerance Path Image
2. Complete Factor Table
3. Image and Factor Table Context Interpretation
4. Requirements and Statistical Results
5. F0 Capability and Knowledge Guidance
6. Adjusted Mean to Spec Center Shift
7. Contributor Priorities
8. Specification Changes

Blocked worksheets remain visible in the workbook summary and receive an evidence-only blocker section. They never receive fabricated calculation or model output.

### 4.4 Tolerance Path Image

The final report link must be calculated relative to the final report directory, not copied from an upstream report. Before publication, the workflow must resolve the target canonically beneath the controlled publish root, verify that it is a regular non-linked supported image, and verify its recorded SHA-256. A missing or invalid target blocks final report publication for that selected worksheet.

### 4.5 Complete Factor Table

Render every active Factor exactly once and preserve governed worksheet order. Join F2, F4, multimodal, capability-library, and knowledge-library data by worksheet, table ID, source row, and Factor ordinal. Reject missing, duplicate, extra, or mismatched Factors.

The table contains:

- Factor Ordinal (`A/B/C/...` or `1/2/3/...` as supplied by the workbook)
- Row
- Factor Description
- Part Name
- Drawing Number
- DIM ID
- Part Category
- Design Nominal
- + Tolerance
- - Tolerance
- Long Term/Safety Factor
- Sigma Level
- Distribution
- Mean
- Tolerance
- One Sigma
- % Contribution to Sigma
- Notes
- Capability Library Result
- Knowledge Library Recommendation

The report does not infer missing Drawing Numbers, DIM IDs, ordinals, or engineering values. Missing nonblocking identifiers are displayed explicitly.

### 4.6 Multimodal Context Interpretation

The model receives one isolated request per worksheet containing the validated image bytes, all active Factor rows, exact ordinals, deterministic system results, and caller-authorized Analysis Context. It must explain visible labels, arrows, dimension-chain direction, Factor mapping, and whether visible directions agree with Factor descriptions and nominal signs.

The model must not recalculate WC, RSS, Cp, Cpk, Yield, DPM, Factor values, or specifications. Output must distinguish visible facts, contextual signals, deterministic results, and required ME review. Missing, duplicate, or extra ordinal mappings invalidate the interpretation and block final report publication.

### 4.7 Requirements and Statistical Results

Display all of the following without Source or Evidence columns:

- Design Nominal, LSL, USL, Target Cpk, and Evaluation Level;
- statistical lower/upper range and minimum margin;
- worst-case lower/upper range and minimum margin;
- Predictive Cp, CpkL, CpkU, and Cpk with status;
- Predicted Yield and DPM;
- Mean Response, Mean Shift, and RSS One Sigma;
- complete contributor ranking with Rank, Factor, One Sigma, and Variance Contribution.

Values come only from the validated F4 calculation and shared governed formatter.

### 4.8 F0 Capability and Knowledge Guidance

Add a standalone per-Factor table in the statistical area with:

- Factor
- Capability Library Result
- Recommended Tolerance Band or Range
- Recommended Distribution
- Knowledge Recommendation

The same capability result and knowledge recommendation remain visible in the complete Factor table. Missing controlled guidance is shown as `N/A` or information-insufficient. Guidance is not presented as measured manufacturing capability and is never written back to the workbook.

### 4.9 Adjusted Mean to Spec Center Shift

Rename `Center Assessment` to `Adjusted Mean to Spec Center Shift`. Display:

$$
\text{offset}=\text{adjusted mean}-\frac{LSL+USL}{2}
$$

Display adjusted mean, specification center, and offset with exactly three digits after the decimal point and the governed unit. If the offset is nonzero at governed comparison precision, remind the user to optimize Factor nominal values. The model may explain which Factors warrant review but may not invent replacement nominal values.

### 4.10 Contributor Priorities

Display every contributor from the governed ranking with Rank, Factor, One Sigma, Variance Contribution, Priority, and qualitative Guidance. Explicitly tell the user to focus tolerance-range review on the first three priorities. Do not restore legacy fixed-percentage OP1/OP2/OP3 scenarios.

### 4.11 Specification Changes

Preserve the current F6 v3 specification-change capability and approval semantics. Any proposed limit remains a requirement change, requires engineering approval, does not claim manufacturing improvement, and does not modify the workbook.

## 5. F6 Publication Contract

New F6 runs publish exactly four files atomically:

1. `Feature6-Report.md` as the only user-facing Markdown report;
2. `Feature6-Optimization.json` as the governed structured optimization artifact;
3. `Feature6-Run-Summary.json` as the structured disposition and decision ledger;
4. `manifest.json` as the manifest-last integrity record.

Stop generating `Feature6-Optimization.md`. The final report absorbs its user-relevant content. Workbench, CLI, export, artifact registration, and validators expose one report reference.

Historical v2 and v3 five-file bundles remain read-only and hash-validated through version-aware readers. They are not migrated or overwritten. The new four-file contract requires an explicit current writer version or manifest contract discriminator so that readers never infer a version from file count alone.

## 6. Agent Entry

Create `.github/skills/ta-assist-agent/SKILL.md` as the workspace-level orchestrator. The user-facing command is:

```text
/ta-assist-agent [workbook-path]
```

The Skill routes to the existing governed product capabilities in order and preserves all current worksheet, ADO, image, context, target, and publication gates. It does not duplicate deterministic workflow code. Existing component Skills remain internal sub-capabilities. The VS Code participant entry remains compatible but is not the primary documented onboarding path.

Add positive, negative, and ambiguous triggering tests in English and Chinese. The Skill must not trigger for generic spreadsheet editing, generic Cpk questions, generic Monte Carlo programming, or unrelated image analysis.

## 7. Product and Repository Naming

Use **TA Assist Agent** on all product-visible surfaces. Use `ta-assist-agent` for the root npm package name and `TA-Assist-Agent` for the GitHub repository name. Keep internal `@ai-assist/*` workspace package scopes unchanged.

Rename the GitHub repository only after local verification succeeds. Verify the remote operation and update `origin` to the canonical repository URL. If the authenticated user lacks permission, keep the local implementation complete and publish exact administrator instructions without claiming that the remote rename succeeded.

## 8. English Engineering Assets

Tracked source code, comments, root README, developer documentation, test descriptions, and internal diagnostic text use English. Merge duplicate Chinese design documents into their English counterparts where they carry unique current information, then remove the duplicate tracked files.

Chinese remains allowed only in explicit localization catalogs, Chinese user prompts and responses, localized report output, and corresponding test fixtures. Generated reports, uploads, distribution bundles, temporary files, and immutable historical artifacts are excluded from migration.

Add a repository check that scans tracked engineering assets for CJK characters outside an explicit localization allowlist. The allowlist is narrow, path-based, reviewed, and covered by tests.

## 9. Validation

### 9.1 Report Tests

- Assert exact section titles and table header sets.
- Assert the complete Factor identity set and original ordinals.
- Assert all requested statistical and F0 fields.
- Assert three-decimal adjusted mean, specification center, and offset.
- Assert complete contributor rows and the Top 3 tolerance reminder.
- Reject Source/Evidence columns on every user-facing report surface.
- Assert exact row/field/image blocker diagnostics.

### 9.2 Image Tests

- Resolve every rendered image link from the final report directory.
- Require canonical containment, regular-file status, supported media type, and matching hash.
- Reproduce the historical invalid-link layout as a regression fixture.

### 9.3 Workflow Tests

- Assert atomic four-file publication for new runs.
- Assert no new `Feature6-Optimization.md` is written or registered.
- Validate untouched historical five-file v2/v3 bundles.
- Assert Workbench, CLI, and export expose only `Feature6-Report.md` as the report.

### 9.4 Product Tests

- Test `/ta-assist-agent` trigger routing and exclusions.
- Test product-visible naming and root package metadata.
- Run the English-engineering-asset check.
- Run focused F2/F4/F5/F6, Workbench, extension, build, and current governed F6 validation.

## 10. Delivery Sequence

1. Preserve and validate the current uncommitted Issue 106 work on `issue/106-ux-agent-triggering`.
2. Add exact blocker diagnostics and the complete final report through test-first changes.
3. Repair image materialization and final-report-relative links.
4. Migrate the F6 writer and readers to the four-file current contract with historical compatibility.
5. Add the `/ta-assist-agent` orchestrator Skill and trigger tests.
6. Update product branding, README, and tracked English engineering assets.
7. Run focused and repository-level verification.
8. Rename the GitHub repository, verify it, and update the local remote.

## 11. Acceptance Criteria

The work is accepted when a governed multi-worksheet run produces one complete `Feature6-Report.md`; every active Factor and requested field is present; image links open from the report; blocked findings identify exact missing locations; all statistical and F0 information is present without provenance columns; adjusted mean offset is correct to three decimal places; all contributors and the Top 3 reminder are shown; only four current F6 artifacts are published; `/ta-assist-agent` starts the governed workflow; engineering assets pass the English check; all relevant tests pass; and the repository name is verified as `TA-Assist-Agent` or an explicit permission blocker is reported.