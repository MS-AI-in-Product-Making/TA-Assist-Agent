---
name: data-cleaning
description: Use when a user asks to validate, clean, normalize, or check required TA workbook inputs before calculation.
user-invocable: true
argument-hint: "<ta-workbook-path>"
---

# Data Cleaning

Determine the interaction language from the user request that starts the current product workflow. Keep that language locked for the entire workflow, including every response, question, option label, progress update, action description, and final result. Do not re-detect language from confirmation answers, selected option labels, paths, worksheet names, artifact content, quoted text, tool output, or assistant messages. Change the locked language only when the user explicitly requests a language change or starts a new independent product workflow.

## Workflow

Use the confirmed Data Parsing output for the current workbook revision. Run the existing `workflow:f2:excel` confirmed path; required-field, capability, distribution, identifier, and exception checks remain inside the deterministic runner.

Preserve ready and blocked worksheet results exactly. Report validation findings with worksheet and source-row provenance, and never repair source workbook data automatically.

Never bypass required-field gates, infer missing identifiers, or expose internal feature identifiers in user-facing text.