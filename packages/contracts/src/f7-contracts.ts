import { z } from "zod";
import {
  worksheetSelectionConfirmationSchema,
} from "./contracts.js";
import type {
  WorksheetSelectionConfirmation,
} from "./contracts.js";

const sha256LowerSchema = z.string().regex(/^[a-f0-9]{64}$/);
const finiteNumberSchema = z.number().finite();
const finitePositiveNumberSchema = z.number().finite().positive();
const isoDateTimeSchema = z.string().datetime({ offset: true });

const controlledCellReferenceSchema = z.string().regex(/^[^!]+![A-Z]+[1-9]\d*$/);
const sourceCellsSchema = z
  .record(z.string().min(1), controlledCellReferenceSchema)
  .refine((sourceCells) => Object.keys(sourceCells).length > 0, {
    message: "sourceCells must contain at least one controlled cell reference",
    path: [],
  });

const uniquePositiveRowsSchema = z
  .array(z.number().int().positive())
  .min(1)
  .superRefine((rowNumbers, context) => {
    if (new Set(rowNumbers).size !== rowNumbers.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rowNumbers must be unique",
      });
    }
  });

const sortedUniquePositiveRowsSchema = uniquePositiveRowsSchema.superRefine((rowNumbers, context) => {
  for (let index = 1; index < rowNumbers.length; index += 1) {
    if (rowNumbers[index - 1]! > rowNumbers[index]!) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rowNumbers must be sorted ascending",
      });
      return;
    }
  }
});

const requireLowerSpecLessThanUpperSpec = (
  value: { lowerSpecLimit: number; upperSpecLimit: number },
  context: z.RefinementCtx,
): void => {
  if (value.lowerSpecLimit >= value.upperSpecLimit) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "lowerSpecLimit must be less than upperSpecLimit",
      path: ["lowerSpecLimit"],
    });
  }
};

export const f7LoopCoefficientSchema = z.union([z.literal(-1), z.literal(1)]);

export const f7FactorSourceModeSchema = z.enum([
  "MEASURED",
  "BASELINE_ASSUMPTION",
]);

export const f7MeasurementStructureSchema = z.enum([
  "RATIONAL_SUBGROUP",
  "ORDERED_INDIVIDUALS",
  "UNORDERED_SAMPLE",
]);

export const f7MsaStatusSchema = z.enum(["available", "not_available", "unknown"]);

export const f7BaselineSamplerSchema = z
  .object({
    samplerId: z.literal("NORMAL_LOCATION_SCALE_V1"),
    physicalMean: finiteNumberSchema,
    standardDeviation: finitePositiveNumberSchema,
    support: z.literal("REAL"),
  })
  .strict();

export const f7FactorCandidateSchema = z
  .object({
    workbookContentHash: sha256LowerSchema,
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
    sourceCells: sourceCellsSchema,
    factorCandidateId: sha256LowerSchema,
    factorName: z.string().min(1),
    workbookUnitEvidence: z.string().min(1).optional(),
    excelSignedMean: finiteNumberSchema,
    standardDeviation: finitePositiveNumberSchema,
    distribution: z.literal("Normal"),
    lowerSpecLimit: finiteNumberSchema,
    upperSpecLimit: finiteNumberSchema,
  })
  .strict()
  .superRefine(requireLowerSpecLessThanUpperSpec);

export const f7FactorSetupConfirmationSchema = z
  .object({
    factorCandidateId: sha256LowerSchema,
    loopCoefficient: f7LoopCoefficientSchema,
    unit: z.string().trim().min(1),
    confirmed: z.literal(true),
  })
  .strict();

export const f7UnitSourceSchema = z.enum(["workbook", "user_confirmed"]);

