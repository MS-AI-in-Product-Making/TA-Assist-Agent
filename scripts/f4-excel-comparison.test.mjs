import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { compareF4WithExcel } from "./f4-excel-comparison.mjs";
import { f4ExcelComparisonResultSchema } from "../packages/contracts/dist/contracts.js";

const cleanup = [];

afterEach(() => {
  delete process.env.F4_EXCEL_REGRESSION_TEST_OUTPUTS_JSON;
  for (const target of cleanup.splice(0)) {
    rmSync(target, { recursive: true, force: true });
  }
});

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function setupWorkbook(content = "excel workbook fixture") {
  const root = mkdtempSync(path.join(tmpdir(), "f4-excel-comparison-"));
  cleanup.push(root);
  const workbookPath = path.join(root, "Demo.xlsx");
  writeFileSync(workbookPath, content);
  return { workbookPath, workbookHash: sha256(content) };
}

function completedCalculation(worksheetName, workbookHash) {
  return {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    calculationVersion: "excel-ta-v1",
    projectReference: "project-ref",
    runReference: `run-${worksheetName}`,
    workbookContentHash: workbookHash,
    worksheetSelection: {
      worksheetName,
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
      source: { worksheetName, tableId: "table-a", sourceRow: 14 },
      input: {
        nominalValue: 0,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "normal",
      },
      mean: 0,
      halfTolerance: 0.1,
      sigma: 0.025,
      contribution: 1,
      trace: { formulaIds: ["factor-mean-v1"], sourceCells: [`${worksheetName}!I14`] },
    }],
    system: {
      designNominal: 0,
      mean: 0,
      additionalMeanShift: 0,
      worstCaseUpper: 0,
      worstCaseLower: 0,
      rssSigma: 0.045,
    },
    capability: {
      lowerSpecLimit: -1,
      upperSpecLimit: 1,
      targetSigmaLevel: 4,
      targetCpk: 1.33,
      cp: 2,
      lowerCpk: 2,
      upperCpk: 2,
      cpk: 2,
      lowerZ: 6,
      upperZ: 6,
      lowerDpm: 0,
      upperDpm: 0,
      totalDpm: 0,
      outOfSpecRatio: 0,
      yield: 1,
      status: "PASS",
    },
    traceRecords: [
      {
        outputField: "system.rssSigma",
        formulaVersion: "excel-ta-v1",
        formulaId: "rss-v1",
        sourceCells: ["T44"],
      },
      {
        outputField: "capability.status",
        formulaVersion: "excel-ta-v1",
        formulaId: "status-v1",
        sourceCells: ["T57"],
      },
    ],
    scenarios: [],
  };
}

function calculationResult(workbookHash, worksheetNames = ["Analysis-A"]) {
  return {
    contractVersion: "v1",
    workflowVersion: "f4-f2-v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    runId: "run-2026-08-07T00-00-00-000Z",
    generatedAt: "2026-08-07T00:00:00.000Z",
    source: {
      artifactReference: "Feature2-Report.json",
      workbookFileName: "Demo.xlsx",
      workbookContentHash: workbookHash,
    },
    calculations: worksheetNames.map((name) => completedCalculation(name, workbookHash)),
    summary: {
      selectedWorksheetCount: worksheetNames.length,
      completedWorksheetCount: worksheetNames.length,
    },
  };
}

function mappingFor(worksheetName, expected = 0.045) {
  return {
    worksheetName,
    mapping: {
      version: "excel-ta-v1",
      inputs: [],
      outputs: [{
        name: "system.rssSigma",
        cell: "T44",
        expected,
        tolerance: 1e-12,
        formulaId: "rss-v1",
      }],
    },
  };
}

