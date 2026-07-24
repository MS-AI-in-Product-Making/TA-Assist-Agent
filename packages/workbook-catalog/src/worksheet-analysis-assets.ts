import { createHash } from "node:crypto";
import {
  createTypedError,
  worksheetAnalysisAssetsRequestSchema,
  worksheetAnalysisAssetsResultSchema,
  type WorksheetAnalysisAssetsResult,
} from "@ai-assist/contracts";
import { readOoxmlWorkbook, type OoxmlCell, type OoxmlWorksheet } from "./ooxml-reader.js";

const REQUEST_SUMMARY = "Worksheet-analysis assets request is invalid.";
const POLICY_SUMMARY = "Worksheet-analysis assets input is not permitted.";
const ARCHIVE_SUMMARY = "Worksheet-analysis assets archive cannot be processed.";
const CELL_REFERENCE = /^([A-Z]+)([1-9]\d*)$/;

const HEADER_ALIASES = {
  factorName: ["factor", "factor name"],
  nominalValue: ["nominal", "nominal value"],
  upperTolerance: ["upper tol", "upper tolerance"],
  lowerTolerance: ["lower tol", "lower tolerance"],
  upperSpecificationLimit: ["usl", "upper spec limit"],
  lowerSpecificationLimit: ["lsl", "lower spec limit"],
  unit: ["unit"],
  distribution: ["distribution"],
  assumption: ["assumption"],
  contribution: ["contribution"],
  sensitivity: ["sensitivity"],
  mean: ["mean"],
  standardDeviation: ["standard deviation", "sigma"],
  cpk: ["cpk"],
  assemblyDirection: ["assembly direction"],
} as const;

type FieldName = keyof typeof HEADER_ALIASES;
type Column = { readonly semanticField: FieldName; readonly sourceColumn: string; readonly headerText: string };
const NUMERIC_FIELDS = new Set<FieldName>(["nominalValue", "upperTolerance", "lowerTolerance", "upperSpecificationLimit", "lowerSpecificationLimit", "contribution", "sensitivity", "mean", "standardDeviation", "cpk"]);

function assetsError(summary: string, reference: string, code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({ code, summary, suggestedAction: "Provide a supported confidential worksheet-analysis assets request.", affectedInputReferences: [reference] });
}

function normalize(value: string): string { return value.trim().replace(/\s+/g, " ").toLowerCase(); }
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
function field(cell: OoxmlCell | undefined, worksheetName: string, semanticField: FieldName) {
  const sourceCell = cell ? `${worksheetName}!${cell.reference}` : undefined;
  if (!cell) return { status: "unavailable" as const, reasonCode: "missing" as const };
  if (cell.formula && cell.cachedValue === undefined) return { status: "unavailable" as const, reasonCode: "missing_cached_value" as const, sourceCell };
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
    for (const cell of rowCells) {
      const location = address(cell.reference)!;
      const semanticField = (Object.keys(HEADER_ALIASES) as FieldName[]).find((name) => HEADER_ALIASES[name].includes(normalize(cell.value) as never));
      if (semanticField) mapped.set(semanticField, [...(mapped.get(semanticField) ?? []), { semanticField, sourceColumn: location.column, headerText: cell.value }]);
    }
    const factorColumns = mapped.get("factorName");
    if (!factorColumns || factorColumns.length !== 1) continue;
    const columns = [...mapped.values()].flatMap((candidates) => candidates.length === 1 ? candidates : []);
    const mappedColumns = [...mapped.values()].flat();
    const dataRows: unknown[] = [];
    for (let sourceRow = headerRow + 1; ; sourceRow += 1) {
      const rowExists = rows.has(sourceRow);
      const rowCellsForTable = mappedColumns.map((column) => cells.get(cellKey(column.sourceColumn, sourceRow)));
      if (!rowExists && sourceRow > Math.max(...rows.keys())) break;
      if (rowCellsForTable.every((cell) => !cellValue(cell).trim())) break;
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
    if (dataRows.length > 0) {
      factorTables.push({
        tableId: createHash("sha256").update(`${worksheetName}:${headerRow}`).digest("hex").slice(0, 16),
        headerRow,
        dataRange: { startRow: headerRow + 1, endRow: headerRow + dataRows.length },
        columns,
        rows: dataRows,
      });
    }
  }
  const formulaCells = worksheet.cells.filter((cell) => cell.formula && !tableFormulaReferences.has(cell.reference)).map((cell) => ({
    sourceCell: `${worksheetName}!${cell.reference}`,
    formula: cell.formula!,
    cachedValue: cell.cachedValue === undefined ? { status: "unavailable" as const, reasonCode: "missing_cached_value" as const } : { status: "available" as const, rawText: cell.cachedValue },
  }));
  const imageAssets = worksheet.images.map((image) => ({
    contentHash: image.contentHash,
    mediaType: image.mediaType,
    byteLength: image.byteLength,
    sourcePart: image.sourcePart,
    drawingSourcePart: image.drawingSourcePart,
    anchor: image.anchor ? { status: "available" as const, ...image.anchor } : { status: "unavailable" as const, reasonCode: "unparsed_anchor" as const },
  }));
  return { worksheetName, toleranceLoopDescription, factorTables, formulaCells, imageAssets };
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
    const workbook = readOoxmlWorkbook(parsed.data.workbookBytes);
    const worksheets = parsed.data.workbookCatalog.analyses.map((analysis) => {
      const worksheet = workbook.worksheets.get(analysis.worksheetName);
      if (!worksheet) throw assetsError(REQUEST_SUMMARY, "workbook-catalog");
      return sheetAssets(worksheet, analysis.worksheetName, analysis.toleranceLoopDescription);
    });
    const result = worksheetAnalysisAssetsResultSchema.safeParse({ contractVersion: "v1", workbook: { classification: "confidential", contentHash, catalogContractVersion: parsed.data.workbookCatalog.contractVersion }, worksheets });
    if (!result.success) throw assetsError(REQUEST_SUMMARY, "workbook-request");
    return deepFreeze(structuredClone(result.data));
  } catch (error) {
    if (error instanceof Error && (error as { summary?: string }).summary === REQUEST_SUMMARY) throw error;
    throw assetsError(ARCHIVE_SUMMARY, "workbook-archive");
  }
}
