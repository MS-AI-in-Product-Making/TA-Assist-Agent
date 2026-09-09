# Feature Breakdown (V1)

> Structure: **Epic -> User Story -> Feature -> Task**. The Feature IDs map to the existing ADO features shown in the project backlog. Each task is written as an implementable piece of work.

## Epic

**AI Assist Agent (V1)**

> Goal: help ME engineers turn a TA workbook into a reliable, traceable first-pass analysis result. The assistant cleans the input, runs Excel-consistent calculations, highlights risks with evidence, and keeps DIM IDs and measured capability connected over time.

## Feature Map

| ID | ADO Feature | Purpose |
|---|---|---|
| F0 | Knowledge Base | Provide the controlled rules, capability ranges, and terminology behind every check and interpretation. |
| F1 | TA Report Parsing & Asset Prep | Find TA sheets, read their data, and collect the Loop image. |
| F2 | Data Cleansing | Find missing items or unreasonable TA inputs before calculation. |
| F3 | Dimension-to-Drawing Association (DIM ID) | Keep each factor linked to a drawing dimension and govern missing IDs. |
| F4 | Method Recommendation & Calculation Engine | Recommend the calculation method and reproduce an Excel-consistent result. |
| F5 | Data Interpretation | Explain risks using facts and rules, without forcing a decision. |
| F6 | Tolerance / Dimension-Chain Optimization | Compare the quantified effect of different improvement options. |
| F7 | Closed-Loop Real-Cpk Feedback | Feed measured capability back by DIM ID. |
| F8 | User Interaction, Read-Only Pane & Output | Give the engineer a complete report and visible source evidence. |

---

## F1 to F2 Evidence Ownership

F1 owns the only physical worksheet image artifact. F2 carries a hash-bound `imageReference` to that F1 artifact and renders a relative link instead of creating an F2 copy. F1 also preserves the exact Response Summary `sourceLabel` and cached formula values for `1σ` and `% Cont. to σ`; F2 displays or projects those values without renaming or recalculating them.

---

## User Story 1 - Reliable First-Pass TA Result and Summary

**As an ME engineer, when I upload a TA file, I want the assistant to automatically identify all TA worksheets, clean the data first, and flag unreasonable tolerance inputs, so I can get a reliable first-pass result and a complete report quickly.**

The result must include a quick, easy-to-scan TA risk summary.

### Acceptance Criteria

1. Automatically detect TA sheets and process multiple selected sheets in parallel (F1).
2. Check required fields, specification ranges, and distribution reasonableness for tolerance inputs (F2).
3. Recommend a method based on factor count and calculate with an Excel-consistent engine (F4).
4. Output one consolidated interpretation report and a read-only evidence panel, including a highlighted risk summary (F8).

### F0 - Knowledge Base

**Feature:** Maintain the controlled reference data used to decide whether a TA input or conclusion is reasonable.

**Tasks:**

- Maintain the Capability Library: tolerance bands, process capability, recommended distributions, and source tiers (T1 measured/PPAP, T2 historical or supplier input, T3 engineering estimate, T0 no data).
- Maintain the Rules Library, including CTS = 6 sigma, CTF = 4 sigma, and the default Cpk target of 1.33.
- Maintain the Terminology Library for part categories, subsystems, and datum names, with specific boundaries to be finalized later.
- Record source, confidence, effective version, owner, change history, and coverage for every library entry, with further refinement possible later.
- Mark T0 as `process capability unknown`; do not claim feasibility when evidence is missing.

### F1 - TA Report Parsing & Asset Prep

**Feature:** Find the TA content in uploaded workbooks and prepare the data and images needed for review.

**Tasks:**

- Accept one or more uniquely named `.xlsx` files and scan every worksheet for the supported TA layout.
- Show the detected workbook, worksheet, version/date, and tolerance-loop description for user selection.
- Return worksheet options before analysis and require an explicit selection bound to the workbook content hash; reject stale confirmations after the file changes.
- Process selected worksheets in parallel, while keeping each page independently reviewable.
- Resolve the factor table from its semantic header cluster rather than fixed columns, record processing time, and retain a local debug JSON record by file, sheet, version, and date.
- Extract the Loop screenshot in parallel, label it with its source worksheet and loop description, and retain it with the same run record.
- Offer manual sheet selection when automatic detection cannot recognize an irregular layout.

