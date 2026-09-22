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
3. Validate the returned workbook hash, canonical analysis root, fixed parsing-stage root, fixed cleaning-stage root, manifest, and unique worksheet options.
4. Ask the user to select at least one validated worksheet. Stop on cancellation or an empty selection.
5. Preserve the canonical analysis root from this step as the current workbook workspace and pass the exact selected names and workbook hash to the confirmed command documented by the repository runner.

Never infer worksheet scope, reuse a historical selection, fall back to legacy `test/demo-output` write roots, or expose internal feature identifiers in user-facing text.

## Internal executor contract

- The parsing-stage root for current full-flow workbook writes is `01 - F1 Data Parsing`.
- The cleaning-stage root for the same workspace is `02 - F2 Data Cleaning`.
- The worksheet-selection prompt, selection registry/reference, and parsing-stage logs stay in `01 - F1 Data Parsing`.
- Do not copy `Feature1-Selection.json` or other parsing evidence into `02 - F2 Data Cleaning`.
- Current writes must not create a new `f2-runs`, timestamp, or UUID directory layer beneath the canonical analysis root.