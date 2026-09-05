import type {
  DrawingGovernanceResultV2,
  F4ExcelComparisonResult,
  F4WorkflowCalculationResult,
  F2UserReport,
  F5DataInterpretationResult,
  F5ImageObservationArtifact,
  F6OptimizationResultV2,
  TypedError,
  WorksheetSelectionPrompt,
} from "@ai-assist/contracts";

export type WorkflowFeatureId = "F0" | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7";

export interface GovernedRunnerEvent {
  readonly kind: "stage_started" | "stage_completed" | "stage_failed" | "artifact_written";
  readonly featureId: WorkflowFeatureId;
  readonly stage: string;
  readonly timestamp: string;
  readonly path?: string;
  readonly detail?: string;
}

export interface RunContext {
  readonly attemptId: string;
  readonly repositoryRoot: string;
  readonly managedOutputRoot: string;
  readonly signal: AbortSignal;
  readonly emit: (event: GovernedRunnerEvent) => void;
}

export interface F0ValidationResult {
  readonly featureId: "F0";
  readonly status: "completed";
  readonly versions: readonly ["v1", "internal-v1", "interpretation-rules-v1"];
  readonly artifactRoot?: undefined;
}

export interface F1F2SelectionRequest {
  readonly workbookPath: string;
  readonly now?: () => Date;
}

export interface F1F2SelectionReference {
  readonly runId: string;
  readonly runRoot: string;
  readonly manifestPath: string;
  readonly promptPath: string;
}

export interface F1F2SelectionResult {
  readonly featureId: "F2";
  readonly status: "selectionRequired";
  readonly prompt: WorksheetSelectionPrompt;
  readonly workbookContentHash: string;
  readonly selectedWorksheetNames: readonly [];
  readonly runId: string;
  readonly runRoot: string;
  readonly f1Root: string;
  readonly f2Root: string;
  readonly validationRoot: string;
  readonly manifestPath: string;
  readonly promptPath: string;
  readonly selectionReference: F1F2SelectionReference;
}

export interface F1F2ConfirmedRequest {
  readonly workbookPath: string;
  readonly workbookContentHash: string;
  readonly selectedWorksheetNames: readonly string[];
  readonly selectionReference?: F1F2SelectionReference;
  readonly refreshF2?: boolean;
  readonly now?: () => Date;
}

export interface F1F2ConfirmedResult {
  readonly featureId: "F2";
  readonly status: "completed" | "partiallyBlocked";
  readonly workbookContentHash: string;
  readonly selectedWorksheetNames: readonly string[];
  readonly runId: string;
  readonly runRoot: string;
  readonly f1Root: string;
  readonly f2Root: string;
  readonly validationRoot: string;
  readonly manifestPath: string;
  readonly report: F2UserReport;
}

export interface F3AnalysisRequest {
  readonly artifactRoot: string;
  readonly selectedWorksheetNames?: readonly string[];
  readonly outputRoot?: string;
}

export interface F3AnalysisResult {
  readonly featureId: "F3";
  readonly status: DrawingGovernanceResultV2["status"];
  readonly selectedWorksheetNames?: readonly string[];
  readonly outputDirectory: string;
  readonly reportJsonPath: string;
  readonly reportMdPath: string;
  readonly reminderMdPath?: string;
  readonly historyHtmlPath?: string;
  readonly ado?: DrawingGovernanceResultV2 extends infer T ? T extends { ado: infer TAdo } ? TAdo : never : never;
  readonly report: DrawingGovernanceResultV2;
}

export interface F4CalculationRequest {
  readonly artifactRoot: string;
  readonly selectedWorksheetNames?: readonly string[];
  readonly workbookPath?: string;
  readonly outputRoot?: string;
  readonly generatedAt?: string;
}

export interface F4StructuredCalculation {
  readonly worksheetName: string;
  readonly tableId: string;
  readonly calculation: F4WorkflowCalculationResult["calculations"][number];
}