export const f7FactorEvidenceSchema = z
  .object({
    workbookContentHash: sha256LowerSchema,
    worksheetName: z.string().min(1),
    tableId: z.string().min(1),
    sourceRow: z.number().int().positive(),
    sourceCells: sourceCellsSchema,
    factorCandidateId: sha256LowerSchema,
    factorId: sha256LowerSchema,
    factorName: z.string().min(1),
    unit: z.string().trim().min(1),
    unitSource: f7UnitSourceSchema,
    loopCoefficient: f7LoopCoefficientSchema,
    physicalMean: z.number().finite().min(0),
    signedContributionMean: finiteNumberSchema,
    baselineSampler: f7BaselineSamplerSchema,
    lowerSpecLimit: finiteNumberSchema,
    upperSpecLimit: finiteNumberSchema,
  })
  .strict()
  .superRefine((evidence, context) => {
    requireLowerSpecLessThanUpperSpec(evidence, context);

    const expectedSignedContributionMean = evidence.loopCoefficient * evidence.physicalMean;
    if (Math.abs(evidence.signedContributionMean - expectedSignedContributionMean) > 1e-12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "signedContributionMean must equal loopCoefficient * physicalMean within 1e-12",
        path: ["signedContributionMean"],
      });
    }

    if (Math.abs(evidence.baselineSampler.physicalMean - evidence.physicalMean) > 1e-12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "baselineSampler.physicalMean must equal physicalMean within 1e-12",
        path: ["baselineSampler", "physicalMean"],
      });
    }
  });

export const f7ObservationDispositionSchema = z.enum(["included", "excluded"]);

export const f7ExclusionReasonSchema = z.enum([
  "OUTLIER",
  "MEASUREMENT_SYSTEM_ERROR",
  "TRANSCRIPTION_ERROR",
  "PROCESS_INTERRUPTION",
  "OTHER",
]);

const commonObservationFields = {
  value: finiteNumberSchema,
  originalRow: z.number().int().positive(),
  sequence: z.string().min(1).optional(),
  timestamp: isoDateTimeSchema.optional(),
  subgroup: z.string().min(1).optional(),
  batch: z.string().min(1).optional(),
} as const;

export const f7ObservationSchema = z.discriminatedUnion("disposition", [
  z
    .object({
      ...commonObservationFields,
      disposition: z.literal("included"),
    })
    .strict(),
  z
    .object({
      ...commonObservationFields,
      disposition: z.literal("excluded"),
      reason: f7ExclusionReasonSchema,
      operatorReference: z.string().min(1),
      confirmed: z.literal(true),
    })
    .strict(),
]);

export const f7RejectionReasonSchema = z.enum([
  "non_finite_value",
  "invalid_row",
  "missing_value",
]);

export const f7RejectionSummarySchema = z
  .object({
    rowNumber: z.number().int().positive(),
    reason: f7RejectionReasonSchema,
  })
  .strict();

export const f7MeasurementDatasetSchema = z
  .object({
    factorId: sha256LowerSchema,
    unit: z.string().trim().min(1),
    structure: f7MeasurementStructureSchema,
    sourceReference: z.string().min(1),
    importedAt: isoDateTimeSchema,
    msaStatus: f7MsaStatusSchema,
    observations: z.array(f7ObservationSchema),
    missingRowCount: z.number().int().min(0),
    rejectionSummaries: z.array(f7RejectionSummarySchema),
    originalRowCount: z.number().int().min(0),
    analyzedCount: z.number().int().min(0),
    contentHash: sha256LowerSchema,
  })
  .strict()
  .superRefine((dataset, context) => {
    const expectedOriginalRowCount =
      dataset.observations.length + dataset.missingRowCount + dataset.rejectionSummaries.length;
    if (dataset.originalRowCount !== expectedOriginalRowCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "originalRowCount must equal observations + missingRowCount + rejectionSummaries",
        path: ["originalRowCount"],
      });
    }

    const includedCount = dataset.observations.filter((observation) => observation.disposition === "included").length;
    if (dataset.analyzedCount !== includedCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "analyzedCount must equal included observation count",
        path: ["analyzedCount"],
      });
    }

    const observationRows = dataset.observations.map((observation) => observation.originalRow);
    if (new Set(observationRows).size !== observationRows.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "observation original rows must be unique",
        path: ["observations"],
      });
    }

    const rejectionRows = dataset.rejectionSummaries.map((summary) => summary.rowNumber);
    if (new Set(rejectionRows).size !== rejectionRows.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rejection row numbers must be unique",
        path: ["rejectionSummaries"],
      });
    }

    const observationRowSet = new Set(observationRows);
    for (const rejectionRow of rejectionRows) {
      if (observationRowSet.has(rejectionRow)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "rejection rows must not overlap observation rows",
          path: ["rejectionSummaries"],
        });
        break;
      }
    }
  });

