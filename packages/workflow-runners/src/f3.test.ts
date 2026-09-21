import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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
    const resolveOutputLayout = vi.fn((_args, managedOutputRoot) => ({
      outRoot: managedOutputRoot,
      reportJsonName: "Feature3-Report.json",
      reportMdName: "Feature3-Report.md",
    }));

    const result = await runF3Analysis({
      artifactRoot: "C:/repo/test/demo-output/f2",
      selectedWorksheetNames: ["Analysis-A"],
      outputRoot: "C:/repo/test/20260921 - Demo/03 - F3 Drawing Governance",
    }, context(), {
      loadBundle,
      createGovernance,
      renderReport: vi.fn(() => "# report\n"),
      renderAdoReminder: vi.fn(() => "# reminder\n"),
      renderAdoHistoryHtml: vi.fn(() => "<table></table>\n"),
      resolveOutputLayout,
      writeOutputs: vi.fn(),
    });

    expect(resolveOutputLayout).toHaveBeenCalledWith(
      ["C:/repo/test/demo-output/f2"],
      "C:/repo/test/20260921 - Demo/03 - F3 Drawing Governance",
    );
    expect(loadBundle).toHaveBeenCalledWith("C:/repo/test/demo-output/f2", { selectedWorksheetNames: ["Analysis-A"] });
    expect(createGovernance).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "governance_required",
      selectedWorksheetNames: ["Analysis-A"],
      outputDirectory: "C:/repo/test/20260921 - Demo/03 - F3 Drawing Governance",
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

  it("rejects a dirty workspace stage before loading bundles or writing reports", () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), "f3-runner-dirty-"));
    try {
      writeFileSync(path.join(outputRoot, "Feature3-ADO-Reminder.md"), "stale reminder\n", "utf8");
      const loadBundle = vi.fn();

      expect(() => runF3Analysis({ artifactRoot: "C:/repo/f2", outputRoot }, context(), {
        loadBundle,
        resolveOutputLayout: vi.fn(() => ({
          outRoot: outputRoot,
          reportJsonName: "Feature3-Report.json",
          reportMdName: "Feature3-Report.md",
          workspaceMode: true,
        })),
      })).toThrow(expect.objectContaining({ code: "internal_error", summary: "Workflow runner failed unexpectedly." }));
      expect(loadBundle).not.toHaveBeenCalled();
      expect(path.join(outputRoot, "Feature3-ADO-Reminder.md")).toContain("Feature3-ADO-Reminder.md");
    } finally {
      rmSync(outputRoot, { recursive: true, force: true });
    }
  });
});