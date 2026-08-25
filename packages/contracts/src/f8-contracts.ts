import { z } from "zod";
import { worksheetSelectionConfirmationSchema, workbookCatalogFileNameSchema } from "./contracts.js";
import { typedErrorSchema } from "./errors.js";

const nonEmptyStringSchema = z.string().min(1);
const nonEmptyStringArraySchema = z.array(nonEmptyStringSchema);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const f8TypedErrorSchema = typedErrorSchema.strict();

export const f8SessionStateSchema = z.enum([
  "created",
  "workbook_required",
  "workbook_validating",
  "f0_validating",
  "f0_validated",
  "initial_scope_required",
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
]);

const f8ScenarioDraftStatusSchema = z.enum([
  "draft",
  "validating",
  "calculated",
  "calculation_failed",
  "saved",
  "promotion_pending",
  "promoted_to_f6_targets",
  "superseded",
  "deleted",
]);

const f8ScenarioDraftChangeSchema = z
  .object({
    nominalValue: z.number().finite().optional(),
    upperTolerance: z.number().finite().optional(),
    lowerTolerance: z.number().finite().optional(),
    additionalMeanShift: z.number().finite().optional(),
  })
  .strict()
  .superRefine((change, context) => {
    if (Object.values(change).every((value) => value === undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario draft changes must include at least one field" });
    }
  });

export const f8ScenarioDraftSchema = z
  .object({
    contractVersion: z.literal("f8-scenario-draft-v1"),
    draftId: nonEmptyStringSchema,
    sessionId: nonEmptyStringSchema,
    worksheetName: nonEmptyStringSchema,
    inputRevision: z.number().int().nonnegative(),
    status: f8ScenarioDraftStatusSchema,
    mode: z.literal("WHAT_IF"),
    baselineWorkbookHash: sha256Schema.optional(),
    baselineRunReference: nonEmptyStringSchema.optional(),
    change: f8ScenarioDraftChangeSchema.optional(),
    nominalValue: z.number().finite().optional(),
    upperTolerance: z.number().finite().optional(),
    lowerTolerance: z.number().finite().optional(),
    additionalMeanShift: z.number().finite().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((draft, context) => {
    if (draft.change === undefined
      && draft.nominalValue === undefined
      && draft.upperTolerance === undefined
      && draft.lowerTolerance === undefined
      && draft.additionalMeanShift === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario draft must include at least one editable field" });
    }
  });

const f8PriorRunReferenceSchema = z
  .object({
    featureId: z.enum(["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7"]),
    referenceId: nonEmptyStringSchema,
    contractVersion: nonEmptyStringSchema,
    workbookHash: sha256Schema.optional(),
    artifactId: nonEmptyStringSchema.optional(),
    runReference: nonEmptyStringSchema.optional(),
  })
  .strict();

const f8ReviewArtifactKindSchema = z.enum(["f1_image", "f3_report", "f4_calculation", "f4_report", "f5_report", "f6_optimization", "f6_report"]);

const f8ReviewArtifactRefSchema = z
  .object({
    artifactId: nonEmptyStringSchema,
    kind: f8ReviewArtifactKindSchema,
    revision: z.number().int().nonnegative(),
    validated: z.boolean(),
    reviewContextId: sha256Schema,
    sourceReferenceId: nonEmptyStringSchema.optional(),
  })
  .strict();

const f8NonReviewArtifactRefSchema = z
  .object({
    artifactId: nonEmptyStringSchema,
    kind: z.enum(["f2_report", "what_if_draft"]),
    revision: z.number().int().nonnegative(),
    validated: z.boolean(),
    sourceReferenceId: nonEmptyStringSchema.optional(),
  })
  .strict();

const f8ArtifactRefSchema = z.union([f8ReviewArtifactRefSchema, f8NonReviewArtifactRefSchema]);

const f8WorksheetCapabilitySchema = z
  .object({
    worksheetName: nonEmptyStringSchema,
    whatIfAvailable: z.boolean(),
  })
  .strict();

const f8StageAttemptSchema = z
  .object({
    attemptId: nonEmptyStringSchema,
    stage: f8SessionStateSchema,
    status: z.enum(["running", "completed", "failed", "cancelled"]),
    commandId: nonEmptyStringSchema.optional(),
    runReference: nonEmptyStringSchema.optional(),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
  })
  .strict();

const workbookUploadPayloadSchema = z
  .object({
    fileName: workbookCatalogFileNameSchema,
    workbookBytes: z.instanceof(Uint8Array).refine((workbookBytes) => workbookBytes.length > 0, {
      message: "workbookBytes must not be empty",
    }),
    inputClassification: z.literal("confidential"),
  })
  .strict();

const managedWorkbookUploadPayloadSchema = z
  .object({
    artifactId: nonEmptyStringSchema,
    inputClassification: z.literal("confidential"),
  })
  .strict();

const workbookReplacePayloadSchema = workbookUploadPayloadSchema.extend({
  previousWorkbookHash: sha256Schema,
}).strict();

const worksheetScopePayloadSchema = z
  .object({
    workbookHash: sha256Schema,
    worksheetNames: nonEmptyStringArraySchema.min(1),
  })
  .strict()
  .superRefine((payload, context) => {
    if (new Set(payload.worksheetNames).size !== payload.worksheetNames.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheetNames must be unique", path: ["worksheetNames"] });
    }
  });

const confirmationDecisionPayloadSchema = z
  .object({
    decision: nonEmptyStringSchema,
    worksheetNames: nonEmptyStringArraySchema.optional(),
    rationale: nonEmptyStringSchema.optional(),
    decisionReference: nonEmptyStringSchema.optional(),
  })
  .strict();

const adoDecisionPayloadSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("create_new"), rationale: nonEmptyStringSchema.optional() }).strict(),
  z.object({ decision: z.literal("use_existing"), rationale: nonEmptyStringSchema.optional() }).strict(),
  z.object({ decision: z.literal("local_only"), rationale: nonEmptyStringSchema.optional() }).strict(),
]);

