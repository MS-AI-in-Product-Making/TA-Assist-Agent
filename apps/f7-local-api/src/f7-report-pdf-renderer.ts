import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  F7_MEASUREMENT_IMPORT_MAX_FACTORS,
  type F7DistributionFitCandidate,
  type F7ReportFactor,
  type F7ReportProjection,
  type F7ToleranceDistribution,
} from "@ai-assist/contracts";
import { renderDimensionChainVisual, type DimensionChainVisual } from "./dimension-chain-visual.js";
import {
  AssumptionResultsPdfQueueFullError,
  executePdfBrowser,
  escapeHtml,
  findInstalledBrowsers,
} from "./assumption-results-pdf-renderer.js";
import { f7ReportPdfRouteRequestSchema } from "./f7-report-pdf-contract.js";

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
  render(request: F7ReportPdfRenderRequest): Promise<Buffer>;
}

export interface F7FactorDistributionAppendixEntry {
  readonly factorId: string;
  readonly factorName: string;
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
  readonly setup: {
    readonly mean: number;
    readonly standardDeviation: number;
    readonly distribution: F7ToleranceDistribution;
  };
  readonly selectedCandidate: Pick<F7DistributionFitCandidate, "family" | "parameters" | "qqPoints">;
}

export interface F7ReportPdfRenderRequest {
  readonly sessionId: string;
  readonly report: F7ReportProjection;
  readonly dimensionChainVisual?: DimensionChainVisual;
  readonly factorDistributionAppendix?: readonly F7FactorDistributionAppendixEntry[];
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

function chartCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0";
}

