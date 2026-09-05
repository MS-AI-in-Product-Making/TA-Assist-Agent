import { describe, expect, it, vi } from "vitest";
import {
  f6LegacyOptimizationResultSchema as f6OptimizationResultSchema,
  type CalculationRequest,
  type F6OptimizationRequest,
} from "@ai-assist/contracts";
import * as packageRoot from "./index.js";
import { createCalculation } from "./calculation.js";
import { createF5DataInterpretation } from "./f5-data-interpretation.js";
import { calculateF6Scenario } from "./f6-scenario-adapter.js";
import {
  createF6Optimization as createF6OptimizationV2,
  createLegacyF6Optimization as createF6Optimization,
  rankCompletedOptions,
  selectHighestSupportedCompletedOption,
} from "./f6-optimization.js";

const HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);

function text(rawText: string, sourceCell: string) {
  return { status: "available" as const, rawText, sourceCell };
}

function number(rawText: string, sourceCell: string, numericValue: number) {
  return { status: "available" as const, rawText, sourceCell, numericValue, unit: "mm" };
}

function calculationRequest(
  worksheetName = "Analysis-A",
  specification: { readonly lowerSpecLimit: number; readonly upperSpecLimit: number; readonly targetCpk: number; readonly targetSigmaLevel: number } = {
    lowerSpecLimit: -10,
    upperSpecLimit: 10,
    targetCpk: 1.33,
    targetSigmaLevel: 4,
  },
): CalculationRequest {
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
      lowerSpecLimit: specification.lowerSpecLimit,
      upperSpecLimit: specification.upperSpecLimit,
      targetSigmaLevel: specification.targetSigmaLevel,
      targetCpk: specification.targetCpk,
      additionalMeanShift: 0,
    },
    criticality: "none",
    scenarioOverrides: [],
  };
}

function request(
  worksheetName = "Analysis-A",
  specification?: { readonly lowerSpecLimit: number; readonly upperSpecLimit: number; readonly targetCpk: number; readonly targetSigmaLevel: number },
): F6OptimizationRequest {
  const baselineRequest = calculationRequest(worksheetName, specification);
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
    reportScope: { worksheetNames: [worksheetName], blockedWorksheetNames: [] },
    f2Reference: { artifact: "f2/result.json", contentHash: HASH },
    f3Reference: { artifact: "f3/result.json", contentHash: HASH },
    f4Reference: { artifact: "f4/result.json", contentHash: HASH, runId: "run", calculationVersion: "excel-ta-v1" },
    f5Reference: { artifact: "f5/result.json", contentHash: HASH, interpretationVersion: "f5-data-interpretation-v1" },
    f0Versions: { knowledgeBaseVersion: "v1", capabilityVersion: "capability-v1", interpretationVersion: "interpretation-rules-v1" },
    scenarioPolicyVersion: "f6-scenario-policy-v1",
    worksheets: [{
      worksheetName,
      f4CalculationIndex: 1,
      baselineCalculationRequest: baselineRequest,
      baselineCalculation: calculation,
      f5Worksheet,
      f3GovernanceRows: governanceRows,
      f2Findings: [],
      supplierBindings: [],
    }],
  };
}

function supplierEvidence(overrides: Partial<NonNullable<F6OptimizationRequest["supplierCapabilityEvidence"]>[number]> = {}) {
  return {
    evidenceVersion: "supplier-capability-v1" as const,
    supplierReference: "supplier-a",
    processFamily: "cnc",
    partCategory: "category",
    capabilityTier: "T1" as const,
    achievableToleranceBand: 3,
    distribution: "normal" as const,
    source: "supplier/a.json",
    effectiveVersion: "2026-Q3",
    contentHash: "c".repeat(64),
    ...overrides,
  };
}

function bindSupplier(input: F6OptimizationRequest, evidence: ReturnType<typeof supplierEvidence>, sourceRow = 2): void {
  input.supplierCapabilityEvidence = [...(input.supplierCapabilityEvidence ?? []), evidence];
  input.worksheets[0]!.supplierBindings.push({
    tableId: "table-a",
    sourceRow,
    evidenceReference: { artifact: evidence.source, contentHash: evidence.contentHash },
  });
}

