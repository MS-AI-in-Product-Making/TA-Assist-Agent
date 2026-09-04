---
name: ta-calculation
description: Use when a user asks to calculate tolerance performance, capability metrics, margins, yield, or what-if scenarios from validated TA inputs.
user-invocable: true
argument-hint: "<validated-data-report-path>"
---

# TA Calculation

Use the language of the user's current request for every response, question, progress update, and action description.

## Workflow

Run only the existing deterministic calculation workflow with a current validated Data Cleaning report. Preserve workbook hash, worksheet, table, source-row, unit, and calculation identities.

Present baseline and scenario metrics separately. Never invent missing specifications, distributions, means, tolerances, margins, capability values, yield, or DPM. A rejected or identity-mismatched input fails closed.

Do not expose internal feature identifiers, workflow states, artifact kinds, or implementation filenames in user-facing text.