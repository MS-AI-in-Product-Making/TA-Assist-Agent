import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { F7ReportProjection } from "@ai-assist/contracts";
import {
  AssumptionResultsPdfQueueFullError,
  executePdfBrowser,
  escapeHtml,
  findInstalledBrowsers,
} from "./assumption-results-pdf-renderer.js";
import {
  f7ReportPdfRouteRequestSchema,
  type F7ReportPdfRouteRequest,
} from "./f7-report-pdf-contract.js";

const PDF_PREFIX = Buffer.from("%PDF-");
const TEMPORARY_DIRECTORY_REMOVE_OPTIONS = {
  recursive: true,
  force: true,
  maxRetries: 3,
  retryDelay: 100,
} as const;
const MAX_QUEUED_RENDERS = 3;

export interface F7ReportPdfRenderer {
  render(request: F7ReportPdfRouteRequest): Promise<Buffer>;
}

export interface F7ReportPdfRenderDependencies {
  readonly installedBrowsers?: () => readonly string[] | Promise<readonly string[]>;
  readonly executeFile?: (executable: string, args: readonly string[]) => Promise<void>;
  readonly removeDirectory?: (
    path: string,
    options: typeof TEMPORARY_DIRECTORY_REMOVE_OPTIONS,
  ) => Promise<void>;
}

function cleanFileNamePart(value: string, asciiOnly: boolean): string {
  const normalized = value.normalize("NFKC");
  const filtered = asciiOnly ? normalized.replace(/[^A-Za-z0-9._-]+/g, "-") : normalized.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-");
  return filtered.replace(/[\s._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "report";
}

export function safeF7ReportPdfFileName(workbookName: string, worksheetName: string): string {
  const workbookBase = basename(workbookName, extname(workbookName));
  return `${cleanFileNamePart(workbookBase, true)}-${cleanFileNamePart(worksheetName, true)}-f7-monte-carlo-report.pdf`;
}

export function safeUnicodeF7ReportPdfFileName(workbookName: string, worksheetName: string): string {
  const workbookBase = basename(workbookName, extname(workbookName));
  return `${cleanFileNamePart(workbookBase, false)}-${cleanFileNamePart(worksheetName, false)}-f7-monte-carlo-report.pdf`;
}

function formatNumber(value: number, digits = 4): string {
  return Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: digits }) : "N/A";
}

