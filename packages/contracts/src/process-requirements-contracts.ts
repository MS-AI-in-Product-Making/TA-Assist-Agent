import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const nonEmptyStringSchema = z.string().min(1);

export const processRequirementVersionSchema = z.enum([
  "process-requirements-v1",
  "process-requirements-v2",
]);
export const processRequirementEntryTypeSchema = z.enum([
  "requirement",
  "warning",
  "escalation",
  "milestone",
  "instruction",
  "definition",
]);
export const processRequirementTopicSchema = z.enum([
  "scope",
  "inputs",
  "outputs",
  "analysis-method",
  "sigma-target",
  "priority",
  "review",
  "tolerance-loop",
  "factor-modeling",
  "workbook-operation",
  "terminology",
]);
export const processRequirementNormativeStrengthSchema = z.enum([
  "must",
  "should",
  "may",
  "informational",
]);
export const processRequirementFactReferenceSchema = z.enum([
  "actor",
  "analysisMethod",
  "characteristicClass",
  "priority",
  "lifecycleStage",
  "subject",
  "factorRepresentation",
  "requirementGapPresent",
  "workbookArea",
  "toleranceCount",
  "hasThreeDimensionalSensitivity",
]);
export const processRequirementActorSchema = z.enum([
  "odm",
  "subsystem-supplier",
  "microsoft-internal",
  "all",
]);
export const processRequirementAnalysisMethodSchema = z.enum([
  "one-dimensional-rss",
  "three-dimensional-variation",
  "all",
]);
export const processRequirementCharacteristicClassSchema = z.enum(["cts", "ctf", "other"]);
export const processRequirementPrioritySchema = z.enum(["P0", "P1", "P2", "P3"]);
export const processRequirementLifecycleStageSchema = z.enum([
  "asr",
  "before-tooling",
  "after-tooling-trial-or-build",
  "dfm",
]);
export const processRequirementSubjectSchema = z.enum(["camera-fov-clearance", "other"]);
export const processRequirementFactorRepresentationSchema = z.enum([
  "position",
  "profile",
  "pin-hole-float",
  "mean-shift",
]);
export const processRequirementWorkbookAreaSchema = z.enum([
  "auto-summary",
  "part-sub-required-dimensions",
]);

export const processRequirementApplicabilitySchema = z
  .object({
    actor: processRequirementActorSchema.optional(),
    analysisMethod: processRequirementAnalysisMethodSchema.optional(),
    characteristicClass: processRequirementCharacteristicClassSchema.optional(),
    priority: processRequirementPrioritySchema.optional(),
    lifecycleStage: processRequirementLifecycleStageSchema.optional(),
    subject: processRequirementSubjectSchema.optional(),
    factorRepresentation: processRequirementFactorRepresentationSchema.optional(),
    requirementGapPresent: z.boolean().optional(),
    workbookArea: processRequirementWorkbookAreaSchema.optional(),
    minimumToleranceCountExclusive: z.number().int().nonnegative().optional(),
    maximumToleranceCountExclusive: z.number().int().nonnegative().optional(),
    hasThreeDimensionalSensitivity: z.boolean().optional(),
    requiredFacts: z.array(processRequirementFactReferenceSchema),
  })
  .strict();

export const processRequirementSourceIdentitySchema = z
  .object({
    sourceAlias: nonEmptyStringSchema,
    sourceFileHash: sha256Schema,
    sourceRevision: nonEmptyStringSchema,
    sheetName: nonEmptyStringSchema,
    sourceRange: nonEmptyStringSchema,
  })
  .strict();
export const processRequirementSourceMetadataSchema = z
  .object({
    sourceAlias: nonEmptyStringSchema,
    hash: sha256Schema,
    revision: nonEmptyStringSchema,
    sheet: nonEmptyStringSchema,
    range: nonEmptyStringSchema,
    sourceClassification: z.literal("confidential"),
    releasedClassification: z.literal("internal"),
    owner: nonEmptyStringSchema,
    reviewedAt: z.string().datetime(),
  })
  .strict();
export const processRequirementConfidenceSchema = z.enum(["reviewed", "verified"]);
export const processRequirementProvenanceSchema = z
  .object({
    ...processRequirementSourceIdentitySchema.shape,
    effectiveVersion: processRequirementVersionSchema,
    owner: nonEmptyStringSchema,
    confidence: processRequirementConfidenceSchema,
    changeSummary: nonEmptyStringSchema,
  })
  .strict();

