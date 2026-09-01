import {
  calculationRequestSchema,
  f4HandoffReadySchema,
  type CalculationRequest,
  type F2ReadyWorksheet,
  type F4HandoffReady,
} from "@ai-assist/contracts";

type HandoffFactor = F4HandoffReady["factors"][number];
type RequiredTextField = "factorName" | "partName" | "partCategory" | "distribution";
type RequiredNumberField = "nominalValue" | "upperTolerance" | "lowerTolerance" | "longTermSafetyFactor" | "sigmaLevel";
type SourceField = RequiredTextField | Exclude<RequiredNumberField, "sigmaLevel"> | "standardDeviation";

const REQUIRED_COLUMN_FIELDS = [
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

function sourceCell(factor: HandoffFactor, field: SourceField): string {
  const value = factor.sourceCells[field];
  if (value === undefined) {
    throw new Error(`F4 handoff factor is missing source evidence for ${field}.`);
  }
  return value;
}

function sourceColumn(cell: string): string {
  const match = /!([A-Z]+)[1-9]\d*$/.exec(cell);
  if (!match?.[1]) {
    throw new Error("F4 handoff contains invalid source-cell evidence.");
  }
  return match[1];
}

function requiredText(factor: HandoffFactor, field: RequiredTextField): string {
  const value = factor.actualFields[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`F4 handoff factor is missing required text field ${field}.`);
  }
  return value;
}

function requiredNumber(factor: HandoffFactor, field: RequiredNumberField): number {
  const value = factor.actualFields[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`F4 handoff factor is missing required numeric field ${field}.`);
  }
  return value;
}

function textEvidence(factor: HandoffFactor, field: RequiredTextField) {
  return {
    status: "available" as const,
    rawText: requiredText(factor, field),
    sourceCell: sourceCell(factor, field),
  };
}

function numberEvidence(factor: HandoffFactor, field: RequiredNumberField, sourceField: SourceField) {
  const value = requiredNumber(factor, field);
  return {
    status: "available" as const,
    rawText: String(value),
    sourceCell: sourceCell(factor, sourceField),
    numericValue: value,
    unit: factor.unit,
  };
}

function canonicalNumber(value: number): number {
  return Number(value.toPrecision(15));
}

export function createF4Handoff(input: {
  readonly workbookContentHash: string;
  readonly worksheet: F2ReadyWorksheet;
}): F4HandoffReady {
  const specification = input.worksheet.systemSpecification;
  const { designNominal, lowerSpecLimit, upperSpecLimit, targetSigmaLevel } = specification;
  if (designNominal.status !== "available" || lowerSpecLimit.status !== "available" || upperSpecLimit.status !== "available" || targetSigmaLevel.status !== "available") {
    throw new Error("F4 handoff requires validated system specification evidence.");
  }
  const additionalMeanShift = specification.additionalMeanShift.status === "available"
    ? specification.additionalMeanShift
    : { status: "available" as const, actualValue: 0, displayValue: "0", valueOrigin: "defaulted" as const };

  return f4HandoffReadySchema.parse({
    contractVersion: "v1",
    handoffVersion: "f4-handoff-v1",
    inputClassification: "confidential",
    status: "ready",
    workbookContentHash: input.workbookContentHash,
    worksheetName: input.worksheet.worksheetName,
    ...(input.worksheet.toleranceLoopDescription === undefined ? {} : { toleranceLoopDescription: input.worksheet.toleranceLoopDescription }),
    systemSpecification: {
      designNominal: canonicalNumber(designNominal.actualValue),
      lowerSpecLimit,
      upperSpecLimit,
      targetSigmaLevel,
      targetCpk: canonicalNumber(targetSigmaLevel.actualValue / 3),
      additionalMeanShift,
    },
    factors: input.worksheet.rows.map((row) => ({
      tableId: row.tableId,
      sourceRow: row.sourceRow,
      unit: "mm",
      actualFields: row.actualFields,
      sourceCells: row.sourceCells,
    })),
  });
}