function list(items: readonly string[], emptyMessage = "None identified."): string {
  if (items.length === 0) return `<p class="muted">${escapeHtml(emptyMessage)}</p>`;
  return `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

function reportAnalysis(report: F7ReportProjection): string {
  const analysis = report.analysis;
  if (!analysis || analysis.status === "unavailable") {
    const reason = escapeHtml(analysis?.reason ?? "Governed interpretation is unavailable.");
    return `<section><h2>Factor Setup vs Monte Carlo TA</h2><p class="muted">${reason}</p></section>
      <section><h2>Root Cause Analysis</h2><p class="muted">${reason}</p></section>
      <section><h2>Engineering Risk</h2><p class="muted">${reason}</p></section>
      <section><h2>Suggested Action Sequence</h2><p class="muted">${reason}</p></section>
      <section><h2>Validation Requirements</h2><p class="muted">${reason}</p></section>`;
  }

  const narrative = analysis.narrative;
  return `
    <section>
      <h2>Factor Setup vs Monte Carlo TA</h2>
      <table><thead><tr><th>Method</th><th>Mean</th><th>Std. deviation</th><th>Cp</th><th>Cpk</th></tr></thead>
      <tbody><tr><td>Factor setup</td><td>${formatNumber(analysis.comparison.setup.mean)}</td><td>${formatNumber(analysis.comparison.setup.standardDeviation)}</td><td>${formatNumber(analysis.comparison.setup.cp)}</td><td>${formatNumber(analysis.comparison.setup.cpk)}</td></tr>
      <tr><td>Monte Carlo</td><td>${formatNumber(analysis.comparison.monteCarlo.mean)}</td><td>${formatNumber(analysis.comparison.monteCarlo.standardDeviation)}</td><td>${formatNumber(analysis.comparison.monteCarlo.cp)}</td><td>${formatNumber(analysis.comparison.monteCarlo.cpk)}</td></tr></tbody></table>
    </section>
    <section><h2>Engineering Summary</h2><p>${escapeHtml(narrative.engineeringSummary)}</p></section>
    <section><h2>Root Cause Analysis</h2>${narrative.rootCauseAnalysis.length === 0 ? `<p class="muted">No governed root cause hypotheses were identified.</p>` : narrative.rootCauseAnalysis.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.explanation)}</p><p class="evidence">Hypothesis · ${item.completeEvidence ? "Complete evidence" : "Evidence incomplete"} · ${escapeHtml(item.ruleId)}</p></article>`).join("")}</section>
    <section><h2>Engineering Risk</h2><p>${escapeHtml(narrative.engineeringRisk)}</p></section>
    <section><h2>Suggested Action Sequence</h2>${narrative.suggestedActionSequence.length === 0 ? `<p class="muted">No governed actions were identified.</p>` : `<ol>${narrative.suggestedActionSequence.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.narrative)}</p>${list(item.validationSteps, "No validation steps supplied.")}</li>`).join("")}</ol>`}</section>
    <section><h2>Validation Requirements</h2>${list(narrative.validationRequirements)}</section>
    <section><h2>Evidence Disclosure</h2><p>${escapeHtml(narrative.evidenceDisclosure)}</p></section>`;
}

export function renderF7ReportPdfHtml(report: F7ReportProjection): string {
  const summary = report.summary;
  const statusClass = report.assessment === "MEETS_TARGET" ? "pass" : "review";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>F7 Monte Carlo Analysis Report</title><style>
    @page { size: A4 landscape; margin: 14mm; } * { box-sizing: border-box; } body { margin: 0; color: #18232d; font: 10pt "Segoe UI", sans-serif; line-height: 1.45; } header { border-bottom: 3px solid #087f5b; padding-bottom: 14px; margin-bottom: 20px; } h1 { margin: 0 0 5px; color: #102a43; font-size: 24pt; letter-spacing: 0; } h2 { margin: 22px 0 8px; color: #102a43; font-size: 14pt; border-bottom: 1px solid #ccd5dc; padding-bottom: 4px; break-after: avoid; } h3 { margin: 12px 0 4px; font-size: 11pt; } p { margin: 5px 0; } table { border-collapse: collapse; width: 100%; margin: 8px 0; } th, td { border: 1px solid #c8d1d8; padding: 6px 8px; text-align: left; } th { background: #edf3f0; } section, article { break-inside: avoid; } ol { margin: 6px 0; padding-left: 22px; } .meta { color: #52616b; } .badge { display: inline-block; margin-top: 8px; padding: 4px 9px; border-radius: 3px; font-weight: 700; } .pass { background: #d8f3e7; color: #076b4b; } .review { background: #fff0d5; color: #8a4b08; } .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; } .metric { border: 1px solid #d6dde2; padding: 8px; } .metric span { display: block; color: #52616b; font-size: 8pt; } .metric strong { font-size: 14pt; } .muted, .evidence { color: #65737e; } .evidence { font-size: 8pt; } footer { margin-top: 24px; border-top: 1px solid #ccd5dc; padding-top: 8px; color: #65737e; font-size: 8pt; }
  </style></head><body>
    <header><h1>F7 Monte Carlo Analysis Report</h1><p class="meta"><strong>Workbook:</strong> ${escapeHtml(report.workbook.fileName)} · <strong>Worksheet:</strong> ${escapeHtml(report.workbook.worksheetName)}</p><p class="meta"><strong>Generated:</strong> ${escapeHtml(report.generatedAt)} · <strong>Classification:</strong> Confidential</p><span class="badge ${statusClass}">${escapeHtml(report.assessment.replaceAll("_", " "))}</span></header>
    <section><h2>Performance Summary</h2><div class="metrics"><div class="metric"><span>Cpk / Target</span><strong>${summary.cpk === undefined ? "N/A" : formatNumber(summary.cpk, 3)} / ${formatNumber(summary.targetCpk, 3)}</strong></div><div class="metric"><span>Yield</span><strong>${formatNumber(summary.yield * 100, 3)}%</strong></div><div class="metric"><span>PPM</span><strong>${formatNumber(summary.ppm, 0)}</strong></div><div class="metric"><span>Mean / Std. Dev.</span><strong>${formatNumber(summary.mean)} / ${formatNumber(summary.standardDeviation)}</strong></div></div><p>Specification: ${formatNumber(summary.lowerSpecLimit)} to ${formatNumber(summary.upperSpecLimit)}; target sigma level ${formatNumber(summary.targetSigmaLevel, 2)}.</p></section>
    ${reportAnalysis(report)}
    <section><h2>Reproducibility Evidence</h2><table><tbody><tr><th>Session</th><td>${escapeHtml(report.sessionId)}</td></tr><tr><th>Workbook SHA-256</th><td>${escapeHtml(report.workbook.workbookContentHash)}</td></tr><tr><th>Method</th><td>${escapeHtml(report.simulation.methodId ?? "F7_MONTE_CARLO_V1")}</td></tr><tr><th>Iterations</th><td>${formatNumber(report.simulation.iterations ?? report.evidence.iterations, 0)}</td></tr><tr><th>Seed</th><td>${escapeHtml(report.simulation.runSeed ?? report.evidence.seed)}</td></tr></tbody></table></section>
    <footer>Governed engineering output · Contract ${escapeHtml(report.contractId)}</footer>
  </body></html>`;
}

