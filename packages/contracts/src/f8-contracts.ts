import { z } from "zod";
import type { InteractionLanguage } from "@ai-assist/product-language";
import { distributionSchema, f6InputProposalSchema, f6OptimizationTargetsSchema, worksheetSelectionConfirmationSchema, workbookCatalogFileNameSchema } from "./contracts.js";
import { typedErrorSchema } from "./errors.js";
import { f5MultimodalWorksheetRequestV3Schema, f5MultimodalWorksheetResultV3Schema } from "./ta-multimodal-contracts.js";

const nonEmptyStringSchema = z.string().min(1);
const nonEmptyStringArraySchema = z.array(nonEmptyStringSchema);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const f8TypedErrorSchema = typedErrorSchema.strict();
const SUPPORTED_GOVERNED_IMAGE_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const CREDENTIAL_LIKE_PATTERN = /\b(?:Authorization\s*[:=]\s*(?:Bearer\s+)?[^\s;|<>{}"'`]+|Bearer\s+[A-Za-z0-9._~+/=-]{6,}|(?:password|token|access[ _-]?token|secret(?:s)?|api[ _-]?key)\s*[:=]\s*[^\s;|<>{}"'`]+)/iu;

function containsLocalFilesystemPath(value: string): boolean {
  const normalized = value.trim();
  return /(?:^|[^A-Za-z0-9])(?:[A-Za-z]:[\\/](?![\\/])|\\\\[^\\/]+[\\/][^\\/]+|file:\/\/|\/(?:Users|home|var|tmp|private|opt|mnt)\/)/.test(normalized);
}

function containsCredentialLikePromptText(value: string): boolean {
  return CREDENTIAL_LIKE_PATTERN.test(value.trim());
}

function rejectLocalFilesystemPath(value: string, context: z.RefinementCtx, message: string): void {
  if (containsLocalFilesystemPath(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message });
  }
}

const boundedContextIdSchema = z.string().trim().min(1).max(160).superRefine((value, context) => {
  rejectLocalFilesystemPath(value, context, "local filesystem paths are not allowed in identity strings");
});
const boundedContextNameSchema = z.string().trim().min(1).max(160).superRefine((value, context) => {
  rejectLocalFilesystemPath(value, context, "local filesystem paths are not allowed in identity strings");
});
const boundedContextUnitSchema = z.string().trim().min(1).max(32);

const promptVisibleIdentitySchema = nonEmptyStringSchema.superRefine((value, context) => {
  rejectLocalFilesystemPath(value, context, "local filesystem paths are not allowed in identity strings");
});

const boundedContextTextSchema = z.string().trim().min(1).max(280).superRefine((value, context) => {
  if (containsLocalFilesystemPath(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "local filesystem paths are not allowed in model context text" });
  }
  if (containsCredentialLikePromptText(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "credential-like strings are not allowed in model context text" });
  }
});

const taWorksheetContextSchema = z.object({
  worksheetName: boundedContextNameSchema,
  tableId: boundedContextIdSchema.optional(),
  sourceRow: z.number().int().positive().optional(),
  factorName: boundedContextNameSchema.optional(),
  calculationReference: boundedContextIdSchema.optional(),
}).strict().superRefine((worksheet, context) => {
  const hasAnyFactorIdentity = worksheet.tableId !== undefined || worksheet.sourceRow !== undefined || worksheet.factorName !== undefined;
  if (hasAnyFactorIdentity && (worksheet.tableId === undefined || worksheet.sourceRow === undefined || worksheet.factorName === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet factor identity must include tableId, sourceRow, and factorName together" });
  }
});

const taF0CapabilityStatusSchema = z.enum([
  "in_library_recommended",
  "in_library_tolerance_outside",
  "in_library_distribution_differs",
  "in_library_tolerance_and_distribution_differ",
  "outside_library",
  "internal_within_guidance",
  "internal_guidance_exceeded",
  "f0_information_insufficient",
  "non_f0_process_category",
  "unable_to_check",
]);

const taF0InformationReasonSchema = z.enum(["missing_process_context", "invalid_total_band", "guidance_unknown"]);

const taKnowledgeRecommendationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("public"),
    capabilityEntryId: boundedContextIdSchema,
    toleranceMin: z.number().finite(),
    toleranceMax: z.number().finite(),
    unit: z.literal("mm"),
    distribution: distributionSchema,
  }).strict(),
  z.object({
    kind: z.literal("internal-guidance"),
    assessedTotalBand: z.number().finite().positive(),
    maximumRecommendedTotalBand: z.number().finite().positive(),
    unit: z.literal("mm"),
    matchedEntryId: boundedContextIdSchema,
    sourceFileHash: sha256Schema,
  }).strict(),
]);

const taKnowledgeContextItemSchema = z.object({
  inputRevision: z.number().int().nonnegative(),
  worksheetName: boundedContextNameSchema,
  tableId: boundedContextIdSchema,
  sourceRow: z.number().int().positive(),
  factorName: boundedContextNameSchema,
  capabilityStatus: taF0CapabilityStatusSchema,
  f0KnowledgeBaseVersion: z.enum(["v1", "internal-v1"]).optional(),
  summary: boundedContextTextSchema,
  recommendation: taKnowledgeRecommendationSchema.optional(),
  f0InformationReason: taF0InformationReasonSchema.optional(),
}).strict().superRefine((item, context) => {
  const publicMatch = item.capabilityStatus.startsWith("in_library_");
  const internalMatch = item.capabilityStatus === "internal_within_guidance" || item.capabilityStatus === "internal_guidance_exceeded";
  if (publicMatch && (item.f0KnowledgeBaseVersion !== "v1" || item.recommendation?.kind !== "public")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "public F0 knowledge items require a v1 public recommendation", path: ["recommendation"] });
  }
  if (internalMatch && (item.f0KnowledgeBaseVersion !== "internal-v1" || item.recommendation?.kind !== "internal-guidance")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "internal F0 knowledge items require an internal-v1 recommendation", path: ["recommendation"] });
  }
  if (!publicMatch && !internalMatch && item.recommendation !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "unmatched F0 knowledge items must not include a recommendation", path: ["recommendation"] });
  }
  if (item.capabilityStatus === "f0_information_insufficient") {
    if (item.f0KnowledgeBaseVersion !== "internal-v1" || item.f0InformationReason === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "insufficient F0 knowledge items require an internal-v1 information reason", path: ["f0InformationReason"] });
    }
  } else if (item.f0InformationReason !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "only insufficient F0 knowledge items may include an information reason", path: ["f0InformationReason"] });
  }
  if ((item.capabilityStatus === "non_f0_process_category" || item.capabilityStatus === "unable_to_check") && item.f0KnowledgeBaseVersion !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "knowledge items without an F0 decision must not claim an F0 version", path: ["f0KnowledgeBaseVersion"] });
  }
});

