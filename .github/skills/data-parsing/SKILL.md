---
name: data-parsing
description: Use when a user wants to open, inspect, select worksheets from, or parse a TA workbook into controlled analysis assets.
user-invocable: true
argument-hint: "<ta-workbook-path>"
---

# Data Parsing

Use the language of the user's current request for every response, question, progress update, and action description.

## Workflow

1. Require exactly one canonical `.xlsx` workbook path and preserve the source read-only.
2. Run `npm run workflow:f2:excel -- <ta-workbook-path>` to create the governed worksheet selection prompt.
3. Validate the returned workbook hash, controlled run root, manifest, and unique worksheet options.
4. Ask the user to select at least one validated worksheet. Stop on cancellation or an empty selection.
5. Pass the exact selected names and workbook hash to the confirmed command documented by the repository runner.

Never infer worksheet scope, reuse a historical selection, or expose internal feature identifiers in user-facing text.