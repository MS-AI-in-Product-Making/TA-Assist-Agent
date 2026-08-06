import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  createTypedError,
  worksheetAnalysisAssetsRequestSchema,
  worksheetAnalysisAssetsResultSchema,
  worksheetImageReadRequestSchema,
  worksheetImageReadResultSchema,
  type WorksheetAnalysisAssetsResult,
  type WorksheetImageReadResult,
} from "@ai-assist/contracts";
import { unzipSync } from "fflate";
import { resolveFactorHeaderCluster, type FactorFieldName } from "./factor-header-resolver.js";
import { readOoxmlWorkbook, type OoxmlCell, type OoxmlWorksheet } from "./ooxml-reader.js";

const REQUEST_SUMMARY = "Worksheet-analysis assets request is invalid.";
const POLICY_SUMMARY = "Worksheet-analysis assets input is not permitted.";
const ARCHIVE_SUMMARY = "Worksheet-analysis assets archive cannot be processed.";
const CELL_REFERENCE = /^([A-Z]+)([1-9]\d*)$/;

const HEADER_ALIASES = {
  upperSpecificationLimit: ["usl", "upper spec limit"],
  lowerSpecificationLimit: ["lsl", "lower spec limit"],
  unit: ["unit"],
  partNumber: ["part number", "part no", "part no.", "pn"],
  assumption: ["assumption"],
  contribution: ["contribution"],
  sensitivity: ["sensitivity"],
  cpk: ["cpk"],
  assemblyDirection: ["assembly direction"],
} as const;
const IMAGE_MEDIA_TYPE = /^(?:image\/[a-z0-9.+-]+|application\/octet-stream)$/;
const TOLERANCE_PATH_LABELS = new Set([
  "include the tolerance path (screen shot) below",
  "include the tolerance path (screenshot) below",
]);
const TOLERANCE_PATH_MEDIA_TYPES = new Set(["image/png", "image/jpeg"]);

type FieldName = FactorFieldName | keyof typeof HEADER_ALIASES;
type Column = { readonly semanticField: FieldName; readonly sourceColumn: string; readonly headerText: string };
type TolerancePathImageEvidence =
  | { readonly status: "available"; readonly labelSourceCell: string; readonly imageContentHash: string; readonly imageAnchor: { readonly from: string; readonly to: string } }
  | { readonly status: "unavailable"; readonly reasonCode: "label_missing" | "label_ambiguous" | "image_missing" | "unsupported_media_type" | "unparsed_anchor" | "worksheet_unavailable"; readonly labelSourceCell?: string };
const NUMERIC_FIELDS = new Set<FieldName>(["nominalValue", "upperTolerance", "lowerTolerance", "longTermSafetyFactor", "upperSpecificationLimit", "lowerSpecificationLimit", "contribution", "sensitivity", "mean", "tolerance", "oneSigma", "percentContributionToSigma", "standardDeviation", "cpk"]);
const USER_INPUT_FIELDS = new Set<FieldName>([
  "factorName", "partName", "drawingNumber", "partNumber", "dimCharacteristicId", "partCategory",
  "nominalValue", "upperTolerance", "lowerTolerance", "longTermSafetyFactor",
  "standardDeviation", "distribution",
]);

interface SelectedAnalysis {
  readonly worksheetName: string;
  readonly toleranceLoopDescription: string;
}

type WorksheetProcessingReasonCode =
  | "processed"
  | "image_extraction_skipped"
  | "workbook_archive"
  | "invalid_request"
  | "policy_denied"
  | "unknown";

export interface WorksheetProcessingPage {
  readonly worksheetName: string;
  readonly toleranceLoopDescription: string;
  readonly status: "processed" | "failed";
  readonly reasonCode: WorksheetProcessingReasonCode;
  readonly durationMs: number;
  readonly factorTableCount?: number;
  readonly factorRowCount?: number;
  readonly formulaCellCount?: number;
  readonly imageAssetCount?: number;
  readonly errorSummary?: string;
}

export interface ParallelWorksheetAnalysisAssetsResult {
  readonly processingMode: "parallel";
  readonly assets: WorksheetAnalysisAssetsResult;
  readonly pages: readonly WorksheetProcessingPage[];
}

function assetsError(summary: string, reference: string, code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({ code, summary, suggestedAction: "Provide a supported confidential worksheet-analysis assets request.", affectedInputReferences: [reference] });
}

