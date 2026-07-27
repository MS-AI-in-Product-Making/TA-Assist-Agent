import {
  createTypedError,
  identifierQualityCheckRequestSchema,
  identifierQualityCheckResultSchema,
  type IdentifierQualityCheckResult,
} from "@ai-assist/contracts";

const REQUEST_SUMMARY = "Identifier quality check request is invalid.";
const POLICY_SUMMARY = "Identifier quality check input is not permitted.";
const IDENTIFIER_FIELDS = ["drawingNumber", "dimCharacteristicId"] as const;
const CONTROL_OR_NON_PRINTABLE = /[\p{C}]/u;

type IdentifierField = typeof IDENTIFIER_FIELDS[number];
type SignalKind = "identifier_missing" | "identifier_evidence_unavailable" | "identifier_text_invalid" | "dim_id_duplicate";
type Signal = {
  readonly signalKind: SignalKind;
  readonly worksheetName: string;
  readonly tableId: string;
  readonly field: IdentifierField;
  readonly sourceRows: number[];
  readonly reasonCode?: "missing" | "duplicate_mapping" | "invalid_format" | "ambiguous_mapping" | "missing_cached_value";
  readonly normalizedDimId?: string;
};

function requestError(summary: string, code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Provide valid confidential identifier evidence.",
    affectedInputReferences: ["worksheet-analysis-assets", "required-field-check"],
  });
}

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function createResult(value: unknown): IdentifierQualityCheckResult {
  const parsed = identifierQualityCheckResultSchema.safeParse(value);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);
  return deepFreeze(structuredClone(parsed.data));
}

function signalKey(
  signalKind: SignalKind,
  worksheetName: string,
  tableId: string,
  field: IdentifierField,
  discriminator = "",
): string {
  return [signalKind, worksheetName, tableId, field, discriminator].join("|");
}

export function createIdentifierQualityCheck(request: unknown): IdentifierQualityCheckResult {
  let classification: unknown;
  try {
    classification = (request as { inputClassification?: unknown })?.inputClassification;
  } catch {
    throw requestError(REQUEST_SUMMARY);
  }
  if (typeof classification === "string" && classification !== "confidential") {
    throw requestError(POLICY_SUMMARY, "policy_denied");
  }

  const parsed = identifierQualityCheckRequestSchema.safeParse(request);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);
  const input = parsed.data;
  const workbookContentHash = input.worksheetAnalysisAssets.workbook.contentHash;

  if (input.requiredFieldCheck.status !== "readyForNextCheck") {
    return createResult({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash,
      status: "required_fields_not_ready",
      signals: [],
      summary: {
        factorRowsChecked: 0,
        actionableSignalCount: 0,
        identifierMissingCount: 0,
        identifierEvidenceUnavailableCount: 0,
        identifierTextInvalidCount: 0,
        dimIdDuplicateCount: 0,
      },
    });
  }

  const signals = new Map<string, Signal>();
  const dimIdsByTable = new Map<string, Map<string, number[]>>();
  let factorRowsChecked = 0;

  const addSignal = (
    signalKind: SignalKind,
    worksheetName: string,
    tableId: string,
    field: IdentifierField,
    sourceRow: number,
    reasonCode?: Signal["reasonCode"],
    discriminator = "",
  ) => {
    const key = signalKey(signalKind, worksheetName, tableId, field, `${reasonCode ?? ""}|${discriminator}`);
    const signal = signals.get(key);
    if (signal) {
      signal.sourceRows.push(sourceRow);
      return;
    }
    signals.set(key, {
      signalKind,
      worksheetName,
      tableId,
      field,
      sourceRows: [sourceRow],
      ...(reasonCode === undefined ? {} : { reasonCode }),
      ...(signalKind === "dim_id_duplicate" ? { normalizedDimId: discriminator } : {}),
    });
  };

  for (const worksheet of input.worksheetAnalysisAssets.worksheets) {
    for (const table of worksheet.factorTables) {
      const tableDimIds = new Map<string, number[]>();
      dimIdsByTable.set(`${worksheet.worksheetName}|${table.tableId}`, tableDimIds);
      for (const row of table.rows) {
        factorRowsChecked += 1;
        for (const field of IDENTIFIER_FIELDS) {
          const evidence = row.fields[field];
          if (evidence === undefined) {
            addSignal("identifier_missing", worksheet.worksheetName, table.tableId, field, row.sourceRow);
            continue;
          }
          if (evidence.status === "unavailable") {
            addSignal("identifier_evidence_unavailable", worksheet.worksheetName, table.tableId, field, row.sourceRow, evidence.reasonCode);
            continue;
          }

          const normalized = evidence.rawText.trim();
          if (!normalized) {
            addSignal("identifier_missing", worksheet.worksheetName, table.tableId, field, row.sourceRow);
            continue;
          }
          if (CONTROL_OR_NON_PRINTABLE.test(evidence.rawText)) {
            addSignal("identifier_text_invalid", worksheet.worksheetName, table.tableId, field, row.sourceRow);
            continue;
          }
          if (field === "dimCharacteristicId") {
            const sourceRows = tableDimIds.get(normalized) ?? [];
            sourceRows.push(row.sourceRow);
            tableDimIds.set(normalized, sourceRows);
          }
        }
      }
    }
  }

  for (const [tableKey, dimIds] of dimIdsByTable) {
    const [worksheetName, tableId] = tableKey.split("|", 2);
    if (worksheetName === undefined || tableId === undefined) throw requestError(REQUEST_SUMMARY);
    for (const [normalizedDimId, sourceRows] of dimIds) {
      if (sourceRows.length > 1) {
        const firstSourceRow = sourceRows[0];
        if (firstSourceRow === undefined) throw requestError(REQUEST_SUMMARY);
        addSignal("dim_id_duplicate", worksheetName, tableId, "dimCharacteristicId", firstSourceRow, undefined, normalizedDimId);
        const duplicateSignal = signals.get(signalKey("dim_id_duplicate", worksheetName, tableId, "dimCharacteristicId", `|${normalizedDimId}`));
        if (!duplicateSignal) throw requestError(REQUEST_SUMMARY);
        duplicateSignal.sourceRows.push(...sourceRows.slice(1));
      }
    }
  }

  const signalList = [...signals.values()];
  return createResult({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookContentHash,
    status: "completed",
    signals: signalList,
    summary: {
      factorRowsChecked,
      actionableSignalCount: signalList.length,
      identifierMissingCount: signalList.filter((signal) => signal.signalKind === "identifier_missing").length,
      identifierEvidenceUnavailableCount: signalList.filter((signal) => signal.signalKind === "identifier_evidence_unavailable").length,
      identifierTextInvalidCount: signalList.filter((signal) => signal.signalKind === "identifier_text_invalid").length,
      dimIdDuplicateCount: signalList.filter((signal) => signal.signalKind === "dim_id_duplicate").length,
    },
  });
}
