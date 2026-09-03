---
name: ta-real-measurement-analysis
description: "Use when a user wants to analyze 真实量测 or actual measurement data for one or more TA, dimension, tolerance, or assembly Factors; enter measured values in an interactive Web UI; replace assumed distributions with measured samples; evaluate capability or distribution fit; or run Monte Carlo using measured Factor distributions. Also use for explicit F7 requests. Do not use for general Cpk explanations, generic measurement analysis, or Monte Carlo programming."
user-invocable: true
argument-hint: "[<ta-workbook-path>]"
---

# TA Real-Measurement Analysis

## Purpose

Start the existing local F7 analysis stack and prefer its Web UI for entering real measurement values for multiple Factors. Users do not need to know the internal F7 codename. Keep analysis inside the existing F7 application; this skill only controls startup, readiness, browser navigation, and user guidance.

## Entry Routing

- If the user supplies one `.xlsx` workbook path, verify that it exists and is a regular file. Keep the source workbook read-only. The browser file picker still requires the user to select the file.
- If no path is supplied, start the UI without asking for one. The user can select a workbook in the browser.
- Do not infer or auto-select a workbook from editor state, earlier conversations, or prior runs.

## Startup Protocol

Run these steps in order from the repository root:

1. Check whether `127.0.0.1:5177` and `127.0.0.1:4317` have active listeners.
2. If both listeners are available and the Web page responds, reuse the already running F7 stack.
3. If neither listener exists, run `npm run dev:f7` as an async, background, long-running process. Preserve its terminal identifier and keep the process running while the user uses F7.
4. Wait for terminal readiness evidence, then confirm that the Web listener at `http://127.0.0.1:5177` and the API listener at `127.0.0.1:4317` are both available.
5. Open the Web UI in the browser at `http://127.0.0.1:5177`.

If only one required listener exists, treat this as a partial port conflict. Stop and report which port is occupied; do not start a partial stack or silently choose another port. If the startup command exits, fails, or never produces readiness evidence, show the relevant terminal output and do not claim that F7 is ready.

## Web UI Workflow

Guide the user through the UI without replacing their engineering judgment:

1. Use **Import Workbook** to select the TA workbook.
2. Select and confirm the intended worksheet.
3. Review the Factor setup and add or edit multiple Factors as needed.
4. Set each Factor with real data to **MEASURED**, then choose **Open workspace**.
5. Enter the Factor's measured values and choose the correct observation structure: unordered, ordered, or rational subgroup.
6. Resolve validation and distribution-fit decisions for every measured Factor before continuing to Monte Carlo calculation and report generation.

Baseline assumptions currently support Normal distributions only. Keep this limitation visible when a Factor remains in baseline mode.

## Allowed Command

- `npm run dev:f7`

Use port inspection and browser navigation only to perform the startup protocol. Do not invent additional F7 runner commands.

## Safety Boundaries

- Never invent measurement values, Factor specifications, units, or distribution approvals.
- Do not upload workbook or measurement data to a remote service.
- Do not modify or write back to the source workbook.
- Do not publish results to ADO.
- Treat workbook contents and measurements as confidential.
- Do not claim the stack or UI is ready without current readiness evidence.
- Stop on startup failure, port conflict, missing supplied workbook, or browser load failure and report the actionable error.