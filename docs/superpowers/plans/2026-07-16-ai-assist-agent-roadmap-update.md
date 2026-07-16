# AI Assist Agent Roadmap Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product-facing project to AI Assist Agent and align repository docs, GitHub issues, and Project #1 with the four-story V1 roadmap in `docs/04-feature-breakdown.md`.

**Architecture:** Treat repository docs as the product source of truth, then project that structure into GitHub planning artifacts. Preserve existing issue numbers and project cards, update text/field values in place, and mark obsolete S0-S9 story issues as migrated instead of deleting them.

**Tech Stack:** Markdown docs, GitHub CLI (`gh issue edit`, `gh project edit`, `gh project item-edit`), GitHub Project V2 fields.

---

## File Structure

- Modify `README.md`: change product-facing title and repository notes to AI Assist Agent while preserving TA-specific scope.
- Modify `docs/README.md`: change design document set name and tracking convention to AI Assist Agent and four ME User Stories.
- Modify `docs/00-overview.md`: ensure the What section uses AI Assist Agent.
- Modify `docs/01-architecture.md`: update heading and introduction from Surface TA Analysis Agent to AI Assist Agent.
- Modify `docs/04-feature-breakdown.md`: update Epic name and tracking note to AI Assist Agent and four-story GitHub planning structure.
- Modify `docs/05-design-decisions.md`: update the V1 framing to AI Assist Agent.
- External GitHub state: update repository issues in `MS-AI-in-Product-Making/AI-TVA-Analysis-Agent` and Project #1 in `MS-AI-in-Product-Making`.

## Roadmap Mapping

| New User Story | Feature issues |
|---|---|
| User Story 1 - Reliable First-Pass TA Result and Summary | F0.1-F0.3, F1.1-F1.2, F2.1-F2.4, F4.1, F5.1, F9.1-F9.2 |
| User Story 2 - DIM ID and Drawing Governance Before Key Milestones | F3.1-F3.10 |
| User Story 3 - Objective Conclusions and Comparable Options | F6.1-F6.7, F7.1-F7.5 |
| User Story 4 - Measured Cpk Feedback and Continuous Accuracy Improvement | F8.1-F8.3 |

### Task 1: Update Repository Product Naming

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/00-overview.md`
- Modify: `docs/01-architecture.md`
- Modify: `docs/04-feature-breakdown.md`
- Modify: `docs/05-design-decisions.md`

- [ ] **Step 1: Replace product-facing names in docs**

Use targeted edits:

```text
AI TA Analysis Agent -> AI Assist Agent
Surface TA Analysis Agent -> AI Assist Agent
Dedicated TA Agent -> AI Assist Agent
Surface TA Analysis Agent (V1) -> AI Assist Agent (V1)
```

Do not replace TA domain terms such as `TA workbook`, `TA report`, `TA template`, or `tolerance analysis`.

- [ ] **Step 2: Update tracking notes**

In `README.md`, change repository planning notes from S0-S9 milestones to the four ME User Stories plus Feature issues.

Expected wording:

```markdown
- Project planning is tracked via GitHub **Project #1** as four ME User Stories, Feature issues (F0-F9), and implementation tasks in each Feature checklist.
```

In `docs/README.md`, change the shared convention tracking bullet to:

```markdown
- **Tracking:** Four ME User Stories group the work; Feature IDs (F0-F9) map to GitHub Feature issues and their task checklists map to implementation work items.
```

- [ ] **Step 3: Verify repository naming**

Run:

```powershell
Set-Location 'C:\Users\xumax\AI Project\copilot-worktrees\AI TVA Analysis\xumax-gh-literate-spork'
rg "AI TA Analysis Agent|Surface TA Analysis Agent|Dedicated TA Agent" README.md docs\*.md
```

Expected: no matches, except historical text only if explicitly marked as historical.

- [ ] **Step 4: Commit repository naming changes**

Run:

```powershell
git add README.md docs\README.md docs\00-overview.md docs\01-architecture.md docs\04-feature-breakdown.md docs\05-design-decisions.md
git commit -m "docs: rename product to AI Assist Agent" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>" -m "Copilot-Session: 6c4c0035-3d95-4e9d-9ba7-250878cec32d"
```

Expected: commit succeeds.

### Task 2: Update GitHub Project Metadata

**External state:**
- Modify: Project #1 at `https://github.com/orgs/MS-AI-in-Product-Making/projects/1`