function normalize(value: string): string {
  return value
    .replace(/[▼►]/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
function address(reference: string): { readonly column: string; readonly row: number } | undefined {
  const match = CELL_REFERENCE.exec(reference);
  return match ? { column: match[1]!, row: Number(match[2]) } : undefined;
}
function cellKey(column: string, row: number): string { return `${column}${row}`; }
function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
    Object.freeze(value);
  }
  return value;
}

function cellValue(cell: OoxmlCell | undefined): string { return cell?.formula ? cell.cachedValue ?? "" : cell?.value ?? ""; }
function mediaTypeFromPath(partName: string): string {
  const lower = partName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
function tolerancePathImage(
  worksheetName: string,
  worksheetCells: readonly OoxmlCell[],
  imageAssets: readonly { readonly contentHash: string; readonly mediaType: string; readonly anchor: { readonly status: "available"; readonly from: string; readonly to: string } | { readonly status: "unavailable" } }[],
): TolerancePathImageEvidence {
  const labels = worksheetCells.filter((cell) => TOLERANCE_PATH_LABELS.has(normalize(cellValue(cell)).replace(/:$/, "")));
  if (labels.length === 0) return { status: "unavailable" as const, reasonCode: "label_missing" as const };
  if (labels.length !== 1) return { status: "unavailable" as const, reasonCode: "label_ambiguous" as const };
  const label = labels[0]!;
  const labelRow = address(label.reference)!.row;
  const labelSourceCell = `${worksheetName}!${label.reference}`;
  const anchoredBelow = imageAssets
    .filter((image): image is typeof image & { readonly anchor: { readonly status: "available"; readonly from: string; readonly to: string } } => image.anchor.status === "available" && address(image.anchor.from)!.row > labelRow)
    .sort((left, right) => address(left.anchor.from)!.row - address(right.anchor.from)!.row);
  const supported = anchoredBelow.find((image) => TOLERANCE_PATH_MEDIA_TYPES.has(image.mediaType));
  if (supported) return { status: "available" as const, labelSourceCell, imageContentHash: supported.contentHash, imageAnchor: { from: supported.anchor.from, to: supported.anchor.to } };
  if (anchoredBelow.length > 0) return { status: "unavailable" as const, reasonCode: "unsupported_media_type" as const, labelSourceCell };
  if (imageAssets.some((image) => image.anchor.status === "unavailable")) return { status: "unavailable" as const, reasonCode: "unparsed_anchor" as const, labelSourceCell };
  return { status: "unavailable" as const, reasonCode: "image_missing" as const, labelSourceCell };
}
function field(cell: OoxmlCell | undefined, worksheetName: string, semanticField: FieldName) {
  const sourceCell = cell ? `${worksheetName}!${cell.reference}` : undefined;
  if (!cell) return { status: "unavailable" as const, reasonCode: "missing" as const };
  if (cell.formula && !cell.cachedValue?.trim()) return { status: "unavailable" as const, reasonCode: "missing_cached_value" as const, sourceCell };
  const rawText = cellValue(cell);
  if (!rawText.trim()) return { status: "unavailable" as const, reasonCode: "missing" as const, sourceCell };
  const parsed = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:\s+([^\s]+))?$/.exec(rawText.trim());
  if (NUMERIC_FIELDS.has(semanticField) && !parsed) return { status: "unavailable" as const, reasonCode: "invalid_format" as const, sourceCell };
  return {
    status: "available" as const,
    rawText,
    sourceCell: sourceCell!,
    ...(parsed ? { numericValue: Number(parsed[1]), ...(parsed[2] ? { unit: parsed[2] } : {}) } : {}),
    ...(cell.formula ? { formula: cell.formula, cachedValue: cell.cachedValue! } : {}),
  };
}

