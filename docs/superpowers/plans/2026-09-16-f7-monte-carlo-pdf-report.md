# F7 Monte Carlo PDF Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed PDF download beside **Back to factors** for the generated F7 Monte Carlo report.

**Architecture:** Extend the local API with a dedicated report-PDF request that carries a validated `F7ReportProjection`. Render self-contained HTML and print it through the existing controlled browser renderer. Keep orchestration in `App.vue`; `MonteCarloPanel` only owns the command surface.

**Tech Stack:** Vue 3, TypeScript, Zod, Node HTTP, Playwright Core, Vitest

---

### Task 1: Report PDF Contract and Renderer

**Files:**
- Create: `apps/f7-local-api/src/f7-report-pdf-contract.ts`
- Create: `apps/f7-local-api/src/f7-report-pdf-renderer.ts`
- Create: `apps/f7-local-api/src/f7-report-pdf-renderer.test.ts`

- [ ] **Step 1: Write failing renderer and filename tests**

Cover the title `F7 Monte Carlo Analysis Report`, escaped workbook/worksheet provenance, governed report sections, safe filename `<workbook>-<worksheet>-f7-monte-carlo-report.pdf`, valid `%PDF-` bytes, browser errors, and temporary-directory cleanup. Use a valid `F7ReportProjection` fixture.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd exec -- vitest run apps/f7-local-api/src/f7-report-pdf-renderer.test.ts
```

Expected: FAIL because the contract and renderer do not exist.

- [ ] **Step 3: Implement the contract and renderer**

Define a strict request schema containing `sessionId` and `report: f7ReportProjectionSchema`. Render an A4 landscape, self-contained HTML document with:

```html
<h1>F7 Monte Carlo Analysis Report</h1>
<p>{workbookName} · {worksheetName}</p>
```

Include assessment, capability summary, comparison, root causes, engineering risk, suggested actions, validation requirements, and reproducibility evidence. Escape all dynamic text. Reuse the controlled browser execution and cleanup pattern from `assumption-results-pdf-renderer.ts` without remote resources.

- [ ] **Step 4: Verify GREEN**

Run the Task 1 test command and expect all tests to pass.

### Task 2: Local API and Web Client

**Files:**
- Modify: `apps/f7-local-api/src/server.ts`
- Modify: `apps/f7-local-api/src/server.test.ts`
- Modify: `apps/f7-local-api/src/main.ts`
- Modify: `apps/f7-web/src/api/f7-client.ts`
- Modify: `apps/f7-web/src/api/f7-client.test.ts`

- [ ] **Step 1: Write failing route and client tests**

Add tests for `POST /f7/report/pdf` that require a known session, validate the report payload, verify that the report session matches the route session, return `application/pdf`, include safe ASCII and RFC5987 filenames, and map renderer failures to controlled 500 errors. Add client tests for request serialization, PDF MIME validation, empty PDF rejection, and controlled error mapping.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd exec -- vitest run apps/f7-local-api/src/server.test.ts apps/f7-web/src/api/f7-client.test.ts
```

Expected: FAIL because the report PDF route/client method does not exist.

- [ ] **Step 3: Implement route and client method**

Add this client surface:

```ts
generateReportPdf(request: {
  readonly sessionId: string;
  readonly report: F7ReportProjection;
}): Promise<Blob>;
```

The API must confirm the session exists and the supplied report belongs to that session before rendering. Return only PDF bytes and controlled headers.

- [ ] **Step 4: Verify GREEN**

Run the Task 2 command and expect all tests to pass.

### Task 3: Monte Carlo Header Action

**Files:**
- Modify: `apps/f7-web/src/components/MonteCarloPanel.vue`
- Modify: `apps/f7-web/src/components/MonteCarloPanel.test.ts`
- Modify: `apps/f7-web/src/App.vue`
- Modify: `apps/f7-web/src/App.test.ts`

- [ ] **Step 1: Write failing component and orchestration tests**

Require a toolbar containing **Back to factors** followed by a `FileDown` icon button labeled **Download PDF Report**. Verify it appears only when a Monte Carlo result exists, is disabled while busy/generating, emits `download-pdf`, and displays **Generating PDF...**. In App tests, verify an existing report is reused, a missing report is generated first, the Blob is downloaded with a safe `.pdf` filename, and a failure preserves report/simulation state for retry.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd exec -- vitest run apps/f7-web/src/components/MonteCarloPanel.test.ts apps/f7-web/src/App.test.ts
```

Expected: FAIL because the PDF action and orchestration do not exist.

- [ ] **Step 3: Implement the UI flow**

Add a right-aligned action group in the panel header. `App.vue` handles the emitted command, awaits `store.generateReport()` only when needed, calls `client.generateReportPdf`, and downloads the returned Blob as `<safe-workbook>-<safe-worksheet>-f7-monte-carlo-report.pdf`. Use a local loading/error state independent of Monte Carlo execution.

- [ ] **Step 4: Verify GREEN**

Run the Task 3 command and expect all tests to pass.

### Task 4: Integrated Verification

**Files:**
- Modify only if a focused test exposes a defect in the touched path.

- [ ] **Step 1: Run the focused suite**

```powershell
npm.cmd exec -- vitest run apps/f7-local-api/src/f7-report.test.ts apps/f7-local-api/src/f7-report-pdf-renderer.test.ts apps/f7-local-api/src/server.test.ts apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/components/MonteCarloPanel.test.ts apps/f7-web/src/App.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Build the web app**

```powershell
npm.cmd run build:f7:web
```

Expected: TypeScript and Vite build succeed.

- [ ] **Step 3: Verify in the browser**

Start or reuse `npm run dev:f7`. At desktop and mobile widths verify no overlap, button order, loading state, retry behavior, and a downloaded file whose MIME is `application/pdf` and whose first five bytes are `%PDF-`.

- [ ] **Step 4: Check the final diff**

```powershell
git diff --check
```

Expected: no whitespace errors and no unrelated files changed by this implementation.
