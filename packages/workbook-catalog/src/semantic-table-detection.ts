import { createHash } from "node:crypto";
import {
  createTypedError,
  semanticTableDetectionRequestSchema,
  semanticTableDetectionResultSchema,
  type SemanticTableDetectionResult,
} from "@ai-assist/contracts";
import { readOoxmlWorkbook, type OoxmlCell, type OoxmlWorksheet } from "./ooxml-reader.js";

const REQUEST_SUMMARY = "Semantic table detection request is invalid.";
const POLICY_SUMMARY = "Semantic table detection input is not permitted.";
const ARCHIVE_SUMMARY = "Semantic table detection archive cannot be processed.";
const CELL_REFERENCE = /^([A-Z]+)([1-9]\d*)$/;
const F1_ANALYSIS_CELL_WINDOW = { maxRow: 260, maxColumn: "Z" } as const;

type FieldName =
  | "factorName"
  | "partName"
  | "partCategory"
  | "nominalValue"
  | "upperTolerance"
  | "lowerTolerance"
  | "longTermSafetyFactor"
  | "distribution"
  | "drawingNumber"
  | "dimCharacteristicId";

type ReasonCode =
  | "missing_required_field"
  | "duplicate_mapping"
  | "ambiguous_mapping"
  | "invalid_format"
  | "invalid_manual_confirmation"
  | "no_candidate_detected";

type CandidateMapping = {
  readonly field: FieldName;
  readonly sourceColumn?: string;
  readonly headerText?: string;
  readonly status: "mapped" | "missing" | "duplicate" | "ambiguous";
};

type RecognitionStatus =
  | "auto_confirmed"
  | "pending_confirmation"
  | "manual_confirmed"
  | "blocked";

type Candidate = {
  readonly candidateId: string;
  readonly headerRow: number;
  readonly dataRange: { readonly startRow: number; readonly endRow: number };
  readonly mappedFields: readonly CandidateMapping[];
  readonly confidenceScore: number;
  readonly confidenceBreakdown: {
    readonly headerScore: number;
    readonly typeScore: number;
    readonly completenessScore: number;
    readonly penalty: number;
  };
  readonly reasonCodes: readonly ReasonCode[];
};

const HEADER_ALIASES: Readonly<Record<FieldName, readonly string[]>> = {
  factorName: ["factor", "factor name", "factor description", "factor description (ta loop)"],
  partName: ["part name"],
  partCategory: ["part category"],
  nominalValue: ["nominal", "nominal value", "design nominal"],
  upperTolerance: ["upper tol", "upper tolerance", "+ tolerance", "+ tolerence"],
  lowerTolerance: ["lower tol", "lower tolerance", "- tolerance", "- tolerence"],
  longTermSafetyFactor: ["long term factor", "safety factor", "long term/safety factor"],
  distribution: ["distribution"],
  drawingNumber: ["drawing number"],
  dimCharacteristicId: ["dim id", "characteristic id", "dim/characteristic id"],
};

const FIELD_ORDER: readonly FieldName[] = [
  "factorName",
  "partName",
  "partCategory",
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "longTermSafetyFactor",
  "distribution",
  "drawingNumber",
  "dimCharacteristicId",
];

const REQUIRED_FIELDS: readonly FieldName[] = [
  "factorName",
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "distribution",
];

function detectionError(
  summary: string,
  reference: "workbook-request" | "workbook-catalog" | "workbook-archive",
  code: "validation_error" | "policy_denied" = "validation_error",
): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Provide a supported confidential semantic table detection request.",
    affectedInputReferences: [reference],
  });
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
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

function rowMap(cells: readonly OoxmlCell[]): Map<number, OoxmlCell[]> {
  const rows = new Map<number, OoxmlCell[]>();
  for (const cell of cells) {
    const cellAddress = address(cell.reference);
    if (!cellAddress) continue;
    const current = rows.get(cellAddress.row) ?? [];
    current.push(cell);
    rows.set(cellAddress.row, current);
  }
  return rows;
}

function cellMap(cells: readonly OoxmlCell[]): Map<string, OoxmlCell> {
  const map = new Map<string, OoxmlCell>();
  for (const cell of cells) {
    const cellAddress = address(cell.reference);
    if (!cellAddress) continue;
    map.set(`${cellAddress.column}${cellAddress.row}`, cell);
  }
  return map;
}

function readCellText(cell: OoxmlCell | undefined): string {
  if (!cell) return "";
  return cell.formula ? (cell.cachedValue ?? "") : cell.value;
}

