import { describe, expect, it, vi } from "vitest";
import {
  f6OptimizationResultSchema,
  type CalculationRequest,
  type F6OptimizationRequest,
} from "@ai-assist/contracts";
import * as packageRoot from "./index.js";
import { createCalculation } from "./calculation.js";
import { createF5DataInterpretation } from "./f5-data-interpretation.js";
import { calculateF6Scenario } from "./f6-scenario-adapter.js";
import { createF6Optimization } from "./f6-optimization.js";

const HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);

function text(rawText: string, sourceCell: string) {
  return { status: "available" as const, rawText, sourceCell };
}

function number(rawText: string, sourceCell: string, numericValue: number) {
  return { status: "available" as const, rawText, sourceCell, numericValue, unit: "mm" };
}

function calculationRequest(worksheetName = "Analysis-A"): CalculationRequest {
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
    runReference: "run",
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

function request(worksheetName = "Analysis-A"): F6OptimizationRequest {
  const baselineRequest = calculationRequest(worksheetName);
  const calculation = createCalculation(baselineRequest);
  if (calculation.status !== "completed") throw new Error("fixture calculation failed");
  const imageReference = {
    artifact: "f1" as const,
    worksheetName,
    relativePath: `artifacts/${worksheetName}.png`,
    contentHash: IMAGE_HASH,
  };
  const governanceRows = calculation.factors.map((factor, index) => ({
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
  const f5 = createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: [{ worksheetName, imageReference, governanceRows, calculationResult: calculation, imageObservations: [] }],
  });
  const f5Worksheet = f5.worksheets[0];
  if (f5Worksheet?.status !== "completed") throw new Error("fixture interpretation failed");
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
    selectedWorksheetNames: [worksheetName],
    f2Reference: { artifact: "f2/result.json", contentHash: HASH },
    f3Reference: { artifact: "f3/result.json", contentHash: HASH },
    f4Reference: { artifact: "f4/result.json", contentHash: HASH, runId: "run", calculationVersion: "excel-ta-v1" },
    f5Reference: { artifact: "f5/result.json", contentHash: HASH, interpretationVersion: "f5-data-interpretation-v1" },
    f0Versions: { knowledgeBaseVersion: "v1", capabilityVersion: "capability-v1", interpretationVersion: "interpretation-rules-v1" },
    scenarioPolicyVersion: "f6-scenario-policy-v1",
    worksheets: [{ worksheetName, baselineCalculation: calculation, f5Worksheet, f3GovernanceRows: governanceRows, f2Findings: [] }],
  };
}

describe("createF6Optimization", () => {
  it("creates the deterministic option set with governed metrics and immutable output", () => {
    const input = request();
    const snapshot = structuredClone(input);
    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");

    expect(worksheet.options.map(({ optionKind }) => optionKind)).toEqual([
      "reduce_top_contributor_20",
      "reduce_top_3_contributors_30",
      "mean_shift_centering",
      "reverse_solve_single_factor",
      "reverse_solve_top_3",
      "rss_apportionment",
      "centering_plus_tighten",
      "improve_supplier_capability",
      "tighten_datum_strategy",
    ]);
    expect(worksheet.options.slice(0, 7).map(({ status }) => status)).toEqual(Array(7).fill("completed"));
    expect(worksheet.targetCapability).toEqual({ targetCpk: 1.33, targetSigmaLevel: 4, source: "worksheet" });
    expect(worksheet.options[7]).toMatchObject({ status: "insufficient_evidence", predictedImprovement: "insufficient_evidence" });
    expect(worksheet.options[8]).toMatchObject({ status: "insufficient_evidence", predictedImprovement: "insufficient_evidence" });
    expect(worksheet.roiStatus).toBe("not_computed");
    expect(worksheet.options.filter((option) => option.status === "completed").every((option) => option.roiScore === "not_computed")).toBe(true);
    expect(f6OptimizationResultSchema.parse(result)).toEqual(result);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(worksheet.options)).toBe(true);
    expect(input).toEqual(snapshot);
  });

  it("selects contributors once from baseline and preserves an asymmetric band center", () => {
    const result = createF6Optimization(request());
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const top = worksheet.options[0];
    if (top?.status !== "completed") throw new Error("expected completed top option");
    expect(top.factorOverrides.map(({ sourceRow }) => sourceRow)).toEqual([2]);
    expect(top.toleranceChanges[0]).toMatchObject({
      originalLowerTolerance: -1.5,
      originalUpperTolerance: 2.5,
      resultingLowerTolerance: -1.1,
      resultingUpperTolerance: 2.1,
      bandCenter: 0.5,
    });
    const top3 = worksheet.options[1];
    if (top3?.status !== "completed") throw new Error("expected completed top-3 option");
    expect(top3.factorOverrides.map(({ sourceRow }) => sourceRow)).toEqual([2, 3, 4]);
  });

  it("preserves exact result-minus-baseline deltas and assigns stable impact ranks", () => {
    const result = createF6Optimization(request());
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const completed = worksheet.options.filter((option) => option.status === "completed");
    for (const option of completed) {
      expect(option.deltaCpk).toBe(option.resultMetrics.cpk - option.baselineMetrics.cpk);
      expect(option.deltaCp).toBe(option.resultMetrics.cp - option.baselineMetrics.cp);
      expect(option.deltaRssSigma).toBe(option.resultMetrics.rssSigma - option.baselineMetrics.rssSigma);
      expect(option.deltaDpm).toBe(option.resultMetrics.dpm - option.baselineMetrics.dpm);
      expect(option.deltaYield).toBe(option.resultMetrics.yield - option.baselineMetrics.yield);
    }
    expect(completed.map(({ impactRank }) => impactRank).sort((left, right) => left! - right!)).toEqual(
      Array.from({ length: completed.length }, (_, index) => index + 1),
    );
    expect(worksheet.highestImpactAction?.optionId).toBe(completed.find(({ impactRank }) => impactRank === 1)?.optionId);
    expect(worksheet.recommendations.every(({ optionId }) =>
      completed.some((option) => option.optionId === optionId))).toBe(true);
  });

  it("isolates one controlled calculation failure and continues remaining options", () => {
    let callCount = 0;
    const calculateScenario = vi.fn((input: Parameters<typeof calculateF6Scenario>[0]) => {
      callCount += 1;
      if (callCount === 2) throw { code: "calculation_not_possible", privateValue: "DO-NOT-LEAK" };
      return calculateF6Scenario(input);
    });
    const result = createF6Optimization(request(), { calculateScenario });
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected partial worksheet");
    expect(worksheet.status).toBe("partially_completed");
    expect(result.status).toBe("partially_completed");
    expect(worksheet.options[1]).toEqual({
      status: "calculation_failed",
      optionId: "Analysis-A:reduce_top_3_contributors_30",
      optionKind: "reduce_top_3_contributors_30",
      reasonCode: "calculation_not_possible",
      evidenceReferences: [],
      impactRank: null,
    });
    expect(JSON.stringify(result)).not.toContain("DO-NOT-LEAK");
    expect(calculateScenario).toHaveBeenCalledTimes(7);
    expect(result.summary).toMatchObject({ completedOptionCount: 6, calculationFailedOptionCount: 1, insufficientEvidenceOptionCount: 2 });
  });

  it("marks a worksheet and root rejected when every numeric option fails", () => {
    const result = createF6Optimization(request(), {
      calculateScenario: vi.fn(() => { throw { code: "calculation_not_possible" }; }),
    });
    expect(result.status).toBe("input_rejected");
    expect(result.worksheets[0]).toMatchObject({
      worksheetName: "Analysis-A",
      status: "input_rejected",
      options: [],
      inputFindings: [{ findingCode: "all_controlled_options_failed" }],
    });
    expect(result.summary).toEqual({
      worksheetCount: 1,
      completedWorksheetCount: 0,
      partiallyCompletedWorksheetCount: 0,
      inputRejectedWorksheetCount: 1,
      completedOptionCount: 0,
      calculationFailedOptionCount: 0,
      insufficientEvidenceOptionCount: 0,
    });
  });

  it("aggregates completed and partially completed worksheets deterministically", () => {
    const input = request();
    const second = request("Analysis-B");
    input.selectedWorksheetNames = ["Analysis-A", "Analysis-B"];
    input.worksheets.push(second.worksheets[0]!);
    let failed = false;
    const result = createF6Optimization(input, {
      calculateScenario: (scenarioInput) => {
        if (!failed && scenarioInput.scenario.scenarioId.startsWith("Analysis-B:")) {
          failed = true;
          throw { code: "calculation_not_possible" };
        }
        return calculateF6Scenario(scenarioInput);
      },
    });
    expect(result.status).toBe("partially_completed");
    expect(result.worksheets.map(({ status }) => status)).toEqual(["completed", "partially_completed"]);
    expect(result.summary).toMatchObject({
      worksheetCount: 2,
      completedWorksheetCount: 1,
      partiallyCompletedWorksheetCount: 1,
      calculationFailedOptionCount: 1,
    });
  });

  it("does not downgrade request validation errors to option failures", () => {
    const input = request() as unknown as Record<string, unknown>;
    input.inputClassification = "public";
    expect(() => createF6Optimization(input, { calculateScenario: vi.fn() })).toThrow();
  });

  it("uses governed cost evidence but leaves ROI not computed without a calculation result", () => {
    const input = request();
    input.costEvidence = {
      evidenceVersion: "cost-model-v1",
      model: "controlled-model",
      unit: "relative-points",
      optionCosts: [{ optionKind: "reduce_top_contributor_20", cost: 12 }],
      roiPolicyVersion: "roi-policy-v1",
      roiCalculationReference: { artifact: "cost/roi-result.json", contentHash: "c".repeat(64) },
      source: "cost/model.json",
      effectiveVersion: "2026-08-15",
      contentHash: "d".repeat(64),
    };
    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    expect(worksheet.roiStatus).toBe("not_computed");
    expect(worksheet.options[0]).toMatchObject({ relativeCost: 12, roiScore: "not_computed" });
  });

  it("exports only the public orchestrator and no private optimization helpers", () => {
    expect(packageRoot.createF6Optimization).toBe(createF6Optimization);
    expect(Object.keys(packageRoot).filter((key) => key.toLowerCase().includes("optimization"))).toEqual(["createF6Optimization"]);
  });
});