import { describe, expect, it, vi } from "vitest";
import {
  createF5MultimodalFactorSetHash,
  createF5MultimodalRequestHash,
  f6OptimizationResultV3Schema,
  f6OptimizationResultV4Schema,
  f6LegacyOptimizationResultSchema as f6OptimizationResultSchema,
  type CalculationRequest,
  type F5MultimodalArtifactV3,
  type F6OptimizationRequest,
} from "@ai-assist/contracts";
import * as packageRoot from "./index.js";
import { createCalculation } from "./calculation.js";
import { createF5DataInterpretation } from "./f5-data-interpretation.js";
import { calculateF6Scenario } from "./f6-scenario-adapter.js";
import {
  createF6Optimization as createF6OptimizationV2,
  createF6OptimizationV4,
  createF6OptimizationV3,
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
  factorCount = 4,
): CalculationRequest {
  const tolerances = ([[-1.5, 2.5], [-1, 1], [-0.75, 0.75], [-0.5, 0.5]] as const).slice(0, factorCount);
  const rows = tolerances.map(([lower, upper], index) => {
    const row = index + 2;
    return {
      sourceRow: row,
      factorOrdinal: { value: String.fromCharCode(65 + index), rawText: String.fromCharCode(65 + index), sourceCell: `${worksheetName}!Z${row}` },
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
          dataRange: { startRow: 2, endRow: factorCount + 1 },
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
      summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: factorCount, blockingIssueCount: 0, advisoryIssueCount: 0 },
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
  factorCount = 4,
): F6OptimizationRequest {
  const baselineRequest = calculationRequest(worksheetName, specification, factorCount);
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
    factorOrdinal: { value: String.fromCharCode(65 + index), rawText: String.fromCharCode(65 + index), sourceCell: `${worksheetName}!Z${factor.source.sourceRow}` },
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
    knowledgeBaseVersion: "interpretation-rules-v2",
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
    f0Versions: { knowledgeBaseVersion: "v1", capabilityVersion: "capability-v1", interpretationVersion: "interpretation-rules-v2" },
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
    knowledgeBaseVersion: "interpretation-rules-v2",
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

function multimodalArtifact(input: F6OptimizationRequest): F5MultimodalArtifactV3 {
  const worksheets = input.worksheets.map((worksheet) => {
    const factorRows = worksheet.baselineCalculation.factors.map((factor, index) => ({
      worksheetName: worksheet.worksheetName,
      tableId: factor.source.tableId,
      sourceRow: factor.source.sourceRow,
      factorOrdinal: structuredClone(worksheet.f3GovernanceRows[index]!.factorOrdinal),
      factorName: factor.factorName,
      partName: worksheet.f3GovernanceRows[index]!.partSubsystem,
      partCategory: worksheet.f3GovernanceRows[index]!.partCategory,
      drawingNumber: worksheet.f3GovernanceRows[index]!.drawingNumber,
      dimId: worksheet.f3GovernanceRows[index]!.dimId,
      nominal: factor.input.nominalValue,
      upperTolerance: factor.input.upperTolerance,
      lowerTolerance: factor.input.lowerTolerance,
      longTermSafetyFactor: factor.input.longTermSafetyFactor,
      sigmaLevel: factor.input.sigmaLevel,
      distribution: factor.input.distribution,
      sourceCells: {},
    }));
    const requestWithoutHash = {
      contractVersion: "f5-multimodal-request-v3" as const,
      inputClassification: "confidential" as const,
      sessionId: "session-106",
      revision: 1,
      inputRevision: 1,
      workbook: structuredClone(input.workbook),
      worksheetName: worksheet.worksheetName,
      tableId: worksheet.baselineCalculation.worksheetSelection.tableId,
      activeFactorCount: factorRows.length,
      factorSetHash: createF5MultimodalFactorSetHash(factorRows),
      image: { mediaType: "image/png" as const, contentHash: IMAGE_HASH, byteLength: 128, artifactPath: `images/${worksheet.worksheetName}.png` },
      factorRows,
    };
    const multimodalRequest = { ...requestWithoutHash, requestHash: createF5MultimodalRequestHash(requestWithoutHash) };
    return {
      request: multimodalRequest,
      result: {
        contractVersion: "f5-multimodal-result-v3" as const,
        outputClassification: "confidential" as const,
        requestHash: multimodalRequest.requestHash,
        sessionId: multimodalRequest.sessionId,
        revision: multimodalRequest.revision,
        inputRevision: multimodalRequest.inputRevision,
        workbookContentHash: input.workbook.contentHash,
        worksheetName: worksheet.worksheetName,
        tableId: multimodalRequest.tableId,
        imageContentHash: multimodalRequest.image.contentHash,
        model: { modelId: "trusted-image-model", supportsImage: true as const },
        imageTableInterpretation: `Interpret ${worksheet.worksheetName} image and complete Factor table.`,
        rowMappings: factorRows.map((factor) => ({
          worksheetName: factor.worksheetName,
          tableId: factor.tableId,
          sourceRow: factor.sourceRow,
          factorOrdinal: structuredClone(factor.factorOrdinal),
          mappingStatus: "matched" as const,
          visibleStatus: "visible" as const,
          interpretation: `Mapped ${factor.factorName}.`,
        })),
      },
    };
  });
  return {
    contractVersion: "f5-multimodal-artifact-v3",
    outputClassification: "confidential",
    sessionId: "session-106",
    revision: 1,
    inputRevision: 1,
    workbookContentHash: input.workbook.contentHash,
    selectedWorksheetNames: [...input.selectedWorksheetNames],
    worksheets,
  };
}

const interactionLanguage = {
  languageTag: "en-US",
  uiCatalogLanguage: "en" as const,
  lockedAtTurnId: "turn-1",
  source: "workflow_start" as const,
  fallbackUsed: false,
};

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
      knowledgeBaseVersion: "interpretation-rules-v2",
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
    expect(Object.keys(packageRoot).filter((key) => key.toLowerCase().includes("optimization"))).toEqual([
      "createF6Optimization",
      "createF6OptimizationV3",
      "createF6OptimizationV4",
    ]);
  });
});