export const f7FactorInputSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("MEASURED"),
      dataset: f7MeasurementDatasetSchema.optional(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("BASELINE_ASSUMPTION"),
      baselineSampler: f7BaselineSamplerSchema,
    })
    .strict(),
]);

export const f7DatasetValidationReasonSchema = z.enum([
  "subgroup_too_small",
  "ordered_sequence_invalid",
  "sample_count_below_minimum",
  "exploratory_only",
  "fit_uncertainty",
  "unit_mismatch",
  "specification_missing",
  "non_finite_measurement",
  "duplicate_measurement",
  "msa_evidence_missing",
  "mixed_batch_conditions",
  "outlier_candidate",
  "invalid_rows_rejected",
]);

// Backward-compatible export name retained for existing imports.
export const f7DatasetValidationIssueReasonSchema = f7DatasetValidationReasonSchema;

export const f7DatasetValidationIssueSchema = z
  .object({
    reason: f7DatasetValidationReasonSchema,
    factorId: sha256LowerSchema.optional(),
    rowNumbers: sortedUniquePositiveRowsSchema.optional(),
  })
  .strict();

export const f7CandidateEligibilityFlagSchema = z.enum(["eligible", "ineligible_nonpositive"]);

export const f7CandidateEligibilitySchema = z
  .object({
    normal: z.literal("eligible"),
    lognormal: f7CandidateEligibilityFlagSchema,
    weibull: f7CandidateEligibilityFlagSchema,
    gamma: f7CandidateEligibilityFlagSchema,
    uniform: z.literal("eligible_with_boundary_warning"),
  })
  .strict();

export const f7DatasetValidationResultSchema = z
  .object({
    status: z.enum(["ready", "blocked"]),
    blockingIssues: z.array(f7DatasetValidationIssueSchema),
    advisoryIssues: z.array(f7DatasetValidationIssueSchema),
    candidateEligibility: f7CandidateEligibilitySchema,
  })
  .strict();

export const f7MeasurementPasteResultSchema = z
  .object({
    status: z.enum(["ready", "blocked"]),
    factorId: sha256LowerSchema,
    dataset: f7MeasurementDatasetSchema.optional(),
    validation: f7DatasetValidationResultSchema,
  })
  .strict();

export const f7AnalysisRequestContractIdSchema = z.literal("f7-analysis-request-v1");
export const f7AnalysisResultContractIdSchema = z.literal("f7-analysis-result-v1");

export const f7SessionStatusSchema = z.enum([
  "worksheet_selection",
  "factor_setup",
  "measurement_entry",
  "phase_1_ready",
]);

