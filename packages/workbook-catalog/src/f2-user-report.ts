import {
  f2ArtifactInputSchema,
  f2UserReportSchema,
  type F2ArtifactInput,
  type F2UserReport,
} from "@ai-assist/contracts";
import { loadKnowledgeBase } from "@ai-assist/knowledge-base";
import { normalizeDistribution } from "./distribution-normalization.js";

const MISSING = "（缺失）";
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
const DISPLAY_FIELDS = [
  "factorName",
  "partName",
  "partNumber",
  "dimCharacteristicId",
  "partCategory",
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "longTermSafetyFactor",
  "standardDeviation",
  "distribution",
] as const;
const NUMERIC_FIELDS = new Set(["nominalValue", "upperTolerance", "lowerTolerance", "longTermSafetyFactor", "standardDeviation"]);

type ArtifactFields = F2ArtifactInput["worksheets"][number]["factorTables"][number]["rows"][number]["fields"];
type ArtifactField = NonNullable<ArtifactFields[keyof ArtifactFields]>;

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function isMissing(fieldName: string, field: ArtifactField | undefined): boolean {
  if (field?.status !== "available" || !field.displayValue.trim()) return true;
  return NUMERIC_FIELDS.has(fieldName) && (typeof field.numericValue !== "number" || !Number.isFinite(field.numericValue));
}

function displayed(field: ArtifactField | undefined): string {
  return field?.status === "available" && field.displayValue.trim() ? field.displayValue : MISSING;
}

function numeric(field: ArtifactField | undefined): number | undefined {
  return field?.status === "available" && typeof field.numericValue === "number" && Number.isFinite(field.numericValue)
    ? field.numericValue
    : undefined;
}

function parseRequest(request: unknown): { artifact: F2ArtifactInput; knowledgeBaseVersion: "v1"; mappingRuleVersion: "v1" } {
  if (request === null || typeof request !== "object") throw new Error("F2 user report request is invalid.");
  const record = request as Record<string, unknown>;
  if (record.knowledgeBaseVersion !== "v1" || record.mappingRuleVersion !== "v1") throw new Error("F2 user report request is invalid.");
  const artifact = f2ArtifactInputSchema.safeParse({
    contractVersion: record.contractVersion,
    inputClassification: record.inputClassification,
    artifactRoot: record.artifactRoot,
    workbook: record.workbook,
    worksheets: record.worksheets,
  });
  if (!artifact.success) throw new Error("F2 user report request is invalid.");
  return { artifact: artifact.data, knowledgeBaseVersion: "v1", mappingRuleVersion: "v1" };
}