const taArtifactContextReferenceSchema = z.object({
  artifactId: boundedContextIdSchema,
  kind: z.literal("f1_image"),
  inputRevision: z.number().int().nonnegative(),
  worksheetName: boundedContextNameSchema,
  contentHash: sha256Schema,
  mediaType: z.string().superRefine((value, context) => {
    if (!SUPPORTED_GOVERNED_IMAGE_MEDIA_TYPES.has(value)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "only supported F1 image media types are allowed in model context" });
    }
  }),
  description: boundedContextTextSchema.optional(),
}).strict();

const taFactorContextRowSchema = z.object({
  inputRevision: z.number().int().nonnegative(),
  worksheetName: boundedContextNameSchema,
  tableId: boundedContextIdSchema,
  sourceRow: z.number().int().positive(),
  factorName: boundedContextNameSchema,
  partName: boundedContextNameSchema.optional(),
  unit: boundedContextUnitSchema,
  nominalValue: z.number().finite(),
  upperTolerance: z.number().finite(),
  lowerTolerance: z.number().finite(),
  distribution: distributionSchema.optional(),
  mean: z.number().finite().optional(),
  tolerance: z.number().finite().nonnegative().optional(),
  oneSigma: z.number().finite().nonnegative().optional(),
  contribution: z.number().finite().nonnegative().optional(),
  notes: boundedContextTextSchema.optional(),
}).strict();

const taMetricContextSchema = z.object({
  inputRevision: z.number().int().nonnegative(),
  calculationReference: boundedContextIdSchema,
  mean: z.number().finite(),
  rssSigma: z.number().finite().nonnegative(),
  cp: z.number().finite(),
  cpkL: z.number().finite(),
  cpkU: z.number().finite(),
  cpk: z.number().finite(),
  statisticalMargin: z.number().finite(),
  worstCaseMargin: z.number().finite(),
  lowerSpecLimit: z.number().finite().optional(),
  upperSpecLimit: z.number().finite().optional(),
  meanShift: z.number().finite().optional(),
  yield: z.number().finite().optional(),
  dpm: z.number().finite().nonnegative().optional(),
  statisticalLower: z.number().finite().optional(),
  statisticalUpper: z.number().finite().optional(),
  worstCaseLower: z.number().finite().optional(),
  worstCaseUpper: z.number().finite().optional(),
}).strict();

export const taModelContextEnvelopeSchema = z.object({
  contractVersion: z.literal("ta-model-context-envelope-v1"),
  session: z.object({
    sessionId: boundedContextIdSchema,
    revision: z.number().int().nonnegative(),
  }).strict(),
  inputRevision: z.number().int().nonnegative(),
  worksheet: taWorksheetContextSchema,
  f0Knowledge: z.array(taKnowledgeContextItemSchema).max(128),
  toleranceLoopImage: taArtifactContextReferenceSchema.optional(),
  factorTable: z.array(taFactorContextRowSchema).max(256),
  baselineMetrics: taMetricContextSchema.optional(),
  scenarioMetrics: taMetricContextSchema.optional(),
  relatedArtifactIds: z.array(boundedContextIdSchema).max(16),
}).strict().superRefine((envelope, context) => {
  if (new Set(envelope.relatedArtifactIds).size !== envelope.relatedArtifactIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "relatedArtifactIds must be unique", path: ["relatedArtifactIds"] });
  }

  const factorKeys = new Set<string>();
  envelope.factorTable.forEach((row, index) => {
    if (row.inputRevision !== envelope.inputRevision) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "factor rows must match the envelope inputRevision", path: ["factorTable", index, "inputRevision"] });
    }
    if (row.worksheetName !== envelope.worksheet.worksheetName) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "factor rows must belong to the envelope worksheet", path: ["factorTable", index, "worksheetName"] });
    }
    const key = `${row.worksheetName}::${row.tableId}::${row.sourceRow}`;
    if (factorKeys.has(key)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate factor rows are not allowed in model context", path: ["factorTable", index] });
    }
    factorKeys.add(key);
  });

  envelope.f0Knowledge.forEach((item, index) => {
    if (item.inputRevision !== envelope.inputRevision) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "F0 knowledge items must match the envelope inputRevision", path: ["f0Knowledge", index, "inputRevision"] });
    }
    if (item.worksheetName !== envelope.worksheet.worksheetName) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "F0 knowledge items must belong to the envelope worksheet", path: ["f0Knowledge", index, "worksheetName"] });
    }
  });

  if (envelope.toleranceLoopImage !== undefined) {
    if (envelope.toleranceLoopImage.inputRevision !== envelope.inputRevision) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "toleranceLoopImage must match the envelope inputRevision", path: ["toleranceLoopImage", "inputRevision"] });
    }
    if (envelope.toleranceLoopImage.worksheetName !== envelope.worksheet.worksheetName) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "toleranceLoopImage must belong to the envelope worksheet", path: ["toleranceLoopImage", "worksheetName"] });
    }
    if (!envelope.relatedArtifactIds.includes(envelope.toleranceLoopImage.artifactId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "toleranceLoopImage artifactId must be listed in relatedArtifactIds", path: ["toleranceLoopImage", "artifactId"] });
    }
  }

  if (envelope.baselineMetrics?.inputRevision !== undefined && envelope.baselineMetrics.inputRevision !== envelope.inputRevision) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "baselineMetrics must match the envelope inputRevision", path: ["baselineMetrics", "inputRevision"] });
  }
  if (envelope.scenarioMetrics?.inputRevision !== undefined && envelope.scenarioMetrics.inputRevision !== envelope.inputRevision) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "scenarioMetrics must match the envelope inputRevision", path: ["scenarioMetrics", "inputRevision"] });
  }
  if (envelope.scenarioMetrics !== undefined && envelope.worksheet.calculationReference !== undefined && envelope.scenarioMetrics.calculationReference !== envelope.worksheet.calculationReference) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "scenarioMetrics calculationReference must match the worksheet calculationReference", path: ["scenarioMetrics", "calculationReference"] });
  }

  if (envelope.worksheet.tableId !== undefined && envelope.worksheet.sourceRow !== undefined && envelope.worksheet.factorName !== undefined) {
    const selectedFactorExists = envelope.factorTable.some((row) => row.tableId === envelope.worksheet.tableId && row.sourceRow === envelope.worksheet.sourceRow && row.factorName === envelope.worksheet.factorName);
    if (!selectedFactorExists) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet factor identity must match a factor row in the envelope", path: ["worksheet"] });
    }
  }
});

