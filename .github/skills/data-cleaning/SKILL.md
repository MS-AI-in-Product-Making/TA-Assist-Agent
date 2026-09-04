---
name: data-cleaning
description: Use when a user asks to validate, clean, normalize, or check required TA workbook inputs before calculation.
user-invocable: true
argument-hint: "<ta-workbook-path>"
---

# Data Cleaning

Use the language of the user's current request for every response, question, progress update, and action description.

## Workflow

Use the confirmed Data Parsing output for the current workbook revision. Run the existing `workflow:f2:excel` confirmed path; required-field, capability, distribution, identifier, and exception checks remain inside the deterministic runner.

Preserve ready and blocked worksheet results exactly. Report validation findings with worksheet and source-row provenance, and never repair source workbook data automatically.

Never bypass required-field gates, infer missing identifiers, or expose internal feature identifiers in user-facing text.