import { z } from "zod";
import {
  workbookCatalogAnalysisSourceSchema,
  worksheetKindSchema,
  worksheetSelectionConfirmationSchema,
  worksheetSystemSpecificationSchema,
} from "./contracts.js";
import type {
  WorksheetSelectionConfirmation,
} from "./contracts.js";

const sha256LowerSchema = z.string().regex(/^[a-f0-9]{64}$/);
const finiteNumberSchema = z.number().finite();
const finitePositiveNumberSchema = z.number().finite().positive();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const wilsonScoreZ95 = 1.959963984540054;

const nearlyEqual = (left: number, right: number): boolean => {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }
  if (left === right) {
    return true;
  }
  return Math.abs(left - right) <= Number.EPSILON * 32
    * Math.max(Math.abs(left), Math.abs(right), Number.MIN_VALUE);
};

export const F7_SELECTION_NORMAL_SKEWNESS_MAX = 0.5;
export const F7_SELECTION_NORMAL_COEFFICIENT_OF_VARIATION_MAX = 0.10;
export const F7_SELECTION_NORMAL_MEAN_MEDIAN_RELATIVE_DIFFERENCE_MAX = 0.02;
export const F7_SELECTION_NORMAL_QQ_CURVATURE_MAX = 0.10;

const controlledCellReferenceSchema = z.string().regex(/^[^!]+![A-Z]+[1-9]\d*$/);
const sourceCellsSchema = z
  .record(z.string().min(1), controlledCellReferenceSchema);

function requireGovernedFactorSource(
  value: { readonly sourceCells: Readonly<Record<string, string>>; readonly userAdded?: true | undefined },
  context: z.RefinementCtx,
): void {
  if (value.userAdded !== true && Object.keys(value.sourceCells).length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "sourceCells must contain at least one controlled cell reference",
      path: ["sourceCells"],
    });
  }
}

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

export const f7LoopCoefficientSchema = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

export const f7FactorSourceModeSchema = z.enum([
  "MEASURED",
  "BASELINE_ASSUMPTION",
]);

export const f7MeasurementStructureSchema = z.enum([
  "RATIONAL_SUBGROUP",
  "ORDERED_INDIVIDUALS",
  "UNORDERED_SAMPLE",
]);

export const f7RationalSubgroupEstimatorSchema = z.enum(["RANGE_D2", "S_C4"]);

export const f7RationalSubgroupConfigSchema = z
  .object({
    subgroupSize: z.number().int().min(2).max(25),
    estimator: f7RationalSubgroupEstimatorSchema,
  })
  .strict();

export const f7MsaStatusSchema = z.enum(["available", "not_available", "unknown"]);

const editableFactorSpecificationFields = {
  designNominal: finiteNumberSchema,
  upperTolerance: z.number().finite().nonnegative(),
  lowerTolerance: z.number().finite().nonpositive(),
} as const;

export const f7ToleranceDistributionSchema = z.enum([
  "Normal",
  "Uniform",
  "Triangular",
  "Trapezoidal",
  "Elliptical",
  "Beta",
]);

const f7FactorCalculationControlFields = {
  longTermSafetyFactor: finitePositiveNumberSchema,
  sigmaLevel: finitePositiveNumberSchema,
  distribution: f7ToleranceDistributionSchema,
} as const;

const f7FactorCalculatedFields = {
  calculatedMean: finiteNumberSchema,
  tolerance: finitePositiveNumberSchema,
  oneSigma: finitePositiveNumberSchema,
  percentContributionToSigma: z.number().finite().min(0).max(1),
} as const;

function requireValidEditableFactorSpecification(
  value: { designNominal: number; upperTolerance: number; lowerTolerance: number },
  context: z.RefinementCtx,
): void {
  if (value.lowerTolerance >= value.upperTolerance) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "lowerTolerance must be less than upperTolerance",
      path: ["lowerTolerance"],
    });
  }
}

function normalizedPhysicalSpecificationLimits(
  designNominal: number,
  lowerTolerance: number,
  upperTolerance: number,
): { lower: number; upper: number } {
  const lowerEndpoint = designNominal + lowerTolerance;
  const upperEndpoint = designNominal + upperTolerance;
  return {
    lower: lowerEndpoint <= 0 && upperEndpoint >= 0
      ? 0
      : Math.min(Math.abs(lowerEndpoint), Math.abs(upperEndpoint)),
    upper: Math.max(Math.abs(lowerEndpoint), Math.abs(upperEndpoint)),
  };
}

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
    userAdded: z.literal(true).optional(),
    workbookUnitEvidence: z.string().min(1).optional(),
    excelSignedMean: finiteNumberSchema,
    ...editableFactorSpecificationFields,
    longTermSafetyFactor: f7FactorCalculationControlFields.longTermSafetyFactor.optional(),
    sigmaLevel: f7FactorCalculationControlFields.sigmaLevel.optional(),
    standardDeviation: finitePositiveNumberSchema,
    distribution: f7ToleranceDistributionSchema,
    lowerSpecLimit: finiteNumberSchema,
    upperSpecLimit: finiteNumberSchema,
  })
  .strict()
  .superRefine((candidate, context) => {
    requireGovernedFactorSource(candidate, context);
    requireLowerSpecLessThanUpperSpec(candidate, context);
    requireValidEditableFactorSpecification(candidate, context);
  });

export const f7FactorSetupConfirmationSchema = z
  .object({
    factorCandidateId: sha256LowerSchema,
    factorName: z.string().trim().min(1).optional(),
    userAdded: z.literal(true).optional(),
    ...editableFactorSpecificationFields,
    longTermSafetyFactor: f7FactorCalculationControlFields.longTermSafetyFactor.optional(),
    sigmaLevel: f7FactorCalculationControlFields.sigmaLevel.optional(),
    distribution: f7FactorCalculationControlFields.distribution.optional(),
    confirmed: z.literal(true),
  })
  .strict()
  .superRefine((confirmation, context) => {
    requireValidEditableFactorSpecification(confirmation, context);
    if ((confirmation.userAdded === true) !== (confirmation.factorName !== undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "user-added factors require factorName and userAdded together",
        path: ["factorName"],
      });
    }
  });

