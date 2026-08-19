import { describe, expect, it } from "vitest";
import {
  f6LegacyComposedEngineeringReportSchema as f6ComposedEngineeringReportSchema,
  f6LegacyOptimizationResultSchema as f6OptimizationResultSchema,
  type CalculationRequest,
  type F2UserReport,
  type F5DataInterpretationResult,
} from "@ai-assist/contracts";
import { createCalculation } from "./calculation.js";
import { createF5DataInterpretation } from "./f5-data-interpretation.js";
import {
  createF6Optimization as createF6OptimizationV2,
  createLegacyF6Optimization as createF6Optimization,
} from "./f6-optimization.js";
import { calculateF6Scenario } from "./f6-scenario-adapter.js";
import * as packageRoot from "./index.js";
import {
  createF6ComposedEngineeringReport as createF6ComposedEngineeringReportV2,
  createLegacyF6ComposedEngineeringReport as createF6ComposedEngineeringReport,
} from "./f6-composed-report.js";

const HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);
type CompletedF5Calculation = Extract<
  F5DataInterpretationResult["worksheets"][number],
  { status: "completed" }
>["calculationResult"];

function text(rawText: string, sourceCell: string) {
  return { status: "available" as const, rawText, sourceCell };
}

function number(rawText: string, sourceCell: string, numericValue: number) {
  return { status: "available" as const, rawText, sourceCell, numericValue, unit: "mm" };
}

