---
name: knowledge-library
description: Use when a user asks about TA knowledge, tolerance guidance, capability recommendations, or controlled engineering rules.
user-invocable: true
argument-hint: "<TA knowledge question>"
---

# Knowledge Library

Determine the interaction language from the user request that starts the current product workflow. Keep that language locked for the entire workflow, including every response, question, option label, progress update, action description, and final result. Do not re-detect language from confirmation answers, selected option labels, paths, worksheet names, artifact content, quoted text, tool output, or assistant messages. Change the locked language only when the user explicitly requests a language change or starts a new independent product workflow.

## Boundary

Query only repository-backed public knowledge, internal tolerance guidance, and interpretation rules through their controlled APIs. This capability has no standalone workflow command and creates no workbook artifact.

Present source version, evidence status, and missing knowledge explicitly. Never invent a command, recommendation, tolerance, distribution, capability value, or source.

Do not expose internal feature identifiers, workflow states, artifact kinds, or implementation filenames in user-facing text.