function refreshGovernedBaseline(input: F6OptimizationRequest): void {
  const worksheet = input.worksheets[0]!;
  const calculation = createCalculation(worksheet.baselineCalculationRequest);
  if (calculation.status !== "completed") throw new Error("fixture calculation failed");
  const governanceRows = worksheet.f3GovernanceRows.map((row, index) => ({
    ...structuredClone(row),
    nominal: calculation.factors[index]!.input.nominalValue,
    upperTolerance: calculation.factors[index]!.input.upperTolerance,
    lowerTolerance: calculation.factors[index]!.input.lowerTolerance,
    sigmaLevel: calculation.factors[index]!.input.sigmaLevel,
  }));
  const f5 = createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: input.workbook,
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: [{
      worksheetName: worksheet.worksheetName,
      imageReference: worksheet.f5Worksheet.imageReference,
      governanceRows,
      calculationResult: calculation,
      imageObservations: [],
    }],
  });
  const f5Worksheet = f5.worksheets[0];
  if (f5Worksheet?.status !== "completed") throw new Error("fixture interpretation failed");
  worksheet.baselineCalculation = calculation;
  worksheet.f3GovernanceRows = governanceRows;
  worksheet.f5Worksheet = f5Worksheet;
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
    expect(worksheet.baselineIdentity).toEqual({
      projectReference: input.worksheets[0]!.baselineCalculation.projectReference,
      runReference: input.worksheets[0]!.baselineCalculation.runReference,
      calculationVersion: input.worksheets[0]!.baselineCalculation.calculationVersion,
      workbookContentHash: input.worksheets[0]!.baselineCalculation.workbookContentHash,
      worksheetName: input.worksheets[0]!.baselineCalculation.worksheetSelection.worksheetName,
      tableId: input.worksheets[0]!.baselineCalculation.worksheetSelection.tableId,
      factorCount: input.worksheets[0]!.baselineCalculation.factorCount,
      factors: input.worksheets[0]!.baselineCalculation.factors.map((factor) => {
        const identity: Partial<typeof factor> = structuredClone(factor);
        delete identity.trace;
        return identity;
      }),
      system: input.worksheets[0]!.baselineCalculation.system,
      capability: input.worksheets[0]!.baselineCalculation.capability,
    });
    expect(worksheet.options[7]).toMatchObject({ status: "insufficient_evidence", predictedImprovement: "insufficient_evidence" });
    expect(worksheet.options[8]).toMatchObject({ status: "insufficient_evidence", predictedImprovement: "insufficient_evidence" });
    expect(worksheet.options[7]).not.toHaveProperty("evidenceScope");
    expect(worksheet.options[8]).not.toHaveProperty("evidenceScope");
    expect(worksheet.inputFindings.some(({ findingKind }) => findingKind === "optimization_failure")).toBe(false);
    expect(worksheet.roiStatus).toBe("not_computed");
    expect(worksheet.options.filter((option) => option.status === "completed").every((option) => option.roiScore === "not_computed")).toBe(true);
    for (const option of worksheet.options.filter((candidate) => candidate.status === "completed")) {
      expect(option.scenarioEvidence.scenarioId).toBe(option.optionId);
      expect(option.scenarioEvidence.calculation.scenarios.some(({ scenarioId }) => scenarioId === option.optionId)).toBe(true);
      expect(option.scenarioEvidence.calculation.scenarios.at(-1)?.overrides).toEqual({
        factors: option.factorOverrides.map((override) => ({
          source: {
            worksheetName: override.worksheetName,
            tableId: override.tableId,
            sourceRow: override.sourceRow,
          },
          fields: Object.keys(override).filter((field) => !["worksheetName", "tableId", "sourceRow"].includes(field)),
        })),
        ...(option.optionKind === "mean_shift_centering" || option.optionKind === "centering_plus_tighten"
          ? { systemSpecification: { additionalMeanShift: expect.any(Number) } }
          : {}),
      });
      expect(option).not.toHaveProperty("calculationTrace");
      expect(option.closedRiskIds).toEqual([]);
    }
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
    const highestSupported = completed
      .filter(({ feasibility }) => feasibility.status === "supported")
      .sort((left, right) => left.impactRank! - right.impactRank!)[0];
    expect(worksheet.highestImpactAction?.optionId).toBe(highestSupported?.optionId);
    expect(worksheet.recommendations.every(({ optionId }) =>
      completed.some((option) => option.optionId === optionId))).toBe(true);
  });

  it("keeps default mean shift as a review-only option without automatically recommending it", () => {
    const input = request();
    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const meanShift = worksheet.options.find(({ optionKind }) => optionKind === "mean_shift_centering");
    if (meanShift?.status !== "completed") throw new Error("expected completed mean-shift option");

    expect(meanShift.toleranceChanges).toEqual([]);
    expect(meanShift.feasibility).toEqual({
      status: "requires_engineering_review",
      reasonCodes: ["mean_shift_physical_constraint_unverified"],
      evidenceReferences: [input.f4Reference.artifact, input.f5Reference.artifact],
    });
    expect(meanShift.evidenceReferences).toEqual(expect.arrayContaining([
      { artifact: input.f4Reference.artifact, contentHash: input.f4Reference.contentHash },
      { artifact: input.f5Reference.artifact, contentHash: input.f5Reference.contentHash },
    ]));
    expect(worksheet.recommendations).toEqual([]);
    expect(worksheet.highestImpactAction).toBeUndefined();
  });

  it("keeps combined centering and tightening review-only with complete T1 evidence", () => {
    const input = request();
    for (const sourceRow of [2, 3, 4, 5]) {
      const evidence = supplierEvidence({
        supplierReference: `supplier-${sourceRow}`,
        achievableToleranceBand: 0,
        source: `supplier/${sourceRow}.json`,
        contentHash: String(sourceRow).repeat(64),
      });
      bindSupplier(input, evidence, sourceRow);
    }

    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const combined = worksheet.options.find(({ optionKind }) => optionKind === "centering_plus_tighten");
    if (combined?.status !== "completed") throw new Error("expected completed combined option");
    const supported = worksheet.options.filter((option) => option.status === "completed" && option.feasibility.status === "supported");

    expect(combined.feasibility).toMatchObject({
      status: "requires_engineering_review",
      reasonCodes: expect.arrayContaining(["mean_shift_physical_constraint_unverified"]),
    });
    expect(supported.length).toBeGreaterThan(0);
    expect(worksheet.recommendations.some(({ optionId }) => optionId === combined.optionId)).toBe(false);
    expect(worksheet.highestImpactAction?.optionId).not.toBe(combined.optionId);
  });

  it("combines centering review with a stronger T1 not-supported tolerance assessment", () => {
    const input = request();
    for (const sourceRow of [2, 3, 4, 5]) {
      bindSupplier(input, supplierEvidence({
        supplierReference: `supplier-${sourceRow}`,
        achievableToleranceBand: 100,
        source: `supplier/${sourceRow}.json`,
        contentHash: String(sourceRow).repeat(64),
      }), sourceRow);
    }

    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const combined = worksheet.options.find(({ optionKind }) => optionKind === "centering_plus_tighten");
    if (combined?.status !== "completed") throw new Error("expected completed combined option");

    expect(combined.feasibility.status).toBe("not_supported");
    expect(combined.feasibility.reasonCodes).toEqual(expect.arrayContaining([
      "mean_shift_physical_constraint_unverified",
      "t1_governed_bound_exceeded",
    ]));
  });

  it("selects the lowest global impact rank among supported completed options", () => {
    const result = createF6Optimization(request());
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const template = worksheet.options.find((option) => option.status === "completed")!;
    if (template.status !== "completed") throw new Error("expected completed option");
    const options = [
      {
        ...structuredClone(template),
        optionId: "review-rank-1",
        impactRank: 1,
        feasibility: { status: "requires_engineering_review" as const, reasonCodes: [], evidenceReferences: [] },
      },
      {
        ...structuredClone(template),
        optionId: "supported-rank-3",
        impactRank: 3,
        feasibility: { status: "supported" as const, reasonCodes: [], evidenceReferences: [] },
      },
      {
        ...structuredClone(template),
        optionId: "supported-rank-2",
        impactRank: 2,
        feasibility: { status: "supported" as const, reasonCodes: [], evidenceReferences: [] },
      },
    ];

    expect(selectHighestSupportedCompletedOption(options)?.optionId).toBe("supported-rank-2");
    expect(selectHighestSupportedCompletedOption(options.slice(0, 1))).toBeUndefined();
  });

  it("conservatively keeps mean shift under review when exact confirmed datum evidence lacks design authorization", () => {
    const input = request();
    input.datumEvidence = [{
      evidenceVersion: "datum-strategy-v1",
      worksheetName: input.worksheets[0]!.worksheetName,
      datumFace: "A",
      stackStart: "A",
      factorDirections: input.worksheets[0]!.baselineCalculation.factors.map(({ source }) => ({
        tableId: source.tableId,
        sourceRow: source.sourceRow,
        direction: 1 as const,
      })),
      datumChainEdges: [{ from: "A", to: "B" }],
      crossSubsystemRelations: [],
      drawingEvidence: ["drawings/a.pdf"],
      reviewStatus: "confirmed",
      source: "datum/a.json",
      effectiveVersion: "v1",
      contentHash: "c".repeat(64),
    }];

    const result = createF6Optimization(input);
    const meanShift = result.worksheets[0]!.options.find(({ optionKind }) => optionKind === "mean_shift_centering");
    if (meanShift?.status !== "completed") throw new Error("expected completed mean-shift option");
    expect(meanShift.feasibility).toMatchObject({
      status: "requires_engineering_review",
      reasonCodes: ["mean_shift_physical_constraint_unverified"],
    });
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
    expect(worksheet.inputFindings).toContainEqual({
      findingCode: "f6_option_calculation_failed",
      findingKind: "optimization_failure",
      severity: "Major",
      message: "One or more controlled optimization options could not be calculated.",
      affectsCapabilityData: false,
      evidenceReferences: [
        { artifact: "f4/result.json", contentHash: HASH },
        { artifact: "f5/result.json", contentHash: HASH },
      ],
    });
    expect(calculateScenario).toHaveBeenCalledTimes(7);
    expect(result.summary).toMatchObject({ completedOptionCount: 6, calculationFailedOptionCount: 1, insufficientEvidenceOptionCount: 2 });
  });

  it("preserves every failed option and marks worksheet and root calculation failed", () => {
    const result = createF6Optimization(request(), {
      calculateScenario: vi.fn(() => { throw { code: "calculation_not_possible" }; }),
    });
    expect(result.status).toBe("calculation_failed");
    expect(result.worksheets[0]).toMatchObject({
      worksheetName: "Analysis-A",
      status: "calculation_failed",
      baselineIdentity: expect.objectContaining({
        projectReference: "project",
        runReference: "run-1",
        worksheetName: "Analysis-A",
        tableId: "table-a",
      }),
      options: expect.arrayContaining([
        expect.objectContaining({ status: "calculation_failed", reasonCode: "calculation_not_possible" }),
        expect.objectContaining({ status: "insufficient_evidence" }),
      ]),
      recommendations: [],
      roiStatus: "not_computed",
      inputFindings: [expect.objectContaining({
        findingCode: "f6_option_calculation_failed",
        findingKind: "optimization_failure",
        severity: "Major",
        affectsCapabilityData: false,
      })],
    });
    expect(result.worksheets[0]).not.toHaveProperty("highestImpactAction");
    expect(result.summary).toEqual({
      worksheetCount: 1,
      completedWorksheetCount: 0,
      partiallyCompletedWorksheetCount: 0,
      calculationFailedWorksheetCount: 1,
      inputRejectedWorksheetCount: 0,
      completedOptionCount: 0,
      calculationFailedOptionCount: 7,
      insufficientEvidenceOptionCount: 2,
    });
  });

  it("does not duplicate an existing governed optimization failure finding", () => {
    const input = request();
    input.worksheets[0]!.f2Findings.push({
      findingCode: "upstream_optimization_failure",
      findingKind: "optimization_failure",
      severity: "Major",
      message: "A governed upstream optimization failure is already recorded.",
      affectsCapabilityData: false,
      evidenceReferences: [{ artifact: input.f5Reference.artifact, contentHash: input.f5Reference.contentHash }],
    });

    const result = createF6Optimization(input, {
      calculateScenario: vi.fn(() => { throw { code: "calculation_not_possible" }; }),
    });

    expect(result.worksheets[0]!.inputFindings.filter(({ findingKind }) =>
      findingKind === "optimization_failure")).toEqual(input.worksheets[0]!.f2Findings);
  });

  it("aggregates completed and calculation-failed worksheets as partially completed", () => {
    const input = request();
    const second = request("Analysis-B");
    input.selectedWorksheetNames = ["Analysis-A", "Analysis-B"];
    input.reportScope.worksheetNames = ["Analysis-A", "Analysis-B"];
    input.worksheets.push(second.worksheets[0]!);
    const result = createF6Optimization(input, {
      calculateScenario: (scenarioInput) => {
        if (scenarioInput.scenario.scenarioId.startsWith("Analysis-B:")) throw { code: "calculation_not_possible" };
        return calculateF6Scenario(scenarioInput);
      },
    });
    expect(result.status).toBe("partially_completed");
    expect(result.worksheets.map(({ status }) => status)).toEqual(["completed", "calculation_failed"]);
    expect(result.summary).toMatchObject({
      worksheetCount: 2,
      completedWorksheetCount: 1,
      calculationFailedWorksheetCount: 1,
      calculationFailedOptionCount: 7,
    });
  });

  it("does not downgrade request validation errors to option failures", () => {
    const input = request() as unknown as Record<string, unknown>;
    input.inputClassification = "public";
    expect(() => createF6Optimization(input, { calculateScenario: vi.fn() })).toThrow();
  });

  it("verifies the governed baseline request before entering the option loop", () => {
    const input = request();
    const worksheet = input.worksheets[0]!;
    const selectedTable = worksheet.baselineCalculationRequest.worksheetAnalysisAssets.worksheets[0]!.factorTables[0]!;
    selectedTable.rows[0]!.fields.standardDeviation.numericValue = 3;
    const calculateScenario = vi.fn();

    expect(() => createF6Optimization(input, { calculateScenario })).toThrow(/baseline/i);
    expect(calculateScenario).not.toHaveBeenCalled();
  });

  it("verifies every worksheet baseline before calculating any worksheet option", () => {
    const input = request();
    const second = request("Analysis-B");
    input.selectedWorksheetNames.push("Analysis-B");
    input.reportScope.worksheetNames.push("Analysis-B");
    input.worksheets.push(second.worksheets[0]!);
    const selectedTable = input.worksheets[1]!.baselineCalculationRequest.worksheetAnalysisAssets.worksheets[0]!.factorTables[0]!;
    selectedTable.rows[0]!.fields.standardDeviation.numericValue = 3;
    const calculateScenario = vi.fn();

    expect(() => createF6Optimization(input, { calculateScenario })).toThrow(/baseline/i);
    expect(calculateScenario).not.toHaveBeenCalled();
  });

  it("derives capability risk from F5 and records closure only for scenarios that reach target", () => {
    const input = request();
    const specification = input.worksheets[0]!.baselineCalculationRequest.systemSpecification;
    specification.lowerSpecLimit = -3;
    specification.upperSpecLimit = 3;
    input.worksheets[0]!.f3GovernanceRows[0]!.qualitySignals = ["duplicate_conflict"];
    input.worksheets[0]!.f3GovernanceRows[0]!.governanceStatus = "needs_governance";
    refreshGovernedBaseline(input);

    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const capabilityRisk = worksheet.risks.find(({ riskId }) => riskId.endsWith(":f5:capability-below-target"));
    expect(capabilityRisk).toMatchObject({ rating: "Critical", status: "open" });
    expect(capabilityRisk?.evidenceReferences).toEqual([{ artifact: input.f5Reference.artifact, contentHash: input.f5Reference.contentHash }]);
    expect(worksheet.risks).toContainEqual(expect.objectContaining({
      riskId: "Analysis-A:f3:table-a:2",
      rating: "Critical",
      evidenceReferences: [{ artifact: input.f3Reference.artifact, contentHash: input.f3Reference.contentHash }],
    }));
    for (const option of worksheet.options.filter((candidate) => candidate.status === "completed")) {
      expect(option.closedRiskIds).toEqual(option.resultMetrics.cpk >= worksheet.targetCapability.targetCpk
        ? [capabilityRisk!.riskId]
        : []);
    }
  });

  it("preserves nondefault baseline factor semantics and controlled source cells", () => {
    const input = request();
    const baselineRequest = input.worksheets[0]!.baselineCalculationRequest;
    const row = baselineRequest.worksheetAnalysisAssets.worksheets[0]!.factorTables[0]!.rows[0]!;
    row.fields.longTermSafetyFactor.numericValue = 1.25;
    row.fields.longTermSafetyFactor.rawText = "1.25";
    row.fields.standardDeviation.numericValue = 2.5;
    row.fields.standardDeviation.rawText = "2.5";
    row.fields.distribution.rawText = "uniform";
    row.fields.factorName.sourceCell = "Analysis-A!J2";
    row.fields.nominalValue.sourceCell = "Analysis-A!K2";
    row.fields.upperTolerance.sourceCell = "Analysis-A!L2";
    row.fields.lowerTolerance.sourceCell = "Analysis-A!M2";
    row.fields.longTermSafetyFactor.sourceCell = "Analysis-A!N2";
    row.fields.standardDeviation.sourceCell = "Analysis-A!O2";
    row.fields.distribution.sourceCell = "Analysis-A!P2";
    row.fields.unit.sourceCell = "Analysis-A!Q2";
    const recalculated = createCalculation(baselineRequest);
    if (recalculated.status !== "completed") throw new Error("fixture recalculation failed");
    const worksheetInput = input.worksheets[0]!;
    const governanceRows = worksheetInput.f3GovernanceRows.map((governanceRow, index) => ({
      ...structuredClone(governanceRow),
      nominal: recalculated.factors[index]!.input.nominalValue,
      upperTolerance: recalculated.factors[index]!.input.upperTolerance,
      lowerTolerance: recalculated.factors[index]!.input.lowerTolerance,
      sigmaLevel: recalculated.factors[index]!.input.sigmaLevel,
    }));
    const f5 = createF5DataInterpretation({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbook: input.workbook,
      knowledgeBaseVersion: "interpretation-rules-v1",
      worksheets: [{
        worksheetName: worksheetInput.worksheetName,
        imageReference: worksheetInput.f5Worksheet.imageReference,
        governanceRows,
        calculationResult: recalculated,
        imageObservations: [],
      }],
    });
    const f5Worksheet = f5.worksheets[0];
    if (f5Worksheet?.status !== "completed") throw new Error("fixture interpretation failed");
    worksheetInput.baselineCalculation = recalculated;
    worksheetInput.f3GovernanceRows = governanceRows;
    worksheetInput.f5Worksheet = f5Worksheet;

    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const evidence = worksheet.options.find(({ status }) => status === "completed");
    if (evidence?.status !== "completed") throw new Error("expected completed option");
    expect(evidence.scenarioEvidence.calculation.factors[0]!.input).toMatchObject({
      longTermSafetyFactor: 1.25,
      sigmaLevel: 2.5,
      distribution: "uniform",
    });
    expect(evidence.scenarioEvidence.calculation.factors[0]!.trace.sourceCells).toContain("Analysis-A!O2");
  });

  it("does not apply unrelated supplier or datum evidence to worksheet options", () => {
    const input = request();
    input.supplierCapabilityEvidence = [
      {
        evidenceVersion: "supplier-capability-v1", supplierReference: "supplier-a", processFamily: "cnc", partCategory: "category",
        capabilityTier: "T1", achievableToleranceBand: 100, distribution: "normal",
        source: "supplier-a.json", effectiveVersion: "2026-Q3", contentHash: "c".repeat(64),
      },
      {
        evidenceVersion: "supplier-capability-v1", supplierReference: "supplier-b", processFamily: "casting", partCategory: "Casting",
        capabilityTier: "T1", achievableToleranceBand: 100, distribution: "normal",
        source: "supplier-b.json", effectiveVersion: "2026-Q3", contentHash: "d".repeat(64),
      },
    ];
    input.datumEvidence = [{
      evidenceVersion: "datum-strategy-v1", worksheetName: input.worksheets[0]!.worksheetName, datumFace: "Z", stackStart: "Z",
      factorDirections: [{ tableId: "unrelated-table", sourceRow: 99, direction: 1 }],
      datumChainEdges: [{ from: "Z", to: "Y" }], crossSubsystemRelations: [], drawingEvidence: ["unrelated.pdf"],
      reviewStatus: "confirmed", source: "datum-unrelated.json", effectiveVersion: "v1", contentHash: "e".repeat(64),
    }];

    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    expect(worksheet.options.slice(0, 7).filter((option) => option.status === "completed"
      && option.toleranceChanges.length > 0
      && option.optionKind !== "centering_plus_tighten")
      .every((option) => option.status === "completed"
        && option.feasibility.status === "insufficient_evidence"
        && option.feasibility.evidenceReferences.length === 0)).toBe(true);
    expect(worksheet.options[7]).toMatchObject({ status: "insufficient_evidence", evidenceReferences: [] });
    expect(worksheet.options[8]).toMatchObject({ status: "insufficient_evidence", evidenceReferences: [] });
    expect(worksheet.options[7]).not.toHaveProperty("evidenceScope");
    expect(worksheet.options[8]).not.toHaveProperty("evidenceScope");
  });

  it.each([
    ["T1", 3, "supported"],
    ["T1", 4, "not_supported"],
    ["T2", 3, "requires_engineering_review"],
  ] as const)("applies bound %s supplier evidence to the top-factor requested band as %s", (capabilityTier, achievableToleranceBand, expectedStatus) => {
    const input = request();
    const evidence = supplierEvidence({ capabilityTier, achievableToleranceBand });
    bindSupplier(input, evidence);

    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const topFactor = worksheet.options[0];
    if (topFactor?.status !== "completed") throw new Error("expected completed top-factor option");
    expect(topFactor.feasibility.status).toBe(expectedStatus);
    expect(topFactor.feasibility.evidenceReferences).toEqual([evidence.source]);
    expect(topFactor.evidenceReferences).toContainEqual({ artifact: evidence.source, contentHash: evidence.contentHash });
    expect(worksheet.options[7]).toMatchObject({
      status: "insufficient_evidence",
      predictedImprovement: "insufficient_evidence",
      feasibility: { status: expectedStatus, evidenceReferences: [evidence.source] },
      evidenceReferences: [{ artifact: evidence.source, contentHash: evidence.contentHash }],
      evidenceScope: {
        kind: "supplier",
        supplierReference: evidence.supplierReference,
        processFamily: evidence.processFamily,
        partCategory: evidence.partCategory,
        evidenceReference: { artifact: evidence.source, contentHash: evidence.contentHash },
      },
    });
    expect(f6OptimizationResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects conflicting supplier bindings and ignores unbound supplier evidence", () => {
    const input = request();
    const bound = supplierEvidence();
    const unrelated = supplierEvidence({
      supplierReference: "supplier-b",
      source: "supplier/b.json",
      contentHash: "d".repeat(64),
    });
    bindSupplier(input, bound);
    input.supplierCapabilityEvidence!.push(unrelated);

    const result = createF6Optimization(input);
    expect(result.worksheets[0]!.options[7]).toMatchObject({
      evidenceReferences: [{ artifact: bound.source, contentHash: bound.contentHash }],
    });
    expect(JSON.stringify(result.worksheets[0]!.options[7])).not.toContain(unrelated.source);

    input.worksheets[0]!.supplierBindings.push({ ...input.worksheets[0]!.supplierBindings[0]! });
    expect(() => createF6Optimization(input)).toThrow();
  });

  it("ranks independently verified closed severe risk before an otherwise tied option", () => {
    const result = createF6Optimization(request());
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const template = worksheet.options.find((option) => option.status === "completed")!;
    if (template.status !== "completed") throw new Error("expected completed option");
    const risks = [{
      riskId: "verified-risk",
      category: "Supplier" as const,
      rating: "Critical" as const,
      status: "closed" as const,
      reason: "Closed by governed supplier evidence.",
      evidenceReferences: [{ artifact: "risk/closure.json", contentHash: "e".repeat(64) }],
    }];
    const options = [
      { ...structuredClone(template), optionId: "without-closure", impactRank: null, closedRiskIds: [] },
      { ...structuredClone(template), optionId: "with-closure", impactRank: null, closedRiskIds: [risks[0]!.riskId] },
    ];

    const ranked = rankCompletedOptions(options, worksheet.targetCapability.targetCpk, risks);
    expect(ranked.map(({ optionId, impactRank }) => [optionId, impactRank])).toEqual([
      ["without-closure", 2],
      ["with-closure", 1],
    ]);
  });

  it("ranks target attainment before feasibility and delta Cpk before feasibility", () => {
    const result = createF6Optimization(request());
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const template = worksheet.options.find((option) => option.status === "completed")!;
    if (template.status !== "completed") throw new Error("expected completed option");
    const options = [
      {
        ...structuredClone(template),
        optionId: "supported-non-target",
        impactRank: null,
        resultMetrics: { ...template.resultMetrics, cpk: worksheet.targetCapability.targetCpk - 0.01 },
        deltaCpk: 10,
        feasibility: { status: "supported" as const, reasonCodes: [], evidenceReferences: [] },
      },
      {
        ...structuredClone(template),
        optionId: "review-target",
        impactRank: null,
        resultMetrics: { ...template.resultMetrics, cpk: worksheet.targetCapability.targetCpk },
        deltaCpk: 0.1,
        feasibility: { status: "requires_engineering_review" as const, reasonCodes: [], evidenceReferences: [] },
      },
      {
        ...structuredClone(template),
        optionId: "supported-lower-delta",
        impactRank: null,
        resultMetrics: { ...template.resultMetrics, cpk: worksheet.targetCapability.targetCpk },
        deltaCpk: 0.2,
        feasibility: { status: "supported" as const, reasonCodes: [], evidenceReferences: [] },
      },
      {
        ...structuredClone(template),
        optionId: "review-higher-delta",
        impactRank: null,
        resultMetrics: { ...template.resultMetrics, cpk: worksheet.targetCapability.targetCpk },
        deltaCpk: 0.3,
        feasibility: { status: "requires_engineering_review" as const, reasonCodes: [], evidenceReferences: [] },
      },
    ];

    const ranked = rankCompletedOptions(options, worksheet.targetCapability.targetCpk, []);
    expect([...ranked].sort((left, right) => left.impactRank! - right.impactRank!).map(({ optionId }) => optionId)).toEqual([
      "review-higher-delta",
      "supported-lower-delta",
      "review-target",
      "supported-non-target",
    ]);
  });

  it("treats a more negative delta Dpm as the larger improvement before yield and feasibility", () => {
    const result = createF6Optimization(request());
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const template = worksheet.options.find((option) => option.status === "completed")!;
    if (template.status !== "completed") throw new Error("expected completed option");
    const smallerReduction = {
      ...structuredClone(template),
      optionId: "smaller-reduction",
      impactRank: null,
      resultMetrics: { ...template.resultMetrics, cpk: worksheet.targetCapability.targetCpk },
      deltaCpk: 0.5,
      deltaDpm: -10,
      deltaYield: 0.9,
      feasibility: { status: "supported" as const, reasonCodes: ["supported"], evidenceReferences: [] },
    };
    const largerReduction = {
      ...structuredClone(template),
      optionId: "larger-reduction",
      impactRank: null,
      resultMetrics: { ...template.resultMetrics, cpk: worksheet.targetCapability.targetCpk },
      deltaCpk: 0.5,
      deltaDpm: -100,
      deltaYield: 0.1,
      feasibility: {
        status: "requires_engineering_review" as const,
        reasonCodes: ["review"],
        evidenceReferences: [],
      },
    };

    const ranked = rankCompletedOptions([smallerReduction, largerReduction], worksheet.targetCapability.targetCpk, []);
    expect([...ranked].sort((left, right) => left.impactRank! - right.impactRank!).map(({ optionId }) => optionId)).toEqual([
      "larger-reduction",
      "smaller-reduction",
    ]);
  });

  it("ranks verified severe risk closure before feasibility after preceding impact ties", () => {
    const result = createF6Optimization(request());
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const template = worksheet.options.find((option) => option.status === "completed")!;
    if (template.status !== "completed") throw new Error("expected completed option");
    const risk = {
      riskId: "verified-high-risk",
      category: "Supplier" as const,
      rating: "High" as const,
      status: "closed" as const,
      reason: "Closed by governed supplier evidence.",
      evidenceReferences: [{ artifact: "risk/closure.json", contentHash: "e".repeat(64) }],
    };
    const common = {
      ...structuredClone(template),
      impactRank: null,
      resultMetrics: { ...template.resultMetrics, cpk: worksheet.targetCapability.targetCpk },
      deltaCpk: 0.5,
      deltaDpm: -100,
      deltaYield: 0.25,
    };
    const ranked = rankCompletedOptions([
      {
        ...common,
        optionId: "higher-yield-without-closure",
        deltaYield: 0.3,
        closedRiskIds: [],
        feasibility: { status: "not_supported" as const, reasonCodes: [], evidenceReferences: [] },
      },
      {
        ...common,
        optionId: "supported-without-closure",
        closedRiskIds: [],
        feasibility: { status: "supported" as const, reasonCodes: [], evidenceReferences: [] },
      },
      {
        ...common,
        optionId: "review-with-closure",
        closedRiskIds: [risk.riskId],
        feasibility: { status: "requires_engineering_review" as const, reasonCodes: [], evidenceReferences: [] },
      },
    ], worksheet.targetCapability.targetCpk, [risk]);

    expect([...ranked].sort((left, right) => left.impactRank! - right.impactRank!).map(({ optionId }) => optionId)).toEqual([
      "higher-yield-without-closure",
      "review-with-closure",
      "supported-without-closure",
    ]);
  });

  it("uses feasibility only after impact ties and optionId as the deterministic final tie-break", () => {
    const result = createF6Optimization(request());
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    const template = worksheet.options.find((option) => option.status === "completed")!;
    if (template.status !== "completed") throw new Error("expected completed option");
    const tied = {
      ...structuredClone(template),
      impactRank: null,
      resultMetrics: { ...template.resultMetrics, cpk: worksheet.targetCapability.targetCpk },
      deltaCpk: 0.5,
      deltaDpm: -100,
      deltaYield: 0.25,
      closedRiskIds: [],
    };
    const ranked = rankCompletedOptions([
      {
        ...tied,
        optionId: "z-review",
        feasibility: { status: "requires_engineering_review" as const, reasonCodes: [], evidenceReferences: [] },
      },
      {
        ...tied,
        optionId: "z-supported",
        feasibility: { status: "supported" as const, reasonCodes: [], evidenceReferences: [] },
      },
      {
        ...tied,
        optionId: "a-supported",
        feasibility: { status: "supported" as const, reasonCodes: [], evidenceReferences: [] },
      },
    ], worksheet.targetCapability.targetCpk, []);

    expect([...ranked].sort((left, right) => left.impactRank! - right.impactRank!).map(({ optionId }) => optionId)).toEqual([
      "a-supported",
      "z-supported",
      "z-review",
    ]);
  });

  it("uses datum evidence only when one record exactly covers the worksheet factor scope", () => {
    const input = request();
    const factorDirections = input.worksheets[0]!.baselineCalculation.factors.map(({ source }) => ({
      tableId: source.tableId,
      sourceRow: source.sourceRow,
      direction: 1 as const,
    }));
    const exactDatum = {
      evidenceVersion: "datum-strategy-v1" as const,
      worksheetName: input.worksheets[0]!.worksheetName,
      datumFace: "A",
      stackStart: "A",
      factorDirections,
      datumChainEdges: [{ from: "A", to: "B" }],
      crossSubsystemRelations: [],
      drawingEvidence: ["drawings/a.pdf"],
      reviewStatus: "confirmed" as const,
      source: "datum/a.json",
      effectiveVersion: "v1",
      contentHash: "c".repeat(64),
    };
    input.datumEvidence = [exactDatum];
    let result = createF6Optimization(input);
    expect(result.worksheets[0]!.options[8]).toMatchObject({
      status: "insufficient_evidence",
      evidenceReferences: [{ artifact: exactDatum.source, contentHash: exactDatum.contentHash }],
      evidenceScope: {
        kind: "datum",
        worksheetName: exactDatum.worksheetName,
        factorSources: exactDatum.factorDirections,
        evidenceReference: { artifact: exactDatum.source, contentHash: exactDatum.contentHash },
      },
    });

    input.datumEvidence.push({ ...exactDatum, source: "datum/b.json", contentHash: "d".repeat(64) });
    result = createF6Optimization(input);
    expect(result.worksheets[0]!.options[8]).toMatchObject({ status: "insufficient_evidence", evidenceReferences: [] });
    expect(result.worksheets[0]!.options[8]).not.toHaveProperty("evidenceScope");
  });

  it("binds datum evidence to its worksheet when table and source identities collide", () => {
    const input = request();
    const second = request("Analysis-B");
    input.selectedWorksheetNames.push("Analysis-B");
    input.reportScope.worksheetNames.push("Analysis-B");
    input.worksheets.push(second.worksheets[0]!);
    input.datumEvidence = input.worksheets.map((worksheet, index) => ({
      evidenceVersion: "datum-strategy-v1" as const,
      worksheetName: worksheet.worksheetName,
      datumFace: index === 0 ? "A" : "B",
      stackStart: index === 0 ? "A" : "B",
      factorDirections: worksheet.baselineCalculation.factors.map(({ source }) => ({
        tableId: source.tableId,
        sourceRow: source.sourceRow,
        direction: 1 as const,
      })),
      datumChainEdges: [{ from: index === 0 ? "A" : "B", to: "C" }],
      crossSubsystemRelations: [],
      drawingEvidence: [`drawings/${worksheet.worksheetName}.pdf`],
      reviewStatus: "confirmed" as const,
      source: `datum/${worksheet.worksheetName}.json`,
      effectiveVersion: "v1",
      contentHash: String(index + 3).repeat(64),
    }));

    const result = createF6Optimization(input);
    result.worksheets.forEach((worksheet, index) => {
      expect(worksheet.options[8]).toMatchObject({
        evidenceReferences: [{
          artifact: input.datumEvidence![index]!.source,
          contentHash: input.datumEvidence![index]!.contentHash,
        }],
        evidenceScope: { worksheetName: worksheet.worksheetName },
      });
    });
  });

  it("computes governed ROI and carries cost lineage when every ranked supported option has positive cost", () => {
    const input = request();
    for (const sourceRow of [2, 3, 4, 5]) {
      bindSupplier(input, supplierEvidence({
        supplierReference: `supplier-${sourceRow}`,
        achievableToleranceBand: 0,
        source: `supplier/${sourceRow}.json`,
        contentHash: String(sourceRow).repeat(64),
      }), sourceRow);
    }
    input.costEvidence = {
      evidenceVersion: "cost-model-v1",
      model: "controlled-model",
      unit: "relative-points",
      optionCosts: [
        { optionKind: "reduce_top_contributor_20", cost: 12 },
        { optionKind: "reduce_top_3_contributors_30", cost: 12 },
        { optionKind: "mean_shift_centering", cost: 12 },
        { optionKind: "reverse_solve_single_factor", cost: 12 },
        { optionKind: "reverse_solve_top_3", cost: 12 },
        { optionKind: "rss_apportionment", cost: 12 },
        { optionKind: "centering_plus_tighten", cost: 12 },
      ],
      roiPolicyVersion: "f6-delta-cpk-per-cost-v1",
      roiCalculationReference: { artifact: "cost/roi-result.json", contentHash: "c".repeat(64) },
      source: "cost/model.json",
      effectiveVersion: "2026-08-15",
      contentHash: "d".repeat(64),
    };
    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    expect(worksheet.roiStatus).toBe("computed");
    const rankedSupported = worksheet.options.filter((option) =>
      option.status === "completed" && option.feasibility.status === "supported" && option.impactRank !== null);
    expect(rankedSupported.length).toBeGreaterThan(0);
    for (const option of rankedSupported) {
      expect(option.relativeCost).toBe(12);
      expect(option.roiScore).toBe(Math.max(option.deltaCpk, 0) / 12);
      expect(option.evidenceReferences).toEqual(expect.arrayContaining([
        { artifact: input.costEvidence.source, contentHash: input.costEvidence.contentHash },
        input.costEvidence.roiCalculationReference,
      ]));
    }
  });

  it("keeps every ROI score uncomputed when a ranked supported option has zero cost", () => {
    const input = request();
    bindSupplier(input, supplierEvidence({ achievableToleranceBand: 0 }), 2);
    input.costEvidence = {
      evidenceVersion: "cost-model-v1",
      model: "controlled-model",
      unit: "relative-points",
      optionCosts: [{ optionKind: "reduce_top_contributor_20", cost: 0 }],
      roiPolicyVersion: "f6-delta-cpk-per-cost-v1",
      roiCalculationReference: { artifact: "cost/roi-result.json", contentHash: "c".repeat(64) },
      source: "cost/model.json",
      effectiveVersion: "2026-08-15",
      contentHash: "d".repeat(64),
    };

    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    expect(worksheet.roiStatus).toBe("not_computed");
    expect(worksheet.options.filter((option) => option.status === "completed").every((option) => option.roiScore === "not_computed")).toBe(true);
  });

  it("carries governed cost lineage on every option when only some options have a numeric cost", () => {
    const input = request();
    input.costEvidence = {
      evidenceVersion: "cost-model-v1",
      model: "controlled-model",
      unit: "relative-points",
      optionCosts: [{ optionKind: "reduce_top_contributor_20", cost: 12 }],
      roiPolicyVersion: "f6-delta-cpk-per-cost-v1",
      roiCalculationReference: { artifact: "cost/roi-result.json", contentHash: "c".repeat(64) },
      source: "cost/model.json",
      effectiveVersion: "2026-08-15",
      contentHash: "d".repeat(64),
    };

    const result = createF6Optimization(input);
    const worksheet = result.worksheets[0];
    if (worksheet?.status === "input_rejected" || worksheet === undefined) throw new Error("expected ready worksheet");
    for (const option of worksheet.options) {
      expect(option.evidenceReferences).toEqual(expect.arrayContaining([
        { artifact: input.costEvidence.source, contentHash: input.costEvidence.contentHash },
        input.costEvidence.roiCalculationReference,
      ]));
    }
  });

  it("exports only the public orchestrator and no private optimization helpers", () => {
    expect(typeof createF6Optimization).toBe("function");
    expect(Object.keys(packageRoot).filter((key) => key.toLowerCase().includes("optimization"))).toEqual(["createF6Optimization"]);
  });
});

