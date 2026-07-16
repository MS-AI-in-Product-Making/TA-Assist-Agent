# Feature Breakdown (V1)

> Structure: **Epic -> User Story -> Feature -> Task**. The Feature IDs map to the existing ADO features shown in the project backlog. Each task is written as an implementable piece of work.

## Epic

**AI Assist Agent (V1)**

> Goal: help ME engineers turn a TA workbook into a reliable, traceable first-pass analysis quickly. The assistant cleans the input, runs Excel-consistent calculations, highlights risks with evidence, and keeps DIM IDs and measured capability connected over time.

## Feature Map

| ID | ADO Feature | Purpose |
|---|---|---|
| F0 | Knowledge Base | Provide the controlled rules, capability ranges, and terminology behind every check. |
| F1 | TA Report Parsing & Asset Prep | Find TA sheets, read their data, and collect the Loop image. |
| F2 | Data Cleansing | Find missing or unreasonable TA inputs before calculation. |
| F3 | Dimension-to-Drawing Association (DIM ID) | Keep each factor linked to a drawing dimension and govern missing IDs. |
| F4/F5 | Method Recommendation & Calculation Engine | Select the calculation reference and reproduce the Excel result. |
| F6 | Data Interpretation | Explain risks using facts and rules, without forcing a decision. |
| F7 | Tolerance / Dimension-Chain Optimization | Compare quantified improvement options. |
| F8 | Closed-Loop Real-Cpk Feedback | Feed measured capability back by DIM ID. |
| F9 | User Interaction, Read-Only Pane & Output | Give the engineer a complete report and visible source evidence. |

---

## User Story 1 - Reliable First-Pass TA Result and Summary

**As an ME engineer, when I upload a TA file, I want the assistant to automatically find all TA sheets, clean the data first, and flag unreasonable tolerance inputs, so I can get a reliable first-pass result and a complete report quickly.**

The result must include a quick, easy-to-scan summary of the risks found in the TA.

### Acceptance Criteria

1. Automatically detect TA sheets and process multiple selected sheets in parallel (F1).
2. Check required fields, specification ranges, and distribution reasonableness for tolerance inputs (F2).
3. Recommend a method by factor count and calculate with an Excel-consistent engine (F4/F5).
4. Output one consolidated interpretation report and a read-only evidence panel, including a highlighted risk summary (F9).

### F0 - Knowledge Base

**Feature:** Maintain the controlled reference data used to decide whether a TA input or conclusion is reasonable.

**Tasks:**

- Maintain the Capability Library: tolerance bands, process capability, recommended distributions, and source tiers (T1 measured/PPAP, T2 historical or supplier input, T3 engineering estimate, T0 no data).
- Maintain the Rules Library, including CTS = 6 sigma, CTF = 4 sigma, and the default Cpk target of 1.33.
- Maintain the Terminology Library for part categories, subsystems, and datum names.
- Record source, confidence, effective version, owner, change history, and coverage for every library entry.
- Mark T0 as `process capability unknown`; do not claim feasibility without evidence.

### F1 - TA Report Parsing & Asset Prep

**Feature:** Find the TA content in uploaded workbooks and prepare the data and images needed for review.

**Tasks:**

- Accept one or more uniquely named `.xlsx` files and scan every worksheet for the supported TA layout.
- Show the detected workbook, worksheet, version/date, and tolerance-loop description for user selection.
- Let the user select one sheet, multiple sheets, or all detected TA sheets before analysis begins.
- Process selected worksheets in parallel, while keeping each sheet independently reviewable.
- Read the factor table, record processing time, and retain a local debug JSON record by file, sheet, version, and date.
- Extract the Loop screenshot in parallel, label it with its source worksheet and loop description, and retain it with the same run record.
- Offer manual sheet selection when automatic detection cannot recognize an irregular layout.

### F2 - Data Cleansing

**Feature:** Check the input before calculation so the first-pass result is based on complete and reasonable data.

**Tasks:**

