import {
  f2ArtifactInputSchema,
  f2ReadyWorksheetSchema,
  f2UserReportSchema,
  type F2ArtifactInput,
  type F2F4CalculabilityIssue,
  type F2SystemSpecificationIssue,
  type F2UserReport,
  type WorksheetSystemSpecification,
} from "@ai-assist/contracts";
import { createF0CapabilityRouter, type F0CapabilityAssessment } from "./f0-capability-router.js";
import { createF4Handoff } from "./f4-handoff.js";

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

function displayValue(field: ArtifactField | undefined): string | null {
  return field?.status === "available" && field.displayValue.length > 0 ? field.displayValue : null;
}

function projectDisplayFields(fields: ArtifactFields) {
  return {
    factorName: displayValue(fields.factorName),
    partName: displayValue(fields.partName),
    drawingNumber: displayValue(fields.drawingNumber),
    dimCharacteristicId: displayValue(fields.dimCharacteristicId),
    partCategory: displayValue(fields.partCategory),
    nominalValue: displayValue(fields.nominalValue),
    upperTolerance: displayValue(fields.upperTolerance),
    lowerTolerance: displayValue(fields.lowerTolerance),
    longTermSafetyFactor: displayValue(fields.longTermSafetyFactor),
    sigmaLevel: displayValue(fields.standardDeviation),
    distribution: displayValue(fields.distribution),
    mean: displayValue(fields.mean),
    tolerance: displayValue(fields.tolerance),
    oneSigma: displayValue(fields.oneSigma),
    percentContributionToSigma: displayValue(fields.percentContributionToSigma),
    notes: displayValue(fields.notes),
  };
}

