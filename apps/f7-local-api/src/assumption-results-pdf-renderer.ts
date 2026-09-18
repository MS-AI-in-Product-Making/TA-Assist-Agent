import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import {
  assumptionResultsPdfRouteRequestSchema,
  type AssumptionResultsPdfRouteRequest,
} from "./assumption-results-pdf-contract.js";
import { renderAssumptionResultsPdfEvidenceHtml } from "./assumption-results-pdf-evidence-renderer.js";

const PDF_BROWSER_DEFAULT_TIMEOUT_MS = 15_000;
const TEMPORARY_DIRECTORY_REMOVE_OPTIONS = {
  recursive: true,
  force: true,
  maxRetries: 3,
  retryDelay: 100,
} as const;
const MAX_QUEUED_RENDERS = 3;
const CONTROLLED_BROWSER_CANDIDATES = [
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
] as const;

type MaybePromise<T> = T | Promise<T>;

export interface AssumptionResultsPdfRenderDependencies {
  readonly installedBrowsers?: () => MaybePromise<readonly string[]>;
  readonly executeFile?: (executable: string, args: readonly string[]) => Promise<void>;
  readonly removeDirectory?: (
    path: string,
    options: typeof TEMPORARY_DIRECTORY_REMOVE_OPTIONS,
  ) => Promise<void>;
}

export interface AssumptionResultsPdfRenderer {
  render(request: AssumptionResultsPdfRouteRequest): Promise<Buffer>;
}

export class AssumptionResultsPdfQueueFullError extends Error {
  constructor() {
    super("The local PDF renderer is at capacity.");
    this.name = "AssumptionResultsPdfQueueFullError";
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function renderSummaryRows(request: AssumptionResultsPdfRouteRequest): string {
  return request.summaryRows.map((row) => `
            <tr>
              <th scope="row">${escapeHtml(row.metric)}</th>
              <td>${escapeHtml(row.result)}</td>
              <td>${escapeHtml(row.reference)}${row.referenceDetail === undefined ? "" : `<small>${escapeHtml(row.referenceDetail)}</small>`}</td>
              <td>${escapeHtml(row.difference)}</td>
              <td><span class="status status--${escapeHtml(row.tone ?? "warning")}">${escapeHtml(row.assessment)}</span></td>
              <td>${escapeHtml(row.performanceContext)}</td>
            </tr>`).join("");
}

function renderRootCauseItems(items: AssumptionResultsPdfRouteRequest["rootCauseItems"]): string {
  if (items.length === 0) return "<p class=\"empty\">No controlled items available.</p>";
  return `<ol class="narrative-list">${items.map((item) => `
          <li><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.narrative)}</p><p class="state">State: ${escapeHtml(item.hypothesisStatus)}${item.incompleteEvidence ? " · Incomplete evidence" : ""}</p>${item.quantitativeEvidence.length === 0 ? "" : `<dl class="evidence">${item.quantitativeEvidence.map((evidence) => `<dt>${escapeHtml(evidence.label)}</dt><dd>${escapeHtml(evidence.value)}</dd>`).join("")}</dl>`}</li>`).join("")}
        </ol>`;
}

