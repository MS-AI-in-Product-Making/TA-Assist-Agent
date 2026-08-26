# F7 Step 6 Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a governed Step 6 report that presents the current F7 Monte Carlo result in the web app and downloads Markdown generated from the same server-side projection.

**Architecture:** Add strict report DTOs to `@ai-assist/contracts`, then implement a pure report projector/Markdown renderer in the local API. Expose it through the session service and `POST /f7/report`; the web client stores the validated projection and renders it without recomputing assessment.

**Tech Stack:** TypeScript, Zod, Node HTTP, Vue 3, Vitest, Vue Test Utils

---

## File Structure

- Modify `packages/contracts/src/f7-contracts.ts`: report schemas, route DTO and service interface.
- Modify `packages/contracts/src/f7-contracts.test.ts`: strict contract and assessment fixtures.
- Create `apps/f7-local-api/src/f7-report.ts`: pure projection and Markdown renderer.
- Create `apps/f7-local-api/src/f7-report.test.ts`: assessment, traceability, escaping and determinism tests.
- Modify `apps/f7-local-api/src/f7-session-service.ts`: report prerequisite and projection generation.
- Modify `apps/f7-local-api/src/f7-session-service.test.ts`: service success and stale-result tests.
- Modify `apps/f7-local-api/src/server.ts`: `POST /f7/report` route.
- Modify `apps/f7-local-api/src/server.test.ts`: HTTP route and controlled error tests.
- Modify `apps/f7-web/src/api/f7-client.ts`: report client operation and strict response parsing.
- Modify `apps/f7-web/src/api/f7-client.test.ts`: request/response tests.
- Modify `apps/f7-web/src/state/f7-session.ts`: report state, generation action and invalidation.
- Create `apps/f7-web/src/components/ReportPanel.vue`: governed report display and Markdown download.
- Create `apps/f7-web/src/components/ReportPanel.test.ts`: rendering, accessibility and download tests.
- Modify `apps/f7-web/src/App.vue`: Step 6 navigation and report lifecycle.
- Modify `apps/f7-web/src/App.test.ts`: rail state and Step 5/6 navigation tests.

Commits are intentionally omitted because this workspace does not permit agent-created commits unless the user explicitly requests one.

### Task 1: Define Strict Report Contracts

**Files:**
- Modify: `packages/contracts/src/f7-contracts.ts`
- Test: `packages/contracts/src/f7-contracts.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add fixtures asserting strict parsing for all three assessments and rejection of unknown keys, mismatched factor manifests, unsafe non-finite metrics and invalid route bodies:

```ts
expect(f7ReportProjectionSchema.parse(reportFixture({ assessment: "MEETS_TARGET" })).assessment)
  .toBe("MEETS_TARGET");
expect(f7ReportProjectionSchema.parse(reportFixture({ assessment: "BELOW_TARGET" })).assessment)
  .toBe("BELOW_TARGET");
expect(f7ReportProjectionSchema.parse(reportFixture({ assessment: "NOT_EVALUABLE" })).assessment)
  .toBe("NOT_EVALUABLE");
expect(() => f7ReportProjectionSchema.parse({ ...reportFixture(), extra: true })).toThrow();
expect(() => f7ReportGenerateRouteRequestSchema.parse({ body: { sessionId: "s", extra: true } })).toThrow();
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx vitest run packages/contracts/src/f7-contracts.test.ts`

Expected: FAIL because `f7ReportProjectionSchema` and `f7ReportGenerateRouteRequestSchema` are not exported.

- [ ] **Step 3: Add the minimal report schemas and service signature**

Define strict schemas with these public shapes:

```ts
export const f7ReportAssessmentSchema = z.enum([
  "MEETS_TARGET",
  "BELOW_TARGET",
  "NOT_EVALUABLE",
]);

export const f7ReportProjectionSchema = z.object({
  contractId: z.literal("f7-report-v1"),
  outputClassification: z.literal("confidential"),
  sessionId: z.string().min(1),
  generatedAt: isoDateTimeSchema,
  assessment: f7ReportAssessmentSchema,
  workbook: f7ReportWorkbookSchema,
  summary: f7ReportSummarySchema,
  simulation: f7MonteCarloResultSchema,
  factors: z.array(f7ReportFactorSchema).min(1),
  evidence: f7ReportEvidenceSchema,
  markdown: z.string().min(1),
}).strict();

export const f7ReportGenerateRouteRequestSchema = z.object({
  body: z.object({ sessionId: z.string().min(1) }).strict(),
}).strict();
```

Add `generateReport(request): F7ReportProjection` to `F7SessionService` and export inferred report types.

- [ ] **Step 4: Run the contract test and build**

Run: `npx vitest run packages/contracts/src/f7-contracts.test.ts && npm run build --workspace @ai-assist/contracts`

Expected: PASS.

### Task 2: Build the Pure Report Projection

**Files:**
- Create: `apps/f7-local-api/src/f7-report.ts`
- Create: `apps/f7-local-api/src/f7-report.test.ts`

- [ ] **Step 1: Write failing projection tests**

Test the exact mapping and shared projection behavior:

```ts
expect(createF7ReportProjection(snapshotWithCapability("meets_target"), generatedAt).assessment)
  .toBe("MEETS_TARGET");
