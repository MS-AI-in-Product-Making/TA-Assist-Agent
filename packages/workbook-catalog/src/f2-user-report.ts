import {
  f2ArtifactInputSchema,
  f2UserReportSchema,
  type F2ArtifactInput,
  type F2UserReport,
} from "@ai-assist/contracts";
import { createF0CapabilityRouter, type F0CapabilityAssessment } from "./f0-capability-router.js";

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
const ACTUAL_FIELD_BY_REQUIRED = {
  factorName: "factorName",
  partName: "partName",
  partCategory: "partCategory",
  nominalValue: "nominalValue",
  upperTolerance: "upperTolerance",
  lowerTolerance: "lowerTolerance",
  longTermSafetyFactor: "longTermSafetyFactor",
  standardDeviation: "sigmaLevel",
  distribution: "distribution",
} as const;
const NUMERIC_REQUIRED_FIELDS = new Set(["nominalValue", "upperTolerance", "lowerTolerance", "longTermSafetyFactor", "standardDeviation"]);

type ArtifactFields = F2ArtifactInput["worksheets"][number]["factorTables"][number]["rows"][number]["fields"];
type ArtifactField = NonNullable<ArtifactFields[keyof ArtifactFields]>;
type ActualFields = F2ArtifactInput["worksheets"][number]["factorTables"][number]["rows"][number]["actualFields"];

function deepFreeze<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    Object.freeze(value);
  }
  return value;
}

function isMissing(fieldName: (typeof REQUIRED_FIELDS)[number], actualFields: ActualFields): boolean {
  const value = actualFields[ACTUAL_FIELD_BY_REQUIRED[fieldName]];
  if (NUMERIC_REQUIRED_FIELDS.has(fieldName)) return typeof value !== "number" || !Number.isFinite(value);
  return typeof value !== "string" || value.trim().length === 0;
}

