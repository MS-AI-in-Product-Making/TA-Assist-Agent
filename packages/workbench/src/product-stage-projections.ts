import { TA_WORKBOOK_STAGES, TA_WORKBOOK_STAGE_LABELS, projectTaWorkbookStage, type TaWorkbookStage } from "@ai-assist/product-language/ta-workbook-language";

import { FEATURE_IDS, type F8SessionSnapshot, type F8SessionState } from "./commands.js";

export interface ProductStageEntry {
  readonly stageId: TaWorkbookStage;
  readonly label: string;
  readonly status: string;
}

export interface TaProductStageProgress {
  readonly kind: "stage_started" | "stage_completed" | "stage_failed" | "artifact_written";
  readonly featureId: typeof FEATURE_IDS[number];
}

export function projectTaProductStages(snapshot: F8SessionSnapshot, progress?: TaProductStageProgress): ProductStageEntry[] {
  const activeStage = resolveActiveStage(snapshot, progress);
  if (activeStage === undefined) {
    const statusByIndex = snapshot.state === "failed" || snapshot.state === "cancelled"
      ? { prepare_workbook: "action_required", validate_analysis_inputs: "pending", review_dimension_traceability: "pending", calculate_and_interpret: "pending", evaluate_and_publish: "pending" }
      : { prepare_workbook: "pending", validate_analysis_inputs: "pending", review_dimension_traceability: "pending", calculate_and_interpret: "pending", evaluate_and_publish: "pending" };
    return TA_WORKBOOK_STAGES.map((stageId) => ({ stageId, label: TA_WORKBOOK_STAGE_LABELS[stageId], status: statusByIndex[stageId] }));
  }

  const activeIndex = TA_WORKBOOK_STAGES.indexOf(activeStage);
  return TA_WORKBOOK_STAGES.map((stageId, index) => ({
    stageId,
    label: TA_WORKBOOK_STAGE_LABELS[stageId],
    status: snapshot.state === "completed" ? "completed" : index < activeIndex ? "completed" : index === activeIndex ? stageStatus(snapshot.state, progress) : "pending",
  }));
}

function stageStatus(state: F8SessionState, progress?: TaProductStageProgress): string {
  if (progress?.kind === "stage_completed") return "completed";
  if (progress?.kind === "stage_failed") return "failed";
  if (progress?.kind === "stage_started") return "running";
  if (state === "failed" || state === "cancelled") return state;
  return ["initial_scope_required", "downstream_scope_required", "ado_decision_required", "image_decision_required", "analysis_context_decision_required", "optimization_targets_decision_required", "review_required"].includes(state)
    ? "action_required"
    : "running";
}

function resolveActiveStage(snapshot: F8SessionSnapshot, progress?: TaProductStageProgress): TaWorkbookStage | undefined {
  if (progress !== undefined && progress.kind !== "artifact_written") return stageForFeature(progress.featureId);
  if (snapshot.state === "failed" || snapshot.state === "cancelled") {
    return snapshot.activeAttempt?.stage === undefined ? undefined : projectTaWorkbookStage(snapshot.activeAttempt.stage);
  }
  return projectTaWorkbookStage(snapshot.state);
}

function stageForFeature(featureId: typeof FEATURE_IDS[number]): TaWorkbookStage {
  if (featureId === "F0") return "prepare_workbook";
  if (featureId === "F1" || featureId === "F2") return "validate_analysis_inputs";
  if (featureId === "F3") return "review_dimension_traceability";
  if (featureId === "F4" || featureId === "F5") return "calculate_and_interpret";
  return "evaluate_and_publish";
}