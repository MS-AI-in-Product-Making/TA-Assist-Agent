export const TA_INTERNAL_WORKFLOW_STATES = [
  "created",
  "workbook_required",
  "workbook_validating",
  "initial_scope_required",
  "f0_validating",
  "f0_validated",
  "f1_f2_running",
  "downstream_scope_required",
  "f3_running",
  "ado_decision_required",
  "ado_action_pending",
  "f4_running",
  "image_decision_required",
  "f5_running",
  "analysis_context_decision_required",
  "optimization_targets_decision_required",
  "f6_running",
  "review_required",
  "f7_import_required",
  "f7_preview_required",
  "f7_running",
  "feedback_review_required",
  "completed",
  "failed",
  "cancelled",
] as const;

const TA_STAGE_TO_INTERNAL_STATES = {
  prepare_workbook: ["created", "workbook_required", "workbook_validating", "initial_scope_required"],
  validate_analysis_inputs: ["f0_validating", "f0_validated", "f1_f2_running", "downstream_scope_required"],
  review_dimension_traceability: ["f3_running", "ado_decision_required", "ado_action_pending"],
  calculate_and_interpret: ["f4_running", "image_decision_required", "f5_running", "analysis_context_decision_required"],
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

export const TA_PRODUCT_CAPABILITIES = [
  { internalId: "F0", skillName: "knowledge-library", englishLabel: "Knowledge Library", chineseLabel: "知识库" },
  { internalId: "F1", skillName: "data-parsing", englishLabel: "Data Parsing", chineseLabel: "数据解析" },
  { internalId: "F2", skillName: "data-cleaning", englishLabel: "Data Cleaning", chineseLabel: "数据清洗" },
  { internalId: "F3", skillName: "drawing-governance", englishLabel: "Drawing Governance", chineseLabel: "图纸治理" },
  { internalId: "F4", skillName: "ta-calculation", englishLabel: "TA Calculation", chineseLabel: "TA 计算" },
  { internalId: "F5", skillName: "result-interpretation", englishLabel: "Result Interpretation", chineseLabel: "结果解读" },
  { internalId: "F6", skillName: "design-optimization", englishLabel: "Design Optimization", chineseLabel: "设计优化" },
  { internalId: "F7", skillName: "feedback-application", englishLabel: "Feedback Application", chineseLabel: "反馈应用" },
] as const;

const INTERNAL_STATE_TO_STAGE = new Map<string, TaWorkbookStage>(
  Object.entries(TA_STAGE_TO_INTERNAL_STATES).flatMap(([stage, states]) =>
    states.map((state) => [state, stage as TaWorkbookStage]),
  ),
);

export type TaWorkbookStage = (typeof TA_WORKBOOK_STAGES)[number];
export type TaProductCapabilityId = (typeof TA_PRODUCT_CAPABILITIES)[number]["internalId"];
export type UserLanguage = "en" | "zh";

export function projectTaWorkbookStage(internalState: string): TaWorkbookStage {
  return INTERNAL_STATE_TO_STAGE.get(internalState) ?? "prepare_workbook";
}

export function productCapabilityLabel(internalId: TaProductCapabilityId, language: UserLanguage): string {
  const capability = TA_PRODUCT_CAPABILITIES.find((entry) => entry.internalId === internalId);
  return language === "zh" ? capability?.chineseLabel ?? internalId : capability?.englishLabel ?? internalId;
}

const LEGACY_CAPABILITY_REFERENCE = /\b(?:Feature[ _-]?([0-7])|F([0-7]))\b/giu;

export function resolveProductCapabilityReference(text: string): TaProductCapabilityId | undefined {
  const match = LEGACY_CAPABILITY_REFERENCE.exec(text);
  LEGACY_CAPABILITY_REFERENCE.lastIndex = 0;
  const capabilityNumber = match?.[1] ?? match?.[2];
  return capabilityNumber === undefined ? undefined : `F${capabilityNumber}` as TaProductCapabilityId;
}

export function projectProductCapabilityReferences(text: string, language: UserLanguage): string {
  return text.replace(LEGACY_CAPABILITY_REFERENCE, (_match, featureNumber: string | undefined, shortNumber: string | undefined) =>
    productCapabilityLabel(`F${featureNumber ?? shortNumber}` as TaProductCapabilityId, language));
}

export function detectUserLanguage(text: string): UserLanguage {
  return /\p{Script=Han}/u.test(text) ? "zh" : "en";
}
