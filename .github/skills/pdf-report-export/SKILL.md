---
name: pdf-report-export
description: Use when a governed TA analysis must publish, validate, present, or troubleshoot the required Feature6 PDF engineering report.
user-invocable: false
---

# PDF Report Export

Use this as the required publication gate for every successful TA Assist Agent Design Optimization run.

## Required Contract

- Publish `<validated workbook basename> - TA ENGINEERING ANALYSIS REPORT.md` and `<validated workbook basename> - TA ENGINEERING ANALYSIS REPORT.pdf` from the same validated report projection.
- Require English-only content in both reports regardless of the interaction language recorded in governed metadata.
- Use `f6-artifact-set-v4` for current writes with exactly five files: Optimization JSON, dynamically named Markdown report, dynamically named PDF report, run summary, and manifest.
- Keep `f6-artifact-set-v3` with fixed `Feature6-Report.md` and `Feature6-Report.pdf` as historical read-only compatibility.
- Record and verify `finalReportPdfSha256` against the exact PDF bytes.
- Require a valid `%PDF-` signature, controlled-path image containment, and manifest-last publication.
- If PDF rendering, validation, hashing, or atomic publication fails, fail closed. Never present a Markdown-only run as successful.
- Preserve read-only validation for historical artifact-set versions; never add a PDF to or rewrite a historical run.

## Presentation

Present exactly two validator-confirmed canonical absolute paths. Present the Markdown path first and the PDF path second. Do not convert either report path to a workspace-relative link. Do not derive paths from run IDs or present temporary HTML/PDF paths.

## Safety

- Use only an installed controlled Edge or Chrome executable.
- Never send confidential Markdown, images, or PDF bytes to a network service.
- Treat the PDF as a governed output, not as authority independent of its hash-bound Markdown source.