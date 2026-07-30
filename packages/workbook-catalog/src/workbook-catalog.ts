import { createHash } from "node:crypto";
import {
  createTypedError,
  workbookCatalogRequestSchema,
  workbookCatalogResultSchema,
  type WorkbookCatalogResult,
} from "@ai-assist/contracts";
import { readOoxmlWorkbook, type OoxmlCell, type OoxmlWorksheet } from "./ooxml-reader.js";

const REQUEST_SUMMARY = "Workbook-catalog request is invalid.";
const POLICY_SUMMARY = "Workbook-catalog input is not permitted.";
const ARCHIVE_SUMMARY = "Workbook-catalog archive cannot be processed.";
const cellReference = /^([A-Z]+)([1-9]\d*)$/;

function catalogError(summary: string, reference: "workbook-request" | "title-page" | "auto-summary", code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Provide a supported confidential workbook-catalog request.",
    affectedInputReferences: [reference],
  });
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeTitleLabel(value: string): string {
  return normalizeLabel(value).replace(/:+$/, "");
}

function normalizeTemplateLabel(value: string): string {
  return normalizeLabel(value).replace(/[▼►]/g, "").trim();
}

function nonempty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function address(reference: string): { readonly column: string; readonly row: number } | undefined {
  const match = cellReference.exec(reference);
  return match ? { column: match[1]!, row: Number(match[2]) } : undefined;
}

function columnNumber(column: string): number {
  return [...column].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0);
}

function titleValue(worksheet: OoxmlWorksheet, label: string): OoxmlCell {
  const expected = normalizeTitleLabel(label);
  const labels = worksheet.cells.filter((cell) => normalizeTitleLabel(cell.value) === expected);
  if (labels.length !== 1) throw catalogError(REQUEST_SUMMARY, "title-page");
  const labelAddress = address(labels[0]!.reference);
  if (!labelAddress) throw catalogError(REQUEST_SUMMARY, "title-page");
  const next = worksheet.cells
    .filter((cell) => {
      const candidate = address(cell.reference);
      return candidate?.row === labelAddress.row && candidate.column !== labelAddress.column && columnNumber(candidate.column) > columnNumber(labelAddress.column) && Boolean(nonempty(cell.value));
    })
    .sort((left, right) => columnNumber(address(left.reference)!.column) - columnNumber(address(right.reference)!.column))[0];
  if (!next) throw catalogError(REQUEST_SUMMARY, "title-page");
  return next;
}

function formatDate(value: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
  }
  if (/^\d+$/.test(value)) {
    const serial = Number(value);
    if (!Number.isInteger(serial) || serial < 1 || serial > 2_958_465) return undefined;
    return new Date(Date.UTC(1899, 11, 30 + serial)).toISOString().slice(0, 10);
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString().slice(0, 10);
}

function catalogDate(cell: OoxmlCell): { readonly value: string; readonly formula?: string; readonly sourceCell: string } {
  const rawValue = cell.formula ? nonempty(cell.cachedValue) : nonempty(cell.value);
  const value = rawValue ? formatDate(rawValue) : undefined;
  if (!value) throw catalogError(REQUEST_SUMMARY, "title-page");
  return { value, ...(cell.formula ? { formula: cell.formula.startsWith("=") ? cell.formula : `=${cell.formula}` } : {}), sourceCell: `Title Page!${cell.reference}` };
}

function cellAt(cells: readonly OoxmlCell[], row: number, column: string): OoxmlCell | undefined {
  return cells.find((cell) => {
    const candidate = address(cell.reference);
    return candidate?.row === row && candidate.column === column;
  });
}

function catalogAnalyses(worksheet: OoxmlWorksheet, workbook: ReturnType<typeof readOoxmlWorkbook>): WorkbookCatalogResult["analyses"] {
  const headers = worksheet.cells.filter((cell) => {
    const label = normalizeLabel(cell.value);
    return label === "device level dim" || label === "tolerance loop description";
  });
  const dimHeaders = headers.filter((cell) => normalizeLabel(cell.value) === "device level dim");
  const descriptionHeaders = headers.filter((cell) => normalizeLabel(cell.value) === "tolerance loop description");
  if (dimHeaders.length !== 1 || descriptionHeaders.length !== 1) throw catalogError(REQUEST_SUMMARY, "auto-summary");
  const dimAddress = address(dimHeaders[0]!.reference);
  const descriptionAddress = address(descriptionHeaders[0]!.reference);
  if (!dimAddress || !descriptionAddress || dimAddress.row !== descriptionAddress.row) throw catalogError(REQUEST_SUMMARY, "auto-summary");

  const rows = [...new Set(worksheet.cells.map((cell) => address(cell.reference)?.row).filter((row): row is number => row !== undefined))]
    .filter((row) => row > dimAddress.row)
    .sort((left, right) => left - right);
  const analyses: WorkbookCatalogResult["analyses"] = [];
  const names = new Set<string>();
  for (const row of rows) {
    const worksheetName = nonempty(cellAt(worksheet.cells, row, dimAddress.column)?.value);
    if (!worksheetName) continue;
    const description = nonempty(cellAt(worksheet.cells, row, descriptionAddress.column)?.value);
    if (!description || names.has(worksheetName) || !workbook.worksheetNames.has(worksheetName)) throw catalogError(REQUEST_SUMMARY, "auto-summary");
    names.add(worksheetName);
    analyses.push({ worksheetName, toleranceLoopDescription: description, source: { summarySheet: "Auto Summary", summaryRow: row, worksheetAnchor: `${worksheetName}!A1` } });
  }
  return analyses;
}