function sheetAssets(worksheet: OoxmlWorksheet, worksheetName: string, toleranceLoopDescription: string) {
  const cells = new Map<string, OoxmlCell>();
  const rows = new Map<number, OoxmlCell[]>();
  for (const cell of worksheet.cells) {
    const location = address(cell.reference);
    if (!location) continue;
    cells.set(cellKey(location.column, location.row), cell);
    const current = rows.get(location.row) ?? [];
    current.push(cell);
    rows.set(location.row, current);
  }
  const factorTables: unknown[] = [];
  const tableFormulaReferences = new Set<string>();
  for (const [headerRow, rowCells] of [...rows.entries()].sort(([left], [right]) => left - right)) {
    const mapped = new Map<FieldName, Column[]>();
    const factorResolution = resolveFactorHeaderCluster(rowCells.map((cell) => ({ reference: cell.reference, value: cell.value })));
    if (factorResolution.status !== "resolved") continue;
    for (const column of Object.values(factorResolution.columns)) {
      if (column) mapped.set(column.semanticField, [column]);
    }
    for (const cell of rowCells) {
      const location = address(cell.reference)!;
      const semanticField = (Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[]).find((name) => HEADER_ALIASES[name].includes(normalize(cell.value) as never));
      if (semanticField) mapped.set(semanticField, [...(mapped.get(semanticField) ?? []), { semanticField, sourceColumn: location.column, headerText: cell.value }]);
    }
    const columns = [...mapped.values()].flatMap((candidates) => candidates.length === 1 ? candidates : []);
    const inputColumns = columns.filter((column) => USER_INPUT_FIELDS.has(column.semanticField));
    const dataRows: unknown[] = [];
    for (let sourceRow = headerRow + 1; ; sourceRow += 1) {
      const rowExists = rows.has(sourceRow);
      if (!rowExists && sourceRow > Math.max(...rows.keys())) break;
      const inputCells = inputColumns.map((column) => cells.get(cellKey(column.sourceColumn, sourceRow)));
      if (inputCells.every((cell) => !cellValue(cell).trim())) break;
      const fields: Record<string, unknown> = {};
      for (const [name, candidates] of mapped.entries()) {
        if (candidates.length !== 1) fields[name] = { status: "unavailable", reasonCode: "duplicate_mapping" };
        else {
          const cell = cells.get(cellKey(candidates[0]!.sourceColumn, sourceRow));
          fields[name] = field(cell, worksheetName, name);
          if (cell?.formula) tableFormulaReferences.add(cell.reference);
        }
      }
      dataRows.push({ sourceRow, fields });
    }
    factorTables.push({
      tableId: createHash("sha256").update(`${worksheetName}:${headerRow}`).digest("hex").slice(0, 16),
      headerRow,
      dataRange: {
        startRow: headerRow + 1,
        endRow: (dataRows.at(-1) as { readonly sourceRow: number } | undefined)?.sourceRow ?? headerRow + 1,
      },
      columns,
      rows: dataRows,
    });
  }
  const formulaCells = worksheet.cells.filter((cell) => cell.formula && !tableFormulaReferences.has(cell.reference)).map((cell) => ({
    sourceCell: `${worksheetName}!${cell.reference}`,
    formula: cell.formula!,
    cachedValue: !cell.cachedValue?.trim() ? { status: "unavailable" as const, reasonCode: "missing_cached_value" as const } : { status: "available" as const, rawText: cell.cachedValue },
  }));
  const imageAssets = worksheet.images
    .map((image) => ({
      contentHash: image.contentHash,
      mediaType: image.mediaType.toLowerCase(),
      byteLength: image.byteLength,
      sourcePart: image.sourcePart,
      drawingSourcePart: image.drawingSourcePart,
      anchor: image.anchor ? { status: "available" as const, ...image.anchor } : { status: "unavailable" as const, reasonCode: "unparsed_anchor" as const },
    }))
    .filter((image) => image.byteLength > 0 && IMAGE_MEDIA_TYPE.test(image.mediaType));
  return {
    worksheetName,
    toleranceLoopDescription,
    factorTables,
    formulaCells,
    imageAssets,
    tolerancePathImage: tolerancePathImage(worksheetName, worksheet.cells, imageAssets),
  };
}

function selectedAnalyses(request: { readonly workbookCatalog: { readonly analyses: readonly SelectedAnalysis[] }; readonly worksheetSelection: { readonly mode: "all" } | { readonly mode: "selected"; readonly worksheetNames: readonly string[] } | undefined }) {
  const analyses = request.workbookCatalog.analyses;
  const selection = request.worksheetSelection;
  if (!selection || selection.mode === "all") return analyses;
  const available = new Set(analyses.map((analysis) => analysis.worksheetName));
  if (selection.worksheetNames.some((name) => !available.has(name))) throw assetsError(REQUEST_SUMMARY, "workbook-catalog");
  const selected = new Set(selection.worksheetNames);
  const filtered = analyses.filter((analysis) => selected.has(analysis.worksheetName));
  if (filtered.length === 0) throw assetsError(REQUEST_SUMMARY, "workbook-catalog");
  return filtered;
}

