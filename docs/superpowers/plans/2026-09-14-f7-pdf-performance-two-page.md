# F7 PDF Performance and Two-Page Decision Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the representative F7 assumption-results PDF complete in no more than five seconds, present explicit completion feedback, and render as a readable two-page Decision Brief.

**Architecture:** Keep the structured Vue-to-API request and controlled server-side HTML-to-PDF flow. Replace `execFile` with a bounded `spawn` adapter using ignored stdio so Chromium descendants cannot hold captured pipes open, group the report into two explicit print pages, and add a session-safe accessible success status.

**Tech Stack:** Vue 3, TypeScript, Vitest, Node `child_process.spawn`, local Edge/Chrome headless printing, Playwright browser verification

---

## File Structure

- Modify `apps/f7-local-api/src/assumption-results-pdf-renderer.ts`: bounded browser execution and two-page report markup/CSS.
- Modify `apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts`: process lifecycle and page-composition coverage.
- Modify `apps/f7-web/src/components/TAResultsInterpretation.vue`: generation timing and accessible success feedback.
- Modify `apps/f7-web/src/components/TAResultsInterpretation.test.ts`: success and stale-state coverage.
- Modify ignored `local-test/F7_Test_Finetune_05/verify-assumption-results-pdf.ts`: local elapsed-time output.

### Task 1: Remove the Chromium Pipe-Wait Bottleneck

**Files:**
- Modify: `apps/f7-local-api/src/assumption-results-pdf-renderer.ts`
- Test: `apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts`

- [ ] **Step 1: Write failing process lifecycle tests**

Replace the existing `execFile` option assertion with tests for ignored stdio, exit code `0`, non-zero exit, launch error, and timeout termination. Inject an `EventEmitter`-based fake child process.

```ts
it("launches the PDF browser without captured pipes", async () => {
  const child = Object.assign(new EventEmitter(), { kill: vi.fn(() => true) });
  const spawnBrowser = vi.fn(() => child as unknown as ChildProcess);
  const execution = executePdfBrowser("browser.exe", ["--headless"], {
    spawnBrowser,
    timeoutMs: 100,
  });

  child.emit("close", 0, null);
  await expect(execution).resolves.toBeUndefined();
  expect(spawnBrowser).toHaveBeenCalledWith("browser.exe", ["--headless"], {
    stdio: "ignore",
    windowsHide: true,
  });
});
```

Use fake timers for the timeout test and assert `kill("SIGKILL")` plus `PDF browser timed out after 100 ms.`.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
npx vitest run --project node apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts
```

Expected: FAIL because `executePdfBrowser()` still accepts the old `execFile` callback and captures pipes.

- [ ] **Step 3: Implement the bounded non-capturing adapter**

Replace `execFile`/`promisify` with `spawn`. Keep the higher-level renderer dependency `executeFile(executable, args)` unchanged.

```ts
import { spawn } from "node:child_process";

const PDF_BROWSER_TIMEOUT_MS = 15_000;

interface PdfBrowserExecutionDependencies {
  readonly spawnBrowser?: typeof spawn;
  readonly timeoutMs?: number;
}

