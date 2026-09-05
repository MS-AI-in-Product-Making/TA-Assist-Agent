import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { F8SessionSnapshot, TaWorkbookOrchestrator } from "@ai-assist/workbench";

import { runProductionStage, type ProductionStageEnvironment } from "./production-stage-runner.js";

const baseSnapshot = {
  contractVersion: "f8-session-snapshot-v1",
  sessionId: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  inputRevision: 2,
  state: "f3_running",
  activeAttempt: null,
  priorRunReferences: [{ featureId: "F2", referenceId: "f2-run", contractVersion: "f2-user-report-v1", runReference: "f2-run" }],
  initialScopeSelection: {
    workbookContentHash: "a".repeat(64),
    selectedWorksheetNames: ["Analysis-A"],
    confirmed: true,
    provenance: "user",
  },
  downstreamScopeSelection: {
    workbookContentHash: "a".repeat(64),
    selectedWorksheetNames: ["Analysis-A"],
    confirmed: true,
    provenance: "user",
  },
} as const satisfies Partial<F8SessionSnapshot>;

function createEnvironment(stage: "f3_running" | "f5_running" | "f6_running"): ProductionStageEnvironment {
  return {
    repositoryRoot: ".",
    serverRoot: ".",
    sessionId: "11111111-1111-4111-8111-111111111111",
    workbookPath: "uploads/session/book.xlsx",
    snapshot: {
      ...baseSnapshot,
      state: stage,
    } as F8SessionSnapshot,
    roots: {
      f1Root: "managed/f1",
      f2Root: "managed/f2",
      f3Root: "managed/f3",
      f4Root: "managed/f4",
      f5Root: "managed/f5",
      f6Root: "managed/f6",
    },
    context: {
      attemptId: "attempt-1",
      repositoryRoot: ".",
      managedOutputRoot: "managed",
      signal: new AbortController().signal,
      emit: () => {},
    },
    baselineRunReference: "f2-run",
    reviewContext: {
      workbookHash: "a".repeat(64),
      downstreamSelectionHash: "scope-hash",
      baselineRunReference: "f2-run",
    },
  };
}

function orchestratorResult(result: unknown): TaWorkbookOrchestrator {
  return {
    runStage: async () => result as never,
    runWorkbookScopeDiscovery: async () => ({ status: "completed", skillId: "workbook-scope-discovery-v1", inputRevision: 2, idempotencyKey: "attempt-1" }),
    runAnalysisInputValidation: async () => ({ status: "completed", skillId: "analysis-input-validation-v1", inputRevision: 2, idempotencyKey: "attempt-1" }),
  };
}