async function processWorksheetPage(
  workbookBytes: Uint8Array,
  analysis: SelectedAnalysis,
): Promise<{ readonly page: WorksheetProcessingPage; readonly worksheetAsset?: ReturnType<typeof sheetAssets> }> {
  const startedAt = performance.now();
  try {
    let worksheet: OoxmlWorksheet | undefined;
    let imageFallback = false;
    try {
      worksheet = readOoxmlWorkbook(workbookBytes, [analysis.worksheetName], true).worksheets.get(analysis.worksheetName);
    } catch {
      // Keep a worksheet independently reviewable even when embedded media is malformed.
      worksheet = readOoxmlWorkbook(workbookBytes, [analysis.worksheetName], false).worksheets.get(analysis.worksheetName);
      imageFallback = true;
    }
    if (!worksheet) throw assetsError(REQUEST_SUMMARY, "workbook-catalog");
    const worksheetAsset = sheetAssets(worksheet, analysis.worksheetName, analysis.toleranceLoopDescription);
    const factorTables = worksheetAsset.factorTables as readonly { readonly rows: readonly unknown[] }[];
    const factorRowCount = factorTables.reduce((sum, table) => sum + table.rows.length, 0);
    return {
      worksheetAsset,
      page: {
        worksheetName: analysis.worksheetName,
        toleranceLoopDescription: analysis.toleranceLoopDescription,
        status: "processed",
        reasonCode: imageFallback ? "image_extraction_skipped" : "processed",
        durationMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
        factorTableCount: worksheetAsset.factorTables.length,
        factorRowCount,
        formulaCellCount: worksheetAsset.formulaCells.length,
        imageAssetCount: worksheetAsset.imageAssets.length,
        ...(imageFallback ? { errorSummary: "image extraction skipped for this worksheet" } : {}),
      },
    };
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message : String(error);
    return {
      worksheetAsset: {
        worksheetName: analysis.worksheetName,
        toleranceLoopDescription: analysis.toleranceLoopDescription,
        factorTables: [],
        formulaCells: [],
        imageAssets: [],
        tolerancePathImage: { status: "unavailable", reasonCode: "worksheet_unavailable" },
      },
      page: {
        worksheetName: analysis.worksheetName,
        toleranceLoopDescription: analysis.toleranceLoopDescription,
        status: "failed",
        reasonCode: classifyWorksheetProcessingFailure(errorSummary),
        durationMs: Math.round((performance.now() - startedAt) * 1000) / 1000,
        errorSummary,
      },
    };
  }
}

function assetResult(contentHash: string, catalogContractVersion: string, worksheets: readonly ReturnType<typeof sheetAssets>[]): WorksheetAnalysisAssetsResult {
  const result = worksheetAnalysisAssetsResultSchema.safeParse({
    contractVersion: "v1",
    workbook: { classification: "confidential", contentHash, catalogContractVersion },
    worksheets,
  });
  if (!result.success) throw assetsError(REQUEST_SUMMARY, "workbook-request");
  return deepFreeze(structuredClone(result.data));
}

function classifyWorksheetProcessingFailure(error: unknown): WorksheetProcessingReasonCode {
  const text = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : JSON.stringify(error);
  const normalized = text.toLowerCase();
  if (normalized.includes("archive cannot be processed")) return "workbook_archive";
  if (normalized.includes("request is invalid")) return "invalid_request";
  if (normalized.includes("input is not permitted")) return "policy_denied";
  return "unknown";
}

export function createWorksheetAnalysisAssets(request: unknown): WorksheetAnalysisAssetsResult {
  let classification: unknown;
  try { classification = (request as { inputClassification?: unknown })?.inputClassification; } catch { throw assetsError(REQUEST_SUMMARY, "workbook-request"); }
  if (typeof classification === "string" && classification !== "confidential") throw assetsError(POLICY_SUMMARY, "workbook-request", "policy_denied");
  const parsed = worksheetAnalysisAssetsRequestSchema.safeParse(request);
  if (!parsed.success) throw assetsError(REQUEST_SUMMARY, "workbook-request");
  try {
    const contentHash = createHash("sha256").update(parsed.data.workbookBytes).digest("hex");
    if (contentHash !== parsed.data.workbookCatalog.workbook.contentHash) throw assetsError(REQUEST_SUMMARY, "workbook-catalog");
    const analyses = selectedAnalyses({
      workbookCatalog: parsed.data.workbookCatalog,
      worksheetSelection: parsed.data.worksheetSelection,
    });
    const workbook = readOoxmlWorkbook(parsed.data.workbookBytes, analyses.map((analysis) => analysis.worksheetName), true);
    const worksheets = analyses.map((analysis) => {
      const worksheet = workbook.worksheets.get(analysis.worksheetName);
      if (!worksheet) throw assetsError(REQUEST_SUMMARY, "workbook-catalog");
      return sheetAssets(worksheet, analysis.worksheetName, analysis.toleranceLoopDescription);
    });
    return assetResult(contentHash, parsed.data.workbookCatalog.contractVersion, worksheets);
  } catch (error) {
    if (error instanceof Error && (error as { summary?: string }).summary === REQUEST_SUMMARY) throw error;
    throw assetsError(ARCHIVE_SUMMARY, "workbook-archive");
  }
}

