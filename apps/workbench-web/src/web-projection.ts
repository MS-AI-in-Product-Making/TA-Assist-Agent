export interface ProjectedText {
  readonly displayText: string;
  readonly sourceText: string;
  readonly translated: boolean;
}

type FeatureId = "F0" | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7";

const FEATURE_LABELS: Record<FeatureId, string> = {
  F0: "Load Library",
  F1: "Extract Data",
  F2: "Check Inputs",
  F3: "Drawing Governance",
  F4: "Calculate TA",
  F5: "Interpret Results",
  F6: "Optimize Design",
  F7: "Apply Feedback",
};

const REASON_LABELS: Record<string, string> = {
  completed: "Completed",
  running: "Running",
  action_required: "Action required",
  failed: "Failed",
  cancelled: "Cancelled",
  pending: "Pending",
  feature_not_available: "In development",
  in_development: "In development",
  transient_error: "Reconnecting",
  evidence_mismatch: "Analysis data updated",
  calculation_not_possible: "Calculation unavailable",
  validation_error: "Workbook needs attention",
  prerequisite_not_ready: "Not ready",
  initial_scope_required: "Action required",
  downstream_scope_required: "Action required",
  ado_decision_required: "Action required",
  image_decision_required: "Action required",
  analysis_context_decision_required: "Action required",
  optimization_targets_decision_required: "Action required",
  review_required: "Action required",
  f7_import_required: "Pending",
  f7_preview_required: "Pending",
  feedback_review_required: "Pending",
  workbook_validating: "Running",
  f0_validating: "Running",
  f1_f2_running: "Running",
  f3_running: "Running",
  ado_action_pending: "Running",
  f4_running: "Running",
  f5_running: "Running",
  f6_running: "Running",
  f7_running: "Running",
  created: "Pending",
  workbook_required: "Pending",
  f0_validated: "Completed",
};

export function projectSourceText(sourceText: string, translation?: string): ProjectedText {
  const trimmedTranslation = translation?.trim();
  if (trimmedTranslation === undefined || trimmedTranslation.length === 0 || trimmedTranslation === sourceText) {
    return {
      displayText: sourceText,
      sourceText,
      translated: false,
    };
  }

  const translated = true;
  return {
    displayText: trimmedTranslation,
    sourceText,
    translated,
  };
}

export function featureDisplay(featureId: FeatureId): string {
  return FEATURE_LABELS[featureId] ?? featureId;
}

export function reasonDisplay(reasonCode: string): string {
  return REASON_LABELS[reasonCode] ?? titleCase(reasonCode);
}

function titleCase(reasonCode: string): string {
  return reasonCode
    .split(/[_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}