expect(createF7ReportProjection(snapshotWithCapability("below_target"), generatedAt).assessment)
  .toBe("BELOW_TARGET");
expect(createF7ReportProjection(snapshotWithZeroVariance(), generatedAt).assessment)
  .toBe("NOT_EVALUABLE");
expect(result.markdown).toContain(result.workbook.workbookContentHash);
expect(result.markdown).toContain(result.simulation.runSeed);
expect(result.markdown).not.toContain("<script>");
expect(createF7ReportProjection(snapshot, generatedAt)).toEqual(
  createF7ReportProjection(snapshot, generatedAt),
);
```

- [ ] **Step 2: Run the projection test and verify RED**

Run: `npx vitest run apps/f7-local-api/src/f7-report.test.ts`

Expected: FAIL because `createF7ReportProjection` does not exist.

- [ ] **Step 3: Implement projection and Markdown rendering**

Export one pure entry point:

```ts
export function createF7ReportProjection(
  snapshot: F7SessionSnapshot,
  generatedAt: string,
): F7ReportProjection;
```

It must parse the snapshot, require `monteCarloResult`, verify the current factors against `factorManifest`, map assessment only from `capability.targetStatus`, build factor/evidence records, escape workbook-originated Markdown and HTML characters, render the approved section order, then parse the complete output with `f7ReportProjectionSchema`.

- [ ] **Step 4: Run projection tests**

Run: `npx vitest run apps/f7-local-api/src/f7-report.test.ts`

Expected: PASS.

### Task 3: Expose Report Generation Through Service and HTTP

**Files:**
- Modify: `apps/f7-local-api/src/f7-session-service.ts`
- Modify: `apps/f7-local-api/src/f7-session-service.test.ts`
- Modify: `apps/f7-local-api/src/server.ts`
- Modify: `apps/f7-local-api/src/server.test.ts`

- [ ] **Step 1: Write failing service and route tests**

Cover a completed report, missing Monte Carlo, stale factor state and strict HTTP framing:

```ts
expect(service.generateReport({ sessionId }).assessment).toBe("MEETS_TARGET");
expect(() => service.generateReport({ sessionId: sessionWithoutSimulation }))
  .toThrowError(expect.objectContaining({ code: "prerequisite_not_ready" }));

const response = await requestJson(server, "POST", "/f7/report", { sessionId });
expect(response.status).toBe(200);
expect(f7ReportProjectionSchema.parse(response.body).sessionId).toBe(sessionId);
```

- [ ] **Step 2: Run focused API tests and verify RED**

Run: `npx vitest run apps/f7-local-api/src/f7-session-service.test.ts apps/f7-local-api/src/server.test.ts`

Expected: FAIL because the service method and route are missing.

- [ ] **Step 3: Implement the service method**

Extend service dependencies with an injectable clock and generate from the current snapshot only:

```ts
const generateReport = ({ sessionId }: { readonly sessionId: string }): F7ReportProjection => {
  const parsed = f7ReportGenerateRouteRequestSchema.safeParse({ body: { sessionId } });
  if (!parsed.success) throw fixedError(SESSION_SUMMARY, "validation_error");
  const current = readSession(parsed.data.body.sessionId);
  if (current.snapshot.status !== "phase_1_ready" || !current.snapshot.monteCarloResult) {
    throw fixedError(PREREQUISITE_SUMMARY, "prerequisite_not_ready");
  }
  return createF7ReportProjection(current.snapshot, now().toISOString());
};
```

- [ ] **Step 4: Implement `POST /f7/report`**

Add the route to body framing and dispatch. Parse with `f7ReportGenerateRouteRequestSchema`, call `service.generateReport`, and respond through existing `writeJson` so `no-store`, maximum response size and typed errors remain unchanged.

- [ ] **Step 5: Run focused API tests**

Run: `npx vitest run apps/f7-local-api/src/f7-report.test.ts apps/f7-local-api/src/f7-session-service.test.ts apps/f7-local-api/src/server.test.ts`

Expected: PASS.

### Task 4: Add Client and Store Report State

**Files:**
- Modify: `apps/f7-web/src/api/f7-client.ts`
- Modify: `apps/f7-web/src/api/f7-client.test.ts`
- Modify: `apps/f7-web/src/state/f7-session.ts`
- Test: `apps/f7-web/src/App.test.ts`

- [ ] **Step 1: Write failing client and store-facing tests**

Assert exact request and strict response behavior:

```ts
const report = await client.generateReport({ sessionId: "session-1" });
expect(fetchMock).toHaveBeenCalledWith(
  "http://localhost:3017/f7/report",
  expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionId: "session-1" }) }),
);
expect(report.contractId).toBe("f7-report-v1");
```

In the App client fixture, expose `generateReport`; verify store errors remain controlled and any session mutation clears `report.value`.

- [ ] **Step 2: Run client/App tests and verify RED**

Run: `npx vitest run apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/App.test.ts`

Expected: FAIL because the client operation and report store state do not exist.

- [ ] **Step 3: Implement client and store action**

Add to `F7Client`:

```ts
generateReport(request: { readonly sessionId: string }): Promise<F7ReportProjection>;
```

Parse responses with `f7ReportProjectionSchema`. In the store, add `report = shallowRef<F7ReportProjection>()` and `generateReport()`. Clear `report.value` whenever a returned session snapshot differs due to factor, measurement, fit, approval or Monte Carlo actions.

- [ ] **Step 4: Run client tests**

Run: `npx vitest run apps/f7-web/src/api/f7-client.test.ts`

Expected: PASS.

### Task 5: Render and Download the Report

**Files:**
- Create: `apps/f7-web/src/components/ReportPanel.vue`
- Create: `apps/f7-web/src/components/ReportPanel.test.ts`
- Reuse: `apps/f7-web/src/components/MonteCarloHistogram.vue`

- [ ] **Step 1: Write failing component tests**

Mount each assessment and assert the approved content hierarchy:

```ts
expect(wrapper.get("[data-report-assessment]").text()).toContain("Meets target");
expect(wrapper.get("[data-report-metrics]").text()).toContain("Cpk");
expect(wrapper.getComponent(MonteCarloHistogram).props("result")).toEqual(report.simulation);
expect(wrapper.get("details[data-report-evidence]").attributes("open")).toBeUndefined();
await wrapper.get("[data-download-report]").trigger("click");
expect(downloadedBlobText()).resolves.toBe(report.markdown);
```

Also cover `NOT_EVALUABLE` without Cp/Cpk and the non-release disclaimer.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npx vitest run apps/f7-web/src/components/ReportPanel.test.ts`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component**

