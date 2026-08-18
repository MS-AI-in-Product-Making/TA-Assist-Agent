import { describe, expect, it } from "vitest";
import { f6LegacyOptimizationResultSchema as f6OptimizationResultSchema } from "../packages/contracts/dist/contracts.js";
import { renderF6Report as renderF6ReportV2, renderLegacyF6Report as renderF6Report } from "./f6-report.mjs";

const HASH = "a".repeat(64);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
      f0Versions: { knowledgeBaseVersion: "v1", capabilityVersion: "internal-v1", interpretationVersion: "interpretation-rules-v1" },
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
        supplierCapabilityDecision: notProvided,
        datumStrategyDecision: notProvided,
        costDecision: notProvided,
        analysisContextDecision: notProvided,
        optimizationTargetsDecision: notProvided,
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
    expect(markdown).not.toMatch(/20%|30%|Predicted Improvement/);
    expect(markdown).not.toContain("0.899999999999");
  });
});
