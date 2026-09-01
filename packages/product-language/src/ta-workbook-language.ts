const TA_STAGE_TO_INTERNAL_STATES = {
  prepare_workbook: ["created", "workbook_required", "workbook_validating", "initial_scope_required"],
  validate_analysis_inputs: ["f0_validating", "f0_validated", "f1_f2_running", "downstream_scope_required"],
  review_dimension_traceability: ["f3_running", "ado_decision_required", "ado_action_pending", "f4_running", "image_decision_required"],
  calculate_and_interpret: ["f5_running", "analysis_context_decision_required"],
  evaluate_and_publish: [
    "optimization_targets_decision_required",
    "f6_running",
    "review_required",
    "f7_import_required",
    "f7_preview_required",
    "f7_running",
    "feedback_review_required",
    "completed",
    "failed",
    "cancelled"
  ],
} as const;

export const TA_WORKBOOK_WORKFLOW = "TA Workbook Analysis";

export const TA_WORKBOOK_STAGES = [
  "prepare_workbook",
  "validate_analysis_inputs",
  "review_dimension_traceability",
  "calculate_and_interpret",
  "evaluate_and_publish",
] as const;

export const TA_WORKBOOK_STAGE_LABELS = {
  prepare_workbook: "Prepare workbook",
  validate_analysis_inputs: "Validate analysis inputs",
  review_dimension_traceability: "Review dimension traceability",
  calculate_and_interpret: "Calculate and interpret tolerance performance",
  evaluate_and_publish: "Evaluate improvement options and publish report",
} as const;

const INTERNAL_STATE_TO_STAGE = new Map<string, TaWorkbookStage>(
  Object.entries(TA_STAGE_TO_INTERNAL_STATES).flatMap(([stage, states]) =>
    states.map((state) => [state, stage as TaWorkbookStage]),
  ),
);

export type TaWorkbookStage = (typeof TA_WORKBOOK_STAGES)[number];

export function projectTaWorkbookStage(internalState: string): TaWorkbookStage {
  return INTERNAL_STATE_TO_STAGE.get(internalState) ?? "prepare_workbook";
}
