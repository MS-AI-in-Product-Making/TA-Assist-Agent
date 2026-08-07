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
          formulaIds: ["factor-mean-v1", "factor-half-tolerance-v1", "factor-sigma-v1", "contribution-v1"],
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
  it("renders required report headings and worksheet sections", () => {
    const markdown = renderF4Report(workflowCalculationResult());

    expect(markdown).toContain("# Feature 4 TA 计算报告");
    expect(markdown).toContain("## 执行摘要");
    expect(markdown).toContain("## Analysis-A");
    expect(markdown).toContain("### 系统计算");
    expect(markdown).toContain("### 能力指标");
    expect(markdown).toContain("### Factor 结果");
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

    expect(passMd).toContain("### Excel 回归");
    expect(passMd).toContain("状态：passed");
    expect(passMd).toContain("capability.cpk");

    expect(mismatchMd).toContain("状态：mismatch");
    expect(mismatchMd).toContain("false");

    expect(unavailableMd).toContain("状态：excel_unavailable");
    expect(unavailableMd).toContain("excel_runtime_unavailable");
  });

  it("redacts full authorization/token values and absolute path variants", () => {
    const input = workflowCalculationResult();
    input.calculations[0].worksheetSelection.worksheetName = "Analysis-A C:\\Users\\ralfye\\.ssh\\id_rsa C:/Users/ralfye/private-folder /home/ralfye/private/secret.xlsx //server/share/private-folder access_token: abc def?!";
    input.calculations[0].worksheetSelection.tableId = "Authorization: Bearer abc:def";
    input.calculations[0].factors[0].factorName = "Bearer abc:def";

    const markdown = renderF4Report(input);

    expect(markdown).toContain("[redacted-local-path]");
    expect(markdown).toContain("Authorization: [redacted]");
    expect(markdown).toContain("Bearer [redacted]");
    expect(markdown).toContain("access_token: [redacted]");
    expect(markdown).not.toContain("abc:def");
    expect(markdown).not.toContain("abc def?!");
    expect(markdown).not.toContain("C:\\Users\\ralfye\\.ssh\\id_rsa");
    expect(markdown).not.toContain("C:/Users/ralfye/private-folder");
    expect(markdown).not.toContain("/home/ralfye/private/secret.xlsx");
    expect(markdown).not.toContain("//server/share/private-folder");
  });

  it("redacts explicit path=/file URI patterns including quoted and bracketed values", () => {
    const input = workflowCalculationResult();
    input.calculations[0].worksheetSelection.worksheetName = "safe-left";
    input.calculations[0].worksheetSelection.tableId = "safe-right";
    input.calculations[0].factors[0].factorName = [
      "path=C:/Users/ralfye/private/secret.xlsx",
      "path=C:\\Users\\ralfye\\private\\token.txt",
      "path='C:/Users/ralfye/private/quoted.txt'",
      'path="C:/Users/ralfye/private/double-quoted.txt"',
      "path=[C:/Users/ralfye/private/bracketed.txt]",
      "file:///C:/Users/ralfye/private/uri.xlsx",
      "file:///home/ralfye/private/uri.xlsx",
    ].join(" ; ");

    const markdown = renderF4Report(input);

    expect(markdown).toContain("path=[redacted-local-path]");
    expect(markdown).toContain("file:///[redacted-local-path]");
    expect(markdown).not.toContain("secret.xlsx");
    expect(markdown).not.toContain("token.txt");
    expect(markdown).not.toContain("quoted.txt");
    expect(markdown).not.toContain("double-quoted.txt");
    expect(markdown).not.toContain("bracketed.txt");
    expect(markdown).not.toContain("uri.xlsx");

    // Ensure neighboring ordinary cells survive redaction.
    expect(markdown).toContain("| worksheetName | safe-left |");
    expect(markdown).toContain("| tableId | safe-right |");
  });

  it("redacts controlled credential keys with = or : and values containing spaces/punctuation", () => {
    const input = workflowCalculationResult();
    input.calculations[0].worksheetSelection.worksheetName = "safe-left";
    input.calculations[0].worksheetSelection.tableId = "safe-right";
    input.calculations[0].factors[0].factorName = [
      "access_token = abc-123:45 !",
      "refresh_token: rrr.111 +++",
      "CLIENT_SECRET = top secret value?!",
    ].join(" ; ");

    const markdown = renderF4Report(input);

    expect(markdown).toContain("access_token = [redacted]");
    expect(markdown).toContain("refresh_token: [redacted]");
    expect(markdown).toContain("CLIENT_SECRET = [redacted]");
    expect(markdown).not.toContain("abc-123:45 !");
    expect(markdown).not.toContain("rrr.111 +++");
    expect(markdown).not.toContain("top secret value?!");

    // Ensure neighboring ordinary cells survive redaction.
    expect(markdown).toContain("| worksheetName | safe-left |");
    expect(markdown).toContain("| tableId | safe-right |");
  });

  it("redacts sensitive values per-cell without swallowing adjacent table columns", () => {
    const input = workflowCalculationResult();
    input.calculations[0].worksheetSelection.worksheetName = "safe-left";
    input.calculations[0].worksheetSelection.tableId = "safe-right";
    input.calculations[0].factors[0].factorName = "Authorization: Bearer abc:def";

    const markdown = renderF4Report(input);

    expect(markdown).toContain("| worksheetName | safe-left |");
    expect(markdown).toContain("| tableId | safe-right |");
    expect(markdown).toContain("Authorization: [redacted]");
    expect(markdown).not.toContain("abc:def");
  });

  it("neutralizes html and markdown-active content in worksheet headings and table cells", () => {
    const input = workflowCalculationResult();
    input.calculations[0].worksheetSelection.worksheetName = "<# [x](http://evil.example) ![img](http://evil.example/i.png) `code`";
    input.calculations[0].factors[0].factorName = "<script>alert(1)</script> # heading [click](http://evil.example) ![img](http://evil.example/i.png) `x`";

    const markdown = renderF4Report(input);

    expect(markdown).toContain("&lt;");
    expect(markdown).toContain("&gt;");
    expect(markdown).not.toContain("<script>");
    expect(markdown).not.toContain("![img](http://evil.example/i.png)");
    expect(markdown).not.toContain("[click](http://evil.example)");
    expect(markdown).not.toContain("http://evil.example");
    expect(markdown).not.toContain("`code`");
  });

  it("rejects comparison when runId mismatches", () => {
    const comparison = comparisonResult("passed");
    comparison.runId = "run-mismatch";
    expect(() => renderF4Report(workflowCalculationResult(), { comparisonResult: comparison })).toThrow(/runId/i);
  });

  it("rejects comparison when workbook hash mismatches for passed and mismatch", () => {
    const passed = comparisonResult("passed");
    passed.source.workbookContentHash = "b".repeat(64);
    expect(() => renderF4Report(workflowCalculationResult(), { comparisonResult: passed })).toThrow(/workbook.*hash/i);

    const mismatch = comparisonResult("mismatch");
    mismatch.source.workbookContentHash = "b".repeat(64);
    expect(() => renderF4Report(workflowCalculationResult(), { comparisonResult: mismatch })).toThrow(/workbook.*hash/i);
  });

  it("rejects passed/mismatch comparison when worksheet set mismatches", () => {
    const comparison = comparisonResult("passed");
    comparison.worksheets[0].worksheetName = "Analysis-B";
    expect(() => renderF4Report(workflowCalculationResult(), { comparisonResult: comparison })).toThrow(/worksheet/i);
  });

  it("rejects comparison when metric f4Value does not match calculation field", () => {
    const comparison = comparisonResult("passed");
    comparison.worksheets[0].metrics[0].f4Value = 2.5;
    comparison.worksheets[0].metrics[0].excelValue = 2.5;
    comparison.worksheets[0].metrics[0].excelDisplayText = "2.500";
    comparison.worksheets[0].metrics[0].absoluteDifference = 0;
    comparison.worksheets[0].metrics[0].relativeDifference = 0;
    comparison.worksheets[0].metrics[0].passed = true;

    expect(() => renderF4Report(workflowCalculationResult(), { comparisonResult: comparison })).toThrow(/f4Value/i);
  });

  it("supports factor metric path mapping and rejects unknown metric paths", () => {
    const calculation = workflowCalculationResult();

    const metricBindings = [
      ["factors[0].mean", "factor-mean-v1", calculation.calculations[0].factors[0].mean],
      ["factors[0].halfTolerance", "factor-half-tolerance-v1", calculation.calculations[0].factors[0].halfTolerance],
      ["factors[0].sigma", "factor-sigma-v1", calculation.calculations[0].factors[0].sigma],
      ["factors[0].contribution", "contribution-v1", calculation.calculations[0].factors[0].contribution],
    ];
    for (const [metricPath, formulaId, value] of metricBindings) {
      const factorPathComparison = comparisonResult("passed");
      factorPathComparison.worksheets[0].metrics[0] = {
        ...factorPathComparison.worksheets[0].metrics[0],
        metric: metricPath,
        f4Value: value,
        excelValue: value,
        excelDisplayText: `${value}`,
        absoluteDifference: 0,
        relativeDifference: 0,
        passed: true,
        f4FormulaId: formulaId,
      };
      expect(() => renderF4Report(calculation, { comparisonResult: factorPathComparison })).not.toThrow();
    }

    const unknownPathComparison = comparisonResult("passed");
    unknownPathComparison.worksheets[0].metrics[0] = {
      ...unknownPathComparison.worksheets[0].metrics[0],
      metric: "factors[0].unknown",
      f4FormulaId: "factor-mean-v1",
    };
    expect(() => renderF4Report(calculation, { comparisonResult: unknownPathComparison })).toThrow(/metric|path|unknown/i);
  });

  it("rejects swapped factor formula IDs even when all formulas exist in trace", () => {
    const calculation = workflowCalculationResult();
    const swapped = [
      ["factors[0].mean", "factor-sigma-v1", calculation.calculations[0].factors[0].mean],
      ["factors[0].halfTolerance", "contribution-v1", calculation.calculations[0].factors[0].halfTolerance],
      ["factors[0].sigma", "factor-half-tolerance-v1", calculation.calculations[0].factors[0].sigma],
      ["factors[0].contribution", "factor-mean-v1", calculation.calculations[0].factors[0].contribution],
    ];

    for (const [metricPath, wrongFormulaId, value] of swapped) {
      const factorPathComparison = comparisonResult("passed");
      factorPathComparison.worksheets[0].metrics[0] = {
        ...factorPathComparison.worksheets[0].metrics[0],
        metric: metricPath,
        f4Value: value,
        excelValue: value,
        excelDisplayText: `${value}`,
        absoluteDifference: 0,
        relativeDifference: 0,
        passed: true,
        f4FormulaId: wrongFormulaId,
      };
      expect(() => renderF4Report(calculation, { comparisonResult: factorPathComparison })).toThrow(/formula/i);
    }
  });

  it("encodes pipe characters as HTML entities and neutralizes backslashes", () => {
    const input = workflowCalculationResult();
    input.calculations[0].worksheetSelection.worksheetName = "safe\\|INJECTED";

    const markdown = renderF4Report(input);

    expect(markdown).toContain("safe&#92;&#124;INJECTED");
    expect(markdown).not.toContain("safe\\|INJECTED");
    expect(markdown).not.toContain("|INJECTED |");
  });

  it("rejects comparison when formula evidence does not match metric", () => {
    const comparison = comparisonResult("passed");
    comparison.worksheets[0].metrics[0].f4FormulaId = "cpk-v2";

    expect(() => renderF4Report(workflowCalculationResult(), { comparisonResult: comparison })).toThrow(/formula/i);
  });

  it("allows error comparison variants without worksheets but still enforces runId", () => {
    const excelUnavailable = comparisonResult("excel_unavailable");
    expect(() => renderF4Report(workflowCalculationResult(), { comparisonResult: excelUnavailable })).not.toThrow();

    const mappingError = {
      ...excelUnavailable,
      status: "mapping_error",
      reasonCode: "metric_mapping_missing",
    };
    expect(() => renderF4Report(workflowCalculationResult(), { comparisonResult: mappingError })).not.toThrow();

    const badRun = { ...excelUnavailable, runId: "other-run" };
    expect(() => renderF4Report(workflowCalculationResult(), { comparisonResult: badRun })).toThrow(/runId/i);
  });

  it("rejects invalid workflow contract and invalid comparison contract", () => {
    expect(() => renderF4Report({ status: "completed" })).toThrow();
    expect(() => renderF4Report(workflowCalculationResult(), { comparisonResult: { status: "passed" } })).toThrow();
  });
});