const retryPayloadSchema = z
  .object({
    stage: f8SessionStateSchema,
    attemptId: nonEmptyStringSchema.optional(),
    reason: nonEmptyStringSchema.optional(),
  })
  .strict();

const cancelPayloadSchema = z
  .object({
    reason: nonEmptyStringSchema.optional(),
  })
  .strict();

const completeReviewPayloadSchema = z
  .object({
    confirmed: z.literal(true),
  })
  .strict();

const commandEnvelopeSchema = <T extends z.ZodTypeAny>(command: string, payloadSchema: T) => z
  .object({
    contractVersion: z.literal("f8-session-command-v1"),
    sessionId: nonEmptyStringSchema,
    commandId: nonEmptyStringSchema,
    expectedRevision: z.number().int().nonnegative(),
    command: z.literal(command),
    payload: payloadSchema,
  })
  .strict();

export const f8SessionCommandSchema = z.discriminatedUnion("command", [
  commandEnvelopeSchema("upload_workbook", z.union([workbookUploadPayloadSchema, managedWorkbookUploadPayloadSchema])),
  commandEnvelopeSchema("replace_workbook", workbookReplacePayloadSchema),
  commandEnvelopeSchema("confirm_initial_scope", worksheetScopePayloadSchema),
  commandEnvelopeSchema("confirm_downstream_scope", worksheetScopePayloadSchema),
  commandEnvelopeSchema("confirm_ado_decision", adoDecisionPayloadSchema),
  commandEnvelopeSchema("confirm_image_decision", confirmationDecisionPayloadSchema),
  commandEnvelopeSchema("confirm_analysis_context", confirmationDecisionPayloadSchema),
  commandEnvelopeSchema("confirm_optimization_targets", confirmationDecisionPayloadSchema),
  commandEnvelopeSchema("retry", retryPayloadSchema),
  commandEnvelopeSchema("cancel", cancelPayloadSchema),
  commandEnvelopeSchema("complete_review", completeReviewPayloadSchema),
]);

