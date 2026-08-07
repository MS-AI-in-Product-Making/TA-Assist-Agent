import {
  createTypedError,
  f2InitialWorkflowRequestSchema,
  f2InitialWorkflowResultSchema,
  type F2InitialWorkflowResult,
  type WorksheetAnalysisAssetsResult,
} from "@ai-assist/contracts";
import { loadKnowledgeBase } from "@ai-assist/knowledge-base";
import { normalizeDistribution } from "./distribution-normalization.js";
import { scanIdentifierQuality } from "./identifier-quality-check.js";
import { createRequiredFieldCheck } from "./required-field-check.js";

const REQUEST_SUMMARY = "F2 Initial workflow request is invalid.";
const POLICY_SUMMARY = "F2 Initial workflow input is not permitted.";

type WorkflowErrorCode = "validation_error" | "policy_denied";

const trustedWorkflowErrorScopes: WeakMap<object, WorkflowErrorCode>[] = [];

function createSafeWorkflowError(code: WorkflowErrorCode): Error {
  const summary = code === "policy_denied" ? POLICY_SUMMARY : REQUEST_SUMMARY;
  const typed = createTypedError({
    code,
    summary,
    suggestedAction: "Provide valid confidential F1 worksheet-analysis assets.",
    affectedInputReferences: ["worksheet-analysis-assets", "knowledge-base"],
  });
  return Object.assign(new Error(typed.summary), {
    code: typed.code,
    runId: typed.runId,
    summary: typed.summary,
    retryable: typed.retryable,
    suggestedAction: typed.suggestedAction,
    affectedInputReferences: [...typed.affectedInputReferences],
  });
}

