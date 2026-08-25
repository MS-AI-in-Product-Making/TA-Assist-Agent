import {
  createTypedError,
  f8SessionCommandSchema,
  f8SessionSnapshotSchema,
  f8SessionStateSchema,
} from "@ai-assist/contracts";

export type F8SessionCommand = ReturnType<typeof f8SessionCommandSchema.parse>;
export type F8SessionSnapshot = ReturnType<typeof f8SessionSnapshotSchema.parse>;
export type F8SessionState = ReturnType<typeof f8SessionStateSchema.parse>;
export type F8CommandKind = F8SessionCommand["command"];

export const FEATURE_IDS = ["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7"] as const;

export const RUNNING_STATES = new Set<F8SessionState>([
  "workbook_validating",
  "f0_validating",
  "f1_f2_running",
  "f3_running",
  "f4_running",
  "f5_running",
  "f6_running",
  "f7_running",
]);

export const COMMAND_ALLOWLIST: Record<F8SessionState, readonly F8CommandKind[]> = {
  created: ["upload_workbook"],
  workbook_required: ["upload_workbook"],
  workbook_validating: ["cancel"],
  f0_validating: ["cancel"],
  f0_validated: ["confirm_initial_scope", "replace_workbook"],
  initial_scope_required: ["confirm_initial_scope", "replace_workbook"],
  f1_f2_running: ["cancel"],
  downstream_scope_required: ["confirm_downstream_scope", "replace_workbook"],
  f3_running: ["cancel"],
  ado_decision_required: ["confirm_ado_decision", "replace_workbook"],
  ado_action_pending: ["cancel"],
  f4_running: ["cancel"],
  image_decision_required: ["confirm_image_decision", "replace_workbook"],
  f5_running: ["cancel"],
  analysis_context_decision_required: ["confirm_analysis_context", "replace_workbook"],
  optimization_targets_decision_required: ["confirm_optimization_targets", "replace_workbook"],
  f6_running: ["cancel"],
  review_required: ["complete_review", "replace_workbook"],
  f7_import_required: ["replace_workbook"],
  f7_preview_required: ["replace_workbook"],
  f7_running: ["cancel"],
  feedback_review_required: ["complete_review", "replace_workbook"],
  completed: ["replace_workbook"],
  failed: ["retry", "replace_workbook"],
  cancelled: ["retry", "replace_workbook"],
};

export function parseSnapshot(snapshot: F8SessionSnapshot): F8SessionSnapshot {
  return f8SessionSnapshotSchema.parse(snapshot);
}

export function parseCommand(command: F8SessionCommand): F8SessionCommand {
  return f8SessionCommandSchema.parse(command);
}

export function assertCommandAllowed(snapshot: F8SessionSnapshot, command: F8SessionCommand): void {
  const allowedCommands = COMMAND_ALLOWLIST[snapshot.state];
  if (allowedCommands.includes(command.command)) {
    return;
  }

  throw createTypedError({
    code: "validation_error",
    summary: `Command ${command.command} is not allowed while the session is in state ${snapshot.state}.`,
    suggestedAction: `Use one of the allowed commands for ${snapshot.state}: ${allowedCommands.join(", ") || "none"}.`,
    affectedInputReferences: [command.commandId, snapshot.state],
  });
}

export function isRunningState(state: F8SessionState): boolean {
  return RUNNING_STATES.has(state);
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}