function imageReference(worksheet: F2ArtifactInput["worksheets"][number]): { artifact: "f1"; relativePath: string; contentHash: string; worksheetName: string } | undefined {
  if (worksheet.tolerancePathImage.status !== "available") return undefined;
  return {
    artifact: "f1",
    relativePath: worksheet.tolerancePathImage.imagePath,
    contentHash: worksheet.tolerancePathImage.contentHash,
    worksheetName: worksheet.worksheetName,
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

export function validateWorksheetSystemSpecification(
  specification: WorksheetSystemSpecification,
): readonly F2SystemSpecificationIssue[] {
  const issues: F2SystemSpecificationIssue[] = [];
  const requiredFields = ["designNominal", "lowerSpecLimit", "upperSpecLimit", "targetSigmaLevel"] as const;
  for (const field of requiredFields) {
    const evidence = specification[field];
    if (evidence?.status === "unavailable") {
      issues.push({ field, reasonCode: evidence.reasonCode, ...(evidence.sourceCell === undefined ? {} : { sourceCell: evidence.sourceCell }) });
    } else if (evidence === undefined) {
      issues.push({ field, reasonCode: specification.status === "unavailable" ? specification.reasonCode : "response_summary_value_missing" });
    }
  }
  if (issues.length > 0) return issues;

  const lowerSpecLimit = specification.lowerSpecLimit;
  const upperSpecLimit = specification.upperSpecLimit;
  const targetSigmaLevel = specification.targetSigmaLevel;
  if (lowerSpecLimit?.status === "available" && upperSpecLimit?.status === "available" && lowerSpecLimit.actualValue >= upperSpecLimit.actualValue) {
    issues.push({ field: "lowerSpecLimit", reasonCode: "system_specification_range_invalid", ...(lowerSpecLimit.sourceCell === undefined ? {} : { sourceCell: lowerSpecLimit.sourceCell }) });
  }
  if (targetSigmaLevel?.status === "available" && targetSigmaLevel.actualValue <= 0) {
    issues.push({ field: "targetSigmaLevel", reasonCode: "response_summary_value_invalid", ...(targetSigmaLevel.sourceCell === undefined ? {} : { sourceCell: targetSigmaLevel.sourceCell }) });
  }
  if (specification.status === "unavailable" && issues.length === 0) {
    issues.push({ field: "lowerSpecLimit", reasonCode: specification.reasonCode });
  }
  return issues;
}

export function createF2UserReport(
  request: unknown,
  dependencies: { readonly capabilityRouter: { assess(row: { readonly partCategory: string; readonly factorName: string; readonly partName: string; readonly nominalValue: number; readonly upperTolerance: number; readonly lowerTolerance: number; readonly distribution: string }): F0CapabilityAssessment } } = { capabilityRouter: createF0CapabilityRouter() },
): F2UserReport {
  const { artifact, knowledgeBaseVersions, mappingRuleVersion } = parseRequest(request);
  const eventGroups = new Map<string, { category: string; worksheetName: string; missingFields: Set<"dimCharacteristicId" | "drawingNumber">; factorRows: number[] }>();

  const worksheets = artifact.worksheets.map((worksheet) => {
    const worksheetImageReference = imageReference(worksheet);
    const rows = worksheet.factorTables.flatMap((table) => table.rows.map((row) => {
      const missingRequiredFields = REQUIRED_FIELDS.filter((fieldName) => isMissing(fieldName, row.actualFields));
      const sourceCells = Object.fromEntries(Object.entries(row.fields).flatMap(([fieldName, field]) => field.sourceCell ? [[fieldName, field.sourceCell]] : []));
      const missingIdentifiers = (["dimCharacteristicId", "drawingNumber"] as const).filter((fieldName) => fieldName === "dimCharacteristicId"
        ? text(row.actualFields.dimCharacteristicId) === undefined
        : text(row.actualFields.drawingNumber) === undefined);
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
        factorOrdinal: row.factorOrdinal ?? { value: "", rawText: "" },
        actualFields: row.actualFields,
        displayFields: projectDisplayFields(row.fields),
        sourceCells,
          ...(worksheetImageReference === undefined ? {} : { imageReference: worksheetImageReference }),
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
    const systemSpecificationIssues = validateWorksheetSystemSpecification(worksheet.systemSpecification);
    const f4CalculabilityIssues: F2F4CalculabilityIssue[] = [];
    if (worksheet.factorTables.length === 0) {
      f4CalculabilityIssues.push({ reasonCode: "factor_tables_missing" });
    }
    const ordinalCounts = new Map<string, number>();
    for (const row of worksheet.factorTables.flatMap((table) => table.rows)) {
      const ordinal = row.factorOrdinal?.value.trim().toUpperCase() ?? "";
      if (ordinal.length > 0) ordinalCounts.set(ordinal, (ordinalCounts.get(ordinal) ?? 0) + 1);
    }
    for (const table of worksheet.factorTables) {
      if (table.rows.length === 0) {
        f4CalculabilityIssues.push({ reasonCode: "factor_table_has_no_rows", tableId: table.tableId });
      }
      for (const row of table.rows) {
        const fields = row.actualFields;
        const ordinal = row.factorOrdinal?.value.trim().toUpperCase() ?? "";
        if (ordinal.length === 0) f4CalculabilityIssues.push({ reasonCode: "factor_ordinal_missing", tableId: table.tableId, sourceRow: row.sourceRow });
        else if ((ordinalCounts.get(ordinal) ?? 0) > 1) f4CalculabilityIssues.push({ reasonCode: "factor_ordinal_duplicate", tableId: table.tableId, sourceRow: row.sourceRow });
        if (typeof fields.upperTolerance === "number" && typeof fields.lowerTolerance === "number" && !(fields.upperTolerance > fields.lowerTolerance)) f4CalculabilityIssues.push({ reasonCode: "factor_tolerance_range_invalid", tableId: table.tableId, sourceRow: row.sourceRow });
        if (typeof fields.longTermSafetyFactor === "number" && !(fields.longTermSafetyFactor > 0)) f4CalculabilityIssues.push({ reasonCode: "long_term_safety_factor_invalid", tableId: table.tableId, sourceRow: row.sourceRow });
        if (typeof fields.sigmaLevel === "number" && !(fields.sigmaLevel > 0)) f4CalculabilityIssues.push({ reasonCode: "sigma_level_invalid", tableId: table.tableId, sourceRow: row.sourceRow });
      }
    }
    const blocked = worksheet.tolerancePathImage.status === "unavailable"
      || rows.some((row) => row.missingRequiredFields.length > 0)
      || systemSpecificationIssues.length > 0
      || f4CalculabilityIssues.length > 0;
    return {
      worksheetName: worksheet.worksheetName,
      ...(worksheet.toleranceLoopDescription === undefined ? {} : { toleranceLoopDescription: worksheet.toleranceLoopDescription }),
      status: blocked ? "blocked" as const : "ready" as const,
      tolerancePathImageStatus: worksheet.tolerancePathImage.status,
      systemSpecification: worksheet.systemSpecification,
      systemSpecificationIssues,
      f4CalculabilityIssues,
      rows,
      missingFieldSummary,
    };
  });

  const allRows = worksheets.flatMap((worksheet) => worksheet.rows);
  const blockedWorksheetCount = worksheets.filter((worksheet) => worksheet.status === "blocked").length;
  const f4Handoffs = worksheets
    .filter((worksheet) => worksheet.status === "ready")
    .map((worksheet) => createF4Handoff({
      workbookContentHash: artifact.workbook.contentHash,
      worksheet: f2ReadyWorksheetSchema.parse(worksheet),
    }));
  const adoEvents = [...eventGroups.values()]
    .sort((left, right) => left.category.localeCompare(right.category) || left.worksheetName.localeCompare(right.worksheetName))
    .map((group) => ({
      eventType: "adoReminderRequested" as const,
      category: group.category,
      worksheetName: group.worksheetName,
      missingFields: (["dimCharacteristicId", "drawingNumber"] as const).filter((fieldName) => group.missingFields.has(fieldName)),
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
    f4Handoffs,
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
        missingPartNumberCount: allRows.filter((row) => row.missingIdentifiers.includes("drawingNumber")).length,
    },
  });
  return deepFreeze(structuredClone(result));
}