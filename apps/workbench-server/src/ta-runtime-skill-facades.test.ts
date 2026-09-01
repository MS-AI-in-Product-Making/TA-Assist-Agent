import { describe, expect, it, vi } from "vitest";

import { createTaRuntimeSkillFacades } from "./ta-runtime-skill-facades.js";

function baseContext(attemptId: string) {
  return {
    attemptId,
    repositoryRoot: ".",
    managedOutputRoot: `managed/${attemptId}`,
    signal: new AbortController().signal,
    emit: () => {},
  };
}

describe("ta runtime skill facades", () => {
  it("delegates f0/f1-discovery/f1-f2/f3/f5/f6 exactly once with deep-equal outputs", async () => {
    const f0Output = { featureId: "F0", status: "completed", versions: ["v1"] };
    const f1DiscoveryOutput = { selectionReference: { runId: "f1-run" }, prompt: { contractVersion: "v1", status: "selectionRequired" } };
    const f1f2Output = { featureId: "F2", status: "completed", f1Root: "managed/f1", f2Root: "managed/f2" };
    const f3Output = { featureId: "F3", status: "completed", outputDirectory: "managed/f3", reportJsonPath: "managed/f3/report.json" };
    const f5Output = { featureId: "F5", status: "completed", outputDirectory: "managed/f5", reportJsonPath: "managed/f5/report.json" };
    const f6Output = { featureId: "F6", status: "completed", outputDirectory: "managed/f6", optimizationJsonPath: "managed/f6/optimization.json", finalReportMdPath: "managed/f6/final.md" };

    const runF0 = vi.fn(() => f0Output);
    const runF1Discovery = vi.fn(() => f1DiscoveryOutput);
    const runF1F2 = vi.fn(() => f1f2Output);
    const runF3 = vi.fn(() => f3Output);
    const runF5 = vi.fn(() => f5Output);
    const runF6 = vi.fn(() => f6Output);

    const facades = createTaRuntimeSkillFacades({
      validateF0Capabilities: runF0 as never,
      runF1F2Selection: runF1Discovery as never,
      runF1F2Confirmed: runF1F2 as never,
      runF3Analysis: runF3 as never,
      runF5Interpretation: runF5 as never,
      runF6Optimization: runF6 as never,
    });

    const worksheetScope = { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true as const, provenance: "user" as const };

    const f0 = await facades.knowledgeAndRulesValidation.invoke({ inputRevision: 1, idempotencyKey: "attempt-1:f0", artifactReferences: [], input: { context: baseContext("attempt-1") } });
    const f1Discovery = await facades.workbookScopeDiscovery.invoke({ inputRevision: 1, idempotencyKey: "attempt-1:f1-discovery", artifactReferences: [], input: { request: { workbookPath: "managed/input.xlsx" }, context: baseContext("attempt-1") } });
    const f1f2 = await facades.workbookAnalysisAssets.invoke({ inputRevision: 1, idempotencyKey: "attempt-1:f1-f2", artifactReferences: [], worksheetScope, input: { request: { workbookPath: "managed/input.xlsx", workbookContentHash: worksheetScope.workbookContentHash, selectedWorksheetNames: worksheetScope.selectedWorksheetNames, selectionReference: { runId: "f1-run" } }, context: baseContext("attempt-1") } });
    const f3 = await facades.dimensionTraceabilityReview.invoke({ inputRevision: 1, idempotencyKey: "attempt-1:f3", artifactReferences: [{ artifactId: "f2:1", kind: "f2_report", revision: 1, validated: true }], worksheetScope, input: { request: { artifactRoot: "managed/f2", selectedWorksheetNames: ["Analysis-A"], outputRoot: "managed/f3" }, context: baseContext("attempt-1") } });
    const f5 = await facades.engineeringInterpretation.invoke({ inputRevision: 1, idempotencyKey: "attempt-1:f5", artifactReferences: [{ artifactId: "f3:1", kind: "f3_report", revision: 1, validated: true }, { artifactId: "f4:1", kind: "f4_calculation", revision: 1, validated: true }], worksheetScope, input: { request: { f1ArtifactRoot: "managed/f1", f3ArtifactRoot: "managed/f3", f4ArtifactRoot: "managed/f4", selectedWorksheetNames: ["Analysis-A"] }, context: baseContext("attempt-1") } });
    const f6 = await facades.improvementEvaluation.invoke({ inputRevision: 1, idempotencyKey: "attempt-1:f6", artifactReferences: [{ artifactId: "f3:1", kind: "f3_report", revision: 1, validated: true }, { artifactId: "f4:1", kind: "f4_calculation", revision: 1, validated: true }, { artifactId: "f5:1", kind: "f5_report", revision: 1, validated: true }], worksheetScope, input: { request: { f2ArtifactRoot: "managed/f2", f3ArtifactRoot: "managed/f3", f4ArtifactRoot: "managed/f4", f5ArtifactRoot: "managed/f5", selectedWorksheetNames: ["Analysis-A"] }, context: baseContext("attempt-1") } });

    expect(runF0).toHaveBeenCalledTimes(1);
    expect(runF1Discovery).toHaveBeenCalledTimes(1);
    expect(runF1F2).toHaveBeenCalledTimes(1);
    expect(runF3).toHaveBeenCalledTimes(1);
    expect(runF5).toHaveBeenCalledTimes(1);
    expect(runF6).toHaveBeenCalledTimes(1);

    expect(f0.status).toBe("completed");
    expect(f0.output).toEqual(f0Output);
    expect(f1Discovery.status).toBe("completed");
    expect(f1Discovery.output).toEqual(f1DiscoveryOutput);
    expect(f1f2.status).toBe("completed");
    expect(f1f2.output).toEqual(f1f2Output);
    expect(f3.status).toBe("completed");
    expect(f3.output).toEqual(f3Output);
    expect(f5.status).toBe("completed");
    expect(f5.output).toEqual(f5Output);
    expect(f6.status).toBe("completed");
    expect(f6.output).toEqual(f6Output);
  });

  it("delegates calculation exactly once to the existing runner", async () => {
    const calculationResult = { featureId: "F4", status: "completed", outputDirectory: "managed/f4", manifestPath: "managed/f4/manifest.json" };
    const runF4 = vi.fn(() => calculationResult);
    const facades = createTaRuntimeSkillFacades({ runF4Calculation: runF4 as never });

    const result = await facades.tolerancePerformanceCalculation.invoke({
      inputRevision: 4,
      idempotencyKey: "attempt-7:f4_running",
      artifactReferences: [{ artifactId: "f2-report", kind: "f2_report", revision: 4, validated: true }],
      worksheetScope: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "user" },
      input: {
        request: { artifactRoot: "managed/f2", selectedWorksheetNames: ["Analysis-A"] },
        context: { attemptId: "attempt-7", repositoryRoot: ".", managedOutputRoot: "managed/f4", signal: new AbortController().signal, emit: () => {} },
      },
    });

    expect(runF4).toHaveBeenCalledTimes(1);
    expect(result.output).toEqual(calculationResult);
  });

  it("returns facade output deep-equal to legacy runner fixture output", async () => {
    const fixtureResult = {
      featureId: "F4",
      status: "completed",
      outputDirectory: "managed/f4",
      calculationJsonPath: "managed/f4/Feature4-Calculation.json",
      manifestPath: "managed/f4/manifest.json",
      summary: { worksheetCount: 1 },
    };
    const runF4 = vi.fn(() => fixtureResult);
    const facades = createTaRuntimeSkillFacades({ runF4Calculation: runF4 as never });
    const invocation = {
      inputRevision: 4,
      idempotencyKey: "attempt-8:f4_running",
      artifactReferences: [{ artifactId: "f2-report", kind: "f2_report", revision: 4, validated: true }],
      worksheetScope: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "user" as const },
      input: {
        request: { artifactRoot: "managed/f2", selectedWorksheetNames: ["Analysis-A"] },
        context: { attemptId: "attempt-8", repositoryRoot: ".", managedOutputRoot: "managed/f4", signal: new AbortController().signal, emit: () => {} },
      },
    };

    const legacy = runF4(invocation.input.request, invocation.input.context);
    const facadeResult = await facades.tolerancePerformanceCalculation.invoke(invocation);

    expect(facadeResult.status).toBe("completed");
    expect(facadeResult.output).toEqual(legacy);
  });

  it("normalizes runner blocked statuses into blocked facade results", async () => {
    const runF3 = vi.fn(() => ({ featureId: "F3", status: "partiallyBlocked", reasonCode: "worksheet_missing" }));
    const facades = createTaRuntimeSkillFacades({ runF3Analysis: runF3 as never });

    const result = await facades.dimensionTraceabilityReview.invoke({
      inputRevision: 4,
      idempotencyKey: "attempt-9:f3_running",
      artifactReferences: [{ artifactId: "f2-report", kind: "f2_report", revision: 4, validated: true }],
      worksheetScope: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "user" },
      input: {
        request: { artifactRoot: "managed/f2", selectedWorksheetNames: ["Analysis-A"], outputRoot: "managed/f3" },
        context: baseContext("attempt-9"),
      },
    });

    expect(result.status).toBe("blocked");
    expect(result.output).toEqual({ featureId: "F3", status: "partiallyBlocked", reasonCode: "worksheet_missing" });
  });

  it("normalizes runner failed statuses into failed facade results", async () => {
    const runF5 = vi.fn(() => ({ featureId: "F5", status: "failed", reasonCode: "report_generation_failed" }));
    const facades = createTaRuntimeSkillFacades({ runF5Interpretation: runF5 as never });

    const result = await facades.engineeringInterpretation.invoke({
      inputRevision: 4,
      idempotencyKey: "attempt-10:f5_running",
      artifactReferences: [
        { artifactId: "f3-report", kind: "f3_report", revision: 4, validated: true },
        { artifactId: "f4-calc", kind: "f4_calculation", revision: 4, validated: true },
      ],
      worksheetScope: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "user" },
      input: {
        request: { f1ArtifactRoot: "managed/f1", f3ArtifactRoot: "managed/f3", f4ArtifactRoot: "managed/f4", selectedWorksheetNames: ["Analysis-A"] },
        context: baseContext("attempt-10"),
      },
    });

    expect(result.status).toBe("failed");
    expect(result.output).toEqual({ featureId: "F5", status: "failed", reasonCode: "report_generation_failed" });
  });
});
