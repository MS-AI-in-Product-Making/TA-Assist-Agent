import { createHash } from "node:crypto";
import * as xlsx from "xlsx";
import {
  createTypedError,
  type InternalToleranceGuidanceEntry,
  type InternalToleranceGuidanceSourceMetadata,
  type InternalToleranceProcessFamily,
} from "@ai-assist/contracts";
import { z } from "zod";
import { getApprovedCapabilityMatrixSource } from "./data/approved-capability-sources.js";

const requiredHeaders = [
  "Process",
  "Feature Type",
  "Nominal Min (mm)",
  "Nominal Max (mm)",
  "Maximum Recommended Total Band (mm)",
] as const;
const optionalHeaders = [
  "Material",
  "Fallback Entry ID",
  "Process Method",
  "Material Family",
  "Thickness Min (mm)",
  "Thickness Max (mm)",
  "Tolerance Grade",
  "Dimension Type",
] as const;
const processFamilies: Readonly<Record<string, InternalToleranceProcessFamily>> = {
  CNC: "cnc-machining",
  "Die Casting": "die-casting",
  "Die Cutting": "die-cutting",
  "PCB/FPC": "pcb-fpc",
  "Plastic Injection Molding": "plastic-injection-molding",
  "Sheet Metal": "sheet-metal",
};

export interface ApprovedCapabilityMatrixSource {
  readonly sourceId: string;
  readonly sourceFile: string;
  readonly sourceFileHash: string;
  readonly sourceVersion: string;
  readonly sheetName: string;
  readonly entryIdPrefix: string;
  readonly owner: string;
  readonly confidence: number;
  readonly effectiveVersion: "internal-v1";
  readonly capabilityTier: "T1" | "T2" | "T3";
  readonly changeSummary: string;
}

export interface ImportCapabilityMatrixRequest {
  readonly sourceId: string;
  readonly workbookBytes: Uint8Array;
}

export interface CapabilityMatrixImportResult {
  readonly sources: InternalToleranceGuidanceSourceMetadata[];
  readonly entries: InternalToleranceGuidanceEntry[];
}

export function importCapabilityMatrix(
  request: unknown,
): CapabilityMatrixImportResult {
  const parsedRequest = parseImportRequest(request);
  if (parsedRequest === undefined) throw importError();
  const { sourceId, workbookBytes } = parsedRequest;
  if (workbookBytes.length === 0) throw importError();
  const source = getApprovedCapabilityMatrixSource(sourceId);
  if (source === undefined || !isApprovedSource(source) || sha256(workbookBytes) !== source.sourceFileHash) {
    throw importError();
  }

  const workbook = parseWorkbook(workbookBytes);
  const worksheet = workbook.Sheets[source.sheetName];
  if (worksheet === undefined || isBlankWorksheet(worksheet)) throw importError();

  const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true, defval: undefined });
  const headerRow = rows[0];
  if (!hasExactHeaders(headerRow)) throw importError();
  rejectMergedDataCells(worksheet);
  if (rows.length < 2) throw importError();

  const columnIndexes = new Map(headerRow.map((header, index) => [header, index]));
  const importedRows = rows.slice(1).map((row, index) => {
    const sourceRow = index + 2;
    const sourceMetadata = createRowSource(source, sourceRow, headerRow.length);
    return {
      source: sourceMetadata,
      entry: importRow(row, sourceRow, source, sourceMetadata, columnIndexes),
    };
  });
  return { sources: importedRows.map(({ source }) => source), entries: importedRows.map(({ entry }) => entry) };
}

const importCapabilityMatrixRequestSchema = z.object({
  sourceId: z.string().min(1),
  workbookBytes: z.instanceof(Uint8Array),
}).strict();