export type TaModelContextEnvelope = z.infer<typeof taModelContextEnvelopeSchema>;

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

const f8WhatIfMetricsSchema = z.object({
  mean: z.number().finite(),
  rssSigma: z.number().finite().nonnegative(),
  cp: z.number().finite(),
  cpkL: z.number().finite(),
  cpkU: z.number().finite(),
  cpk: z.number().finite(),
  statisticalMargin: z.number().finite(),
  worstCaseMargin: z.number().finite(),
  lowerSpecLimit: z.number().finite().optional(),
  upperSpecLimit: z.number().finite().optional(),
  meanShift: z.number().finite().optional(),
  yield: z.number().finite().optional(),
  dpm: z.number().finite().nonnegative().optional(),
  statisticalLower: z.number().finite().optional(),
  statisticalUpper: z.number().finite().optional(),
  worstCaseLower: z.number().finite().optional(),
  worstCaseUpper: z.number().finite().optional(),
}).strict();

const f8ScenarioFactorOverrideSchema = z.object({
  worksheetName: boundedContextNameSchema,
  tableId: boundedContextIdSchema,
  sourceRow: z.number().int().positive(),
  nominalValue: z.number().finite().optional(),
  upperTolerance: z.number().finite().optional(),
  lowerTolerance: z.number().finite().optional(),
}).strict();

const f8ScenarioSystemOverrideSchema = z.object({
  lowerSpecLimit: z.number().finite().optional(),
  upperSpecLimit: z.number().finite().optional(),
  additionalMeanShift: z.number().finite().optional(),
}).strict();