- Check required fields: factor description, part name, part category, design nominal, tolerance, long-term/safety factor, sigma level, and distribution.
- Block the run when nominal or tolerance is missing; show the missing-field list and require the user to correct and re-upload the workbook.
- Treat optional fields, such as drawing number, as prompts rather than calculation blockers.
- Compare each tolerance range and distribution with the matching Capability Library entry; flag in-library and out-of-library results.
- Check DIM ID and Part Number completeness, duplicate IDs, malformed IDs, and supplier-to-Microsoft ID crosswalk conflicts.
- Present all non-blocking differences clearly. The engineer can edit the source Excel or continue with a recorded exception.

### F4/F5 - Method Recommendation & Calculation Engine

**Feature:** Choose the appropriate 1D reference method and produce results that match the TA workbook.

**Tasks:**

- Count factors and identify CTS/CTF context: fewer than 4 factors recommends Worst Case; 4-10 recommends 1D RSS; more than 10 flags a 3D VA referral to the DM team.
- Compute and show both Worst Case and RSS outputs whenever the sheet is within V1 scope.
- Reproduce factor-level, system-level, and capability metrics using the same formulas as the Excel template.
- Calculate mean, tolerance, 1-sigma, contribution, Cp, Cpk, Z, DPM, and yield.
- Regress the calculation engine against the approved sample result: Cpk 0.74, DPM about 26,500, FAIL.

### F9 - User Interaction, Read-Only Pane & Output

**Feature:** Give the engineer a complete, trustworthy TA result without silently changing the uploaded source data.

**Tasks:**

- Render the original factor table in a read-only evidence pane with the same values, layout, and units as the source workbook.
- Display the extracted Loop image with the corresponding worksheet evidence.
- Produce one consolidated report across selected worksheets, including a quick summary of highlighted TA risks.
- Link each conclusion to its visible source row or cell; selecting a conclusion highlights the related evidence.
- Keep source data read-only. Changes happen only through Excel re-upload or a user-confirmed system proposal.

---

## User Story 2 - DIM ID and Drawing Governance Before Key Milestones

**As an ME engineer, I want every factor tied to a unique DIM ID, with placeholder-first and mandatory DIM ID backfill before key milestones, plus automatic reminders to both Microsoft and supplier engineers, so critical dimensions do not break before the milestone review.**

### Acceptance Criteria

1. Build unique DIM ID-to-factor anchors, with a placeholder-then-backfill flow (F3).
2. Allow the engineer to create or link an optional ADO work item after manually uploading the `.xlsx` file (F3).
3. Automatically bind an owner when an ADO work item is linked; block the governed reminder workflow and prompt when no owner can be resolved (F3).
4. Send server-side milestone reminders to complete critical-dimension definitions on drawings (F3).
5. Generate per-part dimension-chain lists and package them by category for drawing markup (F3).
6. Keep status and history in ADO for full traceability (F3).

### F3 - Dimension-to-Drawing Association (DIM ID)

**Feature:** Link every TA factor to the drawing lifecycle using a stable DIM ID. This is identifier linking, not drawing OCR or image recognition.

**Tasks:**

- Create a unique `DIM ID <-> factor <-> future measurement` anchor for every factor in a submission.
- Assign a placeholder when no DIM ID or drawing exists yet, while allowing the TA calculation to continue.
- Require DIM ID backfill before EV1 or another configured key milestone; raise a clarification card when an ID is duplicated, conflicted, or cannot be mapped.
- Maintain a versioned crosswalk from supplier ID plus revision to Microsoft canonical DIM ID.
- Let the engineer upload the workbook and create or link an ADO work item; automatic parsing of an ADO attachment remains a later goal.
- Resolve the owner from the ADO owner or `Request By` field. When no owner is available, block the governed run and prompt for one.
- Generate a per-part dimension-chain list: part name, join number, DIM ID, and exact source location.
- Group lists by Lib 3 part category and drawing so one drawing package can be sent to the responsible Microsoft and supplier engineers.
- Run a server-side service independently of analysis. For linked ADO items, it checks milestones and open items weekly or monthly, then sends reminders before EV1 or another configured key milestone.
- Send an immediate reminder when a linked ADO item has missing critical dimensions, and a packaged periodic reminder to the Microsoft and supplier owners for drawing markup.
- Track `placeholder -> DIM ID filled -> marked on drawing` with history on the ADO work item.

---

## User Story 3 - Objective Conclusions and Comparable Options

**As an ME, I want conclusions to remain objective (facts plus rule checks), with comparable optimization options but no forced recommendation, so I can make the final engineering decision in review meetings.**

