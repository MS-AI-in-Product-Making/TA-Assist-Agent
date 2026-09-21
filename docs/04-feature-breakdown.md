# Feature Breakdown (Current)

> Structure: **Epic -> User Story -> Feature -> Task**. The active governed capability set is F0-F7. Product entry surfaces are Copilot Skills and direct workflow scripts rather than a separate F8 feature.

## Epic

**TA Assist Agent**

> Goal: help ME engineers turn a TA workbook into a reliable, traceable first-pass analysis result. The product cleans the input, runs Excel-consistent calculations, highlights risks with evidence, keeps DIM IDs connected to governance, and supports a measured-capability follow-up.

## Feature Map

| ID | ADO Feature | Purpose |
|---|---|---|
| F0 | Knowledge Base | Provide the controlled rules, capability ranges, and terminology behind every check and interpretation. |
| F1 | TA Report Parsing & Asset Prep | Find TA sheets, read their data, and collect Loop-image evidence. |
| F2 | Data Cleansing | Find missing items or unreasonable TA inputs before calculation. |
| F3 | Dimension-to-Drawing Association (DIM ID) | Keep each factor linked to a drawing dimension and govern missing IDs. |
| F4 | Method Recommendation & Calculation Engine | Recommend the calculation method and reproduce an Excel-consistent result. |
| F5 | Data Interpretation | Explain risks using facts and rules, without forcing a decision. |
| F6 | Design Optimization | Compare the quantified effect of governed improvement options and publish the engineering report. |
| F7 | Closed-Loop Real-Cpk Feedback | Feed measured capability back by DIM ID after a validated baseline exists. |

## Product Entry Surfaces

- **Complete workbook workflow:** `.github/skills/ta-assist-agent/SKILL.md`
- **Governed report workflow:** `.github/skills/design-optimization/SKILL.md`
- **Focused follow-up skills:** `result-interpretation`, `drawing-governance`, `ta-real-measurement-analysis`, and `pdf-report-export`
- **Direct engineering workflows:** `workflow:f2:excel`, `workflow:f3`, `workflow:f4`, `workflow:f5`, `workflow:f6`, `dev:f7:api`, and `dev:f7:web`

These entry surfaces start or continue the same F0-F7 engineering contracts; they do not replace the underlying governed artifacts.

## F1 to F2 Evidence Ownership

F1 owns the only physical worksheet image artifact. F2 carries a hash-bound `imageReference` to that F1 artifact and renders a relative link instead of creating an F2 copy. F1 also preserves the exact Response Summary `sourceLabel` and cached formula values for `1σ` and `% Cont. to σ`; F2 displays or projects those values without renaming or recalculating them.

## User Story 1 - Reliable First-Pass TA Result and Summary

**As an ME engineer, when I provide a TA workbook, I want the product to identify all TA worksheets, clean the data first, and flag unreasonable tolerance inputs, so I can get a reliable first-pass result and a complete report quickly.**

### Acceptance Criteria

1. Automatically detect TA sheets and process multiple selected sheets in parallel (F1).
2. Check required fields, specification ranges, and distribution reasonableness for tolerance inputs (F2).
3. Recommend a method based on factor count and calculate with an Excel-consistent engine (F4).
4. Publish one consolidated interpretation and optimization report with linked read-only evidence and explicit blockers (F5/F6).

### F0 - Knowledge Base

- Maintain the Capability Library: tolerance bands, process capability, recommended distributions, and source tiers (T1 measured/PPAP, T2 historical or supplier input, T3 engineering estimate, T0 no data).
- Maintain the Rules Library, including CTS = 6 sigma, CTF = 4 sigma, and the default Cpk target of 1.33.
- Maintain the Terminology Library for part categories, subsystems, and datum names.
- Record source, confidence, effective version, owner, change history, and coverage for every library entry.
- Mark T0 as `process capability unknown`; do not claim feasibility when evidence is missing.

### F1 - TA Report Parsing & Asset Prep