function harnessPayload(status, pass, workbookHash, overrides = {}) {
  return {
    status,
    sourceSha256: workbookHash.toUpperCase(),
    outputs: [{
      name: "system.rssSigma",
      cell: "T44",
      expected: 0.045,
      actual: pass ? 0.045 : 0.06,
      displayText: pass ? "0.045" : "0.06",
      absoluteDifference: pass ? 0 : 0.015,
      relativeDifference: pass ? 0 : 0.015,
      tolerance: 1e-12,
      formula: "SQRT(SUMSQ(T14:T43))",
      formulaId: "rss-v1",
      pass,
      ...overrides,
    }],
  };
}

describe("compareF4WithExcel", () => {
  it("returns schema-valid passed result", () => {
    const workbook = setupWorkbook();
    process.env.F4_EXCEL_REGRESSION_TEST_OUTPUTS_JSON = "untrusted-parent-hook";
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `noise\n${JSON.stringify(harnessPayload("regression_passed", true, workbook.workbookHash))}\n`,
      stderr: "",
      error: undefined,
    }));

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync, now: () => new Date("2026-08-07T12:34:56.789Z") });

    expect(() => f4ExcelComparisonResultSchema.parse(result)).not.toThrow();
    expect(result).toMatchObject({
      contractVersion: "v1",
      comparisonVersion: "f4-excel-comparison-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "passed",
      runId: "run-2026-08-07T00-00-00-000Z",
      generatedAt: "2026-08-07T12:34:56.789Z",
      source: { workbookContentHash: workbook.workbookHash },
    });
    expect(result.runId).toBe("run-2026-08-07T00-00-00-000Z");
    expect(result.worksheets).toHaveLength(1);
    expect(result.worksheets[0]).toEqual({
      worksheetName: "Analysis-A",
      metrics: [{
        metric: "system.rssSigma",
        f4Value: 0.045,
        excelValue: 0.045,
        excelDisplayText: "0.045",
        absoluteDifference: 0,
        relativeDifference: 0,
        tolerance: 1e-12,
        passed: true,
        sourceCell: "Analysis-A!T44",
        excelFormula: "SQRT(SUMSQ(T14:T43))",
        f4FormulaId: "rss-v1",
      }],
    });
    expect(result.summary).toEqual({ worksheetCount: 1, metricCount: 1, passedMetricCount: 1, mismatchMetricCount: 0 });
    expect(spawnSync.mock.calls[0][2].env.F4_EXCEL_REGRESSION_TEST_OUTPUTS_JSON).toBeUndefined();
  });

  it("normalizes harness mismatch to mismatch status", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 1,
      stdout: `${JSON.stringify(harnessPayload("regression_mismatch", false, workbook.workbookHash))}\n`,
      stderr: "",
      error: undefined,
    }));

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync });

    expect(result.status).toBe("mismatch");
    expect(() => f4ExcelComparisonResultSchema.parse(result)).not.toThrow();
    expect(result.worksheets[0].metrics[0].passed).toBe(false);
    expect(result.summary).toMatchObject({ mismatchMetricCount: 1 });
  });

  it("returns schema-valid excel_unavailable when Excel startup is unavailable", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 1,
      stdout: "\n\n" + JSON.stringify({ status: "excel_error", error: "Excel regression execution failed." }) + "\n",
      stderr: "",
      error: undefined,
    }));

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync });

    expect(result).toMatchObject({
      contractVersion: "v1",
      comparisonVersion: "f4-excel-comparison-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "excel_unavailable",
      reasonCode: "excel_execution_failed",
    });
    expect(() => f4ExcelComparisonResultSchema.parse(result)).not.toThrow();
    expect(result).not.toHaveProperty("worksheets");
  });

  it("fails with controlled hash mismatch before invoking harness", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn();

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult("b".repeat(64)),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/hash mismatch/i);
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("returns mapping_error for malformed worksheet mapping", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn();

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [{ worksheetName: "Analysis-A", mapping: { version: "excel-ta-v1", inputs: [], outputs: [{ name: "x" }] } }],
    }, { spawnSync });

    expect(result).toMatchObject({ status: "mapping_error", reasonCode: "worksheet_mapping_missing" });
    expect(() => f4ExcelComparisonResultSchema.parse(result)).not.toThrow();
    expect(result).not.toHaveProperty("worksheets");
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("keeps worksheet order from calculation result", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify(harnessPayload("regression_passed", true, workbook.workbookHash))}\n`,
      stderr: "",
      error: undefined,
    }));

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash, ["Worksheet-B", "Worksheet-A"]),
      mappings: [mappingFor("Worksheet-A"), mappingFor("Worksheet-B")],
    }, { spawnSync });

    expect(result.worksheets.map((entry) => entry.worksheetName)).toEqual(["Worksheet-B", "Worksheet-A"]);
  });

  it("throws controlled parse failure without leaking paths", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 1,
      stdout: "not-json",
      stderr: `failed for ${workbook.workbookPath}`,
      error: undefined,
    }));

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/Excel harness output is invalid/i);
  });

  it("rejects a harness result bound to a different workbook hash", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify(harnessPayload("regression_passed", true, "a".repeat(64)))}\n`,
      stderr: "",
    }));

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/hash mismatch/i);
  });

  it("rejects harness metric identity that differs from the approved mapping", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify(harnessPayload("regression_passed", true, workbook.workbookHash, { cell: "T45" }))}\n`,
      stderr: "",
    }));

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/invalid/i);
  });

  it("rejects a successful exit paired with mismatch status", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify(harnessPayload("regression_mismatch", false, workbook.workbookHash))}\n`,
      stderr: "",
    }));

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/invalid/i);
  });

  it("rejects passed harness output without an outputs array", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify({ status: "regression_passed", sourceSha256: workbook.workbookHash })}\n`,
      stderr: "",
    }));

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/invalid/i);
  });

  it("rejects harness-tampered differences and pass flag", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify(harnessPayload("regression_passed", true, workbook.workbookHash, {
        actual: 0.06,
        absoluteDifference: 0,
        relativeDifference: 0,
        pass: true,
      }))}\n`,
      stderr: "",
    }));

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/invalid/i);
  });

  it("rejects a calculation payload that is not a formal F4 workflow result", () => {
    const workbook = setupWorkbook();
    const invalidCalculation = { ...calculationResult(workbook.workbookHash), untrusted: true };
    const spawnSync = vi.fn();

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: invalidCalculation,
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/calculation result is invalid/i);
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("returns formula_evidence_missing when mapping formulaId is not bound to F4 trace", () => {
    const workbook = setupWorkbook();
    const mapping = mappingFor("Analysis-A");
    mapping.mapping.outputs[0].formulaId = "cp-v1";
    const spawnSync = vi.fn();

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mapping],
    }, { spawnSync });

    expect(result).toMatchObject({ status: "mapping_error", reasonCode: "formula_evidence_missing" });
    expect(() => f4ExcelComparisonResultSchema.parse(result)).not.toThrow();
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("treats source_modified as a workbook hash violation", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 1,
      stdout: `${JSON.stringify({ status: "source_modified", error: "Source workbook changed." })}\n`,
      stderr: "",
    }));

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/hash mismatch/i);
  });

  it("rejects external workbook formula evidence without a file extension", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify(harnessPayload("regression_passed", true, workbook.workbookHash, {
        formula: "='[Book1]Sheet1'!A1",
      }))}\n`,
      stderr: "",
    }));

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/invalid/i);
  });

  it("rejects a URI scheme in formula string evidence", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify(harnessPayload("regression_passed", true, workbook.workbookHash, {
        formula: "=WEBSERVICE(\"data:text/plain,classified-value\")",
      }))}\n`,
      stderr: "",
    }));

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/invalid/i);
  });

  it("validates but excludes Task 5 text status from numeric comparison", () => {
    const workbook = setupWorkbook();
    const mapping = mappingFor("Analysis-A");
    mapping.mapping.outputs.push({
      name: "capability.status",
      cell: "U57",
      expected: "PASS",
      tolerance: 1e-12,
      formulaId: "status-v1",
    });
    const spawnSync = vi.fn((_command, args) => {
      const mappingPath = args[args.indexOf("-MappingPath") + 1];
      const harnessMapping = JSON.parse(readFileSync(mappingPath, "utf8"));
      expect(harnessMapping.outputs.map((output) => output.name)).toEqual(["system.rssSigma"]);
      return {
        status: 0,
        stdout: `${JSON.stringify(harnessPayload("regression_passed", true, workbook.workbookHash))}\n`,
        stderr: "",
      };
    });

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mapping],
    }, { spawnSync });

    expect(result.status).toBe("passed");
    expect(result.worksheets[0].metrics.map((metric) => metric.metric)).toEqual(["system.rssSigma"]);
  });

  for (const [name, statusOutput] of [
    ["duplicate output name", { name: "system.rssSigma", cell: "U57" }],
    ["duplicate output cell", { name: "capability.status", cell: "T44" }],
    ["column beyond Excel limit", { name: "capability.status", cell: "XFE1" }],
    ["row beyond Excel limit", { name: "capability.status", cell: "A1048577" }],
  ]) {
    it(`rejects mixed mapping with ${name} before invoking harness`, () => {
      const workbook = setupWorkbook();
      const mapping = mappingFor("Analysis-A");
      mapping.mapping.outputs.push({
        name: statusOutput.name,
        cell: statusOutput.cell,
        expected: statusOutput.name === "capability.status" ? "PASS" : 0.045,
        tolerance: 1e-12,
        formulaId: statusOutput.name === "capability.status" ? "status-v1" : "rss-v1",
      });
      const spawnSync = vi.fn();

      const result = compareF4WithExcel({
        workbookPath: workbook.workbookPath,
        calculationResult: calculationResult(workbook.workbookHash),
        mappings: [mapping],
      }, { spawnSync });

      expect(result).toMatchObject({ status: "mapping_error", reasonCode: "worksheet_mapping_missing" });
      expect(spawnSync).not.toHaveBeenCalled();
    });
  }

  it("accepts the same benign quoted Note label as the Excel harness", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify(harnessPayload("regression_passed", true, workbook.workbookHash, {
        formula: '=IF(A1=1,"Note: valid","")',
      }))}\n`,
      stderr: "",
    }));

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync });

    expect(result.status).toBe("passed");
  });

  it.each([
    ["RTD", '=RTD("external.prog.id",,"topic")'],
    ["DDE", '=cmd|" /C calc"!A0'],
  ])("rejects %s formula evidence returned by a forged harness", (_name, formula) => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify(harnessPayload("regression_passed", true, workbook.workbookHash, { formula }))}\n`,
      stderr: "",
    }));

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync })).toThrow(/invalid/i);
  });

  it("bounds the Excel harness execution time", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify(harnessPayload("regression_passed", true, workbook.workbookHash))}\n`,
      stderr: "",
    }));

    compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync });

    expect(spawnSync.mock.calls[0][2].timeout).toBe(300_000);
  });

  it("returns excel_unavailable when the harness is terminated by a signal", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: null,
      signal: "SIGTERM",
      stdout: "",
      stderr: "",
    }));

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync });

    expect(result).toMatchObject({
      status: "excel_unavailable",
      reasonCode: "excel_runtime_unavailable",
    });
    expect(() => f4ExcelComparisonResultSchema.parse(result)).not.toThrow();
  });

  it("returns excel_unavailable when the Excel harness times out", () => {
    const workbook = setupWorkbook();
    const timeoutError = Object.assign(new Error("spawnSync pwsh ETIMEDOUT"), { code: "ETIMEDOUT" });
    const spawnSync = vi.fn(() => ({
      status: null,
      signal: "SIGTERM",
      stdout: "",
      stderr: "",
      error: timeoutError,
    }));

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync });

    expect(result).toMatchObject({ status: "excel_unavailable", reasonCode: "excel_runtime_unavailable" });
    expect(() => f4ExcelComparisonResultSchema.parse(result)).not.toThrow();
  });
});
