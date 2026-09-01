import { describe, expect, it, vi } from "vitest";

import {
  createTaWorkbookOrchestrator,
  type TaWorkbookOrchestratorDependencies,
} from "./ta-workbook-orchestrator.js";

describe("ta workbook orchestrator", () => {
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