function renderAdjustmentTable(
  caption: string,
  firstColumn: string,
  rows: readonly { readonly label: string; readonly current: string; readonly recommended: string; readonly adjustment: string }[],
  outcome: { readonly label: string; readonly value: string; readonly context: string },
): string {
  return `<div class="adjustment"><table>
            <caption>${escapeHtml(caption)}</caption>
            <thead><tr><th>${escapeHtml(firstColumn)}</th><th>Current</th><th>Recommended</th><th>Adjustment</th></tr></thead>
            <tbody>${rows.map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(row.current)}</td><td>${escapeHtml(row.recommended)}</td><td>${escapeHtml(row.adjustment)}</td></tr>`).join("")}</tbody>
          </table><p class="outcome"><span>${escapeHtml(outcome.label)}</span><strong>${escapeHtml(outcome.value)}</strong><small>${escapeHtml(outcome.context)}</small></p></div>`;
}

function renderActionItems(items: AssumptionResultsPdfRouteRequest["actionItems"]): string {
  if (items.length === 0) return "<p class=\"empty\">No controlled items available.</p>";
  return `<ol class="narrative-list action-grid">${items.map((item) => {
    let adjustment = "";
    if (item.optionId === "improvement-center-mean") {
      adjustment = renderAdjustmentTable("Required mean change", "Parameter", [{
        label: "Mean",
        ...item.meanCenteringAdjustment,
      }], item.outcome);
    } else if (item.optionId === "improvement-relax-final-specification") {
      adjustment = renderAdjustmentTable("Required specification change", "Limit", [{
        label: "LSL",
        ...item.specificationAdjustment.lower,
      }, {
        label: "USL",
        ...item.specificationAdjustment.upper,
      }], item.outcome);
    }
    return `
          <li><div class="narrative-heading"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.optionId)}</span></div><p>${escapeHtml(item.narrative)}</p>${adjustment}</li>`;
  }).join("")}
        </ol>`;
}

function renderContributors(contributors: AssumptionResultsPdfRouteRequest["contributors"]): string {
  if (contributors.length === 0) return "<p class=\"empty\">No contributor priorities available.</p>";
  const chartWidth = 760;
  const plotWidth = chartWidth - 72;
  const barWidth = Math.min(46, plotWidth / contributors.length * 0.58);
  const formatCoordinate = (value: number) => String(Number(value.toFixed(2)));
  const xFor = (index: number) => 48 + (index + 0.5) * (plotWidth / contributors.length);
  const yFor = (percent: number) => 176 - Math.min(100, Math.max(0, percent)) * 1.36;
  const cumulativePoints = contributors
    .map((contributor, index) => `${formatCoordinate(xFor(index))},${formatCoordinate(yFor(contributor.cumulativePercent))}`)
    .join(" ");
  return `<div class="priority-grid">
        <figure class="pareto-chart" aria-label="Contributor Pareto chart">
          <svg data-pareto-chart viewBox="0 0 760 220" role="img" aria-labelledby="pareto-title pareto-description">
            <title id="pareto-title">Contributor priority Pareto chart</title>
            <desc id="pareto-description">Bars show percent contribution to sigma and the line shows cumulative percent.</desc>
            ${[0, 25, 50, 75, 100].map((tick) => `<line class="pareto-grid" x1="48" x2="736" y1="${formatCoordinate(yFor(tick))}" y2="${formatCoordinate(yFor(tick))}"/><text class="pareto-axis" x="40" y="${formatCoordinate(yFor(tick) + 4)}" text-anchor="end">${tick}%</text>`).join("")}
            ${contributors.map((contributor, index) => {
              const x = xFor(index);
              const y = yFor(contributor.contributionPercent);
              return `<rect data-pareto-bar data-factor-name="${escapeHtml(contributor.factorName)}" data-contribution="${contributor.contributionPercent}" x="${formatCoordinate(x - barWidth / 2)}" y="${formatCoordinate(y)}" width="${formatCoordinate(barWidth)}" height="${formatCoordinate(176 - y)}" class="pareto-bar"/><text class="pareto-value" x="${formatCoordinate(x)}" y="${formatCoordinate(Math.max(12, y - 6))}" text-anchor="middle">${contributor.contributionPercent.toFixed(2)}%</text><text class="pareto-rank" x="${formatCoordinate(x)}" y="201" text-anchor="middle">${index + 1}</text>`;
            }).join("")}
            <polyline data-pareto-cumulative-line points="${cumulativePoints}" class="pareto-line"/>
            ${contributors.map((contributor, index) => `<circle data-pareto-cumulative-point data-cumulative="${contributor.cumulativePercent}" cx="${formatCoordinate(xFor(index))}" cy="${formatCoordinate(yFor(contributor.cumulativePercent))}" r="3.5" class="pareto-point"/>`).join("")}
            <rect x="500" y="8" width="18" height="8" class="pareto-bar"/><text x="524" y="16" class="pareto-legend">% Cont. to σ</text>
            <line x1="620" x2="638" y1="12" y2="12" class="pareto-line"/><text x="644" y="16" class="pareto-legend">Cumulative %</text>
          </svg>
        </figure>
        <table class="priority-table">
          <thead><tr><th>Priority</th><th>Factor</th><th>Reference</th><th>Nominal</th><th>Lower Tol.</th><th>Upper Tol.</th><th>Contribution</th><th>Cumulative</th></tr></thead>
          <tbody>${contributors.map((contributor, index) => `<tr>
            <td>${index + 1}</td>
            <th scope="row">${escapeHtml(contributor.factorName)}</th>
            <td>${escapeHtml(contributor.reference)}</td>
            <td>${contributor.designNominal}</td>
            <td>${contributor.lowerTolerance}</td>
            <td>${contributor.upperTolerance}</td>
            <td>${contributor.contributionPercent.toFixed(2)}%</td>
            <td>${contributor.cumulativePercent.toFixed(2)}%</td>
          </tr>`).join("")}</tbody>
        </table></div>`;
}

function renderGuidance(items: AssumptionResultsPdfRouteRequest["processGuidance"]): string {
  if (items.length === 0) return "<p class=\"empty\">No process guidance available.</p>";
  return `<ol class="narrative-list guidance-grid">${items.map((item) => `
          <li class="guidance guidance--${escapeHtml(item.state)}"><strong>${escapeHtml(item.state === "warning" ? "Warning" : "Guidance")}: ${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p></li>`).join("")}
        </ol>`;
}

function renderPriorityGuidance(request: AssumptionResultsPdfRouteRequest): string {
  const definitions = request.priorityDefinitions ?? [];
  const recommendation = request.priorityRecommendation;
  if (recommendation === undefined && definitions.length === 0) return "";
  return `<div class="process-priority-guidance">${recommendation === undefined ? "" : `
        <div class="process-priority-recommendation">
          <strong>Recommended priority ${escapeHtml(recommendation.selectedPriority)}</strong>
          <span>Final priority requires Microsoft ME/DM alignment.</span>
        </div>`}
        <dl class="process-priority-definitions" aria-label="V3 priority definitions">${definitions.map((definition) => `
          <div data-priority="${escapeHtml(definition.priority)}">
            <dt><strong>${escapeHtml(definition.priority)}</strong> ${escapeHtml(definition.title)}</dt>
            <dd>${escapeHtml(definition.message)}</dd>
          </div>`).join("")}
        </dl>
      </div>`;
}

export function renderAssumptionResultsPdfHtml(input: AssumptionResultsPdfRouteRequest): string {
  const request = assumptionResultsPdfRouteRequestSchema.parse(input);
  const hasV3PriorityGuidance = request.priorityRecommendation !== undefined
    || (request.priorityDefinitions?.length ?? 0) > 0;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>TA Results Interpretation</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    html { color: #1f2933; font-family: "Segoe UI", sans-serif; font-size: 8pt; line-height: 1.3; overflow-wrap: anywhere; }
    body { margin: 0; }
    .report-page--decision { break-before: page; }
    .report-page--action { break-before: page; }
    header { border-bottom: 2px solid #176b75; margin-bottom: 4mm; padding-bottom: 2.5mm; }
    h1 { color: #123c47; font-size: 19pt; margin: 0 0 2mm; }
    h2 { break-after: avoid; color: #176b75; font-size: 11pt; margin: 4mm 0 2mm; }
    p { margin: 1mm 0 0; }
    .source { color: #52616b; display: flex; flex-wrap: wrap; gap: 8mm; min-width: 0; overflow-wrap: anywhere; }
    .source > span { min-width: 0; }
    .assessment { background: #edf7f5; border-left: 3px solid #176b75; break-inside: avoid; padding: 4mm; }
    .result-heading, .narrative-heading { align-items: baseline; display: flex; flex-wrap: wrap; gap: 2mm 5mm; justify-content: space-between; }
    .result-heading h2 { margin-bottom: 0; }
    .result-status { border: 1px solid #6a7b83; font-weight: 700; padding: 1mm 2mm; }
    table { border-collapse: collapse; margin-top: 2mm; width: 100%; }
    caption { color: #123c47; font-weight: 700; padding-bottom: 1.5mm; text-align: left; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th, td { border: 1px solid #b8c4c8; min-width: 0; overflow-wrap: anywhere; padding: 2mm; text-align: left; vertical-align: top; }
    thead th { background: #dfecef; color: #123c47; }
    td small { color: #52616b; display: block; }
    .status { font-weight: 600; }
    .status--pass { color: #176b3a; }
    .status--fail { color: #a3342d; }
    .narrative-list { margin: 0; padding-left: 5mm; }
    .narrative-list li { break-inside: avoid; margin-bottom: 2mm; padding-left: 1mm; }
    .narrative-heading span, .state { color: #52616b; }
    .evidence { display: grid; grid-template-columns: minmax(35mm, 55mm) 1fr; margin: 1.5mm 0 0; }
    .evidence dt { color: #52616b; }
    .evidence dd { margin: 0; }
    .adjustment { break-inside: avoid; }
    .outcome { align-items: baseline; border-left: 3px solid #176b3a; display: flex; flex-wrap: wrap; gap: 1mm 3mm; padding: 2mm 3mm; }
    .outcome span { color: #52616b; }
    .outcome small { color: #52616b; flex-basis: 100%; }
    .empty { color: #66737a; font-style: italic; }
    .pareto-chart { border: 1px solid #b8c4c8; break-inside: avoid; margin: 2mm 0 0; padding: 1.5mm; }
    .pareto-chart svg { display: block; height: auto; max-width: 100%; width: 100%; }
    .pareto-grid { stroke: #d4dde0; stroke-width: 1; }
    .pareto-axis, .pareto-rank, .pareto-legend { fill: #52616b; font-size: 10px; }
    .pareto-bar { fill: #2a8992; opacity: .85; }
    .pareto-value { fill: #1f2933; font-size: 10px; font-weight: 700; }
    .pareto-line { fill: none; stroke: #a3342d; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.5; }
    .pareto-point { fill: #fff; stroke: #a3342d; stroke-width: 2; }
    .guidance { border-left: 2px solid #6a7b83; padding-left: 3mm; }
    .guidance--warning { border-color: #b45309; }
    .report-page--evidence {
      height: 180mm;
      box-sizing: border-box;
      position: relative;
      break-after: page;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .report-page--evidence h1 { margin-bottom: 1mm; }
    .report-page--evidence .evidence-top { height: 76mm; left: 0; min-height: 0; position: absolute; right: 0; top: 0; }
    .report-page--evidence .factor-setup-panel { min-height: 0; }
    .report-page--evidence .factor-setup-panel table { table-layout: fixed; font-size: 7.4pt; }
    .report-page--evidence .factor-setup-panel th,
    .report-page--evidence .factor-setup-panel td { padding: 0.75mm 1.1mm; line-height: 1.15; }
    .report-page--evidence .evidence-lower-grid {
      bottom: 0;
      left: 0;
      min-height: 0;
      position: absolute;
      right: 0;
      top: 78mm;
    }
    .report-page--evidence .evidence-panel { border: 1px solid #b8c4c8; min-height: 0; padding: 2mm; position: absolute; }
    .report-page--evidence .evidence-panel svg { display: block; height: auto; max-width: 100%; width: 100%; }
    .report-page--evidence .evidence-panel--chain { display: grid; grid-template-rows: auto auto minmax(0, 1fr); height: 55mm; left: 0; top: 0; width: calc(48% - 1.5mm); }
    .report-page--evidence .evidence-panel--chain svg { height: 100%; max-height: 100%; min-height: 0; }
    .report-page--evidence .evidence-panel--chain svg text { font-size: 8px; }
    .dimension-chain-visual, .dimension-chain-visual-empty { display: flex; align-items: center; justify-content: center; min-height: 0; height: 100%; margin: 0; }
    .dimension-chain-visual img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; }
    .report-page--evidence .evidence-panel--curve { display: grid; grid-template-rows: auto auto minmax(0, 1fr); height: 55mm; right: 0; top: 0; width: calc(52% - 1.5mm); }
    .report-page--evidence .evidence-panel--curve svg { height: 100%; max-height: 100%; min-height: 0; }
    .report-page--evidence .evidence-panel--summary { bottom: 0; left: 0; right: 0; top: 58mm; }
    .report-page--evidence .dimension-note, .report-page--evidence .curve-note { color: #52616b; margin: 0 0 1.5mm; }
    .report-page--evidence .response-summary-grid {
      display: grid;
      gap: 1.4mm;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .report-page--evidence .response-summary-grid > .response-summary-table { margin-top: 0; }
    .report-page--evidence .response-summary-table {
      font-size: 7.6pt;
      margin-top: 1.5mm;
      table-layout: fixed;
    }
    .report-page--evidence .response-summary-table th,
    .report-page--evidence .response-summary-table td { padding: 0.35mm 1mm; line-height: 1.05; }
    .report-page--evidence .summary-value--pass { color: #176b3a; font-weight: 700; }
    .report-page--evidence .summary-value--warning { color: #b45309; font-weight: 700; }
    .report-page--evidence .summary-value--fail { color: #a3342d; font-weight: 700; }
    .report-page--evidence.report-page--evidence-flow { break-inside: auto; height: auto; min-height: 180mm; page-break-inside: auto; position: static; }
    .report-page--evidence-flow .evidence-top { height: auto; position: static; }
    .report-page--evidence-flow .evidence-lower-grid { display: grid; gap: 3mm; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 3mm; position: static; }
    .report-page--evidence-flow .evidence-panel { height: auto; position: static; width: auto; }
    .report-page--evidence-flow .evidence-panel--summary { grid-column: 1 / -1; }
    .report-page--evidence-flow .response-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .report-page--evidence-flow .evidence-panel svg { height: auto; }
    .report-page--action h2 { margin: 2.5mm 0 1.2mm; }
    .report-page--action p { margin-top: .6mm; }
    .action-grid { display: grid; gap: 1.5mm 5mm; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .action-grid > li { border-top: 1px solid #d4dde0; margin-bottom: 0; padding-top: 1.2mm; }
    .action-grid table { margin-top: .8mm; table-layout: fixed; }
    .action-grid caption { padding-bottom: .6mm; }
    .action-grid th, .action-grid td { padding: 1mm; }
    .action-grid .outcome { padding: 1mm 2mm; }
    .priority-grid { align-items: start; display: grid; gap: 4mm; grid-template-columns: minmax(0, .78fr) minmax(0, 1.22fr); }
    .priority-grid .pareto-chart, .priority-grid .priority-table { margin-top: 0; }
    .priority-table { font-size: 8pt; line-height: 1.15; table-layout: fixed; }
    .priority-table th, .priority-table td { padding: 1mm; }
    .priority-table th:nth-child(1) { width: 9%; }
    .priority-table th:nth-child(2) { width: 17%; }
    .priority-table th:nth-child(3) { width: 16%; }
    .process-priority-guidance { margin-top: 2mm; }
    .process-priority-recommendation { align-items: baseline; display: flex; flex-wrap: wrap; gap: 1.5mm 4mm; margin-bottom: 1.5mm; }
    .process-priority-recommendation span { color: #52616b; }
    .process-priority-definitions { display: grid; gap: 1.5mm 3mm; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0 0 2mm; }
    .process-priority-definitions dt { color: #123c47; }
    .process-priority-definitions dd { margin: .5mm 0 0; }
    .guidance-grid { display: grid; gap: 2mm 4mm; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .guidance-grid > li { margin-bottom: 0; }
  </style>
</head>
<body>
  <main>
${renderAssumptionResultsPdfEvidenceHtml(request.engineeringEvidence, request.dimensionChainVisual)}
    <div class="report-page report-page--decision">
      <header>
        <h1>TA Results Interpretation (based on Assumptions)</h1>
        <div class="source"><span><strong>Workbook:</strong> ${escapeHtml(request.workbookName)}</span><span><strong>Worksheet:</strong> ${escapeHtml(request.worksheetName)}</span></div>
      </header>
      <section>
        <div class="result-heading"><h2>TA Result Summary</h2><span class="result-status status--${escapeHtml(request.resultJudgment.status)}">${escapeHtml(request.resultJudgment.headline)}</span></div>
        <table>
          <caption>${escapeHtml(request.resultSummaryCaption)}</caption>
          <thead><tr><th>Metric</th><th>Result</th><th>Specification / Reference</th><th>Difference</th><th>Assessment</th><th>Performance Context</th></tr></thead>
          <tbody>${renderSummaryRows(request)}</tbody>
        </table>
      </section>
      <section class="assessment"><h2>Overall Assessment</h2><p>${escapeHtml(request.overallAssessment)}</p></section>
      <section><h2>Root Cause Analysis</h2>${renderRootCauseItems(request.rootCauseItems)}</section>
    </div>
    <div class="report-page report-page--action">
      <section><h2>Suggested Action Sequence</h2>${renderActionItems(request.actionItems)}</section>
      <section><h2>Tolerance Adjustment Priority</h2>${renderContributors(request.contributors)}</section>
      <section><h2>TA Process and Requirements</h2>${hasV3PriorityGuidance ? "<p>V3</p>" : ""}<p>${escapeHtml(request.processGuidanceContext)}</p>${renderPriorityGuidance(request)}${renderGuidance(request.processGuidance)}</section>
    </div>
  </main>
</body>
</html>`;
}

