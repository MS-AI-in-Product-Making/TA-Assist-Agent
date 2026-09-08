import type { CalculationRequest } from "@ai-assist/contracts";
import { describe, expect, it } from "vitest";

import { runF4WhatIfCalculation } from "./f4-what-if.js";

const HASH = "a".repeat(64);
const text = (rawText: string, sourceCell: string) => ({ status: "available" as const, rawText, sourceCell });
const number = (rawText: string, sourceCell: string, numericValue: number) => ({ status: "available" as const, rawText, sourceCell, numericValue, unit: "mm" });

function baselineRequest(): CalculationRequest {
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "project-a",
    runReference: "f4-run-a",
    worksheetAnalysisAssets: {
      contractVersion: "v1",
      workbook: { classification: "confidential", contentHash: HASH, catalogContractVersion: "v1" },
      worksheets: [{
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "anonymous-analysis",
        factorTables: [{
          tableId: "table-a",
          headerRow: 1,
          dataRange: { startRow: 2, endRow: 3 },
          columns: [
            { semanticField: "factorName", headerText: "Factor", sourceColumn: "A" },
            { semanticField: "nominalValue", headerText: "Nominal", sourceColumn: "B" },
            { semanticField: "upperTolerance", headerText: "Upper", sourceColumn: "C" },
            { semanticField: "lowerTolerance", headerText: "Lower", sourceColumn: "D" },
            { semanticField: "longTermSafetyFactor", headerText: "LTSF", sourceColumn: "E" },
            { semanticField: "standardDeviation", headerText: "Sigma", sourceColumn: "F" },
            { semanticField: "distribution", headerText: "Distribution", sourceColumn: "G" },
            { semanticField: "unit", headerText: "Unit", sourceColumn: "H" },
          ],
          rows: [{
            sourceRow: 2,
            factorOrdinal: { value: "F1", rawText: "F1", sourceCell: "Analysis-A!I2" },
            fields: {
              factorName: text("factor-1", "Analysis-A!A2"),
              nominalValue: number("0", "Analysis-A!B2", 0),
              upperTolerance: number("1", "Analysis-A!C2", 1),
              lowerTolerance: number("-1", "Analysis-A!D2", -1),
              longTermSafetyFactor: number("1", "Analysis-A!E2", 1),
              standardDeviation: number("1", "Analysis-A!F2", 1),
              distribution: text("normal", "Analysis-A!G2"),
              unit: text("mm", "Analysis-A!H2"),
            },
          }, {
            sourceRow: 3,
            factorOrdinal: { value: "F2", rawText: "F2", sourceCell: "Analysis-A!I3" },
            fields: {
              factorName: text("factor-2", "Analysis-A!A3"), nominalValue: number("0", "Analysis-A!B3", 0), upperTolerance: number("0.5", "Analysis-A!C3", 0.5), lowerTolerance: number("-0.5", "Analysis-A!D3", -0.5), longTermSafetyFactor: number("1", "Analysis-A!E3", 1), standardDeviation: number("1", "Analysis-A!F3", 1), distribution: text("normal", "Analysis-A!G3"), unit: text("mm", "Analysis-A!H3"),
            },
          }],
        }],
        formulaCells: [],
        imageAssets: [],
      }],
    },
    requiredFieldCheck: {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: HASH,
      status: "readyForNextCheck",
      blockingIssues: [], advisoryIssues: [],
      summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 1, blockingIssueCount: 0, advisoryIssueCount: 0 },
    },
    exceptionResolution: {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: HASH,
      knowledgeBaseVersion: "v1",
      status: "readyToContinue",
      readyToContinue: true,
      acceptedExceptions: [], pendingExceptions: [],
      summary: { actionableSignalCount: 0, acceptedExceptionCount: 0, pendingExceptionCount: 0, invalidCandidateCount: 0 },
    },
    worksheetSelection: { worksheetName: "Analysis-A", tableId: "table-a" },
    systemSpecification: { designNominal: 0, lowerSpecLimit: -3, upperSpecLimit: 3, targetSigmaLevel: 3, targetCpk: 1, additionalMeanShift: 0 },
    criticality: "none",
    scenarioOverrides: [],
  };
}

describe("runF4WhatIfCalculation", () => {
  it("recalculates tolerance changes through the governed F4 scenario kernel", () => {
    const result = runF4WhatIfCalculation({
      draftId: "draft-a",
      baselineRequest: baselineRequest(),
      factor: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
      patch: { upperTolerance: 0.8, lowerTolerance: -0.8 },
    });

    expect(result).toMatchObject({
      status: "completed",
      calculationReference: "what-if:draft-a",
      metrics: { mean: 0, rssSigma: expect.any(Number), cp: expect.any(Number), cpkL: expect.any(Number), cpkU: expect.any(Number), cpk: expect.any(Number) },
    });
    if (result.status !== "completed") throw new Error("expected completed What-if");
    expect(result.metrics.rssSigma).toBeLessThan(1);
    expect(result.metrics.cpk).toBeGreaterThan(1);
    expect(result.traceReferences.length).toBeGreaterThan(0);
  });

  it("rejects nominal output without signed direction evidence", () => {
    const result = runF4WhatIfCalculation({
      draftId: "draft-a",
      baselineRequest: baselineRequest(),
      factor: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
      patch: { nominalValue: 0.1 },
    });

    expect(result).toEqual({
      status: "calculation_not_possible",
      reasonCode: "DIRECTION_EVIDENCE_REQUIRED",
    });
    expect("metrics" in result).toBe(false);
  });

  it("recalculates multiple factors and temporary specification limits in one worksheet Scenario", () => {
    const result = runF4WhatIfCalculation({
      draftId: "draft-sheet",
      baselineRequest: baselineRequest(),
      factorOverrides: [
        { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, upperTolerance: 0.8, lowerTolerance: -0.8 },
        { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 3, upperTolerance: 0.4, lowerTolerance: -0.4 },
      ],
      systemSpecification: { lowerSpecLimit: -2, upperSpecLimit: 2, additionalMeanShift: 0.1 },
    });
    expect(result).toMatchObject({
      status: "completed",
      metrics: { lowerSpecLimit: -2, upperSpecLimit: 2, meanShift: 0.1 },
      factors: [
        { sourceRow: 2, tolerance: 0.8, oneSigma: expect.any(Number), contribution: expect.any(Number) },
        { sourceRow: 3, tolerance: 0.4, oneSigma: expect.any(Number), contribution: expect.any(Number) },
      ],
    });
  });
});
