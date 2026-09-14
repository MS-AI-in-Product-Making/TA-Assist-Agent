# F7 Assumption Results PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a true one-click PDF download for the complete F7 assumption-results interpretation panel.

**Architecture:** The Vue component converts its current interpretation into a bounded structured request. The F7 local API validates and escapes that request, renders self-contained print HTML, invokes an installed controlled Edge/Chrome executable, verifies the returned PDF bytes, and streams them back for browser download.

**Tech Stack:** Vue 3, TypeScript, Vitest, Zod, Node HTTP, local Edge/Chrome headless PDF printing

---

### Task 1: Structured Contract and PDF Renderer

**Files:**
- Create: `apps/f7-local-api/src/assumption-results-pdf-contract.ts`
- Create: `apps/f7-local-api/src/assumption-results-pdf-renderer.ts`
- Test: `apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts`

- [ ] **Step 1: Write failing renderer tests**

Test `renderAssumptionResultsPdfHtml()` with a minimal valid request. Assert escaped workbook text, all six required section headings, A4 landscape print CSS, repeating table headers, and absence of raw injected markup. Test `createAssumptionResultsPdfRenderer()` with injected `installedBrowsers` and `executeFile`; have the fake executable write `%PDF-1.7\nfixture`, then assert the returned signature, controlled browser flags, and temporary-directory cleanup on success and failure.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run --project node apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts
```

Expected: FAIL because the contract and renderer modules do not exist.

- [ ] **Step 3: Implement the bounded request schema**

Create strict Zod schemas with bounded strings/arrays and finite contributor numbers. Export `AssumptionResultsPdfRouteRequest` and `safePdfDownloadFileName()`.

```ts
export const assumptionResultsPdfRouteRequestSchema = z.object({
  sessionId: z.string().min(1).max(200),
  workbookName: z.string().min(1).max(300),
  worksheetName: z.string().min(1).max(300),
  summaryRows: z.array(summaryRowSchema).min(1).max(20),
  overallAssessment: z.string().min(1).max(4000),
  rootCauseItems: z.array(narrativeItemSchema).max(30),
  actionItems: z.array(narrativeItemSchema).max(30),
  contributors: z.array(contributorSchema).max(100),
  processGuidance: z.array(guidanceSchema).max(50),
}).strict();
```

- [ ] **Step 4: Implement HTML and controlled-browser rendering**

Create `escapeHtml()`, deterministic self-contained markup, and this injected renderer interface:

```ts
export interface AssumptionResultsPdfRenderer {
  render(request: AssumptionResultsPdfRouteRequest): Promise<Buffer>;
}

export function createAssumptionResultsPdfRenderer(
  dependencies: AssumptionResultsPdfRenderDependencies = {},
): AssumptionResultsPdfRenderer;
```

Use `mkdtemp`, `pathToFileURL`, `execFile`, standard Edge/Chrome paths only, `%PDF-` validation, and recursive cleanup in `finally`. Never accept HTML, URLs, executable paths, or file paths from the request.

- [ ] **Step 5: Verify GREEN**

```powershell
npx vitest run --project node apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts
```

Expected: PASS.

### Task 2: F7 PDF API Route

**Files:**
- Modify: `apps/f7-local-api/src/server.ts`
- Modify: `apps/f7-local-api/src/server.test.ts`
- Modify: `apps/f7-local-api/src/main.ts`
- Modify: `apps/f7-local-api/src/index.ts`

- [ ] **Step 1: Write failing route tests**

Inject a renderer returning `Buffer.from("%PDF-1.7\nfixture")`. POST a valid request and assert session enforcement, status `200`, `application/pdf`, attachment disposition, `nosniff`, and exact raw bytes. Add invalid-body, missing-session, and renderer-rejection tests.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run --project node apps/f7-local-api/src/server.test.ts
```

Expected: FAIL because `/f7/assumption-results/pdf` is not registered.