### F2 - Data Cleansing

**Feature:** Check the input before calculation so the first-pass result is based on complete and reasonable data.

**Tasks:**

- Check required fields: factor description, part name, part category, design nominal, tolerance, long-term/safety factor, sigma level, distribution, and cross-section image.
- Require Lower Spec Limit, Upper Spec Limit, and Target σ Level from the worksheet Response Summary; never substitute values from Suggested Spec.
- Block the run when nominal or tolerance is missing; show the missing-field list and require the user to correct and re-upload the workbook.
- Isolate blocking at worksheet level: ready worksheets continue and each emits one F4 handoff, while blocked worksheets emit none.
- Treat optional fields, such as drawing number, part number, and dimension ID, as prompts rather than calculation blockers.
- Compare each tolerance range and distribution with the matching Capability Library entry; flag in-library and out-of-library results.
- Check DIM ID and Part Number completeness, duplicate IDs, malformed IDs, and supplier-to-Microsoft ID crosswalk conflicts.
- Present all non-blocking differences clearly. The engineer can edit the source Excel or continue after recording an exception.

### F4 - Method Recommendation & Calculation Engine

**Feature:** Choose the appropriate 1D reference method and produce results that match the TA workbook.

**Tasks:**

- Count factors and identify CTS/CTF context: fewer than 4 factors recommends Worst Case; 4-10 recommends 1D RSS; more than 10 flags a 3D VA referral to the DM team.
- Compute and show both Worst Case and RSS outputs whenever the sheet is within V1 scope.
- Reproduce factor-level, system-level, and capability metrics using the same formulas as the Excel template.
- Calculate mean, tolerance, 1-sigma, contribution, Cp, Cpk, Z, DPM, and yield.
- Regress the calculation engine against the approved sample result: Cpk 0.74, DPM about 26,500, FAIL, as a regression check that can be removed later if no longer needed.

### F8 - User Interaction, Read-Only Pane & Output

Delivered as a confidential local TA Assist Workbench. CLI `agent analyze|resume|status|workbench` and VS Code `@ta-assist` open or resume the same session. The browser provides upload, two worksheet confirmations, F3-F6 progress, a post-report ADO decision, three-pane evidence review, report links, conversation, and one F4-backed What-if Draft. Shared history is limited to TA Assist-owned turns; unrelated Copilot history is never synchronized. The source workbook is read-only, Surface MCP is the only ADO path, and F7 is an explicit unavailable placeholder.

**Feature:** Give the engineer a complete, trustworthy TA result without silently changing the uploaded source data.

**Tasks:**

- Render the original factor table in a read-only evidence pane with the same values, layout, and units as the source workbook.
- Display the extracted Loop image with the corresponding worksheet evidence.
- Produce one consolidated report across selected worksheets, including a quick summary of highlighted TA risks.
- Link each conclusion to its visible source row or cell; selecting a conclusion highlights the related evidence.
- Keep source data read-only. Changes happen only through Excel re-upload or a user-confirmed system proposal.
- Provide entry points for report backup and ADO reminder triggering.

---

## User Story 2 - DIM ID and Drawing Governance

**As an ME engineer, I want every factor tied to a drawing-scoped DIM ID and an auditable governance list, so missing or conflicting identifiers remain visible without blocking TA.**

### Acceptance Criteria

1. Build formal `(Drawing Number, DIM ID)` anchors for valid identifiers (F3).
2. Allow the engineer to create or link an optional ADO work item after the F6 report is validated (F3).
3. Automatically bind an owner when an ADO work item is linked; block the governed reminder workflow and prompt when no owner can be resolved (F3).
4. Update ADO Comment 0 through Surface MCP only after explicit confirmation of the prepared diff (F3).
5. Generate per-part dimension-chain lists and package them by category for drawing markup (F3).
6. Save the same confidential list locally when ADO or required capabilities are unavailable; TA continues (F3).

### F3 - Dimension-to-Drawing Association (DIM ID)

**Feature:** Link every TA factor to the drawing lifecycle using a stable DIM ID. This is identifier linking, not drawing OCR or image recognition.

**Tasks:**

