import { createHash } from "node:crypto";
import {
  createTypedError,
  f7FactorCandidateSchema,
  f7FactorEvidenceSchema,
  f7FactorSetupConfirmationSchema,
  f7WorkbookImportRequestSchema,
  worksheetSelectionPromptSchema,
  type F7FactorCandidate,
  type F7FactorEvidence,
  type F7FactorSetupConfirmation,
  type F7LoopCoefficient,
  type F7ToleranceDistribution,
  type Distribution,
  type WorksheetSelectionPrompt,
} from "@ai-assist/contracts";
import { z } from "zod";
import { resolveFactorHeaderCluster, type FactorHeaderResolution, type HeaderCell } from "./factor-header-resolver.js";
import { readOoxmlWorkbook, type OoxmlCell, type OoxmlWorksheet } from "./ooxml-reader.js";
import { readSafeZip } from "./zip-security.js";
import { createWorkbookCatalog } from "./workbook-catalog.js";
import { createWorksheetSelectionPrompt, validateWorksheetSelectionConfirmation } from "./worksheet-selection.js";
import { getDistributionMultiplier } from "./f6-numerics.js";

const IMPORT_SUMMARY = "F7 workbook import request is invalid.";
const EXTRACTION_SUMMARY = "F7 factor extraction request is invalid.";
const SETUP_SUMMARY = "F7 factor setup confirmation is invalid.";
const POLICY_SUMMARY = "F7 workbook import input is not permitted.";
const RECOMMENDED_ACTION = "Provide a supported confidential F7 workbook request and explicit confirmations.";
const CONTROLLED_HASH = /^[a-f0-9]{64}$/;
const CELL_REFERENCE = /^([A-Z]+)([1-9]\d*)$/;

const F4_DISTRIBUTION_BY_LABEL: Readonly<Record<F7ToleranceDistribution, Distribution>> = {
  Normal: "normal",
  Uniform: "uniform",
  Triangular: "triangular",
  Trapezoidal: "trapezoidal",
  Elliptical: "elliptical",
  Beta: "beta",
};

const importResultSchema = z.object({
  contractVersion: z.literal("v1"),
  inputClassification: z.literal("confidential"),
  workbook: z.object({
    fileName: z.string().min(1),
    contentHash: z.string().regex(CONTROLLED_HASH),
  }).strict(),
  prompt: worksheetSelectionPromptSchema,
}).strict().superRefine((result, context) => {
  if (result.prompt.workbook.contentHash !== result.workbook.contentHash) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "prompt workbook hash must match workbook content hash",
      path: ["prompt", "workbook", "contentHash"],
    });
  }
});

const extractionResultSchema = z.object({
  contractVersion: z.literal("v1"),
  inputClassification: z.literal("confidential"),
  workbookContentHash: z.string().regex(CONTROLLED_HASH),
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  candidates: z.array(f7FactorCandidateSchema).min(1),
}).strict();

const setupResultSchema = z.object({
  contractVersion: z.literal("v1"),
  outputClassification: z.literal("confidential"),
  workbookContentHash: z.string().regex(CONTROLLED_HASH),
  worksheetName: z.string().min(1),
  tableId: z.string().min(1),
  factors: z.array(f7FactorEvidenceSchema).min(1),
}).strict();

export type F7WorkbookImportResult = z.infer<typeof importResultSchema>;
export type F7FactorCandidateExtractionResult = z.infer<typeof extractionResultSchema>;
export type F7FactorSetupResult = z.infer<typeof setupResultSchema>;

function adapterError(
  summary: string,
  code: "validation_error" | "policy_denied" = "validation_error",
  details?: Record<string, unknown>,
): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: RECOMMENDED_ACTION,
    affectedInputReferences: ["f7-excel-adapter"],
    ...(details === undefined ? {} : { details }),
  });
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/[▼►]/g, " ").replace(/\s+/g, " ").toLowerCase();
}

