import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createF5DataInterpretation } from "@ai-assist/workbook-catalog";

import { runF5Interpretation } from "./index.js";

function context() {
  return {
    repositoryRoot: "C:/repo",
    managedOutputRoot: "C:/repo/managed-output",
    attemptId: "f5-attempt",
    signal: new AbortController().signal,
    emit: vi.fn(),
  };
}

describe("runF5Interpretation", () => {
  it("publishes accepted v2 image evidence and preserves the controlled worksheet scope", async () => {
    const scopes = [
      "tolerance_loop_closure",
      "datum_chain",
      "assembly_datum_face",
      "stack_start",
      "direction",
    ];
    const calculationResult = {
      contractVersion: "v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "completed",
      calculationVersion: "excel-ta-v1",
      projectReference: "controlled-project-reference",
      runReference: "controlled-run-reference",
      workbookContentHash: "a".repeat(64),
      worksheetSelection: { worksheetName: "Analysis-A", tableId: "table-a" },
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
        trace: { formulaIds: ["factor-mean-v1"], sourceCells: ["Analysis-A!A2"] },
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
      traceRecords: [
        ["capability.cpk", "cpk-v1"],
        ["capability.cp", "cp-v1"],
        ["system.rssSigma", "rss-v1"],
        ["capability.totalDpm", "dpm-total-v1"],
        ["capability.yield", "yield-v1"],
        ["capability.lowerZ", "z-lower-v1"],
        ["capability.upperZ", "z-upper-v1"],
        ["factors[0].contribution", "contribution-v1"],
      ].map(([outputField, formulaId]) => ({
        outputField,
        formulaVersion: "excel-ta-v1",
        formulaId,
        sourceCells: ["Analysis-A!A2"],
      })),
      scenarios: [],
    };
    const observationArtifact = {
      contractVersion: "v1",
      inputClassification: "confidential",
      observationVersion: "f5-image-observation-v2",
      workbookContentHash: "a".repeat(64),
      worksheets: [{
        worksheetName: "Analysis-A",
        imageReference: {
          artifact: "f1",
          worksheetName: "Analysis-A",
          relativePath: "images/analysis-a.png",
          contentHash: "b".repeat(64),
        },
        contextSnapshot: {
          dimensionDescription: "dimension-1",
          rows: [{
            tableId: "table-a",
            sourceRow: 2,
            factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!Z2" },
            partName: "controlled-subsystem",
            partSubsystem: "controlled-subsystem",
            partCategory: "controlled-category",
            factorName: "Factor A",
            factorDescription: "Factor A",
            nominal: 0,
            upperTolerance: 0.1,
            lowerTolerance: -0.1,
            sigmaLevel: 4,
            sourceCells: {},
          }],
        },
        observations: scopes.map((scope) => ({
          scope,
          visualObservation: {
            observedValue: "visible",
            confidence: "high",
            visibleBasis: `Visible controlled marker for ${scope}.`,
            visibleLabels: [],
            reviewStatus: "unreviewed",
          },
          contextualSignal: {
            signalValue: "insufficient_evidence",
            textBasis: `Worksheet context requires engineering review for ${scope}.`,
            linkedSourceRows: [],
            linkedVisualLabels: [],
            requiresEngineeringReview: true,
          },
        })),
      }],
    };
    const interpretationRequest = {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64) },
      knowledgeBaseVersion: "interpretation-rules-v2",
      worksheets: [{
        worksheetName: "Analysis-A",
        imageReference: {
          artifact: "f1",
          worksheetName: "Analysis-A",
          relativePath: "images/analysis-a.png",
          contentHash: "b".repeat(64),
        },
        governanceRows: [{
          factorInstanceId: "1".padStart(64, "0"),
          factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!Z2" },
          drawingDimensionKey: "2".padStart(64, "0"),
          deviceLevelDim: "device-dim-1",
          dimensionDescription: "dimension-1",
          partCategory: "controlled-category",
          partSubsystem: "controlled-subsystem",
          drawingNumber: "DRAW-1",
          dimId: "DIM-1",
          factorDescription: "Factor A",
          nominal: 0,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          sigmaLevel: 4,
          dimIdStatus: "valid",
          qualitySignals: [],
          governanceStatus: "complete",
          imageReference: {
            artifact: "f1",
            worksheetName: "Analysis-A",
            relativePath: "images/analysis-a.png",
            contentHash: "b".repeat(64),
          },
          source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, sourceCells: {} },
        }],
        calculationResult,
        imageObservations: [],
      }],
    };

    const result = await runF5Interpretation({
      f1ArtifactRoot: "C:/repo/test/demo-output/f1",
      f3ArtifactRoot: "C:/repo/test/demo-output/f3",
      f4ArtifactRoot: "C:/repo/test/demo-output/f4",
      selectedWorksheetNames: ["Analysis-A"],
      imageObservationsPath: "C:/repo/evidence/observations.json",
    }, context(), {
      resolveOutputLayout: vi.fn(() => ({
        runId: "2026-08-24T01-02-03-000Z",
        runRoot: "C:/repo/managed-output/f5-runs/run-1",
        publishRoot: "C:/repo/managed-output",
        reportJsonName: "Feature5-Report.json",
        reportMdName: "Feature5-Report.md",
        runSummaryJsonName: "Feature5-Run-Summary.json",
        imageObservationsJsonName: "Feature5-Image-Observations.json",
        manifestName: "manifest.json",
        allowExistingRunRoot: false,
      })),
      loadBundle: vi.fn(() => ({
        status: "accepted",
        request: interpretationRequest,
        rejectedWorksheets: [],
        worksheetOrder: ["Analysis-A"],
        sourceReferences: {
          f1: "Feature1-Report.json",
          f3: "Feature3-Report.json",
          f4: "Feature4-Calculation.json",
          observation: "observations.json",
        },
        observationArtifact,
      })),
      createInterpretation: vi.fn((request) => createF5DataInterpretation(request)),
      renderReport: vi.fn(() => "# Feature 5\n"),
      mkdir: vi.fn(),
      randomUUID: vi.fn(() => "temp-id"),
      realpath: vi.fn((value) => String(value)),
      stat: vi.fn(() => ({ dev: 1, ino: 1, isDirectory: () => true })),
      open: vi.fn(() => 1),
      writeFd: vi.fn(),
      close: vi.fn(),
      rename: vi.fn(),
      rmdir: vi.fn(),
      rm: vi.fn(),
    });

    expect(result.selectedWorksheetNames).toEqual(["Analysis-A"]);
    expect(result.imageObservationsPath).toContain("Feature5-Image-Observations.json");
  });

  it("publishes the current workspace flow directly into the fixed F5 stage without a run-id child", async () => {
    const loadBundle = vi.fn(() => ({
      status: "accepted",
      request: {
        contractVersion: "v1",
        inputClassification: "confidential",
        workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64) },
        knowledgeBaseVersion: "interpretation-rules-v2",
        worksheets: [],
      },
      rejectedWorksheets: [],
      worksheetOrder: [],
      sourceReferences: {
        f1: "Feature1-Report.json",
        f3: "Feature3-Report.json",
        f4: "Feature4-Calculation.json",
      },
    }));
    const mkdir = vi.fn((target, options) => {
      if (target === "C:/repo/test/20260921 - Demo/05 - F5 Result Interpretation" && options?.recursive !== true) {
        throw Object.assign(new Error("EEXIST"), { code: "EEXIST" });
      }
    });

    const result = await runF5Interpretation({
      f1ArtifactRoot: "C:/repo/test/20260921 - Demo/01 - F1 Data Parsing",
      f3ArtifactRoot: "C:/repo/test/20260921 - Demo/03 - F3 Drawing Governance",
      f4ArtifactRoot: "C:/repo/test/20260921 - Demo/04 - F4 Calculation Engine",
      selectedWorksheetNames: ["Analysis-A"],
      imageObservationsPath: undefined,
    }, context(), {
      resolveOutputLayout: vi.fn(() => ({
        runId: "2026-08-24T01-02-03-000Z",
        runRoot: "C:/repo/test/20260921 - Demo/05 - F5 Result Interpretation",
        publishRoot: "C:/repo/test/20260921 - Demo",
        reportJsonName: "Feature5-Report.json",
        reportMdName: "Feature5-Report.md",
        runSummaryJsonName: "Feature5-Run-Summary.json",
        imageObservationsJsonName: "Feature5-Image-Observations.json",
        manifestName: "manifest.json",
        allowExistingRunRoot: true,
      })),
      loadBundle,
      createInterpretation: vi.fn(() => createF5DataInterpretation(loadBundle.mock.results[0].value.request)),
      renderReport: vi.fn(() => "# Feature 5\n"),
      mkdir,
      randomUUID: vi.fn(() => "temp-id"),
      realpath: vi.fn((value) => String(value)),
      stat: vi.fn(() => ({ dev: 1, ino: 1, isDirectory: () => true })),
      open: vi.fn(() => 1),
      writeFd: vi.fn(),
      close: vi.fn(),
      rename: vi.fn(),
      rmdir: vi.fn(),
      rm: vi.fn(),
    });

    expect(result.outputDirectory).toBe("C:/repo/test/20260921 - Demo/05 - F5 Result Interpretation");
    expect(mkdir).toHaveBeenCalledWith("C:/repo/test/20260921 - Demo/05 - F5 Result Interpretation", { recursive: true });
  });

  it("rejects a dirty workspace stage before loading bundles or writing reports", () => {
    const runRoot = mkdtempSync(path.join(tmpdir(), "f5-runner-dirty-"));
    try {
      writeFileSync(path.join(runRoot, "Feature5-Report.json"), "stale report\n", "utf8");
      const loadBundle = vi.fn();

      expect(() => runF5Interpretation({
        f1ArtifactRoot: "C:/repo/f1",
        f3ArtifactRoot: "C:/repo/f3",
        f4ArtifactRoot: "C:/repo/f4",
        selectedWorksheetNames: ["Analysis-A"],
        imageObservationsPath: undefined,
      }, context(), {
        resolveOutputLayout: vi.fn(() => ({
          runId: "2026-08-24T01-02-03-000Z",
          runRoot,
          publishRoot: "C:/repo/test/20260921 - Demo",
          reportJsonName: "Feature5-Report.json",
          reportMdName: "Feature5-Report.md",
          runSummaryJsonName: "Feature5-Run-Summary.json",
          imageObservationsJsonName: "Feature5-Image-Observations.json",
          manifestName: "manifest.json",
          allowExistingRunRoot: true,
        })),
        loadBundle,
        createInterpretation: vi.fn(),
        renderReport: vi.fn(),
      })).toThrow(expect.objectContaining({
        code: "prerequisite_not_ready",
        summary: "Workspace stage already contains published artifacts.",
      }));
      expect(loadBundle).not.toHaveBeenCalled();
    } finally {
      rmSync(runRoot, { recursive: true, force: true });
    }
  });
});