export const f7UnitSourceSchema = z.enum(["workbook", "user_confirmed", "unspecified"]);

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
    userAdded: z.literal(true).optional(),
    unit: z.string().trim().min(1),
    unitSource: f7UnitSourceSchema,
    ...editableFactorSpecificationFields,
    ...f7FactorCalculationControlFields,
    ...f7FactorCalculatedFields,
    loopCoefficient: f7LoopCoefficientSchema,
    physicalMean: z.number().finite().min(0),
    signedContributionMean: finiteNumberSchema,
    baselineSampler: f7BaselineSamplerSchema,
    lowerSpecLimit: finiteNumberSchema,
    upperSpecLimit: finiteNumberSchema,
  })
  .strict()
  .superRefine((evidence, context) => {
    requireGovernedFactorSource(evidence, context);
    requireLowerSpecLessThanUpperSpec(evidence, context);
    requireValidEditableFactorSpecification(evidence, context);

    const expectedLoopCoefficient = Math.sign(evidence.designNominal);
    if (evidence.loopCoefficient !== expectedLoopCoefficient) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "loopCoefficient must equal the sign of designNominal",
        path: ["loopCoefficient"],
      });
    }
    const expectedCalculatedMean = evidence.designNominal < 0
      ? evidence.designNominal - (evidence.upperTolerance + evidence.lowerTolerance) / 2
      : evidence.designNominal + (evidence.upperTolerance + evidence.lowerTolerance) / 2;
    if (!nearlyEqual(evidence.calculatedMean, expectedCalculatedMean)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "calculatedMean must follow the governed F4 formula",
        path: ["calculatedMean"],
      });
    }
    const expectedPhysicalMean = Math.abs(expectedCalculatedMean);
    if (Math.abs(evidence.physicalMean - expectedPhysicalMean) > 1e-12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "physicalMean must equal abs(designNominal) within 1e-12",
        path: ["physicalMean"],
      });
    }
    const expectedSignedContributionMean = expectedCalculatedMean;
    if (Math.abs(evidence.signedContributionMean - expectedSignedContributionMean) > 1e-12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "signedContributionMean must equal designNominal within 1e-12",
        path: ["signedContributionMean"],
      });
    }

    const expectedLimits = normalizedPhysicalSpecificationLimits(
      evidence.designNominal,
      evidence.lowerTolerance,
      evidence.upperTolerance,
    );
    if (Math.abs(evidence.lowerSpecLimit - expectedLimits.lower) > 1e-12
      || Math.abs(evidence.upperSpecLimit - expectedLimits.upper) > 1e-12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "specification limits must equal the normalized tolerance endpoints",
        path: ["lowerSpecLimit"],
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

export const F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS = 500;

export const f7MeasurementDatasetSchema = z
  .object({
    factorId: sha256LowerSchema,
    unit: z.string().trim().min(1),
    structure: f7MeasurementStructureSchema,
    rationalSubgroupConfig: f7RationalSubgroupConfigSchema.optional(),
    sourceReference: z.string().min(1),
    importedAt: isoDateTimeSchema,
    msaStatus: f7MsaStatusSchema,
    observations: z.array(f7ObservationSchema).max(F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS),
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

export const F7_DISTRIBUTION_CANDIDATE_ORDER = [
  "normal",
  "lognormal",
  "weibull",
  "gamma",
  "uniform",
] as const;

export const f7DistributionCandidateFamilySchema = z.enum(F7_DISTRIBUTION_CANDIDATE_ORDER);

export const f7DistributionModelSpecificationSchema = z.enum([
  "normal_location_scale",
  "lognormal_location_zero",
  "lognormal_location_free",
  "weibull_location_zero",
  "weibull_location_free",
  "gamma_location_zero",
  "gamma_location_free",
  "uniform_boundary_mle",
]);

export type F7DistributionModelSpecification = z.infer<typeof f7DistributionModelSpecificationSchema>;

const distributionModelSpecificationFamily: Record<F7DistributionModelSpecification, z.infer<typeof f7DistributionCandidateFamilySchema>> = {
  normal_location_scale: "normal",
  lognormal_location_zero: "lognormal",
  lognormal_location_free: "lognormal",
  weibull_location_zero: "weibull",
  weibull_location_free: "weibull",
  gamma_location_zero: "gamma",
  gamma_location_free: "gamma",
  uniform_boundary_mle: "uniform",
};

const distributionModelSpecificationParameterCount: Record<F7DistributionModelSpecification, number> = {
  normal_location_scale: 2,
  lognormal_location_zero: 2,
  lognormal_location_free: 3,
  weibull_location_zero: 2,
  weibull_location_free: 3,
  gamma_location_zero: 2,
  gamma_location_free: 3,
  uniform_boundary_mle: 2,
};

export function parameterCountForF7DistributionModelSpecification(
  specification: F7DistributionModelSpecification,
): number {
  return distributionModelSpecificationParameterCount[specification];
}

export const f7DistributionFitStatusSchema = z.enum(["acceptable", "weak", "rejected"]);

export const f7DistributionFitParametersSchema = z
  .record(z.string().min(1), finiteNumberSchema)
  .refine((parameters) => Object.keys(parameters).length > 0, {
    message: "parameters must contain at least one estimate",
  });

export const F7_UNIFORM_BOUNDARY_WARNING = "Uniform MLE bounds equal the sample minimum and maximum; boundary estimates are sensitive to additional observations.";

export const f7DistributionFitQqPointSchema = z
  .object({
    observed: finiteNumberSchema,
    theoretical: finiteNumberSchema,
  })
  .strict();

export const f7DistributionFitQqPointsSchema = z
  .array(f7DistributionFitQqPointSchema)
  .min(2)
  .superRefine((points, context) => {
    for (let index = 1; index < points.length; index += 1) {
      if (points[index]!.observed < points[index - 1]!.observed
        || points[index]!.theoretical < points[index - 1]!.theoretical) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Q-Q points must be ordered by observed and theoretical values",
          path: [index],
        });
        break;
      }
    }
  });

function wilsonScoreInterval(successes: number, trials: number): { lower: number; upper: number } {
  const zSquared = wilsonScoreZ95 * wilsonScoreZ95;
  const proportion = successes / trials;
  const denominator = 1 + zSquared / trials;
  const center = (proportion + zSquared / (2 * trials)) / denominator;
  const margin = (wilsonScoreZ95 / denominator)
    * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * trials)) / trials);
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

const f7DistributionFitBootstrapConfidenceIntervalSchema = z
  .object({
    level: z.literal(0.95),
    method: z.literal("wilson_score"),
    lower: z.number().finite().min(0).max(1),
    upper: z.number().finite().min(0).max(1),
  })
  .strict()
  .superRefine((interval, context) => {
    if (interval.lower > interval.upper) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confidenceInterval.lower must be less than or equal to confidenceInterval.upper",
        path: ["lower"],
      });
    }
  });

export const f7DistributionFitBootstrapSchema = z
  .object({
    statisticId: z.literal("anderson_darling"),
    observedStatistic: z.number().finite().nonnegative(),
    comparisonDirection: z.literal("greater_than_or_equal"),
    refitEachReplicate: z.literal(true),
    extremeReplicateCount: z.number().int().min(0).max(10_000),
    confidenceInterval: f7DistributionFitBootstrapConfidenceIntervalSchema,
    pValue: z.number().finite().min(0).max(1),
    replicates: z.literal(10_000),
    seed: sha256LowerSchema,
    methodId: z.literal("F7_BOOTSTRAP_V2"),
    candidateMethodId: z.literal("F7_DISTRIBUTION_FIT_V1"),
    streamDigest: sha256LowerSchema,
    status: f7DistributionFitStatusSchema,
  })
  .strict()
  .superRefine((bootstrap, context) => {
    const expectedPValue = (bootstrap.extremeReplicateCount + 1) / (bootstrap.replicates + 1);
    if (Math.abs(bootstrap.pValue - expectedPValue) > 1e-12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pValue must equal (extremeReplicateCount + 1) / (replicates + 1)",
        path: ["pValue"],
      });
    }

    const expectedInterval = wilsonScoreInterval(bootstrap.extremeReplicateCount, bootstrap.replicates);
    if (Math.abs(bootstrap.confidenceInterval.lower - expectedInterval.lower) > 1e-12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confidenceInterval.lower must match the governed Wilson score lower bound",
        path: ["confidenceInterval", "lower"],
      });
    }
    if (Math.abs(bootstrap.confidenceInterval.upper - expectedInterval.upper) > 1e-12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confidenceInterval.upper must match the governed Wilson score upper bound",
        path: ["confidenceInterval", "upper"],
      });
    }

    const expectedStatus = bootstrap.pValue < 0.05
      ? "rejected"
      : bootstrap.pValue < 0.1
        ? "weak"
        : "acceptable";
    if (bootstrap.status !== expectedStatus) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "status must match the governed bootstrap pValue threshold",
        path: ["status"],
      });
    }
  });

