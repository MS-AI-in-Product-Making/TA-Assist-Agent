---
name: ta-calculation
description: Use when a user asks to calculate tolerance performance, capability metrics, margins, yield, or what-if scenarios from validated TA inputs.
user-invocable: true
argument-hint: "<validated-data-report-path>"
---

# TA Calculation

Determine the interaction language from the user request that starts the current product workflow. Keep that language locked for the entire workflow, including every response, question, option label, progress update, action description, and final result. Do not re-detect language from confirmation answers, selected option labels, paths, worksheet names, artifact content, quoted text, tool output, or assistant messages. Change the locked language only when the user explicitly requests a language change or starts a new independent product workflow.

## Workflow

Run only the existing deterministic calculation workflow with a current validated Data Cleaning report. Preserve workbook hash, worksheet, table, source-row, unit, and calculation identities.
For the current workbook flow, reuse the canonical analysis root, keep the current calculation stage as the single writable location, consume the exact cleaning-stage artifact reference, and keep comparison/report/manifest publication atomic. Do not create extra legacy write roots for the current workspace flow.

Present baseline and scenario metrics separately. Never invent missing specifications, distributions, means, tolerances, margins, capability values, yield, or DPM. A rejected or identity-mismatched input fails closed.

Do not expose internal feature identifiers, workflow states, artifact kinds, or implementation filenames in user-facing text.

## Internal executor contract

Use `04 - F4 Calculation Engine` as the fixed stage folder for the current workbook flow. Do not create a new `f4-runs` or run-id child for the current workspace flow. Consume the exact cleaning-stage artifact reference from `02 - F2 Data Cleaning`.