function normalizeUnit(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function cellAddress(reference: string): { readonly column: string; readonly row: number } | undefined {
  const match = CELL_REFERENCE.exec(reference);
  return match ? { column: match[1]!, row: Number(match[2]) } : undefined;
}

function columnNumber(column: string): number {
  let result = 0;
  for (const character of column) result = result * 26 + character.charCodeAt(0) - 64;
  return result;
}

function columnName(index: number): string {
  let current = index;
  let result = "";
  while (current > 0) {
    const digit = (current - 1) % 26;
    result = String.fromCharCode(65 + digit) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function nextColumn(column: string): string {
  return columnName(columnNumber(column) + 1);
}

function cellText(cell: OoxmlCell): string {
  if (cell.formula) {
    const cached = cell.cachedValue?.trim();
    return cached !== undefined && cached.length > 0 ? cached : cell.value.trim();
  }
  return cell.value.trim();
}

function finiteNumberFromCell(cell: OoxmlCell | undefined): number | undefined {
  if (!cell) return undefined;
  const value = Number(cellText(cell));
  return Number.isFinite(value) ? value : undefined;
}

function sha256LengthPrefixed(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(`${part.length}:${part}|`);
  return hash.digest("hex");
}

function safeFileName(value: string): boolean {
  if (value.trim().length === 0) return false;
  if (value.includes("/") || value.includes("\\")) return false;
  if (!/\.xlsx$/i.test(value)) return false;
  return [...value].every((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 32 && codePoint !== 127;
  });
}

function headerRows(worksheet: OoxmlWorksheet): readonly number[] {
  const rows = new Set<number>();
  for (const cell of worksheet.cells) {
    const address = cellAddress(cell.reference);
    if (address) rows.add(address.row);
  }
  return [...rows].sort((left, right) => left - right);
}

function rowCells(worksheet: OoxmlWorksheet, row: number): HeaderCell[] {
  return worksheet.cells
    .filter((cell) => cellAddress(cell.reference)?.row === row)
    .map((cell) => ({ reference: cell.reference, value: cell.value }));
}

function locateFactorHeader(worksheet: OoxmlWorksheet): { readonly row: number; readonly resolution: Extract<FactorHeaderResolution, { status: "resolved" }> } {
  const resolvedRows = headerRows(worksheet)
    .map((row) => ({ row, resolution: resolveFactorHeaderCluster(rowCells(worksheet, row)) }))
    .filter((entry): entry is { row: number; resolution: Extract<FactorHeaderResolution, { status: "resolved" }> } => entry.resolution.status === "resolved");
  if (resolvedRows.length !== 1) throw adapterError(EXTRACTION_SUMMARY, "validation_error", { reasonCode: "ambiguous_factor_header" });
  return resolvedRows[0]!;
}

function worksheetCellByCoordinate(worksheet: OoxmlWorksheet): ReadonlyMap<string, OoxmlCell> {
  const map = new Map<string, OoxmlCell>();
  for (const cell of worksheet.cells) map.set(cell.reference, cell);
  return map;
}

function cellAt(map: ReadonlyMap<string, OoxmlCell>, row: number, column: string): OoxmlCell | undefined {
  return map.get(`${column}${row}`);
}

type SpecBound = "lower" | "upper";

type SpecLabelStrength = "strong" | "weak";

type SpecLabelEntry = {
  readonly kind: SpecBound;
  readonly strength: SpecLabelStrength;
  readonly row: number;
  readonly column: string;
  readonly labelReference: string;
  readonly valueReference: string;
  readonly value: number;
};

type SpecPairSelection = {
  readonly lower: { readonly value: number; readonly reference: string };
  readonly upper: { readonly value: number; readonly reference: string };
};

function normalizeSpecLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function labelKind(normalized: string): { readonly kind: SpecBound; readonly strength: SpecLabelStrength } | undefined {
  if (normalized === "lower spec limit" || normalized === "lower specification limit") {
    return { kind: "lower", strength: "strong" };
  }
  if (normalized === "upper spec limit" || normalized === "upper specification limit") {
    return { kind: "upper", strength: "strong" };
  }
  if (normalized === "lsl") return { kind: "lower", strength: "weak" };
  if (normalized === "usl") return { kind: "upper", strength: "weak" };
  return undefined;
}

function collectSpecLabelEntries(
  worksheet: OoxmlWorksheet,
  map: ReadonlyMap<string, OoxmlCell>,
  factorEndRow: number,
): readonly SpecLabelEntry[] {
  const entries: SpecLabelEntry[] = [];
  for (const cell of worksheet.cells) {
    const normalized = normalizeSpecLabel(cellText(cell));
    const kind = labelKind(normalized);
    if (!kind) continue;
    const address = cellAddress(cell.reference);
    if (!address || address.row <= factorEndRow) continue;
    const valueCell = cellAt(map, address.row, nextColumn(address.column));
    const numeric = finiteNumberFromCell(valueCell);
    if (!valueCell || numeric === undefined) continue;
    entries.push({
      ...kind,
      row: address.row,
      column: address.column,
      labelReference: cell.reference,
      valueReference: valueCell.reference,
      value: numeric,
    });
  }
  return entries;
}

function selectSpecPair(
  worksheet: OoxmlWorksheet,
  entries: readonly SpecLabelEntry[],
): SpecPairSelection | { readonly reasonCode: "missing_two_sided_specification" | "ambiguous_two_sided_specification" | "invalid_two_sided_specification" } {
  const hasStrong = entries.some((entry) => entry.strength === "strong");
  const eligible = hasStrong ? entries.filter((entry) => entry.strength === "strong") : entries;

  const upperByKey = new Map<string, SpecLabelEntry>();
  for (const entry of eligible) {
    if (entry.kind === "upper") upperByKey.set(`${entry.column}:${entry.row}`, entry);
  }

  const pairs = eligible
    .filter((entry) => entry.kind === "lower")
    .map((lower) => ({
      lower,
      upper: upperByKey.get(`${lower.column}:${lower.row + 1}`),
    }))
    .filter((pair): pair is { readonly lower: SpecLabelEntry; readonly upper: SpecLabelEntry } => pair.upper !== undefined);

  if (pairs.length === 0) return { reasonCode: "missing_two_sided_specification" };

  const earliestLowerRow = Math.min(...pairs.map((pair) => pair.lower.row));
  const earliestPairs = pairs.filter((pair) => pair.lower.row === earliestLowerRow);
  if (earliestPairs.length !== 1) return { reasonCode: "ambiguous_two_sided_specification" };

  const chosen = earliestPairs[0]!;
  if (!(chosen.lower.value < chosen.upper.value)) {
    return { reasonCode: "invalid_two_sided_specification" };
  }

  return {
    lower: {
      value: chosen.lower.value,
      reference: `${worksheet.name}!${chosen.lower.valueReference}`,
    },
    upper: {
      value: chosen.upper.value,
      reference: `${worksheet.name}!${chosen.upper.valueReference}`,
    },
  };
}

function requireWorksheet(worksheetName: string, workbookBytes: Uint8Array): OoxmlWorksheet {
  const workbook = readOoxmlWorkbook(
    workbookBytes,
    [worksheetName],
    false,
    { maxRow: 1000, maxColumn: "BN" },
  );
  const worksheet = workbook.worksheets.get(worksheetName);
  if (!worksheet) throw adapterError(EXTRACTION_SUMMARY);
  return worksheet;
}

function parseImportResult(value: unknown): F7WorkbookImportResult {
  const parsed = importResultSchema.safeParse(value);
  if (!parsed.success) throw adapterError(EXTRACTION_SUMMARY);
  return parsed.data;
}

function parseConfirmations(value: unknown): readonly F7FactorSetupConfirmation[] {
  const parsed = z.array(f7FactorSetupConfirmationSchema).min(1).safeParse(value);
  if (!parsed.success) throw adapterError(SETUP_SUMMARY);
  return parsed.data;
}

function buildCandidateId(workbookContentHash: string, worksheetName: string, tableId: string, sourceRow: number): string {
  return sha256LengthPrefixed([
    workbookContentHash,
    worksheetName,
    tableId,
    String(sourceRow),
  ]);
}

function buildFactorId(candidateId: string, loopCoefficient: F7LoopCoefficient): string {
  return sha256LengthPrefixed([
    candidateId,
    String(loopCoefficient),
  ]);
}

export function createF7WorkbookImport(request: unknown): F7WorkbookImportResult {
  let classification: unknown;
  try {
    classification = (request as { inputClassification?: unknown })?.inputClassification;
  } catch {
    throw adapterError(IMPORT_SUMMARY);
  }
  if (typeof classification === "string" && classification !== "confidential") {
    throw adapterError(POLICY_SUMMARY, "policy_denied");
  }

  const parsed = f7WorkbookImportRequestSchema.safeParse(request);
  if (!parsed.success) throw adapterError(IMPORT_SUMMARY);
  if (!safeFileName(parsed.data.fileName)) throw adapterError(IMPORT_SUMMARY);

  // Enforce archive boundary explicitly before any workbook parsing.
  readSafeZip(parsed.data.workbookBytes);
  const workbookCatalog = createWorkbookCatalog({
    contractVersion: "v1",
    inputClassification: "confidential",
    fileName: parsed.data.fileName,
    workbookBytes: parsed.data.workbookBytes,
  });
  const prompt = createWorksheetSelectionPrompt({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookCatalog,
  });

  const result = importResultSchema.safeParse({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: {
      fileName: workbookCatalog.workbook.fileName,
      contentHash: workbookCatalog.workbook.contentHash,
    },
    prompt,
  });
  if (!result.success) throw adapterError(IMPORT_SUMMARY);
  return deepFreeze(structuredClone(result.data));
}

export function extractF7FactorCandidates(request: {
  readonly workbookBytes: Uint8Array;
  readonly importResult: unknown;
  readonly confirmation: unknown;
}): F7FactorCandidateExtractionResult {
  const requestSchema = z.object({
    workbookBytes: z.instanceof(Uint8Array).refine((value) => value.length > 0),
    importResult: z.unknown(),
    confirmation: z.unknown(),
  }).strict();
  const parsedRequest = requestSchema.safeParse(request);
  if (!parsedRequest.success) throw adapterError(EXTRACTION_SUMMARY);

  const importResult = parseImportResult(parsedRequest.data.importResult);
  const workbookContentHash = createHash("sha256").update(parsedRequest.data.workbookBytes).digest("hex");
  if (workbookContentHash !== importResult.workbook.contentHash) {
    throw adapterError(EXTRACTION_SUMMARY, "validation_error", { reasonCode: "stale_worksheet_selection" });
  }

  const confirmationResult = validateWorksheetSelectionConfirmation({
    prompt: importResult.prompt,
    confirmation: parsedRequest.data.confirmation,
  });
  if (confirmationResult.status !== "confirmed") {
    throw adapterError(EXTRACTION_SUMMARY, "validation_error", { reasonCode: confirmationResult.reasonCode });
  }
  if (confirmationResult.selectedWorksheetNames.length !== 1) {
    throw adapterError(EXTRACTION_SUMMARY, "validation_error", { reasonCode: "invalid_worksheet_selection" });
  }

  const worksheetName = confirmationResult.selectedWorksheetNames[0]!;
  const worksheet = requireWorksheet(worksheetName, parsedRequest.data.workbookBytes);
  const { row: headerRow, resolution } = locateFactorHeader(worksheet);
  const tableId = `factor-table-${resolution.anchorColumn}${headerRow}`;
  const factorColumn = resolution.columns.factorName?.sourceColumn;
  const nominalValueColumn = resolution.columns.nominalValue?.sourceColumn;
  const upperToleranceColumn = resolution.columns.upperTolerance?.sourceColumn;
  const lowerToleranceColumn = resolution.columns.lowerTolerance?.sourceColumn;
  const longTermSafetyFactorColumn = resolution.columns.longTermSafetyFactor?.sourceColumn;
  const sigmaLevelColumn = resolution.columns.sigmaLevel?.sourceColumn;
  const meanColumn = resolution.columns.mean?.sourceColumn;
  const sigmaColumn = resolution.columns.oneSigma?.sourceColumn ?? resolution.columns.standardDeviation?.sourceColumn;
  const distributionColumn = resolution.columns.distribution?.sourceColumn;
  if (!factorColumn || !meanColumn || !sigmaColumn || !distributionColumn) throw adapterError(EXTRACTION_SUMMARY);

  const cellsByCoordinate = worksheetCellByCoordinate(worksheet);
  const factorRows: number[] = [];
  for (let row = headerRow + 1; row <= 1000; row += 1) {
    const factorCell = cellAt(cellsByCoordinate, row, factorColumn);
    const factorName = factorCell ? cellText(factorCell).trim() : "";
    if (factorName.length === 0) break;
    factorRows.push(row);
  }
  if (factorRows.length === 0) throw adapterError(EXTRACTION_SUMMARY);
  const factorEndRow = factorRows[factorRows.length - 1]!;

  const specEntries = collectSpecLabelEntries(worksheet, cellsByCoordinate, factorEndRow);
  const selectedSpec = selectSpecPair(worksheet, specEntries);
  if ("reasonCode" in selectedSpec) {
    throw adapterError(EXTRACTION_SUMMARY, "validation_error", { reasonCode: selectedSpec.reasonCode });
  }

  const candidates: F7FactorCandidate[] = [];
  for (const row of factorRows) {
    const factorCell = cellAt(cellsByCoordinate, row, factorColumn);
    const factorName = factorCell ? cellText(factorCell).trim() : "";

    const meanCell = cellAt(cellsByCoordinate, row, meanColumn);
    const sigmaCell = cellAt(cellsByCoordinate, row, sigmaColumn);
    const distributionCell = cellAt(cellsByCoordinate, row, distributionColumn);
    const nominalValueCell = nominalValueColumn ? cellAt(cellsByCoordinate, row, nominalValueColumn) : undefined;
    const upperToleranceCell = upperToleranceColumn ? cellAt(cellsByCoordinate, row, upperToleranceColumn) : undefined;
    const lowerToleranceCell = lowerToleranceColumn ? cellAt(cellsByCoordinate, row, lowerToleranceColumn) : undefined;
    const longTermSafetyFactorCell = longTermSafetyFactorColumn ? cellAt(cellsByCoordinate, row, longTermSafetyFactorColumn) : undefined;
    const sigmaLevelCell = sigmaLevelColumn ? cellAt(cellsByCoordinate, row, sigmaLevelColumn) : undefined;
    const excelSignedMean = finiteNumberFromCell(meanCell);
    const standardDeviation = finiteNumberFromCell(sigmaCell);
    const nominalValue = finiteNumberFromCell(nominalValueCell);
    const upperTolerance = finiteNumberFromCell(upperToleranceCell);
    const lowerTolerance = finiteNumberFromCell(lowerToleranceCell);
    const workbookLongTermSafetyFactor = finiteNumberFromCell(longTermSafetyFactorCell);
    const workbookSigmaLevel = finiteNumberFromCell(sigmaLevelCell);
    const distribution = distributionCell ? normalizeLabel(cellText(distributionCell)) : "";
    if (excelSignedMean === undefined || standardDeviation === undefined || standardDeviation <= 0 || !distributionCell) {
      throw adapterError(EXTRACTION_SUMMARY);
    }
    if (distribution !== "normal") {
      throw adapterError(EXTRACTION_SUMMARY, "validation_error", { reasonCode: "baseline_sampler_not_defined" });
    }

    const absoluteNominalValue = nominalValue === undefined ? undefined : Math.abs(nominalValue);
    const factorLowerSpec = absoluteNominalValue !== undefined && lowerTolerance !== undefined
      ? absoluteNominalValue + lowerTolerance
      : undefined;
    const factorUpperSpec = absoluteNominalValue !== undefined && upperTolerance !== undefined
      ? absoluteNominalValue + upperTolerance
      : undefined;
    const hasFactorSpecification = factorLowerSpec !== undefined
      && factorUpperSpec !== undefined
      && factorLowerSpec < factorUpperSpec;
    const lowerSpecLimit = hasFactorSpecification ? factorLowerSpec : selectedSpec.lower.value;
    const upperSpecLimit = hasFactorSpecification ? factorUpperSpec : selectedSpec.upper.value;
    const designNominal = hasFactorSpecification ? nominalValue : excelSignedMean;
    const normalizedLowerTolerance = hasFactorSpecification ? lowerTolerance : lowerSpecLimit;
    const normalizedUpperTolerance = hasFactorSpecification ? upperTolerance : upperSpecLimit;
    const specificationSourceCells = hasFactorSpecification
      ? {
          nominalValue: `${worksheetName}!${nominalValueCell!.reference}`,
          upperTolerance: `${worksheetName}!${upperToleranceCell!.reference}`,
          lowerTolerance: `${worksheetName}!${lowerToleranceCell!.reference}`,
          lowerSpecLimit: `${worksheetName}!${nominalValueCell!.reference}`,
          upperSpecLimit: `${worksheetName}!${nominalValueCell!.reference}`,
        }
      : {
          lowerSpecLimit: selectedSpec.lower.reference,
          upperSpecLimit: selectedSpec.upper.reference,
        };

    const candidate = {
      workbookContentHash,
      worksheetName,
      tableId,
      sourceRow: row,
      sourceCells: {
        factorName: `${worksheetName}!${factorCell!.reference}`,
        distribution: `${worksheetName}!${distributionCell.reference}`,
        excelSignedMean: `${worksheetName}!${meanCell!.reference}`,
        standardDeviation: `${worksheetName}!${sigmaCell!.reference}`,
        ...specificationSourceCells,
      },
      factorCandidateId: buildCandidateId(workbookContentHash, worksheetName, tableId, row),
      factorName,
      excelSignedMean,
      designNominal,
      upperTolerance: normalizedUpperTolerance,
      lowerTolerance: normalizedLowerTolerance,
      standardDeviation,
      longTermSafetyFactor: workbookLongTermSafetyFactor && workbookLongTermSafetyFactor > 0
        ? workbookLongTermSafetyFactor
        : 1,
      sigmaLevel: workbookSigmaLevel && workbookSigmaLevel > 0 ? workbookSigmaLevel : 4,
      distribution: "Normal" as const,
      lowerSpecLimit,
      upperSpecLimit,
    };
    const parsedCandidate = f7FactorCandidateSchema.safeParse(candidate);
    if (!parsedCandidate.success) throw adapterError(EXTRACTION_SUMMARY);
    candidates.push(parsedCandidate.data);
  }

  if (candidates.length === 0) throw adapterError(EXTRACTION_SUMMARY);
  const parsedResult = extractionResultSchema.safeParse({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookContentHash,
    worksheetName,
    tableId,
    candidates,
  });
  if (!parsedResult.success) throw adapterError(EXTRACTION_SUMMARY);
  return deepFreeze(structuredClone(parsedResult.data));
}

export function confirmF7FactorSetup(request: {
  readonly extractionResult: unknown;
  readonly confirmations: unknown;
}): F7FactorSetupResult {
  const requestSchema = z.object({
    extractionResult: z.unknown(),
    confirmations: z.unknown(),
  }).strict();
  const parsedRequest = requestSchema.safeParse(request);
  if (!parsedRequest.success) throw adapterError(SETUP_SUMMARY);

  const extraction = extractionResultSchema.safeParse(parsedRequest.data.extractionResult);
  if (!extraction.success) throw adapterError(SETUP_SUMMARY);
  const confirmations = parseConfirmations(parsedRequest.data.confirmations);

  const candidates = extraction.data.candidates;
  const candidateById = new Map<string, F7FactorCandidate>();
  for (const candidate of candidates) candidateById.set(candidate.factorCandidateId, candidate);

  const seen = new Set<string>();
  const confirmationById = new Map<string, F7FactorSetupConfirmation>();
  for (const confirmation of confirmations) {
    const knownCandidate = candidateById.has(confirmation.factorCandidateId);
    if (seen.has(confirmation.factorCandidateId)
      || (knownCandidate && confirmation.userAdded === true)
      || (!knownCandidate && confirmation.userAdded !== true)) {
      throw adapterError(SETUP_SUMMARY);
    }
    seen.add(confirmation.factorCandidateId);
    confirmationById.set(confirmation.factorCandidateId, confirmation);
  }
  const maxSourceRow = Math.max(...candidates.map((candidate) => candidate.sourceRow));
  let userFactorIndex = 0;
  const selectedCandidates = confirmations.map((confirmation): F7FactorCandidate => {
    const existing = candidateById.get(confirmation.factorCandidateId);
    if (existing) return existing;
    userFactorIndex += 1;
    const lowerEndpoint = confirmation.designNominal + confirmation.lowerTolerance;
    const upperEndpoint = confirmation.designNominal + confirmation.upperTolerance;
    const tolerance = (confirmation.upperTolerance - confirmation.lowerTolerance) / 2;
    const longTermSafetyFactor = confirmation.longTermSafetyFactor ?? 1;
    const sigmaLevel = confirmation.sigmaLevel ?? 4;
    return f7FactorCandidateSchema.parse({
      workbookContentHash: extraction.data.workbookContentHash,
      worksheetName: extraction.data.worksheetName,
      tableId: `${extraction.data.tableId}-user`,
      sourceRow: maxSourceRow + userFactorIndex,
      sourceCells: {},
      factorCandidateId: confirmation.factorCandidateId,
      factorName: confirmation.factorName,
      userAdded: true,
      excelSignedMean: confirmation.designNominal,
      designNominal: confirmation.designNominal,
      upperTolerance: confirmation.upperTolerance,
      lowerTolerance: confirmation.lowerTolerance,
      longTermSafetyFactor,
      sigmaLevel,
      standardDeviation: tolerance * (longTermSafetyFactor / sigmaLevel),
      distribution: confirmation.distribution ?? "Normal",
      lowerSpecLimit: lowerEndpoint <= 0 && upperEndpoint >= 0
        ? 0
        : Math.min(Math.abs(lowerEndpoint), Math.abs(upperEndpoint)),
      upperSpecLimit: Math.max(Math.abs(lowerEndpoint), Math.abs(upperEndpoint)),
    });
  });

  const calculatedFactors = selectedCandidates.map((candidate) => {
    const confirmation = confirmationById.get(candidate.factorCandidateId)!;
    const tolerance = (confirmation.upperTolerance - confirmation.lowerTolerance) / 2;
    const calculatedMean = confirmation.designNominal < 0
      ? confirmation.designNominal - (confirmation.upperTolerance + confirmation.lowerTolerance) / 2
      : confirmation.designNominal + (confirmation.upperTolerance + confirmation.lowerTolerance) / 2;
    const longTermSafetyFactor = confirmation.longTermSafetyFactor ?? candidate.longTermSafetyFactor ?? 1;
    const sigmaLevel = confirmation.sigmaLevel ?? candidate.sigmaLevel ?? 4;
    const distribution = confirmation.distribution ?? candidate.distribution;
    const oneSigma = tolerance * (longTermSafetyFactor / sigmaLevel)
      * getDistributionMultiplier(F4_DISTRIBUTION_BY_LABEL[distribution]);
    return { candidate, confirmation, tolerance, calculatedMean, longTermSafetyFactor, sigmaLevel, distribution, oneSigma };
  });
  const sumOfSigmaSquares = calculatedFactors.reduce((total, factor) => total + factor.oneSigma ** 2, 0);

  const factors: F7FactorEvidence[] = [];
  for (const calculatedFactor of calculatedFactors) {
    const { candidate, confirmation } = calculatedFactor;

    const workbookUnitEvidence = candidate.workbookUnitEvidence ? normalizeUnit(candidate.workbookUnitEvidence) : undefined;
    const unit = workbookUnitEvidence ?? "unspecified";
    const unitSource = workbookUnitEvidence ? "workbook" : "unspecified";

    const loopCoefficient = Math.sign(confirmation.designNominal) as F7LoopCoefficient;
    const physicalMean = Math.abs(calculatedFactor.calculatedMean);
    const lowerEndpoint = confirmation.designNominal + confirmation.lowerTolerance;
    const upperEndpoint = confirmation.designNominal + confirmation.upperTolerance;
    const lowerSpecLimit = lowerEndpoint <= 0 && upperEndpoint >= 0
      ? 0
      : Math.min(Math.abs(lowerEndpoint), Math.abs(upperEndpoint));
    const upperSpecLimit = Math.max(Math.abs(lowerEndpoint), Math.abs(upperEndpoint));

    const evidence = {
      workbookContentHash: candidate.workbookContentHash,
      worksheetName: candidate.worksheetName,
      tableId: candidate.tableId,
      sourceRow: candidate.sourceRow,
      sourceCells: candidate.sourceCells,
      factorCandidateId: candidate.factorCandidateId,
      factorId: buildFactorId(candidate.factorCandidateId, loopCoefficient),
      factorName: candidate.factorName,
      ...(candidate.userAdded === true ? { userAdded: true as const } : {}),
      unit,
      unitSource,
      designNominal: confirmation.designNominal,
      upperTolerance: confirmation.upperTolerance,
      lowerTolerance: confirmation.lowerTolerance,
      longTermSafetyFactor: calculatedFactor.longTermSafetyFactor,
      sigmaLevel: calculatedFactor.sigmaLevel,
      distribution: calculatedFactor.distribution,
      calculatedMean: calculatedFactor.calculatedMean,
      tolerance: calculatedFactor.tolerance,
      oneSigma: calculatedFactor.oneSigma,
      percentContributionToSigma: calculatedFactor.oneSigma ** 2 / sumOfSigmaSquares,
      loopCoefficient,
      physicalMean,
      signedContributionMean: calculatedFactor.calculatedMean,
      baselineSampler: {
        samplerId: "NORMAL_LOCATION_SCALE_V1" as const,
        physicalMean,
        standardDeviation: calculatedFactor.oneSigma,
        support: "REAL" as const,
      },
      lowerSpecLimit,
      upperSpecLimit,
    };
    const parsedEvidence = f7FactorEvidenceSchema.safeParse(evidence);
    if (!parsedEvidence.success) throw adapterError(SETUP_SUMMARY);
    factors.push(parsedEvidence.data);
  }

  const result = setupResultSchema.safeParse({
    contractVersion: "v1",
    outputClassification: "confidential",
    workbookContentHash: extraction.data.workbookContentHash,
    worksheetName: extraction.data.worksheetName,
    tableId: extraction.data.tableId,
    factors,
  });
  if (!result.success) throw adapterError(SETUP_SUMMARY);
  return deepFreeze(structuredClone(result.data));
}

export type { WorksheetSelectionPrompt };