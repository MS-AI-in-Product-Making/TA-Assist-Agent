import { createHash } from "node:crypto";
import {
  createTypedError,
  f7MeasurementDatasetSchema,
  f7ObservationSchema,
  f7MeasurementPasteResultSchema,
  type F7MeasurementPasteResult,
} from "@ai-assist/contracts";
import { z } from "zod";

const HASH_DOMAIN = "f7-measurement-hash-v1";
const MAX_UTF8_BYTES = 1_048_576;
const INPUT_SUMMARY = "F7 measurement paste input is invalid.";
const INPUT_SUGGESTED_ACTION = "Provide a valid factorId, unit, structure, sourceReference, msaStatus, text, and importedAt.";
const INPUT_REFERENCE = "f7-measurement-paste-input";
const ALLOWED_HEADERS = ["value", "sequence", "timestamp", "subgroup", "batch"] as const;
const HEADER_SET = new Set<string>(ALLOWED_HEADERS);
const NUMERIC_LITERAL_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

const requestSchema = z.object({
  factorId: z.string().regex(/^[a-f0-9]{64}$/),
  unit: z.string().trim().min(1),
  structure: z.enum(["RATIONAL_SUBGROUP", "ORDERED_INDIVIDUALS", "UNORDERED_SAMPLE"]),
  sourceReference: z.string().min(1),
  importedAt: z.string().datetime({ offset: true }),
  msaStatus: z.enum(["available", "not_available", "unknown"]),
  text: z.string().min(1),
}).strict();

type ParserRequest = z.infer<typeof requestSchema>;
type Delimiter = "\t" | "," | ";";
type HeaderParseResult =
  | { kind: "none" }
  | { kind: "explicit"; rowIndex: number; columns: readonly (typeof ALLOWED_HEADERS)[number][]; delimiter: Delimiter }
  | { kind: "invalid"; rowNumber: number };

type RejectionReason = "non_finite_value" | "invalid_row" | "missing_value";
type F7Observation = z.infer<typeof f7ObservationSchema>;