- [ ] **Step 1: Rename Project #1**

Run:

```powershell
gh project edit 1 --owner MS-AI-in-Product-Making --title "AI Assist Agent Roadmap" --description "V1 roadmap: 4 ME User Stories x F0-F9 Features. Tasks live as checklists inside each Feature issue." --readme "V1 roadmap board for AI Assist Agent. The board tracks four ME User Stories, Feature issues F0-F9, and implementation tasks inside each Feature issue checklist. Use the User Story field to group Feature cards by product outcome."
```

Expected: command exits 0.

- [ ] **Step 2: Verify project rename**

Run:

```powershell
gh project view 1 --owner MS-AI-in-Product-Making --format json
```

Expected: JSON contains `"title":"AI Assist Agent Roadmap"` and readme mentions four ME User Stories.

### Task 3: Update Feature Issue Bodies and Titles

**External state:**
- Modify: GitHub issues #1-#30 and #32-#39 in `MS-AI-in-Product-Making/AI-TVA-Analysis-Agent`.

- [ ] **Step 1: Create issue body payloads in session artifacts**

Run this script from the repository root. It creates temporary body files under the session artifact folder, not the repo, and derives tasks from `docs/04-feature-breakdown.md`:

```powershell
Set-Location 'C:\Users\xumax\AI Project\copilot-worktrees\AI TVA Analysis\xumax-gh-literate-spork'
$Artifacts = 'C:\Users\xumax\.copilot\session-state\961187a3-a96e-4b4f-9737-95b6d7b368c9\files\issue-bodies'
New-Item -ItemType Directory -Force -Path $Artifacts | Out-Null

$issueMap = @{
  17 = @{ Title='F0.1 Classified Capability Library'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Maintain tolerance bands, process capability, recommended distributions, and source tiers for TA input checks.'; Tasks=@('Maintain tolerance bands by part category.','Record process capability with T1 measured/PPAP, T2 historical or supplier input, T3 engineering estimate, and T0 no data tiers.','Store recommended distributions and mark T0 as process capability unknown.') }
  18 = @{ Title='F0.2 Engineering Rules Library'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Maintain authoritative engineering rules behind method selection and interpretation.'; Tasks=@('Maintain CTS = 6 sigma and CTF = 4 sigma rules.','Maintain the default Cpk target of 1.33.','Record rule source, confidence, effective version, owner, change history, and coverage.') }
  19 = @{ Title='F0.3 Terminology / Ontology Library'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Maintain controlled vocabulary for part categories, subsystems, and datum names.'; Tasks=@('Maintain part-category vocabulary used as the Lib 1 lookup key.','Maintain subsystem vocabulary for ME, PCBA, Glass, Display, and related classes.','Maintain datum naming conventions and coverage metadata.') }
  1  = @{ Title='F1.1 Auto-detect TA worksheets'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Find supported TA worksheets in uploaded workbooks.'; Tasks=@('Accept one or more uniquely named .xlsx files.','Scan every worksheet for the supported TA layout.','Show detected workbook, worksheet, version/date, and tolerance-loop description for user selection.') }
  2  = @{ Title='F1.2 Parallel multi-sheet processing'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Process selected worksheets while keeping each sheet reviewable.'; Tasks=@('Let the user select one sheet, multiple sheets, or all detected TA sheets.','Process selected worksheets in parallel.','Retain debug JSON and extracted Loop screenshot per file, sheet, version, and date.') }
  3  = @{ Title='F2.1 Missing required-field check'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Block unreliable calculations when required TA inputs are missing.'; Tasks=@('Check factor description, part name, part category, design nominal, tolerance, long-term/safety factor, sigma level, and distribution.','Block the run when nominal or tolerance is missing.','Show the missing-field list and require workbook correction and re-upload.') }
  4  = @{ Title='F2.2 Per-category spec & distribution validation'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Validate tolerance ranges and distributions against the Capability Library.'; Tasks=@('Compare each tolerance range with the matching Capability Library entry.','Compare each distribution with the recommended distribution.','Flag in-library and out-of-library results clearly.') }
  5  = @{ Title='F2.3 Two correction paths for differences'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Let the engineer resolve non-blocking differences without silent source edits.'; Tasks=@('Treat optional fields such as drawing number as prompts rather than blockers.','Allow the engineer to edit source Excel and re-upload.','Allow the engineer to continue with a recorded exception when differences are non-blocking.') }
  22 = @{ Title='F2.4 DIM ID presence & format check'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Detect DIM ID and Part Number quality issues during cleansing.'; Tasks=@('Check DIM ID and Part Number completeness.','Detect duplicate IDs and malformed IDs.','Detect supplier-to-Microsoft ID crosswalk conflicts.') }
  6  = @{ Title='F4.1 Recommend method by factor count'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Choose the appropriate 1D reference method by factor count and CTS/CTF context.'; Tasks=@('Recommend Worst Case for fewer than 4 factors.','Recommend 1D RSS for 4-10 factors.','Flag a DM-team 3D VA referral for more than 10 factors while still computing WC and RSS.') }
  7  = @{ Title='F5.1 Excel-consistent calculation engine'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Reproduce TA workbook calculation results exactly.'; Tasks=@('Compute and show both Worst Case and RSS outputs when in V1 scope.','Calculate mean, tolerance, 1-sigma, contribution, Cp, Cpk, Z, DPM, and yield.','Regress against the approved sample result: Cpk 0.74, DPM about 26,500, FAIL.') }
  15 = @{ Title='F9.1 Consolidated interpretation report'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Produce one consolidated report across selected worksheets.'; Tasks=@('Include a quick summary of highlighted TA risks.','Include the extracted Loop image with the corresponding worksheet evidence.','Keep source data read-only and require re-upload or user-confirmed proposals for changes.') }
  21 = @{ Title='F9.2 Read-only evidence pane UX'; Story='User Story 1 - Reliable First-Pass TA Result and Summary'; Purpose='Show source evidence faithfully and link conclusions to visible rows or cells.'; Tasks=@('Render the original factor table with the same values, layout, and units as the source workbook.','Link each conclusion to its visible source row or cell.','Highlight related evidence when a conclusion is selected.') }
  23 = @{ Title='F3.1 Unique DIM ID <-> factor anchor'; Story='User Story 2 - DIM ID and Drawing Governance Before Key Milestones'; Purpose='Link every TA factor to the drawing lifecycle using a stable DIM ID.'; Tasks=@('Create a unique DIM ID <-> factor <-> future measurement anchor for every factor.','Validate anchors during submission.','Keep the anchor usable for future measured-data routing.') }
  24 = @{ Title='F3.2 Placeholder-first, backfill-later'; Story='User Story 2 - DIM ID and Drawing Governance Before Key Milestones'; Purpose='Allow TA calculation to continue before final DIM IDs exist while enforcing later backfill.'; Tasks=@('Assign a placeholder when no DIM ID or drawing exists yet.','Allow TA calculation to continue with the placeholder.','Require DIM ID backfill before EV1 or another configured key milestone.') }
  25 = @{ Title='F3.3 DIM ID uniqueness & MS-supplier reconciliation'; Story='User Story 2 - DIM ID and Drawing Governance Before Key Milestones'; Purpose='Prevent identifier drift between supplier and Microsoft drawing systems.'; Tasks=@('Raise a clarification card when an ID is duplicated, conflicted, or cannot be mapped.','Maintain a versioned crosswalk from supplier ID plus revision to Microsoft canonical DIM ID.','Track reconciliation decisions for traceability.') }
  32 = @{ Title='F3.4 ADO work item link after manual .xlsx upload'; Story='User Story 2 - DIM ID and Drawing Governance Before Key Milestones'; Purpose='Let the engineer connect a workbook run to an ADO work item after upload.'; Tasks=@('Let the engineer upload the workbook manually.','Let the engineer create or link an ADO work item.','Keep automatic parsing of ADO attachments as later scope.') }
  33 = @{ Title='F3.5 Owner identification - bind run to a responsible person'; Story='User Story 2 - DIM ID and Drawing Governance Before Key Milestones'; Purpose='Bind governed reminders to an accountable owner.'; Tasks=@('Resolve the owner from the ADO owner field.','Fall back to the Request By field when needed.','Block the governed run and prompt when no owner is available.') }
  34 = @{ Title='F3.6 Scheduled EV1 reminder - milestone-driven nudge before info is missing'; Story='User Story 2 - DIM ID and Drawing Governance Before Key Milestones'; Purpose='Send server-side reminders before key milestones for missing critical dimensions.'; Tasks=@('Run a server-side service independently of analysis.','Check milestones and open items weekly or monthly for linked ADO items.','Send reminders before EV1 or another configured key milestone.') }
  35 = @{ Title='F3.7 Dimension-chain list - per-part list for drawing mapping'; Story='User Story 2 - DIM ID and Drawing Governance Before Key Milestones'; Purpose='Generate locatable lists that can be used for drawing markup.'; Tasks=@('Generate a per-part dimension-chain list.','Include part name, join number, DIM ID, and exact source location.','Keep the list tied to the source worksheet evidence.') }
  36 = @{ Title='F3.8 Drawing reminder (server-side scheduled) - reflect the dimension chain on the drawing'; Story='User Story 2 - DIM ID and Drawing Governance Before Key Milestones'; Purpose='Package reminders so owners mark dimension chains on drawings.'; Tasks=@('Send an immediate reminder when a linked ADO item has missing critical dimensions.','Send a packaged periodic reminder to Microsoft and supplier owners.','Track drawing markup reminders separately from analysis execution.') }
  37 = @{ Title='F3.9 State & history - ADO maintains loop status for traceability'; Story='User Story 2 - DIM ID and Drawing Governance Before Key Milestones'; Purpose='Keep DIM ID lifecycle state and history in ADO.'; Tasks=@('Track placeholder state.','Track DIM ID filled state.','Track marked-on-drawing state with history on the ADO work item.') }
  39 = @{ Title='F3.10 Part-category grouping (ontology-driven) for drawing packaging'; Story='User Story 2 - DIM ID and Drawing Governance Before Key Milestones'; Purpose='Group dimension-chain lists by ontology so reminders can be packaged by drawing.'; Tasks=@('Group lists by Lib 3 part category.','Group lists by drawing when drawing information is available.','Send one drawing package to the responsible Microsoft and supplier engineers.') }
  8  = @{ Title='F6.1 Loop validity'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Check whether the tolerance loop has enough evidence for objective interpretation.'; Tasks=@('Check loop closure.','Check datum-chain consistency.','Check assembly datum face, stack start, and additive/subtractive direction.') }
  9  = @{ Title='F6.2 Capability vs Spec'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Evaluate capability against engineering rules and specification feasibility.'; Tasks=@('Evaluate RSS sigma and Cpk using the Rules Library.','Evaluate spec-window feasibility using the Rules Library.','Cite the knowledge-base entry, version, and coverage for each conclusion.') }
  10 = @{ Title='F6.3 Top contributors'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Explain which factors contribute most to risk and why.'; Tasks=@('Rank the top contributors by contribution percentage.','Explain measurable causes such as large tolerance or mid-chain amplification.','Use FACT statements for computed contribution values.') }
  11 = @{ Title='F6.4 Structural risk identification'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Flag structural risks without making unsupported conclusions.'; Tasks=@('Flag cross-subsystem chains.','Flag non-geometric variables.','Flag overly long stacks without asserting unsupported conclusions.') }
  12 = @{ Title='F6.5 Options presentation (objective, no recommendation)'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Present comparable options while leaving the decision with the engineer.'; Tasks=@('Use OPTION statements for parallel alternatives.','Quantify consequences for each option.','Do not rank or force an engineering recommendation.') }
  20 = @{ Title='F6.6 Clarification card & assumption register (fail-closed)'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Stop and ask when required evidence is missing.'; Tasks=@('Show a clarification card for missing assembly datum face, stack start, subsystem classification, or other required evidence.','Maintain an assumption log.','Hold only conclusions that depend on the unanswered question.') }
  26 = @{ Title='F6.7 Evidence-chain citation to S0'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Make every rule-based conclusion traceable to knowledge-base evidence.'; Tasks=@('Use FACT, RULE, SIGNAL, and OPTION statement types.','Cite the knowledge-base entry, version, and coverage for every RULE conclusion.','Continue analysis for evidence that is already sufficient.') }
  14 = @{ Title='F7.1 Mean-shift centering analysis'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Quantify improvement available from nominal centering.'; Tasks=@('Detect nominal offset.','Show the Cpk improvement from mean-shift centering.','Present centering as an option, not a forced recommendation.') }
  27 = @{ Title='F7.2 Contribution economics analysis'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Estimate relative leverage and cost impact of tolerance changes.'; Tasks=@('Rank tolerance changes using contribution-weighted leverage.','Estimate relative cost impact.','Use capability evidence before marking an option feasible.') }
  28 = @{ Title='F7.3 RSS tolerance apportionment'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Distribute required RSS sigma reduction across top contributors.'; Tasks=@('Calculate the required RSS sigma reduction.','Apportion reduction across the top two or three contributors.','Show resulting tolerance targets and Cpk impact.') }
  13 = @{ Title='F7.4 What-if sensitivity simulation'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Show the effect of tightening or loosening individual factors.'; Tasks=@('Run what-if calculations for tightening an individual factor.','Run what-if calculations for loosening an individual factor.','Show the resulting Cpk change.') }
  16 = @{ Title='F7.5 Spec reverse-solver (options)'; Story='User Story 3 - Objective Conclusions and Comparable Options'; Purpose='Generate parallel reverse-solve options with feasibility warnings.'; Tasks=@('Generate single-point tighten, combined top-contributor tighten, and center-plus-tighten options.','Check each option against the Capability Library.','Show a red warning when required tolerance is not process-achievable and mark T0 as feasibility unknown.') }
  29 = @{ Title='F8.1 Ingest measured yield/Cpk by DIM ID'; Story='User Story 4 - Measured Cpk Feedback and Continuous Accuracy Improvement'; Purpose='Import measured capability keyed by canonical DIM ID.'; Tasks=@('Define a measured-data schema keyed by canonical DIM ID.','Include measured Cpk, yield, distribution, source, and revision.','Manually import standardized data from the agreed centralized SharePoint or platform store.') }
  38 = @{ Title='F8.2 Real gap vs initial estimate - recompute on measured capability'; Story='User Story 4 - Measured Cpk Feedback and Continuous Accuracy Improvement'; Purpose='Show the actual capability gap after measured data arrives.'; Tasks=@('Validate that the imported record has a stable DIM ID anchor.','Recompute sigma and actual capability using measured data.','Show initial estimate versus measured result, including the real gap and updated tolerance range.') }
  30 = @{ Title='F8.3 Upgrade Lib1 entry tier from measured data'; Story='User Story 4 - Measured Cpk Feedback and Continuous Accuracy Improvement'; Purpose='Improve future judgment accuracy by feeding measured capability back into Lib 1.'; Tasks=@('Upgrade the matching Capability Library entry from T3 empirical to T1 measured.','Increment the Lib 1 version and retain history.','Document external prerequisites: maintained centralized measured-data store, permissions, and DIM ID governance from F3.') }
}

foreach ($entry in $issueMap.GetEnumerator()) {
  $n = [int]$entry.Key
  $v = $entry.Value
  $body = @(
    "**Feature:** $($v.Title)",
    "",
    "**User Story:** $($v.Story)",
    "",
    "**Purpose:** $($v.Purpose)",
    "",
    "**Tasks**"
  ) + ($v.Tasks | ForEach-Object { "- [ ] $_" })
  Set-Content -Path (Join-Path $Artifacts "$n.md") -Value ($body -join "`n") -Encoding UTF8
}
```

- [ ] **Step 2: Update feature issues from payloads**

Run:

```powershell
$Artifacts = 'C:\Users\xumax\.copilot\session-state\961187a3-a96e-4b4f-9737-95b6d7b368c9\files\issue-bodies'
$titles = @{
  1='F1.1 Auto-detect TA worksheets'; 2='F1.2 Parallel multi-sheet processing'; 3='F2.1 Missing required-field check'; 4='F2.2 Per-category spec & distribution validation'; 5='F2.3 Two correction paths for differences'; 6='F4.1 Recommend method by factor count'; 7='F5.1 Excel-consistent calculation engine'; 8='F6.1 Loop validity'; 9='F6.2 Capability vs Spec'; 10='F6.3 Top contributors'; 11='F6.4 Structural risk identification'; 12='F6.5 Options presentation (objective, no recommendation)'; 13='F7.4 What-if sensitivity simulation'; 14='F7.1 Mean-shift centering analysis'; 15='F9.1 Consolidated interpretation report'; 16='F7.5 Spec reverse-solver (options)'; 17='F0.1 Classified Capability Library'; 18='F0.2 Engineering Rules Library'; 19='F0.3 Terminology / Ontology Library'; 20='F6.6 Clarification card & assumption register (fail-closed)'; 21='F9.2 Read-only evidence pane UX'; 22='F2.4 DIM ID presence & format check'; 23='F3.1 Unique DIM ID <-> factor anchor'; 24='F3.2 Placeholder-first, backfill-later'; 25='F3.3 DIM ID uniqueness & MS-supplier reconciliation'; 26='F6.7 Evidence-chain citation to S0'; 27='F7.2 Contribution economics analysis'; 28='F7.3 RSS tolerance apportionment'; 29='F8.1 Ingest measured yield/Cpk by DIM ID'; 30='F8.3 Upgrade Lib1 entry tier from measured data'; 32='F3.4 ADO work item link after manual .xlsx upload'; 33='F3.5 Owner identification - bind run to a responsible person'; 34='F3.6 Scheduled EV1 reminder - milestone-driven nudge before info is missing'; 35='F3.7 Dimension-chain list - per-part list for drawing mapping'; 36='F3.8 Drawing reminder (server-side scheduled) - reflect the dimension chain on the drawing'; 37='F3.9 State & history - ADO maintains loop status for traceability'; 38='F8.2 Real gap vs initial estimate - recompute on measured capability'; 39='F3.10 Part-category grouping (ontology-driven) for drawing packaging'
}
foreach ($n in $titles.Keys | Sort-Object) {
  gh issue edit $n --repo MS-AI-in-Product-Making/AI-TVA-Analysis-Agent --title $titles[$n] --body-file (Join-Path $Artifacts "$n.md")
}
```

Expected: command exits 0 for every feature issue.

- [ ] **Step 3: Verify feature issues**

Run:

```powershell
gh issue list --repo MS-AI-in-Product-Making/AI-TVA-Analysis-Agent --state open --limit 100 --json number,title,body | ConvertFrom-Json | Where-Object { $_.title -match '^F\d+\.' } | Select-Object number,title,@{n='hasTasks';e={$_.body -match '\*\*Tasks\*\*'}} | Format-Table -AutoSize
```

Expected: every feature issue has `hasTasks=True`.

### Task 4: Migrate Historical S0-S9 User Story Issues

**External state:**
- Modify: GitHub issues #40-#49.

- [ ] **Step 1: Update historical issue bodies**

Run:

```powershell
$Artifacts = 'C:\Users\xumax\.copilot\session-state\961187a3-a96e-4b4f-9737-95b6d7b368c9\files\issue-bodies'
$historicalTitles = @{
  40='S0: Knowledge Base'; 41='S1: Report Parsing & Asset Prep'; 42='S2: Data Cleansing'; 43='S3: Dimension-to-Drawing Association (DIM ID)'; 44='S4: Method Recommendation'; 45='S5: Calculation Engine'; 46='S6: Data Interpretation'; 47='S7: Tolerance / Dimension-Chain Optimization'; 48='S8: Closed-Loop Real-Cpk Feedback'; 49='S9: User Interaction, Read-Only Pane & Output'
}
$historicalBody = @'
**Migrated User Story**

