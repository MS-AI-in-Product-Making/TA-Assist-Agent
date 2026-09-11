# F7 TA Process and Requirements Checklist Design

**Date:** 2026-09-10

## Goal

Replace the matched-entry presentation with a numbered `TA Process and Requirements` checklist. Show every F0 item that the current F7 facts can evaluate, including satisfied items, while marking only demonstrable noncompliance as a red `Warning`.

## Behavior

- List F0 non-definition entries whose required facts are all supplied by F7: `actor`, `analysisMethod`, `toleranceCount`, and, when calculation is available, `requirementGapPresent`.
- Preserve governed F0 source order and controlled title/message text.
- Treat a matched conditional escalation or requirement-gap entry as noncompliant and mark it `Warning`.
- Keep universal process guidance as normal Guidance. F7 cannot prove completion of evidence-dependent actions such as priority alignment or multiplier justification, so it does not invent warnings for them.
- Do not list entries requiring unavailable actor-role, lifecycle, characteristic-class, subject, geometry, factor-representation, or workbook-area facts.
- Do not display entry IDs, entry types, or source version metadata.
- Keep the entire section unavailable if F0 loading or evaluation fails.

## Presentation

The section title is `TA Process and Requirements`. Entries use visible decimal numbering. A normal item shows its controlled title and message without a badge. A noncompliant item adds a `Warning` badge and applies red text to the complete item, including its number.

## Testing

Builder tests cover satisfied and violated conditional items, stable source order, omission of rules requiring unsupported facts, and fail-closed behavior. Component tests cover the new title, numbering semantics, hidden IDs/types/version, and red Warning treatment only for noncompliant items.