function detectHeaderFields(rowCells: readonly OoxmlCell[]) {
  const fieldToCells = new Map<FieldName, OoxmlCell[]>();
  const ambiguousFields = new Set<FieldName>();

  for (const cell of rowCells) {
    const normalized = normalize(cell.value);
    if (!normalized) continue;
    const matches = FIELD_ORDER.filter((field) => HEADER_ALIASES[field].includes(normalized));
    for (const field of matches) {
      fieldToCells.set(field, [...(fieldToCells.get(field) ?? []), cell]);
      if (matches.length > 1) ambiguousFields.add(field);
    }
  }

  return { fieldToCells, ambiguousFields };
}

function findDataEndRow(
  headerRow: number,
  mappedColumns: readonly string[],
  rows: Map<number, OoxmlCell[]>,
  cells: Map<string, OoxmlCell>,
): number {
  if (mappedColumns.length === 0) return headerRow + 1;
  const maxKnownRow = Math.max(...rows.keys());
  for (let row = headerRow + 1; row <= maxKnownRow + 1; row += 1) {
    const values = mappedColumns.map((column) => readCellText(cells.get(`${column}${row}`)).trim());
    if (values.every((value) => value.length === 0)) return Math.max(headerRow + 1, row - 1);
  }
  return Math.max(headerRow + 1, maxKnownRow);
}

function isScientificNumeric(text: string): boolean {
  return /^[+-]?(?:(?:\d+(?:\.\d+)?)|(?:\.\d+))(?:[eE][+-]?\d+)?(?:\s+[^\s]+)?$/.test(text.trim());
}

function completenessRatio(
  mappings: readonly CandidateMapping[],
  cells: Map<string, OoxmlCell>,
  startRow: number,
  endRow: number,
): number {
  let total = 0;
  let available = 0;
  const required = mappings.filter((mapping) => REQUIRED_FIELDS.includes(mapping.field));
  for (let row = startRow; row <= endRow && row < startRow + 5; row += 1) {
    for (const mapping of required) {
      total += 1;
      if (mapping.status !== "mapped" || !mapping.sourceColumn) continue;
      if (readCellText(cells.get(`${mapping.sourceColumn}${row}`)).trim()) available += 1;
    }
  }
  if (total === 0) return 0;
  return available / total;
}

function buildCandidate(
  worksheetName: string,
  headerRow: number,
  rowCells: readonly OoxmlCell[],
  rows: Map<number, OoxmlCell[]>,
  cells: Map<string, OoxmlCell>,
): Candidate {
  const { fieldToCells, ambiguousFields } = detectHeaderFields(rowCells);
  const mappings: CandidateMapping[] = [];

  for (const field of FIELD_ORDER) {
    const candidates = fieldToCells.get(field) ?? [];
    const firstAddress = candidates.length > 0 ? address(candidates[0]!.reference) : undefined;
    if (candidates.length === 0) {
      mappings.push({ field, status: "missing" });
    } else if (candidates.length > 1) {
      mappings.push({
        field,
        status: "duplicate",
        ...(firstAddress?.column ? { sourceColumn: firstAddress.column } : {}),
        ...(candidates[0]!.value ? { headerText: candidates[0]!.value } : {}),
      });
    } else if (ambiguousFields.has(field)) {
      mappings.push({
        field,
        status: "ambiguous",
        ...(firstAddress?.column ? { sourceColumn: firstAddress.column } : {}),
        ...(candidates[0]!.value ? { headerText: candidates[0]!.value } : {}),
      });
    } else {
      mappings.push({
        field,
        status: "mapped",
        ...(firstAddress?.column ? { sourceColumn: firstAddress.column } : {}),
        ...(candidates[0]!.value ? { headerText: candidates[0]!.value } : {}),
      });
    }
  }

  const mappedColumns = mappings
    .filter((mapping) => mapping.status === "mapped" && mapping.sourceColumn)
    .map((mapping) => mapping.sourceColumn!);
  const dataStart = headerRow + 1;
  const dataEnd = findDataEndRow(headerRow, mappedColumns, rows, cells);

  const requiredMapped = mappings.filter((mapping) => REQUIRED_FIELDS.includes(mapping.field) && mapping.status === "mapped").length;
  const headerScore = Math.round((requiredMapped / REQUIRED_FIELDS.length) * 45);
  // F1.7 focuses on header/region compliance rather than data-quality judgment.
  // Keep score stable for structure-only detection.
  const typeScore = 25;

  const completeRatio = completenessRatio(mappings, cells, dataStart, dataEnd);
  const completenessScore = Math.round(completeRatio * 20);

  const reasons = new Set<ReasonCode>();
  const hasMissingRequired = mappings.some((mapping) => REQUIRED_FIELDS.includes(mapping.field) && mapping.status === "missing");
  if (hasMissingRequired) reasons.add("missing_required_field");
  if (mappings.some((mapping) => mapping.status === "duplicate")) reasons.add("duplicate_mapping");
  if (mappings.some((mapping) => mapping.status === "ambiguous")) reasons.add("ambiguous_mapping");

  // Lightweight compatibility check for scientific notation values.
  // This avoids accidental regressions where numeric-like values are represented as E-notation.
  for (const mapping of mappings) {
    if (mapping.status !== "mapped" || !mapping.sourceColumn) continue;
    for (let row = dataStart; row <= dataEnd && row < dataStart + 3; row += 1) {
      const text = readCellText(cells.get(`${mapping.sourceColumn}${row}`)).trim();
      if (!text) continue;
      isScientificNumeric(text);
    }
  }

  const penalty = Math.min(
    30,
    (reasons.has("missing_required_field") ? 10 : 0)
    + (reasons.has("duplicate_mapping") ? 10 : 0)
    + (reasons.has("ambiguous_mapping") ? 10 : 0),
  );

  const confidenceScore = Math.max(0, Math.min(100, headerScore + typeScore + completenessScore - penalty));
  const candidateId = createHash("sha256").update(`${worksheetName}:${headerRow}`).digest("hex").slice(0, 16);

  return {
    candidateId,
    headerRow,
    dataRange: { startRow: dataStart, endRow: Math.max(dataStart, dataEnd) },
    mappedFields: mappings,
    confidenceScore,
    confidenceBreakdown: {
      headerScore,
      typeScore,
      completenessScore,
      penalty,
    },
    reasonCodes: [...reasons],
  };
}

