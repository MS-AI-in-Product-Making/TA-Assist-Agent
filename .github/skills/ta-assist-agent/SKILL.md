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

The interaction language lock governs conversation only. Regardless of the interaction language, the final Markdown and PDF engineering reports are always English. Report-bound model interpretation prose must also be generated in English. Preserve the actual interaction language in governed metadata and use it for user-facing workflow communication; never use it to localize report content.

**REQUIRED SUB-SKILL: Use design-optimization.** Preserve its workbook entry governance gates without omitting or merging confirmations. Use its report-informed candidate/ADO/final sequence in the canonical workspace.

**REQUIRED SUB-SKILL: Use pdf-report-export.** Require the hash-validated PDF report in the same successful governed publication as the Markdown report.

## Entry

- Accept exactly one `.xlsx` TA workbook path.
- If no path is supplied, ask for exactly one workbook path.
- Never infer a workbook from editor state, prior runs, uploads, or similarly named files.

## Analysis Request Context

Capture the analysis request context once when the workflow-start request is received. Record `requestedAt` as that request instant with an explicit offset, record `utcOffsetMinutes` from the VS Code host, and record source: `vscode`. Do not prompt the user for analysis request context. Preserve the same analysis request context for the entire workbook run and pass it to Design Optimization without reconstructing or refreshing it at a later phase.

Analysis Context and Optimization Targets are separate optional engineering inputs. Capturing the analysis request context does not change their standard-path `NOT_PROVIDED` decisions.

## Execution Continuity

- Allocate once before F1: `node scripts/create-analysis-workspace.mjs --workbook <absolute.xlsx>` (optional `--test-root <absolute-directory>`). Retain the returned canonical `analysisRoot`, six `stagePaths`, and `summaryPath`.
- Pass `--analysis-root <canonical-root>` to every F1-F6 stage command, including the F1 `--selection-only` prompt and the confirmed F1 invocation. Use the exact preceding stage paths from this workspace; do not substitute legacy roots or output-root environment overrides.
- Preserve F1 -> F2 -> F3 -> F4 -> F5 -> F6 and both worksheet gates (two confirmations); drawing-governance publishing confirmation remains separately required. Selection-only creates the prompt without completing F1. Only confirmed parsing advances to F2.
- Never allocate a second root during one analysis. A failed or completed root is immutable; there is no resume/retry mode. If a crash leaves a running stage or lock, stop and report incomplete execution, not success. A separately requested new analysis must allocate a new root.
- Use F5 -> validated F6 candidate -> ADO choice/write -> final F6 publish. Invoke F6 with `--candidate` and the same canonical root before any ADO question or side effect. Only `candidate_validated` with validated internal report/PDF paths permits the mode-choice and separate final-write confirmations. Candidate failure blocks ADO and fails the root. The candidate keeps F6 pending, is not a final user report, and lives only under stage6 `evidence/candidate`; crashes remain running and cannot resume. After the terminal ADO outcome, run F6 once without `--candidate`. It revalidates its candidate and publishes the final five-file set once. Keep candidate evidence through final validation and root completion; final failure preserves it with the failed summary.
- Candidates persist an `internalOnly: true` governed `Feature6-Candidate-Receipt.json`; public readers reject both valid and malformed reserved markers. After final validation and completed-summary readback, remove only the exact pinned candidate files/receipts and empty directories. A `candidate_cleanup_failed` result is not clean success: suppress final paths, report the cleanup failure, preserve remaining evidence, and never reopen the already completed immutable root. Final presentation requires both a successful terminal command and the completed root summary.
- Both `workflow:f2:excel` commands in W1/W2 must receive `--analysis-root <canonical-root>`; W2 also receives the W1 `--selection-manifest`. They reuse the allocation and drive the F1/F2 child lifecycles, never allocate another workspace.
- Each stage atomically records started, validator-confirmed root-relative artifacts on success, or failed with downstream stages blocked. Do not manually edit the root summary or bypass these transitions.
- Before presenting any final F6 report paths, read `analysis-run-summary.json` and require `overallStatus === "completed"` plus successful governed PDF/manifest validation. A completed command or existing report file alone is not final success. Resolve only the validated F6 artifact references recorded by the summary.

- A tool timeout or background transition is not a command failure. Treat only a terminal nonzero exit, a structured failed result, or a governed validation failure as failure.
- When a required command is moved to the background, retain the execution handle and continue retrieving its result until the command reaches a terminal state or requests input.
- Do not send a final response while a required command is still running. Provide a progress update and keep the workflow active instead.

## Product Boundary

Present the workflow as **TA Assist Agent** and use product capability names in user-facing communication. Do not expose internal feature IDs, runner names, schema names, or artifact implementation details.

The source workbook remains read-only. Preserve worksheet confirmations, internal image evaluation before recording standard-path Analysis Context and Optimization Targets as NOT_PROVIDED, drawing-governance publishing confirmation, post-ADO immutable final report publication, multimodal image and complete-Factor validation, deterministic calculation authority, artifact containment, hashes, English-only report content, and final report validation.

On success, present only the validator-confirmed post-ADO final `<validated workbook basename> - TA ENGINEERING ANALYSIS REPORT.md` and `<validated workbook basename> - TA ENGINEERING ANALYSIS REPORT.pdf` as the engineering reports. Present exactly two validator-confirmed canonical absolute paths, with the Markdown path first and the PDF path second. Do not convert either report path to a workspace-relative link. Never modify the pre-ADO report set in place. Internal JSON, run-summary, and manifest artifacts remain governed implementation records, not additional user reports.