describe("createF6Optimization V4", () => {
  function v4Inputs(
    input: F6OptimizationRequest,
    optimizationTargets?: unknown,
  ) {
    return {
      interactionLanguage,
      multimodalInterpretation: multimodalArtifact(input),
      multimodalReference: { artifact: "f5/multimodal.json", contentHash: HASH },
      ...(optimizationTargets === undefined ? {} : { optimizationTargets, optimizationTargetsDecision: { outcome: "CALLER_AUTHORIZED" as const } }),
    };
  }

  function baselineIdentityForV4(input: F6OptimizationRequest) {
    const baseline = input.worksheets[0]!.baselineCalculation;
    return {
      calculationVersion: baseline.calculationVersion,
      projectReference: baseline.projectReference,
      runReference: baseline.runReference,
      workbookContentHash: baseline.workbookContentHash,
      worksheetName: baseline.worksheetSelection.worksheetName,
      tableId: baseline.worksheetSelection.tableId,
    };
  }

  function systemIdentityForV4(input: F6OptimizationRequest) {
    const baseline = input.worksheets[0]!.baselineCalculation;
    return {
      baselineIdentity: baselineIdentityForV4(input),
      designNominal: baseline.system.designNominal,
      mean: baseline.system.mean,
      rssSigma: baseline.system.rssSigma,
      lowerSpecLimit: baseline.capability.lowerSpecLimit,
      upperSpecLimit: baseline.capability.upperSpecLimit,
      targetCpk: baseline.capability.targetCpk,
      traceReferences: baseline.traceRecords.map(({ outputField, formulaId, formulaVersion }) => ({ outputField, formulaId, formulaVersion })),
    };
  }

  function assertRequestReplayFromSnapshot(
    replayedRequest: CalculationRequest,
    snapshot: {
      readonly system: {
        readonly designNominal: number;
        readonly additionalMeanShift: number;
      };
      readonly capability: {
        readonly lowerSpecLimit: number;
        readonly upperSpecLimit: number;
        readonly targetCpk: number;
      };
      readonly factors: ReadonlyArray<{
        readonly factor: { readonly worksheetName: string; readonly tableId: string; readonly sourceRow: number };
        readonly nominalValue: number;
        readonly lowerTolerance: number;
        readonly upperTolerance: number;
      }>;
    },
  ) {
    expect(replayedRequest.scenarioOverrides).toEqual([]);
    expect(replayedRequest.systemSpecification.designNominal).toBeCloseTo(snapshot.system.designNominal, 12);
    expect(replayedRequest.systemSpecification.additionalMeanShift).toBeCloseTo(snapshot.system.additionalMeanShift, 12);
    expect(replayedRequest.systemSpecification.lowerSpecLimit).toBeCloseTo(snapshot.capability.lowerSpecLimit, 12);
    expect(replayedRequest.systemSpecification.upperSpecLimit).toBeCloseTo(snapshot.capability.upperSpecLimit, 12);
    expect(replayedRequest.systemSpecification.targetCpk).toBeCloseTo(snapshot.capability.targetCpk, 12);

    const rowByIdentity = new Map<string, CalculationRequest["worksheetAnalysisAssets"]["worksheets"][number]["factorTables"][number]["rows"][number]>();
    for (const worksheet of replayedRequest.worksheetAnalysisAssets.worksheets) {
      for (const table of worksheet.factorTables) {
        for (const row of table.rows) {
          rowByIdentity.set(`${worksheet.worksheetName}\u0000${table.tableId}\u0000${row.sourceRow}`, row);
        }
      }
    }

    expect(snapshot.factors).toHaveLength(rowByIdentity.size);
    for (const factor of snapshot.factors) {
      const key = `${factor.factor.worksheetName}\u0000${factor.factor.tableId}\u0000${factor.factor.sourceRow}`;
      const row = rowByIdentity.get(key);
      expect(row, `missing factor row for ${key}`).toBeDefined();
      expect(row!.sourceRow).toBe(factor.factor.sourceRow);
      expect(row!.fields.nominalValue.numericValue).toBeCloseTo(factor.nominalValue, 12);
      expect(row!.fields.lowerTolerance.numericValue).toBeCloseTo(factor.lowerTolerance, 12);
      expect(row!.fields.upperTolerance.numericValue).toBeCloseTo(factor.upperTolerance, 12);
    }
  }

  it("keeps baseline PASS worksheets at baseline with no optimization steps", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -20, upperSpecLimit: 20, targetCpk: 1.33, targetSigmaLevel: 4 });

    const result = createF6OptimizationV4(input, v4Inputs(input));
    const worksheet = result.worksheets[0]!;

    expect(worksheet.selectedResult.status).toBe("baseline_meets_target");
    expect(worksheet.steps.map((step) => step.status)).toEqual(["NOT_NEEDED", "NOT_NEEDED", "NOT_NEEDED"]);
    expect(result.summary).toMatchObject({ baselineMeetsTargetWorksheetCount: 1, optimizedWorksheetCount: 0, noValidatedResultWorksheetCount: 0 });
    expect(f6OptimizationResultV4Schema.parse(result)).toEqual(result);
  });

  it("uses explicit system/process-shift classification for Step 1 centering and stops when F4 passes", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 1.33, targetSigmaLevel: 4 });
    const baselineRequest = input.worksheets[0]!.baselineCalculationRequest;
    baselineRequest.worksheetAnalysisAssets.worksheets[0]!.factorTables[0]!.rows[0]!.fields.nominalValue.numericValue = 4;
    baselineRequest.worksheetAnalysisAssets.worksheets[0]!.factorTables[0]!.rows[0]!.fields.nominalValue.rawText = "4";
    refreshGovernedBaseline(input);

    const targets = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      targetVersion: "f6-optimization-targets-v2" as const,
      workbookContentHash: input.workbook.contentHash,
      worksheets: [{
        worksheetName: input.worksheets[0]!.worksheetName,
        tableId: input.worksheets[0]!.baselineCalculation.worksheetSelection.tableId,
        baselineIdentity: baselineIdentityForV4(input),
        targets: [{
          targetId: "sys-shift",
          targetType: "system_mean_shift" as const,
          systemIdentity: systemIdentityForV4(input),
          target: { targetMean: 0, unit: "mm" },
        }],
      }],
    };
    const calls: Array<{ scenarioId: string; inputScenarioId: string | null }> = [];
    const calculateScenario = vi.fn((scenarioInput: Parameters<typeof calculateF6Scenario>[0]) => {
      calls.push({
        scenarioId: scenarioInput.scenario.scenarioId,
        inputScenarioId: scenarioInput.baselineRequest.scenarioOverrides.at(-1)?.scenarioId ?? null,
      });
      return calculateF6Scenario(scenarioInput);
    });

    const result = createF6OptimizationV4(input, v4Inputs(input, targets), { calculateScenario });
    const worksheet = result.worksheets[0]!;

    expect(worksheet.steps[0]).toMatchObject({ step: "meanResponseCentering", status: "COMPLETED_TARGET_MET" });
    expect(worksheet.steps[1]).toMatchObject({ status: "NOT_RUN_EARLIER_STEP_MET_TARGET" });
    expect(worksheet.steps[2]).toMatchObject({ status: "NOT_RUN_EARLIER_STEP_MET_TARGET" });
    expect(worksheet.selectedResult.status).toBe("step1_centered");
    expect(calls[0]).toMatchObject({ scenarioId: expect.stringContaining(":step1:"), inputScenarioId: null });
  });

  it("marks factor nominal centering without signed direction evidence as confirmation-required and continues Step 2", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 2, targetSigmaLevel: 6 });
    const factor = input.worksheets[0]!.baselineCalculation.factors[0]!;
    const targets = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      targetVersion: "f6-optimization-targets-v2" as const,
      workbookContentHash: input.workbook.contentHash,
      worksheets: [{
        worksheetName: input.worksheets[0]!.worksheetName,
        tableId: input.worksheets[0]!.baselineCalculation.worksheetSelection.tableId,
        baselineIdentity: baselineIdentityForV4(input),
        targets: [{
          targetId: "factor-nominal",
          targetType: "factor_nominal" as const,
          factor: {
            worksheetName: factor.source.worksheetName,
            tableId: factor.source.tableId,
            sourceRow: factor.source.sourceRow,
            factorName: factor.factorName,
            unit: factor.unit,
          },
          nominalValue: factor.input.nominalValue + 0.5,
          unit: factor.unit,
        }],
      }],
    };

    const result = createF6OptimizationV4(input, v4Inputs(input, targets));
    const worksheet = result.worksheets[0]!;

    expect(worksheet.steps[0]).toEqual({
      step: "meanResponseCentering",
      status: "ENGINEERING_CONFIRMATION_REQUIRED",
      reasonCode: "signed_direction_evidence_required_for_factor_nominal_centering",
    });
    expect(worksheet.steps[1].status).not.toBe("NOT_NEEDED");
  });

  it("chains Step 2 from the last verified Step 1 snapshot using inputScenarioId", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 4, targetSigmaLevel: 12 });
    const baselineRequest = input.worksheets[0]!.baselineCalculationRequest;
    baselineRequest.worksheetAnalysisAssets.worksheets[0]!.factorTables[0]!.rows[0]!.fields.nominalValue.numericValue = 4;
    baselineRequest.worksheetAnalysisAssets.worksheets[0]!.factorTables[0]!.rows[0]!.fields.nominalValue.rawText = "4";
    refreshGovernedBaseline(input);
    const targets = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      targetVersion: "f6-optimization-targets-v2" as const,
      workbookContentHash: input.workbook.contentHash,
      worksheets: [{
        worksheetName: input.worksheets[0]!.worksheetName,
        tableId: input.worksheets[0]!.baselineCalculation.worksheetSelection.tableId,
        baselineIdentity: baselineIdentityForV4(input),
        targets: [{
          targetId: "sys-shift",
          targetType: "system_mean_shift" as const,
          systemIdentity: systemIdentityForV4(input),
          target: { targetMean: 0, unit: "mm" },
        }],
      }],
    };

    const requestsByScenario = new Map<string, CalculationRequest>();
    const result = createF6OptimizationV4(input, v4Inputs(input, targets), {
      calculateScenario: vi.fn((scenarioInput: Parameters<typeof calculateF6Scenario>[0]) => {
        requestsByScenario.set(scenarioInput.scenario.scenarioId, structuredClone(scenarioInput.baselineRequest));
        return calculateF6Scenario(scenarioInput);
      }),
    });
    const worksheet = result.worksheets[0]!;
    if (!("result" in worksheet.steps[0]) || !("result" in worksheet.steps[1])) throw new Error("expected step1 and step2 snapshots");

    expect(worksheet.steps[1].result.inputScenarioId).toBe(worksheet.steps[0].result.scenarioId);
    const step2BaseRequest = requestsByScenario.get(worksheet.steps[1].result.scenarioId);
    expect(step2BaseRequest).toBeDefined();
    assertRequestReplayFromSnapshot(step2BaseRequest!, worksheet.steps[0].result);
  });

  it("uses Top 3 reverse solve in Step 2 and stops on F4 PASS", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 2, targetSigmaLevel: 6 });

    const result = createF6OptimizationV4(input, v4Inputs(input));
    const worksheet = result.worksheets[0]!;
    if (!("result" in worksheet.steps[1])) throw new Error("expected Step 2 result");

    expect(worksheet.steps[0]).toEqual({ step: "meanResponseCentering", status: "NOT_NEEDED" });
    expect(worksheet.steps[1].status).toBe("COMPLETED_TARGET_MET");
    expect(worksheet.steps[1].result.factorOverrides).toHaveLength(3);
    expect(worksheet.steps[1].result.factorOverrides.every((override) =>
      override.lowerTolerance !== undefined && override.upperTolerance !== undefined)).toBe(true);
    expect(worksheet.steps[2]).toMatchObject({ status: "NOT_RUN_EARLIER_STEP_MET_TARGET" });
    expect(worksheet.selectedResult.status).toBe("step2_tolerance_optimized");
  });

  it("runs Step 3 from the last valid Step 2 snapshot and marks requirement-change approval", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 2, targetSigmaLevel: 6 });

    const requestsByScenario = new Map<string, CalculationRequest>();
    const result = createF6OptimizationV4(input, v4Inputs(input), {
      calculateScenario: (scenarioInput) => {
        requestsByScenario.set(scenarioInput.scenario.scenarioId, structuredClone(scenarioInput.baselineRequest));
        if (scenarioInput.scenario.scenarioId.includes(":step2:")) {
          const loosenedOverrides = scenarioInput.scenario.factorOverrides.map((override) => ({
            ...override,
            lowerTolerance: override.lowerTolerance * 1.2,
            upperTolerance: override.upperTolerance * 1.2,
          }));
          return calculateF6Scenario({
            baselineRequest: scenarioInput.baselineRequest,
            scenario: {
              ...scenarioInput.scenario,
              factorOverrides: loosenedOverrides,
            },
          });
        }
        if (scenarioInput.scenario.scenarioId.includes(":step3:")) {
          const override = scenarioInput.scenario.systemSpecification;
          return calculateF6Scenario({
            baselineRequest: scenarioInput.baselineRequest,
            scenario: {
              ...scenarioInput.scenario,
              systemSpecification: {
                ...(override?.lowerSpecLimit === undefined ? {} : { lowerSpecLimit: override.lowerSpecLimit - 0.5 }),
                ...(override?.upperSpecLimit === undefined ? {} : { upperSpecLimit: override.upperSpecLimit + 0.5 }),
              },
            },
          });
        }
        return calculateF6Scenario(scenarioInput);
      },
    });
    const worksheet = result.worksheets[0]!;
    if (!("result" in worksheet.steps[1]) || !("result" in worksheet.steps[2])) throw new Error("expected step2 and step3 snapshots");

    expect(worksheet.steps[1].status).toBe("COMPLETED_TARGET_NOT_MET");
    expect(worksheet.steps[2].result.inputScenarioId).toBe(worksheet.steps[1].result.scenarioId);
    const step3BaseRequest = requestsByScenario.get(worksheet.steps[2].result.scenarioId);
    expect(step3BaseRequest).toBeDefined();
    assertRequestReplayFromSnapshot(step3BaseRequest!, worksheet.steps[1].result);
    expect(worksheet.steps[2]).toMatchObject({
      status: "COMPLETED_TARGET_MET",
      changeClass: "requirement_change",
      approvalRequired: true,
      capabilityImprovementClaim: false,
    });
    expect(worksheet.selectedResult.status).toBe("step3_specification_relaxed_pending_approval");
    expect(result.summary).toMatchObject({
      optimizedWorksheetCount: 1,
      noValidatedResultWorksheetCount: 0,
    });
  });

  it("does not select pending approval when Step 3 verification is COMPLETED_TARGET_NOT_MET", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 2, targetSigmaLevel: 6 });
    const baselineSystemSpecification = structuredClone(input.worksheets[0]!.baselineCalculationRequest.systemSpecification);

    const result = createF6OptimizationV4(input, v4Inputs(input), {
      calculateScenario: (scenarioInput) => {
        if (scenarioInput.scenario.scenarioId.includes(":step2:")) {
          const loosenedOverrides = scenarioInput.scenario.factorOverrides.map((override) => ({
            ...override,
            lowerTolerance: override.lowerTolerance * 1.2,
            upperTolerance: override.upperTolerance * 1.2,
          }));
          return calculateF6Scenario({
            baselineRequest: scenarioInput.baselineRequest,
            scenario: {
              ...scenarioInput.scenario,
              factorOverrides: loosenedOverrides,
            },
          });
        }
        if (scenarioInput.scenario.scenarioId.includes(":step3:")) {
          return calculateF6Scenario({
            baselineRequest: scenarioInput.baselineRequest,
            scenario: {
              ...scenarioInput.scenario,
              systemSpecification: {
                lowerSpecLimit: baselineSystemSpecification.lowerSpecLimit,
                upperSpecLimit: baselineSystemSpecification.upperSpecLimit,
              },
            },
          });
        }
        return calculateF6Scenario(scenarioInput);
      },
    });
    const worksheet = result.worksheets[0]!;
    if (!("result" in worksheet.steps[2])) throw new Error("expected Step 3 snapshot");

    expect(worksheet.steps[2]).toMatchObject({
      step: "specificationRelaxation",
      status: "COMPLETED_TARGET_NOT_MET",
      changeClass: "requirement_change",
      approvalRequired: true,
      capabilityImprovementClaim: false,
    });
    expect(worksheet.selectedResult.status).toBe("no_validated_optimized_result");
    expect(worksheet.selectedResult.snapshot.scenarioId).toBe(worksheet.steps[2].result.scenarioId);
    expect(result.summary).toMatchObject({
      optimizedWorksheetCount: 0,
      noValidatedResultWorksheetCount: 1,
    });
  });

  it("returns no_validated_optimized_result when Step 3 cannot be validated", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 2, targetSigmaLevel: 6 });
    const calculateScenario = vi.fn((scenarioInput: Parameters<typeof calculateF6Scenario>[0]) => {
      if (scenarioInput.scenario.scenarioId.includes(":step2:")) {
        const loosenedOverrides = scenarioInput.scenario.factorOverrides.map((override) => ({
          ...override,
          lowerTolerance: override.lowerTolerance * 1.2,
          upperTolerance: override.upperTolerance * 1.2,
        }));
        return calculateF6Scenario({
          baselineRequest: scenarioInput.baselineRequest,
          scenario: {
            ...scenarioInput.scenario,
            factorOverrides: loosenedOverrides,
          },
        });
      }
      if (scenarioInput.scenario.scenarioId.includes(":step3:")) {
        throw new Error("forced_step3_failure");
      }
      return calculateF6Scenario(scenarioInput);
    });

    const result = createF6OptimizationV4(input, v4Inputs(input), { calculateScenario });
    const worksheet = result.worksheets[0]!;

    expect(worksheet.steps[2]).toEqual({
      step: "specificationRelaxation",
      status: "CALCULATION_FAILED",
      reasonCode: "f4_specification_verification_failed",
    });
    expect(worksheet.selectedResult.status).toBe("no_validated_optimized_result");
  });

  it("keeps OP1/OP2/OP3 only in sensitivityScenarios and never as selected result", () => {
    const input = request();
    const result = createF6OptimizationV4(input, v4Inputs(input));
    const worksheet = result.worksheets[0]!;

    expect(worksheet.sensitivityScenarios).toHaveLength(3);
    expect(worksheet.sensitivityScenarios.map((scenario) => scenario.optionCode)).toEqual(["OP1", "OP2", "OP3"]);
    expect(worksheet.selectedResult.snapshot.scenarioId).not.toMatch(/^f6-top3-tolerance-policy-v1:OP[123]$/);
  });
});

