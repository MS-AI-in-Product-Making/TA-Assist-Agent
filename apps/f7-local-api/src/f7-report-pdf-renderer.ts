import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  F7_MEASUREMENT_IMPORT_MAX_FACTORS,
  type F7ReportFactor,
  type F7ReportProjection,
} from "@ai-assist/contracts";
import { renderDimensionChainVisual, type DimensionChainVisual } from "./dimension-chain-visual.js";
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
const FACTOR_SETUP_SCALED_ROW_CAPACITY = 5.5;
const DIMENSION_CHAIN_MIN_LENGTH = 36;
const DIMENSION_CHAIN_MAX_LENGTH = 180;
const DIMENSION_CHAIN_COMPRESSION_RATIO = 8;
const DIMENSION_CHAIN_WIDTH = 800;
const DIMENSION_CHAIN_PLOT_LEFT = 54;
const DIMENSION_CHAIN_PLOT_RIGHT = 746;
const DIMENSION_CHAIN_LABEL_LINE_HEIGHT = 13;
const DIMENSION_CHAIN_LABEL_MAX_CHARACTERS = 62;
const DIMENSION_CHAIN_ROW_GAP = 14;
const DIMENSION_CHAIN_MAX_FACTORS_PER_PAGE = 5;
const DIMENSION_CHAIN_MAX_PAGE_HEIGHT = 500;
const DIMENSION_CHAIN_PAGE_TOP = 24;
const DIMENSION_CHAIN_FINAL_RESERVE = 70;
const MAX_FORMATTED_NUMBER_LENGTH = 16;
const SCIENTIFIC_NOTATION_ABSOLUTE_THRESHOLD = 1e21;

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
  // eslint-disable-next-line no-control-regex
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

function formatScientific(value: number, fractionDigits = 2): string {
  return value.toExponential(fractionDigits)
    .replace(/\.0+(?=e)/, "")
    .replace(/(\.\d*?)0+(?=e)/, "$1")
    .replace("e+", "e");
}

function formatNumber(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return "N/A";
  if (value !== 0 && Math.abs(value) < 0.000001) return formatScientific(value);
  const formatted = value.toLocaleString("en-US", { maximumFractionDigits: digits });
  return Math.abs(value) >= SCIENTIFIC_NOTATION_ABSOLUTE_THRESHOLD
    || formatted.length > MAX_FORMATTED_NUMBER_LENGTH
    ? formatScientific(value)
    : formatted;
}

function formatChartTick(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  const formatted = value.toLocaleString("en-US", { maximumSignificantDigits: 4, useGrouping: false });
  return formatted.length <= 16 ? formatted : formatScientific(value, 3);
}

function sourceModeLabel(sourceMode: F7ReportProjection["factors"][number]["sourceMode"]): string {
  return sourceMode === "MEASURED" ? "Measured Data" : "Baseline Assumption";
}

function formatDensityNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}

export function factorSetupDensityStyle(factorCount: number): string {
  if (!Number.isInteger(factorCount) || factorCount <= 0 || factorCount > F7_MEASUREMENT_IMPORT_MAX_FACTORS) {
    throw new Error("Factor count must be an integer between 1 and 100.");
  }
  const scale = factorCount <= 7 ? 1 : FACTOR_SETUP_SCALED_ROW_CAPACITY / (factorCount - 1);
  const dimensions = [
    ["table-font-size", 6.4, "pt", 0.5],
    ["label-font-size", 5.8, "pt", 0.5],
    ["cell-y", 2, "px", 0],
    ["cell-x", 3, "px", 0],
    ["h3-font-size", 10.5, "pt", 0],
    ["h4-font-size", 9, "pt", 0],
    ["h3-margin-top", 9, "px", 0],
    ["h3-margin-bottom", 4, "px", 0],
    ["h4-margin-top", 8, "px", 0],
    ["h4-margin-bottom", 3, "px", 0],
    ["table-margin", 7, "px", 0],
    ["metric-stack-gap", 1, "px", 0],
    ["metric-line-gap", 4, "px", 0],
    ["border-width", 1, "px", 0],
  ] as const;
  return dimensions
    .map(([name, value, unit, minimum]) => `--factor-setup-${name}:${formatDensityNumber(Math.max(minimum, value * scale))}${unit};`)
    .join("");
}

