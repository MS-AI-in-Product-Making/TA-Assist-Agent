import {
  runF1F2Confirmed,
  runF1F2Selection,
  runF3Analysis,
  runF4Calculation,
  runF5Interpretation,
  runF6Optimization,
  validateF0Capabilities,
  type RunContext,
} from "@ai-assist/workflow-runners";
import {
  runtimeSkillMetadataFor,
  validateRuntimeSkillInvocation,
  type RuntimeSkillFacade,
  type RuntimeSkillInvocation,
  type RuntimeSkillResult,
} from "@ai-assist/workbench";

export interface TaRuntimeRunnerDependencies {
  readonly validateF0Capabilities?: typeof validateF0Capabilities;
  readonly runF1F2Selection?: typeof runF1F2Selection;
  readonly runF1F2Confirmed?: typeof runF1F2Confirmed;
  readonly runF3Analysis?: typeof runF3Analysis;
  readonly runF4Calculation?: typeof runF4Calculation;
  readonly runF5Interpretation?: typeof runF5Interpretation;
  readonly runF6Optimization?: typeof runF6Optimization;
}

interface RunnerRequest<Input, Output> {
  readonly metadataSkillId: string;
  readonly validate: {
    readonly requireWorksheetScope?: boolean;
    readonly requiredArtifactKinds?: readonly string[];
  };
  readonly execute: (invocation: RuntimeSkillInvocation<Input>) => Output | Promise<Output>;
}

interface ContextInvocation {
  readonly context: RunContext;
}

interface RequestContextInvocation<Request> extends ContextInvocation {
  readonly request: Request;
  readonly dependencies?: unknown;
}

function classifyRunnerStatus(output: unknown): RuntimeSkillResult<unknown>["status"] {
  if (typeof output !== "object" || output === null) {
    return "completed";
  }
  const status = (output as { readonly status?: unknown }).status;
  if (typeof status !== "string") {
    return "completed";
  }
  if (status === "failed") {
    return "failed";
  }
  if (
    status === "selectionRequired"
    || status === "partiallyBlocked"
    || status === "governance_required"
    || status === "input_rejected"
    || status === "partially_completed"
    || status === "calculation_failed"
  ) {
    return "blocked";
  }
  return "completed";
}

function createRunnerFacade<Input, Output>(request: RunnerRequest<Input, Output>): RuntimeSkillFacade<Input, Output> {
  const metadata = runtimeSkillMetadataFor(request.metadataSkillId);
  return {
    metadata,
    async invoke(invocation) {
      try {
        validateRuntimeSkillInvocation(invocation, request.validate);
        const output = await request.execute(invocation);
        const status = classifyRunnerStatus(output) as RuntimeSkillResult<Output>["status"];
        return {
          status,
          skillId: metadata.skillId,
          inputRevision: invocation.inputRevision,
          idempotencyKey: invocation.idempotencyKey,
          output,
        };
      } catch (error) {
        const summary = error instanceof Error ? error.message : "Runtime skill facade failed.";
        return {
          status: "failed",
          skillId: metadata.skillId,
          inputRevision: invocation.inputRevision,
          idempotencyKey: invocation.idempotencyKey,
          reasonCode: "runtime_skill_execution_failed",
          summary,
          error,
        };
      }
    },
  };
}

function pendingBoundaryFacade(skillId: string, reasonCode: string, summary: string): RuntimeSkillFacade<unknown, never> {
  const metadata = runtimeSkillMetadataFor(skillId);
  return {
    metadata,
    async invoke(invocation) {
      validateRuntimeSkillInvocation(invocation);
      return {
        status: "blocked",
        skillId: metadata.skillId,
        inputRevision: invocation.inputRevision,
        idempotencyKey: invocation.idempotencyKey,
        reasonCode,
        summary,
      };
    },
  };
}

