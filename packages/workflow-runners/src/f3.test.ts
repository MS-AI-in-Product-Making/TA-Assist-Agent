import { describe, expect, it, vi } from "vitest";

import { runF3Analysis } from "./index.js";

function context(signal = new AbortController().signal) {
  return {
    repositoryRoot: "C:/repo",
    managedOutputRoot: "C:/repo/managed-output",
    attemptId: "f3-attempt",
    signal,
    emit: vi.fn(),
  };
}

describe("runF3Analysis", () => {
  it("runs local F3 governance for the exact downstream scope and never publishes ADO", async () => {
    const loadBundle = vi.fn(() => ({
      status: "accepted",
      request: {
        contractVersion: "v1",
        modelVersion: "drawing-governance-v2",
        inputClassification: "confidential",
        artifactRoot: "controlled/f1",
        workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64) },
        worksheets: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "Loop A", f2Status: "ready", rows: [] }],
      },
    }));
    const createGovernance = vi.fn((request) => ({
      contractVersion: "v1",
      modelVersion: "drawing-governance-v2",
      outputClassification: "confidential",
      featureId: "F3",
      status: "governance_required",
      artifactRoot: request.artifactRoot,
      workbook: request.workbook,
      worksheets: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "Loop A", rows: [] }],
      summary: { worksheetCount: 1, factorCount: 0, completeCount: 0, governanceRequiredCount: 1, duplicateConflictCount: 0 },
      ado: { status: "not_requested" },
    }));

    const result = await runF3Analysis({ artifactRoot: "C:/repo/test/demo-output/f2", selectedWorksheetNames: ["Analysis-A"], outputRoot: "C:/unsafe/browser-output" }, context(), {
      loadBundle,
      createGovernance,
      renderReport: vi.fn(() => "# report\n"),
      renderAdoReminder: vi.fn(() => "# reminder\n"),
      renderAdoHistoryHtml: vi.fn(() => "<table></table>\n"),
      resolveOutputLayout: vi.fn(() => ({ outRoot: "C:/repo/managed-output/feature3-output/f2", reportJsonName: "Feature3-Report.json", reportMdName: "Feature3-Report.md" })),
      writeOutputs: vi.fn(),
    });

    expect(loadBundle).toHaveBeenCalledWith("C:/repo/test/demo-output/f2", { selectedWorksheetNames: ["Analysis-A"] });
    expect(createGovernance).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "governance_required",
      selectedWorksheetNames: ["Analysis-A"],
      outputDirectory: "C:/repo/managed-output/feature3-output/f2",
      ado: { status: "not_requested" },
    });
  });

  it("fails before any external work when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const loadBundle = vi.fn();

    expect(() => runF3Analysis({ artifactRoot: "C:/repo/f2" }, context(controller.signal), { loadBundle })).toThrow(expect.objectContaining({
      name: "Error",
      code: "transient_error",
      retryable: true,
    }));
    expect(loadBundle).not.toHaveBeenCalled();
  });

  it("normalizes ordinary and unknown F3 failures to typed errors", async () => {
    expect(() => runF3Analysis({ artifactRoot: "C:/repo/f2" }, context(), {
      loadBundle: vi.fn(() => ({
        status: "accepted",
        request: {
          contractVersion: "v1",
          modelVersion: "drawing-governance-v2",
          inputClassification: "confidential",
          artifactRoot: "controlled/f1",
          workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64) },
          worksheets: [{ worksheetName: "Analysis-A", toleranceLoopDescription: "Loop A", f2Status: "ready", rows: [] }],
        },
      })),
      createGovernance: vi.fn(() => { throw new Error("Cannot find module 'writer'."); }),
    })).toThrow(expect.objectContaining({ name: "Error", code: "dependency_error" }));

    expect(() => runF3Analysis({ artifactRoot: "C:/repo/f2" }, context(), {
      loadBundle: vi.fn(() => { throw "secret=abc"; }),
    })).toThrow(expect.objectContaining({
      name: "Error",
      code: "internal_error",
      summary: "Workflow runner failed unexpectedly.",
    }));
  });
});