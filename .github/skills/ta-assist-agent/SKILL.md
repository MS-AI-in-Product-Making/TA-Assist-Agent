---
name: ta-assist-agent
description: Use when a user wants to analyze one TA .xlsx workbook end to end, run a complete governed tolerance analysis, or produce the final TA Assist Agent engineering report. Do not use for generic spreadsheet editing, generic Cpk questions, generic Monte Carlo programming, actual or real measurement analysis, reviewed feedback import, or unrelated image analysis.
user-invocable: true
argument-hint: "[<ta-workbook-path>]"
---

# TA Assist Agent

Use this as the primary entry for a complete governed TA workbook analysis.

## Language Gate

Before any acknowledgement, plan, skill-loading update, or other user-visible text, determine and lock the interaction language from the natural language of the request that starts this workflow. A naturally English request locks English, and a naturally Chinese request locks Chinese; an explicit language request overrides that natural-language detection. Do not inherit the VS Code, host, or UI locale when the workflow-start request has a clear language. Use the locked language for the first response and every later response, question, option label, progress update, action description, and final result.

**REQUIRED SUB-SKILL: Use design-optimization.** Follow that Skill's workbook entry mode without omitting, merging, or reordering its governance gates.

**REQUIRED SUB-SKILL: Use pdf-report-export.** Require the hash-validated PDF report in the same successful governed publication as the Markdown report.

## Entry

- Accept exactly one `.xlsx` TA workbook path.
- If no path is supplied, ask for exactly one workbook path.
- Never infer a workbook from editor state, prior runs, uploads, or similarly named files.

## Execution Continuity

- A tool timeout or background transition is not a command failure. Treat only a terminal nonzero exit, a structured failed result, or a governed validation failure as failure.
- When a required command is moved to the background, retain the execution handle and continue retrieving its result until the command reaches a terminal state or requests input.
- Do not send a final response while a required command is still running. Provide a progress update and keep the workflow active instead.

## Product Boundary

Present the workflow as **TA Assist Agent** and use product capability names in user-facing communication. Do not expose internal feature IDs, runner names, schema names, or artifact implementation details.

The source workbook remains read-only. Preserve worksheet confirmations, internal image evaluation before recording standard-path Analysis Context and Optimization Targets as NOT_PROVIDED, drawing-governance publishing confirmation, multimodal image and complete-Factor validation, deterministic calculation authority, artifact containment, hashes, and final report validation.

On success, present only the validator-confirmed final `Feature6-Report.md` and `Feature6-Report.pdf` links and absolute paths as the engineering reports. Internal JSON, run-summary, and manifest artifacts remain governed implementation records, not additional user reports.