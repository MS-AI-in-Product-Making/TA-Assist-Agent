---
name: feedback-application
description: Use when a user asks to import measurement feedback, compare observed results with an existing TA analysis, or apply reviewed feedback.
user-invocable: true
argument-hint: "<feedback-input-or-existing-session>"
---

# Feedback Application

Use the language of the user's current request for every response, question, progress update, and action description.

## Availability boundary

Use only the feedback import, preview, review, and analysis capabilities exposed by the current workbench. Preserve the existing analysis until imported feedback passes schema, identity, scope, and provenance checks.

If the required capability is unavailable, say so in the request language and retain the current results. Never invent a hidden command, bypass review, mutate a prior result, or expose internal feature identifiers in user-facing text.