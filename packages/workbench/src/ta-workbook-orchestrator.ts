import type {
  RuntimeSkillFacade,
  RuntimeSkillInvocation,
  RuntimeSkillResult,
} from "./runtime-skill-facade.js";

export type TaWorkbookRunnableStage = "f0_validating" | "f1_f2_running" | "f3_running" | "f4_running" | "f5_running" | "f6_running";

export interface TaWorkbookOrchestratorDependencies {
  readonly knowledgeAndRulesValidation: RuntimeSkillFacade<unknown, unknown>;
  readonly workbookScopeDiscovery: RuntimeSkillFacade<unknown, unknown>;
  readonly workbookAnalysisAssets: RuntimeSkillFacade<unknown, unknown>;
  readonly analysisInputValidation: RuntimeSkillFacade<unknown, unknown>;
  readonly dimensionTraceabilityReview: RuntimeSkillFacade<unknown, unknown>;
  readonly tolerancePerformanceCalculation: RuntimeSkillFacade<unknown, unknown>;
  readonly engineeringInterpretation: RuntimeSkillFacade<unknown, unknown>;
  readonly improvementEvaluation: RuntimeSkillFacade<unknown, unknown>;
}

export interface TaWorkbookOrchestrator {
  runStage(stage: TaWorkbookRunnableStage, invocation: RuntimeSkillInvocation<unknown>): Promise<RuntimeSkillResult<unknown>>;
  runWorkbookScopeDiscovery(invocation: RuntimeSkillInvocation<unknown>): Promise<RuntimeSkillResult<unknown>>;
  runAnalysisInputValidation(invocation: RuntimeSkillInvocation<unknown>): Promise<RuntimeSkillResult<unknown>>;
}

export function createTaWorkbookOrchestrator(dependencies: TaWorkbookOrchestratorDependencies): TaWorkbookOrchestrator {
  return {
    async runStage(stage, invocation) {
      switch (stage) {
        case "f0_validating":
          return dependencies.knowledgeAndRulesValidation.invoke(invocation);
        case "f1_f2_running":
          return dependencies.workbookAnalysisAssets.invoke(invocation);
        case "f3_running":
          return dependencies.dimensionTraceabilityReview.invoke(invocation);
        case "f4_running":
          return dependencies.tolerancePerformanceCalculation.invoke(invocation);
        case "f5_running":
          return dependencies.engineeringInterpretation.invoke(invocation);
        case "f6_running":
          return dependencies.improvementEvaluation.invoke(invocation);
        default:
          throw new Error(`Unsupported TA workbook stage: ${String(stage)}`);
      }
    },
    async runWorkbookScopeDiscovery(invocation) {
      return dependencies.workbookScopeDiscovery.invoke(invocation);
    },
    async runAnalysisInputValidation(invocation) {
      return dependencies.analysisInputValidation.invoke(invocation);
    },
  };
}
