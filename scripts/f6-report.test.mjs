/* global structuredClone */

import { describe, expect, it } from "vitest";
import {
  f6LegacyOptimizationResultSchema as f6OptimizationResultSchema,
  f6OptimizationResultV4Schema,
} from "../packages/contracts/dist/contracts.js";
import { renderF6Report as renderF6ReportV2, renderLegacyF6Report as renderF6Report } from "./f6-report.mjs";

const HASH = "a".repeat(64);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableMidpoint(lower, upper) {
  return lower + (upper - lower) / 2;
}

function result() {
  return f6OptimizationResultSchema.parse({
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F6",
    status: "calculation_failed",
    optimizationVersion: "f6-optimization-v1",
    workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
    worksheets: [{
      worksheetName: "Analysis|<script>[x](javascript:alert(1))",
      f4CalculationIndex: 1,
      status: "calculation_failed",
      baselineIdentity: {
        projectReference: "project-1",
        runReference: "run-1-1",
        calculationVersion: "excel-ta-v1",
        workbookContentHash: HASH,
        worksheetName: "Analysis|<script>[x](javascript:alert(1))",
        tableId: "table-1",
        factorCount: 1,
        factors: [{
          factorName: "factor-1",
          unit: "mm",
          source: { worksheetName: "Analysis|<script>[x](javascript:alert(1))", tableId: "table-1", sourceRow: 2 },
          input: { nominalValue: 0, upperTolerance: 0.6, lowerTolerance: -0.6, longTermSafetyFactor: 1, sigmaLevel: 3, distribution: "normal" },
          mean: 0,
          halfTolerance: 0.6,
          sigma: 0.2,
          contribution: 1,
        }],
        system: { designNominal: 0, mean: 0, additionalMeanShift: 0, worstCaseUpper: 0.6, worstCaseLower: -0.6, rssSigma: 0.2 },
        capability: {
          lowerSpecLimit: -0.48,
          upperSpecLimit: 0.6,
          targetSigmaLevel: 4,
          targetCpk: 1.33,
          cp: 0.9,
          lowerCpk: 0.8,
          upperCpk: 1,
          cpk: 0.8,
          lowerZ: 2.4,
          upperZ: 3,
          lowerDpm: 19_000,
          upperDpm: 1_000,
          totalDpm: 20_000,
          outOfSpecRatio: 0.02,
          yield: 0.98,
          status: "FAIL",
        },
      },
      baselineMetrics: { mean: 0, rssSigma: 0.2, cp: 0.9, cpk: 0.8, yield: 0.98, dpm: 20_000 },
      targetCapability: { targetCpk: 1.33, targetSigmaLevel: 4, source: "worksheet" },
      inputFindings: [],
      options: [
        {
          status: "calculation_failed",
          optionId: "top-1",
          optionKind: "reduce_top_contributor_20",
          reasonCode: "controlled_failure|<b>",
          evidenceReferences: [],
          impactRank: null,
        },
        {
          status: "calculation_failed",
          optionId: "top-3",
          optionKind: "reduce_top_3_contributors_30",
          reasonCode: "controlled_failure",
          evidenceReferences: [],
          impactRank: null,
        },
        {
          status: "insufficient_evidence",
          optionId: "supplier-gate",
          optionKind: "improve_supplier_capability",
          predictedImprovement: "insufficient_evidence",
          requiredInputs: ["confirmed_supplier_capability_evidence", "controlled_supplier_scenario_calculation"],
          evidenceReferences: [],
          relativeCost: "insufficient_evidence",
          roiScore: "not_computed",
          impactRank: null,
        },
        {
          status: "insufficient_evidence",
          optionId: "datum-gate",
          optionKind: "tighten_datum_strategy",
          predictedImprovement: "insufficient_evidence",
          requiredInputs: ["confirmed_datum_chain_evidence", "engineering_review"],
          evidenceReferences: [],
          relativeCost: "insufficient_evidence",
          roiScore: "not_computed",
          impactRank: null,
        },
      ],
      risks: [{
        riskId: "risk-1",
        category: "Product",
        rating: "Critical",
        status: "open",
        reason: "Cpk below requirement | <img src=x onerror=alert(1)>",
        evidenceReferences: [{ artifact: "Feature5-Report.json", contentHash: HASH }],
      }],
      recommendations: [],
      roiStatus: "not_computed",
      clarifications: [{
        clarificationId: "supplier-input",
        reasonCode: "supplier_scenario_evidence_closure_required",
        requiredInputs: ["confirmed_supplier_capability_evidence"],
        questionForReviewer: "Provide supplier evidence.",
        evidenceReferences: [],
      }],
    }],
    summary: {
      worksheetCount: 1,
      completedWorksheetCount: 0,
      partiallyCompletedWorksheetCount: 0,
      calculationFailedWorksheetCount: 1,
      inputRejectedWorksheetCount: 0,
      completedOptionCount: 0,
      calculationFailedOptionCount: 2,
      insufficientEvidenceOptionCount: 2,
    },
    provenance: {
      f2Reference: { artifact: "Feature2-Report.json", contentHash: HASH },
      f3Reference: { artifact: "Feature3-Report.json", contentHash: HASH },
      f4Reference: { artifact: "Feature4-Calculation.json", contentHash: HASH, runId: "run-1", calculationVersion: "excel-ta-v1" },
      f5Reference: { artifact: "Feature5-Report.json", contentHash: HASH, interpretationVersion: "f5-data-interpretation-v1" },
      reportScope: {
        worksheetNames: ["Analysis|<script>[x](javascript:alert(1))"],
        blockedWorksheetNames: [],
      },
      f0Versions: { knowledgeBaseVersion: "v1", capabilityVersion: "internal-v1", interpretationVersion: "interpretation-rules-v2" },
      scenarioPolicyVersion: "f6-scenario-policy-v1",
    },
  });
}