export const f8ScenarioDraftSchema = z
  .object({
    contractVersion: z.literal("f8-scenario-draft-v1"),
    draftId: promptVisibleIdentitySchema,
    sessionId: promptVisibleIdentitySchema,
    worksheetName: boundedContextNameSchema,
    inputRevision: z.number().int().nonnegative(),
    status: f8ScenarioDraftStatusSchema,
    mode: z.literal("WHAT_IF"),
    baselineWorkbookHash: sha256Schema.optional(),
    baselineRunReference: promptVisibleIdentitySchema.optional(),
    calculationReference: boundedContextIdSchema.optional(),
    calculationMetrics: f8WhatIfMetricsSchema.optional(),
    factorResults: z.array(z.object({ worksheetName: boundedContextNameSchema, tableId: boundedContextIdSchema, sourceRow: z.number().int().positive(), mean: z.number().finite(), tolerance: z.number().finite().nonnegative(), oneSigma: z.number().finite().nonnegative(), contribution: z.number().finite().nonnegative() }).strict()).optional(),
    factorOverrides: z.array(f8ScenarioFactorOverrideSchema).optional(),
    systemSpecification: f8ScenarioSystemOverrideSchema.optional(),
    factorIdentity: z.object({
      worksheetName: boundedContextNameSchema,
      tableId: boundedContextIdSchema,
      sourceRow: z.number().int().positive(),
      factorName: boundedContextNameSchema,
      unit: nonEmptyStringSchema,
    }).strict().optional(),
    promotionPreview: f6OptimizationTargetsSchema.optional(),
    change: f8ScenarioDraftChangeSchema.optional(),
    nominalValue: z.number().finite().optional(),
    upperTolerance: z.number().finite().optional(),
    lowerTolerance: z.number().finite().optional(),
    additionalMeanShift: z.number().finite().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((draft, context) => {
    if (draft.change === undefined && (draft.factorOverrides?.length ?? 0) === 0 && draft.systemSpecification === undefined
      && draft.nominalValue === undefined
      && draft.upperTolerance === undefined
      && draft.lowerTolerance === undefined
      && draft.additionalMeanShift === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario draft must include at least one editable field" });
    }
  });

export type F8ScenarioDraft = z.infer<typeof f8ScenarioDraftSchema>;

const f8PendingF6InputDraftKindSchema = z.enum(["analysis_context", "optimization_targets"]);

const f8PendingF6InputDraftBaseSchema = z.object({
  draftId: promptVisibleIdentitySchema,
  kind: f8PendingF6InputDraftKindSchema,
  inputRevision: z.number().int().nonnegative(),
  reviewContextId: sha256Schema,
  artifactId: boundedContextIdSchema,
  contentHash: sha256Schema,
  status: z.literal("preview_required"),
}).strict();

export const f8PendingF6InputDraftSchema = f8PendingF6InputDraftBaseSchema;
export type F8PendingF6InputDraft = z.infer<typeof f8PendingF6InputDraftSchema>;

const f8PriorRunReferenceSchema = z
  .object({
    featureId: z.enum(["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7"]),
    referenceId: promptVisibleIdentitySchema,
    contractVersion: nonEmptyStringSchema,
    workbookHash: sha256Schema.optional(),
    artifactId: boundedContextIdSchema.optional(),
    runReference: promptVisibleIdentitySchema.optional(),
  })
  .strict();

const f8ReviewArtifactKindSchema = z.enum(["f1_image", "f3_report", "f4_calculation", "f4_report", "f5_report", "f6_optimization", "f6_report"]);

const f8ReviewArtifactRefSchema = z
  .object({
    artifactId: boundedContextIdSchema,
    kind: f8ReviewArtifactKindSchema,
    revision: z.number().int().nonnegative(),
    validated: z.boolean(),
    reviewContextId: sha256Schema,
    sourceReferenceId: promptVisibleIdentitySchema.optional(),
  })
  .strict();

const f8NonReviewArtifactRefSchema = z
  .object({
    artifactId: boundedContextIdSchema,
    kind: z.enum(["f2_report", "what_if_draft", "f6_optimization_markdown", "f6_run_summary", "f6_manifest"]),
    revision: z.number().int().nonnegative(),
    validated: z.boolean(),
    sourceReferenceId: promptVisibleIdentitySchema.optional(),
  })
  .strict();

const f8ArtifactRefSchema = z.union([f8ReviewArtifactRefSchema, f8NonReviewArtifactRefSchema]);

const f8WorksheetCapabilitySchema = z
  .object({
    worksheetName: boundedContextNameSchema,
    whatIfAvailable: z.boolean(),
  })
  .strict();

const f8StageAttemptSchema = z
  .object({
    attemptId: promptVisibleIdentitySchema,
    stage: f8SessionStateSchema,
    status: z.enum(["running", "completed", "failed", "cancelled"]),
    commandId: promptVisibleIdentitySchema.optional(),
    runReference: promptVisibleIdentitySchema.optional(),
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
    managedArtifactId: nonEmptyStringSchema.optional(),
  })
  .strict();

const managedWorkbookUploadPayloadSchema = z
  .object({
    artifactId: boundedContextIdSchema,
    inputClassification: z.literal("confidential"),
  })
  .strict();

const workbookReplacePayloadSchema = workbookUploadPayloadSchema.extend({
  previousWorkbookHash: sha256Schema,
}).strict();

const managedWorkbookReplacePayloadSchema = managedWorkbookUploadPayloadSchema.extend({
  previousWorkbookHash: sha256Schema,
}).strict();

const worksheetScopePayloadBaseSchema = z
  .object({
    workbookHash: sha256Schema,
    worksheetNames: z.array(boundedContextNameSchema).min(1),
  })
  .strict();

const withUniqueWorksheetNames = <T extends z.ZodTypeAny>(schema: T) => schema.superRefine((payload, context) => {
  const worksheetNames = (payload as { worksheetNames?: unknown }).worksheetNames;
  if (!Array.isArray(worksheetNames)) {
    return;
  }
  if (new Set(worksheetNames).size !== worksheetNames.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheetNames must be unique", path: ["worksheetNames"] });
  }
});

const worksheetScopePayloadSchema = withUniqueWorksheetNames(worksheetScopePayloadBaseSchema);

const worksheetDecisionProvenanceSchema = z.enum(["user", "internal_fixture"]);
const worksheetSnapshotProvenanceSchema = z.enum(["user", "internal_fixture", "legacy_unverified"]);
const interactionLanguageSchema: z.ZodType<InteractionLanguage> = z.object({
  languageTag: nonEmptyStringSchema,
  uiCatalogLanguage: z.enum(["en", "zh"]),
  lockedAtTurnId: promptVisibleIdentitySchema,
  source: z.enum(["workflow_start", "explicit_user_change", "legacy_fallback"]),
  fallbackUsed: z.boolean(),
}).strict();

const worksheetScopeInternalPayloadSchema = withUniqueWorksheetNames(worksheetScopePayloadBaseSchema
  .extend({
    provenance: worksheetDecisionProvenanceSchema.optional(),
  })
  .strict());

export interface ConfirmDownstreamScopeInternalPayload {
  readonly decision: "continue_ready";
  readonly workbookHash: string;
  readonly inputRevision: number;
  readonly worksheetNames: readonly string[];
  readonly downstreamReadyWorksheetNames: readonly string[];
  readonly f2ReportArtifactId: string;
  readonly f2ReportContentHash: string;
  readonly findingDigest: string;
  readonly provenance?: "user" | "internal_fixture";
}

export const confirmDownstreamScopeInternalPayloadSchema = withUniqueWorksheetNames(z.object({
  decision: z.literal("continue_ready"),
  workbookHash: sha256Schema,
  inputRevision: z.number().int().nonnegative(),
  worksheetNames: z.array(boundedContextNameSchema).min(1),
  downstreamReadyWorksheetNames: z.array(boundedContextNameSchema).min(1),
  f2ReportArtifactId: boundedContextIdSchema,
  f2ReportContentHash: sha256Schema,
  findingDigest: sha256Schema,
  provenance: worksheetDecisionProvenanceSchema.optional(),
}).strict());

const worksheetSelectionDecisionBaseSchema = z
  .object({
    workbookContentHash: sha256Schema,
    selectedWorksheetNames: z.array(nonEmptyStringSchema),
    confirmed: z.literal(true),
    provenance: worksheetSnapshotProvenanceSchema.optional(),
  })
  .strict();

function requireUniqueSelectedWorksheetNames<Schema extends z.ZodTypeAny>(schema: Schema): z.ZodEffects<Schema> {
  return schema.superRefine((selection: { selectedWorksheetNames?: unknown }, context) => {
    if (!Array.isArray(selection.selectedWorksheetNames)) return;
    if (new Set(selection.selectedWorksheetNames).size !== selection.selectedWorksheetNames.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "worksheet names must be unique", path: ["selectedWorksheetNames"] });
    }
  });
}