function detectCandidates(worksheet: OoxmlWorksheet): readonly Candidate[] {
  const rows = rowMap(worksheet.cells);
  const cells = cellMap(worksheet.cells);
  const candidates: Candidate[] = [];

  for (const [rowNumber, rowCells] of [...rows.entries()].sort(([left], [right]) => left - right)) {
    const fields = detectHeaderFields(rowCells).fieldToCells;
    const coreFieldHits = REQUIRED_FIELDS.filter((field) => (fields.get(field)?.length ?? 0) > 0).length;
    const hasFactor = (fields.get("factorName")?.length ?? 0) > 0;
    if (!hasFactor || coreFieldHits < 3) continue;
    candidates.push(buildCandidate(worksheet.name, rowNumber, rowCells, rows, cells));
  }

  return candidates;
}

function chosenCandidate(worksheetName: string, candidates: readonly Candidate[]): Candidate {
  if (candidates.length === 0) {
    return {
      candidateId: createHash("sha256").update(`${worksheetName}:none`).digest("hex").slice(0, 16),
      headerRow: 1,
      dataRange: { startRow: 1, endRow: 1 },
      mappedFields: FIELD_ORDER.map((field) => ({ field, status: "missing" as const })),
      confidenceScore: 0,
      confidenceBreakdown: {
        headerScore: 0,
        typeScore: 0,
        completenessScore: 0,
        penalty: 30,
      },
      reasonCodes: ["no_candidate_detected"],
    };
  }
  return [...candidates].sort((left, right) => right.confidenceScore - left.confidenceScore)[0]!;
}

function decideStatus(candidate: Candidate): RecognitionStatus {
  if (
    candidate.reasonCodes.includes("missing_required_field")
    || candidate.reasonCodes.includes("duplicate_mapping")
    || candidate.reasonCodes.includes("ambiguous_mapping")
    || candidate.reasonCodes.includes("no_candidate_detected")
  ) {
    return "blocked";
  }
  if (candidate.confidenceScore >= 80) return "auto_confirmed";
  if (candidate.confidenceScore >= 60) return "pending_confirmation";
  return "blocked";
}

function selectedAnalyses(
  workbookCatalog: { readonly analyses: readonly { readonly worksheetName: string; readonly toleranceLoopDescription: string }[] },
  worksheetSelection: { readonly mode: "all" } | { readonly mode: "selected"; readonly worksheetNames: readonly string[] } | undefined,
) {
  const analyses = workbookCatalog.analyses;
  if (!worksheetSelection || worksheetSelection.mode === "all") return analyses;
  const selected = new Set(worksheetSelection.worksheetNames);
  const available = new Set(analyses.map((analysis) => analysis.worksheetName));
  if (worksheetSelection.worksheetNames.some((name) => !available.has(name))) {
    throw detectionError(REQUEST_SUMMARY, "workbook-catalog");
  }
  const filtered = analyses.filter((analysis) => selected.has(analysis.worksheetName));
  if (filtered.length === 0) throw detectionError(REQUEST_SUMMARY, "workbook-catalog");
  return filtered;
}