- Accept one or more uniquely named `.xlsx` files and scan every worksheet for the supported TA layout.
- Show the detected workbook, worksheet, version/date, and tolerance-loop description for user selection.
- Return worksheet options before analysis and require an explicit selection bound to the workbook content hash; reject stale confirmations after the file changes.
- Process selected worksheets in parallel while keeping each page independently reviewable.
- Resolve the factor table from its semantic header cluster rather than fixed columns, record processing time, and retain a local debug JSON record.
- Extract the Loop screenshot in parallel, label it with its source worksheet and loop description, and retain it with the same run record.

### F2 - Data Cleansing

- Check required fields: factor description, part name, part category, design nominal, tolerance, long-term/safety factor, sigma level, distribution, and cross-section image.
- Require Lower Spec Limit, Upper Spec Limit, and Target σ Level from the worksheet Response Summary; never substitute values from Suggested Spec.
- Block the run when nominal or tolerance is missing; show the missing-field list and require workbook correction and re-upload.
- Isolate blocking at worksheet level: ready worksheets continue and each emits one F4 handoff, while blocked worksheets emit none.
- Compare each tolerance range and distribution with the matching Capability Library entry and keep non-blocking differences explicit.
- Check DIM ID and Drawing Number quality without silently mutating source data.

## User Story 2 - Drawing Governance

**As an ME engineer, I want every factor tied to a drawing-scoped DIM ID and an auditable governance list, so missing or conflicting identifiers remain visible without blocking valid TA work.**

### F3 - Dimension-to-Drawing Association

- Treat Part Number as Drawing Number in the current contract and create the formal key from `(Drawing Number, DIM ID)`.
- Allow the same DIM ID on different drawings; flag duplicates within one normalized Drawing Number as `duplicate_conflict`.
- Keep missing, suspicious, or conflicting identifiers in the governance list while allowing TA to continue where calculation evidence is otherwise sufficient.
- Use only the governed Surface MCP flow for optional ADO publication.
- Apply `prepare -> confirm -> execute` to Comment 0 and fail closed on version changes.

## User Story 3 - Objective Conclusions and Comparable Options

**As an ME reviewer, I want conclusions to remain objective and options to stay comparable, so I can make the final engineering decision with traceable evidence.**

### F4 - Method Recommendation & Calculation Engine

- Count factors and identify CTS/CTF context: fewer than 4 factors recommends Worst Case; 4-10 recommends 1D RSS; more than 10 flags a 3D VA referral to the DM team.
- Compute and show both Worst Case and RSS outputs whenever the sheet is within V1 scope.
- Reproduce factor-level, system-level, and capability metrics using the same formulas as the Excel template.
- Calculate mean, tolerance, 1-sigma, contribution, Cp, Cpk, Z, DPM, and yield.

### F5 - Data Interpretation

- Consume controlled F0/F1/F3/F4 artifacts directly; workbook entry must first pass the F2 gate.
- Use four statement types: `FACT`, `RULE`, `SIGNAL`, and `OPTION`.
- Generate baseline governed interpretation and preserve read-only compatibility for historical artifacts.
- Keep visual evidence in confidence-gated image `FACT`s and image-plus-text assessment in `image_text_context_review` `SIGNAL`s requiring ME review.
- Show clarification cards and explicit assumption logs when required evidence is missing.

### F6 - Design Optimization

- Accept exact F2/F3/F4/F5 artifact roots, worksheet selections, and optional governed context or optimization targets.
- Keep ownership explicit: F5 owns baseline facts/rules/signals; F6 owns comparable optimization outputs and the final engineering report.
- Reverse-solve target Cpk, apply governed RSS allocation policies, and verify every option through the F4 kernel.
- Treat supplier capability, datum strategy, and cost as evidence-limited inputs.
- Publish the validated Markdown/PDF report plus governed optimization artifacts without writing back to the workbook.

## User Story 4 - Measured Capability Follow-Up

**As an ME engineer, I want to compare measured capability against the validated baseline, so future guidance reflects actual production evidence instead of assumptions alone.**

### F7 - Closed-Loop Real-Cpk Feedback

- Bind measured samples to a validated baseline analysis rather than running as an implicit continuation.
- Evaluate actual vs estimated capability by governed DIM-ID linkage.
- Produce reviewable feedback artifacts without automatically rewriting the knowledge base.
- Keep the F7 API, Web app, and analysis workflow independent from the F0-F6 report workflow.