### Acceptance Criteria

1. Interpretation covers loop validity, capability versus specification, top contributors, structural risks, and parallel options (F6).
2. When key information is missing, show a clarification card and assumption log; keep dependent conclusions blocked until clarified (F6).
3. Link every rule-based conclusion back to knowledge-base evidence (F6).

### F6 - Data Interpretation

**Feature:** Convert calculations into a consistent, evidence-based TA reading while leaving the engineering decision with the ME reviewer.

**Tasks:**

- Use four statement types: `FACT` for computed results, `RULE` for threshold checks, `SIGNAL` for items needing engineering attention, and `OPTION` for parallel alternatives.
- Generate the five required interpretation sections: loop validity, capability versus specification, top contributors, structural risks, and parallel options.
- Check loop closure, datum-chain consistency, assembly datum face, stack start, and additive/subtractive direction.
- Evaluate RSS sigma, Cpk, and spec-window feasibility using the Rules Library.
- Rank the top contributors and explain their measurable cause, such as large tolerance or mid-chain amplification.
- Flag structural risks, including cross-subsystem chains, non-geometric variables, and overly long stacks, without making unsupported conclusions.
- Cite the knowledge-base entry, version, and coverage for every `RULE` or capability conclusion.
- Show a clarification card and assumption log when the assembly datum face, stack start, subsystem classification, or other required evidence is missing.
- Hold only the conclusions that depend on the unanswered question; continue analysis for evidence that is already sufficient.

### F7 - Tolerance / Dimension-Chain Optimization

**Feature:** Present quantified ways to improve a risk without ranking or forcing an engineering recommendation.

**Tasks:**

- Detect nominal offset and show the Cpk improvement from mean-shift centering.
- Rank tolerance changes using contribution-weighted leverage and estimate the relative cost impact.
- Apportion required RSS sigma reduction across the top two or three contributors.
- Run what-if calculations for tightening or loosening an individual factor and show the Cpk change.
- Generate two or three parallel reverse-solve options: single-point tighten, combined top-contributor tighten, and center plus tighten.
- Check each option against the Capability Library; show a red warning when the required tolerance is not process-achievable and mark T0 as feasibility unknown.
- Apply CTS/CTF rules: CTF may show a specification-versus-yield trade-off; CTS must not loosen the specification.

---

## User Story 4 - Measured Cpk Feedback and Continuous Accuracy Improvement

**As a ME, I want to backfill measured Cpk by DIM ID, so the system can recalculate estimated-versus-actual gaps and improve future accuracy.**

### Acceptance Criteria

1. Import measured Cpk keyed by DIM ID (F8).
2. Recompute actual capability and show the gap versus the initial estimate (F8).
3. Upgrade matching capability entries from empirical to measured tier, with version history (F8).

### F8 - Closed-Loop Real-Cpk Feedback

**Feature:** Use real measured capability to improve the current TA result and make the knowledge base more accurate for later projects.

**Tasks:**

- Define a measured-data schema keyed by canonical DIM ID, including the measured Cpk, yield, distribution, source, and revision.
- Manually import standardized data from the agreed centralized SharePoint or platform store; automatic collection is later scope.
- Validate that the imported record has a stable DIM ID anchor before applying it.
- Recompute sigma and actual capability using measured data; handle non-normal distributions without assuming a normal conversion.
- Show initial estimate versus measured result, including the real gap and updated tolerance range.
- Send a significant gap to F7 so the engineer can compare adjustment options.
- Upgrade the matching Capability Library entry from T3 empirical to T1 measured, increment its version, and retain history.
- Document external prerequisites: a maintained centralized measured-data store, appropriate permissions, and DIM ID governance from F3.

---

## Scope Notes

- The final engineering decision always remains with the ME engineer.
- Drawing-content image reading, 3D variation analysis, automatic measurement-data capture, and automatic Excel write-back are outside V1 scope.
- Multiple sheets are processed in parallel for speed, but are reviewed page by page with a human gate.

---
**Related docs:** [Architecture](01-architecture.md) · [End-to-End Flow](02-end-to-end-flow.md) · [Differentiation](03-differentiation.md) · [Design Decisions](05-design-decisions.md)