- [ ] **Step 3: Add route and dependency injection**

Extend `createF7LocalServer` with `assumptionResultsPdfRenderer`, add the URL to `isBodyPostRoute()`, validate via `safeParse()`, call `service.getSession(sessionId)`, render, and send through `writePdf()`.

```ts
function writePdf(response: ServerResponse, fileName: string, bytes: Buffer): void {
  response.writeHead(200, {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${fileName}"`,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-length": bytes.byteLength,
  });
  response.end(bytes);
}
```

Create and inject the default renderer in `main.ts`; export local testable symbols from `index.ts`.

- [ ] **Step 4: Verify GREEN**

```powershell
npx vitest run --project node apps/f7-local-api/src/server.test.ts apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts
```

Expected: PASS.

### Task 3: Web Binary Client

**Files:**
- Modify: `apps/f7-web/src/api/f7-client.ts`
- Modify: `apps/f7-web/src/api/f7-client.test.ts`

- [ ] **Step 1: Write failing client tests**

Assert that `generateAssumptionResultsPdf(request)` POSTs exact JSON to `/f7/assumption-results/pdf` and returns a non-empty PDF Blob. Add cases for JSON error envelopes, successful non-PDF responses, empty PDFs, and fetch rejection.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run --project f7-web apps/f7-web/src/api/f7-client.test.ts
```

Expected: FAIL because the binary method is absent.

- [ ] **Step 3: Implement binary handling**

Export the request type matching the API contract and add `generateAssumptionResultsPdf()`. Reuse existing generic/error-envelope mapping. Require a content type containing `application/pdf` and `blob.size > 0` before returning.

- [ ] **Step 4: Verify GREEN**

```powershell
npx vitest run --project f7-web apps/f7-web/src/api/f7-client.test.ts
```

Expected: PASS.

### Task 4: Header and One-Click Download

**Files:**
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`
- Modify: `apps/f7-web/src/App.vue`

- [ ] **Step 1: Write failing component tests**

Mount an available interpretation with an injected `generatePdf` callback. Assert title/action placement, complete structured request mapping, disabled generating state, successful object-URL download with safe filename, URL revocation, and accessible inline failure without a download.

- [ ] **Step 2: Verify RED**

```powershell
npx vitest run --project f7-web apps/f7-web/src/components/TAResultsInterpretation.test.ts
```

Expected: FAIL because the action is absent.

- [ ] **Step 3: Implement the component action**

Add an async prop supplied by `App.vue`, a structured request builder, loading/error refs, and a download helper. Use `FileDown` from `lucide-vue-next`, existing `.action-button`, visible `Generate PDF`, `aria-busy`, and an `aria-live="polite"` error. Revoke the Blob URL in `finally`.

```css
.interpretation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
```

- [ ] **Step 4: Verify GREEN**

```powershell
npx vitest run --project f7-web apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts
```

Expected: PASS.

### Task 5: Integrated Verification

**Files:**
- Modify only if focused validation identifies a defect in files listed above.

- [ ] **Step 1: Run touched-slice tests**

```powershell
npx vitest run --project node apps/f7-local-api/src/server.test.ts apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts
npx vitest run --project f7-web apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/components/TAResultsInterpretation.test.ts
```

Expected: PASS without unhandled errors.

- [ ] **Step 2: Build F7 Web and workspace**

```powershell
npm run build:f7:web
npm run build -- --force
```

Expected: both exit `0`.

- [ ] **Step 3: Verify the running app and real PDF**

Use a workbook only from `local-test/F7_Test_Finetune_05/`. Navigate to assumption results, click `Generate PDF`, and keep the downloaded test artifact in that ignored directory. Verify `%PDF-`, non-zero size, all required headings and contributor content, no application chrome, and no clipping/overlap.

- [ ] **Step 4: Review final diff**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and changes limited to design/plan plus the two F7 apps.
