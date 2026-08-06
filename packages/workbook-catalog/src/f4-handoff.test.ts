import { describe, expect, it } from "vitest";
import { calculationRequestSchema, type F2ReadyWorksheet } from "@ai-assist/contracts";
import { createCalculationRequestFromF4Handoff, createF4Handoff } from "./f4-handoff.js";

const contentHash = "a".repeat(64);

function evidence(actualValue: number, sourceCell: string, valueOrigin: "numeric_literal" | "formula_cached" | "defaulted" = "numeric_literal") {
  return { status: "available" as const, actualValue, displayValue: String(actualValue), sourceCell, valueOrigin };
}

describe("createF4Handoff", () => {
  it("derives calculation targets while preserving system and factor evidence", () => {
    const worksheet = {
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Anonymous device gap",
      status: "ready",
      tolerancePathImageStatus: "available",
      systemSpecification: {
        status: "available",
        lowerSpecLimit: evidence(-0.15, "Analysis-A!P54"),
        upperSpecLimit: evidence(0.05, "Analysis-A!P55"),
        targetSigmaLevel: evidence(3, "Analysis-A!P56"),
        additionalMeanShift: evidence(0.01, "Analysis-A!P50", "formula_cached"),
      },
      systemSpecificationIssues: [],
      missingFieldSummary: [],
      rows: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        sourceRow: 2,
        actualFields: {
          factorName: "bracket arm", partName: "component", drawingNumber: null, dimCharacteristicId: null,
          partCategory: "CNC", nominalValue: 1, upperTolerance: 0.4, lowerTolerance: 0,
          longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "Normal", mean: 1, tolerance: 0.4,
          oneSigma: 0.1, percentContributionToSigma: 1, notes: null,
        },
        sourceCells: {
          factorName: "Analysis-A!A2",
          nominalValue: "Analysis-A!F2",
          upperTolerance: "Analysis-A!G2",
          lowerTolerance: "Analysis-A!H2",
          longTermSafetyFactor: "Analysis-A!I2",
          standardDeviation: "Analysis-A!J2",
          distribution: "Analysis-A!K2",
        },
        missingRequiredFields: [],
        missingIdentifiers: ["dimCharacteristicId", "partNumber"],
        capabilityStatus: "non_f0_process_category",
        adoReminderRequested: true,
      }],
    } satisfies F2ReadyWorksheet;

    const result = createF4Handoff({ workbookContentHash: contentHash, worksheet });

    expect(result).toMatchObject({
      contractVersion: "v1",
      handoffVersion: "f4-handoff-v1",
      inputClassification: "confidential",
      status: "ready",
      workbookContentHash: contentHash,
      worksheetName: "Analysis-A",
      systemSpecification: {
        designNominal: -0.05,
        targetCpk: 1,
        additionalMeanShift: evidence(0.01, "Analysis-A!P50", "formula_cached"),
      },
      factors: [{ tableId: "table-a", sourceRow: 2, sourceCells: { factorName: "Analysis-A!A2", nominalValue: "Analysis-A!F2" } }],
    });
  });

  it("adapts a ready handoff into a schema-valid calculation request", () => {
    const handoff = createF4Handoff({
      workbookContentHash: contentHash,
      worksheet: {
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Anonymous device gap",
        status: "ready",
        tolerancePathImageStatus: "available",
        systemSpecification: {
          status: "available",
          lowerSpecLimit: evidence(-0.15, "Analysis-A!P54"),
          upperSpecLimit: evidence(0.05, "Analysis-A!P55"),
          targetSigmaLevel: evidence(3, "Analysis-A!P56"),
          additionalMeanShift: evidence(0.01, "Analysis-A!P50", "formula_cached"),
        },
        systemSpecificationIssues: [],
        missingFieldSummary: [],
        rows: [{
          worksheetName: "Analysis-A",
          tableId: "table-a",
          sourceRow: 2,
          actualFields: {
            factorName: "bracket arm", partName: "component", drawingNumber: null, dimCharacteristicId: null,
            partCategory: "CNC", nominalValue: 1, upperTolerance: 0.4, lowerTolerance: 0,
            longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "Normal", mean: 1, tolerance: 0.4,
            oneSigma: 0.1, percentContributionToSigma: 1, notes: null,
          },
          sourceCells: {
            factorName: "Analysis-A!A2",
            partName: "Analysis-A!B2",
            partCategory: "Analysis-A!E2",
            nominalValue: "Analysis-A!F2",
            upperTolerance: "Analysis-A!G2",
            lowerTolerance: "Analysis-A!H2",
            longTermSafetyFactor: "Analysis-A!I2",
            standardDeviation: "Analysis-A!J2",
            distribution: "Analysis-A!K2",
          },
          missingRequiredFields: [],
          missingIdentifiers: ["dimCharacteristicId", "partNumber"],
          capabilityStatus: "non_f0_process_category",
          adoReminderRequested: true,
        }],
      },
    });

    const request = createCalculationRequestFromF4Handoff({
      handoff,
      projectReference: "project-1",
      runReference: "run-1",
      criticality: "none",
    });

    expect(calculationRequestSchema.parse(request)).toEqual(request);
    expect(request.systemSpecification).toEqual({
      designNominal: -0.05,
      lowerSpecLimit: -0.15,
      upperSpecLimit: 0.05,
      targetSigmaLevel: 3,
      targetCpk: 1,
      additionalMeanShift: 0.01,
    });
    expect(request.worksheetAnalysisAssets.worksheets[0]?.factorTables[0]?.rows[0]?.fields).toMatchObject({
      factorName: { rawText: "bracket arm", sourceCell: "Analysis-A!A2" },
      nominalValue: { numericValue: 1, sourceCell: "Analysis-A!F2", unit: "mm" },
      lowerTolerance: { numericValue: 0, sourceCell: "Analysis-A!H2", unit: "mm" },
      standardDeviation: { numericValue: 4, sourceCell: "Analysis-A!J2" },
      distribution: { rawText: "Normal", sourceCell: "Analysis-A!K2" },
    });
    expect(request.requiredFieldCheck).toMatchObject({ status: "readyForNextCheck", blockingIssues: [] });
    expect(request.exceptionResolution).toMatchObject({ status: "readyToContinue", pendingExceptions: [] });
    expect(request.worksheetSelection).toEqual({ worksheetName: "Analysis-A", tableId: "table-a" });
  });

  it("rejects blocked or schema-invalid handoffs", () => {
    const handoff = createF4Handoff({
      workbookContentHash: contentHash,
      worksheet: {
        worksheetName: "Analysis-A",
        status: "ready",
        tolerancePathImageStatus: "available",
        systemSpecification: {
          status: "available",
          lowerSpecLimit: evidence(-0.15, "Analysis-A!P54"),
          upperSpecLimit: evidence(0.05, "Analysis-A!P55"),
          targetSigmaLevel: evidence(3, "Analysis-A!P56"),
          additionalMeanShift: evidence(0, "Analysis-A!P50"),
        },
        systemSpecificationIssues: [],
        missingFieldSummary: [],
        rows: [],
      },
    });
    const input = {
      handoff,
      projectReference: "project-1",
      runReference: "run-1",
      criticality: "none" as const,
    };

    expect(() => createCalculationRequestFromF4Handoff({
      ...input,
      handoff: { ...handoff, status: "blocked" } as unknown as typeof handoff,
    })).toThrow();
    expect(() => createCalculationRequestFromF4Handoff({
      ...input,
      handoff: {
        ...handoff,
        systemSpecification: { ...handoff.systemSpecification, targetCpk: 2 },
      },
    })).toThrow();
  });
});