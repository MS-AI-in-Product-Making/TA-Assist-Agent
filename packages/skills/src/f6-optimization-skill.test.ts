import { describe, expect, it } from "vitest";
import type { CalculationRequest, F6OptimizationRequest } from "@ai-assist/contracts";
import { runRegisteredSkill } from "@ai-assist/skill-sdk";
import { createCalculation, createF5DataInterpretation } from "@ai-assist/workbook-catalog";
import { createAnonymousSkillRegistry } from "./registry.js";

const HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);

function text(rawText: string, sourceCell: string) {
  return { status: "available" as const, rawText, sourceCell };
}

function number(rawText: string, sourceCell: string, numericValue: number) {
  return { status: "available" as const, rawText, sourceCell, numericValue, unit: "mm" };
}

function calculationRequest(): CalculationRequest {
  const worksheetName = "Analysis-A";
  const tolerances = [[-1.5, 2.5], [-1, 1], [-0.75, 0.75], [-0.5, 0.5]] as const;
  const rows = tolerances.map(([lower, upper], index) => {
    const row = index + 2;
    return {
      sourceRow: row,
      fields: {
        factorName: text(`factor-${index + 1}`, `${worksheetName}!A${row}`),
        nominalValue: number("0", `${worksheetName}!B${row}`, 0),
        upperTolerance: number(String(upper), `${worksheetName}!C${row}`, upper),
        lowerTolerance: number(String(lower), `${worksheetName}!D${row}`, lower),
        longTermSafetyFactor: number("1", `${worksheetName}!E${row}`, 1),
        standardDeviation: number(index === 0 ? "2" : "1", `${worksheetName}!F${row}`, index === 0 ? 2 : 1),
        distribution: text("normal", `${worksheetName}!G${row}`),
        unit: text("mm", `${worksheetName}!H${row}`),
      },
    };
  });

  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "project",
    runReference: "run-1",
    worksheetAnalysisAssets: {
      contractVersion: "v1",
      workbook: { classification: "confidential", contentHash: HASH, catalogContractVersion: "v1" },
      worksheets: [{
        worksheetName,
        toleranceLoopDescription: "controlled",
        factorTables: [{
          tableId: "table-a",
          headerRow: 1,
          dataRange: { startRow: 2, endRow: 5 },
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
          rows,
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
      blockingIssues: [],
      advisoryIssues: [],
      summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 4, blockingIssueCount: 0, advisoryIssueCount: 0 },
    },
    exceptionResolution: {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: HASH,
      knowledgeBaseVersion: "v1",
      status: "readyToContinue",
      readyToContinue: true,
      acceptedExceptions: [],
      pendingExceptions: [],
      summary: { actionableSignalCount: 0, acceptedExceptionCount: 0, pendingExceptionCount: 0, invalidCandidateCount: 0 },
    },
    worksheetSelection: { worksheetName, tableId: "table-a" },
    systemSpecification: {
      designNominal: 0,
      lowerSpecLimit: -10,
      upperSpecLimit: 10,
      targetSigmaLevel: 4,
      targetCpk: 1.33,
      additionalMeanShift: 0,
    },
    criticality: "none",
    scenarioOverrides: [],
  };
}

function optimizationRequest(): F6OptimizationRequest {
  const baselineCalculationRequest = calculationRequest();
  const baselineCalculation = createCalculation(baselineCalculationRequest);
  if (baselineCalculation.status !== "completed") throw new Error("fixture calculation failed");

  const imageReference = {
    artifact: "f1" as const,
    worksheetName: "Analysis-A",
    relativePath: "artifacts/Analysis-A.png",
    contentHash: IMAGE_HASH,
  };
  const governanceRows = baselineCalculation.factors.map((factor, index) => ({
    factorInstanceId: String(index + 1).padStart(64, "0"),
    drawingDimensionKey: String(index + 11).padStart(64, "0"),
    deviceLevelDim: `device-${index + 1}`,
    dimensionDescription: `dimension-${index + 1}`,
    partCategory: "category",
    partSubsystem: "subsystem",
    drawingNumber: `DRAW-${index + 1}`,
    dimId: `DIM-${index + 1}`,
    factorDescription: factor.factorName,
    nominal: factor.input.nominalValue,
    upperTolerance: factor.input.upperTolerance,
    lowerTolerance: factor.input.lowerTolerance,
    sigmaLevel: factor.input.sigmaLevel,
    dimIdStatus: "valid" as const,
    qualitySignals: [],
    governanceStatus: "complete" as const,
    imageReference,
    source: { ...factor.source, sourceCells: {} },
  }));
  const interpretation = createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: [{
      worksheetName: "Analysis-A",
      imageReference,
      governanceRows,
      calculationResult: baselineCalculation,
      imageObservations: [],
    }],
  });
  const f5Worksheet = interpretation.worksheets[0];
  if (f5Worksheet?.status !== "completed") throw new Error("fixture interpretation failed");

  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
    selectedWorksheetNames: ["Analysis-A"],
    f2Reference: { artifact: "f2/result.json", contentHash: HASH },
    f3Reference: { artifact: "f3/result.json", contentHash: HASH },
    f4Reference: { artifact: "f4/result.json", contentHash: HASH, runId: "run", calculationVersion: "excel-ta-v1" },
    f5Reference: { artifact: "f5/result.json", contentHash: HASH, interpretationVersion: "f5-data-interpretation-v1" },
    f0Versions: { knowledgeBaseVersion: "v1", capabilityVersion: "capability-v1", interpretationVersion: "interpretation-rules-v1" },
    scenarioPolicyVersion: "f6-scenario-policy-v1",
    worksheets: [{
      worksheetName: "Analysis-A",
      f4CalculationIndex: 1,
      baselineCalculationRequest,
      baselineCalculation,
      f5Worksheet,
      f3GovernanceRows: governanceRows,
      f2Findings: [],
      supplierBindings: [],
    }],
  };
}

describe("f6OptimizationSkill", () => {
  it("executes the governed optimization workflow for confidential input", async () => {
    const result = await runRegisteredSkill({
      skillId: "f6-optimization",
      input: optimizationRequest() as unknown as Record<string, unknown>,
      inputClassification: "confidential",
    }, createAnonymousSkillRegistry());

    expect(result.output).toMatchObject({
      featureId: "F6",
      status: "completed",
      optimizationVersion: "f6-optimization-v1",
      summary: { worksheetCount: 1, completedWorksheetCount: 1 },
    });
  });

  it("is registered in the anonymous governed skill registry", () => {
    expect(createAnonymousSkillRegistry().get("f6-optimization")?.manifest).toMatchObject({
      featureId: "F6",
      inputClassification: ["confidential"],
      permissions: [],
      adapterCapabilities: [],
    });
  });
});