import { access, readFile, rm, writeFile } from "node:fs/promises";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  assumptionResultsPdfRouteRequestSchema,
  encodeRfc5987FileName,
  safePdfDownloadFileName,
  safeUnicodePdfDownloadFileName,
  type AssumptionResultsPdfRouteRequest,
} from "./assumption-results-pdf-contract.js";
import {
  AssumptionResultsPdfQueueFullError,
  createAssumptionResultsPdfRenderer,
  executePdfBrowser,
  renderAssumptionResultsPdfHtml,
} from "./assumption-results-pdf-renderer.js";

const INJECTED_TEXT = `<img src=x onerror="alert('unsafe')"> & analysis`;

function validRequest(): AssumptionResultsPdfRouteRequest {
  return {
    sessionId: "session-1",
    workbookName: `Workbook ${INJECTED_TEXT}.xlsx`,
    worksheetName: `Sheet ${INJECTED_TEXT}`,
    resultJudgment: {
      status: "below-target",
      headline: `Capability ${INJECTED_TEXT}`,
    },
    resultSummaryCaption: `Comparison ${INJECTED_TEXT}`,
    summaryRows: [{
      metric: `Mean ${INJECTED_TEXT}`,
      result: "1.20",
      reference: "1.00",
      referenceDetail: `Nominal ${INJECTED_TEXT}`,
      difference: "+0.20",
      assessment: "Below target",
      performanceContext: "80% of target",
      tone: "fail",
    }],
    overallAssessment: `Fail ${INJECTED_TEXT}`,
    rootCauseItems: [{
      title: `Variation ${INJECTED_TEXT}`,
      narrative: `Root ${INJECTED_TEXT}`,
      hypothesisStatus: "hypothesis",
      incompleteEvidence: true,
      quantitativeEvidence: [{
        label: `Cp-Cpk gap ${INJECTED_TEXT}`,
        value: `0.42 ${INJECTED_TEXT}`,
      }],
    }],
    actionItems: [{
      optionId: "improvement-center-mean",
      title: `Center ${INJECTED_TEXT}`,
      narrative: `Action ${INJECTED_TEXT}`,
      meanCenteringAdjustment: {
        current: `+0.03 ${INJECTED_TEXT}`,
        recommended: `0 ${INJECTED_TEXT}`,
        adjustment: `-0.03 toward LSL ${INJECTED_TEXT}`,
      },
      outcome: {
        label: `Expected result ${INJECTED_TEXT}`,
        value: `Mean 0 ${INJECTED_TEXT}`,
        context: `after applying the recommended adjustment ${INJECTED_TEXT}`,
      },
    }, {
      optionId: "improvement-relax-final-specification",
      title: `Relax ${INJECTED_TEXT}`,
      narrative: `Fallback ${INJECTED_TEXT}`,
      specificationAdjustment: {
        lower: {
          current: `-0.1 ${INJECTED_TEXT}`,
          recommended: `-0.37 ${INJECTED_TEXT}`,
          adjustment: `-0.27 ${INJECTED_TEXT}`,
        },
        upper: {
          current: `0.1 ${INJECTED_TEXT}`,
          recommended: `0.43 ${INJECTED_TEXT}`,
          adjustment: `+0.33 ${INJECTED_TEXT}`,
        },
      },
      outcome: {
        label: `Expected result ${INJECTED_TEXT}`,
        value: `Cpk 1.33 ${INJECTED_TEXT}`,
        context: `after applying both recommended limits ${INJECTED_TEXT}`,
      },
    }],
    contributors: [{
      factorName: `Factor ${INJECTED_TEXT}`,
      reference: `G10 ${INJECTED_TEXT}`,
      designNominal: 1,
      upperTolerance: 0.2,
      lowerTolerance: -0.2,
      contributionPercent: 62.5,
      cumulativePercent: 62.5,
    }, {
      factorName: `Second ${INJECTED_TEXT}`,
      reference: `G11 ${INJECTED_TEXT}`,
      designNominal: 2,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      contributionPercent: 37.5,
      cumulativePercent: 100,
    }],
    processGuidanceContext: `Evaluated ${INJECTED_TEXT}`,
    processGuidance: [{
      state: "warning",
      title: `Review ${INJECTED_TEXT}`,
      message: `Process ${INJECTED_TEXT}`,
    }],
  };
}