function list(items: readonly string[], emptyMessage = "None identified."): string {
  if (items.length === 0) return `<p class="muted">${escapeHtml(emptyMessage)}</p>`;
  return `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

function unorderedList(items: readonly string[], emptyMessage: string): string {
  if (items.length === 0) return `<p class="muted">${escapeHtml(emptyMessage)}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function finiteProduct(left: number, right: number): number {
  const product = left * right;
  if (Number.isFinite(product)) return product;
  return Math.sign(left) * Math.sign(right) * Number.MAX_VALUE;
}

function finiteSum(left: number, right: number): number {
  const sum = left + right;
  if (Number.isFinite(sum)) return sum;
  return Math.sign(left) === Math.sign(right) ? Math.sign(left) * Number.MAX_VALUE : left / 2 + right / 2;
}

function finiteDifference(left: number, right: number): number {
  const difference = left - right;
  if (Number.isFinite(difference)) return difference;
  return left / 2 - right / 2;
}

function dimensionChainLength(magnitude: number, maximum: number, compressed: boolean): number {
  if (magnitude === 0 || maximum === 0) return 0;
  const normalized = Math.min(1, Math.max(0, magnitude / maximum));
  const scaled = (compressed ? Math.sqrt(normalized) : normalized) * DIMENSION_CHAIN_MAX_LENGTH;
  return Math.min(DIMENSION_CHAIN_MAX_LENGTH, Math.max(DIMENSION_CHAIN_MIN_LENGTH, scaled));
}

function signedEngineeringNumber(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`;
}

function wrapDimensionChainName(value: F7ReportFactor["factorName"]): readonly string[] {
  const characters = Array.from(value);
  if (characters.length === 0) return [""];
  return Array.from(
    { length: Math.ceil(characters.length / DIMENSION_CHAIN_LABEL_MAX_CHARACTERS) },
    (_, index) => characters.slice(
      index * DIMENSION_CHAIN_LABEL_MAX_CHARACTERS,
      (index + 1) * DIMENSION_CHAIN_LABEL_MAX_CHARACTERS,
    ).join(""),
  );
}

interface DimensionChainSegment {
  readonly factor: F7ReportFactor;
  readonly index: number;
  readonly direction: "additive" | "subtractive" | "zero";
  readonly directionLabel: string;
  readonly labelLines: readonly string[];
  readonly start: number;
  readonly end: number;
}

interface DimensionChainLabelSlice extends DimensionChainSegment {
  readonly partIndex: number;
  readonly partCount: number;
}

function dimensionChainSliceLineCount(slice: DimensionChainLabelSlice): number {
  return slice.labelLines.length + (slice.partIndex > 0 ? 1 : 0);
}

function dimensionChainSliceHeight(slice: DimensionChainLabelSlice): number {
  return dimensionChainSliceLineCount(slice) * DIMENSION_CHAIN_LABEL_LINE_HEIGHT + DIMENSION_CHAIN_ROW_GAP * 2;
}

function deriveDimensionChainLabelSlices(segment: DimensionChainSegment): readonly DimensionChainLabelSlice[] {
  const availableHeight = DIMENSION_CHAIN_MAX_PAGE_HEIGHT - DIMENSION_CHAIN_PAGE_TOP - DIMENSION_CHAIN_FINAL_RESERVE - DIMENSION_CHAIN_ROW_GAP * 2;
  const firstPartCapacity = Math.floor(availableHeight / DIMENSION_CHAIN_LABEL_LINE_HEIGHT);
  const continuationCapacity = firstPartCapacity - 1;
  const lineGroups: string[][] = [];
  let lineOffset = 0;
  while (lineOffset < segment.labelLines.length) {
    const capacity = lineGroups.length === 0 ? firstPartCapacity : continuationCapacity;
    lineGroups.push(segment.labelLines.slice(lineOffset, lineOffset + capacity));
    lineOffset += capacity;
  }
  return lineGroups.map((labelLines, partIndex) => ({
    ...segment,
    labelLines,
    partIndex,
    partCount: lineGroups.length,
  }));
}

function packDimensionChainSlices(slices: readonly DimensionChainLabelSlice[]): readonly (readonly DimensionChainLabelSlice[])[] {
  const pages: DimensionChainLabelSlice[][] = [];
  let currentPage: DimensionChainLabelSlice[] = [];
  let currentHeight = DIMENSION_CHAIN_PAGE_TOP + DIMENSION_CHAIN_FINAL_RESERVE;
  for (const slice of slices) {
    const sliceHeight = dimensionChainSliceHeight(slice);
    const exceedsHeight = currentHeight + sliceHeight > DIMENSION_CHAIN_MAX_PAGE_HEIGHT;
    const exceedsItemCap = currentPage.length >= DIMENSION_CHAIN_MAX_FACTORS_PER_PAGE;
    if (currentPage.length > 0 && (exceedsHeight || exceedsItemCap)) {
      pages.push(currentPage);
      currentPage = [];
      currentHeight = DIMENSION_CHAIN_PAGE_TOP + DIMENSION_CHAIN_FINAL_RESERVE;
    }
    currentPage.push(slice);
    currentHeight += sliceHeight;
  }
  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}

function renderDimensionChain(report: F7ReportProjection): string {
  const factors = report.factors;
  let maximumMagnitude = 0;
  let minimumNonZeroMagnitude = Number.POSITIVE_INFINITY;
  for (const factor of factors) {
    const magnitude = Math.abs(factor.designNominal);
    maximumMagnitude = Math.max(maximumMagnitude, magnitude);
    if (magnitude > 0) minimumNonZeroMagnitude = Math.min(minimumNonZeroMagnitude, magnitude);
  }
  const compressed = minimumNonZeroMagnitude !== Number.POSITIVE_INFINITY
    && maximumMagnitude / minimumNonZeroMagnitude > DIMENSION_CHAIN_COMPRESSION_RATIO;
  let accumulated = 0;
  const segments: readonly DimensionChainSegment[] = factors.map((factor, index) => {
    const start = accumulated;
    const magnitude = Math.abs(factor.designNominal);
    const direction = factor.designNominal > 0 ? "additive" : factor.designNominal < 0 ? "subtractive" : "zero";
    const signedLength = dimensionChainLength(magnitude, maximumMagnitude, compressed)
      * (direction === "subtractive" ? -1 : direction === "additive" ? 1 : 0);
    accumulated = finiteSum(accumulated, signedLength);
    const directionLabel = direction === "additive" ? "Additive" : direction === "subtractive" ? "Subtractive" : "Zero";
    return { factor, index, direction, directionLabel, labelLines: wrapDimensionChainName(factor.factorName), start, end: accumulated };
  });
  const closureStart = accumulated;
  let minimumCoordinate = 0;
  let maximumCoordinate = 0;
  for (const segment of segments) {
    minimumCoordinate = Math.min(minimumCoordinate, segment.start, segment.end);
    maximumCoordinate = Math.max(maximumCoordinate, segment.start, segment.end);
  }
  const coordinateRange = finiteDifference(maximumCoordinate, minimumCoordinate);
  const plotWidth = DIMENSION_CHAIN_PLOT_RIGHT - DIMENSION_CHAIN_PLOT_LEFT;
  const displayX = (value: number): number => {
    if (!(coordinateRange > 0)) return DIMENSION_CHAIN_WIDTH / 2;
    const normalized = finiteDifference(value, minimumCoordinate) / coordinateRange;
    const coordinate = finiteSum(DIMENSION_CHAIN_PLOT_LEFT, finiteProduct(normalized, plotWidth));
    return Number.isFinite(coordinate) ? Math.min(DIMENSION_CHAIN_PLOT_RIGHT, Math.max(DIMENSION_CHAIN_PLOT_LEFT, coordinate)) : DIMENSION_CHAIN_WIDTH / 2;
  };
  const coordinate = (value: number): string => Number.isFinite(value) ? value.toFixed(2) : "0.00";
  const zeroX = displayX(0);
  const pages = packDimensionChainSlices(segments.flatMap(deriveDimensionChainLabelSlices));

  return `<div class="dimension-chain-pages" data-dimension-chain-pages>${pages.map((pageSlices, pageOffset) => {
    const pageIndex = pageOffset + 1;
    const pageCount = pages.length;
    const isFinalPage = pageIndex === pageCount;
    let nextLabelY = DIMENSION_CHAIN_PAGE_TOP;
    const rows = pageSlices.map((slice) => {
      const labelY = nextLabelY;
      const metadataY = labelY + dimensionChainSliceLineCount(slice) * DIMENSION_CHAIN_LABEL_LINE_HEIGHT;
      const rowY = metadataY + DIMENSION_CHAIN_ROW_GAP;
      nextLabelY = rowY + DIMENSION_CHAIN_ROW_GAP;
      return { ...slice, labelY, metadataY, rowY };
    });
    const finalRowY = rows.at(-1)?.rowY ?? 44;
    const closureY = finalRowY + 42;
    const contentBottom = isFinalPage ? closureY + 42 : finalRowY + 28;
    const viewBoxHeight = Math.max(132, contentBottom);
    const titleId = `dimension-chain-title-${pageIndex}`;
    const descriptionId = `dimension-chain-description-${pageIndex}`;
    const markerSuffix = `page-${pageIndex}`;
    const continuationLabel = pageIndex === 1
      ? `Dimension Chain continues · Page ${pageIndex} of ${pageCount}`
      : `Dimension Chain continued · ${isFinalPage ? "Final block · " : ""}Page ${pageIndex} of ${pageCount}`;
    return `<div data-dimension-chain-page data-dimension-chain-page-index="${pageIndex}" data-dimension-chain-page-count="${pageCount}" class="dimension-chain-page">
      ${pageCount > 1 ? `<p class="dimension-chain-continuation">${continuationLabel}</p>` : ""}<svg data-dimension-chain data-compressed="${compressed}" class="dimension-chain-svg" viewBox="0 0 ${DIMENSION_CHAIN_WIDTH} ${viewBoxHeight}" role="img" aria-labelledby="${titleId} ${descriptionId}">
      <title id="${titleId}">Dimension Chain, page ${pageIndex} of ${pageCount}</title>
      <desc id="${descriptionId}">Horizontal signed dimension chain factors ${rows[0]!.index + 1} through ${rows.at(-1)!.index + 1} of ${segments.length}, reconstructed from governed Factor Setup inputs in report order.${isFinalPage ? " Includes the final closure to the global zero datum." : " The chain continues on the next page."}</desc>
      <defs><marker id="dimension-chain-arrow-additive-${markerSuffix}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker><marker id="dimension-chain-arrow-subtractive-${markerSuffix}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker><marker id="dimension-chain-arrow-closure-${markerSuffix}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
      <line class="dimension-chain-zero-axis" x1="${coordinate(zeroX)}" x2="${coordinate(zeroX)}" y1="22" y2="${coordinate((isFinalPage ? closureY : finalRowY) + 12)}"/>
      ${rows.map((slice) => {
        const startX = displayX(slice.start);
        const endX = displayX(slice.end);
        const fullLabel = `${slice.index + 1}. ${slice.factor.factorName} · ${signedEngineeringNumber(slice.factor.designNominal)} · ${slice.directionLabel}`;
        const continuationCue = slice.partIndex > 0
          ? `<tspan x="54" dy="0">Factor ${slice.index + 1} label continued</tspan>`
          : "";
        const nameLines = slice.labelLines.map((line, lineIndex) => {
          const firstVisibleLine = slice.partIndex === 0 && lineIndex === 0;
          const lineDelta = firstVisibleLine ? "0" : DIMENSION_CHAIN_LABEL_LINE_HEIGHT;
          return `<tspan data-dimension-chain-name-line data-label-chunk="${escapeHtml(line)}" x="54" dy="${lineDelta}">${escapeHtml(firstVisibleLine ? `${slice.index + 1}. ${line}` : line)}</tspan>`;
        }).join("");
        const label = `${slice.partIndex === 0 ? `<title>${escapeHtml(fullLabel)}</title>` : ""}<text class="dimension-chain-label" x="54" y="${coordinate(slice.labelY)}">${continuationCue}${nameLines}</text><text class="dimension-chain-metadata" x="54" y="${coordinate(slice.metadataY)}"><tspan>Item ${slice.index + 1}</tspan><tspan dx="10">${escapeHtml(signedEngineeringNumber(slice.factor.designNominal))}</tspan><tspan dx="10">${slice.directionLabel}</tspan></text>`;
        const partAttributes = `data-dimension-chain-factor-part data-factor-index="${slice.index + 1}" data-factor-id="${escapeHtml(slice.factor.factorId)}" data-factor-part="${slice.partIndex + 1}" data-factor-part-count="${slice.partCount}"`;
        if (slice.partIndex > 0) {
          return `<g ${partAttributes} data-factor-continuation="true" data-row-y="${coordinate(slice.rowY)}">${label}</g>`;
        }
        if (slice.direction === "zero") {
          return `<g data-dimension-chain-factor-part data-dimension-chain-segment data-factor-index="${slice.index + 1}" data-factor-id="${escapeHtml(slice.factor.factorId)}" data-factor-part="1" data-factor-part-count="${slice.partCount}" data-direction="zero" data-row-y="${coordinate(slice.rowY)}">${label}<circle class="dimension-chain-zero" cx="${coordinate(startX)}" cy="${coordinate(slice.rowY)}" r="5"/><line class="dimension-chain-zero-tick" x1="${coordinate(startX)}" x2="${coordinate(startX)}" y1="${coordinate(slice.rowY - 9)}" y2="${coordinate(slice.rowY + 9)}"/></g>`;
        }
        return `<g data-dimension-chain-factor-part data-dimension-chain-segment data-factor-index="${slice.index + 1}" data-factor-id="${escapeHtml(slice.factor.factorId)}" data-factor-part="1" data-factor-part-count="${slice.partCount}" data-direction="${slice.direction}" data-row-y="${coordinate(slice.rowY)}">${label}<circle class="dimension-chain-node" cx="${coordinate(startX)}" cy="${coordinate(slice.rowY)}" r="3"/><line class="dimension-chain-segment dimension-chain-${slice.direction}" x1="${coordinate(startX)}" x2="${coordinate(endX)}" y1="${coordinate(slice.rowY)}" y2="${coordinate(slice.rowY)}" marker-end="url(#dimension-chain-arrow-${slice.direction}-${markerSuffix})"/></g>`;
      }).join("")}
      ${isFinalPage ? `<g data-dimension-chain-closure><text class="dimension-chain-label dimension-chain-closure-label" x="54" y="${coordinate(closureY - 15)}">Final closure to global datum</text><line class="dimension-chain-closure" x1="${coordinate(displayX(closureStart))}" x2="${coordinate(zeroX)}" y1="${coordinate(closureY)}" y2="${coordinate(closureY)}" marker-end="url(#dimension-chain-arrow-closure-${markerSuffix})"/></g>` : ""}
    </svg></div>`;
  }).join("")}</div>`;
}

function renderFactorSetupInputs(factors: readonly F7ReportFactor[]): string {
  const rows = factors.map((factor, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(factor.factorName)}</td><td>${factor.partNumber === undefined ? "Missing" : escapeHtml(factor.partNumber)}</td><td>${factor.dimId === undefined ? "Missing" : escapeHtml(factor.dimId)}</td><td>${formatNumber(factor.designNominal)}</td><td>${formatNumber(factor.upperTolerance)}</td><td>${formatNumber(factor.lowerTolerance)}</td><td>${formatNumber(factor.longTermSafetyFactor)}</td><td>${formatNumber(factor.sigmaLevel)}</td><td>${escapeHtml(factor.setupDistribution)}</td></tr>`).join("");
  return `<h4>Setup Inputs</h4><table data-factor-setup-inputs><thead><tr><th>Item</th><th>Factor</th><th>Part Number</th><th>DIM ID</th><th>Design Nominal</th><th>+Tol</th><th>-Tol</th><th>Long-term Safety Factor</th><th>Sigma Level</th><th>Distribution</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function metricLine(label: string, value: string): string {
  return `<span class="metric-line"><span class="metric-label">${label}</span><span class="metric-value">${value}</span></span>`;
}

function renderAnalysisMetric(
  setup: number,
  measured?: { readonly actual: number; readonly delta: number },
  options: { readonly tolerance?: boolean } = {},
): string {
  const setupValue = `${options.tolerance ? "±" : ""}${formatNumber(setup)}`;
  if (measured === undefined) return `<span class="metric-stack">${metricLine("Setup", setupValue)}</span>`;
  const actualValue = `${options.tolerance ? "±3σ " : ""}${formatNumber(measured.actual)}`;
  return `<span class="metric-stack">${metricLine("Setup", setupValue)}${metricLine("Actual", actualValue)}${metricLine("Δ", signedEngineeringNumber(measured.delta))}</span>`;
}

function renderFactorMeasurementAnalysis(factors: readonly F7ReportFactor[]): string {
  const rows = factors.map((factor, index) => {
    const comparison = factor.measurementComparison;
    const unavailableMetric = { actual: "—", delta: "—" };
    const metric = (
      setup: number,
      measured: { readonly actual: number; readonly delta: number } | undefined,
      options?: { readonly tolerance?: boolean },
    ): string => comparison === undefined
      ? renderAnalysisMetric(setup, undefined, options)
      : measured === undefined
        ? `<span class="metric-stack">${metricLine("Setup", `${options?.tolerance ? "±" : ""}${formatNumber(setup)}`)}${metricLine("Actual", unavailableMetric.actual)}${metricLine("Δ", unavailableMetric.delta)}</span>`
        : renderAnalysisMetric(setup, measured, options);
    const sourceMode = `<span class="status-stack"><span>${sourceModeLabel(factor.sourceMode)}</span>${factor.sourceMode === "MEASURED" && factor.measurementWarning ? `<span class="status-label status-warning">Warning</span>` : ""}</span>`;
    const readiness = factor.readiness === "ready" ? "Ready" : "Pending";
    return `<tr><td>${index + 1}</td><td>${escapeHtml(factor.factorName)}</td><td>${metric(factor.setupMean, comparison?.mean)}</td><td>${metric(factor.setupTolerance, comparison?.tolerance, { tolerance: true })}</td><td>${metric(factor.setupOneSigma, comparison?.oneSigma)}</td><td>${metric(factor.setupCpk, comparison?.cpk)}</td><td>${formatNumber(factor.percentContributionToSigma * 100)}%</td><td>${sourceMode}</td><td>${formatNumber(factor.sampleCount, 0)}</td><td><span class="status-label status-${factor.readiness}">${readiness}</span></td></tr>`;
  }).join("");
  return `<h4>Measurement Analysis</h4><table data-factor-measurement-analysis><thead><tr><th>Item</th><th>Factor</th><th>Mean</th><th>Tolerance</th><th>1σ</th><th>Cpk</th><th>% Contribution to σ</th><th>Source Mode</th><th>Sample Count</th><th>Readiness</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderEngineeringInputs(report: F7ReportProjection): string {
  return `<section class="engineering-inputs page-break-after" data-engineering-inputs><p class="eyebrow">Governed analysis inputs</p><h2>Engineering Inputs</h2><div class="factor-setup-wrapper" style="${factorSetupDensityStyle(report.factors.length)}"><h3>Factor Setup</h3>${renderFactorSetupInputs(report.factors)}${renderFactorMeasurementAnalysis(report.factors)}</div></section>`;
}

function standardNormalCdf(value: number): number {
  const absolute = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * absolute);
  const density = Math.exp(-0.5 * absolute * absolute) / Math.sqrt(2 * Math.PI);
  const tail = density * t * (
    0.319381530
    + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))
  );
  return Math.min(1, Math.max(0, value >= 0 ? 1 - tail : tail));
}

