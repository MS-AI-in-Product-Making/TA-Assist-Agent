import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  browserCandidates,
  renderF6PdfSync,
  type F6PdfRenderAttempt,
  type F6PdfWorkerRequest,
} from "./f6-pdf-export.js";

const markdown = "# Governed report\n";
const input = {
  markdown,
  sourceHash: createHash("sha256").update(markdown).digest("hex"),
  reportPath: resolve("Feature6-Report.md"),
  managedRoot: process.cwd(),
};
const pdf = Buffer.from("%PDF-1.7\nvalidated\n");

describe("F6 local render recovery", () => {
  it("prefers Chrome and deduplicates case-insensitive installed locations", () => {
    const candidates = browserCandidates({
      PROGRAMFILES: "C:\\Programs",
      "PROGRAMFILES(X86)": "c:\\programs",
    });
    expect(candidates).toEqual([
      "C:\\Programs\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Programs\\Microsoft\\Edge\\Application\\msedge.exe",
    ]);
  });

  it("uses the isolated Playwright worker first and removes its profile/output", () => {
    let request: F6PdfWorkerRequest | undefined;
    const attempts: F6PdfRenderAttempt[] = [];
    const result = renderF6PdfSync(input, {
      installedBrowsers: () => ["msedge.exe", "chrome.exe", "CHROME.EXE"],
      executeWorker: (value) => {
        request = value;
        expect(value.strategy).toBe("playwright");
        expect(value.browser).toBe("chrome.exe");
        expect(value.timeoutMs).toBeGreaterThan(0);
        expect(readFileSync(value.htmlPath, "utf8")).toContain(input.sourceHash);
        writeFileSync(value.pdfPath, pdf);
      },
      executeFile: () => { throw new Error("CLI must not run"); },
      onAttempt: (attempt) => attempts.push(attempt),
    });
    expect(result).toEqual(pdf);
    expect(request).toBeDefined();
    expect(existsSync(request!.htmlPath)).toBe(false);
    expect(existsSync(request!.profilePath)).toBe(false);
    expect(attempts).toEqual([expect.objectContaining({
      browser: "chrome.exe", strategy: "playwright", outcome: "success", elapsedMs: expect.any(Number),
    })]);
    expect(JSON.stringify(attempts)).not.toContain(input.reportPath);
  });

  it("retries a hung primary on the alternate engine and then a fresh Chrome profile", () => {
    const requests: F6PdfWorkerRequest[] = [];
    const attempts: F6PdfRenderAttempt[] = [];
    const result = renderF6PdfSync(input, {
      installedBrowsers: () => ["msedge.exe", "chrome.exe"],
      executeWorker: (request) => {
        requests.push(request);
        if (requests.length <= 2) throw Object.assign(new Error("secret path"), { code: "ETIMEDOUT" });
        writeFileSync(request.pdfPath, pdf);
      },
      executeFile: () => { throw new Error("CLI must not run"); },
      onAttempt: (attempt) => attempts.push(attempt),
    });
    expect(result).toEqual(pdf);
    expect(requests.map((request) => request.browser)).toEqual(["chrome.exe", "msedge.exe", "chrome.exe"]);
    expect(new Set(requests.map((request) => request.profilePath)).size).toBe(3);
    expect(attempts.map((attempt) => attempt.outcome)).toEqual(["timed_out", "timed_out", "success"]);
  });

  it("exhausts multiple fresh Playwright retries per engine before CLI fallback", () => {
    const requests: F6PdfWorkerRequest[] = [];
    const result = renderF6PdfSync(input, {
      installedBrowsers: () => ["msedge.exe", "chrome.exe"],
      executeWorker: (request) => {
        requests.push(request);
        throw new Error("secret browser output");
      },
      executeFile: (browser, args) => {
        expect(browser).toBe("chrome.exe");
        const output = args.find((arg) => arg.startsWith("--print-to-pdf="))!.slice("--print-to-pdf=".length);
        writeFileSync(output, pdf);
      },
    });
    expect(result).toEqual(pdf);
    expect(requests.map((request) => request.browser)).toEqual([
      "chrome.exe", "msedge.exe", "chrome.exe", "msedge.exe", "chrome.exe", "msedge.exe",
    ]);
    expect(new Set(requests.map((request) => request.profilePath)).size).toBe(6);
  });

  it("does not abandon local recovery after an overall 45 or 90 second budget", () => {
    vi.useFakeTimers({ toFake: ["Date", "performance"] });
    const attempts: F6PdfRenderAttempt[] = [];
    try {
      const result = renderF6PdfSync(input, {
        installedBrowsers: () => ["chrome.exe", "msedge.exe"],
        executeWorker: () => {
          vi.advanceTimersByTime(60_000);
          throw Object.assign(new Error("hung"), { code: "ETIMEDOUT" });
        },
        executeFile: (_browser, args) => {
          writeFileSync(args.find((arg) => arg.startsWith("--print-to-pdf="))!.slice("--print-to-pdf=".length), pdf);
        },
        onAttempt: (attempt) => attempts.push(attempt),
      });
      expect(result).toEqual(pdf);
      expect(attempts).toHaveLength(7);
      expect(attempts.slice(0, 6).every((attempt) => attempt.elapsedMs === 60_000)).toBe(true);
      expect(attempts.at(-1)?.outcome).toBe("success");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not let an observer error interrupt render recovery", () => {
    let calls = 0;
    const result = renderF6PdfSync(input, {
      installedBrowsers: () => ["chrome.exe"],
      executeWorker: (request) => {
        calls += 1;
        if (calls === 1) throw new Error("failed");
        writeFileSync(request.pdfPath, pdf);
      },
      onAttempt: () => { throw new Error("observer failed"); },
    });
    expect(result).toEqual(pdf);
    expect(calls).toBe(2);
  });

  it("fails only after all strategies fail and returns safe attempt categories", () => {
    let failure: unknown;
    const attempts: F6PdfRenderAttempt[] = [];
    try {
      renderF6PdfSync(input, {
        installedBrowsers: () => ["C:\\private\\chrome.exe", "C:\\private\\msedge.exe"],
        executeWorker: (request) => {
          if (request.browser.endsWith("chrome.exe")) throw Object.assign(new Error("confidential"), { code: "ETIMEDOUT" });
          writeFileSync(request.pdfPath, "not a PDF");
        },
        executeFile: () => { throw new Error("confidential"); },
        onAttempt: (attempt) => attempts.push(attempt),
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: "pdf_render_unavailable",
      attempts: [
        { browser: "chrome.exe", strategy: "playwright", reason: "timed_out" },
        { browser: "msedge.exe", strategy: "playwright", reason: "invalid_pdf" },
        { browser: "chrome.exe", strategy: "playwright", reason: "timed_out" },
        { browser: "msedge.exe", strategy: "playwright", reason: "invalid_pdf" },
        { browser: "chrome.exe", strategy: "playwright", reason: "timed_out" },
        { browser: "msedge.exe", strategy: "playwright", reason: "invalid_pdf" },
        { browser: "chrome.exe", strategy: "cli", reason: "execution_failed" },
        { browser: "msedge.exe", strategy: "cli", reason: "execution_failed" },
      ],
    });
    expect(attempts).toHaveLength(8);
    expect(JSON.stringify(failure)).not.toMatch(/private|confidential/);
  });

  it("rejects invalid source hashes and outside images before launching any strategy", () => {
    let executed = false;
    const dependencies = {
      installedBrowsers: () => ["chrome.exe"],
      executeWorker: () => { executed = true; },
      executeFile: () => { executed = true; },
    };
    expect(() => renderF6PdfSync({ ...input, sourceHash: "0".repeat(64) }, dependencies))
      .toThrow(expect.objectContaining({ code: "pdf_artifact_invalid" }));
    const outside = "![outside](https://example.com/secret.png)";
    expect(() => renderF6PdfSync({
      ...input, markdown: outside, sourceHash: createHash("sha256").update(outside).digest("hex"),
    }, dependencies)).toThrow(expect.objectContaining({ code: "pdf_artifact_invalid" }));
    expect(executed).toBe(false);
  });
});