- Treat Part Number as Drawing Number in the current contract and create the formal key from `(Drawing Number, DIM ID)`.
- Allow the same DIM ID on different drawings; flag duplicates within one normalized Drawing Number as `duplicate_conflict`.
- Classify one-digit numeric DIM IDs as nonblocking `suspected_invalid`; classify 2-4 digit numeric values as `valid`.
- Keep missing, suspicious, or conflicting identifiers in the local governance list while allowing TA to continue.
- Let the engineer upload the workbook and create or link an ADO work item; automatic parsing of an ADO attachment remains a later goal.
- Resolve the owner from the ADO owner or `Request By` field. When no owner is available, block the governed reminder workflow and prompt for one.
- Generate a per-part dimension-chain list: part name, join number, DIM ID, and exact source location.
- Group lists by part category and drawing so one drawing package can be sent to the responsible Microsoft and supplier engineers.
- Use only Surface MCP for ADO integration; Azure DevOps MCP is not required.
- Apply `prepare -> confirm -> execute` to Comment 0 and fail closed on version changes; do not update Description or append a separate comment.
- Do not read dates, evaluate deadline proximity, or run a scheduler.

---

## User Story 3 - Objective Conclusions and Comparable Options

**As an ME, I want conclusions to remain objective (facts plus rule checks), with comparable optimization options but no forced recommendation, so I can make the final engineering decision in review meetings.**

### Acceptance Criteria

1. The five-section report covers loop validity, capability versus specification, top contributors, structural risks, and parallel options. F5 owns the first three sections; the last two are delegated to F6.
2. When key information is missing, show a clarification card and assumption log; keep only dependent conclusions blocked until clarified (F5).
3. Link every rule-based conclusion back to knowledge-base evidence (F5).

### F5 - Data Interpretation

**Feature:** Convert calculations into a consistent, evidence-based TA reading while leaving the engineering decision with the ME reviewer.

**Tasks:**

- Consume controlled F0/F1/F3/F4 artifacts directly; workbook entry must first pass the F2 gate.
- Use four statement types: `FACT` for computed or directly observed evidence, `RULE` for an applicable F0 rule, `SIGNAL` for items needing engineering attention, and `OPTION` for unranked alternatives.
- Generate sections 1-3 of the five-section report: loop validity, capability versus specification, and top contributors. Delegate structural risks and parallel options to F6.
- Keep historical `f5-image-observation-v1` artifacts read-only compatible; create only v2 from new image-mode runs.
- For every selected worksheet, require exactly one observation for each of `tolerance_loop_closure`, `datum_chain`, `assembly_datum_face`, `stack_start`, and `direction`.
- Snapshot all active factor rows with original and mapped part/factor fields, numeric inputs, and source-cell provenance.
- Keep visual evidence in confidence-gated image `FACT`s and image-plus-text assessment in `image_text_context_review` `SIGNAL`s requiring ME review. Direction mapping uses structured `linkedVisualLabels`; free-text inference is prohibited.
- Validate v2 all-or-nothing. Observation-only failure discards the entire v2 and continues deterministic F5 with clarification; baseline identity and required-image errors fail closed.
- Create v2 once in an immutable UUID-scoped location and read it back before invocation. The F5 loader validates exact content against the schema, workbook/worksheet identity and selected set, snapshot/source provenance, carried `imageReference` identity, and the physical F1 image SHA-256. No pre-existing observation artifact digest exists; after acceptance, the workflow runner computes and records its SHA-256 in `Feature5-Run-Summary`.
- Evaluate RSS sigma, Cpk, and spec-window feasibility using the Rules Library.
- Order the top contributors by governed F4 contribution and explain only measurable causes supported by source evidence.
- Cite the F0 knowledge-base entry, rule version, and applicable scope for every `RULE` or capability conclusion.
- Show a clarification card and explicit assumption log when the assembly datum face, stack start, subsystem classification, or other required evidence is missing.
- Hold only the conclusions that depend on the unanswered question; continue analysis for evidence that is already sufficient.
- Support `workflow:f5` as a development entry and `/ta-assist-agent` as the product entry; never auto-publish to ADO or write back to the workbook.
- Retain F5.1 as an internal compatible core, not as the only available F5 entry. Keep the existing detailed F5 report and its controlled delegation unchanged; the available F6 workflow consumes that delegation without ranking F5 `OPTION` statements.