function standardNormalIntervalProbability(lower: number, upper: number): number {
  const probability = lower > 0
    ? standardNormalCdf(-lower) - standardNormalCdf(-upper)
    : standardNormalCdf(upper) - standardNormalCdf(lower);
  return Math.min(1, Math.max(0, probability));
}

function setupExpectedCount(minimum: number, maximum: number, mean: number, standardDeviation: number, iterations: number): number {
  if (![minimum, maximum, mean, standardDeviation, iterations].every(Number.isFinite) || standardDeviation <= 0 || iterations < 0) return 0;
  const lower = finiteDifference(minimum, mean) / standardDeviation;
  const upper = finiteDifference(maximum, mean) / standardDeviation;
  return finiteProduct(standardNormalIntervalProbability(lower, upper), iterations);
}

function representativeBinWidth(bins: readonly { readonly minimum: number; readonly maximum: number }[]): number {
  const widths = bins
    .map((bin) => finiteDifference(bin.maximum, bin.minimum))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  return widths[Math.floor(widths.length / 2)] ?? 1;
}

function setupCurveSamples(
  bins: readonly { readonly minimum: number; readonly maximum: number }[],
  setup: { readonly mean: number; readonly standardDeviation: number },
  iterations: number,
  domainMinimum: number,
  domainMaximum: number,
): readonly { readonly value: number; readonly expectedCount: number }[] {
  const binWidth = representativeBinWidth(bins);
  const domainRange = finiteDifference(domainMaximum, domainMinimum);
  const rawIntervalCount = Math.ceil(domainRange / binWidth);
  const intervalCount = Number.isFinite(rawIntervalCount)
    ? Math.min(240, Math.max(12, rawIntervalCount))
    : 240;
  const values = Array.from({ length: intervalCount + 1 }, (_, index) => {
    const ratio = index / intervalCount;
    return finiteSum(
      finiteProduct(domainMinimum, 1 - ratio),
      finiteProduct(domainMaximum, ratio),
    );
  });
  if (!values.includes(setup.mean)) {
    const nearestInteriorIndex = values
      .slice(1, -1)
      .reduce((nearestIndex, value, index) => (
        Math.abs(finiteDifference(value, setup.mean)) < Math.abs(finiteDifference(values[nearestIndex]!, setup.mean))
          ? index + 1
          : nearestIndex
      ), 1);
    values[nearestInteriorIndex] = setup.mean;
  }
  const uniqueValues = [...new Set(values)].sort((left, right) => left - right);
  return uniqueValues.map((value) => {
    const halfWidth = binWidth / 2;
    return {
      value,
      expectedCount: setupExpectedCount(
        finiteDifference(value, halfWidth),
        finiteSum(value, halfWidth),
        setup.mean,
        setup.standardDeviation,
        iterations,
      ),
    };
  });
}