Use a single `report: DeepReadonly<F7ReportProjection>` prop and emit `close`. Render semantic headings, definition lists, the existing histogram, factor table and closed `details`. Implement Markdown download with `Blob`, `URL.createObjectURL`, a temporary anchor and guaranteed `URL.revokeObjectURL` cleanup. Sanitize only the filename; never alter validated Markdown content.

- [ ] **Step 4: Run component tests**

Run: `npx vitest run apps/f7-web/src/components/ReportPanel.test.ts`

Expected: PASS.

### Task 6: Unlock Step 6 and Validate End to End

**Files:**
- Modify: `apps/f7-web/src/App.vue`
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] **Step 1: Write failing workflow tests**

From a session with `monteCarloResult`, assert Step 6 is pending before entry, generation is called once, the report is shown, Step 5 becomes complete, Step 6 becomes current, and Back restores Step 5 without rerunning simulation.

```ts
await wrapper.get("[data-open-report]").trigger("click");
expect(client.generateReport).toHaveBeenCalledWith({ sessionId: completed.sessionId });
expect(wrapper.findComponent(ReportPanel).exists()).toBe(true);
expect(stepState(wrapper, "Report")).toContain("Current");
await wrapper.get("[data-report-back]").trigger("click");
expect(client.runMonteCarlo).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run App tests and verify RED**

Run: `npx vitest run apps/f7-web/src/App.test.ts`

Expected: FAIL because Step 6 remains locked and has no panel.

- [ ] **Step 3: Integrate Step 6**

Extend `activeMeasurementStage` with `"report"`. Step 6 is locked only without `monteCarloResult`; entering it calls `store.generateReport()`, and `ReportPanel` renders only after a validated response. Add `Open report` to completed Monte Carlo results and maintain correct rail states during busy/error conditions.

- [ ] **Step 4: Run all F7 report tests**

Run: `npx vitest run packages/contracts/src/f7-contracts.test.ts apps/f7-local-api/src/f7-report.test.ts apps/f7-local-api/src/f7-session-service.test.ts apps/f7-local-api/src/server.test.ts apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/components/ReportPanel.test.ts apps/f7-web/src/App.test.ts`

Expected: PASS.

- [ ] **Step 5: Run builds**

Run: `npm run build && npm run build --workspace @ai-assist/f7-web`

Expected: both builds exit 0.

- [ ] **Step 6: Browser validation**

Using the running local API and Vite page, complete or reuse a valid Monte Carlo session. Verify desktop and mobile viewports: report navigation, all three assessment-safe layouts through fixtures where available, nonblank histogram pixels, no overlap or horizontal clipping, keyboard-operable evidence disclosure, Back behavior, and downloaded Markdown equality.

- [ ] **Step 7: Final diff validation**

Run: `git diff --check`

Expected: exit 0 with no whitespace errors.