export const processRequirementEntrySchema = z
  .object({
    entryId: nonEmptyStringSchema,
    entryType: processRequirementEntryTypeSchema,
    topic: processRequirementTopicSchema,
    title: nonEmptyStringSchema,
    message: nonEmptyStringSchema,
    normativeStrength: processRequirementNormativeStrengthSchema,
    applicability: processRequirementApplicabilitySchema,
    relatedEntryIds: z.array(nonEmptyStringSchema),
    provenance: processRequirementProvenanceSchema,
  })
  .strict();

export const processRequirementEntryTypeCountsSchema = z
  .object({
    requirement: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    escalation: z.number().int().nonnegative(),
    milestone: z.number().int().nonnegative(),
    instruction: z.number().int().nonnegative(),
    definition: z.number().int().nonnegative(),
  })
  .strict();
export const processRequirementManifestCountsSchema = z
  .object({
    sources: z.number().int().nonnegative(),
    entries: z.number().int().nonnegative(),
    entryTypes: processRequirementEntryTypeCountsSchema,
  })
  .strict();
export const processRequirementManifestSchema = z
  .object({
    version: processRequirementVersionSchema,
    classification: z.literal("internal"),
    releasedAt: z.string().datetime(),
    changeSummary: nonEmptyStringSchema,
    counts: processRequirementManifestCountsSchema,
    sourcesHash: sha256Schema,
    entriesHash: sha256Schema,
    contentHash: sha256Schema,
  })
  .strict();
export const processRequirementSeedPackageSchema = z
  .object({
    manifest: processRequirementManifestSchema,
    sources: z.array(processRequirementSourceMetadataSchema),
    entries: z.array(processRequirementEntrySchema),
  })
  .strict();

export const processRequirementLoadRequestSchema = z
  .object({ version: processRequirementVersionSchema })
  .strict();
export const processRequirementListRequestSchema = z
  .object({
    topics: z.array(processRequirementTopicSchema).optional(),
    entryTypes: z.array(processRequirementEntryTypeSchema).optional(),
  })
  .strict();
export const processRequirementEvaluationFactsSchema = z
  .object({
    actor: processRequirementActorSchema.optional(),
    analysisMethod: processRequirementAnalysisMethodSchema.optional(),
    characteristicClass: processRequirementCharacteristicClassSchema.optional(),
    priority: processRequirementPrioritySchema.optional(),
    lifecycleStage: processRequirementLifecycleStageSchema.optional(),
    subject: processRequirementSubjectSchema.optional(),
    factorRepresentation: processRequirementFactorRepresentationSchema.optional(),
    requirementGapPresent: z.boolean().optional(),
    workbookArea: processRequirementWorkbookAreaSchema.optional(),
    toleranceCount: z.number().int().nonnegative().optional(),
    hasThreeDimensionalSensitivity: z.boolean().optional(),
  })
  .strict();
export const processRequirementEvaluationRequestSchema = processRequirementEvaluationFactsSchema;

export const processRequirementResolvedTargetsSchema = z
  .object({ sigma: z.union([z.literal(4), z.literal(6)]).optional() })
  .strict();
export const processRequirementMatchedEntrySchema = z
  .object({
    entryId: nonEmptyStringSchema,
    entryType: processRequirementEntryTypeSchema,
    topic: processRequirementTopicSchema,
    title: nonEmptyStringSchema,
    message: nonEmptyStringSchema,
    normativeStrength: processRequirementNormativeStrengthSchema,
    relatedFactReferences: z.array(processRequirementFactReferenceSchema),
    evidence: processRequirementProvenanceSchema,
  })
  .strict();

const evaluationFields = {
  version: processRequirementVersionSchema,
  resolvedTargets: processRequirementResolvedTargetsSchema,
  factsUsed: z.array(processRequirementFactReferenceSchema),
};
export const processRequirementMatchedEvaluationSchema = z
  .object({
    ...evaluationFields,
    status: z.literal("matched"),
    matchedEntries: z.array(processRequirementMatchedEntrySchema).min(1),
    missingFacts: z.array(processRequirementFactReferenceSchema),
  })
  .strict();