const worksheetSelectionDecisionSchema = requireUniqueSelectedWorksheetNames(worksheetSelectionDecisionBaseSchema);

const governedDownstreamSelectionDecisionSchema = requireUniqueSelectedWorksheetNames(worksheetSelectionDecisionBaseSchema.extend({
  decision: z.literal("continue_ready"),
  inputRevision: z.number().int().nonnegative(),
  f2ReportArtifactId: boundedContextIdSchema,
  f2ReportContentHash: sha256Schema,
  findingDigest: sha256Schema,
}).strict());

const downstreamSelectionDecisionSchema = z.union([
  governedDownstreamSelectionDecisionSchema,
  worksheetSelectionDecisionSchema,
]);

const confirmationDecisionPayloadSchema = z
  .object({
    decision: nonEmptyStringSchema,
    worksheetNames: z.array(boundedContextNameSchema).optional(),
    rationale: nonEmptyStringSchema.optional(),
    decisionReference: nonEmptyStringSchema.optional(),
  })
  .strict();

const f8F6DraftConfirmationPayloadSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("confirm"), draftId: promptVisibleIdentitySchema, draftHash: sha256Schema, rationale: nonEmptyStringSchema.optional() }).strict(),
  z.object({ decision: z.literal("not_provided"), rationale: nonEmptyStringSchema.optional() }).strict(),
  z.object({ decision: z.literal("decline"), rationale: nonEmptyStringSchema.optional() }).strict(),
]);

const adoDecisionPayloadSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("create_new"), rationale: nonEmptyStringSchema.optional() }).strict(),
  z.object({ decision: z.literal("use_existing"), workItemReference: nonEmptyStringSchema, rationale: nonEmptyStringSchema.optional() }).strict(),
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

const whatIfPatchSchema = z.object({
  nominalValue: z.number().finite().optional(),
  upperTolerance: z.number().finite().optional(),
  lowerTolerance: z.number().finite().optional(),
  additionalMeanShift: z.number().finite().optional(),
}).strict().refine((patch) => Object.values(patch).some((value) => value !== undefined), "What-if patch must include one value.");

const saveFactorWhatIfDraftPublicPayloadSchema = z.object({
  draftId: promptVisibleIdentitySchema,
  worksheetName: boundedContextNameSchema,
  tableId: boundedContextIdSchema,
  sourceRow: z.number().int().positive(),
  inputRevision: z.number().int().nonnegative(),
  patch: whatIfPatchSchema,
  signedDirectionEvidence: z.literal(true).optional(),
}).strict();

export const f8WhatIfCalculationRequestSchema = saveFactorWhatIfDraftPublicPayloadSchema.extend({ signedDirectionEvidence: z.literal(true).optional() }).strict();
export const f8WorksheetWhatIfCalculationRequestSchema = z.object({
  draftId: promptVisibleIdentitySchema,
  worksheetName: boundedContextNameSchema,
  inputRevision: z.number().int().nonnegative(),
  factorOverrides: z.array(f8ScenarioFactorOverrideSchema),
  systemSpecification: f8ScenarioSystemOverrideSchema.optional(),
  signedDirectionEvidence: z.literal(true).optional(),
}).strict().refine(
  (request) => request.factorOverrides.length > 0 || request.systemSpecification !== undefined,
  "Worksheet Scenario must include factor or system overrides.",
);

export type F8WorksheetWhatIfCalculationRequest = z.infer<typeof f8WorksheetWhatIfCalculationRequestSchema>;

const saveWhatIfDraftPublicPayloadSchema = z.union([
  saveFactorWhatIfDraftPublicPayloadSchema,
  f8WorksheetWhatIfCalculationRequestSchema,
]);

const saveWhatIfDraftInternalPayloadSchema = z.object({ draft: f8ScenarioDraftSchema }).strict();

const confirmWhatIfPromotionPublicPayloadSchema = z.object({
  draftId: nonEmptyStringSchema,
  confirmed: z.literal(true),
}).strict();

const confirmWhatIfPromotionInternalPayloadSchema = z.object({
  draftId: nonEmptyStringSchema,
  confirmed: z.literal(true),
  promotionPreview: f6OptimizationTargetsSchema,
}).strict();

const setInteractionLanguagePayloadSchema = z.object({
  turnId: promptVisibleIdentitySchema,
  explicitLanguageTag: nonEmptyStringSchema,
}).strict();

const commandEnvelopeSchema = <Command extends string, T extends z.ZodTypeAny>(command: Command, payloadSchema: T) => z
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
  commandEnvelopeSchema("set_interaction_language", setInteractionLanguagePayloadSchema),
  commandEnvelopeSchema("confirm_initial_scope", worksheetScopeInternalPayloadSchema),
  commandEnvelopeSchema("auto_confirm_initial_scope", worksheetScopeInternalPayloadSchema),
  commandEnvelopeSchema("confirm_downstream_scope", confirmDownstreamScopeInternalPayloadSchema),
  commandEnvelopeSchema("confirm_ado_decision", adoDecisionPayloadSchema),
  commandEnvelopeSchema("reset_ado_decision", z.object({}).strict()),
  commandEnvelopeSchema("confirm_image_decision", confirmationDecisionPayloadSchema),
  commandEnvelopeSchema("confirm_analysis_context", f8F6DraftConfirmationPayloadSchema),
  commandEnvelopeSchema("confirm_optimization_targets", f8F6DraftConfirmationPayloadSchema),
  commandEnvelopeSchema("retry", retryPayloadSchema),
  commandEnvelopeSchema("cancel", cancelPayloadSchema),
  commandEnvelopeSchema("complete_review", completeReviewPayloadSchema),
  commandEnvelopeSchema("save_what_if_draft", saveWhatIfDraftInternalPayloadSchema),
  commandEnvelopeSchema("confirm_what_if_tolerance_promotion", confirmWhatIfPromotionInternalPayloadSchema),
  commandEnvelopeSchema("accept_surface_write", z.object({ actionId: nonEmptyStringSchema }).strict()),
]);