function outputPathFrom(args: readonly string[]): string {
  const flag = args.find((arg) => arg.startsWith("--print-to-pdf="));
  if (flag === undefined) throw new Error("Missing print-to-pdf flag.");
  return flag.slice("--print-to-pdf=".length);
}

async function expectMissing(path: string): Promise<void> {
  await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
}

describe("assumption results PDF contract", () => {
  it("accepts only bounded structured data with finite contributor numbers", () => {
    expect(assumptionResultsPdfRouteRequestSchema.safeParse(validRequest()).success).toBe(true);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      unexpectedHtml: "<strong>unsafe</strong>",
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      contributors: [{ ...validRequest().contributors[0], contributionPercent: Number.NaN }],
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      summaryRows: Array.from({ length: 21 }, () => validRequest().summaryRows[0]),
    }).success).toBe(false);
  });

  it("rejects unbounded or unsupported structured interpretation fields", () => {
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      resultJudgment: { status: "unknown", headline: "Unsupported" },
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      rootCauseItems: [{
        ...validRequest().rootCauseItems[0],
        quantitativeEvidence: Array.from({ length: 31 }, (_, index) => ({
          label: `Evidence ${index}`,
          value: String(index),
        })),
      }],
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      actionItems: [{
        title: "Unsupported action",
        narrative: "Unsupported action narrative.",
        optionId: "arbitrary-action",
      }],
    }).success).toBe(false);
  });

  it("enforces the optionId-discriminated adjustment and outcome contract", () => {
    const request = validRequest();
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      actionItems: [{
        optionId: "improvement-reduce-variation",
        title: "Reduce variation",
        narrative: "Reduce variation at the dominant contributor.",
      }],
    }).success).toBe(true);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      actionItems: [{
        optionId: "improvement-center-mean",
        title: "Center mean",
        narrative: "Center the process mean.",
      }],
    }).success).toBe(false);
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...request,
      actionItems: [{
        optionId: "improvement-relax-final-specification",
        title: "Relax specification",
        narrative: "Relax the final specification.",
        specificationAdjustment: request.actionItems[1]?.specificationAdjustment,
      }],
    }).success).toBe(false);
  });

  it("rejects contributor percentages outside zero through one hundred", () => {
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      contributors: [{
        ...validRequest().contributors[0],
        contributionPercent: -0.01,
        cumulativePercent: 100.01,
      }],
    }).success).toBe(false);
  });

  it("rejects decreasing cumulative contributor percentages", () => {
    const contributor = validRequest().contributors[0];
    expect(assumptionResultsPdfRouteRequestSchema.safeParse({
      ...validRequest(),
      contributors: [
        { ...contributor, cumulativePercent: 60 },
        { ...contributor, factorName: "Factor B", cumulativePercent: 59.99 },
      ],
    }).success).toBe(false);
  });

  it("builds a filesystem-safe PDF download name", () => {
    expect(safePdfDownloadFileName("Design<>.xlsx", "TA / Result"))
      .toBe("Design-TA-Result-assumption-results.pdf");
  });

  it("builds an ASCII fallback without splitting Unicode surrogate pairs", () => {
    const fileName = safePdfDownloadFileName(
      `Design-${"😀".repeat(100)}-装配.xlsx`,
      "结果-📈-TA",
    );

    expect(fileName).toMatch(/^[\x20-\x7e]+$/);
    expect(fileName.length).toBeLessThanOrEqual(180);
    expect(fileName).not.toMatch(/[\uD800-\uDFFF]/u);
    expect(fileName).toBe("Design-TA-assumption-results.pdf");
  });

  it("builds a safe Unicode PDF name from workbook and worksheet names", () => {
    expect(safeUnicodePdfDownloadFileName(
      "Design \"装配\"/😀.xlsx",
      "TA\\结果\u0000?",
    )).toBe("Design-装配-😀-TA-结果-assumption-results.pdf");
  });

  it("limits a Unicode PDF name without splitting a surrogate pair", () => {
    const fileName = safeUnicodePdfDownloadFileName(
      `Design-${"😀".repeat(100)}.xlsx`,
      "结果",
    );

    expect(fileName.length).toBeLessThanOrEqual(180);
    expect(fileName).not.toMatch(/[\uD800-\uDFFF]$/u);
    expect(fileName).toMatch(/-assumption-results\.pdf$/u);
  });

  it("encodes a Unicode filename as an RFC5987 UTF-8 value", () => {
    expect(encodeRfc5987FileName("装配😀 results'()*.pdf"))
      .toBe("%E8%A3%85%E9%85%8D%F0%9F%98%80%20results%27%28%29%2A.pdf");
  });
});

