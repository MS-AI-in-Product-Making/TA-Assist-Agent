# F7 F0 Capability Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add traceable F0-backed guidance for the selected Factor's Mean, Standard Deviation, Cp, and Cpk Setup/Sample differences without inventing unsupported engineering conclusions.

**Architecture:** Expose public F0 engineering-rule lookup through a browser-safe package subpath, then map the controlled Cpk target and existing Capability comparison into a pure F7 guidance model. Render the structured result in `MeasurementPastePanel.vue` and retain the existing factual summary.

**Tech Stack:** TypeScript, Vue 3, Vitest, Vue Test Utils, npm workspaces

---

### Task 1: Browser-Safe F0 Engineering Rule Lookup

**Files:**
- Create: `packages/knowledge-base/src/public-engineering-rules.ts`
- Modify: `packages/knowledge-base/src/data/v1.ts`
- Modify: `packages/knowledge-base/package.json`
- Test: `packages/knowledge-base/src/public-engineering-rules.test.ts`

- [ ] Write a failing test that resolves `default-cpk-target` as F0 v1 with threshold `1.33`, returns `unknown` for an absent rule, and proves returned values are immutable.
- [ ] Run `npx vitest run packages/knowledge-base/src/public-engineering-rules.test.ts` and confirm failure because the new module does not exist.
- [ ] Move the public engineering-rule collection into the browser-safe module and export `getPublicEngineeringRule(request)` with schema validation and immutable results. Reuse that collection from the canonical F0 seed.
- [ ] Add the `./public-engineering-rules` package export.
- [ ] Rerun the focused test and confirm it passes.

### Task 2: Pure Capability Guidance Model

**Files:**
- Create: `apps/f7-web/src/capability-guidance.ts`
- Create: `apps/f7-web/src/capability-guidance.test.ts`
- Modify: `apps/f7-web/package.json`

- [ ] Write failing tests for a below-target result, a meets-target result, review directions derived from mean/variation changes, and an unavailable result without a controlled target.
- [ ] Run `npx vitest run apps/f7-web/src/capability-guidance.test.ts` and confirm failure because the model does not exist.
- [ ] Implement `buildCapabilityGuidance` as a pure function consuming the Mean, Standard Deviation, Cp, and Cpk comparisons plus a resolved rule result. Return structured status, four difference interpretations, Factor-specific recommendations, and provenance.
- [ ] Rerun the focused test and confirm it passes.

### Task 3: Capability UI Integration

**Files:**
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Modify: `apps/f7-web/src/style.css`
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] Extend the existing Capability integration test to require `F0 Guidance`, four metric interpretations, Factor-specific recommendations, measured Cpk versus target text, and `F0 v1 / default-cpk-target`.
- [ ] Run `npx vitest run apps/f7-web/src/App.test.ts --testTimeout=15000` and confirm the new assertions fail because guidance is absent.
- [ ] Resolve the F0 rule once in the component module, compute guidance from `capabilityComparison`, and render a compact semantic section beneath the factual summary.
- [ ] Add restrained styles that preserve the existing Capability visual hierarchy and responsive behavior.
- [ ] Rerun `npx vitest run apps/f7-web/src/App.test.ts apps/f7-web/src/capability-guidance.test.ts packages/knowledge-base/src/public-engineering-rules.test.ts --testTimeout=15000` and confirm all focused tests pass.
- [ ] Run `npm run build:f7:web` and `npm run build -- --force` and confirm both builds pass.