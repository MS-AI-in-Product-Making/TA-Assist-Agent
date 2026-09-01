import { f7PlaceholderStatusSchema } from "@ai-assist/contracts";
import { TA_WORKBOOK_STAGES, TA_WORKBOOK_STAGE_LABELS, projectTaWorkbookStage, type TaWorkbookStage } from "@ai-assist/product-language";

import { canRetryAttempt } from "./attempts.js";
import { FEATURE_IDS, type F8SessionSnapshot, type F8SessionState } from "./commands.js";

export interface ActionQueueItem {
  readonly featureId: typeof FEATURE_IDS[number];
  readonly action: string;
  readonly blocking: boolean;
}

export interface FeatureLedgerEntry {
  readonly featureId: typeof FEATURE_IDS[number];
  readonly status: string;
  readonly lifecycle?: string;
  readonly actions: readonly string[];
}

export interface ProductStageEntry {
  readonly stageId: TaWorkbookStage;
  readonly label: string;
  readonly status: string;
}

export function projectActionQueue(snapshot: F8SessionSnapshot): ActionQueueItem[] {
  switch (snapshot.state) {
    case "analysis_context_decision_required":
      return [{ featureId: "F5", action: "confirm_analysis_context", blocking: true }];
    case "optimization_targets_decision_required":
      return [{ featureId: "F6", action: "confirm_optimization_targets", blocking: true }];
    case "ado_decision_required":
      return [{ featureId: "F3", action: "confirm_ado_decision", blocking: true }];
    case "image_decision_required":
      return [{ featureId: "F4", action: "confirm_image_decision", blocking: true }];
    case "initial_scope_required":
      return [{ featureId: "F1", action: "confirm_initial_scope", blocking: true }];
    case "downstream_scope_required":
      return [{ featureId: "F2", action: "confirm_downstream_scope", blocking: true }];
    case "review_required":
      return [{ featureId: "F6", action: "complete_review", blocking: false }];
    case "failed":
      return canRetryAttempt(snapshot) ? retryQueue(snapshot) : [];
    case "cancelled":
      return retryQueue(snapshot);
    case "f7_import_required":
    case "f7_preview_required":
    case "feedback_review_required":
    case "f7_running":
      return [];
    case "workbook_validating":
    case "f0_validating":
    case "f1_f2_running":
    case "f3_running":
    case "ado_action_pending":
    case "f4_running":
    case "f5_running":
    case "f6_running":
      return [{ featureId: featureForState(snapshot.state), action: "cancel", blocking: false }];
    case "created":
    case "workbook_required":
    case "f0_validated":
    case "completed":
      return [];
    default:
      return [];
  }
}

export function projectFeatureLedger(snapshot: F8SessionSnapshot): FeatureLedgerEntry[] {
  const completedFeatures = completedFeaturesForSnapshot(snapshot);
  const activeFeature = activeFeatureForSnapshot(snapshot);
  const queuedActions = projectActionQueue(snapshot);

  return FEATURE_IDS.map((featureId) => {
    if (featureId === "F7") {
      const placeholder = f7PlaceholderStatusSchema.parse({
        contractVersion: "f7-workbench-placeholder-v1",
        status: "feature_not_available",
        lifecycle: "in_development",
      });
      return {
        featureId,
        status: placeholder.status,
        lifecycle: placeholder.lifecycle,
        actions: [],
      };
    }

    if (activeFeature === featureId) {
      return {
        featureId,
        status: statusForActiveFeature(snapshot),
        actions: queuedActions.filter((item) => item.featureId === featureId).map((item) => item.action),
      };
    }

    if (completedFeatures.has(featureId)) {
      return { featureId, status: "completed", actions: [] };
    }

    return { featureId, status: "pending", actions: [] };
  });
}

function completedFeaturesForSnapshot(snapshot: F8SessionSnapshot): ReadonlySet<typeof FEATURE_IDS[number]> {
  if (snapshot.state === "failed" || snapshot.state === "cancelled") {
    const failedFeature = attemptFeatureForSnapshot(snapshot);
    if (failedFeature === undefined) {
      return new Set<typeof FEATURE_IDS[number]>();
    }

    return completedFeaturesBefore(failedFeature);
  }

  return completedFeaturesForState(snapshot.state);
}