function renderDistributionChart(report: F7ReportProjection): string {
  const simulation = report.simulation;
  const bins = simulation.histogram.bins
    .filter((bin) => Number.isFinite(bin.minimum) && Number.isFinite(bin.maximum) && Number.isFinite(bin.observedCount) && bin.maximum > bin.minimum)
    .map((bin) => ({ ...bin, observedCount: Math.max(0, bin.observedCount) }));
  if (bins.length === 0) return `<p class="muted">Histogram evidence is unavailable.</p>`;

  const setup = report.analysis?.status === "available"
    && Number.isFinite(report.analysis.comparison.setup.mean)
    && Number.isFinite(report.analysis.comparison.setup.standardDeviation)
    && report.analysis.comparison.setup.standardDeviation > 0
    ? report.analysis.comparison.setup
    : undefined;
  const expectedCounts = bins.map((_, index) => {
    const value = simulation.normalFit.expectedBinCounts[index] ?? 0;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });
  const setupCounts = setup === undefined ? [] : bins.map((bin) => setupExpectedCount(
    bin.minimum,
    bin.maximum,
    setup.mean,
    setup.standardDeviation,
    simulation.iterations,
  ));
  const target = finiteSum(simulation.lowerSpecLimit / 2, simulation.upperSpecLimit / 2);
  const targetDistance = finiteProduct(simulation.targetSigmaLevel, simulation.standardDeviation);
  const references = [
    { id: "lower-spec-limit", label: "LSL", value: simulation.lowerSpecLimit },
    { id: "upper-spec-limit", label: "USL", value: simulation.upperSpecLimit },
    { id: "target", label: "Target", value: target },
    { id: "mean", label: "Mean", value: simulation.mean },
    { id: "minus-target-sigma", label: `−${formatNumber(simulation.targetSigmaLevel)}σ`, value: finiteSum(simulation.mean, -targetDistance) },
    { id: "plus-target-sigma", label: `+${formatNumber(simulation.targetSigmaLevel)}σ`, value: finiteSum(simulation.mean, targetDistance) },
  ].filter((reference) => Number.isFinite(reference.value));
  const setupDistance = setup === undefined ? undefined : finiteProduct(6, setup.standardDeviation);
  const domainValues = [
    ...bins.flatMap((bin) => [bin.minimum, bin.maximum]),
    ...references.map((reference) => reference.value),
    ...(setup === undefined || setupDistance === undefined
      ? []
      : [finiteSum(setup.mean, -setupDistance), finiteSum(setup.mean, setupDistance)]),
  ].filter(Number.isFinite);
  let domainMinimum = Math.min(...domainValues);
  let domainMaximum = Math.max(...domainValues);
  if (!Number.isFinite(domainMinimum) || !Number.isFinite(domainMaximum)) {
    domainMinimum = -1;
    domainMaximum = 1;
  } else if (domainMinimum === domainMaximum) {
    domainMinimum = finiteDifference(domainMinimum, 0.5);
    domainMaximum = finiteSum(domainMaximum, 0.5);
  }
  const setupSamples = setup === undefined
    ? []
    : setupCurveSamples(bins, setup, simulation.iterations, domainMinimum, domainMaximum);
  const maximumCount = Math.max(
    1,
    ...bins.map((bin) => bin.observedCount),
    ...expectedCounts,
    ...setupCounts,
    ...setupSamples.map(({ expectedCount }) => expectedCount),
  );
  const plotLeft = 56;
  const plotRight = 780;
  const plotTop = 72;
  const plotBottom = 278;
  const scaledRange = finiteDifference(domainMaximum / 2, domainMinimum / 2);
  const plotWidth = finiteDifference(plotRight, plotLeft);
  const x = (value: number): number => scaledRange > 0
    ? finiteSum(plotLeft, finiteProduct(finiteDifference(value / 2, domainMinimum / 2) / scaledRange, plotWidth))
    : finiteSum(plotLeft, plotWidth / 2);
  const y = (value: number): number => plotTop + (1 - Math.max(0, value) / maximumCount) * (plotBottom - plotTop);
  const coordinate = (value: number): string => Number.isFinite(value) ? value.toFixed(2) : "0";
  const curvePath = (counts: readonly number[]): string => bins.map((bin, index) => {
    const midpoint = finiteSum(bin.minimum / 2, bin.maximum / 2);
    return `${index === 0 ? "M" : "L"}${coordinate(x(midpoint))},${coordinate(y(counts[index] ?? 0))}`;
  }).join(" ");
  const topReferenceIds = new Set(["lower-spec-limit", "target", "upper-spec-limit"]);
  const positionedReferences = references.map((reference) => ({
    ...reference,
    x: x(reference.value),
    row: topReferenceIds.has(reference.id) ? "top" as const : "bottom" as const,
  }));
  const setupMeanX = setup === undefined ? undefined : x(setup.mean);
  const yTicks = Array.from({ length: 5 }, (_, index) => maximumCount * index / 4);
  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return finiteSum(
      finiteProduct(domainMinimum, 1 - ratio),
      finiteProduct(domainMaximum, ratio),
    );
  });

  return `<figure class="distribution-figure">
    <svg data-monte-carlo-chart viewBox="0 0 800 320" role="img" aria-labelledby="monte-carlo-chart-title monte-carlo-chart-description">
      <title id="monte-carlo-chart-title">Monte Carlo output distribution</title>
      <desc id="monte-carlo-chart-description">Observed simulation histogram with fitted distributions and governed references.</desc>
      ${yTicks.map((tick) => `<g><line class="plot-grid" x1="56" x2="780" y1="${coordinate(y(tick))}" y2="${coordinate(y(tick))}"/><text class="plot-tick-label" x="50" y="${coordinate(y(tick) + 4)}" text-anchor="end">${formatChartTick(tick)}</text></g>`).join("")}
      <line class="plot-axis" x1="56" x2="780" y1="278" y2="278"/><line class="plot-axis" x1="56" x2="56" y1="72" y2="278"/>
      ${bins.map((bin) => {
        const specificationStatus = bin.maximum < simulation.lowerSpecLimit || bin.minimum > simulation.upperSpecLimit
          ? "out-of-spec"
          : bin.minimum >= simulation.lowerSpecLimit && bin.maximum <= simulation.upperSpecLimit
            ? "in-spec"
            : "mixed";
        const barX = x(bin.minimum);
        const barY = y(bin.observedCount);
        return `<rect data-monte-carlo-bin data-specification-status="${specificationStatus}" class="monte-carlo-bin monte-carlo-bin-${specificationStatus}" x="${coordinate(barX)}" y="${coordinate(barY)}" width="${coordinate(Math.max(1, finiteDifference(finiteDifference(x(bin.maximum), barX), 1)))}" height="${coordinate(Math.max(0, finiteDifference(plotBottom, barY)))}"/>`;
      }).join("")}
      ${positionedReferences.map((reference) => `<g data-monte-carlo-reference data-reference-id="${reference.id}" data-reference-row="${reference.row}"><line class="monte-carlo-reference reference-${reference.id}" x1="${coordinate(reference.x)}" x2="${coordinate(reference.x)}" y1="72" y2="278"/><text class="monte-carlo-reference-label" x="${coordinate(reference.x)}" y="${reference.row === "top" ? 16 : 31}" text-anchor="middle">${reference.label} ${formatNumber(reference.value)}</text></g>`).join("")}
      <path data-monte-carlo-fit class="monte-carlo-fit" d="${curvePath(expectedCounts)}"/>
      ${setup === undefined ? "" : `<path data-factor-setup-fit class="factor-setup-fit" d="${setupSamples.map((sample, index) => `${index === 0 ? "M" : "L"}${coordinate(x(sample.value))},${coordinate(y(sample.expectedCount))}`).join(" ")}"/><g data-factor-setup-mean data-reference-row="bottom" class="factor-setup-mean"><line x1="${coordinate(setupMeanX ?? 0)}" x2="${coordinate(setupMeanX ?? 0)}" y1="72" y2="278"/><text class="monte-carlo-reference-label" x="${coordinate(setupMeanX ?? 0)}" y="31" text-anchor="middle">Setup Mean ${formatNumber(setup.mean)}</text></g>`}
      ${xTicks.map((tick) => `<g><line class="plot-tick" x1="${coordinate(x(tick))}" x2="${coordinate(x(tick))}" y1="278" y2="283"/><text class="plot-tick-label" x="${coordinate(x(tick))}" y="298" text-anchor="middle">${formatChartTick(tick)}</text></g>`).join("")}
      <text class="plot-axis-label" x="418" y="316" text-anchor="middle">Simulated system output</text><text class="plot-axis-label" transform="translate(15 175) rotate(-90)" text-anchor="middle">Count</text>
    </svg>
    <figcaption class="chart-legend" data-monte-carlo-legend><span><i class="legend-in-spec"></i>In specification</span><span><i class="legend-out-of-spec"></i>Out of specification</span><span><i class="legend-mixed"></i>Crosses specification limit</span><span><i class="legend-monte-carlo"></i>Moment-fitted Normal expected count</span>${setup === undefined ? "" : `<span><i class="legend-setup"></i>Factor Setup TA Normal expected count</span><span><i class="legend-setup-mean"></i>Setup Mean</span>`}<span><i class="legend-spec"></i>Specification limits</span><span><i class="legend-center-target"></i>Target (specification midpoint)</span><span><i class="legend-target"></i>Target sigma range</span></figcaption>
  </figure>`;
}