function formatChartTick(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  const formatted = value.toLocaleString("en-US", { maximumFractionDigits: 3, useGrouping: false });
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

function factorActualSeverity(
  metric: ComparisonMetric,
  setup: number,
  actual: number | undefined,
  normalizationFallback?: number,
): "normal" | "attention" | "critical" {
  return comparisonSeverity({
    key: metric,
    label: metric,
    metric,
    setup,
    actual,
    ...(normalizationFallback === undefined
      ? {}
      : { percentageDenominator: normalizationFallback }),
    maximumFractionDigits: 4,
  });
}

function factorMeasuredMetric(
  metric: ComparisonMetric,
  setup: number,
  measured: { readonly actual: number; readonly delta: number } | undefined,
  options: { readonly tolerance?: boolean; readonly normalizationFallback?: number } = {},
): string {
  const actual = measured?.actual;
  const formatValue = metric === "cpk"
    ? (value: number): string => formatNumber(value, 2)
    : (value: number): string => formatNumber(value);
  const actualText = actual === undefined ? "—" : formatValue(actual);
  const severity = factorActualSeverity(metric, setup, actual, options.normalizationFallback);
  const actualContent = options.tolerance
    ? `<span>±3σ <span class="actual-value-severity-${severity}">${actualText}</span></span>`
    : `<span class="actual-value-severity-${severity}">${actualText}</span>`;
  const deltaText = measured === undefined ? "—" : formatSigned(measured.delta, metric === "cpk" ? 2 : 4);
  const percentageText = measured === undefined ? "N/A" : formatComparisonDeltaPercentage(measured.delta, setup);
  return `<div class="factor-measured-comparison-metric factor-measured-comparison-metric-three-row" data-measured-comparison-metric="${metric}"><span><strong>Actual</strong>${actualContent}</span><span><strong>Δ</strong><span>${deltaText}</span></span><span class="comparison-delta-percentage"><strong></strong><span class="comparison-percentage-group actual-value-severity-${severity}">(${percentageText})</span></span></div>`;
}

function formatComparisonDeltaPercentage(delta: number, setup: number): string {
  if (setup === 0) return "N/A";
  return `${delta > 0 ? "+" : ""}${(delta / Math.abs(setup) * 100).toFixed(2)}%`;
}

function renderFactorSetup(report: F7ReportProjection): string {
  const actualContributions = new Map(
    report.simulation.factorContributions?.map((contribution) => [contribution.factorId, contribution.contribution]) ?? [],
  );
  const rows = report.factors.map((factor, index) => {
    const comparison = factor.measurementComparison;
    const rowspan = comparison === undefined ? "" : ` rowspan="2" class="factor-setup-rowspan-cell"`;
    const sourceModeClass = factor.sourceMode === "MEASURED"
      ? factor.measurementWarning ? "source-mode-warning" : "source-mode-ready"
      : "source-mode-baseline";
    const sourceMode = `<span class="status-stack"><span class="source-mode-badge ${sourceModeClass}">${sourceModeLabel(factor.sourceMode)}</span>${factor.sourceMode === "MEASURED" && factor.measurementWarning ? `<span class="status-label status-warning">Warning</span>` : ""}</span>`;
    const readiness = factor.readiness === "ready" ? "Ready" : "Pending";
    const nominalClass = factor.designNominal < 0 ? "nominal-negative" : factor.designNominal > 0 ? "nominal-positive" : "nominal-neutral";
    const setupRow = `<tr data-factor-setup-row="${escapeHtml(factor.factorId)}"><td${rowspan}>${index + 1}</td><td${rowspan}>${escapeHtml(factor.factorName)}</td><td${rowspan}>${factor.partNumber === undefined ? "Missing" : escapeHtml(factor.partNumber)}</td><td${rowspan}>${factor.dimId === undefined ? "Missing" : escapeHtml(factor.dimId)}</td><td${rowspan}><span class="${nominalClass}">${formatNumber(factor.designNominal)}</span></td><td${rowspan}>${formatNumber(factor.upperTolerance)}</td><td${rowspan}>${formatNumber(factor.lowerTolerance)}</td><td${rowspan}>${formatNumber(factor.longTermSafetyFactor)}</td><td${rowspan}>${formatNumber(factor.sigmaLevel)}</td><td>${escapeHtml(factor.setupDistribution)}</td><td>${formatNumber(factor.setupMean)}</td><td>± ${formatNumber(factor.setupTolerance)}</td><td>${formatNumber(factor.setupOneSigma)}</td><td>${formatNumber(factor.setupCpk, 2)}</td><td>${formatNumber(factor.percentContributionToSigma * 100, 2)}%</td><td${rowspan}>${sourceMode}</td><td${rowspan}>${formatNumber(factor.sampleCount, 0)}</td><td${rowspan}><span class="status-label status-${factor.readiness}">${readiness}</span></td></tr>`;
    if (comparison === undefined) return setupRow;
    const actualContribution = actualContributions.get(factor.factorId);
    const contributionSeverity = factorActualSeverity("contribution", factor.percentContributionToSigma, actualContribution);
    const contributionMetric = actualContribution === undefined
      ? ""
      : `<div class="factor-measured-comparison-metric" data-measured-comparison-metric="contribution"><span><strong>Actual</strong><span class="actual-value-severity-${contributionSeverity}">${(actualContribution * 100).toFixed(2)}%</span></span><span><strong>Δ</strong><span class="actual-value-severity-${contributionSeverity}">${formatSigned((actualContribution - factor.percentContributionToSigma) * 100, 2)}%</span></span></div>`;
    const distributionSeverity = factor.approvedDistribution.toLowerCase() === factor.setupDistribution.toLowerCase() ? "normal" : "critical";
    const measuredRow = `<tr class="factor-measured-comparison-row" data-factor-measured-comparison="${escapeHtml(factor.factorId)}"><td><div class="factor-measured-comparison-metric" data-measured-comparison-metric="distribution"><span><strong>Actual</strong><span class="actual-value-severity-${distributionSeverity}">${escapeHtml(factor.approvedDistribution.charAt(0).toUpperCase() + factor.approvedDistribution.slice(1))}</span></span></div></td><td>${factorMeasuredMetric("mean", factor.setupMean, comparison.mean, { normalizationFallback: factor.setupTolerance })}</td><td>${factorMeasuredMetric("tolerance", factor.setupTolerance, comparison.tolerance, { tolerance: true })}</td><td>${factorMeasuredMetric("oneSigma", factor.setupOneSigma, comparison.oneSigma)}</td><td>${factorMeasuredMetric("cpk", factor.setupCpk, comparison.cpk)}</td><td>${contributionMetric}</td></tr>`;
    return `${setupRow}${measuredRow}`;
  }).join("");
  return `<table data-factor-setup><thead><tr><th>Item</th><th>Factor</th><th>Part Number</th><th>DIM ID</th><th>Design Nominal</th><th>+ Tol</th><th>- Tol</th><th>Long Term/Safety Factor</th><th>σ Level</th><th>Distribution</th><th>Mean</th><th>Tolerance</th><th>1σ</th><th>Cpk</th><th>% Cont. to σ</th><th>Source Mode</th><th>Sample Count</th><th>Readiness</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderEngineeringInputs(report: F7ReportProjection): string {
  return `<section class="engineering-inputs page-break-after" data-engineering-inputs><p class="eyebrow">Governed analysis inputs</p><h2>Engineering Inputs</h2><div class="factor-setup-wrapper" style="${factorSetupDensityStyle(report.factors.length)}"><h3>Factor Setup</h3>${renderFactorSetup(report)}</div></section>`;
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
  const plotTop = 106;
  const plotBottom = 300;
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
  const referenceText = (label: string, value: number): string => `${label} ${formatChartTick(value)}`;
  const referenceLabelWidth = (text: string): number => Math.min(190, Math.max(76, text.length * 8.2 + 16));
  const referenceLabelX = (referenceX: number, text: string): number => {
    const halfWidth = referenceLabelWidth(text) / 2;
    return Math.min(plotRight - halfWidth, Math.max(plotLeft + halfWidth, referenceX));
  };
  const layoutLabelRow = (items: ReadonlyArray<{ readonly id: string; readonly x: number; readonly text: string }>): ReadonlyMap<string, number> => {
    const laidOut = [...items]
      .sort((left, right) => left.x - right.x)
      .map((item) => ({ ...item, width: referenceLabelWidth(item.text), positionedX: referenceLabelX(item.x, item.text) }));
    for (let index = 1; index < laidOut.length; index += 1) {
      const previous = laidOut[index - 1]!;
      const current = laidOut[index]!;
      current.positionedX = Math.max(current.positionedX, previous.positionedX + previous.width / 2 + current.width / 2);
    }
    for (let index = laidOut.length - 1; index >= 0; index -= 1) {
      const current = laidOut[index]!;
      const maximumX = index === laidOut.length - 1
        ? plotRight - current.width / 2
        : laidOut[index + 1]!.positionedX - laidOut[index + 1]!.width / 2 - current.width / 2;
      current.positionedX = Math.min(current.positionedX, maximumX);
    }
    return new Map(laidOut.map((item) => [item.id, item.positionedX]));
  };
  const labelPositions = new Map([
    ...layoutLabelRow(positionedReferences.filter(({ row }) => row === "top").map((reference) => ({
      id: reference.id,
      x: reference.x,
      text: referenceText(reference.label, reference.value),
    }))),
    ...layoutLabelRow(setup === undefined || setupMeanX === undefined ? [] : [{
      id: "setup-mean",
      x: setupMeanX,
      text: referenceText("Setup Mean", setup.mean),
    }]),
    ...layoutLabelRow(positionedReferences.filter(({ row }) => row === "bottom").map((reference) => ({
      id: reference.id,
      x: reference.x,
      text: referenceText(reference.label, reference.value),
    }))),
  ]);
  const referenceBadge = (id: string, label: string, value: number, referenceX: number, rowY: number, extraClass = ""): string => {
    const text = referenceText(label, value);
    const width = referenceLabelWidth(text);
    const textLength = text.length * 8.2 + 16 > 190 ? ` textLength="174" lengthAdjust="spacingAndGlyphs"` : "";
    const setupMeanTextScale = Math.max(0.01, Math.min(1, (width - 16) / (text.length * 8.2)));
    const textNode = id === "setup-mean"
      ? `<foreignObject x="${coordinate(-width / 2)}" y="0" width="${coordinate(width)}" height="22"><div class="setup-mean-label" style="transform:scaleX(${coordinate(setupMeanTextScale)})">${text}</div></foreignObject>`
      : `<text class="monte-carlo-reference-label" x="0" y="16" text-anchor="middle"${textLength}>${text}</text>`;
    return `<g class="monte-carlo-reference-badge${extraClass}" transform="translate(${coordinate(labelPositions.get(id) ?? referenceX)} ${rowY})"><rect x="${coordinate(-width / 2)}" y="0" width="${coordinate(width)}" height="22" rx="2"/>${textNode}</g>`;
  };
  const yTicks = Array.from({ length: 5 }, (_, index) => maximumCount * index / 4);
  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return finiteSum(
      finiteProduct(domainMinimum, 1 - ratio),
      finiteProduct(domainMaximum, ratio),
    );
  });

  return `<figure class="distribution-figure">
    <svg data-monte-carlo-chart viewBox="0 0 800 350" role="img" aria-labelledby="monte-carlo-chart-title monte-carlo-chart-description">
      <title id="monte-carlo-chart-title">Monte Carlo output distribution</title>
      <desc id="monte-carlo-chart-description">Observed simulation histogram with fitted distributions and governed references.</desc>
      ${yTicks.map((tick) => `<g><line class="plot-grid" x1="56" x2="780" y1="${coordinate(y(tick))}" y2="${coordinate(y(tick))}"/><text class="plot-tick-label" x="50" y="${coordinate(y(tick) + 4)}" text-anchor="end">${formatChartTick(tick)}</text></g>`).join("")}
      <line class="plot-axis" x1="56" x2="780" y1="300" y2="300"/><line class="plot-axis" x1="56" x2="56" y1="106" y2="300"/>
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
      ${positionedReferences.map((reference) => `<g data-monte-carlo-reference data-reference-id="${reference.id}" data-reference-row="${reference.row}"><line class="monte-carlo-reference reference-${reference.id}" x1="${coordinate(reference.x)}" x2="${coordinate(reference.x)}" y1="106" y2="300"/>${referenceBadge(reference.id, reference.label, reference.value, reference.x, reference.row === "top" ? 4 : 72)}</g>`).join("")}
      <path data-monte-carlo-fit class="monte-carlo-fit" d="${curvePath(expectedCounts)}"/>
      ${setup === undefined ? "" : `<path data-factor-setup-fit class="factor-setup-fit" d="${setupSamples.map((sample, index) => `${index === 0 ? "M" : "L"}${coordinate(x(sample.value))},${coordinate(y(sample.expectedCount))}`).join(" ")}"/><g data-factor-setup-mean data-reference-row="middle" class="factor-setup-mean"><line x1="${coordinate(setupMeanX ?? 0)}" x2="${coordinate(setupMeanX ?? 0)}" y1="106" y2="300"/>${referenceBadge("setup-mean", "Setup Mean", setup.mean, setupMeanX ?? 0, 38, " setup-mean-badge")}</g>`}
      ${xTicks.map((tick) => `<g><line class="plot-tick" x1="${coordinate(x(tick))}" x2="${coordinate(x(tick))}" y1="300" y2="305"/><text class="plot-tick-label" x="${coordinate(x(tick))}" y="320" text-anchor="middle">${formatChartTick(tick)}</text></g>`).join("")}
      <text class="plot-axis-label" x="418" y="342" text-anchor="middle">Simulated system output</text><text class="plot-axis-label" transform="translate(15 203) rotate(-90)" text-anchor="middle">Count</text>
    </svg>
    <figcaption class="monte-carlo-legend" data-monte-carlo-legend><span><i class="monte-carlo-in-spec-legend"></i>In specification</span><span><i class="monte-carlo-out-of-spec-legend"></i>Out of specification</span><span><i class="monte-carlo-mixed-legend"></i>Crosses specification limit</span><span><i class="monte-carlo-fit-legend"></i>Moment-fitted Normal expected count</span>${setup === undefined ? "" : `<span><i class="factor-setup-fit-legend"></i>Factor Setup TA Normal expected count</span><span><i class="factor-setup-mean-legend"></i>Setup Mean</span>`}<span><i class="monte-carlo-spec-legend"></i>Specification limits</span><span><i class="monte-carlo-center-target-legend"></i>Target (specification midpoint)</span><span><i class="monte-carlo-target-legend"></i>Target sigma range</span></figcaption>
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

type ComparisonFormat = "dpm" | "percent";
type ComparisonMetric = "mean" | "tolerance" | "oneSigma" | "cp" | "cpk" | "contribution";

interface PdfComparisonRow {
  readonly key: string;
  readonly label: string;
  readonly metric: ComparisonMetric;
  readonly setup: number;
  readonly actual: number | undefined;
  readonly format?: ComparisonFormat;
  readonly percentageDenominator?: number;
  readonly maximumFractionDigits: number;
}

function formatPercent(value: number, maximumFractionDigits = 2): string {
  const percentage = value * 100;
  const distanceFromHundred = (1 - value) * 100;
  if (value < 1 && distanceFromHundred > 0 && distanceFromHundred < 0.000001) {
    return `100% - ${formatScientific(distanceFromHundred)}%`;
  }
  return `${formatNumber(percentage, maximumFractionDigits)}%`;
}

function formatSigned(value: number, maximumFractionDigits = 6): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${formatNumber(value, maximumFractionDigits)}`;
}

function formatMetricValue(value: number | undefined, format: ComparisonFormat | undefined, maximumFractionDigits: number): string {
  if (value === undefined) return "—";
  if (format === "dpm") return `${Math.round(value).toLocaleString("en-US")} DPM`;
  if (format === "percent") return formatPercent(value, maximumFractionDigits);
  return formatNumber(value, maximumFractionDigits);
}

function formatDifference(row: PdfComparisonRow, delta: number): string {
  const denominator = Math.abs(row.percentageDenominator ?? row.setup);
  const relative = denominator === 0 ? "N/A" : `${formatSigned(delta / denominator * 100, 2)}%`;
  const formattedDelta = row.format === "dpm"
    ? `${delta > 0 ? "+" : ""}${Math.round(delta).toLocaleString("en-US")}`
    : formatSigned(delta, row.maximumFractionDigits);
  return `${formattedDelta} (${relative})`;
}

function comparisonSeverity(row: PdfComparisonRow): "normal" | "attention" | "critical" {
  if (row.actual === undefined) return "normal";
  const adverseDifference = row.metric === "mean"
    ? Math.abs(Math.abs(row.actual) - Math.abs(row.setup))
    : row.metric === "cp" || row.metric === "cpk"
      ? Math.max(0, row.setup - row.actual)
      : Math.max(0, row.actual - row.setup);
  if (adverseDifference === 0) return "normal";
  const setupMagnitude = Math.abs(row.setup);
  const fallbackMagnitude = row.metric === "mean" ? Math.abs(row.percentageDenominator ?? 0) : 0;
  const denominator = setupMagnitude > 0 ? setupMagnitude : fallbackMagnitude > 0 ? fallbackMagnitude : undefined;
  if (denominator === undefined) return "critical";
  const percentage = adverseDifference / denominator * 100;
  return percentage <= 5 ? "normal" : percentage <= 15 ? "attention" : "critical";
}

function reportComparisonRows(report: F7ReportProjection): readonly PdfComparisonRow[] {
  if (report.analysis?.status !== "available") return [];
  const comparison = report.analysis.comparison;
  const { lowerSpecLimit, upperSpecLimit } = report.summary;
  const setupCpl = (comparison.setup.mean - lowerSpecLimit) / (3 * comparison.setup.standardDeviation);
  const setupCpu = (upperSpecLimit - comparison.setup.mean) / (3 * comparison.setup.standardDeviation);
  const setupLowerDpm = standardNormalCdf(-setupCpl * 3) * 1_000_000;
  const setupUpperDpm = standardNormalCdf(-setupCpu * 3) * 1_000_000;
  const setupTotalDpm = setupLowerDpm + setupUpperDpm;
  const capability = report.simulation.capability;
  const normalModel = report.simulation.normalModel;
  return [
    { key: "mean", label: "Mean", metric: "mean", setup: comparison.setup.mean, actual: comparison.monteCarlo.mean, percentageDenominator: upperSpecLimit - lowerSpecLimit, maximumFractionDigits: 3 },
    { key: "standardDeviation", label: "Standard deviation", metric: "oneSigma", setup: comparison.setup.standardDeviation, actual: comparison.monteCarlo.standardDeviation, maximumFractionDigits: 3 },
    { key: "cp", label: "Cp", metric: "cp", setup: comparison.setup.cp, actual: comparison.monteCarlo.cp, maximumFractionDigits: 3 },
    { key: "cpk", label: "Cpk", metric: "cpk", setup: comparison.setup.cpk, actual: comparison.monteCarlo.cpk, maximumFractionDigits: 3 },
    { key: "cpl", label: "CPL", metric: "cpk", setup: setupCpl, actual: capability.status === "available" ? capability.lowerCpk : undefined, maximumFractionDigits: 3 },
    { key: "cpu", label: "CPU", metric: "cpk", setup: setupCpu, actual: capability.status === "available" ? capability.upperCpk : undefined, maximumFractionDigits: 3 },
    { key: "lowerDpm", label: "Lower DPM", metric: "tolerance", setup: setupLowerDpm, actual: normalModel.status === "available" ? normalModel.lowerTailDpm : undefined, format: "dpm", maximumFractionDigits: 0 },
    { key: "upperDpm", label: "Upper DPM", metric: "tolerance", setup: setupUpperDpm, actual: normalModel.status === "available" ? normalModel.upperTailDpm : undefined, format: "dpm", maximumFractionDigits: 0 },
    { key: "totalDpm", label: "Total DPM", metric: "tolerance", setup: setupTotalDpm, actual: normalModel.status === "available" ? normalModel.totalDpm : undefined, format: "dpm", maximumFractionDigits: 0 },
    { key: "outOfSpec", label: "% Out of Spec", metric: "tolerance", setup: setupTotalDpm / 1_000_000, actual: report.simulation.outOfSpecProbability, format: "percent", maximumFractionDigits: 2 },
  ];
}

function renderComparisonTable(report: F7ReportProjection): string {
  const rows = reportComparisonRows(report).map((row) => {
    const delta = row.actual === undefined ? undefined : row.actual - row.setup;
    return `<tr data-report-metric="${row.key}"><th>${row.label}</th><td>${formatMetricValue(row.setup, row.format, row.maximumFractionDigits)}</td><td>${formatMetricValue(row.actual, row.format, row.maximumFractionDigits)}</td><td class="report-difference actual-value-severity-${comparisonSeverity(row)}">${delta === undefined ? "—" : formatDifference(row, delta)}</td></tr>`;
  }).join("");
  return `<table data-report-ta-comparison><caption>Factor Setup assumption and measured-data Monte Carlo comparison</caption><thead><tr><th>TA parameter</th><th>Factor Setup assumption</th><th>Measured-data Monte Carlo</th><th>Difference</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderRecommendedActions(report: F7ReportProjection): string {
  const analysis = report.analysis;
  if (analysis?.status !== "available") return "";
  const { mean, standardDeviation, lowerSpecLimit, upperSpecLimit, targetCpk } = report.summary;
  const targetMean = (lowerSpecLimit + upperSpecLimit) / 2;
  const meanAdjustment = targetMean - mean;
  const nearestClearance = Math.min(mean - lowerSpecLimit, upperSpecLimit - mean);
  const maximumStandardDeviation = nearestClearance / (3 * targetCpk);
  const standardDeviationReduction = Math.max(0, standardDeviation - maximumStandardDeviation);
  const reductionPercentage = standardDeviation > 0 ? standardDeviationReduction / standardDeviation * 100 : 0;
  const requiredHalfRange = 3 * targetCpk * standardDeviation;
  const actions = analysis.optimizationDirections.map((title) => {
    const normalized = title.toLowerCase();
    const metrics = normalized.includes("center") && normalized.includes("mean")
      ? [["Current mean", formatNumber(mean, 3)], ["Target mean", formatNumber(targetMean, 3)], ["Required adjustment", formatSigned(meanAdjustment, 3)]]
      : normalized.includes("variation")
        ? [["Current σ", formatNumber(standardDeviation, 3)], ["Maximum σ", formatNumber(maximumStandardDeviation, 3)], ["Required reduction", `${formatNumber(standardDeviationReduction, 3)} (${formatNumber(reductionPercentage, 2)}%)`]]
        : normalized.includes("specification")
          ? [["Current limits", `${formatNumber(lowerSpecLimit, 3)} / ${formatNumber(upperSpecLimit, 3)}`], ["Required LSL", `≤ ${formatNumber(mean - requiredHalfRange, 3)}`], ["Required USL", `≥ ${formatNumber(mean + requiredHalfRange, 3)}`]]
          : [];
    return `<li><strong>${escapeHtml(title)}</strong>${metrics.length === 0 ? "" : `<dl class="action-metrics">${metrics.map(([label, value]) => `<div><dt>${escapeHtml(label!)}</dt><dd>${escapeHtml(value!)}</dd></div>`).join("")}</dl>`}</li>`;
  }).join("");
  return `<div class="embedded-actions" data-report-recommended-actions><h4>Recommended Actions</h4><ol class="action-list">${actions}</ol></div>`;
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
  const content = assessmentContent(report);
  const setupComparison = report.analysis?.status === "available" ? report.analysis.comparison : undefined;
  const meanWarning = setupComparison !== undefined
    && Math.abs(setupComparison.monteCarlo.mean - setupComparison.setup.mean) >= 0.5e-4;
  const decisionDetails = report.simulation.capability.status === "available"
    ? [
      ...(meanWarning && setupComparison !== undefined
        ? [`Mean ${formatNumber(setupComparison.monteCarlo.mean, 3)} differs from Factor Setup Mean ${formatNumber(setupComparison.setup.mean, 3)}.`]
        : []),
      `Cpk ${formatNumber(report.simulation.capability.cpk, 3)} ${report.simulation.capability.targetStatus === "meets_target" ? "meets" : "is below"} the target Cpk ${formatNumber(report.simulation.capability.targetCpk, 3)}.`,
    ]
    : ["Variation evidence is insufficient for a capability decision."];
  const decisionStatus = report.simulation.capability.status === "available"
    ? report.simulation.capability.targetStatus === "below_target" || meanWarning ? "below-target" : "meets-target"
    : "not-evaluable";
  return `<section class="result-visuals" data-result-visuals>
    <section class="monte-carlo-decision decision-${decisionStatus}"><div><p class="eyebrow">Governed result</p><h2>${content.title === "Meets target" ? "Target met" : content.title === "Below target" ? "Attention required" : content.title}</h2></div><div class="monte-carlo-decision-details">${decisionDetails.map((detail) => `<p>${detail}</p>`).join("")}</div></section>
    <dl class="monte-carlo-kpis"><div><dt>Yield</dt><dd>${formatNumber(report.simulation.yield * 100, 2)}%</dd><span>${formatNumber(report.simulation.ppm, 0)} PPM out of spec</span></div><div><dt>Cpk</dt><dd>${report.summary.cpk === undefined ? "—" : formatNumber(report.summary.cpk, 3)}</dd><span>Target ${formatNumber(report.summary.targetCpk, 3)}</span></div><div><dt>Mean</dt><dd>${formatNumber(report.simulation.mean, 3)}</dd><span>Simulated output center</span></div><div><dt>Std Dev</dt><dd>${formatNumber(report.simulation.standardDeviation, 3)}</dd><span>Measured output spread</span></div></dl>
    <div class="distribution-section-heading"><div><p class="eyebrow">Output distribution</p><h2>Monte Carlo response</h2></div><span>${report.simulation.iterations.toLocaleString("en-US")} iterations</span></div>
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
    return `<section class="web-report page-break"><p class="eyebrow">Governed engineering report</p><h2>Engineering Analysis</h2>${reportContext}<section class="assessment-banner assessment-not_evaluable" data-report-analysis-unavailable><div><p class="assessment-label">F0 analysis unavailable</p><h3>Complete governed evidence</h3><p>${reason}</p>${analysis?.optimizationDirections.length ? unorderedList(analysis.optimizationDirections, "") : ""}</div></section>${renderAssessment(report)}</section>`;
  }

  const measuredContributionByFactorId = new Map(
    report.simulation.factorContributions?.map((contribution) => [contribution.factorId, contribution.contribution]) ?? [],
  );
  const contributors = report.factors
    .map((factor) => ({ factor, measuredContribution: measuredContributionByFactorId.get(factor.factorId) }))
    .sort((left, right) => (
      right.measuredContribution ?? right.factor.percentContributionToSigma
    ) - (
      left.measuredContribution ?? left.factor.percentContributionToSigma
    ))
    .slice(0, 5);
  return `<section class="web-report page-break"><p class="eyebrow">Governed engineering report</p><h2>Engineering Analysis</h2>${reportContext}
    <section class="executive-summary"><div class="report-decision report-decision-${analysis.narrative.resultJudgment.status}"><p class="eyebrow">Executive Summary</p><h3>${escapeHtml(analysis.narrative.resultJudgment.headline)}</h3><p>${escapeHtml(analysis.narrative.resultJudgment.judgment)}</p></div><p>${escapeHtml(analysis.narrative.engineeringSummary)}</p></section>
    <section class="report-section"><div class="section-heading"><div><p class="eyebrow">Assumption vs measured evidence</p><h3>Factor Setup vs Monte Carlo TA</h3></div><p>${escapeHtml(analysis.targetAssessment)}</p></div>${renderComparisonTable(report)}</section>
    <section class="report-insight-grid"><article class="report-section"><div class="section-heading"><div><p class="eyebrow">Variation ownership</p><h3>Top Contributors</h3></div></div><ol class="contributor-list">${contributors.map(({ factor, measuredContribution }, index) => `<li><div class="contributor-heading"><span class="contributor-index">${index + 1}.</span><strong class="contributor-name">${escapeHtml(factor.factorName)}</strong></div><div class="contributor-series" data-contributor-series="measured"><span>Measured</span><span class="contributor-track contributor-track-measured"><span style="width:${(measuredContribution ?? 0) * 100}%"></span></span><span class="contributor-series-value">${measuredContribution === undefined ? "—" : formatPercent(measuredContribution)}</span></div><div class="contributor-series" data-contributor-series="setup"><span>Factor Setup</span><span class="contributor-track contributor-track-setup"><span style="width:${factor.percentContributionToSigma * 100}%"></span></span><span class="contributor-series-value">${formatPercent(factor.percentContributionToSigma)}</span></div></li>`).join("")}</ol></article>
    <article class="report-section"><div class="section-heading"><div><p class="eyebrow">Decision context · F0 ${escapeHtml(analysis.provenance.knowledgeBaseVersion)} / ${escapeHtml(analysis.provenance.ruleId)}</p><h3>Engineering Risks &amp; Recommended Actions</h3></div><span class="status-chip ${report.assessment === "MEETS_TARGET" ? "chip-success" : "chip-blocked"}">${assessmentContent(report).title}</span></div><p class="risk-lead">${escapeHtml(analysis.narrative.engineeringRisk)}</p>${unorderedList(analysis.interpretations, "No governed interpretations were identified.")}${renderRecommendedActions(report)}</article></section>
    ${renderAssessment(report)}
  </section>`;
}

function fittedDensity(candidate: F7FactorDistributionAppendixEntry["selectedCandidate"], value: number): number {
  const parameters = candidate.parameters;
  let density = 0;
  if (candidate.family === "normal") {
    const standardDeviation = parameters.standardDeviation!;
    const z = (value - parameters.mean!) / standardDeviation;
    density = Math.exp(-0.5 * z * z) / (standardDeviation * Math.sqrt(2 * Math.PI));
  } else if (candidate.family === "lognormal" && value > 0) {
    const z = (Math.log(value) - parameters.logMean!) / parameters.logStandardDeviation!;
    density = Math.exp(-0.5 * z * z) / (value * parameters.logStandardDeviation! * Math.sqrt(2 * Math.PI));
  } else if (candidate.family === "weibull" && value >= 0) {
    const ratio = value / parameters.scale!;
    density = parameters.shape! / parameters.scale! * ratio ** (parameters.shape! - 1) * Math.exp(-(ratio ** parameters.shape!));
  } else if (candidate.family === "gamma" && value > 0) {
    const shape = parameters.shape!;
    const scale = parameters.scale!;
    const gamma = shape === 1 ? 1 : Math.sqrt(2 * Math.PI / shape) * (shape / Math.E) ** shape;
    density = value ** (shape - 1) * Math.exp(-value / scale) / (gamma * scale ** shape);
  } else if (candidate.family === "uniform") {
    density = value >= parameters.minimum! && value <= parameters.maximum!
      ? 1 / (parameters.maximum! - parameters.minimum!)
      : 0;
  }
  return Number.isFinite(density) && density >= 0 ? density : 0;
}

function setupDensity(entry: F7FactorDistributionAppendixEntry, value: number): number {
  const { mean, standardDeviation, distribution } = entry.setup;
  if (!(standardDeviation > 0)) return 0;
  const distance = Math.abs(value - mean);
  if (distribution === "Normal") return Math.exp(-0.5 * (distance / standardDeviation) ** 2) / (standardDeviation * Math.sqrt(2 * Math.PI));
  const radius = distribution === "Uniform" ? standardDeviation * Math.sqrt(3)
    : distribution === "Triangular" ? standardDeviation * Math.sqrt(6)
      : distribution === "Trapezoidal" ? standardDeviation * Math.sqrt(6 / 1.25)
        : distribution === "Elliptical" ? 2 * standardDeviation
          : standardDeviation * Math.sqrt(5);
  if (distance > radius) return 0;
  if (distribution === "Uniform") return 1 / (2 * radius);
  if (distribution === "Triangular") return (radius - distance) / radius ** 2;
  if (distribution === "Trapezoidal") {
    const plateauRadius = radius / 2;
    const height = 1 / (radius + plateauRadius);
    return distance <= plateauRadius ? height : height * (radius - distance) / (radius - plateauRadius);
  }
  if (distribution === "Elliptical") return 2 * Math.sqrt(Math.max(0, 1 - (distance / radius) ** 2)) / (Math.PI * radius);
  return 3 * (1 - (distance / radius) ** 2) / (4 * radius);
}

function renderFactorDistributionChart(entry: F7FactorDistributionAppendixEntry, index: number): string {
  const observed = entry.selectedCandidate.qqPoints.map((point) => point.observed);
  const observedMinimum = Math.min(...observed);
  const observedMaximum = Math.max(...observed);
  const setupRadius = entry.setup.standardDeviation * 4;
  const minimum = Math.min(observedMinimum, entry.lowerSpecLimit, entry.setup.mean - setupRadius);
  const maximum = Math.max(observedMaximum, entry.upperSpecLimit, entry.setup.mean + setupRadius);
  const range = maximum > minimum ? maximum - minimum : Math.max(1, Math.abs(minimum) * 0.1);
  const domainMinimum = minimum - range * 0.05;
  const domainMaximum = maximum + range * 0.05;
  const binCount = Math.max(1, Math.min(32, Math.ceil(Math.log2(observed.length) + 1)));
  const binWidth = Math.max((observedMaximum - observedMinimum) / binCount, range / binCount);
  const counts = Array.from({ length: binCount }, () => 0);
  for (const value of observed) {
    const binIndex = Math.min(binCount - 1, Math.max(0, Math.floor((value - observedMinimum) / Math.max(observedMaximum - observedMinimum, 1) * binCount)));
    counts[binIndex] = counts[binIndex]! + 1;
  }
  const selected = Array.from({ length: 80 }, (_, pointIndex) => {
    const value = domainMinimum + (domainMaximum - domainMinimum) * pointIndex / 79;
    return { value, count: fittedDensity(entry.selectedCandidate, value) * observed.length * binWidth };
  });
  const setup = Array.from({ length: 80 }, (_, pointIndex) => {
    const value = domainMinimum + (domainMaximum - domainMinimum) * pointIndex / 79;
    return { value, count: setupDensity(entry, value) * observed.length * binWidth };
  });
  const maximumCount = Math.max(1, ...counts, ...selected.map((point) => point.count), ...setup.map((point) => point.count));
  const x = (value: number): number => 56 + (value - domainMinimum) / (domainMaximum - domainMinimum) * 724;
  const y = (value: number): number => 278 - value / maximumCount * 196;
  const path = (points: readonly { readonly value: number; readonly count: number }[]): string => points
    .map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"}${chartCoordinate(x(point.value))},${chartCoordinate(y(point.count))}`)
    .join(" ");
  const reference = (id: string, value: number): string => `<g data-factor-distribution-reference data-reference-id="${id}"><line x1="${chartCoordinate(x(value))}" x2="${chartCoordinate(x(value))}" y1="72" y2="278"/></g>`;
  return `<figure class="factor-distribution-figure" data-factor-distribution-chart><svg viewBox="0 0 800 320" role="img" aria-labelledby="factor-distribution-title-${index}"><title id="factor-distribution-title-${index}">${escapeHtml(entry.factorName)} distribution</title><line class="plot-axis" x1="56" x2="780" y1="278" y2="278"/>${counts.map((count, binIndex) => { const left = observedMinimum + (observedMaximum - observedMinimum) * binIndex / binCount; const right = observedMinimum + (observedMaximum - observedMinimum) * (binIndex + 1) / binCount; return `<rect data-factor-distribution-bin x="${chartCoordinate(x(left))}" y="${chartCoordinate(y(count))}" width="${chartCoordinate(Math.max(1, x(right) - x(left) - 1))}" height="${chartCoordinate(278 - y(count))}"/>`; }).join("")}${reference("lower-spec-limit", entry.lowerSpecLimit)}${reference("upper-spec-limit", entry.upperSpecLimit)}<path data-selected-distribution-fit d="${path(selected)}"/><path data-factor-setup-distribution-fit d="${path(setup)}"/></svg><figcaption>Histogram · selected ${escapeHtml(entry.selectedCandidate.family)} fit · Factor Setup ${escapeHtml(entry.setup.distribution)} · specification limits</figcaption></figure>`;
}

function renderFactorDistributionAppendix(entries: readonly F7FactorDistributionAppendixEntry[] | undefined): string {
  if (!entries?.length) return "";
  return `<section class="factor-distribution-appendix page-break" data-factor-distribution-appendix><p class="eyebrow">Factor distribution references</p><h2>Appendix</h2>${entries.map((entry, index) => `<section class="factor-distribution-appendix-item"><p class="eyebrow">Factor ${index + 1}</p><h3>${escapeHtml(entry.factorName)}</h3>${renderFactorDistributionChart(entry, index)}</section>`).join("")}</section>`;
}

export function renderF7ReportPdfHtml(report: F7ReportProjection, dimensionChainVisual?: DimensionChainVisual, factorDistributionAppendix?: readonly F7FactorDistributionAppendixEntry[]): string {
  const statusClass = report.assessment === "MEETS_TARGET" ? "pass" : report.assessment === "BELOW_TARGET" ? "review" : "not-evaluable";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>F7 Monte Carlo Governed Result Report</title><style>
    .monte-carlo-decision, .executive-summary { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: 8mm; align-items: center; padding: 8px 12px; border: 1px solid #d8dde3; border-left: 5px solid #b46318; background: #fff8ed; }
    .monte-carlo-decision.decision-below-target { border-left-color: #b46318; background: #fff8ed; }
    .monte-carlo-decision.decision-meets-target { border-left-color: #0b7a75; background: #edf7f4; }
    .monte-carlo-decision.decision-not-evaluable { border-left-color: #6f7b83; background: #f4f5f6; }
    .monte-carlo-decision h2, .executive-summary h3 { margin: 2px 0; }
    .monte-carlo-decision-details { display: grid; gap: 3px; }
    .monte-carlo-decision-details p { margin: 0; color: #364b5a; }
    .monte-carlo-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4mm; margin: 6mm 0; }
    .monte-carlo-kpis > div { padding: 8px 10px; border: 1px solid #d8dde3; border-top: 3px solid #c65d1e; background: #fff; }
    .monte-carlo-kpis dt, .monte-carlo-kpis span { color: #5c6b76; font-size: 7.5pt; }
    .monte-carlo-kpis dt { font-weight: 700; text-transform: uppercase; }
    .monte-carlo-kpis dd { margin: 2px 0; color: #102a43; font-size: 15pt; font-weight: 700; }
    .distribution-section-heading, .section-heading { display: flex; justify-content: space-between; gap: 6mm; align-items: end; }
    .report-section { margin-top: 6mm; }
    .report-insight-grid { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 6mm; align-items: start; }
    [data-report-ta-comparison] { table-layout: fixed; }
    [data-report-ta-comparison] th, [data-report-ta-comparison] td { padding: 4px 6px; }
    [data-report-ta-comparison] th:first-child { width: 25%; }
    .report-difference { background: #fff; font-weight: 700; font-variant-numeric: tabular-nums; }
    .actual-value-severity-normal { color: #182b3a; }
    .actual-value-severity-attention { color: #986000; }
    .actual-value-severity-critical { color: #a33a32; }
    .contributor-list, .action-list { margin: 5px 0 0; padding-left: 0; list-style: none; }
    .contributor-list li { margin-bottom: 6px; }
    .contributor-heading { display: flex; gap: 4px; align-items: baseline; margin-bottom: 3px; }
    .contributor-index { min-width: 12px; color: #536675; font-weight: 700; }
    .contributor-series + .contributor-series { margin-top: 2px; }
    .contributor-series { display: grid; grid-template-columns: 48px minmax(0, 1fr) minmax(36px, max-content); margin-left: 16px; gap: 5px; align-items: center; color: #536675; font-size: 7.5px; font-weight: 700; }
    .contributor-series-value { color: #102a43; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
    .contributor-track { display: block; height: 4px; overflow: hidden; background: #dce3e7; }
    .contributor-track > span { display: block; height: 100%; background: #d65f14; }
    .contributor-track-setup > span { background: #0b7a75; }
    .risk-lead { padding: 7px 9px; border-left: 4px solid #c47720; background: #fff7e8; font-weight: 600; }
    .embedded-actions h4 { margin: 7px 0 3px; color: #183b56; }
    .action-list > li { margin-bottom: 7px; }
    .action-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; margin: 4px 0 0; }
    .action-metrics > div { padding: 4px 5px; background: #f3f6f7; }
    .action-metrics dt { color: #5c6b76; font-size: 7pt; }
    .action-metrics dd { margin: 1px 0 0; font-weight: 700; font-variant-numeric: tabular-nums; }
    .dimension-chain-svg { width: 100%; height: auto; max-height: none; }
    .dimension-chain-visual, .dimension-chain-visual-empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 105mm; margin: 7px 0 10px; overflow: hidden; }
    .dimension-chain-visual img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; }
    .result-dimension-chain .dimension-chain-visual { align-items: flex-start; }
    .result-dimension-chain .dimension-chain-visual img { object-position: center top; }
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
    [data-monte-carlo-chart] .monte-carlo-bin-in-spec { fill: #3578b8; }
    [data-monte-carlo-chart] .monte-carlo-bin-out-of-spec { fill: #c94444; }
    [data-monte-carlo-chart] .monte-carlo-bin-mixed { fill: #6f7b83; }
    [data-monte-carlo-chart] .monte-carlo-fit { fill: none; stroke: #182b3a; stroke-width: 2.5; }
    [data-monte-carlo-chart] .factor-setup-fit { fill: none; stroke: #c65d1e; stroke-width: 2.5; stroke-dasharray: 8 5; }
    [data-monte-carlo-reference] { --monte-carlo-reference-color: #182b3a; }
    [data-reference-id="lower-spec-limit"], [data-reference-id="upper-spec-limit"] { --monte-carlo-reference-color: #a33a32; }
    [data-reference-id="target"] { --monte-carlo-reference-color: #3578b8; }
    [data-reference-id="minus-target-sigma"], [data-reference-id="plus-target-sigma"] { --monte-carlo-reference-color: #0b7a75; }
    [data-monte-carlo-chart] .monte-carlo-reference { stroke: var(--monte-carlo-reference-color); stroke-width: 1.5; stroke-dasharray: 5 4; }
    [data-monte-carlo-chart] .reference-mean { stroke-dasharray: none; }
    [data-monte-carlo-chart] .reference-target { stroke-dasharray: none; stroke-width: 2; }
    [data-monte-carlo-chart] .factor-setup-mean { --monte-carlo-reference-color: #c65d1e; }
    [data-monte-carlo-chart] .factor-setup-mean line { stroke: var(--monte-carlo-reference-color); stroke-width: 2; stroke-dasharray: none; }
    [data-monte-carlo-chart] .monte-carlo-reference-badge rect { fill: #f7f9fb; stroke: var(--monte-carlo-reference-color); stroke-width: 1; }
    [data-monte-carlo-chart] .factor-setup-mean .setup-mean-badge rect { fill: #fff7ef; stroke: #e1a678; }
    [data-monte-carlo-chart] .monte-carlo-reference-label { fill: var(--monte-carlo-reference-color); font: 700 13px "Segoe UI", sans-serif; font-variant-numeric: tabular-nums; }
    [data-monte-carlo-chart] .setup-mean-label { display: flex; align-items: center; justify-content: center; width: 100%; height: 22px; overflow: hidden; color: #c65d1e; font: 700 13px "Segoe UI", sans-serif; font-variant-numeric: tabular-nums; transform-origin: center; white-space: nowrap; }
    .monte-carlo-legend { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 6px; color: #4e606c; font-size: 7.5pt; }
    .monte-carlo-legend span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
    .monte-carlo-legend i { display: inline-block; width: 15px; height: 3px; background: #182b3a; }
    .monte-carlo-legend .monte-carlo-in-spec-legend, .monte-carlo-legend .monte-carlo-out-of-spec-legend, .monte-carlo-legend .monte-carlo-mixed-legend { height: 7px; }
    .monte-carlo-in-spec-legend, .monte-carlo-center-target-legend { background: #3578b8 !important; }
    .monte-carlo-out-of-spec-legend { background: #c94444 !important; }
    .monte-carlo-mixed-legend { background: #6f7b83 !important; }
    .monte-carlo-spec-legend { background: #a33a32 !important; }
    .monte-carlo-target-legend { background: #0b7a75 !important; }
    .factor-setup-fit-legend { height: 2px !important; background: repeating-linear-gradient(90deg, #c65d1e 0 7px, transparent 7px 11px) !important; }
    .factor-setup-mean-legend { background: #c65d1e !important; }
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
    .status-ready { background: #0d7a69; color: #fff; } .status-pending { background: #5f6d80; color: #fff; } .status-warning { background: #fff0c2; color: #7a4b00; }
    .source-mode-badge { display: inline-block; padding: 2px 6px; border: 1px solid #5f6d80; border-radius: 4px; background: #fff; color: #16253d; white-space: nowrap; }
    .source-mode-ready { border-color: #0d7a69; background: #f0f7f5; color: #0d6a5c; }
    .source-mode-warning { border-color: #b54708; background: #fff8e8; color: #694600; }
    .source-mode-baseline { border-color: #5f6d80; background: #fff; color: #16253d; }
    .nominal-negative { color: #1f62a6; font-weight: 700; }
    .nominal-positive { color: #168447; font-weight: 700; }
    .nominal-neutral { color: #182b3a; font-weight: 700; }
    .factor-setup-wrapper [data-factor-setup] { table-layout: fixed; margin: var(--factor-setup-table-margin) 0; font-size: min(5.2pt, var(--factor-setup-table-font-size)); line-height: 1.12; }
    [data-factor-setup] th, [data-factor-setup] td { padding: 2px 3px; text-align: center; vertical-align: middle; }
    [data-factor-setup] th:nth-child(2) { width: 11%; } [data-factor-setup] th:nth-child(3) { width: 8%; }
    [data-factor-setup] th:nth-child(n+10):nth-child(-n+15) { width: 7%; } [data-factor-setup] th:nth-child(16) { width: 8%; }
    .factor-setup-rowspan-cell { background: #fafbfc; }
    .factor-measured-comparison-row td { background: #f3f6f7; }
    .factor-measured-comparison-metric { display: grid; grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 1px; white-space: normal; overflow-wrap: anywhere; text-align: left; }
    .factor-measured-comparison-metric-three-row { grid-template-rows: repeat(3, minmax(0, 1fr)); }
    .factor-measured-comparison-metric > span { display: grid; grid-template-columns: minmax(18px, auto) minmax(0, 1fr); gap: 3px; align-items: center; font-variant-numeric: tabular-nums; }
    .comparison-percentage-group { white-space: nowrap; }
    .factor-measured-comparison-metric strong { font-size: var(--factor-setup-label-font-size); }
    .result-dimension-chain .dimension-chain-pages { break-inside: auto; page-break-inside: auto; }
    .result-dimension-chain .dimension-chain-page { break-inside: avoid; page-break-inside: avoid; margin: 7px 0 10px; }
    .dimension-chain-continuation { margin: 0 0 3px; color: #48606f; font-size: 8pt; font-weight: 700; }
    .legend-center-target { background: #6b4f8a; }
    .factor-distribution-appendix-item { break-before: page; break-inside: avoid; }
    .factor-distribution-appendix-item:first-of-type { break-before: auto; }
    .factor-distribution-figure { margin: 8px 0 0; }
    .factor-distribution-figure svg { display: block; width: 100%; height: auto; }
    [data-factor-distribution-bin] { fill: #9fb5c2; stroke: #fff; stroke-width: 1; }
    [data-selected-distribution-fit] { fill: none; stroke: #0b7a75; stroke-width: 3; }
    [data-factor-setup-distribution-fit] { fill: none; stroke: #c47720; stroke-width: 2; stroke-dasharray: 8 5; }
    [data-factor-distribution-reference] line { stroke: #a33a32; stroke-width: 1.5; stroke-dasharray: 4 3; }
  </style></head><body>
    <header><h1>F7 Monte Carlo Governed Result Report</h1><p class="meta"><strong>Workbook:</strong> ${escapeHtml(report.workbook.fileName)} · <strong>Worksheet:</strong> ${escapeHtml(report.workbook.worksheetName)}</p><p class="meta"><strong>Generated:</strong> ${escapeHtml(report.generatedAt)} · <strong>Classification:</strong> ${escapeHtml(report.outputClassification)}</p><span class="badge ${statusClass}">${escapeHtml(report.assessment.replaceAll("_", " "))}</span></header>
    ${renderEngineeringInputs(report)}
    ${renderResultVisuals(report, dimensionChainVisual)}
    ${renderWebReport(report)}
    ${renderFactorDistributionAppendix(factorDistributionAppendix)}
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
      const { factorDistributionAppendix, ...publicRequest } = rawRequest;
      const routeRequest = f7ReportPdfRouteRequestSchema.parse(publicRequest);
      const request: F7ReportPdfRenderRequest = {
        sessionId: routeRequest.sessionId,
        report: routeRequest.report,
        ...(routeRequest.dimensionChainVisual === undefined
          ? {}
          : { dimensionChainVisual: routeRequest.dimensionChainVisual }),
        ...(factorDistributionAppendix === undefined ? {} : { factorDistributionAppendix }),
      };
      await acquireRenderSlot();
      try {
        const directory = await mkdtemp(join(tmpdir(), "f7-report-pdf-"));
        const htmlPath = join(directory, "report.html");
        const pdfPath = join(directory, "report.pdf");
        let hasPrimaryError = false;
        let primaryError: unknown;
        let renderedPdf: Buffer | undefined;

        try {
          await writeFile(htmlPath, renderF7ReportPdfHtml(request.report, request.dimensionChainVisual, request.factorDistributionAppendix), "utf8");
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