export const processRequirementInsufficientFactsEvaluationSchema = z
  .object({
    ...evaluationFields,
    status: z.literal("insufficient-facts"),
    matchedEntries: z.array(processRequirementMatchedEntrySchema).max(0),
    missingFacts: z.array(processRequirementFactReferenceSchema).min(1),
  })
  .strict();
export const processRequirementNotApplicableEvaluationSchema = z
  .object({
    ...evaluationFields,
    status: z.literal("not-applicable"),
    matchedEntries: z.array(processRequirementMatchedEntrySchema).max(0),
    missingFacts: z.array(processRequirementFactReferenceSchema).max(0),
  })
  .strict();
export const processRequirementEvaluationSchema = z.discriminatedUnion("status", [
  processRequirementMatchedEvaluationSchema,
  processRequirementInsufficientFactsEvaluationSchema,
  processRequirementNotApplicableEvaluationSchema,
]);

export type ProcessRequirementVersion = z.infer<typeof processRequirementVersionSchema>;
export type ProcessRequirementEntryType = z.infer<typeof processRequirementEntryTypeSchema>;
export type ProcessRequirementTopic = z.infer<typeof processRequirementTopicSchema>;
export type ProcessRequirementNormativeStrength = z.infer<typeof processRequirementNormativeStrengthSchema>;
export type ProcessRequirementFactReference = z.infer<typeof processRequirementFactReferenceSchema>;
export type ProcessRequirementActor = z.infer<typeof processRequirementActorSchema>;
export type ProcessRequirementAnalysisMethod = z.infer<typeof processRequirementAnalysisMethodSchema>;
export type ProcessRequirementCharacteristicClass = z.infer<typeof processRequirementCharacteristicClassSchema>;
export type ProcessRequirementPriority = z.infer<typeof processRequirementPrioritySchema>;
export type ProcessRequirementLifecycleStage = z.infer<typeof processRequirementLifecycleStageSchema>;
export type ProcessRequirementSubject = z.infer<typeof processRequirementSubjectSchema>;
export type ProcessRequirementFactorRepresentation = z.infer<typeof processRequirementFactorRepresentationSchema>;
export type ProcessRequirementWorkbookArea = z.infer<typeof processRequirementWorkbookAreaSchema>;
export type ProcessRequirementApplicability = z.infer<typeof processRequirementApplicabilitySchema>;
export type ProcessRequirementSourceIdentity = z.infer<typeof processRequirementSourceIdentitySchema>;
export type ProcessRequirementSourceMetadata = z.infer<typeof processRequirementSourceMetadataSchema>;
export type ProcessRequirementConfidence = z.infer<typeof processRequirementConfidenceSchema>;
export type ProcessRequirementProvenance = z.infer<typeof processRequirementProvenanceSchema>;
export type ProcessRequirementEntry = z.infer<typeof processRequirementEntrySchema>;
export type ProcessRequirementEntryTypeCounts = z.infer<typeof processRequirementEntryTypeCountsSchema>;
export type ProcessRequirementManifestCounts = z.infer<typeof processRequirementManifestCountsSchema>;
export type ProcessRequirementManifest = z.infer<typeof processRequirementManifestSchema>;
export type ProcessRequirementSeedPackage = z.infer<typeof processRequirementSeedPackageSchema>;
export type ProcessRequirementLoadRequest = z.infer<typeof processRequirementLoadRequestSchema>;
export type ProcessRequirementListRequest = z.infer<typeof processRequirementListRequestSchema>;
export type ProcessRequirementEvaluationFacts = z.infer<typeof processRequirementEvaluationFactsSchema>;
export type ProcessRequirementEvaluationRequest = z.infer<typeof processRequirementEvaluationRequestSchema>;
export type ProcessRequirementResolvedTargets = z.infer<typeof processRequirementResolvedTargetsSchema>;
export type ProcessRequirementMatchedEntry = z.infer<typeof processRequirementMatchedEntrySchema>;
export type ProcessRequirementMatchedEvaluation = z.infer<typeof processRequirementMatchedEvaluationSchema>;
export type ProcessRequirementInsufficientFactsEvaluation = z.infer<typeof processRequirementInsufficientFactsEvaluationSchema>;
export type ProcessRequirementNotApplicableEvaluation = z.infer<typeof processRequirementNotApplicableEvaluationSchema>;
export type ProcessRequirementEvaluation = z.infer<typeof processRequirementEvaluationSchema>;
