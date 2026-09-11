# F7 Pareto Action Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Tolerance Adjustment Priority from Excessive variation to Reduce total variation.

**Architecture:** Change only the Vue composition location. Reuse the existing `ContributorParetoChart` and `interpretation.contributorPriorities` without changing the view model or chart component.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils

---

### Task 1: Move The Pareto Guidance

**Files:**
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`

- [ ] Add a failing hierarchy test proving the chart is absent from Excessive variation and present in Reduce total variation.
- [ ] Run `npx vitest run --project f7-web apps/f7-web/src/components/TAResultsInterpretation.test.ts` and confirm RED.
- [ ] Move the existing chart template to the `improvement-reduce-variation` action branch.
- [ ] Rerun the focused test and confirm GREEN.
- [ ] Run F7 Web tests, production build, ESLint, editor diagnostics, and `git diff --check`.