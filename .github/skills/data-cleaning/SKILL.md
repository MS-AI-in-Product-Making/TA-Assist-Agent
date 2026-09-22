---
name: data-cleaning
description: Use when a user asks to validate, clean, normalize, or check required TA workbook inputs before calculation.
user-invocable: true
argument-hint: "<ta-workbook-path>"
---

# Data Cleaning

Determine the interaction language from the user request that starts the current product workflow. Keep that language locked for the entire workflow, including every response, question, option label, progress update, action description, and final result. Do not re-detect language from confirmation answers, selected option labels, paths, worksheet names, artifact content, quoted text, tool output, or assistant messages. Change the locked language only when the user explicitly requests a language change or starts a new independent product workflow.

## Workflow

Use the confirmed Data Parsing output for the current workbook revision and reuse the same canonical analysis root. Run the existing `workflow:f2:excel` confirmed path; required-field, capability, distribution, identifier, and exception checks remain inside the deterministic runner.

Preserve ready and blocked worksheet results exactly. Keep new full-flow parsing assets in the parsing-stage root and cleaning artifacts in the cleaning-stage root. Report validation findings with worksheet and source-row provenance, and never repair source workbook data automatically.

Never bypass required-field gates, infer missing identifiers, create a new `f2-runs` or timestamped workspace layer for current writes, or expose internal feature identifiers in user-facing text.

## Internal executor contract

- The inherited parsing-stage root is `01 - F1 Data Parsing`.
- The cleaning-stage root is `02 - F2 Data Cleaning`.
- Read the exact parsing handoff from `01 - F1 Data Parsing`; if an internal reference is needed, store the path/reference instead of duplicating parsing artifacts into stage 2.
- Keep cleaning reports, cleaning-stage logs, and cleaning validation artifacts in `02 - F2 Data Cleaning`.
- Current writes must not create a new `f2-runs`, timestamped, or UUID workspace layer beneath the canonical analysis root.