# TA Real-Measurement Analysis Skill Design

## Goal

Add a workspace skill that lets users open the existing local F7 Web UI through Chinese or English TA real-measurement business intent without requiring them to know the internal F7 codename.

## Decision

Create `.github/skills/ta-real-measurement-analysis/SKILL.md` as an execution-oriented skill. It uses the existing `npm run dev:f7` entry point rather than introducing a wrapper script or duplicating F7 analysis logic.

Discovery is based on compound business intent: actual or real measurement data combined with TA, dimension, tolerance, assembly, or Factor analysis through an interactive UI. Capability analysis, distribution fitting, and Monte Carlo propagation are supporting intents only when tied to measured Factor data. Explicit F7 requests remain a developer-compatible alias. General Cpk explanations, generic measurement analysis, and Monte Carlo programming must not trigger this skill.

When invoked, the skill:

1. Treats the Web UI as the default interaction surface.
2. Reuses healthy listeners on `127.0.0.1:5177` and `127.0.0.1:4317` when both are already available.
3. Otherwise starts `npm run dev:f7` as a long-running background process from the repository root.
4. Confirms both listeners from terminal output or port checks, then opens `http://127.0.0.1:5177`.
5. Directs the user to import a TA workbook, select a worksheet, configure multiple Factors, and enter measured values in each measured Factor workspace.

## Failure Handling

- If only one required port is occupied, stop and report the conflicting listener instead of starting a partial stack.
- If startup exits or reports an error, return the relevant terminal output and do not claim the UI is ready.
- Keep the long-running terminal alive while the user uses the UI.
- Do not invent a `workflow:f7` command or silently choose a different port because the current Vite configuration uses a strict port.

## Safety Boundaries

The skill stays local and single-user. It does not upload data, modify the source workbook, publish to ADO, or invent measurement values. It presents the current F7 Phase 1 limitation that baseline assumptions support Normal and Uniform distributions; other workbook distributions require measured data or a separately governed sampler.

## Verification

Add a static contract test for bilingual business-intent discovery, negative trigger boundaries, startup behavior, URLs, reuse/failure rules, UI workflow guidance, and safety boundaries. Then start the stack and verify that the Web page and API listener are reachable.