function completedFeaturesForState(state: F8SessionState): ReadonlySet<typeof FEATURE_IDS[number]> {
  const completed = new Set<typeof FEATURE_IDS[number]>();

  if (state !== "created" && state !== "workbook_required" && state !== "workbook_validating" && state !== "f0_validating") {
    completed.add("F0");
  }
  if (["downstream_scope_required", "f3_running", "ado_decision_required", "ado_action_pending", "f4_running", "image_decision_required", "f5_running", "analysis_context_decision_required", "optimization_targets_decision_required", "f6_running", "review_required", "completed", "failed", "cancelled"].includes(state)) {
    completed.add("F1");
    completed.add("F2");
  }
  if (["f4_running", "image_decision_required", "f5_running", "analysis_context_decision_required", "optimization_targets_decision_required", "f6_running", "review_required", "completed", "failed", "cancelled"].includes(state)) {
    completed.add("F3");
  }
  if (["image_decision_required", "f5_running", "analysis_context_decision_required", "optimization_targets_decision_required", "f6_running", "review_required", "completed", "failed", "cancelled"].includes(state)) {
    completed.add("F4");
  }
  if (["analysis_context_decision_required", "optimization_targets_decision_required", "f6_running", "review_required", "completed", "failed", "cancelled"].includes(state)) {
    completed.add("F5");
  }
  if (["review_required", "completed"].includes(state)) {
    completed.add("F6");
  }

  return completed;
}

function completedFeaturesBefore(featureId: typeof FEATURE_IDS[number]): ReadonlySet<typeof FEATURE_IDS[number]> {
  const completed = new Set<typeof FEATURE_IDS[number]>();
  for (const candidate of FEATURE_IDS) {
    if (candidate === featureId) {
      break;
    }
    completed.add(candidate);
  }

  return completed;
}

function activeFeatureForSnapshot(snapshot: F8SessionSnapshot): typeof FEATURE_IDS[number] | undefined {
  if (snapshot.state === "completed") {
    return undefined;
  }

  if (snapshot.state === "failed" || snapshot.state === "cancelled") {
    return attemptFeatureForSnapshot(snapshot);
  }

  return featureForState(snapshot.state);
}

function attemptFeatureForSnapshot(snapshot: F8SessionSnapshot): typeof FEATURE_IDS[number] | undefined {
  const attemptStage = snapshot.activeAttempt?.stage;
  if (attemptStage === undefined) {
    return undefined;
  }

  return featureForState(attemptStage);
}

function statusForActiveFeature(snapshot: F8SessionSnapshot): string {
  if (snapshot.state === "failed" || snapshot.state === "cancelled") {
    return snapshot.state;
  }

  if (snapshot.state === "f7_import_required" || snapshot.state === "f7_preview_required" || snapshot.state === "feedback_review_required") {
    return "pending";
  }

  return "running";
}

function retryQueue(snapshot: F8SessionSnapshot): ActionQueueItem[] {
  const retryFeature = attemptFeatureForSnapshot(snapshot);
  if (retryFeature === undefined) {
    return [];
  }

  return [{ featureId: retryFeature, action: "retry", blocking: true }];
}

function featureForState(state: F8SessionState): typeof FEATURE_IDS[number] {
  switch (state) {
    case "workbook_validating":
    case "f0_validating":
      return "F0";
    case "initial_scope_required":
    case "f1_f2_running":
      return "F1";
    case "downstream_scope_required":
      return "F2";
    case "f3_running":
    case "ado_decision_required":
    case "ado_action_pending":
      return "F3";
    case "f4_running":
    case "image_decision_required":
      return "F4";
    case "f5_running":
    case "analysis_context_decision_required":
      return "F5";
    case "optimization_targets_decision_required":
    case "f6_running":
    case "review_required":
      return "F6";
    case "f7_import_required":
    case "f7_preview_required":
    case "f7_running":
    case "feedback_review_required":
    case "completed":
      return "F7";
    case "failed":
    case "cancelled":
    case "created":
    case "workbook_required":
    case "f0_validated":
      return "F0";
    default:
      return "F0";
  }
}

export function projectTaProductStages(snapshot: F8SessionSnapshot): ProductStageEntry[] {
  const activeStage = projectTaWorkbookStage(snapshot.state);
  const activeIndex = TA_WORKBOOK_STAGES.indexOf(activeStage);

  return TA_WORKBOOK_STAGES.map((stageId, index) => {
    let status = "pending";
    if (snapshot.state === "completed") {
      status = "completed";
    } else if (index < activeIndex) {
      status = "completed";
    } else if (index === activeIndex) {
      status = stageStatus(snapshot.state);
    }

    return {
      stageId,
      label: TA_WORKBOOK_STAGE_LABELS[stageId],
      status,
    };
  });
}

function stageStatus(state: F8SessionState): string {
  if (state === "failed" || state === "cancelled") {
    return state;
  }

  if ([
    "initial_scope_required",
    "downstream_scope_required",
    "ado_decision_required",
    "image_decision_required",
    "analysis_context_decision_required",
    "optimization_targets_decision_required",
    "review_required",
  ].includes(state)) {
    return "action_required";
  }

  return "running";
}