export function createF2UserReport(request: unknown): F2UserReport {
  const { artifact, knowledgeBaseVersion, mappingRuleVersion } = parseRequest(request);
  const knowledgeBase = loadKnowledgeBase({ version: knowledgeBaseVersion });
  const eventGroups = new Map<string, { category: string; worksheetName: string; missingFields: Set<"dimCharacteristicId" | "partNumber">; factorRows: number[] }>();

  const worksheets = artifact.worksheets.map((worksheet) => {
    const rows = worksheet.factorTables.flatMap((table) => table.rows.map((row) => {
      const missingRequiredFields = REQUIRED_FIELDS.filter((fieldName) => isMissing(fieldName, row.fields[fieldName]));
      const displayedFields = Object.fromEntries(DISPLAY_FIELDS.map((fieldName) => [fieldName, displayed(row.fields[fieldName])])) as Record<(typeof DISPLAY_FIELDS)[number], string>;
      const sourceCells = Object.fromEntries(Object.entries(row.fields).flatMap(([fieldName, field]) => field.sourceCell ? [[fieldName, field.sourceCell]] : []));
      const missingIdentifiers = (["dimCharacteristicId", "partNumber"] as const).filter((fieldName) => displayedFields[fieldName] === MISSING);
      if (missingIdentifiers.length > 0) {
        const category = displayedFields.partCategory;
        const key = `${category}\u0000${worksheet.worksheetName}`;
        const group = eventGroups.get(key) ?? { category, worksheetName: worksheet.worksheetName, missingFields: new Set(), factorRows: [] };
        for (const fieldName of missingIdentifiers) group.missingFields.add(fieldName);
        group.factorRows.push(row.sourceRow);
        eventGroups.set(key, group);
      }

      let capabilityStatus: "in_library_recommended" | "in_library_tolerance_outside" | "in_library_distribution_differs" | "in_library_tolerance_and_distribution_differ" | "outside_library" | "unable_to_check" = "unable_to_check";
      let recommendation: { toleranceMin: number; toleranceMax: number; unit: "mm"; distribution: "normal" | "uniform" | "triangular" | "trapezoidal" | "elliptical" | "beta" } | undefined;
      let mappingReason: "category_not_defined" | "item_unmatched" | "item_ambiguous" | undefined;
      if (missingRequiredFields.length === 0) {
        const mapping = knowledgeBase.matchCapabilityItem({
          partCategory: displayedFields.partCategory,
          factorName: displayedFields.factorName,
          partName: displayedFields.partName,
        });
        if (mapping.status !== "matched") {
          capabilityStatus = "outside_library";
          mappingReason = mapping.status;
        } else {
          const upperTolerance = numeric(row.fields.upperTolerance)!;
          const lowerTolerance = numeric(row.fields.lowerTolerance)!;
          const totalTolerance = upperTolerance - lowerTolerance;
          const actualDistribution = normalizeDistribution(displayedFields.distribution);
          const toleranceMatches = totalTolerance >= mapping.capabilityEntry.toleranceMin && totalTolerance <= mapping.capabilityEntry.toleranceMax;
          const distributionMatches = actualDistribution === mapping.capabilityEntry.recommendedDistribution;
          recommendation = {
            toleranceMin: mapping.capabilityEntry.toleranceMin,
            toleranceMax: mapping.capabilityEntry.toleranceMax,
            unit: "mm",
            distribution: mapping.capabilityEntry.recommendedDistribution,
          };
          capabilityStatus = toleranceMatches
            ? distributionMatches ? "in_library_recommended" : "in_library_distribution_differs"
            : distributionMatches ? "in_library_tolerance_outside" : "in_library_tolerance_and_distribution_differ";
        }
      }
      return {
        worksheetName: worksheet.worksheetName,
        tableId: table.tableId,
        sourceRow: row.sourceRow,
        displayedFields,
        sourceCells,
        missingRequiredFields,
        capabilityStatus,
        ...(recommendation === undefined ? {} : { recommendation }),
        ...(mappingReason === undefined ? {} : { mappingReason }),
        adoReminderRequested: missingIdentifiers.length > 0,
      };
    }));

    const missingFieldSummary: Array<{ field: (typeof REQUIRED_FIELDS)[number] | "tolerancePathImage"; factorCount: number; sourceRows: number[] }> = REQUIRED_FIELDS.flatMap((fieldName) => {
      const sourceRows = rows.filter((row) => row.missingRequiredFields.includes(fieldName)).map((row) => row.sourceRow);
      return sourceRows.length === 0 ? [] : [{ field: fieldName, factorCount: sourceRows.length, sourceRows }];
    });
    if (worksheet.tolerancePathImage.status === "unavailable") missingFieldSummary.push({ field: "tolerancePathImage", factorCount: 0, sourceRows: [] });
    const blocked = worksheet.tolerancePathImage.status === "unavailable" || rows.some((row) => row.missingRequiredFields.length > 0);
    return {
      worksheetName: worksheet.worksheetName,
      status: blocked ? "blocked" as const : "ready" as const,
      tolerancePathImageStatus: worksheet.tolerancePathImage.status,
      rows,
      missingFieldSummary,
    };
  });

  const allRows = worksheets.flatMap((worksheet) => worksheet.rows);
  const blockedWorksheetCount = worksheets.filter((worksheet) => worksheet.status === "blocked").length;
  const adoEvents = [...eventGroups.values()]
    .sort((left, right) => left.category.localeCompare(right.category) || left.worksheetName.localeCompare(right.worksheetName))
    .map((group) => ({
      eventType: "adoReminderRequested" as const,
      category: group.category,
      worksheetName: group.worksheetName,
      missingFields: (["dimCharacteristicId", "partNumber"] as const).filter((fieldName) => group.missingFields.has(fieldName)),
      factorRows: [...new Set(group.factorRows)].sort((left, right) => left - right),
      workbookContentHash: artifact.workbook.contentHash,
    }));
  const result = f2UserReportSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    status: blockedWorksheetCount === 0 ? "completed" : blockedWorksheetCount === worksheets.length ? "blocked" : "partiallyBlocked",
    workbook: artifact.workbook,
    knowledgeBaseVersion,
    mappingRuleVersion,
    artifactRoot: artifact.artifactRoot,
    worksheets,
    adoEvents,
    summary: {
      worksheetsChecked: worksheets.length,
      blockedWorksheetCount,
      readyWorksheetCount: worksheets.length - blockedWorksheetCount,
      factorRowCount: allRows.length,
      rowsWithRequiredMissing: allRows.filter((row) => row.missingRequiredFields.length > 0).length,
      requiredMissingFieldCount: allRows.reduce((count, row) => count + row.missingRequiredFields.length, 0),
      missingImageWorksheetCount: worksheets.filter((worksheet) => worksheet.tolerancePathImageStatus === "unavailable").length,
      inLibraryCount: allRows.filter((row) => row.capabilityStatus.startsWith("in_library_")).length,
      outsideLibraryCount: allRows.filter((row) => row.capabilityStatus === "outside_library").length,
      unableToCheckCount: allRows.filter((row) => row.capabilityStatus === "unable_to_check").length,
      toleranceDifferenceCount: allRows.filter((row) => row.capabilityStatus === "in_library_tolerance_outside" || row.capabilityStatus === "in_library_tolerance_and_distribution_differ").length,
      distributionDifferenceCount: allRows.filter((row) => row.capabilityStatus === "in_library_distribution_differs" || row.capabilityStatus === "in_library_tolerance_and_distribution_differ").length,
      missingDimIdCount: allRows.filter((row) => row.displayedFields.dimCharacteristicId === MISSING).length,
      missingPartNumberCount: allRows.filter((row) => row.displayedFields.partNumber === MISSING).length,
    },
  });
  return deepFreeze(structuredClone(result));
}