import { describe, expect, it } from "vitest";
import { renderF4Report } from "./f4-report.mjs";

function workflowCalculationResult() {
  return {
    contractVersion: "v1",
    workflowVersion: "f4-f2-v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    runId: "run-2026-08-07",
    generatedAt: "2026-08-07T12:34:56.789Z",
    source: {
      artifactReference: "Feature2-Report.json",
      workbookFileName: "Demo.xlsx",
      workbookContentHash: "a".repeat(64),
    },
    calculations: [{
      contractVersion: "v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "completed",
      calculationVersion: "excel-ta-v1",
      projectReference: "project-ref",
      runReference: "run-ref",
      workbookContentHash: "a".repeat(64),
      worksheetSelection: {
        worksheetName: "Analysis-A",
        tableId: "table-a",
      },
      factorCount: 1,
      recommendation: {
        method: "worst_case",
        reason: "factor_count_1_to_3",
        refer3d: false,
        criticality: "none",
        criticalityRisk: false,
      },
      factors: [{
        factorName: "Factor A",
        unit: "mm",
        source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2 },
        input: {
          nominalValue: 12.45,
          upperTolerance: 0.2,
          lowerTolerance: -0.2,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "normal",
        },
        mean: 12.46,
        halfTolerance: 0.2,
        sigma: 0.05,
        contribution: 1,
        trace: {
          formulaIds: ["factor-mean-v1", "factor-sigma-v1"],
          sourceCells: ["Analysis-A!A2", "Analysis-A!B2"],
        },
      }],
      system: {
        designNominal: 12.5,
        mean: 12.46,
        additionalMeanShift: 0,
        worstCaseUpper: 0.2,
        worstCaseLower: -0.2,
        rssSigma: 0.05,
      },
      capability: {
        lowerSpecLimit: 12.1,
        upperSpecLimit: 12.9,
        targetSigmaLevel: 4,
        targetCpk: 1.33,
        cp: 2.6666666666666665,
        lowerCpk: 2.4,
        upperCpk: 2.933333333333333,
        cpk: 2.4,
        lowerZ: 7.2,
        upperZ: 8.8,
        lowerDpm: 0.1,
        upperDpm: 0.2,
        totalDpm: 0.30000000000000004,
        outOfSpecRatio: 3.0000000000000004e-7,
        yield: 0.9999997,
        status: "PASS",
      },
      traceRecords: [{
        outputField: "capability.cpk",
        formulaVersion: "excel-ta-v1",
        formulaId: "cpk-v1",
        sourceCells: ["capability.lowerCpk", "capability.upperCpk"],
      }],
      scenarios: [],
    }],
    summary: {
      selectedWorksheetCount: 1,
      completedWorksheetCount: 1,
    },
  };
}

function comparisonResult(status = "passed") {
  if (status === "excel_unavailable") {
    return {
      contractVersion: "v1",
      comparisonVersion: "f4-excel-comparison-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "excel_unavailable",
      runId: "run-2026-08-07",
      generatedAt: "2026-08-07T12:34:56.789Z",
      reasonCode: "excel_runtime_unavailable",
    };
  }

  return {
    contractVersion: "v1",
    comparisonVersion: "f4-excel-comparison-v1",
    outputClassification: "confidential",
    featureId: "F4",
    status,
    runId: "run-2026-08-07",
    generatedAt: "2026-08-07T12:34:56.789Z",
    source: { workbookContentHash: "a".repeat(64) },
    worksheets: [{
      worksheetName: "Analysis-A",
      metrics: [{
        metric: "capability.cpk",
        f4Value: 2.4,
        excelValue: status === "passed" ? 2.4 : 2.3,
        excelDisplayText: status === "passed" ? "2.400" : "2.300",
        absoluteDifference: status === "passed" ? 0 : 0.1,
        relativeDifference: status === "passed" ? 0 : (0.1 / 2.4),
        tolerance: 1e-12,
        passed: status === "passed",
        sourceCell: "Analysis-A!P56",
        excelFormula: "=MIN(X1,Y1)",
        f4FormulaId: "cpk-v1",
      }],
    }],
    summary: {
      worksheetCount: 1,
      metricCount: 1,
      passedMetricCount: status === "passed" ? 1 : 0,
      mismatchMetricCount: status === "passed" ? 0 : 1,
    },
  };
}

describe("renderF4Report", () => {
  it("renders Chinese-readable workflow sections with worksheet/system/capability/factor fields", () => {
    const markdown = renderF4Report(workflowCalculationResult());

    expect(markdown).toContain("# Feature 4 工作流计算报告");
    expect(markdown).toContain("## 执行摘要");
    expect(markdown).toContain("### 工作表 Analysis-A");
    expect(markdown).toContain("#### 系统结果");
    expect(markdown).toContain("#### 能力结果");
    expect(markdown).toContain("#### 因子结果");
    expect(markdown).toContain("worksheetName");
    expect(markdown).toContain("tableId");
    expect(markdown).toContain("factorName");
    expect(markdown).toContain("method");
    for (const systemField of ["designNominal", "mean", "additionalMeanShift", "worstCaseUpper", "worstCaseLower", "rssSigma"]) {
      expect(markdown).toContain(systemField);
    }
    for (const capabilityField of ["lowerSpecLimit", "upperSpecLimit", "targetSigmaLevel", "targetCpk", "cp", "lowerCpk", "upperCpk", "cpk", "lowerZ", "upperZ", "lowerDpm", "upperDpm", "totalDpm", "outOfSpecRatio", "yield", "status"]) {
      expect(markdown).toContain(capabilityField);
    }
    for (const factorField of ["mean", "halfTolerance", "sigma", "contribution"]) {
      expect(markdown).toContain(factorField);
    }
  });

  it("renders optional Excel comparison for pass, mismatch, and unavailable", () => {
    const passMd = renderF4Report(workflowCalculationResult(), { comparisonResult: comparisonResult("passed") });
    const mismatchMd = renderF4Report(workflowCalculationResult(), { comparisonResult: comparisonResult("mismatch") });
    const unavailableMd = renderF4Report(workflowCalculationResult(), { comparisonResult: comparisonResult("excel_unavailable") });

    expect(passMd).toContain("## Excel 回归");
    expect(passMd).toContain("状态：passed");
    expect(passMd).toContain("capability.cpk");

    expect(mismatchMd).toContain("状态：mismatch");
    expect(mismatchMd).toContain("false");

    expect(unavailableMd).toContain("状态：excel_unavailable");
    expect(unavailableMd).toContain("excel_runtime_unavailable");
  });

  it("escapes Markdown-sensitive text and redacts sensitive content", () => {
    const input = workflowCalculationResult();
    input.calculations[0].factors[0].factorName = "A|B\nC C:\\Users\\ralfye\\secret.xlsx Authorization: Bearer abc123 token=xyz";

    const markdown = renderF4Report(input);

    expect(markdown).toContain("A\\|B<br>C");
    expect(markdown).toContain("[redacted-local-path]");
    expect(markdown).toContain("Authorization: [redacted]");
    expect(markdown).toContain("token=[redacted]");
    expect(markdown).not.toContain("C:\\Users\\ralfye\\secret.xlsx");
    expect(markdown).not.toContain("Bearer abc123");
  });

  it("rejects invalid workflow contract and invalid comparison contract", () => {
    expect(() => renderF4Report({ status: "completed" })).toThrow();
    expect(() => renderF4Report(workflowCalculationResult(), { comparisonResult: { status: "passed" } })).toThrow();
  });
});