function validationError(): Error {
  return createTypedError({
    code: "validation_error",
    summary: INPUT_SUMMARY,
    suggestedAction: INPUT_SUGGESTED_ACTION,
    affectedInputReferences: [INPUT_REFERENCE],
  });
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function normalizeNegativeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function splitPhysicalLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const noBom = normalized.startsWith("\uFEFF") ? normalized.slice(1) : normalized;
  const lines = noBom.split("\n");
  if (noBom.endsWith("\n") && lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function isBlankRow(line: string): boolean {
  return line.trim().length === 0;
}

function countDelimiterFamilies(line: string): readonly Delimiter[] {
  const families: Delimiter[] = [];
  if (line.includes("\t")) families.push("\t");
  if (line.includes(",")) families.push(",");
  if (line.includes(";")) families.push(";");
  return families;
}

function containsReservedHeaderToken(line: string): boolean {
  const tokens = line
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
  return tokens.some((token) => HEADER_SET.has(token));
}

function parseHeader(lines: readonly string[]): HeaderParseResult {
  const firstNonEmptyIndex = lines.findIndex((line) => !isBlankRow(line));
  if (firstNonEmptyIndex < 0) return { kind: "none" };

  const rawRow = lines[firstNonEmptyIndex];
  if (rawRow === undefined) return { kind: "none" };
  const row = rawRow.trim();
  const canonicalRow = row.toLowerCase();
  if (canonicalRow === "value") {
    return { kind: "explicit", rowIndex: firstNonEmptyIndex, columns: ["value"], delimiter: "," };
  }

  const mentionsKnownHeader = containsReservedHeaderToken(row);
  const families = countDelimiterFamilies(row);
  if (families.length === 0) {
    return mentionsKnownHeader
      ? { kind: "invalid", rowNumber: firstNonEmptyIndex + 1 }
      : { kind: "none" };
  }

  if (!mentionsKnownHeader) return { kind: "none" };

  if (families.length > 1) {
    return { kind: "invalid", rowNumber: firstNonEmptyIndex + 1 };
  }

  const delimiter = families[0];
  if (delimiter === undefined) {
    return { kind: "invalid", rowNumber: firstNonEmptyIndex + 1 };
  }
  const normalizedColumns = row.split(delimiter).map((entry) => entry.trim().toLowerCase());
  const hasUnknown = normalizedColumns.some((entry) => !HEADER_SET.has(entry));
  const hasDuplicate = new Set(normalizedColumns).size !== normalizedColumns.length;
  const hasValue = normalizedColumns.includes("value");

  if (hasUnknown || hasDuplicate || !hasValue) {
    return { kind: "invalid", rowNumber: firstNonEmptyIndex + 1 };
  }

  return {
    kind: "explicit",
    rowIndex: firstNonEmptyIndex,
    columns: normalizedColumns as (typeof ALLOWED_HEADERS)[number][],
    delimiter,
  };
}

function parseInvariantNumber(valueLiteral: string): { ok: true; value: number } | { ok: false; reason: RejectionReason } {
  if (valueLiteral.length === 0) return { ok: false, reason: "missing_value" };
  if (/^[+-]?Infinity$/i.test(valueLiteral) || /^NaN$/i.test(valueLiteral)) {
    return { ok: false, reason: "non_finite_value" };
  }
  if (!NUMERIC_LITERAL_PATTERN.test(valueLiteral)) {
    return { ok: false, reason: "invalid_row" };
  }

  const parsed = Number(valueLiteral);
  if (!Number.isFinite(parsed)) {
    return { ok: false, reason: "non_finite_value" };
  }

  return { ok: true, value: normalizeNegativeZero(parsed) };
}

function createBaseValidation() {
  return {
    status: "ready" as const,
    blockingIssues: [] as Array<{ reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected"; factorId?: string; rowNumbers?: number[] }>,
    advisoryIssues: [] as Array<{ reason: "subgroup_too_small" | "ordered_sequence_invalid" | "sample_count_below_minimum" | "exploratory_only" | "fit_uncertainty" | "unit_mismatch" | "specification_missing" | "non_finite_measurement" | "duplicate_measurement" | "msa_evidence_missing" | "mixed_batch_conditions" | "outlier_candidate" | "invalid_rows_rejected"; factorId?: string; rowNumbers?: number[] }>,
    candidateEligibility: {
      normal: "eligible" as const,
      lognormal: "eligible" as const,
      weibull: "eligible" as const,
      gamma: "eligible" as const,
      uniform: "eligible_with_boundary_warning" as const,
    },
  };
}

function pushUInt32(chunks: Buffer[], value: number): void {
  const bytes = Buffer.allocUnsafe(4);
  bytes.writeUInt32BE(value, 0);
  chunks.push(bytes);
}

function pushString(chunks: Buffer[], value: string): void {
  const bytes = Buffer.from(value, "utf8");
  pushUInt32(chunks, bytes.length);
  chunks.push(bytes);
}

function pushPresenceString(chunks: Buffer[], value: string | undefined): void {
  pushString(chunks, value === undefined ? "0" : "1");
  if (value !== undefined) pushString(chunks, value);
}

function canonicalNumberString(value: number): string {
  return String(normalizeNegativeZero(value));
}

export function hashF7MeasurementDatasetContent(dataset: {
  readonly factorId: string;
  readonly unit: string;
  readonly structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
  readonly sourceReference: string;
  readonly importedAt: string;
  readonly msaStatus: "available" | "not_available" | "unknown";
  readonly missingRowCount: number;
  readonly observations: ReadonlyArray<F7Observation>;
  readonly rejectionSummaries: ReadonlyArray<{ readonly rowNumber: number; readonly reason: RejectionReason }>;
}): string {
  const chunks: Buffer[] = [];

  pushString(chunks, HASH_DOMAIN);
  pushString(chunks, "factorId");
  pushString(chunks, dataset.factorId);
  pushString(chunks, "unit");
  pushString(chunks, dataset.unit);
  pushString(chunks, "structure");
  pushString(chunks, dataset.structure);
  pushString(chunks, "sourceReference");
  pushString(chunks, dataset.sourceReference);
  pushString(chunks, "importedAt");
  pushString(chunks, dataset.importedAt);
  pushString(chunks, "msaStatus");
  pushString(chunks, dataset.msaStatus);
  pushString(chunks, "missingRowCount");
  pushString(chunks, String(dataset.missingRowCount));

  pushString(chunks, "observations");
  pushString(chunks, String(dataset.observations.length));
  for (const observation of dataset.observations) {
    pushString(chunks, "row");
    pushString(chunks, String(observation.originalRow));
    pushString(chunks, "value");
    pushString(chunks, canonicalNumberString(observation.value));
    pushString(chunks, "disposition");
    pushString(chunks, observation.disposition);
    pushString(chunks, "sequence");
    pushPresenceString(chunks, observation.sequence);
    pushString(chunks, "timestamp");
    pushPresenceString(chunks, observation.timestamp);
    pushString(chunks, "subgroup");
    pushPresenceString(chunks, observation.subgroup);
    pushString(chunks, "batch");
    pushPresenceString(chunks, observation.batch);
    if (observation.disposition === "excluded") {
      pushString(chunks, "reason");
      pushString(chunks, observation.reason);
      pushString(chunks, "operatorReference");
      pushString(chunks, observation.operatorReference);
      pushString(chunks, "confirmed");
      pushString(chunks, observation.confirmed ? "1" : "0");
    } else {
      pushString(chunks, "reason");
      pushString(chunks, "0");
      pushString(chunks, "operatorReference");
      pushString(chunks, "0");
      pushString(chunks, "confirmed");
      pushString(chunks, "0");
    }
  }

  pushString(chunks, "rejections");
  pushString(chunks, String(dataset.rejectionSummaries.length));
  for (const rejection of dataset.rejectionSummaries) {
    pushString(chunks, "row");
    pushString(chunks, String(rejection.rowNumber));
    pushString(chunks, "reason");
    pushString(chunks, rejection.reason);
  }

  return createHash("sha256").update(Buffer.concat(chunks)).digest("hex");
}

function buildBlockedResult(factorId: string, rowNumber: number): F7MeasurementPasteResult {
  const blocked = {
    status: "blocked" as const,
    factorId,
    validation: {
      ...createBaseValidation(),
      status: "blocked" as const,
      blockingIssues: [{ reason: "invalid_rows_rejected" as const, factorId, rowNumbers: [rowNumber] }],
    },
  };

  const parsed = f7MeasurementPasteResultSchema.parse(blocked);
  return deepFreeze(structuredClone(parsed));
}

function sanitizeTrimmed(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseF7MeasurementPaste(request: {
  readonly factorId: string;
  readonly unit: string;
  readonly structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
  readonly sourceReference: string;
  readonly importedAt: string;
  readonly msaStatus: "available" | "not_available" | "unknown";
  readonly text: string;
}): F7MeasurementPasteResult {
  const parsedRequest = requestSchema.safeParse(request);
  if (!parsedRequest.success) throw validationError();

  const safeRequest: ParserRequest = {
    ...parsedRequest.data,
    unit: parsedRequest.data.unit.trim(),
  };

  if (Buffer.byteLength(safeRequest.text, "utf8") > MAX_UTF8_BYTES) {
    throw validationError();
  }

  const lines = splitPhysicalLines(safeRequest.text);
  const header = parseHeader(lines);
  if (header.kind === "invalid") {
    return buildBlockedResult(safeRequest.factorId, header.rowNumber);
  }

  const observations: Array<{
    value: number;
    originalRow: number;
    disposition: "included";
    sequence?: string;
    timestamp?: string;
    subgroup?: string;
    batch?: string;
  }> = [];
  const rejectionSummaries: Array<{ rowNumber: number; reason: RejectionReason }> = [];
  let missingRowCount = 0;

  const dataStartIndex = header.kind === "explicit" ? header.rowIndex + 1 : 0;
  const explicitColumns: ReadonlyArray<(typeof ALLOWED_HEADERS)[number]> = header.kind === "explicit"
    ? header.columns
    : ["value"];
  const explicitDelimiter = header.kind === "explicit" && header.columns.length > 1 ? header.delimiter : undefined;

  for (let index = dataStartIndex; index < lines.length; index += 1) {
    const physicalRow = index + 1;
    const line = lines[index] ?? "";

    if (isBlankRow(line)) {
      missingRowCount += 1;
      continue;
    }

    if (explicitDelimiter === undefined) {
      const valueResult = parseInvariantNumber(line.trim());
      if (!valueResult.ok) {
        rejectionSummaries.push({ rowNumber: physicalRow, reason: valueResult.reason });
        continue;
      }
      observations.push({
        value: valueResult.value,
        originalRow: physicalRow,
        disposition: "included",
      });
      continue;
    }

    const cells = line.split(explicitDelimiter);
    if (cells.length !== explicitColumns.length) {
      rejectionSummaries.push({ rowNumber: physicalRow, reason: "invalid_row" });
      continue;
    }

    const mapped: Partial<Record<(typeof ALLOWED_HEADERS)[number], string>> = {};
    explicitColumns.forEach((column, position) => {
      const cell = cells[position];
      if (cell !== undefined) mapped[column] = cell.trim();
    });

    const valueResult = parseInvariantNumber(mapped.value ?? "");
    if (!valueResult.ok) {
      rejectionSummaries.push({ rowNumber: physicalRow, reason: valueResult.reason });
      continue;
    }

    const observation: {
      value: number;
      originalRow: number;
      disposition: "included";
      sequence?: string;
      timestamp?: string;
      subgroup?: string;
      batch?: string;
    } = {
      value: valueResult.value,
      originalRow: physicalRow,
      disposition: "included",
    };

    const sequence = sanitizeTrimmed(mapped.sequence);
    const timestamp = sanitizeTrimmed(mapped.timestamp);
    const subgroup = sanitizeTrimmed(mapped.subgroup);
    const batch = sanitizeTrimmed(mapped.batch);
    if (sequence !== undefined) observation.sequence = sequence;
    if (timestamp !== undefined) observation.timestamp = timestamp;
    if (subgroup !== undefined) observation.subgroup = subgroup;
    if (batch !== undefined) observation.batch = batch;

    const observationValidation = f7ObservationSchema.safeParse(observation);
    if (!observationValidation.success) {
      rejectionSummaries.push({ rowNumber: physicalRow, reason: "invalid_row" });
      continue;
    }

    observations.push(observation);
  }

  const datasetWithoutHash = {
    factorId: safeRequest.factorId,
    unit: safeRequest.unit,
    structure: safeRequest.structure,
    sourceReference: safeRequest.sourceReference,
    importedAt: safeRequest.importedAt,
    msaStatus: safeRequest.msaStatus,
    observations,
    missingRowCount,
    rejectionSummaries,
    originalRowCount: observations.length + missingRowCount + rejectionSummaries.length,
    analyzedCount: observations.length,
  };

  const contentHash = hashF7MeasurementDatasetContent(datasetWithoutHash);

  const result = {
    status: "ready" as const,
    factorId: safeRequest.factorId,
    dataset: {
      ...datasetWithoutHash,
      contentHash,
    },
    validation: createBaseValidation(),
  };

  const parsedResult = f7MeasurementPasteResultSchema.parse(result);
  f7MeasurementDatasetSchema.parse(parsedResult.dataset);
  return deepFreeze(structuredClone(parsedResult));
}