This S0-S9 story was part of the earlier TA Agent roadmap structure. The active AI Assist Agent roadmap now uses four ME User Stories from `docs/04-feature-breakdown.md`:

1. User Story 1 - Reliable First-Pass TA Result and Summary
2. User Story 2 - DIM ID and Drawing Governance Before Key Milestones
3. User Story 3 - Objective Conclusions and Comparable Options
4. User Story 4 - Measured Cpk Feedback and Continuous Accuracy Improvement

The original feature issues remain open and have been remapped to the active four-story structure. This issue is retained for link history.
'@
foreach ($n in $historicalTitles.Keys | Sort-Object) {
  $path = Join-Path $Artifacts "historical-$n.md"
  Set-Content -Path $path -Value $historicalBody -Encoding UTF8
  gh issue edit $n --repo MS-AI-in-Product-Making/AI-TVA-Analysis-Agent --title "Migrated: $($historicalTitles[$n])" --body-file $path
}
```

Expected: command exits 0.

- [ ] **Step 2: Close historical S0-S9 issues**

Run:

```powershell
40..49 | ForEach-Object {
  gh issue close $_ --repo MS-AI-in-Product-Making/AI-TVA-Analysis-Agent --comment "Migrated to the four ME User Story structure documented in docs/04-feature-breakdown.md for AI Assist Agent."
}
```

Expected: issues #40-#49 are closed with migration comments.

### Task 5: Update Project User Story Field Assignments

**External state:**
- Modify: Project #1 item field values.

- [ ] **Step 1: Inspect project field IDs and options**

Run:

```powershell
gh project field-list 1 --owner MS-AI-in-Product-Making --format json
gh project item-list 1 --owner MS-AI-in-Product-Making --limit 100 --format json
```

Expected: output includes the Project ID, item IDs, and `User Story` field ID.

- [ ] **Step 2: Rename User Story field options to the four active stories**

Run:

```powershell
$query = @'
mutation {
  updateProjectV2Field(input: {
    fieldId: "PVTSSF_lADOEcYMrc4Bc-hlzhXjhNE",
    name: "User Story",
    singleSelectOptions: [
      { id: "ea881fdb", name: "US1 Reliable First-Pass TA Result and Summary", color: BLUE, description: "F0/F1/F2/F4/F5/F9" },
      { id: "fc35550b", name: "US2 DIM ID and Drawing Governance Before Key Milestones", color: GREEN, description: "F3" },
      { id: "ab23da05", name: "US3 Objective Conclusions and Comparable Options", color: PURPLE, description: "F6/F7" },
      { id: "4ad25bc9", name: "US4 Measured Cpk Feedback and Continuous Accuracy Improvement", color: ORANGE, description: "F8" }
    ]
  }) { projectV2Field { ... on ProjectV2SingleSelectField { id name options { id name } } } }
}
'@
gh api graphql -f query=$query
```

Expected: the `User Story` field has four options named US1-US4.

- [ ] **Step 3: Assign feature items to the four User Story options**

Run:

```powershell
$project = gh project view 1 --owner MS-AI-in-Product-Making --format json | ConvertFrom-Json
$projectId = $project.id
$fieldId = 'PVTSSF_lADOEcYMrc4Bc-hlzhXjhNE'
$optionByIssue = @{}
@(17,18,19,1,2,3,4,5,22,6,7,15,21) | ForEach-Object { $optionByIssue[$_] = 'ea881fdb' }
@(23,24,25,32,33,34,35,36,37,39) | ForEach-Object { $optionByIssue[$_] = 'fc35550b' }
@(8,9,10,11,12,20,26,14,27,28,13,16) | ForEach-Object { $optionByIssue[$_] = 'ab23da05' }
@(29,38,30) | ForEach-Object { $optionByIssue[$_] = '4ad25bc9' }
$items = gh project item-list 1 --owner MS-AI-in-Product-Making --limit 100 --format json | ConvertFrom-Json
foreach ($item in $items.items) {
  $number = [int]$item.content.number
  if ($optionByIssue.ContainsKey($number)) {
    gh project item-edit --id $item.id --project-id $projectId --field-id $fieldId --single-select-option-id $optionByIssue[$number]
  }
}
```

Expected: command exits 0 for every open feature item.

- [ ] **Step 4: Verify project grouping**

Run:

```powershell
gh project item-list 1 --owner MS-AI-in-Product-Making --limit 100 --format json
```

Expected: every open F0-F9 feature issue appears in Project #1 and has a User Story value matching the approved four-story mapping or the documented fallback mapping.

### Task 6: Final Verification

**Files and external state:**
- Verify repository docs.
- Verify GitHub issues.
- Verify Project #1.

- [ ] **Step 1: Check git status**

Run:

```powershell
git status --short
```

Expected: no unexpected unstaged repository changes after documentation commit.

- [ ] **Step 2: Check docs name**

Run:

```powershell
rg "AI Assist Agent" README.md docs\README.md docs\00-overview.md docs\01-architecture.md docs\04-feature-breakdown.md docs\05-design-decisions.md
```

Expected: matches show product-facing references to AI Assist Agent.

- [ ] **Step 3: Check GitHub issue state**

Run:

```powershell
gh issue list --repo MS-AI-in-Product-Making/AI-TVA-Analysis-Agent --state all --limit 100 --json number,title,state,body | ConvertFrom-Json | Sort-Object number | Select-Object number,title,state | Format-Table -AutoSize
```

Expected: feature issues remain open; historical S0-S9 issues are closed and titled `Migrated: ...`.

- [ ] **Step 4: Check Project #1**

Run:

```powershell
gh project view 1 --owner MS-AI-in-Product-Making --format json
```

Expected: Project #1 title is `AI Assist Agent Roadmap` and readme describes the four ME User Story roadmap.