function analysisUnavailableReason(report: F7ReportProjection): string {
  return report.analysis?.status === "unavailable"
    ? report.analysis.reason
    : "Governed interpretation is unavailable.";
}

function assessmentContent(report: F7ReportProjection): { title: string; detail: string } {
  if (report.assessment === "MEETS_TARGET") return { title: "Meets target", detail: "The simulated capability meets the governed target." };
  if (report.assessment === "BELOW_TARGET") return { title: "Below target", detail: "The simulated capability is below the governed target." };
  return { title: "Not evaluable", detail: "Capability cannot be evaluated because the simulation has zero variance." };
}

function renderAssessment(report: F7ReportProjection): string {
  const content = assessmentContent(report);
  return `<section class="assessment-banner assessment-${report.assessment.toLowerCase()}" data-report-assessment data-assessment="${report.assessment}"><div><p class="assessment-label">Governed assessment</p><h2>${content.title}</h2><p>${content.detail}</p></div><p class="assessment-disclaimer">This statistical assessment is not a design or production Release/Hold decision.</p></section>`;
}

function renderResultVisuals(report: F7ReportProjection, dimensionChainVisual?: DimensionChainVisual): string {
  const reconstructedDimensionChain = dimensionChainVisual === undefined ? renderDimensionChain(report) : undefined;
  const reconstructedPageCount = reconstructedDimensionChain?.match(/data-dimension-chain-page-count="(\d+)"/)?.[1];
  const dimensionChain = dimensionChainVisual !== undefined
    ? renderDimensionChainVisual(dimensionChainVisual)
    : reconstructedPageCount === "1"
      ? `<div class="dimension-chain-fallback" data-dimension-chain-fallback>${reconstructedDimensionChain}</div>`
      : `<div class="dimension-chain-visual-empty" data-dimension-chain-fallback-unavailable><p><strong>Dimension Chain visual unavailable</strong><br>See the Dimension Chain audit appendix following this result page.</p></div>`;
  const dimensionChainAudit = reconstructedPageCount !== undefined && reconstructedPageCount !== "1"
    ? `<section class="dimension-chain-audit page-break" data-reconstructed-dimension-chain-audit><p class="eyebrow">Governed traceability</p><h2>Dimension Chain audit appendix</h2>${reconstructedDimensionChain}</section>`
    : "";
  return `<section class="result-visuals" data-result-visuals>
    <section class="hero-result"><p class="eyebrow">Governed result</p><h2><strong>${formatNumber(report.simulation.yield * 100, 6)}%</strong> predicted yield</h2><p>Cpk ${report.summary.cpk === undefined ? "N/A" : formatNumber(report.summary.cpk, 6)} against target ${formatNumber(report.summary.targetCpk, 6)} · ${formatNumber(report.simulation.ppm, 0)} PPM outside specification.</p></section>
    <div class="result-visual-grid">
      <section class="result-visual-panel result-dimension-chain" data-result-dimension-chain><h2>Dimension Chain</h2>${dimensionChain}</section>
      <section class="result-visual-panel result-distribution" data-result-distribution><h2>Monte Carlo output distribution</h2>${renderDistributionChart(report)}</section>
    </div>
  </section>${dimensionChainAudit}`;
}