export const f8PublicSessionCommandSchema = z.discriminatedUnion("command", [
  commandEnvelopeSchema("upload_workbook", managedWorkbookUploadPayloadSchema),
  commandEnvelopeSchema("replace_workbook", managedWorkbookReplacePayloadSchema),
  commandEnvelopeSchema("set_interaction_language", setInteractionLanguagePayloadSchema),
  commandEnvelopeSchema("confirm_initial_scope", worksheetScopePayloadSchema),
  commandEnvelopeSchema("confirm_downstream_scope", worksheetScopePayloadSchema),
  commandEnvelopeSchema("confirm_ado_decision", adoDecisionPayloadSchema),
  commandEnvelopeSchema("reset_ado_decision", z.object({}).strict()),
  commandEnvelopeSchema("confirm_image_decision", confirmationDecisionPayloadSchema),
  commandEnvelopeSchema("confirm_analysis_context", f8F6DraftConfirmationPayloadSchema),
  commandEnvelopeSchema("confirm_optimization_targets", f8F6DraftConfirmationPayloadSchema),
  commandEnvelopeSchema("retry", retryPayloadSchema),
  commandEnvelopeSchema("cancel", cancelPayloadSchema),
  commandEnvelopeSchema("complete_review", completeReviewPayloadSchema),
  commandEnvelopeSchema("save_what_if_draft", saveWhatIfDraftPublicPayloadSchema),
  commandEnvelopeSchema("confirm_what_if_tolerance_promotion", confirmWhatIfPromotionPublicPayloadSchema),
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
    artifactId: boundedContextIdSchema,
    label: promptVisibleIdentitySchema.optional(),
  })
  .strict();

const conversationDecisionPartSchema = z
  .object({
    kind: z.literal("decision_reference"),
    decisionReference: promptVisibleIdentitySchema,
  })
  .strict();

const conversationCommandPartSchema = z
  .object({
    kind: z.literal("command"),
    commandId: promptVisibleIdentitySchema,
    command: nonEmptyStringSchema,
  })
  .strict();

const conversationToolActionSchema = z.union([
  z.object({ type: z.literal("navigate"), target: z.literal("/scope"), label: z.literal("选择 Worksheets") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/scope/downstream"), label: z.literal("确认下游 Worksheets") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/ado/preview"), label: z.literal("查看 ADO 预览") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/images/decision"), label: z.literal("确认图片上下文") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/analysis/context"), label: z.literal("补充/确认分析背景") }).strict(),
  z.object({ type: z.literal("navigate"), target: z.literal("/optimization/targets"), label: z.literal("补充/确认优化方向") }).strict(),
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
    id: promptVisibleIdentitySchema,
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
    turnId: promptVisibleIdentitySchema,
    sessionId: promptVisibleIdentitySchema,
    sequence: z.number().int().nonnegative(),
    source: z.enum(["web", "vscode", "cli", "system"]),
    role: z.enum(["user", "assistant", "tool"]),
    content: z.array(conversationContentPartSchema),
    createdAt: z.string().datetime(),
    relatedStage: z.enum(["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7"]).optional(),
    relatedArtifactIds: z.array(boundedContextIdSchema),
    decisionReference: promptVisibleIdentitySchema.optional(),
  })
  .strict();

const hostActionRequestBaseSchema = {
  contractVersion: z.literal("f8-host-action-request-v1"),
  actionId: promptVisibleIdentitySchema,
  sessionId: promptVisibleIdentitySchema,
  expectedRevision: z.number().int().nonnegative(),
  expiresAt: z.string().datetime(),
} as const;

const surfacePrepareRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("create"), title: nonEmptyStringSchema, nextContent: nonEmptyStringSchema, factorCount: z.number().int().nonnegative() }).strict(),
  z.object({ mode: z.literal("existing"), workItemReference: promptVisibleIdentitySchema, nextContent: nonEmptyStringSchema, factorCount: z.number().int().nonnegative() }).strict(),
]);

const f8AdoTargetSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("create"), title: nonEmptyStringSchema }).strict(),
  z.object({ mode: z.literal("existing"), workItemReference: promptVisibleIdentitySchema }).strict(),
]);

const adoExecutionPhaseSchema = z.enum([
  "validate_target",
  "prepare_preview",
  "execute_write",
  "readback",
  "reconcile",
]);

const adoTargetIdentitySchema = z.object({
  organization: nonEmptyStringSchema,
  project: nonEmptyStringSchema,
  workItemId: z.number().int().positive(),
}).strict();

const adoPreviewIdentitySchema = z.object({
  targetIdentity: adoTargetIdentitySchema,
  previewHash: sha256Schema,
  previewMarker: nonEmptyStringSchema,
}).strict();

const surfaceConfirmationSchema = z.object({
  status: z.literal("confirmation_required"),
  workItemReference: promptVisibleIdentitySchema,
  ownerReference: promptVisibleIdentitySchema,
  commentReference: promptVisibleIdentitySchema,
  expectedVersion: promptVisibleIdentitySchema,
  beforeContentHash: sha256Schema,
  nextContent: nonEmptyStringSchema,
  factorCount: z.number().int().nonnegative(),
  confirmationHash: sha256Schema,
  diff: z.array(z.object({ before: z.string().nullable(), after: z.string().nullable(), changed: z.boolean() }).strict()),
}).strict();

const surfaceUpdateReceiptSchema = z.object({
  status: z.literal("updated"),
  workItemReference: promptVisibleIdentitySchema,
  commentReference: promptVisibleIdentitySchema,
  version: promptVisibleIdentitySchema,
  contentHash: sha256Schema,
}).strict();

