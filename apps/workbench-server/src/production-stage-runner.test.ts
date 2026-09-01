import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
});