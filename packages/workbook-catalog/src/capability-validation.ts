import {
  capabilityValidationRequestSchema,
  capabilityValidationResultSchema,
  createTypedError,
  type CapabilityValidationResult,
} from "@ai-assist/contracts";
import { loadKnowledgeBase } from "@ai-assist/knowledge-base";

const REQUEST_SUMMARY = "Capability validation request is invalid.";
const POLICY_SUMMARY = "Capability validation input is not permitted.";
const DISTRIBUTION_ALIASES = new Map<string, string>([
  ["normal", "normal"], ["gaussian", "normal"], ["正态分布", "normal"],
  ["uniform", "uniform"], ["均匀分布", "uniform"],
  ["triangular", "triangular"], ["三角分布", "triangular"],
  ["trapezoidal", "trapezoidal"], ["梯形分布", "trapezoidal"],
  ["elliptical", "elliptical"], ["椭圆分布", "elliptical"],
  ["beta", "beta"], ["贝塔分布", "beta"],
]);

function requestError(summary: string, code: "validation_error" | "policy_denied" = "validation_error"): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Provide valid confidential capability-validation evidence.",
    affectedInputReferences: ["capability-validation"],
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

function availableText(fields: Record<string, unknown>, field: string): string | undefined {
  const value = record(fields[field]);
  if (value?.status !== "available" || typeof value.rawText !== "string") return undefined;
  const normalized = value.rawText.trim();
  return normalized || undefined;
}

function availableNumber(fields: Record<string, unknown>, field: string): number | undefined {
  const value = record(fields[field]);
  return value?.status === "available" && typeof value.numericValue === "number" && Number.isFinite(value.numericValue)
    ? value.numericValue
    : undefined;
}

function normalizeDistribution(value: string | undefined): string | undefined {
  return value === undefined ? undefined : DISTRIBUTION_ALIASES.get(value.trim().toLowerCase());
}

function createResult(value: unknown): CapabilityValidationResult {
  const parsed = capabilityValidationResultSchema.safeParse(value);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);
  return deepFreeze(structuredClone(parsed.data));
}

function emptySummary() {
  return {
    factorRowsChecked: 0,
    inLibraryCount: 0,
    outOfLibraryCount: 0,
    toleranceUnableToValidateCount: 0,
    distributionMatchCount: 0,
    distributionMismatchCount: 0,
    distributionUnableToValidateCount: 0,
    distributionNotApplicableCount: 0,
  };
}

function summaryFor(rows: readonly Record<string, unknown>[]) {
  const count = (key: "tolerance" | "distribution", status: string) => rows.filter((row) => record(row[key])?.status === status).length;
  return {
    factorRowsChecked: rows.length,
    inLibraryCount: count("tolerance", "in_library"),
    outOfLibraryCount: count("tolerance", "out_of_library"),
    toleranceUnableToValidateCount: count("tolerance", "unable_to_validate"),
    distributionMatchCount: count("distribution", "matches_recommendation"),
    distributionMismatchCount: count("distribution", "distribution_mismatch"),
    distributionUnableToValidateCount: count("distribution", "unable_to_validate"),
    distributionNotApplicableCount: count("distribution", "not_applicable"),
  };
}

export function createCapabilityValidation(request: unknown): CapabilityValidationResult {
  let classification: unknown;
  try {
    classification = (request as { inputClassification?: unknown })?.inputClassification;
  } catch {
    throw requestError(REQUEST_SUMMARY);
  }
  if (typeof classification === "string" && classification !== "confidential") {
    throw requestError(POLICY_SUMMARY, "policy_denied");
  }

  const parsed = capabilityValidationRequestSchema.safeParse(request);
  if (!parsed.success) throw requestError(REQUEST_SUMMARY);
  const input = parsed.data;
  if (input.requiredFieldCheck.workbookContentHash !== input.worksheetAnalysisAssets.workbook.contentHash) {
    throw requestError(REQUEST_SUMMARY);
  }
  if (input.requiredFieldCheck.status === "blocked") {
    return createResult({
      contractVersion: "v1",
      inputClassification: "confidential",
      knowledgeBaseVersion: input.knowledgeBaseVersion,
      workbookContentHash: input.worksheetAnalysisAssets.workbook.contentHash,
      status: "required_fields_not_ready",
      rows: [],
      summary: emptySummary(),
    });
  }

  const knowledgeBase = loadKnowledgeBase({ version: input.knowledgeBaseVersion });
  const rows: Record<string, unknown>[] = [];

  for (const worksheet of input.worksheetAnalysisAssets.worksheets) {
    for (const table of worksheet.factorTables) {
      for (const row of table.rows) {
        const fields = row.fields as Record<string, unknown>;
        const factorName = availableText(fields, "factorName");
        const partCategory = availableText(fields, "partCategory");
        if (!factorName || !partCategory) throw requestError(REQUEST_SUMMARY);

        const upperTolerance = availableNumber(fields, "upperTolerance");
        const lowerTolerance = availableNumber(fields, "lowerTolerance");
        const unit = availableText(fields, "unit")?.toLowerCase();
        const totalTolerance = upperTolerance === undefined || lowerTolerance === undefined
          ? undefined
          : upperTolerance - lowerTolerance;
        let tolerance: Record<string, unknown>;
        let recommendedDistribution: string | undefined;

        if (unit !== "mm") {
          tolerance = { status: "unable_to_validate", reasonCode: "unit_unavailable" };
        } else if (totalTolerance === undefined || !Number.isFinite(totalTolerance) || totalTolerance < 0) {
          tolerance = { status: "unable_to_validate", reasonCode: "invalid_tolerance" };
        } else {
          const capability = knowledgeBase.findCapability({ partCategory, tolerance: totalTolerance, unit: "mm" });
          if (capability.status === "unknown") {
            tolerance = { status: "out_of_library", totalTolerance, unit: "mm" };
          } else {
            recommendedDistribution = capability.entry.recommendedDistribution;
            tolerance = {
              status: "in_library",
              totalTolerance,
              unit: "mm",
              capabilityEntryId: capability.entry.entryId,
              capabilityTier: capability.entry.capabilityTier,
            };
          }
        }

        const actualDistribution = normalizeDistribution(availableText(fields, "distribution"));
        const distribution = recommendedDistribution === undefined
          ? { status: "not_applicable" }
          : actualDistribution === undefined
            ? { status: "unable_to_validate", reasonCode: "distribution_unavailable" }
            : actualDistribution === recommendedDistribution
              ? { status: "matches_recommendation", actual: actualDistribution, recommended: recommendedDistribution }
              : { status: "distribution_mismatch", actual: actualDistribution, recommended: recommendedDistribution };

        rows.push({
          worksheetName: worksheet.worksheetName,
          tableId: table.tableId,
          sourceRow: row.sourceRow,
          factorName,
          tolerance,
          distribution,
        });
      }
    }
  }

  return createResult({
    contractVersion: "v1",
    inputClassification: "confidential",
    knowledgeBaseVersion: input.knowledgeBaseVersion,
    workbookContentHash: input.worksheetAnalysisAssets.workbook.contentHash,
    status: "completed",
    rows,
    summary: summaryFor(rows),
  });
}