# F7 Mean Centering Values Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an exact mean-centering amount and direction to the governed action narrative.

**Architecture:** Calculate centering guidance inside `buildSuggestedActions` through a focused helper using existing input values and number formatters. Keep action contracts and Vue rendering unchanged.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Generate Numeric Mean Centering Guidance

**Files:**
- Modify: `packages/product-language/src/f7-engineering-narrative.test.ts`
- Modify: `packages/product-language/src/f7-engineering-narrative.ts`
- Modify consumer assertions only if their exact expected narrative changes.

- [ ] Add failing tests for negative adjustment, positive adjustment, and missing-value fallback.
- [ ] Run the focused product-language test and confirm RED.
- [ ] Add a mean-centering narrative helper and call it for `improvement-center-mean`.
- [ ] Rerun focused tests and confirm GREEN.
- [ ] Rebuild product-language dist and run F7 Web/API tests, build, ESLint, diagnostics, and `git diff --check`.