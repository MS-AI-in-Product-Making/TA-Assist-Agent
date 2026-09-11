import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

import type { F8SessionSnapshot, TaWorkbookOrchestrator } from "@ai-assist/workbench";
import { createF5MultimodalFactorSetHash, createF5MultimodalRequestHash } from "@ai-assist/contracts";

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
  interactionLanguage: {
    languageTag: "en-US",
    uiCatalogLanguage: "en",
    lockedAtTurnId: "turn-1",
    source: "workflow_start",
    fallbackUsed: false,
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
  it("does not start deterministic F5 without a complete multimodal aggregate", async () => {
    const runStage = vi.fn();
    const orchestrator = { ...orchestratorResult({}), runStage };

    await expect(runProductionStage("f5_running", createEnvironment("f5_running"), orchestrator)).rejects.toThrow(/multimodal/i);
    expect(runStage).not.toHaveBeenCalled();
  });

  it("passes the governed multimodal aggregate identity into F5", async () => {
    const serverRoot = await mkdtemp(join(tmpdir(), "ta-task6-f5-"));
    try {
      const reportPath = join(serverRoot, "managed", "f5", "Feature5-Report.json");
      await mkdir(join(serverRoot, "managed", "f5"), { recursive: true });
      await writeFile(reportPath, "{}\n", "utf8");
      const environment = { ...createEnvironment("f5_running"), serverRoot };
      const multimodalArtifact = await writeMultimodalArtifact(serverRoot, environment);
      let capturedRequest: Record<string, unknown> | undefined;

      await runProductionStage("f5_running", { ...environment, multimodalArtifact }, {
        ...orchestratorResult({}),
        runStage: async (_stage, input) => {
          capturedRequest = (input.input as { request?: Record<string, unknown> }).request;
          return { status: "completed", skillId: "engineering-interpretation-v1", inputRevision: 2, idempotencyKey: "attempt-1:f5_running", output: { status: "completed", outputDirectory: join(serverRoot, "managed", "f5"), reportJsonPath: reportPath } } as never;
        },
      });

      expect(capturedRequest).toMatchObject({
        modelInterpretationPath: multimodalArtifact.path,
        expectedModelInterpretationContentHash: multimodalArtifact.contentHash,
      });
    } finally {
      await rm(serverRoot, { recursive: true, force: true });
    }
  });

  it("starts F5 only for completed worksheets from a mixed multimodal v4 aggregate", async () => {
    const serverRoot = await mkdtemp(join(tmpdir(), "ta-task6-f5-mixed-"));
    try {
      const environment = {
        ...createEnvironment("f5_running"),
        serverRoot,
        snapshot: {
          ...createEnvironment("f5_running").snapshot,
          initialScopeSelection: {
            workbookContentHash: "a".repeat(64),
            selectedWorksheetNames: ["Analysis-A", "Analysis-B"],
            confirmed: true,
            provenance: "user",
          },
          downstreamScopeSelection: {
            workbookContentHash: "a".repeat(64),
            selectedWorksheetNames: ["Analysis-A", "Analysis-B"],
            confirmed: true,
            provenance: "user",
          },
        } as F8SessionSnapshot,
      };
      const multimodalArtifact = await writeMixedMultimodalArtifact(serverRoot, environment);
      environment.snapshot = {
        ...environment.snapshot,
        revision: environment.snapshot.revision + 1,
        artifactRefs: [{
          artifactId: "f5-multimodal:2",
          kind: "f5_multimodal",
          revision: 2,
          validated: true,
          reviewContextId: "c".repeat(64),
          relativePath: relative(serverRoot, multimodalArtifact.path),
          contentHash: multimodalArtifact.contentHash,
        }],
      };
      let capturedRequest: Record<string, unknown> | undefined;

      await runProductionStage("f5_running", { ...environment, multimodalArtifact }, {
        ...orchestratorResult({}),
        runStage: async (_stage, input) => {
          capturedRequest = (input.input as { request?: Record<string, unknown> }).request;
          const outputDirectory = join(serverRoot, "managed", "f5");
          const reportJsonPath = join(outputDirectory, "Feature5-Report.json");
          await mkdir(outputDirectory, { recursive: true });
          await writeFile(reportJsonPath, "{}\n", "utf8");
          return { status: "completed", skillId: "engineering-interpretation-v1", inputRevision: 2, idempotencyKey: "attempt-1:f5_running", output: { status: "completed", outputDirectory, reportJsonPath } } as never;
        },
      });

      expect(capturedRequest).toMatchObject({
        selectedWorksheetNames: ["Analysis-A"],
        modelInterpretationPath: multimodalArtifact.path,
        expectedModelInterpretationContentHash: multimodalArtifact.contentHash,
      });
    } finally {
      await rm(serverRoot, { recursive: true, force: true });
    }
  });

  it("starts F6 only for completed worksheets from a mixed multimodal v4 aggregate", async () => {
    const serverRoot = await mkdtemp(join(tmpdir(), "ta-task6-f6-mixed-"));
    try {
      const sessionId = createEnvironment("f6_running").sessionId;
      const publishRoot = join(serverRoot, "runtime", "workbench", "runner-output", sessionId);
      const managedRoot = join(publishRoot, "managed");
      const outputDir = join(managedRoot, "f6");
      await Promise.all([
        mkdir(outputDir, { recursive: true }),
        mkdir(join(managedRoot, "f1"), { recursive: true }),
        mkdir(join(managedRoot, "f2"), { recursive: true }),
        mkdir(join(managedRoot, "f3"), { recursive: true }),
        mkdir(join(managedRoot, "f4"), { recursive: true }),
        mkdir(join(managedRoot, "f5"), { recursive: true }),
      ]);
      const optimizationJsonPath = join(outputDir, "Feature6-Optimization.json");
      const finalReportMdPath = join(outputDir, "Feature6-Report.md");
      const runSummaryPath = join(outputDir, "Feature6-Run-Summary.json");
      const manifestPath = join(outputDir, "manifest.json");
      await Promise.all([
        writeFile(optimizationJsonPath, "{}\n", "utf8"),
        writeFile(finalReportMdPath, "# report\n", "utf8"),
        writeFile(runSummaryPath, "{}\n", "utf8"),
        writeFile(manifestPath, "{}\n", "utf8"),
      ]);
      const environment = {
        ...createEnvironment("f6_running"),
        serverRoot,
        snapshot: {
          ...createEnvironment("f6_running").snapshot,
          revision: 4,
          initialScopeSelection: {
            workbookContentHash: "a".repeat(64),
            selectedWorksheetNames: ["Analysis-A", "Analysis-B"],
            confirmed: true,
            provenance: "user",
          },
          downstreamScopeSelection: {
            workbookContentHash: "a".repeat(64),
            selectedWorksheetNames: ["Analysis-A", "Analysis-B"],
            confirmed: true,
            provenance: "user",
          },
          artifactRefs: [{ artifactId: "f5-multimodal:2", kind: "f5_multimodal", revision: 2, validated: true, reviewContextId: "c".repeat(64), relativePath: "multimodal-v4.json", contentHash: "f".repeat(64) }],
        } as F8SessionSnapshot,
        roots: {
          f1Root: join(managedRoot, "f1"),
          f2Root: join(managedRoot, "f2"),
          f3Root: join(managedRoot, "f3"),
          f4Root: join(managedRoot, "f4"),
          f5Root: join(managedRoot, "f5"),
          f6Root: outputDir,
        },
      };
      const multimodalArtifact = await writeMixedMultimodalArtifact(serverRoot, {
        ...environment,
        snapshot: {
          ...environment.snapshot,
          revision: 2,
        },
      });
      environment.snapshot.artifactRefs = [{
        artifactId: "f5-multimodal:2",
        kind: "f5_multimodal",
        revision: 2,
        validated: true,
        reviewContextId: "c".repeat(64),
        relativePath: "multimodal-v4.json",
        contentHash: multimodalArtifact.contentHash,
      }];
      let capturedRequest: Record<string, unknown> | undefined;

      await runProductionStage(
        "f6_running",
        {
          ...environment,
          multimodalArtifact,
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
        selectedWorksheetNames: ["Analysis-A"],
        modelInterpretationPath: multimodalArtifact.path,
        expectedModelInterpretationContentHash: multimodalArtifact.contentHash,
        requireMultimodalV3: true,
      });
    } finally {
      await rm(serverRoot, { recursive: true, force: true });
    }
  });

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

  it("accepts the current-input multimodal artifact across expected F6 session revision drift", async () => {
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
      const finalReportMdPath = join(outputDir, "Feature6-Report.md");
      const runSummaryPath = join(outputDir, "Feature6-Run-Summary.json");
      const manifestPath = join(outputDir, "manifest.json");
      await Promise.all([
        writeFile(optimizationJsonPath, "{}\n", "utf8"),
        writeFile(finalReportMdPath, "# report\n", "utf8"),
        writeFile(runSummaryPath, "{}\n", "utf8"),
        writeFile(manifestPath, "{}\n", "utf8"),
      ]);
      const multimodalArtifact = await writeMultimodalArtifact(serverRoot, createEnvironment("f6_running"));

      await expect(runProductionStage(
        "f6_running",
        {
          ...createEnvironment("f6_running"),
          serverRoot,
          snapshot: {
            ...createEnvironment("f6_running").snapshot,
            revision: 4,
            artifactRefs: [{ artifactId: "f5-multimodal:2", kind: "f5_multimodal", revision: 2, validated: true, reviewContextId: "c".repeat(64), relativePath: "multimodal.json", contentHash: "f".repeat(64) }],
          } as F8SessionSnapshot,
          multimodalArtifact,
        },
        orchestratorResult({}),
      )).rejects.toThrow(/reference mismatch/i);

      let capturedRequest: Record<string, unknown> | undefined;
      const result = await runProductionStage(
        "f6_running",
        {
          ...createEnvironment("f6_running"),
          serverRoot,
          snapshot: {
            ...createEnvironment("f6_running").snapshot,
            revision: 4,
            artifactRefs: [{ artifactId: "f5-multimodal:2", kind: "f5_multimodal", revision: 2, validated: true, reviewContextId: "c".repeat(64), relativePath: "multimodal.json", contentHash: multimodalArtifact.contentHash }],
          } as F8SessionSnapshot,
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
            expectedAnalysisContextContentHash: "a".repeat(64),
            optimizationTargetsPath: "uploads/session/optimization-targets-v2.json",
            expectedOptimizationTargetsContentHash: "b".repeat(64),
          },
          multimodalArtifact,
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
        interactionLanguage: baseSnapshot.interactionLanguage,
        analysisContextPath: "uploads/session/analysis-context-v2.json",
        expectedAnalysisContextContentHash: "a".repeat(64),
        optimizationTargetsPath: "uploads/session/optimization-targets-v2.json",
        expectedOptimizationTargetsContentHash: "b".repeat(64),
        modelInterpretationPath: multimodalArtifact.path,
        expectedModelInterpretationContentHash: multimodalArtifact.contentHash,
      });

      const artifactReferences = (result.result as { artifactReferences: Array<{ artifactId: string; relativePath: string }> }).artifactReferences;
      expect(artifactReferences.map((artifact) => artifact.artifactId)).toEqual([
        "f6-optimization:2",
        "f6-report:2",
        "f6-run-summary:2",
        "f6-manifest:2",
        "engineering-summary-projection:2",
      ]);
      expect(artifactReferences.map((artifact) => ({ artifactId: artifact.artifactId, kind: (artifact as { kind: string }).kind }))).toEqual([
        { artifactId: "f6-optimization:2", kind: "f6_optimization" },
        { artifactId: "f6-report:2", kind: "f6_report" },
        { artifactId: "f6-run-summary:2", kind: "f6_run_summary" },
        { artifactId: "f6-manifest:2", kind: "f6_manifest" },
        { artifactId: "engineering-summary-projection:2", kind: "engineering_summary_projection" },
      ]);
      expect(artifactReferences.filter((artifact) => (artifact as { kind: string }).kind === "f6_report")).toHaveLength(1);
      const normalizedPaths = artifactReferences.map((artifact) => artifact.relativePath.replace(/\\/g, "/"));
      expect(normalizedPaths.some((path) => path.endsWith("/managed/f6/Feature6-Optimization.json"))).toBe(true);
      expect(normalizedPaths.some((path) => path.endsWith("/managed/f6/Feature6-Optimization.md"))).toBe(false);
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

async function writeMultimodalArtifact(serverRoot: string, environment: ProductionStageEnvironment) {
  const row = { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 11, factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!Z11" }, factorName: "Factor A", partName: "Part A", partCategory: "CNC", drawingNumber: null, dimId: null, nominal: 0, upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal", sourceCells: { factorName: "Analysis-A!A11" } };
  const request = { contractVersion: "f5-multimodal-request-v3" as const, inputClassification: "confidential" as const, requestHash: "", sessionId: environment.sessionId, revision: environment.snapshot.revision, inputRevision: environment.snapshot.inputRevision, workbook: { fileName: "anonymous.xlsx", contentHash: "a".repeat(64) }, worksheetName: "Analysis-A", tableId: "table-a", activeFactorCount: 1, factorSetHash: createF5MultimodalFactorSetHash([row]), image: { mediaType: "image/png" as const, contentHash: "b".repeat(64), byteLength: 100, artifactPath: "images/analysis-a.png" }, factorRows: [row] };
  request.requestHash = createF5MultimodalRequestHash(request);
  const result = { contractVersion: "f5-multimodal-result-v3", outputClassification: "confidential", requestHash: request.requestHash, sessionId: environment.sessionId, revision: environment.snapshot.revision, inputRevision: environment.snapshot.inputRevision, workbookContentHash: "a".repeat(64), worksheetName: "Analysis-A", tableId: "table-a", imageContentHash: "b".repeat(64), model: { modelId: "vision-model", supportsImage: true }, imageTableInterpretation: "Image and complete table interpreted.", rowMappings: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 11, factorOrdinal: row.factorOrdinal, mappingStatus: "matched", visibleStatus: "visible", interpretation: "A is visible." }] };
  const bytes = Buffer.from(`${JSON.stringify({ contractVersion: "f5-multimodal-artifact-v3", outputClassification: "confidential", sessionId: environment.sessionId, revision: environment.snapshot.revision, inputRevision: environment.snapshot.inputRevision, workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], worksheets: [{ request, result }] })}\n`, "utf8");
  const path = join(serverRoot, "multimodal.json");
  await writeFile(path, bytes);
  return { path, contentHash: createHash("sha256").update(bytes).digest("hex") };
}

