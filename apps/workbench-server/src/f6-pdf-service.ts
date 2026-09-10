import { execFile } from "node:child_process";
import { access, lstat, mkdtemp, open, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { renderF6PdfHtml } from "./f6-pdf-report.js";

export interface F6PdfRenderInput {
  readonly markdown: string;
  readonly sourceHash: string;
  readonly reportPath: string;
  readonly managedRoot: string;
}

export interface F6PdfService {
  render(input: F6PdfRenderInput): Promise<Buffer>;
}

const executeFile = promisify(execFile);

function pdfError(code: "pdf_artifact_invalid" | "pdf_render_unavailable", message: string): Error & { readonly code: string } {
  return Object.assign(new Error(message), { code });
}

export async function inlineReportImages(input: F6PdfRenderInput): Promise<ReadonlyMap<string, string>> {
  const links = [...input.markdown.matchAll(/\[[^\]]*\]\(<([^>]+\.(?:png|jpe?g))>\)/gi)].map((match) => match[1]!);
  const managedRoot = await realpath(input.managedRoot);
  const images = new Map<string, string>();
  for (const link of links) {
    try {
      if (isAbsolute(link)) throw pdfError("pdf_artifact_invalid", "F6 PDF image path must be relative.");
      const candidate = resolve(dirname(input.reportPath), link);
      const target = await realpath(candidate);
      const delta = relative(managedRoot, target);
      const stats = await lstat(candidate);
      if (delta.length === 0 || delta.startsWith("..") || isAbsolute(delta) || stats.isSymbolicLink() || !stats.isFile()) {
        throw pdfError("pdf_artifact_invalid", "F6 PDF image escaped the managed root.");
      }
      const handle = await open(candidate, "r");
      try {
        const handleStats = await handle.stat();
        const currentTarget = await realpath(candidate);
        if (!handleStats.isFile() || handleStats.dev !== stats.dev || handleStats.ino !== stats.ino || currentTarget !== target) {
          throw pdfError("pdf_artifact_invalid", "F6 PDF image changed during validation.");
        }
        const mediaType = extname(target).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
        images.set(link, `data:${mediaType};base64,${(await handle.readFile()).toString("base64")}`);
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "pdf_artifact_invalid") throw error;
      throw pdfError("pdf_artifact_invalid", "F6 PDF image is unavailable or invalid.");
    }
  }
  return images;
}

export function browserCandidates(environment: NodeJS.ProcessEnv = process.env): readonly string[] {
  return [
    environment.AI_TVA_CHROMIUM_EXECUTABLE,
    environment.PROGRAMFILES === undefined ? undefined : join(environment.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
    environment["PROGRAMFILES(X86)"] === undefined ? undefined : join(environment["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    environment.LOCALAPPDATA === undefined ? undefined : join(environment.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
    environment.PROGRAMFILES === undefined ? undefined : join(environment.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    environment["PROGRAMFILES(X86)"] === undefined ? undefined : join(environment["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    environment.LOCALAPPDATA === undefined ? undefined : join(environment.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
}

async function installedBrowsers(): Promise<readonly string[]> {
  const installed = [];
  for (const candidate of browserCandidates()) {
    try {
      await access(candidate);
      installed.push(candidate);
    } catch {
      // Continue through the controlled installation locations.
    }
  }
  if (installed.length === 0) throw pdfError("pdf_render_unavailable", "Microsoft Edge or Google Chrome is required to export the PDF report.");
  return installed;
}

export function createF6PdfService(): F6PdfService {
  return {
    async render(input) {
      const temporaryRoot = await mkdtemp(join(tmpdir(), "ta-assist-f6-pdf-"));
      const htmlPath = join(temporaryRoot, "Feature6-Report.html");
      const pdfPath = join(temporaryRoot, "Feature6-Report.pdf");
      try {
        const baseHref = new URL(".", pathToFileURL(input.reportPath)).href;
        const inlineImages = await inlineReportImages(input);
        await writeFile(htmlPath, renderF6PdfHtml({ markdown: input.markdown, sourceHash: input.sourceHash, baseHref, inlineImages }), "utf8");
        for (const browser of await installedBrowsers()) {
          const profilePath = join(temporaryRoot, `profile-${browser.toLowerCase().includes("edge") ? "edge" : "chrome"}`);
          try {
            await executeFile(browser, [
              "--headless=new",
              "--disable-gpu",
              "--no-first-run",
              "--disable-extensions",
              `--user-data-dir=${profilePath}`,
              "--no-pdf-header-footer",
              `--print-to-pdf=${pdfPath}`,
              pathToFileURL(htmlPath).href,
            ], { windowsHide: true, timeout: 60_000 });
            const pdf = await readFile(pdfPath);
            if (pdf.length >= 8 && pdf.subarray(0, 5).toString("ascii") === "%PDF-") return pdf;
          } catch {
            // Try the next installed Chromium browser.
          }
        }
        throw pdfError("pdf_render_unavailable", "Installed Chromium browsers did not produce a valid PDF report.");
      } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
      }
    },
  };
}