export interface F4CalculationResult {
  readonly featureId: "F4";
  readonly status: "completed" | "failed";
  readonly reasonCode?: string;
  readonly outputDirectory: string;
  readonly calculationJsonPath?: string;
  readonly comparisonJsonPath?: string;
  readonly reportMdPath?: string;
  readonly manifestPath: string;
  readonly acceptedCalculations?: readonly F4StructuredCalculation[];
  readonly extraCalculations?: readonly F4StructuredCalculation[];
  readonly calculationResult?: F4WorkflowCalculationResult;
  readonly comparisonResult?: F4ExcelComparisonResult;
  readonly summary?: F4WorkflowCalculationResult["summary"];
}

export interface F5InterpretationRequest {
  readonly f1ArtifactRoot: string;
  readonly f3ArtifactRoot: string;
  readonly f4ArtifactRoot: string;
  readonly selectedWorksheetNames?: readonly string[];
  readonly imageObservationsPath?: string;
}

export interface F5InterpretationResult {
  readonly featureId: "F5";
  readonly status: "completed" | "partially_completed" | "failed";
  readonly reasonCode?: string;
  readonly outputDirectory: string;
  readonly selectedWorksheetNames: readonly string[];
  readonly reportJsonPath?: string;
  readonly reportMdPath?: string;
  readonly runSummaryPath?: string;
  readonly manifestPath: string;
  readonly imageObservationsPath?: string;
  readonly report?: F5DataInterpretationResult;
  readonly observationArtifact?: F5ImageObservationArtifact;
  readonly summary?: F5DataInterpretationResult["summary"];
}

export interface F6OptimizationRequest {
  readonly f2ArtifactRoot: string;
  readonly f3ArtifactRoot: string;
  readonly f4ArtifactRoot: string;
  readonly f5ArtifactRoot: string;
  readonly selectedWorksheetNames: readonly string[];
  readonly supplierCapabilityPath?: string;
  readonly datumStrategyPath?: string;
  readonly costPath?: string;
  readonly imageObservationsPath?: string;
  readonly analysisContextPath?: string;
  readonly optimizationTargetsPath?: string;
  readonly modelInterpretationPath?: string;
}

export interface F6OptimizationResult {
  readonly featureId: "F6";
  readonly status: "completed" | "partially_completed" | "calculation_failed" | "failed";
  readonly reasonCode?: string;
  readonly outputDirectory: string;
  readonly optimizationJsonPath?: string;
  readonly optimizationMdPath?: string;
  readonly finalReportMdPath?: string;
  readonly runSummaryPath?: string;
  readonly manifestPath?: string;
  readonly optimization?: F6OptimizationResultV2;
  readonly finalReportProjection?: unknown;
  readonly inputDecisions?: {
    readonly analysisContext: { readonly outcome: string; readonly artifactReference?: { readonly artifact: string; readonly contentHash: string } };
    readonly optimizationTargets: { readonly outcome: string; readonly artifactReference?: { readonly artifact: string; readonly contentHash: string } };
    readonly modelInterpretation: { readonly outcome: string; readonly artifactReference?: { readonly artifact: string; readonly contentHash: string } };
  };
  readonly summary?: F6OptimizationResultV2["summary"];
}

export interface ExistingF6ValidationRequest {
  readonly publishRoot: string;
}

export interface ExistingF6ValidationResult {
  readonly status: "accepted" | "rejected";
  readonly reasonCode?: string;
  readonly outputDirectory?: string;
  readonly optimizationJsonPath?: string;
  readonly optimizationMarkdownPath?: string;
  readonly finalReportMarkdownPath?: string;
  readonly runSummaryPath?: string;
  readonly manifestPath?: string;
  readonly reportSummary?: unknown;
  readonly finalReportMarkdown?: string;
}

export interface F7PlaceholderOptions {
  readonly execute?: () => unknown;
}

export interface RunnerFailure {
  readonly status: "failed";
  readonly error: TypedError;
}