function text(value: string | number | null): string | undefined {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function hasAvailableValue(field: ArtifactField | undefined): boolean {
  if (field?.status !== "available") return false;
  return typeof field.actualValue === "number" || field.actualValue.trim().length > 0;
}

function imageTarget(worksheet: F2ArtifactInput["worksheets"][number]): { relativePath: string; contentHash: string } | undefined {
  if (worksheet.tolerancePathImage.status !== "available") return undefined;
  const extension = worksheet.tolerancePathImage.mediaType === "image/png" ? "png" : "jpg";
  return {
    relativePath: `images/${worksheet.tolerancePathImage.contentHash}.${extension}`,
    contentHash: worksheet.tolerancePathImage.contentHash,
  };
}

function parseRequest(request: unknown): { artifact: F2ArtifactInput; knowledgeBaseVersions: readonly ["v1", "internal-v1"]; mappingRuleVersion: "v1" } {
  if (request === null || typeof request !== "object") throw new Error("F2 user report request is invalid.");
  const record = request as Record<string, unknown>;
  if (!Array.isArray(record.knowledgeBaseVersions) || record.knowledgeBaseVersions.length !== 2 || record.knowledgeBaseVersions[0] !== "v1" || record.knowledgeBaseVersions[1] !== "internal-v1" || record.mappingRuleVersion !== "v1") throw new Error("F2 user report request is invalid.");
  const artifact = f2ArtifactInputSchema.safeParse({
    contractVersion: record.contractVersion,
    inputClassification: record.inputClassification,
    artifactRoot: record.artifactRoot,
    workbook: record.workbook,
    worksheets: record.worksheets,
  });
  if (!artifact.success) throw new Error("F2 user report request is invalid.");
  return { artifact: artifact.data, knowledgeBaseVersions: ["v1", "internal-v1"], mappingRuleVersion: "v1" };
}

export function createF2UserReport(
  request: unknown,
  dependencies: { readonly capabilityRouter: { assess(row: { readonly partCategory: string; readonly factorName: string; readonly partName: string; readonly nominalValue: number; readonly upperTolerance: number; readonly lowerTolerance: number; readonly distribution: string }): F0CapabilityAssessment } } = { capabilityRouter: createF0CapabilityRouter() },
): F2UserReport {
  const { artifact, knowledgeBaseVersions, mappingRuleVersion } = parseRequest(request);
  const eventGroups = new Map<string, { category: string; worksheetName: string; missingFields: Set<"dimCharacteristicId" | "partNumber">; factorRows: number[] }>();

  const worksheets = artifact.worksheets.map((worksheet) => {
    const worksheetImageTarget = imageTarget(worksheet);
    const rows = worksheet.factorTables.flatMap((table) => table.rows.map((row) => {
      const missingRequiredFields = REQUIRED_FIELDS.filter((fieldName) => isMissing(fieldName, row.actualFields));
      const sourceCells = Object.fromEntries(Object.entries(row.fields).flatMap(([fieldName, field]) => field.sourceCell ? [[fieldName, field.sourceCell]] : []));
      const missingIdentifiers = (["dimCharacteristicId", "partNumber"] as const).filter((fieldName) => fieldName === "dimCharacteristicId"
        ? text(row.actualFields.dimCharacteristicId) === undefined
        : !hasAvailableValue(row.fields.partNumber));
      if (missingIdentifiers.length > 0) {
        const category = text(row.actualFields.partCategory) ?? MISSING;
        const key = `${category}\u0000${worksheet.worksheetName}`;
        const group = eventGroups.get(key) ?? { category, worksheetName: worksheet.worksheetName, missingFields: new Set(), factorRows: [] };
        for (const fieldName of missingIdentifiers) group.missingFields.add(fieldName);
        group.factorRows.push(row.sourceRow);
        eventGroups.set(key, group);
      }

      const capability = missingRequiredFields.length > 0
        ? { capabilityStatus: "unable_to_check" as const }
        : dependencies.capabilityRouter.assess({
          partCategory: row.actualFields.partCategory!,
          factorName: row.actualFields.factorName!,
          partName: row.actualFields.partName!,
          nominalValue: row.actualFields.nominalValue as number,
          upperTolerance: row.actualFields.upperTolerance as number,
          lowerTolerance: row.actualFields.lowerTolerance as number,
          distribution: row.actualFields.distribution!,
        });
      return {
        worksheetName: worksheet.worksheetName,
        tableId: table.tableId,
        sourceRow: row.sourceRow,
        actualFields: row.actualFields,
        sourceCells,
          ...(worksheetImageTarget === undefined ? {} : { imageTarget: worksheetImageTarget }),
        missingRequiredFields,
        missingIdentifiers,
        ...capability,
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
    knowledgeBaseVersions,
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
      internalWithinGuidanceCount: allRows.filter((row) => row.capabilityStatus === "internal_within_guidance").length,
      internalGuidanceExceededCount: allRows.filter((row) => row.capabilityStatus === "internal_guidance_exceeded").length,
      f0InformationInsufficientCount: allRows.filter((row) => row.capabilityStatus === "f0_information_insufficient").length,
      publicLibraryMatchCount: allRows.filter((row) => row.capabilityStatus.startsWith("in_library_")).length,
      nonF0ProcessCategoryCount: allRows.filter((row) => row.capabilityStatus === "non_f0_process_category").length,
      unableToCheckCount: allRows.filter((row) => row.capabilityStatus === "unable_to_check").length,
      publicToleranceDifferenceCount: allRows.filter((row) => row.capabilityStatus === "in_library_tolerance_outside" || row.capabilityStatus === "in_library_tolerance_and_distribution_differ").length,
      publicDistributionDifferenceCount: allRows.filter((row) => row.capabilityStatus === "in_library_distribution_differs" || row.capabilityStatus === "in_library_tolerance_and_distribution_differ").length,
        missingDimIdCount: allRows.filter((row) => row.missingIdentifiers.includes("dimCharacteristicId")).length,
        missingPartNumberCount: allRows.filter((row) => row.missingIdentifiers.includes("partNumber")).length,
    },
  });
  return deepFreeze(structuredClone(result));
}