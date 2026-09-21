import { describe, expect, it, vi } from "vitest";

import { runF4Calculation } from "./index.js";

function completedCalculation(workbookHash: string, worksheetName: string, tableId: string) {
  return {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    calculationVersion: "excel-ta-v1",
    projectReference: "project-ref",
    runReference: `run-ref-${worksheetName}`,
    workbookContentHash: workbookHash,
    worksheetSelection: { worksheetName, tableId },
    factorCount: 1,
    recommendation: {
      method: "worst_case",
      reason: "factor_count_1_to_3",
      refer3d: false,
      criticality: "none",
      criticalityRisk: false,
    },
    factors: [{
      factorName: `Factor ${worksheetName}`,
      unit: "mm",
      source: { worksheetName, tableId, sourceRow: 14 },
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
      trace: {
        formulaIds: ["factor-mean-v1", "factor-half-tolerance-v1", "factor-sigma-v1", "contribution-v1"],
        sourceCells: [`${worksheetName}!I14`],
      },
    }],
    system: {
      designNominal: 0,
      mean: 0,
      additionalMeanShift: 0,
      worstCaseUpper: 0.1,
      worstCaseLower: -0.1,
      rssSigma: 0.025,
    },
    capability: {
      lowerSpecLimit: -1,
      upperSpecLimit: 1,
      targetSigmaLevel: 4,
      targetCpk: 1.33,
      cp: 13.333333333333334,
      lowerCpk: 13.333333333333334,
      upperCpk: 13.333333333333334,
      cpk: 13.333333333333334,
      lowerZ: 40,
      upperZ: 40,
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
      sourceCells: [`${worksheetName}!T44`],
    }],
    scenarios: [],
  };
}

function workflowResult() {
  const workbookHash = "a".repeat(64);
  return {
    contractVersion: "v1",
    workflowVersion: "f4-f2-v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    runId: "2026-08-24T01-02-03-000Z",
    generatedAt: "2026-08-24T01:02:03.000Z",
    source: {
      artifactReference: "Feature2-Report.json",
      workbookFileName: "Demo.xlsx",
      workbookContentHash: workbookHash,
    },
    calculations: [
      completedCalculation(workbookHash, "A", "table-a"),
      completedCalculation(workbookHash, "B", "table-b"),
    ],
    summary: { selectedWorksheetCount: 2, completedWorksheetCount: 2 },
  };
}

function context() {
  return {
    repositoryRoot: "C:/repo",
    managedOutputRoot: "C:/repo/managed-output",
    attemptId: "f4-attempt",
    signal: new AbortController().signal,
    emit: vi.fn(),
  };
}

describe("runF4Calculation", () => {
  it("keeps F4 extras outside downstream scope", async () => {
    const loadHandoffs = vi.fn(() => ({
      status: "accepted",
      reportPath: "Feature2-Report.json",
      workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64) },
      handoffs: [
        { worksheetName: "A", factors: [{ tableId: "table-a" }] },
        { worksheetName: "B", factors: [{ tableId: "table-b" }] },
      ],
    }));
    const calculateWorkflow = vi.fn(() => ({
      ...workflowResult(),
    }));

    const mkdir = vi.fn((target, options) => {
      if (target === "C:/repo/test/20260921 - Demo/04 - F4 Calculation Engine" && options?.recursive !== true) {
        throw Object.assign(new Error("EEXIST"), { code: "EEXIST" });
      }
    });

    const result = await runF4Calculation({
      artifactRoot: "C:/repo/test/demo-output/f2",
      selectedWorksheetNames: ["A"],
    }, context(), {
      resolveOutputLayout: vi.fn(() => ({
        runId: "2026-08-24T01-02-03-000Z",
        f2ReportPath: "C:/repo/test/demo-output/f2/Feature2-Report.json",
        workbookPath: undefined,
        runRoot: "C:/repo/test/20260921 - Demo/04 - F4 Calculation Engine",
        calculationJsonName: "Feature4-Calculation.json",
        reportMdName: "Feature4-Report.md",
        comparisonJsonName: "Feature4-Comparison.json",
        manifestName: "manifest.json",
        allowExistingRunRoot: true,
      })),
      loadHandoffs,
      calculateWorkflow,
      renderReport: vi.fn(() => "# F4 Report\n"),
      mkdir,
      writeFile: vi.fn(),
      rename: vi.fn(),
      rm: vi.fn(),
    });

    expect(result.acceptedCalculations.map((item) => item.worksheetName)).toEqual(["A"]);
    expect(result.extraCalculations.map((item) => item.worksheetName)).toEqual(["B"]);
    expect(result.outputDirectory).toBe("C:/repo/test/20260921 - Demo/04 - F4 Calculation Engine");
    expect(mkdir).toHaveBeenCalledWith("C:/repo/test/20260921 - Demo/04 - F4 Calculation Engine", { recursive: true });
  });
});