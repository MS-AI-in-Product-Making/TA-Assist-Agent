import { createHash } from "node:crypto";
import {
  drawingGovernanceRequestV2Schema,
  drawingGovernanceResultV2Schema,
  type DrawingGovernanceRequestV2,
  type DrawingGovernanceResultV2,
} from "@ai-assist/contracts";

type InputRow = DrawingGovernanceRequestV2["worksheets"][number]["rows"][number];
type DimIdStatus = "missing" | "suspected_invalid" | "valid" | "needs_confirmation";
type QualitySignal = "drawing_number_missing" | "dim_id_missing" | "dim_id_suspected_invalid" | "dim_id_needs_confirmation" | "duplicate_conflict";

function stableHash(parts: readonly (string | number)[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function normalizedText(value: string | number | null): string | undefined {
  const text = value === null ? "" : String(value).trim();
  return text.length === 0 ? undefined : text;
}

function normalizeDrawingNumber(value: string): string {
  return value.trim().toUpperCase();
}

function classifyDimId(value: string | undefined): DimIdStatus {
  if (value === undefined) return "missing";
  if (/^\d$/.test(value)) return "suspected_invalid";
  if (/^\d{2,4}$/.test(value)) return "valid";
  return "needs_confirmation";
}

function requiredText(value: string | number | null, field: string): string {
  const text = normalizedText(value);
  if (text === undefined) throw new Error(`F3 validation_error: ${field} is required.`);
  return text;
}

function requiredNumber(value: string | number | null, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`F3 validation_error: ${field} must be a finite number.`);
  }
  return value;
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function duplicateKey(row: InputRow): string | undefined {
  const drawingNumber = normalizedText(row.actualFields.drawingNumber);
  const dimId = normalizedText(row.actualFields.dimCharacteristicId);
  return drawingNumber === undefined || dimId === undefined
    ? undefined
    : `${normalizeDrawingNumber(drawingNumber)}\u0000${dimId}`;
}

export function createF3DrawingGovernance(request: unknown): DrawingGovernanceResultV2 {
  const input = drawingGovernanceRequestV2Schema.parse(request);
  const duplicateCounts = new Map<string, number>();
  for (const worksheet of input.worksheets) {
    for (const row of worksheet.rows) {
      const key = duplicateKey(row);
      if (key !== undefined) duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
    }
  }

  const composedRows = input.worksheets.flatMap((worksheet) => worksheet.rows.map((row) => {
    const drawingNumber = normalizedText(row.actualFields.drawingNumber);
    const dimId = normalizedText(row.actualFields.dimCharacteristicId);
    const dimIdStatus = classifyDimId(dimId);
    const key = duplicateKey(row);
    const qualitySignals: QualitySignal[] = [];
    if (drawingNumber === undefined) qualitySignals.push("drawing_number_missing");
    if (dimIdStatus === "missing") qualitySignals.push("dim_id_missing");
    if (dimIdStatus === "suspected_invalid") qualitySignals.push("dim_id_suspected_invalid");
    if (dimIdStatus === "needs_confirmation") qualitySignals.push("dim_id_needs_confirmation");
    if (key !== undefined && (duplicateCounts.get(key) ?? 0) > 1) qualitySignals.push("duplicate_conflict");

    return {
      factorInstanceId: stableHash([
        input.workbook.contentHash,
        row.worksheetName,
        row.tableId,
        row.sourceRow,
      ]),
      ...(drawingNumber !== undefined && dimIdStatus === "valid"
        ? { drawingDimensionKey: stableHash([normalizeDrawingNumber(drawingNumber), dimId!]) }
        : {}),
      deviceLevelDim: worksheet.worksheetName,
      dimensionDescription: worksheet.toleranceLoopDescription,
      partCategory: requiredText(row.actualFields.partCategory, "partCategory"),
      partSubsystem: requiredText(row.actualFields.partName, "partName"),
      drawingNumber: drawingNumber ?? null,
      dimId: dimId ?? null,
      factorDescription: requiredText(row.actualFields.factorName, "factorName"),
      nominal: requiredNumber(row.actualFields.nominalValue, "nominalValue"),
      upperTolerance: requiredNumber(row.actualFields.upperTolerance, "upperTolerance"),
      lowerTolerance: requiredNumber(row.actualFields.lowerTolerance, "lowerTolerance"),
      sigmaLevel: requiredNumber(row.actualFields.sigmaLevel, "sigmaLevel"),
      dimIdStatus,
      qualitySignals,
      governanceStatus: qualitySignals.length === 0 ? "complete" as const : "needs_governance" as const,
      imageReference: row.imageReference!,
      source: {
        worksheetName: row.worksheetName,
        tableId: row.tableId,
        sourceRow: row.sourceRow,
        sourceCells: row.sourceCells,
      },
    };
  }));

  composedRows.sort((left, right) => left.partCategory.localeCompare(right.partCategory)
    || normalizeDrawingNumber(left.drawingNumber ?? "").localeCompare(normalizeDrawingNumber(right.drawingNumber ?? ""))
    || left.source.worksheetName.localeCompare(right.source.worksheetName)
    || left.source.tableId.localeCompare(right.source.tableId)
    || left.source.sourceRow - right.source.sourceRow);

  const rowsByWorksheet = new Map(input.worksheets.map((worksheet) => [worksheet.worksheetName, [] as typeof composedRows]));
  for (const row of composedRows) {
    const worksheetRows = rowsByWorksheet.get(row.source.worksheetName);
    if (worksheetRows === undefined) throw new Error(`F3 row references unknown worksheet: ${row.source.worksheetName}`);
    worksheetRows.push(row);
  }
  const worksheets = input.worksheets.map((worksheet) => ({
    worksheetName: worksheet.worksheetName,
    toleranceLoopDescription: worksheet.toleranceLoopDescription,
    rows: rowsByWorksheet.get(worksheet.worksheetName)!,
  }));
  const completeCount = composedRows.filter((row) => row.governanceStatus === "complete").length;
  const result = drawingGovernanceResultV2Schema.parse({
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: completeCount === composedRows.length ? "completed" : "governance_required",
    artifactRoot: input.artifactRoot,
    workbook: input.workbook,
    worksheets,
    ado: { status: "not_requested" },
    summary: {
      worksheetCount: worksheets.length,
      factorCount: composedRows.length,
      completeCount,
      governanceRequiredCount: composedRows.length - completeCount,
      duplicateConflictCount: composedRows.filter((row) => row.qualitySignals.includes("duplicate_conflict")).length,
    },
  });
  return deepFreeze(result);
}