function parseImportRequest(request: unknown): ImportCapabilityMatrixRequest | undefined {
  try {
    const parsed = importCapabilityMatrixRequestSchema.safeParse(request);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function isApprovedSource(source: ApprovedCapabilityMatrixSource): boolean {
  return isNonBlank(source.sourceId)
    && isSafeLogicalFilename(source.sourceFile)
    && isSha256(source.sourceFileHash)
    && isNonBlank(source.sourceVersion)
    && isNonBlank(source.sheetName)
    && isNonBlank(source.entryIdPrefix)
    && isNonBlank(source.owner)
    && Number.isFinite(source.confidence)
    && source.confidence >= 0
    && source.confidence <= 1
    && source.effectiveVersion === "internal-v1"
    && ["T1", "T2", "T3"].includes(source.capabilityTier)
    && isNonBlank(source.changeSummary);
}

function isSafeLogicalFilename(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._ -]*\.xls(?:x)?$/i.test(value) && !value.includes("..");
}

function createRowSource(
  source: ApprovedCapabilityMatrixSource,
  sourceRow: number,
  columnCount: number,
): InternalToleranceGuidanceSourceMetadata {
  return {
    sourceId: `${source.sourceId}:row-${sourceRow}`,
    sourceFile: source.sourceFile,
    sourceFileHash: source.sourceFileHash,
    sourceVersion: source.sourceVersion,
    sheetName: source.sheetName,
    sourceRange: `A${sourceRow}:${xlsx.utils.encode_col(columnCount - 1)}${sourceRow}`,
    classification: "internal",
  };
}

function parseWorkbook(bytes: Uint8Array): xlsx.WorkBook {
  try {
    return xlsx.read(bytes, { type: "array", cellDates: false });
  } catch {
    throw importError();
  }
}

function hasExactHeaders(row: unknown[] | undefined): row is string[] {
  if (row === undefined || !row.every((header) => typeof header === "string")) return false;
  const headers = row as string[];
  const allowedHeaders = new Set<string>([...requiredHeaders, ...optionalHeaders]);
  return headers.length >= requiredHeaders.length
    && headers.length <= requiredHeaders.length + optionalHeaders.length
    && new Set(headers).size === headers.length
    && headers.every((header) => allowedHeaders.has(header))
    && requiredHeaders.every((header) => headers.includes(header))
    && headers.includes("Thickness Min (mm)") === headers.includes("Thickness Max (mm)");
}

function rejectMergedDataCells(worksheet: xlsx.WorkSheet): void {
  if ((worksheet["!merges"] ?? []).some((range) => range.s.r >= 1 || range.e.r >= 1)) throw importError();
}

function isBlankWorksheet(worksheet: xlsx.WorkSheet): boolean {
  return worksheet["!ref"] === undefined;
}

function importRow(
  row: unknown[],
  sourceRow: number,
  source: ApprovedCapabilityMatrixSource,
  sourceMetadata: InternalToleranceGuidanceSourceMetadata,
  columnIndexes: ReadonlyMap<string, number>,
): InternalToleranceGuidanceEntry {
  const process = processFamilies[stringCell(row[columnIndexes.get("Process")!])];
  const featureType = stringCell(row[columnIndexes.get("Feature Type")!]);
  const nominalMin = numericCell(row[columnIndexes.get("Nominal Min (mm)")!]);
  const nominalMax = numericCell(row[columnIndexes.get("Nominal Max (mm)")!]);
  const maximumRecommendedTotalBand = numericCell(row[columnIndexes.get("Maximum Recommended Total Band (mm)")!]);
  const material = optionalStringCell(row[columnIndexes.get("Material") ?? -1]);
  const fallbackEntryId = optionalStringCell(row[columnIndexes.get("Fallback Entry ID") ?? -1]);
  const processMethod = optionalStringCell(row[columnIndexes.get("Process Method") ?? -1]);
  const materialFamily = optionalStringCell(row[columnIndexes.get("Material Family") ?? -1]);
  const thicknessMinCell = row[columnIndexes.get("Thickness Min (mm)") ?? -1];
  const thicknessMaxCell = row[columnIndexes.get("Thickness Max (mm)") ?? -1];
  const thicknessMin = optionalNumericCell(thicknessMinCell);
  const thicknessMax = optionalNumericCell(thicknessMaxCell);
  const toleranceGrade = optionalStringCell(row[columnIndexes.get("Tolerance Grade") ?? -1]);
  const dimensionType = optionalStringCell(row[columnIndexes.get("Dimension Type") ?? -1]);
  if (process === undefined || !isNonBlank(featureType) || nominalMin === undefined || nominalMax === undefined
    || nominalMin > nominalMax || maximumRecommendedTotalBand === undefined || maximumRecommendedTotalBand <= 0
    || hasInvalidOptionalNumber(thicknessMinCell, thicknessMin)
    || hasInvalidOptionalNumber(thicknessMaxCell, thicknessMax)
    || (thicknessMin === undefined) !== (thicknessMax === undefined)
    || (thicknessMin !== undefined && thicknessMax !== undefined && thicknessMin > thicknessMax)
    || (dimensionType !== undefined && dimensionType !== "W" && dimensionType !== "NW")) {
    throw importError();
  }

  const conditionDimensionType: "W" | "NW" | undefined = dimensionType === "W" || dimensionType === "NW"
    ? dimensionType
    : undefined;
  const conditions: NonNullable<InternalToleranceGuidanceEntry["conditions"]> = {
    ...(processMethod === undefined ? {} : { processMethod }),
    ...(materialFamily === undefined ? {} : { materialFamily }),
    ...(thicknessMin === undefined || thicknessMax === undefined ? {} : { thicknessMm: { min: thicknessMin, max: thicknessMax } }),
    ...(toleranceGrade === undefined ? {} : { toleranceGrade }),
    ...(conditionDimensionType === undefined ? {} : { dimensionType: conditionDimensionType }),
  };

  return {
    entryId: `${source.entryIdPrefix}-${sourceRow}`,
    processFamily: process,
    featureType,
    ...(material === undefined ? {} : { material }),
    nominalRange: { min: nominalMin, max: nominalMax, unit: "mm" },
    maximumRecommendedTotalBand: { value: maximumRecommendedTotalBand, unit: "mm" },
    fallbackPriority: 0,
    ...(fallbackEntryId === undefined ? {} : { fallbackEntryId }),
    ...(Object.keys(conditions).length === 0 ? {} : { conditions }),
    capabilityTier: source.capabilityTier,
    provenance: {
      ...sourceMetadata,
      owner: source.owner,
      confidence: source.confidence,
      effectiveVersion: source.effectiveVersion,
      changeSummary: source.changeSummary,
    },
  };
}

function stringCell(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalStringCell(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw importError();
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function optionalNumericCell(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return numericCell(value);
}

function hasInvalidOptionalNumber(value: unknown, parsed: number | undefined): boolean {
  return value !== undefined && value !== null && value !== "" && parsed === undefined;
}

function numericCell(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isNonBlank(value: string): boolean {
  return value.trim().length > 0;
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function importError(): Error {
  return createTypedError({
    code: "validation_error",
    summary: "Capability matrix import is invalid.",
    suggestedAction: "Provide an approved, hashed capability matrix with the required headers and millimetre values.",
    affectedInputReferences: ["capability-matrix-import"],
  });
}