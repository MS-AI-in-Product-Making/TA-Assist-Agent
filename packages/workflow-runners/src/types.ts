import type {
  DrawingGovernanceResultV2,
  F2UserReport,
  TypedError,
  WorksheetSelectionPrompt,
} from "@ai-assist/contracts";

export type WorkflowFeatureId = "F0" | "F1" | "F2" | "F3" | "F7";

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
}

export interface F1F2ConfirmedRequest {
  readonly workbookPath: string;
  readonly workbookContentHash: string;
  readonly selectedWorksheetNames: readonly string[];
  readonly now?: () => Date;
}

export interface F1F2ConfirmedResult {
  readonly featureId: "F2";
  readonly status: "completed";
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

export interface F7PlaceholderOptions {
  readonly execute?: () => unknown;
}

export interface RunnerFailure {
  readonly status: "failed";
  readonly error: TypedError;
}