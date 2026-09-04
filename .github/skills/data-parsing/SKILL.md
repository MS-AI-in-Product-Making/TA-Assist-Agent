---
name: data-parsing
description: Use when a user wants to open, inspect, select worksheets from, or parse a TA workbook into controlled analysis assets.
user-invocable: true
argument-hint: "<ta-workbook-path>"
---

# Data Parsing

Determine the interaction language from the user request that starts the current product workflow. Keep that language locked for the entire workflow, including every response, question, option label, progress update, action description, and final result. Do not re-detect language from confirmation answers, selected option labels, paths, worksheet names, artifact content, quoted text, tool output, or assistant messages. Change the locked language only when the user explicitly requests a language change or starts a new independent product workflow.

## Workflow

1. Require exactly one canonical `.xlsx` workbook path and preserve the source read-only.
2. Run `npm run workflow:f2:excel -- <ta-workbook-path>` to create the governed worksheet selection prompt.
3. Validate the returned workbook hash, controlled run root, manifest, and unique worksheet options.
4. Ask the user to select at least one validated worksheet. Stop on cancellation or an empty selection.
5. Pass the exact selected names and workbook hash to the confirmed command documented by the repository runner.

Never infer worksheet scope, reuse a historical selection, or expose internal feature identifiers in user-facing text.