export async function findInstalledBrowsers(): Promise<readonly string[]> {
  const installed: string[] = [];
  for (const candidate of CONTROLLED_BROWSER_CANDIDATES) {
    try {
      await access(candidate);
      installed.push(candidate);
    } catch {
      // Continue through the controlled candidate list.
    }
  }
  return installed;
}

interface PdfBrowserPage {
  goto(url: string, options: { readonly waitUntil: "load"; readonly timeout: number }): Promise<unknown>;
  pdf(options: {
    readonly path: string;
    readonly preferCSSPageSize: true;
    readonly printBackground: true;
  }): Promise<unknown>;
}

interface PdfBrowser {
  newPage(): Promise<PdfBrowserPage>;
  close(): Promise<void>;
}

interface PdfBrowserLaunchOptions {
  readonly executablePath: string;
  readonly headless: true;
  readonly args: readonly string[];
  readonly timeout: number;
}

type PdfBrowserLauncher = (options: PdfBrowserLaunchOptions) => Promise<PdfBrowser>;

const launchPdfBrowser: PdfBrowserLauncher = async (options) => chromium.launch({
  ...options,
  args: [...options.args],
});

async function withinPdfBrowserDeadline<T>(
  operation: Promise<T>,
  timeoutMs: number,
  configuredTimeoutMs: number = timeoutMs,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`PDF browser timed out after ${configuredTimeoutMs} ms.`));
        }, Math.max(0, timeoutMs));
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function closePdfBrowserWithin(
  browser: PdfBrowser,
  timeoutMs: number,
): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      browser.close(),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, Math.max(0, timeoutMs));
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export async function executePdfBrowser(
  executable: string,
  args: readonly string[],
  launchBrowser: PdfBrowserLauncher = launchPdfBrowser,
  timeoutMs: number = PDF_BROWSER_DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const pdfOutputPath = args
    .find((argument) => argument.startsWith("--print-to-pdf="))
    ?.slice("--print-to-pdf=".length);
  const sourceUrl = args.at(-1);
  let parsedSourceUrl: URL | undefined;
  try {
    if (sourceUrl !== undefined) parsedSourceUrl = new URL(sourceUrl);
  } catch {
    parsedSourceUrl = undefined;
  }
  if (
    pdfOutputPath === undefined
    || parsedSourceUrl?.protocol !== "file:"
    || parsedSourceUrl.hostname !== ""
    || parsedSourceUrl.pathname.startsWith("//")
  ) {
    throw new Error("PDF browser requires controlled output and local source paths.");
  }
  const browserArgs = args.filter((argument) => (
    argument.startsWith("--")
    && argument !== "--headless=new"
    && argument !== "--disable-gpu"
    && argument !== "--no-pdf-header-footer"
    && !argument.startsWith("--user-data-dir=")
    && !argument.startsWith("--print-to-pdf=")
  ));
  const deadline = Date.now() + timeoutMs;
  const launchOperation = launchBrowser({
    executablePath: executable,
    headless: true,
    args: browserArgs,
    timeout: timeoutMs,
  });
  let browser: PdfBrowser;
  try {
    browser = await withinPdfBrowserDeadline(launchOperation, timeoutMs);
  } catch (error) {
    void launchOperation.then(
      async (lateBrowser) => closePdfBrowserWithin(lateBrowser, 0),
      () => undefined,
    ).catch(() => undefined);
    throw error;
  }
  let renderError: unknown;
  try {
    await withinPdfBrowserDeadline((async () => {
      const page = await browser.newPage();
      const remainingMs = Math.max(0, deadline - Date.now());
      await page.goto(parsedSourceUrl.href, { waitUntil: "load", timeout: remainingMs });
      await page.pdf({
        path: pdfOutputPath,
        preferCSSPageSize: true,
        printBackground: true,
      });
    })(), Math.max(0, deadline - Date.now()), timeoutMs);
  } catch (error) {
    renderError = error;
  }

  try {
    await closePdfBrowserWithin(browser, Math.max(0, deadline - Date.now()));
  } catch (closeError) {
    if (renderError === undefined) throw closeError;
  }
  if (renderError !== undefined) throw renderError;
}