describe("createF6Optimization V2", () => {
  const notProvidedInputs = {
    inputDecisions: {
      analysisContext: { outcome: "NOT_PROVIDED" as const },
      optimizationTargets: { outcome: "NOT_PROVIDED" as const },
    },
  };

  it("generates governed OP1 OP2 OP3 scenarios when either side Cpk is below the worksheet target", () => {
    const result = createF6OptimizationV2(
      request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 10, targetSigmaLevel: 30 }),
      notProvidedInputs,
    );
    const worksheet = result.worksheets[0]!;

    expect(result.optimizationVersion).toBe("f6-optimization-v2");
    expect(result.runStatus).toBe("COMPLETED");
    expect(result.provenance.reportScope).toEqual({ worksheetNames: ["Analysis-A"], blockedWorksheetNames: [] });
    expect(result.provenance.modelInterpretationDecision).toEqual({ outcome: "NOT_PROVIDED" });
    expect(worksheet.runStatus).toBe("COMPLETED");
    expect(worksheet.options.map(({ optionId }) => optionId)).toEqual([
      "Analysis-A:builtin-top3:OP1",
      "Analysis-A:builtin-top3:OP2",
      "Analysis-A:builtin-top3:OP3",
    ]);
    expect(worksheet.options.every(({ status }) => status === "completed")).toBe(true);
    const contexts = worksheet.options.map((option) => option.status === "completed" ? option.policyContext : undefined);
    expect(contexts.map((context) => context?.reductions.map(({ reductionRatio }) => reductionRatio))).toEqual([
      [0.25, 0.1, 0.1],
      [0.2, 0.15, 0.15],
      [0.4, 0.05, 0.05],
    ]);
    expect(contexts.map((context) => context?.reductions.map(({ factor }) => factor))).toEqual([
      contexts[0]?.reductions.map(({ factor }) => factor),
      contexts[0]?.reductions.map(({ factor }) => factor),
      contexts[0]?.reductions.map(({ factor }) => factor),
    ]);
    expect(worksheet.options.every((option) => option.status !== "completed" || (option.resultMetrics.lowerCpk !== undefined && option.resultMetrics.upperCpk !== undefined))).toBe(true);
    expect(result.summary).toMatchObject({ candidateOptionCount: 0, completedOptionCount: 3 });
  });

  it("keeps candidate-only behavior when both side Cpk values meet the worksheet target", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -20, upperSpecLimit: 20, targetCpk: 1.33, targetSigmaLevel: 4 });

    const result = createF6OptimizationV2(input, notProvidedInputs);

    expect(result.worksheets[0]!.options).toEqual([
      expect.objectContaining({ status: "candidate", reasonCode: "target_not_provided" }),
    ]);
  });

  it("isolates one built-in calculation failure and continues the remaining options", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 10, targetSigmaLevel: 30 });
    const calculateScenario = vi.fn((scenarioInput) => {
      if (scenarioInput.scenario.scenarioId.endsWith(":OP2")) throw new Error("controlled_policy_failure");
      return calculateF6Scenario(scenarioInput);
    });

    const result = createF6OptimizationV2(input, notProvidedInputs, { calculateScenario });

    expect(result.worksheets[0]!.options.map(({ status }) => status)).toEqual(["completed", "calculation_failed", "completed"]);
    expect(result.worksheets[0]!.runStatus).toBe("PARTIALLY_COMPLETED");
    expect(result.summary).toMatchObject({ completedOptionCount: 2, calculationFailedOptionCount: 1 });
  });

  it("keeps built-in and caller-authorized options in separate stable namespaces", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 10, targetSigmaLevel: 30 });
    const baseline = input.worksheets[0]!.baselineCalculation;
    const baselineFactor = baseline.factors[0]!;
    const factor = {
      worksheetName: baselineFactor.source.worksheetName,
      tableId: baselineFactor.source.tableId,
      sourceRow: baselineFactor.source.sourceRow,
      factorName: baselineFactor.factorName,
      unit: baselineFactor.unit,
    };
    const targets = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      targetVersion: "f6-optimization-targets-v1" as const,
      workbookContentHash: input.workbook.contentHash,
      worksheets: [{
        worksheetName: input.worksheets[0]!.worksheetName,
        tableId: baseline.worksheetSelection.tableId,
        baselineIdentity: {
          calculationVersion: baseline.calculationVersion,
          projectReference: baseline.projectReference,
          runReference: baseline.runReference,
          workbookContentHash: baseline.workbookContentHash,
          worksheetName: baseline.worksheetSelection.worksheetName,
          tableId: baseline.worksheetSelection.tableId,
        },
        targets: [{ targetId: "caller-ratio", targetType: "improvement_ratio" as const, factor, ratio: 0.2, appliesTo: "tolerance_band" as const }],
      }],
    };

    const result = createF6OptimizationV2(input, {
      optimizationTargets: targets,
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "targets.json", contentHash: "c".repeat(64) } },
      },
    });

    expect(result.worksheets[0]!.options.map(({ optionId }) => optionId)).toEqual([
      "Analysis-A:builtin-top3:OP1",
      "Analysis-A:builtin-top3:OP2",
      "Analysis-A:builtin-top3:OP3",
      "Analysis-A:caller-ratio",
    ]);
  });

  it("scales an asymmetric tolerance band around its center and recalculates through F4", () => {
    const input = request();
    const baseline = input.worksheets[0]!.baselineCalculation;
    const baselineFactor = baseline.factors[0]!;
    const factor = {
      worksheetName: baselineFactor.source.worksheetName,
      tableId: baselineFactor.source.tableId,
      sourceRow: baselineFactor.source.sourceRow,
      factorName: baselineFactor.factorName,
      unit: baselineFactor.unit,
    };
    const targets = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      targetVersion: "f6-optimization-targets-v1" as const,
      workbookContentHash: input.workbook.contentHash,
      worksheets: [{
        worksheetName: input.worksheets[0]!.worksheetName,
        tableId: baseline.worksheetSelection.tableId,
        baselineIdentity: {
          calculationVersion: baseline.calculationVersion,
          projectReference: baseline.projectReference,
          runReference: baseline.runReference,
          workbookContentHash: baseline.workbookContentHash,
          worksheetName: baseline.worksheetSelection.worksheetName,
          tableId: baseline.worksheetSelection.tableId,
        },
        targets: [{ targetId: "ratio-target", targetType: "improvement_ratio" as const, factor, ratio: 0.2, appliesTo: "tolerance_band" as const }],
      }],
    };
    const result = createF6OptimizationV2(input, {
      optimizationTargets: targets,
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "targets.json", contentHash: "c".repeat(64) } },
      },
    });
    const option = result.worksheets[0]!.options[0];

    expect(option).toMatchObject({ status: "completed", targetId: "ratio-target" });
    if (option?.status !== "completed") throw new Error("expected completed option");
    expect(option.scenarioEvidence.factorOverrides[0]).toMatchObject({
      factor,
      upperTolerance: 2.1,
      lowerTolerance: -1.1,
    });
    expect(option.resultMetrics.rssSigma).toBeLessThan(option.baselineMetrics.rssSigma);
    expect(result.provenance.optimizationTargetsDecision.outcome).toBe("CALLER_AUTHORIZED");
  });

  it("exports only the V2 optimizer from the package entrypoint", () => {
    expect(packageRoot.createF6Optimization).toBe(createF6OptimizationV2);
  });
});