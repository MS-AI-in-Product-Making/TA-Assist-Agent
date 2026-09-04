---
name: knowledge-library
description: Use when a user asks about TA knowledge, tolerance guidance, capability recommendations, or controlled engineering rules.
user-invocable: true
argument-hint: "<TA knowledge question>"
---

# Knowledge Library

Use the language of the user's current request for every response, question, progress update, and action description.

## Boundary

Query only repository-backed public knowledge, internal tolerance guidance, and interpretation rules through their controlled APIs. This capability has no standalone workflow command and creates no workbook artifact.

Present source version, evidence status, and missing knowledge explicitly. Never invent a command, recommendation, tolerance, distribution, capability value, or source.

Do not expose internal feature identifiers, workflow states, artifact kinds, or implementation filenames in user-facing text.