describe("runProductionStage output gating", () => {
  it("rejects blocked results even if output exists", async () => {
    await expect(runProductionStage(
      "f3_running",
      createEnvironment("f3_running"),
      orchestratorResult({
        status: "blocked",
        skillId: "dimension-traceability-review-v1",
        inputRevision: 2,
        idempotencyKey: "attempt-1:f3_running",
        output: {
          status: "completed",
          outputDirectory: "managed/f3",
          reportJsonPath: "managed/f3/report.json",
        },
      }),
    )).rejects.toThrow();
  });

  it("rejects failed results even if output exists", async () => {
    await expect(runProductionStage(
      "f3_running",
      createEnvironment("f3_running"),
      orchestratorResult({
        status: "failed",
        skillId: "dimension-traceability-review-v1",
        inputRevision: 2,
        idempotencyKey: "attempt-1:f3_running",
        reasonCode: "runner_failed",
        summary: "failed",
        output: {
          status: "completed",
          outputDirectory: "managed/f3",
          reportJsonPath: "managed/f3/report.json",
        },
      }),
    )).rejects.toThrow();
  });

  it("accepts completed results with output", async () => {
    const serverRoot = await mkdtemp(join(tmpdir(), "ta-task4-f3-"));
    try {
      const reportPath = join(serverRoot, "managed", "f3", "report.json");
      await mkdir(join(serverRoot, "managed", "f3"), { recursive: true });
      await writeFile(reportPath, "{}\n", "utf8");
      const result = await runProductionStage(
        "f3_running",
        {
          ...createEnvironment("f3_running"),
          serverRoot,
        },
        orchestratorResult({
          status: "completed",
          skillId: "dimension-traceability-review-v1",
          inputRevision: 2,
          idempotencyKey: "attempt-1:f3_running",
          output: {
            status: "governance_required",
            outputDirectory: "managed/f3",
            reportJsonPath: reportPath,
          },
        }),
      );

      expect(result.result).toBeDefined();
    } finally {
      await rm(serverRoot, { recursive: true, force: true });
    }
  });

  it("passes only caller-authorized F6 input references and registers the governed five-pack", async () => {
    const serverRoot = await mkdtemp(join(tmpdir(), "ta-task5-f6-"));
    try {
      const sessionId = createEnvironment("f6_running").sessionId;
      const publishRoot = join(serverRoot, "runtime", "workbench", "runner-output", sessionId);
      const managedRoot = join(publishRoot, "managed");
      const outputDir = join(managedRoot, "f6");
      await Promise.all([
        mkdir(outputDir, { recursive: true }),
        mkdir(join(managedRoot, "f2"), { recursive: true }),
        mkdir(join(managedRoot, "f3"), { recursive: true }),
        mkdir(join(managedRoot, "f4"), { recursive: true }),
        mkdir(join(managedRoot, "f5"), { recursive: true }),
      ]);
      const optimizationJsonPath = join(outputDir, "Feature6-Optimization.json");
      const optimizationMdPath = join(outputDir, "Feature6-Optimization.md");
      const finalReportMdPath = join(outputDir, "Feature6-Report.md");
      const runSummaryPath = join(outputDir, "Feature6-Run-Summary.json");
      const manifestPath = join(outputDir, "manifest.json");
      await Promise.all([
        writeFile(optimizationJsonPath, "{}\n", "utf8"),
        writeFile(optimizationMdPath, "# optimization\n", "utf8"),
        writeFile(finalReportMdPath, "# report\n", "utf8"),
        writeFile(runSummaryPath, "{}\n", "utf8"),
        writeFile(manifestPath, "{}\n", "utf8"),
      ]);

      let capturedRequest: Record<string, unknown> | undefined;
      const result = await runProductionStage(
        "f6_running",
        {
          ...createEnvironment("f6_running"),
          serverRoot,
          roots: {
            f1Root: join(managedRoot, "f1"),
            f2Root: join(managedRoot, "f2"),
            f3Root: join(managedRoot, "f3"),
            f4Root: join(managedRoot, "f4"),
            f5Root: join(managedRoot, "f5"),
            f6Root: outputDir,
          },
          callerAuthorizedF6Inputs: {
            analysisContextPath: "uploads/session/analysis-context-v2.json",
            optimizationTargetsPath: "uploads/session/optimization-targets-v2.json",
          },
        },
        {
          runStage: async (_stage, input) => {
            capturedRequest = (input.input as { request?: Record<string, unknown> }).request;
            return {
              status: "completed",
              skillId: "improvement-evaluation-v1",
              inputRevision: 2,
              idempotencyKey: "attempt-1:f6_running",
              output: {
                status: "completed",
                outputDirectory: outputDir,
                optimizationJsonPath,
                optimizationMdPath,
                finalReportMdPath,
                runSummaryPath,
                manifestPath,
                finalReportProjection: { summary: "ok" },
              },
            } as never;
          },
          runWorkbookScopeDiscovery: async () => ({ status: "completed", skillId: "workbook-scope-discovery-v1", inputRevision: 2, idempotencyKey: "attempt-1" }),
          runAnalysisInputValidation: async () => ({ status: "completed", skillId: "analysis-input-validation-v1", inputRevision: 2, idempotencyKey: "attempt-1" }),
        },
      );

      expect(capturedRequest).toMatchObject({
        analysisContextPath: "uploads/session/analysis-context-v2.json",
        optimizationTargetsPath: "uploads/session/optimization-targets-v2.json",
      });

      const artifactReferences = (result.result as { artifactReferences: Array<{ artifactId: string; relativePath: string }> }).artifactReferences;
      expect(artifactReferences.map((artifact) => artifact.artifactId)).toEqual([
        "f6-optimization:2",
        "f6-optimization-markdown:2",
        "f6-report:2",
        "f6-run-summary:2",
        "f6-manifest:2",
        "engineering-summary-projection:2",
      ]);
      const normalizedPaths = artifactReferences.map((artifact) => artifact.relativePath.replace(/\\/g, "/"));
      expect(normalizedPaths.some((path) => path.endsWith("/managed/f6/Feature6-Optimization.json"))).toBe(true);
      expect(normalizedPaths.some((path) => path.endsWith("/managed/f6/Feature6-Optimization.md"))).toBe(true);
      expect(normalizedPaths.some((path) => path.endsWith("/managed/f6/Feature6-Report.md"))).toBe(true);
      expect(normalizedPaths.some((path) => path.endsWith("/managed/f6/Feature6-Run-Summary.json"))).toBe(true);
      expect(normalizedPaths.some((path) => path.endsWith("/managed/f6/manifest.json"))).toBe(true);
      const projection = await readFile(join(serverRoot, "runtime", "workbench", "managed-artifacts", createEnvironment("f6_running").sessionId, "engineering-summary-projection", "revision-2.json"), "utf8");
      expect(projection).toContain("summary");
    } finally {
      await rm(serverRoot, { recursive: true, force: true });
    }
  });
});