export const f8PublicSessionCommandSchema = z.discriminatedUnion("command", [
  commandEnvelopeSchema("upload_workbook", managedWorkbookUploadPayloadSchema),
  commandEnvelopeSchema("replace_workbook", workbookReplacePayloadSchema),
  commandEnvelopeSchema("confirm_initial_scope", worksheetScopePayloadSchema),
  commandEnvelopeSchema("confirm_downstream_scope", worksheetScopePayloadSchema),
  commandEnvelopeSchema("confirm_ado_decision", adoDecisionPayloadSchema),
  commandEnvelopeSchema("confirm_image_decision", confirmationDecisionPayloadSchema),
  commandEnvelopeSchema("confirm_analysis_context", confirmationDecisionPayloadSchema),
  commandEnvelopeSchema("confirm_optimization_targets", confirmationDecisionPayloadSchema),
  commandEnvelopeSchema("retry", retryPayloadSchema),
  commandEnvelopeSchema("cancel", cancelPayloadSchema),
  commandEnvelopeSchema("complete_review", completeReviewPayloadSchema),
]);

const conversationTextPartSchema = z
  .object({
    kind: z.literal("text"),
    text: nonEmptyStringSchema,
  })
  .strict();

const conversationMarkdownPartSchema = z
  .object({
    kind: z.literal("markdown"),
    markdown: nonEmptyStringSchema,
  })
  .strict();

const conversationArtifactPartSchema = z
  .object({
    kind: z.literal("artifact_reference"),
    artifactId: nonEmptyStringSchema,
    label: nonEmptyStringSchema.optional(),
  })
  .strict();

const conversationDecisionPartSchema = z
  .object({
    kind: z.literal("decision_reference"),
    decisionReference: nonEmptyStringSchema,
  })
  .strict();

const conversationCommandPartSchema = z
  .object({
    kind: z.literal("command"),
    commandId: nonEmptyStringSchema,
    command: nonEmptyStringSchema,
  })
  .strict();

const conversationToolActionSchema = z.union([
  z.object({ type: z.literal("navigate"), target: z.literal("/scope"), label: z.literal("选择 Worksheets") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/scope/downstream"), label: z.literal("确认下游 Worksheets") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/ado/preview"), label: z.literal("查看 ADO 预览") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/images/decision"), label: z.literal("确认图片上下文") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/analysis/context"), label: z.literal("确认 Analysis Context") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/optimization/targets"), label: z.literal("确认 Optimization Targets") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/review"), label: z.literal("完成评审") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/status"), label: z.literal("查看运行状态") }).strict(),
  z.object({
    type: z.literal("open_report"),
    target: z.literal("/report/current"),
    label: z.literal("打开当前报告"),
  }).strict(),
  z.object({
    type: z.literal("open_what_if"),
    target: z.literal("/what-if"),
    label: z.literal("打开 What-if Draft"),
  }).strict(),
]);

const conversationToolCommandSchema = z
  .object({
    id: nonEmptyStringSchema,
    kind: z.enum(["model_request", "surface_validate", "surface_write"]),
  })
  .strict();

const conversationToolResultPartSchema = z
  .object({
    kind: z.literal("tool_result"),
    actions: z.array(conversationToolActionSchema),
    commands: z.array(conversationToolCommandSchema),
  })
  .strict();

const conversationErrorPartSchema = z
  .object({
    kind: z.literal("error"),
    error: f8TypedErrorSchema,
  })
  .strict();

export const conversationContentPartSchema = z.union([
  conversationTextPartSchema,
  conversationMarkdownPartSchema,
  conversationArtifactPartSchema,
  conversationDecisionPartSchema,
  conversationCommandPartSchema,
  conversationToolResultPartSchema,
  conversationErrorPartSchema,
]);

export const conversationTurnSchema = z
  .object({
    contractVersion: z.literal("ta-conversation-turn-v1"),
    turnId: nonEmptyStringSchema,
    sessionId: nonEmptyStringSchema,
    sequence: z.number().int().nonnegative(),
    source: z.enum(["web", "vscode", "cli", "system"]),
    role: z.enum(["user", "assistant", "tool"]),
    content: z.array(conversationContentPartSchema),
    createdAt: z.string().datetime(),
    relatedStage: z.enum(["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7"]).optional(),
    relatedArtifactIds: z.array(nonEmptyStringSchema),
    decisionReference: nonEmptyStringSchema.optional(),
  })
  .strict();

const hostActionRequestBaseSchema = {
  contractVersion: z.literal("f8-host-action-request-v1"),
  actionId: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema,
  expectedRevision: z.number().int().nonnegative(),
  expiresAt: z.string().datetime(),
} as const;

