import { describe, expect, it } from "vitest";
import type { F2ReadyWorksheet } from "@ai-assist/contracts";
import { createF4Handoff } from "./f4-handoff.js";

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
        sourceCells: { factorName: "Analysis-A!A2", nominalValue: "Analysis-A!F2" },
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
});