describe("createF6Optimization V2", () => {
  const notProvidedInputs = {
    inputDecisions: {
      analysisContext: { outcome: "NOT_PROVIDED" as const },
      optimizationTargets: { outcome: "NOT_PROVIDED" as const },
    },
  };

  function v2BaselineIdentity(input: F6OptimizationRequest) {
    const baseline = input.worksheets[0]!.baselineCalculation;
    return {
      calculationVersion: baseline.calculationVersion,
      projectReference: baseline.projectReference,
      runReference: baseline.runReference,
      workbookContentHash: baseline.workbookContentHash,
      worksheetName: baseline.worksheetSelection.worksheetName,
      tableId: baseline.worksheetSelection.tableId,
    };
  }

  function v2FactorIdentity(input: F6OptimizationRequest, factorIndex = 0) {
    const factor = input.worksheets[0]!.baselineCalculation.factors[factorIndex]!;
    return {
      worksheetName: factor.source.worksheetName,
      tableId: factor.source.tableId,
      sourceRow: factor.source.sourceRow,
      factorName: factor.factorName,
      unit: factor.unit,
    };
  }

  function v2SystemIdentity(input: F6OptimizationRequest) {
    const baseline = input.worksheets[0]!.baselineCalculation;
    return {
      baselineIdentity: v2BaselineIdentity(input),
      designNominal: baseline.system.designNominal,
      mean: baseline.system.mean,
      rssSigma: baseline.system.rssSigma,
      lowerSpecLimit: baseline.capability.lowerSpecLimit,
      upperSpecLimit: baseline.capability.upperSpecLimit,
      targetCpk: baseline.capability.targetCpk,
      traceReferences: baseline.traceRecords.map(({ outputField, formulaId, formulaVersion }) => ({
        outputField,
        formulaId,
        formulaVersion,
      })),
    };
  }

  function modelInterpretationV2(input: F6OptimizationRequest, overrides: Partial<{
    nominalDisposition: "RECOMMENDED" | "CONSIDER" | "INSUFFICIENT_EVIDENCE" | "NOT_RECOMMENDED";
    meanShiftDisposition: "RECOMMENDED" | "CONSIDER" | "INSUFFICIENT_EVIDENCE" | "NOT_RECOMMENDED";
    specificationDisposition: "RECOMMENDED" | "CONSIDER" | "INSUFFICIENT_EVIDENCE" | "NOT_RECOMMENDED";
    toleranceDisposition: "RECOMMENDED" | "CONSIDER" | "INSUFFICIENT_EVIDENCE" | "NOT_RECOMMENDED";
  }> = {}) {
    const worksheet = input.worksheets[0]!;
    const baseline = worksheet.baselineCalculation;
    const factor = baseline.factors[0]!;
    const identity = v2BaselineIdentity(input);
    const factorIdentity = v2FactorIdentity(input);
    return {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      interpretationVersion: "f6-model-interpretation-v2" as const,
      workbookContentHash: input.workbook.contentHash,
      generatedAt: "2026-09-05T00:00:00.000Z",
      worksheets: [{
        worksheetName: worksheet.worksheetName,
        tableId: baseline.worksheetSelection.tableId,
        baselineIdentity: identity,
        sourceReferences: {
          f2: input.f2Reference,
          f4: input.f4Reference,
          f5: input.f5Reference,
          image: {
            artifact: worksheet.f5Worksheet.imageReference.artifact,
            contentHash: worksheet.f5Worksheet.imageReference.contentHash,
            worksheetName: worksheet.worksheetName,
          },
        },
        narrativeMarkdown: "Governed {{calc:top-contribution}} assessment.",
        calculationClaims: [{
          claimId: "top-contribution",
          outputField: "factors[0].contribution",
          rawValue: factor.contribution,
          displayFormat: "percent" as const,
          unit: null,
        }],
        optimizationAssessment: [
          {
            adjustmentClass: "factor_nominal" as const,
            disposition: overrides.nominalDisposition ?? "RECOMMENDED",
            priority: 1,
            rationale: "Center by nominal shift on top contributor.",
            factor: factorIdentity,
            evidenceReferences: [input.f4Reference],
          },
          {
            adjustmentClass: "system_mean_shift" as const,
            disposition: overrides.meanShiftDisposition ?? "CONSIDER",
            priority: 2,
            rationale: "Mean shift is controllable.",
            evidenceReferences: [input.f4Reference],
          },
          {
            adjustmentClass: "system_specification" as const,
            disposition: overrides.specificationDisposition ?? "INSUFFICIENT_EVIDENCE",
            priority: 3,
            rationale: "Requirement authority may be missing.",
            evidenceReferences: [input.f5Reference],
          },
          {
            adjustmentClass: "factor_tolerance" as const,
            disposition: overrides.toleranceDisposition ?? "RECOMMENDED",
            priority: 4,
            rationale: "Top contributors should be tightened.",
            factor: factorIdentity,
            evidenceReferences: [input.f4Reference],
          },
        ],
        reviewStatus: "ME_REVIEW_REQUIRED" as const,
      }],
    };
  }

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

  it("maps caller factor_nominal target to a nominal-only F4 scenario without mutating inputs", () => {
    const input = request();
    const inputBefore = structuredClone(input);
    const baseline = input.worksheets[0]!.baselineCalculation;
    const factor = v2FactorIdentity(input);
    const targets = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      targetVersion: "f6-optimization-targets-v2" as const,
      workbookContentHash: input.workbook.contentHash,
      worksheets: [{
        worksheetName: input.worksheets[0]!.worksheetName,
        tableId: baseline.worksheetSelection.tableId,
        baselineIdentity: v2BaselineIdentity(input),
        targets: [{
          targetId: "caller-factor-nominal",
          targetType: "factor_nominal" as const,
          factor,
          nominalValue: 0.9,
          unit: factor.unit,
        }],
      }],
    };
    const targetsBefore = structuredClone(targets);

    const result = createF6OptimizationV2(input, {
      optimizationTargets: targets,
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "targets-v2.json", contentHash: "c".repeat(64) } },
      },
    });
    const option = result.worksheets[0]!.options.find(({ optionId }) => optionId === "Analysis-A:caller-factor-nominal");

    expect(option).toMatchObject({ status: "completed", targetId: "caller-factor-nominal" });
    if (option?.status !== "completed") throw new Error("expected completed nominal option");
    expect(option.scenarioEvidence.factorOverrides).toEqual([{
      factor,
      nominalValue: 0.9,
    }]);
    const scenarioCalculation = calculateF6Scenario({
      baselineRequest: input.worksheets[0]!.baselineCalculationRequest,
      scenario: {
        scenarioId: option.optionId,
        optionKind: "requirement_change",
        factorOverrides: [{
          worksheetName: factor.worksheetName,
          tableId: factor.tableId,
          sourceRow: factor.sourceRow,
          nominalValue: 0.9,
        }],
      },
    });
    const scenario = scenarioCalculation.scenarios.find(({ scenarioId }) => scenarioId === option.optionId);
    expect(scenario?.overrides).toEqual({
      factors: [{
        source: { worksheetName: factor.worksheetName, tableId: factor.tableId, sourceRow: factor.sourceRow },
        fields: ["nominalValue"],
      }],
    });
    const changedFactor = scenarioCalculation.scenarios[0]!.calculation.factors.find(({ source }) =>
      source.worksheetName === factor.worksheetName && source.tableId === factor.tableId && source.sourceRow === factor.sourceRow,
    )!;
    expect(changedFactor.input.nominalValue).toBe(0.9);
    expect(changedFactor.input.lowerTolerance).toBe(baseline.factors[0]!.input.lowerTolerance);
    expect(changedFactor.input.upperTolerance).toBe(baseline.factors[0]!.input.upperTolerance);
    expect(option.resultMetrics).toEqual(expect.objectContaining({
      mean: scenarioCalculation.scenarios[0]!.calculation.system.mean,
      cpk: scenarioCalculation.scenarios[0]!.calculation.capability.cpk,
    }));
    expect(input).toEqual(inputBefore);
    expect(targets).toEqual(targetsBefore);
  });

  it("maps caller system_mean_shift.targetMean to additionalMeanShift deterministically", () => {
    const input = request();
    const baseline = input.worksheets[0]!.baselineCalculation;
    const systemIdentity = v2SystemIdentity(input);
    const targetMean = baseline.system.mean + 1.25;
    const expectedAdditionalMeanShift = baseline.system.additionalMeanShift + targetMean - baseline.system.mean;
    const targets = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      targetVersion: "f6-optimization-targets-v2" as const,
      workbookContentHash: input.workbook.contentHash,
      worksheets: [{
        worksheetName: input.worksheets[0]!.worksheetName,
        tableId: baseline.worksheetSelection.tableId,
        baselineIdentity: v2BaselineIdentity(input),
        targets: [{
          targetId: "caller-mean-center",
          targetType: "system_mean_shift" as const,
          systemIdentity,
          target: { targetMean, unit: baseline.factors[0]!.unit },
        }],
      }],
    };

    const result = createF6OptimizationV2(input, {
      optimizationTargets: targets,
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "targets-v2.json", contentHash: "c".repeat(64) } },
      },
    });
    const option = result.worksheets[0]!.options.find(({ optionId }) => optionId === "Analysis-A:caller-mean-center");
    expect(option).toMatchObject({ status: "completed", targetId: "caller-mean-center" });
    if (option?.status !== "completed") throw new Error("expected completed mean shift option");
    expect(option.scenarioEvidence.factorOverrides).toEqual([]);
    expect(option.scenarioEvidence.systemSpecification).toEqual({ additionalMeanShift: expectedAdditionalMeanShift });
    const scenarioCalculation = calculateF6Scenario({
      baselineRequest: input.worksheets[0]!.baselineCalculationRequest,
      scenario: {
        scenarioId: option.optionId,
        optionKind: "requirement_change",
        factorOverrides: [],
        systemSpecification: { additionalMeanShift: expectedAdditionalMeanShift },
      },
    });
    const scenario = scenarioCalculation.scenarios.find(({ scenarioId }) => scenarioId === option.optionId);
    expect(scenario?.overrides.systemSpecification).toEqual({ additionalMeanShift: expectedAdditionalMeanShift });
    expect(option.resultMetrics.mean).toBe(targetMean);
  });

  it("maps caller system_specification to caller-authorized limits only", () => {
    const input = request();
    const baseline = input.worksheets[0]!.baselineCalculation;
    const systemIdentity = v2SystemIdentity(input);
    const targets = {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      targetVersion: "f6-optimization-targets-v2" as const,
      workbookContentHash: input.workbook.contentHash,
      worksheets: [{
        worksheetName: input.worksheets[0]!.worksheetName,
        tableId: baseline.worksheetSelection.tableId,
        baselineIdentity: v2BaselineIdentity(input),
        targets: [{
          targetId: "caller-spec-tighten",
          targetType: "system_specification" as const,
          systemIdentity,
          lowerSpecLimit: -9,
          unit: baseline.factors[0]!.unit,
        }],
      }],
    };

    const result = createF6OptimizationV2(input, {
      optimizationTargets: targets,
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "targets-v2.json", contentHash: "c".repeat(64) } },
      },
    });
    const option = result.worksheets[0]!.options.find(({ optionId }) => optionId === "Analysis-A:caller-spec-tighten");
    expect(option).toMatchObject({ status: "completed", targetId: "caller-spec-tighten" });
    if (option?.status !== "completed") throw new Error("expected completed specification option");
    expect(option.scenarioEvidence.factorOverrides).toEqual([]);
    expect(option.scenarioEvidence.systemSpecification).toEqual({ lowerSpecLimit: -9 });
    const scenarioCalculation = calculateF6Scenario({
      baselineRequest: input.worksheets[0]!.baselineCalculationRequest,
      scenario: {
        scenarioId: option.optionId,
        optionKind: "requirement_change",
        factorOverrides: [],
        systemSpecification: { lowerSpecLimit: -9 },
      },
    });
    const scenario = scenarioCalculation.scenarios.find(({ scenarioId }) => scenarioId === option.optionId);
    expect(scenario?.overrides.systemSpecification).toEqual({ lowerSpecLimit: -9 });
    expect(scenario?.overrides.factors).toEqual([]);
    expect(option.resultMetrics).toEqual(expect.objectContaining({
      mean: scenarioCalculation.scenarios[0]!.calculation.system.mean,
      cpk: scenarioCalculation.scenarios[0]!.calculation.capability.cpk,
    }));
  });

  it("consumes v2 optimizationAssessment with stable class ordering and no implicit specification relaxation", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 10, targetSigmaLevel: 30 });
    const model = modelInterpretationV2(input);

    const result = createF6OptimizationV2(input, {
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "NOT_PROVIDED" },
        modelInterpretation: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "model-v2.json", contentHash: "d".repeat(64) } },
      },
      modelInterpretation: model,
    } as Parameters<typeof createF6OptimizationV2>[1]);
    const worksheet = result.worksheets[0]!;

    expect(worksheet.options.slice(0, 2).map((option) => option.status === "completed" ? option.targetContext?.targetType : undefined)).toEqual([
      "factor_nominal",
      "system_mean_shift",
    ]);
    expect(worksheet.options.some((option) => option.status === "completed" && option.targetContext?.targetType === "system_specification")).toBe(false);
    expect(worksheet.options.filter((option) => option.optionSource === "BUILT_IN_POLICY").map(({ optionId }) => optionId)).toEqual([
      "Analysis-A:builtin-top3:OP1",
      "Analysis-A:builtin-top3:OP2",
      "Analysis-A:builtin-top3:OP3",
    ]);
    expect(worksheet.clarifications.some(({ reasonCode }) => reasonCode.includes("specification"))).toBe(true);
  });

  it("keeps the existing Top 3 fallback when v2 model assessment is absent", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -10, upperSpecLimit: 10, targetCpk: 10, targetSigmaLevel: 30 });

    const result = createF6OptimizationV2(input, {
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "NOT_PROVIDED" },
      },
    });

    expect(result.worksheets[0]!.options.map(({ optionId }) => optionId)).toEqual([
      "Analysis-A:builtin-top3:OP1",
      "Analysis-A:builtin-top3:OP2",
      "Analysis-A:builtin-top3:OP3",
    ]);
  });
});