function renderWebReport(report: F7ReportProjection): string {
  const analysis = report.analysis;
  const reportContext = `<p class="subtle">${escapeHtml(report.workbook.fileName)} · ${escapeHtml(report.workbook.worksheetName)}</p>`;
  if (!analysis || analysis.status === "unavailable") {
    const reason = escapeHtml(analysisUnavailableReason(report));
    return `<section class="web-report page-break"><p class="eyebrow">Step 5 · F0 interpretation</p><h2>TA interpretation and optimization report</h2>${reportContext}<section class="assessment-banner assessment-not_evaluable" data-report-analysis-unavailable><div><p class="assessment-label">F0 analysis unavailable</p><h3>Complete governed evidence</h3><p>${reason}</p>${analysis?.optimizationDirections.length ? unorderedList(analysis.optimizationDirections, "") : ""}</div></section>${renderAssessment(report)}</section>`;
  }

  const setup = analysis.comparison.setup;
  const monteCarlo = analysis.comparison.monteCarlo;
  return `<section class="web-report page-break"><p class="eyebrow">Step 5 · F0 interpretation</p><h2>TA interpretation and optimization report</h2>${reportContext}
    <section><div class="section-heading"><div><p class="eyebrow">Assumption vs measured evidence</p><h3>Factor Setup vs Monte Carlo TA</h3></div><p>${escapeHtml(analysis.targetAssessment)}</p></div><table><caption>Factor Setup assumption and measured-data Monte Carlo comparison</caption><thead><tr><th>TA parameter</th><th>Factor Setup assumption</th><th>Measured-data Monte Carlo</th><th>Difference</th></tr></thead><tbody>
      <tr><th>Mean</th><td>${formatNumber(setup.mean, 6)}</td><td>${formatNumber(monteCarlo.mean, 6)}</td><td>${formatNumber(monteCarlo.mean - setup.mean, 6)}</td></tr>
      <tr><th>Standard deviation</th><td>${formatNumber(setup.standardDeviation, 6)}</td><td>${formatNumber(monteCarlo.standardDeviation, 6)}</td><td>${setup.standardDeviation === 0 ? "N/A" : formatNumber((monteCarlo.standardDeviation / setup.standardDeviation - 1) * 100, 6) + "%"}</td></tr>
      <tr><th>Cp</th><td>${formatNumber(setup.cp, 6)}</td><td>${formatNumber(monteCarlo.cp, 6)}</td><td>${formatNumber(monteCarlo.cp - setup.cp, 6)}</td></tr>
      <tr><th>Cpk</th><td>${formatNumber(setup.cpk, 6)}</td><td>${formatNumber(monteCarlo.cpk, 6)}</td><td>${formatNumber(monteCarlo.cpk - setup.cpk, 6)}</td></tr>
    </tbody></table></section>
    <section class="f0-guidance"><div class="section-heading"><div><p class="eyebrow">F0 ${escapeHtml(analysis.provenance.knowledgeBaseVersion)} / ${escapeHtml(analysis.provenance.ruleId)}</p><h2>Interpretation and optimization direction</h2></div><span class="status-chip ${report.assessment === "MEETS_TARGET" ? "chip-success" : "chip-blocked"}">${assessmentContent(report).title}</span></div><div class="guidance-grid"><article><h3>Interpretation</h3>${unorderedList(analysis.interpretations, "No governed interpretations were identified.")}</article><article><h3>Optimization direction</h3>${list(analysis.optimizationDirections, "No governed optimization directions were identified.")}</article></div><p class="applicability">Applicability: ${escapeHtml(analysis.provenance.applicability)}</p></section>
    ${renderAssessment(report)}
  </section>`;
}