const f7SessionFactorStateSchema = z
  .object({
    factorCandidate: f7FactorCandidateSchema,
    setup: f7FactorSetupConfirmationSchema.optional(),
    sourceMode: f7FactorSourceModeSchema.optional(),
    input: f7FactorInputSchema.optional(),
    evidence: f7FactorEvidenceSchema.optional(),
    datasetValidation: f7DatasetValidationResultSchema.optional(),
    measurementPasteResult: f7MeasurementPasteResultSchema.optional(),
  })
  .strict()
  .superRefine((factorState, context) => {
    if (
      factorState.setup !== undefined
      && factorState.setup.factorCandidateId !== factorState.factorCandidate.factorCandidateId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "setup.factorCandidateId must match factorCandidate.factorCandidateId",
        path: ["setup", "factorCandidateId"],
      });
    }

    if (
      factorState.evidence !== undefined
      && factorState.evidence.factorCandidateId !== factorState.factorCandidate.factorCandidateId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "evidence.factorCandidateId must match factorCandidate.factorCandidateId",
        path: ["evidence", "factorCandidateId"],
      });
    }

    const knownFinalFactorId = factorState.evidence?.factorId;
    const measuredDatasetFactorId = factorState.input?.mode === "MEASURED" ? factorState.input.dataset?.factorId : undefined;

    if (
      knownFinalFactorId !== undefined
      && measuredDatasetFactorId !== undefined
      && measuredDatasetFactorId !== knownFinalFactorId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "input.dataset.factorId must match evidence.factorId when both are present",
        path: ["input", "dataset", "factorId"],
      });
    }

    if (
      knownFinalFactorId !== undefined
      && factorState.measurementPasteResult !== undefined
      && factorState.measurementPasteResult.factorId !== knownFinalFactorId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "measurementPasteResult.factorId must match evidence.factorId when both are present",
        path: ["measurementPasteResult", "factorId"],
      });
    }

    const pasteDatasetFactorId = factorState.measurementPasteResult?.dataset?.factorId;
    if (
      factorState.measurementPasteResult !== undefined
      && pasteDatasetFactorId !== undefined
      && pasteDatasetFactorId !== factorState.measurementPasteResult.factorId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "measurementPasteResult.dataset.factorId must match measurementPasteResult.factorId",
        path: ["measurementPasteResult", "dataset", "factorId"],
      });
    }
  });

export const f7SessionSnapshotSchema = z
  .object({
    contractId: f7AnalysisResultContractIdSchema,
    outputClassification: z.literal("confidential"),
    sessionId: z.string().min(1),
    status: f7SessionStatusSchema,
    workbook: z
      .object({
        fileName: z.string().min(1),
        workbookContentHash: sha256LowerSchema,
      })
      .strict(),
    selectedWorksheetNames: z.array(z.string().min(1)),
    factors: z.array(f7SessionFactorStateSchema),
  })
  .strict();

export const f7WorkbookImportRequestSchema = z
  .object({
    contractId: f7AnalysisRequestContractIdSchema,
    inputClassification: z.literal("confidential"),
    fileName: z.string().min(1),
    workbookBytes: z.instanceof(Uint8Array).refine((workbookBytes) => workbookBytes.length > 0, {
      message: "workbookBytes must not be empty",
    }),
  })
  .strict();

export const f7MeasurementPasteRequestSchema = z
  .object({
    factorId: sha256LowerSchema,
    unit: z.string().trim().min(1),
    structure: f7MeasurementStructureSchema,
    sourceReference: z.string().min(1),
    msaStatus: f7MsaStatusSchema,
    text: z.string().min(1).max(1024 * 1024),
  })
  .strict();

export const f7MeasurementDispositionActionSchema = z.enum(["EXCLUDE", "RESTORE"]);

export const f7MeasurementDispositionRequestSchema = z
  .object({
    factorId: sha256LowerSchema,
    rowNumbers: uniquePositiveRowsSchema,
    action: f7MeasurementDispositionActionSchema,
    reason: f7ExclusionReasonSchema,
    operatorReference: z.string().min(1),
    confirmed: z.literal(true),
  })
  .strict();

export const f7AnalysisRequestSchema = z
  .object({
    contractId: f7AnalysisRequestContractIdSchema,
    inputClassification: z.literal("confidential"),
    sessionId: z.string().min(1),
  })
  .strict();