describe("createF6Optimization V3", () => {
  function v3Inputs(input: F6OptimizationRequest) {
    return {
      interactionLanguage,
      multimodalInterpretation: multimodalArtifact(input),
      multimodalReference: { artifact: "f5/multimodal-v3.json", contentHash: "d".repeat(64) },
      optimizationTargetsDecision: { outcome: "NOT_PROVIDED" as const },
    };
  }

  it("emits the fixed sequential policy with stable contributor ordering and V3-native tolerance options", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -5, upperSpecLimit: 20, targetCpk: 1.33, targetSigmaLevel: 4 });
    const result = createF6OptimizationV3(input, v3Inputs(input));
    const worksheet = result.worksheets[0]!;

    expect(f6OptimizationResultV3Schema.parse(result)).toEqual(result);
    expect(worksheet.steps.map(({ step }) => step)).toEqual(["centerAssessment", "contributorPriorities", "specificationChanges", "toleranceOptimization"]);
    expect(worksheet.steps[0]).toEqual(expect.objectContaining({ status: "offset", interpretation: expect.stringContaining("complete Factor table") }));
    expect(worksheet.steps[1].priorities.map(({ factor }) => factor.sourceRow)).toEqual([2, 3, 4, 5]);
    expect(worksheet.steps[2].proposals.map(({ side }) => side)).toEqual(["lower"]);
    expect(worksheet.steps[2].proposals[0]).toEqual(expect.objectContaining({ approvalRequired: true, capabilityImprovementClaim: false }));
    expect(worksheet.steps[3]).toEqual(expect.objectContaining({
      policyId: "f6-top3-tolerance-policy-v1",
      options: expect.any(Array),
    }));
    expect(JSON.stringify(result)).not.toMatch(/BUILT_IN_POLICY|policyContext|"options":\[\{"optionId"/u);
  });

  it("preserves the complete governed report scope including blocked worksheets", () => {
    const input = request("Analysis-A");
    input.reportScope = {
      worksheetNames: ["Analysis-A", "Blocked-A"],
      blockedWorksheetNames: ["Blocked-A"],
    };

    const result = createF6OptimizationV3(input, v3Inputs(input));

    expect(result.provenance.reportScope).toEqual(input.reportScope);
    expect(result.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
  });

  it("reports an aligned center and routes both failed specification sides independently", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -4.5, upperSpecLimit: 5.5, targetCpk: 1.33, targetSigmaLevel: 4 });
    const result = createF6OptimizationV3(input, v3Inputs(input));

    expect(result.worksheets[0]!.steps[0]).toEqual({ step: "centerAssessment", status: "aligned", adjustedMean: 0.5, specificationMidpoint: 0.5, offset: 0 });
    expect(result.worksheets[0]!.steps[2].proposals.map(({ side }) => side)).toEqual(["lower", "upper"]);
  });

  it("runs governed Top 3 tolerance options when either side Cpk is below target", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -4.5, upperSpecLimit: 5.5, targetCpk: 1.33, targetSigmaLevel: 4 });
    const result = createF6OptimizationV3(input, v3Inputs(input));

    expect(result.worksheets[0]!.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        step: "toleranceOptimization",
        policyId: "f6-top3-tolerance-policy-v1",
        options: [
          expect.objectContaining({ optionCode: "OP1", reductionRatios: [0.25, 0.1, 0.1], status: "completed" }),
          expect.objectContaining({ optionCode: "OP2", reductionRatios: [0.2, 0.15, 0.15], status: "completed" }),
          expect.objectContaining({ optionCode: "OP3", reductionRatios: [0.4, 0.05, 0.05], status: "completed" }),
        ],
      }),
    ]));
  });

  it.each([
    { factorCount: 1, expectedRatios: [[0.25], [0.2], [0.4]] },
    { factorCount: 2, expectedRatios: [[0.25, 0.1], [0.2, 0.15], [0.4, 0.05]] },
  ])("applies each governed option to all $factorCount available contributors", ({ factorCount, expectedRatios }) => {
    const input = request("Analysis-A", { lowerSpecLimit: -1, upperSpecLimit: 1, targetCpk: 10, targetSigmaLevel: 30 }, factorCount);
    const result = createF6OptimizationV3(input, v3Inputs(input));
    const options = result.worksheets[0]!.steps[3].options;

    expect(options.map(({ optionCode }) => optionCode)).toEqual(["OP1", "OP2", "OP3"]);
    expect(options.map(({ reductionRatios }) => reductionRatios)).toEqual(expectedRatios);
    expect(options.every((option) => option.reductions.length === factorCount)).toBe(true);
    expect(options.every((option) => option.status !== "completed" || option.scenarioEvidence.factorOverrides.length === factorCount)).toBe(true);
  });

  it.each([
    ["capability trigger", (result: any) => {
      result.worksheets[0].steps[3].trigger = { lowerCpk: 2, upperCpk: 2, targetCpk: 1.33, failedSides: [] };
      result.worksheets[0].steps[3].options = [];
      result.summary.completedOptionCount = 0;
    }],
    ["specification override", (result: any) => {
      result.worksheets[0].steps[3].options[0].scenarioEvidence.systemSpecification = { lowerSpecLimit: -5 };
    }],
    ["ranked Factor identity", (result: any) => {
      result.worksheets[0].steps[3].options[0].reductions[0].factor = result.worksheets[0].steps[1].priorities[1].factor;
    }],
    ["center-preserving tolerance override", (result: any) => {
      result.worksheets[0].steps[3].options[0].scenarioEvidence.factorOverrides[0].upperTolerance += 0.01;
    }],
  ])("rejects tampered V3 %s evidence", (_label, mutate) => {
    const input = request("Analysis-A", { lowerSpecLimit: -4.5, upperSpecLimit: 5.5, targetCpk: 1.33, targetSigmaLevel: 4 });
    const result = structuredClone(createF6OptimizationV3(input, v3Inputs(input)));

    mutate(result);

    expect(f6OptimizationResultV3Schema.safeParse(result).success).toBe(false);
  });

  it.each([
    { lowerSpecLimit: -20, upperSpecLimit: 5, expectedSides: ["upper"] },
    { lowerSpecLimit: -20, upperSpecLimit: 20, expectedSides: [] },
  ] as const)("routes specification proposals to $expectedSides", ({ lowerSpecLimit, upperSpecLimit, expectedSides }) => {
    const input = request("Analysis-A", { lowerSpecLimit, upperSpecLimit, targetCpk: 1.33, targetSigmaLevel: 4 });
    const result = createF6OptimizationV3(input, v3Inputs(input));

    expect(result.worksheets[0]!.steps[2].proposals.map(({ side }) => side)).toEqual(expectedSides);
  });

  it("converts F4 proposal verification failures into a structured clarification", () => {
    const input = request("Analysis-A", { lowerSpecLimit: -5, upperSpecLimit: 20, targetCpk: 1.33, targetSigmaLevel: 4 });
    const result = createF6OptimizationV3(input, v3Inputs(input), {
      calculateScenario: vi.fn(() => { throw new Error("controlled_f4_failure"); }),
    });

    expect(result.runStatus).toBe("CLARIFICATION_REQUIRED");
    expect(result.worksheets[0]!.steps[2]).toEqual(expect.objectContaining({
      proposals: [],
      clarifications: [{ reasonCode: "f4_specification_verification_failed", requiredInputs: ["valid_f4_scenario_calculation"] }],
    }));
  });

  it("fails closed instead of silently dropping a caller-authorized concrete target", () => {
    const input = request();
    const inputs = v3Inputs(input);
    const baseline = input.worksheets[0]!.baselineCalculation;
    const factor = baseline.factors[0]!;
    inputs.optimizationTargetsDecision = {
      outcome: "CALLER_AUTHORIZED",
      artifactReference: { artifact: "targets.json", contentHash: "e".repeat(64) },
    };
    inputs.optimizationTargets = {
      contractVersion: "v1",
      inputClassification: "confidential",
      targetVersion: "f6-optimization-targets-v2",
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
        targets: [{
          targetId: "confirmed-factor-tolerance",
          targetType: "factor_tolerance",
          factor: {
            worksheetName: factor.source.worksheetName,
            tableId: factor.source.tableId,
            sourceRow: factor.source.sourceRow,
            factorName: factor.factorName,
            unit: factor.unit,
          },
          lowerTolerance: -1,
          upperTolerance: 1,
          unit: "mm",
        }],
      }],
    };

    expect(() => createF6OptimizationV3(input, inputs)).toThrow(/separately versioned F4-backed target scenario/i);
  });

  it("rejects multimodal scope that does not exactly match the selected worksheet and table", () => {
    const input = request();
    const inputs = v3Inputs(input);
    inputs.multimodalInterpretation.worksheets[0]!.request.tableId = "wrong-table";

    expect(() => createF6OptimizationV3(input, inputs)).toThrow(/multimodal/i);
  });

  it("exports the v3 writer without replacing the historical v2 function", () => {
    expect(packageRoot.createF6Optimization).toBe(createF6OptimizationV2);
    expect(packageRoot.createF6OptimizationV3).toBe(createF6OptimizationV3);
  });
});