---
name: feedback-application
description: Use when a user asks to import measurement feedback, compare observed results with an existing TA analysis, or apply reviewed feedback.
user-invocable: true
argument-hint: "<feedback-input-or-existing-session>"
---

# Feedback Application

Determine the interaction language from the user request that starts the current product workflow. Keep that language locked for the entire workflow, including every response, question, option label, progress update, action description, and final result. Do not re-detect language from confirmation answers, selected option labels, paths, worksheet names, artifact content, quoted text, tool output, or assistant messages. Change the locked language only when the user explicitly requests a language change or starts a new independent product workflow.

## Availability boundary

Use only the feedback import, preview, review, and analysis capabilities exposed by the current workbench. Preserve the existing analysis until imported feedback passes schema, identity, scope, and provenance checks.

If the required capability is unavailable, say so in the request language and retain the current results. Never invent a hidden command, bypass review, mutate a prior result, or expose internal feature identifiers in user-facing text.