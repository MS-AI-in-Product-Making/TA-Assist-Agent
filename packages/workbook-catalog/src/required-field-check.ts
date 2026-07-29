import {
  createTypedError,
  requiredFieldCheckRequestSchema,
  requiredFieldCheckResultSchema,
  type RequiredFieldCheckResult,
} from "@ai-assist/contracts";

const REQUEST_SUMMARY = "Required-field check request is invalid.";
const POLICY_SUMMARY = "Required-field check input is not permitted.";

const REQUIRED_FIELDS = [
  "factorName",
  "partName",
  "partCategory",
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "longTermSafetyFactor",
  "standardDeviation",
  "distribution",
] as const;
const OPTIONAL_IDENTIFIER_FIELDS = ["drawingNumber", "dimCharacteristicId"] as const;
const NUMERIC_REQUIRED_FIELDS = new Set<string>([
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "longTermSafetyFactor",
  "standardDeviation",
]);
const UNAVAILABLE_REASONS = new Set([
  "missing",
  "duplicate_mapping",
  "invalid_format",
  "ambiguous_mapping",
  "missing_cached_value",
]);

function requestError(summary: string, code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Provide valid confidential worksheet-analysis assets.",
    affectedInputReferences: ["worksheet-analysis-assets"],
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

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function sourceCell(value: Record<string, unknown>): { readonly sourceCell?: string } {
  return typeof value.sourceCell === "string" ? { sourceCell: value.sourceCell } : {};
}

function unavailableReason(value: Record<string, unknown>): string | undefined {
  return typeof value.reasonCode === "string" && UNAVAILABLE_REASONS.has(value.reasonCode)
    ? value.reasonCode
    : undefined;
}

function fieldIssue(
  worksheetName: string,
  tableId: string,
  sourceRow: number,
  field: string,
  value: unknown,
  requireNumeric: boolean,
) {
  const fieldValue = record(value);
  const issue = (reasonCode: string, source = fieldValue) => ({
    issueCode: "required_field_unavailable" as const,
    worksheetName,
    tableId,
    sourceRow,
    field,
    reasonCode,
    ...(source ? sourceCell(source) : {}),
  });
  if (!fieldValue) return issue("missing", undefined);
  if (fieldValue.status === "unavailable") return issue(unavailableReason(fieldValue) ?? "missing");
  if (fieldValue.status !== "available" || typeof fieldValue.rawText !== "string" || !fieldValue.rawText.trim()) {
    return issue("missing");
  }
  if (requireNumeric && (typeof fieldValue.numericValue !== "number" || !Number.isFinite(fieldValue.numericValue))) {
    return issue("invalid_format");
  }
  return undefined;
}

function identifierIssue(
  worksheetName: string,
  tableId: string,
  sourceRow: number,
  field: string,
  value: unknown,
) {
  const fieldValue = record(value);
  const issue = (reasonCode: string, source = fieldValue) => ({
    issueCode: "optional_identifier_unavailable" as const,
    worksheetName,
    tableId,
    sourceRow,
    field,
    reasonCode,
    ...(source ? sourceCell(source) : {}),
  });
  if (!fieldValue) return issue("missing", undefined);
  if (fieldValue.status === "unavailable") return issue(unavailableReason(fieldValue) ?? "missing");
  return fieldValue.status === "available" && typeof fieldValue.rawText === "string" && fieldValue.rawText.trim()
    ? undefined
    : issue("missing");
}

export function createRequiredFieldCheck(request: unknown): RequiredFieldCheckResult {
  let classification: unknown;
  try {
    classification = (request as { inputClassification?: unknown })?.inputClassification;
  } catch {
    throw requestError(REQUEST_SUMMARY);
  }
  if (typeof classification === "string" && classification !== "confidential") {
    throw requestError(POLICY_SUMMARY, "policy_denied");
  }

  const parsed = requiredFieldCheckRequestSchema.safeParse(request);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);

  const blockingIssues: unknown[] = [];
  const advisoryIssues: unknown[] = [];
  let factorTablesChecked = 0;
  let factorRowsChecked = 0;

  for (const worksheet of parsed.data.worksheetAnalysisAssets.worksheets) {
    for (const table of worksheet.factorTables) {
      factorTablesChecked += 1;
      if (table.rows.length === 0) {
        blockingIssues.push({
          issueCode: "factor_table_has_no_rows",
          worksheetName: worksheet.worksheetName,
          tableId: table.tableId,
        });
        continue;
      }
      for (const row of table.rows) {
        factorRowsChecked += 1;
        for (const field of REQUIRED_FIELDS) {
          const issue = fieldIssue(
            worksheet.worksheetName,
            table.tableId,
            row.sourceRow,
            field,
            row.fields[field],
            NUMERIC_REQUIRED_FIELDS.has(field),
          );
          if (issue) blockingIssues.push(issue);
        }
        for (const field of OPTIONAL_IDENTIFIER_FIELDS) {
          const issue = identifierIssue(worksheet.worksheetName, table.tableId, row.sourceRow, field, row.fields[field]);
          if (issue) advisoryIssues.push(issue);
        }
      }
    }
  }

  const result = requiredFieldCheckResultSchema.safeParse({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookContentHash: parsed.data.worksheetAnalysisAssets.workbook.contentHash,
    status: blockingIssues.length === 0 ? "readyForNextCheck" : "blocked",
    blockingIssues,
    advisoryIssues,
    summary: {
      worksheetsChecked: parsed.data.worksheetAnalysisAssets.worksheets.length,
      factorTablesChecked,
      factorRowsChecked,
      blockingIssueCount: blockingIssues.length,
      advisoryIssueCount: advisoryIssues.length,
    },
  });
  if (!result.success) throw requestError(REQUEST_SUMMARY);
  return deepFreeze(structuredClone(result.data));
}