function workflowError(summary: string, code: WorkflowErrorCode = "validation_error"): Error {
  const trusted = createSafeWorkflowError(code);
  trustedWorkflowErrorScopes.at(-1)?.set(trusted, code);
  return trusted;
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

function availableField(fields: Record<string, unknown>, field: string): Record<string, unknown> {
  const value = record(fields[field]);
  if (value?.status !== "available" || typeof value.rawText !== "string" || !value.rawText.trim() || typeof value.sourceCell !== "string") {
    throw workflowError(REQUEST_SUMMARY);
  }
  return value;
}

function availableText(fields: Record<string, unknown>, field: string): string {
  return (availableField(fields, field).rawText as string).trim();
}

function availableNumber(fields: Record<string, unknown>, field: string): number {
  const value = availableField(fields, field).numericValue;
  if (typeof value !== "number" || !Number.isFinite(value)) throw workflowError(REQUEST_SUMMARY);
  return value;
}

function availableSourceCell(fields: Record<string, unknown>, field: string): string {
  return availableField(fields, field).sourceCell as string;
}

function oneWorksheetAssets(
  assets: WorksheetAnalysisAssetsResult,
  worksheet: WorksheetAnalysisAssetsResult["worksheets"][number],
): WorksheetAnalysisAssetsResult {
  return { ...assets, worksheets: [worksheet] };
}

function imageIssue(worksheet: WorksheetAnalysisAssetsResult["worksheets"][number]): Record<string, unknown> | undefined {
  const evidence = worksheet.tolerancePathImage;
  if (evidence?.status === "available") return undefined;
  const reasonCode = evidence === undefined || evidence.reasonCode === "worksheet_unavailable"
    ? "evidence_not_produced"
    : evidence.reasonCode;
  return {
    issueCode: "cross_section_image_unavailable",
    worksheetName: worksheet.worksheetName,
    reasonCode,
    ...(evidence?.labelSourceCell === undefined ? {} : { sourceCell: evidence.labelSourceCell }),
  };
}

export function createF2InitialWorkflow(request: unknown): F2InitialWorkflowResult {
  const trustedErrors = new WeakMap<object, WorkflowErrorCode>();
  trustedWorkflowErrorScopes.push(trustedErrors);
  try {
    const classification = (request as { inputClassification?: unknown })?.inputClassification;
    if (typeof classification === "string" && classification !== "confidential") {
      throw workflowError(POLICY_SUMMARY, "policy_denied");
    }

    const parsed = f2InitialWorkflowRequestSchema.safeParse(request);
    if (!parsed.success) throw workflowError(REQUEST_SUMMARY);
    const input = parsed.data;
    const knowledgeBase = loadKnowledgeBase({ version: input.knowledgeBaseVersion });
    const worksheetResults: Array<Record<string, unknown>> = [];

    for (const worksheet of input.worksheetAnalysisAssets.worksheets) {
      const worksheetAssets = oneWorksheetAssets(input.worksheetAnalysisAssets, worksheet);
      const requiredCheck = createRequiredFieldCheck({
        contractVersion: "v1",
        inputClassification: "confidential",
        worksheetAnalysisAssets: worksheetAssets,
      });
      const blockingIssues: Array<Record<string, unknown>> = requiredCheck.blockingIssues.map((issue) => ({ ...issue }));
      const crossSectionIssue = imageIssue(worksheet);
      if (crossSectionIssue) blockingIssues.push(crossSectionIssue);

      const governanceSignals = scanIdentifierQuality(worksheetAssets).flatMap((signal) => signal.sources.map((source) => ({
        signalKind: signal.signalKind,
        worksheetName: signal.worksheetName,
        tableId: signal.tableId,
        field: signal.field,
        sourceRow: source.sourceRow,
        ...(source.sourceCell === undefined ? {} : { sourceCell: source.sourceCell }),
        ...(signal.reasonCode === undefined ? {} : { reasonCode: signal.reasonCode }),
        ...(signal.normalizedDimId === undefined ? {} : { normalizedDimId: signal.normalizedDimId }),
      })));
      const mappingRecords: Array<Record<string, unknown>> = [];
      const capabilityChecks: Array<Record<string, unknown>> = [];

      for (const table of worksheet.factorTables) {
        for (const row of table.rows) {
          const rowHasRequiredIssue = requiredCheck.blockingIssues.some(
            (issue) => issue.issueCode === "required_field_unavailable" && issue.tableId === table.tableId && issue.sourceRow === row.sourceRow,
          );
          if (rowHasRequiredIssue) continue;
          const fields = row.fields as Record<string, unknown>;
          const partCategory = availableText(fields, "partCategory");
          const factorName = availableText(fields, "factorName");
          const partName = availableText(fields, "partName");
          const mappingSource = {
            worksheetName: worksheet.worksheetName,
            tableId: table.tableId,
            sourceRow: row.sourceRow,
            knowledgeBaseVersion: input.knowledgeBaseVersion,
            mappingRuleVersion: input.mappingRuleVersion,
            partCategory,
            factorName,
            partName,
            sourceCells: {
              partCategory: availableSourceCell(fields, "partCategory"),
              factorName: availableSourceCell(fields, "factorName"),
              partName: availableSourceCell(fields, "partName"),
            },
          };
          const mapping = knowledgeBase.matchCapabilityItem({ partCategory, factorName, partName });
          if (mapping.status === "category_not_defined") {
            mappingRecords.push({ ...mappingSource, status: mapping.status });
            continue;
          }
          if (mapping.status === "item_unmatched") {
            mappingRecords.push({ ...mappingSource, status: mapping.status, canonicalPartCategory: mapping.canonicalPartCategory });
            continue;
          }
          if (mapping.status === "item_ambiguous") {
            mappingRecords.push({ ...mappingSource, status: mapping.status, canonicalPartCategory: mapping.canonicalPartCategory, candidates: mapping.candidates });
            continue;
          }

          const upperTolerance = availableNumber(fields, "upperTolerance");
          const lowerTolerance = availableNumber(fields, "lowerTolerance");
          const totalTolerance = upperTolerance - lowerTolerance;
          if (!Number.isFinite(totalTolerance) || totalTolerance < 0) throw workflowError(REQUEST_SUMMARY);
          const actualDistribution = normalizeDistribution(availableText(fields, "distribution"));
          if (actualDistribution === undefined) throw workflowError(REQUEST_SUMMARY);
          const capability = mapping.capabilityEntry;
          const toleranceMatches = totalTolerance >= capability.toleranceMin && totalTolerance <= capability.toleranceMax;
          const distributionMatches = actualDistribution === capability.recommendedDistribution;
          const evidence = {
            worksheetName: worksheet.worksheetName,
            tableId: table.tableId,
            sourceRow: row.sourceRow,
            knowledgeBaseVersion: input.knowledgeBaseVersion,
            mappingRuleVersion: input.mappingRuleVersion,
            itemId: mapping.candidate.itemId,
            capabilityEntryId: mapping.candidate.capabilityEntryId,
            totalTolerance,
            unit: "mm",
            actualDistribution,
            recommendedDistribution: capability.recommendedDistribution,
            hitKeywords: mapping.candidate.hitKeywords,
            sourceCells: {
              upperTolerance: availableSourceCell(fields, "upperTolerance"),
              lowerTolerance: availableSourceCell(fields, "lowerTolerance"),
              distribution: availableSourceCell(fields, "distribution"),
            },
          };
          const status = toleranceMatches
            ? distributionMatches ? "tolerance_and_distribution_match" : "distribution_mismatch"
            : distributionMatches ? "tolerance_out_of_range" : "tolerance_and_distribution_mismatch";
          capabilityChecks.push({ ...evidence, status });
          if (!toleranceMatches) blockingIssues.push({ ...evidence, issueCode: "tolerance_out_of_range" });
          if (!distributionMatches) blockingIssues.push({ ...evidence, issueCode: "distribution_mismatch" });
        }
      }

      worksheetResults.push({
        worksheetName: worksheet.worksheetName,
        status: blockingIssues.length === 0 ? "readyForNextFeature" : "blocked",
        blockingIssues,
        mappingRecords,
        capabilityChecks,
        governanceSignals,
      });
    }

    const blockedWorksheetCount = worksheetResults.filter((worksheet) => worksheet.status === "blocked").length;
    const readyForNextFeatureCount = worksheetResults.length - blockedWorksheetCount;
    const result = f2InitialWorkflowResultSchema.safeParse({
      contractVersion: "v1",
      inputClassification: "confidential",
      knowledgeBaseVersion: input.knowledgeBaseVersion,
      mappingRuleVersion: input.mappingRuleVersion,
      workbookContentHash: input.worksheetAnalysisAssets.workbook.contentHash,
      toleranceUnitAssumption: input.toleranceUnitAssumption,
      status: blockedWorksheetCount === 0 ? "completed" : readyForNextFeatureCount === 0 ? "blocked" : "partiallyBlocked",
      worksheets: worksheetResults,
      summary: {
        worksheetsChecked: worksheetResults.length,
        readyForNextFeatureCount,
        blockedWorksheetCount,
        blockingIssueCount: worksheetResults.reduce((count, worksheet) => count + (worksheet.blockingIssues as unknown[]).length, 0),
        mappingRecordCount: worksheetResults.reduce((count, worksheet) => count + (worksheet.mappingRecords as unknown[]).length, 0),
        capabilityCheckCount: worksheetResults.reduce((count, worksheet) => count + (worksheet.capabilityChecks as unknown[]).length, 0),
        governanceSignalCount: worksheetResults.reduce((count, worksheet) => count + (worksheet.governanceSignals as unknown[]).length, 0),
      },
    });
    if (!result.success) throw workflowError(REQUEST_SUMMARY);
    return deepFreeze(structuredClone(result.data));
  } catch (error) {
    if (typeof error === "object" && error !== null) {
      const trustedCode = trustedErrors.get(error);
      if (trustedCode !== undefined) {
        throw createSafeWorkflowError(trustedCode);
      }
    }
    throw createSafeWorkflowError("validation_error");
  } finally {
    trustedWorkflowErrorScopes.pop();
  }
}