export interface TaRuntimeSkillFacades {
  readonly knowledgeAndRulesValidation: RuntimeSkillFacade<ContextInvocation, ReturnType<typeof validateF0Capabilities>>;
  readonly workbookScopeDiscovery: RuntimeSkillFacade<RequestContextInvocation<Parameters<typeof runF1F2Selection>[0]>, ReturnType<typeof runF1F2Selection>>;
  readonly workbookAnalysisAssets: RuntimeSkillFacade<RequestContextInvocation<Parameters<typeof runF1F2Confirmed>[0]>, ReturnType<typeof runF1F2Confirmed>>;
  readonly analysisInputValidation: RuntimeSkillFacade<unknown, never>;
  readonly dimensionTraceabilityReview: RuntimeSkillFacade<RequestContextInvocation<Parameters<typeof runF3Analysis>[0]>, ReturnType<typeof runF3Analysis>>;
  readonly adoGovernancePublication: RuntimeSkillFacade<unknown, never>;
  readonly tolerancePerformanceCalculation: RuntimeSkillFacade<RequestContextInvocation<Parameters<typeof runF4Calculation>[0]>, ReturnType<typeof runF4Calculation>>;
  readonly engineeringInterpretation: RuntimeSkillFacade<RequestContextInvocation<Parameters<typeof runF5Interpretation>[0]>, ReturnType<typeof runF5Interpretation>>;
  readonly improvementEvaluation: RuntimeSkillFacade<RequestContextInvocation<Parameters<typeof runF6Optimization>[0]>, ReturnType<typeof runF6Optimization>>;
  readonly engineeringSummaryReport: RuntimeSkillFacade<unknown, never>;
  readonly taProductExport: RuntimeSkillFacade<unknown, never>;
}

export function createTaRuntimeSkillFacades(dependencies: TaRuntimeRunnerDependencies = {}): TaRuntimeSkillFacades {
  const f0 = dependencies.validateF0Capabilities ?? validateF0Capabilities;
  const f1f2Selection = dependencies.runF1F2Selection ?? runF1F2Selection;
  const f1f2Confirmed = dependencies.runF1F2Confirmed ?? runF1F2Confirmed;
  const f3 = dependencies.runF3Analysis ?? runF3Analysis;
  const f4 = dependencies.runF4Calculation ?? runF4Calculation;
  const f5 = dependencies.runF5Interpretation ?? runF5Interpretation;
  const f6 = dependencies.runF6Optimization ?? runF6Optimization;

  return {
    knowledgeAndRulesValidation: createRunnerFacade({
      metadataSkillId: "knowledge-and-rules-validation-v1",
      validate: {},
      execute: (invocation) => f0(invocation.input.context),
    }),
    workbookScopeDiscovery: createRunnerFacade({
      metadataSkillId: "workbook-scope-discovery-v1",
      validate: {},
      execute: (invocation) => f1f2Selection(invocation.input.request, invocation.input.context, invocation.input.dependencies as never),
    }),
    workbookAnalysisAssets: createRunnerFacade({
      metadataSkillId: "workbook-analysis-assets-v1",
      validate: { requireWorksheetScope: true },
      execute: (invocation) => f1f2Confirmed(invocation.input.request, invocation.input.context, invocation.input.dependencies as never),
    }),
    analysisInputValidation: pendingBoundaryFacade(
      "analysis-input-validation-v1",
      "delegated_by_workbook-analysis-assets",
      "F2 validation currently executes inside workbook-analysis-assets-v1.",
    ),
    dimensionTraceabilityReview: createRunnerFacade({
      metadataSkillId: "dimension-traceability-review-v1",
      validate: { requireWorksheetScope: true, requiredArtifactKinds: ["f2_report"] },
      execute: (invocation) => f3(invocation.input.request, invocation.input.context, invocation.input.dependencies as never),
    }),
    adoGovernancePublication: pendingBoundaryFacade(
      "ado-governance-publication-v1",
      "ado_write_boundary_not_configured",
      "ADO governed publication remains behind the Task 6 external-write protocol.",
    ),
    tolerancePerformanceCalculation: createRunnerFacade({
      metadataSkillId: "tolerance-performance-calculation-v1",
      validate: { requireWorksheetScope: true, requiredArtifactKinds: ["f2_report"] },
      execute: (invocation) => f4(invocation.input.request, invocation.input.context, invocation.input.dependencies as never),
    }),
    engineeringInterpretation: createRunnerFacade({
      metadataSkillId: "engineering-interpretation-v1",
      validate: { requireWorksheetScope: true, requiredArtifactKinds: ["f3_report", "f4_calculation"] },
      execute: (invocation) => f5(invocation.input.request, invocation.input.context, invocation.input.dependencies as never),
    }),
    improvementEvaluation: createRunnerFacade({
      metadataSkillId: "improvement-evaluation-v1",
      validate: { requireWorksheetScope: true, requiredArtifactKinds: ["f3_report", "f4_calculation", "f5_report"] },
      execute: (invocation) => f6(invocation.input.request, invocation.input.context, invocation.input.dependencies as never),
    }),
    engineeringSummaryReport: pendingBoundaryFacade(
      "engineering-summary-report-v1",
      "report_projection_not_configured",
      "Summary report projection is not wired in this task.",
    ),
    taProductExport: pendingBoundaryFacade(
      "ta-product-export-v1",
      "product_export_not_configured",
      "Product export wiring is not included in this task.",
    ),
  };
}
