import { describe, expect, it } from "vitest";
import {
  f6ComposedEngineeringReportSchema,
  f6OptimizationResultSchema,
  type CalculationRequest,
  type F2UserReport,
  type F5DataInterpretationResult,
} from "@ai-assist/contracts";
import { createCalculation } from "./calculation.js";
import { createF5DataInterpretation } from "./f5-data-interpretation.js";
import { createF6Optimization } from "./f6-optimization.js";
import { calculateF6Scenario } from "./f6-scenario-adapter.js";
import * as packageRoot from "./index.js";
import { createF6ComposedEngineeringReport } from "./f6-composed-report.js";

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

function calculationRequest(worksheetName: string, specificationLimit: number): CalculationRequest {
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
        toleranceLoopDescription: `Loop ${worksheetName}`,
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
          rows: [1, 2].map((factor, index) => {
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

function governanceRows(worksheetName: string, calculation: ReturnType<typeof createCalculation>) {
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

function f2Row(worksheetName: string, sourceRow: number) {
  return {
    worksheetName,
    tableId: `table-${worksheetName}`,
    sourceRow,
    actualFields: {
      factorName: `factor-${sourceRow - 1}`,
      partName: "Part",
      drawingNumber: `DRAW-${sourceRow - 1}`,
      dimCharacteristicId: `DIM-${sourceRow - 1}`,
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
    missingIdentifiers: [],
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

function summary(readyCount: number, blockedCount: number) {
  return {
    worksheetsChecked: readyCount + blockedCount,
    blockedWorksheetCount: blockedCount,
    readyWorksheetCount: readyCount,
    factorRowCount: readyCount * 2 + blockedCount,
    rowsWithRequiredMissing: 0,
    requiredMissingFieldCount: 0,
    missingImageWorksheetCount: blockedCount,
    internalWithinGuidanceCount: 0,
    internalGuidanceExceededCount: 0,
    f0InformationInsufficientCount: 0,
    publicLibraryMatchCount: 0,
    nonF0ProcessCategoryCount: readyCount * 2 + blockedCount,
    unableToCheckCount: 0,
    publicToleranceDifferenceCount: 0,
    publicDistributionDifferenceCount: 0,
    missingDimIdCount: 0,
    missingPartNumberCount: 0,
  };
}

function bundle(specifications: Array<[string, number]>, blockedWorksheetName?: string, failOptions = false) {
  const calculations = specifications.map(([name, limit]) => createCalculation(calculationRequest(name, limit)));
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
  const generatedF6Result = createF6Optimization({
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
      baselineCalculationRequest: calculationRequest(specifications[index]![0], specifications[index]![1]),
      baselineCalculation: calculation,
      f5Worksheet: f5Report.worksheets[index],
      f3GovernanceRows: rows[index],
      f2Findings: [],
      supplierBindings: [],
    })),
  }, failOptions ? {
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
    toleranceLoopDescription: `Loop ${worksheetName}`,
    status: "ready" as const,
    tolerancePathImageStatus: "available" as const,
    systemSpecification: f2Specification(worksheetName, limit),
    systemSpecificationIssues: [],
    rows: [f2Row(worksheetName, 2), f2Row(worksheetName, 3)],
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
    summary: summary(readyWorksheets.length, blockedWorksheets.length),
  };
  return { f2Report, f5Report, f6Result };
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
      affectsCapabilityData: false,
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
    expect(packageRoot.createF6ComposedEngineeringReport).toBe(createF6ComposedEngineeringReport);
  });
});
