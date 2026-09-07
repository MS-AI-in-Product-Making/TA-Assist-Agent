# Issue #106 Implementation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute Issue #106 as four reviewable phases while preserving governed artifact, calculation, and ADO boundaries.

**Architecture:** Each phase produces a testable contract consumed by the next phase. Language and routing establish shared product context; F2 and ADO establish trusted worksheet scope; multimodal interpretation establishes the mandatory evidence gate; F6 v3 consumes that gate to generate the new optimization and report.

**Tech Stack:** TypeScript, Zod, React, VS Code Extension API, Node.js workflow runners, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-07-issue-106-ux-agent-triggering-design.md`

## Required Execution Order

1. `docs/superpowers/plans/2026-09-07-issue-106-language-triggering-inputs.md`
2. `docs/superpowers/plans/2026-09-07-issue-106-f2-findings-ado-source.md`
3. `docs/superpowers/plans/2026-09-07-issue-106-multimodal-interpretation.md`
4. `docs/superpowers/plans/2026-09-07-issue-106-f6-v3-report.md`

Do not start phase 4 before phase 3 proves the mandatory multimodal gate. Complete each phase's focused tests and commit before starting the next phase.

## Requirement Coverage

| Issue #106 requirement | Owning phase |
| --- | --- |
| Workflow language matches and remains locked to the user's starting language | Phase 1 |
| Product workflow and Skill triggering are explicit and non-overlapping | Phase 1 |
| Every user-provided value explains content, purpose, example, effect, and recovery | Phase 1 |
| User-visible surfaces use full product capability names | Phase 1 |
| F2 shows per-worksheet missing content and offers replace or continue | Phase 2 |
| Drawing Number/DIM ID remain warning-only | Phase 2 |
| ADO tables include Worksheet Source | Phase 2 |
| Factor `A/B/C...` ordinal is preserved from workbook evidence | Phase 3 |
| Model interpretation always combines verified image bytes and the complete Factor table | Phase 3 |
| Missing, ambiguous, crossed, or unavailable model evidence blocks the worksheet and final report | Phase 3 |
| Report worksheets use `3-1/3-2` numbering and locked language | Phase 4 |
| Final user report projections omit source/evidence columns | Phase 4 |
| Optimization runs center assessment, contributor ranking, then one-sided specification proposals | Phase 4 |
| New outputs remove fixed OP percentage options while historical v2 remains readable | Phase 4 |

## Phase Gates

- [ ] **Gate 1: Language and triggering complete**

New sessions persist `InteractionLanguage`; unknown requests do not start analysis; mounted inputs match the metadata registry; exact capability-name surface tests pass.

- [ ] **Gate 2: F2 and ADO complete**

Server and reducer enforce revision-bound exact downstream-ready scope; identifier-only worksheets remain selectable; ADO canonical output and readback validate 12 columns.

- [ ] **Gate 3: Multimodal interpretation complete**

Two worksheets with distinct images cannot cross-bind; every active ordinal maps exactly once; model/image/mapping failure prevents Design Optimization and final report creation.

- [ ] **Gate 4: F6 v3 and report complete**

New runs emit v3 only; historical v2 validates read-only; three-step optimization is F4-backed; all report surfaces use locked language, correct numbering, and no provenance columns.

## Final Acceptance

- [ ] Run all focused commands from the four phase plans.
- [ ] Run `npm run build -- --force`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npx playwright test test/f8-e2e/engineering-workspace.spec.ts`.
- [ ] Run `node scripts/verify-current-f6.mjs`.
- [ ] Run `git diff --check`.
- [ ] Confirm no source workbook was modified and no ADO write behavior was broadened.
- [ ] Confirm no final report is available when any selected worksheet lacks a complete image + table model interpretation.