function applyManualStatus(
  worksheetName: string,
  status: RecognitionStatus,
  candidate: Candidate,
  manualConfirmations: readonly { readonly worksheetName: string; readonly candidateId: string; readonly action: "confirm_as_is" | "remap_fields" | "select_another_candidate" | "skip_sheet" }[] | undefined,
) {
  const confirmation = manualConfirmations?.find((item) => item.worksheetName === worksheetName);
  const reasons = new Set<ReasonCode>(candidate.reasonCodes);
  let nextStatus: RecognitionStatus = status;

  if (confirmation) {
    if (confirmation.candidateId !== candidate.candidateId) {
      reasons.add("invalid_manual_confirmation");
      if (nextStatus === "auto_confirmed") nextStatus = "pending_confirmation";
    } else if (nextStatus === "pending_confirmation") {
      if (confirmation.action === "skip_sheet") {
        nextStatus = "blocked";
      } else {
        nextStatus = "manual_confirmed";
      }
    }
  }

  return { nextStatus, reasons: [...reasons] as readonly ReasonCode[] };
}

export function createSemanticTableDetection(request: unknown): SemanticTableDetectionResult {
  let classification: unknown;
  try {
    classification = (request as { inputClassification?: unknown })?.inputClassification;
  } catch {
    throw detectionError(REQUEST_SUMMARY, "workbook-request");
  }
  if (typeof classification === "string" && classification !== "confidential") {
    throw detectionError(POLICY_SUMMARY, "workbook-request", "policy_denied");
  }

  const parsed = semanticTableDetectionRequestSchema.safeParse(request);
  if (!parsed.success) throw detectionError(REQUEST_SUMMARY, "workbook-request");

  try {
    const contentHash = createHash("sha256").update(parsed.data.workbookBytes).digest("hex");
    if (contentHash !== parsed.data.workbookCatalog.workbook.contentHash) {
      throw detectionError(REQUEST_SUMMARY, "workbook-catalog");
    }

    const analyses = selectedAnalyses(parsed.data.workbookCatalog, parsed.data.worksheetSelection);
    const workbook = readOoxmlWorkbook(
      parsed.data.workbookBytes,
      analyses.map((analysis) => analysis.worksheetName),
      false,
      F1_ANALYSIS_CELL_WINDOW,
    );

    const worksheets = analyses.map((analysis) => {
      const worksheet = workbook.worksheets.get(analysis.worksheetName);
      if (!worksheet) throw detectionError(REQUEST_SUMMARY, "workbook-catalog");

      const best = chosenCandidate(analysis.worksheetName, detectCandidates(worksheet));
      const initialStatus = decideStatus(best);
      const { nextStatus, reasons } = applyManualStatus(
        analysis.worksheetName,
        initialStatus,
        best,
        parsed.data.manualConfirmations,
      );
      const requiresUserConfirmation = nextStatus === "pending_confirmation" || nextStatus === "blocked";

      return {
        worksheetName: analysis.worksheetName,
        recognitionStatus: nextStatus,
        confidenceScore: best.confidenceScore,
        confidenceBreakdown: best.confidenceBreakdown,
        uncertaintyReasons: reasons,
        requiresUserConfirmation,
        confirmationPayload: requiresUserConfirmation
          ? {
            candidateId: best.candidateId,
            headerRow: best.headerRow,
            dataRange: best.dataRange,
            mappedFields: best.mappedFields,
            recommendedAction: nextStatus === "blocked" ? "remap_fields" : "confirm_as_is",
            reasonCodes: reasons,
          }
          : undefined,
      };
    });

    const result = semanticTableDetectionResultSchema.safeParse({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbook: {
        contentHash,
        catalogContractVersion: parsed.data.workbookCatalog.contractVersion,
      },
      worksheets,
      summary: {
        worksheetCount: worksheets.length,
        autoConfirmedCount: worksheets.filter((worksheet) => worksheet.recognitionStatus === "auto_confirmed").length,
        manualConfirmedCount: worksheets.filter((worksheet) => worksheet.recognitionStatus === "manual_confirmed").length,
        pendingConfirmationCount: worksheets.filter((worksheet) => worksheet.recognitionStatus === "pending_confirmation").length,
        blockedCount: worksheets.filter((worksheet) => worksheet.recognitionStatus === "blocked").length,
      },
    });
    if (!result.success) throw detectionError(REQUEST_SUMMARY, "workbook-request");
    return deepFreeze(structuredClone(result.data));
  } catch (error) {
    if (error instanceof Error && (error as { summary?: string }).summary === REQUEST_SUMMARY) throw error;
    throw detectionError(ARCHIVE_SUMMARY, "workbook-archive");
  }
}
