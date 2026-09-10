import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, closeSync, fstatSync, lstatSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { f6PdfImageLinks, renderF6PdfHtml } from "./f6-pdf-report.js";

export interface F6PdfRenderInput {
  readonly markdown: string;
  readonly sourceHash: string;
  readonly reportPath: string;
  readonly managedRoot: string;
}

export interface F6PdfRenderDependencies {
  readonly installedBrowsers?: () => readonly string[];
  readonly executeFile?: (browser: string, args: readonly string[]) => void;
}

function pdfError(code: "pdf_artifact_invalid" | "pdf_render_unavailable", message: string): Error & { readonly code: string } {
  return Object.assign(new Error(message), { code });
}

export function browserCandidates(environment: NodeJS.ProcessEnv = process.env): readonly string[] {
  return [
    environment.PROGRAMFILES === undefined ? undefined : join(environment.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
    environment["PROGRAMFILES(X86)"] === undefined ? undefined : join(environment["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    environment.LOCALAPPDATA === undefined ? undefined : join(environment.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
    environment.PROGRAMFILES === undefined ? undefined : join(environment.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    environment["PROGRAMFILES(X86)"] === undefined ? undefined : join(environment["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    environment.LOCALAPPDATA === undefined ? undefined : join(environment.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
}

function installedBrowsers(): readonly string[] {
  const installed = browserCandidates().filter((candidate) => {
    try { accessSync(candidate); return true; } catch { return false; }
  });
  if (installed.length === 0) throw pdfError("pdf_render_unavailable", "Microsoft Edge or Google Chrome is required to export the PDF report.");
  return installed;
}

function inlineReportImages(input: F6PdfRenderInput): ReadonlyMap<string, string> {
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
  const temporaryRoot = mkdtempSync(join(tmpdir(), "ta-assist-f6-pdf-"));
  const htmlPath = join(temporaryRoot, "Feature6-Report.html");
  const pdfPath = join(temporaryRoot, "Feature6-Report.pdf");
  const browsers = dependencies.installedBrowsers ?? installedBrowsers;
  const executeFile = dependencies.executeFile ?? ((browser: string, args: readonly string[]) => {
    execFileSync(browser, [...args], { windowsHide: true, timeout: 60_000, stdio: "ignore" });
  });
  try {
    const sourceHash = createHash("sha256").update(input.markdown).digest("hex");
    if (sourceHash !== input.sourceHash) throw pdfError("pdf_artifact_invalid", "F6 PDF source hash does not match the Markdown content.");
    const baseHref = new URL(".", pathToFileURL(input.reportPath)).href;
    writeFileSync(htmlPath, renderF6PdfHtml({ markdown: input.markdown, sourceHash, baseHref, inlineImages: inlineReportImages(input) }), "utf8");
    for (const browser of browsers()) {
      try {
        executeFile(browser, [
          "--headless=new",
          "--disable-gpu",
          "--no-first-run",
          "--disable-extensions",
          `--user-data-dir=${join(temporaryRoot, "profile")}`,
          "--no-pdf-header-footer",
          `--print-to-pdf=${pdfPath}`,
          pathToFileURL(htmlPath).href,
        ]);
        const pdf = readFileSync(pdfPath);
        if (pdf.length >= 8 && pdf.subarray(0, 5).toString("ascii") === "%PDF-") return pdf;
      } catch {
        // Try the next controlled Chromium installation.
      }
    }
    throw pdfError("pdf_render_unavailable", "Installed Chromium browsers did not produce a valid PDF report.");
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}