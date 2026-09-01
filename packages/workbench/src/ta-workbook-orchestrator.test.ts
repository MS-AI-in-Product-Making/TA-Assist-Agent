import { describe, expect, it, vi } from "vitest";

import {
  createTaWorkbookOrchestrator,
  type TaWorkbookOrchestratorDependencies,
} from "./ta-workbook-orchestrator.js";

describe("ta workbook orchestrator", () => {
  function createDependencies() {
    return {
      knowledgeAndRulesValidation: { metadata: { skillId: "knowledge-and-rules-validation-v1" }, invoke: vi.fn(async () => ({ status: "completed" as const, output: { featureId: "F0" } })) },
      workbookScopeDiscovery: { metadata: { skillId: "workbook-scope-discovery-v1" }, invoke: vi.fn(async () => ({ status: "completed" as const, output: { featureId: "F1" } })) },
      workbookAnalysisAssets: { metadata: { skillId: "workbook-analysis-assets-v1" }, invoke: vi.fn(async () => ({ status: "completed" as const, output: { featureId: "F2" } })) },
      analysisInputValidation: { metadata: { skillId: "analysis-input-validation-v1" }, invoke: vi.fn(async () => ({ status: "blocked" as const, reasonCode: "delegated" })) },
      dimensionTraceabilityReview: { metadata: { skillId: "dimension-traceability-review-v1" }, invoke: vi.fn(async () => ({ status: "completed" as const, output: { featureId: "F3" } })) },
      tolerancePerformanceCalculation: { metadata: { skillId: "tolerance-performance-calculation-v1" }, invoke: vi.fn(async () => ({ status: "completed" as const, output: { featureId: "F4" } })) },
      engineeringInterpretation: { metadata: { skillId: "engineering-interpretation-v1" }, invoke: vi.fn(async () => ({ status: "completed" as const, output: { featureId: "F5" } })) },
      improvementEvaluation: { metadata: { skillId: "improvement-evaluation-v1" }, invoke: vi.fn(async () => ({ status: "completed" as const, output: { featureId: "F6" } })) },
    } as unknown as TaWorkbookOrchestratorDependencies;
  }

  it("routes every production stage to the expected facade", async () => {
    const dependencies = createDependencies();
    const orchestrator = createTaWorkbookOrchestrator(dependencies);
    const invocation = {
      inputRevision: 2,
      idempotencyKey: "attempt-1:stage",
      artifactReferences: [{ artifactId: "f2-report", kind: "f2_report", revision: 2, validated: true }],
      worksheetScope: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true as const, provenance: "user" as const },
      input: { stage: "test" },
    };

    await orchestrator.runStage("f0_validating", invocation);
    await orchestrator.runStage("f1_f2_running", invocation);
    await orchestrator.runStage("f3_running", invocation);
    await orchestrator.runStage("f4_running", invocation);
    await orchestrator.runStage("f5_running", invocation);
    await orchestrator.runStage("f6_running", invocation);

    expect(dependencies.knowledgeAndRulesValidation.invoke).toHaveBeenCalledTimes(1);
    expect(dependencies.workbookAnalysisAssets.invoke).toHaveBeenCalledTimes(1);
    expect(dependencies.dimensionTraceabilityReview.invoke).toHaveBeenCalledTimes(1);
    expect(dependencies.tolerancePerformanceCalculation.invoke).toHaveBeenCalledTimes(1);
    expect(dependencies.engineeringInterpretation.invoke).toHaveBeenCalledTimes(1);
    expect(dependencies.improvementEvaluation.invoke).toHaveBeenCalledTimes(1);
  });

  it("routes workbook scope discovery and analysis input validation through dedicated facades", async () => {
    const dependencies = createDependencies();
    const orchestrator = createTaWorkbookOrchestrator(dependencies);
    const invocation = {
      inputRevision: 2,
      idempotencyKey: "attempt-1:aux",
      artifactReferences: [],
      input: { stage: "aux" },
    };

    await orchestrator.runWorkbookScopeDiscovery(invocation);
    await orchestrator.runAnalysisInputValidation(invocation);

    expect(dependencies.workbookScopeDiscovery.invoke).toHaveBeenCalledTimes(1);
    expect(dependencies.analysisInputValidation.invoke).toHaveBeenCalledTimes(1);
  });

  it("does not expose placeholder ado/report/export facades through runStage", async () => {
    const dependencies = createDependencies();
    const orchestrator = createTaWorkbookOrchestrator(dependencies);

    await expect(() => orchestrator.runStage("ado_action_pending" as never, {
      inputRevision: 2,
      idempotencyKey: "attempt-1:ado_action_pending",
      artifactReferences: [],
      input: { stage: "ado_action_pending" },
    })).rejects.toThrow(/unsupported ta workbook stage/i);
  });

  it("routes f4 stage through tolerance performance calculation facade", async () => {
    const invoke = vi.fn(async () => ({ status: "completed" as const, output: { featureId: "F4" } }));
    const dependencies = {
      knowledgeAndRulesValidation: { metadata: { skillId: "knowledge-and-rules-validation-v1" }, invoke: vi.fn() },
      workbookScopeDiscovery: { metadata: { skillId: "workbook-scope-discovery-v1" }, invoke: vi.fn() },
      workbookAnalysisAssets: { metadata: { skillId: "workbook-analysis-assets-v1" }, invoke: vi.fn() },
      analysisInputValidation: { metadata: { skillId: "analysis-input-validation-v1" }, invoke: vi.fn() },
      dimensionTraceabilityReview: { metadata: { skillId: "dimension-traceability-review-v1" }, invoke: vi.fn() },
      tolerancePerformanceCalculation: { metadata: { skillId: "tolerance-performance-calculation-v1" }, invoke },
      engineeringInterpretation: { metadata: { skillId: "engineering-interpretation-v1" }, invoke: vi.fn() },
      improvementEvaluation: { metadata: { skillId: "improvement-evaluation-v1" }, invoke: vi.fn() },
    } as unknown as TaWorkbookOrchestratorDependencies;

    const orchestrator = createTaWorkbookOrchestrator(dependencies);
    const result = await orchestrator.runStage("f4_running", {
      inputRevision: 2,
      idempotencyKey: "attempt-1:f4_running",
      artifactReferences: [{ artifactId: "f2-report", kind: "f2_report", revision: 2, validated: true }],
      worksheetScope: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true, provenance: "user" },
      input: { stage: "f4_running" },
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "completed", output: { featureId: "F4" } });
  });
});
