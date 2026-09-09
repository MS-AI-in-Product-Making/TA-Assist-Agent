# F0 V2 Enhanced Interpretation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-approved RC01 variation, RC02 mean-shift, and RC03 contributor rules to F0 V2 and expose their governed options and validation requirements to F5/F6/F7.

**Architecture:** Extend the shared interpretation fact and condition contracts, publish V2-only immutable entries, and evaluate conditions centrally in F0. Consumers submit facts and render matched evidence; F6 remains the quantified scenario owner.

**Tech Stack:** TypeScript, Zod, Vitest, Vue 3, Vite

---

### Task 1: Extend Interpretation Contracts

**Files:**
- Modify: `packages/contracts/src/contracts.ts`
- Test: `packages/contracts/src/contracts.test.ts`

- [ ] Add failing tests accepting `cp`, `mean`, `lowerSpecLimit`, and `upperSpecLimit`, rejecting inverted limits, and accepting variation/mean-shift activation conditions.
- [ ] Run `node_modules/.bin/vitest.cmd run packages/contracts/src/contracts.test.ts` and verify RED.
- [ ] Extend fact references, facts, and the root-cause activation-condition discriminated union with `cp-below-target` and `mean-off-center` conditions.
- [ ] Rerun the contract test and verify GREEN.

### Task 2: Publish And Evaluate V2 Rules

**Files:**
- Modify: `packages/knowledge-base/src/interpretation/data/interpretation-rules-v2.ts`
- Modify: `packages/knowledge-base/src/interpretation/query.ts`
- Modify: `packages/knowledge-base/src/interpretation/validation.ts`
- Test: `packages/knowledge-base/src/interpretation/query.test.ts`
- Test: `packages/knowledge-base/src/interpretation/validation.test.ts`

- [ ] Add failing tests for RC01, RC02, RC03, combined matching, no false centering match, stable ordering, V1 isolation, and package hashes.
- [ ] Run the two focused tests and verify RED.
- [ ] Add user-approved V2 provenance, root-signal entries, options, and validation steps; implement condition evaluation and strict required-fact validation.
- [ ] Recompute canonical manifest hashes and rerun focused tests to GREEN.

### Task 3: Pass Facts From F5 And F7

**Files:**
- Modify: `packages/workbook-catalog/src/interpretation-placeholder.ts`
- Test: `packages/workbook-catalog/src/interpretation-placeholder.test.ts`
- Modify: `apps/f7-web/src/assumption-results-interpretation.ts`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Modify: `apps/f7-local-api/src/f7-report.ts`
- Test: `apps/f7-local-api/src/f7-report.test.ts`

- [ ] Add failing tests requiring consumers to submit Cp/mean/specification facts and render matched validation requirements.
- [ ] Run focused consumer tests and verify RED.
- [ ] Pass the new facts, map controlled rule titles, and render separate result, root-cause, option, and validation sections.
- [ ] Rerun focused tests and verify GREEN.

### Task 4: Governance And Product Runtime

**Files:**
- Modify: `docs/governance/feature-register.md`
- Modify: `docs/governance/data-classification.md`
- Generated: `apps/vscode-extension/runtime/cli/index.mjs`
- Generated: `apps/vscode-extension/runtime/cli/index.cjs`

- [ ] Document the user-approved V2 source boundary and F6 scenario ownership.
- [ ] Run `npm run build -- --force`, focused F0/F5/F6/F7 tests, and `npm run check:repository`.
- [ ] Run `npm run build:beta` and verify the tracked extension runtime contains V2 rule IDs and no new workbook assets.
- [ ] Review `git diff --check`, commit the approved implementation, and push the current feature branch.