### F6 - Tolerance / Dimension-Chain Optimization

**Feature:** Run a governed optimization workflow after F5, quantify comparable options, and preserve the ME review decision.

**Tasks:**

- Accept exact F2/F3/F4/F5 artifact roots, one or more unique worksheet selections, and optional supplier capability, datum strategy, cost, and image-observation evidence. The app CLI uses the trusted repository runner and fixes output under `test/demo-output/f6-runs/<F5-root-name>/<UTC-run-id>/`.
- Keep ownership explicit: F5 owns baseline facts/rules/signals, clarifications, and v1/v2-compatible evidence; F6 owns scenario options, reverse solve, RSS apportionment, feasibility, impact ranking, and the final `Feature6-Report.md`.
- Calculate deterministic Top-1 -20% and frozen Top-3 -30% tolerance-band scenarios while preserving each original band center. Mean-shift centering is always `requires_engineering_review`.
- Reverse-solve target Cpk for a single factor, top three, RSS apportionment, and centering-plus-tighten, then verify every option through the F4 kernel. Support proportional-to-contribution, equal-allocation-among-top-N, bounded-by-capability, and residual-after-centering policies.
- Treat supplier capability, datum strategy, and cost as evidence-limited. Missing or mismatched support is `insufficient_evidence`, not an estimated result.
- Rank deterministic supported options as Highest Impact. Compute ROI only when all supported ranked options have known positive governed cost; otherwise report `ROI: not_computed` and never relabel Highest Impact as Highest ROI.
- Produce `Feature6-Report.md` plus optimization JSON/Markdown. Run Summary owns structured Workbook/Worksheet dispositions; F2-blocked worksheets appear only in workbook Input Validation and receive no capability or optimization numbers.
- Atomically publish exactly five confidential artifacts: `Feature6-Report.md`, optimization JSON/Markdown, run summary, and manifest. Keep source workbooks read-only; perform no ADO, network, or workbook write. Fail closed on schema, identity/hash, association, controlled-root, staging, atomic-commit, or committed-file identity failure.
- Preserve `comparison-request-v1` / `comparison-result-v1` as a separate legacy placeholder returning `feature_not_available`; do not confuse it with the available `f6-optimization-v1` workflow. See the [Feature Register](governance/feature-register.md).

---

## User Story 4 - Measured Cpk Feedback and Continuous Accuracy Improvement

**As a ME, I want to backfill measured Cpk by DIM ID, so the system can recalculate estimated-versus-actual gaps and improve future accuracy.**

### Acceptance Criteria

1. Import measured Cpk keyed by DIM ID (F7).
2. Recompute actual capability and show the gap versus the initial estimate (F7).
3. Upgrade matching capability entries from empirical to measured tier, with version history (F7).

### F7 - Closed-Loop Real-Cpk Feedback

**Feature:** Use real measured capability to improve the current TA result and make the knowledge base more accurate for later projects.

**Tasks:**

- Define a measured-data schema keyed by canonical DIM ID, including the measured Cpk, yield, distribution, source, and revision.
- Manually import standardized data from the agreed centralized SharePoint or platform store; automatic collection is later scope.
- Validate that the imported record has a stable DIM ID anchor before applying it.
- Recompute sigma and actual capability using measured data; handle non-normal distributions without assuming a normal conversion. Use fitting or Monte Carlo if needed (TBD).
- Show initial estimate versus measured result, including the real gap and updated tolerance range.
- Send a significant gap to F6 so the engineer can compare adjustment options.
- Upgrade the matching Capability Library entry from T3 empirical to T1 measured, increment its version, and retain history.
- Document external prerequisites: a maintained centralized measured-data store, appropriate permissions, and DIM ID governance from F3.

---

## Scope Notes

- The final engineering decision always remains with the ME engineer.
- Automatic extraction of drawing truth, 3D variation analysis, automatic measurement-data capture, and automatic Excel write-back are outside V1 scope. Optional F5 image observations remain visible evidence only.
- Multiple worksheets can be processed in parallel for speed, but they are still reviewed page by page with a human gate.

---
**Related docs:** [Architecture](01-architecture.md) · [End-to-End Flow](02-end-to-end-flow.md) · [Differentiation](03-differentiation.md) · [Design Decisions](05-design-decisions.md)