export function createF7ReportPdfRenderer(dependencies: F7ReportPdfRenderDependencies = {}): F7ReportPdfRenderer {
  const installedBrowsers = dependencies.installedBrowsers ?? findInstalledBrowsers;
  const executeFile = dependencies.executeFile ?? executePdfBrowser;
  const removeDirectory = dependencies.removeDirectory ?? rm;
  const queuedRenders: Array<() => void> = [];
  let renderActive = false;

  const acquireRenderSlot = async (): Promise<void> => {
    if (!renderActive) {
      renderActive = true;
      return;
    }
    if (queuedRenders.length >= MAX_QUEUED_RENDERS) throw new AssumptionResultsPdfQueueFullError();
    await new Promise<void>((resolve) => queuedRenders.push(resolve));
  };

  const releaseRenderSlot = (): void => {
    const startNext = queuedRenders.shift();
    if (startNext) startNext();
    else renderActive = false;
  };

  return {
    async render(rawRequest) {
      const request = f7ReportPdfRouteRequestSchema.parse(rawRequest);
      await acquireRenderSlot();
      try {
        const directory = await mkdtemp(join(tmpdir(), "f7-report-pdf-"));
        const htmlPath = join(directory, "report.html");
        const pdfPath = join(directory, "report.pdf");
        let hasPrimaryError = false;
        let primaryError: unknown;
        let renderedPdf: Buffer | undefined;

        try {
          await writeFile(htmlPath, renderF7ReportPdfHtml(request.report), "utf8");
          const browsers = await installedBrowsers();
          const executable = browsers[0];
          if (!executable) throw new Error("A local Edge or Chrome installation is required to generate PDF reports.");
          await executeFile(executable, [
            "--headless=new", "--disable-background-networking", "--disable-breakpad",
            "--disable-crash-reporter", "--disable-component-update", "--disable-extensions",
            "--disable-default-apps", "--disable-sync", "--no-first-run", "--no-pings",
            "--no-pdf-header-footer", `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href,
          ]);
          let pdf: Buffer;
          try {
            pdf = await readFile(pdfPath);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              throw new Error("Browser did not produce a PDF document.");
            }
            throw error;
          }
          if (!pdf.subarray(0, PDF_PREFIX.length).equals(PDF_PREFIX)) throw new Error("PDF renderer returned invalid output.");
          renderedPdf = pdf;
        } catch (error) {
          hasPrimaryError = true;
          primaryError = error;
        }

        try {
          await removeDirectory(directory, TEMPORARY_DIRECTORY_REMOVE_OPTIONS);
        } catch (cleanupError) {
          if (!hasPrimaryError) {
            hasPrimaryError = true;
            primaryError = cleanupError;
          }
        }

        if (hasPrimaryError) throw primaryError;
        return renderedPdf as Buffer;
      } finally {
        releaseRenderSlot();
      }
    },
  };
}