export const f7AnalysisResultSchema = z
  .object({
    contractId: f7AnalysisResultContractIdSchema,
    outputClassification: z.literal("confidential"),
    snapshot: f7SessionSnapshotSchema,
  })
  .strict();

export const f7WorkbookImportRouteRequestSchema = z
  .object({
    fileName: z.string().min(1),
    workbookBase64: z.string().min(1).max(22_369_624),
  })
  .strict();

export const f7WorksheetConfirmRouteRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    confirmation: worksheetSelectionConfirmationSchema,
  })
  .strict();

export const f7FactorConfirmRouteRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    confirmations: z.array(f7FactorSetupConfirmationSchema).min(1),
  })
  .strict();

export const f7FactorModeRouteRequestSchema = z
  .object({
    params: z.object({ factorId: sha256LowerSchema }).strict(),
    body: z
      .object({
        sessionId: z.string().min(1),
        mode: f7FactorSourceModeSchema,
      })
      .strict(),
  })
  .strict();

export const f7MeasurementPasteRouteRequestSchema = z
  .object({
    params: z.object({ factorId: sha256LowerSchema }).strict(),
    body: z
      .object({
        sessionId: z.string().min(1),
        structure: f7MeasurementStructureSchema,
        sourceReference: z.string().min(1),
        msaStatus: f7MsaStatusSchema,
        text: z.string().min(1).max(1024 * 1024),
      })
      .strict(),
  })
  .strict();

export const f7MeasurementDispositionRouteRequestSchema = z
  .object({
    params: z.object({ factorId: sha256LowerSchema }).strict(),
    body: z
      .object({
        sessionId: z.string().min(1),
        rowNumbers: uniquePositiveRowsSchema,
        action: f7MeasurementDispositionActionSchema,
        reason: f7ExclusionReasonSchema,
        operatorReference: z.string().min(1),
        confirmed: z.literal(true),
      })
      .strict(),
  })
  .strict();

export const f7SessionRouteParamsSchema = z
  .object({
    sessionId: z.string().min(1),
  })
  .strict();

export type F7FactorCandidate = z.infer<typeof f7FactorCandidateSchema>;
export type F7FactorSetupConfirmation = z.infer<typeof f7FactorSetupConfirmationSchema>;
export type F7FactorSourceMode = z.infer<typeof f7FactorSourceModeSchema>;
export type F7FactorInput = z.infer<typeof f7FactorInputSchema>;
export type F7FactorEvidence = z.infer<typeof f7FactorEvidenceSchema>;
export type F7MeasurementPasteResult = z.infer<typeof f7MeasurementPasteResultSchema>;
export type F7DatasetValidationResult = z.infer<typeof f7DatasetValidationResultSchema>;
export type F7WorkbookImportRequest = z.infer<typeof f7WorkbookImportRequestSchema>;
export type F7MeasurementPasteRequest = z.infer<typeof f7MeasurementPasteRequestSchema>;
export type F7MeasurementDispositionRequest = z.infer<typeof f7MeasurementDispositionRequestSchema>;
export type F7SessionSnapshot = z.infer<typeof f7SessionSnapshotSchema>;

export interface F7SessionService {
  importWorkbook(request: F7WorkbookImportRequest): F7SessionSnapshot;
  confirmWorksheet(request: { sessionId: string; confirmation: WorksheetSelectionConfirmation }): F7SessionSnapshot;
  confirmFactorSetup(request: { sessionId: string; confirmations: readonly F7FactorSetupConfirmation[] }): F7SessionSnapshot;
  setFactorMode(request: { sessionId: string; factorId: string; mode: F7FactorSourceMode }): F7SessionSnapshot;
  pasteMeasurements(request: F7MeasurementPasteRequest & { sessionId: string }): F7SessionSnapshot;
  applyMeasurementDisposition(request: F7MeasurementDispositionRequest & { sessionId: string }): F7SessionSnapshot;
  getSession(sessionId: string): F7SessionSnapshot;
}