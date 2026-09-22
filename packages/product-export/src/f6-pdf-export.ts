import { createHash } from "node:crypto";
import { accessSync, closeSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { f6PdfImageLinks, renderF6PdfHtml } from "./f6-pdf-report.js";
import { executeF6PdfWorker } from "./f6-pdf-worker-process.js";

interface F6PdfDeadlines {
  readonly playwrightMs: readonly [number, number, number];
  readonly cliMs: number;
}

const DEFAULT_DEADLINES: F6PdfDeadlines = { playwrightMs: [30_000, 120_000, 300_000], cliMs: 600_000 };

function validatedDeadlines(value: F6PdfDeadlines): F6PdfDeadlines {
  const values = [...value.playwrightMs, value.cliMs];
  if (value.playwrightMs.length !== 3 || values.some((ms, index) =>
    !Number.isSafeInteger(ms) || ms <= 0 || ms > 600_000 || (index > 0 && ms <= values[index - 1]!))) {
    throw pdfError("pdf_render_unavailable", "Invalid F6 PDF deadline configuration.");
  }
  return value;
}

export interface F6PdfWorkerRequest {
  readonly browser: string;
  readonly strategy: "playwright" | "cli";
  readonly htmlPath: string;
  readonly pdfPath: string;
  readonly profilePath: string;
  readonly timeoutMs: number;
}

type AttemptOutcome = "success" | "execution_failed" | "invalid_pdf" | "timed_out" | "cleanup_failed";

export interface F6PdfRenderAttempt {
  readonly browser: string;
  readonly strategy: F6PdfWorkerRequest["strategy"];
  readonly outcome: AttemptOutcome;
  readonly elapsedMs: number;
  readonly deadlineMs: number;
}

export interface F6PdfRenderInput {
  readonly markdown: string;
  readonly sourceHash: string;
  readonly reportPath: string;
  readonly managedRoot: string;
}

export interface F6PdfRenderDependencies {
  readonly installedBrowsers?: () => readonly string[];
  readonly executeFile?: (browser: string, args: readonly string[]) => void;
  readonly executeWorker?: (request: F6PdfWorkerRequest) => void;
  readonly onAttempt?: (attempt: F6PdfRenderAttempt) => void;
  readonly deadlines?: F6PdfDeadlines;
}

export interface F6PdfRenderAttemptFailure {
  readonly browser: string;
  readonly strategy: F6PdfWorkerRequest["strategy"];
  readonly reason: Exclude<AttemptOutcome, "success">;
  readonly elapsedMs: number;
  readonly deadlineMs: number;
}

function pdfError(code: "pdf_artifact_invalid" | "pdf_render_unavailable", message: string): Error & { readonly code: string } {
  return Object.assign(new Error(message), { code });
}

function removeWorkingFiles(root: string): void {
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    throw pdfError("pdf_render_unavailable", "F6 PDF working files could not be removed.");
  }
}