export const hostActionRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    ...hostActionRequestBaseSchema,
    kind: z.literal("surface_validate"),
    confirmationHash: sha256Schema,
    expectedTargetVersion: nonEmptyStringSchema,
  }).strict(),
  z.object({
    ...hostActionRequestBaseSchema,
    kind: z.literal("surface_write"),
    validationActionId: nonEmptyStringSchema,
    confirmationHash: sha256Schema,
    expectedTargetVersion: nonEmptyStringSchema,
  }).strict(),
  z.object({
    ...hostActionRequestBaseSchema,
    kind: z.literal("model_request"),
  }).strict(),
]);

export const hostActionClaimSchema = z
  .object({
    contractVersion: z.literal("f8-host-action-claim-v1"),
    actionId: nonEmptyStringSchema,
    hostInstanceId: nonEmptyStringSchema,
    leaseId: nonEmptyStringSchema,
    leaseExpiresAt: z.string().datetime(),
  })
  .strict();

const hostActionResultPayloadSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("completed"),
  }).strict(),
  z.object({
    status: z.literal("blocked"),
    reason: nonEmptyStringSchema.optional(),
  }).strict(),
  z.object({
    status: z.literal("failed"),
    error: f8TypedErrorSchema,
  }).strict(),
]);

export const hostActionResultSchema = z
  .object({
    contractVersion: z.literal("f8-host-action-result-v1"),
    actionId: nonEmptyStringSchema,
    hostInstanceId: nonEmptyStringSchema,
    leaseId: nonEmptyStringSchema,
    status: z.enum(["completed", "blocked", "failed"]),
    resultHash: sha256Schema,
    payload: hostActionResultPayloadSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.status !== result.payload.status) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "host action result status must match payload status", path: ["payload", "status"] });
    }
  });

const sessionSnapshotUpdatedEventSchema = z
  .object({
    contractVersion: z.literal("f8-session-event-v1"),
    sessionId: nonEmptyStringSchema,
    revision: z.number().int().nonnegative(),
    eventId: nonEmptyStringSchema,
    kind: z.literal("snapshot_updated"),
    timestamp: z.string().datetime(),
    snapshot: z.lazy(() => f8SessionSnapshotSchema),
  })
  .strict();

const sessionCommandAcceptedEventSchema = z
  .object({
    contractVersion: z.literal("f8-session-event-v1"),
    sessionId: nonEmptyStringSchema,
    revision: z.number().int().nonnegative(),
    eventId: nonEmptyStringSchema,
    kind: z.literal("command_accepted"),
    timestamp: z.string().datetime(),
    command: z.lazy(() => f8SessionCommandSchema),
    activeAttempt: f8StageAttemptSchema.optional(),
  })
  .strict();

const sessionCommandRejectedEventSchema = z
  .object({
    contractVersion: z.literal("f8-session-event-v1"),
    sessionId: nonEmptyStringSchema,
    revision: z.number().int().nonnegative(),
    eventId: nonEmptyStringSchema,
    kind: z.literal("command_rejected"),
    timestamp: z.string().datetime(),
    commandId: nonEmptyStringSchema,
    error: f8TypedErrorSchema,
  })
  .strict();

const sessionStageStartedEventSchema = z
  .object({
    contractVersion: z.literal("f8-session-event-v1"),
    sessionId: nonEmptyStringSchema,
    revision: z.number().int().nonnegative(),
    eventId: nonEmptyStringSchema,
    kind: z.literal("stage_started"),
    timestamp: z.string().datetime(),
    stage: f8SessionStateSchema,
    attempt: f8StageAttemptSchema,
  })
  .strict();

const sessionStageCompletedEventSchema = z
  .object({
    contractVersion: z.literal("f8-session-event-v1"),
    sessionId: nonEmptyStringSchema,
    revision: z.number().int().nonnegative(),
    eventId: nonEmptyStringSchema,
    kind: z.literal("stage_completed"),
    timestamp: z.string().datetime(),
    stage: f8SessionStateSchema,
    attemptId: nonEmptyStringSchema,
    snapshot: z.lazy(() => f8SessionSnapshotSchema).optional(),
  })
  .strict();

