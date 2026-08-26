# F7 Distribution Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement F7 step 3 as a real, user-viewable candidate distribution fit workflow without unlocking Monte Carlo.

**Architecture:** Add governed fit DTOs to contracts, a pure `packages/f7-statistics` engine, a factor-scoped local API action that persists results in the session snapshot, and a Vue results stage. Candidate eligibility remains owned by workbook-catalog validation; fitting consumes included observations only.

**Tech Stack:** TypeScript, Zod, jStat, Vitest, Node HTTP, Vue 3.

---

### Task 1: Distribution Fit Contracts

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Modify: `packages/contracts/src/f7-contracts.test.ts`

- [ ] Add failing schema tests for candidate family, parameters, diagnostics, bootstrap status, recommendation, route request, and factor/session identity.
- [ ] Run `npx vitest run packages/contracts/src/f7-contracts.test.ts` and verify RED.
- [ ] Add strict schemas for `normal | lognormal | weibull | gamma | uniform`, fit status `acceptable | weak | rejected`, parameter records, log-likelihood, AICc, BIC, KS, AD, bootstrap p-value/replicates/seed, warnings, and recommended family.
- [ ] Add `distributionFitResult` to factor state and `fitDistribution` to `F7SessionService`.
- [ ] Run the contract tests and verify GREEN.

### Task 2: Statistical Fit Engine

**Files:**
- Create: `packages/f7-statistics/package.json`
- Create: `packages/f7-statistics/tsconfig.json`
- Create: `packages/f7-statistics/src/index.ts`
- Create: `packages/f7-statistics/src/distribution-fit.ts`
- Create: `packages/f7-statistics/src/distribution-fit.test.ts`
- Modify: `package.json`

- [ ] Add failing golden tests for Normal, Lognormal, Weibull, Gamma, and Uniform eligibility and parameter estimates.
- [ ] Add failing tests for AICc, BIC, KS, AD, deterministic 2,000-replicate bootstrap, status thresholds, recommendation, nonpositive candidate exclusion, and uniform boundary warning.
- [ ] Install `jstat` and its TypeScript types in the statistics workspace.
- [ ] Implement two-parameter MLE fits: Normal and Lognormal closed form, Gamma shape Newton solve with scale, Weibull shape Newton solve with scale, Uniform min/max.
- [ ] Implement finite log-likelihood, AICc, BIC, KS, AD with guarded CDF probabilities.
- [ ] Implement deterministic seeded bootstrap with candidate-specific streams, refitting every replicate and deriving p-value/status.
- [ ] Recommend the lowest-AICc acceptable candidate; leave recommendation empty when none is acceptable.
- [ ] Run `npx vitest run packages/f7-statistics/src/distribution-fit.test.ts` and verify GREEN.

### Task 3: Session Service and API

**Files:**
- Modify: `apps/f7-local-api/package.json`
- Modify: `apps/f7-local-api/src/f7-session-service.ts`
- Modify: `apps/f7-local-api/src/f7-session-service.test.ts`
- Modify: `apps/f7-local-api/src/server.ts`
- Modify: `apps/f7-local-api/src/server.test.ts`

- [ ] Add failing service tests for fitting a ready measured factor and persisting results; reject baseline, blocked, unknown, and insufficient-data factors without mutation.
- [ ] Implement `fitDistribution({ sessionId, factorId })` using included observations and validation eligibility.
- [ ] Add failing route tests for `POST /f7/factors/:factorId/distribution-fit`, strict body `{ sessionId }`, encoded factor IDs, and structured errors.
- [ ] Implement the route and request framing classification.
- [ ] Run local API service/server tests and verify GREEN.

### Task 4: Web Client and Interactive Stage

**Files:**
- Modify: `apps/f7-web/src/api/f7-client.ts`
- Modify: `apps/f7-web/src/api/f7-client.test.ts`
- Modify: `apps/f7-web/src/App.vue`
- Modify: `apps/f7-web/src/App.test.ts`
- Modify: `apps/f7-web/src/components/MeasurementPastePanel.vue`
- Modify: `apps/f7-web/src/style.css`

- [ ] Add failing client test for the factor-scoped fit endpoint.
- [ ] Add failing UI test that step 3 unlocks after ready measurements, invokes fitting, displays candidate metrics/status/warnings, identifies recommendation, and keeps Monte Carlo locked.
- [ ] Add the client action and App orchestration.
- [ ] Change stage 3 to an accessible button when measurements are ready; on entry request fit if absent and render loading/error/result states.
- [ ] Render a dense candidate comparison table with family, parameters, AICc, BIC, KS, AD, bootstrap p-value, status, and recommendation; preserve the existing industrial workbench visual language.
- [ ] Run web client/App tests and verify GREEN.

### Task 5: Integration Verification

**Files:**
- Modify generated `dist` outputs only through the repository build.

- [ ] Run focused F7 tests for contracts, statistics, local API, and web.
- [ ] Run `npm run build -- --force`.
- [ ] Restart only the process listening on port 4317; keep Vite on 5177.
- [ ] Verify `POST /f7/factors/:factorId/distribution-fit` through the 5177 proxy and confirm structured results.
- [ ] Verify the browser workflow exposes step 3 after measurement confirmation and displays nonblank results at desktop width.
