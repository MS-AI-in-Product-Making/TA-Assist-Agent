import {
  f4HandoffReadySchema,
  type F2ReadyWorksheet,
  type F4HandoffReady,
} from "@ai-assist/contracts";

function canonicalNumber(value: number): number {
  return Number(value.toPrecision(15));
}

export function createF4Handoff(input: {
  readonly workbookContentHash: string;
  readonly worksheet: F2ReadyWorksheet;
}): F4HandoffReady {
  const specification = input.worksheet.systemSpecification;
  const { lowerSpecLimit, upperSpecLimit, targetSigmaLevel } = specification;
  if (lowerSpecLimit.status !== "available" || upperSpecLimit.status !== "available" || targetSigmaLevel.status !== "available") {
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
      designNominal: canonicalNumber((lowerSpecLimit.actualValue + upperSpecLimit.actualValue) / 2),
      lowerSpecLimit,
      upperSpecLimit,
      targetSigmaLevel,
      targetCpk: canonicalNumber(targetSigmaLevel.actualValue / 3),
      additionalMeanShift,
    },
    factors: input.worksheet.rows.map((row) => ({
      tableId: row.tableId,
      sourceRow: row.sourceRow,
      actualFields: row.actualFields,
      sourceCells: row.sourceCells,
    })),
  });
}