const sessionStageFailedEventSchema = z
  .object({
    contractVersion: z.literal("f8-session-event-v1"),
    sessionId: nonEmptyStringSchema,
    revision: z.number().int().nonnegative(),
    eventId: nonEmptyStringSchema,
    kind: z.literal("stage_failed"),
    timestamp: z.string().datetime(),
    stage: f8SessionStateSchema,
    attemptId: nonEmptyStringSchema,
    error: f8TypedErrorSchema,
  })
  .strict();

const hostActionRequestedEventSchema = z
  .object({
    contractVersion: z.literal("f8-session-event-v1"),
    sessionId: nonEmptyStringSchema,
    revision: z.number().int().nonnegative(),
    eventId: nonEmptyStringSchema,
    kind: z.literal("host_action_requested"),
    timestamp: z.string().datetime(),
    hostAction: z.lazy(() => hostActionRequestSchema),
  })
  .strict();

const hostActionClaimedEventSchema = z
  .object({
    contractVersion: z.literal("f8-session-event-v1"),
    sessionId: nonEmptyStringSchema,
    revision: z.number().int().nonnegative(),
    eventId: nonEmptyStringSchema,
    kind: z.literal("host_action_claimed"),
    timestamp: z.string().datetime(),
    hostAction: z.lazy(() => hostActionClaimSchema),
  })
  .strict();

const hostActionResultedEventSchema = z
  .object({
    contractVersion: z.literal("f8-session-event-v1"),
    sessionId: nonEmptyStringSchema,
    revision: z.number().int().nonnegative(),
    eventId: nonEmptyStringSchema,
    kind: z.literal("host_action_resulted"),
    timestamp: z.string().datetime(),
    hostAction: z.lazy(() => hostActionResultSchema),
  })
  .strict();

const scenarioDraftUpdatedEventSchema = z
  .object({
    contractVersion: z.literal("f8-session-event-v1"),
    sessionId: nonEmptyStringSchema,
    revision: z.number().int().nonnegative(),
    eventId: nonEmptyStringSchema,
    kind: z.literal("scenario_draft_updated"),
    timestamp: z.string().datetime(),
    draft: z.lazy(() => f8ScenarioDraftSchema),
  })
  .strict();

export const f8SessionSnapshotSchema = z
  .object({
    contractVersion: z.literal("f8-session-snapshot-v1"),
    sessionId: nonEmptyStringSchema,
    revision: z.number().int().nonnegative(),
    inputRevision: z.number().int().nonnegative(),
    state: f8SessionStateSchema,
    activeAttempt: f8StageAttemptSchema.nullable(),
    priorRunReferences: z.array(f8PriorRunReferenceSchema),
    artifactRefs: z.array(f8ArtifactRefSchema).optional(),
    worksheetCapabilities: z.array(f8WorksheetCapabilitySchema).optional(),
    initialScopeSelection: worksheetSelectionConfirmationSchema.optional(),
    downstreamScopeSelection: worksheetSelectionConfirmationSchema.optional(),
    scenarioDrafts: z.array(z.lazy(() => f8ScenarioDraftSchema)).optional(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.priorRunReferences.some((reference) => reference.featureId === "F7" && reference.runReference === undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "F7 prior run references require a runReference" });
    }
    const draftIds = new Set<string>();
    snapshot.scenarioDrafts?.forEach((draft, index) => {
      if (draft.sessionId !== snapshot.sessionId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario drafts must belong to the snapshot session", path: ["scenarioDrafts", index, "sessionId"] });
      }
      if (draftIds.has(draft.draftId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario draft ids must be unique", path: ["scenarioDrafts", index, "draftId"] });
      }
      draftIds.add(draft.draftId);
    });
  });

export const f8SessionEventSchema = z.discriminatedUnion("kind", [
  sessionSnapshotUpdatedEventSchema,
  sessionCommandAcceptedEventSchema,
  sessionCommandRejectedEventSchema,
  sessionStageStartedEventSchema,
  sessionStageCompletedEventSchema,
  sessionStageFailedEventSchema,
  hostActionRequestedEventSchema,
  hostActionClaimedEventSchema,
  hostActionResultedEventSchema,
  scenarioDraftUpdatedEventSchema,
]);
