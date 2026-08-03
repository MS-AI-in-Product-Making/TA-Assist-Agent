import {
  createTypedError,
  identifierQualityCheckRequestSchema,
  identifierQualityCheckResultSchema,
  type IdentifierQualityCheckResult,
  type WorksheetAnalysisAssetsResult,
} from "@ai-assist/contracts";

const REQUEST_SUMMARY = "Identifier quality check request is invalid.";
const POLICY_SUMMARY = "Identifier quality check input is not permitted.";
const IDENTIFIER_FIELDS = ["drawingNumber", "dimCharacteristicId"] as const;
const CONTROL_OR_NON_PRINTABLE = /[\p{C}]/u;

type IdentifierField = typeof IDENTIFIER_FIELDS[number];
type SignalKind = "identifier_missing" | "identifier_evidence_unavailable" | "identifier_text_invalid" | "dim_id_duplicate";
export type F2IdentifierGovernanceSignal = {
  readonly signalKind: SignalKind;
  readonly worksheetName: string;
  readonly tableId: string;
  readonly field: IdentifierField;
  readonly sources: readonly {
    readonly sourceRow: number;
    readonly sourceCell?: string;
  }[];
  readonly reasonCode?: "missing" | "duplicate_mapping" | "invalid_format" | "ambiguous_mapping" | "missing_cached_value";
  readonly normalizedDimId?: string;
};

type MutableSignal = Omit<F2IdentifierGovernanceSignal, "sources"> & {
  sources: Array<{ sourceRow: number; sourceCell?: string }>;
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

export function scanIdentifierQuality(
  assets: WorksheetAnalysisAssetsResult,
): readonly F2IdentifierGovernanceSignal[] {
  const signals = new Map<string, MutableSignal>();
  const dimIdsByTable = new Map<string, Map<string, Array<{ sourceRow: number; sourceCell?: string }>>>();

  const addSignal = (
    signalKind: SignalKind,
    worksheetName: string,
    tableId: string,
    field: IdentifierField,
    source: { sourceRow: number; sourceCell?: string },
    reasonCode?: F2IdentifierGovernanceSignal["reasonCode"],
    discriminator = "",
  ) => {
    const key = signalKey(signalKind, worksheetName, tableId, field, `${reasonCode ?? ""}|${discriminator}`);
    const signal = signals.get(key);
    if (signal) {
      signal.sources.push(source);
      return;
    }
    signals.set(key, {
      signalKind,
      worksheetName,
      tableId,
      field,
      sources: [source],
      ...(reasonCode === undefined ? {} : { reasonCode }),
      ...(signalKind === "dim_id_duplicate" ? { normalizedDimId: discriminator } : {}),
    });
  };

  for (const worksheet of assets.worksheets) {
    for (const table of worksheet.factorTables) {
      const tableDimIds = new Map<string, Array<{ sourceRow: number; sourceCell?: string }>>();
      dimIdsByTable.set(`${worksheet.worksheetName}|${table.tableId}`, tableDimIds);
      for (const row of table.rows) {
        for (const field of IDENTIFIER_FIELDS) {
          const evidence = row.fields[field];
          if (evidence === undefined) {
            addSignal("identifier_missing", worksheet.worksheetName, table.tableId, field, { sourceRow: row.sourceRow });
            continue;
          }
          const source = { sourceRow: row.sourceRow, ...(evidence.sourceCell === undefined ? {} : { sourceCell: evidence.sourceCell }) };
          if (evidence.status === "unavailable") {
            addSignal("identifier_evidence_unavailable", worksheet.worksheetName, table.tableId, field, source, evidence.reasonCode);
            continue;
          }

          const normalized = evidence.rawText.trim();
          if (!normalized) {
            addSignal("identifier_missing", worksheet.worksheetName, table.tableId, field, source);
            continue;
          }
          if (CONTROL_OR_NON_PRINTABLE.test(evidence.rawText)) {
            addSignal("identifier_text_invalid", worksheet.worksheetName, table.tableId, field, source);
            continue;
          }
          if (field === "dimCharacteristicId") {
            const sources = tableDimIds.get(normalized) ?? [];
            sources.push(source);
            tableDimIds.set(normalized, sources);
          }
        }
      }
    }
  }

  for (const [tableKey, dimIds] of dimIdsByTable) {
    const [worksheetName, tableId] = tableKey.split("|", 2);
    if (worksheetName === undefined || tableId === undefined) throw requestError(REQUEST_SUMMARY);
    for (const [normalizedDimId, sources] of dimIds) {
      if (sources.length > 1) {
        const firstSource = sources[0];
        if (firstSource === undefined) throw requestError(REQUEST_SUMMARY);
        addSignal("dim_id_duplicate", worksheetName, tableId, "dimCharacteristicId", firstSource, undefined, normalizedDimId);
        const duplicateSignal = signals.get(signalKey("dim_id_duplicate", worksheetName, tableId, "dimCharacteristicId", `|${normalizedDimId}`));
        if (!duplicateSignal) throw requestError(REQUEST_SUMMARY);
        duplicateSignal.sources.push(...sources.slice(1));
      }
    }
  }

  return deepFreeze(structuredClone([...signals.values()]));
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

  const coreSignals = scanIdentifierQuality(input.worksheetAnalysisAssets);
  const signalList = coreSignals.map((signal) => ({
    signalKind: signal.signalKind,
    worksheetName: signal.worksheetName,
    tableId: signal.tableId,
    field: signal.field,
    sourceRows: signal.sources.map((source) => source.sourceRow),
    ...(signal.reasonCode === undefined ? {} : { reasonCode: signal.reasonCode }),
    ...(signal.normalizedDimId === undefined ? {} : { normalizedDimId: signal.normalizedDimId }),
  }));
  const factorRowsChecked = input.worksheetAnalysisAssets.worksheets.reduce(
    (worksheetCount, worksheet) => worksheetCount + worksheet.factorTables.reduce((tableCount, table) => tableCount + table.rows.length, 0),
    0,
  );
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