export const f7DistributionFitCandidateSchema = z
  .object({
    family: f7DistributionCandidateFamilySchema,
    modelSpecification: f7DistributionModelSpecificationSchema,
    parameterCount: z.number().int().positive(),
    parameters: f7DistributionFitParametersSchema,
    logLikelihood: finiteNumberSchema,
    aic: finiteNumberSchema,
    aicc: finiteNumberSchema,
    bic: finiteNumberSchema,
    deltaAicc: finiteNumberSchema,
    deltaBic: finiteNumberSchema,
    ks: z.number().finite().min(0).max(1),
    ad: z.number().finite().nonnegative(),
    qqPoints: f7DistributionFitQqPointsSchema,
    bootstrap: f7DistributionFitBootstrapSchema,
    warnings: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((candidate, context) => {
    if (candidate.modelSpecification.endsWith("_location_free")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "free-location distribution fitting is not implemented",
        path: ["modelSpecification"],
      });
    }

    if (distributionModelSpecificationFamily[candidate.modelSpecification] !== candidate.family) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `modelSpecification must match family ${candidate.family}`,
        path: ["modelSpecification"],
      });
    }

    if (Math.abs(candidate.bootstrap.observedStatistic - candidate.ad) > 1e-12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bootstrap.observedStatistic must equal candidate.ad within 1e-12",
        path: ["bootstrap", "observedStatistic"],
      });
    }

    const expectedParameterCount = parameterCountForF7DistributionModelSpecification(candidate.modelSpecification);
    if (candidate.parameterCount !== expectedParameterCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `parameterCount must equal ${expectedParameterCount} for ${candidate.modelSpecification}`,
        path: ["parameterCount"],
      });
    }

    const expectedKeys: Record<typeof candidate.family, readonly string[]> = {
      normal: ["mean", "standardDeviation"],
      lognormal: ["logMean", "logStandardDeviation"],
      weibull: ["shape", "scale"],
      gamma: ["shape", "scale"],
      uniform: ["minimum", "maximum"],
    };
    const actualKeys = Object.keys(candidate.parameters).sort();
    const governedKeys = [...expectedKeys[candidate.family]].sort();
    if (actualKeys.length !== governedKeys.length
      || actualKeys.some((key, index) => key !== governedKeys[index])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `parameters must contain exactly ${governedKeys.join(", ")} for ${candidate.family}`,
        path: ["parameters"],
      });
      return;
    }

    const parameters = candidate.parameters;
    const positiveKeys = candidate.family === "normal"
      ? ["standardDeviation"]
      : candidate.family === "lognormal"
        ? ["logStandardDeviation"]
        : candidate.family === "uniform"
          ? []
          : ["shape", "scale"];
    for (const key of positiveKeys) {
      if (!(parameters[key]! > 0)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} must be positive`,
          path: ["parameters", key],
        });
      }
    }
    if (candidate.family === "uniform" && !(parameters.maximum! > parameters.minimum!)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maximum must be greater than minimum",
        path: ["parameters", "maximum"],
      });
    }
    if (candidate.family === "uniform"
      && (candidate.warnings.length !== 1 || candidate.warnings[0] !== F7_UNIFORM_BOUNDARY_WARNING)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "uniform warnings must contain exactly the governed boundary warning",
        path: ["warnings"],
      });
    }
  });

export const f7DistributionFitFailedCandidateSchema = z
  .object({
    family: f7DistributionCandidateFamilySchema,
    reasonCode: z.literal("numerical_fit_failed"),
  })
  .strict();

export const f7SampleDiagnosticsSchema = z
  .object({
    mean: finiteNumberSchema,
    median: finiteNumberSchema,
    skewness: finiteNumberSchema,
    coefficientOfVariation: z.number().finite().nonnegative(),
    meanMedianRelativeDifference: z.number().finite().nonnegative(),
    normalQqCurvature: z.number().finite().nonnegative(),
  })
  .strict();

export const f7SelectionDecisionMethodIdSchema = z.literal("F7_MODEL_SELECTION_V1");

export const f7SelectionDecisionStatusSchema = z.enum([
  "unique_preference",
  "no_unique_preference",
  "no_acceptable_model",
  "withheld_candidate_failures",
]);

export const f7SelectionDecisionConfidenceSchema = z.enum(["low", "moderate"]);

export const f7SelectionDecisionReasonCodeSchema = z.enum([
  "SINGLE_ACCEPTABLE_COMPETITOR",
  "MULTIPLE_COMPETITIVE_MODELS",
  "NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT",
  "SMALL_SAMPLE_UNCERTAINTY",
  "NO_ACCEPTABLE_MODEL",
  "CANDIDATE_FIT_FAILURES",
]);

export const f7SelectionDecisionSchema = z
  .object({
    methodId: f7SelectionDecisionMethodIdSchema,
    status: f7SelectionDecisionStatusSchema,
    numericBestFamily: f7DistributionCandidateFamilySchema.optional(),
    competitiveFamilies: z.array(f7DistributionCandidateFamilySchema),
    engineeringDefaultFamily: f7DistributionCandidateFamilySchema.optional(),
    proposedFinalFamily: f7DistributionCandidateFamilySchema.optional(),
    confidence: f7SelectionDecisionConfidenceSchema,
    reasonCodes: z.array(f7SelectionDecisionReasonCodeSchema),
  })
  .strict()
  .superRefine((decision, context) => {
    if (new Set(decision.competitiveFamilies).size !== decision.competitiveFamilies.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "competitiveFamilies must be unique",
        path: ["competitiveFamilies"],
      });
    }
    if (new Set(decision.reasonCodes).size !== decision.reasonCodes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reasonCodes must be unique",
        path: ["reasonCodes"],
      });
    }
  });

export const f7DistributionCharacteristicKindSchema = z.enum(["dimensional", "other"]);

export const f7DistributionFitResultSchema = z
  .object({
    factorId: sha256LowerSchema,
    sampleSize: z.number().int().positive(),
    characteristicKind: f7DistributionCharacteristicKindSchema,
    candidates: z.array(f7DistributionFitCandidateSchema).min(1),
    failedCandidates: z.array(f7DistributionFitFailedCandidateSchema),
    sampleDiagnostics: f7SampleDiagnosticsSchema,
    selectionDecision: f7SelectionDecisionSchema,
  })
  .strict()
  .superRefine((result, context) => {
    const informationCriterionTolerance = 1e-9;
    const families = result.candidates.map((candidate) => candidate.family);
    if (new Set(families).size !== families.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "candidate families must be unique",
        path: ["candidates"],
      });
    }

    const failedFamilies = result.failedCandidates.map((candidate) => candidate.family);
    if (new Set(failedFamilies).size !== failedFamilies.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "failed candidate families must be unique",
        path: ["failedCandidates"],
      });
    }
    if (failedFamilies.some((family) => families.includes(family))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "successful and failed candidate families must not overlap",
        path: ["failedCandidates"],
      });
    }

    const minimumAicc = result.candidates.reduce(
      (best, candidate) => Math.min(best, candidate.aicc),
      Number.POSITIVE_INFINITY,
    );
    const minimumBic = result.candidates.reduce(
      (best, candidate) => Math.min(best, candidate.bic),
      Number.POSITIVE_INFINITY,
    );

    result.candidates.forEach((candidate, index) => {
      if (result.sampleSize <= candidate.parameterCount + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "sampleSize must exceed parameterCount + 1 for AICc",
          path: ["sampleSize"],
        });
        return;
      }

      const expectedAic = 2 * candidate.parameterCount - 2 * candidate.logLikelihood;
      const expectedAicc = expectedAic + (2 * candidate.parameterCount * (candidate.parameterCount + 1))
        / (result.sampleSize - candidate.parameterCount - 1);
      const expectedBic = candidate.parameterCount * Math.log(result.sampleSize) - 2 * candidate.logLikelihood;
      const expectedDeltaAicc = candidate.aicc - minimumAicc;
      const expectedDeltaBic = candidate.bic - minimumBic;

      if (Math.abs(candidate.aic - expectedAic) > informationCriterionTolerance) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "aic must equal 2k - 2 logLikelihood",
          path: ["candidates", index, "aic"],
        });
      }
      if (Math.abs(candidate.aicc - expectedAicc) > informationCriterionTolerance) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "aicc must equal aic + 2k(k+1)/(n-k-1)",
          path: ["candidates", index, "aicc"],
        });
      }
      if (Math.abs(candidate.bic - expectedBic) > informationCriterionTolerance) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "bic must equal k ln(n) - 2 logLikelihood",
          path: ["candidates", index, "bic"],
        });
      }
      if (candidate.deltaAicc < 0 || Math.abs(candidate.deltaAicc - expectedDeltaAicc) > informationCriterionTolerance) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "deltaAicc must equal candidate aicc minus the minimum aicc",
          path: ["candidates", index, "deltaAicc"],
        });
      }
      if (candidate.deltaBic < 0 || Math.abs(candidate.deltaBic - expectedDeltaBic) > informationCriterionTolerance) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "deltaBic must equal candidate bic minus the minimum bic",
          path: ["candidates", index, "deltaBic"],
        });
      }
    });

    const acceptable = result.candidates.filter((candidate) => candidate.bootstrap.status === "acceptable");
    const selectionDecision = result.selectionDecision;
    const minimumAcceptableAicc = acceptable.reduce(
      (best, candidate) => Math.min(best, candidate.aicc),
      Number.POSITIVE_INFINITY,
    );
    const familyPrecedence = new Map(F7_DISTRIBUTION_CANDIDATE_ORDER.map((family, index) => [family, index]));
    const expectedNumericBest = acceptable.reduce<(typeof acceptable)[number] | undefined>((best, candidate) => {
      if (best === undefined || candidate.aicc < best.aicc) return candidate;
      if (candidate.aicc > best.aicc) return best;
      return familyPrecedence.get(candidate.family)! < familyPrecedence.get(best.family)! ? candidate : best;
    }, undefined);
    const expectedCompetitiveFamilies = expectedNumericBest === undefined
      ? []
      : acceptable
        .filter((candidate) => candidate.aicc - minimumAcceptableAicc <= 2)
        .map((candidate) => candidate.family);
    if (selectionDecision.competitiveFamilies.length !== expectedCompetitiveFamilies.length
      || selectionDecision.competitiveFamilies.some((family, index) => family !== expectedCompetitiveFamilies[index])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "competitiveFamilies must equal the acceptable families whose AICc is within 2 of the acceptable minimum",
        path: ["selectionDecision", "competitiveFamilies"],
      });
    }

    const expectedNumericBestFamily = expectedNumericBest?.family;
    if (selectionDecision.numericBestFamily !== expectedNumericBestFamily) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "numericBestFamily must equal the lowest-AICc acceptable family when one exists",
        path: ["selectionDecision", "numericBestFamily"],
      });
    }

    const hasReason = (reasonCode: z.infer<typeof f7SelectionDecisionReasonCodeSchema>): boolean => (
      selectionDecision.reasonCodes.includes(reasonCode)
    );
    const expectedStatusReason: z.infer<typeof f7SelectionDecisionReasonCodeSchema> = expectedNumericBest === undefined
      ? "NO_ACCEPTABLE_MODEL"
      : expectedCompetitiveFamilies.length === 1
        ? "SINGLE_ACCEPTABLE_COMPETITOR"
        : "MULTIPLE_COMPETITIVE_MODELS";
    const expectedEngineeringDefaultFamily = result.failedCandidates.length === 0
      && result.characteristicKind === "dimensional"
      && expectedCompetitiveFamilies.length > 1
      && expectedCompetitiveFamilies.includes("normal")
      && Math.abs(result.sampleDiagnostics.skewness) <= F7_SELECTION_NORMAL_SKEWNESS_MAX
      && result.sampleDiagnostics.coefficientOfVariation <= F7_SELECTION_NORMAL_COEFFICIENT_OF_VARIATION_MAX
      && result.sampleDiagnostics.meanMedianRelativeDifference
        <= F7_SELECTION_NORMAL_MEAN_MEDIAN_RELATIVE_DIFFERENCE_MAX
      && result.sampleDiagnostics.normalQqCurvature <= F7_SELECTION_NORMAL_QQ_CURVATURE_MAX
      ? "normal"
      : undefined;
    const expectedProposedFinalFamily = result.failedCandidates.length > 0 || expectedNumericBestFamily === undefined
      ? undefined
      : expectedCompetitiveFamilies.includes("normal")
        ? "normal"
        : expectedNumericBestFamily;
    const expectedReasonCodes: Array<z.infer<typeof f7SelectionDecisionReasonCodeSchema>> = [
      expectedStatusReason,
      ...(result.failedCandidates.length > 0 ? ["CANDIDATE_FIT_FAILURES" as const] : []),
      ...(result.sampleSize < 50 ? ["SMALL_SAMPLE_UNCERTAINTY" as const] : []),
      ...(expectedEngineeringDefaultFamily !== undefined
        ? ["NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT" as const]
        : []),
    ];

    if (result.failedCandidates.length > 0) {
      if (selectionDecision.status !== "withheld_candidate_failures") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "status must be withheld_candidate_failures when failedCandidates is non-empty",
          path: ["selectionDecision", "status"],
        });
      }
    } else if (acceptable.length === 0) {
      if (selectionDecision.status !== "no_acceptable_model") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "status must be no_acceptable_model when no acceptable candidates exist",
          path: ["selectionDecision", "status"],
        });
      }
    } else if (expectedCompetitiveFamilies.length === 1) {
      if (selectionDecision.status !== "unique_preference") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "status must be unique_preference when exactly one competitive acceptable family exists",
          path: ["selectionDecision", "status"],
        });
      }
    } else {
      if (selectionDecision.status !== "no_unique_preference") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "status must be no_unique_preference when multiple competitive acceptable families exist",
          path: ["selectionDecision", "status"],
        });
      }
    }

    const expectedConfidence = result.failedCandidates.length > 0
      || acceptable.length === 0
      || (result.sampleSize < 50 && expectedCompetitiveFamilies.length > 1)
      ? "low"
      : "moderate";
    if (selectionDecision.confidence !== expectedConfidence) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confidence must reflect failures, acceptable evidence, and small-sample competitive uncertainty",
        path: ["selectionDecision", "confidence"],
      });
    }

    if (result.sampleSize < 50 && !hasReason("SMALL_SAMPLE_UNCERTAINTY")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reasonCodes must include SMALL_SAMPLE_UNCERTAINTY when sampleSize is below 50",
        path: ["selectionDecision", "reasonCodes"],
      });
    }

    if (selectionDecision.engineeringDefaultFamily !== expectedEngineeringDefaultFamily) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: expectedEngineeringDefaultFamily === undefined
          ? "engineeringDefaultFamily must be absent unless the dimensional Normal default conditions hold"
          : "engineeringDefaultFamily must equal the derived dimensional engineering default",
        path: ["selectionDecision", "engineeringDefaultFamily"],
      });
    }

    if (selectionDecision.proposedFinalFamily !== expectedProposedFinalFamily) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: expectedProposedFinalFamily === undefined
          ? "proposedFinalFamily must be absent when selection is withheld or no model is acceptable"
          : "proposedFinalFamily must prefer competitive Normal and otherwise equal numericBestFamily",
        path: ["selectionDecision", "proposedFinalFamily"],
      });
    }

    if (selectionDecision.reasonCodes.length !== expectedReasonCodes.length
      || expectedReasonCodes.some((reasonCode) => !selectionDecision.reasonCodes.includes(reasonCode))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reasonCodes must equal the exact derived reason set",
        path: ["selectionDecision", "reasonCodes"],
      });
    }
  });

export const f7MeasurementPasteResultSchema = z
  .object({
    status: z.enum(["ready", "blocked"]),
    factorId: sha256LowerSchema,
    dataset: f7MeasurementDatasetSchema.optional(),
    validation: f7DatasetValidationResultSchema,
  })
  .strict();

export const f7DistributionApprovalSchema = z
  .object({
    factorId: sha256LowerSchema,
    family: f7DistributionCandidateFamilySchema,
    confirmed: z.literal(true),
    approvedAt: isoDateTimeSchema,
  })
  .strict();

export const f7MonteCarloIterationsSchema = z.union([z.literal(10_000), z.literal(100_000)]);
export const f7CorrelationModeSchema = z.literal("INDEPENDENT");

const f7MonteCarloQuantilesSchema = z
  .object({
    p00135: finiteNumberSchema,
    p01: finiteNumberSchema,
    p05: finiteNumberSchema,
    p50: finiteNumberSchema,
    p95: finiteNumberSchema,
    p99: finiteNumberSchema,
    p99865: finiteNumberSchema,
  })
  .strict()
  .refine((quantiles) => (
    quantiles.p00135 <= quantiles.p01
    && quantiles.p01 <= quantiles.p05
    && quantiles.p05 <= quantiles.p50
    && quantiles.p50 <= quantiles.p95
    && quantiles.p95 <= quantiles.p99
    && quantiles.p99 <= quantiles.p99865
  ), "Monte Carlo quantiles must be ordered");

const f7HistogramSchema = z
  .object({
    methodId: z.literal("F7_HISTOGRAM_FD_V1"),
    bins: z.array(z.object({
      minimum: finiteNumberSchema,
      maximum: finiteNumberSchema,
      observedCount: z.number().int().nonnegative(),
    }).strict()).min(20).max(60),
  })
  .strict();

const f7NormalFitSchema = z
  .object({
    methodId: z.literal("F7_NORMAL_MOMENT_FIT_V1"),
    mean: finiteNumberSchema,
    standardDeviation: z.number().finite().nonnegative(),
    expectedBinCounts: z.array(z.number().finite().nonnegative()),
  })
  .strict();

const f7CapabilitySchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    cp: finitePositiveNumberSchema,
    lowerCpk: finiteNumberSchema,
    upperCpk: finiteNumberSchema,
    cpk: finiteNumberSchema,
    targetCpk: finitePositiveNumberSchema,
    targetStatus: z.enum(["meets_target", "below_target"]),
  }).strict(),
  z.object({
    status: z.literal("not_available"),
    reason: z.literal("zero_variance"),
    targetCpk: finitePositiveNumberSchema,
  }).strict(),
]);

const f7NormalModelSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    lowerTailDpm: z.number().finite().min(0).max(1_000_000),
    upperTailDpm: z.number().finite().min(0).max(1_000_000),
    totalDpm: z.number().finite().min(0).max(1_000_000),
    expectedYield: z.number().finite().min(0).max(1),
  }).strict(),
  z.object({
    status: z.literal("not_available"),
    reason: z.literal("zero_variance"),
  }).strict(),
]);

export const f7MonteCarloFactorManifestEntrySchema = z
  .object({
    factorId: sha256LowerSchema,
    family: f7DistributionCandidateFamilySchema,
    sourceMode: f7FactorSourceModeSchema,
  })
  .strict();

export const f7MonteCarloResultSchema = z
  .object({
    methodId: z.literal("F7_MONTE_CARLO_V1"),
    status: z.literal("complete"),
    lowerSpecLimit: finiteNumberSchema,
    upperSpecLimit: finiteNumberSchema,
    targetSigmaLevel: finitePositiveNumberSchema,
    iterations: f7MonteCarloIterationsSchema,
    runSeed: sha256LowerSchema,
    correlationMode: f7CorrelationModeSchema,
    mean: finiteNumberSchema,
    standardDeviation: z.number().finite().nonnegative(),
    quantiles: f7MonteCarloQuantilesSchema,
    inSpecCount: z.number().int().nonnegative(),
    outOfSpecCount: z.number().int().nonnegative(),
    yield: z.number().finite().min(0).max(1),
    outOfSpecProbability: z.number().finite().min(0).max(1),
    ppm: z.number().finite().min(0).max(1_000_000),
    histogram: f7HistogramSchema,
    normalFit: f7NormalFitSchema,
    capability: f7CapabilitySchema,
    normalModel: f7NormalModelSchema,
    factorManifest: z.array(f7MonteCarloFactorManifestEntrySchema).min(1),
  })
  .strict()
  .superRefine((result, context) => {
    requireLowerSpecLessThanUpperSpec(result, context);

    for (let index = 0; index < result.histogram.bins.length; index += 1) {
      const bin = result.histogram.bins[index]!;
      if (bin.minimum >= bin.maximum) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "histogram bin minimum must be less than maximum",
          path: ["histogram", "bins", index, "minimum"],
        });
      }
      if (index > 0 && bin.minimum !== result.histogram.bins[index - 1]!.maximum) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "histogram bins must be contiguous",
          path: ["histogram", "bins", index, "minimum"],
        });
      }
    }
    const histogramCount = result.histogram.bins.reduce((sum, bin) => sum + bin.observedCount, 0);
    if (histogramCount !== result.iterations) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "histogram observed counts must equal iterations",
        path: ["histogram", "bins"],
      });
    }
    if (result.normalFit.expectedBinCounts.length !== result.histogram.bins.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "normalFit expectedBinCounts length must equal histogram bins length",
        path: ["normalFit", "expectedBinCounts"],
      });
    }
    if (!nearlyEqual(result.normalFit.mean, result.mean)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "normalFit mean must equal result mean",
        path: ["normalFit", "mean"],
      });
    }
    if (!nearlyEqual(result.normalFit.standardDeviation, result.standardDeviation)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "normalFit standardDeviation must equal result standardDeviation",
        path: ["normalFit", "standardDeviation"],
      });
    }

    const expectedTargetCpk = result.targetSigmaLevel / 3;
    if (!nearlyEqual(result.capability.targetCpk, expectedTargetCpk)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "capability targetCpk must equal targetSigmaLevel / 3",
        path: ["capability", "targetCpk"],
      });
    }

    const zeroVariance = result.standardDeviation === 0;
    const capabilityShouldBeAvailable = !zeroVariance;
    if ((result.capability.status === "available") !== capabilityShouldBeAvailable) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "capability availability must match whether result standardDeviation is positive",
        path: ["capability", "status"],
      });
    }
    if ((result.normalModel.status === "available") !== capabilityShouldBeAvailable) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "normalModel availability must match whether result standardDeviation is positive",
        path: ["normalModel", "status"],
      });
    }

    if (result.capability.status === "available" && result.standardDeviation > 0) {
      const expectedCp = (result.upperSpecLimit - result.lowerSpecLimit) / (6 * result.standardDeviation);
      const expectedLowerCpk = (result.mean - result.lowerSpecLimit) / (3 * result.standardDeviation);
      const expectedUpperCpk = (result.upperSpecLimit - result.mean) / (3 * result.standardDeviation);
      const expectedCpk = Math.min(expectedLowerCpk, expectedUpperCpk);
      const expectedTargetStatus = result.capability.cpk >= result.capability.targetCpk
        ? "meets_target"
        : "below_target";
      for (const [field, actual, expected] of [
        ["cp", result.capability.cp, expectedCp],
        ["lowerCpk", result.capability.lowerCpk, expectedLowerCpk],
        ["upperCpk", result.capability.upperCpk, expectedUpperCpk],
        ["cpk", result.capability.cpk, expectedCpk],
      ] as const) {
        if (!nearlyEqual(actual, expected)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `capability ${field} must match the value derived from the result`,
            path: ["capability", field],
          });
        }
      }
      if (!nearlyEqual(result.capability.cpk, Math.min(result.capability.lowerCpk, result.capability.upperCpk))) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "capability cpk must equal min(lowerCpk, upperCpk)",
          path: ["capability", "cpk"],
        });
      }
      if (result.capability.targetStatus !== expectedTargetStatus) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "capability targetStatus must match cpk >= targetCpk",
          path: ["capability", "targetStatus"],
        });
      }
    }

    if (result.normalModel.status === "available") {
      const expectedTotalDpm = result.normalModel.lowerTailDpm + result.normalModel.upperTailDpm;
      const expectedNormalYield = 1 - result.normalModel.totalDpm / 1_000_000;
      if (!nearlyEqual(result.normalModel.totalDpm, expectedTotalDpm)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "normalModel totalDpm must equal lowerTailDpm + upperTailDpm",
          path: ["normalModel", "totalDpm"],
        });
      }
      if (!nearlyEqual(result.normalModel.expectedYield, expectedNormalYield)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "normalModel expectedYield must equal 1 - totalDpm / 1e6",
          path: ["normalModel", "expectedYield"],
        });
      }
    }

    if (result.inSpecCount + result.outOfSpecCount !== result.iterations) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Monte Carlo counts must equal iterations", path: ["inSpecCount"] });
    }
    const expectedYield = result.inSpecCount / result.iterations;
    const expectedOutOfSpecProbability = result.outOfSpecCount / result.iterations;
    const expectedPpm = expectedOutOfSpecProbability * 1_000_000;
    if (!nearlyEqual(result.yield, expectedYield)
      || !nearlyEqual(result.outOfSpecProbability, expectedOutOfSpecProbability)
      || !nearlyEqual(result.ppm, expectedPpm)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Monte Carlo rates must match counts", path: ["yield"] });
    }
  });

export const f7ReportAssessmentSchema = z.enum([
  "MEETS_TARGET",
  "BELOW_TARGET",
  "NOT_EVALUABLE",
]);

export const f7ReportWorkbookSchema = z
  .object({
    fileName: z.string().min(1),
    workbookContentHash: sha256LowerSchema,
    worksheetName: z.string().min(1),
  })
  .strict();

export const f7ReportSummarySchema = z
  .object({
    mean: finiteNumberSchema,
    standardDeviation: z.number().finite().nonnegative(),
    yield: z.number().finite().min(0).max(1),
    ppm: z.number().finite().min(0).max(1_000_000),
    lowerSpecLimit: finiteNumberSchema,
    upperSpecLimit: finiteNumberSchema,
    targetSigmaLevel: finitePositiveNumberSchema,
    cp: finiteNumberSchema.optional(),
    cpk: finiteNumberSchema.optional(),
    targetCpk: finitePositiveNumberSchema,
  })
  .strict()
  .superRefine(requireLowerSpecLessThanUpperSpec);

export const f7ReportFactorSchema = z
  .object({
    factorId: sha256LowerSchema,
    factorName: z.string().min(1),
    loopCoefficient: f7LoopCoefficientSchema,
    sourceMode: f7FactorSourceModeSchema,
    approvedDistribution: f7DistributionCandidateFamilySchema,
    sourceReferences: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const f7ReportSpecificationSourceCellsSchema = z
  .object({
    lowerSpecLimit: controlledCellReferenceSchema.optional(),
    upperSpecLimit: controlledCellReferenceSchema.optional(),
    targetSigmaLevel: controlledCellReferenceSchema.optional(),
  })
  .strict();

export const f7ReportSpecificationInputOriginsSchema = z
  .object({
    lowerSpecLimit: z.enum(["excel_source", "manual_override", "manual_entry"]),
    upperSpecLimit: z.enum(["excel_source", "manual_override", "manual_entry"]),
    targetSigmaLevel: z.enum(["excel_source", "manual_override", "manual_entry"]),
  })
  .strict();

export const f7ReportMethodIdsSchema = z
  .object({
    simulation: z.literal("F7_MONTE_CARLO_V1"),
    histogram: z.literal("F7_HISTOGRAM_FD_V1"),
    normalFit: z.literal("F7_NORMAL_MOMENT_FIT_V1"),
  })
  .strict();

export const f7ReportEvidenceSchema = z
  .object({
    workbookContentHash: sha256LowerSchema,
    worksheetName: z.string().min(1),
    specificationSourceCells: f7ReportSpecificationSourceCellsSchema,
    specificationInputOrigins: f7ReportSpecificationInputOriginsSchema,
    methodIds: f7ReportMethodIdsSchema,
    seed: sha256LowerSchema,
    iterations: f7MonteCarloIterationsSchema,
    factorManifest: z.array(f7MonteCarloFactorManifestEntrySchema).min(1),
  })
  .strict()
  .superRefine((evidence, context) => {
    for (const field of ["lowerSpecLimit", "upperSpecLimit", "targetSigmaLevel"] as const) {
      const origin = evidence.specificationInputOrigins[field];
      const sourceCell = evidence.specificationSourceCells[field];
      if (origin === "excel_source" && sourceCell === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} requires a source cell when its origin is excel_source`,
          path: ["specificationSourceCells", field],
        });
      } else if (origin !== "excel_source" && sourceCell !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must not include a source cell when its origin is ${origin}`,
          path: ["specificationSourceCells", field],
        });
      }
    }
  });

const f7ReportTaMetricsSchema = z.object({
  mean: finiteNumberSchema,
  standardDeviation: finitePositiveNumberSchema,
  cp: finiteNumberSchema,
  cpk: finiteNumberSchema,
}).strict();

export const f7ReportAnalysisSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    provenance: z.object({
      knowledgeBaseVersion: z.literal("v1"),
      ruleId: z.literal("default-cpk-target"),
      threshold: finitePositiveNumberSchema,
      applicability: z.string().min(1),
    }).strict(),
    comparison: z.object({
      setup: f7ReportTaMetricsSchema,
      monteCarlo: f7ReportTaMetricsSchema,
    }).strict(),
    targetAssessment: z.string().min(1),
    interpretations: z.array(z.string().min(1)).min(1),
    optimizationDirections: z.array(z.string().min(1)).min(1),
  }).strict(),
  z.object({
    status: z.literal("unavailable"),
    reason: z.string().min(1),
    optimizationDirections: z.array(z.string().min(1)),
  }).strict(),
]);

export const f7ReportProjectionSchema = z
  .object({
    contractId: z.literal("f7-report-v1"),
    outputClassification: z.literal("confidential"),
    sessionId: z.string().min(1),
    generatedAt: isoDateTimeSchema,
    assessment: f7ReportAssessmentSchema,
    workbook: f7ReportWorkbookSchema,
    summary: f7ReportSummarySchema,
    simulation: f7MonteCarloResultSchema,
    factors: z.array(f7ReportFactorSchema).min(1),
    analysis: f7ReportAnalysisSchema.optional(),
    evidence: f7ReportEvidenceSchema,
    markdown: z.string().min(1),
  })
  .strict()
  .superRefine((report, context) => {
    const capability = report.simulation.capability;
    const expectedAssessment = capability.status === "not_available"
      ? "NOT_EVALUABLE"
      : capability.targetStatus === "meets_target"
        ? "MEETS_TARGET"
        : "BELOW_TARGET";
    if (report.assessment !== expectedAssessment) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assessment must match simulation capability",
        path: ["assessment"],
      });
    }

    for (const [field, actual, expected] of [
      ["mean", report.summary.mean, report.simulation.mean],
      ["standardDeviation", report.summary.standardDeviation, report.simulation.standardDeviation],
      ["yield", report.summary.yield, report.simulation.yield],
      ["ppm", report.summary.ppm, report.simulation.ppm],
      ["lowerSpecLimit", report.summary.lowerSpecLimit, report.simulation.lowerSpecLimit],
      ["upperSpecLimit", report.summary.upperSpecLimit, report.simulation.upperSpecLimit],
      ["targetSigmaLevel", report.summary.targetSigmaLevel, report.simulation.targetSigmaLevel],
      ["targetCpk", report.summary.targetCpk, capability.targetCpk],
    ] as const) {
      if (!nearlyEqual(actual, expected)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `summary ${field} must match simulation`,
          path: ["summary", field],
        });
      }
    }

    if (capability.status === "available") {
      for (const [field, actual, expected] of [
        ["cp", report.summary.cp, capability.cp],
        ["cpk", report.summary.cpk, capability.cpk],
      ] as const) {
        if (actual === undefined || !nearlyEqual(actual, expected)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `summary ${field} must match available simulation capability`,
            path: ["summary", field],
          });
        }
      }
    } else if (report.summary.cp !== undefined || report.summary.cpk !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "summary cp and cpk must be absent when capability is not available",
        path: ["summary"],
      });
    }

    if (report.evidence.workbookContentHash !== report.workbook.workbookContentHash) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "evidence workbookContentHash must match workbook",
        path: ["evidence", "workbookContentHash"],
      });
    }
    if (report.evidence.worksheetName !== report.workbook.worksheetName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "evidence worksheetName must match workbook",
        path: ["evidence", "worksheetName"],
      });
    }
    if (report.evidence.methodIds.simulation !== report.simulation.methodId
      || report.evidence.methodIds.histogram !== report.simulation.histogram.methodId
      || report.evidence.methodIds.normalFit !== report.simulation.normalFit.methodId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "evidence methodIds must match simulation methods",
        path: ["evidence", "methodIds"],
      });
    }
    if (report.evidence.seed !== report.simulation.runSeed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "evidence seed must match simulation runSeed",
        path: ["evidence", "seed"],
      });
    }
    if (report.evidence.iterations !== report.simulation.iterations) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "evidence iterations must match simulation iterations",
        path: ["evidence", "iterations"],
      });
    }

    const simulationManifest = report.simulation.factorManifest;
    const evidenceManifest = report.evidence.factorManifest;
    const simulationFactorIds = simulationManifest.map((entry) => entry.factorId);
    const reportFactorIds = report.factors.map((factor) => factor.factorId);
    if (new Set(simulationFactorIds).size !== simulationFactorIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "simulation factorManifest factorIds must be unique",
        path: ["simulation", "factorManifest"],
      });
    }
    if (new Set(reportFactorIds).size !== reportFactorIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "report factorIds must be unique",
        path: ["factors"],
      });
    }
    if (evidenceManifest.length !== simulationManifest.length
      || evidenceManifest.some((entry, index) => {
        const simulationEntry = simulationManifest[index];
        return simulationEntry === undefined
          || entry.factorId !== simulationEntry.factorId
          || entry.family !== simulationEntry.family
          || entry.sourceMode !== simulationEntry.sourceMode;
      })) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "evidence factorManifest must equal simulation factorManifest",
        path: ["evidence", "factorManifest"],
      });
    }
    if (report.factors.length !== simulationManifest.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "report factors must cover the simulation factorManifest",
        path: ["factors"],
      });
    }
    for (const manifestEntry of simulationManifest) {
      const factor = report.factors.find((candidate) => candidate.factorId === manifestEntry.factorId);
      if (factor === undefined
        || factor.sourceMode !== manifestEntry.sourceMode
        || factor.approvedDistribution !== manifestEntry.family) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "report factor must match its simulation manifest entry",
          path: ["factors"],
        });
      }
    }
  });

export const f7AnalysisRequestContractIdSchema = z.literal("f7-analysis-request-v1");
export const f7AnalysisResultContractIdSchema = z.literal("f7-analysis-result-v1");

export const f7SessionStatusSchema = z.enum([
  "worksheet_selection",
  "factor_setup",
  "measurement_entry",
  "phase_1_ready",
]);

export const f7WorksheetOptionSchema = z
  .object({
    selectionIndex: z.number().int().positive(),
    worksheetName: z.string().min(1),
    toleranceLoopDescription: z.string().min(1),
    worksheetKind: worksheetKindSchema,
    source: workbookCatalogAnalysisSourceSchema,
  })
  .strict();

const f7SessionFactorStateSchema = z
  .object({
    factorCandidate: f7FactorCandidateSchema,
    setup: f7FactorSetupConfirmationSchema.optional(),
    sourceMode: f7FactorSourceModeSchema.optional(),
    input: f7FactorInputSchema.optional(),
    evidence: f7FactorEvidenceSchema.optional(),
    datasetValidation: f7DatasetValidationResultSchema.optional(),
    measurementPasteResult: f7MeasurementPasteResultSchema.optional(),
    distributionFitResult: f7DistributionFitResultSchema.optional(),
    distributionApproval: f7DistributionApprovalSchema.optional(),
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

    if (
      knownFinalFactorId !== undefined
      && factorState.distributionFitResult !== undefined
      && factorState.distributionFitResult.factorId !== knownFinalFactorId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "distributionFitResult.factorId must match evidence.factorId when both are present",
        path: ["distributionFitResult", "factorId"],
      });
    }

    if (factorState.distributionApproval !== undefined) {
      const approval = factorState.distributionApproval;
      const fit = factorState.distributionFitResult;
      const approvedCandidate = fit?.candidates.find((candidate) => candidate.family === approval.family);
      if (approval.factorId !== knownFinalFactorId
        || fit?.selectionDecision.proposedFinalFamily !== approval.family
        || approvedCandidate?.bootstrap.status !== "acceptable") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "distributionApproval must approve the acceptable proposed family for this factor",
          path: ["distributionApproval"],
        });
      }
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
    worksheetOptions: z.array(f7WorksheetOptionSchema).min(1),
    dimensionChainImage: z.object({
      status: z.literal("available"),
      worksheetName: z.string().min(1),
      contentHash: sha256LowerSchema,
      url: z.string().regex(/^\/f7\/session\/[^/]+\/dimension-chain-image$/),
    }).strict().optional(),
    systemSpecification: worksheetSystemSpecificationSchema.optional(),
    factors: z.array(f7SessionFactorStateSchema),
    monteCarloResult: f7MonteCarloResultSchema.optional(),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const worksheetNames = snapshot.worksheetOptions.map((option) => option.worksheetName);
    if (new Set(worksheetNames).size !== worksheetNames.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "worksheet option names must be unique",
        path: ["worksheetOptions"],
      });
    }

    const selectionIndexes = snapshot.worksheetOptions.map((option) => option.selectionIndex);
    if (new Set(selectionIndexes).size !== selectionIndexes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "worksheet option indexes must be unique",
        path: ["worksheetOptions"],
      });
    }
  });

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
    rationalSubgroupConfig: f7RationalSubgroupConfigSchema.optional(),
    sourceReference: z.string().min(1),
    msaStatus: f7MsaStatusSchema,
    text: z.string().min(1).max(1024 * 1024),
  })
  .strict()
  .superRefine((request, context) => {
    if ((request.structure === "RATIONAL_SUBGROUP") === (request.rationalSubgroupConfig === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rationalSubgroupConfig must be provided only for RATIONAL_SUBGROUP",
        path: ["rationalSubgroupConfig"],
      });
    }
  });

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
    systemSpecification: z.object({
      lowerSpecLimit: finiteNumberSchema,
      upperSpecLimit: finiteNumberSchema,
      targetSigmaLevel: finitePositiveNumberSchema,
    }).strict().optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const specification = request.systemSpecification;
    if (specification && specification.lowerSpecLimit >= specification.upperSpecLimit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lowerSpecLimit must be less than upperSpecLimit",
        path: ["systemSpecification", "lowerSpecLimit"],
      });
    }
  });

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
        rationalSubgroupConfig: f7RationalSubgroupConfigSchema.optional(),
        sourceReference: z.string().min(1),
        msaStatus: f7MsaStatusSchema,
        text: z.string().min(1).max(1024 * 1024),
      })
      .strict()
      .superRefine((body, context) => {
        if ((body.structure === "RATIONAL_SUBGROUP") === (body.rationalSubgroupConfig === undefined)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "rationalSubgroupConfig must be provided only for RATIONAL_SUBGROUP",
            path: ["rationalSubgroupConfig"],
          });
        }
      }),
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

export const f7DistributionFitRouteRequestSchema = z
  .object({
    params: z.object({ factorId: sha256LowerSchema }).strict(),
    body: z.object({ sessionId: z.string().min(1) }).strict(),
  })
  .strict();

export const f7DistributionApprovalRouteRequestSchema = z
  .object({
    params: z.object({ factorId: sha256LowerSchema }).strict(),
    body: z.object({
      sessionId: z.string().min(1),
      family: f7DistributionCandidateFamilySchema,
      confirmed: z.literal(true),
    }).strict(),
  })
  .strict();

export const f7MonteCarloRunRouteRequestSchema = z
  .object({
    body: z.object({
      sessionId: z.string().min(1),
      lowerSpecLimit: finiteNumberSchema,
      upperSpecLimit: finiteNumberSchema,
      targetSigmaLevel: finitePositiveNumberSchema,
      iterations: f7MonteCarloIterationsSchema,
      runSeed: sha256LowerSchema,
      correlationMode: f7CorrelationModeSchema,
    }).strict(),
  })
  .strict()
  .superRefine((request, context) => requireLowerSpecLessThanUpperSpec(request.body, context));

export const f7ReportGenerateRouteRequestSchema = z
  .object({
    body: z.object({ sessionId: z.string().min(1) }).strict(),
  })
  .strict();

export const f7SessionRouteParamsSchema = z
  .object({
    sessionId: z.string().min(1),
  })
  .strict();

export type F7FactorCandidate = z.infer<typeof f7FactorCandidateSchema>;
export type F7FactorSetupConfirmation = z.infer<typeof f7FactorSetupConfirmationSchema>;
export type F7ToleranceDistribution = z.infer<typeof f7ToleranceDistributionSchema>;
export type F7LoopCoefficient = z.infer<typeof f7LoopCoefficientSchema>;
export type F7FactorSourceMode = z.infer<typeof f7FactorSourceModeSchema>;
export type F7MeasurementStructure = z.infer<typeof f7MeasurementStructureSchema>;
export type F7RationalSubgroupEstimator = z.infer<typeof f7RationalSubgroupEstimatorSchema>;
export type F7RationalSubgroupConfig = z.infer<typeof f7RationalSubgroupConfigSchema>;
export type F7MsaStatus = z.infer<typeof f7MsaStatusSchema>;
export type F7ExclusionReason = z.infer<typeof f7ExclusionReasonSchema>;
export type F7FactorInput = z.infer<typeof f7FactorInputSchema>;
export type F7FactorEvidence = z.infer<typeof f7FactorEvidenceSchema>;
export type F7MeasurementDataset = z.infer<typeof f7MeasurementDatasetSchema>;
export type F7DatasetValidationIssue = z.infer<typeof f7DatasetValidationIssueSchema>;
export type F7MeasurementPasteResult = z.infer<typeof f7MeasurementPasteResultSchema>;
export type F7DatasetValidationResult = z.infer<typeof f7DatasetValidationResultSchema>;
export type F7DistributionCandidateFamily = z.infer<typeof f7DistributionCandidateFamilySchema>;
export type F7DistributionFitStatus = z.infer<typeof f7DistributionFitStatusSchema>;
export type F7DistributionFitCandidate = z.infer<typeof f7DistributionFitCandidateSchema>;
export type F7SampleDiagnostics = z.infer<typeof f7SampleDiagnosticsSchema>;
export type F7SelectionDecisionStatus = z.infer<typeof f7SelectionDecisionStatusSchema>;
export type F7SelectionDecisionConfidence = z.infer<typeof f7SelectionDecisionConfidenceSchema>;
export type F7SelectionDecisionReasonCode = z.infer<typeof f7SelectionDecisionReasonCodeSchema>;
export type F7DistributionCharacteristicKind = z.infer<typeof f7DistributionCharacteristicKindSchema>;
export type F7SelectionDecision = z.infer<typeof f7SelectionDecisionSchema>;
export type F7DistributionFitResult = z.infer<typeof f7DistributionFitResultSchema>;
export type F7DistributionApproval = z.infer<typeof f7DistributionApprovalSchema>;
export type F7MonteCarloFactorManifestEntry = z.infer<typeof f7MonteCarloFactorManifestEntrySchema>;
export type F7MonteCarloResult = z.infer<typeof f7MonteCarloResultSchema>;
export type F7MonteCarloIterations = z.infer<typeof f7MonteCarloIterationsSchema>;
export type F7ReportAssessment = z.infer<typeof f7ReportAssessmentSchema>;
export type F7ReportWorkbook = z.infer<typeof f7ReportWorkbookSchema>;
export type F7ReportSummary = z.infer<typeof f7ReportSummarySchema>;
export type F7ReportFactor = z.infer<typeof f7ReportFactorSchema>;
export type F7ReportSpecificationSourceCells = z.infer<typeof f7ReportSpecificationSourceCellsSchema>;
export type F7ReportSpecificationInputOrigins = z.infer<typeof f7ReportSpecificationInputOriginsSchema>;
export type F7ReportMethodIds = z.infer<typeof f7ReportMethodIdsSchema>;
export type F7ReportEvidence = z.infer<typeof f7ReportEvidenceSchema>;
export type F7ReportAnalysis = z.infer<typeof f7ReportAnalysisSchema>;
export type F7ReportProjection = z.infer<typeof f7ReportProjectionSchema>;
export type F7WorkbookImportRequest = z.infer<typeof f7WorkbookImportRequestSchema>;
export type F7MeasurementPasteRequest = z.infer<typeof f7MeasurementPasteRequestSchema>;
export type F7MeasurementDispositionRequest = z.infer<typeof f7MeasurementDispositionRequestSchema>;
export type F7SessionSnapshot = z.infer<typeof f7SessionSnapshotSchema>;
export type F7WorksheetOption = z.infer<typeof f7WorksheetOptionSchema>;
export type F7WorkbookImportRouteRequest = z.infer<typeof f7WorkbookImportRouteRequestSchema>;
export type F7WorksheetConfirmRouteRequest = z.infer<typeof f7WorksheetConfirmRouteRequestSchema>;
export type F7FactorConfirmRouteRequest = z.infer<typeof f7FactorConfirmRouteRequestSchema>;
export type F7FactorModeRouteRequest = z.infer<typeof f7FactorModeRouteRequestSchema>;
export type F7MeasurementPasteRouteRequest = z.infer<typeof f7MeasurementPasteRouteRequestSchema>;
export type F7MeasurementDispositionRouteRequest = z.infer<typeof f7MeasurementDispositionRouteRequestSchema>;
export type F7DistributionFitRouteRequest = z.infer<typeof f7DistributionFitRouteRequestSchema>;
export type F7DistributionApprovalRouteRequest = z.infer<typeof f7DistributionApprovalRouteRequestSchema>;
export type F7MonteCarloRunRouteRequest = z.infer<typeof f7MonteCarloRunRouteRequestSchema>;
export type F7ReportGenerateRouteRequest = z.infer<typeof f7ReportGenerateRouteRequestSchema>;
export type F7SessionRouteParams = z.infer<typeof f7SessionRouteParamsSchema>;

export interface F7SessionService {
  importWorkbook(request: F7WorkbookImportRequest): F7SessionSnapshot;
  confirmWorksheet(request: { sessionId: string; confirmation: WorksheetSelectionConfirmation }): F7SessionSnapshot;
  confirmFactorSetup(request: F7FactorConfirmRouteRequest): F7SessionSnapshot;
  setFactorMode(request: { sessionId: string; factorId: string; mode: F7FactorSourceMode }): F7SessionSnapshot;
  pasteMeasurements(request: F7MeasurementPasteRequest & { sessionId: string }): F7SessionSnapshot;
  applyMeasurementDisposition(request: F7MeasurementDispositionRequest & { sessionId: string }): F7SessionSnapshot;
  fitDistribution(request: { sessionId: string; factorId: string }): F7SessionSnapshot;
  approveDistribution(request: { sessionId: string; factorId: string; family: F7DistributionCandidateFamily; confirmed: true }): F7SessionSnapshot;
  runMonteCarlo(request: F7MonteCarloRunRouteRequest["body"]): F7SessionSnapshot;
  generateReport(request: { sessionId: string }): F7ReportProjection;
  getSession(sessionId: string): F7SessionSnapshot;
  readDimensionChainImage(sessionId: string): {
    readonly mediaType: "image/png" | "image/jpeg";
    readonly bytes: Uint8Array;
  };
}