import { describe, expect, it, vi } from "vitest";

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
});