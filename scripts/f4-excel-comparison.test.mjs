import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { compareF4WithExcel } from "./f4-excel-comparison.mjs";

const cleanup = [];

afterEach(() => {
  for (const target of cleanup.splice(0)) {
    rmSync(target, { recursive: true, force: true });
  }
});

function sha256(content) {
  return createHash("sha256").update(content).digest("hex").toUpperCase();
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
    factorCount: 0,
    recommendation: {
      method: "worst_case",
      reason: "factor_count_1_to_3",
      refer3d: false,
      criticality: "none",
      criticalityRisk: false,
    },
    factors: [],
    system: {
      designNominal: 0,
      mean: 0,
      additionalMeanShift: 0,
      worstCaseUpper: 0,
      worstCaseLower: 0,
      rssSigma: 0,
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
    traceRecords: [{
      outputField: "system.rssSigma",
      formulaVersion: "excel-ta-v1",
      formulaId: "rss-v1",
      sourceCells: ["T44"],
    }],
    scenarios: [],
  };
}

function calculationResult(workbookHash, worksheetNames = ["Analysis-A"]) {
  return {
    runId: "run-2026-08-07T00-00-00-000Z",
    source: {
      workbookContentHash: workbookHash,
    },
    calculations: worksheetNames.map((name) => completedCalculation(name, workbookHash)),
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

function harnessPayload(status, pass) {
  return {
    status,
    sourceSha256: "A".repeat(64),
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
    }],
  };
}

describe("compareF4WithExcel", () => {
  it("returns schema-valid passed result", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `noise\n${JSON.stringify(harnessPayload("regression_passed", true))}\n`,
      stderr: "",
      error: undefined,
    }));

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync });

    expect(result.status).toBe("passed");
    expect(result.runId).toBe("run-2026-08-07T00-00-00-000Z");
    expect(result.workbookContentHash).toBe(workbook.workbookHash);
    expect(result.worksheets).toHaveLength(1);
    expect(result.worksheets[0]).toMatchObject({ worksheetName: "Analysis-A", status: "passed" });
    expect(result.worksheets[0].metrics).toHaveLength(1);
    expect(result.summary).toMatchObject({ worksheetCount: 1, passedWorksheetCount: 1, mismatchedMetricCount: 0 });
  });

  it("normalizes harness mismatch to mismatch status", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 1,
      stdout: `${JSON.stringify(harnessPayload("regression_mismatch", false))}\n`,
      stderr: "",
      error: undefined,
    }));

    const result = compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult(workbook.workbookHash),
      mappings: [mappingFor("Analysis-A")],
    }, { spawnSync });

    expect(result.status).toBe("mismatch");
    expect(result.worksheets[0].status).toBe("mismatch");
    expect(result.summary).toMatchObject({ mismatchedMetricCount: 1 });
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

    expect(result.status).toBe("excel_unavailable");
    expect(result.worksheets[0]).toMatchObject({ worksheetName: "Analysis-A", status: "excel_unavailable" });
    expect(result.worksheets[0].metrics).toEqual([]);
  });

  it("fails with controlled hash mismatch before invoking harness", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn();

    expect(() => compareF4WithExcel({
      workbookPath: workbook.workbookPath,
      calculationResult: calculationResult("B".repeat(64)),
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

    expect(result.status).toBe("mapping_error");
    expect(result.worksheets[0]).toMatchObject({ status: "mapping_error" });
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("keeps worksheet order from calculation result", () => {
    const workbook = setupWorkbook();
    const spawnSync = vi.fn(() => ({
      status: 0,
      stdout: `${JSON.stringify(harnessPayload("regression_passed", true))}\n`,
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
});