describe("renderAssumptionResultsPdfHtml", () => {
  it("renders an escaped, self-contained A4 landscape report with all required sections", () => {
    const html = renderAssumptionResultsPdfHtml(validRequest());

    const reportPageGroups = [...html.matchAll(/class="report-page report-page--(decision|action)"/g)].map((match) => match[1]);
    expect(reportPageGroups).toEqual(["decision", "action"]);
    expect(reportPageGroups).toHaveLength(2);

    const decisionPageMatch = html.match(/<section class="report-page report-page--decision">([\s\S]*?)<\/section>\s*<section class="report-page report-page--action">/);
    expect(decisionPageMatch).not.toBeNull();
    const decisionPage = decisionPageMatch?.[1] ?? "";
    const decisionOrder = [
      "TA Results Interpretation (based on Assumptions)",
      '<div class="source">',
      "TA Result Summary",
      "Overall Assessment",
      "Root Cause Analysis",
    ];
    let lastDecisionIndex = -1;
    for (const marker of decisionOrder) {
      const markerIndex = decisionPage.indexOf(marker);
      expect(markerIndex).toBeGreaterThan(lastDecisionIndex);
      lastDecisionIndex = markerIndex;
    }

    const actionPageMatch = html.match(/<section class="report-page report-page--action">([\s\S]*?)<\/section>\s*<\/main>/);
    expect(actionPageMatch).not.toBeNull();
    const actionPage = actionPageMatch?.[1] ?? "";
    const actionOrder = [
      "Suggested Action Sequence",
      "Tolerance Adjustment Priority",
      "TA Process and Requirements",
    ];
    let lastActionIndex = -1;
    for (const marker of actionOrder) {
      const markerIndex = actionPage.indexOf(marker);
      expect(markerIndex).toBeGreaterThan(lastActionIndex);
      lastActionIndex = markerIndex;
    }
    expect(actionPage).toContain("data-pareto-chart");
    expect(actionPage).toContain("<th>Priority</th>");

    expect(html).toContain("TA Result Summary");
    expect(html).toContain("Comparison &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Capability &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("below-target");
    expect(html).toContain("Overall Assessment");
    expect(html).toContain("Root Cause Analysis");
    expect(html).toContain("State: hypothesis · Incomplete evidence");
    expect(html).toContain("Cp-Cpk gap &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("0.42 &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Suggested Action Sequence");
    expect(html).toContain("improvement-center-mean");
    expect(html).toContain("Required mean change");
    expect(html).toContain("-0.03 toward LSL &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Mean 0 &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("after applying the recommended adjustment &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Required specification change");
    expect(html).toContain("-0.37 &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("+0.33 &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Cpk 1.33 &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("after applying both recommended limits &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("Tolerance Adjustment Priority");
    expect(html).toContain("Evaluated &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("TA Process and Requirements");
    expect(html).toContain("Factor &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis");
    expect(html).toContain("<td>1</td>");
    expect(html).toContain("<td>-0.2</td>");
    expect(html).toContain("<td>0.2</td>");
    expect(html).toContain("<td>62.50%</td>");
    expect(html).toContain("<th>Priority</th>");
    expect(html).toMatch(/<svg[^>]*data-pareto-chart[^>]*viewBox="0 0 760 220"/);
    expect(html).toMatch(/<rect[^>]*data-pareto-bar[^>]*data-contribution="62\.5"[^>]*x="197"[^>]*y="91"[^>]*width="46"[^>]*height="85"/);
    expect(html).toContain('<polyline data-pareto-cumulative-line points="220,91 564,40"');
    expect(html).toContain('<circle data-pareto-cumulative-point data-cumulative="100" cx="564" cy="40"');
    expect(html).toContain("% Cont. to σ");
    expect(html).toContain("Cumulative %");
    expect(html).toMatch(/@page\s*{[^}]*size:\s*A4 landscape;/);
    expect(html).toMatch(/thead\s*{[^}]*display:\s*table-header-group;/);
    expect(html).toMatch(/\.pareto-chart\s*{[^}]*break-inside:\s*avoid;/);
    expect(html).toMatch(/\.report-page--action\s*{[^}]*break-before:\s*page;/);
    expect(html).toContain("Workbook &lt;img src=x onerror=&quot;alert(&#39;unsafe&#39;)&quot;&gt; &amp; analysis.xlsx");
    expect(html).not.toContain(INJECTED_TEXT);
    expect(html).not.toMatch(/<script|<img|https?:\/\//i);
  });

  it("adds print-safe wrapping rules for long report text", () => {
    const html = renderAssumptionResultsPdfHtml(validRequest());

    expect(html).toMatch(/html\s*{[^}]*overflow-wrap:\s*anywhere;/);
    expect(html).toMatch(/\.source\s*{[^}]*flex-wrap:\s*wrap;[^}]*min-width:\s*0;/);
    expect(html).toMatch(/\.source\s*>\s*span\s*{[^}]*min-width:\s*0;/);
    expect(html).toMatch(/th, td\s*{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/);
    expect(html).toMatch(/\.pareto-chart\s+svg\s*{[^}]*max-width:\s*100%;/);
  });
});

describe("createAssumptionResultsPdfRenderer", () => {
  it("spawns with ignored stdio and resolves only after close code 0", async () => {
    const child = new EventEmitter() as ChildProcess;
    child.kill = vi.fn(() => true) as ChildProcess["kill"];
    const spawnProcess = vi.fn(() => child);

    const promise = executePdfBrowser("browser.exe", ["--headless=new"], spawnProcess, 15_000);

    expect(spawnProcess).toHaveBeenCalledWith("browser.exe", ["--headless=new"], {
      stdio: "ignore",
      windowsHide: true,
    });

    child.emit("close", 0, null);
    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects when browser launch emits error", async () => {
    const child = new EventEmitter() as ChildProcess;
    child.kill = vi.fn(() => true) as ChildProcess["kill"];
    const spawnProcess = vi.fn(() => child);

    const promise = executePdfBrowser("browser.exe", ["--headless=new"], spawnProcess, 15_000);

    child.emit("error", new Error("spawn failed"));
    await expect(promise).rejects.toThrow("Failed to launch PDF browser: spawn failed");
  });

  it("rejects when browser exits with nonzero code", async () => {
    const child = new EventEmitter() as ChildProcess;
    child.kill = vi.fn(() => true) as ChildProcess["kill"];
    const spawnProcess = vi.fn(() => child);

    const promise = executePdfBrowser("browser.exe", ["--headless=new"], spawnProcess, 15_000);

    child.emit("close", 3, null);
    await expect(promise).rejects.toThrow("PDF browser exited with code 3");
  });

  it("waits for browser close after a successful timeout kill before rejecting", async () => {
    vi.useFakeTimers();
    try {
      const child = new EventEmitter() as ChildProcess;
      child.kill = vi.fn(() => true) as ChildProcess["kill"];
      const spawnProcess = vi.fn(() => child);

      const promise = executePdfBrowser("browser.exe", ["--headless=new"], spawnProcess, 25);
      let outcome = "pending";
      void promise.then(
        () => { outcome = "resolved"; },
        () => { outcome = "rejected"; },
      );

      await vi.advanceTimersByTimeAsync(25);

      expect(child.kill).toHaveBeenCalledWith("SIGKILL");
      expect(outcome).toBe("pending");

      child.emit("close", null, "SIGKILL");
      await expect(promise).rejects.toThrow(
        "PDF browser timed out after 25 ms. Check for stale browser/crashpad processes and retry.",
      );
      expect(child.listenerCount("error")).toBe(0);
      expect(child.listenerCount("close")).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["returns false", vi.fn(() => false)],
    ["throws", vi.fn(() => { throw new Error("kill failed"); })],
  ])("rejects without waiting for close when the timeout kill %s", async (_case, kill) => {
    vi.useFakeTimers();
    try {
      const child = new EventEmitter() as ChildProcess;
      child.kill = kill as ChildProcess["kill"];
      const spawnProcess = vi.fn(() => child);
      const promise = executePdfBrowser("browser.exe", ["--headless=new"], spawnProcess, 25);

      const rejection = expect(promise).rejects.toThrow(
        "PDF browser timed out after 25 ms. Check for stale browser/crashpad processes and retry.",
      );
      await vi.advanceTimersByTimeAsync(25);

      await rejection;
      expect(child.listenerCount("error")).toBe(0);
      expect(child.listenerCount("close")).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries removal of the temporary directory", async () => {
    const removeDirectory = vi.fn(async (
      path: string,
      options: Parameters<typeof rm>[1],
    ) => rm(path, options));
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async (_executable, args) => {
        await writeFile(outputPathFrom(args), Buffer.from("%PDF-1.7\nfixture"));
      },
      removeDirectory,
    });

    await renderer.render(validRequest());

    expect(removeDirectory).toHaveBeenCalledOnce();
    expect(removeDirectory.mock.calls[0]?.[1]).toEqual({
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  });

  it("runs one render at a time, queues three in order, and rejects excess work", async () => {
    const releaseRender: Array<() => Promise<void>> = [];
    const temporaryDirectories: string[] = [];
    const profileDirectories: string[] = [];
    const executionOrder: string[] = [];
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async (_executable, args) => {
        const htmlPath = fileURLToPath(args.at(-1) ?? "");
        const temporaryDirectory = dirname(htmlPath);
        const profileFlag = args.find((arg) => arg.startsWith("--user-data-dir="));
        const html = await readFile(htmlPath, "utf8");
        executionOrder.push(/Workbook (\d)\.xlsx/u.exec(html)?.[1] ?? "unknown");
        temporaryDirectories.push(temporaryDirectory);
        profileDirectories.push(profileFlag?.slice("--user-data-dir=".length) ?? "");
        await new Promise<void>((resolve) => {
          releaseRender.push(async () => {
            await writeFile(outputPathFrom(args), Buffer.from("%PDF-1.7\nfixture"));
            resolve();
          });
        });
      },
    });

    const renders = Array.from({ length: 4 }, (_, index) => renderer.render({
      ...validRequest(),
      sessionId: `session-${index + 1}`,
      workbookName: `Workbook ${index + 1}.xlsx`,
    }));
    await vi.waitFor(() => expect(executionOrder).toHaveLength(1));

    await expect(renderer.render({
      ...validRequest(),
      sessionId: "session-over-limit",
    })).rejects.toBeInstanceOf(AssumptionResultsPdfQueueFullError);

    for (let index = 0; index < renders.length; index += 1) {
      expect(executionOrder).toHaveLength(index + 1);
      await releaseRender[index]?.();
      await expect(renders[index]).resolves.toEqual(expect.any(Buffer));
      if (index + 1 < renders.length) {
        await vi.waitFor(() => expect(executionOrder).toHaveLength(index + 2));
      }
    }

    expect(new Set(temporaryDirectories).size).toBe(4);
    expect(executionOrder).toEqual(["1", "2", "3", "4"]);
    expect(profileDirectories).toEqual(temporaryDirectories.map((directory) => (
      join(directory, "browser-profile")
    )));
    for (const directory of temporaryDirectories) await expectMissing(directory);
  });

  it("releases the active slot after failure so the next queued render continues", async () => {
    let rejectFirst: ((error: Error) => void) | undefined;
    let executionCount = 0;
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async (_executable, args) => {
        executionCount += 1;
        if (executionCount === 1) {
          await new Promise<void>((_resolve, reject) => { rejectFirst = reject; });
          return;
        }
        await writeFile(outputPathFrom(args), Buffer.from("%PDF-1.7\nfixture"));
      },
    });

    const failedRender = renderer.render(validRequest());
    const queuedRender = renderer.render({ ...validRequest(), sessionId: "session-queued" });
    await vi.waitFor(() => expect(executionCount).toBe(1));
    rejectFirst?.(new Error("browser failed"));

    await expect(failedRender).rejects.toThrow("browser failed");
    await expect(queuedRender).resolves.toEqual(expect.any(Buffer));
    expect(executionCount).toBe(2);
  });

  it("preserves the primary render error when cleanup also fails", async () => {
    const removeDirectory = vi.fn(async () => {
      throw new Error("cleanup failed");
    });
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async () => {
        throw new Error("browser failed");
      },
      removeDirectory,
    });

    await expect(renderer.render(validRequest())).rejects.toThrow("browser failed");
    expect(removeDirectory).toHaveBeenCalledOnce();
  });

  it("reports when no controlled browser is installed", async () => {
    const executeFile = vi.fn(async () => undefined);
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => [],
      executeFile,
    });

    await expect(renderer.render(validRequest())).rejects.toThrow(
      "No supported local Microsoft Edge or Google Chrome installation was found.",
    );
    expect(executeFile).not.toHaveBeenCalled();
  });

  it("reports when the browser produces no PDF output", async () => {
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async () => undefined,
    });

    await expect(renderer.render(validRequest())).rejects.toThrow(
      "Browser did not produce a PDF document.",
    );
  });

  it("rejects browser output without a PDF signature", async () => {
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["browser.exe"],
      executeFile: async (_executable, args) => {
        await writeFile(outputPathFrom(args), Buffer.from("not-a-pdf"));
      },
    });

    await expect(renderer.render(validRequest())).rejects.toThrow(
      "Browser output is not a valid PDF document.",
    );
  });

  it("prints with controlled browser flags, validates the PDF, and removes temporary files", async () => {
    let htmlPath = "";
    let pdfPath = "";
    let temporaryDirectory = "";
    const executeFile = vi.fn(async (_executable: string, args: readonly string[]) => {
      pdfPath = outputPathFrom(args);
      htmlPath = fileURLToPath(args.at(-1) ?? "");
      temporaryDirectory = dirname(htmlPath);
      await writeFile(pdfPath, Buffer.from("%PDF-1.7\nfixture"));
    });
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"],
      executeFile,
    });

    const bytes = await renderer.render(validRequest());

    expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(executeFile).toHaveBeenCalledOnce();
    expect(executeFile.mock.calls[0]?.[0]).toBe("C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe");
    expect(executeFile.mock.calls[0]?.[1]).toEqual(expect.arrayContaining([
      "--headless=new",
      "--disable-background-networking",
      "--no-first-run",
      "--no-pings",
    ]));
    expect(executeFile.mock.calls[0]?.[1].at(-1)).toMatch(/^file:\/\//);
    await expectMissing(htmlPath);
    await expectMissing(pdfPath);
    await expectMissing(temporaryDirectory);
  });

  it("removes temporary files when browser execution fails", async () => {
    let htmlPath = "";
    let pdfPath = "";
    let temporaryDirectory = "";
    const renderer = createAssumptionResultsPdfRenderer({
      installedBrowsers: () => ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"],
      executeFile: async (_executable, args) => {
        pdfPath = outputPathFrom(args);
        htmlPath = fileURLToPath(args.at(-1) ?? "");
        temporaryDirectory = dirname(htmlPath);
        throw new Error("browser failed");
      },
    });

    await expect(renderer.render(validRequest())).rejects.toThrow("browser failed");
    await expectMissing(htmlPath);
    await expectMissing(pdfPath);
    await expectMissing(temporaryDirectory);
  });
});