function calculationRequest(
  worksheetName: string,
  specificationLimit: number,
  options: { factorCount?: number; toleranceLoopDescription?: string } = {},
): CalculationRequest {
  const factorCount = options.factorCount ?? 2;
  const toleranceLoopDescription = options.toleranceLoopDescription ?? `Loop ${worksheetName}`;
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "project",
    runReference: `run-1-${worksheetName === "Analysis-A" ? 1 : 2}`,
    worksheetAnalysisAssets: {
      contractVersion: "v1",
      workbook: { classification: "confidential", contentHash: HASH, catalogContractVersion: "v1" },
      worksheets: [{
        worksheetName,
        toleranceLoopDescription,
        factorTables: [{
          tableId: `table-${worksheetName}`,
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
          rows: Array.from({ length: factorCount }, (_value, index) => {
            const factor = index + 1;
            const sourceRow = index + 2;
            return {
              sourceRow,
              fields: {
                factorName: text(`factor-${factor}`, `${worksheetName}!A${sourceRow}`),
                nominalValue: number("0", `${worksheetName}!B${sourceRow}`, 0),
                upperTolerance: number("0.2", `${worksheetName}!C${sourceRow}`, 0.2),
                lowerTolerance: number("-0.2", `${worksheetName}!D${sourceRow}`, -0.2),
                longTermSafetyFactor: number("1", `${worksheetName}!E${sourceRow}`, 1),
                standardDeviation: number("4", `${worksheetName}!F${sourceRow}`, 4),
                distribution: text("normal", `${worksheetName}!G${sourceRow}`),
                unit: text("mm", `${worksheetName}!H${sourceRow}`),
              },
            };
          }),
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
      summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 2, blockingIssueCount: 0, advisoryIssueCount: 0 },
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
    worksheetSelection: { worksheetName, tableId: `table-${worksheetName}` },
    systemSpecification: {
      designNominal: 0,
      lowerSpecLimit: -specificationLimit,
      upperSpecLimit: specificationLimit,
      targetSigmaLevel: 4,
      targetCpk: 4 / 3,
      additionalMeanShift: 0,
    },
    criticality: "none",
    scenarioOverrides: [],
  };
}

function governanceRows(
  worksheetName: string,
  calculation: ReturnType<typeof createCalculation>,
) {
  if (calculation.status !== "completed") throw new Error("fixture calculation failed");
  const imageReference = {
    artifact: "f1" as const,
    worksheetName,
    relativePath: `images/${worksheetName}.png`,
    contentHash: IMAGE_HASH,
  };
  return calculation.factors.map((factor, index) => ({
    factorInstanceId: String(index + 1).padStart(64, "0"),
    drawingDimensionKey: String(index + 11).padStart(64, "0"),
    deviceLevelDim: `device-${index + 1}`,
    dimensionDescription: `CTQ ${worksheetName}`,
    partCategory: "CNC",
    partSubsystem: "Assembly",
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
}

function f2Row(worksheetName: string, sourceRow: number, missingDrawingAndDimIds = false) {
  return {
    worksheetName,
    tableId: `table-${worksheetName}`,
    sourceRow,
    actualFields: {
      factorName: `factor-${sourceRow - 1}`,
      partName: "Part",
      drawingNumber: missingDrawingAndDimIds ? null : `DRAW-${sourceRow - 1}`,
      dimCharacteristicId: missingDrawingAndDimIds ? null : `DIM-${sourceRow - 1}`,
      partCategory: "CNC",
      nominalValue: 0,
      upperTolerance: 0.2,
      lowerTolerance: -0.2,
      longTermSafetyFactor: 1,
      sigmaLevel: 4,
      distribution: "normal",
      mean: 0,
      tolerance: 0.2,
      oneSigma: 0.05,
      percentContributionToSigma: 0.5,
      notes: null,
    },
    sourceCells: {},
    missingRequiredFields: [],
    missingIdentifiers: missingDrawingAndDimIds ? ["dimCharacteristicId"] : [],
    capabilityStatus: "non_f0_process_category" as const,
    adoReminderRequested: false,
  };
}

function f2Specification(worksheetName: string, specificationLimit: number) {
  return {
    status: "available" as const,
    lowerSpecLimit: { status: "available" as const, actualValue: -specificationLimit, displayValue: String(-specificationLimit), sourceLabel: "Lower", sourceCell: `${worksheetName}!P54`, valueOrigin: "numeric_literal" as const },
    upperSpecLimit: { status: "available" as const, actualValue: specificationLimit, displayValue: String(specificationLimit), sourceLabel: "Upper", sourceCell: `${worksheetName}!P55`, valueOrigin: "numeric_literal" as const },
    targetSigmaLevel: { status: "available" as const, actualValue: 4, displayValue: "4", sourceLabel: "Target", sourceCell: `${worksheetName}!P56`, valueOrigin: "numeric_literal" as const },
    additionalMeanShift: { status: "available" as const, actualValue: 0, displayValue: "0", sourceLabel: "Shift", valueOrigin: "defaulted" as const },
  };
}

function summary(
  readyCount: number,
  blockedCount: number,
  factorCount = 2,
  missingDimIdCount = 0,
) {
  return {
    worksheetsChecked: readyCount + blockedCount,
    blockedWorksheetCount: blockedCount,
    readyWorksheetCount: readyCount,
    factorRowCount: readyCount * factorCount + blockedCount,
    rowsWithRequiredMissing: 0,
    requiredMissingFieldCount: 0,
    missingImageWorksheetCount: blockedCount,
    internalWithinGuidanceCount: 0,
    internalGuidanceExceededCount: 0,
    f0InformationInsufficientCount: 0,
    publicLibraryMatchCount: 0,
    nonF0ProcessCategoryCount: readyCount * factorCount + blockedCount,
    unableToCheckCount: 0,
    publicToleranceDifferenceCount: 0,
    publicDistributionDifferenceCount: 0,
    missingDimIdCount,
    missingPartNumberCount: 0,
  };
}

function bundle(
  specifications: Array<[string, number]>,
  blockedWorksheetName?: string,
  failOptions = false,
  options: {
    factorCount?: number;
    toleranceLoopDescription?: string;
    missingDrawingAndDimIds?: boolean;
  } = {},
) {
  const factorCount = options.factorCount ?? 2;
  const calculations = specifications.map(([name, limit]) => createCalculation(calculationRequest(name, limit, {
    factorCount,
    toleranceLoopDescription: options.toleranceLoopDescription,
  })));
  if (calculations.some(({ status }) => status !== "completed")) throw new Error("fixture calculation failed");
  const rows = calculations.map((calculation, index) => governanceRows(specifications[index]![0], calculation));
  const f5Report = createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: calculations.map((calculation, index) => ({
      worksheetName: specifications[index]![0],
      imageReference: rows[index]![0]!.imageReference,
      governanceRows: rows[index]!,
      calculationResult: calculation,
      imageObservations: [],
    })),
  });
  const f6Request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
    selectedWorksheetNames: specifications.map(([name]) => name),
    f2Reference: { artifact: "Feature2-Report.json", contentHash: "2".repeat(64) },
    f3Reference: { artifact: "Feature3-Report.json", contentHash: "3".repeat(64) },
    f4Reference: { artifact: "Feature4-Calculation.json", contentHash: "4".repeat(64), runId: "run-1", calculationVersion: "excel-ta-v1" },
    f5Reference: { artifact: "Feature5-Report.json", contentHash: "5".repeat(64), interpretationVersion: "f5-data-interpretation-v1" },
    f0Versions: { knowledgeBaseVersion: "v1", capabilityVersion: "internal-v1", interpretationVersion: "interpretation-rules-v1" },
    scenarioPolicyVersion: "f6-scenario-policy-v1",
    worksheets: calculations.map((calculation, index) => ({
      worksheetName: specifications[index]![0],
      f4CalculationIndex: index + 1,
        baselineCalculationRequest: calculationRequest(specifications[index]![0], specifications[index]![1], {
          factorCount,
          toleranceLoopDescription: options.toleranceLoopDescription,
        }),
      baselineCalculation: calculation,
      f5Worksheet: f5Report.worksheets[index],
      f3GovernanceRows: rows[index],
      f2Findings: [],
      supplierBindings: [],
    })),
  };
  const generatedF6Result = createF6Optimization(f6Request, failOptions ? {
    calculateScenario() {
      throw { code: "controlled_calculation_failed" };
    },
  } : {});
  const f6Result = structuredClone(generatedF6Result);
  for (const worksheet of f6Result.worksheets) {
    for (const risk of worksheet.risks) risk.status = "closed";
    if (worksheet.status === "input_rejected") continue;
    const assessedCategories = new Set(worksheet.risks.map(({ category }) => category));
    for (const category of ["Product", "Manufacturing", "Assembly", "Supplier", "Customer Experience"] as const) {
      if (assessedCategories.has(category)) continue;
      worksheet.risks.push({
        riskId: `${worksheet.worksheetName}:fixture:${category}`,
        category,
        rating: "Low",
        status: "closed",
        reason: `Governed ${category} assessment found no open risk.`,
        evidenceReferences: [{
          artifact: f6Result.provenance.f5Reference.artifact,
          contentHash: f6Result.provenance.f5Reference.contentHash,
        }],
      });
    }
  }
  const readyWorksheets = specifications.map(([worksheetName, limit]) => ({
    worksheetName,
    toleranceLoopDescription: options.toleranceLoopDescription ?? `Loop ${worksheetName}`,
    status: "ready" as const,
    tolerancePathImageStatus: "available" as const,
    systemSpecification: f2Specification(worksheetName, limit),
    systemSpecificationIssues: [],
    rows: Array.from({ length: factorCount }, (_value, index) =>
      f2Row(worksheetName, index + 2, options.missingDrawingAndDimIds ?? false)),
    missingFieldSummary: [],
  }));
  const blockedWorksheets = blockedWorksheetName === undefined ? [] : [{
    worksheetName: blockedWorksheetName,
    toleranceLoopDescription: `Loop ${blockedWorksheetName}`,
    status: "blocked" as const,
    tolerancePathImageStatus: "unavailable" as const,
    systemSpecification: { status: "unavailable" as const, reasonCode: "legacy_artifact_missing_system_specification" as const },
    systemSpecificationIssues: [{ field: "lowerSpecLimit" as const, reasonCode: "legacy_artifact_missing_system_specification" as const }],
    rows: [f2Row(blockedWorksheetName, 2)],
    missingFieldSummary: [{ field: "tolerancePathImage" as const, factorCount: 0, sourceRows: [] }],
  }];
  const f2Report: F2UserReport = {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: blockedWorksheets.length === 0 ? "completed" : "partiallyBlocked",
    workbook: { fileName: "Anonymous.xlsx", contentHash: HASH, f1GeneratedAt: "2026-08-17T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "controlled/f1",
    worksheets: [...readyWorksheets, ...blockedWorksheets],
    f4Handoffs: readyWorksheets.map((worksheet) => ({
      contractVersion: "v1",
      handoffVersion: "f4-handoff-v1",
      inputClassification: "confidential",
      status: "ready",
      workbookContentHash: HASH,
      worksheetName: worksheet.worksheetName,
      toleranceLoopDescription: worksheet.toleranceLoopDescription,
      systemSpecification: {
        designNominal: 0,
        lowerSpecLimit: worksheet.systemSpecification.lowerSpecLimit,
        upperSpecLimit: worksheet.systemSpecification.upperSpecLimit,
        targetSigmaLevel: worksheet.systemSpecification.targetSigmaLevel,
        targetCpk: 4 / 3,
        additionalMeanShift: worksheet.systemSpecification.additionalMeanShift,
      },
      factors: [],
    })),
    adoEvents: [],
    summary: summary(
      readyWorksheets.length,
      blockedWorksheets.length,
      factorCount,
      options.missingDrawingAndDimIds ? readyWorksheets.length * factorCount : 0,
    ),
  };
  return { f2Report, f5Report, f6Result, f6Request };
}

describe("createF6ComposedEngineeringReport", () => {
  it.each([
    [0.12, "FAIL"],
    [0.25, "RISK"],
    [1, "PASS"],
  ] as const)("derives %s capability as %s", (specificationLimit, expectedStatus) => {
    const report = createF6ComposedEngineeringReport(bundle([["Analysis-A", specificationLimit]]));

    expect(report.overallStatus).toBe(expectedStatus);
    expect(report.worksheets[0]!.status).toBe(expectedStatus);
    expect(f6ComposedEngineeringReportSchema.parse(report)).toEqual(report);
  });

  it("keeps blocked worksheets in input validation only and makes PASS plus blocked overall RISK", () => {
    const report = createF6ComposedEngineeringReport(bundle([["Analysis-A", 1]], "Blocked-Sheet"));

    expect(report.overallStatus).toBe("RISK");
    expect(report.blockedWorksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Blocked-Sheet"]);
    expect(report.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(JSON.stringify(report.blockedWorksheets)).not.toMatch(/capabilityAssessment|options|whatIfAnalysis/);

    const failed = createF6ComposedEngineeringReport(bundle([["Analysis-A", 0.12]], "Blocked-Sheet"));
    expect(failed.overallStatus).toBe("FAIL");
  });

  it.each([
    [0.12, "FAIL"],
    [0.25, "RISK"],
    [1, "RISK"],
  ] as const)("preserves all-failed baseline capability and derives %s as %s", (specificationLimit, expectedStatus) => {
    const report = createF6ComposedEngineeringReport(bundle([["Analysis-A", specificationLimit]], undefined, true));

    expect(report.overallStatus).toBe(expectedStatus);
    expect(report.worksheets[0]).toMatchObject({ status: expectedStatus, missingCapabilityData: false });
    expect(report.worksheets[0]!.sections.capabilityAssessment.metrics.cpk).toBeGreaterThan(0);
    expect(report.worksheets[0]!.sections.inputValidation).toContainEqual(expect.objectContaining({
      findingKind: "optimization_failure",
      affectsCapabilityData: false,
    }));
  });

  it("consumes a partial optimization failure produced by the orchestrator as RISK", () => {
    const input = bundle([["Analysis-A", 1]]);
    const generated = createF6Optimization({
      contractVersion: "v1",
      inputClassification: "confidential",
      workbook: input.f6Result.workbook,
      selectedWorksheetNames: ["Analysis-A"],
      f2Reference: input.f6Result.provenance.f2Reference,
      f3Reference: input.f6Result.provenance.f3Reference,
      f4Reference: input.f6Result.provenance.f4Reference,
      f5Reference: input.f6Result.provenance.f5Reference,
      f0Versions: input.f6Result.provenance.f0Versions,
      scenarioPolicyVersion: input.f6Result.provenance.scenarioPolicyVersion,
      worksheets: [{
        worksheetName: "Analysis-A",
        f4CalculationIndex: 1,
        baselineCalculationRequest: calculationRequest("Analysis-A", 1),
        baselineCalculation: input.f5Report.worksheets[0]!.calculationResult,
        f5Worksheet: input.f5Report.worksheets[0]!,
        f3GovernanceRows: input.f5Report.worksheets[0]!.governanceRows,
        f2Findings: [],
        supplierBindings: [],
      }],
    }, {
      calculateScenario(scenarioInput) {
        if (scenarioInput.scenario.optionKind === "reduce_top_contributor_20") {
          throw { code: "controlled_calculation_failed", privateValue: "DO-NOT-LEAK" };
        }
        return calculateF6Scenario(scenarioInput);
      },
    });
    const f6Result = structuredClone(generated);
    for (const risk of f6Result.worksheets[0]!.risks) risk.status = "closed";
    for (const category of ["Manufacturing", "Assembly", "Supplier", "Customer Experience"] as const) {
      f6Result.worksheets[0]!.risks.push({
        riskId: `Analysis-A:fixture:${category}`,
        category,
        rating: "Low",
        status: "closed",
        reason: `Governed ${category} assessment found no open risk.`,
        evidenceReferences: [{
          artifact: f6Result.provenance.f5Reference.artifact,
          contentHash: f6Result.provenance.f5Reference.contentHash,
        }],
      });
    }

    const parsed = f6OptimizationResultSchema.safeParse(f6Result);
    expect(parsed.success, parsed.success ? undefined : JSON.stringify(parsed.error.issues, null, 2)).toBe(true);
    const report = createF6ComposedEngineeringReport({ ...input, f6Result });

    expect(f6Result.worksheets[0]!.status).toBe("partially_completed");
    expect(JSON.stringify(f6Result)).not.toContain("DO-NOT-LEAK");
    expect(report.worksheets[0]!.status).toBe("RISK");
    expect(report.worksheets[0]!.sections.inputValidation).toContainEqual(expect.objectContaining({
      findingKind: "optimization_failure",
      severity: "Major",
    }));
  });

  it("uses findingKind only for requirement violations", () => {
    const violationInput = bundle([["Analysis-A", 1]]);
    violationInput.f6Result.worksheets[0]!.inputFindings = [{
      findingCode: "arbitrary-code-without-inference",
      findingKind: "confirmed_requirement_violation",
      severity: "Critical",
      message: "A governed requirement is violated.",
      affectsCapabilityData: true,
      evidenceReferences: [violationInput.f6Result.provenance.f2Reference],
    }];
    const violation = createF6ComposedEngineeringReport(violationInput);
    expect(violation.worksheets[0]).toMatchObject({ status: "FAIL", confirmedRequirementViolation: true });

    const ordinaryInput = bundle([["Analysis-A", 1]]);
    ordinaryInput.f6Result.worksheets[0]!.inputFindings = [{
      findingCode: "confirmed_requirement_violation",
      findingKind: "validation_abnormality",
      severity: "Critical",
      message: "A loader validation abnormality was retained with the verified baseline.",
      affectsCapabilityData: true,
      evidenceReferences: [ordinaryInput.f6Result.provenance.f2Reference],
    }];
    const ordinary = createF6ComposedEngineeringReport(ordinaryInput);
    expect(ordinary.worksheets[0]).toMatchObject({ status: "PASS", confirmedRequirementViolation: false, missingCapabilityData: false });

    const openRiskInput = bundle([["Analysis-A", 1]]);
    openRiskInput.f6Result.worksheets[0]!.risks[0]!.status = "open";
    const openRisk = createF6ComposedEngineeringReport(openRiskInput);
    expect(openRisk.worksheets[0]!.status).toBe("RISK");
  });

  it.each([
    ["project", (calculation: CompletedF5Calculation) => { calculation.projectReference = "other-project"; }],
    ["table", (calculation: CompletedF5Calculation) => { calculation.worksheetSelection.tableId = "other-table"; }],
    ["factor source", (calculation: CompletedF5Calculation) => { calculation.factors[0]!.source.sourceRow += 1; }],
  ] as const)("rejects all-failed F5 calculations with tampered %s identity", (_label, mutate) => {
    const input = bundle([["Analysis-A", 0.12]], undefined, true);
    const f5Report = structuredClone(input.f5Report);
    const worksheet = f5Report.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("fixture worksheet failed");
    mutate(worksheet.calculationResult);

    expect(() => createF6ComposedEngineeringReport({ ...input, f5Report })).toThrow(/Invalid F5 report|identity/i);
  });

  it("preserves every evidence-backed risk and marks uncovered fixed areas insufficient", () => {
    const input = bundle([["Analysis-A", 1]]);
    const evidenceReferences = [{
      artifact: input.f6Result.provenance.f5Reference.artifact,
      contentHash: input.f6Result.provenance.f5Reference.contentHash,
    }];
    input.f6Result.worksheets[0]!.risks = [
      { riskId: "closed-critical", category: "Product", rating: "Critical", status: "closed", reason: "Closed historical risk.", evidenceReferences },
      { riskId: "open-high", category: "Product", rating: "High", status: "open", reason: "Open evidence-backed risk.", evidenceReferences },
    ];
    for (const option of input.f6Result.worksheets[0]!.options) option.impactRank = null;
    input.f6Result.worksheets[0]!.highestImpactAction = undefined;

    const report = createF6ComposedEngineeringReport(input);
    const risks = report.worksheets[0]!.sections.riskAssessment;

    expect(report.worksheets[0]!.status).toBe("RISK");
    expect(risks.filter(({ category }) => category === "Product")).toHaveLength(input.f6Result.worksheets[0]!.risks.length);
    expect(risks.filter(({ rating }) => rating === "insufficient_evidence").map(({ category }) => category)).toEqual([
      "Manufacturing",
      "Assembly",
      "Supplier",
      "Customer Experience",
    ]);
    expect(risks.filter(({ rating }) => rating === "insufficient_evidence").every(({ reason }) => /missing|no evidence/i.test(reason))).toBe(true);
  });

  it("does not report PASS when fixed risk areas lack evidence", () => {
    const input = bundle([["Analysis-A", 1]]);
    input.f6Result.worksheets[0]!.risks = [];

    const report = createF6ComposedEngineeringReport(input);

    expect(report.worksheets[0]!.status).toBe("RISK");
    expect(report.worksheets[0]!.sections.riskAssessment).toHaveLength(5);
    expect(report.worksheets[0]!.sections.riskAssessment.every(({ status }) => status === "insufficient_evidence")).toBe(true);
  });

  it("uses the worst worksheet without averaging Cpk and limits fixed report data", () => {
    const report = createF6ComposedEngineeringReport(bundle([["Analysis-A", 1], ["Analysis-B", 0.12]]));
    const worst = report.worksheets.find(({ worksheetName }) => worksheetName === "Analysis-B")!;

    expect(report.overallStatus).toBe("FAIL");
    expect(report.workbookExecutiveSummary.join(" ")).toContain("Analysis-B");
    expect(report.workbookExecutiveSummary).toHaveLength(5);
    expect(report.workbookExecutiveSummary.join(" ")).not.toContain(String(
      report.worksheets.reduce((sum, worksheet) => sum + worksheet.sections.capabilityAssessment.metrics.cpk, 0) / report.worksheets.length,
    ));
    expect(worst.sections.executiveSummary.length).toBeLessThanOrEqual(5);
    expect(worst.sections.finalConclusion.length).toBeLessThanOrEqual(10);
    expect(worst.sections.whatIfAnalysis.options.map(({ optionKind }) => optionKind)).toEqual([
      "reduce_top_contributor_20",
      "reduce_top_3_contributors_30",
      "improve_supplier_capability",
      "tighten_datum_strategy",
    ]);
  });

  it("preserves governed evidence classes and permits only verified options or evidence closure recommendations", () => {
    const { f2Report, f5Report, f6Result } = bundle([["Analysis-A", 0.2]]);
    const report = createF6ComposedEngineeringReport({ f2Report, f5Report, f6Result });
    const worksheet = report.worksheets[0]!;
    const verifiedOptionIds = new Set(f6Result.worksheets[0]!.options.map(({ optionId }) => optionId));

    expect(worksheet.sections.rootCauseAnalysis.factBasedFindings.every((finding) => finding.startsWith("FACT"))).toBe(true);
    expect(worksheet.sections.rootCauseAnalysis.ruleFindings.every((finding) => finding.startsWith("RULE"))).toBe(true);
    expect(worksheet.sections.rootCauseAnalysis.optionFindings.every((finding) => finding.startsWith("OPTION"))).toBe(true);
    expect(worksheet.sections.rootCauseAnalysis.signals.every((signal) => signal.startsWith("SIGNAL"))).toBe(true);
    expect(worksheet.sections.recommendations.every((recommendation) => recommendation.recommendationId.length > 0)).toBe(true);
    expect(worksheet.sections.recommendations.every((recommendation) => recommendation.expectedBenefit.length > 0)).toBe(true);
    expect(worksheet.sections.recommendations.filter(({ kind }) => kind === "verified_option").every((recommendation) =>
      verifiedOptionIds.has(recommendation.optionId))).toBe(true);
    expect(worksheet.sections.recommendations.filter(({ kind }) => kind === "evidence_closure").map(({ clarificationId }) => clarificationId)).toEqual(
      f6Result.worksheets[0]!.clarifications.map(({ clarificationId }) => clarificationId).sort(),
    );
    const recommendationKinds = worksheet.sections.recommendations.map(({ kind }) => kind);
    expect(recommendationKinds).toEqual([...recommendationKinds].sort((left, right) => left === right ? 0 : left === "verified_option" ? -1 : 1));
    expect(worksheet.sections.whatIfAnalysis.roiStatus).toBe("not_computed");
    expect(worksheet.sections.whatIfAnalysis.highestImpactAction).not.toContain("Highest ROI");
  });

  it("rejects workbook and worksheet identity mismatches", () => {
    const input = bundle([["Analysis-A", 1]]);
    const wrongHash = structuredClone(input.f5Report);
    wrongHash.workbook.contentHash = "f".repeat(64);
    expect(() => createF6ComposedEngineeringReport({ ...input, f5Report: wrongHash })).toThrow(/Invalid F5 report|identity/i);

    const missingWorksheet = structuredClone(input.f6Result);
    missingWorksheet.worksheets[0]!.worksheetName = "Analysis-B";
    expect(() => createF6ComposedEngineeringReport({ ...input, f6Result: missingWorksheet })).toThrow();
  });

  it.each([
    ["projectReference", "other-project"],
    ["runReference", "other-run"],
  ] as const)("rejects equal-metric F5 calculations with a different %s", (field, value) => {
    const input = bundle([["Analysis-A", 1]]);
    const f5Report = structuredClone(input.f5Report);
    if (f5Report.worksheets[0]!.status !== "completed") throw new Error("fixture worksheet failed");
    f5Report.worksheets[0]!.calculationResult[field] = value;

    expect(() => createF6ComposedEngineeringReport({ ...input, f5Report })).toThrow(/identity/i);
  });

  it("rejects equal-metric F5 calculations with different table or factor source identity", () => {
    const mutations: Array<(calculation: CompletedF5Calculation) => void> = [
      (calculation) => {
        calculation.worksheetSelection.tableId = "other-table";
      },
      (calculation) => {
        calculation.factors[0]!.source.tableId = "other-table";
      },
      (calculation) => {
        calculation.factors[0]!.source.sourceRow += 1;
      },
    ];

    for (const mutate of mutations) {
      const input = bundle([["Analysis-A", 1]]);
      const f5Report = structuredClone(input.f5Report);
      const worksheet = f5Report.worksheets[0]!;
      if (worksheet.status !== "completed") throw new Error("fixture worksheet failed");
      mutate(worksheet.calculationResult);

      expect(() => createF6ComposedEngineeringReport({ ...input, f5Report })).toThrow(/Invalid F5 report|identity/i);
    }
  });

  it("joins worksheets by identity without depending on input order", () => {
    const input = bundle([["Analysis-A", 1], ["Analysis-B", 0.12]]);
    const f5Report = structuredClone(input.f5Report);
    f5Report.worksheets = [...f5Report.worksheets].reverse();

    const report = createF6ComposedEngineeringReport({ ...input, f5Report });

    expect(report.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A", "Analysis-B"]);
    expect(report.worksheets.map(({ status }) => status)).toEqual(["PASS", "FAIL"]);
  });

  it("deep freezes output without mutating inputs and is deterministic", () => {
    const input = bundle([["Analysis-A", 0.2]]);
    const snapshot = structuredClone(input);
    const first = createF6ComposedEngineeringReport(input);
    const second = createF6ComposedEngineeringReport(structuredClone(input));

    expect(second).toEqual(first);
    expect(input).toEqual(snapshot);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.worksheets)).toBe(true);
    expect(Object.isFrozen(first.worksheets[0]!.sections.whatIfAnalysis.options)).toBe(true);
  });

  it("exports the governed service from the package root", () => {
    expect(typeof createF6ComposedEngineeringReport).toBe("function");
  });
});

describe("createF6ComposedEngineeringReport V2", () => {
  function bundleV2(
    specificationLimit = 0.12,
    blockedWorksheetName?: string,
    options: {
      factorCount?: number;
      toleranceLoopDescription?: string;
      missingDrawingAndDimIds?: boolean;
    } = {},
  ) {
    const base = bundle([["Analysis-A", specificationLimit]], blockedWorksheetName, false, options);
    const f6Result = createF6OptimizationV2(base.f6Request, {
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "NOT_PROVIDED" },
      },
    });
    return { f2Report: base.f2Report, f5Report: base.f5Report, f6Result };
  }

  function withGovernedTargetsFixture() {
    const input = structuredClone(bundleV2(1));
    const worksheet = input.f6Result.worksheets[0]!;
    const baseline = structuredClone(worksheet.baselineMetrics);
    const factorA = { worksheetName: "Analysis-A", tableId: "table-Analysis-A", sourceRow: 2, factorName: "factor-1", unit: "mm" };
    const factorB = { worksheetName: "Analysis-A", tableId: "table-Analysis-A", sourceRow: 3, factorName: "factor-2", unit: "mm" };
    const factorC = { worksheetName: "Analysis-A", tableId: "table-Analysis-A", sourceRow: 2, factorName: "factor-1", unit: "mm" };
    input.f6Result.provenance.optimizationTargetsDecision = {
      outcome: "CALLER_AUTHORIZED",
      artifactReference: { artifact: "Feature6-Optimization-Targets.json", contentHash: "6".repeat(64) },
    };
    (worksheet.options as Array<Record<string, unknown>>) = [
      {
        optionId: "Analysis-A:scenario-a",
        status: "completed",
        targetId: "scenario-a",
        baselineMetrics: structuredClone(baseline),
        resultMetrics: { ...structuredClone(baseline), rssSigma: baseline.rssSigma * 0.9, cpk: baseline.cpk + 0.12, yield: Math.min(1, baseline.yield + 0.001), dpm: Math.max(0, baseline.dpm - 10) },
        scenarioEvidence: {
          targetId: "scenario-a",
          baselineIdentity: structuredClone(worksheet.baselineIdentity),
          factorOverrides: [{ factor: factorA, upperTolerance: 0.05, lowerTolerance: -0.05 }],
          calculationReference: structuredClone(input.f6Result.provenance.f4Reference),
          formulaReferences: [{ outputField: "capability.cpk", formulaId: "cpk-v1", formulaVersion: "excel-ta-v1" }],
        },
        feasibility: { status: "supported", reasonCodes: ["caller_provided_target"], evidenceReferences: ["Feature6-Optimization-Targets.json"] },
        evidenceReferences: [structuredClone(input.f6Result.provenance.f4Reference)],
        impactRank: 1,
        targetContext: {
          targetId: "scenario-a",
          targetType: "factor_tolerance",
          factor: factorA,
          upperTolerance: 0.05,
          lowerTolerance: -0.05,
          unit: "mm",
        },
      },
      {
        optionId: "Analysis-A:scenario-b",
        status: "completed",
        targetId: "scenario-b",
        baselineMetrics: structuredClone(baseline),
        resultMetrics: { ...structuredClone(baseline), rssSigma: baseline.rssSigma * 0.8, cpk: baseline.cpk + 0.2, yield: Math.min(1, baseline.yield + 0.002), dpm: Math.max(0, baseline.dpm - 20) },
        scenarioEvidence: {
          targetId: "scenario-b",
          baselineIdentity: structuredClone(worksheet.baselineIdentity),
          factorOverrides: [{ factor: factorB, upperTolerance: 0.08, lowerTolerance: -0.08 }],
          calculationReference: structuredClone(input.f6Result.provenance.f4Reference),
          formulaReferences: [{ outputField: "capability.cpk", formulaId: "cpk-v1", formulaVersion: "excel-ta-v1" }],
        },
        feasibility: { status: "supported", reasonCodes: ["caller_provided_target"], evidenceReferences: ["Feature6-Optimization-Targets.json"] },
        evidenceReferences: [structuredClone(input.f6Result.provenance.f4Reference)],
        impactRank: 2,
        targetContext: {
          targetId: "scenario-b",
          targetType: "improvement_ratio",
          factor: factorB,
          ratio: 0.2,
          appliesTo: "tolerance_band",
        },
      },
      {
        optionId: "Analysis-A:scenario-c",
        status: "completed",
        targetId: "scenario-c",
        baselineMetrics: structuredClone(baseline),
        resultMetrics: { ...structuredClone(baseline), rssSigma: baseline.rssSigma * 0.75, cpk: baseline.cpk + 0.3, yield: Math.min(1, baseline.yield + 0.003), dpm: Math.max(0, baseline.dpm - 30) },
        scenarioEvidence: {
          targetId: "scenario-c",
          baselineIdentity: structuredClone(worksheet.baselineIdentity),
          factorOverrides: [
            { factor: factorA, upperTolerance: 0.07, lowerTolerance: -0.07 },
            { factor: factorB, upperTolerance: 0.07, lowerTolerance: -0.07 },
            { factor: factorC, upperTolerance: 0.07, lowerTolerance: -0.07 },
          ],
          calculationReference: structuredClone(input.f6Result.provenance.f4Reference),
          formulaReferences: [{ outputField: "capability.cpk", formulaId: "cpk-v1", formulaVersion: "excel-ta-v1" }],
        },
        feasibility: { status: "supported", reasonCodes: ["caller_provided_target"], evidenceReferences: ["Feature6-Optimization-Targets.json"] },
        evidenceReferences: [structuredClone(input.f6Result.provenance.f4Reference)],
        impactRank: 3,
        targetContext: {
          targetId: "scenario-c",
          targetType: "system_target",
          systemIdentity: {
            baselineIdentity: structuredClone(worksheet.baselineIdentity),
            designNominal: 0,
            mean: 0,
            rssSigma: 0.1,
            lowerSpecLimit: -1,
            upperSpecLimit: 1,
            targetCpk: 1.33333333333333,
            traceReferences: [{ outputField: "capability.cpk", formulaId: "cpk-v1", formulaVersion: "excel-ta-v1" }],
          },
          target: { targetCpk: 1.5 },
          apportionment: { policy: "EQUAL_SELECTED", selectedFactors: [factorA, factorB, factorC] },
        },
      },
    ];
    worksheet.highestImpactAction = { optionId: "Analysis-A:scenario-c", impactRank: 3 };
    worksheet.runStatus = "COMPLETED";
    input.f6Result.summary = {
      worksheetCount: 1,
      completedWorksheetCount: 1,
      partiallyCompletedWorksheetCount: 0,
      inputRejectedWorksheetCount: 0,
      candidateOptionCount: 0,
      completedOptionCount: 3,
      insufficientEvidenceOptionCount: 0,
      calculationFailedOptionCount: 0,
    };
    return input;
  }

  it("builds the strict sixteen-section report without inferring missing context", () => {
    const report = createF6ComposedEngineeringReportV2(bundleV2());
    const worksheet = report.worksheets[0]!;

    expect(report.reportVersion).toBe("f6-composed-report-v2");
    expect(Object.keys(worksheet.sections)).toEqual([
      "executiveSummary", "objectiveAndRequirements", "operatingConditions", "inputIntegrity",
      "toleranceLoopDefinition", "calculationSelfCheck", "statisticalResults", "specificationAndMargins",
      "capabilityAssessment", "contributorAnalysis", "sensitivityAndOptimization", "riskAssessment",
      "engineeringRecommendations", "designIntentReview", "dataGaps", "finalConclusion",
    ]);
    expect(worksheet.sections.objectiveAndRequirements.analysisObject).toBeNull();
    expect(worksheet.sections.operatingConditions.conditions).toEqual([]);
    expect(worksheet.sections.toleranceLoopDefinition.equation).toBeNull();
    expect(worksheet.baselineDecision).toBe("FAIL");
    expect(worksheet.status).toBe("FAIL");
    expect(worksheet.sections.calculationSelfCheck.worstCaseUpperCheck).toMatchObject({ checkId: "worst-case-upper", result: "PASS" });
    expect(worksheet.sections.calculationSelfCheck.worstCaseLowerCheck).toMatchObject({ checkId: "worst-case-lower", result: "PASS" });
    expect(worksheet.sections.calculationSelfCheck.worstCaseUpperCheck?.tolerance.value).toBe(1e-12);
    expect(worksheet.sections.calculationSelfCheck.worstCaseLowerCheck?.tolerance.value).toBe(1e-12);
    expect(worksheet.sections.calculationSelfCheck.worstCaseUpperCheck?.toleranceBasis).toBe("input resolution");
    expect(worksheet.sections.calculationSelfCheck.worstCaseLowerCheck?.toleranceBasis).toBe("input resolution");
  });

  it("projects analysis characteristic, governance completeness, and unsigned loop evidence without analysis context", () => {
    const input = structuredClone(bundleV2(0.12, undefined, {
      factorCount: 3,
      toleranceLoopDescription: "DIM829, Audio Jack to C bucket Gap",
      missingDrawingAndDimIds: true,
    }));
    const inputWorksheet = input.f5Report.worksheets[0];
    if (inputWorksheet?.status !== "completed") throw new Error("fixture worksheet must be completed");
    inputWorksheet.calculationResult.factors[0]!.contribution = 0.34;
    inputWorksheet.calculationResult.factors[1]!.contribution = 0.33;
    inputWorksheet.calculationResult.factors[2]!.contribution = 0.33;
    for (const contributor of inputWorksheet.sections.majorContributors.items) {
      contributor.contributionPercent = inputWorksheet.calculationResult.factors[contributor.factorIndex]!.contribution * 100;
    }
    inputWorksheet.sections.majorContributors.items.sort((left, right) => (
      right.contributionPercent - left.contributionPercent || left.factorIndex - right.factorIndex
    ));
    for (const statement of inputWorksheet.statements) {
      if (statement.type === "FACT" && "metric" in statement.content
        && statement.content.metric === "factor_contribution") {
        const contributor = inputWorksheet.sections.majorContributors.items.find(
          ({ factorReference }) => factorReference === statement.content.factorReference,
        );
        if (contributor !== undefined) statement.content.contributionPercent = contributor.contributionPercent;
      }
    }

    const report = createF6ComposedEngineeringReportV2(input);
    const worksheet = report.worksheets[0]!;

    expect(worksheet.sections.objectiveAndRequirements.analysisCharacteristic)
      .toBe("DIM829, Audio Jack to C bucket Gap");
    expect(worksheet.sections.inputIntegrity.governanceSummary).toMatchObject({
      factorCount: 3,
      drawingNumberMissingCount: 3,
      dimIdMissingCount: 3,
    });
    expect(worksheet.sections.toleranceLoopDefinition.loopEvidence?.signedEquationAuthorized).toBe(false);
    expect(worksheet.sections.objectiveAndRequirements.analysisObject).toBeNull();
  });

  it("does not infer analysis characteristic from worksheet name when governed tolerance loop description is missing or blank", () => {
    const missing = structuredClone(bundleV2(0.12, undefined, {
      factorCount: 2,
      toleranceLoopDescription: "DIM829, Audio Jack to C bucket Gap",
    }));
    const missingWorksheet = missing.f2Report.worksheets.find(({ worksheetName }) => worksheetName === "Analysis-A");
    if (missingWorksheet?.status !== "ready") throw new Error("fixture worksheet must be ready");
    delete missingWorksheet.toleranceLoopDescription;

    const blank = structuredClone(bundleV2(0.12, undefined, {
      factorCount: 2,
      toleranceLoopDescription: "DIM829, Audio Jack to C bucket Gap",
    }));
    const blankWorksheet = blank.f2Report.worksheets.find(({ worksheetName }) => worksheetName === "Analysis-A");
    if (blankWorksheet?.status !== "ready") throw new Error("fixture worksheet must be ready");
    blankWorksheet.toleranceLoopDescription = "   ";

    const missingReport = createF6ComposedEngineeringReportV2(missing);
    const blankReport = createF6ComposedEngineeringReportV2(blank);

    expect(missingReport.worksheets[0]!.sections.objectiveAndRequirements.analysisCharacteristic).toBeUndefined();
    expect(missingReport.worksheets[0]!.sections.objectiveAndRequirements.analysisCharacteristic).not.toBe("Analysis-A");
    expect(missingReport.worksheets[0]!.sections.toleranceLoopDefinition.loopEvidence).toBeUndefined();

    expect(blankReport.worksheets[0]!.sections.objectiveAndRequirements.analysisCharacteristic).toBeUndefined();
    expect(blankReport.worksheets[0]!.sections.objectiveAndRequirements.analysisCharacteristic).not.toBe("Analysis-A");
    expect(blankReport.worksheets[0]!.sections.toleranceLoopDefinition.loopEvidence).toBeUndefined();
  });

  it("projects governance completeness and loop factor descriptions only from exact worksheet/table/source rows", () => {
    const input = structuredClone(bundleV2(0.12, undefined, {
      factorCount: 2,
      toleranceLoopDescription: "DIM829, Audio Jack to C bucket Gap",
    }));
    const f2Worksheet = input.f2Report.worksheets.find(({ worksheetName }) => worksheetName === "Analysis-A");
    if (f2Worksheet?.status !== "ready") throw new Error("fixture worksheet must be ready");
    f2Worksheet.rows.push(f2Row("Analysis-A", 99, true));
    input.f2Report.summary.factorRowCount += 1;
    input.f2Report.summary.nonF0ProcessCategoryCount += 1;
    input.f2Report.summary.missingDimIdCount += 1;

    const report = createF6ComposedEngineeringReportV2(input);
    const worksheet = report.worksheets[0]!;

    expect(worksheet.sections.inputIntegrity.governanceSummary).toMatchObject({
      factorCount: 2,
      drawingNumberMissingCount: 0,
      dimIdMissingCount: 0,
      affectedSourceRows: [],
    });
    expect(worksheet.sections.toleranceLoopDefinition.loopEvidence?.factorDescriptions).toHaveLength(2);
    expect(worksheet.sections.toleranceLoopDefinition.loopEvidence?.factorDescriptions.every(({ sourceRow }) => sourceRow !== 99)).toBe(true);
  });

  it("projects matched internal process guidance from the exact F2 row identity", () => {
    const input = structuredClone(bundleV2(1));
    const f2Worksheet = input.f2Report.worksheets.find(({ worksheetName }) => worksheetName === "Analysis-A");
    if (f2Worksheet?.status !== "ready") throw new Error("fixture worksheet must be ready");
    const row = f2Worksheet.rows.find(({ sourceRow }) => sourceRow === 2);
    if (row === undefined) throw new Error("fixture row must exist");
    row.capabilityStatus = "internal_within_guidance";
    row.f0KnowledgeBaseVersion = "internal-v1";
    row.recommendation = {
      kind: "internal-guidance",
      assessedTotalBand: 0.4,
      maximumRecommendedTotalBand: 0.5,
      unit: "mm",
      matchedEntryId: "cnc-linear-6",
      fallbackApplied: false,
      evidence: {
        sourceFileHash: "c".repeat(64),
        sheetName: "ISO 2768-1 Class m",
        sourceRange: "A6:F6",
      },
    };
    input.f2Report.summary.nonF0ProcessCategoryCount -= 1;
    input.f2Report.summary.internalWithinGuidanceCount += 1;

    const report = createF6ComposedEngineeringReportV2(input);
    const factor = report.worksheets[0]!.sections.inputIntegrity.factors.find(({ factor }) =>
      factor.tableId === "table-Analysis-A" && factor.sourceRow === 2);

    expect(factor?.processGuidance).toEqual({
      status: "within-guidance",
      capabilityVersion: "internal-v1",
      assessedTotalBand: 0.4,
      maximumRecommendedTotalBand: 0.5,
      matchedEntryId: "cnc-linear-6",
      fallbackApplied: false,
      evidence: {
        sourceFileHash: "c".repeat(64),
        sheetName: "ISO 2768-1 Class m",
        sourceRange: "A6:F6",
      },
      f0InformationReason: null,
    });
  });

  it("projects missing_process_context as unknown process guidance without inferring values", () => {
    const input = structuredClone(bundleV2(1));
    const f2Worksheet = input.f2Report.worksheets.find(({ worksheetName }) => worksheetName === "Analysis-A");
    if (f2Worksheet?.status !== "ready") throw new Error("fixture worksheet must be ready");
    const row = f2Worksheet.rows.find(({ sourceRow }) => sourceRow === 2);
    if (row === undefined) throw new Error("fixture row must exist");
    row.capabilityStatus = "f0_information_insufficient";
    row.f0KnowledgeBaseVersion = "internal-v1";
    row.f0InformationReason = "missing_process_context";
    delete row.recommendation;
    input.f2Report.summary.nonF0ProcessCategoryCount -= 1;
    input.f2Report.summary.f0InformationInsufficientCount += 1;

    const report = createF6ComposedEngineeringReportV2(input);
    const factor = report.worksheets[0]!.sections.inputIntegrity.factors.find(({ factor }) =>
      factor.tableId === "table-Analysis-A" && factor.sourceRow === 2);

    expect(factor?.processGuidance).toEqual({
      status: "unknown",
      capabilityVersion: "internal-v1",
      assessedTotalBand: null,
      maximumRecommendedTotalBand: null,
      matchedEntryId: null,
      fallbackApplied: null,
      evidence: null,
      f0InformationReason: "missing_process_context",
    });
  });

  it("uses worksheet/table/source-row identity and ignores contaminated F2 rows", () => {
    const input = structuredClone(bundleV2(1));
    const f2Worksheet = input.f2Report.worksheets.find(({ worksheetName }) => worksheetName === "Analysis-A");
    if (f2Worksheet?.status !== "ready") throw new Error("fixture worksheet must be ready");
    const contaminated = structuredClone(f2Worksheet.rows[0]!);
    contaminated.tableId = "table-contaminated";
    contaminated.capabilityStatus = "internal_within_guidance";
    contaminated.f0KnowledgeBaseVersion = "internal-v1";
    contaminated.recommendation = {
      kind: "internal-guidance",
      assessedTotalBand: 0.1,
      maximumRecommendedTotalBand: 0.1,
      unit: "mm",
      matchedEntryId: "bad-cross-row",
      fallbackApplied: true,
      evidence: {
        sourceFileHash: "d".repeat(64),
        sheetName: "contaminated",
        sourceRange: "A1:F1",
      },
    };
    f2Worksheet.rows.push(contaminated);
    input.f2Report.summary.factorRowCount += 1;
    input.f2Report.summary.internalWithinGuidanceCount += 1;

    const report = createF6ComposedEngineeringReportV2(input);
    const factor = report.worksheets[0]!.sections.inputIntegrity.factors.find(({ factor }) =>
      factor.tableId === "table-Analysis-A" && factor.sourceRow === 2);

    expect(factor?.processGuidance?.status).toBe("not_applicable");
    expect(factor?.processGuidance?.matchedEntryId).toBeNull();
  });

  it("does not turn guidance-exceeded into risk, decision, target, or action changes", () => {
    const control = createF6ComposedEngineeringReportV2(bundleV2(1));
    const input = structuredClone(bundleV2(1));
    const f2Worksheet = input.f2Report.worksheets.find(({ worksheetName }) => worksheetName === "Analysis-A");
    if (f2Worksheet?.status !== "ready") throw new Error("fixture worksheet must be ready");
    const row = f2Worksheet.rows.find(({ sourceRow }) => sourceRow === 2);
    if (row === undefined) throw new Error("fixture row must exist");
    row.capabilityStatus = "internal_guidance_exceeded";
    row.f0KnowledgeBaseVersion = "internal-v1";
    row.recommendation = {
      kind: "internal-guidance",
      assessedTotalBand: 0.4,
      maximumRecommendedTotalBand: 0.2,
      unit: "mm",
      matchedEntryId: "cnc-linear-6",
      fallbackApplied: false,
      evidence: {
        sourceFileHash: "e".repeat(64),
        sheetName: "ISO 2768-1 Class m",
        sourceRange: "A6:F6",
      },
    };
    input.f2Report.summary.nonF0ProcessCategoryCount -= 1;
    input.f2Report.summary.internalGuidanceExceededCount += 1;

    const report = createF6ComposedEngineeringReportV2(input);
    const worksheet = report.worksheets[0]!;
    const baseline = control.worksheets[0]!;

    expect(worksheet.sections.inputIntegrity.factors[0]?.processGuidance?.status).toBe("guidance-exceeded");
    expect(worksheet.status).toBe(baseline.status);
    expect(worksheet.baselineDecision).toBe(baseline.baselineDecision);
    expect(worksheet.sections.riskAssessment.risks).toEqual(baseline.sections.riskAssessment.risks);
    expect(worksheet.sections.sensitivityAndOptimization.targets).toEqual(baseline.sections.sensitivityAndOptimization.targets);
    expect(worksheet.sections.sensitivityAndOptimization.options).toEqual(baseline.sections.sensitivityAndOptimization.options);
    expect(worksheet.sections.engineeringRecommendations).toEqual(baseline.sections.engineeringRecommendations);
  });

  it("normalizes floating-point drift in cumulative contributor percentages", () => {
    const input = structuredClone(bundleV2());
    const worksheet = input.f5Report.worksheets[0];
    if (worksheet?.status !== "completed") throw new Error("fixture worksheet must be completed");
    worksheet.calculationResult.factors[0]!.contribution = 0.1;
    worksheet.calculationResult.factors[1]!.contribution = 0.9000000000000001;
    for (const contributor of worksheet.sections.majorContributors.items) {
      contributor.contributionPercent = worksheet.calculationResult.factors[contributor.factorIndex]!.contribution * 100;
    }
    worksheet.sections.majorContributors.items.sort((left, right) => (
      right.contributionPercent - left.contributionPercent || left.factorIndex - right.factorIndex
    ));
    for (const statement of worksheet.statements) {
      if (statement.type === "FACT" && "metric" in statement.content
        && statement.content.metric === "factor_contribution") {
        const contributor = worksheet.sections.majorContributors.items.find(
          ({ factorReference }) => factorReference === statement.content.factorReference,
        );
        if (contributor !== undefined) statement.content.contributionPercent = contributor.contributionPercent;
      }
    }
    expect(worksheet.calculationResult.factors.reduce(
      (total, factor) => total + factor.contribution * 100,
      0,
    )).toBeGreaterThan(100);

    const report = createF6ComposedEngineeringReportV2(input);
    const contributors = report.worksheets[0]!.sections.contributorAnalysis.contributors;

    expect(contributors.at(-1)!.cumulativePercent).toBe(100);
  });

  it("keeps a passing predictive baseline conditional when P1 context gaps remain", () => {
    const report = createF6ComposedEngineeringReportV2(bundleV2(1));

    expect(report.worksheets[0]!.baselineDecision).toBe("PASS");
    expect(report.worksheets[0]!.status).toBe("CONDITIONAL_PASS");
    expect(report.worksheets[0]!.dataGaps.some(({ priority }) => priority === "P1")).toBe(true);
  });

  it("projects three governed targets and scenario comparison rows without recalculating solver output", () => {
    const report = createF6ComposedEngineeringReportV2(withGovernedTargetsFixture());
    const optimization = report.worksheets[0]!.sections.sensitivityAndOptimization;

    expect(optimization.targets).toHaveLength(3);
    expect(optimization.targets.map(({ targetId }) => targetId)).toEqual(["scenario-a", "scenario-b", "scenario-c"]);
    expect(optimization.targets.map(({ targetType }) => targetType)).toEqual([
      "factor_tolerance",
      "improvement_ratio",
      "system_target",
    ]);
    expect(optimization.scenarioComparisons).toHaveLength(3);
    expect(optimization.scenarioComparisons?.every(({ baselineMetrics, scenarioMetrics }) => (
      baselineMetrics.cpk <= scenarioMetrics.cpk
    ))).toBe(true);
    expect(optimization.targets.find(({ targetId }) => targetId === "scenario-c")).toMatchObject({
      targetValue: { targetCpk: 1.5 },
      apportionment: { policy: "EQUAL_SELECTED" },
    });
  });

  it("preserves candidate-only mode with target_not_provided and no quantified scenario rows", () => {
    const report = createF6ComposedEngineeringReportV2(bundleV2());
    const optimization = report.worksheets[0]!.sections.sensitivityAndOptimization;

    expect(optimization.options).toHaveLength(1);
    expect(optimization.options[0]).toMatchObject({
      status: "candidate",
      reasonCode: "target_not_provided",
    });
    expect(optimization.targets).toEqual([]);
    expect(optimization.scenarioComparisons).toEqual([]);
    expect(optimization.roiStatus).toBe("NOT_COMPUTED");
  });

  it("builds deduplicated action-plan rows while preserving canonical worksheet dataGaps", () => {
    const input = bundleV2(1, undefined, { missingDrawingAndDimIds: true });
    const report = createF6ComposedEngineeringReportV2(input);
    const worksheet = report.worksheets[0]!;
    const drawingGaps = worksheet.dataGaps.filter(({ gapId }) => gapId.includes(":drawing:"));

    expect(drawingGaps.length).toBeGreaterThan(1);
    expect(drawingGaps.every(({ gapId, missingInformation }) => {
      const sourceRow = Number(gapId.split(":").at(-1));
      return missingInformation === `Drawing Number is missing for source row ${sourceRow}.`;
    })).toBe(true);
    expect(worksheet.sections.dataGaps.gaps).toEqual(worksheet.dataGaps);
    expect(worksheet.sections.dataGaps.actionPlan?.length).toBeLessThan(worksheet.dataGaps.length);
    const drawingAction = worksheet.sections.dataGaps.actionPlan?.find(({ action }) => action === "Drawing Number is missing.");
    expect(drawingAction?.scope.some((item) => item.includes("source rows"))).toBe(true);
    expect(drawingAction?.gapIds).toEqual(expect.arrayContaining(drawingGaps.map(({ gapId }) => gapId)));
    expect(drawingAction?.gapIds.length).toBe(drawingGaps.length);
  });

  it("makes an in-scope blocked worksheet drive workbook INCOMPLETE", () => {
    const report = createF6ComposedEngineeringReportV2(bundleV2(1, "Blocked-Sheet"));

    expect(report.blockedWorksheets).toHaveLength(1);
    expect(report.blockedWorksheets[0]).toMatchObject({ worksheetName: "Blocked-Sheet", status: "INCOMPLETE" });
    expect(report.overallStatus).toBe("INCOMPLETE");
  });

  it("exports only the V2 composed builder from the package entrypoint", () => {
    expect(packageRoot.createF6ComposedEngineeringReport).toBe(createF6ComposedEngineeringReportV2);
  });
});