function scannedAnalyses(workbook: ReturnType<typeof readOoxmlWorkbook>): WorkbookCatalogResult["analyses"] {
  const analyses: WorkbookCatalogResult["analyses"] = [];
  for (const [worksheetName, worksheet] of workbook.worksheets) {
    const factorHeaders = worksheet.cells.filter((cell) => {
      const label = normalizeTemplateLabel(cell.value);
      return label === "factor description" || label === "factor description (ta loop)";
    });
    const descriptionLabels = worksheet.cells.filter((cell) => normalizeTemplateLabel(cell.value) === "tolerance loop description");
    if (factorHeaders.length !== 1 || descriptionLabels.length !== 1) continue;

    const labelAddress = address(descriptionLabels[0]!.reference);
    if (!labelAddress) continue;
    const descriptionCell = worksheet.cells
      .filter((cell) => {
        const candidate = address(cell.reference);
        return candidate?.row === labelAddress.row
          && columnNumber(candidate.column) > columnNumber(labelAddress.column)
          && Boolean(nonempty(cell.value));
      })
      .sort((left, right) => columnNumber(address(left.reference)!.column) - columnNumber(address(right.reference)!.column))[0];
    const toleranceLoopDescription = nonempty(descriptionCell?.value);
    if (!descriptionCell || !toleranceLoopDescription) continue;

    analyses.push({
      worksheetName,
      toleranceLoopDescription,
      source: {
        discoveryMethod: "worksheet_scan",
        descriptionCell: `${worksheetName}!${descriptionCell.reference}`,
        worksheetAnchor: `${worksheetName}!A1`,
      },
    });
  }
  return analyses;
}

function discoverWorksheetAnalyses(workbookBytes: Uint8Array): WorkbookCatalogResult["analyses"] {
  const workbook = readOoxmlWorkbook(
    workbookBytes,
    undefined,
    false,
    { maxRow: 260, maxColumn: "Z" },
    { skipInvalidWorksheets: true },
  );
  return scannedAnalyses(workbook);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item, seen);
    Object.freeze(value);
  }
  return value;
}

function isArchiveError(error: unknown): boolean {
  try {
    return error instanceof Error && (error as { summary?: unknown }).summary === ARCHIVE_SUMMARY;
  } catch {
    return false;
  }
}

export function createWorkbookCatalog(request: unknown): WorkbookCatalogResult {
  let inputClassification: unknown;
  try {
    inputClassification = (request as { inputClassification?: unknown })?.inputClassification;
  } catch {
    throw catalogError(REQUEST_SUMMARY, "workbook-request");
  }
  if (typeof inputClassification === "string" && inputClassification !== "confidential") {
    throw catalogError(POLICY_SUMMARY, "workbook-request", "policy_denied");
  }

  let parsed: ReturnType<typeof workbookCatalogRequestSchema.safeParse>;
  try {
    parsed = workbookCatalogRequestSchema.safeParse(request);
  } catch {
    throw catalogError(REQUEST_SUMMARY, "workbook-request");
  }
  if (!parsed.success) throw catalogError(REQUEST_SUMMARY, "workbook-request");

  try {
    const contentHash = createHash("sha256").update(parsed.data.workbookBytes).digest("hex");
    const workbook = readOoxmlWorkbook(parsed.data.workbookBytes, ["Title Page", "Auto Summary"], false);
    const titlePage = workbook.worksheets.get("Title Page");
    const autoSummary = workbook.worksheets.get("Auto Summary");
    if (!titlePage) throw catalogError(REQUEST_SUMMARY, "title-page");
    if (!autoSummary) throw catalogError(REQUEST_SUMMARY, "auto-summary");
    const summaryAnalyses = catalogAnalyses(autoSummary, workbook);
    const summaryWorksheetNames = new Set(summaryAnalyses.map((analysis) => analysis.worksheetName));
    const scanAnalyses = discoverWorksheetAnalyses(parsed.data.workbookBytes);
    const analyses = [
      ...summaryAnalyses,
      ...scanAnalyses.filter((analysis) => !summaryWorksheetNames.has(analysis.worksheetName)),
    ];
    if (analyses.length === 0) throw catalogError(REQUEST_SUMMARY, "auto-summary");
    const result = workbookCatalogResultSchema.safeParse({
      contractVersion: "v1",
      workbook: {
        fileName: parsed.data.fileName,
        classification: "confidential",
        contentHash,
        metadata: {
          documentNo: nonempty(titleValue(titlePage, "document no.").value)!,
          revision: nonempty(titleValue(titlePage, "revision").value)!,
          date: catalogDate(titleValue(titlePage, "date")),
        },
      },
      analyses,
    });
    if (!result.success) throw catalogError(REQUEST_SUMMARY, "auto-summary");
    return deepFreeze(structuredClone(result.data));
  } catch (error) {
    if (isArchiveError(error)) throw error;
    if (error instanceof Error && (error as { summary?: unknown }).summary === REQUEST_SUMMARY) throw error;
    throw catalogError(REQUEST_SUMMARY, "workbook-request");
  }
}