describe("renderF6Report", () => {
  it("renders governed metrics, risks, options, and literal evidence gaps", () => {
    const markdown = renderF6Report(result());

    expect(markdown).toContain("# Feature 6 优化工程报告");
    expect(markdown).toContain("| Metric | Result | Status |");
    expect(markdown).toContain("| Scenario | Predicted Improvement |");
    expect(markdown).toContain("Improve Supplier Capability");
    expect(markdown).toContain("Tighten Datum Strategy");
    expect(markdown).toContain(String.raw`insufficient\_evidence`);
    expect(markdown).toContain(String.raw`confirmed\_supplier\_capability\_evidence`);
    expect(markdown).toContain(String.raw`confirmed\_datum\_chain\_evidence`);
    expect(markdown).toContain(String.raw`Highest Impact Action: insufficient\_evidence`);
    expect(markdown).toContain(String.raw`ROI: not\_computed`);
    expect(markdown).toContain(String.raw`| Cpk | 0.8 | FAIL |`);
    expect(markdown).toContain("Capability Status: FAIL");
    expect(markdown).toContain(String.raw`Optimization Status: calculation\_failed`);
    expect(markdown).not.toMatch(/^- Status:/m);
    expect(markdown).not.toMatch(/meets target|below target/);
    expect(markdown).not.toContain("Highest ROI");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it.each([
    [0.8, "FAIL"],
    [1.1, "RISK"],
    [1.33, "PASS"],
  ])("renders baseline Cpk %s with capability status %s independently of optimization status", (cpk, expectedStatus) => {
    const input = result();
    input.worksheets[0].baselineMetrics.cpk = cpk;

    const markdown = renderF6Report(input);

    expect(markdown).toContain(`Capability Status: ${expectedStatus}`);
    expect(markdown).toContain(String.raw`Optimization Status: calculation\_failed`);
  });

  it.each([
    ["validation_abnormality", true, "RISK"],
    ["confirmed_requirement_violation", true, "FAIL"],
    ["optimization_failure", false, "PASS"],
  ])("derives capability status from governed %s input risk", (findingKind, affectsCapabilityData, expectedStatus) => {
    const input = result();
    input.worksheets[0].baselineMetrics.cpk = 1.33;
    input.worksheets[0].inputFindings = [{
      findingCode: "governed-finding",
      findingKind,
      severity: "Major",
      message: "A governed finding is available.",
      affectsCapabilityData,
      evidenceReferences: [{ artifact: "Feature2-Report.json", contentHash: HASH }],
    }];

    expect(renderF6Report(input)).toContain(`Capability Status: ${expectedStatus}`);
  });

  it("escapes Markdown, HTML, tables, and links without emitting traces or absolute paths", () => {
    const markdown = renderF6Report(result(), { ignored: "C:\\private\\secret.xlsx" });

    expect(markdown).toContain("Analysis\\|&lt;script&gt;\\[x\\]\\(javascript:alert\\(1\\)\\)");
    expect(markdown).toContain("Cpk below requirement \\| &lt;img src=x onerror=alert\\(1\\)&gt;");
    expect(markdown).not.toMatch(/<script|<img|javascript:\[|[A-Za-z]:[\\/]/i);
    expect(markdown).not.toMatch(/sourceCells|traceRecords|excelFormula|calculationTrace/i);
  });

  it("redacts absolute paths from rendered risk and clarification text", () => {
    const input = result();
    const injected = String.raw`C:\private\risk.txt after-win; \\server\share\evidence.csv after-unc; /home/user/input after-posix; [/opt/review] after-bracket; [drawing](/var/drawings/a.pdf) after-markdown; "C:\Program Files\secret.txt" after-quoted; <b>html</b> | table SAFE_TRAILER`;
    input.worksheets[0].risks[0].reason = injected;
    input.worksheets[0].clarifications[0].questionForReviewer = injected;

    const markdown = renderF6Report(input);

    for (const raw of ["C:\\private", "\\\\server\\share", "/home/user", "/opt/review", "/var/drawings"]) {
      expect(markdown).not.toContain(raw);
    }
    expect(markdown).not.toContain("<b>");
    expect(markdown).toContain("[redacted-local-path]");
    for (const preserved of ["after-win", "after-unc", "after-posix", "after-bracket", "after-markdown", "after-quoted", String.raw`SAFE\_TRAILER`]) {
      expect(markdown).toContain(preserved);
    }
    expect(markdown).toContain(String.raw`\| table`);
  });

  it("is deterministic and rejects invalid structured input generically", () => {
    expect(renderF6Report(clone(result()))).toBe(renderF6Report(result()));
    expect(() => renderF6Report({ featureId: "F6", secret: "do-not-echo" })).toThrow("Invalid F6 result.");
  });
});

describe("renderF6Report V2", () => {
  function resultV4(selectedStatus = "step2_tolerance_optimized", { unit = "mm" } = {}) {
    const reference = (artifact) => ({ artifact, contentHash: HASH });
    const workbook = { fileName: "Anonymous.xlsx", contentHash: HASH };
    const interactionLanguage = {
      languageTag: "en-US",
      uiCatalogLanguage: "en",
      lockedAtTurnId: "turn-1",
      source: "workflow_start",
      fallbackUsed: false,
    };
    const baselineIdentity = {
      calculationVersion: "excel-ta-v1",
      projectReference: "project-a",
      runReference: "run-a",
      workbookContentHash: HASH,
      worksheetName: "Analysis-A",
      tableId: "table-a",
    };
    const factorIdentity = {
      worksheetName: "Analysis-A",
      tableId: "table-a",
      sourceRow: 14,
      factorName: "Factor A",
      unit,
    };
    const trigger = selectedStatus === "baseline_meets_target"
      ? { lowerCpk: 1.4, upperCpk: 1.4, targetCpk: 1.33, failedSides: [] }
      : { lowerCpk: 1.1, upperCpk: 1.35, targetCpk: 1.33, failedSides: ["lowerCpk"] };

    const snapshot = (scenarioId, sourceStep, inputScenarioId, capabilityStatus, factorDelta = 0) => ({
      scenarioId,
      sourceStep,
      inputScenarioId,
      calculationVersion: "excel-ta-v1",
      calculationReference: reference("Feature4-Calculation.json"),
      baselineIdentity,
      system: {
        designNominal: 0,
        mean: factorDelta,
        specificationMidpoint: stableMidpoint(-0.3, 0.3),
        meanOffset: factorDelta - stableMidpoint(-0.3, 0.3),
        additionalMeanShift: factorDelta,
        rssSigma: 0.1,
        worstCaseLower: -0.3,
        worstCaseUpper: 0.3,
      },
      capability: {
        lowerSpecLimit: -0.3,
        upperSpecLimit: 0.3,
        targetCpk: 1.33,
        lowerCpk: capabilityStatus === "PASS" ? 1.35 : 1.1,
        upperCpk: capabilityStatus === "PASS" ? 1.35 : 1.35,
        cpk: capabilityStatus === "PASS" ? 1.35 : 1.1,
        yield: capabilityStatus === "PASS" ? 0.999 : 0.95,
        totalDpm: capabilityStatus === "PASS" ? 100 : 50000,
        status: capabilityStatus,
      },
      factors: [{
        factor: factorIdentity,
        nominalValue: factorDelta,
        lowerTolerance: -0.1 - factorDelta,
        upperTolerance: 0.1 + factorDelta,
        mean: factorDelta,
        sigma: 0.1,
        contribution: 1,
      }],
      factorOverrides: factorDelta === 0
        ? []
        : [{
          factor: factorIdentity,
          nominalValue: factorDelta,
          lowerTolerance: -0.1 - factorDelta,
          upperTolerance: 0.1 + factorDelta,
        }],
      formulaReferences: [],
    });

    const baseline = snapshot("Analysis-A:baseline", "baseline", null, selectedStatus === "baseline_meets_target" ? "PASS" : "FAIL", 0);
    const step1 = snapshot("Analysis-A:step1", "meanResponseCentering", baseline.scenarioId, "PASS", 0.01);
    const step2Pass = snapshot("Analysis-A:step2-pass", "toleranceReverseSolve", baseline.scenarioId, "PASS", 0.02);
    const step2Fail = snapshot("Analysis-A:step2-fail", "toleranceReverseSolve", baseline.scenarioId, "FAIL", 0.02);
    const step3 = {
      ...snapshot("Analysis-A:step3", "specificationRelaxation", step2Fail.scenarioId, "PASS", 0.03),
      systemSpecificationOverride: { lowerSpecLimit: -0.5, upperSpecLimit: 0.5 },
    };

    let steps;
    let selectedResult;
    if (selectedStatus === "baseline_meets_target") {
      steps = [
        { step: "meanResponseCentering", status: "NOT_NEEDED" },
        { step: "toleranceReverseSolve", status: "NOT_NEEDED" },
        { step: "specificationRelaxation", status: "NOT_NEEDED" },
      ];
      selectedResult = { status: "baseline_meets_target", snapshot: baseline };
    } else if (selectedStatus === "step3_specification_relaxed_pending_approval") {
      steps = [
        { step: "meanResponseCentering", status: "NOT_NEEDED" },
        { step: "toleranceReverseSolve", status: "COMPLETED_TARGET_NOT_MET", result: step2Fail },
        {
          step: "specificationRelaxation",
          status: "COMPLETED_TARGET_MET",
          changeClass: "requirement_change",
          approvalRequired: true,
          capabilityImprovementClaim: false,
          result: step3,
        },
      ];
      selectedResult = { status: "step3_specification_relaxed_pending_approval", snapshot: step3 };
    } else if (selectedStatus === "no_validated_optimized_result") {
      steps = [
        { step: "meanResponseCentering", status: "NOT_NEEDED" },
        { step: "toleranceReverseSolve", status: "COMPLETED_TARGET_NOT_MET", result: step2Fail },
        { step: "specificationRelaxation", status: "NOT_FEASIBLE", reasonCode: "no_validated_path" },
      ];
      selectedResult = { status: "no_validated_optimized_result", snapshot: step2Fail };
    } else {
      steps = [
        { step: "meanResponseCentering", status: "NOT_NEEDED" },
        { step: "toleranceReverseSolve", status: "COMPLETED_TARGET_MET", result: step2Pass },
        { step: "specificationRelaxation", status: "NOT_RUN_EARLIER_STEP_MET_TARGET" },
      ];
      selectedResult = { status: "step2_tolerance_optimized", snapshot: step2Pass };
    }

    return f6OptimizationResultV4Schema.parse({
      contractVersion: "v1",
      outputClassification: "confidential",
      featureId: "F6",
      optimizationVersion: "f6-optimization-v4",
      sequentialPolicyId: "f6-sequential-optimization-policy-v2",
      interactionLanguage,
      runStatus: "COMPLETED",
      workbook,
      worksheets: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        baselineIdentity,
        baselineResult: baseline,
        trigger,
        steps,
        selectedResult,
        sensitivityScenarios: ["OP1", "OP2", "OP3"].map((optionCode) => ({
          optionCode,
          status: "calculation_failed",
          reductionRatios: [0.2, 0.1, 0.1],
          reductions: [{
            factor: factorIdentity,
            rank: 1,
            reductionRatio: 0.2,
            scale: 0.8,
            baselineLowerTolerance: -0.1,
            baselineUpperTolerance: 0.1,
          }],
          reasonCode: "f4_failed",
          baselineMetrics: {
            mean: 0,
            rssSigma: 0.1,
            worstCaseLower: -0.3,
            worstCaseUpper: 0.3,
            cp: 1,
            cpk: 1,
            yield: 0.99,
            dpm: 10000,
          },
          calculationReference: reference("Feature4-Calculation.json"),
        })),
        runStatus: "COMPLETED",
      }],
      summary: {
        worksheetCount: 1,
        baselineMeetsTargetWorksheetCount: selectedStatus === "baseline_meets_target" ? 1 : 0,
        optimizedWorksheetCount: ["step1_centered", "step2_tolerance_optimized", "step3_specification_relaxed_pending_approval"].includes(selectedStatus) ? 1 : 0,
        noValidatedResultWorksheetCount: selectedStatus === "no_validated_optimized_result" ? 1 : 0,
        clarificationRequiredWorksheetCount: 0,
      },
      provenance: {
        f2Reference: reference("Feature2-Report.json"),
        f3Reference: reference("Feature3-Report.json"),
        f4Reference: reference("Feature4-Calculation.json"),
        f5Reference: reference("Feature5-Report.json"),
        multimodalReference: reference("Feature5-Multimodal.json"),
        reportScope: { worksheetNames: ["Analysis-A"], blockedWorksheetNames: [] },
      },
    });
  }

  function resultV2() {
    const notProvided = { outcome: "NOT_PROVIDED" };
    const baselineMetrics = { mean: 0, rssSigma: 0.05, worstCaseLower: -0.2, worstCaseUpper: 0.2, cp: 1, cpk: 0.9, yield: 0.99, dpm: 10000 };
    return {
      contractVersion: "v1",
      outputClassification: "confidential",
      featureId: "F6",
      optimizationVersion: "f6-optimization-v2",
      runStatus: "COMPLETED",
      workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
      provenance: {
        f2Reference: { artifact: "Feature2-Report.json", contentHash: HASH },
        f3Reference: { artifact: "Feature3-Report.json", contentHash: HASH },
        f4Reference: { artifact: "Feature4-Calculation.json", contentHash: HASH },
        f5Reference: { artifact: "Feature5-Report.json", contentHash: HASH },
        reportScope: {
          worksheetNames: ["Analysis-A"],
          blockedWorksheetNames: [],
        },
        supplierCapabilityDecision: notProvided,
        datumStrategyDecision: notProvided,
        costDecision: notProvided,
        analysisContextDecision: notProvided,
        optimizationTargetsDecision: notProvided,
        modelInterpretationDecision: notProvided,
      },
      worksheets: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        runStatus: "COMPLETED",
        baselineIdentity: { calculationVersion: "excel-ta-v1", projectReference: "project-a", runReference: "run-a", workbookContentHash: HASH, worksheetName: "Analysis-A", tableId: "table-a" },
        baselineMetrics,
        targetCapability: { targetCpk: 1, targetSigmaLevel: 3, source: "WORKSHEET" },
        options: [{
          optionId: "Analysis-A:candidate",
          status: "candidate",
          reasonCode: "target_not_provided",
          candidateFactors: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 14, factorName: "Factor A", unit: "mm" }],
          requiredInputs: ["optimization_target"],
          calculationMethod: "Provide a governed target and rerun through F4.",
          baselineMetrics,
          impactRank: null,
        }],
        highestImpactAction: null,
        findings: [], risks: [], recommendations: [], clarifications: [],
      }],
      summary: { worksheetCount: 1, completedWorksheetCount: 1, partiallyCompletedWorksheetCount: 0, inputRejectedWorksheetCount: 0, candidateOptionCount: 1, completedOptionCount: 0, insufficientEvidenceOptionCount: 0, calculationFailedOptionCount: 0 },
    };
  }

  function governedResultV2() {
    const input = resultV2();
    const worksheet = input.worksheets[0];
    const baseline = worksheet.baselineMetrics;
    input.provenance.optimizationTargetsDecision = {
      outcome: "CALLER_AUTHORIZED",
      artifactReference: { artifact: "Feature6-Optimization-Targets.json", contentHash: "6".repeat(64) },
    };
    worksheet.options = [
      {
        optionId: "Analysis-A:scenario-a",
        status: "completed",
        targetId: "scenario-a",
        baselineMetrics: structuredClone(baseline),
        resultMetrics: { ...structuredClone(baseline), rssSigma: baseline.rssSigma * 0.9, cpk: baseline.cpk + 0.12, yield: Math.min(1, baseline.yield + 0.001), dpm: Math.max(0, baseline.dpm - 10) },
        scenarioEvidence: {
          targetId: "scenario-a",
          baselineIdentity: structuredClone(worksheet.baselineIdentity),
          factorOverrides: [{ factor: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 14, factorName: "Factor A", unit: "mm" }, upperTolerance: 0.05, lowerTolerance: -0.05 }],
          calculationReference: structuredClone(input.provenance.f4Reference),
          formulaReferences: [{ outputField: "capability.cpk", formulaId: "cpk-v1", formulaVersion: "excel-ta-v1" }],
        },
        feasibility: { status: "supported", reasonCodes: ["caller_provided_target"], evidenceReferences: ["Feature6-Optimization-Targets.json"] },
        evidenceReferences: [structuredClone(input.provenance.f4Reference)],
        impactRank: 1,
        targetContext: { targetId: "scenario-a", targetType: "factor_tolerance", factor: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 14, factorName: "Factor A", unit: "mm" }, upperTolerance: 0.05, lowerTolerance: -0.05, unit: "mm" },
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
          factorOverrides: [{ factor: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 15, factorName: "Factor B", unit: "mm" }, upperTolerance: 0.08, lowerTolerance: -0.08 }],
          calculationReference: structuredClone(input.provenance.f4Reference),
          formulaReferences: [{ outputField: "capability.cpk", formulaId: "cpk-v1", formulaVersion: "excel-ta-v1" }],
        },
        feasibility: { status: "supported", reasonCodes: ["caller_provided_target"], evidenceReferences: ["Feature6-Optimization-Targets.json"] },
        evidenceReferences: [structuredClone(input.provenance.f4Reference)],
        impactRank: 2,
        targetContext: { targetId: "scenario-b", targetType: "improvement_ratio", factor: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 15, factorName: "Factor B", unit: "mm" }, ratio: 0.2, appliesTo: "tolerance_band" },
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
            { factor: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 14, factorName: "Factor A", unit: "mm" }, upperTolerance: 0.07, lowerTolerance: -0.07 },
            { factor: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 15, factorName: "Factor B", unit: "mm" }, upperTolerance: 0.07, lowerTolerance: -0.07 },
          ],
          calculationReference: structuredClone(input.provenance.f4Reference),
          formulaReferences: [{ outputField: "capability.cpk", formulaId: "cpk-v1", formulaVersion: "excel-ta-v1" }],
        },
        feasibility: { status: "supported", reasonCodes: ["caller_provided_target"], evidenceReferences: ["Feature6-Optimization-Targets.json"] },
        evidenceReferences: [structuredClone(input.provenance.f4Reference)],
        impactRank: 3,
        targetContext: {
          targetId: "scenario-c",
          targetType: "system_target",
          systemIdentity: {
            baselineIdentity: structuredClone(worksheet.baselineIdentity),
            designNominal: 0,
            mean: 0,
            rssSigma: 0.1,
            lowerSpecLimit: -0.5,
            upperSpecLimit: 0.5,
            targetCpk: 1.33333333333333,
            traceReferences: [{ outputField: "capability.cpk", formulaId: "cpk-v1", formulaVersion: "excel-ta-v1" }],
          },
          target: { targetCpk: 1.5 },
          apportionment: {
            policy: "EQUAL_SELECTED",
            selectedFactors: [
              { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 14, factorName: "Factor A", unit: "mm" },
              { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 15, factorName: "Factor B", unit: "mm" },
            ],
          },
        },
      },
    ];
    worksheet.highestImpactAction = { optionId: "Analysis-A:scenario-c", impactRank: 3 };
    input.summary = {
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

  it("renders predictive baseline, RSS/WC separation, and candidate-only optimization in Chinese", () => {
    const input = resultV2();
    input.worksheets[0].baselineMetrics.mean = 1.507;
    input.worksheets[0].baselineMetrics.rssSigma = 0.134;
    input.worksheets[0].baselineMetrics.worstCaseLower = -1.21;
    input.worksheets[0].baselineMetrics.worstCaseUpper = 1.21;
    input.worksheets[0].targetCapability.targetSigmaLevel = 4;

    const markdown = renderF6ReportV2(input);

    expect(markdown).toContain("# Feature 6 公差优化报告 V2");
    expect(markdown).toContain("预测性能力指标");
    expect(markdown).toContain("RSS 1σ");
    expect(markdown).toContain("RSS 4σ 范围：0.971 mm ～ 2.043 mm");
    expect(markdown).toContain("Worst Case 绝对范围：0.297 mm ～ 2.717 mm");
    expect(markdown).toContain("【数据缺口 Missing】");
    expect(markdown).toContain("未提供受控优化目标");
    expect(markdown).toContain("不等同于实测量产能力");
    expect(markdown).not.toMatch(/20%|30%|Predicted Improvement/);
    expect(markdown).not.toContain("0.899999999999");
  });

  it("renders governed optimization targets and three scenario rows", () => {
    const markdown = renderF6ReportV2(governedResultV2());

    expect(markdown).toContain("Optimization Targets 与重算结果");
    expect(markdown).toContain("| Scenario | Target | Baseline vs Adjusted | RSS/Cpk/Margin/Yield | Delta |");
    expect(markdown).toContain("scenario-a");
    expect(markdown).toContain("scenario-b");
    expect(markdown).toContain("scenario-c");
    expect(markdown).toContain(String.raw`EQUAL\_SELECTED`);
    expect(markdown).toContain(String.raw`CALLER\_AUTHORIZED`);
  });

  it("renders the model interpretation decision without narrative content", () => {
    const input = resultV2();
    input.provenance.modelInterpretationDecision = {
      outcome: "CALLER_AUTHORIZED",
      artifactReference: { artifact: "Feature6-Model-Interpretation.json", contentHash: "7".repeat(64) },
    };

    const markdown = renderF6ReportV2(input);

    expect(markdown).toContain(String.raw`Model Interpretation decision：CALLER\_AUTHORIZED`);
    expect(markdown).not.toContain("Feature6-Model-Interpretation.json");
  });

  it("renders recommendation basis with requirement-change guardrails from governed scenario evidence", () => {
    const input = governedResultV2();
    const worksheet = input.worksheets[0];
    const baseline = worksheet.baselineMetrics;
    worksheet.options.push({
      optionId: "Analysis-A:scenario-spec",
      status: "completed",
      targetId: "scenario-spec",
      baselineMetrics: structuredClone(baseline),
      resultMetrics: {
        ...structuredClone(baseline),
        rssSigma: baseline.rssSigma * 0.95,
        cpk: baseline.cpk + 0.08,
        yield: Math.min(1, baseline.yield + 0.001),
        dpm: Math.max(0, baseline.dpm - 5),
      },
      scenarioEvidence: {
        targetId: "scenario-spec",
        baselineIdentity: structuredClone(worksheet.baselineIdentity),
        factorOverrides: [],
        systemSpecification: { lowerSpecLimit: -0.45, upperSpecLimit: 0.55 },
        calculationReference: structuredClone(input.provenance.f4Reference),
        formulaReferences: [{ outputField: "capability.cpk", formulaId: "cpk-v1", formulaVersion: "excel-ta-v1" }],
      },
      feasibility: { status: "supported", reasonCodes: ["caller_provided_target"], evidenceReferences: ["Feature6-Optimization-Targets.json"] },
      evidenceReferences: [structuredClone(input.provenance.f4Reference)],
      impactRank: 4,
      optionSource: "CALLER_TARGET",
      targetContext: {
        targetId: "scenario-spec",
        targetType: "system_specification",
        systemIdentity: {
          baselineIdentity: structuredClone(worksheet.baselineIdentity),
          designNominal: 0,
          mean: 0,
          rssSigma: baseline.rssSigma,
          lowerSpecLimit: -0.5,
          upperSpecLimit: 0.5,
          targetCpk: 1.33333333333333,
          traceReferences: [{ outputField: "capability.cpk", formulaId: "cpk-v1", formulaVersion: "excel-ta-v1" }],
        },
        lowerSpecLimit: -0.45,
        upperSpecLimit: 0.55,
        unit: "mm",
      },
    });
    worksheet.clarifications.push({
      clarificationId: "Analysis-A:assessment:system-specification-authority",
      reasonCode: "system_specification_target_required",
      requiredInputs: ["system_specification_target"],
      questionForReviewer: "Provide caller-authorized system specification limits before running this scenario.",
      evidenceReferences: [structuredClone(input.provenance.f4Reference)],
    });
    input.summary = {
      worksheetCount: 1,
      completedWorksheetCount: 1,
      partiallyCompletedWorksheetCount: 0,
      inputRejectedWorksheetCount: 0,
      candidateOptionCount: 0,
      completedOptionCount: 4,
      insufficientEvidenceOptionCount: 0,
      calculationFailedOptionCount: 0,
    };

    const markdown = renderF6ReportV2(input);

    expect(markdown).toContain("### 3. 建议依据");
    expect(markdown).toContain(String.raw`system\_specification`);
    expect(markdown).toContain("Requirement Change");
    expect(markdown).toContain("ME review required");
    expect(markdown).toContain("Cpk 1.020");
    expect(markdown).toContain(String.raw`system\_specification\_target\_required`);
  });

  it("classifies generic optimization target clarification only under system specification", () => {
    const input = governedResultV2();
    const worksheet = input.worksheets[0];
    worksheet.clarifications.push(
      {
        clarificationId: "Analysis-A:generic-target",
        reasonCode: "optimization_target_required",
        requiredInputs: ["optimization_target"],
        questionForReviewer: "Provide a governed optimization target.",
        evidenceReferences: [structuredClone(input.provenance.f4Reference)],
      },
      {
        clarificationId: "Analysis-A:tolerance-target",
        reasonCode: "factor_tolerance_target_required",
        requiredInputs: ["factor_tolerance_target"],
        questionForReviewer: "Provide tolerance target for factor scenario.",
        evidenceReferences: [structuredClone(input.provenance.f4Reference)],
      },
    );

    const markdown = renderF6ReportV2(input);
    const rows = markdown.split("\n");
    const systemRow = rows.find((line) => line.includes("| system\\_specification |"));
    const toleranceRow = rows.find((line) => line.includes("| factor\\_tolerance |"));

    expect(systemRow).toBeDefined();
    expect(toleranceRow).toBeDefined();
    expect(systemRow).toContain(String.raw`system\_specification\_target\_required`);
    expect(toleranceRow).toContain(String.raw`factor\_tolerance\_target\_required`);
    expect(toleranceRow).not.toContain(String.raw`optimization\_target\_required`);
    expect(toleranceRow).not.toContain(String.raw`system\_specification\_target\_required`);
  });

  it("renders the V3 tolerance optimization policy step", () => {
    const baselineIdentity = { calculationVersion: "excel-ta-v1", projectReference: "project-a", runReference: "run-a", workbookContentHash: HASH, worksheetName: "Analysis-A", tableId: "table-a" };
    const markdown = renderF6ReportV2({
      contractVersion: "v1",
      outputClassification: "confidential",
      featureId: "F6",
      optimizationVersion: "f6-optimization-v3",
      sequentialPolicyId: "f6-sequential-optimization-policy-v1",
      interactionLanguage: { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "turn-1", source: "workflow_start", fallbackUsed: false },
      runStatus: "COMPLETED",
      workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
      worksheets: [{
        worksheetName: "Analysis-A",
        tableId: "table-a",
        runStatus: "COMPLETED",
        baselineIdentity,
        baselineCapability: { lowerCpk: 1, upperCpk: 1, targetCpk: 1 },
        steps: [
          { step: "centerAssessment", status: "aligned", adjustedMean: 0, specificationMidpoint: 0, offset: 0 },
          { step: "contributorPriorities", priorities: [] },
          { step: "specificationChanges", proposals: [], clarifications: [] },
          { step: "toleranceOptimization", policyId: "f6-top3-tolerance-policy-v1", trigger: { lowerCpk: 1, upperCpk: 1, targetCpk: 1, failedSides: [] }, options: [] },
        ],
      }],
      summary: { worksheetCount: 1, completedWorksheetCount: 1, clarificationRequiredWorksheetCount: 0, candidateOptionCount: 0, completedOptionCount: 0, calculationFailedOptionCount: 0 },
      provenance: {
        f2Reference: { artifact: "Feature2-Report.json", contentHash: HASH },
        f3Reference: { artifact: "Feature3-Report.json", contentHash: HASH },
        f4Reference: { artifact: "Feature4-Calculation.json", contentHash: HASH },
        f5Reference: { artifact: "Feature5-Report.json", contentHash: HASH },
        multimodalReference: { artifact: "Feature6-Model-Interpretation.json", contentHash: HASH },
        reportScope: { worksheetNames: ["Analysis-A"], blockedWorksheetNames: [] },
      },
    });

    expect(markdown).toContain("### 4. Tolerance Optimization");
    expect(markdown).toContain("f6-top3-tolerance-policy-v1");
  });

  it("renders V4 optimization comparison with stable markers and ordered path", () => {
    const markdown = renderF6ReportV2(resultV4("step3_specification_relaxed_pending_approval"));

    expect(markdown).toContain("<!-- f6-optimization-comparison -->");
    expect(markdown).toContain("## Optimization Comparison");
    expect(markdown).toContain("| Metric | Raw Data | Optimized Data |");
    expect(markdown).toContain("| Mean-to-Spec-Center Offset |");
    expect(markdown).toContain("| Predictive CpkL |");
    expect(markdown).toContain("| Predictive CpkU |");
    expect(markdown).toContain("| Worst-Case Lower |");
    expect(markdown).toContain("| Worst-Case Upper |");
    expect(markdown).toContain("| Capability Status |");
    expect(markdown).toContain("| Step | Status | Action | Result |");
    expect(markdown).toContain("| Factor | Table / Row | Nominal Before | Nominal After |");
    expect(markdown).toContain("Requirement change - engineering approval required");

    const step1 = markdown.indexOf("| meanResponseCentering |");
    const step2 = markdown.indexOf("| toleranceReverseSolve |");
    const step3 = markdown.indexOf("| specificationRelaxation |");
    expect(step1).toBeGreaterThan(-1);
    expect(step2).toBeGreaterThan(step1);
    expect(step3).toBeGreaterThan(step2);
  });

  it("renders no-result V4 comparison with N/A in every optimized numeric and status cell", () => {
    const markdown = renderF6ReportV2(resultV4("no_validated_optimized_result"));

    expect(markdown).toContain("No validated optimized result");
    expect(markdown).toContain("| Predictive Cpk | 1.100000 | N/A |");
    expect(markdown).toContain("| Predicted Yield | 95.00% | N/A |");
    expect(markdown).toContain("| Predicted DPM | 50000 | N/A |");
    expect(markdown).toContain("| Predictive CpkL | 1.1 | N/A |");
    expect(markdown).toContain("| Predictive CpkU | 1.35 | N/A |");
    expect(markdown).toContain("| Worst-Case Lower | -0.3 mm | N/A |");
    expect(markdown).toContain("| Worst-Case Upper | 0.3 mm | N/A |");
    expect(markdown).toContain("| Capability Status | FAIL | N/A |");
  });

  it("uses governed V4 snapshot units instead of hardcoded mm", () => {
    const markdown = renderF6ReportV2(resultV4("step2_tolerance_optimized", { unit: "um" }));

    expect(markdown).toContain("| Design Nominal | 0 um |");
    expect(markdown).toContain("| Mean Response | 0 um |");
    expect(markdown).not.toContain("| Design Nominal | 0 mm |");
  });

  it("uses nearly-equal comparison for changed factors", () => {
    const input = clone(resultV4("step2_tolerance_optimized"));
    input.worksheets[0].selectedResult.snapshot.factors[0].nominalValue += Number.EPSILON;
    input.worksheets[0].selectedResult.snapshot.factors[0].upperTolerance += Number.EPSILON;
    input.worksheets[0].selectedResult.snapshot.factors[0].lowerTolerance -= Number.EPSILON;

    const markdown = renderF6ReportV2(input);

    expect(markdown).toContain("| None | N/A | N/A | N/A |");
  });
});