export const f8AdoProjectionSchema = z.discriminatedUnion("state", [
  z.object({ contractVersion: z.literal("f8-ado-projection-v1"), sessionId: promptVisibleIdentitySchema, state: z.literal("not_required") }).strict(),
  z.object({ contractVersion: z.literal("f8-ado-projection-v1"), sessionId: promptVisibleIdentitySchema, state: z.literal("validation_pending"), actionId: promptVisibleIdentitySchema, expectedRevision: z.number().int().nonnegative(), executionPhase: z.literal("validate_target").optional(), startedAt: z.string().datetime(), expiresAt: z.string().datetime() }).strict(),
  z.object({ contractVersion: z.literal("f8-ado-projection-v1"), sessionId: promptVisibleIdentitySchema, state: z.literal("preview_ready"), actionId: promptVisibleIdentitySchema, expectedRevision: z.number().int().nonnegative(), executionPhase: z.literal("prepare_preview").optional(), target: f8AdoTargetSchema, markdown: nonEmptyStringSchema, contentHash: sha256Schema, confirmation: surfaceConfirmationSchema }).strict(),
  z.object({ contractVersion: z.literal("f8-ado-projection-v1"), sessionId: promptVisibleIdentitySchema, state: z.literal("write_pending"), actionId: promptVisibleIdentitySchema, validationActionId: promptVisibleIdentitySchema, expectedRevision: z.number().int().nonnegative(), executionPhase: z.literal("execute_write").optional(), startedAt: z.string().datetime(), expiresAt: z.string().datetime(), confirmation: surfaceConfirmationSchema }).strict(),
  z.object({ contractVersion: z.literal("f8-ado-projection-v1"), sessionId: promptVisibleIdentitySchema, state: z.literal("write_outcome_unknown"), actionId: promptVisibleIdentitySchema, validationActionId: promptVisibleIdentitySchema, expectedRevision: z.number().int().nonnegative(), executionPhase: z.literal("readback"), previewIdentity: adoPreviewIdentitySchema, writeDispatchedAt: z.string().datetime(), confirmation: surfaceConfirmationSchema }).strict(),
  z.object({ contractVersion: z.literal("f8-ado-projection-v1"), sessionId: promptVisibleIdentitySchema, state: z.literal("reconciled_absent"), actionId: promptVisibleIdentitySchema, writeActionId: promptVisibleIdentitySchema, validationActionId: promptVisibleIdentitySchema, expectedRevision: z.number().int().nonnegative(), executionPhase: z.literal("reconcile"), previewIdentity: adoPreviewIdentitySchema, confirmation: surfaceConfirmationSchema }).strict(),
  z.object({ contractVersion: z.literal("f8-ado-projection-v1"), sessionId: promptVisibleIdentitySchema, state: z.literal("completed"), actionId: promptVisibleIdentitySchema, validationActionId: promptVisibleIdentitySchema, expectedRevision: z.number().int().nonnegative(), executionPhase: z.literal("reconcile").optional(), confirmation: surfaceConfirmationSchema, receipt: surfaceUpdateReceiptSchema }).strict(),
  z.object({ contractVersion: z.literal("f8-ado-projection-v1"), sessionId: promptVisibleIdentitySchema, state: z.enum(["blocked", "failed"]), actionId: promptVisibleIdentitySchema, expectedRevision: z.number().int().nonnegative(), reason: nonEmptyStringSchema }).strict(),
]);

export const f8AdoWriteConfirmationSchema = z.object({
  contractVersion: z.literal("f8-ado-write-confirmation-v1"),
  validationActionId: promptVisibleIdentitySchema,
  expectedRevision: z.number().int().nonnegative(),
  target: f8AdoTargetSchema,
  contentHash: sha256Schema,
  confirmationHash: sha256Schema,
  confirmed: z.literal(true),
}).strict();

export type F8AdoProjection = z.infer<typeof f8AdoProjectionSchema>;
export type F8AdoWriteConfirmation = z.infer<typeof f8AdoWriteConfirmationSchema>;

export const hostActionRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    ...hostActionRequestBaseSchema,
    kind: z.literal("surface_validate"),
    confirmationHash: sha256Schema,
    expectedTargetVersion: nonEmptyStringSchema,
    prepareRequest: surfacePrepareRequestSchema,
  }).strict(),
  z.object({
    ...hostActionRequestBaseSchema,
    kind: z.literal("surface_write"),
    validationActionId: nonEmptyStringSchema,
    confirmationHash: sha256Schema,
    expectedTargetVersion: nonEmptyStringSchema,
    confirmation: surfaceConfirmationSchema,
  }).strict(),
  z.object({
    ...hostActionRequestBaseSchema,
    kind: z.literal("surface_reconcile"),
    writeActionId: nonEmptyStringSchema,
    validationActionId: nonEmptyStringSchema,
    confirmationHash: sha256Schema,
    expectedTargetVersion: nonEmptyStringSchema,
    previewIdentity: adoPreviewIdentitySchema,
    confirmation: surfaceConfirmationSchema,
  }).strict(),
  z.object({
    ...hostActionRequestBaseSchema,
    kind: z.literal("model_request"),
  }).strict(),
  z.object({
    ...hostActionRequestBaseSchema,
    kind: z.literal("vscode_model_request"),
    confirmationHash: sha256Schema,
    expectedTargetVersion: z.literal("vscode-model-v1"),
    turnId: nonEmptyStringSchema,
    prompt: nonEmptyStringSchema,
  }).strict(),
  z.object({
    ...hostActionRequestBaseSchema,
    kind: z.literal("vscode_worksheet_multimodal_request"),
    confirmationHash: sha256Schema,
    expectedTargetVersion: z.literal("vscode-worksheet-multimodal-v3"),
    request: f5MultimodalWorksheetRequestV3Schema,
  }).strict(),
]).superRefine((action, context) => {
  if (action.kind === "vscode_worksheet_multimodal_request") {
    if (action.confirmationHash !== action.request.requestHash) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "confirmationHash must bind the multimodal request", path: ["confirmationHash"] });
    }
    if (action.sessionId !== action.request.sessionId || action.expectedRevision !== action.request.revision) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "host action scope must bind the multimodal request", path: ["request"] });
    }
  }
});