export function browserCandidates(environment: NodeJS.ProcessEnv = process.env): readonly string[] {
  return preferredBrowsers([
    environment.PROGRAMFILES === undefined ? undefined : join(environment.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    environment["PROGRAMFILES(X86)"] === undefined ? undefined : join(environment["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    environment.LOCALAPPDATA === undefined ? undefined : join(environment.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    environment.PROGRAMFILES === undefined ? undefined : join(environment.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
    environment["PROGRAMFILES(X86)"] === undefined ? undefined : join(environment["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    environment.LOCALAPPDATA === undefined ? undefined : join(environment.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0));
}

function preferredBrowsers(candidates: readonly string[]): string[] {
  const unique = new Map<string, string>();
  for (const candidate of candidates) {
    const key = resolve(candidate).toLowerCase();
    if (!unique.has(key)) unique.set(key, candidate);
  }
  return [...unique.values()].sort((left, right) =>
    Number(basename(right).toLowerCase() === "chrome.exe") - Number(basename(left).toLowerCase() === "chrome.exe"));
}

function safeBrowserName(browser: string): string {
  const name = basename(browser).toLowerCase();
  return ["chrome.exe", "msedge.exe", "edge.exe"].includes(name) ? name : "chromium";
}

export function f6PdfBrowserArgs(request: F6PdfWorkerRequest): string[] {
  return [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-background-networking", "--disable-component-update",
    "--disable-sync", "--metrics-recording-only", "--no-proxy-server",
    "--host-resolver-rules=MAP * ~NOTFOUND",
    `--user-data-dir=${request.profilePath}`,
    ...(request.strategy === "cli"
      ? ["--no-pdf-header-footer", `--print-to-pdf=${request.pdfPath}`, pathToFileURL(request.htmlPath).href]
      : ["--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1", "about:blank"]),
  ];
}

function installedBrowsers(): readonly string[] {
  const installed = browserCandidates().filter((candidate) => {
    try { accessSync(candidate); return true; } catch { return false; }
  });
  if (installed.length === 0) throw pdfError("pdf_render_unavailable", "Microsoft Edge or Google Chrome is required to export the PDF report.");
  return installed;
}

export function validatedF6InlineImages(input: F6PdfRenderInput): ReadonlyMap<string, string> {
  const links = f6PdfImageLinks(input.markdown);
  const managedRoot = realpathSync(input.managedRoot);
  const images = new Map<string, string>();
  for (const link of links) {
    let descriptor: number | undefined;
    try {
      const decodedLink = decodeURI(link);
      if (decodedLink.includes("?") || decodedLink.includes("#") || /^[a-z][a-z0-9+.-]*:/i.test(decodedLink) || isAbsolute(decodedLink)) {
        throw pdfError("pdf_artifact_invalid", "F6 PDF image path must be a plain relative path.");
      }
      const candidate = resolve(dirname(input.reportPath), decodedLink);
      const target = realpathSync(candidate);
      const delta = relative(managedRoot, target);
      const stats = lstatSync(candidate);
      if (delta.length === 0 || delta.startsWith("..") || isAbsolute(delta) || stats.isSymbolicLink() || !stats.isFile()) {
        throw pdfError("pdf_artifact_invalid", "F6 PDF image escaped the managed root.");
      }
      descriptor = openSync(candidate, "r");
      const handleStats = fstatSync(descriptor);
      const currentTarget = realpathSync(candidate);
      if (!handleStats.isFile() || handleStats.dev !== stats.dev || handleStats.ino !== stats.ino || currentTarget !== target) {
        throw pdfError("pdf_artifact_invalid", "F6 PDF image changed during validation.");
      }
      const mediaType = extname(target).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
      images.set(link, `data:${mediaType};base64,${readFileSync(descriptor).toString("base64")}`);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "pdf_artifact_invalid") throw error;
      throw pdfError("pdf_artifact_invalid", "F6 PDF image is unavailable or invalid.");
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  }
  return images;
}

export function renderF6PdfSync(
  input: F6PdfRenderInput,
  dependencies: F6PdfRenderDependencies = {},
): Buffer {
  const deadlines = validatedDeadlines(dependencies.deadlines ?? DEFAULT_DEADLINES);
  const sourceHash = createHash("sha256").update(input.markdown).digest("hex");
  if (sourceHash !== input.sourceHash) throw pdfError("pdf_artifact_invalid", "F6 PDF source hash does not match the Markdown content.");
  const baseHref = new URL(".", pathToFileURL(input.reportPath)).href;
  const html = renderF6PdfHtml({ markdown: input.markdown, sourceHash, baseHref, inlineImages: validatedF6InlineImages(input) });
  const temporaryRoot = mkdtempSync(join(process.cwd(), ".ta-assist-f6-pdf-"));
  const htmlPath = join(temporaryRoot, "Feature6-Report.html");
  const executeWorker = dependencies.executeWorker ?? executeF6PdfWorker;
  try {
    writeFileSync(htmlPath, html, "utf8");
    const browsers = preferredBrowsers((dependencies.installedBrowsers ?? installedBrowsers)());
    const plan = [
      ...deadlines.playwrightMs.flatMap((timeoutMs) =>
        browsers.map((browser) => ({ browser, strategy: "playwright" as const, timeoutMs }))),
      ...browsers.map((browser) => ({ browser, strategy: "cli" as const, timeoutMs: deadlines.cliMs })),
    ];
    const attempts: F6PdfRenderAttemptFailure[] = [];
    for (const [index, { browser, strategy, timeoutMs }] of plan.entries()) {
      const attemptRoot = join(temporaryRoot, `attempt-${index}`);
      mkdirSync(attemptRoot);
      const request: F6PdfWorkerRequest = {
        browser, strategy, htmlPath,
        profilePath: join(attemptRoot, "profile"),
        pdfPath: join(attemptRoot, "report.pdf"),
        timeoutMs,
      };
      const start = performance.now();
      let outcome: AttemptOutcome = "invalid_pdf";
      let pdf: Buffer | undefined;
      try {
        if (strategy === "cli" && dependencies.executeFile !== undefined) {
          dependencies.executeFile(browser, f6PdfBrowserArgs(request));
        } else {
          executeWorker(request);
        }
        try {
          pdf = readFileSync(request.pdfPath);
          if (pdf.length >= 8 && pdf.subarray(0, 5).toString("ascii") === "%PDF-") outcome = "success";
        } catch {
          // A successful process exit is not proof of a valid PDF artifact.
        }
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
        outcome = code === "ETIMEDOUT" ? "timed_out" : code === "cleanup_failed" ? "cleanup_failed"
          : code === "invalid_pdf" ? "invalid_pdf" : "execution_failed";
      }
      const event: F6PdfRenderAttempt = {
        browser: safeBrowserName(browser), strategy, outcome, elapsedMs: Math.round(performance.now() - start), deadlineMs: timeoutMs,
      };
      try { dependencies.onAttempt?.(event); } catch { /* Diagnostics must not interrupt recovery. */ }
      if (outcome === "success" && pdf !== undefined) return pdf;
      attempts.push({ browser: event.browser, strategy, reason: outcome as Exclude<AttemptOutcome, "success">, elapsedMs: event.elapsedMs, deadlineMs: timeoutMs });
    }
    throw Object.assign(
      pdfError("pdf_render_unavailable", "Installed Chromium browsers did not produce a valid PDF report."),
      { attempts },
    );
  } finally {
    removeWorkingFiles(temporaryRoot);
  }
}