export function createAssumptionResultsPdfRenderer(
  dependencies: AssumptionResultsPdfRenderDependencies = {},
): AssumptionResultsPdfRenderer {
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
    if (queuedRenders.length >= MAX_QUEUED_RENDERS) {
      throw new AssumptionResultsPdfQueueFullError();
    }
    await new Promise<void>((resolve) => queuedRenders.push(resolve));
  };

  const releaseRenderSlot = (): void => {
    const startNextRender = queuedRenders.shift();
    if (startNextRender) {
      startNextRender();
      return;
    }
    renderActive = false;
  };

  return {
    async render(input) {
      const request = assumptionResultsPdfRouteRequestSchema.parse(input);
      await acquireRenderSlot();
      try {
        const temporaryDirectory = await mkdtemp(join(tmpdir(), "f7-assumption-results-"));
        const htmlPath = join(temporaryDirectory, "report.html");
        const pdfPath = join(temporaryDirectory, "report.pdf");
        let hasPrimaryError = false;
        let primaryError: unknown;
        let renderedBytes: Buffer | undefined;

        try {
          const browsers = await installedBrowsers();
          const browser = browsers[0];
          if (browser === undefined) {
            throw new Error("No supported local Microsoft Edge or Google Chrome installation was found.");
          }

          await writeFile(htmlPath, renderAssumptionResultsPdfHtml(request), "utf8");
          await executeFile(browser, [
            "--headless=new",
            "--disable-background-networking",
            "--disable-breakpad",
            "--disable-crash-reporter",
            "--disable-component-update",
            "--disable-extensions",
            "--disable-default-apps",
            "--disable-sync",
            "--no-first-run",
            "--no-pings",
            "--no-pdf-header-footer",
            `--print-to-pdf=${pdfPath}`,
            pathToFileURL(htmlPath).href,
          ]);
          let bytes: Buffer;
          try {
            bytes = await readFile(pdfPath);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              throw new Error("Browser did not produce a PDF document.");
            }
            throw error;
          }
          if (bytes.byteLength <= 5 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
            throw new Error("Browser output is not a valid PDF document.");
          }
          renderedBytes = bytes;
        } catch (error) {
          hasPrimaryError = true;
          primaryError = error;
        }

        try {
          await removeDirectory(temporaryDirectory, TEMPORARY_DIRECTORY_REMOVE_OPTIONS);
        } catch (cleanupError) {
          if (!hasPrimaryError) {
            hasPrimaryError = true;
            primaryError = cleanupError;
          }
        }

        if (hasPrimaryError) throw primaryError;
        return renderedBytes as Buffer;
      } finally {
        releaseRenderSlot();
      }
    },
  };
}