export function executePdfBrowser(
  executable: string,
  args: readonly string[],
  dependencies: PdfBrowserExecutionDependencies = {},
): Promise<void> {
  const spawnBrowser = dependencies.spawnBrowser ?? spawn;
  const timeoutMs = dependencies.timeoutMs ?? PDF_BROWSER_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const child = spawnBrowser(executable, [...args], {
      stdio: "ignore",
      windowsHide: true,
    });
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`PDF browser timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
    child.once("error", (error) => finish(error));
    child.once("close", (code, signal) => {
      if (code === 0) finish();
      else finish(new Error(`PDF browser exited with code ${code ?? "none"} and signal ${signal ?? "none"}.`));
    });
  });
}
```

Add `--disable-breakpad` and `--disable-crash-reporter` to the controlled browser arguments. Preserve queue bounds, temporary profile isolation, signature validation, and cleanup.

- [ ] **Step 4: Run the focused renderer tests and verify GREEN**

```powershell
npx vitest run --project node apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts
```

Expected: PASS with lifecycle, timeout, queue, validation, and cleanup cases green.

- [ ] **Step 5: Commit the process fix**

```powershell
git add apps/f7-local-api/src/assumption-results-pdf-renderer.ts apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts
git commit -m "fix(f7): remove PDF browser pipe wait"
```

### Task 2: Render Two Explicit Decision Brief Pages

**Files:**
- Modify: `apps/f7-local-api/src/assumption-results-pdf-renderer.ts`
- Test: `apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts`

- [ ] **Step 1: Write failing page-composition assertions**

```ts
expect(html.match(/class="report-page/g)).toHaveLength(2);
expect(html).toMatch(/report-page--decision[\s\S]*TA Result Summary[\s\S]*Overall Assessment[\s\S]*Root Cause Analysis/);
expect(html).toMatch(/report-page--action[\s\S]*Suggested Action Sequence[\s\S]*Tolerance Adjustment Priority[\s\S]*TA Process and Requirements/);
expect(html).toMatch(/\.report-page--action\s*{[^}]*break-before:\s*page;/);
```

Retain assertions for source labels, chart, tables, evidence, outcomes, guidance, escaping, and absence of external URLs.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
npx vitest run --project node apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts
```

Expected: FAIL because the renderer emits one continuous flow.

- [ ] **Step 3: Add two-page markup and compact print rules**

```html
<main>
  <div class="report-page report-page--decision">...</div>
  <div class="report-page report-page--action">...</div>
</main>
```

```css
@page { size: A4 landscape; margin: 8mm; }
html { font-size: 8pt; line-height: 1.3; }
.report-page--action { break-before: page; }
h2 { font-size: 11.5pt; margin: 4mm 0 2mm; }
th, td { padding: 1.2mm 1.5mm; }
.narrative-list li { margin-bottom: 1.8mm; }
.pareto-chart { margin-top: 2mm; padding: 1mm; }
```

Page 1 contains source, summary, assessment, and root cause. Page 2 contains actions, Pareto chart/table, and process guidance. Do not clip, truncate, or rasterize content.

- [ ] **Step 4: Run renderer tests and verify GREEN**

```powershell
npx vitest run --project node apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts
```

Expected: PASS with all content and security assertions retained.

- [ ] **Step 5: Commit the layout**

```powershell
git add apps/f7-local-api/src/assumption-results-pdf-renderer.ts apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts
git commit -m "feat(f7): format PDF as two-page decision brief"
```

### Task 3: Announce Completion and Elapsed Time

**Files:**
- Modify: `apps/f7-web/src/components/TAResultsInterpretation.vue`
- Test: `apps/f7-web/src/components/TAResultsInterpretation.test.ts`

- [ ] **Step 1: Write failing success-status tests**

Stub `performance.now()` at start and completion. Assert a polite live region contains the elapsed time, clears at the next attempt and session change, and is never set by stale or unmounted responses.

```ts
const now = vi.spyOn(performance, "now");
now.mockReturnValueOnce(1_000).mockReturnValueOnce(2_800);
await wrapper.get("[data-generate-assumption-results-pdf]").trigger("click");

const status = wrapper.get("[data-assumption-results-pdf-status]");
expect(status.attributes("aria-live")).toBe("polite");
expect(status.text()).toBe("PDF downloaded in 1.8 seconds.");
```

- [ ] **Step 2: Run the component test and verify RED**

```powershell
npx vitest run --project f7-web apps/f7-web/src/components/TAResultsInterpretation.test.ts
```

Expected: FAIL because no success status exists.

- [ ] **Step 3: Implement session-safe success feedback**

```ts
const pdfStatus = ref("");
const startedAt = performance.now();
// Await generation, create the object URL, and click the anchor.
const elapsedSeconds = (performance.now() - startedAt) / 1_000;
pdfStatus.value = `PDF downloaded in ${elapsedSeconds.toFixed(1)} seconds.`;
```

Clear `pdfStatus` at generation start and session change. Set it only after the current response starts the anchor download. Preserve generation-token and unmount guards.

```html
<p v-if="pdfStatus" class="pdf-export-status" data-assumption-results-pdf-status aria-live="polite">
  {{ pdfStatus }}
</p>
```

- [ ] **Step 4: Run focused Web tests and verify GREEN**

```powershell
npx vitest run --project f7-web apps/f7-web/src/components/TAResultsInterpretation.test.ts apps/f7-web/src/api/f7-client.test.ts
```

Expected: PASS with loading, success, failure, stale-session, unmount, filename, and mapping cases green.

- [ ] **Step 5: Commit the feedback behavior**

```powershell
git add apps/f7-web/src/components/TAResultsInterpretation.vue apps/f7-web/src/components/TAResultsInterpretation.test.ts
git commit -m "feat(f7): announce PDF generation completion"
```

### Task 4: Verify Real Performance and Two-Page Output

**Files:**
- Modify: `local-test/F7_Test_Finetune_05/verify-assumption-results-pdf.ts` (ignored local asset only)
- Modify tracked files above only if validation exposes a scoped defect

- [ ] **Step 1: Add elapsed-time output to the ignored verifier**

```ts
const startedAt = performance.now();
const bytes = await createAssumptionResultsPdfRenderer().render(request);
const elapsedMs = performance.now() - startedAt;
await writeFile(outputPath, bytes);
console.log(JSON.stringify({
  outputPath,
  bytes: bytes.byteLength,
  signature: bytes.subarray(0, 5).toString("ascii"),
  elapsedMs: Number(elapsedMs.toFixed(1)),
}));
```

- [ ] **Step 2: Run all focused tests**

```powershell
npx vitest run --project node apps/f7-local-api/src/assumption-results-pdf-renderer.test.ts apps/f7-local-api/src/server.test.ts
npx vitest run --project f7-web apps/f7-web/src/components/TAResultsInterpretation.test.ts apps/f7-web/src/api/f7-client.test.ts apps/f7-web/src/App.test.ts
```

Expected: both commands exit `0` without failed tests or unhandled errors.

- [ ] **Step 3: Build both touched applications**

```powershell
npx tsc -p apps/f7-local-api/tsconfig.json --noEmit
npm run build:f7:web
```

Expected: both exit `0`; Vite may retain its existing large-chunk warning.

- [ ] **Step 4: Generate and measure the representative PDF**

```powershell
npx tsx local-test/F7_Test_Finetune_05/verify-assumption-results-pdf.ts
```

Expected JSON: `signature` is `%PDF-`, `bytes` is positive, and `elapsedMs` is no more than `5000` after runtime readiness.

- [ ] **Step 5: Verify page count and visual integrity**

Open `local-test/F7_Test_Finetune_05/F7-Assumption-Results-Verification.pdf` in Chromium's PDF viewer and confirm it reports `2` pages. Capture each page and verify page 1 contains source/summary/assessment/root cause; page 2 contains actions/Pareto/priority/guidance; no content is clipped or overlapped; and text is readable at normal zoom.

- [ ] **Step 6: Verify the running UI**

Reload `http://127.0.0.1:5177`, generate the current report, and confirm the button returns from `Generating PDF...` to `Generate PDF`, success includes elapsed time, and no print dialog opens.

- [ ] **Step 7: Review the final tracked diff**

```powershell
git diff --check
git status --short
git diff --stat HEAD~3..HEAD
```

Expected: no whitespace errors; tracked implementation changes are limited to the renderer/component/tests plus approved spec/plan. `local-test/F7_Test_Finetune_05/` and `.superpowers/` remain ignored.