export const hostActionClaimSchema = z
  .object({
    contractVersion: z.literal("f8-host-action-claim-v1"),
    actionId: promptVisibleIdentitySchema,
    hostInstanceId: promptVisibleIdentitySchema,
    leaseId: promptVisibleIdentitySchema,
    leaseExpiresAt: z.string().datetime(),
    request: hostActionRequestSchema,
  })
  .strict()
  .superRefine((claim, context) => {
    if (claim.actionId !== claim.request.actionId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "host action claim must bind the same actionId", path: ["request", "actionId"] });
    }
  });

const hostActionResultPayloadSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("completed"),
    outcome: z.union([
      z.object({ kind: z.literal("surface_validation"), confirmation: surfaceConfirmationSchema }).strict(),
      z.object({ kind: z.literal("surface_write"), receipt: surfaceUpdateReceiptSchema }).strict(),
      z.object({
        kind: z.literal("surface_reconcile"),
        state: z.literal("matching"),
        receipt: surfaceUpdateReceiptSchema,
        observedCommentReference: promptVisibleIdentitySchema,
        observedCommentVersion: promptVisibleIdentitySchema,
      }).strict(),
      z.object({
        kind: z.literal("surface_reconcile"),
        state: z.literal("absent"),
      }).strict(),
      z.object({ kind: z.literal("model_response"), turnId: nonEmptyStringSchema, responseText: nonEmptyStringSchema, proposal: f6InputProposalSchema.optional() }).strict(),
      z.object({ kind: z.literal("worksheet_multimodal_response"), result: f5MultimodalWorksheetResultV3Schema }).strict(),
    ]).optional(),
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
    actionId: promptVisibleIdentitySchema,
    hostInstanceId: promptVisibleIdentitySchema,
    leaseId: promptVisibleIdentitySchema,
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
    sessionId: promptVisibleIdentitySchema,
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
    sessionId: promptVisibleIdentitySchema,
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
    sessionId: promptVisibleIdentitySchema,
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
    sessionId: promptVisibleIdentitySchema,
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
    sessionId: promptVisibleIdentitySchema,
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
    sessionId: promptVisibleIdentitySchema,
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
    sessionId: promptVisibleIdentitySchema,
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
    sessionId: promptVisibleIdentitySchema,
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
    sessionId: promptVisibleIdentitySchema,
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
    sessionId: promptVisibleIdentitySchema,
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
    sessionId: promptVisibleIdentitySchema,
    revision: z.number().int().nonnegative(),
    inputRevision: z.number().int().nonnegative(),
    state: f8SessionStateSchema,
    activeAttempt: f8StageAttemptSchema.nullable(),
    interactionLanguage: interactionLanguageSchema,
    priorRunReferences: z.array(f8PriorRunReferenceSchema),
    artifactRefs: z.array(f8ArtifactRefSchema).optional(),
    worksheetCapabilities: z.array(f8WorksheetCapabilitySchema).optional(),
    initialScopeSelection: worksheetSelectionDecisionSchema.optional(),
    downstreamScopeSelection: downstreamSelectionDecisionSchema.optional(),
    pendingAnalysisContextDraft: f8PendingF6InputDraftSchema.optional(),
    pendingOptimizationTargetsDraft: f8PendingF6InputDraftSchema.optional(),
    scenarioDrafts: z.array(z.lazy(() => f8ScenarioDraftSchema)).optional(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.priorRunReferences.some((reference) => reference.featureId === "F7" && reference.runReference === undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "F7 prior run references require a runReference" });
    }
    const artifactIds = new Set<string>();
    const draftIds = new Set<string>();
    let activeDraftCount = 0;
    snapshot.artifactRefs?.forEach((artifactRef, index) => {
      if (artifactIds.has(artifactRef.artifactId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "artifact refs must be unique by artifactId", path: ["artifactRefs", index, "artifactId"] });
      }
      artifactIds.add(artifactRef.artifactId);
    });
    snapshot.scenarioDrafts?.forEach((draft, index) => {
      if (draft.sessionId !== snapshot.sessionId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario drafts must belong to the snapshot session", path: ["scenarioDrafts", index, "sessionId"] });
      }
      if (draftIds.has(draft.draftId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "scenario draft ids must be unique", path: ["scenarioDrafts", index, "draftId"] });
      }
      draftIds.add(draft.draftId);
      if (!["promoted_to_f6_targets", "superseded", "deleted"].includes(draft.status)) {
        activeDraftCount += 1;
      }
    });
    if (snapshot.pendingAnalysisContextDraft?.kind !== undefined && snapshot.pendingAnalysisContextDraft.kind !== "analysis_context") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "pendingAnalysisContextDraft must use analysis_context kind", path: ["pendingAnalysisContextDraft", "kind"] });
    }
    if (snapshot.pendingOptimizationTargetsDraft?.kind !== undefined && snapshot.pendingOptimizationTargetsDraft.kind !== "optimization_targets") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "pendingOptimizationTargetsDraft must use optimization_targets kind", path: ["pendingOptimizationTargetsDraft", "kind"] });
    }
    if (snapshot.pendingAnalysisContextDraft?.inputRevision !== undefined && snapshot.pendingAnalysisContextDraft.inputRevision !== snapshot.inputRevision) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "pendingAnalysisContextDraft must match snapshot inputRevision", path: ["pendingAnalysisContextDraft", "inputRevision"] });
    }
    if (snapshot.pendingOptimizationTargetsDraft?.inputRevision !== undefined && snapshot.pendingOptimizationTargetsDraft.inputRevision !== snapshot.inputRevision) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "pendingOptimizationTargetsDraft must match snapshot inputRevision", path: ["pendingOptimizationTargetsDraft", "inputRevision"] });
    }
    if (activeDraftCount > 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "session snapshots allow only one active WHAT_IF draft", path: ["scenarioDrafts"] });
    }
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