export function createCalculationRequestFromF4Handoff(input: {
  readonly handoff: F4HandoffReady;
  readonly projectReference: string;
  readonly runReference: string;
  readonly criticality: CalculationRequest["criticality"];
}): CalculationRequest {
  const handoff = f4HandoffReadySchema.parse(input.handoff);
  if (handoff.toleranceLoopDescription === undefined || handoff.factors.length === 0) {
    throw new Error("F4 handoff requires a tolerance-loop description and at least one factor.");
  }

  const tableIds = new Set(handoff.factors.map((factor) => factor.tableId));
  if (tableIds.size !== 1) {
    throw new Error("F4 handoff must identify exactly one factor table.");
  }
  const tableId = handoff.factors[0]!.tableId;
  const sourceRows = handoff.factors.map((factor) => factor.sourceRow);
  if (new Set(sourceRows).size !== sourceRows.length) {
    throw new Error("F4 handoff factor source rows must be unique.");
  }

  const firstFactor = handoff.factors[0]!;
  const columns = REQUIRED_COLUMN_FIELDS.map((semanticField) => {
    const column = sourceColumn(sourceCell(firstFactor, semanticField));
    for (const factor of handoff.factors.slice(1)) {
      if (sourceColumn(sourceCell(factor, semanticField)) !== column) {
        throw new Error(`F4 handoff source column is inconsistent for ${semanticField}.`);
      }
    }
    return { semanticField, headerText: semanticField, sourceColumn: column };
  });

  const rows = handoff.factors.map((factor) => ({
    sourceRow: factor.sourceRow,
    fields: {
      factorName: textEvidence(factor, "factorName"),
      partName: textEvidence(factor, "partName"),
      partCategory: textEvidence(factor, "partCategory"),
      nominalValue: numberEvidence(factor, "nominalValue", "nominalValue"),
      upperTolerance: numberEvidence(factor, "upperTolerance", "upperTolerance"),
      lowerTolerance: numberEvidence(factor, "lowerTolerance", "lowerTolerance"),
      longTermSafetyFactor: numberEvidence(factor, "longTermSafetyFactor", "longTermSafetyFactor"),
      standardDeviation: numberEvidence(factor, "sigmaLevel", "standardDeviation"),
      distribution: textEvidence(factor, "distribution"),
    },
  }));
  const advisoryIssues = handoff.factors.flatMap((factor) => ([
    ...(factor.actualFields.drawingNumber === null ? [{
      issueCode: "optional_identifier_unavailable" as const,
      worksheetName: handoff.worksheetName,
      tableId,
      sourceRow: factor.sourceRow,
      field: "drawingNumber" as const,
      reasonCode: "missing" as const,
    }] : []),
    ...(factor.actualFields.dimCharacteristicId === null ? [{
      issueCode: "optional_identifier_unavailable" as const,
      worksheetName: handoff.worksheetName,
      tableId,
      sourceRow: factor.sourceRow,
      field: "dimCharacteristicId" as const,
      reasonCode: "missing" as const,
    }] : []),
  ]));
  const minimumSourceRow = Math.min(...sourceRows);
  const maximumSourceRow = Math.max(...sourceRows);
  const specification = handoff.systemSpecification;

  return calculationRequestSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: input.projectReference,
    runReference: input.runReference,
    worksheetAnalysisAssets: {
      contractVersion: "v1",
      workbook: {
        classification: "confidential",
        contentHash: handoff.workbookContentHash,
        catalogContractVersion: "v1",
      },
      worksheets: [{
        worksheetName: handoff.worksheetName,
        toleranceLoopDescription: handoff.toleranceLoopDescription,
        factorTables: [{
          tableId,
          headerRow: Math.max(1, minimumSourceRow - 1),
          dataRange: { startRow: minimumSourceRow, endRow: maximumSourceRow },
          columns,
          rows,
        }],
        formulaCells: [],
        imageAssets: [],
      }],
    },
    requiredFieldCheck: {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: handoff.workbookContentHash,
      status: "readyForNextCheck",
      blockingIssues: [],
      advisoryIssues,
      summary: {
        worksheetsChecked: 1,
        factorTablesChecked: 1,
        factorRowsChecked: rows.length,
        blockingIssueCount: 0,
        advisoryIssueCount: advisoryIssues.length,
      },
    },
    exceptionResolution: {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: handoff.workbookContentHash,
      knowledgeBaseVersion: "v1",
      status: "readyToContinue",
      readyToContinue: true,
      acceptedExceptions: [],
      pendingExceptions: [],
      summary: {
        actionableSignalCount: 0,
        acceptedExceptionCount: 0,
        pendingExceptionCount: 0,
        invalidCandidateCount: 0,
      },
    },
    worksheetSelection: { worksheetName: handoff.worksheetName, tableId },
    systemSpecification: {
      designNominal: specification.designNominal,
      lowerSpecLimit: specification.lowerSpecLimit.actualValue,
      upperSpecLimit: specification.upperSpecLimit.actualValue,
      targetSigmaLevel: specification.targetSigmaLevel.actualValue,
      targetCpk: specification.targetCpk,
      additionalMeanShift: specification.additionalMeanShift.actualValue,
    },
    criticality: input.criticality,
    scenarioOverrides: [],
  });
}