async function writeMixedMultimodalArtifact(serverRoot: string, environment: ProductionStageEnvironment) {
  const completedRow = { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 11, factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!Z11" }, factorName: "Factor A", partName: "Part A", partCategory: "CNC", drawingNumber: null, dimId: null, nominal: 0, upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal", sourceCells: { factorName: "Analysis-A!A11" } };
  const failedRow = { worksheetName: "Analysis-B", tableId: "table-b", sourceRow: 21, factorOrdinal: { value: "B", rawText: "B", sourceCell: "Analysis-B!Z21" }, factorName: "Factor B", partName: "Part B", partCategory: "CNC", drawingNumber: null, dimId: null, nominal: 0, upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal", sourceCells: { factorName: "Analysis-B!A21" } };
  const completedRequest = { contractVersion: "f5-multimodal-request-v3" as const, inputClassification: "confidential" as const, requestHash: "", sessionId: environment.sessionId, revision: environment.snapshot.revision, inputRevision: environment.snapshot.inputRevision, workbook: { fileName: "anonymous.xlsx", contentHash: "a".repeat(64) }, worksheetName: "Analysis-A", tableId: "table-a", activeFactorCount: 1, factorSetHash: createF5MultimodalFactorSetHash([completedRow]), image: { mediaType: "image/png" as const, contentHash: "b".repeat(64), byteLength: 100, artifactPath: "images/analysis-a.png" }, factorRows: [completedRow] };
  completedRequest.requestHash = createF5MultimodalRequestHash(completedRequest);
  const completedResult = { contractVersion: "f5-multimodal-result-v3", outputClassification: "confidential", requestHash: completedRequest.requestHash, sessionId: environment.sessionId, revision: environment.snapshot.revision, inputRevision: environment.snapshot.inputRevision, workbookContentHash: "a".repeat(64), worksheetName: "Analysis-A", tableId: "table-a", imageContentHash: "b".repeat(64), model: { modelId: "vision-model", supportsImage: true }, imageTableInterpretation: "Image and complete table interpreted.", rowMappings: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 11, factorOrdinal: completedRow.factorOrdinal, mappingStatus: "matched", visibleStatus: "visible", interpretation: "A is visible." }] };
  const failedRequest = { contractVersion: "f5-multimodal-request-v3" as const, inputClassification: "confidential" as const, requestHash: "", sessionId: environment.sessionId, revision: environment.snapshot.revision, inputRevision: environment.snapshot.inputRevision, workbook: { fileName: "anonymous.xlsx", contentHash: "a".repeat(64) }, worksheetName: "Analysis-B", tableId: "table-b", activeFactorCount: 1, factorSetHash: createF5MultimodalFactorSetHash([failedRow]), image: { mediaType: "image/png" as const, contentHash: "c".repeat(64), byteLength: 100, artifactPath: "images/analysis-b.png" }, factorRows: [failedRow] };
  failedRequest.requestHash = createF5MultimodalRequestHash(failedRequest);
  const bytes = Buffer.from(`${JSON.stringify({ contractVersion: "f5-multimodal-artifact-v4", outputClassification: "confidential", sessionId: environment.sessionId, revision: environment.snapshot.revision, inputRevision: environment.snapshot.inputRevision, workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A", "Analysis-B"], worksheets: [{ status: "completed", request: completedRequest, result: completedResult, scopeEvaluations: requiredScopeEvaluations() }, { status: "failed", request: failedRequest, reasonCode: "evaluation_failed", summary: "worksheet image evaluation failed" }] })}\n`, "utf8");
  const path = join(serverRoot, "multimodal-v4.json");
  await writeFile(path, bytes);
  return { path, contentHash: createHash("sha256").update(bytes).digest("hex") };
}

function requiredScopeEvaluations() {
  return ["tolerance_loop_closure", "datum_chain", "assembly_datum_face", "stack_start", "direction"].map((scope) => ({
    scope, status: "insufficient_evidence", observedValue: "ambiguous", confidence: "low",
    visibleBasis: "The supplied image does not establish this geometry.",
  }));
}