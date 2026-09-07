import { describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { runF6Optimization } from "./index.js";

function context() {
  return {
    repositoryRoot: "C:/repo",
    managedOutputRoot: "C:/repo/managed-output",
    attemptId: "f6-attempt",
    signal: new AbortController().signal,
    emit: vi.fn(),
  };
}

describe("runF6Optimization", () => {
  it("requires Context before Targets and Targets before F6", () => {
    expect(() => runF6Optimization({
      f2ArtifactRoot: "C:/repo/test/demo-output/f2",
      f3ArtifactRoot: "C:/repo/test/demo-output/f3",
      f4ArtifactRoot: "C:/repo/test/demo-output/f4",
      f5ArtifactRoot: "C:/repo/test/demo-output/f5",
      selectedWorksheetNames: ["Analysis-A"],
      analysisContextPath: undefined,
      optimizationTargetsPath: "C:/repo/evidence/targets.json",
    }, context(), {
      resolveOutputLayout: vi.fn(() => ({
        runId: "2026-08-24T01-02-03-000Z",
        runRoot: "C:/repo/managed-output/f6-runs/run-1",
        publishRoot: "C:/repo/managed-output",
        optimizationJsonName: "Feature6-Optimization.json",
        optimizationMdName: "Feature6-Optimization.md",
        finalReportMdName: "Feature6-Report.md",
        runSummaryJsonName: "Feature6-Run-Summary.json",
        manifestName: "manifest.json",
      })),
      loadBundle: vi.fn(() => ({
        status: "accepted",
        request: { worksheets: [] },
        f2Report: { artifactRoot: "C:/repo/test/demo-output/f1" },
        f3Report: {},
        f4Report: {},
        f5Report: {},
        optimizationTargets: { targetVersion: "f6-optimization-targets-v1", worksheets: [] },
        inputDecisions: {
          analysisContext: { outcome: "NOT_PROVIDED" },
          optimizationTargets: {
            outcome: "CALLER_AUTHORIZED",
            artifactReference: { artifact: "targets.json", contentHash: "a".repeat(64) },
          },
        },
        sourceReferences: {},
      })),
      createFinalReport: vi.fn(() => ({ markdown: "# F6 report\n", reportSummary: { workbookDisposition: "PASS", worksheetDispositions: [] } })),
      renderOptimization: vi.fn(() => "# F6 optimization\n"),
      mkdir: vi.fn(),
      randomUUID: vi.fn(() => "temp-id"),
      realpath: vi.fn((value) => String(value)),
      lstat: vi.fn(() => ({ isDirectory: () => true, isSymbolicLink: () => false })),
      stat: vi.fn(() => ({ dev: 1, ino: 1, isFile: () => true, isDirectory: () => true })),
      open: vi.fn(() => 1),
      writeFd: vi.fn(),
      close: vi.fn(),
      rename: vi.fn(),
      beforeRename: vi.fn(),
      afterRename: vi.fn(),
      rmdir: vi.fn(),
      rm: vi.fn(),
    })).toThrow(expect.objectContaining({ code: "prerequisite_not_ready" }));
  });

  it("passes the full validated model interpretation artifact to createOptimization", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f6-runner-test-"));
    const runRoot = path.join(root, "publish", "f6-runs", "run-1");
    const modelInterpretation = {
      contractVersion: "f5-multimodal-artifact-v3",
      worksheets: [{ worksheetName: "Analysis-A", tableId: "table-1", optimizationAssessment: [] }],
    };
    const createOptimization = vi.fn(() => ({
      runStatus: "COMPLETED",
      summary: {
        completedWorksheetCount: 0,
        partiallyCompletedWorksheetCount: 0,
        calculationFailedWorksheetCount: 0,
        inputRejectedWorksheetCount: 0,
        candidateOptionCount: 0,
        completedOptionCount: 0,
        failedOptionCount: 0,
        calculationFailedOptionCount: 0,
        insufficientEvidenceOptionCount: 0,
      },
      worksheets: [],
    }));

    runF6Optimization({
      f2ArtifactRoot: "C:/repo/test/demo-output/f2",
      f3ArtifactRoot: "C:/repo/test/demo-output/f3",
      f4ArtifactRoot: "C:/repo/test/demo-output/f4",
      f5ArtifactRoot: "C:/repo/test/demo-output/f5",
      selectedWorksheetNames: ["Analysis-A"],
      modelInterpretationPath: "C:/repo/managed/interpretation-v3.json",
      expectedModelInterpretationContentHash: "a".repeat(64),
    }, context(), {
      resolveOutputLayout: vi.fn(() => ({
        runId: "2026-08-24T01-02-03-000Z",
        runRoot,
        publishRoot: path.join(root, "publish"),
        optimizationJsonName: "Feature6-Optimization.json",
        optimizationMdName: "Feature6-Optimization.md",
        finalReportMdName: "Feature6-Report.md",
        runSummaryJsonName: "Feature6-Run-Summary.json",
        manifestName: "manifest.json",
      })),
      loadBundle: vi.fn(() => ({
        status: "accepted",
        request: { worksheets: [] },
        f2Report: { artifactRoot: "C:/repo/test/demo-output/f1" },
        f3Report: {},
        f4Report: {},
        f5Report: {},
        modelInterpretation,
        inputDecisions: {
          analysisContext: { outcome: "NOT_PROVIDED" },
          optimizationTargets: { outcome: "NOT_PROVIDED" },
          modelInterpretation: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "Feature6-Model-Interpretation.json", contentHash: "a".repeat(64) } },
        },
        sourceReferences: {},
      })),
      createOptimization,
      createFinalReport: vi.fn(() => ({ markdown: "# F6 report\n", reportSummary: { workbookDisposition: "PASS", worksheetDispositions: [] }, projection: {} })),
      renderOptimization: vi.fn(() => "# F6 optimization\n"),
    });

    expect(createOptimization).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ modelInterpretation }),
    );
  });

  it("fails closed with input_rejected when caller-confirmed analysis context hash mismatches loaded bundle hash", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f6-runner-test-"));
    const runRoot = path.join(root, "publish", "f6-runs", "run-1");
    const createOptimization = vi.fn(() => ({
      runStatus: "COMPLETED",
      summary: {
        completedWorksheetCount: 0,
        partiallyCompletedWorksheetCount: 0,
        calculationFailedWorksheetCount: 0,
        inputRejectedWorksheetCount: 0,
        candidateOptionCount: 0,
        completedOptionCount: 0,
        failedOptionCount: 0,
        calculationFailedOptionCount: 0,
        insufficientEvidenceOptionCount: 0,
      },
      worksheets: [],
    }));

    const result = runF6Optimization({
      f2ArtifactRoot: "C:/repo/test/demo-output/f2",
      f3ArtifactRoot: "C:/repo/test/demo-output/f3",
      f4ArtifactRoot: "C:/repo/test/demo-output/f4",
      f5ArtifactRoot: "C:/repo/test/demo-output/f5",
      selectedWorksheetNames: ["Analysis-A"],
      expectedAnalysisContextContentHash: "a".repeat(64),
    } as any, context(), {
      resolveOutputLayout: vi.fn(() => ({
        runId: "2026-08-24T01-02-03-000Z",
        runRoot,
        publishRoot: path.join(root, "publish"),
        optimizationJsonName: "Feature6-Optimization.json",
        optimizationMdName: "Feature6-Optimization.md",
        finalReportMdName: "Feature6-Report.md",
        runSummaryJsonName: "Feature6-Run-Summary.json",
        manifestName: "manifest.json",
      })),
      loadBundle: vi.fn(() => ({
        status: "accepted",
        request: { worksheets: [] },
        f2Report: { artifactRoot: "C:/repo/test/demo-output/f1" },
        f3Report: {},
        f4Report: {},
        f5Report: {},
        analysisContext: { contractVersion: "v1", contextVersion: "f6-analysis-context-v2", inputClassification: "confidential", workbookContentHash: "a".repeat(64), worksheets: [] },
        inputDecisions: {
          analysisContext: {
            outcome: "CALLER_AUTHORIZED",
            artifactReference: { artifact: "Feature6-Analysis-Context.json", contentHash: "b".repeat(64) },
          },
          optimizationTargets: { outcome: "NOT_PROVIDED" },
          modelInterpretation: { outcome: "NOT_PROVIDED" },
        },
        sourceReferences: {},
      })),
      createOptimization,
      createFinalReport: vi.fn(() => ({ markdown: "# F6 report\n", reportSummary: { workbookDisposition: "PASS", worksheetDispositions: [] }, projection: {} })),
      renderOptimization: vi.fn(() => "# F6 optimization\n"),
    });

    expect(result.status).toBe("failed");
    expect(result.reasonCode).toBe("input_rejected");
    expect(createOptimization).not.toHaveBeenCalled();
  });

  it("writes no optimization or final report when mandatory multimodal authority is absent", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f6-runner-multimodal-gate-"));
    const runRoot = path.join(root, "publish", "f6-runs", "run-1");
    const createOptimization = vi.fn();
    const createFinalReport = vi.fn();
    const result = runF6Optimization({
      f2ArtifactRoot: "C:/repo/test/demo-output/f2",
      f3ArtifactRoot: "C:/repo/test/demo-output/f3",
      f4ArtifactRoot: "C:/repo/test/demo-output/f4",
      f5ArtifactRoot: "C:/repo/test/demo-output/f5",
      selectedWorksheetNames: ["Analysis-A"],
      modelInterpretationPath: "C:/repo/managed/interpretation-v3.json",
      expectedModelInterpretationContentHash: "a".repeat(64),
    }, context(), {
      resolveOutputLayout: vi.fn(() => ({ runId: "2026-08-24T01-02-03-000Z", runRoot, publishRoot: path.join(root, "publish"), optimizationJsonName: "Feature6-Optimization.json", optimizationMdName: "Feature6-Optimization.md", finalReportMdName: "Feature6-Report.md", runSummaryJsonName: "Feature6-Run-Summary.json", manifestName: "manifest.json" })),
      loadBundle: vi.fn(() => ({
        status: "accepted",
        request: { worksheets: [] },
        f2Report: { artifactRoot: "C:/repo/test/demo-output/f1" },
        f3Report: {},
        f4Report: {},
        f5Report: {},
        inputDecisions: { analysisContext: { outcome: "NOT_PROVIDED" }, optimizationTargets: { outcome: "NOT_PROVIDED" }, modelInterpretation: { outcome: "NOT_PROVIDED" } },
        sourceReferences: {},
      })),
      createOptimization,
      createFinalReport,
      renderOptimization: vi.fn(),
    });

    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(createOptimization).not.toHaveBeenCalled();
    expect(createFinalReport).not.toHaveBeenCalled();
    expect(result.optimizationJsonPath).toBeUndefined();
    expect(result.finalReportMdPath).toBeUndefined();
  });
});