export async function createWorksheetAnalysisAssetsParallel(request: unknown): Promise<ParallelWorksheetAnalysisAssetsResult> {
  let classification: unknown;
  try { classification = (request as { inputClassification?: unknown })?.inputClassification; } catch { throw assetsError(REQUEST_SUMMARY, "workbook-request"); }
  if (typeof classification === "string" && classification !== "confidential") throw assetsError(POLICY_SUMMARY, "workbook-request", "policy_denied");
  const parsed = worksheetAnalysisAssetsRequestSchema.safeParse(request);
  if (!parsed.success) throw assetsError(REQUEST_SUMMARY, "workbook-request");
  try {
    const contentHash = createHash("sha256").update(parsed.data.workbookBytes).digest("hex");
    if (contentHash !== parsed.data.workbookCatalog.workbook.contentHash) throw assetsError(REQUEST_SUMMARY, "workbook-catalog");
    const analyses = selectedAnalyses({
      workbookCatalog: parsed.data.workbookCatalog,
      worksheetSelection: parsed.data.worksheetSelection,
    });
    const processed = await Promise.all(analyses.map((analysis) => processWorksheetPage(parsed.data.workbookBytes, analysis)));
    const worksheets = processed
      .map((entry) => entry.worksheetAsset)
      .filter((entry): entry is ReturnType<typeof sheetAssets> => entry !== undefined);
    const assets = assetResult(contentHash, parsed.data.workbookCatalog.contractVersion, worksheets);
    const pages = deepFreeze(structuredClone(processed.map((entry) => entry.page)));
    return deepFreeze({ processingMode: "parallel", assets, pages });
  } catch (error) {
    if (error instanceof Error && (error as { summary?: string }).summary === REQUEST_SUMMARY) throw error;
    throw assetsError(ARCHIVE_SUMMARY, "workbook-archive");
  }
}

export function readWorksheetImageAsset(request: unknown): WorksheetImageReadResult {
  let classification: unknown;
  try { classification = (request as { inputClassification?: unknown })?.inputClassification; } catch { throw assetsError(REQUEST_SUMMARY, "image-read-request"); }
  if (typeof classification === "string" && classification !== "confidential") throw assetsError(POLICY_SUMMARY, "image-read-request", "policy_denied");
  const parsed = worksheetImageReadRequestSchema.safeParse(request);
  if (!parsed.success) throw assetsError(REQUEST_SUMMARY, "image-read-request");
  try {
    const actualWorkbookHash = createHash("sha256").update(parsed.data.workbookBytes).digest("hex");
    if (actualWorkbookHash !== parsed.data.workbookContentHash) throw assetsError(REQUEST_SUMMARY, "workbook-content-hash");
    const parts = unzipSync(parsed.data.workbookBytes);
    let imageBytes: Uint8Array | undefined;
    let imageMediaType = "application/octet-stream";
    for (const [partName, bytes] of Object.entries(parts)) {
      if (!partName.startsWith("xl/media/")) continue;
      if (createHash("sha256").update(bytes).digest("hex") !== parsed.data.imageContentHash) continue;
      imageBytes = bytes;
      imageMediaType = mediaTypeFromPath(partName);
      break;
    }
    if (!imageBytes) throw assetsError(REQUEST_SUMMARY, "image-content-hash");
    const result = worksheetImageReadResultSchema.safeParse({
      contractVersion: "v1",
      classification: "confidential",
      workbookContentHash: actualWorkbookHash,
      imageContentHash: parsed.data.imageContentHash,
      mediaType: imageMediaType,
      bytes: imageBytes.slice(),
    });
    if (!result.success) throw assetsError(REQUEST_SUMMARY, "image-content-hash");
    return result.data;
  } catch (error) {
    if (error instanceof Error && (error as { summary?: string }).summary === REQUEST_SUMMARY) throw error;
    throw assetsError(ARCHIVE_SUMMARY, "workbook-archive");
  }
}