export function renderF7ReportPdfHtml(report: F7ReportProjection, dimensionChainVisual?: DimensionChainVisual): string {
  const statusClass = report.assessment === "MEETS_TARGET" ? "pass" : report.assessment === "BELOW_TARGET" ? "review" : "not-evaluable";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>F7 Monte Carlo Governed Result Report</title><style>
    .dimension-chain-svg { width: 100%; height: auto; max-height: none; }
    .dimension-chain-visual, .dimension-chain-visual-empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 105mm; margin: 7px 0 10px; overflow: hidden; }
    .dimension-chain-visual img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; }
    .result-visuals { break-before: page; break-after: page; }
    .result-visual-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8mm; align-items: start; }
    .result-visual-panel { min-width: 0; overflow: hidden; }
    .result-visual-panel h2 { margin-top: 10px; }
    .result-distribution .distribution-figure { margin: 7px 0 0; }
    .result-distribution [data-monte-carlo-chart] { display: block; width: 100%; height: auto; }
    .dimension-chain-fallback { height: 105mm; overflow: hidden; }
    .dimension-chain-fallback .dimension-chain-pages { display: flex; width: 100%; height: 100%; gap: 2mm; align-items: stretch; }
    .dimension-chain-fallback .dimension-chain-page { flex: 1 1 0; min-width: 0; margin: 0; }
    .dimension-chain-fallback .dimension-chain-continuation { display: none; }
    .dimension-chain-fallback [data-dimension-chain] { width: 100%; height: 100%; max-height: 100%; }
    .dimension-chain-audit .dimension-chain-page { break-inside: avoid; page-break-inside: avoid; margin: 7px 0 10px; }
    .dimension-chain-audit .dimension-chain-page + .dimension-chain-page { break-before: page; page-break-before: always; }
    @page { size: A4 landscape; margin: 12mm; } * { box-sizing: border-box; } body { margin: 0; color: #182b3a; font: 9pt "Segoe UI", sans-serif; line-height: 1.42; } header { border-bottom: 4px solid #0b7a75; padding-bottom: 12px; margin-bottom: 16px; } h1 { margin: 0 0 5px; color: #102a43; font-size: 23pt; letter-spacing: 0; } h2 { margin: 16px 0 7px; color: #102a43; font-size: 13pt; break-after: avoid; } h3 { margin: 9px 0 4px; color: #183b56; font-size: 10.5pt; } p { margin: 4px 0; } table { border-collapse: collapse; width: 100%; margin: 7px 0; font-size: 8.2pt; } caption { color: #5c6b76; padding-bottom: 5px; text-align: left; } th, td { border: 1px solid #c8d1d8; padding: 5px 7px; text-align: left; vertical-align: top; overflow-wrap: anywhere; } thead { display: table-header-group; } thead th, tbody th { background: #edf0f3; } section, article, table, figure, .assessment-banner, .run-metadata { break-inside: avoid; } ol, ul { margin: 5px 0; padding-left: 20px; } .page-break { break-before: page; } .page-break-after { break-after: page; } .meta, .muted { color: #5c6b76; } .eyebrow, .assessment-label { margin: 0 0 3px; color: #48606f; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; } .badge, .status-chip { display: inline-block; margin-top: 7px; padding: 3px 8px; border-radius: 3px; font-weight: 700; } .pass, .chip-success { background: #dcefe9; color: #076b4b; } .review, .chip-blocked { background: #fbeceb; color: #a33a32; } .not-evaluable { background: #edf0f3; color: #52616b; } .engineering-inputs, .engineering-inputs table { break-inside: auto; } .engineering-inputs tr { break-inside: avoid; } [data-factor-setup-inputs] { table-layout: fixed; font-size: 7.4pt; } [data-factor-setup-inputs] th:first-child, [data-factor-setup-inputs] td:first-child { width: 5%; text-align: center; } [data-factor-setup-inputs] th:nth-child(n+3):nth-child(-n+7), [data-factor-setup-inputs] td:nth-child(n+3):nth-child(-n+7) { width: 10%; text-align: right; } [data-dimension-chain] { width: 100%; height: auto; max-height: none; } [data-dimension-chain] marker path { fill: currentColor; } .dimension-chain-zero-axis { stroke: #aab6be; stroke-width: 1; stroke-dasharray: 4 4; } .dimension-chain-node { fill: #536574; } .dimension-chain-segment, .dimension-chain-closure { fill: none; stroke-width: 3; } .dimension-chain-additive { color: #0b7a75; stroke: #0b7a75; } .dimension-chain-subtractive { color: #b6423a; stroke: #b6423a; } .dimension-chain-zero, .dimension-chain-zero-tick { fill: #fff; stroke: #6b4f8a; stroke-width: 2; } .dimension-chain-closure { color: #536574; stroke: #536574; stroke-dasharray: 6 4; } .dimension-chain-label { fill: #183b56; font: 11px "Segoe UI", sans-serif; font-weight: 600; } .dimension-chain-closure-label { fill: #536574; } .hero-result { border-left: 6px solid #0b7a75; padding: 9px 13px; background: #f3f6f7; } .hero-result h2 { margin: 0; } .hero-result strong { color: #102a43; font-size: 18pt; } .distribution-section { margin-top: 12px; } .distribution-figure { margin: 6px 0 12px; } svg { display: block; width: 100%; max-height: 84mm; background: #f8fafb; border: 1px solid #d4dce2; } .plot-grid { stroke: #dce3e8; stroke-width: 1; } .plot-axis, .plot-tick { stroke: #536574; stroke-width: 1; } .plot-tick-label, .plot-axis-label, .monte-carlo-reference-label { fill: #536574; font: 10px "Segoe UI", sans-serif; } .plot-axis-label { font-weight: 700; } .monte-carlo-bin-in-spec { fill: #4b82c3; } .monte-carlo-bin-out-of-spec { fill: #c94a45; } .monte-carlo-bin-mixed { fill: #8a98a4; } .monte-carlo-fit { fill: none; stroke: #123f63; stroke-width: 2.5; } .factor-setup-fit { fill: none; stroke: #0b7a75; stroke-width: 2.5; stroke-dasharray: 7 4; } .factor-setup-mean { stroke: #0b7a75; stroke-width: 1.5; stroke-dasharray: 3 3; } .monte-carlo-reference { stroke-width: 1.2; stroke-dasharray: 4 3; } .reference-lower-spec-limit, .reference-upper-spec-limit { stroke: #a33a32; } .reference-target { stroke: #6b4f8a; } .reference-mean { stroke: #123f63; } .reference-minus-target-sigma, .reference-plus-target-sigma { stroke: #b17c11; } .chart-legend { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 6px; color: #4e606c; font-size: 7.5pt; } .chart-legend span { white-space: nowrap; } .chart-legend i { display: inline-block; width: 15px; height: 7px; margin-right: 4px; vertical-align: middle; } .legend-in-spec { background: #4b82c3; } .legend-out-of-spec { background: #c94a45; } .legend-mixed { background: #8a98a4; } .legend-monte-carlo { border-top: 2px solid #123f63; } .legend-setup { border-top: 2px dashed #0b7a75; } .legend-setup-mean { border-left: 2px dashed #0b7a75; } .legend-spec { border-left: 2px dashed #a33a32; } .legend-target { border-left: 2px dashed #b17c11; } .section-heading { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; } .section-heading h2, .section-heading h3 { margin-top: 0; } .run-metadata { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; margin: 8px 0 0; } .run-metadata div { border: 1px solid #d2dbe1; padding: 6px; background: #f4f6f7; } .run-metadata dt { color: #5c6b76; font-size: 7.5pt; } .run-metadata dd { margin: 2px 0 0; color: #102a43; font-weight: 700; overflow-wrap: anywhere; } .web-report { border-top: 4px solid #0b7a75; padding-top: 10px; } .guidance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .guidance-grid article { border-left: 4px solid #71808b; padding: 9px 12px; background: #f4f5f6; } .guidance-grid article:last-child { border-left-color: #0b7a75; background: #eef5f7; } .applicability { color: #5c6b76; font-size: 8pt; } .assessment-banner { display: grid; grid-template-columns: 1fr 0.8fr; gap: 14px; align-items: center; border: 1px solid #ccd5dc; border-left: 6px solid #7b8790; padding: 10px 12px; background: #f4f5f6; margin-top: 12px; } .assessment-meets_target { border-left-color: #0b7a75; background: #edf7f4; } .assessment-below_target { border-left-color: #b6423a; background: #fbeceb; } .assessment-disclaimer { border-left: 1px solid #ccd5dc; padding-left: 13px; color: #4f606c; font-weight: 700; } footer { margin-top: 18px; border-top: 1px solid #ccd5dc; padding-top: 7px; color: #65737e; font-size: 7.5pt; }
    .engineering-inputs h4 { color: #183b56; break-after: avoid; }
    .factor-setup-wrapper { width: 100%; break-inside: avoid; page-break-inside: avoid; }
    .factor-setup-wrapper h3 { margin: var(--factor-setup-h3-margin-top) 0 var(--factor-setup-h3-margin-bottom); font-size: var(--factor-setup-h3-font-size); }
    .factor-setup-wrapper h4 { margin: var(--factor-setup-h4-margin-top) 0 var(--factor-setup-h4-margin-bottom); font-size: var(--factor-setup-h4-font-size); }
    .factor-setup-wrapper [data-factor-setup-inputs], .factor-setup-wrapper [data-factor-measurement-analysis] { margin: var(--factor-setup-table-margin) 0; font-size: var(--factor-setup-table-font-size); line-height: 1.12; }
    .factor-setup-wrapper th, .factor-setup-wrapper td { padding: var(--factor-setup-cell-y) var(--factor-setup-cell-x); border-width: var(--factor-setup-border-width); }
    .factor-setup-wrapper .metric-stack { gap: var(--factor-setup-metric-stack-gap); }
    .metric-stack, .status-stack { display: flex; flex-direction: column; gap: 1px; }
    .metric-line { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px; white-space: normal; overflow-wrap: anywhere; }
    .factor-setup-wrapper .metric-line { gap: var(--factor-setup-metric-line-gap); }
    .metric-label { color: #5c6b76; font-weight: 600; }
    .metric-value { text-align: right; font-variant-numeric: tabular-nums; }
    .status-label { display: inline-block; width: fit-content; padding: 1px 4px; border-radius: 2px; font-size: 7.2pt; font-weight: 700; white-space: nowrap; }
    .factor-setup-wrapper .metric-label, .factor-setup-wrapper .status-label { font-size: var(--factor-setup-label-font-size); }
    .status-ready { background: #dcefe9; color: #076b4b; } .status-pending { background: #edf0f3; color: #52616b; } .status-warning { background: #fff0c2; color: #7a4b00; }
    .result-dimension-chain .dimension-chain-pages { break-inside: auto; page-break-inside: auto; }
    .result-dimension-chain .dimension-chain-page { break-inside: avoid; page-break-inside: avoid; margin: 7px 0 10px; }
    .dimension-chain-continuation { margin: 0 0 3px; color: #48606f; font-size: 8pt; font-weight: 700; }
    .legend-center-target { background: #6b4f8a; }
  </style></head><body>
    <header><h1>F7 Monte Carlo Governed Result Report</h1><p class="meta"><strong>Workbook:</strong> ${escapeHtml(report.workbook.fileName)} · <strong>Worksheet:</strong> ${escapeHtml(report.workbook.worksheetName)}</p><p class="meta"><strong>Generated:</strong> ${escapeHtml(report.generatedAt)} · <strong>Classification:</strong> ${escapeHtml(report.outputClassification)}</p><span class="badge ${statusClass}">${escapeHtml(report.assessment.replaceAll("_", " "))}</span></header>
    ${renderEngineeringInputs(report)}
    ${renderResultVisuals(report, dimensionChainVisual)}
    ${renderWebReport(report)}
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
          await writeFile(htmlPath, renderF7ReportPdfHtml(request.report, request.dimensionChainVisual), "utf8");
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
