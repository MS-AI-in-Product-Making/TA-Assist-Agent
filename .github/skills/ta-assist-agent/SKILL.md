---
name: ta-assist-agent
description: Use when a user wants to analyze one TA .xlsx workbook end to end, run a complete governed tolerance analysis, or produce the final TA Assist Agent engineering report. Do not use for generic spreadsheet editing, generic Cpk questions, generic Monte Carlo programming, actual or real measurement analysis, reviewed feedback import, or unrelated image analysis.
user-invocable: true
argument-hint: "[<ta-workbook-path>]"
---

# TA Assist Agent

Use this as the primary entry for a complete governed TA workbook analysis.

**REQUIRED SUB-SKILL: Use design-optimization.** Follow that Skill's workbook entry mode without omitting, merging, or reordering its governance gates.

## Entry

- Accept exactly one `.xlsx` TA workbook path.
- If no path is supplied, ask for exactly one workbook path.
- Never infer a workbook from editor state, prior runs, uploads, or similarly named files.
- Lock the interaction language from the request that starts this workflow and preserve it throughout the session.

## Product Boundary

Present the workflow as **TA Assist Agent** and use product capability names in user-facing communication. Do not expose internal feature IDs, runner names, schema names, or artifact implementation details.

The source workbook remains read-only. Preserve worksheet confirmations, drawing-governance publishing confirmation, multimodal image and complete-Factor validation, optional Analysis Context and Optimization Targets decisions, deterministic calculation authority, artifact containment, hashes, and final report validation.

On success, present only the validator-confirmed final `Feature6-Report.md` link and absolute path as the engineering report. Internal JSON, run-summary, and manifest artifacts remain governed implementation records, not additional user reports.